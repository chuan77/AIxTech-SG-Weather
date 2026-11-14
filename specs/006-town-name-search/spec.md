# Feature Specification: Town Name Search

**Feature Branch**: `006-town-name-search`

**Created**: 2026-11-14

**Status**: Draft

**Input**: User description: "Expand the add-location form so the user can search for a Singapore town by name (for example Woodlands, Sembawang, Sengkang, Punggol, Bishan). Picking a town fills in its latitude and longitude, and the user reviews them and adds the location as today. Town names only this phase. The town list is the set of NEA two-hour forecast areas, held by the app, so searching makes no call to data.gov.sg or any other service. Manual coordinate entry stays." Source assessment: `.specify/assessments/location-name-search/` (verdict go, Option B).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find a town by name and add it (Priority: P1)

A person using the dashboard wants the weather for a Singapore town they know by name, such as Sengkang. They open the add-location form and start typing the town's name. Matching towns appear as they type. They pick "Sengkang", and the latitude and longitude fields fill with that town's coordinates. They check the coordinates and press Add. The location is saved, its weather loads, and it shows "Sengkang" as its label.

**Why this priority**: This is the whole feature. It removes the need to look up coordinates elsewhere, and it is a usable slice on its own.

**Independent Test**: Open the add form, type "seng", pick "Sengkang", press Add. A new saved location labelled "Sengkang" appears with weather, and it persists after a page reload. No outside map or lookup is used.

**Acceptance Scenarios**:

1. **Given** the add-location form is open, **When** the user types part of a town name (for example "bish"), **Then** a list of matching towns is shown that includes "Bishan".
2. **Given** matching towns are shown, **When** the user picks one, **Then** the latitude and longitude fields fill with that town's coordinates and the town name is shown as the chosen town.
3. **Given** a town has been picked and the fields are filled, **When** the user presses Add, **Then** the location is added through the normal add flow, its weather loads, and its label is the picked town's name.
4. **Given** a town has been picked, **When** the user has not yet pressed Add, **Then** nothing is saved. The user can still cancel, pick another town, or edit the coordinates.
5. **Given** the user types any of "Woodlands", "Sembawang", "Sengkang", "Punggol" or "Bishan", **When** they look at the matches, **Then** the named town is among them.

---

### User Story 2 - Forgiving matching (Priority: P2)

A person doesn't remember the exact spelling or capitalisation of a town, for example typing "punggole", "PUNGGOL" or "tampnes". The app still offers the town they meant.

**Why this priority**: Spelling slips are common with Singapore place names (for example "Punggole" for "Punggol"). Without tolerance, users see "no match" for a town that exists and fall back to typing coordinates. It is secondary because exact or prefix typing already works under Story 1.

**Independent Test**: Type "punggole" and confirm "Punggol" is offered. Type "SEMBAWANG" and confirm "Sembawang" is offered.

**Acceptance Scenarios**:

1. **Given** the add form is open, **When** the user types a town name in any mix of upper and lower case, **Then** the matching is the same as for lower case.
2. **Given** the add form is open, **When** the user types a town name with one wrong, missing or extra letter (for example "punggole", "tampnes"), **Then** the intended town is offered.
3. **Given** the add form is open, **When** the user types text matching a word in the middle of a town name (for example "water" or "islands"), **Then** towns containing that word are offered.

---

### User Story 3 - Clear outcomes when a town can't be used (Priority: P3)

A person types something that isn't a town in the list, or picks a town they have already saved. The app tells them plainly what happened, and they can still enter coordinates by hand.

**Why this priority**: These are the less common paths. They need a clear message, not silence, but they don't change the main flow.

**Independent Test**: Type "zzz" and confirm a "no matching town" message appears while the coordinate fields stay usable. Add "Bishan" once, then pick "Bishan" again and press Add, and confirm the existing "already saved" outcome is shown and no second entry appears.

**Acceptance Scenarios**:

1. **Given** the add form is open, **When** the user types text that matches no town, **Then** a short "no matching town" message is shown and the coordinate fields remain available for manual entry.
2. **Given** "Bishan" is already saved, **When** the user picks "Bishan" again and presses Add, **Then** no duplicate is created and the user sees the same "already exists" message as for a duplicate typed by coordinates.
3. **Given** the user has typed text into the town field, **When** they press Cancel, **Then** the town field, the match list and the coordinate fields are all cleared, as Cancel does today.
4. **Given** the user picked a town and then edits a coordinate by hand, **When** they look at the form, **Then** it no longer shows the town as chosen. The location is added at the edited coordinates and labelled by the nearest forecast area, as today.

---

### Edge Cases

