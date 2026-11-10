#!/bin/bash
# One-command check. Prints PASS/FAIL lines only. Run: bash /home/claude/hl/run_tests.sh
cd /home/claude/hl
python3 build.py || { echo "FAIL build"; exit 1; }
node --check test/_built.js && echo "PASS syntax" || { echo "FAIL syntax"; exit 1; }
cd test
S=$(timeout 900 node sim.js 2>&1 | grep -E "END|STUCK|timeout|errors")
echo "$S" | grep -q "END" && echo "$S" | grep -q "errors \[\]" && echo "PASS solo game: $(echo "$S"|grep END)" || echo "FAIL solo game: $S"
M=$(timeout 400 node mp.js 2>&1 | grep -E "END|errors" )
echo "$M" | grep -q "errors \[\] \[\]" && echo "PASS two-phone game (no errors) $(echo "$M"|grep END)" || echo "FAIL two-phone game: $M"
cd /home/claude/hl
python3 build.py web >/dev/null || { echo "FAIL web build"; exit 1; }
node --check test/_built_web.js && echo "PASS web syntax" || { echo "FAIL web syntax"; exit 1; }
cd test
W=$(timeout 400 node mp_web.js 2>&1 | grep -E "END|errors" )
echo "$W" | grep -q "errors \[\] \[\]" && echo "PASS web two-phone game (no errors) $(echo "$W"|grep END)" || echo "FAIL web two-phone game: $W"
T=$(timeout 100 node timer.js 2>&1 | grep -E "PASS|FAIL")
echo "${T:-FAIL timer auto-ask: no output}"
P=$(timeout 500 node powers.js 2>&1 | grep -E "PASS|FAIL")
echo "${P:-FAIL powers: no output}"
V=$(timeout 600 node private.js 2>&1 | grep -E "PASS|FAIL")
echo "${V:-FAIL private knowledge: no output}"
node sfx_check.js
node bots_check.js
cd ..
python3 build.py >/dev/null
cd /home/claude/hl && python3 build.py web >/dev/null && (cd test && timeout 400 node leave.js 2>&1 | tail -1); (cd test && timeout 150 node xss_check.js 2>&1 | grep -E '^(PASS|FAIL) security'); python3 build.py >/dev/null
(cd /home/claude/hl && python3 build.py web >/dev/null && cd test && timeout 900 node chaos.js 11,29,47 2>/dev/null | tail -1)
(cd /home/claude/hl && python3 build.py web >/dev/null && cd test && timeout 120 node quick.js 2>&1 | grep -E "^(PASS|FAIL) quick play" || echo "FAIL quick play: no output")
