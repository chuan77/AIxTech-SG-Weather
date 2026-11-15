---
name: AIxTech SG Weather
description: A doorstep-glance weather dashboard for saved Singapore places, frosted panels over the day's sky.
colors:
  ink: "#ffffff"
  sky-high: "#3b4959"
  sky-mid: "#303e4d"
  sky-low: "#273442"
  sky-deep: "#202a36"
  harbour-slate: "#2c3f54"
  sidebar-shade: "rgba(0, 0, 0, 0.2)"
  glass-fill: "rgba(255, 255, 255, 0.08)"
  glass-fill-raised: "rgba(255, 255, 255, 0.2)"
  glass-edge: "rgba(255, 255, 255, 0.15)"
  glass-edge-raised: "rgba(255, 255, 255, 0.3)"
  porcelain-button: "rgba(255, 255, 255, 0.9)"
  midnight-text: "#0f172a"
  pin-blue: "#3b82f6"
  marigold-selected: "#f59e0b"
  lightning-yellow: "#ffd21f"
  blush-error: "#fee2e2"
  scale-good: "#34d399"
  scale-fair: "#fde047"
  scale-caution: "#fb923c"
  scale-danger: "#ef4444"
  scale-extreme: "#d946ef"
  range-cool: "#7dd3fc"
  range-warm: "#fdba74"
  flag-green: "#3ecf7a"
  flag-yellow: "#ffc93d"
  flag-orange: "#ff8a2a"
  flag-red: "#d62e1f"
  flag-purple: "#9b5cff"
  flag-text-green: "#06210f"
  flag-text-yellow: "#2b1a00"
  sky-calm-top: "#1a2833"
  sky-calm-base: "#132029"
  sky-storm-top: "#363250"
  sky-storm-base: "#151326"
  sky-haze-top: "#2a241c"
  sky-haze-base: "#1d1913"
  sky-heat-top: "#47291f"
  sky-heat-base: "#1e110e"
  sheet-lightning: "#ffe14a"
  clear-patch-teal: "#5eead4"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "5rem"
    fontWeight: 200
    lineHeight: 1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 300
    lineHeight: 1.25
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.25rem
  caption:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1rem
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.14em"
rounded:
  input: "6px"
  field: "8px"
  map: "12px"
  card: "1rem"
  pill: "9999px"
spacing:
  hairline: "4px"
  tight: "8px"
  stack: "12px"
  card: "16px"
  page: "24px"
  page-wide: "32px"
components:
  card:
    backgroundColor: "{colors.glass-fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px"
  card-selected:
    backgroundColor: "{colors.glass-fill-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  button-primary:
    backgroundColor: "{colors.porcelain-button}"
    textColor: "{colors.midnight-text}"
    rounded: "{rounded.input}"
    padding: "6px 12px"
    typography: "{typography.caption}"
  button-pill:
    backgroundColor: "{colors.glass-fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
    typography: "{typography.caption}"
  button-refresh-mobile:
    backgroundColor: "{colors.harbour-slate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "48px"
    padding: "0 20px"
    typography: "{typography.body}"
  input-search:
    backgroundColor: "{colors.glass-fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "8px 12px 8px 36px"
    typography: "{typography.body}"
  input-field:
    backgroundColor: "{colors.glass-fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    padding: "6px 8px"
    typography: "{typography.body}"
  chip-location:
    backgroundColor: "{colors.glass-fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    height: "44px"
    padding: "8px 14px"
  chip-location-selected:
    backgroundColor: "{colors.glass-fill-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    height: "44px"
  popover:
    backgroundColor: "{colors.harbour-slate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
  flag-low:
    backgroundColor: "{colors.flag-green}"
    textColor: "{colors.flag-text-green}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
  flag-moderate:
    backgroundColor: "{colors.flag-yellow}"
    textColor: "{colors.flag-text-yellow}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
  flag-high:
    backgroundColor: "{colors.flag-red}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
---

# Design System: AIxTech SG Weather

## Overview

**Creative North Star: "The Doorstep Glance"**

