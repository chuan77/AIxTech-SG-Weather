import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { WeatherClient } from './routes/locations.js';
import type { WeatherSnapshot } from './weather.js';

// The public URL lets anyone call the routes that spend the data.gov.sg key, and the log route.
// The container image turns these on with RATE_LIMITS=on; here they are switched on explicitly.

let calls = 0;
const countingClient: WeatherClient = {
  async getCurrentWeather() {
    calls += 1;
    return {
      condition: 'Cloudy',
      forecast_periods: [],
      daily_forecast: [],
    } as unknown as WeatherSnapshot;
  },
};

describe('public limits', () => {
  let tempDir: string;
  let app: Awaited<ReturnType<typeof import('./server.js').createApp>>;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'weather-starter-limits-'));
    process.env.DATABASE_PATH = join(tempDir, 'weather.db');
    process.env.LOG_LEVEL = 'silent';
  });

  beforeEach(async () => {
    const { resetStore } = await import('./db.js');
    await resetStore();
    calls = 0;
    const { createApp } = await import('./server.js');
    app = await createApp({
      serveFrontend: false,
      enableRequestLogging: false,
      enableRateLimits: true,
      trustProxyHops: 1,
      weatherClient: countingClient,
    });
  });

  afterAll(async () => {
    const { closeDatabase } = await import('./db.js');
    closeDatabase();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('allows 30 weather fetches (adds and refreshes together) per device per 10 minutes', async () => {
    const device = '198.51.100.7';
    const created = await request(app)
      .post('/api/locations')
      .set('x-forwarded-for', device)
      .send({ latitude: 1.35, longitude: 103.85 })
      .expect(201);
    for (let i = 0; i < 29; i += 1) {
      await request(app)
        .post(`/api/locations/${created.body.id}/refresh`)
        .set('x-forwarded-for', device)
        .expect(200);
    }
    expect(calls).toBe(30);

    const blocked = await request(app)
      .post(`/api/locations/${created.body.id}/refresh`)
      .set('x-forwarded-for', device)
      .expect(429);
    expect(blocked.body.detail).toMatch(/too many weather updates/i);
    expect(blocked.headers['retry-after']).toBeDefined();
    await request(app)
      .post('/api/locations')
      .set('x-forwarded-for', device)
      .send({ latitude: 1.36, longitude: 103.86 })
      .expect(429);
    expect(calls).toBe(30);

    // Another device is unaffected, and reading the list is never limited.
    await request(app)
      .post(`/api/locations/${created.body.id}/refresh`)
      .set('x-forwarded-for', '198.51.100.8')
      .expect(200);
    await request(app).get('/api/locations').set('x-forwarded-for', device).expect(200);
  });

  it('rejects log metadata over 2 KB', async () => {
    await request(app)
      .post('/api/logs')
      .send({ event: 'ui.click', metadata: { note: 'x'.repeat(2100) } })
      .expect(413);
    await request(app)
      .post('/api/logs')
      .send({ event: 'ui.click', metadata: { note: 'x'.repeat(100) } })
      .expect(204);
  });

  it('allows 60 log events per device per minute', async () => {
    for (let i = 0; i < 60; i += 1) {
      await request(app)
        .post('/api/logs')
        .set('x-forwarded-for', '198.51.100.9')
        .send({ event: 'ui.click' })
        .expect(204);
    }
    await request(app)
      .post('/api/logs')
      .set('x-forwarded-for', '198.51.100.9')
      .send({ event: 'ui.click' })
      .expect(429);
  });
});
