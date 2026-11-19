# Phase 0 Research: Temperature and Wind on the Full-Screen Map

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-11-19

This file resolves every open point in the plan's Technical Context. Each item gives a Decision, its Rationale and the Alternatives considered. The live evidence comes from two samples taken on 2026-11-19: 08:47 SGT (in the assessment `research.md`) and 13:40 SGT (Gate 2, recorded in the assessment `decision.md`).

## Evidence summary (both live samples)

| | 08:47 sample | 13:40 sample |
|---|---|---|
| Stations: temperature / wind | 17 / 17, with 15 shared | the same IDs |
| Latest reading complete? | yes (17 of 17) | yes (17 of 17) |
| Age of newest complete reading | 3–4 min | **6–7 min** |
| Temperature spread | 26.1–28.3 °C | 26.2–28.0 °C |
| Wind | 1.2–3.7 kn, 5–351° | 4.3–13.1 kn, 160–266° |
| Response size | about 2.6 KB per measure | the same |

Station objects use `location` (not `labelLocation`). Values mix integers and decimals. S199 has no name in the temperature list and the name "S199" in the wind lists.

## R1. How to fetch

- **Decision**: three requests, one each to the "latest" endpoints `air-temperature`, `wind-speed` and `wind-direction`, with no `date` parameter. They go through the shared `ProviderRequester` with `priority: 'high'`, as rain and lightning do. The three are queued together and run back to back at the existing spacing, about 1.8 s of pacing with the Development key.
- **Rationale**:
  - The latest reading was complete in both samples; the provider skips the minute that is still filling in.
  - No time window is needed, because the spec shows current conditions, not a total.
  - Wind is already a 10-minute average.
- **Alternatives considered**:
  - `?date=<today>` with the newest complete minute picked out: about 17 KB per measure instead of 2.6 KB, for no benefit.
  - Fetching only temperature, plus wind on demand: two fetch paths and more code, for a saving of 2 requests every 2 minutes at most.

## R2. Joining the three measures, and partial failure

- **Decision**:
  - **Joining**: stations are joined by `id` across the three responses. Coordinates come from whichever station list the station appears in, and invalid coordinates drop the station.
  - **Names**: a name that is empty or equal to the ID becomes `null`, and the UI shows "Station S199".
  - **Wind needs both responses**: wind counts as available only when the speed **and** direction responses succeed. A station's wind is shown only when it has both values.
  - **Each measure succeeds or fails on its own**:
    - If temperature succeeds and wind fails (or the reverse), the observation is returned with `measures.wind: 'unavailable'` and cached as normal.
    - If all three fail, the client behaves like rain: it serves the previous observation with `stale: true` if there is one, and otherwise throws, which the route turns into a 502.
  - **No mixing ages**: a measure that failed is never filled in from an older cached observation.
- **Rationale**: FR-012 (one measure can fail while the other shows) and FR-005 (missing must never look like a value). Mixing ages within one view would make the single time on the status strip untrue.
- **Alternatives considered**:
  - Treating any failure as total failure: this throws away good data, against FR-012.
  - Filling a failed measure from the cache: the view would show two ages under one time label.

## R3. Reading time, and when readings are out of date

- **Decision**:
  - Keep `temperature_at` and `wind_at`: each is the provider timestamp of that measure's reading (wind uses the older of the speed and direction timestamps).
  - The status strip shows the **older** of the two, for example "Temp & wind at 13:33 · 7 min ago".
  - Readings are labelled **out of date** when that time is more than **15 minutes** old at the time of display, or when `stale: true`.
- **Rationale**: Gate 2 measured a normal lag of 6–7 minutes. Add the 2-minute cache and a healthy reading can be about 9 minutes old, so the spec's 10 minutes would flag healthy data. 15 minutes gives a margin of about one missed publication cycle plus slack. Rain moved from 7 to 20 minutes for the same reason. **The plan updates FR-006, SC-003 and US3 scenario 4 to 15 minutes**; see the spec's Clarifications.
- **Alternatives considered**:
  - Keeping 10 minutes: false alarms on afternoons like the Gate 2 sample.
  - 20 minutes, as rain uses: this would hide a 10-minute outage of a source that publishes every minute.

