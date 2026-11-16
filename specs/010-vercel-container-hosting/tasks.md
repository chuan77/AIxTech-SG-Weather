---
description: "Task list for 010-vercel-container-hosting"
---

# Tasks: Host Lepak Weather on Vercel Containers with Turso

**Input**: Design documents from `specs/010-vercel-container-hosting/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/runtime-config.md](./contracts/runtime-config.md), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution Principles IV and VI require vitest coverage for new backend logic. New logic is kept in pure modules so it can be tested offline. Hosting behaviour is checked with the steps in quickstart.md.

**Organization**: grouped by user story (spec.md). Tasks marked **(owner)** are account-level or outward-facing actions the owner performs in the Vercel, Turso or GitHub UI or CLI. The implementer prepares the exact steps and waits for the owner to confirm before continuing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4 from spec.md
- Paths are relative to the repo root (web app: `backend/src/`, `frontend/src/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: branch, dependency and ignore rules.

- [ ] T001 Create branch `010-vercel-container-hosting` from `main`, carrying over `specs/010-vercel-container-hosting/` and `.specify/assessments/vercel-container-hosting/`. Leave the unrelated untracked folders (`specs/009-lightning-strike-grouping/`, `.specify/assessments/lightning-strike-grouping/`, `.specify/assessments/station-reading-map-layers/`) untouched and uncommitted.
- [ ] T002 Add `@libsql/client` as a runtime dependency in the root `package.json` (where `drizzle-orm` lives) with `npm install @libsql/client`, and commit the updated `package-lock.json`. Check the installed version with Context7 before using its API (CLAUDE.md, Library docs).
- [ ] T003 [P] Add `.vercel/` to `.gitignore`, under a new `# Vercel CLI link` comment.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the storage seam (research R1 and R2). The hosted app can't run without it, and it must leave local behaviour identical.

**⚠️ CRITICAL**: no user-story work starts until T011 passes.

- [ ] T004 [P] Write failing tests in `backend/src/dbConfig.test.ts` for `resolveDatabaseConfig(env, cwd)`. Cover these validation rules, verbatim from data-model.md:
  - "Both `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` non-empty" gives `{ kind: 'turso', url, authToken }`.
  - "Both empty or absent" gives `{ kind: 'local', path }`, where path is `DATABASE_PATH` or `<cwd>/backend/weather.db`.
  - "Exactly one present" gives `ConfigError("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set together")`.
  - "`DATABASE_REQUIRE_REMOTE=true` and the result would be `local`" gives `ConfigError("a hosted database is required here")`.
  - A URL scheme other than `libsql:`, `https:` or `http:` gives `ConfigError`.
  - Whitespace-only values count as empty.
  - No error message contains the URL or token value. Assert this with a sentinel token string.
- [ ] T005 [P] Write failing tests in `backend/src/dbAdapter.test.ts` for the pure `libsqlRowsToValues(resultSet, method)` mapping, using a fake libSQL `ResultSet` (`columns`, `rows` as array-like `Row` objects with both index and named keys). Cover:
  - `all` and `values` return value arrays in column order, mapped by index, never `Object.values`.
  - `get` returns the first row's values, or `undefined` rows when there is no row.
  - `run` returns `[]`.
  - Must not touch the network.
- [ ] T006 Implement `backend/src/dbConfig.ts`: export `ConfigError` and `resolveDatabaseConfig(env: NodeJS.ProcessEnv, cwd: string)` to pass T004 (research R2).
- [ ] T007 Implement `backend/src/dbAdapter.ts`:
  - The `DatabaseAdapter` interface: `query(sql, params, method)` gives `{ rows }`, `batch(statements: string[])`, `execute(sql)`, `close()`.
  - `createLocalAdapter(path)`, wrapping the existing `node:sqlite` `DatabaseSync` logic moved from `db.ts`. It does `mkdirSync` of the parent folder and sets `PRAGMA journal_mode = WAL`. `batch` runs the statements in order, as today.
  - `createTursoAdapter(url, authToken)` using `createClient` from `@libsql/client/web`. `query` uses `client.execute({ sql, args })` plus `libsqlRowsToValues`. `batch` uses `client.batch(statements, 'write')`.
  - Export `libsqlRowsToValues` so it passes T005.
