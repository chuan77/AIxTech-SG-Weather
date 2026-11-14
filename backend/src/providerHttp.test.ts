import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SingaporeLightningClient } from './lightning.js';
import {
  ProviderRequester,
  WeatherProviderError,
  defaultRequestIntervalMs,
} from './providerHttp.js';
import { SingaporeWeatherClient } from './weather.js';

function recordingFetch(statuses: number[] = []) {
  const startedAt: number[] = [];
  const fetchImpl = vi.fn(async () => {
    startedAt.push(Date.now());
    const status = statuses.shift() ?? 200;
    return new Response(JSON.stringify({ code: 0, data: { records: [] } }), { status });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, startedAt, calls: fetchImpl };
}

function gaps(times: number[]): number[] {
  return times.slice(1).map((time, index) => time - times[index]);
}

async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('WEATHER_API_RATE_LIMIT', '');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('ProviderRequester pacing', () => {
  it('spaces calls for the Development key limit (12 per 10 s)', async () => {
    const { fetchImpl, startedAt } = recordingFetch();
    const requester = new ProviderRequester({ apiKey: 'k', fetchImpl });

    await settle(Promise.all([1, 2, 3].map(() => requester.getJson('https://x.test/a'))));

    expect(defaultRequestIntervalMs('k')).toBe(884);
    for (const gap of gaps(startedAt)) expect(gap).toBeGreaterThanOrEqual(884);
  });

  it('spaces calls for the keyless limit (6 per 10 s)', async () => {
    const { fetchImpl, startedAt } = recordingFetch();
    const requester = new ProviderRequester({ fetchImpl });

    await settle(Promise.all([1, 2, 3].map(() => requester.getJson('https://x.test/a'))));

    expect(defaultRequestIntervalMs()).toBe(1717);
    for (const gap of gaps(startedAt)) expect(gap).toBeGreaterThanOrEqual(1717);
  });

  it('honours WEATHER_API_RATE_LIMIT for other key tiers', () => {
    vi.stubEnv('WEATHER_API_RATE_LIMIT', '30');
    expect(defaultRequestIntervalMs('k')).toBe(384);
  });

  it('ignores an invalid WEATHER_API_RATE_LIMIT', () => {
    vi.stubEnv('WEATHER_API_RATE_LIMIT', 'fast');
    expect(defaultRequestIntervalMs('k')).toBe(884);
  });

  it('sends calls back to back when the interval is 0', async () => {
    const { fetchImpl, startedAt } = recordingFetch();
    const requester = new ProviderRequester({ fetchImpl, requestIntervalMs: 0 });

    await settle(Promise.all([1, 2, 3].map(() => requester.getJson('https://x.test/a'))));

    expect(gaps(startedAt)).toEqual([0, 0]);
  });
});

describe('ProviderRequester rate-limit retry', () => {
  it('waits 10 s after a 429 before the single retry', async () => {
    const { fetchImpl, startedAt, calls } = recordingFetch([429, 200]);
    const requester = new ProviderRequester({ apiKey: 'k', fetchImpl });

    await settle(requester.getJson('https://x.test/a'));

    expect(calls).toHaveBeenCalledTimes(2);
    expect(startedAt[1] - startedAt[0]).toBeGreaterThanOrEqual(10_000);
  });

  it('gives up after a second 429', async () => {
    const { fetchImpl } = recordingFetch([429, 429]);
    const requester = new ProviderRequester({ apiKey: 'k', fetchImpl });

    const outcome = requester.getJson('https://x.test/a').catch((error: unknown) => error);
    const error = await settle(outcome);

    expect(error).toBeInstanceOf(WeatherProviderError);
    expect((error as Error).message).toBe('Weather provider rate limit reached (HTTP 429)');
  });
});

describe('shared requester', () => {
  it('paces weather and lightning calls as one stream', async () => {
    const { fetchImpl, startedAt } = recordingFetch();
    const requester = new ProviderRequester({ fetchImpl, requestIntervalMs: 500 });
    const weather = new SingaporeWeatherClient({ requester });
    const lightning = new SingaporeLightningClient({ requester });

    await settle(
      Promise.all([
        weather.getCurrentWeather(1.35, 103.85),
        lightning.getRecentLightning().catch(() => null),
      ]),
    );

    expect(startedAt.length).toBeGreaterThanOrEqual(13);
    for (const gap of gaps(startedAt)) expect(gap).toBeGreaterThanOrEqual(500);
  });
});
