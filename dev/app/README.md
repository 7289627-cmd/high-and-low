# High & Low: iOS and Android app (Capacitor)

## Current release configuration

App builds default to no ads. The Android and iOS workflows offer two mutually exclusive modes:

- `demo_ads` requests Google's official test interstitial. It uses `HIGH_LOW_ADMOB_<PLATFORM>_APP_ID` when configured, so UMP can fetch consent messages published for High & Low. With that variable absent, the build uses Google's sample app ID for generic ad QA. Demo builds reject interstitial ID overrides.
- `ads` requires the platform's AdMob app ID and interstitial ID in `HIGH_LOW_ADMOB_<PLATFORM>_APP_ID` and `HIGH_LOW_ADMOB_<PLATFORM>_INTERSTITIAL_ID`. Live builds reject missing, malformed, mismatched, or demo IDs.

Both ad modes ship without purchases or RevenueCat. Use demo builds for device QA.

For local Android consent QA, set `HL_ADS_DEMO=1`, `HL_ADMOB_PLATFORM=android`, and optionally `HL_ADMOB_APP_ID` in the shell. Run `bash sync-web.sh`, then `node scripts/configure-native.mjs --android-app-id "${HL_ADMOB_APP_ID:-}"` and `npx cap sync android`. On iOS use `ios` and `--ios-app-id`. Keep `HL_ADMOB_INTERSTITIAL_ID` unset in demo mode. For a live build, set `HL_ADS_ONLY=1` instead of `HL_ADS_DEMO=1` and supply both IDs. Test the published consent messages and privacy choices on real devices before enabling live ads.

The native projects are generated during each store build.

The game is the web game in `../src`. This folder wraps it with Capacitor 8 so it can ship to the App Store and Google Play.
`native/hlnative.js` provides the ad bridge and haptics through `window.HLNative` (contract in `../src/ads.js`).
The website never loads it.

Anything marked **UNVERIFIED** could not be checked on the machine that prepared this folder (Linux, no Xcode, no Android SDK, no store accounts).
What was verified: `npm install` resolves, `cap add ios` and `cap add android` run and accept `capacitor.config.ts`, `scripts/configure-native.mjs` edits the generated manifest and plist correctly (checked by parsing them), the bundle builds, and `test/hlnative.js` passes with mocked plugins.

## Layout

| File | What it is |
|---|---|
| `package.json` | Exact versions of Capacitor 8.6.2 and the plugins. Needs Node 22 or newer. |
| `capacitor.config.ts` | App ID `com.highandlow.game`, name, `webDir: www`, splash and status bar colours. |
| `sync-web.sh` | Builds the web game, copies `site/` into `www/` (without `lab/`, `sounds.html`, `deaths.html`, dev files), bundles `native/` into `www/hlnative.js`, and adds one `<script>` tag to the COPY of `index.html`. |
| `native/hlnative.js` | AdMob, haptics, audio pause, keep-awake, storage mirror and invite-link listener. |
| `native/entry.js` | esbuild entry. Imports the plugin packages so they register on `Capacitor.Plugins`. |
| `scripts/app_csp.py` | Run by `sync-web.sh` on the COPY of `index.html`: adds `capacitor://localhost https://localhost` to the file-loading CSP directives. |
| `deeplink/` | Optional templates and steps for invite links that open the app (universal links / app links). |
| `scripts/configure-native.mjs` | Applies orientation, AdMob app id, SKAdNetwork and AD_ID permission to the generated native projects. |

