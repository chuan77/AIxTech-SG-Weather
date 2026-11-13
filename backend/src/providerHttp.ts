export class WeatherProviderError extends Error {}

const PROVIDER_REQUEST_INTERVAL_MS = 250;
const RATE_LIMIT_RETRY_DELAY_MS = 1000;

export interface ProviderRequesterOptions {
  apiKey?: string;
  timeoutMs?: number;
  userAgent?: string;
  /** Replaces the global `fetch`; used by tests. Read at call time so stubbed globals work. */
  fetchImpl?: typeof fetch;
}

/**
 * Shared HTTP behaviour for data.gov.sg: requests are spaced 250 ms apart, a single 429 is
 * retried after a pause, and failures surface as WeatherProviderError with safe messages.
 */
export class ProviderRequester {
  private requestQueue: Promise<void> = Promise.resolve();
  private nextRequestAt = 0;

  constructor(private readonly options: ProviderRequesterOptions = {}) {}

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
          await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_RETRY_DELAY_MS));
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
      this.nextRequestAt = Date.now() + PROVIDER_REQUEST_INTERVAL_MS;
    });

    this.requestQueue = requestSlot.then(
      () => undefined,
      () => undefined,
    );
    await requestSlot;
  }
}
