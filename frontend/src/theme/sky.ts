import type { WeatherSnapshot } from '../types';
import { heatStressView } from '../components/heatStress';
import { forecastOutlook } from '../components/forecastTiming';
import { readingFreshness } from '../components/freshness';

/**
 * The sky the Singapore theme paints behind the selected location, read from its stored snapshot.
 * Other themes ignore it. 'calm' is also the answer when a reading is missing or stale: the sky
 * never guesses.
 */
export type SkyState = 'storm' | 'haze' | 'heat' | 'calm';

/** PSI above this is NEA's "Unhealthy" band and up, the point where haze changes the day. */
export const HAZE_PSI_THRESHOLD = 100;

/** Precedence follows "can I go outside?": lightning first, then air, then heat. */
export function skyState(weather: WeatherSnapshot | null | undefined, now: number): SkyState {
  // An old reading can't vouch for the sky now, whatever it held.
  if (!weather || readingFreshness(weather.observed_at, now).kind === 'stale') return 'calm';
  if (forecastOutlook(weather, now).stormSky) return 'storm';
  const psi = weather.psi_twenty_four_hourly;
  if (typeof psi === 'number' && Number.isFinite(psi) && psi > HAZE_PSI_THRESHOLD) return 'haze';
  const heat = heatStressView(weather);
  if (heat.kind === 'reading' && heat.tone === 'high') return 'heat';
  return 'calm';
}

export function applySky(state: SkyState): void {
  document.documentElement.dataset.sky = state;
}
