# Decision: Temperature and wind across Singapore on the map

- **Slug**: temp-wind-map-layers
- **Decided**: 2026-11-19
- **Verdict**: go. Option B (one combined "Temperature & wind" layer), with **two checks that must pass before `/speckit-plan`** (see Verdict & Rationale).
- **Artifacts reviewed**: research.md | problem.md | concept.md (no intake.md; this is step 2 of `station-reading-map-layers`, which is the intake)

## Owner answers (2026-11-19)

- **Step 2 gate**: the owner uses the rain view (spec 011), so the condition "only if rain proves useful" is met.
- **Uses**: the owner ranks these four equally: comparing hotter and cooler places, wind before an activity, reading the signs of a storm alongside rain and lightning, and general curiosity.
- **Priority**: temperature and wind count equally, so they are treated as one problem.
- **Constitution (problem.md OQ1)**: the owner accepts a third Principle I exception on the same terms as lightning and rain.

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | adequate | The gap is real and observable: today you can't compare temperature or wind across the island, or check either for a place you haven't saved (problem.md). It is a missing feature, not a reported pain. The owner wants it for four named uses. |
| Evidence strength | adequate | The data facts are measured, not assumed. A live check on 2026-11-19 confirmed the one-minute cadence, that the latest reading is complete, that there are 17 stations and that a fetch costs 3 requests (research.md). Demand rests on the owner alone, which was enough for fewer than 5 launch users in the WBGT and rain decisions. Still unverified: whether the value holds with only 17 points, which becomes a check below; the station count was seen only once; and only a calm morning was sampled. |
| Value vs. inaction | adequate | Doing nothing breaks nothing, and the per-place tiles already show temperature and wind (problem.md Cost of Inaction). But you then can't check wind or temperature for a place you haven't saved, and the storm picture on the map is incomplete. The cost is small and the first step is a cheap test. |
| Feasibility / appetite | strong | Small (about a week). Spec 011 already provides the on-demand endpoint, shared cache, stale fallback, Layers menu and status strips. The data is simpler than rain: one latest reading per endpoint, no window and no paging (concept.md Option B). |
| Strategic fit | strong | It serves the public release (memory `public-mobile-release`). The owner has accepted the amendment on lightning and rain's terms. Principles II, III and V are unaffected if the logic stays in pure `.ts` modules and colours come from theme tokens. It follows the step, gate, step pattern that worked twice. |
| Risk posture | adequate | The risks are named and each has a mitigation or check: sparse coverage (mock-up), a third layer crowding the menu (mock-up, and separate switches remain an option), rate budget (3 requests per shared 2-minute window, fewer than 5 users), and the rabbit holes on colour scales and arrow design (plain text labels first). Still open: station-count stability, the size of the spread in the afternoon, and the licence and attribution terms (OQ8, carried from step 1). |

## Verdict & Rationale

**Go, for Option B.** Problem validity and evidence are both adequate, the appetite is small, the owner has accepted the amendment, and the concept reuses a pattern that is already built. Option C was rejected because the data would be stale and an amendment would probably still be needed. Option A stays as the fallback.

The go is conditional, because two cheap checks could still end or reshape the idea. Both must pass before `/speckit-plan` starts:

1. **Mock-up check.** The owner reviews a throwaway mock-up (not committed) showing the 17 stations, each with a temperature and a wind arrow. It covers the 375 px card map and the full-screen map at 375 px and 1280 px, in at least two themes, with rain on too, and includes at least one station with no reading. Use the real station positions and values from the 2026-11-19 sample.
   - **If the owner judges 17 points not worth showing**, the verdict becomes **kill** (Option A), with the mock-up recorded as the reason.
   - **If one combined layer is too busy**, splitting temperature and wind into two switches is back in scope.
2. **Second live sample.** One more live check in the afternoon (about 13:00–16:00 SGT), using the same 3 latest calls, outside the app, without a key. It confirms that the station count and IDs are stable (including S199, which has no name), that the latest call still returns a complete reading, and the temperature spread at the hotter time of day.
   - **If the station count drops sharply or the latest reading is often incomplete**, return to `/speckit-assess-shape`.

## If needs-clarification

- Not applicable. The two checks above are gates inside specification.

## If go: Handoff to `/speckit-specify`

- **Problem**: people using the app see temperature and wind only at the station nearest each saved place. They can't compare places across the island, check wind somewhere unsaved, or read wind and cooling next to rain and lightning as a storm comes in.
- **Chosen approach**: concept.md Option B. One "Temperature & wind" layer on the card map (in the Layers menu) and on the full-screen map (beside rain and lightning).
  - It is off until the user asks for it.
  - Each of the about 17 stations shows its temperature and a wind arrow with direction and rough strength.
  - Stations without a reading are clearly marked as missing.
  - The time of the readings is shown.
  - One fetch is 3 latest-reading requests, cached on the server for at least 2 minutes and shared by all viewers.
  - It falls back to "unavailable" or stale data without affecting the rest of the app.
  - Nothing is fetched on page load.
  - It needs a Principle I amendment on lightning and rain's terms.
  - The first two pieces of work are the mock-up check and the second live sample described above.
