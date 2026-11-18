---

description: "Task list for spec 013, private saved locations per visitor"
---

# Tasks: Private Saved Locations per Visitor

**Input**: Design documents from `specs/013-per-visitor-saved-locations/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. Constitution Principle VI requires Supertest coverage for every changed route. Principle IV requires browser-side logic to sit in pure, tested `.ts` modules. Within each story, write the tests first and confirm they fail.

**Organization**: Tasks are grouped by user story (spec priorities: US1 P1, US2 P2, US3 P2, US4 P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Paths are from the repo root: `backend/src/`, `frontend/src/`, `scripts/e2e/`, `docs/`

---

## Phase 1: Setup

**Purpose**: Branch and library checks before touching the schema

- [X] T001 Create and switch to branch `013-per-visitor-saved-locations` from up-to-date `main` (`git switch main && git pull && git switch -c 013-per-visitor-saved-locations`). Then move the uncommitted `specs/013-per-visitor-saved-locations/` and `.specify/assessments/per-visitor-saved-locations/` files onto it. They are untracked, so they carry over.
- [X] T002 Query Context7 for the drizzle-kit 0.31 and drizzle-orm 0.45 docs (versions from `package.json`) on: `sqliteTable` with multiple unique indexes, dropping or renaming an index, and adding a nullable column. Confirm that `db:generate` emits `ALTER TABLE ... ADD` plus `DROP INDEX`/`CREATE UNIQUE INDEX`, with no `__new_locations` table rebuild (research R4, plan "Risks"). Don't put project code or secrets in the query.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The schema, the visitor-key helpers on both sides, and test harnesses that send a key. Every story depends on these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 In `backend/src/schema.ts`, add the `visitors` table:
  - `id` integer primary key, autoincrement
  - `key_hash` text, "not null, **unique**", "Lowercase hex SHA-256 of the 43-character browser key"
  - `created_at` text, not null
  - `last_used_at` text, not null
  - Both dates use ISO `YYYY-MM-DDTHH:MM:SS`, as `locations.created_at` does.

  Change `locations`:
  - add `visitorId: integer('visitor_id')`, which is nullable. NULL means "a pre-feature row that hasn't been claimed". No FK constraint (research R4).
  - replace `uniqueIndex('locations_latitude_longitude_unique').on(latitude, longitude)` with `uniqueIndex('locations_visitor_latitude_longitude_unique').on(table.visitorId, table.latitude, table.longitude)`.

  Export `Visitor` row types. (data-model.md)
- [X] T004 Run `npm run db:generate` from the repo root.
  - Inspect the new `backend/drizzle/0004_*.sql`. It must be only `CREATE TABLE visitors` (plus its unique index), `ALTER TABLE locations ADD visitor_id integer`, `DROP INDEX locations_latitude_longitude_unique` and `CREATE UNIQUE INDEX locations_visitor_latitude_longitude_unique`, with the drop before the create.
  - If drizzle-kit emits a table rebuild, stop and fix the schema per T002 before continuing.
  - Commit the SQL along with `backend/drizzle/meta/` changes.
- [X] T005 [P] Write `backend/src/visitors.test.ts` (it must fail first), using a temp `DATABASE_PATH` the same way `routes/locations.test.ts` does. Cover:
  - `isVisitorKey` accepts exactly `^[A-Za-z0-9_-]{43}$` and rejects 42 or 44 characters, `+`, `/`, `=`, empty and non-string values.
  - `hashVisitorKey` returns 64 lowercase hex characters and is deterministic.
  - `findVisitorId(key)` returns `null` for an unknown key and creates nothing.
  - `ensureVisitor(key, now)` creates once and returns the same id on a second call.
  - `touchVisitor(id, now)` updates `last_used_at` only when the stored value is more than 1 hour older than `now` (research R6).
- [X] T006 Implement `backend/src/visitors.ts`:
  - `VISITOR_KEY_PATTERN`, `isVisitorKey()`
  - `hashVisitorKey()` via `node:crypto` `createHash('sha256')`
  - `findVisitorId()`, `ensureVisitor()` (insert-if-absent, safe under the `key_hash` unique index for concurrent first saves), `touchVisitor()`
  - `visitorKeyFrom(request)`, which reads the `X-Visitor-Key` header and returns the key or `null`
  - Add the db access it needs to `backend/src/db.ts` (export a narrow helper, not the raw `db`).
  - Never log a key or hash. Make T005 pass.
- [X] T007 [P] Write `frontend/src/visitorKey.test.ts` (it must fail first). Cover:
  - `generateVisitorKey(bytes)` turns 32 given bytes into a 43-character base64url string with no padding (check a known vector).
  - `isVisitorKey` has the same rules as the backend.
  - `getVisitorKey(storage, randomBytes)` returns a stored valid key, and replaces an invalid stored value with a new key, saved under `weather-starter.visitor.key`.
  - If the storage `getItem`/`setItem` throws, it returns a key that's stable for that module instance and doesn't throw (FR-015, research R8).
- [X] T008 Implement `frontend/src/visitorKey.ts` per `contracts/ui.md`.
  - Pure apart from the default arguments (`window.localStorage` and `crypto.getRandomValues`), with every storage access in `try/catch`.
  - No network calls.
  - Make T007 pass.
- [X] T009 In `frontend/src/api.ts`, add `'X-Visitor-Key': getVisitorKey()` to the headers of `send()` calls for `/locations*` endpoints, and to the `deleteLocationOnUnload` keepalive `fetch`.
  - Don't add it to `logInteraction` or to the lightning and rain calls (contracts/locations-api.md "Unchanged").
  - Keep the existing header merge order so callers can still override `Content-Type`.
- [X] T010 [P] Make the existing backend tests send a key.
  - In `backend/src/routes/locations.test.ts`, add a `visitor(key = KEY_A)` helper that wraps Supertest and sets `X-Visitor-Key`. Route every existing `/api/locations*` call through it, including `addAll` and `listIds`.
  - Do the same for the `/api/locations` calls in `backend/src/publicLimits.test.ts` and `backend/src/routes/rain.test.ts`.
  - Use fixed 43-character test keys (for example `'a'.repeat(43)`, `'b'.repeat(43)`).
  - The existing assertions must still pass unchanged.

**Checkpoint**: the schema is migrated, the key helpers on both sides are tested, and the app still behaves as before for a single visitor.

---

## Phase 3: User Story 1 - My places are mine alone (Priority: P1) 🎯 MVP

**Goal**: each visitor sees and controls only their own places. Another visitor's places answer exactly like missing ones (FR-002 to FR-005, FR-008, FR-009).

**Independent Test**: two keys (or two browser sessions). Each adds different places. Each list and map shows only its own places. Refresh, get and delete across keys return 404. The same coordinates are allowed for two keys and are a 409 within one key.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T011 [US1] Add a `describe('per-visitor lists')` block to `backend/src/routes/locations.test.ts`, covering `contracts/locations-api.md`:
  - A and B each add a place, and `GET` returns only their own.
  - `GET`/`DELETE`/`POST .../refresh` on A's id with key B returns `404 { detail: 'Location not found' }`, byte-identical to a missing id, and A's row is unchanged.
  - The same routes with no header, and with a malformed header, also return 404.
  - `GET /api/locations` with no key and with a malformed key returns 200 `{ locations: [] }`.
  - `POST /api/locations` with no or malformed key returns 400 `{ detail: 'A visitor key is required' }`, and no row is created.
  - A and B save the same coordinates (both 201). A saves them twice (409).
  - Rows inserted directly with `visitor_id = NULL` appear for no key.
  - An error response never contains the key.

### Implementation for User Story 1

- [X] T012 [US1] Scope `backend/src/db.ts` by visitor:
  - `listLocations(visitorId)` filters `eq(locations.visitorId, visitorId)` and keeps the order `desc(createdAt), desc(id)`.
  - `createLocation(visitorId, lat, lon)` scopes the duplicate pre-check to the visitor, inserts `visitorId`, and maps the unique-index error to `DuplicateLocationError` as now.
  - `getLocation`, `updateWeather` and `deleteLocation` take `(visitorId, id)` and add `eq(locations.visitorId, visitorId)` to their `where`.
  - `resetStore()` also deletes all `visitors` rows and resets their `sqlite_sequence` entry.
  - `LocationRecord` stays unchanged (no `visitor_id` in responses).
- [X] T013 [US1] Scope every route in `backend/src/routes/locations.ts`:
  - Resolve `visitorKeyFrom(request)`.
  - `GET /locations`: with no key or an unknown visitor, return `{ locations: [] }` without a write. Otherwise list that visitor's rows.
  - `POST /locations`: with no or invalid key, return 400 `A visitor key is required` *after* the existing 422 body checks. Otherwise `ensureVisitor` then `createLocation(visitorId, ...)`.
  - `GET`/`DELETE`/`POST refresh` by id: an unknown visitor or a non-owned row returns the existing 404 before any weather call.
  - Never log the key. Existing log lines keep only `locationId`. Make T011 pass.
- [X] T014 [US1] Update `scripts/e2e/town-search.sh` and `scripts/e2e/use-my-location.sh`:
  - `locations_json()` must read the browser session's key with `ab eval "localStorage.getItem('weather-starter.visitor.key')"` (after the first page load) and `curl -sf -H "X-Visitor-Key: $KEY" "$BASE_URL/api/locations"`.
  - Check `scripts/e2e/lib.sh`'s readiness probe (`curl -sf $BASE_URL/api/locations`). It still gets a 200 with no key, so leave it.
- [X] T015 [US1] Run `npx vitest run backend/src/routes/locations.test.ts backend/src/visitors.test.ts frontend/src/visitorKey.test.ts backend/src/publicLimits.test.ts backend/src/routes/rain.test.ts`. All must pass.

**Checkpoint**: US1 is fully functional. With only Phases 1 to 3 shipped, visitors are isolated, and lists already survive reloads because the key is in `localStorage`.

---

## Phase 4: User Story 2 - My places are still here when I come back (Priority: P2)

**Goal**: lists persist on the same browser, record "use", and are swept after 90 days unused (FR-006, FR-007, FR-012).

**Independent Test**: save places, restart the server, and the same key still lists them. A visitor whose `last_used_at` is 90 days and a moment old is swept with its locations. One 89 days old is kept. NULL-visitor rows are never swept.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [X] T016 [P] [US2] In `backend/src/routes/locations.test.ts`:
  - After `restartApp()`, key A still lists its places with stored snapshots, and the fake weather client is not called by `GET`.
  - Any `/api/locations*` call with key A whose `last_used_at` is more than 1 hour old bumps it. A `GET` with an unknown key creates no `visitors` row.
- [X] T017 [P] [US2] In `backend/src/visitors.test.ts`, test `purgeUnusedVisitors(now)` with an explicit `now`:
  - Deletes visitors with `last_used_at` < `now − 90 days`, and all their locations (locations first).
  - Keeps a visitor at exactly 89 days.
  - Never deletes `visitor_id IS NULL` rows.
  - Returns `{ visitors, locations }` counts.
  - Leaves other visitors untouched.
- [X] T018 [P] [US2] In `backend/src/visitors.test.ts`, test `createSweepScheduler({ intervalMs, now, purge })`:
  - `maybeSweep()` runs `purge` the first time, then not again until `intervalMs` (6 h) has passed.
  - A rejected `purge` is caught and logged with no key data, and is retried at the next window.
  - Overlapping calls don't run two sweeps at once.

### Implementation for User Story 2

- [X] T019 [US2] In `backend/src/visitors.ts`:
  - Implement `purgeUnusedVisitors(now)`. Delete the locations, then the visitors, in one `adapter.batch`, and make no weather call.
  - Implement `createSweepScheduler`.
  - Export a default scheduler (6 h interval, `Date.now`).
  - Make T017 and T018 pass.
- [X] T020 [US2] In `backend/src/routes/locations.ts`:
  - Call `touchVisitor(visitorId, now)` for every request whose key resolves to a known visitor.
  - Call the scheduler's `maybeSweep()` without awaiting it, so it never delays the response.
  - Make T016 pass.
- [X] T021 [US2] In `backend/src/server.ts`, run one sweep at startup after the database is ready, without awaiting it, when `NODE_ENV !== 'test'`. Log only `{ visitors, locations }` counts with message `visitor retention sweep`.

**Checkpoint**: US1 and US2 both work. Lists persist, and abandoned ones are removed.

---

## Phase 5: User Story 3 - The owner keeps their current places (Priority: P2)

**Goal**: the pre-feature shared rows are hidden from everyone until the owner moves them into their own list with a one-off CLI (FR-011, research R9).

**Independent Test**: seed rows with `visitor_id = NULL`. A new key lists none of them. `claimLegacy(ownerKey)` moves them all, and the owner's key now lists them with their snapshots. A second key still sees none. Running it again claims 0.

### Tests for User Story 3 ⚠️ (write first, must fail)

- [X] T022 [P] [US3] Write `backend/src/claimLegacy.test.ts`. With 3 NULL-visitor rows (one with stored snapshot fields), check:
  - `claimLegacy(key)` returns `{ claimed: 3, skipped: 0 }`, and all three rows now have the owner's `visitor_id` with snapshots intact.
  - If the owner already has one of the coordinates, it returns `{ claimed: 2, skipped: 1 }`, and the clashing NULL row is left NULL, not deleted.
  - A second run returns `{ claimed: 0, skipped: 0 }` (or `skipped` equal to the clashes left).
  - A malformed key throws before any write.
  - The visitor row is created if missing, with `last_used_at` set to now so the sweep doesn't remove it.

### Implementation for User Story 3

- [X] T023 [US3] Implement `backend/src/claimLegacy.ts`. It exports `claimLegacy(key, now = new Date())` using `isVisitorKey`, `ensureVisitor` and a scoped update of `visitor_id IS NULL` rows that aren't already in the owner's list. Make T022 pass.
- [X] T024 [US3] Implement `backend/src/claimLegacyCli.ts`:
  - Read the key from `process.argv[2]`. On an invalid key, print `visitor key must be 43 base64url characters` and exit 1.
  - Otherwise print exactly `claimed <n>, skipped <m> (already in list)`, close the database and exit 0.
  - Never print the key, hash, coordinates or database URL (contracts/locations-api.md).
- [X] T025 [US3] Add `"claim-legacy": "tsx backend/src/claimLegacyCli.ts"` to the **root** `package.json` scripts. It must not go in `backend/package.json`, because the migrator resolves `backend/drizzle` from `process.cwd()`. Smoke-test it against a throwaway `DATABASE_PATH` holding NULL rows.

**Checkpoint**: shipping is safe. The legacy rows are invisible until the owner claims them.

---

## Phase 6: User Story 4 - I'm told where my places are kept (Priority: P3)

**Goal**: the privacy notice explains where saved places are kept, and every existing claim stays true (FR-013).

**Independent Test**: open the privacy explanation. The new sentence is there, and the collapsed line still says "no cookies".

- [X] T026 [US4] In `frontend/src/components/PrivacyNotice.tsx`, append one sentence after the analytics text:
  - Start from the draft in `contracts/ui.md`: "Places you save are kept on our server under a random code stored only in this browser, so no one else can see them. They're deleted after 90 days without use."
  - Keep it in the notice's tone, and mention that clearing this browser's data loses them.
  - Keep `Anonymous visit counts · no cookies` unchanged, and add no new classes or colours (Principle V).
- [X] T027 [US4] Update `scripts/e2e/privacy-notice.sh` if it asserts the explanation text: it must check the new sentence is present and that "no cookies" is still in the collapsed line.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T028 [P] Update `docs/architecture.md`:
  - **Storage:** the `visitors` table, `visitor_id`, the per-visitor unique index, and the hashed key.
  - **Snapshot pattern:** reads and refreshes are scoped to the requester's key, and another visitor's row returns 404.
  - **Frontend:** `visitorKey.ts`, the `X-Visitor-Key` header, the `localStorage` key `weather-starter.visitor.key`, and why no cookie.
  - **Retention sweep** and the claim CLI.
- [X] T029 [P] Update `docs/deployment.md`:
  - The one-off owner claim (steps from quickstart §4, with Turso credentials exported locally, never committed).
  - The 90-day retention.
  - The pre-launch capacity note (quickstart §5: Production key and `WEATHER_API_RATE_LIMIT`).
- [X] T030 Run `npm run verify` from the repo root (lint → typecheck → tests → build). Fix any failure before continuing.
- [X] T031 Run the browser checks per CLAUDE.md "Browser checks" and quickstart §3, against a temporary server and database, never the user's dev server:
  - Two `agent-browser` sessions are isolated (SC-001), and a reload keeps the list with no weather request on load (SC-004).
  - The visitor key appears in no console output or `/api/logs` body (SC-006).
  - The privacy sentence shows.
  - `scripts/e2e/town-search.sh`, `use-my-location.sh` and `privacy-notice.sh` pass.
  - `assert_clean` after each step, and no process is left holding a port.
- [X] T032 Run the `weather-code-review` skill on the branch diff, focusing on:
  - every `db.ts` query scoped by `visitorId`
  - 404 parity
  - no key in logs or errors
  - CSRF reasoning for the header
  - migration SQL

  Address the confirmed findings.
- [X] T033 ~~Optional safety check~~ **Superseded (2026-11-17):** a smoke run of the claim CLI accidentally reached production (it loaded `.env`), which applied migration 0004 there and claimed 9 legacy rows under a discarded key. Owner fix pending (see `docs/deployment.md` claim steps and the incident note in the PR). The CLI now never loads `.env` and needs `--remote`. Original task: copy the hosted Turso database to a local file (`turso db shell lepak-weather-prod .dump` into a temp SQLite), point `DATABASE_PATH` at it, start the app once, and confirm `database ready` with `migrationsApplied: 1` and that the old rows have NULL `visitor_id`. Delete the copy afterwards. It holds visitors' coordinates.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T002 must finish before T003.
- **Foundational (Phase 2)**: T003 → T004 → (T005 → T006). T007 → T008 → T009. T010 can run any time after T004. All of it blocks the stories.
- **US1 (Phase 3)**: after Phase 2. T011 → T012 → T013. T014 can run in parallel with T012/T013 (shell scripts). T015 comes last.
- **US2 (Phase 4)**: after US1, because T020 edits the same route file and relies on the scoped visitor resolution from T013.
- **US3 (Phase 5)**: after Phase 2 and T012 (scoped `db.ts`). It doesn't depend on US2, so it can run in parallel with Phase 4 if staffed separately.
- **US4 (Phase 6)**: after Phase 2 only. It can run any time. The sentence's "90 days" claim must match US2 before release.
- **Polish (Phase 7)**: after all stories.

### User Story Dependencies

- **US1 (P1)**: the base. Nothing else is shippable without it.
- **US2 (P2)**: builds on US1's route scoping.
- **US3 (P2)**: needs US1's scoped `db.ts`. It must ship in the same release as US1, so the legacy rows are never exposed and never orphaned without a claim path.
- **US4 (P3)**: independent wording. Ship it with US2 so the 90-day claim is true.

### Within Each User Story

- Write the tests first and confirm they fail, then implement.
- `db.ts` before routes. Routes before e2e scripts.

## Parallel Opportunities

- Phase 2: T005 (backend tests) ∥ T007 (frontend tests) ∥ T010 (test harness keys), all in different files.
- Phase 3: T014 (e2e scripts) ∥ T012/T013.
- Phase 4: T016 ∥ T017 ∥ T018 (tests in two files; T017 and T018 share `visitors.test.ts`, so write them in sequence if one person does both).
- Phase 5 (US3) ∥ Phase 4 (US2) after T013.
- Phase 6 (US4) ∥ any story phase.
- Phase 7: T028 ∥ T029.

### Parallel Example: Phase 2

```text
Task: "T005 Write backend/src/visitors.test.ts (key format, hash, find/ensure/touch)"
Task: "T007 Write frontend/src/visitorKey.test.ts (generation vector, storage fallback)"
Task: "T010 Send X-Visitor-Key in locations/publicLimits/rain Supertest calls"
```

### Parallel Example: after US1

```text
Task: "T017 purgeUnusedVisitors tests in backend/src/visitors.test.ts"     (US2)
Task: "T022 claimLegacy tests in backend/src/claimLegacy.test.ts"          (US3)
Task: "T026 Privacy sentence in frontend/src/components/PrivacyNotice.tsx" (US4)
```

## Implementation Strategy

### MVP First (US1, plus US3 as a release guard)

1. Phase 1 → Phase 2 → Phase 3 (US1). **Validate**: two-key isolation tests and a two-session browser check.
2. US1 alone is the MVP behaviour. But **don't deploy it without US3**: once deployed, the legacy rows become invisible to everyone until the claim CLI exists. That's safe, but the owner would temporarily lose their places.

### Incremental Delivery

1. Setup + Foundational → the key plumbing is in, with no behaviour change.
2. + US1 + US3 → isolation, plus the owner can reclaim their places. This is the first deployable increment.
3. + US2 → the 90-day retention. Deploy.
4. + US4 → the notice wording. It can ship with step 3 so the "90 days" claim is accurate.
5. Polish → docs, verify, browser checks and review before merge.

## Notes

- [P] = different files, no dependencies on incomplete tasks.
- Every route change keeps Supertest coverage (Principle VI). Pre-commit runs `npm run lint` and `npm test`, and must not be bypassed.
- Never use the hosted Turso database in tests or browser checks (constitution Technical Constraints).
- Commit after each task or logical group with conventional prefixes (`feat:`, `test:`, `docs:`).
