# Feature Specification: WBGT Heat-Stress Tile

**Feature Branch**: `005-wbgt-heat-stress-tile`

**Created**: 2026-11-14

**Status**: Draft

**Input**: User description: "Specify the WBGT tile next (step 2 of the nea-data-new-features assessment). API key: defined in .env, Development tier only. Nearest WBGT station must be within 10 km to be meaningful. Weather and lightning request pacing: what's the concern? (resolved below). UV trend follows as a separate feature; station rainfall map layer is deferred to the next release." Source assessment: `.specify/assessments/nea-data-new-features/` (verdict go, Option B, step 2). Step 1 (`specs/004-outdoor-comfort-tiles`) is built and the owner has confirmed it is useful, which opens the step 2 gate.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the official heat-stress level for my location (Priority: P1)

When I select a saved location, I see the official NEA heat-stress reading from the nearest WBGT station: the WBGT value in °C, the heat-stress level (Low, Moderate or High), the station name, how far away it is and when it was measured. When the level is Moderate or High, I also see short NEA-level guidance on what to do. This tells me whether it is safe to exercise or work outside, which the "feels like" tile cannot.

**Why this priority**: It is the main purpose of step 2 and the only readout that answers "is it safe to be outside?" from an official source.

**Independent Test**: Refresh a location close to a known WBGT station; compare the value, level, station and time shown with the official WBGT reading for that station at the same time.

**Acceptance Scenarios**:

1. **Given** a refreshed location with a WBGT station within 10 km, **When** I select it, **Then** I see the WBGT value in °C to one decimal place, the heat-stress level, the station name, the distance in km to one decimal place and the reading time in Singapore time.
2. **Given** the level is Low, **When** I select the location, **Then** no health guidance is shown.
3. **Given** the level is Moderate or High, **When** I select the location, **Then** the guidance line for that level is shown under the reading.
4. **Given** the level is High, **When** I select the location, **Then** the level is visually emphasised more strongly than Moderate, using colours from the active theme.
5. **Given** a location whose nearest WBGT station with a reading is more than 10 km away, **When** I select it, **Then** the tile shows "No nearby station" with a tooltip naming the nearest station and its distance, and shows no value, level or guidance.
6. **Given** a location last refreshed before this feature existed, **When** I select it, **Then** the tile shows "No reading" until the location is refreshed, and every other tile is unchanged.

---

### User Story 2 - Refreshes stay reliable with the extra call (Priority: P1)

When I refresh a location, or load the lightning layer while a refresh is running, the app keeps all data provider calls within the request limit of the API key in use. A refresh may take longer than today (up to about 15 seconds), but it must not fail or lose readings because the limit was hit.

**Why this priority**: The WBGT call adds a request to every refresh. Without this, the new tile would make existing tiles worse (decision.md, success metric "no rise in refreshes hitting 429"). It ships with Story 1, not after it.

**Independent Test**: Refresh three locations back to back while also loading the lightning layer; check that no call is rejected for exceeding the limit and every tile shows a value or an explicit "No reading".

**Acceptance Scenarios**:

1. **Given** the Development API key is configured, **When** I refresh one location, **Then** the refresh completes within 15 seconds and no provider call is rejected for exceeding the rate limit.
2. **Given** a location refresh is in progress, **When** I load the lightning layer at the same time, **Then** both complete, and the combined calls stay within the key's limit.
3. **Given** a provider call is rejected for exceeding the limit anyway, **When** the app retries, **Then** it waits at least 10 seconds before the single retry, as the provider asks.
4. **Given** a refresh is taking longer than 2 seconds, **When** I look at the dashboard, **Then** I see that the refresh is still in progress, and the location's previous readings stay visible until it finishes.
5. **Given** no API key is configured, **When** I refresh a location, **Then** the app paces calls for the lower keyless limit, so the refresh is slower but still does not hit the limit.

---

### Edge Cases

- **Station listed without a reading**: stations without a WBGT value are ignored when choosing the nearest one.
- **Exactly 10.0 km away**: counts as nearby (the cut-off is "more than 10 km").
- **Unrecognised heat-stress level** (a level other than Low, Moderate or High): the WBGT value is shown with the level text as given and no guidance.
- **WBGT value not numeric**: the tile shows "No reading"; other tiles are unaffected.
- **WBGT data unavailable** (provider error or empty response): the tile shows "No reading"; the rest of the refresh succeeds.
- **Old reading**: the reading time is always shown, so a stale value is visible as such; no separate staleness rule is applied.
- **Name clash**: the "feels like" tile never says "Heat Stress"; only this tile does.
- **Theme change / narrow screen**: the tile follows the active theme and stays readable at phone width without horizontal scrolling.

## Requirements *(mandatory)*

### Functional Requirements

**Heat-stress tile**

