# Decision: Installable app, step A

- **Slug**: installable-app
- **Decided**: 2026-11-18
- **Verdict**: go
- **Artifacts reviewed**: research.md | problem.md | concept.md (no intake.md; the idea came from `next-value-features/research.md` candidate 2)

## Scorecard

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Problem validity | adequate | The app is meant to replace a phone weather app for public phone users (memory `public-mobile-release`, `frontend/PRODUCT.md`), yet it has no icon, opens in a browser frame and shows a browser error offline (research.md Prior Art, read from the code). The gap is real. Its cost is the owner's judgement, not a measured loss. |
| Evidence strength | adequate | Repo facts are high confidence and were checked on 2026-11-18. That includes the server already serving `frontend/dist` files with the right manifest type. Platform behaviour (Android install rules, the iPhone storage split) is unverified general knowledge, medium confidence. Demand is the owner's alone, as for every past go. That was accepted because the owner is the decision-maker (precedent: `use-my-location`, `vercel-web-analytics` decisions). The unverified platform facts change *how* the hint is worded and whether the offline helper is strictly needed, not whether the idea is worth doing. They are cheap to check first in specification. |
| Value vs. inaction | adequate | Inaction loses nothing that works today (problem.md Cost of Inaction). Option B gives a home-screen icon, an app-like open and an offline message for a small appetite. The value is modest but real for the stated audience, and the cost is low. |
| Feasibility / appetite | strong | Small appetite (a few days). No new dependency is needed. Vite copies `public/` as is. Express already serves the files with the correct type. `renderIndexHtml` leaves added head tags intact. Fallback Option A is smaller still. |
| Strategic fit | strong | Serves the public mobile release directly. It doesn't touch Principle I (no data.gov.sg calls), the injectable provider or the snapshot pattern. Fixed colours in the manifest can match existing theme tokens. Privacy statements stay true because nothing personal is stored on the device. |
| Risk posture | adequate | Both main risks are named and have mitigations. (1) A background offline helper outliving a deploy or rollback: mitigated by keeping only the offline page, never app files or `/api` responses, plus a switch-off path and a rollback drill. (2) iPhone users seeing an empty list after install: mitigated by telling them before they install. Moving the key across was deliberately dropped as a security feature of its own. The remaining risk: the iPhone storage split and Android install rules are unverified until specification checks them. |

## Verdict & Rationale

**Go, with Option B (install plus an offline page).** The problem is real for the audience the app now serves. The fix is small, and it sits within the constitution without any amendment. Evidence strength is adequate rather than strong. Feasibility rests on code read this session. The weaker evidence is about platform details and demand. The platform details affect wording and one technical requirement, and can be checked at the start of specification. Demand has been accepted on the owner's word for every go so far. No score is `unknown` or `weak`. The decisive constraint carried into specification is that **the offline helper keeps only the offline page**. That is what holds the deploy, rollback and privacy goals. If the owner later judges the offline message not worth a background helper, Option A is a ready fallback.

## If needs-clarification

Not applicable.

## If go — Handoff to `/speckit-specify`

- **Problem**: Phone users are meant to use this app instead of a phone weather app, but it is only a website. It has no icon of its own, opens in a browser frame, and shows a browser error when offline.
- **Chosen approach**: Option B from concept.md: install plus an offline page.
  - The app gets its own name, icon and theme colour.
  - Android offers to install it.
  - iPhone users get a one-time Add to Home Screen hint, which also tells them that the home-screen app starts with its own empty list of places.
  - The app opens full-screen.
  - With no connection, an app-styled "You're offline" page appears.
  - The offline helper keeps only that page and the files it needs, never the app's own files, saved places or weather.
- **In scope**:
  - Name, icons (including the iPhone touch icon and a favicon) and theme or background colours matching existing tokens.
  - Installability on Android and desktop Chrome/Edge.
  - The iPhone hint, with its wording about saved places.
  - The offline page.
  - A switch-off path for the offline helper.
  - A browser check of install readiness and the offline open.
  - A rollback drill.
- **Out of scope**:
  - Offline last snapshot or saved list (step B).
  - Keeping app code or `/api` responses on the device.
  - Moving the visitor key from Safari to the iPhone app.
  - App stores and native wrappers.
  - Push notifications.
  - Accounts or sync.
  - New data.gov.sg calls.
  - Dashboard redesign.
  - Measuring installs, unless the owner decides otherwise.
- **Success metrics** (pass/fail, as user numbers are under 5):
  - Android Chrome offers install and opens full-screen with the app's icon and name.
  - iPhone Add to Home Screen gives the app's icon and name, full-screen.
  - An offline open shows the app's offline page.
  - `npm run verify` and the existing `scripts/e2e/` checks pass, and no page error, rejection or `console.error` appears in the new checks.
  - After a rollback, online visitors get the rolled-back version on their next visit.
  - An iPhone user with places in Safari is told what will happen before installing (qualitative).
- **Carried-forward open questions**:
  1. Verify against current WebKit and Chrome documentation that iPhone home-screen apps get storage separate from Safari, and what Android Chrome requires today to offer install. Do this first, because it sets the hint wording and whether the offline helper is needed for install.
  2. The name under the icon: "Weather", "SG Weather" or "AIxTech SG Weather". Home-screen labels truncate at about 12 characters.
  3. Who makes the icon, given there is no logo. Is a simple mark in the theme colours acceptable?
  4. When and how often the iPhone hint appears (for example, once, and only after a place is saved).
  5. Whether to measure installs or standalone opens, given the "anonymous visit counts" promise.
  6. Whether `agent-browser` can emulate offline for the browser check. If not, find another way to test the offline open.
