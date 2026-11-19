import { describe, expect, it } from 'vitest';
import { createFixtureTempWindClient } from './tempWindFixture.js';

const NOW = new Date('2026-11-19T05:40:30Z'); // 13:40:30 SGT

/** The km/h bands the frontend draws (research R4). */
function level(knots: number): string {
  const kmh = knots * 1.852;
  if (kmh < 2) return 'calm';
  if (kmh < 20) return 'light';
  if (kmh < 39) return 'moderate';
  return 'strong';
}

describe('createFixtureTempWindClient', () => {
  it('covers every wind level and a spread of temperatures', async () => {
    const { stations } = await createFixtureTempWindClient().getIslandConditions(NOW);
    const withWind = stations.filter(
      (entry) => entry.wind_speed_knots !== null && entry.wind_direction_deg !== null,
    );
    const levels = new Set(withWind.map((entry) => level(entry.wind_speed_knots!)));
    expect([...levels].sort()).toEqual(['calm', 'light', 'moderate', 'strong']);

    const temperatures = stations
      .map((entry) => entry.temperature_c)
      .filter((value): value is number => value !== null);
    expect(Math.min(...temperatures)).toBeLessThanOrEqual(26);
    expect(Math.max(...temperatures)).toBeGreaterThanOrEqual(31);
  });

  it('includes wind-only, temperature-only, no-reading and unnamed stations', async () => {
    const { stations } = await createFixtureTempWindClient().getIslandConditions(NOW);
    const windOnly = stations.filter(
      (entry) => entry.temperature_c === null && entry.wind_speed_knots !== null,
    );
    const temperatureOnly = stations.filter(
      (entry) => entry.temperature_c !== null && entry.wind_speed_knots === null,
    );
    const none = stations.filter(
      (entry) =>
        entry.temperature_c === null &&
        entry.wind_speed_knots === null &&
        entry.wind_direction_deg === null,
    );
    expect(windOnly.length).toBeGreaterThanOrEqual(1);
    expect(temperatureOnly.length).toBeGreaterThanOrEqual(1);
    expect(none.length).toBeGreaterThanOrEqual(1);
    expect(stations.find((entry) => entry.id === 'S199')?.name).toBeNull();
    // A speed with no direction (the real client keeps them independently).
    expect(
      stations.some(
        (entry) => entry.wind_speed_knots !== null && entry.wind_direction_deg === null,
      ),
    ).toBe(true);
  });

  it('places about 17 stations in Singapore, sorted by unique id, with plausible values', async () => {
    const { stations } = await createFixtureTempWindClient().getIslandConditions(NOW);
    expect(stations.length).toBeGreaterThanOrEqual(17);
    const ids = stations.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
    for (const entry of stations) {
      expect(entry.latitude).toBeGreaterThan(1.15);
      expect(entry.latitude).toBeLessThan(1.48);
      expect(entry.longitude).toBeGreaterThan(103.6);
      expect(entry.longitude).toBeLessThan(104.1);
      if (entry.temperature_c !== null) {
        expect(entry.temperature_c).toBeGreaterThanOrEqual(10);
        expect(entry.temperature_c).toBeLessThanOrEqual(45);
      }
      if (entry.wind_direction_deg !== null) {
        expect(entry.wind_direction_deg).toBeGreaterThanOrEqual(0);
        expect(entry.wind_direction_deg).toBeLessThan(360);
      }
    }
  });

  it('reports both measures loaded, about 6 minutes old and not stale', async () => {
    const observation = await createFixtureTempWindClient().getIslandConditions(NOW);
    expect(observation.measures).toEqual({ temperature: 'ok', wind: 'ok' });
    expect(observation.stale).toBe(false);
    expect(observation.fetched_at).toBe(NOW.toISOString());
    expect(observation.temperature_at).toBe('2026-11-19T13:34:00+08:00');
    expect(observation.wind_at).toBe('2026-11-19T13:34:00+08:00');
  });
});
