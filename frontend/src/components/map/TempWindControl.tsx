import { useEffect, useId, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { RefreshIcon, ThermometerIcon } from '../icons';
import {
  shouldAutoOpenTempWindLegend,
  TEMP_WIND_LEVELS,
  TEMP_WIND_LICENCE_NAME,
  TEMP_WIND_LICENCE_NOTICE,
  TEMP_WIND_LICENCE_URL,
  tempWindStatusMessage,
  type MarkKind,
} from './tempWindHelpers';
import { tempWindMarkup } from './tempWindMarker';
import { useNow } from './useNow';

const BUTTON =
  'z-[1000] flex h-11 items-center justify-center rounded-full map-control backdrop-blur-xl disabled:opacity-60';

/** One map mark, drawn from the same markup as the map (static, built from our own constants). */
function TempWindSymbol({ kind, temperature = '' }: { kind: MarkKind; temperature?: string }) {
  return (
    <span
      className="flex shrink-0 items-center"
      aria-hidden="true"
      // The markup is ours (constant shapes, no API text), so it is safe as HTML.
      dangerouslySetInnerHTML={{ __html: tempWindMarkup(kind, temperature, 0, '') }}
    />
  );
}

/** The legend (spec US2): every strength level, calm and no reading, plus the licence notice. */
export function TempWindLegend({ id }: { id?: string }) {
  return (
    <div id={id} className="tw-legend w-64 text-xs">
      <p className="mb-1.5 font-semibold">Temperature &amp; wind</p>
      <p className="mb-1.5">Arrows point the way the wind is blowing. Bigger means stronger.</p>
      <ul className="space-y-1">
        {TEMP_WIND_LEVELS.map((entry) => (
          <li key={entry.level} className="flex items-center gap-2">
            <TempWindSymbol
              kind={{
                wind: entry.level === 'calm' ? 'calm' : 'arrow',
                level: entry.level,
                temp: 'value',
              }}
              temperature="27.0°"
            />
            <span>
              <strong>{entry.label}</strong> · {entry.range}
            </span>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <TempWindSymbol
            kind={{ wind: 'missing', level: null, temp: 'missing' }}
            temperature="–°"
          />
          <span>No reading</span>
        </li>
      </ul>
      <p className="mt-1.5 opacity-80">
        {TEMP_WIND_LICENCE_NOTICE}{' '}
        <a
          href={TEMP_WIND_LICENCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {TEMP_WIND_LICENCE_NAME}
        </a>
        .
      </p>
    </div>
  );
}

/** The refresh button, shown while the view is on. */
export function TempWindRefreshButton() {
  const { tempWind } = useStore();
  const isLoading = tempWind.status === 'loading';
  if (!tempWind.enabled) return null;
  return (
    <button
      type="button"
      onClick={() => void tempWind.refresh('refresh')}
      disabled={isLoading}
      aria-busy={isLoading}
      aria-label="Refresh temperature & wind"
      className={`${BUTTON} w-11`}
    >
      <RefreshIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
    </button>
  );
}

/** The on/off switch (full-screen map only). */
export function TempWindSwitch() {
  const { tempWind } = useStore();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={tempWind.enabled}
      aria-label="Temperature & wind"
      onClick={() => tempWind.setEnabled(!tempWind.enabled)}
      className={`${BUTTON} gap-1.5 px-3 text-sm`}
    >
      <ThermometerIcon className="h-4 w-4" />
      <span aria-hidden="true">{tempWind.enabled ? 'On' : 'Off'}</span>
    </button>
  );
}

/** The status line (unpositioned) with the legend: prompt, station count, reading time and age. */
export function TempWindStatusStrip() {
  const { tempWind } = useStore();
  const now = useNow(30_000, tempWind.observation);
  const message = tempWindStatusMessage(tempWind.status, tempWind.observation, now);
  const [keyOpen, setKeyOpen] = useState(false);
  const keyId = useId();
  const keyButtonRef = useRef<HTMLButtonElement>(null);
  const { legendSeen, markLegendSeen, status } = tempWind;

  // The first time readings show, open the legend so the marks are explained (state is adjusted
  // while rendering, as React recommends), then remember that it has been seen.
  const autoOpen = shouldAutoOpenTempWindLegend(legendSeen, status);
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
          <TempWindLegend id={keyId} />
        </div>
      )}
      <div
        role="status"
        data-testid="temp-wind-status"
        className="rounded-xl map-control px-3 py-1.5 text-xs backdrop-blur-xl"
      >
        {tempWind.status === 'idle' ? (
          <button
            type="button"
            onClick={() => void tempWind.refresh('prompt')}
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
