#!/usr/bin/env bash
# Renders the Lepak app icon (frontend/icons/lepak-mark.svg) to the PNGs in frontend/public/icons/
# (spec 014, research R7). A one-off: run it again only when the artwork changes, then commit the
# PNGs. Uses headless Chrome because no image tool is a project dependency.
#
# Usage (from the repo root): scripts/icons/render-icons.sh
# Set CHROME to a Chrome or Chromium binary to override the default.
set -euo pipefail

SRC="frontend/icons/lepak-mark.svg"
DEST="frontend/public/icons"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

[ -f "$SRC" ] || { echo "Missing $SRC (run from the repo root)." >&2; exit 2; }
[ -x "$CHROME" ] || { echo "Chrome not found at $CHROME; set CHROME." >&2; exit 2; }
mkdir -p "$DEST"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp "$SRC" "$TMP/mark.svg"

render() { # render <size> <output>
  local size="$1" out="$2"
  cat >"$TMP/page.html" <<HTML
<!doctype html><html><head><style>
html,body{margin:0;padding:0;overflow:hidden;background:#202a36}
img{display:block;width:${size}px;height:${size}px}
</style></head><body><img src="mark.svg" alt=""></body></html>
HTML
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="$size,$size" --screenshot="$TMP/out.png" "file://$TMP/page.html" >/dev/null 2>&1
  mv "$TMP/out.png" "$out"
  local w h
  w="$(sips -g pixelWidth "$out" | awk '/pixelWidth/ {print $2}')"
  h="$(sips -g pixelHeight "$out" | awk '/pixelHeight/ {print $2}')"
  if [ "$w" != "$size" ] || [ "$h" != "$size" ]; then
    echo "$out is ${w}x${h}, expected ${size}x${size}." >&2
    exit 1
  fi
  echo "wrote $out (${w}x${h})"
}

render 192 "$DEST/icon-192.png"
render 512 "$DEST/icon-512.png"
render 512 "$DEST/icon-maskable-512.png"
render 180 "$DEST/apple-touch-icon.png"
