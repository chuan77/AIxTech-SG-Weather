# Idea Research: Search by place name in "Add Location"

- **Slug**: location-name-search
- **Created**: 2026-11-14
- **Evidence confidence (overall)**: medium. Feasibility and prior art are well supported. Demand is weak. External geocoder terms are unverified.

Idea (from user input, intake.md absent): in the add-location form, let the user type a place name such as "Woodlands" or "Sembawang". The app finds the place and fills in latitude and longitude.

## Users & Demand

- The only way to add a location today is typing latitude and longitude into two number inputs (placeholders `1.3508` / `103.8390`). — [source: `frontend/src/components/AddLocationForm.tsx`] (confidence: high, cited)
- The main empty-state prompt asks the user to "Add a Singapore coordinate". Users are assumed to know coordinates. — [source: `frontend/src/components/Hero.tsx:20`] (confidence: high, cited)
- The same friction was already accepted as real but low-severity in the "use my location" assessment. — [source: `.specify/assessments/use-my-location/decision.md`, Scorecard] (confidence: high, cited)
- The only demand signal is the owner's stated want in this request, plus the README roadmap item (see Prior Art). There are no support tickets, usage data or other users on record. — [source: this request; repo search] (confidence: high that no other evidence exists)
- Most people know Singapore by town or estate name (Woodlands, Sembawang), not by coordinates. A name search likely helps more people than "use my location", because it works for places other than where the user is now. — [ASSUMPTION] (confidence: medium)

## Prior Art

- **Internal, README roadmap item 3, "Singapore area picker"**: "Replace the manual lat/lon inputs with a searchable dropdown. The 2-hour forecast response includes `area_metadata` with area names and coordinates." The roadmap suggests exposing forecast areas from the backend if the frontend can't reach them. — [source: `README.md` ~L218-226] (confidence: high, cited). This is almost exactly the idea, using a local list and no geocoder.
- **Internal, `area_metadata` is already fetched.** The 2-hour forecast parser reads `area_metadata[].name` and `label_location` for about 47 areas. `nearestAreaName` uses them to label each snapshot. They are not stored as a list and no endpoint exposes them. — [source: `backend/src/weather.ts` ~L600-625, ~L729-745; `~/.claude/skills/sg-weather-api/references/endpoints.md` ("about 47 areas", verified live 2026-11-11)] (confidence: high, cited)
- **Internal, both example names are NEA forecast areas.** "Woodlands" and "Sembawang" are in the two-hour forecast area list. — [ASSUMPTION from recall of the NEA area list; not checked against a live response in this session] (confidence: medium-high)
- **Internal, related feature "use my location"**: decided **go** on 2026-11-12 (Option B), with spec `specs/003-use-my-location/spec.md`. No `geolocation` code exists in `frontend/src` yet, so it is specified but not built. Both features change the same form. — [source: `.specify/assessments/use-my-location/decision.md`; `grep geolocation frontend/src` empty] (confidence: high, cited)
- **Internal, decisions carried over from that assessment**: coarse Singapore bounds (lat 1.1–1.5, lon 103.6–104.1) are enforced server-side. A simple duplicate rule was accepted. Do not log precise coordinates for geolocation-created locations. — [source: same decision.md; `backend/src/routes/locations.ts:49-51`] (confidence: high, cited)
- **External, OneMap (Singapore Land Authority) Search API**: `GET https://www.onemap.gov.sg/api/common/elastic/search?searchVal=…&returnGeom=Y&getAddrDetails=Y`. It returns matching buildings, roads and postal codes with lat/lon. Third-party sources disagree on whether search needs a token. Other endpoints need a bearer token from a free account, which expires after about 3 days. — [source: web search results only: sheshbabu.com, rdrr.io/cran/onemapsgapi, jentic.com; not fetched] (confidence: medium on endpoint shape, low on auth)
- **External, OSM Nominatim (public instance)**: absolute maximum of 1 request/s per application, counting all of its users. A custom identifying User-Agent is required. A community wiki says autocomplete is forbidden on the public instance; this was not confirmed in the official policy. — [source: web search results: wiki.openstreetmap.org/wiki/Nominatim, help.openstreetmap.org, moltchat wiki; not fetched] (confidence: medium on rate limit, low on autocomplete ban)
- **External, common pattern**: weather apps usually add locations through a city or place-name search box, not coordinates. — [ASSUMPTION; no comparison done] (confidence: medium)

