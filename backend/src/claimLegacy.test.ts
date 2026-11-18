import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { WeatherSnapshot } from './weather.js';

const OWNER_KEY = 'o'.repeat(43);
const OTHER_KEY = 'x'.repeat(43);

describe('claimLegacy (spec 013, owner keeps the pre-feature places)', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'weather-starter-claim-'));
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

  async function seedLegacy() {
    const { insertUnownedLocationForTest } = await import('./db.js');
    const stored = { condition: 'Showers', area: 'Tampines' } as Partial<WeatherSnapshot>;
    const { getDefaultWeatherForTest } = await import('./db.js');
    await insertUnownedLocationForTest(1.35, 103.94, { ...getDefaultWeatherForTest(), ...stored });
    await insertUnownedLocationForTest(1.36, 103.86);
    await insertUnownedLocationForTest(1.37, 103.87);
  }

  it('moves every unowned place to the owner, keeping stored snapshots', async () => {
    await seedLegacy();
    const { claimLegacy } = await import('./claimLegacy.js');
    const { listLocations, countUnownedLocationsForTest } = await import('./db.js');
    const { findVisitor } = await import('./visitors.js');

    expect(await claimLegacy(OWNER_KEY)).toEqual({ claimed: 3, skipped: 0 });

    const ownerId = await findVisitor(OWNER_KEY);
    const owned = await listLocations(ownerId!);
    expect(owned).toHaveLength(3);
    expect(owned.find((l) => l.latitude === 1.35)?.weather).toMatchObject({
      condition: 'Showers',
      area: 'Tampines',
    });
    expect(await countUnownedLocationsForTest()).toBe(0);
  });

  it('is a no-op the second time and gives nothing to anyone else', async () => {
    await seedLegacy();
    const { claimLegacy } = await import('./claimLegacy.js');
    const { ensureVisitor } = await import('./visitors.js');
    const { listLocations } = await import('./db.js');
    await claimLegacy(OWNER_KEY);

    expect(await claimLegacy(OWNER_KEY)).toEqual({ claimed: 0, skipped: 0 });
    expect(await claimLegacy(OTHER_KEY)).toEqual({ claimed: 0, skipped: 0 });
    expect(await listLocations(await ensureVisitor(OTHER_KEY))).toEqual([]);
  });

  it('leaves a place the owner already has unowned instead of failing', async () => {
    await seedLegacy();
    const { claimLegacy } = await import('./claimLegacy.js');
    const { createLocation, countUnownedLocationsForTest } = await import('./db.js');
    const { ensureVisitor } = await import('./visitors.js');
    await createLocation(await ensureVisitor(OWNER_KEY), 1.36, 103.86);

    expect(await claimLegacy(OWNER_KEY)).toEqual({ claimed: 2, skipped: 1 });
    expect(await countUnownedLocationsForTest()).toBe(1);
  });

  it('claims one of two unowned places at the same spot and leaves the other', async () => {
    const { insertUnownedLocationForTest, listLocations, countUnownedLocationsForTest } =
      await import('./db.js');
    await insertUnownedLocationForTest(1.35, 103.85);
    await insertUnownedLocationForTest(1.35, 103.85);
    await insertUnownedLocationForTest(1.36, 103.86);
    const { claimLegacy } = await import('./claimLegacy.js');
    const { findVisitor } = await import('./visitors.js');

    expect(await claimLegacy(OWNER_KEY)).toEqual({ claimed: 2, skipped: 1 });
    expect(await listLocations((await findVisitor(OWNER_KEY))!)).toHaveLength(2);
    expect(await countUnownedLocationsForTest()).toBe(1);
  });

  it('refuses a malformed key before writing anything', async () => {
    await seedLegacy();
    const { claimLegacy } = await import('./claimLegacy.js');
    const { countUnownedLocationsForTest, countVisitorsForTest } = await import('./db.js');

    await expect(claimLegacy('short')).rejects.toThrow(
      'visitor key must be 43 base64url characters',
    );
    expect(await countUnownedLocationsForTest()).toBe(3);
    expect(await countVisitorsForTest()).toBe(0);
  });

  it('marks the owner as just used, so the retention sweep keeps the list', async () => {
    await seedLegacy();
    const { claimLegacy } = await import('./claimLegacy.js');
    const { findVisitor, purgeUnusedVisitors } = await import('./visitors.js');
    const now = new Date('2026-11-17T08:00:00Z');
    await claimLegacy(OWNER_KEY, now);
    expect(await purgeUnusedVisitors(new Date(now.getTime() + 89 * 24 * 3600 * 1000))).toEqual({
      visitors: 0,
      locations: 0,
    });
    expect(await findVisitor(OWNER_KEY)).not.toBeNull();
  });
});
