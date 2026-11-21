# Feature Specification: Taxi-rain study samples on time

**Feature Branch**: `017-taxi-sampler-schedule`

**Created**: 2026-11-20

**Status**: Draft

**Input**: User description: "Fix the taxi sampler's schedule now, since every day lost is lost data."

## Context

The taxi vs rain study (assessment `sg-transport-data`, Option B) needs one sample of taxi supply and rainfall about every 15 minutes from 2026-11-18 to 2026-12-03 00:00 SGT. That is roughly 96 samples a day, enough to compare wet and dry periods at similar times of day.

What happened: in the first 2 days the scheduler fired only 7 times, about once every 6–8 hours. The schedule asks for every 15 minutes, but the hosted scheduler treats the request as best effort and delays or drops most runs. Only 3 of the 7 samples saw any rain. At this rate the study ends with about 40 samples and cannot answer its question: does taxi supply near saved places drop in the rain?

This is research tooling. It changes nothing users see, and it must not change the app, its API, its database or the constitution (concept.md, Out of Scope).

## User Scenarios & Testing *(mandatory)*

The "user" here is the project owner, who will write the findings note and re-run the decision.

### User Story 1 - Samples arrive every 15 minutes from now on (Priority: P1)

From the moment the fix is live until the study ends, the owner gets a new sample about every 15 minutes, day and night, without having to keep a laptop awake or start runs by hand.

**Why this priority**: Every missed interval is lost for good unless it can be backfilled, and rain events are short. This is the whole point of the request.

**Independent Test**: Leave it running for 24 hours, then count the new samples in the study data and check the largest gap between them.

**Acceptance Scenarios**:

1. **Given** the fix is live, **When** 24 hours pass, **Then** the study data has at least 85 new samples (≥ 90% of 96) and no gap longer than 30 minutes, except gaps caused by an upstream outage.
2. **Given** a sample attempt fails (upstream error or timeout), **When** the next interval comes, **Then** sampling continues as normal, and the failed attempt is either recorded as a row with an error or retried within the same interval.
3. **Given** the study end time has passed, **When** a trigger fires, **Then** nothing is collected and no upstream call is made, as today.

---

### User Story 2 - The days already lost are recovered where possible (Priority: P2)

The owner wants the 2026-11-18 → fix-date window filled in at the same 15-minute spacing, if the data sources still publish values for those past times.

**Why this priority**: It recovers about 2+ days of the 15-day window without extending the study. It's lower than P1 because P1 stops the loss, and the backfill may turn out to be impossible.

**Independent Test**: After the backfill runs, the study data covers the missed window at 15-minute spacing, and each recovered row can be told apart from a live one.

**Acceptance Scenarios**:

1. **Given** past values are available for a missed time, **When** the backfill runs, **Then** one row per missed 15-minute slot is added, marked as backfilled, with the source timestamps of the data it used.
2. **Given** a source has no value for a missed slot, **When** the backfill reaches it, **Then** the slot stays empty or gets an error row, and nothing is made up.
3. **Given** the backfill is run twice, **When** it finishes, **Then** no slot appears twice.

---

### User Story 3 - The owner can see that sampling is healthy (Priority: P3)

The owner can tell at a glance whether the sampler is keeping up, without opening the raw data file and counting rows.

**Why this priority**: The current problem went unnoticed for 2 days. A cheap health signal stops that from happening again, but the study doesn't depend on it.

**Independent Test**: Stop the trigger for 1 hour and check that the owner is told, or that the health summary shows the gap.

**Acceptance Scenarios**:

1. **Given** no new sample has arrived for 60 minutes, **When** the owner checks the health signal, **Then** it shows the time of the last sample and the size of the gap.
2. **Given** sampling is on time, **When** the owner checks, **Then** it shows the sample count for the last 24 hours and the largest gap.

---

### Edge Cases

