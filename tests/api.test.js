'use strict';

const assert = require('assert');
const api = require('../api');
const { getConfig, setConfig } = require('../lib/store');

class MemorySettings {
  constructor() { this.data = new Map(); }
  get(key) { return this.data.get(key); }
  getKeys() { return [...this.data.keys()]; }
  async set(key, value) {
    await Promise.resolve();
    this.data.set(key, JSON.parse(JSON.stringify(value)));
  }
}

(async () => {
  const events = [];
  const homey = {
    settings: new MemorySettings(),
    log() {}, error() {}, __() { return ''; },
    app: {
      triggerConfigChangedEvent: async reason => events.push(reason),
      reevaluateAllSubjects: async () => {},
    },
  };
  const zone = { id: 'home', name: 'Home', type: 'circle', center: { lat: 48, lng: 2 }, radius: 100 };
  await setConfig(homey, { schemaVersion: 25, zones: [zone], general: { historyRetentionDays: 30, heavyDebug: false }, ui: { mapZoom: 6 } });
  await Promise.all([
    api.mergeConfig({ homey, body: { general: { heavyDebug: true } } }),
    api.mergeConfig({ homey, body: { ui: { mapZoom: 11 } } }),
    api.mergeConfig({ homey, body: { general: { historyRetentionDays: 7 } } }),
  ]);
  const result = getConfig(homey);
  assert.strictEqual(result.general.heavyDebug, true, 'Concurrent merges must preserve unrelated changes');
  assert.strictEqual(result.general.historyRetentionDays, 7);
  assert.strictEqual(result.ui.mapZoom, 11);
  assert.strictEqual(events.length, 3);
  assert.strictEqual(api.exportFile, undefined, 'No public export endpoint may remain');
  assert.strictEqual(await api.getMigrationBackup({ homey }), null);
  assert.strictEqual((await api.getMigrationStatus({ homey })).status, 'none');
  const beforeRejections = getConfig(homey);
  for (const body of [undefined, null, [], true, 1, '', 'text', {}, { schemaVersion: 25 }, { zones: null }, { general: null }, { config: [] }, { payload: { settings: {} } }]) {
    await assert.rejects(api.setConfig({ homey, body }), /Invalid configuration import/);
    await assert.rejects(api.mergeConfig({ homey, body }), /Invalid configuration import/);
    assert.deepStrictEqual(getConfig(homey), beforeRejections, 'Rejecting invalid imports must preserve existing zones and settings');
  }
  await assert.rejects(api.setConfig({ homey, body: { general: { heavyDebug: false } } }), /Invalid configuration import/);
  assert.deepStrictEqual(getConfig(homey), beforeRejections);
  for (const body of [{ config: { zones: [zone] } }, { payload: { settings: { config: { zones: [zone] } } } }]) {
    await api.setConfig({ homey, body });
    assert.strictEqual(getConfig(homey).zones[0].name, 'Home', 'Export wrappers must remain importable');
  }
  await api.mergeConfig({ homey, body: { payload: { settings: { config: { general: { historyRetentionDays: 12 } } } } } });
  assert.strictEqual(getConfig(homey).zones[0].name, 'Home', 'Merging a wrapped settings section must preserve current zones');
  assert.strictEqual(getConfig(homey).general.historyRetentionDays, 12);
  await api.setConfig({ homey, body: { zones: [] } });
  assert.deepStrictEqual(getConfig(homey).zones, [], 'An explicit empty zones array remains a supported replacement');
  console.log('API concurrent merge, migration status and private-export checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
