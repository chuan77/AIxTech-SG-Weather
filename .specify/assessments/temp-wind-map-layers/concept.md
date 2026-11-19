# Concept: Temperature and wind across Singapore on the map

- **Slug**: temp-wind-map-layers
- **Created**: 2026-11-19
- **Recommended option**: Option B, one combined "Temperature & wind" layer, gated on a mock-up check

## Options

### Option A: Do nothing

- **Sketch**: keep the map as it is, with rain and lightning only. Temperature and wind stay in each saved place's tiles. To check another spot, a user saves it.
- **Appetite**: none.
- **Trade-offs**:
  - Wins: no rate budget, no amendment, no extra crowding at 375 px.
  - Sacrifices every goal in `problem.md`. The owner has said they want all four uses, and rain met the step 2 condition [source: problem.md "Affected Users"].
- **Rabbit holes**: none.

### Option B: One combined "Temperature & wind" layer, fetched on demand (recommended)

- **Sketch**:
  - One new switch in the card's Layers menu and beside rain and lightning on the full-screen map.
  - When it is on, each of the about 17 stations shows its temperature and a wind arrow giving direction, with strength shown roughly.
  - A single status strip gives the time of the readings.
  - Stations with no reading are marked missing.
  - It behaves like rain: off until asked for, nothing fetched on page load, and one fetch cached briefly on the server and shared by all viewers. On failure it shows "unavailable" or a stale copy, and the rest of the map is unaffected.
  - The first piece of work is a throwaway mock-up of the 17 points on the 375 px card map and the full-screen map, with rain on as well. The owner judges whether the coverage is worth it.
- **Appetite**: small (about a week). It reuses the spec 011 pattern almost entirely, and the data is simpler than rain: one "latest" reading per endpoint, no 15-minute sum and no paging [source: research.md live findings 1–2].
- **Trade-offs**:
  - Wins:
    - one switch serves all four uses, matching the owner's "both equally";
    - one fetch costs 3 requests, about 1.8 s of pacing [source: research.md "Rate budget and timing"];
    - wind speed and direction share stations, so each pair is one mark [source: live finding 3];
    - the readings appear next to rain and lightning for storm context.
  - Sacrifices:
    - a third constitution exception;
    - another switch, strip and legend in a menu designed for two;
    - only 17 points, some offshore, so the view is sparse by nature.
  - Risks: the owner may find 17 points too thin when they see them, which the mock-up checks. A hot afternoon may show more spread than the calm morning sampled; if it doesn't, "compare" carries less weight.
- **Rabbit holes**:
  - **Temperature colour scales.** A per-theme colour ramp across 2 to 5 °C, readable on every theme and not by colour alone, can swallow the appetite. Plain numbers in labels may be enough.
  - **Wind arrow design.** The meteorological convention (wind comes *from* a direction), wind barbs versus arrows, and knots versus km/h are easy to over-polish.
  - **Distance honesty.** Shading or rings of influence around each station drift into estimating values between stations, which is a non-goal.
  - **Label collisions** with rain dots at the same or nearby sites, and with saved-place pins, at card size.
  - **Generalising the layer framework** into a plugin system for "any station reading", which is not needed for one more layer.

### Option C: Show readings from the last saved-place refresh (no new fetch)

- **Sketch**: every saved-place refresh already downloads all 17 temperature and wind readings, then keeps only the nearest one [source: research.md "Prior Art", `weather.ts:391-424`]. Keep all 17 from the most recent refresh and show them on the map, labelled with that refresh's time. Nothing new is fetched.
- **Appetite**: small.
- **Trade-offs**:
  - Wins: no extra requests and no rate cost.
  - Sacrifices freshness. The readings are as old as the last refresh, which could be hours. That fails the freshness metric and weakens "is a storm coming".
  - It also means keeping island-wide data alongside a location's stored data. That arguably still needs an amendment, because the constitution bans storing island-wide layers in a snapshot [source: research.md "Rules that apply"], so the "no amendment" benefit is doubtful.
  - With several saved places, which refresh is "the latest" gets confusing.
- **Rabbit holes**: deciding where to keep the readings and how they expire; explaining to users why they're old.

## Recommendation

**Option B**, with the mock-up as its first gate.

- It is the only option that can meet the freshness and storm-context goals.
- It costs 3 requests per shared 2-minute window.
- It fits the small appetite because spec 011 already holds every hard part: the on-demand endpoint, the shared cache, the stale fallback, the Layers menu and the status strips.

Option C looks cheaper but fails freshness and probably needs an amendment anyway. Option A remains valid if the mock-up shows 17 points aren't worth drawing. In that case record a kill with the mock-up as the reason, the same rule step 1 used.

## Out of Scope (for the recommended option)

- Separate temperature and wind switches. That can be revisited if the mock-up shows one layer is too busy.
- Humidity, UV, PSI and WBGT on the map.
- Values estimated between stations, heat-map shading, isotherms and streamlines.
- Forecasts, "storm coming" predictions, alerts and push notifications.
- History, trends, replay and keeping readings across fetches.
- Storing island-wide readings in SQLite or in any snapshot.
- Any fetch on page load.
- Changes to the per-place tiles, the rain view or the lightning layer, apart from sharing the Layers menu and the status-strip area.
- Sources other than NEA, and a Production API key.

## Assumptions to Validate

- The owner accepts a third Principle I exception on the same terms as lightning and rain.
- About 17 points, a median 5.7 km apart and some offshore, are worth showing at 375 px and full screen (the mock-up check).
- The station count is stable through the day. Check it again in the afternoon; S199 has no name.
- The spread is large enough to be worth comparing on typical days: the morning sample was 2.2 °C and 1.2–3.7 knots. Check a hot afternoon if possible.
- One "latest" call per endpoint stays complete, meaning it skips the newest minute while that minute is still filling in (seen once).
- A third high-priority layer in the shared queue keeps saved-place refresh at about 10–15 s with no rise in 429 responses.
- Temperature as text plus one wind arrow per station is readable on every theme without new colour scales.
