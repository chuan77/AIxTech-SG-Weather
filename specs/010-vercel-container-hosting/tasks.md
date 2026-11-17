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

- [x] T001 Merge 008 and 009 into `main` and push `main` to `origin` (`chuan77/AIxTech-SG-Weather`); `git rev-list --count origin/main..main` must print 0. Then create branch `010-vercel-container-hosting` from `main`. Done 2026-11-16: `main` = `origin/main` = `bf427df`, which already contains the spec 010 documents.
- [x] T002 Add `@libsql/client` as a runtime dependency in the root `package.json` (where `drizzle-orm` lives) with `npm install @libsql/client`, and commit the updated `package-lock.json`. Check the installed version with Context7 before using its API (CLAUDE.md, Library docs).
- [x] T003 [P] Add `.vercel/` to `.gitignore`, under a new `# Vercel CLI link` comment.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the storage seam (research R1 and R2). The hosted app can't run without it, and it must leave local behaviour identical.

**⚠️ CRITICAL**: no user-story work starts until T011 passes.

- [x] T004 [P] Write failing tests in `backend/src/dbConfig.test.ts` for `resolveDatabaseConfig(env, cwd)`. Cover these validation rules, verbatim from data-model.md:
  - "Both `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` non-empty" gives `{ kind: 'turso', url, authToken }`.
  - "Both empty or absent" gives `{ kind: 'local', path }`, where path is `DATABASE_PATH` or `<cwd>/backend/weather.db`.
  - "Exactly one present" gives `ConfigError("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set together")`.
  - "`DATABASE_REQUIRE_REMOTE=true` and the result would be `local`" gives `ConfigError("a hosted database is required here")`.
  - A URL scheme other than `libsql:`, `https:` or `http:` gives `ConfigError`.
  - "`NODE_ENV=test` and the result would be `turso`" gives `ConfigError("tests must not use a hosted database")` (analysis C1).
  - Whitespace-only values count as empty.
  - No error message contains the URL or token value. Assert this with a sentinel token string.
- [x] T005 [P] Write failing tests in `backend/src/dbAdapter.test.ts` for the pure `libsqlRowsToValues(resultSet, method)` mapping, using a fake libSQL `ResultSet` (`columns`, `rows` as array-like `Row` objects with both index and named keys). Cover:
  - `all` and `values` return value arrays in column order, mapped by index, never `Object.values`.
  - `get` returns the first row's values, or `undefined` rows when there is no row.
  - `run` returns `[]`.
  - Must not touch the network.
- [x] T006 Implement `backend/src/dbConfig.ts`: export `ConfigError` and `resolveDatabaseConfig(env: NodeJS.ProcessEnv, cwd: string)` to pass T004 (research R2).
- [x] T007 Implement `backend/src/dbAdapter.ts`:
  - The `DatabaseAdapter` interface: `query(sql, params, method)` gives `{ rows }`, `batch(statements: string[])`, `execute(sql)`, `close()`.
  - `createLocalAdapter(path)`, wrapping the existing `node:sqlite` `DatabaseSync` logic moved from `db.ts`. It does `mkdirSync` of the parent folder and sets `PRAGMA journal_mode = WAL`. `batch` runs the statements in order, as today.
  - `createTursoAdapter(url, authToken)` using `createClient` from `@libsql/client/web`. `query` uses `client.execute({ sql, args })` plus `libsqlRowsToValues`. `batch` uses `client.batch(statements, 'write')`.
  - Export `libsqlRowsToValues` so it passes T005.
- [x] T007a Amend `.specify/memory/constitution.md` 1.3.0 → 1.4.0 (MINOR; research R10; analysis D1). Commit it **in the same commit as T008**.
  - Technical Constraints storage bullet: "Drizzle's `sqlite-proxy` over Node's built-in `node:sqlite` for local development and tests, or over a hosted libSQL (Turso) database when `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set; tests and browser checks never use the hosted database; `DATABASE_PATH` applies only to local mode."
  - Refresh the Sync Impact Report comment.
  - Set Last Amended to the commit date.
