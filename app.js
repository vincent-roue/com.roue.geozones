'use strict';

const Homey = require('homey');
const { getConfig, setConfig, updateConfig, getDerivedTags } = require('./lib/store');
const { determineBestZone, STATE_ZONE_NOT_DEFINED, isFoundZoneName } = require('./lib/zone-engine');
const { haversineMeters, distanceToZoneM, isValidLat, isValidLng, isFiniteNumber } = require('./lib/geo');
const { disposeSubjectRuntime } = require('./lib/subject-device');
const { migrateLegacySettings } = require('./lib/migration');
const fs = require('fs').promises;
const path = require('path');
const { cleanText, normalizeKey, parseCsvList, uniqueNormalized } = require('./lib/utils');
const { translate } = require('./lib/i18n');
const { log, logWarn, logError, logHeavy, shouldLogOnce, shouldThrottle } = require('./lib/logger');

const MOVEMENT_STATES = ['unknown', 'stable', 'moving'];

class GeoZonesApp extends Homey.App {
  async onInit() {
    try {
      await migrateLegacySettings(this.homey);
    } finally {
      await this.cleanupLegacyExports();
    }
    this.registerFlowCards();
    await this.syncSubjectNameWarnings();

    this.logInfo('app', `GeoZones v${this.homey.manifest.version} started`);
  }

  async onUninit() {
    const devices = await this.getSubjectDevices();
    await Promise.all(devices.map(device => disposeSubjectRuntime(device)));
  }

  async cleanupLegacyExports() {
    let files;
    try {
      files = await fs.readdir('/userdata');
    } catch (error) {
      if (error.code !== 'ENOENT') this.logError('legacy-export-cleanup', error);
      return;
    }
    await Promise.all(files.filter(filename => /^geozones-export-.*\.json$/i.test(filename)).map(async filename => {
      try {
        await fs.unlink(path.join('/userdata', filename));
      } catch (error) {
        this.logError('legacy-export-cleanup', error);
      }
    }));
  }

  tError(key, fallback = '', tags = {}) {
    return translate(this.homey, key, fallback, tags);
  }

  logInfo(scope, message, details = null) {
    log(this.homey, scope, message, details);
  }

  logWarn(scope, message, details = null) {
    logWarn(this.homey, scope, message, details);
  }

  logError(scope, error, details = null) {
    logError(this.homey, scope, error, details);
  }

  logHeavy(scope, message, details = null) {
    logHeavy(this.homey, scope, message, details);
  }


  async getHomeyWebApi() { return null; }

  async initializeSourceRealtime() { return null; }

  async registerPerSourceRealtime() { return null; }

  registerSourceRealtime() {}

  extractDeviceIdFromCapabilityPayload() { return ''; }

  extractCapabilityIdFromRealtimePayload() { return ''; }

  async getLinkedSubjectsForSourceDevice() { return []; }

  async refreshSourceWatchers() { return null; }

  async ensureSourceWatcher() { return null; }

  async destroySourceWatcher() { return null; }

  async teardownSourceWatchers() { return null; }

  clearSourceWatchdog() {}

  armSourceWatchdog() {}

  scheduleFullLinkedSourceRefresh() {}

  async scheduleSourceRealtimeRefresh() { return null; }

  async processSourceRealtimeRefresh() { return null; }

  async handleSourceRealtimeEvent() { return null; }

  getZones() {
    return getConfig(this.homey).zones || [];
  }

  async getSubjectDevices() {
    const devices = [];
    for (const driverId of ['subject_manual']) {
      try {
        const driver = this.homey.drivers.getDriver(driverId);
        if (!driver?.getDevices) continue;
        devices.push(...driver.getDevices());
      } catch (error) {
        // ignore missing drivers during boot
      }
    }
    return devices;
  }

  async getSubjectDeviceById(deviceId) {
    const cleanId = cleanText(deviceId);
    if (!cleanId) return null;
    const devices = await this.getSubjectDevices();
    return devices.find(device => cleanText(device.getData().id || device.id) === cleanId || cleanText(device.getId?.() || '') === cleanId) || null;
  }

  async getSubjectDeviceByName(name) {
    const key = normalizeKey(name);
    if (!key) return null;
    const devices = await this.getSubjectDevices();
    return devices.find(device => normalizeKey(device.getName()) === key) || null;
  }

  async resolveSubjectArg(arg) {
    const value = cleanText(arg?.id || arg?.name || arg);
    if (!value) return null;
    return (await this.getSubjectDeviceById(value)) || (await this.getSubjectDeviceByName(value));
  }

  async ensureSubjectNameAvailable(name, ignoreDeviceId = '') {
    const cleanName = cleanText(name);
    if (!cleanName) throw new Error(this.tError('subjectNameRequired', 'A subject name is required'));
    const devices = await this.getSubjectDevices();
    const duplicate = devices.find(device => normalizeKey(device.getName()) === normalizeKey(cleanName) && cleanText(device.getData().id || '') !== cleanText(ignoreDeviceId));
    if (duplicate) throw new Error(this.tError('duplicateSubjectName', `A subject named "${cleanName}" already exists`, { name: cleanName }));
    return true;
  }

