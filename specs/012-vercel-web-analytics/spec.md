# Feature Specification: Anonymous Visitor Measurement with a Privacy Notice

**Feature Branch**: `012-vercel-web-analytics`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "Implement Vercel Hobby plan Web Analytics." Handoff from the assessment `.specify/assessments/vercel-web-analytics/decision.md` (verdict: go, Option A, gated on a route check). Draft PR #17 from the Vercel Agent is prior work, not the baseline: it passes the unit gate but fails the browser checks (see Assumptions).

## Clarifications

### Session 2026-11-17

- Q: Should hosted preview deploys also report visits, or only production? → A: Production and hosted previews (changed from "production only" in the same session). Local, test and browser-check runs stay silent. Preview visits appear under the dashboard's Preview environment filter, so the preview can show the whole chain working before release.
- Q: How should the owner switch measurement off? → A: A project setting (hosting environment variable) the app reads at start. When off, no measurement script is requested at all; a restart or redeploy applies it with no code change. The doc also mentions the dashboard toggle.
- Q: What happens to the Vercel Agent's draft PR #17? → A: Close it with a comment pointing to spec 012; implement fresh on `012-vercel-web-analytics` from `main`, with no commits or lockfile changes carried over.
- Q: When measurement is switched off, does the privacy notice hide or stay? → A: It follows measurement: shown only where measurement is active (hosted deployment with the setting on), hidden otherwise.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Owner sees whether the public app is used (Priority: P1)

The owner opens the hosting platform's analytics dashboard for the live app and sees how many people visited, on which days, where they came from (referring sites, countries) and on what kind of device (mobile or desktop, operating system, browser). The figures keep accumulating across deploys, rollbacks and idle restarts. Visitors notice nothing different: no prompts, no cookies, no slower page and no errors.

**Why this priority**: this is the problem the feature exists to solve. The app is going public with no usage evidence at all.

**Independent Test**: on a hosted preview deploy, request the measurement script address and confirm the platform's script comes back, not the app's page. Load the app there from a phone and a laptop, confirm no runtime errors, and confirm the visits appear in the dashboard under the Preview environment.

**Acceptance Scenarios**:

1. **Given** the feature is deployed to production, **When** a visitor opens the app, **Then** the visit appears in the owner's analytics dashboard within a day, attributed to the visitor's device type, browser, OS, country and referrer.
2. **Given** visits were recorded, **When** the app is redeployed, rolled back, or its instance stops after idling and restarts, **Then** the earlier visits remain in the dashboard and new visits keep adding to them.
3. **Given** a visitor blocks the measurement (ad or content blocker) or the measurement service is unreachable, **When** they use the app, **Then** the weather dashboard works exactly as before and shows no error to the visitor.
4. **Given** a hosted non-production deploy, **When** the measurement script's address is requested, **Then** the platform's script is returned, not the app's page. If the app's page comes back, the feature MUST NOT go to production (see FR-001).

---

### User Story 2 - Visitor can find out what is measured (Priority: P2)

A visitor on a laptop or phone sees a short, quiet line near the bottom of the dashboard saying visits are counted anonymously, with no cookies. Opening it shows a few plain sentences: what is counted, who counts it, what is not collected, and that no account or identity is involved. It is there whether or not the visitor has saved a location, and it never pushes the weather content down or competes with it.

**Why this priority**: the owner requires a disclosure under Singapore's PDPA before measuring a public audience. It is needed for release but not for the first measurement test on a non-production deploy.

**Independent Test**: with the notice enabled for testing in a local run (no measurement requests), on a 375 px wide phone view and on a laptop, in every theme, with and without saved locations, find the notice and open its explanation by keyboard, screen reader, touch and mouse. Confirm it is absent when measurement is off.

**Acceptance Scenarios**:

1. **Given** a visitor with at least one saved location, **When** they reach the bottom of the selected location's view, **Then** they see the one-line notice near the existing data-source credit.
2. **Given** a visitor with no saved locations (empty state), **When** the app loads, **Then** the notice is still reachable on that screen.
3. **Given** the notice is visible, **When** the visitor activates it, **Then** a short explanation appears without leaving the page or losing their place, and can be dismissed the same way.
4. **Given** any theme, **When** the notice and its explanation are shown, **Then** the text meets the project's contrast rules and uses the theme's secondary-text styling.
5. **Given** measurement is switched off or inactive, **When** the app loads, **Then** no privacy notice is shown and the footer and empty state look as they do today.

---

### User Story 3 - Local, test and check runs stay clean and silent (Priority: P1)

