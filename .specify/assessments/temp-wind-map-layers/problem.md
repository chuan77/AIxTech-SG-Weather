# Problem Definition: Comparing temperature and wind across Singapore, not just at saved places

- **Slug**: temp-wind-map-layers
- **Created**: 2026-11-19
- **Inputs used**: research.md | user input (owner answers, 2026-11-19). No `intake.md`. This is the gated step 2 of `station-reading-map-layers`, whose `problem.md` already named temperature and wind as a goal.

## Problem Statement

People using the app see temperature and wind only at the one station nearest each saved place. So they can't tell where on the island it is hotter or cooler, which way and how hard the wind is blowing somewhere they plan to go, or whether wind and temperature are shifting the way they do before a storm. It matters now because the rain view (spec 011) has shipped and the owner uses it. The step 2 condition, "only if rain proves useful", is met on that basis [source: owner, 2026-11-19; research.md "Users & Demand"].

## Affected Users & Stakeholders

- **Users**:
  - **The owner**, on laptop and mobile: today's only confirmed user. They want this for four purposes, ranked equally (owner, 2026-11-19):
    - choosing where to go by comparing hotter and cooler places;
    - checking wind direction and strength before an outdoor activity;
    - reading wind and temperature next to rain and lightning as a sign that a storm is coming;
    - general curiosity about conditions across the island.
  - **Public users switching from a mobile weather app**, the planned audience on laptop and mobile, fewer than 5 at launch [source: memory `public-mobile-release`; `station-reading-map-layers/decision.md` OQ1]. Nobody outside the owner has asked for this [source: research.md "Users & Demand"]. [NEEDS CLARIFICATION: is there any signal from users other than the owner?]
- **Stakeholders**:
  - **Owner (decision-maker)**: approves scope and any constitution exception.
  - **Constitution Principle I**: it allows exactly two island-wide layers, lightning and rain. "Any further exception requires its own amendment" [source: research.md "Rules that apply"].
  - **The shared data.gov.sg rate budget**: one Development key, paced in one queue shared by location refreshes, rain and lightning [source: research.md "Rate budget and timing"].

## Goals

- **Compare temperature**: a user can tell which parts of the island are hotter or cooler right now than others.
- **Know the wind**: a user can tell the wind direction and roughly how strong it is near a place they care about, even if it is not saved.
- **Context for storms**: these readings can be seen together with rain and lightning, so changing conditions can be read in one place.
- **Honest coverage**: with readings at only about 17 points, some of them offshore, a user is never led to think a reading describes a place far from its station. Missing and out-of-date readings are clearly marked, never shown as normal values [source: research.md live findings 2–3].
- **Equal standing**: temperature and wind are weighed equally (owner, 2026-11-19).
- **No harm to what exists**: saved-place refresh, the rain view and lightning stay as fast and as readable as today, on every theme, down to 375 px.

## Non-Goals

- Humidity, UV, PSI and WBGT on the map (excluded since step 1).
- Values estimated between stations, forecasts, nowcasts and "storm coming" predictions or alerts. Users read the conditions; the app does not predict.
- Push notifications and alerts.
- History, trends or replay of temperature or wind.
- Changing the per-place tiles, the rain view or the lightning layer.
- Sources other than NEA, and getting a Production API key.

## Success Metrics

- **Answerable questions (qualitative, owner judgement)**: using only the app, the owner can answer "where is it hottest or coolest right now?" and "which way is the wind blowing near X, and how hard?" (baseline: neither can be answered for a place that isn't saved).
- **Freshness**: no reading is shown as current when it is older than the source's one-minute cadence, plus the observed 3–4 minute lag, plus the shared cache window. The age shown matches the source timestamp (baseline: not applicable).
- **Coverage honesty**: every station shows a value or is clearly marked as missing (baseline: not applicable).
- **No regression**: saved-place refresh stays at about 10–15 s, and there is no increase in 429 responses (baseline: about 10–11 s and zero 429s, from spec 005 T027).
- **Readability**: readable at 375 px on every theme, alongside rain and lightning (baseline: two layers fit today).
- **Use after shipping (qualitative)**: the owner still uses it after a couple of weeks, the same test that rain passed (baseline: not applicable).

## Cost of Inaction

Nothing breaks. No rate budget is spent and no constitution change is needed. Each saved place's tiles already show temperature, wind and "feels like". The gap stays: to compare places or check wind somewhere unsaved, a user has to save it, look elsewhere or guess, and the map shows rain and lightning but not the wind and cooling that come with storms [source: research.md "Market & Context"].

## Open Questions

- [NEEDS CLARIFICATION: Will the owner accept a third Principle I exception, on the same terms as lightning and rain?]
- [NEEDS CLARIFICATION: Do about 17 stations, a median 5.7 km apart and some offshore, give enough coverage to meet the goals? A mock-up check like step 1's Gate 2 is one way to settle it.]
- [NEEDS CLARIFICATION: Is the station count stable across the day? S199 has no name. Only one sample has been taken.]
- [NEEDS CLARIFICATION: How large is the temperature spread on a hot afternoon, and how much does the wind change in a storm? This decides whether "compare" and "storm context" are met in practice.]
- [NEEDS CLARIFICATION: How far from a station can a reading still describe a place? WBGT uses 10 km. Does the same apply here?]
- [NEEDS CLARIFICATION: Is there any demand from users other than the owner?]
- [NEEDS CLARIFICATION: Carried from step 1, OQ8: the licence and attribution wording for showing NEA data publicly.]
