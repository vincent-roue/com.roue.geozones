'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const basePath = path.join(__dirname, '..', 'locales');
const languages = ['en', 'fr', 'nl', 'de'];
const localeData = Object.fromEntries(languages.map(lang => [lang, JSON.parse(fs.readFileSync(path.join(basePath, `${lang}.json`), 'utf8'))]));

function flatten(obj, prefix = '') {
  if (typeof obj === 'string') return { [prefix]: obj };
  return Object.entries(obj || {}).reduce((acc, [key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') Object.assign(acc, flatten(value, nextKey));
    else acc[nextKey] = value;
    return acc;
  }, {});
}

function placeholders(value) {
  return Array.from(String(value || '').matchAll(/__([a-zA-Z0-9]+)__|\[\[([^\]]+)\]\]/g)).map(match => match[1] || match[2]).sort();
}

function checkLanguages(data, label) {
  const reference = flatten(data.en);
  for (const lang of languages) {
    assert(data[lang], `${label}: missing ${lang}`);
    const translated = flatten(data[lang]);
    assert.deepStrictEqual(Object.keys(translated).sort(), Object.keys(reference).sort(), `${label}: ${lang} keys`);
    for (const key of Object.keys(reference)) {
      assert.strictEqual(typeof translated[key], 'string', `${label}: ${lang}.${key} must be text`);
      assert(translated[key].trim(), `${label}: ${lang}.${key} must not be empty`);
      assert(!/\uFFFD|Ã©|Ã¨|â€™/.test(translated[key]), `${label}: ${lang}.${key} must be valid UTF-8`);
      assert.deepStrictEqual(placeholders(translated[key]), placeholders(reference[key]), `${label}: ${lang}.${key} parameters`);
    }
  }
  return Object.keys(reference).length;
}

const reference = flatten(localeData.en);
for (const lang of languages.slice(1)) {
  const flattened = flatten(localeData[lang]);
  assert.deepStrictEqual(Object.keys(flattened).sort(), Object.keys(reference).sort(), `${lang}.json must contain the same locale keys as en.json`);
  for (const key of Object.keys(reference)) {
    assert.deepStrictEqual(placeholders(flattened[key]), placeholders(reference[key]), `${lang}.json must preserve the same placeholders as en.json for key ${key}`);
  }
}

checkLanguages(localeData, 'Backend locales');
const root = path.join(__dirname, '..');
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}
let localizedFields = 0;
function checkManifest(value, label) {
  if (!value || typeof value !== 'object') return;
  if (Object.prototype.hasOwnProperty.call(value, 'en')) {
    localizedFields += checkLanguages(value, label);
    return;
  }
  for (const [key, item] of Object.entries(value)) checkManifest(item, `${label}.${key}`);
}
for (const file of [...files(path.join(root, '.homeycompose')), ...files(path.join(root, 'drivers'))].filter(file => file.endsWith('.json'))) {
  checkManifest(JSON.parse(fs.readFileSync(file, 'utf8')), path.relative(root, file));
}
const changelog = JSON.parse(fs.readFileSync(path.join(root, '.homeychangelog.json'), 'utf8'));
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
checkLanguages(changelog[version], 'Current release notes');
for (const lang of languages) {
  const readme = fs.readFileSync(path.join(root, lang === 'en' ? 'README.txt' : `README.${lang}.txt`), 'utf8');
  assert(readme.trim(), `Missing Store description: ${lang}`);
}
const pairHtml = fs.readFileSync(path.join(root, 'drivers/subject_manual/pair/create_manual_subject.html'), 'utf8');
for (const name of ['t', 'recoveryText']) {
  const start = pairHtml.indexOf(`const ${name}=`) + `const ${name}=`.length;
  const end = start + pairHtml.slice(start).search(/;\s*(?:const|let) /);
  assert(start >= `const ${name}=`.length && end > start, `Missing pairing dictionary: ${name}`);
  const data = vm.runInNewContext('(' + pairHtml.slice(start, end).trim() + ')');
  checkLanguages(data, `Pairing ${name}`);
}
for (const file of [path.join(root, 'app.js'), path.join(root, 'api.js'), ...files(path.join(root, 'lib')), ...files(path.join(root, 'drivers'))].filter(file => file.endsWith('.js'))) {
  const source = fs.readFileSync(file, 'utf8');
  const keys = [...source.matchAll(/(?:this\.tError\(\s*|(?:translate|tError)\(\s*[^,]+,\s*)['"]([^'"]+)['"]/g)].map(match => match[1]);
  for (const key of keys) for (const lang of languages) assert(key in localeData[lang].errors, `${path.relative(root, file)} uses missing ${lang} key ${key}`);
}

async function checkUserFacingErrors() {
  const { translate } = require('../lib/i18n');
  assert.strictEqual(translate({ __: key => key }, 'missing', 'Safe fallback'), 'Safe fallback');
  const { getLegacyBackup } = require('../lib/migration');
  const { sanitizeConfig } = require('../lib/store');
  const api = require('../api');
  const Module = require('module');
  const originalLoad = Module._load;
  let App;
  try {
    Module._load = function (name, parent, main) {
      return name === 'homey' ? { App: class {} } : originalLoad.call(this, name, parent, main);
    };
    App = require('../app');
  } finally { Module._load = originalLoad; }
  for (const lang of languages) {
    const resolve = (key, tags = {}) => {
      const text = key.split('.').reduce((value, part) => value?.[part], localeData[lang]);
      assert.strictEqual(typeof text, 'string', `Untranslated user error ${lang}: ${key}`);
      return text.replace(/__(\w+)__/g, (_, name) => String(tags[name]));
    };
    const homey = { __: resolve, settings: { get: () => null } };
    await assert.rejects(api.setConfig({ homey, body: {} }), error => error.message === resolve('errors.invalidConfigImport'));
    assert.throws(() => getLegacyBackup({ ...homey, settings: { get: () => ({ invalid: true }) } }), error => error.message === resolve('errors.migrationBackupInvalid'));
    const zones = ['A', 'B'].map(name => ({ id: 'duplicate', name, type: 'circle', center: { lat: 0, lng: 0 }, radius: 100 }));
    assert.throws(() => sanitizeConfig({ zones }, homey), error => error.message === resolve('errors.duplicateZoneId', { id: 'duplicate' }));
    const app = new App();
    app.homey = homey;
    assert.throws(() => app.requireValidCoordinates(null, 0), error => error.message === resolve('errors.coordinatesRequired', { label: resolve('errors.coordinatesLabel') }));
    const states = await app.autocompleteMovementStates('');
    assert.deepStrictEqual(states.map(state => state.id).sort(), ['moving', 'stable', 'unknown']);
    assert(states.every(state => state.name && (lang === 'en' || state.name !== state.id)), `${lang}: movement labels must be translated without changing IDs`);
    const moving = states.find(state => state.id === 'moving');
    assert.strictEqual((await app.autocompleteMovementStates(moving.name))[0].id, 'moving', 'Localized state names must remain searchable');
  }
}
checkUserFacingErrors().then(() => console.log(`Four-language coverage and user-facing error checks passed (${localizedFields} manifest text fields).`)).catch(error => { console.error(error); process.exitCode = 1; });
