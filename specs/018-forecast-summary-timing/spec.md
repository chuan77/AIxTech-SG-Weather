# Feature Specification: Honest Forecast Timing and Rain in the Summary

**Feature Branch**: `018-forecast-summary-timing`

**Created**: 2026-11-22

**Status**: Draft

**Input**: User description: "I reproduced both with fixed inputs. They're worth fixing whatever happens to H:

An ended period shows as "now". At 12:30, a fresh 11:50 snapshot still says "Thundery showers now" for thunder forecast until midday (outdoorSummary.ts). The forecast strip also labels that first period "Now".
Showers read as reassurance. When showers are both current and forecast, the top line says "No storms forecast", with no mention of rain."

## Background

The top line of a saved place answers "can I go out?". It misleads in two ways: it treats a forecast as current without checking the time, and it ignores rain without thunder. These are the baseline defects in `.specify/assessments/groq-llm-features/concept.md`. They are fixed on their own merits and don't depend on candidate H (the activity planner).

Reproduced on fixed inputs on 2026-11-22. All times are Singapore time and every snapshot below counts as fresh.

| Case | Situation | Today | Required |
|---|---|---|---|
| 1 | Thunder until midday, then dry. Read 11:50, viewed 12:30. | "Thundery showers now", first period "Now", storm sky | "No storms forecast", midday period "Now", calm sky |
| 2 | Thunder from midday. Read 11:50, viewed 12:30. | "Thundery showers from midday", calm sky (**under-warns**) | "Thundery showers now", storm sky |
| 3 | First period is thunder from midday. Read 11:45, viewed 11:50. | "Thundery showers now", that period "Now" | "Thundery showers from midday", no period "Now" |
| 4 | 2-hour thunder forecast until 13:30, dry periods. Read 11:50, viewed 14:00. | "Thundery showers now" | No "now", no "No storms forecast", calm sky |
| 5 | Every forecast window has ended. | "No storms forecast", first period "Now" | No weather claim, no "Now" |
| 6 | Showers in the current 2-hour forecast and the periods. | "No storms forecast" | "Showers forecast now" |
| 7 | Dry morning, showers from midday. Viewed 09:00. | "No storms forecast" | "Showers forecast from midday" |
| 8 | Showers from midday, thunder from 6 pm. Viewed 09:00. | "Thundery showers from 6 pm" | "Showers forecast from midday · Thundery showers from 6 pm" |
| 9 | This evening's period, which NEA prints with tomorrow's date. Viewed 00:30. | "Thundery showers from tomorrow 6 pm" | "Thundery showers from 6 pm" |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - "Now" means now (Priority: P1)

Someone checking a saved place before going out sees thunder called "now" only while a forecast that says so is in force. The top line, the forecast strip and the Singapore theme's sky agree, and follow the clock while the page is open.

**Why this priority**: It is wrong in both directions. An ended storm keeps people in, and a storm period that has started is shown as still to come, which can send people out into lightning.

**Independent Test**: View fixed snapshots at fixed times (cases 1–5 and 9) and check the top line, strip labels and sky. Rain wording isn't needed.

**Acceptance Scenarios**:

