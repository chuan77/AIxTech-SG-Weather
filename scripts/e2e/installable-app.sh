#!/usr/bin/env bash
# Browser E2E checks for the installable app (specs/014-installable-app).
#
# Usage (from the repo root, after `npm run verify` has built frontend/dist):
#   scripts/e2e/installable-app.sh [us1|us2|us3|themes]   # no argument runs everything
#
# us1     manifest (type, Cache-Control, exact fields), icon types, head tags, title unchanged
# us2     iPhone Safari: the Add to Home Screen button in the Add row at 375 and 1280 px, the dot,
#         open / Escape / Got it / reload, and no button for other browsers or 0 places
# us3     offline helper: worker controls the page, only /offline.html is cached, offline reload
#         shows the offline page, Try again recovers, offline /api fails, offline Refresh keeps
#         the dashboard, /sw.js is served no-cache
# themes  all six themes at 375 px: button icon 3:1, tip text 4.5:1, focus rings 3:1;
#         offline page text 4.5:1
#
# Starts its own temporary server on a throwaway database and tears it down, with the browser,
# on exit (scripts/e2e/lib.sh). Stubs GET /api/locations, so it never calls data.gov.sg. Any
# uncaught page error or console.error fails the run.
set -euo pipefail

SESSION="${E2E_SESSION:-installable-app}"
OUT="e2e-artifacts/installable-app"
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

# Device override for us2/themes: before any page script runs, an init script reads e2e-only keys
# from localStorage and redefines navigator.userAgent, maxTouchPoints and standalone. With no key
# set (us1, us3) the browser is untouched.
cat >"$OUT/device-init.js" <<'JS'
(() => {
  let ua = null, touch = null, standalone = null;
  try {
    ua = localStorage.getItem('e2e.ua');
    touch = localStorage.getItem('e2e.touch');
    standalone = localStorage.getItem('e2e.standalone');
  } catch { return; }
  const define = (key, value) => Object.defineProperty(Navigator.prototype, key, { get: () => value, configurable: true });
  if (ua) define('userAgent', ua);
  if (touch !== null) define('maxTouchPoints', Number(touch));
  if (standalone !== null) define('standalone', standalone === 'true');
})();
JS

e2e_start_server
e2e_launch_browser "$SESSION" --init-script "$OUT/device-init.js"
ab set viewport 1280 900 >/dev/null

