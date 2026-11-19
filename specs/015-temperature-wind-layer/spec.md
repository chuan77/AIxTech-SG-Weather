# Feature Specification: Temperature and Wind Across Singapore on the Map

**Feature Branch**: `015-temperature-wind-layer`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: handoff from `.specify/assessments/temp-wind-map-layers/decision.md` (verdict: go, Option B). "One 'Temperature & wind' layer on the card map (in the Layers menu) and the full-screen map (beside rain and lightning). It is off until the user asks for it. Each of the about 17 stations shows its temperature and a wind arrow with direction and rough strength. Stations without a reading are clearly marked as missing. The time of the readings is shown. One fetch is cached on the server for at least 2 minutes and shared by all viewers. It falls back to 'unavailable' or stale data without affecting the rest of the app. Nothing is fetched on page load. It needs a Principle I amendment on lightning and rain's terms."

## Clarifications

### Session 2026-11-19

- Q: Which way should each station's wind arrow point on the map? → A: **Toward**, the way the wind is blowing. Station details give the meteorological "From NE, 45°".
- Q: Without tapping, what should each station's label show on the map? → A: **The temperature plus an arrow** whose size or weight gives the strength level. The speed in km/h appears only in the station's details. This applies to the full-screen map, the only place the view appears (see Gate 1 below).
- Gate 1 (mock-up, 2026-11-19) → **Accepted with one change: full-screen map only.** The card map opens at the focus zoom on a saved place, where only one station (the nearest) is in view, which repeats the per-place tiles. Zoomed out to the whole island, the 224 px card was crowded with labels, rain dots and the Layers menu. The full-screen map was readable at 375 px and clear at 1280 px. The card map, its Layers menu and its status strip are unchanged. Also noted: the dashed "no wind" ring was hard to spot and needs a stronger mark. The mock-up is in `e2e-artifacts/temp-wind-mockup/` (git-ignored).
- Gate 2 (afternoon sample, 2026-11-19 13:40 SGT) → **Passed.** The same 17 stations were seen for each measure, and each latest reading was complete. The spread was 26.2–28.0 °C, and wind was 8–24 km/h from S to W. The newest complete reading was **6–7 minutes old** (3–4 in the morning), so the 10-minute out-of-date threshold in FR-006, SC-003 and US3 scenario 4 is too tight. Planning set it to **15 minutes** (plan research R3). Details are in the assessment `decision.md`.

## Gates Before Planning

The decision allows this feature to go ahead only if two checks pass before `/speckit-plan` starts.

- **Gate 1: Mock-up check.** The owner reviews a throwaway mock-up, which is not committed. It uses the real station positions and values from the 2026-11-19 sample: each station has a temperature and a wind arrow, and at least one station has no reading. It is shown with the rain view on as well. It covers:
  - the card map at 375 px;
  - the full-screen map at 375 px and at 1280 px;
  - at least two themes.

  **If the owner judges about 17 points not worth showing**, the assessment verdict becomes kill and this feature stops. **If one combined layer is too busy**, separate temperature and wind switches come back into scope, and this spec is updated before planning.
- **Gate 2: Afternoon sample.** Make one more live check between 13:00 and 16:00 SGT, outside the app, without a key, using the same three latest-reading requests as the 2026-11-19 morning sample. It must confirm:
  - the station count and identities are stable, including the unnamed station S199;
  - the latest reading for each measure is still complete;
  - the temperature spread at the hotter time of day.

  **If the station count drops sharply, or the latest reading is often incomplete**, return to `/speckit-assess-shape`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compare temperatures across the island (Priority: P1)

A user deciding where to go, or comparing home with work, wants to know which parts of Singapore are hotter or cooler right now. They turn on the Temperature & wind view. Every weather station then appears at its real position with its current air temperature, so the user can see at a glance where it is warmest and coolest.

**Why this priority**: Comparing temperatures is one of the four reasons the owner gave, and it is the reading people can take in most quickly. Wind (User Story 2) shares the same stations and the same switch, so together they form the minimum useful layer.

**Independent Test**: Load station readings with a spread of temperatures. Turn the view on. Confirm that every station with a temperature appears at its correct position showing its value, and that the warmest and coolest stations can be found without opening any detail.

