import { useEffect, useId, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { RainIcon, RefreshIcon } from '../icons';
import {
  RAIN_LEVELS,
  RAIN_LICENCE_NAME,
  RAIN_LICENCE_NOTICE,
  RAIN_LICENCE_URL,
  rainStatusMessage,
  shouldAutoOpenLegend,
  type RainMarkKind,
} from './rainHelpers';
import { rainMarkup } from './rainMarker';
import { useNow } from './useNow';

const BUTTON =
  'z-[1000] flex h-11 items-center justify-center rounded-full map-control backdrop-blur-xl disabled:opacity-60';

/** One map symbol, drawn from the same markup as the map (static, built from our own constants). */
function RainSymbol({ kind, partial = false }: { kind: RainMarkKind; partial?: boolean }) {
  return (
    <span
      className="flex w-7 shrink-0 items-center justify-center"
      aria-hidden="true"
      // The markup is ours (constant shapes, no API text), so it is safe as HTML.
      dangerouslySetInnerHTML={{ __html: rainMarkup(kind, partial, '') }}
    />
  );
}

/** The heaviness legend (spec US2): every level with its range, plus dry, no reading and partial. */
export function RainLegend({ id }: { id?: string }) {
  return (
    <div id={id} className="rain-legend w-64 text-xs">
      <p className="mb-1.5 font-semibold">Rain in the last 15 minutes</p>
      <ul className="space-y-1">
        {RAIN_LEVELS.map((entry) => (
          <li key={entry.level} className="flex items-center gap-2">
            <RainSymbol kind={entry.level} />
            <span>
              <strong>{entry.label}</strong> · {entry.rangeMm} ({entry.rangePerHour})
            </span>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <RainSymbol kind="dry" />
          <span>Dry (0 mm)</span>
        </li>
        <li className="flex items-center gap-2">
          <RainSymbol kind="missing" />
          <span>No reading</span>
        </li>
        <li className="flex items-center gap-2">
          <RainSymbol kind="light" partial />
          <span>Partial: under 15 minutes covered</span>
        </li>
      </ul>
      <p className="mt-1.5 opacity-80">
        {RAIN_LICENCE_NOTICE}{' '}
        <a href={RAIN_LICENCE_URL} target="_blank" rel="noopener noreferrer" className="underline">
          {RAIN_LICENCE_NAME}
        </a>
        .
      </p>
    </div>
  );
}

/** Rain's refresh button, shown while rain is on. */
export function RainRefreshButton() {
  const { rain } = useStore();
  const isLoading = rain.status === 'loading';
  if (!rain.enabled) return null;
  return (
    <button
      type="button"
      onClick={() => void rain.refresh()}
      disabled={isLoading}
      aria-busy={isLoading}
      aria-label="Refresh rain"
      className={`${BUTTON} w-11`}
    >
      <RefreshIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
    </button>
  );
}

/** Rain's on/off switch. */
export function RainSwitch() {
  const { rain } = useStore();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={rain.enabled}
      aria-label="Rain"
      onClick={() => rain.setEnabled(!rain.enabled)}
      className={`${BUTTON} gap-1.5 px-3 text-sm`}
    >
      <RainIcon className="h-4 w-4" />
      <span aria-hidden="true">{rain.enabled ? 'On' : 'Off'}</span>
    </button>
  );
}

/** The full-screen map's rain switch and refresh button. */
export function RainControl({ className }: { className: string }) {
  return (
    <div className={`absolute z-[1000] flex items-center gap-2 ${className}`}>
      <RainRefreshButton />
      <RainSwitch />
    </div>
  );
}

/** Rain's status line (unpositioned) with the legend: prompt, count, reading time and age. */
export function RainStatusStrip() {
  const { rain } = useStore();
  const now = useNow(30_000, rain.observation);
  const message = rainStatusMessage(rain.status, rain.observation, now);
  const [keyOpen, setKeyOpen] = useState(false);
  const keyId = useId();
  const keyButtonRef = useRef<HTMLButtonElement>(null);
  const { legendSeen, markLegendSeen, status } = rain;

  // The first time readings show, open the legend so the symbols are explained (state is
  // adjusted while rendering, as React recommends), then remember that it has been seen.
  const autoOpen = shouldAutoOpenLegend(legendSeen, status);
  if (autoOpen && !keyOpen) setKeyOpen(true);
  useEffect(() => {
    if (autoOpen) markLegendSeen();
  }, [autoOpen, markLegendSeen]);

  useEffect(() => {
    if (!keyOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Only the legend closes; the full-screen map's own Escape handler must not also fire.
      event.stopPropagation();
      setKeyOpen(false);
      keyButtonRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [keyOpen]);

  return (
    <div className="relative">
      {keyOpen && (
        <div className="rounded-card absolute bottom-full left-0 mb-2 rounded-xl map-control px-3 py-2 backdrop-blur-xl">
          <RainLegend id={keyId} />
        </div>
      )}
      <div role="status" className="rounded-xl map-control px-3 py-1.5 text-xs backdrop-blur-xl">
        {rain.status === 'idle' ? (
          <button
            type="button"
            onClick={() => void rain.refresh('prompt')}
            className="-my-3 inline-flex min-h-11 items-center underline md:pointer-fine:-my-1 md:pointer-fine:min-h-6"
          >
            {message.text}
          </button>
        ) : (
          <span>{message.text}</span>
        )}
        {message.updatedText && <span className="ml-2">{message.updatedText}</span>}
        <button
          ref={keyButtonRef}
          type="button"
          aria-expanded={keyOpen}
          aria-controls={keyId}
          onClick={() => setKeyOpen((open) => !open)}
          className="-my-3 ml-2 inline-flex min-h-11 items-center underline md:pointer-fine:-my-1 md:pointer-fine:min-h-6"
        >
          Legend
        </button>
      </div>
    </div>
  );
}
