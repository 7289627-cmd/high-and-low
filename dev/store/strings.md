# Player-visible strings (e03 audit)

Line numbers are for `src/` after the e03 edits. Verdict: keep / cut (done) / short (done) / propose (owner decides, not applied).
Style rules applied: sentence case on buttons and headings; no trailing full stop on UI fragments (event-log sentences and the About sheet keep theirs); one ellipsis (U+2026); minus U+2212; ranges "1 – N" with en dash and thousands separators via `fmt()`; apostrophe is straight `'`; the word Elo never appears (class names and storage keys only).

## Home
| String | Screen | File:line | Verdict |
|---|---|---|---|
| High&Low (logo) | all | main.js:1029,1076 | keep |
| i (aria "About") | home | main.js:1029 | keep, sr text accurate |
| Mute sounds / Unmute sounds (aria) | home, header | main.js:1070 | keep |
| 1000 + badge + rank name (Rookie, Guesser, Sharp, Hunter, Mind Reader, Mastermind) | home pill | rating.js:16,100 | keep, number plus rank name as owner wants |
| coin icon + N (was "Coins: N"; sr-only " coins") | home pill | powers.js:30 | cut word, icon says it |
| Your name (placeholder + aria) | home | main.js:1031 | keep, empty field is unclear without it |
| Range (aria), 1 – 100 / 1 – 10,000 / 1 – 100,000, x1.5, x2 | mode picker | rating.js:14 | keep, x1.5/x2 are bare numbers (owner may cut) |
| Play | home | main.js:1033 | keep |
| Play with friends | home | main.js:1034 | keep |
| Rejoin room ABCD | home | main.js:1036 | keep, code needed |
| Host a game | home | main.js:1037 | keep |
| CODE (placeholder), Room code (aria) | home | main.js:1038 | keep |
| Join | home | main.js:1038 | keep |
| Practice | home, header pill | main.js:1040,1074 | keep |
| Connecting to rooms… -> Connecting… | home | main.js:1042 | short, matches the header status |
| Type your name first | home error | main.js:1421 | keep, full stop removed |
| Room codes are 4 letters | home/lobby error | main.js:1423,1466 | keep, full stop removed; propose "4 letters" |
| Type your name, then tap Join. -> Type your name first | invite link | main.js:1563 | cut, same message as above |
| That is this room | lobby error | main.js:1466 | keep |
| The host left / Lost the host | home error after leaving | main.js:248,250 | keep, full stops removed |
| No internet | offline card | main.js:1519 | keep |
| Connect to play. | offline card | main.js:1519 | cut, explanatory |
| Try again | offline card | main.js:1519 | keep |

## About sheet (i)
| High & Low | h2 | main.js:1435 | keep |
| Open seats in Play are filled by bots. | sheet | main.js:1435 | keep, the one disclosure; the only visible use of the word bots outside private rooms |
| Sounds: Kenney, rubberduck and others (CC0). Piano: FluidR3 GM (CC BY 3.0). | sheet | main.js:1435 | keep, CC BY attribution is a licence duty |
| Privacy / Terms / Support | sheet links | main.js:1435 | keep |
| Remove ads / Restore purchases | sheet, app only | main.js:1435 | keep |
| Close | sheet | main.js:1435 | propose cut, Escape and back already close it (button id is used by tests) |

