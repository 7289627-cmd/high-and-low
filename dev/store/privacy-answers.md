# Privacy forms: Apple App Privacy and Google Play Data safety

Tags: [VERIFIED] read on the official page 2026-11-14. [UNVERIFIED] from memory or secondary sources. [DECISION] the owner must choose. [GUESS] my judgement.

Both forms must match what the code really does, and Google does not check them but can enforce on misstatement ([VERIFIED] https://support.google.com/googleplay/android-developer/answer/10787469). Apple says you must also include third-party code such as ad SDKs ([VERIFIED] https://developer.apple.com/support/app-privacy-on-the-app-store).

## 1. What the code actually sends (ground truth)

Read from `src/track.js`, `src/net-supabase.js`, `src/main.js`, `src/rating.js`, `src/powers.js`, `src/ads.js`, `supabase/events.sql`.

A. Play statistics, `POST {supabase}/rest/v1/events`, one row per event:
- Fields: `ev` (event name), `sid` (random 12 character id made on first run and kept in local storage as `hl-sid`), `props` (small JSON, includes `v:1`).
- Events and props sent by the client:

| ev | props |
|---|---|
| open | inv (opened via invite link 0/1), wide (screen width 820 or more), app (native wrapper present) |
| play_tap | max (range chosen) |
| host, join, practice, again, noads | none |
| game_start | kind (play / friends / practice), max, n (players), bots (count) |
| game_end | kind, secs, won (0/1), n, bots |
| leave | kind, secs |
| power | k (power type) |
| rated | won, elo (rating after the game) |
| ad | t:'inter' |

- No nickname, no room code, no free text, no location, no contacts (matches `src/track.js` header and `site/privacy.html`).
- The server also sees the connection IP address and request headers (normal for any server). Whether Supabase stores IPs for the REST API is [UNVERIFIED]; check the project's log settings.
- `events.sql` allows only inserts for the anon role. The owner reads rows in the Supabase dashboard.
- Retention: no delete job exists in `supabase/events.sql`. Rows stay forever today. [DECISION] add a 90 day delete job (see section 5, it unlocks Google's "auto deleted within 90 days" badge claim).

B. Realtime rooms (Supabase Realtime broadcast and presence, `src/net-supabase.js`, `src/main.js`):
- Sent to the other players in a room, via Supabase: nickname (max 12 chars), color and hat, a random player id (`PID`, `p` plus 8 characters, kept in local storage `hl-pid`), rating (`el`), coin count (`co`, only in friends rooms), moves, taunt emoji index, ready state.
- Secret numbers stay on the device until revealed (`WORKER_GUIDE.md`, `answerIfAsked`).
- Rooms are not stored after they end (`site/privacy.html`). Presence state exists on the server only while connected [GUESS, standard Supabase Realtime behaviour].
- Public Play uses the shared channel `hl-queue-v1`, so strangers see each other's nickname and rating.

C. Stored only on the device (never sent as a profile): nickname, look, wins, coins, rating, hat unlocks, sound setting, `hl-noads` flag. Local only data needs no disclosure (Apple: "data processed only on device ... doesn't need disclosure", [VERIFIED] Apple page above).

D. Ads (app builds only): `src/ads.js` calls `window.HLNative.showInterstitial()`. The native wrapper will include the Google Mobile Ads (AdMob) SDK. The website never shows ads. First ad after the 2nd finished game, then every 2nd game, never during a game.

E. Purchase "Remove ads": handled by Apple or Google. The client keeps only a local flag. The developer receives no payment details.

F. Not used by the client at launch: Supabase auth and the `profiles`, `claimed_wins` tables in `supabase/schema.sql`. No account exists.

## 2. What the AdMob SDK adds (official disclosure pages)

Google Mobile Ads SDK on Android, per Google ([VERIFIED] https://developers.google.com/admob/android/play-data-disclosure?hl=en): IP address (may be used to estimate general location), user product interactions (app launches, taps, video views), diagnostic information (launch time, hang rate, energy use), device and account identifiers (Android advertising ID, app set ID). Purposes: advertising, analytics, fraud prevention. Shared. Encrypted in transit. The advertising ID can be turned off through the manifest.

Google Mobile Ads SDK on iOS, per Google ([VERIFIED] https://developers.google.com/admob/ios/privacy/data-disclosure?hl=en): crash logs, performance data, device ID (advertising identifier or other app/developer bounded IDs), advertising data, coarse location from IP, product interactions. The page does not say linked or tracking for each, so those answers below are [GUESS].

EEA and UK: you need a Google-certified consent message (UMP SDK or another certified CMP). From 2024-01-16 without one only limited ads serve in EEA and UK ([VERIFIED] https://developers.google.com/admob/ios/privacy/gdpr?hl=en). Consent is also needed to use AdID to serve ads. The page does not say non-personalised ads skip consent, so assume consent is required even for non-personalised ads in the EEA and UK [DECISION: confirm in AdMob settings].

## 3. Apple App Privacy answers

Question 1: "Do you or your third-party partners collect data from this app?" Answer: Yes (the events and the ad SDK).

Definitions used (Apple, [VERIFIED] https://developer.apple.com/support/app-privacy-on-the-app-store): data is "linked to you" unless it is de-identified before collection. "Tracking" means linking app data with third-party data for targeted advertising or advertising measurement, or sharing with a data broker, including SDKs that combine your data with other developers' data for ad targeting even if you do not use it that way.

### 3a. Launch answers (non-personalised ads, no accounts)

| Category > Data type | Collected | Linked to user | Used to track | Purposes | Source |
|---|---|---|---|---|---|
| Identifiers > Device ID | Yes | Yes (random id ties events to one install) | No | Analytics, App Functionality | `sid` in events. [GUESS] Apple's "Device ID" may be meant for hardware or ad ids and "User ID" for an app assigned id. A random install id fits User ID better. Safest is to declare it under Identifiers > User ID; declaring Device ID as well is harmless but more scary |
| Usage Data > Product Interaction | Yes | Yes | No | Analytics | play_tap, host, join, game_start, game_end, power, rated, ad, again |
| User Content > Gameplay Content | Yes | Yes (random player id travels with moves) | No | App Functionality | moves, taunts in rooms. [GUESS] Apple may call real time relay "not collected" if not stored, but the safe answer is to declare |
| User Content > Other User Content | Yes | Yes | No | App Functionality | nickname shown to other players. [GUESS] there is no "nickname" type in Apple's list ([VERIFIED] list: Contact Info has Name; User Content has Other User Content). Do NOT choose Contact Info > Name unless you want to claim real names |
| Usage Data > Advertising Data | Yes (AdMob) | Yes [GUESS] | No [GUESS, see 3c] | Third-Party Advertising | AdMob impression data |
| Identifiers > Device ID (ad SDK) | Yes (AdMob) | Yes [GUESS] | No [GUESS, see 3c] | Third-Party Advertising | only if the SDK touches IDFA or app-scoped ids |
| Location > Coarse Location | Yes (AdMob, from IP) | Yes [GUESS] | No [GUESS] | Third-Party Advertising | the iOS page lists coarse location from IP |
| Diagnostics > Performance Data / Crash Data | Yes (AdMob) | No for crash logs (page says non user related), Yes for performance data (page says user associated) | No | Third-Party Advertising, Analytics | iOS AdMob page |

Not collected: Contact Info, Health, Financial, Contacts, Browsing History, Search History, Purchases (purchases are processed by Apple, we receive nothing), Sensitive Info, Photos, Audio, Body, Surroundings.

### 3b. If you launch WITHOUT ads
Remove every row marked AdMob. The first rows stay. Then say "No tracking".

### 3c. Tracking, ATT and ads [DECISION]
- If the ad SDK is configured to request only non-personalised ads and the native wrapper does NOT call the ATT prompt and does NOT read the IDFA, the cleanest answer is "Data Not Used to Track You". But Apple's text counts an SDK that combines your app data with other developers' data for ad targeting even if you do not use it that way ([VERIFIED]). AdMob can do that by design, so a conservative reviewer may expect either the ATT prompt or "used to track". [UNVERIFIED] whether non-personalised AdMob still counts. Ask AdMob support or test with a privacy tool.
- If you declare tracking you must show Apple's ATT prompt, and "You must receive explicit permission ... via ATT to track" (Apple 5.1.2, [VERIFIED] https://developer.apple.com/app-store/review/guidelines/). Also the app needs an `NSUserTrackingUsageDescription`.
- Safe default for first launch: no ATT prompt, non-personalised ads only, IDFA not read, and tell the form so. Revisit after one release.

### 3d. Other App Store Connect privacy fields
- Privacy policy URL: required, and also reachable inside the app (Apple 5.1.1(i), [VERIFIED]). It is in the `i` sheet today as the "Privacy" link. Put the same URL in App Store Connect.
- The policy must explain retention, deletion and how to request deletion ([VERIFIED] 5.1.1(i)). Today `site/privacy.html` says to "use the contact address on the game's store page". That works only if a support email is on the store page. [DECISION] publish a real support email on the website too.
- Support URL: required [UNVERIFIED], point it at a page with the same email.

## 4. Google Play Data safety answers

General answers ([VERIFIED] https://support.google.com/googleplay/android-developer/answer/10787469 unless marked):
- Does the app collect or share any of the required user data types? Yes.
- Is all of the user data collected by your app encrypted in transit? Yes. The client uses https and wss only (`src/track.js` requires `https://`; Supabase Realtime is wss). AdMob also encrypts in transit (Google Android disclosure page, [VERIFIED]).
- Do you provide a way for users to request that their data is deleted? [DECISION] see section 5. Today a deletion path exists on paper (email) but a user cannot see their random id. Recommended: Yes, with the in-policy statement that clearing app data creates a new anonymous id, and an email address for requests.
- Independent security review, Families commitment: No (Families commitment is for child-directed apps only, and this app is not child-directed, see `age-rating.md`).

### 4a. Launch answers (non-personalised ads, no accounts)

| Data type (Play category) | Collected | Shared | Required or optional | Purposes | Notes |
|---|---|---|---|---|---|
| Personal info > Name | Yes | No (see note) | Optional (a default name is used if blank: `FILL_NAMES` in `quickPlay`) | App functionality | Google defines Name as including a nickname [UNVERIFIED wording]. Nickname goes to Supabase and to other players in the room. Google excludes "service providers that process data only on your behalf" and user initiated transfers from "sharing" ([VERIFIED]). Other players are not the developer's partners, but a stricter reading counts them as a third party. [GUESS] answer "Collected, not shared". Safer alternative: mark shared with purpose App functionality |
| Personal info > User IDs | Yes | No | Required | App functionality, Analytics | random `sid` and `PID` |
| App activity > App interactions | Yes | No | Required | Analytics | events table |
| App activity > Other user-generated content | Yes | No | Required | App functionality | moves and taunt choices in rooms. [GUESS] could also be Other actions |
| App activity > Other actions | Yes | No | Required | Analytics | game results and rating |
| Device or other IDs | Yes | Yes (ads) | Required | Analytics, App functionality (ours); Advertising or marketing (AdMob) | Android ad ID and app set ID from the AdMob page ([VERIFIED]) |
| Location > Approximate location | Yes (AdMob IP) | Yes | Required | Advertising or marketing | [GUESS] the AdMob page lists IP address "may be used to estimate general location"; most developers declare approximate location |
| App info and performance > Diagnostics | Yes (AdMob) | Yes | Required | Advertising, Analytics | AdMob page lists diagnostics |
| App activity > App interactions (AdMob) | Yes | Yes | Required | Advertising or marketing, Analytics, Fraud prevention | AdMob page lists user product interactions |

"Optional" is allowed only if every user can decline and still use the app ([VERIFIED]). The nickname is optional only because a default name is applied.

Not collected: Location precise, Financial info, Health and fitness, Messages (the taunts are 6 fixed emoji, not messages), Photos and videos, Audio, Files, Calendar, Contacts, Web browsing, Installed apps.

Ephemeral processing may let you omit nickname and moves from the public label, because they are used in memory for a real time request and not stored ([VERIFIED] definition). Presence state might be kept by Supabase while a client is connected [GUESS]. Declare them: it costs nothing and cannot be a misstatement.

### 4b. If you launch WITHOUT ads
Remove the AdMob rows (Device IDs shared, Approximate location, Diagnostics, AdMob interactions). Keep own device IDs but no sharing. The listing says "no ads" in the Play Ads declaration.

### 4c. Play Console "Ads" declaration
Play Console > Policy > App content > Ads: "Yes, my app contains ads" for app builds ([VERIFIED] flow: ads declaration is a prerequisite of Target audience, https://support.google.com/googleplay/android-developer/answer/9867159). Only declare "No ads" for an ad-free build.

## 5. Things that change if the product changes

| Change | Apple App Privacy | Google Data safety | Other effects |
|---|---|---|---|
| Personalised ads enabled | Tracking likely becomes Yes: Device ID and Advertising Data used to track. Add ATT prompt and `NSUserTrackingUsageDescription`. IDFA collected. Add Advertising Data purposes "Third-Party Advertising" and possibly "Developer's Advertising or Marketing" | Advertising ID shared for Advertising or marketing; add Personalization purpose if used. Add UMP consent for EEA and UK. Check the Android manifest `AD_ID` permission | Update `privacy.html` (it promises "this page will name that provider"). Do not allow personalised ads if the app might count as directed to children (see `age-rating.md`) |
| Guest or full accounts enabled (`supabase/schema.sql`) | Add Identifiers > User ID (account id) linked, Contact Info > Name or Email if collected, User Content. Add account deletion inside the app (Apple 5.1.1(v), [VERIFIED]). If any third party login is the main login, add Sign in with Apple style option (Apple 4.8, [VERIFIED]) | Personal info > User IDs, Name, Email address; declare "Account management" purpose; provide an in-app and web deletion path | `privacy.html` and `terms.html` rewrite. Coins and wins become server data: update "stored only on device" text. Guideline 5.1.1(v) text: "If your app doesn't include significant account-based features, let people use it without a login" ([VERIFIED]): keep anonymous play working |
| Free text chat or custom names filtering removed | Messaging and Chat yes. User Content rows stay | Messages > Other in-app messages | Apple 1.2 moderation tools become mandatory (filter, report, block, contact, [VERIFIED]); age rating likely rises |
| Coins or remove ads sold for money | Purchases: only if you record purchase history yourself | Financial info > Purchase history only if collected by you | Apple 3.1.1: use in-app purchase for coins or powers, coins may not expire ([VERIFIED]). Today coins come only from winning, which is fine |
| Rating or leaderboard moves to a server | User Content > Gameplay Content linked to User ID | App activity | A public leaderboard shows nicknames to strangers: UGC rules apply |
| Crash reporting SDK added | Diagnostics > Crash Data | App info and performance > Crash logs | Update both forms before shipping that build |
| Contact for analytics deletion | none | Deletion request answer | Add a delete-by-id path or a 90 day auto delete |

## 6. Problems found in the repo while preparing these answers (report, not fixed)

1. `supabase/events.sql` check constraint lists `ev in ('open','play_tap','host','join','practice','game_start','game_end','leave','power','again','ad','noads')`, but `src/rating.js` sends `track('rated',...)`. That row would be rejected by the database (the client ignores errors), so rated results are silently not recorded. Either add `'rated'` to the constraint or remove the call.
2. `site/privacy.html` says "If ads are shown ... this page will name that provider". Name AdMob (Google) before launch.
3. `site/privacy.html` does not mention the rating number and gameplay events by name, nor that the connection IP address reaches Supabase and GitHub Pages (it does mention GitHub Pages logs). Recommended wording edits: list "rating after a game" among events; state a retention period; give a contact address in the page itself.
4. `site/privacy.html` says "To ask about ... deletion of statistics tied to your device ID, use the contact address on the game's store page." The player cannot see the random id. Either show it somewhere (not in the main UI, owner rule: no extra labels) or state that events cannot be linked back to a person and are deleted after 90 days.
5. Names are filtered with a short word list only in public Play (`tameName`, `G.pub`). Friends rooms accept any name. See `review-notes.md` for the moderation risk.
