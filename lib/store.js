'use strict';

const { cleanText, normalizeKey, uniqueNormalized, randomZoneColor, makeIdFromName, clone } = require('./utils');
const { isValidLatLng, polygonHasSelfIntersection, polygonAreaM2, circleAreaM2 } = require('./geo');

const SETTINGS_KEY = 'config';
const SUBJECT_STATES_KEY = 'subjects_state';
const HISTORY_KEY = 'config_history';
const CURRENT_SCHEMA_VERSION = 20;
const RESERVED_STATE_VALUES = ['not_defined', 'unknown', 'error'];

const DEFAULT_GENERAL = {
  historyRetentionDays: 30,
  autopurgeEnabled: true,
  autopurgeDays: 5,
  heavyDebug: false,
};

const DEFAULT_UI = {
  mapCenter: { lat: 48.8566, lng: 2.3522 },
  mapZoom: 6,
  selectedZoneId: null,
  activeTab: 'zones',
};

const DEFAULT_CONFIG = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  zones: [],
  subjects: {},
  sources: [],
  general: { ...DEFAULT_GENERAL },
  ui: { ...DEFAULT_UI },
};

const SUBJECT_METADATA_KEYS = ['id', 'name', 'subjectType', 'source', 'minMoveDistanceM'];
const SUBJECT_RUNTIME_KEYS = [
  'lastLat', 'lastLng', 'lastTimestamp',
  'currentZoneId', 'currentZoneName', 'currentTags',
  'previousZoneId', 'previousZoneName',
  'movementState', 'speedKmh',
  'pendingZoneId', 'pendingZoneName', 'pendingSince',
  'updatedAt',
];

function toPoint(input) {
  return { lat: Number(input?.lat), lng: Number(input?.lng) };
}

function sanitizeUi(ui) {
  const center = toPoint(ui?.mapCenter || DEFAULT_UI.mapCenter);
  return {
    mapCenter: isValidLatLng(center) ? center : clone(DEFAULT_UI.mapCenter),
    mapZoom: Number.isFinite(Number(ui?.mapZoom)) ? Math.max(1, Math.min(19, Number(ui.mapZoom))) : DEFAULT_UI.mapZoom,
    selectedZoneId: cleanText(ui?.selectedZoneId) || null,
    activeTab: cleanText(ui?.activeTab) || DEFAULT_UI.activeTab,
  };
}

function sanitizeGeneral(general) {
  return {
    historyRetentionDays: Number.isFinite(Number(general?.historyRetentionDays)) ? Math.max(1, Math.floor(Number(general.historyRetentionDays))) : DEFAULT_GENERAL.historyRetentionDays,
    autopurgeEnabled: general?.autopurgeEnabled !== false,
    autopurgeDays: Number.isFinite(Number(general?.autopurgeDays)) ? Math.max(0, Math.floor(Number(general.autopurgeDays))) : DEFAULT_GENERAL.autopurgeDays,
    heavyDebug: general?.heavyDebug === true,
  };
}

function sanitizeFilterMode(value) {
  return ['all', 'include', 'exclude'].includes(cleanText(value)) ? cleanText(value) : 'all';
}

function sanitizeZoneOptions(options = {}) {
  return {
    entryDelayS: Number.isFinite(Number(options.entryDelayS)) ? Math.max(0, Number(options.entryDelayS)) : 0,
    exitDelayS: Number.isFinite(Number(options.exitDelayS)) ? Math.max(0, Number(options.exitDelayS)) : 0,
    appliesWithoutSubject: options.appliesWithoutSubject !== false,
    subjectFilter: {
      mode: sanitizeFilterMode(options.subjectFilter?.mode || options.subjectFilterMode),
      subjects: uniqueNormalized(options.subjectFilter?.subjects || options.subjects || []),
    },
    subjectTypeFilter: {
      mode: sanitizeFilterMode(options.subjectTypeFilter?.mode || options.subjectTypeFilterMode),
      subjectTypes: uniqueNormalized(options.subjectTypeFilter?.subjectTypes || options.subjectTypes || []),
    },
  };
}

