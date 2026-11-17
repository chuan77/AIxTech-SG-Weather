#!/usr/bin/env bash
# Browser E2E checks for the web analytics privacy notice (specs/012-vercel-web-analytics).
#
# Runs its server with E2E_WEB_ANALYTICS=notice-only: the page shows the notice exactly as it does
# when visits are measured, but never loads the measurement script. Every sub-check asserts that
# no request went to /_vercel/insights/ or va.vercel-scripts.com. Stubs GET /api/locations with
# `agent-browser network route` (none saved, or one), so it never calls data.gov.sg.
#
# Usage (from the repo root, after `npm run verify` has built frontend/dist):
#   scripts/e2e/privacy-notice.sh [us1|us2|themes|off]   # no argument runs everything
#
# us1     empty state: notice present; click, Enter and Space toggle it; Escape closes it
# us2     selected location: notice under "Weather for"; at 375 px one line, clear of the phone
#         dock, and opening it moves nothing above it
# themes  all six themes: notice and explanation text reach 4.5:1
# off     a second server with measurement off: no notice in either view
#
# Starts its own temporary server on a throwaway database and tears it down, with the browser,
# on exit (scripts/e2e/lib.sh). Any uncaught page error or console.error fails the run.
set -euo pipefail

SESSION="${E2E_SESSION:-privacy-notice}"
OUT="e2e-artifacts/privacy-notice"
FILTER="${1:-all}"
mkdir -p "$OUT"

PASSED=0
FAILED=0

pass() { PASSED=$((PASSED + 1)); printf '  ok   %s\n' "$1"; }
fail() { FAILED=$((FAILED + 1)); printf '  FAIL %s\n' "$1" >&2; }

if [ -n "${E2E_BASE_URL:-}" ]; then
  echo "privacy-notice.sh starts its own servers (notice-only, then off); unset E2E_BASE_URL." >&2
  exit 2
fi
export E2E_WEB_ANALYTICS=notice-only

# shellcheck source=scripts/e2e/lib.sh
. "$(dirname "$0")/lib.sh"
check() { # check <description> <command...>
  local description="$1"
  shift
  if "$@"; then pass "$description"; else fail "$description"; fi
}
want() { [ "$FILTER" = all ] || [ "$FILTER" = "$1" ]; }

js() { ab eval "$1" | sed -e 's/^"//' -e 's/"$//'; }
shot() { ab screenshot "$OUT/$1.png" >/dev/null; }

# --- stubs ----------------------------------------------------------------------------------

locations_json() { # locations_json <0|1>
  node -e '
    if (process.argv[1] === "0") { console.log(JSON.stringify({ locations: [] })); process.exit(0); }
    const keys = ["condition","observed_at","source","area","valid_period_text","temperature_c",
      "humidity_percent","rainfall_mm","wind_speed_knots","wind_direction_degrees","forecast_low_c",
      "forecast_high_c","uv_index","psi_twenty_four_hourly","pm25_one_hourly","air_quality_region",
      "pm10_twenty_four_hourly","o3_eight_hour_max","no2_one_hour_max","so2_twenty_four_hourly",
      "co_eight_hour_max","air_quality_observed_at","wbgt_c","heat_stress_level","wbgt_station_name",
      "wbgt_station_distance_km","wbgt_observed_at"];
    const weather = Object.fromEntries(keys.map((key) => [key, null]));
    Object.assign(weather, { condition: "Fair", area: "Toa Payoh", temperature_c: 29,
      observed_at: new Date().toISOString(), source: "e2e stub", forecast_periods: [], daily_forecast: [] });
    console.log(JSON.stringify({ locations: [{ id: 1, latitude: 1.335, longitude: 103.85,
      created_at: new Date().toISOString(), weather }] }));' "$1"
}

# --- page helpers ---------------------------------------------------------------------------

