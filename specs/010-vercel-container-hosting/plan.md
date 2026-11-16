# Implementation Plan: Host Lepak Weather on Vercel Containers with Turso

**Branch**: `010-vercel-container-hosting` | **Date**: 2026-11-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-vercel-container-hosting/spec.md`

## Summary

Run the existing single-process app (Express plus the built React frontend) as one container on Vercel's Container preset, in Singapore (`sin1`). Saved locations move to the seeded Turso database `lepak-weather-prod` when Turso settings are present; otherwise the app keeps using the local SQLite file.

The database change is deliberately narrow (research R1): Drizzle's `sqlite-proxy` driver and migrator stay, and a small adapter chooses between `node:sqlite` (local and tests) and `@libsql/client/web` (Turso). Because the same migrator that wrote the seeded migration history reads it again, the history is compatible by construction.

A GitHub Actions workflow runs the full `npm run verify` gate on every push and PR, and deploys to production with the Vercel CLI only after it passes on `main`. Vercel's own Git deploys are turned off so the gate can't be bypassed.

## Technical Context

**Language/Version**: TypeScript 5.7 on Node 24 LTS (container and CI). Local development is on Node 26.

**Primary Dependencies**:
- Existing: Express 4, Drizzle ORM 0.45.3 (`sqlite-proxy`), React 18 and Vite 7, pino.
- New: `@libsql/client` (the `/web` entry only).
- New, not runtime dependencies: Vercel CLI, run through `npx` with a pinned version in CI; Docker base image `node:24-alpine`.

**Storage**: SQLite. Local file via `node:sqlite` when no Turso settings are present; Turso Cloud (libSQL, `aws-ap-southeast-1`) in production. No schema change.

**Testing**: vitest (forks, no file parallelism) and Supertest, unchanged. The new pure-function unit tests need no network. Hosting checks are manual or scripted in [quickstart.md](./quickstart.md).

**Target Platform**:
- Vercel Container runtime (beta), Hobby plan, region `sin1`. Linux `node:24-alpine` image running as a non-root user.
- GitHub Actions `ubuntu-latest`.

**Project Type**: web application (npm workspaces `frontend` and `backend`, served by one Express process).

**Performance Goals**: a warm dashboard load in under 3 s on a phone (SC-006). Cold start is measured, with no target.

**Constraints**:
- $0 a month.
- Fewer than 5 visitors.
- data.gov.sg Development tier (12 requests per 10 s).
- Vercel Hobby: 2 GB and 1 vCPU, 300 s per request, scale-down after 5 minutes idle, 30 s `SIGTERM` grace.
- No secrets in the repo or in logs.

**Scale/Scope**:
- 1 Vercel project and 1 Turso database.
- About 8 new or changed repo files, plus 1 constitution amendment and the docs updates.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle / rule | Status | Notes |
|---|---|---|
| I. Snapshot-Only Weather Data | ✅ Pass | No change to when data.gov.sg is called. Snapshots are still stored in SQLite (libSQL is SQLite) |
| II. One Process, Relative API | ✅ Pass | One container runs one Node process serving the frontend and `/api`. No CORS and no second service |
| III. Injectable Weather Provider | ✅ Pass | Untouched |
| IV. Testing Within Real Limits | ✅ Pass | Tests stay on a local SQLite file through `node:sqlite`, forked and non-parallel. New logic (config resolution, libSQL row mapping) is pure and unit-tested |
| V. Theme-Driven UI | ✅ N/A | No UI change |
| VI. Testing & Quality Gate | ✅ Pass | No new routes. The pre-commit hook is unchanged. CI adds the full `verify` gate on top |
| Tech Constraints: "Drizzle over Node's built-in `node:sqlite`" | ⚠️ Amend | A hosted libSQL backend in production widens this. **MINOR amendment 1.3.0 → 1.4.0** in the same change (research R10). Justified below |
| Tech Constraints: "secrets MUST NOT be committed" | ✅ Pass | Secrets live only in Vercel env and GitHub secrets. `.env.example` holds only placeholders, with the Turso lines commented out. `.vercel/` is git-ignored |
| Tech Constraints: "DB path relative to `process.cwd()`" | ✅ Pass | The image uses `WORKDIR /app` and runs from the repo root layout |
| Workflow: changes to architecture update `docs/` | ✅ Planned | `docs/architecture.md` (Storage), `docs/src/content/docs/backend/storage.md`, `configuration.md`, and the new `docs/deployment.md` |

**Post-design re-check (after Phase 1)**: still passes. The design adds no route, no UI and no second process. The only deviation is the Technical Constraints amendment, recorded in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/010-vercel-container-hosting/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R10
├── data-model.md        # Phase 1: config and adapter model (no schema change)
├── quickstart.md        # Phase 1: validation guide (local → offline Turso → deploy → drills)
├── contracts/
│   └── runtime-config.md  # env vars, files, secrets, required check
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
backend/src/
├── db.ts                     # CHANGED: use the adapter; resolve config; log kind + migrationsApplied; resetStore via adapter
├── dbConfig.ts               # NEW: resolveDatabaseConfig(env) (pure)
├── dbConfig.test.ts          # NEW: local / turso / partial / require-remote / bad scheme
├── dbAdapter.ts              # NEW: node:sqlite adapter + @libsql/client/web adapter; libsqlRowsToValues (pure)
├── dbAdapter.test.ts         # NEW: row mapping and empty `get` (fake ResultSet, no network)
└── server.ts                 # CHANGED: HOST env, SIGTERM graceful shutdown

Dockerfile                    # NEW: 2-stage node:24-alpine, frontend+backend workspaces only
.dockerignore                 # NEW
vercel.json                   # NEW: framework container, regions sin1, git deploys off
.github/workflows/ci.yml      # NEW: verify (push+PR) → deploy (push to main, serialized)
.env.example                  # CHANGED: HOST, PORT, TURSO_* (owner's XXXX placeholders, commented out), DATABASE_REQUIRE_REMOTE (comment)
.gitignore                    # CHANGED: add .vercel/
package.json / package-lock.json  # CHANGED: add @libsql/client

.specify/memory/constitution.md   # AMEND 1.3.0 → 1.4.0 (Technical Constraints: storage)
docs/architecture.md              # CHANGED: Storage paragraph (local vs Turso), hosting note
docs/deployment.md                # NEW: commit-to-live, settings table, manual deploy, rollback (FR-015)
docs/src/content/docs/backend/storage.md, configuration.md  # CHANGED: mirror the above
CLAUDE.md                         # CHANGED: one line pointing to docs/deployment.md
```

