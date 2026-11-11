# Themes

The themes registered in `frontend/src/theme/themes.ts`, with palettes in `frontend/src/index.css`. For the mechanics (`--ink`, `rounded-card`, how to add one) see [docs/theming.md](docs/theming.md).

This file was written from the code. Design rationale from earlier discussions was not available, so the considerations below are what the implementation shows.

| id        | Label          | Mood                                                                  | Basemap     |
| --------- | -------------- | --------------------------------------------------------------------- | ----------- |
| `apple`   | Apple          | Muted slate-blue sky, thin type. The original design and the default. | `voyager`   |
| `glass`   | Apple Glass    | Brighter blue sky, frosted panels.                                    | `voyager`   |
| `radar`   | Midnight Radar | Dark console, glowing cyan data.                                      | `dark_all`  |
| `sticker` | Pastel Sticker | Soft peach, mint and lilac, chunky pill cards.                        | `light_all` |
| `memphis` | Neo-Memphis    | Off-white ground, hard black outlines, offset pink shadows.           | `light_all` |

## Descriptions and design considerations

### Apple (`apple`)

- Slate-blue gradient background, white text (`--ink: 255 255 255`), translucent dark sidebar.
- Hero temperature in weight 200 (very light). 1rem card radius, 1px translucent white border, no shadow.
- Default theme. Keep it visually unchanged; the other themes override its variables.

### Apple Glass (`glass`)

- Overrides only what differs from Apple: brighter sky gradient, stronger card border (45% white), larger radius (1.25rem).
- Pin labels are a deeper blue and the selected pin dot is warm yellow (`#ffd479`) for contrast on the brighter sky.

### Midnight Radar (`radar`)

- Near-black navy background with a faint cyan glow, white text.
- Cyan (`#00e5ff`) temperature, teal card borders with a cyan glow shadow, tight 0.375rem radius.
- Monospace body font (JetBrains Mono). The selected pin is amber (`#ffb000`) so it stands apart from the cyan accents.
- Uses the dark basemap.

### Pastel Sticker (`sticker`)

- Light theme: `--ink` is dark purple, so every `text-white/…` class renders dark.
- Peach background with mint and lilac radial blobs. Opaque cream cards, and a stronger yellow fill for the selected card.
- 1.75rem radius, no border, and a solid pink "sticker" drop shadow (`0 6px 0`).
- Heavy purple temperature (weight 800), Nunito font, purple primary button with white text.
- The map is lightly sepia-filtered to sit with the warm palette.

### Neo-Memphis (`memphis`)

- Light theme with near-black ink and an off-white ground patterned with pink and teal dots.
- White cards with 2px black borders and a hard offset pink shadow (`6px 6px 0`). The selected card is yellow.
- Teal temperature, Poppins font, yellow primary button with black text.
- 0.75rem radius.

## Cross-theme considerations

- **Contrast flips through `--ink`.** `white` in Tailwind maps to `rgb(var(--ink))`, so light themes only set a dark ink and existing classes follow. Use `text-[#fff]` for anything that must stay white, such as icons on the map's dark buttons.
- **`rounded-card` is the hook for panels.** Radius, border and shadow come from `--card-radius`, `--card-border` and `--card-shadow`. Light themes add an opaque `--card-bg` and `--card-bg-selected`, since translucent white panels would vanish on a light ground.
- **Each theme picks a basemap** to match its brightness: `dark_all` for dark, `light_all` for light, `voyager` for the blue themes.
- **Map pins are themed** through the `--pin-*` variables. Selected pins must contrast with unselected ones in every palette.
- **Choice persists** in `localStorage` under `weather-theme`, falling back to `apple` if storage is blocked or the saved id is unknown.
- **Adding a theme:** add a `[data-theme='…']` block in `index.css`, include it in the shared `.rounded-card` selectors, and add an entry to `THEMES` in `themes.ts`. The selector lists `THEMES` automatically.

## Proposed themes (pending, not implemented)

Status: **pending**. None of these are in `themes.ts` or `index.css` yet. Build them one at a time, then move each into the tables above.

Basemap guidance: dark themes use `dark_all`, light themes `light_all`, mid-tone themes `voyager`.

