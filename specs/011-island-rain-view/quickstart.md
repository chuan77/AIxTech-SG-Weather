# Quickstart: validating Island-wide Rain on the Map

**Feature**: [spec.md](spec.md) | **Contract**: [contracts/rain-refresh.md](contracts/rain-refresh.md) | **Data model**: [data-model.md](data-model.md)

Run everything from the repo root. None of these checks may call data.gov.sg, except §6, which is optional and run once by hand.

## 0. Gate 2: mock-up review (before any feature code)

1. Open the throwaway mock-up (plan task 1): about 88 rain station symbols at real positions. It shows every level, dry, partial and "no reading", plus the key and status strip. It is drawn on:
   - the card map at 375 px;
   - the full-screen map at 375 px and at desktop width;
   - at least the `apple` theme and one dark theme (`radar`).
2. The owner decides:
   - **Accept**: continue with §1 onward.
   - **Reject**: stop. Record the verdict as kill in `.specify/assessments/station-reading-map-layers/decision.md`, with the mock-up as the reason.
   - **Accept with changes**: note the changes in spec.md Clarifications, for example a combined Layers menu or different thresholds.

## 1. Unit and route tests

```bash
npx vitest run backend/src/rain.test.ts backend/src/routes/rain.test.ts frontend/src/components/map/rainHelpers.test.ts
```

Expected: all pass, with no network access. The tests cover:
- parsing and the newest-usable-period anchor, skipping an incomplete newest period;
- sums and `periods_covered`, collapsing duplicate timestamps, and the midnight carry-over request;
- the 2-minute cache and shared in-flight load;
- stale fallback and 502 handling;
- levels at the boundaries (0, 0.2, 0.4, 0.6, 2.4, 2.5, 2.6 mm);
- coverage labels, the out-of-date rule (20 min) and status text;
- the on/off preference defaulting to off.

## 2. Full gate

```bash
npm run verify
```

Expected: lint, typecheck, tests and build all pass. A failing gate means the work is not done.

## 3. Local look with the fixture

```bash
RAIN_FIXTURE=demo npm run dev   # http://weather-starter.localhost:1355
```

1. Load the page. No rain request appears in the network log, and the Rain switch is **off**.
2. Turn Rain on. The loading state shows, then the stations appear with the key. The status reads "Rain at N stations · to HH:MM".
3. Tap a heavy, a partial and a "no reading" station. Each popup shows the name, total, level and period, or the note that applies.
4. Turn Rain off. The stations and key disappear, and pins and lightning are unchanged. Reload: the switch keeps its last state. If it was on, it shows the "Show latest rain" prompt and makes no request.
5. Open full screen. The same readings appear with no new request.

## 4. Browser check script

```bash
npm run verify && scripts/e2e/rain-view.sh [us1|us2|us3|us4|us5|themes]
```

The script stubs `POST /api/rain/refresh` with `agent-browser network route`, and runs `assert_clean` after every open, reload and view switch. It checks:
- **US1**: every stubbed station is drawn at its position; dry and wet look different; the popup content.
- **US2**: each level's symbol size and shape; the key lists every level.
- **US3**: "no reading" and partial symbols; the age text; the out-of-date label for a stub with `window_end` 25 min old or `stale: true`.
- **US4**: no request on load; off by default; toggle in under 1 s with data loaded (SC-004); the remembered state; card and full-screen maps share the data.
- **US5**: refresh keeps the earlier readings while loading; a 502 stub shows "unavailable" and keeps the earlier readings; saved locations and lightning still work.
- **themes**: all six themes at 375 px. The symbol contrast against the basemap is at least 3:1, and the key and strip text are at least 4.5:1.

## 5. Rate budget (SC-006, SC-008)

With the Development key on the server you started for this check (not the user's `npm run dev` database), run 5 overlapping saved-location refreshes while turning rain on and refreshing it. Check the server log:
- zero 429 responses;
- each `refresh timing` line is in the 10–15 s range;
- `rain refresh timing` shows `served: fetch` at most once per 2 minutes. Every other request shows `cache` or `shared`.

## 6. Live sanity check (optional, by hand, once)

On a showery day, with the Development key, turn Rain on in a dev server started without `RAIN_FIXTURE`. Compare a few stations' totals with the sum of the last three complete readings from one `rainfall?date=<today>` call. They should match, and the anchor time should be the newest period that holds about the full station count. This also confirms that wet values parse (research Gate 1, finding 4).

## Results: §5 rate budget (T057, 2026-11-17)

Own temporary server, throwaway database, Development key. One saved place; five runs about 2 minutes apart, each starting a location refresh and, 0.2 s later, rain and lightning together; then three more rain presses 20 s apart inside the 2-minute window.

| Check | Result |
|---|---|
| 429 responses (SC-006) | **0** across all runs (no retries) |
| Saved-location refresh with rain and lightning overlapping (SC-006) | **9.8–10.5 s**: within 10–15 s |
| Rain fetches per 2 minutes (SC-008) | **1** per run; every repeat press `served: cache` in about 0.02 s |
| Rain fresh data while a location refresh is running (SC-005) | **10.5–12.1 s: misses the 5 s target.** `pacingWaitMs` 10.4–12.0 s: the one rain request waits behind the location refresh's ~12 queued calls in the shared, first-come paced queue |

Research R6 expected rain to delay location refreshes, not the reverse. Rain alone (no refresh in flight) needs one paced request, about 1 s. Open decision: accept the overlap case, or let single-request island layers (rain, lightning) jump the queue, which would push a running location refresh back by about 1–2 s.

### Rerun with rain and lightning at high priority (2026-11-17, owner decision)

Same procedure, after `ProviderRequester` gained a priority lane (rain and lightning use `'high'`).

| Check | Before | After |
|---|---|---|
| Rain fresh data during a location refresh (SC-005, under 5 s) | 10.5–12.1 s | **0.6–1.7 s** |
| Lightning during a location refresh | 12.3–12.9 s | **2.3–2.6 s** |
| Location refresh with both overlapping (SC-006, 10–15 s) | 9.8–10.5 s | **12.5–13.2 s** |
| 429 responses | 0 | **0** |
| Rain fetches per 2 minutes (SC-008) | 1 | **1** (repeats from cache) |

All four success criteria checked here now pass.
