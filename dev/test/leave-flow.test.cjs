const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');

const dev = path.join(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-leave-'));
after(() => fs.rmSync(temp, { recursive: true, force: true }));
fs.copyFileSync(path.join(dev, 'build.py'), path.join(temp, 'build.py'));
fs.cpSync(path.join(dev, 'src'), path.join(temp, 'src'), { recursive: true });
fs.mkdirSync(path.join(temp, 'test'));
execFileSync(process.env.HL_TEST_PYTHON || 'python3', ['-X', 'utf8', path.join(temp, 'build.py')]);
const game = fs.readFileSync(path.join(temp, 'test', '_built.js'), 'utf8');
const wrapper = fs.readFileSync(path.join(dev, 'app', 'native', 'hlnative.js'), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
async function until(check) {
  const deadline = Date.now() + 5000;
  while (!check()) {
    assert.ok(Date.now() < deadline, 'Game did not reach the expected view');
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

async function phone(t) {
  const { window: w } = new JSDOM('<main id="app"></main><div id="ov" hidden></div>', {
    url: 'https://localhost/', runScripts: 'dangerously', pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),
  });
  t.after(() => w.close());
  const listeners = new Map();
  let exitCalls = 0;
  w.Capacitor = { getPlatform: () => 'android', Plugins: { App: {
    addListener(name, fn) { listeners.set(name, fn); return Promise.resolve(); },
    exitApp() { exitCalls++; return Promise.resolve(); },
  } } };
  w.HL_NATIVE_CONFIG = { ADS_ENABLED: false };
  w.HL_NO_TRACK = true;
  for (const text of [wrapper, game]) {
    const script = w.document.createElement('script');
    script.text = text;
    w.document.body.append(script);
  }
  await new Promise(resolve => w.setTimeout(resolve, 0));
  assert.ok(listeners.has('backButton'));
  const room = { leaves: 0, onConnection() {}, onPeers(fn) { this.peers = fn; },
    presence() { return Promise.resolve(); },
    leave() { this.leaves++; return Promise.resolve(); },
  };
  w.fakeRoom = room;
  w.eval('roomNS = { join: async () => fakeRoom }; roomState = "ok"');
  const click = id => {
    const el = w.document.getElementById(id);
    assert.ok(el, `Missing #${id}`);
    el.click();
  };
  return { w, room, click, back: () => listeners.get('backButton')(), exits: () => exitCalls };
}

function assertHome(w) {
  assert.equal(w.eval('view'), 'home');
  assert.equal(w.eval('R'), null);
  assert.equal(w.eval('G'), null);
  assert.equal(w.eval('!!LS.get(LSK("hl-session"))'), false);
}

for (const host of [true, false]) {
  test(`${host ? 'host' : 'guest'} can leave the friends lobby using its visible button`, async t => {
    const { w, room, click } = await phone(t);
    await w.eval(`startOnline(${host}, 'ABCD')`);
    if (!host) {
      const lobby = w.eval(`({...newLobby(), players: [{ pid: 'host123', name: 'Host', c: 0, a: 1 }, ...newLobby().players]})`);
      room.peers({ peers: [{ updatedAt: 1, presence: { pid: 'host123', code: 'ABCD', role: 'host', game: lobby } }] });
      await settle();
    }
    assert.equal(w.eval('G.phase'), 'lobby');
    assert.ok(w.eval('LS.get(LSK("hl-session"))'));
    click('leaveBtn');
    await settle();
    assertHome(w);
    assert.equal(room.leaves, 1);
    if (host) assert.equal(w.eval('!!LS.get("hl-host-ABCD")'), false);
  });
}

test('Friends room guests see the same room and player name with independently localized controls', async t => {
  const host = await phone(t);
  const guest = await phone(t);
  host.w.eval(`HLI18n.set('es-419'); NAME = 'Play'`);
  guest.w.eval(`HLI18n.set('fr'); NAME = 'Close'`);
  await host.w.eval(`startOnline(true, 'ABCD')`);
  await guest.w.eval(`startOnline(false, 'ABCD')`);
  const lobby = JSON.parse(host.w.eval('JSON.stringify(G)'));
  const pid = host.w.eval('PID');
  guest.room.peers({ peers: [{ updatedAt: 1, presence: { pid, code: 'ABCD', role: 'host', game: lobby } }] });
  await until(() => guest.w.eval(`G?.phase === 'lobby'`));
  for (const phone of [host, guest]) {
    assert.equal(phone.w.document.querySelector('.bar .pill').textContent, 'ABCD');
    assert.equal(phone.w.document.querySelector('.prow2 .who b').textContent, 'Play');
  }
  const hostLabel = host.w.document.getElementById('leaveBtn').textContent;
  const guestLabel = guest.w.document.getElementById('leaveBtn').textContent;
  assert.notEqual(hostLabel, 'Leave');
  assert.notEqual(guestLabel, 'Leave');
  assert.notEqual(hostLabel, guestLabel);
});

test('leaving while a friends room is connecting releases the late channel', async t => {
  const { w, room, click } = await phone(t);
  w.eval('roomNS.join = () => new Promise(resolve => { window.finishJoin = resolve })');
  const opening = w.eval("startOnline(false, 'ABCD')");
  click('leaveBtn');
  await settle();
  assertHome(w);
  w.finishJoin(room);
  await opening;
  assertHome(w);
  assert.equal(room.leaves, 1);
  assert.equal(w.eval('tickTimer'), null);
});

test('Android Back leaves number picking after a private rematch', async t => {
  const { w, room, click, back, exits } = await phone(t);
  await w.eval(`startOnline(true, 'ABCD')`);
  w.eval(`addBot(); hostStart(); G.phase='over'; G.win=PID; showWinner()`);
  click('ovLobby');
  await settle();
  click('startBtn');
  await settle();
  assert.match(w.document.getElementById('app').textContent, /Pick your number/);
  back();
  await settle();
  assertHome(w);
  assert.equal(room.leaves, 1);
  assert.equal(exits(), 0);
  back();
  assert.equal(exits(), 1);
});

test('one Leave tap exits public rematch number picking without a rating penalty', async t => {
  const { w, room, click } = await phone(t);
  w.HL_CONFIG = {};
  w.HL_TEST_Q_MS = 20;
  w.HL_TEST_FILL_MS = 20;
  w.makeSupabaseQueue = () => ({ join() {}, leave() {}, onOpen() {}, announce() {} });
  await w.eval(`startOnline(true, 'ABCD', true)`);
  w.eval(`G.pub=1; addBot(); hostStart(); G.phase='over'; G.win=PID; showWinner()`);
  const round = w.eval('G.gid');
  click('againBtn');
  await until(() => w.eval(`G?.phase==='secrets' && G.gid!==${JSON.stringify(round)}`));
  assert.equal(w.eval('G.pub'), 1);
  assert.match(w.document.getElementById('app').textContent, /Pick your number/);
  const rating = w.eval('myElo()');
  click('leaveBtn');
  await settle();
  assertHome(w);
  assert.equal(room.leaves, 2);
  assert.equal(w.eval('myElo()'), rating);
});

test('Android Back still gives a rated forfeiture warning with a cancel action', async t => {
  const { w, click, back, exits } = await phone(t);
  w.eval(`startSolo(true); addBot(); G.max=playMode().max; hostStart(); G.phase='play'; G.stage='await'; update()`);
  const rating = w.eval('myElo()');
  back();
  assert.match(w.document.getElementById('ov').textContent, /You'll lose \d+ rating/);
  click('stayBtn');
  assert.equal(w.eval('view'), 'game');
  assert.equal(w.eval('myElo()'), rating);
  back();
  click('quitBtn');
  await settle();
  assertHome(w);
  assert.ok(w.eval('myElo()') < rating);
  assert.equal(exits(), 0);
});

test('active unrated games keep the confirmation visible during a redraw', async t => {
  const { w, click, back } = await phone(t);
  w.eval(`startSolo(); hostStart(); G.phase='play'; G.stage='await'; render(true)`);
  back();
  const dialog = w.document.querySelector('#ov [role=dialog]');
  assert.match(dialog.textContent, /Leave the game\?/);
  w.eval('render(true)');
  assert.equal(w.document.querySelector('#ov [role=dialog]'), dialog);
  assert.equal(w.document.getElementById('ov').hidden, false);
  click('quitBtn');
  await settle();
  assertHome(w);
});
