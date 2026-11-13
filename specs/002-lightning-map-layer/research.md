# Research: Lightning Strikes on the Map

Findings were verified against the live API on 2026-11-11 (no strikes present) and re-checked on 2026-11-12 with real strikes: readings match the documented shape (`location` strings, `type` `C` or `G`, `text`, `datetime`), and the feed covers the wider region around Singapore.

## 1. Data source and shape

- **Decision**: `GET https://api-open.data.gov.sg/v2/real-time/api/weather?api=lightning[&date=YYYY-MM-DD][&paginationToken=…]`.
- **Observed**: `data.records[]` newest first; each `{ datetime, updatedTimestamp, item: { type: "observation", isStationData: false, readings: [] } }` covers one 2-minute window. A reading is documented as `{ location: { latitude, longitude } (strings), type: "C", text: "Cloud to Cloud", datetime }`. `/lightning` as a path is 404.
- **Rationale**: it is the only lightning route; it needs no key and is the same host and client conventions the app already uses.
- **Caveat**: no real strike was available, so the reading shape is unverified against a populated record. The parser MUST be defensive (see 4) and a task MUST re-check against a real strike when one occurs.

## 2. Covering the last 60 minutes

- **Observed**: without `date`, only the latest record is returned (about 2 minutes). With `date`, a page has 25 records (about 50 minutes) plus a `paginationToken`; passing it back as `paginationToken=` returns the next 25 (verified).
- **Decision**: request `date` = today in Singapore time (UTC+8), follow `paginationToken` until the oldest record is older than the cutoff (`now − 60 min`) or there is no token, cap at 3 pages. If the cutoff falls on the previous SGT date (first hour after midnight) also request the previous date once.
- **Rationale**: the default response alone cannot satisfy FR-002; 2–3 requests per refresh, cached for 2 minutes, stays inside the rate limit.
- **Alternatives**: the latest record only (rejected: shows 2 minutes, not an hour); a polling background job storing records (rejected: violates the user-action-only rule and adds storage).

## 3. Server cache and rate limiting

- **Decision**: in-memory cache in the lightning client module holding one observation window for 2 minutes (`FRESH_MS = 120_000`); in-flight requests are shared. A failed fetch serves the previous window flagged `stale: true` if one exists, else returns 502.
- **Rationale**: satisfies FR-014 and SC-005 across all clients, not just one browser tab. Requests go through the same 250 ms spacing and 429 single-retry behaviour as `SingaporeWeatherClient` by reusing its fetch approach (small shared helper rather than copying logic).
- **Alternatives**: client-only throttling (rejected: two tabs or devices would double requests); long TTL (rejected: the dataset updates every 2 minutes).

## 4. Normalisation rules

- **Decision**: a strike is kept when latitude and longitude parse with `Number()` to finite values inside valid WGS84 ranges (lat −90 to 90, lng −180 to 180). A Singapore-only box was tried first and rejected: on 2026-11-12 the live feed reported 370 strikes of which only 22 were inside Singapore (the rest were in the wider region), so a box would drop 94% of valid strikes and break SC-001 and its datetime parses and is within `[now − 60 min, now + 5 min]`. Label = `text` if a non-empty string, else "Lightning". Type = `type` if a string, else `"unknown"`. Bad strikes are skipped and counted in a debug log only.
- **Rationale**: FR-010 and the clock-skew edge cases; the small future allowance avoids hiding a strike over minor clock drift. Strikes are de-duplicated by `datetime|lat|lng`.
- **Alternatives**: reject all data on one bad strike (rejected by FR-010).

## 5. Endpoint style

- **Decision**: `POST /api/lightning/refresh` returning the observation window (see [contracts](./contracts/lightning-api.md)). POST signals an explicit user action, matching `POST /api/locations/:id/refresh`, and keeps it clearly distinct from the read-only `GET /api/locations`.
- **Alternatives**: `GET /api/lightning` (rejected: reads as a safe page-load call and invites automatic fetching, which FR-013 forbids).

## 6. Dependency injection

- **Decision**: new `LightningClient { getRecentLightning(now?) }` interface; `createApp({ lightningClient })`, default `SingaporeLightningClient({ apiKey: process.env.WEATHER_API_KEY })`. The key is optional.
- **Rationale**: Principle III; keeps `WeatherClient` (per-location snapshot) unchanged.

## 7. Map rendering

- **Decision**: Leaflet `CircleMarker` (SVG, no icon assets) in a dedicated pane with `zIndex` below the location pins, so pins remain clickable. Opacity maps linearly from 1.0 (now) to 0.15 (60 min); radius 8 px down to 5 px. A `Popup` shows the label and local time plus relative age. Strikes at nearly the same position keep individual markers with semi-transparent fill so overlaps stay visible.
- **Rationale**: no extra dependency, scales to hundreds of points, easy to unit-test the age→style function. Clustering was rejected as unnecessary at this scale and as extra dependency.
- **Colour**: a `--lightning` CSS variable defined per theme in `index.css` and read through `getComputedStyle`, so every basemap stays legible (Principle V, FR-015).

## 8. Toggle, status and persistence

- **Decision**: `localStorage` key `weather-starter.lightning.enabled` (default on; reads/writes wrapped in try/catch, matching how a missing storage must degrade). The control is a native `<button role="switch" aria-checked>` with an accessible name, placed on the map in both card and full-screen views, sharing one store value so the two stay in sync.
- **Behaviour (confirmed by clarification 2026-11-12)**: because lightning must not fetch on page load (FR-013) and default is on, a fresh page shows the layer "on" but with no data and a "Show latest lightning" prompt, which is itself a button that calls `refresh()`, until the first user action. Turning the layer on, or pressing Refresh, calls the store action, which skips the request when data is under 2 minutes old.
- **Resolved**: Story 2 scenario 4 and FR-005 now state that "on" is a display preference only and data appears after the first action.
- **Alternatives**: auto-fetch when the map first mounts (rejected: that is a page load for users with a selected location).

## 9. Status messaging

- **Decision**: one status strip above the map controls with four states: `idle` (never fetched; "Show latest lightning" button), `loading`, `empty` ("No lightning in the last hour" plus last-updated time), `unavailable` ("Lightning data is currently unavailable"; strikes loaded earlier stay drawn, still hiding any older than 60 minutes, with their last-updated time, per clarification 2026-11-12), and `ok` (count and last-updated time). Rendered with `role="status"` so it is announced politely.
- **Rationale**: FR-008, FR-009, FR-011 and SC-004.

## 10. Testing approach

- Backend: fake `fetch` (via injected `fetchImpl` on the client) for pagination, window cutoff, malformed strikes, cache reuse, 429/timeout behaviour; route tests with a fake `LightningClient`.
- Frontend: pure helpers only (age → opacity/radius, label, status derivation, freshness check, storage parse). No DOM tests, per Principle IV.

## 11. Seeing strikes when there are none, and colour/tick placement

- **Decision**: add a dev-only `LIGHTNING_FIXTURE=demo` switch in `server.ts` (ignored when `NODE_ENV=production`) that injects a fake `LightningClient` returning strikes aged 2, 30 and 55 minutes. This makes User Story 1 and fading verifiable on a day with no lightning, with no change to production behaviour.
- **Decision**: the `--lightning` CSS variable ships with User Story 1 (not US3), and the 30-second re-render tick lives in `LightningLayer` from the start, so strikes expire at 60 minutes (FR-002) in the MVP.
