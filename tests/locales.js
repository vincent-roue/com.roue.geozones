'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const basePath = path.join(__dirname, '..', 'locales');
const languages = ['en', 'fr', 'nl', 'de'];
const localeData = Object.fromEntries(languages.map(lang => [lang, JSON.parse(fs.readFileSync(path.join(basePath, `${lang}.json`), 'utf8'))]));

function flatten(obj, prefix = '') {
  return Object.entries(obj || {}).reduce((acc, [key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) Object.assign(acc, flatten(value, nextKey));
    else acc[nextKey] = value;
    return acc;
  }, {});
}

function placeholders(value) {
  return Array.from(String(value || '').matchAll(/__([a-zA-Z0-9]+)__/g)).map(match => match[1]).sort();
}

const reference = flatten(localeData.en);
for (const lang of languages.slice(1)) {
  const flattened = flatten(localeData[lang]);
  assert.deepStrictEqual(Object.keys(flattened).sort(), Object.keys(reference).sort(), `${lang}.json must contain the same locale keys as en.json`);
  for (const key of Object.keys(reference)) {
    assert.deepStrictEqual(placeholders(flattened[key]), placeholders(reference[key]), `${lang}.json must preserve the same placeholders as en.json for key ${key}`);
  }
}

console.log('Locale consistency checks passed');