## What changed in the hardening pass (f02)
Nothing here ran on a device. Each item names the one thing to check.
1. **Screen stays awake.** WKWebView and Android WebView have no `navigator.wakeLock`. New plugin `@capacitor-community/keep-awake` 8.0.1 (peer `@capacitor/core >=8`). `HLNative.keepAwake(on)` calls `keepAwake()` / `allowSleep()`; `keepAwake()` in `src/main.js` calls it when the state changes and still tries the web API (so the website is unchanged). UNVERIFIED on a device: the screen does not dim during a 3 minute game; it dims again on the home screen.
2. **Minimum WebView.** `android.minWebViewVersion: 90` in `capacitor.config.ts` (option confirmed in the `@capacitor/cli` 8.6.2 typings, default 60, "cannot be lower than 55"). Reason: `vendor/supabase-*.js` uses ES2021 syntax (Chrome 85+). iOS: Capacitor 8.6.2's generated project has `IPHONEOS_DEPLOYMENT_TARGET = 15.0` and Swift packages `.iOS(.v15)` (read from the `@capacitor/cli` iOS template), so Safari 15 covers the syntax. Android: template `minSdkVersion = 24` (Android 7); WebView updates through Google Play. UNVERIFIED: what the player sees below WebView 90 (Capacitor only logs; no custom error page is set).
3. **Durable storage.** `@capacitor/preferences` 8.0.1. `native/hlnative.js` (loaded BEFORE the game script, see `sync-web.sh` step 3) snapshots localStorage, wraps `Storage.prototype.setItem/removeItem`, restores missing `hl-*` keys from Preferences, and reloads the page ONCE when it restored something (sessionStorage flag, no loops). Writes go to Preferences debounced (400 ms, also on hide/pagehide) and only after the restore finished. Keys not mirrored: `hl-host-*`, `hl-sec-*`, `hl-session`, `hl-sid`. Everything mirrored is a game setting or counter (rating `hl-elo*`, coins `hl-coins`, `hl-wins`, name `hl-name`, look `hl-look`, `hl-noads`, `hl-mute`, `hl-pid`, pending-loss `hl-pend`, ...). There are no secrets in localStorage. If Preferences cannot be read, nothing is written (a good backup is never overwritten with defaults). UNVERIFIED on a device: (a) iOS Settings > General > iPhone Storage > the app > Offload App, or delete and reinstall with iCloud backup, then check rating and name come back; (b) Android: Settings > Apps > Clear storage keeps nothing (Preferences is cleared too, by design); change `androidScheme` and you lose the origin's localStorage but not Preferences; (c) a fresh install shows no flicker/reload.
4. **Invite links.** `deeplink/` holds the two `.well-known` templates, the Android intent filter and the exact iOS/Android steps. The bridge listens for `appUrlOpen` and the launch URL and opens `#room=CODE`. OPTIONAL for the first release; read the hosting catch in `deeplink/README.md` first (project sites cannot serve `/.well-known` at the host root).
5. **CSP in the app.** `sync-web.sh` runs `scripts/app_csp.py` on the COPY only. Reasoning: scripts (page and the bundled `hlnative.js`), fonts, images, audio and fetches are all same origin; AdMob and RevenueCat are native SDKs and make no requests from the page; Capacitor injects its bridge natively (iOS user script) or as an inline script (covered by the existing `'unsafe-inline'`, so do not remove it); `connect-src` already lists this project's Supabase https and wss. The page-level `'self'` should match `capacitor://localhost` and `https://localhost`; the rewrite adds both origins explicitly to `script-src style-src font-src img-src media-src connect-src manifest-src` in case a WebView does not match `'self'` for a custom scheme. Nothing else is widened. UNVERIFIED: open Safari Web Inspector (iOS) and `chrome://inspect` (Android) and confirm no "Refused to ..." messages while playing a full game with sound, music, an invite QR and a room.

Device checklist for this pass (all UNVERIFIED):
- [ ] Game screen: phone does not dim or lock for 3 minutes; leaving the game lets it dim.
- [ ] Relaunch and check the saved name, rating, coins and sound setting.
- [ ] Simulate eviction (iOS: Offload App then reopen; Android: not simulable, `adb shell pm clear` clears Preferences too): values return and the page reloads once at most.
- [ ] A first install starts normally (no reload loop; the web inspector shows `hl-mirror-reload` absent).
- [ ] Invite link tapped on a phone with the app (only if you did `deeplink/`): app opens and joins; with a running game nothing happens.
- [ ] No CSP errors in the inspector console; sfx, music and fonts load.
- [ ] On an Android phone with WebView below 90 (emulator image with an old WebView): note what happens.

## One-time setup (macOS for iOS, any OS for Android)

