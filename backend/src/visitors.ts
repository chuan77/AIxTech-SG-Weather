import { createHash } from 'node:crypto';
import {
  ensureVisitorByHash,
  findVisitorByHash,
  purgeVisitorsUnusedSince,
  touchVisitorRow,
} from './db.js';
import { logger } from './logger.js';
import { isVisitorKey } from './visitorKeyFormat.js';

export { isVisitorKey } from './visitorKeyFormat.js';

/**
 * Per-visitor saved locations (spec 013). Each browser holds a random 43-character key (32 bytes,
 * base64url) and sends it only in the `X-Visitor-Key` header: a custom header can't be sent
 * cross-site without a CORS preflight, which this same-origin app never answers, so other sites
 * can't act with it. The server stores only the key's SHA-256. Never log a key or its hash.
 */
export const VISITOR_KEY_HEADER = 'x-visitor-key';
const HOUR_MS = 60 * 60 * 1000;
export const RETENTION_MS = 90 * 24 * HOUR_MS;
export const SWEEP_INTERVAL_MS = 6 * HOUR_MS;

export function hashVisitorKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** The request's visitor key, or null when it is missing, repeated or malformed. */
export function visitorKeyFrom(request: {
  headers: Record<string, string | string[] | undefined>;
}): string | null {
  const value = request.headers[VISITOR_KEY_HEADER];
  return isVisitorKey(value) ? value : null;
}

export function findVisitor(key: string): Promise<number | null> {
  return findVisitorByHash(hashVisitorKey(key));
}

export function ensureVisitor(key: string, now: Date = new Date()): Promise<number> {
  return ensureVisitorByHash(hashVisitorKey(key), now);
}

/** Records a use for retention; writes at most once an hour per visitor. */
export function touchVisitor(id: number, now: Date = new Date()): Promise<void> {
  return touchVisitorRow(id, now, new Date(now.getTime() - HOUR_MS));
}

/** Deletes lists unused for more than 90 days, with their places (FR-012). */
export function purgeUnusedVisitors(
  now: Date = new Date(),
): Promise<{ visitors: number; locations: number }> {
  return purgeVisitorsUnusedSince(new Date(now.getTime() - RETENTION_MS));
}

interface SweepOptions {
  intervalMs: number;
  now: () => number;
  purge: () => Promise<{ visitors: number; locations: number }>;
}

/**
 * Runs the retention sweep at most once per interval, one at a time. `maybeSweep` never rejects:
 * a failure is logged (counts and error only) and retried in the next window.
 */
export function createSweepScheduler({ intervalMs, now, purge }: SweepOptions) {
  let lastStarted: number | null = null;
  let running: Promise<void> | null = null;

  return {
    maybeSweep(): Promise<void> {
      if (running) return running;
      if (lastStarted !== null && now() - lastStarted < intervalMs) return Promise.resolve();
      lastStarted = now();
      running = purge()
        .then((removed) => {
          if (removed.visitors > 0) logger.info(removed, 'visitor retention sweep');
        })
        .catch((error: unknown) => {
          logger.warn({ err: error }, 'visitor retention sweep failed');
        })
        .finally(() => {
          running = null;
        });
      return running;
    },
  };
}

export const retentionSweep = createSweepScheduler({
  intervalMs: SWEEP_INTERVAL_MS,
  now: () => Date.now(),
  purge: () => purgeUnusedVisitors(),
});
