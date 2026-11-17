import type { IslandRainObservation, RainStationReading, RainStatus } from '../../types';
import { formatStrikeTime } from './lightningHelpers';

/** Island-wide rain (spec 011). Pure helpers so the map components stay thin (constitution IV). */

export const RAIN_STORAGE_KEY = 'weather-starter.rain.enabled';
/**
 * The newest complete reading is normally about 10 minutes old (research R3), so readings count
 * as out of date only once the newest is more than 20 minutes old.
 */
export const RAIN_OUT_OF_DATE_MS = 20 * 60_000;
export const RAIN_SOURCE = 'Rainfall: NEA via data.gov.sg';
/** The licence notice the key carries (Singapore Open Data Licence v1.0, research R9). */
export const RAIN_LICENCE_NOTICE =
  'Contains information from Rainfall across Singapore (NEA), accessed from data.gov.sg, made available under the';
export const RAIN_LICENCE_NAME = 'Singapore Open Data Licence version 1.0';
export const RAIN_LICENCE_URL = 'https://data.gov.sg/open-data-licence';

const MINUTE_MS = 60_000;
const SGT_OFFSET_MS = 8 * 3_600_000;

export type RainLevel = 'dry' | 'light' | 'moderate' | 'heavy';
export type RainMarkKind = RainLevel | 'missing';

/**
 * Common rain-rate bands (light under 2.5, moderate 2.5–10, heavy 10 mm/h or more) scaled to a
 * 15-minute total (research R4). Ordered lightest first, as the key lists them.
 */
export const RAIN_LEVELS: readonly {
  level: Exclude<RainLevel, 'dry'>;
  label: string;
  rangeMm: string;
  rangePerHour: string;
}[] = [
  { level: 'light', label: 'Light', rangeMm: 'under 0.6 mm', rangePerHour: 'under 2.5 mm/h' },
  { level: 'moderate', label: 'Moderate', rangeMm: '0.6–2.5 mm', rangePerHour: '2.5–10 mm/h' },
  { level: 'heavy', label: 'Heavy', rangeMm: '2.5 mm or more', rangePerHour: '10 mm/h or more' },
];

const LEVEL_LABEL: Record<RainLevel, string> = {
  dry: 'Dry',
  light: 'Light',
  moderate: 'Moderate',
  heavy: 'Heavy',
};

export function rainLevel(totalMm: number): RainLevel {
  if (totalMm <= 0) return 'dry';
  if (totalMm < 0.6) return 'light';
  if (totalMm < 2.5) return 'moderate';
  return 'heavy';
}

export function isWet(reading: RainStationReading): boolean {
  return reading.periods_covered > 0 && (reading.total_mm ?? 0) > 0;
}

export function rainCoverage(reading: RainStationReading): {
  kind: 'full' | 'partial' | 'none';
  label: string | null;
} {
  if (reading.periods_covered === 0 || reading.total_mm === null) {
    return { kind: 'none', label: 'No reading' };
  }
  if (reading.periods_covered < 3) {
    return { kind: 'partial', label: `${reading.periods_covered * 5} of 15 min` };
  }
  return { kind: 'full', label: null };
}

/** Which symbol to draw. A station with no reading is never drawn as dry (spec US3). */
export function rainMarkKind(reading: RainStationReading): {
  kind: RainMarkKind;
  partial: boolean;
} {
  const coverage = rainCoverage(reading);
  if (coverage.kind === 'none') return { kind: 'missing', partial: false };
  return { kind: rainLevel(reading.total_mm ?? 0), partial: coverage.kind === 'partial' };
}

/** "0 mm", "0.2 mm", "12 mm". */
export function formatRainTotal(totalMm: number): string {
  return `${Number(totalMm.toFixed(1))} mm`;
}

function clock(ms: number): { time: string; suffix: string } {
  const sgt = new Date(ms + SGT_OFFSET_MS);
  const hours = sgt.getUTCHours();
  const minutes = String(sgt.getUTCMinutes()).padStart(2, '0');
  return {
    time: `${hours % 12 === 0 ? 12 : hours % 12}:${minutes}`,
    suffix: hours >= 12 ? 'pm' : 'am',
  };
}

/** "8:00–8:15 am" in Singapore time; both suffixes when the window crosses noon or midnight. */
export function formatRainPeriod(start: string | null, end: string | null): string {
  const startMs = start ? Date.parse(start) : Number.NaN;
  const endMs = end ? Date.parse(end) : Number.NaN;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 'time unknown';
  const from = clock(startMs);
  const to = clock(endMs);
  return from.suffix === to.suffix
    ? `${from.time}–${to.time} ${to.suffix}`
    : `${from.time} ${from.suffix}–${to.time} ${to.suffix}`;
}

