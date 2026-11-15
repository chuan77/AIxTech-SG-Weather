import { useEffect } from 'react';
import { useStore } from '../state/store';
import { CloseIcon, RefreshIcon } from './icons';
import { staleLocationIds } from './freshness';
import type { BulkRefresh } from '../types';

/** How long a clean result stays on screen before the control steps back. */
const RESULT_CLEAR_MS = 6000;

const PLACEMENT_CLASS = {
  // Desktop: under the add row, above the saved cards it renews. Phones use the dock instead.
  sidebar: 'hidden md:grid',
  // Phones: inside the sheet the dock's Refresh button opens, so the dock itself stays one row.
  sheet: 'grid',
} as const;

/** "Bishan", "Bishan and Jurong West", "Bishan, Jurong West and 2 more". */
export function joinPlaceNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

/** What a run says: progress, the result, or nothing. Shared with the dock's own live region. */
export function bulkRefreshMessage(run: BulkRefresh | null): string {
  if (!run) return '';
  const failedCount = run.status === 'running' ? 0 : run.failed.length;
  if (run.status === 'running') {
    return `Refreshing ${Math.min(run.done + 1, run.total)} of ${run.total}…`;
  }
  if (failedCount > 0) {
    const names = joinPlaceNames(run.failed.map((f) => f.name));
    return `Couldn’t refresh ${names}. ${run.done - failedCount} of ${run.done} updated.`;
  }
  if (run.status === 'stopped') return `Stopped after ${run.done} of ${run.total}.`;
  return `Refreshed ${run.done} ${run.done === 1 ? 'place' : 'places'}.`;
}

interface RefreshAllProps {
  placement: keyof typeof PLACEMENT_CLASS;
  now: number;
}

/**
 * "Refresh all": when two or more saved places hold out-of-date readings, one tap renews them in
 * turn. Shows progress with a Stop, then the result; places that failed get a Retry.
 */
export function RefreshAll({ placement, now }: RefreshAllProps) {
  const { locations, bulkRefresh, refreshAll, stopRefreshAll, clearBulkRefresh } = useStore();
  const staleIds = staleLocationIds(locations, now);
  const run = bulkRefresh;
  const isRunning = run?.status === 'running';
  const failedIds = run && !isRunning ? run.failed.map((f) => f.id) : [];
  const isClean = run !== null && !isRunning && failedIds.length === 0;

  useEffect(() => {
    if (!isClean) return;
    const timer = setTimeout(clearBulkRefresh, RESULT_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [isClean, clearBulkRefresh]);

  const showOffer = !isRunning && failedIds.length === 0 && staleIds.length >= 2;
  if (!run && !showOffer) return null;

  const message = bulkRefreshMessage(run);

  const button =
    'flex min-h-11 items-center justify-center gap-2 rounded-card border px-3 text-sm font-medium backdrop-blur-xl disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className={`gap-2 ${PLACEMENT_CLASS[placement]}`}>
      {/* Always mounted while shown, so progress and the result are announced as they change. */}
      <div role="status" aria-live="polite" className={message ? '' : 'sr-only'}>
        {message && (
          <div
            className={`flex items-center gap-2 rounded-card px-3 py-2 text-xs leading-snug ${
              failedIds.length > 0
                ? 'app-error '
                : 'text-ink-muted'
            }`}
          >
            {isRunning && <RefreshIcon className="h-3.5 w-3.5 shrink-0 animate-spin" />}
            <p className="min-w-0 flex-1 text-balance tabular-nums">{message}</p>
            {failedIds.length > 0 && (
              <button
                type="button"
                onClick={clearBulkRefresh}
                aria-label="Dismiss refresh result"
                className="-my-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10 md:pointer-fine:h-8 md:pointer-fine:w-8"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {isRunning && (
        <button
          type="button"
          onClick={stopRefreshAll}
          className={`${button} border-white/15 bg-white/[0.07] text-white/85 hover:bg-white/[0.12]`}
        >
          Stop after this place
        </button>
      )}
      {failedIds.length > 0 && (
        <button
          type="button"
          onClick={() => void refreshAll(failedIds)}
          className={`${button} border-white/15 bg-white/[0.07] text-white/85 hover:bg-white/[0.12]`}
        >
          <RefreshIcon className="h-4 w-4 shrink-0" />
          Retry {failedIds.length === 1 ? run?.failed[0].name : `${failedIds.length} places`}
        </button>
      )}
      {showOffer && (
        <button
          type="button"
          onClick={() => void refreshAll(staleIds)}
          className={`${button} border-white/15 bg-white/[0.07] text-white/85 hover:bg-white/[0.12]`}
        >
          <RefreshIcon className="h-4 w-4 shrink-0" />
          Refresh {staleIds.length} out-of-date places
        </button>
      )}
    </div>
  );
}
