import type { ForecastPeriod, WeatherSnapshot } from '../types';
import { heatStressView, type HeatStressTone } from './heatStress';
import { periodStartPhrase } from './periodLabel';

/** "6 pm 14 Nov 2026 to 12 am ..." → "6 pm 14 Nov": the start of a forecast period, without the year. */
export function shortenPeriodLabel(label: string): string {
  if (!label) return '';
  const start = label.split(' to ')[0];
  return start.replace(/\s\d{4}\b/, '');
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function psiBand(psi: number | null | undefined): string | null {
  if (!isFiniteNumber(psi)) return null;
  if (psi <= 50) return 'Good';
  if (psi <= 100) return 'Moderate';
  if (psi <= 200) return 'Unhealthy';
  if (psi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

/** NEA UV index bands from High up (6+); null below that or with no reading. */
export function uvBand(uv: number | null | undefined): string | null {
  if (!isFiniteNumber(uv) || uv < 6) return null;
  if (uv < 8) return 'High';
  if (uv < 11) return 'Very high';
  return 'Extreme';
}

const THUNDER = /thunder/i;

/**
 * True when thunder is happening now: in the current condition or the forecast period covering now.
 * Later periods don't count; Singapore forecasts thunder most days, so "any period" would mean always.
 */
export function thunderNow(condition: string | null, periods: ForecastPeriod[]): boolean {
  return (!!condition && THUNDER.test(condition)) || THUNDER.test(periods[0]?.forecast ?? '');
}

function stormPart(
  condition: string | null,
  periods: ForecastPeriod[],
  today?: string,
): string | null {
  if (condition && THUNDER.test(condition)) return 'Thundery showers now';
  const later = periods.findIndex((period) => THUNDER.test(period.forecast ?? ''));
  if (later === 0) return 'Thundery showers now';
  if (later > 0) {
    const label = periods[later].label;
    // With today known, say which day: "from tomorrow midday" rather than a bare "Midday".
    return `Thundery showers from ${today ? periodStartPhrase(label, today) : shortenPeriodLabel(label)}`;
  }
  // Only claim "no storms" when there is a forecast to back it.
  return periods.length > 0 ? 'No storms forecast' : null;
}

/**
 * The hero's answer to "can I go out?": storms, heat stress, UV (High and up) and PSI.
 * Parts with no reading are left out rather than guessed; null when nothing is known.
 */
export function outdoorSummary(weather: WeatherSnapshot): string | null {
  const parts = outdoorSummaryParts(weather);
  return parts.length > 0 ? parts.map((part) => part.text).join(' · ') : null;
}

export interface SummaryPart {
  text: string;
  /** Set on the heat-stress part so themes can show its NEA band colour. */
  heatTone?: HeatStressTone;
}

/** The same summary as parts, so the hero can mark up the heat-stress phrase. */
export function outdoorSummaryParts(weather: WeatherSnapshot, today?: string): SummaryPart[] {
  const parts: SummaryPart[] = [];

  const storm = stormPart(weather.condition, weather.forecast_periods ?? [], today);
  if (storm) parts.push({ text: storm });

  const heat = heatStressView(weather);
  if (heat.kind === 'reading' && heat.level)
    parts.push({ text: `Heat stress ${heat.level.toLowerCase()}`, heatTone: heat.tone });

  // UV earns a place only from High up; Low and Moderate change nobody's plans.
  const uv = uvBand(weather.uv_index);
  if (uv) parts.push({ text: `UV ${uv.toLowerCase()}` });

  const band = psiBand(weather.psi_twenty_four_hourly);
  if (band)
    parts.push({
      text: `PSI ${Math.round(weather.psi_twenty_four_hourly as number)} ${band.toLowerCase()}`,
    });

  return parts;
}
