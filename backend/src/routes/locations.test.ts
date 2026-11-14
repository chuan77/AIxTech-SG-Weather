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

const coords = [
  { latitude: 1.35, longitude: 103.85 },
  { latitude: 1.36, longitude: 103.86 },
  { latitude: 1.37, longitude: 103.87 },
];

describe('locations API', () => {
  let tempDir: string;
  let app: Awaited<ReturnType<typeof import('../server.js').createApp>>;

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
      await request(app).post('/api/locations').send(body).expect(201);
    }
  }

  const listIds = async () =>
    (await request(app).get('/api/locations').expect(200)).body.locations.map(
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
    const response = await request(app)
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
      },
    });

    const listResponse = await request(app).get('/api/locations').expect(200);
    expect(listResponse.body.locations).toHaveLength(1);
    expect(listResponse.body.locations[0].weather).toMatchObject({
      condition: 'Cloudy',
      temperature_c: 29,
      humidity_percent: 80,
      rainfall_mm: 0,
      wind_speed_knots: 4,
      wind_direction_degrees: 180,
      uv_index: 7,
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
    const created = await request(app).post('/api/locations').send(coords[0]).expect(201);
    const refreshed = await request(app)
      .post(`/api/locations/${created.body.id}/refresh`)
      .expect(200);

    expect(refreshed.body.weather).toMatchObject({
      wbgt_c: 28.1,
      heat_stress_level: 'Moderate',
      wbgt_station_name: 'Bishan Street',
      wbgt_station_distance_km: 0.4,
      wbgt_observed_at: '2026-11-01T10:05:00+08:00',
    });
  });

  it('deletes a location and returns 404 when it does not exist', async () => {
    const first = await request(app)
      .post('/api/locations')
      .send({ latitude: 1.35, longitude: 103.85 })
      .expect(201);
    const second = await request(app)
      .post('/api/locations')
      .send({ latitude: 1.36, longitude: 103.86 })
      .expect(201);

    await request(app).delete(`/api/locations/${first.body.id}`).expect(204);
    await request(app).delete(`/api/locations/${first.body.id}`).expect(404);

    const listResponse = await request(app).get('/api/locations').expect(200);
    expect(listResponse.body.locations.map((location: { id: number }) => location.id)).toEqual([
      second.body.id,
    ]);
  });

  it('US1: rejects a duplicate coordinate pair with 409', async () => {
    await request(app).post('/api/locations').send(coords[0]).expect(201);
    const response = await request(app).post('/api/locations').send(coords[0]).expect(409);

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
      const response = await request(app).post('/api/locations').send(body).expect(422);
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
      const response = await request(app).post('/api/locations').send(coords[index]).expect(201);
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
      request(app).post('/api/locations').send(coords[0]),
      request(app).post('/api/locations').send(coords[0]),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await listIds()).toHaveLength(1);
  });

  it('US1: createLocation throws DuplicateLocationError for an existing pair', async () => {
    const { createLocation } = await import('../db.js');
    await createLocation(1.35, 103.85);

    await expect(createLocation(1.35, 103.85)).rejects.toMatchObject({
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

    const { body } = await request(app).get('/api/locations').expect(200);
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
    const { body } = await request(app).get('/api/locations').expect(200);
    expect(body).toEqual({ locations: [] });
  });

  it('US3: a deleted location does not return after restart', async () => {
    await addAll(3);
    await request(app).delete('/api/locations/2').expect(204);

    await restartApp();

    expect(await listIds()).toEqual([3, 1]);
    await request(app).get('/api/locations/2').expect(404);
  });

  it('US3: repeated restarts give an identical list', async () => {
    await addAll(3);
    const snapshot = (await request(app).get('/api/locations').expect(200)).body;

    for (let i = 0; i < 5; i += 1) {
      await restartApp();
      const { body } = await request(app).get('/api/locations').expect(200);
      expect(body).toEqual(snapshot);
    }
  });

  it('US3: a failed refresh does not alter the stored snapshot', async () => {
    await addAll(1);
    const before = (await request(app).get('/api/locations').expect(200)).body;

    await restartApp();
    const { WeatherProviderError } = await import('../weather.js');
    app = await buildApp({
      async getCurrentWeather() {
        throw new WeatherProviderError('down');
      },
    });

    await request(app).post('/api/locations/1/refresh').expect(502);
    const after = (await request(app).get('/api/locations').expect(200)).body;
    expect(after).toEqual(before);
  });
});