**Acceptance Scenarios**:

1. **Given** the user has turned the view on and readings have loaded, **When** they look at the map, **Then** each station with a temperature appears at its position, showing the value in °C to one decimal place.
2. **Given** the view is on, **When** the user selects a station, **Then** its details show the station name, the temperature, the wind (if the station reports it) and the time of the reading.
3. **Given** the view is on, **When** saved-place pins, the rain view, the lightning layer or the selected place are also shown, **Then** all of them remain visible and usable alongside the stations.

---

### User Story 2 - Know which way and how hard the wind is blowing (Priority: P1)

A user planning a run, ride or other outdoor activity wants to know the wind direction and roughly how strong it is near where they are going, even if they haven't saved that place. With the view on, each station that reports wind shows an arrow pointing the way the wind is blowing, with its strength shown roughly.

**Why this priority**: The owner ranks wind equally with temperature. Wind is the reading a single saved place's tile serves least well when someone is going somewhere else.

**Independent Test**: Load readings with different wind directions and speeds, including a calm station. Confirm that each arrow points the right way, that stronger wind looks stronger, that calm is shown as calm rather than as a direction, and that a station's details give the speed and the direction it comes from.

**Acceptance Scenarios**:

1. **Given** a station reports wind speed and direction, **When** it is shown, **Then** an arrow points the way the wind is blowing toward. Its look gives a rough strength from a small fixed set of levels, explained in a key.
2. **Given** the user selects a station with wind, **When** its details open, **Then** they show the speed in km/h and the direction it comes from as a compass point and in degrees (for example "From NE, 45°").
3. **Given** a station reports wind speed below the calm threshold, **When** it is shown, **Then** it reads as "calm", with no arrow implying a direction.
4. **Given** any of the app's themes, **When** the view is shown, **Then** arrows, strength levels, temperatures and the missing state can be told apart without relying on colour alone.

---

### User Story 3 - Know how fresh the readings are, and when a station has none (Priority: P1)

A user must never mistake old or missing data for a current reading. The view shows when its readings were taken. A station with no temperature or no wind is clearly marked as missing that reading, never shown as a value.

**Why this priority**: With only about 17 stations, each missing or out-of-date value matters more than it does for rain. The problem definition makes honest coverage a goal.

**Independent Test**: Load readings where one station lacks a temperature, another lacks wind, and a third lacks both. Confirm each is marked correctly, and that the time of the readings is shown.

**Acceptance Scenarios**:

1. **Given** a station appears in the wind readings but not the temperature readings, or the reverse, **When** it is shown, **Then** it shows the reading it has and marks the other as "no reading".
2. **Given** a station is listed but has no value for either measure, **When** it is shown, **Then** it is marked "no reading" in a way that cannot be confused with a value or with calm.
3. **Given** readings have loaded, **When** the view is on, **Then** the view shows the source time of the readings and how long ago that was.
4. **Given** the readings shown are more than 15 minutes old (the normal publishing lag of 3–7 minutes, the shared cache window, and a margin of about one missed publication), or were served after a failed refresh, **When** the user views them, **Then** they are clearly labelled as out of date.

---

### User Story 4 - Turn the view on and off without slowing the app (Priority: P2)

A user who doesn't need temperature and wind right now keeps the map uncluttered. They can switch the view on and off on the full-screen map. The app remembers the choice on that device. Opening the app never fetches temperature or wind by itself.

**Why this priority**: Fetching only on request is required by the constitution and protects the shared data budget. The switch is how the user asks for data in the first place.

**Independent Test**: Open the app with the view never used before and confirm that nothing is requested and the view is off. Turn it on and confirm the readings load. Turn it off and confirm the stations disappear and the rest of the map is unchanged. Reload and confirm the remembered state.

**Acceptance Scenarios**:

