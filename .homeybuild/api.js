'use strict';

const { getConfig, setConfig, resetSubjectState, purgeSubjects, sanitizeConfig } = require('./lib/store');
const { determineBestZone } = require('./lib/zone-engine');
const { cleanText } = require('./lib/utils');

module.exports = {
  async getConfig({ homey }) {
    return getConfig(homey);
  },

  async setConfig({ homey, body }) {
    return setConfig(homey, body);
  },

  async evaluate({ homey, body }) {
    const config = getConfig(homey);
    const subjectId = cleanText(body.subjectId);
    const result = determineBestZone({
      lat: Number(body.lat),
      long: Number(body.long),
      zones: config.zones,
      subjectState: subjectId ? config.subjects[subjectId] : null,
    });

    return result;
  },

  async testPoint({ homey, body }) {
    const config = getConfig(homey);
    const subjectId = cleanText(body.subjectId);
    const result = determineBestZone({
      lat: Number(body.lat),
      long: Number(body.long),
      zones: config.zones,
      subjectState: subjectId ? config.subjects[subjectId] : null,
    });

    return {
      found: result.found,
      zone: result.zone,
      groups: result.groups,
      categories: result.categories,
      type: result.type,
      previousZone: result.previousZone,
      previousGroups: result.previousGroups,
      previousCategories: result.previousCategories,
      speedKmh: result.speedKmh,
      distanceSinceLastM: result.distanceSinceLastM,
      timeDeltaS: result.timeDeltaS,
      candidates: result.candidates.map(candidate => ({
        name: candidate.zone.name,
        groups: candidate.zone.groups,
        categories: candidate.zone.categories,
        type: candidate.zone.type,
        priority: candidate.zone.priority,
        areaM2: candidate.areaM2,
        detail: candidate.detail,
      })),
      logs: result.logs,
      persisted: false,
    };
  },

  async resetSubject({ homey, params }) {
    await resetSubjectState(homey, params.id);
    return { ok: true };
  },

  async purgeSubjects({ homey }) {
    const config = await purgeSubjects(homey);
    return { ok: true, count: Object.keys(config.subjects || {}).length };
  },
};
