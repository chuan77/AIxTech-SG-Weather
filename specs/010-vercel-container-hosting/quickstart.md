# Quickstart: validate Lepak Weather hosting

**Feature**: [spec.md](./spec.md) · **Config contract**: [contracts/runtime-config.md](./contracts/runtime-config.md) · **Data**: [data-model.md](./data-model.md)

Run the sections in order. §1, §2 and §4 run on the laptop. §3 is the owner's one-time setup. §5 onwards runs against the live app.

## Prerequisites

- Node 24 or later. `gh` is installed.
- Docker Desktop running (the CLI is installed; start the daemon before §4).
- Turso CLI: `brew install tursodatabase/tap/turso`, then `turso auth login`.
- Vercel CLI, through `npx vercel@<pinned version>`; it doesn't need to be installed globally.
- `~/Downloads/lepak-weather-prod.db`, the WAL-mode copy that was uploaded to Turso.

## 1. Local behaviour is unchanged (regression)

1. Make sure `.env` has no `TURSO_*` values.
2. Run `npm run verify`. **Expected:** lint, type-check, tests and build all pass. The new unit tests for `resolveDatabaseConfig` and the libSQL row mapping are included.
3. Run `npm run dev` and open `http://weather-starter.localhost:1355`. **Expected:** your local saved locations, the start-up log `database ready` with `kind: "local"`, and a server listening on `127.0.0.1`.
4. Config failure cases. For each, start with `npm start` and expect a non-zero exit, plus a log that names the variables and shows no values:
   - Only `TURSO_DATABASE_URL` set.
   - Only `TURSO_AUTH_TOKEN` set.
   - `DATABASE_REQUIRE_REMOTE=true` with no Turso settings.

## 2. Migration history is accepted (offline, against a copy)

1. Make a copy: `cp ~/Downloads/lepak-weather-prod.db /tmp/lepak-check.db`.
2. Serve the copy locally: `turso dev --db-file /tmp/lepak-check.db`. It listens on `http://127.0.0.1:8080`.
3. In another terminal, run `TURSO_DATABASE_URL=http://127.0.0.1:8080 TURSO_AUTH_TOKEN=dev npm start`.
4. **Expected:**
   - The log shows `database ready` with `kind: "turso"` and `migrationsApplied: 0`.
   - `curl -s localhost:3000/api/locations | jq length` prints `10`.
5. If migrations are applied, or start-up fails on the migration history:
   - Stop. Don't point production at it.
   - Fallback, which the owner accepted: recreate `lepak-weather-prod` empty in Turso and let the app create the tables. This loses the 10 sample locations.

## 3. One-time owner setup (outward-facing, done by the owner)

1. **Link the project.** Run `npx vercel@<pinned> link` and pick project `lepak-weather` on the SNAIC-Nexus team. Note the org and project IDs in `.vercel/project.json`, which is git-ignored.
2. **Set Vercel Production environment variables** in the dashboard:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`, created with `turso db tokens create lepak-weather-prod`
   - `WEATHER_API_KEY`
   - `PORT=3000`
3. **Create a Vercel token** (Account → Tokens).
4. **Add GitHub repository secrets** on `chuan77/AIxTech-SG-Weather`: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Always pass `--repo chuan77/AIxTech-SG-Weather` to `gh`, because its default repo for this folder is a different one.
5. **Add a branch ruleset on `main`** requiring the status check `verify`, and blocking force-pushes.

## 4. The image runs locally (optional but recommended)

1. Run `docker build -t lepak-weather .`. **Expected:** the build succeeds and the image is a few hundred MB, without the `docs` workspace.
2. Run `docker run --rm -p 3000:3000 lepak-weather`. **Expected:** the container exits with the "hosted database is required" error. This is FR-006 working as intended.
3. With `turso dev` from §2 running, start it again with `-e TURSO_DATABASE_URL=http://host.docker.internal:8080 -e TURSO_AUTH_TOKEN=dev`.
   - **Expected:** `/health` returns 200 and the dashboard shows the 10 locations at `http://localhost:3000`.
   - `docker stop` shuts it down cleanly within 25 s, with a `SIGTERM` handled log.

## 5. First deploy

1. Merge the feature into `main`. **Expected:** in GitHub Actions, `verify` passes, then `deploy` runs and prints the production URL.
2. **Expected on the live app:**
   - `GET <url>/health` returns 200.
   - The dashboard loads on a laptop and on a phone over HTTPS, and shows the 10 seeded locations.
   - Adding and refreshing a location works.
3. **Region:** in Vercel → Deployment → Functions or Runtime logs, the region is `sin1`. If it isn't, record it and set the region in Project Settings.
4. **Cold start:** after more than 5 minutes idle, time the first full load. Record the number in `docs/deployment.md` (SC-006 has no target).

## 6. Data survives (SC-003)

1. Save a test location and note it.
2. Wait at least 1 hour with no visits, then reload. **Expected:** the location is still there.
3. Trigger a redeploy with a no-op commit to `main`, then reload. **Expected:** the location is still there.
4. Delete the test location.

## 7. The gate blocks bad changes (SC-004, SC-005)

1. Open a PR with a deliberately failing test. **Expected:** `verify` fails, the PR can't be merged, and no deploy job runs.
2. Close the PR without merging. **Expected:** the live app is unchanged.

## 8. Rollback drill (SC-008)

1. Follow `docs/deployment.md` → Rollback. Use Instant Rollback to the previous deployment, then `vercel promote` back to the latest. **Expected:** each step changes which version is live, and production auto-assignment is restored afterwards.

## 9. Clean-up

- Stop `turso dev` and any containers.
- Delete `/tmp/lepak-check.db`.
- Make sure no process from these checks still holds port 3000 or 8080.
