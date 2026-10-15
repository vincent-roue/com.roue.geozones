'use strict';

const assert = require('assert');
const { setConfig, updateConfig, getHistory } = require('../lib/store');
const { determineBestZone, STATE_ZONE_NOT_DEFINED } = require('../lib/zone-engine');
const { log, logHeavy } = require('../lib/logger');

class MemorySettings {
  constructor() { this.data = new Map(); }
  get(key) { return this.data.get(key); }
  async set(key, value) { this.data.set(key, value); }
}

function createHomey() {
  return {
    settings: new MemorySettings(),
    log() {},
    error() {},
    __() { return ''; },
  };
}

function createBaseConfig() {
  return {
    schemaVersion: 25,
    zones: [],
    general: { historyRetentionDays: 30, heavyDebug: false },
    ui: { mapCenter: { lat: 48.8566, lng: 2.3522 }, mapZoom: 6, selectedZoneId: null, activeTab: 'zones' },
  };
}

function makeCircle(overrides = {}) {
  return {
    id: overrides.id || overrides.name?.toLowerCase() || 'zone',
    name: overrides.name || 'Zone',
    type: 'circle',
    active: overrides.active !== false,
    color: overrides.color || '#3388ff',
    priority: Number.isFinite(overrides.priority) ? overrides.priority : 0,
    center: overrides.center || { lat: 48.8566, lng: 2.3522 },
    radius: Number.isFinite(overrides.radius) ? overrides.radius : 100,
    hysteresis: Number.isFinite(overrides.hysteresis) ? overrides.hysteresis : 0,
    tags: overrides.tags || [],
    options: {
      entryDelayS: 0,
      exitDelayS: 0,
      appliesWithoutSubject: true,
      subjectFilter: { mode: 'all', subjects: [] },
      subjectTypeFilter: { mode: 'all', subjectTypes: [] },
      ...(overrides.options || {}),
    },
  };
}



async function testStoreSkipsHistoryWhenConfigIsUnchanged() {
  const homey = createHomey();
  const base = createBaseConfig();

  await setConfig(homey, base);
  const historyAfterFirstSet = getHistory(homey).length;
  await setConfig(homey, base);
  assert.strictEqual(getHistory(homey).length, historyAfterFirstSet, 'setConfig should not push history when config is unchanged');

  await updateConfig(homey, current => current);
  assert.strictEqual(getHistory(homey).length, historyAfterFirstSet, 'updateConfig should not push history when config is unchanged');
}


async function testLoggerWritesSingleLineAndHeavyStaysGated() {
  const entries = [];
  const homey = {
    settings: new MemorySettings(),
    log(message) { entries.push(['log', message]); },
    error(message) { entries.push(['error', message]); },
    __() { return ''; },
  };

  await setConfig(homey, createBaseConfig(), { pushHistory: false });
  log(homey, 'test', 'Hello', { a: 1 });
  assert.strictEqual(entries.length, 1, 'normal logging should produce a single line');
  assert.strictEqual(entries[0][1], '[GeoZones:test] Hello', 'normal logging should omit details when heavy debug is disabled');

  entries.length = 0;
  await setConfig(homey, { ...createBaseConfig(), general: { historyRetentionDays: 30, heavyDebug: true } }, { pushHistory: false });
  log(homey, 'test', 'Hello', { a: 1 });
  assert.strictEqual(entries.length, 1, 'heavy-enabled standard logs should still produce a single line');
  assert.strictEqual(entries[0][1], '[GeoZones:test] Hello', 'heavy-enabled standard logs should stay concise');

  entries.length = 0;
  logHeavy(homey, 'test', 'Detailed', { a: 2 });
  assert.strictEqual(entries.length, 1, 'heavy logs should emit when heavy debug is enabled');
  assert.match(entries[0][1], /\[GeoZones:test\] Detailed :: \{"a":2\}/, 'heavy logs should include structured details on the same line');
}

function testZoneEnginePriorityTieBreak() {
  const result = determineBestZone({
    lat: 48.8566,
    long: 2.3522,
    zones: [
      makeCircle({ id: 'wide', name: 'Wide', radius: 400, priority: 10 }),
      makeCircle({ id: 'small', name: 'Small', radius: 100, priority: 10 }),
    ],
    subjectState: { id: 'subject_1', name: 'Alice', subjectType: 'person' },
    useDelays: false,
  });

  assert.strictEqual(result.zone, 'Small', 'when priorities are equal, the smallest matching area should win');
}

function testSubjectFilterOverridesSubjectTypeFilter() {
  const result = determineBestZone({
    lat: 48.8566,
    long: 2.3522,
    zones: [
      makeCircle({
        id: 'friends-only',
        name: 'Friends Only',
        options: {
          appliesWithoutSubject: true,
          subjectFilter: { mode: 'exclude', subjects: ['Alice'] },
          subjectTypeFilter: { mode: 'include', subjectTypes: ['person'] },
        },
      }),
    ],
    subjectState: { id: 'subject_1', name: 'Alice', subjectType: 'person' },
    useDelays: false,
  });

  assert.strictEqual(result.zone, STATE_ZONE_NOT_DEFINED, 'subject filter should win over subject type filter when both are configured');
}

