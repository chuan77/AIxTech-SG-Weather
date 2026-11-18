# Contract: iPhone/iPad Add to Home Screen Button and Tip

Design choice (owner, 2026-11-18, analysis finding U1, option A2, then refined during implementation): the hint is a **labelled button on its own full-width line directly under the Add row** that opens a tip. The icon-only version didn't fit: Use my location and Add Location already fill the row at 375 px and in the 22rem sidebar. It is not a panel in the saved-place list, because that list is `hidden md:block` on phones, where places are switched from `PhoneDock`.

## Decision (`frontend/src/install/installHint.ts`, pure)

```ts
type HintInputs = {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;   // navigator.standalone === true || matchMedia('(display-mode: standalone)').matches
  dismissed: boolean;    // "Got it" pressed, from localStorage
  savedCount: number;    // locations.length from the store
};
isIosDevice(userAgent, maxTouchPoints): boolean
isIosSafari(userAgent, maxTouchPoints): boolean
shouldShowInstallHint(inputs: HintInputs): boolean   // controls whether the BUTTON renders
```

- `isIosDevice`: `/iPhone|iPad|iPod/` matches, **or** `/Macintosh/` matches and `maxTouchPoints > 1`.
- `isIosSafari`: `isIosDevice`, the user agent contains `Safari/` and `Version/`, and none of `CriOS`, `FxiOS`, `EdgiOS`, `OPiOS`, `GSA/`, `YaBrowser`, `DuckDuckGo`, `FBAN`, `FBAV`, `Instagram`, `Line/` appear.
- `shouldShowInstallHint` = `isIosSafari && !standalone && !dismissed && savedCount >= 1`.

Unit tests cover:
- iPhone Safari, iPad with a desktop user agent and touch points, iPad with an iPad user agent;
- Chrome, Firefox and Edge on iOS, the Google app, and Facebook or Instagram in-app browsers;
- Android Chrome, and Mac Safari with `maxTouchPoints` 0;
- standalone, dismissed, and 0 saved places.

## Stored flags

| Key | Value | Set when |
|---|---|---|
| `weather-starter.install-hint.dismissed` | `"1"` | Got it is pressed. The button and tip never render again |
| `weather-starter.install-hint.seen` | `"1"` | The tip is opened for the first time. The dot is no longer drawn |

- `readFlag(storage, key)` and `writeFlag(storage, key)` take a storage-like argument, so tests can pass a fake. Both catch every error. If writing fails, the component keeps the flag in memory for the page.
- Neither flag is sent to the server, logged or counted.

## Button (`frontend/src/components/InstallHint.tsx`, rendered in the Add row's flex container)

- **Placement**: in `frontend/src/components/Sidebar.tsx`, inside the existing `<div className="flex flex-wrap gap-2">` row, **after** `<UseMyLocation />` and `<AddLocationForm />`, with `basis-full`, so it wraps onto its own full-width line directly under them. It is not inside any `md:`-only wrapper, so it shows at phone and desktop widths. It renders `null` when `shouldShowInstallHint` is false, so the row is unchanged for everyone else.
- **Look**: the same height, shape and theme classes as the row's existing buttons (`min-h-11`, `rounded-card`, `border-white/15`, `bg-white/[0.07]`, `text-white/85`). Content: the iOS share glyph (`aria-hidden`) and the visible label **Add Lepak to Home Screen**. Theme classes only, no literal colours.
- **Dot**: while `seen` is false, a small dot sits on the button's top-right corner (`aria-hidden`), styled like the existing `dock-badge`.
- **Accessibility**:
  - `<button type="button" data-install-hint aria-expanded={open} aria-controls="install-hint-tip">`. Its accessible name is its visible label, "Add Lepak to Home Screen" (WCAG 2.5.3), so it has no `aria-label`;
  - Enter and Space toggle the tip;
  - it shows the theme focus ring.

## Tip

- **Opens** below the row, anchored to the button, as a non-modal popover: `<section id="install-hint-tip" aria-labelledby="install-hint-title" class="app-popover rounded-card …">`. It is opaque, like `DockSheet` (Opaque Pop-up Rule).
  - It doesn't trap focus, block scrolling or cover the dock. On narrow screens it spans the sidebar's width.
  - On open, it sets `seen`.
- **Text** (FR-006, FR-007):
  - Title (`id="install-hint-title"`): **Add Lepak to your Home Screen**
  - Steps: "Tap **Share** <share glyph, aria-hidden>, then **Add to Home Screen**."
  - Note: "The Home Screen app keeps its own list. Places saved here in Safari won't appear there, so you'll add them again."
  - Button: **Got it**
- **Closing**:
  - **Escape**, a tap or click outside, or tapping the button again closes the tip. The button stays, and focus returns to it.
  - **Got it** sets `dismissed` and closes the tip, and the button then renders `null`. Focus moves to the next focusable control in the row, Use my location being the first. Nothing is lost.
- **No** network call, interaction log containing the user agent, or analytics event (FR-020).
