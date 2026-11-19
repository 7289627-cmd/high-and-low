const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '../../..');
const page = readFileSync(path.join(root, 'support.html'), 'utf8');
const locales = readdirSync(path.join(root, 'dev/src/locales')).map(file => file.replace('.json', ''));

test('the support page serves help and contact links in each game language', () => {
  for (const locale of locales) {
    const dom = new JSDOM(page, { url: 'https://localhost/support.html?lang=' + locale, runScripts: 'dangerously' });
    const doc = dom.window.document;
    try {
      dom.window.eval(readFileSync(path.join(root, 'support-languages.js'), 'utf8'));
      assert.equal(doc.documentElement.lang, locale);
      assert.equal(doc.documentElement.dir, locale === 'ar' ? 'rtl' : 'ltr');
      assert.notEqual(doc.querySelector('summary').textContent, 'How do I play?');
      assert.equal(doc.querySelectorAll('details').length, 5);
      assert.equal(doc.querySelector('#report-ad + p a').protocol, 'mailto:');
      assert.equal(doc.querySelector('#contact').protocol, 'mailto:');
      assert.equal(doc.querySelector('nav a[href="privacy.html"]').href, 'https://localhost/privacy.html');
    } finally {
      dom.window.close();
    }
  }
});
