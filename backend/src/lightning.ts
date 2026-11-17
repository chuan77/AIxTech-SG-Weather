import { logger } from './logger.js';
import {
  createRequestStats,
  ProviderRequester,
  WeatherProviderError,
  type RequestStats,
} from './providerHttp.js';

export interface LightningStrike {
  id: string;
  latitude: number;
  longitude: number;
  occurred_at: string;
  type: string;
  label: string;
}

export interface LightningObservation {
  strikes: LightningStrike[];
  window_minutes: 60;
  fetched_at: string;
  provider_updated_at: string | null;
  stale: boolean;
}

/**
 * Where one lightning refresh spent its time (diagnostics only: logged and sent as Server-Timing,
 * never shown in the dashboard). Numbers and fixed enums only, so nothing secret can leak.
 */
export interface LightningTiming {
  /** cache: under 2 min old; shared: joined a load already in flight; fetch: fetched now. */
  served: 'cache' | 'shared' | 'fetch';
  totalMs: number;
  /** Wall time inside provider page fetches (0 unless `fetch`). */
  providerMs: number;
  pages: number;
  requests: number;
  pacingWaitMs: number;
  retries: number;
  retryWaitMs: number;
  strikes: number;
  /** stale: a previous window was served after a failure. */
  outcome: 'ok' | 'empty' | 'stale' | 'error';
  /** A fixed category, never a message or URL. */
  errorKind?: string;
}

export interface LightningClient {
  /**
   * Strikes from the 60 minutes before `now`, newest first. Throws WeatherProviderError on failure.
   * A client may fill `timing` with what the call cost; the route reports it.
   */
  getRecentLightning(now?: Date, timing?: Partial<LightningTiming>): Promise<LightningObservation>;
}

export const LIGHTNING_WINDOW_MINUTES = 60;
const WINDOW_MS = LIGHTNING_WINDOW_MINUTES * 60_000;
const FUTURE_TOLERANCE_MS = 5 * 60_000;
const FRESH_MS = 120_000;
const SGT_OFFSET_MS = 8 * 3_600_000;
const MAX_PAGES_TODAY = 3;

// Valid WGS84 ranges only. The provider reports strikes across the wider region (Johor, Riau
// islands, the Strait), not just the island, and those are shown too (verified 2026-11-12).
const LATITUDE_RANGE = [-90, 90] as const;
const LONGITUDE_RANGE = [-180, 180] as const;

interface RawReading {
  location?: { latitude?: unknown; longitude?: unknown };
  type?: unknown;
  text?: unknown;
  datetime?: unknown;
}

export interface LightningRecord {
  datetime?: string;
  updatedTimestamp?: string;
  item?: { readings?: RawReading[] | null } | null;
}

interface LightningPayload {
  code?: number;
  errorMsg?: string;
  data?: { records?: LightningRecord[]; paginationToken?: string | null };
}

function parseCoordinate(value: unknown, [min, max]: readonly [number, number]): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function isInWindow(occurredAtMs: number, nowMs: number): boolean {
  return occurredAtMs >= nowMs - WINDOW_MS && occurredAtMs <= nowMs + FUTURE_TOLERANCE_MS;
}

/** Keeps valid strikes from the last 60 minutes, de-duplicated and newest first. */
export function normaliseStrikes(records: LightningRecord[], now: Date): LightningStrike[] {
  const nowMs = now.getTime();
  const byId = new Map<string, LightningStrike>();
  let skipped = 0;

  for (const record of records) {
    for (const reading of record.item?.readings ?? []) {
      const latitude = parseCoordinate(reading?.location?.latitude, LATITUDE_RANGE);
      const longitude = parseCoordinate(reading?.location?.longitude, LONGITUDE_RANGE);
      const datetime = typeof reading?.datetime === 'string' ? reading.datetime : record.datetime;
      const occurredAtMs = datetime ? Date.parse(datetime) : Number.NaN;

      if (
        latitude === null ||
        longitude === null ||
        !datetime ||
        !Number.isFinite(occurredAtMs) ||
        !isInWindow(occurredAtMs, nowMs)
      ) {
        skipped += 1;
        continue;
      }

      const id = `${datetime}|${latitude}|${longitude}`;
      if (byId.has(id)) continue;
      byId.set(id, {
        id,
        latitude,
        longitude,
        occurred_at: datetime,
        type: typeof reading.type === 'string' && reading.type ? reading.type : 'unknown',
        label: typeof reading.text === 'string' && reading.text.trim() ? reading.text : 'Lightning',
      });
    }
  }

  if (skipped > 0) logger.debug({ skipped }, 'skipped unusable or out-of-window lightning strikes');
  return [...byId.values()].sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
}

/** A fixed category for an error: provider messages and URLs never reach logs or headers. */
function errorKind(error: unknown): string {
  if (!(error instanceof WeatherProviderError)) return 'unexpected';
  const message = error.message;
  if (/rate limit/i.test(message)) return 'rate_limited';
  if (/rejected/i.test(message)) return 'rejected';
  if (/Unable to reach/i.test(message)) return 'unreachable';
  if (/no records/i.test(message)) return 'bad_response';
  const status = /HTTP (\d{3})/.exec(message);
  if (status) return `status_${status[1]}`;
  return 'provider_error';
}

function outcomeOf(observation: LightningObservation): LightningTiming['outcome'] {
  if (observation.stale) return 'stale';
  return observation.strikes.length > 0 ? 'ok' : 'empty';
}

function singaporeDate(ms: number): string {
  return new Date(ms + SGT_OFFSET_MS).toISOString().slice(0, 10);
}

