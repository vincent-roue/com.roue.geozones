'use strict';

const { cleanText, normalizeKey, uniqueNormalized, randomZoneColor, makeIdFromName, clone } = require('./utils');
const { logHeavy } = require('./logger');
const { isValidLatLng, polygonHasSelfIntersection, polygonAreaM2, circleAreaM2 } = require('./geo');
const { translate } = require('./i18n');
const { assertMigrationReady, migrateLegacySettings, prepareConfigForWrite } = require('./migration');

const SETTINGS_KEY = 'config';
const HISTORY_KEY = 'config_history';
const CURRENT_SCHEMA_VERSION = 25;
const RESERVED_STATE_VALUES = ['not_defined', 'unknown', 'error'];

const DEFAULT_GENERAL = {
  historyRetentionDays: 30,
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
  general: { ...DEFAULT_GENERAL },
  ui: { ...DEFAULT_UI },
};


function tError(homey, key, fallback = '', tags = {}) {
  return translate(homey, key, fallback, tags);
}

function toPoint(input) {
  const numeric = value => (typeof value === 'number' || (typeof value === 'string' && value.trim())) ? Number(value) : NaN;
  return { lat: numeric(input?.lat), lng: numeric(input?.lng) };
}

function sanitizeUi(ui) {
  const center = toPoint(ui?.mapCenter || DEFAULT_UI.mapCenter);
  return {
    mapCenter: isValidLatLng(center) ? center : clone(DEFAULT_UI.mapCenter),
    mapZoom: Number.isFinite(Number(ui?.mapZoom)) ? Math.max(1, Math.min(19, Number(ui.mapZoom))) : DEFAULT_UI.mapZoom,
    selectedZoneId: cleanText(ui?.selectedZoneId) || null,
    activeTab: ['zones', 'general', 'io', 'help'].includes(cleanText(ui?.activeTab)) ? cleanText(ui.activeTab) : DEFAULT_UI.activeTab,
  };
}

