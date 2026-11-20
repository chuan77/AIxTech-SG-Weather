# Decision: Vercel Speed Insights with cold and warm visits labelled apart (Hobby)

- **Slug**: speed-insights
- **Decided**: 2026-11-20
- **Verdict**: go (Option B, gated on the container route check)
- **Artifacts reviewed**: intake.md | research.md | problem.md | concept.md

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | adequate | Real and confirmed by the owner (2026-11-20). It's a learning exercise plus visibility of real-device performance before the public mobile release. There is no visitor-reported pain, so the impact is on the owner's understanding, not on users. |
| Evidence strength | adequate | Plan limits, RES scoring, privacy fields and package behaviour come from Vercel's docs and source (high). The sibling `/_vercel/insights/*` route is proven in front of the container. Still unproven: the `/_vercel/speed-insights/*` route on the container, per-route scores on the free tier, and sample size at current traffic. |
| Value vs. inaction | adequate | Inaction costs little (few visitors, no complaints), but the build is small and free. It delivers the learning goal and the first field data before launch. Lab tools alone would give no real-device data. |
| Feasibility / appetite | strong | Small appetite (a few days). It reuses the spec 012 gate, URL stripping and privacy notice pattern. Event use (3–5 per visit) is far under the 10,000 per 30 days free allocation at current traffic. |
| Strategic fit | adequate | Fits the public mobile release and the free learning deploy. It reuses the existing hosted-only measurement switch. Nothing in the constitution conflicts. Principle IV limits a component mount to browser checks, which the project already handles. |
| Risk posture | adequate | The risks are known and each has a fallback. Container route failure would show in a preview check before production. If the free tier shows no per-route breakdown, the warm lab baseline still separates cold start. The quota is far from reach and an overrun costs nothing. The privacy change is small (country, browser, OS, device, network speed, no IP or cookies) and handled by widening the notice. Residual risk: thin samples make the score noisy for a while. |

## Verdict & Rationale

**Go with Option B.** The problem is valid on the owner's own terms (learning, plus seeing performance with cold starts separated). The evidence is adequate: the facts that matter are sourced from Vercel, and the riskiest unknown, the container route, has a working sibling and can be checked on a preview before anything reaches production. Option A was rejected because on Hobby it produces one combined number that can't separate cold start from frontend, which defeats the owner's second goal. Option C rebuilds a free product and adds a public write path. Option D yields no field data and no learning. B is small, free and reversible (the existing measurement switch turns it off), and it degrades gracefully. Gate: if a preview shows that `/_vercel/speed-insights/script.js` is not served in front of the container, stop and return to shape rather than working around it.

## If go — Handoff to `/speckit-specify`

- **Problem**: The owner can't see how the public app performs on real visitors' devices, and hasn't yet worked hands-on with real-user performance measurement on this Vercel Container deploy. At current traffic, a field score would be dominated by the roughly 5 s cold start, hiding the frontend's own performance.
- **Chosen approach**: Option B.
  - Turn on Vercel Speed Insights (free Hobby tier) for hosted deployments only, under the same switch as Web Analytics (spec 012).
  - Strip reported URLs the same way.
  - Widen the privacy notice to cover performance measurement.
  - Label each page load as cold (first request on a freshly started instance) or warm through Speed Insights' route label, so scores can be compared.
  - Document a repeatable warm lab baseline (Lighthouse or PageSpeed Insights, mobile and desktop) for per-metric frontend figures.
- **In scope**:
  - Hosted-only loading.
  - Query and fragment stripping.
  - The cold/warm label.
  - Privacy notice wording.
  - Dashboard enablement and a preview route check.
  - A deployment-doc section (where to look, how to switch off, limits).
  - A documented manual lab baseline procedure.
- **Out of scope**:
  - Pro, Speed Insights Plus or Drains.
  - Fixing performance or cold starts.
  - Targets, alerts or CI budgets.
  - Automating the lab run.
  - Labels beyond cold/warm.
  - Feature analytics.
  - In-app figures.
  - Storing performance data in the app's database.
- **Success metrics**:
  - The owner can explain the data's source, its meaning and its free-tier limits (qualitative).
  - Real-visitor readings appear for production within a few days of release.
  - For a period, the owner can say how much of the experience is cold start and how much is frontend.
  - Local runs, tests and e2e checks still make no Vercel-only or third-party requests and log no errors.
  - Collection never pauses for exceeding the free allocation.
- **Carried-forward open questions**:
  - [NEEDS CLARIFICATION: Is `/_vercel/speed-insights/*` served in front of the Container preset? Check on a preview before production; this is the go gate.]
  - [NEEDS CLARIFICATION: Does the free tier show the score per route label? If not, the cold/warm split comes from the lab baseline alone.]
  - [NEEDS CLARIFICATION: How will the server judge "first request on a fresh instance" cheaply, and does labelling count extra events or distort scoring?]
  - [NEEDS CLARIFICATION: Does Vite's production build make the package load the `/_vercel/...` script, not the third-party debug script?]
  - [NEEDS CLARIFICATION: What exact privacy notice wording is needed, and does Singapore's PDPA bear on it?]
  - [NEEDS CLARIFICATION: What else on the account shares the 10,000-event allocation, and do pricing "events" equal "data points"?]
  - [NEEDS CLARIFICATION: Will post-launch traffic give a stable p75, and over what period?]
