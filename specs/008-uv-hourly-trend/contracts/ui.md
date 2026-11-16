# Contracts: UV tile UI

## Placement (research R3)

Outdoor grid order becomes: Heat & Comfort panel (full width), Rainfall (two columns), **UV (two columns)**, Air Quality (two columns on a phone, four at `lg`).

| Width | Layout |
|---|---|
| Phone (2 columns) | Rainfall, UV, Air Quality, each at full width |
| `lg` (4 columns) | Rainfall (2) \| UV (2), then Air Quality (4), open or closed |

Rainfall widens (full width on a phone, two columns at `lg`) and closed Air Quality takes the full row at `lg`, so the grid has no empty cells at either width. Tiles in the other grids keep their size. The hero summary is untouched (FR-014).

## Tile anatomy (top to bottom)

1. Heading "UV Index" with the sun icon (unchanged `TileShell`).
2. Current value, band label and 0–11 gauge, unchanged (FR-014).
3. **Status line**:
   - direction and count, e.g. `Falling · 2 h at UV 3+ (Moderate or higher) so far`
   - zero hours: `No hours at UV 3+ so far`
   - previous day: `14 Nov · 3 h at UV 3+ (Moderate or higher)`, with no direction
   - previous day, zero hours: `14 Nov · No hours at UV 3+`
4. **Hourly view**: 13 equal columns, 07 → 19.
   - **Reported slot**: the number above the bar, and a bar whose height is value/11 (capped at full height, so 12+ doesn't overflow), filled from `--scale-uv` at the value's position (research R4; a 1/22-wide slice centred on the value, `uvBarPosition`). A value of 0 shows a 2 px baseline bar, distinct from empty.
   - **Empty slot**: no bar and no number, a faint dotted baseline (`border-white/20`). Never a 0.
   - **UV 3 marker**: a dashed horizontal line at 3/11 height across the view (`border-white/40`).
   - **Peak window**: a background band behind the 11, 12, 13 and 14 columns (`bg-white/[0.06]`).
   - **Legend** (below the hour axis, `text-[10px] text-ink-muted`): a dashed swatch `UV 3 (Moderate)` and a band swatch `NEA: usual peak 11 am – 3 pm`. Implemented as a legend rather than an in-plot label, because a label at the right edge overlapped the 19:00 slot's number.
   - **Hour axis**: labels at 7, 10, 13, 16 and 19 only (avoids crowding), `text-[10px] text-ink-muted`.
5. **Guidance line** (FR-008, `text-xs text-ink-muted`): `UV usually peaks 11 am – 3 pm (NEA). Use SPF 30+ sunscreen, applied 20–30 min before going into the sun (HealthHub).`
6. **Source line** (FR-009), by state:
   - readings, today: `Nationwide reading, measured at Changi · as of 15:11` (time from `uv_hourly.as_of`; without ` · as of …` when `as_of` is null)
   - readings, previous day: `Readings for 14 Nov, measured at Changi`
   - pre-feature and empty: `Nationwide reading, measured at Changi`. When the snapshot is stale, the tile's existing `asOf` prop is appended in its own wording, e.g. `· as of Yesterday 14:00` (`Hero.tsx` sets it only for stale snapshots)
   - unavailable: `Nationwide reading, measured at Changi`, with no time

## Other states (data-model table)

| State | Replaces items 3–4 with |
|---|---|
| unavailable | nothing new; value shows `--`, label `Unavailable` (as today) |
| pre-feature | `Hourly view appears after the next refresh.` |
| empty | `No UV readings yet.` |

Items 5 and 6 still show in every state except unavailable, where only item 6 shows (without "as of").

## Accessibility

- The hourly view is an `<ol aria-label="Hourly UV, 15 Nov">`, one `<li>` per slot. Each slot has screen-reader text such as `11:00, UV 4, Moderate` or `16:00, no reading`. The visual bars are `aria-hidden`.
- Colour never carries meaning alone: every reported slot shows its number (WCAG 1.4.1).
- All text uses `text-white/85+` or `text-ink-muted` (theme contrast rules, `docs/theming.md`). No literal colours.
- No horizontal scroll at 360 px in any of the six themes (SC-006). On viewports narrower than 340 px, the hourly view (with its legend) hides and items 3, 5 and 6 remain (FR-015 fallback; plan Design Note 5, `.uv-hourly` in `index.css`).