function trimObservation(observation: LightningObservation, now: Date): LightningObservation {
  const nowMs = now.getTime();
  return {
    ...observation,
    strikes: observation.strikes.filter((strike) =>
      isInWindow(Date.parse(strike.occurred_at), nowMs),
    ),
  };
}

export interface SingaporeLightningClientOptions {
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
 * Reads data.gov.sg's lightning dataset. One window is cached in memory for 2 minutes and shared
 * by all callers, so repeated user actions never multiply upstream requests.
 */
export class SingaporeLightningClient implements LightningClient {
  private readonly requester: ProviderRequester;
  private cached: { observation: LightningObservation; fetchedAtMs: number } | null = null;
  private inFlight: Promise<LightningObservation> | null = null;

  constructor(private readonly options: SingaporeLightningClientOptions = {}) {
    this.requester = options.requester ?? new ProviderRequester(options);
  }

  async getRecentLightning(
    now: Date = new Date(),
    timing: Partial<LightningTiming> = {},
  ): Promise<LightningObservation> {
    const startedAt = performance.now();
    const noRequests = { providerMs: 0, pages: 0, ...createRequestStats() };

    if (this.cached && now.getTime() - this.cached.fetchedAtMs < FRESH_MS) {
      const observation = trimObservation(this.cached.observation, now);
      this.report(timing, startedAt, { served: 'cache', ...noRequests }, observation);
      return observation;
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
    timing: Partial<LightningTiming>,
    startedAt: number,
    cost: Pick<LightningTiming, 'served' | 'providerMs' | 'pages'> & RequestStats,
    observation: LightningObservation | null,
    error?: unknown,
  ): void {
    Object.assign(timing, cost, {
      totalMs: Math.round(performance.now() - startedAt),
      providerMs: Math.round(cost.providerMs),
      strikes: observation?.strikes.length ?? 0,
      outcome: observation ? outcomeOf(observation) : 'error',
    });
    if (error !== undefined) timing.errorKind = errorKind(error);
    logger.info({ ...timing }, 'lightning refresh timing');
  }

  private async load(
    now: Date,
    timing: Partial<LightningTiming>,
    startedAt: number,
  ): Promise<LightningObservation> {
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
      const { records, providerUpdatedAt } = await this.fetchRecords(now, stats, progress);
      const observation: LightningObservation = {
        strikes: normaliseStrikes(records, now),
        window_minutes: LIGHTNING_WINDOW_MINUTES,
        fetched_at: now.toISOString(),
        provider_updated_at: providerUpdatedAt,
        stale: false,
      };
      this.cached = { observation, fetchedAtMs: now.getTime() };
      this.report(timing, startedAt, cost(), observation);
      return observation;
    } catch (error) {
      logger.warn({ err: error }, 'lightning data source unavailable');
      if (this.cached) {
        const stale = { ...trimObservation(this.cached.observation, now), stale: true };
        this.report(timing, startedAt, cost(), stale, error);
        return stale;
      }
      const failure =
        error instanceof WeatherProviderError
          ? error
          : new WeatherProviderError('Unable to read lightning data');
      this.report(timing, startedAt, cost(), null, failure);
      throw failure;
    }
  }

  /** Newest first. Walks today's pages, then the previous SGT date once if the window reaches it. */
  private async fetchRecords(
    now: Date,
    stats: RequestStats,
    progress: { pages: number },
  ): Promise<{ records: LightningRecord[]; providerUpdatedAt: string | null }> {
    const cutoffMs = now.getTime() - WINDOW_MS;
    const today = singaporeDate(now.getTime());
    const cutoffDate = singaporeDate(cutoffMs);
    const dates = cutoffDate === today ? [today] : [today, cutoffDate];

    const records: LightningRecord[] = [];
    let providerUpdatedAt: string | null = null;

    for (const [index, date] of dates.entries()) {
      const maxPages = index === 0 ? MAX_PAGES_TODAY : 1;
      let token: string | null = null;

      for (let page = 0; page < maxPages; page += 1) {
        progress.pages += 1;
        const payload = await this.fetchPage(date, token, stats);
        const pageRecords = payload.data?.records;
        if (!Array.isArray(pageRecords)) {
          throw new WeatherProviderError('Lightning response has no records');
        }
        records.push(...pageRecords);
        providerUpdatedAt ??= pageRecords[0]?.updatedTimestamp ?? null;

        const oldestMs = Math.min(
          ...pageRecords.map((record) => Date.parse(record.datetime ?? '')).filter(Number.isFinite),
        );
        if (oldestMs < cutoffMs) return { records, providerUpdatedAt };

        token = payload.data?.paginationToken ?? null;
        if (!token) break;
      }
    }

    return { records, providerUpdatedAt };
  }

  private async fetchPage(
    date: string,
    token: string | null,
    stats: RequestStats,
  ): Promise<LightningPayload> {
    const base = this.options.baseUrl ?? 'https://api-open.data.gov.sg';
    const tokenQuery = token ? `&paginationToken=${encodeURIComponent(token)}` : '';
    const payload = await this.requester.getJson<LightningPayload>(
      `${base}/v2/real-time/api/weather?api=lightning&date=${date}${tokenQuery}`,
      stats,
      // A few pages at most: don't wait behind a location refresh's dozen (spec 011, T057).
      'high',
    );
    if (payload.code !== undefined && payload.code !== 0) {
      throw new WeatherProviderError(payload.errorMsg ?? 'Lightning provider returned an error');
    }
    return payload;
  }
}
