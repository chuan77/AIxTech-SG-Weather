# Feature Specification: Island-wide Rain on the Map

**Feature Branch**: `011-island-rain-view`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: handoff from `.specify/assessments/station-reading-map-layers/decision.md` (verdict: go, Option B step 1, rain only). "An island-wide rain view on both the card map and the full-screen map. It is off until the user asks for it and shows each station's rainfall over the last 15 minutes, with roughly how heavy it was. Stations without a reading are clearly marked as missing, never shown as dry. The time of the readings is shown. One fetch is cached on the server for a short time and shared by all viewers. It falls back to 'unavailable' or stale data without affecting the rest of the app. Nothing is fetched on page load. It is built on a Principle I amendment on the same terms as lightning."

## Clarifications

### Session 2026-11-17 (plan findings)

- Gate 1 → **Passed.** One request for today's rainfall returns the newest 25 readings, newest first, so the 15-minute window takes 1 request (2 just after midnight). The newest period fills in gradually: at 08:25 the 08:20 period held 3 of 87 stations. The newest usable reading is therefore normally about 10 minutes old (plan research R1–R3).
- Out-of-date threshold → changed from "one 5-minute interval plus the cache window" (7 min) to **20 minutes since the newest usable reading**. With a normal lag of about 10 minutes, the old rule would mark healthy data as out of date almost all the time. FR-005, SC-003 and US3 scenario 4 are updated below.
- Gate 2 → the owner chose to plan now and review the mock-up as the **first implementation task**. Rejecting the mock-up still stops the feature before any feature code is written.
- Gate 2 verdict (2026-11-17) → **Accepted with changes.** The mock-up showed about 87 real station positions with invented values, in the `apple` and `radar` themes, on the card map at 375 px, the full-screen map at 375 px and the full-screen map at 1280 px. The changes:
  1. On the **card map**, a single "Layers" button holds the Rain and Lightning switches, replacing the separate buttons. Five round buttons crowded the 224 px card. The full-screen map keeps separate switches. This moves where the card's lightning switch sits, which the owner approved. Lightning's behaviour is unchanged (FR-015).
  2. On the **card map**, rain and lightning share **one single-line status strip**. Two stacked strips covered about half the card.
  3. The full-screen map at 375 px must open at the card's view, not zoomed out to the whole island. The app already does this through `initialView`, so it only needs checking in the browser.
  4. **Heavy rain must stand out most in every theme.** No pale or white heavy fill on dark basemaps.
  5. The **partial badge** must be clearly visible, at least 9 px.

## Gates Before Planning

The decision allows this feature to go ahead only if two checks pass before `/speckit-plan` starts. Both checks belong to this specification stage.

- **Gate 1: 15-minute data check.** A one-off live check shows that Singapore's official rainfall data can provide the latest three 5-minute rainfall totals for every station, so they can be added up, in about 1–3 requests. The check also records page size and ordering. **If it fails**, return to `/speckit-assess-shape`. The rain window or the appetite changes, and keeping readings across fetches stays excluded.
- **Gate 2: Mock-up check.** The owner reviews a mock-up of the rain view, about 88 station points, on the 375 px card map and on the full-screen map. It covers dry stations, stations with rain at each heaviness level, and stations with no reading. **If the owner judges station points not worth having next to NEA's own radar-based rain overlay in myENV**, the assessment verdict becomes kill and this feature stops.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See where it has rained in the last 15 minutes (Priority: P1)

A user about to go out, or to travel across Singapore, wants to know where it is raining now, not only at their saved places. They turn on the rain view on the map. Every rainfall station in Singapore then appears at its real position and shows how much rain fell there in the last 15 minutes, so the user can see at a glance which parts of the island are wet and which are dry.

**Why this priority**: This is the whole point of the feature and the question the assessment found most valuable. Without it, nothing else in this spec matters.

**Independent Test**: Load rainfall readings where some stations recorded rain in the last 15 minutes and others did not. Turn the rain view on. Confirm that every station with a reading appears at its correct position, and that the wet and dry stations can be told apart.

**Acceptance Scenarios**:

1. **Given** the user has turned the rain view on and the readings have loaded, **When** they look at the map, **Then** each station with a reading appears at its position, showing its rainfall total for the latest 15 minutes.
2. **Given** a station recorded 0 mm in the last 15 minutes, **When** it is shown, **Then** it reads as dry and looks clearly different from stations where rain fell.
3. **Given** the user taps or selects a station, **When** its details open, **Then** they show the station name, the 15-minute rainfall total in millimetres, its heaviness level, and the period the total covers.
4. **Given** the rain view is on, **When** the user's saved-location pins, the lightning layer or the selected location are also shown, **Then** all of them remain visible and usable alongside the rain stations.

