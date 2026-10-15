'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'settings', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'settings', 'index.html'), 'utf8');

class Element {
  constructor(tag = '') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.listeners = {};
    this.dataset = {};
    this.style = {};
    this.textContent = '';
    this.value = '';
    const classes = new Set();
    this.classList = {
      add: name => classes.add(name), remove: name => classes.delete(name),
      toggle: (name, on) => on ? classes.add(name) : classes.delete(name),
      contains: name => classes.has(name),
    };
  }
  get firstChild() { return this.children[0]; }
  appendChild(child) { this.children.push(child); }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); }
  addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
  click() { for (const handler of this.listeners.click || []) handler({ target: this }); }
  setAttribute(name, value) { this[name] = value; }
}

function settingsView(options = {}) {
  const elements = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(match => [`#${match[1]}`, new Element()]));
  const helpButtons = [...html.matchAll(/data-help="([^"]+)"/g)].map(match => {
    const button = new Element('button');
    button.dataset.help = match[1];
    return button;
  });
  let ready = false;
  const requests = [];
  const alerts = [];
  const homey = {
    ...options.frontend,
    ready: () => { ready = true; },
    alert: message => { alerts.push(message); },
    api: async (method, route) => {
      requests.push({ method, route });
      if (route === '/meta') {
        if (options.metaError) throw new Error('Metadata temporarily unavailable');
        if (options.metaPromise) return options.metaPromise;
        return { name: { en: 'GeoZones' }, version: 'test', language: options.language };
      }
      if (route === '/migration/status') return { status: 'none' };
      if (route === '/config') return { zones: [], general: {}, ui: {} };
      if (route === '/history') return [];
      throw new Error(`Unexpected settings request: ${method} ${route}`);
    },
  };
  const context = {
    window: {}, Homey: homey,
    setTimeout: callback => callback(),
    document: {
      documentElement: {}, body: new Element(),
      querySelector: selector => elements[selector] || null,
      querySelectorAll: selector => selector === '.info' ? helpButtons : [],
      createElement: tag => new Element(tag),
    },
  };
  if (options.browser !== null) context.navigator = { language: options.browser || 'en' };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, homey, elements, helpButtons, alerts, requests, isReady: () => ready };
}

async function checkLanguage(options, expected) {
  const view = settingsView(options);
  await view.context.window.onHomeyReady(view.homey);
  assert(view.isReady(), 'Settings must remain readable after language selection');
  assert.strictEqual(view.context.document.documentElement.lang, expected, options.label);
  const dictionary = JSON.parse(vm.runInContext('JSON.stringify(UI)', view.context));
  const sections = view.elements['#helpContent'].children;
  assert.strictEqual(sections.length, 15, 'All 15 help topics must be rendered');
  sections.forEach((section, index) => {
    const translated = dictionary[expected].help.sections[index];
    const english = dictionary.en.help.sections[index];
    assert.strictEqual(section.tagName, 'DETAILS', 'Help topics must remain expandable');
    assert.strictEqual(Boolean(section.open), index === 0, 'Only the first help topic must open by default');
    assert.strictEqual(section.children[0].tagName, 'SUMMARY');
    assert.strictEqual(section.children[0].textContent, translated.title, 'Every help heading must use the selected language');
    assert.strictEqual(section.children.length, 4, 'Every help topic must contain its heading and three paragraphs');
    assert.strictEqual(translated.body.length, 3);
    section.children.slice(1).forEach((paragraph, paragraphIndex) => {
      assert.strictEqual(paragraph.tagName, 'P');
      assert.strictEqual(paragraph.textContent, translated.body[paragraphIndex], 'Every rendered help paragraph must use the selected language');
      if (expected !== 'en') assert.notStrictEqual(paragraph.textContent, english.body[paragraphIndex], 'A translated help paragraph must not fall back to English');
    });
    if (expected !== 'en') assert.notStrictEqual(section.children[0].textContent, english.title, 'A translated heading must not fall back to English');
  });
  assert.strictEqual(view.helpButtons.length, 6, 'All six linked field-help buttons must be covered');
  view.helpButtons.forEach(button => {
    const expectedText = button.dataset.help.split('.').reduce((value, key) => value[key], dictionary[expected]);
    const previousAlerts = view.alerts.length;
    button.click();
    assert.strictEqual(view.alerts.length, previousAlerts + 1, 'Each field-help button must open its help text');
    assert.strictEqual(view.alerts[previousAlerts], expectedText, 'Linked field-help text must use the selected language');
  });
  assert.strictEqual(view.elements['#mapWarning'].textContent, vm.runInContext(`UI.${expected}.messages.mapUnavailable`, view.context), 'Map messages must use the same language as help');
  assert.strictEqual(view.requests[0].route, '/meta', 'Homey metadata must be requested before rendering the settings');
  assert(view.requests.every(request => request.method === 'GET'), 'Loading help and choosing a language must not change settings');
}

(async () => {
  for (const language of ['en', 'fr', 'nl', 'de']) {
    await checkLanguage({ language, browser: language === 'fr' ? 'de-DE' : 'fr-FR', label: `Homey ${language} must override a different browser language` }, language);
  }
  for (const language of ['DE-de', 'de_DE', ' de-AT ']) await checkLanguage({ language, browser: 'fr-FR' }, 'de');
  await checkLanguage({ language: 'fr', frontend: { getLanguage: () => 'de', i18n: { getLanguage: () => 'nl' } }, browser: 'en-US' }, 'fr');
  await checkLanguage({ language: 'es-ES', frontend: { getLanguage: () => 'de' }, browser: 'fr-FR' }, 'en');
  await checkLanguage({ frontend: { getLanguage: () => 'fr-BE', i18n: { getLanguage: () => 'de' } }, browser: 'nl-NL' }, 'fr');
  await checkLanguage({ frontend: { i18n: { getLanguage: () => 'nl-NL' } }, browser: 'fr-FR' }, 'nl');
  await checkLanguage({ metaError: true, frontend: { getLanguage: () => 'de-DE' }, browser: 'fr-FR' }, 'de');
  await checkLanguage({ metaError: true, browser: 'fr-CA' }, 'fr');
  await checkLanguage({ language: 42, frontend: { getLanguage: () => { throw new Error('Getter unavailable'); }, i18n: { getLanguage: () => 'de_DE' } }, browser: 'fr-FR' }, 'de');
  await checkLanguage({ metaError: true, frontend: { getLanguage: () => 'es' }, browser: 'fr-FR' }, 'en');
  await checkLanguage({ browser: 'es-ES' }, 'en');
  await checkLanguage({ browser: null }, 'en');

  let finishMetadata;
  const metaPromise = new Promise(resolve => { finishMetadata = resolve; });
  const view = settingsView({ metaPromise, browser: 'fr-FR' });
  const opening = view.context.window.onHomeyReady(view.homey);
  assert(!view.isReady(), 'The view must wait for Homey language metadata before becoming visible');
  assert.strictEqual(view.elements['#helpContent'].children.length, 0, 'Help must not briefly render in the browser language before Homey responds');
  finishMetadata({ language: 'de', name: { en: 'GeoZones' }, version: 'test' });
  await opening;
  assert(view.isReady());
  assert.strictEqual(view.context.document.documentElement.lang, 'de');
  console.log('All 15 help topics, 45 paragraphs and six field-help buttons follow Homey language; regional, fallback and metadata-failure checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
