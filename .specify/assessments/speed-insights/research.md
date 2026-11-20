# Idea Research: Vercel Speed Insights for a Real Experience Score

- **Slug**: speed-insights
- **Created**: 2026-11-20
- **Evidence confidence (overall)**: medium. Plan limits, metrics, privacy fields and package behaviour come from Vercel's own docs and source (high). Two things stay low until tested: whether `/_vercel/speed-insights/*` is served in front of the container (the sibling `/_vercel/insights/*` route is, so this is likely), and whether traffic is high enough to give a meaningful score. Demand comes from the owner alone.

## Users & Demand

- The owner wants a Real Experience Score for the deployed app. The Speed Insights tab in the Vercel dashboard is open, empty and showing the "Get Started" panel. — [source: owner request + dashboard screenshot, 2026-11-20; `intake.md`] (confidence: high)
- The app is going public as a replacement for a mobile weather app, used on laptops and phones. Real-device performance on mobile is the experience that matters. — [source: memory `public-mobile-release`] (confidence: high)
- No visitor has reported slowness, and no performance complaint or measurement exists in the repo. No `web-vitals`, Lighthouse or LCP figures appear in specs, scripts or assessments, apart from Lighthouse mentions in spec 006 and spec 014 research. — [source: grep of `.specify/assessments`, `specs`, `scripts`] (confidence: medium. The spec 006/014 mentions were not read.)
- This is a stated want from one person, with no observed user problem behind it yet. — ASSUMPTION (confidence: medium)

## Prior Art