Every screen is designed for the moment just before someone steps outside. They have a few seconds and one hand free. The page answers with one large reading: the place name, a very large hairline-weight temperature, and the day's high and low with the time of the last update. Everything below it is quieter and lighter, and holds back until the user wants more detail. Hierarchy comes from size and how strong the ink is. Colour carries very little of it.

The default Apple theme puts frosted, translucent panels over a gradient of the day's sky, slate blue going darker towards the bottom. One ink colour (white in Apple) does all the work. Text, borders, fills and dividers are that same ink at different opacities, so the panels look like part of the sky rather than objects placed on top of it. Components are quiet but tactile. At rest they are faint frosted panels with hairline edges. When pressed or selected they clearly brighten and lift, and on touch screens every control is big enough for a thumb.

The visual identity sits in a swappable set of CSS variables, while the layout stays fixed. Five alternative themes (Apple Glass, Midnight Radar, Pastel Sticker, Neo-Memphis, Singapore Sky), six themes in all, replace the materials completely and keep the same structure and hierarchy. Apple is the reference theme. It changes only in deliberate theming work.

Singapore Sky is the only theme that reads data. Its ground is not a fixed palette but the selected place's sky, repainted from that location's stored snapshot so the page answers "can I go out?" before any number is read. Four dark Singapore skies, chosen in strict precedence storm > haze > heat > calm: a bruised-violet 3 pm storm under a lumpy cloud base with slanted rain sheets (thunder in the current condition, or in the forecast period covering now); a smoky sepia haze with a smoke veil and a dull sun disc (24-hour PSI above 100); a scorched rust heat burning up from the bottom edge (NEA High heat stress from a WBGT station within 10 km); and a blue-grey calm with cumulus heads, which is also the answer whenever a reading is missing, so the sky never guesses. White ink, NEA flag colours on the heat-stress pills and banded gauges, and the system font stack: its character comes from the sky and the flags.

**Key Characteristics:**
- The hero leads with a verdict, not a number: a title-size line answering "can I go out?" (storms, heat stress, UV from High, PSI), with lightning near the place above it when a fresh check found any. Below it, one large hairline-weight temperature (5rem, 5.5rem from md, weight 200) is still the only display-size number. *(Decided 2026-11-15, approved by the owner as deliberate theming work, Apple included: in Singapore the temperature barely moves, so it no longer holds the headline.)*
- One ink colour, used at different opacities, makes every text colour, border and fill.
- Translucent frosted panels with a 1rem radius and a hairline edge, with no shadow at rest.
- Small, wide-tracked uppercase labels name each panel. The data, not the labels, does the talking.
- Colour is reserved for data scales (UV, air quality, heat stress, temperature range) and map markers.
- Phone first: the whole page scrolls on phones, controls are 44px or larger, and Refresh sits within thumb reach.
- In Singapore Sky the ground itself is a reading: one of four sky states, crossfaded through registered colour tokens, with a single one-shot lightning flicker as its only authored motion.

## Colors

The base is a cool slate-blue sky gradient with white ink. Saturated colour appears only where it encodes data.

### Primary
- **Ink** (`ink`): the single foreground colour. Text, icons, borders, fills and dividers all derive from it through opacity: full strength for headings and values, 85–95% for body, and `ink-muted` for secondary text, labels, timestamps and placeholders. `ink-muted` is set per theme (85% in Apple, Glass, Sticker and Singapore, 72% in Radar and Memphis) at the lowest strength that clears 4.5:1 on every panel state. No text goes below it. Borders are 10–15% (30% when selected). Fills are 7–8% at rest, 12–14% on hover and 20% when selected. In code this is `rgb(var(--ink) / α)` through Tailwind's remapped `white`.

### Secondary
- **Marigold Selected** (`marigold-selected`): the dot of the selected map pin. It is the one warm accent that means "this is the place you're looking at".
- **Pin Blue** (`pin-blue`): the dots of unselected map pins.
- **Lightning Yellow** (`lightning-yellow`): lightning-strike markers on the map, and nothing else.

