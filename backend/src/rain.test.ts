import { describe, expect, it, vi } from 'vitest';
import {
  buildRainObservation,
  SingaporeRainClient,
  type RainPayload,
  type RainTiming,
} from './rain.js';
import { WeatherProviderError } from './providerHttp.js';

// Tests exercise rain handling, not pacing (covered in providerHttp.test.ts).
const NO_PACING = { requestIntervalMs: 0, rateLimitRetryDelayMs: 0 };

const NOW = new Date('2026-11-17T00:25:00Z'); // 08:25 SGT on 2026-11-17, as in the Gate 1 check

/** SGT wall-clock time on 2026-11-17 as the provider writes it, e.g. sgt('08:15'). */
function sgt(time: string, date = '2026-11-17'): string {
  return `${date}T${time}:00+08:00`;
}

type Station = {
  id: string;
  name?: string;
  location?: { latitude?: unknown; longitude?: unknown };
};

function station(id: string, latitude: unknown = 1.35, longitude: unknown = 103.8): Station {
  return { id, name: `Station ${id}`, location: { latitude, longitude } };
}

/** One five-minute reading: `values` maps station id to the provider's value. */
function reading(timestamp: string, values: Record<string, unknown>) {
  return {
    timestamp,
    data: Object.entries(values).map(([stationId, value]) => ({ stationId, value })),
  };
}

function payload(
  stations: Station[],
  readings: ReturnType<typeof reading>[],
  token?: string,
): RainPayload {
  return {
    code: 0,
    errorMsg: '',
    data: { stations, readings, paginationToken: token },
  } as RainPayload;
}

/** Ten stations S1..S10, each with value 0 unless given. */
const IDS = Array.from({ length: 10 }, (_, index) => `S${index + 1}`);
const STATIONS = IDS.map((id) => station(id));
function full(timestamp: string, overrides: Record<string, unknown> = {}) {
  return reading(timestamp, { ...Object.fromEntries(IDS.map((id) => [id, 0])), ...overrides });
}

function byId(observation: ReturnType<typeof buildRainObservation>, id: string) {
  return observation?.stations.find((entry) => entry.id === id);
}

