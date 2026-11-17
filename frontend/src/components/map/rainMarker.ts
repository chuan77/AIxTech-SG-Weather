import { escapeHtml } from './pinMarkup';
import type { RainMarkKind } from './rainHelpers';

/**
 * How one rain station looks on the map (spec 011, research R7). Levels differ by size and
 * shape as well as colour: dry is a small ring, wet levels a drop that grows with heaviness, and
 * "no reading" a dashed ring with a dash, so it can never be read as dry. Colours come from the
 * theme's `--rain-*` variables (`.rain-mark` in index.css), never from here.
 */

export const RAIN_MARK_KINDS: readonly RainMarkKind[] = [
  'dry',
  'light',
  'moderate',
  'heavy',
  'missing',
];

const SIZE_PX: Record<RainMarkKind, number> = {
  dry: 10,
  light: 14,
  moderate: 18,
  heavy: 24,
  missing: 14,
};

/** A rounded drop in a 24x24 box. */
export const RAIN_DROP_PATH = 'M12 2C12 2 4 11 4 15.5a8 8 0 0 0 16 0C20 11 12 2 12 2Z';

export function rainSizePx(kind: RainMarkKind): number {
  return SIZE_PX[kind];
}

function shape(kind: RainMarkKind): string {
  if (kind === 'dry')
    return '<svg aria-hidden="true" focusable="false" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"></circle></svg>';
  if (kind === 'missing') {
    return (
      '<svg aria-hidden="true" focusable="false" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6"></circle>' +
      '<path class="rain-missing__dash" d="M4.5 7h5"></path></svg>'
    );
  }
  return `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="${RAIN_DROP_PATH}"></path></svg>`;
}

/** The marker's HTML for Leaflet's divIcon. `label` names the station for screen readers. */
export function rainMarkup(kind: RainMarkKind, partial: boolean, label: string): string {
  const size = rainSizePx(kind);
  const classes = `rain-mark rain-${kind}${partial ? ' rain-partial' : ''}`;
  return (
    `<div class="${classes}" style="width:${size}px;height:${size}px">` +
    `<span class="sr-only">${escapeHtml(label)}</span>${shape(kind)}</div>`
  );
}
