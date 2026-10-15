'use strict';

const assert = require('assert');
const {
  BACKUP_KEY, MIGRATION_KEY, RECOVERY_KEY, IMPORT_BACKUPS_KEY,
  migrateLegacySettings, getLegacyBackup, getMigrationStatus, createRecoveredSubject, restoreMigratedSubject,
} = require('../lib/migration');
const { getConfig, setConfig, getHistory } = require('../lib/store');

const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
class Settings {
  constructor(initial = {}) { this.data = copy(initial); this.writes = []; this.fail = null; }
  get(key) { return copy(this.data[key]); }
  getKeys() { return Object.keys(this.data); }
  async set(key, value) {
    if (this.fail) this.fail(key, value);
    this.writes.push(key);
    this.data[key] = copy(value);
  }
}
function homey(initial) {
  return { settings: new Settings(initial), log() {}, error() {}, __() { return ''; }, app: { async ensureSubjectNameAvailable(name) { if (!name) throw new Error('Name required'); } } };
}
function zone(name, id = name) {
  return { id, name, type: 'circle', active: true, color: '#3388ff', priority: 0, center: { lat: 48, lng: 2 }, radius: 100, hysteresis: 0, tags: ['home'], options: { subjectFilter: { mode: 'include', subjects: ['alice'] } } };
}
// Shapes from the functional v2.0.0 archive (schema 20, merged runtime in config.subjects)
// and Desktop/v1.0.0 (app version 1.1.0, schema 23, separate subjects_state).
function schema20() {
  return {
    config: {
      schemaVersion: 20, zones: [zone('Home', 'same'), zone('Work', 'same'), zone('School', 'same__migrated_2')],
      subjects: { alice: { id: 'alice', name: 'Alice', subjectType: 'person', minMoveDistanceM: 12, source: { deviceId: 'gps-a', custom: 'preserve' }, lastLat: 48.1, lastLng: 2.1, lastTimestamp: '2026-10-14T10:00:00Z', currentZoneId: 'same', currentZoneName: 'Work', currentTags: ['work'], previousZoneId: 'same', previousZoneName: 'Home', movementState: 'moving', pendingZoneId: 'same', pendingZoneName: 'Work', pendingSince: '2026-10-14T09:59:59Z', unknownLegacyField: { keep: true } } },
      sources: [{ deviceId: 'gps-a', deviceName: 'iPhone', subjectId: 'alice', latCapability: 'measure_latitude', lngCapability: 'measure_longitude', createdAt: '2026-10-01T00:00:00Z' }],
      general: { historyRetentionDays: 15, autopurgeEnabled: true, autopurgeDays: 5, heavyDebug: false },
      ui: { mapCenter: { lat: 48, lng: 2 }, mapZoom: 8, selectedZoneId: 'same', activeTab: 'subjects' },
    },
    config_history: [{ id: 'old', createdAt: '2020-01-01T00:00:00Z', config: { subjects: { important: true } } }],
    other_legacy_setting: { never: 'discard' },
  };
}
function schema23() {
  return {
    config: { schemaVersion: 23, zones: [zone('Home')], subjects: { alice: { id: 'alice', name: 'Alice', subjectType: 'person', source: null, enabled: false, minMoveDistanceM: 3 } }, sources: [], general: { historyRetentionDays: 30 }, ui: {} },
    subjects_state: {
      alice: { lastLat: 49, lastLng: 3, lastTimestamp: '2026-10-14T10:01:00Z', currentZoneId: 'Home', currentZoneName: 'Home', currentTags: ['home'], previousZoneId: '', previousZoneName: 'unknown', movementState: 'stable', speedKmh: 3, pendingZoneId: '', pendingZoneName: '', pendingSince: '', updatedAt: '2026-10-14T10:01:00Z' },
      orphan: { lastLat: null, lastLng: null, currentZoneName: 'not_defined' },
    },
  };
}
function device(h, row) {
  const store = { legacyRecoveryId: row.id };
  const capabilities = {};
  let settings = {};
  return {
    homey: h, capabilities, store, failCapability: null,
    getData: () => ({ id: row.deviceId }), getName: () => row.name,
    getStoreValue: key => store[key], async setStoreValue(key, value) { store[key] = copy(value); },
    async setSettings(value) { settings = copy(value); }, getSettings: () => settings,
    hasCapability: () => true, getCapabilityValue: key => capabilities[key],
    async setCapabilityValue(key, value) { if (this.failCapability === key) throw new Error('capability write failed'); capabilities[key] = value; },
  };
}

