'use strict';

const { cleanText, normalizeKey, uniqueNormalized } = require('./utils');
const {
  isValidLat,
  isValidLng,
  haversineMeters,
  pointInPolygon,
  circleAreaM2,
  polygonAreaM2,
  distanceToZoneBoundaryM,
} = require('./geo');

const STATE_ZONE_NOT_DEFINED = 'not_defined';
const STATE_ZONE_UNKNOWN = 'unknown';
const STATE_ZONE_ERROR = 'error';

function normalizeZone(zone) {
  const type = zone?.type === 'polygon' ? 'polygon' : 'circle';
  const radius = Number(zone?.radius || 0);
  const paths = Array.isArray(zone?.paths) ? zone.paths.map(point => ({ lat: Number(point.lat), lng: Number(point.lng) })) : [];
  const computedAreaM2 = type === 'circle' ? circleAreaM2(radius) : polygonAreaM2(paths);
  return {
    id: cleanText(zone?.id || zone?.name),
    name: cleanText(zone?.name),
    type,
    active: zone?.active !== false,
    color: zone?.color || '#3388ff',
    priority: Number.isFinite(Number(zone?.priority)) ? Number(zone.priority) : 0,
    tags: uniqueNormalized(zone?.tags || zone?.categories || []),
    center: zone?.center ? { lat: Number(zone.center.lat), lng: Number(zone.center.lng) } : null,
    radius,
    hysteresis: Math.max(0, Number(zone?.hysteresis || 0)),
    paths,
    areaM2: Number.isFinite(Number(zone?.areaM2)) && Number(zone.areaM2) > 0 ? Number(zone.areaM2) : computedAreaM2,
    options: {
      entryDelayS: Number.isFinite(Number(zone?.options?.entryDelayS)) ? Math.max(0, Number(zone.options.entryDelayS)) : 0,
      exitDelayS: Number.isFinite(Number(zone?.options?.exitDelayS)) ? Math.max(0, Number(zone.options.exitDelayS)) : 0,
      appliesWithoutSubject: zone?.options?.appliesWithoutSubject !== false,
      subjectFilter: {
        mode: ['all', 'include', 'exclude'].includes(cleanText(zone?.options?.subjectFilter?.mode)) ? cleanText(zone.options.subjectFilter.mode) : 'all',
        subjects: uniqueNormalized(zone?.options?.subjectFilter?.subjects || []),
      },
      subjectTypeFilter: {
        mode: ['all', 'include', 'exclude'].includes(cleanText(zone?.options?.subjectTypeFilter?.mode)) ? cleanText(zone.options.subjectTypeFilter.mode) : 'all',
        subjectTypes: uniqueNormalized(zone?.options?.subjectTypeFilter?.subjectTypes || []),
      },
    },
  };
}

function evaluateCircle(zone, lat, lng, previousZoneId) {
  const distance = haversineMeters(lat, lng, zone.center.lat, zone.center.lng);
  const isPreviousZone = cleanText(previousZoneId) === zone.id;
  const threshold = zone.radius + (isPreviousZone ? zone.hysteresis : 0);
  const inside = distance <= threshold;
  return {
    matched: inside,
    detail: {
      kind: 'circle',
      distance,
      radius: zone.radius,
      hysteresis: zone.hysteresis,
      threshold,
      previousZone: isPreviousZone,
      inside,
      distanceToBoundaryM: Math.abs(distance - zone.radius),
    },
  };
}

function evaluatePolygon(zone, lat, lng) {
  const inside = pointInPolygon(lat, lng, zone.paths);
  return {
    matched: inside,
    detail: {
      kind: 'polygon',
      inside,
      distanceToBoundaryM: distanceToZoneBoundaryM(lat, lng, zone),
    },
  };
}

function checkSpecificFilter(filter, candidate) {
  const mode = cleanText(filter?.mode || 'all');
  const list = uniqueNormalized(filter?.subjects || filter?.subjectTypes || []);
  if (mode === 'all') return true;
  const key = normalizeKey(candidate);
  const has = list.some(item => normalizeKey(item) === key);
  return mode === 'include' ? has : !has;
}

function zoneAllowsSubject(zone, subjectState, hasSubject) {
  if (!hasSubject) return zone.options.appliesWithoutSubject !== false;

  const subjectId = cleanText(subjectState?.id || '');
  const subjectType = cleanText(subjectState?.subjectType || '');

  const subjectMode = cleanText(zone.options.subjectFilter.mode || 'all');
  if (subjectMode !== 'all') {
    const allowed = checkSpecificFilter(zone.options.subjectFilter, subjectId);
    if (!allowed) return false;
    const listed = zone.options.subjectFilter.subjects.some(item => normalizeKey(item) === normalizeKey(subjectId));
    if (listed) return subjectMode === 'include';
  }

  const typeMode = cleanText(zone.options.subjectTypeFilter.mode || 'all');
  if (typeMode === 'all') return true;
  if (!subjectType) return typeMode === 'exclude';
  return checkSpecificFilter({ mode: typeMode, subjectTypes: zone.options.subjectTypeFilter.subjectTypes }, subjectType);
}

