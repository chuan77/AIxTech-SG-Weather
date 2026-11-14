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
  private requestQueue: Promise<void> = Promise.resolve();
  private nextRequestAt = 0;
  private readonly intervalMs: number;

  constructor(private readonly options: ProviderRequesterOptions = {}) {
    this.intervalMs = options.requestIntervalMs ?? defaultRequestIntervalMs(options.apiKey);
  }

  async getJson<T>(url: string): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await this.waitForRequestSlot();
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
          await new Promise((resolve) =>
            setTimeout(resolve, this.options.rateLimitRetryDelayMs ?? RATE_LIMIT_RETRY_DELAY_MS),
          );
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

  private async waitForRequestSlot(): Promise<void> {
    const requestSlot = this.requestQueue.then(async () => {
      const delay = Math.max(0, this.nextRequestAt - Date.now());
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      this.nextRequestAt = Date.now() + this.intervalMs;
    });

    this.requestQueue = requestSlot.then(
      () => undefined,
      () => undefined,
    );
    await requestSlot;
  }
}