Prerequisites: Node 22+, Python 3, Xcode 16+ with command line tools (iOS), Android Studio with SDK 36 and JDK 21 (Android). UNVERIFIED: exact minimum versions, check Capacitor's environment page.

```bash
cd dev/app
npm ci
bash sync-web.sh                         # builds ../site, fills www/
npx cap add ios                          # macOS only (creates ios/, uses Swift Package Manager, no CocoaPods)
npx cap add android
# 2. Native settings. With your real AdMob APP ids (see below). Without ids it writes Google SAMPLE ids and warns.
node scripts/configure-native.mjs \
  --android-app-id ca-app-pub-XXXXXXXXXXXXXXXX~NNNNNNNNNN \
  --ios-app-id     ca-app-pub-XXXXXXXXXXXXXXXX~NNNNNNNNNN
npx cap sync
```

Every later web change: `npm run sync` (runs `sync-web.sh` then `cap sync`).

The store workflows regenerate `ios/` and `android/` from the wrapper configuration.

### iOS (Xcode)
```bash
npx cap open ios
```
In Xcode: select target App, Signing & Capabilities, choose your Team, tick "Automatically manage signing", set the Bundle Identifier to your appId.
Pick an iPhone or simulator and run the app. For cloud signing and TestFlight upload, use the iOS workflow.

### Android (Android Studio)
```bash
npx cap open android
```
Let Gradle sync and run on a test device or emulator. Use the existing upload key configured in the Android workflow for a Play bundle.

## Where the real ids go

| Item | Where | Format |
|---|---|---|
| AdMob **app** id, Android | `node scripts/configure-native.mjs --android-app-id ...` (writes `android/app/src/main/res/values/strings.xml` `admob_app_id`, referenced by the `meta-data` below) | `ca-app-pub-<16 digits>~<10 digits>` |
| AdMob **app** id, iOS | same script, writes `GADApplicationIdentifier` in `ios/App/App/Info.plist` | same |
| AdMob interstitial unit per platform | `HIGH_LOW_ADMOB_<PLATFORM>_INTERSTITIAL_ID` workflow variable | `ca-app-pub-<16 digits>/<10 digits>` |
| Ad mode | Workflow inputs | `demo_ads` for QA or `ads` for production |

While `TEST_MODE` is `false`, any id still containing `REPLACE` is refused and the call resolves `false`, so a half-filled config cannot show wrong ads.
Demo interstitials use Google's `/1033173712` unit on Android and `/4411468910` unit on iOS. The fallback sample app IDs end in `~3347511713` and `~1458002511` respectively. Use the real app ID to test the consent messages you assign to High & Low. [Android test ads](https://developers.google.com/admob/android/test-ads) · [iOS test ads](https://developers.google.com/admob/ios/test-ads) · [Google consent setup](https://developers.google.com/admob/ios/privacy)

## What `configure-native.mjs` writes (so you can check it)
- `AndroidManifest.xml`: `android:screenOrientation="portrait"` on MainActivity, inside `<application>`:
  `<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="@string/admob_app_id" />` (the form the plugin README asks for), and `<uses-permission android:name="com.google.android.gms.permission.AD_ID" />`.
- `Info.plist`: `GADApplicationIdentifier`, `SKAdNetworkItems` with Google's `cstr6suwn9.skadnetwork`, portrait only for iPhone and iPad, `UIRequiresFullScreen` true.
- The ads-only build requests non-personalized ads. Verify the actual partner settings and measurement practices when completing Apple's tracking disclosure. Tracking as Apple defines it requires permission before it begins.
- It does NOT add Google's full SKAdNetwork list. Copy the rest from https://developers.google.com/admob/ios/quick-start#update_your_infoplist into `SKAdNetworkItems` (UNVERIFIED that one id is enough for fill).

