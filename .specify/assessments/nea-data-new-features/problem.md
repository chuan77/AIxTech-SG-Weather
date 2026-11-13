# Problem Definition: Richer outdoor-conditions info per saved location

- **Slug**: nea-data-new-features
- **Created**: 2026-11-13
- **Inputs used**: research.md (intake.md absent), user input
- **Scope (from user)**: research Priorities 1-3 only (heat stress, sun times / "feels like", air-quality detail). Priorities 4-9 stay unbuilt and remain recorded in `research.md` as reference for future research and development.

## Problem Statement

A person checking a saved Singapore location sees temperature, humidity and a one-line air-quality reading, but nothing that says whether it is safe or comfortable to be outside (heat strain, how hot it actually feels, when daylight ends, which pollutant is driving the air-quality number). Official data that answers these is available, and part of it is already fetched and discarded.

## Affected Users & Stakeholders

- **Users**: people checking the weather for a saved location before going outdoors (exercise, commuting, outdoor work, children). How often they do this is unknown. — [NEEDS CLARIFICATION: who the real users are; no usage or request data exists, per research.md "Users & Demand"]
- **Stakeholders**: the repo owner, who decides scope and owns the constitution; no other stakeholders are evidenced.

## Goals

- A user can judge outdoor heat risk for a saved location from official data, without leaving the app.
- A user can see how hot it feels, not only the air temperature, and when daylight starts and ends.
- A user can see what is behind the air-quality number, using data the app already receives where possible.
- The additions do not make existing refreshes less reliable (research.md: keyless limit is 6 requests per 10 s).
- The additions respect the constitution: snapshot-only data, theme system, tests within existing limits.

## Non-Goals

- Priorities 4-9 from research.md: station map layers, UV trend, alert banner, flood or dengue data, historical charts. They are kept as reference only.
- Any change to the constitution's principles.
- Push notifications, alerts or medical advice.
- Replacing NEA's own site or app.

## Success Metrics

- Qualitative: a user can answer "is it safe or comfortable to be outside now?" for a saved location from the dashboard alone. (baseline: cannot; heat stress and sunset time are absent today)
- Refresh reliability: share of location refreshes that finish with no 429 on any endpoint does not drop after the change. (baseline: unknown; research.md flags the current 250 ms spacing as optimistic against the keyless limit)
- Data coverage: new readings show a value or an explicit "unavailable" for every saved location, never a blank or broken tile. (baseline: n/a)
- Adoption or demand metrics: [NEEDS CLARIFICATION: no usage tracking is evidenced beyond interaction logs to `POST /api/logs`; whether those could measure this is unverified]

## Cost of Inaction

The dashboard keeps working as a forecast display. Nothing in the repo shows users asking for these items, so the cost is a missed opportunity, not an observed failure. Unused fields from endpoints already called stay unused. The more speculative features are unaffected, since they remain recorded in research.md.

## Resolved by the owner (2026-11-13)

