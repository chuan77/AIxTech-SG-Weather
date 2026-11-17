# Idea Research: Vercel Web Analytics (Hobby plan) for Lepak Weather

- **Slug**: vercel-web-analytics
- **Created**: 2026-11-17
- **Evidence confidence (overall)**: medium. Plan limits, privacy model and integration options come from Vercel's own docs (high). The deciding unknown is whether Vercel's `/_vercel/insights/*` routes reach a **Container-preset** deployment; the docs don't mention containers (low until tested). Demand is the owner's alone.

The idea came in as the owner's request plus a screenshot of the Vercel dashboard's empty Web Analytics "Get Started" panel for `lepak-weather.vercel.app` (0 visitors, Next.js snippet selected). No `intake.md` exists for this slug.

## Users & Demand

- The owner wants visitor and page-view numbers for the public deployment; the dashboard panel is already open and the feature is enabled in the project, awaiting code. — [source: owner request + dashboard screenshot, 2026-11-17] (confidence: high)
- The app is meant to go public as a replacement for a mobile weather app, for users on laptop and mobile. How many users to expect is unknown. — [source: memory `public-mobile-release`] (confidence: high)
- **No usage signal exists today.** An earlier assessment lists "no issues, no analytics, no users interviewed" as the main weakness of every ranking. Analytics would be the first observed-behaviour source. — [source: `.specify/assessments/next-value-features/research.md` lines 6, 75] (confidence: high)
- Stated want only, from one person. No visitor has asked for anything that depends on it. — ASSUMPTION (confidence: medium)

## Prior Art

- **Internal: frontend interaction logging already exists.** The frontend reports interactions to `POST /api/logs`, which pino writes as `frontend interaction` lines (rate-limited 60/min, 2 KB metadata cap). — [source: `backend/src/server.ts:81-106`, `docs/architecture.md`] (confidence: high)
- In the container those logs go to `LOG_FILE_PATH=/tmp/lepak-weather.log`, an instance-local file that disappears when the instance stops (5 idle minutes) and is split across instances. So the existing logging is not a usable traffic record in production. — [source: `docs/deployment.md` (image settings, Known limits); `backend/src/logger.ts:5`] (confidence: high that it is ephemeral; medium that stdout copies reach Vercel runtime logs, not checked)
- Request logs deliberately hold only method, URL, status and time, because Vercel's request headers carry each visitor's IP, city and postcode. The project has an explicit privacy stance on visitor data. — [source: `docs/deployment.md`, `backend/src/requestLogging.ts`] (confidence: high)
- No CSP or `helmet` is set anywhere, so a same-origin analytics script and its POST need no header changes. — [source: grep of `backend/src`, `frontend/index.html`] (confidence: high)
- Hosting assessment `vercel-container-hosting` chose the Container preset on Hobby; analytics was not in its scope. — [source: `.specify/assessments/vercel-container-hosting/`] (confidence: high)
- External: Vercel supports non-Next.js setups: `@vercel/analytics/react` `<Analytics />`, `inject()` for "other", and a plain `<script defer src="/<unique-path>/script.js">` for HTML sites with no npm package. Vite is not named, but plain React and "other" cover it. — [source: vercel.com/docs/analytics/quickstart] (confidence: high)
- The screenshot's snippet (`@vercel/analytics/next`) is for Next.js and does not apply to this Vite app. — [source: screenshot; `frontend/package.json`] (confidence: high)

## Market & Context

- Today the owner has no traffic numbers at all: no analytics, and logs that vanish with the instance. The cost of doing nothing is continuing to rank features without any usage data. — [source: as above] (confidence: high)
- Alternatives: (a) do nothing; (b) Vercel Web Analytics (first-party, same origin, no extra account); (c) a third-party privacy analytics tool (Plausible, Umami, GoatCounter etc.), which means another vendor and another domain; (d) persist the existing `/api/logs` events to Turso and query them. — ASSUMPTION (options listed, not researched) (confidence: medium)
- Vercel Speed Insights is a separate product for performance; it is out of scope here and its Hobby limits were not checked. — [source: vercel.com/docs/analytics] (confidence: high)

## Data & Constraints

