import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { ConditionIcon } from './ConditionIcon';
import { ChevronUpIcon, ClockIcon, HomeIcon } from './icons';
import { DockSheet } from './DockSheet';
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
 * Phone-width location list in the bottom dock, within thumb reach: a swipeable row of chips for a
 * few places, a list sheet beyond that. Choosing only selects; removing a place lives at the end
 * of its page, away from the dock.
 */
/** Beyond this many places, a row of chips shows about one at a time; a list sheet takes over. */
export const MAX_CHIPS = 4;

function placeName(location: Location): string {
  return (
    location.weather.area || `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`
  );
}

/** Home mark, name, condition (or a clock for an old reading) and temperature. */
function PlaceSummary({
  location,
  isHome,
  now,
  truncate,
}: {
  location: Location;
  isHome: boolean;
  now: number;
  truncate: boolean;
}) {
  const freshness = readingFreshness(location.weather.observed_at, now);
  return (
    <>
      {isHome && <HomeIcon className="h-3.5 w-3.5 shrink-0 text-ink-muted" />}
      <span
        className={`text-sm font-semibold text-white ${truncate ? 'max-w-[9.5rem] truncate' : 'min-w-0 flex-1'}`}
      >
        {placeName(location)}
      </span>
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
    </>
  );
}

/**
 * More than a few places: the dock shows the selected one as a button, and a sheet lists them all
 * as full-width rows, so a thumb picks from a list instead of swiping past truncated chips.
 */
function PlacePicker({ locations, homeId, now }: LocationSwitcherProps) {
  const { selectedId, select } = useStore();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const selected = locations.find((l) => l.id === selectedId) ?? locations[0];
  const sheetId = 'dock-place-sheet';

  return (
    <div className="px-3 pb-2 pt-0.5">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? sheetId : undefined}
        aria-label={`Choose a place: ${placeName(selected)} selected, ${locations.length} saved`}
        className="rounded-card flex min-h-11 w-full items-center gap-2 border border-white/30 bg-white/20 px-3.5 py-2 text-left shadow-lg shadow-black/20"
      >
        <PlaceSummary
          location={selected}
          isHome={selected.id === homeId}
          now={now}
          truncate={false}
        />
        <ChevronUpIcon
          className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${open ? '' : 'rotate-180'}`}
        />
      </button>
      <DockSheet
        id={sheetId}
        label="Saved places"
        open={open}
        onClose={close}
        triggerRef={triggerRef}
      >
        <ul className="grid gap-1.5">
          {locations.map((location) => {
            const isSelected = location.id === selected.id;
            return (
              <li key={location.id}>
                <button
                  type="button"
                  data-autofocus={isSelected || undefined}
                  aria-current={isSelected ? 'true' : undefined}
                  onClick={() => {
                    select(location.id);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className={`rounded-card flex min-h-12 w-full items-center gap-2 border px-3.5 py-2 text-left ${
                    isSelected
                      ? 'border-white/30 bg-white/20'
                      : 'border-white/10 bg-white/[0.07] active:bg-white/[0.14]'
                  }`}
                >
                  <PlaceSummary
                    location={location}
                    isHome={location.id === homeId}
                    now={now}
                    truncate={false}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </DockSheet>
    </div>
  );
}

export function LocationSwitcher(props: LocationSwitcherProps) {
  return props.locations.length > MAX_CHIPS ? (
    <PlacePicker {...props} />
  ) : (
    <LocationChips {...props} />
  );
}

function LocationChips({ locations, homeId, now }: LocationSwitcherProps) {
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
            <PlaceSummary location={location} isHome={location.id === homeId} now={now} truncate />
          </button>
        );
      })}
    </div>
  );
}