header() { # header <path> <name>: the value of one response header, lower-cased name
  curl -sS -o /dev/null -D - "$BASE_URL$1" | tr -d '\r' | awk -v n="$(printf '%s' "$2" | tr 'A-Z' 'a-z')" -F': ' 'tolower($1) == n { print $2 }'
}
status() { curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL$1"; }

check_us1() {
  check "manifest: application/manifest+json" bash -c "[[ '$(header /manifest.webmanifest content-type)' == application/manifest+json* ]]"
  check "manifest: Cache-Control no-cache" test "$(header /manifest.webmanifest cache-control)" = no-cache
  check "manifest: exact contract fields" node -e '
    const got = JSON.parse(process.argv[1]);
    const want = { id: "/", name: "Lepak", short_name: "Lepak", start_url: "/", scope: "/",
      display: "standalone", theme_color: "#202a36", background_color: "#202a36",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" } ] };
    process.exit(JSON.stringify(got) === JSON.stringify(want) ? 0 : 1);' "$(curl -sS "$BASE_URL/manifest.webmanifest")"
  local icon
  for icon in /icons/icon-192.png /icons/icon-512.png /icons/icon-maskable-512.png /icons/apple-touch-icon.png; do
    check "$icon: 200 image/png" test "$(status "$icon") $(header "$icon" content-type)" = "200 image/png"
  done
  check "/favicon.svg: 200 image/svg+xml" bash -c "[[ '$(status /favicon.svg) $(header /favicon.svg content-type)' == '200 image/svg+xml'* ]]"

  ab open "$BASE_URL" >/dev/null
  ab wait 800 >/dev/null
  assert_clean "us1 open"
  check "head: manifest link" test "$(js 'document.querySelector("link[rel=manifest]")?.getAttribute("href")')" = /manifest.webmanifest
  check "head: theme-color #202a36" test "$(js 'document.querySelector("meta[name=theme-color]")?.content')" = "#202a36"
  check "head: apple-touch-icon" test "$(js 'document.querySelector("link[rel=apple-touch-icon]")?.getAttribute("href")')" = /icons/apple-touch-icon.png
  check "head: apple-mobile-web-app-title Lepak" test "$(js 'document.querySelector("meta[name=apple-mobile-web-app-title]")?.content')" = Lepak
  check "head: status bar style black" test "$(js 'document.querySelector("meta[name=apple-mobile-web-app-status-bar-style]")?.content')" = black
  check "title unchanged: Weather" test "$(js 'document.title')" = Weather
  shot us1-open
}
IPHONE_SAFARI='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
IPHONE_CHROME='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1'
ANDROID_CHROME='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36'

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

stub_locations() { # stub_locations <0|1>
  ab network unroute >/dev/null 2>&1 || true
  ab network route "**/api/locations" --body "$(locations_json "$1")" >/dev/null
}

# set_device <ua|""> <touch points> <standalone true|false>: takes effect on the next load
set_device() {
  js "(() => { localStorage.removeItem('e2e.ua'); localStorage.removeItem('e2e.touch'); localStorage.removeItem('e2e.standalone');
    if ('$1') { localStorage.setItem('e2e.ua', '$1'); localStorage.setItem('e2e.touch', '$2'); localStorage.setItem('e2e.standalone', '$3'); }
    return 1; })()" >/dev/null
}
clear_hint_flags() {
  js "localStorage.removeItem('weather-starter.install-hint.seen'); localStorage.removeItem('weather-starter.install-hint.dismissed'); 1" >/dev/null
}
load() { # load <context>
  ab open "$BASE_URL" >/dev/null
  ab wait 900 >/dev/null
  assert_clean "$1"
}

HINT_BUTTON='document.querySelector("button[data-install-hint]")'
hint_count() { js "document.querySelectorAll('button[data-install-hint]').length"; }
hint_visible() {
  js "(() => { const b = $HINT_BUTTON; if (!b) return false; const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; })()"
}
under_the_row() { # its own full-width line, directly under Use my location / Add Location
  js "(() => { const b = $HINT_BUTTON; const row = b?.parentElement; const locate = [...(row?.querySelectorAll('button') ?? [])].find((x) => /Use my location/.test(x.textContent)); if (!b || !locate) return false; const r = b.getBoundingClientRect(), l = locate.getBoundingClientRect(), w = row.getBoundingClientRect(); return r.top >= l.bottom && r.top - l.bottom < 16 && Math.abs(r.left - w.left) < 2 && Math.abs(r.right - w.right) < 2; })()"
}
dot_shown() { js "Boolean(($HINT_BUTTON)?.querySelector('[data-install-hint-dot]'))"; }
tip_text() { js "document.getElementById('install-hint-tip')?.textContent.replace(/\\s+/g, ' ').trim() ?? ''"; }