## Waiting / lobby
| Finding a match... | search | main.js:806 | keep |
| Leave / Leave? (was Tap to leave) | header | main.js:1076 | short |
| Live / Connecting (pill), Reconnecting… (banner) | header | main.js:1074,1075 | keep; propose cut "Live" text and keep the dot |
| Looking for room ABCD… | join wait | main.js:1082 | keep |
| Hang tight. / Make sure the host has the game open... share this game with you in Claude. | join wait | main.js:1083 | cut, explanatory and wrong for the store build |
| Send invite / Link copied! -> Copied | lobby | main.js:1304 | short |
| Join a room -> Join | lobby | main.js:1304 | short, same name as home |
| Friend's room code (aria) | lobby | main.js:1304 | keep |
| Players  N of 6 | lobby heading | main.js:1305 | propose cut the word Players, keep "N of 6" |
| YOU / BOT / HOST tags | lobby, cards | main.js:804,1300,1386 | keep YOU and HOST; BOT only on visible practice/friends bots (see owner list) |
| Change look | lobby | main.js:1301 | keep |
| Remove <name> (aria) | lobby | main.js:1301 | keep |
| Color 1..6 (aria), hat names (Party hat, Antenna, Cap, Bow, Hair tuft, Glasses, Crown, Top hat, Propeller, Chef hat, Viking horns, Halo), Win 3 (locked hat) | picker | main.js:1322,1326, base.js:31 | keep |
| + Add a bot | lobby | main.js:1307 | keep (see owner list) |
| This room is full | lobby | main.js:1308 | keep, full stop removed |
| Number range | lobby heading | main.js:1310 | propose cut, chips are self-evident |
| Turn timer; Off / 20 sec / 40 sec | lobby | main.js:1312 | keep |
| 20 seconds per question -> 20 sec | lobby (guest) | main.js:1313 | short, same as chips |
| Waiting for players… / Start game | lobby host | main.js:1314 | keep |
| Waiting for the host to start… -> Waiting for the host… | lobby guest | main.js:1314 | short |
| QR code to join room ABCD (alt) | lobby | main.js:1050 | keep |

## Secret and play
| Pick your number | secret | main.js:1342 | keep |
| RANDOM, One lower, One higher (aria), 1 and N ends | secret | main.js:1347 | keep |
| Lock it in | secret | main.js:1349 | keep |
| Who's ready; Ready / Picking… | secret | main.js:1350,1338 | keep Ready/Picking; propose cut the heading |
| Show it / Hide it -> Show / Hide; card link show/hide -> Show/Hide; • • • • -> •••• | secret, own card | main.js:1352,1388 | short, one wording |
| Yours: | own card | main.js:1388 | keep |
| Watching | spectator | main.js:1087 | keep |
| Out, Flattened, Fried, Launched, Eaten, Melted, Popped, Pianoed, Slipped, Calculated | dead card | base.js:5 | keep (humour) |
| N left, N LEFT, ODD, EVEN, VS | cards | main.js:1371,1387,1092 | keep |
| NAME has you down to N (aria), N left | own card bar | main.js huntHTML | keep |
| <name>, between 1 and 10,000 (aria, now uses fmt) | cards | main.js:1390 | fixed, was unformatted |
| Your turn / <name>'s turn; Waiting for <name>… | tray | main.js:1397,1400 | keep |
| You're out | tray | main.js:1402 | keep, full stop removed |
| Sending… / Using a power… | tray | main.js:1406 | keep |
| Is it… / HIGHER / LOWER / Is it HIGHER than 42? / Ask (was Ask!) / Back | ask | main.js:1228-1243 | keep, "!" cut |
| Higher, switch to lower (aria, was HIGHER) | ask | main.js:1239 | fixed |
| Pick 1 to 10,000 (was "Pick a whole number from ... to ...") | ask/secret error | main.js:925,1475 | short |
| Which one is it? | guess | main.js:1111 | propose cut |
| Guess <name>'s number; Down to 10! Guess their exact number. | old tray / hint | main.js:1410 | dead code (hint() returns '' and the old guess tray is unreachable); candidate to delete |
| Your phone answers for you. No lying! / Tap HIGHER or LOWER | hints | main.js:30 | dead code, tutorial text, never shown |
| N seconds left (aria) | timer | main.js:1066 | keep |
| Yes! / Nope! / Wrong! / Miss! / Blocked! / … | bubbles | main.js:649-683 | keep |
| Who goes first?; You go first! / <name> goes first!; (Spinning… cut) | wheel | main.js:1263,1284 | Spinning… cut |
| <name> asked <name>: higher than 42? Yes. (and the other event lines) | tray line, live region | main.js:692-723 | keep, full sentences double as announcements |

