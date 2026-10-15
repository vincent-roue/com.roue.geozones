'use strict';

const crypto = require('crypto');
const { cleanText, normalizeKey, uniqueNormalized, clone, makeIdFromName } = require('./utils');

const BACKUP_KEY = 'migration_backup_v25';
const MIGRATION_KEY = 'migration_v25';
const RECOVERY_KEY = 'migration_subjects_v25';
const IMPORT_BACKUPS_KEY = 'migration_import_backups_v25';
const TARGET_SCHEMA = 25;
const INTERNAL_KEYS = new Set([BACKUP_KEY, MIGRATION_KEY, RECOVERY_KEY, IMPORT_BACKUPS_KEY]);

function digest(value) {
  const canonical = item => {
    if (Array.isArray(item)) return `[${item.map(canonical).join(',')}]`;
    if (object(item)) return `{${Object.keys(item).sort().map(key => `${JSON.stringify(key)}:${canonical(item[key])}`).join(',')}}`;
    return JSON.stringify(item);
  };
  return crypto.createHash('sha256').update(canonical(value) ?? 'undefined').digest('hex');
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function numberOrNull(value) {
  if (typeof value !== 'number' && !(typeof value === 'string' && value.trim())) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function hasLegacyData(homey) {
  const raw = homey.settings.get('config');
  const states = homey.settings.get('subjects_state');
  const zoneIds = (Array.isArray(raw?.zones) ? raw.zones : []).map((zone, index) => cleanText(zone?.id) || makeIdFromName(zone?.name, `zone_${index + 1}`));
  return Boolean((object(raw) && (Number(raw.schemaVersion || 0) < TARGET_SCHEMA
    || Object.keys(raw.subjects || {}).length || (Array.isArray(raw.sources) && raw.sources.length)
    || new Set(zoneIds).size !== zoneIds.length))
    || (object(states) && Object.keys(states).length));
}

function getLegacyBackup(homey) {
  const backup = homey.settings.get(BACKUP_KEY);
  if (backup == null) return null;
  if (!object(backup) || backup.version !== 1 || !object(backup.payload)
    || !object(backup.payload.settings) || digest(backup.payload) !== backup.sha256) {
    throw new Error('The original GeoZones backup could not be verified. Migration has stopped without deleting legacy data.');
  }
  const result = clone(backup);
  const imports = homey.settings.get(IMPORT_BACKUPS_KEY);
  if (imports != null) {
    if (!Array.isArray(imports) || imports.some(entry => !object(entry) || digest(entry.payload) !== entry.sha256)) {
      throw new Error('GeoZones could not verify a saved legacy import. Its original data has been retained.');
    }
    result.imports = clone(imports);
  }
  return result;
}

function assertMigrationReady(homey) {
  if (Number(homey.settings.get('config')?.schemaVersion) > TARGET_SCHEMA) {
    throw new Error('This GeoZones configuration was saved by a newer app version. It has been left unchanged.');
  }
  const status = homey.settings.get(MIGRATION_KEY);
  if (status?.phase === 'complete') {
    const backup = getLegacyBackup(homey);
    if (!backup || backup.sha256 !== status.backupSha256) throw new Error('GeoZones migration backup is unavailable. Configuration changes have been stopped to protect legacy data.');
    if (!homey.settings.get(RECOVERY_KEY)) throw new Error('GeoZones legacy subject recovery data is unavailable. The original backup has been retained.');
    getRecovery(homey);
    return;
  }
  if (hasLegacyData(homey) || status) {
    throw new Error('GeoZones must finish its protected data migration before reading or changing configuration. Restart the app to retry.');
  }
}

async function verifiedSet(homey, key, value) {
  await homey.settings.set(key, clone(value));
  if (digest(homey.settings.get(key)) !== digest(value)) {
    throw new Error(`GeoZones could not verify saved migration data (${key}). Legacy data has been retained; restart the app to retry.`);
  }
}

function recoveryDigest(recovery) {
  const { sha256, ...payload } = recovery;
  return digest(payload);
}

async function saveRecovery(homey, recovery) {
  const sealed = clone(recovery);
  sealed.sha256 = recoveryDigest(sealed);
  await verifiedSet(homey, RECOVERY_KEY, sealed);
}

async function ensureBackup(homey) {
  const existing = getLegacyBackup(homey);
  if (existing) return existing;
  // SDK ManagerSettings#getKeys is required: a partial list is not a complete backup.
  if (typeof homey.settings.getKeys !== 'function') {
    throw new Error('GeoZones cannot enumerate all original settings; migration stopped before changing any data.');
  }
  const keys = homey.settings.getKeys();
  if (!Array.isArray(keys)) throw new Error('GeoZones could not enumerate original settings.');
  const settings = Object.create(null);
  for (const key of [...keys].sort()) {
    if (!INTERNAL_KEYS.has(key)) settings[key] = clone(homey.settings.get(key));
  }
  const payload = { settings };
  const backup = { version: 1, createdAt: new Date().toISOString(), payload, sha256: digest(payload) };
  await verifiedSet(homey, BACKUP_KEY, backup);
  return getLegacyBackup(homey);
}

function remapZones(config) {
  const zones = Array.isArray(config.zones) ? config.zones : [];
  const used = new Set();
  const reserved = new Set(zones.map((zone, index) => cleanText(zone?.id) || makeIdFromName(zone?.name, `zone_${index + 1}`)));
  const usedNames = new Set();
  const originalNames = new Set(zones.map((zone, index) => normalizeKey(cleanText(zone?.name) || `Zone ${index + 1}`)));
  const reservedNames = new Set(['not_defined', 'unknown', 'error']);
  const mappings = [];
  zones.forEach((zone, index) => {
    const oldId = cleanText(zone?.id) || makeIdFromName(zone?.name, `zone_${index + 1}`);
    const oldName = cleanText(zone?.name) || `Zone ${index + 1}`;
    let newName = oldName;
    let nameSuffix = 2;
    if (usedNames.has(normalizeKey(newName)) || reservedNames.has(normalizeKey(newName))) {
      do { newName = `${oldName} (${nameSuffix++})`; }
      while (usedNames.has(normalizeKey(newName)) || originalNames.has(normalizeKey(newName)));
    }
    let newId = oldId;
    let suffix = 2;
    while (used.has(newId)) {
      newId = `${oldId}__migrated_${suffix++}`;
      while (reserved.has(newId) || used.has(newId)) newId = `${oldId}__migrated_${suffix++}`;
    }
    zone.id = newId;
    zone.name = newName;
    used.add(newId);
    usedNames.add(normalizeKey(newName));
    mappings.push({ index, oldId, newId, oldName, newName, name: newName });
  });
  return mappings;
}

function findZoneReference(id, name, mappings) {
  const exactName = mappings.find(zone => zone.oldName === cleanText(name) && cleanText(name));
  const byId = mappings.find(zone => zone.oldId === cleanText(id));
  const byName = mappings.find(zone => normalizeKey(zone.oldName) === normalizeKey(name) && cleanText(name));
  return exactName || byId || byName;
}

function remapZoneReference(id, name, mappings) {
  return findZoneReference(id, name, mappings)?.newId || cleanText(id);
}

function buildMigrationPlan(backup, namespace = '') {
  const settings = backup.payload.settings;
  const config = object(settings.config) ? clone(settings.config) : { zones: [] };
  const originalSubjects = object(config.subjects) ? config.subjects : {};
  const splitStates = object(settings.subjects_state) ? settings.subjects_state : {};
  const sources = Array.isArray(config.sources) ? config.sources : [];
  const mappings = remapZones(config);
  const namesById = new Map();
  const subjects = [];
  const keys = [...new Set([...Object.keys(originalSubjects), ...Object.keys(splitStates), ...sources.map(source => cleanText(source?.subjectId)).filter(Boolean)])].sort();
  for (const key of keys) {
    const meta = object(originalSubjects[key]) ? originalSubjects[key] : {};
    const split = object(splitStates[key]) ? splitStates[key] : {};
    const subject = { ...meta, ...split };
    const name = cleanText(meta.name || subject.name || key) || 'Subject';
    const legacyId = cleanText(meta.id || key);
    const id = `legacy_${digest({ key, namespace }).slice(0, 24)}`;
    const linkedSources = sources.filter(source => [key, legacyId].includes(cleanText(source?.subjectId)));
    if (object(meta.source)) linkedSources.push(clone(meta.source));
    const rawLat = numberOrNull(subject.lastLat);
    const rawLng = numberOrNull(subject.lastLng);
    const validCoordinates = rawLat !== null && rawLng !== null && Math.abs(rawLat) <= 90 && Math.abs(rawLng) <= 180;
    const currentName = cleanText(subject.currentZoneName || subject.currentZone);
    const previousName = cleanText(subject.previousZoneName || subject.previousZone);
    const pendingName = cleanText(subject.pendingZoneName);
    const runtime = {
      lastLat: validCoordinates ? rawLat : null,
      lastLng: validCoordinates ? rawLng : null,
      lastTimestamp: cleanText(subject.lastTimestamp),
      currentZoneId: remapZoneReference(subject.currentZoneId, subject.currentZoneName || subject.currentZone, mappings),
      currentZoneName: findZoneReference(subject.currentZoneId, currentName, mappings)?.newName || currentName || 'not_defined',
      currentTags: uniqueNormalized(subject.currentTags || subject.currentCategories || []),
      previousZoneId: remapZoneReference(subject.previousZoneId, subject.previousZoneName || subject.previousZone, mappings),
      previousZoneName: findZoneReference(subject.previousZoneId, previousName, mappings)?.newName || previousName || 'not_defined',
      movementState: ['stable', 'moving', 'unknown'].includes(subject.movementState) ? subject.movementState : 'unknown',
      speedKmh: Math.max(0, numberOrNull(subject.speedKmh) || 0),
      pendingZoneId: remapZoneReference(subject.pendingZoneId, subject.pendingZoneName, mappings),
      pendingZoneName: findZoneReference(subject.pendingZoneId, pendingName, mappings)?.newName || pendingName,
      pendingSince: cleanText(subject.pendingSince),
      updatedAt: cleanText(subject.updatedAt || subject.lastTimestamp),
    };
    subjects.push({
      id, deviceId: id, name, status: 'pending',
      settings: {
        subjectType: cleanText(meta.subjectType || subject.subjectType),
        enabled: meta.enabled !== false,
        minMoveDistanceM: Math.max(0, numberOrNull(meta.minMoveDistanceM)
          ?? numberOrNull(config.subjectSettings?.minMoveDistanceM) ?? numberOrNull(config.general?.minMoveDistanceM) ?? 0),
      },
      runtime,
      legacy: { key, id: legacyId, metadata: clone(meta), state: clone(split), sources: clone(linkedSources) },
    });
    for (const candidate of [key, legacyId]) if (!namesById.has(normalizeKey(candidate))) namesById.set(normalizeKey(candidate), name);
  }
  for (const zone of config.zones || []) {
    if (!object(zone.options)) zone.options = {};
    const options = zone.options;
    if (!options.subjectFilter && (zone.subjectFilterMode || Array.isArray(zone.subjects))) {
      options.subjectFilter = { mode: zone.subjectFilterMode || 'all', subjects: zone.subjects || [] };
    }
    if (!options.subjectTypeFilter && (zone.subjectTypeFilterMode || Array.isArray(zone.subjectTypes))) {
      options.subjectTypeFilter = { mode: zone.subjectTypeFilterMode || 'all', subjectTypes: zone.subjectTypes || [] };
    }
    const filter = options.subjectFilter?.subjects || options.subjects;
    if (Array.isArray(filter)) {
      const names = filter.map(value => namesById.get(normalizeKey(value)) || value);
      if (options.subjectFilter) options.subjectFilter.subjects = names;
      else options.subjects = names;
    }
  }
  if (config.ui?.selectedZoneId) config.ui.selectedZoneId = remapZoneReference(config.ui.selectedZoneId, '', mappings);
  else if (config.ui?.selectedZoneName) config.ui.selectedZoneId = remapZoneReference('', config.ui.selectedZoneName, mappings);
  if (object(config.subjectSettings)) config.general = { ...config.subjectSettings, ...(config.general || {}) };
  return { config, subjects, mappings, fromSchemaVersion: Number(settings.config?.schemaVersion || 0) };
}

function getMigrationState(homey) {
  if (!homey.__geozonesMigrationState) homey.__geozonesMigrationState = { task: null, recoveryQueue: Promise.resolve() };
  return homey.__geozonesMigrationState;
}

function enqueueRecovery(homey, writer) {
  const state = getMigrationState(homey);
  const task = state.recoveryQueue.catch(() => null).then(writer);
  state.recoveryQueue = task.catch(() => null);
  return task;
}

async function migrateLegacySettings(homey) {
  // An unknown future schema must never enter the legacy conversion path, even if it has subjects.
  if (Number(homey.settings.get('config')?.schemaVersion) > TARGET_SCHEMA) {
    throw new Error('This GeoZones configuration was saved by a newer app version. It has been left unchanged.');
  }
  const state = getMigrationState(homey);
  if (state.task) return state.task;
  state.task = (async () => {
    const existingStatus = homey.settings.get(MIGRATION_KEY);
    if (existingStatus?.phase === 'complete') {
      assertMigrationReady(homey);
      return getMigrationStatus(homey);
    }
    if (!hasLegacyData(homey) && !existingStatus && !homey.settings.get(BACKUP_KEY)) return getMigrationStatus(homey);
    // No normalisation, config/history writes, or deletion takes place before this verified snapshot.
    const backup = await ensureBackup(homey);
    try {
      const plan = buildMigrationPlan(backup);
      await verifiedSet(homey, MIGRATION_KEY, { phase: 'prepared', backupSha256: backup.sha256, fromSchemaVersion: plan.fromSchemaVersion });
      await enqueueRecovery(homey, async () => {
        const previousRecovery = homey.settings.get(RECOVERY_KEY);
        if (previousRecovery != null && (previousRecovery.backupSha256 !== backup.sha256 || !Array.isArray(previousRecovery.subjects))) {
          throw new Error('The legacy subject recovery list does not match the verified backup.');
        }
        const recovery = previousRecovery ? getRecovery(homey)
          : { version: 1, backupSha256: backup.sha256, subjects: plan.subjects, zoneIdMappings: plan.mappings };
        if (previousRecovery) {
          const planned = new Map(plan.subjects.map(row => [row.id, row]));
          recovery.subjects = recovery.subjects.map(row => row.status === 'recovered' ? row : (planned.get(row.id) || row));
          const existingIds = new Set(recovery.subjects.map(row => row.id));
          recovery.subjects.push(...plan.subjects.filter(row => !existingIds.has(row.id)));
          recovery.zoneIdMappings = plan.mappings;
        }
        await saveRecovery(homey, recovery);
      });
      const { sanitizeConfig } = require('./store');
      const normalized = sanitizeConfig(plan.config, homey);
      await verifiedSet(homey, 'config', normalized);
      await verifiedSet(homey, MIGRATION_KEY, {
        phase: 'complete', backupSha256: backup.sha256, fromSchemaVersion: plan.fromSchemaVersion,
        completedAt: new Date().toISOString(), flowsRequireRewiring: true,
      });
      if (homey.__geozonesStoreState) homey.__geozonesStoreState.cache = null;
      return getMigrationStatus(homey);
    } catch (error) {
      // The immutable backup and all legacy side keys remain available even after a partial write.
      try { await verifiedSet(homey, MIGRATION_KEY, { phase: 'error', backupSha256: backup.sha256, fromSchemaVersion: Number(backup.payload.settings.config?.schemaVersion || 0), lastError: error.message }); } catch (_) { /* Retry from backup at next start. */ }
      throw error;
    }
  })();
  try { return await state.task; } finally { state.task = null; }
}

function getRecovery(homey) {
  const recovery = homey.settings.get(RECOVERY_KEY);
  if (recovery == null) return { version: 1, subjects: [] };
  const backup = getLegacyBackup(homey);
  if (!backup || recovery.backupSha256 !== backup.sha256 || !Array.isArray(recovery.subjects)
    || recovery.sha256 !== recoveryDigest(recovery)) {
    throw new Error('GeoZones could not verify the legacy subject recovery list.');
  }
  return clone(recovery);
}

function getMigrationStatus(homey) {
  const saved = homey.settings.get(MIGRATION_KEY);
  let backupVerified = false;
  let recovery = { subjects: [] };
  let lastError = saved?.lastError || null;
  try { backupVerified = Boolean(getLegacyBackup(homey)); recovery = getRecovery(homey); } catch (error) { lastError = error.message; }
  const pendingSubjects = recovery.subjects.filter(row => row.status !== 'recovered').map(row => ({
    id: row.id, name: row.name, subjectType: row.settings.subjectType, hasSource: row.legacy.sources.length > 0,
  }));
  return {
    status: lastError || (saved && saved.phase !== 'complete') ? 'error' : (pendingSubjects.length ? 'pending_recovery' : (saved?.phase === 'complete' ? 'complete' : 'none')),
    fromSchemaVersion: saved?.fromSchemaVersion ?? null,
    pendingSubjects, recoveredSubjects: recovery.subjects.filter(row => row.status === 'recovered').length,
    totalSubjects: recovery.subjects.length, backupVerified, flowsRequireRewiring: Boolean(saved || hasLegacyData(homey)), lastError,
  };
}

async function prepareConfigForWrite(homey, input) {
  // Accept the old direct export as well as a complete protected backup or split-storage export.
  const wrappedSettings = object(input?.payload?.settings) ? input.payload.settings : input;
  const rawConfig = object(wrappedSettings?.config) ? wrappedSettings.config : wrappedSettings;
  if (Number(rawConfig?.schemaVersion) > TARGET_SCHEMA) throw new Error('This configuration requires a newer GeoZones version.');
  const rawStates = object(wrappedSettings?.subjects_state) ? wrappedSettings.subjects_state : {};
  const legacy = object(rawConfig) && (Object.keys(rawConfig.subjects || {}).length
    || (Array.isArray(rawConfig.sources) && rawConfig.sources.length) || Object.keys(rawStates).length);
  if (!legacy) return rawConfig;
  const backup = await ensureBackup(homey);
  const importHash = digest(input);
  const imports = clone(homey.settings.get(IMPORT_BACKUPS_KEY) || []);
  if (!imports.some(entry => entry.sha256 === importHash)) {
    imports.push({ importedAt: new Date().toISOString(), payload: clone(input), sha256: importHash });
    await verifiedSet(homey, IMPORT_BACKUPS_KEY, imports);
  }
  // Imported duplicate IDs are rejected, whereas an installed legacy config is remapped on upgrade.
  const { sanitizeConfig } = require('./store');
  sanitizeConfig(rawConfig, homey);
  const payload = { settings: { config: clone(rawConfig), subjects_state: clone(rawStates) } };
  const plan = buildMigrationPlan({ payload, sha256: digest(payload) }, importHash);
  await enqueueRecovery(homey, async () => {
    const recovery = homey.settings.get(RECOVERY_KEY) ? getRecovery(homey)
      : { version: 1, backupSha256: backup.sha256, subjects: [], zoneIdMappings: [] };
    const ids = new Set(recovery.subjects.map(subject => subject.id));
    for (const subject of plan.subjects) {
      if (!ids.has(subject.id)) { recovery.subjects.push(subject); ids.add(subject.id); }
    }
    recovery.zoneIdMappings.push(...plan.mappings.filter(mapping => mapping.oldId !== mapping.newId || mapping.oldName !== mapping.newName));
    await saveRecovery(homey, recovery);
  });
  if (!homey.settings.get(MIGRATION_KEY)) {
    await verifiedSet(homey, MIGRATION_KEY, {
      phase: 'complete', backupSha256: backup.sha256, fromSchemaVersion: plan.fromSchemaVersion,
      completedAt: new Date().toISOString(), flowsRequireRewiring: true,
    });
  }
  return plan.config;
}

async function createRecoveredSubject(homey, recoveryId, nameOverride = '') {
  await migrateLegacySettings(homey);
  const row = getRecovery(homey).subjects.find(item => item.id === cleanText(recoveryId));
  if (!row || row.status === 'recovered') throw new Error('This legacy subject has already been recovered or is unavailable.');
  const name = cleanText(nameOverride) || row.name;
  await homey.app.ensureSubjectNameAvailable(name);
  return { name, data: { id: row.deviceId }, settings: clone(row.settings), store: { legacyRecoveryId: row.id } };
}

async function restoreMigratedSubject(device) {
  const id = cleanText(device.getStoreValue('legacyRecoveryId'));
  if (!id) return false;
  await migrateLegacySettings(device.homey);
  return enqueueRecovery(device.homey, async () => {
    const recovery = getRecovery(device.homey);
    const row = recovery.subjects.find(item => item.id === id && item.deviceId === device.getData().id);
    if (!row) throw new Error('The original subject state is unavailable. Its backup has been retained.');
    if (device.getStoreValue('legacyRecoveryApplied') === id) {
      if (row.status !== 'recovered') {
        row.status = 'recovered';
        row.recoveredAt = new Date().toISOString();
        row.recoveredName = device.getName();
        await saveRecovery(device.homey, recovery);
      }
      return false;
    }
    const runtime = row.runtime;
    await device.setSettings(clone(row.settings));
    for (const key of ['currentZoneId', 'previousZoneId', 'pendingZoneId', 'pendingZoneName', 'pendingSince']) await device.setStoreValue(key, runtime[key]);
    await device.setStoreValue('legacySubjectData', clone(row.legacy));
    await device.setStoreValue('lastSource', 'legacy:recovery');
    const capabilities = {
      subject_type: row.settings.subjectType, enabled: row.settings.enabled, min_move_distance_m: row.settings.minMoveDistanceM,
      latitude: runtime.lastLat, longitude: runtime.lastLng, last_update: runtime.lastTimestamp,
      current_zone: runtime.currentZoneName, previous_zone: runtime.previousZoneName, zone_tags: runtime.currentTags.join(','),
      movement_state: runtime.movementState, speed_kmh: runtime.speedKmh,
    };
    for (const [key, value] of Object.entries(capabilities)) {
      if (!device.hasCapability(key)) throw new Error(`Cannot restore legacy subject: capability ${key} is unavailable.`);
      await device.setCapabilityValue(key, value);
      if (device.getCapabilityValue(key) !== value) throw new Error(`GeoZones could not verify recovered capability ${key}. Restart the app to retry.`);
    }
    // Write the per-device checkpoint only after every value was restored. Retry safely after any failure.
    await device.setStoreValue('legacyRecoveryApplied', id);
    row.status = 'recovered';
    row.recoveredAt = new Date().toISOString();
    row.recoveredName = device.getName();
    await saveRecovery(device.homey, recovery);
    return true;
  });
}

module.exports = {
  BACKUP_KEY, MIGRATION_KEY, RECOVERY_KEY, IMPORT_BACKUPS_KEY, assertMigrationReady, migrateLegacySettings, prepareConfigForWrite,
  getLegacyBackup, getMigrationStatus, createRecoveredSubject, restoreMigratedSubject,
  buildMigrationPlan,
};