- [x] T008 Refactor `backend/src/db.ts` onto the adapter:
  - Resolve config with `resolveDatabaseConfig(process.env, process.cwd())`.
  - Build the matching adapter, and pass `adapter.query` to `drizzle()` from `drizzle-orm/sqlite-proxy`.
  - Run `migrate()` from `drizzle-orm/sqlite-proxy/migrator`, with the callback calling `adapter.batch(trimmedNonEmptyQueries)` and `migrationsFolder: join(process.cwd(), 'backend', 'drizzle')`.
  - Count the migrations applied (analysis U1):
    - Before `migrate()`, read `SELECT count(*) FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'`.
    - If that's 0, `before = 0`; otherwise `before = SELECT count(*) FROM __drizzle_migrations`.
    - After `migrate()`, read the count again: `migrationsApplied = after - before`.
  - Log `database ready` with `{ kind, migrationsApplied }`, never the URL or token.
  - On failure, keep the existing `could not open or migrate the database` error log with `kind` plus the config error message (variable names only), and rethrow.
  - `resetStore()` uses `adapter.execute("DELETE FROM sqlite_sequence WHERE name = 'locations'")`, and `closeDatabase()` calls `adapter.close()`.
  - The exported functions and their behaviour stay unchanged.
- [x] T008a Add `TURSO_DATABASE_URL: ''` and `TURSO_AUTH_TOKEN: ''` to `test.env` in `vitest.config.ts`, with the comment `// Never let tests reach a hosted database, even if .env holds real Turso values.` (analysis C1). dotenv doesn't override variables that already exist, so this wins over `.env`.
  - Prove it: with dummy `TURSO_DATABASE_URL=libsql://dummy.invalid` and `TURSO_AUTH_TOKEN=dummy` in the local `.env`, `npx vitest run backend/src/routes/locations.test.ts` passes and the database is local.
  - Restore `.env` afterwards, whether it passes or fails.
- [x] T008b [P] Update `scripts/e2e/lib.sh` so the temporary server always starts with `TURSO_DATABASE_URL= TURSO_AUTH_TOKEN= DATABASE_REQUIRE_REMOTE=` before `node --import tsx backend/src/server.ts` (analysis C2).
  - Add one sentence to `docs/testing.md`: the e2e server always ignores `TURSO_*`.
  - Check: with the dummy values from T008a in `.env`, `scripts/e2e/uv-trend.sh us1` passes and `e2e-artifacts/*/server.log` shows `kind: "local"`. Restore `.env` afterwards.
- [x] T009 Run `npx vitest run backend/src/dbConfig.test.ts backend/src/dbAdapter.test.ts backend/src/routes/locations.test.ts` and confirm the existing route tests pass unchanged in local mode. Also start the server once with a fresh temporary `DATABASE_PATH`, confirm `migrationsApplied: 4`, then delete the file.
- [x] T010 Offline migration-history proof (quickstart §2). **Done 2026-11-16 without the Turso CLI**: the migrator is identical for both stores, so it was run against a copy of `~/Downloads/lepak-weather-prod.db` through the local adapter. Result: `migrationsApplied: 0`, 10 locations, copy deleted. The libSQL HTTP row mapping is covered by `dbAdapter.test.ts`; the live Turso path is checked at T021. Original plan: **(owner)** installs the Turso CLI (`brew install tursodatabase/tap/turso`). Then copy `~/Downloads/lepak-weather-prod.db` to a throwaway path, start `turso dev --db-file <copy>`, and run `npm run build` followed by `TURSO_DATABASE_URL=http://127.0.0.1:8080 TURSO_AUTH_TOKEN=dev NODE_ENV=production node --disable-warning=ExperimentalWarning backend/dist/server.js`. Expect the log `kind: "turso"`, `migrationsApplied: 0`, and 10 rows from `GET /api/locations`.
  - If migrations apply or start-up fails, stop and report. The owner's accepted fallback is to recreate `lepak-weather-prod` empty.
  - Tear down `turso dev` and the server, and delete the copy, whether it passes or fails.
- [x] T011 Run `npm run verify` (lint → typecheck → tests → build). It must be green.

**Checkpoint**: storage works locally and against a Turso-compatible copy. User stories can begin.

---

## Phase 3: User Story 1 - Open Lepak Weather from a public link (Priority: P1) 🎯 MVP

