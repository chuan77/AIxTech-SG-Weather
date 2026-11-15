# Feature Specification: Themed Lightning Bolt Markers and Refresh Timing

**Feature Branch**: `007-lightning-bolt-markers`

**Created**: 2026-11-15

**Status**: Draft

## Clarifications

### Session 2026-11-15

- Q: Where does the owner see refresh timing? → A: Only in developer diagnostics (server log and browser developer console); nothing is added to the dashboard UI.

**Input**: User description: "On the lightning map layer (specs/002-lightning-map-layer), strikes are shown as circles; show them instead as a lightning icon that follows the selected theme. Loading takes a while; measure where the wait comes from before changing how data is loaded." Assessed in `.specify/assessments/lightning-aggregation-and-icon/` (verdict: go, Option A). Grouping strikes into areas was assessed and not approved.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recognise a strike as lightning at a glance (Priority: P1)

During a storm, the owner opens the map with lightning on. Each recorded strike shows as a small lightning bolt mark, not a plain dot. Without opening any details, they can tell these marks are lightning, and they can tell them apart from saved-location pins, including a pin that shows a thunderstorm forecast.

**Why this priority**: This is the main visible change the owner asked for. It's useful on its own even without theme tuning or timing.

**Independent Test**: Load a set of known strikes, for example the three demo strikes aged 2, 30 and 55 minutes, with a saved location whose forecast is a thunderstorm. Confirm each strike shows as a bolt mark at its position, and that an observer can name it "lightning" and point to the thunderstorm pin as a different thing.

**Acceptance Scenarios**:

1. **Given** strikes from the last hour are loaded and the layer is on, **When** the owner views the map, **Then** each strike appears as a lightning bolt mark at its reported position, not as a circle.
2. **Given** a saved location shows a thunderstorm condition on its pin, **When** strikes are shown near it, **Then** the strike marks and the pin are visibly different kinds of mark and can't be mistaken for each other.
3. **Given** the owner selects a strike mark, **When** its details open, **Then** they show the strike type and time exactly as before.
4. **Given** the layer is turned off, **When** the owner views the map, **Then** no bolt marks are shown, as before.

---

### User Story 2 - Bolt marks match the selected theme and stay legible (Priority: P1)

The owner switches between themes. On each one, the bolt marks take that theme's lightning colour and stay clearly visible against the theme's map background, light or dark. They still look newer or older by how prominent they are.

**Why this priority**: "Follows the selected theme" was part of the request, and spec 002 already requires legibility on every basemap. A bolt that disappears on one theme would be a regression.

**Independent Test**: With the three demo strikes loaded, switch through all 6 themes in both card and full-screen views. Confirm on each that the bolts use the theme's lightning colour, are clearly visible, and that the newest strike is visibly the most prominent.

**Acceptance Scenarios**:

1. **Given** any of the 6 themes is selected, **When** strikes are shown, **Then** the bolt marks use that theme's lightning colour.
2. **Given** the owner changes theme while strikes are shown, **When** the new theme applies, **Then** the bolt marks change to the new theme's colour without a reload or a new data request.
3. **Given** strikes aged 2, 30 and 55 minutes, **When** they are shown on any theme, **Then** the newest is visibly the most prominent and the oldest the least, and even the oldest is still findable.
4. **Given** several strikes at nearly the same position, **When** they are shown, **Then** their overlap stays visible rather than one mark fully hiding the others.

---

### User Story 3 - Know how long a lightning refresh took, and why (Priority: P2)

After turning lightning on or pressing Refresh, the owner can find out how long it took for strikes to appear. They can see how much of that was spent getting data from the provider (including how many requests were needed and whether the provider asked it to slow down) and how much was spent drawing the strikes. This gives a baseline for deciding whether loading needs to be faster.

**Why this priority**: The owner reported the wait feels long, but it has never been measured. This story is what turns "feels slow" into a number. It doesn't change the visible map, so it ranks below the marker stories.

**Independent Test**: Trigger a refresh with lightning data available. Confirm a timing record exists showing the total wait, the provider part with its request count and any slow-down, and the drawing part. Trigger a second action within 2 minutes and confirm the record shows the cached data was reused with no provider request.

**Acceptance Scenarios**:

1. **Given** the owner turns lightning on or presses Refresh, **When** strikes have been drawn, **Then** a timing record is available showing total time from the action to strikes drawn, time spent getting data from the provider, number of provider requests, whether a slow-down or retry happened, time spent drawing, and the number of strikes drawn.
2. **Given** data was fetched under 2 minutes ago, **When** the owner acts again, **Then** the timing record shows that the saved data was reused and no provider request was made.
3. **Given** the provider fails or is unavailable, **When** the refresh ends, **Then** a timing record still exists showing the time until failure and its cause, and the map shows the existing "unavailable" state.
4. **Given** the owner is using the dashboard normally, **When** they look at the map or the lightning status strip, **Then** no timing information appears in the dashboard. Timing is available only in developer diagnostics (the server's log for the provider part, and the browser's developer console for the full action-to-drawn timing).

---

### Edge Cases

