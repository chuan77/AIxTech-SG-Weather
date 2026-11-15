# Quickstart: Validate Use My Location

**Feature**: [spec.md](spec.md) | **Contract**: [contracts/use-my-location.md](contracts/use-my-location.md)

## 1. Prerequisites

- Node 22, `npm install` done at the repo root.
- Chrome, and `agent-browser` on the PATH (for §3).
- A throwaway database, so the owner's saved places are untouched:

```bash
DATABASE_PATH=backend/e2e.db npm run reset
DATABASE_PATH=backend/e2e.db npm run dev      # http://weather-starter.localhost:1355
```

Each successful add makes the normal create snapshot call to data.gov.sg. Keep E2E runs short.

## 2. Automated unit checks

```bash
npx vitest run frontend/src/components/geolocate.test.ts frontend/src/components/nearbySaved.test.ts
npm test            # full suite, must stay green
npm run lint
npm run build -w frontend
```

**Expected:** all contract §1 cases pass, and the existing suites are unchanged.

## 3. Browser E2E (on demand)

```bash
scripts/e2e/use-my-location.sh            # all stories
scripts/e2e/use-my-location.sh us1        # one story: us1 | us2 | us3 | us4 | themes
```

The script sets the emulated position with `agent-browser set geo <lat> <lng>`.

**First run only:** confirm that `set geo` also grants the geolocation permission. If the run reports "denied" for US1, grant the permission through the session's CDP connection (`Browser.grantPermissions` with `geolocation`) in the script's setup and re-run. If that isn't possible, run US1 and US3 by hand as in §4.

| Story | Steps the script drives | Expected |
|---|---|---|
| US1 | Set geo to Bishan (1.3508, 103.839), then press "Use my location" | A new location is selected, the hero `h1` reads "Bishan", and it is still there after reload |
| US2 denied | Deny the permission, then press | `role=alert` says location access is blocked; no new card; Add Location still works |
| US2 outside | Set geo to Kuala Lumpur (3.139, 101.687), then press | Message says "outside Singapore"; no request to `/api/locations` |
| US3 | Set geo about 50 m from the US1 point, then press | The existing card is selected and "Already saved: Bishan" shows; the card count is unchanged |
| US4 | Override the user agent to Firefox, then Safari; press the button with the position made unavailable | No note before pressing; the failure message ends with "Use my location has only been tested in Chrome." A denial shows no hint. With Chrome's user agent, no hint |
| themes | Set each of the six themes and screenshot the sidebar with a message showing | The text is legible; screenshots go in `e2e-artifacts/use-my-location/` |

Timeout and unavailable can't be emulated reliably. Their messages are covered by the unit tests (contract §1).

## 4. Manual checks (Chrome, real position)

1. Open the dev URL in Chrome and press **Use my location**. The browser prompts before anything else happens (FR-002). Accept.
2. **Expected:**
   - the location appears and is selected within 10 s (SC-002);
   - the hero shows a nearby forecast area.
3. Record the accuracy from DevTools for the carried-forward check from the assessment:
   ```js
   navigator.geolocation.getCurrentPosition((p) => console.log(p.coords.accuracy))
   ```
   Note the value in this file's results.
4. Press again from the same place. "Already saved" appears and no second entry is added (SC-004).
5. Privacy check (SC-006):
   ```bash
   grep -nE 'geolocate|location_create' backend/logs/app.log | tail
   ```
   **Expected:** the entries carry `outcome`, `source` and `area`, and no latitude or longitude.
6. No background requests (FR-012): reload the page and confirm no permission prompt or geolocation call happens until you press the button.

## Results

| Date | Browser | Accuracy (m) | Notes |
|---|---|---|---|
| 2026-11-15 | Chrome 157 (agent-browser, headless) | n/a (stubbed) | §3: 23/23 passed in **stub mode**. This agent-browser profile ignores CDP geolocation grants (`navigator.permissions` stays `prompt` after `Browser.grantPermissions` and `setPermission`, with or without origin), so the script stubbed `navigator.geolocation`. §4 step 5: geolocation creates logged only `source`, `locationId` and `area`, with no coordinates. FR-012: `requestPosition` has one call site, in the button's click handler. **Still to do by hand:** §4 steps 1–4 (real prompt, real accuracy, repeat press). |
|  |  |  |  |