### Tertiary (data scales)
- **Good → Fair → Caution → Danger** (`scale-good` → `scale-fair` → `scale-caution` → `scale-danger`): the gradient behind the UV index, air-quality and heat-stress gauges, shown at 80% opacity with an ink-coloured marker dot.
- **Extreme** (`scale-extreme`): replaces Danger at the top of the UV scale.
- **Range Cool → Range Warm** (`range-cool` → `range-warm`, via amber): the daily low-to-high bar in the 4-day forecast.
- **Gauge fills** (`--scale-psi`, `--scale-wbgt`, `--scale-uv`): each gauge reads its fill from a per-theme token. The `:root` defaults reproduce the original gradients exactly (Good → Fair → Danger for PSI and WBGT, Good → Fair → Extreme for UV), so the other five themes render as they always have.
- **NEA Flags** (`flag-green`, `flag-yellow`, `flag-orange`, `flag-red`, `flag-purple`, Singapore Sky only): the official NEA band colours. Singapore draws the gauges as hard bands at the NEA cut-offs, separated by a 2px transparent gap, so the marker always sits on its band's colour: PSI 50 / 100 / 200 over 0–300 (green, yellow, orange, red); WBGT 31 / 33 °C over 25–35 °C (green, yellow, red); UV 2 / 5 / 7 / 10 over 0–11 (green, yellow, orange, red, purple). Green, yellow and red also fill the heat-stress flag pills.

### Neutral
- **Sky High / Mid / Low / Deep** (`sky-high`, `sky-mid`, `sky-low`, `sky-deep`): stops of the 170° page gradient. Two soft radial glows sit on top of it: a white glow top-right like sun breaking through cloud, and a blue-grey glow bottom-left.
- **Harbour Slate** (`harbour-slate`): an opaque surface for pop-ups (the town list) and for the phone bottom dock, wherever see-through panels would be unreadable over content.
- **Sidebar Shade** (`sidebar-shade`): a 20% black wash that sets the sidebar back from the main panel.
- **Porcelain Button** (`porcelain-button`) with **Midnight Text** (`midnight-text`): the only solid-filled button, for confirming an action.
- **Blush Error** (`blush-error`): error text, shown on a 15% red fill with a 30% red-tinted border.
- **Singapore skies** (`--sky-1` to `--sky-4`, Singapore Sky only): the four stops of the 172° ground gradient, set per sky state. The frontmatter records each state's top and base stop (`sky-calm-*`, `sky-storm-*`, `sky-haze-*`, `sky-heat-*`). Material tokens layer over them, each a colour whose alpha fades the material in or out: `--sky-cloud` (storm cloud base), `--sky-underlight` (violet light under the cloud), `--sky-rain` (rain sheets), `--sky-cumulus` (calm cumulus heads), `--sky-sun` and `--sky-smoke` (haze sun disc and veil), `--sky-horizon` (heat burn from the bottom edge), and `--sky-glow-top` / `--sky-glow-low`. Every material is always present in the background stack; a state only changes its colours.
- **Sun position** (`--sun-at`, `--sun-r`): where the hazy sun disc hangs and how big it is, 84% 9% at a 46px radius on desktop, 84% 27% at 32px on phones so it sits beside the hero.
- **Sheet Lightning** (`sheet-lightning`) and **Clear-Patch Teal** (`clear-patch-teal`): in Singapore Sky, the lightning-strike markers, focus ring, text caret and selection tint use the lightning yellow, so the selected map pin takes a teal that cannot be confused with a strike.

### Named Rules
**The One Ink Rule.** Every foreground colour is the theme's ink at some opacity. Never hard-code white, grey or slate for text or borders. Map overlay buttons take their colours from the theme's `--map-control-*` tokens.

**The Colour Means Data Rule.** Saturated hues encode a measurement (UV, PSI, heat stress, temperature range) or a map marker. They are never used for decoration, branding or emphasis.

**The Flag Text Exception.** NEA flag pills in Singapore Sky are the one scoped exception to the One Ink Rule. White ink cannot be read on green or yellow, so the Low flag uses fixed dark text (`flag-text-green`) and the Moderate flag fixed dark text (`flag-text-yellow`). The High flag keeps white on `flag-red`, with a light 1px border (white at 55%) because red on the dark sky is under 3:1 as an edge. The exception covers only these pills. It is consistent with the Colour Means Data Rule, since in this theme the flags and the sky itself carry data.

