import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SingaporeLightningClient } from './lightning.js';
import {
  ProviderRequester,
  WeatherProviderError,
  createRequestStats,
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

describe('ProviderRequester request stats', () => {
  it('counts one request and no retries for a plain success', async () => {
    const { fetchImpl } = recordingFetch();
    const requester = new ProviderRequester({
      fetchImpl,
      requestIntervalMs: 0,
      rateLimitRetryDelayMs: 0,
    });
    const stats = createRequestStats();

    await settle(requester.getJson('https://x.test/a', stats));

    expect(stats).toMatchObject({ requests: 1, retries: 0, retryWaitMs: 0 });
    expect(stats.pacingWaitMs).toBeGreaterThanOrEqual(0);
  });

  it('counts a 429 retry as a second request and records its wait', async () => {
    const { fetchImpl } = recordingFetch([429, 200]);
    const requester = new ProviderRequester({
      fetchImpl,
      requestIntervalMs: 0,
      rateLimitRetryDelayMs: 500,
    });
    const stats = createRequestStats();

    await settle(requester.getJson('https://x.test/a', stats));

    expect(stats.requests).toBe(2);
    expect(stats.retries).toBe(1);
    expect(stats.retryWaitMs).toBeGreaterThanOrEqual(500);
  });

  it('records time spent waiting for a pacing slot', async () => {
    const { fetchImpl } = recordingFetch();
    const requester = new ProviderRequester({
      fetchImpl,
      requestIntervalMs: 50,
      rateLimitRetryDelayMs: 0,
    });
    const first = createRequestStats();
    const second = createRequestStats();

    await settle(
      Promise.all([
        requester.getJson('https://x.test/a', first),
        requester.getJson('https://x.test/b', second),
      ]),
    );

    expect(second.pacingWaitMs).toBeGreaterThan(0);
  });

  it('still works without stats', async () => {
    const { fetchImpl } = recordingFetch();
    const requester = new ProviderRequester({ fetchImpl, requestIntervalMs: 0 });
    await expect(settle(requester.getJson('https://x.test/a'))).resolves.toBeDefined();
  });
});

describe('ProviderRequester priority (spec 011)', () => {
  function urlRecordingFetch() {
    const order: string[] = [];
    const startedAt: number[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      order.push(String(url));
      startedAt.push(Date.now());
      return new Response('{}', { status: 200 });
    });
    return { fetchImpl: fetchImpl as unknown as typeof fetch, order, startedAt };
  }

  it('lets a high-priority call take the next slot ahead of queued normal calls', async () => {
    const { fetchImpl, order, startedAt } = urlRecordingFetch();
    const requester = new ProviderRequester({ fetchImpl, requestIntervalMs: 884 });

    // A location refresh queues its calls first; rain arrives just after.
    const normal = ['n1', 'n2', 'n3', 'n4'].map((name) => requester.getJson(`https://x/${name}`));
    await vi.advanceTimersByTimeAsync(10);
    const rain = requester.getJson('https://x/rain', undefined, 'high');
    await settle(Promise.all([...normal, rain]));

    expect(order).toEqual([
      'https://x/n1',
      'https://x/rain',
      'https://x/n2',
      'https://x/n3',
      'https://x/n4',
    ]);
    // The per-key spacing still holds for every call, priority or not.
    expect(gaps(startedAt).every((gap) => gap >= 884)).toBe(true);
  });

  it('keeps first-come order within the same priority', async () => {
    const { fetchImpl, order } = urlRecordingFetch();
    const requester = new ProviderRequester({ fetchImpl, requestIntervalMs: 100 });
    const calls = [
      requester.getJson('https://x/n1'),
      requester.getJson('https://x/n2'),
      requester.getJson('https://x/h1', undefined, 'high'),
      requester.getJson('https://x/h2', undefined, 'high'),
    ];
    await settle(Promise.all(calls));
    expect(order).toEqual(['https://x/n1', 'https://x/h1', 'https://x/h2', 'https://x/n2']);
  });

  it('keeps the priority for a 429 retry', async () => {
    const statuses = [429];
    const order: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      order.push(String(url));
      return new Response('{}', { status: statuses.shift() ?? 200 });
    }) as unknown as typeof fetch;
    const requester = new ProviderRequester({
      fetchImpl,
      requestIntervalMs: 100,
      rateLimitRetryDelayMs: 1000,
    });
    const rain = requester.getJson('https://x/rain', undefined, 'high');
    await vi.advanceTimersByTimeAsync(50);
    const normal = ['n1', 'n2', 'n3'].map((name) => requester.getJson(`https://x/${name}`));
    await settle(Promise.all([rain, ...normal]));
    // The retry comes 1 s later; by then n1..n3 have gone (they don't wait for it), and the retry
    // is not pushed behind any normal call that queued after it.
    expect(order.filter((url) => url.endsWith('rain'))).toHaveLength(2);
  });

  it('sends rain and lightning as high priority', async () => {
    const seen: string[] = [];
    const requester = {
      getJson: vi.fn(async (url: string, _stats?: unknown, priority?: string) => {
        seen.push(`${new URL(url).pathname}:${priority}`);
        return { code: 0, data: { records: [], stations: [], readings: [] } };
      }),
    } as unknown as ProviderRequester;
    const { SingaporeRainClient } = await import('./rain.js');
    await new SingaporeRainClient({ requester })
      .getRecentRain(new Date('2026-11-17T00:25:00Z'))
      .catch(() => {});
    await new SingaporeLightningClient({ requester })
      .getRecentLightning(new Date('2026-11-17T00:25:00Z'))
      .catch(() => {});
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((entry) => entry.endsWith(':high'))).toBe(true);
  });
});
