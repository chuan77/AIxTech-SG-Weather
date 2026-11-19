import { describe, expect, it, vi } from 'vitest';
import { WeatherProviderError } from './providerHttp.js';
import {
  buildTempWindObservation,
  SingaporeTempWindClient,
  type MeasurePayload,
  type TempWindTiming,
} from './tempWind.js';

// Tests exercise joining and failure handling, not pacing (covered in providerHttp.test.ts).
const NO_PACING = { requestIntervalMs: 0, rateLimitRetryDelayMs: 0 };

const NOW = new Date('2026-11-19T05:40:00Z'); // 13:40 SGT, as in the Gate 2 sample

/** SGT wall-clock time on 2026-11-19 as the provider writes it. */
function sgt(time: string): string {
  return `2026-11-19T${time}:00+08:00`;
}

type Station = {
  id: string;
  name?: unknown;
  location?: { latitude?: unknown; longitude?: unknown };
};

function station(
  id: string,
  name: unknown = `Place ${id}`,
  latitude: unknown = 1.35,
  longitude: unknown = 103.8,
): Station {
  return { id, name, location: { latitude, longitude } };
}

/** A latest-reading response in the 2026-11-19 shape: one reading, one row per station. */
function measure(
  stations: Station[],
  timestamp: string,
  values: Record<string, unknown>,
  readingType = 'DBT 1M F',
): MeasurePayload {
  return {
    code: 0,
    errorMsg: '',
    data: {
      stations: stations.map((entry) => ({ ...entry, deviceId: entry.id })),
      readings: [
        {
          timestamp,
          data: Object.entries(values).map(([stationId, value]) => ({ stationId, value })),
        },
      ],
      readingType,
      readingUnit: 'unit',
    },
  } as MeasurePayload;
}

// 15 shared stations in the real data; three here, plus S24 (temperature only), S108 and S199
// (wind only, S199 named with its own id).
const SHARED = [
  station('S109', 'Ang Mo Kio Avenue 5'),
  station('S50', 'Clementi Road'),
  station('S43', 'Kim Chuan Road'),
];
const TEMP_STATIONS = [
  ...SHARED,
  station('S24', 'Changi Meteorological Station', 1.3678, 103.9823),
];
const WIND_STATIONS = [
  ...SHARED,
  station('S108', 'Marina Barrage', 1.2799, 103.8703),
  station('S199', 'S199', 1.33, 103.75),
];

const TEMPERATURE = measure(TEMP_STATIONS, sgt('13:33'), {
  S109: 26.6,
  S50: 28.04,
  S43: '27.4',
  S24: 27.9,
});
const SPEED = measure(
  WIND_STATIONS,
  sgt('13:34'),
  { S109: 8.2, S50: 4.3, S43: 0.4, S108: 8.2, S199: 5.4 },
  'Wind Speed AVG(S)10M M1M',
);
const DIRECTION = measure(
  WIND_STATIONS,
  sgt('13:34'),
  { S109: 253, S50: 228, S43: 360, S108: 230, S199: 241 },
  'Wind Dir AVG (S) 10M M1M',
);

function build(
  temperature: MeasurePayload | null = TEMPERATURE,
  speed: MeasurePayload | null = SPEED,
  direction: MeasurePayload | null = DIRECTION,
) {
  return buildTempWindObservation({ temperature, speed, direction }, NOW);
}

function byId(observation: ReturnType<typeof build>, id: string) {
  return observation?.stations.find((entry) => entry.id === id);
}

