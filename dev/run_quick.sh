#!/bin/bash
# Quick check for workers (about 1 minute). The lead runs the full run_tests.sh.
cd /home/claude/hl
python3 build.py >/dev/null && python3 build.py web >/dev/null || { echo "FAIL build"; exit 1; }
node --check test/_built.js && node --check test/_built_web.js && echo "PASS syntax" || { echo "FAIL syntax"; exit 1; }
cd test && node sfx_check.js 2>&1 | grep -E "PASS|FAIL"
S=$(timeout 300 node sim.js 2>&1 | grep -E "END|STUCK|timeout|errors")
echo "$S" | grep -q "END" && echo "$S" | grep -q "errors \[\]" && echo "PASS solo game" || echo "FAIL solo game: $S"
