#!/usr/bin/env bash
# Browser checks for lightning strike grouping at storm volume (specs/009-lightning-strike-grouping).
#
# Replays the real 2026-11-16 storm (37,242 strikes, backend/fixtures/) against the production
# build. 6 MB can't go through `agent-browser network route --body` (argv size), so an init script
# replaces fetch for POST /api/lightning/refresh only, with times moved to now. The same script
# records long tasks from before the first navigation. GET /api/locations is stubbed with one place.
#
# Usage (from the repo root, after `npm run verify` has built frontend/dist):
#   scripts/e2e/lightning-grouping.sh [us1|us2]   # no argument runs everything
#
# Starts its own temporary server on a throwaway database and tears it down, with the browser, on
# exit (scripts/e2e/lib.sh). Never point E2E_BASE_URL at the `npm run dev` server on :1355.
# Any uncaught page error or console.error fails the run.
set -euo pipefail

SESSION="${E2E_SESSION:-lightning-grouping}"
OUT="e2e-artifacts/lightning-grouping"
FILTER="${1:-all}"
FIXTURE="backend/fixtures/lightning-storm-2026-11-16.json.gz"
MAX_TASK_MS="${E2E_MAX_TASK_MS:-200}"
MAX_MARKS=1500
MAX_HEAP_MB=100
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
le() { awk -v a="$1" -v b="$2" 'BEGIN { exit !(a <= b) }'; }

# --- replay init script --------------------------------------------------------------------

node -e '
  const fs = require("fs"), zlib = require("zlib");
  const [fixture, out] = process.argv.slice(1);
  const capture = JSON.parse(zlib.gunzipSync(fs.readFileSync(fixture)).toString("utf8"));
  const body = `(() => {
    const CAPTURE = ${JSON.stringify(capture)};
    const D = (window.__diag = { longtasks: [] });
    try {
      new PerformanceObserver((list) => { for (const e of list.getEntries()) D.longtasks.push([e.startTime, e.duration]); })
        .observe({ type: "longtask", buffered: true });
    } catch {}
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.url;
      if (!url.includes("/api/lightning/refresh")) return realFetch(input, init);
      const shift = Date.now() - Date.parse(CAPTURE.captured_at);
      const strikes = CAPTURE.strikes.map(([latitude, longitude, at, type, label]) => {
        const occurred_at = new Date(Date.parse(at) + shift).toISOString();
        return { id: occurred_at + "|" + latitude + "|" + longitude, latitude, longitude, occurred_at, type, label };
      });
      const observation = { strikes, window_minutes: 60, fetched_at: new Date().toISOString(),
        provider_updated_at: new Date().toISOString(), stale: false };
      return new Response(JSON.stringify(observation), { status: 200, headers: { "content-type": "application/json" } });
    };
  })();`;
  fs.writeFileSync(out, body);
' "$FIXTURE" "$OUT/replay-init.js"

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

# --- page helpers -----------------------------------------------------------------------------

CARD='section .leaflet-container'
FULL='[role=dialog] .leaflet-container'
marks_in() { js "document.querySelectorAll('$1 .strike-group, $1 .strike-mark').length"; }
mark_t() { js 'window.__t = performance.now(); 1' >/dev/null; }
# Longest task (ms) since the last mark_t.
max_task() { js 'Math.round(Math.max(0, ...window.__diag.longtasks.filter(([s]) => s >= window.__t).map((e) => e[1])))'; }
# The zoom of a map, read from its front tile layer ({z}/{x}/{y}.png).
map_zoom() {
  js "(() => { const c = [...document.querySelectorAll('$1 .leaflet-tile-container')].sort((a, b) => (+b.style.zIndex || 0) - (+a.style.zIndex || 0))[0]; const m = c?.querySelector('img')?.src.match(/\/(\d+)\/\d+\/\d+\.png/); return m ? +m[1] : -1; })()"
}
wait_for() { # wait_for <js condition> [tries]
  for _ in $(seq 1 "${2:-60}"); do
    [ "$(js "$1" 2>/dev/null || echo false)" = true ] && return 0
    ab wait 500 >/dev/null
  done
  return 1
}
task_ok() { # task_ok <description>: the longest task since mark_t stays under the limit
  local ms
  ms="$(max_task)"
  check "$1 (longest task ${ms} ms ≤ ${MAX_TASK_MS} ms)" le "$ms" "$MAX_TASK_MS"
}