**Goal**: the app runs as one container on Vercel in `sin1` and loads over HTTPS on laptop and phone.

**Independent Test**: deploy once by hand with the Vercel CLI, open the public URL on a laptop and on a phone, and use each main feature (quickstart §5, steps 2–4).

### Tests for User Story 1

- [x] T012 [P] [US1] Write failing tests in `backend/src/listenConfig.test.ts` for the pure `resolveListenConfig(env)`:
  - The default is `{ host: '127.0.0.1', port: 3000 }`.
  - `HOST=0.0.0.0` and `PORT=8080` are respected.
  - A non-numeric or out-of-range `PORT` throws an error naming `PORT`.

### Implementation for User Story 1

- [x] T013 [US1] Implement `backend/src/listenConfig.ts` (`resolveListenConfig`) to pass T012. Then update the start-up block in `backend/src/server.ts`:
  - Listen on `host` and `port` from `resolveListenConfig(process.env)`, logging the URL as today.
  - On `SIGTERM` and `SIGINT`: log `shutting down`, call `server.close()`, then `closeDatabase()` from `./db.js`, then `process.exit(0)`.
  - Add a 25 s safety timer that forces `process.exit(1)`, called `unref()` (research R3).
- [x] T014 [P] [US1] Create `.dockerignore` excluding `node_modules`, `**/node_modules`, `.env`, `.env.*` (keep `!.env.example`), `*.db`, `*.db-shm`, `*.db-wal`, `backend/*.db*`, `docs`, `specs`, `.specify`, `.claude`, `.git`, `.github`, `e2e-artifacts`, `RealtimeWeatherReadingsacrossSingapore`, `.vercel`, `frontend/dist` and `backend/dist` (contracts §3).
- [x] T014a [P] [US1] Create `.vercelignore` so `vercel deploy` never uploads secrets or data (analysis S1). Entries: `.env`, `.env.*`, `!.env.example`, `*.db`, `*.db-shm`, `*.db-wal`, `RealtimeWeatherReadingsacrossSingapore`, `e2e-artifacts`, `specs`, `.specify`, `.claude`, `docs`, `node_modules`, `frontend/dist`, `backend/dist`.
- [x] T015 [P] [US1] Create the `Dockerfile` (research R4):
  - **Stage `build`** on `node:24-alpine`, `WORKDIR /app`:
    - Copy `package.json`, `package-lock.json`, `frontend/package.json` and `backend/package.json`.
    - Run `npm ci --workspace frontend --workspace backend --include-workspace-root --ignore-scripts`.
    - Copy the sources, then run `npm run build`.
  - **Stage `runtime`** on `node:24-alpine`, `WORKDIR /app`:
    - Set `ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATABASE_REQUIRE_REMOTE=true`.
    - Copy the same package files and run `npm ci --omit=dev --workspace frontend --workspace backend --include-workspace-root --ignore-scripts`.
    - Copy `backend/dist`, `backend/drizzle` and `frontend/dist` from `build`.
    - `USER node`, `EXPOSE 3000`, `CMD ["node", "--disable-warning=ExperimentalWarning", "backend/dist/server.js"]`.
- [x] T016 [P] [US1] Create `vercel.json` with `{"framework": "container", "regions": ["sin1"], "git": {"deploymentEnabled": false}}` (research R5). Keep it to exactly these keys.
- [x] T017 [P] [US1] Update `.env.example`:
  - Add commented `HOST` and `PORT` lines with their defaults.
  - Replace the two live Turso lines with a comment block, so a fresh copy stays in local mode (owner decision, research R2):
    - `# Hosted database (Turso). Leave commented out to use the local backend/weather.db.`
    - `# TURSO_DATABASE_URL=libsql://XXXXXX`
    - `# TURSO_AUTH_TOKEN=XXXX`
  - Add `# DATABASE_REQUIRE_REMOTE=true  (set in the container image; makes local mode an error)`.