- [ ] T008 Refactor `backend/src/db.ts` onto the adapter:
  - Resolve config with `resolveDatabaseConfig(process.env, process.cwd())`.
  - Build the matching adapter, and pass `adapter.query` to `drizzle()` from `drizzle-orm/sqlite-proxy`.
  - Run `migrate()` from `drizzle-orm/sqlite-proxy/migrator`, with the callback calling `adapter.batch(trimmedNonEmptyQueries)` and `migrationsFolder: join(process.cwd(), 'backend', 'drizzle')`.
  - Count the migrations applied by comparing the number of `__drizzle_migrations` rows before and after.
  - Log `database ready` with `{ kind, migrationsApplied }`, never the URL or token.
  - On failure, keep the existing `could not open or migrate the database` error log with `kind` plus the config error message (variable names only), and rethrow.
  - `resetStore()` uses `adapter.execute("DELETE FROM sqlite_sequence WHERE name = 'locations'")`, and `closeDatabase()` calls `adapter.close()`.
  - The exported functions and their behaviour stay unchanged.
- [ ] T009 Run `npx vitest run backend/src/dbConfig.test.ts backend/src/dbAdapter.test.ts backend/src/routes/locations.test.ts` and confirm the existing route tests pass unchanged in local mode.
- [ ] T010 Offline migration-history proof (quickstart §2): **(owner)** installs the Turso CLI (`brew install tursodatabase/tap/turso`). Then copy `~/Downloads/lepak-weather-prod.db` to a throwaway path, start `turso dev --db-file <copy>`, and run `npm run build` followed by `TURSO_DATABASE_URL=http://127.0.0.1:8080 TURSO_AUTH_TOKEN=dev NODE_ENV=production node --disable-warning=ExperimentalWarning backend/dist/server.js`. Expect the log `kind: "turso"`, `migrationsApplied: 0`, and 10 rows from `GET /api/locations`.
  - If migrations apply or start-up fails, stop and report. The owner's accepted fallback is to recreate `lepak-weather-prod` empty.
  - Tear down `turso dev` and the server, and delete the copy, whether it passes or fails.
- [ ] T011 Run `npm run verify` (lint → typecheck → tests → build). It must be green.

**Checkpoint**: storage works locally and against a Turso-compatible copy. User stories can begin.

---

## Phase 3: User Story 1 - Open Lepak Weather from a public link (Priority: P1) 🎯 MVP

**Goal**: the app runs as one container on Vercel in `sin1` and loads over HTTPS on laptop and phone.

**Independent Test**: deploy once by hand with the Vercel CLI, open the public URL on a laptop and on a phone, and use each main feature (quickstart §5, steps 2–4).

### Tests for User Story 1

- [ ] T012 [P] [US1] Write failing tests in `backend/src/listenConfig.test.ts` for the pure `resolveListenConfig(env)`:
  - The default is `{ host: '127.0.0.1', port: 3000 }`.
  - `HOST=0.0.0.0` and `PORT=8080` are respected.
  - A non-numeric or out-of-range `PORT` throws an error naming `PORT`.

### Implementation for User Story 1

- [ ] T013 [US1] Implement `backend/src/listenConfig.ts` (`resolveListenConfig`) to pass T012. Then update the start-up block in `backend/src/server.ts`:
  - Listen on `host` and `port` from `resolveListenConfig(process.env)`, logging the URL as today.
  - On `SIGTERM` and `SIGINT`: log `shutting down`, call `server.close()`, then `closeDatabase()` from `./db.js`, then `process.exit(0)`.
  - Add a 25 s safety timer that forces `process.exit(1)`, called `unref()` (research R3).
