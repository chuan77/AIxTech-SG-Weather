# Idea Research: AI/ML features trained on data.gov.sg historical weather data

- **Slug**: ai-ml-historical-model
- **Created**: 2026-11-15
- **Evidence confidence (overall)**: medium. Data availability is high confidence: history depth was probed live against the API and the bulk collections' metadata on 2026-11-15. Demand is unobserved, beyond the owner's stated interest. Model value is unproven, and "beats NEA's own forecast" is an open question, not a finding.

## Candidate Features (ranked table)

Priority is a suggested order to consider, based only on the evidence below. It is not a decision. Effort and Value are researcher estimates (ASSUMPTION unless cited). "Model" means anything learned from history, from percentile tables to gradient-boosted trees; the word "pretrain" is discussed under Evidence Against.

| Priority | Feature | Effort | Value |
|---|---|---|---|
| 1 | **"Unusual for this time of year" context** on temperature, rainfall and PSI tiles: compare the current snapshot with a per-station, per-month/hour climatology (percentiles) built offline from 2016–2024 history and shipped as a small lookup file | Low–Medium. Offline aggregation of bulk CSVs; runtime is a pure-TS lookup with no new data.gov.sg calls | Medium. Turns raw numbers into "hotter than 90% of November afternoons"; no common weather app shows this for Singapore stations (ASSUMPTION) |
| 2 | **2-hour forecast reliability per area**: how often NEA's 2-hour "showers/thundery showers" forecast for an area matched observed rain at nearby stations, from 2016–2024 forecast and rainfall history | Medium. Needs the forecast-area-to-station join and an offline scoring script; runtime is a lookup | Medium. Honest context for the verdict-first hero ("rain forecasts here verify ~N% of the time"). It is also the required baseline for Priority 3 |
| 3 | **Local rain nowcast (next 30–120 min) for a saved location**, a model trained on 5-min station rainfall, the 2-hour forecast history and other station readings, run at refresh time | High. Data pipeline (about 1.2 GB/yr rainfall CSV), feature engineering, training, evaluation against NEA's forecast, model artefact served in Node | High *if* it beats NEA's 2-hour forecast for the user's spot; otherwise none. Unproven |
| 4 | **WBGT estimate where no station is within 10 km**, learned from temperature, humidity, wind and UV | Medium–High. WBGT history via the API reaches back only to a date between 2024-06 and 2026-10 (exact start not found); no bulk collection was found | Medium. Extends the heat-stress tile (spec 005) to uncovered locations; a medically sensitive number estimated by a model |

**Removed by the owner (2026-11-15) as low value**, kept here only as a record: null-reading imputation from neighbouring stations (Low–Medium), next-24 h PSI/haze outlook (Low–Medium), LLM plain-language daily brief (Low–Medium), and a pretrained Singapore weather foundation model (Low; see Evidence Against).

## Priority 1 in Detail: How the Offline Lookup Would Work

Added 2026-11-15 at the owner's request. This is a description of the mechanism, to make the candidate concrete. It is not a chosen design, and the figures are researcher estimates (ASSUMPTION) unless cited.

**1. Build the table offline (once, at most yearly re-run)**
- Download the 2016–2024 yearly CSVs: rainfall (collection 2279), air temperature (2246) and PM2.5 (2216). PSI has no bulk collection found, so it would come by region from the dated API (history back to 2016-12-01, probed). — [source: Data & Constraints below]
- A script outside the running app groups every reading by **station × month × hour of day**. A group such as "Changi, November, 15:00" holds about 9 years × ~30 days of readings.
- For each group it records the spread: 10th, 50th, 90th and 95th percentiles, plus the reading count.
- **Rainfall is handled differently**, since most hours are dry. Per group it records **how often it rained** and, for wet hours, how heavy the rain was.

**2. Ship only the result**
- The output is a small JSON file committed to the repo. For temperature that is about 17 stations × 12 months × 24 hours × 5 numbers, roughly 25,000 numbers: a few hundred KB at most, less if hours are grouped into bands. (ASSUMPTION; station count from the probe)
- The raw CSVs (about 1.2 GB per year for rainfall) stay on disk, git-ignored, outside the repo. Nothing model-related runs at request time. — [source: dataset metadata; `CLAUDE.md` rule on not committing dumps]

