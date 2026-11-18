const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const sourcePath = path.join(__dirname, '../native/hlnative.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

async function boot(initiallyOnline = true) {
  const loads = [];
  const listeners = {};
  const timers = new Map();
  const navigator = { onLine: initiallyOnline };
  let now = 0;
  const document = {
    readyState: 'loading', hidden: false,
    addEventListener(name, callback) { listeners[name] = callback; },
    querySelector() { return null; },
  };
  let shows = 0;
  const AdMob = {
    requestConsentInfo: async () => ({ canRequestAds: true }),
    initialize: async () => {},
    prepareInterstitial: () => new Promise((resolve, reject) => loads.push({ resolve, reject })),
    addListener: (name, callback) => {
      listeners[name] = callback;
      return Promise.resolve({ remove() { delete listeners[name]; } });
    },
    showInterstitial: async () => {
      shows++;
      listeners.interstitialAdDismissed();
    },
  };
  const App = {
    addListener: async (name, callback) => { listeners[name] = callback; },
  };
  const window = {
    navigator,
    HL_NATIVE_CONFIG: { ADS_ENABLED: true, TEST_MODE: true },
    Capacitor: { getPlatform: () => 'ios', Plugins: { App, AdMob } },
    addEventListener(name, callback) { listeners[name] = callback; },
  };
  vm.runInNewContext(source, {
    window, document, navigator, require: createRequire(sourcePath),
    Date: { now: () => now },
    setTimeout(callback, delay) { timers.set(callback, delay); return callback; },
    clearTimeout(callback) { timers.delete(callback); },
  });
  listeners.DOMContentLoaded();
  await settle();
  assert.equal(loads.length, 1);
  return {
    loads,
    shows: () => shows,
    show: () => window.HLNative.showInterstitial(() => true),
    advance() { now += 10000; },
    timerDelays() { return [...timers.values()]; },
    expireTimers() { for (const timer of [...timers.keys()]) { timers.delete(timer); timer(); } },
    active(isActive) { listeners.appStateChange({ isActive }); },
    online(value) {
      navigator.onLine = value;
      listeners[value ? 'online' : 'offline']?.();
    },
  };
}

test('a late native load is ready at the following result without interrupting the current result', async () => {
  const h = await boot();
  h.expireTimers();
  assert.equal(await h.show(), false);
  h.loads[0].resolve();
  await settle();
  assert.equal(h.shows(), 0);
  assert.equal(await h.show(), true);
  assert.equal(h.shows(), 1);
});

test('foregrounding retries a failed preload once and presents it only at a later result', async () => {
  const h = await boot();
  h.loads[0].reject(new Error('network error'));
  await settle();
  h.active(true);
  await settle();
  assert.equal(h.loads.length, 1);
  h.active(false);
  h.active(true);
  await settle();
  assert.equal(h.loads.length, 1, 'rapid foregrounding retried too soon');
  h.advance();
  h.active(false);
  h.active(true);
  h.active(true);
  await settle();
  assert.equal(h.loads.length, 2);
  h.loads[1].resolve();
  await settle();
  assert.equal(h.shows(), 0);
  assert.equal(await h.show(), true);
});

test('a completed result triggers one replacement load after a preload failure', async () => {
  const h = await boot();
  h.loads[0].reject(new Error('network error'));
  await settle();
  h.advance();
  assert.equal(await h.show(), false);
  await settle();
  assert.equal(h.loads.length, 2);
  assert.equal(await h.show(), false);
  assert.equal(h.loads.length, 2);
  h.loads[1].resolve();
  await settle();
  assert.equal(h.shows(), 0);
  assert.equal(await h.show(), true);
});

test('restored connectivity retries once after an outstanding load and the cooldown', async () => {
  const h = await boot(false);
  h.online(true);
  h.online(true);
  await settle();
  h.loads[0].reject(new Error('network error from the original connection'));
  await settle();
  assert.equal(h.loads.length, 1);
  assert.deepEqual(h.timerDelays(), [5000], 'one retry waits for the remaining cooldown');
  h.advance();
  h.expireTimers();
  await settle();
  assert.equal(h.loads.length, 2);
  h.loads[1].resolve();
  await settle();
  assert.equal(h.shows(), 0);
  assert.equal(await h.show(), true);
});

test('an online notification without an offline transition does not retry', async () => {
  const h = await boot();
  h.loads[0].reject(new Error('no fill'));
  await settle();
  h.advance();
  h.online(true);
  await settle();
  h.expireTimers();
  await settle();
  assert.equal(h.loads.length, 1);
  h.online(false);
  h.online(true);
  await settle();
  h.expireTimers();
  await settle();
  assert.equal(h.loads.length, 2);
});
