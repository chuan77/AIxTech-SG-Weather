#!/usr/bin/env bash
# Browser E2E checks for the add-location town search (specs/006-town-name-search).
#
# Drives the real form in Chrome with agent-browser, locating elements by ARIA role and
# accessible name so it also guards the contract in specs/006-town-name-search/contracts.
#
# Usage (from the repo root, with the app running on a throwaway database):
#   DATABASE_PATH=backend/e2e.db npm run reset
#   DATABASE_PATH=backend/e2e.db npm run dev
#   scripts/e2e/town-search.sh [us1|us2|us3|themes|a11y]   # no argument runs everything
#
# Not part of `npm test` or the pre-commit hook: it needs a running dev server and adds
# locations (each add triggers the normal data.gov.sg create snapshot).
set -euo pipefail

BASE_URL="${E2E_BASE_URL:-http://weather-starter.localhost:1355}"
SESSION="${E2E_SESSION:-town-search}"
OUT="e2e-artifacts/town-search"
FILTER="${1:-all}"
mkdir -p "$OUT"

PASSED=0
FAILED=0

ab() { agent-browser --session "$SESSION" "$@"; }
cleanup() { agent-browser --session "$SESSION" close >/dev/null 2>&1 || true; }
trap cleanup EXIT

pass() { PASSED=$((PASSED + 1)); printf '  ok   %s\n' "$1"; }
fail() { FAILED=$((FAILED + 1)); printf '  FAIL %s\n' "$1" >&2; }
check() { # check <description> <command...>
  local description="$1"
  shift
  if "$@"; then pass "$description"; else fail "$description"; fi
}

# --- page helpers -------------------------------------------------------------------------

# Run JS in the page and print its result as plain text (agent-browser prints JSON strings quoted).
js() { ab eval "$1" | sed -e 's/^"//' -e 's/"$//'; }

locations_json() { curl -sf "$BASE_URL/api/locations"; }

# Number of saved locations whose forecast area is $1.
saved_count() {
  locations_json | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const body = JSON.parse(s);
      const list = Array.isArray(body) ? body : body.locations ?? [];
      console.log(list.filter((l) => l.weather?.area === process.argv[1]).length);
    });' "$1"
}

open_form() {
  ab open "$BASE_URL" >/dev/null
  ab wait --text "Add Location" >/dev/null 2>&1 || true
  # The form may already be open from a previous step; only click the button if it is there.
  if [ "$(js "!!document.querySelector('[role=combobox]')")" != "true" ]; then
    ab find role button click --name "Add Location" >/dev/null
  fi
  ab wait '[role=combobox]' >/dev/null
}

town_type() { ab find role combobox fill --name "Town" "$1" >/dev/null; }
pick_option() { ab find role option click --name "$1" >/dev/null; }
press_add() { ab find role button click --name "Add" --exact >/dev/null; }
# Escape first: an open town list overlays the buttons below it.
cancel_form() { ab press Escape >/dev/null; ab find role button click --name "Cancel" >/dev/null; }
shot() { ab screenshot "$OUT/$1.png" >/dev/null; }

value_of() { js "document.querySelector('$1').value"; }
lat_value() { value_of 'input[placeholder=\"1.3508\"]'; }
lon_value() { value_of 'input[placeholder=\"103.8390\"]'; }
town_value() { value_of '[role=combobox]'; }
options() { js "[...document.querySelectorAll('[role=option]')].map(o => o.textContent).join('|')"; }
body_has() { [ "$(js "document.body.innerText.includes('$1')")" = "true" ]; }
has_option() { case "|$(options)|" in *"|$1|"*) return 0 ;; *) return 1 ;; esac; }
in_top3() { options | tr '|' '\n' | head -3 | grep -qx "$1"; }
eq() { [ "$1" = "$2" ]; }

wait_for_card() { ab wait --text "$1" >/dev/null 2>&1; }

# Wait (up to 20 s) until a location labelled $1 is saved; the create snapshot calls data.gov.sg.
wait_saved() {
  for _ in $(seq 1 20); do
    [ "$(saved_count "$1")" -ge 1 ] && return 0
    sleep 1
  done
  return 1
}

add_town() { # add_town <query> <name>: pick a town and add it
  open_form
  town_type "$1"
  pick_option "$2"
  press_add
  wait_saved "$2"
}

# --- preflight ----------------------------------------------------------------------------

if ! locations_json >/dev/null; then
  echo "Cannot reach $BASE_URL/api/locations." >&2
  echo "Start the app with: DATABASE_PATH=backend/e2e.db npm run dev" >&2
  exit 2
fi

runs() { [ "$FILTER" = "all" ] || [ "$FILTER" = "$1" ]; }

# --- US1: find a town by name and add it -----------------------------------------------------

