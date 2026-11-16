#!/usr/bin/env bash
# Browser E2E checks for today's UV trend in the UV tile (specs/008-uv-hourly-trend).
#
# Stubs GET /api/locations with one saved place per UV state (agent-browser `network route`),
# so no data.gov.sg call is made. States: today (07–09 reported, as_of 09:11), previous day
# (13 readings), empty list, pre-feature (uv_index set, uv_hourly null) and unavailable.
#
# Usage (from the repo root, after `npm run verify` has built frontend/dist):
#   scripts/e2e/uv-trend.sh [us1|us2|us3|themes]   # no argument runs everything
#
# By default this starts its own temporary server on a throwaway database and tears it down,
# with the browser, on exit (scripts/e2e/lib.sh). E2E_BASE_URL=<url> uses a server you run
# instead; never point it at the `npm run dev` server on weather-starter.localhost:1355.
# Any uncaught page error or console.error while opening or switching views fails the run.
set -euo pipefail

SESSION="${E2E_SESSION:-uv-trend}"
OUT="e2e-artifacts/uv-trend"
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
contains() { grep -qF -- "$2" <<<"$1"; }
want() { [ "$FILTER" = all ] || [ "$FILTER" = "$1" ]; }

js() { ab eval "$1" | sed -e 's/^"//' -e 's/"$//'; }
shot() { ab screenshot "$OUT/$1.png" >/dev/null; }

# --- stubs --------------------------------------------------------------------------------

locations_json() { # locations_json <today|yesterday|empty|pre-feature|unavailable>
  node -e '
    const state = process.argv[1];
    const sgDate = (offsetDays) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore",
      year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + offsetDays * 864e5));
    const day = (date, values, asOf) => ({ date, as_of: asOf, readings: values.map((value, i) =>
      ({ hour: `${date}T${String(7 + i).padStart(2, "0")}:00:00+08:00`, value })) });
    const today = sgDate(0);
    const yesterday = sgDate(-1);
    const uv = {
      today: [1, day(today, [0, 0, 1], `${today}T09:11:20+08:00`)],
      yesterday: [0, day(yesterday, [0, 0, 1, 2, 4, 3, 3, 2, 1, 1, 0, 0, 0], `${yesterday}T19:11:00+08:00`)],
      empty: [null, { date: today, as_of: null, readings: [] }],
      "pre-feature": [5, null],
      unavailable: [null, null],
    }[state];
    const keys = ["condition","observed_at","source","area","valid_period_text","temperature_c",
      "humidity_percent","rainfall_mm","wind_speed_knots","wind_direction_degrees","forecast_low_c",
      "forecast_high_c","psi_twenty_four_hourly","pm25_one_hourly","air_quality_region",
      "pm10_twenty_four_hourly","o3_eight_hour_max","no2_one_hour_max","so2_twenty_four_hourly",
      "co_eight_hour_max","air_quality_observed_at","wbgt_c","heat_stress_level","wbgt_station_name",
      "wbgt_station_distance_km","wbgt_observed_at"];
    const weather = Object.fromEntries(keys.map((key) => [key, null]));
    Object.assign(weather, { condition: "Partly Cloudy", area: "Toa Payoh", temperature_c: 30,
      rainfall_mm: 0, observed_at: new Date().toISOString(), source: "e2e stub",
      uv_index: uv[0], uv_hourly: uv[1], forecast_periods: [], daily_forecast: [] });
    console.log(JSON.stringify({ locations: [{ id: 1, latitude: 1.335, longitude: 103.85,
      created_at: new Date().toISOString(), weather }] }));' "$1"
}

# --- page helpers -------------------------------------------------------------------------

# The UV tile: the themeable panel whose heading reads "UV Index".
UV_TILE='[...document.querySelectorAll(".rounded-card")].find((e) => e.querySelector("h3, h2")?.textContent.trim() === "UV Index")'

open_state() { # open_state <state> <context>
  ab network unroute >/dev/null 2>&1 || true
  ab network route "**/api/locations" --body "$(locations_json "$1")" >/dev/null
  ab open "$BASE_URL" >/dev/null
  for _ in $(seq 1 20); do
    [ "$(js "Boolean($UV_TILE)")" = true ] && break
    ab wait 250 >/dev/null
  done
  assert_clean "open $1: $2"
}

tile_text() { js "($UV_TILE)?.innerText.replace(/\\s+/g, ' ') ?? ''"; }
slot_count() { js "($UV_TILE)?.querySelectorAll('ol > li').length ?? 0"; }
filled_slots() { js "[...(($UV_TILE)?.querySelectorAll('ol > li') ?? [])].filter((li) => !li.textContent.includes('no reading')).length"; }
numbered_slots() { js "[...(($UV_TILE)?.querySelectorAll('ol > li') ?? [])].filter((li) => li.querySelector('span[aria-hidden=true].tabular-nums')).length"; }
no_hscroll() { test "$(js 'document.documentElement.scrollWidth <= window.innerWidth')" = true; }
hourly_visible() { # rendered with a size (offsetParent is null inside the phone's fixed sheet)
  js "(() => { const ol = ($UV_TILE)?.querySelector('ol'); return Boolean(ol && ol.getClientRects().length && ol.getBoundingClientRect().width > 0); })()"
}
shot_tile() { js "($UV_TILE)?.scrollIntoView({ block: 'center' }); 1" >/dev/null; ab wait 200 >/dev/null; shot "$1"; }

