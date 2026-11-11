# Testing

`vitest.config.ts` runs in the node environment with forks and no file parallelism, because tests share SQLite. It picks up `backend/src/**/*.test.ts` and `frontend/src/**/*.test.ts`.

There is no DOM test environment, so frontend tests are limited to pure `.ts` modules such as `mapHelpers.test.ts`. Backend route tests build the app with `createApp` and an injected fake `weatherClient`.
