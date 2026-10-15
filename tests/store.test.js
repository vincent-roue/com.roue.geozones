'use strict';

const assert = require('assert');
const { sanitizeConfig, setConfig, getConfig, getHistory } = require('../lib/store');

function zone(name, id = name) { return { name, id, type: 'circle', center: { lat: 0, lng: 0 }, radius: 100, color: '#3388ff' }; }
const h = { settings: { data: {}, get(key) { return this.data[key]; }, async set(key, value) { this.data[key] = value; } }, __() { return ''; }, log() {}, error() {} };

(async () => {
  assert.throws(() => sanitizeConfig({ zones: [zone('A', 'same'), zone('B', 'same')] }), /occurs more than once/);
  assert.throws(() => sanitizeConfig({ zones: [zone('A', ' a '), zone('B', 'a')] }), /occurs more than once/);
  for (const value of [null, '', '  ', false, true, [], {}]) {
    assert.throws(() => sanitizeConfig({ zones: [{ ...zone('A'), center: { lat: value, lng: 0 } }] }), /Invalid circle center/);
    assert.throws(() => sanitizeConfig({ zones: [{ ...zone('A'), type: 'polygon', paths: [{ lat: value, lng: 0 }, { lat: 1, lng: 0 }, { lat: 0, lng: 1 }] }] }), /invalid coordinates/);
  }
  assert.strictEqual(sanitizeConfig({ zones: [zone('Zero')] }).zones[0].center.lat, 0);
  assert.strictEqual(sanitizeConfig({ zones: [{ ...zone('Numeric'), center: { lat: '48', lng: '2' } }] }).zones[0].center.lat, 48);
  await setConfig(h, { zones: [zone('A')] });
  const before = getConfig(h);
  await assert.rejects(setConfig(h, { zones: [zone('A', 'x'), zone('B', 'x')] }), /occurs more than once/);
  assert.deepStrictEqual(getConfig(h), before);
  const old = { id: 'expired', createdAt: '2020-01-01T00:00:00Z', config: before };
  const recent = { id: 'recent', createdAt: new Date().toISOString(), config: before };
  h.settings.data.config_history = [old, recent];
  assert.deepStrictEqual(getHistory(h).map(item => item.id), ['recent']);
  assert.strictEqual(h.settings.data.config_history.length, 2, 'read retention cannot erase original stored history');
  console.log('Store tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