- [x] T018 [US1] Local image check (quickstart §4). **(owner)** starts Docker Desktop. Then:
  - `docker build -t lepak-weather .`, and record the image size.
  - `docker run --rm -p 3000:3000 lepak-weather` must exit with the "hosted database is required" error.
  - With `turso dev` serving a throwaway copy, run with `-e TURSO_DATABASE_URL=http://host.docker.internal:8080 -e TURSO_AUTH_TOKEN=dev`. `/health` must return 200, the dashboard must show 10 locations, and `docker stop` must log `shutting down` within 25 s.
  - Tear down every container and `turso dev`, whether it passes or fails.
  - Result (2026-11-17, OrbStack): built in 42 s, image 429 MB uncompressed; without Turso it exits 1 with "a hosted database is required here"; against a throwaway libSQL server (the `ghcr.io/tursodatabase/libsql-server` image in place of `turso dev`, seeded with a copy of the uploaded database) `/health` 200, 10 locations, `migrationsApplied: 0`; `docker stop` logs `shutting down` and exits 0 in under 1 s. `vite` (12 MB) is in the image only because the docs workspace's Astro hoists it; nothing at runtime uses it.
- [x] T019 [US1] **(owner)** One-time Vercel setup (quickstart §3, steps 1–3):
  - `npx vercel@<latest from npm view vercel version> link` to project `lepak-weather` on team SNAIC-Nexus.
  - Set the Production env vars `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (from `turso db tokens create lepak-weather-prod`), `WEATHER_API_KEY` and `PORT=3000` in the Vercel dashboard.
  - Create a Vercel token.
  - The implementer records the pinned CLI version for T024.
- [x] T020 [US1] **(owner)** First, deploy a **preview** (`npx vercel@<pinned> deploy`) and check the deployment's Source tab: none of `.env`, `*.db*` or `RealtimeWeatherReadingsacrossSingapore/` may appear. Only then do the first manual production deploy from the laptop on this branch: `npx vercel@<pinned> deploy --prod`. Confirm that Vercel builds the Container preset remotely (research R6, the unconfirmed point). If it doesn't, stop and apply the plan's fallback (Risks table).
- [x] T021 [US1] Smoke check the live URL (quickstart §5, steps 2–4):
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

- [X] T022 [US2] Local-mode guard checks (quickstart §1, step 4). Run `npm start` three times: with only `TURSO_DATABASE_URL`, with only `TURSO_AUTH_TOKEN`, and with `DATABASE_REQUIRE_REMOTE=true` and no Turso values. Each must exit non-zero with a log naming the variables, and with no values in the output. Then run `npm run dev` with no `TURSO_*` values: the log must show `kind: "local"` and your local locations (FR-005, spec US2 scenario 4).
  - Result (2026-11-17): `npm start` exited 1 in every case, with a `ConfigError` log naming only variables: URL only and token only gave "must be set together", the required-remote case gave "a hosted database is required here", and an `ftp://` URL and an unparseable URL got their own messages. Sentinel values never appeared in the output. Empty `TURSO_*` values override `.env`, because dotenv never replaces a variable that is already set. Local mode ran the dev server entry (`tsx backend/src/server.ts`) on a free port against a copy of `backend/weather.db`, not `npm run dev`, so it wouldn't clash with the dev server already on port 1355. It logged `kind: "local"`, `migrationsApplied: 0`, and served all 10 local locations. Node also prints the uncaught stack after the log line; that is harmless.
- [X] T023 [US2] Persistence drill on the live app (quickstart §6), owner-assisted:
  - Save a test location.
  - After at least 1 hour idle, it's still present.
  - After a redeploy (`npx vercel@<pinned> deploy --prod`, or a no-op merge once US3 exists), it's still present.
  - Delete the test location afterwards. Record the results for SC-003.
  - Idle result (2026-11-17): at 08:00 SGT the live list held 9 locations (ids 15, 14, 13, 10, 9, 8, 6, 5, 3), with id 15 the newest and several locations deleted by the owner beforehand. At 09:22 SGT, after 82 minutes with no checks from me, the list was identical: nothing lost, and no deleted location came back. I have no direct proof that the instance stopped, because only owner visits could have kept it awake.
  - Redeploy result: merging the docs-only PR #11 triggered CI run 43995445250, which passed verify and deployed a fresh production container. At 09:27 SGT the list still held the same 9 ids.
  - Cleanup: test location 15 was deleted through `DELETE /api/locations/15`, which returned 204. 8 locations remain. SC-003 met.

