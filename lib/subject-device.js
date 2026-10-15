'use strict';

const { determineBestZone, STATE_ZONE_NOT_DEFINED, isFoundZoneName } = require('./zone-engine');
const { haversineMeters, isValidLat, isValidLng } = require('./geo');
const { cleanText, normalizeKey, uniqueNormalized } = require('./utils');
const { translate } = require('./i18n');
const { log, logWarn, logError, logHeavy, shouldLogOnce, shouldThrottle } = require('./logger');

const runtimeByDevice = new WeakMap();

function getDeviceRuntime(device) {
  if (!runtimeByDevice.has(device)) runtimeByDevice.set(device, { queue: Promise.resolve(), timer: null, generation: 0, disposed: false });
  return runtimeByDevice.get(device);
}

function cancelTransitionTimer(device) {
  const runtime = getDeviceRuntime(device);
  runtime.generation += 1;
  if (runtime.timer !== null) {
    if (typeof device.homey?.clearTimeout === 'function') device.homey.clearTimeout(runtime.timer);
    else clearTimeout(runtime.timer);
    runtime.timer = null;
  }
}

function enqueueSubjectOperation(device, operation) {
  const runtime = getDeviceRuntime(device);
  const task = runtime.queue.catch(() => null).then(() => {
    if (runtime.disposed) throw new Error(tError(device.homey, 'subjectInactive', 'Subject is no longer active'));
    return operation();
  });
  runtime.queue = task.catch(() => null);
  return task;
}

function scheduleTransitionTimer(device, result) {
  cancelTransitionTimer(device);
  const runtime = getDeviceRuntime(device);
  if (runtime.disposed || !result.waiting || !Number.isFinite(result.nextEvaluationAt)) return;
  const generation = runtime.generation;
  const delayMs = Math.min(2147483647, Math.max(1, result.nextEvaluationAt - Date.now()));
  const callback = () => {
    if (runtime.disposed || generation !== runtime.generation) return;
    runtime.timer = null;
    enqueueSubjectOperation(device, async () => {
      if (generation !== runtime.generation) return;
      await evaluateStoredPositionNow(device, 'transition:timer');
    }).catch(error => logError(device.homey, 'transition-timer', error));
  };
  runtime.timer = typeof device.homey?.setTimeout === 'function'
    ? device.homey.setTimeout(callback, delayMs)
    : setTimeout(callback, delayMs);
  runtime.timer?.unref?.();
}

async function disposeSubjectRuntime(device) {
  const runtime = getDeviceRuntime(device);
  runtime.disposed = true;
  cancelTransitionTimer(device);
  await runtime.queue.catch(() => null);
}

const COMMON_CAPABILITIES = [
  'subject_type',
  'enabled',
  'min_move_distance_m',
  'latitude',
  'longitude',
  'last_update',
  'current_zone',
  'previous_zone',
  'zone_tags',
  'movement_state',
  'speed_kmh',
  'distance_to_homey',
];

const LINKED_CAPABILITIES = [
  'source_problem',
  'source_status',
  'source_stale',
  'source_device_name',
  'source_last_update',
  'source_lat_capability',
  'source_lng_capability',
];


function tError(homey, key, fallback = '', tags = {}) {
  return translate(homey, key, fallback, tags);
}

function bool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = normalizeKey(value);
  if (['true', '1', 'yes', 'on', 'enable', 'enabled'].includes(text)) return true;
  if (['false', '0', 'no', 'off', 'disable', 'disabled'].includes(text)) return false;
  return fallback;
}

async function ensureCapability(device, capabilityId) {
  if (!device.hasCapability(capabilityId)) {
    try {
      await device.addCapability(capabilityId);
    } catch (error) {
      // ignore add failures for already present/static capabilities
    }
  }
}

async function setCapabilitySafe(device, capabilityId, value) {
  try {
    if (!device.hasCapability(capabilityId)) return;
    const currentValue = device.getCapabilityValue(capabilityId);
    if (currentValue === value) return;
    await device.setCapabilityValue(capabilityId, value);
  } catch (error) {
    logError(device.homey, 'capability', error, { subject: device.getName(), capabilityId, value });
  }
}

async function ensureCapabilities(device, linked = false) {
  for (const capabilityId of COMMON_CAPABILITIES) await ensureCapability(device, capabilityId);
  if (linked) {
    for (const capabilityId of LINKED_CAPABILITIES) await ensureCapability(device, capabilityId);
  }
}

