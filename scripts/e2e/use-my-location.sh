#!/usr/bin/env bash
# Browser E2E checks for "Use my location" (specs/003-use-my-location).
#
# Drives the real sidebar in Chrome with agent-browser. The position comes from `set geo`, and
# the geolocation permission is granted or denied through the session's CDP connection
# (Browser.setPermission), so no prompt needs a human.
#
# Some agent-browser Chrome profiles ignore CDP permission grants (the page keeps reading
# "prompt"). The script then switches to STUB MODE: it replaces navigator.geolocation in the page
# with a stub that returns the chosen position or error code. Everything after the browser API
# (adapter, classification, create, messages, logging) still runs for real; only the browser's
# own permission prompt is skipped, and quickstart.md §4 covers that by hand.
#
# Usage (from the repo root, after `npm run verify` has built frontend/dist):
#   scripts/e2e/use-my-location.sh [us1|us2|us3|us4|themes]   # no argument runs everything
#
# By default this starts its own temporary server on a fresh throwaway database and tears it
# down on exit (scripts/e2e/lib.sh). E2E_BASE_URL=<url> uses a server you run instead.
# Any uncaught page error or console.error while opening or switching views fails the run.
#
# Run the stories in order on a fresh database: us3 expects the Bishan entry us1 adds (running
# us3 alone needs E2E_DATABASE_PATH pointing at a database a previous us1 filled).
# Not part of `npm test` or the pre-commit hook: US1 adds a location (the normal create
# snapshot calls data.gov.sg).
set -euo pipefail

SESSION="${E2E_SESSION:-use-my-location}"
OUT="e2e-artifacts/use-my-location"
FILTER="${1:-all}"
mkdir -p "$OUT"

PASSED=0
FAILED=0
SKIPPED=0

pass() { PASSED=$((PASSED + 1)); printf '  ok   %s\n' "$1"; }
fail() { FAILED=$((FAILED + 1)); printf '  FAIL %s\n' "$1" >&2; }
skip() { SKIPPED=$((SKIPPED + 1)); printf '  skip %s\n' "$1"; }

# shellcheck source=scripts/e2e/lib.sh
. "$(dirname "$0")/lib.sh"
e2e_track_session "$SESSION-ff"
e2e_track_session "$SESSION-safari"
check() { # check <description> <command...>
  local description="$1"
  shift
  if "$@"; then pass "$description"; else fail "$description"; fi
}
want() { [ "$FILTER" = all ] || [ "$FILTER" = "$1" ]; }

# --- page helpers -------------------------------------------------------------------------

# Run JS in the page and print its result as plain text (agent-browser prints JSON strings quoted).
js() { ab eval "$1" | sed -e 's/^"//' -e 's/"$//'; }
shot() { ab screenshot "$OUT/$1.png" >/dev/null; }

locations_json() { curl -sf "$BASE_URL/api/locations"; }
location_count() {
  locations_json | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const body = JSON.parse(s);
      console.log((Array.isArray(body) ? body : body.locations ?? []).length);
    });'
}

# Send one CDP command to the session's browser: cdp <method> <json params>.
cdp() {
  local url
  url="$(ab get cdp-url | sed -e 's/^"//' -e 's/"$//')"
  node -e '
    const [url, method, params] = process.argv.slice(1);
    const ws = new WebSocket(url);
    const done = (code, msg) => { if (msg) console.error(msg); ws.close(); process.exit(code); };
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method, params: JSON.parse(params) }));
    ws.onmessage = (event) => {
      const reply = JSON.parse(event.data);
      if (reply.id !== 1) return;
      done(reply.error ? 1 : 0, reply.error ? JSON.stringify(reply.error) : "");
    };
    ws.onerror = () => done(1, "CDP connection failed");
    setTimeout(() => done(1, "CDP timeout"), 5000);
  ' "$url" "$1" "$2"
}
origin() { node -e 'console.log(new URL(process.argv[1]).origin)' "$BASE_URL"; }
set_permission() { # set_permission granted|denied
  cdp Browser.setPermission \
    "{\"permission\":{\"name\":\"geolocation\"},\"setting\":\"$1\",\"origin\":\"$(origin)\"}"
}

