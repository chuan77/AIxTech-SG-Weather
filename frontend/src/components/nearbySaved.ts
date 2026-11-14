import type { Location } from '../types';

/** Within this distance a new pick is treated as a place the user already saved. */
export const SAME_PLACE_KM = 0.2;

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The closest saved location within {@link SAME_PLACE_KM} of a point, or null. */
export function savedNear(
  locations: Location[],
  latitude: number,
  longitude: number,
): Location | null {
  let best: Location | null = null;
  let bestKm = SAME_PLACE_KM;
  for (const location of locations) {
    const km = distanceKm(latitude, longitude, location.latitude, location.longitude);
    if (km <= bestKm) {
      best = location;
      bestKm = km;
    }
  }
  return best;
}
