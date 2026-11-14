# Quickstart: validate the WBGT Heat-Stress Tile

## Prerequisites
- `WEATHER_API_KEY` (Development key) in `.env`, then restart `npm run dev`.
- Run every command from the repo root.

## 1. Automated checks
```bash
npm run lint
npm test
npm run build -w frontend
```
These should cover:
- `heatStress.test.ts`: every view state, the 10.0 km boundary, unknown levels, and guidance appearing only for Moderate or High.
- `weather.test.ts`: the WBGT fields, the nearest station chosen by km, a failed WBGT fetch leaving the other readings intact, and non-numeric `wbgt` ignored.
- `providerHttp.test.ts`: request starts spaced at the interval, one stream across both clients, and a single retry after the 10 s delay. These tests use fake timers or a 0 ms interval.
- `locations.test.ts`: the refresh response carries the five fields.

## 2. Migration
`npm run db:generate` should create `backend/drizzle/0002_*.sql` that adds the five nullable columns. Start the app against an existing `weather.db`. Old locations should load and show "No reading" on the Heat Stress tile (FR-015).

## 3. Live reading (SC-001)
Add a location at Bishan (1.3548, 103.8522) and let it refresh. The tile should show the station "Bishan Street" at about 0.0 km, with the value, level and time matching `weather?api=wbgt` fetched at the same time.

## 4. Refresh time and the progress indicator (SC-003, FR-013)
Refresh a location and time it. It should take 15 s or less, typically about 10 to 11 s. The refreshing indicator should stay visible the whole time, and the old readings should stay on screen until the refresh finishes.

## 5. Overlap with lightning (SC-002)
Start a refresh, then turn the lightning layer on straight away (or press its refresh button). Both should finish, and the server log should show no `rate limit reached (HTTP 429)`. Repeat about 5 times.

## 6. Guidance wording (R3)
Compare the Moderate and High lines in `heatStress.ts` with the current advisory on weather.gov.sg or myENV, and adjust the wording if NEA's has changed.

## 7. Themes and narrow width (SC-004)
Switch through every theme and resize to 375 px wide. The tile should stay readable, with no sideways scroll.
