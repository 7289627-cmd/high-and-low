# Store listing kit: High & Low

Status tags used below: [VERIFIED] means read on the official page on 2026-11-14. [UNVERIFIED] means from memory or a non-official page, check before relying on it. [GUESS] is my judgement.

All copy avoids em dashes, and every claim is backed by the code in `src/` (checked list at the bottom).

## 1. Limits that apply

| Field | Limit | Source |
|---|---|---|
| Apple app name | 30 characters | [VERIFIED] https://developer.apple.com/app-store/product-page |
| Apple subtitle | 30 characters | [VERIFIED] same page |
| Apple promotional text | 170 characters | [VERIFIED] same page |
| Apple keywords | 100 characters total, comma separated, no spaces | [VERIFIED] same page |
| Apple description | 4000 characters | [UNVERIFIED] the Apple page above does not state it |
| Apple screenshots | up to 10 per product page, up to 3 app previews of 30 s | [VERIFIED] same page. Pixel sizes: [UNVERIFIED], the specs page (developer.apple.com/help/app-store-connect/reference/screenshot-specifications/) could not be opened here |
| Play app title | 30 characters | [UNVERIFIED] not stated on the Play assets page, widely quoted |
| Play short description | 80 characters | [VERIFIED] https://support.google.com/googleplay/android-developer/answer/9866151 |
| Play full description | 4000 characters | [UNVERIFIED] not stated on that page |
| Play icon | 512 x 512 PNG, 32-bit with alpha, max 1024 KB | [VERIFIED] same page |
| Play feature graphic | 1024 x 500 JPEG or 24-bit PNG, no alpha | [VERIFIED] same page |
| Play phone screenshots | up to 8, min 2 to publish, JPEG or 24-bit PNG no alpha, each side 320 to 3840 px, long side at most 2x the short side. Games need at least 3 for large-format recommendation, 9:16 shots at least 1080x1920 for eligibility | [VERIFIED] same page |

## 2. Name collision report

Searched 2026-11-14 with web search, then opened the Apple pages. Nothing here proves the exact name "High & Low" is free: Apple only tells you at name reservation time in App Store Connect, and Play titles are not unique at all.

Existing apps found (all different games, all card or simple guessing games):

| Store | Name | Developer | Category | Note |
|---|---|---|---|---|
| Apple | Game High and Low | Taisuke Hosokawa | Card | subtitle "Test your luck with High & Low" [VERIFIED] https://apps.apple.com/us/app/-/id6742814805 |
| Apple | High / Low Guessing Game | Jerod Houghtelling | Puzzle | [VERIFIED] https://apps.apple.com/app/id6746059254 |
| Apple | Hi/Low | Janaka Prasad Wijesena | Games | [VERIFIED] https://apps.apple.com/bg/app/hi-low/id6450939650 |
| Apple | Hi or Lo | not opened | not opened | seen in search results only |
| Apple | HighLow: A Mind Game | not opened | not opened | seen in search results only, page failed to load |
| Google Play | High or Low with Zen Mode | GenXPapaG | Card | [VERIFIED] via https://appgoblin.info/apps/com.adamgoodwin.highlow (third-party tracker) |
| Google Play | The Higher or Lower Game | not opened | trivia | package com.stattogories, seen in search results only |

