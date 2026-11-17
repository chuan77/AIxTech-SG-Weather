# Phase 0 Research: Anonymous Visitor Measurement (spec 012)

Inputs: [spec.md](spec.md), the assessment in `.specify/assessments/vercel-web-analytics/`, the `@vercel/analytics@2.0.1` package source (downloaded and read 2026-11-17), Vercel docs fetched 2026-11-17 (owner approved vercel.com), and a local check of draft PR #17.

## R1. Where the measurement script comes from

- **Decision**: use `@vercel/analytics` **2.0.1** (pinned exactly) in the `frontend` workspace, via its React `<Analytics />` component, rendered only when the server says measurement is active (R3).
- **Rationale**: the package source shows that in production mode (`mode="production"`, or `auto` with `NODE_ENV` not `development`/`test`) the component injects one deferred `<script src="/_vercel/insights/script.js">`. A failed load is reported with `console.log`, not `console.error` (`script.onerror`), so a blocked script stays clean under the e2e `assert_clean` rule (FR-005). In development mode it loads `https://va.vercel-scripts.com/v1/script.debug.js` instead, so it must never render locally (FR-004). The script is same-origin; there is no CSP, so there are no header changes.
- **Alternatives considered**:
  - Hand-written `<script defer src="/_vercel/insights/script.js">` in `index.html`: no dependency, but it would load on every server, including local runs (the PR #17 failure), unless the server strips it. That adds the same server logic with less type safety.
  - `inject()` from `@vercel/analytics`: equivalent; the component fits the React tree and cleans up with it.
  - Floating `^2.0.1` (PR #17): the project pins small runtime dependencies (`supercluster 9.1.0`, `compression 1.8.2`). A minor bump could change the script path, so it is pinned.

## R2. Do Vercel's `/_vercel/insights/*` routes reach a Container deployment? (FR-001 gate)

- **Decision**: **unknown from docs. Test before any code.** The Container Runtime page (`vercel.com/docs/functions/runtimes/container`, Beta) doesn't mention `/_vercel/*`, Web Analytics or Speed Insights. The gate needs no code: deploy the current `main` as a **preview** with `npx vercel@65.9.0 deploy` and request `/_vercel/insights/script.js` on that preview URL. The analytics script means pass; the app's `index.html` (`<!DOCTYPE html>`, `text/html`) means fail.
- **Rationale**: the route is either intercepted by Vercel's edge or it isn't; app code doesn't change that. Testing first avoids building anything that would be thrown away. Local evidence (2026-11-17, PR #17 worktree): Express's catch-all returns `index.html` with HTTP 200 for that path, and the browser throws `SyntaxError: Unexpected token '<'`. That is exactly what production visitors would get if the gate fails.
- **Preview protection**: Hobby previews may sit behind Vercel Authentication. Use `npx vercel@65.9.0 curl` (or the `vercel:access-protected-vercel-deployment` skill) rather than turning protection off.
- **If it fails**: stop. Return to `/speckit-assess-decide slug=vercel-web-analytics` (Option B or C). Don't proxy the script through Express (unsupported, and against the spec).

### Gate result (T001): PASS, 2026-11-17

- **Deployment**: preview of `main` @ `8d1c7fb` from a clean worktree: `https://lepak-weather-4e2o7zwf2-snaic-nexus.vercel.app` (Deployment Protection on; reached with `npx vercel@65.9.0 curl`).
- `GET /_vercel/insights/script.js` → `HTTP/2 200`, `content-type: application/javascript`, `server: Vercel`, `x-vercel-cache: HIT`, `x-vercel-id: sin1:…`. The body is minified JavaScript (`"use strict";(()=>{…`), with no `<!DOCTYPE html>`. Vercel's edge answers the path before the request reaches the container, so the Express catch-all is never hit.
- `GET /health` → `200 {"status":"healthy"}` (same deployment, for comparison).
- A plain `curl` gets `302` (Vercel Authentication), as expected for previews. Production is public.
- Whether `VERCEL=1` reaches the container at runtime is still unrecorded. It will show in the `web analytics mode` log line once T010 ships (informational only; `WEB_ANALYTICS=on` is set explicitly).

## R3. How the app knows measurement is active (FR-004, FR-004a, FR-007, FR-007a)

- **Decision**: the server decides at startup and tells the page through a runtime `<meta name="web-analytics" content="…">` in `index.html`. This is the same mechanism as the CARTO key (`backend/src/indexHtml.ts`). A new server setting `WEB_ANALYTICS` takes:

  | `WEB_ANALYTICS` | `VERCEL` | Result (`AnalyticsMode`) |
  |---|---|---|
  | `on` | any | `measure` (script + notice) |
  | `off` | any | `off` (nothing) |
  | `notice-only` | any | `notice-only` (notice, no script): for local browser checks only |
  | unset / empty | `1` | `measure` (default on for hosted deployments) |
  | unset / empty | not `1` | `off` |
  | anything else | any | `off`, with one startup warning in the log |

  No meta tag means `off`. The Vite dev server (non-production `server.ts` branch) never renders this meta, so `npm run dev` is always off.
- **Rationale**:
  - Vercel doesn't pass project variables into the container image *build* (`docs/deployment.md`, `VITE_CARTO_API_KEY` row), but it does pass them to the container at *runtime* (Turso and the map key work this way). So a build-time `VITE_` flag can't work, and a runtime meta can.
  - `VERCEL`/`VERCEL_ENV` are documented as "build and runtime" system variables, but the docs never say they reach Container deployments, and they sit behind the project toggle "Enable access to System Environment Variables". So **`WEB_ANALYTICS=on` is set explicitly** in Vercel's Production and Preview environments. `VERCEL=1` is only a fallback default, and the gate preview records whether it is present.
  - The Dockerfile does **not** set `WEB_ANALYTICS`, so a local `docker run` of the image stays off (no `VERCEL`).
  - The off switch is the same variable: set `WEB_ANALYTICS=off` and redeploy (FR-004a). That removes both the script and the notice (clarification Q4).
- **Alternatives considered**: `VERCEL_ENV` only (unverified for containers); a build arg in the Dockerfile (the build can't see project variables); a client-side hostname check against `*.vercel.app` (it breaks on a custom domain and can't be switched off without a code change).

## R4. Keeping local runs, tests and checks silent (FR-004, FR-011, SC-003, SC-004)

- **Decision**:
  - `scripts/e2e/lib.sh` starts its temporary server with `WEB_ANALYTICS=` and `VERCEL=` blanked, as it already does for `TURSO_*`. `dotenv` doesn't override variables that are already set, so a developer's `.env` can't turn measurement on in a check.
  - `vitest.config.ts` blanks them the same way.
  - Existing checks therefore see `off`: no script and no notice, so they are unchanged.
  - A new `scripts/e2e/privacy-notice.sh` starts its server with `WEB_ANALYTICS=notice-only`. It asserts the notice behaviour and that **no** request to `/_vercel/insights/` or `va.vercel-scripts.com` happens (Resource Timing, as `rain-view.sh` US4 does).
- **Rationale**: it reuses the established pattern and makes FR-007a testable without sending anything.

## R5. Privacy-preserving payload (FR-003, FR-008)

- **Decision**: pass a `beforeSend` that drops the query string and fragment from the reported URL.
- **Rationale**: the app never writes to the URL, but inbound links can carry tracking parameters (`?fbclid=…`), and Vercel stores "filtered query params" per event. Stripping them keeps the stored URL to the origin and `/`. It is a pure function with a unit test. Referrer is still reported, and is listed in the notice.
- **Alternative**: no `beforeSend`. Rejected: it costs one line to remove a possible identifier.

## R6. Notice placement and form (FR-007–FR-010)

- **Decision**: a `PrivacyNotice` disclosure in two places:
  1. The selected-location footer in `Hero.tsx`, on the line after the "Weather for … · source" credit.
  2. The empty state (`Hero` early return), under the "Add a Singapore town…" hint.

  Collapsed, it is one `text-xs text-ink-muted` button, e.g. "Anonymous visit counts · no cookies". It uses `aria-expanded` and `aria-controls`. Expanded, it shows a short paragraph in place (FR-008 content). No navigation and no modal. Text colours come from theme tokens only (Principle V). If the expanded explanation is drawn as a panel, it uses `rounded-card`.
- **Rationale**: these two spots are the only ones covering every view, and the footer is already where provenance text lives. Final placement, especially relative to the 375 px `PhoneDock`, is confirmed by an `impeccable` review before release (FR-010).
- **Draft copy (owner approves)**:
  - Collapsed: "Anonymous visit counts · no cookies"
  - Expanded: "We count visits to see whether this app is useful. Vercel Web Analytics, our host's built-in tool, records the page, the site that linked here, your country/region/city, and your device type, operating system and browser. It uses no cookies, no account and no precise location, and never sees your saved places. Visitors are told apart by an anonymous value that resets every day."

## R7. Docs and cleanup

- **Decision**:
  - `docs/deployment.md`: a `WEB_ANALYTICS` row in Settings, and a Web Analytics section (dashboard location, the 50,000 events/month cap shared across the account, the pause when it runs out, the 1-month window, blocked visitors not counted, the off switch, and that the dashboard toggle alone leaves the app requesting the script).
  - `docs/architecture.md`: one sentence.
  - `docs/testing.md`: the new check.
  - Close PR #17 with a pointer to this spec (clarification Q3; outward action, owner confirms first).
- **Working tree note**: on `012-vercel-web-analytics`, the root `package.json`/`package-lock.json` already carry an uncommitted `@vercel/analytics ^2.0.1` in the **root** dependencies, from outside this plan. The dependency belongs in `frontend/package.json`, pinned. Tasks must ask the owner before replacing that change.

## Resolved unknowns

All Technical Context items are resolved except the R2 gate, which is resolved by test, not by research. It is the first task.