check_us2() {
  local width ctx
  ab open "$BASE_URL" >/dev/null
  for width in 375 1280; do
    ab set viewport "$width" 860 >/dev/null
    ctx="iPhone Safari, ${width} px"
    stub_locations 1
    set_device "$IPHONE_SAFARI" 5 false
    clear_hint_flags
    load "$ctx: open"
    check "$ctx: one Add to Home Screen button" test "$(hint_count)" -eq 1
    check "$ctx: button visible on screen" test "$(hint_visible)" = true
    check "$ctx: button on its own full-width line under the row" test "$(under_the_row)" = true
    check "$ctx: accessible name is the visible label" test "$(js "($HINT_BUTTON).textContent.trim()")" = "Add Lepak to Home Screen"
    check "$ctx: dot shown before first open" test "$(dot_shown)" = true
    shot "us2-$width-button"
    [ "$width" = 1280 ] && continue

    # 375 px: the full sequence, in order, without clearing (finding A2).
    js "($HINT_BUTTON).focus(); 1" >/dev/null
    ab press Enter >/dev/null
    ab wait 150 >/dev/null
    check "$ctx: Enter opens the tip" test "$(js "($HINT_BUTTON).getAttribute('aria-expanded')")" = true
    local text
    text="$(tip_text)"
    check "$ctx: tip title" bash -c "[[ \"\$1\" == *'Add Lepak to your Home Screen'* ]]" _ "$text"
    check "$ctx: tip steps" bash -c "[[ \"\$1\" == *'Tap Share'*'then Add to Home Screen.'* ]]" _ "$text"
    check "$ctx: tip says the list is separate" bash -c "[[ \"\$1\" == *'The Home Screen app keeps its own list. Places saved here in Safari won’t appear there, so you’ll add them again.'* ]]" _ "$text"
    check "$ctx: dot gone after opening" test "$(dot_shown)" = false
    check "$ctx: seen flag stored" test "$(js "localStorage.getItem('weather-starter.install-hint.seen')")" = 1
    shot "us2-375-tip"
    ab press Escape >/dev/null
    ab wait 150 >/dev/null
    check "$ctx: Escape closes the tip" test "$(js "document.getElementById('install-hint-tip') === null")" = true
    check "$ctx: button stays after Escape" test "$(hint_count)" -eq 1
    check "$ctx: focus returns to the button" test "$(js "document.activeElement === ($HINT_BUTTON)")" = true
    ab press Enter >/dev/null
    ab wait 150 >/dev/null
    js "[...document.querySelectorAll('#install-hint-tip button')].find((b) => b.textContent.trim() === 'Got it').focus(); 1" >/dev/null
    ab press Enter >/dev/null
    ab wait 150 >/dev/null
    check "$ctx: Got it removes the button" test "$(hint_count)" -eq 0
    check "$ctx: dismissed flag stored" test "$(js "localStorage.getItem('weather-starter.install-hint.dismissed')")" = 1
    check "$ctx: focus moved to Use my location" test "$(js "/Use my location/.test(document.activeElement?.textContent ?? '')")" = true
    load "$ctx: reload after Got it"
    check "$ctx: still no button after reload" test "$(hint_count)" -eq 0

    clear_hint_flags
    stub_locations 0
    load "$ctx: no saved places"
    check "$ctx: no button with 0 places" test "$(hint_count)" -eq 0
  done

  ab set viewport 375 860 >/dev/null
  stub_locations 1
  local ua label
  for label in chrome-ios android standalone; do
    clear_hint_flags
    case "$label" in
      chrome-ios) set_device "$IPHONE_CHROME" 5 false ;;
      android) set_device "$ANDROID_CHROME" 5 false ;;
      standalone) set_device "$IPHONE_SAFARI" 5 true ;;
    esac
    load "other browser: $label"
    check "no button: $label" test "$(hint_count)" -eq 0
  done
  set_device "" 0 false
  ab set viewport 1280 900 >/dev/null
}
OFFLINE_NOISE='Failed to load resource|ERR_INTERNET_DISCONNECTED|Failed to fetch|NetworkError'

wait_for_controller() { # the helper registers after load; claim() makes it control this page
  local i
  for i in $(seq 1 20); do
    [ "$(js 'Boolean(navigator.serviceWorker && navigator.serviceWorker.controller)')" = true ] && return 0
    ab wait 500 >/dev/null
    [ "$i" = 10 ] && ab reload >/dev/null
  done
  return 1
}

