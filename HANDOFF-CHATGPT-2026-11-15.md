# High & Low: handoff to the deploying agent (Nov 15, 2026)

All paths are relative to the root of the GitHub repo `7289627-cmd/high-and-low`, branch `main`.

## 1. Goal
High & Low is a phone party number-guessing game (hide a number, guess theirs). It is live as a web game at the repo's GitHub Pages site. Your only job: build and submit the iOS and Android apps from the prepared Capacitor wrapper in `dev/app/`. You do not change game code. Game changes stay with the owner (Dodgy) and his own Claude session.

## 2. Done
- Game: source in `dev/src/`. `python3 dev/build.py web` writes the product `index.html` to the repo root (the live site). Site assets are in the repo root: `fonts/ icons/ music/ sfx/ vendor/ manifest.webmanifest`.
- Wrapper: `dev/app/` (Capacitor 8.6.2, exact pins in `package.json`, Node 22+). `dev/app/sync-web.sh` builds the game, copies the site files into `dev/app/www`, and bundles `dev/app/native/hlnative.js` (AdMob interstitials, Remove Ads and restore via RevenueCat, haptics, Back button, keep-awake, storage mirror to Capacitor Preferences, optional invite links in `deeplink/`). Config block with placeholders is at the top of that file. `capacitor.config.ts` has a placeholder `appId`.
- Icon: owner chose concept F. Final set: `dev/store/icons/` (1024, 512, 180, adaptive foreground) and `dev/store/launch/assets/` (sources for `@capacitor/assets`).
- Store kit in `dev/store/`: `listing.md`, `privacy-answers.md`, `age-rating.md`, `review-notes.md`, `launch-checklist.md`, `RELEASE-CHECKS.md`, `OWNER-TODO.md`, `analytics-guide.md`, `strings.md`, `shots/` (screenshots per device size, made by `make_screens.py`), `video/`, `legal-drafts/` (privacy and terms with placeholders `CONTACT_EMAIL`, `GOVERNING_LAW`, `EFFECTIVE_DATE`).
- Playable ad: `dev/store/playable/` (`dist/` has one build per ad network, `build.py` has placeholder store URLs). Not part of the app. For the owner's ad campaigns later.
- Tested on desktop only (jsdom with a fake network hub, and headless Chrome): build, full simulated games, rated-duel maths, matchmaking, reconnect, analytics, name filter, XSS, haptics, the native bridge with mocked plugins, real Chrome at nine screen sizes. Full suite last passed in one run on Nov 14 (26 of 26). Since then: group turn rules changed (all checks passed, three of them on separate re-runs), then a "who you are asking" banner, a new bar on the player's own card, HALF button removed, slider/number-pad toggle (screenshots at two sizes plus `quick.js` only).
- Verified from a fresh clone on Linux (Node 22.23, Nov 15): steps 1, 3 and the Android half of steps 4 and 7 below. `sync-web.sh` printed `app/www ready: 99 files, 3.2M`, the rebuilt `index.html` was byte-identical to the live one, `npx cap add android` succeeded, and `@capacitor/assets generate --android` wrote 74 files with the F icon. Steps 2, 5, 6 and everything iOS were not run from the clone.
- NOT tested: anything on a real phone or simulator. No ads, purchase, restore, haptics, Back button, safe areas, sound, music, real Safari/WKWebView. Nothing was built in Xcode or Android Studio.

## 3. In progress
- Nothing is half applied. Everything in the repo is the live game.
- The website still shows the old icon (owner has not approved changing it). The app uses the new one.
- Waiting on the owner: everything in `dev/store/OWNER-TODO.md`. The blockers for you are store accounts, bundle id, AdMob ids, RevenueCat keys, contact email, and a Mac or cloud Mac for iOS.

