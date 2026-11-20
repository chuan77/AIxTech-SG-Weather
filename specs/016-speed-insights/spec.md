# Feature Specification: Real-User Performance Score, with Cold and Warm Visits Apart

**Feature Branch**: `016-speed-insights`

**Created**: 2026-11-20

**Status**: Draft

**Input**: User description: "Implement Vercel SpeedInsight to capture Real Experience score." Handoff from the assessment `.specify/assessments/speed-insights/decision.md` (verdict: go, Option B, gated on the container route check). The owner frames it as a learning exercise and wants cold starts separated from frontend performance (`problem.md`, 2026-11-20).

## Clarifications

### Session 2026-11-20

- Q: Should performance measurement share the visit-counting switch or have its own? → A: Its own setting, default on in hosted deployments, so either product can be turned off alone (FR-004).
- Q: If the free tier can't show scores per cold/warm label, keep or drop the labels? → A: Keep sending them; the lab baseline covers the split meanwhile (FR-007).
- Q: Should the collapsed privacy line mention speed? → A: Yes. The line names what is active, for example "Anonymous visits & speed · no cookies" (shortened during implementation so it fits), and still fits one line at 375 px (FR-011).
- Q: When does a page load count as cold? → A: When the serving instance started less than 10 seconds before the page request, whatever else it served first (FR-005).
- Q: How many lab runs make one baseline reading per profile? → A: 3 runs after a warm-up request, recording the median of each metric (FR-014).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Owner sees a real-visitor performance score (Priority: P1)

The owner opens the hosting platform's performance dashboard for the live app. They see a Real Experience Score built from real visitors' page loads, for phones and for laptops separately. Visitors notice nothing: no prompts, no cookies, no slower page and no errors.

**Why this priority**: this is the core ask, and the first field data before the public mobile release.

**Independent Test**: on a hosted preview deploy:
- Request the performance script's address and confirm the platform's script comes back, not the app's page.
- Load the app from a phone and a laptop and confirm no runtime errors.
- Confirm readings appear in the dashboard under the Preview environment.

**Acceptance Scenarios**:

1. **Given** the feature is deployed to production and visitors use the app, **When** the owner opens the performance dashboard, **Then** a score appears for the device types that have readings, within a few days of release.
2. **Given** a visitor blocks the measurement (ad or content blocker) or the measurement service is unreachable, **When** they use the app, **Then** the dashboard works exactly as before and shows no error.
3. **Given** a hosted non-production deploy, **When** the performance script's address is requested, **Then** the platform's script is returned, not the app's page. If the app's page comes back, the feature MUST NOT go to production (FR-001).

---

### User Story 2 - Owner tells cold-start time apart from the frontend (Priority: P1)

The owner compares the experience of visits that had to wait for the app to wake up (a cold start, about 5 s after 5 idle minutes) with visits served by an app that was already awake. Two sources make the comparison:
- **Field readings:** each real visit is reported with a "cold" or "warm" label, so the dashboard can show the two groups apart where the free tier allows it.
- **Lab reading:** a documented, repeatable reading taken against an already-awake deployment, on a phone profile and a desktop profile, gives per-metric frontend figures (loading, interactivity, layout stability, first paint, server response).

**Why this priority**: the owner asked for this explicitly. Without it, a low score can't be told apart as hosting wake-up or frontend.

**Independent Test**:
- On a preview, load the app once after the instance has idled past its sleep time, then again straight after. Confirm the first visit is reported as cold and the second as warm.
- Follow the documented lab procedure and confirm it produces a reading for phone and desktop.

**Acceptance Scenarios**:

1. **Given** the app had been asleep (idle past its sleep time) or was newly deployed, **When** a visitor's page load wakes it, **Then** that visit's performance readings carry the "cold" label.
2. **Given** the app is already awake, **When** a visitor loads the page, **Then** that visit's readings carry the "warm" label.
3. **Given** the documented lab procedure, **When** the owner follows it against an awake deployment, **Then** they get per-metric frontend figures for a phone profile and a desktop profile, and the first such baseline is recorded in the documentation.
4. **Given** the free tier doesn't show scores per label, **When** the owner checks the dashboard on a preview, **Then** that finding is recorded and FR-007 decides what happens to the labels.

