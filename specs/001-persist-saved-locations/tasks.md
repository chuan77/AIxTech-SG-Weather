# Tasks: Persist Saved Locations

**Input**: Design documents from `/specs/001-persist-saved-locations/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/locations-api.md, quickstart.md

**Tests**: Included. Constitution IV requires vitest tests for backend routes and logic, and the plan lists the missing cases. Test tasks come before the fixes they cover; run them first and confirm the fix-related ones fail.

**Organization**: Grouped by user story. Most behaviour already exists, so these tasks verify it with tests and close the gaps found in research.md (D1 to D6). No schema change and no migration.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story the task belongs to (US1, US2, US3)
- Backend route tests all live in `backend/src/routes/locations.test.ts`, so tasks editing that file are sequential (not [P])

## Path Conventions

Web app: `backend/src/`, `frontend/src/`, `docs/`. Run all commands from the repo root.

---

## Phase 1: Setup

**Purpose**: Confirm a green baseline before changing anything.

- [X] T001 Run `npm test` and `npm run build -w frontend` from the repo root and record that both pass before any change (baseline for later comparison).

---

## Phase 2: Foundational

**Purpose**: Test helpers all story tests depend on.

**⚠️ CRITICAL**: Complete before Phase 3 and later.

- [X] T002 In `backend/src/routes/locations.test.ts`, add a `resetStore()` call in a `beforeEach` (import from `../db.js`) so each test starts with an empty `locations` table and ids restart at 1. Keep the existing two tests passing (remove their now-redundant inline `resetStore` call only if it stays correct).
- [X] T003 In `backend/src/routes/locations.test.ts`, add a helper `restartApp(weatherClient?)` that simulates a process restart per research D5: call `closeDatabase()` from `../db.js`, call `vi.resetModules()`, re-import `../server.js`, and return a new `createApp({ serveFrontend: false, enableRequestLogging: false, weatherClient })`. The same `process.env.DATABASE_PATH` temp file is reused, so data must survive. Update `afterAll` to close the database from the latest import. Note that after `vi.resetModules()` the helper must also re-import `../db.js` for `resetStore` and `closeDatabase` so they target the live connection.

**Checkpoint**: Existing tests still pass with the helpers in place.

---

## Phase 3: User Story 1 - Added locations are saved permanently (Priority: P1) 🎯 MVP

**Goal**: A valid added location is stored durably; duplicates and invalid input are rejected without saving; a failed first refresh never loses the location.

**Independent Test**: `npx vitest run backend/src/routes/locations.test.ts -t "US1"` passes, then quickstart.md sections 2 and 3.

### Tests for User Story 1

- [X] T004 [US1] In `backend/src/routes/locations.test.ts`, add test "US1: rejects a duplicate coordinate pair with 409": POST `{latitude: 1.35, longitude: 103.85}` twice; second returns 409 with `detail` `"Location already exists"`; `GET /api/locations` has exactly 1 entry (FR-002).
- [X] T005 [US1] In `backend/src/routes/locations.test.ts`, add test "US1: rejects invalid coordinates with 422 and saves nothing": cases `{}` (missing), `{latitude: 'abc', longitude: 103.85}` (non-numeric), `{latitude: 40.7, longitude: -74.0}` (outside Singapore). Each returns 422 with a `detail` string; `GET /api/locations` stays empty (FR-003). Bounds are lat 1.1 to 1.5 and lon 103.6 to 104.1 inclusive.
- [X] T006 [US1] In `backend/src/routes/locations.test.ts`, add test "US1: keeps the location when the first refresh fails": build an app whose fake `weatherClient.getCurrentWeather` throws `new WeatherProviderError('down')` (import from `../weather.js`) and a second case that throws a plain `Error('boom')`. Both POSTs must return 201 with `weather.condition === 'Not refreshed'`, and the location must appear in `GET /api/locations` (FR-011). The plain-`Error` case fails before T008.
- [X] T007 [US1] In `backend/src/routes/locations.test.ts`, add test "US1: concurrent duplicate adds return one 201 and one 409": fire two `POST /api/locations` for the same coordinates with `Promise.all`; assert the status set is `[201, 409]` and the list has 1 entry. It may already pass if the requests happen to serialise; T010 pins the db-layer contract.

### Implementation for User Story 1

- [X] T008 [US1] In `backend/src/routes/locations.ts`, change the inner `catch` of `POST /locations` so that after the row is inserted, any error from `weatherClient.getCurrentWeather` or `updateWeather` is logged with `logger.warn({ err: error, locationId: location.id }, 'weather refresh failed after location create')` and the response is `201` with the saved `location` (research D1). Remove the `instanceof WeatherProviderError` rethrow, and drop the `WeatherProviderError` import if it becomes unused in this file (it is still used by the refresh route, so keep it).
- [X] T009 [US1] In `backend/src/db.ts` `createLocation`, wrap the `insert(...).returning().get()` in try/catch; if the error message matches SQLite's unique constraint failure (`/UNIQUE constraint failed/i`, on `locations.latitude, locations.longitude`), throw the same error used by the pre-check (`name = 'DuplicateLocationError'`, message `'Location already exists'`); rethrow anything else (research D2). Keep the pre-check query.
- [X] T010 [US1] In `backend/src/routes/locations.test.ts`, add test "US1: createLocation throws DuplicateLocationError for an existing pair": call `createLocation(1.35, 103.85)` (import from `../db.js`) twice and assert the second rejects with `{ name: 'DuplicateLocationError', message: 'Location already exists' }`. This pins the db-layer contract that T009 preserves when it maps the unique-index error.
- [X] T011 [US1] Run `npx vitest run backend/src/routes/locations.test.ts` and confirm all US1 tests pass.

**Checkpoint**: Adding is durable, validated and de-duplicated; MVP complete.

---

## Phase 4: User Story 2 - Saved locations are listed automatically after restart (Priority: P1)

**Goal**: After a restart the user sees every saved location, newest first, with the newest selected and the stored weather; load failures show a clear message.

**Independent Test**: `npx vitest run backend/src/routes/locations.test.ts -t "US2"`, then quickstart.md sections 2 and 5.

### Tests for User Story 2

- [X] T012 [US2] In `backend/src/routes/locations.test.ts`, add test "US2: lists saved locations newest first with stored weather after restart": create three locations (1.35/103.85, 1.36/103.86, 1.37/103.87) with the default fake client, call `restartApp()` using a client that throws if invoked (proves no weather fetch on startup, Constitution I), `GET /api/locations` on the new app and assert ids are `[3, 2, 1]`, each `weather.area === 'Bishan'` and `weather.condition === 'Cloudy'` (FR-004, FR-005, FR-006, SC-001).
- [X] T013 [US2] In `backend/src/routes/locations.test.ts`, add test "US2: same-second inserts keep newest-first order": create 3 locations back to back (they share a `created_at` second), assert order is by descending id, restart, and assert the order is identical (research D6).
- [X] T014 [US2] In `backend/src/routes/locations.test.ts`, add test "US2: empty list when nothing saved": after `resetStore` and `restartApp()`, `GET /api/locations` returns `{ locations: [] }` (FR-008 backend half).

### Implementation for User Story 2

- [X] T015 [US2] Expose the load error separately in `frontend/src/state/store.tsx`: add a `loadError` state set in `load()`'s catch (message string, `null` on success), return it in the store `value`, and add `loadError: string | null` to `StoreValue` in `frontend/src/types.ts`. Do not clear the existing `locations` array on failure (FR-010). Keep the existing select-first logic unchanged (FR-007).
- [X] T016 [US2] In `frontend/src/components/Sidebar.tsx`, render a banner when `loadError` is set, above the location list: text `Could not load saved locations: {message}` plus a "Retry" button that calls a new `reload` function exposed from the store (wrap `load` in `store.tsx`, add `reload: () => Promise<void>` to `StoreValue`). Style with Tailwind `white` classes and the `rounded-card` class only, no literal colours (Constitution V, see `docs/theming.md`). Hide it when `isLoading` is true.
- [X] T017 [US2] In `frontend/src/components/Sidebar.tsx`, confirm the empty state (no locations, not loading, no `loadError`) shows an invitation to add a location (FR-008); if it does not, add one using the same classes. Do not show the empty state while `loadError` is set, so a failed load is not mistaken for "no locations".
- [X] T018 [US2] Run `npm run build -w frontend` and `npx vitest run backend/src/routes/locations.test.ts`; both must pass.
- [ ] T019 [US2] Manually follow quickstart.md sections 2 and 5 against `npm run dev` (add two locations, restart twice, stop the server and reload to see the banner, restart and click Retry). Record the result in the PR description.

**Checkpoint**: Restart shows all locations in order with the newest selected; failures are visible and non-destructive.

---

## Phase 5: User Story 3 - Saved data stays intact and consistent (Priority: P2)

**Goal**: Deleting is permanent, and repeated restarts never change, duplicate or drop locations.

**Independent Test**: `npx vitest run backend/src/routes/locations.test.ts -t "US3"`, then quickstart.md section 4.

### Tests for User Story 3

- [X] T020 [US3] In `backend/src/routes/locations.test.ts`, add test "US3: a deleted location does not return after restart": create three locations, `DELETE` the middle one (204), `restartApp()`, assert `GET /api/locations` ids are `[3, 1]` in that order and `GET /api/locations/2` is 404 (FR-009, SC-004).
- [X] T021 [US3] In `backend/src/routes/locations.test.ts`, add test "US3: repeated restarts give an identical list": create 3 locations, snapshot `GET /api/locations`, call `restartApp()` five times, and assert the body deep-equals the snapshot after each (SC-003, US3 scenario 2).
- [X] T022 [US3] In `backend/src/routes/locations.test.ts`, add test "US3: a failed refresh does not alter the stored snapshot": create a location, restart with a client that throws `WeatherProviderError`, `POST /api/locations/1/refresh` returns 502, and `GET /api/locations` still returns the original snapshot (contract for refresh; FR-010).

### Implementation for User Story 3

- [X] T023 [US3] Run `npx vitest run backend/src/routes/locations.test.ts -t "US3"`. These behaviours already exist, so expect them to pass; if any fails, fix the cause in `backend/src/db.ts` or `backend/src/routes/locations.ts` and note the fix in the commit message.
- [X] T024 [US3] In `frontend/src/state/store.tsx`, verify `remove` keeps selection valid after a delete (selected becomes the new first location through `effectiveSelectedId`) and leaves `locations` intact on a failed delete. Change nothing if correct; fix only if the selection can point at a removed id.

**Checkpoint**: All three stories verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T025 [P] Update `docs/architecture.md` (Storage and Frontend paragraphs): state that startup fails fast with a logged error if the database cannot be opened or migrated (research D4, spec edge case is narrowed), that duplicate and first-refresh failures are non-fatal for create, and that the sidebar shows load errors with Retry (Constitution Development Workflow requires docs updated in the same change).
- [X] T026 [P] In `backend/src/db.ts`, wrap the top-level `new DatabaseSync(...)` and `await migrate(...)` so a failure logs a clear message via `logger.error` (import from `./logger.js`, mind circular imports) naming `databasePath` and then rethrows so the process exits non-zero; never delete or recreate the database file (research D4, FR-010).
- [X] T027 Run `npm test` and `npm run build -w frontend`; both must pass with no new failures against the T001 baseline.
- [ ] T028 Run quickstart.md end to end and confirm every expected outcome. If section 5 shows a different result from what is written, correct quickstart.md.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)** first. **Foundational (T002, T003)** blocks all stories, because the tests use the helpers.
- **US1 (Phase 3)** has no dependency on other stories. **US2** needs only Foundational; it is independent of US1 code, but its tests create locations through the US1 create path. **US3** needs only Foundational.
- **Polish** after the stories you ship. T026 touches `db.ts`, so do it after T009 (same file).

### Within each story

- Tests first (T004 to T007 before T008 and T009; T012 to T014 before T015 onward).
- Backend fixes (T008, T009) are in different files and can run in parallel once tests are written, but both follow T004 to T007.
- T015 before T016 and T017 (store before components); T016 and T017 touch the same file, so run sequentially.

### Parallel Opportunities

- T008 (`routes/locations.ts`) and T009 (`db.ts`) in parallel.
- T015 and T016 are not parallel (T016 consumes T015's new fields), but the frontend work (T015 to T017) can run in parallel with backend test tasks T012 to T014 if two people work in parallel, since they touch different files.
- T025 and T026 are [P] with each other (different files).
- All test tasks edit one file, so they must be applied sequentially even though they are logically independent.

```text
# Example: after tests T004-T007 are written
Task: "T008 first-refresh failure non-fatal in backend/src/routes/locations.ts"
Task: "T009 map unique-index violation in backend/src/db.ts"
```

---

## Implementation Strategy

### MVP first (User Story 1)

1. T001 baseline, then T002 and T003 helpers.
2. T004 to T011: tests, then the two small backend fixes.
3. Stop and validate with `npx vitest run backend/src/routes/locations.test.ts`.

### Incremental delivery

1. Add US2 (restart listing tests plus the error banner), validate with quickstart sections 2 and 5.
2. Add US3 (delete and repeated restart tests), validate with section 4.
3. Finish with Polish (docs, startup logging, full test and build run).

---

## Notes

- Commit after each logical group with conventional prefixes (`fix:`, `test:`, `feat:`, `docs:`).
- Do not commit `RealtimeWeatherReadingsacrossSingapore/`.
- Tests must never reach the network: always inject a fake `weatherClient` (Constitution III).
