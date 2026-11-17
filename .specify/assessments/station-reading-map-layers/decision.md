# Decision: Island-wide rain view, first of the station-reading map layers

- **Slug**: station-reading-map-layers
- **Decided**: 2026-11-17
- **Verdict**: go. Option B, rain first, with **two checks that must pass before `/speckit-plan`** (see Verdict & Rationale).
- **Artifacts reviewed**: research.md | problem.md | concept.md (no intake.md; intake was skipped)

## Owner answers (2026-11-17)

These answers settle `problem.md` Open Questions 1, 2 and 4, and Question 5 in part.

- **Priority (OQ2)**: rain first. Temperature and wind come in step 2, and only if rain proves useful.
- **Stations vs radar (OQ5)**: unsure. The owner wants to see a mock-up of the station points on the 375 px card map first.
- **Constitution (OQ4)**: the owner accepts a second Principle I exception, on the same terms as lightning.
- **Launch scale (OQ1)**: a handful of users (fewer than 5). The Development key is expected to hold, as in the hosting decision's "fine below 5 visitors".

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | adequate | The gap is real and observable: today the app can't answer "where has it rained in the last 15 minutes?" (problem.md). It matters for the planned public release, but it is a missing feature, not a reported pain. |
| Evidence strength | adequate | Data shapes, query parameters, rate limits and code precedents are cited from the official OpenAPI specs and the repo (research.md, high confidence). Demand rests on the owner alone. That is enough for a launch of fewer than 5 users, as it was for the WBGT decision. Two load-bearing points are unverified: whether the 15-minute rain window can be fetched cheaply (documented but never tried live), and whether station points satisfy users next to myENV (owner unsure). Both become checks below, not assumptions. |
| Value vs. inaction | adequate | Doing nothing breaks nothing and costs no rate budget (problem.md Cost of Inaction). But it leaves the app unable to replace myENV for the question switching users ask most. Option B is small, and step 1 is a cheap test of whether the value is real. |
| Feasibility / appetite | adequate | Step 1 is small to medium (about 1–2 weeks) and reuses the lightning pattern: on-demand fetch, shared cache, stale fallback, nothing fetched on page load. It costs about half the requests of all three readings, so the under-5 s target is reachable. It is rated adequate rather than strong because the appetite depends on the untested 15-minute query (concept.md Assumption 1). |
| Strategic fit | strong | It serves the public release (memory `public-mobile-release`). The owner has accepted the Principle I amendment on lightning's terms. Principles II, III and V are unaffected if the new logic is pure `.ts` and the colours come from theme tokens. It follows the same "step 1, gate, step 2" approach that worked for WBGT. |
| Risk posture | adequate | The main risks are named and each has a mitigation or a check: rate budget (rain-only scope, shared cache, fewer than 5 users), queue contention with saved-location refreshes (to settle in planning), "missing" looking like "dry" (a spec requirement), the 15-minute query (live test), and stations vs radar (mock-up). Still open: how far one key stretches if launch grows past a handful of users, and the licence and attribution terms (OQ8). |

## Verdict & Rationale

**Go, for Option B step 1 (rain only).** The problem and evidence are both adequate, the owner's answers remove the two choices that pointed elsewhere (rain first rules out C; accepting the amendment rules out A), and the appetite is small.

The go is conditional because two unknowns could each still end the idea. They are cheap to settle early in specification and must pass before `/speckit-plan` starts:

1. **Live query check.** A one-off test confirms that the rain endpoint's documented `date` parameter returns the last 15 minutes of 5-minute readings in about 1–3 requests. **If it fails**, return to `/speckit-assess-shape`: the window or the appetite changes, and keeping readings across fetches stays excluded.
2. **Mock-up check.** The owner reviews a mock-up of about 88 rain station points on the 375 px card map and the full-screen map, including stations with no reading. **If the owner judges station points not worth it next to myENV's radar**, the verdict becomes **kill** (Option D), with this mock-up recorded as the decisive reason.

Step 2 (temperature and wind) proceeds only after step 1 ships and the owner judges it useful. Before step 2, confirm how often NEA updates temperature and wind (OQ7).