1. **Given** the user has never used the view on this device, **When** they open the app, **Then** the view is off and no temperature or wind data is requested.
2. **Given** the view is off, **When** the user turns it on, **Then** data is requested (or a fresh shared copy is reused), a loading state is shown, and the stations appear when the data arrives.
3. **Given** the view is on, **When** the user turns it off, **Then** all stations and the key disappear at once. Saved-place pins, the rain view, the lightning layer and the basemap are unchanged.
4. **Given** the user turned the view on, **When** they reload the page later on the same device, **Then** the view is shown as on, but nothing is requested until the user acts. A prompt such as "Show latest temperature & wind" appears, distinct from the "unavailable" message. This matches rain and lightning.
5. **Given** the user closes and reopens the full-screen map, **When** the view was on, **Then** it is still on with the same readings, and no extra request is made while they are fresh.
6. **Given** the card map, **When** the user looks at it or opens its Layers menu, **Then** it shows no Temperature & wind switch, stations or status. The card behaves exactly as today.

---

### User Story 5 - Refresh the readings and cope with failure (Priority: P2)

A user watching a storm build wants the latest readings. They can ask for fresh data. If the source is unavailable, the user is told so, and the readings they already had stay on screen with their age shown. The rest of the app keeps working.

**Why this priority**: Wind and temperature change quickly as a storm arrives, which is one of the owner's four uses. The source is outside the app's control, so failure has to be handled gracefully.

**Independent Test**: With readings loaded, request a refresh and confirm the shown time advances once the source has newer data. Simulate the source failing and confirm the "unavailable" notice, the earlier readings still on screen with their age, and saved places, rain and lightning still working.

**Acceptance Scenarios**:

1. **Given** readings are shown, **When** the user asks for fresh readings, **Then** the previous readings stay on screen with a visible loading state until the new ones replace them.
2. **Given** a shared copy fetched less than the cache window ago exists, **When** any user asks for readings, **Then** that copy is used and the source is not contacted again.
3. **Given** the source fails or refuses the request, **When** earlier readings exist, **Then** they stay on screen marked as out of date, with a notice that fresh data is unavailable.
4. **Given** the source fails and no earlier readings exist, **When** the user has asked for the view, **Then** a message says temperature and wind data is unavailable.
5. **Given** only one measure fails, for example temperature loads but wind does not, **When** the view is shown, **Then** the measure that loaded is shown, and the other is marked unavailable rather than missing at every station without explanation.
6. **Given** a request is in progress or has failed, **When** the user uses saved places, refreshes a saved place, or uses the rain or lightning view, **Then** those keep working as before.

---

### Edge Cases

- **All stations calm**: every arrow is replaced by "calm". The view says so in its status, for example "Calm across the island", rather than looking empty.
- **Every station missing**: the source answers but no station has any value. Treat this as "unavailable", never as an empty map with no explanation.
- **Different station sets**: temperature and wind come from overlapping but different stations: 15 shared, 2 with temperature only and 2 with wind only in the 2026-11-19 sample. Each station shows what it has, and the other measure is marked "no reading".
- **Unnamed station**: a station whose name is missing or is just its code (S199 in the sample) is shown with a neutral label such as "Station S199". It is not left off the map.
- **Offshore stations** (Semakau, Jurong Island, Pulau Ubin, Sentosa): shown at their real positions like any other station. Their details state the station name, so nobody mistakes the reading for one on the mainland.
- **Direction without speed, or speed without direction**: show the measure that is present. An arrow needs a direction, and a speed without a direction is shown as a value with no arrow.
- **Out-of-range values**: a temperature outside a plausible range for Singapore, a negative speed, or a direction outside 0–360° is treated as "no reading" for that measure and does not break the view.
- **Rate limit reached**: a refused request is treated like any other source failure (User Story 5). It doesn't block saved-place refreshes, rain or lightning beyond the delay the shared request budget already imposes.
- **All three layers on at once**: rain stations, lightning marks and temperature and wind stations sit at nearby positions. All stay distinguishable and selectable on the full-screen map at 375 px (SC-007).
- **Coordinates missing or invalid**: that station is left off the map, and the rest of the view is unaffected.
- **User has no saved places**: the view still works, because it isn't tied to any saved place.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST offer one island-wide Temperature & wind view on the full-screen map only; the card map MUST NOT show it. It MUST show every station with valid coordinates that reports air temperature or wind, whether or not the user has saved places.
- **FR-002**: For each station with a temperature, the system MUST show its latest air temperature in °C to one decimal place.
- **FR-003**: For each station with wind, the system MUST show an arrow pointing the way the wind is blowing toward. The arrow's size or weight MUST convey one of a small fixed set of strength levels, explained in a key. Below a calm threshold, the station MUST show "calm" instead of an arrow. A station's label on the map MUST show only its temperature and this arrow (or "calm"). The wind speed number MUST appear only in the station's details (FR-004).
- **FR-004**: When the user selects a station, the system MUST show:
  - its name (or a neutral label if it has none);
  - its temperature;
  - its wind speed in km/h, and the direction it comes from as a compass point and in degrees;
  - the time of the reading;
  - "no reading" for any measure it lacks.
