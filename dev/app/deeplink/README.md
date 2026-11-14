# Invite links that open the installed app (OPTIONAL for the first release)

Everything here is UNVERIFIED: it was written without Xcode, Android Studio, a device or the hosting account.
Without it nothing breaks: an invite link `https://HOST/SITE_PATH/#room=ABCD` opens the website, which can join the same room.
With it, a phone that has the app installed opens the app and joins the room.

Current values (from `build.py` `SITE`): HOST = `7289627-cmd.github.io`, SITE_PATH = `high-and-low`.

## The hosting catch (decide first)
Both platforms read the two files from the ROOT of the host: `https://HOST/.well-known/...`. The game lives in a GitHub Pages
PROJECT site (`https://HOST/high-and-low/`), and a project site cannot serve files above its own path. Choose one:
1. Create the repo named `7289627-cmd.github.io` (the user site) and put `.well-known/` and an empty `.nojekyll` file at its root. That serves the root of the same host. The game stays where it is. (Not verified that this works with the project site next to it, but this is how GitHub Pages hosts are normally composed.)
2. Move the game to a custom domain and serve `.well-known/` from its root. `SITE` in `build.py` and `HL_SITE` then change too.
Also: GitHub Pages (Jekyll) drops folders that start with a dot unless a `.nojekyll` file exists at the root of that site.

## Files to host (fill the placeholders)
- `.well-known/apple-app-site-association` from `apple-app-site-association` (no file extension). `REPLACE_TEAM_ID` = Apple Developer Team ID, `REPLACE_BUNDLE_ID` = the real `appId` from `capacitor.config.ts`, `REPLACE_SITE_PATH` = `high-and-low`. Apple wants it over HTTPS without redirects, content type `application/json` (GitHub Pages may send another type for an extensionless file: check with `curl -sI`).
- `.well-known/assetlinks.json` from `assetlinks.json`. `REPLACE_BUNDLE_ID` = package name, fingerprint = SHA-256 of the certificate that signs the installed app. With Play App Signing that is the "App signing key certificate" in Play Console > Test and release > App integrity, NOT your upload key (add the upload key too while testing from Android Studio).

## iOS
1. Xcode > App target > Signing & Capabilities > + Capability > Associated Domains > add `applinks:7289627-cmd.github.io` (Apple developer account required, the capability must be enabled for the App ID).
2. Rebuild. Apple caches the AASA through its CDN (can take hours). For development append `?mode=developer` to the entry and enable Developer > Associated Domains Development on the phone.
## Android
1. Paste `android-intent-filter.xml` into the MainActivity `<activity>` in `android/app/src/main/AndroidManifest.xml` (not done automatically; `scripts/configure-native.mjs` does not touch it).
2. After install, `adb shell pm get-app-links BUNDLE_ID` should show the host as `verified`. Force a re-check with `adb shell pm verify-app-links --re-verify BUNDLE_ID`.

## In the app
`native/hlnative.js` listens to Capacitor App `appUrlOpen` and `getLaunchUrl()`. For a URL containing `room=` plus four letters it sets `location.hash = 'room=ABCD'` and reloads once, because the game reads `#room=` only at boot (`DEEP` in `src/main.js`). It does nothing while a game is running, and handles a launch URL once per app session (no reload loop). Whether the `#room=` fragment survives into the URL the app receives is UNVERIFIED on both platforms: if the log shows a URL without it, the tap opens the app on the home screen (harmless). Fallback idea if the fragment is dropped: change the invite to `?room=ABCD` (needs a change in `inviteURL()`, `DEEP` and the website; not done).

## Test on a device
Send the invite to a phone with the app installed and tap it in Messages/Notes (typing it into the browser address bar does NOT trigger universal links). Expect: app opens and the join screen shows the room. Tap it again with a game running: expect no reload.
