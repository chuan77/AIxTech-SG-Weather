# Implementation Plan: Real-User Performance Score, with Cold and Warm Visits Apart

**Branch**: `016-speed-insights` | **Date**: 2026-11-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/016-speed-insights/spec.md`

## Summary

Turn on Vercel Speed Insights (Hobby) for hosted deployments only, and label every page load cold or warm so container wake-up can be told apart from the frontend.

- **Gate first.** Vercel must serve `/_vercel/speed-insights/script.js`, not the app's `index.html` (FR-001; [research.md](research.md) R1). **Passed 2026-11-20 on production**, where Speed Insights was already enabled.
- **Own switch.** The server reads `SPEED_INSIGHTS` (`on`/`off`/`notice-only`, unset falls back to `VERCEL=1`) at startup, with the same rules as `WEB_ANALYTICS` but independent of it. It writes `<meta name="speed-insights">`.
- **Cold or warm per request.** In `measure` mode, the server pre-renders two page variants. It serves the `cold` one when `process.uptime() < 10` and `warm` otherwise (R3).
- **Frontend.** In `measure` mode only, it renders `@vercel/speed-insights/react` `<SpeedInsights />`, pinned at 2.1.0, with `route="/cold"|"/warm"` and the shared `stripUrl` `beforeSend` (R2, R4, R6).
- **Notice.** The privacy notice is shown when either measurement is active. Its line and explanation name only what is active (R7).
- **Lab baseline.** A documented PageSpeed Insights procedure: a warm-up request, then the median of 3 Mobile and 3 Desktop runs. The first baseline is recorded (R8).
- **Silent elsewhere.** Dev, tests and e2e resolve to `off`. `privacy-notice.sh` covers the new copy variants and asserts zero Speed Insights requests (R9).

## Technical Context

**Language/Version**: TypeScript 5 on Node 24 (container `node:24-alpine`); React 18

**Primary Dependencies**: Express 4, React 18, Vite 7, Tailwind 3, `@vercel/analytics` 2.0.1. New: `@vercel/speed-insights` **2.1.0** (exact) in `frontend`

**Storage**: N/A. The app stores nothing; readings are held by Vercel Speed Insights.

**Testing**: Vitest (node env; pure `.ts` modules on the frontend), backend unit tests for pure modules, agent-browser e2e scripts in `scripts/e2e/`

**Target Platform**: Vercel Container preset (Hobby, `sin1`); browsers on laptops and 375 px phones

**Project Type**: web application (one Express process serving the Vite build)

**Performance Goals**: no measurable change in time to first weather content (SC-007). The script is deferred and same-origin. Picking the label costs one comparison per page request.

**Constraints**:
- $0, Hobby only; no cookies; nothing new in app storage or logs; no console errors in any run.
- 10,000 events per rolling 30 days, shared across the account; an overrun pauses collection for at least 14 days.
- The free tier shows the overall score only, with 24-hour and 7-day ranges.

**Scale/Scope**:
- Fewer than 5 visitors today, 3–5 events per visit.
- Backend: 1 new pure module, 2 extended.
- Frontend: 2 new pure modules, 2 extended, 3 components touched.
- 1 e2e script extended, 3 docs.

No NEEDS CLARIFICATION remains; the research resolves all of it.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Snapshot-Only Weather Data | Pass | No weather calls added or changed. |
| II. One Process, Relative API | Pass | Same process, no new API route. The script and intake are same-origin `/_vercel/speed-insights/*`, which Vercel serves in front of the container. No router or second state container. Modes are read from metas, like the CARTO key and `web-analytics`. |
| III. Injectable Weather Provider | Pass | Untouched. |
| IV. Testing Within Real Limits | Pass | Logic sits in pure modules with Vitest tests: `resolveSpeedInsightsMode`, `visitLabel`, `renderIndexHtml`, client `speedInsightsMode`, `stripUrl`, `privacyCopy`. Component behaviour is covered by the e2e check, not a DOM test environment. |
| V. Theme-Driven UI | Pass (by design) | Only the notice's copy changes. Its styling stays on `text-ink-muted` and `--focus-ring` tokens. One-line fit and contrast are checked in all six themes. The `apple` theme is not changed. |
| VI. Testing & Quality Gate | Pass | No new route. The changed page routes (`/index.html` and the SPA fallback) get Supertest coverage in `backend/src/pageServing.test.ts`, through two new `createApp` options, `frontendDist` and `uptime`, which default to today's behaviour. Page rendering is also covered by `indexHtml.test.ts`. The pre-commit hook is unchanged and not bypassed. (Corrected after `/speckit-analyze` C1.) |

Post-design re-check (after Phase 1): unchanged, all pass. No Complexity Tracking entries.

**Stop gate (spec FR-001)**: passed on 2026-11-20 (R1). Production serves the script.

## Project Structure

### Documentation (this feature)

```text
specs/016-speed-insights/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── index-html-meta.md
│   └── privacy-notice-ui.md
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks
```

### Source Code (repository root)

```text
backend/src/
├── analyticsMode.ts          # generic resolveMeasurementMode(raw, env); + resolveSpeedInsightsMode(env)
├── analyticsMode.test.ts     # + SPEED_INSIGHTS table, independence from WEB_ANALYTICS
├── speedInsights.ts          # NEW: visitLabel(uptimeSeconds) → 'cold' | 'warm' (10 s window)
├── speedInsights.test.ts     # NEW
├── indexHtml.ts              # + speed-insights metas; renderIndexHtml(html, env, { visit })
├── indexHtml.test.ts         # extended
├── pageServing.test.ts       # NEW: Supertest for / , /index.html and the SPA fallback (labels, metas)
└── server.ts                 # + frontendDist/uptime options; pre-renders cold/warm; picks per request; logs mode once

frontend/
├── package.json              # + "@vercel/speed-insights": "2.1.0"
└── src/
    ├── App.tsx               # + <SpeedInsights route beforeSend={stripUrl} /> in measure mode only
    ├── analytics/
    │   ├── speedInsightsMode.ts      # NEW: parse mode + visit label → route
    │   ├── speedInsightsMode.test.ts # NEW
    │   ├── stripUrl.ts               # generic over { url }
    │   ├── stripUrl.test.ts          # + Speed Insights event shape
    │   ├── privacyCopy.ts            # NEW: label + paragraphs from { visits, speed }
    │   └── privacyCopy.test.ts       # NEW
    └── components/
        ├── PrivacyNotice.tsx # renders privacyCopy output
        └── Hero.tsx          # shows notice when either mode ≠ off

scripts/e2e/
├── lib.sh                    # blank SPEED_INSIGHTS; pass E2E_SPEED_INSIGHTS
└── privacy-notice.sh         # copy variants, one-line fit, Speed Insights request check

vitest.config.ts              # blank SPEED_INSIGHTS
docs/deployment.md            # SPEED_INSIGHTS row + Speed Insights section + lab baseline
docs/architecture.md          # one sentence on the speed mode and visit label
docs/testing.md               # privacy-notice.sh scope
```

**Structure Decision**: the existing npm-workspace web app (`backend/`, `frontend/`). The mode and the per-request label travel in the runtime metas that `indexHtml.ts` already writes. The frontend reads them the way `analyticsMode.ts` does. No new route, table or workspace.

## Delivery Order

1. **Gate** (R1): passed on 2026-11-20. Speed Insights was already enabled, and production serves `/_vercel/speed-insights/script.js` as JavaScript.
2. Mode and label plumbing (backend and client parsing, with tests). It is silent by default, so the existing e2e checks stay green.
3. `<SpeedInsights />` in `measure` mode, generic `stripUrl`, and a build check for the debug path.
4. `privacyCopy` and notice variants, then `privacy-notice.sh`. The owner approves the copy.
5. Docs. Set `SPEED_INSIGHTS=on` in Vercel (Production and Preview). Run the preview cold/warm check and the per-route view check (quickstart §4), then merge.
6. Lab baseline on production (quickstart §5) and record it.

## Risks

- **Gate fails**: the feature stops, by design.
- **Free tier hides the route view**: the labels stay (Q2), and the lab baseline provides the split. Recorded in the docs.
- **Uptime doesn't track container start**, for example a pre-warmed process: cold visits would be under-counted. The preview cold check (2 of 2) exposes this before merge. If it fails, the label is reconsidered in `/speckit-clarify`, not hacked.
- **Package picks the debug script in a production build**: caught by the build grep and the hosted check, and fixable with an explicit `scriptSrc` prop.
- **Thin samples**: the score stays noisy until traffic grows. This is expected and documented.
- **Working on `main`**: the plan's branch is `016-speed-insights`, but the repo is currently on `main` with unrelated uncommitted changes. Create the branch before implementing, and leave those changes out.

## Complexity Tracking

None.
