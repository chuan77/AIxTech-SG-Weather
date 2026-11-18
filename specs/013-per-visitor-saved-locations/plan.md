# Implementation Plan: Private Saved Locations per Visitor

**Branch**: `013-per-visitor-saved-locations` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/013-per-visitor-saved-locations/spec.md`

## Summary

Every visitor currently shares one saved-locations list. The plan:

- **Key:** each browser makes a 256-bit random key, keeps it in `localStorage` and sends it as an `X-Visitor-Key` header on `/api/locations*` calls.
- **Storage:** the server stores only a SHA-256 hash of the key in a new `visitors` table, and files each location under `visitor_id`. Duplicate coordinates are refused per visitor. Any row the requester doesn't own answers exactly like a missing one.
- **Retention:** a background sweep at startup, and at most every 6 hours, removes visitors unused for 90 days along with their places.
- **Owner's places:** the pre-feature shared rows stay hidden (`visitor_id IS NULL`) until the owner runs a one-off root CLI script that moves them into their own list.
- **Unchanged:** weather fetching, the snapshot pattern, the single frontend store, the response shapes, and the "no cookies" promise. The privacy notice gains one sentence.

## Technical Context

**Language/Version**: TypeScript on Node (ESM), the repo's existing toolchain.

**Primary Dependencies**:
- Backend: Express 4, Drizzle ORM 0.45 (`sqlite-proxy`), drizzle-kit 0.31, Node `crypto`.
- Frontend: React 18, using the Web Crypto `getRandomValues` and `localStorage` built into the browser.
- No new packages.

**Storage**:
- SQLite via `node:sqlite` locally and in tests, Turso (libSQL) when hosted.
- One new table (`visitors`), one new column, and a swapped unique index, in one generated migration ([data-model.md](data-model.md)).

**Testing**:
- vitest. Backend routes go through `createApp` and Supertest with a fake `weatherClient` (Principles III, IV and VI).
- Frontend: only the pure `visitorKey.ts`.
- agent-browser e2e scripts in `scripts/e2e/`.

**Target Platform**: the existing single Node process. Locally through Portless, hosted as the Vercel container (`sin1`) with Turso.

**Project Type**: web app (npm workspaces `backend` and `frontend` in one process).

**Performance Goals**:
- No extra weather calls.
- Each locations request adds at most one indexed visitor lookup and, at most once an hour per visitor, one `last_used_at` write.

**Constraints**:
- No data.gov.sg calls on page load (Principle I).
- No cookies, so the notice stays true.
- The key never appears in logs, URLs or analytics.
- No new public endpoint.
- The migration must be plain `ADD COLUMN` plus index changes, so drizzle-kit doesn't rebuild the table against Turso's uploaded history.

**Scale/Scope**:
- Fewer than 5 visitors today, more later. Unknown public count, so the capacity decision is deferred to launch (research R11).
- About 10 legacy rows.
- Turso free tier: 10M writes a month.

No NEEDS CLARIFICATION remain. All were resolved in [research.md](research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How this plan complies |
|---|---|---|
| I. Snapshot-Only Weather Data | Pass | Snapshots are still stored server-side. `GET /api/locations` still only reads stored data. The key is created in the browser without a network call. The retention sweep and claim script make no weather calls. Weather is still fetched only on create or refresh. The wording "stored in SQLite" still holds (per-visitor rows in the same store). |
| II. One Process, Relative API | Pass | Same process, same relative `/api/*` paths. Server state stays in `store.tsx` through `api.ts`. The key lives in a small pure module that `api.ts` reads, and the store's shape doesn't change. No CORS is added: the lack of CORS is what blocks cross-site use of the header. |
| III. Injectable Weather Provider | Pass | No change. Tests keep injecting a fake `weatherClient`. |
| IV. Testing Within Real Limits | Pass | Isolation, retention and claim logic are tested in vitest on the shared forked SQLite configuration. The browser-side logic is extracted into pure `visitorKey.ts` with injected storage and random source. |
| V. Theme-Driven UI | Pass | The only UI change is one sentence in `PrivacyNotice.tsx`, with no new colours or classes. |
| VI. Testing & Quality Gate | Pass | Every changed route keeps Supertest coverage in `locations.test.ts`, extended with two-visitor cases. Lint and tests run in pre-commit, and `npm run verify` runs before done. |
| Technical Constraints: schema via `schema.ts` and `db:generate` | Pass | A single generated migration. |
| Workflow: docs updated with architecture changes | Pass | `docs/architecture.md` (Storage, Snapshot pattern, Frontend) and `docs/deployment.md` (claim step, retention) are in scope. |

**Post-design re-check (after Phase 1)**: still passes. The design added no new route, dependency, state container or theme token. The CLI is a root `package.json` script (`tsx`), the same as `npm run dev`. That matters because the migrator resolves `backend/drizzle` from `process.cwd()`, so a backend-workspace script would fail.

## Project Structure

### Documentation (this feature)

```text
specs/013-per-visitor-saved-locations/
├── plan.md              # This file
├── research.md          # Phase 0: R1–R11 decisions
├── data-model.md        # Phase 1: visitors table, locations changes, visibility rules
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── locations-api.md # Header, per-route behaviour, claim CLI
│   └── ui.md            # visitorKey module, screens, privacy notice text
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks), not created here
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── schema.ts                 # + visitors table; locations.visitor_id; unique index (visitor_id, lat, lon)
│   ├── db.ts                     # list/get/create/update/delete take a visitorId; resetStore clears visitors
│   ├── visitors.ts               # NEW: key format check, sha256 hash, find/create visitor, touch last_used, 90-day sweep scheduler
│   ├── visitors.test.ts          # NEW
│   ├── claimLegacy.ts            # NEW: move visitor_id IS NULL rows to one visitor, skip clashes, return counts
│   ├── claimLegacy.test.ts       # NEW
│   ├── claimLegacyCli.ts         # NEW: argv → claimLegacy → prints counts only
│   ├── routes/locations.ts       # read X-Visitor-Key, scope every route, 400 on create without key, 404 parity
│   ├── routes/locations.test.ts  # helper sends a key; two-visitor isolation, 404 parity, per-visitor duplicates
│   └── server.ts                 # run first sweep after DB ready (not in tests)
└── drizzle/0004_*.sql            # generated migration + meta snapshot

frontend/src/
├── visitorKey.ts                 # NEW: generate / validate / get-or-create with storage fallback
├── visitorKey.test.ts            # NEW
├── api.ts                        # add X-Visitor-Key on /locations* (send + deleteLocationOnUnload)
└── components/PrivacyNotice.tsx  # one added sentence (FR-013)

scripts/e2e/
├── town-search.sh                # curl reads send the browser's key
└── use-my-location.sh            # same

package.json                      # + "claim-legacy": "tsx backend/src/claimLegacyCli.ts"
docs/architecture.md, docs/deployment.md
```

**Structure Decision**: the existing two-workspace, one-process layout. New logic goes in small modules beside `db.ts` (`visitors.ts`, `claimLegacy.ts`), following how `rateLimit.ts` and `dbConfig.ts` sit beside `server.ts`. The frontend change is one pure module, consumed only by `api.ts`.

## Spec adjustments (made with this plan)

- User Story 3, scenario 2: the owner runs the one-off step using their browser's key, from a terminal with database access (research R9), not inside the browser. The outcome the spec asks for is unchanged.

## Risks to watch in implementation

- **drizzle-kit output.** Check the generated SQL is `CREATE TABLE visitors`, `ALTER TABLE locations ADD visitor_id`, `DROP INDEX` and `CREATE UNIQUE INDEX`, with no `__new_locations` rebuild. Check against the drizzle-kit 0.31 docs via Context7 before running `db:generate`.
- **Migration ordering on Turso.** The old index is dropped before the new one is created, in the same batch. Legacy rows all have NULL `visitor_id`, so the new index can't conflict.
- **Lost key UX.** A visitor who clears site data loses their list with no warning. This is accepted (spec Assumptions), but say so in the notice sentence.
- **Capacity.** Out of scope, but it gates public promotion (quickstart §5).

## Complexity Tracking

No constitution violations. Nothing to justify.
