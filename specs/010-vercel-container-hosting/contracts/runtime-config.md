# Contract: Runtime configuration and deployment interfaces

This feature exposes no new HTTP API. The existing endpoints (`/health`, `/api/*` and the SPA) are unchanged. The contract here is the **configuration surface** the hosted app and the pipeline depend on.

## 1. Environment variables read by the server

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `HOST` | no | `127.0.0.1` | Listen address. The image sets `0.0.0.0` |
| `PORT` | no | `3000` | Listen port. The image and Vercel Production env set `3000` |
| `NODE_ENV` | no | — | `production` serves `frontend/dist` (existing behaviour) |
| `DATABASE_PATH` | no | `backend/weather.db` | Local mode only |
| `TURSO_DATABASE_URL` | with token | — | `libsql://…`. Turns on turso mode |
| `TURSO_AUTH_TOKEN` | with URL | — | Secret. Never logged |
| `DATABASE_REQUIRE_REMOTE` | no | unset | `true` means local mode is an error. Set in the image |
| `WEATHER_API_KEY` | no | — | Existing. Secret |

**Start-up outcomes**:
- **Valid config:** logs `database ready` with `{ kind, migrationsApplied }` (never the URL or token), then listens.
- **Invalid config:** logs `could not open or migrate the database` with the variable **names** at fault, and exits non-zero.

## 2. `/health` (existing, unchanged)

`GET /health` returns `200 {"status":"healthy"}`. The quickstart and the post-deploy smoke check use it.

## 3. Files in the repository

| File | Contract |
|---|---|
| `Dockerfile` | Builds a runnable image from a clean checkout with no secrets. Exposes the server on `$PORT` |
| `.dockerignore` | Keeps `.env*`, `*.db*`, `node_modules`, `docs`, `specs`, `.specify`, `.claude`, `.git` and sample dumps out of the build context |
| `vercel.json` | `framework: container`, `regions: ["sin1"]`, `git.deploymentEnabled: false` |
| `.github/workflows/ci.yml` | Job `verify` runs on push and PR to `main`. Job `deploy` needs `verify`, runs only on push to `main`, one at a time in order |
| `.env.example` | Lists every variable above with comments. No real values: Turso lines use the placeholders `libsql://XXXXXX` and `XXXX`, commented out so a fresh copy stays in local mode |
| `docs/deployment.md` | Guide (FR-015): commit-to-live flow, settings table, manual deploy, rollback |

## 4. Secrets locations

- **GitHub repository secrets**: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- **Vercel Production environment**: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `WEATHER_API_KEY`, `PORT`.

None of these may appear in a committed file, a log line, or a CI log (the CLI token is passed only through an env var).

## 5. Required status check

The GitHub ruleset on `main` requires the `verify` check (the job name in `ci.yml`). Renaming that job breaks the merge gate, so the job name is part of this contract.
