# Feature Specification: Use My Location

**Feature Branch**: `003-use-my-location`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "Add a 'Use my location' button to the add-location flow of the Singapore weather dashboard. The browser supplies the user's position (with the browser's permission prompt as consent) and the app adds a saved location there through the existing add flow, showing the nearest forecast area as its label. Works over plain HTTP on localhost. Includes clear messages for failure cases, a small note that Firefox and Safari are not supported for this feature, a simple duplicate rule, and no logging of precise coordinates." Source assessment: `.specify/assessments/use-my-location/` (verdict go, Option B).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add my current position as a saved location (Priority: P1)

A person using the dashboard wants the weather where they are right now. Instead of looking up and typing latitude and longitude, they press "Use my location" in the add-location area. The browser asks for permission to share their position. Once they allow it, the app adds a saved location at that position, loads its weather, and shows it selected with the nearest Singapore forecast area as its label.

**Why this priority**: This is the whole point of the feature. It removes the need to know coordinates and is a usable slice on its own.

**Independent Test**: With a position permitted and set to a point inside Singapore, press the button once. A new saved location appears, is selected, shows weather and a nearest forecast area name, and persists after a page reload.

**Acceptance Scenarios**:

1. **Given** the user has no saved location at their position, **When** they press "Use my location" and allow sharing, **Then** a new saved location is added at their position, its weather is loaded, and it is selected.
2. **Given** the new location was added, **When** the user views it, **Then** the nearest Singapore forecast area is shown as its label, as for a location added by typed coordinates.
3. **Given** the user presses the button, **When** the browser is waiting for the position, **Then** the button shows a clear in-progress state and cannot be pressed again until the attempt finishes.
4. **Given** the app is opened over plain HTTP on localhost, **When** the user presses the button, **Then** the browser's permission prompt appears and the flow works without any HTTPS setup.

---

### User Story 2 - Understand and recover when it does not work (Priority: P2)

Sometimes the position cannot be obtained or cannot be used. The user sees a short, specific message saying what went wrong and what they can do next, and can still add a location by typing coordinates.

**Why this priority**: Permission is denied often enough that the feature is incomplete without clear failure handling, but it only matters once the main flow exists.

**Independent Test**: Trigger each failure (deny permission, make the position unavailable, let the request time out, use a position outside Singapore) and confirm a distinct message appears, no location is added, and manual entry still works.

**Acceptance Scenarios**:

1. **Given** the user denies the browser's permission request, **When** the attempt ends, **Then** a message explains that permission was denied and how to allow it or enter coordinates manually, and no location is added.
2. **Given** the browser cannot determine a position, **When** the attempt ends, **Then** a message says the position is unavailable, and no location is added.
3. **Given** the position request takes too long, **When** the time limit passes, **Then** a message says the request timed out and suggests trying again, and no location is added.
4. **Given** the user's position is outside the supported Singapore area, **When** the attempt ends, **Then** a message says the position is outside Singapore, and no location is added.
5. **Given** any failure message is shown, **When** the user dismisses it or retries, **Then** the add-location area returns to a normal usable state, with manual coordinate entry still available.

---

### User Story 3 - Repeating the action does not create duplicates (Priority: P2)

A user who presses the button again from the same place does not get a second, near-identical entry. If their detected position is within about 100 metres of a saved location, the app selects that existing location and tells them it is already saved.

**Why this priority**: Position readings vary slightly between attempts, and the existing exact-match duplicate check would not catch that. Without this rule the list fills with near-duplicates.

**Independent Test**: Add the current position, then press the button again with the position moved a few metres. No new entry is added, the existing one is selected, and a brief "already saved" message appears.

**Acceptance Scenarios**:

1. **Given** a saved location lies within about 100 m of the detected position, **When** the user presses the button, **Then** no new location is added, the existing one is selected, and a brief message says it is already saved.
2. **Given** the nearest saved location is more than about 100 m away, **When** the user presses the button, **Then** a new location is added as in User Story 1.
3. **Given** several saved locations are within range, **When** the user presses the button, **Then** the closest one is selected.

---

### User Story 4 - Know the feature's browser support (Priority: P3)

A user on Firefox or Safari sees a small, unobtrusive note beside the button saying the feature is not supported on those browsers. They are still free to try it, and manual entry is always available.

**Why this priority**: Behaviour on those browsers was not verified, and the note sets expectations at low cost. It does not block the main flow.

**Independent Test**: Open the add-location area in Firefox or Safari and confirm the note is visible; open it in Chrome and confirm it is not.

**Acceptance Scenarios**:

1. **Given** the user is on Firefox or Safari, **When** the add-location area is shown, **Then** a small note states that "Use my location" is not supported on their browser.
2. **Given** the user is on a supported browser, **When** the add-location area is shown, **Then** no such note appears.
3. **Given** the note is shown, **When** the user presses the button anyway, **Then** the attempt proceeds as in User Story 1, with its normal success or failure messages.

---

### Edge Cases