**The Sky Is Data Rule.** In Singapore Sky the ground is a measurement. It changes only through `skyState()` (storm > haze > heat > calm, calm when data is missing or the reading is stale), never for decoration, time of day or mood. A new sky state needs a data trigger and a place in that precedence.

**The Lightest-Point Contrast Rule.** Every Singapore sky state is budgeted so that 85% ink clears 4.5:1 on a selected (20%) card at the sky's lightest point, with each material's effective alpha included. Rain is masked out of the hero reading. The worst case is haze at 4.58:1, so any brighter material or lighter stop must be rechecked against this budget.

## Typography

**Display Font:** the system sans-serif stack (`--font-body`, set per theme)
**Body Font:** the same stack

**Character:** a single family with a very wide range of weights. The temperature is set at weight 200, as light as a hairline, and the small labels at 600. The contrast comes from size and weight, not from pairing two fonts.

Singapore Sky keeps the system stack, by user-confirmed scope. Its character comes from the sky and the flags, not from a display face. Only the temperature colour shifts with the sky (a cool white in calm, a violet white in storm, a warm white in haze and heat), at the Apple weight of 200.

### Hierarchy
- **Display** (200, 5rem, 5.5rem from md, line-height 1, tracking −0.025em): the current temperature in the hero, used once per screen, below the verdict.
- **Verdict** (400, 1.25rem, 1.5rem from md, line-height snug, balanced): the hero's outdoor summary at full ink (muted and dated with "As of …:" when stale). Each part is an unbreakable unit ending in its "·", so a wrapped line never starts with a separator. Its colour and weight come from the theme (`--temperature-color`, `--temperature-weight`).
- **Headline** (300, 2.25rem, 1.25): the selected place name above the temperature.
- **Title** (600, 1.125rem): location names on sidebar cards. Card temperatures sit beside them at weight 300, 1.875rem.
- **Body** (400, 0.875rem): forecast rows, form fields, chips and tile values that need explanation.
- **Caption** (400, 0.75rem): timestamps, sources, high/low pairs and helper lines.
- **Label** (600, 11px, tracking 0.14em, uppercase): tile and panel headers ("UV INDEX", "4-DAY FORECAST"), always with a small icon in front. The hero's "HOME" marker uses 0.18em tracking.

### Named Rules
**The Tabular Numbers Rule.** Every temperature, time, high/low and measurement uses `tabular-nums`, so values don't shift sideways when they update.

**The One Giant Rule.** Only the hero temperature is set at display size. Other numbers stay at title size or smaller, so the main reading is never in doubt.

## Layout

- **Desktop (md: 768px wide and 500px tall, or more):** a fixed-width sidebar (22rem) next to a main panel, each scrolling on its own. The main column is centred with a maximum width of 64rem and 24px padding (32px from lg, 1024px). The theme picker sits at the top-right of the main panel and scrolls away with it, so it never covers a reading. When two or more saved places are out of date, a "Refresh N out-of-date places" button sits under the add row, above the cards it renews.
- **Phones (below md, which includes a phone held sideways):** a single column, and the whole page scrolls. The sidebar shrinks to one row of two buttons, Use my location and Add Location. Each is sized from its own label, so in any theme's font they sit side by side when they fit and stack when they don't, never truncating. Add Location stays in the row, pressed, while its form is open (the saved-place search is desktop-only). Switching and refreshing live in a one-row bottom dock within thumb reach. Up to four places show as a row of chips you swipe sideways; beyond four, the selected place shows as one button that opens a list sheet of every place in full-width 48px rows. A round Refresh button sits at the dock's end, inset from the safe area. When two or more places are out of date it carries a count badge and opens a sheet with "Refresh N out-of-date places" and "Refresh <place> only". Sheets rise from the dock, are non-modal, and close on Escape, an outside tap or a choice, returning focus to the dock button. The dock publishes its height as `--dock-height` so the page end, the undo toast and the sheets stay clear of it. Removing a place is a quiet text button at the end of its page, away from the dock. The theme picker moves to the end of the page.
- **Rhythm:** sections are 12px apart, panels have 16px of internal padding, and controls within a group are 8px apart. The hero gets extra air above it (24px top, 8px bottom) to set it apart from the panels below.
- **Order of content:** Singapore's outdoor questions come first. Hero reading (place; a stale notice when the reading is old; lightning within 10 km from a fresh check, with its own time; the verdict of storms, heat stress, UV from High and PSI; then temperature, condition with its icon and high/low), then the 24-hour forecast strip, the outdoor grid (a full-width Heat & Comfort panel that leads with NEA heat stress (WBGT, the verdict) beside a smaller feels-like, with one reconciling line when the two seem to disagree (air temperature is the hero's number and isn't repeated), then Rainfall, UV and Air Quality), the 4-day forecast, the map, the supporting readings (Wind, Humidity, Sun), and a footer naming the source. Grids are 2 columns, 4 from lg.
- **Condition icons:** every condition glyph (hero, hourly strip, 4-day rows, sidebar cards, phone chips, map pins) comes from `ConditionIcon`, which wraps `conditionToIcon`. Do not pick weather icons by hand.

