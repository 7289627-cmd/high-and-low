# High & Low: Worker Guide

You are a worker on a mobile party game. Follow these rules exactly. Do not redesign anything. Do only the task in your brief.

## Files
- `src/base.css` – shared tokens, cards, death-scene animations. Rarely touched.
- `src/extra.css` – newer screens (lobby, ask screen, number pad, wheel). Append new CSS at the END of this file.
- `src/base.js` – art only: `charSVG()`, props, `SCENES` (death animations). Touch only for new art or deaths.
- `src/main.js` – everything else: networking, host engine, rendering, bindings.
- Output: `python3 /home/claude/hl/build.py` writes `/home/claude/high-and-low.html`. Never edit that file by hand.

## How the game works (do not change unless the brief says so)
- One phone is the host. The host's phone runs the game state `G` and shares it through room presence.
- Every phone keeps its own secret number and answers questions about it automatically (`answerIfAsked`). Secrets never go into `G`.
- On a turn, the player questions every other alive player once, in circle order (`G.sub`). Then the turn passes.
- First player is picked by the wheel (`showWheel`).

## Style rules
- Colors only from CSS tokens: `--ink --paper --paper-2 --red --green --yellow --sky --sky-deep --ground --muted --white`.
- Fonts: `var(--display)` for big words and buttons, `var(--body)` for text.
- Everything chunky: `border:3px solid var(--ink)`, rounded corners, `box-shadow:0 4px 0 var(--ink)`.
- Phone first: test layouts at 390px wide. No horizontal scroll.
- Never use the phone keyboard for numbers. Use `padHTML()`.
- Escape any player name with `esc()` before putting it in HTML.
- Copy for players: short, plain, friendly. No em dashes.

## Code rules
- Small, targeted edits. Keep existing function names.
- Re-render by calling `render(true)`. Host changes to `G` must be followed by `publishG()`.
- Do not add libraries or network calls.

## Done means
1. `bash /home/claude/hl/run_tests.sh` prints only PASS lines.
2. You report: what you changed (file + function names), and the PASS lines. Keep it under 10 lines. Do not paste whole files.
3. Do not publish. The lead publishes after review.
