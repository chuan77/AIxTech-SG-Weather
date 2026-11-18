# Concept: Visitors share one saved-locations list

- **Slug**: per-visitor-saved-locations
- **Created**: 2026-11-17
- **Recommended option**: Option A, a private list per visitor kept on the server

## Options

### Option A: A private list per visitor kept on the server

- **Sketch**:
  - On a visitor's first save, their browser gets a random, unguessable private key, with no signup.
  - The server keeps saved locations and their snapshots as it does today, but each list is filed under its visitor's key. A visitor only ever sees, refreshes or deletes locations under their own key.
  - Coming back on the same browser shows the same list. A new browser or device starts empty (or with defaults; see Assumptions).
  - Weather fetching, the snapshot pattern and the single frontend store all stay as they are.
- **Appetite**: small to medium (about one week, budget only).
- **Trade-offs**:
  - **Wins:**
    - Meets G1 to G4 with the smallest change to how the app works.
    - Principle I still holds as written: snapshots are still stored server-side, and reading the list still makes no weather call. Principle II's single store is untouched.
    - The no-signup experience stays.
    - It leaves a path open for later. Showing a visitor their key as a "move my list to another device" code could add cross-device use without accounts.
  - **Sacrifices:**
    - The server still holds every visitor's saved coordinates, so the owner can see them. The existing privacy notice should say so.
    - Losing the browser's key loses access to the list (same outcome as Option B).
    - Rows for visitors who never return stay in the database until something removes them.
  - **Risks:**
    - The key works like a password. Leaking it (shared screenshot, copied link) exposes that one list.
    - If the key travels as a cookie, the existing bodyless POSTs (refresh, delete) could be triggered from other sites, so how it travels matters.
- **Rabbit holes**:
  - **Uniqueness:** today's rule that no two saved locations can share the same coordinates is global. It has to become "unique per visitor" without breaking the 409 duplicate behaviour or the existing rows.
  - **The 10 existing Turso rows:** decide whether they become the owner's list, defaults for new visitors, or are dropped.
  - **How the key travels:** a cookie versus an explicit request header. One choice opens a CSRF question; the other touches every API call in `api.ts`.
  - **Cleaning up abandoned lists**, or deciding not to.
  - **Upstream load:** two visitors who save the same town each pay 12 data.gov.sg calls per refresh. Sharing snapshots between visitors would cut that, but it is a separate design and should stay out unless G5 forces it.

### Option B: The list and its snapshots live in the browser (hosting Option B)

- **Sketch**:
  - Each visitor's saved locations and their latest snapshots are kept in that visitor's own browser storage.
  - The server stops keeping any list. It only fetches and returns a fresh snapshot for given coordinates when the visitor adds or refreshes a place.
  - Visitors never see each other's data because the server never holds it.
- **Appetite**: medium (one to two weeks, matching the hosting concept's estimate).
- **Trade-offs**:
  - **Wins:**
    - The strongest privacy: the server stores no visitor locations at all.
    - Turso becomes optional.
    - Server data doesn't grow with visitors.
  - **Sacrifices:**
    - Rewrites the data path the whole frontend relies on (store, map pins and every tile read stored snapshots).
    - Needs constitution amendments: Principle I says snapshots are "stored in SQLite" and that `GET /api/locations` reads them. Principle II's store would hold browser-persisted data.
  - **Risks:**
    - Browsers may evict script-written storage. Safari is known to clear it after about 7 days without a visit for sites not added to the home screen [ASSUMPTION: verify during specification]. That works against G4 for exactly the mobile users the release targets.
    - Snapshot shape changes (a new field like `uv_hourly`) would need migrating inside every visitor's browser, not in one database.
- **Rabbit holes**:
  - The constitution amendment.
  - Browser storage limits and eviction.
  - Versioning stored snapshots on the client.
  - Keeping Principle IV's real-limits testing when the store lives in the browser.
  - What happens to the seeded Turso rows.

### Option C: Don't build it, gate access instead (hosting Option C)

- **Sketch**:
  - Keep the one shared list.
  - Restrict who can open the hosted app, for example with a shared password or Vercel's deployment protection, so only people the owner chooses get in.
- **Appetite**: small (days).
- **Trade-offs**:
  - **Wins:** closes the exposure to strangers quickly, with almost no code.
  - **Sacrifices:**
    - Fails G1 and G2 for everyone allowed in, who still share and can delete one list.
    - Works against the public mobile release, which is for public users, and G3's no-signup spirit.
  - **Risks:** a shared password spreads like the URL does.
- **Rabbit holes**: whether Vercel Hobby offers usable protection for a container deployment [unverified].

## Recommendation

**Option A.**
- It meets every goal (G1 visitor sees only their own places, G2 can't change others', G3 no signup, G4 survives a return visit on the same device) with the smallest change, and keeps Principles I and II as written. Option B needs amendments to both.
- It avoids Option B's main risk to G4: browser eviction, which would hit mobile Safari users hardest.
- It hits the success metrics directly: zero foreign locations shown, zero foreign locations changeable, zero signups.

Option C is the fallback only if a public launch must happen before Option A is ready.

G5 (staying within the rate limit) is not solved by any option. Per-visitor lists raise upstream refresh traffic under A or B alike. Today all calls share one paced queue at about one full refresh per 10 s with the Development key, so more visitors means longer waits before it means 429s. Whether that's acceptable depends on the expected visitor count, which is still unknown.

## Out of Scope (for the recommended option)

- Accounts, signup, login and identity (problem non-goal).
- Moving a list to another device. The concept leaves room for a later "move my list" code, but it isn't part of this work.
- Shared or team lists.
- Storing lists or snapshots in the browser (Option B).
- Sharing weather snapshots between visitors who save the same place.
- Access gating (Option C).
- Requesting a Production data.gov.sg key (a separate decision; see Assumptions).
- Any change to weather data, snapshot contents, the map layers or the Principle I exceptions.

## Assumptions to Validate

- A list that lives on one browser, and is lost if that browser's key is lost, is acceptable for G4 (problem Open Question 1 and 4).
- The owner is comfortable with the server holding every visitor's saved coordinates, disclosed in the privacy notice.
- A new visitor's starting state (empty, or the 10 seeded locations as defaults) can be settled during specification. It doesn't change the option choice.
- The owner's current list can be kept by giving it to the owner's own key, or the owner accepts a reset (hosting already accepted occasional resets).
- Expected public visitors stay low enough that one shared paced queue on the Development key gives acceptable refresh waits. Otherwise a Production key (`WEATHER_API_RATE_LIMIT`) is needed before launch.
- The key can travel in a way that doesn't open CSRF on the bodyless refresh and delete routes.
- Turso free-plan limits (10M writes a month) stay ample when rows grow with visitors. This seems likely at the current scale.
