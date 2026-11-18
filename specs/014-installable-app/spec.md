# Feature Specification: Installable App with an Offline Page

**Feature Branch**: `014-installable-app`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "Handoff from `.specify/assessments/installable-app/decision.md` (verdict go, Option B).
- **Problem:** phone users are meant to use this app instead of a phone weather app, but it is only a website. It has no icon of its own, opens in a browser frame and shows a browser error offline.
- **Approach:** the app gets its own name, icon and theme colour. Android offers to install it. iPhone users get an Add to Home Screen button with a short tip that also says the home-screen app starts with its own empty list of places. The app opens full-screen. With no connection an app-styled 'You're offline' page appears. The offline helper keeps only that page and the files it needs, never the app's own files, saved places or weather.
- **Out of scope:** offline last snapshot or saved list (step B); keeping app code or `/api` responses on the device; moving the visitor key from Safari to the iPhone app; app stores; push notifications; accounts or sync; new data.gov.sg calls; dashboard redesign; measuring installs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Put the app on the home screen (Priority: P1)

A person in Singapore who checks the weather on their phone before heading out adds the app to their home screen. On Android the browser offers to install it; on a laptop the browser shows its usual install option. Afterwards a "Lepak" icon sits on the home screen (or in the app list or dock), and tapping it opens the app full-screen, without the browser's address bar, showing their saved places as it does in the browser.

**Why this priority**: This is the core of the problem. The app is meant to replace a phone weather app, and one tap from the home screen is the nearest a web app gets to that. On its own it already meets the main goal.

**Independent Test**: On an Android phone (and on desktop Chrome or Edge), open the hosted app, install it from the browser's prompt or menu, then open it from the home screen. It opens full-screen with the app's own icon, name and colours, and the saved list is the same as in the browser.

**Acceptance Scenarios**:

1. **Given** a visitor on Android Chrome who has opened the app, **When** they choose the browser's install option, **Then** an icon named "Lepak" with the app's own artwork appears on the home screen.
2. **Given** the app is installed, **When** the visitor taps its icon, **Then** it opens full-screen without browser controls, and the system bar and launch screen use the app's colours rather than white.
3. **Given** a visitor on Android with saved places in the browser, **When** they install and open the app, **Then** the same saved places are listed.
4. **Given** a visitor on desktop Chrome or Edge, **When** they install the app, **Then** it opens in its own window with the app's icon and name.
5. **Given** any visitor in an ordinary browser tab, **When** they view the app, **Then** the tab shows the app's icon and the page looks and behaves as it does today.

---

### User Story 2 - iPhone users learn how to add it, and what happens to their places (Priority: P2)

An iPhone visitor in Safari doesn't get an install prompt from the browser. After they save their first place, an **Add Lepak to Home Screen** button appears on its own line directly under **Use my location** and **Add**, marked with a dot until they first open it. Tapping it opens a short tip explaining how to add the app to the home screen (Share, then Add to Home Screen). The same tip tells them plainly that the home-screen app keeps its own list, so places saved in Safari will not appear there and they will need to add them again. Once they add it, the icon and full-screen open match Android's.

**Why this priority**: iPhone users can't discover installation by themselves, and installing on iPhone can make their saved places seem to vanish. Telling them before they install prevents what would look like data loss. It depends on Story 1's icon and name being in place.

**Independent Test**: On an iPhone in Safari, save a place. The button appears directly under the Add row, opens a tip that explains the steps and the separate list, and disappears for good once the tip is dismissed with Got it. Following the steps gives the app's own icon and name, full-screen.

**Acceptance Scenarios**:

1. **Given** an iPhone or iPad visitor in Safari with at least one saved place who has not dismissed the tip, **When** they view the app, **Then** an "Add Lepak to Home Screen" button with a dot shows on its own full-width line directly under Use my location and Add, on phone and desktop widths alike.
2. **Given** the button is showing, **When** the visitor taps it, **Then** a tip opens below the row explaining Share → Add to Home Screen and that the home-screen app starts with its own, separate list of places, and the dot goes away.
3. **Given** the tip is open, **When** the visitor closes it with Escape or a tap outside, **Then** the tip closes, the button stays, and focus returns to the button.
4. **Given** the tip is open, **When** the visitor presses Got it, **Then** the tip and the button disappear and do not appear again on later visits in that browser.
5. **Given** a visitor who is not on iPhone or iPad Safari (Android, desktop, or an already-installed app), **When** they use the app, **Then** neither the button nor the tip appears.
6. **Given** an iPhone visitor who follows the tip, **When** they open the app from the home screen, **Then** it shows the "Lepak" icon and name and opens full-screen.
7. **Given** an iPhone visitor opening the home-screen app for the first time, **When** it loads, **Then** it shows the normal empty state for a visitor with no places, with no error.

---

### User Story 3 - A clear offline message instead of a browser error (Priority: P3)

A user taps the app's icon in a place with no signal, such as an MRT tunnel or a lift. Instead of the browser's error page, they see a short page in the app's own look saying they are offline, and that their places and weather will be there when they are back online, with a way to try again.

