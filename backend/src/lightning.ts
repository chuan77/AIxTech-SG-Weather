import { logger } from './logger.js';
import { ProviderRequester, WeatherProviderError } from './providerHttp.js';

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

export interface LightningClient {
  /** Strikes from the 60 minutes before `now`, newest first. Throws WeatherProviderError on failure. */
  getRecentLightning(now?: Date): Promise<LightningObservation>;
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

function singaporeDate(ms: number): string {
  return new Date(ms + SGT_OFFSET_MS).toISOString().slice(0, 10);
}

function trimObservation(observation: LightningObservation, now: Date): LightningObservation {
  const nowMs = now.getTime();
  return {
    ...observation,
    strikes: observation.strikes.filter((strike) => isInWindow(Date.parse(strike.occurred_at), nowMs)),
  };
}

export interface SingaporeLightningClientOptions {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  userAgent?: string;
  fetchImpl?: typeof fetch;
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
    this.requester = new ProviderRequester(options);
  }

  async getRecentLightning(now: Date = new Date()): Promise<LightningObservation> {
    if (this.cached && now.getTime() - this.cached.fetchedAtMs < FRESH_MS) {
      return trimObservation(this.cached.observation, now);
    }
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.load(now).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async load(now: Date): Promise<LightningObservation> {
    try {
      const { records, providerUpdatedAt } = await this.fetchRecords(now);
      const observation: LightningObservation = {
        strikes: normaliseStrikes(records, now),
        window_minutes: LIGHTNING_WINDOW_MINUTES,
        fetched_at: now.toISOString(),
        provider_updated_at: providerUpdatedAt,
        stale: false,
      };
      this.cached = { observation, fetchedAtMs: now.getTime() };
      return observation;
    } catch (error) {
      logger.warn({ err: error }, 'lightning data source unavailable');
      if (this.cached) return { ...trimObservation(this.cached.observation, now), stale: true };
      throw error instanceof WeatherProviderError
        ? error
        : new WeatherProviderError('Unable to read lightning data');
    }
  }

  /** Newest first. Walks today's pages, then the previous SGT date once if the window reaches it. */
  private async fetchRecords(
    now: Date,
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
        const payload = await this.fetchPage(date, token);
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

  private async fetchPage(date: string, token: string | null): Promise<LightningPayload> {
    const base = this.options.baseUrl ?? 'https://api-open.data.gov.sg';
    const tokenQuery = token ? `&paginationToken=${encodeURIComponent(token)}` : '';
    const payload = await this.requester.getJson<LightningPayload>(
      `${base}/v2/real-time/api/weather?api=lightning&date=${date}${tokenQuery}`,
    );
    if (payload.code !== undefined && payload.code !== 0) {
      throw new WeatherProviderError(payload.errorMsg ?? 'Lightning provider returned an error');
    }
    return payload;
  }
}
