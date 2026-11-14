---
title: Testing
description: How the Vitest setup works, its limits, and the patterns to follow.
sidebar:
  order: 1
---

```bash
npm test                                   # everything
npx vitest run backend/src/weather.test.ts # one file
npx vitest run <file> -t "returns 409"     # one test
npm run test:watch
```

## Setup

`vitest.config.ts` at the repo root:

- includes `backend/src/**/*.test.ts` and `frontend/src/**/*.test.ts`,
- runs in the `node` environment,
- uses `pool: 'forks'` with `fileParallelism: false`, because route tests share SQLite,
- sets `NODE_ENV=test` and `LOG_LEVEL=silent`.

With `NODE_ENV=test`, `createApp` skips Vite, static files and request logging.

## What is tested where

```mermaid
flowchart LR
  subgraph Backend
    RT["routes/*.test.ts<br/>Supertest against createApp"]
    WT["weather.test.ts<br/>stubbed fetch"]
    LT["lightning.test.ts<br/>stubbed fetch"]
    PT["providerHttp.test.ts<br/>fake timers"]
  end
  subgraph Frontend["Frontend (pure .ts only)"]
    MH["mapHelpers.test.ts"]
    LH["lightningHelpers.test.ts"]
    FL["feelsLike.test.ts"]
    ST["sunTimes.test.ts"]
    HS["heatStress.test.ts"]
    TS["townSearch.test.ts"]
  end
  RT --> Fake["Fake weatherClient /<br/>lightningClient"]
  RT --> TmpDB[("Temporary SQLite<br/>via DATABASE_PATH")]
```

## Backend route tests

Follow `backend/src/routes/locations.test.ts`:

1. Create a temporary directory and set `DATABASE_PATH` to a file inside it before importing the server.
2. Import `createApp` dynamically, because `db.ts` opens the database at import time.
3. Build the app with a fake provider and no frontend:

   ```ts
   const { createApp } = await import('../server.js');
   const app = await createApp({
     serveFrontend: false,
     enableRequestLogging: false,
     weatherClient: { getCurrentWeather: async () => snapshot },
   });
   ```

4. Drive it with `supertest`, reset rows between tests with `resetStore()`, and close with `closeDatabase()` at the end.

Tests must never reach data.gov.sg. Client-level tests (`weather.test.ts`, `lightning.test.ts`) stub `fetch` instead; `ProviderRequester` accepts a `fetchImpl` for this.

Real pacing would make each weather test wait about 10–20 seconds, so client tests construct clients with `{ requestIntervalMs: 0, rateLimitRetryDelayMs: 0 }`. Pacing itself is tested once, in `providerHttp.test.ts`, with `vi.useFakeTimers()`: spacing for each key tier, the 10-second 429 retry, and one queue shared by both clients.

## Frontend limits

There is no DOM environment, so components are not rendered in tests. Put any logic worth testing in a pure `.ts` module next to the component and test that, as `feelsLike.ts`, `heatStress.ts`, `sunTimes.ts`, `townSearch.ts`, `mapHelpers.ts` and `lightningHelpers.ts` do.

## Browser checks

Some UI behaviour can't be unit-tested without a DOM, so it's checked in a real browser on demand. These checks are **not** part of `npm test` or the pre-commit hook. They add to the vitest unit tests and don't replace them.

Run them against a throwaway database so your own `backend/weather.db` is untouched:

```bash
DATABASE_PATH=backend/e2e.db npm run reset
DATABASE_PATH=backend/e2e.db npm run dev     # leave running
scripts/e2e/town-search.sh                  # or: us1 | us2 | us3 | themes | a11y
```

- **agent-browser** (`scripts/e2e/town-search.sh`) drives the add-location town search. It finds elements by ARIA role and accessible name, so a broken combobox contract fails the run. It also checks that every theme renders the town list legibly (screenshots), and runs an axe scan that must report 0 violations.
- **chrome-devtools** (via MCPorter, `mcporter call chrome-devtools.<tool>`) is used for what agent-browser shouldn't own:
  - the raw network log (searching must make no data.gov.sg calls);
  - a performance trace while typing (INP);
  - Lighthouse accessibility.

Screenshots, scans and traces go to `e2e-artifacts/`, which is git-ignored. Each add triggers the normal create snapshot, so a full run makes real data.gov.sg calls for the locations it adds.

## Quality gate

The project constitution says no code may be committed unless `npm run lint` and `npm test` both pass, enforced by a Husky pre-commit hook. Husky is installed (`npm install` runs `husky` via `prepare`), and `.husky/pre-commit` runs `npm run lint` and `npm test`. Do not bypass it with `--no-verify`.
