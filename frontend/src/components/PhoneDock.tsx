import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore, useSelectedLocation } from '../state/store';
import { DockSheet } from './DockSheet';
import { LocationSwitcher } from './LocationSwitcher';
import { RefreshAll, bulkRefreshMessage } from './RefreshAll';
import { RefreshIcon } from './icons';
import { staleLocationIds } from './freshness';
import { useNow } from './map/useNow';

/**
 * Phones only: the two things a thumb does most, switching place and refreshing it, in one bar
 * along the bottom edge. The bar stays one row; when several places are out of date, Refresh
 * carries a count and opens a sheet offering this place or all of them.
 * Opaque, because it floats over the page (the Opaque Pop-up Rule).
 */
export function PhoneDock() {
  const { locations, refresh, refreshingId, bulkRefresh } = useStore();
  const selected = useSelectedLocation();
  const now = useNow(60_000);
  const dockRef = useRef<HTMLElement>(null);
  const refreshButtonRef = useRef<HTMLButtonElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const hasDock = locations.length > 0;

  // Publishing the dock's height lets the page end, the undo toast and the sheets sit clear of
  // it (ThemeSelector, DeleteToast, DockSheet read --dock-height).
  useEffect(() => {
    const dock = dockRef.current;
    const root = document.documentElement;
    if (!dock) return;
    const publish = () => root.style.setProperty('--dock-height', `${dock.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(dock);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--dock-height');
    };
  }, [hasDock]);

  const staleCount = staleLocationIds(locations, now).length;
  const bulkRunning = bulkRefresh?.status === 'running';
  // The sheet earns its tap only when there is more than one thing to refresh, or a run to follow.
  const offersSheet = staleCount >= 2 || bulkRefresh !== null;

  // Nothing left to choose (the run finished and its result cleared): fold the sheet away.
  // Adjusted during render, as React advises for state derived from other state.
  if (sheetOpen && !offersSheet) setSheetOpen(false);

  if (!hasDock) return null;

  const isRefreshing = selected != null && refreshingId === selected.id;
  const area = selected
    ? selected.weather?.area || `${selected.latitude.toFixed(3)}, ${selected.longitude.toFixed(3)}`
    : '';
  const sheetId = 'dock-refresh-sheet';

  return (
    <>
      <nav
        ref={dockRef}
        // Distinct from the sidebar's "Saved locations" landmark, which phones also show.
        aria-label="Switch place and refresh"
        className="phone-dock app-popover fixed inset-x-0 bottom-0 z-40 flex items-center gap-1 border-t border-white/10 pb-[max(0.25rem,env(safe-area-inset-bottom))] pr-3 pt-2 md:hidden"
      >
        <div className="min-w-0 flex-1">
          <LocationSwitcher locations={locations} homeId={locations[0]?.id} now={now} />
        </div>
        {selected && (
          <button
            ref={refreshButtonRef}
            type="button"
            onClick={() =>
              offersSheet ? setSheetOpen((open) => !open) : void refresh(selected.id)
            }
            disabled={!offersSheet && isRefreshing}
            aria-busy={isRefreshing || bulkRunning}
            aria-expanded={offersSheet ? sheetOpen : undefined}
            aria-controls={offersSheet && sheetOpen ? sheetId : undefined}
            aria-label={
              offersSheet
                ? `Refresh options, ${staleCount} ${staleCount === 1 ? 'place' : 'places'} out of date`
                : isRefreshing
                  ? `Refreshing ${area}`
                  : `Refresh ${area}`
            }
            className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white/90 active:bg-white/[0.16] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshIcon
              className={`h-5 w-5 ${isRefreshing || bulkRunning ? 'animate-spin' : ''}`}
            />
            {offersSheet && !bulkRunning && staleCount >= 2 && (
              <span
                aria-hidden="true"
                className="dock-badge absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums"
              >
                {staleCount}
              </span>
            )}
          </button>
        )}
        {/* The sheet's own status line announces a run while it is open; this one covers a run
            the user folded away mid-way, so progress and the result are never silent. */}
        <span className="sr-only" role="status">
          {sheetOpen ? '' : bulkRefreshMessage(bulkRefresh)}
        </span>
      </nav>

      <DockSheet
        id={sheetId}
        label="Refresh options"
        open={sheetOpen}
        onClose={closeSheet}
        triggerRef={refreshButtonRef}
      >
        <div className="grid gap-2">
          <RefreshAll placement="sheet" now={now} />
          {selected && (
            <button
              type="button"
              onClick={() => {
                void refresh(selected.id);
                setSheetOpen(false);
              }}
              disabled={isRefreshing || bulkRunning}
              className="flex min-h-11 items-center justify-center gap-2 rounded-card border border-white/15 bg-white/[0.07] px-3 text-sm font-medium text-white/85 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshIcon className="h-4 w-4 shrink-0" />
              Refresh {area} only
            </button>
          )}
        </div>
      </DockSheet>
    </>
  );
}
