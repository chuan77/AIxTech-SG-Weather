# Implementation Plan: Honest Forecast Timing and Rain in the Summary

**Branch**: `018-forecast-summary-timing` | **Date**: 2026-11-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/018-forecast-summary-timing/spec.md`

## Summary

The top line, forecast strip and storm sky all assume that the first stored period is current, and the top line only looks for thunder. The fix is in the frontend, plus a small backend change so that stored periods keep their positions:

1. A new pure module works out each forecast's real window from the clock words and reading time already stored, ignoring NEA's unreliable printed dates.
2. One outlook, judged on one clock, feeds all three surfaces.
3. The top line names forecast rain and says "No storms forecast" only when the forecast supports it.
4. A refresh keeps a period without wording as an empty placeholder.

A throwaway version of these rules passed the nine spec cases, a 19,360-step period sweep and an 8,688-step 2-hour sweep, both on fresh readings, a 192-case matrix that checks the exact line, and 383,400 combinations checked for hidden warnings, false ends and false all-clears. Against real data it matched all 220 two-hour records sampled. The disagreements in the 24-hour sample are explained in [research R3](research.md#r3-how-well-the-rule-works-on-real-data), with one record whose truth is unknown.

## Technical Context

**Language/Version**: TypeScript 5.7, React 18

**Primary Dependencies**: None added. `Intl` and the existing `readingFreshness` and `conditionToIcon`.

**Storage**: Unchanged. Reads fields that every saved snapshot already has. `forecast_periods` can now hold an empty `forecast`, which its type already allows. No migration.

**Testing**: vitest on pure `.ts` modules and on the weather client with a stubbed fetch (node environment), plus an agent-browser script with a shifted clock

**Target Platform**: Current desktop and mobile browsers, in any device time zone

**Project Type**: Web application (Express + React/Vite in one process). This change touches the frontend and the period mapping in `backend/src/weather.ts`.

**Performance Goals**: Boundaries show within 60 seconds. The outlook costs under 1 ms per render (about 0.07 ms measured).

**Constraints**: 12 provider calls per refresh and 0 per page load, no new timers, readable at 360 px in six themes

**Scale/Scope**: 1 new module, 7 changed modules, 5 test files, 1 browser script, 9 docs. Small (2–3 days).

No NEEDS CLARIFICATION remains. The precedence where forecasts overlap is in the spec, with the reasons in [research R7](research.md#r7-precedence-where-forecasts-overlap).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle (v1.6.0) | Before research | After design | How |
|---|---|---|---|
| I. Snapshot-only | Pass | Pass | Only stored fields are read. The clock tick recomputes and fetches nothing. |
| II. One process, relative API | Pass | Pass | No API or state container. `now` is a prop from `Layout`. |
| III. Injectable provider | Pass | Pass | The provider interface is unchanged. The client test stubs `fetch` and reaches no network. |
| IV. Testing within real limits | Pass | Pass | All frontend logic, strip labels included, is in pure `.ts`, and the backend mapping has a client test. Each case gets a test that fails first. |
| V. Theme-driven UI | Pass | Pass | No colour, class or theme CSS change. The sky's trigger is corrected and documented. |
| VI. Quality gate | Pass | Pass | No route change. `npm run verify` before the browser checks, and hooks are not bypassed. |
| Workflow: docs in the same change | Pass | Pass | See the docs listed below. |

No violations.

## Project Structure

### Documentation (this feature)

```text
specs/018-forecast-summary-timing/
├── spec.md
├── checklists/requirements.md
├── plan.md                        # this file
├── research.md                    # Phase 0
├── data-model.md                  # Phase 1
├── contracts/forecast-display.md  # Phase 1
├── quickstart.md                  # Phase 1
└── tasks.md                       # /speckit-tasks, not created here
```

### Source Code (repository root)

```text
frontend/src/
├── components/
│   ├── forecastTiming.ts          # NEW: parse, resolve, state, outlook, strip labels
│   ├── forecastTiming.test.ts     # NEW: cases, sweep, date errors
│   ├── periodLabel.ts             # words from an instant, plus shortenPeriodLabel
│   ├── periodLabel.test.ts
│   ├── outdoorSummary.ts          # weather parts from the outlook
│   ├── outdoorSummary.test.ts
│   ├── HourlyStrip.tsx            # takes labels, no clock of its own
│   ├── Hero.tsx                   # takes now, builds strip labels
│   └── Layout.tsx                 # the one clock, passes now to Hero and sky
└── theme/
    ├── sky.ts                     # calm when stale, storm from the outlook
    └── sky.test.ts