**Checkpoint**: data survives, and a misconfiguration can't silently lose data.

---

## Phase 5: User Story 3 - Only checked changes go live (Priority: P2)

**Goal**: a merge to `main` deploys automatically, only after `npm run verify` passes, and failing PRs can't merge.

**Independent Test**: merge a harmless visible change and see it go live. Open a PR with a failing test and see it blocked, with production unchanged (quickstart §7).

- [x] T024 [US3] Create `.github/workflows/ci.yml` (research R6, contracts §5):
  - Trigger `on: push` and `pull_request` for branch `main`. `permissions: contents: read`.
  - Job **`verify`** (this exact name is the required check) on `ubuntu-latest`: `actions/checkout`, `actions/setup-node` with `node-version: 24` and `cache: npm`, then `npm ci`, then `npm run verify`.
  - Job **`deploy`**:
    - `needs: verify`, with `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`.
    - `concurrency: { group: production, cancel-in-progress: false }`.
    - Env `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` and `VERCEL_TOKEN` from `secrets`.
    - Steps: checkout, setup-node 24, then `npx --yes vercel@<pinned> deploy --prod --yes --token "$VERCEL_TOKEN"`, and print the deployment URL.
    - Then a smoke step: `curl -fsS <url>/health`.
  - Pin action versions to full major tags. Never echo secrets.
- [x] T025 [US3] **(owner)** Add the GitHub repository secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` (values from `.vercel/project.json` and T019) on `chuan77/AIxTech-SG-Weather`, plus the Actions **variable** `PRODUCTION_URL` (the production domain, e.g. `https://lepak-weather.vercel.app`) used by the smoke check. Always pass `--repo chuan77/AIxTech-SG-Weather` to `gh`, because its default repo here is `AISG-AIAP/weather_starter`.
- [x] T026 [US3] **(owner)** Add a branch ruleset on `main` in `chuan77/AIxTech-SG-Weather`: require status check `verify`, require a pull request, and block force-pushes (quickstart §3, step 5).
- [x] T027 [US3] Pipeline proof (quickstart §5, step 1 and §7):
  - Open a PR from this branch to `main`. `verify` runs and passes, and `deploy` doesn't run on a PR.
  - Merge. `deploy` runs, the live URL serves the new version, and `/health` returns 200.
  - Open a throwaway PR with a deliberately failing test. `verify` fails, merging is blocked, and production is unchanged.
  - Close the throwaway PR and delete its branch.

**Checkpoint**: CI/CD is live, and the gate can't be bypassed.

---

## Phase 6: User Story 4 - Owner can repeat and explain the setup (Priority: P3)

**Goal**: a short guide covers the commit-to-live flow, settings, manual deploy and rollback.

**Independent Test**: following only `docs/deployment.md`, the owner names every setting and its location, does a manual deploy, and rolls back (quickstart §8).

- [x] T028 [P] [US4] Write `docs/deployment.md` (FR-015):
  - The commit-to-live diagram (data-model.md, Deployment).
  - The settings and secrets table (research R8), with names only.
  - One-time setup (quickstart §3).
  - Manual deploy (`npx vercel@<pinned> deploy --prod`).
  - Rollback: (a) Instant Rollback (Hobby: previous deployment only), then `vercel promote <deployment>` to restore production auto-assignment; (b) `git revert` on `main` through the pipeline, which is preferred (research R7).
  - Known limits: beta runtime, cold start (filled in by T030), shared list, per-instance rate pacing and cache.
  - Troubleshooting for the "hosted database is required" and partial-config errors.
