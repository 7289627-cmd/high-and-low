# App Review notes and rejection-risk list

Tags: [VERIFIED] read on the official page 2026-11-14. [UNVERIFIED] not confirmed on an official page. [GUESS] my judgement. Guideline text quoted from https://developer.apple.com/app-store/review/guidelines/ unless another link is given. Section 4.3 (copycat) and 4.2.x details beyond 4.2 and 4.2.2 were not in the text I could read.

## 1. Text to paste into App Store Connect "Notes for Review" (also usable for Play "App access")

```
High & Low is a free, anonymous number guessing game. There is no account, no login and no demo account is needed.

How to reach a game in under 15 seconds:
1. Open the app. Optionally type a nickname (a random one is used if blank).
2. Tap the big "Play" button. Do not change the range.
3. Within about 7 seconds an opponent is placed in the room and the game starts. Because few players are online during review, the opponent is usually a computer player. This is intended and disclosed: tap the small "i" button on the home screen, it says "Open seats in Play are filled by bots." The App Store description says the same.
4. Pick a secret number on the pad, then follow the turn prompts: ask "higher or lower than X?" then guess. The slapstick cartoon knockout scenes (anvil, piano, number monster and so on) appear when a guess is right or hearts run out.

To see multiplayer rooms alone: Home > "Play with friends" > "Host a game". In the lobby tap "+ Add a bot" to add computer players (they carry a BOT tag), then start. To test two real players, install on two devices and use the 4 letter room code or the invite link.

Internet is required. Without a connection the app shows a "no connection" screen. This is expected. The backend (Supabase realtime) is live for review.

Chat: there is no chat. Players can only send one of six fixed emoji taunts.
User names: players choose a 12 character nickname which other players in the same game can see. Public Play filters offensive names with a word list, and abusive names can be reported from [FILL IN: see risk R1].
In the ads-only build, a full-screen ad can appear at the results screen after each completed match, including the first. Dismiss the ad to view the score or play again.
Privacy policy and terms are linked from the "i" sheet and from the store page.
Support contact: [FILL IN support email]
```

Why each line is there:
- "No login": avoids a request for demo credentials (Apple 2.1(a) asks for demo account info only if the app includes a login, [VERIFIED]).
- "Backend is live": Apple asks you to "Enable backend services so that they're live and accessible during review" (2.1, [VERIFIED]). See R3.
- The bot sentence: reviewers who see an opponent named like a human who never chats may wonder. Hidden fill-ins carry no BOT tag in game (`p.bot&&!p.hb` in `src/main.js`), so the tell is the "i" sheet, the store description and these notes.

## 2. Where bots are disclosed today (and where they are not)

| Place | Status |
|---|---|
| "i" sheet on home: "Open seats in Play are filled by bots." (`src/main.js`, `infoBtn` handler) | Disclosed |
| `site/privacy.html` section "Bots": "When you tap Play, empty seats are filled by computer players." | Disclosed |
| Friends lobby: bots added by the host show a BOT tag | Disclosed |
| In a Play game, hidden fill-in bots (`hb:1`) show no BOT tag, they have human style names (`nmMake`) and taunt (`botlife.js`) | Not tagged, by owner decision (hidden fill-ins allowed) |
| Rating: `eloApply` runs for a 2 player public game even if the opponent is a fill-in, so rating can move after a game against a bot | Not disclosed anywhere beyond the generic bot line |
| Store description | Added in `listing.md` |

[DECISION] To lower reviewer and user complaint risk, either (a) add one more sentence to the description and notes: "Rated matches can be against computer players", already included in the notes above in spirit, or (b) show a BOT tag after the game ends. Do not change gameplay for review. The owner standing rule is hidden fill-in bots are allowed, so this file only keeps the disclosure strong.

## 3. Likely rejection reasons and mitigations

Ordered by my estimate of likelihood for this app [GUESS].