- **In scope**:
  - the layer on both maps, on every theme, down to 375 px, and working alongside rain and lightning;
  - freshness, missing and stale states;
  - the constitution amendment.
- **Out of scope**:
  - separate temperature and wind switches, unless the mock-up calls for them;
  - humidity, UV, PSI and WBGT;
  - values estimated between stations, heat maps, isotherms and streamlines;
  - forecasts, storm predictions, alerts and push notifications;
  - history, or keeping readings across fetches;
  - storing readings in SQLite or in any snapshot;
  - any fetch on page load;
  - changes to the per-place tiles, the rain view or the lightning layer, other than sharing the Layers menu and the status-strip area;
  - sources other than NEA, and a Production key.
- **Success metrics**:
  - The owner can answer "where is it hottest or coolest now?" and "which way is the wind blowing near X, and how hard?" from the app alone (qualitative).
  - No reading is shown as current when it is older than one minute plus the observed 3–4 minute lag plus the cache window, and the age shown matches the source timestamp.
  - Every station shows a value or is clearly marked as missing.
  - Saved-place refresh stays at about 10–15 s with no increase in 429 responses.
  - It is readable at 375 px on every theme with rain and lightning on.
  - The owner still uses it after a couple of weeks (qualitative).
- **Carried-forward open questions**:
  - Settled by the second live sample: is the station count stable, and how large is the afternoon spread?
  - How far from a station a reading still describes a place. WBGT uses 10 km; decide in the spec whether to show distance, or nothing, given that stations are a median 5.7 km apart.
  - Wind display: arrow pointing *from* or *to*, and whether to show speed in knots or km/h. Keep it simple and follow the convention the per-place tile uses.
  - Whether temperature needs colour or just text labels. Prefer text first and add per-theme tokens only if the mock-up shows a need.
  - How labels avoid colliding with rain dots at nearby stations and with saved-place pins at card size.
  - Which waits when three high-priority layers and a location refresh share the queue.
  - OQ8, carried from step 1: the data.gov.sg licence and attribution wording for showing NEA data publicly.
  - Any demand from users other than the owner.

## Gate 2: afternoon sample (2026-11-19)

**Passed.** Three latest-reading requests were made at 13:40 SGT, without a key and outside the app.

- **Stations**: the same 17 station IDs as the morning sample for each measure, with none added or dropped. S199 still has no name.
- **Completeness**: the latest reading was complete, with 17 of 17 rows for each measure.
- **Temperature spread**: 26.2–28.0 °C (1.8 °C) at 13:33. That is no wider than the morning's 2.2 °C, which suggests the spread is narrow on an overcast day. One wet rain station was seen at 13:25.
- **Wind**: 4.3–13.1 knots (8–24 km/h), all from 160–266° (S to W). Every station was in the "light" or low "moderate" range.
- **New finding, the delay**: the newest complete reading was 13:33–13:34 when requested at 13:40. That is 6–7 minutes old, longer than the 3–4 minutes seen in the morning. With the 2-minute cache, a healthy reading can be about 9 minutes old, so the spec's 10-minute out-of-date threshold is too tight. Planning should raise it (15 minutes is suggested), as was done for rain.

## Gate 1: mock-up (2026-11-19)

**Accepted with one change.** The verdict stays **go**, for the **full-screen map only**. The owner reviewed a throwaway mock-up (not committed; `e2e-artifacts/temp-wind-mockup/`). It used the real 13:33–13:34 readings and the 17 real station positions, with rain on, in the `apple` and `radar` themes, on the card map at 375 px and the full-screen map at 375 px and 1280 px. The basemap tiles didn't load in the mock-up because the CARTO key is limited to certain web addresses, but the stations, labels and controls were real.

- **The card map at its normal zoom showed one station**, the nearest, which repeats the per-place tiles. Zoomed out, the 224 px card was crowded. So the card map, its Layers menu and its status strip are left unchanged.
- **Full screen** was readable at 375 px and clear at 1280 px, so the layer goes there, beside rain and lightning.
- To fix during the build: the dashed "no wind" ring was hard to spot, and a couple of labels overlapped in the west at 375 px.
- These changes are recorded in `specs/015-temperature-wind-layer/spec.md` (Clarifications, US4, FR-001, FR-008, FR-009, FR-017, SC-007).
