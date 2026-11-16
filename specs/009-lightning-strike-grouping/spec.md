# Feature Specification: Lightning Strike Grouping for Storm-Scale Volumes

**Feature Branch**: `009-lightning-strike-grouping`

**Created**: 2026-11-16

**Status**: Draft

## Clarifications

### Session 2026-11-16

- Q: In the small card map, what should tapping a lightning group mark do? → A: It opens fullscreen, centred and zoomed on that group. The card map itself never zooms.
- Q: How should a group mark show how recent its newest strike is? → A: Both. Its fill fades by the newest strike's age in the same 5-minute steps as single bolts, and a short age label (for example "2m") sits next to the count.
- Q: Should grouping kick in wherever strikes crowd at any volume, or only above a count threshold? → A: Wherever strikes crowd at the current zoom, at any volume. There's no count threshold.
- Q: How should the 37,242-strike storm replay be kept in the repository? → A: The real capture, committed compressed and trimmed to the fields the app uses (expected ≤ about 1 MB), expanded when the replay loads.
- Q: What should "phone-class device" mean when checking the phone freeze limit? → A: A desktop CPU slowed 4× is the repeatable test, plus one manual pass on a real mid-range phone (Android or iPhone, about 3 years old) before release.

**Input**: User description: the go handoff in `.specify/assessments/lightning-strike-grouping/decision.md` (verdict: go, Option B). During large storms (15,000–37,000 strikes in an hour, mostly over Singapore), the lightning map freezes the page for seconds to tens of seconds, and fullscreen makes it worse. When strikes crowd an area, show one themed group mark with how many strikes there are and how recent the newest is. Zooming in splits groups into single bolts with popups, as today. Where strikes don't crowd, behaviour stays as in spec 007. Also: no double drawing when fullscreen is open, smaller refresh data, a readable strike count, a storm-scale replay for testing, and a timing record that covers the full drawing work. Diagnostics: `.specify/assessments/lightning-strike-grouping/diagnostics.md`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The map stays usable during a big storm (Priority: P1)

During a large storm, a user turns the lightning layer on (or refreshes it) and keeps using the map: panning, zooming, opening and closing fullscreen, and switching the layer off and on. Nothing freezes. Today the same storm blocks the page for 15 seconds on load and another 18 seconds on opening fullscreen.

**Why this priority**: A frozen page is the problem. Until it's fixed, the only workaround is to switch lightning off, which hides it exactly when it matters. This story alone makes the layer usable in storms.

**Independent Test**: Replay the captured 37,242-strike window. With the layer on, pan, zoom, open fullscreen, close it and toggle the layer, in the card map and in fullscreen. Measure the longest freeze of the page during each action.

**Acceptance Scenarios**:

1. **Given** a storm-scale window (37,242 strikes) is replayed, **When** the user turns the lightning layer on, **Then** lightning appears and the page stays responsive throughout, with no freeze longer than the SC-001 limit.
2. **Given** lightning from a storm-scale window is shown in the card map, **When** the user opens fullscreen, **Then** fullscreen opens without a freeze longer than the SC-001 limit, and closing it is equally quick.
3. **Given** a storm-scale window is shown, **When** the user pans and zooms, **Then** the map follows the gesture without visible stalls.
4. **Given** a storm-scale window is shown, **When** time passes and strikes age (the periodic age update), **Then** the map shows no visible stutter.
5. **Given** a storm-scale window is shown, **When** the user turns the layer off and on again, **Then** each switch completes without a freeze longer than the SC-001 limit.

---

### User Story 2 - See where and how recently lightning is striking (Priority: P2)

When many strikes crowd an area, the user sees one group mark per area instead of thousands of overlapping bolts. Each group mark shows how many strikes it holds and how recent its newest strike is, in the active theme's lightning colours. Zooming in splits groups into smaller groups and then into single bolts. Each single bolt keeps today's look, age fade and popup.

**Why this priority**: Without grouping, 37,000 overlapping bolts are unreadable even if the page doesn't freeze. Grouping turns a smear into "where is it busiest, and where is it happening now".

**Independent Test**: Replay the storm window and view the whole island. The busiest area and the area with the most recent activity can be named without opening any popup. Zoom in on one group until single bolts appear, then open a bolt's popup.

**Acceptance Scenarios**:

1. **Given** many strikes fall close together at the current zoom, **When** the user views the map, **Then** they appear as one group mark showing the number of strikes in it.
2. **Given** two group marks, one whose newest strike is 2 minutes old and one whose newest is 50 minutes old, **When** the user compares them, **Then** the more recent group has the stronger fill and reads "2m", while the other is faded and reads "50m", on every theme.
3. **Given** a group mark in fullscreen, **When** the user selects it, **Then** the map zooms in on that group's area, splitting it into smaller groups or single bolts.
4. **Given** a group mark in the card map, **When** the user taps or clicks it, **Then** fullscreen opens centred and zoomed on that group's area.
5. **Given** the user has zoomed in until strikes no longer crowd, **When** they view the map, **Then** each strike is a single bolt at its own position with today's age fade, and selecting it shows today's popup (type, clock time, minutes ago).
6. **Given** the user switches theme, **When** group marks and bolts are on the map, **Then** they take on the new theme's lightning colours at once, without fetching lightning again.
7. **Given** a saved-location pin sits near a group mark, **When** the user views the map, **Then** the pin stays on top and selectable, and the group mark can't be mistaken for a pin or a single bolt.

---

### User Story 3 - Normal days look and behave as today (Priority: P2)

On a typical day (no strikes, a few, or a few hundred), the lightning layer looks and behaves exactly as spec 007 defined: one bolt per strike, age fade, popups, empty and unavailable messages.

**Why this priority**: Most hours have no or few strikes. The storm fix must not degrade the common case.

**Independent Test**: Load the demo window (3 strikes) and the busy fixture (~370 strikes). Confirm every strike shows as a single bolt and spec 002 and 007 checks still pass.

**Acceptance Scenarios**:

1. **Given** a window of about 370 strikes spread across the region, **When** the user views the map at the default zoom, **Then** strikes appear as single bolts, apart from any spots where strikes truly overlap at that zoom.
2. **Given** the demo window (strikes aged 2, 30 and 55 minutes), **When** the user views the map, **Then** three single bolts appear, the newest identifiable as newest (spec 007 SC-006).
3. **Given** no strikes in the last hour, or lightning data is unavailable, **When** the layer is on, **Then** today's empty or unavailable message shows and the rest of the dashboard is unaffected.

---

### User Story 4 - Readable count and less data on mobile (Priority: P3)

The status strip shows large counts with thousands separators ("37,242 strikes in the last hour"). A storm-scale refresh transfers much less data than today's 6.5 MB, which matters on mobile connections.

**Why this priority**: These are small but visible quality issues found during the assessment. They're useful but not critical next to the freeze.

**Independent Test**: Replay the storm window. Read the status strip. Measure the bytes transferred for one lightning refresh.

**Acceptance Scenarios**:

1. **Given** 37,242 strikes in the last hour, **When** the status strip shows the count, **Then** it reads "37,242 strikes in the last hour".
2. **Given** a storm-scale window, **When** the user refreshes lightning, **Then** the data transferred is at or below the SC-005 limit.

---

### User Story 5 - The owner can measure storm-scale behaviour (Priority: P3)

The owner can reproduce a storm-scale window on demand, without waiting for a real storm. The refresh timing record (spec 007, developer console only) reports drawing time that covers the full work of putting lightning on the map, so it agrees with what the user experiences.

**Why this priority**: Most days have no storm. Without a replay and a truthful timing record, regressions at storm scale go unnoticed. Today's record reported 141 ms while the page froze for 15 s.

**Independent Test**: Start the app with the storm replay. Turn lightning on. Compare the timing record's drawing time with a browser performance recording of the same action.

**Acceptance Scenarios**:

1. **Given** the app is started in development with the storm-scale replay selected, **When** the owner turns lightning on, **Then** the captured storm window (37,242 strikes) is shown, with ages relative to now.
2. **Given** a lightning refresh at storm scale, **When** the timing record is logged, **Then** its drawing time is within 20% of the drawing time measured by a browser performance recording of the same action.
3. **Given** the production build, **When** the app runs, **Then** the replay can't be selected.

---

### Edge Cases