## R4. Wind strength levels and calm

- **Decision**: convert knots to km/h on the frontend (× 1.852, the same as the Wind tile) and band the result:

  | Level | Range | Arrow |
  |---|---|---|
  | calm | under 2 km/h | none; "calm" shown instead |
  | light | 2 to under 20 km/h | small |
  | moderate | 20 to under 39 km/h | medium |
  | strong | 39 km/h and above | large, heavier stroke |

- **Rationale**: these bands follow Beaufort. Calm is Beaufort 0 (under 1 knot). Light covers Beaufort 1–3 (light air to gentle breeze, under 20 km/h). Moderate covers Beaufort 4–5 (20–38 km/h). Strong is Beaufort 6 and above (39 km/h and over, a strong breeze, with squalls in storms). Both samples fell in light to low moderate, so the strong level will matter mainly in storms. The bands live in one pure module, so they're easy to change.
- **Alternatives considered**:
  - Raw Beaufort numbers (0–12): too many levels to tell apart at 375 px.
  - Speed numbers on the map: rejected in clarification (speed appears only in the details).

## R5. Plausible values

- **Decision**: a value outside these ranges is treated as "no reading" for that measure:
  - temperature from 10 to 45 °C;
  - wind speed from 0 to 150 knots;
  - direction from 0 to 360°, with 360 treated as 0.

  The parser coerces numeric strings with `Number()`, as rain's does, and rejects anything that isn't finite.
- **Rationale**: the spec's edge case on out-of-range values. Singapore's record temperatures are roughly 19–37 °C, so the range is generous and catches only sensor faults.
- **Alternatives considered**: no range check, which would let a faulty 999 °C reading show as a value.

## R6. The shared request queue

- **Decision**: no new queueing rule. The three requests use `priority: 'high'`, as rain and lightning do. The client starts all three together, so they queue back to back.
- **Expected timing**: on the Development key, about 1.8 s of pacing plus about 0.2 s of provider time, about 2 s in total.
  - If rain was asked for at the same moment, add one slot, about 0.9 s.
  - A saved-place refresh running at the same time finishes about three slots later, about 2.7 s, so within its 10–15 s target.
- **Rationale**: SC-005 (under 5 s) and SC-006, the same trade-off the owner approved for rain in spec 011 T057.
- **Alternatives considered**: normal priority. Spec 011 measured that it makes an island layer wait 10–12 s behind a saved-place refresh.

## R7. Station marks

- **Decision**: one Leaflet `divIcon` per station, a small label with two parts.
  - **Wind**: an arrow rotated to `(direction + 180) mod 360`, so it points the way the wind is blowing. Its size and stroke give the level.
  - **Calm**: the text "calm".
  - **No wind reading**: a crossed-out wind glyph, solid rather than dashed, at the same size as a light arrow. The Gate 1 mock-up found the dashed ring hard to spot.
  - **Temperature**: shown to one decimal place, for example "27.4°".
  - **No temperature reading**: "–°" in the muted token.
  - **Screen readers**: each mark carries text such as "Clementi Road, 26.3 degrees, wind light from south-west".
  - **Layering**: the marks sit in their own pane above rain and below lightning and the pins.
  - **Overlap**: collisions are tolerated, as on the rain layer. Selecting a station opens its popup.
- **Rationale**: these choices come from the clarifications and the Gate 1 findings. With 17 marks there's no performance concern (rain draws 87), so no grouping is needed. The pane order keeps the pins clickable (FR-016).
- **Alternatives considered**:
  - A collision-avoiding label layout: the rabbit hole named in the concept.
  - Separate temperature and wind marks: rejected at Gate 1.

## R8. Where the controls go (full-screen map only)

