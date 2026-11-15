/**
 * How one lightning strike looks on the map: a filled bolt (no cloud, no chip, so it can't be
 * mistaken for a pin's thunderstorm glyph) that shrinks and fades in 5-minute steps. Colours come
 * from CSS theme variables (`.strike-mark` in index.css), never from here.
 */

export const STRIKE_STEPS = 12;
export const STRIKE_STEP_MINUTES = 5;

const MAX_SIZE_PX = 24;
const MIN_SIZE_PX = 14;
const MINUTE_MS = 60_000;

/** One closed bolt polygon in a 24x24 box. */
export const STRIKE_BOLT_PATH = 'M14 1.5 4.5 13.5H11L9.5 22.5 19.5 10H13Z';

/** floor(ageMinutes / 5), clamped to 0..11. Future times are newest; unreadable ones oldest. */
export function strikeStep(occurredAt: string, now: number): number {
  const occurred = Date.parse(occurredAt);
  if (!Number.isFinite(occurred)) return STRIKE_STEPS - 1;
  const ageMinutes = Math.max(0, (now - occurred) / MINUTE_MS);
  return Math.min(STRIKE_STEPS - 1, Math.floor(ageMinutes / STRIKE_STEP_MINUTES));
}

function fraction(step: number): number {
  return Math.min(1, Math.max(0, step / (STRIKE_STEPS - 1)));
}

/** Box size: 24 px for the newest step down to 14 px for the oldest. */
export function strikeSizePx(step: number): number {
  return Math.round(MAX_SIZE_PX - (MAX_SIZE_PX - MIN_SIZE_PX) * fraction(step));
}

/** 1 for the newest step down to 0 for the oldest; CSS maps it onto the theme's fill floor. */
export function strikeFresh(step: number): number {
  return Number((1 - fraction(step)).toFixed(3));
}

/** The marker's HTML for Leaflet's divIcon. The outline is never faded (see index.css). */
export function strikeMarkup(step: number): string {
  const size = strikeSizePx(step);
  return (
    `<div class="strike-mark" style="--strike-fresh:${strikeFresh(step)};width:${size}px;height:${size}px">` +
    `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="${STRIKE_BOLT_PATH}"></path></svg>` +
    `</div>`
  );
}
