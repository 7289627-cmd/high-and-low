const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = path.join(__dirname, '../native/hlnative.js');
const source = fs.readFileSync(sourcePath, 'utf8');

async function boot(config, requestConsentInfo = async () => ({ canRequestAds: true }), platform = 'ios') {
  const calls = [];
  const events = {};
  const AdMob = {
    requestConsentInfo,
    initialize: async options => calls.push(['ads:init', options.maxAdContentRating]),
    prepareInterstitial: async o => calls.push(['ads:prepare', o.adId, o.isTesting]),
    addListener: async () => ({ remove() {} }),
  };
  const Purchases = { configure: async () => calls.push('purchases:configure') };
  const window = {
    HL_NATIVE_CONFIG: config,
    Capacitor: { getPlatform: () => platform, Plugins: { AdMob, Purchases } },
    addEventListener() {},
  };
  const document = { readyState: 'loading', addEventListener: (n, f) => { events[n] = f; }, querySelector: () => null };
  vm.runInNewContext(source, { window, document, navigator: {}, setTimeout, clearTimeout, Promise, require: createRequire(sourcePath) });
  events.DOMContentLoaded();
  await new Promise(resolve => setTimeout(resolve, 50));
  return { native: window.HLNative, calls, events };
}

(async () => {
  const config = { ADS_ENABLED: true, TEST_MODE: false,
    REAL_IDS: { ios: { interstitial: 'ca-app-pub-1234567890123456/1234567890' } },
    IAP: { productId: 'remove_ads', apiKey: { ios: 'present', android: 'present' } } };
  const active = await boot(config);
  assert.equal(typeof active.native.showInterstitial, 'function');
  for (const name of ['buyNoAds', 'ownsNoAds', 'restore', 'restorePurchases'])
    assert.equal(active.native[name], undefined, `${name} exposed in ads-only build`);
  assert.equal(active.calls.includes('purchases:configure'), false, 'purchases initialized');
  assert.deepEqual(active.calls.find(call => call[0] === 'ads:init'), ['ads:init', 'Teen']);
  const prepared = active.calls.find(x => Array.isArray(x) && x[0] === 'ads:prepare');
  assert.equal(prepared[1], config.REAL_IDS.ios.interstitial);
  assert.equal(prepared[2], undefined, 'production mode must not request demo ads');
  const iosTest = await boot({ ADS_ENABLED: true, TEST_MODE: true });
  assert.deepEqual(iosTest.calls.find(call => call[0] === 'ads:init'), ['ads:init', 'Teen']);
  const iosTestAd = iosTest.calls.find(x => Array.isArray(x) && x[0] === 'ads:prepare');
  assert.ok(iosTestAd[1].endsWith('/4411468910'), 'iOS test must use the iOS test unit');
  assert.equal(iosTestAd[2], undefined, 'iOS plugin must not replace the unit via isTesting');
  const androidTest = await boot({ ADS_ENABLED: true, TEST_MODE: true }, undefined, 'android');
  assert.ok(androidTest.calls.some(x => Array.isArray(x) && x[0] === 'ads:prepare'
    && x[1] === 'ca-app-pub-3940256099942544/1033173712'), 'Android test must use the Android test unit');
  let consentRequests = 0;
  const requestConsent = async () => {
    if (++consentRequests === 1) throw new Error('consent unavailable');
    return { canRequestAds: true };
  };
  const unavailable = await boot(config, requestConsent);
  assert.equal(await unavailable.native.showInterstitial(), false);
  assert.deepEqual(unavailable.calls, []);
  const restarted = await boot(config, requestConsent);
  assert.equal(consentRequests, 2, 'a new app launch must retry the consent request');
  assert.deepEqual(restarted.calls.find(call => call[0] === 'ads:init'), ['ads:init', 'Teen']);
  const inactive = await boot({ ADS_ENABLED: false });
  assert.equal(inactive.native.showInterstitial, undefined);
  assert.equal(inactive.native.buyNoAds, undefined);
  assert.equal(inactive.events.click, undefined, 'ad-free build must not bind the About control');
  assert.deepEqual(inactive.calls, []);
  console.log('ads-only bridge contract: passed');
})().catch(e => { console.error(e); process.exitCode = 1; });