| #   | id (suggested) | Name             | Description                                          | Color                                                                 | Typography                                             | Cards                                                        | Density                  |
| --- | -------------- | ---------------- | ---------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ | ------------------------ |
| 1   | `almanac`      | Paper Almanac    | A farmer's almanac printed on warm newsprint.        | Cream `#f4ecd8` ground, ink-brown text, rust accent                   | Serif display (Fraunces), Source Serif body            | Flat, 1px brown rule, no radius, no shadow                   | Comfortable              |
| 2   | `monsoon`      | Monsoon          | Storm-cloud greys with a flash of electric violet.   | Charcoal-blue gradient, violet `#9b7bff` temperature                  | Inter, medium weight                                   | Translucent slate, 0.75rem radius, faint violet border       | Comfortable              |
| 3   | `kopitiam`     | Kopitiam         | Singapore coffee-shop tiles and enamel signage.      | Mint-green walls, red and cream accents, dark brown text              | Rounded sans (Baloo-style), bold headings              | Opaque cream, 0.5rem radius, thick red border                | Roomy                    |
| 4   | `terminal`     | Terminal Green   | A phosphor CRT weather readout.                      | Black ground, `#33ff66` text and temperature                          | Monospace throughout (IBM Plex Mono), uppercase labels | No fill, 1px green outline, 0 radius, scanline overlay       | Compact                  |
| 5   | `sunset`       | Sunset Gradient  | Golden-hour warmth that reads like a sky.            | Orange-to-magenta-to-indigo gradient, white ink                       | Poppins, light-weight temperature                      | Frosted translucent white, 1.5rem radius                     | Roomy                    |
| 6   | `brutalist`    | Brutalist        | Raw, unstyled, loud.                                 | White ground, black ink, one acid-yellow highlight                    | Heavy grotesque (Archivo Black) headings, system body  | Hard 3px black borders, 0 radius, no shadow                  | Compact                  |
| 7   | `blueprint`    | Blueprint        | Technical drawing of the sky.                        | Cyan-blue `#0b3d91` ground, white line work                           | Monospace (Space Mono)                                 | No fill, dashed white borders, grid-paper background         | Compact                  |
| 8   | `nordic`       | Nordic Minimal   | Quiet Scandinavian restraint.                        | Off-white `#f5f6f7`, slate text, one muted-teal accent                | Light geometric sans (Jost)                            | White, 0.25rem radius, 1px hairline, no shadow               | Roomy                    |
| 9   | `vaporwave`    | Vaporwave        | Retro-futurist neon on a sunset grid.                | Deep purple ground, hot-pink and cyan accents                         | Futuristic display (Orbitron) for the temperature      | Dark translucent, neon pink glow border, 0.5rem radius       | Comfortable              |
| 10  | `ukiyoe`       | Ukiyo-e          | Woodblock print inspired by Japanese prints.         | Indigo, paper-beige, vermilion seal-red accent                        | Serif with a brush-style display for the temperature   | Beige panels, thin indigo border with inner double rule      | Comfortable              |
| 11  | `contrast`     | High Contrast    | Accessibility-first, maximum legibility.             | Pure black ground, white text, yellow `#ffd400` focus and temperature | Large system sans, bold                                | Solid black, 2px white border, 0.5rem radius                 | Roomy, larger type       |
| 12  | `forest`       | Forest Dusk      | Calm, earthy greens at twilight.                     | Deep pine gradient, moss and amber accents                            | Lora headings, Nunito body                             | Dark green translucent, 1rem radius, soft inner glow         | Comfortable              |
| 13  | `neumorphic`   | Soft Neumorphism | Pillowy extruded surfaces on one tone.               | Single light-grey `#e4e8ee` ground, blue-grey ink                     | Rounded sans (DM Sans)                                 | Same-colour fill, dual light and dark shadows, 1.5rem radius | Roomy                    |
| 14  | `newsroom`     | Newsroom         | Broadsheet front page with column rules.             | White and black, red `#c00` accent for alerts                         | Serif headlines (Playfair), small-caps labels          | No fill, top and bottom rules, 0 radius                      | Dense, multi-column feel |
| 15  | `aurora`       | Arctic Aurora    | Dark polar sky with shifting green and violet bands. | Near-black teal, aurora green `#4dffb4` and violet gradients          | Light Outfit sans                                      | Dark glass, 1rem radius, gradient hairline border            | Comfortable              |

### Design considerations for the proposals

- **Light themes need a dark `--ink` and an opaque `--card-bg`**, as Sticker and Memphis do: Paper Almanac, Kopitiam, Brutalist, Nordic Minimal, Newsroom and Neumorphism.
- **Hardest to build:** Neumorphism and Blueprint need new card-shadow and background-pattern variables, not just a palette swap. Terminal Green's scanline overlay is similar.
- **High Contrast is defined by an accessibility goal.** Check its ratios against WCAG AAA, and keep a visible focus ring.
- **Fonts** need loading (Google Fonts or self-hosted) for every theme that names one; check how `frontend/index.html` loads Nunito, Poppins and JetBrains Mono for the existing themes.
- **Map pins** need `--pin-*` values per theme, with selected pins contrasting against unselected ones.
- **Recommended first four:** Paper Almanac, Terminal Green, Blueprint and Arctic Aurora. They are distinct from each other and from the existing five, and cover light, dark and pattern-heavy cases without new mechanics beyond a background pattern.
