# Idea Research: New weather-app features from NEA / data.gov.sg data

- **Slug**: nea-data-new-features
- **Created**: 2026-11-13
- **Evidence confidence (overall)**: medium. Dataset shapes and codebase findings are cited and high confidence. Demand is unknown (no user signal anywhere in the repo). Datasets marked UNVERIFIED were not fetched in this session.

## Candidate Features (ranked table)

Priority = suggested order to consider, based only on evidence below (not a decision). Effort and Value are researcher estimates, tagged ASSUMPTION where noted.

| Priority | Feature | Effort | Value |
|---|---|---|---|
| 1 | **Heat stress (WBGT) tile**: nearest-station WBGT value and heat-stress level (Low / Moderate / High) per saved location | Low. Same station-matching pattern as temperature; one more optional fetch plus a snapshot field, a schema migration and a tile | Medium-High. Heat is a daily Singapore concern, and the data is official and not shown by common weather apps |
| 2 | **Sunrise / sunset and "feels like"**, derived from data already stored, no new endpoint | Low. Pure computation from coordinates (sunrise) and temperature + humidity (heat index) | Medium. Familiar weather-app tiles, but not an NEA-sourced feature |
| 3 | **Full PSI breakdown in the air-quality tile**: PM10, O3, NO2, SO2, CO and sub-indices; today only 24-hour PSI and PM2.5 are shown | Low. Data is already in the `psi` response the app calls | Medium. Useful on haze days; marginal otherwise |
| 4 | **Station-reading map layers** (rainfall, temperature, wind per station, all stations rather than the nearest one), reusing the lightning layer pattern | Medium. Needs a new island-wide endpoint, and a new exception to constitution Principle I like lightning's | Medium-High. A rainfall-by-station view shows "where is it raining now" |
| 5 | **UV hourly trend and "safe sun hours"**: `uv` returns hourly values for the day, the app keeps only the latest | Low-Medium. Needs a snapshot field that holds a list, or a small chart | Medium. Actionable for outdoor planning |
| 6 | **Rain / lightning alert banner for a saved location**: combine 2-hour forecast "showers" and nearby strikes | Medium. Lightning spec 002 lists alerts and distance-to-strike as out of scope, so this would need new scope and a new decision | Medium. Overlaps with NEA's own app and push alerts, which this web app cannot match |
| 7 | **Flood / water-level alerts (PUB)**: UNVERIFIED that these are on data.gov.sg real-time API, and whether keyless | Medium-High. New provider and shapes unknown | Medium-High if it exists. Safety value, but not NEA weather data |
| 8 | **Dengue clusters on the map (NEA)**: UNVERIFIED format; believed to be a geojson dataset, not real-time | Medium-High. Different dataset type and update cadence | Low-Medium. Off-topic for a weather app |
| 9 | **Historical charts** (past rainfall / temperature via the `date` param) | High. Param verified only for `pm25`; history would also need storage, which conflicts with snapshot-only Principle I | Medium. Needs an amendment first |

## Users & Demand

- No request, issue, usage log or spec asks for any of the features above. Demand is entirely unobserved. — [source: grep of `specs/`, `docs/`, `.specify/assessments/` for requests; none found] (confidence: high that none is recorded)
- Current tiles show: condition, air quality (PSI and PM2.5), wind, UV, temperature, rainfall, humidity, forecast high. Sections also show hourly strip, 10-day forecast and map. — [source: `frontend/src/components/Tiles.tsx`, `frontend/src/types.ts` (`WeatherSnapshot`)] (confidence: high)
- That Singapore users care about heat stress is plausible but unsourced. — [ASSUMPTION] (confidence: low)

## Prior Art

- **Lightning layer (spec 002)** is the template for any island-wide feature: user-triggered `POST` endpoint, 2-minute server cache, no SQLite, "unavailable" degradation, and a constitution amendment (v1.1.0) to permit it. Features 4, 6 and 7 would need the same pattern and their own amendment. — [source: `docs/architecture.md`; `.specify/memory/constitution.md` Principle I] (confidence: high)
- **Snapshot pattern** is the template for per-location data: add an optional fetch to `SingaporeWeatherClient` and a snapshot field. Features 1, 3 and 5 fit it directly. — [source: `docs/architecture.md`; `backend/src/weather.ts`] (confidence: high)
- **WBGT is already documented but not built in.** The repo's `sg-weather-api` skill records `weather?api=wbgt` as verified 200 with per-station `wbgt` and `heatStress`. — [source: `~/.claude/skills/sg-weather-api/references/endpoints.md`, verified live 2026-11-11] (confidence: high; not re-fetched today)
- Earlier assessment `use-my-location` exists for a separate idea; no overlap. — [source: `.specify/assessments/use-my-location/`] (confidence: high)

