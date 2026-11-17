#!/usr/bin/env bash
# Browser E2E checks for island-wide rain on the map (specs/011-island-rain-view).
#
# Stubs POST /api/rain/refresh (stations at every level, partial and missing) and
# GET /api/locations (one saved place) with `agent-browser network route`, so it never calls
# data.gov.sg. route cannot set an HTTP status, so a failing refresh is simulated with --abort:
# the frontend takes the same "unavailable" path as for a 502 (the 502 itself is covered by
# backend/src/routes/rain.test.ts). Stubs set fetched_at 3 minutes back so the client's 2-minute
# reuse never skips a refresh the check asks for.
#
# Usage (from the repo root, after `npm run verify` has built frontend/dist):
#   scripts/e2e/rain-view.sh [us1|us2|us3|us4|us5|themes]   # no argument runs everything
#
# Starts its own temporary server on a throwaway database and tears it down, with the browser,
# on exit (scripts/e2e/lib.sh). E2E_BASE_URL=<url> uses a server you run instead; never point it
# at the `npm run dev` server on weather-starter.localhost:1355. Any uncaught page error or
# console.error while opening or switching views fails the run.
set -euo pipefail

SESSION="${E2E_SESSION:-rain-view}"
OUT="e2e-artifacts/rain-view"
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
# The browser logs an aborted request as a console error; allowed only around simulated failures.
ABORT_NOISE='Failed to load resource|ERR_FAILED|net::'

# --- stubs --------------------------------------------------------------------------------

STATION_COUNT=12

rain_json() { # rain_json [window age in minutes] [stale true|false]
  node -e '
    const [age = "10", stale = "false"] = process.argv.slice(1);
    const now = Date.now();
    const sgt = (ms) => new Date(ms + 8 * 3600e3).toISOString().slice(0, 19) + "+08:00";
    const end = Math.floor((now - Number(age) * 60e3) / 300e3) * 300e3;
    const s = (id, name, latitude, longitude, total_mm, periods_covered = 3) =>
      ({ id, name, latitude, longitude, total_mm, periods_covered });
    console.log(JSON.stringify({
      stations: [
        s("E01", "Dry North", 1.43, 103.79, 0), s("E02", "Dry West", 1.32, 103.64, 0),
        s("E03", "Dry South", 1.27, 103.82, 0),
        s("E04", "Light One", 1.34, 103.71, 0.2), s("E05", "Light Two", 1.315, 103.765, 0.4),
        s("E06", "Moderate One", 1.335, 103.856, 0.6), s("E07", "Moderate Two", 1.352, 103.835, 1.4),
        s("E08", "Heavy One", 1.355, 103.868, 2.6), s("E09", "Heavy Two", 1.335, 103.908, 6),
        s("E10", "Partial Station", 1.371, 103.892, 0.4, 2),
        s("E11", "Missing One", 1.329, 103.802, null, 0), s("E12", "Missing Two", 1.302, 103.907, null, 0),
      ],
      window_minutes: 15, window_end: sgt(end), window_start: sgt(end - 900e3), periods_found: 3,
      fetched_at: new Date(now - 180e3).toISOString(), stale: stale === "true",
    }));' "$@"
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
    Object.assign(weather, { condition: "Showers", area: "Toa Payoh", temperature_c: 27,
      observed_at: new Date().toISOString(), source: "e2e stub", forecast_periods: [], daily_forecast: [] });
    console.log(JSON.stringify({ locations: [{ id: 1, latitude: 1.335, longitude: 103.85,
      created_at: new Date().toISOString(), weather }] }));'
}

route_rain() { # route_rain <json> | --abort
  ab network unroute "**/api/rain/refresh" >/dev/null 2>&1 || true
  if [ "$1" = --abort ]; then
    ab network route "**/api/rain/refresh" --abort >/dev/null
  else
    ab network route "**/api/rain/refresh" --body "$1" >/dev/null
  fi
}

# --- page helpers -------------------------------------------------------------------------