describe('buildRainObservation', () => {
  it('skips a newest period that is still filling and anchors on the newest usable one', () => {
    const observation = buildRainObservation([
      payload(STATIONS, [
        reading(sgt('08:20'), { S1: 5, S2: 5, S3: 5 }), // 3 of 10 rows: still arriving
        full(sgt('08:15'), { S1: 0.2 }),
        full(sgt('08:10'), { S1: 0.4 }),
        full(sgt('08:05'), { S1: 0.6 }),
        full(sgt('08:00'), { S1: 9 }),
      ]),
    ]);

    expect(observation?.window_end).toBe(sgt('08:15'));
    expect(observation?.window_start).toBe(sgt('08:00'));
    expect(observation?.window_minutes).toBe(15);
    expect(observation?.periods_found).toBe(3);
    // 08:15 + 08:10 + 08:05; the filling 08:20 period and the older 08:00 one are left out.
    expect(byId(observation, 'S1')).toMatchObject({ total_mm: 1.2, periods_covered: 3 });
  });

  it('treats a period as usable at exactly 80% of the largest row count', () => {
    const eight = Object.fromEntries(IDS.slice(0, 8).map((id) => [id, 0]));
    const observation = buildRainObservation([
      payload(STATIONS, [reading(sgt('08:20'), eight), full(sgt('08:15')), full(sgt('08:10'))]),
    ]);
    expect(observation?.window_end).toBe(sgt('08:20'));
  });

  it('coerces string values and rounds totals to 0.1 mm', () => {
    const observation = buildRainObservation([
      payload(STATIONS, [
        full(sgt('08:15'), { S1: '0.2', S2: 0.1 }),
        full(sgt('08:10'), { S1: '0.2', S2: 0.1 }),
        full(sgt('08:05'), { S1: '0.2', S2: 0.1 }),
      ]),
    ]);
    expect(byId(observation, 'S1')?.total_mm).toBe(0.6);
    expect(byId(observation, 'S2')?.total_mm).toBe(0.3);
  });

  it('counts covered periods per station and gives null with none', () => {
    const observation = buildRainObservation([
      payload(STATIONS, [
        full(sgt('08:15'), { S2: 1, S3: 'n/a', S4: null }),
        reading(sgt('08:10'), { ...Object.fromEntries(IDS.slice(4).map((id) => [id, 0])), S2: 1 }),
        reading(sgt('08:05'), Object.fromEntries(IDS.slice(4).map((id) => [id, 0]))),
      ]),
    ]);
    expect(byId(observation, 'S1')).toMatchObject({ total_mm: 0, periods_covered: 1 });
    expect(byId(observation, 'S2')).toMatchObject({ total_mm: 2, periods_covered: 2 });
    // A non-numeric or null value is not a reading.
    expect(byId(observation, 'S3')).toMatchObject({ total_mm: null, periods_covered: 0 });
    expect(byId(observation, 'S4')).toMatchObject({ total_mm: null, periods_covered: 0 });
    expect(byId(observation, 'S5')).toMatchObject({ total_mm: 0, periods_covered: 3 });
  });

  it('leaves a period missing from the response uncovered for every station', () => {
    const observation = buildRainObservation([
      payload(STATIONS, [full(sgt('08:15'), { S1: 1 }), full(sgt('08:05'), { S1: 1 })]),
    ]);
    expect(observation?.periods_found).toBe(2);
    expect(byId(observation, 'S1')).toMatchObject({ total_mm: 2, periods_covered: 2 });
  });

  it('counts a duplicated timestamp once', () => {
    const observation = buildRainObservation([
      payload(STATIONS, [
        full(sgt('08:15'), { S1: 1 }),
        full(sgt('08:15'), { S1: 1 }),
        full(sgt('08:10'), { S1: 1 }),
        full(sgt('08:05'), { S1: 1 }),
      ]),
    ]);
    expect(observation?.periods_found).toBe(3);
    expect(byId(observation, 'S1')?.total_mm).toBe(3);
  });

  it('leaves out stations without usable coordinates and sorts by id', () => {
    const stations = [
      station('S3'),
      station('S1'),
      station('S2', 'abc', 103.8),
      station('S4', 1.3, null),
      { id: 'S5', name: 'No location' },
      station('S6', 95, 103.8),
    ];
    const observation = buildRainObservation([
      payload(stations, [reading(sgt('08:15'), { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0 })]),
    ]);
    expect(observation?.stations.map((entry) => entry.id)).toEqual(['S1', 'S3']);
    expect(observation?.stations[0]).toMatchObject({
      name: 'Station S1',
      latitude: 1.35,
      longitude: 103.8,
    });
  });

  it('accepts string coordinates and falls back to the id for a missing name', () => {
    const observation = buildRainObservation([
      payload(
        [{ id: 'S9', location: { latitude: '1.31', longitude: '103.83' } }],
        [reading(sgt('08:15'), { S9: 0 })],
      ),
    ]);
    expect(observation?.stations[0]).toMatchObject({
      name: 'S9',
      latitude: 1.31,
      longitude: 103.83,
    });
  });

  it('returns null when there is no reading at all', () => {
    expect(buildRainObservation([payload(STATIONS, [])])).toBeNull();
  });

  it('joins the previous date when the window crosses midnight', () => {
    const observation = buildRainObservation([
      payload(STATIONS, [full(sgt('00:05'), { S1: 1 })]),
      payload(STATIONS, [
        full(sgt('00:00'), { S1: 1 }),
        full(sgt('23:55', '2026-11-16'), { S1: 1 }),
        full(sgt('23:50', '2026-11-16'), { S1: 9 }),
      ]),
    ]);
    expect(observation?.window_end).toBe(sgt('00:05'));
    expect(observation?.window_start).toBe(sgt('23:50', '2026-11-16'));
    expect(byId(observation, 'S1')).toMatchObject({ total_mm: 3, periods_covered: 3 });
  });
});

function jsonFetch(...bodies: RainPayload[]) {
  let call = 0;
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    const body = bodies[Math.min(call, bodies.length - 1)];
    call += 1;
    return new Response(JSON.stringify(body), { status: 200 });
  });
}

function urlOf(fetchMock: ReturnType<typeof jsonFetch>, call: number): URL {
  return new URL(String(fetchMock.mock.calls[call][0]));
}

const MORNING = payload(STATIONS, [
  full(sgt('08:15'), { S1: 1 }),
  full(sgt('08:10'), { S1: 1 }),
  full(sgt('08:05'), { S1: 1 }),
]);