function getCommonSettings(device, settingsOverride = null) {
  const settings = settingsOverride || device.getSettings();
  return {
    subjectType: cleanText(settings.subjectType || ''),
    enabled: settings.enabled !== false,
    minMoveDistanceM: Number.isFinite(Number(settings.minMoveDistanceM)) ? Math.max(0, Number(settings.minMoveDistanceM)) : 0,
  };
}

function getLinkedSettings(device) {
  const settings = device.getSettings();
  return {
    sourceLinkEnabled: settings.sourceLinkEnabled !== false,
    sourceDeviceId: cleanText(settings.sourceDeviceId || ''),
    sourceLatCapability: cleanText(settings.sourceLatCapability || ''),
    sourceLngCapability: cleanText(settings.sourceLngCapability || ''),
    sourceStaleAfterMinutes: Number.isFinite(Number(settings.sourceStaleAfterMinutes)) ? Math.max(1, Number(settings.sourceStaleAfterMinutes)) : 15,
  };
}

async function syncCommonCapabilityMirrors(device, settingsOverride = null) {
  const settings = getCommonSettings(device, settingsOverride);
  await setCapabilitySafe(device, 'subject_type', settings.subjectType || '');
  await setCapabilitySafe(device, 'enabled', settings.enabled);
  await setCapabilitySafe(device, 'min_move_distance_m', settings.minMoveDistanceM);
}

async function syncLinkedCapabilityMirrors(device) {
  const settings = getLinkedSettings(device);
  const sourceName = await device.homey.app.resolveSourceDeviceName(settings.sourceDeviceId);
  await setCapabilitySafe(device, 'source_device_name', sourceName || '');
  await setCapabilitySafe(device, 'source_lat_capability', settings.sourceLatCapability || '');
  await setCapabilitySafe(device, 'source_lng_capability', settings.sourceLngCapability || '');
}

function getRuntimeState(device, settingsOverride = null) {
  const store = device.getStore();
  const settings = getCommonSettings(device, settingsOverride);
  const latitude = device.getCapabilityValue('latitude');
  const longitude = device.getCapabilityValue('longitude');
  return {
    id: device.getData().id,
    name: device.getName(),
    subjectType: settings.subjectType,
    enabled: settings.enabled,
    minMoveDistanceM: settings.minMoveDistanceM,
    lastLat: isValidLat(latitude) ? Number(latitude) : null,
    lastLng: isValidLng(longitude) ? Number(longitude) : null,
    lastTimestamp: cleanText(device.getCapabilityValue('last_update') || ''),
    currentZoneId: cleanText(store.currentZoneId || ''),
    currentZoneName: cleanText(device.getCapabilityValue('current_zone') || '') || STATE_ZONE_NOT_DEFINED,
    currentTags: uniqueNormalized(String(device.getCapabilityValue('zone_tags') || '').split(',')),
    previousZoneId: cleanText(store.previousZoneId || ''),
    previousZoneName: cleanText(device.getCapabilityValue('previous_zone') || '') || STATE_ZONE_NOT_DEFINED,
    movementState: cleanText(device.getCapabilityValue('movement_state') || 'unknown'),
    speedKmh: Number.isFinite(Number(device.getCapabilityValue('speed_kmh'))) ? Number(device.getCapabilityValue('speed_kmh')) : 0,
    pendingZoneId: cleanText(store.pendingZoneId || ''),
    pendingZoneName: cleanText(store.pendingZoneName || ''),
    pendingSince: cleanText(store.pendingSince || ''),
  };
}

function computeSpeedKmh(previousState, nextLat, nextLng, nextTimestamp) {
  if (!isValidLat(previousState?.lastLat) || !isValidLng(previousState?.lastLng)) return 0;
  const prevLat = Number(previousState?.lastLat);
  const prevLng = Number(previousState?.lastLng);
  const prevTimestamp = Date.parse(cleanText(previousState?.lastTimestamp || ''));
  const currentTimestamp = Date.parse(cleanText(nextTimestamp || ''));
  if (!Number.isFinite(prevLat) || !Number.isFinite(prevLng)) return 0;
  if (!Number.isFinite(prevTimestamp) || !Number.isFinite(currentTimestamp) || currentTimestamp <= prevTimestamp) return 0;
  const hours = (currentTimestamp - prevTimestamp) / 3600000;
  if (hours <= 0) return 0;
  return haversineMeters(prevLat, prevLng, nextLat, nextLng) / 1000 / hours;
}