- **Hobby quota: 50,000 events / month included**, shared across all projects on the account. Hobby can't buy more; when exceeded, after a 3-day grace period collection **pauses until the next billing cycle or an upgrade to Pro**, with no charge. — [source: vercel.com/docs/analytics/limits-and-pricing] (confidence: high)
- **Reporting window on Hobby: 1 month** (Pro 12, Pro + Plus 24). Month-over-month trends need manual exports or an upgrade. — [source: limits-and-pricing] (confidence: high)
- **Custom events: not on Hobby** (Pro/Enterprise only). UTM parameters: Web Analytics Plus only. Hobby therefore gives page views, visitors, referrers, geography, device/OS/browser only. It cannot answer "which features are used" (map layers, Use my location, refresh). — [source: limits-and-pricing, quickstart] (confidence: high)
- The app has no router and never writes to the URL (no `pushState`, `location.search` or `URLSearchParams` in `frontend/src`). Every visit is one page view of `/`, so route support is irrelevant and "Pages" breakdowns will show a single row. Event volume ≈ page loads. — [source: grep of `frontend/src`] (confidence: high)
- Rough budget: 50,000 events/month ≈ 1,600 page loads/day across all of the account's projects. — ASSUMPTION (arithmetic; real traffic unknown) (confidence: medium)
- **Privacy:** no cookies; visitors identified by a hash of the incoming request that resets daily; sessions discarded after 24 h. Stored per event: timestamp, URL, path, referrer, filtered query params, geolocation (country, region, city), OS, browser, device type. Bots excluded by User-Agent. The docs don't name GDPR or Singapore's PDPA; they say the design aligns with data-protection authority guidance. — [source: vercel.com/docs/analytics/privacy-policy, /docs/analytics] (confidence: high for the facts; PDPA position is [NEEDS CLARIFICATION])
- `beforeSend` can drop or rewrite events (React, `inject()` and plain HTML via `window.va('beforeSend', …)`). — [source: vercel.com/docs/analytics/package] (confidence: high)
- **Routing:** enabling adds Vercel routes under `/_vercel/insights/*` and `/<unique-path>/*` after the next deploy; the script loads from `/<unique-path>/script.js` and posts to `/<unique-path>/view`. Package v2 generates the path at build time. — [source: quickstart, package, privacy-policy] (confidence: high)
- **Container gap:** none of the five pages mention containers or custom servers. Express ends with an SPA fallback, `app.get('*')` → `index.html`. If Vercel doesn't intercept the insights routes ahead of the container, the script request gets HTML back and analytics fails silently. — [source: `backend/src/server.ts:157-164`; container support UNVERIFIED] (confidence: low)
- Build-time path generation: Vercel does not pass project settings into the container image build (the map key is injected at runtime for this reason). Whether `@vercel/analytics` v2's build-time path works inside the Dockerfile build is unknown. — [source: `docs/deployment.md` (VITE_CARTO_API_KEY row); package behaviour inside Docker UNVERIFIED] (confidence: low)
- Ad and content blockers commonly block analytics scripts, so counts will undercount. The dashboard itself warns about content blockers; the fetched docs don't quantify it. — [source: dashboard screenshot text] (confidence: medium)
- Project rules that apply: the Container runtime is in beta; deploys go through CI `verify` only; frontend tests are limited to pure `.ts` modules, so an `<Analytics />` mount can't be unit-tested, only browser-checked. — [source: `docs/deployment.md`, constitution Principle IV] (confidence: high)

## Evidence Against the Idea

- **Hobby answers the least useful question.** Without custom events, it counts visits to a single-URL app. It can't tell which features people use, which is the input the feature backlog actually lacks. — [source: limits-and-pricing; grep of `frontend/src`] (confidence: high)
- **It may not work at all on the Container preset.** Vercel's docs are silent on containers, and the Express catch-all would mask a failure. — [source: as above] (confidence: low, which is itself the risk)
- **The quota is shared and hard-capped.** A traffic spike (or another project on the account) can exhaust 50k events and pause collection for the rest of the month, exactly when the numbers matter. — [source: limits-and-pricing] (confidence: high)
- **The 1-month window** prevents long-run comparisons without upgrading or exporting. — [source: limits-and-pricing] (confidence: high)
- **Privacy posture shift.** The project deliberately avoids logging visitor IP/city; Web Analytics stores city-level geolocation per event with Vercel. It's cookieless and anonymised, but it is a new third-party processing of visitor data that a public app should disclose. — [source: `docs/deployment.md`; privacy-policy] (confidence: medium)
- Low traffic today (fewer than 5 visitors, per the deployment doc's sizing note) means the numbers will be small and noisy for a while. — [source: `docs/deployment.md` Known limits] (confidence: medium)

## Gaps & Open Questions

- [NEEDS CLARIFICATION: Do Vercel's `/_vercel/insights/*` and `/<unique-path>/*` routes get served in front of a Container-preset deployment, or do they fall through to Express? Needs a preview-deploy test: request the script path and check it returns JavaScript, not `index.html`.]
- [NEEDS CLARIFICATION: Does `@vercel/analytics` v2's build-time unique path work when the frontend is built inside the Dockerfile, or should the plain `<script>` / `inject()` approach be used instead?]
- [NEEDS CLARIFICATION: Is page views/visitors/referrers/devices enough, or does the owner actually want feature usage? The latter needs Pro custom events or persisting `/api/logs` events.]
- [NEEDS CLARIFICATION: Expected traffic once public, and what else on the account uses the shared 50k quota.]
- [NEEDS CLARIFICATION: Does a public Singapore app need a privacy notice under PDPA for cookieless analytics with city-level geolocation?]
- [NEEDS CLARIFICATION: Do stdout copies of the `frontend interaction` logs reach Vercel runtime logs, and for how long? This affects option (d).]
- Not fetched: /docs/analytics/filtering, /docs/analytics/redacting-sensitive-data, /docs/speed-insights/limits-and-pricing.

## Sources

- Owner request and Vercel dashboard screenshot, 2026-11-17 (policy: user-supplied)
- https://vercel.com/docs/analytics (host: vercel.com, policy: confirmed-by-user)
- https://vercel.com/docs/analytics/limits-and-pricing (host: vercel.com, policy: confirmed-by-user)
- https://vercel.com/docs/analytics/quickstart (host: vercel.com, policy: confirmed-by-user)
- https://vercel.com/docs/analytics/privacy-policy (host: vercel.com, policy: confirmed-by-user)
- https://vercel.com/docs/analytics/package (host: vercel.com, policy: confirmed-by-user)
- Repo: `docs/deployment.md`, `docs/architecture.md`, `backend/src/server.ts`, `backend/src/logger.ts`, `frontend/package.json`, `vercel.json`, `.specify/memory/constitution.md`, `.specify/assessments/next-value-features/research.md`, `.specify/assessments/vercel-container-hosting/`
- Memory: `public-mobile-release`
