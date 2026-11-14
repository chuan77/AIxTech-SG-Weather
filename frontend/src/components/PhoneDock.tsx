import { useStore, useSelectedLocation } from '../state/store';
import { LocationSwitcher } from './LocationSwitcher';
import { RefreshIcon } from './icons';
import { useNow } from './map/useNow';

/**
 * Phones only: the two things a thumb does most, switching place and refreshing it, in one bar
 * along the bottom edge. Opaque, because it floats over the page (the Opaque Pop-up Rule).
 */
export function PhoneDock() {
  const { locations, refresh, refreshingId } = useStore();
  const selected = useSelectedLocation();
  const now = useNow(60_000);

  if (locations.length === 0) return null;

  const isRefreshing = selected != null && refreshingId === selected.id;
  const area = selected
    ? selected.weather?.area || `${selected.latitude.toFixed(3)}, ${selected.longitude.toFixed(3)}`
    : '';

  return (
    <nav
      aria-label="Saved locations"
      className="phone-dock app-popover fixed inset-x-0 bottom-0 z-40 flex items-center gap-1 border-t border-white/10 pb-[max(0.25rem,env(safe-area-inset-bottom))] pr-3 pt-2 md:hidden"
    >
      <div className="min-w-0 flex-1">
        <LocationSwitcher locations={locations} homeId={locations[0]?.id} now={now} />
      </div>
      {selected && (
        <button
          type="button"
          onClick={() => void refresh(selected.id)}
          disabled={isRefreshing}
          aria-busy={isRefreshing}
          aria-label={isRefreshing ? `Refreshing ${area}` : `Refresh ${area}`}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white/90 active:bg-white/[0.16] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshIcon className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      )}
    </nav>
  );
}
