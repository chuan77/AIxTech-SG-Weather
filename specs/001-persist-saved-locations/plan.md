# Implementation Plan: Persist Saved Locations

**Branch**: `001-persist-saved-locations` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-persist-saved-locations/spec.md`

## Summary

Most of this feature already exists: `locations` rows (coordinates plus the flattened weather snapshot) live in SQLite, `POST /api/locations` saves then refreshes, `GET /api/locations` lists newest first, and the store loads and auto-selects the first location on mount. The plan is therefore a **verify-and-close-gaps** change, not a build. See [research.md](research.md) for the audit. The gaps to close:

1. **Test coverage** for FR-002/003/006/009/011 and restart persistence (SC-001, SC-004) is missing; only create+refresh and delete are tested.
2. **FR-011**: a non-`WeatherProviderError` failure during the first refresh returns 500 even though the row was saved.
3. **FR-002**: a concurrent duplicate insert hits the unique index and surfaces as 500, not 409.
4. **FR-010**: the store's `error` (load failure) is never rendered, so a failed startup load shows an empty state with no message.
5. **Startup with unreadable DB** (edge case): the top-level `await migrate` in `db.ts` crashes the process. Research D4 keeps fail-fast (with a clear log, no data touched), which narrows the spec edge case; needs your sign-off.

No schema change and no new migration are needed.

## Technical Context

**Language/Version**: TypeScript on Node (built-in `node:sqlite`), ESM

**Primary Dependencies**: Express, Drizzle ORM (`sqlite-proxy` driver), React 18, Vite, Tailwind 3, supertest, vitest

**Storage**: SQLite file at `backend/weather.db` (or `DATABASE_PATH`); table `locations` with unique index on (latitude, longitude)

**Testing**: vitest (node env, forks, no file parallelism); backend route tests via `createApp` with a fake `weatherClient`; frontend tests limited to pure `.ts` modules

**Target Platform**: Local single-user Node process serving API and frontend

**Project Type**: Web application (npm workspaces `backend` + `frontend`, one process)

**Performance Goals**: SC-002: up to 50 locations visible within 3 s of opening the app (one `GET /api/locations`, no upstream calls)

**Constraints**: No data.gov.sg calls on page load (Constitution I); relative `/api/*` only (II); no destructive behaviour on load or save failure (FR-010)

**Scale/Scope**: Single user, tens of locations; 4 small backend/frontend touch points plus tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Snapshot-Only Weather Data | PASS | Startup only reads stored rows (FR-004, FR-005); refresh stays on create/explicit refresh. |
| II. One Process, Relative API | PASS | No new endpoints beyond existing `/api/locations*`; error state goes in the existing store. |
| III. Injectable Weather Provider | PASS | New backend tests use `createApp` with a fake client, including a throwing one. |
| IV. Testing Within Real Limits | PASS | Backend tests for routes and restart; any frontend logic worth testing is extracted to a pure `.ts` module. |
| V. Theme-Driven UI | PASS | Error banner uses `white` classes and `rounded-card`; no literal colours. |
| Schema via Drizzle migration | PASS (N/A) | No schema change. |

**Post-design re-check**: still PASS; the design adds no schema, endpoints or state containers. No Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/001-persist-saved-locations/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── locations-api.md
├── checklists/requirements.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db.ts                      # map unique-index violation to DuplicateLocationError; clear log + non-zero exit if DB cannot open
│   └── routes/
│       ├── locations.ts           # FR-011: keep saved row on any first-refresh failure
│       └── locations.test.ts      # new cases: 409, 422, ordering, restart, refresh failure, delete
frontend/
└── src/
    ├── state/store.tsx            # expose load error; keep existing select-first logic
    └── components/
        └── Sidebar.tsx            # render load/save error banner (FR-010)
docs/architecture.md               # note startup/error behaviour if changed
```

**Structure Decision**: Existing web-application layout is kept as is; changes are confined to the files above.

## Complexity Tracking

No constitution violations.
