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
| `VITE_CARTO_API_KEY` | Vercel → Production env. Read at **runtime**: the server adds it to `index.html` as `<meta name="carto-api-key">` (`backend/src/indexHtml.ts`), because Vercel does not pass project variables into a container image build. A change needs only a redeploy or restart. It is public by design, so restrict it to `lepak-weather.vercel.app` at CARTO | Frontend map tiles |
| `PORT` = `3000` | Vercel → Production env (also set in the image) | Vercel routing |
| `WEB_ANALYTICS` = `on` | Vercel → **Production and Preview** env. Read at **runtime** by `backend/src/analyticsMode.ts`; the server adds `<meta name="web-analytics">` to `index.html`. `off` switches measurement and the privacy notice off; `notice-only` is for browser checks only. Unset falls back to on only when Vercel's `VERCEL=1` reaches the container. A change needs a redeploy or restart. Not a secret | Web Analytics (spec 012) |
| `SPEED_INSIGHTS` = `on` | Vercel → **Production and Preview** env. Read at **runtime** by `backend/src/analyticsMode.ts`, with the same rules as `WEB_ANALYTICS` but independent of it; the server adds `<meta name="speed-insights">` and a per-request `speed-insights-visit` label to `index.html`. `off` switches page-speed measurement off (the notice then names only what is still active); `notice-only` is for browser checks only. Unset falls back to on only when `VERCEL=1` reaches the container. A change needs a redeploy or restart. Not a secret | Speed Insights (spec 016) |
| `VERCEL_TOKEN` | GitHub → repo → Settings → Secrets and variables → Actions → Secrets | `deploy` job |
| `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | GitHub Actions secrets (`orgId` and `id` in `.vercel/repo.json` after `vercel link`) | `deploy` job |
| `PRODUCTION_URL` | GitHub Actions **variable**, for example `https://lepak-weather.vercel.app` | smoke check |

The image sets `HOST=0.0.0.0`, `PORT=3000`, `NODE_ENV=production`, `DATABASE_REQUIRE_REMOTE=true`, `LOG_FILE_PATH=/tmp/lepak-weather.log`, `TRUST_PROXY=1` and `RATE_LIMITS=on` itself.

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

6. Optional, recommended while the URL is public: a Vercel Firewall rate-limit rule, which applies before any instance. Vercel → lepak-weather → Firewall → Configure → New Rule: if **Request Path** starts with `/api/locations` **and** **Method** is `POST`, then **Rate Limit**, Fixed Window, **600 s**, **30** requests, key **IP Address**, and **Then: Too Many Requests (429)** (the default, Deny, returns 403). Use **Starts with**, not Equals, so refresh (`/api/locations/<id>/refresh`) is covered as well as adding. Press **Add Rule**, then publish it (`npx vercel@65.9.0 firewall diff` should show no pending changes). Or with the CLI:

   ```bash
   npx vercel@65.9.0 firewall rules add "Limit weather fetches" \
     --condition '{"type":"path","op":"pre","value":"/api/locations"}' \
     --condition '{"type":"method","op":"eq","value":"POST"}' \
     --action rate_limit --rate-limit-window 600 --rate-limit-requests 30 --rate-limit-keys ip --yes
   ```

   Live since 2026-11-17. Checked by sending 32 refreshes for a missing location (each returns 404, so data.gov.sg is never called). Requests 1–30 reached the app. Requests 31 and 32 got Vercel's own `429 Too Many Requests` (plain text, `x-vercel-mitigated: deny`) without reaching an instance. That response has no `detail`, so the app shows "Request failed" rather than its own limit message. The test blocks your own IP from adding or refreshing for 10 minutes. `npx vercel@65.9.0 firewall rules list` shows the rule.

## Manual deploy

From a clean checkout of the commit you want live:

```bash
npx vercel@65.9.0 deploy          # preview first: check its Source tab shows no .env or *.db files
npx vercel@65.9.0 deploy --prod   # production
```

`.vercelignore` keeps `.env*`, `*.db*`, the sample dumps and folders the build doesn't use out of the upload.

## Rollback

1. **Preferred: `git revert`.** Revert the bad commit in a PR to `main`. It goes through `verify` and deploys like any change.
2. **Fast: Instant Rollback.** In Vercel → Project → Deployments, use **Instant Rollback** on the current production deployment. Hobby can only roll back to the **immediately previous** deployment. The same works from the CLI: list the production deployments, then roll back to the second one in the list:

   ```bash
   npx vercel@65.9.0 ls --prod
   npx vercel@65.9.0 rollback <previous-deployment-url> --yes
   npx vercel@65.9.0 inspect lepak-weather.vercel.app   # shows which deployment the domain serves
   ```

   After a rollback, Vercel stops assigning new production deploys to the domain. Once the fix is merged and deployed, restore it with:

   ```bash
   npx vercel@65.9.0 promote <deployment-url-or-id> --yes
   ```

   Drill (2026-11-17): the rollback and the promote each took about 3 s, and the domain served the chosen deployment straight away. Health was 200 and the saved locations were unchanged at each step, because they live in Turso, not in the deployment.

   **Installed apps (spec 014).** The offline helper never caches the app's own files, so after a rollback an installed app gets the rolled-back version on its next online open, with nothing to clear. Rolling back to a build from before spec 014 leaves the helper installed on devices that already have it: the old build has no `/sw.js`, the update check gets HTML and fails, and the helper stays. That is harmless, because it passes every online request through and only shows the offline page with no connection. To remove it, use the switch-off steps below.