When the app runs on a developer machine, in the automated tests, or in the scripted browser checks, it sends no visits to the analytics service and produces no runtime errors or console errors caused by measurement. Every existing browser check passes unchanged.

**Why this priority**: the browser checks fail the run on any page error. The draft PR #17 shows that naively adding measurement breaks every one of them, because the app's own server answers the script request with its page. This must hold from day one, together with Story 1.

**Independent Test**: build the production frontend, run every `scripts/e2e/` check against a local temporary server, and confirm they pass with no page errors. Confirm that no request leaves for the analytics service during the run.

**Acceptance Scenarios**:

1. **Given** the app is run locally (dev server or a local production build), **When** any page is loaded, **Then** no measurement request is made and no page or console error appears.
2. **Given** the scripted browser checks run against a local temporary server, **When** they open the app and switch views and themes, **Then** they pass without any new allowed-error exception.
3. **Given** the unit test suite, **When** it runs, **Then** it passes and makes no network call to the analytics service.

---

### User Story 4 - Owner knows where the figures live and their limits (Priority: P3)

The owner (or a future maintainer) reads the deployment documentation and learns where usage figures are viewed, the free plan's monthly event allowance and what happens when it runs out, the one-month look-back, that blocked visitors are not counted, and how to turn measurement off.

**Why this priority**: useful for operating the feature, but it doesn't change what visitors or the owner experience day to day.

**Independent Test**: a reader with only the deployment doc can find the dashboard, state the monthly allowance and look-back, and turn measurement off.

**Acceptance Scenarios**:

1. **Given** the deployment documentation, **When** the owner looks for analytics, **Then** it states where to view figures, the monthly allowance, the pause-on-exhaustion behaviour, the one-month window and the off switch.

---

### Edge Cases

