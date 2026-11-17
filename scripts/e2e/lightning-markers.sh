#!/usr/bin/env bash
# Browser E2E checks for the lightning bolt markers (specs/007-lightning-bolt-markers).
#
# agent-browser supports response stubbing (`agent-browser network route <url> --body <json>`,
# checked for T002), so this stubs POST /api/lightning/refresh with three strikes aged 2, 30 and
# 55 minutes, and GET /api/locations with one saved place showing a thunderstorm. It runs against
# the production build and never calls data.gov.sg.
#
# Usage (from the repo root, after `npm run verify` has built frontend/dist):
#   scripts/e2e/lightning-markers.sh [us1|us2|themes]   # no argument runs everything
#
# By default this starts its own temporary server on a throwaway database and tears it down,
# with the browser, on exit (scripts/e2e/lib.sh). E2E_BASE_URL=<url> uses a server you run
# instead; never point it at the `npm run dev` server on weather-starter.localhost:1355.
# Any uncaught page error or console.error while opening or switching views fails the run.
set -euo pipefail

SESSION="${E2E_SESSION:-lightning-markers}"
OUT="e2e-artifacts/lightning-markers"
FILTER="${1:-all}"
mkdir -p "$OUT"

PASSED=0
FAILED=0

pass() { PASSED=$((PASSED + 1)); printf '  ok   %s\n' "$1"; }
fail() { FAILED=$((FAILED + 1)); printf '  FAIL %s\n' "$1" >&2; }

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

# --- stubs --------------------------------------------------------------------------------

lightning_json() {
  node -e '
    const now = Date.now();
    const strike = (minutesAgo, latitude, longitude) => {
      const occurred_at = new Date(now - minutesAgo * 60000).toISOString();
      return { id: `${occurred_at}|${latitude}|${longitude}`, latitude, longitude, occurred_at,
        type: "C", label: "Cloud to Cloud" };
    };
    console.log(JSON.stringify({
      strikes: [strike(2, 1.3521, 103.8198), strike(30, 1.3, 103.85), strike(55, 1.4, 103.75)],
      window_minutes: 60, fetched_at: new Date(now).toISOString(),
      provider_updated_at: new Date(now).toISOString(), stale: false,
    }));'
}

locations_json() {
  node -e '
    const keys = ["condition","observed_at","source","area","valid_period_text","temperature_c",
      "humidity_percent","rainfall_mm","wind_speed_knots","wind_direction_degrees","forecast_low_c",
      "forecast_high_c","uv_index","psi_twenty_four_hourly","pm25_one_hourly","air_quality_region",
      "pm10_twenty_four_hourly","o3_eight_hour_max","no2_one_hour_max","so2_twenty_four_hourly",
      "co_eight_hour_max","air_quality_observed_at","wbgt_c","heat_stress_level","wbgt_station_name",
      "wbgt_station_distance_km","wbgt_observed_at"];
    const weather = Object.fromEntries(keys.map((key) => [key, null]));
    Object.assign(weather, { condition: "Thundery Showers", area: "Toa Payoh", temperature_c: 27,
      observed_at: new Date().toISOString(), source: "e2e stub", forecast_periods: [], daily_forecast: [] });
    console.log(JSON.stringify({ locations: [{ id: 1, latitude: 1.335, longitude: 103.85,
      created_at: new Date().toISOString(), weather }] }));'
}

# The card's lightning switch sits in its Layers menu (spec 011): open the menu, then press it.
toggle_card_lightning() {
  js '(() => { if (!document.querySelector("section [role=switch][aria-label=Lightning]")) document.querySelector("section [aria-label^=\"Map layers\"]")?.click(); return 1; })()' >/dev/null
  ab wait 200 >/dev/null
  js 'document.querySelector("section [role=switch][aria-label=Lightning]").click(); 1' >/dev/null
}

# --- page helpers -------------------------------------------------------------------------

mark_count() { js 'document.querySelectorAll(".strike-mark").length'; }

