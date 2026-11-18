# Feature Specification: Private Saved Locations per Visitor

**Feature Branch**: `013-per-visitor-saved-locations`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "Handoff from `.specify/assessments/per-visitor-saved-locations/decision.md` (verdict go, Option A).
- **Problem:** every visitor to the hosted Lepak Weather app sees, and can change or delete, one shared saved-locations list. That exposes where others saved places and lets visitors undo each other's lists, which blocks the public mobile release.
- **Approach:** each visitor's browser gets a random, unguessable private key on first save, with no signup. The server keeps saved locations and snapshots filed under that key, and a visitor can see, refresh or delete only their own. The snapshot pattern and the single frontend store are unchanged."

## Clarifications

### Session 2026-11-17

- Q: What should a first-time visitor see before they've saved anything? → A: An empty list with the existing empty-state prompt (FR-010).
- Q: What happens to the places already in the shared hosted list, including the 10 seeded ones? → A: A one-off step moves them into the owner's own private list (FR-011).
- Q: How long are a visitor's saved places kept? → A: They're removed after 90 days without use; any use restarts the clock (FR-012).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - My places are mine alone (Priority: P1)

A visitor opens the hosted app on their phone or laptop. They see only the places they saved themselves, never anyone else's. When they add, refresh or delete a place, only their own list changes. Other people using the app at the same time can't see or touch it, and nothing anyone else does can change it.

**Why this priority**: This is the whole problem. Today every visitor shares one list, which exposes where people saved places and lets them delete each other's. It's the reason the URL can't be shared publicly, and it closes hosting goal G5.

**Independent Test**: Use two separate browsers (or a normal and a private window) as two visitors. Each adds different places. Confirm each sees only their own places, in the list and on the map. Confirm neither can refresh or delete the other's places, even when knowing a place's identifier.

**Acceptance Scenarios**:

1. **Given** visitor A has saved Tampines and visitor B has saved Jurong West, **When** each opens the app, **Then** A sees only Tampines and B sees only Jurong West, in both the location list and the map.
2. **Given** visitor A has saved a place, **When** visitor B tries to refresh or delete that place by its identifier, **Then** the request is refused exactly as if the place didn't exist, and A's place is unchanged.
3. **Given** visitor A has saved a place at certain coordinates, **When** visitor B saves a place at the same coordinates, **Then** B's save succeeds and each visitor has their own copy.
4. **Given** a visitor has already saved a place at certain coordinates, **When** that same visitor tries to save the same coordinates again, **Then** they get the existing "already saved" outcome, as today.
5. **Given** a visitor uses "Use my location" within 100 m of a place saved by a *different* visitor, **When** the app checks for a nearby saved place, **Then** it ignores the other visitor's place and adds a new place to this visitor's list.

---

### User Story 2 - My places are still here when I come back (Priority: P2)

A visitor saves a few places, closes the browser, and returns the next day on the same browser. Their places are still there, with the last weather snapshots they fetched, and they never had to sign up.

**Why this priority**: A private list that disappears on every visit wouldn't replace a mobile weather app. P2 because P1 still delivers privacy on its own, even if the list were short-lived.

**Independent Test**: In one browser, save two places, close the browser fully, reopen the app, and confirm both places and their last snapshots appear with no weather fetch on load.

**Acceptance Scenarios**:

1. **Given** a visitor saved places yesterday on this browser, **When** they open the app today, **Then** the same places appear with their stored snapshots, and opening the page makes no weather fetch.
2. **Given** a visitor saved places on their laptop, **When** they open the app on their phone, **Then** the phone shows its own, separate empty list, and the laptop's list is unaffected.
3. **Given** a visitor clears this site's browser data, **When** they reopen the app, **Then** they start as a new visitor with an empty list, and their previous places are no longer reachable from this browser.
4. **Given** a visitor last used their list 89 days ago, **When** they open the app, **Then** their places are still there and the 90 days start again.
5. **Given** a visitor's list has gone more than 90 days without use, **When** removal runs, **Then** that list's places and snapshots are deleted, and no other visitor's list changes.

---

### User Story 3 - The owner keeps their current places (Priority: P2)

The owner's places are in the shared hosted list today, including the 10 seeded ones. When this feature ships, the owner runs a one-off step that moves those places into the owner's own private list on the owner's browser. Nobody else ever sees them again.

