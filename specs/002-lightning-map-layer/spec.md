# Feature Specification: Lightning Strikes on the Map

**Feature Branch**: `002-lightning-map-layer`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Add lightning on map feature. Singapore's official weather data publishes the coordinates of recent lightning strikes. Plot them on the existing map as an island-wide layer (not tied to any saved location), covering the last 30–60 minutes, with a time-based fade and an empty state such as 'No lightning in the last hour'. Additional requirement: allow the user to toggle the lightning display on/off on the map."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See where lightning has struck recently (Priority: P1)

A user viewing the weather map wants to know whether there has been lightning near their saved locations or elsewhere in Singapore in the last hour. When lightning data is available, each recorded strike appears as a marker at its real position on the map, so the user can judge proximity at a glance.

**Why this priority**: This is the core value of the feature; without strike markers there is nothing to toggle or explain.

**Independent Test**: With lightning data that contains strikes inside the last hour, open the map and confirm that one marker appears per strike at the correct position. Delivers value on its own even if the toggle and fading are absent.

**Acceptance Scenarios**:

1. **Given** lightning strikes were recorded in the last hour, **When** the user views the map with the lightning layer on, **Then** one marker appears at the location of each strike.
2. **Given** strikes were recorded more than one hour ago, **When** the user views the map, **Then** those older strikes are not shown.
3. **Given** the user selects a marker, **When** the details open, **Then** they show the strike type and the time it occurred.

---

### User Story 2 - Turn the lightning display on and off (Priority: P1)

A user who finds the lightning markers distracting, or who wants an uncluttered map, can switch the lightning display off, and switch it back on later, without leaving the map.

**Why this priority**: The toggle was an explicit additional requirement and directly controls whether Story 1 is visible.

**Independent Test**: Open the map, flip the lightning control off, confirm no lightning markers remain, flip it on, confirm they return. Works the same whether or not any strikes currently exist.

**Acceptance Scenarios**:

1. **Given** the lightning layer is on and strikes are visible, **When** the user turns it off, **Then** all lightning markers disappear immediately and the rest of the map (location pins, basemap) is unchanged.
2. **Given** the lightning layer is off, **When** the user turns it on, **Then** the markers for the last hour reappear.
3. **Given** the user turned the layer off, **When** they reload the page later in the same browser, **Then** the layer remains off until they turn it on again.
4. **Given** the user has never touched the control, **When** they open the map for the first time, **Then** the layer is on.

---

### User Story 3 - Understand how recent each strike is (Priority: P2)

A user wants to tell fresh strikes from old ones. Newer strikes look more prominent and older ones fade progressively until they drop off after one hour.

**Why this priority**: Improves interpretation but the map is still useful without it.

**Independent Test**: Provide strikes at, say, 2 minutes, 30 minutes and 55 minutes old and confirm the newest is visibly stronger than the oldest.

**Acceptance Scenarios**:

1. **Given** strikes of different ages, **When** they are displayed, **Then** a more recent strike is visibly more prominent than an older one.
2. **Given** a strike reaches one hour in age, **When** the map next updates, **Then** it is no longer shown.

---

### User Story 4 - Clear feedback when there is no lightning or data is unavailable (Priority: P2)

A user who sees an empty map layer needs to know whether that means "no lightning" or "the data could not be loaded".

**Why this priority**: Zero strikes is the normal state most of the time; without a message the feature looks broken.

**Independent Test**: With no strikes, confirm the message "No lightning in the last hour" appears; with the data source failing, confirm a distinct unavailable message appears and the rest of the map still works.

**Acceptance Scenarios**:

1. **Given** the layer is on and there were no strikes in the last hour, **When** the map is shown, **Then** a message such as "No lightning in the last hour" is displayed.
2. **Given** the lightning data cannot be retrieved, **When** the map is shown, **Then** a message says lightning data is currently unavailable, and the map, pins and other weather information remain fully usable.
3. **Given** the layer is off, **When** the map is shown, **Then** no lightning message is displayed.

---

### User Story 5 - Refresh the lightning data (Priority: P3)

A user watching an active storm wants to pull the latest strikes without reloading the whole page.

**Why this priority**: Convenience; lightning changes every few minutes, but a page reload also works.

**Independent Test**: With the layer on, trigger a refresh and confirm newly recorded strikes appear and the "last updated" time advances.

**Acceptance Scenarios**:

1. **Given** the layer is on, **When** the user requests a refresh, **Then** strikes from the most recent data replace the displayed ones and the last-updated time is shown.
2. **Given** the user turns the layer on after it was off, **When** the displayed data is more than 2 minutes old, **Then** it is refreshed.

---

### Edge Cases