## Scenes, results
| <name> guessed 42! / You got flattened by a falling anvil. (and 8 more captions) | death scene | main.js:688, base.js:4 | keep |
| CLANG! ZAP! ZOOM! *BURP* CHOMP! GLOOP! POP! BWANG! SLIP! CRUNCH! RIP YUM 1 TON TOTAL ERROR X_X DOWN 88888 | in-scene art | base.js (word3, T3, text) | keep (comic art) |
| It wasn't 42! / got bonked and lost a heart / ran out of hearts | hearts events | main.js:689,690,710,711 | dead code, no hearts rule any more (not removed) |
| Instant Showdown (was INSTANT SHOWDOWN!); <name> pulled everyone into the guess zone! | power scene | powers.js:259 | short, same as power name |
| FINAL SHOWDOWN | 2 left in 3+ game | deaths.css:16 | propose keep or cut (owner) |
| You win! / <name> wins! / Nobody survived / Game over | result | main.js:775,1394 | keep |
| New hat unlocked: Crown! -> New hat: Crown | result | main.js:778 | short |
| +5 coins -> coin icon + +5 (aria "+5 coins") | result | powers.js:17 | cut word |
| Most deadly / Worst guesser / Closest call / Most curious (was Title Case); 3 kills / 2 misses / 4 questions / "survived down to 3 numbers" -> "3 left" | result, 3+ players | main.js:121-124 | short |
| Play again | result, tray | main.js:780,1394 | keep, one name |
| Close | result | main.js:780 | propose cut (X is there) |
| Reported / Report player (aria), Share (aria) | result | main.js:53, share.js | keep |
| +12 / −12 and rank name, rank-up stamp | result, home | rating.js | keep, minus is U+2212 |
| Leave the duel? / You'll lose 12 rating / Keep playing / Leave | leave sheet | main.js:1438 | keep, full stop removed; "rating" is the only word for it |

## Powers
| Powers (button, sheet) | main.js / powers.js:204 | keep |
| Instant Showdown, Peek, Double Down, Shield, Freeze | sheet | powers.js:5-9 | keep |
| Pulls everyone into the guess zone. -> Everyone into the guess zone; Learn if a player's number is odd or even. -> Odd or even; Ask twice this turn -> Ask twice; Blocks the next question or guess at you. -> Blocks the next hit; The next player skips their turn. -> Next player skips a turn | sheet | powers.js:5-9 | short (propose cut all descriptions) |
| Not available; Already used a power this turn -> Used this turn; Use it before asking -> Before asking; Shield is already up -> Already up; Needs 3 or more players -> 3 or more players; Not enough coins; Nobody to peek at | disabled reason | powers.js:46-51,207 | short |
| Use, Use <power> (aria), Close, Back | sheet | powers.js:209,215 | keep |
| 👀 Peek at who? -> Peek at who? | peek sheet | powers.js:215 | emoji removed from heading |
| Shielded / Frozen (aria), Shield / Frozen / Coins (title) | cards | powers.js:189,190,24 | keep |

## Head tags, manifest, share
| High & Low (title, og:title, og:site_name, apple title, manifest name and short_name) | site/index.html, manifest | keep, consistent |
| Hide a number. Guess theirs. Last bean standing wins. (description, og:description, manifest description) | head | keep |
| High and Low (title of the test artifact only) | build.py:6 | harmless, test build only |
| Join my High & Low game! Room ABCD / I won High & Low! / I won, High & Low, "1 – 100 · Sharp 1234" (card, flag off) | share | main.js:1443, share.js | keep |
| N wins in a row (aria, was bare "N") | streak flame, flag off | streak.js:28 | fixed |
| Taunts group, Laugh / Shocked / Thinking / Evil grin / Please / Fire | taunt bar | main.js:40,106 | keep (the six allowed emoji) |

## Emoji and pictograph audit (outside the taunt set)
In chrome, no drawn icon exists yet (listed for the lead, not replaced): powers.js:5-9 power icons 🎯 👀 ✌️ 🛡️ 🧊 (Powers sheet); powers.js:189 🛡️ and :190 ❄️ on cards; powers.js:263,265,267 bubbles 👀 🛡️ ❄️. Needs five drawn icons (snap, peek, double, shield, freeze) plus shield and frozen status badges. Nothing to reuse: only PW_BOLT, the coin and ovX exist.
Replaced: coin word became the coin icon (pwCoinSVG already existed). 👀 removed from the Peek heading.
Text glyphs used as icons: × (remove bot, main.js:1301), + / − (nudge keys, main.js:1242,1347), "+ Add a bot", ★ ★ ★ (bonk scene, base.js:249, dead), • (secret mask), · (share card), x1.5 / x2 (mode badge), X in `#ovX` is drawn SVG. No CSS `content:` emoji. No String.fromCodePoint or HTML-entity emoji.
