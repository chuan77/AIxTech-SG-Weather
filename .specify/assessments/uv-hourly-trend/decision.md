# Decision: Seeing how UV is moving through the day

- **Slug**: uv-hourly-trend
- **Decided**: 2026-11-15
- **Verdict**: go (Option B)
- **Artifacts reviewed**: research.md | problem.md | concept.md (no intake.md; research was run directly from user input)

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | adequate | Real and observable: the tile shows one value, and the hourly list that would show direction arrives with every refresh and is thrown away (research.md, Data & Constraints). Severity is low; nothing is broken (problem.md, Cost of Inaction). |
| Evidence strength | adequate | Data shape and code paths are high confidence: read from `weather.ts`, `schema.ts` and `Tiles.tsx`, plus a stored live 2026-10-01 response. Thresholds come from NEA, WHO and HealthHub guidance, but only through search summaries; the pages weren't opened (problem.md, Resolved by Official Guidance). Demand is the owner, who asked that official guidance for the general public decide the wording. |
| Value vs. inaction | adequate | Cost of inaction is low, but so is the cost. The data is already fetched, and the gain (direction, exposure so far, NEA's peak advice) is something the current tile and hero can't give (problem.md Goals; concept.md Option B). |
| Feasibility / appetite | strong | Option B is small (days). It reuses the existing `uv` call, the theme `--scale-uv` token and the existing band logic, and follows the snapshot's existing list-field pattern (research.md, Data & Constraints). |
| Strategic fit | strong | No new upstream call, so Principle I holds. Theme tokens (V), pure testable logic (IV). The owner had already queued it as the next feature on 2026-11-14 (research.md, Users & Demand). |
| Risk posture | adequate | Named, with checks and a fallback: tile legibility at phone width across 6 themes (fallback: Option A text), a morning snapshot read as the whole day ("as of" note, stale-day handling), direction flicker on cloudy days, and the hero (6+) versus curve (3) mismatch (concept.md, Assumptions). Unverified: the list's shape at night and just after midnight. |

## Verdict & Rationale

**Go, for Option B.** Problem validity and evidence are both adequate, and feasibility and strategic fit are strong, at a small appetite. Option B meets every goal and success metric in problem.md without a new data.gov.sg call or a constitution change. It answers "safe sun hours" without estimating anything: past hours below UV 3, plus NEA's standing 11 am – 3 pm advice, labelled as such. Option C is **not** approved, because it puts estimated "typical" hours next to NEA readings, which the problem explicitly avoids. Option A stays as the fallback if the curve doesn't fit the tile. The weakest point is that the guidance wording rests on search summaries; that is a specification-time check, not a reason to hold. The concept's recommendation is taken as the chosen option; the owner should say so during `/speckit-specify` if they prefer A.

## If needs-clarification

- Not applicable.

## If go — Handoff to `/speckit-specify`

- **Problem**: Someone checking the Singapore dashboard sees only the latest hour's UV reading. They can't tell whether UV is rising, at its peak or falling, or how long it has been at a level that calls for sun protection. NEA publishes no UV forecast.
- **Chosen approach**: Option B.
  - The UV tile gains a compact hourly view of today from 07:00 to 19:00 (NEA's reporting window). Reported hours show NEA's reading coloured by band from the theme UV scale; unreported hours stay visibly empty.
  - Markers show the UV 3 protection level and NEA's 11:00–15:00 usual peak, labelled as NEA's general advice.
  - A short line gives the direction (rising, near peak, falling) and the number of hours so far at UV 3 or more.
  - The tile keeps its value, band and gauge, states the reading is from Changi, and shows "as of" the snapshot time.
  - It uses the hourly list already returned by the single `uv` call per refresh.
- **In scope**:
  - Keeping today's hourly UV list in the snapshot.
  - The hourly view, threshold and peak-window markers, and the direction and hours-at-3+ line in the UV tile.
  - Empty, night, error and previous-day snapshot states.
  - Changi / nationwide wording.
  - Guidance wording taken from NEA and HealthHub.
- **Out of scope**:
  - UV forecast or estimated or "typical" future hours (Option C), and any "safe after <time>" claim.
  - Location-specific UV.
  - Changing the hero's UV threshold (stays 6+).
  - Medical advice beyond NEA and HealthHub wording.
  - Alerts, notifications or automatic refreshes.
  - UV history beyond today, and the dated `uv` endpoint.
  - Moving UV into the forecast strip, a separate panel or the map.
  - Constitution changes.
- **Success metrics**:
  - From one refresh, the owner can correctly say whether UV is rising, peaking or falling (qualitative).
  - Hours at UV 3+ shown match NEA's hourly values for that day.
  - data.gov.sg requests per refresh unchanged (1 `uv` call).
  - 0 estimated values shown without a label.
  - No blank chart: missing data shows an explicit state.
- **Carried-forward open questions**:
  - Confirm the wording by reading the NEA UV Index page and HealthHub's Sun Protection page directly. Check: protection from UV 3; extra at 8+; peak 11:00–15:00; Changi, hourly 07:00–19:00, 15-minute average.
  - What does the `uv` response hold at night and just after midnight (an empty list, or yesterday's)? How should the tile read then?
  - Does a 13-hour view fit the UV tile at phone width in all 6 themes? If not, fall back to Option A's text.
  - What rule gives "rising / near peak / falling" without flicker on cloudy days?
  - Does an "as of <time>" note on the curve, plus the existing staleness labelling, stop a morning snapshot reading as the whole day? Should a previous-day snapshot hide the curve?
  - Does keeping the hero at UV 6+ beside a curve marking UV 3 confuse readers? If so, the hero threshold becomes its own follow-up.
  - Constraint to respect: direction, hour-counting and band logic must live in pure `.ts` modules to be testable (Principle IV); colours come from theme tokens (Principle V); the schema change needs a generated Drizzle migration.
