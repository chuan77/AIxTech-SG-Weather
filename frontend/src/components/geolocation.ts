import { failureReason, type GeolocateFailureReason } from './geolocate';

/**
 * The only place the app touches navigator.geolocation (specs/003-use-my-location).
 * One request per press, the browser's own prompt as consent, and never watchPosition:
 * no request on page load and no tracking (FR-002, FR-012).
 */

export interface DetectedPosition {
  latitude: number;
  longitude: number;
  /** Radius in metres. Desktop fixes come from IP or Wi-Fi and can be coarse. */
  accuracyM: number;
}

export interface GeolocateFailure {
  reason: GeolocateFailureReason;
}

/** Resolves with one position, or rejects with { reason }. Never throws synchronously. */
export function requestPosition(): Promise<DetectedPosition> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject<DetectedPosition>({ reason: 'unavailable' } satisfies GeolocateFailure);
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        }),
      (error) => reject({ reason: failureReason(error?.code) } satisfies GeolocateFailure),
      // Coarse is fine (no GPS on desktop) and fastest; 10 s matches SC-002; a one-minute-old
      // fix lets a quick second press land on the same spot for the duplicate rule.
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}
