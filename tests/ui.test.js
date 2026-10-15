'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

class Element {
  constructor() {
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.textContent = '';
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.listeners = {};
    const classes = new Set();
    this.classList = {
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      contains: name => classes.has(name),
      toggle: (name, on) => on ? classes.add(name) : classes.delete(name),
    };
  }
  get firstChild() { return this.children[0]; }
  appendChild(child) { this.children.push(child); }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); }
  addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
  setAttribute(name, value) { this[name] = value; }
  click() {}
  focus() {}
  select() {}
}

const clone = value => JSON.parse(JSON.stringify(value));
const source = fs.readFileSync(path.join(__dirname, '..', 'settings', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'settings', 'index.html'), 'utf8');
const elements = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(match => [`#${match[1]}`, new Element()]));
const points = [{ lat: 48, lng: 2 }, { lat: 49, lng: 2 }, { lat: 49, lng: 3 }];
const options = { entryDelayS: 0, exitDelayS: 0, appliesWithoutSubject: true, subjectFilter: { mode: 'all', subjects: [] }, subjectTypeFilter: { mode: 'all', subjectTypes: [] } };
const saved = {
  zones: [
    { id: 'polygon', name: 'Home', type: 'polygon', color: '#2F6FED', active: true, priority: 0, tags: [], paths: points, options },
    { id: 'circle', name: 'Work', type: 'circle', color: '#2F6FED', active: true, priority: 0, tags: [], center: { lat: 48, lng: 2 }, radius: 100, hysteresis: 0, options },
  ],
  ui: { selectedZoneId: 'polygon', mapCenter: { lat: 48, lng: 2 }, mapZoom: 6 },
  general: { historyRetentionDays: 30 },
};
const requests = [];
const alerts = [];
let clipboard = '';
let downloadedBlob;
let ready = false;
let confirmAnswer = true;
let confirmations = 0;
const homey = {
  i18n: { getLanguage: () => 'en' },
  ready: () => { ready = true; },
  alert: message => { alerts.push(message); },
  confirm: async () => { confirmations += 1; return confirmAnswer; },
  api: async (method, route, body) => {
    requests.push({ method, route, body });
    if (route === '/config') return clone(saved);
    if (route === '/history') return [];
    if (route === '/migration/status') return { status: 'none' };
    if (route === '/meta') return { name: { en: 'GeoZones' }, version: 'test' };
    throw new Error(`Unexpected API call: ${method} ${route}`);
  },
};
const context = {
  console, window: {}, Homey: homey, Blob,
  URL: { createObjectURL: blob => { downloadedBlob = blob; return 'blob:local-test'; }, revokeObjectURL: () => {} },
  setTimeout: callback => callback(),
  navigator: { language: 'en', clipboard: { writeText: async text => { clipboard = text; } } },
  document: {
    body: new Element(), documentElement: {},
    querySelector: selector => elements[selector] || null,
    querySelectorAll: selector => selector === 'input, select, textarea, button' ? Object.values(elements) : [],
    createElement: () => new Element(),
  },
};
vm.createContext(context);
vm.runInContext(source, context);
const evaluate = code => vm.runInContext(code, context);
const input = (selector, value) => {
  if (elements[selector].disabled) return;
  elements[selector].value = value;
  for (const listener of elements[selector].listeners.input || []) listener({ target: elements[selector] });
};

