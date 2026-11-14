# High & Low: handoff to the deploying agent

## 1. Goal
High & Low is a party number-guessing game (hide a number, guess theirs). It runs as a web game today. Your only job: build and submit the iOS and Android apps from the prepared wrapper in `app/`. You do not change game code. Game changes stay with the owner (Dodgy) and his own Claude session.

## 2. Done
- Game source: `src/*.js`, `src/*.css`. Built by `build.py` into `site/index.html` (the product) and `artifact.html` (offline test build).
- Wrapper: `app/` (Capacitor 8.6.2, exact pins in `app/package.json`, needs Node 22+). `app/sync-web.sh` copies `site/` to `app/www` and bundles `app/native/hlnative.js` (ads, Remove Ads and restore via RevenueCat, haptics, Back button, keep-awake, storage mirror to Capacitor Preferences, optional deep links in `app/deeplink/`). Config block with placeholders at the top of that file. `app/capacitor.config.ts` has a placeholder `appId`.
- Store kit: `store/listing.md`, `privacy-answers.md`, `age-rating.md`, `review-notes.md`, `launch-checklist.md`, `make_screens.py`, `icons/`, `launch/assets/` (icon and splash sources), `OWNER-TODO.md`, `RELEASE-CHECKS.md`, `analytics-guide.md`, `strings.md` (every visible string), `video/` (26 s silent preview), `make_video.py`.
- Site pages: `site/privacy.html`, `terms.html`, `support.html` (contain placeholders `CONTACT_EMAIL`, `GOVERNING_LAW`, `EFFECTIVE_DATE`). SQL: `supabase/`.
- Tested (desktop only, fake network hub): build, `node --check`, quick play, rated-duel maths (`test/duel.js`), matchmaking, reconnect/resume (`test/resume.js`), analytics (`test/track.js`), names filter, security/XSS, haptics, native bridge with mocked plugins, real Chrome at nine screen sizes (`test/real_browser.py`), many screenshots in Chromium. I re-ran `python3 build.py web`, `python3 build.py` and `node --check test/_built_web.js` (OK) and `node quick.js` (`PASS quick play`). I did not re-run the other suites.
- NOT tested: anything on a real phone or simulator. No ads, purchase, restore, haptics, Back button, safe areas, sound, music, real Supabase traffic, real Safari/WKWebView. The sound mix and the death scenes have never been heard or seen by a person on a device. `cap add ios/android` was run once on Linux; nothing was built in Xcode or Android Studio.
- Missing files: `site/music/home.mp3` and `play.mp3` do not exist (music engine is built, no tracks, 404 in console).

## 3. In progress
- Nothing is half applied in this folder. The whole of it is one uncommitted change set on top of the live site (repo `7289627-cmd/high-and-low`, last pushed commit `839408e`). The owner has not yet approved publishing it.
- Full suite `bash run_tests.sh` passed on the copy before the last review fixes (25 PASS, 0 FAIL). The lead records the result of the final run in the session, not here.
- Waiting on the owner: music tracks, contact email, governing law, store accounts, and the decisions in `store/OWNER-TODO.md`.

