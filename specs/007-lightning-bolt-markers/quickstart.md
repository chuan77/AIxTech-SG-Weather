# Quickstart: Themed Lightning Bolt Markers and Refresh Timing

How to prove the feature works. Contracts: [lightning-refresh-timing.md](./contracts/lightning-refresh-timing.md), [strike-marker.md](./contracts/strike-marker.md).

## Prerequisites

- `npm install` at the repo root.
- `npm run verify` passes (lint → typecheck → tests → build).

## 1. Automated tests

```bash
npm test
```

Expected to cover:
- Strike step, size and fill fraction for ages 0, 2, 30, 55, 59.9 and 60+ minutes; the step only changes at 5-minute boundaries.
- The bolt markup is a filled bolt, not the `thunder` glyph, and contains no literal colour.
- `Server-Timing` formatting and parsing round trip; a header with only `total` parses.
- The browser timing record from known timestamps (network, draw, total) and `served: "reused"`.
- `RequestStats` counts requests, pacing wait and a 429 retry (fake `fetchImpl`).
- `LightningTiming` for each way a call is served: `cache`, `shared`, `fetch`, `stale`, `error`.
- The route sends `Server-Timing` on 200 and on 502, with no URL or key in it.

## 2. A busy map in dev

```bash
LIGHTNING_FIXTURE=busy npm run dev
```

Open the app and press **Show latest lightning**.

- About 370 bolt marks appear across the region. Pins stay on top and stay clickable.
- Pan and zoom for 10 seconds: no visible stutter (SC-004).
- DevTools console has one `[lightning] refresh timing` record with all fields. Press Refresh again within 2 minutes, and a second record shows `served: "reused"`.
- The server log (`backend/logs/app.log`) has a `lightning refresh timing` line with `served: "cache"` or `"fetch"`.
- The Network tab shows the `Server-Timing` breakdown for `POST /api/lightning/refresh`.

## 3. Themes and legibility (SC-001, SC-002, SC-003)

```bash
LIGHTNING_FIXTURE=demo npm run dev
```

Add a saved location whose forecast shows a thunderstorm, or use a stubbed one. Then for each of the 6 themes, in the card and in full screen:

- The bolts use the theme's lightning colour, and switching theme recolours them with no new request.
- The strikes at 2, 30 and 55 minutes are in clear order; the 55-minute one is still findable.
- A bolt and the thunderstorm pin are obviously different marks.
- Contrast of the outline (or fill, on dark basemaps) against the basemap is ≥ 3:1. Check with a colour picker on a screenshot, or DevTools' contrast tool.

## 4. Scripted browser check

```bash
npm run verify && scripts/e2e/lightning-markers.sh [us1|us2|themes]
```

This starts its own temporary server and browser and tears both down on exit. It stubs the lightning response and asserts `assert_clean` after each open or theme switch. Don't point it at the `npm run dev` server on `weather-starter.localhost:1355`.

## 5. Real baseline (SC-006)

During a real storm, run `npm run dev` without a fixture, press Refresh, and copy the console record and the server log line. They show whether the wait was mostly `pacingWaitMs` and `providerMs` (getting the data) or `drawMs` (drawing). Note whether `WEATHER_API_KEY` was set.
