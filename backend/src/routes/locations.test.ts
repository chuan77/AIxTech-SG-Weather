import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WeatherSnapshot } from '../weather.js';
import type { WeatherClient } from './locations.js';

const weather: WeatherSnapshot = {
  condition: 'Cloudy',
  observed_at: '2026-05-04T00:00:00Z',
  source: 'test',
  area: 'Bishan',
  valid_period_text: 'Now',
  temperature_c: 29,
  humidity_percent: 80,
  rainfall_mm: 0,
  wind_speed_knots: 4,
  wind_direction_degrees: 180,
  forecast_low_c: 25,
  forecast_high_c: 32,
  uv_index: 7,
  uv_hourly: {
    date: '2026-11-15',
    as_of: '2026-11-15T15:11:20+08:00',
    readings: [
      { hour: '2026-11-15T07:00:00+08:00', value: 0 },
      { hour: '2026-11-15T08:00:00+08:00', value: 1 },
    ],
  },
  psi_twenty_four_hourly: 42,
  pm25_one_hourly: 9,
  air_quality_region: 'central',
  pm10_twenty_four_hourly: 18,
  o3_eight_hour_max: 34,
  no2_one_hour_max: 22,
  so2_twenty_four_hourly: 4,
  co_eight_hour_max: 0.4,
  air_quality_observed_at: '2026-05-04T00:00:00Z',
  wbgt_c: 28.1,
  heat_stress_level: 'Moderate',
  wbgt_station_name: 'Bishan Street',
  wbgt_station_distance_km: 0.4,
  wbgt_observed_at: '2026-11-01T10:05:00+08:00',
  forecast_periods: [{ label: 'Now', forecast: 'Cloudy' }],
  daily_forecast: [
    { date: '2026-05-04', forecast: 'Cloudy', temperature_low_c: 25, temperature_high_c: 32 },
  ],
};

const okClient: WeatherClient = {
  async getCurrentWeather() {
    return weather;
  },
};

// Fixed visitor keys: 43 base64url characters each.
const KEY_A = 'a'.repeat(43);
const KEY_B = 'b'.repeat(43);

const coords = [
  { latitude: 1.35, longitude: 103.85 },
  { latitude: 1.36, longitude: 103.86 },
  { latitude: 1.37, longitude: 103.87 },
];