- **FR-001**: During a location's create or refresh, the app MUST obtain the latest official WBGT reading from the station nearest to the location, choosing among stations that have a reading, and store it with the location's weather snapshot.
- **FR-002**: Distance to a station MUST be the real ground distance in kilometres between the location and the station.
- **FR-003**: If the nearest station with a reading is more than 10 km away, the app MUST NOT show its value; the tile MUST show "No nearby station" with a tooltip naming that station and its distance.
- **FR-004**: The tile MUST show the WBGT value (°C, one decimal place), the heat-stress level as published by NEA, the station name, the distance (km, one decimal place) and the reading time in Singapore time.
- **FR-005**: For level Moderate or High, the tile MUST show one guidance line for that level, consistent with NEA's published heat-stress advisory. For Low or any unrecognised level it MUST show no guidance.
- **FR-006**: Guidance MUST stay at NEA-advisory level (activity, rest, hydration); it MUST NOT give medical or diagnostic advice.
- **FR-007**: The three levels MUST be visually distinct, with High the most prominent, using only colours from the theme system.
- **FR-008**: The tile MUST be labelled "Heat Stress", and this label MUST stay exclusive to this tile.
- **FR-009**: A missing, non-numeric or unavailable WBGT reading MUST show "No reading" and MUST NOT affect any other tile or fail the refresh.

**Request pacing**

- **FR-010**: All calls to the data provider, from location refreshes and from the lightning layer together, MUST be paced as one stream that stays within the request limit of the configured API key (Development: 12 requests per 10 seconds; no key: 6 requests per 10 seconds).
- **FR-011**: When a call is rejected for exceeding the limit, the app MUST wait at least 10 seconds before a single retry; if the retry also fails, only the readings from that call become "No reading".
- **FR-012**: One location refresh MUST complete within 15 seconds with the Development key under normal provider conditions.
- **FR-013**: While a refresh is in progress, the dashboard MUST show that it is in progress and keep showing the location's previous readings until new ones arrive.

**General**

- **FR-014**: No call to the data provider MAY happen on page load or on selecting a location; WBGT data arrives only on location create or refresh.
- **FR-015**: Locations saved before this feature MUST keep working and show "No reading" on the new tile until refreshed; no other stored reading may change.

### Key Entities

- **Heat-stress reading**: part of a location's stored weather snapshot. Attributes: WBGT value (°C), heat-stress level, station name, distance to station (km), reading time. Each optional; absent means "No reading". When the nearest station is too far, the station name and distance are kept so the "No nearby station" tooltip can name them.
- **Heat-stress guidance**: fixed text per level (Moderate, High); not stored per location.
- **Provider request budget**: the shared allowance of provider calls per 10 seconds, set by the API key tier and shared by every part of the app that calls the provider.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a refreshed location with a station within 10 km, the shown WBGT value, level and station match the official reading for that station at the same time, in 10 out of 10 spot checks.
- **SC-002**: Across 20 refreshes (including at least 5 started while the lightning layer is loading), zero provider calls are rejected for exceeding the rate limit.
- **SC-003**: With the Development key, one refresh completes within 15 seconds in at least 19 of 20 attempts.
- **SC-004**: Every saved location shows a value, "No reading" or "No nearby station" on the new tile, never a blank or broken tile, across all themes.
- **SC-005**: For locations on Singapore's main island, at least 90% have a WBGT station within 10 km (checked against the current station list); remaining locations show "No nearby station".
- **SC-006**: The owner can answer "is it safe to be outside right now?" from the dashboard alone (qualitative; checked by the owner).

## Assumptions

- Personal use; the owner is the only user (problem.md). Step 1 has been judged useful by the owner on 2026-11-14, opening the step 2 gate.
- A Development-tier key (12 requests per 10 seconds) is configured in `.env`. A Production key is out of scope; a refresh of about 10-15 seconds is accepted instead.
- The WBGT dataset returns per-station readings with a numeric value given as text and a level of Low, Moderate or High (sg-weather-api skill, verified 2026-11-11).
- One refresh makes about 12 provider calls including WBGT; at the Development limit that takes roughly 10 seconds.
- Whether the older 4-day forecast endpoint counts towards the same limit is unknown; it is treated as counting, which is the safe choice.
- Today the weather and lightning clients each pace their own calls, so overlapping use can exceed the shared limit. Pacing them as one stream (FR-010) resolves the decision's open question on shared pacing.
- 10 km is the owner's cut-off for a meaningful station reading.
- The guidance text for Moderate and High is taken from NEA's published heat-stress advisory; the exact wording is confirmed during planning.
- Out of scope: the hourly UV trend (next feature, 006), station-reading map layers including rainfall (next release; needs a constitution amendment), alerts or notifications, WBGT on the map, WBGT history or forecasts, Production key handling, constitution changes.
