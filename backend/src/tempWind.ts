import { logger } from './logger.js';
import {
  createRequestStats,
  ProviderRequester,
  WeatherProviderError,
  type RequestStats,
} from './providerHttp.js';

/** One station's latest air temperature and wind (spec 015, data-model.md). */
export interface TempWindStation {
  id: string;
  /** null when the provider gives no name or only the id (S199). */
  name: string | null;
  latitude: number;
  longitude: number;
  /** 10–45 °C, rounded to 0.1. */
  temperature_c: number | null;
  /** 0–150 knots. */
  wind_speed_knots: number | null;
  /** 0 to under 360, the direction the wind comes FROM (360 becomes 0). */
  wind_direction_deg: number | null;
}

export type MeasureStatus = 'ok' | 'unavailable';

/** One shared, short-lived set of station readings for the whole island. Never stored in SQLite. */
export interface IslandConditionsObservation {
  stations: TempWindStation[];
  measures: { temperature: MeasureStatus; wind: MeasureStatus };
  temperature_at: string | null;
  /** The older of the speed and direction readings' times. */
  wind_at: string | null;
  fetched_at: string;
  stale: boolean;
}

/** Where one refresh spent its time (diagnostics only, like `RainTiming`). */
export interface TempWindTiming {
  served: 'cache' | 'shared' | 'fetch';
  totalMs: number;
  providerMs: number;
  requests: number;
  pacingWaitMs: number;
  retries: number;
  retryWaitMs: number;
  stations: number;
  /** `partial` when one measure loaded and the other did not. */
  outcome: 'ok' | 'partial' | 'stale' | 'error';
  /** A fixed category, never a message or URL. */
  errorKind?: string;
}

