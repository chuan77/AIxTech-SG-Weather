# Research: Use My Location

**Feature**: [spec.md](spec.md) | **Date**: 2026-11-14

Planning started from the assessment in `.specify/assessments/use-my-location/` (verdict go, Option B) and the draft spec. Technical Context has no NEEDS CLARIFICATION markers left; the items below settle the questions the spec and assessment handed to planning.

## R1. Where the control lives (SC-001: two actions or fewer)

- **Decision**: a "Use my location" button sits in the sidebar directly beside "Add Location", visible without opening the add form, on desktop and phone. Its messages appear just below that row.
- **Rationale**: SC-001 counts "press the button, allow sharing". A button inside the add form would need a third action (open the form). FR-001's "alongside the existing manual coordinate entry" is met because both entry points share the same add area, and manual entry is unchanged.
- **Alternatives considered**: inside the expanded form (fails SC-001); in the phone bottom dock (crowds the place chips and Refresh, and adding a place is rarer than switching).

## R2. Getting the position

- **Decision**: one call to `navigator.geolocation.getCurrentPosition` per press, with `{ enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }`, wrapped in a small promise adapter (`frontend/src/components/geolocation.ts`). The browser's own prompt is the consent step (FR-002). Nothing calls geolocation on page load or in the background (FR-012).
- **Rationale**: `enableHighAccuracy: false` answers fastest on desktop, where there is no GPS anyway (assessment research: IP/Wi-Fi lookup). Chrome's `timeout` starts after permission is granted, so 10 s matches SC-002's "within 10 seconds of the user allowing sharing". A one-minute `maximumAge` lets a quick second press reuse the fix, which also keeps the duplicate rule (R4) stable.
- **Missing API**: if `navigator.geolocation` is absent the adapter rejects with the "position unavailable" outcome (spec edge case).
- **Alternatives considered**: `watchPosition` (continuous tracking, excluded by FR-012); `enableHighAccuracy: true` (slower on phones, no gain on desktop).

## R3. Plain-HTTP localhost (FR-008, SC-007)

