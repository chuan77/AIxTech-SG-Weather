import type { WeatherSnapshot } from '../types';

export type BandId = 'chilly' | 'breezy-cool' | 'warm' | 'hot-muggy' | 'scorching';

export interface Band {
  id: BandId;
  /** Lowest rounded value (°C) in this band; bands run up to the next band's minimum. */
  min: number;
  label: string;
  advice: string;
}

export type MissingInput = 'temperature' | 'humidity';

export type FeelsLike =
  | { kind: 'value'; value: number; band: Band; approx: boolean; umbrella: boolean }
  | { kind: 'no-reading'; missing: MissingInput[] };

/** Comfort bands for Steadman apparent temperature (spec FR-003). Clothing advice only. */
export const BANDS: readonly Band[] = [
  {
    id: 'chilly',
    min: Number.NEGATIVE_INFINITY,
    label: 'Chilly',
    advice: 'Wear a jacket or hoodie. Rare outdoor chill; layer up for wind and rain.',
  },
  {
    id: 'breezy-cool',
    min: 24,
    label: 'Breezy & Cool',
    advice:
      'Bring a light layer. Comfortable in a tee, though a thin cardigan helps in breezy or damp spots.',
  },
  {
    id: 'warm',
    min: 27,
    label: 'Warm',
    advice: 'Standard light wear. Short sleeves and light trousers or shorts; no jacket needed.',
  },
  {
    id: 'hot-muggy',
    min: 32,
    label: 'Hot & Muggy',
    advice:
      'Wear breathable, loose fabrics. Stick to dry-fit or light cotton; carry a UV umbrella in open sun.',
  },
  {
    id: 'scorching',
    min: 37,
    label: 'Scorching',
    advice:
      'Minimal, airy clothing and sun gear. Opt for moisture-wicking wear, sunglasses and a UV umbrella.',
  },
];

const RAIN_WORDING = /rain|shower|thunder/i;
const RAIN_THRESHOLD_MM = 0.1;
const MS_PER_KNOT = 0.514444;

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Steadman apparent temperature, non-radiation form used by Australia's Bureau of Meteorology:
 * AT = Ta + 0.33e − 0.70ws − 4.00, with e the water vapour pressure in hPa.
 */
export function apparentTemperature(tempC: number, humidityPct: number, windMs: number): number {
  const vapourPressure = (humidityPct / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  return tempC + 0.33 * vapourPressure - 0.7 * windMs - 4;
}

export function knotsToMs(knots: number): number {
  return knots * MS_PER_KNOT;
}

export function roundHalfUp1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Band for an already-rounded value; lower bounds are inclusive. */
export function bandFor(value: number): Band {
  let match = BANDS[0];
  for (const band of BANDS) {
    if (value >= band.min) match = band;
  }
  return match;
}

/** Rain in the 2-hour forecast wording, or more than 0.1 mm at the nearest station. */
export function needsUmbrella(
  condition: string | null | undefined,
  rainfallMm: number | null | undefined,
): boolean {
  if (condition && RAIN_WORDING.test(condition)) return true;
  return isFiniteNumber(rainfallMm) && rainfallMm > RAIN_THRESHOLD_MM;
}

export function feelsLike(weather: WeatherSnapshot): FeelsLike {
  const missing: MissingInput[] = [];
  if (!isFiniteNumber(weather.temperature_c)) missing.push('temperature');
  if (!isFiniteNumber(weather.humidity_percent)) missing.push('humidity');
  if (missing.length > 0) return { kind: 'no-reading', missing };

  const hasWind = isFiniteNumber(weather.wind_speed_knots);
  const windMs = hasWind ? knotsToMs(weather.wind_speed_knots as number) : 0;
  const value = roundHalfUp1(
    apparentTemperature(
      weather.temperature_c as number,
      weather.humidity_percent as number,
      windMs,
    ),
  );

  return {
    kind: 'value',
    value,
    band: bandFor(value),
    approx: !hasWind,
    umbrella: needsUmbrella(weather.condition, weather.rainfall_mm),
  };
}

/** Tooltip text for the no-reading state, e.g. "Needs temperature and humidity". */
export function missingInputsText(missing: MissingInput[]): string {
  return `Needs ${missing.join(' and ')}`;
}