describe('SingaporeRainClient', () => {
  it("requests today's rainfall in Singapore time, first page only", async () => {
    const fetchMock = jsonFetch(payload(STATIONS, MORNING.data!.readings! as never, 'next-page'));
    const client = new SingaporeRainClient({ ...NO_PACING, fetchImpl: fetchMock as never });

    const observation = await client.getRecentRain(NOW);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = urlOf(fetchMock, 0);
    expect(url.pathname).toBe('/v2/real-time/api/rainfall');
    expect(url.searchParams.get('date')).toBe('2026-11-17');
    expect(url.searchParams.has('paginationToken')).toBe(false);
    expect(observation).toMatchObject({
      window_end: sgt('08:15'),
      fetched_at: NOW.toISOString(),
      stale: false,
    });
  });

  it('makes one extra request for the previous date when the window reaches before midnight', async () => {
    const justAfterMidnight = new Date('2026-11-16T16:08:00Z'); // 00:08 SGT on 2026-11-17
    const fetchMock = jsonFetch(
      payload(STATIONS, [full(sgt('00:05'), { S1: 1 })]),
      payload(STATIONS, [full(sgt('00:00')), full(sgt('23:55', '2026-11-16'))]),
    );
    const observation = await new SingaporeRainClient({
      ...NO_PACING,
      fetchImpl: fetchMock as never,
    }).getRecentRain(justAfterMidnight);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(urlOf(fetchMock, 0).searchParams.get('date')).toBe('2026-11-17');
    expect(urlOf(fetchMock, 1).searchParams.get('date')).toBe('2026-11-16');
    expect(observation.periods_found).toBe(3);
  });

  it('reads the previous date when today has no readings yet', async () => {
    const atMidnight = new Date('2026-11-16T16:01:00Z'); // 00:01 SGT
    const fetchMock = jsonFetch(
      payload(STATIONS, []),
      payload(STATIONS, [full(sgt('23:55', '2026-11-16')), full(sgt('23:50', '2026-11-16'))]),
    );
    const observation = await new SingaporeRainClient({
      ...NO_PACING,
      fetchImpl: fetchMock as never,
    }).getRecentRain(atMidnight);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(observation.window_end).toBe(sgt('23:55', '2026-11-16'));
  });

  it("reads the previous date when today's data is not found yet", async () => {
    const atMidnight = new Date('2026-11-16T16:01:00Z'); // 00:01 SGT
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call += 1;
      if (call === 1)
        return new Response(JSON.stringify({ code: 17, data: null }), { status: 404 });
      return new Response(JSON.stringify(payload(STATIONS, [full(sgt('23:55', '2026-11-16'))])), {
        status: 200,
      });
    });
    const observation = await new SingaporeRainClient({
      ...NO_PACING,
      fetchImpl: fetchMock as never,
    }).getRecentRain(atMidnight);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(observation.window_end).toBe(sgt('23:55', '2026-11-16'));
  });

  it('throws a WeatherProviderError when no period is usable', async () => {
    const client = new SingaporeRainClient({
      ...NO_PACING,
      fetchImpl: jsonFetch(payload(STATIONS, [])) as never,
    });
    await expect(client.getRecentRain(NOW)).rejects.toBeInstanceOf(WeatherProviderError);
  });

  it('throws a WeatherProviderError when every station is missing', async () => {
    const empty = payload(STATIONS, [reading(sgt('08:15'), { S1: null, S2: 'x' })]);
    const client = new SingaporeRainClient({ ...NO_PACING, fetchImpl: jsonFetch(empty) as never });
    await expect(client.getRecentRain(NOW)).rejects.toBeInstanceOf(WeatherProviderError);
  });

  it('treats a provider error body as a failure', async () => {
    const client = new SingaporeRainClient({
      ...NO_PACING,
      fetchImpl: jsonFetch({ code: 4, errorMsg: 'Invalid date format' } as RainPayload) as never,
    });
    await expect(client.getRecentRain(NOW)).rejects.toBeInstanceOf(WeatherProviderError);
  });
});