**Why this priority**: It completes the "feels like an app" goal, but it adds a background helper that stays on the device between visits. It must not cost the safety of deploys and rollbacks. It is the most contained of the three stories and can ship after them.

**Independent Test**: With the app opened once while online, cut the connection (device offline or browser offline mode) and open the app again. The app's offline page appears. Restore the connection and press try again: the normal app loads with current data.

**Acceptance Scenarios**:

1. **Given** the app has been opened at least once while online, **When** it is opened with no connection, **Then** the app's own offline page appears in the app's colours, not the browser's error page.
2. **Given** the offline page is showing, **When** the connection returns and the user presses try again, **Then** the normal app loads, fetched fresh from the server.
3. **Given** the device is online, **When** the app is opened, **Then** the page, the app's code and all saved-place and weather data come from the server as they do today, never from anything kept on the device.
4. **Given** the app is open and online, **When** a weather refresh fails because the connection drops, **Then** the app behaves as it does today (its existing error handling), and the offline page is not shown in place of the running app.
5. **Given** a new version of the app is deployed, or the live version is rolled back, **When** an existing user next opens the app online, **Then** they get the version that is live at that moment.

---

### Edge Cases

- **First visit while offline**: nothing has been kept yet, so the browser shows its own error page. This is accepted. The offline page works only after one online visit.
- **Install offered but declined**: on Android the visitor can dismiss the browser's install prompt. The app keeps working in the browser, and nothing in the app pesters them.
- **iPhone button in a non-Safari iOS browser** (for example Chrome on iPhone): these browsers use different menus, so the button must either give steps that match or not show. See FR-009.
- **Opened from the home screen and the server is down but the device is online**: the server's own error response is shown, as today. The offline page is for no connection, not for server errors.
- **Clearing site data**: the offline page and the iPhone tip's "dismissed" and "dot seen" memory are cleared with it. The button and its dot may show again, and the offline page returns after the next online visit.
- **Storage blocked** (private browsing, blocked site data): the button and its dot may show on each visit, and there may be no offline page. Neither causes an error.
- **Switching the offline helper off**: a release must be able to remove it from users' devices on their next online visit, leaving the app as it was before this feature.
- **Old helper after a rollback to a release from before this feature**: users who installed it must not be stuck on the offline page or on stale files. On their next online visit the app works normally.
- **Theme**: the app's themes change in-page colours only. The icon, launch colour and system bar colour stay fixed and must suit the default theme.

## Requirements *(mandatory)*

### Functional Requirements

**Install and identity**

- **FR-001**: The app MUST describe itself to browsers as an installable app, with the name "Lepak" (used both as the full name and under the icon), a full-screen standalone display, the app's start page, and launch and system-bar colours taken from the default theme's dark sky colours.
- **FR-002**: The app MUST provide its own icon in the sizes Android, iPhone/iPad and desktop browsers need, including a version that keeps its artwork inside the safe area when the system crops icons into a circle or other shape, and a browser-tab icon.
- **FR-003**: On browsers that offer installation (Android Chrome, desktop Chrome and Edge), the app MUST meet those browsers' installability requirements so the browser's own install option is available.
- **FR-004**: When opened from the home screen or as an installed app, the app MUST open full-screen and show the same content and saved places as in the browser on that device, with no new error.
- **FR-005**: The app MUST NOT add its own install button or prompt on browsers that already offer installation. Installation there stays with the browser's own controls.

**iPhone/iPad button and tip**

