# Testing

`vitest.config.ts` runs in the node environment with forks and no file parallelism, because tests share SQLite. It picks up `backend/src/**/*.test.ts` and `frontend/src/**/*.test.ts`.

There is no DOM test environment, so frontend tests are limited to pure `.ts` modules such as `mapHelpers.test.ts`. Backend route tests build the app with `createApp` and an injected fake `weatherClient`.

**Browser checks (on demand).** UI flows that unit tests can't reach are checked in a real browser, outside `npm test` and the pre-commit hook. They add to the vitest unit tests and don't replace them.
- `scripts/e2e/town-search.sh [us1|us2|us3|themes|a11y]` drives the add form with agent-browser.
- `scripts/e2e/lightning-markers.sh [us1|us2|themes]` checks the lightning bolt markers (shape, sizes by age, popup, toggle, pins above, colour per theme). It stubs `POST /api/lightning/refresh` and `GET /api/locations` with `agent-browser network route`, so it never calls data.gov.sg.
- `scripts/e2e/uv-trend.sh [us1|us2|us3|themes]` checks the UV tile's hourly view (spec 008): each state (today, previous day, empty, pre-feature, unavailable) at desktop and 360 px, the Rainfall | UV / Air Quality grid, the text-only fallback at 320 px, and the bars in all six themes. It stubs `GET /api/locations` with `agent-browser network route`, so it never calls data.gov.sg.
- `scripts/e2e/use-my-location.sh [us1|us2|us3|us4|themes]` drives the "Use my location" button. It grants geolocation through CDP; where the agent-browser profile ignores that grant, it switches to a stub of `navigator.geolocation` (and says so), and the browser's own prompt is checked by hand (`specs/003-use-my-location/quickstart.md` §4).
- chrome-devtools (MCPorter) covers the raw network log, performance traces and Lighthouse.
- Both scripts share `scripts/e2e/lib.sh`. By default they start a temporary production-mode server (built `frontend/dist`, free port, throwaway database) and tear it down, with every browser session, from an `EXIT` trap on pass or fail. Run `npm run verify` first so the build is current. `E2E_BASE_URL=<url>` uses a server you run instead; `E2E_DATABASE_PATH=<file>` keeps the database between runs.
- Error buffers are cleared before the first navigation. Any uncaught page error or `console.error` while opening or switching views fails the run at once (`assert_clean`). `E2E_ALLOW_ERRORS=<regex>` ignores known messages.
- Output goes to the git-ignored `e2e-artifacts/`.

**Verification gate.** `npm run verify` runs lint -> typecheck -> tests -> build and stops at the first failure. It adds to the pre-commit hook (`npm run lint`, `npm test`), which is unchanged. While Claude Code edits, a per-file `PostToolUse` hook (`.claude/hooks/post-edit-lint.sh`) runs Prettier and `eslint --fix` on the edited file.
