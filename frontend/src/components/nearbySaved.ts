import type { Location } from '../types';

/** Within this distance a new pick is treated as a place the user already saved. */
export const SAME_PLACE_KM = 0.2;

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * The closest saved location within `maxKm` of a point, or null. The radius is configurable:
 * town picks use {@link SAME_PLACE_KM}; "Use my location" uses a tighter 100 m.
 */
export function savedNear(
  locations: Location[],
  latitude: number,
  longitude: number,
  maxKm: number = SAME_PLACE_KM,
): Location | null {
  let best: Location | null = null;
  let bestKm = maxKm;
  for (const location of locations) {
    const km = distanceKm(latitude, longitude, location.latitude, location.longitude);
    if (km <= bestKm) {
      best = location;
      bestKm = km;
    }
  }
  return best;
}
