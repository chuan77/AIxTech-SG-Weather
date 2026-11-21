// Taxi vs rain sample (assessment sg-transport-data, Option B). Research only: not part of the app,
// never run by the server, and nothing here is stored in the app's database.
//
// Each run makes two keyless data.gov.sg calls: LTA Taxi Availability (v1) and the latest 5-minute
// rainfall readings (v2). It appends one CSV row: taxis within 1 km of a few fixed spots and the
// rain at the nearest reporting station to each. Raw payloads are not kept.
//
// Usage: node scripts/research/taxi-rain-sample.mjs <csv-file>
// Stops collecting after STUDY_END (env, ISO time; default below) and exits 0 without calling out.
// Keeps one row per 15-minute slot (spec 017): if the file already has a row in the current slot,
// for example from the other trigger, it exits 0 without calling out.

import { appendFileSync, existsSync, readFileSync } from 'node:fs';

export const TAXI_URL = 'https://api.data.gov.sg/v1/transport/taxi-availability';
export const RAIN_URL = 'https://api-open.data.gov.sg/v2/real-time/api/rainfall';
export const STUDY_END = process.env.STUDY_END ?? '2026-12-02T16:00:00Z'; // 2026-12-03 00:00 SGT
const SLOT_MS = 15 * 60_000;
const RADIUS_KM = 1;

// Representative spots: CBD, shopping belt, an east and a west heartland town, the north.
export const SPOTS = [
  { id: 'raffles', lat: 1.284, lon: 103.851 },
  { id: 'orchard', lat: 1.304, lon: 103.8318 },
  { id: 'tampines', lat: 1.353, lon: 103.945 },
  { id: 'jurongwest', lat: 1.34, lon: 103.705 },
  { id: 'woodlands', lat: 1.436, lon: 103.786 },
];

export function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Taxi feed → { timestamp, total, points: [[lon, lat]] }. Throws on an unexpected shape. */
export function parseTaxis(json) {
  const feature = json?.features?.[0];
  const points = feature?.geometry?.coordinates;
  if (!Array.isArray(points)) throw new Error('taxi: no coordinates');
  const valid = points.filter(
    (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]),
  );
  return {
    timestamp: String(feature?.properties?.timestamp ?? ''),
    total: Number.isFinite(feature?.properties?.taxi_count)
      ? feature.properties.taxi_count
      : valid.length,
    points: valid,
  };
}

/** Rainfall v2 → { timestamp, stations: [{ id, lat, lon, mm }] } with only stations that reported. */
export function parseRain(json) {
  const data = json?.data;
  const reading = data?.readings?.[0];
  if (!Array.isArray(data?.stations) || !Array.isArray(reading?.data)) {
    throw new Error('rain: unexpected shape');
  }
  const values = new Map();
  for (const entry of reading.data) {
    const mm = Number(entry?.value);
    if (typeof entry?.stationId === 'string' && entry.value !== null && Number.isFinite(mm)) {
      values.set(entry.stationId, mm);
    }
  }
  const stations = [];
  for (const s of data.stations) {
    const lat = Number(s?.location?.latitude);
    const lon = Number(s?.location?.longitude);
    if (values.has(s?.id) && Number.isFinite(lat) && Number.isFinite(lon)) {
      stations.push({ id: s.id, lat, lon, mm: values.get(s.id) });
    }
  }
  return { timestamp: String(reading.timestamp ?? ''), stations };
}

export function taxisNear(points, spot, radiusKm = RADIUS_KM) {
  return points.filter(([lon, lat]) => distanceKm(spot.lat, spot.lon, lat, lon) <= radiusKm).length;
}

export function nearestRain(stations, spot) {
  let best = null;
  for (const s of stations) {
    const km = distanceKm(spot.lat, spot.lon, s.lat, s.lon);
    if (!best || km < best.km) best = { mm: s.mm, km };
  }
  return best;
}

/** ISO time → its 15-minute slot in UTC, e.g. '2026-11-20T09:00:00Z'. */
export function slotOf(iso) {
  const ms = Math.floor(new Date(iso).getTime() / SLOT_MS) * SLOT_MS;
  return `${new Date(ms).toISOString().slice(0, 19)}Z`;
}

/** Slots from `fromIso` (inclusive) to `toIso` (exclusive), every 15 minutes. */
export function listSlots(fromIso, toIso) {
  const slots = [];
  const end = new Date(toIso).getTime();
  for (let ms = new Date(slotOf(fromIso)).getTime(); ms < end; ms += SLOT_MS) {
    slots.push(slotOf(new Date(ms).toISOString()));
  }
  return slots;
}

/** The run_at_utc column of a sample CSV, without the header. */
export function runTimes(csvText) {
  return csvText
    .split('\n')
    .slice(1)
    .map((line) => line.split(',')[0].trim())
    .filter(Boolean);
}

export function slotTaken(csvText, slot) {
  return runTimes(csvText).some((runAt) => slotOf(runAt) === slot);
}

export const HEADER = [
  'run_at_utc',
  'taxi_timestamp',
  'taxi_total',
  'rain_timestamp',
  'rain_stations_reporting',
  'rain_stations_wet',
  ...SPOTS.flatMap((s) => [`${s.id}_taxis_1km`, `${s.id}_rain_mm`, `${s.id}_rain_station_km`]),
  'errors',
];

/** One CSV row from parsed results; a failed source leaves its columns empty. */
export function buildRow(runAt, taxis, rain, errors) {
  const cells = [
    runAt,
    taxis?.timestamp ?? '',
    taxis?.total ?? '',
    rain?.timestamp ?? '',
    rain ? rain.stations.length : '',
    rain ? rain.stations.filter((s) => s.mm > 0).length : '',
  ];
  for (const spot of SPOTS) {
    cells.push(taxis ? taxisNear(taxis.points, spot) : '');
    const near = rain ? nearestRain(rain.stations, spot) : null;
    cells.push(near ? near.mm : '', near ? near.km.toFixed(2) : '');
  }
  cells.push(errors.join('; '));
  return cells.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c));
}

export async function getJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'lepak-weather-research/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: taxi-rain-sample.mjs <csv-file>');
    process.exit(2);
  }
  const runAt = new Date().toISOString();
  if (runAt > new Date(STUDY_END).toISOString()) {
    console.log(`study ended at ${STUDY_END}; nothing collected`);
    return;
  }
  const slot = slotOf(runAt);
  if (existsSync(file) && slotTaken(readFileSync(file, 'utf8'), slot)) {
    console.log(`slot ${slot} already sampled; nothing collected`);
    return;
  }
  const errors = [];
  let taxis = null;
  let rain = null;
  try {
    taxis = parseTaxis(await getJson(TAXI_URL));
  } catch (error) {
    errors.push(`taxi: ${String(error?.message ?? error).slice(0, 80)}`);
  }
  try {
    rain = parseRain(await getJson(RAIN_URL));
  } catch (error) {
    errors.push(`rain: ${String(error?.message ?? error).slice(0, 80)}`);
  }
  const lines = existsSync(file) ? '' : `${HEADER.join(',')}\n`;
  appendFileSync(file, `${lines}${buildRow(runAt, taxis, rain, errors).join(',')}\n`);
  console.log(
    `appended ${runAt}: taxis=${taxis?.total ?? '-'} rain_stations=${rain?.stations.length ?? '-'} errors=${errors.length}`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
