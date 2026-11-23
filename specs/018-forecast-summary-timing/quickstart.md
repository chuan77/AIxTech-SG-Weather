# Quickstart: Validate Forecast Timing and Rain

**Feature**: [spec.md](spec.md) | **Expected behaviour**: [contracts/forecast-display.md](contracts/forecast-display.md)

`scripts/e2e/forecast-timing.sh` and the tests named here are created during implementation.

## Prerequisites

- Run from the repo root, after `npm install`, with agent-browser on the PATH.
- No API key or network is needed. Every check uses fixed snapshots.
- If `.env` sets `TURSO_*`, `npm run dev` uses that hosted database, so blank those variables before validating with it. The scripts blank them themselves.

## 1. Rules (vitest)

```bash
npx vitest run frontend/src/components/forecastTiming.test.ts \
  frontend/src/components/periodLabel.test.ts \
  frontend/src/components/outdoorSummary.test.ts \
  frontend/src/theme/sky.test.ts \
  backend/src/weather.test.ts
TZ=America/Los_Angeles npx vitest run frontend/src/components frontend/src/theme
```

| Test group | Proves |
|---|---|
| Spec cases 1–9, each failing before the fix | SC-001, constitution IV |
| Every minute to the last window's end, on a fresh reading × five layouts × thunder in each period | SC-002, SC-004 |
| Every minute around each of the 48 2-hour windows, on a fresh reading | SC-002, SC-004 |
| Exact line for dry, rain, thunder, missing × 2-hour × current × later, at three fresh times | SC-003 |
| A period without wording keeps its position | FR-020 |
| Next-day, wrong-month and wrong-year labels | SC-006 |
| Second run in another time zone | Data-model invariant 5 |

## 2. Gate

```bash
npm run verify
```

It must pass before any browser check, which serves the built `frontend/dist`.

## 3. Browser

```bash
scripts/e2e/forecast-timing.sh          # or: us1 | us2 | themes
```

| Run | Steps | Expected |
|---|---|---|
| `us1` | Cases 1–5 and 9 at their times | Line, strip and `data-sky` match the spec table |
| `us1` boundary | Open case 3 at 11:59:55 and wait up to 65 s without reloading | All three change together within 60 s of midday, with no extra `/api` weather request |
| `us1` missing wording | An empty midnight period, the rest dry | No weather claim. That slot reads "Unavailable" with no icon. |
| `us1` stale | View a reading 3 hours or more later | "As of …", no "Now", calm sky |
| `us2` | Cases 6–8, the rain run, rain now with thunder later | The rain wording in the spec, in order |
| `themes` | Longest fresh and stale lines plus heat, UV and PSI, 360 px, six themes | No clipping or horizontal scroll. Screen-reader text in the same order. |

Every step ends with `assert_clean`. The script tears down its server, database and browser on pass or fail.

## 4. Regressions

```bash
scripts/e2e/temp-wind.sh
scripts/e2e/rain-view.sh
scripts/e2e/lightning-markers.sh
scripts/e2e/lightning-grouping.sh
scripts/e2e/privacy-notice.sh
scripts/e2e/installable-app.sh
scripts/e2e/uv-trend.sh
```

All pass. The first two have a taller top line, because their stub is "Showers" without a window. The lightning scripts stub thunder without one, so their sky becomes calm.

`npm test` also keeps the existing test of 12 provider calls per refresh (SC-007). `git diff --name-only --merge-base origin/main -- backend` must list only `backend/src/weather.ts` and `backend/src/weather.test.ts`, and `git ls-files --others --exclude-standard -- backend` must print nothing. Both hold whether or not the change is committed and after `main` moves.

## 5. By hand, after deploy

1. Refresh a place and compare the line and strip with NEA's current 2-hour and 24-hour forecasts.
2. Leave the page open across 6 am, midday, 6 pm or midnight: "Now" moves within a minute.
3. At about 23:45, refresh: this coming day's evening period is not labelled a day late.
4. Open a place saved before the deploy without refreshing it: it follows the same rules.

## Rollback

Revert the commit or promote the previous deployment (`docs/deployment.md`). There is no data to undo: older code accepts an empty `forecast` string and shows that strip slot without text.
