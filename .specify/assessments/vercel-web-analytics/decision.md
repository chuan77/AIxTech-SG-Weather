# Decision: Vercel Web Analytics (Hobby) with a small privacy notice

- **Slug**: vercel-web-analytics
- **Decided**: 2026-11-17
- **Verdict**: go (Option A, gated on the container route check)
- **Artifacts reviewed**: research.md | problem.md | concept.md (no intake.md)

The owner chose Option A when invoking this stage ("go for Option A"). The scorecard below checks that choice against the artifacts.

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | adequate | Real and confirmed by the owner: the app is going public with zero usage data, and the only interaction log is lost with each instance. Impact is on decision quality, not on visitors, and small while traffic is under 5 visitors. |
| Evidence strength | adequate | Plan limits, privacy model and integration paths come from Vercel's own docs (high confidence). Demand is the owner's alone, which is enough for an owner-facing tool. The one weak point, container routing, is a technical unknown with a cheap, decisive test, not a gap in the case for the idea. |
| Value vs. inaction | adequate | Moves usage from "none" to visitors, referrers and devices at $0. Doing nothing costs little today but grows as the URL spreads and features keep being chosen blind. |
| Feasibility / appetite | strong | Small appetite (days). The approach is Vercel's documented path for plain React/HTML, plus one line of UI copy. No backend, schema or data-flow change. |
| Strategic fit | strong | Fits the public mobile release, the $0 Hobby deploy, and the project's privacy stance (cookieless, no identifiers in the app). It doesn't touch Principle I (snapshot-only weather) or the injectable provider. The frontend stays theme-token driven. |
| Risk posture | adequate | The main risk (analytics routes not reaching the Container) is identified and mitigated by a check-first gate with a defined stop. Quota cap: the owner monitors it. Blocker undercount: accepted. Notice placement: an `impeccable` review is planned. Residual: the Container runtime is in beta, and PDPA wording is the owner's judgement, not legal advice. |

No criterion is `weak` or `unknown`.

## Verdict & Rationale

**Go, with Option A.** The problem is real for the owner, the evidence on the solution comes from first-party docs, and the option is small, $0, within the owner's Hobby-only scope, and consistent with the project's privacy stance. The only material unknown, whether Vercel's analytics paths are served in front of a Container-preset deployment, is turned into the first gate rather than left as an assumption. **If the preview-deploy check shows the paths fall through to the app, the feature stops** and comes back to this assessment to choose between Option B (no analytics) and Option C (own counter; needs the owner to widen scope). No workaround is to be improvised in delivery.

## If needs-clarification

- Not applicable.

## If go — Handoff to `/speckit-specify`

- **Problem**: The owner is releasing Lepak Weather publicly but cannot see whether anyone visits, where they come from, or what devices they use. The only interaction log disappears with each instance.
- **Chosen approach**: Option A.
  1. **Gate first:** a preview deploy confirms the Web Analytics script and collection paths return Vercel's responses, not the app's `index.html`. Stop if they don't.
  2. Production reports anonymous page views to Vercel Web Analytics (Hobby). The owner reads them in the Vercel dashboard. Local dev, tests and e2e checks send nothing and log no console errors.
  3. Visitors get a one-line, muted disclosure (anonymous visit counts by Vercel Web Analytics, no cookies) with a short expandable or linked explanation. It must be reachable from every view, including the empty state, at 375 px and on laptop. Placement is reviewed with `impeccable`.
- **In scope**: the route check; enabling Web Analytics for the production deployment; the privacy disclosure; keeping local, test and e2e runs clean; a short note in `docs/deployment.md` (where figures live, the 50k/month cap, and the 1-month window).
- **Out of scope**: feature usage, custom events and UTM tags; Pro, Plus or other vendors; history beyond 1 month; in-app figures; targets and thresholds; Speed Insights; a full legal policy or cookie banner; changes to `/api/logs` or request logging; in-app quota alerts.
- **Success metrics**: visitor counts visible within a day; device split and top referrers visible; no gaps across deploys, rollbacks or cold starts; no new identifiers stored by the app and no cookie banner; $0 with no mid-month pause; notice reachable from every view on laptop and at 375 px without pushing weather content down.
- **Carried-forward open questions**:
  - Do the analytics paths reach the Container deployment? (The gate answers this.)
  - Package component vs. plain script tag, given the image is built in Docker and Vercel doesn't pass project settings into that build. Decide in plan.
  - Exact notice wording and placement, including the empty state when no location is saved (`Hero` returns early, so the existing footer credit isn't rendered).