describe('buildTempWindObservation', () => {
  it('joins the three measures by station id and sorts by id', () => {
    const observation = build();
    expect(observation?.stations.map((entry) => entry.id)).toEqual([
      'S108',
      'S109',
      'S199',
      'S24',
      'S43',
      'S50',
    ]);
    expect(byId(observation, 'S109')).toEqual({
      id: 'S109',
      name: 'Ang Mo Kio Avenue 5',
      latitude: 1.35,
      longitude: 103.8,
      temperature_c: 26.6,
      wind_speed_knots: 8.2,
      wind_direction_deg: 253,
    });
    expect(observation).toMatchObject({
      measures: { temperature: 'ok', wind: 'ok' },
      temperature_at: sgt('13:33'),
      wind_at: sgt('13:34'),
      fetched_at: NOW.toISOString(),
      stale: false,
    });
  });

  it('keeps temperature-only and wind-only stations with the other measure null', () => {
    const observation = build();
    expect(byId(observation, 'S24')).toMatchObject({
      latitude: 1.3678,
      longitude: 103.9823,
      temperature_c: 27.9,
      wind_speed_knots: null,
      wind_direction_deg: null,
    });
    expect(byId(observation, 'S108')).toMatchObject({
      latitude: 1.2799,
      temperature_c: null,
      wind_speed_knots: 8.2,
      wind_direction_deg: 230,
    });
  });

  it('gives a null name when it is empty or just the id', () => {
    const observation = build(
      measure(
        [station('S1', ''), station('S2', '  '), station('S3', 7), station('S4', 'Real')],
        sgt('13:33'),
        {
          S1: 27,
          S2: 27,
          S3: 27,
          S4: 27,
        },
      ),
    );
    expect(byId(observation, 'S199')?.name).toBeNull();
    expect(byId(observation, 'S1')?.name).toBeNull();
    expect(byId(observation, 'S2')?.name).toBeNull();
    expect(byId(observation, 'S3')?.name).toBeNull();
    expect(byId(observation, 'S4')?.name).toBe('Real');
  });

  it('takes a name from another measure when the first list has none', () => {
    const observation = build(
      measure([station('S199', '')], sgt('13:33'), { S199: 27 }),
      measure([station('S199', 'Named Later')], sgt('13:34'), { S199: 5 }),
      measure([station('S199', '')], sgt('13:34'), { S199: 90 }),
    );
    expect(byId(observation, 'S199')?.name).toBe('Named Later');
  });

  it('drops stations with invalid coordinates, keeping string coordinates', () => {
    const observation = build(
      measure(
        [
          station('S1', 'A', 91, 103.8),
          station('S2', 'B', 1.3, 'x'),
          station('S3', 'C', null, 103.8),
          station('S4', 'D', '1.31', '103.9'),
        ],
        sgt('13:33'),
        { S1: 27, S2: 27, S3: 27, S4: 27 },
      ),
      null,
      null,
    );
    expect(observation?.stations.map((entry) => entry.id)).toEqual(['S4']);
    expect(byId(observation, 'S4')).toMatchObject({ latitude: 1.31, longitude: 103.9 });
  });

  it('treats values outside the plausible ranges as no reading, and rounds temperature to 0.1', () => {
    const observation = build(
      measure(SHARED, sgt('13:33'), { S109: 9.9, S50: 45.1, S43: '28.04' }),
      measure(SHARED, sgt('13:34'), { S109: -1, S50: 150.1, S43: 150 }),
      measure(SHARED, sgt('13:34'), { S109: -0.1, S50: 360.1, S43: 'NaN' }),
    );
    expect(byId(observation, 'S109')).toMatchObject({
      temperature_c: null,
      wind_speed_knots: null,
      wind_direction_deg: null,
    });
    expect(byId(observation, 'S50')).toMatchObject({
      temperature_c: null,
      wind_speed_knots: null,
      wind_direction_deg: null,
    });
    expect(byId(observation, 'S43')).toMatchObject({
      temperature_c: 28,
      wind_speed_knots: 150,
      wind_direction_deg: null,
    });
  });

  it('accepts the range edges and turns 360 degrees into 0', () => {
    const observation = build(
      measure(SHARED, sgt('13:33'), { S109: 10, S50: 45, S43: 27 }),
      measure(SHARED, sgt('13:34'), { S109: 0, S50: 0, S43: 0.4 }),
      measure(SHARED, sgt('13:34'), { S109: 0, S50: 359.9, S43: 360 }),
    );
    expect(byId(observation, 'S109')).toMatchObject({
      temperature_c: 10,
      wind_speed_knots: 0,
      wind_direction_deg: 0,
    });
    expect(byId(observation, 'S50')).toMatchObject({
      temperature_c: 45,
      wind_direction_deg: 359.9,
    });
    expect(byId(observation, 'S43')?.wind_direction_deg).toBe(0);
  });

  it('keeps speed and direction independently (an arrow needs both; the UI decides)', () => {
    const observation = build(
      TEMPERATURE,
      measure(SHARED, sgt('13:34'), { S109: 8.2 }),
      measure(SHARED, sgt('13:34'), { S50: 228 }),
    );
    expect(byId(observation, 'S109')).toMatchObject({
      wind_speed_knots: 8.2,
      wind_direction_deg: null,
    });
    expect(byId(observation, 'S50')).toMatchObject({
      wind_speed_knots: null,
      wind_direction_deg: 228,
    });
  });

  it('keeps a listed station that has no values at all', () => {
    const observation = build(
      measure([...SHARED, station('S900', 'Quiet')], sgt('13:33'), { S109: 27 }),
    );
    expect(byId(observation, 'S900')).toMatchObject({
      temperature_c: null,
      wind_speed_knots: null,
      wind_direction_deg: null,
    });
  });

  it('uses the older of the speed and direction times for wind', () => {
    const observation = build(
      TEMPERATURE,
      measure(WIND_STATIONS, sgt('13:35'), { S109: 8 }),
      measure(WIND_STATIONS, sgt('13:32'), { S109: 200 }),
    );
    expect(observation?.wind_at).toBe(sgt('13:32'));
  });

  it('uses the newest reading when a response holds several', () => {
    const payload = measure(SHARED, sgt('13:33'), { S109: 27 });
    payload.data!.readings!.push({
      timestamp: sgt('13:20'),
      data: [{ stationId: 'S109', value: 20 }],
    });
    payload.data!.readings!.unshift({
      timestamp: sgt('13:10'),
      data: [{ stationId: 'S109', value: 21 }],
    });
    const observation = build(payload, null, null);
    expect(observation?.temperature_at).toBe(sgt('13:33'));
    expect(byId(observation, 'S109')?.temperature_c).toBe(27);
  });

  it('marks temperature unavailable when its response is missing, and never fills it in', () => {
    const observation = build(null);
    expect(observation?.measures).toEqual({ temperature: 'unavailable', wind: 'ok' });
    expect(observation?.temperature_at).toBeNull();
    expect(observation?.stations.every((entry) => entry.temperature_c === null)).toBe(true);
    // Temperature-only S24 isn't listed by any measure that loaded.
    expect(byId(observation, 'S24')).toBeUndefined();
  });

  it('marks wind unavailable when either wind response is missing', () => {
    for (const observation of [
      build(TEMPERATURE, null, DIRECTION),
      build(TEMPERATURE, SPEED, null),
    ]) {
      expect(observation?.measures).toEqual({ temperature: 'ok', wind: 'unavailable' });
      expect(observation?.wind_at).toBeNull();
      expect(
        observation?.stations.every(
          (entry) => entry.wind_speed_knots === null && entry.wind_direction_deg === null,
        ),
      ).toBe(true);
      expect(byId(observation, 'S108')).toBeUndefined();
    }
  });

  it('treats a response without a usable reading as an unavailable measure', () => {
    const empty = { code: 0, data: { stations: SHARED, readings: [] } } as MeasurePayload;
    expect(build(empty)?.measures.temperature).toBe('unavailable');
  });

  it('returns null when no measure loaded', () => {
    expect(build(null, null, null)).toBeNull();
    expect(build(null, SPEED, null)).toBeNull();
  });

  it('returns null when no station has any value', () => {
    expect(
      build(
        measure(SHARED, sgt('13:33'), { S109: null, S50: 'x' }),
        measure(SHARED, sgt('13:34'), {}),
        measure(SHARED, sgt('13:34'), { S43: 999 }),
      ),
    ).toBeNull();
  });
});

