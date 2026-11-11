# Quickstart: Validate Persist Saved Locations

Run everything from the repo root (the DB path is relative to `process.cwd()`).

## Prerequisites

```bash
npm install
npm run reset          # start from an empty backend/weather.db
```

## 1. Automated checks

```bash
npm test                         # includes backend/src/routes/locations.test.ts
npx vitest run backend/src/routes/locations.test.ts
npm run build -w frontend        # type-check + build
```

Expected: all pass. The locations tests cover duplicate (409), invalid/out-of-range (422), newest-first order, first-refresh failure still saved (201), delete, and restart persistence. See [contracts/locations-api.md](contracts/locations-api.md).

## 2. Manual: save and restart (US1, US2; SC-001, SC-003)

1. `npm run dev`, open http://weather-starter.localhost:1355.
2. Add two Singapore locations (e.g. 1.35, 103.85 then 1.36, 103.86).
3. Stop the server (Ctrl+C) and run `npm run dev` again; reload the page.
4. Expect: both are listed, newest first, the newest is selected, and weather shows without a new fetch.
5. Repeat the restart a few times; the list and order are identical each time.

## 3. Manual: validation and duplicates (US1)

- Add the same coordinates again: error "Location already exists", list unchanged.
- Add 40.7, -74.0: clear Singapore-only error, nothing saved.

## 4. Manual: delete (US3; SC-004)

Delete one location, restart, confirm it does not return and the rest keep their order.

## 5. Manual: empty state and errors (FR-008, FR-010)

- `npm run reset`, restart: the empty state invites adding a location.
- With locations saved, stop the server and reload the page: the sidebar shows an error message and no data is deleted; after restarting the server, the locations are back.