function sanitizeGeneral(general) {
  return {
    historyRetentionDays: Number.isFinite(Number(general?.historyRetentionDays)) ? Math.max(1, Math.floor(Number(general.historyRetentionDays))) : DEFAULT_GENERAL.historyRetentionDays,
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

function validateReservedValue(homey, value, typeLabel) {
  if (RESERVED_STATE_VALUES.includes(normalizeKey(value))) {
    throw new Error(tError(homey, 'reservedValue', `${typeLabel} "${value}" is reserved`, { typeLabel, value }));
  }
}

function validateZone(homey, zone, otherZoneNames = []) {
  const name = cleanText(zone?.name);
  if (!name) throw new Error(tError(homey, 'zoneNameRequired', 'Zone name is required'));
  validateReservedValue(homey, name, 'Zone name');
  if (otherZoneNames.map(normalizeKey).includes(normalizeKey(name))) throw new Error(tError(homey, 'zoneAlreadyExists', `Zone "${name}" already exists`, { name }));
  if (!/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(cleanText(zone.color || ''))) throw new Error(tError(homey, 'invalidZoneColor', `Invalid color for zone "${name}"`, { name }));
  if (!Number.isFinite(Number(zone.priority))) throw new Error(tError(homey, 'invalidZonePriority', `Invalid priority for zone "${name}"`, { name }));

  if (zone.type === 'circle') {
    if (!isValidLatLng(zone.center)) throw new Error(tError(homey, 'invalidCircleCenter', `Invalid circle center for zone "${name}"`, { name }));
    if (!Number.isFinite(Number(zone.radius)) || Number(zone.radius) <= 0) throw new Error(tError(homey, 'invalidZoneRadius', `Radius must be > 0 for zone "${name}"`, { name }));
    if (!Number.isFinite(Number(zone.hysteresis)) || Number(zone.hysteresis) < 0) throw new Error(tError(homey, 'invalidZoneHysteresis', `Hysteresis must be >= 0 for zone "${name}"`, { name }));
  } else if (zone.type === 'polygon') {
    if (!Array.isArray(zone.paths) || zone.paths.length < 3) throw new Error(tError(homey, 'invalidPolygonMinPoints', `Polygon "${name}" must contain at least 3 points`, { name }));
    if (!zone.paths.every(isValidLatLng)) throw new Error(tError(homey, 'invalidPolygonCoordinates', `Polygon "${name}" contains invalid coordinates`, { name }));
    if (polygonHasSelfIntersection(zone.paths)) throw new Error(tError(homey, 'invalidPolygonSelfIntersecting', `Polygon "${name}" is self-intersecting`, { name }));
    if (polygonAreaM2(zone.paths) <= 0) throw new Error(tError(homey, 'invalidPolygonNoArea', `Polygon "${name}" has no measurable area`, { name }));
  } else {
    throw new Error(tError(homey, 'unknownZoneType', `Unknown zone type for "${name}"`, { name }));
  }

  for (const tag of uniqueNormalized(zone.tags || [])) validateReservedValue(homey, tag, 'Tag');
  if (!Number.isFinite(Number(zone.areaM2)) || Number(zone.areaM2) <= 0) throw new Error(tError(homey, 'invalidZoneNoArea', `Zone "${name}" has no measurable area`, { name }));
}

function sanitizeConfig(input, homey = null) {
  const zones = (Array.isArray(input?.zones) ? input.zones : []).map(sanitizeZone);
  const zoneNames = [];
  const zoneIds = new Set();
  for (const zone of zones) {
    if (zoneIds.has(zone.id)) throw new Error(tError(homey, 'duplicateZoneId', `Zone ID "${zone.id}" occurs more than once`, { id: zone.id }));
    zoneIds.add(zone.id);
    validateZone(homey, zone, zoneNames);
    zoneNames.push(zone.name);
  }
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    zones,
    general: sanitizeGeneral(input?.general),
    ui: sanitizeUi(input?.ui),
  };
}

function getStoreState(homey) {
  if (!homey.__geozonesStoreState) homey.__geozonesStoreState = { cache: null, writeQueue: Promise.resolve() };
  return homey.__geozonesStoreState;
}

function getHistory(homey) {
  assertMigrationReady(homey);
  const raw = homey.settings.get(HISTORY_KEY);
  const config = homey.settings.get(SETTINGS_KEY);
  return clone(pruneHistoryEntries(Array.isArray(raw) ? raw : [], config?.general));
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

async function enqueueWrite(homey, writer) {
  const state = getStoreState(homey);
  const task = state.writeQueue.catch(() => null).then(writer);
  state.writeQueue = task.catch(() => null);
  return task;
}

function persistCache(homey, config) {
  const state = getStoreState(homey);
  state.cache = clone(config);
}

function getConfig(homey) {
  assertMigrationReady(homey);
  const state = getStoreState(homey);
  if (state.cache) return clone(state.cache);
  const raw = homey.settings.get(SETTINGS_KEY);
  const normalized = sanitizeConfig(raw || DEFAULT_CONFIG, homey);
  persistCache(homey, normalized);
  return clone(normalized);
}

async function setConfig(homey, config, options = {}) {
  return enqueueWrite(homey, async () => {
    await migrateLegacySettings(homey);
    const previous = getConfig(homey);
    const normalized = sanitizeConfig(await prepareConfigForWrite(homey, config || DEFAULT_CONFIG), homey);
    const changed = JSON.stringify(previous) !== JSON.stringify(normalized);
    if (options.pushHistory !== false && changed) await pushHistory(homey, previous);
    if (!changed) logHeavy(homey, 'store', 'setConfig skipped history push because config is unchanged');
    await homey.settings.set(SETTINGS_KEY, normalized);
    await homey.settings.set(HISTORY_KEY, pruneHistoryEntries(getHistory(homey), normalized.general));
    persistCache(homey, normalized);
    return clone(normalized);
  });
}

async function updateConfig(homey, updater, options = {}) {
  return enqueueWrite(homey, async () => {
    await migrateLegacySettings(homey);
    const current = getConfig(homey);
    const next = await updater(clone(current));
    const normalized = sanitizeConfig(await prepareConfigForWrite(homey, next || DEFAULT_CONFIG), homey);
    const changed = JSON.stringify(current) !== JSON.stringify(normalized);
    if (options.pushHistory !== false && changed) await pushHistory(homey, current);
    if (!changed) logHeavy(homey, 'store', 'updateConfig skipped history push because config is unchanged');
    await homey.settings.set(SETTINGS_KEY, normalized);
    await homey.settings.set(HISTORY_KEY, pruneHistoryEntries(getHistory(homey), normalized.general));
    persistCache(homey, normalized);
    return clone(normalized);
  });
}

function getDerivedTags(config) {
  return uniqueNormalized((config?.zones || []).flatMap(zone => zone.tags || []));
}

async function restoreHistoryEntry(homey, historyId) {
  const history = getHistory(homey);
  const entry = history.find(item => item.id === historyId);
  if (!entry) throw new Error(tError(homey, 'historyEntryNotFound', 'History entry not found'));
  return setConfig(homey, entry.config, { pushHistory: true });
}

async function deleteHistoryEntry(homey, historyId) {
  const history = getHistory(homey).filter(entry => entry.id !== historyId);
  await homey.settings.set(HISTORY_KEY, history);
  return history;
}

module.exports = {
  SETTINGS_KEY,
  HISTORY_KEY,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_CONFIG,
  DEFAULT_GENERAL,
  RESERVED_STATE_VALUES,
  sanitizeZone,
  sanitizeConfig,
  validateZone,
  getConfig,
  setConfig,
  updateConfig,
  getDerivedTags,
  getHistory,
  restoreHistoryEntry,
  deleteHistoryEntry,
};