if runs us1; then
  echo "US1 find a town and add it"
  before_sengkang=$(saved_count Sengkang)
  open_form
  town_type "seng"
  check "typing 'seng' offers Sengkang" has_option "Sengkang"
  pick_option "Sengkang"
  check "picking fills latitude 1.384" eq "$(lat_value)" "1.384"
  check "picking fills longitude 103.891443" eq "$(lon_value)" "103.891443"
  check "the chosen town is shown" body_has "Town: Sengkang"
  check "picking does not save" eq "$(saved_count Sengkang)" "$before_sengkang"
  shot us1-picked
  press_add
  wait_saved "Sengkang" || true
  check "Add saves a location labelled Sengkang" eq "$(saved_count Sengkang)" "1"
  shot us1-added
  ab reload >/dev/null
  check "the Sengkang card survives a reload" wait_for_card "Sengkang"

  for town in Woodlands Sembawang Punggol Bishan; do
    if [ "$(saved_count "$town")" = "0" ]; then add_town "$town" "$town" || true; fi
    check "$town is added and labelled by name" eq "$(saved_count "$town")" "1"
  done

  # Keyboard only: Enter picks the highlighted town and must not submit the form.
  open_form
  ab focus "[role=combobox]" >/dev/null
  ab keyboard type "yi" >/dev/null
  active=$(js "document.getElementById(document.querySelector('[role=combobox]').getAttribute('aria-activedescendant'))?.textContent ?? ''")
  check "the first match is highlighted for the keyboard" eq "$active" "Yishun"
  ab press ArrowDown >/dev/null
  ab press ArrowUp >/dev/null
  ab press Enter >/dev/null
  check "Enter picks Yishun (latitude 1.418)" eq "$(lat_value)" "1.418"
  check "Enter did not submit the form" eq "$(saved_count Yishun)" "0"
  shot us1-keyboard
  cancel_form
fi

# --- US2: forgiving matching ---------------------------------------------------------------

if runs us2; then
  echo "US2 forgiving matching"
  open_form
  for pair in "punggole:Punggol" "PUNGGOL:Punggol" "tampnes:Tampines" "SEMBAWANG:Sembawang"; do
    query="${pair%%:*}"
    expected="${pair#*:}"
    town_type "$query"
    check "'$query' offers $expected in the first 3" in_top3 "$expected"
    shot "us2-$query"
  done
  town_type "water"
  check "'water' offers Central Water Catchment" has_option "Central Water Catchment"
  check "'water' offers Western Water Catchment" has_option "Western Water Catchment"
  cancel_form
fi

# --- US3: clear outcomes -------------------------------------------------------------------

if runs us3; then
  echo "US3 clear outcomes"
  open_form
  town_type "zzz"
  check "'zzz' shows No matching town" body_has "No matching town"
  check "'zzz' lists no options" eq "$(options)" ""
  ab find label "Latitude" fill "1.3508" >/dev/null
  check "coordinates stay editable after no match" eq "$(lat_value)" "1.3508"
  cancel_form

  if [ "$(saved_count Bishan)" = "0" ]; then add_town "Bishan" "Bishan" || true; fi
  open_form
  town_type "Bishan"
  pick_option "Bishan"
  press_add
  ab wait --text "Location already exists" >/dev/null 2>&1 || true
  check "a repeat pick shows Location already exists" body_has "Location already exists"
  check "no second Bishan is created" eq "$(saved_count Bishan)" "1"
  shot us3-duplicate
  cancel_form

  open_form
  town_type "tamp"
  pick_option "Tampines"
  check "picking Tampines shows the chosen town" body_has "Town: Tampines"
  ab find label "Latitude" fill "1.346" >/dev/null
  if body_has "Town: Tampines"; then fail "editing latitude clears the chosen town"; else pass "editing latitude clears the chosen town"; fi
  cancel_form

  open_form
  town_type "ser"
  cancel_form
  open_form
  check "Cancel clears the town field" eq "$(town_value)" ""
  check "Cancel clears latitude" eq "$(lat_value)" ""
  check "Cancel clears longitude" eq "$(lon_value)" ""
  cancel_form
fi

# --- Themes: legibility screenshots (FR-016) -------------------------------------------------

if runs themes; then
  echo "Themes"
  ab open "$BASE_URL" >/dev/null
  theme_ids=$(js "[...document.querySelectorAll('select option')].map(o => o.value).join(' ')")
  for theme in $theme_ids; do
    ab eval "(() => { const s = [...document.querySelectorAll('select')].find(el => [...el.options].some(o => o.value === '$theme')); s.value = '$theme'; s.dispatchEvent(new Event('change', { bubbles: true })); })()" >/dev/null
    open_form
    town_type "b"
    check "theme $theme shows the town list" has_option "Bishan"
    shot "themes-$theme"
    cancel_form
  done
  if [ -f "$OUT/baseline-apple.png" ]; then
    ab diff screenshot --baseline "$OUT/baseline-apple.png" >"$OUT/apple-diff.txt" 2>&1 || true
    echo "  apple diff written to $OUT/apple-diff.txt (review: only the Town field may differ)"
  fi
fi

# --- Accessibility scan of the open form (FR-014) -------------------------------------------

if runs a11y; then
  echo "Accessibility"
  open_form
  town_type "b"
  ab a11y --selector form --json >"$OUT/a11y.json" 2>&1 || true
  violations=$(node -e 'const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); console.log(r.success ? r.data.counts.violations : "error")' "$OUT/a11y.json")
  check "axe finds no violations in the open form (see $OUT/a11y.json)" eq "$violations" "0"
  cancel_form
fi

echo
echo "town-search: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