1. **Given** a reading from 11:50 with thunder for 6 am–midday, dry periods afterwards and a dry 2-hour forecast, **When** viewed at 12:30, **Then** the top line says "No storms forecast", the midday period alone is "Now", the morning period shows "6 am", and the sky is not storm.
2. **Given** a reading from 11:50 with a dry morning and thunder for midday–6 pm, **When** viewed at 12:30, **Then** the top line says "Thundery showers now", that period is "Now", and the sky is storm.
3. **Given** a reading from 11:45 whose first period is thunder for midday–6 pm and a dry 2-hour forecast, **When** viewed at 11:50, **Then** the top line says "Thundery showers from midday", no period is "Now", and the sky is not storm.
4. **Given** scenario 3 left open, **When** the clock reaches midday, **Then** within one minute, and with no refresh, all three surfaces change to now.
5. **Given** a reading from 11:50 with a 2-hour thunder forecast for 11:30–13:30 and dry periods, **When** viewed at 13:00, **Then** the top line says "Thundery showers now". **When** viewed at 14:00, **Then** it says neither that nor "No storms forecast", and the sky is not storm.
6. **Given** a fresh reading whose forecast windows have all ended, **When** viewed, **Then** the top line makes no storm, rain or "no storms" claim, no period is "Now", and any heat, UV and PSI parts still show.
7. **Given** a reading from 00:20 on 22 Nov whose last period is thunder labelled "6 pm to Midnight 23 Nov", following "Midday to 6 pm 22 Nov", **When** viewed at 00:30 on 22 Nov, **Then** the top line and strip place it at 6 pm today, not tomorrow.
8. **Given** a 2-hour thunder forecast with no readable time and thunder again from 6 pm, **When** viewed at 12:30, **Then** the top line says "Thundery showers forecast", not "from 6 pm", and the sky is not storm.
9. **Given** a reading from 23:45 whose midnight period has no wording and whose 6 am period is thunder, **When** viewed at 23:45, **Then** the top line says "Thundery showers from tomorrow 6 am". With every other period dry it makes no weather claim.

---

### User Story 2 - Forecast rain is named (Priority: P2)

Someone about to go out learns from the top line that rain is forecast, and whether that applies now or later, and never reads "No storms forecast" in its place.

**Why this priority**: The current line is literally true but reassures by omission. It ranks second because it concerns rain without lightning.

**Independent Test**: View fixed snapshots combining dry, rain and thunder across the 2-hour forecast and the periods (cases 6–8), at times when the first period is current so that Story 1 isn't needed.

**Acceptance Scenarios**:

1. **Given** "Showers" in both the 2-hour forecast and the period in force, **When** viewed, **Then** the top line says "Showers forecast now", once, and not "No storms forecast".
2. **Given** a dry 2-hour forecast and "Light Rain" in the period in force until 6 pm, followed by a dry period, **When** viewed, **Then** it says "Light rain forecast until 6 pm".
3. **Given** dry weather now and "Showers" from midday, **When** viewed at 09:00, **Then** it says "Showers forecast from midday".
4. **Given** showers from midday and thunder from 6 pm, **When** viewed at 09:00, **Then** it says both, in that order.
5. **Given** showers in the current 2-hour forecast and thunder from 6 pm, **When** viewed, **Then** it says "Showers forecast now · Thundery showers from 6 pm".
6. **Given** thunder in force and rain also forecast, timed or untimed, **When** viewed, **Then** it says "Thundery showers now" with no separate rain part.
7. **Given** no rain or thunder in any forecast still in force or to come, and no ended wet 2-hour forecast, **When** viewed, **Then** it still says "No storms forecast".
8. **Given** "Light Rain" in the period in force until 6 pm and again until 6 am, **When** viewed at 14:00, **Then** it says "Light rain forecast until tomorrow 6 am". If the second period says "Showers", it says "Rain forecast until tomorrow 6 am".

---

### Edge Cases

- **Exact boundary**: at 12:00:00 the period ending at midday has ended and the one starting then is in force.
- **Just issued**: NEA publishes about 20 minutes before a period starts (around 05:40, 11:40, 17:40 and 23:40), so often no period is in force yet.
- **Midnight, month end and year end**: a period keeps its real day across all three.
- **Wrong dates from NEA**: the printed date, and sometimes the machine-readable date, can be a day, a month or a year out.
- **Unreadable or missing time, or no reading time**: the forecast can't be "now", but its warning still appears without a time, in the order set by FR-002, FR-003 and FR-010.
- **No periods**: the 2-hour forecast can still give a warning. A dry one alone doesn't justify "No storms forecast".
- **2-hour forecast unavailable**: the periods alone drive the line.
- **Period without wording**: it keeps its place, so the periods after it keep their times. It can't support "No storms forecast" or an "until" time.
- **Stale reading (3 hours or more)**: the line stays dated "As of …", the sky stays calm and no period is "Now".
- **Viewer outside Singapore**: the result is the same as in Singapore.
- **Device clock earlier than the reading**: nothing that hasn't started is shown as "now". A 2-hour forecast still to come can be named with "from".