- No strikes at all in the last hour (the most common case): empty-state message shown, no markers.
- A strike with missing, non-numeric or out-of-range coordinates: that strike is skipped, the others are still shown.
- A strike type other than the one observed so far (cloud-to-cloud): it is still shown, labelled with the text supplied by the data source, or a generic "Lightning" label if none is supplied.
- Several strikes at (almost) the same position: all remain individually discernible or visibly clustered rather than hiding each other completely.
- The data source rate-limits or is down: the unavailable message is shown, previously displayed strikes may remain with a "last updated" time, and no other map feature is affected.
- The user toggles the layer repeatedly: no duplicate markers accumulate and no extra data requests are made while data is still fresh (under 2 minutes old).
- The map is opened in full screen: the toggle and lightning markers behave the same as in the card view.
- A strike's time is slightly in the future or just past the one-hour boundary due to clock differences: it is shown or hidden consistently without errors.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The map MUST display recent lightning strikes as markers at their reported positions, independent of which locations the user has saved.
- **FR-002**: The map MUST show only strikes from the last 60 minutes, and strikes older than that MUST NOT be displayed.
- **FR-003**: Users MUST be able to turn the lightning display on and off with a clearly labelled control on the map, in both the card view and the full-screen view.
- **FR-004**: Turning the display off MUST remove all lightning markers and any lightning message while leaving location pins and the basemap unchanged; turning it on MUST restore them.
- **FR-005**: The lightning display MUST be on by default for a new user, and the user's on/off choice MUST be remembered across page reloads in the same browser.
- **FR-006**: Strikes MUST visibly fade with age so that newer strikes are more prominent than older ones.
- **FR-007**: Selecting a strike marker MUST show its type and the time it occurred.
- **FR-008**: When the display is on and no strikes occurred in the last 60 minutes, the system MUST show an empty-state message ("No lightning in the last hour").
- **FR-009**: When lightning data cannot be retrieved, the system MUST show a distinct "unavailable" message and MUST NOT break or blank the map, location pins or weather information.
- **FR-010**: The system MUST skip any individual strike with unusable coordinates without discarding the remaining strikes.
- **FR-011**: The system MUST show when the lightning data was last updated.
- **FR-012**: Lightning data MUST be treated as one shared, island-wide dataset: it MUST NOT be stored per saved location or affect any saved location's weather snapshot.
- **FR-013**: Lightning data MUST NOT be fetched automatically when the page loads; it MUST be fetched only on a user action (turning the layer on, or requesting a refresh), consistent with the project's rule against calling the weather provider during page loads.
- **FR-014**: Repeated user actions within 2 minutes MUST reuse the already retrieved lightning data rather than issuing new upstream requests, so the provider's request limit is respected.
- **FR-015**: The lightning layer MUST use the active theme's styling conventions and remain legible on every available map basemap, and the layer's on/off control MUST be operable by keyboard and have an accessible name.
- **FR-016**: The feature MUST work without any API key and MUST degrade gracefully if an optional key is absent.

### Key Entities *(include if feature involves data)*

- **Lightning Strike**: A single recorded strike. Attributes: position (latitude and longitude), time of occurrence, type, and a human-readable type label. Strikes are not associated with any saved location.
- **Lightning Observation Window**: The collection of strikes from the last 60 minutes plus the time the data was last updated. Shared by all viewers of the map.
- **Lightning Display Preference**: The user's on/off choice for the layer, remembered per browser.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When strikes exist in the last hour, 100% of strikes with valid coordinates appear on the map at the correct position, and none older than 60 minutes appear.
- **SC-002**: A user can turn the lightning display off or on in a single action, and the map reflects the change in under 1 second.
- **SC-003**: After turning the display off and reloading, the display is still off in 100% of cases.
- **SC-004**: When no strikes are present or the data is unavailable, 100% of such states show a message that distinguishes "no lightning" from "unavailable"; the map is never blank or broken.
- **SC-005**: Over a 10-minute session of repeated toggling and refreshing, the application makes no more than one lightning data request per 2-minute period.
- **SC-006**: In a usability check, at least 90% of users can correctly identify the most recent strike among three differently aged strikes without instruction.
- **SC-007**: Existing map behaviour (saved location pins, selection, basemap switching, full-screen view) is unchanged when the lightning layer is on or off.

## Assumptions

- Data source: Singapore's official public real-time lightning observations, covering the whole island, updated roughly every 2 minutes. It is available without a key but shares a low request-rate limit with the other weather data.
- A strike of the single type observed so far is "Cloud to Cloud"; other types may exist and are displayed generically. Lightning data seen during research contained no strikes at the time of checking, so the strike format is not yet confirmed against a real strike and must be verified during implementation.
- "Last hour" means the 60 minutes before the data was retrieved; this window is a default and can be tuned.
- Lightning is an island-wide layer shown on the existing map; it is not added to the per-location weather snapshot and has no alerts, notifications or history beyond one hour.
- Because data is fetched on user action rather than on page load, a user who leaves the map open sees data as of their last action and the last-updated time; automatic periodic refresh is out of scope.
- The project's constitution (Principle I, snapshot-only weather data) will need either an explicit exception for this island-wide layer or a design that honours it; this is to be settled in planning.
- The single-user, single-device model applies: the toggle preference is stored in the browser, not an account.
- Out of scope: lightning alerts or push notifications, strike density heatmaps, historical playback beyond one hour, and distance-to-strike calculations for saved locations.