async function testBackupAndSchema20() {
  const initial = schema20();
  const h = homey(initial);
  assert.throws(() => getConfig(h), /protected data migration/);
  await migrateLegacySettings(h);
  assert.strictEqual(h.settings.writes[0], BACKUP_KEY);
  assert.deepStrictEqual(getLegacyBackup(h).payload.settings, initial, 'backup includes all keys and unrecognised values before normalisation');
  const config = getConfig(h);
  assert.strictEqual(config.schemaVersion, 25);
  assert.strictEqual(config.zones.length, 3);
  assert.strictEqual(new Set(config.zones.map(item => item.id)).size, 3);
  assert.strictEqual(config.zones[1].id, 'same__migrated_3', 'duplicate remap avoids existing IDs deterministically');
  assert.deepStrictEqual(config.zones[0].options.subjectFilter.subjects, ['Alice']);
  const recovery = h.settings.get(RECOVERY_KEY);
  assert.strictEqual(recovery.subjects[0].runtime.currentZoneId, 'same__migrated_3', 'zone name resolves ambiguous legacy ID');
  assert.strictEqual(recovery.subjects[0].legacy.metadata.unknownLegacyField.keep, true);
  assert.strictEqual(recovery.subjects[0].legacy.sources.length, 2);
  const backupBefore = h.settings.get(BACKUP_KEY);
  const writesBefore = h.settings.writes.length;
  await migrateLegacySettings(h);
  assert.strictEqual(h.settings.writes.length, writesBefore, 'completed migration is durable and does not run again');
  assert.deepStrictEqual(h.settings.get(BACKUP_KEY), backupBefore);
  assert.deepStrictEqual(h.settings.get('config_history'), initial.config_history, 'migration never prunes or normalises original history');
  assert.deepStrictEqual(getHistory(h), [], 'expired history is hidden on read without changing raw backup');
}

async function testSplitStateAndRecovery() {
  const initial = schema23();
  const h = homey(initial);
  await migrateLegacySettings(h);
  const rows = h.settings.get(RECOVERY_KEY).subjects;
  assert.strictEqual(rows.length, 2, 'orphan split state remains recoverable');
  const alice = rows.find(row => row.name === 'Alice');
  const orphan = rows.find(row => row.name === 'orphan');
  assert.strictEqual(alice.runtime.lastLat, 49);
  assert.strictEqual(alice.settings.enabled, false);
  assert.strictEqual(orphan.runtime.lastLat, null, 'missing coordinates must not become zero');
  assert.deepStrictEqual(h.settings.get('subjects_state'), initial.subjects_state, 'original state key is retained');
  const descriptor = await createRecoveredSubject(h, alice.id);
  assert.deepStrictEqual(descriptor.settings, alice.settings);
  assert.strictEqual(descriptor.store.legacyRecoveryId, alice.id);
  const target = device(h, alice);
  target.failCapability = 'longitude';
  await assert.rejects(restoreMigratedSubject(target), /capability write/);
  assert.strictEqual(target.getStoreValue('legacyRecoveryApplied'), undefined);
  assert.strictEqual(getMigrationStatus(h).recoveredSubjects, 0);
  target.failCapability = null;
  await restoreMigratedSubject(target);
  assert.strictEqual(target.getCapabilityValue('latitude'), 49);
  assert.strictEqual(target.getCapabilityValue('enabled'), false);
  assert.strictEqual(target.getCapabilityValue('current_zone'), 'Home');
  assert.deepStrictEqual(target.getStoreValue('legacySubjectData').state, initial.subjects_state.alice);
  assert.strictEqual(getMigrationStatus(h).recoveredSubjects, 1);
  target.capabilities.latitude = 50;
  await restoreMigratedSubject(target);
  assert.strictEqual(target.getCapabilityValue('latitude'), 50, 'restart does not overwrite a recovered device with old coordinates');
  await assert.rejects(createRecoveredSubject(h, alice.id), /already been recovered/);
}

async function testBackupFailureCannotChangeLegacy() {
  const initial = schema20();
  const h = homey(initial);
  h.settings.fail = key => { if (key === BACKUP_KEY) throw new Error('disk full'); };
  await assert.rejects(migrateLegacySettings(h), /disk full/);
  assert.deepStrictEqual(h.settings.data, initial);
  h.settings.fail = null;
  await migrateLegacySettings(h);
  assert.strictEqual(getMigrationStatus(h).status, 'pending_recovery');
}