## Requirements *(mandatory)*

### Functional Requirements

**Timing**

- **FR-001**: A forecast (the 2-hour forecast or a 24-hour period) MUST count as in force only from its start time up to, but not including, its end time, in Singapore time.
- **FR-002**: For a fresh reading, "Thundery showers now" MUST appear if and only if a thunder forecast is in force.
- **FR-003**: When no thunder is in force, the top line MUST show the first that applies. Ended periods MUST NOT be named.
  1. 2-hour thunder with an unknown time: "Thundery showers forecast", because it may already apply
  2. the first thunder forecast still to come, 2-hour or period: "Thundery showers from <start>"
  3. a thunder period with an unknown time: "Thundery showers forecast"
- **FR-004**: For a fresh reading, the strip MUST label only the period in force "Now", and none if no period is in force. Other periods, including ended ones, MUST show their own start. With an unknown time, that is the start as NEA wrote it without the year, or "--" if there is none.
- **FR-005**: The Singapore theme's storm sky MUST appear exactly when a fresh reading's top line says "Thundery showers now".
- **FR-006**: The top line, strip and sky MUST update within one minute of a forecast starting or ending while the page is open, without a refresh.
- **FR-007**: Period days MUST be correct when NEA's printed date is wrong. A period's day MUST be consistent with the reading time and with the periods before it, which run consecutively.
- **FR-008**: The timing rules MUST apply to snapshots saved before this change, without a refresh.

**Rain**

- **FR-009**: Rain means any forecast wording naming rain, showers or drizzle without thunder. The top line MUST use NEA's wording for it, in sentence case, except that a run of periods with different rain wordings is called "Rain".
- **FR-010**: When no thunder is in force, the top line MUST name the first applicable rain forecast from this list:
  1. the 2-hour forecast in force: "<wording> forecast now"
  2. the 2-hour forecast with an unknown time: "<wording> forecast"
  3. the period in force: "<wording> forecast until <end>", where <end> closes the unbroken run of rain periods. If the next period after the run has no wording or an unknown time, "<wording> forecast" with no end.
  4. the first rain forecast still to come, 2-hour or period, if it starts before any thunder still to come and there is no untimed 2-hour thunder: "<wording> forecast from <start>"
  5. a rain period with an unknown time: "<wording> forecast"
- **FR-011**: While thunder is in force there MUST be no rain part, timed or untimed. Otherwise the part chosen by FR-010 MUST come before the part chosen by FR-003. There MUST be at most one rain part and one thunder part.
- **FR-012**: Rain wording MUST describe a forecast and MUST NOT state that rain is falling.

**No false reassurance**

- **FR-013**: "No storms forecast" MUST appear only when all of these hold:
  - at least one period with a known time is in force or still to come
  - no forecast in force or still to come has rain or thunder
  - no forecast with an unknown time has rain or thunder
  - no period in force, still to come or with an unknown time lacks wording
  - the stored 2-hour forecast, even if ended, has no rain or thunder, because its condition is still displayed under the top line
- **FR-014**: A rain or thunder forecast whose time can't be determined MUST appear without a time where FR-003 or FR-010 selects it. Thunder in force (FR-002) outranks both. An untimed forecast MUST NOT produce "now", a "Now" label or a storm sky.
- **FR-015**: When nothing can be said, the weather part MUST be left out. No "safe", "dry" or "all clear" wording may be added.

**Unchanged behaviour**

- **FR-016**: A stale reading MUST keep its "As of" date, calm sky and strip without "Now". Its top line MUST apply the rules above as of the reading time, with day names relative to the day of viewing.
- **FR-017**: The heat stress, UV and PSI parts, their order after the weather part, and the separate nearby-lightning line MUST be unchanged.
- **FR-018**: The fix MUST NOT add weather calls on page load, on refresh or as time passes (constitution Principle I).
- **FR-019**: The longer top line MUST remain fully readable at 360 px width in every theme and be announced in the same order by screen readers.

