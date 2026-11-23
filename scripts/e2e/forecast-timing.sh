#!/usr/bin/env bash
# Browser E2E checks for forecast timing in the top line, strip and sky (specs/018-forecast-summary-timing).
#
# Stubs GET /api/locations with one saved place per case (agent-browser `network route`), so no
# data.gov.sg call is made. A launch-time init script (e2e-artifacts/forecast-timing/clock.js)
# shifts Date to the case's time, read from an e2e-only localStorage key, and leaves timers real,
# so the page crosses a forecast boundary by itself.
#
# Usage (from the repo root, after `npm run verify` has built frontend/dist):
#   scripts/e2e/forecast-timing.sh [us1|us2|themes]   # no argument runs everything
#
# By default this starts its own temporary server on a throwaway database and tears it down,
# with the browser, on exit (scripts/e2e/lib.sh). E2E_BASE_URL=<url> uses a server you run
# instead; never point it at the `npm run dev` server on weather-starter.localhost:1355.
# Any uncaught page error or console.error while opening or switching views fails the run.
set -euo pipefail

SESSION="${E2E_SESSION:-forecast-timing}"
OUT="e2e-artifacts/forecast-timing"
FILTER="${1:-all}"
case "$FILTER" in
  all | us1 | us2 | themes) ;;
  *) echo "Usage: $0 [us1|us2|themes]" >&2; exit 2 ;;
esac
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
same() { # same <description> <actual> <expected>
  if [ "$2" = "$3" ]; then pass "$1"; else fail "$1: got [$2], expected [$3]"; fi
}
want() { [ "$FILTER" = all ] || [ "$FILTER" = "$1" ]; }

js() { ab eval "$1" | sed -e 's/^"//' -e 's/"$//'; }
shot() { ab screenshot "$OUT/$1.png" >/dev/null; }

cat >"$OUT/clock.js" <<'JS'
(() => {
  let target = null;
  try {
    target = localStorage.getItem('e2e.forecast-timing.now');
  } catch {
    return; // about:blank blocks storage
  }
  if (!target) return;
  const RealDate = Date;
  const shift = RealDate.parse(target) - RealDate.now();
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [RealDate.now() + shift]));
    }
    static now() {
      return RealDate.now() + shift;
    }
  };
})();
JS

# --- stubs --------------------------------------------------------------------------------

