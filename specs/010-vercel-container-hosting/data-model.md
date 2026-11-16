# Data Model: Host Lepak Weather on Vercel Containers with Turso

**Feature**: [spec.md](./spec.md) | **Date**: 2026-11-16

**No schema change.** `backend/src/schema.ts` and `backend/drizzle/` are untouched, and no new migration is generated. This feature changes **where** the existing data lives and how the app chooses the store.

## Saved location (existing, unchanged)

- Table `locations`, as defined in `backend/src/schema.ts`: id, latitude, longitude, created_at, and the weather snapshot columns.
- Unique index on (latitude, longitude). Duplicates are rejected as today.
- One shared list for all visitors.
- **Where it lives**:

| Mode | Store |
|---|---|
| local (no Turso settings) | `DATABASE_PATH` or `backend/weather.db` |
| turso | `lepak-weather-prod`, seeded with 10 rows |

## Migration history (existing table)

- Table `__drizzle_migrations` (id, hash, created_at), written and read by Drizzle's `sqlite-proxy` migrator.
- **Rule (FR-007)**: on start-up, apply only journal entries newer than the latest `created_at`. Never drop or recreate tables. Apply the statements of one migration atomically.
- **Seeded state**: the uploaded database already holds the history for `0000` to `0003`, so the expected start-up result is "0 migrations applied". Check it with quickstart §2.

## Database configuration (new, in memory only)

The result of `resolveDatabaseConfig(env)` (research R2):

| Field | Type | Notes |
|---|---|---|
| `kind` | `'local' \| 'turso'` | |
| `path` | string | local only. `DATABASE_PATH` or `<cwd>/backend/weather.db` |
| `url` | string | turso only. Scheme `libsql:`, `https:` or `http:` |
| `authToken` | string | turso only. Never logged |

**Validation rules**:

| Input | Result |
|---|---|
| Both `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` non-empty | `turso` |
| Both empty or absent | `local` |
| Exactly one present | `ConfigError("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set together")` |
| `DATABASE_REQUIRE_REMOTE=true` and the result would be `local` | `ConfigError("a hosted database is required here")` |
| URL with any other scheme | `ConfigError` |
| `NODE_ENV=test` and the result would be `turso` | `ConfigError("tests must not use a hosted database")` |

Error messages name variables, never values.

## Database adapter (new interface)

What `db.ts` needs from either store:

- `query(sql, params, method)` gives `{ rows }`, in the shape the `sqlite-proxy` callback expects (values in column order; `get` with no match gives `undefined`).
- `batch(statements)` runs a list of SQL statements atomically. Used by the migrator.
- `execute(sql)` runs one raw statement. Used by `resetStore` for `sqlite_sequence` and by the local WAL pragma.
- `close()`.

Two implementations: `node:sqlite` (local) and `@libsql/client/web` (turso). The row-mapping function for libSQL is pure and unit-tested.

## Deployment (platform concept, not stored by the app)

```text
merge to main ─▶ verify (lint, typecheck, tests, build)
                   ├─ fail ─▶ stop; live version unchanged; failed step shown in GitHub
                   └─ pass ─▶ deploy (queued in merge order) ─▶ Vercel builds image ─▶ live in sin1
live ─▶ rollback (Instant Rollback to previous, or git revert ─▶ pipeline)
```
