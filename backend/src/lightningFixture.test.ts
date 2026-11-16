import { describe, expect, it } from 'vitest';
import { createBusyLightningClient, createStormLightningClient } from './lightningFixture.js';

const NOW = new Date('2026-11-11T14:00:00Z');

describe('createStormLightningClient', () => {
  it('replays the 2026-11-16 storm: 37,242 strikes inside the last hour, newest first', async () => {
    const observation = await createStormLightningClient().getRecentLightning(NOW);
    const { strikes } = observation;

    expect(strikes).toHaveLength(37_242);
    expect(observation.window_minutes).toBe(60);
    expect(observation.stale).toBe(false);
    expect(observation.fetched_at).toBe(NOW.toISOString());

    let previous = Number.POSITIVE_INFINITY;
    for (const strike of strikes) {
      const occurred = Date.parse(strike.occurred_at);
      expect(occurred).toBeGreaterThanOrEqual(NOW.getTime() - 60 * 60_000);
      expect(occurred).toBeLessThanOrEqual(NOW.getTime() + 5 * 60_000);
      expect(occurred).toBeLessThanOrEqual(previous);
      previous = occurred;
      expect(strike.id).toBe(`${strike.occurred_at}|${strike.latitude}|${strike.longitude}`);
    }
    expect(new Set(strikes.map((strike) => strike.id)).size).toBe(strikes.length);
  });

  it('is deterministic for the same moment', async () => {
    const client = createStormLightningClient();
    const first = await client.getRecentLightning(NOW);
    const second = await client.getRecentLightning(NOW);
    expect(second).toEqual(first);
  });
});

describe('createBusyLightningClient', () => {
  it('serves a busy-day window of strikes, all inside the last hour', async () => {
    const { strikes } = await createBusyLightningClient().getRecentLightning(NOW);
    expect(strikes.length).toBeGreaterThanOrEqual(350);
    expect(strikes.length).toBeLessThanOrEqual(400);
    for (const strike of strikes) {
      const age = NOW.getTime() - Date.parse(strike.occurred_at);
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(60 * 60_000);
    }
  });

  it('is deterministic for the same moment', async () => {
    const client = createBusyLightningClient();
    const first = await client.getRecentLightning(NOW);
    const second = await client.getRecentLightning(NOW);
    expect(second.strikes.map((s) => [s.latitude, s.longitude])).toEqual(
      first.strikes.map((s) => [s.latitude, s.longitude]),
    );
  });
});