- **Finding**: already observed in the assessment: Chrome treats `http://weather-starter.localhost:<port>` as a secure context (`isSecureContext = true`, permission state `prompt`).
- **Decision**: no HTTPS setup. The quickstart records one manual run in Chrome that accepts the prompt and notes the returned accuracy (the assessment's carried-forward check).

## R4. Duplicate rule (FR-007, SC-004)

- **Decision**: before adding, compare the detected position with every saved location using great-circle distance. If any is within **100 m**, select the closest one and show "Already saved: <area>". Otherwise create.
- **Implementation**: reuse `savedNear` from `frontend/src/components/nearbySaved.ts` (added during the 2026-11-14 design polish for town picks, at 200 m), giving it an optional `maxKm` argument. Geolocation passes `0.1`; town picks keep the 200 m default.
- **Rationale**: one distance function and one test file for both "same place" rules. The check runs on the client against the already-loaded list, so it adds no endpoint (Principle II).
- **Alternatives considered**: snapping to a forecast area point (Option C, out of scope); a server-side proximity check (new API surface, and the server's exact-match unique index still guards races).

## R5. Outside Singapore (FR-006)

- **Decision**: check the same box the server uses (lat 1.1–1.5, lon 103.6–104.1) on the client before creating, so the user gets the specific "outside Singapore" message and no request is made. The server's 422 stays as the backstop.
- **Rationale**: the server message ("Coordinates must be within Singapore…") talks about coordinates the user never typed.

## R6. Failure messages (FR-005, FR-011)

| Outcome | Trigger | Message (plain, says what to do next) |
|---|---|---|
| denied | `PERMISSION_DENIED` (code 1) | "Location access is blocked. Allow it for this site in your browser, or add a town or coordinates instead." |
| unavailable | `POSITION_UNAVAILABLE` (2), or no geolocation API | "Your position couldn't be found. Try again, or add a town or coordinates instead." |
| timeout | `TIMEOUT` (3) | "Finding your position took too long. Try again." |
| outside | position outside the box (R5) | "You seem to be outside Singapore. This app only covers Singapore." |
| already saved | R4 match | "Already saved: Ang Mo Kio" (selects it) |
| create failed | `create()` throws | "Couldn't add your location. <server message>" |

- Messages render in one `role="status"` line (assertive `role="alert"` for failures), dismissible with a 44px × button, and cleared on the next press or when the add form opens (FR-011). Manual entry is never disabled.
- The mapping from outcome to message lives in a pure module so it is unit-tested (Principle IV).

## R7. Privacy and logging (FR-009, SC-006)

- **Finding**: today `store.create` logs `location_create_submitted` with the raw payload and `location_created` / `location_create_failed` with latitude and longitude, through `POST /api/logs` into `backend/logs/app.log` and stdout. `pino-http` logs method and URL only, not bodies; the backend duplicate warning carries no coordinates.
- **Decision**: `create` gains an optional second argument `{ source: 'geolocation' }`. With it, the three create events omit coordinates and carry `source` (and, on success, the resulting `area`). The geolocation flow logs `location_geolocate_requested` and `location_geolocate_result` with `{ outcome }` and, for success or already-saved, `{ area }`. No rounded position is logged at all, the simplest form FR-009 allows.
- **Rationale**: keeps one create path (Principle II) while guaranteeing no precise coordinates enter logs for this source. Typed and town-picked creates keep today's logging.
- **Not changed**: the position is still stored in SQLite and returned by `GET /api/locations`, as for any saved location (accepted by the owner in the assessment).

## R8. Browser note (FR-010)

- **Decision (amended 2026-11-15)**: a pure `isUntestedBrowser(userAgent)` returns true for Firefox (`Firefox/` or `FxiOS/`) and for Safari (`Safari/` without `Chrome/`, `Chromium/`, `CriOS/`, `Edg/` or `OPR/`). When true, an "unavailable" or "timeout" failure message ends with "Use my location has only been tested in Chrome." No note is shown before an attempt, and a denial gets no hint.
- **Rationale**: user-agent sniffing is crude, so the hint only rides on a real failure: a misread costs one sentence, never a warning on a working button.
- **Superseded**: the first version showed a caption "Use my location isn't supported on Firefox or Safari." up front. A design critique found it told every iPhone Safari user, the app's likeliest phone user, that a working button was broken.

## R9. Concurrency and late results (FR-004, edge cases)

- **Decision**: the button is disabled with `aria-busy` and reads "Finding you…" while an attempt is in flight; a second press is ignored. An attempt id ref is bumped on unmount, so a position arriving after the sidebar unmounts is dropped. A position arriving while the add form is open still adds or selects normally and does not touch the form's fields.
- **After success**: the new location is selected through the existing `create` path, which already reloads the list and selects it, and its weather is loaded by the create snapshot. If that refresh fails, the location stays as an unrefreshed entry, as today.

## R10. Testing approach

- **Unit (vitest, pure modules)**: `geolocate.ts`: outcome classification (inside/outside box, duplicate within 100 m, closest of several, exact match), error-code mapping, messages, `isUntestedBrowser` table, and the log payload builder (asserts no latitude/longitude keys). `nearbySaved.test.ts` gains a `maxKm` case.
- **Browser E2E (on demand, like 006)**: `scripts/e2e/use-my-location.sh` with agent-browser. `agent-browser set geo <lat> <lng>` sets the emulated position; whether it also grants the permission is checked in the first run (quickstart §3). If it does not, the permission is granted through the session's CDP connection, or US1/US3 are run manually in Chrome per the quickstart.
- **Backend**: no route or schema change, so no new Supertest suite (Principle VI). Existing create tests already cover the bounds and duplicate responses.
