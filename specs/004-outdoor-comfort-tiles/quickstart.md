# Quickstart: Outdoor Comfort Tiles

Validation guide for [spec.md](spec.md). Run everything from the repo root.

## Prerequisites

- `npm install` done; `WEATHER_API_KEY` set in `.env` (Dev key is enough; this feature adds no calls).
- After schema edits: `npm run db:generate` produced a new migration in `backend/drizzle/`.

## 1. Automated checks

```bash
npm test                      # must pass, including the new pure-module tests
npm run build -w frontend     # must type-check and build
```

Expected new test coverage:
- Feels-like module: every band boundary (23.9, 24.0, 26.9, 26.95 → 27.0, 27.0, 31.9, 32.0, 36.9, 37.0), null temperature, null humidity, both null, null wind (`approx`), umbrella from forecast wording, umbrella from rainfall > 0.1, null rainfall with rainy forecast, "Not refreshed" condition, no output containing "Heat Stress". (SC-004)
- Sun-times module: at least three reference dates for a central Singapore point within 2 minutes of a published table (SC-005), and SGT date derived correctly when the browser time zone is not SGT.
- Weather client: pollutant fields parsed for the matched region from a `psi` fixture; string values coerced; missing keys give `null`; `psi` failure gives all `null` while PM2.5 still works; the number of requested paths is unchanged (SC-003).

## 2. Run the app

```bash
npm run dev                   # http://weather-starter.localhost:1355
```

## 3. Manual scenarios

1. **Refreshed location**: select a saved location and press Refresh. Expect "Feels like" with a value, label and advice; sunrise/sunset times; an air-quality readout that expands to five pollutants with units and a reading time.
2. **Unrefreshed location**: add a new location while offline or right after `npm run reset` with refresh failing. Expect "Feels like: No reading" with a tooltip, sun times still shown, pollutants "No reading".
3. **Pre-existing location**: with a database from before the migration, start the app. Old locations show PSI/PM2.5 as before and pollutants as "No reading" until refreshed.
4. **Themes**: switch through every theme; all three readouts follow it with no hard-coded colours. `apple` theme must look unchanged apart from the new readouts.
5. **Phone width**: narrow the window to about 375 px; no horizontal scroll.
6. **Midnight**: optionally fake the clock (DevTools sensors or system time) past 00:00 SGT; sun times move to the new date within a minute.

## 4. Network check (SC-003)

With DevTools open, refresh one location before and after the change and count calls to
`api-open.data.gov.sg` in the server log or request log. The count must be the same (11).

## 5. Before release

- Confirm pollutant units, especially CO (mg/m³), against NEA's "Computation of the Pollutant Standards Index (PSI)" document (research R7).
- Record the owner's step-2 go/no-go in `.specify/assessments/nea-data-new-features/` (SC-006).