open_map() { # open_map <context>: open the app with stubs, scroll the lazy map in, load lightning
  ab network unroute >/dev/null 2>&1 || true
  ab network route "**/api/lightning/refresh" --body "$(lightning_json)" >/dev/null
  ab network route "**/api/locations" --body "$(locations_json)" >/dev/null
  ab open "$BASE_URL" >/dev/null
  ab wait 1500 >/dev/null
  assert_clean "open the app: $1"
  js '(() => { const h = [...document.querySelectorAll("section h2")].find((e) => /map/i.test(e.textContent)); h?.scrollIntoView(); return Boolean(h); })()' >/dev/null
  for _ in $(seq 1 20); do
    [ "$(js 'document.querySelectorAll(".leaflet-container").length')" -gt 0 ] && break
    ab wait 250 >/dev/null
  done
  js '(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Show latest lightning")); b?.click(); return Boolean(b); })()' >/dev/null
  for _ in $(seq 1 20); do
    [ "$(mark_count)" -ge 3 ] && break
    ab wait 250 >/dev/null
  done
  assert_clean "load lightning: $1"
}

e2e_start_server
e2e_launch_browser
ab set viewport 1280 900 >/dev/null

# --- US1: a strike reads as lightning ------------------------------------------------------

if want us1; then
  echo "US1: strikes show as bolt marks"
  open_map "us1"
  check "three bolt marks are drawn" test "$(mark_count)" -eq 3
  check "no circle markers remain in the lightning pane" \
    test "$(js 'document.querySelectorAll(".leaflet-lightning-pane path.leaflet-interactive").length')" -eq 0
  check "the bolt is not the thunderstorm glyph" \
    test "$(js 'document.querySelector(".strike-mark path").getAttribute("d").startsWith("M7 14h10")')" = false
  check "newest mark is the largest" \
    test "$(js '[...document.querySelectorAll(".strike-mark")].map((e) => parseInt(e.style.width)).join(",")')" = "24,19,14"
  check "pins sit above the lightning pane" \
    test "$(js 'Number(getComputedStyle(document.querySelector(".leaflet-lightning-pane")).zIndex) < Number(getComputedStyle(document.querySelector(".leaflet-marker-pane")).zIndex)')" = true
  js 'document.querySelector(".strike-mark").parentElement.click(); 1' >/dev/null
  ab wait 500 >/dev/null
  check "selecting a bolt shows its type and time" \
    grep -q "Cloud to Cloud" <<<"$(js 'document.querySelector(".leaflet-popup-content")?.textContent ?? ""')"
  shot "us1-apple"
  toggle_card_lightning
  ab wait 300 >/dev/null
  check "turning the layer off removes every bolt" test "$(mark_count)" -eq 0
  toggle_card_lightning
  ab wait 500 >/dev/null
  check "turning it back on restores them" test "$(mark_count)" -eq 3
  assert_clean "us1 toggle"
fi

# --- US2 / themes: colour follows the theme ------------------------------------------------

if want us2 || want themes; then
  echo "US2: bolts follow every theme"
  fills=""
  for theme in apple glass radar sticker memphis singapore; do
    js "localStorage.setItem('weather-theme', '$theme')" >/dev/null
    open_map "$theme"
    check "$theme: three bolt marks" test "$(mark_count)" -eq 3
    fill="$(js 'getComputedStyle(document.querySelector(".strike-mark svg")).fill')"
    stroke="$(js 'getComputedStyle(document.querySelector(".strike-mark svg")).stroke')"
    check "$theme: fill and outline come from the theme" test -n "$fill" -a -n "$stroke" -a "$stroke" != none
    fills="$fills$fill\n"
    shot "theme-$theme"
  done
  js "localStorage.setItem('weather-theme', 'apple')" >/dev/null
  distinct="$(printf "$fills" | sort -u | grep -c .)"
  check "bolt colours differ between themes ($distinct distinct)" test "$distinct" -ge 2
fi

assert_clean "end of run"

echo
echo "Passed: $PASSED  Failed: $FAILED  (screenshots in $OUT/)"
[ "$FAILED" -eq 0 ]
