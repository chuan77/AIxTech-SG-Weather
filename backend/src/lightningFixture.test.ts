import { describe, expect, it } from 'vitest';
import { createBusyLightningClient } from './lightningFixture.js';

const NOW = new Date('2026-11-11T14:00:00Z');

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