Reading of this: "high low" is a crowded phrase, mostly card games. Search traffic for the bare phrase will be hard to win, and a plain "High & Low" title risks looking like a copy of "Game High and Low" (Apple 5.2 asks for no confusingly similar names, [VERIFIED] https://developer.apple.com/app-store/review/guidelines/). Recommendation: use a name with a second part (option 1, 4 or 5 below). Reserve the name in App Store Connect first; it fails immediately if taken.

## 3. Name and subtitle options (all within 30 / 30)

| # | Name (chars) | Subtitle (chars) | Comment |
|---|---|---|---|
| 1 | High & Low: Number Duel (23) | Guess your friend's number (26) | Recommended. Says what it is. "Duel" matches the rated 1v1 mode |
| 2 | High & Low Party (16) | Secret numbers, silly deaths (28) | Leans on the party-room mode and the death scenes |
| 3 | Bean Duel: High & Low (21) | The secret number game (22) | Puts the beans (the characters) first, less collision |
| 4 | High & Low: Mind Reader (23) | Rated duels and party rooms (27) | "Mind Reader" is also a rank name in the game |
| 5 | High & Low Showdown (19) | Bluff, guess, survive (21) | "Showdown" matches the in-game showdown phase |

Note: Apple lets the same name be shown on Play with a different subtitle. Play has no subtitle field, so use the short description instead.

## 4. Promotional text (Apple, 170 max, 152 used)

Pick a secret number. Ask higher or lower. Guess right and your friend meets a falling piano. Rated 1v1 duels, or party rooms for up to 6. Free to play.

Can be edited without a new build, so it can carry seasonal or event text later. "Free to play" assumes the app stays free with optional ad removal; change if that changes.

## 5. Short description (Play, 80 max, 75 used)

Guess a secret number before they guess yours. Rated duels and party rooms.

## 6. Full description (both stores, about 1800 characters)

High & Low is a quick number game for two to six players, built for the couch, the bus stop and the group chat.

Everyone secretly picks a number. On your turn you ask another player "higher or lower than this?", work out where their number is hiding, then take a shot at it. Guess right and your target gets a cartoon send-off: a falling anvil, a grand piano, a hungry number monster, a banana peel. Run out of hearts and it happens to you. Last bean standing wins.

PLAY A RATED DUEL
Tap Play for a 1v1 match. Pick a range: 1 to 100 for a quick one, 1 to 10,000, or 1 to 100,000 for the long game. Bigger ranges pay more rating when you win. Climb the ranks from Rookie to Mastermind.

If no other player is waiting, a computer player fills the empty seat so you are never stuck in a queue. Computer players are listed in the About sheet inside the game.

PLAY WITH FRIENDS
Host a room, share the four letter code or the invite link, and play with up to 6 people. You choose the range. Friends rooms are for fun and are not rated.

THE FUN BITS
- Pick your bean's color and a hat. Win games to unlock more hats.
- Win games to earn coins, then spend them on powers: Peek, Double Down, Shield, Freeze and Instant Showdown.
- Send quick emoji taunts from a fixed set. There is no text chat.
- Every knockout has its own animation and sound.

GOOD TO KNOW
- You need an internet connection to play.
- No account and no sign-in. Pick a nickname and go.
- The game may show ads between matches. A one-time purchase removes them.
- Nicknames are shown to the people you play with. Do not use your real name.

Privacy policy and terms are linked from the About sheet.

### Notes on the full description
- "never stuck in a queue" is backed by `pubTick` in `src/main.js`: a fill-in joins after about 5 s and the game starts 1.5 s after the seat is full.
- "Computer players are listed in the About sheet" is exactly what the `i` sheet says today: "Open seats in Play are filled by bots." Hidden fill-ins (`hb:1`) carry no BOT tag in the game screen, so the store text plus the sheet is the disclosure. See `review-notes.md`.
- "A one-time purchase removes them" is only true once the native wrapper exposes `buyNoAds` (see `src/ads.js`). Delete that line if the purchase is not in the first release.
- "ads between matches" is true only for app builds with `HLNative.showInterstitial`. If you launch without ads, remove it and answer the privacy forms with the no-ads column.
- Do not use "for kids", "kids" or "family" anywhere (Apple 5.1.4 and 2.3.8, [VERIFIED] https://developer.apple.com/app-store/review/guidelines/).

## 7. Keywords (Apple, 100 max, 97 used)

guessing,number,duel,friends,party,multiplayer,bluff,rank,beans,mind,secret,quick,2 player,online

Rules followed: comma separated, no spaces after commas (Apple page, [VERIFIED]). Words already in the name or category are left out because Apple indexes those anyway ([UNVERIFIED], common ASO advice). Avoid trademarked names of other games. Re-check after the name is chosen: if you pick "Mind Reader" in the name, drop "mind".

## 8. Category

| Store | Primary | Secondary | Why |
|---|---|---|---|
| Apple | Games > Puzzle | Games > Strategy | A guessing and deduction game. Avoid Family (kids signal) and Casino (gambling, the game has no money, but "high low" is also a casino card game name) |
| Google Play | Game > Casual | none | Quick sessions, party play. Alternative: Puzzle. Avoid Card (casino cards confusion) and Casino |

Subcategory names are [UNVERIFIED], read from memory. Confirm in the portals.

## 9. Screenshot captions (6, short, each backed by the code)

Order is the order of the gallery. Caption on top of the shot, short enough for 2 lines on a phone.

| # | Caption (chars) | What the screenshot must show | Backed by |
|---|---|---|---|
| 1 | Pick a secret number (20) | Number pad, bean with hat | `padHTML`, secret pick screen |
| 2 | Ask higher or lower (19) | The ask screen with a question on a target | `ev.t==='ask'` flow |
| 3 | Guess it and they go splat (26) | A death scene such as the anvil | `SCENES`, `CAPTION` in `src/base.js` |
| 4 | Rated 1v1 duels (15) | Home screen with the three range buttons and rank pill | `MODES`, `eloPill` in `src/rating.js` |
| 5 | Party rooms for up to 6 (23) | Lobby with six beans and the room code | lobby max 6 in `src/main.js` |
| 6 | Taunts, hats, power-ups (23) | Taunt bar plus hat picker or power sheet | `TAUNTS`, `HAT_NAMES`, `pwDefs` |

Screenshot rules to follow:
- Apple 2.3.8 says screenshots should suit a 4+ rating, for example avoid a "gruesome death" image ([VERIFIED] https://developer.apple.com/app-store/review/guidelines/). The death scenes here are cartoon, but use the least graphic frame (anvil shadow, piano falling), not the aftermath. Do not use the "Pop" or bee scenes if they look distressing.
- Do not show a made-up opponent count, leaderboard, "millions of players", or "#1" claims.
- Do not render emoji as Apple-style emoji artwork in marketing graphics (Apple 5.2 says do not use Apple emoji, [VERIFIED]). The in-game taunts use the phone's own emoji font, so real device screenshots are fine, but do not redraw them in feature art.
- Show the real home screen. The home screen must stay free of any text the product owner has banned (no tutorials or hints).
- Play wants at least 2 screenshots and 3 for game recommendation, 8 maximum ([VERIFIED]). Use all 6 on both stores, in portrait.
- Feature graphic (Play only) 1024 x 500: logo plus three beans. No ranking claims, no "Top", no price text (icon rule [VERIFIED], feature graphic rule [UNVERIFIED]).

## 10. Claims check: what the code can back

| Claim | Evidence |
|---|---|
| 2 to 6 players | `PUB_N=2` in `src/rating.js`, `G.players.length<6` in `src/main.js` |
| Three range modes 100 / 10,000 / 100,000 | `MODES` in `src/rating.js` |
| Rated, ranks Rookie to Mastermind | `RANKS`, `eloApply` |
| Friends rooms unrated, room code and invite link | `G.pub` check in `eloApply`, `inviteURL` |
| Internet required | `HL_NEED_NET=1` in the web/app build, `offline()` |
| Fixed emoji taunts, no chat | `TAUNTS` array of 6, no text input anywhere in a game |
| Hats unlocked by wins, coins by winning | `HAT_NEED`, `pwEarn` |
| Powers | `pwDefs` (Instant Showdown, Peek, Double Down, Shield, Freeze) |
| Fill-in computer players | `addFillBot`, `pubTick` |
| No login | no auth code in `src/main.js`; `supabase/schema.sql` profiles are not used by the client |

Things NOT claimed on purpose: "no data collected" (a random id and play events are sent, see `privacy-answers.md`), "no ads" (app builds may show them), "play with anyone worldwide" (the queue only matches players who are waiting at that moment, and may have few), "offline mode" (Practice is hidden in app builds).