/** A fetch that answers by endpoint: `bodies` maps 'air-temperature' etc. to a body or a status. */
function endpointFetch(
  bodies: Record<string, MeasurePayload | number | (() => MeasurePayload | number)>,
) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const name = url.pathname.split('/').pop() ?? '';
    const entry = bodies[name];
    const body = typeof entry === 'function' ? entry() : entry;
    if (body === undefined) throw new Error(`unexpected ${name}`);
    if (typeof body === 'number') return new Response('{}', { status: body });
    return new Response(JSON.stringify(body), { status: 200 });
  });
}

const ALL_OK = { 'air-temperature': TEMPERATURE, 'wind-speed': SPEED, 'wind-direction': DIRECTION };

function client(fetchMock: ReturnType<typeof endpointFetch>) {
  return new SingaporeTempWindClient({ ...NO_PACING, fetchImpl: fetchMock as never });
}

describe('SingaporeTempWindClient', () => {
  it('makes the three latest-reading requests with no query string', async () => {
    const fetchMock = endpointFetch(ALL_OK);
    const observation = await client(fetchMock).getIslandConditions(NOW);
    const urls = fetchMock.mock.calls.map((call) => new URL(String(call[0])));
    expect(urls.map((url) => url.pathname).sort()).toEqual([
      '/v2/real-time/api/air-temperature',
      '/v2/real-time/api/wind-direction',
      '/v2/real-time/api/wind-speed',
    ]);
    expect(urls.every((url) => url.search === '')).toBe(true);
    expect(observation.stations).toHaveLength(6);
  });

  it('asks the shared requester for high priority', async () => {
    const getJson = vi.fn(async (url: string) => {
      const name = url.split('/').pop() as keyof typeof ALL_OK;
      return ALL_OK[name];
    });
    await new SingaporeTempWindClient({ requester: { getJson } as never }).getIslandConditions(NOW);
    expect(getJson).toHaveBeenCalledTimes(3);
    expect(getJson.mock.calls.every((call) => (call as unknown[])[2] === 'high')).toBe(true);
  });

  it('shows temperature when wind fails, and caches that result as normal', async () => {
    const fetchMock = endpointFetch({ ...ALL_OK, 'wind-direction': 503 });
    const temperatureOnly = client(fetchMock);
    const timing: Partial<TempWindTiming> = {};
    const observation = await temperatureOnly.getIslandConditions(NOW, timing);
    expect(observation.measures).toEqual({ temperature: 'ok', wind: 'unavailable' });
    expect(observation.stale).toBe(false);
    expect(timing).toMatchObject({ served: 'fetch', requests: 3, outcome: 'partial' });

    await temperatureOnly.getIslandConditions(new Date(NOW.getTime() + 60_000));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('shows wind when temperature fails', async () => {
    const observation = await client(
      endpointFetch({ ...ALL_OK, 'air-temperature': 500 }),
    ).getIslandConditions(NOW);
    expect(observation.measures).toEqual({ temperature: 'unavailable', wind: 'ok' });
    expect(observation.stations.every((entry) => entry.temperature_c === null)).toBe(true);
  });

  it('treats a provider error body as that measure failing', async () => {
    const observation = await client(
      endpointFetch({
        ...ALL_OK,
        'air-temperature': { code: 4, errorMsg: 'bad' } as MeasurePayload,
      }),
    ).getIslandConditions(NOW);
    expect(observation.measures.temperature).toBe('unavailable');
  });

  it('throws a WeatherProviderError when all three fail and nothing is cached', async () => {
    const timing: Partial<TempWindTiming> = {};
    await expect(
      client(
        endpointFetch({ 'air-temperature': 503, 'wind-speed': 503, 'wind-direction': 503 }),
      ).getIslandConditions(NOW, timing),
    ).rejects.toBeInstanceOf(WeatherProviderError);
    expect(timing).toMatchObject({ outcome: 'error', errorKind: 'status_503' });
  });

  it('throws a WeatherProviderError when every station is missing', async () => {
    const empty = measure(SHARED, sgt('13:33'), {});
    await expect(
      client(
        endpointFetch({ 'air-temperature': empty, 'wind-speed': empty, 'wind-direction': empty }),
      ).getIslandConditions(NOW),
    ).rejects.toBeInstanceOf(WeatherProviderError);
  });
});

describe('SingaporeTempWindClient timing (review fix)', () => {
  it('reports the longest pacing wait, not the sum of three overlapping waits', async () => {
    // A requester whose three calls wait 300, 600 and 900 ms for their slots, all at once.
    const waits = [300, 600, 900];
    let call = 0;
    const getJson = vi.fn(
      async (url: string, stats?: { requests: number; pacingWaitMs: number }) => {
        const wait = waits[call];
        call += 1;
        if (stats) {
          stats.requests += 1;
          stats.pacingWaitMs += wait;
        }
        const name = url.split('/').pop() as keyof typeof ALL_OK;
        return ALL_OK[name];
      },
    );
    const timing: Partial<TempWindTiming> = {};
    await new SingaporeTempWindClient({ requester: { getJson } as never }).getIslandConditions(
      NOW,
      timing,
    );
    expect(timing.requests).toBe(3);
    expect(timing.pacingWaitMs).toBe(900);
  });
});

describe('SingaporeTempWindClient cache', () => {
  it('reuses the observation for 2 minutes, then fetches again', async () => {
    const fetchMock = endpointFetch(ALL_OK);
    const shared = client(fetchMock);
    await shared.getIslandConditions(NOW);
    await shared.getIslandConditions(new Date(NOW.getTime() + 119_999));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await shared.getIslandConditions(new Date(NOW.getTime() + 120_001));
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('shares one load between concurrent callers', async () => {
    const fetchMock = endpointFetch(ALL_OK);
    const shared = client(fetchMock);
    const [first, second] = await Promise.all([
      shared.getIslandConditions(NOW),
      shared.getIslandConditions(NOW),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(second).toEqual(first);
  });

  it('reports fetch, shared and cache in timing', async () => {
    const shared = client(endpointFetch(ALL_OK));
    const fetched: Partial<TempWindTiming> = {};
    const joined: Partial<TempWindTiming> = {};
    await Promise.all([
      shared.getIslandConditions(NOW, fetched),
      shared.getIslandConditions(NOW, joined),
    ]);
    const cached: Partial<TempWindTiming> = {};
    await shared.getIslandConditions(NOW, cached);
    expect(fetched).toMatchObject({ served: 'fetch', requests: 3, stations: 6, outcome: 'ok' });
    expect(joined).toMatchObject({ served: 'shared', requests: 0, outcome: 'ok' });
    expect(cached).toMatchObject({ served: 'cache', requests: 0, outcome: 'ok' });
  });
});

describe('SingaporeTempWindClient stale fallback (US5)', () => {
  function failingAfterFirstLoad() {
    let calls = 0;
    return vi.fn(async (input: string | URL | Request) => {
      calls += 1;
      if (calls > 3) throw new Error('network down');
      const name = String(input).split('/').pop() as keyof typeof ALL_OK;
      return new Response(JSON.stringify(ALL_OK[name]), { status: 200 });
    });
  }

  it('serves the previous observation as stale when all three later fail', async () => {
    const shared = client(failingAfterFirstLoad() as never);
    const first = await shared.getIslandConditions(NOW);
    const timing: Partial<TempWindTiming> = {};
    const stale = await shared.getIslandConditions(new Date(NOW.getTime() + 180_000), timing);
    expect(stale.stale).toBe(true);
    expect(stale.stations).toEqual(first.stations);
    expect(stale.fetched_at).toBe(NOW.toISOString());
    expect(timing).toMatchObject({ served: 'fetch', outcome: 'stale', errorKind: 'unreachable' });
  });

  it('treats a 429 after its retry like any other failure', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      calls += 1;
      if (calls > 3) return new Response('{"code":24}', { status: 429 });
      const name = String(input).split('/').pop() as keyof typeof ALL_OK;
      return new Response(JSON.stringify(ALL_OK[name]), { status: 200 });
    });
    const shared = client(fetchMock as never);
    await shared.getIslandConditions(NOW);
    const timing: Partial<TempWindTiming> = {};
    const stale = await shared.getIslandConditions(new Date(NOW.getTime() + 180_000), timing);
    expect(stale.stale).toBe(true);
    expect(timing.errorKind).toBe('rate_limited');
  });

  it('never fills a failed measure from the earlier observation', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      calls += 1;
      const name = String(input).split('/').pop() as keyof typeof ALL_OK;
      if (calls > 3 && name === 'air-temperature') return new Response('{}', { status: 503 });
      return new Response(JSON.stringify(ALL_OK[name]), { status: 200 });
    });
    const shared = client(fetchMock as never);
    await shared.getIslandConditions(NOW);
    const later = await shared.getIslandConditions(new Date(NOW.getTime() + 180_000));
    expect(later.stale).toBe(false);
    expect(later.measures.temperature).toBe('unavailable');
    expect(later.stations.every((entry) => entry.temperature_c === null)).toBe(true);
  });

  it('makes no upstream call for 2 minutes after a total failure', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('down');
    });
    const shared = client(fetchMock as never);
    await expect(shared.getIslandConditions(NOW)).rejects.toBeInstanceOf(WeatherProviderError);
    const timing: Partial<TempWindTiming> = {};
    await expect(
      shared.getIslandConditions(new Date(NOW.getTime() + 119_000), timing),
    ).rejects.toBeInstanceOf(WeatherProviderError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(timing).toMatchObject({ served: 'cache', requests: 0, outcome: 'error' });

    await shared.getIslandConditions(new Date(NOW.getTime() + 120_001)).catch(() => {});
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('clears the failure once a refresh succeeds', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      calls += 1;
      if (calls <= 3) throw new Error('down');
      const name = String(input).split('/').pop() as keyof typeof ALL_OK;
      return new Response(JSON.stringify(ALL_OK[name]), { status: 200 });
    });
    const shared = client(fetchMock as never);
    await shared.getIslandConditions(NOW).catch(() => {});
    const ok = await shared.getIslandConditions(new Date(NOW.getTime() + 120_001));
    expect(ok.stale).toBe(false);
  });
});
