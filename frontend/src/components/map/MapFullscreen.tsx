import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../../state/store';
import type { Location } from '../../types';
import { CloseIcon } from '../icons';
import { LightningButtons, LightningStatusStrip } from './LightningControl';
import { RainRefreshButton, RainStatusStrip, RainSwitch } from './RainControl';
import { TempWindRefreshButton, TempWindStatusStrip, TempWindSwitch } from './TempWindControl';
import type { MapView } from './mapHelpers';
import { WeatherMap } from './WeatherMap';

interface MapFullscreenProps {
  locations: Location[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  initialView?: MapView;
  focusKey?: string;
  onClose: () => void;
}

export function MapFullscreen({
  locations,
  selectedId,
  onSelect,
  initialView,
  focusKey,
  onClose,
}: MapFullscreenProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const { rain, lightning, tempWind } = useStore();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    root?.setAttribute('inert', '');
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      root?.removeAttribute('inert');
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Weather map"
      className="map-fullscreen fixed inset-0 z-50 h-dvh w-screen bg-[var(--map-background)]"
    >
      <WeatherMap
        locations={locations}
        selectedId={selectedId}
        onSelect={onSelect}
        interactive
        initialView={initialView}
        focusKey={focusKey}
        showTempWind
      />
      {/* The layer controls sit left of the close button and wrap onto a second row when they
          don't fit (375 px with temperature & wind on, spec 015). The row itself lets map
          gestures through; only the controls take taps. */}
      <div
        data-testid="map-layer-controls"
        className="pointer-events-none absolute left-[max(0.75rem,env(safe-area-inset-left))] right-[calc(max(0.75rem,env(safe-area-inset-right))+3.5rem)] top-[max(0.75rem,env(safe-area-inset-top))] z-[1000] flex flex-wrap items-center justify-end gap-2 [&>*]:pointer-events-auto"
      >
        <RainRefreshButton />
        <RainSwitch />
        <TempWindRefreshButton />
        <TempWindSwitch />
        <LightningButtons />
      </div>
      {(rain.enabled || tempWind.enabled || lightning.enabled) && (
        // Rain, then temperature & wind, then lightning, all above the attribution row.
        <div className="absolute bottom-8 left-2 z-[1000] flex max-w-[70%] flex-col items-start gap-1.5">
          {rain.enabled && <RainStatusStrip />}
          {tempWind.enabled && <TempWindStatusStrip />}
          {lightning.enabled && <LightningStatusStrip />}
        </div>
      )}
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close map"
        className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-[1000] flex h-11 w-11 items-center justify-center rounded-full map-control backdrop-blur-xl"
      >
        <CloseIcon className="h-5 w-5" />
      </button>
    </div>,
    document.body,
  );
}