## How the game and the native side talk
- At the results screen of each completed match, including the first, the app shows a preloaded interstitial if one is available. If the ad is unavailable, players can continue immediately. The `hl-noads` preference still suppresses ads.
- Consent: on startup `requestConsentInfo`, `showConsentForm` if required, then `initialize` only when `canRequestAds`. You must create the GDPR message in the AdMob console (Privacy & messaging) or the form never appears (UNVERIFIED how Google treats apps without a message).
- Haptics: `src/main.js` `buzz(ms)` calls `navigator.vibrate`. `hlnative.js` replaces that with Capacitor Haptics (8 ms or less light, 25 or less medium, else heavy), so main.js is unchanged. iOS WebViews have no `navigator.vibrate`, so this is what makes haptics work on iPhone.
- Game haptics: `src/haptics.js` `haptic(kind)` (tap, tick, thud, win, lose) calls `HLNative.haptic(kind)` (Capacitor Haptics: LIGHT, selection, HEAVY, SUCCESS, ERROR). No new step: `@capacitor/haptics` 8.0.2 and `@capacitor/app` 8.1.2 are already pinned in `package.json`, so `npm install` then `npm run sync` (`cap sync`) is enough. UNVERIFIED on a device.
- Android back button: `hlnative.js` listens to `App` `backButton` and calls the game's `window.hlBack()` (closes a sheet, opens the leave flow in a game, on the home screen calls `HLNative.exit()` which is `App.exitApp()`). UNVERIFIED on a device.
- Audio: when the app goes to the background or an ad is on screen, `SFX.ctx.suspend()` and the music elements pause; on return `SFX.ctx.resume()` and `MUSIC.sync()`.
- `showRewarded()` exists in the contract but nothing in the game calls it yet.

## Run the unit test
```bash
cd test && node hlnative.js        # prints: PASS hlnative
```
It also bundles `native/entry.js` and runs it against a fake native bridge to prove the plugins register on `Capacitor.Plugins`.

## Pre-submission checklist
Placeholders and accounts
- [ ] Both generated apps use the existing store ID `com.highandlow.game`.
- [ ] Check the platform-specific AdMob app and unit in the live build.
- [ ] AdMob Privacy & messaging: GDPR message published (UMP).
- [ ] Verify the ads-only build hides purchase and restore controls.

Behaviour on device (all UNVERIFIED, nothing here ran on a device)
- [ ] Demo ads show on both platforms. Verify any published consent message and the Privacy choices entry point on a device in a region the message targets.
- [ ] An ad never appears during a game; first one after game 2.
- [ ] Haptics on slider release and wheel landing; audio stops while an ad is open and when the app is backgrounded.
- [ ] Safe areas, status bar colour and icons look right on notch phones and Android 15 edge-to-edge.
- [ ] Play with friends works over the app (room codes, QR, supabase websocket). The page CSP `connect-src` allows `https://*.supabase.co` and `wss://*.supabase.co`. The webview origin is `capacitor://localhost` (iOS) / `https://localhost` (Android), which `'self'` covers (UNVERIFIED).
- [ ] Offline start shows a sensible state (game needs internet).

Store requirements
- [ ] Icon 1024x1024 and splash artwork. `../site/icon-180.png` is too small. Generate sets with `npx @capacitor/assets generate` from `assets/icon-only.png` (1024) and `assets/splash.png` (2732): not added here (UNVERIFIED tool usage).
- [ ] Complete Apple App Privacy and Play Data safety using the actual SDK settings, multiplayer data and pseudonymous events in `src/track.js`. Complete Play's advertising ID declaration.
- [ ] Verify the published privacy policy and support page against the copies in the package.
- [ ] Age rating questionnaires. Decide whether the game is directed at children: if yes AdMob needs `tagForUnderAgeOfConsent` / child-directed settings and different rules apply. Not set here.
- [ ] Verify ad labeling, dismissal, targeting information and the inappropriate-ad reporting path on the signed build.
- [ ] Export compliance: the app uses only HTTPS. Answer the encryption question in App Store Connect (or add `ITSAppUsesNonExemptEncryption` false if exempt). Legal declaration, left to the owner.
- [ ] iPad: the script locks portrait full screen on iPad too. If you do not want an iPad build, set Targeted Device Family to iPhone only in Xcode.
- [ ] Screenshots for 6.9 inch iPhone and Android phones; Google Play requires testing track steps for new personal developer accounts (UNVERIFIED current rule).
- [ ] Bump `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` (iOS) and `versionCode` / `versionName` (`android/app/build.gradle`) for every upload.
