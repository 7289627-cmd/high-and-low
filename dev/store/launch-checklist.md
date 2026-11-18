# Launch checklist: developer accounts to public release

Tags: [VERIFIED] read on the official page 2026-11-14. [UNVERIFIED] not confirmed. [DECISION] owner chooses. Each item has a finish line: a thing you can point at to say it is done. Dates assume today is 2026-11-14. Android takes the longest, so start it first.

## Phase 0: Decisions (before spending money)

- [ ] 0.1 Decide the seller identity: personal or organization (company name appears on both stores). Finish line: one line written down, "Seller: ____". Why: the 12 tester closed test rule is documented for personal accounts ([VERIFIED] https://support.google.com/googleplay/android-developer/answer/14151465); whether an organization account skips it is [UNVERIFIED]. An organization needs a D-U-N-S number that can take up to 28 days ([VERIFIED] https://support.google.com/android-developer-console/answer/16561738). A personal account shows your legal name on the store [GUESS].
- [ ] 0.2 Decide launch scope: ads on or off, "Remove ads" purchase on or off, personalised ads off. Finish line: a yes/no for each. This drives `privacy-answers.md` (section 3a vs 3b, 4a vs 4b).
- [ ] 0.3 Decide the app name from `listing.md` section 3 and check availability. Finish line: the chosen name reserved in App Store Connect (it rejects a taken name) and a Play title chosen.
- [ ] 0.4 Decide the support email and a real support page. Finish line: an email address that receives mail, and a page on the game website that shows it. Needed for Apple Support URL, Apple 1.2 "published contact information" ([VERIFIED]) and the privacy policy.

## Phase 1: Developer accounts (start both on day 1)

- [ ] 1.1 Apple Developer Program enrolment. Finish line: App Store Connect opens and you can create an app record. Cost is $99 per year [UNVERIFIED, the Apple membership page could not be opened here]. Organization enrolment needs a D-U-N-S number [UNVERIFIED]. Allow days for approval.
- [ ] 1.2 Google Play Console account. Finish line: Play Console dashboard opens. Fee $25 one time, identity verification with government ID and a card in your legal name, no prepaid cards ([VERIFIED] https://support.google.com/googleplay/android-developer/answer/6112435). A personal account must also verify access to an Android device in the Play Console mobile app and complete the testing requirement before publishing ([VERIFIED] same page).
- [ ] 1.3 Android developer verification. Finish line: your identity is verified and the app registered in the Android developer console. Google says developers must verify and register apps by a September 2026 deadline or the apps become unavailable for new installs on certified devices in the first countries (Indonesia, Singapore, Thailand from 2026-09-30), expanding globally in 2027 ([VERIFIED] https://support.google.com/android-developer-console/answer/16561738). That date has passed, so check that Play Console completes this for you, and register the final app id before launch.
- [ ] 1.4 Tax and banking forms on both stores. Finish line: both consoles show tax and payout as complete. Needed even for free apps if you ever sell the ad removal purchase [GUESS].

## Phase 2: Legal pages and backend

- [ ] 2.1 Fix `site/privacy.html` (list from `privacy-answers.md` section 6): name AdMob if ads ship, list the rating event, retention period, contact email, how deletion requests work. Finish line: the page has a "Last updated" date after the edits, loads at its public https URL, and mentions every data type in the forms.
- [ ] 2.2 Fix `supabase/events.sql` mismatch: allow `'rated'` or delete the call. Finish line: a test insert of every event name the client sends succeeds with the anon role (do this on a test project, not production). Not a document change, so hand it to the lead.
- [ ] 2.3 Retention job for `events` (delete rows older than 90 days) [DECISION]. Finish line: a scheduled job exists and the privacy policy states the period. Google's deletion badge also counts data auto deleted or anonymized within 90 days ([VERIFIED] data safety page).
- [ ] 2.4 Production backend health. Finish line: Supabase project active (not paused, [UNVERIFIED] free tier pausing), realtime enabled, and a smoke test shows two phones joining one room. Repeat on submission day and during review.
- [ ] 2.5 Moderation basics for Apple 1.2 (see `review-notes.md` R1): filter in friends rooms, report, block, contact. Finish line: reviewer notes can truthfully list each of the four items ([VERIFIED] the four requirements), or the decision to ship without them is recorded with the risk accepted.

## Phase 3: Ads and purchases (skip if 0.2 says no ads)

- [ ] 3.1 AdMob account and two app entries (iOS, Android). Finish line: two AdMob app ids and one interstitial ad unit per platform.
- [ ] 3.2 Consent: Google UMP message for EEA and UK, created in AdMob. Finish line: the message shows on a test device in a test EEA location and the ad request is blocked or limited until you answer. Needed because without a Google certified consent tool only limited ads serve in the EEA and UK from 2024-01-16 ([VERIFIED] https://developers.google.com/admob/ios/privacy/gdpr?hl=en).
- [ ] 3.3 ATT decision (iOS). Finish line: either no ATT prompt and no IDFA read with App Privacy "no tracking", or an ATT prompt string plus "tracking yes". See `privacy-answers.md` 3c.
- [ ] 3.4 Ad content settings. Finish line: AdMob blocked categories set for a 13+ audience, child-directed tag off [GUESS about setting names].
- [ ] 3.5 "Remove ads" product on both stores. Finish line: product created in App Store Connect and attached to the version, and in Play Console, status active, tested with a sandbox or license tester account, and a Restore path decided (`review-notes.md` R5, Apple 3.1.1, [VERIFIED]).
- [ ] 3.6 Ads-only build. Finish two matches on a device. A ready interstitial should appear once as each result opens. Verify that closing it returns to that result, exiting a match early skips the ad, and the results controls work when an ad is unavailable.

## Phase 4: Builds

- [ ] 4.1 Build the web product: `python3 build.py web`. Finish line: `site/index.html` built, quick checks from `COMMON.md` all print PASS.
- [ ] 4.2 Wrap for iOS and Android (Capacitor or similar) with bundle id and package name from 0.3, icons, splash, haptics. Finish line: the app installs on a real iPhone and a real Android phone and reaches the home screen in airplane mode with the "no connection" panel (R2).
- [ ] 4.3 Test matrix on devices. Finish line: one signed-off table of at least: small iPhone, large iPhone, one Android 8 to 10 year old, one recent Android; Play game start, friends room with two phones, rating changes, sound, ads, rotate or lock. 
- [ ] 4.4 Final privacy self-audit: capture traffic from a build with a proxy. Finish line: the only hosts contacted are your Supabase project, the ad network (if enabled) and fonts or assets you intended, and each request matches a row in `privacy-answers.md` section 1.

## Phase 5: Store content

- [ ] 5.1 Icons and art. Apple icon 1024x1024 [UNVERIFIED size], Play icon 512x512 PNG 32-bit with alpha under 1024 KB, Play feature graphic 1024x500 no alpha ([VERIFIED] https://support.google.com/googleplay/android-developer/answer/9866151). Finish line: files exist and pass the console upload check.
- [ ] 5.2 Screenshots. Finish line: 6 portrait shots per store with the captions in `listing.md` section 9 (Apple allows up to 10, Play 8, minimum 2 for Play, [VERIFIED]). Apple exact device sizes [UNVERIFIED]: open https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/ and match the current required size set.
- [ ] 5.3 Listing text pasted. Finish line: name, subtitle, promotional text (170), keywords (100), description for Apple; title, short description (80), full description for Play, all showing within limits in the consoles ([VERIFIED] limits in `listing.md` section 1).
- [ ] 5.4 URLs. Finish line: privacy policy URL, support URL, marketing URL (optional) saved in Apple and Play; the Play data safety form links the privacy policy ([VERIFIED], required even if no data collected).
- [ ] 5.5 Copyright and credits. Finish line: the "i" sheet credit lines match the licenses (Kenney, rubberduck CC0, FluidR3 CC BY 3.0), as in `site/terms.html`.

## Phase 6: Forms

- [ ] 6.1 Apple App Privacy. Finish line: all rows from `privacy-answers.md` 3a (or 3b) entered; "Publish" clicked; the preview label looks as expected ([VERIFIED] can be edited anytime without a new build).
- [ ] 6.2 Apple age rating questionnaire. Finish line: answers from `age-rating.md` section 2 saved, resulting rating shown (expect 13+ [GUESS]). Not Kids Category.
- [ ] 6.3 Play Data safety. Finish line: form submitted matching `privacy-answers.md` 4a (or 4b); CSV export saved in the repo as a record.
- [ ] 6.4 Play Ads declaration. Finish line: "contains ads" set as decided in 0.2 ([VERIFIED] this must be completed before the target audience form).
- [ ] 6.5 Play target audience and content. Finish line: age groups 13 and over only, no Families program, store presence not marketed to children (`age-rating.md` section 4); Google may take up to 7 days to review ([VERIFIED] https://support.google.com/googleplay/android-developer/answer/9867159).
- [ ] 6.6 Play content rating (IARC). Finish line: Summary page shows a rating, submitted; save a screenshot of the result.
- [ ] 6.7 Apple export compliance and other App Store Connect prompts. Finish line: encryption question answered (the app uses HTTPS only, standard exempt answer [UNVERIFIED]), content rights confirmed, no IDFA answer matches 3.3.

## Phase 7: Testing tracks

- [ ] 7.1 iOS TestFlight internal test. Finish line: a build uploaded, installed on at least 2 devices by you and friends, a full online game played between two real phones.
- [ ] 7.2 Android internal test. Finish line: build in the internal track, installed on 2 phones, passes the same game.
- [ ] 7.3 Android closed test (required for new personal accounts). Finish line: 12 or more testers opted in and staying opted in for 14 consecutive days; testers who leave and rejoin restart the count ([VERIFIED] https://support.google.com/googleplay/android-developer/answer/14151465). Recruit 15 to 20 to be safe. Start this the day the account exists, because the 14 days cannot be shortened.
- [ ] 7.4 Apply for Android production access. Finish line: the "Apply for production" form filled (about the closed test, the app, readiness) and submitted; answer arrives usually within 7 days ([VERIFIED] same page).
- [ ] 7.5 Fix feedback from testers. Finish line: a list of reported bugs with each closed or consciously deferred, and a new build uploaded if anything changed.

## Phase 8: Submit

- [ ] 8.1 Apple: attach the build, paste review notes from `review-notes.md` section 1 (fill the placeholders), attach the IAP if any, choose release option "Manually release". Finish line: status "Waiting for Review". Guideline checks to read once more first: 1.2, 2.1, 2.5.18, 3.1.1, 4.2, 5.1.1, 5.1.2, 5.2 ([VERIFIED] all on the guidelines page).
- [ ] 8.2 Google: create the production release, choose countries, submit for review. Finish line: status "In review".
- [ ] 8.3 Watch for rejections. Finish line: reply to any message within 24 hours using the answers in `review-notes.md` section 3 and 4. Keep the Supabase project awake and the support inbox watched.

## Phase 9: Public release

- [ ] 9.1 Approval on both stores. Finish line: Apple "Pending Developer Release" and Play "Available" in review, with the privacy labels still matching the shipped build.
- [ ] 9.2 Release. Finish line: both listings are searchable and installable from a clean device (not a tester), the game connects and starts a Play match, and the privacy and terms links open.
- [ ] 9.3 Day 1 monitoring. Finish line: the Supabase `stats_daily` view shows opens and `game_start` rows from real installs; no flood of errors; support email answered.
- [ ] 9.4 Rolling out ads or accounts later. Finish line: before enabling personalised ads or accounts, update the privacy forms, `privacy.html` and consent flows as listed in `privacy-answers.md` section 5, then ship the update.
