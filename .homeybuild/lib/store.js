'use strict';

const { cleanText, uniqueCaseSensitive, randomZoneColor } = require('./utils');
const { isValidLatLng, polygonHasSelfIntersection, polygonAreaM2, circleAreaM2 } = require('./geo');
const { STATE_ZONE_NOT_DEFINED, STATE_ZONE_UNKNOWN, STATE_ZONE_ERROR } = require('./zone-engine');

const SETTINGS_KEY = 'config';
const CURRENT_SCHEMA_VERSION = 4;
const RESERVED_STATE_VALUES = [STATE_ZONE_NOT_DEFINED, STATE_ZONE_UNKNOWN, STATE_ZONE_ERROR];
const DEFAULT_SUBJECT_SETTINGS = {
  autopurgeEnabled: true,
  autopurgeDays: 5,
  heavyDebug: false,
};

const DEFAULT_CONFIG = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  zones: [],
  groups: [],
  categories: [],
  ui: {
    mapCenter: { lat: 48.8566, lng: 2.3522 },
    mapZoom: 6,
    selectedZoneName: null,
    activeTab: 'zones',
  },
  subjectSettings: { ...DEFAULT_SUBJECT_SETTINGS },
  subjects: {},
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toPoint(input) {
  return { lat: Number(input?.lat), lng: Number(input?.lng) };
}

function sanitizeUi(ui) {
  const center = toPoint(ui?.mapCenter || DEFAULT_CONFIG.ui.mapCenter);
  return {
    mapCenter: isValidLatLng(center) ? center : clone(DEFAULT_CONFIG.ui.mapCenter),
    mapZoom: Number.isFinite(Number(ui?.mapZoom)) ? Math.max(1, Math.min(19, Number(ui.mapZoom))) : DEFAULT_CONFIG.ui.mapZoom,
    selectedZoneName: cleanText(ui?.selectedZoneName) || null,
    activeTab: cleanText(ui?.activeTab) || DEFAULT_CONFIG.ui.activeTab,
  };
}

function sanitizeSubjectSettings(subjectSettings) {
  return {
    autopurgeEnabled: subjectSettings?.autopurgeEnabled !== false,
    autopurgeDays: Number.isFinite(Number(subjectSettings?.autopurgeDays)) ? Math.max(0, Math.floor(Number(subjectSettings.autopurgeDays))) : DEFAULT_SUBJECT_SETTINGS.autopurgeDays,
    heavyDebug: subjectSettings?.heavyDebug === true,
  };
}

function sanitizeZone(zone, index = 0) {
  const type = zone?.type === 'polygon' ? 'polygon' : 'circle';
  const name = cleanText(zone?.name) || `Zone ${index + 1}`;
  const normalized = {
    name,
    id: name,
    type,
    active: zone?.active !== false,
    color: cleanText(zone?.color) || randomZoneColor(name),
    priority: Number.isFinite(Number(zone?.priority)) ? Number(zone.priority) : 0,
    groups: uniqueCaseSensitive(zone?.groups || (zone?.group ? [zone.group] : [])),
    categories: uniqueCaseSensitive(zone?.categories || (zone?.category ? [zone.category] : [])),
    center: null,
    radius: 100,
    hysteresis: Math.max(0, Number(zone?.hysteresis || 0)),
    paths: [],
    areaM2: 0,
  };

  if (type === 'circle') {
    normalized.center = toPoint(zone?.center || DEFAULT_CONFIG.ui.mapCenter);
    normalized.radius = Number.isFinite(Number(zone?.radius)) ? Number(zone.radius) : 100;
    normalized.areaM2 = circleAreaM2(normalized.radius);
  } else {
    normalized.paths = Array.isArray(zone?.paths) ? zone.paths.map(toPoint) : [];
    normalized.areaM2 = polygonAreaM2(normalized.paths);
  }

  return normalized;
}

function validateReservedValue(value, typeLabel) {
  if (RESERVED_STATE_VALUES.includes(value)) {
    throw new Error(`${typeLabel} "${value}" is reserved`);
  }
}

function validateZone(zone, otherZoneNames = []) {
  const name = cleanText(zone?.name);
  if (!name) throw new Error('Zone name is required');
  validateReservedValue(name, 'Zone name');
  if (otherZoneNames.includes(name)) throw new Error(`Zone "${name}" already exists`);
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

  for (const group of uniqueCaseSensitive(zone.groups || [])) validateReservedValue(cleanText(group), 'Group');
  for (const category of uniqueCaseSensitive(zone.categories || [])) validateReservedValue(cleanText(category), 'Category');
  if (!Number.isFinite(Number(zone.areaM2)) || Number(zone.areaM2) <= 0) throw new Error(`Zone "${name}" has no measurable area`);
}