function computeDistanceToHomeyText(device, latitude, longitude) {
  try {
    const homeyLat = device.homey?.geolocation?.getLatitude?.();
    const homeyLng = device.homey?.geolocation?.getLongitude?.();
    if (!isValidLat(homeyLat) || !isValidLng(homeyLng)) return '';
    const distanceKm = haversineMeters(homeyLat, homeyLng, latitude, longitude) / 1000;
    if (!Number.isFinite(distanceKm)) return '';
    return `${distanceKm.toFixed(2)} km`;
  } catch (error) {
    return '';
  }
}

function hasStoredCoordinates(state) {
  return isValidLat(state?.lastLat) && isValidLng(state?.lastLng);
}

function clearRuntimeState(device, reason = 'disabled', options = {}) {
  return enqueueSubjectOperation(device, () => clearRuntimeStateNow(device, reason, options));
}

async function clearRuntimeStateNow(device, reason = 'disabled', { preserveCoordinates = true, settingsOverride = null } = {}) {
  cancelTransitionTimer(device);
  const state = getRuntimeState(device);
  await device.setStoreValue('currentZoneId', '');
  await device.setStoreValue('previousZoneId', '');
  await device.setStoreValue('pendingZoneId', '');
  await device.setStoreValue('pendingZoneName', '');
  await device.setStoreValue('pendingSince', '');
  await setCapabilitySafe(device, 'current_zone', STATE_ZONE_NOT_DEFINED);
  await setCapabilitySafe(device, 'previous_zone', STATE_ZONE_NOT_DEFINED);
  await setCapabilitySafe(device, 'zone_tags', '');
  await setCapabilitySafe(device, 'movement_state', 'unknown');
  await setCapabilitySafe(device, 'speed_kmh', 0);
  if (!preserveCoordinates) {
    await setCapabilitySafe(device, 'latitude', null);
    await setCapabilitySafe(device, 'longitude', null);
    await setCapabilitySafe(device, 'distance_to_homey', '');
  } else if (hasStoredCoordinates(state)) {
    await setCapabilitySafe(device, 'distance_to_homey', computeDistanceToHomeyText(device, state.lastLat, state.lastLng));
  }
  await device.setStoreValue('lastSource', cleanText(reason || 'disabled'));
  await syncCommonCapabilityMirrors(device, settingsOverride);
  log(device.homey, 'subject-state', `Runtime state cleared for ${device.getName()} (${reason})`);
}

function buildBaseTokens(device, extra = {}) {
  return {
    subject: device.getName(),
    subject_name: device.getName(),
    subject_type: cleanText(device.getCapabilityValue('subject_type') || ''),
    zone: cleanText(device.getCapabilityValue('current_zone') || '') || STATE_ZONE_NOT_DEFINED,
    previous_zone: cleanText(device.getCapabilityValue('previous_zone') || '') || STATE_ZONE_NOT_DEFINED,
    zone_tags: cleanText(device.getCapabilityValue('zone_tags') || ''),
    movement_state: cleanText(device.getCapabilityValue('movement_state') || 'unknown'),
    speed_kmh: Number(device.getCapabilityValue('speed_kmh') || 0),
    distance_to_homey: cleanText(device.getCapabilityValue('distance_to_homey') || ''),
    latitude: isValidLat(device.getCapabilityValue('latitude')) ? Number(device.getCapabilityValue('latitude')) : null,
    longitude: isValidLng(device.getCapabilityValue('longitude')) ? Number(device.getCapabilityValue('longitude')) : null,
    ...extra,
  };
}

