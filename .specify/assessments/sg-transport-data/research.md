# Idea Research: New features from data.gov.sg transport data (Taxi Availability)

- **Slug**: sg-transport-data
- **Created**: 2026-11-18
- **Evidence confidence (overall)**: medium. Data facts are high: measured from one live call. User demand is low: nobody has asked for it, and no users have been measured.

## Users & Demand

- **Who the app is for:** public users on laptop and mobile. The owner intends Lepak to replace a mobile weather app. [source: memory `public-mobile-release`, 2026-11-16] (confidence: high that this is the intent; user count unknown)
- **Signal for transport features:** none observed. No PR, spec, assessment or research file mentions taxis or transport. A grep across `.specify/assessments/*/research.md` and `specs/*/spec.md` found nothing. [source: repo grep, 2026-11-18] (confidence: high)
- **Origin:** the idea comes from the owner browsing the data.gov.sg catalogue ("let research for new features … from transport data"). It's supply-led ("here is data, what could we build?") rather than driven by a user's problem. [source: intake.md] (confidence: high)
- **Possible user need:** "can I get a taxi here when it rains?" Finding a taxi during rain is a commonly reported Singapore experience. ASSUMPTION, not researched (confidence: low)
- **Stated vs observed:** there is no stated want from users and no observed behaviour (the app has no analytics on feature use beyond visit counts, spec 012). [source: docs/architecture.md, Vercel Web Analytics notice] (confidence: high)

## Prior Art

- **Internal, live island-wide map layers:** lightning (spec 002/007/009) and rain (spec 011) already run as layers fetched only on a user's action, outside the snapshot. They are cached for at least 2 minutes and degrade to "unavailable". [source: constitution Principle I exception; docs/architecture.md] (confidence: high)
- **Internal, dense point rendering:** lightning hit a performance wall. One marker per strike froze the page for 15 s at 37,242 strikes, which spec 009 fixed with `supercluster` grouping (`frontend/src/components/map/lightningGroups.ts`), keeping marks to a few hundred. A taxi layer of about 3,900 points would need the same approach. [source: docs/architecture.md "Lightning layer"; specs/009] (confidence: high)
- **Internal, data client:** `ProviderRequester` paces data.gov.sg calls (250 ms spacing, one 429 retry, 8 s timeout), and `SingaporeWeatherClient` is the weather client. The taxi endpoint is on the legacy host `api.data.gov.sg/v1`, not the `api-open.data.gov.sg/v2` the app uses. [source: sg-weather-api skill; CLAUDE.md] (confidence: high)
- **Internal, scope decisions:** earlier assessments (`nea-data-new-features`, `next-value-features`) kept the app to NEA weather data. Lightning spec 002 put alerts and distance-to-strike out of scope. Transport has never been in scope. [source: those assessments' research and decision files] (confidence: high)
- **External:** ride-hailing and taxi apps (Grab, Gojek, CDG Zig, TADA) show nearby cars and let you book, which a read-only map can't. ASSUMPTION, not researched (confidence: medium)

## Market & Context

- **What users do today:** they open a ride-hailing or taxi app, which shows nearby cars and books one. A weather app showing taxi dots can't book, and it covers street-hail taxis only, not private-hire cars. ASSUMPTION about what the feed covers (it's described as "available taxis" from LTA; whether private-hire cars are included is not stated) (confidence: medium)
- **Cost of doing nothing:** none to current users. The app's weather features are unaffected. ASSUMPTION (confidence: medium)
- **Product fit:** the product is "Lepak", a weather app. Transport data would widen what it's about. Whether that's wanted is the owner's call. [source: intake.md] (confidence: n/a)

## Data & Constraints

Measured from one keyless call to `GET https://api.data.gov.sg/v1/transport/taxi-availability` at 2026-11-18 21:19 SGT, a weekday evening:

| Measure | Value |
|---|---|
| HTTP | 200, `application/json`, 0.12 s |
| Payload | 83,888 bytes (uncompressed; no `content-encoding`) |
| Shape | 1 GeoJSON feature, `MultiPoint`, `[lon, lat]`, EPSG:4326 |
| Points | 3,912 (`taxi_count` 3,912) |
| Freshness | `timestamp` 5 s before the call |
| Extent | lat 1.245–1.463, lon 103.640–103.999 (all of Singapore) |
| Density, within 1 km | Raffles Place 98, Tampines 47, Jurong West 15 |
| Rate-limit headers | none returned |
| Status field | `properties.api_info.status: "healthy"` |