# Position control works in both modes. Stub mode keeps the wanted answer in window.__e2eGeo and
# must reinstall the stub after every reload.
MODE=real
GEO_STATE='{"lat":1.3508,"lng":103.839}'
install_stub() {
  js "(() => { window.__e2eGeo = $GEO_STATE; Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition(ok, fail) { const g = window.__e2eGeo; setTimeout(() => g.error ? fail({ code: g.error }) : ok({ coords: { latitude: g.lat, longitude: g.lng, accuracy: 20 } }), 50); } } }); return 'stub'; })()" >/dev/null
}
use_position() { # use_position <lat> <lng>
  GEO_STATE="{\"lat\":$1,\"lng\":$2}"
  if [ "$MODE" = real ]; then ab set geo "$1" "$2" >/dev/null; else install_stub; fi
}
deny_position() { # 0 if the next request will be denied
  if [ "$MODE" = real ]; then
    set_permission denied
  else
    GEO_STATE='{"error":1}'
    install_stub
  fi
}
after_reload() { [ "$MODE" = stub ] && install_stub; return 0; }

press_locate() { ab find role button click --name "Use my location" >/dev/null; }
# Wait until the button is idle again ("Finding you…" swaps the name while busy).
wait_idle() {
  for _ in $(seq 1 60); do
    [ "$(js "!!document.querySelector('button[aria-busy=\"true\"]')")" = "false" ] && return 0
    sleep 0.5
  done
  return 1
}
alert_text() { js "document.querySelector('[role=alert]')?.textContent ?? ''"; }
status_text() { js "[...document.querySelectorAll('aside [role=status]')].map(e => e.textContent).join(' ')"; }
hero_title() { js "document.querySelector('main h1')?.textContent ?? ''"; }
HINT='has only been tested in Chrome' # FR-010 (amended 2026-11-15)
hint_on_page() { [ "$(js "document.body.innerText.includes('$HINT')")" = "true" ]; }
no_hint() { ! hint_on_page; }
alert_has_hint() { grep -q "$HINT" <<<"$(alert_text)"; }
alert_without_hint() { local a; a="$(alert_text)"; [ -n "$a" ] && ! grep -q "$HINT" <<<"$a"; }
fail_with() { # fail_with <code>: the next press fails with this GeolocationPositionError code
  GEO_STATE="{\"error\":$1}"
  install_stub
  press_locate
  wait_idle || true
}
dismiss() { ab find role button click --name "Dismiss" >/dev/null 2>&1 || true; }

open_app() {
  ab set viewport 1440 900 >/dev/null
  ab open "$BASE_URL" >/dev/null
  ab wait --text "Use my location" >/dev/null
  assert_clean "open the app"
}
reload_app() { # reload_app <context>
  ab reload >/dev/null
  ab wait --text "Use my location" >/dev/null
  after_reload
  assert_clean "$1"
}

# --- permission probe ----------------------------------------------------------------------

echo "Setup"
e2e_start_server
e2e_launch_browser
open_app
ab set geo 1.3508 103.839 >/dev/null
set_permission granted >/dev/null 2>&1 || true
state="$(js "navigator.permissions.query({name:'geolocation'}).then(p => p.state)")"
if [ "$state" = "granted" ]; then
  pass "geolocation permission granted through CDP (real mode)"
else
  MODE=stub
  install_stub
  echo "  note: permission reads '$state' after a CDP grant; using STUB MODE (see header)."
  echo "        The browser prompt itself is checked by hand in quickstart.md §4."
fi

# --- US1: add my position -------------------------------------------------------------------

if want us1; then
  echo "US1: add my current position"
  before="$(location_count)"
  use_position 1.3508 103.839
  press_locate
  wait_idle || true
  ab wait --fn "document.querySelector('main h1')?.textContent === 'Bishan'" >/dev/null 2>&1 || true
  assert_clean "US1 locate and switch to the new place"
  check "hero shows the new place, Bishan" [ "$(hero_title)" = "Bishan" ]
  check "exactly one location was added" [ "$(location_count)" = "$((before + 1))" ]
  reload_app "US1 reload"
  check "it is still saved after a reload" \
    [ "$(js "[...document.querySelectorAll('aside button[aria-pressed]')].some(b => b.textContent.includes('Bishan'))")" = "true" ]
  shot us1-added
fi

# --- US3: no duplicates ---------------------------------------------------------------------

if want us3; then
  echo "US3: a repeat press nearby selects the saved place"
  before="$(location_count)"
  use_position 1.3512 103.839 # about 45 m north of US1's point
  press_locate
  wait_idle || true
  assert_clean "US3 locate near a saved place"
  check "says it is already saved" grep -q "Already saved: Bishan" <<<"$(status_text)"
  check "selects the existing Bishan entry" [ "$(hero_title)" = "Bishan" ]
  check "adds nothing" [ "$(location_count)" = "$before" ]
  shot us3-already-saved