**3. Use it in the app**
- Fetching doesn't change. At refresh the snapshot already holds the value, the observation time and the location.
- A pure TypeScript function takes (value, station, time), finds the group and returns a band. Illustrative outputs (not computed from data):
  - 32.4 °C at 15:00 in November near Changi, above that group's 95th percentile → "Unusually hot for a November afternoon".
  - Rain now, where about 1 in 10 of that hour's November readings is wet → "Rain is uncommon here at this hour".
  - A value between the 10th and 90th percentiles → typical, so no label or a quiet "typical" note.
- The tile shows a short line or chip. When a group has too few readings, the tile shows no label rather than a guess.

**Fit with the constitution**: no new data.gov.sg calls and no stored history (Principle I); runs in Node (Principle II); the lookup is a pure function, testable with fixed inputs (Principles III–IV). Whether committing an offline-built artefact needs an amendment is still open (see Gaps). — [source: `.specify/memory/constitution.md`]

**Limits specific to this candidate**
- **The baseline is short.** 8–9 years is short for "normal"; official climate normals use 30 years. A warming trend also makes recent years read as "unusual" more often. — [ASSUMPTION; 30-year convention is general knowledge, not fetched] (confidence: medium)
- **The data isn't quality-checked.** The build script must drop broken sensor values and outliers. — [source: collection 2279 disclaimer] (confidence: high)
- **Haze years skew PSI.** Rare haze episodes (for example 2019) push the PSI groups up, so PSI may need trimmed years or a fixed scale instead of percentiles. — [ASSUMPTION] (confidence: medium)
- **The snapshot doesn't store which temperature or rainfall station it used**; only the WBGT station is saved. The station must be stored too, or worked out from the location's coordinates. — [source: `backend/src/schema.ts`] (confidence: high)

## Users & Demand

- The only signal is the owner's request to research AI/ML features (this session, 2026-11-15). No issue, spec or log asks for a prediction or AI feature. — [source: user input; grep of `specs/`, `.specify/assessments/`] (confidence: high that no other signal is recorded)
- An earlier assessment put "LLM output" explicitly out of scope for the outdoor-conditions tiles. — [source: `.specify/assessments/nea-data-new-features/decision.md`, In scope / out of scope] (confidence: high)
- The dashboard is for personal use with a Development API key, so value is judged by one user. — [source: `.specify/assessments/nea-data-new-features/decision.md`, Step 2 gate] (confidence: high)
- That a user wants "rain in the next hour at my spot" more than NEA's area forecast is plausible but unsourced. — [ASSUMPTION] (confidence: low)

## Prior Art

- **Internal: no ML exists.** The app computes deterministic derivations only: Steadman feels-like, sun times and WBGT nearest-station (specs 004, 005). — [source: `specs/004-outdoor-comfort-tiles`, `specs/005-wbgt-heat-stress-tile`, `backend/src/schema.ts`] (confidence: high)
- **Internal: the snapshot pattern** holds one current snapshot per location in the `locations` table, with no history table. Any model input history must therefore come from outside the app's database. — [source: `backend/src/schema.ts`; constitution Principle I] (confidence: high)
- **Internal: a Python gate is wired up.** `npm run verify` calls `scripts/verify-python.sh` for lint, types and tests, so an offline Python training script would already be checked. — [source: `package.json` `verify` script] (confidence: high)
- **Upstream: NEA already publishes a 2-hour area forecast**, which is the baseline any nowcast must beat. Its history (2016-03-14 to 2024-12-31) is downloadable, so it can be scored. — [source: data.gov.sg collection 2179 metadata, fetched 2026-11-15] (confidence: high)
- **External ML weather models** (for example Google's MetNet nowcasting and DeepMind's GraphCast) exist but use radar, satellite and reanalysis data, not station data alone. — [ASSUMPTION; general knowledge, no source fetched: the owner limited fetching to data.gov.sg] (confidence: medium)

## Market & Context

- NEA's own channels (weather.gov.sg, app) already give forecasts and warnings; the app's niche is clean per-location snapshots. — [source: `.specify/assessments/nea-data-new-features/research.md`, Market & Context (itself ASSUMPTION)] (confidence: low)
- Official quality-controlled climate records are sold by NEA (fees may apply); the free data.gov.sg history is explicitly not quality-controlled. — [source: data.gov.sg collection 2279 description; web search summary of NEA climate-data page] (confidence: medium)
- Cost of doing nothing: none observed. The dashboard works without ML. — [ASSUMPTION] (confidence: medium)

## Data & Constraints

**Bulk historical collections (data.gov.sg, CSV, yearly datasets)** — [source: collection metadata API, fetched 2026-11-15] (confidence: high)

