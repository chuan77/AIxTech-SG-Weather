/**
 * How a group of lightning strikes looks on the map (spec 009): a round mark with a bolt and the
 * strike count, an age tab under it ("now", "2m" … "59m"), and a halo that fades with the newest
 * strike's age like single bolts do. Colours come from theme variables (`.strike-group` in
 * index.css), never from here. Labels are produced by lightningGroups.ts, never from strike data.
 */
import type { SizeBand } from './lightningGroups';
import { STRIKE_BOLT_PATH, strikeFresh } from './strikeMarker';

// Smaller than the 40 px grouping radius, so neighbouring groups rarely cover each other.
const SIZE_PX: Record<SizeBand, number> = { small: 28, medium: 32, large: 36 };

export function groupIconSizePx(sizeBand: SizeBand): number {
  return SIZE_PX[sizeBand];
}

export interface GroupMarkupInput {
  countLabel: string;
  ageLabel: string;
  step: number;
  sizeBand: SizeBand;
  count: number;
  splittable: boolean;
}

/** The divIcon HTML for one group mark. */
export function groupMarkup({
  countLabel,
  ageLabel,
  step,
  sizeBand,
  count,
  splittable,
}: GroupMarkupInput): string {
  return (
    `<div class="strike-group strike-group--${sizeBand}" data-count="${count}" data-step="${step}"` +
    ` data-splittable="${splittable}" style="--strike-fresh:${strikeFresh(step)}">` +
    `<span class="strike-group__halo"></span>` +
    `<span class="strike-group__core">` +
    `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="${STRIKE_BOLT_PATH}"></path></svg>` +
    `<span class="strike-group__count">${countLabel}</span>` +
    `</span>` +
    `<span class="strike-group__age">${ageLabel}</span>` +
    `</div>`
  );
}
