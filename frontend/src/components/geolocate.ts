import type { Location } from '../types';
import { asSentence } from './format';
import { savedNear } from './nearbySaved';

/**
 * Decisions for "Use my location" (specs/003-use-my-location). Pure: no navigator and no React,
 * so the rules are unit-tested (Constitution IV). Browser access lives in geolocation.ts.
 */

/** A detected position within this distance of a saved place is that place (FR-007). */
export const SAME_SPOT_KM = 0.1;

/** Mirrors the server's check in backend/src/routes/locations.ts (FR-006). Inclusive. */
export const SINGAPORE_BOUNDS = { minLat: 1.1, maxLat: 1.5, minLon: 103.6, maxLon: 104.1 } as const;

export type GeolocateFailureReason = 'denied' | 'unavailable' | 'timeout';

export type GeolocateOutcome =
  | { kind: 'outside' }
  | { kind: 'existing'; location: Location }
  | { kind: 'new'; latitude: number; longitude: number };

/** Bounds first (no request for a position the server would reject), then the 100 m rule. */
export function classifyPosition(
  position: { latitude: number; longitude: number },
  saved: Location[],
): GeolocateOutcome {
  const { latitude, longitude } = position;
  const { minLat, maxLat, minLon, maxLon } = SINGAPORE_BOUNDS;
  if (latitude < minLat || latitude > maxLat || longitude < minLon || longitude > maxLon) {
    return { kind: 'outside' };
  }
  const existing = savedNear(saved, latitude, longitude, SAME_SPOT_KM);
  if (existing) return { kind: 'existing', location: existing };
  return { kind: 'new', latitude, longitude };
}

/** GeolocationPositionError.code to a reason; anything unknown counts as unavailable. */
export function failureReason(code: number | undefined): GeolocateFailureReason {
  if (code === 1) return 'denied';
  if (code === 3) return 'timeout';
  return 'unavailable';
}

export type GeolocateMessageInput =
  | { kind: 'failure'; reason: GeolocateFailureReason; untestedBrowser?: boolean }
  | { kind: 'outside' }
  | { kind: 'existing'; area: string }
  | { kind: 'create-failed'; detail: string };

export interface GeolocateMessage {
  tone: 'info' | 'error';
  text: string;
}

const FAILURE_TEXT: Record<GeolocateFailureReason, string> = {
  denied:
    'Location access is blocked. Allow it for this site in your browser, or add a town or coordinates instead.',
  unavailable: "Your position couldn't be found. Try again, or add a town or coordinates instead.",
  timeout: 'Finding your position took too long. Try again.',
};

/** Added to a failure on Firefox or Safari, where the feature hasn't been tested (FR-010). */
export const UNTESTED_BROWSER_HINT = 'Use my location has only been tested in Chrome.';

/** What happened and what to do next, for each outcome (FR-005). */
export function geolocateMessage(input: GeolocateMessageInput): GeolocateMessage {
  switch (input.kind) {
    case 'failure':
      // A browser we haven't tested gets the hint only after it actually fails (FR-010), and not
      // for "denied", which is the user's own choice rather than a browser gap.
      return {
        tone: 'error',
        text:
          input.untestedBrowser && input.reason !== 'denied'
            ? `${FAILURE_TEXT[input.reason]} ${UNTESTED_BROWSER_HINT}`
            : FAILURE_TEXT[input.reason],
      };
    case 'outside':
      return {
        tone: 'error',
        text: 'You seem to be outside Singapore. This app only covers Singapore.',
      };
    case 'existing':
      return { tone: 'info', text: `Already saved: ${input.area}` };
    case 'create-failed':
      return { tone: 'error', text: `Couldn’t add your location. ${asSentence(input.detail)}` };
  }
}

/**
 * Firefox, or Safari that isn't a Chromium browser in disguise: browsers where the feature hasn't
 * been tested (FR-010). Only adds a hint to a failure message, so a misread user agent costs a
 * sentence, never a blocked button or a warning on a working one.
 */
export function isUntestedBrowser(userAgent: string): boolean {
  if (/Firefox\/|FxiOS\//.test(userAgent)) return true;
  return /Safari\//.test(userAgent) && !/Chrome\/|Chromium\/|CriOS\/|Edg\/|OPR\//.test(userAgent);
}

export type GeolocateLogOutcome =
  | 'success'
  | 'already-saved'
  | GeolocateFailureReason
  | 'outside'
  | 'create-failed';

/** Metadata for location_geolocate_result. Never includes a position, rounded or not (FR-009). */
export function geolocateLogPayload(
  outcome: GeolocateLogOutcome,
  area?: string,
): { outcome: GeolocateLogOutcome; area?: string } {
  return area === undefined ? { outcome } : { outcome, area };
}