check_us3() {
  ab set viewport 1280 900 >/dev/null
  ab open "$BASE_URL" >/dev/null
  set_device "" 0 false
  stub_locations 1
  load "us3: online open"
  check "worker controls the page" wait_for_controller
  check "only one cache: lepak-offline-v1" test "$(js '(async () => JSON.stringify(await caches.keys()))()')" = '[\"lepak-offline-v1\"]'
  check "that cache holds only /offline.html" test "$(js '(async () => { const c = await caches.open("lepak-offline-v1"); return JSON.stringify((await c.keys()).map((r) => new URL(r.url).pathname)); })()')" = '[\"/offline.html\"]'
  check "/sw.js: Cache-Control no-cache" test "$(header /sw.js cache-control)" = no-cache
  check "/sw.js: JavaScript" bash -c "[[ '$(header /sw.js content-type)' == *javascript* ]]"

  # Offline page load: the helper answers with offline.html. agent-browser's offline setting cuts
  # only the page's own requests, not the service worker's, so "no connection" is simulated as on
  # a phone in airplane mode: the page is offline AND the server is unreachable (stopped). It is
  # restarted on the same port, so the origin and the registered worker stay the same.
  local port="${BASE_URL##*:}"
  ab set offline on >/dev/null
  e2e_stop_server
  ab open "$BASE_URL" >/dev/null
  ab wait 800 >/dev/null
  E2E_ALLOW_ERRORS="$OFFLINE_NOISE" assert_clean "us3: offline open"
  check "offline: heading You're offline" test "$(js 'document.querySelector("h1")?.textContent.trim()')" = "You're offline"
  check "offline: Try again button" test "$(js '[...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Try again")')" = true
  check "offline: no saved-place text" test "$(js '/Toa Payoh/.test(document.body.textContent)')" = false
  shot us3-offline

  # Back online: Try again loads the dashboard from the server.
  E2E_PORT="$port" e2e_start_server >/dev/null
  ab set offline off >/dev/null
  js '[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Try again").click(); 1' >/dev/null
  ab wait 1200 >/dev/null
  assert_clean "us3: Try again online"
  check "Try again: dashboard back" test "$(js '[...document.querySelectorAll("h1")].some((h) => h.textContent.trim() === "Toa Payoh")')" = true

  # Offline while the dashboard is open (no reload): nothing personal comes from the device
  # (finding I1), and a failed refresh keeps the dashboard (finding C2).
  check "worker still controls the page" wait_for_controller
  ab network unroute >/dev/null 2>&1 || true
  ab set offline on >/dev/null
  check "offline: /api/locations is not served from the device" test "$(js "(async () => { try { await fetch('/api/locations', { headers: { 'X-Visitor-Key': localStorage.getItem('weather-starter.visitor.key') ?? '' } }); return 'ok'; } catch { return 'failed'; } })()")" = failed
  js '[...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Refresh")?.click(); 1' >/dev/null
  ab wait 1200 >/dev/null
  check "offline Refresh: the existing error shows" test "$(js '[...document.querySelectorAll("[role=alert]")].some((a) => /Couldn.t refresh/.test(a.textContent))')" = true
  check "offline Refresh: dashboard stays" test "$(js '[...document.querySelectorAll("h1")].some((h) => h.textContent.trim() === "Toa Payoh")')" = true
  check "offline Refresh: no offline page" test "$(js '/You.re offline/.test(document.body.textContent)')" = false
  shot us3-offline-refresh
  E2E_ALLOW_ERRORS="$OFFLINE_NOISE" assert_clean "us3: offline refresh"
  ab set offline off >/dev/null
}
# Contrast of an element's colour (or outline colour) against what is behind it: the nearest opaque
# background colour up the tree, or else every opaque stop of the nearest background gradient,
# taking the worst ratio (same approach as privacy-notice.sh).
CONTRAST_JS='
  const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const backs = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      const c = rgb(s.backgroundColor);
      if (c.length >= 3 && (c[3] ?? 1) >= 0.99) return [c.slice(0, 3)];
      const stops = (s.backgroundImage.match(/rgba?\([^)]*\)/g) || []).map(rgb).filter((v) => (v[3] ?? 1) >= 0.99);
      if (stops.length) return stops.map((v) => v.slice(0, 3));
    }
    return [[255, 255, 255]];
  };
  // Semi-transparent text (text-ink-muted, text-white/85) is blended over each background first.
  const blend = (fg, b) => { const a = fg[3] ?? 1; return [0, 1, 2].map((i) => fg[i] * a + b[i] * (1 - a)); };
  const worst = (el, colour, behind = el) => Math.min(...backs(behind).map((b) => ratio(blend(rgb(colour), b), b))).toFixed(1);
'
at_least() { node -e 'process.exit(Number(process.argv[1]) >= Number(process.argv[2]) ? 0 : 1)' "$1" "$2"; }