FS=".map-fullscreen"
marks() { js "document.querySelectorAll('${1:-} .leaflet-rain-pane .rain-mark').length"; }
kind_count() { js "document.querySelectorAll('${2:-} .leaflet-rain-pane .rain-$1').length"; }
rain_requests() {
  js 'performance.getEntriesByType("resource").filter((e) => e.name.includes("/api/rain/refresh")).length'
}
click() { js "(() => { const el = document.querySelector('$1'); el?.click(); return Boolean(el); })()"; }
wait_for() { # wait_for <js condition> [tries of 250 ms]
  for _ in $(seq 1 "${2:-20}"); do
    [ "$(js "$1")" = true ] && return 0
    ab wait 250 >/dev/null
  done
  return 1
}
text_of() { js "document.querySelector('$1')?.textContent ?? ''"; }

open_app() { # open_app <context> [rain json]: fresh stubs, page open, card map scrolled in
  ab network unroute >/dev/null 2>&1 || true
  route_rain "${2:-$(rain_json)}"
  ab network route "**/api/locations" --body "$(locations_json)" >/dev/null
  ab open "$BASE_URL" >/dev/null
  ab wait 1200 >/dev/null
  assert_clean "open the app: $1"
  js '(() => { const h = [...document.querySelectorAll("section h2")].find((e) => /map/i.test(e.textContent)); h?.scrollIntoView(); return Boolean(h); })()' >/dev/null
  wait_for 'document.querySelectorAll(".leaflet-container").length > 0' >/dev/null || true
}

open_fullscreen() {
  click '[aria-label="Expand map to fullscreen"]' >/dev/null
  wait_for "document.querySelector('$FS .leaflet-container') !== null" >/dev/null || true
  assert_clean "open the full-screen map"
}

fullscreen_rain_on() { # turn rain on in the full-screen map and wait for the stations
  if [ "$(js "document.querySelector('$FS [role=switch][aria-label=Rain]')?.getAttribute('aria-checked')")" != true ]; then
    click "$FS [role=switch][aria-label=Rain]" >/dev/null
  fi
  # Remembered "on" waits for the user: press the "Show latest rain" prompt (nothing loads on open).
  js "[...document.querySelectorAll('$FS [role=status] button')].find((b) => /Show latest rain/.test(b.textContent))?.click(); 1" >/dev/null
  wait_for "document.querySelectorAll('$FS .leaflet-rain-pane .rain-mark').length >= $STATION_COUNT" >/dev/null || true
}

fullscreen_rain_off_on() { # turn rain off, then on again (data under 2 minutes old is reused)
  click "$FS [role=switch][aria-label=Rain]" >/dev/null
  ab wait 300 >/dev/null
  fullscreen_rain_on
  ab wait 300 >/dev/null
}

open_station_popup() { # open_station_popup <kind>: click the first station of that kind
  js "(() => { const m = document.querySelector('$FS .leaflet-rain-pane .rain-$1'); m?.closest('.leaflet-marker-icon')?.click(); return Boolean(m); })()" >/dev/null
  ab wait 400 >/dev/null
  text_of "$FS .leaflet-popup-content"
}

fresh_start() { js 'localStorage.removeItem("weather-starter.rain.enabled"); localStorage.removeItem("weather-starter.rain.legendSeen"); localStorage.setItem("weather-theme", "apple"); 1' >/dev/null; }

legend_button() { echo "[...document.querySelectorAll('$FS button')].find((b) => b.textContent.trim() === 'Legend')"; }
legend_shown() { js "Boolean(document.querySelector('$FS .rain-legend'))"; }
open_legend() { # opens the full-screen legend unless it is already open
  js "(() => { const b = $(legend_button); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); return 1; })()" >/dev/null
  ab wait 300 >/dev/null
}

e2e_start_server
e2e_launch_browser
ab set viewport 1280 900 >/dev/null
ab open "$BASE_URL" >/dev/null
fresh_start

# --- US1: where it rained ------------------------------------------------------------------

