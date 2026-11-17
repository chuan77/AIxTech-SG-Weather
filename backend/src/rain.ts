import { logger } from './logger.js';
import {
  createRequestStats,
  ProviderRequester,
  WeatherProviderError,
  type RequestStats,
} from './providerHttp.js';

/** One station's rainfall over the latest 15 minutes (spec 011, data-model.md). */
export interface RainStationReading {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Sum over the covered periods, to 0.1 mm; null when no period has a reading. */
  total_mm: number | null;
  periods_covered: 0 | 1 | 2 | 3;
}

/** One shared, short-lived set of readings for the whole island. Never stored in SQLite. */
export interface IslandRainObservation {
  stations: RainStationReading[];
  window_minutes: 15;
  /** The newest usable period's timestamp from the provider (end of its 5-minute total). */
  window_end: string | null;
  window_start: string | null;
  /** How many of the three window periods were in the response. */
  periods_found: number;
  fetched_at: string;
  stale: boolean;
}

/** Where one rain refresh spent its time (diagnostics only, like `LightningTiming`). */
export interface RainTiming {
  served: 'cache' | 'shared' | 'fetch';
  totalMs: number;
  providerMs: number;
  pages: number;
  requests: number;
  pacingWaitMs: number;
  retries: number;
  retryWaitMs: number;
  stations: number;
  outcome: 'ok' | 'empty' | 'stale' | 'error';
  /** A fixed category, never a message or URL. */
  errorKind?: string;
}

export interface RainClient {
  /**
   * Each station's rainfall for the latest 15 minutes. Throws WeatherProviderError on failure.
   * A client may fill `timing` with what the call cost; the route reports it.
   */
  getRecentRain(now?: Date, timing?: Partial<RainTiming>): Promise<IslandRainObservation>;
}

interface RawStation {
  id?: unknown;
  name?: unknown;
  location?: { latitude?: unknown; longitude?: unknown } | null;
}

interface RawReading {
  timestamp?: unknown;
  data?: { stationId?: unknown; value?: unknown }[] | null;
}

export interface RainPayload {
  code?: number;
  errorMsg?: string;
  data?: { stations?: RawStation[]; readings?: RawReading[]; paginationToken?: string | null };
}

export const RAIN_WINDOW_MINUTES = 15;
const PERIOD_MS = 5 * 60_000;
const PERIODS = 3;
const FRESH_MS = 120_000;
const SGT_OFFSET_MS = 8 * 3_600_000;
/**
 * The newest five-minute period fills in over several minutes (3 of 87 stations at 08:25 for the
 * 08:20 period, research Gate 1), so a period counts once it holds most of the stations.
 */
const USABLE_SHARE = 0.8;
/** The provider's REAL_TIME_API_DATA_NOT_FOUND code. */
const NOT_FOUND_CODE = 17;

function parseCoordinate(value: unknown, limit: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : null;
}

function parseValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** `ms` as the provider writes SGT times, e.g. 2026-11-17T08:00:00+08:00. */
function sgtIso(ms: number): string {
  return `${new Date(ms + SGT_OFFSET_MS).toISOString().slice(0, 19)}+08:00`;
}

function singaporeDate(ms: number): string {
  return new Date(ms + SGT_OFFSET_MS).toISOString().slice(0, 10);
}

interface Period {
  ms: number;
  timestamp: string;
  values: Map<string, number>;
  rows: number;
}

/** Every reading across `payloads`, one per timestamp, newest first. */
function periodsOf(payloads: RainPayload[]): Period[] {
  const byMs = new Map<number, Period>();
  for (const payload of payloads) {
    for (const reading of payload.data?.readings ?? []) {
      const timestamp = typeof reading?.timestamp === 'string' ? reading.timestamp : '';
      const ms = Date.parse(timestamp);
      if (!Number.isFinite(ms) || byMs.has(ms)) continue;
      const rows = Array.isArray(reading.data) ? reading.data : [];
      const values = new Map<string, number>();
      for (const row of rows) {
        const value = parseValue(row?.value);
        if (typeof row?.stationId === 'string' && value !== null) values.set(row.stationId, value);
      }
      byMs.set(ms, { ms, timestamp, values, rows: rows.length });
    }
  }
  return [...byMs.values()].sort((a, b) => b.ms - a.ms);
}

/**
 * Builds the island rain snapshot from one or more `rainfall?date=` pages (today first, then the
 * previous date after midnight). Anchors on the newest period holding at least 80% of the largest
 * row count, and sums the three five-minute periods ending there. Null when no period is usable.
 */