BUTTON='[...document.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith("Anonymous visit counts"))'
notice_count() {
  js '[...document.querySelectorAll("button")].filter((b) => b.textContent.trim().startsWith("Anonymous visit counts")).length'
}
expanded() { js "($BUTTON)?.getAttribute('aria-expanded') ?? 'missing'"; }
explanation_visible() {
  js "(() => { const b = $BUTTON; const p = b && document.getElementById(b.getAttribute('aria-controls')); return Boolean(p && !p.hidden && p.offsetHeight > 0); })()"
}
focus_button() { js "(() => { const b = $BUTTON; b?.focus(); return document.activeElement === b; })()"; }
button_focused() { js "document.activeElement === ($BUTTON)"; }
click_button() { js "(() => { const b = $BUTTON; b?.click(); return Boolean(b); })()" >/dev/null; }
measurement_requests() {
  js 'performance.getEntriesByType("resource").filter((e) => /\/_vercel\/insights\/|va\.vercel-scripts\.com/.test(e.name)).length + document.querySelectorAll("script[src*=\"_vercel\"], script[src*=\"vercel-scripts\"]").length'
}
no_measurement() { check "no measurement request: $1" test "$(measurement_requests)" -eq 0; }

open_app() { # open_app <context> <saved count>
  ab network unroute >/dev/null 2>&1 || true
  ab network route "**/api/locations" --body "$(locations_json "$2")" >/dev/null
  ab open "$BASE_URL" >/dev/null
  ab wait 1000 >/dev/null
  assert_clean "open the app: $1"
}

toggles() { # toggles <context>: click, Enter, Space and Escape all behave
  local ctx="$1"
  check "$ctx: starts collapsed" test "$(expanded)" = false
  check "$ctx: explanation hidden while collapsed" test "$(explanation_visible)" = false
  click_button
  check "$ctx: click opens it" test "$(expanded)" = true
  check "$ctx: explanation shown in place" test "$(explanation_visible)" = true
  check "$ctx: explanation names the tool and says no cookies" test "$(js "(() => { const b = $BUTTON; const t = document.getElementById(b.getAttribute('aria-controls')).textContent; return /Vercel Web Analytics/.test(t) && /no cookies/.test(t) && /resets every day/.test(t); })()")" = true
  click_button
  check "$ctx: click again closes it" test "$(expanded)" = false
  check "$ctx: button takes focus" test "$(focus_button)" = true
  ab press Enter >/dev/null
  check "$ctx: Enter opens it" test "$(expanded)" = true
  ab press Space >/dev/null
  check "$ctx: Space closes it" test "$(expanded)" = false
  ab press Enter >/dev/null
  ab press Escape >/dev/null
  check "$ctx: Escape closes it" test "$(expanded)" = false
  check "$ctx: focus stays on the button" test "$(button_focused)" = true
  check "$ctx: page did not navigate" test "$(js 'location.pathname + location.search + location.hash')" = /
}

e2e_start_server
e2e_launch_browser
ab set viewport 1280 900 >/dev/null
ab open "$BASE_URL" >/dev/null
js "localStorage.setItem('weather-theme', 'apple'); 1" >/dev/null

# --- US1: empty state -----------------------------------------------------------------------

if want us1; then
  echo "US1: empty state"
  open_app "empty state" 0
  check "empty state: one notice" test "$(notice_count)" -eq 1
  check "empty state: notice sits under the add hint" test "$(js "(() => { const hint = [...document.querySelectorAll('main p')].find((p) => p.textContent.startsWith('Add a Singapore town')); const b = $BUTTON; return Boolean(hint && b && hint.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); })()")" = true
  toggles "empty state"
  shot "us1-empty-desktop"
  no_measurement "empty state"
fi

# --- US2: selected location -----------------------------------------------------------------

