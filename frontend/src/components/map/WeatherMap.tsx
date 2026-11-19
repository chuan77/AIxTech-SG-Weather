import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Location } from '../../types';
import { useTheme } from '../../theme/ThemeContext';
import type { Basemap } from '../../theme/themes';
import { pinMarkup } from './pinMarkup';
import { prefersReducedMotion } from '../motion';
import { LightningLayer } from './LightningLayer';
import { RainLayer } from './RainLayer';
import { TempWindLayer } from './TempWindLayer';
import {
  DEFAULT_ZOOM,
  getBounds,
  isCoarsePointer,
  SINGAPORE_CENTER,
  type MapView,
} from './mapHelpers';
import { readCartoApiKey } from './cartoKey';

const CARTO_API_KEY = readCartoApiKey();

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

function makePinIcon(location: Location, isSelected: boolean): L.DivIcon {
  return L.divIcon({
    html: pinMarkup(location, isSelected),
    className: 'weather-pin-wrapper',
    iconSize: [PIN_WIDTH, PIN_HEIGHT],
    iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT],
  });
}

interface PinMarkerProps {
  location: Location;
  isSelected: boolean;
  onSelect: (id: number) => void;
  /** Tab-focusable only on a map the user can operate; the card preview leaves pins to the mouse. */
  focusable: boolean;
}

function PinMarker({ location, isSelected, onSelect, focusable }: PinMarkerProps) {
  const icon = useMemo(() => makePinIcon(location, isSelected), [location, isSelected]);
  return (
    <Marker
      position={[location.latitude, location.longitude]}
      icon={icon}
      title={location.weather?.area ?? undefined}
      zIndexOffset={isSelected ? 1000 : 0}
      keyboard={focusable}
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
    const center: [number, number] = [target.latitude, target.longitude];
    const zoom = Math.max(map.getZoom(), FOCUS_ZOOM);
    // Reduced motion: jump straight to the place instead of the zoom-out-and-in flight.
    if (prefersReducedMotion()) map.setView(center, zoom, { animate: false });
    else map.flyTo(center, zoom, { duration: 0.6 });
  }, [map, selectedId, focusKey]);

  return null;
}

/**
 * The card preview isn't operable from the keyboard (its Expand button is the way in), so it is
 * hidden from assistive tech; the fullscreen map is a labelled, focusable region.
 */
function MapA11y({ interactive }: { interactive: boolean }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    if (interactive) {
      container.setAttribute('role', 'region');
      container.setAttribute('aria-label', 'Map of saved locations');
    } else {
      container.setAttribute('aria-hidden', 'true');
      // Nothing inside a hidden region may take focus: Leaflet's zoom and attribution links too.
      container.querySelectorAll<HTMLElement>('a[href], button').forEach((el) => {
        el.tabIndex = -1;
      });
    }
  }, [map, interactive]);
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
  /** False hides this map's lightning and stops its work (the card while fullscreen is open). */
  showLightning?: boolean;
  /** When set, selecting a lightning group calls this instead of zooming this map. */
  onLightningGroupSelect?: (view: MapView) => void;
  /** False hides this map's rain (spec 011); follows `showLightning` unless set. */
  showRain?: boolean;
  /** True only on the full-screen map: temperature and wind never show on the card (spec 015). */
  showTempWind?: boolean;
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
  showLightning = true,
  onLightningGroupSelect,
  showRain = showLightning,
  showTempWind = false,
  className = 'h-full w-full',
}: WeatherMapProps) {
  const touchLocked = !interactive && isCoarsePointer();
  const reduceMotion = prefersReducedMotion();
  const { theme } = useTheme();

  return (
    <MapContainer
      center={initialView?.center ?? SINGAPORE_CENTER}
      zoom={initialView?.zoom ?? DEFAULT_ZOOM}
      scrollWheelZoom={interactive}
      dragging={!touchLocked}
      touchZoom={!touchLocked}
      doubleClickZoom={!touchLocked}
      zoomAnimation={!reduceMotion}
      fadeAnimation={!reduceMotion}
      markerZoomAnimation={!reduceMotion}
      keyboard={interactive}
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
          focusable={interactive}
        />
      ))}
      <RainLayer showRain={showRain} />
      <TempWindLayer showTempWind={showTempWind} />
      <LightningLayer showLightning={showLightning} onGroupSelect={onLightningGroupSelect} />
      <FitBounds locations={locations} skipFirstFit={initialView !== undefined} />
      <FocusSelected locations={locations} selectedId={selectedId} focusKey={focusKey} />
      <ResizeWatcher />
      <MapA11y interactive={interactive} />
      <MapEvents onViewChange={onViewChange} onBackgroundTap={onBackgroundTap} />
    </MapContainer>
  );
}
