import { escapeHtml } from './pinMarkup';
import type { MarkKind, WindLevel } from './tempWindHelpers';

/**
 * How one temperature and wind station looks on the map (spec 015, research R7): a small label
 * with the temperature and an arrow pointing the way the wind blows. Strength is shown by the
 * arrow's size (and a heavier stroke when strong), never by colour alone. Colours come from the
 * theme's `--tw-*` variables (`.tw-mark` in index.css), never from here.
 */

const ARROW_PX: Record<Exclude<WindLevel, 'calm'>, number> = {
  light: 14,
  moderate: 18,
  strong: 22,
};
/** The "no wind reading" glyph matches a light arrow, so missing never looks like a value. */
const MISSING_PX = ARROW_PX.light;
const CALM_PX = 26;
/** Room for "27.4°" or "–°" at the label's text size. */
const TEMP_PX = 34;
const PADDING_X = 12;
const MIN_HEIGHT = 24;

/** An arrow pointing up (north) in a 24x24 box; the label rotates it to the wind. */
const ARROW_SVG =
  '<path d="M12 21V5"></path><path class="tw-arrow__head" d="M12 2 6.5 9.5h11Z"></path>';
/** Three wind lines struck through: a solid mark, unlike the dashed ring Gate 1 found faint. */
const MISSING_SVG =
  '<path d="M4 8h11M4 12h14M4 16h9"></path><path class="tw-wind-missing__strike" d="M4 20 20 4"></path>';

function windPx(kind: MarkKind): number {
  if (kind.wind === 'calm') return CALM_PX;
  if (kind.wind === 'missing' || !kind.level || kind.level === 'calm') return MISSING_PX;
  return ARROW_PX[kind.level];
}

/** The icon box for Leaflet (anchored at its centre) and the wind part's own size. */
export function tempWindSizePx(kind: MarkKind): { width: number; height: number; arrow: number } {
  const arrow = windPx(kind);
  return {
    width: PADDING_X + arrow + 4 + TEMP_PX,
    height: Math.max(MIN_HEIGHT, arrow + 8),
    arrow,
  };
}

function windMarkup(kind: MarkKind, rotationDeg: number): string {
  if (kind.wind === 'calm') return '<span class="tw-wind tw-calm">calm</span>';
  const size = windPx(kind);
  if (kind.wind === 'missing' || !kind.level || kind.level === 'calm') {
    return (
      `<span class="tw-wind tw-wind-missing" style="width:${size}px;height:${size}px">` +
      `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">${MISSING_SVG}</svg></span>`
    );
  }
  const rotation = Math.round(rotationDeg);
  return (
    `<span class="tw-wind tw-arrow tw-arrow-${kind.level}" style="width:${size}px;height:${size}px">` +
    `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" style="transform:rotate(${rotation}deg)">` +
    `${ARROW_SVG}</svg></span>`
  );
}

/**
 * The marker's HTML for Leaflet's divIcon. `temperatureText` comes from `formatTemperature`;
 * `label` names the station and its readings for screen readers. Both are escaped.
 */
export function tempWindMarkup(
  kind: MarkKind,
  temperatureText: string,
  rotationDeg: number,
  label: string,
): string {
  const tempClass = kind.temp === 'missing' ? 'tw-temp tw-temp-missing' : 'tw-temp';
  return (
    `<div class="tw-mark"><span class="sr-only">${escapeHtml(label)}</span>` +
    `${windMarkup(kind, rotationDeg)}` +
    `<span class="${tempClass}">${escapeHtml(temperatureText)}</span></div>`
  );
}
