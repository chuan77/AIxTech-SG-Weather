# Idea Research: Installable app, step A (manifest, icons, home-screen install, offline page)

- **Slug**: installable-app
- **Created**: 2026-11-18
- **Evidence confidence (overall)**: medium. What the repo has today and how the server serves files is high confidence: read from the code on 2026-11-18. Demand is the owner's alone, inferred from the public mobile release. Platform behaviour (Android install prompt, iPhone "Add to Home Screen", iPhone storage split) is general knowledge that was **not verified** this session: no web pages were fetched, so each such claim is tagged ASSUMPTION.

## Scope Being Researched

The owner chose **step A only** (2026-11-18):

- a web app manifest (name, icons, theme colour, standalone display);
- home-screen icons;
- install on Android (the browser's own prompt or menu item) and a hint for iPhone, where the user must use Share → Add to Home Screen;
- a simple "You're offline" page when there is no connection.

**Step B is deferred**: storing the saved list and its snapshots on the device so the last snapshot opens offline. This file collects evidence for step A, plus the evidence that bears on whether to follow with step B. It does not design either step.

Known issue raised by the owner: an iPhone home-screen app gets storage separate from Safari, so the per-visitor key from spec 013 (`weather-starter.visitor.key`) does not carry over from Safari.

## Users & Demand

- The audience is public users on laptop and mobile, and the app is meant to replace a mobile weather app. — [source: memory `public-mobile-release`; `frontend/PRODUCT.md` Operating Context: "Glanced at on a phone before going out … Phone layout is a first-class context"] (confidence: high that this was said)
- Install was rated Medium–High value because "add to home screen" is the nearest a web app gets to a phone app. Nobody has asked for install or offline. — [source: `.specify/assessments/next-value-features/research.md` row 2 and Users & Demand] (confidence: medium; demand is inferred)
- There are no GitHub issues and no outside user requests. The current launch is fewer than 5 users. — [source: `next-value-features/research.md`, citing `gh issue list` and spec 011 Assumptions] (confidence: high)
- Visit counting (spec 012) does not record how visitors open the app, so the share of phone visitors, and of iPhone visitors in particular, is unknown. — [source: `docs/architecture.md`, spec 012 summary; `frontend/src/App.tsx`] (confidence: high that it isn't measured)
- Past go decisions all rated demand "adequate on the owner's confirmation only". The same applies here. — [source: `next-value-features/research.md` Users & Demand] (confidence: high)

## Prior Art

- **Internal: nothing exists yet.** `frontend/index.html` has a charset, a viewport tag, the title "Weather" and Google Fonts preconnects. It has no manifest link, `theme-color`, `apple-touch-icon` or favicon. There is no `frontend/public/` folder and no `frontend/src/assets/`. No service worker is registered anywhere. — [source: `frontend/index.html`; `ls frontend`] (confidence: high)
- **Internal: the build has no PWA plugin.** `frontend/vite.config.ts` uses only `@vitejs/plugin-react`. Vite copies `frontend/public/` into `dist/` unchanged by default, so a hand-written manifest and icons need no new dependency. — [source: `frontend/vite.config.ts`, `frontend/package.json`; Vite's `public/` behaviour is general knowledge, ASSUMPTION] (confidence: medium)
- **Internal: the server already serves extra files correctly.** In production, `backend/src/server.ts` (lines 156–177) serves `frontend/dist` with `express.static(…, { index: false })` and sends the rendered `index.html` for every other path (`app.get('*')`). A file in `dist/` such as `/manifest.webmanifest` is served as is, and Express's MIME table gives `.webmanifest` the type `application/manifest+json` (checked with Node on 2026-11-18). A missing file would fall through to `index.html` with status 200, not a 404. — [source: `backend/src/server.ts`; `node -e` check against the installed `send`/`mime`] (confidence: high)
- **Internal: `index.html` is rendered by the server.** `renderIndexHtml` (`backend/src/indexHtml.ts`) inserts runtime `<meta>` tags (CARTO key, analytics mode) before `</head>`. Tags added to `frontend/index.html` at build time survive this unchanged. — [source: `backend/src/indexHtml.ts`] (confidence: high)
- **Internal: stale readings are already marked.** `Hero` dates and quietens a stale snapshot ("stale" freshness, `hero-temperature--stale`), and the product promises that "Updated <time>" is part of every reading. This matters for step B, not for step A's offline page. — [source: `frontend/src/components/Hero.tsx` lines 25–67; `frontend/PRODUCT.md` Operating Context] (confidence: high)
- **Internal: the iPhone storage problem was seen before, from the other side.** The per-visitor concept noted that Safari may clear script-written storage after about 7 days without a visit, *for sites not added to the home screen*, which works against keeping the list. Installing may therefore protect the key on iPhone while also splitting it from Safari's. — [source: `.specify/assessments/per-visitor-saved-locations/concept.md` line 53, itself tagged ASSUMPTION] (confidence: low–medium)
- **Internal: a lost key loses the list, by design.** The per-visitor decision accepted that "a lost key loses the list", and that moving across devices would need identity, which conflicts with the no-accounts non-goal. The server deletes visitors unused for 90 days with their places. — [source: `per-visitor-saved-locations/decision.md` line 65; `docs/architecture.md` spec 013 paragraph] (confidence: high)
- **External: PWA install is a common pattern.** Many sites offer a manifest and home-screen icon, and NEA's myENV is a store app rather than a web app. No comparable Singapore weather PWA was researched. — [ASSUMPTION; not searched] (confidence: low)

## Market & Context

- **What users do today**: open the site in a browser tab or bookmark it. Mobile browsers can already add any page to the home screen without a manifest, but with a generic or screenshot icon and the browser bar showing. — [ASSUMPTION] (confidence: medium)
- **The alternative users have**: store apps such as myENV, which have push alerts that this app does not plan to match. — [source: `next-value-features/research.md` Market & Context, itself ASSUMPTION] (confidence: low)
- **Cost of doing nothing**: the app stays a browser tab. That is weaker as a replacement for a phone app but loses nothing that works today. — [ASSUMPTION] (confidence: medium)

## Data & Constraints

**Platform behaviour** (all ASSUMPTION, general knowledge, not fetched this session; to be verified during specification)

| Item | Expected behaviour | Confidence |
|---|---|---|
| Android Chrome install | Offers install when there is a manifest (name, start URL, 192 px and 512 px icons, `display: standalone`), HTTPS, and, depending on the version, a service worker with a fetch handler | medium |
| Android storage | The installed app shares the site's storage with Chrome, so the visitor key carries over | medium |
| iPhone/iPad install | No automatic prompt. The user taps Share → Add to Home Screen. Since iOS 16.4 other iOS browsers can do this too. iOS uses `apple-touch-icon` rather than manifest icons for the home screen | medium |
| iPhone storage | A home-screen web app gets its **own** storage, separate from Safari's, so it starts with a new visitor key and an empty list | medium |
| iPhone eviction | Safari's ~7-day clearing of script-written storage does not apply to home-screen apps | low–medium |
| Desktop Chrome/Edge | Install icon in the address bar; opens in its own window | medium |
| Offline page | Showing a custom page with no connection needs a service worker. Without one, the browser shows its own error page | high |

**Repo constraints** — [source: files named] (confidence: high)

- HTTPS is already in place on the Vercel container (`vercel.json`, `"framework": "container"`, region `sin1`). Local `npm run dev` uses Portless on `weather-starter.localhost`. Browsers usually treat `localhost` as a secure context, so service workers work there too (that part is an ASSUMPTION).
- **Principle I** (no data.gov.sg calls on page load) is untouched by step A: a manifest, icons and an offline page make no weather calls. — [source: `.specify/memory/constitution.md`, as summarised in `frontend/PRODUCT.md`]
- **Theme-driven UI**: colours must come from theme tokens. The manifest's `theme_color`/`background_color` and the `<meta name="theme-color">` are fixed values outside CSS, so they need to match a token such as `sky-deep` `#202a36` or `harbour-slate` `#2c3f54` from `frontend/DESIGN.md`. — [source: `frontend/DESIGN.md` colours; `docs/theming.md`]
- **There are no icon assets.** Icons (192, 512, maskable, 180 px Apple touch icon and a favicon) must be made. `frontend/DESIGN.md` defines colours but no logo. — [source: `ls frontend`; `frontend/DESIGN.md`]
- **Privacy notice**: it currently says "Anonymous visit counts · no cookies" and "no cookies, no account". Step A stores nothing new. A service worker cache holding only the offline page and app files would not change those statements. Step B would. — [source: `frontend/src/components/PrivacyNotice.tsx` lines 44, 57] (confidence: high for the wording; the conclusion is an ASSUMPTION)
- **Analytics**: `<Analytics>` runs only in `measure` mode. An offline open sends nothing, so it isn't counted. — [source: `frontend/src/App.tsx` line 19; ASSUMPTION for offline behaviour]
- **Rollback**: a service worker can keep serving old files after a deploy or rollback if it caches app code. Step A's worker could cache only the offline page to stay out of that problem. — [ASSUMPTION; see `docs/deployment.md` for the rollback process]
- **Tests**: the vitest setup runs `*.test.ts` without a browser, so a service worker's behaviour would need an `agent-browser` check under `scripts/e2e/` (offline emulation, errors watched from `about:blank`). — [source: `CLAUDE.md` Browser checks; `docs/testing.md` not re-read this session]

## Evidence Against the Idea

- **The main gain on iPhone comes with a loss.** An iPhone user who already saved places in Safari and then installs will open an empty list. Their old places stay on the server under the Safari key until the 90-day sweep removes them. Without a way to move the key, installing looks like data loss to that user. — [source: spec 013 design in `docs/architecture.md`; storage split is ASSUMPTION, medium]
- **Browsers already allow home-screen bookmarks.** Step A's gain is polish (proper icon, full screen, offline page), not a new capability. — [source: `next-value-features/research.md` Evidence Against; ASSUMPTION] (confidence: medium)
- **The offline page tells users little.** Step A with no network shows "You're offline", not the weather. The thing users would value offline, the last snapshot, is step B. — [ASSUMPTION] (confidence: medium)
- **A service worker is a new kind of failure.** Even a minimal one adds stale-file and update bugs and makes rollback harder, for a feature with no measured demand. — [source: `next-value-features/research.md` Data & Constraints line 69; ASSUMPTION] (confidence: low–medium)
- **Demand is unmeasured.** There are fewer than 5 users and no data on how many use phones or iPhones. — [source: above]

## Gaps & Open Questions

- [NEEDS CLARIFICATION: Verify the platform table above against current Apple (WebKit) and Chrome documentation, in particular the iPhone storage split and the current Android install requirements. No web pages were fetched this session; the hosts (`webkit.org`, `developer.chrome.com`, `web.dev`, `developer.mozilla.org`) are not on the URL Trust Policy allowlist and need the owner's confirmation.]
- [NEEDS CLARIFICATION: What should an iPhone user who installs see if their places are in Safari? Accept an empty list with a warning before install, or offer a way to move the visitor key (a code to copy, for example)? A key moved by copy-and-paste is effectively a password, so this is a security decision as well as a product one.]
- [NEEDS CLARIFICATION: Should the offline page and the install hint be in step A at all? Without a service worker there is no custom offline page, so "offline page" is what brings a service worker into step A.]
- [NEEDS CLARIFICATION: Who makes the icon? No logo exists. Is a simple mark in the theme colours acceptable, or is a designed icon wanted?]
- [NEEDS CLARIFICATION: App name on the home screen: "Weather" (the current title), "SG Weather", or "AIxTech SG Weather" (`frontend/PRODUCT.md`)? Home-screen labels are truncated at about 12 characters (ASSUMPTION).]
- [NEEDS CLARIFICATION: Should the install hint show only on iPhone and iPad, only once, and only after the user has saved a place? This affects how intrusive it is.]
- [NEEDS CLARIFICATION: Is it worth measuring installs (for example, counting visits opened in `display-mode: standalone`) given the "anonymous visit counts" privacy promise?]

## Sources

All sources are in this repository. No web pages were fetched.

- `frontend/index.html`, `frontend/vite.config.ts`, `frontend/package.json`, `frontend/PRODUCT.md`, `frontend/DESIGN.md`
- `frontend/src/App.tsx`, `frontend/src/components/Hero.tsx`, `frontend/src/components/PrivacyNotice.tsx`
- `backend/src/server.ts`, `backend/src/indexHtml.ts`; MIME check with the installed Express dependencies
- `vercel.json`, `docs/architecture.md`, `CLAUDE.md`
- `.specify/assessments/next-value-features/research.md`, `.specify/assessments/per-visitor-saved-locations/concept.md` and `decision.md`
- Memory `public-mobile-release`
