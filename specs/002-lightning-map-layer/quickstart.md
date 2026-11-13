# Quickstart: Validating the Lightning Layer

Contracts: [lightning-api.md](./contracts/lightning-api.md). Entities: [data-model.md](./data-model.md).

## Prerequisites

- `npm install` done; run everything from the repo root.
- At least one saved location (the map card only appears with one).
- `WEATHER_API_KEY` is optional; the feature must also work without it.

## 1. Automated checks

```bash
npm test                      # includes backend/src/lightning*.test.ts and lightningHelpers.test.ts
npm run build -w frontend     # type-check and build
```

Expected: all pass. The lightning tests inject fakes and make no network calls.

## 2. Endpoint check (real provider)

```bash
npm run dev    # then, in another shell, using the URL it prints:
curl -s -X POST http://weather-starter.localhost:1355/api/lightning/refresh | head -c 600
curl -s -X POST http://weather-starter.localhost:1355/api/lightning/refresh | head -c 200   # within 2 min
```

Expected: 200 with `strikes` (often `[]`), `window_minutes: 60`. The second call returns the same
`fetched_at`, proving the cache (check the server log shows no second upstream fetch).

## 3. Manual UI scenarios

| # | Steps | Expected |
|---|---|---|
| 1 | Clear `localStorage`, open the app, select a location | No lightning request in the Network tab; control reads "on" and a "Show latest lightning" prompt is shown |
| 2 | Press Refresh, or toggle off then on | One `POST /api/lightning/refresh`; markers or the message "No lightning in the last hour"; last-updated time shown |
| 3 | Toggle off | Markers and message disappear at once; pins and basemap unchanged |
| 4 | Reload | Layer still off, and no lightning request is made |
| 5 | Toggle on twice within 2 minutes | At most one request in total |
| 6 | Open full screen | Same control and markers; the card and full-screen toggles stay in sync |
| 7 | Tab to the control, press Space/Enter | Toggles; screen reader announces "Lightning, switch, on/off" |
| 8 | Switch through every theme and basemap | Strikes and status strip legible on all |
| 9 | Load strikes, then block `/api/lightning/refresh` and Refresh | "Lightning data is currently unavailable" with the earlier strikes still drawn and their last-updated time; map and pins still work |

## 4. Seeing markers when there is no real lightning

Strikes are usually absent. Start the dev server with `LIGHTNING_FIXTURE=demo npm run dev` (dev only; ignored in production). It returns strikes aged 2, 30 and 55 minutes. Confirm: three markers at the right positions, newest most prominent,
popup shows type and time, and a strike aged over 60 minutes is not drawn.

## 5. Verify the provider format on a real strike

When real lightning occurs in Singapore, call the endpoint and confirm `latitude`, `longitude`,
`type` and `label` match what the provider sent (spec Assumption: the strike shape is unconfirmed).
