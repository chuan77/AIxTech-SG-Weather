import {
  LIGHTNING_WINDOW_MINUTES,
  normaliseStrikes,
  type LightningClient,
  type LightningObservation,
  type LightningRecord,
} from './lightning.js';

const DEMO_STRIKES = [
  { minutesAgo: 2, latitude: 1.3521, longitude: 103.8198 },
  { minutesAgo: 30, latitude: 1.3, longitude: 103.85 },
  { minutesAgo: 55, latitude: 1.4, longitude: 103.75 },
];

/** Dev-only client (LIGHTNING_FIXTURE=demo): three strikes aged 2, 30 and 55 minutes at call time. */
export function createFixtureLightningClient(): LightningClient {
  return {
    async getRecentLightning(now = new Date()): Promise<LightningObservation> {
      const records: LightningRecord[] = DEMO_STRIKES.map((strike) => {
        const datetime = new Date(now.getTime() - strike.minutesAgo * 60_000).toISOString();
        return {
          datetime,
          updatedTimestamp: now.toISOString(),
          item: {
            readings: [
              {
                location: {
                  latitude: String(strike.latitude),
                  longitude: String(strike.longitude),
                },
                type: 'C',
                text: 'Cloud to Cloud',
                datetime,
              },
            ],
          },
        };
      });
      return {
        strikes: normaliseStrikes(records, now),
        window_minutes: LIGHTNING_WINDOW_MINUTES,
        fetched_at: now.toISOString(),
        provider_updated_at: now.toISOString(),
        stale: false,
      };
    },
  };
}

const BUSY_STRIKE_COUNT = 370;
const BUSY_NEAR_DUPLICATES = 6;

/** Deterministic 0..1 sequence (mulberry32), so the busy map looks the same on every run. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Dev-only client (LIGHTNING_FIXTURE=busy): about 370 strikes across the region and the hour, like
 * the busiest window seen (2026-11-12), with a few near-duplicate pairs so overlaps can be checked.
 */
export function createBusyLightningClient(): LightningClient {
  return {
    async getRecentLightning(now = new Date()): Promise<LightningObservation> {
      const random = seededRandom(20261112);
      const readings: { latitude: number; longitude: number; minutesAgo: number }[] = [];
      for (let index = 0; index < BUSY_STRIKE_COUNT - BUSY_NEAR_DUPLICATES; index += 1) {
        readings.push({
          latitude: 0.8 + random() * 1.1,
          longitude: 103.2 + random() * 1.4,
          // Spread evenly over the hour, short of the 60-minute edge.
          minutesAgo: (index / (BUSY_STRIKE_COUNT - BUSY_NEAR_DUPLICATES)) * 59,
        });
      }
      for (let index = 0; index < BUSY_NEAR_DUPLICATES; index += 1) {
        const original = readings[index * 40];
        // ~30 m away, a minute apart: two marks that must stay visibly overlapping.
        readings.push({
          latitude: original.latitude + 0.0003,
          longitude: original.longitude,
          minutesAgo: Math.max(0, original.minutesAgo - 1),
        });
      }

      const records: LightningRecord[] = readings.map((strike) => {
        const datetime = new Date(now.getTime() - strike.minutesAgo * 60_000).toISOString();
        return {
          datetime,
          updatedTimestamp: now.toISOString(),
          item: {
            readings: [
              {
                location: {
                  latitude: strike.latitude.toFixed(5),
                  longitude: strike.longitude.toFixed(5),
                },
                type: 'C',
                text: 'Cloud to Cloud',
                datetime,
              },
            ],
          },
        };
      });
      return {
        strikes: normaliseStrikes(records, now),
        window_minutes: LIGHTNING_WINDOW_MINUTES,
        fetched_at: now.toISOString(),
        provider_updated_at: now.toISOString(),
        stale: false,
      };
    },
  };
}
