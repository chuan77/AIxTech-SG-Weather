import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rateLimit.js';

function appWith(limiter: express.RequestHandler) {
  const app = express();
  app.set('trust proxy', 1);
  app.post('/limited', limiter, (_request, response) => {
    response.status(204).end();
  });
  return app;
}

describe('createRateLimiter', () => {
  it('allows max requests per window per client, then answers 429 with Retry-After and a detail', async () => {
    let now = 1_000_000;
    const app = appWith(
      createRateLimiter({ windowMs: 60_000, max: 2, detail: 'Slow down', now: () => now }),
    );
    const from = (ip: string) => request(app).post('/limited').set('x-forwarded-for', ip);

    await from('198.51.100.1').expect(204);
    await from('198.51.100.1').expect(204);
    const blocked = await from('198.51.100.1').expect(429);
    expect(blocked.body).toEqual({ detail: 'Slow down' });
    expect(blocked.headers['retry-after']).toBe('60');

    // Another client has its own allowance.
    await from('198.51.100.2').expect(204);

    // The window ends, so the first client may go again.
    now += 60_000;
    await from('198.51.100.1').expect(204);
  });

  it('rounds Retry-After up to whole seconds left in the window', async () => {
    let now = 0;
    const app = appWith(
      createRateLimiter({ windowMs: 10_000, max: 1, detail: 'x', now: () => now }),
    );
    await request(app).post('/limited').expect(204);
    now = 7_500;
    const blocked = await request(app).post('/limited').expect(429);
    expect(blocked.headers['retry-after']).toBe('3');
  });
});