- **FR-006**: On iPhone and iPad Safari only, and only when the app is not already running from the home screen, the app MUST show a labelled "Add Lepak to Home Screen" button on its own full-width line directly under the Use my location and Add buttons, visible at phone and desktop widths (owner's choice, 2026-11-18: the two existing buttons already fill that row). The button MUST open a dismissible tip explaining how to add the app to the home screen. Until the visitor first opens the tip, the button MUST carry a small dot.
- **FR-007**: The tip MUST state, in plain words, that the home-screen app keeps its own list of places, separate from Safari's, so places saved in Safari won't appear there and will need to be added again.
- **FR-008**: The button MUST appear only after the visitor has saved at least one place. Closing the tip with Escape or a tap outside MUST keep the button. Pressing Got it MUST remove the button and tip, and they MUST NOT reappear in that browser unless site data is cleared.
- **FR-009**: The button and tip MUST NOT appear in other iOS browsers whose menus differ from Safari's, unless its steps are correct for that browser.
- **FR-010**: The button and tip MUST be reachable and dismissible by keyboard and screen reader. The button MUST have an accessible name and say whether the tip is open, and focus MUST return to it when the tip closes. The tip MUST NOT block use of the rest of the app while it is open.

**Offline page**

- **FR-011**: After at least one online visit, opening the app with no connection MUST show the app's own offline page instead of the browser's error page.
- **FR-012**: The offline page MUST say the user is offline, that their places and weather will appear when they are back online, and offer a way to try again. It MUST use the app's colours and be readable at the same contrast level as the rest of the app.
- **FR-013**: The offline page MUST NOT show any saved place, coordinate, weather reading or other personal or visitor-specific data.
- **FR-014**: Whatever the app keeps on the device for offline use MUST be limited to the offline page and the files that page itself needs. It MUST NOT include the app's own page or code, any saved-place or weather data, any request or response carrying the visitor key, or anything from other sites (map tiles, fonts, analytics).
- **FR-015**: Whenever the device is online, every page, the app's code and all data MUST come from the server exactly as they do today, so a deploy or rollback reaches users on their next online visit.
- **FR-016**: The offline page MUST be shown only when the app's page itself can't be reached because there is no connection. Failed data requests inside a running app MUST keep their existing handling.
- **FR-017**: There MUST be a documented way to switch the offline helper off in a later release, removing it and its kept files from users' devices on their next online visit.

**Unchanged behaviour**

- **FR-018**: The feature MUST NOT add any call to data.gov.sg or change when weather is fetched.
- **FR-019**: The feature MUST NOT add cookies, accounts or new identifiers, and MUST NOT send the visitor key anywhere new. The privacy notice's current statements MUST remain true without rewording.
- **FR-020**: The feature MUST NOT record whether, or how often, the app is installed or opened from the home screen.
- **FR-021**: In an ordinary browser tab the dashboard MUST look and behave as it does today, apart from the tab icon and, on iPhone/iPad Safari, the Add to Home Screen button and its tip.

### Key Entities

- **App identity**: the name, short name, icon set, launch and system-bar colours and start page that browsers read to install and launch the app. It is the same for every visitor and holds no personal data.
- **Offline page**: a fixed page, the same for every visitor, shown when the app is opened with no connection. It holds no visitor data.
- **Tip state**: two per-browser flags for the iPhone button, "dot seen" and "dismissed" (Got it), kept on the device and never sent to the server.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On an Android phone running current Chrome, the browser's install option is available on the hosted app, and after installing, the app opens from the home screen full-screen with the "Lepak" icon and name, in one tap.
- **SC-002**: On an iPhone running current Safari, following the tip's steps adds the app with the "Lepak" icon and name (not a page screenshot) and opens it full-screen.
- **SC-003**: Desktop Chrome or Edge offers installation, and the installed app opens in its own window with the app's icon.
- **SC-004**: With the device offline, after one earlier online visit, opening the app shows the app's offline page 100% of the time across the browsers tested (Android Chrome, iPhone Safari home-screen app, desktop Chrome), and never the browser's error page.
- **SC-005**: In a rollback drill (deploy a version, then roll back), a user who has used the newer version gets the rolled-back version on their next online open, with no manual steps such as clearing data.
- **SC-006**: An iPhone visitor with saved places can find the Add Lepak to Home Screen button directly under the Add row at a 375 px phone width. Its tip tells them, before they install, that the home-screen app will start without those places. After Got it, the button never shows again in that browser.
- **SC-007**: All existing automated checks still pass, and new browser checks of the installed and offline opens record no page error, unhandled rejection or console error.
- **SC-008**: An audit of what the app keeps on the device for offline use finds only the offline page and its own files, and nothing containing a saved place, weather reading or the visitor key.
- **SC-009**: The offline page, the iPhone button and its tip meet the same contrast level as the rest of the app (WCAG 2.1 AA), and the tip can be opened and dismissed by keyboard alone.

## Assumptions

- **Platform behaviour** (from the assessment, not yet verified against Apple or Google documentation; to be confirmed first in planning):
  - an iPhone/iPad home-screen app gets storage separate from Safari;
  - Android Chrome offers install given an app description, icons, a secure connection and, depending on the version, an offline helper;
  - iPhone uses its own icon size rather than the app description's icons.
  If the iPhone storage split turns out not to apply, FR-007's wording changes and the rest of the spec stands.
- **Name**: "Lepak", chosen by the owner on 2026-11-18. It is used as both the full name and the name under the icon. It is short enough to show untruncated under home-screen icons. It is a shortened form of "Lepak Weather", the name of the hosted app (`docs/deployment.md`). The hosted address and the page title are unchanged.
- **Icon**: no logo exists. A simple mark in the default theme's colours, made for this feature, is acceptable without a designer. It can be replaced later without changing anything else.
- **Fixed colours**: the launch and system-bar colours sit outside the page's theme system, so they are taken from the default theme and don't follow theme switches. This is a documented exception to theme-driven colours, limited to values that browsers read before the page loads.
- **No measurement of installs**, to keep the "anonymous visit counts" promise simple. Revisit only by a separate decision.
- **The tip's "dismissed" and "dot seen" memory** is a per-browser convenience, like the lightning layer's on/off choice. Losing it only means the button or its dot may show again.
- **No new dependencies are needed**, and the existing server already serves additional static files with the right types (checked in the assessment).
- **Browser checks** can simulate being offline. If the existing browser tool can't, the offline story is checked another way, documented in the plan.
- **The visitor-key behaviour from spec 013 is unchanged.** On Android and desktop the installed app shares the browser's saved places. On iPhone it starts empty, as the tip says.
- **Dependencies**: the hosted deployment on Vercel (secure connection already in place) and the existing rollback process in `docs/deployment.md`, which the rollback drill uses.