- **Decision**:
  - **Top bar**: a `TempWindSwitch` and a `TempWindRefreshButton` are added to the full-screen map's top bar, after Rain and before Lightning. At 375 px the bar can no longer fit on one row, so the control group **wraps onto a second row**, right-aligned under the close button, and never covers it.
  - **Status strip**: a `TempWindStatusStrip` is stacked between rain's and lightning's strips.
  - **Map layer**: `WeatherMap` gets a `showTempWind` prop that defaults to `false`. Only `MapFullscreen` passes `true`, so the card map shows nothing (FR-001, FR-009).
  - The card's `MapLayersControl` and combined strip are unchanged.
- **Rationale**: these choices follow the Gate 1 decision. Wrapping keeps every control at 44 px without a new menu, and the e2e check measures that nothing overlaps at 375 px.
- **Alternatives considered**:
  - A Layers menu on the full-screen map: this would change how rain and lightning behave on full screen, which is out of scope.
  - A smaller hit area: fails WCAG target size.

## R9. Attribution

- **Decision**:
  - The legend carries the licence notice in rain's pattern: "Contains information from Air Temperature across Singapore, Wind Speed across Singapore and Wind Direction across Singapore (NEA), accessed from data.gov.sg, made available under the Singapore Open Data Licence version 1.0", with the licence name linked.
  - Popups carry the short form "NEA via data.gov.sg".
- **Rationale**: FR-018. The licence and pattern were confirmed in spec 011 R9 (T050) for the same publisher and licence. The dataset titles are the ones on the OpenAPI specs in `RealtimeWeatherReadingsacrossSingapore/`.
- **Alternatives considered**: the Leaflet attribution row, which is too crowded on phones and belongs to the basemap.

## R10. Constitution amendment

- **Decision**: amend Principle I from 1.5.0 to **1.6.0** (MINOR, because it materially expands the guidance). It names a third permitted layer, **air temperature and wind station readings** (`POST /api/temp-wind/refresh`), on the identical terms as lightning and rain. The Sync Impact Report and `docs/architecture.md` are updated in the same commit, before or with the route.
- **Rationale**: the owner accepted it on 2026-11-19 (assessment `decision.md`). Principle I requires an amendment for "any further exception".
- **Alternatives considered**: concept Option C, reusing readings from the last saved-place refresh. It was rejected on freshness, and it still conflicts with the "not in a WeatherSnapshot" wording.

## R11. Development fixture

- **Decision**: `TEMP_WIND_FIXTURE=demo`, for development only and ignored in production, as `RAIN_FIXTURE` is. It serves about 17 hand-made stations covering:
  - every wind level, including calm;
  - wind only, temperature only, and no reading at all;
  - an unnamed station;
  - an out-of-range value.

  The backend tests use small fixtures shaped like the 2026-11-19 responses, written by hand. Nothing is copied from `RealtimeWeatherReadingsacrossSingapore/`.
- **Rationale**: browser checks and manual review need every state without depending on live weather. The e2e script stubs the route and never calls data.gov.sg (CLAUDE.md browser-check rules).
- **Alternatives considered**: recording live responses, which wouldn't cover calm, strong or out-of-range values.

## R12. Frontend state and first-use legend

- **Decision**:
  - The store gets a `tempWind` slice that mirrors `rain`:
    - an `enabled` choice in `localStorage` (`weather-starter.tempWind.enabled`, default off);
    - status `idle | loading | ready | unavailable`;
    - an in-flight guard;
    - 2-minute client-side reuse;
    - earlier readings kept on failure.
  - The legend opens by itself once, on first use, as rain's does (`weather-starter.tempWind.legendSeen`).
- **Rationale**: FR-007, FR-008 and FR-013, and Principle II (one store). Reusing rain's shape keeps review simple.
- **Alternatives considered**: a generic layer abstraction shared by rain, lightning and temp & wind. The concept named it as a rabbit hole, and it would refactor shipped code.
