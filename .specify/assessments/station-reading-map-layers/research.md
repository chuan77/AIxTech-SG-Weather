# Idea Research: Island-wide rain, temperature and wind station layers on the map

- **Slug**: station-reading-map-layers
- **Created**: 2026-11-16
- **Evidence confidence (overall)**: medium. The data shapes, query parameters, rate limits and codebase precedents come from official OpenAPI specs and repo files, so confidence there is high. Update cadence is medium (official pages disagree with each other). Demand is low: one owner, with no outside user signal.
- **Inputs**: `problem.md` (written before this research; this slug has no `intake.md`), the earlier `nea-data-new-features` assessment, the official data.gov.sg OpenAPI specs saved in `RealtimeWeatherReadingsacrossSingapore/` (untracked, read only), repo code and docs, and three web searches. No pages were fetched.

## Users & Demand

- The only stated demand is the owner's: the app will be released publicly as a replacement for a mobile weather app, and people switching to it will expect an island-wide view. — [source: `problem.md` Owner Decisions; memory `public-mobile-release`] (confidence: medium; stated, not observed)
- No issue, ticket, usage log or user request asks for station layers. The feature was first listed as research Priority 4 because the data exists, not because anyone asked for it. — [source: `.specify/assessments/nea-data-new-features/research.md` "Users & Demand"] (confidence: high that none is recorded)
- The feature was explicitly deferred "to the next release" when the outdoor-tile work went ahead. — [source: `.specify/assessments/nea-data-new-features/decision.md` Step 2 gate] (confidence: high)
- The main mobile alternative, NEA's own myENV app, offers a "Rain" overlay on its landing page and push alerts for heavy rain. App Store reviews complain that rain needs extra steps and that wind and lightning readings require saving a location first. That suggests some users want quicker access to island-wide conditions, but it is anecdotal. — [source: NEA myENV feature guide PDF and App Store reviews, from search snippets only] (confidence: low)
- Users want "where is it raining right now?" more than island-wide temperature or wind. — [ASSUMPTION; nothing found that ranks rain, temperature and wind against each other] (confidence: low)

## Prior Art