---

### User Story 2 - Tell how heavy the rain is (Priority: P1)

A user looking at the rain view wants to know whether a wet area is having a drizzle or a downpour, not just whether it rained. Each wet station shows a heaviness level that can be read at a glance and is explained by a key.

**Why this priority**: The owner's goal is "where it rained, and roughly how heavily." Wet or dry alone would not show whether an umbrella is enough.

**Independent Test**: Load readings that include stations at each heaviness level. Confirm that each station shows the matching level and that the key explains every level used.

**Acceptance Scenarios**:

1. **Given** stations with different 15-minute totals, **When** they are shown, **Then** each wet station shows one of a small fixed set of heaviness levels (for example light, moderate, heavy), and stations at higher levels stand out more.
2. **Given** the rain view is on, **When** the user wants to know what the levels mean, **Then** a key is available that names each level and its rainfall range.
3. **Given** any of the app's themes, **When** the rain view is shown, **Then** every heaviness level, the dry state and the missing state can be told apart on that theme, without relying on colour alone.

---

### User Story 3 - Know how fresh the readings are, and when a station has none (Priority: P1)

A user must never mistake old or missing data for "no rain". The view shows when its readings were taken. Any station that has no reading for the latest 15 minutes is clearly marked as missing, not shown as dry.

**Why this priority**: A wrong "dry" reading is worse than no feature, because it could send someone out into a storm. The problem definition treats this as a goal in its own right.

**Independent Test**: Load readings where some listed stations have no value and others are only partly covered. Confirm that the missing stations are marked as missing, the partly covered ones are marked as partial, and the time of the readings is shown.

**Acceptance Scenarios**:

1. **Given** a station is listed in the source data but has no reading in any of the latest three 5-minute periods, **When** the rain view is shown, **Then** that station is marked "no reading" in a way that cannot be confused with dry.
2. **Given** a station has readings for only some of the latest three 5-minute periods, **When** it is shown, **Then** its total covers only the periods it has, and it is marked as partial (for example "10 of 15 min").
3. **Given** readings have loaded, **When** the rain view is on, **Then** the view shows the time of the most recent reading it includes, as reported by the source, and how long ago that was.
4. **Given** the newest reading shown is more than 20 minutes old (about the normal publishing lag of 10 minutes, plus one 5-minute interval, the shared cache window and a margin), or was served after a failed refresh, **When** the user views it, **Then** it is clearly labelled as out of date.

---

### User Story 4 - Turn the rain view on and off without slowing the app (Priority: P2)

A user who doesn't need rain right now keeps the map uncluttered. They can switch the rain view on when they want it and off again, on both the card map and the full-screen map. The app remembers their choice on that device. Opening the app never fetches rain data by itself.

**Why this priority**: Fetching only on request is required by the project constitution and protects the shared data budget. The toggle is how the user asks for rain in the first place.

**Independent Test**: Open the app with the rain view never used before, and confirm that no rain data is requested and the view is off. Turn it on and confirm that the readings load. Turn it off and confirm that the stations disappear and the rest of the map is unchanged. Reload and confirm the remembered state.

**Acceptance Scenarios**:

1. **Given** the user has never used the rain view on this device, **When** they open the app, **Then** the rain view is off and no rain data is requested.
2. **Given** the rain view is off, **When** the user turns it on, **Then** rain data is requested (or reused if a fresh shared copy exists), a loading state is shown, and the stations appear when the data arrives.
3. **Given** the rain view is on, **When** the user turns it off, **Then** all rain stations and the key disappear at once, and saved-location pins, the lightning layer and the basemap are unchanged.
4. **Given** the user turned the rain view on, **When** they reload the page later on the same device, **Then** the view is shown as on but no rain data is requested until the user acts. The view shows a prompt such as "Show latest rain", distinct from the "no rain" and "unavailable" messages. This matches how lightning behaves.
5. **Given** the user switches between the card map and the full-screen map, **When** the rain view is on in one, **Then** it is on in the other with the same readings, and no extra request is made.

---

### User Story 5 - Refresh the rain readings and cope with failure (Priority: P2)

A user watching a shower move across the island wants the latest readings. They can ask for fresh rain data. If the data source is unavailable, the user is told so, and the readings they already had stay on screen with their age shown. The rest of the app keeps working.

**Why this priority**: Rain changes within minutes, so the view needs a way to update. The source is outside the app's control, so failure has to be handled gracefully.

**Independent Test**: With readings loaded, request a refresh and confirm the shown time advances once the source has newer data. Simulate the source failing and confirm the "unavailable" notice, the earlier readings still on screen with their age, and saved locations and lightning still working.

**Acceptance Scenarios**:

