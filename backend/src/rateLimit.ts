import type { RequestHandler } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Shown to the user as the error text (the frontend displays `detail`). */
  detail: string;
  now?: () => number;
}

/**
 * Fixed-window limit per client address, kept in memory for this instance only. The client
 * address is `request.ip`, so behind a proxy set Express's `trust proxy` (TRUST_PROXY) or every
 * visitor shares one allowance.
 */
export function createRateLimiter({
  windowMs,
  max,
  detail,
  now = Date.now,
}: RateLimitOptions): RequestHandler {
  const windows = new Map<string, { startedAt: number; count: number }>();

  return (request, response, next) => {
    const at = now();
    const key = request.ip ?? 'unknown';
    let entry = windows.get(key);
    if (!entry || at - entry.startedAt >= windowMs) {
      if (windows.size > 10_000) {
        for (const [k, v] of windows) if (at - v.startedAt >= windowMs) windows.delete(k);
      }
      entry = { startedAt: at, count: 0 };
      windows.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      const secondsLeft = Math.ceil((entry.startedAt + windowMs - at) / 1000);
      response.setHeader('Retry-After', String(secondsLeft));
      response.status(429).json({ detail });
      return;
    }
    next();
  };
}
