import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WeatherProviderError } from '../providerHttp.js';
import type { IslandConditionsObservation, TempWindClient } from '../tempWind.js';
import type { WeatherClient } from './locations.js';

const observation: IslandConditionsObservation = {
  stations: [
    {
      id: 'S108',
      name: 'Marina Barrage',
      latitude: 1.2799,
      longitude: 103.8703,
      temperature_c: null,
      wind_speed_knots: 8.2,
      wind_direction_deg: 230,
    },
    {
      id: 'S109',
      name: 'Ang Mo Kio Avenue 5',
      latitude: 1.3793,
      longitude: 103.85,
      temperature_c: 26.6,
      wind_speed_knots: 8.2,
      wind_direction_deg: 253,
    },
    {
      id: 'S199',
      name: null,
      latitude: 1.33,
      longitude: 103.75,
      temperature_c: null,
      wind_speed_knots: 5.4,
      wind_direction_deg: 241,
    },
    {
      id: 'S24',
      name: 'Changi Meteorological Station',
      latitude: 1.3678,
      longitude: 103.9823,
      temperature_c: 27.9,
      wind_speed_knots: null,
      wind_direction_deg: null,
    },
  ],
  measures: { temperature: 'ok', wind: 'ok' },
  temperature_at: '2026-11-19T13:33:00+08:00',
  wind_at: '2026-11-19T13:34:00+08:00',
  fetched_at: '2026-11-19T05:40:12.000Z',
  stale: false,
};

// Any weather call from this route would be a bug: this client fails loudly.
const failingWeatherClient = new Proxy({} as WeatherClient, {
  get: () => () => {
    throw new Error('the temp-wind route must not use the weather client');
  },
});

const unavailable: TempWindClient = {
  getIslandConditions: async () => {
    throw new WeatherProviderError('Weather provider rejected request (check API key)');
  },
};

describe('temperature and wind API', () => {
  let tempDir: string;

  async function buildApp(tempWindClient: TempWindClient) {
    const { createApp } = await import('../server.js');
    return createApp({
      serveFrontend: false,
      enableRequestLogging: false,
      weatherClient: failingWeatherClient,
      tempWindClient,
    });
  }

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'weather-temp-wind-'));
    process.env.DATABASE_PATH = join(tempDir, 'test.db');
  });

  afterAll(async () => {
    const { closeDatabase } = await import('../db.js');
    closeDatabase();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns the island conditions observation', async () => {
    const app = await buildApp({ getIslandConditions: async () => observation });
    const response = await request(app).post('/api/temp-wind/refresh');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(observation);
  });

  it('returns 200 when one measure is unavailable', async () => {
    const partial: IslandConditionsObservation = {
      ...observation,
      measures: { temperature: 'unavailable', wind: 'ok' },
      temperature_at: null,
      stations: observation.stations.map((entry) => ({ ...entry, temperature_c: null })),
    };
    const app = await buildApp({ getIslandConditions: async () => partial });
    const response = await request(app).post('/api/temp-wind/refresh');
    expect(response.status).toBe(200);
    expect(response.body.measures).toEqual({ temperature: 'unavailable', wind: 'ok' });
  });

  it('passes a stale flag through as a normal 200', async () => {
    const app = await buildApp({
      getIslandConditions: async () => ({ ...observation, stale: true }),
    });
    const response = await request(app).post('/api/temp-wind/refresh');
    expect(response.status).toBe(200);
    expect(response.body.stale).toBe(true);
  });

  it('responds 502 with a fixed message and no provider text when data is unavailable', async () => {
    const app = await buildApp(unavailable);
    const response = await request(app).post('/api/temp-wind/refresh');
    expect(response.status).toBe(502);
    expect(response.body).toEqual({ detail: 'Temperature and wind data is currently unavailable' });
    expect(JSON.stringify(response.body)).not.toMatch(/API key|provider|data\.gov/i);
    expect(response.headers['server-timing']).toMatch(/^total;dur=\d+/);
  });

  it('sends a Server-Timing header with what the client measured', async () => {
    const app = await buildApp({
      getIslandConditions: async (_now, timing) => {
        Object.assign(timing ?? {}, {
          served: 'fetch',
          providerMs: 210,
          pacingWaitMs: 1768,
          requests: 3,
        });
        return observation;
      },
    });
    const response = await request(app).post('/api/temp-wind/refresh');
    expect(response.headers['server-timing']).toMatch(/^total;dur=\d+/);
    expect(response.headers['server-timing']).toContain('provider;dur=210;desc="fetch"');
    expect(response.headers['server-timing']).toContain('requests;desc="3"');
  });

  it('does not expose the readings through GET', async () => {
    const app = await buildApp({ getIslandConditions: async () => observation });
    const response = await request(app).get('/api/temp-wind/refresh');
    expect(response.status).toBe(404);
  });

  it('writes nothing to the saved locations, and they keep working when it fails', async () => {
    const app = await buildApp(unavailable);
    await request(app).post('/api/temp-wind/refresh');
    const locations = await request(app).get('/api/locations');
    expect(locations.status).toBe(200);
    expect(locations.body).toEqual({ locations: [] });
  });
});
