import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { LightningClient, LightningObservation } from '../lightning.js';
import { createFixtureLightningClient } from '../lightningFixture.js';
import { WeatherProviderError } from '../providerHttp.js';

// Counts ProviderRequester constructions so the test below can check createApp shares one.
const requesterCount = vi.hoisted(() => ({ value: 0 }));
vi.mock('../providerHttp.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../providerHttp.js')>();
  class CountingRequester extends actual.ProviderRequester {
    constructor(...args: ConstructorParameters<typeof actual.ProviderRequester>) {
      super(...args);
      requesterCount.value += 1;
    }
  }
  return { ...actual, ProviderRequester: CountingRequester };
});

const observation: LightningObservation = {
  strikes: [
    {
      id: '2026-11-11T21:38:00+08:00|1.3521|103.8198',
      latitude: 1.3521,
      longitude: 103.8198,
      occurred_at: '2026-11-11T21:38:00+08:00',
      type: 'C',
      label: 'Cloud to Cloud',
    },
  ],
  window_minutes: 60,
  fetched_at: '2026-11-11T13:41:10.000Z',
  provider_updated_at: '2026-11-11T21:42:02+08:00',
  stale: false,
};

describe('lightning API', () => {
  let tempDir: string;

  async function buildApp(lightningClient: LightningClient) {
    const { createApp } = await import('../server.js');
    return createApp({ serveFrontend: false, enableRequestLogging: false, lightningClient });
  }

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'weather-lightning-'));
    process.env.DATABASE_PATH = join(tempDir, 'test.db');
  });

  afterAll(async () => {
    const { closeDatabase } = await import('../db.js');
    closeDatabase();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns the observation window', async () => {
    const app = await buildApp({ getRecentLightning: async () => observation });
    const response = await request(app).post('/api/lightning/refresh');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(observation);
  });

  it('returns an empty strikes array as a normal result', async () => {
    const app = await buildApp({ getRecentLightning: async () => ({ ...observation, strikes: [] }) });
    const response = await request(app).post('/api/lightning/refresh');
    expect(response.status).toBe(200);
    expect(response.body.strikes).toEqual([]);
  });

  it('passes a stale flag through', async () => {
    const app = await buildApp({ getRecentLightning: async () => ({ ...observation, stale: true }) });
    const response = await request(app).post('/api/lightning/refresh');
    expect(response.body.stale).toBe(true);
  });

  it('responds 502 without leaking provider text when data is unavailable', async () => {
    const app = await buildApp({
      getRecentLightning: async () => {
        throw new WeatherProviderError('Weather provider rejected request (check API key)');
      },
    });
    const response = await request(app).post('/api/lightning/refresh');
    expect(response.status).toBe(502);
    expect(response.body).toEqual({ detail: 'Lightning data is currently unavailable' });
  });

  it('does not expose lightning through GET', async () => {
    const app = await buildApp({ getRecentLightning: async () => observation });
    const response = await request(app).get('/api/lightning/refresh');
    expect(response.status).toBe(404);
  });

  it('demo fixture returns strikes aged about 2, 30 and 55 minutes', async () => {
    const now = new Date('2026-11-11T14:00:00Z');
    const result = await createFixtureLightningClient().getRecentLightning(now);
    const ages = result.strikes.map((strike) =>
      Math.round((now.getTime() - Date.parse(strike.occurred_at)) / 60_000),
    );
    expect(ages).toEqual([2, 30, 55]);
  });
  it('sends a Server-Timing total on success', async () => {
    const app = await buildApp({ getRecentLightning: async () => observation });
    const response = await request(app).post('/api/lightning/refresh');
    expect(response.status).toBe(200);
    expect(response.headers['server-timing']).toMatch(/^total;dur=\d+/);
  });

  it('passes through what the client measured', async () => {
    const app = await buildApp({
      getRecentLightning: async (_now, timing) => {
        Object.assign(timing ?? {}, { served: 'fetch', providerMs: 1200, pacingWaitMs: 900, retries: 0, retryWaitMs: 0, requests: 2, pages: 2 });
        return observation;
      },
    });
    const header = (await request(app).post('/api/lightning/refresh')).headers['server-timing'];
    expect(header).toContain('provider;dur=1200;desc="fetch"');
    expect(header).toContain('requests;desc="2"');
  });

  it('sends Server-Timing on a 502 too, with nothing secret in it', async () => {
    const app = await buildApp({
      getRecentLightning: async () => {
        throw new WeatherProviderError('Weather provider rejected request (check API key)');
      },
    });
    const response = await request(app).post('/api/lightning/refresh');
    expect(response.status).toBe(502);
    expect(response.headers['server-timing']).toMatch(/^total;dur=\d+/);
    expect(response.headers['server-timing']).not.toMatch(/http|\?|key/i);
  });

  it('builds one provider requester shared by the default weather and lightning clients', async () => {
    const { createApp } = await import('../server.js');
    requesterCount.value = 0;

    await createApp({ serveFrontend: false, enableRequestLogging: false });

    expect(requesterCount.value).toBe(1);
  });
});