## If needs-clarification

- Not applicable. The two checks above are gates inside specification, not reasons to send the idea back to an earlier stage now.

## If go: Handoff to `/speckit-specify`

- **Problem**: people using the app see rain only at the station nearest each saved location, so they can't tell where in Singapore it has rained in the last 15 minutes. That matters for a public release that is meant to replace a mobile weather app.
- **Chosen approach**: concept.md Option B, step 1. An island-wide rain view on both the card map and the full-screen map.
  - It is off until the user asks for it.
  - It shows each station's rainfall over the last 15 minutes and roughly how heavy it was.
  - Stations without a reading are clearly marked as missing, never shown as dry.
  - The time of the readings is shown.
  - One fetch is cached on the server for a short time and shared by all viewers.
  - It falls back to "unavailable" or stale data without affecting the rest of the app.
  - Nothing is fetched on page load.
  - It is built on a Principle I amendment on the same terms as lightning.
  - The first two pieces of work are the live query check and the mock-up check described above.
- **In scope**:
  - the rain view on both maps, on every theme, down to 375 px;
  - freshness and missing-reading states;
  - the constitution amendment.
- **Out of scope**:
  - temperature and wind (step 2, gated);
  - humidity, UV, PSI and WBGT;
  - "rain moving toward you", alerts and push notifications;
  - forecasts, values estimated between stations, and radar imagery;
  - history, or keeping readings across fetches;
  - storing island-wide readings in SQLite or in a location's snapshot;
  - any fetch on page load;
  - changes to the saved-location tiles or the lightning layer;
  - non-NEA sources;
  - Production key and launch-scale traffic work.
- **Success metrics**:
  - On a showery day, a user can name where it has rained in the last 15 minutes using only the app (qualitative).
  - No rain reading shown is older than NEA's 5-minute interval plus the cache window, and the age shown matches the source timestamp.
  - Every station shows a value or is clearly marked as missing.
  - Turning the view on or off when its data is already loaded takes under 1 s.
  - Fresh data appears in under 5 s on a phone, with a loading state and the previous readings kept on screen. These time targets are the owner-recommended ones and still to be confirmed (OQ3).
  - No increase in 429 responses, and saved-location refresh stays at about 10–15 s.
  - It is readable at 375 px on every theme.
- **Carried-forward open questions**:
  - OQ3: confirm the time-to-view targets (under 1 s for the toggle, under 5 s for fresh data).
  - OQ5: settled by the mock-up check.
  - OQ6: settled by the live query check. Also check page size and order.
  - OQ7: how often NEA updates temperature and wind. Needed only for step 2.
  - OQ8: data.gov.sg licence and attribution wording for showing NEA data publicly.
  - OQ9: when a rain fetch and a saved-location refresh run at the same time, which waits in the shared request queue. To settle in planning.
  - From concept.md: how to show "how heavy" honestly, meaning rainfall bands, per-theme colours, and making "missing" look different from "0 mm".
  - From concept.md: how much of the view fits on the small card map compared with the full-screen map.

## Gate 1 (2026-11-17)

- **Passed.** One `rainfall?date=<today>` request returns the newest 25 five-minute readings, newest first, so the 15-minute window costs 1 request (2 just after midnight). The newest period fills in gradually, so the newest usable reading is normally about 10 minutes old. Details are in `specs/011-island-rain-view/research.md`.

## Gate 2 (2026-11-17)

- **Accepted with changes.** The verdict stays **go**. The owner reviewed a throwaway mock-up (not committed): about 87 real station positions with invented values, in the `apple` and `radar` themes, on the card map at 375 px and on the full-screen map at 375 px and 1280 px. Station points were judged worth building next to myENV's radar overlay. The required changes:
  - a single "Layers" control and one shared status strip on the card map;
  - the full-screen map opens at the card's view on a phone;
  - heavy is the strongest symbol in every theme;
  - a larger partial badge.
- They are recorded in `specs/011-island-rain-view/spec.md` (Clarifications) and in tasks T020, T021, T027, T029, T034, T036 and T056.
