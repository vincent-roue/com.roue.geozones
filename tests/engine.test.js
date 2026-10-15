'use strict';

const assert = require('assert');
const { isValidLat, isValidLng } = require('../lib/geo');
const { determineBestZone } = require('../lib/zone-engine');
const engine = require('../lib/subject-device');

const NativeDate = Date;
let now = NativeDate.parse('2026-10-14T12:00:00.000Z');
global.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
};

function circle(id, latitude, options = {}) {
  return { id, name: id.toUpperCase(), type: 'circle', active: true, center: { lat: latitude, lng: 0 }, radius: 100, hysteresis: 0, priority: 0, tags: [], options: { entryDelayS: 0, exitDelayS: 0, ...options } };
}

const devices = [];
function createDevice(zones = [], initial = {}, initialStore = {}) {
  const capabilities = { latitude: null, longitude: null, last_update: '', current_zone: 'not_defined', previous_zone: 'not_defined', zone_tags: '', movement_state: 'unknown', speed_kmh: 0, ...initial };
  const store = { ...initialStore };
  const settings = { enabled: true, minMoveDistanceM: 0, subjectType: 'person' };
  const timers = new Map();
  let timerId = 0;
  const events = [];
  const device = {
    capabilities, store, settings, timers, events,
    homey: {
      settings: { get() {} }, log() {}, error(error) { throw new Error(`Unexpected engine error: ${error}`); },
      setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; },
      clearTimeout(id) { timers.delete(id); },
      app: { getZones: () => zones, async triggerDeviceAndGlobalEvent(kind, subject, tokens) { events.push({ kind, zone: tokens.zone, transition: tokens.transition }); } },
    },
    getName: () => 'Alice', getData: () => ({ id: 'subject-1' }),
    getSettings: () => ({ ...settings }), async setSettings(update) { Object.assign(settings, update); },
    getStore: () => ({ ...store }), getStoreValue: key => store[key], async setStoreValue(key, value) { store[key] = value; },
    hasCapability: () => true, getCapabilityValue: key => capabilities[key], async setCapabilityValue(key, value) { capabilities[key] = value; },
  };
  devices.push(device);
  return device;
}

async function advance(device, ms) {
  now += ms;
  for (const [id, timer] of [...device.timers]) {
    if (timer.at <= now) { device.timers.delete(id); timer.callback(); }
  }
  await new Promise(resolve => setImmediate(resolve));
}

async function testStrictCoordinates() {
  for (const invalid of [null, undefined, '', '  ', false, true, [], {}, NaN, Infinity]) {
    assert.strictEqual(isValidLat(invalid), false, `Latitude rejects ${String(invalid)}`);
    assert.strictEqual(isValidLng(invalid), false, `Longitude rejects ${String(invalid)}`);
    assert.throws(() => determineBestZone({ lat: invalid, long: 0, zones: [] }));
    await assert.rejects(engine.updatePositionAndEvaluate(createDevice(), invalid, 0));
  }
  assert.strictEqual(isValidLat('0'), true);
  const fresh = createDevice([circle('zero', 0)]);
  await assert.rejects(engine.evaluateStoredPosition(fresh), /No stored coordinates/);
  assert.strictEqual(fresh.capabilities.latitude, null);
  assert.strictEqual(fresh.capabilities.last_update, '');
  const updated = await engine.updatePositionAndEvaluate(fresh, 0, 0);
  assert.strictEqual(updated.result.movementState, 'unknown', 'The first measurement has no previous position');
  assert.strictEqual(fresh.capabilities.current_zone, 'ZERO', 'Explicit zero is a real coordinate');
}

async function testOperationsAreSerialized() {
  const device = createDevice([circle('a', 10), circle('b', 20)]);
  let first = true;
  const originalWrite = device.setStoreValue;
  device.setStoreValue = async (key, value) => {
    if (first) { first = false; await new Promise(resolve => setImmediate(resolve)); }
    return originalWrite(key, value);
  };
  await Promise.all([engine.updatePositionAndEvaluate(device, 10, 0), engine.updatePositionAndEvaluate(device, 20, 0)]);
  assert.strictEqual(device.capabilities.latitude, 20);
  assert.strictEqual(device.capabilities.current_zone, 'B');
  assert.deepStrictEqual(device.events.filter(event => event.kind === 'zone_changed').map(event => event.zone), ['A', 'B']);
  await assert.rejects(engine.updatePositionAndEvaluate(device, null, 0));
  await engine.updatePositionAndEvaluate(device, 20, 0);
  assert.strictEqual(device.capabilities.current_zone, 'B', 'A rejected update does not block later updates');
  await Promise.all([engine.updatePositionAndEvaluate(device, 10, 0), engine.clearRuntimeState(device)]);
  assert.strictEqual(device.capabilities.current_zone, 'not_defined', 'A queued reset follows the pending position write');
  await engine.setEnabled(device, false);
  await assert.rejects(engine.updatePositionAndEvaluate(device, 20, 0), /disabled/);
  await engine.setEnabled(device, true);
  await engine.setMinMoveDistance(device, 15);
  assert.strictEqual(device.settings.minMoveDistanceM, 15, 'Settings actions do not deadlock the subject queue');
}