| Collection | Coverage | Notes |
|---|---|---|
| Historical Rainfall across Singapore (2279) | 2016-12-02 → 2024-12-31 | 9 yearly datasets; 2024 file is ~1.22 GB; columns `timestamp, station_id, station_name, location_latitude/longitude, reading_value`; "may contain missing records and has not undergone quality control" |
| Historical Air Temperature (2246) | 2016-04-15 → 2024-12-31 | 9 yearly datasets, station-level |
| Historical 2-hour Weather Forecast (2179) | 2016-03-14 → 2024-12-31 | 9 yearly datasets, per forecast area |
| Historical PM2.5 (2216) | 2016-02-10 → 2024-12-31 | 9 yearly datasets |
| Historical Daily Weather Records (d_03bb…7066) | 2009-01-01 → 2017-11-30 | 160 KB; daily rainfall, 30/60/120-min max rainfall, mean/max/min temperature, mean/max wind |
| Rainfall – Monthly Total (1399) | 1982-01 → 2023-07 | Changi only |

- Not found as bulk collections: historical humidity, wind, UV, WBGT, lightning, PSI. A "Historical Wind" collection didn't appear in search. — [source: web search 2026-11-15] (confidence: medium; may exist under another title)

**Real-time API `date` parameter (probed live 2026-11-15, keyless)** — [source: `api-open.data.gov.sg/v2/real-time/api`] (confidence: high)

| Endpoint | Earliest date answered 200 | 404 "Data not found" at |
|---|---|---|
| rainfall | 2017-06-01 | 2016-12-01 |
| air-temperature, relative-humidity | 2016-12-01 (but only 1 reading that day) | — |
| wind-speed, wind-direction | 2020-01-01 | 2016-12-01 |
| psi | 2016-12-01 | — |
| pm25 | 2020-01-01 (not probed earlier) | — |
| two-hr-forecast, twenty-four-hr-forecast | 2025-06-01 | 2020-01-01 |
| uv | 2025-06-01 | 2020-01-01 |
| four-day-outlook, wbgt, lightning | 2026-10-01 | four-day 2020-01-01; wbgt and lightning 2024-06-01 |

