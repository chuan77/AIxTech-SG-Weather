# Contract: privacy notice copy for visits and speed

This extends [spec 012's notice contract](../../012-vercel-web-analytics/contracts/privacy-notice-ui.md). Placement, the button and region behaviour, keyboard handling, `aria-expanded`/`aria-controls`, the 44 px touch target, theme tokens and scroll behaviour are all unchanged.

## When it is shown

| Visit counting (`web-analytics`) | Speed (`speed-insights`) | Notice |
|---|---|---|
| `off` | `off` | none |
| `measure`/`notice-only` | `off` | visits copy |
| `off` | `measure`/`notice-only` | speed copy |
| `measure`/`notice-only` | `measure`/`notice-only` | combined copy |

## Collapsed line (button's accessible name starts with it)

- Visits: `Anonymous visit counts · no cookies` (unchanged).
- Speed: `Anonymous speed stats · no cookies`.
- Both: `Anonymous visits & speed · no cookies`. Changed during implementation from "Anonymous visit & speed stats", which wrapped at 375 px.
- **Room**: on phones the empty state's side padding is 16 px (`px-4 py-10 md:p-10`, was `p-10`), giving 343 px. The radar theme's monospace font needs up to 316 px, and before the change even the visits label (302 px) wrapped in 295 px. Owner decision, 2026-11-20.
- In every case it fits **one line at 375 px** (`text-xs`) in every theme. The e2e check finds exactly one line box for the label, and a button no taller than 44 px.

## Explanation paragraphs (in order, only those that apply)

1. **Visits** (when visit counting is active). This is spec 012's existing sentences about Web Analytics: page, referrer, country, region and city, device type, OS and browser, and a daily-reset anonymous value.
2. **Speed** (when speed measurement is active). It covers these points in plain words:
   - We measure how quickly the page loads and responds on your device, to keep it fast.
   - Vercel Speed Insights, our host's built-in tool, records the page, your browser, operating system and device type, your country, your network speed, and which part of the page was slowest.
3. **Shared** (always). No cookies, no account, no precise location, and no tool sees your saved places.
4. **Saved places** (always). This is spec 012's existing sentences about the random code, clearing browser data and 90-day deletion.

The text is produced by `privacyCopy({ visits, speed })` in `frontend/src/analytics/privacyCopy.ts`, a pure module with unit tests for all four rows of the table above. The owner approves the final wording before release.

## Checks

`scripts/e2e/privacy-notice.sh` runs these modes:
- `E2E_WEB_ANALYTICS` and `E2E_SPEED_INSIGHTS` in `notice-only`/`off` combinations, giving three copy variants plus the none case;
- 375 px and desktop, all six themes;
- with and without saved locations.

It asserts:
- the label text;
- one line;
- the explanation mentions speed only when speed is active;
- zero measurement requests.