---

### User Story 3 - Local, test and check runs stay clean and silent (Priority: P1)

When the app runs on a developer machine, in automated tests or in the scripted browser checks, it makes no performance measurement request (to the platform or any third-party address) and produces no runtime or console errors caused by measurement. Every existing browser check passes unchanged.

**Why this priority**: the browser checks fail on any page error. In spec 012, adding measurement without this rule broke every check, because the local server answers the script address with its own page.

**Independent Test**: build the production frontend and run every scripted browser check against a local temporary server. Confirm they pass and that no request goes to a measurement address. Run the unit tests and confirm they make no measurement call.

**Acceptance Scenarios**:

1. **Given** the app runs locally (dev server or local production build), **When** any page loads, **Then** no performance measurement request is made, including to any debug or third-party script address.
2. **Given** the scripted browser checks run against a local temporary server, **When** they open the app and switch views and themes, **Then** they pass with no new allowed-error exception.
3. **Given** measurement is switched off on a hosted deployment, **When** the app loads, **Then** no performance script is requested.

---

### User Story 4 - Visitor can find out what is measured (Priority: P2)

A visitor who opens the existing privacy notice learns that page speed is measured too: which details are recorded, who records them, and what isn't collected.

**Why this priority**: the app promises an honest disclosure (spec 012, PDPA). Performance measurement records some details that visit counting doesn't (network speed, the slowest page element), so the explanation must cover them before production. It isn't needed for the first preview test.

**Independent Test**: with the notice enabled for testing in a local run (no measurement requests), on a 375 px phone view and a laptop, in every theme, open the explanation and confirm it covers performance measurement. Confirm the notice still fits its footprint rules from spec 012.

**Acceptance Scenarios**:

1. **Given** performance measurement is active, **When** a visitor opens the privacy explanation, **Then** it says that page speed is measured by the host's performance tool, and lists what is recorded and what isn't.
2. **Given** both visit counting and performance measurement are off, **When** the app loads, **Then** no privacy notice is shown.
3. **Given** only one of the two is active, **When** the notice is shown, **Then** its line and explanation describe only the active one.
3. **Given** any theme and a 375 px phone, **When** the notice is collapsed, **Then** it still takes one line and meets the project's contrast rules.

---

### User Story 5 - Owner knows where the figures live and their limits (Priority: P3)

The owner, or a future maintainer, reads the deployment documentation and learns:
- where the score is viewed, and how to read cold against warm;
- what the free tier shows and hides: the score only, 24-hour and 7-day ranges, the shared allowance and the pause when it runs out;
- how to run the lab baseline;
- how to switch measurement off.

**Why this priority**: it delivers the learning goal and keeps the feature operable, but doesn't change what visitors experience.

**Independent Test**: a reader with only the deployment doc can find the score, explain what it can't show on the free tier, run the lab baseline and switch measurement off.

**Acceptance Scenarios**:

1. **Given** the deployment documentation, **When** the owner looks for performance figures, **Then** it covers each item in User Story 5.

---

### Edge Cases

