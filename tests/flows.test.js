'use strict';

const assert = require('assert');
const Module = require('module');
const originalLoad = Module._load;
Module._load = function load(name, parent, main) {
  if (name === 'homey') return { App: class {}, Device: class {} };
  return originalLoad.call(this, name, parent, main);
};
const App = require('../app');
Module._load = originalLoad;

function createApp() {
  const cards = new Map();
  const getCard = id => {
    if (!cards.has(id)) cards.set(id, {
      calls: [], registerArgumentAutocompleteListener() {}, registerRunListener(run) { this.run = run; },
      async trigger(...args) { this.calls.push(args); },
    });
    return cards.get(id);
  };
  const app = new App();
  app.homey = { settings: { get() {} }, log() {}, error() {}, flow: { getTriggerCard: getCard, getDeviceTriggerCard: getCard, getConditionCard: getCard, getActionCard: getCard } };
  app.registerFlowCards();
  return { app, cards };
}

(async () => {
  const { app, cards } = createApp();
  for (const state of ['moving', 'stable', 'unknown']) {
    const device = { getCapabilityValue: () => state };
    assert.strictEqual(await cards.get('device_is_movement_state').run({ state: { id: state, name: state }, device }), true);
    assert.strictEqual(await cards.get('device_is_movement_state').run({ state, device }), true);
    assert.strictEqual(await cards.get('device_is_movement_state').run({ state: { id: 'different', name: 'different' }, device }), false);
  }
  const caps = { current_zone: 'B', previous_zone: 'A', zone_tags: 'work', movement_state: 'moving', subject_type: 'person', latitude: null, longitude: null };
  const device = { getName: () => 'Alice', getData: () => ({ id: 'alice' }), getCapabilityValue: key => caps[key] };
  await app.triggerDeviceAndGlobalEvent('transition', device, { transition: 'left', zone: 'A', zone_tags: '' });
  for (const id of ['global_subject_transition', 'any_subject_transition']) {
    const [tokens, state] = cards.get(id).calls[0];
    assert.strictEqual(tokens.zone_tags, '');
    assert.strictEqual(state.zone_tags, '', 'Transition filters use the tags of the zone being left');
    assert.strictEqual(await cards.get(id).run({ transition: 'left', tag: { id: 'work', name: 'work' } }, state), false);
  }
  const [triggerDevice, tokens, state] = cards.get('subject_transition').calls[0];
  assert.strictEqual(triggerDevice, device);
  assert.strictEqual(tokens.zone_tags, '');
  assert.strictEqual(state.zone_tags, '');
  assert.strictEqual(app.buildSubjectStateTokens(device).latitude, null);
  for (const invalid of [null, '', '  ', true, false, [], {}]) assert.throws(() => app.requireValidCoordinates(invalid, 0));
  assert.deepStrictEqual(app.requireValidCoordinates(0, '0'), { latitude: 0, longitude: 0 });
  assert.throws(() => app.requireValidCoordinates(91, 0), /range/);
  const { distanceToZoneM, distanceToZoneBoundaryM } = require('../lib/geo');
  const testZones = [
    { id: 'circle', name: 'Circle', type: 'circle', center: { lat: 0, lng: 0 }, radius: 1000, tags: ['target'] },
    { id: 'polygon', name: 'Polygon', type: 'polygon', paths: [{ lat: -0.01, lng: -0.01 }, { lat: -0.01, lng: 0.01 }, { lat: 0.01, lng: 0.01 }, { lat: 0.01, lng: -0.01 }], tags: ['target'] },
  ];
  for (const zone of testZones) {
    app.getZones = () => [zone];
    assert.strictEqual(distanceToZoneM(0, 0, zone), 0, 'Distance to a containing zone is zero');
    assert(distanceToZoneBoundaryM(0, 0, zone) > 900, 'Engine distance to the boundary retains its separate meaning');
    for (const latitude of [0, 0.02]) {
      caps.latitude = latitude;
      caps.longitude = 0;
      const expected = distanceToZoneM(latitude, 0, zone);
      if (latitude !== 0) assert(expected > 1000, 'Exterior distance remains positive');
      const coordinatesResult = await cards.get('distance_coordinates_zone').run({ lat: latitude, long: 0, zone: { id: zone.name, name: zone.name } });
      const deviceResult = await cards.get('device_distance_to_zone').run({ device, zone: { id: zone.name, name: zone.name } });
      const tagResult = await cards.get('device_distance_to_tag').run({ device, tag: { id: 'target', name: 'target' } });
      for (const result of [coordinatesResult, deviceResult, tagResult]) assert.strictEqual(result.distance_m, expected);
    }
  }
  const fs = require('fs').promises;
  const path = require('path');
  const originalReaddir = fs.readdir;
  const originalUnlink = fs.unlink;
  const deleted = [];
  try {
    fs.readdir = async directory => {
      assert.strictEqual(directory, '/userdata');
      return ['geozones-export-old.json', 'geozones-export-abcdef.json', 'keep.json', 'geozones-export-old.txt'];
    };
    fs.unlink = async filename => { deleted.push(filename); };
    await app.cleanupLegacyExports();
    assert.deepStrictEqual(deleted.sort(), [path.join('/userdata', 'geozones-export-abcdef.json'), path.join('/userdata', 'geozones-export-old.json')].sort());
  } finally {
    fs.readdir = originalReaddir;
    fs.unlink = originalUnlink;
  }
  console.log('Flow regression tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
