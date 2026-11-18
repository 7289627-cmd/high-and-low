const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../native/hlnative.js'), 'utf8');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function boot({ delayedSuspend = false } = {}) {
  const callbacks = {}, events = {};
  let pendingSuspend, resumes = 0;
  const ctx = {
    state: 'running',
    suspend() {
      if (delayedSuspend) return new Promise(resolve => { pendingSuspend = () => { this.state = 'suspended'; resolve(); }; });
      this.state = 'suspended'; return Promise.resolve();
    },
    resume() { resumes++; this.state = 'running'; return Promise.resolve(); },
  };
  const AdMob = {
    initialize: async () => {}, prepareInterstitial: async () => {},
    addListener: (name, fn) => { callbacks[name] = fn; return Promise.resolve({ remove() {} }); },
    showInterstitial: async () => {},
  };
  const App = {
    addListener: (name, fn) => { callbacks['app:' + name] = fn; return Promise.resolve({ remove() {} }); },
    getLaunchUrl: async () => undefined,
  };
  const document = { readyState: 'loading', hidden: false, addEventListener: (name, fn) => { events[name] = fn; } };
  const window = { HL_NATIVE_CONFIG: { ADS_ENABLED: true, TEST_MODE: true, SHOW_TIMEOUT_MS: 500 },
    Capacitor: { getPlatform: () => 'ios', Plugins: { AdMob, App } }, addEventListener() {} };
  const requireStub = () => ({ createPrivacyOptions: () => ({ gatherConsent: async () => true, canRequestAds: () => true }) });
  vm.runInNewContext(source, { window, document, navigator: {}, SFX: { ctx }, MUSIC: { sync() {} }, require: requireStub, setTimeout, clearTimeout, Promise });
  events.DOMContentLoaded();
  await wait(40);
  const ad = window.HLNative.showInterstitial();
  await wait(30);
  assert.ok(callbacks.interstitialAdDismissed && callbacks['app:appStateChange']);
  return { ctx, callbacks, ad, resolveSuspend: () => pendingSuspend(), resumes: () => resumes };
}

test('an ad dismissed while inactive must not resume audio until app returns', async () => {
  const h = await boot();
  h.callbacks['app:appStateChange']({ isActive: false });
  h.callbacks.interstitialAdDismissed();
  await h.ad; await wait(10);
  assert.equal(h.resumes(), 0, 'audio resumed in background');
  assert.equal(h.ctx.state, 'suspended');
  h.callbacks['app:appStateChange']({ isActive: true });
  await wait(10);
  assert.equal(h.ctx.state, 'running');
});

test('ad dismissal waits for an already-pending suspend before resuming', async () => {
  const h = await boot({ delayedSuspend: true });
  h.callbacks.interstitialAdDismissed();
  await h.ad;
  h.resolveSuspend();
  await wait(20);
  assert.equal(h.ctx.state, 'running', 'late suspend left audio silent after ad');
  assert.equal(h.resumes(), 1);
});

test('a pending suspend completing in background does not resume until foreground', async () => {
  const h = await boot({ delayedSuspend: true });
  h.callbacks.interstitialAdDismissed();
  await h.ad;
  h.callbacks['app:appStateChange']({ isActive: false });
  h.resolveSuspend();
  await wait(20);
  assert.equal(h.resumes(), 0);
  assert.equal(h.ctx.state, 'suspended');
  h.callbacks['app:appStateChange']({ isActive: true });
  await wait(10);
  assert.equal(h.ctx.state, 'running');
});
