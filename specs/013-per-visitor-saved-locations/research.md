# Research: Private Saved Locations per Visitor

Phase 0 for [plan.md](plan.md). Each item resolves an open technical choice from the spec or the assessment (`.specify/assessments/per-visitor-saved-locations/`). Repo facts were read from the working tree on 2026-11-17.

## R1. How the visitor key reaches the server

- **Decision**: a custom request header, `X-Visitor-Key`, added by `frontend/src/api.ts` to every `/api/locations*` request, including the keepalive delete in `deleteLocationOnUnload`. The key is kept in `localStorage`. No cookie is used.
- **Rationale**:
  - **FR-009 (no cross-site triggering).** A cross-site page can't attach a custom header without a CORS preflight. The app sends no CORS headers, because Principle II keeps it same-origin. So the browser blocks the preflight, and no other site can create, refresh or delete with a visitor's key. This also closes the gap the bodyless `POST /locations/:id/refresh` has today: as a "simple" request, it currently goes through cross-site.
  - **FR-013.** The privacy notice says "no cookies" (`PrivacyNotice.tsx`). A header plus `localStorage` keeps that true.
  - **FR-008.** `requestLogging.ts` already logs no headers (only id, method and url). The key never goes in a URL, so it doesn't reach request logs, Vercel's access logs or analytics, which strip the query and fragment anyway.
- **Alternatives considered**:
  - *`HttpOnly` `SameSite=Strict` cookie*: protects the key from page scripts. But it makes the notice's "no cookies" claim false, and it would need CSRF reasoning for the bodyless POST. Rejected for FR-013.
  - *Key in the URL path or query*: leaks into logs and history. Rejected for FR-008.

## R2. Who generates the key, and its format

- **Decision**:
  - The browser generates it: 32 random bytes from `crypto.getRandomValues`, base64url-encoded, giving 43 characters (`[A-Za-z0-9_-]{43}`).
  - The server accepts only that exact format. Anything else counts as "no key".
- **Rationale**:
  - The key is created with no network round trip, so Principle I and SC-005 (no extra steps) hold.
  - 256 bits can't be guessed.
  - A visitor choosing a weak key of their own only exposes their own list.
  - Validating the format keeps junk out of the database and logs.
- **Alternatives considered**:
  - *The server issues the key on first create*: needs an extra response field and a client race around "first save". It gives no extra security, since the browser holds the key either way.
  - *`crypto.randomUUID()`*: 122 bits, which is adequate, but the format is less strict and doesn't match the 43-character check.

## R3. Storing keys: hash, not plaintext

- **Decision**: the server stores `sha256(key)` as hex (`visitors.key_hash`), never the key itself. It looks visitors up by that hash.
- **Rationale**:
  - A leaked database or backup doesn't hand out working keys (FR-008 spirit).
  - The key has 256 bits of entropy, so a plain fast hash is enough. No salt or slow hash is needed, unlike passwords.
- **Alternatives considered**: *store the key in plaintext*: simpler, but a database read would grant access to every list. Rejected.

## R4. Data model shape

- **Decision**:
  - A new `visitors` table (`id`, `key_hash` unique, `created_at`, `last_used_at`).
  - `locations` gets a nullable `visitor_id` integer.
  - The global unique index on `(latitude, longitude)` is replaced by a unique index on `(visitor_id, latitude, longitude)`.
  - No foreign-key constraint. Deletes cascade in code.
- **Rationale**:
  - FR-012 needs a list-level "last used" time, so visitors need their own row.
  - A nullable `visitor_id` lets the pre-feature rows stay as they are (NULL = unclaimed) until the owner's step (FR-011).
  - SQLite treats NULLs as distinct in unique indexes, so unclaimed rows never collide with visitors' rows.
  - Leaving out the FK keeps the migration a plain `ALTER TABLE ... ADD COLUMN` plus index changes. Adding an FK to an existing SQLite table makes drizzle-kit rebuild the table (copy to `__new_locations`), which is riskier against the uploaded Turso history (the spec 010 rabbit hole).
- **Alternatives considered**:
  - *`owner_key_hash` text column on `locations` only*: no place for list-level `last_used_at`. The time would have to be per location, and "the list" would only exist implicitly.
  - *An FK with `ON DELETE CASCADE`*: needs `PRAGMA foreign_keys` on both adapters, and the table rebuild above.
- **To verify in implementation** (CLAUDE.md, Context7): check drizzle-kit 0.31's output for dropping and creating a unique index plus `ADD COLUMN`. It should be three or four plain statements, with no table rebuild.

## R5. Retention sweep (FR-012) without a scheduler

