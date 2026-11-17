---

description: "Tasks for spec 012: anonymous visitor measurement with a privacy notice"
---

# Tasks: Anonymous Visitor Measurement with a Privacy Notice

**Input**: Design documents from `specs/012-vercel-web-analytics/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. Constitution Principle IV requires Vitest coverage of pure logic modules, and the spec (FR-007a, FR-011, SC-003/SC-004) requires a browser check. Write each test task before its implementation task and see it fail first.

**Organization**: by user story. US3 (silent local runs, P1) comes before US1 (P1) because measurement must never render locally before it renders anywhere.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4 from spec.md

---

## Phase 1: Setup and stop gate

**Purpose**: settle FR-001 before any code, and prepare the branch.

- [x] T001 **STOP GATE (FR-001, research R2)**. From a clean checkout of current `main`, have the owner run (or approve) a preview deploy: `npx vercel@65.9.0 deploy`, not `--prod`. Check the preview's Source tab has no `.env` or `*.db` files. Then fetch `<preview-url>/_vercel/insights/script.js`; if Vercel Authentication blocks it, use `npx vercel@65.9.0 curl` per the `vercel:access-protected-vercel-deployment` skill. **Pass** = JavaScript body. **Fail** = body starts with `<!DOCTYPE html>` (the app's page). Record the result, date and preview URL under a new "Gate result" heading in `specs/012-vercel-web-analytics/research.md` (R2). **On fail, stop all remaining tasks** and report back to `/speckit-assess-decide slug=vercel-web-analytics`. **Result 2026-11-17: PASS**: `application/javascript` served by Vercel (research.md R2, Gate result).
- [x] T002 Ask the owner whether to discard the uncommitted root change that adds `"@vercel/analytics": "^2.0.1"` to the root `package.json` dependencies, plus its `package-lock.json` changes (not made by this plan). Only with their yes, restore both files with `git restore package.json package-lock.json`. Leave them untouched otherwise and report. **Done 2026-11-17**: owner approved; both files restored (the lockfile diff held only the `@vercel/analytics` entry).
- [x] T003 Add `"@vercel/analytics": "2.0.1"` (exact, no caret) to `dependencies` in `frontend/package.json`, using `npm install @vercel/analytics@2.0.1 --save-exact -w frontend` from the repo root. Confirm the `package-lock.json` diff only adds `node_modules/@vercel/analytics` and the workspace entry. If npm rewrites unrelated `libc`/`dev` fields (as PR #17 did), revert the lockfile and retry with the project's npm version (`npm --version` vs. the lockfile's last author).

---

## Phase 2: Foundational (analytics mode plumbing)

**Purpose**: the server decides the mode once and tells the page; nothing renders yet. Contract: [contracts/index-html-meta.md](contracts/index-html-meta.md).

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

- [x] T004 [P] Write `backend/src/analyticsMode.test.ts` (Vitest) for `resolveAnalyticsMode(env)` returning `{ mode: 'measure' | 'notice-only' | 'off'; invalid?: string }`. Cover the table verbatim:
  - `WEB_ANALYTICS=on` → `measure` (any `VERCEL`)
  - `off` → `off`
  - `notice-only` → `notice-only`
  - unset or empty → `measure` if `VERCEL === '1'`, else `off`
  - "anything else → `off`", with `invalid` set to the raw value
  - values trimmed and case-insensitive (`' ON '` → `measure`)
  - `VERCEL='0'` or `'true'` with unset `WEB_ANALYTICS` → `off`
- [x] T005 [P] Write `frontend/src/analytics/analyticsMode.test.ts` (Vitest, node env) for `parseAnalyticsMode(content: string | null | undefined)`: `'measure'` → `measure`, `'notice-only'` → `notice-only`. "missing tag, empty content or any other value as `off`": `null`, `undefined`, `''`, `'on'`, `'MEASURE '` → `off`. Exact literals only, since the server writes exact literals.
- [x] T006 Implement `backend/src/analyticsMode.ts` exporting `type AnalyticsMode = 'measure' | 'notice-only' | 'off'` and `resolveAnalyticsMode(env: Record<string, string | undefined> = process.env)` to pass T004. Header comment: why `WEB_ANALYTICS` is explicit, and that `VERCEL=1` is only a fallback (research R3).
- [x] T007 Implement `frontend/src/analytics/analyticsMode.ts` exporting `parseAnalyticsMode` (pass T005) and `readAnalyticsMode()`, which reads `document.querySelector<HTMLMetaElement>('meta[name="web-analytics"]')?.content` (guard `typeof document === 'undefined'` → `off`), following `frontend/src/components/map/cartoKey.ts`.
- [x] T008 Extend `backend/src/indexHtml.test.ts`:
  - `renderIndexHtml(page, { WEB_ANALYTICS: 'on' })` contains `<meta name="web-analytics" content="measure" />\n</head>`
  - `{ WEB_ANALYTICS: 'notice-only' }` gives `content="notice-only"`
  - `{}` and `{ WEB_ANALYTICS: 'off' }` leave the page unchanged (the existing "unchanged" test must still pass)
  - with both `VITE_CARTO_API_KEY` and `WEB_ANALYTICS: 'on'`, both metas appear exactly once before `</head>`
  - `{ VERCEL: '1' }` alone gives `measure`
- [x] T009 Update `renderIndexHtml` in `backend/src/indexHtml.ts` to call `resolveAnalyticsMode(env)` and append `<meta name="web-analytics" content="<mode>" />\n` only for `measure`/`notice-only` (literal values, never env text), alongside the CARTO meta, to pass T008. Update the file's header comment.
- [x] T010 In `backend/src/server.ts`, in the production `serveFrontend` branch next to the `renderIndexHtml` call (line ~159), log once at startup: `logger.info({ webAnalytics: mode }, 'web analytics mode')`. When `invalid` is set, `logger.warn('WEB_ANALYTICS=<value> is not on, off or notice-only; measurement is off')`. Never log any other env value. *(Implemented: the info line also carries `vercel: true|false`, presence only, to answer research R2/R3.)*

**Checkpoint**: `npm test` green; the page carries the meta only when configured; nothing visible changes.

---

## Phase 3: User Story 3 - Local, test and check runs stay clean and silent (Priority: P1)

**Goal**: no measurement request or measurement-caused error in local dev, unit tests or browser checks (FR-004, FR-005, FR-011, SC-003, SC-004).

**Independent Test**: `npm run verify`, then every `scripts/e2e/*.sh` passes unchanged with no new `E2E_ALLOW_ERRORS`; the `npm run dev` page has no `web-analytics` meta and no request to `/_vercel/insights/` or `va.vercel-scripts.com`.

- [x] T011 [P] [US3] In `vitest.config.ts` `test.env`, add `WEB_ANALYTICS: ''` and `VERCEL: ''`, with a comment matching the TURSO one (dotenv doesn't override existing variables, so blanks win).
- [x] T012 [P] [US3] In `scripts/e2e/lib.sh` `e2e_start_server`, add `WEB_ANALYTICS="${E2E_WEB_ANALYTICS:-}" VERCEL=` to the server's env prefix (next to `TURSO_DATABASE_URL= TURSO_AUTH_TOKEN= DATABASE_REQUIRE_REMOTE=`), so checks default to `off` and a script can opt into `notice-only`. Document `E2E_WEB_ANALYTICS` in the header comment.
- [x] T013 [US3] After T020 lands, run `npm run verify`, then each existing check (`scripts/e2e/town-search.sh`, `lightning-markers.sh`, `lightning-grouping.sh`, `rain-view.sh`, `uv-trend.sh`, `use-my-location.sh`). All must pass with no new allowed errors. Save the summary lines in the PR description. **2026-11-17**: lightning-markers 37/37, lightning-grouping 41/41, rain-view 104/104, uv-trend 117/117, use-my-location 56/56 pass. town-search fails one check ("the chosen town is shown", expecting the text "Town: Sengkang"): that label was removed from the add form in `0afde7f` (2026-11-14), before this feature. The check is stale, not caused by spec 012; it is left for a separate fix.

**Checkpoint**: silence guaranteed. Any later task that breaks a check fails here.

---

## Phase 4: User Story 1 - Owner sees whether the public app is used (Priority: P1) 🎯 MVP

**Goal**: hosted deployments (production and preview) report anonymous page views to Vercel Web Analytics (FR-002, FR-003, FR-005, FR-006).

**Independent Test**: quickstart §4 steps 1–3. On a preview with `WEB_ANALYTICS=on`, `/_vercel/insights/script.js` loads, there are no console errors, and visits appear under the dashboard's **Preview** filter.

- [x] T014 [P] [US1] Write `frontend/src/analytics/stripUrl.test.ts` for `stripUrl(event)` (a `beforeSend` for `@vercel/analytics`, event shape `{ type: 'pageview' | 'event'; url: string }`):
  - `https://lepak-weather.vercel.app/?fbclid=x#a` → `url` `https://lepak-weather.vercel.app/`
  - path kept (`/foo?x=1` → `/foo`)
  - an unparsable url is returned unchanged
  - other fields untouched
  - never returns `null`
- [x] T015 [US1] Implement `frontend/src/analytics/stripUrl.ts` to pass T014. Import the `BeforeSendEvent` type from `@vercel/analytics/react` if it is exported, else declare the minimal shape locally. Use `new URL()` in a try/catch.
- [x] T016 [US1] In `frontend/src/App.tsx`:
  - import `{ Analytics } from '@vercel/analytics/react'`, `readAnalyticsMode` and `stripUrl`
  - compute the mode once at module scope (`const analyticsMode = readAnalyticsMode();`)
  - render `{analyticsMode === 'measure' && <Analytics mode="production" beforeSend={stripUrl} />}` inside `ThemeProvider`, after `StoreProvider`

  `mode="production"` is required: without it the package's auto mode can load `va.vercel-scripts.com` debug script (research R1). No other props.
- [x] T017 [US1] Local measure-mode smoke check (no network leaves the machine): `npm run build -w frontend`, start a temporary server per `scripts/e2e/lib.sh` conventions with `WEB_ANALYTICS=on`, and confirm the page has `<meta name="web-analytics" content="measure" />` and requests `/_vercel/insights/script.js` exactly once. Locally this returns `index.html`, the expected local-only error (PR #17's failure mode), which proves the conditional works. Tear the server down and confirm the port is free. Don't add this to the e2e suite.
- [ ] T018 [US1] Owner action (outward): in Vercel → lepak-weather → Settings → Environment Variables, add `WEB_ANALYTICS=on` for **Production** and **Preview**. Record it in the PR description; the value isn't secret.
- [ ] T019 [US1] Preview verification (quickstart §4 steps 2–4), owner approves the deploy:
  1. `npx vercel@65.9.0 deploy` from the feature branch.
  2. On phone and laptop: no console errors, `/_vercel/insights/script.js` 200 JavaScript, visit visible under the Analytics **Preview** filter. Note the startup log line `web analytics mode` and whether `VERCEL` was present (research R2/R3).
  3. Set Preview `WEB_ANALYTICS=off`, redeploy, confirm no script request and no notice, then restore `on`.

**Checkpoint**: MVP measurement works on a hosted preview. Production follows on merge.

---

## Phase 5: User Story 2 - Visitor can find out what is measured (Priority: P2)

**Goal**: a one-line, expandable privacy notice wherever measurement is active, including the empty state (FR-007–FR-010). Contract: [contracts/privacy-notice-ui.md](contracts/privacy-notice-ui.md).

**Independent Test**: `scripts/e2e/privacy-notice.sh` passes (notice-only mode, zero measurement requests); `impeccable` review done; owner approves the copy.

- [x] T020 [P] [US2] Create `frontend/src/components/PrivacyNotice.tsx`:
  - **Button**: a `button` with label "Anonymous visit counts · no cookies", `aria-expanded`, and `aria-controls` → explanation `id` (`useId`); `min-h-11`, `text-xs text-ink-muted`, hover `hover:text-white`, focus via the theme `--focus-ring` as other footer controls do.
  - **Explanation**: an explanation region rendered in place when expanded, containing the research R6 draft text verbatim (owner may edit). The contract requires these facts: page, linking site, country/region/city, device type, OS, browser, Vercel Web Analytics; no cookies, no account, no precise location, not saved places; daily reset.
  - **Escape**: Escape inside the explanation collapses it and focuses the button.
  - **Styling**: no literal colours (Principle V); if it is styled as a panel, add `rounded-card`. Local `useState(false)`, not persisted.
- [x] T021 [US2] In `frontend/src/components/Hero.tsx`, read the mode once (`readAnalyticsMode()` at module scope) and render `<PrivacyNotice />` when the mode is not `off`:
  1. in the empty-state early return, under the "Add a Singapore town…" `<p>`;
  2. in the selected-location `<footer>`, as its own line after the `Weather for {area}` `<p>`.

  It must not render when the mode is `off`.
- [x] T022 [US2] Create `scripts/e2e/privacy-notice.sh` (executable; modelled on `scripts/e2e/rain-view.sh`: `lib.sh`, `assert_clean` after every open/switch, `E2E_WEB_ANALYTICS=notice-only`, stub `GET /api/locations` with `agent-browser network route` so data.gov.sg is never called). Sub-checks `[us1|us2|themes|off]`:
  - **us1, empty state**: `[]` locations; the notice button is found by role and name; toggle by click, Enter and Space; `aria-expanded` flips; the explanation contains "no cookies" and "Vercel Web Analytics"; Escape collapses and returns focus.
  - **us2, selected location**: one stubbed location; the notice is in the footer after "Weather for"; same toggles. At 375 px it is one line collapsed, not covered by the phone dock, and the weather content's top doesn't move when it expands.
  - **themes**: all six themes, explanation text contrast ≥ 4.5:1 against its computed background.
  - **off**: restart with `E2E_WEB_ANALYTICS=off`; no notice button in either view.

  Every sub-check: zero Resource Timing entries matching `/_vercel/insights/` or `va.vercel-scripts.com`.
- [x] T023 [US2] Run `npm run verify`, then `scripts/e2e/privacy-notice.sh`. All sub-checks pass.
- [x] T024 [US2] Run the `impeccable` skill on the notice placement and expanded state at 375 px and laptop (empty state and selected location, `apple` theme plus one dark theme). Apply only material fixes within the contract, re-run T023, and record the outcome in the PR description. **Outcome 2026-11-17** (critique, 2 bounded rounds): (1) added a chevron cue (`ChevronUpIcon`, as in `LocationSwitcher`) since the line gave no sign it opens; (2) on phones the explanation opened below the fold behind the dock, so it now scrolls into view with `scroll-margin` = `--dock-height` (new e2e assertion); (3) the six-line explanation is left-aligned instead of centred. Placement (footer after the credit; empty state under the hint) kept. `privacy-notice.sh` 84/84.
- [x] T025 [US2] Owner approves the final collapsed label and explanation copy. Update `frontend/src/components/PrivacyNotice.tsx` and the R6 copy in `specs/012-vercel-web-analytics/research.md` if changed. **Approved as drafted, 2026-11-17.**

**Checkpoint**: notice complete and verified locally; on a preview (T019) it appears alongside measurement.

---

## Phase 6: User Story 4 - Owner knows where the figures live and their limits (Priority: P3)

**Goal**: FR-012 documentation.

**Independent Test**: from `docs/deployment.md` alone, a reader can name the dashboard, the 50,000/month shared cap and pause, the 1-month window, and the off switch.

- [x] T026 [P] [US4] In `docs/deployment.md`: add a Settings-table row `WEB_ANALYTICS` = `on` in Vercel Production and Preview env, read at runtime by `backend/src/analyticsMode.ts`, plus `off` (switch off) / `notice-only` (e2e only); unset falls back to `VERCEL=1`. Add a "Web Analytics" section covering:
  - where to view figures (Vercel → lepak-weather → Analytics, environment filter)
  - Hobby: 50,000 events/month shared across all projects on the account; after a 3-day grace period collection pauses until the next cycle, at no charge
  - 1-month look-back; no custom events or UTM
  - ad and content blockers aren't counted
  - turning it off with `WEB_ANALYTICS=off` + redeploy, and that disabling only in the dashboard leaves the app requesting the script
  - no cookies, and the privacy notice follows the setting
  - the T001 gate result
- [x] T027 [P] [US4] In `docs/architecture.md` Frontend paragraph: one sentence on the analytics mode (server meta `web-analytics`, `measure`/`notice-only`/`off`), `<Analytics />` only in `measure`, and `PrivacyNotice` in the Hero footer and empty state.
- [x] T028 [P] [US4] In `docs/testing.md` Browser checks list: add `scripts/e2e/privacy-notice.sh [us1|us2|themes|off]` (runs with `E2E_WEB_ANALYTICS=notice-only`, stubs locations, asserts zero measurement requests). Note that `lib.sh` and `vitest.config.ts` blank `WEB_ANALYTICS` and `VERCEL`.

---

## Phase 7: Polish & Cross-Cutting

- [x] T029 Run `npm run verify` and the full e2e set (T013 list + `privacy-notice.sh`) one last time. Confirm no leftover server process or browser session and no listening port from the checks.
- [x] T030 Run the `weather-code-review` skill on the branch diff. Focus: no env value other than the literal mode reaches HTML; no visitor data in logs; `VITE_` vars untouched; theme tokens only. Fix confirmed findings. **2026-11-17**: no findings. eslint, tests, both typechecks and the secrets scan pass; `npm audit --omit=dev` reports 2 low (katex via mermaid in the `docs` workspace, already there before this branch and unrelated).
- [ ] T031 Open the PR to `main` on `chuan77/AIxTech-SG-Weather` (`gh ... --repo chuan77/AIxTech-SG-Weather`), with: the gate result, T013/T023 summaries, the `impeccable` outcome, T019 preview evidence, and the env var set in T018. Merging deploys production via CI. After merge, check production visits under **Production** within 24 h (SC-001), and after a later deploy or cold start that earlier days remain (SC-002).
- [ ] T032 With the owner's confirmation (outward action), close draft PR #17 with a comment: "Superseded by spec 012 (`specs/012-vercel-web-analytics/`, PR <link>): measurement now runs only on hosted deployments, with a privacy notice. This PR loaded the script unconditionally, which failed the browser checks (`SyntaxError: Unexpected token '<'`)." Delete its branch only if the owner agrees.

---

## Dependencies & Execution Order

- **T001 gates everything.** On fail, stop.
- Setup (T002–T003) → Foundational (T004–T010) → US3 (T011–T012) → US1 (T014–T019) and US2 (T020–T025) → T013 (after US1+US2 code is in) → US4 (T026–T028, can start any time after T010) → Polish.
- US1 and US2 are independent in code (`App.tsx` vs `Hero.tsx`/`PrivacyNotice.tsx`). Both depend on Foundational (the mode) and US3 (silence).
- Owner/outward steps: T001, T002, T018, T019, T025, T031 (merge), T032.

## Parallel Opportunities

- Foundational: T004 ∥ T005 (tests), then T006 ∥ T007.
- US3: T011 ∥ T012.
- US1 ∥ US2 after US3: T014–T016 ∥ T020–T021.
- US4: T026 ∥ T027 ∥ T028.

Example: `T004 backend/src/analyticsMode.test.ts` and `T005 frontend/src/analytics/analyticsMode.test.ts` together, then `T006` and `T007` together.

## Implementation Strategy

1. **Gate (T001).** Cheapest possible no-go detection.
2. **MVP = Foundational + US3 + US1.** Measurement on hosted deployments, silent locally. It must not merge to production without US2: the owner requires the PDPA notice before public measurement.
3. **Release = MVP + US2 + US4**, verified on a preview (T019) with the notice visible, then merged.
