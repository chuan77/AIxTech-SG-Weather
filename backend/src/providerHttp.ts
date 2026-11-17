export class WeatherProviderError extends Error {}

/** The provider's 429 body says "try again in 10 seconds". */
export const RATE_LIMIT_RETRY_DELAY_MS = 10_000;

/**
 * Spacing that keeps every 10 s window within the key's request limit: 12 with a key
 * (Development tier), 6 without, or `WEATHER_API_RATE_LIMIT` for another tier. 50 ms margin.
 */
export function defaultRequestIntervalMs(apiKey?: string): number {
  const configured = Number(process.env.WEATHER_API_RATE_LIMIT);
  const limit = Number.isFinite(configured) && configured > 0 ? configured : apiKey ? 12 : 6;
  return Math.ceil(10_000 / limit) + 50;
}

/** What one or more getJson calls cost: pass the same object to several calls to sum them. */
export interface RequestStats {
  /** HTTP attempts actually sent (a 429 retry counts as 2). */
  requests: number;
  /** Time spent waiting for a pacing slot. */
  pacingWaitMs: number;
  /** 429 retries taken. */
  retries: number;
  /** Time spent in the retry delay. */
  retryWaitMs: number;
}

export function createRequestStats(): RequestStats {
  return { requests: 0, pacingWaitMs: 0, retries: 0, retryWaitMs: 0 };
}

/**
 * `high` takes the next free slot ahead of queued `normal` calls. Island layers (rain, lightning)
 * use it: they make one or two calls, so they shouldn't wait ~10 s behind a location refresh's
 * dozen (spec 011, T057). The spacing between any two calls is unchanged.
 */
export type RequestPriority = 'high' | 'normal';

export interface ProviderRequesterOptions {
  apiKey?: string;
  timeoutMs?: number;
  userAgent?: string;
  /** Replaces the global `fetch`; used by tests. Read at call time so stubbed globals work. */
  fetchImpl?: typeof fetch;
  /** Minimum gap between request starts; defaults to `defaultRequestIntervalMs(apiKey)`. */
  requestIntervalMs?: number;
  /** Wait before the single retry after HTTP 429; defaults to 10 s. */
  rateLimitRetryDelayMs?: number;
}

/**
 * Shared HTTP behaviour for data.gov.sg: requests are spaced to fit the key's rate limit, a
 * single 429 is retried after 10 s, and failures surface as WeatherProviderError with safe
 * messages. One instance is shared by every client in the process (see `createApp`), because
 * the provider's limit is per key, not per client.
 */
export class ProviderRequester {
  private readonly waiting: Record<RequestPriority, (() => void)[]> = { high: [], normal: [] };
  private slotTimer: ReturnType<typeof setTimeout> | null = null;
  private nextRequestAt = 0;
  private readonly intervalMs: number;

  constructor(private readonly options: ProviderRequesterOptions = {}) {
    this.intervalMs = options.requestIntervalMs ?? defaultRequestIntervalMs(options.apiKey);
  }

  async getJson<T>(
    url: string,
    stats?: RequestStats,
    priority: RequestPriority = 'normal',
  ): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const queuedAt = Date.now();
      await this.waitForRequestSlot(priority);
      if (stats) {
        stats.pacingWaitMs += Date.now() - queuedAt;
        stats.requests += 1;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 8000);

      try {
        const doFetch = this.options.fetchImpl ?? fetch;
        const response = await doFetch(url, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'User-Agent': this.options.userAgent ?? 'weather-starter/0.1 (educational project)',
            ...(this.options.apiKey ? { 'x-api-key': this.options.apiKey } : {}),
          },
        });

        if (response.status === 429 && attempt === 0) {
          const retryDelayMs = this.options.rateLimitRetryDelayMs ?? RATE_LIMIT_RETRY_DELAY_MS;
          const waitStartedAt = Date.now();
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          if (stats) {
            stats.retries += 1;
            stats.retryWaitMs += Date.now() - waitStartedAt;
          }
          continue;
        }

        if (!response.ok) {
          if (response.status === 429) {
            throw new WeatherProviderError('Weather provider rate limit reached (HTTP 429)');
          }
          if (response.status === 401 || response.status === 403) {
            throw new WeatherProviderError('Weather provider rejected request (check API key)');
          }
          throw new WeatherProviderError(`Weather provider returned HTTP ${response.status}`);
        }

        return (await response.json()) as T;
      } catch (error) {
        if (error instanceof WeatherProviderError) throw error;
        throw new WeatherProviderError('Unable to reach weather provider');
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new WeatherProviderError('Weather provider request failed after retry');
  }

  /** Resolves when this call may start: high-priority waiters first, then first come first served. */
  private waitForRequestSlot(priority: RequestPriority): Promise<void> {
    return new Promise((resolve) => {
      this.waiting[priority].push(resolve);
      this.grantSlots();
    });
  }

  /** Grants every slot that is free now and sets one timer for the next; picks at grant time. */
  private grantSlots(): void {
    if (this.slotTimer) return;
    for (;;) {
      if (this.waiting.high.length === 0 && this.waiting.normal.length === 0) return;
      const delay = this.nextRequestAt - Date.now();
      if (delay > 0) {
        this.slotTimer = setTimeout(() => {
          this.slotTimer = null;
          this.grantSlots();
        }, delay);
        return;
      }
      const next = this.waiting.high.shift() ?? this.waiting.normal.shift();
      this.nextRequestAt = Date.now() + this.intervalMs;
      next?.();
    }
  }
}