export interface TempWindClient {
  /**
   * The latest temperature and wind at every station. Throws WeatherProviderError when nothing
   * usable loaded and there is no earlier observation. A client may fill `timing`.
   */
  getIslandConditions(
    now?: Date,
    timing?: Partial<TempWindTiming>,
  ): Promise<IslandConditionsObservation>;
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

/** A `v2/real-time/api/{air-temperature,wind-speed,wind-direction}` response. */
export interface MeasurePayload {
  code?: number;
  errorMsg?: string;
  data?: {
    stations?: RawStation[];
    readings?: RawReading[];
    readingType?: string;
    readingUnit?: string;
  };
}

const FRESH_MS = 120_000;
const ENDPOINTS = {
  temperature: 'air-temperature',
  speed: 'wind-speed',
  direction: 'wind-direction',
} as const;
type MeasureKey = keyof typeof ENDPOINTS;

/** Plausible ranges (research R5): anything outside reads as "no reading". */
const RANGES: Record<MeasureKey, { min: number; max: number }> = {
  temperature: { min: 10, max: 45 },
  speed: { min: 0, max: 150 },
  direction: { min: 0, max: 360 },
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCoordinate(value: unknown, limit: number): number | null {
  const parsed = toNumber(value);
  return parsed !== null && Math.abs(parsed) <= limit ? parsed : null;
}

function parseValue(key: MeasureKey, value: unknown): number | null {
  const parsed = toNumber(value);
  if (parsed === null) return null;
  const { min, max } = RANGES[key];
  if (parsed < min || parsed > max) return null;
  if (key === 'temperature') return Math.round(parsed * 10) / 10;
  if (key === 'direction') return parsed === 360 ? 0 : parsed;
  return parsed;
}

function stationName(id: string, name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  return trimmed && trimmed !== id ? trimmed : null;
}

interface LatestReading {
  timestamp: string;
  ms: number;
  values: Map<string, number>;
}

/** The newest reading in a response, or null when it has none with a valid timestamp. */
function latestReading(key: MeasureKey, payload: MeasurePayload): LatestReading | null {
  let newest: LatestReading | null = null;
  for (const reading of payload.data?.readings ?? []) {
    const timestamp = typeof reading?.timestamp === 'string' ? reading.timestamp : '';
    const ms = Date.parse(timestamp);
    if (!Number.isFinite(ms) || (newest && newest.ms >= ms)) continue;
    const values = new Map<string, number>();
    for (const row of Array.isArray(reading.data) ? reading.data : []) {
      const value = parseValue(key, row?.value);
      if (typeof row?.stationId === 'string' && value !== null) values.set(row.stationId, value);
    }
    newest = { timestamp, ms, values };
  }
  return newest;
}

/**
 * Joins the three latest-reading responses by station id (research R2). A null payload means that
 * request failed. Temperature and wind succeed or fail on their own; wind needs both the speed and
 * the direction response. A failed measure is left null at every station, never filled from older
 * data. Null when no measure loaded or no station has any value.
 */
export function buildTempWindObservation(
  payloads: Record<MeasureKey, MeasurePayload | null>,
  now: Date = new Date(),
): IslandConditionsObservation | null {
  const latest = (key: MeasureKey) => {
    const payload = payloads[key];
    return payload ? latestReading(key, payload) : null;
  };
  const temperature = latest('temperature');
  const speed = latest('speed');
  const direction = latest('direction');
  const windOk = speed !== null && direction !== null;
  if (!temperature && !windOk) return null;

  const loaded: MeasureKey[] = [
    ...(temperature ? (['temperature'] as const) : []),
    ...(windOk ? (['speed', 'direction'] as const) : []),
  ];

  const byId = new Map<string, TempWindStation>();
  for (const key of loaded) {
    for (const raw of payloads[key]?.data?.stations ?? []) {
      if (typeof raw?.id !== 'string' || !raw.id) continue;
      const existing = byId.get(raw.id);
      if (existing) {
        existing.name ??= stationName(raw.id, raw.name);
        continue;
      }
      const latitude = parseCoordinate(raw.location?.latitude, 90);
      const longitude = parseCoordinate(raw.location?.longitude, 180);
      if (latitude === null || longitude === null) continue;
      byId.set(raw.id, {
        id: raw.id,
        name: stationName(raw.id, raw.name),
        latitude,
        longitude,
        temperature_c: temperature?.values.get(raw.id) ?? null,
        wind_speed_knots: windOk ? (speed.values.get(raw.id) ?? null) : null,
        wind_direction_deg: windOk ? (direction.values.get(raw.id) ?? null) : null,
      });
    }
  }

  const stations = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const hasValue = stations.some(
    (entry) =>
      entry.temperature_c !== null ||
      entry.wind_speed_knots !== null ||
      entry.wind_direction_deg !== null,
  );
  if (!hasValue) return null;

  return {
    stations,
    measures: {
      temperature: temperature ? 'ok' : 'unavailable',
      wind: windOk ? 'ok' : 'unavailable',
    },
    temperature_at: temperature?.timestamp ?? null,
    wind_at: windOk ? (speed.ms <= direction.ms ? speed.timestamp : direction.timestamp) : null,
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

function outcomeOf(observation: IslandConditionsObservation): TempWindTiming['outcome'] {
  if (observation.stale) return 'stale';
  const { temperature, wind } = observation.measures;
  return temperature === 'ok' && wind === 'ok' ? 'ok' : 'partial';
}

export interface SingaporeTempWindClientOptions {
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
 * Reads data.gov.sg's air temperature, wind speed and wind direction datasets. One observation is
 * cached in memory for 2 minutes and shared by all callers, so repeated user actions never
 * multiply upstream requests (constitution I, 1.6.0).
 */
export class SingaporeTempWindClient implements TempWindClient {
  private readonly requester: ProviderRequester;
  private cached: { observation: IslandConditionsObservation; fetchedAtMs: number } | null = null;
  private inFlight: Promise<IslandConditionsObservation> | null = null;
  /** The last total failure: for 2 minutes after it no upstream call is made either. */
  private lastFailure: { atMs: number; error: WeatherProviderError } | null = null;

  constructor(private readonly options: SingaporeTempWindClientOptions = {}) {
    this.requester = options.requester ?? new ProviderRequester(options);
  }

  async getIslandConditions(
    now: Date = new Date(),
    timing: Partial<TempWindTiming> = {},
  ): Promise<IslandConditionsObservation> {
    const startedAt = performance.now();
    const noRequests = { providerMs: 0, ...createRequestStats() };

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
    timing: Partial<TempWindTiming>,
    startedAt: number,
    cost: Pick<TempWindTiming, 'served' | 'providerMs'> & RequestStats,
    observation: IslandConditionsObservation | null,
    error?: unknown,
  ): void {
    Object.assign(timing, cost, {
      totalMs: Math.round(performance.now() - startedAt),
      providerMs: Math.round(cost.providerMs),
      stations: observation?.stations.length ?? 0,
      outcome: observation ? outcomeOf(observation) : 'error',
    });
    if (error !== undefined) timing.errorKind = errorKind(error);
    logger.info({ ...timing }, 'temp-wind refresh timing');
  }

  private async load(
    now: Date,
    timing: Partial<TempWindTiming>,
    startedAt: number,
  ): Promise<IslandConditionsObservation> {
    const stats = createRequestStats();
    const providerStartedAt = performance.now();
    const cost = () => ({
      served: 'fetch' as const,
      providerMs: performance.now() - providerStartedAt,
      ...stats,
    });
    try {
      const observation = await this.fetchObservation(now, stats);
      this.cached = { observation, fetchedAtMs: now.getTime() };
      this.lastFailure = null;
      this.report(timing, startedAt, cost(), observation);
      return observation;
    } catch (error) {
      logger.warn({ err: error }, 'temperature and wind data source unavailable');
      const failure =
        error instanceof WeatherProviderError
          ? error
          : new WeatherProviderError('Unable to read temperature and wind data');
      this.lastFailure = { atMs: now.getTime(), error: failure };
      if (this.cached) {
        // Earlier readings stay usable; the frontend marks them out of date (spec US5).
        const stale = { ...this.cached.observation, stale: true };
        this.report(timing, startedAt, cost(), stale, failure);
        return stale;
      }
      this.report(timing, startedAt, cost(), null, failure);
      throw failure;
    }
  }

  /** Starts the three requests together so they queue back to back in the shared requester. */
  private async fetchObservation(
    now: Date,
    stats: RequestStats,
  ): Promise<IslandConditionsObservation> {
    const keys = Object.keys(ENDPOINTS) as MeasureKey[];
    // Each request gets its own stats: the three wait at the same time, so summing their waits
    // would report more waiting than the whole refresh took.
    const perRequest = keys.map(() => createRequestStats());
    const results = await Promise.allSettled(
      keys.map((key, index) => this.fetchMeasure(key, perRequest[index])),
    );
    for (const entry of perRequest) {
      stats.requests += entry.requests;
      stats.retries += entry.retries;
      stats.pacingWaitMs = Math.max(stats.pacingWaitMs, entry.pacingWaitMs);
      stats.retryWaitMs = Math.max(stats.retryWaitMs, entry.retryWaitMs);
    }
    const payloads = Object.fromEntries(
      keys.map((key, index) => {
        const result = results[index];
        return [key, result.status === 'fulfilled' ? result.value : null];
      }),
    ) as Record<MeasureKey, MeasurePayload | null>;

    const observation = buildTempWindObservation(payloads, now);
    if (observation) return observation;
    // Report the first request's own failure (e.g. a 429) when every request failed.
    const rejected = results.find((result) => result.status === 'rejected');
    if (
      rejected?.status === 'rejected' &&
      results.every((result) => result.status === 'rejected')
    ) {
      throw rejected.reason;
    }
    throw new WeatherProviderError('Temperature and wind response has no usable readings');
  }

  private async fetchMeasure(key: MeasureKey, stats: RequestStats): Promise<MeasurePayload> {
    const base = this.options.baseUrl ?? 'https://api-open.data.gov.sg';
    const payload = await this.requester.getJson<MeasurePayload>(
      `${base}/v2/real-time/api/${ENDPOINTS[key]}`,
      stats,
      // Three calls: don't wait behind a location refresh's dozen (research R6, as rain does).
      'high',
    );
    if (payload.code !== undefined && payload.code !== 0) {
      throw new WeatherProviderError(
        payload.errorMsg ?? 'Temperature and wind provider returned an error',
      );
    }
    return payload;
  }
}
