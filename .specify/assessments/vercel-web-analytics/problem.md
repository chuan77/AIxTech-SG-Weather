# Problem Definition: No usage evidence for the public Lepak Weather app

- **Slug**: vercel-web-analytics
- **Created**: 2026-11-17
- **Inputs used**: research.md (no intake.md; the idea arrived as the owner's request "implement Vercel hobby plan web analytics" plus a dashboard screenshot)
- **Updated**: 2026-11-17, with the owner's answers to the open questions (see Resolved Decisions)

The input was a solution ("add Vercel Web Analytics"). This note states the problem behind it.

## Problem Statement

The owner is releasing Lepak Weather publicly as a replacement for a mobile weather app, but cannot see whether anyone visits, where they come from, or what devices they use. The only interaction record is an instance-local log that disappears within minutes, so every decision about what to build next is made without any observed usage.

## Affected Users & Stakeholders

- **Users**: the owner, as product decider and maintainer. They rank features and judge whether the public release is working with no traffic data. [source: research.md, Users & Demand; `next-value-features/research.md`]
- **Users (indirect)**: public visitors on laptop and mobile. They don't feel this problem directly, but they are affected by whatever is measured about them and by features chosen without evidence. [source: memory `public-mobile-release`]
- **Stakeholders**: the owner, also as the Vercel/Turso account holder. They decide whether any cost, quota use or plan upgrade is acceptable. The project runs as a free learning deploy. [source: memory `hosting-names`; research.md, Data & Constraints]
- **Stakeholders**: visitors' privacy interests. The project already chose not to log visitor IP, city or postcode. [source: `docs/deployment.md`]
- Only the owner reads the usage figures. [owner answer 2026-11-17]
- **Visitors (privacy)**: visitors are told, in a small, unobtrusive notice, that anonymous usage is measured. [source: owner answer 2026-11-17]

## Goals

- G1. The owner can tell whether the public app is being used at all, and how that changes week to week within the last month.
- G2. The owner can see where visitors arrive from and what devices or screen classes they use, to confirm that mobile matters as much as assumed.
- G3. Usage figures survive instance restarts and deploys, so they reflect the whole deployment, not one short-lived instance.
- G4. Visitor privacy stays consistent with the project's current stance: no new collection of personal identifiers.
- G4a. Visitors can find a short privacy notice that discloses the usage measurement, as PDPA requires. It must have a small footprint that doesn't compete with the weather content on laptop or mobile. [owner answer 2026-11-17]
- G5. Collecting usage data stays within what Vercel's Hobby plan Web Analytics provides: no paid plan, no extra vendor. It adds no meaningful load or failure risk to the app. [owner answer 2026-11-17]

## Non-Goals

- Measuring which features are used (map layers, Use my location, refresh, town search). The owner confirmed it isn't needed (2026-11-17).
- Analytics beyond Vercel's Hobby Web Analytics offering: Pro, Web Analytics Plus, custom events, UTM, or a third-party analytics vendor.
- Trends beyond Hobby's 1-month reporting window, including exporting or archiving monthly figures. [owner answer 2026-11-17]
- Performance or Core Web Vitals monitoring.
- Per-user tracking, accounts, cookies or cross-session identity.
- Marketing attribution (campaigns, UTM tags) or A/B testing.
- Monitoring errors or server health (the `/health` smoke check and logs already cover part of this).
- Reworking the existing interaction logging or the request-log privacy rules.
- Showing usage figures inside the app, or to anyone but the owner.
- Defining targets or decision thresholds from the numbers (collect first, analyse later).

## Success Metrics

- Daily and weekly visitor counts for the production URL are visible to the owner within a day of a visit. (baseline: none; no traffic figures exist)
- Device split (mobile vs desktop) and top referrers are visible. (baseline: none; the mobile-first assumption is unmeasured)
- Counts keep accruing across deploys, rollbacks and cold starts, with no gap that coincides with an instance restart. (baseline: the interaction log is lost every ~5 idle minutes)
- No new personal identifiers stored by the app, and no cookie banner needed. Qualitative check against `docs/deployment.md` privacy notes. (baseline: compliant today)
- Monthly running cost stays $0 and data collection doesn't stop mid-month from a quota cap. (baseline: $0; quota use unknown)
- A privacy notice that mentions usage measurement is reachable from every view on laptop and at 375 px mobile, without pushing weather content down. Qualitative design check. (baseline: no notice exists)

## Cost of Inaction

The app goes public with no way to know whether anyone uses it, whether mobile visitors dominate, or whether a release changed anything. Feature choices remain the owner's guesswork, as the `next-value-features` research already flags. The cost is mainly decision quality, not user harm: the app works the same for visitors either way. With fewer than 5 visitors today, the loss is small now and grows as the URL spreads.

## Resolved Decisions (owner, 2026-11-17)

- **Feature usage is not needed.** Visitor, page-view, referrer and device counts are enough.
- **Scope is limited to Vercel Hobby Web Analytics.** No Pro upgrade, no custom events, no other analytics vendor. Whether it works behind the Container preset is still a technical unknown to confirm in shape or spec. The owner's answer set the scope, not that fact.
- **The 1-month look-back is accepted** as a Hobby limit. Longer trends are a non-goal.
- **Traffic is expected to stay under 50,000 events/month.** The owner will watch quota use in the Vercel dashboard; no in-app quota alerting is needed.
- **Only the owner reads the figures.** The Vercel dashboard is the only place they need to appear; there is no in-app or shared report.
- **No decision threshold yet.** The goal is to collect now and analyse later.
- **A PDPA privacy notice is required**, with a small footprint. Suggested: run the `impeccable` skill to evaluate the notice's placement and size on laptop and 375 px mobile once a design exists (shape/spec stage, not here).

## Open Questions

- [NEEDS CLARIFICATION: Does Vercel serve the Web Analytics script and collection routes in front of a Container-preset deployment, or do they fall through to Express's catch-all? Must be confirmed (preview deploy) before committing to the approach.]
