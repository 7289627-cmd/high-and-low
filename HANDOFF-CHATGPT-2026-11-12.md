# Handoff: High & Low, for store deployment (2026-11-12)

## 1. Goal
Ship High & Low (party number-guessing game, each player on their own phone) to Google Play and the App Store, then add unobtrusive ads with a "no ads" purchase, analytics, and grow to a first 100 players. The owner goes by Dodgy.

## 2. Done
- Live web game: https://7289627-cmd.github.io/high-and-low/ (GitHub Pages, repo `7289627-cmd/high-and-low`, branch `main`).
- Shipped file is `index.html` at the repo root, built from `dev/src/*` by `dev/build.py web`. Assets: `sfx/` (50 CC0 Kenney mp3s), `vendor/` (supabase-js 2.118.0, qrcode-generator 1.4.4, self-hosted), `icon-180.png`, `og.png` (link preview).
- Multiplayer: Supabase Realtime broadcast only (`dev/src/net-supabase.js`). The host phone runs the game. No game server.
- Features: Play (quick match, hidden bots fill empty seats, disclosed behind the "i" button), Play with friends (code, invite link, QR), private knowledge, ask-everyone turns, powers bought with coins, 10 death cartoons, leavers replaced by an easy bot, watchdogs against stuck turns, content security policy, swear filter on names in Play games, desktop layout and keyboard input.
- Tested: `dev/run_tests.sh` (jsdom, fake network) passed in full on commit 406e61d. Later commits ran only the quick subset. NOT tested: any real phone by the previous agent, real Supabase connection under the CSP, link preview on real chat apps.

## 3. In progress
- Nothing half applied.
- Supabase tables `profiles`, `claimed_wins` and functions `claim_win`, `spend_coins` exist (`dev/supabase/schema.sql`) but the game does not use them yet. Coins live in localStorage.

## 4. Decisions (do not re-argue)
- Sounds are real recordings only, never code-generated.
- No over-explaining or extra labels in the UI. Number entry always uses the in-game pad, never the phone keyboard.
- No lives. Coins come only from winning (+5). No login wall; accounts must be optional.
- Hidden bots in Play are fine as long as the disclosure exists somewhere.
- Wheel spin and death scenes always play in full, even with OS Reduce Motion on.
- Parked: a "lie" power-up. Rejected: coins per question or per knockout.
- Proposed, NOT approved yet: silent guest accounts; 1 free power per game; Google and Apple sign-in.

## 5. Next steps
Scope for the deploying agent is ONLY steps 1 and 2. Game changes stay with the owner's Claude session.
1. Wrap the web build with Capacitor (iOS + Android). Done when both run the game from bundled files on a real device with sound.
2. Provide `window.HLNative` in the app builds (contract in `dev/src/ads.js`): `showInterstitial()`, `showRewarded()`, `buyNoAds()`, `ownsNoAds()`. The game already decides WHEN to show an ad (only between games, from the 2nd finished game, then every 2nd) and shows a "Remove ads" button in the "i" sheet when `buyNoAds` exists. Name the ad provider in `privacy.html` once chosen.
3. Store listings: icon 1024px, screenshots, age rating, data safety forms. Data collected: anonymous usage events tied to a random device id (see `privacy.html`).

Already built (do not redo): anonymous analytics (`dev/src/track.js` writes to Supabase table `events`, view `stats_daily`, SQL in `dev/supabase/events.sql`), `privacy.html`, `terms.html`, link preview, desktop layout.
Still open on the game side: self-hosted fonts, server-side coins, stronger name filter, Play games surviving a host leaving.

## 6. Watch out
- Build: `cd dev && python3 build.py web`. The script has absolute paths from the previous workspace (`/home/claude/hl`); fix `H=` and the output paths first. `SITE=` in build.py sets the link preview address.
- Tests: `dev/run_tests.sh` (about 25 minutes). In `dev/test`, install `jsdom@24` and `qrcode-generator@1.4.4` together in one command.
- The Supabase key in `index.html` is a publishable key and is meant to be public. Never add a service key to the client.
- Known weak points: the host phone is trusted (a modified client can cheat); if a host leaves a Play game it ends for everyone; room codes are 4 letters; the swear filter is a short English list; Supabase free tier may pause an idle project (unverified).
- Open Supabase chores: revoke anon SELECT on `profiles`, turn off unused email sign-ups, add CAPTCHA or rate limits before guest accounts.
- Do not touch the owner's other projects (Supabase "liqhoz", Google Cloud "Liquid Horizon Sign-in").

## 7. Read first
- `dev/src/main.js` (game engine and screens)
- `dev/build.py` and `dev/WORKER_GUIDE.md`
- `dev/supabase/schema.sql`
