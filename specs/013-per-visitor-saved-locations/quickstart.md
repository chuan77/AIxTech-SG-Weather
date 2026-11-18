# Quickstart: Validate per-visitor saved locations

This is a validation guide, not an implementation guide. Behaviour details are in [contracts/locations-api.md](contracts/locations-api.md), [contracts/ui.md](contracts/ui.md) and [data-model.md](data-model.md).

## Prerequisites

- Run from the repo root. Use a throwaway local database (`DATABASE_PATH=/tmp/...` or `npm run reset`), never Turso.
- `npm run verify` passes. That covers lint, typecheck, the vitest suites (including the new isolation, retention, claim and `visitorKey` tests) and the build.

## 1. Automated checks (vitest)

```bash
npx vitest run backend/src/routes/locations.test.ts   # two-visitor isolation, 404 parity, 400 without key, per-visitor duplicates
npx vitest run backend/src/visitors.test.ts           # key hashing, last-used bump, 90-day sweep (fake clock), NULL rows never swept
npx vitest run backend/src/claimLegacy.test.ts        # claim moves NULL rows, skips clashes, second run is a no-op
npx vitest run frontend/src/visitorKey.test.ts        # format, generation from given bytes, storage-throws fallback
```

Expected: all pass. The isolation tests cover SC-001 and SC-002, the sweep tests SC-007, and the claim tests SC-008.

## 2. Two visitors by hand (API)

With a server you started yourself (not the user's `npm run dev` on `weather-starter.localhost:1355`):

```bash
A=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")
B=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")
curl -s -H "X-Visitor-Key: $A" -H 'Content-Type: application/json' -d '{"latitude":1.35,"longitude":103.94}' $BASE/api/locations
curl -s -H "X-Visitor-Key: $B" $BASE/api/locations            # → {"locations":[]}
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE -H "X-Visitor-Key: $B" $BASE/api/locations/1   # → 404
curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE/api/locations/1/refresh                     # → 404 (no key)
curl -s $BASE/api/locations                                    # → {"locations":[]}
```

## 3. Browser check (agent-browser)

Follow CLAUDE.md "Browser checks": start on `about:blank`, clear errors and console, and run `assert_clean` after each step. Use two sessions (`--session a`, `--session b`) against a temporary server:

1. Session A adds Tampines, and session B adds Jurong West. Each list and each map shows only its own place (SC-001).
2. Reload session A. Tampines is still there, and no weather request is made on load (SC-004, FR-007).
3. In session A, `agent-browser eval "localStorage.getItem('weather-starter.visitor.key')"` returns a 43-character value. That value appears in no console output and no `/api/logs` body (SC-006).
4. Open the privacy notice and confirm the new sentence (FR-013).
5. `scripts/e2e/town-search.sh` and `scripts/e2e/use-my-location.sh` pass after being updated to send the browser's key on their `curl` reads.

## 4. Owner claim (once, after deploy)

1. Open the hosted app in your own browser and add nothing. The list is empty, and the pre-feature places are hidden (US3 scenario 1).
2. In DevTools, copy `localStorage.getItem('weather-starter.visitor.key')`. It already exists, because the page's first list request created it.
3. On your machine, with the production `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` exported, run `npx tsx backend/src/claimLegacyCli.ts "$KEY" --remote` (not `npm run claim-legacy`: npm can take a key starting with `--` as its own option). Expect `database: hosted (Turso)`, then `claimed <n>, skipped 0`. The command never loads `.env`, and it refuses Turso without `--remote`.
4. Reload the hosted app. Your old places appear with their snapshots. A private window still shows an empty list (SC-008).
5. Run it again. Expect `claimed 0, skipped 0`.

## 5. Pre-launch capacity check (not a gate for merging)

Before promoting the URL publicly, decide the expected visitor count. With the Development key, every refresh shares one queue at about one full refresh every 10 s. If you expect more than a handful of people refreshing at once, request a Production key and set `WEATHER_API_RATE_LIMIT` (see `docs/deployment.md`).
