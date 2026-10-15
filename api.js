'use strict';

const {
  getConfig,
  setConfig,
  updateConfig,
  getHistory,
  restoreHistoryEntry,
  deleteHistoryEntry,
} = require('./lib/store');
const { determineBestZone } = require('./lib/zone-engine');
const { getMigrationStatus, getLegacyBackup } = require('./lib/migration');
const { log } = require('./lib/logger');
const { translate } = require('./lib/i18n');

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function inspectConfigPayload(body, mode, homey) {
  const invalid = () => { throw new Error(translate(homey, 'invalidConfigImport', 'Invalid configuration import: provide an exported configuration object with recognized sections. Replacing requires zones or legacy subject data.')); };
  if (!isObject(body)) invalid();
  let settings = body;
  if (owns(body, 'payload')) {
    if (!isObject(body.payload) || !isObject(body.payload.settings)) invalid();
    settings = body.payload.settings;
  }
  if (owns(settings, 'config') && !isObject(settings.config)) invalid();
  const config = owns(settings, 'config') ? settings.config : settings;
  const sections = ['zones', 'general', 'ui', 'subjects', 'sources'];
  if (!sections.some(key => owns(config, key)) && !owns(settings, 'subjects_state')) invalid();
  for (const key of ['zones', 'sources']) if (owns(config, key) && !Array.isArray(config[key])) invalid();
  for (const key of ['general', 'ui', 'subjects']) if (owns(config, key) && !isObject(config[key])) invalid();
  if (owns(settings, 'subjects_state') && !isObject(settings.subjects_state)) invalid();
  if (mode === 'replace' && !['zones', 'subjects', 'sources'].some(key => owns(config, key)) && !owns(settings, 'subjects_state')) invalid();
  return { config, settings };
}

function retainImportWrapper(body, settings, config) {
  if (owns(body, 'payload')) return { ...body, payload: { ...body.payload, settings: { ...settings, config } } };
  if (owns(body, 'config') || owns(settings, 'subjects_state')) return { ...settings, config };
  return config;
}

module.exports = {
  async getConfig({ homey }) {
    return getConfig(homey);
  },

  async getMeta({ homey }) {
    return {
      appId: homey.manifest.id,
      name: homey.manifest.name,
      version: homey.manifest.version,
      language: homey.i18n.getLanguage(),
    };
  },

  async getMigrationStatus({ homey }) {
    return getMigrationStatus(homey);
  },

  async getMigrationBackup({ homey }) {
    return getLegacyBackup(homey);
  },

  async setConfig({ homey, body }) {
    inspectConfigPayload(body, 'replace', homey);
    const result = await setConfig(homey, body);
    log(homey, 'api', 'Configuration replaced', { zones: Array.isArray(result?.zones) ? result.zones.length : 0 });
    await homey.app.triggerConfigChangedEvent('config_set');
    await homey.app.reevaluateAllSubjects('config_set');
    return result;
  },

  async mergeConfig({ homey, body }) {
    const { config: incoming, settings } = inspectConfigPayload(body, 'merge', homey);
    const result = await updateConfig(homey, current => retainImportWrapper(body, settings, {
      ...current,
      ...incoming,
      general: incoming.general ? { ...current.general, ...incoming.general } : current.general,
      ui: incoming.ui ? { ...current.ui, ...incoming.ui } : current.ui,
    }));
    log(homey, 'api', 'Configuration merged', {
      replacesZones: Array.isArray(incoming.zones),
      mergesGeneral: Boolean(incoming.general),
      mergesUi: Boolean(incoming.ui),
      zones: Array.isArray(result?.zones) ? result.zones.length : 0,
    });
    await homey.app.triggerConfigChangedEvent('config_merged');
    await homey.app.reevaluateAllSubjects('config_merged');
    return result;
  },

  async evaluateCoordinates({ homey, body }) {
    const coords = homey.app.requireValidCoordinates(body?.lat, body?.long);
    return determineBestZone({ lat: coords.latitude, long: coords.longitude, zones: getConfig(homey).zones, subjectState: null, useDelays: false });
  },

  async getHistory({ homey }) {
    return getHistory(homey).map(entry => ({ id: entry.id, createdAt: entry.createdAt }));
  },

  async restoreHistory({ homey, params }) {
    const config = await restoreHistoryEntry(homey, params.id);
    log(homey, 'api', 'History restored', { historyId: params.id, zones: Array.isArray(config?.zones) ? config.zones.length : 0 });
    await homey.app.triggerConfigChangedEvent('history_restored');
    await homey.app.reevaluateAllSubjects('history_restored');
    return { ok: true, config };
  },

  async deleteHistory({ homey, params }) {
    await deleteHistoryEntry(homey, params.id);
    return { ok: true };
  },

};