## Switching off the offline helper (spec 014)

Only if the offline helper itself has to go (for example a bug in `sw.js`):

1. `cp scripts/pwa/sw-kill.js frontend/public/sw.js`
2. Build and deploy with `VITE_OFFLINE_HELPER=off` set for the frontend build, so the page unregisters any helper instead of registering one.
3. Keep that `sw.js` live at `/sw.js` for at least 90 days, so devices that come back later pick it up. On its next online visit each device installs it at once, deletes the `lepak-offline-*` caches, unregisters it and reloads.

Never just delete `sw.js`: a missing file falls through to `index.html`, the browser's update check fails, and the old helper stays installed. `/sw.js` and `/manifest.webmanifest` are served with `Cache-Control: no-cache` (`backend/src/staticHeaders.ts`), so a new `sw.js` is seen on the next page load. Drilled locally on 2026-11-18 (`specs/014-installable-app/quickstart.md` §6).

## Per-visitor saved places (spec 013)

Each browser keeps a random key in `localStorage` (`weather-starter.visitor.key`) and sends it as the `X-Visitor-Key` header. The database stores only its SHA-256 (`visitors.key_hash`), and every saved place carries a `visitor_id`. Migration `0004` adds both. Places saved before spec 013 have `visitor_id` NULL and are shown to no one until the owner claims them.

**Retention.** Visitors unused for 90 days are deleted with their places. The sweep runs once at startup and then at most every 6 hours per instance, triggered by a locations request. It never deletes unclaimed (NULL) places, and it makes no data.gov.sg call. Successful removals log `visitor retention sweep` with counts only.

**One-off owner claim, after the first deploy of spec 013:**

