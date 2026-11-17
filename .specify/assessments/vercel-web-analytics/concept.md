# Concept: Vercel Web Analytics (Hobby) with a small privacy notice

- **Slug**: vercel-web-analytics
- **Created**: 2026-11-17
- **Recommended option**: Option A — Prove the route, then turn on Hobby Web Analytics with a one-line notice

Inputs: `problem.md` (with the owner's Resolved Decisions of 2026-11-17) and `research.md`. The options are bounded by the owner's decisions: Hobby Web Analytics only, visitor/referrer/device counts only, 1-month window accepted, only the owner reads the figures, and a PDPA notice with a small footprint is required.

## Options

### Option A — Prove the route, then turn on Hobby Web Analytics with a one-line notice

- **Sketch**: First, a throwaway preview deploy answers the one open question: does Vercel serve its analytics script and collection path in front of the Container deployment, or do those requests fall through to the app? If they work, the production app starts reporting anonymous page views to Vercel Web Analytics, and the owner reads visitors, referrers, countries and device/OS/browser split in the Vercel dashboard they already have open. Visitors see one short, muted line beside the existing "Weather for … · source" credit, for example "Anonymous visit counts by Vercel Web Analytics · no cookies". It links to, or expands into, a few sentences covering what is counted, by whom, and that nothing identifies them. Local development and test runs report nothing.
- **Appetite**: small (days), including the preview-deploy check.
- **Trade-offs**:
  - Wins: meets G1, G2, G3 (counts are held by Vercel, not the short-lived instance), G4 (cookieless, daily-reset hash, no new identifiers in the app), G4a and G5 ($0, no new vendor, one same-origin script). It uses the dashboard the owner already has.
  - Sacrifices: 1-month window (accepted); no feature usage (accepted); undercounts visitors with ad/content blockers; single-URL app, so "pages" shows one row.
  - Risks: the container-route unknown (handled by doing the check first); the shared 50k/month cap pausing collection (owner monitors); the notice's wording and placement need care to satisfy PDPA without adding clutter.
- **Rabbit holes**:
  - **The container route fails.** If Vercel's analytics paths don't reach visitors, workarounds (having the app forward analytics traffic itself, or hand-wiring script paths) are unsupported territory. Treat that as a stop-and-reassess point, not something to push through.
  - **Notice reachability.** The existing credit line lives in the selected-location footer, which doesn't render when nothing is saved (empty state) and sits at the bottom of the page on phones. "Reachable from every view" may need a second spot. Run `impeccable` on the placement at 375 px and on laptop before settling.
  - **Legal wording.** Drafting a full privacy policy is out of appetite. Keep it to a plain-language disclosure; a formal policy is a separate decision.
  - **Build-time package behaviour inside the Docker build** (the generated script path) may need the simpler script-tag approach. Settle it in spec, not here.

### Option B — Do nothing in the app; use what the Vercel dashboard already shows

- **Sketch**: No code change and no notice. The owner reads the request and traffic figures Vercel's project dashboard already shows for the deployment (observability/usage pages) to judge whether anyone is visiting.
- **Appetite**: none (zero build).
- **Trade-offs**:
  - Wins: no privacy notice needed beyond today's, no risk to the app, no quota consumption.
  - Sacrifices: doesn't meet G2. There are no referrers or device split, and request counts mix page loads with API calls, health checks and bots, so "visitors" can't be read off them. Leaves the owner's request unmet.
- **Rabbit holes**: what Hobby's dashboard actually exposes for a Container deployment, and for how long, is unverified (ASSUMPTION). It could turn out to show almost nothing.

### Option C — Count page views in the app's own database (fallback only)

- **Sketch**: The app records a minimal anonymous page-view counter (day, device class, referrer host) in Turso and the owner queries it. Visitors see the same small notice as in A.
- **Appetite**: medium (a week or two): storage, privacy-safe bucketing, rate limiting, a way to read it, and tests.
- **Trade-offs**:
  - Wins: works regardless of the container question; history is unlimited; not affected by ad blockers.
  - Sacrifices: **outside the owner's stated scope** (Hobby Web Analytics only); rebuilds what Vercel provides; adds write load to Turso and new abuse surface on a public URL; bot filtering becomes the project's problem.
- **Rabbit holes**: bot filtering, unique-visitor counting without identifiers, abuse limits, and a reporting view. Each one grows.
- Kept here only as the documented fallback if Option A's route check fails and the owner then chooses to widen scope.

## Recommendation

**Option A.** It is the only option that meets every goal within the owner's constraints: counts that survive restarts (G3), referrers and device split (G2), $0 on Hobby with no new vendor (G5), and a cookieless model that matches the project's privacy stance (G4) with a small disclosure (G4a). It is small, and its one serious unknown can be settled cheaply before any production change: **make the preview-deploy route check the first step, and stop if it fails.** If it fails, return to `/speckit-assess-decide` with Option B (accept no analytics) or Option C (owner widens scope) rather than improvising a workaround.

## Out of Scope (for the recommended option)

- Feature-usage measurement, custom events, UTM/campaign tags (Pro or Plus only; owner said not needed).
- Pro, Web Analytics Plus, or any other analytics vendor.
- Trends beyond the 1-month Hobby window, including exports or archives.
- Showing usage figures in the app or to anyone but the owner.
- Targets or decision thresholds.
- Speed Insights / Core Web Vitals.
- A full legal privacy policy or cookie banner (none needed: no cookies). Only a short plain-language disclosure.
- Changes to the existing `/api/logs` interaction logging or request-log privacy rules.
- In-app quota alerting (the owner monitors the dashboard).

## Assumptions to Validate

- Vercel serves the Web Analytics script and collection paths in front of a Container-preset deployment, ahead of the app's catch-all route. **Blocking. Verify on a preview deploy first.**
- Enabling Web Analytics in the dashboard (already done, per the screenshot) plus the next deploy is enough to activate the routes for this project.
- Traffic stays under 50,000 events/month across the whole account (owner expectation; owner monitors).
- A short, visible plain-language disclosure (what's counted, by Vercel, no cookies, nothing identifying) satisfies the owner's PDPA reading. Not legal advice; the owner accepts the wording.
- The analytics client stays inert in local dev, tests and the e2e browser checks, so they neither send data nor raise console errors (the e2e `assert_clean` gate fails on any `console.error`).
- The notice can be placed so it is reachable from every view, including the empty state, at 375 px and on laptop without pushing weather content down (check with `impeccable`).
- Ad/content-blocker undercounting is acceptable for "is anyone using it" questions.