- **Audience**: personal use for this version. Heat-risk guidance can stay informational; no public-facing duty of care is assumed.
- **API key**: available as `WEATHER_API_KEY` in `.env` (git-ignored). Both existing clients already send it as `x-api-key` (`backend/src/routes/locations.ts`, `backend/src/routes/lightning.ts`), so the limit is the Dev/Prod tier (12 or 30 per 10 s) rather than 6, which eases the 429 concern. The tier is unconfirmed.
- **Demand**: none beyond the owner, who cannot yet picture how items 1-3 would look. Seeing the options is therefore part of the next stage.
- **"Feels like" method**: the Steadman apparent-temperature formula (the non-radiation form used by Australia's Bureau of Meteorology: AT = Ta + 0.33e - 0.70ws - 4.00, where e is vapour pressure derived from humidity and ws is wind speed in m/s). Deterministic, no LLM. This replaces the earlier NWS heat-index choice. The formula is quoted from general knowledge, not a fetched source, so the shape stage should confirm it. [UNVERIFIED]
- **Inputs**: temperature, humidity and wind speed are all already in the stored snapshot (`WeatherSnapshot`), so no new fetch is implied. Wind is stored in knots and would need converting to m/s.
- **Missing station reading**: shown as a neutral "No reading" label with a tooltip, not a telecom-tower icon (it could read as "no signal"). Accepted on the researcher's recommendation.

## Owner-supplied input for shaping (2026-11-13)

The owner supplied this banding for "feels like" (Steadman apparent temperature, AT) to be used first. It is the owner's own scale, not an NEA or other cited source. [ASSUMPTION]

| Steadman AT | Local label | Clothing and gear advice |
|---|---|---|
| Below 24.0 C | Chilly / Air-Con Cold | Wear a jacket. Rare outdoors in Singapore except during heavy monsoon rain; bring a light sweater or windbreaker. |
| 24.0 - 26.9 C | Cool & Breezy | Optional light layer. Comfortable for walking outdoors, though breezy or damp if raining. |
| 27.0 - 31.9 C | Warm & Pleasant | Standard tropical wear. Breathable cotton or dry-fit clothing; no jacket needed. |
| 32.0 - 36.9 C | Hot & Humid | Hydrate and seek shade. Sweat evaporates slowly; avoid heavy exertion midday. |
| 37.0 C and above | Sweltering / Heat Stress | High heat risk. Limit outdoor exposure, stay hydrated, and use sun protection. |

Points to settle in shaping (not decided here):
- The bands are written to one decimal place; how a value such as 26.95 is rounded or bucketed is unspecified.
- The top band is named "Heat Stress", which is also NEA's term for WBGT (feature 1). Two tiles using similar wording with different scales could contradict each other. [ASSUMPTION: this is a real risk; untested]
- The advice text is clothing guidance, not medical advice, consistent with the non-goals.

### Proposed revisions from Gemini (pasted by the owner, 2026-11-13)

Source: a Gemini response the owner pasted. It is unsourced opinion, not evidence. [ASSUMPTION] Whether the owner adopts it is not yet stated.

- **Rounding**: round the raw AT to one decimal place (half-up), then bucket with continuous inequalities: below 24.0; 24.0 up to but not including 27.0; 27.0 up to 32.0; 32.0 up to 37.0; 37.0 and above. This closes the 26.95 gap.
- **Labels** (to avoid clashing with NEA's WBGT "Heat Stress"): Chilly; Breezy & Cool; Warm; Hot & Muggy; Scorching (or Sweltering). "Heat Stress" would be reserved for the WBGT tile.
- **Advice copy**: clothing and umbrella only, no medical directives (no "hydrate" or "limit exertion"):
  - Chilly: jacket or hoodie; layer up for wind and rain.
  - Breezy & Cool: bring a light layer; a thin cardigan helps in breezy or damp spots.
  - Warm: short sleeves and light trousers or shorts; no jacket.
  - Hot & Muggy: breathable, loose fabrics, dry-fit or light cotton; UV umbrella in open sun.
  - Scorching: minimal airy clothing, moisture-wicking wear, sunglasses, UV umbrella.
- **Rain rule**: when station rainfall is above 0.1 mm, append "Carry an umbrella" to the active tier. Gemini left open whether to also use the 2-hour forecast; that is a shaping decision.
- Differences from the owner's earlier table: renamed labels, medical-style advice removed (this matches the non-goal of no medical advice), rain rule added.

### Owner decisions on the Gemini proposal (2026-11-13)

- **Adopted**: Gemini's rounding rule, labels (Chilly; Breezy & Cool; Warm; Hot & Muggy; Scorching) and clothing-only advice copy. This supersedes the owner's earlier table.
- **Health guidance moves to WBGT**: the dropped lines ("hydrate", "limit outdoor exposure") appear on the WBGT tile, and only when NEA reports Moderate or High heat stress.
- **Umbrella rule**: show "Carry an umbrella" when the 2-hour forecast for the area mentions rain, showers or thunder, or when the nearest station reports more than 0.1 mm. Null station rainfall counts as no rain signal and never blocks the note.
- **Null inputs for "feels like"**: if temperature or humidity is null, show the standard "No reading" state with a tooltip naming the missing inputs. If only wind is null, compute with wind = 0 and mark the value "approx." (still air errs warm, the safer direction).
- **Request budget**: the client makes 11 calls per refresh today (`backend/src/weather.ts`); WBGT makes 12, equal to the Dev-key limit of 12 per 10 s. At the current 250 ms spacing (`backend/src/providerHttp.ts`) and roughly 1 s 429 retry, overlapping refreshes or lightning calls will hit 429. Direction agreed: pace requests at about 850 ms and make a 429 retry wait about 10 s, accepting a refresh of about 10 s; a Prod key (30 per 10 s) is the alternative.

## Open Questions

- [NEEDS CLARIFICATION: Slower pacing (about 10 s refresh) or apply for a Prod key? To be settled in `/speckit-assess-shape`.]
- [NEEDS CLARIFICATION: Does the v1 `4-day-weather-forecast` endpoint count toward the same rate limit? Unverified.]