function sanitizeZone(zone, index = 0) {
  const type = zone?.type === 'polygon' ? 'polygon' : 'circle';
  const name = cleanText(zone?.name) || `Zone ${index + 1}`;
  const tags = uniqueNormalized(zone?.tags || zone?.categories || []);
  const normalized = {
    id: cleanText(zone?.id) || makeIdFromName(name, `zone_${index + 1}`),
    name,
    type,
    active: zone?.active !== false,
    color: cleanText(zone?.color) || randomZoneColor(name),
    priority: Number.isFinite(Number(zone?.priority)) ? Number(zone.priority) : 0,
    tags,
    center: null,
    radius: 100,
    hysteresis: Math.max(0, Number(zone?.hysteresis || 0)),
    paths: [],
    areaM2: 0,
    options: sanitizeZoneOptions(zone?.options || zone),
  };

  if (type === 'circle') {
    normalized.center = toPoint(zone?.center || DEFAULT_UI.mapCenter);
    normalized.radius = Number.isFinite(Number(zone?.radius)) ? Number(zone.radius) : 100;
    normalized.areaM2 = circleAreaM2(normalized.radius);
  } else {
    normalized.paths = Array.isArray(zone?.paths) ? zone.paths.map(toPoint) : [];
    normalized.areaM2 = polygonAreaM2(normalized.paths);
  }

  return normalized;
}

function validateReservedValue(value, typeLabel) {
  if (RESERVED_STATE_VALUES.includes(normalizeKey(value))) {
    throw new Error(`${typeLabel} "${value}" is reserved`);
  }
}

function validateZone(zone, otherZoneNames = []) {
  const name = cleanText(zone?.name);
  if (!name) throw new Error('Zone name is required');
  validateReservedValue(name, 'Zone name');
  if (otherZoneNames.map(normalizeKey).includes(normalizeKey(name))) throw new Error(`Zone "${name}" already exists`);
  if (!/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(cleanText(zone.color || ''))) throw new Error(`Invalid color for zone "${name}"`);
  if (!Number.isFinite(Number(zone.priority))) throw new Error(`Invalid priority for zone "${name}"`);

  if (zone.type === 'circle') {
    if (!isValidLatLng(zone.center)) throw new Error(`Invalid circle center for zone "${name}"`);
    if (!Number.isFinite(Number(zone.radius)) || Number(zone.radius) <= 0) throw new Error(`Radius must be > 0 for zone "${name}"`);
    if (!Number.isFinite(Number(zone.hysteresis)) || Number(zone.hysteresis) < 0) throw new Error(`Hysteresis must be >= 0 for zone "${name}"`);
  } else if (zone.type === 'polygon') {
    if (!Array.isArray(zone.paths) || zone.paths.length < 3) throw new Error(`Polygon "${name}" must contain at least 3 points`);
    if (!zone.paths.every(isValidLatLng)) throw new Error(`Polygon "${name}" contains invalid coordinates`);
    if (polygonHasSelfIntersection(zone.paths)) throw new Error(`Polygon "${name}" is self-intersecting`);
    if (polygonAreaM2(zone.paths) <= 0) throw new Error(`Polygon "${name}" has no measurable area`);
  } else {
    throw new Error(`Unknown zone type for "${name}"`);
  }

  for (const tag of uniqueNormalized(zone.tags || [])) validateReservedValue(tag, 'Tag');
  if (!Number.isFinite(Number(zone.areaM2)) || Number(zone.areaM2) <= 0) throw new Error(`Zone "${name}" has no measurable area`);
}

function sanitizeSubject(subject, fallbackId = '') {
  const name = cleanText(subject?.name) || cleanText(fallbackId) || 'Subject';
  const subjectType = cleanText(subject?.subjectType || '');
  const lastLat = Number(subject?.lastLat);
  const lastLng = Number(subject?.lastLng);
  return {
    id: cleanText(subject?.id) || cleanText(fallbackId) || makeIdFromName(name, 'subject'),
    name,
    subjectType,
    source: subject?.source && typeof subject.source === 'object' ? clone(subject.source) : null,
    minMoveDistanceM: Number.isFinite(Number(subject?.minMoveDistanceM)) ? Math.max(0, Number(subject.minMoveDistanceM)) : 0,
    lastLat: Number.isFinite(lastLat) ? lastLat : null,
    lastLng: Number.isFinite(lastLng) ? lastLng : null,
    lastTimestamp: cleanText(subject?.lastTimestamp || ''),
    currentZoneId: cleanText(subject?.currentZoneId || ''),
    currentZoneName: cleanText(subject?.currentZoneName || subject?.currentZone || ''),
    currentTags: uniqueNormalized(subject?.currentTags || subject?.currentCategories || []),
    previousZoneId: cleanText(subject?.previousZoneId || ''),
    previousZoneName: cleanText(subject?.previousZoneName || subject?.previousZone || '') || 'unknown',
    movementState: ['stable', 'moving', 'unknown'].includes(cleanText(subject?.movementState)) ? cleanText(subject.movementState) : 'unknown',
    speedKmh: Number.isFinite(Number(subject?.speedKmh)) && Number(subject?.speedKmh) >= 0 ? Number(subject.speedKmh) : 0,
    pendingZoneId: cleanText(subject?.pendingZoneId || ''),
    pendingZoneName: cleanText(subject?.pendingZoneName || ''),
    pendingSince: cleanText(subject?.pendingSince || ''),
    updatedAt: cleanText(subject?.updatedAt || subject?.lastTimestamp || ''),
  };
}

