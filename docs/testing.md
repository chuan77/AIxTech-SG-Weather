# Testing

`vitest.config.ts` runs in the node environment with forks and no file parallelism, because tests share SQLite. It picks up `backend/src/**/*.test.ts` and `frontend/src/**/*.test.ts`.

There is no DOM test environment, so frontend tests are limited to pure `.ts` modules such as `mapHelpers.test.ts`. Backend route tests build the app with `createApp` and an injected fake `weatherClient`.

**Browser checks (on demand).** UI flows that unit tests can't reach are checked in a real browser, outside `npm test` and the pre-commit hook. They add to the vitest unit tests and don't replace them.
- `scripts/e2e/town-search.sh [us1|us2|us3|themes|a11y]` drives the add form with agent-browser.
- chrome-devtools (MCPorter) covers the raw network log, performance traces and Lighthouse.
- Run both against a throwaway database (`DATABASE_PATH=backend/e2e.db npm run dev`).
- Output goes to the git-ignored `e2e-artifacts/`.
