# Concept: Outdoor-conditions tiles (heat stress, feels like, sun times, air-quality detail)

- **Slug**: nea-data-new-features
- **Created**: 2026-11-13
- **Recommended option**: Option B: All three features, with a slower request pace

## Options

### Option A: Use stored data only (no new endpoint)
- **Sketch**: Each saved location gains a "Feels like" tile and a sunrise/sunset readout, and the air-quality tile expands to show the individual pollutants behind the PSI number. "Feels like" uses Steadman apparent temperature with the agreed bands, labels, clothing copy, umbrella rule and null handling (problem.md). Sunrise/sunset is computed from the location's coordinates. The pollutant detail uses fields the app already receives from `psi` and currently throws away. No NEA heat-stress (WBGT) reading is added.
- **Appetite**: small (days)
- **Trade-offs**: Wins: no extra calls to data.gov.sg, so no 429 risk and no change to request pacing. Every input already exists in the snapshot or in responses already fetched (research.md, "Data & Constraints"). Sacrifices: it leaves out the one item the research ranked highest, official heat stress, so the first goal ("judge outdoor heat risk from official data") is only partly met. "Feels like" is a comfort measure, not NEA's heat-strain measure. The "hydrate / limit exposure" guidance has nowhere to go, because it was moved to the WBGT tile.
- **Rabbit holes**: sunrise/sunset accuracy and edge handling (time zone, rounding to the minute); deciding which pollutants to show and how to explain sub-indices without clutter; a tile grid that is getting crowded.

### Option B: All three features, with a slower request pace (recommended)
- **Sketch**: Everything in Option A, plus a WBGT heat-stress tile for each saved location: the nearest station's WBGT value, NEA's level (Low / Moderate / High), and the health guidance only at Moderate or High. A station with no reading shows the standard "No reading" state. Requests are spaced further apart so a refresh with 12 endpoints fits inside the Dev key's 12 per 10 s, which means refreshing a location takes about 10 s instead of about 3 s.
- **Appetite**: small to medium (one to two weeks). The WBGT fetch follows the existing nearest-station pattern. The pacing change touches code shared with lightning.
- **Trade-offs**: Wins: meets all three goals, and the heat-risk goal uses official NEA data. The comfort tile and the heat-stress tile have separate wording, so they don't clash. The slower pace also fixes a latent 429 risk that exists even without WBGT (11 calls in about 3 s today). Sacrifices: refresh and location creation feel slower, because create waits for the first refresh. Adds one more stored field, which needs a schema migration. Risks: the Dev limit could be tighter in practice if the v1 4-day endpoint shares the budget (unverified), and a manual lightning refresh during a location refresh still competes for the same 10 s window.
- **Rabbit holes**: coordinating the pace across the weather and lightning clients (shared limit, separate clients); showing refresh progress so a 10 s wait doesn't look broken; WBGT station coverage (how far away the "nearest" station can be before the value means nothing); two adjacent heat-related tiles reading as one confusing message.

### Option C: Do nothing (use NEA's own app for heat and air quality)
- **Sketch**: No change. For heat stress and detailed air quality, the owner checks NEA's myENV app or weather.gov.sg alongside the dashboard.
- **Appetite**: none
- **Trade-offs**: Wins: zero effort and no new risk. Sacrifices: the goals stay unmet, unused data stays unused, and the latent 429 risk remains. There is no evidence of demand beyond the owner (problem.md), so the real cost is small, which makes this a credible option.
- **Rabbit holes**: none

## Recommendation

**Option B**, built in two steps so value arrives early:

1. Option A first (feels like, sun times, pollutant detail). It uses no new endpoint, so it can ship and be looked at quickly. The owner said they cannot yet picture these features (problem.md), so seeing the tiles early tests the idea cheaply.
2. Then WBGT plus the slower pace. This meets the heat-risk goal with official data and protects refresh reliability (the "no rise in 429s" success metric).

The pacing change is recommended over buying a Prod key for this version: it is personal use, the slower refresh happens only on a click, and it removes a real 429 risk with no external dependency. A Prod key stays an option if 10 s proves annoying.

Option C is the honest fallback if the step-1 tiles turn out not to be useful in practice. In that case, stop before WBGT.

## Out of Scope (for the recommended option)

- Research Priorities 4-9 (station map layers, UV trend, alert banner, flood/dengue data, historical charts). Kept in research.md as reference.
- LLM-generated text or values of any kind.
- Push notifications or alerts; medical advice beyond NEA-level heat guidance on the WBGT tile.
- Changes to constitution principles. Every new value here is per location and fetched only on create or refresh, so Principle I holds without amendment.
- Showing sunrise/sunset on the hourly strip or in forecasts; this version shows today's times only.
- Applying for or managing a Prod key.

## Assumptions to Validate

- The Steadman apparent-temperature formula as quoted in problem.md is correct and suits Singapore's ranges. [UNVERIFIED; general knowledge, not a fetched source]
- `weather?api=wbgt` still returns the shape recorded in the sg-weather-api skill (verified 2026-11-11), and the owner's Dev key works against it.
- About 850 ms spacing keeps a 12-call refresh under the Dev limit, and the v1 4-day endpoint either shares that limit or doesn't change the result. [UNVERIFIED]
- A refresh of about 10 s is acceptable for personal use. [ASSUMPTION; owner to confirm]
- WBGT stations are close enough to typical saved locations for the value to be meaningful. [UNVERIFIED; station count and spread not checked]
- Sunrise/sunset can be computed locally to within about a minute with no external data. [ASSUMPTION]
- The tile grid can take three more readouts without hurting readability; mockups during specification should confirm this. [ASSUMPTION]