function pickFields(source, keys) {
  const result = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source || {}, key)) result[key] = clone(source[key]);
  }
  return result;
}

function splitSubject(subject, fallbackId = '') {
  const normalized = sanitizeSubject(subject, fallbackId);
  return {
    meta: pickFields(normalized, SUBJECT_METADATA_KEYS),
    state: pickFields(normalized, SUBJECT_RUNTIME_KEYS),
  };
}

function mergeSubject(meta, state, fallbackId = '') {
  return sanitizeSubject({ ...(meta || {}), ...(state || {}) }, fallbackId);
}

function sanitizeSource(source) {
  if (!source || typeof source !== 'object') return null;
  const deviceId = cleanText(source.deviceId);
  const subjectId = cleanText(source.subjectId);
  if (!deviceId || !subjectId) return null;
  return {
    deviceId,
    deviceName: cleanText(source.deviceName || ''),
    subjectId,
    latCapability: cleanText(source.latCapability || 'measure_latitude'),
    lngCapability: cleanText(source.lngCapability || 'measure_longitude'),
    createdAt: cleanText(source.createdAt || new Date().toISOString()),
  };
}

function sanitizeConfig(input) {
  const migratedZonesRaw = Array.isArray(input?.zones) ? input.zones : [];
  const zones = migratedZonesRaw.map(sanitizeZone);
  const zoneNames = [];
  for (const zone of zones) {
    validateZone(zone, zoneNames);
    zoneNames.push(zone.name);
  }

  const general = sanitizeGeneral(input?.general || input?.subjectSettings || {});
  const subjectsInput = input?.subjects && typeof input.subjects === 'object' ? input.subjects : {};
  const subjects = {};
  for (const [id, rawSubject] of Object.entries(subjectsInput)) {
    const normalized = sanitizeSubject(rawSubject, id);
    subjects[normalized.id] = normalized;
  }

  const sources = (Array.isArray(input?.sources) ? input.sources : []).map(sanitizeSource).filter(Boolean);

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    zones,
    subjects,
    sources,
    general,
    ui: sanitizeUi(input?.ui),
  };
}

function sanitizeSplitStorage(input) {
  const merged = sanitizeConfig(input);
  const subjects = {};
  const subjectStates = {};

  for (const [id, subject] of Object.entries(merged.subjects || {})) {
    const { meta, state } = splitSubject(subject, id);
    subjects[id] = { ...meta };
    subjectStates[id] = { ...state };
  }

  return {
    config: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      zones: merged.zones,
      subjects,
      sources: merged.sources,
      general: merged.general,
      ui: merged.ui,
    },
    subjectStates,
    merged,
  };
}

function buildMergedConfig(rawConfig, rawSubjectStates) {
  const configObject = rawConfig && typeof rawConfig === 'object' ? clone(rawConfig) : clone(DEFAULT_CONFIG);
  const statesObject = rawSubjectStates && typeof rawSubjectStates === 'object' ? clone(rawSubjectStates) : null;
  const mergedSubjects = {};
  const configSubjects = configObject.subjects && typeof configObject.subjects === 'object' ? configObject.subjects : {};

  for (const [id, subject] of Object.entries(configSubjects)) {
    const state = statesObject?.[id] && typeof statesObject[id] === 'object' ? statesObject[id] : {};
    mergedSubjects[id] = { ...subject, ...state };
  }

  if (!statesObject) {
    for (const [id, subject] of Object.entries(configSubjects)) {
      if (!mergedSubjects[id]) mergedSubjects[id] = subject;
    }
  }

  configObject.subjects = mergedSubjects;
  return migrateConfig(configObject);
}