if want us2; then
  echo "US2: selected location"
  open_app "selected location" 1
  check "selected: one notice" test "$(notice_count)" -eq 1
  check "selected: notice is in the footer after the credit" test "$(js "(() => { const f = document.querySelector('main footer'); const credit = f && [...f.querySelectorAll('p')].find((p) => p.textContent.startsWith('Weather for')); const b = $BUTTON; return Boolean(credit && b && f.contains(b) && credit.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); })()")" = true
  toggles "selected"
  no_measurement "selected, desktop"

  ab set viewport 375 812 >/dev/null
  open_app "selected at 375 px" 1
  js "window.scrollTo(0, document.documentElement.scrollHeight); 1" >/dev/null
  ab wait 300 >/dev/null
  check "375 px: collapsed label is one line" test "$(js "(() => { const b = $BUTTON; const lh = parseFloat(getComputedStyle(b).lineHeight); const r = document.createRange(); r.selectNodeContents(b); return r.getClientRects().length === 1 || r.getBoundingClientRect().height <= lh * 1.5; })()")" = true
  check "375 px: notice clear of the phone dock" test "$(js "(() => { const b = ($BUTTON).getBoundingClientRect(); const dock = document.querySelector('nav.phone-dock'); const top = dock ? dock.getBoundingClientRect().top : innerHeight; return b.bottom <= top; })()")" = true
  before="$(js "(() => { const f = document.querySelector('main footer'); return Math.round(f.getBoundingClientRect().top + scrollY); })()")"
  click_button
  ab wait 200 >/dev/null
  after="$(js "(() => { const f = document.querySelector('main footer'); return Math.round(f.getBoundingClientRect().top + scrollY); })()")"
  check "375 px: opening moves nothing above it (footer top $before → $after)" test "$before" = "$after"
  ab wait 600 >/dev/null
  check "375 px: opened explanation scrolls into view above the dock" test "$(js "(() => { const b = $BUTTON; const p = document.getElementById(b.getAttribute('aria-controls')).getBoundingClientRect(); const dock = document.querySelector('nav.phone-dock'); const top = dock ? dock.getBoundingClientRect().top : innerHeight; return p.bottom <= top + 1 && p.top >= 0; })()")" = true
  shot "us2-selected-375-open"
  no_measurement "selected, 375 px"
  ab set viewport 1280 900 >/dev/null
fi

# --- themes ---------------------------------------------------------------------------------

if want themes; then
  echo "Themes: notice text contrast in all six themes"
  for theme in apple glass radar sticker memphis singapore; do
    js "localStorage.setItem('weather-theme', '$theme'); 1" >/dev/null
    for view in 0 1; do
      open_app "$theme, saved=$view" "$view"
      click_button
      ab wait 150 >/dev/null
      # Text colour vs what is behind it, walking up the tree: the nearest opaque background
      # colour, or else every colour stop of the nearest background gradient (the sky themes paint
      # the page with gradients), taking the worst ratio.
      ratios="$(js "(() => {
        const rgb = (c) => (c.match(/[\\d.]+/g) || []).map(Number);
        const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
          .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
        const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
        const backs = (el) => {
          for (let n = el; n; n = n.parentElement) {
            const s = getComputedStyle(n);
            const c = rgb(s.backgroundColor);
            if (c.length >= 3 && (c[3] ?? 1) >= 0.99) return [c.slice(0, 3)];
            const stops = (s.backgroundImage.match(/rgba?\\([^)]*\\)/g) || []).map(rgb).filter((v) => (v[3] ?? 1) >= 0.99);
            if (stops.length) return stops.map((v) => v.slice(0, 3));
          }
          return [[255, 255, 255]];
        };
        const worst = (el) => Math.min(...backs(el).map((b) => ratio(rgb(getComputedStyle(el).color).slice(0, 3), b)));
        const b = $BUTTON;
        const p = document.getElementById(b.getAttribute('aria-controls'));
        return [b, p].map((el) => worst(el).toFixed(1)).join(',');
      })()")"
      check "$theme saved=$view: label reaches 4.5:1 (${ratios%,*}:1)" node -e 'process.exit(Number(process.argv[1]) >= 4.5 ? 0 : 1)' "${ratios%,*}"
      check "$theme saved=$view: explanation reaches 4.5:1 (${ratios#*,}:1)" node -e 'process.exit(Number(process.argv[1]) >= 4.5 ? 0 : 1)' "${ratios#*,}"
      shot "theme-$theme-saved$view"
    done
  done
  js "localStorage.setItem('weather-theme', 'apple'); 1" >/dev/null
  no_measurement "themes"
fi

# --- off: measurement switched off ----------------------------------------------------------

if want off; then
  echo "Off: no notice when measurement is off"
  e2e_stop_server
  export E2E_WEB_ANALYTICS=off
  e2e_start_server
  for view in 0 1; do
    open_app "off, saved=$view" "$view"
    check "off, saved=$view: no notice" test "$(notice_count)" -eq 0
    check "off, saved=$view: no web-analytics meta" test "$(js 'document.querySelectorAll("meta[name=web-analytics]").length')" -eq 0
    no_measurement "off, saved=$view"
  done
fi

assert_clean "end of run"

echo
echo "Passed: $PASSED  Failed: $FAILED  (screenshots in $OUT/)"
[ "$FAILED" -eq 0 ]