- The browser does not offer location access at all: the user sees the "position unavailable" message, and manual entry still works.
- The user presses the button, then the position arrives after they have left the add-location area or started another action: the result must not leave the app in an inconsistent state.
- The detected position is exactly on, or very near, the edge of the supported Singapore area: the existing coarse area check decides, and the user sees either success or the outside-Singapore message.
- The position is accurate only to a wide radius (for example IP-based on a desktop): the location is still saved at the reported position, and the nearest forecast area shown may differ from the user's true area. This is accepted for this version.
- The location is added but its weather cannot be loaded: the location is kept as an unrefreshed entry, as with typed coordinates today.
- The user presses the button rapidly more than once: only one attempt runs at a time.
- The user's position matches a saved location exactly: treated as "already saved" by the duplicate rule.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The add-location area MUST offer a "Use my location" control alongside the existing manual coordinate entry, which MUST remain available and unchanged.
- **FR-002**: Pressing the control MUST request the user's current position from the browser and MUST rely on the browser's own permission prompt as the user's consent; the app MUST NOT request a position before the user presses the control.
- **FR-003**: On success inside the supported Singapore area, the system MUST add a saved location at the reported position using the same add flow as typed coordinates, including loading its weather and showing the nearest forecast area as its label, and MUST select the new location.
- **FR-004**: The control MUST show an in-progress state while the position is being obtained and MUST prevent a second concurrent attempt.
- **FR-005**: The system MUST show a distinct, plain-language message for each of: permission denied, position unavailable, request timed out, and position outside Singapore. Each message MUST say what happened and what the user can do next, and no location is added in any of these cases.
- **FR-006**: The system MUST apply the existing Singapore area check (latitude 1.1–1.5, longitude 103.6–104.1) to the detected position.
- **FR-007**: Before adding, the system MUST compare the detected position with saved locations. If any saved location is within about 100 metres, it MUST NOT add a new one, MUST select the closest such location, and MUST show a brief message that the location is already saved.
- **FR-008**: The feature MUST work when the app is served over plain HTTP from localhost (including the project's development address), without requiring HTTPS.
- **FR-009**: The system MUST NOT write the user's precise coordinates to application logs or interaction logs for locations created through this control. It MAY log that the action occurred, its outcome category (success, already saved, or the failure type), and the resulting forecast area name, or a rounded position that cannot identify a specific building.
- **FR-010**: On Firefox and Safari, the add-location area MUST show a small, unobtrusive note that the feature is not supported on those browsers. The note MUST NOT appear on other browsers and MUST NOT block use of the control.
- **FR-011**: Failure and "already saved" messages MUST be dismissible or clear themselves on the next action, and MUST NOT prevent manual entry or another attempt.
- **FR-012**: The feature MUST NOT track the user continuously, refresh automatically as the user moves, or request position at page load.
- **FR-013**: The control, its messages and the browser note MUST follow the app's existing theming so they are legible in every theme.

### Key Entities

- **Saved location**: an existing entity, a place (position) with its stored weather snapshot and nearest-forecast-area label. This feature adds no new fields; it creates saved locations from the user's browser position.
- **Detected position**: the user's current position as reported by the browser for one attempt. It is used once to decide between adding a new location and selecting an existing one; it is not stored apart from becoming a saved location.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add their current location in two actions or fewer (press the button, allow sharing), with no coordinates typed.
- **SC-002**: When the position is permitted and inside Singapore, a new saved location with weather and a forecast-area label is shown within 10 seconds of the user allowing sharing, under normal conditions.
- **SC-003**: For fixed test positions across Singapore, 100% display the correct nearest forecast area, matching the area produced by typing the same coordinates.
- **SC-004**: Pressing the button repeatedly from the same position (including small position drift of up to about 100 m) results in exactly one saved entry.
- **SC-005**: Each of the four failure cases (permission denied, unavailable, timeout, outside Singapore) shows its own distinct message, and in 100% of cases manual entry remains usable afterward.
- **SC-006**: After using the feature, the application logs contain no precise coordinates for locations added this way.
- **SC-007**: The feature works on plain-HTTP localhost in Chrome with no extra setup.

## Assumptions

- The primary user is the app's owner or a developer using the app locally, on a desktop browser; Chrome is the verified browser. Behaviour on Firefox and Safari is unverified and unsupported for this version.
- Desktop position accuracy can be coarse (IP- or Wi-Fi-based) and may select a neighbouring forecast area; this is accepted. A real position request on the owner's machine is still to be run to see typical accuracy.
- The saved entry is the user's reported position, not a snapped forecast-area point; the forecast area is shown as a label, as it is for typed coordinates today.
- The "about 100 m" duplicate threshold is a starting default; the exact value and message wording may be tuned in planning.
- The existing coarse Singapore area check is accepted as the "outside Singapore" rule for this version.
- Out of scope: continuous tracking or auto-refresh, users outside Singapore, HTTPS setup and access over non-localhost origins (such as a LAN address), snapping to a forecast area's canonical point, reordering/renaming/import-export of locations, and changes to the project's governing principles.
- The existing add flow, weather loading and project constitution (including no weather-provider calls during page load) continue to apply unchanged.
- Dependency: the browser's built-in location capability and its permission prompt; the app cannot work if the user's browser or settings disable it, in which case the user falls back to manual entry.