open_storm() { # open_storm <context>: open the app, scroll the map in, show the storm
  ab network unroute >/dev/null 2>&1 || true
  ab network route "**/api/locations" --body "$(locations_json)" >/dev/null
  ab open "$BASE_URL" >/dev/null
  ab wait 1500 >/dev/null
  assert_clean "open the app: $1"
  js '(() => { const h = [...document.querySelectorAll("section h2")].find((e) => /map/i.test(e.textContent)); h?.scrollIntoView(); return 1; })()' >/dev/null
  wait_for "document.querySelectorAll('$CARD').length > 0" 20 || true
  mark_t
  js '(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Show latest lightning")); b?.click(); return Boolean(b); })()' >/dev/null
  wait_for "document.querySelector('[role=status]')?.textContent.includes('37,242') && document.querySelectorAll('$CARD .strike-group').length > 0" 60 || true
  ab wait 1500 >/dev/null
  assert_clean "storm drawn: $1"
}

e2e_start_server
e2e_launch_browser "$SESSION" --init-script "$OUT/replay-init.js"
ab set viewport 1280 900 >/dev/null

# --- US1: the map stays usable --------------------------------------------------------------

if want us1; then
  echo "US1: the map stays usable during the 37,242-strike storm"
  js "localStorage.setItem('weather-theme', 'apple'); 1" >/dev/null 2>&1 || true
  open_storm "us1"
  task_ok "turning lightning on draws the storm"
  card="$(marks_in "$CARD")"
  check "card shows bounded marks (${card}, 1–${MAX_MARKS})" test "$card" -ge 1 -a "$card" -le "$MAX_MARKS"
  check "status strip reads '37,242 strikes in the last hour'" \
    grep -q "37,242 strikes in the last hour" <<<"$(js 'document.querySelector("[role=status]")?.textContent ?? ""')"

  mark_t
  ab wait 32000 >/dev/null
  task_ok "a 30 s age tick"

  mark_t
  js 'document.querySelector("[aria-label=\"Expand map to fullscreen\"]").click(); 1' >/dev/null
  wait_for "document.querySelectorAll('$FULL .strike-group, $FULL .strike-mark').length > 0" 40 || true
  ab wait 1500 >/dev/null
  assert_clean "fullscreen open"
  task_ok "opening fullscreen"
  full="$(marks_in "$FULL")"
  check "fullscreen shows bounded marks (${full}, 1–${MAX_MARKS})" test "$full" -ge 1 -a "$full" -le "$MAX_MARKS"
  check "the card map draws nothing under fullscreen" test "$(marks_in "$CARD")" -eq 0

  mark_t
  ab mouse move 640 450 >/dev/null
  ab mouse down >/dev/null
  for x in 600 560 520 480 440 400 360 320; do ab mouse move "$x" 430 >/dev/null; done
  ab mouse up >/dev/null
  ab wait 1500 >/dev/null
  task_ok "drag-panning fullscreen"

  mark_t
  ab mouse move 640 450 >/dev/null
  ab mouse wheel 300 >/dev/null
  ab wait 1500 >/dev/null
  ab mouse wheel -600 >/dev/null
  ab wait 1500 >/dev/null
  task_ok "wheel zooming out and in"
  full="$(marks_in "$FULL")"
  check "marks stay bounded after zooming (${full} ≤ ${MAX_MARKS})" test "$full" -le "$MAX_MARKS"

  mark_t
  js 'document.querySelector("[aria-label=\"Close map\"]").click(); 1' >/dev/null
  wait_for "document.querySelectorAll('$CARD .strike-group, $CARD .strike-mark').length > 0" 20 || true
  ab wait 1000 >/dev/null
  assert_clean "fullscreen closed"
  task_ok "closing fullscreen"
  check "the card map draws again after fullscreen closes" test "$(marks_in "$CARD")" -ge 1

  mark_t
  js "document.querySelector('section [role=switch]').click(); 1" >/dev/null
  ab wait 800 >/dev/null
  check "turning the layer off removes every mark" test "$(marks_in "$CARD")" -eq 0
  js "document.querySelector('section [role=switch]').click(); 1" >/dev/null
  wait_for "document.querySelectorAll('$CARD .strike-group, $CARD .strike-mark').length > 0" 20 || true
  ab wait 800 >/dev/null
  task_ok "toggling the layer off and on"

  heap="$(js 'Math.round(performance.memory.usedJSHeapSize / 1048576)')"
  check "JS heap with the storm shown (${heap} MB ≤ ${MAX_HEAP_MB} MB)" le "$heap" "$MAX_HEAP_MB"
  ab screenshot "$OUT/us1-card.png" >/dev/null
  assert_clean "us1 end"
