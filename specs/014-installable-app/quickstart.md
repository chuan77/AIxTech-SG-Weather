# Quickstart: Validating the Installable App

Run everything from the repo root. Contracts: [app-manifest](contracts/app-manifest.md), [offline-helper](contracts/offline-helper.md), [install-hint](contracts/install-hint.md).

## 1. Gate

```bash
npm run verify            # lint (incl. sw.js) -> typecheck -> vitest -> build
ls frontend/dist/manifest.webmanifest frontend/dist/sw.js frontend/dist/offline.html frontend/dist/icons/
```

Expected:
- the new unit tests pass: `installHint.test.ts`, `offlineHelper.test.ts`, `staticHeaders.test.ts`;
- `dist/` contains the public files.

## 2. Automated browser check

```bash
scripts/e2e/installable-app.sh            # all: us1 us2 us3 themes
```

It starts its own temporary production server (`lib.sh`) and tears it down on exit. It must not be pointed at `npm run dev`.

| Sub-check | Asserts |
|---|---|
| `us1` | `/manifest.webmanifest` has type `application/manifest+json`, `Cache-Control: no-cache` and the exact fields. Each icon returns an image type, not HTML. Head tags are present and `<title>` is still `Weather`. `assert_clean` passes |
| `us2` | At 375 px and 1280 px, with an iPhone Safari user agent and 1 stubbed place: the round button is visible in the Add row (non-zero box, in the viewport) with a dot. Opening it shows the tip with the contract text and clears the dot. Escape closes it, keeps the button and returns focus to it. Got it removes the button, and it stays gone after reload. 0 places: no button. Chrome-on-iOS, Android and standalone stubs: no button |
| `us3` | After an online load, the worker is active and controls the page. Cache Storage is exactly `lepak-offline-v1` → `/offline.html`. `set offline on` + reload shows "You're offline" and no saved-place text. `set offline off` + Try again shows the dashboard. `/sw.js` has `Cache-Control: no-cache`. No page error or `console.error` at any step |
| `themes` | Button icon 3:1, tip text 4.5:1 and focus rings 3:1 in all six themes at 375 px. Offline page text 4.5:1 |

## 3. Android and desktop (manual, SC-001, SC-003)

1. Deploy a preview or production build, then open it in Chrome on Android.
2. Expect the install prompt or the "Install app" menu item. Install it.
3. The home-screen label reads **Lepak** with the app icon (not a letter or screenshot).
4. Open it: full-screen, a dark status bar, the same saved places as in the browser.
5. Desktop Chrome/Edge: use the install icon in the address bar. The app opens in its own window titled Weather, with the Lepak icon.

## 4. iPhone (manual, SC-002, SC-006, research R1)

1. In Safari with no saved places: no Add to Home Screen button in the Add row.
2. Save one place: the labelled **Add Lepak to Home Screen** button appears on its own line under the Add row, with a dot. Tap it: the tip shows the contract text and the dot goes away. A tap outside closes the tip and leaves the button.
3. Follow it: Share → Add to Home Screen. The suggested name is **Lepak** and the icon is the app's.
4. Open from the home screen: full-screen, the normal empty state, no error. This confirms R1, the separate list.
5. Back in Safari: after Got it, the button is gone, and stays gone after a reload.

## 5. Offline on a real phone (SC-004)

1. Open the installed app once online.
2. Turn on airplane mode and open the app again: the "You're offline" page appears in the app's colours.
3. Turn airplane mode off and tap Try again: the dashboard loads with current data.

**Results, 2026-11-18 (production, https://lepak-weather.vercel.app, owner's devices):**
- §4 iPhone Safari, steps 1–5: pass. No button with no places; the button and dot appeared after one save; the tip opened and closed as described; Add to Home Screen suggested **Lepak** with the app icon; the home-screen app opened full-screen to the empty state with no error, confirming R1 (a separate list); after Got it the button stayed gone across a reload.
- §5 Offline (installed iPhone app): pass. Airplane mode showed "You're offline" in the app's colours; Try again brought the dashboard back once online.
- §3 Android Chrome: not run, no Android device available. Covered only by the automated Chrome check (§2) and the live manifest check.
- §3 step 5, desktop Chrome/Edge: not run.

## 6. Rollback and kill-switch drills (SC-005, FR-017)

Run these on a local production server you started yourself (`E2E_BASE_URL`), or on a preview deployment, never on the user's dev server.

1. **Rollback**:
   1. Build and serve version A, and open it so the worker installs.
   2. Build version B with a visible change and serve it. Reload: B appears.
   3. Serve A again, as a rollback. Reload: A appears with no manual clearing.
   4. In production, after merge, repeat on a phone with the app installed: deploy a visible change, open the app, use Vercel Instant Rollback (`docs/deployment.md`), reopen the app, and confirm the old version shows without clearing data. Restore with `promote`. Record both deployment ids (task T032).
2. **Kill switch**:
   1. Copy `scripts/pwa/sw-kill.js` over `frontend/public/sw.js` and build with `VITE_OFFLINE_HELPER=off`.
   2. Serve it and reload twice.
   3. Expect no service-worker registration, no `lepak-offline-*` cache, and the dashboard working.
   4. Revert both changes afterwards.

**Results, 2026-11-18 (local production server, headless Chrome):**
- Rollback: build A with the helper active, then B (a `meta` marker added to `index.html`): the next open showed B. Rolling back to A: the next open showed A, with no clearing. Pass.
- Kill switch: `sw-kill.js` copied over `sw.js`, built with `VITE_OFFLINE_HELPER=off`. After two opens there was no registration and no `lepak-offline-*` cache, and the dashboard worked. No runtime errors. Pass.
- Note: run the drill only after `frontend/public/sw.js` is committed, so `git checkout frontend/public/sw.js` can restore it.
- Production Instant Rollback drill (step 1.4), 2026-11-18, iPhone with Lepak installed: pass.
  - Rolled back at 06:29 UTC from `lepak-weather-7wycbx2co` (`dpl_EJxQ8xd6vnySi1meqnEuBAfFMnWR`, spec 014) to `lepak-weather-2d85zugii` (`dpl_FYzdod6SdmrDJn9d8jEDaGx4uGag`, before spec 014). Hobby allows only the previous deployment, so the pre-014 build was the marker: `/manifest.webmanifest` and `/sw.js` came back as `text/html`, `/health` stayed healthy.
  - The installed app, reopened online, loaded the usual dashboard with no offline page and no error, and Safari showed the usual dashboard, with no data cleared. This also confirms the `docs/deployment.md` note that the helper is harmless under a pre-014 build.
  - Restored with `promote` at 06:34 UTC: the manifest and `sw.js` are served with their own types again. Each step took 2–3 s.

## 7. Privacy

- The privacy notice text is unchanged (`scripts/e2e/privacy-notice.sh` still passes).
- No request carries the visitor key except `/api/locations*`, as before.
