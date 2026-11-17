import { describe, expect, it } from 'vitest';
import { createFixtureRainClient } from './rainFixture.js';

const NOW = new Date('2026-11-17T00:27:30Z'); // 08:27:30 SGT

function kinds(totals: (number | null)[]) {
  return {
    dry: totals.filter((mm) => mm === 0).length,
    light: totals.filter((mm) => mm !== null && mm > 0 && mm < 0.6).length,
    moderate: totals.filter((mm) => mm !== null && mm >= 0.6 && mm < 2.5).length,
    heavy: totals.filter((mm) => mm !== null && mm >= 2.5).length,
  };
}

describe('createFixtureRainClient', () => {
  it('covers every level, partial and missing stations', async () => {
    const observation = await createFixtureRainClient().getRecentRain(NOW);
    const totals = observation.stations.map((entry) => entry.total_mm);
    const counts = kinds(totals);

    expect(counts.dry).toBeGreaterThanOrEqual(4);
    expect(counts.light).toBeGreaterThanOrEqual(3);
    expect(counts.moderate).toBeGreaterThanOrEqual(3);
    expect(counts.heavy).toBeGreaterThanOrEqual(3);
    expect(observation.stations.filter((entry) => entry.periods_covered === 0)).toHaveLength(2);
    expect(
      observation.stations
        .filter((entry) => entry.periods_covered === 0)
        .every((entry) => entry.total_mm === null),
    ).toBe(true);
    expect(
      observation.stations.filter(
        (entry) => entry.periods_covered === 1 || entry.periods_covered === 2,
      ),
    ).toHaveLength(2);
  });

  it('places stations in Singapore, sorted by id with unique ids', async () => {
    const { stations } = await createFixtureRainClient().getRecentRain(NOW);
    expect(stations.length).toBeGreaterThanOrEqual(20);
    expect(new Set(stations.map((entry) => entry.id)).size).toBe(stations.length);
    expect(stations.map((entry) => entry.id)).toEqual(
      [...stations.map((entry) => entry.id)].sort(),
    );
    for (const entry of stations) {
      expect(entry.latitude).toBeGreaterThan(1.2);
      expect(entry.latitude).toBeLessThan(1.48);
      expect(entry.longitude).toBeGreaterThan(103.6);
      expect(entry.longitude).toBeLessThan(104.05);
    }
  });

  it('ends the window 10 minutes before now, rounded down to 5 minutes, and is not stale', async () => {
    const observation = await createFixtureRainClient().getRecentRain(NOW);
    expect(observation.window_end).toBe('2026-11-17T08:15:00+08:00');
    expect(observation.window_start).toBe('2026-11-17T08:00:00+08:00');
    expect(observation).toMatchObject({
      window_minutes: 15,
      periods_found: 3,
      stale: false,
      fetched_at: NOW.toISOString(),
    });
  });
});
