'use strict';

const { cleanText, uniqueCaseSensitive } = require('./utils');
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

function normalizeStringArray(values) {
  return uniqueCaseSensitive(Array.isArray(values) ? values : []).map(cleanText).filter(Boolean);
}

function equalStringArrays(a, b) {
  const left = [...normalizeStringArray(a)].sort((x, y) => x.localeCompare(y));
  const right = [...normalizeStringArray(b)].sort((x, y) => x.localeCompare(y));
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function normalizeZone(zone) {
  const type = zone?.type === 'polygon' ? 'polygon' : 'circle';
  const radius = Number(zone?.radius || 0);
  const paths = Array.isArray(zone?.paths) ? zone.paths.map(point => ({ lat: Number(point.lat), lng: Number(point.lng) })) : [];
  const computedAreaM2 = type === 'circle' ? circleAreaM2(radius) : polygonAreaM2(paths);

  return {
    name: cleanText(zone?.name),
    id: cleanText(zone?.name),
    type,
    active: zone?.active !== false,
    color: zone?.color || '#3388ff',
    priority: Number.isFinite(Number(zone?.priority)) ? Number(zone.priority) : 0,
    groups: normalizeStringArray(zone?.groups || []),
    categories: normalizeStringArray(zone?.categories || []),
    center: zone?.center ? { lat: Number(zone.center.lat), lng: Number(zone.center.lng) } : null,
    radius,
    hysteresis: Math.max(0, Number(zone?.hysteresis || 0)),
    paths,
    areaM2: Number.isFinite(Number(zone?.areaM2)) && Number(zone.areaM2) > 0 ? Number(zone.areaM2) : computedAreaM2,
  };
}

function evaluateCircle(zone, lat, lng, previousZoneName) {
  const distance = haversineMeters(lat, lng, zone.center.lat, zone.center.lng);
  const isPreviousZone = cleanText(previousZoneName) === zone.name;
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

function determineBestZone({ lat, long, zones, subjectState }) {
  const latitude = Number(lat);
  const longitude = Number(long);
  const normalizedZones = (Array.isArray(zones) ? zones : []).map(normalizeZone);
  const previousZoneName = cleanText(subjectState?.currentZone) || STATE_ZONE_UNKNOWN;
  const previousGroups = normalizeStringArray(subjectState?.currentGroups);
  const previousCategories = normalizeStringArray(subjectState?.currentCategories);
  const previousLat = Number(subjectState?.lastLat);
  const previousLng = Number(subjectState?.lastLng);
  const previousTimestamp = subjectState?.lastTimestamp || subjectState?.updatedAt || '';
  const now = new Date().toISOString();
  const logs = [];
  const candidates = [];

  if (!isValidLat(latitude) || !isValidLng(longitude)) {
    throw new Error('Latitude/longitude must be valid numbers');
  }

  logs.push(`Evaluate lat=${latitude}, long=${longitude}, prevZone=${previousZoneName}`);

  for (const zone of normalizedZones) {
    if (!zone.active) {
      logs.push(`Skip ${zone.name}: inactive`);
      continue;
    }

    let evaluation = null;
    if (zone.type === 'circle' && zone.center && Number.isFinite(zone.radius) && zone.radius > 0) {
      evaluation = evaluateCircle(zone, latitude, longitude, previousZoneName);
    } else if (zone.type === 'polygon' && zone.paths.length >= 3) {
      evaluation = evaluatePolygon(zone, latitude, longitude);
    } else {
      logs.push(`Skip ${zone.name}: invalid definition`);
      continue;
    }

    logs.push(`${zone.name}: matched=${evaluation.matched} type=${zone.type} priority=${zone.priority} areaM2=${zone.areaM2}`);
    if (!evaluation.matched) continue;

    candidates.push({ zone, areaM2: zone.areaM2, detail: evaluation.detail });
  }

  candidates.sort((a, b) => {
    if (b.zone.priority !== a.zone.priority) return b.zone.priority - a.zone.priority;
    if (a.areaM2 !== b.areaM2) return a.areaM2 - b.areaM2;
    return a.zone.name.localeCompare(b.zone.name);
  });

  const best = candidates[0] || null;
  const currentZone = best?.zone.name || STATE_ZONE_NOT_DEFINED;
  const currentGroups = normalizeStringArray(best?.zone.groups);
  const currentCategories = normalizeStringArray(best?.zone.categories);

  const previousTsMs = Date.parse(previousTimestamp);
  const nowMs = Date.parse(now);
  const distanceSinceLastM = Number.isFinite(previousLat) && Number.isFinite(previousLng)
    ? haversineMeters(previousLat, previousLng, latitude, longitude)
    : null;
  const timeDeltaS = Number.isFinite(previousTsMs) ? Math.max(0, (nowMs - previousTsMs) / 1000) : null;
  const speedKmh = (distanceSinceLastM !== null && timeDeltaS !== null && timeDeltaS > 0)
    ? (distanceSinceLastM / timeDeltaS) * 3.6
    : null;

  return {
    found: Boolean(best),
    zone: currentZone,
    groups: currentGroups.length ? currentGroups.join(', ') : STATE_ZONE_NOT_DEFINED,
    categories: currentCategories.length ? currentCategories.join(', ') : STATE_ZONE_NOT_DEFINED,
    previousZone: previousZoneName,
    previousGroups: previousGroups.length ? previousGroups.join(', ') : STATE_ZONE_NOT_DEFINED,
    previousCategories: previousCategories.length ? previousCategories.join(', ') : STATE_ZONE_NOT_DEFINED,
    previousGroupsArray: previousGroups,
    previousCategoriesArray: previousCategories,
    type: best?.zone.type || '',
    zoneChanged: previousZoneName !== currentZone,
    groupChanged: !equalStringArrays(previousGroups, currentGroups),
    categoryChanged: !equalStringArrays(previousCategories, currentCategories),
    best,
    candidates,
    logs,
    distanceSinceLastM,
    timeDeltaS,
    speedKmh,
    nextSubjectState: {
      currentZone,
      currentGroups,
      currentCategories,
      lastLat: latitude,
      lastLng: longitude,
      lastTimestamp: now,
    },
  };
}

function getStateValues(type, subjectState) {
  if (type === 'zone') return [cleanText(subjectState?.currentZone) || STATE_ZONE_UNKNOWN];
  if (type === 'group') return normalizeStringArray(subjectState?.currentGroups);
  if (type === 'category') return normalizeStringArray(subjectState?.currentCategories);
  return [];
}

function determineChangedEntries(type, result) {
  const current = type === 'zone' ? [result.zone || STATE_ZONE_NOT_DEFINED] : normalizeStringArray(type === 'group' ? result.best?.zone.groups : result.best?.zone.categories);
  const previous = type === 'zone' ? [result.previousZone || STATE_ZONE_UNKNOWN] : normalizeStringArray(type === 'group' ? result.previousGroupsArray : result.previousCategoriesArray);

  if (type === 'zone') {
    if (current[0] === previous[0]) return { changed: false, entered: [], left: [] };
    return { changed: true, entered: current, left: previous };
  }

  const currentSet = new Set(current);
  const previousSet = new Set(previous);
  const entered = current.filter(value => !previousSet.has(value));
  const left = previous.filter(value => !currentSet.has(value));
  return { changed: entered.length > 0 || left.length > 0, entered, left };
}

module.exports = {
  STATE_ZONE_NOT_DEFINED,
  STATE_ZONE_UNKNOWN,
  STATE_ZONE_ERROR,
  normalizeZone,
  normalizeStringArray,
  determineBestZone,
  determineChangedEntries,
  getStateValues,
};
