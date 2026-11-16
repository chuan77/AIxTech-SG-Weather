# Research: Host Lepak Weather on Vercel Containers with Turso

**Feature**: [spec.md](./spec.md) | **Date**: 2026-11-16

These are the design decisions behind the plan. Platform facts come from vercel.com pages, which the owner approved fetching, and Drizzle docs via Context7 (drizzle-orm 0.45.x). The full evidence trail is in `.specify/assessments/vercel-container-hosting/research.md`.

## R1. How the app talks to Turso

- **Decision**: Keep Drizzle's **`sqlite-proxy`** driver and its **`sqlite-proxy/migrator`**, which `backend/src/db.ts` uses today. Put a small **driver adapter** under it:
  - With no Turso settings: the existing `node:sqlite` `DatabaseSync` (local file, unchanged).
  - With Turso settings: `@libsql/client/web`, a pure-JS HTTP client that talks to the `libsql://` URL.
  - The adapter provides one query callback (`run | all | get | values`), one batch callback for migrations, a raw `execute(sql)` and `close()`.
- **Rationale**:
  - **Migration history stays compatible.** The same `sqlite-proxy` migrator that wrote `__drizzle_migrations` in the seeded database reads it again, so it compares the same hash and `created_at` columns against `backend/drizzle/meta/_journal.json` and applies nothing new. This settles the decision's "will Drizzle accept the history" question by construction.
  - **Small surface.** Every query in `db.ts` already goes through the async proxy callback, so `routes/locations.ts` and the tests don't change.
  - **No native modules in the image.** `@libsql/client/web` is pure JS, while the default `@libsql/client` entry pulls a native `libsql` binary that is fiddly on Alpine/musl.
  - **Tests stay offline and on a local SQLite file** (Principles III, IV and VI).
- **Implementation notes**:
  - libSQL `ResultSet.rows` are array-like `Row` objects. Map them by column index (`rs.columns.map((_, i) => row[i])`), not with `Object.values`, which could include named keys.
  - `get` with no row must return `undefined` rows, as the current callback does.
  - Run migrations through `client.batch(statements, 'write')` so they apply atomically.
  - `PRAGMA journal_mode = WAL` is local-only and skipped for Turso.
  - `resetStore()` currently calls `sqlite.prepare(...)` directly. Route it through the adapter's `execute`.
- **Alternatives considered**:
  - Drizzle's native `drizzle-orm/libsql` driver for both modes, with `file:` locally. Rejected: it needs the native `libsql` package, changes the migrator (the libsql migrator, so history compatibility would have to be proven rather than guaranteed), and adds a second database engine to local development and tests.
  - Two Drizzle instances (`sqlite-proxy` locally, `libsql` in production). Rejected: type unions and two code paths for every query.
  - Postgres (Neon). Rejected in the assessment because it means rewriting the schema and migrations.

## R2. Choosing the store, and failing safely

- **Decision**: a pure function `resolveDatabaseConfig(env)` returns either `{ kind: 'local', path }` or `{ kind: 'turso', url, authToken }`, or throws a configuration error:
  - Both `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` set and non-empty: **turso**.
  - Neither set: **local** (`DATABASE_PATH` or `backend/weather.db`, as today).
  - Only one set: **error** (FR-006).
  - `DATABASE_REQUIRE_REMOTE=true` (set in the container image) and not turso: **error**. The hosted app can never silently fall back to the container's temporary disk.
  - The URL must use `libsql:`, `https:` or `http:` (`http:` only for a local `turso dev` server). Anything else is an error.
- Errors are logged with the variable **names** only, never their values (FR-006, FR-013).
- **Rationale**: one testable function covers every edge case in the spec. Running `npm start` locally with no Turso settings still works.
- **Alternatives**:
  - Detecting Vercel through its system environment variables. Rejected: not documented for containers.
  - Switching on `NODE_ENV=production`. Rejected: that would break local `npm start` and the e2e scripts.
- **`.env.example`** (owner decision, 2026-11-16): keep the format placeholders `libsql://XXXXXX` and `XXXX`, because they show what each value looks like and are not real credentials. Real values live only in the git-ignored `.env` and in Vercel and GitHub secrets. To keep a fresh copy from switching to a bogus Turso database, the two lines are **commented out** (`# TURSO_DATABASE_URL=libsql://XXXXXX`), and a note says to fill them in only to point at Turso. This still meets FR-013: no secret values are committed.

## R3. Listening address, port and shutdown

- **Decision**:
  - `server.ts` listens on `process.env.HOST ?? '127.0.0.1'` and `PORT ?? 3000`. Local behaviour is unchanged.
  - The image sets `HOST=0.0.0.0` and `PORT=3000`, and the Vercel project's Production environment also sets `PORT=3000`. Vercel routes to port 80 by default, which can be overridden "by setting the `PORT` environment variable in the project settings" (vercel.com/docs/functions/runtimes/container).
  - On `SIGTERM`, the server stops accepting connections, finishes in-flight requests, closes the database and exits within 25 s, inside Vercel's 30 s grace period.
- **Rationale**: Vercel says the server "must bind to 0.0.0.0" (KB, Node with Docker). Port 3000 avoids a non-root process binding to a privileged port.
- **Alternatives**: port 80 as root. Rejected because it's less safe, and a non-root user is the documented pattern.

## R4. Container image