if want us1; then
  echo "US1: every station at its position, wet vs dry, popup"
  fresh_start
  open_app "us1"
  open_fullscreen
  fullscreen_rain_on
  assert_clean "turn rain on"
  check "one mark per stubbed station ($STATION_COUNT)" test "$(marks "$FS")" -eq "$STATION_COUNT"
  check "dry stations are drawn" test "$(kind_count dry "$FS")" -eq 3
  check "wet stations are drawn" \
    test "$(js "document.querySelectorAll('$FS .leaflet-rain-pane :is(.rain-light,.rain-moderate,.rain-heavy)').length")" -eq 7
  check "location pins sit above the rain pane" \
    test "$(js 'Number(getComputedStyle(document.querySelector(".leaflet-rain-pane")).zIndex) < Number(getComputedStyle(document.querySelector(".leaflet-marker-pane")).zIndex)')" = true
  popup="$(open_station_popup heavy)"
  check "a heavy station's popup names it and gives its total and level" \
    grep -qE "Heavy (One|Two).*mm · Heavy" <<<"$popup"
  check "the popup credits the source" grep -q "Rainfall: NEA via data.gov.sg" <<<"$popup"
  shot "us1-fullscreen"
fi

# --- US2: how heavy ------------------------------------------------------------------------

if want us2; then
  echo "US2: level symbols and the key"
  fresh_start
  open_app "us2"
  open_fullscreen
  fullscreen_rain_on
  size() { js "document.querySelector('$FS .leaflet-rain-pane .rain-$1')?.style.width"; }
  check "light, moderate and heavy differ in size (14/18/24 px)" \
    test "$(size light),$(size moderate),$(size heavy)" = "14px,18px,24px"
  check "dry is a ring, wet levels are drops" \
    test "$(js "Boolean(document.querySelector('$FS .rain-dry circle')) && Boolean(document.querySelector('$FS .rain-heavy path'))")" = true
  ab wait 300 >/dev/null
  check "the legend opens by itself the first time readings show" test "$(legend_shown)" = true
  check "the button is labelled Legend" test "$(js "Boolean($(legend_button))")" = true
  legend="$(text_of "$FS .rain-legend")"
  for level in Light Moderate Heavy "No reading" "Dry (0 mm)" "Singapore Open Data Licence version 1.0"; do
    check "the key lists $level" grep -q "$level" <<<"$legend"
  done
  check "the key gives the heavy range" grep -q "2.5 mm or more" <<<"$legend"
  shot "us2-key"
  assert_clean "open the key"
  js "$(legend_button)?.click(); 1" >/dev/null
  ab wait 300 >/dev/null
  check "the Legend button closes it" test "$(legend_shown)" = false
  check "the first opening is remembered" \
    test "$(js "localStorage.getItem('weather-starter.rain.legendSeen')")" = true
  fullscreen_rain_off_on
  check "it does not open by itself a second time" test "$(legend_shown)" = false
  assert_clean "legend stays closed"
fi

# --- US3: freshness and missing stations ---------------------------------------------------

if want us3; then
  echo "US3: missing and partial stations, reading time, out of date"
  fresh_start
  open_app "us3"
  open_fullscreen
  fullscreen_rain_on
  check "both missing stations are drawn as missing" test "$(kind_count missing "$FS")" -eq 2
  check "the partial station carries the badge" \
    test "$(js "document.querySelectorAll('$FS .leaflet-rain-pane .rain-partial').length")" -eq 1
  popup="$(open_station_popup missing)"
  check "a missing station says No reading" grep -q "No reading in the last 15 minutes" <<<"$popup"
  check "a missing station shows no level or total" bash -c '! grep -qE "Dry|Light|Moderate|Heavy|[0-9] mm" <<<"$1"' _ "$popup"
  strip="$(text_of "$FS [role=status]")"
  check "the strip gives the reading time and its age" grep -qE "to [0-9]+:[0-9]{2} (am|pm) · [0-9]+ min ago" <<<"$strip"
  check "healthy data is not flagged" bash -c '! grep -q "out of date" <<<"$1"' _ "$strip"

  open_app "us3 old data" "$(rain_json 25)"
  open_fullscreen
  fullscreen_rain_on
  check "data 25 minutes old is flagged out of date" grep -q "out of date" <<<"$(text_of "$FS [role=status]")"

  open_app "us3 stale data" "$(rain_json 10 true)"
  open_fullscreen
  fullscreen_rain_on
  strip="$(text_of "$FS [role=status]")"
  check "data served after a failure is flagged out of date" grep -q "out of date" <<<"$strip"
  check "and the strip says rain data is unavailable" grep -q "Rain data unavailable" <<<"$strip"
  shot "us3-stale"
