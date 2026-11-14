# Age ratings: Apple and Google Play (IARC)

Tags: [VERIFIED] read on the official page 2026-11-14. [UNVERIFIED] from memory. [GUESS] my judgement. The exact wording of both questionnaires could not be read in full (Apple's page text was cut off and Play's questionnaire is only visible inside Play Console), so the answers below follow the category names and tier tables that were readable. Re-read each question in the portal and keep the intent of these answers.

## 1. The content to rate (from the code)

- Characters: cartoon "beans". Losing all hearts or being hit by a correct guess triggers a death scene.
- Death scenes (`DEATHS`, `CAPTION` in `src/base.js`): anvil, zap (grumpy cloud), rocket (firework into space), chomp (number monster), melt, pop (pumped up), piano, banana peel, bees, calculator. Each is slapstick: no blood, no gore, no realistic people or animals, no weapons. The captions are jokes ("got flattened by a falling grand piano").
- Frequency: every finished game contains at least one death scene (the loser's), and a 6 player friends game contains several. So violence is part of the core loop, not rare.
- Text from users: only the nickname (max 12 characters, `maxlength="12"`), shown to the people in the same game. Public Play filters it with a short word list (`BAD` and `tameName` in `src/main.js`), friends rooms do not filter.
- No chat. Taunts are 6 fixed emoji (`TAUNTS`).
- No gambling. Coins come only from winning (not purchasable), there is no real money, no loot box, no random paid reward.
- No sexual content, no profanity in the game text, no alcohol, tobacco, drugs, no horror (death scenes are comedic), no medical or wellness topics.
- No web view, no browsing (the privacy and terms links open the website in the system browser [GUESS, depends on wrapper; if they open in an in-app web view limited to those two pages, it still is not "unrestricted web access"]).
- Ads: interstitials from AdMob between games in app builds.
- No parental controls, no age assurance.
- Online play with strangers (random matchmaking in Play).

## 2. Apple age rating questionnaire (App Store Connect > App Information)

Apple moved to ratings 4+, 9+, 13+, 16+, 18+ in 2025. Everyone had to answer the new questions by 2026-01-31, so a new app will see them ([VERIFIED] https://developer.apple.com/news/?id=ks775ehf). The new sections are In-App Controls, Capabilities, Medical or Wellness, and Violent themes ([VERIFIED] same). Tier mapping used below is from [VERIFIED] https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions (as summarised by the fetch tool; the tool noted it was inferring options).

| Section | Question | Proposed answer | Why |
|---|---|---|---|
| In-App Controls | Parental Controls | No | none built |
| In-App Controls | Age Assurance | No | none built |
| Capabilities | Unrestricted Web Access | No | no browser |
| Capabilities | User-Generated Content | Yes [DECISION, see note A] | nicknames shown to other players. Apple defines UGC as content created by users and broadly distributed as part of the intended experience, examples videos, photos, text, audio |
| Capabilities | Social Media | No | no feed, profile, follow or post |
| Capabilities | Messaging and Chat | No | no free text. Fixed emoji taunts only. Apple lists text, voice, video, direct or group messaging and public posting as chat, none exist here |
| Capabilities | Advertising | Yes in app builds, No for ad-free build | AdMob interstitials |
| Mature Themes | Profanity or Crude Humor | None | |
| Mature Themes | Horror or Fear Themes | None | slapstick, not horror |
| Mature Themes | Alcohol, Tobacco, Drugs | None | |
| Medical or Wellness | all | None | |
| Violent themes | Cartoon or Fantasy Violence | Frequent [DECISION, see note B] | death scene in every game |
| Violent themes | Realistic Violence | None | |
| Violent themes | Guns or Weapons | None | an anvil, piano and calculator are objects, not weapons [GUESS], no firearms or knives |
| Gambling | Simulated or real gambling, contests | None | no casino, no betting, no prizes |
| Sexual | all | None | |

Apple's rule of thumb: the rating is the strictest tier reached by any answer ([VERIFIED] the tables imply this). From the table text: cartoon or fantasy violence Infrequent gives 9+, Frequent gives 13+. UGC, Messaging, Advertising and Parental controls sit in the 4+ list and do not raise the rating on their own ([VERIFIED]).

Note A: UGC. Answering Yes is the honest, conservative answer (strangers see your nickname). Answering No could be seen as a misstatement if a reviewer finds an offensive nickname. Yes does not raise the tier but it invites Apple Guideline 1.2 checks (see `review-notes.md`).

Note B: cartoon violence frequency. Apple defines the frequency words only as "Infrequent (or mild)" and "Frequent (or intense)", with no counts ([VERIFIED], the tool said thresholds are not given). Because a death scene is in every game, "Frequent" is the answer I can defend. If the owner answers "Infrequent" to get 9+, Apple could change it in review and the rating shown to buyers would flip. [DECISION] My advice: answer Frequent.

Likely Apple result: 13+ (global). [GUESS] derived from the tier table, the portal shows the real result before you submit. Region specific ratings (Australia, Brazil, Korea, Vietnam) can differ ([VERIFIED]).

If you want a higher minimum age than Apple assigns you can raise it after the questions ([VERIFIED] news page). Not needed.

## 3. Google Play content rating (IARC questionnaire)

Where: Play Console > Policy > App content > Content rating > Start. Enter an email, choose a category, answer the questionnaire, then Submit ([VERIFIED] https://support.google.com/googleplay/android-developer/answer/188189). Misstating content can cause removal or rejected updates ([VERIFIED]). The summary rating on that page may differ from what users see, and authorities can override ([VERIFIED]).

Category: Game (not "Social" or "Communication").

Proposed answers [UNVERIFIED wording, the IARC questions are only visible in the console; these follow IARC's usual topics]:

| Topic | Answer |
|---|---|
| Violence: does the game contain violence | Yes, cartoon or fantasy only, no blood, no realistic depiction, no human like characters being hurt [GUESS: the beans are cartoon creatures, not realistic people] |
| Blood or gore | No |
| Sexual content or nudity | No |
| Profanity or crude humor | No |
| Controlled substances (drugs, alcohol, tobacco) | No |
| Gambling (real or simulated) | No |
| Horror or fear | No |
| Users can interact or exchange content | Yes for interaction (they play together and see nicknames and fixed emoji taunts). No user to user free text, images or voice. Share location: No |
| Digital purchases | Yes if "Remove ads" is shipped in this build (one-time purchase), else No |
| Does the app share the user's location with others | No |
| Does it include unrestricted web access | No |

Likely results [GUESS, check the Summary page]: ESRB Everyone 10+ (fantasy violence), PEGI 7 (non realistic violence towards fantasy characters; Play's own doc says PEGI 12 is for "more graphic violence toward fantasy characters", [VERIFIED] https://support.google.com/googleplay/answer/6209544), USK 6 or 12, and IARC generic 7+ or 12+ elsewhere. Play will also show interactive element labels such as "Users Interact" and "In-app purchases" [UNVERIFIED: the Play page said it could not confirm these exact labels, but said interactive features are shown under "Read more", [VERIFIED]].

Important: a content rating is a minimum maturity level, not the age the app is designed for ([VERIFIED] https://support.google.com/googleplay/answer/6209544). Target audience is a separate form, see section 4.

## 4. Risk: being treated as children directed, and how to avoid it

Why it can happen: bright cartoon beans, hats, slapstick, simple UI, and a casual game category all look like a kids app. A children-directed or mixed-audience classification would break the current plan.

What happens if it does ([VERIFIED] unless marked):

Google Play (https://support.google.com/googleplay/android-developer/answer/9867159):
- If target age includes children under 13, the app must follow the Families Policy and may serve ads only from Families Self-Certified Ads SDKs. Standard AdMob personalised or non-personalised serving would not qualify unless set up under that program.
- Mixed audience apps need a neutral age screen so unsuitable ads show only to older users.
- Personal information from children must be disclosed and, where required, collected with parental consent.
- "Youthful marketing in the store listing can lead to rejection."
- Age groups on the form: 5 and under, 6-8, 9-12, 13-15, 16-17, 18 and over. Choose multiple groups only if the app is designed for each of them.

Apple (https://developer.apple.com/app-store/review/guidelines/):
- Kids Category apps may not include third party analytics or third party advertising (1.3, 5.1.4(a), with narrow exceptions) and may not send personal or device information to third parties. This app does both (Supabase analytics with a device id, AdMob).
- Apps outside the Kids Category cannot use names, subtitles, icons, screenshots or descriptions that imply a child audience (5.1.4, 2.3.8).
- COPPA and similar laws still apply to apps that collect personal information from minors. The privacy policy currently says "not directed at children under 13".

How to avoid a children-directed classification (all of these are within the owner's control):

1. Google target audience: select only 13-15, 16-17 and 18 and over. Do not select anything under 13. (Selecting extra groups only to widen reach is not allowed, [VERIFIED].) If you want to be safest, choose 16 and over [DECISION].
2. Apple: do not choose Kids Category and not Games > Family. Answer the age questionnaire honestly (Frequent cartoon violence leads to 13+, which is itself a barrier to "for kids"). Do not set an Apple minimum age lower than the result.
3. Never use "kids", "children", "family friendly", "for all ages", "parents will love", or a toy look in names, subtitles, descriptions, screenshots or feature art. `listing.md` follows this.
4. Keep the privacy policy and terms line "not directed at children under 13". Consider adding "You must be 13 or older" in the terms [DECISION; do not add text to the game UI, owner rule].
5. Do not add an age gate in the game unless you go mixed audience. A free-entry birthday field is the Google example of a neutral age screen, a prefilled one is not ([VERIFIED]). Using one would also add data collection.
6. Store art: keep the stylised outline look (it is an adult friendly cartoon style) but avoid baby colors, a mascot hugging, balloons or school themes in screenshots.
7. Ads: AdMob setting "tag for child directed treatment" and "tag for under age of consent" should be left off for an adult target. Block ad categories that are inappropriate for teens in AdMob (Apple 2.5.18 says ads must be appropriate for the app's age rating, [VERIFIED]).
8. Monitor: the Play review of the target audience can take 7 days or longer, and Google "reviews the disclosed audience for accuracy" ([VERIFIED]). If Google flags it, they can ask you to switch to a Families setup. Expect that message and keep an answer ready: "13+ target, cartoon style is an art choice, cartoon violence is in the content rating".

Residual risk: a 13+ target with cartoon beans may still draw younger players. That is the same position as many 13+ casual games. The risk of getting flagged is real but low if the points above are followed [GUESS].

## 5. Summary of proposed results

| Store | Questionnaire result | Target audience | Kids program |
|---|---|---|---|
| Apple | 13+ (cartoon violence frequent) [GUESS from tables] | not a setting on Apple, set by rating | Not in Kids Category |
| Google Play | ESRB E10+ / PEGI 7 or 12 [GUESS] | 13 and over (or 16 and over) | No Families program |
