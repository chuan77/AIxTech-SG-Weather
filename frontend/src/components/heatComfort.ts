import type { BandId } from './feelsLike';
import type { HeatStressTone } from './heatStress';

const FEELS_HOT: readonly BandId[] = ['hot-muggy', 'scorching'];
const FEELS_MILD: readonly BandId[] = ['chilly', 'breezy-cool', 'warm'];

/**
 * One line for when "feels like" and NEA heat stress seem to disagree, so the user isn't left to
 * referee "Scorching" against "Low". It says only what is true of the two measures: WBGT also
 * counts sun and wind, and NEA's heat-stress advisory is based on it. It gives no advice of its
 * own; Moderate and High already carry NEA's guidance in the WBGT column.
 *
 * `past` words it for a stale reading, which describes then, not now.
 */
export function heatReconcileLine(
  feelsBand: BandId | null,
  feelsLabel: string | null,
  tone: HeatStressTone,
  level: string | null,
  past = false,
): string | null {
  if (!feelsBand || !level) return null;
  const was = past ? 'was' : 'is';
  const feels = past ? 'Felt' : 'Feels';

  if (tone === 'low' && FEELS_HOT.includes(feelsBand)) {
    return `${feels} ${feelsLabel?.toLowerCase() ?? 'hot'}, but heat stress ${was} ${level}. Heat stress (WBGT) also counts sun and wind, and NEA’s heat-stress advisory is based on it.`;
  }
  if ((tone === 'moderate' || tone === 'high') && FEELS_MILD.includes(feelsBand)) {
    return `Heat stress ${was} ${level} even though it ${past ? 'felt' : 'feels'} ${feelsLabel?.toLowerCase() ?? 'mild'}: WBGT also counts sun and wind. Follow the heat-stress advice.`;
  }
  return null;
}
