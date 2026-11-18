# Shared setup for the scripts/e2e/*.sh browser checks. Source it after setting SESSION and OUT
# and defining pass/fail.
#
# Server. With E2E_BASE_URL set, the checks use that server and never start or stop it.
# Otherwise e2e_start_server starts a temporary server: production mode (the built frontend in
# frontend/dist), a free port on 127.0.0.1 and a throwaway database (E2E_DATABASE_PATH to keep
# one between runs). It runs in its own process group, so teardown reaches every child.
# E2E_PORT=<n> starts it on that port instead of a free one.
# Web analytics (spec 012) is off on that server: WEB_ANALYTICS and VERCEL are blanked, so no
# visit is ever measured. E2E_WEB_ANALYTICS=notice-only shows the privacy notice without loading
# the script (scripts/e2e/privacy-notice.sh).
#
# Teardown. e2e_cleanup runs from the EXIT trap (INT and TERM exit through it too), on success
# and failure alike: it closes every tracked browser session, kills the server's process group
# (TERM, then KILL after 5 s) and deletes the throwaway database. No process is left holding a
# port.
#
# Runtime errors. e2e_launch_browser starts a session on about:blank and clears agent-browser's
# page-error and console buffers before the first navigation. From then on agent-browser records
# every uncaught exception, unhandled rejection and console message, across reloads.
# assert_clean <context> [session] fails the run at once if a page error or a console.error
# arrived since the last call. E2E_ALLOW_ERRORS is an optional regex of messages to ignore.

E2E_SESSIONS=("$SESSION")
E2E_SERVER_PID=""
E2E_DB=""
E2E_KEEP_DB=0

ab() { agent-browser --session "$SESSION" "$@"; }
e2e_track_session() { E2E_SESSIONS+=("$1"); }

e2e_stop_server() {
  [ -n "$E2E_SERVER_PID" ] || return 0
  local pgid="$E2E_SERVER_PID"
  E2E_SERVER_PID=""
  kill -TERM -- "-$pgid" 2>/dev/null || true
  for _ in $(seq 1 50); do
    case "$(ps -o stat= -p "$pgid" 2>/dev/null)" in '' | Z*) break ;; esac
    sleep 0.1
  done
  kill -KILL -- "-$pgid" 2>/dev/null || true
  wait "$pgid" 2>/dev/null || true
}

e2e_cleanup() {
  local s
  for s in "${E2E_SESSIONS[@]}"; do agent-browser --session "$s" close >/dev/null 2>&1 || true; done
  e2e_stop_server
  if [ -n "$E2E_DB" ] && [ "$E2E_KEEP_DB" = 0 ]; then rm -f "$E2E_DB" "$E2E_DB-shm" "$E2E_DB-wal"; fi
}
trap e2e_cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

e2e_start_server() {
  if [ -n "${E2E_BASE_URL:-}" ]; then
    BASE_URL="$E2E_BASE_URL"
    if ! curl -sf "$BASE_URL/api/locations" >/dev/null; then
      echo "Cannot reach $BASE_URL/api/locations (E2E_BASE_URL)." >&2
      exit 2
    fi
    echo "Server: $BASE_URL (E2E_BASE_URL; not started or stopped here)"
    return 0
  fi
  if [ ! -f frontend/dist/index.html ]; then
    echo "frontend/dist is missing: run npm run verify (or npm run build) first." >&2
    exit 2
  fi
  local port
  # E2E_PORT reuses a port, so a check can stop and restart the server on the same origin
  # (installable-app.sh simulates "no connection" for the service worker that way).
  port="${E2E_PORT:-$(node -e 'const s = require("net").createServer().listen(0, "127.0.0.1", () => { console.log(s.address().port); s.close(); });')}"
  if [ -n "${E2E_DATABASE_PATH:-}" ]; then
    E2E_DB="$E2E_DATABASE_PATH"
    E2E_KEEP_DB=1
  else
    E2E_DB="backend/e2e-run-$$.db"
    rm -f "$E2E_DB" "$E2E_DB-shm" "$E2E_DB-wal"
  fi
  set -m # own process group, so e2e_stop_server can signal the whole tree
  # Blank TURSO_* so the throwaway database is always used, even if .env points at Turso
  # (dotenv does not override variables that are already set, even to empty).
  NODE_ENV=production PORT="$port" DATABASE_PATH="$E2E_DB" \
    TURSO_DATABASE_URL= TURSO_AUTH_TOKEN= DATABASE_REQUIRE_REMOTE= \
    WEB_ANALYTICS="${E2E_WEB_ANALYTICS:-}" VERCEL= \
    node --import tsx backend/src/server.ts >"$OUT/server.log" 2>&1 &
  E2E_SERVER_PID=$!
  set +m
  BASE_URL="http://127.0.0.1:$port"
  for _ in $(seq 1 60); do
    if curl -sf "$BASE_URL/api/locations" >/dev/null; then
      echo "Server: temporary $BASE_URL (pid $E2E_SERVER_PID, database $E2E_DB)"
      return 0
    fi
    kill -0 "$E2E_SERVER_PID" 2>/dev/null || break
    sleep 0.5
  done
  echo "The temporary server did not start; end of $OUT/server.log:" >&2
  tail -20 "$OUT/server.log" >&2
  exit 2
}

e2e_launch_browser() { # e2e_launch_browser [session] [agent-browser launch flags...]
  local s="${1:-$SESSION}"
  [ $# -gt 0 ] && shift
  agent-browser --session "$s" "$@" open about:blank >/dev/null
  agent-browser --session "$s" errors --clear >/dev/null
  agent-browser --session "$s" console --clear >/dev/null
}

assert_clean() { # assert_clean <context> [session]
  local context="$1" s="${2:-$SESSION}" errors console report
  errors="$(agent-browser --session "$s" errors --json 2>&1)" || errors="unreadable"
  console="$(agent-browser --session "$s" console --json 2>&1)" || console="unreadable"
  report="$(node -e '
    const [errors, consoleLog, allow] = process.argv.slice(1);
    const read = (text, key, label) => {
      try { return JSON.parse(text).data[key] ?? []; }
      catch { return [{ type: "error", text: `could not read the ${label} buffer: ${text.slice(0, 200)}` }]; }
    };
    const ignore = allow ? new RegExp(allow) : null;
    const lines = [
      ...read(errors, "errors", "page-error").map((e) => "pageerror: " + String(e.text).split("\n")[0]),
      ...read(consoleLog, "messages", "console")
        .filter((m) => m.type === "error")
        .map((m) => "console.error: " + String(m.text).split("\n")[0]),
    ].filter((line) => !(ignore && ignore.test(line)));
    console.log(lines.join("\n"));
  ' "$errors" "$console" "${E2E_ALLOW_ERRORS:-}")"
  agent-browser --session "$s" errors --clear >/dev/null 2>&1 || true
  agent-browser --session "$s" console --clear >/dev/null 2>&1 || true
  if [ -n "$report" ]; then
    fail "no runtime errors: $context"
    printf '%s\n' "$report" | sed 's/^/       /' >&2
    echo "Stopping: a runtime error fails the run immediately." >&2
    exit 1
  fi
  pass "no runtime errors: $context"
}
