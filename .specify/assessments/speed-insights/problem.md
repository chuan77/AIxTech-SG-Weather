# Problem Definition: Real-user performance visibility for Lepak Weather

- **Slug**: speed-insights
- **Created**: 2026-11-20
- **Inputs used**: intake.md, research.md, owner answers (2026-11-20)

## Problem Statement

The owner has no way to see how the public deployment actually performs on real visitors' devices, and no hands-on experience of real-user performance measurement on this Vercel Container setup. At today's traffic, any field reading is likely to be dominated by the known container cold start (about 5 s after 5 idle minutes), which would hide the frontend's own performance. The problem matters now because the app is about to go public on laptops and phones.

Owner's framing (2026-11-20): the purpose is mainly a **learning exercise**, and cold starts should be **separated out** from frontend performance rather than folded into one number.

## Affected Users & Stakeholders

- **Users**:
  - The owner, as the developer and learner. They lack field performance data and want to learn how it's collected and read on this stack. [source: owner answers; `intake.md`]
  - Public visitors on mobile and desktop. They are indirectly affected: they experience slow loads or cold starts that no one currently measures. No visitor has reported slowness. [source: memory `public-mobile-release`; `research.md` Users & Demand]
- **Stakeholders**:
  - The owner, as sole decision-maker and payer. The hosting is a free learning deploy on Hobby. [source: memory `hosting-names`]
  - Visitors, as data subjects. Any measurement processes their device and network data under the app's stated "anonymous, no cookies" posture. [source: `research.md` Data & Constraints; `docs/deployment.md:146`]

## Goals

- The owner understands, from doing it, how real-user performance data is collected, scored and read for this app on the Vercel Container deploy.
- Real-visitor performance on the public deployment becomes visible, for mobile and desktop.
- Container wake-up (cold start) can be told apart from the frontend's own load and interaction performance, so neither hides the other.
- The app's existing privacy posture ("anonymous, no cookies", URLs stripped) and its local, test and browser-check hygiene stay intact.

## Non-Goals

- Paid plans or upgrades (Pro, Speed Insights Plus, other paid vendors). This is a free learning deploy. [source: memory `hosting-names`]
- Fixing performance problems. This is about seeing performance, not improving it. Any fix is a later, separate idea.
- Removing or reducing cold starts. That is a hosting decision already documented as a known limit. [source: `docs/deployment.md:153`]
- Performance targets, alerts or release gates based on the score.
- Feature-usage or visitor analytics. Web Analytics (spec 012) already covers visits.
- In-app display of performance figures to visitors.

## Success Metrics

- **Qualitative (learning):** the owner can explain where the field data comes from, what the score means and what it can't show on this plan. Baseline: not yet.
- **Data flows:** the public deployment produces real-visitor performance readings visible to the owner within a few days of release. Baseline: none (empty Speed Insights tab, 2026-11-20).
- **Cold start separated:** for a given period, the owner can say how much of the experience comes from cold starts and how much from the frontend. Baseline: one known lab figure only, about 5 s cold start and 5–25 ms warm requests. [source: `docs/deployment.md:153`]
- **No regressions in hygiene:** local runs, tests and e2e browser checks still make no third-party or Vercel-only requests and log no errors. Baseline: clean today. [source: `docs/deployment.md:141`]
- **Within free limits:** collection never pauses for exceeding the shared free allocation. Baseline: 0 of 10,000 events used. [source: `research.md` Data & Constraints]

## Cost of Inaction

Little direct harm. Visitors are few, and nobody has reported slowness. The owner keeps launching publicly without knowing how the app performs on real phones. Performance regressions from new features (map layers, PWA, lightning) would go unnoticed outside lab checks. The learning opportunity on this stack is lost, though lab tools such as Lighthouse or PageSpeed Insights remain available for free. [source: `research.md` Market & Context, Evidence Against]

## Open Questions

- [NEEDS CLARIFICATION: On Hobby, Speed Insights shows only the combined score (7-day window) with no per-metric view. Can cold start be separated from frontend performance within the free tier at all, or does the "separate them out" goal need another signal?]
- [NEEDS CLARIFICATION: Will traffic after the public launch give enough readings for a stable p75 score, and over what period?]
- [NEEDS CLARIFICATION: Is `/_vercel/speed-insights/*` served in front of the Container preset, as `/_vercel/insights/*` is? This needs a preview check.]
- [NEEDS CLARIFICATION: Does the privacy notice need widening to cover performance measurement (network speed, element attribution), and does Singapore's PDPA bear on it?]
- [NEEDS CLARIFICATION: What else on the account uses the shared free allocation?]
- [NEEDS CLARIFICATION: Do pricing "events" equal metrics-page "data points"?]
