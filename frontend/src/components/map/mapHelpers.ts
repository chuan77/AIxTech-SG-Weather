import type { Location } from '../../types';
import { formatTemperature } from '../format';

export type PinIconKey = 'thunder' | 'rain' | 'cloud' | 'sun' | 'unknown';
export type LatLngPair = [number, number];
export type LatLngBoundsPair = [LatLngPair, LatLngPair];

export interface MapView {
  center: LatLngPair;
  zoom: number;
}

export const SINGAPORE_CENTER: LatLngPair = [1.3521, 103.8198];
export const DEFAULT_ZOOM = 11;

// Matches the coordinate range the backend accepts in POST /locations.
export const SINGAPORE_BOUNDS: LatLngBoundsPair = [
  [1.1, 103.6],
  [1.5, 104.1],
];

// Half-width in degrees used when only one location exists, roughly a 4 km window.
const SINGLE_LOCATION_PADDING = 0.02;

export function conditionToIcon(condition: string | null | undefined): PinIconKey {
  const text = condition?.toLowerCase() ?? '';
  if (/thunder/.test(text)) return 'thunder';
  if (/rain|shower|drizzle/.test(text)) return 'rain';
  if (/cloud|overcast|haz|mist|fog|wind/.test(text)) return 'cloud';
  if (/fair|sun|clear/.test(text)) return 'sun';
  return 'unknown';
}

export function formatPinLabel(location: Location): string {
  return formatTemperature(location.weather?.temperature_c);
}

export function getBounds(locations: Pick<Location, 'latitude' | 'longitude'>[]): LatLngBoundsPair {
  if (locations.length === 0) return SINGAPORE_BOUNDS;

  const latitudes = locations.map((location) => location.latitude);
  const longitudes = locations.map((location) => location.longitude);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);

  if (south === north && west === east) {
    return [
      [south - SINGLE_LOCATION_PADDING, west - SINGLE_LOCATION_PADDING],
      [north + SINGLE_LOCATION_PADDING, east + SINGLE_LOCATION_PADDING],
    ];
  }
  return [
    [south, west],
    [north, east],
  ];
}

export function isCoarsePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}