function testCoordinatesWithoutSubjectRespectFlag() {
  const result = determineBestZone({
    lat: 48.8566,
    long: 2.3522,
    zones: [
      makeCircle({
        id: 'subject-only',
        name: 'Subject Only',
        options: {
          appliesWithoutSubject: false,
          subjectFilter: { mode: 'all', subjects: [] },
          subjectTypeFilter: { mode: 'all', subjectTypes: [] },
        },
      }),
    ],
    subjectState: null,
    useDelays: false,
  });

  assert.strictEqual(result.zone, STATE_ZONE_NOT_DEFINED, 'zones that require a subject must not match raw coordinate evaluations');
}

function testCircleHysteresisKeepsPreviousZoneStable() {
  const result = determineBestZone({
    lat: 48.85768,
    long: 2.3522,
    zones: [
      makeCircle({ id: 'home', name: 'Home', radius: 100, hysteresis: 40 }),
    ],
    subjectState: {
      id: 'subject_1',
      name: 'Alice',
      currentZoneId: 'home',
      currentZoneName: 'Home',
      currentTags: [],
      lastLat: 48.8566,
      lastLng: 2.3522,
      minMoveDistanceM: 0,
    },
    useDelays: false,
  });

  assert.strictEqual(result.zone, 'Home', 'a previous circle zone should still match within its hysteresis margin');
}

function testEntryDelayWaitsBeforeSwitchingZone() {
  const oldZone = makeCircle({ id: 'old', name: 'Old', center: { lat: 48.858, lng: 2.3522 }, radius: 60 });
  const newZone = makeCircle({
    id: 'new',
    name: 'New',
    radius: 100,
    options: {
      appliesWithoutSubject: true,
      entryDelayS: 30,
      exitDelayS: 0,
      subjectFilter: { mode: 'all', subjects: [] },
      subjectTypeFilter: { mode: 'all', subjectTypes: [] },
    },
  });

  const result = determineBestZone({
    lat: 48.8566,
    long: 2.3522,
    zones: [oldZone, newZone],
    subjectState: {
      id: 'subject_1',
      name: 'Alice',
      currentZoneId: 'old',
      currentZoneName: 'Old',
      currentTags: [],
      pendingZoneId: 'new',
      pendingZoneName: 'New',
      pendingSince: new Date(Date.now() - 5_000).toISOString(),
      lastLat: 48.858,
      lastLng: 2.3522,
      minMoveDistanceM: 0,
    },
    useDelays: true,
  });

  assert.strictEqual(result.zone, 'Old', 'entry delay should keep the previous zone until the delay elapses');
  assert.strictEqual(result.waiting, true, 'entry delay should report waiting=true while the delay is still running');
  assert.strictEqual(result.nextSubjectState.pendingZoneId, 'new', 'pending target should be preserved while waiting');
}

function testExitDelayWaitsBeforeLeavingZone() {
  const home = makeCircle({
    id: 'home',
    name: 'Home',
    center: { lat: 48.8566, lng: 2.3522 },
    radius: 100,
    options: {
      appliesWithoutSubject: true,
      entryDelayS: 0,
      exitDelayS: 45,
      subjectFilter: { mode: 'all', subjects: [] },
      subjectTypeFilter: { mode: 'all', subjectTypes: [] },
    },
  });

  const result = determineBestZone({
    lat: 48.8605,
    long: 2.3522,
    zones: [home],
    subjectState: {
      id: 'subject_1',
      name: 'Alice',
      currentZoneId: 'home',
      currentZoneName: 'Home',
      currentTags: ['home'],
      pendingZoneId: '__exit__',
      pendingZoneName: '__exit__',
      pendingSince: new Date(Date.now() - 10_000).toISOString(),
      lastLat: 48.8566,
      lastLng: 2.3522,
      minMoveDistanceM: 0,
    },
    useDelays: true,
  });

  assert.strictEqual(result.zone, 'Home', 'exit delay should keep the previous zone until the delay elapses');
  assert.strictEqual(result.waiting, true, 'exit delay should report waiting=true while leaving is pending');
  assert.strictEqual(result.nextSubjectState.pendingZoneId, '__exit__', 'pending exit marker should be preserved while waiting');
}

(async () => {
  await testStoreSkipsHistoryWhenConfigIsUnchanged();
  await testLoggerWritesSingleLineAndHeavyStaysGated();
  testZoneEnginePriorityTieBreak();
  testSubjectFilterOverridesSubjectTypeFilter();
  testCoordinatesWithoutSubjectRespectFlag();
  testCircleHysteresisKeepsPreviousZoneStable();
  testEntryDelayWaitsBeforeSwitchingZone();
  testExitDelayWaitsBeforeLeavingZone();
  console.log('All unit tests passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