check_themes() {
  ab set viewport 375 860 >/dev/null
  ab open "$BASE_URL" >/dev/null
  stub_locations 1
  local theme r
  for theme in apple glass radar sticker memphis singapore; do
    set_device "$IPHONE_SAFARI" 5 false
    clear_hint_flags
    js "localStorage.setItem('weather-theme', '$theme'); 1" >/dev/null
    load "themes: $theme"
    js "($HINT_BUTTON).focus(); 1" >/dev/null
    r="$(js "(() => { $CONTRAST_JS
      const b = $HINT_BUTTON; const icon = b.querySelector('svg');
      const ring = getComputedStyle(b).outlineColor;
      return [worst(b, getComputedStyle(icon).color), worst(b, getComputedStyle(b).color), worst(b, ring, b.parentElement)].join(','); })()")"
    IFS=, read -r icon label ring <<<"$r"
    check "$theme: button icon ${icon}:1 ≥ 3" at_least "$icon" 3
    check "$theme: button label ${label}:1 ≥ 4.5" at_least "$label" 4.5
    check "$theme: button focus ring ${ring}:1 ≥ 3" at_least "$ring" 3
    ab press Enter >/dev/null
    ab wait 150 >/dev/null
    js "[...document.querySelectorAll('#install-hint-tip button')].find((b) => b.textContent.trim() === 'Got it').focus(); 1" >/dev/null
    r="$(js "(() => { $CONTRAST_JS
      const tip = document.getElementById('install-hint-tip');
      const [title, steps, note] = [tip.querySelector('h2'), tip.querySelectorAll('p')[0], tip.querySelectorAll('p')[1]];
      const got = [...tip.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Got it');
      const c = (el) => getComputedStyle(el).color;
      return [worst(title, c(title)), worst(steps, c(steps)), worst(note, c(note)), worst(got, c(got)), worst(got, getComputedStyle(got).outlineColor, tip)].join(','); })()")"
    IFS=, read -r title steps note got gotring <<<"$r"
    check "$theme: tip title ${title}:1 ≥ 4.5" at_least "$title" 4.5
    check "$theme: tip steps ${steps}:1 ≥ 4.5" at_least "$steps" 4.5
    check "$theme: tip note ${note}:1 ≥ 4.5" at_least "$note" 4.5
    check "$theme: Got it ${got}:1 ≥ 4.5" at_least "$got" 4.5
    check "$theme: Got it focus ring ${gotring}:1 ≥ 3" at_least "$gotring" 3
    shot "theme-$theme-tip"
  done
  js "localStorage.setItem('weather-theme', 'apple'); 1" >/dev/null
  set_device "" 0 false

  ab network unroute >/dev/null 2>&1 || true
  ab open "$BASE_URL/offline.html" >/dev/null
  ab wait 300 >/dev/null
  assert_clean "offline page opened directly"
  r="$(js "(() => { $CONTRAST_JS
    const [h, p, b] = [document.querySelector('h1'), document.querySelector('p'), document.querySelector('button')];
    b.focus();
    return [worst(h, getComputedStyle(h).color), worst(p, getComputedStyle(p).color), worst(b, getComputedStyle(b).color), worst(b, getComputedStyle(b).outlineColor, document.body)].join(','); })()")"
  IFS=, read -r h p b ring <<<"$r"
  check "offline page: heading ${h}:1 ≥ 4.5" at_least "$h" 4.5
  check "offline page: text ${p}:1 ≥ 4.5" at_least "$p" 4.5
  check "offline page: Try again ${b}:1 ≥ 4.5" at_least "$b" 4.5
  check "offline page: focus ring ${ring}:1 ≥ 3" at_least "$ring" 3
  check "offline page: no external requests" test "$(js 'performance.getEntriesByType("resource").filter((e) => !e.name.startsWith(location.origin)).length')" -eq 0
  ab set viewport 1280 900 >/dev/null
}

if want us1; then echo "US1: install identity"; check_us1; fi
if want us2; then echo "US2: iPhone Add to Home Screen button and tip"; check_us2; fi
if want us3; then echo "US3: offline page"; check_us3; fi
if want themes; then echo "Themes: contrast"; check_themes; fi

assert_clean "end of run"

echo
echo "Passed: $PASSED  Failed: $FAILED  (screenshots in $OUT/)"
[ "$FAILED" -eq 0 ]
