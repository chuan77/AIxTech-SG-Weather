# Concept: Seeing current conditions across Singapore

- **Slug**: station-reading-map-layers
- **Created**: 2026-11-16
- **Recommended option**: Option B, "Rain first, then temperature and wind": two steps, with step 2 only if step 1 proves useful.
- **Inputs**: `problem.md`, `research.md` (no `intake.md`)

## Options

### Option A: Show what the last refresh already brought back

- **Sketch**: Each saved-location refresh already downloads every station's latest rain, temperature and wind reading, then discards all but the nearest one. Option A keeps those readings and shows them on the map as "conditions across Singapore at your last refresh", with that refresh time. Rain covers one 5-minute total, not 15 minutes. No new calls to data.gov.sg, and no new on/off action beyond showing or hiding the readings.
- **Appetite**: small (days).
- **Trade-offs**:
  - **Wins**: zero added load on the shared key, so the rate-budget and saved-location refresh metrics are untouched. It probably needs no constitution amendment, since the readings come from a call the rules already allow (to confirm, see Rabbit holes).
  - **Sacrifices**:
    - It fails the owner's **15-minute rain window** decision.
    - It fails **freshness**: readings are only as new as the user's last refresh, which could be hours old.
    - A user with no saved location sees nothing.
    - For a public user opening the app, "where has it rained in the last 15 minutes" is the question this cannot answer.
- **Rabbit holes**:
  - **Constitution wording.** Principle I's exception says island-wide data must not be stored in any location's `WeatherSnapshot`. Keeping all-station readings inside a snapshot may need its own reading of the rule, or an amendment after all.
  - **Several saved locations.** Each was refreshed at a different time, so it's unclear which refresh's readings to show.

### Option B: Rain first, then temperature and wind (recommended)

- **Sketch**: An island-wide rain view on both maps, built the same way as the lightning layer:
  - It is off until the user asks for it, then shows each station's rainfall over the last 15 minutes.
  - Stations with no reading are marked as missing.
  - The time of the readings is shown.
  - One fetch is shared by every viewer for a short while, so repeat views cost nothing.

  Temperature and wind come as **step 2**, added to the same view, only after the owner judges rain useful and the rate budget holds. This mirrors how WBGT was gated behind the outdoor-comfort tiles (`nea-data-new-features/decision.md`).
- **Appetite**: step 1 small to medium (about 1–2 weeks); step 2 small (days). It is a budget, not an estimate. It assumes the 15-minute rain query works as documented (see Assumptions). If it doesn't, step 1 grows or its rain window shrinks.
- **Trade-offs**:
  - **Wins**:
    - It answers the problem's most valuable question (where has it rained) first.
    - It costs about half the requests of all three readings, so the under-5 s fresh-data target and the "no more 429s" metric are most likely to hold.
    - It reuses a proven pattern (on-demand fetch, shared cache, stale fallback, prompt instead of loading on page open).
    - It gives a natural stop point if rain alone doesn't make the app worth using alongside myENV.
  - **Sacrifices**:
    - Temperature and wind arrive later, or not at all.
    - It needs a **Principle I amendment**, the second island-wide exception.
    - It adds load to the shared key, small per fetch and shared across viewers.
  - **Risks**:
    - Station points with gaps between them may look thin next to myENV's radar overlay (problem.md Open Question 5).
    - On a busy public launch, one Development key may still be the limit (Open Question 1).
- **Rabbit holes**:
  - **Building the 15-minute window.** If a point-in-time query doesn't return the needed readings, the fallback is paging through a whole day of data. The other fallback, remembering readings across fetches, drifts toward stored history, which the constitution forbids. Time-box this to the live test before specifying.
  - **Sharing the queue.** A rain fetch and a saved-location refresh at the same moment queue behind each other. Agreeing which one waits is easy to get wrong.
  - **Showing "how heavy" honestly.** Rainfall bands, the colours for each theme, and how "missing" differs from "0 mm" all need deciding. Missing must never look like dry.
  - **Second map surface.** The card map at 375 px is small, so it's unclear how much of the view fits there versus the full-screen map.

### Option C: All three at once

- **Sketch**: Same as B, but rain, temperature and wind ship together, with a way to switch between them on both maps.
- **Appetite**: medium (about 2–4 weeks).
- **Trade-offs**:
  - **Wins**: it meets every goal in one release, and there's only one round of amendment, design and theming work.
  - **Sacrifices**:
    - It costs 4–6 requests per fetch: about 2.7–4.4 s of paced waiting alone on the Development key, so the under-5 s target is at risk from the start.
    - It adds more load on the key at launch.
    - Temperature and wind barely vary across the island on most days (unverified), so the extra effort may buy little.
    - It's harder to tell which part made the app worth using.
