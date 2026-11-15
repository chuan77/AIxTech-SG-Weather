# Contract: Use My Location

The feature exposes no HTTP endpoint. Its contracts are the frontend module interfaces and the UI's accessible surface, which the unit tests and the E2E script assert.

## 1. `frontend/src/components/geolocate.ts` (pure, unit-tested)

```ts
export const SAME_SPOT_KM = 0.1;

export type GeolocateFailureReason = 'denied' | 'unavailable' | 'timeout';

export type GeolocateOutcome =
  | { kind: 'outside' }
  | { kind: 'existing'; location: Location }
  | { kind: 'new'; latitude: number; longitude: number };

/** Bounds first (same box as the server), then the 100 m duplicate rule. */
export function classifyPosition(
  position: { latitude: number; longitude: number },
  saved: Location[],
): GeolocateOutcome;

/** GeolocationPositionError.code → reason; anything unknown → 'unavailable'. */
export function failureReason(code: number | undefined): GeolocateFailureReason;

/** The user-facing line for each outcome (research R6). */
export function geolocateMessage(
  result:
    | { kind: 'failure'; reason: GeolocateFailureReason }
    | { kind: 'outside' }
    | { kind: 'existing'; area: string }
    | { kind: 'create-failed'; detail: string },
): { tone: 'info' | 'error'; text: string };

/** Firefox or Safari (not Chromium-based), for the advisory note (R8). */
export function isUnsupportedBrowser(userAgent: string): boolean;

/** Metadata for location_geolocate_result. Never includes coordinates. */
export function geolocateLogPayload(
  outcome: 'success' | 'already-saved' | GeolocateFailureReason | 'outside' | 'create-failed',
  area?: string,
): { outcome: string; area?: string };
```

**Required test cases**
- `classifyPosition`: a point in Singapore with an empty list gives `new`. Each of the four box edges, just inside and just outside. Exactly on a saved point gives `existing`. About 60 m away gives `existing`. About 150 m away gives `new`. With two saved points in range, the closest wins. A point outside the box that is near a saved point still gives `outside`, because bounds are checked first.
- `failureReason`: 1 → denied, 2 → unavailable, 3 → timeout, undefined or 99 → unavailable.
- `geolocateMessage`: every variant returns non-empty text. Every failure variant has tone `error` and names a next step. `existing` has tone `info` and includes the area.
- `isUnsupportedBrowser`:

  | Browser | Result |
  |---|---|
  | Chrome (macOS and Windows) | false |
  | Edge | false |
  | Opera | false |
  | Chrome on iOS (`CriOS`) | false |
  | Firefox (desktop) | true |
  | Firefox on iOS (`FxiOS`) | true |
  | Safari (macOS and iOS) | true |
  | Empty string | false |

- `geolocateLogPayload`: for every outcome, the returned object has no key matching `/lat|lon|coord|position/i`.

## 2. `frontend/src/components/geolocation.ts` (adapter, not unit-tested)

```ts
export interface DetectedPosition { latitude: number; longitude: number; accuracyM: number }

/** One-shot position request. Rejects with { reason } (see geolocate.ts). Never watches. */
export function requestPosition(): Promise<DetectedPosition>;
```

- Calls `navigator.geolocation.getCurrentPosition` with `{ enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }`.
- If `navigator.geolocation` is missing, it rejects `{ reason: 'unavailable' }` without throwing synchronously.

## 3. Store: `create(payload, options?)`

```ts
create: (payload: CreateLocationPayload, options?: { source?: 'geolocation' }) => Promise<void>;
```

- Without `options`, behaviour and logging are exactly as today. Typed and town-picked adds are unchanged.
- With `{ source: 'geolocation' }`:
  - `location_create_submitted` logs `{ source }`;
  - `location_created` logs `{ source, locationId, area }`;
  - `location_create_failed` logs `{ source, error }`;
  - none of these logs carry latitude or longitude.

## 4. UI contract (asserted by `scripts/e2e/use-my-location.sh`)

| Element | Role / name | States |
|---|---|---|
| Button | `button` "Use my location" | While busy: disabled, `aria-busy="true"`, text "Finding you…". It is otherwise always enabled, including on unsupported browsers |
| Message | `role="alert"` for errors, `role="status"` for info | Exactly one at a time. Contains the R6 text. Has a dismiss `button` "Dismiss" |
| Browser note | Plain text under the button | Present only when `isUnsupportedBrowser(navigator.userAgent)` |
| Result (new) | The new location's card or chip has `aria-pressed="true"` | The hero `h1` shows the derived area |
| Result (existing) | The existing card or chip has `aria-pressed="true"` | No new card appears. The location count is unchanged |

- **Placement**: the sidebar, in the same row as "Add Location" (two buttons sharing the width on desktop and phone). Both are at least 44px tall on touch screens.
- **Theming**: the button uses the same classes as "Add Location". The message uses `text-ink-muted` for info and the existing error style (red-tinted 15% wash, `--error-text`) for errors. It is legible in all six themes.
- **Logging events**: `location_geolocate_requested {}`, then `location_geolocate_result { outcome, area? }`.
