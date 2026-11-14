# Owner checklist: only you can do or decide these

Source tags in [brackets] are worker reports in `/home/claude/ws/out/`. Prices: always "check current price" on the official page.

## 1. Accounts to create
- [ ] Apple Developer Program. Cost: check current price. Allow days for approval. Organization needs a D-U-N-S number (unverified). [a05]
- [ ] Google Play Console. Cost: check current price. Needs government ID and a card in your legal name. New personal accounts need 12 testers for 14 continuous days before production access, so start Android first. [a05]
- [ ] Google AdMob: one app per platform, one interstitial ad unit per platform, and a GDPR/UMP message under Privacy & messaging. Cost: check current price. [a04, a05]
- [ ] RevenueCat: project with both apps, the product attached, two public SDK keys. Cost: check current price (free tier limit unverified). [a04]
- [ ] Tax and banking forms in both consoles. [a05]
- [ ] Store products: one non-consumable / one-time product `remove_ads` in App Store Connect and Play Console. [a04]

## 2. Values to supply
- [ ] Contact email (replaces `CONTACT_EMAIL` in `site/privacy.html`, `terms.html`, `support.html`). [b05]
- [ ] Governing law (replaces `GOVERNING_LAW` in `site/terms.html`). [b05]
- [ ] Effective date (replaces `EFFECTIVE_DATE` in privacy and terms). [b05]
- [ ] Your legal name or business name for the privacy page (it says only "independent developer"). [b05]
- [ ] Bundle id / package name (reverse domain you own, no `com.example`) and final app name. [a04, a05]
- [ ] AdMob app ids (2) and ad unit ids (2 interstitial; rewarded not used yet). Go in `app/native/hlnative.js` `REAL_IDS` and the configure script. [a04]
- [ ] RevenueCat public SDK keys (`appl_...`, `goog_...`) in `app/native/hlnative.js` `IAP.apiKey`. [a04]

## 3. Decisions (question, recommendation, detail)
- [ ] Seller identity: personal or organization? Recommendation: decide first, it changes the tester rule. Detail: `store/launch-checklist.md` 0.1. [a05]
- [ ] App name: use a two-part name such as "High & Low: Number Duel" because many apps share "High and Low". Detail: `store/listing.md` section 2. [a05]
- [ ] Ads and Remove Ads in the first release? Recommendation: yes, non-personalised, no ATT prompt. Detail: `store/privacy-answers.md` 3c. [a05, a04]
- [ ] Is the game directed at children? Recommendation: no, target 13+ (or 16+). Detail: `store/age-rating.md` section 4. [a04, a05]
- [ ] Cartoon violence answer: "Frequent" (Apple 13+) or "Infrequent" (9+, Apple may change it). Recommendation: Frequent. Detail: `store/age-rating.md`. [a05]
- [ ] Moderation: Apple 1.2 wants filter, report, block, contact. Today: name filter in Play and friends (lite), one-tap Report on the result sheet, no block, email on support page. Recommendation: accept the risk or add block before launch. Detail: `store/review-notes.md` R1. [a05, a09, c04]
- [ ] Restore purchases: a "Restore purchases" text link exists in the "i" sheet in app builds. Recommendation: keep (Apple requires a restore path). [a04, c04]
- [ ] iPad support yes or no? Recommendation: yes (CSS scaling exists) but only after a real iPad check; otherwise set iPhone only in Xcode. Detail: c09 report, `app/README.md` iPad line. [c09, a06]
- [ ] Lock portrait? Recommendation: yes (already set by `configure-native.mjs`); landscape phone layout is not usable. [a01, a04]
- [ ] Keep the dark splash (#1E2240)? Recommendation: drop it unless you want dark mode, the game is light only. [b06]
- [ ] Pick the app icon: option A (one bean, party hat) is built in; B and C are in `store/icon-options/`. [a03]
- [ ] Analytics retention: 14 months (privacy page) or 90 days (store kit). No delete job exists, you must build one or change the number. [b05, a05]
- [ ] Streak feature on or off (flag `streak`). Recommendation: off for launch; pros and cons in a18 report. [a18]
- [ ] Share feature on or off (flag `share`); caption has no store link yet. Recommendation: off until store links exist. [a19]
- [ ] Music: no files exist in `site/music/`. Ship two loops (`home.mp3`, `play.mp3`, real recordings) or remove the loader. [a20, b01, a08]
- [ ] Death scene `bonk` has no sound entry (silent). Add a sound or leave. [a07]
- [ ] Rating dodge: killing the app mid-duel costs nothing, and a stayer gets no win credit when the opponent leaves. Needs a product rule. [a13]
- [ ] Hidden bot rating: weak players may face a bot rated up to 600 higher. Accept? [a13]
- [ ] Fake host / matchmaking spam / signed messages (server needed for a real fix). Recommendation: accept for launch. [a14]
- [ ] Reduce home-scene animations on low-end phones (visual change). [a10]
- [ ] Emoji still in Powers UI (power icons, badges, bubbles) against the no-emoji rule. [a11, c04]
- [ ] Hidden bots: no "BOT" tag; disclosed only in the "i" sheet, privacy page and store text. Accept? [a05]
- [ ] Name filter word lists: review the hard calls (e.g. "Dick Van Dyke" is blocked in Play). Lists are in `src/names.js`. [a09]
- [ ] Legal review: liability cap, ratings reset, under-13 line vs EEA age 16, international transfers. Recommendation: have a lawyer look. [b05]
- [ ] Publish or hide the dev pages `site/deaths.html`, `site/sounds.html` (app build already excludes them). [a14, a04]

## 4. SQL to run in Supabase (your game's project only, never "liqhoz")
- [ ] 1. `supabase/events.sql` only if the `events` table does not exist yet. [a05]
- [ ] 2. `supabase/events_v2.sql`: allows the new events (`rated`, `share`, `report`, `qleave`, `noads_tap`) and adds the funnel and retention views. Safe to rerun. Run before shipping. [b07, c04, a14]
- [ ] Build a scheduled delete for old `events` rows. [b05]

## 5. Things to listen to or look at (nobody has done this on a phone)
- [ ] Sound mix: tier levels, short-clip compensation and compressor are numbers only, never heard. `store/sound-levels.csv` has the measurements. [a07]
- [ ] Death scene sound sync: trimmed sounds start 14 to 109 ms earlier than before (d_buzz, k_zap). [a07]
- [ ] All eleven death scenes with sound, especially piano, banana, calc, chomp, melt, zap (polished by eye only). [a15, a16, a17]
- [ ] App icon on a real home screen (adaptive masks in `store/launch/preview-adaptive-masks.png`). [a03, b06]
- [ ] Splash on a real phone (a ground-strip flash may show at the bottom). [b06]
- [ ] Store screenshots in `store/shots/` after running `store/make_screens.py` (piano "BWANG!" clip at 360 wide was reported). [a06]
- [ ] Small phones: ask slider "Ask!" button clipped by 12 px at 320x568, duel panel covers own card. [b01]
- [ ] Large system font: logo and mode labels break at 150%. [a11]