- **Decision**: a two-stage `Dockerfile` on `node:24-alpine` (Node 24 LTS, which supports `node:sqlite`; local development is on Node 26).
  - **Build stage**: `npm ci` for the root plus the `frontend` and `backend` workspaces only (skip `docs`), then `npm run build`, which builds the frontend and runs `tsc` for the backend.
  - **Runtime stage**:
    - `npm ci --omit=dev --ignore-scripts` for the same workspaces. `--ignore-scripts` skips the `prepare: husky` hook.
    - Copy in `backend/dist`, `backend/drizzle`, `frontend/dist` and the package files.
    - Set `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=3000` and `DATABASE_REQUIRE_REMOTE=true`. Run as `USER node`.
    - `CMD ["node", "--disable-warning=ExperimentalWarning", "backend/dist/server.js"]`, with `WORKDIR /app` so the `process.cwd()`-relative paths still resolve.
  - A `.dockerignore` excludes `node_modules`, `.env*`, `*.db*`, `docs`, `specs`, `.specify`, `.claude`, `e2e-artifacts`, `RealtimeWeatherReadingsacrossSingapore` and `.git`.
- **Rationale**:
  - It's the smallest image that runs the existing build unchanged.
  - Running `server.js` directly, instead of through `scripts/start.mjs`, means the server process receives `SIGTERM` itself.
  - The ignore list keeps secrets, databases and sample dumps out of the build context.
- **Frontend build-time keys**: `VITE_CARTO_API_KEY` is optional and degrades gracefully (constitution, Technical Constraints). The first release ships without it. [Follow-up, not needed for this feature: pass it as a build argument if wanted.]

## R5. Vercel project configuration

- **Decision**: a `vercel.json` with:
  - `"framework": "container"`, which forces the preset even though Vercel detects Vite.
  - `"regions": ["sin1"]`.
  - `"git": { "deploymentEnabled": false }`.
- **Rationale**:
  - Vercel says that turning Git deployments off for the whole project is the pattern for deploys driven by GitHub Actions (KB "GitHub Actions with Vercel", vercel.com/docs/project-configuration/git-configuration). It also stops preview deploys, which have no database (out of scope).
  - `regions` is documented for "Vercel functions", and containers run as functions. Whether it applies to containers isn't stated, so check it after the first deploy (quickstart §5).
- **Alternatives**: `deploymentEnabled: { "main": false }`. Rejected: preview deploys from other branches would still build containers that have no database.

## R6. CI/CD pipeline

- **Decision**: one workflow, `.github/workflows/ci.yml`, with two jobs.
  - **`verify`** (on `push` and `pull_request` to `main`): Node 24, `npm ci`, `npm run verify`. This is the same gate as locally; the Python stages skip because there are no `.py` files.
  - **`deploy`** (`needs: verify`; only on `push` to `main`):
    - `concurrency: { group: production, cancel-in-progress: false }`, so deploys run one at a time in merge order.
    - Runs `npx vercel@<pinned> deploy --prod --yes --token "$VERCEL_TOKEN"`, with `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` taken from repository secrets.
    - No `--prebuilt`: Vercel builds the container image remotely ("During the build step, the image will be built and pushed to VCR").
- **Rationale**:
  - The gate can't be bypassed: deploy needs verify, and Git deploys are off (FR-009 to FR-011).
  - A failed check stops at `verify`, and GitHub shows which step failed.
  - In-order concurrency means a later passing merge ends up live.
- **To confirm in the first run**: that `vercel deploy --prod` without `--prebuilt` builds a Container project from CI. Vercel's docs imply it but don't say it directly.
- **Merge gate (FR-012)**: a GitHub branch ruleset on `main` requiring the `verify` check. The repo `chuan77/AIxTech-SG-Weather` is public, so this is available on GitHub Free. The owner sets it up once (quickstart §3), because it's an account-level setting.
- **Alternatives**: Vercel's own Git integration with "wait for checks". Rejected: not confirmed on Hobby, and it teaches less.

## R7. Rollback

- **Decision**: document two paths in the deployment guide.
  - **(a) Vercel Instant Rollback** in the dashboard. Hobby can roll back "to the immediately previous deployment". Vercel then "turns off auto-assignment of production domains", so the guide also covers undoing that with `vercel promote <deployment>`.
  - **(b) A `git revert` on `main`**, which goes back through the pipeline. This is the preferred path.
- **Source**: vercel.com/docs/instant-rollback (updated 2026-07-07).

## R8. Settings and secrets

| Setting | Stored in | Used by |
|---|---|---|
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Vercel → Production env | Container at runtime |
| `WEATHER_API_KEY` | Vercel → Production env | Container at runtime |
| `PORT=3000` | Vercel → Production env (also set in the image) | Vercel routing |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | GitHub → repository secrets | `deploy` job |

Nothing in this table is committed. `.vercel/` (written by `vercel link`) is added to `.gitignore`.

## R9. Rate limit and in-memory state

- **Decision**: no change. `ProviderRequester` pacing and the lightning cache stay per instance.
- **Rationale**: fewer than 5 visitors is well inside the Development tier (12 requests per 10 s). Sharing them across instances is out of scope (spec Assumptions).

## R10. Constitution impact

- **Technical Constraints** say "Drizzle over Node's built-in `node:sqlite`". A hosted libSQL backend in production widens that, so it needs a **MINOR amendment (1.3.0 → 1.4.0)**, made in the same change as the code:
  - Allow the `sqlite-proxy` path to target a hosted libSQL (Turso) database when `TURSO_*` is set.
  - Keep `node:sqlite` for local development and tests.
  - Note that `DATABASE_PATH` applies only in local mode.
- `docs/architecture.md`, and its Starlight copy if one exists, are updated per the Development Workflow rule.