- **FR-005**: The system MUST mark a missing measure at a station as "no reading", visibly different from any value and from calm. Values outside a plausible range MUST be treated as missing.
- **FR-006**: The system MUST show the source time of the readings and how long ago that was. It MUST label the readings out of date once they are more than 15 minutes old, or when they were served after a failed refresh.
- **FR-007**: The view MUST be off by default. The system MUST NOT request temperature or wind data while a page loads, including when the remembered choice is "on". Data is requested only when the user turns the view on or asks for fresh readings.
- **FR-008**: The system MUST remember on the user's device whether the view is on or off, and apply it each time the full-screen map opens.
- **FR-009**: On the full-screen map, the view's switch and status MUST sit beside rain's and lightning's. The card map's Layers menu and combined status strip MUST stay as they are.
- **FR-010**: The system MUST keep one shared copy of the island-wide readings on the server for at least 2 minutes and reuse it for every viewer within that window. During that time the source MUST NOT be contacted again for these readings.
- **FR-011**: The system MUST NOT store island-wide temperature or wind readings in the saved-places database or in any saved place's weather snapshot. It MUST NOT keep readings across fetches.
- **FR-012**: When fresh readings can't be obtained, the system MUST keep any earlier readings on screen, marked out of date, with an "unavailable" notice. With no earlier readings, it MUST show an "unavailable" message. When only one measure fails, the system MUST show the other and mark the failed one unavailable.
- **FR-013**: While readings are loading, the system MUST show a loading state and keep previously shown readings on screen.
- **FR-014**: A failure or delay in this view MUST NOT stop saved places, saved-place refresh, the rain view or the lightning layer from working.
- **FR-015**: Requests for this view MUST share the app's single request budget with saved-place refreshes, rain and lightning. They must not cause more rate-limit refusals than today, and saved-place refresh must stay within its accepted time.
- **FR-016**: Turning the view on or off MUST NOT change saved-place pins, selection, the rain view, the lightning layer, basemap switching or the full-screen view.
- **FR-017**: Every element of the view (temperatures, arrows, strength levels, calm, missing, key and notices) MUST be legible on the full-screen map on every app theme, down to 375 px width, with rain and lightning also on. It MUST NOT rely on colour alone.
- **FR-018**: The view MUST credit its data source (NEA via data.gov.sg), with wording that meets the data's licence terms.
- **FR-019**: The project constitution MUST be amended, before this feature ships, to allow island-wide temperature and wind readings on the same terms as the lightning and rain exceptions:
  - fetched on a user action only, never on page load;
  - a shared server cache of at least 2 minutes;
  - nothing stored in the database or in a location's snapshot;
  - an "unavailable" fallback that leaves the rest of the app unaffected.

### Key Entities *(include if feature involves data)*