function migrateConfig(input) {
  if (!input || typeof input !== 'object') return clone(DEFAULT_CONFIG);

  const migrated = clone(input);
  if (Array.isArray(migrated.zones)) {
    migrated.zones = migrated.zones.map(zone => {
      const next = { ...zone };
      if (!next.tags && Array.isArray(next.categories)) next.tags = next.categories;
      if (!next.options) next.options = {};
      if (next.subjectFilterMode || next.subjects || next.subjectTypeFilterMode || next.subjectTypes) {
        next.options = {
          ...next.options,
          subjectFilter: { mode: next.subjectFilterMode || 'all', subjects: next.subjects || [] },
          subjectTypeFilter: { mode: next.subjectTypeFilterMode || 'all', subjectTypes: next.subjectTypes || [] },
        };
      }
      return next;
    });
  }

  return sanitizeConfig(migrated);
}

function getStoreState(homey) {
  if (!homey.__geozonesStoreState) homey.__geozonesStoreState = { cache: null, writeQueue: Promise.resolve() };
  return homey.__geozonesStoreState;
}

function getHistory(homey) {
  return Array.isArray(homey.settings.get(HISTORY_KEY)) ? homey.settings.get(HISTORY_KEY) : [];
}

function pruneHistoryEntries(entries, general = DEFAULT_GENERAL) {
  const retentionDays = Number.isFinite(Number(general?.historyRetentionDays)) ? Math.max(1, Number(general.historyRetentionDays)) : DEFAULT_GENERAL.historyRetentionDays;
  const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
  return (Array.isArray(entries) ? entries : []).filter(entry => {
    const ts = Date.parse(entry?.createdAt || '');
    return Number.isFinite(ts) && ts >= cutoff;
  });
}

async function pushHistory(homey, previousConfig) {
  if (!previousConfig || typeof previousConfig !== 'object') return;
  const history = pruneHistoryEntries(getHistory(homey), previousConfig.general || DEFAULT_GENERAL);
  history.unshift({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    config: clone(previousConfig),
  });
  await homey.settings.set(HISTORY_KEY, history.slice(0, 100));
}

function persistCache(homey, split) {
  const state = getStoreState(homey);
  state.cache = clone(split);
}

async function persistSplitConfig(homey, split, options = {}) {
  const previous = getConfig(homey);
  if (options.pushHistory !== false) await pushHistory(homey, previous);
  await homey.settings.set(SETTINGS_KEY, split.config);
  await homey.settings.set(SUBJECT_STATES_KEY, split.subjectStates);
  await homey.settings.set(HISTORY_KEY, pruneHistoryEntries(getHistory(homey), split.merged.general));
  persistCache(homey, split);
  return clone(split.merged);
}

function getConfig(homey) {
  const state = getStoreState(homey);
  if (state.cache?.merged) return clone(state.cache.merged);

  const rawConfig = homey.settings.get(SETTINGS_KEY);
  const rawSubjectStates = homey.settings.get(SUBJECT_STATES_KEY);
  const merged = buildMergedConfig(rawConfig, rawSubjectStates);
  const split = sanitizeSplitStorage(merged);

  const rawConfigString = JSON.stringify(rawConfig || {});
  const rawStateString = JSON.stringify(rawSubjectStates || {});
  const normalizedConfigString = JSON.stringify(split.config);
  const normalizedStateString = JSON.stringify(split.subjectStates);
  if (rawConfigString != normalizedConfigString || rawStateString != normalizedStateString) {
    try {
      homey.settings.set(SETTINGS_KEY, split.config);
      homey.settings.set(SUBJECT_STATES_KEY, split.subjectStates);
    } catch (error) {
      /* noop */
    }
  }

  persistCache(homey, split);
  return clone(split.merged);
}

async function setConfig(homey, config, options = {}) {
  return enqueueWrite(homey, async () => {
    const split = sanitizeSplitStorage(config);
    return persistSplitConfig(homey, split, options);
  });
}

async function enqueueWrite(homey, writer) {
  const state = getStoreState(homey);
  const task = state.writeQueue.catch(() => null).then(writer);
  state.writeQueue = task.catch(() => null);
  return task;
}

async function updateConfig(homey, updater, options = {}) {
  return enqueueWrite(homey, async () => {
    const current = getConfig(homey);
    const next = await updater(clone(current));
    const split = sanitizeSplitStorage(next);
    return persistSplitConfig(homey, split, options);
  });
}

function getSubjectState(homey, subjectId) {
  const cleanId = cleanText(subjectId);
  if (!cleanId) return null;
  return getConfig(homey).subjects[cleanId] || null;
}