function computeMovementState(subjectState, latitude, longitude) {
  const previousLat = Number(subjectState?.lastLat);
  const previousLng = Number(subjectState?.lastLng);
  if (!Number.isFinite(previousLat) || !Number.isFinite(previousLng)) return { state: 'unknown', distanceSinceLastM: null };
  const distanceSinceLastM = haversineMeters(previousLat, previousLng, latitude, longitude);
  const threshold = Number(subjectState?.minMoveDistanceM || 0);
  return {
    state: distanceSinceLastM > threshold ? 'moving' : 'stable',
    distanceSinceLastM,
  };
}

function applyTransitionDelays(previousZone, candidateZone, subjectState, nowIso) {
  const previousZoneId = cleanText(subjectState?.currentZoneId || '');
  const pendingZoneId = cleanText(subjectState?.pendingZoneId || '');
  const pendingZoneName = cleanText(subjectState?.pendingZoneName || '');
  const candidateZoneId = cleanText(candidateZone?.id || '');
  const candidateZoneName = cleanText(candidateZone?.name || '');
  const isExitTransition = !candidateZone;
  const pendingExitKey = '__exit__';

  if (previousZoneId === candidateZoneId) {
    return {
      finalZone: candidateZone,
      pendingZoneId: '',
      pendingZoneName: '',
      pendingSince: '',
      waiting: false,
    };
  }

  const delayS = candidateZone
    ? Number(candidateZone.options?.entryDelayS || 0)
    : Number(previousZone?.options?.exitDelayS || 0);

  if (delayS <= 0) {
    return {
      finalZone: candidateZone,
      pendingZoneId: '',
      pendingZoneName: '',
      pendingSince: '',
      waiting: false,
    };
  }

  const pendingTargetId = isExitTransition ? pendingExitKey : candidateZoneId;
  const pendingTargetName = isExitTransition ? pendingExitKey : candidateZoneName;
  let pendingSince = cleanText(subjectState?.pendingSince || '');
  const samePendingTarget = pendingZoneId === pendingTargetId && pendingZoneName === pendingTargetName;

  if (!samePendingTarget || !pendingSince) {
    pendingSince = nowIso;
  }

  const pendingMs = Date.parse(pendingSince);
  const nowMs = Date.parse(nowIso);
  const elapsedS = Number.isFinite(pendingMs) ? Math.max(0, (nowMs - pendingMs) / 1000) : 0;

  if (elapsedS >= delayS) {
    return {
      finalZone: candidateZone,
      pendingZoneId: '',
      pendingZoneName: '',
      pendingSince: '',
      waiting: false,
    };
  }

  return {
    finalZone: previousZone || null,
    pendingZoneId: pendingTargetId,
    pendingZoneName: pendingTargetName,
    pendingSince,
    waiting: true,
  };
}


function isSpecialZoneName(value) {
  const key = normalizeKey(value);
  return !key || [normalizeKey(STATE_ZONE_NOT_DEFINED), normalizeKey(STATE_ZONE_UNKNOWN), normalizeKey(STATE_ZONE_ERROR)].includes(key);
}

function isFoundZoneName(value) {
  return !isSpecialZoneName(value);
}

function computePreviousZoneState(subjectState, currentZone) {
  const oldCurrentZoneId = cleanText(subjectState?.currentZoneId || '');
  const oldCurrentZoneName = cleanText(subjectState?.currentZoneName || '');
  const oldPreviousZoneId = cleanText(subjectState?.previousZoneId || '');
  const oldPreviousZoneName = cleanText(subjectState?.previousZoneName || '') || STATE_ZONE_UNKNOWN;

  const nextCurrentZoneName = cleanText(currentZone?.name || '');

  let nextPreviousZoneId = oldPreviousZoneId;
  let nextPreviousZoneName = oldPreviousZoneName;

  if (isFoundZoneName(nextCurrentZoneName)) {
    if (isFoundZoneName(oldCurrentZoneName) && normalizeKey(oldCurrentZoneName) !== normalizeKey(nextCurrentZoneName)) {
      nextPreviousZoneId = oldCurrentZoneId;
      nextPreviousZoneName = oldCurrentZoneName;
    } else if (isFoundZoneName(oldPreviousZoneName) && normalizeKey(oldPreviousZoneName) !== normalizeKey(nextCurrentZoneName)) {
      nextPreviousZoneId = oldPreviousZoneId;
      nextPreviousZoneName = oldPreviousZoneName;
    } else {
      nextPreviousZoneId = '';
      nextPreviousZoneName = STATE_ZONE_UNKNOWN;
    }
  } else {
    if (isFoundZoneName(oldCurrentZoneName)) {
      nextPreviousZoneId = oldCurrentZoneId;
      nextPreviousZoneName = oldCurrentZoneName;
    } else if (isFoundZoneName(oldPreviousZoneName)) {
      nextPreviousZoneId = oldPreviousZoneId;
      nextPreviousZoneName = oldPreviousZoneName;
    } else {
      nextPreviousZoneId = '';
      nextPreviousZoneName = STATE_ZONE_UNKNOWN;
    }
  }

  return {
    oldCurrentZoneId,
    oldCurrentZoneName: oldCurrentZoneName || STATE_ZONE_NOT_DEFINED,
    oldPreviousZoneId,
    oldPreviousZoneName,
    nextPreviousZoneId,
    nextPreviousZoneName,
  };
}


