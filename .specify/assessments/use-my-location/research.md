# Idea Research: "Use my location" button

- **Slug**: use-my-location
- **Created**: 2026-11-12
- **Revised**: 2026-11-12 — scope clarified by the user: "location" means the position of the person *accessing the weather app* (the browser user), and the open question is whether a web browser can supply it. A feasibility section was added.
- **Evidence confidence (overall)**: medium — codebase findings are high confidence and cited. Chrome feasibility on plain-HTTP `*.localhost` is now directly observed (high). Firefox/Safari behaviour, accuracy in practice, and demand remain unverified.

## Feasibility: Can the browser supply the user's location?

- **Yes, in principle.** Browsers expose the W3C Geolocation API (`navigator.geolocation`); it asks the user for permission and returns latitude/longitude and an accuracy radius. — [source: web search results: flaviocopes.com/geolocation-api, wikiwand W3C Geolocation API] (confidence: high; search snippets only, no page fetched)
- **Secure-context requirement.** Chrome has refused geolocation on non-secure pages since Chrome 50; localhost counts as secure. Blocked calls fail with error code 1 (permission denied). — [source: developer.chrome.com/blog/geolocation-on-secure-contexts-only (search result only, page not fetched)] (confidence: medium-high)
- **Observed test, Chrome 156 on macOS (this machine):** served a static page over plain HTTP from `http://weather-starter.localhost:<port>` (the same hostname pattern as the dev URL). Results: `isSecureContext = true`, `'geolocation' in navigator = true`, permission state `"prompt"` (so it would show the normal permission prompt, not be blocked). — [source: direct observation via Chrome automation, 2026-11-12; throwaway server on a spare port, stopped afterwards] (confidence: high for Chrome on this machine)
- **Not tested:** an actual `getCurrentPosition` call and its returned accuracy (needs the user to accept the prompt); Firefox and Safari; access via a LAN IP (a non-localhost HTTP origin is expected to be blocked, per the Chrome source above — unverified here). — (confidence: n/a)
- **Failure modes the feature must handle (all three are standard API outcomes):** permission denied, position unavailable, and timeout. — [source: flaviocopes.com/geolocation-api via search] (confidence: medium)
- **Accuracy:** desktop browsers have no GPS and fall back to IP address or nearby Wi-Fi lookup, which is coarse. Accuracy may be off by hundreds of metres to kilometres. On Singapore's roughly 50 km width this could pick a neighbouring forecast area. — [source: sitepoint.com/geolocation-in-the-browser via search] (confidence: medium)
- **Conclusion:** getting the browser user's location is feasible on plain-HTTP localhost in Chrome. Remaining risks are permission denial, coarse desktop accuracy, and other browsers or hosts. — (confidence: medium-high)

## Users & Demand

- The only way to add a location today is typing a raw latitude/longitude into `AddLocationForm` (placeholders `1.3508` / `103.8390`). Users must already know their coordinates. — [source: `frontend/src/components/AddLocationForm.tsx`] (confidence: high, cited)
- No user signal for this feature exists in the repo: no issue, request, usage log, or spec mentions geolocation, "my location" or "current location". — [source: grep over `backend/src`, `frontend/src`, `docs`, `specs`, `.specify/memory`: no matches] (confidence: high that none is recorded; demand itself is unknown)
- Demand is a stated want from the idea submitter only, not observed behaviour. — [source: intake.md] (confidence: low)
- Likely user: someone checking weather for where they are now. — [ASSUMPTION] (confidence: low)

## Prior Art

- **Nearest-area matching already exists server-side.** `nearestAreaName` in `backend/src/weather.ts` picks the closest forecast area from the 2-hour forecast `area_metadata` using squared lat/lon degree distance, with no distance cutoff. Region and station matching work the same way. It is not exported and not exposed via any endpoint. — [source: `backend/src/weather.ts` ~L482-600] (confidence: high, cited)
- **Create already derives the area.** `POST /api/locations` takes only `{latitude, longitude}`, validates a Singapore bounding box (lat 1.1–1.5, lon 103.6–104.1; 422 otherwise), inserts, then refreshes the snapshot, which carries the derived `area`. A refresh failure still returns 201 with the default snapshot. — [source: `backend/src/routes/locations.ts`; `docs/architecture.md`] (confidence: high, cited)
- **A "Use my location" flow could therefore reuse `create({latitude, longitude})` with browser coordinates.** The data model stores coordinates, not forecast areas. "Finds the nearest forecast area and adds it" does not match the current model, where the saved location is the exact coordinate and the area is a derived label. — [source: `backend/src/schema.ts` (`area` is a text snapshot column, unique index on latitude+longitude); `backend/src/db.ts`] (confidence: high, cited)
- **Duplicate handling is exact-match only.** `createLocation` rejects a duplicate only when latitude and longitude are identical (409). GPS readings vary between calls, so repeated use would create many near-identical locations rather than hit 409. — [source: `backend/src/db.ts` L78-111; `schema.ts` L63] (confidence: high, cited)
- **Related prior specs:** 001 (persist saved locations) and 002 (lightning map layer) contain no geolocation scope. 001 lists reordering, renaming and import/export as out of scope. — [source: `specs/001-persist-saved-locations/spec.md` L107-114; `specs/002-lightning-map-layer/spec.md` L150-159] (confidence: high, cited)
- No other geolocation prior art found in this repo. — (confidence: high)

