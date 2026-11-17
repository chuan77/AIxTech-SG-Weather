import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WeatherProviderError } from '../providerHttp.js';
import type { IslandRainObservation, RainClient } from '../rain.js';
import type { WeatherClient } from './locations.js';

const observation: IslandRainObservation = {
  stations: [
    {
      id: 'S111',
      name: 'Scotts Road',
      latitude: 1.31055,
      longitude: 103.8365,
      total_mm: 1.4,
      periods_covered: 3,
    },
    {
      id: 'S43',
      name: 'Kim Chuan Road',
      latitude: 1.3399,
      longitude: 103.8878,
      total_mm: 0.2,
      periods_covered: 2,
    },
    {
      id: 'S900',
      name: 'Example Station',
      latitude: 1.35,
      longitude: 103.7,
      total_mm: null,
      periods_covered: 0,
    },
  ],
  window_minutes: 15,
  window_start: '2026-11-17T08:00:00+08:00',
  window_end: '2026-11-17T08:15:00+08:00',
  periods_found: 3,
  fetched_at: '2026-11-17T00:24:12.000Z',
  stale: false,
};

// Any weather call from the rain route would be a bug: this client fails loudly.
const failingWeatherClient = new Proxy({} as WeatherClient, {
  get: () => () => {
    throw new Error('the rain route must not use the weather client');
  },
});

describe('rain API', () => {
  let tempDir: string;

  async function buildApp(rainClient: RainClient) {
    const { createApp } = await import('../server.js');
    return createApp({
      serveFrontend: false,
      enableRequestLogging: false,
      weatherClient: failingWeatherClient,
      rainClient,
    });
  }

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'weather-rain-'));
    process.env.DATABASE_PATH = join(tempDir, 'test.db');
  });

  afterAll(async () => {
    const { closeDatabase } = await import('../db.js');
    closeDatabase();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns the island rain observation', async () => {
    const app = await buildApp({ getRecentRain: async () => observation });
    const response = await request(app).post('/api/rain/refresh');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(observation);
  });

  it('passes a stale flag through as a normal 200', async () => {
    const app = await buildApp({ getRecentRain: async () => ({ ...observation, stale: true }) });
    const response = await request(app).post('/api/rain/refresh');
    expect(response.status).toBe(200);
    expect(response.body.stale).toBe(true);
  });

  it('responds 502 with a fixed message and no provider text when data is unavailable', async () => {
    const app = await buildApp({
      getRecentRain: async () => {
        throw new WeatherProviderError('Weather provider rejected request (check API key)');
      },
    });
    const response = await request(app).post('/api/rain/refresh');
    expect(response.status).toBe(502);
    expect(response.body).toEqual({ detail: 'Rain data is currently unavailable' });
    expect(JSON.stringify(response.body)).not.toMatch(/API key|provider/i);
    expect(response.headers['server-timing']).toMatch(/^total;dur=\d+/);
  });

  it('sends a Server-Timing header with what the client measured', async () => {
    const app = await buildApp({
      getRecentRain: async (_now, timing) => {
        Object.assign(timing ?? {}, {
          served: 'fetch',
          providerMs: 70,
          pacingWaitMs: 884,
          requests: 1,
          pages: 1,
        });
        return observation;
      },
    });
    const response = await request(app).post('/api/rain/refresh');
    expect(response.headers['server-timing']).toMatch(/^total;dur=\d+/);
    expect(response.headers['server-timing']).toContain('provider;dur=70;desc="fetch"');
    expect(response.headers['server-timing']).toContain('requests;desc="1"');
  });

  it('does not expose rain through GET', async () => {
    const app = await buildApp({ getRecentRain: async () => observation });
    const response = await request(app).get('/api/rain/refresh');
    expect(response.status).toBe(404);
  });

  it('writes nothing to the saved locations', async () => {
    const app = await buildApp({ getRecentRain: async () => observation });
    await request(app).post('/api/rain/refresh');
    const locations = await request(app).get('/api/locations');
    expect(locations.status).toBe(200);
    expect(locations.body).toEqual({ locations: [] });
  });
});
