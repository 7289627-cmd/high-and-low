# High & Low

A phone party game. Everyone hides a number, then takes turns asking "is it higher or lower than…?" Get someone down to 10 numbers and you have to guess it exactly. Guess right and their bean meets a very silly end.

**Play:** https://7289627-cmd.github.io/high-and-low/

On iPhone, open the link in Safari, tap Share, then Add to Home Screen.

## Dev
- Game source lives in `dev/src`. `dev/build.py web` builds `index.html`.
- `dev/run_tests.sh` runs simulated games (needs `npm i jsdom@24` in `dev/test`).
- Rules for contributors and AI workers: `dev/WORKER_GUIDE.md`.
- Multiplayer uses Supabase Realtime broadcast. The key in `dev/config.json` is a publishable key, meant to be public.