## Market & Context

- **How users cope today**: find coordinates elsewhere (Google Maps right-click, OneMap), then copy them into two fields. — [ASSUMPTION] (confidence: medium)
- **Cost of doing nothing**: friction only. Nothing breaks and no data is wrong. The same situation was judged low-severity for "use my location". — [source: `.specify/assessments/use-my-location/problem.md`, "Cost of inaction"] (confidence: high, cited)
- **Two different search scopes are possible** (evidence only, not a design):
  - *Forecast-area names* (about 47, from data the app already gets). Matches the app's real precision, since each location is labelled and forecast by its nearest area anyway.
  - *Any place, address or postal code* (needs an external geocoder such as OneMap). Finer-grained, but the 2-hour forecast still resolves to one of the ~47 areas. Station readings (nearest of ~30 stations) and region forecasts do gain from a precise point. — [source: `backend/src/weather.ts` nearest-area/station/region matching; `specs/005-wbgt-heat-stress-tile/research.md` station distances] (confidence: high on the mechanism, cited)

## Data & Constraints

- **Constitution Principle I (Snapshot-Only)**: the app must not call data.gov.sg while serving a page load. Island-wide data not tied to a location is allowed only by listed, amended exceptions (currently lightning). A live call to fetch the area list on each search, or on form open, would likely be a new data.gov.sg call outside the snapshot path and need an amendment. Areas taken from already-stored snapshots, or cached from create/refresh calls, may not. — [source: `.specify/memory/constitution.md` §I] (confidence: high on the text; how it applies needs clarification)
- **Constitution Principle II**: the frontend may call only relative `/api/*` paths. An external geocoder (OneMap or Nominatim) would have to be proxied through Express, not called from the browser. — [source: `.specify/memory/constitution.md` §II] (confidence: high, cited)
- **Constitution Principle III**: all weather access goes through an injectable `weatherClient`, and tests must not reach the network. A geocoder is not weather data. Whether it needs its own injectable client for tests is unstated, though the same reasoning applies. — [source: constitution §III; `docs/testing.md` referenced by CLAUDE.md] (confidence: medium)
- **data.gov.sg rate limits**: the keyless limit is 6 requests per 10 s, and the app already paces its calls. Extra calls for an area list would compete for that budget. — [source: `.specify/assessments/nea-data-new-features/problem.md` citing its research.md] (confidence: medium-high)
- **Existing validation still applies**: any coordinate from a search result goes through the same server-side Singapore bounds check and duplicate rejection (`DuplicateLocationError`). — [source: `backend/src/routes/locations.ts:49-75`] (confidence: high, cited)
- **Privacy**: an external geocoder receives the user's search text, which may be a home address or postal code. Today the app sends nothing user-typed off the machine except coordinates to data.gov.sg. — [ASSUMPTION about what users type; the data flow is cited from `backend/src/providerHttp.ts`] (confidence: medium)
- **Licensing and attribution**: OneMap data appears to be under the OneMap/Singapore Open Data Licence with attribution such as "©OneMap Singapore ODL v1.0". Commercial-use terms are unclear. Nominatim results are ODbL and need OSM attribution. — [source: web search: josm.openstreetmap.de/wiki/Maps/Singapore, sla.gov.sg; not fetched] (confidence: low)
- **Testing constraint**: frontend tests cover pure `.ts` modules only. Any matching or filtering logic worth testing must sit in a pure module. — [source: `.specify/assessments/use-my-location/decision.md`, carried-forward constraint] (confidence: high, cited)

## Evidence Against the Idea

