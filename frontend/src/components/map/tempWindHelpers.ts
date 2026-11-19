import type { IslandConditionsObservation, TempWindStation, TempWindStatus } from '../../types';
import { formatStrikeTime } from './lightningHelpers';
import { RAIN_LICENCE_NAME, RAIN_LICENCE_URL } from './rainHelpers';

/**
 * Island-wide temperature and wind (spec 015). Pure helpers so the map components stay thin
 * (constitution IV). The view is on the full-screen map only.
 */

export const TEMP_WIND_STORAGE_KEY = 'weather-starter.tempWind.enabled';
/** Set once the legend has opened by itself, so it does so only the first time. */
export const TEMP_WIND_LEGEND_SEEN_KEY = 'weather-starter.tempWind.legendSeen';
/**
 * The newest complete reading is normally 3–7 minutes old, plus up to 2 minutes of shared cache
 * (spec 015, Gate 2), so readings count as out of date only once they are over 15 minutes old.
 */
export const TEMP_WIND_OUT_OF_DATE_MS = 15 * 60_000;
export const TEMP_WIND_PROMPT = 'Show latest temperature & wind';
export const TEMP_WIND_SOURCE = 'NEA via data.gov.sg';
/** The licence notice the legend carries (Singapore Open Data Licence v1.0, research R9). */
export const TEMP_WIND_LICENCE_NOTICE =
  'Contains information from Air Temperature across Singapore, Wind Speed across Singapore and Wind Direction across Singapore (NEA), accessed from data.gov.sg, made available under the';
export const TEMP_WIND_LICENCE_NAME = RAIN_LICENCE_NAME;
export const TEMP_WIND_LICENCE_URL = RAIN_LICENCE_URL;

/** The same factor as the Wind tile's km/h. */
export const KNOTS_TO_KMH = 1.852;
const MINUTE_MS = 60_000;

export type WindLevel = 'calm' | 'light' | 'moderate' | 'strong';

/** Beaufort-based bands (research R4), lightest first, as the key lists them. */
export const TEMP_WIND_LEVELS: readonly { level: WindLevel; label: string; range: string }[] = [
  { level: 'calm', label: 'Calm', range: 'under 2 km/h' },
  { level: 'light', label: 'Light', range: '2–19 km/h' },
  { level: 'moderate', label: 'Moderate', range: '20–38 km/h' },
  { level: 'strong', label: 'Strong', range: '39 km/h or more' },
];

const LEVEL_WORD: Record<WindLevel, string> = {
  calm: 'calm',
  light: 'light',
  moderate: 'moderate',
  strong: 'strong',
};

const POINTS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const;

const POINT_NAMES: Record<(typeof POINTS)[number], string> = {
  N: 'north',
  NNE: 'north-north-east',
  NE: 'north-east',
  ENE: 'east-north-east',
  E: 'east',
  ESE: 'east-south-east',
  SE: 'south-east',
  SSE: 'south-south-east',
  S: 'south',
  SSW: 'south-south-west',
  SW: 'south-west',
  WSW: 'west-south-west',
  W: 'west',
  WNW: 'west-north-west',
  NW: 'north-west',
  NNW: 'north-north-west',
};

/** "27.4°"; "–°" for no reading. */
export function formatTemperature(celsius: number | null): string {
  return celsius === null ? '–°' : `${celsius.toFixed(1)}°`;
}

export function stationLabel(station: Pick<TempWindStation, 'id' | 'name'>): string {
  return station.name ?? `Station ${station.id}`;
}

/** "1:33 pm" in Singapore time. */
export function formatReadingTime(isoTime: string): string {
  return formatStrikeTime(isoTime);
}

/** Whole km/h for display. */
export function windKmh(knots: number): number {
  return Math.round(knots * KNOTS_TO_KMH);
}

export function windLevel(kmh: number): WindLevel {
  if (kmh < 2) return 'calm';
  if (kmh < 20) return 'light';
  if (kmh < 39) return 'moderate';
  return 'strong';
}

/** The provider gives where the wind comes FROM; the arrow points where it blows TO. */
export function arrowRotation(fromDeg: number): number {
  return (fromDeg + 180) % 360;
}

export function compassPoint(deg: number): (typeof POINTS)[number] {
  const index = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
  return POINTS[index];
}

export interface MarkKind {
  /** An arrow needs a speed above calm and a direction; calm needs only the speed. */
  wind: 'arrow' | 'calm' | 'missing';
  level: WindLevel | null;
  temp: 'value' | 'missing';
}

export function markKind(station: TempWindStation): MarkKind {
  const temp = station.temperature_c === null ? 'missing' : 'value';
  const speed = station.wind_speed_knots;
  if (speed === null) return { wind: 'missing', level: null, temp };
  const level = windLevel(speed * KNOTS_TO_KMH);
  if (level === 'calm') return { wind: 'calm', level, temp };
  if (station.wind_direction_deg === null) return { wind: 'missing', level: null, temp };
  return { wind: 'arrow', level, temp };
}

/** "15 km/h, light, from SW (228°)", "Calm (1 km/h)" or "No reading". */
export function windText(station: TempWindStation): string {
  const speed = station.wind_speed_knots;
  if (speed === null) return 'No reading';
  const level = windLevel(speed * KNOTS_TO_KMH);
  const kmh = windKmh(speed);
  if (level === 'calm') return `Calm (${kmh} km/h)`;
  const direction = station.wind_direction_deg;
  if (direction === null) return `${kmh} km/h, ${LEVEL_WORD[level]}, direction not reported`;
  return `${kmh} km/h, ${LEVEL_WORD[level]}, from ${compassPoint(direction)} (${Math.round(direction)}°)`;
}