- [X] T029 [US4] Rollback drill on the live app, following only `docs/deployment.md`, owner-assisted (quickstart §8). Fix any step in the guide that didn't work.
  - Result (2026-11-17, 10:04–10:05 SGT): `vercel rollback` moved production from `o2wf2tcxu` (PR #12) to `byimbukqd` (PR #11) in 3 s. Health returned 200 with 8 locations. `vercel promote` moved it back to `o2wf2tcxu` in 3 s, again with health 200 and 8 locations. Every step in the guide worked. The guide gained the CLI rollback commands, and the merge of this record confirmed that new production deploys are assigned to the domain automatically again after the promote.

**Checkpoint**: the setup is documented and repeatable.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T030 [P] Record the measured cold-start time and image size from T018 and T021 in `docs/deployment.md` → Known limits.
- [x] T031 Moved to T007a (analysis D1).
- [x] T032 [P] Update the Storage paragraph in `docs/architecture.md` to cover:
  - the adapter (local `node:sqlite` vs Turso `@libsql/client/web`) and `resolveDatabaseConfig`
  - `DATABASE_REQUIRE_REMOTE`
  - the `database ready` log
  - `HOST` and graceful shutdown
  - a one-line pointer to `docs/deployment.md`
- [x] T033 [P] Mirror T032 in `docs/src/content/docs/backend/storage.md`. Add `HOST`, `PORT`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` and `DATABASE_REQUIRE_REMOTE` to `docs/src/content/docs/configuration.md`.
- [x] T034 [P] Add one line to `CLAUDE.md` → "Read before working on" pointing to `docs/deployment.md` (hosting, CI/CD and secrets).
- [x] T035 Run `npm run verify`. It must be green. Then run the `weather-code-review` skill on the branch diff (focus: secrets in logs and files, the env handling and the Dockerfile). Fix confirmed findings and re-run `npm run verify`.
  - Result (2026-11-16). Fixed: container crash creating `backend/logs` as the `node` user (log file moved to `/tmp`); body-parser DoS advisory (`npm audit fix`); request logs carrying visitor IP/location and Vercel tokens (`backend/src/requestLogging.ts`, with a test).
  - Deferred: rate limiting `POST /api/locations/:id/refresh` and `/api/lightning/refresh` on the public URL (open question); size cap on `POST /api/logs` metadata; moving `vite` to dev dependencies. Accepted: `katex` advisory, which reaches only the docs site and is not in the image.

---

## Dependencies & Execution Order

- **Setup (T001–T003)**: T001 is done; T002 and T003 follow it.
- **Foundational (T004–T011)**: T004 ∥ T005 → T006, T007 → T007a → T008 (same commit as T007a) → T008a ∥ T008b → T009 → T010 → T011. **Blocks every story.** T008a and T008b must be done before anyone puts real Turso values in `.env`. T010 must pass before anything touches `lepak-weather-prod`.
- **US1 (T012–T021)**: T012 → T013. T014, T014a, T015, T016 and T017 in parallel. T018 needs T013–T015. T019 is owner setup. T020 needs T014a, T016, T018 and T019. T021 needs T020.
- **US2 (T022–T023)**: T022 can run right after Foundational. T023 needs US1 live.
- **US3 (T024–T027)**: T024 can be written any time after Setup. T025 and T026 need T019. T027 needs T024–T026 and US1.
- **US4 (T028–T029)**: T028 is best after T020 and T024, so the commands are real. T029 needs T028 and US3.
- **Polish (T030–T035)**: T030 needs T021. T032–T034 in parallel. T035 last.

### Story order

Foundational → **US1 (MVP)** → US2 ∥ US3 → US4 → Polish. US2's idle-hour wait can overlap with US3 work.

## Parallel Examples

```text
# Foundational tests together:
T004 backend/src/dbConfig.test.ts   ∥   T005 backend/src/dbAdapter.test.ts

# US1 platform files together (after T012/T013 or alongside):
T014 .dockerignore   ∥   T015 Dockerfile   ∥   T016 vercel.json   ∥   T017 .env.example

# Polish docs together:
T032 docs/architecture.md   ∥   T033 docs site   ∥   T034 CLAUDE.md
```

## Implementation Strategy

- **MVP**: Setup, then Foundational, then US1 (T001–T021). The app is live at the public URL, with data in Turso, deployed by hand. Stop and check with the owner here.
- **Increment 2**: US2 proves the data survives (the idle hour runs in the background) while US3 builds the pipeline. From then on, every change goes through CI.
- **Increment 3**: US4 adds the guide and the rollback drill. Polish adds the constitution amendment, docs and the final verify and review.
- **Commits**: small, with conventional prefixes. Pre-commit runs `npm run lint` and `npm test`; never use `--no-verify`. The constitution amendment (T007a) and T008 go in one commit.
