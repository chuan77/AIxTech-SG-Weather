# Quickstart: Validating Temperature and Wind on the Full-Screen Map

**Feature**: [spec.md](spec.md) | **Contract**: [contracts/temp-wind-refresh.md](contracts/temp-wind-refresh.md) | **Data model**: [data-model.md](data-model.md)

Run every command from the repo root.

**Warning**: `.env` holds the production Turso credentials (see project memory). Unset `TURSO_*` for any local run that touches the database. The e2e scripts already use a throwaway database.

## 1. Gate before calling it done

```bash
npm run verify    # ESLint → tsc → vitest → build; stops at the first failure
```

Expect new tests to pass in:
- `backend/src/tempWind.test.ts`
- `backend/src/routes/tempWind.test.ts`
- `frontend/src/components/map/tempWindHelpers.test.ts`
- `frontend/src/components/map/tempWindMarker.test.ts`

## 2. Look at every state locally (no live calls)

```bash
TEMP_WIND_FIXTURE=demo RAIN_FIXTURE=demo LIGHTNING_FIXTURE=demo npm run dev
```

Open http://weather-starter.localhost:1355 and go to full screen. Then check the following.

**First use**
- Before you act, the map shows no Temperature & wind stations, and the network panel shows **no** `/api/temp-wind/refresh` request (SC-009).
- Turn Temperature & wind on. The stations appear, and the legend opens once by itself.

**What each station shows**
- Every wind level appears, including "calm".
- A station with wind only shows "–°" with its arrow.
- A station with temperature only shows the crossed-out wind glyph.
- The station with no name is labelled "Station S199".
- An out-of-range value shows as "no reading".
- Selecting a station shows its name, its temperature, the wind as "N km/h, light, from SW (228°)", and the reading time.

**Card map**
- Close full screen. The card map's Layers menu has no Temperature & wind switch, and the card shows no stations (FR-001, FR-009).

**After a reload**
- Reload the page. On full screen the view shows as on, with the "Show latest temperature & wind" prompt and no request (US4 scenario 4).

**At 375 px**
- At 375 px wide (DevTools device mode), on every theme, with all three layers on:
  - the top-bar controls wrap onto a second row;
  - nothing covers the close button;
  - each station's temperature and arrow can be read (SC-007).

## 3. Browser check (scripted)

```bash
scripts/e2e/temp-wind.sh
```

It starts its own server on a free port with a throwaway database, stubs the route (it never calls data.gov.sg), and tears everything down on exit. It covers:

- user stories 1–5 on every theme at 375 px and 1280 px;
- `assert_clean` after each step;
- a check that the card map is unchanged.

## 4. Live check, once, with the owner's key

`npm run dev` must have no fixtures set and `WEATHER_API_KEY` set.

1. Turn the view on in full screen.
2. In DevTools, check that the `Server-Timing` header on the 200 response shows `requests 3`, and that the data appears in under 5 s (SC-005).
3. Press refresh again within 2 minutes. The header shows `served cache` and there are no new upstream calls (SC-008).
4. Check that the strip's time is the older of the temperature and wind times, and that its age is under 15 minutes.

## 5. Shared request budget (SC-006)

Do 5 overlapping runs. In each one:

1. Start a saved-place refresh.
2. Within 1 s, turn on (or refresh) rain and then Temperature & wind.

Record:
- the saved-place refresh time, which should be 10–15 s;
- the temperature and wind time to data, which should be under 5 s;
- the 429 count from the `refresh timing` log lines, which should be 0.

Write the results into this file under a "Results" heading, as spec 011 did.

## Results (2026-11-19)

Own temporary server, throwaway database with `TURSO_*` blanked, Development key, no fixtures.

### §4 Live check (T044, 21:27 SGT)

| Check | Result |
|---|---|
| First refresh | 200 in **1.85 s** (SC-005, under 5 s); `Server-Timing: requests 3`, served `fetch` |
| Repeat within 2 minutes | 200 in 0.002 s, served `cache`, **0** upstream requests (SC-008) |
| Stations | 19 (17 per measure): temperature only S24 and S80, wind only S108 and S199, S199 unnamed. Matches the 2026-11-19 samples |
| Reading age | temperature and wind both **3.4 min** (under the 15-minute threshold), `stale: false` |

### §5 Shared request budget (T045, SC-006)

One saved place; five runs about 2 minutes apart, each starting a saved-place refresh and, 0.2 s later, rain and temperature & wind together. Run 1 is from 21:28; runs 2–5 from 22:52 on a fresh server, after a bug in the test script (not the app) stopped the first sequence after run 1.

| Run | Saved-place refresh | Temperature & wind (3 requests) | Rain (1 request) |
|---|---|---|---|
| 1 | 13.4 s | 2.6 s | 3.4 s |
| 2 | 13.4 s | 2.5 s | 3.4 s |
| 3 | 13.4 s | 3.5 s | 0.8 s |
| 4 | 13.4 s | 2.5 s | 3.4 s |
| 5 | 13.4 s | 3.4 s | 0.7 s |

| Check | Result |
|---|---|
| 429 responses (SC-006) | **0** across all runs, no retries |
| Saved-place refresh with both layers overlapping (SC-006, 10–15 s) | **13.4 s** every run (spec 011 measured 12.5–13.2 s with rain and lightning) |
| Temperature & wind during a saved-place refresh (SC-005, under 5 s) | **2.5–3.5 s** |
| Rain alongside it | 0.7–3.4 s (unchanged target, under 5 s) |

All three success criteria checked here pass. Temperature & wind and rain share the high-priority lane, so whichever is queued second waits a few slots; neither misses its 5 s target.
