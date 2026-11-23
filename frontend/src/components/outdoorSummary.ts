import type { WeatherSnapshot } from '../types';
import { forecastOutlook, type ForecastOutlook, type TimedForecast } from './forecastTiming';
import { heatStressView, type HeatStressTone } from './heatStress';
import { periodTimePhrase } from './periodLabel';

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

/** The first forecast of this kind still to come, from either source. */
function earliestUpcoming(forecasts: TimedForecast[], kind: TimedForecast['kind']) {
  return forecasts
    .flatMap((forecast) =>
      forecast.kind === kind && forecast.state === 'upcoming' ? [forecast] : [],
    )
    .sort((a, b) => a.window.start - b.window.start)[0];
}

/** NEA's wording in sentence case: "Light Rain" → "Light rain". */
function sentenceCase(text: string): string {
  const words = text.trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Period rain in force lasts to the end of its unbroken run of rain periods, called "Rain" when
 * their wordings differ. An end is named only when what follows the run is known.
 */
function rainRunPart({ now, periods }: ForecastOutlook): string | null {
  const first = periods.findIndex((p) => p.kind === 'rain' && p.state === 'active');
  if (first < 0) return null;

  const wordings = new Set<string>();
  let end = 0;
  let next = first;
  for (; next < periods.length; next++) {
    const { kind, text, window } = periods[next];
    if (kind !== 'rain' || !window) break;
    wordings.add(sentenceCase(text));
    end = window.end;
  }
  const wording = wordings.size === 1 ? [...wordings][0] : 'Rain';
  const following = periods.at(next);
  if (following && (following.missing || following.state === 'unknown')) {
    return `${wording} forecast`;
  }
  return `${wording} forecast until ${periodTimePhrase(end, now)}`;
}

/** The first rain forecast that applies. It is worded as a forecast, never as rain falling. */
function rainPart(outlook: ForecastOutlook): string | null {
  const { now, nearTerm, periods } = outlook;
  if (nearTerm.kind === 'rain') {
    if (nearTerm.state === 'active') return `${sentenceCase(nearTerm.text)} forecast now`;
    if (nearTerm.state === 'unknown') return `${sentenceCase(nearTerm.text)} forecast`;
  }
  const run = rainRunPart(outlook);
  if (run) return run;

  const forecasts = [nearTerm, ...periods];
  const next = earliestUpcoming(forecasts, 'rain');
  const thunder = earliestUpcoming(forecasts, 'thunder');
  // Rain is named only ahead of thunder, and untimed 2-hour thunder may already apply.
  const thunderMayBeNow = nearTerm.kind === 'thunder' && nearTerm.state === 'unknown';
  if (next && !thunderMayBeNow && (!thunder || next.window.start < thunder.window.start)) {
    return `${sentenceCase(next.text)} forecast from ${periodTimePhrase(next.window.start, now)}`;
  }
  const untimed = periods.find((p) => p.kind === 'rain' && p.state === 'unknown');
  return untimed ? `${sentenceCase(untimed.text)} forecast` : null;
}

function thunderPart({ now, nearTerm, periods }: ForecastOutlook): string | null {
  // An untimed 2-hour warning may already apply, so a later one mustn't postpone it.
  if (nearTerm.kind === 'thunder' && nearTerm.state === 'unknown') {
    return 'Thundery showers forecast';
  }
  const next = earliestUpcoming([nearTerm, ...periods], 'thunder');
  if (next) return `Thundery showers from ${periodTimePhrase(next.window.start, now)}`;
  const untimed = periods.some((p) => p.kind === 'thunder' && p.state === 'unknown');
  return untimed ? 'Thundery showers forecast' : null;
}

/**
 * Asked only when no rain or thunder still applies: "No storms forecast" also needs a forecast to
 * back it, with no gap where it still applies.
 */
function backsNoStorms({ nearTerm, periods }: ForecastOutlook): boolean {
  return (
    periods.some((p) => p.state === 'active' || p.state === 'upcoming') &&
    !periods.some((p) => p.missing && p.state !== 'ended') &&
    // Even ended, the 2-hour condition still shows under the top line.
    nearTerm.kind === 'other'
  );
}

/** What the line says about the weather, judged by the same outlook as the strip and the sky. */
function weatherPhrases(outlook: ForecastOutlook): string[] {
  if (outlook.thunderActive) return ['Thundery showers now'];
  const parts = [rainPart(outlook), thunderPart(outlook)].filter((part) => part !== null);
  if (parts.length > 0) return parts;
  return backsNoStorms(outlook) ? ['No storms forecast'] : [];
}

/**
 * The hero's answer to "can I go out?" at `now`: rain and storms, heat stress, UV (High and up) and PSI.
 * Parts with no reading are left out rather than guessed; null when nothing is known.
 */
export function outdoorSummary(weather: WeatherSnapshot, now: number): string | null {
  const parts = outdoorSummaryParts(weather, now);
  return parts.length > 0 ? parts.map((part) => part.text).join(' · ') : null;
}

export interface SummaryPart {
  text: string;
  /** Set on the heat-stress part so themes can show its NEA band colour. */
  heatTone?: HeatStressTone;
}

/** The same summary as parts, so the hero can mark up the heat-stress phrase. */
export function outdoorSummaryParts(weather: WeatherSnapshot, now: number): SummaryPart[] {
  const parts: SummaryPart[] = weatherPhrases(forecastOutlook(weather, now)).map((text) => ({
    text,
  }));

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