fi

# --- US2: where and how recently -------------------------------------------------------------

if want us2; then
  echo "US2: group marks show count and age, and lead to single strikes"
  open_storm "us2"
  check "every group has a count and an age label" test "$(js "[...document.querySelectorAll('$CARD .strike-group')].every((g) => /\\S/.test(g.querySelector('.strike-group__count')?.textContent ?? '') && /^(now|[1-5]?[0-9]m)\$/.test(g.querySelector('.strike-group__age')?.textContent ?? ''))")" = true
  check "pins sit above the lightning pane" \
    test "$(js 'Number(getComputedStyle(document.querySelector(".leaflet-lightning-pane")).zIndex) < Number(getComputedStyle(document.querySelector(".leaflet-marker-pane")).zIndex)')" = true

  card_zoom="$(map_zoom "$CARD")"
  js "(() => { const g = [...document.querySelectorAll('$CARD .strike-group')].find((e) => e.dataset.splittable === 'true'); g?.parentElement.dispatchEvent(new MouseEvent('click', { bubbles: true })); return Boolean(g); })()" >/dev/null
  wait_for "document.querySelectorAll('$FULL').length > 0" 20 || true
  ab wait 2000 >/dev/null
  assert_clean "card group opened fullscreen"
  full_zoom="$(map_zoom "$FULL")"
  check "a card group opens fullscreen zoomed in on it (zoom ${card_zoom} → ${full_zoom})" test "$full_zoom" -gt "$card_zoom"

  # Select splittable groups until single bolts show, then open one.
  for _ in $(seq 1 12); do
    [ "$(js "document.querySelectorAll('$FULL .strike-mark').length")" -gt 0 ] && break
    js "(() => { const g = [...document.querySelectorAll('$FULL .strike-group')].find((e) => e.dataset.splittable === 'true'); g?.parentElement.dispatchEvent(new MouseEvent('click', { bubbles: true })); return Boolean(g); })()" >/dev/null
    ab wait 1200 >/dev/null
  done
  check "zooming into groups reaches single bolts" test "$(js "document.querySelectorAll('$FULL .strike-mark').length")" -gt 0
  js "(() => { const b = document.querySelector('$FULL .strike-mark'); b?.parentElement.dispatchEvent(new MouseEvent('click', { bubbles: true })); return 1; })()" >/dev/null
  ab wait 600 >/dev/null
  check "a bolt's popup shows its type and time" \
    grep -q "Cloud to" <<<"$(js 'document.querySelector("[role=dialog] .leaflet-popup-content")?.textContent ?? ""')"
  ab screenshot "$OUT/us2-fullscreen.png" >/dev/null
  js 'document.querySelector("[aria-label=\"Close map\"]").click(); 1' >/dev/null
  ab wait 800 >/dev/null

  for theme in apple glass radar sticker memphis singapore; do
    ab network requests --clear >/dev/null 2>&1 || true
    js "localStorage.setItem('weather-theme', '$theme'); document.documentElement.dataset.theme = '$theme'; window.dispatchEvent(new StorageEvent('storage', { key: 'weather-theme', newValue: '$theme' })); 1" >/dev/null
    ab wait 600 >/dev/null
    tokens="$(js "(() => { const s = getComputedStyle(document.querySelector('$CARD .strike-group') ?? document.documentElement); return [s.getPropertyValue('--lightning').trim(), s.getPropertyValue('--lightning-ink').trim()].join('|'); })()")"
    check "$theme: groups drawn with --lightning and --lightning-ink ($tokens)" \
      test "$(marks_in "$CARD")" -ge 1 -a -n "${tokens%%|*}" -a -n "${tokens##*|}"
    check "$theme: switching theme fetches no lightning" \
      test "$(ab network requests --filter lightning/refresh --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{try{console.log((JSON.parse(s).data?.requests??[]).length)}catch{console.log(0)}})')" -eq 0
    ab screenshot "$OUT/us2-theme-$theme.png" >/dev/null
  done
  js "localStorage.setItem('weather-theme', 'apple'); 1" >/dev/null
  assert_clean "us2 end"
fi

echo
echo "Passed: $PASSED  Failed: $FAILED  (screenshots in $OUT/)"
[ "$FAILED" -eq 0 ]
