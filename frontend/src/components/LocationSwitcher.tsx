import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { ConditionIcon } from './ConditionIcon';
import { ClockIcon, HomeIcon } from './icons';
import { readingFreshness } from './freshness';
import { formatTemperature } from './format';
import { prefersReducedMotion } from './motion';
import type { Location } from '../types';

interface LocationSwitcherProps {
  locations: Location[];
  homeId: number | undefined;
  now: number;
}

/**
 * Phone-width location list: one swipeable row of compact chips in the bottom dock, within thumb
 * reach. Chips only select; removing a place lives at the end of its page, away from this row.
 */
export function LocationSwitcher({ locations, homeId, now }: LocationSwitcherProps) {
  const { selectedId, select } = useStore();
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Keep the selected chip in view when selection changes elsewhere (a map pin, a new location).
  // Only the row scrolls horizontally; scrollIntoView would also jump the page vertically.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const chip = scroller?.querySelector<HTMLElement>('[data-selected="true"]');
    if (!scroller || !chip) return;
    const left = chip.offsetLeft - scroller.offsetLeft;
    const right = left + chip.offsetWidth;
    const pad = 16;
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
    if (left < scroller.scrollLeft + pad) {
      scroller.scrollTo({ left: left - pad, behavior });
    } else if (right > scroller.scrollLeft + scroller.clientWidth - pad) {
      scroller.scrollTo({ left: right - scroller.clientWidth + pad, behavior });
    }
  }, [selectedId, locations.length]);

  return (
    <div
      ref={scrollerRef}
      // Bottom padding leaves room for themes whose chips cast an offset shadow (Memphis, Sticker).
      className="switcher-row flex snap-x gap-2 overflow-x-auto scroll-px-3 px-3 pb-2 pt-0.5"
    >
      {locations.map((location) => {
        const isSelected = location.id === selectedId;
        const freshness = readingFreshness(location.weather.observed_at, now);
        const area =
          location.weather.area ||
          `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`;
        return (
          <button
            key={location.id}
            type="button"
            data-selected={isSelected}
            onClick={() => select(location.id)}
            aria-pressed={isSelected}
            className={`rounded-card flex min-h-11 shrink-0 snap-start items-center gap-2 border px-3.5 py-2 text-left transition ${
              isSelected
                ? 'border-white/30 bg-white/20 shadow-lg shadow-black/20'
                : 'border-white/10 bg-white/[0.07] active:bg-white/[0.14]'
            }`}
          >
            {location.id === homeId && <HomeIcon className="h-3.5 w-3.5 shrink-0 text-ink-muted" />}
            <span className="max-w-[9.5rem] truncate text-sm font-semibold text-white">{area}</span>
            {freshness.kind === 'stale' ? (
              // An old reading swaps its condition for a clock, so it can't pass for now.
              <>
                <ClockIcon className="h-4 w-4 shrink-0 text-ink-muted" />
                <span className="sr-only">Reading {freshness.age.toLowerCase()},</span>
              </>
            ) : (
              <ConditionIcon
                condition={location.weather.condition}
                className="h-4 w-4 shrink-0 text-ink-muted"
              />
            )}
            <span className="text-sm font-light tabular-nums text-ink-muted">
              {formatTemperature(location.weather.temperature_c)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
