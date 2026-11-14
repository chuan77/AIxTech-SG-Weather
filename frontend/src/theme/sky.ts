import type { WeatherSnapshot } from '../types';
import { heatStressView } from '../components/heatStress';
import { thunderNow } from '../components/outdoorSummary';

/**
 * The sky the Singapore theme paints behind the selected location, read from its stored snapshot.
 * Other themes ignore it. 'calm' is also the answer when a reading is missing: the sky never guesses.
 */
export type SkyState = 'storm' | 'haze' | 'heat' | 'calm';

/** PSI above this is NEA's "Unhealthy" band and up, the point where haze changes the day. */
export const HAZE_PSI_THRESHOLD = 100;

/** Precedence follows "can I go outside?": lightning first, then air, then heat. */
export function skyState(weather: WeatherSnapshot | null | undefined): SkyState {
  if (!weather) return 'calm';
  if (thunderNow(weather.condition, weather.forecast_periods ?? [])) return 'storm';
  const psi = weather.psi_twenty_four_hourly;
  if (typeof psi === 'number' && Number.isFinite(psi) && psi > HAZE_PSI_THRESHOLD) return 'haze';
  const heat = heatStressView(weather);
  if (heat.kind === 'reading' && heat.tone === 'high') return 'heat';
  return 'calm';
}

export function applySky(state: SkyState): void {
  document.documentElement.dataset.sky = state;
}