async function setSubjectState(homey, subjectId, statePatch, options = {}) {
  const cleanId = cleanText(subjectId);
  if (!cleanId) return getConfig(homey);

  return enqueueWrite(homey, async () => {
    const current = getConfig(homey);
    const previous = sanitizeSubject(current.subjects[cleanId] || { id: cleanId, name: cleanId }, cleanId);
    const next = sanitizeSubject({ ...previous, ...(statePatch || {}), id: cleanId }, cleanId);
    next.updatedAt = new Date().toISOString();

    current.subjects[cleanId] = next;
    const split = sanitizeSplitStorage(current);
    return persistSplitConfig(homey, split, options);
  });
}

async function deleteSubject(homey, subjectId) {
  const cleanId = cleanText(subjectId);
  return updateConfig(homey, config => {
    delete config.subjects[cleanId];
    for (const zone of config.zones) {
      if (zone.options?.subjectFilter?.subjects) {
        zone.options.subjectFilter.subjects = zone.options.subjectFilter.subjects.filter(id => normalizeKey(id) !== normalizeKey(cleanId));
      }
    }
    config.sources = (config.sources || []).filter(source => source.subjectId !== cleanId);
    return config;
  });
}

async function resetSubjectState(homey, subjectId) {
  const cleanId = cleanText(subjectId);
  return enqueueWrite(homey, async () => {
    const current = getConfig(homey);
    const subject = current.subjects[cleanId];
    if (!subject) return current;
    current.subjects[cleanId] = sanitizeSubject({
      ...subject,
      currentZoneId: '',
      currentZoneName: '',
      currentTags: [],
      previousZoneId: '',
      previousZoneName: 'unknown',
      movementState: 'unknown',
      speedKmh: 0,
      lastLat: null,
      lastLng: null,
      lastTimestamp: '',
      pendingZoneId: '',
      pendingZoneName: '',
      pendingSince: '',
    }, cleanId);
    const split = sanitizeSplitStorage(current);
    return persistSplitConfig(homey, split, { pushHistory: true });
  });
}

async function purgeSubjects(homey, daysOverride = null) {
  return updateConfig(homey, config => {
    const days = Number.isFinite(Number(daysOverride)) ? Math.max(0, Number(daysOverride)) : config.general.autopurgeDays;
    if (!config.general.autopurgeEnabled && daysOverride == null) return config;
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    for (const [subjectId, subject] of Object.entries(config.subjects || {})) {
      const ts = Date.parse(subject.updatedAt || subject.lastTimestamp || '');
      if (days > 0 && Number.isFinite(ts) && ts < cutoff) delete config.subjects[subjectId];
    }
    const remaining = new Set(Object.keys(config.subjects || {}));
    for (const zone of config.zones) {
      if (zone.options?.subjectFilter?.subjects) {
        zone.options.subjectFilter.subjects = zone.options.subjectFilter.subjects.filter(id => remaining.has(id));
      }
    }
    config.sources = (config.sources || []).filter(source => remaining.has(source.subjectId));
    return config;
  });
}

function getDerivedSubjectTypes(config) {
  return uniqueNormalized(Object.values(config.subjects || {}).map(subject => subject.subjectType).filter(Boolean));
}

function getDerivedTags(config) {
  return uniqueNormalized((config.zones || []).flatMap(zone => zone.tags || []));
}

async function restoreHistoryEntry(homey, historyId) {
  const history = getHistory(homey);
  const entry = history.find(item => item.id === historyId);
  if (!entry) throw new Error('History entry not found');
  return setConfig(homey, entry.config, { pushHistory: true });
}

async function deleteHistoryEntry(homey, historyId) {
  const history = getHistory(homey).filter(entry => entry.id !== historyId);
  await homey.settings.set(HISTORY_KEY, history);
  return history;
}

module.exports = {
  SETTINGS_KEY,
  SUBJECT_STATES_KEY,
  HISTORY_KEY,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_CONFIG,
  DEFAULT_GENERAL,
  RESERVED_STATE_VALUES,
  sanitizeZone,
  sanitizeSubject,
  sanitizeConfig,
  validateZone,
  migrateConfig,
  getConfig,
  setConfig,
  updateConfig,
  getSubjectState,
  setSubjectState,
  deleteSubject,
  resetSubjectState,
  purgeSubjects,
  getDerivedSubjectTypes,
  getDerivedTags,
  getHistory,
  restoreHistoryEntry,
  deleteHistoryEntry,
};