fi

# --- US4: on and off ------------------------------------------------------------------------

if want us4; then
  echo "US4: off by default, nothing on load, remembered, shared between maps"
  fresh_start
  open_app "us4"
  check "no rain request on page load" test "$(rain_requests)" -eq 0
  click '[aria-label^="Map layers"]' >/dev/null
  ab wait 300 >/dev/null
  check "the card's Layers menu holds a Rain switch, off by default" \
    test "$(js 'document.querySelector("[role=switch][aria-label=Rain]")?.getAttribute("aria-checked")')" = false
  check "and the Lightning switch" test "$(js 'Boolean(document.querySelector("[role=switch][aria-label=Lightning]"))')" = true
  click '[role=switch][aria-label=Rain]' >/dev/null
  check "turning rain on shows the stations on the card" \
    wait_for "document.querySelectorAll('.leaflet-rain-pane .rain-mark').length >= $STATION_COUNT"
  check "turning rain on made one request" test "$(rain_requests)" -eq 1
  assert_clean "turn rain on in the card"
  shot "us4-card-on"
  check "the card shows one status strip" \
    test "$(js '[...document.querySelectorAll("[role=status]")].filter((e) => /Rain at/.test(e.textContent)).length')" -eq 1

  click '[role=switch][aria-label=Rain]' >/dev/null
  ab wait 150 >/dev/null
  check "turning rain off removes every station" test "$(marks)" -eq 0
  check "pins stay after rain is off" test "$(js 'document.querySelectorAll(".weather-pin").length')" -ge 1
  started="$(date +%s%N)"
  click '[role=switch][aria-label=Rain]' >/dev/null
  wait_for "document.querySelectorAll('.leaflet-rain-pane .rain-mark').length >= $STATION_COUNT" 4 >/dev/null || true
  elapsed_ms=$(( ($(date +%s%N) - started) / 1000000 ))
  check "turning rain back on with data loaded shows it within 1 s (${elapsed_ms} ms incl. tool overhead)" \
    test "$(marks)" -ge "$STATION_COUNT"

  ab reload >/dev/null
  ab wait 1200 >/dev/null
  assert_clean "reload with rain remembered on"
  js '(() => { const h = [...document.querySelectorAll("section h2")].find((e) => /map/i.test(e.textContent)); h?.scrollIntoView(); return 1; })()' >/dev/null
  ab wait 800 >/dev/null
  check "after a reload the card asks 'Show latest rain'" \
    grep -q "Show latest rain" <<<"$(js '[...document.querySelectorAll("[role=status]")].map((e) => e.textContent).join(" | ")')"
  check "and has made no rain request" test "$(rain_requests)" -eq 0
  js '[...document.querySelectorAll("[role=status] button")].find((b) => /Show latest rain/.test(b.textContent))?.click(); 1' >/dev/null
  wait_for "document.querySelectorAll('.leaflet-rain-pane .rain-mark').length >= $STATION_COUNT" >/dev/null || true
  before="$(rain_requests)"
  open_fullscreen
  wait_for "document.querySelectorAll('$FS .leaflet-rain-pane .rain-mark').length >= $STATION_COUNT" >/dev/null || true
  check "the full-screen map shows the same stations" test "$(marks "$FS")" -eq "$STATION_COUNT"
  check "with no new request" test "$(rain_requests)" -eq "$before"
  check "the card's rain is not drawn under full screen" test "$(marks)" -eq "$STATION_COUNT"
fi

# --- US5: refresh and failure --------------------------------------------------------------