  buildSourceDeviceSnapshot(devices = []) {
    return { devices: [], devicesById: new Map() };
  }

  async getSourceDeviceSnapshot() {
    return this.buildSourceDeviceSnapshot([]);
  }

  async resolveSourceDeviceName() {
    return '';
  }

  async applyStoredDeviceWarnings(device) {
    if (!device) return;
    const warnings = [
      cleanText(device.getStoreValue('nameWarning') || ''),
      cleanText(device.getStoreValue('sourceWarning') || ''),
    ].filter(Boolean);
    if (warnings.length) await device.setWarning(warnings.join(' | '));
    else await device.unsetWarning().catch(() => null);
  }

  async syncSubjectNameWarnings() {
    const devices = await this.getSubjectDevices();
    const counts = new Map();
    for (const device of devices) {
      const key = normalizeKey(device.getName());
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    for (const device of devices) {
      const key = normalizeKey(device.getName());
      const warning = key && (counts.get(key) || 0) > 1
        ? this.tError('duplicateSubjectNameWarning', `Duplicate subject name: ${device.getName()}`, { name: device.getName() })
        : '';
      await device.setStoreValue('nameWarning', warning);
      await this.applyStoredDeviceWarnings(device);
    }
  }

  async handleSubjectRenamed(device, previousName, nextName) {
    const oldName = cleanText(previousName);
    const newName = cleanText(nextName);
    if (!newName || normalizeKey(oldName) === normalizeKey(newName)) {
      await device.setStoreValue('lastKnownName', newName || oldName || device.getName());
      await this.syncSubjectNameWarnings();
      return;
    }

    try {
      await this.ensureSubjectNameAvailable(newName, device.getData().id || device.id || '');
    } catch (error) {
      const revertName = oldName || cleanText(device.getStoreValue?.('lastKnownName') || '');
      if (typeof device.setName === 'function' && revertName && normalizeKey(revertName) !== normalizeKey(newName)) {
        await device.setName(revertName).catch(() => null);
      }
      await device.setStoreValue('nameWarning', error.message || this.tError('duplicateSubjectNameWarning', 'Duplicate subject name', { name: newName }));
      await this.applyStoredDeviceWarnings(device);
      throw error;
    }

    await this.renameSubjectInZoneFilters(oldName, newName);
    await device.setStoreValue('lastKnownName', newName);
    await device.setStoreValue('nameWarning', '');
    await this.syncSubjectNameWarnings();
  }

  async reevaluateAllSubjects(reason = 'config_changed') {
    const devices = await this.getSubjectDevices();
    for (const device of devices) {
      try {
        const enabled = device.getCapabilityValue('enabled') !== false && device.getSettings().enabled !== false;
        if (!enabled && typeof device.clearRuntimeState === 'function') {
          await device.clearRuntimeState(`reevaluate:${reason}`);
          continue;
        }
        if (typeof device.evaluateCurrentPosition !== 'function') continue;
        await device.evaluateCurrentPosition(`reevaluate:${reason}`);
      } catch (error) {
        const message = cleanText(error?.message || error);
        if (!/No stored coordinates available/i.test(message)) this.logError('app', error);
      }
    }
  }

  async removeSubjectFromZoneFilters(name) {
    const targetKey = normalizeKey(name);
    if (!targetKey) return;
    await updateConfig(this.homey, config => {
      for (const zone of config.zones || []) {
        const current = zone?.options?.subjectFilter?.subjects || [];
        if (zone?.options?.subjectFilter) {
          zone.options.subjectFilter.subjects = uniqueNormalized(current.filter(value => normalizeKey(value) !== targetKey));
        }
      }
      return config;
    });
    await this.triggerConfigChangedEvent('subject_deleted');
    await this.reevaluateAllSubjects('subject_deleted');
  }

  async handleSourceDeviceUpdate() { return null; }

  async syncLinkedSubjects() { return null; }

  async renameSubjectInZoneFilters(oldName, newName) {
    const oldKey = normalizeKey(oldName);
    const nextName = cleanText(newName);
    if (!oldKey || !nextName) return;
    await updateConfig(this.homey, config => {
      for (const zone of config.zones || []) {
        const current = zone?.options?.subjectFilter?.subjects || [];
        zone.options.subjectFilter.subjects = uniqueNormalized(current.map(value => normalizeKey(value) === oldKey ? nextName : value));
      }
      return config;
    });
    await this.triggerConfigChangedEvent('subject_renamed');
    await this.reevaluateAllSubjects('subject_renamed');
  }

  async triggerConfigChangedEvent(reason = 'config_changed') {
    if (!this.triggerConfigChanged) return;
    this.logInfo('config', `Configuration changed (${reason})`);
    await this.triggerConfigChanged.trigger({ reason }, { reason }).catch(err => this.logError('config', err, { reason }));
  }

  collectNamedArgs(singleArg, multiArg) {
    const values = [];
    const addValue = value => {
      const clean = cleanText(value?.name || value?.id || value);
      if (clean) values.push(clean);
    };
    if (Array.isArray(singleArg)) singleArg.forEach(addValue);
    else addValue(singleArg);
    parseCsvList(multiArg).forEach(addValue);
    return uniqueNormalized(values);
  }

  async autocompleteSubjects(query) {
    const q = normalizeKey(query);
    const devices = await this.getSubjectDevices();
    return devices
      .filter(device => !q || normalizeKey(device.getName()).includes(q))
      .map(device => ({
        id: device.getData().id,
        name: device.getName(),
        description: device.getData().id,
      }));
  }

  async autocompleteZones(query) {
    const q = normalizeKey(query);
    return this.getZones()
      .filter(zone => !q || normalizeKey(zone.name).includes(q))
      .map(zone => ({ id: zone.name, name: zone.name }));
  }

  async autocompleteTags(query) {
    const q = normalizeKey(query);
    return getDerivedTags(getConfig(this.homey))
      .filter(tag => !q || normalizeKey(tag).includes(q))
      .map(tag => ({ id: tag, name: tag }));
  }

  async autocompleteSubjectTypes(query) {
    const q = normalizeKey(query);
    const devices = await this.getSubjectDevices();
    return uniqueNormalized(devices.map(device => cleanText(device.getCapabilityValue('subject_type') || device.getSettings().subjectType || '')).filter(Boolean))
      .filter(type => !q || normalizeKey(type).includes(q))
      .map(type => ({ id: type, name: type }));
  }

  async autocompleteMovementStates(query) {
    const q = normalizeKey(query);
    return MOVEMENT_STATES.map(state => ({ id: state, name: this.tError(`movementState${state[0].toUpperCase()}${state.slice(1)}`, state) }))
      .filter(state => !q || normalizeKey(state.name).includes(q) || normalizeKey(state.id).includes(q));
  }

  registerAutocomplete(card, argName, fn) {
    if (!card?.registerArgumentAutocompleteListener) return;
    try {
      card.registerArgumentAutocompleteListener(argName, async query => fn.call(this, query));
    } catch (error) {
      // ignore cards without argument
    }
  }

  registerCommonAutocompletes(card, options = {}) {
    if (options.subject) this.registerAutocomplete(card, 'subject', this.autocompleteSubjects);
    if (options.subjectType) this.registerAutocomplete(card, 'subjectType', this.autocompleteSubjectTypes);
    if (options.zone) this.registerAutocomplete(card, 'zone', this.autocompleteZones);
    if (options.tag) this.registerAutocomplete(card, 'tag', this.autocompleteTags);
    if (options.state) this.registerAutocomplete(card, 'state', this.autocompleteMovementStates);
  }

  async evaluateCoordinatesOnly({ lat, long }) {
    const coords = this.requireValidCoordinates(lat, long);
    return determineBestZone({ lat: coords.latitude, long: coords.longitude, zones: this.getZones(), subjectState: null, useDelays: false });
  }

  getZoneByName(name) {
    const key = normalizeKey(name);
    return this.getZones().find(zone => normalizeKey(zone.name) === key) || null;
  }

  zoneResultMatchesOne(result, expectedZones) {
    const values = expectedZones.map(normalizeKey);
    return values.includes(normalizeKey(result?.zone || ''));
  }

  resultMatchesTag(result, expectedTags) {
    const actualTags = uniqueNormalized(result?.tagsArray || []).map(normalizeKey);
    return expectedTags.map(normalizeKey).some(tag => actualTags.includes(tag));
  }

  matchZoneOrTagFilterArgs(args, zoneName, zoneTags) {
    const zones = this.collectNamedArgs(args.zone, args.zones).map(normalizeKey);
    const tags = this.collectNamedArgs(args.tag, args.tags).map(normalizeKey);
    if (!zones.length && !tags.length) return true;
    const zoneMatch = zones.length ? zones.includes(normalizeKey(zoneName || '')) : false;
    const actualTags = parseCsvList(zoneTags).map(normalizeKey);
    const tagMatch = tags.length ? tags.some(tag => actualTags.includes(tag)) : false;
    return zoneMatch || tagMatch;
  }

  async getZoneOccupants(zoneName) {
    const key = normalizeKey(zoneName);
    const devices = await this.getSubjectDevices();
    return devices.filter(device => device.getCapabilityValue('enabled') !== false && normalizeKey(device.getCapabilityValue('current_zone') || '') === key);
  }

  async zoneContainsMatch(zoneName, matchMode, subjectValues, subjectTypeValues) {
    const occupants = await this.getZoneOccupants(zoneName);
    const subjectKeys = subjectValues.map(normalizeKey);
    const typeKeys = subjectTypeValues.map(normalizeKey);
    if (!occupants.length) return false;
    const matches = device => {
      const nameKey = normalizeKey(device.getName());
      const typeKey = normalizeKey(device.getCapabilityValue('subject_type') || '');
      if (!subjectKeys.length && !typeKeys.length) return true;
      return subjectKeys.includes(nameKey) || typeKeys.includes(typeKey);
    };
    if (normalizeKey(matchMode) === 'only') return occupants.every(matches);
    return occupants.some(matches);
  }

  async stateMatchesSubjectAndType(args, state) {
    const subjects = this.collectNamedArgs(args.subject, args.subjects).map(normalizeKey);
    const subjectTypes = this.collectNamedArgs(args.subjectType, args.subjectTypes).map(normalizeKey);
    const subjectMatch = !subjects.length || subjects.includes(normalizeKey(state.subject || state.subject_name || '')) || subjects.includes(normalizeKey(state.subjectId || ''));
    const typeMatch = !subjectTypes.length || subjectTypes.includes(normalizeKey(state.subject_type || state.subjectType || ''));
    return subjectMatch && typeMatch;
  }

  getSubjectKind(device) {
    const driverId = cleanText(device?.driver?.id || device?.driverId || device?.getDriver?.()?.id || '');
    return 'manual';
  }

  buildSubjectStateTokens(device) {
    const subjectKind = this.getSubjectKind(device);
    const currentZone = cleanText(device.getCapabilityValue('current_zone') || '') || STATE_ZONE_NOT_DEFINED;
    const previousZone = cleanText(device.getCapabilityValue('previous_zone') || '') || STATE_ZONE_NOT_DEFINED;
    const rawLatitude = device.getCapabilityValue('latitude');
    const rawLongitude = device.getCapabilityValue('longitude');
    const linked = subjectKind === 'linked';
    return {
      subject: device.getName(),
      subject_type: cleanText(device.getCapabilityValue('subject_type') || ''),
      subject_kind: subjectKind,
      current_zone: currentZone,
      previous_zone: previousZone,
      zone_tags: cleanText(device.getCapabilityValue('zone_tags') || ''),
      movement_state: cleanText(device.getCapabilityValue('movement_state') || 'unknown'),
      speed_kmh: Number(device.getCapabilityValue('speed_kmh') || 0),
      latitude: isValidLat(rawLatitude) ? Number(rawLatitude) : null,
      longitude: isValidLng(rawLongitude) ? Number(rawLongitude) : null,
      last_update: cleanText(device.getCapabilityValue('last_update') || ''),
      enabled: device.getCapabilityValue('enabled') !== false,
      distance_to_homey: cleanText(device.getCapabilityValue('distance_to_homey') || ''),
      source_status: linked ? (cleanText(device.getCapabilityValue('source_status') || '') || STATE_ZONE_NOT_DEFINED) : 'manual',
      source_device_name: linked ? (cleanText(device.getCapabilityValue('source_device_name') || '') || STATE_ZONE_NOT_DEFINED) : STATE_ZONE_NOT_DEFINED,
      source_stale: linked ? Boolean(device.getCapabilityValue('source_stale')) : false,
    };
  }

  toCoordinateEvaluationTokens(result) {
    return {
      zone: cleanText(result?.zone || '') || STATE_ZONE_NOT_DEFINED,
      zone_tags: cleanText((result?.tagsArray || []).join(',')),
    };
  }

  toDeviceEvaluationTokens(device) {
    return {
      zone: cleanText(device.getCapabilityValue('current_zone') || '') || STATE_ZONE_NOT_DEFINED,
      previous_zone: cleanText(device.getCapabilityValue('previous_zone') || '') || STATE_ZONE_NOT_DEFINED,
      zone_tags: cleanText(device.getCapabilityValue('zone_tags') || ''),
      movement_state: cleanText(device.getCapabilityValue('movement_state') || 'unknown'),
      speed_kmh: Number(device.getCapabilityValue('speed_kmh') || 0),
    };
  }

  async triggerDeviceAndGlobalEvent(eventType, device, tokens = {}) {
    const state = {
      subject: device.getName(),
      subjectId: device.getData().id,
      subject_type: cleanText(device.getCapabilityValue('subject_type') || ''),
      zone: cleanText(tokens.zone || device.getCapabilityValue('current_zone') || '') || STATE_ZONE_NOT_DEFINED,
      previous_zone: cleanText(tokens.previous_zone || device.getCapabilityValue('previous_zone') || '') || STATE_ZONE_NOT_DEFINED,
      zone_tags: cleanText(tokens.zone_tags !== undefined ? tokens.zone_tags : (device.getCapabilityValue('zone_tags') || '')),
      movement_state: cleanText(tokens.movement_state || device.getCapabilityValue('movement_state') || 'unknown'),
      speed_kmh: Number(tokens.speed_kmh !== undefined ? tokens.speed_kmh : (device.getCapabilityValue('speed_kmh') || 0)),
      transition: cleanText(tokens.transition || ''),
      source_status: cleanText(tokens.source_status || device.getCapabilityValue('source_status') || ''),
      distance_to_homey: cleanText(tokens.distance_to_homey || device.getCapabilityValue('distance_to_homey') || ''),
    };

    const flowTokens = { ...state, ...tokens };

    const safeTrigger = async (card, triggerDevice = null) => {
      if (!card) return;
      try {
        if (triggerDevice) await card.trigger(triggerDevice, flowTokens, state);
        else await card.trigger(flowTokens, state);
      } catch (error) {
        this.logError('app', error);
      }
    };

    const deviceDriverId = cleanText(device?.driver?.id || device?.driverId || device?.getDriver?.()?.id || '');
    const triggerCardsForDevice = (cards) => Array.isArray(cards)
      ? cards.filter(card => card && (!deviceDriverId || !card.driver || card.driver.id === deviceDriverId))
      : [cards].filter(Boolean);

    if (eventType === 'position_changed') {
      for (const card of triggerCardsForDevice(this.deviceTriggerPositionChangedCards)) await safeTrigger(card, device);
      await safeTrigger(this.triggerAnySubjectMoved);
      await safeTrigger(this.triggerGlobalSubjectMoved);
    } else if (eventType === 'recalculated') {
      for (const card of triggerCardsForDevice(this.deviceTriggerRecalculatedCards)) await safeTrigger(card, device);
      await safeTrigger(this.triggerAnySubjectRecalculated);
      await safeTrigger(this.triggerGlobalSubjectRecalculated);
    } else if (eventType === 'zone_changed') {
      for (const card of triggerCardsForDevice(this.deviceTriggerZoneChangedCards)) await safeTrigger(card, device);
      await safeTrigger(this.triggerAnySubjectZoneChanged);
      await safeTrigger(this.triggerGlobalSubjectZoneChanged);
    } else if (eventType === 'transition') {
      for (const card of triggerCardsForDevice(this.deviceTriggerTransitions)) await safeTrigger(card, device);
      await safeTrigger(this.triggerAnySubjectTransition);
      await safeTrigger(this.triggerGlobalSubjectTransition);
    }
  }

  requireValidCoordinates(lat, lng, label = this.tError('coordinatesLabel', 'Coordinates')) {
    if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) throw new Error(this.tError('coordinatesRequired', `${label} are required`, { label }));
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error(this.tError('coordinatesRequired', `${label} are required`, { label }));
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error(this.tError('coordinatesOutOfRange', `${label} are out of range`, { label }));
    return { latitude, longitude };
  }