- **Weak demand**: one stated want from the owner. No usage data and no other requests. — [source: repo search] (high)
- **Precision mismatch**: the headline forecast already resolves to one of about 47 areas. A precise geocoder adds cost, a dependency and privacy exposure, mostly for station readings and region data. A local area-name list may meet the stated need ("Woodlands, Sembawang") without any external service. — [source: `backend/src/weather.ts`] (medium-high)
- **External geocoder risks**: unclear auth (OneMap token handling), strict rate limits and an unconfirmed autocomplete ban (Nominatim), licensing and attribution duties, a new network dependency, and secrets handling for a server-side token. — [source: web search snippets above] (medium)
- **Overlap with "use my location"**: both features target the same friction in the same form. That feature is approved but unbuilt, and building both widens the form's scope. — [source: use-my-location decision.md; frontend grep] (high)
- **A local list fails for unlisted places**: a list of ~47 forecast-area names won't find estates, MRT stations, malls, postal codes or sub-areas such as "Admiralty" or "Canberra" unless aliases are added. Users may expect to find these. — [ASSUMPTION] (medium)

## Gaps & Open Questions

- [NEEDS CLARIFICATION: Search scope. Are forecast-area names enough (Woodlands, Sembawang …), or must it find any place, address or postal code?]
- [NEEDS CLARIFICATION: Should a chosen result fill the lat/lon fields for the user to review (as stated), or add the location at once? The request says "find and fill".]
- [NEEDS CLARIFICATION: Where does the area list come from without breaking Principle I: stored snapshots, a cache filled during create/refresh, a bundled static list, or a new amended endpoint?]
- [NEEDS CLARIFICATION: If an external geocoder is in scope, which one? Verify OneMap's current search auth, rate limits and terms against onemap.gov.sg/apidocs (not fetched: host not allowlisted).]
- [NEEDS CLARIFICATION: Verify the live `two-hr-forecast` `area_metadata` list includes "Woodlands" and "Sembawang". This needs a data.gov.sg fetch, which was not done in this session.]
- [NEEDS CLARIFICATION: Order and interaction with the approved "use my location" feature (spec 003). One combined form redesign, or separate?]
- [NEEDS CLARIFICATION: Privacy stance on sending typed search text (possibly home addresses) to a third party, and whether it may be logged.]

## Sources

Internal (read directly):
- `frontend/src/components/AddLocationForm.tsx`, `frontend/src/components/Hero.tsx`
- `backend/src/weather.ts`, `backend/src/routes/locations.ts`, `backend/src/providerHttp.ts`
- `README.md` (roadmap item 3, "Singapore area picker")
- `.specify/memory/constitution.md` (Principles I–III)
- `.specify/assessments/use-my-location/{research,problem,decision}.md`, `.specify/assessments/nea-data-new-features/problem.md`
- `specs/003-use-my-location/spec.md` (existence), `specs/005-wbgt-heat-stress-tile/research.md`
- `~/.claude/skills/sg-weather-api/references/endpoints.md`

External (web-search result snippets only; no page fetched, as none of these hosts is on the allowlist):
- https://sheshbabu.com/posts/exploring-singapore-onemap-api (host: sheshbabu.com, policy: search-only, not fetched)
- https://rdrr.io/cran/onemapsgapi/src/R/search_geo.R (host: rdrr.io, policy: search-only, not fetched)
- https://jentic.com/apis/onemap.gov.sg/onemap (host: jentic.com, policy: search-only, not fetched)
- https://publicapis.io/one-map-singapore-api (host: publicapis.io, policy: search-only, not fetched)
- https://sla.gov.sg/geoworks/sla-products/onemap (host: sla.gov.sg, policy: search-only, not fetched)
- https://josm.openstreetmap.de/wiki/Maps/Singapore (host: josm.openstreetmap.de, policy: search-only, not fetched)
- https://wiki.openstreetmap.org/wiki/Nominatim (host: wiki.openstreetmap.org, policy: search-only, not fetched)
- https://help.openstreetmap.org/questions/56533/is-the-nominatim-request-limit-done-automatically (host: help.openstreetmap.org, policy: search-only, not fetched)
- https://moltchat-agent-commons.onrender.com/wiki/Nominatim_geocoding_usage_policy_and_rate_limits (host: moltchat-agent-commons.onrender.com, policy: search-only, not fetched; low trust)
- Official pages to verify later: onemap.gov.sg/apidocs/search, operations.osmfoundation.org/policies/nominatim (not fetched: hosts not allowlisted)
