# Idea Research: Hourly UV trend and "safe sun hours"

- **Slug**: uv-hourly-trend
- **Created**: 2026-11-15
- **Evidence confidence (overall)**: medium. The data shape, the code paths and the display are high confidence (read from code and a stored live response). The "safe sun hours" thresholds rest on bands already in the code, not on a fetched health source. Demand is the owner's alone.

## Users & Demand

- The owner queued this as the next feature after WBGT: "Next: hourly UV trend (research Priority 5) as its own feature." — [source: `.specify/assessments/nea-data-new-features/decision.md`, Step 2 gate, 2026-11-14] (confidence: high)
- Spec 005 also names it as next ("the hourly UV trend (next feature, 006)"). The number 006 was later used for town search, so it has no spec yet. — [source: `specs/005-wbgt-heat-stress-tile/spec.md` lines 9, 116; `specs/006-town-name-search`] (confidence: high)
- No other user, issue or log asks for it; demand is the owner's stated want. — [source: grep of `specs/`, `.specify/assessments/`] (confidence: high)
- Original research rated it Effort Low–Medium, Value Medium ("actionable for outdoor planning"), both as researcher estimates. — [source: `.specify/assessments/nea-data-new-features/research.md`, Priority 5] (confidence: low; estimate, not evidence)

## Prior Art

- **The app already shows UV in two places**:
  - The **UV Index tile** shows the latest value, a band label (Low ≤2, Moderate ≤5, High ≤7, Very High ≤10, Extreme 11+), a 0–11 gauge and "Nationwide UVI reading from <time>". — [source: `frontend/src/components/Tiles.tsx` `uvLabel`, `UVTile`] (confidence: high)
  - The **hero summary** mentions UV only at High and above ("UV high"), with the comment "Low and Moderate change nobody's plans". — [source: `frontend/src/components/outdoorSummary.ts` `uvBand`, lines 25–30, 86–88] (confidence: high)
- The two band functions are written separately (`uvLabel` uses `<=` on whole numbers, `uvBand` uses `<` and starts at 6). Their boundaries agree for whole-number values. — [source: same files] (confidence: high)
- **The hourly strip is the 24-hour regional forecast** (`forecast_periods`), not hourly readings. It has no UV. — [source: `frontend/src/components/HourlyStrip.tsx`] (confidence: high)
- **Sun times (spec 004)** already compute sunrise and sunset per location. These are the natural bounds of any daylight UV view. — [source: `frontend/src/components/sunTimes.ts`; `specs/004-outdoor-comfort-tiles`] (confidence: high)
- The clothing copy from spec 004 already recommends a "UV umbrella in open sun" for the hotter feels-like bands. — [source: `frontend/src/components/feelsLike.ts` lines 45, 52] (confidence: high)

## Market & Context

- NEA's own channels publish the UV index. Common weather apps show an hourly UV forecast. That is ASSUMPTION from general knowledge; nothing was fetched. (confidence: medium)
- Cost of doing nothing: the tile keeps showing one number, the latest hour. Users can't see whether UV is rising or already falling. — [source: `backend/src/weather.ts` `fetchUvIndex` keeps `index[0]` only] (confidence: high)

## Data & Constraints

