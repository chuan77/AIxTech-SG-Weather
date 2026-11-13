# Decision: Outdoor-conditions tiles (heat stress, feels like, sun times, air-quality detail)

- **Slug**: nea-data-new-features
- **Decided**: 2026-11-13
- **Verdict**: go
- **Artifacts reviewed**: research.md | problem.md | concept.md (intake.md absent; research was run directly from user input)

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | adequate | The gap is real and observable: today's tiles cannot answer "is it safe or comfortable to be outside?" (problem.md). It is a missed opportunity, not a reported pain. |
| Evidence strength | adequate | Data availability and fit are well cited: WBGT and PSI shapes were verified live on 2026-11-11, and the 11-call refresh and 250 ms pacing were read from the code. Demand rests on the owner alone, which suffices for a personal-use version (problem.md, "Resolved by the owner"). Weaker points: the Steadman formula is unverified and the owner cannot yet picture the features. |
| Value vs. inaction | adequate | Doing nothing costs little (concept.md, Option C), but the build is small, reuses data already fetched, and fixes a latent 429 risk that exists anyway. |
| Feasibility / appetite | strong | Option B is small to medium (one to two weeks), follows existing patterns (snapshot fields, nearest-station matching) and needs no new provider. |
| Strategic fit | strong | Per-location data, fetched only on create or refresh, so Principle I holds with no amendment. Deterministic formulas keep Principle III testability. New labels go through the theme system (Principle V). |
| Risk posture | adequate | Main risks are named and have mitigations: rate budget (slower pacing, Prod key as fallback), the "Heat Stress" clash (separate labels), null inputs (agreed handling). Unresolved: whether the v1 endpoint shares the limit, WBGT station coverage, and pacing shared with the lightning client. |

## Verdict & Rationale

**Go**, for Option B built in two steps. Problem validity and evidence are both adequate, the appetite is small, and it fits the constitution without amendment. Evidence counts as adequate rather than strong because demand comes from one person and the owner has not yet seen the features. That is why the build is split: step 1 (feels like, sun times, pollutant detail) uses no new endpoint and works as a cheap visual check. **Step 2 (WBGT plus the slower pace) proceeds only if step 1 proves useful**; otherwise stop there, which concept.md accepts as a valid outcome.

## If needs-clarification

- Not applicable.

## If go: Handoff to `/speckit-specify`

- **Problem**: a person checking a saved Singapore location cannot tell whether it is safe or comfortable to be outside: heat strain, how hot it feels, daylight times and the pollutant behind the air-quality number are all missing.
- **Chosen approach**: concept.md Option B in two steps. Step 1: Steadman "feels like" tile (bands, labels, clothing copy, umbrella rule and null handling as decided in problem.md), today's sunrise/sunset, and the PSI pollutant breakdown. Step 2: WBGT heat-stress tile (health guidance only at Moderate or High; "No reading" state) plus request pacing of about 850 ms and a 429 retry wait of about 10 s. Step 2 is gated on step 1 being useful. Recommend specifying step 1 as its own feature first.
- **In scope / out of scope**: in: the four readouts above, per saved location, from create or refresh only. Out: research Priorities 4-9 (kept as reference), LLM output, alerts or push notifications, medical advice beyond NEA-level guidance on the WBGT tile, sun times on the hourly strip or forecasts, Prod-key management, constitution changes.
- **Success metrics**: the owner can answer "is it safe or comfortable outside now?" from the dashboard (qualitative); no rise in refreshes hitting 429; every new readout shows a value or an explicit "No reading" state, never a blank tile.
- **Carried-forward open questions**:
  - Confirm the Steadman apparent-temperature formula from a primary source.
  - Is a refresh of about 10 s acceptable, or apply for a Prod key? (step 2)
  - Does the v1 `4-day-weather-forecast` endpoint count toward the same rate limit? (step 2)
  - How far can the nearest WBGT station be before its value is not meaningful? (step 2)
  - Can the tile grid take the new readouts? Mockups during specification should confirm this.
  - How should pacing be shared between the weather and lightning clients? (step 2)
