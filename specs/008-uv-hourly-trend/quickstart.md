# Quickstart: Today's UV Trend in the UV Tile

How to prove the feature works. Contracts: [api.md](./contracts/api.md), [ui.md](./contracts/ui.md). Data shapes: [data-model.md](./data-model.md).

## Prerequisites

- `npm install` at the repo root.
- Migration `0003_*` is generated (`npm run db:generate`) and committed.
- `npm run verify` passes (lint → typecheck → tests → build).

## 1. Automated tests

```bash
npm test
```

Expected to cover:
- **Backend** (`weather.test.ts`, fake fetch, no network):
  - A `uv` record with `date` and a newest-first `index[]` produces `uv_hourly` oldest first, with the right `date` and `as_of`.
  - `uv_index` is still `index[0]`.
  - A non-numeric value becomes `null`.
  - An empty `index` gives `readings: []`.
  - A failed `uv` call gives both fields `null`, and the rest of the snapshot is intact.
  - The refresh still makes the same number of provider calls.
- **Route** (`routes/locations.test.ts`, fake `weatherClient`): create and refresh responses carry `uv_hourly`, and `GET /api/locations` returns it after a round trip through SQLite. A row inserted without it reads `null`.
- **Frontend** (`uvTrend.test.ts`, pure):
  - 13 slots 07 → 19, and empty slots are `null`, never 0.
  - Bands at 2/3, 5/6, 7/8 and 10/11.
  - Direction for up, down and equal, skipping a missing hour, and none with one reading or on a previous day.
  - Count of readings ≥ 3; the spec example 0,0,1,3,5,7,6 gives 4.
  - The peak window flags 11 to 14 only.
  - All four states (unavailable, pre-feature, empty, readings).
  - A previous-day list gives the date label and no direction, judged against an injected `now`.

## 2. Live check against NEA (SC-002, SC-003)

```bash
npm run dev
```

Refresh a saved location in daylight, then compare the tile with the provider:

```bash
curl -s https://api-open.data.gov.sg/v2/real-time/api/uv | python3 -m json.tool | head -40
```

- Every filled slot matches `index[]` for that hour. Later slots are empty.
- The count equals the readings ≥ 3. The direction matches the last two readings.
- The server log shows the same number of provider requests per refresh as before (`backend/logs/app.log`).

## 3. States (SC-004, SC-005)

Use agent-browser with `network route` stubbing `GET /api/locations` (as `scripts/e2e/lightning-markers.sh` does), so no provider call is made. Stub one location per state:

| Stub | Expect |
|---|---|
| `uv_hourly` today, readings 07 → 09, `as_of` 09:11, refreshed at 09:30 | 3 filled slots, 10 empty, "as of 09:11" (from `as_of`, not the refresh time), direction shown |
| `uv_hourly.date` yesterday, 13 readings | "14 Nov · n h at UV 3+…", no direction, slots filled |
| `uv_hourly: { readings: [] }` | "No UV readings yet." |
| `uv_index: 5, uv_hourly: null` | value and band as before, plus "Hourly view appears after the next refresh." |
| `uv_index: null, uv_hourly: null` | "Unavailable", no hourly view |

After each view switch, call `assert_clean` (no page errors or `console.error`).

## 4. Themes and phone width (SC-006, SC-007)

For each of the six themes, at 360 px and at desktop width:

- On a phone, Rainfall, UV and Air Quality are each full width. At `lg`, Rainfall and UV share a row (two columns each) and Air Quality takes the next row, open or closed. No empty grid cells and no horizontal scroll.
- Every reported slot shows its number, and bar colours follow the theme's UV gauge. On Singapore Sky, bars sit on their band colour.
- The UV 3 line, the peak band and their labels are readable, and text contrast passes (DevTools contrast check).
- The current value, band label, gauge and the hero's "UV high" note (only at 6+) behave as before.

## 5. Teardown

Stop `npm run dev`. Browser checks run through `scripts/e2e/lib.sh` clean up their own server and sessions. Confirm no port is still held (`lsof -i -P | grep node`).