- **Endpoint shape**: `uv` returns `data.records[]`. Each record has `timestamp`, `updatedTimestamp` and `index: [{ hour, value }]`, newest hour first. It is one **nationwide** value with no location. — [source: `~/.claude/skills/sg-weather-api/references/endpoints.md` § uv; `UvPayload` in `backend/src/weather.ts` lines 76–89] (confidence: high)
- **The hourly list is observed values so far today, not a forecast.** A stored live response for 2026-10-01 shows the 19:00 record holding 07:00 → 19:00 readings (0, 0, 1, 3, 5, 7, 6, 7, 7, 4, 2, 1, 0). Each earlier record holds a shorter list ending at its own hour. No future hours appear. — [source: probe `uv?date=2026-10-01`, saved this session] (confidence: high)
- So **"safe sun hours" for the rest of today can't be read from this endpoint**. It can only report which past hours were at or below a threshold, or rely on an estimate of typical hours, for example from past days. — [inference from the line above] (confidence: high)
- **The current fetch already receives the full list** but stores only `index[0].value` as `uv_index` (plus its timestamp). Showing the trend needs no extra data.gov.sg call; it uses the same one call per refresh. — [source: `backend/src/weather.ts` lines 308, 354, 421–433] (confidence: high)
- **Snapshot shape**: `uv_index` is a single `real` column. The snapshot already has two JSON-list columns (`forecast_periods`, `daily_forecast`), so a list field follows an existing pattern. It needs a schema change and a generated Drizzle migration. — [source: `backend/src/schema.ts`; constitution Technical Constraints] (confidence: high)
- **Freshness**: a list stored at refresh time is frozen at that time. A morning refresh shows only the morning's hours until the next refresh. The app already labels stale snapshots. — [source: Principle I; `frontend/src/components/freshness.ts`] (confidence: high)
- **The data is nationwide, not per location**. The same list would be stored in every saved location's snapshot. The tile already says "Nationwide". — [source: endpoint shape; `UVTile` copy] (confidence: high)
- **History via the API**: the dated `uv` endpoint answered 200 for 2025-06-01 and 2026-10-01, and 404 for 2020-01-01. The exact start lies in between and was not bisected. One dated call returned a full day (13 records, no pagination token), so one past day costs about one request. — [source: probes this session, `.specify/assessments/ai-ml-historical-model/research.md`] (confidence: high)
- **Thresholds in use**: the UV index bands in the code (Low 0–2, Moderate 3–5, High 6–7, Very High 8–10, Extreme 11+) match the WHO and NEA scale as commonly published. Sun protection is usually advised from 3 (Moderate) up. — [code: high; WHO/NEA wording: ASSUMPTION, not fetched] (confidence: medium)
- **Constitution**: no extra call, so Principle I holds. Any band or "safe hours" logic worth testing must be pure `.ts` (Principle IV). Colours must come from the theme system; a `--scale-uv` token already exists per theme (Principle V). — [source: `.specify/memory/constitution.md`; `frontend/src/index.css` lines 60–75, 443–467] (confidence: high)

## Evidence Against the Idea

- **"Safe sun hours" as a forward-looking answer isn't supported by the data.** NEA's `uv` gives no forecast, so any "safe after 4 pm" claim for today would be an estimate, not an NEA reading. That cuts against the app's direction of being honest about readings (commit 0afde7f). — [source: probe above; git log] (confidence: high)
- **The daily curve is predictable.** UV in Singapore rises from 0 around 07:00, peaks around midday to 15:00, and falls to 0 by 19:00 (one sampled day). A trend chart may mostly show the same shape every clear day. That is ASSUMPTION from a single day's sample. (confidence: low)
- **Small marginal value over the existing tile and hero.** The hero already flags High and above, and the tile shows the current band. — [source: `outdoorSummary.ts`, `Tiles.tsx`] (confidence: medium)
- **Nationwide data stored per location** duplicates the same list across every location row. It is harmless at this scale but not location-specific value. — [source: endpoint shape] (confidence: high)

## Gaps & Open Questions

- [NEEDS CLARIFICATION: What should "safe sun hours" mean, given there's no forecast? (a) past hours today at or below a threshold, (b) typical safe hours for this month from past days, labelled as typical, or (c) drop the term and show only the trend so far.]
- [NEEDS CLARIFICATION: Which threshold counts as "safe": UV ≤ 2 (Low, no protection usually advised) or ≤ 5 (below the hero's High cut-off)? Confirm the wording against NEA's or WHO's published guidance before shipping.]
- [NEEDS CLARIFICATION: Where should the trend appear: inside the UV tile (a small sparkline), as its own panel, or in the hourly strip? The hourly strip currently holds regional forecast periods, a different kind of data.]
- [NEEDS CLARIFICATION: Should the trend span the full daylight window (sunrise to sunset from spec 004), with empty future hours, or only the hours observed?]
- [NEEDS CLARIFICATION: Exact first date of `uv` history via the API (between 2020-01-01 and 2025-06-01). This matters only if option (b) above is chosen.]

## Sources

- Stored live response `https://api-open.data.gov.sg/v2/real-time/api/uv?date=2026-10-01` and probes for 2025-06-01 and 2020-01-01 (host: api-open.data.gov.sg, policy: confirmed-by-user earlier this session for data.gov.sg hosts; no new fetch made for this research)
- Local: `~/.claude/skills/sg-weather-api/references/endpoints.md`; `backend/src/weather.ts`, `backend/src/schema.ts`; `frontend/src/components/{Tiles.tsx,outdoorSummary.ts,HourlyStrip.tsx,sunTimes.ts,feelsLike.ts,freshness.ts}`; `frontend/src/index.css`; `.specify/memory/constitution.md`; `.specify/assessments/nea-data-new-features/{research,decision}.md`; `specs/005-wbgt-heat-stress-tile/spec.md`; git log