- [ ] T014 [P] [US1] Create `.dockerignore` excluding `node_modules`, `**/node_modules`, `.env`, `.env.*` (keep `!.env.example`), `*.db`, `*.db-shm`, `*.db-wal`, `backend/*.db*`, `docs`, `specs`, `.specify`, `.claude`, `.git`, `.github`, `e2e-artifacts`, `RealtimeWeatherReadingsacrossSingapore`, `.vercel`, `frontend/dist` and `backend/dist` (contracts §3).
- [ ] T015 [P] [US1] Create the `Dockerfile` (research R4):
  - **Stage `build`** on `node:24-alpine`, `WORKDIR /app`:
    - Copy `package.json`, `package-lock.json`, `frontend/package.json` and `backend/package.json`.
    - Run `npm ci --workspace frontend --workspace backend --include-workspace-root --ignore-scripts`.
    - Copy the sources, then run `npm run build`.
  - **Stage `runtime`** on `node:24-alpine`, `WORKDIR /app`:
    - Set `ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATABASE_REQUIRE_REMOTE=true`.
    - Copy the same package files and run `npm ci --omit=dev --workspace frontend --workspace backend --include-workspace-root --ignore-scripts`.
    - Copy `backend/dist`, `backend/drizzle` and `frontend/dist` from `build`.
    - `USER node`, `EXPOSE 3000`, `CMD ["node", "--disable-warning=ExperimentalWarning", "backend/dist/server.js"]`.
- [ ] T016 [P] [US1] Create `vercel.json` with `{"framework": "container", "regions": ["sin1"], "git": {"deploymentEnabled": false}}` (research R5). Keep it to exactly these keys.
- [ ] T017 [P] [US1] Update `.env.example`:
  - Add commented `HOST` and `PORT` lines with their defaults.
  - Replace the two live Turso lines with a comment block, so a fresh copy stays in local mode (owner decision, research R2):
    - `# Hosted database (Turso). Leave commented out to use the local backend/weather.db.`
    - `# TURSO_DATABASE_URL=libsql://XXXXXX`
    - `# TURSO_AUTH_TOKEN=XXXX`
  - Add `# DATABASE_REQUIRE_REMOTE=true  (set in the container image; makes local mode an error)`.
- [ ] T018 [US1] Local image check (quickstart §4). **(owner)** starts Docker Desktop. Then:
  - `docker build -t lepak-weather .`, and record the image size.
  - `docker run --rm -p 3000:3000 lepak-weather` must exit with the "hosted database is required" error.
  - With `turso dev` serving a throwaway copy, run with `-e TURSO_DATABASE_URL=http://host.docker.internal:8080 -e TURSO_AUTH_TOKEN=dev`. `/health` must return 200, the dashboard must show 10 locations, and `docker stop` must log `shutting down` within 25 s.
  - Tear down every container and `turso dev`, whether it passes or fails.