- **Weather station**: a place in Singapore where official air temperature and/or wind is measured. It has an identifier, a name (sometimes missing) and a map position, and it is not tied to any saved place.
- **Station conditions**: one station's latest readings. These are the temperature in °C, the wind speed, the wind direction it comes from, and the strength level, each of which may be missing, plus the time of the reading.
- **Island conditions snapshot**: one shared, short-lived set of station conditions for the whole island. It records the source time of its readings, when it was fetched, whether it is out of date, and whether each measure loaded. It is held only in memory on the server.
- **Wind strength level**: one of a small fixed set of named wind-speed ranges, plus "calm", shown in the key.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Using only the app, the owner can answer "where is it hottest and coolest right now?" and "which way is the wind blowing near X, and how hard?" for a place that isn't saved (qualitative, owner check).
- **SC-002**: 100% of stations with valid coordinates appear. Each measure at each station shows a value, "calm" (wind only) or "no reading". No missing measure is ever shown as a value or as calm.
- **SC-003**: The reading time shown matches the source time. No reading is presented as current once it is more than 15 minutes old.
- **SC-004**: When data is already loaded, turning the view on or off is reflected on the map in under 1 second.
- **SC-005**: When fresh data must be fetched, it appears in under 5 seconds on a phone connection, with a loading state visible the whole time and earlier readings kept on screen.
- **SC-006**: Over 5 overlapping runs that mix this view's requests with rain requests and saved-place refreshes, there are zero rate-limit refusals, and saved-place refresh stays within 10–15 seconds (baseline: zero refusals, 9.8–10.9 s, spec 005).
- **SC-007**: On the full-screen map at 375 px on every app theme, with rain and lightning also on, a user can read each station's temperature and wind direction without zooming, tell calm and missing apart from values, and select a station to see its details.
- **SC-008**: Over a 10-minute session of repeated toggling and refreshing by one or more viewers, the app contacts the source for these readings at most once per 2-minute period.
- **SC-009**: Opening or reloading the app makes zero temperature or wind requests until the user acts.
- **SC-010**: Saved-place pins, selection, the rain view, the lightning layer, basemap switching and the full-screen view behave the same with this view on or off.
- **SC-011**: Two weeks after release, the owner still uses the view (qualitative; this is the same test rain passed).

## Assumptions

- **Scope (owner, 2026-11-19)**: one combined layer. Temperature and wind are weighted equally. Separate switches return only if the Gate 1 mock-up finds one layer too busy. Humidity, UV, PSI and WBGT stay off the map.
- **Audience**: a launch of fewer than 5 users on the existing Development data key. A Production key is out of scope.
- **Readings (research, 2026-11-19 live sample)**:
  - Temperature and wind are published every minute at about 17 stations each, with 15 sites shared.
  - Wind is a 10-minute average.
  - The source's "latest" reading is complete and normally about 3–4 minutes old.
- **Out-of-date threshold**: 15 minutes, set in planning after Gate 2 measured a 6–7 minute lag (research R3). It was 10 minutes in the first draft. Rain's threshold moved from 7 to 20 minutes for the same reason.
- **Wind arrow convention (confirmed 2026-11-19)**: the arrow points the way the wind is blowing toward. Station details state the direction it comes from ("From NE"). Speed is in km/h, matching the existing Wind tile, and appears only in the details.
- **Strength levels**: a small fixed set (about three, plus calm), with ranges chosen during planning, in line with common Beaufort-style wording (light, moderate, strong), and confirmed by the mock-up.
- **Temperature display**: a text value per station. Per-theme colour coding is added only if the mock-up shows text isn't enough, and any colour comes from theme tokens.
- **Distance**: no distance limit or ring of influence is drawn. Each station is labelled with its own name and position, so the reader judges distance. Values estimated between stations are a non-goal.
- **Shared cache window**: 2 minutes, the constitution's minimum and the same as rain and lightning.
- **Behaviour on reload**: a remembered "on" shows a "Show latest temperature & wind" prompt rather than fetching, mirroring rain and lightning.
- **Attribution**: wording is confirmed against the data.gov.sg licence during planning (OQ8). The default is "Temperature & wind: NEA via data.gov.sg".
- **Non-goals (from the assessment)**:
  - values estimated between stations, heat maps, isotherms and streamlines;
  - forecasts, storm predictions, alerts and push notifications;
  - history or replay;
  - changes to the per-place tiles, the rain view or the lightning layer, other than sharing the full-screen map's switch and status-strip area;
  - non-NEA sources.
- **Dependencies**:
  - Gates 1 and 2 above.
  - The constitution amendment (FR-019).
  - The request budget shared with saved-place refreshes, rain and lightning. The order in which queued requests wait when several layers refresh at once is settled in planning.