### R1. Guideline 1.2 User-Generated Content (Apple)
- Rule ([VERIFIED]): apps with UGC must include "A method for filtering objectionable material", "A mechanism to report offensive content and timely responses", "The ability to block abusive users", and "Published contact information". Also "random or anonymous chat" experiences "may be removed".
- This app: strangers matched at random see a nickname (12 chars) and fixed emoji. No chat. But the nickname is free text shown to strangers.
- Gaps found in the code: filter exists only in public Play (`tameName`, a 25 word list, matches substrings after stripping non letters), not in friends rooms; no Report button; no Block; no published contact email in the app (privacy page says "contact address on the game's store page").
- Mitigations, in order of effort: (1) Publish a support email on the website and in the store fields. (2) Apply `tameName` to friends rooms too, and add look-alike checks (leetspeak). (3) Add a "Report" action on the result sheet that records the opponent's player id (a small `events`-like table) and a "Block" that skips that id in `quickPlay` matching, kept hidden inside existing sheets so it adds no new UI labels beyond one word. (4) In the review notes explain there is no free text chat and the nickname is the only UGC.
- [DECISION] items 2 and 3 are code changes outside this documents-only task. Without them expect a 1.2 rejection or a question from the reviewer; Apple may accept a written explanation, which is [UNVERIFIED].

### R2. Guideline 4.2 Minimum Functionality ("repackaged website") 
- Rule ([VERIFIED]): "Your app should include features, content, and UI that elevate it beyond a repackaged website."
- This app: the game is a single HTML file (`site/index.html`) wrapped as an app. Risk is real for thin wrappers.
- Mitigations: ship native bits that the wrapper already plans (`HLNative` ads, in-app purchase), haptics (`buzz` in code), app icon, splash, offline screen, and say in the notes that gameplay (rated matchmaking, realtime rooms, animations, sound) is the product. Also bundle all fonts, sounds and art inside the app instead of loading them from the website [GUESS: not checked whether the wrapper does this]. Test in airplane mode: the app should open to the "no connection" screen, not a blank page or a browser error.

### R3. Guideline 2.1 App Completeness: backend must be live
- Rule ([VERIFIED]): "Enable backend services so that they're live and accessible during review."
- Risk: Supabase project paused or rate limited during review means Play and rooms show an error. Free tier projects can pause when inactive [UNVERIFIED, check the Supabase dashboard].
- Mitigations: check the project is active on the submission day, run `timeout 200 node mp_web.js`-style smoke test against production, keep the notes line about internet. Fallback exists: if the queue is unavailable the game starts a public round with bots (`startSolo(true)` in `quickPlay`), so Play still opens a game.

### R4. Apple 2.5.18 Advertising
- Rule ([VERIFIED]): ads must be appropriate for the app's age rating (13+ here), interstitials "must clearly indicate that they are an ad", "must not manipulate or trick users", "must provide easily accessible and visible close/skip buttons", and apps with ads "must let users report inappropriate or age-inappropriate ads".
- Check the AdMob content rating and the ad's close and report controls. On a device, verify that an interstitial appears only at a completed match, dismisses to that result, and lets the player continue when no ad is available.

### R5. Guideline 3.1.1 In-App Purchase: restore
- Rule ([VERIFIED]): apps need "a restore mechanism for any restorable in-app purchases", and purchases must not use outside mechanisms to unlock features.
- Gap: `HLAds.sync()` checks ownership at launch, but the "i" sheet has no "Restore purchases" button (it only shows "Remove ads" while not owned). Apple reviewers often look for it.
- Mitigation: [DECISION] add a Restore button in the "i" sheet when `HLNative.ownsNoAds` exists, or make sure `ownsNoAds` runs on every launch and mention it in the notes. Apple 2.1(b) also requires IAP to be "complete, up-to-date, visible to the reviewer and functional" ([VERIFIED]), so create the product in App Store Connect and attach it to the version before submitting. If the first release has no purchase, remove the "Remove ads" mention.

