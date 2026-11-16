# Feature Specification: Today's UV Trend in the UV Tile

**Feature Branch**: `008-uv-hourly-trend`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: (none typed). The decision handoff from `.specify/assessments/uv-hourly-trend/decision.md` (verdict go, Option B, 2026-11-15) is the feature description: "Someone checking the Singapore dashboard sees only the latest hour's UV reading and can't tell whether UV is rising, at its peak or falling, or how long it has been at a level that calls for sun protection. NEA publishes no UV forecast. Option B: the UV tile gains a compact hourly view of today, 07:00–19:00, from the hourly list the existing UV call already returns, with the UV 3 protection level and NEA's usual 11:00–15:00 peak marked, and a line giving the direction and hours so far at UV 3 or more. No estimated future hours."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See how UV has moved today (Priority: P1)

When I look at the UV tile, I see today's UV readings hour by hour from 7 am to 7 pm, next to the current value and band I see today. Hours NEA has already reported show their reading, coloured by band. Hours not reported yet are visibly empty. A short line tells me whether UV is rising, steady or falling, so I can judge whether it's getting worse or easing off.

**Why this priority**: It's the core of the feature. It turns one number into a direction, using data the app already receives.

**Independent Test**: Refresh a location in the afternoon. Compare each hour shown with NEA's hourly UV readings for that day, and check that the direction line matches the last two readings.

**Acceptance Scenarios**:

1. **Given** a location refreshed today at 15:10, **When** I select it, **Then** the UV tile shows one slot per hour from 07:00 to 19:00, with readings in the slots up to the latest reported hour and empty slots after it.
2. **Given** reported hours, **When** I look at the slots, **Then** each reported slot shows its value and is coloured by its band (Low, Moderate, High, Very High, Extreme), using the active theme's UV colours.
3. **Given** the latest reading is higher than the hour before, **When** I look at the tile, **Then** it says "Rising". It says "Falling" when lower and "Steady" when equal.
4. **Given** only one hour has been reported today, **When** I look at the tile, **Then** no direction is shown, because there's nothing to compare it with.
5. **Given** the trend is shown, **When** I look at the tile, **Then** the current value, band label and 0–11 gauge are still shown as before.
6. **Given** any snapshot, **When** I look at the slots, **Then** no empty slot ever shows a value, estimate or "typical" figure.

---

### User Story 2 - Know how much of today has been at Moderate UV or above (Priority: P1)

The tile shows how many hours so far today reached UV 3 or more, which is Moderate or higher on the UV index scale. The hourly view marks that level, and marks 11 am – 3 pm as the time NEA says UV usually peaks, labelled as NEA's general advice. So I can tell how long it has been high, and when it's usually worst, without the app guessing about later today.

**Why this priority**: It answers the "safe sun hours" question with official guidance and real readings only. It ships with Story 1, in the same tile.

**Independent Test**: For a refreshed day, count NEA's hourly readings of 3 or more up to the snapshot time and compare with the number shown. Check that the 11 am – 3 pm marking and the UV 3 (Moderate) marking are visible and labelled.

**Acceptance Scenarios**:

1. **Given** today's readings so far are 0, 0, 1, 3, 5, 7, 6, **When** I look at the tile, **Then** it says 4 hours so far at UV 3 or more.
2. **Given** no hour so far has reached 3, **When** I look at the tile, **Then** it says no hours so far at UV 3 or more.
3. **Given** the hourly view is shown, **When** I look at it, **Then** the UV 3 level (start of Moderate) is marked, and the 11:00–15:00 span is marked and labelled as NEA's usual peak.
4. **Given** the tile is shown, **When** I read it, **Then** it carries one short guidance line built only from published wording: UV usually peaks 11 am – 3 pm (NEA), and use SPF 30 or higher sunscreen, applied 20–30 minutes before going into the sun (HealthHub).
5. **Given** the tile is shown, **When** I read it, **Then** it says the reading is nationwide, measured at Changi, and gives the time the readings are as of (the provider's own update time, not the refresh time).

---

### User Story 3 - Read old or empty snapshots correctly (Priority: P2)

When the snapshot is from earlier today, from a previous day, or has no UV readings, the tile says so plainly. A morning snapshot doesn't look like the rest of the day was zero, and a blank chart never appears.

**Why this priority**: Snapshots only change on refresh, so these states will happen daily. They don't add new value, but without them Stories 1–2 would mislead.

**Independent Test**: Open locations refreshed (a) this morning, (b) yesterday, (c) before this feature existed, and (d) during an upstream error. Check the message each one shows.

**Acceptance Scenarios**:

1. **Given** a snapshot taken today at 09:30, when the provider last updated its readings at 09:11, **When** I select the location in the afternoon, **Then** the tile shows the readings up to 09:00 with "as of 09:11" and the later slots empty. It never shows zeros for the later hours.
2. **Given** a snapshot from a previous day, **When** I select the location, **Then** the hourly view is labelled with that day's date, not as today. No direction line is shown, and the count reads as that day's count.
3. **Given** a snapshot taken overnight (after the last evening reading, before the first morning one), **When** I select the location, **Then** the tile shows the previous day's readings labelled with that day's date, as in scenario 2. The data source keeps returning that day's list overnight.
4. **Given** a snapshot with an empty hourly list, **When** I select the location, **Then** the tile says there are no UV readings yet in place of the hourly view.
5. **Given** a location last refreshed before this feature existed, **When** I select it, **Then** the tile shows today's current-value view as before, with a note that the hourly view appears after the next refresh. Every other tile is unchanged.
6. **Given** the UV data is unavailable at refresh (provider error), **When** I select the location, **Then** the tile shows "Unavailable" as today, with no hourly view and no direction, and the rest of the refresh succeeds.

---

### Edge Cases

- **Readings arrive newest first**: the order on screen is always 07:00 → 19:00, left to right.
- **A missing hour inside the day** (for example, 11:00 absent but 12:00 present): that slot is empty and marked as no reading. Direction compares the latest reading with the most recent earlier reading.
- **A reading outside 07:00–19:00**: it isn't shown in the hourly view, but still counts as the current value if it's the latest.
- **A non-numeric reading**: treated as a missing hour, never as 0.
- **Values above 11**: shown with their true value and the Extreme band; the slot doesn't overflow the tile.
- **All readings 0 (overcast day or very early)**: the slots show 0 as reported. The count reads no hours at UV 3 or more.
- **Snapshot exactly at the hour boundary** (for example, 15:00 with the 15:00 reading present): the 15:00 slot is filled.
- **Theme change / phone width**: the hourly view follows the active theme. All 13 slots stay readable at phone width without horizontal scrolling. If they can't, the tile falls back to the text lines only (direction, count, guidance) and keeps them readable.
- **Hero summary**: unchanged; it still mentions UV only at High (6) and above, even though the tile marks 3.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On each location create or refresh, the system MUST keep today's hourly UV readings (hour and value) from the UV data it already receives, alongside the current value it keeps today.
- **FR-002**: Keeping the hourly readings MUST NOT add any request to the weather data provider. A refresh makes the same number of provider calls as before this feature.
- **FR-003**: The UV tile MUST show one slot per hour from 07:00 to 19:00 Singapore time, in time order, with each reported hour's value. Hours without a reading MUST be visibly empty.
- **FR-004**: Each reported slot MUST be coloured by its UV band using the existing band boundaries (Low 0–2, Moderate 3–5, High 6–7, Very High 8–10, Extreme 11+) and the active theme's UV colours.
- **FR-005**: The tile MUST show a direction: "Rising" if the latest reading is higher than the most recent earlier reading today, "Falling" if lower, "Steady" if equal. It MUST show no direction when fewer than two readings exist, or when the snapshot isn't from today.
- **FR-006**: The tile MUST show the number of hours so far in the snapshot's day with a reading of 3 or more.
- **FR-007**: The hourly view MUST mark the UV 3 level (start of Moderate), and MUST mark 11:00–15:00 labelled as NEA's usual peak (general advice, not a reading).
- **FR-008**: The tile MUST show one guidance line using only published wording: UV usually peaks 11 am – 3 pm (NEA), and use SPF 30 or higher sunscreen, applied 20–30 minutes before going into the sun (HealthHub). It MUST NOT state a UV level from which protection is "advised", since neither source states one.
- **FR-009**: The tile MUST state that the reading is nationwide, measured at Changi, and MUST show the time the readings are as of. That time is the provider's last update of the readings (for example 09:11), not the time of the refresh (for example 09:30).
- **FR-010**: The system MUST NOT show any estimated, forecast or "typical" UV value for an hour not yet reported, and MUST NOT state a "safe after <time>" claim.
- **FR-011**: When the snapshot is from a previous day, the hourly view MUST be labelled with that date, and the count MUST read as that day's count.
- **FR-012**: The day of the hourly readings MUST be taken from the data itself, not from the refresh time, so an overnight refresh is labelled as the previous day (FR-011). When the hourly list is empty, the tile MUST say there are no UV readings yet. When UV data was unavailable at refresh, the tile MUST show "Unavailable" as today. A blank or zero-filled hourly view MUST never appear.
- **FR-013**: A location refreshed before this feature MUST keep showing its current value and band. Its tile MUST note that the hourly view appears after the next refresh, without affecting other tiles.
- **FR-014**: The current value, band label and 0–11 gauge MUST remain on the tile. The hero summary's UV behaviour (mentions from High, 6+) MUST be unchanged.
- **FR-015**: The tile MUST stay readable at phone width without horizontal scrolling in every theme. If the hourly view can't fit, the text lines from FR-005, FR-006, FR-008 and FR-009 MUST still show.

### Key Entities

- **Hourly UV reading**: one NEA UV index value for one hour of one day. Attributes: hour (Singapore time) and value (whole number, may be missing). Nationwide, measured at Changi.
- **Day's UV readings**: the ordered set of hourly UV readings for the snapshot's day up to the snapshot time, plus the time the provider last updated them. Stored as part of each saved location's weather snapshot, replaced on every refresh. Identical across locations refreshed at the same time.
- **UV band**: the category a value falls in (Low, Moderate, High, Very High, Extreme), as already used by the UV tile.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From one look at the UV tile after a refresh, a person can correctly say whether UV is rising, steady or falling, in 100% of checked cases where the snapshot holds two or more readings today.
- **SC-002**: For any refreshed day, the hours-at-UV-3-or-more count and every slot value shown match NEA's published hourly UV readings for that day up to the snapshot time, in 100% of checked days.
- **SC-003**: The number of weather data provider requests per refresh is the same before and after this feature.
- **SC-004**: 0 hours not yet reported show a value, estimate or "typical" figure, across morning, afternoon, evening, previous-day and empty snapshots.
- **SC-005**: Every UV tile state (readings, empty, unavailable, previous-day, pre-feature) shows a value or an explicit message; 0 states show a blank or zero-filled hourly view.
- **SC-006**: The tile is readable without horizontal scrolling at phone width (360 px wide) in all 6 themes.
- **SC-007**: No regression: the current value, band label, gauge and the hero's UV mention behave as before this feature.

## Assumptions

- Users are members of the general public in Singapore. The tile follows NEA and HealthHub guidance, not personal preference (assessment problem.md, owner 2026-11-15).
- The UV data the app already fetches on refresh returns the day's hourly readings so far, newest first, from 07:00 up to the latest hour, with the day's date. From the last evening reading until about 07:11 the next morning, it keeps returning the previous day's full list (verified live 2026-11-15, see plan research R2).
- Guidance wording was confirmed against the pages on 2026-11-15 (plan research R1). NEA: "The maximum UV radiation level typically occurs during the four-hour period between 11am and 3pm", measured "at the Changi Meteorological Station". HealthHub: SPF 30 or higher, applied 20 to 30 minutes before going into the sun. Neither page states a UV level from which protection is advised, so the tile marks UV 3 only as the start of the Moderate band.
- Direction uses Rising / Steady / Falling from the last two readings, not "near peak". Calling a peak would need knowledge of later hours, which the data doesn't give. Hour-to-hour flicker on cloudy days is accepted: each label is true for the hours it compares.
- The UV tile is the only place the hourly view appears. The regional forecast strip, map and hero are out of scope.
- Out of scope: UV forecasts or typical-hour estimates, location-specific UV, changing the hero's UV threshold, medical advice beyond NEA and HealthHub wording, alerts or automatic refreshes, UV history beyond the snapshot's day, and constitution changes.
- Fetching stays on create or refresh only (constitution Principle I); band and direction logic is testable on its own (Principle IV); colours come from the theme (Principle V).