- **Performance routes not served for the container deployment**: the gate check fails, nothing is released to production, and the work returns to the assessment (FR-001).
- **Free allowance exhausted** (shared across the account, rolling 30 days): collection pauses for at least 14 days. The app is unaffected and shows nothing to visitors.
- **Ad or content blocker, or offline**: no readings, and no error, retry loop or visible change.
- **Burst of visits starts several instances at once**: each instance's waking visit counts as cold. This is accepted, because those visitors did wait.
- **Visit leaves before the page finishes loading**: whatever readings the platform managed to send are kept. Nothing is retried.
- **Inbound link with tracking parameters** (for example `?fbclid=…`): the reported address carries no query string or fragment.
- **The health check or a non-page request wakes the instance**: a page load arriving within 10 s of the instance starting is still cold, because that visitor may have shared the wait. Later page loads are warm.
- **The app never changes its address** (single page): no in-page navigation readings are expected, and every visit is reported against the one page plus its cold or warm label.
- **Owner checks from a preview**: preview readings stay under the dashboard's Preview environment and don't mix with production.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (gate)**: Before any production release, the owner MUST enable the performance product in the hosting dashboard and deploy to a hosted non-production environment. The performance script address MUST then return the platform's script, not the app's own page. If it doesn't, the feature MUST stop and return to the assessment. No workaround may be built under this spec.
- **FR-002**: On hosted deployments (production and preview), every page load MUST report the visitor's page performance readings to the hosting platform's built-in performance measurement on its free (Hobby) tier.
- **FR-003**: Measurement MUST be active only on hosted deployments. Local development, local production builds, automated tests and scripted browser checks MUST make no performance measurement request, to the platform or to any third-party or debug script address.
- **FR-004**: The owner MUST be able to switch performance measurement off and on with a project setting the app reads at start, without a code change. The setting MUST be separate from the visit-counting switch (spec 012), so either can be turned off alone. When the setting is absent, hosted deployments measure (default on), as visit counting does. When it is off, no performance script is requested. A restart or redeploy applies a change.
- **FR-005**: Each page load's readings MUST carry exactly one label: "cold" when the app instance serving the page started less than 10 seconds before it received the page request, and "warm" otherwise. Other requests the instance handled first (health check, platform probes, API calls) don't change this. Deciding the label MUST NOT delay the page noticeably or make any extra request.
- **FR-006**: The reported page address MUST have its query string and fragment removed. The label and the stripped address are the only page details the app adds.
- **FR-007**: Before production, the owner MUST check on a preview whether the free tier shows scores per label. The result MUST be recorded in the documentation. Either way, the labels keep being sent. If the free tier can't show them, the cold/warm comparison relies on the lab baseline (FR-014) until the view becomes available.
- **FR-008**: Measurement failing to load or send (blocked, offline, allowance exhausted, service down) MUST NOT cause a visible error, an uncaught page error or a console error, and MUST NOT change how the dashboard behaves.
- **FR-009**: Measurement MUST NOT delay the first display of weather content perceptibly. It loads after, and independently of, the app's own content.
- **FR-010**: Measurement MUST NOT set cookies, store identifiers on the visitor's device, or add any personal data to the app's own database or logs.
- **FR-011**: Wherever performance measurement is active, the privacy explanation MUST state that page speed is measured by the host's performance tool. It MUST say what is recorded (page, browser, operating system, device type, country, network speed, speed readings and which page element was slow) and what isn't (no cookies, no account, no precise location, no saved places). The privacy notice MUST be shown wherever visit counting or performance measurement is active, and hidden when both are off. The collapsed line MUST name only what is active: visit counting, page speed, or both (for example "Anonymous visits & speed · no cookies" when both run). It MUST still fit one line at 375 px.
- **FR-012**: The notice MUST keep spec 012's accessibility and footprint rules: keyboard, touch and pointer operable; one line at 375 px when collapsed; contrast met in every theme.
- **FR-013**: The scripted browser checks MUST be able to verify the updated notice in a local run without any measurement request. All existing checks MUST pass unchanged, and no new allowed-error exception may be added for measurement.
- **FR-014**: A documented, repeatable lab procedure MUST produce per-metric frontend figures against an already-awake deployment, for a phone profile and a desktop profile. A reading is 3 runs per profile after one warm-up request, recording the median of each metric. The first baseline reading MUST be recorded with its date. The procedure stays manual.
- **FR-015**: The deployment documentation MUST cover every item in User Story 5. It MUST also say that disabling the product only in the hosting dashboard leaves the app requesting the script.
- **FR-016**: The change MUST NOT alter visit counting (spec 012), interaction logging, request logging or their privacy rules, except for the shared privacy wording in FR-011.

