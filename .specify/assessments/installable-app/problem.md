# Problem Definition: The app doesn't feel like a phone app

- **Slug**: installable-app
- **Created**: 2026-11-18
- **Inputs used**: research.md (no intake.md; the idea came from `next-value-features/research.md` candidate 2 and the owner's choice of step A on 2026-11-18)

## Problem Statement

People in Singapore who check the weather on their phone just before heading out are meant to use this app *instead of* a phone weather app. Today it is only a website, though. Reaching it means opening a browser and finding a tab or bookmark. It opens with the browser bar around it, has no icon of its own, and with no connection it shows only the browser's error page. This matters now because the app has just moved from one owner to public users on laptop and mobile, and it gives them each their own saved places (spec 013), so returning to it is now the main way it gets used.

## Affected Users & Stakeholders

- **Users**:
  - **Phone users in Singapore checking a saved place before going out**: their glance takes extra steps, and the app looks like a web page rather than an app. — [source: `frontend/PRODUCT.md` Users and Operating Context; memory `public-mobile-release`]
  - **iPhone users who already saved places in Safari**: on iPhone, putting the app on the home screen may give it separate storage, so they could lose sight of the places they saved. Any answer must not make things worse for them. — [source: research.md Data & Constraints, Evidence Against; ASSUMPTION, medium]
  - **Laptop users**: affected less; a bookmarked tab already works for them. — [ASSUMPTION]
  - **Users with a weak or no connection** (MRT tunnels, lifts, a dead zone): they get the browser's error page instead of anything from the app. — [source: research.md Data & Constraints, "Offline page"; the settings are an ASSUMPTION]
- **Stakeholders**:
  - **Repo owner**: decides scope, maintains the deploy and rollback process, and is the only source of demand so far. — [source: research.md Users & Demand]
  - **AIxTech programme reviewers**: read the app as a worked example. They are served by the app being genuinely good for residents, not by showcase features. — [source: `frontend/PRODUCT.md` Users]

## Goals

- A phone user can get back to their saved places from the home screen in one tap, with a recognisable icon and name, without going through a browser tab. (The owner's step A scope.)
- When opened this way, the app looks and feels like an app rather than a web page in a browser frame.
- With no connection, the user sees a clear message from the app saying it can't reach the internet, not a generic browser error.
- iPhone users are not misled into thinking their saved places are gone when they install.
- Privacy statements made today stay true: "Anonymous visit counts · no cookies", "no account". — [source: `frontend/src/components/PrivacyNotice.tsx`]
- Deploys and rollbacks stay as safe and predictable as they are now. — [source: research.md Evidence Against, service worker risk; `docs/deployment.md`]

## Non-Goals

- **Showing the last weather snapshot offline** (step B). Deferred by the owner on 2026-11-18.
- **App store listings** (App Store, Play Store) and native wrappers.
- **Push notifications or alerts.** These were ruled out earlier. — [source: `next-value-features/research.md` row 4]
- **Accounts or syncing saved places across devices.** These conflict with the no-accounts non-goal of spec 013. — [source: `per-visitor-saved-locations/decision.md`]
- **Any new data.gov.sg call or change to how weather is fetched** (Principle I).
- **Any redesign of the dashboard itself.**

## Success Metrics

The user count is under 5 and no install data is collected, so most of these are pass/fail checks, not growth numbers.

- **Installable on Android**: Chrome on Android offers to install the app, and it opens full-screen with its own icon and name. Pass/fail. (baseline: not installable; no manifest)
- **Addable on iPhone**: Add to Home Screen on iPhone gives the app's own icon and name, and it opens full-screen. Pass/fail. (baseline: generic icon from a page screenshot, browser frame; ASSUMPTION)
- **Offline**: opening the app with no connection shows the app's own offline message within the normal load time. Pass/fail. (baseline: the browser's error page)
- **No regressions**: `npm run verify` and the existing `scripts/e2e/` checks pass. No uncaught page error, rejection or `console.error` appears in an installed or offline open. (baseline: lint and all 520 vitest tests passed on 2026-11-18 at `main` `c14ce23` plus a docs-only commit)
- **Rollback stays safe**: after a rollback, visitors get the rolled-back version on their next visits rather than staying on a cached newer one. Pass/fail, checked in a drill. (baseline: no caching today, so rollback is immediate)
- **iPhone users understand their places**: qualitative. A user with places in Safari who installs is told what will happen to them. (baseline: nothing is said)
- **Use**: whether people actually install it. [NEEDS CLARIFICATION: measure at all? Counting standalone opens may conflict with the "anonymous visit counts" promise.] (baseline: unknown)

## Cost of Inaction

The app stays a website. It keeps working, and nothing that works today is lost. Phone users can still bookmark it or add a plain shortcut to the home screen, with a generic icon and the browser frame. As a *replacement* for a phone weather app it stays weaker: the extra steps and web-page look make a quick pre-outing glance less likely to become a habit, and an offline open shows a browser error. There are no user complaints recorded, so this cost is the owner's judgement, not a measured loss. — [source: research.md Market & Context, Evidence Against]

## Open Questions

- [NEEDS CLARIFICATION: Verify against current Apple (WebKit) and Chrome documentation that an iPhone home-screen app gets storage separate from Safari, and what Android needs today before it offers to install. The iPhone goal above depends on it.]
- [NEEDS CLARIFICATION: For an iPhone user whose places are in Safari, is a clear warning before install enough, or must they be able to bring their places with them? Bringing them means moving a key that acts as a password.]
- [NEEDS CLARIFICATION: Is the offline message worth its cost? It is the only goal that needs a service worker, which is the only goal that touches deploy and rollback safety.]
- [NEEDS CLARIFICATION: What name appears under the icon: "Weather", "SG Weather" or "AIxTech SG Weather"? And who makes the icon, given no logo exists?]
- [NEEDS CLARIFICATION: When, and how often, should iPhone users be told how to add the app to the home screen, so the hint helps without nagging?]
- [NEEDS CLARIFICATION: Should installs or standalone opens be measured at all, given the privacy promise?]