async function testUnverifiedBackupStopsEverything() {
  const initial = schema20();
  const h = homey(initial);
  const originalSet = h.settings.set.bind(h.settings);
  h.settings.set = async (key, value) => originalSet(key, key === BACKUP_KEY ? { ...value, sha256: 'bad' } : value);
  await assert.rejects(migrateLegacySettings(h), /verify saved migration/);
  assert.deepStrictEqual(h.settings.get('config'), initial.config);
  assert.deepStrictEqual(h.settings.writes, [BACKUP_KEY]);
  h.settings.set = originalSet;
  await assert.rejects(migrateLegacySettings(h), /could not be verified/);
  assert.deepStrictEqual(h.settings.get('config'), initial.config);
}

async function testPartialMigrationRetriesFromImmutableBackup() {
  const h = homey(schema20());
  let once = true;
  h.settings.fail = (key, value) => { if (key === MIGRATION_KEY && value.phase === 'complete' && once) { once = false; throw new Error('interrupted after config write'); } };
  await assert.rejects(migrateLegacySettings(h), /interrupted/);
  const originalBackup = h.settings.get(BACKUP_KEY);
  assert.strictEqual(h.settings.get('config').schemaVersion, 25);
  assert.throws(() => getConfig(h), /protected data migration/);
  delete h.__geozonesMigrationState;
  h.settings.fail = null;
  await migrateLegacySettings(h);
  assert.deepStrictEqual(h.settings.get(BACKUP_KEY), originalBackup);
  assert.strictEqual(h.settings.get(RECOVERY_KEY).subjects.length, 1);
  assert.strictEqual(new Set(getConfig(h).zones.map(row => row.id)).size, 3);
}

async function testRecoveryAcknowledgementRetry() {
  const h = homey(schema20());
  await migrateLegacySettings(h);
  const row = h.settings.get(RECOVERY_KEY).subjects[0];
  const target = device(h, row);
  let once = true;
  h.settings.fail = (key, value) => { if (key === RECOVERY_KEY && value.subjects[0].status === 'recovered' && once) { once = false; throw new Error('ack interrupted'); } };
  await assert.rejects(restoreMigratedSubject(target), /ack interrupted/);
  assert.strictEqual(target.store.legacyRecoveryApplied, row.id);
  target.capabilities.latitude = 51;
  h.settings.fail = null;
  await restoreMigratedSubject(target);
  assert.strictEqual(getMigrationStatus(h).recoveredSubjects, 1);
  assert.strictEqual(target.capabilities.latitude, 51, 'ack retry cannot replay legacy values');
}

async function testLegacyImportPreservesRawAndIsIdempotent() {
  const h = homey({ config: { schemaVersion: 25, zones: [], general: {}, ui: {} } });
  const imported = schema23();
  await setConfig(h, imported);
  assert.deepStrictEqual(h.settings.get(IMPORT_BACKUPS_KEY)[0].payload, imported);
  assert.strictEqual(getMigrationStatus(h).totalSubjects, 2);
  assert.deepStrictEqual(getConfig(h).zones[0].options.subjectFilter.subjects, ['Alice']);
  await setConfig(h, imported);
  assert.strictEqual(h.settings.get(IMPORT_BACKUPS_KEY).length, 1);
  assert.strictEqual(getMigrationStatus(h).totalSubjects, 2);
  assert.strictEqual(getLegacyBackup(h).imports.length, 1, 'download includes original imported data');
  const before = getConfig(h);
  const badImport = schema20();
  await assert.rejects(setConfig(h, badImport), /occurs more than once/);
  assert.deepStrictEqual(getConfig(h), before, 'duplicate IDs in a new import must not change configuration');
  assert.deepStrictEqual(h.settings.get(IMPORT_BACKUPS_KEY)[1].payload, badImport, 'even a rejected legacy import is preserved raw');
}

async function testInstalledSchema25DuplicateIds() {
  const initial = { config: { schemaVersion: 25, zones: [zone('A', 'same'), zone('B', 'same')], general: {}, ui: {} } };
  const h = homey(initial);
  await migrateLegacySettings(h);
  assert.deepStrictEqual(getLegacyBackup(h).payload.settings, initial);
  assert.deepStrictEqual(getConfig(h).zones.map(row => row.id), ['same', 'same__migrated_2']);
  assert.strictEqual(getMigrationStatus(h).status, 'complete');
}

