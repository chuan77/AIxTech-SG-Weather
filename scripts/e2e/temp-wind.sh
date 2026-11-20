#!/usr/bin/env bash
# Browser E2E checks for temperature and wind on the full-screen map
# (specs/015-temperature-wind-layer).
#
# Stubs POST /api/temp-wind/refresh (stations in every state: each wind level, calm, wind only,
# temperature only, no reading, unnamed, speed without direction) and GET /api/locations (one
# saved place) with `agent-browser network route`, so it never calls data.gov.sg. route cannot set
# an HTTP status, so a failing refresh is simulated with --abort: the frontend takes the same
# "unavailable" path as for a 502 (the 502 itself is covered by backend/src/routes/tempWind.test.ts).
# Stubs set fetched_at 3 minutes back so the client's 2-minute reuse never skips a refresh the
# check asks for.
#
# Usage (from the repo root, after `npm run verify` has built frontend/dist):
#   scripts/e2e/temp-wind.sh [us1|us2|us3|us4|us5|themes]   # no argument runs everything
#   E2E_THEMES="apple radar" E2E_WIDTHS=375 scripts/e2e/temp-wind.sh themes   # a subset
#
# Starts its own temporary server on a throwaway database and tears it down, with the browser,
# on exit (scripts/e2e/lib.sh). E2E_BASE_URL=<url> uses a server you run instead; never point it
# at the `npm run dev` server on weather-starter.localhost:1355. Any uncaught page error or
# console.error while opening or switching views fails the run.
set -euo pipefail

SESSION="${E2E_SESSION:-temp-wind}"
OUT="e2e-artifacts/temp-wind"
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

STATION_COUNT=10

tw_json() { # tw_json [reading age in minutes] [stale true|false] [wind ok|unavailable] [fetched seconds ago]
  node -e '
    const [age = "6", stale = "false", wind = "ok", fetchedAgo = "180"] = process.argv.slice(1);
    const now = Date.now();
    const sgt = (ms) => new Date(ms + 8 * 3600e3).toISOString().slice(0, 19) + "+08:00";
    const at = Math.floor((now - Number(age) * 60e3) / 60e3) * 60e3;
    const windOk = wind === "ok";
    const s = (id, name, latitude, longitude, temperature_c, speed, direction) => ({
      id, name, latitude, longitude, temperature_c,
      wind_speed_knots: windOk ? speed : null, wind_direction_deg: windOk ? direction : null,
    });
    console.log(JSON.stringify({
      stations: [
        s("S199", null, 1.33, 103.75, null, 5.4, 241),
        s("T01", "Clementi Road", 1.3337, 103.7768, 26.3, 8.2, 228),
        s("T02", "Moderate Wind", 1.3721, 103.9474, 27, 15, 90),
        s("T03", "Strong Wind", 1.4168, 103.9673, 28.1, 25, 315),
        s("T04", "Calm Place", 1.4382, 103.7861, 29, 0.4, 40),
        s("T05", "Wind Only", 1.2799, 103.8703, null, 5, 200),
        s("T06", "Temperature Only", 1.3678, 103.9823, 31.2, null, null),
        s("T07", "No Reading", 1.3484, 103.8164, null, null, null),
        s("T08", "Speed Only", 1.3404, 103.709, 30, 5, null),
        // Right at the saved place, so its label would sit under the pin unless nudged off.
        s("T09", "Beside Pin", 1.3352, 103.8502, 27.4, 6, 45),
      ],
      measures: { temperature: "ok", wind },
      temperature_at: sgt(at), wind_at: windOk ? sgt(at) : null,
      fetched_at: new Date(now - Number(fetchedAgo) * 1e3).toISOString(), stale: stale === "true",
    }));' "$@"
}

