import { describe, expect, it, vi } from 'vitest';
import {
  normaliseStrikes,
  SingaporeLightningClient,
  type LightningRecord,
} from './lightning.js';
import { WeatherProviderError } from './providerHttp.js';

// Tests exercise lightning handling, not pacing (covered in providerHttp.test.ts).
const NO_PACING = { requestIntervalMs: 0, rateLimitRetryDelayMs: 0 };

const NOW = new Date('2026-11-11T14:00:00Z'); // 22:00 SGT on 2026-11-11

function minutesAgo(minutes: number, now = NOW): string {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

function reading(overrides: Record<string, unknown> = {}) {
  return {
    location: { latitude: '1.3521', longitude: '103.8198' },
    type: 'C',
    text: 'Cloud to Cloud',
    datetime: minutesAgo(5),
    ...overrides,
  };
}

function record(readings: unknown[], datetime = minutesAgo(5)): LightningRecord {
  return { datetime, updatedTimestamp: datetime, item: { readings: readings as never } };
}

describe('normaliseStrikes', () => {
  it('parses string coordinates and maps type and label', () => {
    const [strike] = normaliseStrikes([record([reading()])], NOW);
    expect(strike).toMatchObject({
      latitude: 1.3521,
      longitude: 103.8198,
      type: 'C',
      label: 'Cloud to Cloud',
    });
    expect(strike.id).toBe(`${minutesAgo(5)}|1.3521|103.8198`);
  });

  it('skips unusable coordinates without discarding the others', () => {
    const strikes = normaliseStrikes(
      [
        record([
          reading({ location: { latitude: 'abc', longitude: '103.8' } }),
          reading({ location: { latitude: '1.2', longitude: '200' } }),
          reading({ location: { latitude: '95', longitude: '103.8' } }),
          reading({ location: undefined }),
          reading({ location: { latitude: null, longitude: '103.8' } }),
          reading({ datetime: minutesAgo(3) }),
        ]),
      ],
      NOW,
    );
    expect(strikes).toHaveLength(1);
    expect(strikes[0].occurred_at).toBe(minutesAgo(3));
  });

  it('keeps strikes just outside Singapore, which the provider reports for the wider region', () => {
    const strikes = normaliseStrikes(
      [record([reading({ location: { latitude: '1.0044', longitude: '103.3072' } })])],
      NOW,
    );
    expect(strikes).toHaveLength(1);
  });

  it('skips strikes with a missing or unparseable datetime', () => {
    const strikes = normaliseStrikes(
      [{ item: { readings: [reading({ datetime: 'not a date' }), reading({ datetime: undefined })] } }],
      NOW,
    );
    expect(strikes).toEqual([]);
  });

  it('falls back to the record datetime when a reading has none', () => {
    const [strike] = normaliseStrikes([record([reading({ datetime: undefined })], minutesAgo(7))], NOW);
    expect(strike.occurred_at).toBe(minutesAgo(7));
  });

  it('uses generic type and label for unknown strike kinds', () => {
    const [strike] = normaliseStrikes(
      [record([reading({ type: undefined, text: '  ' })])],
      NOW,
    );
    expect(strike.type).toBe('unknown');
    expect(strike.label).toBe('Lightning');
  });

  it('keeps other strike types and the supplied text', () => {
    const [strike] = normaliseStrikes([record([reading({ type: 'G', text: 'Cloud to Ground' })])], NOW);
    expect(strike.type).toBe('G');
    expect(strike.label).toBe('Cloud to Ground');
  });

  it('keeps strikes up to 60 minutes old and 5 minutes ahead, drops the rest', () => {
    const strikes = normaliseStrikes(
      [
        record([
          reading({ datetime: minutesAgo(59) }),
          reading({ datetime: minutesAgo(61) }),
          reading({ datetime: minutesAgo(-4) }),
          reading({ datetime: minutesAgo(-6) }),
        ]),
      ],
      NOW,
    );
    expect(strikes.map((strike) => strike.occurred_at)).toEqual([minutesAgo(-4), minutesAgo(59)]);
  });

  it('removes duplicates and sorts newest first', () => {
    const strikes = normaliseStrikes(
      [
        record([reading({ datetime: minutesAgo(30) }), reading({ datetime: minutesAgo(10) })]),
        record([reading({ datetime: minutesAgo(10) })]),
      ],
      NOW,
    );
    expect(strikes.map((strike) => strike.occurred_at)).toEqual([minutesAgo(10), minutesAgo(30)]);
  });
});

type Page = { records: LightningRecord[]; token?: string };

function pagedFetch(pages: Page[]) {
  let call = 0;
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    const page = pages[Math.min(call, pages.length - 1)];
    call += 1;
    return new Response(
      JSON.stringify({
        code: 0,
        data: { records: page.records, paginationToken: page.token },
        errorMsg: '',
      }),
      { status: 200 },
    );
  });
}