- **Singapore Sky:** the layout is unchanged; the sky behind the hero carries the state. The haze sun hangs top-right on desktop and beside the hero on phones. Rain sheets fade in from 22% down the screen (below the cloud base) and are masked out of an ellipse over the hero reading, wider and lower on phones, so they never cross the temperature.

**The Fixed Order Rule.** The order of the content is the same on every theme and every screen size. Phones change how things are shown (chips in a bottom dock instead of cards), never what comes first.

## Elevation & Depth

Depth comes from translucency, not shadows. Panels sit flat over the sky, separated by a frosted backdrop blur (blur-xl on panels, blur-2xl on the sidebar), a slightly brighter fill and a hairline edge. Shadows appear only when something is lifted for a reason: a selected item, an opaque pop-up, or a floating control.

### Shadow Vocabulary
- **Selected lift** (`box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2), 0 4px 6px -4px rgba(0,0,0,0.2)`): the selected location card or chip.
- **Popover** (`box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3)`): the town suggestion list.
- **Floating control** (`box-shadow: 0 8px 24px rgba(0,0,0,0.28)`): cast upward by the phone bottom dock.
- **Map marker** (`box-shadow: 0 2px 8px rgba(0,0,0,0.3)`): pin labels over the basemap.

### Named Rules
**The Flat-At-Rest Rule.** In Apple, panels have no shadow at rest (`--card-shadow: none`). A shadow is a sign of state or of floating, never decoration.

**The Opaque Pop-up Rule.** Anything that floats over content (pop-ups, the phone bottom dock) uses an opaque surface (`--popover-bg`), because translucent fills let the content underneath show through.

Singapore Sky stays flat at rest (`--card-shadow: none`) and tints its opaque pop-up surface to each sky (slate in calm, violet in storm, sepia in haze, rust in heat). Haze is the one state that changes the panels: it thickens the air with a heavier frost (32px blur, saturation 0.7) while the fills stay the same, so the contrast budget holds.

## Shapes