- The skill's note that `date` is "unverified beyond pm25" is now superseded for the endpoints above. — [source: `~/.claude/skills/sg-weather-api/SKILL.md` line 16; probe above] (confidence: high)
- **Pagination cost**: responses page 25 readings at a time. One day of 5-min rainfall took **12 pages** (counted, 2024-06-01). 1-min air temperature implies ~58 pages/day (25 readings span 24 minutes on 2020-01-01). One year via the API is therefore ~4,400 rainfall requests and ~21,000 temperature requests. — [source: probe] (confidence: high for rainfall; medium for the temperature estimate)
- **Rate limits**: real-time API 6 / 12 / 30 requests per 10 s (keyless / Dev / Prod). The dataset download API is documented at 5 requests per minute. Enforcement started by 2025-12-31. So backfilling via the real-time API is hours per year per variable with the Dev key, and the bulk CSVs are the practical source for 2016–2024. The API is needed only for 2025 onward. — [source: sg-weather-api skill; guide.data.gov.sg rate-limit pages (search summary)] (confidence: medium; the guide's numbers may be out of date)
- **Station counts change over time**: 51 rainfall stations in 2020 versus 62 in 2024, and 17 temperature stations. Models must handle stations appearing or disappearing. — [source: probe] (confidence: high)
- **Licence**: Singapore Open Data Licence, free for personal or commercial use. — [source: web search summary of data.gov.sg dataset pages] (confidence: medium; not read from the licence text)

**Constitution constraints** — [source: `.specify/memory/constitution.md`] (confidence: high)
- Principle I: no data.gov.sg calls on page load; only one exception (lightning). Storing history in SQLite, or a background backfill job, would need an amendment. Offline training outside the running app, with only a small artefact (lookup or model file) shipped, may not need one; that is to be confirmed at decide.
- Principle II: one Node process. Python inference at runtime would add a second process. Inference must run in Node, either as pure TS for lookups and linear or tree models, or through an ONNX runtime.
- Principle III and IV: model inference must sit behind an injectable interface and be testable offline with fixed inputs. Frontend logic worth testing must be pure `.ts`.

## Evidence Against the Idea

- **"Pretraining" doesn't fit the data.** About 60 stations × 5 variables × 8 years of 1–5-minute readings is tens of GB of raw CSV but a small, low-dimensional signal. That suits classic models (climatology, logistic regression, gradient boosting), not a pretrained foundation model, which also needs GPU training the project doesn't have. — [source: collection sizes above; compute part is ASSUMPTION] (confidence: medium)
- **The upstream baseline is strong.** NEA's 2-hour forecast is made with radar and satellite data the app can't get from data.gov.sg. A station-only nowcast may not beat it. Priority 2 would measure that before any Priority 3 effort. — [ASSUMPTION about NEA's inputs] (confidence: medium)
- **The data isn't quality-controlled** and has missing records. That limits model trust and needs cleaning effort. — [source: collection 2279 disclaimer] (confidence: high)
- **Gaps in history**: no bulk history for humidity, wind, UV, WBGT or lightning, and the API's forecast and UV history starts only between 2020 and 2025. Lightning and WBGT history starts somewhere between 2024-06 and 2026-10. Models needing those inputs have short training windows. — [source: probes] (confidence: high)
- **Size and cost**: ~1.2 GB per year of rainfall alone. The download API allows 5 requests per minute, and the repo must not commit raw dumps. — [source: dataset metadata; `CLAUDE.md`] (confidence: high)
- **Snapshot design**: the app keeps no history, so it can't evaluate or retrain models from its own data without a Principle I amendment. — [source: constitution] (confidence: high)
- **Health-adjacent outputs**: estimating WBGT (Priority 4) risks showing a guess as an official reading, against the project's "honest about stale readings" direction (commit 0afde7f). — [source: git log] (confidence: medium)
- **Demand is one person**, and no target user outcome has been stated. — [source: user input] (confidence: high)

## Gaps & Open Questions

- [NEEDS CLARIFICATION: What outcome should the AI/ML feature serve: "will it rain at my spot soon", "is today unusual", or "learning ML on real data"? This decides between Priorities 1, 2 and 3.]
- [NEEDS CLARIFICATION: Is offline training (a script outside the app, shipping only an artefact) acceptable under Principle I, or does it need an amendment? Is a Python training pipeline in the repo welcome, given `scripts/verify-python.sh`?]
- [NEEDS CLARIFICATION: Exact first available date for wbgt, lightning, two-hr-forecast and uv via the API (bisection not done). Do historical humidity and wind bulk collections exist under other titles?]
- [NEEDS CLARIFICATION: Where would 1+ GB/yr raw CSVs live locally (git-ignored), and how much disk and training time is acceptable?]
- [NEEDS CLARIFICATION: For any nowcast, what skill over NEA's 2-hour forecast counts as worth shipping (for example, a Brier-score improvement threshold)?]
- [NEEDS CLARIFICATION: For Priority 1, should the comparison be by station × month × hour, or coarser (for example, month × part of day), to keep groups large? How few readings in a group is too few to show a label?]
- [NEEDS CLARIFICATION: For Priority 1 PSI, use percentiles, or keep NEA's fixed PSI bands and add only "higher than usual for this month"?]
- [NEEDS CLARIFICATION: Read the Singapore Open Data Licence text directly to confirm that redistributing derived artefacts (climatology tables, model weights) is allowed.]

## Sources

- `https://api-open.data.gov.sg/v2/real-time/api/<endpoint>?date=…` (host: api-open.data.gov.sg, policy: confirmed-by-user; peer 104.20.45.103 / 172.66.149.179, public Cloudflare addresses). Keyless probes of 25 endpoint/date pairs plus 11 pagination calls, 2026-11-15
- `https://api-production.data.gov.sg/v2/public/api/collections/{1399,1459,2179,2216,2246,2279}/metadata` (host: api-production.data.gov.sg, policy: confirmed-by-user)
- `https://api-production.data.gov.sg/v2/public/api/datasets/{d_79a6…ed0fa6, d_a0b6…83507, d_03bb…7066}/metadata` (host: api-production.data.gov.sg, policy: confirmed-by-user)
- Web search results (titles and summaries only, pages not opened): https://data.gov.sg/dataset/historical-daily-weather, https://data.gov.sg/collections/2279/view, https://data.gov.sg/collections/2179/view, https://data.gov.sg/collections/2246/view, https://guide.data.gov.sg/developer-guide/dataset-apis/download-dataset, https://guide.data.gov.sg/developer-guide/api-overview/api-rate-limits, https://www.nea.gov.sg/corporate-functions/weather/overview/singapore's-climate-information-data (host: nea.gov.sg, search summary only, not fetched)
- Local: `~/.claude/skills/sg-weather-api/SKILL.md`, `.specify/memory/constitution.md`, `backend/src/schema.ts`, `package.json`, `.specify/assessments/nea-data-new-features/{research,decision}.md`, `CLAUDE.md`, git log