- No strikes in the last hour (the most common case): no bolt marks; the "No lightning in the last hour" message is unchanged. A timing record is still made for the refresh.
- A busy window with hundreds of strikes (370 were seen in one window on 2026-11-12, most outside Singapore): all are shown as bolts, and panning and zooming stay smooth.
- A strike right on top of a saved-location pin: the pin stays on top and selectable, as before.
- A strike whose age is just under 60 minutes: still shown, at its faintest but findable; at 60 minutes it disappears, as before.
- A strike type other than Cloud to Cloud: the same bolt mark is used; its type shows in the details.
- Full-screen view: bolt marks, colours and fading behave the same as in the card view.
- Theme changed while a refresh is in progress: once drawn, the bolts use the newly selected theme's colour.
- The provider asks the app to slow down (a rate-limit response with a retry): the timing record shows the retry and the extra wait it caused.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each visible strike MUST be shown as a lightning bolt mark at its reported position instead of a circle.
- **FR-002**: Strike marks MUST be visually distinct from saved-location pins, including a pin that shows a thunderstorm condition.
- **FR-003**: Strike marks MUST use the active theme's lightning colour on every theme, and MUST update when the theme changes without a reload or new data request.
- **FR-004**: Strike marks MUST stay legible against every theme's map background, with at least 3:1 contrast between the mark and the map around it, at every age shown.
- **FR-005**: Strike marks MUST become less prominent with age over the 60-minute window, so a newer strike is visibly more prominent than an older one, and the oldest shown strike MUST remain findable.
- **FR-006**: Overlapping strike marks MUST stay individually discernible or visibly overlapping, never fully hiding each other.
- **FR-007**: Selecting a strike mark MUST show its type and time as it does today, and strike marks MUST be selectable on touch screens at least as easily as today's circles.
- **FR-008**: Saved-location pins MUST stay above strike marks and remain selectable.
- **FR-009**: Every existing lightning behaviour from spec 002 MUST stay unchanged: the 60-minute window, the on/off control and its remembered setting, the load prompt, empty and unavailable messages, last-updated time, no fetch on page load, and at most one provider refresh per 2 minutes.
- **FR-010**: For every lightning refresh triggered by the owner, the system MUST record a timing record with: total time from action to strikes drawn; time spent getting provider data; number of provider requests; whether a slow-down/retry occurred and its added wait; whether saved data was reused; drawing time; strike count; and the outcome (success, empty, unavailable).
- **FR-011**: Recording timing MUST NOT add provider requests or noticeably lengthen the refresh, and MUST NOT include any API key or other secret.
- **FR-012**: Timing information MUST be available only through developer diagnostics, the server log and the browser developer console, and MUST NOT add any visible text or control to the dashboard.

### Key Entities *(include if feature involves data)*

- **Strike Mark**: how one lightning strike appears on the map: a bolt at the strike's position, coloured by the active theme and made less prominent with age. It is derived from the existing Lightning Strike; it adds no new data.
- **Refresh Timing Record**: one per owner-triggered lightning refresh. Attributes: when it happened, total wait, provider time, provider request count, slow-down/retry and its added wait, reused-saved-data flag, drawing time, strike count, outcome. Not stored with any saved location, and not kept beyond what the chosen display needs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On all 6 themes, an observer who hasn't been told what the marks are names them "lightning" without opening details, and tells them apart from a thunderstorm pin, in 6 of 6 themes.
- **SC-002**: On all 6 themes, the newest of three strikes aged 2, 30 and 55 minutes is identified correctly at least 90% of the time (unchanged from spec 002, SC-006).
- **SC-003**: Every strike mark, at every age shown, has at least 3:1 contrast against its surrounding map on all 6 themes.
- **SC-004**: With 370 strikes on screen, panning and zooming stay smooth, with no visible stutter compared with the same strikes shown as circles.
- **SC-005**: 100% of owner-triggered lightning refreshes produce a timing record with all the fields in FR-010.
- **SC-006**: After one busy-day storm or a replay of one, the owner has a baseline answer to "how long does lightning take to appear, and is it mostly getting the data or drawing it?"
- **SC-007**: No regression in spec 002 SC-001, SC-004, SC-005 and SC-007: correct positions, distinct empty and unavailable states, at most one provider request per 2 minutes, and other map behaviour unchanged.

## Assumptions

- The bolt can reuse the app's existing lightning glyph style, but it must still be clearly different from the thunderstorm icon on pins. For example, pins are labelled chips with a dot, and strike marks are a bare bolt with an outline.
- Fading uses both prominence (opacity) and size, as the circles do today.
- Each theme's existing lightning colour is kept. If one fails the 3:1 legibility check on its basemap, the outline or colour is adjusted for that theme only, as a deliberate theming change.
- A busy window for testing comes from the existing demo strikes, extended to a busy-day count, or from a replay of a real window. Most days have no strikes.
- Timing covers lightning refreshes only. It isn't a general performance dashboard and isn't kept as long-term history.
- Out of scope: grouping or aggregating strikes by area, density heatmaps, any change to how or when lightning data is fetched (including progressive loading, background refresh or the 2-minute cache), alerts, history beyond 60 minutes, and restyling pins, basemaps or controls.
