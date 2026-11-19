const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../src/i18n.js'), 'utf8');
const catalogs = {
  'es-419': { Play: 'Jugar', '{name} wins!': '¡Gana {name}!' },
  fr: { Play: 'Jouer', '{name} wins!': '{name} gagne !', '{count} kills': '{count} éliminations' },
  'pt-BR': { Play: 'Jogar' },
  ar: { Play: 'العب' },
  'zh-Hans': { Play: '开始' },
  'zh-Hant': { Play: '開始' },
};

function client(languages, stored = new Map()) {
  const document = { documentElement: {} };
  const localStorage = {
    getItem: key => stored.get(key),
    setItem: (key, value) => stored.set(key, value),
    removeItem: key => stored.delete(key),
  };
  const window = { HL_TRANSLATIONS: catalogs };
  const context = vm.createContext({
    document, localStorage, navigator: { languages }, window,
    esc: text => String(text).replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
  });
  vm.runInContext(source, context);
  return { api: window.HLI18n, context, document };
}

test('honors device preference order and persists a manual override', () => {
  const stored = new Map();
  const { api, document } = client(['en-AU', 'fr-CA'], stored);
  assert.equal(api.locale(), 'en');
  api.set('fr');
  assert.equal(document.documentElement.lang, 'fr');
  assert.equal(client(['pt-PT'], stored).api.t('Play'), 'Jouer');
  api.set('auto');
  assert.equal(client(['pt-PT'], stored).api.t('Play'), 'Jogar');
  assert.equal(client(['de', 'es-MX']).api.t('Play'), 'Jugar');
  assert.equal(client(['de']).api.t('Play'), 'Play');
});

test('selects Chinese script and mirrors the document for Arabic', () => {
  assert.equal(client(['zh-HK']).api.locale(), 'zh-Hant');
  assert.equal(client(['zh-CN']).api.locale(), 'zh-Hans');
  const { api, document } = client(['ar-EG']);
  assert.equal(document.documentElement.dir, 'rtl');
  api.set('en');
  assert.equal(document.documentElement.dir, 'ltr');
});

test('clients can display the same player name and match result independently', () => {
  const values = { name: 'Play <bean>' };
  const french = client(['fr']);
  const spanish = client(['es-419']);
  assert.equal(french.api.t('{name} wins!', values), 'Play <bean> gagne !');
  assert.equal(spanish.api.t('{name} wins!', values), '¡Gana Play <bean>!');
  assert.equal(values.name, 'Play <bean>');
  assert.equal(vm.runInContext(`uiHTML('{name} wins!', { name: 'Play <bean>' })`, spanish.context), '¡Gana Play &lt;bean&gt;!');
  assert.equal(spanish.api.t('Fallback {name}', values), 'Fallback Play <bean>');
});

test('normalizes keyboard digits to the same ASCII values used on the wire', () => {
  const { context } = client(['ar']);
  const typed = '9٩۹९９';
  assert.equal(vm.runInContext(`Array.from(${JSON.stringify(typed)}, keypadDigit).join('')`, context), '99999');
  assert.equal(vm.runInContext(`keypadDigit('Enter')`, context), null);
});

test('chooses English singular and keeps the localized count if a singular is missing', () => {
  const one = '{count} kill';
  const other = '{count} kills';
  assert.equal(client(['en']).api.pluralKey(one, other, 1), one);
  assert.equal(client(['en']).api.pluralKey(one, other, 2), other);
  assert.equal(client(['fr']).api.pluralKey(one, other, 1), other);
});