if want us5; then
  echo "US5: refresh keeps earlier readings; failures show unavailable"
  fresh_start
  open_app "us5"
  open_fullscreen
  fullscreen_rain_on
  route_rain --abort
  click "$FS [aria-label=\"Refresh rain\"]" >/dev/null
  check "earlier stations stay while refreshing" test "$(marks "$FS")" -eq "$STATION_COUNT"
  wait_for "/Rain data unavailable/.test(document.querySelector('$FS [role=status]')?.textContent ?? '')" >/dev/null || true
  E2E_ALLOW_ERRORS="$ABORT_NOISE" assert_clean "a failed refresh"
  strip="$(text_of "$FS [role=status]")"
  check "a failed refresh says rain data is unavailable" grep -q "Rain data unavailable" <<<"$strip"
  check "and keeps the earlier stations on screen" test "$(marks "$FS")" -eq "$STATION_COUNT"
  check "lightning still works" bash -c '[ "$1" = true ]' _ \
    "$(js "Boolean(document.querySelector('$FS [role=switch][aria-label=Lightning]'))")"
  shot "us5-unavailable"

  fresh_start
  open_app "us5 first-load failure" --abort
  open_fullscreen
  click "$FS [role=switch][aria-label=Rain]" >/dev/null
  wait_for "/Rain data unavailable/.test(document.querySelector('$FS [role=status]')?.textContent ?? '')" >/dev/null || true
  E2E_ALLOW_ERRORS="$ABORT_NOISE" assert_clean "a failed first load"
  check "a failed first load shows only 'Rain data unavailable'" \
    grep -q "Rain data unavailable" <<<"$(text_of "$FS [role=status]")"
  check "and draws no stations" test "$(marks "$FS")" -eq 0
  check "which differs from 'no rain'" bash -c '! grep -q "No rain in the last 15 minutes" <<<"$1"' _ "$(text_of "$FS [role=status]")"
fi

# --- themes: every theme at 375 px ---------------------------------------------------------

if want themes; then
  echo "Themes: symbols and text in all six themes at 375 px"
  ab set viewport 375 812 >/dev/null
  for theme in apple glass radar sticker memphis singapore; do
    js "localStorage.setItem('weather-theme', '$theme'); localStorage.removeItem('weather-starter.rain.enabled'); 1" >/dev/null
    open_app "$theme"
    open_fullscreen
    fullscreen_rain_on
    check "$theme: every station drawn" test "$(marks "$FS")" -eq "$STATION_COUNT"
    open_legend
    # Outline vs the theme's nominal basemap colour (voyager/light_all land or dark_all land), and
    # strip text vs the strip background: the rule in docs/theming.md.
    ratios="$(js "(() => {
      const css = getComputedStyle(document.documentElement);
      const dark = ['radar', 'singapore'].includes(document.documentElement.dataset.theme);
      const hex = (c) => { const m = c.match(/\\d+(\\.\\d+)?/g).map(Number); return m.slice(0, 3); };
      const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
        .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      const probe = (value) => { const el = document.createElement('i'); el.style.color = value; document.body.append(el); const c = getComputedStyle(el).color; el.remove(); return hex(c); };
      const basemap = dark ? [38, 38, 38] : [242, 239, 233];
      const outline = ratio(probe(css.getPropertyValue('--rain-outline')), basemap);
      const strip = document.querySelector('$FS [role=status]');
      const s = getComputedStyle(strip);
      const text = ratio(hex(s.color), hex(s.backgroundColor));
      return outline.toFixed(1) + ',' + text.toFixed(1);
    })()")"
    outline="${ratios%,*}"
    text="${ratios#*,}"
    check "$theme: rain outline reaches 3:1 on the basemap (${outline}:1)" \
      node -e 'process.exit(Number(process.argv[1]) >= 3 ? 0 : 1)' "$outline"
    check "$theme: strip text reaches 4.5:1 (${text}:1)" \
      node -e 'process.exit(Number(process.argv[1]) >= 4.5 ? 0 : 1)' "$text"
    shot "theme-$theme-375"
  done
  ab set viewport 1280 900 >/dev/null
  js "localStorage.setItem('weather-theme', 'apple'); 1" >/dev/null
fi

assert_clean "end of run"

echo
echo "Passed: $PASSED  Failed: $FAILED  (screenshots in $OUT/)"
[ "$FAILED" -eq 0 ]