1. **Given** rain readings are shown, **When** the user asks for fresh readings, **Then** the previous readings stay on screen with a visible loading state until the new ones replace them.
2. **Given** a shared copy of the readings fetched less than the cache window ago exists, **When** any user asks for rain readings, **Then** that copy is used and the data source is not contacted again.
3. **Given** the data source fails or refuses the request, **When** earlier readings exist, **Then** they stay on screen marked as out of date, alongside a notice that fresh rain data is unavailable.
4. **Given** the data source fails and no earlier readings exist, **When** the user has asked for rain, **Then** a message says rain data is unavailable, which is distinct from "no rain in the last 15 minutes".
5. **Given** a rain request is in progress or has failed, **When** the user uses saved locations, refreshes a saved location or uses the lightning layer, **Then** those keep working as before.

---

### Edge Cases

- **No rain anywhere**: every station reads 0 mm. The view shows all stations as dry and a short message such as "No rain in the last 15 minutes", distinct from "unavailable" and from the "Show latest rain" prompt.
- **Every station missing**: the source answers but no station has a reading. Treat this as "unavailable", never as "no rain".
- **Station moves or appears**: a station listed in the latest data but not in earlier periods is treated like any other station, and its total covers the periods it has (partial).
- **Readings out of order or duplicated**: each 5-minute period counts once per station, so no rain is double-counted.
- **Window crosses midnight (Singapore time)**: the 15-minute total still covers the latest three 5-minute periods, even when they span two dates.
- **Rate limit reached**: a refused request is treated like any other source failure (User Story 5). It doesn't block saved-location refreshes or lightning beyond the delay their shared request budget already imposes.
- **Rain request and saved-location refresh at the same time**: both complete. The saved-location refresh stays within its accepted time (SC-006).
- **Stations close together at 375 px**: neighbouring stations stay distinguishable and selectable without zooming (SC-007).
- **Coordinates missing or invalid**: that station is left off the map. It is not counted as dry and it doesn't break the view.
- **User has no saved locations**: the rain view still works, because it isn't tied to any saved location.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST offer an island-wide rain view on both the card map and the full-screen map, showing every rainfall station that has valid coordinates, whether or not the user has saved locations.
- **FR-002**: For each station, the system MUST show the rainfall total for the latest 15 minutes, made of the latest three 5-minute totals the source has published, in millimetres.
- **FR-003**: The system MUST place each station's total in one of a small fixed set of heaviness levels plus a dry level (0 mm), and MUST provide a key naming each level and its range.
- **FR-004**: The system MUST mark a station with no reading in any of the three periods as "no reading", visibly different from dry. It MUST mark a station with readings in only some periods as partial, stating how many minutes the total covers.
- **FR-005**: The system MUST show the source time of the most recent reading included, and how long ago that was. It MUST label the readings as out of date once the newest reading is more than 20 minutes old, or when they were served after a failed refresh.
- **FR-006**: When the user selects a station, the system MUST show its name, its 15-minute total, its heaviness level, and the period it covers or a partial or missing note.
- **FR-007**: The rain view MUST be off by default. The system MUST NOT request rain data while a page loads, including when the user's remembered choice is "on". Rain data is requested only when the user turns the view on or asks for fresh readings.
- **FR-008**: The system MUST remember on the user's device whether the rain view is on or off, and keep the choice the same across the card map and the full-screen map.
- **FR-009**: The system MUST keep one shared copy of the island-wide rain readings on the server for at least 2 minutes and reuse it for every viewer within that window. During that time the data source MUST NOT be contacted again for rain.
- **FR-010**: The system MUST NOT store island-wide rain readings in the saved-locations database or in any saved location's weather snapshot. It MUST NOT keep readings from earlier fetches to build the 15-minute window.
- **FR-011**: When fresh readings can't be obtained, the system MUST keep any earlier readings on screen, marked as out of date, with a notice that rain data is unavailable. With no earlier readings, it MUST show an "unavailable" message distinct from "no rain".
- **FR-012**: While rain readings are loading, the system MUST show a loading state and keep any previously shown readings on screen.
- **FR-013**: A failure or delay in rain data MUST NOT stop saved locations, saved-location refresh or the lightning layer from working.
- **FR-014**: Rain requests MUST share the app's single data-source request budget with saved-location refreshes and lightning. They must not cause more rate-limit refusals than today, and saved-location refresh must stay within its accepted time.
- **FR-015**: Turning the rain view on or off MUST NOT change saved-location pins, selection, the lightning layer, basemap switching or the full-screen view.
- **FR-016**: Every rain view element (stations, levels, dry, partial, missing, key, notices) MUST be legible on every app theme, down to 375 px width, and MUST NOT rely on colour alone to tell levels apart.
- **FR-017**: The rain view MUST credit its data source (NEA via data.gov.sg), with wording that meets the data's licence terms.
- **FR-018**: The project constitution MUST be amended, before this feature ships, to allow island-wide rain readings on the same terms as the existing lightning exception: user action only, never on page load, a shared server cache of at least 2 minutes, nothing stored in the database or in a location's snapshot, and an "unavailable" fallback that leaves the rest of the app unaffected.

