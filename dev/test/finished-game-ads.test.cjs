const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const { JSDOM } = require('jsdom');

const dev = path.join(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-game-ads-'));
after(() => fs.rmSync(temp, { recursive: true, force: true }));
fs.copyFileSync(path.join(dev, 'build.py'), path.join(temp, 'build.py'));
fs.cpSync(path.join(dev, 'src'), path.join(temp, 'src'), { recursive: true });
fs.mkdirSync(path.join(temp, 'test'));
execFileSync(process.env.HL_TEST_PYTHON || 'python3', ['-X', 'utf8', path.join(temp, 'build.py')]);
const game = fs.readFileSync(path.join(temp, 'test', '_built.js'), 'utf8');

function phone(t, native) {
  const dom = new JSDOM('<main id="app"></main><div id="ov" hidden></div>', {
    url: 'https://localhost/', runScripts: 'dangerously', pretendToBeVisual: true,
    virtualConsole: new (require('jsdom').VirtualConsole)(),
  });
  const w = dom.window;
  t.after(() => w.close());
  w.HL_NO_TRACK = true;
  if (native) w.HLNative = native;
  const script = w.document.createElement('script');
  script.text = game;
  w.document.body.append(script);
  return w;
}

function startGame(w) {
  w.eval(`startSolo(); hostStart(); G.phase='play'; G.stage='show'; update()`);
}

function finishGame(w) {
  w.eval(`G.players.slice(1).forEach(p => { p.a=0 }); advance(G.seq); update()`);
}

function resultButton(w, selector) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Result button did not appear')), 2500);
    const observer = new w.MutationObserver(() => {
      const button = w.document.querySelector(selector);
      if (button) { clearTimeout(timeout); observer.disconnect(); resolve(button); }
    });
    observer.observe(w.document.querySelector('#ov'), { childList: true });
  });
}

test('requests an ad automatically on the first result and on each new round', async t => {
  const attempts = [];
  const w = phone(t, { showInterstitial(current) {
    attempts.push({ round: w.eval('G.gid'), current, resultOpen: !w.document.getElementById('ov').hidden });
    return Promise.resolve(false);
  } });

  startGame(w);
  assert.equal(attempts.length, 0);
  finishGame(w);
  assert.equal(attempts.length, 0, 'allows the existing transition to finish');
  const close = await resultButton(w, '#ovClose');
  assert.equal(attempts.length, 1, 'first finished round makes an automatic attempt');
  assert.equal(attempts[0].resultOpen, true, 'the attempt occurs when the result opens');
  assert.equal(attempts[0].current(), true);

  w.eval('update(); G.en++; update(); {const saved=G; G=null; update(); G=saved;} G.phase="play"; update(); G.phase="over"; update()');
  assert.equal(attempts.length, 1, 'repeat renders and replayed state do not request again');

  close.click();
  assert.equal(attempts[0].current(), false, 'closing results cancels presentation even before changing rounds');
  w.document.querySelector('#toLobby').click();
  assert.equal(w.eval('G.phase'), 'lobby', 'ad no-fill does not block Play again');
  startGame(w);
  finishGame(w);
  const playAgain = await resultButton(w, '#ovLobby');
  assert.equal(attempts.length, 2);
  assert.notEqual(attempts[0].round, attempts[1].round);
  playAgain.click();
  assert.equal(w.eval('G.phase'), 'lobby');
});

test('does not advertise on an early exit, restored result, or hidden result', async t => {
  let attempts = 0;
  const w = phone(t, { showInterstitial() { attempts++; return new Promise(() => {}); } });
  startGame(w);
  const restored = w.eval('JSON.stringify(G)');
  await w.eval('leaveGame()');
  assert.equal(attempts, 0, 'leaving normal play is not an ad opportunity');

  w.eval(`startSolo(); G=${restored}; G.phase='over'; update()`);
  assert.equal(attempts, 0, 'an already-completed round sent on reconnect is not a new result');
  await w.eval('leaveGame()');

  Object.defineProperty(w.document, 'hidden', { value: true, configurable: true });
  startGame(w);
  finishGame(w);
  Object.defineProperty(w.document, 'hidden', { value: false });
  w.eval('update()');
  assert.equal(attempts, 0, 'background completion cannot trigger an ad upon return');
  assert.ok(await resultButton(w, '#ovLobby'));

  await w.eval('leaveGame()');
  Object.defineProperty(w.navigator, 'onLine', { value: false, configurable: true });
  startGame(w);
  finishGame(w);
  assert.ok(await resultButton(w, '#ovLobby'));
  assert.equal(attempts, 0, 'an offline result cannot attempt native presentation');
});

test('keeps web results available with no native bridge', async t => {
  const w = phone(t);
  startGame(w);
  finishGame(w);
  const close = await resultButton(w, '#ovClose');
  close.click();
  assert.equal(w.document.getElementById('ov').hidden, true);
  assert.equal(w.eval('G.phase'), 'over');
});

test('a public opponent leaving early still shows the win without an ad', async t => {
  let attempts = 0;
  const w = phone(t, { showInterstitial() { attempts++; return Promise.resolve(true); } });
  startGame(w);
  w.eval(`G.pub=1; isPub=true; mode='online'; G.players.length=2;
    const opponent=G.players[1]; opponent.bot=0;
    peerMap.set(opponent.pid,{pres:{gone:true}}); update()`);
  assert.equal(w.eval('G.phase'), 'over');
  assert.ok(await resultButton(w, '#againBtn'));
  assert.equal(attempts, 0);
});

test('a room update cannot reopen results or advertise while an early exit is pending', async t => {
  let attempts = 0;
  const w = phone(t, { showInterstitial() { attempts++; return Promise.resolve(true); } });
  startGame(w);
  const leaving = w.eval(`R={leave:()=>new Promise(r=>window.finishDisconnect=r),presence:()=>Promise.resolve()};leaveGame()`);
  w.eval('update()');
  finishGame(w);
  await new Promise(resolve => setTimeout(resolve, 1000));
  assert.equal(attempts, 0);
  assert.equal(w.document.getElementById('ov').hidden, true);
  w.finishDisconnect();
  await leaving;
});