describe('SingaporeRainClient cache', () => {
  it('reuses the snapshot for 2 minutes, then fetches again', async () => {
    const fetchMock = jsonFetch(MORNING);
    const client = new SingaporeRainClient({ ...NO_PACING, fetchImpl: fetchMock as never });

    await client.getRecentRain(NOW);
    await client.getRecentRain(new Date(NOW.getTime() + 119_999));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await client.getRecentRain(new Date(NOW.getTime() + 120_001));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shares one request between concurrent callers', async () => {
    const fetchMock = jsonFetch(MORNING);
    const client = new SingaporeRainClient({ ...NO_PACING, fetchImpl: fetchMock as never });
    const [first, second] = await Promise.all([
      client.getRecentRain(NOW),
      client.getRecentRain(NOW),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('reports fetch, cache and shared in timing', async () => {
    const client = new SingaporeRainClient({
      ...NO_PACING,
      fetchImpl: jsonFetch(MORNING) as never,
    });
    const fetched: Partial<RainTiming> = {};
    const shared: Partial<RainTiming> = {};
    await Promise.all([client.getRecentRain(NOW, fetched), client.getRecentRain(NOW, shared)]);
    const cached: Partial<RainTiming> = {};
    await client.getRecentRain(NOW, cached);

    expect(fetched).toMatchObject({
      served: 'fetch',
      pages: 1,
      requests: 1,
      stations: 10,
      outcome: 'ok',
    });
    expect(shared).toMatchObject({ served: 'shared', requests: 0, outcome: 'ok' });
    expect(cached).toMatchObject({ served: 'cache', pages: 0, requests: 0, outcome: 'ok' });
  });

  it('reports an all-dry window as outcome empty', async () => {
    const dry = payload(STATIONS, [full(sgt('08:15')), full(sgt('08:10')), full(sgt('08:05'))]);
    const timing: Partial<RainTiming> = {};
    await new SingaporeRainClient({
      ...NO_PACING,
      fetchImpl: jsonFetch(dry) as never,
    }).getRecentRain(NOW, timing);
    expect(timing.outcome).toBe('empty');
  });

  it('reports a failure with a fixed error kind and no provider text', async () => {
    const client = new SingaporeRainClient({
      ...NO_PACING,
      fetchImpl: (async () => new Response('{}', { status: 503 })) as never,
    });
    const timing: Partial<RainTiming> = {};
    await expect(client.getRecentRain(NOW, timing)).rejects.toBeInstanceOf(WeatherProviderError);
    expect(timing).toMatchObject({ outcome: 'error', errorKind: 'status_503' });
  });
});

describe('SingaporeRainClient stale fallback (US5)', () => {
  function failingAfterFirst() {
    let call = 0;
    return vi.fn(async () => {
      call += 1;
      if (call === 1) return new Response(JSON.stringify(MORNING), { status: 200 });
      throw new Error('network down');
    });
  }

  it('serves the previous snapshot as stale when a later refresh fails', async () => {
    const client = new SingaporeRainClient({
      ...NO_PACING,
      fetchImpl: failingAfterFirst() as never,
    });
    const first = await client.getRecentRain(NOW);
    const timing: Partial<RainTiming> = {};
    const stale = await client.getRecentRain(new Date(NOW.getTime() + 180_000), timing);

    expect(stale.stale).toBe(true);
    expect(stale.stations).toEqual(first.stations);
    expect(stale.fetched_at).toBe(NOW.toISOString());
    expect(timing).toMatchObject({ served: 'fetch', outcome: 'stale', errorKind: 'unreachable' });
  });

  it('treats a 429 after its retry as a failure and falls back', async () => {
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call += 1;
      if (call === 1) return new Response(JSON.stringify(MORNING), { status: 200 });
      return new Response('{"code":24}', { status: 429 });
    });
    const client = new SingaporeRainClient({ ...NO_PACING, fetchImpl: fetchMock as never });
    await client.getRecentRain(NOW);
    const timing: Partial<RainTiming> = {};
    const stale = await client.getRecentRain(new Date(NOW.getTime() + 180_000), timing);
    expect(stale.stale).toBe(true);
    expect(timing.errorKind).toBe('rate_limited');
  });

  it('still throws when failing with nothing cached', async () => {
    const client = new SingaporeRainClient({
      ...NO_PACING,
      fetchImpl: (async () => {
        throw new Error('network down');
      }) as never,
    });
    await expect(client.getRecentRain(NOW)).rejects.toBeInstanceOf(WeatherProviderError);
  });
});

describe('SingaporeRainClient after a failure (review fix)', () => {
  it('does not call upstream again for 2 minutes after a failure with nothing cached', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('down');
    });
    const client = new SingaporeRainClient({ ...NO_PACING, fetchImpl: fetchMock as never });
    await expect(client.getRecentRain(NOW)).rejects.toBeInstanceOf(WeatherProviderError);
    const timing: Partial<RainTiming> = {};
    await expect(
      client.getRecentRain(new Date(NOW.getTime() + 119_000), timing),
    ).rejects.toBeInstanceOf(WeatherProviderError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(timing).toMatchObject({ served: 'cache', requests: 0, outcome: 'error' });

    await client.getRecentRain(new Date(NOW.getTime() + 120_001)).catch(() => {});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps serving the stale snapshot without upstream calls for 2 minutes after a failure', async () => {
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call += 1;
      if (call === 1) return new Response(JSON.stringify(MORNING), { status: 200 });
      throw new Error('down');
    });
    const client = new SingaporeRainClient({ ...NO_PACING, fetchImpl: fetchMock as never });
    await client.getRecentRain(NOW);
    const failedAt = NOW.getTime() + 180_000;
    expect((await client.getRecentRain(new Date(failedAt))).stale).toBe(true);
    const again = await client.getRecentRain(new Date(failedAt + 60_000));
    expect(again.stale).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('clears the failure once a refresh succeeds', async () => {
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call += 1;
      if (call === 1) throw new Error('down');
      return new Response(JSON.stringify(MORNING), { status: 200 });
    });
    const client = new SingaporeRainClient({ ...NO_PACING, fetchImpl: fetchMock as never });
    await client.getRecentRain(NOW).catch(() => {});
    const ok = await client.getRecentRain(new Date(NOW.getTime() + 120_001));
    expect(ok.stale).toBe(false);
  });
});