function determineBestZone({ lat, long, zones, subjectState = null, useDelays = true }) {
  const latitude = Number(lat);
  const longitude = Number(long);
  if (!isValidLat(latitude) || !isValidLng(longitude)) throw new Error('Latitude/longitude must be valid numbers');

  const normalizedZones = (Array.isArray(zones) ? zones : []).map(normalizeZone);
  const logs = [];
  const candidates = [];
  const previousZoneId = cleanText(subjectState?.currentZoneId || '');
  const previousZone = normalizedZones.find(zone => zone.id === previousZoneId) || null;
  const hasSubject = Boolean(subjectState?.id);

  for (const zone of normalizedZones) {
    if (!zone.active) continue;
    if (!zoneAllowsSubject(zone, subjectState, hasSubject)) {
      logs.push(`${zone.name}: filtered`);
      continue;
    }

    let evaluation;
    if (zone.type === 'circle') evaluation = evaluateCircle(zone, latitude, longitude, previousZoneId);
    else evaluation = evaluatePolygon(zone, latitude, longitude);

    if (!evaluation.matched) continue;
    candidates.push({ zone, areaM2: zone.areaM2, detail: evaluation.detail });
  }

  candidates.sort((a, b) => {
    if (b.zone.priority !== a.zone.priority) return b.zone.priority - a.zone.priority;
    if (a.areaM2 !== b.areaM2) return a.areaM2 - b.areaM2;
    return a.zone.name.localeCompare(b.zone.name);
  });

  const best = candidates[0] || null;
  const rawCandidate = best?.zone || null;
  const nowIso = new Date().toISOString();
  const transition = useDelays ? applyTransitionDelays(previousZone, rawCandidate, subjectState, nowIso) : {
    finalZone: rawCandidate,
    pendingZoneId: '',
    pendingZoneName: '',
    pendingSince: '',
    waiting: false,
  };

  const currentZone = transition.finalZone;
  const movement = computeMovementState(subjectState, latitude, longitude);
  const previousState = computePreviousZoneState(subjectState, currentZone);

  return {
    found: Boolean(currentZone),
    zoneId: currentZone?.id || '',
    zone: currentZone?.name || STATE_ZONE_NOT_DEFINED,
    tags: currentZone?.tags?.join(',') || '',
    tagsArray: currentZone?.tags || [],
    previousZoneId: previousState.nextPreviousZoneId,
    previousZone: previousState.nextPreviousZoneName,
    previousTags: uniqueNormalized(subjectState?.currentTags || []),
    oldCurrentZoneId: previousState.oldCurrentZoneId,
    oldCurrentZone: previousState.oldCurrentZoneName,
    oldCurrentTags: uniqueNormalized(subjectState?.currentTags || []),
    oldPreviousZoneId: previousState.oldPreviousZoneId,
    oldPreviousZone: previousState.oldPreviousZoneName,
    best,
    candidates,
    logs,
    waiting: transition.waiting,
    distanceSinceLastM: movement.distanceSinceLastM,
    movementState: movement.state,
    nextSubjectState: {
      currentZoneId: currentZone?.id || '',
      currentZoneName: currentZone?.name || '',
      currentTags: currentZone?.tags || [],
      previousZoneId: previousState.nextPreviousZoneId,
      previousZoneName: previousState.nextPreviousZoneName,
      lastLat: latitude,
      lastLng: longitude,
      lastTimestamp: nowIso,
      movementState: movement.state,
      pendingZoneId: transition.pendingZoneId,
      pendingZoneName: transition.pendingZoneName,
      pendingSince: transition.pendingSince,
    },
  };
}

module.exports = {
  STATE_ZONE_NOT_DEFINED,
  STATE_ZONE_UNKNOWN,
  STATE_ZONE_ERROR,
  normalizeZone,
  determineBestZone,
  zoneAllowsSubject,
};