- **Empty or whitespace-only text**: no match list is shown and no "no matching town" message appears.
- **Very short text (one letter)**: matches may be offered, but the list is kept to a manageable length so it doesn't fill the sidebar.
- **Many matches**: the list shows a bounded number of entries, best matches first.
- **Leading or trailing spaces**: ignored.
- **Names with internal spaces** ("Ang Mo Kio", "Choa Chu Kang"): matching works whether the user includes the spaces or not ("angmokio").
- **Keyboard-only use**: the user can move through matches, pick one and dismiss the list without a mouse.
- **Town not in the list** (an estate such as "Admiralty", an MRT station, a postal code): treated as no match. Manual coordinate entry remains available. Out of scope for this phase.
- **Typing in the town field after picking a town**: the previous pick is cleared until a new town is picked, so the form never shows a town name that doesn't match the filled coordinates.
- **Weather unavailable when adding**: behaves exactly as an add by typed coordinates does today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The add-location form MUST include a town search field alongside the existing latitude and longitude fields.
- **FR-002**: As the user types, the system MUST show the towns from the town list that match the text, matching case-insensitively, ignoring leading and trailing spaces, and matching from the start of the name or of any word in it.
- **FR-003**: The system MUST also offer a town when the typed text is within one letter (one wrong, missing or extra character) of that town's name or of the start of it. Exact and prefix matches MUST be ranked above near matches.
- **FR-004**: The match list MUST show no more than 8 towns at a time.
- **FR-005**: Picking a town MUST fill the latitude and longitude fields with that town's reference coordinates and MUST NOT save the location by itself.
- **FR-006**: The user MUST confirm the add with the existing Add action. The picked town's location MUST go through the same add flow, Singapore bounds check and duplicate rejection as a typed coordinate.
- **FR-007**: A location added from a picked town MUST end up labelled with that town's name.
- **FR-008**: When the typed (non-empty) text matches no town, the system MUST show a short "no matching town" message and keep the coordinate fields usable.
- **FR-009**: Manual entry of latitude and longitude MUST keep working exactly as today, with or without using the town field.
- **FR-010**: If the user edits a filled coordinate or changes the town text after picking, the system MUST clear the picked-town state so the form never shows a town that doesn't correspond to the coordinates.
- **FR-011**: Cancel MUST clear the town field, the match list and the coordinate fields.
- **FR-012**: Searching and picking towns MUST NOT contact the weather data provider or any other outside service, and MUST NOT add any weather-provider call to page loads.
- **FR-013**: The town list MUST contain every NEA two-hour forecast area name, including Woodlands, Sembawang, Sengkang, Punggol and Bishan, each with its reference coordinates. The list MUST include all forecast areas, including non-residential ones such as "Central Water Catchment" and "Southern Islands", since each has its own forecast.
- **FR-014**: The town field and match list MUST be usable by keyboard alone: move between matches, pick one, and dismiss the list. They MUST be announced sensibly to screen readers.
- **FR-015**: If the app records a log event for a town-based add, it MUST record the chosen town's name, not the text typed into the search field.
- **FR-016**: The town field and its match list MUST follow the app's existing visual themes in the same way as the rest of the add-location form.

### Key Entities

- **Town**: a named Singapore place the user can pick. It has a display name (as NEA spells it) and reference coordinates (latitude and longitude). The set of towns is the NEA two-hour forecast areas. Towns are reference data held by the app. They aren't saved locations and aren't stored per user.
- **Saved location** (existing): unchanged. A location added from a town is an ordinary saved location at the town's reference coordinates.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add any of Woodlands, Sembawang, Sengkang, Punggol and Bishan without leaving the dashboard or knowing coordinates, in no more than 4 actions: type, pick, (review), press Add.
- **SC-002**: 100% of the towns in the town list can be found by typing their full name and added as a saved location.
- **SC-003**: For 100% of towns added by picking, the saved location's label equals the picked town's name.
- **SC-004**: Typing "punggole", "PUNGGOL" and "tampnes" each offers the intended town among the first 3 matches.
- **SC-005**: Matches appear as the user types, with no noticeable delay (under half a second on a typical laptop).
- **SC-006**: Opening the dashboard, opening the add form and searching for towns cause zero additional requests to the weather data provider.
- **SC-007**: All existing ways of adding a location, typed coordinates included, keep working. The existing test suite passes unchanged.

## Assumptions

- "Town" means an NEA two-hour forecast area, by the owner's decision on 2026-11-14 to limit scope to town names. Estates, MRT stations, landmarks, street addresses and postal codes are out of scope. So is any third-party place search.
- The town list is fixed reference data shipped with the app. It is checked once against a live NEA two-hour forecast response during planning, and updated by hand if NEA ever changes its areas. NEA's area set is assumed to change rarely.
- A location saved at a town's own reference coordinates is labelled as that town by the app's existing nearest-area matching. Planning must confirm this with a test.
- All forecast-area reference coordinates fall inside the app's existing Singapore bounds (latitude 1.1–1.5, longitude 103.6–104.1). Planning must confirm this, especially for offshore areas such as Pulau Tekong and the Western and Southern Islands.
- Holding a fixed copy of NEA area names and coordinates is allowed under the Singapore Open Data Licence that covers data.gov.sg data.
- No aliases or alternative names are included this phase ("Admiralty" won't find Woodlands). Forgiving matching (FR-003) covers spelling slips only.
- A repeat pick of an already-saved town uses the existing duplicate rejection and message. No "select the existing entry" behaviour is added.
- This feature is independent of "Use my location" (spec 003, approved, not built). Whichever is built second must fit beside the other in the add-location form. No joint redesign is in scope.
- Matching logic that is worth testing is kept in a unit-testable form, in line with the project's testing limits (frontend tests cover pure modules only).
- The constitution is not changed. Principle I (snapshot-only weather data) and Principle II (relative API only) hold, because no new outside calls are made.
