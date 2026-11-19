const HLI18n = (() => {
  const catalogs = window.HL_TRANSLATIONS || {};
  const names = {
    en: 'English', 'es-419': 'Español (Latinoamérica)', fr: 'Français',
    'pt-BR': 'Português (Brasil)', id: 'Bahasa Indonesia', ja: '日本語',
    ar: 'العربية', hi: 'हिन्दी', 'zh-Hans': '简体中文', 'zh-Hant': '繁體中文', ko: '한국어',
  };
  const available = Object.keys(names).filter(locale => locale === 'en' || Object.keys(catalogs[locale] || {}).length);
  const storageKey = 'hl-language';
  let preference = 'auto';
  let locale;
  let numberFormat;
  let plurals;

  function matchLanguage(language) {
    const lower = String(language || '').toLowerCase();
    const direct = available.find(candidate => candidate.toLowerCase() === lower);
    if (direct) return direct;
    const base = lower.split('-')[0];
    if (base === 'zh') {
      const script = /(?:^|-)(?:hant|tw|hk|mo)(?:-|$)/.test(lower) ? 'zh-Hant' : 'zh-Hans';
      return available.includes(script) ? script : null;
    }
    return available.find(candidate => candidate.toLowerCase().split('-')[0] === base) || null;
  }

  function resolve() {
    const preferred = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : [];
    locale = preference === 'auto' ? preferred.map(matchLanguage).find(Boolean) || 'en' : preference;
    numberFormat = new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale);
    plurals = new Intl.PluralRules(locale);
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    }
  }

  try {
    const saved = localStorage.getItem(storageKey);
    if (available.includes(saved)) preference = saved;
  } catch (_) {}
  resolve();

  return {
    locale: () => locale,
    preference: () => preference,
    languages: () => available.map(code => ({ code, label: names[code] })),
    set(value) {
      if (value !== 'auto' && !available.includes(value)) return;
      preference = value;
      try {
        if (value === 'auto') localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, value);
      } catch (_) {}
      resolve();
    },
    t(key, values = {}) {
      const catalog = catalogs[locale];
      const message = catalog && Object.prototype.hasOwnProperty.call(catalog, key) ? catalog[key] : key;
      return String(message).replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (token, name) => (
        Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : token
      ));
    },
    number: value => numberFormat.format(value),
    pluralKey(one, other, count) {
      const translated = catalogs[locale];
      if (plurals.select(count) === 'one' && (!translated || translated[one] || !translated[other])) return one;
      return other;
    },
  };
})();
window.HLI18n = HLI18n;
const uiText = (key, values) => HLI18n.t(key, values);
const uiHTML = (key, values) => esc(uiText(key, values));
// Used by the few messages with controls or emphasis inside the sentence.
// The sentence is escaped first and callers supply only trusted HTML fragments.
const uiMarkup = (key, fragments) => uiHTML(key).replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g,
  (token, name) => Object.prototype.hasOwnProperty.call(fragments, name) ? fragments[name] : token);

function keypadDigit(key) {
  if (typeof key !== 'string' || key.length !== 1) return null;
  const code = key.charCodeAt(0);
  for (const zero of [0x30, 0x660, 0x6f0, 0x966, 0xff10]) {
    if (code >= zero && code <= zero + 9) return String(code - zero);
  }
  return null;
}
