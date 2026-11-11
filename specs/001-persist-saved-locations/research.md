# Research: Persist Saved Locations

No `NEEDS CLARIFICATION` items remained in the Technical Context. The research below is a code audit of each requirement against the current tree, plus decisions for the gaps found.

## Audit: requirement vs. current code

| Req | Status | Evidence |
|-----|--------|----------|
| FR-001 durable save on add | Done | `createLocation` single-statement `INSERT` in `backend/src/db.ts` (atomic: saved fully or not at all). |
| FR-002 duplicate rejected | Mostly | Pre-check plus unique index; race on the index yields 500, not 409. Untested. |
| FR-003 validation | Done | `routes/locations.ts` returns 422 for NaN and out-of-Singapore bounds. Untested. `null` coordinates coerce to `0` and get the "within Singapore" message rather than "required" (acceptable). |
| FR-004 snapshot stored with location | Done | Snapshot columns live on the `locations` row. |
| FR-005 auto-list on startup | Done | `StoreProvider` loads on mount. |
| FR-006 newest first | Done | `ORDER BY created_at DESC, id DESC`. Untested. |
| FR-007 first selected | Done | Mount effect and `effectiveSelectedId` fall back to `locations[0]`. |
| FR-008 empty state | Done | Sidebar/Hero handle empty list (verify visually in quickstart). |
| FR-009 delete permanent | Done | Row delete removes snapshot (same row). |
| FR-010 clear error, no data loss | Gap | Store sets `error`, but no component renders it; load failure looks like an empty list. Nothing destructive happens on failure. |
| FR-011 save even if first refresh fails | Gap | Only `WeatherProviderError` is caught; any other error returns 500 after the row is saved. |
| Edge: DB unreadable at startup | Gap | `await migrate(...)` at import time throws and the process exits. |

## Decisions

### D1: Treat any first-refresh failure as non-fatal
- **Decision**: In `POST /api/locations`, catch every error from `getCurrentWeather`/`updateWeather` after the insert, log it, and return 201 with the saved (not-refreshed) location.
- **Rationale**: FR-011 says the location is kept regardless; a 500 after a successful insert misleads the user into retrying and then hitting 409.
- **Alternatives**: Roll back the insert on failure (contradicts FR-011); keep catching only `WeatherProviderError` (leaves the gap).

### D2: Map unique-index violations to the duplicate error
- **Decision**: In `createLocation`, catch the SQLite constraint error on insert and rethrow `DuplicateLocationError`; keep the pre-check for the common path.
- **Rationale**: The unique index is the real guard; two simultaneous adds should both get a clean result.
- **Alternatives**: `INSERT ... ON CONFLICT DO NOTHING` and check the returned row (also fine, but changes the query shape more); drop the pre-check (loses the cheap early exit).

### D3: Surface load/save errors in the sidebar
- **Decision**: Expose the store's existing `error` and render a dismissible-by-next-success banner in `Sidebar` using `white` classes and `rounded-card`. Load failure keeps the list as-is and shows the message; the add form keeps its own `submitError`.
- **Rationale**: Reuses the single store (Constitution II) and theme rules (V); satisfies FR-010 and SC-005 without new state containers.
- **Alternatives**: Toast system (new dependency/state); `window.alert` (poor UX).

### D4: Startup with unreadable database
- **Decision**: Keep fail-fast on migration failure at process start, but log a clear message and exit non-zero; do not touch or recreate the file. The in-app error banner (D3) covers runtime failures such as a locked DB returning 500.
- **Rationale**: The server and frontend are one process, so if the DB cannot be opened there is no page to show an error on; serving a degraded app would require restructuring the top-level-await module for little single-user value. The important guarantee, never deleting existing data, already holds. This narrows the spec edge case ("the app still opens") to "the app does not open and says why in the terminal"; flagged for the user to accept or override.
- **Alternatives**: Lazy-init the DB and return 503 from `/api/*` so the UI can render an error (more faithful to the spec but a larger refactor of `db.ts` and tests).

### D5: Restart persistence is tested by re-importing the DB module
- **Decision**: Test with a temp `DATABASE_PATH`: create locations, `closeDatabase()`, `vi.resetModules()`, re-import `db.js`/`server.js`, and assert `GET /api/locations` returns the same list and order.
- **Rationale**: Simulates a process restart within the existing forked, non-parallel vitest setup (Constitution IV) with no network.
- **Alternatives**: Spawn a real server process (slow, flaky); only assert in-process list (does not prove durability).

### D6: Ordering stability
- **Decision**: Keep `created_at` (second resolution) with `id DESC` as the tiebreaker; add a test that adds locations within the same second and asserts newest-first.
- **Rationale**: Autoincrement `id` is monotonic, so the tiebreak makes order deterministic across restarts (SC-003, US3 scenario 2).
- **Alternatives**: Order by `id DESC` only (equivalent, but `created_at` first matches the spec's wording).