async function testImportIdentityAndInheritedSettings() {
  const h = homey({ config: { schemaVersion: 25, zones: [] } });
  const a = { schemaVersion: 20, zones: [zone('Home')], subjectSettings: { minMoveDistanceM: 25 }, subjects: { same: { id: 'same', name: 'Alice' }, explicit: { id: 'explicit', name: 'Zero', minMoveDistanceM: 0 } } };
  const b = { ...copy(a), subjects: { same: { id: 'same', name: 'Bob' } } };
  await setConfig(h, a);
  await setConfig(h, b);
  await setConfig(h, b);
  const rows = h.settings.get(RECOVERY_KEY).subjects;
  assert.strictEqual(rows.length, 3, 'different imports with the same legacy key cannot silently discard a subject');
  assert.strictEqual(new Set(rows.map(row => row.id)).size, 3);
  assert.strictEqual(rows.find(row => row.name === 'Alice').settings.minMoveDistanceM, 25);
  assert.strictEqual(rows.find(row => row.name === 'Zero').settings.minMoveDistanceM, 0);
  assert.strictEqual(h.settings.get(IMPORT_BACKUPS_KEY).length, 2, 'identical retry cannot duplicate the recovery list or backup');
}

async function testConcurrentRecoveryAndCorruptionProtection() {
  const h = homey(schema23());
  await migrateLegacySettings(h);
  const rows = h.settings.get(RECOVERY_KEY).subjects;
  await Promise.all(rows.map(row => restoreMigratedSubject(device(h, row))));
  assert.strictEqual(getMigrationStatus(h).recoveredSubjects, 2, 'concurrent device startup cannot lose another recovery acknowledgement');
  h.settings.data[RECOVERY_KEY].subjects = [];
  assert.strictEqual(getMigrationStatus(h).status, 'error');
  assert.throws(() => getConfig(h), /recovery list/);
  assert.ok(getLegacyBackup(h).payload.settings.subjects_state.alice, 'corrupt recovery index cannot delete the immutable raw backup');
}

async function testPairingRecoveryHandlers() {
  const Module = require('module');
  const originalLoad = Module._load;
  Module._load = function load(request, ...args) { return request === 'homey' ? { Driver: class {} } : originalLoad.call(this, request, ...args); };
  let Driver;
  try { Driver = require('../drivers/subject_manual/driver'); } finally { Module._load = originalLoad; }
  const h = homey(schema23());
  const driver = new Driver();
  const paired = [];
  driver.homey = h;
  driver.getDevices = () => paired;
  const handlers = {};
  await driver.onPair({ setHandler(name, fn) { handlers[name] = fn; } });
  const rows = await handlers.list_legacy_subjects();
  assert.strictEqual(rows.length, 2);
  const descriptor = await handlers.recover_legacy_subject({ id: rows[0].id });
  assert.strictEqual(descriptor.data.id, rows[0].id);
  paired.push({ getData: () => descriptor.data });
  assert.strictEqual((await handlers.list_legacy_subjects()).length, 1, 'a paired device awaiting restoration cannot be paired twice');
  await assert.rejects(handlers.recover_legacy_subject({ id: rows[0].id }), /already paired/);
}

async function testImportDuringRecoveryCannotLoseSubjects() {
  const initial = schema23();
  delete initial.subjects_state.orphan;
  const h = homey(initial);
  await migrateLegacySettings(h);
  const alice = h.settings.get(RECOVERY_KEY).subjects[0];
  const target = device(h, alice);
  let releaseRestore;
  let reportRestoreEntered;
  let reportImportSaved;
  const restoreEntered = new Promise(resolve => { reportRestoreEntered = resolve; });
  const importSaved = new Promise(resolve => { reportImportSaved = resolve; });
  const release = new Promise(resolve => { releaseRestore = resolve; });
  const originalSetSettings = target.setSettings.bind(target);
  target.setSettings = async value => { reportRestoreEntered(); await release; await originalSetSettings(value); };
  const originalSet = h.settings.set.bind(h.settings);
  h.settings.set = async (key, value) => { await originalSet(key, value); if (key === IMPORT_BACKUPS_KEY) reportImportSaved(); };
  const restoring = restoreMigratedSubject(target);
  await restoreEntered;
  const importing = setConfig(h, { schemaVersion: 23, zones: [zone('Home')], subjects: { bob: { id: 'bob', name: 'Bob', enabled: true } }, sources: [] });
  await importSaved;
  // Give the import its continuation while Alice's RMW is deliberately suspended.
  await new Promise(resolve => setImmediate(resolve));
  releaseRestore();
  await Promise.all([restoring, importing]);
  const rows = h.settings.get(RECOVERY_KEY).subjects;
  assert.strictEqual(rows.length, 2, 'an import concurrent with device restoration must retain both subjects');
  assert.strictEqual(rows.find(row => row.name === 'Alice').status, 'recovered');
  assert.strictEqual(rows.find(row => row.name === 'Bob').status, 'pending');
  assert.strictEqual(getMigrationStatus(h).totalSubjects, 2);
}

