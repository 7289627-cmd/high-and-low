const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const sound = fs.readFileSync(path.join(__dirname, '../src/sound.js'), 'utf8');
const music = fs.readFileSync(path.join(__dirname, '../src/music.js'), 'utf8');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function harness({ failFirstCreate = false, muted = false, delivery = 'ok' } = {}) {
  const handlers = { document: new Map(), window: new Map() };
  function target(which) {
    const m = handlers[which];
    return {
      addEventListener(type, fn) { if (!m.has(type)) m.set(type, []); m.get(type).push(fn); },
      removeEventListener(type, fn) { m.set(type, (m.get(type) || []).filter(x => x !== fn)); },
      fire(type) { for (const fn of [...(m.get(type) || [])]) fn({ type }); },
    };
  }
  const document = { ...target('document'), hidden: false, visibilityState: 'visible' };
  const window = target('window');
  let creates = 0;
  const gain = () => ({ gain: { value: 1, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, setValueCurveAtTime() {} }, connect() {} });
  class AudioContext {
    constructor() { if (++creates === 1 && failFirstCreate) throw new Error('temporary native audio failure'); this.state = 'suspended'; this.currentTime = 0; this.destination = {}; this.resumes = 0; }
    resume() { this.resumes++; this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    createGain() { return gain(); }
    createDynamicsCompressor() { throw new Error('optional'); }
    createBufferSource() { return { playbackRate: { value: 1 }, connect() {}, start() {}, stop() {}, disconnect() {} }; }
    decodeAudioData(bytes, ok) { const b = { duration: 2, length: 2, sampleRate: 1, numberOfChannels: 1, getChannelData: () => new Float32Array([0.5, 0.5]) }; ok(b); return Promise.resolve(b); }
  }
  window.AudioContext = AudioContext;
  window.location = { protocol: 'capacitor:', hostname: 'localhost', host: 'localhost', href: 'capacitor://localhost/index.html' };
  const storage = new Map(muted ? [['hl-mute', '1']] : []);
  const localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
  const sample = fs.readFileSync(path.join(__dirname, '../../sfx/pick.mp3'));
  const bytes = sample.buffer.slice(sample.byteOffset, sample.byteOffset + sample.byteLength);
  const context = vm.createContext({ window, document, navigator: {}, localStorage, setTimeout, clearTimeout, Float32Array, URL,
    fetch: async name => ({ ok: delivery === 'ok' || delivery === 'emptyOk', status: delivery === 'http404' ? 404 : delivery === 'ok' || delivery === 'emptyOk' ? 200 : 0,
      type: delivery === 'opaque' ? 'opaque' : 'basic',
      url: (delivery === 'remote0' ? 'https://other.example/' : 'capacitor://localhost/') + name,
      arrayBuffer: async () => delivery === 'empty' || delivery === 'emptyOk' ? new ArrayBuffer(0) : bytes.slice(0) }) });
  vm.runInContext(sound + '\n' + music, context);
  return { document, window, context, storage, get: expr => vm.runInContext(expr, context) };
}

test('a transient AudioContext creation failure retries sound and music on the next gesture', async () => {
  const h = harness({ failFirstCreate: true });
  h.document.fire('pointerdown');
  await pause(10);
  assert.equal(h.get('SFX.ctx'), null);
  h.document.fire('pointerdown');
  await pause(30);
  assert.ok(h.get('SFX.ctx'), 'audio context should be retried');
  assert.equal(h.get('MUSIC.ok'), true, 'music should initialize when the retry succeeds');
  assert.ok(h.get('SFX.buf.pick'), 'sound samples should decode after retry');
});

test('a later user gesture retries an interrupted context after a background resume fails', async () => {
  const h = harness();
  h.document.fire('pointerdown');
  await pause(10);
  h.document.fire('touchend'); // a normal successful unlock must not remove future recovery
  const c = h.get('SFX.ctx');
  c.state = 'interrupted';
  c.resume = function () { this.resumes++; if (this.resumes === 2) return Promise.reject(new Error('gesture required')); this.state = 'running'; return Promise.resolve(); };
  h.window.fire('pageshow');
  await pause(10);
  assert.equal(c.state, 'interrupted');
  h.document.fire('touchend');
  await pause(10);
  assert.equal(c.state, 'running');
});

test('a muted preference is retained when audio initializes', async () => {
  const h = harness({ muted: true });
  h.document.fire('pointerdown');
  await pause(20);
  assert.equal(h.get('SFX.muted'), true);
  assert.equal(h.storage.get('hl-mute'), '1');
  assert.equal(h.get('MUSIC.out.gain.value'), 0);
});

test('nonempty local Capacitor audio with status zero loads sound and music', async () => {
  const h = harness({ delivery: 'local0' });
  h.document.fire('pointerdown');
  await pause(30);
  assert.ok(h.get('SFX.buf.pick'), 'local sound data was discarded');
  assert.ok(h.get('MUSIC.T.home.buf'), 'local music data was discarded');
});

for (const delivery of ['empty', 'emptyOk', 'opaque', 'remote0', 'http404']) {
  test(`${delivery} audio responses are rejected`, async () => {
    const h = harness({ delivery });
    h.document.fire('pointerdown');
    await pause(30);
    assert.equal(h.get('SFX.buf.pick'), undefined);
    assert.equal(h.get('MUSIC.T.home.buf'), null);
  });
}