export function buildRainObservation(
  payloads: RainPayload[],
  now: Date = new Date(),
): IslandRainObservation | null {
  const periods = periodsOf(payloads);
  const largest = Math.max(0, ...periods.map((period) => period.rows));
  const anchor = periods.find((period) => period.rows > 0 && period.rows >= largest * USABLE_SHARE);
  if (!anchor) return null;

  const windowPeriods = Array.from({ length: PERIODS }, (_, index) =>
    periods.find((period) => period.ms === anchor.ms - index * PERIOD_MS),
  ).filter((period): period is Period => period !== undefined);

  const seen = new Set<string>();
  const stations: RainStationReading[] = [];
  for (const payload of payloads) {
    for (const raw of payload.data?.stations ?? []) {
      if (typeof raw?.id !== 'string' || !raw.id || seen.has(raw.id)) continue;
      const latitude = parseCoordinate(raw.location?.latitude, 90);
      const longitude = parseCoordinate(raw.location?.longitude, 180);
      if (latitude === null || longitude === null) continue;
      seen.add(raw.id);

      let total = 0;
      let covered = 0;
      for (const period of windowPeriods) {
        const value = period.values.get(raw.id);
        if (value === undefined) continue;
        total += value;
        covered += 1;
      }
      stations.push({
        id: raw.id,
        name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : raw.id,
        latitude,
        longitude,
        total_mm: covered > 0 ? Math.round(total * 10) / 10 : null,
        periods_covered: covered as RainStationReading['periods_covered'],
      });
    }
  }
  stations.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return {
    stations,
    window_minutes: RAIN_WINDOW_MINUTES,
    window_end: anchor.timestamp,
    window_start: sgtIso(anchor.ms - RAIN_WINDOW_MINUTES * 60_000),
    periods_found: windowPeriods.length,
    fetched_at: now.toISOString(),
    stale: false,
  };
}

/** A fixed category for an error: provider messages and URLs never reach logs or headers. */
function errorKind(error: unknown): string {
  if (!(error instanceof WeatherProviderError)) return 'unexpected';
  const message = error.message;
  if (/rate limit/i.test(message)) return 'rate_limited';
  if (/rejected/i.test(message)) return 'rejected';
  if (/Unable to reach/i.test(message)) return 'unreachable';
  if (/no usable/i.test(message)) return 'bad_response';
  const status = /HTTP (\d{3})/.exec(message);
  if (status) return `status_${status[1]}`;
  return 'provider_error';
}

function outcomeOf(observation: IslandRainObservation): RainTiming['outcome'] {
  if (observation.stale) return 'stale';
  return observation.stations.some((entry) => (entry.total_mm ?? 0) > 0) ? 'ok' : 'empty';
}

export interface SingaporeRainClientOptions {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  userAgent?: string;
  fetchImpl?: typeof fetch;
  /** Shared requester, so all provider calls in the process are paced together. */
  requester?: ProviderRequester;
  requestIntervalMs?: number;
  rateLimitRetryDelayMs?: number;
}

/**
 * Reads data.gov.sg's rainfall dataset. One snapshot is cached in memory for 2 minutes and shared
 * by all callers, so repeated user actions never multiply upstream requests (constitution I).
 */
export class SingaporeRainClient implements RainClient {
  private readonly requester: ProviderRequester;
  private cached: { observation: IslandRainObservation; fetchedAtMs: number } | null = null;
  private inFlight: Promise<IslandRainObservation> | null = null;
  /**
   * The last failed attempt. For 2 minutes after it no upstream call is made either, so an outage
   * or a 429 can't turn repeated presses (or a cross-site page) into repeated provider calls.
   */
  private lastFailure: { atMs: number; error: WeatherProviderError } | null = null;

  constructor(private readonly options: SingaporeRainClientOptions = {}) {
    this.requester = options.requester ?? new ProviderRequester(options);
  }

