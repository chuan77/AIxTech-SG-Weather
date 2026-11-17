# Implementation Plan: Anonymous Visitor Measurement with a Privacy Notice

**Branch**: `012-vercel-web-analytics` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/012-vercel-web-analytics/spec.md`

## Summary

Turn on Vercel Web Analytics (Hobby) for hosted deployments only, with a one-line privacy notice shown wherever measurement is active.

- **Gate first.** A preview of the current `main` must serve Vercel's `/_vercel/insights/script.js`, not the app's `index.html` (FR-001; [research.md](research.md) R2). If it doesn't, stop.
- **One switch.** The server reads `WEB_ANALYTICS` (`on`/`off`/`notice-only`; unset falls back to `VERCEL=1`) at startup and writes `<meta name="web-analytics">` into `index.html`, the same way the CARTO key reaches the page today.
- **Frontend.** It renders `@vercel/analytics/react` `<Analytics />` (pinned 2.0.1, `beforeSend` strips query and fragment) only in `measure` mode, and a `PrivacyNotice` disclosure in the Hero footer and empty state in `measure` and `notice-only` modes.
- **Silent elsewhere.** Local dev, tests and e2e servers resolve to `off`. A new `privacy-notice.sh` check runs in `notice-only` and asserts zero measurement requests.

## Technical Context

**Language/Version**: TypeScript 5 on Node 24 (container `node:24-alpine`); React 18

**Primary Dependencies**: Express 4, React 18, Vite 7, Tailwind 3. New: `@vercel/analytics` **2.0.1** (exact) in `frontend`

**Storage**: N/A. Nothing stored by the app; visits are held by Vercel Web Analytics.

**Testing**: Vitest (node env; pure `.ts` modules on the frontend), Supertest-free backend unit tests for pure modules, agent-browser e2e scripts in `scripts/e2e/`

**Target Platform**: Vercel Container preset (Hobby, `sin1`); browsers on laptop and 375 px phones

**Project Type**: web application (one Express process serving the Vite build)

**Performance Goals**: no measurable change in time until the weather first shows (SC-008). The script is deferred, same-origin and about 1 kB.

**Constraints**: $0, Hobby only; no cookies; no new personal data in app storage or logs; no console errors in any run; 50,000 events/month shared cap; 1-month look-back

**Scale/Scope**: fewer than 50k page views a month; 2 frontend components touched, 2 new small frontend modules, 1 new backend module, 1 new e2e script, 3 docs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Snapshot-Only Weather Data | Pass | No weather calls added or changed. |
| II. One Process, Relative API | Pass | Same process; the script is same-origin (`/_vercel/insights/*`, served by Vercel's edge in front of the container); no new API route. |
| III. Injectable Weather Provider | Pass | Untouched. |
| IV. Testing Within Real Limits | Pass | Logic sits in pure modules with Vitest tests (`analyticsMode`, `stripUrl`, server `resolveAnalyticsMode`, `renderIndexHtml`). UI behaviour is covered by an e2e browser check, not a DOM test env. |
| V. Theme-Driven UI | Pass (by design) | Notice uses `text-ink-muted`, `--focus-ring`, no literal colours, `rounded-card` if it is a panel; contrast is checked in all six themes by `privacy-notice.sh`. The `apple` theme is not changed. |
| VI. Testing & Quality Gate | Pass | No new Express route (only `index.html` rendering changes, covered by `indexHtml.test.ts`). The pre-commit hook is unchanged and not bypassed. |

Post-design re-check (after Phase 1): unchanged, all pass. No Complexity Tracking entries.

**Stop gate (spec FR-001)**: task 1 is the preview check of R2 on current `main`. A fail ends the feature here.

## Project Structure

### Documentation (this feature)

```text
specs/012-vercel-web-analytics/
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
├── analyticsMode.ts          # NEW: resolveAnalyticsMode(env) → 'measure' | 'notice-only' | 'off'
├── analyticsMode.test.ts     # NEW
├── indexHtml.ts              # adds <meta name="web-analytics"> next to the CARTO meta
├── indexHtml.test.ts         # extended
└── server.ts                 # logs the resolved mode once at start (and the invalid-value warning)

frontend/
├── package.json              # + "@vercel/analytics": "2.0.1"
└── src/
    ├── App.tsx               # renders <Analytics beforeSend={stripUrl} mode="production" /> in measure mode only
    ├── analytics/
    │   ├── analyticsMode.ts      # NEW: parseAnalyticsMode(content) + readAnalyticsMode()
    │   ├── analyticsMode.test.ts # NEW
    │   ├── stripUrl.ts           # NEW: beforeSend helper, drops query + fragment
    │   └── stripUrl.test.ts      # NEW
    └── components/
        ├── PrivacyNotice.tsx # NEW: disclosure button + explanation
        └── Hero.tsx          # notice in footer and empty state when mode ≠ off

scripts/e2e/
├── lib.sh                    # blank WEB_ANALYTICS and VERCEL for the temp server
└── privacy-notice.sh         # NEW: runs with WEB_ANALYTICS=notice-only

vitest.config.ts              # blank WEB_ANALYTICS and VERCEL
docs/deployment.md            # WEB_ANALYTICS row + Web Analytics section
docs/architecture.md          # one sentence on the analytics mode and notice
docs/testing.md               # privacy-notice.sh entry
```

**Structure Decision**: the existing npm-workspace web app (`backend/`, `frontend/`). The mode is resolved once on the server and transported by the existing runtime-meta mechanism in `indexHtml.ts`. The frontend reads it like `cartoKey.ts` does. No new route, table or workspace.

## Delivery Order

1. **Gate** (R2): preview of current `main` serves `/_vercel/insights/script.js`. Stop if not.
2. Mode plumbing (backend + client parsing + tests), silent by default, so existing e2e checks remain green.
3. `<Analytics />` in `measure` mode + `stripUrl`.
4. `PrivacyNotice` + `privacy-notice.sh`; `impeccable` review; owner approves the copy.
5. Docs; set `WEB_ANALYTICS=on` in Vercel (Production and Preview); preview check (quickstart §4); merge.
6. Close PR #17 with a pointer to this spec (owner confirms).

## Risks

- **Gate fails** → feature stops (by design).
- **`VERCEL` not present in containers** → no effect, because `WEB_ANALYTICS=on` is set explicitly. Recorded at the gate.
- **Stray root `@vercel/analytics`** in the uncommitted root `package.json`/lockfile on this branch, from outside this plan → the owner decides whether to discard it before step 2. The dependency belongs in `frontend` only.
- **Copy and placement churn** → bounded by the contract and one `impeccable` pass.

## Complexity Tracking

None.