fi

# --- US2: failures --------------------------------------------------------------------------

if want us2; then
  echo "US2: failures explain themselves and add nothing"
  before="$(location_count)"
  use_position 3.139 101.687 # Kuala Lumpur
  press_locate
  wait_idle || true
  assert_clean "US2 locate outside Singapore"
  check "outside Singapore is explained" grep -q "outside Singapore" <<<"$(alert_text)"
  check "nothing added for a position outside Singapore" [ "$(location_count)" = "$before" ]
  shot us2-outside

  if deny_position; then
    press_locate
    wait_idle || true
    assert_clean "US2 locate with permission denied"
    check "denied permission is explained" grep -q "blocked" <<<"$(alert_text)"
    check "nothing added when denied" [ "$(location_count)" = "$before" ]
    check "Add Location still works after a failure" \
      [ "$(js "!document.querySelector('aside button[aria-busy]')?.disabled && [...document.querySelectorAll('aside button')].some(b => b.textContent.includes('Add Location') && !b.disabled)")" = "true" ]
    shot us2-denied
    ab find role button click --name "Dismiss" >/dev/null
    check "the message can be dismissed" [ -z "$(alert_text)" ]
    [ "$MODE" = real ] && { set_permission granted >/dev/null || true; }
  else
    skip "denied permission (could not deny through CDP; check by hand, quickstart.md §4)"
  fi
fi

# --- US4: browser note ----------------------------------------------------------------------

if want us4; then
  # FR-010: Firefox and Safari get a Chrome-only hint, but only on an unavailable or timed-out
  # failure; never before an attempt, never after a denial, never in Chrome. The user-agent
  # sessions always use the stub, so failures are chosen exactly.
  echo "US4: Firefox and Safari get a Chrome-only hint when an attempt fails"
  dismiss
  check "no hint in Chrome before an attempt" no_hint
  main_mode="$MODE" main_geo="$GEO_STATE"
  MODE=stub
  fail_with 2
  assert_clean "US4 Chrome: position unavailable"
  check "Chrome: an unavailable failure has no hint" alert_without_hint
  dismiss
  firefox='Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:145.0) Gecko/20100101 Firefox/145.0'
  safari='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15'
  main_session="$SESSION"
  for pair in "ff|$firefox" "safari|$safari"; do
    name="${pair%%|*}"
    agent="${pair#*|}"
    SESSION="$main_session-$name" # ab, js and assert_clean now drive this session
    e2e_launch_browser "$SESSION" --user-agent "$agent"
    ab --user-agent "$agent" open "$BASE_URL" >/dev/null
    ab wait --text "Use my location" >/dev/null
    assert_clean "US4 open with a $name user agent"
    check "$name: no hint before an attempt" no_hint
    check "$name: the button is enabled" \
      [ "$(js "[...document.querySelectorAll('button')].some(b => b.textContent.includes('Use my location') && !b.disabled)")" = "true" ]
    fail_with 2
    assert_clean "US4 $name: position unavailable"
    check "$name: an unavailable failure adds the hint" alert_has_hint
    ab screenshot "$OUT/us4-$name.png" >/dev/null
    dismiss
    fail_with 3
    check "$name: a timeout adds the hint" alert_has_hint
    dismiss
    fail_with 1
    assert_clean "US4 $name: permission denied"
    check "$name: a denial has no hint" alert_without_hint
    ab close >/dev/null 2>&1 || true
  done
  SESSION="$main_session" MODE="$main_mode" GEO_STATE="$main_geo"
  after_reload
fi

# --- themes ---------------------------------------------------------------------------------

if want themes; then
  echo "Themes: the message row in every theme"
  for theme in apple glass radar sticker memphis singapore; do
    js "localStorage.setItem('weather-theme', '$theme')" >/dev/null
    reload_app "switch to the $theme theme"
    use_position 3.139 101.687
    press_locate
    wait_idle || true
    assert_clean "$theme: locate outside Singapore"
    check "$theme: message shows" grep -q "outside Singapore" <<<"$(alert_text)"
    shot "themes-$theme"
  done
  js "localStorage.setItem('weather-theme', 'apple')" >/dev/null
fi

assert_clean "end of run"

echo
echo "Passed: $PASSED  Failed: $FAILED  Skipped: $SKIPPED  Mode: $MODE  (screenshots in $OUT/)"
[ "$FAILED" -eq 0 ]