## Market & Context

- Consumer weather apps commonly offer "current location" as a default. — [ASSUMPTION] (confidence: medium; not sourced)
- Alternative today: look up coordinates elsewhere and paste them into the form. Cost of doing nothing is friction in the add flow only; it is not a blocker or a correctness problem. — [source: `AddLocationForm.tsx`] (confidence: medium)

## Data & Constraints

- **Secure context:** see the Feasibility section. Chrome treats `http://weather-starter.localhost:<port>` as secure (observed). — (confidence: high for Chrome)
- **Remaining host risk.** The dev URL is `http://weather-starter.localhost:1355` (Portless). Other browsers and LAN-IP access are untested. — [source for the URL: `CLAUDE.md`] (confidence: medium)
- Geolocation always needs a user permission prompt and can be denied, time out, or be unavailable; desktop accuracy is coarse. — see Feasibility (confidence: medium)
- Backend rejects coordinates outside the Singapore bounding box with 422. A user outside Singapore gets a rejection unless the client checks first. The box is also coarse: it includes some sea and Johor-adjacent points. — [source: `routes/locations.ts`] (confidence: high, cited)
- **Constitution Principle I**: data.gov.sg is called only on create or explicit refresh. Creating via geolocation is a create, so it appears compatible. Matching the area client-side would need provider metadata on the page. A separate "find nearest area" endpoint that calls the provider would need an amendment. — [source: `.specify/memory/constitution.md` Principle I] (confidence: high, cited)
- **Constitution Principle II/IV**: the frontend calls only relative `/api/*` paths; frontend tests cover pure `.ts` modules only, so geolocation or distance logic would need extracting into a pure module. The Geolocation call itself is not unit-testable under the no-DOM harness. — [source: constitution] (confidence: high, cited)
- **Privacy:** precise coordinates would be persisted in SQLite, and frontend interactions are logged via `POST /api/logs`. Whether coordinates reach logs is not determined here. — [source: `docs/architecture.md` (storage and logs)] (confidence: medium)

## Evidence Against the Idea

- No recorded demand: no ticket, request or usage data. The sole signal is the submitter's own want. — [source: grep, intake.md]
- The app is a Singapore-only dashboard of saved locations. Singapore is small (about 50 km wide), and the 2-hour forecast areas are coarse, so a typed coordinate or a manual pick may serve almost as well. — [ASSUMPTION] (confidence: low)
- Model mismatch: "adds the nearest forecast area" conflicts with coordinate-based storage. Doing it faithfully needs either a model or UX change, or adding the user's exact coordinates, which can pile up near-duplicate rows because dedupe is exact-match only. — [source: `db.ts`, `schema.ts`]
- Requirement fragility: "works without HTTPS on localhost" is confirmed for Chrome on `weather-starter.localhost`, but not tested in Firefox or Safari, and is expected not to work on a LAN IP. Coarse desktop accuracy may also yield the wrong nearby area. — [source: Feasibility section] (confidence: medium)
- Moderate scope creep for a small win: touches the frontend add flow, an API or helper for nearest-area, permission/error states, and likely a constitution check, plus tests under a no-DOM frontend harness. — [source: constitution Principles I, II, IV]

## Gaps & Open Questions

- [NEEDS CLARIFICATION: Chrome is verified for `*.localhost`; verify Firefox and Safari, and run a real `getCurrentPosition` once to see the returned accuracy on the user's machine.]
- [NEEDS CLARIFICATION: Is there any real user or stakeholder demand beyond the submitter?]
- [NEEDS CLARIFICATION: Should the saved row be the exact GPS point or a canonical forecast-area coordinate (the area `label_location`)? The latter would make duplicate detection meaningful.]
- [NEEDS CLARIFICATION: Where should nearest-area matching run: server (reusing `nearestAreaName` behind a new or extended endpoint) or client? This depends on the Principle I reading.]
- [NEEDS CLARIFICATION: Should a distance cutoff apply to "nearest" when the user is outside or near the edge of Singapore?]
- [NEEDS CLARIFICATION: Are coordinates logged anywhere (`/api/logs`)? Privacy expectations?]

## Sources

- Local repository files read (read-only): `frontend/src/components/AddLocationForm.tsx`, `backend/src/routes/locations.ts`, `backend/src/weather.ts`, `backend/src/db.ts`, `backend/src/schema.ts`, `docs/architecture.md`, `.specify/memory/constitution.md`, `specs/001-persist-saved-locations/spec.md`, `specs/002-lightning-map-layer/spec.md`, `CLAUDE.md`
- No external pages were fetched directly (hosts not on the allowlist). Web-search result pages were used as secondary evidence, only as snippets: `developer.chrome.com/blog/geolocation-on-secure-contexts-only` (host: developer.chrome.com), `flaviocopes.com/geolocation-api/`, `sitepoint.com/geolocation-in-the-browser/`, `en.wikipedia.org/wiki/W3C_Geolocation_API`. Policy: search-only, not fetched.
- Direct observation: Chrome 156 test on a throwaway local HTTP page (see Feasibility).
