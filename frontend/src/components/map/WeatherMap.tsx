import { useEffect, useMemo, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Location } from '../../types';
import { useTheme } from '../../theme/ThemeContext';
import type { Basemap } from '../../theme/themes';
import { CloudIcon, RainIcon, SunIcon, ThunderIcon } from '../icons';
import {
  conditionToIcon,
  DEFAULT_ZOOM,
  formatPinLabel,
  getBounds,
  isCoarsePointer,
  SINGAPORE_CENTER,
  type MapView,
  type PinIconKey,
} from './mapHelpers';

const CARTO_API_KEY = import.meta.env.VITE_CARTO_API_KEY as string | undefined;

function tileUrl(basemap: Basemap): string {
  return CARTO_API_KEY
    ? `https://basemaps.cartocdn.com/rastertiles/${basemap}/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`
    : `https://{s}.basemaps.cartocdn.com/rastertiles/${basemap}/{z}/{x}/{y}.png`;
}
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const FOCUS_ZOOM = 13;
const PIN_WIDTH = 64;
const PIN_HEIGHT = 56;

const PIN_ICONS: Record<PinIconKey, typeof SunIcon> = {
  thunder: ThunderIcon,
  rain: RainIcon,
  cloud: CloudIcon,
  sun: SunIcon,
  unknown: CloudIcon,
};

function makePinIcon(location: Location, isSelected: boolean): L.DivIcon {
  const Icon = PIN_ICONS[conditionToIcon(location.weather?.condition)];
  const html = renderToStaticMarkup(
    <div className={`weather-pin${isSelected ? ' weather-pin--selected' : ''}`}>
      <div className="weather-pin__label">
        <Icon className="h-3.5 w-3.5" />
        <span>{formatPinLabel(location)}</span>
      </div>
      <div className="weather-pin__dot" />
    </div>,
  );
  return L.divIcon({
    html,
    className: 'weather-pin-wrapper',
    iconSize: [PIN_WIDTH, PIN_HEIGHT],
    iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT],
  });
}

interface PinMarkerProps {
  location: Location;
  isSelected: boolean;
  onSelect: (id: number) => void;
}

function PinMarker({ location, isSelected, onSelect }: PinMarkerProps) {
  const icon = useMemo(() => makePinIcon(location, isSelected), [location, isSelected]);
  return (
    <Marker
      position={[location.latitude, location.longitude]}
      icon={icon}
      title={location.weather?.area ?? undefined}
      zIndexOffset={isSelected ? 1000 : 0}
      eventHandlers={{ click: () => onSelect(location.id) }}
    />
  );
}

interface FitBoundsProps {
  locations: Location[];
  skipFirstFit: boolean;
}

function FitBounds({ locations, skipFirstFit }: FitBoundsProps) {
  const map = useMap();
  const skip = useRef(skipFirstFit);
  const key = locations.map((l) => `${l.id}:${l.latitude},${l.longitude}`).join('|');

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    map.fitBounds(getBounds(locations), { padding: [48, 48], maxZoom: 15 });
    // `key` captures the identity and position of every pin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);

  return null;
}

interface FocusSelectedProps {
  locations: Location[];
  selectedId: number | null;
  focusKey: string;
}

/** Pans to the selected location whenever `focusKey` changes (selection, refresh). */
function FocusSelected({ locations, selectedId, focusKey }: FocusSelectedProps) {
  const map = useMap();
  const isFirstRun = useRef(true);
  const locationsRef = useRef(locations);

  // Declared before the pan effect so both see the latest locations in the same commit.
  useEffect(() => {
    locationsRef.current = locations;
  }, [locations]);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const target = locationsRef.current.find((location) => location.id === selectedId);
    if (!target) return;
    map.flyTo([target.latitude, target.longitude], Math.max(map.getZoom(), FOCUS_ZOOM), {
      duration: 0.6,
    });
  }, [map, selectedId, focusKey]);

  return null;
}

function ResizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

interface MapEventsProps {
  onViewChange?: (view: MapView) => void;
  onBackgroundTap?: () => void;
}

function MapEvents({ onViewChange, onBackgroundTap }: MapEventsProps) {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onViewChange?.({ center: [center.lat, center.lng], zoom: map.getZoom() });
    },
    click: () => onBackgroundTap?.(),
  });
  return null;
}

interface WeatherMapProps {
  locations: Location[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Full gestures (wheel zoom, touch drag). Off keeps page scrolling usable inside a card. */
  interactive: boolean;
  initialView?: MapView;
  /** Changing this value pans the map to the selected location. */
  focusKey?: string;
  onViewChange?: (view: MapView) => void;
  onBackgroundTap?: () => void;
  className?: string;
}

export function WeatherMap({
  locations,
  selectedId,
  onSelect,
  interactive,
  initialView,
  focusKey = '',
  onViewChange,
  onBackgroundTap,
  className = 'h-full w-full',
}: WeatherMapProps) {
  const touchLocked = !interactive && isCoarsePointer();
  const { theme } = useTheme();

  return (
    <MapContainer
      center={initialView?.center ?? SINGAPORE_CENTER}
      zoom={initialView?.zoom ?? DEFAULT_ZOOM}
      scrollWheelZoom={interactive}
      dragging={!touchLocked}
      touchZoom={!touchLocked}
      doubleClickZoom={!touchLocked}
      className={`weather-map ${className}`}
    >
      <TileLayer
        key={theme.basemap}
        url={tileUrl(theme.basemap)}
        attribution={TILE_ATTRIBUTION}
        maxZoom={20}
      />
      {locations.map((location) => (
        <PinMarker
          key={location.id}
          location={location}
          isSelected={location.id === selectedId}
          onSelect={onSelect}
        />
      ))}
      <FitBounds locations={locations} skipFirstFit={initialView !== undefined} />
      <FocusSelected locations={locations} selectedId={selectedId} focusKey={focusKey} />
      <ResizeWatcher />
      <MapEvents onViewChange={onViewChange} onBackgroundTap={onBackgroundTap} />
    </MapContainer>
  );
}
