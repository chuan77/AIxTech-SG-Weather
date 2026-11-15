# Contract: Strike marker (UI)

What a strike looks like on the map. This replaces the `CircleMarker` description in `specs/002-lightning-map-layer/research.md` §7.

- **Shape**: a single filled bolt silhouette (no cloud, no chip, no label), centred on the strike's position. It is not the `thunder` weather glyph.
- **Colour**: fill `var(--lightning)`, stroke `var(--lightning-outline)`. Both are defined in every `[data-theme]` block of `frontend/src/index.css`. There are no literal colours in the component.
- **Age**: 12 five-minute steps. Size goes from 24 px down to 14 px and fill opacity from 1.0 down to the floor (default 0.25, overridable per theme with `--lightning-fill-floor`). The outline is never faded.
- **Layering**: pane `lightning`, z-index 450. Saved-location pins (marker pane, 600) stay above it and stay selectable.
- **Interaction**: click or tap opens the existing popup (type, time, relative age). Not in the Tab order (`keyboard: false`), as with today's circles. The lightning on/off control stays keyboard-operable and unchanged.
- **Accessibility**: the SVG is `aria-hidden`. The status strip's `role="status"` count ("N strikes in the last hour") stays the accessible summary.
- **Contrast**: the outline (or fill, on dark basemaps) is ≥ 3:1 against the theme's basemap at every step.
