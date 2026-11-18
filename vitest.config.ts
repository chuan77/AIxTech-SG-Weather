import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'backend/src/**/*.test.ts',
      'frontend/src/**/*.test.ts',
      'scripts/research/**/*.test.mjs',
    ],
    pool: 'forks',
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Never let tests reach a hosted database, even if .env holds real Turso values.
      // dotenv does not override variables that already exist, so these blanks win.
      TURSO_DATABASE_URL: '',
      TURSO_AUTH_TOKEN: '',
      // Never measure visits from tests (spec 012), even if .env sets WEB_ANALYTICS.
      WEB_ANALYTICS: '',
      VERCEL: '',
    },
  },
});