Softly rounded panels, small-radius form controls and fully round pills. Every themeable panel is marked with `rounded-card`, and its radius comes from `--card-radius` (1rem in Apple, 1.25rem in Glass, 0.375rem in Radar, 1.75rem in Sticker, 0.75rem in Memphis, 1.125rem in Singapore). Edges are 1px hairlines in the ink colour (2px in Memphis). The map is clipped at 12px. Inputs and small buttons use 6px, the search field 8px. Pills (Refresh, theme picker, map overlay buttons, Singapore's heat-stress flags) are fully rounded.

## Components

### Buttons
- **Shape:** pills are fully rounded. Form actions use small rounded corners (6px).
- **Primary (Add):** porcelain fill with midnight text, 6px × 12px padding, caption size, semibold. On hover it goes fully opaque. It is the only solid button in the interface.
- **Pill (Refresh on desktop, beside "Updated …" in the hero; theme picker):** a frosted fill at 8% with a 15% edge, caption size, medium weight. Hover raises the fill to 14%.
- **Refresh on phones:** a 48px round button at the end of the bottom dock, icon-only with an accessible name ("Refresh Sentosa"). The icon spins while refreshing.
- **Refresh all:** a full-width 44px button ("Refresh 9 out-of-date places"), shown only when two or more places are stale or never refreshed: under the add row on desktop, inside the dock's refresh sheet on phones, where the dock also keeps a hidden status line so a run folded away mid-way is still announced. It renews them one at a time; a polite status line counts progress ("Refreshing 3 of 9…") beside a "Stop after this place" button, then reports the result. Failures name the places and offer Retry in the error tone; a clean result clears itself after six seconds. Single Refresh buttons are disabled while a run is going.
- **Map overlay (fullscreen, lightning):** 44px round buttons, dark glass (black at 40%, 55% on hover) with literal white icons, so they stay readable on any basemap.
- **Sidebar entry pair (Use my location, Add Location):** two equal frosted card buttons sharing one row at the top of the sidebar, each with a leading icon (crosshair, plus). Use my location reads "Finding you…" and is disabled while busy; it is never disabled for any other reason, including on browsers it doesn't support.
- **Ghost (Cancel, delete ×):** no fill. The ink brightens on hover, and delete gets a round 15% wash.
- **Focus:** a solid 2px outline in the theme's `--focus-ring` colour, offset 2px.

### Chips (phone location switcher)
- **Style:** frosted fill at 7% with a 10% edge and a card radius, 44px minimum height. Contents: an optional home icon, the place name (semibold, cut off with an ellipsis), and the temperature (light, tabular figures).
- **State:** selected chips lift to a 20% fill, a 30% edge and the selected-lift shadow, and only select; the delete × is not on the chip. Pressing an unselected chip washes it to 14%. The row snaps as you swipe and has no visible scrollbar.

### Cards / Containers
- **Corner Style:** card radius (`--card-radius`).
- **Background:** frosted ink at 8% (7% for list cards), over a backdrop blur.
- **Shadow Strategy:** flat at rest. The selected lift applies only to the selected location card.
- **Border:** a 1px ink hairline at 15% (10% for list cards, 30% when selected).
- **Internal Padding:** 16px. Rows inside a panel are separated by 5–10% ink dividers, not gaps.
- **Tile header:** a small icon plus a label in the Label style at 60% ink.

### Inputs / Fields
- **Search:** an 8px radius, a frosted 8% fill, a 10% edge, a leading search icon at 50% ink, and a placeholder at 50%.
- **Form fields:** a 6px radius, a 10% fill, a 15% edge and a 40% placeholder, with an 11px label above in 60% ink.
- **Focus:** the shared `--focus-ring` outline.
- **Error:** a blush message on a 15% red wash with a red-tinted border, placed right next to the field or card it belongs to. The Use my location messages use the same box directly under the button row; its "Already saved" line is plain muted ink, since it is information, not a failure. Both carry a dismiss ×.

### Navigation
There is no navigation bar. Places are switched with the sidebar's location cards on desktop (title-size name, light temperature, condition and high/low below a divider) and with the chip row on phones. Selection uses `aria-pressed`, and in light themes the selected item gets `data-selected` and a stronger fill.

### Gauges (signature)
A 6px-high rounded bar filled with a data-scale gradient at 80% opacity, with a 12px ink marker dot that has a 2px ink edge and a small dark shadow. It is used for the UV index, air quality and heat stress, and in slimmer form for the 4-day temperature range. When there is no value it shows the bar with no dot and a "--" reading. It never guesses. Each gauge names its scale (`psi`, `uv` or `wbgt`) and takes its fill from the matching `--scale-*` token. In Singapore Sky the fill is hard NEA bands rather than a gradient (see Colors).

### Heat-Stress Flags (Singapore Sky)
NEA heat-stress bands shown as flag pills: fully round, 8px side padding, semibold, no shadow. Low is green with dark text, Moderate yellow with dark text, High red with white bold text and a light 1px edge (see the Flag Text Exception). In other themes the same bands render as ink: Low as muted text, Moderate as a 10% ink pill, High as a 20% ink pill with a 40% ring.

**The Quiet Low Rule.** In the hero's one-line summary only Moderate and High heat get a flag pill. Low stays plain text so it never outshouts a storm. The WBGT tile shows all three bands as flags.

### The Sky (Singapore Sky signature)
The page ground in Singapore Sky. `Layout` sets `data-sky` on `<html>` from the selected location's snapshot, and the theme block maps each state to colours for the same fixed stack of materials (sun disc, cloud base, cumulus, smoke veil, horizon burn, glows, sky gradient, with rain on a fixed layer behind the page).
- **Crossfade:** the sky and material tokens are registered with `@property` as colours, so a change of state interpolates like weather moving in: 1.2s for the sky stops, 1.4s for cumulus, 1.6s for sun, smoke and horizon, 0.9s for rain, all on `cubic-bezier(0.16, 1, 0.3, 1)`. Under reduced motion the change snaps.
- **Sheet lightning:** the theme's single authored motion. On entering storm, a soft violet-white flash behind the cloud base flickers twice in about a second (1.1s, after a 0.5s delay, played once), well inside WCAG 2.3.1. It never loops, and reduced motion removes it.

## Do's and Don'ts

### Do:
- **Do** derive every foreground colour from the ink token (`text-white/…`, `border-white/…`, `bg-white/…`), which follows the theme.
- **Do** mark every themeable panel with `rounded-card`, so all six themes can restyle it.
- **Do** keep touch targets at 44px or larger on phones, and keep Refresh and location switching within thumb reach.
- **Do** show every reading with its update time and source, and use "--" for missing values.
- **Do** write every time in Singapore time, 24-hour (`18:53`), through `formatSgtTime`, whatever the viewer's locale or time zone.
- **Do** describe every reading through `readingFreshness`: a time today, "Yesterday 18:39" or "11 Nov 18:36" otherwise. Past 3 hours a reading is stale: cards and chips lead with its age and a clock, the hero says so above its summary, dates the summary ("As of 11 Nov 18:37:") and fades its temperature to `--ink-stale` (55% ink, 70% in Sticker, each 3:1 as display text), every tile swaps "latest"/"realtime" for "reading from 11 Nov 18:37", the daily list is headed "Forecast issued 11 Nov 18:37" and never says "Today", the 24-hour strip drops "Now", and forecast days already gone are hidden.
- **Do** keep the card map out of the keyboard path: pins and Leaflet links are not focusable and the preview is `aria-hidden`; its Expand button opens the fullscreen map, where the map is a labelled region and every pin is a button named "Ang Mo Kio, 30°, Cloudy".
- **Do** name a forecast period's day through `periodStartLabel`: "6 am" today, "Tomorrow 6 am", "12 Nov 6 am".
- **Do** use `tabular-nums` for every number that can change.
- **Do** use the opaque pop-up surface (`--popover-bg`) for anything that floats over content.
- **Do** give every gauge a `scale` and let the theme's `--scale-*` token fill it; in Singapore Sky, band it at the NEA cut-offs.
- **Do** change a Singapore sky material by changing its colour token, so it crossfades; keep every material in the stack at all times.
- **Do** recheck the lightest-point budget (85% ink at 4.5:1 on a 20% card, effective alphas included) whenever a sky stop or material gets brighter.

### Don't:
- **Don't** change how the Apple theme looks as a side effect of other work. It changes only in deliberate theming work that follows Apple's current design language.
- **Don't** use saturated colour for decoration or emphasis. It is reserved for data scales and map markers.
- **Don't** put a second display-size number on the screen, or make the hero temperature heavier in Apple.
- **Don't** add shadows to panels at rest in Apple.
- **Don't** hard-code white, grey or slate text. Map overlay buttons use the `map-control` tokens.
- **Don't** use translucent `bg-white/…` fills for pop-ups or floating controls.
- **Don't** extend the flag-text exception beyond the NEA flag pills; everything else in Singapore Sky is ink.
- **Don't** flag Low heat in the hero summary, or let rain cross the hero reading.
- **Don't** add a second authored motion to Singapore Sky, or loop the lightning.
