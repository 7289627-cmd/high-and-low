#!/usr/bin/env bash
# Build the web game and copy it into app/www for Capacitor. Run from anywhere.
# The website build is never changed: hlnative.js is added only to the COPY in app/www.
set -euo pipefail
APP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$APP/.." && pwd)"
WWW="$APP/www"

# 1. build the product (site/index.html)
( cd "$ROOT" && python3 build.py web )

# 2. fresh copy of site/ without lab, dev pages and dev files
rm -rf "$WWW"
mkdir -p "$WWW"
# The site lives in $ROOT/site (working copy) or, in the GitHub repo where this folder is dev/app, in the repo root.
if [ -d "$ROOT/site" ]; then SITE="$ROOT/site"; else SITE="$(cd "$ROOT/.." && pwd)"; fi
for f in index.html fonts icons icon-180.png manifest.webmanifest music sfx vendor og.png privacy.html terms.html support.html; do
  [ -e "$SITE/$f" ] && cp -R "$SITE/$f" "$WWW/"
done
test -f "$WWW/index.html" || { echo "sync-web: no index.html found in $SITE"; exit 1; }
rm -rf "$WWW/lab" "$WWW/sounds.html" "$WWW/deaths.html"
find "$WWW" \( -name '*.py' -o -name '*.map' -o -name '*.md' -o -name '_*' -o -name '.*' \) -not -path "$WWW" -exec rm -rf {} +

# 3. app-only native bridge, loaded BEFORE the game script so window.HLNative exists at startup
# Plugins only appear on window.Capacitor.Plugins once their JS package is imported, so the bridge is
# bundled (Capacitor core + plugin JS + native/hlnative.js) into one file by esbuild.
( cd "$APP" && [ -d node_modules ] || npm install --no-audit --no-fund )
( cd "$APP" && npx --no-install esbuild native/entry.js --bundle --minify --format=iife --target=es2019 --outfile="$WWW/hlnative.js" --log-level=warning )
python3 - "$WWW/index.html" <<'PY'
import sys, pathlib
p = pathlib.Path(sys.argv[1]); s = p.read_text()
import os
tag = '<script src="hlnative.js"></script>\n'
if os.environ.get('HL_NO_ADS') == '1':
    tag = '<script>window.HL_NATIVE_CONFIG={ADS_ENABLED:false}</script>\n' + tag
marker = '<script src="vendor/supabase-'
if tag in s: sys.exit(0)
if s.count(marker) != 1: sys.exit('sync-web: could not find the script marker in index.html (build.py changed?)')
p.write_text(s.replace(marker, tag + marker))
PY

# 3b. CSP of the COPY: also list the app's own origins (capacitor://localhost, https://localhost). See scripts/app_csp.py.
python3 "$APP/scripts/app_csp.py" "$WWW/index.html"

# 4. sanity checks
test -f "$WWW/index.html" && grep -q 'hlnative.js' "$WWW/index.html" && grep -q 'capacitor://localhost' "$WWW/index.html"
test ! -e "$WWW/lab" && test ! -e "$WWW/sounds.html" && test ! -e "$WWW/deaths.html"
echo "app/www ready: $(find "$WWW" -type f | wc -l) files, $(du -sh "$WWW" | cut -f1)"