async function testRecalculationPreservesMeasurement() {
  const timestamp = '2026-01-01T00:00:00.000Z';
  const device = createDevice([circle('a', 10)], { latitude: 10, longitude: 0, last_update: timestamp, current_zone: 'A', movement_state: 'moving', speed_kmh: 50 }, { currentZoneId: 'a' });
  await engine.evaluateStoredPosition(device);
  assert.strictEqual(device.capabilities.last_update, timestamp);
  assert.strictEqual(device.capabilities.movement_state, 'moving');
  assert.strictEqual(device.capabilities.speed_kmh, 50);
  assert.strictEqual(device.events.some(event => event.kind === 'position_changed'), false);
  const withoutDate = createDevice([], { latitude: 10, longitude: 0 });
  await engine.evaluateStoredPosition(withoutDate);
  assert.strictEqual(withoutDate.capabilities.last_update, '', 'A recalculation does not invent a measurement time');
}

async function testTransitionTimerLifecycle() {
  const zones = [circle('a', 10, { entryDelayS: 30, exitDelayS: 20 })];
  const device = createDevice(zones);
  await engine.updatePositionAndEvaluate(device, 10, 0);
  const measurementTime = device.capabilities.last_update;
  assert.strictEqual(device.capabilities.current_zone, 'not_defined');
  assert.strictEqual(device.timers.size, 1);
  await advance(device, 29999);
  assert.strictEqual(device.capabilities.current_zone, 'not_defined');
  await advance(device, 1);
  assert.strictEqual(device.capabilities.current_zone, 'A', 'Entry completes without a second measurement');
  assert.strictEqual(device.capabilities.last_update, measurementTime);
  assert.strictEqual(device.timers.size, 0);
  await engine.updatePositionAndEvaluate(device, 20, 0);
  assert.strictEqual(device.capabilities.current_zone, 'A');
  await advance(device, 20000);
  assert.strictEqual(device.capabilities.current_zone, 'not_defined', 'Exit completes without a second measurement');

  const cancel = createDevice(zones);
  await engine.updatePositionAndEvaluate(cancel, 10, 0);
  const canceledCallback = [...cancel.timers.values()][0].callback;
  await engine.updatePositionAndEvaluate(cancel, 20, 0);
  assert.strictEqual(cancel.timers.size, 0);
  canceledCallback();
  await advance(cancel, 30000);
  assert.strictEqual(cancel.capabilities.current_zone, 'not_defined', 'A stale timer cannot restore a canceled transition');
  await engine.updatePositionAndEvaluate(cancel, 10, 0);
  await engine.setEnabled(cancel, false);
  assert.strictEqual(cancel.timers.size, 0, 'Disabling cancels pending transitions');
  await advance(cancel, 30000);
  assert.strictEqual(cancel.capabilities.current_zone, 'not_defined');

  const resume = createDevice(zones, { latitude: 10, longitude: 0, last_update: measurementTime }, { pendingZoneId: 'a', pendingZoneName: 'A', pendingSince: new Date(now - 10000).toISOString() });
  await engine.initializeSubjectRuntime(resume);
  assert.strictEqual(resume.timers.size, 1);
  await advance(resume, 20000);
  assert.strictEqual(resume.capabilities.current_zone, 'A', 'Restart resumes the persisted remaining delay');
  const expired = createDevice(zones, { latitude: 10, longitude: 0, last_update: measurementTime }, { pendingZoneId: 'a', pendingZoneName: 'A', pendingSince: new Date(now - 40000).toISOString() });
  await engine.initializeSubjectRuntime(expired);
  assert.strictEqual(expired.capabilities.current_zone, 'A', 'A completed persisted delay resolves on restart');

  const removed = createDevice(zones);
  await engine.updatePositionAndEvaluate(removed, 10, 0);
  await engine.disposeSubjectRuntime(removed);
  assert.strictEqual(removed.timers.size, 0);
  await assert.rejects(engine.updatePositionAndEvaluate(removed, 10, 0), /no longer active/);
}

async function testSettingsUseNewValuesBeforeHomeyCommits() {
  const zones = [circle('a', 10)];
  const device = createDevice(zones, { latitude: 10, longitude: 0, last_update: new Date().toISOString() });
  await engine.applyCommonSettings(device, { ...device.settings, subjectType: 'car', enabled: false });
  assert.strictEqual(device.settings.enabled, true, 'The test models onSettings before Homey stores the new settings');
  assert.strictEqual(device.capabilities.enabled, false);
  assert.strictEqual(device.capabilities.subject_type, 'car');
  assert.strictEqual(device.capabilities.current_zone, 'not_defined');
}

const watchdog = setTimeout(() => { console.error('Subject engine tests timed out (possible queue deadlock)'); process.exit(1); }, 5000);
(async () => {
  try {
    await testStrictCoordinates();
    await testOperationsAreSerialized();
    await testRecalculationPreservesMeasurement();
    await testTransitionTimerLifecycle();
    await testSettingsUseNewValuesBeforeHomeyCommits();
    console.log('Subject engine regression tests passed');
  } finally {
    await Promise.all(devices.map(engine.disposeSubjectRuntime));
    global.Date = NativeDate;
    clearTimeout(watchdog);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
