const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const vm = require('node:vm');
const { createPrivacyOptions } = require('../native/privacy-options.js');

function aboutPanel() {
  const document = new EventTarget();
  const controls = [];
  const closeButton = {};
  let sheetOpen = false;
  const row = {
    insertBefore(button, before) {
      assert.equal(before, closeButton);
      controls.push(button);
    },
  };
  const sheet = { querySelector: selector => ({ '.btn-row': row, '#ovClose': closeButton })[selector] || null };
  document.querySelector = selector => {
    if (selector === '#hlPrivacyOptions') return controls[0] || null;
    if (selector === '#ov:not([hidden]) .legal a[href="privacy.html"]') {
      return sheetOpen ? { closest: () => sheet } : null;
    }
    return null;
  };
  document.createElement = tagName => Object.assign(new EventTarget(), {
    tagName,
    disabled: false,
    remove() { controls.splice(controls.indexOf(this), 1); },
  });
  return {
    document,
    controls,
    changeLanguage() {
      controls.length = 0;  // the game redraws the open About sheet
      const event = new Event('change');
      Object.defineProperty(event, 'target', { value: { id: 'languageChoice' } });
      document.dispatchEvent(event);
    },
    open() {
      controls.length = 0;
      sheetOpen = true;
      const click = new Event('click');
      const target = { closest: selector => selector === '#infoBtn' ? target : null };
      Object.defineProperty(click, 'target', { value: target });
      document.dispatchEvent(click);
    },
  };
}

function consent(canRequestAds, privacyOptionsRequirementStatus = 'REQUIRED', status = 'OBTAINED') {
  return { canRequestAds, privacyOptionsRequirementStatus, status, isConsentFormAvailable: status === 'REQUIRED' };
}

const settleInteractions = () => new Promise(resolve => setImmediate(resolve));

test('a failed consent update retries once for concurrent callers, then caches the SDK decision', async () => {
  const about = aboutPanel();
  let calls = 0;
  let finish;
  const AdMob = {
    async requestConsentInfo() {
      if (++calls === 1) throw new Error('offline');
      return new Promise(resolve => { finish = resolve; });
    },
  };
  const privacy = createPrivacyOptions({ document: about.document, getAdMob: () => AdMob });
  assert.equal(await privacy.gatherConsent(), false);
  const a = privacy.gatherConsent();
  const b = privacy.gatherConsent();
  await settleInteractions();
  assert.equal(calls, 2);
  finish(consent(true));
  assert.deepEqual(await Promise.all([a, b]), [true, true]);
  assert.equal(await privacy.gatherConsent(), true);
  assert.equal(calls, 2);
});

test('a successful disallow decision is retained without repeatedly presenting consent', async () => {
  let calls = 0;
  const AdMob = { async requestConsentInfo() { calls++; return consent(false); } };
  const privacy = createPrivacyOptions({ document: aboutPanel().document, getAdMob: () => AdMob });
  assert.equal(await privacy.gatherConsent(), false);
  assert.equal(await privacy.gatherConsent(), false);
  assert.equal(calls, 1);
});

test('the About panel adds one keyboard-accessible button when UMP requires it', async () => {
  const about = aboutPanel();
  const AdMob = { requestConsentInfo: async () => consent(false) };
  const privacy = createPrivacyOptions({ document: about.document, getAdMob: () => AdMob });
  about.open();
  assert.equal(about.controls.length, 0);
  assert.equal(await privacy.gatherConsent(), false);
  assert.equal(about.controls.length, 1);
  assert.equal(about.controls[0].tagName, 'button');
  assert.equal(about.controls[0].type, 'button');
  assert.equal(about.controls[0].textContent, 'Privacy choices');
  about.open();
  assert.equal(about.controls.length, 1);
});

test('a successful consent update with no required entry point leaves About alone', async () => {
  const about = aboutPanel();
  const AdMob = { requestConsentInfo: async () => consent(true, 'NOT_REQUIRED') };
  const privacy = createPrivacyOptions({ document: about.document, getAdMob: () => AdMob });
  assert.equal(await privacy.gatherConsent(), true);
  about.open();
  assert.equal(about.controls.length, 0);
});

test('the privacy control follows the language of the open game', async () => {
  const about = aboutPanel();
  let label = 'Pilihan privasi';
  const privacy = createPrivacyOptions({
    document: about.document,
    getAdMob: () => ({ requestConsentInfo: async () => consent(true) }),
    translate: key => key === 'Privacy choices' ? label : key,
  });
  await privacy.gatherConsent();
  about.open();
  assert.equal(about.controls[0].textContent, 'Pilihan privasi');
  label = '隐私选项';
  about.changeLanguage();
  assert.equal(about.controls[0].textContent, '隐私选项');
});

