import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY_A = 'a'.repeat(43);
const KEY_B = 'b'.repeat(43);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const T0 = new Date('2026-11-17T08:00:00Z');

describe('visitor keys', () => {
  it('accepts exactly 43 base64url characters', async () => {
    const { isVisitorKey } = await import('./visitors.js');
    expect(isVisitorKey(KEY_A)).toBe(true);
    expect(isVisitorKey('Ab0_-'.repeat(8) + 'xyz')).toBe(true);
    for (const bad of [
      'a'.repeat(42),
      'a'.repeat(44),
      'a'.repeat(42) + '+',
      'a'.repeat(42) + '/',
      'a'.repeat(42) + '=',
      '',
      undefined,
      null,
      43,
      ['a'.repeat(43)],
    ]) {
      expect(isVisitorKey(bad)).toBe(false);
    }
  });

  it('hashes a key to 64 lowercase hex characters, deterministically', async () => {
    const { hashVisitorKey } = await import('./visitors.js');
    const hash = hashVisitorKey(KEY_A);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashVisitorKey(KEY_A)).toBe(hash);
    expect(hashVisitorKey(KEY_B)).not.toBe(hash);
  });

  it('reads a valid key from the X-Visitor-Key header only', async () => {
    const { visitorKeyFrom } = await import('./visitors.js');
    const withHeader = (value: string | string[] | undefined) => ({
      headers: value === undefined ? {} : { 'x-visitor-key': value },
    });
    expect(visitorKeyFrom(withHeader(KEY_A))).toBe(KEY_A);
    expect(visitorKeyFrom(withHeader(undefined))).toBeNull();
    expect(visitorKeyFrom(withHeader('short'))).toBeNull();
    expect(visitorKeyFrom(withHeader([KEY_A, KEY_B]))).toBeNull();
  });
});

describe('visitor records', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'weather-starter-visitors-'));
    process.env.DATABASE_PATH = join(tempDir, 'weather.db');
    process.env.LOG_LEVEL = 'silent';
  });

  beforeEach(async () => {
    const { resetStore } = await import('./db.js');
    await resetStore();
  });

  afterAll(async () => {
    const { closeDatabase } = await import('./db.js');
    closeDatabase();
    await rm(tempDir, { recursive: true, force: true });
  });

  async function lastUsed(id: number) {
    const { getVisitorForTest } = await import('./db.js');
    return (await getVisitorForTest(id))?.lastUsedAt;
  }

  it('finds no visitor for an unknown key and creates nothing', async () => {
    const { findVisitor } = await import('./visitors.js');
    const { countVisitorsForTest } = await import('./db.js');
    expect(await findVisitor(KEY_A)).toBeNull();
    expect(await countVisitorsForTest()).toBe(0);
  });

  it('creates a visitor once and returns the same id again', async () => {
    const { ensureVisitor, findVisitor } = await import('./visitors.js');
    const id = await ensureVisitor(KEY_A, T0);
    expect(await ensureVisitor(KEY_A, T0)).toBe(id);
    expect(await findVisitor(KEY_A)).toBe(id);
    expect(await ensureVisitor(KEY_B, T0)).not.toBe(id);
    expect(await lastUsed(id)).toBe('2026-11-17T08:00:00');
  });

  it('bumps last use only when it is more than an hour old', async () => {
    const { ensureVisitor, touchVisitor } = await import('./visitors.js');
    const id = await ensureVisitor(KEY_A, T0);
    await touchVisitor(id, new Date(T0.getTime() + 59 * 60 * 1000));
    expect(await lastUsed(id)).toBe('2026-11-17T08:00:00');
    await touchVisitor(id, new Date(T0.getTime() + HOUR + 1000));
    expect(await lastUsed(id)).toBe('2026-11-17T09:00:01');
  });

  describe('retention sweep', () => {
    it('removes visitors unused for more than 90 days with their places, and nothing else', async () => {
      const { ensureVisitor, purgeUnusedVisitors } = await import('./visitors.js');
      const { createLocation, insertUnownedLocationForTest, listLocations } =
        await import('./db.js');
      const old = await ensureVisitor(KEY_A, new Date(T0.getTime() - 90 * DAY - 1000));
      const recent = await ensureVisitor(KEY_B, new Date(T0.getTime() - 89 * DAY));
      await createLocation(old, 1.35, 103.85);
      await createLocation(old, 1.36, 103.86);
      await createLocation(recent, 1.35, 103.85);
      await insertUnownedLocationForTest(1.37, 103.87);

      expect(await purgeUnusedVisitors(T0)).toEqual({ visitors: 1, locations: 2 });

      expect(await listLocations(old)).toEqual([]);
      expect(await listLocations(recent)).toHaveLength(1);
      const { countUnownedLocationsForTest, countVisitorsForTest } = await import('./db.js');
      expect(await countUnownedLocationsForTest()).toBe(1);
      expect(await countVisitorsForTest()).toBe(1);
    });

    it('removes nothing when every list is in use', async () => {
      const { ensureVisitor, purgeUnusedVisitors } = await import('./visitors.js');
      await ensureVisitor(KEY_A, T0);
      expect(await purgeUnusedVisitors(T0)).toEqual({ visitors: 0, locations: 0 });
    });
  });
});

describe('sweep scheduler', () => {
  it('sweeps on the first call, then not again until the interval has passed', async () => {
    const { createSweepScheduler } = await import('./visitors.js');
    let now = 0;
    const purge = vi.fn(async () => ({ visitors: 0, locations: 0 }));
    const scheduler = createSweepScheduler({ intervalMs: 6 * HOUR, now: () => now, purge });

    await scheduler.maybeSweep();
    expect(purge).toHaveBeenCalledTimes(1);
    now = 6 * HOUR - 1;
    await scheduler.maybeSweep();
    expect(purge).toHaveBeenCalledTimes(1);
    now = 6 * HOUR;
    await scheduler.maybeSweep();
    expect(purge).toHaveBeenCalledTimes(2);
  });

  it('never runs two sweeps at once', async () => {
    const { createSweepScheduler } = await import('./visitors.js');
    let release: () => void = () => {};
    const purge = vi.fn(
      () =>
        new Promise<{ visitors: number; locations: number }>((resolve) => {
          release = () => resolve({ visitors: 0, locations: 0 });
        }),
    );
    const scheduler = createSweepScheduler({ intervalMs: 0, now: () => 0, purge });
    const first = scheduler.maybeSweep();
    const second = scheduler.maybeSweep();
    expect(purge).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    expect(purge).toHaveBeenCalledTimes(1);
  });

  it('survives a failed sweep and tries again in the next window', async () => {
    const { createSweepScheduler } = await import('./visitors.js');
    let now = 0;
    const purge = vi
      .fn<() => Promise<{ visitors: number; locations: number }>>()
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValue({ visitors: 0, locations: 0 });
    const scheduler = createSweepScheduler({ intervalMs: 6 * HOUR, now: () => now, purge });

    await expect(scheduler.maybeSweep()).resolves.toBeUndefined();
    now = 6 * HOUR;
    await scheduler.maybeSweep();
    expect(purge).toHaveBeenCalledTimes(2);
  });
});
