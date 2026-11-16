# Quickstart: validating lightning strike grouping

How to prove the feature works end to end. Details live in [contracts/](./contracts/) and [data-model.md](./data-model.md). The baselines come from `.specify/assessments/lightning-strike-grouping/diagnostics.md`.

## 0. Prerequisites

- On branch `009-lightning-strike-grouping`, `npm install` done.
- `backend/fixtures/lightning-storm-2026-11-16.json.gz` exists (37,242 strikes).
- `npm run verify` passes (lint → typecheck → tests → build). The browser checks below serve the built `frontend/dist`.

## 1. Unit and route tests (part of `npm test`)

```bash
npx vitest run frontend/src/components/map/lightningGroups.test.ts
npx vitest run frontend/src/components/map/lightningHelpers.test.ts
npx vitest run backend/src/lightningFixture.test.ts backend/src/routes/lightning.test.ts
```

Expected: group counts and labels, age labels, the splittable rule, mark diffing (add/remove/restyle), the count formatting "37,242", the storm fixture's determinism, and compressed responses all pass. See the contracts for exact cases.

## 2. Storm replay in development (US1, US2, US5)

```bash
LIGHTNING_FIXTURE=storm npm run dev    # restart dev after changing env
```

Open `http://weather-starter.localhost:1355`, scroll to the map, and press **Show latest lightning**.

- The status strip reads **"37,242 strikes in the last hour"**.
- Group marks cover Singapore. Each shows a count (for example "1.2k") and an age label. Recent groups look stronger than old ones.
- Tap a group in the **card**: fullscreen opens on that group.
- In fullscreen, select groups until single bolts appear. A bolt's popup shows type, time and minutes ago.
- Zoom to the deepest level on a group that won't split: its list popup appears.
- Switch through all 6 themes: marks recolour at once, with no new `lightning/refresh` request in DevTools → Network.
- DevTools → Console shows one `[lightning] refresh timing` record with `groups` and `bolts` set.

## 3. Normal volumes don't regress (US3, SC-006)

```bash
LIGHTNING_FIXTURE=demo npm run dev     # 3 strikes: three single bolts, newest largest
LIGHTNING_FIXTURE=busy npm run dev     # ~370 strikes: almost all single bolts at the default zoom
scripts/e2e/lightning-markers.sh       # spec 007 browser check must still pass
```

## 4. Storm-scale browser check (SC-001, SC-004 helpers, SC-008)

```bash
scripts/e2e/lightning-grouping.sh
```

The script starts its own temporary server (free port, throwaway database) and replays the fixture through an init script that replaces `fetch` for `/api/lightning/refresh`. It watches long tasks from before the first navigation and tears everything down on exit. It fails if:

- any action (layer on, pan, zoom, fullscreen open or close, theme switch, toggle, a 30 s age tick) has a main-thread task over **200 ms** (SC-001; baseline 15.1 s on load);
- the card map holds any lightning mark while fullscreen is open (FR-009);
- any runtime error or `console.error` appears (`assert_clean`);
- the JS heap with the storm shown is over **100 MB** (SC-008; baseline about 203 MB);
- the strip text isn't "37,242 strikes in the last hour".

## 5. Phone-class and timing checks (SC-002, SC-003, SC-007)

Use the chrome-devtools MCP (`--isolated`), or DevTools by hand, against a temporary production server with the replay injected as in §4:

1. **Phone stand-in**: set the CPU to 4× slowdown and repeat the §4 actions. No task may exceed **500 ms** (SC-002; baseline 8.5 s at 15K).
2. **Time to visible**: lightning appears within **2 s** of pressing the button (SC-003).
3. **Timing record**: record a performance trace of pressing the button. The console record's `drawMs` must be within **±20%** of the trace's time from response to the first frame showing the marks (SC-007; baseline 141 ms against 15.1 s).
4. **Bytes**: in the Network panel, the `lightning/refresh` response at storm volume is at most **1.5 MB** transferred (SC-005; expected about 545 KB gzip or about 335 KB brotli). You can also run `curl -s --compressed -o /dev/null -w '%{size_download}\n' -X POST <server>/api/lightning/refresh` against a dev server with `LIGHTNING_FIXTURE=storm`.

## 6. Real phone, once before release (SC-002)

Open a dev build with `LIGHTNING_FIXTURE=storm` on a mid-range phone about 3 years old (Android or iPhone) on the same network. Turn lightning on, pan, zoom, open and close fullscreen, and tap groups. Nothing should visibly freeze for more than about half a second, and the page must not reload or crash. Record the device and the result in the PR.

## 7. Six-theme legibility (FR-004, SC-004)

On each theme, with the storm shown:
- the group mark's outline stays visible on the basemap (3:1);
- count and age text are readable (4.5:1 between `--lightning-ink` and `--lightning`);
- the owner names the busiest area and the most recent area without opening a popup.

Record the contrast ratios beside the new tokens in `index.css`, as docs/theming.md does for the bolt.