## Market & Context

- NEA's own weather site and app already cover radar, warnings and push alerts; a self-hosted starter app cannot compete there. Its niche is clean per-location snapshots. — [ASSUMPTION; based on general knowledge, no source fetched] (confidence: low)
- Cost of doing nothing: the app keeps working as a forecast dashboard; none of the candidates fixes an observed problem. — [ASSUMPTION] (confidence: medium)

## Data & Constraints

- Real-time API base `https://api-open.data.gov.sg/v2/real-time/api/<endpoint>`. Verified 200: `two-hr-forecast`, `twenty-four-hr-forecast`, `four-day-outlook`, `air-temperature`, `relative-humidity`, `rainfall`, `wind-speed`, `wind-direction`, `uv`, `psi`, `pm25`; plus `weather?api=lightning` and `weather?api=wbgt`. — [source: sg-weather-api skill, verified 2026-11-11] (confidence: high)
- **Unused fields in calls already made**: `psi` sub-indices and PM10, O3, NO2, SO2, CO; `uv` hourly `index[]`; station lists for temperature, humidity, rainfall and wind (all stations, not just the nearest). — [source: endpoints.md "uv", "psi and pm25", "Station readings"] (confidence: high)
- **Rate limit**: 6 requests per 10 s without a key, 12 with a Dev key, 30 with a Prod key. The client already makes about 10 calls per refresh at 250 ms spacing with a 1 s 429 retry, which the skill flags as optimistic. Each added per-location endpoint (e.g. WBGT) raises 429 risk. — [source: sg-weather-api skill; `docs/architecture.md`] (confidence: high)
- WBGT readings are station-based strings (`"29.3"`) and need `Number()` coercion; `heatStress` is a string level. — [source: endpoints.md] (confidence: high)
- **Constitution limits**: no data.gov.sg calls on page load (Principle I); island-wide data requires an explicit exception; new frontend logic worth testing must be pure `.ts`; new colours via theme system. — [source: `.specify/memory/constitution.md`] (confidence: high)
- Schema changes require a generated Drizzle migration. — [source: constitution, Technical Constraints] (confidence: high)
- Dataset sample dumps in `RealtimeWeatherReadingsacrossSingapore/` must not be committed. — [source: `CLAUDE.md`] (confidence: high)

## Evidence Against the Idea

- No user demand is recorded for any candidate; the table is supply-driven (what data exists), not demand-driven.
- Every extra per-location endpoint worsens keyless 429 risk; without an API key, adding WBGT may degrade existing refreshes. — [source: sg-weather-api skill] (confidence: high)
- Island-wide layers (feature 4) each require a constitution amendment, as lightning did. — [source: constitution Principle I] (confidence: high)
- Features 7 and 8 may not be on data.gov.sg's real-time API at all, and are not NEA weather data. (UNVERIFIED)
- The app is a starter project; adding many tiles raises UI density and test surface with unproven benefit. — [ASSUMPTION] (confidence: low)

## Gaps & Open Questions

- [NEEDS CLARIFICATION: Is a data.gov.sg API key available? It changes the effort of every per-location feature.]
- [NEEDS CLARIFICATION: Is the dashboard meant for the public or for personal use? This changes the value of alerts and heat stress.]
- [NEEDS CLARIFICATION: Are PUB flood / water-level and NEA dengue datasets on data.gov.sg and in what shape? Not fetched here.]
- [NEEDS CLARIFICATION: Does the `date` param work on endpoints other than `pm25`? Needed before any history feature.]
- [NEEDS CLARIFICATION: Which of the candidates, if any, should go forward to `/speckit-assess-define`? Priority above is an ordering of evidence, not a decision.]

## Sources

- `~/.claude/skills/sg-weather-api/SKILL.md` and `references/endpoints.md` (local; verified live 2026-11-11)
- Repo files: `docs/architecture.md`, `.specify/memory/constitution.md`, `backend/src/weather.ts`, `frontend/src/types.ts`, `frontend/src/components/Tiles.tsx`, `specs/002-lightning-map-layer/spec.md`, `CLAUDE.md`
- Web: no pages fetched (hosts not on the allowlist were not contacted). api-open.data.gov.sg (host, policy: not fetched this session; relied on prior verification recorded in the local skill)