fixture() { # fixture <case> <now|body>
  node -e '
    const [name, field] = process.argv.slice(1);
    const at = (text) => (text.includes("T") ? text : `2026-11-22T${text}`) + ":00+08:00";
    const A = "6 am to Midday 22 Nov", B = "Midday to 6 pm 22 Nov", C = "6 pm 22 Nov to 6 am 23 Nov";
    const M0 = "Midnight to 6 am 23 Nov", A2 = "6 am to Midday 23 Nov", B2 = "Midday to 6 pm 23 Nov";
    const E2 = "6 pm to Midnight 24 Nov";
    const P = "Passing Showers";
    const READINGS = { wbgt_c: 31.4, heat_stress_level: "Moderate", wbgt_station_name: "Bishan",
      wbgt_station_distance_km: 2, uv_index: 9, psi_twenty_four_hourly: 250 };
    const W = "11.30 am to 1.30 pm";
    const D = "Cloudy", T = "Thundery Showers", S = "Showers", L = "Light Rain";
    // [read, viewed, 2-hour condition, 2-hour validity, periods]
    const cases = {
      1: ["11:50", "12:30", D, W, [[A, T], [B, D], [C, D]]],
      2: ["11:50", "12:30", D, W, [[A, D], [B, T], [C, D]]],
      3: ["11:45", "11:50", D, W, [[B, T], [C, D]]],
      "3-noon": ["11:45", "12:00", D, W, [[B, T], [C, D]]],
      "3-open": ["11:45", "11:59:55", D, W, [[B, T], [C, D]]],
      "1-open": ["11:50", "11:59:55", D, W, [[A, T], [B, D], [C, D]]],
      "4-before": ["11:50", "13:00", T, W, [[B, D], [C, D]]],
      4: ["11:50", "14:00", T, W, [[B, D], [C, D]]],
      5: ["11:50", "12:30", D, "10.00 am to Midday", [[A, D]]],
      9: ["00:20", "00:30", D, "Midnight to 2.00 am", [["Midnight to 6 am 22 Nov", D], [A, D], [B, D], ["6 pm to Midnight 23 Nov", T]]],
      stale: ["11:50", "15:00", D, W, [[A, T], [B, D], [C, D]]],
      untimed: ["12:10", "12:30", T, null, [[B, D], [C, T]]],
      missing: ["23:45", "23:45", D, "11.30 pm to 1.30 am", [[M0, ""], [A2, D], [B2, D], [E2, D]]],
      6: ["12:10", "12:30", S, W, [[B, S], [C, S]]],
      7: ["08:50", "09:00", D, "8.30 am to 10.30 am", [[A, D], [B, S]]],
      8: ["08:50", "09:00", D, "8.30 am to 10.30 am", [[A, D], [B, S], [C, T]]],
      run: ["13:50", "14:00", D, "1.30 pm to 3.30 pm", [[B, L], [C, L]]],
      "rain-then-thunder": ["12:10", "12:30", S, W, [[B, D], [C, T]]],
      "long-fresh": ["18:50", "18:50", D, "6.30 pm to 8.30 pm", [[C, P], [A2, P], [B2, T]], READINGS],
      "long-stale": ["05:50", "2026-11-23T05:50", D, "5.30 am to 7.30 am", [[A, P], [B, T], [C, D]], READINGS],
    };
    const found = cases[name];
    if (!found) throw new Error(`no case ${name}`);
    const [read, viewed, condition, validity, periods, readings = {}] = found;
    if (field === "now") {
      console.log(/^\d\d:\d\d:\d\d$/.test(viewed) ? `2026-11-22T${viewed}+08:00` : at(viewed));
      process.exit();
    }
    const keys = ["source","temperature_c","humidity_percent","rainfall_mm","wind_speed_knots",
      "wind_direction_degrees","forecast_low_c","forecast_high_c","uv_index","uv_hourly",
      "psi_twenty_four_hourly","pm25_one_hourly","air_quality_region","pm10_twenty_four_hourly",
      "o3_eight_hour_max","no2_one_hour_max","so2_twenty_four_hourly","co_eight_hour_max",
      "air_quality_observed_at","wbgt_c","heat_stress_level","wbgt_station_name",
      "wbgt_station_distance_km","wbgt_observed_at"];
    const weather = Object.fromEntries(keys.map((key) => [key, null]));
    Object.assign(weather, { source: "e2e stub", temperature_c: 30, area: `Case ${name}`,
      observed_at: at(read), condition, valid_period_text: validity, daily_forecast: [],
      forecast_periods: periods.map(([label, forecast]) => ({ label, forecast })) }, readings);
    console.log(JSON.stringify({ locations: [{ id: 1, latitude: 1.335, longitude: 103.85,
      created_at: at(read), weather }] }));' "$1" "$2"
}

# --- page helpers -------------------------------------------------------------------------

open_case() { # open_case <case>
  local now body
  now="$(fixture "$1" now)"
  body="$(fixture "$1" body)"
  ab network unroute >/dev/null 2>&1 || true
  ab network route "**/api/locations" --body "$body" >/dev/null
  js "localStorage.setItem('e2e.forecast-timing.now', '$now')" >/dev/null
  ab open "$BASE_URL" >/dev/null
  for _ in $(seq 1 40); do
    [ "$(js "document.querySelector('main h1')?.textContent === 'Case $1'")" = true ] && break
    ab wait 250 >/dev/null
  done
  assert_clean "open case $1"
}