- **Decision**: purge visitors whose `last_used_at` is older than 90 days, together with their locations:
  - once when the app starts (after migrations);
  - then at most once every 6 hours per instance, kicked off in the background by the next `/api/locations*` request.
  - The purge never blocks a response, and a failure is logged and retried at the next window.
  - It makes no weather call.
  - Unclaimed (`visitor_id IS NULL`) rows are never purged, so the owner's step can't lose data.
- **Rationale**:
  - The Vercel container has no in-process scheduler guarantee, and a Vercel Cron would need a new authenticated endpoint.
  - An app nobody visits serves nobody, and every new instance sweeps at start. So no list "survives much past 90 days unused" while anyone can reach it (spec assumption).
- **Alternatives considered**:
  - *Vercel Cron hitting a protected endpoint*: a new secret and a new public route, for no gain at this scale.
  - *Purge on every request*: needless writes on Turso.

## R6. Recording "use" cheaply

- **Decision**: a request carrying a known key updates `visitors.last_used_at` only when the stored value is more than 1 hour old. A conditional `UPDATE ... WHERE last_used_at < ?` costs at most one write per visitor per hour. `GET /api/locations` with an unknown key does no write at all.
- **Rationale**: 1-hour precision is ample against a 90-day window, and it keeps writes far under Turso's 10M a month.

## R7. Missing, unknown or malformed key

- **Decision**:
  - `GET /api/locations` with no key, or a malformed key, returns `{ locations: [] }` with status 200 (spec edge case: treated as a new visitor, nothing revealed).
  - `GET`, `DELETE` and `POST .../refresh` on `/locations/:id` without a matching owner return the existing `404 Location not found`.
  - `POST /api/locations` without a valid key returns `400 { detail: 'A visitor key is required' }`. The frontend always sends one, so only scripts hit this.
  - The visitor row is created on the first successful create (insert if absent).
- **Rationale**:
  - FR-004 says "same outcome as not found", so ownership can't be probed.
  - Create needs somewhere to file the row.

## R8. Browser storage unavailable (FR-015)

- **Decision**: `visitorKey.ts` reads and writes `localStorage` inside `try/catch`. If storage throws or isn't available, it keeps a key in module memory for the life of the page. Places then work for that session and vanish after the tab closes.
- **Rationale**: matches the existing lightning and rain preference handling in `store.tsx`. It never falls back to a shared list.

## R9. The owner's one-off claim of the pre-feature rows (FR-011)

- **Decision**: a CLI script, `npm run claim-legacy -- <visitorKey> --remote`, run by the owner from their machine with the production Turso credentials in the environment.
  - It hashes the key, inserts the visitor row if missing, and sets `visitor_id` on every `visitor_id IS NULL` row whose coordinates don't already exist in that visitor's list. It skips and reports clashes instead of failing.
  - It prints only counts.
  - The owner copies their key from DevTools: `localStorage.getItem('weather-starter.visitor.key')`.
  - Running it again finds no NULL rows and changes nothing.
- **Rationale**:
  - "Only the owner can perform" is satisfied by needing the database credentials, with no public endpoint, token or attack surface added.
  - It's testable as a pure function over the db module (Principle IV).
- **Alternatives considered**: *a token-protected `POST /api/visitor/claim` route*: a new public endpoint and secret for a step that runs once. Rejected.
- **Spec note**: User Story 3 says the owner runs the step "from their browser". In practice the owner uses their browser's key and runs the step from a terminal. The spec's acceptance wording is adjusted to match (see plan "Spec adjustments").

## R10. What else must change to stay green

- `backend/src/routes/locations.test.ts` and other Supertest callers send no key. Each needs a helper that sets `X-Visitor-Key`, plus new two-visitor isolation tests (Principle VI).
- `scripts/e2e/town-search.sh` and `use-my-location.sh` `curl` `GET /api/locations` with no key, so they would now see an empty list. They must read the browser's key (`agent-browser eval "localStorage.getItem(...)"`) and send it. Stubbed checks (`network route`) are unaffected.
- `resetStore()` must also clear `visitors`.
- Interaction logs (`logInteraction`) carry no key today and must stay that way. `send()` adds the header, but `logInteraction` uses its own `fetch`.
- Docs: `docs/architecture.md` (storage and the snapshot pattern now scoped per visitor), and `docs/deployment.md` (the claim step and retention).

## R11. Upstream capacity (G5, carried forward)

- **Decision**: no change in this feature. The per-device limit (30 adds or refreshes per IP per 10 minutes) and the shared paced requester stay as they are (FR-014).
- **Rationale**: whether a Production key is needed is a launch decision (spec Assumptions). The plan records it in the quickstart's pre-launch check.