**Complete snapshots**

- **FR-020**: A refresh MUST save every period NEA issues, in order, including one without wording. If none has wording, it saves none. The strip MUST show a period without wording as "Unavailable", with no weather icon.

### Key Entities

- **Snapshot**: what was saved at the last refresh. It has a reading time, one 2-hour forecast and an ordered list of periods.
- **2-hour forecast**: a condition for one of 47 areas, valid for a two-hour window.
- **Period**: a condition for one of five regions over 6 or 12 hours. Periods in one snapshot run consecutively. A period may have no wording.
- **Forecast state**: ended, in force, still to come or time unknown, relative to the moment being judged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All nine reproduced cases (1–9) show the required result.
- **SC-002**: For fresh readings, at every minute from issue to the end of the last window in each of NEA's four daily period layouts, and around each of the 48 half-hour 2-hour windows, there are 0 "now" claims outside a forecast's window and 0 missed "now" claims for thunder inside one.
- **SC-003**: Across every combination of dry, rain, thunder and missing for the 2-hour forecast, current period and later period, "No storms forecast" appears 0 times alongside forecast rain or thunder or a missing period that still applies, and every warning that still applies appears as FR-002, FR-003 and FR-010 require.
- **SC-004**: Across the SC-002 test sets, the top line and sky disagree 0 times about thunder now. Stale readings follow FR-016 instead: a dated line and a calm sky.
- **SC-005**: An open page reflects a period boundary within 60 seconds.
- **SC-006**: Test examples of each observed NEA date error (next day, wrong month, wrong year) all resolve to the correct day.
- **SC-007**: Weather-provider calls stay at 12 per refresh and 0 per page load.
- **SC-008**: The longest two-part weather line, both fresh and stale with its "As of" date, with heat, UV and PSI, shows no clipping or horizontal scrolling at 360 px in any theme.

## Assumptions

- **"Now" for thunder keeps its meaning**: a thunder forecast is in force, whether from the 2-hour forecast or a period. Only the time check changes.
- **Rain is worded more cautiously than thunder**: a regional period of up to 12 hours can't support "Showers now", and whether it is raining belongs to the parked rain-near-location assessment.
- **Saying less is acceptable** when a time is unknown, provided a warning isn't hidden.
- **A possibly current warning outranks a later one**, even though the later one's time is lost from the line.
- **Snapshots saved before this change may already have lost a period without wording**. They can be timed a day early until refreshed, because the loss can't be detected. None of 199 sampled records had such a period.
- **Ended periods stay in the strip** with their start label, so the layout doesn't change.
- **Freshness stays at 3 hours** and stale readings stay dated. A storm that had dropped out of the line can therefore reappear as "As of 11:50: Thundery showers now" once the reading turns stale, which is true of that time.
- **NEA's dates can't be trusted alone**. This rests on 199 forecast records from 26 requested dates, probed on 2026-11-22:
  - 44 records had a printed start date that disagreed with the machine-readable one.
  - In 17 records the machine-readable dates were themselves broken, by a day or a month. Some years were wrong too.
  - Clock times plus the reading time, ignoring printed dates, gave the machine-readable day and time in 176 records, setting the year aside. The other 23 were those 17, 5 archive records updated days later, and 1 whose truth is unknown.
- **Not verified**: snapshots stored in production were not inspected, and NEA label formats outside the sampled dates may differ. FR-014 covers labels that can't be read.

## Out of Scope

- Candidate H in any form, including notes on each period, time advice and any LLM use.
- Observed rain near the place, station rainfall in the top line, and new lightning logic.
- Validity labels or expiry for the 2-hour condition where it appears by itself (under the temperature, place cards, switcher, map pins) and in umbrella advice. These can still show an ended forecast. FR-013 stops the top line adding reassurance beside it.
- Umbrella advice not recognising "drizzle", noticed while writing this spec.
- Changes to the freshness threshold or to automatic refreshing.