- **Rabbit holes**: everything in B, plus:
  - Choosing what to show for wind: speed, direction or both. Direction needs its own symbol on every theme.
  - Temperature and wind may update every 30 s to 5 min. Matching freshness to each reading complicates the shared cache.
  - Three readings on the card map at 375 px.

### Option D: Do nothing, and point to myENV

- **Sketch**: Build nothing. Optionally say in the app that NEA's myENV shows rain across the island.
- **Appetite**: none to tiny.
- **Trade-offs**:
  - **Wins**: no rate-budget risk, no amendment, no added work before launch.
  - **Sacrifices**:
    - The app stays a saved-places dashboard.
    - Switching users likely keep myENV open alongside it, which undercuts the app's purpose as a replacement (problem.md Cost of Inaction).
    - Pointing users to a competitor makes that gap explicit.
- **Rabbit holes**: none.

## Recommendation

**Option B (rain first, gated step 2).**

- **It goes after the highest-value goal at the lowest cost.** "Where has it rained in the last 15 minutes" is the question most likely to keep switching users from opening myENV. The owner treats rain as the core case (the 15-minute rain decision). Rain alone costs roughly half the requests of Option C. That keeps the under-5 s fresh-data target and the "no more 429s, saved-location refresh stays at 10–15 s" metrics within reach on the Development key.
- **It fits the release plan**:
  - It follows the lightning pattern, which already satisfies Principle I's conditions (user action only, nothing on page load, shared cache, degrades to "unavailable").
  - The amendment is a known, small step.
  - The step-2 gate copies the WBGT approach that worked.
- **The alternatives fall short**:
  - Option A is cheaper but fails two owner decisions: the 15-minute window and "as fresh as NEA allows".
  - Option C risks the time-to-view target from the start.
  - Option D stays valid if Open Question 5 comes back "no" (station points aren't an acceptable answer next to myENV's radar). In that case decide should choose D, not B.

**What the recommendation depends on**:
- the owner's answer to problem.md Open Question 2 (rain first);
- Open Question 5 (station points are acceptable);
- the live test of the rain query (Open Question 6).

If Open Question 2 comes back "all three equally", C is the fallback, with the time target renegotiated.

## Out of Scope (for the recommended option)

- **Inherited from problem.md Non-Goals**:
  - humidity, UV, PSI and WBGT;
  - "rain moving toward you", alerts and push notifications;
  - forecasts, nowcasts, values estimated between stations, and radar imagery;
  - history or replay beyond the 15-minute rain window;
  - changes to the saved-location tiles or the lightning layer;
  - non-NEA sources such as PUB flood levels or dengue clusters;
  - getting a Production key or handling launch-scale traffic in general.
- **Newly excluded**:
  - Temperature and wind in step 1. They come in step 2, only if step 1 is judged useful.
  - Storing island-wide readings in SQLite or any saved location's snapshot, or keeping readings across fetches to build the 15-minute window.
  - Fetching anything on page load, including a first view of the map.
  - Per-viewer caching. All viewers share one cached fetch.

## Assumptions to Validate

1. **The 15-minute window is cheap.** The rain endpoint's documented `date` parameter returns enough recent 5-minute readings in about 1–3 requests. To validate: a one-off live test before `/speckit-specify` (research.md Gaps; problem.md OQ6).
2. **Rain matters most to switching users.** It matters more than temperature or wind. To validate: the owner answers problem.md OQ2. No user data exists [research.md: ASSUMPTION, low confidence].
3. **Station points are an acceptable answer to "where is it raining"**, next to myENV's radar overlay, even with gaps between stations. To validate: owner answers OQ5; a mock-up during specification shows 88 points on the 375 px card map.
4. **The Development key can absorb it.** One shared rain fetch every few minutes, on top of saved-location refreshes and lightning, stays within 12 requests per 10 s at expected launch traffic. To validate: owner answers OQ1 (users at launch). This depends on the single-container hosting plan, where pacing and caching are per instance.
5. **A Principle I amendment for a second island-wide exception is acceptable to the owner** on the same terms as lightning.
6. **A shared cache of a few minutes is fresh enough.** It rarely hides a new rain reading (NEA publishes rain every 5 min). Temperature and wind cadence only matter for step 2 (OQ7).
7. **Licence terms allow showing NEA data publicly** with attribution (OQ8, not yet checked).