async function persistRuntimeState(device, result, speedKmh, lastTimestamp, distanceToHomey) {
  await device.setStoreValue('currentZoneId', result.nextSubjectState.currentZoneId || '');
  await device.setStoreValue('previousZoneId', result.nextSubjectState.previousZoneId || '');
  await device.setStoreValue('pendingZoneId', result.nextSubjectState.pendingZoneId || '');
  await device.setStoreValue('pendingZoneName', result.nextSubjectState.pendingZoneName || '');
  await device.setStoreValue('pendingSince', result.nextSubjectState.pendingSince || '');

  await setCapabilitySafe(device, 'latitude', result.nextSubjectState.lastLat);
  await setCapabilitySafe(device, 'longitude', result.nextSubjectState.lastLng);
  await setCapabilitySafe(device, 'last_update', lastTimestamp || result.nextSubjectState.lastTimestamp || '');
  await setCapabilitySafe(device, 'current_zone', result.nextSubjectState.currentZoneName || STATE_ZONE_NOT_DEFINED);
  await setCapabilitySafe(device, 'previous_zone', result.nextSubjectState.previousZoneName || STATE_ZONE_NOT_DEFINED);
  await setCapabilitySafe(device, 'zone_tags', (result.nextSubjectState.currentTags || []).join(','));
  await setCapabilitySafe(device, 'movement_state', result.nextSubjectState.movementState || 'unknown');
  await setCapabilitySafe(device, 'speed_kmh', speedKmh);
  await setCapabilitySafe(device, 'distance_to_homey', cleanText(distanceToHomey || ''));
}

async function triggerPositionLifecycle(device, previousState, result, positionChanged) {
  const app = device.homey.app;
  const currentZoneName = cleanText(result.nextSubjectState.currentZoneName || '') || STATE_ZONE_NOT_DEFINED;
  const previousZoneName = cleanText(previousState.currentZoneName || '') || STATE_ZONE_NOT_DEFINED;
  const baseTokens = buildBaseTokens(device);

  if (positionChanged) {
    await app.triggerDeviceAndGlobalEvent('position_changed', device, baseTokens);
  }

  await app.triggerDeviceAndGlobalEvent('recalculated', device, baseTokens);

  if (normalizeKey(currentZoneName) !== normalizeKey(previousZoneName)) {
    await app.triggerDeviceAndGlobalEvent('zone_changed', device, baseTokens);

    if (isFoundZoneName(previousZoneName)) {
      await app.triggerDeviceAndGlobalEvent('transition', device, {
        ...baseTokens,
        transition: 'left',
        zone: previousZoneName,
        zone_tags: uniqueNormalized(previousState.currentTags || []).join(','),
      });
    }
    if (isFoundZoneName(currentZoneName)) {
      await app.triggerDeviceAndGlobalEvent('transition', device, {
        ...baseTokens,
        transition: 'entered',
        zone: currentZoneName,
        zone_tags: (result.nextSubjectState.currentTags || []).join(','),
      });
    }
  }
}

function updatePositionAndEvaluate(device, lat, lng, source = 'manual', meta = {}) {
  return enqueueSubjectOperation(device, () => updatePositionAndEvaluateNow(device, lat, lng, source, meta));
}

