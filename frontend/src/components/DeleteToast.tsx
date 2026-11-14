import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { asSentence } from './format';
import { CloseIcon } from './icons';

/**
 * Undo window for a deleted location, and the error if the delete then fails.
 * The timer pauses while the toast is hovered or focused, so nobody is rushed (WCAG 2.2.1).
 */
export function DeleteToast() {
  const { pendingDelete, undoDelete, dismissDelete, holdDelete } = useStore();
  const undoRef = useRef<HTMLButtonElement>(null);
  const pendingId = pendingDelete?.status === 'pending' ? pendingDelete.id : null;

  // The delete button that had focus is gone with its location; hand focus to Undo
  // rather than dropping it on <body>.
  useEffect(() => {
    if (pendingId === null) return;
    const active = document.activeElement;
    if (!active || active === document.body) undoRef.current?.focus();
  }, [pendingId]);

  const failed = pendingDelete?.status === 'failed';

  return (
    // Always mounted so screen readers pick up the message when it appears.
    <div
      aria-live={failed ? 'assertive' : 'polite'}
      className="pointer-events-none fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-50 flex justify-center md:bottom-6"
    >
      {pendingDelete && (
        <div
          onPointerEnter={() => holdDelete(true)}
          onPointerLeave={() => holdDelete(false)}
          onFocus={() => holdDelete(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) holdDelete(false);
          }}
          className="app-popover pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-card border border-white/15 py-1.5 pl-4 pr-1.5 text-sm text-white shadow-lg shadow-black/30"
        >
          <p className={`min-w-0 flex-1 py-2 ${failed ? 'text-red-100' : ''}`}>
            {failed ? (
              <>
                Couldn’t delete <span className="font-semibold">{pendingDelete.name}</span>.{' '}
                {asSentence(pendingDelete.message ?? 'Request failed')} It’s still in your list.
              </>
            ) : (
              <>
                Deleted <span className="font-semibold">{pendingDelete.name}</span>
              </>
            )}
          </p>
          {!failed && (
            <button
              ref={undoRef}
              type="button"
              onClick={undoDelete}
              className="min-h-11 shrink-0 rounded-full px-4 font-semibold text-white hover:bg-white/10"
            >
              Undo
            </button>
          )}
          <button
            type="button"
            onClick={dismissDelete}
            aria-label={failed ? 'Dismiss error' : 'Dismiss'}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-white/10 hover:text-white"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
