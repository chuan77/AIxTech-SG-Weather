import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// The page routes (spec 016, Principle VI): GET /, /index.html and the SPA fallback send the
// built index.html with its runtime metas. A fixture dist and an injected uptime stand in for
// frontend/dist and process.uptime(), so the cold/warm choice is tested through Express.

const fixture = '<!doctype html><html><head><title>Weather</title></head><body></body></html>';

describe('page routes', () => {
  let tempDir: string;
  let frontendDist: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'weather-starter-pages-'));
    process.env.DATABASE_PATH = join(tempDir, 'weather.db');
    process.env.LOG_LEVEL = 'silent';
    frontendDist = join(tempDir, 'dist');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(frontendDist);
    await writeFile(join(frontendDist, 'index.html'), fixture);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    const { closeDatabase } = await import('./db.js');
    closeDatabase();
    await rm(tempDir, { recursive: true, force: true });
  });

  async function appAt(uptimeSeconds: number) {
    const { createApp } = await import('./server.js');
    return createApp({
      serveFrontend: true,
      enableRequestLogging: false,
      frontendDist,
      uptime: () => uptimeSeconds,
    });
  }

  it('labels a page cold while the instance is under 10 seconds old', async () => {
    vi.stubEnv('SPEED_INSIGHTS', 'on');
    const app = await appAt(3);
    for (const path of ['/', '/index.html', '/some/deep/path']) {
      const response = await request(app).get(path);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.text).toContain('<meta name="speed-insights" content="measure" />');
      expect(response.text).toContain('<meta name="speed-insights-visit" content="cold" />');
    }
  });

  it('labels a page warm from 10 seconds on', async () => {
    vi.stubEnv('SPEED_INSIGHTS', 'on');
    for (const uptime of [10, 600]) {
      const app = await appAt(uptime);
      for (const path of ['/', '/index.html', '/some/deep/path']) {
        const response = await request(app).get(path);
        expect(response.text).toContain('<meta name="speed-insights-visit" content="warm" />');
        expect(response.text).not.toContain('content="cold"');
      }
    }
  });

  it('adds no speed insights metas when SPEED_INSIGHTS=off', async () => {
    vi.stubEnv('SPEED_INSIGHTS', 'off');
    const app = await appAt(3);
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.text).not.toContain('speed-insights');
  });

  it('keeps visit counting as it was (FR-016)', async () => {
    vi.stubEnv('WEB_ANALYTICS', 'on');
    vi.stubEnv('SPEED_INSIGHTS', 'off');
    const app = await appAt(3);
    const response = await request(app).get('/some/deep/path');
    expect(response.text).toContain('<meta name="web-analytics" content="measure" />');
    expect(response.text).not.toContain('speed-insights');
  });
});
