---

description: "Task list for Use My Location"
---

# Tasks: Use My Location

**Input**: Design documents from `specs/003-use-my-location/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/use-my-location.md](contracts/use-my-location.md), [quickstart.md](quickstart.md)

**Tests**: Included, at two levels.
1. **vitest unit tests** for the pure modules (`geolocate.ts`, `nearbySaved.ts`), as Constitution Principle IV requires and as contract §1 lists. These run in `npm test`.
2. **agent-browser end-to-end script** (`scripts/e2e/use-my-location.sh`) that drives the real sidebar in Chrome for each user story, following CLAUDE.md's browser routing.

The browser script needs a running dev server, so it is **not** part of `npm test` or the pre-commit hook. There are no backend tests, because the backend is unchanged ([plan](plan.md)).

**Organization**: tasks are grouped by user story so each story can be built and checked on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: User story from spec.md (US1, US2, US3, US4)

## Path Conventions

Web app layout: `frontend/src/`. Browser scripts go in `scripts/e2e/`. All commands run from the repo root.

## Browser test environment (used by every agent-browser task)

- **Throwaway database**: start the app with `DATABASE_PATH=backend/e2e.db npm run dev` (git-ignored via `backend/*.db`). Reset with `DATABASE_PATH=backend/e2e.db npm run reset`. Never touch `backend/weather.db`.
- **Base URL**: `http://weather-starter.localhost:1355`, overridable with `E2E_BASE_URL`.
- **agent-browser**: always use an isolated session (`--session use-my-location`), close it on exit, and save screenshots under `e2e-artifacts/use-my-location/` (already git-ignored).
- **Emulated position**: `agent-browser --session use-my-location set geo <lat> <lng>`.
- **Adding a location** runs the normal create snapshot, so it calls data.gov.sg. Keep runs short.

---

## Phase 1: Setup

**Purpose**: a clean branch for the feature.

- [X] T001 Create and switch to branch `003-use-my-location` from the current branch, after the owner has committed the uncommitted frontend design work on `006-town-name-search` (`git status` must be clean first; ask the owner, never commit on their behalf without being asked). `.specify/feature.json` already points to `specs/003-use-my-location`.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: the shared distance rule, the pure decision module every story reads, the browser adapter, and the store option that keeps coordinates out of logs.

**⚠️ CRITICAL**: no user-story work can start until T002–T007 are done.

- [X] T002 In `frontend/src/components/nearbySaved.ts`, give `savedNear` an optional fourth parameter `maxKm = SAME_PLACE_KM`. Keep the existing 0.2 km default, so the town-pick caller in `AddLocationForm.tsx` is unchanged. Use `maxKm` as the starting `bestKm`. Update the doc comment to say the radius is configurable.
- [X] T003 [P] In `frontend/src/components/nearbySaved.test.ts`, add a case where a point about 150 m from a saved place returns that place with the default, but `null` with `maxKm = 0.1`.
- [X] T004 Create `frontend/src/components/geolocate.ts` exactly to [contracts/use-my-location.md §1](contracts/use-my-location.md). Pure module; it imports only `type Location` from `../types` and `savedNear` from `./nearbySaved`.
  - `export const SAME_SPOT_KM = 0.1;`
  - `export const SINGAPORE_BOUNDS = { minLat: 1.1, maxLat: 1.5, minLon: 103.6, maxLon: 104.1 }`, with a comment that it mirrors the server check in `backend/src/routes/locations.ts`.
  - `classifyPosition(position, saved)`. Bounds are checked first, inclusive, giving `{ kind: 'outside' }`. Then `savedNear(saved, lat, lon, SAME_SPOT_KM)` gives `{ kind: 'existing', location }`. Otherwise `{ kind: 'new', latitude, longitude }`, with the values passed through unrounded.
  - `failureReason(code)`: 1 → `'denied'`, 2 → `'unavailable'`, 3 → `'timeout'`, anything else → `'unavailable'`.
  - `geolocateMessage(result)` returns `{ tone, text }` using the exact copy in [research.md R6](research.md#r6-failure-messages-fr-005-fr-011):
    - denied: "Location access is blocked. Allow it for this site in your browser, or add a town or coordinates instead."
    - unavailable: "Your position couldn't be found. Try again, or add a town or coordinates instead."
    - timeout: "Finding your position took too long. Try again."
    - outside: "You seem to be outside Singapore. This app only covers Singapore."
    - existing: `Already saved: ${area}` (tone `'info'`)
    - create-failed: `Couldn’t add your location. ${asSentence(detail)}` (import `asSentence` from `./format`)

    Every variant except `existing` has tone `'error'`.
  - `isUnsupportedBrowser(userAgent)`:
    - true if it contains `Firefox/` or `FxiOS/`;
    - true if it contains `Safari/` and none of `Chrome/`, `Chromium/`, `CriOS/`, `Edg/`, `OPR/`;
    - false otherwise, including for an empty string.
  - `geolocateLogPayload(outcome, area?)` returns `{ outcome }` plus `area` when given. It never returns coordinates.
- [X] T005 [P] Create `frontend/src/components/geolocate.test.ts` covering every "Required test case" in [contracts §1](contracts/use-my-location.md). Use small `Location` fixtures cast through `unknown`, as `nearbySaved.test.ts` does. Cases:
  - **Bounds:** each of the four box edges, just inside and just outside.
  - **Saved-place match:** exact point → `existing`; about 60 m → `existing`; about 150 m → `new`; two saved points in range → the closest; a point outside the box that is near a saved place → `outside`.
  - **`failureReason`:** the table from contract §1.
  - **Messages:** every variant has non-empty text; failures have tone `error`; `existing` is `info` and includes the area.
  - **`isUnsupportedBrowser`:** the user-agent table with real strings for Chrome macOS, Chrome Windows, Edge, Opera, CriOS, Firefox desktop, FxiOS, Safari macOS, Safari iOS and the empty string.
  - **`geolocateLogPayload`:** for every outcome, no key matches `/lat|lon|coord|position/i`.
- [X] T006 [P] Create `frontend/src/components/geolocation.ts` to [contracts §2](contracts/use-my-location.md):
  - `export interface DetectedPosition { latitude: number; longitude: number; accuracyM: number }`.
  - `export function requestPosition(): Promise<DetectedPosition>` wraps one `navigator.geolocation.getCurrentPosition` call with `{ enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }`. It rejects with `{ reason: failureReason(error.code) }`.
  - When `typeof navigator === 'undefined' || !navigator.geolocation`, it returns `Promise.reject({ reason: 'unavailable' })` and never throws synchronously.
  - It never calls `watchPosition`. Add a header comment citing FR-002/FR-012 (one request per press, no tracking).
- [X] T007 Add the optional `options?: { source?: 'geolocation' }` argument to `create`, per [contracts §3](contracts/use-my-location.md):
  - In `frontend/src/types.ts`, change `create` to `(payload: CreateLocationPayload, options?: { source?: 'geolocation' }) => Promise<void>`.
  - In `frontend/src/state/store.tsx`, when `options?.source === 'geolocation'`:
    - log `location_create_submitted` with `{ source: 'geolocation' }` instead of the payload;
    - log `location_created` with `{ source, locationId: targetId, area }`, where `area` is the created location's `weather?.area ?? null` from the reloaded list;
    - log `location_create_failed` with `{ source, error }`;
    - none of these may carry `latitude` or `longitude`.
  - Without the option, every log call stays byte-for-byte as today.
  - Add a comment citing FR-009.

**Checkpoint**: `npx vitest run frontend/src/components/geolocate.test.ts frontend/src/components/nearbySaved.test.ts` passes, and `npm run build -w frontend` type-checks.

---

## Phase 3: User Story 1: Add my current position as a saved location (Priority: P1) 🎯 MVP

**Goal**: one press plus allowing the prompt adds and selects a location at the user's position, labelled with the nearest forecast area.

**Independent Test**:
1. With the geo emulated at Bishan (1.3508, 103.839), press "Use my location".
2. A new location is selected, the hero `h1` reads "Bishan", and it is still there after a reload (quickstart §3 US1).

- [X] T008 [P] [US1] Add `LocateIcon` to `frontend/src/components/icons.tsx`: a crosshair (circle r=7, centre dot, and four short ticks at the cardinal points) using the shared `base` stroke props and `aria-hidden="true" focusable="false"`, default `className = 'h-4 w-4'`. It must match the stroke family of `PlusIcon`.
- [X] T009 [US1] Create `frontend/src/components/UseMyLocation.tsx`, the button and message row described in [data-model.md, Attempt state](data-model.md#attempt-state-component-local-usemylocation).
  - **State:** local `status: 'idle' | 'locating' | 'adding'` and `message: { tone: 'info' | 'error'; text: string } | null`. Keep an `attemptRef` counter that is bumped in an unmount cleanup; any result whose attempt id no longer matches is dropped.
  - **On press:**
    1. Ignore the press unless `status === 'idle'`.
    2. Clear the message, set `locating`, and log `location_geolocate_requested` with `{}`.
    3. `await requestPosition()`, then `classifyPosition(position, locations)` with `locations` from `useStore()`.
    4. For `new`, set `adding` and `await create({ latitude, longitude }, { source: 'geolocation' })`.
    5. On success, return to `idle` with no message, then log `location_geolocate_result` via `geolocateLogPayload('success', area)`.
  - **The button:**
    - Classes match the collapsed "Add Location" button in `AddLocationForm.tsx` (`rounded-card`, `min-h-11`, `border-white/15 bg-white/[0.07]`, `hover:bg-white/[0.12]`, `text-white/85`), with `LocateIcon` and the label "Use my location".
    - While busy: `disabled`, `aria-busy="true"`, and the text "Finding you…". Spin nothing.
  - **Root element:** a fragment, so the parent row can lay it out (see T010). The button gets `min-w-0 flex-1`.
- [X] T010 [US1] In `frontend/src/components/Sidebar.tsx`, place `<UseMyLocation />` and `<AddLocationForm />` together in one `flex flex-wrap gap-2` wrapper, replacing the bare `<AddLocationForm />`.
  - **Collapsed form:** in `AddLocationForm.tsx`, the collapsed button changes `w-full` to `min-w-0 flex-1`. The two buttons then share one row on desktop (22rem sidebar) and on phone.
  - **Open form:** the `<form>` element gets `basis-full`, so it drops onto its own full-width line.
  - **Order:** "Use my location" comes first in DOM and tab order.
  - **Check:** at 390px wide and at 1440px wide, the two buttons sit side by side at least 44px tall, and no label truncates.

**Checkpoint**: US1 works end to end in Chrome on the e2e database.

---

## Phase 4: User Story 2: Understand and recover when it does not work (Priority: P2)

**Goal**: denied, unavailable, timeout and outside-Singapore each show their own message; nothing is added; manual entry still works.

**Independent Test**: deny the permission and press: a `role=alert` says location access is blocked, and no card is added. Set geo to Kuala Lumpur and press: the "outside Singapore" message shows and no `POST /api/locations` is made (quickstart §3 US2).

- [X] T011 [US2] In `frontend/src/components/UseMyLocation.tsx`, handle every failure branch with `geolocateMessage`:
  - a rejection `{ reason }` from `requestPosition`;
  - `outside` from `classifyPosition`, where no `create` call is made (FR-006);
  - a thrown `create`, which becomes `create-failed` with the error message.

  Each branch returns to `idle`, sets the message, and logs `location_geolocate_result` with `geolocateLogPayload(<reason | 'outside' | 'create-failed'>)`.
- [X] T012 [US2] Render the message row in `frontend/src/components/UseMyLocation.tsx` as a `basis-full` element after the buttons.
  - **Role:** `role="alert"` when `tone === 'error'`, `role="status"` when `info`.
  - **Styles:**
    - errors use the existing error style from `AddLocationForm.tsx`: `rounded-md border border-red-300/30 bg-red-500/15 px-2.5 py-1.5 text-xs text-red-100`, where `.text-red-100` maps to `--error-text`;
    - info uses `text-xs text-ink-muted`.
  - **Dismiss:** a 44px-on-touch dismiss button (`aria-label="Dismiss"`, `CloseIcon`, `min-h-11 min-w-11 md:min-h-0 md:min-w-0`) clears the message (FR-011).
  - **Clearing:** also clear the message on the next press, and in a `useEffect` when `useStore().isAdding` becomes true.
  - **Never** disable or hide the Add Location button or the form because of a message.

**Checkpoint**: US1 and US2 both pass. Typed and town-picked adds still behave and log exactly as before.

---

## Phase 5: User Story 3: Repeating the action does not create duplicates (Priority: P2)

**Goal**: a press within 100 m of a saved place selects it and says so; no new entry.

**Independent Test**: after US1, set geo about 50 m away (1.3512, 103.839) and press. The existing Bishan card is selected, "Already saved: Bishan" shows, and the saved count is unchanged (quickstart §3 US3).

- [X] T013 [US3] In `frontend/src/components/UseMyLocation.tsx`, handle `existing` from `classifyPosition`:
  1. Call `select(location.id)` from `useStore()`, with no `create` call.
  2. Set the message from `geolocateMessage({ kind: 'existing', area })`, where `area` is `location.weather?.area` or the location's coordinates formatted as the sidebar does (`lat.toFixed(3), lon.toFixed(3)`).
  3. Log `location_geolocate_result` with `geolocateLogPayload('already-saved', area)`.
  4. Return to `idle`.

  The 100 m radius comes only from `SAME_SPOT_KM`. Don't hard-code it in the component.

**Checkpoint**: repeated presses from the same emulated spot leave exactly one saved entry (SC-004).

---

## Phase 6: User Story 4: Know the feature's browser support (Priority: P3)

**Goal**: Firefox and Safari users see a small note; everyone else sees nothing extra; the button always works.

**Independent Test**: with the user agent overridden to Firefox, then Safari, the note is visible and the button is enabled. With Chrome's user agent, the note is absent (quickstart §3 US4).

- [X] T014 [US4] In `frontend/src/components/UseMyLocation.tsx`, compute `isUnsupportedBrowser(navigator.userAgent)` once, with `useMemo` and a guard for `typeof navigator`. When true, render a `basis-full` caption, `text-[11px] leading-snug text-ink-muted`, reading "Use my location isn't supported on Firefox or Safari." below the buttons and above any message. Keep the button enabled (FR-010).
- [X] T014a [US4] *(FR-010 amendment, 2026-11-15)* Remove the up-front caption. Rename the check to `isUntestedBrowser` and pass it to `geolocateMessage` so an `unavailable` or `timeout` failure ends with "Use my location has only been tested in Chrome." A denial gets no hint. Test the hint in `geolocate.test.ts`.

**Checkpoint**: all four stories pass independently.

---

## Phase 7: Browser E2E

**Purpose**: one on-demand script that proves each story in a real browser, modelled on `scripts/e2e/town-search.sh`.

- [X] T015 Create `scripts/e2e/use-my-location.sh` (executable, `set -euo pipefail`) with the same header style, `ab()`/`js()`/`check`/`shot` helpers, `SESSION=use-my-location`, `OUT=e2e-artifacts/use-my-location`, a `[us1|us2|us3|us4|themes]` filter, and a `trap cleanup EXIT`.
  - **Permission probe (first block):**
    1. After `set geo 1.3508 103.839`, run `js "navigator.permissions.query({name:'geolocation'}).then(p=>p.state)"`.
    2. If it isn't `granted`, try to grant it through the session's CDP (`Browser.grantPermissions` with `["geolocation"]` for the base URL origin).
    3. If that is also impossible, print a clear "grant geolocation manually, see quickstart §4" message and exit 2. Never report a false pass.
  - **US1:**
    1. Reset is the caller's job; assert the "Bishan" saved count is 0.
    2. Press `find role button --name "Use my location"`.
    3. Wait for the hero `h1` to read "Bishan".
    4. Assert the saved count is 1 via `GET /api/locations`.
    5. Reload, assert it is still listed, and take a screenshot.
  - **US3:** `set geo 1.3512 103.839`, then press. Assert `role=status` contains "Already saved: Bishan" and the count is still 1.
  - **US2:**
    1. *Outside Singapore:* `set geo 3.139 101.687`, then press. Assert `role=alert` contains "outside Singapore" and the location count is unchanged.
    2. *Denied:* reset permissions to denied through CDP (`Browser.resetPermissions` plus deny). If that isn't available, mark the case "skipped (manual)" rather than passed. Then press, assert `role=alert` contains "blocked", and assert "Add Location" is still enabled.
  - **US4:**
    1. `set device`, or a CDP user-agent override, to a Firefox user agent, then a Safari one. Assert the note is visible and the button is enabled.
    2. With the default Chrome user agent, assert the note is absent.
  - **Themes:** for each of `apple glass radar sticker memphis singapore`, set `localStorage['weather-theme']`, reload, trigger the outside message, and save a screenshot `themes-<id>.png`.
  - **End:** print a pass/fail/skip summary, and exit non-zero on any failure.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T016 [P] Update `docs/architecture.md`, adding to the Frontend paragraph:
  - the "Use my location" entry point (`UseMyLocation.tsx`, `geolocation.ts`, and the pure `geolocate.ts`);
  - one request per press, with no tracking;
  - the client-side Singapore box check before create;
  - the 100 m same-place rule via `savedNear`;
  - geolocation creates log no coordinates (`create(…, { source: 'geolocation' })`).
- [X] T017 [P] Update `docs/src/content/docs/frontend/overview.md`: add `UseMyLocation` to the Sidebar diagram and describe the button beside Add Location, its messages and the Firefox/Safari note.
- [X] T018 [P] Add `scripts/e2e/use-my-location.sh` to the "Browser checks" section of `docs/testing.md` and its mirror `docs/src/content/docs/guides/testing.md`, including the permission-grant caveat from quickstart §3.
- [X] T019 [P] Update `frontend/DESIGN.md`:
  - Layout: on phones the sidebar row holds "Use my location" and "Add Location" side by side.
  - Components > Buttons: the geolocate button matches the Add Location button, and its busy state reads "Finding you…".
  - Inputs/Fields > Error: the geolocate message row reuses the blush error style, and "Already saved" uses muted ink.
- [X] T020 Run `npm run lint`, `npm test` and `npm run build -w frontend`; all must pass (Principle VI). Then run `node <impeccable scripts>/detect.mjs --json frontend/src/components/UseMyLocation.tsx` once and fix any true positives.
- [ ] T021 **(Partly done 2026-11-15: §3 E2E passed 23/23 in stub mode; the log check and FR-012 are confirmed, see the quickstart Results. Left: §4 steps 1–4 in a real Chrome with a person accepting the prompt.)** Run [quickstart.md](quickstart.md) §3 (the E2E script) on the e2e database and §4 (manual Chrome run).
  - Record the date, browser and returned accuracy in the quickstart's Results table.
  - Confirm with `grep -nE 'geolocate|location_create' backend/logs/app.log | tail` that geolocation entries carry no latitude or longitude (SC-006).
  - Confirm that a page reload makes no geolocation request (FR-012).

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: start immediately once the owner has committed the 006 design work.
- **Foundational (Phase 2)**: needs Setup. **Blocks every story.**
  - T002 comes before T004 (which uses `maxKm`).
  - T004 comes before T006 (which imports `failureReason`).
  - T007 is independent of T004–T006.
- **US1 (Phase 3)**: needs Phase 2. **This is the MVP.**
- **US2, US3 and US4 (Phases 4–6)**: each needs US1's component (T009) and button row (T010). After that they are independent of each other, but all edit `UseMyLocation.tsx`, so run them one after another, not in parallel.
- **E2E (Phase 7)**: needs the stories it exercises. It can be written alongside US2–US4 and run at the end.
- **Polish (Phase 8)**: T016–T019 can start once US1 lands. T020–T021 run last.

### Story dependencies

- **US1**: needs Foundational only.
- **US2, US3, US4**: each builds on US1's component, with no dependency on each other.

### Parallel opportunities

- **In Phase 2:**
  - T003 runs alongside T004. It is a test file and only needs T002.
  - T005 runs once T004's signatures exist.
  - T006 runs once T004's `failureReason` exists.
  - T007 can run alongside all of the above.
- **In Phase 3:** T008 (icons) runs alongside T009.
- **In Phase 8:** T016–T019 are four different files and can run in parallel.

### Parallel example: Foundational

```text
Task: "T003 [P] maxKm case in frontend/src/components/nearbySaved.test.ts"
Task: "T005 [P] geolocate.test.ts per contracts §1"
Task: "T006 [P] geolocation.ts adapter per contracts §2"
Task: "T007 create(…, { source }) logging change in store.tsx + types.ts"
```

### Parallel example: Polish

```text
Task: "T016 [P] docs/architecture.md Frontend paragraph"
Task: "T017 [P] docs/src/content/docs/frontend/overview.md"
Task: "T018 [P] docs/testing.md + Astro mirror"
Task: "T019 [P] frontend/DESIGN.md"
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1, Setup: create the branch.
2. Phase 2, Foundational: T002–T007, then run the unit tests and the type-check.
3. Phase 3, US1: T008–T010.
4. **Stop and validate:** run quickstart §3 US1 and §4 steps 1–3 in Chrome. Pressing the button adds and selects your position.

### Incremental delivery

1. **US2:** every failure is explained, and manual entry is still available.
2. **US3:** repeated presses don't pile up entries.
3. **US4:** the browser note.
4. **Phase 7 and Phase 8:** the E2E script, the docs, and the full quality gate.

---

## Notes

- `geolocate.ts` must stay pure, with no `navigator` and no React, so Principle IV's node-only vitest can cover it. All browser access stays in `geolocation.ts` and `UseMyLocation.tsx`.
- Don't change the backend: its create route already enforces the box (422), exact duplicates (409) and nearest-area labelling.
- Don't log coordinates, rounded or otherwise, for this source (FR-009). Typed and town-picked creates keep today's logging.
- Every visual change is checked in all six themes with 44px targets on touch screens (Principle V, PRODUCT.md).
- Commit after each phase with a `feat:` or `docs:` prefix, only when the owner asks. The pre-commit hook runs lint and tests; never bypass it.