**Structure Decision**: keep the existing two-workspace web app layout. Hosting files live at the repo root, where Vercel and GitHub expect them. Database changes stay inside `backend/src/` beside `db.ts`, split into two small pure-logic modules so they can be unit-tested under Principle IV.

## Implementation Order (for /speckit-tasks)

1. **Storage seam**:
   - Add `dbConfig.ts` and `dbAdapter.ts` with their tests.
   - Refactor `db.ts` onto the adapter, with local behaviour identical.
   - Run `npm run verify`, which must be green before anything else.
2. **Server**: `HOST` env and `SIGTERM` shutdown.
3. **Offline Turso proof**: quickstart §2 against a copy of the seeded database. Go or no-go for production data.
4. **Image**: `Dockerfile` and `.dockerignore`; quickstart §4.
5. **Platform config**: `vercel.json`; `.env.example`, `.gitignore`.
6. **Pipeline**: `.github/workflows/ci.yml`.
7. **Docs and constitution**: the amendment, `docs/deployment.md`, the architecture and docs-site updates, and the `CLAUDE.md` pointer.
8. **Owner setup** (quickstart §3), then **first deploy and drills** (§5–§8).

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `vercel deploy --prod` (no `--prebuilt`) doesn't build a Container project from CI | Confirm on the first run. Fallback: re-enable Git deploys for `main` only and rely on the branch ruleset as the gate |
| `regions` isn't applied to containers on Hobby | Check after the first deploy. Fallback: set the region in Project Settings |
| Seeded migration history is rejected | Proven offline first (quickstart §2). Fallback: recreate the database empty, which the owner accepted |
| A libSQL row shape differs from what the proxy expects | Pure mapping function by column index, unit-tested. Checked end-to-end in §2 |
| Container runtime is beta | Accepted by the owner. Rollback is documented |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Technical Constraints say storage is "Drizzle over Node's built-in `node:sqlite`", but production uses hosted libSQL (Turso) through the same `sqlite-proxy` path | A container's disk is temporary on Vercel. Without a hosted store, saved locations vanish after 5 idle minutes (FR-004, SC-003) | Keeping `node:sqlite` on the container disk loses data. Switching every environment to libSQL would add a native dependency to local development and tests and change the migrator. Postgres would need a schema and migration rewrite |
