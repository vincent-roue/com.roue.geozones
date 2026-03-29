'use strict';

const {
  getConfig,
  setConfig,
  updateConfig,
  deleteSubject,
  resetSubjectState,
  purgeSubjects,
  getHistory,
  restoreHistoryEntry,
  deleteHistoryEntry,
  getDerivedSubjectTypes,
  getDerivedTags,
  sanitizeSubject,
} = require('./lib/store');
const { determineBestZone } = require('./lib/zone-engine');
const { cleanText, clone, makeIdFromName, normalizeKey } = require('./lib/utils');
const { listLocationDevices } = require('./lib/sources');
const fs = require('fs').promises;
const path = require('path');


function makeUniqueSubjectId(baseId, existingIds) {
  const cleanBase = cleanText(baseId) || 'subject';
  const ids = Array.isArray(existingIds) ? existingIds : Array.from(existingIds || []);
  const used = new Set(ids.map(normalizeKey));
  if (!used.has(normalizeKey(cleanBase))) return cleanBase;
  let index = 2;
  while (used.has(normalizeKey(`${cleanBase}_${index}`))) index += 1;
  return `${cleanBase}_${index}`;
}

function mergeSubjectsWithRename(current = {}, incoming = {}, references = {}) {
  const merged = clone(current || {});
  const idMap = new Map();
  const existingIds = new Set(Object.keys(merged));

  for (const [rawId, rawSubject] of Object.entries(incoming || {})) {
    const subject = sanitizeSubject(rawSubject, rawId);
    const desiredId = cleanText(subject.id || rawId);
    const finalId = makeUniqueSubjectId(desiredId, existingIds);
    existingIds.add(finalId);
    idMap.set(desiredId, finalId);
    merged[finalId] = sanitizeSubject({ ...subject, id: finalId }, finalId);
  }

  if (Array.isArray(references.sources)) {
    references.sources = references.sources.map(source => {
      const nextId = idMap.get(cleanText(source.subjectId));
      return nextId ? { ...source, subjectId: nextId } : source;
    });
  }

  if (Array.isArray(references.zones)) {
    references.zones = references.zones.map(zone => {
      const subjects = Array.isArray(zone?.options?.subjectFilter?.subjects) ? zone.options.subjectFilter.subjects : [];
      if (!subjects.length) return zone;
      return {
        ...zone,
        options: {
          ...(zone.options || {}),
          subjectFilter: {
            ...(zone.options?.subjectFilter || {}),
            subjects: subjects.map(subjectId => idMap.get(cleanText(subjectId)) || subjectId),
          },
        },
      };
    });
  }

  return { subjects: merged, references, idMap };
}

async function cleanupPreviousExports() {
  const dir = '/userdata';
  const files = await fs.readdir(dir).catch(() => []);
  await Promise.all(
    (files || [])
      .filter(filename => /^geozones-export-.*\.json$/i.test(filename))
      .map(filename => fs.unlink(path.join(dir, filename)).catch(() => null))
  );
}

