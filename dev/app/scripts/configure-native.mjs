#!/usr/bin/env node
// Applies the native settings High & Low needs to the projects made by `cap add ios` / `cap add android`.
// Safe to run again: every edit checks first. Run from app/:
//   node scripts/configure-native.mjs --android-app-id ca-app-pub-XXXX~YYYY --ios-app-id ca-app-pub-XXXX~ZZZZ [--personalised "why we track"]
// Without app ids it writes Google's SAMPLE app ids and says so (fine for testing, rejected by AdMob in production).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
// Google sample app ids (developers.google.com/admob/android/quick-start and /ios/quick-start). UNVERIFIED here, copied from memory.
const SAMPLE = { android: 'ca-app-pub-3940256099942544~3347511713', ios: 'ca-app-pub-3940256099942544~1458002511' };
const androidId = opt('android-app-id') || SAMPLE.android;
const iosId = opt('ios-app-id') || SAMPLE.ios;
const personalised = opt('personalised');   // text for NSUserTrackingUsageDescription; omit for non-personalised ads
const idRe = /^ca-app-pub-\d{16}~\d{10}$/;
for (const [n, v] of [['android', androidId], ['ios', iosId]]) {
  if (!idRe.test(v)) { console.error(`--${n}-app-id "${v}" does not look like ca-app-pub-<16 digits>~<10 digits>`); process.exit(1); }
  if (v === SAMPLE[n]) console.warn(`WARNING: using Google's SAMPLE ${n} app id. Replace before you publish.`);
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
let changed = 0;
function edit(file, fn) {
  if (!fs.existsSync(file)) return false;
  const a = fs.readFileSync(file, 'utf8'), b = fn(a);
  if (b !== a) { fs.writeFileSync(file, b); changed++; console.log('updated ' + path.relative(APP, file)); }
  return true;
}

// ---- Android ----
const man = path.join(APP, 'android/app/src/main/AndroidManifest.xml');
const strings = path.join(APP, 'android/app/src/main/res/values/strings.xml');
if (edit(man, (s) => {
  if (!/android:screenOrientation=/.test(s)) s = s.replace('android:name=".MainActivity"', 'android:name=".MainActivity"\n            android:screenOrientation="portrait"');
  if (!s.includes('com.google.android.gms.ads.APPLICATION_ID')) s = s.replace(/(<application\b[^>]*>)/, '$1\n\n        <meta-data\n            android:name="com.google.android.gms.ads.APPLICATION_ID"\n            android:value="@string/admob_app_id" />');
  if (!s.includes('permission.AD_ID')) s = s.replace('</manifest>', '    <uses-permission android:name="com.google.android.gms.permission.AD_ID" />\n</manifest>');
  return s;
})) {
  edit(strings, (s) => /name="admob_app_id"/.test(s)
    ? s.replace(/(<string name="admob_app_id">)[^<]*(<\/string>)/, `$1${androidId}$2`)
    : s.replace('</resources>', `    <string name="admob_app_id">${androidId}</string>\n</resources>`));
} else console.log('android/ not found, skipped (run `npx cap add android` first)');

// ---- iOS ----
const project = path.join(APP, 'ios/App/App.xcodeproj/project.pbxproj');
edit(project, (s) => {
  // Capacitor's App target defaults to iPhone and iPad in both Debug and Release.
  if (!s.includes('TARGETED_DEVICE_FAMILY = ')) throw new Error('Missing device-family setting in the generated App project');
  return s.replace(/TARGETED_DEVICE_FAMILY = [^;\r\n]+;/g, 'TARGETED_DEVICE_FAMILY = 1;');
});
const plist = path.join(APP, 'ios/App/App/Info.plist');
if (!edit(plist, (s) => {
  const put = (key, xml) => { if (!s.includes(`<key>${key}</key>`)) s = s.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>${key}</key>\n\t${xml}\n</dict>\n</plist>\n`); };
  if (s.includes('<key>GADApplicationIdentifier</key>')) s = s.replace(/(<key>GADApplicationIdentifier<\/key>\s*<string>)[^<]*(<\/string>)/, `$1${iosId}$2`);
  else put('GADApplicationIdentifier', `<string>${iosId}</string>`);
  // Google's own SKAdNetwork id. The full list from Google's iOS guide is still the owner's job (README).
  put('SKAdNetworkItems', '<array>\n\t\t<dict>\n\t\t\t<key>SKAdNetworkIdentifier</key>\n\t\t\t<string>cstr6suwn9.skadnetwork</string>\n\t\t</dict>\n\t</array>');
  if (personalised) put('NSUserTrackingUsageDescription', `<string>${esc(personalised)}</string>`);
  // portrait only. iPad full screen keeps App Store validation happy without all four orientations.
  const portrait = '<array>\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t</array>';
  s = s.replace(/(<key>UISupportedInterfaceOrientations(?:~ipad)?<\/key>\s*)<array>[\s\S]*?<\/array>/g, `$1${portrait}`);
  put('UIRequiresFullScreen', '<true/>');
  // The app only uses standard HTTPS/WSS, which is exempt from export paperwork. Skips the TestFlight compliance question.
  put('ITSAppUsesNonExemptEncryption', '<false/>');
  return s;
})) console.log('ios/ not found, skipped (run `npx cap add ios` first)');
console.log(changed ? `done, ${changed} file(s) changed` : 'nothing to change');