test('initial consent waits for the UMP form and fails closed if it cannot be shown', async () => {
  const about = aboutPanel();
  let rejectForm;
  const AdMob = {
    requestConsentInfo: async () => consent(true, 'REQUIRED', 'REQUIRED'),
    showConsentForm: () => new Promise((_, reject) => { rejectForm = reject; }),
  };
  const privacy = createPrivacyOptions({ document: about.document, getAdMob: () => AdMob });
  const gathered = privacy.gatherConsent();
  await settleInteractions();
  about.open();
  assert.equal(about.controls.length, 0, 'the options form must not overlap initial consent');
  rejectForm(new Error('form unavailable'));
  assert.equal(await gathered, false);
  assert.equal(privacy.canRequestAds(), false);
  assert.equal(about.controls.length, 1);
});

test('changing privacy choices blocks ads during the form and uses the refreshed permission', async () => {
  const about = aboutPanel();
  const closed = [];
  let consentInfo = consent(true);
  let forms = 0;
  let dismiss;
  const AdMob = {
    requestConsentInfo: async () => consentInfo,
    async showPrivacyOptionsForm() {
      forms++;
      await new Promise(resolve => { dismiss = resolve; });
    },
  };
  const privacy = createPrivacyOptions({ document: about.document, getAdMob: () => AdMob, onOptionsClosed: allowed => closed.push(allowed) });
  await privacy.gatherConsent();
  about.open();
  const button = about.controls[0];
  button.dispatchEvent(new Event('click'));
  button.dispatchEvent(new Event('click'));
  assert.equal(button.disabled, true);
  assert.equal(forms, 1);
  assert.equal(privacy.canRequestAds(), false);
  consentInfo = consent(false);
  dismiss();
  await settleInteractions();
  assert.equal(privacy.canRequestAds(), false);
  assert.equal(button.disabled, false);
  assert.deepEqual(closed, [false]);

  button.dispatchEvent(new Event('click'));
  consentInfo = consent(true, 'NOT_REQUIRED');
  dismiss();
  await settleInteractions();
  assert.equal(privacy.canRequestAds(), true);
  assert.equal(about.controls.length, 0);
  assert.deepEqual(closed, [false, true]);
});

test('refresh errors after the privacy form invalidate previously allowed ads', async () => {
  const about = aboutPanel();
  const closed = [];
  let fail = false;
  const AdMob = {
    async requestConsentInfo() {
      if (fail) throw new Error('offline');
      return consent(true);
    },
    async showPrivacyOptionsForm() { fail = true; },
  };
  const privacy = createPrivacyOptions({ document: about.document, getAdMob: () => AdMob, onOptionsClosed: allowed => closed.push(allowed) });
  assert.equal(await privacy.gatherConsent(), true);
  about.open();
  about.controls[0].dispatchEvent(new Event('click'));
  await settleInteractions();
  assert.equal(privacy.canRequestAds(), false);
  assert.equal(about.controls[0].disabled, false);
  assert.deepEqual(closed, [false]);
});

test('the native bridge skips ads during and after denial and prepares a new ad when allowed again', async () => {
  const about = aboutPanel();
  let allowed = true;
  let dismiss;
  let initialized = 0;
  let prepared = 0;
  const shown = [];
  const observers = new Map();
  let preparedOnLaunch;
  const ready = new Promise(resolve => { preparedOnLaunch = resolve; });
  const AdMob = {
    requestConsentInfo: async () => consent(allowed),
    async showPrivacyOptionsForm() { await new Promise(resolve => { dismiss = resolve; }); },
    async initialize() { initialized++; },
    async prepareInterstitial() { if (++prepared === 1) preparedOnLaunch(); },
    async showInterstitial() {
      shown.push(prepared);
      observers.get('interstitialAdDismissed')?.();
    },
    async addListener(name, listener) {
      observers.set(name, listener);
      return { remove: () => observers.delete(name) };
    },
  };
  const window = {
    HL_NATIVE_CONFIG: { LOAD_TIMEOUT_MS: 150, SHOW_TIMEOUT_MS: 150 },
    Capacitor: { getPlatform: () => 'ios', Plugins: { AdMob } },
  };
  const bridgePath = require.resolve('../native/hlnative.js');
  vm.runInNewContext(fs.readFileSync(bridgePath, 'utf8'), {
    window, document: about.document, setTimeout, clearTimeout, require: createRequire(bridgePath),
  });
  await ready;

  about.open();
  const button = about.controls[0];
  button.dispatchEvent(new Event('click'));
  assert.equal(await window.HLNative.showInterstitial(), false);
  allowed = false;
  dismiss();
  await settleInteractions();
  assert.equal(await window.HLNative.showInterstitial(), false);
  assert.deepEqual(shown, []);

  button.dispatchEvent(new Event('click'));
  allowed = true;
  dismiss();
  await settleInteractions();
  assert.equal(await window.HLNative.showInterstitial(), true);
  assert.deepEqual(shown, [2]);
  assert.equal(initialized, 1);
});