  async getRecentRain(
    now: Date = new Date(),
    timing: Partial<RainTiming> = {},
  ): Promise<IslandRainObservation> {
    const startedAt = performance.now();
    const noRequests = { providerMs: 0, pages: 0, ...createRequestStats() };

    if (this.cached && now.getTime() - this.cached.fetchedAtMs < FRESH_MS) {
      const observation = this.cached.observation;
      this.report(timing, startedAt, { served: 'cache', ...noRequests }, observation);
      return observation;
    }
    if (this.lastFailure && now.getTime() - this.lastFailure.atMs < FRESH_MS) {
      const { error } = this.lastFailure;
      if (this.cached) {
        const stale = { ...this.cached.observation, stale: true };
        this.report(timing, startedAt, { served: 'cache', ...noRequests }, stale, error);
        return stale;
      }
      this.report(timing, startedAt, { served: 'cache', ...noRequests }, null, error);
      throw error;
    }
    if (this.inFlight) {
      try {
        const observation = await this.inFlight;
        this.report(timing, startedAt, { served: 'shared', ...noRequests }, observation);
        return observation;
      } catch (error) {
        this.report(timing, startedAt, { served: 'shared', ...noRequests }, null, error);
        throw error;
      }
    }

    this.inFlight = this.load(now, timing, startedAt).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /** Completes `timing` and logs it once per call. */
  private report(
    timing: Partial<RainTiming>,
    startedAt: number,
    cost: Pick<RainTiming, 'served' | 'providerMs' | 'pages'> & RequestStats,
    observation: IslandRainObservation | null,
    error?: unknown,
  ): void {
    Object.assign(timing, cost, {
      totalMs: Math.round(performance.now() - startedAt),
      providerMs: Math.round(cost.providerMs),
      stations: observation?.stations.length ?? 0,
      outcome: observation ? outcomeOf(observation) : 'error',
    });
    if (error !== undefined) timing.errorKind = errorKind(error);
    logger.info({ ...timing }, 'rain refresh timing');
  }

  private async load(
    now: Date,
    timing: Partial<RainTiming>,
    startedAt: number,
  ): Promise<IslandRainObservation> {
    const stats = createRequestStats();
    const progress = { pages: 0 };
    const providerStartedAt = performance.now();
    const cost = () => ({
      served: 'fetch' as const,
      providerMs: performance.now() - providerStartedAt,
      pages: progress.pages,
      ...stats,
    });
    try {
      const observation = await this.fetchObservation(now, stats, progress);
      this.cached = { observation, fetchedAtMs: now.getTime() };
      this.lastFailure = null;
      this.report(timing, startedAt, cost(), observation);
      return observation;
    } catch (error) {
      logger.warn({ err: error }, 'rain data source unavailable');
      this.lastFailure = {
        atMs: now.getTime(),
        error:
          error instanceof WeatherProviderError
            ? error
            : new WeatherProviderError('Unable to read rain data'),
      };
      if (this.cached) {
        // Earlier readings stay usable; the frontend marks them out of date (spec US5).
        const stale = { ...this.cached.observation, stale: true };
        this.report(timing, startedAt, cost(), stale, error);
        return stale;
      }
      const failure =
        error instanceof WeatherProviderError
          ? error
          : new WeatherProviderError('Unable to read rain data');
      this.report(timing, startedAt, cost(), null, failure);
      throw failure;
    }
  }

  /** Today's first page; the previous SGT date's first page too when the window reaches it. */
  private async fetchObservation(
    now: Date,
    stats: RequestStats,
    progress: { pages: number },
  ): Promise<IslandRainObservation> {
    const today = singaporeDate(now.getTime());
    progress.pages += 1;
    const payloads = [await this.fetchPage(today, stats, { notFoundIsEmpty: true })];
    let observation = buildRainObservation(payloads, now);

    const windowStartMs = observation?.window_start ? Date.parse(observation.window_start) : null;
    // The oldest window period ends 10 minutes before the anchor; it is on the previous date when
    // that moment falls before midnight (or when today has no usable reading yet).
    const oldestPeriodMs = windowStartMs === null ? null : windowStartMs + PERIOD_MS;
    if (oldestPeriodMs === null || singaporeDate(oldestPeriodMs) !== today) {
      const previous = singaporeDate(Date.parse(`${today}T00:00:00+08:00`) - 1);
      progress.pages += 1;
      payloads.push(await this.fetchPage(previous, stats));
      observation = buildRainObservation(payloads, now);
    }

    if (!observation || observation.stations.every((entry) => entry.periods_covered === 0)) {
      throw new WeatherProviderError('Rain response has no usable readings');
    }
    return observation;
  }

  /**
   * One `rainfall?date=` page. With `notFoundIsEmpty`, "no data for this date" (HTTP 404, or the
   * provider's code 17) reads as no readings, which happens just after midnight.
   */
  private async fetchPage(
    date: string,
    stats: RequestStats,
    { notFoundIsEmpty = false } = {},
  ): Promise<RainPayload> {
    const base = this.options.baseUrl ?? 'https://api-open.data.gov.sg';
    let payload: RainPayload;
    try {
      payload = await this.requester.getJson<RainPayload>(
        `${base}/v2/real-time/api/rainfall?date=${date}`,
        stats,
      );
    } catch (error) {
      if (
        notFoundIsEmpty &&
        error instanceof WeatherProviderError &&
        /HTTP 404/.test(error.message)
      ) {
        return {};
      }
      throw error;
    }
    if (notFoundIsEmpty && payload.code === NOT_FOUND_CODE) return {};
    if (payload.code !== undefined && payload.code !== 0) {
      throw new WeatherProviderError(payload.errorMsg ?? 'Rain provider returned an error');
    }
    return payload;
  }
}