/** Plain strings for a station's popup; the layer escapes them. */
export function rainPopup(
  reading: RainStationReading,
  observation: Pick<IslandRainObservation, 'window_start' | 'window_end'>,
): {
  title: string;
  total: string | null;
  level: string | null;
  period: string;
  note: string | null;
  source: string;
} {
  const coverage = rainCoverage(reading);
  const period = formatRainPeriod(observation.window_start, observation.window_end);
  if (coverage.kind === 'none') {
    return {
      title: reading.name,
      total: null,
      level: null,
      period,
      note: 'No reading in the last 15 minutes',
      source: RAIN_SOURCE,
    };
  }
  const total = reading.total_mm ?? 0;
  return {
    title: reading.name,
    total: formatRainTotal(total),
    level: LEVEL_LABEL[rainLevel(total)],
    period,
    note: coverage.kind === 'partial' ? `Partial: ${coverage.label}` : null,
    source: RAIN_SOURCE,
  };
}

/** True when the newest reading is over 20 minutes old, or it was served after a failed refresh. */
export function isRainOutOfDate(observation: IslandRainObservation | null, now: number): boolean {
  if (!observation) return false;
  if (observation.stale) return true;
  const end = observation.window_end ? Date.parse(observation.window_end) : Number.NaN;
  return !Number.isFinite(end) || now - end > RAIN_OUT_OF_DATE_MS;
}

function ageText(observation: IslandRainObservation, now: number): string | null {
  const end = observation.window_end ? Date.parse(observation.window_end) : Number.NaN;
  if (!Number.isFinite(end)) return null;
  const minutes = Math.max(0, Math.floor((now - end) / MINUTE_MS));
  return minutes < 1 ? 'just now' : `${minutes} min ago`;
}

function wetCount(observation: IslandRainObservation | null): number {
  return observation ? observation.stations.filter(isWet).length : 0;
}

function statusText(status: RainStatus, observation: IslandRainObservation | null): string {
  switch (status) {
    case 'idle':
      return 'Show latest rain';
    case 'loading':
      return 'Loading rain…';
    case 'unavailable':
      return 'Rain data unavailable';
    case 'empty':
      return 'No rain in the last 15 minutes';
    case 'ok': {
      const count = wetCount(observation);
      if (count === 0) return 'No rain in the last 15 minutes';
      return `Rain at ${count} ${count === 1 ? 'station' : 'stations'}`;
    }
  }
}

/** The full-screen map's strip: what the view shows, plus the reading time and its age. */
export function rainStatusMessage(
  status: RainStatus,
  observation: IslandRainObservation | null,
  now: number,
): { text: string; updatedText: string | null } {
  const text = statusText(status, observation);
  if (status === 'idle' || !observation?.window_end) return { text, updatedText: null };
  const parts = [`to ${formatStrikeTime(observation.window_end)}`];
  const age = ageText(observation, now);
  if (age) parts.push(age);
  if (isRainOutOfDate(observation, now)) parts.push('out of date');
  return { text, updatedText: parts.join(' · ') };
}

/**
 * The card map's single strip (Gate 2): one short segment per layer that is on. Rain gives its
 * age, or "out of date"; lightning reuses its own status text.
 */
export function combinedStatusSegments(
  rain: { enabled: boolean; status: RainStatus; observation: IslandRainObservation | null },
  lightningText: string | null,
  now: number,
): string[] {
  const segments: string[] = [];
  if (rain.enabled) {
    let text = statusText(rain.status, rain.observation);
    if (rain.status !== 'idle' && rain.status !== 'loading' && rain.observation) {
      const age = ageText(rain.observation, now);
      if (isRainOutOfDate(rain.observation, now)) text += ' · out of date';
      else if (age) text += ` · ${age}`;
    }
    segments.push(text);
  }
  if (lightningText) segments.push(`Lightning: ${lightningText}`);
  return segments;
}

/** The card's Layers button name, saying which layers are on. */
export function layersLabel(rainOn: boolean, lightningOn: boolean): string {
  if (rainOn && lightningOn) return 'Map layers: rain and lightning on';
  if (rainOn) return 'Map layers: rain on';
  if (lightningOn) return 'Map layers: lightning on';
  return 'Map layers: all off';
}

/** Missing, unreadable or anything but "true" means off: rain is off until asked for (FR-007). */
export function parseRainEnabled(raw: string | null): boolean {
  return raw === 'true';
}

export function serialiseRainEnabled(enabled: boolean): string {
  return enabled ? 'true' : 'false';
}