check_state() { # check_state <state> <label>: the per-state expectations (US1–US3)
  local text
  text="$(tile_text)"
  case "$1" in
    today)
      check "$2: 13 slots" test "$(slot_count)" -eq 13
      check "$2: 3 reported slots, 10 empty" test "$(filled_slots)" -eq 3
      check "$2: every reported slot shows its number" test "$(numbered_slots)" -eq 3
      check "$2: direction and count" contains "$text" "Rising · No hours at UV 3+ so far"
      check "$2: as of the provider update time" contains "$text" "measured at Changi · as of 09:11"
      check "$2: UV 3 and peak legend" contains "$text" "NEA: usual peak 11 am – 3 pm"
      check "$2: guidance wording" contains "$text" "Use SPF 30+ sunscreen, applied 20–30 min"
      ;;
    yesterday)
      check "$2: 13 reported slots" test "$(filled_slots)" -eq 13
      check "$2: dated count, no direction" grep -qE "[0-9]{1,2} [A-Z][a-z]{2} · 3 h at UV 3\+ \(Moderate or higher\)" <<<"$text"
      check "$2: no 'so far' on a previous day" test "$(grep -c 'so far' <<<"$text")" -eq 0
      check "$2: dated source line" grep -qE "Readings for [0-9]{1,2} [A-Z][a-z]{2}, measured at Changi" <<<"$text"
      ;;
    empty)
      check "$2: says no readings yet" contains "$text" "No UV readings yet."
      check "$2: no hourly view" test "$(slot_count)" -eq 0
      ;;
    pre-feature)
      check "$2: value and band as before" contains "$text" "Moderate"
      check "$2: says the view comes after refresh" contains "$text" "Hourly view appears after the next refresh."
      check "$2: no hourly view" test "$(slot_count)" -eq 0
      ;;
    unavailable)
      check "$2: Unavailable" contains "$text" "Unavailable"
      check "$2: no hourly view" test "$(slot_count)" -eq 0
      check "$2: no guidance line" test "$(grep -c 'SPF' <<<"$text")" -eq 0
      ;;
  esac
}

e2e_start_server
e2e_launch_browser

# --- US1–US3: every state, desktop and phone -----------------------------------------------

if want us1 || want us2 || want us3; then
  echo "US1–US3: each UV state at desktop and phone width"
  for size in "1280 900 desktop" "360 800 phone"; do
    set -- $size
    ab set viewport "$1" "$2" >/dev/null
    for state in today yesterday empty pre-feature unavailable; do
      open_state "$state" "$3"
      check_state "$state" "$3 $state"
      check "$3 $state: no horizontal scroll" no_hscroll
      shot_tile "$3-$state"
    done
  done

  ab set viewport 1280 900 >/dev/null
  open_state today "layout"
  check "lg: Rainfall and UV share the first row" test "$(js "(() => {
    const cards = [...document.querySelectorAll('.rounded-card')];
    const byTitle = (t) => cards.find((e) => e.querySelector('h3, h2')?.textContent.trim() === t);
    const r = byTitle('Rainfall').getBoundingClientRect(), u = byTitle('UV Index').getBoundingClientRect(),
      a = byTitle('Air Quality').getBoundingClientRect();
    return Math.abs(r.top - u.top) < 2 && Math.abs(r.width - u.width) < 2 && a.top > u.bottom - 1
      && Math.abs(a.width - (u.right - r.left)) < 2;
  })()")" = true
  ab set viewport 360 800 >/dev/null
  open_state today "layout phone"
  check "phone: Rainfall, UV and Air Quality are full width" test "$(js "(() => {
    const cards = [...document.querySelectorAll('.rounded-card')];
    const w = (t) => cards.find((e) => e.querySelector('h3, h2')?.textContent.trim() === t).getBoundingClientRect().width;
    return Math.abs(w('Rainfall') - w('UV Index')) < 2 && Math.abs(w('UV Index') - w('Air Quality')) < 2;
  })()")" = true
  check "phone 360 px: the hourly view is shown" test "$(hourly_visible)" = true
  ab set viewport 320 800 >/dev/null
  open_state today "narrow phone"
  check "320 px: hourly view hides, text lines stay (FR-015)" test "$(hourly_visible)" = false
  check "320 px: status line still shows" contains "$(tile_text)" "Rising · No hours at UV 3+ so far"
  check "320 px: no horizontal scroll" no_hscroll
fi

# --- themes: six themes at desktop and phone width -----------------------------------------

if want themes; then
  echo "Themes: hourly bars follow every theme"
  backgrounds=""
  for theme in apple glass radar sticker memphis singapore; do
    js "localStorage.setItem('weather-theme', '$theme')" >/dev/null
    for size in "1280 900 desktop" "360 800 phone"; do
      set -- $size
      ab set viewport "$1" "$2" >/dev/null
      open_state yesterday "$theme $3"
      check "$theme $3: 13 numbered slots" test "$(numbered_slots)" -eq 13
      check "$theme $3: no horizontal scroll" no_hscroll
      bar="$(js "getComputedStyle(($UV_TILE).querySelector('.uv-bar')).backgroundImage")"
      check "$theme $3: bars use the theme UV gradient" contains "$bar" "gradient"
      [ "$3" = desktop ] && backgrounds="$backgrounds$bar\n"
      shot_tile "theme-$theme-$3"
    done
  done
  js "localStorage.setItem('weather-theme', 'apple')" >/dev/null
  distinct="$(printf '%b' "$backgrounds" | sort -u | grep -c .)"
  check "bar gradients differ between themes ($distinct distinct)" test "$distinct" -ge 2
fi

assert_clean "end of run"
echo
echo "Passed: $PASSED  Failed: $FAILED  (screenshots in $OUT/)"
[ "$FAILED" -eq 0 ]
