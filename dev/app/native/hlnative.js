/* High & Low: native bridge. Loaded ONLY in the app build (sync-web.sh bundles it and adds it to app/www/index.html).
   Defines window.HLNative, the contract read by src/ads.js:
     showInterstitial(current)  Promise<boolean>  with a guard, only presents a preloaded ad
     showRewarded()      Promise<boolean>  true only if the player earned the reward
     keepAwake(on)       boolean  true if the native keep-screen-on plugin was called (iOS/Android WebViews have no Screen Wake Lock API)
   Extras: haptic(kind), exit(). Also in this file: the localStorage mirror (Preferences) and the invite-link
   listener (appUrlOpen -> #room=CODE). Every call resolves false instead of throwing when a
   plugin is missing, not configured, or fails. Plugins are reached through window.Capacitor.Plugins,
   which native/entry.js fills by importing the plugin packages (sync-web.sh bundles both with esbuild). */
(function () {
  'use strict';

  /* ---------- CONFIG: the owner edits this block ---------- */
  var CONFIG = {
    // sync-web.sh defaults app builds to false, unless demo or live ads are explicitly selected.
    ADS_ENABLED: true,
    // true = Google's official demo ad units + isTesting. Set to false only for the store build,
    // after the real ids below are filled in. While false, any id still containing "REPLACE" is refused.
    TEST_MODE: true,
    // Always request non-personalised ads (no ATT prompt needed, see app/README.md).
    NON_PERSONALISED: true,
    // Demo ad units, from Google's test-ads pages:
    //   Android https://developers.google.com/admob/android/test-ads#demo_ad_units
    //   iOS     https://developers.google.com/admob/ios/test-ads#demo_ad_units
    // Android interstitial/rewarded also appear in the plugin source (AdOptions.java), iOS rewarded in AdMobPlugin.swift.
    // iOS interstitial 4411468910 is from Google's docs and was NOT re-verified here.
    TEST_IDS: {
      android: { interstitial: 'ca-app-pub-3940256099942544/1033173712', rewarded: 'ca-app-pub-3940256099942544/5224354917' },
      ios:     { interstitial: 'ca-app-pub-3940256099942544/4411468910', rewarded: 'ca-app-pub-3940256099942544/1712485313' }
    },
    // TODO(owner): real ad UNIT ids from the AdMob console (format ca-app-pub-XXXXXXXXXXXXXXXX/NNNNNNNNNN).
    // The AdMob APP ids go into Info.plist / AndroidManifest.xml, not here (see app/README.md).
    REAL_IDS: {
      android: { interstitial: 'REPLACE_ANDROID_INTERSTITIAL_UNIT_ID', rewarded: 'REPLACE_ANDROID_REWARDED_UNIT_ID' },
      ios:     { interstitial: 'REPLACE_IOS_INTERSTITIAL_UNIT_ID',     rewarded: 'REPLACE_IOS_REWARDED_UNIT_ID' }
    },
    LOAD_TIMEOUT_MS: 10000,   // give up waiting for an ad to load when explicitly requested
    SHOW_TIMEOUT_MS: 120000   // safety net if a close event never arrives
  };
  // Tests may override before this script runs: window.HL_NATIVE_CONFIG = { LOAD_TIMEOUT_MS: 50, ... }
  try { var ov = window.HL_NATIVE_CONFIG; if (ov) for (var k in ov) CONFIG[k] = ov[k]; } catch (e) {}

  /* ---------- helpers ---------- */
  function plug(name) {
    try { var C = window.Capacitor, P = C && C.Plugins; return (P && P[name]) || null; } catch (e) { return null; }
  }
  function platform() {
    try { var p = window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform(); return p === 'ios' ? 'ios' : 'android'; } catch (e) { return 'android'; }
  }
  function isPlaceholder(v) { return !v || /REPLACE/.test(String(v)); }
  function adId(kind) {
    var set = (CONFIG.TEST_MODE ? CONFIG.TEST_IDS : CONFIG.REAL_IDS)[platform()];
    var id = set && set[kind];
    return isPlaceholder(id) ? null : id;
  }
  function withTimeout(promise, ms, fallback) {
    return new Promise(function (resolve) {
      var done = false, t = setTimeout(function () { if (!done) { done = true; resolve(fallback); } }, ms);
      Promise.resolve(promise).then(function (v) { if (!done) { done = true; clearTimeout(t); resolve(v); } },
                                   function () { if (!done) { done = true; clearTimeout(t); resolve(fallback); } });
    });
  }
  function listen(plugin, event, fn) {
    // addListener returns a Promise<handle>. Resolves to a function that removes the listener.
    try {
      var r = plugin.addListener(event, fn);
      return Promise.resolve(r).then(function (h) { return function () { try { h && h.remove && h.remove(); } catch (e) {} }; },
                                     function () { return function () {}; });
    } catch (e) { return Promise.resolve(function () {}); }
  }


  /* ---------- durable storage: mirror hl-* localStorage keys into Capacitor Preferences ----------
     iOS can purge WKWebView localStorage and Android loses it on "clear data" / origin change. This script loads BEFORE the game
     script, so: (1) take a synchronous snapshot of which keys localStorage has, (2) wrap Storage.prototype.setItem/removeItem to
     note changed hl-* keys, (3) asynchronously read Preferences and copy back every durable key the snapshot lacked, (4) if
     anything was restored, reload once so the game boots with its real data (guarded against loops), (5) only then start writing
     through (debounced) so the fresh defaults the game wrote during that boot can never overwrite the backup. */
  var MIRROR_SKIP = /^hl-(host-|sec-|session|sid$)/;   // transient or throwaway: room hosting state, secrets of a running game, rejoin record, stats session id
  var MIRROR_MAX = 20000;                              // chars per value; nothing the game stores comes close
  function durable(k) { return typeof k === 'string' && k.indexOf('hl-') === 0 && !MIRROR_SKIP.test(k); }
  var mir = { snap: {}, dirty: {}, timer: 0, ready: false, off: false, restored: 0, reloaded: false, done: null };
  var rawSet, rawRemove, ls = null;
  try {
    ls = window.localStorage;
    for (var i = 0; i < ls.length; i++) mir.snap[ls.key(i)] = 1;
    var SP = window.Storage && window.Storage.prototype;   // wrap the prototype: assigning ls.setItem would create a stored item
    rawSet = SP.setItem; rawRemove = SP.removeItem;
    SP.setItem = function (k) { var r = rawSet.apply(this, arguments); try { if (this === ls && durable(k)) note(k); } catch (e) {} return r; };
    SP.removeItem = function (k) { var r = rawRemove.apply(this, arguments); try { if (this === ls && durable(k)) note(k); } catch (e) {} return r; };
  } catch (e) { ls = null; }
  function note(k) { mir.dirty[k] = 1; if (mir.ready) schedule(); }
  function schedule() { if (!mir.timer && !mir.off) mir.timer = setTimeout(flush, 400); }
  function flush() {
    mir.timer = 0;
    var P = plug('Preferences');
    if (!P || !ls || !mir.ready || mir.off) return Promise.resolve(false);
    var keys = Object.keys(mir.dirty); mir.dirty = {};
    var jobs = keys.map(function (k) {
      try {
        var v = ls.getItem(k);   // current value wins, so a burst of writes costs one call per key
        var p = (v === null || v.length > MIRROR_MAX) ? P.remove({ key: k }) : P.set({ key: k, value: v });
        return Promise.resolve(p).catch(function () { mir.dirty[k] = 1; });
      } catch (e) { return Promise.resolve(); }
    });
    return Promise.all(jobs).then(function () { return true; });
  }
  function restoreMirror() {
    var P = plug('Preferences');
    if (!P || !ls) { mir.off = true; return Promise.resolve(); }
    return Promise.resolve().then(function () { return P.keys(); }).then(function (r) {
      var keys = ((r && r.keys) || []).filter(durable);
      return Promise.all(keys.map(function (k) {
        if (mir.snap[k]) return null;   // localStorage had it when the app started: it is newer, keep it
        return Promise.resolve(P.get({ key: k })).then(function (g) {
          var v = g && g.value;
          if (typeof v !== 'string' || v.length > MIRROR_MAX) return;
          rawSet.call(ls, k, v); delete mir.dirty[k]; mir.restored++;
        });
      }));
    }).then(function () {
      // bring the backup up to date with what localStorage holds now (also fills a first install)
      for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (durable(k)) mir.dirty[k] = 1; }
      mir.ready = true;
      if (mir.restored > 0) {
        var again = false;
        try { again = window.sessionStorage.getItem('hl-mirror-reload') === '1'; window.sessionStorage.setItem('hl-mirror-reload', '1'); } catch (e) { again = true; }
        if (!again) { mir.reloaded = true; try { window.location.reload(); } catch (e) {} return; }   // game booted on empty storage: boot it again with the data
      }
      schedule();
    }).catch(function () { mir.off = true; });   // Preferences unreadable: never write through (could overwrite a good backup with defaults)
  }
  mir.done = restoreMirror();
  try { document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); }); } catch (e) {}
  try { window.addEventListener('pagehide', function () { flush(); }); } catch (e) {}

  /* ---------- audio: pause while the app is in the background or an ad is on screen ---------- */
  var audioHolds = 0, appActive = true, pendingAudioSuspend = null;
  function audioPause() {
    try {
      if (typeof SFX !== 'undefined' && SFX.ctx && SFX.ctx.state === 'running' && !pendingAudioSuspend) {
        var result = SFX.ctx.suspend();
        if (result && result.then) {
          var pending = pendingAudioSuspend = Promise.resolve(result).catch(function () {});
          pending.then(function () { if (pendingAudioSuspend === pending) pendingAudioSuspend = null; });
        }
      }
    } catch (e) {}
    try { if (typeof MUSIC !== 'undefined' && MUSIC.el) for (var k in MUSIC.el) { try { MUSIC.el[k].pause(); } catch (e) {} } } catch (e) {}
  }
  function audioResume() {
    if (!appActive || audioHolds > 0) return;
    if (pendingAudioSuspend) { pendingAudioSuspend.then(audioResume); return; }
    try {
      if (typeof SFX !== 'undefined' && SFX.ctx && SFX.ctx.state !== 'running') {
        var result = SFX.ctx.resume();
        if (result && result.catch) result.catch(function () {});
      }
    } catch (e) {}
    try { if (typeof MUSIC !== 'undefined' && MUSIC.sync) MUSIC.sync(); } catch (e) {}
  }
  function holdAudio(on) {
    if (on) { if (audioHolds++ === 0) audioPause(); } else if (audioHolds > 0 && --audioHolds === 0) audioResume();
  }

  /* ---------- AdMob: consent (UMP) then initialize ---------- */
  var adReady = null;
  var consentVersion = 0;
  var privacy = CONFIG.ADS_ENABLED && plug('AdMob') ? require('./privacy-options.js').createPrivacyOptions({
    document: document,
    translate: function (key) { return window.HLI18n ? window.HLI18n.t(key) : key; },
    getAdMob: function () { return plug('AdMob'); },
    onOptionsClosed: function (allowed) {
      consentVersion++;
      ads.interstitial = ads.rewarded = null;
      if (allowed) preload('interstitial');
    }
  }) : null;

  async function initAds() {
    var A = plug('AdMob');
    if (!A || !privacy || !(await privacy.gatherConsent())) return false;
    if (!adReady) {
      adReady = Promise.resolve().then(function () { return A.initialize({ maxAdContentRating: 'Teen' }); }).then(
        function () { return true; },
        function () { adReady = null; return false; }
      );
    }
    return (await adReady) && privacy.canRequestAds();
  }

  function adOptions(kind) {
    var id = adId(kind);
    if (!id) return null;
    var o = { adId: id, npa: !!CONFIG.NON_PERSONALISED };
    // On iOS the plugin's isTesting flag substitutes an Android demo unit.
    // The selected iOS TEST_IDS value is already Google's test unit.
    if (CONFIG.TEST_MODE && platform() !== 'ios') o.isTesting = true;
    return o;
  }

  var ads = { interstitial: null, rewarded: null };
  var preparing = { interstitial: null, rewarded: null };
  var interstitialRetryAt = 0;
  function retryInterstitial() {
    if (privacy && appActive && !document.hidden && navigator.onLine !== false &&
        !audioHolds && !preparing.interstitial && !ads.interstitial?.ready &&
        Date.now() >= interstitialRetryAt) preload('interstitial');
  }
  function preload(kind) {
    var A = plug('AdMob'), o = adOptions(kind);
    if (!A || !o) return null;
    var fn = kind === 'interstitial' ? A.prepareInterstitial : A.prepareRewardVideoAd;
    if (!fn) return null;
    // Only one native load per type can write to the plugin's cache at a time.
    if (preparing[kind]) return ads[kind];
    if (kind === 'interstitial') interstitialRetryAt = Date.now() + 5000;
    var version = consentVersion;
    var prepared = { ready: false };
    preparing[kind] = (async function () {
      if (!(await initAds()) || version !== consentVersion) return false;
      await fn.call(A, o);
      return version === consentVersion && privacy.canRequestAds();
    })().catch(function () { return false; }).then(function (loaded) {
      prepared.ready = loaded;
      preparing[kind] = null;
      if (kind === 'interstitial' && version !== consentVersion && privacy.canRequestAds()) preload(kind);
      return loaded;
    });
    prepared.loaded = preparing[kind];
    return (ads[kind] = prepared);
  }

  // Shows a prepared ad. closeEvents resolve the wait. Returns { shown, rewarded }.
  async function showAd(kind, current) {
    var A = plug('AdMob');
    var readyOnly = typeof current === 'function';
    function canPresent() {
      return !readyOnly || (appActive && !document.hidden && navigator.onLine !== false && current());
    }
    if (!A || !privacy || !canPresent()) return { shown: false, rewarded: false };
    var version = consentVersion;
    if (readyOnly && (!ads[kind]?.ready || !privacy.canRequestAds())) {
      retryInterstitial();
      return { shown: false, rewarded: false };
    }
    if (!privacy.canRequestAds()) return { shown: false, rewarded: false };
    var prepared = ads[kind] || preload(kind);
    var loaded = prepared && (readyOnly || await withTimeout(prepared.loaded, CONFIG.LOAD_TIMEOUT_MS, false));
    if (!loaded) {
      if (!preparing[kind]) preload(kind);
      return { shown: false, rewarded: false };
    }
    if (ads[kind] === prepared) ads[kind] = null;
    if (version !== consentVersion || !privacy.canRequestAds()) return { shown: false, rewarded: false };
    var ev = kind === 'interstitial'
      ? { dismiss: 'interstitialAdDismissed', fail: 'interstitialAdFailedToShow' }
      : { dismiss: 'onRewardedVideoAdDismissed', fail: 'onRewardedVideoAdFailedToShow', reward: 'onRewardedVideoAdReward' };
    var off = [], rewarded = false, shown = true;
    holdAudio(true);
    try {
      var closed = new Promise(function (resolve) {
        listen(A, ev.dismiss, function () { resolve(); }).then(function (f) { off.push(f); });
        listen(A, ev.fail, function () { shown = false; resolve(); }).then(function (f) { off.push(f); });
        if (ev.reward) listen(A, ev.reward, function () { rewarded = true; }).then(function (f) { off.push(f); });
      });
      // Let listener registration settle before the ad can possibly close.
      await Promise.resolve(); await Promise.resolve();
      if (version !== consentVersion || !privacy.canRequestAds() || !canPresent()) return { shown: false, rewarded: false };
      var call;
      try {
        call = kind === 'interstitial' ? A.showInterstitial() : A.showRewardVideoAd();
      } catch (e) { shown = false; call = null; }
      if (!call) return { shown: false, rewarded: false };
      // Only dismissal, failure or the safety timeout ends presentation, even if the show call never settles.
      var failed = new Promise(function (resolve) {
        Promise.resolve(call).then(function (r) {
          if (kind === 'rewarded' && r && typeof r.amount === 'number') rewarded = true;
        }, function () { resolve(false); });
      });
      var completed = await withTimeout(Promise.race([closed.then(function () { return shown; }), failed]), CONFIG.SHOW_TIMEOUT_MS, false);
      return { shown: completed, rewarded: rewarded };
    } catch (e) {
      return { shown: false, rewarded: false };
    } finally {
      off.forEach(function (f) { try { f(); } catch (e) {} });
      holdAudio(false);
      preload(kind);   // next one
    }
  }

  /* ---------- haptics ---------- */
  function haptic(kind) {
    try {
      var H = plug('Haptics');
      if (!H) return false;
      // Game kinds (src/haptics.js): tap, tick, thud, win, lose. Older names kept for the vibrate shim.
      var impact = { light: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY', tap: 'LIGHT', thud: 'HEAVY' };
      var note = { success: 'SUCCESS', warning: 'WARNING', error: 'ERROR', win: 'SUCCESS', lose: 'ERROR' };
      var p;
      if (impact[kind]) p = H.impact({ style: impact[kind] });
      else if (note[kind]) p = H.notification({ type: note[kind] });
      else if (kind === 'select' || kind === 'tick') p = H.selectionChanged && H.selectionChanged();
      else p = H.impact({ style: 'LIGHT' });
      if (p && p.catch) p.catch(function () {});
      return true;
    } catch (e) { return false; }
  }

  /* ---------- the contract ---------- */
  var HLNative = {
    showInterstitial: async function (current) {
      try { return (await showAd('interstitial', current)).shown; } catch (e) { return false; }
    },
    showRewarded: async function () {
      try { var r = await showAd('rewarded'); return r.shown && r.rewarded; } catch (e) { return false; }
    },
    haptic: haptic,
    // Screen stays on while a game is running. Neither WKWebView nor Android WebView has navigator.wakeLock.
    // Returns true when the plugin was called. src/main.js keepAwake() also tries the web API, so a false here costs nothing.
    keepAwake: function (on) {
      try {
        var K = plug('KeepAwake');
        if (!K) return false;
        var p = on ? K.keepAwake() : K.allowSleep();
        if (p && p.catch) p.catch(function () {});
        return true;
      } catch (e) { return false; }
    },
    // Android back button on the home screen: leave the app. No-op without the App plugin.
    exit: function () {
      try { var A = plug('App'); if (A && A.exitApp) { var r = A.exitApp(); if (r && r.catch) r.catch(function () {}); return true; } } catch (e) {}
      return false;
    }
  };
  if (!CONFIG.ADS_ENABLED) ['showInterstitial', 'showRewarded'].forEach(function (k) { delete HLNative[k]; });
  HLNative.mirror = { flush: flush, done: mir.done, state: mir };   // for tests and debugging
  window.HLNative = HLNative;


  /* ---------- invite links: https://<site>/#room=ABCD opened with the installed app (optional, needs deeplink setup, see app/deeplink/) ----------
     The game reads #room= once at boot (DEEP in src/main.js), so the listener sets the hash and reloads. A running game is never interrupted. */
  function roomFromUrl(u) {
    var m = /[#?&]room=([A-Za-z]{4})(?![A-Za-z])/.exec(String(u || ''));
    return m ? m[1].toUpperCase() : null;
  }
  function openRoom(u, launch) {
    try {
      var code = roomFromUrl(u);
      if (!code) return false;
      if (launch) {   // getLaunchUrl keeps returning the same URL after our own reload: handle it once per app session
        try { if (window.sessionStorage.getItem('hl-launch-url') === String(u)) return false; window.sessionStorage.setItem('hl-launch-url', String(u)); } catch (e) { return false; }
      }
      if (typeof view !== 'undefined' && view === 'game') return false;   // `view` is the game's global; do not drop a live game
      window.location.hash = 'room=' + code;
      window.location.reload();
      return true;
    } catch (e) { return false; }
  }
  HLNative.openRoom = openRoom;

  /* ---------- navigator.vibrate shim: src/main.js buzz(ms) works unchanged ---------- */
  try {
    var shim = function (ms) {
      var n = Array.isArray(ms) ? (ms[0] || 0) : (ms || 0);
      return haptic(n <= 10 ? 'light' : n <= 25 ? 'medium' : 'heavy');
    };
    Object.defineProperty(navigator, 'vibrate', { value: shim, configurable: true, writable: true });
  } catch (e) {}

  /* ---------- app lifecycle ---------- */
  function lifecycle() {
    var App = plug('App');
    if (!App) return;
    try {
      var r = App.addListener('appStateChange', function (s) {
        var wasActive = appActive;
        appActive = !s || s.isActive !== false;
        if (!appActive) audioPause(); else if (audioHolds === 0) audioResume();
        if (!wasActive && appActive) retryInterstitial();
      });
      if (r && r.catch) r.catch(function () {});
    } catch (e) {}
    try {
      var u = App.addListener('appUrlOpen', function (e) { openRoom(e && e.url); });
      if (u && u.catch) u.catch(function () {});
      // cold start from a link: the event may fire before the listener exists, so ask for the launch URL too
      if (App.getLaunchUrl) Promise.resolve(App.getLaunchUrl()).then(function (r) { if (r && r.url) openRoom(r.url, true); }, function () {});
    } catch (e) {}
    // Android back button: the game decides (close sheet, leave flow, or exit via HLNative.exit on the home screen).
    try {
      var b = App.addListener('backButton', function () {
        try { if (typeof window.hlBack === 'function') { window.hlBack(); return; } } catch (e) {}
        HLNative.exit();
      });
      if (b && b.catch) b.catch(function () {});
    } catch (e) {}
  }

  function start() {
    lifecycle();
    try {
      var SB = plug('StatusBar');
      if (SB) { var a = SB.setStyle({ style: 'LIGHT' }); if (a && a.catch) a.catch(function () {}); }
    } catch (e) {}
    // consent first, then load the first interstitial
    if (!privacy) return;
    var wasOffline = window.navigator?.onLine === false, reconnectPending = false;
    window.addEventListener?.('offline', function () { wasOffline = true; });
    window.addEventListener?.('online', function () {
      if (!wasOffline) return;
      wasOffline = false;
      if (reconnectPending) return;
      reconnectPending = true;
      // The SDK may still be settling a request made on the previous connection.
      Promise.resolve(preparing.interstitial).then(function () {
        setTimeout(function () {
          reconnectPending = false;
          retryInterstitial();
        }, Math.max(0, interstitialRetryAt - Date.now()));
      });
    });
    preload('interstitial');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