- [ ] T019 [US1] **(owner)** One-time Vercel setup (quickstart §3, steps 1–3):
  - `npx vercel@<latest from npm view vercel version> link` to project `lepak-weather` on team SNAIC-Nexus.
  - Set the Production env vars `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (from `turso db tokens create lepak-weather-prod`), `WEATHER_API_KEY` and `PORT=3000` in the Vercel dashboard.
  - Create a Vercel token.
  - The implementer records the pinned CLI version for T024.
- [ ] T020 [US1] **(owner)** First manual deploy from the laptop on this branch: `npx vercel@<pinned> deploy --prod`. Confirm that Vercel builds the Container preset remotely (research R6, the unconfirmed point). If it doesn't, stop and apply the plan's fallback (Risks table).
- [ ] T021 [US1] Smoke check the live URL (quickstart §5, steps 2–4):
  - `GET /health` returns 200.
  - The dashboard loads on a laptop and on a phone over HTTPS, with 10 seeded locations.
  - Adding and refreshing a location works.
  - The region shows `sin1` (if not, the owner sets it in Project Settings).
  - Measure the cold start after more than 5 minutes idle and note the number for T030.

**Checkpoint**: Lepak Weather is live and usable (MVP).

---

## Phase 4: User Story 2 - Saved locations are still there later (Priority: P1)

**Goal**: data survives idle periods and redeploys, local data never reaches the hosted store, and bad config fails loudly.

**Independent Test**: save a location, wait 1 hour idle, redeploy, and confirm it's still there (quickstart §6).

- [ ] T022 [US2] Local-mode guard checks (quickstart §1, step 4). Run `npm start` three times: with only `TURSO_DATABASE_URL`, with only `TURSO_AUTH_TOKEN`, and with `DATABASE_REQUIRE_REMOTE=true` and no Turso values. Each must exit non-zero with a log naming the variables, and with no values in the output. Then run `npm run dev` with no `TURSO_*` values: the log must show `kind: "local"` and your local locations (FR-005, spec US2 scenario 4).
- [ ] T023 [US2] Persistence drill on the live app (quickstart §6), owner-assisted:
  - Save a test location.
  - After at least 1 hour idle, it's still present.
  - After a redeploy (`npx vercel@<pinned> deploy --prod`, or a no-op merge once US3 exists), it's still present.
  - Delete the test location afterwards. Record the results for SC-003.

**Checkpoint**: data survives, and a misconfiguration can't silently lose data.

---

## Phase 5: User Story 3 - Only checked changes go live (Priority: P2)

**Goal**: a merge to `main` deploys automatically, only after `npm run verify` passes, and failing PRs can't merge.

**Independent Test**: merge a harmless visible change and see it go live. Open a PR with a failing test and see it blocked, with production unchanged (quickstart §7).

- [ ] T024 [US3] Create `.github/workflows/ci.yml` (research R6, contracts §5):
  - Trigger `on: push` and `pull_request` for branch `main`. `permissions: contents: read`.
  - Job **`verify`** (this exact name is the required check) on `ubuntu-latest`: `actions/checkout`, `actions/setup-node` with `node-version: 24` and `cache: npm`, then `npm ci`, then `npm run verify`.
  - Job **`deploy`**:
    - `needs: verify`, with `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`.
    - `concurrency: { group: production, cancel-in-progress: false }`.
    - Env `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` and `VERCEL_TOKEN` from `secrets`.
    - Steps: checkout, setup-node 24, then `npx --yes vercel@<pinned> deploy --prod --yes --token "$VERCEL_TOKEN"`, and print the deployment URL.
    - Then a smoke step: `curl -fsS <url>/health`.
  - Pin action versions to full major tags. Never echo secrets.
- [ ] T025 [US3] **(owner)** Add the GitHub repository secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` (values from `.vercel/project.json` and T019) on `chuan77/AIxTech-SG-Weather`. Always pass `--repo chuan77/AIxTech-SG-Weather` to `gh`, because its default repo here is `AISG-AIAP/weather_starter`.
- [ ] T026 [US3] **(owner)** Add a branch ruleset on `main` in `chuan77/AIxTech-SG-Weather`: require status check `verify`, require a pull request, and block force-pushes (quickstart §3, step 5).
- [ ] T027 [US3] Pipeline proof (quickstart §5, step 1 and §7):
  - Open a PR from this branch to `main`. `verify` runs and passes, and `deploy` doesn't run on a PR.
  - Merge. `deploy` runs, the live URL serves the new version, and `/health` returns 200.
  - Open a throwaway PR with a deliberately failing test. `verify` fails, merging is blocked, and production is unchanged.
  - Close the throwaway PR and delete its branch.

**Checkpoint**: CI/CD is live, and the gate can't be bypassed.

---

## Phase 6: User Story 4 - Owner can repeat and explain the setup (Priority: P3)

**Goal**: a short guide covers the commit-to-live flow, settings, manual deploy and rollback.

**Independent Test**: following only `docs/deployment.md`, the owner names every setting and its location, does a manual deploy, and rolls back (quickstart §8).

- [ ] T028 [P] [US4] Write `docs/deployment.md` (FR-015):
  - The commit-to-live diagram (data-model.md, Deployment).
  - The settings and secrets table (research R8), with names only.
  - One-time setup (quickstart §3).
  - Manual deploy (`npx vercel@<pinned> deploy --prod`).
  - Rollback: (a) Instant Rollback (Hobby: previous deployment only), then `vercel promote <deployment>` to restore production auto-assignment; (b) `git revert` on `main` through the pipeline, which is preferred (research R7).
  - Known limits: beta runtime, cold start (filled in by T030), shared list, per-instance rate pacing and cache.
  - Troubleshooting for the "hosted database is required" and partial-config errors.