async function updatePositionAndEvaluateNow(device, lat, lng, source = 'manual', meta = {}) {
  if (!isValidLat(lat) || !isValidLng(lng)) {
    throw new Error(tError(device.homey, 'latLngMustBeNumbers', 'Latitude and longitude must be valid numbers'));
  }
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error(tError(device.homey, 'latLngMustBeNumbers', 'Latitude and longitude must be valid numbers'));
  }

  const previousState = getRuntimeState(device, meta.settingsOverride);
  if (!previousState.enabled || (!meta.settingsOverride && device.getCapabilityValue('enabled') === false)) {
    throw new Error(tError(device.homey, 'subjectDisabled', 'Subject is disabled'));
  }

  const minMoveDistanceM = previousState.minMoveDistanceM;
  const moveDistance = hasStoredCoordinates(previousState) ? haversineMeters(previousState.lastLat, previousState.lastLng, latitude, longitude) : Infinity;
  const withinDeadzone = Number.isFinite(moveDistance) && moveDistance < minMoveDistanceM;
  const effectiveLatitude = withinDeadzone && hasStoredCoordinates(previousState) ? previousState.lastLat : latitude;
  const effectiveLongitude = withinDeadzone && hasStoredCoordinates(previousState) ? previousState.lastLng : longitude;


  const result = determineBestZone({
    lat: effectiveLatitude,
    long: effectiveLongitude,
    zones: device.homey.app.getZones(),
    subjectState: previousState,
    useDelays: true,
  });

  const zoneChangeCandidate = normalizeKey(previousState.currentZoneName) !== normalizeKey(result.nextSubjectState.currentZoneName || previousState.currentZoneName);
  const forceVerboseSources = new Set(['device:init', 'settings:changed', 'settings:common_changed', 'settings:min_move_distance', 'settings:enabled']);
  const shouldEmitHeavyEvaluation = forceVerboseSources.has(cleanText(source))
    || zoneChangeCandidate
    || withinDeadzone === false
    || cleanText(previousState.pendingZoneName || '') !== cleanText(result.nextSubjectState.pendingZoneName || '')
    || cleanText(previousState.movementState || '') !== cleanText(result.nextSubjectState.movementState || '');

  if (shouldEmitHeavyEvaluation) {
    logHeavy(device.homey, 'zone-eval', 'Evaluating position', {
      subject: device.getName(),
      source,
      latitude,
      longitude,
      previousLatitude: previousState.lastLat,
      previousLongitude: previousState.lastLng,
      moveDistanceM: Number.isFinite(moveDistance) ? Number(moveDistance.toFixed(2)) : null,
      minMoveDistanceM,
      withinDeadzone,
      effectiveLatitude,
      effectiveLongitude,
    });
  }

  result.nextSubjectState.lastLat = effectiveLatitude;
  result.nextSubjectState.lastLng = effectiveLongitude;
  const lastTimestamp = meta.recalculateOnly
    ? previousState.lastTimestamp
    : cleanText(meta.sourceTimestamp || result.nextSubjectState.lastTimestamp || new Date().toISOString());
  result.nextSubjectState.lastTimestamp = lastTimestamp;
  const speedKmh = meta.recalculateOnly ? previousState.speedKmh : computeSpeedKmh(previousState, effectiveLatitude, effectiveLongitude, lastTimestamp);
  if (meta.recalculateOnly) {
    result.movementState = previousState.movementState;
    result.nextSubjectState.movementState = previousState.movementState;
  }
  const distanceToHomey = computeDistanceToHomeyText(device, effectiveLatitude, effectiveLongitude);
  const positionChanged = !hasStoredCoordinates(previousState)
    || Math.abs(previousState.lastLat - effectiveLatitude) > 1e-9
    || Math.abs(previousState.lastLng - effectiveLongitude) > 1e-9;

  await persistRuntimeState(device, result, speedKmh, lastTimestamp, distanceToHomey);
  if (shouldEmitHeavyEvaluation) {
    logHeavy(device.homey, 'zone-eval', 'Evaluation result', {
      subject: device.getName(),
      source,
      zoneBefore: previousState.currentZoneName,
      zoneAfter: result.nextSubjectState.currentZoneName,
      lastExitedZone: result.nextSubjectState.previousZoneName,
      pendingZone: result.nextSubjectState.pendingZoneName,
      movementState: result.nextSubjectState.movementState,
      speedKmh,
      lastTimestamp,
      currentTags: result.nextSubjectState.currentTags,
    });
  }
  await syncCommonCapabilityMirrors(device, meta.settingsOverride);
  await device.setStoreValue('lastSource', cleanText(source || 'manual'));

  if (normalizeKey(previousState.currentZoneName) !== normalizeKey(result.nextSubjectState.currentZoneName)) {
    log(device.homey, 'zone-eval', `Zone changed for ${device.getName()} (${previousState.currentZoneName || 'none'} -> ${result.nextSubjectState.currentZoneName || 'none'}, ${source})`);
  } else if (
    withinDeadzone
    && Number.isFinite(moveDistance)
    && moveDistance > 0
    && source !== 'device:init'
    && source !== 'source:watchdog'
    && shouldThrottle(device.homey, `deadzone:${device.getData().id}:${source}`, 15 * 60 * 1000)
  ) {
    logHeavy(device.homey, 'zone-eval', 'Movement kept inside deadzone', {
      subject: device.getName(),
      moveDistanceM: Number(moveDistance.toFixed(2)),
      minMoveDistanceM,
      source,
      effectiveLatitude,
      effectiveLongitude,
    });
  }

  scheduleTransitionTimer(device, result);
  await triggerPositionLifecycle(device, previousState, result, positionChanged);
  return {
    result,
    tokens: buildBaseTokens(device),
  };
}

function evaluateStoredPosition(device, source = 'manual:evaluate') {
  return enqueueSubjectOperation(device, () => evaluateStoredPositionNow(device, source));
}

