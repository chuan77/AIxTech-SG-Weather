# UI Contract: Heat Stress tile

- **Title**: "Heat Stress". This tile is the only place the words "Heat Stress" appear (FR-008). The `feelsLike.test.ts` rule keeps it out of the feels-like tile.
- **Placement**: in `TileGrid`, next to "Feels Like", as a normal (1-column) tile.
- **States** (from `heatStressView`, see [data-model.md](../data-model.md)):
  - `reading`:
    - Large `{value}°` WBGT.
    - The level label, styled by tone. Low is plain. Moderate is semibold with a subtle `bg-white/10` chip. High is bold with a stronger `bg-white/20` chip and ring.
    - A WBGT scale bar from 25 to 35 °C that reuses `ScaleBar` and the existing status gradient.
    - The guidance line, only when it is not null.
    - A footer: `{stationName} · {distance} km · {HH:mm}`.
  - `no-nearby-station`: "No nearby station", with a `title` tooltip naming the station and its distance.
  - `no-reading`: "No reading".
- **Theming**: chips and text use `white` classes only, so they map to `--ink`. The tile goes inside `TileShell`, which carries `rounded-card` (Principle V).
- **Width**: at phone width the footer wraps and nothing scrolls sideways.