- A refresh that adds strikes to an area: only that area's marks change (bolts may merge into a group, or a group's count grows). The rest of the map and the view (centre and zoom) stay put.
- A group whose strikes all share one exact position (near-duplicates or repeated reports): zooming to the maximum still can't split them. They must be selectable as a list or a combined popup, not stuck as an unsplittable group.
- Strikes far outside Singapore (Johor, Riau islands): grouped the same way. They stay included, as in spec 002.
- The periodic age update moves strikes into older age steps. Group marks update their fade and age label without visibly jumping or regrouping.
- Strikes age past 60 minutes between refreshes. They drop out of groups and counts, and a group that empties disappears.
- A refresh arrives while the user is mid-pan or mid-zoom. The update doesn't interrupt the gesture.
- A refresh fails at storm scale and the previous window is served as stale. Groups keep showing it with today's stale wording.
- Fullscreen is open while a refresh arrives. Only the visible map does the drawing work.
- A theme change at storm scale recolours group marks and bolts without a freeze longer than the SC-001 limit.
- Reduced-motion preference: zooming into a group jumps rather than animates, as location focus does today.
- The Hero's "lightning near you" check still uses every individual strike, not group positions, so grouping never changes its answer.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When strikes crowd together at the current zoom, the map MUST show them as one group mark instead of individual bolts. The amount of drawing work for the lightning layer MUST stay bounded however many strikes are in the window.
- **FR-002**: A group mark MUST show the number of strikes it holds. Large numbers MUST be abbreviated so they fit (for example "1.2k").
- **FR-003**: A group mark MUST show how recent its newest strike is in two ways:
  - its fill fades by the newest strike's age, in the same 5-minute steps as single bolts;
  - a short age label next to the count gives the newest strike's age in whole minutes ("now" under 1 minute, otherwise for example "2m", up to "59m").

  So a group with a newer strike is visibly more recent than one with only older strikes, even without relying on colour.
- **FR-004**: Group marks MUST take their colours from the active theme's lightning colours. They MUST meet the constitution's 3:1 contrast for non-text marks on every theme and basemap, and 4.5:1 for their count and age text at every fade step, and MUST be visually distinct from saved-location pins and single bolts.
- **FR-005**: Selecting a group mark in fullscreen MUST zoom the map to that group's area, so it splits into smaller groups or single bolts. Selecting a group mark in the card map MUST open fullscreen centred and zoomed on that group's area. The card map itself stays non-interactive and never zooms. A group that can't split further at maximum zoom MUST instead open a popup that lists its strikes (type, clock time, minutes ago), newest first. Strikes beyond the 20 newest are summarised as "and N more".
- **FR-006**: When strikes don't crowd at the current zoom, each strike MUST appear as a single bolt with spec 007's look, age fade and popup.
- **FR-007**: Grouping MUST apply wherever strikes crowd at the current zoom, at any volume. There is no strike-count threshold that switches grouping on or off. At about 370 strikes spread across the region (the busy fixture), the default view MUST show single bolts except where strikes truly overlap.
- **FR-008**: Group marks and bolts MUST stay below saved-location pins, so pins remain visible and selectable, as spec 007 required.
- **FR-009**: Opening fullscreen MUST NOT make the map hidden behind it keep doing lightning drawing work. Closing fullscreen MUST restore the card map's lightning without a freeze longer than the SC-001 limit.
- **FR-010**: The periodic age update MUST update recency on group marks and bolts without regrouping strikes that haven't changed and without a freeze longer than the SC-001 limit.
- **FR-011**: A theme change MUST recolour group marks and bolts immediately and MUST NOT fetch lightning again.
- **FR-012**: The status strip MUST show the strike count with thousands separators.
- **FR-013**: A storm-scale lightning refresh MUST transfer no more data than SC-005 allows, without dropping any strike from the counts, the groups or the Hero's "near you" check.
- **FR-014**: The Hero's "lightning near you" verdict MUST keep using every individual strike within its 10 km rule. Grouping MUST NOT change its result.
- **FR-015**: How and when lightning is fetched MUST stay unchanged: only on an explicit user action, through the existing shared 2-minute server cache, never during a page load or in the background, and never stored (constitution Principle I lightning exception).
- **FR-016**: In development only, the owner MUST be able to start the app with a storm-scale replay of the real window captured on 2026-11-16 (37,242 strikes), with ages shifted to the current time. The capture MUST be committed compressed and trimmed to the fields the app uses (position, time, type, label), at no more than about 1 MB in the repository, and expanded when the replay loads. The replay MUST NOT be selectable in the production build, and automated tests MAY read the same capture.
- **FR-017**: The refresh timing record (developer console only, spec 007) MUST measure drawing time up to the point where lightning is fully on the map. It MUST also report how many group marks and single bolts were drawn.
- **FR-018**: Group marks and single bolts MUST NOT become keyboard tab stops, consistent with spec 007. The status strip MUST remain the accessible summary of how many strikes there are.
- **FR-019**: Empty, unavailable, stale and loading states MUST behave and read as in specs 002 and 007.