- **This is a single sample.** Point counts will vary by time of day and weather. There's no data from rain or peak hours. (confidence: high for this sample, low for typical values)
- **Constitution:** Principle I allows exactly two island-wide live layers (lightning, rain). "Any further exception requires its own amendment." A taxi layer is a third, so it needs a constitution amendment before anything is specified. [source: `.specify/memory/constitution.md` Principle I] (confidence: high)
- **Freshness vs cache rule:** the feed updates every 30 s and data.gov.sg recommends polling every minute. The constitution requires at least a 2-minute server cache and fetching only on a user's action, so taxi positions shown could be up to 2+ minutes old. Taxis move, so old dots may be misleading. [source: dataset page OpenAPI text, captured in intake.md; constitution] (confidence: high on the rules; the effect on usefulness is an ASSUMPTION)
- **Rate budget:** the v1 host returned no rate-limit headers. The v2 limits (6 per 10 s keyless, 12 per 10 s with a Dev key) may or may not apply to v1. One shared 2-minute cache would keep calls to at most about 30 an hour regardless of visitors. [source: sg-weather-api skill; measured headers] (confidence: medium)
- **Performance:** about 3,900 points is about 10% of the lightning storm case that needed grouping. Drawing them unclustered on a phone would likely stall, and with grouping it's within the existing pattern. [source: docs/architecture.md lightning numbers] (confidence: medium)
- **Payload to phones:** about 84 KB per refresh if sent raw. The server could compress it (the app uses `compression`), or reduce it to counts near saved places. Compressed size wasn't measured. [source: measured; `package.json` deps] (confidence: medium)
- **Privacy and licence:** the positions are anonymous points with no IDs. The licence and terms weren't captured (the dataset page shows a "Licence" section, but its value wasn't extracted). [NEEDS CLARIFICATION] (confidence: low)
- **Other transport datasets:** the topic page loads its list in the browser, so this research doesn't know what else is offered (for example carpark availability or traffic cameras). ASSUMPTION that such datasets exist on data.gov.sg (confidence: low)

## Evidence Against the Idea

- **No demand:** no user or owner problem has been stated. The idea starts from available data, not a need. [source: intake.md; repo grep]
- **Off-mission:** Lepak is a weather app. Every earlier assessment kept scope to NEA weather data, and transport widens the product without evidence that users want that from it. [source: prior assessments]
- **A better alternative exists:** ride-hailing and taxi apps already show nearby cars live and let users book, and they cover private-hire cars. ASSUMPTION (confidence: medium)
- **Staleness:** the constitution's 2-minute minimum cache and fetch-on-action rule clash with a feed whose value is being current (30 s updates). [source: constitution; dataset page]
- **Governance cost:** it needs a constitution amendment for a third live layer, plus the clustering, caching, "unavailable" handling, tests and e2e that the lightning and rain layers required. Specs 002, 007, 009 and 011 show how much work a live layer takes. [source: specs list, docs/architecture.md]
- **Legacy endpoint:** it's on `api.data.gov.sg/v1`, not the v2 host the app uses. v1 endpoints may be retired. ASSUMPTION (confidence: low)

## Gaps & Open Questions

- [NEEDS CLARIFICATION: What user problem would this solve? For example "taxi near my saved place when it rains", "how busy is my area", or none yet.]
- [NEEDS CLARIFICATION: Is widening Lepak beyond weather wanted? If so, is the owner willing to amend the constitution for a third live layer?]
- [NEEDS CLARIFICATION: Scope: taxis only, or survey the whole transport topic first (the dataset list wasn't visible)?]
- [NEEDS CLARIFICATION: Licence and terms of use for Taxi Availability, and whether v1 has a rate limit or a retirement date]
- [NEEDS CLARIFICATION: Does taxi supply actually drop when it rains? One sample at 21:19 can't say. It would need several samples across rain and no-rain hours.]
- [NEEDS CLARIFICATION: Does the feed include private-hire cars, or street-hail taxis only?]

## Sources

- https://data.gov.sg/datasets?topics=transport&resultId=d_e25662f1a062dd046453926aa284ba64 (host: data.gov.sg, policy: confirmed-by-user; fetched during intake)
- https://api.data.gov.sg/v1/transport/taxi-availability (host: api.data.gov.sg, policy: confirmed-by-user; one keyless call, pinned to checked public address 18.139.32.42, no redirects; payload deleted after measurement)
- Not fetched: https://api-open.data.gov.sg/v2/real-time/api/taxi-availability (host: api-open.data.gov.sg, policy: declined by user)
- Local: `.specify/memory/constitution.md`, `docs/architecture.md`, `specs/009-lightning-strike-grouping/spec.md`, `.specify/assessments/{nea-data-new-features,next-value-features}/`, sg-weather-api skill, memory `public-mobile-release` (host: local, policy: n/a)