describe('locations API', () => {
  let tempDir: string;
  let app: Awaited<ReturnType<typeof import('../server.js').createApp>>;

  /** Supertest for one visitor: every request carries that visitor's key (spec 013). */
  const visitor = (key: string = KEY_A) => request.agent(app).set('X-Visitor-Key', key);

  async function buildApp(weatherClient: WeatherClient) {
    const { createApp } = await import('../server.js');
    return createApp({ serveFrontend: false, enableRequestLogging: false, weatherClient });
  }

  // Simulates a process restart: closes the DB, drops cached modules and re-imports them
  // against the same DATABASE_PATH, so only data that reached disk survives.
  async function restartApp(weatherClient: WeatherClient = okClient) {
    const { closeDatabase } = await import('../db.js');
    closeDatabase();
    vi.resetModules();
    app = await buildApp(weatherClient);
    return app;
  }

  async function addAll(count = 3) {
    for (const body of coords.slice(0, count)) {
      await visitor().post('/api/locations').send(body).expect(201);
    }
  }

  const listIds = async () =>
    (await visitor().get('/api/locations').expect(200)).body.locations.map(
      (location: { id: number }) => location.id,
    );

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'weather-starter-test-'));
    process.env.DATABASE_PATH = join(tempDir, 'weather.db');
    process.env.LOG_LEVEL = 'silent';
  });

  beforeEach(async () => {
    const { resetStore } = await import('../db.js');
    await resetStore();
    app = await buildApp(okClient);
  });

  afterAll(async () => {
    const { closeDatabase } = await import('../db.js');
    closeDatabase();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('refreshes weather when a location is created', async () => {
    const response = await visitor()
      .post('/api/locations')
      .send({ latitude: 1.35, longitude: 103.85 })
      .expect(201);

    expect(response.body).toMatchObject({
      id: 1,
      latitude: 1.35,
      longitude: 103.85,
      weather: {
        condition: 'Cloudy',
        area: 'Bishan',
        temperature_c: 29,
        uv_hourly: weather.uv_hourly,
      },
    });

    const listResponse = await visitor().get('/api/locations').expect(200);
    expect(listResponse.body.locations).toHaveLength(1);
    expect(listResponse.body.locations[0].weather).toMatchObject({
      condition: 'Cloudy',
      temperature_c: 29,
      humidity_percent: 80,
      rainfall_mm: 0,
      wind_speed_knots: 4,
      wind_direction_degrees: 180,
      uv_index: 7,
      uv_hourly: weather.uv_hourly,
      psi_twenty_four_hourly: 42,
      pm25_one_hourly: 9,
      air_quality_region: 'central',
      pm10_twenty_four_hourly: 18,
      o3_eight_hour_max: 34,
      no2_one_hour_max: 22,
      so2_twenty_four_hourly: 4,
      co_eight_hour_max: 0.4,
      air_quality_observed_at: '2026-05-04T00:00:00Z',
      wbgt_c: 28.1,
      heat_stress_level: 'Moderate',
      wbgt_station_name: 'Bishan Street',
      wbgt_station_distance_km: 0.4,
      wbgt_observed_at: '2026-11-01T10:05:00+08:00',
      forecast_low_c: 25,
      forecast_high_c: 32,
      forecast_periods: [{ label: 'Now', forecast: 'Cloudy' }],
      daily_forecast: [
        {
          date: '2026-05-04',
          forecast: 'Cloudy',
          temperature_low_c: 25,
          temperature_high_c: 32,
        },
      ],
    });
  });

  it('returns the WBGT heat-stress fields from an explicit refresh', async () => {
    const created = await visitor().post('/api/locations').send(coords[0]).expect(201);
    const refreshed = await visitor()
      .post(`/api/locations/${created.body.id}/refresh`)
      .expect(200);

    expect(refreshed.body.weather).toMatchObject({
      wbgt_c: 28.1,
      heat_stress_level: 'Moderate',
      wbgt_station_name: 'Bishan Street',
      wbgt_station_distance_km: 0.4,
      wbgt_observed_at: '2026-11-01T10:05:00+08:00',
      uv_hourly: weather.uv_hourly,
    });
  });

  it('stores the hourly UV list and reads it back unchanged after a restart', async () => {
    await addAll(1);
    await restartApp({
      async getCurrentWeather() {
        throw new Error('weather must not be fetched on startup');
      },
    });

    const { body } = await visitor().get('/api/locations').expect(200);
    expect(body.locations[0].weather.uv_hourly).toEqual(weather.uv_hourly);
  });

  it('reads uv_hourly as null for a snapshot saved without it (pre-feature)', async () => {
    app = await buildApp({
      async getCurrentWeather() {
        return { ...weather, uv_hourly: null };
      },
    });
    await addAll(1);

    const { body } = await visitor().get('/api/locations').expect(200);
    expect(body.locations[0].weather).toMatchObject({ uv_index: 7, uv_hourly: null });
  });

  it('deletes a location and returns 404 when it does not exist', async () => {
    const first = await visitor()
      .post('/api/locations')
      .send({ latitude: 1.35, longitude: 103.85 })
      .expect(201);
    const second = await visitor()
      .post('/api/locations')
      .send({ latitude: 1.36, longitude: 103.86 })
      .expect(201);

    await visitor().delete(`/api/locations/${first.body.id}`).expect(204);
    await visitor().delete(`/api/locations/${first.body.id}`).expect(404);

    const listResponse = await visitor().get('/api/locations').expect(200);
    expect(listResponse.body.locations.map((location: { id: number }) => location.id)).toEqual([
      second.body.id,
    ]);
  });

  it('US1: rejects a duplicate coordinate pair with 409', async () => {
    await visitor().post('/api/locations').send(coords[0]).expect(201);
    const response = await visitor().post('/api/locations').send(coords[0]).expect(409);

    expect(response.body.detail).toBe('Location already exists');
    expect(await listIds()).toHaveLength(1);
  });

  it('US1: rejects invalid coordinates with 422 and saves nothing', async () => {
    const bodies = [
      {},
      { latitude: 'abc', longitude: 103.85 },
      { latitude: 40.7, longitude: -74.0 },
    ];
    for (const body of bodies) {
      const response = await visitor().post('/api/locations').send(body).expect(422);
      expect(typeof response.body.detail).toBe('string');
    }
    expect(await listIds()).toEqual([]);
  });

  it('US1: keeps the location when the first refresh fails', async () => {
    const { WeatherProviderError } = await import('../weather.js');
    const failures = [new WeatherProviderError('down'), new Error('boom')];

    for (const [index, failure] of failures.entries()) {
      app = await buildApp({
        async getCurrentWeather() {
          throw failure;
        },
      });
      const response = await visitor().post('/api/locations').send(coords[index]).expect(201);
      expect(response.body.weather.condition).toBe('Not refreshed');
      expect(response.body.weather).toMatchObject({
        pm10_twenty_four_hourly: null,
        o3_eight_hour_max: null,
        no2_one_hour_max: null,
        so2_twenty_four_hourly: null,
        co_eight_hour_max: null,
        air_quality_observed_at: null,
        wbgt_c: null,
        heat_stress_level: null,
        wbgt_station_name: null,
        wbgt_station_distance_km: null,
        wbgt_observed_at: null,
      });
    }
    expect(await listIds()).toHaveLength(2);
  });

  it('US1: concurrent duplicate adds return one 201 and one 409', async () => {
    const responses = await Promise.all([
      visitor().post('/api/locations').send(coords[0]),
      visitor().post('/api/locations').send(coords[0]),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await listIds()).toHaveLength(1);
  });

  it('US1: createLocation throws DuplicateLocationError for an existing pair', async () => {
    const { createLocation } = await import('../db.js');
    const { ensureVisitor } = await import('../visitors.js');
    const visitorId = await ensureVisitor(KEY_A);
    await createLocation(visitorId, 1.35, 103.85);

    await expect(createLocation(visitorId, 1.35, 103.85)).rejects.toMatchObject({
      name: 'DuplicateLocationError',
      message: 'Location already exists',
    });
  });

  it('US2: lists saved locations newest first with stored weather after restart', async () => {
    await addAll(3);

    await restartApp({
      async getCurrentWeather() {
        throw new Error('weather must not be fetched on startup');
      },
    });

    const { body } = await visitor().get('/api/locations').expect(200);
    expect(body.locations.map((location: { id: number }) => location.id)).toEqual([3, 2, 1]);
    for (const location of body.locations) {
      expect(location.weather).toMatchObject({ area: 'Bishan', condition: 'Cloudy' });
    }
  });

  it('US2: same-second inserts keep newest-first order across restart', async () => {
    await addAll(3);
    expect(await listIds()).toEqual([3, 2, 1]);

    await restartApp();
    expect(await listIds()).toEqual([3, 2, 1]);
  });

  it('US2: returns an empty list when nothing is saved', async () => {
    await restartApp();
    const { body } = await visitor().get('/api/locations').expect(200);
    expect(body).toEqual({ locations: [] });
  });

  it('US3: a deleted location does not return after restart', async () => {
    await addAll(3);
    await visitor().delete('/api/locations/2').expect(204);

    await restartApp();

    expect(await listIds()).toEqual([3, 1]);
    await visitor().get('/api/locations/2').expect(404);
  });

  it('US3: repeated restarts give an identical list', async () => {
    await addAll(3);
    const snapshot = (await visitor().get('/api/locations').expect(200)).body;

    for (let i = 0; i < 5; i += 1) {
      await restartApp();
      const { body } = await visitor().get('/api/locations').expect(200);
      expect(body).toEqual(snapshot);
    }
  });

  it('US3: a failed refresh does not alter the stored snapshot', async () => {
    await addAll(1);
    const before = (await visitor().get('/api/locations').expect(200)).body;

    await restartApp();
    const { WeatherProviderError } = await import('../weather.js');
    app = await buildApp({
      async getCurrentWeather() {
        throw new WeatherProviderError('down');
      },
    });

    await visitor().post('/api/locations/1/refresh').expect(502);
    const after = (await visitor().get('/api/locations').expect(200)).body;
    expect(after).toEqual(before);
  });
  describe('per-visitor lists (spec 013)', () => {
    const NOT_FOUND = { detail: 'Location not found' };
    const MALFORMED = 'not-a-visitor-key';

    async function addAs(key: string, body = coords[0]) {
      return (await visitor(key).post('/api/locations').send(body).expect(201)).body as {
        id: number;
      };
    }

    it('US1: each visitor lists only their own places', async () => {
      const a = await addAs(KEY_A, coords[0]);
      const b = await addAs(KEY_B, coords[1]);

      const listA = (await visitor(KEY_A).get('/api/locations').expect(200)).body.locations;
      const listB = (await visitor(KEY_B).get('/api/locations').expect(200)).body.locations;
      expect(listA.map((l: { id: number }) => l.id)).toEqual([a.id]);
      expect(listB.map((l: { id: number }) => l.id)).toEqual([b.id]);
      expect(listA[0]).not.toHaveProperty('visitor_id');
    });

    it("US1: another visitor's place answers exactly like a missing one", async () => {
      const a = await addAs(KEY_A);
      const missing = 9999;

      for (const [method, path] of [
        ['get', `/api/locations/${a.id}`],
        ['delete', `/api/locations/${a.id}`],
        ['post', `/api/locations/${a.id}/refresh`],
      ] as const) {
        const theirs = await visitor(KEY_B)[method](path).expect(404);
        const absent = await visitor(KEY_B)
          [method](path.replace(String(a.id), String(missing)))
          .expect(404);
        expect(theirs.body).toEqual(NOT_FOUND);
        expect(theirs.text).toBe(absent.text);
        await request(app)[method](path).expect(404, NOT_FOUND);
        await request(app)[method](path).set('X-Visitor-Key', MALFORMED).expect(404, NOT_FOUND);
      }

      const stillThere = await visitor(KEY_A).get(`/api/locations/${a.id}`).expect(200);
      expect(stillThere.body.weather.condition).toBe('Cloudy');
    });

    it('US1: a refresh of another visitor’s place makes no weather call', async () => {
      const a = await addAs(KEY_A);
      const getCurrentWeather = vi.fn(async () => weather);
      app = await buildApp({ getCurrentWeather });
      await visitor(KEY_B).post(`/api/locations/${a.id}/refresh`).expect(404);
      expect(getCurrentWeather).not.toHaveBeenCalled();
    });

    it('US1: listing with no key or a malformed key shows an empty list', async () => {
      await addAs(KEY_A);
      await request(app).get('/api/locations').expect(200, { locations: [] });
      await request(app)
        .get('/api/locations')
        .set('X-Visitor-Key', MALFORMED)
        .expect(200, { locations: [] });
    });

    it('US1: saving needs a valid key, and creates nothing without one', async () => {
      const required = { detail: 'A visitor key is required' };
      await request(app).post('/api/locations').send(coords[0]).expect(400, required);
      await request(app)
        .post('/api/locations')
        .set('X-Visitor-Key', MALFORMED)
        .send(coords[0])
        .expect(400, required);
      // Body problems are still reported first.
      await request(app).post('/api/locations').send({}).expect(422);
      expect(await listIds()).toEqual([]);
    });

    it('US1: two visitors may save the same coordinates; one visitor may not twice', async () => {
      await addAs(KEY_A, coords[0]);
      await addAs(KEY_B, coords[0]);
      await visitor(KEY_A).post('/api/locations').send(coords[0]).expect(409);
      expect(await listIds()).toHaveLength(1);
    });

    it('US1: places saved before spec 013 are shown to no one', async () => {
      const { insertUnownedLocationForTest } = await import('../db.js');
      const id = await insertUnownedLocationForTest(1.38, 103.88);
      await addAs(KEY_A);
      expect(await listIds()).not.toContain(id);
      await request(app).get('/api/locations').expect(200, { locations: [] });
      await visitor(KEY_A).get(`/api/locations/${id}`).expect(404, NOT_FOUND);
      await visitor(KEY_A).delete(`/api/locations/${id}`).expect(404, NOT_FOUND);
    });

    it('US1: no response ever contains the visitor key', async () => {
      const a = await addAs(KEY_A);
      const responses = [
        await visitor(KEY_A).get('/api/locations'),
        await visitor(KEY_A).get(`/api/locations/${a.id}`),
        await visitor(KEY_B).delete(`/api/locations/${a.id}`),
        await visitor(KEY_A).post('/api/locations').send(coords[0]),
      ];
      for (const response of responses) expect(response.text).not.toContain(KEY_A);
    });

    it('US2: a visitor keeps their places across a restart, read without a weather call', async () => {
      await addAs(KEY_A, coords[0]);
      await addAs(KEY_A, coords[1]);
      const getCurrentWeather = vi.fn(async () => weather);
      await restartApp({ getCurrentWeather });
      const list = (await visitor(KEY_A).get('/api/locations').expect(200)).body.locations;
      expect(list).toHaveLength(2);
      expect(list[0].weather.condition).toBe('Cloudy');
      expect(getCurrentWeather).not.toHaveBeenCalled();
    });

    it('US2: any use with a known key records it; an unknown key records nothing', async () => {
      const { ensureVisitor } = await import('../visitors.js');
      const { countVisitorsForTest, getVisitorForTest } = await import('../db.js');
      const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const id = await ensureVisitor(KEY_A, longAgo);
      const before = (await getVisitorForTest(id))?.lastUsedAt;

      await visitor(KEY_A).get('/api/locations').expect(200);
      const after = (await getVisitorForTest(id))?.lastUsedAt;
      expect(after! > before!).toBe(true);

      await visitor(KEY_B).get('/api/locations').expect(200);
      await visitor(KEY_B).get('/api/locations/1').expect(404);
      expect(await countVisitorsForTest()).toBe(1);
    });
  });
});
