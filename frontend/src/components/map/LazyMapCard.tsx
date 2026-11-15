import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { MapIcon } from '../icons';
import { TileShell } from '../Tiles';

// Leaflet, react-leaflet and their CSS ship in this chunk, fetched only when the map nears view.
const MapCard = lazy(() => import('./MapCard').then((module) => ({ default: module.MapCard })));

/** Start loading this far before the card scrolls into view, so it is usually ready on arrival. */
const PRELOAD_MARGIN = '600px';

/**
 * The map card's shell, same size and heading as the real one, so nothing shifts when it loads.
 * Not focusable and says nothing extra: the real card replaces it within a moment of approach.
 */
function MapPlaceholder() {
  return (
    <TileShell icon={<MapIcon />} title="Map" level={2}>
      <div className="h-56 rounded-xl bg-white/[0.06] sm:h-72 lg:h-80" />
    </TileShell>
  );
}

/**
 * The map sits below the outdoor readings, so a phone glance never needs it. Its code (most of
 * Leaflet) is split out and loaded only when the card comes within {@link PRELOAD_MARGIN} of the
 * viewport, or straight away where IntersectionObserver is missing.
 */
export function LazyMapCard() {
  const { locations } = useStore();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (near) return;
    const anchor = anchorRef.current;
    if (!anchor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin: PRELOAD_MARGIN },
    );
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [near]);

  // Same rule as MapCard: no saved places, no map.
  if (locations.length === 0) return null;

  return (
    <div ref={anchorRef}>
      {near ? (
        <Suspense fallback={<MapPlaceholder />}>
          <MapCard />
        </Suspense>
      ) : (
        <MapPlaceholder />
      )}
    </div>
  );
}