/** 25 two-minute records starting `startMinutes` ago, newest first (like the provider). */
function windowRecords(startMinutes: number, readingsAt: number[] = []): LightningRecord[] {
  return Array.from({ length: 25 }, (_, index) => {
    const age = startMinutes + index * 2;
    return record(
      readingsAt.includes(age) ? [reading({ datetime: minutesAgo(age) })] : [],
      minutesAgo(age),
    );
  });
}

function urlOf(fetchMock: ReturnType<typeof pagedFetch>, call: number): URL {
  return new URL(String(fetchMock.mock.calls[call][0]));
}

describe('SingaporeLightningClient', () => {
  it('requests today in Singapore time and returns strikes inside the window', async () => {
    const fetchMock = pagedFetch([{ records: windowRecords(0, [4, 40]), token: 'next' }, { records: windowRecords(50) }]);
    const client = new SingaporeLightningClient({ ...NO_PACING, fetchImpl: fetchMock as never });

    const observation = await client.getRecentLightning(NOW);

    const first = urlOf(fetchMock, 0);
    expect(first.searchParams.get('api')).toBe('lightning');
    expect(first.searchParams.get('date')).toBe('2026-11-11');
    expect(observation.window_minutes).toBe(60);
    expect(observation.stale).toBe(false);
    expect(observation.fetched_at).toBe(NOW.toISOString());
    expect(observation.strikes.map((strike) => strike.occurred_at)).toEqual([minutesAgo(4), minutesAgo(40)]);
  });

  it('follows the pagination token until the oldest record passes the cutoff', async () => {
    const fetchMock = pagedFetch([
      { records: windowRecords(0), token: 'abc=' },
      { records: windowRecords(50) },
    ]);
    await new SingaporeLightningClient({ ...NO_PACING, fetchImpl: fetchMock as never }).getRecentLightning(NOW);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(urlOf(fetchMock, 1).searchParams.get('paginationToken')).toBe('abc=');
  });

  it('stops when there is no pagination token even if the window is not covered', async () => {
    const fetchMock = pagedFetch([{ records: windowRecords(0) }]);
    await new SingaporeLightningClient({ ...NO_PACING, fetchImpl: fetchMock as never }).getRecentLightning(NOW);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caps today at 3 pages', async () => {
    const fetchMock = pagedFetch([{ records: windowRecords(0), token: 't' }]);
    await new SingaporeLightningClient({ ...NO_PACING, fetchImpl: fetchMock as never }).getRecentLightning(NOW);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('also reads the previous Singapore date when the window crosses midnight', async () => {
    const justAfterMidnight = new Date('2026-11-11T16:20:00Z'); // 00:20 SGT on 2026-11-12
    const fetchMock = pagedFetch([
      { records: [record([], minutesAgo(2, justAfterMidnight))] },
      { records: [record([reading({ datetime: minutesAgo(30, justAfterMidnight) })], minutesAgo(30, justAfterMidnight))] },
    ]);
    const observation = await new SingaporeLightningClient({ ...NO_PACING, fetchImpl: fetchMock as never }).getRecentLightning(
      justAfterMidnight,
    );

    expect(urlOf(fetchMock, 0).searchParams.get('date')).toBe('2026-11-12');
    expect(urlOf(fetchMock, 1).searchParams.get('date')).toBe('2026-11-11');
    expect(observation.strikes).toHaveLength(1);
  });

  it('reuses the cached window for 2 minutes, then fetches again', async () => {
    const fetchMock = pagedFetch([{ records: windowRecords(0, [4]) }]);
    const client = new SingaporeLightningClient({ ...NO_PACING, fetchImpl: fetchMock as never });

    await client.getRecentLightning(NOW);
    await client.getRecentLightning(new Date(NOW.getTime() + 119_000));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await client.getRecentLightning(new Date(NOW.getTime() + 120_000));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shares one request between concurrent callers', async () => {
    const fetchMock = pagedFetch([{ records: windowRecords(0) }]);
    const client = new SingaporeLightningClient({ ...NO_PACING, fetchImpl: fetchMock as never });
    await Promise.all([client.getRecentLightning(NOW), client.getRecentLightning(NOW)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('trims cached strikes that have aged out of the window', async () => {
    const fetchMock = pagedFetch([{ records: windowRecords(11, [59]) }]);
    const client = new SingaporeLightningClient({ ...NO_PACING, fetchImpl: fetchMock as never });
    expect((await client.getRecentLightning(NOW)).strikes).toHaveLength(1);
    const later = await client.getRecentLightning(new Date(NOW.getTime() + 119_000));
    expect(later.strikes).toHaveLength(0);
  });

  it('serves the previous window as stale when a refresh fails', async () => {
    const ok = pagedFetch([{ records: windowRecords(0, [4]) }]);
    const client = new SingaporeLightningClient({ ...NO_PACING,
      fetchImpl: (async (...args: Parameters<typeof fetch>) => {
        if (ok.mock.calls.length === 0) return ok(...args);
        throw new Error('network down');
      }) as never,
    });

    await client.getRecentLightning(NOW);
    const stale = await client.getRecentLightning(new Date(NOW.getTime() + 180_000));

    expect(stale.stale).toBe(true);
    expect(stale.strikes).toHaveLength(1);
    expect(stale.fetched_at).toBe(NOW.toISOString());
  });

  it('throws a WeatherProviderError when failing with nothing cached', async () => {
    const client = new SingaporeLightningClient({ ...NO_PACING,
      fetchImpl: (async () => new Response('{}', { status: 500 })) as never,
    });
    await expect(client.getRecentLightning(NOW)).rejects.toBeInstanceOf(WeatherProviderError);
  });

  it('treats a provider error body as a failure', async () => {
    const client = new SingaporeLightningClient({ ...NO_PACING,
      fetchImpl: (async () =>
        new Response(JSON.stringify({ code: 24, errorMsg: 'Rate limit exceeded' }), { status: 200 })) as never,
    });
    await expect(client.getRecentLightning(NOW)).rejects.toBeInstanceOf(WeatherProviderError);
  });

  it('works without an API key and sends the key header only when configured', async () => {
    const withoutKey = pagedFetch([{ records: windowRecords(0) }]);
    await new SingaporeLightningClient({ ...NO_PACING, fetchImpl: withoutKey as never }).getRecentLightning(NOW);
    expect((withoutKey.mock.calls[0][1]?.headers as Record<string, string>)['x-api-key']).toBeUndefined();

    const withKey = pagedFetch([{ records: windowRecords(0) }]);
    await new SingaporeLightningClient({ ...NO_PACING, apiKey: 'secret', fetchImpl: withKey as never }).getRecentLightning(NOW);
    expect((withKey.mock.calls[0][1]?.headers as Record<string, string>)['x-api-key']).toBe('secret');
  });
});
