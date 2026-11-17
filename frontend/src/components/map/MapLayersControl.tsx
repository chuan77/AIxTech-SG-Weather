import { useEffect, useId, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { LayersIcon } from '../icons';
import { LightningButtons } from './LightningControl';
import { statusMessage } from './lightningHelpers';
import { combinedStatusSegments, layersLabel } from './rainHelpers';
import { RainLegend, RainRefreshButton, RainSwitch } from './RainControl';
import { useNow } from './useNow';

const BUTTON =
  'z-[1000] flex h-11 items-center justify-center rounded-full map-control backdrop-blur-xl disabled:opacity-60';

interface MapLayersControlProps {
  /** Positions the Layers button inside the card map. */
  className: string;
}

/**
 * The card map's controls (spec 011, Gate 2): one Layers button holding the Rain and Lightning
 * switches, and one single-line strip for both, so a 224 px card isn't covered by controls.
 */
export function MapLayersControl({ className }: MapLayersControlProps) {
  const { rain, lightning } = useStore();
  const [open, setOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const menuId = useId();
  const keyId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const now = useNow(
    30_000,
    `${rain.observation?.fetched_at}|${lightning.observation?.fetched_at}`,
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const lightningText = lightning.enabled
    ? statusMessage(lightning.status, lightning.observation, now).text
    : null;
  const segments = combinedStatusSegments(rain, lightningText, now);
  const anyIdle =
    (rain.enabled && rain.status === 'idle') || (lightning.enabled && lightning.status === 'idle');

  // Tapping the strip loads whatever is waiting on its first action, else opens the menu.
  const onStripTap = () => {
    if (!anyIdle) {
      setOpen(true);
      return;
    }
    if (rain.enabled && rain.status === 'idle') void rain.refresh('prompt');
    if (lightning.enabled && lightning.status === 'idle') void lightning.refresh('prompt');
  };

  return (
    <>
      <div ref={rootRef} className={`absolute z-[1000] ${className}`}>
        <button
          ref={buttonRef}
          type="button"
          aria-label={layersLabel(rain.enabled, lightning.enabled)}
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((value) => !value)}
          className={`${BUTTON} gap-1.5 px-3 text-sm`}
        >
          <LayersIcon className="h-4 w-4" />
          <span aria-hidden="true">Layers</span>
        </button>
        {open && (
          <div
            id={menuId}
            // The card clips anything taller than itself, so the menu scrolls within the card's
            // height (224 / 288 / 320 px) and the key opens only on request.
            className="rounded-card absolute right-0 top-full mt-2 flex max-h-[9.5rem] w-max max-w-[min(18rem,calc(100vw-3rem))] flex-col gap-2 overflow-y-auto rounded-xl map-control p-2 backdrop-blur-xl sm:max-h-[13.5rem] lg:max-h-[15.5rem]"
          >
            <div className="flex items-center gap-2">
              <RainRefreshButton />
              <RainSwitch />
            </div>
            <div className="flex items-center gap-2">
              <LightningButtons />
            </div>
            {rain.enabled && (
              <div className="border-t border-[var(--map-control-border)] pt-1">
                <button
                  type="button"
                  aria-expanded={keyOpen}
                  aria-controls={keyId}
                  onClick={() => setKeyOpen((value) => !value)}
                  className="inline-flex min-h-11 items-center px-1 text-xs underline md:pointer-fine:min-h-6"
                >
                  {keyOpen ? 'Hide rain key' : 'Rain key'}
                </button>
                {keyOpen && <RainLegend id={keyId} />}
              </div>
            )}
          </div>
        )}
      </div>
      {segments.length > 0 && (
        <div
          role="status"
          // One line above the attribution row, which spans the card's full width on a phone.
          className="absolute bottom-8 left-2 right-2 z-[1000] flex"
        >
          <button
            type="button"
            onClick={onStripTap}
            className="min-h-11 max-w-full truncate rounded-xl map-control px-3 text-left text-xs backdrop-blur-xl md:pointer-fine:min-h-6 md:pointer-fine:py-1.5"
          >
            {anyIdle ? (
              <span className="underline">{segments.join('  ·  ')}</span>
            ) : (
              segments.join('  ·  ')
            )}
          </button>
        </div>
      )}
    </>
  );
}