## 4. Decisions
Approved (owner's standing decisions, do not change):
- UI extremely simple: no extra labels, hints, tutorials, no emoji in UI chrome. Numbers by in-game slider/pad, never the phone keyboard.
- Sounds are real recordings only, never synthesized. No slide whistle. No over-labelling.
- Coins come only from winning. No login wall. Hidden fill-in bots allowed (disclosed in the "i" sheet).
- Wheel spin and death scenes always play in full, even with Reduce Motion.
- Fonts: Bagel Fat One (display), Baloo 2 (body). Palette and outlined cartoon style stay.
- Internet required. Play = rated 1v1 duel with three ranges (1-100, 1-10,000, 1-100,000). Play with friends = unrated group rooms.
- You do only build and submit. No game edits.

Proposed, not approved (do not enable or build unless the owner says yes):
- Streak and share features (flags `streak`, `share` in `src/flags.js`, both off).
- Guest accounts. iPad support (tablet scaling CSS exists in `src/zz_c09.css`, Chrome-tested only). Dark splash (#1E2240). 14-month analytics retention (no delete job exists). RevenueCat for Remove Ads.

## 5. Next steps (each has a finish line)
1. Install: `cd app && npm install`. Finish: `node_modules/` exists, no errors.
2. Edit `appId` in `app/capacitor.config.ts` (owner supplies). Finish: no `com.example` left.
3. Sync web build: `bash app/sync-web.sh`. Finish: prints `app/www ready: N files`.
4. Add platforms: `npx cap add ios` (macOS), `npx cap add android`. Finish: `app/ios`, `app/android` exist.
5. Configure: `node scripts/configure-native.mjs --android-app-id ... --ios-app-id ...`, then `npx cap sync`. Finish: second run changes nothing.
6. Replace test ad ids and keys in `app/native/hlnative.js` (`REAL_IDS`, `IAP.apiKey`), set `TEST_MODE:false`. Finish: no `REPLACE` string left (`grep REPLACE app/native/hlnative.js`).
7. Icons and splash: `cp -R store/launch/assets app/assets`, then `npx @capacitor/assets generate --iconBackgroundColor '#7FD0E4' --splashBackgroundColor '#7FD0E4'`. Finish: icons appear in both native projects (generated output unverified).
8. Run on a real device with sound on. Finish: the full list in `store/RELEASE-CHECKS.md` passes.
9. Test ad, purchase and restore in sandbox (iOS sandbox tester, Android licence tester). Finish: steps 14 to 20 of RELEASE-CHECKS pass.
10. Screenshots: `python3 build.py && python3 store/make_screens.py` (about 6 minutes, writes `store/shots/`). Finish: image sizes match the table in the header of `store/make_screens.py`.
11. Listing text from `store/listing.md`; privacy answers from `store/privacy-answers.md`; age rating from `store/age-rating.md`; reviewer text from `store/review-notes.md`. Finish: every store form field filled.
12. Google Play closed testing first (new personal accounts need 12 testers for 14 days, per `store/launch-checklist.md`), then TestFlight. Finish: build installs from both channels.

## 6. Watch out
- Build: `cd <this folder> && python3 build.py web` prints `WEB BUILD OK 357764 bytes` (I ran it). `python3 build.py` prints `BUILD OK 345192 bytes`. `web` needs `config.json` (Supabase url and public key; it warns if missing).
- Tests: `cd test && timeout 250 node quick.js` (verified, `PASS quick play`). Others: `node duel.js`, `match.js`, `names.js`, `hlnative.js`, `sfx_check.js`, `xss_check.js`. `bash run_tests.sh` takes about 25 minutes; do not run it casually.
- Absolute paths that must change when the folder moves (find them with `grep -rln "/home/claude" . --exclude-dir=node_modules --exclude-dir=lab --exclude-dir=shots`): `build.py` (lines 1, 4, 57), `run_tests.sh`, `run_quick.sh`, `test/*.js` (chaos, leave, match, mp, mp_web, powers, private, quick, share, sim, streak, timer, xss_check) and `test/*.py`, `tools/*.py`, `store/icon-options/make_icons.py`, `make_options.py`, `store/launch/make_launch.py`, `WORKER_GUIDE.md`. Also delete the dangling symlink `site/lab` (points to `/home/claude/hl/site/lab`).
- UNVERIFIED: Google test ad unit ids (iOS interstitial `4411468910` and both sample app ids are from memory), RevenueCat call shapes (`getProducts`, `purchaseStoreProduct`, `restorePurchases`, from type files only), Capacitor `backButton`, native keep-awake, Preferences restore, haptics, safe-area padding on a notched iPhone, ad consent form, `capacitor://localhost` against the page CSP.
- Never put a service key in the client. `config.json` holds only the public anon key.
- Do not touch the owner's other projects: Supabase project "liqhoz", Google Cloud project "Liquid Horizon Sign-in".
- SQL the owner must run in his game's Supabase project before the new build ships: `supabase/events_v2.sql` (idempotent; widens the allowed event list to include `rated`, `share`, `report`, `qleave`, `noads_tap` and adds funnel/retention views). Until it is run those events are rejected silently. `supabase/events.sql` was run earlier. `supabase/schema.sql` (accounts, coins) is not used by the current game.
- `site/sfx` has 63 sounds. The slide-whistle files were deleted on purpose; do not restore them.

## 7. Read first
1. `store/OWNER-TODO.md` (what is blocked on the owner).
2. `app/README.md` (exact wrapper commands, where each id goes).
3. `store/RELEASE-CHECKS.md` (the on-device test script).
