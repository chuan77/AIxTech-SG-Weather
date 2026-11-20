# Idea Intake: Vercel Speed Insights for a Real Experience Score

- **Slug**: speed-insights
- **Created**: 2026-11-20
- **Source**: pasted text, plus a screenshot of the Vercel dashboard's Speed Insights "Get Started" panel
- **Type**: new-capability

## Idea (as captured)

> Implement Vercel SpeedInsight to capture Real Experience score.

The attached screenshot shows the project's Speed Insights tab in the Vercel dashboard (Production, Last 7 Days, Desktop/Mobile toggle) with no data yet and a three-step "Get Started" panel:

1. Install the package: `npm i @vercel/speed-insights`.
2. Add the `<SpeedInsights/>` component to the app's layout or main file. The panel's framework picker is set to **Next.js** and shows an `@vercel/speed-insights/next` import.
3. Deploy and visit the site to collect the first events ("If you don't see data after 30 seconds, check for content blockers and try to navigate between pages on your site").

## Restated

Turn on Vercel Speed Insights for the deployed weather app so that real visitors' page-load and interaction metrics are collected and summarised as a Real Experience Score in the Vercel dashboard.

## Origin & Context

- **Raised by**: the project owner (direct request in this session).
- **Trigger**: the Speed Insights tab in the Vercel dashboard is empty and prompting setup. [NEEDS CLARIFICATION: is there a specific prompt beyond the empty tab, such as a perceived slowness on mobile, the public release, or a wish to check recent PWA/map changes?]

Related context found in the repo (recorded, not evaluated):

- The frontend is React 18 + Vite 7, served by Express from one Vercel Container. It is not Next.js, although the dashboard panel's picker shows Next.js.
- `@vercel/analytics` 2.0.1 is already installed and mounted in `frontend/src/App.tsx`, with a URL-stripping `beforeSend` (`frontend/src/analytics/stripUrl.ts`).
- The earlier assessment `.specify/assessments/vercel-web-analytics/` reached "go" for Web Analytics and listed **Speed Insights as explicitly out of scope** at that time.
- Memory notes: the app is heading for a public mobile release, hosting is a free learning deploy (Vercel Container "lepak-weather").

## First-Glance Unknowns

- [NEEDS CLARIFICATION: Which Vercel plan is the project on, and what Speed Insights quota or cost applies to it (Hobby vs Pro data points, retention)?]
- [NEEDS CLARIFICATION: Does Speed Insights collection work for a Vite SPA served from a Vercel Container (not a static or Next.js deployment), as the Web Analytics route check had to confirm?]
- [NEEDS CLARIFICATION: What is the score for: a one-off baseline, ongoing monitoring, or a target to improve against? Is there a target score or threshold?]
- [NEEDS CLARIFICATION: Desktop, mobile or both? Mobile is the main public audience.]
- [NEEDS CLARIFICATION: With very low traffic (the Web Analytics assessment noted under 5 visitors), will there be enough samples for a meaningful score?]
- [NEEDS CLARIFICATION: Privacy: does Speed Insights send full URLs or other data that needs the same stripping as Web Analytics, and does the existing privacy notice need updating?]
- [NEEDS CLARIFICATION: Must it be enabled in the Vercel dashboard as well as in code, and does it interact with the PWA service worker or offline cache?]
- [NEEDS CLARIFICATION: Should it run only in production, or also on previews and local dev?]
