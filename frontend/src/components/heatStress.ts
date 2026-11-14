import type { WeatherSnapshot } from '../types';
import { formatSgtTime } from './sunTimes';

/** Beyond this distance the nearest WBGT station no longer says much about the location. */
export const WBGT_MAX_STATION_KM = 10;

/**
 * Advisory-level guidance, paraphrasing NEA's Heat Stress Advisory (spec 005 research R3).
 * Shown only for Moderate and High; no medical advice.
 */
export const HEAT_STRESS_GUIDANCE = {
  moderate:
    'Reduce prolonged or strenuous outdoor activity. Take regular breaks in the shade and drink water often.',
  high: 'Minimise outdoor activity and stay in the shade where possible. Drink water often and watch for signs of heat illness.',
} as const;

export type HeatStressTone = 'low' | 'moderate' | 'high' | 'unknown';

export type HeatStressView =
  | { kind: 'no-reading' }
  | { kind: 'no-nearby-station'; tooltip: string }
  | {
      kind: 'reading';
      value: string;
      level: string | null;
      tone: HeatStressTone;
      guidance: string | null;
      stationName: string | null;
      distanceKm: string;
      observedAt: string | null;
    };

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function toneFor(level: string | null): HeatStressTone {
  switch (level?.trim().toLowerCase()) {
    case 'low':
      return 'low';
    case 'moderate':
      return 'moderate';
    case 'high':
      return 'high';
    default:
      return 'unknown';
  }
}

function formatObservedAt(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : formatSgtTime(date);
}

export function heatStressView(weather: WeatherSnapshot): HeatStressView {
  const distance = weather.wbgt_station_distance_km;
  if (!isFiniteNumber(weather.wbgt_c) || !isFiniteNumber(distance)) {
    return { kind: 'no-reading' };
  }

  if (distance > WBGT_MAX_STATION_KM) {
    return {
      kind: 'no-nearby-station',
      tooltip: `Nearest station: ${weather.wbgt_station_name ?? 'unknown'}, ${distance.toFixed(1)} km away`,
    };
  }

  const tone = toneFor(weather.heat_stress_level);
  return {
    kind: 'reading',
    value: weather.wbgt_c.toFixed(1),
    level: weather.heat_stress_level?.trim() || null,
    tone,
    guidance:
      tone === 'moderate'
        ? HEAT_STRESS_GUIDANCE.moderate
        : tone === 'high'
          ? HEAT_STRESS_GUIDANCE.high
          : null,
    stationName: weather.wbgt_station_name,
    distanceKm: distance.toFixed(1),
    observedAt: formatObservedAt(weather.wbgt_observed_at),
  };
}