(async () => {
  await context.window.onHomeyReady(homey);
  assert(ready, 'Settings must finish loading without Leaflet');
  assert(elements['#mapWarning'].textContent.includes('map could not load'));
  assert.strictEqual(elements['#generalHistoryRetentionDays'].value, 30);
  assert(elements['#zoneList'].children.length === 2, 'Existing zones must remain editable without the map');

  input('#zoneName', 'Ma ');
  assert.strictEqual(elements['#zoneName'].value, 'Ma ', 'Typing a space must not rewrite the active field');
  input('#zoneName', 'Ma Maison');
  input('#zoneSubjectFilterValues', 'Alice,');
  assert.strictEqual(elements['#zoneSubjectFilterValues'].value, 'Alice,');
  input('#zoneSubjectFilterValues', 'Alice, Bob');
  assert.deepStrictEqual(JSON.parse(evaluate('JSON.stringify(currentZone().options.subjectFilter.subjects)')), ['Alice', 'Bob']);

  for (const invalid of ['[', '{}', '[]', '[{"lat":91,"lng":2},{"lat":49,"lng":2},{"lat":49,"lng":3}]']) {
    input('#zonePaths', invalid);
    assert.strictEqual(elements['#zonePaths'].value, invalid, 'Invalid geometry must remain available for correction');
    assert.strictEqual(elements['#btnSave'].disabled, true);
    assert.deepStrictEqual(JSON.parse(evaluate('JSON.stringify(currentZone().paths)')), points, 'Invalid geometry must not replace the last valid polygon');
  }
  evaluate("selectedZoneId = 'circle'; renderZoneEditor();");
  assert(elements['#btnSave'].disabled, 'An invalid draft in another zone must block saving');
  await evaluate('saveConfig()');
  assert(!requests.some(request => request.method === 'PUT'), 'Invalid drafts must not be sent to Homey');
  evaluate("selectedZoneId = 'polygon'; renderZoneEditor();");
  assert(elements['#zonePaths'].value.includes('91'), 'Changing selection must preserve an invalid draft');
  input('#zonePaths', JSON.stringify(points));
  assert.strictEqual(elements['#btnSave'].disabled, false);

  evaluate("selectedZoneId = 'circle'; renderZoneEditor();");
  input('#zoneCenterLat', '-');
  assert.strictEqual(elements['#zoneCenterLat'].value, '-');
  assert(elements['#btnSave'].disabled);
  input('#zoneCenterLat', '-33.9');
  assert.strictEqual(elements['#zoneCenterLat'].value, '-33.9');
  assert.strictEqual(elements['#btnSave'].disabled, false);
  input('#zoneName', 'Unsaved Work');
  await elements['#btnCopyExport'].onclick();
  await elements['#btnDownloadExport'].onclick();
  assert.strictEqual(await downloadedBlob.text(), clipboard, 'Copy and Download must export the same unsaved draft');
  assert(JSON.parse(clipboard).zones.some(zone => zone.name === 'Unsaved Work' && zone.center.lat === -33.9));
  assert(!requests.some(request => /export/.test(request.route)), 'Exports must remain in the browser');

  const normalApi = homey.api;
  let finishSave;
  homey.api = (method, route, body) => method === 'PUT' && route === '/config'
    ? new Promise(resolve => { finishSave = resolve; }) : normalApi(method, route, body);
  const saving = evaluate('saveConfig()');
  assert(elements['#zoneName'].disabled, 'Editing must be locked while Homey saves');
  input('#zoneName', 'Typing during save');
  assert.strictEqual(elements['#zoneName'].value, 'Unsaved Work', 'A pending save must not accept edits that its reload would discard');
  finishSave({});
  await saving;
  assert.strictEqual(elements['#zoneName'].disabled, false);
  homey.api = normalApi;
  const writesBeforeImports = requests.filter(request => request.method !== 'GET').length;
  for (const text of ['', ' ', 'null', '[]', '1', 'true', '"text"', '{}', '{"schemaVersion":25}', '{"zones":null}', '{"config":[]}']) {
    elements['#importBox'].value = text;
    await evaluate("handleImport('replace')");
    await evaluate("handleImport('merge')");
  }
  assert.strictEqual(requests.filter(request => request.method !== 'GET').length, writesBeforeImports, 'Invalid imports must never reach the API');
  assert.strictEqual(confirmations, 0, 'Invalid imports must be rejected before asking to replace');
  elements['#importBox'].value = '{"zones":[]}';
  confirmAnswer = false;
  await evaluate("handleImport('replace')");
  assert.strictEqual(requests.filter(request => request.method !== 'GET').length, writesBeforeImports, 'Canceling replacement must preserve current zones');
  confirmAnswer = true;
  await evaluate("handleImport('replace')");
  assert(requests.some(request => request.method === 'PUT' && request.body.zones.length === 0), 'An explicit empty zones array must be allowed after confirmation');
  assert.strictEqual(confirmations, 2);

  homey.api = async (method, route) => {
    if (route === '/migration/status') return { status: 'error', backupVerified: true, lastError: 'Recovery requires attention' };
    if (route === '/migration/backup') return { payload: { settings: { old: 'preserved' } }, sha256: 'verified-by-server' };
    throw new Error('Migration is blocked');
  };
  evaluate('config = null');
  await evaluate('loadAll()');
  assert(!elements['#migrationPanel'].classList.contains('hidden'), 'Recovery information must remain available when configuration loading is blocked');
  assert(elements['#migrationStatus'].textContent.includes('Recovery requires attention'));
  assert.strictEqual(elements['#btnSave'].disabled, true);
  await elements['#btnMigrationBackup'].onclick();
  assert.strictEqual(JSON.parse(await downloadedBlob.text()).payload.settings.old, 'preserved');

  const mapLanguages = {
    en: {
      zoomIn: 'Zoom in', zoomOut: 'Zoom out',
      circleStart: 'Click and drag to draw a circle.', circleEnd: 'Release to finish drawing.', radius: 'Radius',
      polygonStart: 'Click to start drawing a polygon.', polygonContinue: 'Click to add another point.', polygonEnd: 'Click the first point to close the polygon.',
      intersectionError: 'Polygon edges cannot cross.', invalidJson: 'Invalid JSON file.',
    },
    fr: {
      zoomIn: 'Zoomer', zoomOut: 'Dézoomer',
      circleStart: 'Cliquez et faites glisser pour dessiner un cercle.', circleEnd: 'Relâchez pour terminer le dessin.', radius: 'Rayon',
      polygonStart: 'Cliquez pour commencer un polygone.', polygonContinue: 'Cliquez pour ajouter un point.', polygonEnd: 'Cliquez sur le premier point pour fermer le polygone.',
      intersectionError: 'Les côtés du polygone ne peuvent pas se croiser.', invalidJson: 'Fichier JSON invalide.',
    },
    nl: {
      zoomIn: 'Inzoomen', zoomOut: 'Uitzoomen',
      circleStart: 'Klik en sleep om een cirkel te tekenen.', circleEnd: 'Laat los om het tekenen te voltooien.', radius: 'Straal',
      polygonStart: 'Klik om een polygoon te beginnen.', polygonContinue: 'Klik om een punt toe te voegen.', polygonEnd: 'Klik op het eerste punt om de polygoon te sluiten.',
      intersectionError: 'De zijden van de polygoon mogen elkaar niet kruisen.', invalidJson: 'Ongeldig JSON-bestand.',
    },
    de: {
      zoomIn: 'Vergrößern', zoomOut: 'Verkleinern',
      circleStart: 'Klicken und ziehen Sie, um einen Kreis zu zeichnen.', circleEnd: 'Lassen Sie los, um die Zeichnung abzuschließen.', radius: 'Radius',
      polygonStart: 'Klicken Sie, um ein Polygon zu beginnen.', polygonContinue: 'Klicken Sie, um einen Punkt hinzuzufügen.', polygonEnd: 'Klicken Sie auf den ersten Punkt, um das Polygon zu schließen.',
      intersectionError: 'Die Seiten des Polygons dürfen sich nicht kreuzen.', invalidJson: 'Ungültige JSON-Datei.',
    },
  };
  context.mapTestConfig = clone(saved);
  evaluate('config = mapTestConfig');
  let malformedApiCalls = 0;
  homey.api = async () => { malformedApiCalls += 1; throw new Error('Malformed JSON must not reach Homey'); };
  const confirmationsBeforeMalformed = confirmations;
  for (const [lang, expected] of Object.entries(mapLanguages)) {
    let zoomOptions;
    let circleStartAtConstruction;
    let polygonStartAtConstruction;
    const leafletMap = { setView() { return this; }, on() {} };
    context.L = {
      drawLocal: { draw: { handlers: {
        circle: { tooltip: { start: 'untranslated circle' }, radius: 'untranslated radius' },
        simpleshape: { tooltip: { end: 'untranslated end' } },
        polygon: { tooltip: { start: 'untranslated polygon', cont: 'untranslated continuation', end: 'untranslated closing' } },
        polyline: { error: 'untranslated error' },
      } } },
      map: (id, mapOptions) => {
        assert.strictEqual(id, 'map');
        assert.strictEqual(mapOptions.zoomControl, false, 'Disable the default English zoom buttons');
        return leafletMap;
      },
      control: { zoom: options => { zoomOptions = options; return { addTo: target => assert.strictEqual(target, leafletMap) }; } },
      tileLayer: () => ({ addTo() {} }),
      FeatureGroup: class {},
      Draw: {
        Circle: class { constructor() { circleStartAtConstruction = context.L.drawLocal.draw.handlers.circle.tooltip.start; } },
        Polygon: class { constructor() { polygonStartAtConstruction = context.L.drawLocal.draw.handlers.polygon.tooltip.start; } },
        Event: { CREATED: 'draw:created' },
      },
    };
    leafletMap.addLayer = () => {};
    evaluate(`currentLang = '${lang}'; map = null; ensureMap()`);
    const handlers = context.L.drawLocal.draw.handlers;
    for (const [key, actual] of Object.entries({
      circleStart: handlers.circle.tooltip.start,
      circleEnd: handlers.simpleshape.tooltip.end,
      radius: handlers.circle.radius,
      polygonStart: handlers.polygon.tooltip.start,
      polygonContinue: handlers.polygon.tooltip.cont,
      polygonEnd: handlers.polygon.tooltip.end,
      intersectionError: handlers.polyline.error,
      zoomIn: zoomOptions.zoomInTitle,
      zoomOut: zoomOptions.zoomOutTitle,
    })) assert.strictEqual(actual, expected[key], `${lang}: map must apply ${key}`);
    assert.strictEqual(circleStartAtConstruction, expected.circleStart, `${lang}: translate before constructing the circle tool`);
    assert.strictEqual(polygonStartAtConstruction, expected.polygonStart, `${lang}: translate before constructing the polygon tool`);

    for (const mode of ['replace', 'merge']) {
      elements['#importBox'].value = '{"zones":[';
      const alertsBefore = alerts.length;
      await evaluate(`handleImport('${mode}')`);
      assert.strictEqual(alerts.length, alertsBefore + 1, `${lang}: malformed JSON must show an alert`);
      assert.strictEqual(alerts[alerts.length - 1], expected.invalidJson, `${lang}: hide the native JSON parser error`);
      assert.strictEqual(elements['#status'].textContent, `⚠ ${expected.invalidJson}`, `${lang}: show a translated status error`);
    }
  }
  assert.strictEqual(malformedApiCalls, 0, 'Malformed JSON must never reach Homey');
  assert.strictEqual(confirmations, confirmationsBeforeMalformed, 'Malformed JSON must not ask to replace or merge');

  function flatten(value, prefix = '', result = {}) {
    for (const [key, item] of Object.entries(value)) {
      if (item && typeof item === 'object') flatten(item, `${prefix}${key}.`, result);
      else result[`${prefix}${key}`] = item;
    }
    return result;
  }
  const languages = evaluate('UI');
  const reference = flatten(languages.en);
  for (const lang of ['fr', 'nl', 'de']) {
    const translated = flatten(languages[lang]);
    assert.deepStrictEqual(Object.keys(translated).sort(), Object.keys(reference).sort());
    for (const key of Object.keys(reference)) {
      const tags = value => [...value.matchAll(/__\w+__/g)].map(match => match[0]).sort();
      assert.deepStrictEqual(tags(translated[key]), tags(reference[key]), `${lang}: ${key}`);
    }
  }
  for (const match of html.matchAll(/data-(?:i18n|help)(?:-placeholder)?="([^"]+)"/g)) assert(match[1] in reference, `Missing UI translation: ${match[1]}`);
  assert(!/https:\/\/unpkg/.test(html), 'Map libraries must ship in the app');
  console.log('Settings interaction, offline fallback, private export, translated map controls and import errors passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