### Key Entities

- **Performance reading**: one measurement from one visit, such as server response, first paint, loading, interactivity or layout stability. The hosting platform holds it, never the app. Attributes as reported by the platform: page address (stripped), label (cold or warm), browser, OS, device type, country, network speed, the reading and its attribution.
- **Visit label**: "cold" or "warm", decided per page load from whether the serving instance started less than 10 seconds before the page request.
- **Lab baseline**: a dated record of per-metric frontend figures (median of 3 runs) for a phone profile and a desktop profile, taken against an awake deployment, kept in the documentation.
- **Privacy notice**: the existing one-line disclosure and its explanation, extended to cover performance measurement.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Within 7 days of production release, with at least one real visit from a phone and one from a laptop, the owner's dashboard shows a performance score.
- **SC-002**: On a preview, a page load after the app has idled past its sleep time is reported as cold, and an immediate second load as warm, in 2 out of 2 tries.
- **SC-003**: The owner can state, for a chosen week, the frontend's phone and desktop figures from the lab baseline. They can also state whether cold visits score worse than warm ones, from per-label field scores where shown, or else from the lab baseline compared with the known cold-start time.
- **SC-004**: 100% of existing scripted browser checks pass with the feature in place, with zero page or console errors attributable to measurement.
- **SC-005**: Zero performance measurement requests are made during local development, unit tests and browser-check runs, and on any hosted deployment where the owner has switched measurement off.
- **SC-006**: Running cost stays at $0 per month. No paid plan or extra vendor is introduced, and collection never pauses for exceeding the free allowance in the first 30 days.
- **SC-007**: Time until the weather content first shows is no worse than before the feature, within normal run-to-run variation.
- **SC-008**: A reader with only the deployment doc can, in under 5 minutes, find the score, name two things the free tier can't show, and say how to switch measurement off.

## Assumptions

- **Platform**: the measurement service is the hosting provider's Speed Insights on the free (Hobby) tier.
  - It allows 10,000 events per rolling 30 days, shared across the account.
  - It shows the overall score only (no per-metric view), with 24-hour and 7-day ranges.
  - Pro, Speed Insights Plus and Drains are out of scope (assessment `research.md`).
- **Gate outcome unknown**: the sibling visit-counting route is served in front of the container (spec 012, checked 2026-11-17). Whether the performance route is too is unverified, and FR-001 makes it the first step.
- **Environments**: production and hosted previews both measure, as in spec 012. Previews are needed for the gate and the label check, and the dashboard separates them by environment.
- **Label carrier**: the platform's per-page "route" field carries the label. On this single-page app it would otherwise always be `/`. Whether labelling counts extra events is unverified; the docs suggest it doesn't.
- **Cold definition**: the instance started less than 10 seconds before the page request (the measured startup is about 5 s), judged per instance. A burst that starts several instances counts each waking page load as cold.
- **Lab tool**: a free lab tool, such as Lighthouse or PageSpeed Insights, against the public URL or a preview, after one warm-up request. The exact tool and device profiles are fixed during planning.
- **Notice**: extends spec 012's notice. Its wording isn't legal advice, and the owner approves the final text.
- **Traffic**: fewer than 5 visitors today, so the field score will be thin and noisy at first. The lab baseline doesn't depend on traffic.
- **Out of scope**:
  - Fixing performance or cold starts.
  - Targets, alerts or CI performance budgets.
  - Automating the lab run.
  - Labels beyond cold and warm.
  - Feature-usage analytics.
  - In-app figures.
  - Storing performance data in the app's database.
  - Paid tiers or other vendors.
- **Constitution**: no weather-data, schema or provider change (Principles I and III untouched). Any server-decided value reaches the page the way spec 012's mode does (Principle II). Testable logic stays in pure modules (Principle IV). The notice follows Principle V, and Principle VI's gate applies.