  getValidDeviceCoordinates(device, label = this.tError('deviceCoordinatesLabel', 'Device coordinates')) {
    return this.requireValidCoordinates(device?.getCapabilityValue('latitude'), device?.getCapabilityValue('longitude'), label);
  }

  registerFlowCards() {
    // app triggers
    this.triggerConfigChanged = this.homey.flow.getTriggerCard('config_changed');
    this.triggerGlobalSubjectTransition = this.homey.flow.getTriggerCard('global_subject_transition');
    this.triggerGlobalSubjectZoneChanged = this.homey.flow.getTriggerCard('global_subject_zone_changed');
    this.triggerGlobalSubjectMoved = this.homey.flow.getTriggerCard('global_subject_moved');
    this.triggerGlobalSubjectRecalculated = this.homey.flow.getTriggerCard('global_subject_recalculated');
    this.triggerAnySubjectTransition = this.homey.flow.getTriggerCard('any_subject_transition');
    this.triggerAnySubjectZoneChanged = this.homey.flow.getTriggerCard('any_subject_zone_changed');
    this.triggerAnySubjectMoved = this.homey.flow.getTriggerCard('any_subject_moved');
    this.triggerAnySubjectRecalculated = this.homey.flow.getTriggerCard('any_subject_recalculated');

    this.registerCommonAutocompletes(this.triggerGlobalSubjectTransition, { subject: true, subjectType: true, zone: true, tag: true });
    this.registerCommonAutocompletes(this.triggerGlobalSubjectZoneChanged, { subject: true, subjectType: true });
    this.registerCommonAutocompletes(this.triggerGlobalSubjectMoved, { subject: true, subjectType: true });
    this.registerCommonAutocompletes(this.triggerGlobalSubjectRecalculated, { subject: true, subjectType: true });
    this.registerCommonAutocompletes(this.triggerAnySubjectTransition, { zone: true, tag: true });

    this.triggerGlobalSubjectTransition?.registerRunListener(async (args, state) => (
      normalizeKey(args.transition) === normalizeKey(state.transition)
      && await this.stateMatchesSubjectAndType(args, state)
      && this.matchZoneOrTagFilterArgs(args, state.zone, state.zone_tags)
    ));
    this.triggerGlobalSubjectZoneChanged?.registerRunListener(async (args, state) => this.stateMatchesSubjectAndType(args, state));
    this.triggerGlobalSubjectMoved?.registerRunListener(async (args, state) => this.stateMatchesSubjectAndType(args, state));
    this.triggerGlobalSubjectRecalculated?.registerRunListener(async (args, state) => this.stateMatchesSubjectAndType(args, state));
    this.triggerAnySubjectTransition?.registerRunListener(async (args, state) => normalizeKey(args.transition) === normalizeKey(state.transition) && this.matchZoneOrTagFilterArgs(args, state.zone, state.zone_tags));
    this.triggerAnySubjectZoneChanged?.registerRunListener(async () => true);
    this.triggerAnySubjectMoved?.registerRunListener(async () => true);
    this.triggerAnySubjectRecalculated?.registerRunListener(async () => true);
    this.triggerConfigChanged?.registerRunListener(async () => true);

    // device triggers
    this.deviceTriggerTransitions = [
      this.homey.flow.getDeviceTriggerCard?.('subject_transition'),
    ].filter(Boolean);
    this.deviceTriggerZoneChangedCards = [
      this.homey.flow.getDeviceTriggerCard?.('subject_zone_changed'),
    ].filter(Boolean);
    this.deviceTriggerPositionChangedCards = [
      this.homey.flow.getDeviceTriggerCard?.('subject_position_changed'),
    ].filter(Boolean);
    this.deviceTriggerRecalculatedCards = [
      this.homey.flow.getDeviceTriggerCard?.('subject_recalculated'),
    ].filter(Boolean);
    for (const card of this.deviceTriggerTransitions) {
      this.registerCommonAutocompletes(card, { zone: true, tag: true });
      card?.registerRunListener(async (args, state) => normalizeKey(args.transition) === normalizeKey(state.transition) && this.matchZoneOrTagFilterArgs(args, state.zone, state.zone_tags));
    }
    for (const card of this.deviceTriggerZoneChangedCards) card?.registerRunListener(async () => true);
    for (const card of this.deviceTriggerPositionChangedCards) card?.registerRunListener(async () => true);
    for (const card of this.deviceTriggerRecalculatedCards) card?.registerRunListener(async () => true);

    // app conditions
    const coordinatesMatchTag = this.homey.flow.getConditionCard('coordinates_match_tag');
    this.registerCommonAutocompletes(coordinatesMatchTag, { tag: true });
    coordinatesMatchTag?.registerRunListener(async args => {
      const result = await this.evaluateCoordinatesOnly({ lat: args.lat, long: args.long });
      const tags = this.collectNamedArgs(args.tag, args.tags);
      return tags.length ? this.resultMatchesTag(result, tags) : false;
    });

    const coordinatesMatchZone = this.homey.flow.getConditionCard('coordinates_match_zone');
    this.registerCommonAutocompletes(coordinatesMatchZone, { zone: true });
    coordinatesMatchZone?.registerRunListener(async args => {
      const result = await this.evaluateCoordinatesOnly({ lat: args.lat, long: args.long });
      const zones = this.collectNamedArgs(args.zone, args.zones);
      return zones.length ? this.zoneResultMatchesOne(result, zones) : false;
    });

    const zoneContainsMatch = this.homey.flow.getConditionCard('zone_contains_match');
    this.registerCommonAutocompletes(zoneContainsMatch, { zone: true, subject: true, subjectType: true });
    zoneContainsMatch?.registerRunListener(async args => {
      const zoneName = cleanText(args.zone?.name || args.zone?.id || args.zone);
      if (!zoneName) throw new Error(this.tError('zoneRequired', 'Zone is required'));
      return this.zoneContainsMatch(zoneName, args.matchMode, this.collectNamedArgs(args.subject, args.subjects), this.collectNamedArgs(args.subjectType, args.subjectTypes));
    });

    const tagContainsMatch = this.homey.flow.getConditionCard('tag_contains_match');
    this.registerCommonAutocompletes(tagContainsMatch, { tag: true, subject: true, subjectType: true });
    tagContainsMatch?.registerRunListener(async args => {
      const tags = this.collectNamedArgs(args.tag, args.tags);
      if (!tags.length) throw new Error(this.tError('tagRequired', 'Tag is required'));
      const zones = this.getZones().filter(zone => tags.some(tag => (zone.tags || []).map(normalizeKey).includes(normalizeKey(tag))));
      for (const zone of zones) {
        if (await this.zoneContainsMatch(zone.name, args.matchMode, this.collectNamedArgs(args.subject, args.subjects), this.collectNamedArgs(args.subjectType, args.subjectTypes))) return true;
      }
      return false;
    });

    const zoneHasTag = this.homey.flow.getConditionCard('zone_has_tag');
    this.registerCommonAutocompletes(zoneHasTag, { zone: true, tag: true });
    zoneHasTag?.registerRunListener(async args => {
      const zoneName = cleanText(args.zone?.name || args.zone?.id || args.zone);
      const zone = this.getZoneByName(zoneName);
      if (!zone) throw new Error(this.tError('zoneRequired', 'Zone is required'));
      const tags = this.collectNamedArgs(args.tag, args.tags).map(normalizeKey);
      return tags.length ? tags.some(tag => (zone.tags || []).map(normalizeKey).includes(tag)) : false;
    });

    const tagExists = this.homey.flow.getConditionCard('tag_exists');
    this.registerCommonAutocompletes(tagExists, { tag: true });
    tagExists?.registerRunListener(async args => {
      const tags = this.collectNamedArgs(args.tag, args.tags).map(normalizeKey);
      const known = getDerivedTags(getConfig(this.homey)).map(normalizeKey);
      return tags.length ? tags.every(tag => known.includes(tag)) : false;
    });

    // app actions
    const evaluateCoordinates = this.homey.flow.getActionCard('evaluate_coordinates');
    evaluateCoordinates?.registerRunListener(async args => this.toCoordinateEvaluationTokens(await this.evaluateCoordinatesOnly({ lat: args.lat, long: args.long })));

    const getSubjectState = this.homey.flow.getActionCard('get_subject_state');
    this.registerCommonAutocompletes(getSubjectState, { subject: true });
    getSubjectState?.registerRunListener(async args => {
      const subject = await this.resolveSubjectArg(args.subject);
      if (!subject) throw new Error(this.tError('subjectRequired', 'Subject is required'));
      return this.buildSubjectStateTokens(subject);
    });

    const distanceCoordinatesCoordinates = this.homey.flow.getActionCard('distance_coordinates_coordinates');
    distanceCoordinatesCoordinates?.registerRunListener(async args => {
      const first = this.requireValidCoordinates(args.lat1, args.long1, this.tError('firstCoordinatesLabel', 'First coordinates'));
      const second = this.requireValidCoordinates(args.lat2, args.long2, this.tError('secondCoordinatesLabel', 'Second coordinates'));
      return { distance_m: haversineMeters(first.latitude, first.longitude, second.latitude, second.longitude) };
    });

    const distanceCoordinatesZone = this.homey.flow.getActionCard('distance_coordinates_zone');
    this.registerCommonAutocompletes(distanceCoordinatesZone, { zone: true });
    distanceCoordinatesZone?.registerRunListener(async args => {
      const zoneName = cleanText(args.zone?.name || args.zone?.id || args.zone);
      const zone = this.getZoneByName(zoneName);
      if (!zone) throw new Error(this.tError('zoneRequired', 'Zone is required'));
      const coords = this.requireValidCoordinates(args.lat, args.long, this.tError('coordinatesLabel', 'Coordinates'));
      return { distance_m: distanceToZoneM(coords.latitude, coords.longitude, zone) };
    });

    const setZoneTagState = this.homey.flow.getActionCard('set_zone_tag_state');
    this.registerCommonAutocompletes(setZoneTagState, { zone: true, tag: true });
    setZoneTagState?.registerRunListener(async args => {
      const zoneName = cleanText(args.zone?.name || args.zone?.id || args.zone);
      const tag = cleanText(args.tag?.name || args.tag?.id || args.tag);
      const operation = normalizeKey(args.operation);
      if (!zoneName || !tag) throw new Error(this.tError('zoneAndTagRequired', 'Zone and tag are required'));
      let zoneTags = [];
      await updateConfig(this.homey, config => {
        const zone = (config.zones || []).find(item => normalizeKey(item.name) === normalizeKey(zoneName));
        if (!zone) throw new Error(this.tError('zoneNotFound', 'Zone not found'));
        const currentTags = uniqueNormalized(zone.tags || []);
        zone.tags = operation === 'remove'
          ? currentTags.filter(item => normalizeKey(item) !== normalizeKey(tag))
          : uniqueNormalized([...currentTags, tag]);
        zoneTags = zone.tags;
        return config;
      });
      await this.triggerConfigChangedEvent('zone_tag_changed');
      await this.reevaluateAllSubjects('zone_tag_changed');
      return { zone_tags: zoneTags.join(',') };
    });

    // device conditions
    const deviceIsInZoneCards = [
      this.homey.flow.getConditionCard('device_is_in_zone'),
    ].filter(Boolean);
    for (const card of deviceIsInZoneCards) {
      this.registerCommonAutocompletes(card, { zone: true, tag: true });
      card?.registerRunListener(async args => {
        const zoneName = cleanText(args.device.getCapabilityValue('current_zone') || '') || STATE_ZONE_NOT_DEFINED;
        if (!isFoundZoneName(zoneName)) return false;
        return this.matchZoneOrTagFilterArgs(args, zoneName, args.device.getCapabilityValue('zone_tags') || '');
      });
    }

    const deviceIsMovementStateCards = [
      this.homey.flow.getConditionCard('device_is_movement_state'),
    ].filter(Boolean);
    for (const card of deviceIsMovementStateCards) {
      this.registerCommonAutocompletes(card, { state: true });
      card?.registerRunListener(async args => normalizeKey(args.state?.id || args.state?.name || args.state) === normalizeKey(args.device.getCapabilityValue('movement_state') || ''));
    }

    // device actions
    const deviceEvaluateCards = [
      this.homey.flow.getActionCard('device_evaluate_subject'),
    ].filter(Boolean);
    for (const card of deviceEvaluateCards) card?.registerRunListener(async args => {
      await args.device.evaluateCurrentPosition('flow:device:evaluate');
      return this.toDeviceEvaluationTokens(args.device);
    });

    const deviceSetEnabledCards = [
      this.homey.flow.getActionCard('device_set_enabled_state'),
    ].filter(Boolean);
    for (const card of deviceSetEnabledCards) card?.registerRunListener(async args => {
      await args.device.setEnabledState(args.enabled_state);
      return {};
    });

    const deviceSetMinMoveCards = [
      this.homey.flow.getActionCard('device_set_min_move_distance'),
    ].filter(Boolean);
    for (const card of deviceSetMinMoveCards) card?.registerRunListener(async args => {
      await args.device.setMinMoveDistanceAction(args.minMoveDistanceM);
      return {};
    });

    const deviceDistanceToCoordinatesCards = [
      this.homey.flow.getActionCard('device_distance_to_coordinates'),
    ].filter(Boolean);
    for (const card of deviceDistanceToCoordinatesCards) card?.registerRunListener(async args => {
      const source = this.getValidDeviceCoordinates(args.device);
      const target = this.requireValidCoordinates(args.lat, args.long, this.tError('targetCoordinatesLabel', 'Target coordinates'));
      return { distance_m: haversineMeters(source.latitude, source.longitude, target.latitude, target.longitude) };
    });

    const deviceDistanceToSubjectCards = [
      this.homey.flow.getActionCard('device_distance_to_subject'),
    ].filter(Boolean);
    for (const card of deviceDistanceToSubjectCards) {
      this.registerCommonAutocompletes(card, { subject: true });
      card?.registerRunListener(async args => {
        const other = await this.resolveSubjectArg(args.subject);
        if (!other) throw new Error(this.tError('targetSubjectRequired', 'Target subject is required'));
        const source = this.getValidDeviceCoordinates(args.device);
        const target = this.getValidDeviceCoordinates(other, this.tError('targetSubjectCoordinatesLabel', 'Target subject coordinates'));
        return {
          distance_m: haversineMeters(source.latitude, source.longitude, target.latitude, target.longitude),
        };
      });
    }

    const deviceDistanceToZoneCards = [
      this.homey.flow.getActionCard('device_distance_to_zone'),
    ].filter(Boolean);
    for (const card of deviceDistanceToZoneCards) {
      this.registerCommonAutocompletes(card, { zone: true });
      card?.registerRunListener(async args => {
        const zone = this.getZoneByName(args.zone?.name || args.zone?.id || args.zone);
        if (!zone) throw new Error(this.tError('zoneRequired', 'Zone is required'));
        const source = this.getValidDeviceCoordinates(args.device);
        return { distance_m: distanceToZoneM(source.latitude, source.longitude, zone) };
      });
    }

    const deviceDistanceToTagCards = [
      this.homey.flow.getActionCard('device_distance_to_tag'),
    ].filter(Boolean);
    for (const card of deviceDistanceToTagCards) {
      this.registerCommonAutocompletes(card, { tag: true });
      card?.registerRunListener(async args => {
        const tags = this.collectNamedArgs(args.tag, args.tags);
        const zones = this.getZones().filter(zone => tags.some(tag => (zone.tags || []).map(normalizeKey).includes(normalizeKey(tag))));
        if (!zones.length) throw new Error(this.tError('noMatchingTaggedZone', 'No matching tagged zone found'));
        const source = this.getValidDeviceCoordinates(args.device);
        const distances = zones.map(zone => distanceToZoneM(source.latitude, source.longitude, zone)).filter(Number.isFinite);
        if (!distances.length) throw new Error(this.tError('noValidZoneDistance', 'No valid zone distance available'));
        return { distance_m: Math.min(...distances) };
      });
    }

    const deviceSetPositionAndEvaluate = this.homey.flow.getActionCard('device_set_position_and_evaluate');
    deviceSetPositionAndEvaluate?.registerRunListener(async args => {
      await args.device.updatePositionAndEvaluateAction(args.lat, args.long, 'flow:device:set_position');
      return this.toDeviceEvaluationTokens(args.device);
    });
  }

}


module.exports = GeoZonesApp;