## 4. Decisions
Approved by the owner (do not change):
- UI extremely simple: no extra labels, hints or tutorials, no emoji in UI chrome. Numbers by in-game slider or pad, never the phone keyboard.
- Sounds are real recordings only. Music: Snow Theme (menu), Children's March (in game), CC0.
- Coins come only from winning. No login wall. Hidden fill-in bots are allowed (disclosed in the "i" sheet).
- Play = rated 1v1 duel (1-100, 1-10,000, 1-100,000). Play with friends = unrated group rooms. In groups the first question goes to everyone, later turns ask one opponent at a time.
- Ratings stay on the phone. No leaderboard (dropped Nov 15).
- Portrait only. Internet required.
- You only build and submit. No game edits.

Proposed, not approved (do not enable or build):
- Streak and share features (flags in `dev/src/flags.js`, both off). Guest accounts. iPad support (CSS exists, Chrome-tested only; otherwise set iPhone only). Dark splash. Rewarded ads. The interstitial frequency rule in OWNER-TODO.
Rejected: the preview video as a store asset, synthesized sounds, slide whistle, a HALF button.

## 5. Next steps (each has a finish line)
1. `cd dev/app && npm install`. Finish: no errors.
2. Set `appId` and app name in `dev/app/capacitor.config.ts` (owner supplies). Finish: no `com.example` left.
3. `bash dev/app/sync-web.sh`. Finish: prints `app/www ready: N files`.
4. `npx cap add android` and, on macOS, `npx cap add ios`. Finish: `dev/app/android`, `dev/app/ios` exist.
5. `node scripts/configure-native.mjs --android-app-id ... --ios-app-id ...` then `npx cap sync`. Finish: a second run changes nothing.
6. Put real AdMob ids and RevenueCat keys in `dev/app/native/hlnative.js` (`REAL_IDS`, `IAP.apiKey`), set `TEST_MODE:false`, rerun step 3. Finish: `grep REPLACE dev/app/native/hlnative.js` prints nothing.
7. Icons and splash: `cp -R ../store/launch/assets ./assets` then `npx @capacitor/assets generate --iconBackgroundColor '#7FD0E4' --splashBackgroundColor '#7FD0E4'`. Finish: the F icon shows in both native projects.
8. Run on a real device with sound on. Finish: every line of `dev/store/RELEASE-CHECKS.md` passes.
9. Sandbox-test the ad, the purchase and restore. Finish: RELEASE-CHECKS steps 14 to 20 pass.
10. Fill the store forms from `listing.md`, `privacy-answers.md`, `age-rating.md`, `review-notes.md`; upload `dev/store/shots/`. Host the privacy page (fill the placeholders in `legal-drafts/`, owner publishes it). Finish: no empty required field.
11. Google Play closed test first (new personal accounts need 12 testers opted in for 14 days in a row before production access), then TestFlight. Finish: the build installs from both.

## 6. Watch out
- iOS cannot be built on Linux. You need macOS with Xcode or a cloud Mac build service.
- `dev/build.py` and `sync-web.sh` find their own folder, so they run from any clone. `build.py web` wants `dev/config.json` (Supabase URL and public key, already in the repo). Expected output: `WEB BUILD OK` and about 373,000 bytes.
- Tests in `dev/test/` and `dev/run_tests.sh` still contain the absolute path `/home/claude/hl` and will not run from a clone without editing. You do not need them. The owner's Claude session runs them.
- UNVERIFIED on any device: the Google test ad unit ids (from memory), RevenueCat call shapes (from type files only), Capacitor `backButton`, keep-awake, Preferences restore, haptics, safe-area padding on a notched iPhone, the ad consent form, the page CSP under `capacitor://localhost`.
- Never put a service key in the client. `config.json` holds only the public key.
- Do not touch the owner's other projects: Supabase project "liqhoz", Google Cloud project "Liquid Horizon Sign-in".
- The owner must run `dev/supabase/events_v2.sql` in the game's Supabase project before the app ships. Until then some analytics events are dropped silently.
- `privacy.html` and `terms.html` in the repo root are the older live pages. The newer drafts are in `dev/store/legal-drafts/` and need the owner's email, governing law and date.
- Never ask the owner to paste passwords or secret keys into chat. He signs in himself.

## 7. Read first
1. `dev/store/OWNER-TODO.md`
2. `dev/app/README.md`
3. `dev/store/RELEASE-CHECKS.md`