- **Lightning layer (spec 002), the internal template.** An island-wide layer with these parts: a user-triggered `POST /api/lightning/refresh`, a 2-minute in-memory cache shared by all callers, nothing stored in SQLite, a stale fallback (`stale: true`) and a 502 when there is no data, an initial "Show latest lightning" prompt so nothing is fetched on page load, an on/off toggle remembered per browser, and a constitution amendment (v1.1.0). — [source: `docs/architecture.md` "Lightning exception"; `specs/002-lightning-map-layer/spec.md`; `.specify/memory/constitution.md` §I] (confidence: high)
- **Lightning already pages through dated data.** `SingaporeLightningClient` walks up to 3 pages of today's records (`MAX_PAGES_TODAY = 3`), then the previous SGT date once, newest first, using `date=` and `paginationToken`. That gives a tested pattern for multi-reading windows, but on a different endpoint family (`weather?api=`) whose order is newest first. — [source: `backend/src/lightning.ts:61`, `:283-332`] (confidence: high)
- **Storm-scale lessons (specs 007 and 009).** Drawing many markers froze the map during a real storm until strikes were grouped. Station layers are far smaller (about 60–90 points per reading), so this risk is low, but it shows the map's marker budget matters on phones. — [source: git log `aa46e25`; `docs/architecture.md` storm fixture, 37,242 strikes] (confidence: high for the history; the station-count comparison is an inference)
- **Station data is already fetched and mostly thrown away.** `fetchNearestReading` downloads every station's latest reading for `air-temperature`, `rainfall`, `wind-speed` and `wind-direction` on each location refresh, then keeps only the nearest station's value. — [source: `backend/src/weather.ts:391-424`] (confidence: high)
- **External: myENV (NEA).** It has a rain overlay and heavy-rain push alerts; its guide documents turning on the overlay. — [source: NEA myENV guide PDF, myENV download page; search snippets only] (confidence: medium)
- **External: "Environment" (Vincent Neo, third-party iOS app).** Its listing describes rain maps with 240 km range and weather-station data from local agencies. That shows a third-party app has built station data into a map. — [source: App Store listing, search snippet only] (confidence: low)
- Whether weather.gov.sg (NEA's Meteorological Service site) has an interactive island-wide station map was **not confirmed**. — [source: search returned no such page] (confidence: low)

## Market & Context

- What users rely on today: the rain radar and overlay in myENV and on NEA's site. Those show **radar-derived rain areas**, which cover the space between stations. A station layer shows **measured totals at points** (about 60–90 places), which is more exact at each station but leaves gaps between them. — [source: myENV guide (snippet); the radar comparison is an ASSUMPTION based on general knowledge] (confidence: low-medium)
- The data.gov.sg real-time API gives no radar imagery; rain areas from radar are not on the verified endpoint list. So "where it's raining" in this app can only come from stations, unless another source is added (out of scope). — [source: `~/.claude/skills/sg-weather-api/references/endpoints.md` verified endpoint list] (confidence: medium; the list covers only what was tried)
- Cost of doing nothing: nothing breaks and no rate-limit risk is added. The public release lacks an island-wide view, so users may keep their old app open alongside this one. — [source: `problem.md` Cost of Inaction] (confidence: medium; the user behaviour is an assumption)

## Data & Constraints

### What the endpoints offer (official OpenAPI spec v1.0.11)

- All five station endpoints (`rainfall`, `air-temperature`, `relative-humidity`, `wind-speed`, `wind-direction`) accept `date` and `paginationToken` query parameters and an optional `x-api-key` header. Before, the skill had treated `date` as verified only for `pm25`. — [source: `RealtimeWeatherReadingsacrossSingapore/*.json`, `paths./<endpoint>.get.parameters`] (confidence: high that it is documented; **not tried live**)
- `date=YYYY-MM-DD` returns **all readings for that day**. `date=YYYY-MM-DDTHH:mm:ss` returns **the latest readings at that moment**. With no `date`, the endpoint returns the latest reading. — [source: rainfall spec, `description`] (confidence: high for documented behaviour)
- Pagination: `paginationToken` appears only when there is a next page. The documented example token `b2Zmc2V0PTEwMA==` decodes to `offset=100`, which suggests pages of 100. Whether 100 counts timestamps or station rows, and whether a day's readings come oldest or newest first, is undocumented. — [source: rainfall spec 200 schema; decoding is local] (confidence: medium on page size, unknown on order)
- **The 15-minute rain window looks reachable** in one of two ways, neither tested:
  - (a) three point-in-time calls (now, −5 min, −10 min) via `date=…THH:mm:ss`, then add up the three 5-minute totals per station;
  - (b) one `date=YYYY-MM-DD` call, possibly paging to the newest readings.

  With 288 five-minute readings per day, (b) late in the day could mean about 3 pages if they come oldest first. — [source: spec; the arithmetic is an inference] (confidence: medium)
- Rainfall `readingType` is "TB1 Rainfall 5 Minute Total F" and its unit is mm. Temperature is °C, wind speed is knots and wind direction is degrees. — [source: specs; `endpoints.md`] (confidence: high)
- The spec names the station coordinate field `labelLocation`, but live responses were observed with `location`. A parser should accept the field seen live and test against fixtures. — [source: rainfall spec schema vs `endpoints.md` "Station readings"] (confidence: high that they differ)
- Station counts: rainfall had 88 stations with 88 values when observed. Some stations are listed but have no value in `readings[0].data`, so "missing" must be defined per station. — [source: `endpoints.md`] (confidence: high for that observation; counts vary)
- 400 errors are documented for a bad date format and a bad pagination token, and 404 `REAL_TIME_API_DATA_NOT_FOUND` for missing data. — [source: spec responses] (confidence: high)

### How fresh the data is

- Official dataset pages list rainfall and air temperature as updated **every 5 minutes**. The collection page says readings come "at up to one-minute intervals", and older R client docs say "every half minute" for non-rainfall readings. The cadence for temperature and wind is therefore uncertain (1 to 5 minutes). Rainfall at 5 minutes is consistent across sources. — [source: data.gov.sg dataset and collection pages, datagovsgR docs, via search snippets only] (confidence: medium for rain, low for temperature and wind)
- So a cache of about 2 minutes (as for lightning) would rarely hide a new rain reading, but could hide one or two temperature or wind updates if they really arrive every minute. — [inference from the above] (confidence: low)

### Rate budget and timing

- The limit is per key and resets every 10 s: 6 requests without a key, 12 with Development, 30 with Production. A Development key is configured. The app paces every data.gov.sg call (weather and lightning) through one shared `ProviderRequester` at `ceil(10000/limit)+50` ms: 884 ms on a Development key. A 429 is retried once after 10 s. — [source: `docs/architecture.md`; `backend/src/providerHttp.ts:4`; nea `decision.md` Step 2 gate] (confidence: high)
- Estimated cost of one island-wide fetch: rain (1 call, or 3 for the 15-minute window via option (a)) + temperature (1) + wind speed (1) + wind direction (1) = **4 to 6 calls ≈ 2.7 to 4.4 s of pacing alone** on a Development key, before provider latency, or more if other refreshes share the queue. That is close to the <5 s fresh-data target in `problem.md`. — [inference from pacing figures] (confidence: medium)
- Saved-location refresh measured 9.8–10.9 s with zero 429s across 5 overlapping runs. Any island-wide fetch shares that queue, so a layer refresh running alongside a location refresh would slow both. — [source: spec 005 T027 §4–§5, cited in `problem.md`] (confidence: high for the baseline; the slowdown is an inference)
- Public release: hosting is planned as one Vercel container (`lepak-weather`). Both the rate pacing and the lightning cache are per instance and were judged "fine below 5 visitors". A shared server-side cache would let all viewers reuse one island-wide fetch (as lightning does). But one key's budget does not grow with users, and multiple instances would each spend it separately. — [source: `.specify/assessments/vercel-container-hosting/decision.md` Risk posture; memory `hosting-names`] (confidence: high for the plan; scaling is an inference)

### Rules that apply

- Constitution Principle I forbids data.gov.sg calls on page load. The lightning exception is worded for lightning only ("Any further exception requires its own amendment"). A separate island-wide fetch therefore needs a new amendment. Reusing readings from the last saved-location refresh would not, but those readings are only as fresh as that refresh and carry one reading, not 15 minutes. — [source: `.specify/memory/constitution.md` §I] (confidence: high)
- New colours must go through the theme tokens (`--ink`, theme system), and frontend logic worth testing must sit in pure `.ts` files. — [source: constitution; `docs/theming.md`; nea `research.md`] (confidence: high)
- No licensing or compliance issue was found for showing NEA data. data.gov.sg datasets are published openly. — [ASSUMPTION; licence terms not fetched this session] (confidence: low)

## Evidence Against the Idea

- **Demand is one person's expectation.** No user has asked for this. Its value at launch rests on the assumption that people switching apps expect an island-wide view. — [source: nea `research.md`; `problem.md`]
- **NEA's free myENV app already shows a rain overlay and pushes heavy-rain alerts.** Its radar-based rain areas likely answer "where is it raining?" better than about 88 point readings with gaps between them, and "is the rain moving toward me?" (a `problem.md` question) can't be answered well from 15 minutes of station totals. — [source: myENV guide (snippet); the radar comparison is an ASSUMPTION]
- **The rate budget is the binding constraint, not the feature.** 4 to 6 more paced calls per layer refresh compete with the ~10 s saved-location refresh on one Development key. A public release multiplies demand on that same key. — [source: `docs/architecture.md`; hosting `decision.md`]
- **A second constitution exception is required** for a separate fetch, and the 15-minute window brushes against "snapshot-only" (it needs either several calls or a daily query with paging). — [source: constitution §I]
- **Undocumented API behaviour is load-bearing.** The order of a day's readings, what a page of 100 counts, and whether `date=…THH:mm:ss` works on every station endpoint have not been tried live. If a point-in-time query fails, the 15-minute window gets expensive. — [source: OpenAPI spec gaps]
- **Temperature and wind vary little across a small island** on most days, so those two layers may add map clutter for little insight. — [ASSUMPTION] (confidence: low)

## Gaps & Open Questions

- [NEEDS CLARIFICATION: Live-test `rainfall?date=<today>T<HH:mm:ss>` and `?date=<today>`. Confirm a point-in-time query returns one reading, how big a page is, whether readings run oldest or newest first, and that the same works on `air-temperature` and the wind endpoints. Use the API key and run it once, outside the app's refresh.]
- [NEEDS CLARIFICATION: The actual update cadence of `air-temperature`, `wind-speed` and `wind-direction`: one minute, half a minute or five minutes? Compare `readings[0].timestamp` over a few calls.]
- [NEEDS CLARIFICATION: Carried from `problem.md`: should the view reuse readings from the last saved-location refresh (no amendment, but stale and one reading only) or fetch island-wide (needs a Principle I amendment)?]
- [NEEDS CLARIFICATION: Carried from `problem.md`: which app is being replaced, and how many users at launch? This decides whether a Production key (30 per 10 s) is needed before any island-wide layer ships.]
- [NEEDS CLARIFICATION: Carried from `problem.md`: should rain come first, ahead of temperature and wind? If so, a rain-only first version would cost 1 to 3 calls instead of 4 to 6.]
- [NEEDS CLARIFICATION: Does weather.gov.sg or myENV show station-level readings on a map? Not confirmed; checking it would sharpen how this differs from the competition.]
- [NEEDS CLARIFICATION: data.gov.sg licence terms for showing data publicly (attribution wording). Not fetched.]

## Sources

- `RealtimeWeatherReadingsacrossSingapore/{Rainfall,Air Temperature,Relative Humidity,Wind Speed,Wind Direction} across Singapore.json`: official data.gov.sg OpenAPI specs, v1.0.11, server `https://api-open.data.gov.sg/v2/real-time/api` (local file, read only, untracked)
- `~/.claude/skills/sg-weather-api/SKILL.md` and `references/endpoints.md` (local; verified live 2026-11-11)
- Repo: `backend/src/weather.ts`, `backend/src/lightning.ts`, `backend/src/providerHttp.ts`, `docs/architecture.md`, `.specify/memory/constitution.md`, `specs/002-lightning-map-layer/spec.md`, `.specify/assessments/{nea-data-new-features,vercel-container-hosting}/`, `.specify/assessments/station-reading-map-layers/problem.md`, git log
- Web search results (snippets only; no page fetched, so they are recorded as search results and not as verified reads):
  - https://data.gov.sg/datasets/d_6580738cdd7db79374ed3152159fbd69/view (host: data.gov.sg, policy: search snippet, not fetched)
  - https://data.gov.sg/datasets/d_66b77726bbae1b33f218db60ff5861f0/view (host: data.gov.sg, policy: search snippet, not fetched)
  - https://beta.data.gov.sg/collections/1459/view (host: beta.data.gov.sg, policy: search snippet, not fetched)
  - https://beta.data.gov.sg/datasets/d_72ef872af64a49bbf85c037e714267c0/view (host: beta.data.gov.sg, policy: search snippet, not fetched)
  - https://rdrr.io/cran/datagovsgR/man/weather_reading.html (host: rdrr.io, policy: search snippet, not fetched)
  - https://www.nea.gov.sg/docs/default-source/default-document-library/myenv---guide-to-using-the-features-in-the-app-%28updated-30-june-2023%29a70e161e5ca44828a5ebbdc6206182dc.pdf (host: www.nea.gov.sg, policy: search snippet, not fetched)
  - https://www.nea.gov.sg/myenv (host: www.nea.gov.sg, policy: search snippet, not fetched)
  - https://apps.apple.com/sg/app/myenv/id444435182 (host: apps.apple.com, policy: search snippet, not fetched)
  - https://apps.apple.com/fi/app/environment/id1569224845 (host: apps.apple.com, policy: search snippet, not fetched; locale query parameter dropped)
