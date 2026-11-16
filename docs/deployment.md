# Deployment

Lepak Weather runs as one container on Vercel's **Container** preset (Hobby plan, region `sin1`, Singapore). Saved locations live in the hosted **Turso** database `lepak-weather-prod` (`aws-ap-southeast-1`). GitHub Actions deploys `main` after the full quality gate passes. Spec: `specs/010-vercel-container-hosting/`.

## From commit to live

```text
push / PR to main ─▶ verify (npm run verify: lint, typecheck, tests, build)
                       ├─ fail ─▶ stop. Live app unchanged; the failed step shows in GitHub Actions.
                       └─ pass, and it was a push to main
                              ─▶ deploy (one at a time, in merge order)
                              ─▶ Vercel builds the Dockerfile and runs it in sin1
                              ─▶ smoke check: GET $PRODUCTION_URL/health
```

- Workflow: `.github/workflows/ci.yml`. The job name `verify` is the required check in the `main` ruleset, so don't rename it.
- `vercel.json` turns off Vercel's own Git deploys (`git.deploymentEnabled: false`), so nothing reaches production without passing `verify`. There are no preview deployments from Git.
- The image (`Dockerfile`) contains only production dependencies, `backend/dist`, `backend/drizzle` and `frontend/dist`. It runs as the `node` user on `0.0.0.0:3000`.
- Request logs hold only method, URL, status and response time (`backend/src/requestLogging.ts`). Behind Vercel, request headers carry each visitor's IP, city and postcode plus Vercel tokens, so they are never logged.

## Settings and secrets

Names only. Values never go in the repo, in logs or in chat.

| Setting | Where it is stored | Used by |
|---|---|---|
| `TURSO_DATABASE_URL` | Vercel → Project → Settings → Environment Variables (Production) | Container at runtime |
| `TURSO_AUTH_TOKEN` | Vercel → Production env. Create it with `turso db tokens create lepak-weather-prod` | Container at runtime |
| `WEATHER_API_KEY` | Vercel → Production env | Container at runtime |
| `VITE_CARTO_API_KEY` | Vercel → Production env. Read at **build** time: the Dockerfile's `ARG` lets Vercel pass it into the Vite build, so a change needs a redeploy. It ends up in the public JS bundle, so restrict it to `lepak-weather.vercel.app` at CARTO | Frontend map tiles |
| `PORT` = `3000` | Vercel → Production env (also set in the image) | Vercel routing |
| `VERCEL_TOKEN` | GitHub → repo → Settings → Secrets and variables → Actions → Secrets | `deploy` job |
| `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | GitHub Actions secrets (`orgId` and `id` in `.vercel/repo.json` after `vercel link`) | `deploy` job |
| `PRODUCTION_URL` | GitHub Actions **variable**, for example `https://lepak-weather.vercel.app` | smoke check |

The image sets `HOST=0.0.0.0`, `PORT=3000`, `NODE_ENV=production` and `DATABASE_REQUIRE_REMOTE=true` itself.

## How the app chooses its database

`backend/src/dbConfig.ts`:

| Situation | Result |
|---|---|
| `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` both set | Turso |
| Neither set | Local file (`DATABASE_PATH` or `backend/weather.db`) |
| Only one set | Refuses to start: `TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set together` |
| `DATABASE_REQUIRE_REMOTE=true` (the image) without Turso | Refuses to start: `a hosted database is required here` |
| `NODE_ENV=test` with Turso | Refuses: `tests must not use a hosted database` |

vitest and the e2e scripts blank `TURSO_*`, so tests and browser checks never touch production, even if your `.env` points at Turso. Putting real Turso values in `.env` makes **`npm run dev` and `npm start` use the live database**. Do that only on purpose, and comment the lines out again afterwards.

## One-time setup

All of this is done by the owner.

1. `npx vercel@65.9.0 link`, then pick team **SNAIC-Nexus** and project **lepak-weather**. This writes the git-ignored `.vercel/` folder (`repo.json` with CLI 65.x, which links the Git repo; older CLIs write `project.json`).
2. In Vercel, set the Production environment variables from the table above.
3. In Vercel, create a token: Account → Settings → Tokens.
4. In GitHub, add the secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` and the variable `PRODUCTION_URL` on `chuan77/AIxTech-SG-Weather`. With `gh`, always pass `--repo chuan77/AIxTech-SG-Weather`, because this folder's default `gh` repo is a different one.
5. In GitHub, add a branch ruleset on `main` that requires a pull request, requires the status check `verify`, and blocks force pushes.

## Manual deploy

From a clean checkout of the commit you want live:

```bash
npx vercel@65.9.0 deploy          # preview first: check its Source tab shows no .env or *.db files
npx vercel@65.9.0 deploy --prod   # production
```

`.vercelignore` keeps `.env*`, `*.db*`, the sample dumps and folders the build doesn't use out of the upload.

## Rollback

1. **Preferred: `git revert`.** Revert the bad commit in a PR to `main`. It goes through `verify` and deploys like any change.
2. **Fast: Instant Rollback.** In Vercel → Project → Deployments, use **Instant Rollback** on the current production deployment. Hobby can only roll back to the **immediately previous** deployment. After a rollback, Vercel stops assigning new production deploys to the domain. Once the fix is merged and deployed, restore it with:

   ```bash
   npx vercel@65.9.0 promote <deployment-url-or-id>
   ```

## Known limits

- The Container runtime is in beta on Vercel.
- Instances stop after 5 idle minutes, so the next visit waits for a cold start. Measured cold start: about 5 s for the first request after a deploy (preview, 2026-11-16), then 5–25 ms per request.
- Size: container 94.7 MB; whole deployment 238 MB of the 5 GiB limit (2026-11-16).
- One saved-locations list is shared by every visitor until per-visitor storage ships.
- Rate pacing for data.gov.sg and the lightning cache are per instance. That's fine for fewer than 5 visitors.
- Region: `vercel.json` asks for `sin1`. Confirm it in the deployment's runtime logs, and set it in Project Settings if Vercel ignores the file for containers.

## Troubleshooting

| Log or symptom | Cause | Fix |
|---|---|---|
| `a hosted database is required here` | The container started without `TURSO_*` | Set both in the Vercel Production env and redeploy |
| `TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set together` | Only one is set (in Vercel or your `.env`) | Set both or neither |
| `TURSO_DATABASE_URL must start with libsql://, https:// or http://` | Wrong URL | Copy the `libsql://…turso.io` URL from Turso |
| `could not open or migrate the database` with an auth error | Token expired or for another database | Create a new token for `lepak-weather-prod` |
| Smoke check fails with 401 | `PRODUCTION_URL` is a deployment URL behind deployment protection | Use the production domain |
| Tests fail with `tests must not use a hosted database` | Something set `TURSO_*` for vitest | Check `vitest.config.ts` still blanks them |