function sanitizeSubject(subject) {
  const rawCurrentZone = cleanText(subject?.currentZone);
  const normalizedCurrentZone = rawCurrentZone === 'none'
    ? STATE_ZONE_NOT_DEFINED
    : (rawCurrentZone || STATE_ZONE_UNKNOWN);
  const currentGroups = uniqueCaseSensitive(subject?.currentGroups || []);
  const currentCategories = uniqueCaseSensitive(subject?.currentCategories || []);
  const lastLat = Number(subject?.lastLat);
  const lastLng = Number(subject?.lastLng);
  const lastTimestamp = cleanText(subject?.lastTimestamp || subject?.updatedAt || '');
  const updatedAt = cleanText(subject?.updatedAt || lastTimestamp);
  return {
    currentZone: normalizedCurrentZone,
    currentGroups,
    currentCategories,
    lastLat: Number.isFinite(lastLat) ? lastLat : null,
    lastLng: Number.isFinite(lastLng) ? lastLng : null,
    lastTimestamp: lastTimestamp || updatedAt || '',
    updatedAt: updatedAt || lastTimestamp || '',
  };
}

function purgeSubjectsMap(subjects, subjectSettings, now = new Date()) {
  const settings = sanitizeSubjectSettings(subjectSettings);
  const entries = Object.entries(subjects || {});
  if (!settings.autopurgeEnabled || settings.autopurgeDays <= 0) {
    return Object.fromEntries(entries.map(([id, subject]) => [id, sanitizeSubject(subject)]));
  }
  const maxAgeMs = settings.autopurgeDays * 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();
  const result = {};
  for (const [id, subject] of entries) {
    const cleanId = cleanText(id);
    if (!cleanId) continue;
    const normalized = sanitizeSubject(subject);
    const timestamp = Date.parse(normalized.updatedAt || normalized.lastTimestamp || '');
    if (Number.isFinite(timestamp) && (nowMs - timestamp) > maxAgeMs) continue;
    result[cleanId] = normalized;
  }
  return result;
}

function sanitizeConfig(input) {
  const zones = Array.isArray(input?.zones) ? input.zones.map(sanitizeZone) : [];
  const zoneNames = [];
  for (const zone of zones) {
    validateZone(zone, zoneNames);
    zoneNames.push(zone.name);
  }
  const explicitGroups = uniqueCaseSensitive(input?.groups || []);
  const explicitCategories = uniqueCaseSensitive(input?.categories || []);
  for (const group of explicitGroups) validateReservedValue(cleanText(group), 'Group');
  for (const category of explicitCategories) validateReservedValue(cleanText(category), 'Category');
  const derivedGroups = uniqueCaseSensitive(zones.flatMap(zone => zone.groups));
  const derivedCategories = uniqueCaseSensitive(zones.flatMap(zone => zone.categories));
  const subjectSettings = sanitizeSubjectSettings(input?.subjectSettings);
  const subjects = purgeSubjectsMap(input?.subjects && typeof input.subjects === 'object' ? input.subjects : {}, subjectSettings);

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    zones,
    groups: uniqueCaseSensitive([...explicitGroups, ...derivedGroups]),
    categories: uniqueCaseSensitive([...explicitCategories, ...derivedCategories]),
    ui: sanitizeUi(input?.ui),
    subjectSettings,
    subjects,
  };
}

function migrateConfig(input) {
  if (!input || typeof input !== 'object') return clone(DEFAULT_CONFIG);
  return sanitizeConfig(input);
}

function getConfig(homey) {
  const raw = homey.settings.get(SETTINGS_KEY);
  const normalized = migrateConfig(raw);
  const changed = JSON.stringify(raw || {}) !== JSON.stringify(normalized);
  if (changed) {
    try { homey.settings.set(SETTINGS_KEY, normalized); } catch (error) { /* noop */ }
  }
  return normalized;
}

async function setConfig(homey, config) {
  const normalized = sanitizeConfig(config);
  await homey.settings.set(SETTINGS_KEY, normalized);
  return normalized;
}

async function updateConfig(homey, updater) {
  const current = getConfig(homey);
  const next = await updater(clone(current));
  return setConfig(homey, next);
}

function getSubjectState(homey, subjectId) {
  const cleanId = cleanText(subjectId);
  if (!cleanId) return null;
  return getConfig(homey).subjects[cleanId] || null;
}

async function setSubjectState(homey, subjectId, state) {
  const cleanId = cleanText(subjectId);
  if (!cleanId) return getConfig(homey);
  return updateConfig(homey, config => {
    config.subjects[cleanId] = {
      ...(config.subjects[cleanId] || {}),
      ...sanitizeSubject(state),
      updatedAt: new Date().toISOString(),
    };
    return config;
  });
}

async function resetSubjectState(homey, subjectId) {
  const cleanId = cleanText(subjectId);
  return updateConfig(homey, config => {
    delete config.subjects[cleanId];
    return config;
  });
}

async function purgeSubjects(homey) {
  return updateConfig(homey, config => ({
    ...config,
    subjects: purgeSubjectsMap(config.subjects, config.subjectSettings),
  }));
}

module.exports = {
  SETTINGS_KEY,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_CONFIG,
  DEFAULT_SUBJECT_SETTINGS,
  RESERVED_STATE_VALUES,
  clone,
  sanitizeZone,
  sanitizeConfig,
  validateZone,
  migrateConfig,
  getConfig,
  setConfig,
  updateConfig,
  getSubjectState,
  setSubjectState,
  resetSubjectState,
  purgeSubjects,
  purgeSubjectsMap,
};