/** What a screen reader hears for a mark, e.g. "Clementi Road, 26.3 degrees, wind light from south-west". */
export function tempWindAccessibleName(station: TempWindStation): string {
  const temperature =
    station.temperature_c === null
      ? 'no temperature reading'
      : `${station.temperature_c.toFixed(1)} degrees`;
  const kind = markKind(station);
  let wind: string;
  if (kind.wind === 'calm') wind = 'wind calm';
  else if (kind.wind === 'arrow' && kind.level && station.wind_direction_deg !== null) {
    wind = `wind ${LEVEL_WORD[kind.level]} from ${POINT_NAMES[compassPoint(station.wind_direction_deg)]}`;
  } else if (station.wind_speed_knots !== null) {
    wind = `wind ${LEVEL_WORD[windLevel(station.wind_speed_knots * KNOTS_TO_KMH)]}, direction not reported`;
  } else wind = 'no wind reading';
  return `${stationLabel(station)}, ${temperature}, ${wind}`;
}

/** The older of the two reading times that are known. */
export function readingTime(
  observation: Pick<IslandConditionsObservation, 'temperature_at' | 'wind_at'>,
): string | null {
  const times = [observation.temperature_at, observation.wind_at].filter(
    (time): time is string => time !== null && Number.isFinite(Date.parse(time)),
  );
  if (times.length === 0) return null;
  return times.reduce((older, time) => (Date.parse(time) < Date.parse(older) ? time : older));
}

/** Plain strings for a station's popup; the layer builds it from DOM text. */
export function tempWindPopup(
  station: TempWindStation,
  observation: IslandConditionsObservation,
): { title: string; temperature: string; wind: string; time: string; source: string } {
  const time = readingTime(observation);
  return {
    title: stationLabel(station),
    temperature:
      observation.measures.temperature === 'unavailable'
        ? 'Unavailable'
        : station.temperature_c === null
          ? 'No reading'
          : `${station.temperature_c.toFixed(1)} °C`,
    wind: observation.measures.wind === 'unavailable' ? 'Unavailable' : windText(station),
    time: time ? `Readings at ${formatReadingTime(time)}` : 'Reading time unknown',
    source: TEMP_WIND_SOURCE,
  };
}

/** True when the readings are over 15 minutes old, or were served after a failed refresh. */
export function isTempWindOutOfDate(
  observation: IslandConditionsObservation | null,
  now: number,
): boolean {
  if (!observation) return false;
  if (observation.stale) return true;
  const time = readingTime(observation);
  return time === null || now - Date.parse(time) > TEMP_WIND_OUT_OF_DATE_MS;
}

function isAllCalm(observation: IslandConditionsObservation): boolean {
  if (observation.measures.wind !== 'ok') return false;
  const speeds = observation.stations
    .map((station) => station.wind_speed_knots)
    .filter((speed): speed is number => speed !== null);
  return speeds.length > 0 && speeds.every((speed) => windLevel(speed * KNOTS_TO_KMH) === 'calm');
}

function readyText(observation: IslandConditionsObservation | null): string {
  if (!observation) return 'Temperature and wind data is unavailable';
  const count = observation.stations.length;
  let text = isAllCalm(observation)
    ? 'Calm across the island'
    : `Temp & wind at ${count} ${count === 1 ? 'station' : 'stations'}`;
  if (observation.measures.wind === 'unavailable') text += ' · Wind unavailable';
  if (observation.measures.temperature === 'unavailable') text += ' · Temperature unavailable';
  return text;
}

function statusText(status: TempWindStatus, observation: IslandConditionsObservation | null) {
  switch (status) {
    case 'idle':
      return TEMP_WIND_PROMPT;
    case 'loading':
      return observation ? 'Updating temperature & wind…' : 'Loading temperature & wind…';
    case 'unavailable':
      return observation
        ? 'Fresh data unavailable, showing earlier readings'
        : 'Temperature and wind data is unavailable';
    case 'ready':
      return readyText(observation);
  }
}

/** The full-screen strip: what the view shows, plus the reading time, its age and freshness. */
export function tempWindStatusMessage(
  status: TempWindStatus,
  observation: IslandConditionsObservation | null,
  now: number,
): { text: string; updatedText: string | null } {
  const text = statusText(status, observation);
  const time = observation ? readingTime(observation) : null;
  if (status === 'idle' || !observation || !time) return { text, updatedText: null };
  const minutes = Math.max(0, Math.floor((now - Date.parse(time)) / MINUTE_MS));
  const parts = [`at ${formatReadingTime(time)}`, minutes < 1 ? 'just now' : `${minutes} min ago`];
  // A failed refresh means what is on screen is no longer the latest (FR-012).
  if (status === 'unavailable' || isTempWindOutOfDate(observation, now)) parts.push('out of date');
  return { text, updatedText: parts.join(' · ') };
}

/** Missing, unreadable or anything but "true" means off (FR-007). */
export function parseTempWindEnabled(raw: string | null): boolean {
  return raw === 'true';
}

export function serialiseTempWindEnabled(enabled: boolean): string {
  return enabled ? 'true' : 'false';
}

export function parseTempWindLegendSeen(raw: string | null): boolean {
  return raw === 'true';
}

/** The legend opens by itself the first time readings are on screen, then only on request. */
export function shouldAutoOpenTempWindLegend(legendSeen: boolean, status: TempWindStatus): boolean {
  return !legendSeen && status === 'ready';
}