- Two triggers fire for the same interval (a retry, or the old schedule still being active): only one row per 15-minute slot is kept.
- The new trigger and the old hosted schedule both run during changeover: duplicates are prevented, or the old schedule is switched off as part of the fix.
- The upstream sources rate-limit or block calls: the attempt records an error and the next interval proceeds. There's no tight retry loop.
- The trigger's credential expires or is revoked before the study ends: sampling stops visibly (Story 3), not silently.
- The study end date passes: the trigger stops calling upstream, and the owner can remove it with one documented step.
- The data branch push conflicts with another write: the existing retry handles it, and the row is not lost.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The sampler MUST be started about every 15 minutes by a trigger that reliably keeps to that pace, so that at least 90% of intervals in any 24-hour period produce a sample.
- **FR-002**: The trigger MUST NOT depend on the owner's laptop being on, awake or online.
- **FR-003**: Each sample MUST keep the existing row format (the same columns, spots and rain rule), so that rows from before and after the fix can be analysed together. Any new column MUST be added at the end.
- **FR-004**: At most one row MUST be stored per 15-minute slot, whichever trigger or retry produced it.
- **FR-005**: The fix MUST make no change to the app, its API, its database, its deploys or the constitution, and MUST NOT start Vercel builds of the app.
- **FR-006**: Any credential the trigger needs MUST be limited to starting the study's sampling and writing study data. It MUST NOT be able to change the app's code, settings, secrets or deploys, and MUST be revoked when the study ends.
- **FR-007**: The sampler MUST keep honouring the study end time (2026-12-03 00:00 SGT, unless the owner moves it) and make no upstream calls after it.
- **FR-008**: The system MUST offer a one-off backfill of missed slots between the study start and the fix, using only values the sources published for those times. It MUST mark backfilled rows as backfilled and MUST NOT interpolate.
- **FR-009**: The owner MUST be able to see the time of the last sample, the sample count for the last 24 hours and the largest recent gap (Story 3).
- **FR-010**: The study's documentation (the workflow comments and the assessment folder) MUST record the new trigger, what it needs to keep running, and how to switch it off at the end of the study.
- **FR-011**: The trigger MUST be the owner's cron-job.org account. It starts the existing study workflow by hand-start request every 15 minutes, using a fine-grained GitHub token limited to this repository with only the permission to start workflows. The workflow keeps doing the sampling and the writing. GitHub's own schedule MUST either be removed, or stay only as a backup that cannot create a second row in the same slot (FR-004). Before the token is created, every other workflow in the repository that can be started by hand MUST be listed, and the owner MUST confirm that each one is acceptable to start with this token, or remove its hand-start option.

### Key Entities

- **Sample row**: one observation at one 15-minute slot. It holds the run time, the taxi and rain source timestamps, the island-wide taxi total, rain station counts, taxis within 1 km and nearest-station rain for each of the five spots, any errors, and whether it came from a live run or a backfill (shown by which file it is in, [data-model](data-model.md)).
- **Slot**: a 15-minute interval in SGT within the study window. It identifies a row for duplicate checks and gap counts.
- **Trigger**: what starts a sample on schedule. It has a host, a pace, and an optional credential with an expiry date.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the first full 24 hours after the fix, ≥ 85 samples are recorded (against 7 in the first 48 hours before the fix).
- **SC-002**: Across the rest of the study, ≥ 90% of 15-minute slots have a live sample, and no gap exceeds 30 minutes outside upstream outages.
- **SC-003**: At the study end, the dataset has ≥ 1,200 usable samples, including backfilled ones, which is enough to compare wet and dry periods at each of the five spots by part of day.
- **SC-004**: The owner can confirm sampling health in under 1 minute without opening or counting the raw data.
- **SC-005**: No app deploy, preview build or app setting changes because of this fix.
- **SC-006**: Within 1 day after the study ends, the trigger has been switched off and any credential it used has been revoked.

## Assumptions

- The study window stays 2026-11-18 → 2026-12-03 00:00 SGT. Extending it is a separate owner decision, which a failed backfill would make more likely.
- Both sources can be queried for a past time: verified 2026-11-20 for taxis and rain ([research R4](research.md)).
- About 96 samples a day of two keyless calls each stays well inside what the upstream sources tolerate. The concept assumed the same pace, and no rate-limit headers were seen.
- The existing sampling logic, row format and 1 km / nearest-station rules are correct and stay unchanged. Only the trigger and the backfill are new.
- Open PR #29 (stop Vercel previews on the data branch) is merged before or with this fix. The uncommitted local copy of the same change is dropped.
- Licence: the LTA and NEA feeds are under the Singapore Open Data Licence. Confirming that it allows this collection is still a blocking question in the decision, but it doesn't block fixing the schedule.