# "<top line as seen> # <strip labels> # <sky>", read in one evaluation so they belong together.
SURFACES='(() => {
  const line = document.querySelector(".hero-verdict")?.cloneNode(true);
  line?.querySelectorAll(".sr-only").forEach((e) => e.remove());
  const slots = [...document.querySelectorAll("section[aria-labelledby=hourly-forecast-heading] .grid > div")];
  return [(line?.textContent ?? "").replace(/\s+/g, " ").trim(),
    slots.map((slot) => slot.firstElementChild.textContent).join("|"),
    document.documentElement.dataset.sky].join(" # ");
})()'
surfaces() { js "$SURFACES"; }

expect_case() { # expect_case <case> <line> <strip labels> <sky>
  open_case "$1"
  same "case $1: line, strip and sky" "$(surfaces)" "$2 # $3 # $4"
  shot "case-$1"
}

api_requests() {
  js "performance.getEntriesByType('resource').filter((e) => /\/api\/(locations|[a-z-]+\/refresh)/.test(e.name)).length"
}

expect_boundary() { # expect_boundary <case> <before> <after>: opened at 11:59:55, no reload
  local state="" clock="" deadline requests
  open_case "$1"
  same "case $1: before midday" "$(surfaces)" "$2"
  requests="$(api_requests)"
  check "case $1: the page load's request is visible to the count" test "$requests" -ge 1
  deadline=$((SECONDS + 65))
  while [ "$SECONDS" -lt "$deadline" ]; do
    state="$(js "new Date(Date.now() + 288e5).toISOString().slice(11, 19) + ' ' + $SURFACES")"
    clock="${state%% *}"
    state="${state#* }"
    [ "$state" != "$2" ] && break
    sleep 1
  done
  same "case $1: line, strip and sky change in the same poll" "$state" "$3"
  # The poll itself can lag the change by a second.
  check "case $1: within 60 s of midday (seen at $clock)" test "$((10#${clock//:/}))" -le 120101
  same "case $1: no new weather request" "$(api_requests)" "$requests"
  assert_clean "case $1: after the boundary"
}

e2e_start_server
e2e_launch_browser "$SESSION" --init-script "$OUT/clock.js"
ab set viewport 1280 900 >/dev/null
ab network route "**/api/locations" --body '{"locations":[]}' >/dev/null
ab open "$BASE_URL" >/dev/null # an origin, so the clock key can be set
assert_clean "first open"

# --- US1: "now" means now -----------------------------------------------------------------

if want us1; then
  echo "US1: now means now"
  expect_case 1 "No storms forecast" "6 am|Now|6 pm" calm
  expect_case 2 "Thundery showers now" "6 am|Now|6 pm" storm
  expect_case 3 "Thundery showers from midday" "Midday|6 pm" calm
  expect_case 3-noon "Thundery showers now" "Now|6 pm" storm
  expect_case 4-before "Thundery showers now" "Now|6 pm" storm
  expect_case 4 "" "Now|6 pm" calm
  expect_case 5 "" "6 am" calm
  expect_case 9 "Thundery showers from 6 pm" "Now|6 am|Midday|6 pm" calm
  expect_case stale "As of 11:50: Thundery showers now" "6 am|Midday|6 pm" calm
  expect_case untimed "Thundery showers forecast" "Now|6 pm" calm

  expect_case missing "" "Midnight|Tomorrow 6 am|Tomorrow midday|Tomorrow 6 pm" calm
  same "missing: the slot says Unavailable, with no icon, in line with the others" "$(js "(() => {
    const slots = [...document.querySelectorAll('section[aria-labelledby=hourly-forecast-heading] .grid > div')];
    const tops = slots.map((slot) => Math.round(slot.lastElementChild.getBoundingClientRect().top));
    return [slots[0].lastElementChild.textContent, Boolean(slots[0].querySelector('svg')),
      Boolean(slots[1].querySelector('svg')), Math.max(...tops) - Math.min(...tops) <= 1].join('|');
  })()")" "Unavailable|false|true|true"

  echo "US1: the clock crosses midday (about a minute each way)"
  expect_boundary 3-open "Thundery showers from midday # Midday|6 pm # calm" "Thundery showers now # Now|6 pm # storm"
  expect_boundary 1-open "Thundery showers now # Now|Midday|6 pm # storm" "No storms forecast # 6 am|Now|6 pm # calm"
