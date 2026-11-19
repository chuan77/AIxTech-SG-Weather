# Idea Research: Temperature and wind station readings on the map (station layers, step 2)

- **Slug**: temp-wind-map-layers
- **Created**: 2026-11-19
- **Evidence confidence (overall)**: medium. The data facts are high: one live check on 2026-11-19 (station counts, update cadence, response shape and size) plus repo code and earlier decisions. Demand is low to medium: the owner says they use the rain view, but nobody has asked for temperature or wind on a map, and the value of 17 points is untested.
- **Inputs**: no `intake.md` (this is the gated step 2 of `station-reading-map-layers`, so research ran straight from the owner's request). Read: `.specify/assessments/station-reading-map-layers/{research,decision}.md`, `.specify/assessments/next-value-features/research.md`, `specs/011-island-rain-view/{spec,research}.md`, `.specify/memory/constitution.md`, `docs/architecture.md`, `backend/src/{weather,rain}.ts`, the `sg-weather-api` skill's `endpoints.md`, and the live check below. No web pages were fetched or searched this session.

## Users & Demand

- **The step 2 gate's condition is met, on the owner's word.** The step 1 decision said temperature and wind go ahead "only after step 1 ships and the owner judges it useful". On 2026-11-19 the owner said they use the rain view. — [source: owner answer in this session; `station-reading-map-layers/decision.md` "Verdict & Rationale"] (confidence: medium; stated by one person, two days after rain shipped)
- No issue, ticket or user has asked for temperature or wind on a map. The idea comes from step 1's original scope (research Priority 4 in `nea-data-new-features`), where it was listed because the data exists. — [source: `nea-data-new-features/research.md`; `next-value-features/research.md` "Demand is still unobserved for every candidate"] (confidence: high that no request is recorded)
- `next-value-features` ranked this Priority 3 with Low–Medium effort and Medium value, behind per-visitor places (013, shipped) and the installable app (014, shipped). It is now the highest-ranked item not yet built. — [source: `next-value-features/research.md` ranked table; git log `723b282`, `ca6e378`] (confidence: high for the ranking; the value is a researcher estimate)
- Web Analytics (spec 012) counts visits but not layer use, so whether anyone else turns on the rain layer is not measurable today. — [source: `docs/architecture.md` visitor counting; ASSUMPTION that no layer event is tracked, not checked in the analytics dashboard] (confidence: medium)
- Users ask "how hot is it across the island?" or "which way is the wind blowing?" less often than "where is it raining?". — [ASSUMPTION, carried from step 1 research; nothing ranks them] (confidence: low)

## Prior Art

- **Rain view (spec 011), the direct template.** `POST /api/rain/refresh` is called only on a user action. It makes one `?date=` request, caches one observation for 2 minutes shared by all callers, serves a stale copy on failure and otherwise returns 502. Nothing is stored. The card map has one Layers menu with one combined status strip (`MapLayersControl.tsx`), and the full-screen map stacks status strips. Rain and lightning calls take `priority: 'high'` in the shared `ProviderRequester`. — [source: `docs/architecture.md` "Rain exception"] (confidence: high)
- **The step 1 mock-up review led to layout rules that step 2 inherits:** a single Layers control on the card, one shared status strip, the heavy symbol strongest in every theme, and readable at 375 px. A third and fourth layer add more switches to that menu and more strips to the full-screen stack. — [source: `station-reading-map-layers/decision.md` Gate 2; `specs/011-island-rain-view/spec.md` Clarifications] (confidence: high)
- **The same readings are already fetched for each saved place and mostly thrown away.** `fetchNearestReading` downloads every station's latest `air-temperature`, `wind-speed` and `wind-direction` on each location refresh and keeps only the nearest station's value. — [source: `backend/src/weather.ts:289-310`, `:391-424`] (confidence: high)
- **Precedent for a distance cut-off:** the WBGT tile shows "No nearby station" beyond 10 km, which the owner chose because a far station is not meaningful. The same question applies when 17 temperature points are spread across the island. — [source: `nea-data-new-features/decision.md` Step 2 gate; `docs/architecture.md` Heat Stress tile] (confidence: high)
- **External:** myENV shows a rain overlay; App Store reviews (search snippets, 2026-11-16) said wind readings need a saved location first. Whether myENV or weather.gov.sg shows island-wide temperature or wind on a map is still unconfirmed. — [source: step 1 `research.md` Prior Art, snippets only] (confidence: low)

## Market & Context

- What users do today: check temperature and wind for one place in a weather app, or in this app's tiles for each saved place. An island-wide view adds comparison between places, for example the hotter west versus the coast, or wind direction before a run or a ride. — [ASSUMPTION] (confidence: low)
- **Cost of doing nothing:** nothing breaks, no rate budget is spent and no constitution change is needed. The per-place tiles already show temperature, wind and "feels like" for every saved place. — [source: `docs/architecture.md` Frontend; constitution §I] (confidence: high)
- The current shortlist has no smaller candidate. The next options ("Rain near this place now", climatology context) are medium effort or need assessments from scratch. — [source: `next-value-features/research.md`] (confidence: medium)

## Data & Constraints

### Live check (2026-11-19, 08:47 SGT, no API key, 6 requests about 2 s apart, outside the app; raw replies kept only in the session scratchpad)

| Request | Result |
|---|---|
| `air-temperature` (latest) | 200, 2.7 KB, 1 reading at 08:43, **17 stations**, 17 values |
| `air-temperature?date=2026-11-19` | 200, 17 KB, **25 readings, one per minute, newest first** (08:45 → 08:21), `paginationToken` present |
| `wind-speed` (latest) | 200, 2.6 KB, 1 reading at 08:44, 17 stations |
| `wind-speed?date=2026-11-19` | 200, 17 KB, 25 one-minute readings, newest first |
| `wind-direction` (latest) | 200, 2.6 KB, 1 reading at 08:44, 17 stations |
| `wind-direction?date=2026-11-19` | 200, 17 KB, 25 one-minute readings, newest first |

Findings (confidence: high for this sample; one morning, one check):

1. **OQ7 is answered: temperature and wind update every minute.** That settles the disagreement in step 1 research (1, 0.5 or 5 minutes). The reading types confirm it: `DBT 1M F` for temperature, and `Wind Speed AVG(S)10M M1M` and `Wind Dir AVG (S) 10M M1M` for wind, which are 10-minute averages published every minute.
2. **The "latest" call already returns a complete reading.** As with rain, the newest minute fills in gradually (temperature 08:45 had 6 of 17 rows and 08:44 had 15; wind 08:45 had 11). The plain latest call skipped those and returned the newest complete minute, about 3–4 minutes old. So one latest call per reading is enough, with no window or paging. That is simpler than rain's 15-minute sum.
3. **There are only 17 stations, compared with about 87 for rain.**
   - Temperature and wind share 15 sites. Temperature alone has Sembawang (S80) and Changi (S24). Wind alone has Marina Barrage (S108) and S199, which has no name in the feed.
   - Wind speed and wind direction use the same 17 stations, so they can be drawn as one arrow per station.
   - Several stations are offshore or on the edge: Semakau Island, Jurong Island, Pulau Ubin, Sentosa and Tuas.
   - The median distance from a station to its nearest neighbour is 5.7 km (range 1.7–9.6 km), computed locally from station coordinates.
4. **Values vary enough to show.** At 08:45 temperatures ranged from 26.1 to 28.3 °C (2.2 °C across 17 stations). Wind ranged from 1.2 to 3.7 knots, with directions from 5° to 351°. This is one calm morning; afternoon and storm spreads were not seen.
5. Station objects carry `location`, as for rain. Values are numbers, but temperature mixes integers and decimals, so the parser must coerce with `Number()` (the same lesson as rain, T058).
6. Units: temperature `deg C`, wind speed `knots`, wind direction `degrees`. The snapshot stores `wind_speed_knots`, and `feelsLike.ts` converts knots to m/s for its formula. — [source: `endpoints.md` Units; `frontend/src/types.ts:42`; `frontend/src/components/feelsLike.ts:73`]

### Rate budget and timing

- One island-wide temperature and wind fetch is **3 requests**: temperature, wind speed and wind direction, latest only. Through the shared `ProviderRequester` that is about 1.8 s of spacing with the Development key (884 ms between starts) or about 3.4 s without one, plus provider latency. With rain also on, a combined refresh would be 4–5 requests. — [source: `docs/architecture.md` pacing figures; live finding 2] (confidence: high for the arithmetic)
- A 2-minute shared cache (the constitution's minimum) would hide at most one or two one-minute updates, and the readings are 10-minute averages anyway. Freshness is not a constraint. — [inference from finding 1] (confidence: medium)
- Rain and lightning take `priority: 'high'` ahead of location refreshes, and a third high-priority layer would compete with them in the same queue. With fewer than 5 users the Development key was judged sufficient. — [source: `docs/architecture.md`; `station-reading-map-layers/decision.md` OQ1] (confidence: high for the design; contention is an inference)

### Rules that apply

- **A constitution amendment is required.** Principle I now permits exactly two island-wide layers, lightning and rain, and says "Any further exception requires its own amendment". Temperature and wind (one endpoint, or two) would be the third. The owner accepted the rain amendment "on the same terms as lightning". Whether they accept a third is unasked. — [source: `.specify/memory/constitution.md` §I] (confidence: high)
- A cheaper route needs no amendment, but it is limited: the readings are already downloaded on each location refresh, so the 17 values could be kept with the snapshot. That would breach "MUST NOT be stored … in any location's `WeatherSnapshot`" only if it were treated as island-wide data, and the values would be as old as the last refresh. This is recorded as a constraint, not a design. — [source: constitution §I; `weather.ts:391-424`] (confidence: medium on how the rule would be read)
- New colours (for example a temperature scale) must use theme tokens. Logic worth testing goes in pure `.ts` modules. Map output must be readable at 375 px on every theme. — [source: constitution; `docs/theming.md`; spec 011 success criteria] (confidence: high)
- Licence and attribution wording for showing NEA data publicly is still unchecked (step 1 OQ8). The flood-alerts intake found data.gov.sg datasets under the "Open Data Licence … free for personal or commercial use". — [source: `flood-alerts/intake.md`; not verified for these datasets] (confidence: low–medium)

## Evidence Against the Idea

- **17 points is sparse.** Rain had about 87 stations, and temperature and wind have a fifth of that. Several are offshore, so a map of 17 numbers may look thin and say little about a particular neighbourhood. The WBGT 10 km cut-off shows the owner already judged far stations to be not meaningful. — [source: live finding 3; WBGT decision]
- **Low variation on most days.** A 2.2 °C spread on a calm morning may not justify a layer, and the per-place tiles already show temperature, wind and "feels like". — [source: live finding 4; ASSUMPTION that it is typical]
- **Demand is one owner using the rain view for two days.** That meets the gate as worded, but it is evidence for rain, not for temperature or wind. — [source: owner answer]
- **It adds a third constitution exception and more crowding.** The Layers menu and status strips were designed for two layers at 375 px, and each new layer adds a switch, a strip and a legend. — [source: constitution §I; step 1 Gate 2]
- **It competes for the same rate budget.** Three more high-priority calls share one Development key with rain, lightning and location refreshes. — [source: `docs/architecture.md`]

## Gaps & Open Questions

- [NEEDS CLARIFICATION: Will the owner accept a third Principle I exception for temperature and wind, on the same terms as lightning and rain?]
- [NEEDS CLARIFICATION: Temperature and wind together as one layer, or separately? Or wind only, since an arrow per station may say more than a 2 °C spread of numbers?]
- [NEEDS CLARIFICATION: Are 17 points (median gap 5.7 km, some offshore) worth drawing? A mock-up check like step 1's Gate 2 would settle it.]
- [NEEDS CLARIFICATION: Is the station count stable? This was one sample. Check again at another time of day (also station S199, which has no name).]
- [NEEDS CLARIFICATION: How large is the temperature spread on a hot afternoon, and how much does the wind change in a storm? The value depends on it; only one calm morning was observed.]
- [NEEDS CLARIFICATION: Carried from step 1, OQ8: the licence and attribution wording for showing NEA data publicly.]
- [NEEDS CLARIFICATION: Carried from step 1: does myENV or weather.gov.sg show island-wide temperature or wind on a map?]

## Sources

- Live API check, 2026-11-19 08:47 SGT, approved by the owner in this session (host `api-open.data.gov.sg`, policy: confirmed-by-user; connected address 172.66.149.179, public; no redirects followed; no key sent):
  - https://api-open.data.gov.sg/v2/real-time/api/air-temperature
  - https://api-open.data.gov.sg/v2/real-time/api/air-temperature?date=2026-11-19
  - https://api-open.data.gov.sg/v2/real-time/api/wind-speed
  - https://api-open.data.gov.sg/v2/real-time/api/wind-speed?date=2026-11-19
  - https://api-open.data.gov.sg/v2/real-time/api/wind-direction
  - https://api-open.data.gov.sg/v2/real-time/api/wind-direction?date=2026-11-19
- Repo: `backend/src/weather.ts`, `backend/src/rain.ts`, `docs/architecture.md`, `.specify/memory/constitution.md`, `specs/011-island-rain-view/{spec,research}.md`, `.specify/assessments/{station-reading-map-layers,next-value-features,nea-data-new-features,flood-alerts}/`, git log
- `~/.claude/skills/sg-weather-api/references/endpoints.md` (local)
- External myENV references are carried from `station-reading-map-layers/research.md` (search snippets, 2026-11-16) and were not fetched again.