- **Internal: Web Analytics shipped (spec 012, PR #18).** `<Analytics mode="production" beforeSend={stripUrl} />` is mounted in `frontend/src/App.tsx` only when the server-written `<meta name="web-analytics">` says `measure`. That meta comes from `WEB_ANALYTICS` (falling back to `VERCEL=1`). The Vite dev server never writes it, so local runs, tests and e2e checks load nothing. — [source: `frontend/src/App.tsx:1-19`, `docs/architecture.md` (Frontend), `docs/deployment.md:32,139-148`] (confidence: high)
- **The container route question is answered for the sibling product.** Vercel serves `/_vercel/insights/script.js` in front of the container (checked on a preview, 2026-11-17). Speed Insights uses a parallel route family, `/_vercel/speed-insights/*` and a `/<unique-path>/*`. — [source: `docs/deployment.md:141`; vercel.com/docs/speed-insights/quickstart] (confidence: medium that it behaves the same, untested)
- **The earlier assessment ruled Speed Insights out of scope** and did not check its limits. — [source: `.specify/assessments/vercel-web-analytics/decision.md:39`, `research.md:30`] (confidence: high)
- **Privacy precedent:** the app shows "Anonymous visit counts · no cookies" (`PrivacyNotice.tsx`) and strips the query and fragment from reported URLs (`stripUrl.ts`). Request logs keep no headers, because Vercel headers carry the visitor's IP and city. — [source: `docs/deployment.md:19,146`; `frontend/src/analytics/stripUrl.ts`] (confidence: high)
- **External: the package supports React directly.** `@vercel/speed-insights` (v2.1.0 on `main`) has `@vercel/speed-insights/react` `<SpeedInsights />`, a generic `injectSpeedInsights()`, and a no-npm `<script>` option. The dashboard's Next.js snippet (`/next`) does not apply to this Vite app. — [source: github.com/vercel/speed-insights README, `packages/web/package.json`] (confidence: high)
- **Package options** (from source): `sampleRate` (for example 0.5 sends 50% of events, described in source as "to reduce costs"), `beforeSend` (rewrite or drop an event `{type:'vital', url, route}`), `softNavs`, `route`, `scriptSrc`, `endpoint`, `debug`. — [source: `packages/web/src/types.ts`, `generic.ts`] (confidence: high)
- **Script source logic:** the default is `/_vercel/speed-insights/script.js`. When `process.env.NODE_ENV` is `development` or `test`, the package instead loads `https://va.vercel-scripts.com/v1/speed-insights/script.debug.js` from a third-party origin. A failed load logs `console.log` (not `console.error`) with a content-blocker hint. Unlike `@vercel/analytics`, it has no `mode` prop. — [source: `packages/web/src/utils.ts` (`getScriptSrc`, `detectEnvironment`), `generic.ts`] (confidence: high)

## Market & Context

- **Today there are no real-user performance numbers at all.** The only figure is a measured cold start of about 5 s for the first request after a deploy, then 5–25 ms per request. Instances stop after 5 idle minutes. — [source: `docs/deployment.md:153`] (confidence: high)
- **Alternatives, not researched:**
  - Do nothing.
  - Run lab tests with Lighthouse or PageSpeed Insights by hand or in CI. These are free, need no visitors and give per-metric detail, but they are not field data.
  - Use the `web-vitals` library and send results to the existing `/api/logs`. Those logs are instance-local and ephemeral in production.
  - Use a third-party RUM tool.

  — ASSUMPTION (options listed, not researched) (confidence: medium)
- **Cost of doing nothing:** low while traffic is tiny. Performance regressions from new features (map layers, PWA, lightning) would go unnoticed in the field. — ASSUMPTION (confidence: medium)

## Data & Constraints

- **Hobby: free tier only.** "10,000 events over the last 30 days, shared across the team", a rolling window. On exceeding it, collection "pauses for at least 14 days" and stays paused while 30-day usage remains above half the allocation. There are no charges. — [source: vercel.com/docs/speed-insights/limits-and-pricing] (confidence: high)
- **The free tier shows the RES only**, with breakdowns limited to "Great and Needs Improvement entries". Date ranges are 24 hours and 7 days. The individual Core Web Vitals (FCP, LCP, INP, CLS, TTFB), all breakdowns, countries and element selectors need **Speed Insights Plus**: Pro only, $10 per project per month plus $0.65 per 10,000 events. — [source: limits-and-pricing] (confidence: high)
- **Event volume:** up to 5 data points per visit (TTFB and FCP on load, LCP on interaction, INP, CLS and LCP on leave), "between 3 and 5 metrics per visit" on average. Soft navigations count too (Chromium only, on by default). 10,000 events is therefore about 2,000–3,300 visits per rolling 30 days, shared with every other project on the account. — [source: vercel.com/docs/speed-insights/metrics; arithmetic is ASSUMPTION, and the docs don't confirm that "events" = "data points"] (confidence: medium)
- **The app has no router and never changes the URL**, so every visit is one page, `/`. Soft navigations shouldn't occur, and route breakdowns would show one row. — [source: `.specify/assessments/vercel-web-analytics/research.md:37` (grep of `frontend/src`)] (confidence: high)
- **RES computation:**
  - Weighted average of LCP, CLS, INP, FCP and TTFB scores. Each score is 0–100 on an HTTP Archive log-normal curve. The weights are not published.
  - p75 by default (p90/p95/p99 selectable).
  - Bands: 0–49 Poor, 50–89 Needs Improvement, 90–100 Good.
  - "Good" thresholds: LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms, FCP ≤ 1.8 s, TTFB < 800 ms.
  - No minimum sample size is stated.
  - Data appears after "a few days of visitors".

  — [source: vercel.com/docs/speed-insights/metrics, quickstart] (confidence: high)
- **The cold start meets the TTFB threshold head-on.** A visit that wakes an idle instance waits about 5 s against the 800 ms "good" TTFB line, and that also delays FCP and LCP. With fewer than 5 visitors, most visits may be cold, so the score may mostly measure container idle-out rather than the frontend. — [source: `docs/deployment.md:153,156`; inference is ASSUMPTION] (confidence: medium)
- **Privacy:**
  - Anonymous. Not tied to a visitor or IP, and no session reconstruction.
  - Stored per data point: route, URL, network speed, browser, device type, device OS, country (ISO code), the web vital and its attribution, SDK info, and server-received time.
  - The docs mention no cookies, IP or city. Retention is not stated on that page.

  Compared with Web Analytics, it stores less location data (country, not city) but adds network speed and element attribution. — [source: vercel.com/docs/speed-insights/privacy-policy] (confidence: high for fields; medium for cookies, which are unmentioned rather than denied)
- **URL handling:** the reported `url` would carry inbound query strings (for example `?fbclid=…`) unless `beforeSend` strips them. The existing `stripUrl` is typed for `@vercel/analytics`, but the event shape is similar (`url` field). — [source: `types.ts` (`BeforeSendEvent`); `frontend/src/analytics/stripUrl.ts`] (confidence: high)
- **Local, test and e2e runs:** the e2e checks fail on any uncaught page error or `console.error`, and serve the built `frontend/dist` from Express, whose catch-all `app.get('*')` returns `index.html`.
  - An ungated `/_vercel/speed-insights/script.js` request there would get HTML back.
  - In dev or test builds, the package would fetch a debug script from `va.vercel-scripts.com`.

  The Web Analytics gate exists for exactly this reason. — [source: `CLAUDE.md` (Browser checks), `backend/src/server.ts:207`, `utils.ts`; exact browser error behaviour is ASSUMPTION] (confidence: medium)
- **Build-time unique path:** "Vercel generates a random seed at build time" for the resilient-intake script and intake URLs. Vercel does not pass project settings into the container image build. Web Analytics works through `/_vercel/insights/script.js`, so the fixed `/_vercel/speed-insights/*` path is likely the working route, but this is untested. — [source: privacy-policy page; `docs/deployment.md` (VITE_CARTO_API_KEY row)] (confidence: low)
- **Must be enabled in the dashboard** before the routes exist. The README says "Enable Vercel Speed Insights for a project in the Vercel Dashboard". — [source: github.com/vercel/speed-insights README] (confidence: high)
- **Project rules:** frontend tests cover pure `.ts` modules only, so a `<SpeedInsights />` mount can only be browser-checked. Deploys go through CI `verify`. The Container runtime is in beta. — [source: `docs/testing.md`, `docs/deployment.md`] (confidence: high)

## Evidence Against the Idea

- **On Hobby, it returns a single number.** The free tier shows the RES only, not LCP, INP or CLS separately, and keeps 7 days at most. A poor score can't be traced to a cause without Pro plus Plus ($10 per project per month plus events). — [source: limits-and-pricing] (confidence: high)
- **Too few samples to trust.** With fewer than 5 visitors and p75 scoring, a handful of visits sets the score, and a single cold-start visit can swing it. — [source: `docs/deployment.md:156`; metrics page] (confidence: medium)
- **It would mostly measure cold starts.** About 5 s cold starts after 5 idle minutes dominate TTFB, FCP and LCP at low traffic. That is a hosting trait already known and documented, not new information about the frontend. — [source: `docs/deployment.md:153`] (confidence: medium)
- **Lab tools answer the same question for free, today.** Lighthouse or PageSpeed Insights give per-metric detail without visitors or quota. — ASSUMPTION (confidence: medium)
- **It adds another third-party script and processing of visitor data**, with fields beyond Web Analytics (network speed, element attribution). The privacy notice currently describes visit counts only. — [source: privacy-policy; `docs/deployment.md:146`] (confidence: medium)
- **The quota is small and shared.** 10,000 events per rolling 30 days, and an overrun pauses collection for at least 14 days. A traffic spike after a public launch, exactly when the numbers matter, could cut it off. — [source: limits-and-pricing] (confidence: high)
- **Silent failure on the container is possible.** If `/_vercel/speed-insights/*` falls through to Express, the script request gets `index.html`, and the package only `console.log`s the failure. — [source: `server.ts:207`, `generic.ts`] (confidence: low)

## Gaps & Open Questions

- [NEEDS CLARIFICATION: Is `/_vercel/speed-insights/script.js` served by Vercel in front of the Container preset, as `/_vercel/insights/script.js` is? This needs a preview-deploy check after enabling it in the dashboard.]
- [NEEDS CLARIFICATION: Is the RES alone (no per-metric breakdown, 7-day window) enough for the owner, or is the real want per-metric diagnosis, which needs Pro plus Plus or a lab tool?]
- [NEEDS CLARIFICATION: Is the account on Hobby, and what else on it uses the shared 10,000-event Speed Insights allocation?]
- [NEEDS CLARIFICATION: How much traffic is expected after the public launch, and is the score meant to track it over time or just give a one-off baseline?]
- [NEEDS CLARIFICATION: Should the privacy notice ("Anonymous visit counts · no cookies") be widened to cover performance measurement, and does Singapore's PDPA bear on it?]
- [NEEDS CLARIFICATION: Do "events" (pricing) equal "data points" (metrics page)? The docs don't define this.]
- [NEEDS CLARIFICATION: Does Vite's build replace `process.env.NODE_ENV` inside the package so that production builds pick the `/_vercel/...` script rather than the debug one? Likely yes, but unverified.]
- Not read: vercel.com/docs/speed-insights/package (sampleRate, beforeSend details), /legal/privacy-policy (retention), spec 006/014 Lighthouse mentions.

## Sources

- Owner request and Vercel dashboard screenshot, 2026-11-20 (policy: user-supplied)
- https://github.com/vercel/speed-insights (README; `packages/web/src/generic.ts`, `types.ts`, `utils.ts`, `package.json` via the GitHub API) (host: github.com, policy: allowlisted)
- https://vercel.com/docs/speed-insights/limits-and-pricing (host: vercel.com, policy: confirmed-by-user)
- https://vercel.com/docs/speed-insights/metrics (host: vercel.com, policy: confirmed-by-user)
- https://vercel.com/docs/speed-insights/privacy-policy (host: vercel.com, policy: confirmed-by-user)
- https://vercel.com/docs/speed-insights/quickstart (host: vercel.com, policy: confirmed-by-user)
- Repo: `docs/deployment.md`, `docs/architecture.md`, `docs/testing.md`, `CLAUDE.md`, `frontend/src/App.tsx`, `frontend/src/analytics/stripUrl.ts`, `frontend/package.json`, `backend/src/server.ts`, `.specify/assessments/vercel-web-analytics/{research,decision}.md`
- Memory: `public-mobile-release`
