# Decision: Themed lightning markers, with the wait measured before it is fixed

- **Slug**: lightning-aggregation-and-icon
- **Decided**: 2026-11-15
- **Verdict**: go (Option A only)
- **Artifacts reviewed**: research.md | problem.md | concept.md (no intake.md; intake was skipped)

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | adequate | Two real but modest problems from the owner's own use: generic dots during storms, and a wait they find too long. Only during storms; nothing is broken (problem.md, Cost of Inaction). |
| Evidence strength | adequate | Option A's scope (icon plus measurement) rests on high-confidence code evidence: themed `--lightning` per theme, an existing `ThunderIcon` and divIcon pattern, and the load path's pacing. The weak part, the unmeasured cause of the wait, is exactly what A measures instead of fixing (research.md, Prior Art and Gaps). |
| Value vs. inaction | adequate | Small value (recognisability, theme fit, a speed baseline) for a small cost; doing nothing is safe but leaves both annoyances (problem.md, Cost of Inaction). |
| Feasibility / appetite | strong | Small appetite (days), building on existing icon, theme-colour and marker patterns; no fetch, cache, database or constitution change (concept.md, Option A). |
| Strategic fit | strong | Follows Principle V theme tokens and FR-015 legibility; keeps the user-action-only lightning exception and the rate limit untouched (constitution.md, spec 002). |
| Risk posture | adequate | Risks are named with checks: bolt legibility at 5–8 px on 6 themes, the age fade on a thin glyph (SC-006), confusion with the pin thunderstorm icon, and drawing cost at ~370 strikes. The fallback is to keep circles. Responsiveness at volume isn't measured yet (concept.md, Assumptions). |

## Verdict & Rationale

**Go, for Option A.** The owner chose A on 2026-11-15, matching the concept's recommendation. Problem validity and evidence are both adequate for A's scope, and feasibility and strategic fit are strong. A doesn't rely on the one weakly evidenced claim, that aggregation would speed loading. It replaces that claim with a measurement. The original grouping idea (Option C) is **not** approved: the evidence suggests a ~100 m area wouldn't shorten the fetch or noticeably reduce markers. Option B (faster visible load) is deferred until A's measurement shows the wait is mostly upstream fetching and longer than the owner's target.

## If needs-clarification

- Not applicable.

## If go — Handoff to `/speckit-specify`

- **Problem**: During storms, lightning strikes show as plain circles that don't read as lightning or feel part of the selected theme, and the owner waits an unmeasured, too-long time for them to appear.
- **Chosen approach**: Option A. Replace each strike's circle with a small bolt mark in the active theme's lightning colour, outlined for legibility on every basemap, keeping the age fade and the per-strike popup, and visually distinct from the thunderstorm icon on location pins. Add a way for the owner to see how long a lightning refresh took and why (pages fetched, rate-limit back-off, drawing time).
- **In scope**: the strike marker's appearance on all 6 themes and their basemaps, in card and full-screen views; measurement of the lightning refresh wait.
- **Out of scope**: grouping or aggregating strikes, density heatmaps; any change to how or when lightning is fetched (progressive loading, page-load fetch, background refresh, cache, request limit); alerts and history; restyling pins, basemaps or controls; snapshot or database changes; a general observability dashboard.
- **Success metrics**: the owner can name a strike as lightning without its popup, and tell it from a thunderstorm pin, on all 6 themes (qualitative); spec 002 SC-006 (newest of three strikes identifiable) still holds; the map stays responsive with a busy-day volume (~370 strikes); a measured baseline exists for time from user action to strikes drawn, split into server and drawing time; no regression in spec 002 SC-001, SC-004, SC-005 or SC-007.
- **Carried-forward open questions**:
  - How must the bolt differ from the pin thunderstorm icon (shape, frame or size)?
  - Does the age fade use opacity, size or both on the bolt?
  - Where does the owner see the refresh timing (dev log, status strip detail, or elsewhere)?
  - Is an API key configured? It affects the baseline and the case for Option B.
  - What target wait would make Option B unnecessary?
  - How do we get a busy window to test with, given that most days have no strikes (a replayed real window or the demo fixture)?
