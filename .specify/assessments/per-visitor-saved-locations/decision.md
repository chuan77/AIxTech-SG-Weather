# Decision: Private saved-locations list per visitor

- **Slug**: per-visitor-saved-locations
- **Decided**: 2026-11-17
- **Verdict**: go
- **Artifacts reviewed**: problem.md, concept.md. There is no intake.md or research.md in this folder. The evidence comes from the sibling notes `../next-value-features/research.md` (candidate 1) and `../vercel-container-hosting/{problem,concept,decision}.md`, which problem.md cites.

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | strong | The shared list is a confirmed fact of the current design: one `locations` table, with no owner, read and changed by every visitor. The hosting decision recorded it as an accepted, unmitigated risk (G5) and named this "the next feature". The audience is now public (memory `public-mobile-release`). |
| Evidence strength | adequate | The exposure is established from the repo with high confidence (schema, routes, hosting decision). Demand is the owner's alone, as in every earlier go. No users, issues or analytics exist. Here that matters less, because the problem is a privacy and integrity gap, not a request for a feature. One concept claim is unverified: Safari clearing browser storage, which was used against Option B. |
| Value vs. inaction | strong | Without it, the URL can't be shared publicly in good conscience, which blocks the stated release goal. The only alternative is access gating (Option C), which shuts out the intended public users. The harm is small today with fewer than 5 visitors, but it grows with each one. |
| Feasibility / appetite | adequate | Option A is about one week. It keeps the snapshot pattern, the single store and the Turso setup. The known scope risks are bounded and named: making the coordinate-uniqueness rule per visitor, how the key travels, the 10 seeded rows, and cleaning up abandoned lists. None needs new infrastructure. |
| Strategic fit | strong | It serves the public mobile release and closes hosting G5. It keeps Principles I and II as written (Option B wouldn't), honours the owner's "per user eventually, no accounts now" non-goal, and leaves a path open to cross-device use later. |
| Risk posture | adequate | Key risks are identified, each with a direction: CSRF depends on how the key travels (decide in spec), a leaked key exposes one list only, and the server holds coordinates (disclose in the privacy notice). Upstream load (G5) is known but not mitigated by this option. It depends on the expected visitor count, which is unknown, with a Production key as the lever. |

## Verdict & Rationale

**Go, with Option A.** The problem is real and documented (strong). The evidence for the exposure is solid even though demand is owner-only (adequate). Leaving it means the public release can't proceed honestly (strong). Option A fits a week's appetite without constitution amendments. The remaining unknowns are product choices and capacity questions for specification, not reasons to stop:
- Is a list on one device enough?
- What does a new visitor see?
- What happens to the seeded rows?
- How many visitors are expected?

The one gap that this feature doesn't close is G5, upstream rate capacity. It must be checked against an expected visitor count before the URL is promoted publicly, and it doesn't block building.

## If needs-clarification

Not applicable.

## If go: Handoff to `/speckit-specify`

- **Problem**: Every visitor to the hosted Lepak Weather app sees, and can change or delete, one shared saved-locations list. That exposes where others saved places and lets visitors undo each other's lists, which blocks the public mobile release.
- **Chosen approach**: Option A, a private list per visitor kept on the server.
  - On first save, a visitor's browser gets a random, unguessable private key, with no signup.
  - The server files saved locations and snapshots under that key, and lets a visitor see, refresh or delete only their own.
  - The snapshot pattern (Principle I) and the single frontend store (Principle II) stay as they are.
- **In scope**:
  - Issuing and keeping a per-visitor key in the browser.
  - Scoping every saved-location read, create, refresh and delete to that key.
  - Making the duplicate-coordinates rule per visitor while keeping the 409 behaviour.
  - Deciding what happens to the 10 existing Turso rows.
  - A key transport that doesn't open CSRF on the bodyless refresh and delete routes.
  - Updating the privacy notice to say the server stores saved coordinates.
  - Tests showing that one visitor can't read or change another's locations.
- **Out of scope**:
  - Accounts, signup and login.
  - Moving a list to another device. Room is left for a later "move my list" code.
  - Shared or team lists.
  - Browser-stored lists or snapshots (Option B).
  - Sharing snapshots between visitors.
  - Access gating (Option C).
  - Requesting a Production data.gov.sg key.
  - Any change to weather data, snapshot contents or map layers.
- **Success metrics**:
  - Other visitors' locations shown in a visitor's list: 0.
  - Other visitors' locations a visitor can change or delete: 0.
  - Signups required: 0.
  - A visitor's list is still there after closing and reopening on the same browser.
  - data.gov.sg 429s at the expected visitor count: 0.
  - The owner is comfortable sharing the URL publicly (qualitative).
- **Carried-forward open questions** (answer during `/speckit-specify` or `/speckit-clarify`):
  - Is a list on one browser enough, accepting that a lost key loses the list? Cross-device use would need identity, which conflicts with the no-accounts non-goal.
  - What does a first-time visitor see: an empty list or the 10 seeded locations as defaults? And what happens to the existing Turso rows: do they become the owner's list, become defaults, or get dropped?
  - Should the owner's current list be kept, and how does it become theirs?
  - How many public visitors are expected, and will a Production data.gov.sg key be requested before promoting the URL? This must be answered before a public launch, not before building.
  - Cookie or request header for the key, given CSRF on the bodyless POSTs.
  - Should abandoned lists be cleaned up, and after how long?
  - Which mobile app is being replaced (sets expectations for saved places)?
  - Turso write headroom as rows grow with visitors (expected to be ample: 10M writes a month free).