fi

# --- US2: forecast rain is named ----------------------------------------------------------

if want us2; then
  echo "US2: forecast rain is named"
  SPOKEN='(() => {
    const line = document.querySelector(".hero-verdict").cloneNode(true);
    line.querySelectorAll("[aria-hidden=true]").forEach((e) => e.remove());
    return line.textContent.trim();
  })()'
  expect_case 6 "Showers forecast now" "Now|6 pm" calm
  expect_case 7 "Showers forecast from midday" "Now|Midday" calm
  expect_case 8 "Showers forecast from midday · Thundery showers from 6 pm" "Now|Midday|6 pm" calm
  same "case 8: spoken in the same order, with a comma" "$(js "$SPOKEN")" "Showers forecast from midday,Thundery showers from 6 pm"
  expect_case run "Light rain forecast until tomorrow 6 am" "Now|6 pm" calm
  expect_case rain-then-thunder "Showers forecast now · Thundery showers from 6 pm" "Now|6 pm" calm
  same "rain now: spoken in the same order, with a comma" "$(js "$SPOKEN")" "Showers forecast now,Thundery showers from 6 pm"
fi

# --- themes: the longest lines at phone width ---------------------------------------------

if want themes; then
  echo "Themes: the longest lines fit at 360 px"
  REST="Heat stress moderate,UV very high,PSI 250 very unhealthy"
  ab set viewport 360 800 >/dev/null
  for theme in apple glass radar sticker memphis singapore; do
    js "localStorage.setItem('weather-theme', '$theme')" >/dev/null
    for name in long-fresh long-stale; do
      case "$name" in
        long-fresh) line="Passing showers forecast until tomorrow midday,Thundery showers from tomorrow midday,$REST" ;;
        long-stale) line="As of yesterday 05:50: Passing showers forecast from yesterday 6 am,Thundery showers from yesterday midday,$REST" ;;
      esac
      open_case "$name"
      same "$theme $name: theme applied" "$(js "document.documentElement.dataset.theme")" "$theme"
      same "$theme $name: spoken in order" "$(js "(() => {
        const line = document.querySelector('.hero-verdict').cloneNode(true);
        line.querySelectorAll('[aria-hidden=true]').forEach((e) => e.remove());
        return line.textContent.replace(/\\s+/g, ' ').trim();
      })()")" "$line"
      same "$theme $name: no horizontal scroll" "$(js "document.documentElement.scrollWidth <= window.innerWidth")" true
      # Measures the glyphs: every line box lies on screen and inside the paragraph, above the temperature.
      same "$theme $name: nothing clipped" "$(js "(() => {
        const p = document.querySelector('.hero-verdict'), box = p.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(p);
        const seen = [...p.querySelectorAll('.sr-only')].map((e) => e.getBoundingClientRect());
        const glyphs = [...range.getClientRects()].filter((r) => r.width > 1 && !seen.some((s) => s.x === r.x && s.y === r.y));
        const fits = glyphs.every((r) => r.left >= Math.max(0, box.left) - 1 && r.right <= Math.min(window.innerWidth, box.right) + 1);
        const unclipped = p.scrollWidth <= p.clientWidth + 1 && getComputedStyle(p).overflow === 'visible';
        return glyphs.length > 0 && fits && unclipped
          && box.bottom <= document.querySelector('.hero-temperature').getBoundingClientRect().top + 1;
      })()")" true
      shot "theme-$theme-$name"
    done
  done
  js "localStorage.setItem('weather-theme', 'apple')" >/dev/null
fi

assert_clean "end of run"
echo
echo "Passed: $PASSED  Failed: $FAILED  (screenshots in $OUT/)"
[ "$FAILED" -eq 0 ]
