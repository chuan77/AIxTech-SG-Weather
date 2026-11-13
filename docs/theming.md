# Theming

`frontend/src/theme/` (registry in `themes.ts`, `ThemeContext.tsx`) sets `data-theme` on `<html>` and persists the choice in `localStorage` (`weather-theme`). Palettes are CSS-variable blocks in `frontend/src/index.css`.

- `tailwind.config.js` maps `white` to `rgb(var(--ink) / <alpha-value>)`, so every `text-white/…`, `border-white/…` and `bg-white/…` class follows the theme. Light themes set `--ink` to a dark colour. For something that must stay literally white (for example icons on the map's dark buttons) use `text-[#fff]`.
- `rounded-card` (radius from `--card-radius`) marks every themeable panel. Themes style it through `[data-theme='…'] .rounded-card`.
- Each theme in `themes.ts` also names its map basemap (`voyager`, `dark_all`, `light_all`).
- To add a theme: a `[data-theme='…']` block in `index.css` plus an entry in `THEMES`.
- Every theme block also sets `--lightning`, the fill colour of lightning strike markers on the map (read by `LightningLayer`). The map's lightning controls and status strip use the same literal dark-glass style as the map's other buttons (`bg-black/…` with `text-[#fff]`) so they stay legible on every basemap.
- `apple` is the original design and the default; keep it visually unchanged.
