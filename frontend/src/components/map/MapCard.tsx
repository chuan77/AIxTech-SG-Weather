import { useCallback, useRef, useState } from 'react';
import { logInteraction } from '../../api';
import { useStore } from '../../state/store';
import { ExpandIcon, MapIcon } from '../icons';
import { TileShell } from '../Tiles';
import { isCoarsePointer, type MapView } from './mapHelpers';
import { MapLayersControl } from './MapLayersControl';
import { MapFullscreen } from './MapFullscreen';
import { WeatherMap } from './WeatherMap';

export function MapCard() {
  const { locations, selectedId, select, refreshingId } = useStore();
  const [expanded, setExpanded] = useState(false);
  const viewRef = useRef<MapView | undefined>(undefined);
  // Snapshot of the card's view taken when the fullscreen map opens (refs can't be read in render).
  const [fullscreenView, setFullscreenView] = useState<MapView | undefined>(undefined);

  const handleSelect = useCallback((id: number) => select(id), [select]);
  const handleViewChange = useCallback((view: MapView) => {
    viewRef.current = view;
  }, []);
  const expand = useCallback(() => {
    logInteraction('map_expanded', { locations: locations.length });
    setFullscreenView(viewRef.current);
    setExpanded(true);
  }, [locations.length]);
  const collapse = useCallback(() => setExpanded(false), []);
  // A lightning group tapped in the card opens fullscreen on that group (the card never zooms).
  const openLightningGroup = useCallback((view: MapView) => {
    logInteraction('lightning_group_opened', { zoom: view.zoom });
    setFullscreenView(view);
    setExpanded(true);
  }, []);

  if (locations.length === 0) return null;

  // Refreshing the selected location re-centres the map on it, like selecting it does.
  const focusKey = `${selectedId}:${refreshingId === selectedId}`;

  return (
    <TileShell icon={<MapIcon />} title="Map" level={2}>
      <div className="relative isolate h-56 overflow-hidden rounded-xl sm:h-72 lg:h-80">
        <WeatherMap
          locations={locations}
          selectedId={selectedId}
          onSelect={handleSelect}
          interactive={false}
          focusKey={focusKey}
          onViewChange={handleViewChange}
          onBackgroundTap={isCoarsePointer() ? expand : undefined}
          // Under fullscreen the card's lightning and rain would be drawn twice for nothing (spec 009,
          // FR-009; spec 011).
          showLightning={!expanded}
          showRain={!expanded}
          onLightningGroupSelect={openLightningGroup}
        />
        {/* One Layers button and one strip on the 224 px card (spec 011, Gate 2). */}
        <MapLayersControl className="right-14 top-2" />
        <button
          type="button"
          onClick={expand}
          aria-label="Expand map to fullscreen"
          className="absolute right-2 top-2 z-[1000] flex h-11 w-11 items-center justify-center rounded-full map-control backdrop-blur-xl"
        >
          <ExpandIcon />
        </button>
      </div>
      {expanded && (
        <MapFullscreen
          locations={locations}
          selectedId={selectedId}
          onSelect={handleSelect}
          initialView={fullscreenView}
          focusKey={focusKey}
          onClose={collapse}
        />
      )}
    </TileShell>
  );
}