async function testFutureInstalledSchemaCannotBeDowngraded() {
  const initial = schema23();
  initial.config.schemaVersion = 26;
  const h = homey(initial);
  await assert.rejects(migrateLegacySettings(h), /newer app version/);
  await assert.rejects(setConfig(h, { schemaVersion: 25, zones: [] }), /newer app version/);
  assert.deepStrictEqual(h.settings.data, initial);
  assert.deepStrictEqual(h.settings.writes, [], 'future installed schema must stop before backup or any settings mutation');
}

async function testRealSchema4CaseSensitiveZoneNames() {
  // Exact persisted shape from archives fonctionnelles/v1.0.0: id=name,
  // groups/categories, ui.selectedZoneName and subjects containing currentZone only.
  const initial = require('./fixtures/legacy-schema4.json');
  const h = homey(initial);
  await migrateLegacySettings(h);
  assert.deepStrictEqual(getLegacyBackup(h).payload.settings, initial);
  assert.deepStrictEqual(getConfig(h).zones.map(row => row.name), ['Home', 'home (2)']);
  assert.strictEqual(getConfig(h).ui.selectedZoneId, 'home');
  let recovery = h.settings.get(RECOVERY_KEY);
  assert.strictEqual(recovery.subjects.find(row => row.name === 'Alice').runtime.currentZoneName, 'home (2)');
  assert.strictEqual(recovery.subjects.find(row => row.name === 'Alice').runtime.currentZoneId, 'home');
  assert.strictEqual(recovery.subjects.find(row => row.name === 'Bob').runtime.currentZoneName, 'Home');
  assert.strictEqual(recovery.subjects.find(row => row.name === 'Bob').runtime.currentZoneId, 'Home');
  assert.deepStrictEqual(recovery.zoneIdMappings.map(row => [row.oldName, row.newName]), [['Home', 'Home'], ['home', 'home (2)']]);
  const extended = copy(initial);
  extended.config.zones.push({ ...zone('home (2)'), id: 'third' });
  Object.assign(extended.config.subjects.Alice, { previousZoneId: 'Home', previousZoneName: 'Home', pendingZoneId: 'home', pendingZoneName: 'home', pendingSince: '2026-10-14T10:00:00Z' });
  const other = homey(extended);
  await migrateLegacySettings(other);
  recovery = other.settings.get(RECOVERY_KEY);
  const alice = recovery.subjects.find(row => row.name === 'Alice');
  assert.deepStrictEqual(getConfig(other).zones.map(row => row.name), ['Home', 'home (3)', 'home (2)'], 'renaming must not steal a name that already exists later in the config');
  assert.strictEqual(alice.runtime.previousZoneName, 'Home');
  assert.strictEqual(alice.runtime.previousZoneId, 'Home');
  assert.strictEqual(alice.runtime.pendingZoneName, 'home (3)');
  assert.strictEqual(alice.runtime.pendingZoneId, 'home');
  const fresh = homey({ config: { schemaVersion: 25, zones: [] } });
  await assert.rejects(setConfig(fresh, initial.config), /already exists/);
  assert.deepStrictEqual(getConfig(fresh).zones, [], 'new imports must reject colliding names rather than rename them');
  await migrateLegacySettings(h);
  assert.deepStrictEqual(getConfig(h).zones.map(row => row.name), ['Home', 'home (2)'], 'restart must not add another suffix');
}

(async () => {
  for (const test of [testBackupAndSchema20, testSplitStateAndRecovery, testBackupFailureCannotChangeLegacy, testUnverifiedBackupStopsEverything, testPartialMigrationRetriesFromImmutableBackup, testRecoveryAcknowledgementRetry, testLegacyImportPreservesRawAndIsIdempotent, testInstalledSchema25DuplicateIds, testImportIdentityAndInheritedSettings, testConcurrentRecoveryAndCorruptionProtection, testPairingRecoveryHandlers, testImportDuringRecoveryCannotLoseSubjects, testFutureInstalledSchemaCannotBeDowngraded, testRealSchema4CaseSensitiveZoneNames]) await test();
  console.log('Migration tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
