/* High & Low playable ad: the game logic. Art, scenes, ratings and sky come from the real game files
   (base.js, rating.js, main.js home sky) which build.py puts in front of this file. */
(function () {
  'use strict';
  var W = window, D = document;
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var ME = { color: '#3D7BFF', acc: 0, id: 1 };      // you: blue bean, party hat
  var OPP = { color: '#EE4B3B', acc: 7, id: 2 };     // the opponent: red bean, top hat
  var MAXN = 100, IDLE_MS = 3200, IDLE_TOUCHED_MS = 2200, ELO_FROM = 1000, ELO_D = 20;
  var DEATHS = ['piano', 'pop', 'zap', 'banana'];                       // the game's own scenes that read well small
  var CUT_MS = { piano: 3300, pop: 3700, zap: 3500, banana: 3700 };   // each scene is trimmed to just after the gag lands
  var lastDeath = '', forcedDeath = '', deathNow = '';
  var SWEAT = '<svg viewBox="0 0 20 28" aria-hidden="true"><path d="M10 2q9 12 0 22q-9-10 0-22z" fill="#BFE9FF" stroke="#1E2240" stroke-width="2.5" stroke-linejoin="round"/></svg>';
  var UP = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8l40 46H66v38H34V54H10z" fill="#fff" stroke="#1E2240" stroke-width="6" stroke-linejoin="round"/></svg>';
  var DN = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 92l40-46H66V8H34v38H10z" fill="#fff" stroke="#1E2240" stroke-width="6" stroke-linejoin="round"/></svg>';
  var TICK = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M16 54l24 24 44-52" fill="none" stroke="#1E2240" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 54l24 24 44-52" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var HAND = '<svg viewBox="0 0 70 86" aria-hidden="true"><path d="M20 8a7 7 0 0 1 14 0v26l4-1a6 6 0 0 1 8 3a6 6 0 0 1 8 4a6 6 0 0 1 8 5v17c0 12-8 21-20 21H34c-9 0-14-5-18-12L6 53a6 6 0 0 1 10-6l4 5z" fill="#fff" stroke="#1E2240" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M38 40v14M47 44v12M56 48v10" stroke="#1E2240" stroke-width="3.5" stroke-linecap="round" opacity=".5"/></svg>';
  var REPLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.2-5.1" fill="none" stroke="#1E2240" stroke-width="3.2" stroke-linecap="round"/><path d="M3.6 3.6V9h5.4" fill="none" stroke="#1E2240" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ------------------------------------------------ game clock (stops while the ad is hidden) */
  var gen = 0, clock = 0, paused = true, lastT = 0, tasks = [], started = false;
  function at(ms, fn) { tasks.push({ t: clock + ms, fn: fn, g: gen }); }
  function tick() {
    var now = performance.now();
    if (paused) { lastT = now; return; }
    clock += Math.min(now - lastT, 200); lastT = now;
    var due = tasks.filter(function (k) { return k.t <= clock; });
    if (due.length) {
      tasks = tasks.filter(function (k) { return k.t > clock; });
      due.sort(function (a, b) { return a.t - b.t; });
      due.forEach(function (k) { if (k.g === gen) { try { k.fn(); } catch (e) { setTimeout(function () { throw e; }); } } });
    }
    frame();
  }

  /* ------------------------------------------------ sound: muted until the first touch */
  var ctx = null, master = null, bufs = {}, decoding = {}, SFXG = W.HLAD_GAIN || {};
  function unlock() {
    ['pointerdown', 'touchstart', 'mousedown', 'keydown'].forEach(function (t) { D.removeEventListener(t, unlock, true); });
    var AC = W.AudioContext || W.webkitAudioContext;
    if (!AC || ctx) return;
    try {
      ctx = new AC();
      try { ctx.resume(); } catch (e) {}
      master = ctx.createGain(); master.gain.value = 0.8;
      var out = ctx.destination;
      try { var lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 3; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.15; lim.connect(ctx.destination); out = lim; } catch (e) {}
      master.connect(out);
      if (paused) { try { ctx.suspend(); } catch (e) {} }
      Object.keys(W.HLAD_AUDIO).forEach(function (k) {
        var bin = atob(W.HLAD_AUDIO[k]), u = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        decoding[k] = new Promise(function (res) {
          try {
            var p = ctx.decodeAudioData(u.buffer, function (b) { bufs[k] = b; res(b); }, function () { res(null); });
            if (p && p.catch) p.catch(function () { res(null); });
          } catch (e) { res(null); }
        });
      });
    } catch (e) { ctx = null; }
  }
  ['pointerdown', 'touchstart', 'mousedown', 'keydown'].forEach(function (t) { D.addEventListener(t, unlock, { capture: true, passive: true }); });
  function sfx(key, o) {
    if (!ctx) return;                                   // before the first touch: silence
    o = o || {};
    var t0 = performance.now();
    function go() {
      var b = bufs[key]; if (!b || !ctx) return;
      var d = (o.delay || 0) - (performance.now() - t0) / 1000;
      if (d < -0.3) return;
      try {
        var s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = o.rate || 1;
        var g = ctx.createGain(), gk = SFXG[key]; g.gain.value = (o.vol == null ? 1 : o.vol) * (gk == null ? 1 : gk);
        s.connect(g); g.connect(master); s.start(ctx.currentTime + Math.max(0, d));
      } catch (e) {}
    }
    if (bufs[key]) go(); else if (decoding[key]) decoding[key].then(go);
  }
  function deathSfx(kind) {
    ((W.DEATH_SFX && W.DEATH_SFX[kind]) || []).forEach(function (x) { sfx(x[0], { delay: x[1], rate: x[2] || 1, vol: x[3] == null ? 1 : x[3] }); });
  }

  /* ------------------------------------------------ view helpers */
  var root, R, phase = 'boot', lastTick = 0, sceneTimer = 0;
  function setPhase(p) { phase = p; D.documentElement.setAttribute('data-phase', p); }
  function fit() {
    var vw = W.innerWidth, vh = W.innerHeight, s = Math.min(vw / 390, vh / 720, 1.6);
    root.style.width = (vw / s) + 'px'; root.style.height = (vh / s) + 'px'; root.style.transform = 'scale(' + s + ')';
  }

  function oppMood(m) { $('#paOpp').innerHTML = charSVG(OPP, m, 'bob'); }
  function meMood(m) { $('#paMe').innerHTML = charSVG(ME, m, 'bob'); }
  function pop(el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }

  /* the red bean gets more worried as the range closes in: face, shake, sweat drops (all CSS except the face) */
  function nerve(l) {
    $('#paObWrap').className = 'pa-obean lv' + l;
    oppMood(l >= 2 ? 'scared' : 'idle');
  }

  function mount() {
    root.innerHTML =
      '<div class="pa-pips" id="paPips"><i></i><i></i><i></i></div>' +
      '<div class="pa-opp"><div class="pa-ped"><div class="pa-obean lv0" id="paObWrap"><div class="pa-ob" id="paOpp"></div><i class="pa-sw s1">' + SWEAT + '</i><i class="pa-sw s2">' + SWEAT + '</i><i class="pa-sw s3">' + SWEAT + '</i></div>' +
      '<svg class="pa-pedsvg" viewBox="0 0 176 96" aria-hidden="true"><path d="M16 30H160V88a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6z" fill="#F1E4CB" stroke="#1E2240" stroke-width="4" stroke-linejoin="round"/><rect x="6" y="8" width="164" height="26" rx="9" fill="#FFF8EC" stroke="#1E2240" stroke-width="4"/><path d="M20 16h60" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/></svg>' +
      '<div class="pa-card" id="paCard"><div class="pa-cardin"><b class="pa-f q">?</b><b class="pa-f n" id="paSecret">?</b></div></div></div>' +
      '<div class="pa-ans" id="paAns"></div></div>' +
      '<div class="pa-meRow"><div class="pa-mebean" id="paMe"></div><div class="speech big pa-say" id="paSay"><span class="bignum" id="paNum">50</span><span class="qm">?</span></div></div>' +
      '<div class="pa-ctl"><div class="sld one" id="paSld" role="slider" tabindex="0" aria-label="Number">' +
      '<div class="sld-track" id="paTrack"><i class="pick" id="paFill"></i><div class="pa-clip"><i class="pa-cut l" id="paCutL"></i><i class="pa-cut r" id="paCutR"></i></div><b class="sld-thumb" id="paThumb"></b><div class="pa-hand" id="paHand"><span class="pa-handin">' + HAND + '</span></div></div>' +
      '<div class="sld-ends"><span id="paLo">1</span><span id="paHi">100</span></div></div></div>' +
      '<div class="pa-go"><button class="btn primary big full" id="paGo">Ask</button></div>' +
      '<div id="ov" hidden></div>';
    oppMood('idle'); meMood('idle');
    var sld = $('#paSld'), tr = $('#paTrack');
    function at_(e) {
      var r = tr.getBoundingClientRect(), sc = r.width / tr.offsetWidth;
      var f = Math.min(1, Math.max(0, (e.clientX - r.left - 19 * sc) / Math.max(1, r.width - 38 * sc)));
      setX(R.lo + Math.round(f * (R.hi - R.lo)), true);
    }
    sld.addEventListener('pointerdown', function (e) {
      if (phase !== 'ask') return;
      if (!R.touched) sfx('pick');
      R.touched = true; R.demo = false; R.auto = null; R.idle0 = clock; R.drag = true;
      try { sld.setPointerCapture(e.pointerId); } catch (_) {}
      sld.classList.add('drag', 'jump'); setTimeout(function () { sld.classList.remove('jump'); }, 150);   // a tap glides the thumb there
      $('#paHand').classList.remove('on'); $('#paGo').classList.add('pulse'); at_(e); e.preventDefault();
    });
    sld.addEventListener('pointermove', function (e) { if (R.drag) { R.idle0 = clock; sld.classList.remove('jump'); at_(e); } });
    var up = function () { if (R.drag) { R.drag = false; sld.classList.remove('drag'); R.idle0 = clock; } };
    sld.addEventListener('pointerup', up); sld.addEventListener('pointercancel', up);
    sld.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d || phase !== 'ask') return;
      R.touched = true; R.demo = false; R.idle0 = clock; $('#paGo').classList.add('pulse'); setX(R.x + d, true); e.preventDefault();
    });
    $('#paGo').addEventListener('click', function () { if (phase === 'ask') { R.touched = true; ask(); } });
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  /* the bar always shows the live range [vlo, vhi]; the thumb, the yellow fill and the red "chopped" blocks are all placed from it */
  function fOf(v) { return R.vhi === R.vlo ? 0.5 : (v - R.vlo) / (R.vhi - R.vlo); }
  function place(x) {
    var f = fOf(x), p = 'calc(19px + (100% - 38px) * ' + f.toFixed(4) + ')';
    $('#paThumb').style.left = p; $('#paFill').style.width = p; $('#paHand').style.left = p;
  }
  function setView(a, b) { R.vlo = a; R.vhi = b; }
  function placeCuts(nlo, nhi) {      // the ruled-out numbers: everything below nlo, everything above nhi
    $('#paCutL').style.width = 'calc((100% - 38px) * ' + Math.max(0, fOf(nlo - 0.5)).toFixed(4) + ')';
    $('#paCutR').style.left = 'calc((100% - 38px) * ' + fOf(nhi + 0.5).toFixed(4) + ' + 38px)';
  }
  function setEnds(a, b) {
    var l = $('#paLo'), h = $('#paHi');
    if (+l.textContent !== a) { l.textContent = a; pop(l); }
    if (+h.textContent !== b) { h.textContent = b; pop(h); }
  }
  function setX(x, tickSound) {
    x = Math.min(R.hi, Math.max(R.lo, Math.round(x)));
    var f = R.hi === R.lo ? 0.5 : (x - R.lo) / (R.hi - R.lo);
    if (x !== R.x && tickSound) {
      var now = performance.now();
      if (now - (R.tickAt || 0) > 70) { R.tickAt = now; sfx('tick', { vol: 0.5, rate: 0.9 + f * 0.5 }); }
    }
    R.x = x; place(x);
    $('#paNum').textContent = x;
    $('#paSld').setAttribute('aria-valuenow', x);
  }

  /* ------------------------------------------------ rounds */
  function pickDeath() {
    var d = forcedDeath;
    if (!d) { var pool = DEATHS.filter(function (k) { return k !== lastDeath; }); d = pool[Math.floor(Math.random() * pool.length)]; }
    forcedDeath = ''; lastDeath = d; return d;
  }
  function newGame() {
    gen++; tasks = []; clearTimeout(sceneTimer);
    R = { n: 0, lo: 1, hi: MAXN, plo: 1, phi: MAXN, vlo: 1, vhi: MAXN, x: 50, secret: 0, touched: false, demo: true, drag: false, idle0: 0, demo0: 0, auto: null, tickAt: 0, tw: 0 };
    root.classList.remove('ended');
    mount();
    round();
    // the goal, in the opponent's own speech bubble; the hidden card wobbles
    at(250, function () {
      if (phase !== 'ask' || R.n) return;
      $('#paAns').innerHTML = '<span class="pa-ans-in say">Guess my number!</span>';
      $('#paAns').className = 'pa-ans on';
      $('#paCard').classList.add('wob');
      oppMood('talk'); sfx('hint', { vol: 0.8 });
    });
    at(1500, function () { if (phase === 'ask' && !R.n) oppMood('idle'); });
  }
  function round() {
    setPhase('ask');
    R.touched = false; R.demo = true; R.drag = false; R.auto = null; R.idle0 = clock; R.demo0 = clock + (R.tw ? 500 : 0);
    setView(R.lo, R.hi);
    setEnds(R.lo, R.hi);
    $('#paSld').classList.toggle('tw', !!R.tw);
    if (R.tw) at(520, function () { $('#paSld').classList.remove('tw'); });
    $('#paCutL').className = 'pa-cut l'; $('#paCutR').className = 'pa-cut r';
    $('#paGo').disabled = false; $('#paGo').classList.remove('pulse');
    pop($('#paSay'));
    meMood('talk');
    setX(Math.floor((R.lo + R.hi) / 2), false);
    $('#paHand').classList.toggle('on', R.n < 2);   // the drag hint, first two rounds
    at(R.n === 0 ? 350 : 250, function () { if (phase === 'ask' && !R.touched && R.n < 2) $('#paHand').classList.add('on'); });
  }

  /* per-frame: demo drag, auto-advance */
  function frame() {
    if (!R || phase !== 'ask') return;
    var span = R.hi - R.lo;
    if (R.auto) {
      var k = Math.min(1, (clock - R.auto.t0) / 350); k = 1 - Math.pow(1 - k, 3);
      setX(R.auto.from + (R.auto.to - R.auto.from) * k, false);
      return;
    }
    if (R.demo && clock > R.demo0) setX((R.lo + R.hi) / 2 + Math.sin((clock - R.demo0) / 650) * span * 0.3, false);
    var idle = clock - R.idle0;
    if (!R.drag && idle > (R.touched ? IDLE_TOUCHED_MS : IDLE_MS)) autoAdvance();
  }
  function autoAdvance() {
    // the ad must never stall: move to a suggested guess (the middle), then ask
    var to = R.touched ? R.x : Math.floor((R.lo + R.hi) / 2), my = gen;
    R.demo = false; R.auto = { t0: clock, from: R.x, to: to };
    $('#paHand').classList.remove('on'); $('#paGo').classList.add('pulse');
    at(500, function () { if (my === gen && phase === 'ask' && R.auto) ask(); });
  }

  /* squeeze: flash the ruled-out part, chop it away with a thud, then rescale what is left to fill the whole bar */
  function squeeze(nlo, nhi, final) {
    placeCuts(nlo, nhi);
    $('#paCutL').className = 'pa-cut l on chop'; $('#paCutR').className = 'pa-cut r on chop';
    at(260, function () {
      sfx('k_crack', { vol: 0.7, rate: 1.7 }); sfx('land', { vol: 1, delay: 0.02 });
      $('#paSld').classList.add('tw', 'jolt'); at(500, function () { $('#paSld').classList.remove('jolt'); });
      if (final) setView(nlo - 0.6, nhi + 0.6); else setView(nlo, nhi);
      placeCuts(nlo, nhi); place(R.x);
      setEnds(nlo, nhi);
      $('#paCutL').classList.add('gone'); $('#paCutR').classList.add('gone');
      var me = $('#paMe'); meMood('happy'); me.classList.remove('hop'); void me.offsetWidth; me.classList.add('hop');
    });
  }

  function ask() {
    if (phase !== 'ask') return;
    setPhase('think');
    var x = R.x; R.auto = null; R.demo = false; R.n++;
    var pips = $('#paPips').children; if (pips[R.n - 1]) pips[R.n - 1].className = 'on';
    $('#paGo').disabled = true; $('#paGo').classList.remove('pulse'); $('#paHand').classList.remove('on');
    $('#paAns').className = 'pa-ans';
    sfx('send');
    meMood('talk'); pop($('#paSay'));
    oppMood('talk');
    R.tw = 1;
    if (R.n < 3) {
      // Kind rig: the answer always keeps the bigger half, so the viewer is never boxed in.
      var higher = (R.hi - x) >= (x - R.lo);
      if (x >= R.hi) higher = false; else if (x <= R.lo) higher = true;
      var nlo = higher ? x + 1 : R.lo, nhi = higher ? R.hi : x - 1;
      at(300, function () {
        setPhase('answer');
        $('#paAns').innerHTML = '<span class="pa-ans-in ' + (higher ? 'hi' : 'lo') + '"><i class="pa-arr">' + (higher ? UP : DN) + '</i><b class="dirword ' + (higher ? 'hi' : 'lo') + '">' + (higher ? 'HIGHER' : 'LOWER') + '</b></span>';
        $('#paAns').className = 'pa-ans on';
        sfx(higher ? 'yes' : 'nope');
        nerve(R.n);
        R.plo = R.lo; R.phi = R.hi; R.lo = nlo; R.hi = nhi;
        squeeze(nlo, nhi, false);
      });
      at(1650, round);
    } else {
      // Third guess: the secret is whatever the viewer picked (inside the remaining range), so it is always right.
      R.secret = x;
      at(300, function () {
        setPhase('answer');
        $('#paSecret').textContent = x;
        $('#paCard').classList.add('rev');
        $('#paAns').innerHTML = '<span class="pa-ans-in ok"><i class="pa-tick">' + TICK + '</i></span>';
        $('#paAns').className = 'pa-ans on';
        sfx('yes');
        nerve(3);
        R.plo = R.lo; R.phi = R.hi; R.lo = x; R.hi = x;
        squeeze(x, x, true);
      });
      at(1500, scene);
    }
  }

  /* ------------------------------------------------ the death scene: one of the game's own scenes, never the same twice in a row */
  function scene() {
    setPhase('scene');
    var ov = $('#ov'), k = deathNow = pickDeath();
    ov.innerHTML = '<div class="sheet center pa-sheet"><div class="stage" data-death="' + k + '">' + SCENES[k](OPP, null, String(R.secret)) + '</div></div>';
    ov.hidden = false;
    deathSfx(k);
    at(CUT_MS[k], function () { ov.hidden = true; ov.innerHTML = ''; end(); });
  }

  /* ------------------------------------------------ end card */
  function end() {
    setPhase('end');
    var conf = '';
    for (var i = 0; i < 26; i++) conf += '<i class="fall" style="left:' + ((i * 37) % 96) + '%;animation-delay:' + (((i * 53) % 24) / 10).toFixed(2) + 's;background:' + COLORS[i % 6] + '"></i>';
    var to = ELO_FROM + ELO_D, a = Math.round(rankFrac(ELO_FROM) * 100), b = Math.round(rankFrac(to) * 100);
    var er = '<div class="er"><div class="elo-res up" id="paElo"><span class="d">' + eloDeltaTxt(ELO_D) + '</span><b id="paEloN">' + ELO_FROM + '</b><span class="rk"><span class="bd">' + rankBadge(to) + '</span><span class="nm">' + rankName(to) + '</span></span></div><div class="er-bar" style="--a:' + a + '%;--b:' + b + '%"><i></i></div></div>';
    var el = D.createElement('div'); el.id = 'paEnd'; el.className = 'pa-end';
    el.innerHTML = '<button class="pa-replay" id="paReplay" aria-label="Replay">' + REPLAY + '</button>' +
      '<h1 class="logo big">High<span>&amp;</span>Low</h1>' +
      '<div class="sheet center pa-win"><div class="stage">' + conf + '<div class="actor a-hop">' + charSVG(ME, 'happy') + '</div></div><h2>You win!</h2>' + er + '</div>' +
      '<p class="pa-line">Now beat a real player</p><button class="btn go big pa-cta" id="paCta">Play free</button>';
    root.appendChild(el); root.classList.add('ended');
    var fired = 0;
    el.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('#paReplay')) return;
      sfx('pick'); fire();
    });
    $('#paReplay').addEventListener('click', function (e) { e.stopPropagation(); sfx('pick'); newGame(); });
    sfx('win');
    var t0 = clock;
    (function cnt() {
      // the rating counts up from 1000 to 1020
      at(30, function () {
        var k = Math.min(1, Math.max(0, (clock - t0 - 450) / 900)); k = 1 - Math.pow(1 - k, 3);
        var n = $('#paEloN'); if (n) n.textContent = Math.round(ELO_FROM + ELO_D * k);
        if (k < 1) cnt();
      });
    })();
    try { W.HLP && W.HLP.end && W.HLP.end(); } catch (e) {}
  }
  function fire() { try { W.HLP && W.HLP.cta && W.HLP.cta(); } catch (e) {} }

  /* ------------------------------------------------ lifecycle */
  function pause() {
    if (paused) return; paused = true; D.body.classList.add('pa-paused');
    try { ctx && ctx.suspend(); } catch (e) {}
  }
  function resume() {
    if (!started) return start();
    if (!paused) return; paused = false; lastT = performance.now(); D.body.classList.remove('pa-paused');
    try { ctx && ctx.resume(); } catch (e) {}
  }
  function start() {
    if (started) return resume();
    started = true; paused = false; lastT = performance.now();
    newGame();
  }
  function init() {
    root = $('#ad');
    $('#sky').innerHTML = homeSceneHTML();
    fit(); W.addEventListener('resize', fit); W.addEventListener('orientationchange', fit);
    setInterval(tick, 30);
    D.addEventListener('visibilitychange', function () { if (D.hidden) pause(); else if (started) resume(); });
    W.addEventListener('pagehide', pause);
    var g = { start: start, pause: pause, resume: resume };
    g.setDeath = function (k) { forcedDeath = k; };
    g.death = function () { return deathNow; };
    g.audioState = function () { return ctx ? ctx.state : 'none'; };
    W.__hlad = g;
    if (W.HLP && W.HLP.boot) W.HLP.boot(g); else start();
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init); else init();
})();