1. Open the hosted app in your own browser. The list is empty.
2. In DevTools, run `copy(localStorage.getItem('weather-starter.visitor.key'))`. This copies the key without the quotes the console shows.
3. In a terminal at the repo root, export the production `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (`set -a; source .env; set +a`; don't commit or paste them anywhere), then run:
   ```bash
   KEY="$(pbpaste)"; echo ${#KEY}                         # must print 43
   npx tsx backend/src/claimLegacyCli.ts "$KEY" --remote
   unset TURSO_DATABASE_URL TURSO_AUTH_TOKEN KEY           # afterwards
   ```
   Expect `database: hosted (Turso)` then `claimed <n>, skipped <m> (already in list)`. Call the script with `npx tsx` and avoid `npm run claim-legacy -- <key>`. A key can start with `-` or `--` (base64url), and if the `--` separator is missing, npm takes such a key as its own option. The command then fails with `visitor key must be 43 base64url characters`.
4. Reload the app. Your old places are back with their snapshots, and a private window still shows an empty list. Running the command again prints `claimed 0`.

The command never loads `.env`. With Turso exported it refuses without `--remote`, and with `--remote` it refuses without Turso. So an accidental run can't reach production. It prints counts only, never the key, coordinates or the URL. Places whose coordinates you already saved are skipped and stay unclaimed.

**If places end up under the wrong key** (a lost or test key), release them in the Turso dashboard (Edit Data → SQL), then claim again. Check `select id, created_at from visitors;` first, and release only that visitor's rows: `update locations set visitor_id = null where visitor_id = <id>; delete from visitors where id = <id>;`. Done on 2026-11-18 after a smoke test claimed the 9 pre-spec-013 places under a throwaway key. The owner then claimed all 9.

## Web Analytics

Visitor counts come from Vercel Web Analytics on the Hobby plan (spec 012). Hosted deployments load Vercel's `/_vercel/insights/script.js`, which Vercel serves in front of the container (checked on a preview, 2026-11-17). Local runs, tests and the e2e checks never load it.

- **Where to look:** Vercel → lepak-weather → Analytics. Use the environment filter to separate Production from Preview. Figures: visitors, page views, referrers, countries and cities, device type, OS and browser. The app is one page, so every view is `/`.
- **Limits (Hobby):** 50,000 events a month, shared by every project on the account. When they run out, after a 3-day grace period, collection pauses until the next billing cycle, at no charge. The dashboard shows the last month only, and Hobby has no custom events or UTM breakdowns.
- **Not counted:** visitors whose ad or content blocker stops the script. The app keeps working for them, with no error.
- **Privacy:** no cookies. Vercel tells visitors apart with a request hash that resets daily. The reported URL has its query string and fragment removed (`frontend/src/analytics/stripUrl.ts`). Wherever measurement runs, the page shows "Anonymous visit counts · no cookies", which opens a short explanation (`frontend/src/components/PrivacyNotice.tsx`).
- **Switching it off:** set `WEB_ANALYTICS=off` in Vercel and redeploy. The script and the notice both go. Disabling Web Analytics only in the dashboard leaves the app requesting the script, which then fails on every page load, so change the variable first.
- **Startup log:** each production start logs `web analytics mode` with `webAnalytics` (`measure` or `off`) and `vercel` (whether `VERCEL=1` was present). An invalid `WEB_ANALYTICS` value logs a warning and turns measurement off.

## Speed Insights

Page-speed scores come from Vercel Speed Insights on the free Hobby tier (spec 016). Hosted deployments load Vercel's `/_vercel/speed-insights/script.js`, which Vercel serves in front of the container (checked on production, 2026-11-20). Local runs, tests and the e2e checks never load it.

- **Where to look:** Vercel → lepak-weather → Speed Insights. Pick Desktop or Mobile and the environment (Production or Preview). The free tier shows the Real Experience Score (RES), a weighted 0–100 score of real visitors' load and interaction speed at the 75th percentile, for the last 24 hours or 7 days.
- **Cold vs warm:** each page load is reported with the route `/cold` or `/warm`. It is `cold` when the instance serving the page started less than 10 seconds before the request (`backend/src/speedInsights.ts`), which means that visitor waited for the about-5 s cold start; otherwise `warm`. The free tier does show the score per route: open the **Routes** tab under the score (checked on a preview, 2026-11-20, when the first readings were a RES of 76 for `/cold` only). Either way the labels are sent, and the lab baseline below separates the frontend from the cold start.
- **What the free tier hides:** the separate metrics (FCP, LCP, INP, CLS, TTFB), most breakdowns, countries, and history beyond 7 days. Those need Speed Insights Plus, which is Pro-only ($10 per project a month plus usage) and out of scope.
- **Limits:** 10,000 events per rolling 30 days, shared by every project on the account. A visit sends 3–5 events. Above the allowance, collection pauses for at least 14 days, and stays paused while 30-day use is above half the allowance. No charge.
- **Not counted:** visitors whose ad or content blocker stops the script. The app keeps working for them, with no error.
- **Privacy:** no cookies, no visitor identifier. Vercel stores per reading the route, URL, browser, OS, device type, country, network speed, the metric and which page element it came from. The reported URL has its query string and fragment removed (`frontend/src/analytics/stripUrl.ts`). The privacy line names what is active: "Anonymous visits & speed · no cookies" when both run (`frontend/src/analytics/privacyCopy.ts`).
- **Switching it off:** set `SPEED_INSIGHTS=off` in Vercel and redeploy. The script goes, and the notice drops the speed wording. Disabling Speed Insights only in the dashboard leaves the app requesting the script, which then fails on every page load, so change the variable first.
- **Startup log:** each production start logs `speed insights mode` with `speedInsights` (`measure` or `off`) and `vercel`. An invalid `SPEED_INSIGHTS` value logs a warning and turns measurement off.

### Lab baseline

The field score mixes cold starts with the frontend. A lab reading on an awake instance gives the frontend alone, with each metric, for free:

1. Wake the instance: `curl -s -o /dev/null https://lepak-weather.vercel.app/`.
2. Within 4 minutes (the instance idles out after 5), run [PageSpeed Insights](https://pagespeed.web.dev/) on `https://lepak-weather.vercel.app/` 3 times for **Mobile** and 3 times for **Desktop**. Previews sit behind Vercel Authentication, which PageSpeed Insights can't pass, so use production.
3. Record the median of each value below, with the date. TBT is the lab stand-in for INP.

| Date | Profile | Score | FCP | LCP | TBT | CLS | Speed Index | TTFB |
|---|---|---|---|---|---|---|---|---|
| _to record after merge (spec 016 T033)_ | Mobile | | | | | | | |
| | Desktop | | | | | | | |

## Known limits

- The Container runtime is in beta on Vercel.
- Instances stop after 5 idle minutes, so the next visit waits for a cold start. Measured cold start: about 5 s for the first request after a deploy (preview, 2026-11-16), then 5–25 ms per request.
- Size: container 94.7 MB compressed on Vercel (429 MB uncompressed in a local build); whole deployment 238 MB of the 5 GiB limit (2026-11-16).
- Saved places are per visitor (spec 013): a list lives on one browser and is lost if that browser's data is cleared. Lists unused for 90 days are deleted. Every visitor's refreshes share one paced queue on the data.gov.sg key: about one full refresh every 10 s on a Development key. Before promoting the URL widely, request a Production key and set `WEATHER_API_RATE_LIMIT`.
- Rate pacing for data.gov.sg and the lightning cache are per instance. That's fine for fewer than 5 visitors.
- The URL is public, so the image turns on per-device limits (`RATE_LIMITS=on`, keyed on the visitor address from `TRUST_PROXY=1`): 30 weather fetches per 10 minutes and 60 `/api/logs` events per minute, plus a 2 KB cap on log metadata. Lightning needs no limit: its 2-minute cache already caps data.gov.sg calls. The limits are in memory per instance: they reset on a cold start, and a parallel burst makes Vercel start more instances (9 in a 64-request test), each with its own allowance. So they stop a simple loop, not a determined burst. For a limit across all instances, add the Vercel Firewall rate-limit rule below (Hobby allows one).
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
