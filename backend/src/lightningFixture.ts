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