### Key Entities

- **Strike**: one recorded lightning event (position, time, type, label), as today. It is the source for groups, single bolts, counts and the Hero check.
- **Strike group**: a set of strikes shown as one mark at the current zoom. It carries the number of strikes, the time of its newest strike (which gives its fade step and age label) and the area it covers. It exists only for display and is never stored.
- **Storm replay window**: the real lightning window captured on 2026-11-16 (37,242 strikes), stored compressed with only position, time, type and label. Used in development and tests to reproduce storm-scale behaviour, with times re-based to now.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With the 37,242-strike replay on a typical laptop, turning lightning on, refreshing, panning, zooming, opening or closing fullscreen, switching theme and toggling the layer each freeze the page for no more than 200 ms at a time. Baseline: 15.1 s on turning on, 17.9 s on opening fullscreen.
- **SC-002**: With the same replay, none of the actions in SC-001 freezes the page for more than 500 ms at a time:
  - on a desktop browser with its CPU slowed 4× (the repeatable check);
  - on one manual pass on a real mid-range phone (Android or iPhone, about 3 years old) before release, where the page also must not reload or crash.

  Baseline: 8.5 s at 15,000 strikes with the 4× slowdown.
- **SC-003**: With the same replay, lightning appears on the map within 2 seconds of the user's action on a typical laptop on a local connection, cached or uncached. This excludes upstream provider time beyond today's.
- **SC-004**: Viewing the whole island during the storm replay, the owner names the busiest area and the area with the most recent strikes correctly without opening a popup, on all 6 themes.
- **SC-005**: A storm-scale refresh (37,242 strikes) transfers at most 1.5 MB. Baseline: 6.5 MB.
- **SC-006**: At normal volumes (the 3-strike demo and the ~370-strike busy fixture), every spec 002 and spec 007 success criterion still holds, including SC-006 (the newest of three strikes is identifiable) and pins staying on top.
- **SC-007**: The timing record's drawing time is within 20% of a browser performance recording of the same storm-scale action. Baseline: it reported 141 ms against a measured 15.1 s.
- **SC-008**: The page's memory use with the storm replay shown is at most half of today's. Baseline: about 203 MB of script memory at 37,242 strikes.

## Assumptions

- The owner approved grouping and a proven third-party clustering approach (decision.md, 2026-11-16). Which one, and where it runs, is a planning decision, as long as FR-004 (theme colours), FR-013 (data size) and FR-015 (fetch rules) hold.
- Grouping applies wherever strikes crowd at any volume (FR-007, confirmed 2026-11-16), rather than switching on at a fixed count. That keeps behaviour continuous: a few hundred spread-out strikes still look like today's single bolts, and a storm is grouped automatically.
- "Freeze" means one uninterrupted stretch where the page can't respond to input. 200 ms on a laptop and 500 ms on a phone-class device are the limits, in line with common responsiveness guidance. Phone behaviour is checked repeatably with a 4× CPU slowdown on a desktop browser, and confirmed once by hand on a real mid-range phone before release (SC-002).
- The storm replay is the window captured on 2026-11-16 (37,242 strikes, 95% over Singapore). It's kept compressed and trimmed in the repository (FR-016), with timestamps re-based at load. It's public data.gov.sg lightning data with no personal information.
- Reducing transferred data (SC-005) can come from compression, a more compact format, or grouping before sending. The choice is for planning, but no strike may be lost from counts or the Hero check (FR-013, FR-014).
- Single bolts, pins, basemaps and controls keep spec 007's look. Only the new group mark is designed here.
- Out of scope: changing when or how often lightning is fetched (including background pre-fetching), incremental updates between refreshes, density heatmaps, lightning history, alerts or trends, performance of other layers, and the Hero's 10 km rule.
- The existing developer-only timing record (spec 007) is the channel for drawing time. Nothing is added to the dashboard UI for diagnostics.
