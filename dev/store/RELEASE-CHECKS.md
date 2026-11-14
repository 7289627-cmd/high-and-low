# Release checks: manual test script for a real phone

Run on a physical iPhone and a physical Android phone with a TestFlight / internal-testing build, sound ON, ringer ON, volume up. Nothing below has ever been run on a device (everything so far was desktop Chromium and jsdom). Record PASS/FAIL per step. Test ad ids and a sandbox purchase account must be in use for steps 14 to 20.
Wording matches the UI: home buttons "Play", "Play with friends"; sheets "Leave", "Keep playing", "Play again"; the "i" button; the speaker button.

## First run and sound
1. Fresh install, open the app. Expect: sky-blue splash, then the home scene (clouds, kite, beans) with no white flash, no error text. Status bar icons readable.
2. Do not touch the screen for 5 seconds. Expect: no sound yet (audio unlocks on the first tap).
3. Tap anywhere once. Expect: button taps now make sound (audio is unlocked). Note: music files are missing from the build (`site/music/` empty), so silence for music is expected until the owner adds them.
4. Tap the speaker button to mute, then Play. Expect: no sound at all. Tap again to unmute. Expect: sounds return, no loud burst.
5. If music files exist: home loop plays, loops with no click at the seam, switches to the play loop when a duel starts, and ducks while a death scene plays.

## Play (rated 1v1)
6. Tap Play. Expect: three range tiles (1 - 100, 1 - 10,000, 1 - 100,000) and a "Finding a match" screen with dots; a bot or a human joins within about 12 seconds.
7. In each of the three modes (repeat steps 7 to 13 at least once per mode): set your secret with the slider. Expect: the number follows your thumb, a light haptic tick on each detent, number never uses the phone keyboard.
8. Tap lock. Expect: lock sound and a tap haptic, the screen moves on.
9. Pick HIGHER or LOWER, then drag the ask slider and tap Ask!. Expect: the range bar updates, YES/NO answer sound, the opponent answers on their turn ("Your turn" sound and haptic).
10. Let the 40 second timer run out on your turn. Expect: pill counts down, a hurry-up voice or warning may play near the end (unverified), then an automatic ask fires and the turn passes.
11. Guess wrong on purpose until your guess kills a bean (or let the opponent guess yours). Expect: a full death scene plays to the end (also if iOS Reduce Motion is on), with its sounds, a heavy haptic at the impact moment, and no clipped text at the screen edges.
12. Finish the duel. Expect: result sheet with "+N" or "-N" rating, new rating, coins only on a win ("+5 coins"), no coins on a loss.
13. Tap Play again. Expect: a new search in the same mode, rating unchanged by the tap itself.

## Ads and purchase (app builds only)
14. Play games to the end and leave with Play again or Close. Expect: no ad after game 1; an interstitial after game 2 and again after game 4; never during a game; sound pauses during the ad and returns after.
15. Close the ad. Expect: you land on the next screen, not stuck; if an ad fails to load the game just continues.
16. Open the "i" sheet. Expect: Privacy, Terms, Support links, "Remove ads" button, and a "Restore purchases" text link. Links open the pages.
17. Tap Remove ads and complete the sandbox purchase. Expect: sheet closes, no more ads after games 2 and 4 (play 4 games to confirm), the button is gone.
18. Delete the app, reinstall, open the "i" sheet, tap Restore purchases. Expect: ads stay removed (no purchase prompt).
19. Cancel a purchase at the system dialog. Expect: back to the game, ads still on, no error text.
20. Turn on airplane mode before launching an ad game. Expect: no crash, no frozen "Play again" (a hung ad gives up after 15 seconds).

## Leave, resume, offline
21. Start a rated duel, finish the secret step, then tap Leave during the secrets screen. Expect: leaves with no rating cost.
22. Mid-duel (after at least one ask), tap Leave. Expect: a sheet says how many rating points you will lose; "Keep playing" returns to the game; Leave applies exactly that loss on the next result/home rating.
23. Android only: press the system Back button during a game (Expect: the same leave sheet), on an open sheet (Expect: sheet closes), on a death scene or the wheel (Expect: nothing), on home (Expect: app closes).
24. Mid-duel, press Home and wait 30 seconds, then return. Expect: audio resumes, the game is still there (or shows the host-lost message if the opponent left); no stuck sound or double music.
25. Lock the screen during a duel for 10 seconds and unlock. Expect: same as step 24; the screen stays awake while you are in a game.
26. Turn airplane mode on at the home screen. Expect: an offline card instead of the Play buttons; turn it off and Expect: home returns without restarting.

## Friends room (needs a second phone)
27. Phone A: Play with friends, host a room. Expect: a 4-letter code and a QR code.
28. Phone B: enter the code in the join box. Expect: B appears in A's lobby with name and look.
29. Phone B scans the QR (camera app) or opens the link. Expect: the app opens on the room, or the web page opens if the app is not installed (note which; deep links are not configured in the wrapper).
30. Host picks range chip and timer chip (Off, 20 sec, 40 sec), starts, plays a full game. Expect: no rating change on either phone, no leave penalty, result sheet has no rating line.

## Layout and system settings
31. Phones with a notch or Dynamic Island and a gesture bar: check home, ask slider, result sheet. Expect: top buttons (mute, "i", Leave) clear of the notch, bottom buttons clear of the home indicator, scene reaches screen edges.
32. Rotate the phone to landscape on home and in a game. Expect: in the app the screen stays portrait (locked by `configure-native.mjs`); nothing is cut off.
33. Set the system font size to the largest. Expect: layout may grow but the Ask!, Lock and Play buttons stay reachable; note anything clipped (logo and mode labels are known to break at 150%).
34. Small phone (about 320x568 such as iPhone SE or a small Android). Expect: Ask! button visible without scrolling (known fail at 320x568 in browser tests), duel panel does not hide your own card, join-code box shows all four letters.
35. Tablet (iPad or Android 10 inch), only if iPad support is approved. Expect: centred, scaled column, nothing cut, no horizontal scroll, screenshots show the real app.
36. Turn on VoiceOver or TalkBack for 2 minutes. Expect: buttons are announced with names, sliders can be adjusted, "Your turn" is announced.

## Sign-off
37. Before the store build: `grep REPLACE app/native/hlnative.js` finds nothing and `TEST_MODE` is false. Do not tap real ads on your own build (AdMob policy).
