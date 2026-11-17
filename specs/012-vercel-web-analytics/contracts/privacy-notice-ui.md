# Contract: Privacy notice UI

Shown only when the analytics mode is `measure` or `notice-only` (see [index-html-meta.md](index-html-meta.md)).

## Placements

| View | Location | Present when |
|---|---|---|
| Selected location | `Hero` footer, its own line after "Weather for … · source" | mode ≠ `off` |
| Empty state (no saved locations) | `Hero` early-return block, under "Add a Singapore town…" | mode ≠ `off` |

The final position relative to the 375 px `PhoneDock` is confirmed by an `impeccable` review. It must not sit under the dock or add scroll above the weather content.

## Accessible structure (what `privacy-notice.sh` locates)

- A `button`, accessible name starting "Anonymous visit counts", with `aria-expanded="false"` and `aria-controls` pointing to the explanation's `id`.
- Activating it (click, Enter, Space, tap) sets `aria-expanded="true"` and reveals the explanation region in place. Focus stays on the button, and the page does not navigate or scroll away.
- Activating it again collapses it. Escape while focus is inside the explanation also collapses it and returns focus to the button.
- The explanation text contains the FR-008 facts: page, linking site, country/region/city, device type, OS, browser, Vercel Web Analytics; no cookies, no account, no precise location, not saved places; daily reset.

## Visual rules

- Collapsed: one line at 375 px, `text-xs`, `text-ink-muted`, hover and focus per theme tokens (`--focus-ring`). Minimum touch target 44 px tall, as the footer's Remove button already uses (`min-h-11`).
- Expanded: body text ≥ 4.5:1 contrast in all six themes. No literal colours. If drawn as a panel, it is marked `rounded-card`.
- Expanding never moves content **above** the notice.
