import type { IslandRainObservation, RainClient, RainStationReading } from './rain.js';

const SGT_OFFSET_MS = 8 * 3_600_000;
const PERIOD_MS = 5 * 60_000;

/**
 * Hand-made demo stations (RAIN_FIXTURE=demo, development only): rough positions across
 * Singapore with a shower over the central east and a lighter one in the west. Not copied from
 * any provider dump; ids are made up.
 */
const DEMO_STATIONS: Omit<RainStationReading, 'id'>[] = [
  {
    name: 'Demo Woodlands',
    latitude: 1.4382,
    longitude: 103.7861,
    total_mm: 0,
    periods_covered: 3,
  },
  { name: 'Demo Yishun', latitude: 1.4294, longitude: 103.8351, total_mm: 0, periods_covered: 3 },
  { name: 'Demo Seletar', latitude: 1.4167, longitude: 103.8667, total_mm: 0, periods_covered: 3 },
  { name: 'Demo Tuas', latitude: 1.3197, longitude: 103.6365, total_mm: 0, periods_covered: 3 },
  { name: 'Demo Changi', latitude: 1.3678, longitude: 103.9826, total_mm: 0, periods_covered: 3 },
  { name: 'Demo Sentosa', latitude: 1.2494, longitude: 103.8303, total_mm: 0, periods_covered: 3 },
  {
    name: 'Demo Jurong West',
    latitude: 1.3404,
    longitude: 103.709,
    total_mm: 0.2,
    periods_covered: 3,
  },
  {
    name: 'Demo Boon Lay',
    latitude: 1.3387,
    longitude: 103.7058,
    total_mm: 0.4,
    periods_covered: 3,
  },
  {
    name: 'Demo Clementi',
    latitude: 1.3151,
    longitude: 103.765,
    total_mm: 0.2,
    periods_covered: 3,
  },
  {
    name: 'Demo Toa Payoh',
    latitude: 1.3343,
    longitude: 103.8563,
    total_mm: 0.6,
    periods_covered: 3,
  },
  { name: 'Demo Bishan', latitude: 1.3526, longitude: 103.8352, total_mm: 1.4, periods_covered: 3 },
  {
    name: 'Demo Geylang',
    latitude: 1.3201,
    longitude: 103.8918,
    total_mm: 2.4,
    periods_covered: 3,
  },
  {
    name: 'Demo Serangoon',
    latitude: 1.3554,
    longitude: 103.8679,
    total_mm: 2.6,
    periods_covered: 3,
  },
  {
    name: 'Demo Paya Lebar',
    latitude: 1.3576,
    longitude: 103.8895,
    total_mm: 6,
    periods_covered: 3,
  },
  {
    name: 'Demo Kaki Bukit',
    latitude: 1.3349,
    longitude: 103.9084,
    total_mm: 12,
    periods_covered: 3,
  },
  {
    name: 'Demo Hougang',
    latitude: 1.3712,
    longitude: 103.8925,
    total_mm: 0.4,
    periods_covered: 2,
  },
  { name: 'Demo Tampines', latitude: 1.3496, longitude: 103.9568, total_mm: 0, periods_covered: 1 },
  {
    name: 'Demo Bukit Timah',
    latitude: 1.3294,
    longitude: 103.8021,
    total_mm: null,
    periods_covered: 0,
  },
  {
    name: 'Demo Marine Parade',
    latitude: 1.302,
    longitude: 103.9072,
    total_mm: null,
    periods_covered: 0,
  },
  {
    name: 'Demo Pasir Ris',
    latitude: 1.3721,
    longitude: 103.9474,
    total_mm: 0,
    periods_covered: 3,
  },
];

function sgtIso(ms: number): string {
  return `${new Date(ms + SGT_OFFSET_MS).toISOString().slice(0, 19)}+08:00`;
}

/** Deterministic island rain for local development and the Gate 2 / browser checks. */
export function createFixtureRainClient(): RainClient {
  return {
    async getRecentRain(now: Date = new Date()): Promise<IslandRainObservation> {
      // Like the real feed: the newest usable period ends about 10 minutes before now.
      const endMs = Math.floor(now.getTime() / PERIOD_MS) * PERIOD_MS - 2 * PERIOD_MS;
      return {
        stations: DEMO_STATIONS.map((station, index) => ({
          id: `D${String(index + 1).padStart(2, '0')}`,
          ...station,
        })),
        window_minutes: 15,
        window_end: sgtIso(endMs),
        window_start: sgtIso(endMs - 3 * PERIOD_MS),
        periods_found: 3,
        fetched_at: now.toISOString(),
        stale: false,
      };
    },
  };
}