rain_json() { # a few rain stations, for the "all three layers on" layout checks
  node -e '
    const now = Date.now();
    const sgt = (ms) => new Date(ms + 8 * 3600e3).toISOString().slice(0, 19) + "+08:00";
    const end = Math.floor((now - 10 * 60e3) / 300e3) * 300e3;
    const s = (id, latitude, longitude, total_mm) =>
      ({ id, name: "Rain " + id, latitude, longitude, total_mm, periods_covered: 3 });
    console.log(JSON.stringify({
      stations: [s("R1", 1.335, 103.78, 0.4), s("R2", 1.37, 103.95, 2.6), s("R3", 1.42, 103.79, 0)],
      window_minutes: 15, window_end: sgt(end), window_start: sgt(end - 900e3), periods_found: 3,
      fetched_at: new Date(now - 180e3).toISOString(), stale: false,
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
    Object.assign(weather, { condition: "Showers", area: "Toa Payoh", temperature_c: 27,
      observed_at: new Date().toISOString(), source: "e2e stub", forecast_periods: [], daily_forecast: [] });
    console.log(JSON.stringify({ locations: [{ id: 1, latitude: 1.335, longitude: 103.85,
      created_at: new Date().toISOString(), weather }] }));'
}

route_tw() { # route_tw <json> | --abort
  ab network unroute "**/api/temp-wind/refresh" >/dev/null 2>&1 || true
  if [ "$1" = --abort ]; then
    ab network route "**/api/temp-wind/refresh" --abort >/dev/null
  else
    ab network route "**/api/temp-wind/refresh" --body "$1" >/dev/null
  fi
}

# --- page helpers -------------------------------------------------------------------------

FS=".map-fullscreen"
PANE=".leaflet-temp-wind-pane"
TW_SWITCH="$FS [role=switch][aria-label=\"Temperature & wind\"]"
marks() { js "document.querySelectorAll('${1:-} $PANE .tw-mark').length"; }
count() { js "document.querySelectorAll('$FS $PANE $1').length"; }
tw_requests() {
  js 'performance.getEntriesByType("resource").filter((e) => e.name.includes("/api/temp-wind/refresh")).length'
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
strip_text() { text_of "$FS [data-testid=temp-wind-status]"; }

open_app() { # open_app <context> [temp-wind json]: fresh stubs, page open, card map scrolled in
  ab network unroute >/dev/null 2>&1 || true
  route_tw "${2:-$(tw_json)}"
  ab network route "**/api/rain/refresh" --body "$(rain_json)" >/dev/null
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

close_fullscreen() {
  click "$FS [aria-label=\"Close map\"]" >/dev/null
  wait_for "document.querySelector('$FS') === null" >/dev/null || true
  assert_clean "close the full-screen map"
}

tw_on() { # turn the view on in the full-screen map and wait for the stations
  if [ "$(js "document.querySelector('$TW_SWITCH')?.getAttribute('aria-checked')")" != true ]; then
    click "$TW_SWITCH" >/dev/null
  fi
  # A remembered "on" waits for the user: press the prompt (nothing loads on open).
  js "[...document.querySelectorAll('$FS [data-testid=temp-wind-status] button')].find((b) => /Show latest temperature/.test(b.textContent))?.click(); 1" >/dev/null
  wait_for "document.querySelectorAll('$FS $PANE .tw-mark').length >= $STATION_COUNT" >/dev/null || true
}

open_popup() { # open_popup <station name>: click the mark whose spoken name starts with it
  js "(() => { const m = [...document.querySelectorAll('$FS $PANE .tw-mark')].find((e) => e.querySelector('.sr-only')?.textContent.startsWith('$1')); m?.closest('.leaflet-marker-icon')?.click(); return Boolean(m); })()" >/dev/null
  ab wait 400 >/dev/null
  text_of "$FS .leaflet-popup-content"
}

fresh_start() { js 'localStorage.removeItem("weather-starter.tempWind.enabled"); localStorage.removeItem("weather-starter.tempWind.legendSeen"); localStorage.removeItem("weather-starter.rain.enabled"); localStorage.setItem("weather-theme", "apple"); 1' >/dev/null; }

legend_button() { echo "[...document.querySelectorAll('$FS [data-testid=temp-wind-status] button')].find((b) => b.textContent.trim() === 'Legend')"; }
legend_shown() { js "Boolean(document.querySelector('$FS .tw-legend'))"; }

e2e_start_server
e2e_launch_browser
ab set viewport 1280 900 >/dev/null
ab open "$BASE_URL" >/dev/null
fresh_start

# --- US1: temperatures across the island ----------------------------------------------------

if want us1; then
  echo "US1: every station at its position with its temperature; popup; pins on top"
  fresh_start
  open_app "us1"
  open_fullscreen
  check "the switch sits after Rain and before Lightning in the top bar" \
    test "$(js "(() => { const names = [...document.querySelectorAll('$FS [data-testid=map-layer-controls] [role=switch]')].map((e) => e.getAttribute('aria-label')); return names.join(','); })()")" = "Rain,Temperature & wind,Lightning"
  tw_on
  assert_clean "turn temperature & wind on"
  check "one mark per stubbed station ($STATION_COUNT)" test "$(marks "$FS")" -eq "$STATION_COUNT"
  check "temperatures show to one decimal place" \
    test "$(js "[...document.querySelectorAll('$FS $PANE .tw-temp:not(.tw-temp-missing)')].map((e) => e.textContent).sort().join(',')")" = "26.3°,27.0°,27.4°,28.1°,29.0°,30.0°,31.2°"
  check "location pins sit above the temperature & wind pane" \
    test "$(js "Number(getComputedStyle(document.querySelector('$FS $PANE')).zIndex) < Number(getComputedStyle(document.querySelector('$FS .leaflet-marker-pane')).zIndex)")" = true
  check "the pane sits between rain (440) and lightning (450)" \
    test "$(js "getComputedStyle(document.querySelector('$FS $PANE')).zIndex")" = 445
  # Leaflet icon boxes: every label clear of every pin (2 px tolerance for sub-pixel rounding).
  no_label_under_pin="(() => { const pins = [...document.querySelectorAll('$FS .weather-pin-wrapper')].map((e) => e.getBoundingClientRect()); const marks = [...document.querySelectorAll('$FS $PANE .tw-mark-wrapper')].map((e) => e.getBoundingClientRect()); return pins.length > 0 && marks.every((m) => pins.every((p) => m.right <= p.left + 2 || m.left >= p.right - 2 || m.bottom <= p.top + 2 || m.top >= p.bottom - 2)); })()"
  check "no station label sits under a location pin" test "$(js "$no_label_under_pin")" = true
  ab mouse move 640 450 >/dev/null
  ab mouse wheel 300 >/dev/null
  ab wait 1200 >/dev/null
  check "nor after zooming out" test "$(js "$no_label_under_pin")" = true
  ab mouse wheel -600 >/dev/null
  ab wait 1200 >/dev/null
  check "nor after zooming in" test "$(js "$no_label_under_pin")" = true
  shot "us1-labels-off-pins"
  popup="$(open_popup "Clementi Road")"
  check "the popup names the station and gives its temperature" grep -q "Clementi Road.*Temperature: 26.3 °C" <<<"$popup"
  check "the popup gives the wind with speed and where it comes from" grep -q "15 km/h, light, from SW (228°)" <<<"$popup"
  check "the popup gives the reading time" grep -qE "Readings at [0-9]+:[0-9]{2} (am|pm)" <<<"$popup"
  check "the popup credits the source" grep -q "NEA via data.gov.sg" <<<"$popup"
  shot "us1-fullscreen"
fi

# --- US2: wind direction and strength --------------------------------------------------------

if want us2; then
  echo "US2: arrows by level, calm, the legend"
  fresh_start
  open_app "us2"
  open_fullscreen
  tw_on
  check "four light, one moderate and one strong arrow" \
    test "$(count .tw-arrow-light),$(count .tw-arrow-moderate),$(count .tw-arrow-strong)" = "4,1,1"
  size() { js "document.querySelector('$FS $PANE .tw-arrow-$1')?.style.width"; }
  check "arrows grow with strength (14/18/22 px)" \
    test "$(size light),$(size moderate),$(size strong)" = "14px,18px,22px"
  check "a wind from 228° points the arrow to 48° (toward NE)" \
    test "$(js "[...document.querySelectorAll('$FS $PANE .tw-mark')].find((e) => e.textContent.includes('Clementi Road'))?.querySelector('svg')?.style.transform")" = "rotate(48deg)"
  check "the calm station says calm, with no arrow" \
    test "$(js "(() => { const m = [...document.querySelectorAll('$FS $PANE .tw-mark')].find((e) => e.textContent.includes('Calm Place')); return Boolean(m?.querySelector('.tw-calm')) && !m?.querySelector('.tw-arrow'); })()")" = true
  check "a speed without a direction gets no arrow" \
    test "$(js "Boolean([...document.querySelectorAll('$FS $PANE .tw-mark')].find((e) => e.textContent.includes('Speed Only'))?.querySelector('.tw-wind-missing'))")" = true
  ab wait 300 >/dev/null
  check "the legend opens by itself the first time readings show" test "$(legend_shown)" = true
  legend="$(text_of "$FS .tw-legend")"
  for item in Calm Light Moderate Strong "No reading" "39 km/h or more" "Arrows point the way the wind is blowing" \
    "Air Temperature across Singapore" "Wind Direction across Singapore" "Singapore Open Data Licence version 1.0"; do
    check "the legend lists: $item" grep -q "$item" <<<"$legend"
  done
  shot "us2-legend"
  assert_clean "open the legend"
  js "$(legend_button)?.click(); 1" >/dev/null
  ab wait 300 >/dev/null
  check "the Legend button closes it" test "$(legend_shown)" = false
  check "the first opening is remembered" \
    test "$(js "localStorage.getItem('weather-starter.tempWind.legendSeen')")" = true
fi

# --- US3: freshness and missing readings ------------------------------------------------------

if want us3; then
  echo "US3: missing readings, reading time, out of date"
  fresh_start
  open_app "us3"
  open_fullscreen
  tw_on
  check "three stations show the crossed-out no-wind glyph" test "$(count .tw-wind-missing)" -eq 3
  check "three stations show '–°' for no temperature" \
    test "$(js "[...document.querySelectorAll('$FS $PANE .tw-temp-missing')].filter((e) => e.textContent === '–°').length")" -eq 3
  popup="$(open_popup "No Reading")"
  check "a station with neither says No reading for both" grep -q "Temperature: No reading.*Wind: No reading" <<<"$popup"
  popup="$(open_popup "Station S199")"
  check "an unnamed station is labelled Station S199" grep -q "Station S199" <<<"$popup"
  strip="$(strip_text)"
  check "the strip counts the stations" grep -q "Temp & wind at $STATION_COUNT stations" <<<"$strip"
  check "the strip gives the reading time and its age" grep -qE "at [0-9]+:[0-9]{2} (am|pm) · [0-9]+ min ago" <<<"$strip"
  check "healthy 6-minute-old data is not flagged" bash -c '! grep -q "out of date" <<<"$1"' _ "$strip"

  open_app "us3 old data" "$(tw_json 20)"
  open_fullscreen
  tw_on
  check "data 20 minutes old is flagged out of date" grep -q "out of date" <<<"$(strip_text)"

  open_app "us3 stale data" "$(tw_json 6 true)"
  open_fullscreen
  tw_on
  check "data served after a failure is flagged out of date" grep -q "out of date" <<<"$(strip_text)"

  open_app "us3 wind unavailable" "$(tw_json 6 false unavailable)"
  open_fullscreen
  tw_on
  check "a failed measure is named in the strip" grep -q "Wind unavailable" <<<"$(strip_text)"
  popup="$(open_popup "Clementi Road")"
  check "and its popup says Unavailable, not No reading" grep -q "Wind: Unavailable" <<<"$popup"
  shot "us3-wind-unavailable"
fi

# --- US4: on and off ------------------------------------------------------------------------

if want us4; then
  echo "US4: off by default, nothing on load, remembered, full-screen only"
  fresh_start
  # Fetched just now, so turning the view back on and reopening full screen reuse it (2 minutes).
  open_app "us4" "$(tw_json 6 false ok 0)"
  check "no temperature & wind request on page load" test "$(tw_requests)" -eq 0
  check "the card map draws no temperature & wind marks" test "$(marks)" -eq 0
  click '[aria-label^="Map layers"]' >/dev/null
  ab wait 300 >/dev/null
  check "the card's Layers menu has no Temperature & wind switch" \
    test "$(js 'Boolean(document.querySelector("[role=switch][aria-label=\"Temperature & wind\"]"))')" = false
  check "and still holds Rain and Lightning" \
    test "$(js 'Boolean(document.querySelector("[role=switch][aria-label=Rain]")) && Boolean(document.querySelector("[role=switch][aria-label=Lightning]"))')" = true
  click '[aria-label^="Map layers"]' >/dev/null
  open_fullscreen
  check "the view is off by default" test "$(js "document.querySelector('$TW_SWITCH')?.getAttribute('aria-checked')")" = false
  tw_on
  check "turning it on made one request" test "$(tw_requests)" -eq 1
  click "$TW_SWITCH" >/dev/null
  ab wait 150 >/dev/null
  check "turning it off removes every station" test "$(marks "$FS")" -eq 0
  check "and its strip" test "$(js "Boolean(document.querySelector('$FS [data-testid=temp-wind-status]'))")" = false
  check "pins stay after it is off" test "$(js "document.querySelectorAll('$FS .weather-pin').length")" -ge 1
  started="$(date +%s%N)"
  click "$TW_SWITCH" >/dev/null
  wait_for "document.querySelectorAll('$FS $PANE .tw-mark').length >= $STATION_COUNT" 4 >/dev/null || true
  elapsed_ms=$(( ($(date +%s%N) - started) / 1000000 ))
  check "turning it back on with data loaded shows it within 1 s (SC-004; ${elapsed_ms} ms incl. tool overhead)" \
    test "$(marks "$FS")" -ge "$STATION_COUNT"
  check "with no new request (under 2 minutes old)" test "$(tw_requests)" -eq 1

  close_fullscreen
  check "the card still draws nothing after full screen closes" test "$(marks)" -eq 0
  open_fullscreen
  wait_for "document.querySelectorAll('$FS $PANE .tw-mark').length >= $STATION_COUNT" >/dev/null || true
  check "reopening full screen shows the same readings (US4 scenario 5)" test "$(marks "$FS")" -eq "$STATION_COUNT"
  check "with no extra request" test "$(tw_requests)" -eq 1

  ab reload >/dev/null
  ab wait 1200 >/dev/null
  assert_clean "reload with the view remembered on"
  check "after a reload nothing is requested" test "$(tw_requests)" -eq 0
  js '(() => { const h = [...document.querySelectorAll("section h2")].find((e) => /map/i.test(e.textContent)); h?.scrollIntoView(); return 1; })()' >/dev/null
  ab wait 600 >/dev/null
  open_fullscreen
  check "the view shows as on" test "$(js "document.querySelector('$TW_SWITCH')?.getAttribute('aria-checked')")" = true
  check "with the 'Show latest temperature & wind' prompt" grep -q "Show latest temperature & wind" <<<"$(strip_text)"
  check "and still no request" test "$(tw_requests)" -eq 0
  shot "us4-prompt"
fi

# --- US5: refresh and failure ---------------------------------------------------------------

if want us5; then
  echo "US5: refresh keeps earlier readings; failures show unavailable"
  fresh_start
  open_app "us5"
  open_fullscreen
  tw_on
  route_tw --abort
  click "$FS [aria-label=\"Refresh temperature & wind\"]" >/dev/null
  check "earlier stations stay while refreshing" test "$(marks "$FS")" -eq "$STATION_COUNT"
  wait_for "/Fresh data unavailable/.test(document.querySelector('$FS [data-testid=temp-wind-status]')?.textContent ?? '')" >/dev/null || true
  E2E_ALLOW_ERRORS="$ABORT_NOISE" assert_clean "a failed refresh"
  strip="$(strip_text)"
  check "a failed refresh says fresh data is unavailable" grep -q "Fresh data unavailable, showing earlier readings" <<<"$strip"
  check "and marks the earlier readings out of date" grep -q "out of date" <<<"$strip"
  check "and keeps them on screen" test "$(marks "$FS")" -eq "$STATION_COUNT"
  check "rain and lightning switches still work" \
    test "$(js "Boolean(document.querySelector('$FS [role=switch][aria-label=Rain]')) && Boolean(document.querySelector('$FS [role=switch][aria-label=Lightning]'))")" = true
  shot "us5-unavailable"

  fresh_start
  open_app "us5 first-load failure" --abort
  open_fullscreen
  click "$TW_SWITCH" >/dev/null
  wait_for "/data is unavailable/.test(document.querySelector('$FS [data-testid=temp-wind-status]')?.textContent ?? '')" >/dev/null || true
  E2E_ALLOW_ERRORS="$ABORT_NOISE" assert_clean "a failed first load"
  check "a failed first load says the data is unavailable" \
    grep -q "Temperature and wind data is unavailable" <<<"$(strip_text)"
  check "and draws no stations" test "$(marks "$FS")" -eq 0
fi

# --- themes: every theme, 375 px and 1280 px, all three layers on ----------------------------

if want themes; then
  echo "Themes: labels, contrast and the top bar in all six themes, with rain and lightning on"
  for width in ${E2E_WIDTHS:-375 1280}; do
    ab set viewport "$width" 812 >/dev/null
    for theme in ${E2E_THEMES:-apple glass radar sticker memphis singapore}; do
      js "localStorage.setItem('weather-theme', '$theme'); localStorage.setItem('weather-starter.rain.enabled', 'true'); localStorage.setItem('weather-starter.lightning.enabled', 'true'); localStorage.setItem('weather-starter.tempWind.legendSeen', 'true'); localStorage.setItem('weather-starter.rain.legendSeen', 'true'); localStorage.removeItem('weather-starter.tempWind.enabled'); 1" >/dev/null
      open_app "$theme $width"
      open_fullscreen
      js "[...document.querySelectorAll('$FS [role=status] button')].find((b) => /Show latest rain/.test(b.textContent))?.click(); 1" >/dev/null
      tw_on
      check "$theme $width: every station drawn" test "$(marks "$FS")" -eq "$STATION_COUNT"
      layout="$(js "(() => {
        const close = document.querySelector('$FS [aria-label=\"Close map\"]').getBoundingClientRect();
        const controls = [...document.querySelectorAll('$FS [data-testid=map-layer-controls] > *')];
        const rects = controls.map((e) => e.getBoundingClientRect());
        const overlaps = rects.filter((r) => r.left < close.right && r.right > close.left && r.top < close.bottom && r.bottom > close.top).length;
        const small = controls.filter((e) => { const r = e.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5; }).map((e) => { const r = e.getBoundingClientRect(); return (e.getAttribute('aria-label') || e.tagName) + ':' + r.width.toFixed(1) + 'x' + r.height.toFixed(1); }).join(' ') || 'none';
        const offscreen = rects.filter((r) => r.left < 0 || r.right > innerWidth).length;
        const rows = new Set(rects.map((r) => Math.round(r.top))).size;
        return [overlaps, small, offscreen, rows].join(',');
      })()")"
      IFS=, read -r overlaps small offscreen rows <<<"$layout"
      small="${small:-none}"
      check "$theme $width: no top-bar control covers the close button" test "$overlaps" -eq 0
      check "$theme $width: every control keeps a 44 px target (too small: $small)" test "$small" = none
      check "$theme $width: every control is on screen ($rows row(s))" test "$offscreen" -eq 0
      ratios="$(js "(() => {
        const dark = ['radar', 'singapore'].includes(document.documentElement.dataset.theme);
        const rgb = (c) => c.match(/\\d+(\\.\\d+)?/g).map(Number).slice(0, 3);
        const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
          .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
        const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
        const basemap = dark ? [38, 38, 38] : [242, 239, 233];
        const mark = document.querySelector('$FS $PANE .tw-mark');
        const m = getComputedStyle(mark);
        const bg = rgb(m.backgroundColor);
        const text = ratio(rgb(getComputedStyle(mark.querySelector('.tw-temp')).color), bg);
        const missing = ratio(rgb(getComputedStyle(document.querySelector('$FS $PANE .tw-temp-missing')).color), bg);
        const arrow = ratio(rgb(getComputedStyle(document.querySelector('$FS $PANE .tw-arrow svg')).stroke), bg);
        const edge = Math.max(ratio(bg, basemap), ratio(rgb(m.borderTopColor), basemap));
        return [text, missing, arrow, edge].map((v) => v.toFixed(1)).join(',');
      })()")"
      IFS=, read -r text missing arrow edge <<<"$ratios"
      check "$theme $width: label text reaches 4.5:1 (${text}:1)" node -e 'process.exit(Number(process.argv[1]) >= 4.5 ? 0 : 1)' "$text"
      check "$theme $width: '–°' reaches 4.5:1 (${missing}:1)" node -e 'process.exit(Number(process.argv[1]) >= 4.5 ? 0 : 1)' "$missing"
      check "$theme $width: arrow reaches 3:1 (${arrow}:1)" node -e 'process.exit(Number(process.argv[1]) >= 3 ? 0 : 1)' "$arrow"
      check "$theme $width: the label stands out from the basemap (${edge}:1)" node -e 'process.exit(Number(process.argv[1]) >= 3 ? 0 : 1)' "$edge"
      check "$theme $width: pins still on top and clickable" \
        test "$(js "(() => { const pin = document.querySelector('$FS .weather-pin'); if (!pin) return false; const r = pin.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return Boolean(top && pin.contains(top) || top === pin); })()")" = true
      shot "theme-$theme-$width"
    done
  done
  ab set viewport 1280 900 >/dev/null
  js "localStorage.setItem('weather-theme', 'apple'); 1" >/dev/null
fi

assert_clean "end of run"

echo
echo "Passed: $PASSED  Failed: $FAILED  (screenshots in $OUT/)"
[ "$FAILED" -eq 0 ]
