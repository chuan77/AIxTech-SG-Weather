import { useEffect, useMemo, useRef, useState } from 'react';
import { logInteraction } from '../api';
import { useStore } from '../state/store';
import {
  classifyPosition,
  geolocateLogPayload,
  geolocateMessage,
  isUntestedBrowser,
  type GeolocateMessage,
} from './geolocate';
import { requestPosition, type GeolocateFailure } from './geolocation';
import { CloseIcon, LocateIcon } from './icons';

type Status = 'idle' | 'locating' | 'adding';

function isFailure(value: unknown): value is GeolocateFailure {
  return typeof value === 'object' && value !== null && 'reason' in value;
}

/**
 * "Use my location" (specs/003-use-my-location): one press asks the browser for the position
 * once, then adds it, selects the saved place already there, or explains why it couldn't.
 * Renders as a fragment so the sidebar row lays out the button beside "Add Location".
 */
export function UseMyLocation() {
  const { locations, create, select, isAdding } = useStore();
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<GeolocateMessage | null>(null);
  // Bumped on unmount, so a position arriving after the sidebar is gone is dropped.
  const attemptRef = useRef(0);
  const untestedBrowser = useMemo(
    () => typeof navigator !== 'undefined' && isUntestedBrowser(navigator.userAgent),
    [],
  );

  useEffect(() => {
    const attempts = attemptRef;
    return () => {
      attempts.current += 1;
    };
  }, []);

  // Opening the add form starts a fresh action, so an old message clears (FR-011). Adjusted
  // during render rather than in an effect, so there is no extra render with a stale message.
  const [seenAdding, setSeenAdding] = useState(isAdding);
  if (isAdding !== seenAdding) {
    setSeenAdding(isAdding);
    if (isAdding) setMessage(null);
  }

  const busy = status !== 'idle';

  const locate = async () => {
    if (busy) return; // one attempt at a time (FR-004)
    const attempt = ++attemptRef.current;
    const current = () => attempt === attemptRef.current;
    setMessage(null);
    setStatus('locating');
    logInteraction('location_geolocate_requested', {});

    let position;
    try {
      position = await requestPosition();
    } catch (failure) {
      if (!current()) return;
      const reason = isFailure(failure) ? failure.reason : 'unavailable';
      setStatus('idle');
      setMessage(geolocateMessage({ kind: 'failure', reason, untestedBrowser }));
      logInteraction('location_geolocate_result', geolocateLogPayload(reason));
      return;
    }
    if (!current()) return;

    const outcome = classifyPosition(position, locations);

    if (outcome.kind === 'outside') {
      // No request: the server would reject it, and its message talks about typed coordinates.
      setStatus('idle');
      setMessage(geolocateMessage({ kind: 'outside' }));
      logInteraction('location_geolocate_result', geolocateLogPayload('outside'));
      return;
    }

    if (outcome.kind === 'existing') {
      const { location } = outcome;
      const area =
        location.weather?.area ||
        `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`;
      select(location.id);
      setStatus('idle');
      setMessage(geolocateMessage({ kind: 'existing', area }));
      logInteraction('location_geolocate_result', geolocateLogPayload('already-saved', area));
      return;
    }

    setStatus('adding');
    try {
      await create(
        { latitude: outcome.latitude, longitude: outcome.longitude },
        { source: 'geolocation' },
      );
      if (!current()) return;
      setStatus('idle');
      logInteraction('location_geolocate_result', geolocateLogPayload('success'));
    } catch (err) {
      if (!current()) return;
      const detail = err instanceof Error ? err.message : 'Request failed';
      setStatus('idle');
      setMessage(geolocateMessage({ kind: 'create-failed', detail }));
      logInteraction('location_geolocate_result', geolocateLogPayload('create-failed'));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void locate()}
        disabled={busy}
        aria-busy={busy}
        className="flex min-h-11 flex-auto items-center justify-center gap-2 whitespace-nowrap rounded-card border border-white/15 bg-white/[0.07] px-3 py-2.5 text-sm font-medium text-white/85 backdrop-blur-xl hover:bg-white/[0.12] disabled:cursor-wait disabled:opacity-70"
      >
        <LocateIcon className="h-4 w-4 shrink-0" />
        <span>{busy ? 'Finding you…' : 'Use my location'}</span>
      </button>
      {message && (
        <div
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`order-1 flex basis-full items-start gap-1 ${
            message.tone === 'error'
              ? 'rounded-md app-error py-1.5 pl-2.5 pr-1 text-xs'
              : 'pl-0.5 text-xs text-ink-muted'
          }`}
        >
          <p className="min-w-0 flex-1 self-center">{message.text}</p>
          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="Dismiss"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10 md:pointer-fine:min-h-6 md:pointer-fine:min-w-6"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