module.exports = {
  async getConfig({ homey }) {
    await homey.app.syncSourcesFromDevices('api:getConfig');
    const config = getConfig(homey);
    return {
      ...config,
      derivedSubjectTypes: getDerivedSubjectTypes(config),
      derivedTags: getDerivedTags(config),
    };
  },

  async setConfig({ homey, body }) {
    const result = await setConfig(homey, body);
    await homey.app.triggerConfigChangedEvent('config_set');
    return result;
  },

  async mergeConfig({ homey, body }) {
    const current = getConfig(homey);
    const incoming = clone(body || {});
    const nextSources = Array.isArray(incoming.sources) ? incoming.sources : current.sources;
    const nextZones = Array.isArray(incoming.zones) ? incoming.zones : current.zones;
    const subjectMerge = incoming.subjects && typeof incoming.subjects === 'object'
      ? mergeSubjectsWithRename(current.subjects, incoming.subjects, { sources: clone(nextSources), zones: clone(nextZones) })
      : { subjects: current.subjects, references: { sources: nextSources, zones: nextZones } };

    const merged = {
      ...current,
      ...incoming,
      zones: subjectMerge.references.zones,
      subjects: subjectMerge.subjects,
      sources: subjectMerge.references.sources,
      general: incoming.general && typeof incoming.general === 'object' ? { ...current.general, ...incoming.general } : current.general,
      ui: incoming.ui && typeof incoming.ui === 'object' ? { ...current.ui, ...incoming.ui } : current.ui,
    };
    const result = await setConfig(homey, merged);
    await homey.app.triggerConfigChangedEvent('config_merged');
    return result;
  },

  async evaluateCoordinates({ homey, body }) {
    return determineBestZone({ lat: Number(body.lat), long: Number(body.long), zones: getConfig(homey).zones, subjectState: null, useDelays: false });
  },

  async updateSubjectPosition({ homey, body }) {
    return homey.app.updateAndEvaluateSubjectPosition(cleanText(body.subjectId), Number(body.lat), Number(body.long), 'api:updateSubjectPosition');
  },

  async evaluateSubjectPosition({ homey, body }) {
    return homey.app.evaluateStoredSubjectPosition(cleanText(body.subjectId), 'api:evaluateSubjectPosition');
  },

  async deleteSubject({ homey, params }) {
    await deleteSubject(homey, params.id);
    await homey.app.triggerConfigChangedEvent('subject_deleted');
    return { ok: true };
  },

  async resetSubject({ homey, params }) {
    await resetSubjectState(homey, params.id);
    await homey.app.triggerConfigChangedEvent('subject_reset');
    return { ok: true };
  },

  async purgeSubjects({ homey, body }) {
    const config = await purgeSubjects(homey, body?.days);
    return { ok: true, count: Object.keys(config.subjects || {}).length };
  },

  async getHistory({ homey }) {
    return getHistory(homey).map(entry => ({ id: entry.id, createdAt: entry.createdAt }));
  },

  async restoreHistory({ homey, params }) {
    const config = await restoreHistoryEntry(homey, params.id);
    return { ok: true, config };
  },

  async deleteHistory({ homey, params }) {
    await deleteHistoryEntry(homey, params.id);
    return { ok: true };
  },

  async listLocationDevices({ homey }) {
    const { devices, attempts } = await listLocationDevices(homey, getConfig);
    return { devices, attempts };
  },

  async addLocationDevice({ homey, params }) {
    const { devices } = await listLocationDevices(homey, getConfig);
    const device = devices.find(item => item.id === params.id);
    if (!device) throw new Error('Device not found or incompatible');
    if (device.alreadyAdded) throw new Error('Device already added');
    const subjectId = makeIdFromName(device.name, 'subject');
    await updateConfig(homey, config => {
      let finalId = subjectId;
      let index = 2;
      while (config.subjects[finalId]) {
        finalId = `${subjectId}_${index}`;
        index += 1;
      }
      config.subjects[finalId] = sanitizeSubject({ id: finalId, name: device.name, source: { kind: 'device', deviceId: device.id, deviceName: device.name } }, finalId);
      config.sources.push({ deviceId: device.id, deviceName: device.name, subjectId: finalId, latCapability: device.latCapability || 'measure_latitude', lngCapability: device.lngCapability || 'measure_longitude', createdAt: new Date().toISOString() });
      return config;
    });
    await homey.app.triggerConfigChangedEvent('source_added');
    return { ok: true };
  },
  async removeLocationDevice({ homey, params }) {
    const deviceId = cleanText(params.id);
    await updateConfig(homey, config => {
      const source = (config.sources || []).find(item => item.deviceId === deviceId);
      if (source?.subjectId && config.subjects[source.subjectId]) delete config.subjects[source.subjectId];
      config.sources = (config.sources || []).filter(item => item.deviceId !== deviceId);
      return config;
    });
    await homey.app.triggerConfigChangedEvent('source_removed');
    return { ok: true };
  },


async exportFile({ homey }) {
  await cleanupPreviousExports();

  const filename = `geozones-export-${Date.now()}.json`;
  const filepath = path.join('/userdata', filename);

  await fs.writeFile(
    filepath,
    JSON.stringify(getConfig(homey), null, 2),
    'utf8'
  );

  const cloudId = await homey.cloud.getHomeyId();

  return {
    ok: true,
    filename,
    url: `https://${cloudId}.connect.athom.com/app/${homey.manifest.id}/userdata/${filename}`,
  };
},

};