**Why this priority**: Without it, shipping P1 would either expose the old shared list or lose the owner's places. P2 because it runs once and affects one person.

**Independent Test**: Start from a database holding the pre-feature shared places. Confirm that a new visitor sees none of them. Run the owner's one-off step, then confirm the owner's browser shows all of them with their snapshots, and a second browser still sees none.

**Acceptance Scenarios**:

1. **Given** the hosted database holds the pre-feature shared places, **When** a new visitor opens the app after this feature ships, **Then** they see an empty list.
2. **Given** the owner runs the one-off step for their own browser (using that browser's private identifier), **When** they open the app in that browser, **Then** all pre-feature places appear in their list with their stored snapshots.
3. **Given** the one-off step has run, **When** anyone other than the owner tries to run it again, **Then** it has no effect.

---

### User Story 4 - I'm told where my places are kept (Priority: P3)

A privacy-minded visitor wants to know what happens to the places they save. The app tells them, in plain words, that saved places are stored on the app's server and tied to this browser only, and that they aren't shown to anyone else.

**Why this priority**: The server holds every visitor's saved coordinates (concept trade-off). Disclosure keeps the existing privacy notice truthful. P3 because it's wording, not behaviour.

**Independent Test**: Open the privacy explanation on the hosted app and confirm it describes how saved places are stored, and that none of its existing statements has become false.

**Acceptance Scenarios**:

1. **Given** the hosted app shows its privacy notice, **When** a visitor opens the explanation, **Then** it says that saved places are kept on the app's server, linked to this browser, and not visible to other visitors.
2. **Given** the notice currently says the app uses "no cookies", **When** this feature ships, **Then** that statement is still true, or the notice is updated in the same change so it never makes a false claim.

---

### Edge Cases

- **Browser storage blocked or unavailable** (some private modes, or storage disabled): the visitor can still add and view places for that session. The places just aren't remembered after the browser closes. The app must not show a crash, and must not fall back to any shared list.
- **First request with no key, or with an unknown or malformed key**: the visitor is treated as new, with an empty list or the FR-010 starting state. No error reveals whether other keys exist.
- **Two tabs in the same browser**: both show the same visitor's list. A change in one appears in the other after reload, as today.
- **A guessed or enumerated place identifier**: refresh or delete of a place not owned by the requester is refused with the same response as a missing place, so ownership can't be probed.
- **Duplicate save racing in two tabs of the same visitor**: one succeeds and the other gets the "already saved" outcome, as today.
- **A visitor's key is copied to another browser** (for example by someone with access to their device): that browser sees the same list. This is accepted. The key is the only thing granting access, so it must never appear in logs, URLs or error messages.
- **Very many visitors**: this feature doesn't change how often weather is fetched per refresh. Per-device limits on weather updates still apply. Overall upstream capacity is a launch question (see Assumptions), not a requirement of this feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST give each visitor a private, randomly generated, unguessable identifier, held by that visitor's browser, without asking for signup, login, email or any personal details.
- **FR-002**: The system MUST associate every saved location, and its weather snapshot, with exactly one visitor identifier.
- **FR-003**: Listing saved locations MUST return only the requesting visitor's locations. Every view built from that list (location cards, hero, map pins, "Use my location" nearby check) MUST therefore show only that visitor's places.
- **FR-004**: Viewing, refreshing or deleting a saved location MUST succeed only for the visitor who owns it. For anyone else it MUST give the same outcome as a location that doesn't exist.
- **FR-005**: The rule that a list can't hold two places at the same coordinates MUST apply within one visitor's list only. Different visitors MAY save the same coordinates, and the existing "already saved" outcome MUST be kept for duplicates within one list.
- **FR-006**: A visitor's list and snapshots MUST persist across browser restarts on the same browser for as long as that browser keeps its stored identifier.
- **FR-007**: Opening the app MUST NOT fetch weather data. Weather is still fetched only when a visitor adds or refreshes one of their own places (constitution Principle I, unchanged).
- **FR-008**: The visitor identifier MUST NOT appear in server logs, interaction logs, URLs, analytics events or error messages.
- **FR-009**: The way the identifier reaches the server MUST NOT let another website trigger a refresh, delete or add on a visitor's behalf.
- **FR-010**: A visitor with no saved places MUST see an empty list with the app's existing empty-state prompt (add a place, town search, "Use my location"). No places are added for them automatically.
- **FR-011**: Locations saved before this feature (the current shared list in the hosted database, including the 10 seeded places) MUST be moved into the owner's own private list by a one-off step that only the owner can perform. After this feature ships and until that step runs, they MUST NOT be visible to any visitor. After it runs, they're visible only in the owner's browser, with their stored snapshots kept.
- **FR-012**: A visitor's saved places and snapshots MUST be deleted once that visitor's list has gone 90 days without use. "Use" means opening the app with that list, or adding, refreshing or deleting one of its places. Any use restarts the 90 days. Removal MUST NOT affect any other visitor's list, and MUST NOT require a weather fetch.
- **FR-013**: Where the app shows its privacy notice, the explanation MUST state that saved places are kept on the app's server, linked to this browser, and not shown to other visitors. Every existing statement in the notice (including "no cookies") MUST remain true or be corrected in the same change.
- **FR-014**: Existing per-device limits on adding and refreshing places MUST continue to apply unchanged.
- **FR-015**: If the browser can't store the identifier, the app MUST still work for the current session using a temporary identifier, and MUST NOT show or change any other visitor's places.

### Key Entities

- **Visitor**: an anonymous person using one browser, known to the system only by the private identifier that browser holds. No name, email, account or other personal data.
- **Visitor identifier**: the random, unguessable value that proves which visitor's list a request belongs to. It's held by the browser and acts like a password for that one list.
- **Saved location**: a place a visitor saved (coordinates, the matched area label and its latest weather snapshot). It belongs to exactly one visitor. Two visitors' locations may share coordinates.
- **Weather snapshot**: unchanged. The stored result of the last add or refresh for one saved location.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a two-visitor check, locations from the other visitor shown in either visitor's list or map: 0 (baseline today: all of them).
- **SC-002**: Attempts by one visitor to refresh or delete another visitor's place that succeed: 0 of all attempts (baseline today: every attempt succeeds).
- **SC-003**: Visitors who must sign up or enter personal details before saving a place: 0.
- **SC-004**: A visitor returning on the same browser after closing it sees 100% of the places they saved, with no weather fetch on opening.
- **SC-005**: Adding a first place takes no more steps than it does today.
- **SC-006**: Occurrences of a visitor identifier in logs, URLs or analytics during a full browser check: 0.
- **SC-007**: Lists unused for more than 90 days that still exist after the next removal run: 0. Lists used within 90 days that are removed: 0.
- **SC-008**: Pre-feature shared places visible to anyone but the owner after release: 0. Pre-feature places missing from the owner's list after the one-off step: 0.
- **SC-009**: The owner is willing to share the hosted URL publicly (qualitative; baseline: the URL is deliberately unadvertised).

## Assumptions

- A list tied to one browser is enough for this release. Moving a list to another device is out of scope; a later "move my list" code is left possible but not built.
- Losing a browser's stored identifier (clearing site data, switching browsers) loses access to that list, and this is accepted, matching how the hosting concept treated per-visitor lists.
- The server keeps holding saved coordinates, now per visitor. The owner accepts this and discloses it through the privacy notice (FR-013).
- The per-device weather limits (30 adds or refreshes per device per 10 minutes) stay as they are and are enough to stop someone from flooding the app with new lists.
- Upstream capacity for public traffic is a launch question, not part of this feature. Before promoting the URL, the owner decides the expected visitor count and whether to request a Production data.gov.sg key. With the Development key, all refreshes share one paced queue at about one full refresh every 10 seconds.
- 90 days without use is long enough that regular visitors never lose their list, and short enough that one-time visitors' coordinates aren't kept for long. Removal may run on any schedule as long as no list survives much past 90 days unused. The exact schedule is a planning choice.
- The owner's one-off step only needs to work once, for one person. It doesn't need a visible menu entry for other visitors.
- The hosted database's free plan has ample headroom for rows that now grow with visitors.
- Out of scope: accounts, signup and login; shared or team lists; storing lists or snapshots in the browser; sharing snapshots between visitors who saved the same place; access gating; any change to weather data, snapshot contents, map layers or the Principle I exceptions.
- Dependencies: the hosted app (spec 010) and the privacy notice (spec 012).
