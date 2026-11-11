# Feature Specification: Persist Saved Locations

**Feature Branch**: `001-persist-saved-locations`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "add a new feature that will save the location to the sqlite database when adding a new location and in addition, when the weather app restart, it will automatically pull and list all the saved location."

## Clarifications

### Session 2026-11-11

- Q: Should a saved location carry a user-entered name, or be identified only by coordinates? → A: Coordinates only; the displayed label comes from the weather area (for example "Bishan").
- Q: In what order are saved locations listed after a restart, and which is selected first? → A: Newest first; the most recently added location is listed and selected first.
- Q: Which coordinates are valid when adding a location? → A: Singapore only; coordinates outside Singapore are rejected with a clear message.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Added locations are saved permanently (Priority: P1)

A user adds a new location to the weather dashboard. The location is stored in the app's database as soon as it is added, so it is not lost when the app stops or the page is closed.

**Why this priority**: Without durable saving, nothing else in this feature has value; every location would vanish on restart.

**Independent Test**: Add a location, then inspect the stored data (or reload the page without restarting) and confirm the location and its latest weather snapshot are present.

**Acceptance Scenarios**:

1. **Given** the app is running with no saved locations, **When** the user adds a valid location, **Then** the location appears in the list and is recorded in the database.
2. **Given** a location was already saved at the same coordinates, **When** the user adds it again, **Then** no duplicate is stored and the user is told it already exists.
3. **Given** the user submits invalid details (for example, coordinates outside Singapore), **When** they try to add the location, **Then** nothing is saved and a clear error is shown.

---

### User Story 2 - Saved locations are listed automatically after restart (Priority: P1)

When the app is restarted, the user opens it and immediately sees every location they previously saved, without re-entering anything.

**Why this priority**: This is the user-visible payoff of saving, and the second half of the request.

**Independent Test**: Add two locations, stop and restart the app, open it, and confirm both locations are listed.

**Acceptance Scenarios**:

1. **Given** three locations were saved before a restart, **When** the app starts and the user opens it, **Then** all three are listed with their last stored weather.
2. **Given** saved locations exist, **When** the app starts, **Then** the first location is selected automatically so its details are shown.
3. **Given** no locations have ever been saved, **When** the app starts, **Then** an empty state invites the user to add a location.

---

### User Story 3 - Saved data stays intact and consistent (Priority: P2)

Removing a location deletes it permanently, and a restart never changes, duplicates or drops the remaining saved locations.

**Why this priority**: Persistence is only trustworthy if deletions and repeated restarts behave predictably.

**Independent Test**: Delete one of several saved locations, restart the app, and confirm only the remaining locations are listed, in the same order as before.

**Acceptance Scenarios**:

1. **Given** several saved locations, **When** the user deletes one and the app restarts, **Then** the deleted location does not return.
2. **Given** saved locations, **When** the app is restarted multiple times, **Then** the list is identical each time.

---

### Edge Cases

- The stored data cannot be read at startup (missing, locked or corrupt): the app still opens, shows a clear error, and does not discard existing data.
- Saving fails when a location is added: the user sees an error and the location does not appear as if saved.
- A location is saved but its first weather refresh fails: the location is still kept and shown as not yet refreshed, and can be refreshed later.
- Restart happens while a location is being added: the location is either fully saved or not saved at all, never half-saved.
- The user has a large number of saved locations: the list still loads fully at startup.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store each newly added location (identified by its coordinates) durably at the moment it is added.
- **FR-002**: System MUST reject a location whose coordinates match one already saved, and tell the user.
- **FR-003**: System MUST reject missing or non-numeric coordinates, and coordinates outside Singapore, without saving anything, and show a clear error.
- **FR-004**: System MUST keep the latest weather snapshot with each saved location so it can be shown after a restart without fetching weather again.
- **FR-005**: On startup, System MUST make all saved locations available to the user automatically, with no user action.
- **FR-006**: System MUST list saved locations newest first (most recently added at the top), in the same order across restarts.
- **FR-007**: System MUST select the first listed (newest) saved location by default after startup so its details display.
- **FR-008**: System MUST show an empty state when no locations are saved.
- **FR-009**: System MUST permanently remove a deleted location and its weather snapshot from storage.
- **FR-010**: System MUST show a clear error, and MUST NOT delete existing saved data, if saved locations cannot be loaded or saving fails.
- **FR-011**: System MUST save a location even if its first weather refresh fails, marking it as not yet refreshed.

### Key Entities *(include if feature involves data)*

- **Saved Location**: A place the user wants to track. Has a latitude and longitude (unique as a pair) and a creation time. It has no user-entered name; it is labelled by the weather area from its snapshot.
- **Weather Snapshot**: The most recent conditions, forecasts and readings for a saved location, plus when they were last refreshed. Belongs to exactly one saved location and is replaced on each refresh.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of locations successfully added are still listed after the app is restarted.
- **SC-002**: After a restart, all saved locations are visible within 3 seconds of opening the app, for up to 50 saved locations.
- **SC-003**: Users never need to re-enter a location they have previously added (zero re-entry across 10 consecutive restarts).
- **SC-004**: Deleted locations do not reappear after restart in 100% of cases.
- **SC-005**: When storage is unavailable, 100% of attempts to add or load locations show a clear error and no previously saved data is lost.

## Assumptions

- The app is a single-user, single-device dashboard; there are no accounts or per-user separation of saved locations.
- Locations are identified by coordinates only, and the same coordinates cannot be saved twice.
- Saving and loading use the app's existing local database; no cloud sync or export is in scope.
- Weather is not re-fetched on startup; the last stored snapshot is shown, and the user can refresh manually.
- Much of this behaviour may already exist in the current app. This spec defines the required behaviour so it can be verified and any gaps closed, rather than assuming everything must be built from scratch.
- Reordering, renaming and bulk import/export of saved locations are out of scope.