- [ ] T029 [US4] Rollback drill on the live app, following only `docs/deployment.md`, owner-assisted (quickstart §8). Fix any step in the guide that didn't work.

**Checkpoint**: the setup is documented and repeatable.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T030 [P] Record the measured cold-start time and image size from T018 and T021 in `docs/deployment.md` → Known limits.
- [ ] T031 [P] Amend `.specify/memory/constitution.md` 1.3.0 → 1.4.0 (MINOR; research R10):
  - Technical Constraints storage bullet: "Drizzle's `sqlite-proxy` over Node's built-in `node:sqlite` for local development and tests, or over a hosted libSQL (Turso) database when `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set; `DATABASE_PATH` applies only to local mode."
  - Refresh the Sync Impact Report comment.
  - Set Last Amended to the commit date.
- [ ] T032 [P] Update the Storage paragraph in `docs/architecture.md` to cover:
  - the adapter (local `node:sqlite` vs Turso `@libsql/client/web`) and `resolveDatabaseConfig`
  - `DATABASE_REQUIRE_REMOTE`
  - the `database ready` log
  - `HOST` and graceful shutdown
  - a one-line pointer to `docs/deployment.md`
- [ ] T033 [P] Mirror T032 in `docs/src/content/docs/backend/storage.md`. Add `HOST`, `PORT`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` and `DATABASE_REQUIRE_REMOTE` to `docs/src/content/docs/configuration.md`.
- [ ] T034 [P] Add one line to `CLAUDE.md` → "Read before working on" pointing to `docs/deployment.md` (hosting, CI/CD and secrets).
- [ ] T035 Run `npm run verify`. It must be green. Then run the `weather-code-review` skill on the branch diff (focus: secrets in logs and files, the env handling and the Dockerfile). Fix confirmed findings and re-run `npm run verify`.

---

## Dependencies & Execution Order

- **Setup (T001–T003)**: T001 first; T002 and T003 after it.
- **Foundational (T004–T011)**: T004 ∥ T005 → T006, T007 → T008 → T009 → T010 → T011. **Blocks every story.** T010 must pass before anything touches `lepak-weather-prod`.
- **US1 (T012–T021)**: T012 → T013. T014, T015, T016 and T017 in parallel. T018 needs T013–T015. T019 is owner setup. T020 needs T016, T018 and T019. T021 needs T020.
- **US2 (T022–T023)**: T022 can run right after Foundational. T023 needs US1 live.
- **US3 (T024–T027)**: T024 can be written any time after Setup. T025 and T026 need T019. T027 needs T024–T026 and US1.
- **US4 (T028–T029)**: T028 is best after T020 and T024, so the commands are real. T029 needs T028 and US3.
- **Polish (T030–T035)**: T030 needs T021. T031–T034 in parallel. T035 last.

### Story order

Foundational → **US1 (MVP)** → US2 ∥ US3 → US4 → Polish. US2's idle-hour wait can overlap with US3 work.

## Parallel Examples

```text
# Foundational tests together:
T004 backend/src/dbConfig.test.ts   ∥   T005 backend/src/dbAdapter.test.ts

# US1 platform files together (after T012/T013 or alongside):
T014 .dockerignore   ∥   T015 Dockerfile   ∥   T016 vercel.json   ∥   T017 .env.example

# Polish docs together:
T031 constitution   ∥   T032 docs/architecture.md   ∥   T033 docs site   ∥   T034 CLAUDE.md
```

## Implementation Strategy

- **MVP**: Setup, then Foundational, then US1 (T001–T021). The app is live at the public URL, with data in Turso, deployed by hand. Stop and check with the owner here.
- **Increment 2**: US2 proves the data survives (the idle hour runs in the background) while US3 builds the pipeline. From then on, every change goes through CI.
- **Increment 3**: US4 adds the guide and the rollback drill. Polish adds the constitution amendment, docs and the final verify and review.
- **Commits**: small, with conventional prefixes. Pre-commit runs `npm run lint` and `npm test`; never use `--no-verify`. The constitution amendment (T031) must land in the same PR as T008.
