# Concept: Installable app, step A

- **Slug**: installable-app
- **Created**: 2026-11-18
- **Recommended option**: Option B — Install plus an offline page

## Options

### Option A — Icon and install only (no offline page)

- **Sketch**: The app gets its own name, icon and colour. On Android, Chrome offers to install it, and it opens full-screen like an app. On iPhone, a one-time hint explains Share → Add to Home Screen, and the result opens full-screen with the right icon. The same hint tells iPhone users that the home-screen app starts with its own empty list of places, separate from Safari's. With no connection, people still see the browser's own error page.
- **Appetite**: small (a day or two, mostly the icons and checking on real phones).
- **Trade-offs**:
  - Wins: no offline helper running in the background, so deploys and rollbacks don't change at all. Nothing new is stored on the device, so the privacy notice stays exactly true. It is the smallest change that meets the main goal: one tap from the home screen.
  - Sacrifices: misses the "app's own offline message" goal. Whether Android offers install without an offline helper depends on the current Chrome version. [ASSUMPTION: recent Chrome no longer needs one; research.md platform table, medium confidence]
  - Risk: if Android does need an offline helper to offer install, this option quietly becomes Option B.
- **Rabbit holes**: designing the icon (no logo exists); getting iPhone icons, splash colour and status bar colour to look right on several devices.

### Option B — Install plus an offline page (recommended)

- **Sketch**: Everything in Option A, plus: when the app is opened with no connection, it shows a short page in the app's own look ("You're offline. Your saved places and weather will be here when you're back online.") instead of a browser error. The offline helper keeps only that one page and the few files it needs. It does not keep the app itself, saved places or weather. Whenever there is a connection, everything comes fresh from the server as it does today.
- **Appetite**: small (a few days, including a browser check of the offline case and a rollback drill).
- **Trade-offs**:
  - Wins: meets every goal in problem.md, including the offline message. Install works on Android whichever version of Chrome's rule applies. Because the app's own files are never kept on the device, a deploy or rollback reaches users on their next online open, just as now. Nothing personal is stored, so the privacy notice stays true.
  - Sacrifices: adds a background helper that browsers keep between visits. A mistake in it can outlive a deploy, so the work needs a safe way to switch it off. The offline page says nothing about the weather; showing the last snapshot is step B, still deferred.
  - Risk: a slip that lets the helper keep app files or API responses would bring back the stale-file and rollback problems the option is meant to avoid.
- **Rabbit holes**: drifting into "might as well keep the app files too" (that is the start of step B); update and switch-off behaviour across browsers; testing offline in `agent-browser` (the existing vitest setup has no browser).

### Option C — Do nothing

- **Sketch**: Leave the app as a website. Users who want it on their home screen use the browser's own "Add to Home Screen", with a generic icon and the browser frame.
- **Appetite**: none.
- **Trade-offs**:
  - Wins: no work and no risk. Nothing that works today is lost.
  - Sacrifices: the app keeps looking like a web page on a phone, which is weaker as a replacement for a phone weather app. No goal in problem.md is met.
  - Risk: none beyond the cost of inaction in problem.md, which is the owner's judgement rather than a measured loss.
- **Rabbit holes**: none.

**Considered and dropped**:
- *Moving saved places from Safari into the iPhone app* (a code or link carrying the visitor key). This is a security feature in its own right: the key acts as a password, and a link would put it in a URL, which spec 013 forbids. It belongs in a separate assessment if iPhone users ask for it.
- *An app-store wrapper*: a non-goal.

## Recommendation

**Option B.** It is the only option that meets all the goals in problem.md:

- one tap from the home screen;
- looks like an app;
- the app's own offline message;
- iPhone users told what happens to their places;
- privacy statements unchanged;
- deploys and rollbacks as safe as now.

It costs only a little more than Option A. The deciding limit is that **the offline helper keeps only the offline page and never the app's files, saved places or weather**. That is what keeps the deploy, rollback and privacy goals intact, and it also keeps step B a clean, separate decision.

If the owner judges the offline message not worth a background helper, Option A is a sound fallback. It meets every goal except that one. This assumes Android still offers install without the helper.

## Out of Scope (for the recommended option)

- Showing the last weather snapshot, or the saved list, offline (step B, deferred by the owner on 2026-11-18).
- Keeping the app's own code or any `/api` response on the device.
- Moving saved places or the visitor key from Safari into the iPhone app.
- App-store listings and native wrappers.
- Push notifications or alerts.
- Accounts or syncing across devices.
- New data.gov.sg calls or changes to weather fetching (Principle I).
- Dashboard redesign. Changes are limited to the name, icon, colours, the install hint and the offline page.
- Measuring installs, unless the owner decides otherwise (an open question in problem.md).

## Assumptions to Validate

- An iPhone home-screen app gets storage separate from Safari, so it starts with a new visitor key and an empty list. The wording of the iPhone hint depends on this. [research.md, ASSUMPTION, medium]
- Android Chrome offers install with a manifest, icons and HTTPS, and with an offline helper if one is still required. [research.md, ASSUMPTION, medium]
- A helper that keeps only the offline page doesn't delay deploys or rollbacks for online users. [ASSUMPTION, medium; to be shown in a drill]
- The existing server already serves the manifest and icons correctly from `frontend/dist`, including the manifest's content type. [research.md, high, checked]
- Adding icons, a manifest and an offline page changes nothing the privacy notice says ("no cookies", "no account"). [research.md, ASSUMPTION, medium]
- The home-screen name and the icon can be settled with the owner without a designer. [problem.md open question]
- `agent-browser` can emulate going offline for the browser check. [ASSUMPTION, low; to be checked against `agent-browser --help`]
