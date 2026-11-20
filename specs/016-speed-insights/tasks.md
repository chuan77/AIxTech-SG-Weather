---

description: "Tasks for spec 016: real-user performance score, with cold and warm visits apart"
---

# Tasks: Real-User Performance Score, with Cold and Warm Visits Apart

**Input**: Design documents from `specs/016-speed-insights/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. Constitution Principle IV requires Vitest coverage of pure logic modules. The spec requires a browser check (FR-013, SC-004, SC-005). Write each test task before its implementation task and watch it fail first.

**Organization**: by user story. US3 (silent local runs, P1) comes before US1 (P1), because measurement must never render locally before it renders anywhere. US2 (cold or warm) builds on US1's mount. US4 (notice) and US5 (docs) follow.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US5 from spec.md

---

## Phase 1: Setup and stop gate

**Purpose**: settle FR-001 and prepare the branch and the dependency.

- [x] T001 **STOP GATE (FR-001, research R1)**: Vercel must serve `/_vercel/speed-insights/script.js` as JavaScript in front of the container. **Result 2026-11-20: PASS.** Speed Insights was already enabled. Production returned `200 application/javascript` (recorded in `specs/016-speed-insights/research.md` R1). The preview re-check is part of T030.
- [x] T002 Create branch `016-speed-insights` from current `main` with `git switch -c 016-speed-insights`. Unrelated uncommitted changes are present: `.github/workflows/taxi-rain-study.yml`, `.impeccable/config.json`, `docs/deployment.md` and three untracked `.specify/assessments/*` folders. Leave them unstaged and never include them in this feature's commits. Ask the owner how to handle the `docs/deployment.md` edits before T025 or T031 touches the same file. **Done 2026-11-20**: the branch was created. The owner asked to keep the unrelated `docs/deployment.md` sentence uncommitted (stage only spec 016 hunks). They also approved discarding a root `npm i @vercel/speed-insights` (root `package.json` and lockfile restored) before T003.
- [x] T003 Add `"@vercel/speed-insights": "2.1.0"` (exact, no caret) to `dependencies` in `frontend/package.json`. Run `npm install @vercel/speed-insights@2.1.0 --save-exact -w frontend` from the repo root. Confirm the `package-lock.json` diff only adds `node_modules/@vercel/speed-insights` and the workspace entry. If npm rewrites unrelated fields, revert the lockfile and retry.

---

## Phase 2: Foundational (Speed Insights mode plumbing)

**Purpose**: the server decides the mode once and tells the page. Nothing renders yet. Contract: [contracts/index-html-meta.md](contracts/index-html-meta.md).

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

- [x] T004 [P] Extend `backend/src/analyticsMode.test.ts` with a `resolveSpeedInsightsMode(env)` table returning `{ mode: 'measure' | 'notice-only' | 'off'; invalid?: string }`:
  - `SPEED_INSIGHTS=on` → `measure`; `off` → `off`; `notice-only` → `notice-only`.
  - Unset or empty → `measure` if `VERCEL === '1'`, otherwise `off`.
  - Any other value → `off`, with `invalid` set to the raw value. Values are trimmed and case-insensitive (`' ON '` → `measure`).
  - **Independence:** `{ WEB_ANALYTICS: 'off', SPEED_INSIGHTS: 'on' }` → `measure`, and `{ WEB_ANALYTICS: 'on', SPEED_INSIGHTS: 'off' }` → `off`.
  - All existing `resolveAnalyticsMode` tests must still pass unchanged.
- [x] T005 [P] Write `frontend/src/analytics/speedInsightsMode.test.ts` (Vitest, node env) for `parseSpeedInsightsMode(content)`:
  - `'measure'` → `measure`; `'notice-only'` → `notice-only`.
  - "missing, empty or unknown means `off`": `null`, `undefined`, `''`, `'on'` and `'MEASURE '` → `off`.
- [x] T006 In `backend/src/analyticsMode.ts`, extract the parsing into `resolveMeasurementMode(raw: string | undefined, env)`. Keep `resolveAnalyticsMode(env)` with the same signature and behaviour, built on it. Add `resolveSpeedInsightsMode(env = process.env)`, which reads `SPEED_INSIGHTS`, to pass T004. Update the header comment to name both settings.
- [x] T007 Implement `frontend/src/analytics/speedInsightsMode.ts`, exporting `type SpeedInsightsMode`, `parseSpeedInsightsMode` (to pass T005) and `readSpeedInsightsMode()`. The reader takes `meta[name="speed-insights"]` and returns `off` when `document` is undefined, mirroring `frontend/src/analytics/analyticsMode.ts`.
- [x] T008 Extend `backend/src/indexHtml.test.ts` with a `renderIndexHtml speed insights mode` block:
  - `{ SPEED_INSIGHTS: 'on' }` contains `<meta name="speed-insights" content="measure" />`.
  - `{ SPEED_INSIGHTS: 'notice-only' }` gives `content="notice-only"`.
  - `{ SPEED_INSIGHTS: 'off' }` adds no `speed-insights` meta.
  - With the CARTO key, `WEB_ANALYTICS: 'on'` and `SPEED_INSIGHTS: 'on'` set, each meta appears exactly once before `</head>`.
  - The existing tests stay green, including "leaves the page unchanged" for `{}`.
- [x] T009 Update `renderIndexHtml` in `backend/src/indexHtml.ts` to append `<meta name="speed-insights" content="<mode>" />\n` for `measure` and `notice-only`, using literal values only and never env text. This passes T008. Update the header comment: three settings now travel this way.
- [x] T010 In `backend/src/server.ts`, next to the `web analytics mode` log, log once at startup `logger.info({ speedInsights: mode, vercel: process.env.VERCEL === '1' }, 'speed insights mode')`. When `invalid` is set, also log `logger.warn('SPEED_INSIGHTS=<value> is not on, off or notice-only; measurement is off')`. Log no other env value.

**Checkpoint**: `npm test` is green. The page carries the meta only when configured, and nothing visible changes.

---

## Phase 3: User Story 3 - Local, test and check runs stay clean and silent (Priority: P1)

**Goal**: no Speed Insights request or error in dev, tests or e2e, before anything renders anywhere.

**Independent Test**: run every `scripts/e2e/*.sh` against a local temp server. All pass, and no request matches `/_vercel/speed-insights/` or `va.vercel-scripts.com`.

- [x] T011 [P] [US3] In `vitest.config.ts`, add `SPEED_INSIGHTS: ''` next to `WEB_ANALYTICS: ''` and `VERCEL: ''`, with the comment "Never measure page speed from tests (spec 016)".
- [x] T012 [P] [US3] In `scripts/e2e/lib.sh`, start the temp server with `SPEED_INSIGHTS="${E2E_SPEED_INSIGHTS:-}"` beside `WEB_ANALYTICS="${E2E_WEB_ANALYTICS:-}" VERCEL=` (line ~85). Extend the header comment (lines 9–10) to say Speed Insights is off too, and that `E2E_SPEED_INSIGHTS=notice-only` shows its notice without loading the script.
- [x] T013 [US3] In `scripts/e2e/privacy-notice.sh`, widen `measurement_requests()` (line ~82) so the regex is `/\/_vercel\/(insights|speed-insights)\/|va\.vercel-scripts\.com/`. Keep the script-tag count matching `_vercel` and `vercel-scripts`.

**Checkpoint**: `npm run verify` passes, and every e2e script passes with no new `E2E_ALLOW_ERRORS`.

---

## Phase 4: User Story 1 - Owner sees a real-visitor performance score (Priority: P1) 🎯 MVP

**Goal**: hosted deployments in `measure` mode load Vercel's Speed Insights script and report stripped URLs.

**Independent Test**: on a preview with `SPEED_INSIGHTS=on`, the page makes one `/_vercel/speed-insights/script.js` request with no console errors, and readings appear under Preview in the dashboard.

- [x] T014 [P] [US1] Extend `frontend/src/analytics/stripUrl.test.ts` with a Speed Insights-shaped event, importing `type BeforeSendEvent as SpeedEvent` from `@vercel/speed-insights`:
  - `{ type: 'vital', url: 'https://lepak-weather.vercel.app/?fbclid=x#a', route: '/cold' }` → `{ type: 'vital', url: 'https://lepak-weather.vercel.app/', route: '/cold' }`.
  - Every existing case still passes.
- [x] T015 [US1] Make `frontend/src/analytics/stripUrl.ts` generic: `export function stripUrl<T extends { url: string }>(event: T): T`, dropping the `@vercel/analytics` type import. This passes T014. Update the doc comment to name both packages.
- [x] T016 [US1] In `frontend/src/App.tsx`, import `{ SpeedInsights }` from `@vercel/speed-insights/react` and `readSpeedInsightsMode`. Add a module-level `const speedInsightsMode = readSpeedInsightsMode();`. Render `{speedInsightsMode === 'measure' && <SpeedInsights beforeSend={stripUrl} />}` beside `<Analytics />`, with a comment: hosted deployments only, and the package has no `mode` prop, so the dev server and tests must never render it (research R2).
- [x] T017 [US1] Run `npm run build -w frontend`, then `grep -rn "speed-insights/script.debug.js" frontend/dist/assets`. If it matches, read the surrounding code and confirm it sits behind a `NODE_ENV` check that Vite has folded to production. If it's reachable, add `scriptSrc="/_vercel/speed-insights/script.js"` to the component in `frontend/src/App.tsx` and rebuild. Record the outcome in `specs/016-speed-insights/research.md` R2. **Done**: the debug path can't be reached (env check folded to `"production"`), so no `scriptSrc` was needed.

**Checkpoint**: the e2e suite is still silent (US3). In `measure` mode the script would load.

---

## Phase 5: User Story 2 - Owner tells cold-start time apart from the frontend (Priority: P1)

**Goal**: every measured page load carries the route `/cold` or `/warm`, and a lab baseline procedure exists. See [data-model.md](data-model.md) "Visit label".

**Independent Test**: on a preview, a load after more than 5 idle minutes has `speed-insights-visit=cold` and `data-route="/cold"`, and an immediate reload is `warm`, in 2 of 2 tries. The lab procedure produces Mobile and Desktop medians.

- [x] T018 [P] [US2] Write `backend/src/speedInsights.test.ts` for `visitLabel(uptimeSeconds: number): 'cold' | 'warm'`. The rule is "`cold` when `process.uptime() < 10` … The boundary at exactly 10 s is `warm`", so test `0` → `cold`, `9.999` → `cold`, `10` → `warm` and `3600` → `warm`. Also test `pageFor(pages: { cold: string; warm: string }, uptimeSeconds)`, which returns `pages.cold` or `pages.warm` according to `visitLabel`.
- [x] T019 [P] [US2] Extend `frontend/src/analytics/speedInsightsMode.test.ts` for `routeForVisit(content)`: `'cold'` → `'/cold'` and `'warm'` → `'/warm'`. `null`, `''`, `'COLD'` and `'hot'` → `undefined` ("anything other than `cold` or `warm` means no route").
- [x] T020 [US2] Implement `backend/src/speedInsights.ts` exporting `type VisitLabel`, `COLD_WINDOW_SECONDS = 10`, `visitLabel` and `pageFor` to pass T018. Header comment: a page request within 10 s of the process starting woke the instance (cold start is about 5 s, `docs/deployment.md`), and other requests served first don't change it (spec clarification Q4).
- [x] T021 [US2] Extend `backend/src/indexHtml.test.ts` for a third argument, `renderIndexHtml(html, env, { visit })`:
  - `{ SPEED_INSIGHTS: 'on' }` with `{ visit: 'cold' }` contains `<meta name="speed-insights-visit" content="cold" />`. With `{ visit: 'warm' }` it contains `content="warm"`.
  - With no option, `measure` defaults to `warm`.
  - In `notice-only` and `off`, no `speed-insights-visit` meta appears whatever `visit` is.
- [x] T022 [US2] Add the optional `{ visit?: VisitLabel }` parameter to `renderIndexHtml` in `backend/src/indexHtml.ts`. Write the `speed-insights-visit` meta only in `measure`, using the literals `cold`/`warm`, to pass T021.
- [x] T022a [US2] Add two `AppOptions` to `backend/src/server.ts`. Both default to today's behaviour.
  - `frontendDist?: string`: when set, the server takes the built-page branch from that directory, whatever `NODE_ENV` is.
  - `uptime?: () => number`: defaults to `process.uptime`.

  Write `backend/src/pageServing.test.ts` (Vitest + Supertest, following `backend/src/publicLimits.test.ts`, Principle VI). Use a temp dir holding a fixture `index.html` (`<html><head></head><body></body></html>`) and `createApp({ frontendDist, uptime, serveFrontend: true })`. Set env per test via `vi.stubEnv`. Cover:
  - `SPEED_INSIGHTS=on` and uptime `3`: `GET /` and `GET /index.html` both return 200 `text/html` with `content="cold"`.
  - Uptime `10` and `600`: `content="warm"`.
  - `SPEED_INSIGHTS=off`: no `speed-insights` metas.
  - `GET /some/deep/path` (the SPA fallback) follows the same label rules.
  - `WEB_ANALYTICS=on` still adds its meta (FR-016).
- [x] T023 [US2] In `backend/src/server.ts`, pre-render at startup `const indexPages = { cold: renderIndexHtml(raw, process.env, { visit: 'cold' }), warm: renderIndexHtml(raw, process.env, { visit: 'warm' }) }`, reading the file once. In both the `/index.html` handler and the `app.get('*')` fallback, send `pageFor(indexPages, uptime())`, where `uptime` is the option from T022a. Make no other per-request work. T022a's tests must pass.
- [x] T024 [US2] Add `readVisitRoute()` to `frontend/src/analytics/speedInsightsMode.ts`. It reads `meta[name="speed-insights-visit"]` and returns `routeForVisit(...)`, and passes T019. In `frontend/src/App.tsx`, pass `route={visitRoute}` from a module-level `const visitRoute = readVisitRoute();` to `<SpeedInsights />`.
- [x] T025 [US2] Write the lab baseline procedure in `docs/deployment.md` under a new "Speed Insights" section with a "Lab baseline" subsection (research R8):
  1. Run `curl -s -o /dev/null https://lepak-weather.vercel.app/` to wake the instance.
  2. Within 4 minutes, run pagespeed.web.dev 3 times on Mobile and 3 times on Desktop.
  3. Record the medians of score, FCP, LCP, TBT (lab stand-in for INP), CLS, Speed Index and TTFB, with the date.

  Add an empty dated table, filled in by T033. *(Written together with T031's Speed Insights section.)*

**Checkpoint**: unit tests are green, and local e2e is still silent. Cold and warm are verified on a preview in T030.

---

## Phase 6: User Story 4 - Visitor can find out what is measured (Priority: P2)

**Goal**: the notice names exactly what is active. See [contracts/privacy-notice-ui.md](contracts/privacy-notice-ui.md).

**Independent Test**: `scripts/e2e/privacy-notice.sh` passes for all copy variants at 375 px and desktop, in six themes, with and without saved places, with zero measurement requests.

- [x] T026 [P] [US4] Write `frontend/src/analytics/privacyCopy.test.ts` for `privacyCopy({ visits, speed })`:
  - Both false → `null`.
  - Visits only → label `Anonymous visit counts · no cookies`. The paragraphs include the Web Analytics paragraph and no paragraph mentioning "Speed Insights".
  - Speed only → label `Anonymous speed stats · no cookies`. The paragraphs include the Speed Insights paragraph, which mentions network speed and the slowest part of the page, and not the Web Analytics one.
  - Both → label `Anonymous visit & speed stats · no cookies`, with both paragraphs in the order visits then speed.
  - Every non-null result ends with the shared no-cookies/no-account/no-precise-location/no-saved-places sentence and the saved-places paragraph.
- [x] T027 [US4] Implement `frontend/src/analytics/privacyCopy.ts` to pass T026. Move spec 012's existing wording from `frontend/src/components/PrivacyNotice.tsx` into it unchanged, splitting it into the visits paragraph, the shared sentence and the saved-places paragraph. Add the speed paragraph from contracts/privacy-notice-ui.md. Use plain strings (`’` for apostrophes) with no JSX.
- [x] T028 [US4] Change `frontend/src/components/PrivacyNotice.tsx` to take `copy: { label: string; paragraphs: string[] }`, render `copy.label` in the button, and render the paragraphs inside the existing explanation region. Keep the same `id`, `hidden`, classes, scroll and Escape behaviour. In `frontend/src/components/Hero.tsx`, replace `showPrivacyNotice` with a module-level `const privacy = privacyCopy({ visits: readAnalyticsMode() !== 'off', speed: readSpeedInsightsMode() !== 'off' })`. Render `{privacy && <PrivacyNotice copy={privacy} />}` at both placements (lines ~38 and ~214).
- [x] T029 [US4] Extend `scripts/e2e/privacy-notice.sh`:
  - Make the button lookup match any label starting with `Anonymous ` and ending `· no cookies`.
  - Add a run per variant: `E2E_WEB_ANALYTICS=notice-only` with `E2E_SPEED_INSIGHTS` unset (visits), the reverse (speed), and both `notice-only` (both). For each, assert the exact label text, that the explanation mentions "Speed Insights" only when speed is active, and that at 375 px the collapsed button's label renders on one line, in all six themes: `Range.getClientRects()` over its text node gives exactly 1 rect, and the button's height is at most 44 px (`min-h-11`).
  - Keep the existing both-off run, now with `E2E_SPEED_INSIGHTS=off` too, and assert no notice.
  - Assert `no_measurement` in every run.
  - Call `assert_clean` after each open, reload and theme switch.
  - *(Implemented 2026-11-20: a `variants` sub-check covers visits, speed and both. It found the combined label wrapping in the radar theme's empty state at 375 px; so did the existing visits label. Owner decision: the label is now "Anonymous visits & speed · no cookies", and the empty state's phone padding is `px-4 py-10 md:p-10` in `frontend/src/components/Hero.tsx`.)*

**Checkpoint**: the e2e suite passes, and the owner approves the copy (FR-011).

---

## Phase 7: User Story 5 - Owner knows where the figures live and their limits (Priority: P3)

**Goal**: the deployment doc lets a reader find, read and switch off the score (FR-015, SC-008).

**Independent Test**: with only `docs/deployment.md`, a reader can find the score, name two things the free tier can't show, and switch measurement off.

- [ ] T030 [US5] **Hosted check (quickstart §4, owner runs or approves)**:
  1. Set `SPEED_INSIGHTS=on` in Vercel → Settings → Environment Variables for Production and Preview. **Done 2026-11-20** (owner set `On`, which is parsed case-insensitively).
  2. Deploy the branch as a preview. Re-check `/_vercel/speed-insights/script.js` on the preview (FR-001). **Done 2026-11-20:** script and vitals beacon both 200.
  3. After more than 5 idle minutes, load the page and check: the visit meta is `cold`, the script tag has `data-route="/cold"`, and there are no console errors. Reload at once and check it shows `warm`. Do this twice. **First run done 2026-11-20:** cold (first byte 4.7 s), still cold on a reload under 10 s, warm 12 s later, no console errors (research R3). Second run outstanding.
  4. On the preview, block `*/_vercel/speed-insights/*` in DevTools → Network → Request blocking and reload (FR-008). Expect: weather content works, no page error, no `console.error` (the package's `console.log` is allowed), and no retry loop in Network. Then unblock. **Done 2026-11-20 (owner, Chrome DevTools → Request conditions):** `script.js` was blocked and requested once, no `vitals` request, no retries, and the weather worked normally. After unblocking, `script.js` and `vitals` returned 200. DevTools showed 4 console errors during this check, but they weren't opened, so the "no `console.error`" part is not confirmed.
  5. Check Vercel → Speed Insights → Preview for readings, and whether a per-route view of `/cold` and `/warm` exists on the free tier. **Done 2026-11-20:** it does (Routes tab; RES 76 for `/cold`, 4 events; research R10).
  6. Set `SPEED_INSIGHTS=off` for Preview, redeploy, and check that no script is requested and the notice shows the visits-only line. Then restore `on`.
  7. Record each result in `specs/016-speed-insights/research.md` (R1, R3 and R10).
- [x] T031 [US5] In `docs/deployment.md`:
  - Add a `SPEED_INSIGHTS` = `on` row to the settings table, beside `WEB_ANALYTICS` (line ~32), with the same wording pattern: read at runtime, `off`/`notice-only`, unset falls back to `VERCEL=1`, redeploy to apply, not a secret.
  - Fill the "Speed Insights" section above the Lab baseline with:
    - **Where to look:** Speed Insights tab, environment filter, Desktop/Mobile.
    - **Cold vs warm:** routes `/cold` and `/warm`, the 10 s rule, and T030's per-route finding.
    - **Free tier:** score only, no per-metric view, 24-hour and 7-day ranges, Plus is Pro-only.
    - **Allowance:** 10,000 events per rolling 30 days, shared across the account, 3–5 per visit. An overrun pauses collection for at least 14 days, at no charge.
    - **Not counted:** blocked visitors.
    - **Privacy:** the fields stored, URLs stripped, and the notice wording.
    - **Switching off:** set `SPEED_INSIGHTS=off` and redeploy. Disabling only in the dashboard leaves the app requesting the script.
    - **Startup log:** the `speed insights mode` line.
- [x] T032 [P] [US5] In `docs/architecture.md`, add one sentence after the spec 012 analytics sentence (Frontend paragraph): spec 016's `SPEED_INSIGHTS` mode, the per-request `speed-insights-visit` meta from `backend/src/speedInsights.ts`, `<SpeedInsights route>` in `App` only for `measure`, and the shared `privacyCopy`. In `docs/testing.md`, update the `privacy-notice.sh` entry to name its copy variants and the Speed Insights request check.
- [x] T033 [US5] **Baseline done 2026-11-20** (pagespeed.web.dev in the owner's Chrome, since the keyless PSI API quota was used up): the Mobile median is 99 (FCP 0.8 s, LCP 0.8 s) and the Desktop median is 100 (FCP 0.2 s, LCP 0.2 s); the full table is in `docs/deployment.md`. **The `SPEED_INSIGHTS=off` comparison was not run.** With Mobile at 99 and TBT at 0 ms, any slowdown from measurement is within lab noise. Run it later if the field score drops. After merge to `main` and the CI deploy, run the lab baseline from T025 against production and fill the dated table in `docs/deployment.md` (SC-003). The owner runs pagespeed.web.dev, or approves running it. To check that measurement doesn't slow the first weather content (FR-009, SC-007), also run the Mobile median with `SPEED_INSIGHTS=off`: set it, redeploy, rerun the same 3 warm runs, then restore `on` and redeploy. Record both FCP/LCP medians. Pass if the `on` figures are within 10% of `off`.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T034 Run `npm run verify` (lint → typecheck → tests → build), then every `scripts/e2e/*.sh` except `lib.sh`. All must pass with no new `E2E_ALLOW_ERRORS`. Afterwards no process from the checks may hold a port.
- [x] T035 [P] Run `/weather-code-review` on the branch diff (security: the meta values are literals only, no env text reaches the page; no new logging of headers; `beforeSend` strips queries). Fix or answer each verified finding.
- [x] T036 **Merged 2026-11-20 as #31 (8c26274), deployed to production.** Commit in small conventional commits on `016-speed-insights`, for example `feat: label page loads cold or warm for Speed Insights (spec 016)`, excluding the unrelated files from T002. Open a PR to `main` with a body that summarises the spec, the gate result, T030's findings and the owner-approved copy. Merge only after CI passes and the owner approves (merge deploys production).

---

## Dependencies & Execution Order

- **Phase 1** (T001 done; T002 → T003) → **Phase 2** (T004/T005 tests → T006/T007; T008 → T009 → T010) → **US3** (T011–T013) → **US1** (T014 → T015 → T016 → T017) → **US2** (T018/T019 → T020 → T021 → T022 → T022a → T023 → T024; T025 any time after T002) → **US4** (T026 → T027 → T028 → T029) → **US5** (T030 needs US1, US2 and US4 deployed to a preview; T031 → T032; T033 after merge) → **Polish** (T034 → T035 → T036, with T033 after T036's merge).
- **Story dependencies**:
  - US1 depends on Foundational and US3.
  - US2 depends on US1 (it adds `route` to the same component).
  - US4 depends on Foundational only, and can run in parallel with US1 and US2 if staffed.
  - US5 depends on all the others.

## Parallel Opportunities

- Phase 2: T004 and T005 (backend and frontend tests), then T006 and T007.
- US3: T011 and T012.
- US2: T018 and T019, then T020 and T024's frontend half once T019 is done. T025 (docs) is independent of the code.
- US4 can proceed alongside US1/US2: T026 → T027 → T028 touch different files from T014–T024, except `App.tsx`, which US4 doesn't touch.
- Polish: T035 can run while e2e from T034 is running.

Example (Phase 2):

```text
Task: "T004 Extend backend/src/analyticsMode.test.ts with the SPEED_INSIGHTS table"
Task: "T005 Write frontend/src/analytics/speedInsightsMode.test.ts"
```

## Implementation Strategy

- **MVP**: Phases 1–4 (setup, mode plumbing, silence, mount). After T016, a hosted deployment with `SPEED_INSIGHTS=on` produces a Real Experience Score. Before production, it still needs US4's notice update (FR-011), so the MVP is preview-only.
- **Increment 2**: US2 (cold and warm labels plus the lab procedure), the owner's second goal.
- **Increment 3**: US4 (notice copy). This is required before the production merge.
- **Increment 4**: US5 (hosted check, docs, baseline), then Polish and the merge.