### Key Entities *(include if feature involves data)*

- **Rain station**: a place in Singapore where official rainfall is measured. It has an identifier, a name and a map position. It is not tied to any saved location.
- **Station rain reading**: a station's rainfall for the latest 15 minutes. It holds the total in mm, its heaviness level, how many of the three 5-minute periods it covers (all three, partial or none), and the period it covers.
- **Island rain snapshot**: one shared, short-lived set of station rain readings for the whole island. It records the source time of its newest reading and when it was fetched, and whether it is out of date. It is held only in memory on the server, never in the database.
- **Heaviness level**: one of a small fixed set of named rainfall ranges for a 15-minute total, plus "dry". It is shown in the key.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a day with scattered showers, a user can name the areas of Singapore where it has rained in the last 15 minutes using only the app, without opening another app (qualitative, owner check).
- **SC-002**: 100% of stations with valid coordinates appear. Each one shows a 15-minute total, a partial total or "no reading". No station without a reading is ever shown as dry.
- **SC-003**: The reading time shown matches the source time of the newest reading included. No reading is presented as current when the newest reading is more than 20 minutes old.
- **SC-004**: When rain data is already loaded, turning the rain view on or off is reflected on the map in under 1 second.
- **SC-005**: When fresh rain data must be fetched, it appears in under 5 seconds on a phone connection, with a loading state visible the whole time and earlier readings kept on screen.
- **SC-006**: Over 5 overlapping runs that mix rain requests with saved-location refreshes, there are zero rate-limit refusals and saved-location refresh stays within 10–15 seconds (baseline: zero refusals, 9.8–10.9 s, spec 005).
- **SC-007**: At 375 px width on every app theme, a user can read each station's level and tell dry, wet, partial and missing apart without zooming, and can select a station to see its value.
- **SC-008**: Over a 10-minute session of repeated toggling and refreshing by one or more viewers, the app contacts the data source for rain at most once per 2-minute period.
- **SC-009**: Opening or reloading the app makes zero rain data requests until the user acts.
- **SC-010**: Saved-location pins, selection, the lightning layer, basemap switching and the full-screen view behave the same with the rain view on or off.

## Assumptions

- **Scope (owner, 2026-11-17)**: rain only. Temperature and wind are a later step 2, only if this feature proves useful. Humidity, UV, PSI and WBGT are out.
- **Audience (owner, 2026-11-17)**: a launch of fewer than 5 users on the existing Development data key. A Production key and launch-scale traffic are out of scope.
- **Time targets**: SC-004 (under 1 s) and SC-005 (under 5 s) are the recommended targets from the problem definition. The owner hasn't formally confirmed them, and they can be revisited in `/speckit-clarify`.
- **Readings**: Singapore's official rainfall readings are 5-minute totals published every 5 minutes at about 88 stations. Some listed stations regularly have no value (`research.md`).
- **The 15-minute window** is the latest three 5-minute periods the source has published, not the 15 minutes before the moment the user asks.
- **Heaviness levels**: a small fixed set (about three levels plus dry), with ranges chosen during planning and shown in the key. The default is ranges in line with common rain-intensity wording (light, moderate, heavy), scaled to a 15-minute total. The mock-up gate confirms that they read well.
- **Shared cache window**: 2 minutes, the constitution's minimum and the same as lightning. NEA publishes rain every 5 minutes, so this rarely hides a new reading.
- **Behaviour on reload**: the remembered "on" state shows a "Show latest rain" prompt rather than fetching. That mirrors lightning (spec 002) and keeps the no-fetch-on-load rule.
- **Several layers at once**: the rain view and the lightning layer can both be on. Neither changes the other.
- **Attribution**: wording is confirmed against the data.gov.sg licence during planning (carried-forward question OQ8). The default is "Rainfall: NEA via data.gov.sg".
- **Non-goals (from the assessment)**:
  - "rain moving toward you", alerts or push notifications;
  - forecasts, values estimated between stations, and radar imagery;
  - history or replay;
  - changes to the saved-location tiles or the lightning layer;
  - non-NEA data sources.
- **Dependencies**:
  - Gate 1 and Gate 2 above.
  - The constitution amendment (FR-018).
  - The request budget shared with saved-location refreshes and lightning, where the order in which queued requests wait is settled in planning (OQ9).
