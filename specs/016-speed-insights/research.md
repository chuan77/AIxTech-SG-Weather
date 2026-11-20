# Research: spec 016 (Speed Insights, cold and warm visits apart)

The assessment (`.specify/assessments/speed-insights/research.md`) covers platform limits, scoring and privacy. This file records the build decisions that resolve the plan's unknowns.

## R1. Gate: is `/_vercel/speed-insights/*` served in front of the container?

- **Decision**: check it first on a preview of current `main`, after the owner enables Speed Insights in the Vercel dashboard. Run `curl <preview>/_vercel/speed-insights/script.js`; use `npx vercel curl` if the preview is behind Vercel Authentication.
  - **Pass**: the response is JavaScript.
  - **Fail**: the app's `index.html` comes back. Stop and return to `/speckit-assess-decide slug=speed-insights`.
- **Rationale**: spec FR-001. The sibling `/_vercel/insights/script.js` passed this check on 2026-11-17 (`docs/deployment.md`). Speed Insights routes only exist once the product is enabled.
- **Alternatives**: proxying the script through Express. Rejected, because the spec bans workarounds under this spec.
- **Result (2026-11-20): pass.** Speed Insights was already enabled in the dashboard (owner's screenshot shows the score panel). On production, `GET https://lepak-weather.vercel.app/_vercel/speed-insights/script.js` returned `200 application/javascript` with Vercel's script, served in front of the container. A preview check is still part of the hosted check (quickstart §4).

## R2. Package and how it's mounted

- **Decision**: add `@vercel/speed-insights` **2.1.0** (exact, published 2026-11-05) to `frontend`. Render `<SpeedInsights route={label} beforeSend={stripUrl} />` from `@vercel/speed-insights/react` in `App.tsx`, only when the server says `measure`.
- **Rationale**:
  - **Same pattern as spec 012:** visit counting already mounts `<Analytics />` the same way.
  - **Default script path:** the component injects one deferred `<script src="/_vercel/speed-insights/script.js">` (package `utils.ts`, `getScriptSrc`).
  - **Peer dependency:** the package lists `react` as `^18 || ^19`.
  - **No `mode` prop:** the package checks `process.env.NODE_ENV` instead, and swaps in a debug script from `va.vercel-scripts.com` in development or test. Mounting only in `measure` mode means the dev server and tests never render it. Vite's production build replaces `process.env.NODE_ENV` with `"production"`, the same mechanism React relies on. Quickstart step 1 confirms it: the built bundle must contain no `va.vercel-scripts.com/v1/speed-insights` debug path reachable outside development. The package's `REACT_APP_*` base-path and config variables are unset, so the default path is used.
- **Build check (T017, 2026-11-20):** the debug URL stays in the bundle but can't be reached. Vite compiled the environment check to `function Th(){try{const i="production"}catch{}return"production"}`, and the base-path lookup returns `undefined` in the browser (`typeof process>"u"`). So the script is always `/_vercel/speed-insights/script.js`, and no `scriptSrc` prop is needed.
- **Alternatives**:
  - The generic `injectSpeedInsights()`: same effect, but less consistent with `<Analytics />`.
  - A plain `<script>` tag in `index.html`: it would load in every environment unless the server strips it.

## R3. Cold or warm label: where it's decided

- **Decision**: the server decides it **per page request** from `process.uptime()`:
  - `cold` if the uptime is under 10 s;
  - `warm` otherwise.

  The pure function `visitLabel(uptimeSeconds)` lives in a new `backend/src/speedInsights.ts`. At startup the server pre-renders two `index.html` variants, one with `<meta name="speed-insights-visit" content="cold">` and one with `warm`. Each request picks a variant by comparing two numbers, so there is no extra I/O and no measurable delay (FR-005). The frontend reads the meta and passes `/cold` or `/warm` as the `route` prop.
- **Rationale**:
  - Clarification Q4 sets the 10 s window, and fixes that other requests served first don't change the label.
  - The process starts when the container starts. The measured cold start is about 5 s for the first request (`docs/deployment.md`), so a waking page request has an uptime well under 10 s.
  - `index.html` isn't cached by the CDN. Production `GET /` returned `cache-control: public, max-age=0, must-revalidate` and `x-vercel-cache: MISS` on 2026-11-20. So each visit's HTML reflects its own instance.
  - The service worker never caches the page (spec 014).
- **Alternatives**:
  - A `Server-Timing` header read through `PerformanceNavigationTiming.serverTiming`: no HTML change, but it needs Safari 16.4+ and is harder to check in e2e.
  - A client-side guess from `responseStart`: it can't tell slow networks from cold starts.
  - "First request served": rejected in clarification, because probes and `/health` would mask a cold start.

## R4. Route values and event cost

- **Decision**: use the route values `/cold` and `/warm`. The page `url` is still reported, stripped by `beforeSend`.
- **Rationale**:
  - The app has one page, so `route` otherwise carries no information.
  - The dashboard groups by route, so per-label scores appear there if the free tier shows the route breakdown.
  - `route` is a `data-route` attribute on the script tag, not an extra event, so the event count is unchanged.
  - Clarification Q2 keeps the labels even if the free tier hides the breakdown.
- **Alternatives**: `/` with a query string. Rejected, because `beforeSend` strips queries and query values aren't grouped.

## R5. On/off switch

- **Decision**: add a new `SPEED_INSIGHTS` setting that mirrors `WEB_ANALYTICS`:
  - values `on`, `off` and `notice-only` (trimmed, case-insensitive);
  - unset or empty falls back to `measure` if `VERCEL=1`, otherwise `off`;
  - an invalid value means `off`, with one startup warning.

  `backend/src/analyticsMode.ts` gains a generic `resolveMeasurementMode(raw, env)`. `resolveAnalyticsMode` keeps its signature. A new `resolveSpeedInsightsMode(env)` reads `SPEED_INSIGHTS`. In `measure` and `notice-only` mode the server writes `<meta name="speed-insights" content="measure|notice-only">`. Startup logs `speed insights mode`.
- **Rationale**: clarification Q1 asks for its own switch, default on. It reuses the proven parsing rules and the runtime-meta transport, which is needed because Vercel doesn't pass project variables into the image build.
- **Alternatives**: sharing `WEB_ANALYTICS`, which the owner rejected.

## R6. URL stripping

- **Decision**: make `frontend/src/analytics/stripUrl.ts` generic: `stripUrl<T extends { url: string }>(event: T): T`. Both packages use it. Its existing tests stay, and one more test covers a Speed Insights-shaped event that carries `route` and `type`.
- **Rationale**: FR-006. Both packages' `BeforeSendEvent` types have a `url: string` field, and the behaviour is identical.

## R7. Privacy notice copy

- **Decision**: a new pure module, `frontend/src/analytics/privacyCopy.ts`, takes `{ visits: boolean, speed: boolean }` and returns the collapsed label and the explanation paragraphs. `PrivacyNotice` renders what it returns. `Hero` shows the notice when either mode isn't `off`.

  | Active | Collapsed line |
  |---|---|
  | both | "Anonymous visits & speed · no cookies" (implementation; "visit & speed stats" wrapped at 375 px) |
  | visits only | "Anonymous visit counts · no cookies" (unchanged) |
  | speed only | "Anonymous speed stats · no cookies" |

  The speed paragraph covers:
  - **What is measured:** how quickly the page loads and responds on your device, measured by Vercel Speed Insights.
  - **What is recorded:** the page, your browser, operating system and device type, your country, your network speed, and which part of the page was slowest.
  - **What isn't:** no cookies, no account, no precise location, nothing about saved places.

  The saved-places paragraph from spec 012 stays.
- **Rationale**:
  - FR-011, and clarification Q3: the line names only what is active.
  - Copy logic in a pure module can be tested under Principle IV.
  - **Implementation finding (2026-11-20):** in the radar theme's monospace font, the empty state at 375 px had 295 px of room. The original combined label needed about 330 px, and even the existing visits label (302 px) wrapped. The fix, by owner decision: the label became "Anonymous visits & speed · no cookies" (316 px), and the empty state's phone side padding went from 40 px to 16 px (343 px of room). `privacy-notice.sh variants` checks all three labels in all six themes.
  - The owner approves the final text.
- **Alternatives**: two separate notices. Rejected because of footprint (FR-012).

## R8. Lab baseline

- **Decision**: use PageSpeed Insights (pagespeed.web.dev) against the **production** URL.
  1. Make a warm-up `curl` of the URL.
  2. Within 4 minutes (the instance idles out after 5), run 3 Mobile and 3 Desktop analyses.
  3. Record the median LCP, FCP, CLS, TBT (lab stand-in for INP), Speed Index and TTFB, plus the performance score, with the date.

  The procedure and the first baseline go in `docs/deployment.md` under "Speed Insights".
- **Rationale**:
  - FR-014 and clarification Q5 (median of 3).
  - PageSpeed Insights runs Lighthouse on Google's fixed throttled profiles, so readings don't depend on the owner's laptop.
  - It is free and needs no install.
  - Previews sit behind Vercel Authentication, which PageSpeed Insights can't pass, so production is the target.
  - Lab data has no INP. TBT is Lighthouse's lab proxy for it.
- **Alternatives**:
  - Local Lighthouse CLI or Chrome DevTools: varies with the local machine and needs Chrome.
  - Automating it in CI: out of scope.

## R9. Silence in local, test and e2e runs

- **Decision**: blank `SPEED_INSIGHTS` alongside `WEB_ANALYTICS` and `VERCEL` in `vitest.config.ts` and `scripts/e2e/lib.sh`. `lib.sh` passes `SPEED_INSIGHTS="${E2E_SPEED_INSIGHTS:-}"`. Extend `scripts/e2e/privacy-notice.sh` to:
  - run each copy variant (visits only, speed only, both) in `notice-only`;
  - check the collapsed line text and that it fits one line at 375 px;
  - widen `measurement_requests` to match `/_vercel/speed-insights/` too.

  The dev server never writes metas, so it stays silent.
- **Rationale**: FR-003 and FR-013, SC-004 and SC-005. It is the same approach spec 012 proved.

## R10. Dashboard per-route view on the free tier

- **Decision**: check it during the hosted preview step (quickstart §4). Record the result in `docs/deployment.md`. Either way the labels are kept (clarification Q2).
- **Rationale**: FR-007. Vercel's docs say free-tier breakdowns are limited to "Great and Needs Improvement entries", which leaves the route breakdown unclear until it is checked.