async function evaluateStoredPositionNow(device, source = 'manual:evaluate', settingsOverride = null) {
  const latitude = device.getCapabilityValue('latitude');
  const longitude = device.getCapabilityValue('longitude');
  if (!isValidLat(latitude) || !isValidLng(longitude)) {
    throw new Error(tError(device.homey, 'noStoredCoordinates', 'No stored coordinates available'));
  }
  return updatePositionAndEvaluateNow(device, latitude, longitude, source, { sourceTimestamp: cleanText(device.getCapabilityValue('last_update') || ''), recalculateOnly: true, settingsOverride });
}

function setEnabled(device, enabled) {
  return enqueueSubjectOperation(device, () => setEnabledNow(device, enabled));
}

async function setEnabledNow(device, enabled) {
  const value = bool(enabled, true);
  await device.setSettings({ enabled: value });
  await setCapabilitySafe(device, 'enabled', value);
  if (!value) {
    await clearRuntimeStateNow(device, 'subject_disabled', { preserveCoordinates: true });
  } else {
    await syncCommonCapabilityMirrors(device);
    try {
      await evaluateStoredPositionNow(device, 'settings:enabled');
    } catch (error) {
      // ignore missing stored coordinates when enabling
    }
  }
  return value;
}

function setMinMoveDistance(device, distance) {
  return enqueueSubjectOperation(device, () => setMinMoveDistanceNow(device, distance));
}

async function setMinMoveDistanceNow(device, distance) {
  const value = Number.isFinite(Number(distance)) ? Math.max(0, Number(distance)) : 0;
  await device.setSettings({ minMoveDistanceM: value });
  await setCapabilitySafe(device, 'min_move_distance_m', value);
  await syncCommonCapabilityMirrors(device);
  try {
    await evaluateStoredPositionNow(device, 'settings:min_move_distance');
  } catch (error) {
    // ignore missing stored coordinates
  }
  return value;
}

function applyCommonSettings(device, newSettings) {
  return enqueueSubjectOperation(device, async () => {
    await syncCommonCapabilityMirrors(device, newSettings);
    if (!getCommonSettings(device, newSettings).enabled) {
      await clearRuntimeStateNow(device, 'settings:disabled', { settingsOverride: newSettings });
      return;
    }
    if (hasStoredCoordinates(getRuntimeState(device, newSettings))) {
      await evaluateStoredPositionNow(device, 'settings:common_changed', newSettings);
    }
  });
}

function initializeSubjectRuntime(device) {
  const runtime = getDeviceRuntime(device);
  runtime.disposed = false;
  return enqueueSubjectOperation(device, async () => {
    if (!getCommonSettings(device).enabled) {
      await clearRuntimeStateNow(device, 'device:init:disabled');
    } else if (cleanText(device.getStoreValue('pendingSince')) && hasStoredCoordinates(getRuntimeState(device))) {
      await evaluateStoredPositionNow(device, 'device:init');
    }
  });
}

async function setLinkedDiagnostic(device, { problem = false, status = 'ok', stale = false, sourceDeviceName = '', sourceLastUpdate = '', latCapability = '', lngCapability = '', warning = '' } = {}) {
  await setCapabilitySafe(device, 'source_problem', Boolean(problem));
  await setCapabilitySafe(device, 'source_status', cleanText(status || 'ok'));
  await setCapabilitySafe(device, 'source_stale', Boolean(stale));
  await setCapabilitySafe(device, 'source_device_name', cleanText(sourceDeviceName || ''));
  await setCapabilitySafe(device, 'source_last_update', cleanText(sourceLastUpdate || ''));
  await setCapabilitySafe(device, 'source_lat_capability', cleanText(latCapability || ''));
  await setCapabilitySafe(device, 'source_lng_capability', cleanText(lngCapability || ''));
  await device.setStoreValue('sourceWarning', problem && warning ? cleanText(warning) : '');
  if (device.homey.app?.applyStoredDeviceWarnings) await device.homey.app.applyStoredDeviceWarnings(device);
}

module.exports = {
  COMMON_CAPABILITIES,
  LINKED_CAPABILITIES,
  ensureCapabilities,
  syncCommonCapabilityMirrors,
  syncLinkedCapabilityMirrors,
  getCommonSettings,
  getLinkedSettings,
  getRuntimeState,
  buildBaseTokens,
  updatePositionAndEvaluate,
  evaluateStoredPosition,
  setEnabled,
  setMinMoveDistance,
  setLinkedDiagnostic,
  clearRuntimeState,
  applyCommonSettings,
  initializeSubjectRuntime,
  disposeSubjectRuntime,
};
