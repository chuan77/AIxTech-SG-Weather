import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Location } from '../../types';
import { CloseIcon } from '../icons';
import { LightningControl } from './LightningControl';
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
      />
      <LightningControl className="right-[calc(max(0.75rem,env(safe-area-inset-right))+3.5rem)] top-[max(0.75rem,env(safe-area-inset-top))]" />
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close map"
        className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-[1000] flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/40 text-[#fff] backdrop-blur-xl hover:bg-black/55"
      >
        <CloseIcon className="h-5 w-5" />
      </button>
    </div>,
    document.body,
  );
}
