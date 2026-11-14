import { useStore } from '../state/store';
import { ConditionIcon } from './ConditionIcon';
import { ClockIcon, CloseIcon, HomeIcon } from './icons';
import { formatTemperature } from './format';
import { readingFreshness } from './freshness';
import type { Location } from '../types';

interface SidebarCardProps {
  location: Location;
  isHome: boolean;
  now: number;
}

export function SidebarCard({ location, isHome, now }: SidebarCardProps) {
  const { selectedId, select, remove } = useStore();
  const isSelected = selectedId === location.id;
  const freshness = readingFreshness(location.weather.observed_at, now);
  const isStale = freshness.kind === 'stale';
  const area =
    location.weather.area || `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`;
  const condition = location.weather.condition || '-';
  const temperature = formatTemperature(location.weather.temperature_c);
  const high = formatTemperature(location.weather.forecast_high_c);
  const low = formatTemperature(location.weather.forecast_low_c);

  return (
    <div
      data-selected={isSelected}
      className={`flex w-full shrink-0 overflow-hidden rounded-card border backdrop-blur-xl transition ${
        isSelected
          ? 'border-white/30 bg-white/20 shadow-lg shadow-black/20'
          : 'border-white/10 bg-white/[0.07] hover:bg-white/[0.12]'
      }`}
    >
      <button
        type="button"
        onClick={() => select(location.id)}
        aria-pressed={isSelected}
        className="block min-w-0 flex-1 cursor-pointer text-left focus-visible:outline-offset-[-3px]"
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-3">
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold leading-tight text-white">{area}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-muted">
              {/* Home is the first saved place; it still shows its reading time like every other card. */}
              {isHome && (
                <>
                  <HomeIcon className="h-3 w-3" />
                  <span>Home</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              {freshness.kind === 'none' ? (
                <span>Not refreshed</span>
              ) : isStale ? (
                // Old readings lead with their age; the exact time is one hover away.
                <span className="flex items-center gap-1 font-medium text-white/90" title={`Reading from ${freshness.when}`}>
                  <ClockIcon className="h-3 w-3" />
                  <span>{freshness.age}</span>
                </span>
              ) : (
                <span className="tabular-nums">{freshness.when}</span>
              )}
            </div>
          </div>
          <div
            className={`text-3xl font-light tabular-nums ${isStale ? 'text-ink-muted' : 'text-white/90'}`}
          >
            {temperature}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-white/10 px-4 py-2 text-xs">
          <div className="flex items-center gap-2 text-ink-muted">
            <ConditionIcon condition={location.weather.condition} className="h-4 w-4 shrink-0 text-ink-muted" />
            <span className="truncate">{condition}</span>
          </div>
          <div className="shrink-0 text-ink-muted tabular-nums">
            H:{high} L:{low}
          </div>
        </div>
      </button>
      {/* Its own 44px column behind a hairline, so a tap meant to select can't land on delete. */}
      <button
        type="button"
        onClick={() => remove(location.id)}
        aria-label={`Delete ${area}`}
        title="Delete location"
        className="flex w-11 shrink-0 items-start justify-center border-l border-white/10 pt-3 text-ink-muted transition hover:bg-white/10 hover:text-white focus-visible:outline-offset-[-3px]"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full">
          <CloseIcon className="h-4 w-4" />
        </span>
      </button>
    </div>
  );
}
