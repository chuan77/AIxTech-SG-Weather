import type { IslandConditionsObservation, TempWindClient, TempWindStation } from './tempWind.js';

const SGT_OFFSET_MS = 8 * 3_600_000;
const MINUTE_MS = 60_000;
/** The real feed's latest complete minute is normally 3–7 minutes old (spec 015, Gate 2). */
const LAG_MINUTES = 6;

/**
 * Hand-made demo stations (TEMP_WIND_FIXTURE=demo, development only): rough positions across
 * Singapore covering every state the view draws. Not copied from any provider dump; apart from
 * S199 (the unnamed case) the ids are made up.
 */
const DEMO_STATIONS: TempWindStation[] = [
  // Calm (under 2 km/h).
  station('D01', 'Demo Woodlands', 1.4382, 103.7861, 27.1, 0.5, 40),
  station('D02', 'Demo Yishun', 1.4294, 103.8351, 26.9, 0.8, 300),
  // Light (2 to under 20 km/h).
  station('D03', 'Demo Seletar', 1.4167, 103.8667, 27.6, 4.3, 228),
  station('D04', 'Demo Ang Mo Kio', 1.3793, 103.85, 28.4, 6.1, 253),
  station('D05', 'Demo Clementi', 1.3337, 103.7768, 29.2, 8.2, 45),
  station('D06', 'Demo Tuas', 1.3197, 103.6365, 30.1, 3.7, 160),
  // Moderate (20 to under 39 km/h).
  station('D07', 'Demo Pasir Ris', 1.3721, 103.9474, 26.4, 13.1, 90),
  station('D08', 'Demo Marine Parade', 1.3056, 103.9104, 27.0, 15.0, 135),
  station('D09', 'Demo Kim Chuan', 1.3399, 103.8878, 28.8, 18.4, 0),
  // Strong (39 km/h and above).
  station('D10', 'Demo Pulau Ubin', 1.4168, 103.9673, 25.8, 25.0, 315),
  station('D11', 'Demo Semakau', 1.1891, 103.768, 26.2, 29.5, 200),
  // Wind only, temperature only, and no reading at all.
  station('D12', 'Demo Marina Barrage', 1.2799, 103.8703, null, 7.6, 230),
  station('D13', 'Demo Changi', 1.3678, 103.9823, 31.2, null, null),
  station('D14', 'Demo Bukit Timah', 1.3484, 103.7764, null, null, null),
  // A speed with no direction: a value in the popup, no arrow.
  station('D15', 'Demo Jurong West', 1.3404, 103.709, 30.6, 5.0, null),
  // An out-of-range temperature, already reduced to "no reading" as the real client does.
  station('D16', 'Demo Sentosa', 1.2494, 103.8303, null, 9.4, 270),
  // No name in the provider list: the UI shows "Station S199".
  station('S199', null, 1.33, 103.75, null, 5.4, 241),
];

function station(
  id: string,
  name: string | null,
  latitude: number,
  longitude: number,
  temperature_c: number | null,
  wind_speed_knots: number | null,
  wind_direction_deg: number | null,
): TempWindStation {
  return { id, name, latitude, longitude, temperature_c, wind_speed_knots, wind_direction_deg };
}

function sgtIso(ms: number): string {
  return `${new Date(ms + SGT_OFFSET_MS).toISOString().slice(0, 19)}+08:00`;
}

/** Deterministic island conditions for local development and the browser checks. */
export function createFixtureTempWindClient(): TempWindClient {
  return {
    async getIslandConditions(now: Date = new Date()): Promise<IslandConditionsObservation> {
      const readingMs = Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS - LAG_MINUTES * MINUTE_MS;
      return {
        stations: [...DEMO_STATIONS].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
        measures: { temperature: 'ok', wind: 'ok' },
        temperature_at: sgtIso(readingMs),
        wind_at: sgtIso(readingMs),
        fetched_at: now.toISOString(),
        stale: false,
      };
    },
  };
}