backend/src/
├── weather.ts                     # keep a placeholder for a period without wording
└── weather.test.ts

scripts/e2e/
└── forecast-timing.sh             # NEW: us1, us2, themes

docs/
├── architecture.md                # forecast timing and the one clock
├── testing.md                     # the new script
├── theming.md                     # what makes data-sky storm
├── src/content/docs/backend/api.md
├── src/content/docs/backend/weather-provider.md
└── src/content/docs/frontend/overview.md
THEMES.md                          # correct the storm trigger
frontend/DESIGN.md                 # verdict content and sky rule
frontend/.impeccable/design.json   # sky rule
```

**Structure Decision**: The existing frontend layout and its pattern of pure helpers beside components. In `backend/` only the 24-hour period mapping changes.

## Design

```text
stored snapshot ─┐
                 ├─> forecastOutlook ─┬─> outdoorSummaryParts ─> top line
Layout's now ────┘                    ├─> stripLabels ─────────> forecast strip
                                      └─> skyState ────────────> data-sky
```

- **Windows** depend only on the snapshot ([research R2](research.md#r2-the-resolution-rule)).
- **States** depend on the window and the evaluation time: now, or the reading time when stale ([data model](data-model.md#state)).
- **Words** follow the decision order in the [display contract](contracts/forecast-display.md#weather-part-of-the-top-line).

## Delivery Order

Each step starts with its failing tests. Both stories edit `outdoorSummary.ts`, so they run in sequence.

1. **Foundation**: the window resolver, states and time words, with the sweep and date-error tests. No visible change and no doc change.
2. **US1 (P1)**: in one change, keep placeholders in the backend, move the top line, strip and sky to the outlook and the single clock, add the thunder order and all-clear rules, and update the architecture, testing, theming, design and docs-site pages that describe them, with the `us1` browser run. It can ship alone and fixes the under-warning.
3. **US2 (P2)**: in one change, the rain parts, the rain half of the all-clear rule, their docs and the `us2` browser run.
4. **Finish**: the `themes` browser run with its line in `docs/testing.md`, regressions, then [quickstart](quickstart.md). No behaviour doc waits for this step.

## Risks

| Risk | Effect | Handling |
|---|---|---|
| NEA changes its clock words | Times become unknown: no "Now" or storm sky | The warning still shows as "… forecast". Never guessed. |
| NEA's clock words are themselves wrong (1 of 199 records) | Wrong window for that record | Accepted. The timestamps in that record are no more trustworthy. |
| Forecast more than 22 hours old inside a fresh snapshot | Placed a day late | Accepted. Other sources keep `observed_at` current, and no such live record was seen. |
| A snapshot saved before this change already lost a period | Can be timed a day early, up to a false all-clear | Accepted until refreshed. It can't be detected, and 0 of 199 sampled records had a period without wording. |
| NEA omits a period entirely | Same | Accepted. Not seen in 199 records. A gap later in the list gives unknown times. |
| No period in force for up to about 20 minutes after NEA drops the ending one | No "Now" in the strip, and the ending period's thunder is no longer known unless the 2-hour forecast has it | Honest to the stored data. The coming period shows "from". |
| Storm returns as "As of …" when a reading turns stale | Looks like a reversal | Specified (FR-016), dated and muted, with a calm sky |
| Condition under the temperature still shows an ended forecast | Can sit under a line with no warning | Out of scope in the spec. Never paired with "No storms forecast" when wet. |
| Longer top line | More height on phones | Browser check at 360 px in six themes |

## Complexity Tracking

No constitution violations, so nothing to justify.