- **Measurement routes not served for the container deployment** → the gate check fails; nothing is released to production, and the work returns to the assessment (FR-001).
- **Measurement switched off by the owner** → no script requested, no errors, and the privacy notice is hidden.
- **Monthly allowance exhausted** → measurement pauses until the next cycle; the app is unaffected and shows nothing to visitors.
- **Ad/content blocker or offline** → no visit recorded; no error, no retry loop, no visible change.
- **Empty state (no saved locations)** → privacy notice still reachable.
- **Theme switch while the explanation is open** → explanation re-styles with the theme and stays readable.
- **375 px phone with the bottom dock** → notice is not hidden behind the dock and doesn't add scroll before the weather content.
- **Bots and health checks** → the existing `/health` smoke check is a server request, not a page view, so it must not appear as a visitor.
- **App is single-page (no URL changes)** → every visit is reported against the one page; no per-route reporting is expected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (gate)**: Before any production release, the feature MUST be deployed to a hosted non-production environment and checked: the measurement script address MUST return the platform's measurement script, not the app's own page. If the check fails, the feature MUST stop and return to the assessment. No workaround may be built under this spec.
- **FR-002**: On hosted deployments (production and preview, per FR-004), every page load of the app MUST be reported as an anonymous visit to the hosting platform's built-in visitor measurement on its free (Hobby) tier.
- **FR-003**: Measurement MUST NOT set cookies, store identifiers on the visitor's device, or add any personal data to the app's own database or logs.
- **FR-004**: Measurement MUST be active only on hosted deployments (production and preview). Local development, local production builds, automated tests and scripted browser checks MUST make no measurement request.
- **FR-004a**: The owner MUST be able to switch measurement off (and back on) with a project setting the app reads at start, without a code change. When it is off, the app MUST request no measurement script and make no measurement request; a restart or redeploy applies the change. When the setting is absent, hosted deployments measure (default on).
- **FR-005**: Measurement failing to load or send (blocked, offline, quota exhausted, service down) MUST NOT produce a visible error, an uncaught page error or a console error, and MUST NOT change how the dashboard behaves.
- **FR-006**: Measurement MUST NOT delay the first display of weather content perceptibly. It loads after, and independently of, the app's own content.
- **FR-007**: Wherever measurement is active (FR-004, FR-004a), the app MUST show a one-line privacy notice stating that visits are counted anonymously and without cookies, reachable from every view, including the empty state with no saved locations. Wherever measurement is inactive (switched off, local, tests), the notice MUST NOT be shown.
- **FR-007a**: The scripted browser checks MUST be able to verify the notice (placement, explanation, themes, phone and laptop) in a local run, without any measurement request being made.
- **FR-008**: The notice MUST open a short plain-language explanation in place (without navigating away). It covers: what is counted (visit, page, referrer, country/region/city, device type, OS, browser), who counts it (the hosting provider's analytics), what is not collected (no cookies, no account, no precise location, no saved-place coordinates), and that identifiers reset daily.
- **FR-009**: The notice and explanation MUST be operable by keyboard, touch and pointer, MUST expose an accessible name and expanded/collapsed state to assistive technology, and MUST meet the project's theme and contrast rules in every theme.
- **FR-010**: The notice MUST have a small footprint: secondary-text styling, no more than one line at 375 px when collapsed, and no reflow of weather content above it. Its placement MUST be reviewed with the `impeccable` design skill on phone and laptop before release.
- **FR-011**: All existing scripted browser checks MUST pass unchanged with the feature in place. No new allowed-error exception may be added for measurement.
- **FR-012**: The deployment documentation MUST state where figures are viewed, the monthly event allowance (50,000 on the free tier, shared across the account), that collection pauses when it is used up, the one-month look-back, that blocked visitors are not counted, and how to switch measurement off (the project setting from FR-004a, plus the dashboard toggle; disabling only the dashboard leaves the app requesting the script).
- **FR-013**: The change MUST NOT alter the app's existing interaction logging, request logging or their privacy rules.

### Key Entities

- **Visit (page view)**: one load of the app by a visitor in production. It is held only by the hosting platform's analytics, never by the app. Attributes as reported by the platform: time, page, referrer, country/region/city, device type, OS, browser.
- **Privacy notice**: the visible one-line disclosure plus its expandable explanation. Static text, the same for every visitor.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visit made to the production app appears in the owner's dashboard within 24 hours, with device type and referrer shown.
- **SC-002**: Visits recorded before a redeploy, rollback or idle restart are still present afterwards (0 lost days across at least one deploy and one cold start).
- **SC-003**: 100% of existing scripted browser checks pass with the feature in place, with zero page or console errors attributable to measurement.
- **SC-004**: Zero measurement requests are made during local development, unit tests and browser-check runs, and on any deployment where the owner has switched measurement off.
- **SC-005**: A first-time visitor can find and open the privacy explanation in under 10 seconds on both a 375 px phone and a laptop, with and without saved locations.
- **SC-006**: The collapsed notice takes at most one line at 375 px, and weather content above it doesn't move when it appears.
- **SC-007**: Running cost stays at $0 per month, and no paid plan or extra vendor is introduced.
- **SC-008**: Time until the weather content first shows is no worse than before the feature, within normal run-to-run variation.

## Assumptions

- **Platform**: the measurement service is the hosting provider's Web Analytics on the free (Hobby) tier, already enabled in the project dashboard (owner's screenshot, 2026-11-17). Custom events, UTM tags and longer retention are not available on this tier and are out of scope.
- **Gate outcome unknown**: whether the platform serves its measurement routes in front of the container deployment is unverified. FR-001 makes this the first step.
- **Prior work**: draft PR #17 (Vercel Agent) adds the measurement unconditionally. Verified 2026-11-17 in a local worktree: `npm run verify` passes, but `scripts/e2e/town-search.sh themes` fails with `SyntaxError: Unexpected token '<'`, because the local server answers `/_vercel/insights/script.js` with `index.html` (HTTP 200, `text/html`). It violates FR-004/FR-005/FR-011 as written. Its lockfile also carries unrelated platform-field churn. It is reference only: it will be closed with a pointer to this spec, and nothing is carried over from its branch.
- **Notice form**: an expandable in-place explanation (the app has no router or separate pages) is assumed to be enough for the owner's PDPA reading. This is not legal advice, and the owner approves the final wording.
- **Notice placement**: next to the existing "Weather for … · source" credit for the selected location, plus an equivalent spot in the empty state. Final placement is set by the `impeccable` review.
- **Traffic**: expected to stay under the 50,000 events/month allowance. The owner monitors the dashboard; no in-app quota alerting.
- **Audience for figures**: only the owner, in the platform dashboard. Nothing is shown in the app.
- **Out of scope**: feature-usage measurement, custom events, campaign tags, paid tiers or other vendors, history beyond one month, in-app figures, targets/thresholds, performance monitoring, a full legal privacy policy or cookie banner, changes to `/api/logs` or request logging.
- **Constitution**: no backend route, schema or weather-data change is expected (Principles I–III untouched). The notice follows Principle V (theme tokens, contrast in every theme). Any testable logic stays in pure modules (Principle IV), and the gate in Principle VI applies.
