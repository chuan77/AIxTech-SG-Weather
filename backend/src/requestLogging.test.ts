import express from 'express';
import { Writable } from 'node:stream';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createRequestLogger } from './requestLogging.js';

function captureLogs() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(...chunk.toString().split('\n').filter(Boolean));
      callback();
    },
  });
  return { logger: pino(stream), lines };
}

describe('createRequestLogger', () => {
  it('logs method, path, status and time, but no headers or client address', async () => {
    const { logger, lines } = captureLogs();
    const app = express();
    app.use(createRequestLogger(logger));
    app.get('/health', (_request, response) => {
      response.json({ status: 'healthy' });
    });

    await request(app)
      .get('/health')
      .set('x-vercel-protection-bypass', 'BYPASS-SENTINEL')
      .set('x-vercel-ip-postal-code', 'POSTCODE-SENTINEL')
      .set('x-forwarded-for', '203.0.113.9')
      .set('authorization', 'Bearer TOKEN-SENTINEL')
      .expect(200);

    const completed = lines
      .map((line) => JSON.parse(line))
      .find((entry) => entry.msg === 'request completed');
    expect(completed).toBeDefined();
    expect(completed.req).toMatchObject({ method: 'GET', url: '/health' });
    expect(completed.res).toEqual({ statusCode: 200 });
    expect(typeof completed.responseTime).toBe('number');

    const raw = lines.join('\n');
    for (const leaked of ['SENTINEL', '203.0.113.9', 'headers', 'remoteAddress']) {
      expect(raw).not.toContain(leaked);
    }
  });
});
