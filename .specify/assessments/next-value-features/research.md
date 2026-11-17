# Idea Research: Which medium- or high-value features are left to build

- **Slug**: next-value-features
- **Created**: 2026-11-17
- **Input**: "any medium or high value features". There is no intake note. The idea is read as: survey what has shipped, then list the candidates still unbuilt that earlier evidence rates Medium value or higher, with fresh evidence for and against each.
- **Evidence confidence (overall)**: medium. What has shipped, what was deferred and the platform constraints all come from repo artifacts (high confidence). Demand is still the owner's alone. The public mobile release (memory `public-mobile-release`) raises the value of some candidates, but there are no outside users, analytics or issues yet. No web pages were fetched in this session.

## What Has Already Shipped (baseline)

Most of the Medium+ candidates from the 2026-11-13 survey (`nea-data-new-features/research.md`) are already built, so they are not candidates here:

| Earlier candidate | Status | Source |
|---|---|---|
| WBGT heat-stress tile | shipped, spec 005 (PR #1) | `specs/005-wbgt-heat-stress-tile` |
| Feels like, sun times, PSI breakdown | shipped, spec 004 | `specs/004-outdoor-comfort-tiles` |
| UV hourly trend | shipped, spec 008 (PR #3) | `specs/008-uv-hourly-trend` |
| Station map layers, step 1 (rain) | shipped, spec 011 (PR #15, merged 2026-11-17) | `specs/011-island-rain-view` |
| Town name search | code is on `main` (commit `bdf8b9c`), **but PR #2 is still OPEN** | `git log main`; `gh pr list` |
| Use my location, lightning grouping, hosting | shipped, specs 003, 009, 010 | `specs/` |

- Housekeeping, not a feature: PR #2 (`006-town-name-search`) shows as OPEN and MERGEABLE although its commit is already on `main`. It's probably stale and could be closed. — [source: `gh pr view 2`, `git log main`] (confidence: high)

## Candidate Features (ranked table)

Priority is a suggested order to consider, based only on the evidence below. It is not a decision. Effort and Value are researcher estimates (ASSUMPTION unless cited).

| Priority | Feature | Effort | Value | Already-recorded status |
|---|---|---|---|---|
| 1 | **Per-visitor saved locations** (hosting Option B): each visitor's list stays in their own browser, so visitors no longer share one list | Medium. Moves the saved list and its snapshots from the shared Turso table to the browser, while weather fetching stays on the server | **High** for a public release. Today anyone with the URL sees and edits the same list | Named "the next feature" in `vercel-container-hosting` decision; accepted risk G5 is open until it ships |
| 2 | **Installable app (PWA basics)**: web manifest, icons, home-screen install and an app shell that opens offline showing the last snapshot | Low–Medium. No manifest, icon or service worker exists today | **Medium–High.** The app is meant to *replace a mobile weather app*, and "add to home screen" is the nearest a web app gets to that | Not assessed before |
| 3 | **Station map layers, step 2 (temperature and wind)** | Low–Medium. Reuses the spec 011 pattern (shared 2-min cache, user-triggered fetch, Layers menu) | Medium. Only proceeds "if rain proves useful" | Gated in `station-reading-map-layers` decision; needs OQ7 (NEA update cadence) |
| 4 | **"Rain near this location now"** on the saved-location hero: combines the 2-hour forecast with the island-rain readings and lightning strikes within N km | Medium. Joins two data sets that are already fetched. Lightning spec 002 put alerts and distance-to-strike out of scope, so it needs a new decision | Medium–High. Answers the main question people use myENV for, at their own spot | Earlier research Priority 6 (Medium). Not built, and push alerts were ruled out |
| 5 | **"Unusual for this time of year" context** on temperature, rain and PSI tiles, from an offline climatology lookup | Low–Medium. Offline build, then a pure-TS lookup with no new data.gov.sg calls | Medium. No common Singapore app shows this (ASSUMPTION) | `ai-ml-historical-model` Priority 1. Research only: no problem, concept or decision yet |
| 6 | **2-hour forecast reliability per area** | Medium | Medium. Gives honest context for the forecast hero, and is the baseline any nowcast would have to beat | `ai-ml-historical-model` Priority 2. Research only |

Left out as below Medium or unverified: flood / water-level alerts (PUB) and dengue clusters (both UNVERIFIED on data.gov.sg; dengue Low–Medium), historical charts (High effort and conflicts with Principle I), a local rain nowcast (High effort, value unproven against NEA), a modelled WBGT estimate (medically sensitive), and access gating (hosting Option C, a fallback to Option B rather than a feature).

## Users & Demand

- The audience changed on 2026-11-16 from the owner alone to public users on laptop and mobile, as a replacement for a mobile weather app. Which app, and how many users, are still unknown. — [source: memory `public-mobile-release`] (confidence: high that this was said; low on scale)
- The current launch is fewer than 5 users on a Development key. — [source: `specs/011-island-rain-view/spec.md` Assumptions, owner 2026-11-17] (confidence: high)
- No GitHub issues exist for the repo, so there are no user requests. — [source: `gh issue list --repo chuan77/AIxTech-SG-Weather --state all` returned nothing] (confidence: high)
- Every past go decision rated demand "adequate on the owner's confirmation only". The same will apply here unless real users are asked. — [source: decisions for `use-my-location`, `location-name-search`, `nea-data-new-features`, `station-reading-map-layers`] (confidence: high)
- Candidate 1 has the strongest signal of the set: an accepted, named risk ("the shared list is open to anyone who gets the URL until Option B ships") and an explicit "next feature" label. — [source: `vercel-container-hosting/decision.md`] (confidence: high)
- Candidate 2's demand is inferred from "replaces a mobile app". Nobody has asked for install or offline. — [ASSUMPTION] (confidence: medium)

## Prior Art

- **Hosting Option B** was already shaped as a concept: the list and its snapshots live in each visitor's browser, there is no signup, and clearing browser data clears the list. — [source: `vercel-container-hosting/concept.md` lines 32–36] (confidence: high)
- **Browser storage precedent**: the app already keeps per-viewer UI state in `localStorage` (lightning on/off `weather-starter.lightning.enabled`; the rain layer's remembered state). There is no precedent yet for storing *data* such as saved locations in the browser. — [source: `docs/architecture.md`] (confidence: high)
- **Island-wide layer pattern** (user-triggered fetch, 2-min shared cache, "unavailable" state, amendment on lightning's terms) is proven twice, in specs 002/009 and 011. Candidates 3 and 4 can reuse it. — [source: `docs/architecture.md`; `specs/011-island-rain-view/spec.md`] (confidence: high)
- **Step-and-gate delivery** (build a cheap step 1, then judge it before step 2) worked for WBGT and is in use for station layers. — [source: `nea-data-new-features/decision.md` Step 2 gate] (confidence: high)
- **PWA**: no prior art in the repo. `frontend/index.html` has only a viewport meta tag, there is no `frontend/public/` folder, and the source has no manifest or service worker. — [source: repo grep] (confidence: high)
- **Per-device rate limits** on costly routes already exist (PR #6), plus a Vercel firewall rule (commit `4f231be`). These matter once each visitor refreshes their own list. — [source: `gh pr list`, `git log`] (confidence: high)

## Market & Context

- Mobile users expect a home-screen icon and an instant open. A browser tab is a weaker replacement for an installed app. — [ASSUMPTION] (confidence: medium)
- NEA's myENV app covers radar, warnings and push alerts. This app can't match push alerts without a new platform, so candidate 4 is an on-screen indicator only. — [source: `nea-data-new-features/research.md` Market & Context, itself an ASSUMPTION] (confidence: low)
- Cost of doing nothing on candidate 1: as the URL spreads, visitors overwrite and delete each other's locations, and the location list exposes what others searched for (where they live or work). — [source: `vercel-container-hosting/decision.md` G5; the privacy angle is an ASSUMPTION] (confidence: medium)
- Cost of doing nothing on the others: low. The app keeps working. — [ASSUMPTION] (confidence: medium)

## Data & Constraints

- **Rate budget scales with visitors.** A refresh makes about 10+ paced data.gov.sg calls. Dev key: 12 requests per 10 s. If each visitor has their own list (candidate 1), refresh traffic grows with the number of visitors instead of with one shared list. — [source: sg-weather-api skill; `nea-data-new-features/research.md` Data & Constraints] (confidence: high)
- **Principle I** (no data.gov.sg calls on page load) applies to all candidates. Candidate 2's offline shell must show stored snapshots and not fetch on open. Candidate 4 must use only data already fetched by a user action. — [source: `.specify/memory/constitution.md`] (confidence: high)
- **Lightning spec 002** puts alerts and distance-to-strike out of scope. Candidate 4 would reopen that. — [source: `nea-data-new-features/research.md` Priority 6] (confidence: high)
- **Turso** already holds the 10 seeded locations. Candidate 1 needs a decision on what happens to them: migrate them, keep them as defaults, or drop them. — [source: `vercel-container-hosting/concept.md` line 7] (confidence: high)
- **Service worker caching** on a Vercel container behind a firewall rule needs care so it never serves stale API responses as fresh. — [ASSUMPTION] (confidence: low)
- **Historical data** for candidates 5 and 6 means downloading about 1.2 GB a year of rainfall CSVs at 5 requests per minute. The raw data isn't quality-controlled. — [source: `ai-ml-historical-model/research.md` Evidence Against] (confidence: high)
- Sample dumps in `RealtimeWeatherReadingsacrossSingapore/` (temperature, rainfall, humidity, wind direction and speed) are available for shaping candidate 3 but must not be committed. — [source: directory listing; `CLAUDE.md`] (confidence: high)

## Evidence Against the Idea

- **Demand is still unobserved for every candidate.** No issues, no analytics, no users interviewed. The ranking reflects deferred work and the public release goal, not measured need. — [source: empty issue list] (confidence: high)
- **Candidate 1 may increase upstream load and 429 risk.** With one shared list, refresh traffic is bounded. With per-visitor lists it grows with every visitor, on a Development key sized for fewer than 5 users. — [source: Data & Constraints] (confidence: medium)
- **Candidate 1 moves data off the server.** Lists disappear when users clear browser data and don't sync across devices. Some users may see that as worse than today. — [source: `vercel-container-hosting/concept.md` Option B sketch] (confidence: medium)
- **Candidate 2 overlaps with what browsers already do.** Mobile browsers can bookmark to the home screen without a manifest, so the extra value is offline open and polish, not a new capability. A service worker also adds a class of stale-cache bugs. — [ASSUMPTION] (confidence: medium)
- **Candidate 3 is explicitly gated** on rain proving useful, and rain only merged today (2026-11-17). Specifying it now skips the gate. — [source: `station-reading-map-layers/decision.md`] (confidence: high)
- **Candidate 4 reverses a scoped-out decision** (spec 002), and a "rain near you" indicator without push alerts may disappoint users who expect myENV-style alerts. — [source: spec 002 scope; ASSUMPTION on expectations] (confidence: medium)
- **Candidates 5 and 6 carry a data pipeline** that is large compared with the app, and the source data isn't quality-controlled. — [source: `ai-ml-historical-model/research.md`] (confidence: high)

## Gaps & Open Questions

- [NEEDS CLARIFICATION: Which one candidate should go forward to `/speckit-assess-define`? The process assesses one idea at a time, so this survey should be narrowed or split into its own slugs.]
- [NEEDS CLARIFICATION: Expected public user count, and whether a Production data.gov.sg key will be requested. This changes the cost of candidate 1 and every layer.]
- [NEEDS CLARIFICATION: Which mobile app is being replaced, and which of its features users would miss most? That is the best available demand signal for candidates 2 and 4.]
- [NEEDS CLARIFICATION: For candidate 1, should lists sync across devices (needs identity) or is browser-only acceptable? What happens to the 10 seeded Turso locations?]
- [NEEDS CLARIFICATION: Has the owner judged the rain view useful? That opens the gate for candidate 3.]
- [NEEDS CLARIFICATION: Should PR #2 be closed as already landed on `main`?]

## Sources

- Repo: `.specify/assessments/*/{research,concept,decision}.md` (all 9 earlier assessments), `specs/001`–`011`, `docs/architecture.md`, `.specify/memory/constitution.md`, `frontend/index.html`, `frontend/src/components/`, `CLAUDE.md`
- Memory: `public-mobile-release.md`
- GitHub (authenticated `gh` CLI): issue and PR lists for `chuan77/AIxTech-SG-Weather` (host: github.com, policy: allowlisted)
- Local skill: `~/.claude/skills/sg-weather-api/` (rate limits, endpoints; verified live 2026-11-11, not re-fetched)
- Web: no pages fetched in this session.