### R6. Guideline 5.1.1 and 5.1.2 Privacy
- Rules ([VERIFIED]): privacy policy link in the metadata and inside the app; the policy must explain collection, uses, retention, deletion and how to request it; consent for data collection; no tracking without ATT permission.
- Gaps: policy lacks a contact email on the page itself, a retention period, and the ad provider's name (it promises to name one). Fix the policy before submission. App Privacy labels must match `privacy-answers.md`.
- If you answer "tracking: no" but the ad SDK can access IDFA, reviewers may flag a mismatch. Keep ATT off and IDFA unused, or declare tracking and show the ATT prompt.

### R7. Metadata accuracy and copycat names (Apple 5.2, 2.3.x)
- Rule ([VERIFIED] 5.2): avoid "misleading, false, or copycat names and metadata". Several apps use "High Low" names, see `listing.md`. A bare "High & Low" title is the highest risk.
- Mitigation: the "High & Low: Number Duel" style name; screenshots show only real UI; no "#1" or "number one" claims; no mention of other apps' names.

### R8. Apple 1.1.2 and screenshot content
- Rule ([VERIFIED]): "Realistic portrayals of people or animals being killed, maimed, tortured, or abused" are not allowed. Also 2.3.8 says screenshots should adhere to a 4+ rating, for example no "gruesome death".
- Mitigation: the death scenes are cartoon objects falling on cartoon beans. In the review notes call them "slapstick cartoon knockouts". Use mild frames in screenshots. Rate honestly (Frequent cartoon violence, `age-rating.md`).

### R9. Google Play: target audience and ads, closed testing
- Target audience and Families: see `age-rating.md` section 4. Wrong answers lead to a policy flag.
- A new personal developer account must run a closed test with at least 12 opted-in testers for 14 continuous days before it can apply for production access ([VERIFIED] https://support.google.com/googleplay/android-developer/answer/14151465). Google usually answers the production application within 7 days ([VERIFIED]). Plan 3 weeks for Android.
- Data safety must match code and AdMob disclosures ([VERIFIED] https://support.google.com/googleplay/android-developer/answer/10787469).
- Play UGC policy page could not be opened here, so what Play requires for nicknames (report or block tools) is [UNVERIFIED]. Read https://support.google.com/googleplay/android-developer/answer/9876937 before submission and treat R1 as applying on Play too.

### R10. Account rules that do not apply today
- 4.8 Login Services applies only if third party login is the main login. There is no login, so it does not apply ([VERIFIED] text: it covers apps "offering third-party or social login as the primary account login").
- 5.1.1(v): account deletion in app applies only if the app supports account creation. It does not today ([VERIFIED]). It will apply if guest accounts are added (`supabase/schema.sql` is prepared for this). Say "no accounts" in the notes.

### R11. Content that could surprise a reviewer
- Emoji taunt "🙏" and "😈": fine.
- Coin and power system: coins come only from winning, cannot be bought. Apple 3.1.1 and 5.3 would matter if coins were sold or if a lottery element existed ([VERIFIED]). Keep it that way; do not add paid coins without re-reading 3.1.1 (coins may not expire).
- Wheel that decides who goes first: it is a turn order animation, not gambling. Say so in the notes if asked.

## 4. Quick reviewer FAQ (keep ready for a reply in Resolution Center)

| Question | Answer |
|---|---|
| Is the opponent a real person? | In Play, if no real player is waiting for a few seconds, a computer player fills the seat. The About sheet and the description say so. In friends rooms players are real, plus any bots the host adds (tagged). |
| Is there chat or free text between users? | No. Only a 12 character nickname and six fixed emoji. |
| Is there an account? | No. A random id is kept on the device. |
| What data is sent? | Nickname and moves to other players in the same room, anonymous play events with a random id to our Supabase project, ad SDK data in app builds. See the App Privacy labels. |
| Is it for children? | No. Target is 13 and older. |
| Does the app need internet? | Yes, stated in the description and shown by an on-screen message when offline. |
