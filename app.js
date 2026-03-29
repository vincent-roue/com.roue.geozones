'use strict';

const Homey = require('homey');
const { HomeyAPI } = require('homey-api');

const {
  getConfig,
  getSubjectState,
  setSubjectState,
  updateConfig,
  sanitizeZone,
  validateZone,
  resetSubjectState,
  purgeSubjects,
  getDerivedSubjectTypes,
  getDerivedTags,
} = require('./lib/store');
const { determineBestZone, STATE_ZONE_NOT_DEFINED, STATE_ZONE_UNKNOWN } = require('./lib/zone-engine');
const { haversineMeters, pointInPolygon, distanceToZoneBoundaryM } = require('./lib/geo');
const { cleanText, normalizeKey } = require('./lib/utils');
const { log, logError, isHeavyDebugEnabled } = require('./lib/logger');
const { listLocationDevices, getDeviceCoordinates } = require('./lib/sources');

class GeoZonesApp extends Homey.App {
  async onInit() {
	this.homeyApi = await HomeyAPI.createAppAPI({ homey: this.homey });
    log(this.homey, 'app', `GeoZones v${this.homey.manifest.version} started`, {
      heavyDebug: isHeavyDebugEnabled(this.homey),
    });

    this.registerFlowCards();
    await this.initRealtimeSourceSync();
    this.syncSourcesFromDevices('app:init').catch(error => logError(this.homey, 'sources:sync:init', error));
  }

  async onUninit() {
    try {
      if (this._boundDeviceUpdateListener && this.homeyApi?.devices?.off) {
        this.homeyApi.devices.off('device.update', this._boundDeviceUpdateListener);
      }
      if (this.homeyApi?.devices?.disconnect) {
        await this.homeyApi.devices.disconnect();
      }
    } catch (error) {
      logError(this.homey, 'sources:realtime:shutdown', error);
    }
  }

  async initRealtimeSourceSync() {
    try {
      if (!this.homeyApi?.devices?.connect || !this.homeyApi?.devices?.on) {
        log(this.homey, 'sources:realtime:init', 'Realtime device manager not available');
        return;
      }

      await this.homeyApi.devices.connect();
      this._boundDeviceUpdateListener = this._boundDeviceUpdateListener || this.handleRealtimeDeviceUpdate.bind(this);
      this.homeyApi.devices.on('device.update', this._boundDeviceUpdateListener);

      log(this.homey, 'sources:realtime:init', 'Realtime device sync enabled');
    } catch (error) {
      logError(this.homey, 'sources:realtime:init', error);
    }
  }

  async handleRealtimeDeviceUpdate(device) {
    try {
      const deviceId = cleanText(device?.id);
      if (!deviceId) return;

      const config = getConfig(this.homey);
      const sources = Array.isArray(config.sources) ? config.sources.filter(source => cleanText(source.deviceId) === deviceId) : [];
      if (!sources.length) return;

      const coords = getDeviceCoordinates(device, sources[0]);
      const lat = Number(coords.latitude);
      const lng = Number(coords.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const updatedAt = cleanText(
        coords.latitudeUpdated
        || coords.longitudeUpdated
        || new Date().toISOString()
      );

      for (const source of sources) {
        const subjectId = cleanText(source.subjectId);
        if (!subjectId) continue;

        const subject = getSubjectState(this.homey, subjectId);
        if (!subject) continue;

        await setSubjectState(this.homey, subjectId, {
          name: cleanText(subject.name || device.name || subjectId),
          source: { kind: 'device', deviceId, deviceName: cleanText(device.name || source.deviceName || '') },
        }, { pushHistory: false });

        await this.updateAndEvaluateSubjectPosition(subjectId, lat, lng, 'sources:realtime:device.update');
        await setSubjectState(this.homey, subjectId, { lastTimestamp: updatedAt }, { pushHistory: false });
      }
    } catch (error) {
      logError(this.homey, 'sources:realtime:device.update', error);
    }
  }


  async syncSourcesFromDevices(scope = 'sources:sync') {
    try {
      const config = getConfig(this.homey);
      if (!Array.isArray(config.sources) || !config.sources.length) return { synced: 0, updated: 0 };

      const { devices } = await listLocationDevices(this.homey, getConfig);
      const deviceMap = new Map(devices.map(device => [device.id, device]));
      let updated = 0;

      for (const source of config.sources) {
        const device = deviceMap.get(source.deviceId);
        if (!device) {
          log(this.homey, scope, 'Configured source device no longer exists', { deviceId: source.deviceId, subjectId: source.subjectId });
          continue;
        }
        const subjectId = cleanText(source.subjectId);
        if (!subjectId) continue;
        const subject = getSubjectState(this.homey, subjectId);
        if (!subject) {
          log(this.homey, scope, 'Configured source points to a missing subject', { deviceId: device.id, subjectId });
          continue;
        }

        const coords = getDeviceCoordinates(device, source);
        const lat = Number(coords.latitude);
        const lng = Number(coords.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          log(this.homey, scope, 'Configured source has no valid coordinates', { deviceId: device.id, deviceName: device.name, subjectId });
          continue;
        }

        const lastSeenIso = cleanText(coords.latitudeUpdated || coords.longitudeUpdated || new Date().toISOString());
        const patch = {
          name: cleanText(subject.name || device.name || subjectId),
          source: { kind: 'device', deviceId: device.id, deviceName: device.name },
        };
        await setSubjectState(this.homey, subjectId, patch, { pushHistory: false });

        const result = await this.updateAndEvaluateSubjectPosition(subjectId, lat, lng, `${scope}:device`);
        await setSubjectState(this.homey, subjectId, { lastTimestamp: lastSeenIso, updatedAt: new Date().toISOString() }, { pushHistory: false });
        updated += 1;
      }

      log(this.homey, scope, 'Synchronized location sources', { configured: config.sources.length, updated });
      return { synced: config.sources.length, updated };
    } catch (error) {
      logError(this.homey, scope, error);
      return { synced: 0, updated: 0, error: error.message || String(error) };
    }
  }
  registerFlowCards() {
    this.triggerEnteredZone = this.homey.flow.getTriggerCard('subject_entered_zone');
    this.triggerEnteredZones = this.homey.flow.getTriggerCard('subject_entered_zones');
    this.triggerLeftZone = this.homey.flow.getTriggerCard('subject_left_zone');
    this.triggerLeftZones = this.homey.flow.getTriggerCard('subject_left_zones');
    this.triggerPositionChanged = this.homey.flow.getTriggerCard('subject_position_changed');
    this.triggerRecalculated = this.homey.flow.getTriggerCard('subject_recalculated');
    this.triggerChangedZone = this.homey.flow.getTriggerCard('subject_changed_zone');

    this.triggerSubjectTypeEnteredZone = this.homey.flow.getTriggerCard('subject_type_entered_zone');
    this.triggerSubjectTypeEnteredZones = this.homey.flow.getTriggerCard('subject_type_entered_zones');
    this.triggerSubjectTypeLeftZone = this.homey.flow.getTriggerCard('subject_type_left_zone');
    this.triggerSubjectTypeLeftZones = this.homey.flow.getTriggerCard('subject_type_left_zones');
    this.triggerSubjectTypeRecalculated = this.homey.flow.getTriggerCard('subject_type_recalculated');
    this.triggerSubjectTypeChangedZone = this.homey.flow.getTriggerCard('subject_type_changed_zone');

    this.triggerAnySubjectEnteredZone = this.homey.flow.getTriggerCard('any_subject_entered_zone');
    this.triggerAnySubjectEnteredZones = this.homey.flow.getTriggerCard('any_subject_entered_zones');
    this.triggerAnySubjectLeftZone = this.homey.flow.getTriggerCard('any_subject_left_zone');
    this.triggerAnySubjectLeftZones = this.homey.flow.getTriggerCard('any_subject_left_zones');
    this.triggerAnySubjectRecalculated = this.homey.flow.getTriggerCard('any_subject_recalculated');
    this.triggerAnySubjectChangedZone = this.homey.flow.getTriggerCard('any_subject_changed_zone');
    this.triggerConfigChanged = this.homey.flow.getTriggerCard('config_changed');

    this.registerSubjectAutocomplete(this.triggerEnteredZone, 'subject');
    this.registerZoneAutocomplete(this.triggerEnteredZone, 'zone');
    this.registerSubjectAutocomplete(this.triggerEnteredZones, 'subject');
    this.registerSubjectAutocomplete(this.triggerLeftZone, 'subject');
    this.registerZoneAutocomplete(this.triggerLeftZone, 'zone');
    this.registerSubjectAutocomplete(this.triggerLeftZones, 'subject');
    this.registerSubjectAutocomplete(this.triggerPositionChanged, 'subject');
    this.registerSubjectAutocomplete(this.triggerRecalculated, 'subject');
    this.registerSubjectAutocomplete(this.triggerChangedZone, 'subject');
    this.registerZoneAutocomplete(this.triggerChangedZone, 'zone');

    this.registerSubjectTypeAutocomplete(this.triggerSubjectTypeEnteredZone, 'subjectType');
    this.registerZoneAutocomplete(this.triggerSubjectTypeEnteredZone, 'zone');
    this.registerSubjectTypeAutocomplete(this.triggerSubjectTypeEnteredZones, 'subjectType');
    this.registerSubjectTypeAutocomplete(this.triggerSubjectTypeLeftZone, 'subjectType');
    this.registerZoneAutocomplete(this.triggerSubjectTypeLeftZone, 'zone');
    this.registerSubjectTypeAutocomplete(this.triggerSubjectTypeLeftZones, 'subjectType');
    this.registerSubjectTypeAutocomplete(this.triggerSubjectTypeRecalculated, 'subjectType');
    this.registerSubjectTypeAutocomplete(this.triggerSubjectTypeChangedZone, 'subjectType');
    this.registerZoneAutocomplete(this.triggerSubjectTypeChangedZone, 'zone');
    this.registerZoneAutocomplete(this.triggerAnySubjectEnteredZone, 'zone');
    this.registerZoneAutocomplete(this.triggerAnySubjectLeftZone, 'zone');
    this.registerZoneAutocomplete(this.triggerAnySubjectChangedZone, 'zone');

    this.triggerEnteredZone.registerRunListener(async (args, state) => this.matchStateArg(args.subject, state.subject_name) && this.matchStateArg(args.zone, state.zone));
    this.triggerEnteredZones.registerRunListener(async (args, state) => this.matchStateArg(args.subject, state.subject_name) && this.matchAnyCsvArg(args.zones, [state.zone]));
    this.triggerLeftZone.registerRunListener(async (args, state) => this.matchStateArg(args.subject, state.subject_name) && this.matchStateArg(args.zone, state.zone));
    this.triggerLeftZones.registerRunListener(async (args, state) => this.matchStateArg(args.subject, state.subject_name) && this.matchAnyCsvArg(args.zones, [state.zone]));
    this.triggerPositionChanged.registerRunListener(async (args, state) => this.matchStateArg(args.subject, state.subject_name));
    this.triggerRecalculated.registerRunListener(async (args, state) => this.matchStateArg(args.subject, state.subject_name));
    this.triggerChangedZone.registerRunListener(async (args, state) => this.matchStateArg(args.subject, state.subject_name) && this.matchStateArg(args.zone, state.zone));

    this.triggerSubjectTypeEnteredZone.registerRunListener(async (args, state) => this.matchStateArg(args.subjectType, state.subject_type) && this.matchStateArg(args.zone, state.zone));
    this.triggerSubjectTypeEnteredZones.registerRunListener(async (args, state) => this.matchStateArg(args.subjectType, state.subject_type) && this.matchAnyCsvArg(args.zones, [state.zone]));
    this.triggerSubjectTypeLeftZone.registerRunListener(async (args, state) => this.matchStateArg(args.subjectType, state.subject_type) && this.matchStateArg(args.zone, state.zone));
    this.triggerSubjectTypeLeftZones.registerRunListener(async (args, state) => this.matchStateArg(args.subjectType, state.subject_type) && this.matchAnyCsvArg(args.zones, [state.zone]));
    this.triggerSubjectTypeRecalculated.registerRunListener(async (args, state) => this.matchStateArg(args.subjectType, state.subject_type));
    this.triggerSubjectTypeChangedZone.registerRunListener(async (args, state) => this.matchStateArg(args.subjectType, state.subject_type) && this.matchStateArg(args.zone, state.zone));
    this.triggerAnySubjectEnteredZone.registerRunListener(async (args, state) => this.matchStateArg(args.zone, state.zone));
    this.triggerAnySubjectEnteredZones.registerRunListener(async (args, state) => this.matchAnyCsvArg(args.zones, [state.zone]));
    this.triggerAnySubjectLeftZone.registerRunListener(async (args, state) => this.matchStateArg(args.zone, state.zone));
    this.triggerAnySubjectLeftZones.registerRunListener(async (args, state) => this.matchAnyCsvArg(args.zones, [state.zone]));
    this.triggerAnySubjectRecalculated.registerRunListener(async () => true);
    this.triggerAnySubjectChangedZone.registerRunListener(async (args, state) => this.matchStateArg(args.zone, state.zone));
    this.triggerConfigChanged.registerRunListener(async () => true);

    const subjectIsInZoneCard = this.homey.flow.getConditionCard('subject_is_in_zone');
    this.registerSubjectAutocomplete(subjectIsInZoneCard, 'subject');
    this.registerZoneAutocomplete(subjectIsInZoneCard, 'zone');
    subjectIsInZoneCard.registerRunListener(async (args) => {
      const subject = this.requireSubjectArg(args.subject);
      const state = getSubjectState(this.homey, subject.id);
      return this.zoneStateMatchesOne(state, [args.zone?.name || args.zone?.id || args.zone]);
    });

    const subjectIsInZonesCard = this.homey.flow.getConditionCard('subject_is_in_zones');
    this.registerSubjectAutocomplete(subjectIsInZonesCard, 'subject');
    subjectIsInZonesCard.registerRunListener(async (args) => {
      const subject = this.requireSubjectArg(args.subject);
      const state = getSubjectState(this.homey, subject.id);
      const zones = this.parseMultiValueArg(args.zones);
      if (!zones.length) throw new Error('At least one zone name is required');
      return this.zoneStateMatchesOne(state, zones);
    });

    const subjectIsOfTypeCard = this.homey.flow.getConditionCard('subject_is_of_type');
    this.registerSubjectAutocomplete(subjectIsOfTypeCard, 'subject');
    this.registerSubjectTypeAutocomplete(subjectIsOfTypeCard, 'subjectType');
    subjectIsOfTypeCard.registerRunListener(async (args) => {
      const subject = this.requireSubjectArg(args.subject);
      const state = getSubjectState(this.homey, subject.id);
      return normalizeKey(state?.subjectType) === normalizeKey(args.subjectType?.name || args.subjectType?.id || args.subjectType);
    });

    const subjectIsOfTypesCard = this.homey.flow.getConditionCard('subject_is_of_types');
    this.registerSubjectAutocomplete(subjectIsOfTypesCard, 'subject');
    subjectIsOfTypesCard.registerRunListener(async (args) => {
      const subject = this.requireSubjectArg(args.subject);
      const state = getSubjectState(this.homey, subject.id);
      const subjectTypes = this.parseMultiValueArg(args.subjectTypes).map(normalizeKey);
      if (!subjectTypes.length) throw new Error('At least one subject type is required');
      return subjectTypes.includes(normalizeKey(state?.subjectType));
    });

    const subjectIsMovementStateCard = this.homey.flow.getConditionCard('subject_is_movement_state');
    this.registerSubjectAutocomplete(subjectIsMovementStateCard, 'subject');
    subjectIsMovementStateCard.registerRunListener(async (args) => {
      const subject = this.requireSubjectArg(args.subject);
      const state = getSubjectState(this.homey, subject.id);
      const expectedStates = this.parseMultiValueArg(args.movementStates).map(normalizeKey);
      if (!expectedStates.length) return false;
      return expectedStates.includes(normalizeKey(state?.movementState || 'unknown'));
    });

    const zoneContainsSubjectCard = this.homey.flow.getConditionCard('zone_contains_subject');
    this.registerZoneAutocomplete(zoneContainsSubjectCard, 'zone');
    this.registerSubjectAutocomplete(zoneContainsSubjectCard, 'subject');
    zoneContainsSubjectCard.registerRunListener(async (args) => {
      const zone = this.requireZoneArg(args.zone);
      const subjectName = this.requireSubjectArg(args.subject).subject.name;
      return this.getSubjectsInZone(zone.id).some((subject) => normalizeKey(subject.name) === normalizeKey(subjectName));
    });

    const zoneContainsSubjectsCard = this.homey.flow.getConditionCard('zone_contains_subjects');
    this.registerZoneAutocomplete(zoneContainsSubjectsCard, 'zone');
    zoneContainsSubjectsCard.registerRunListener(async (args) => {
      const zone = this.requireZoneArg(args.zone);
      const subjectNames = this.parseMultiValueArg(args.subjects).map(normalizeKey);
      if (!subjectNames.length) return this.countSubjectsInZone(zone.id) > 0;
      return this.getSubjectsInZone(zone.id).some((subject) => subjectNames.includes(normalizeKey(subject.name)));
    });

    const zoneContainsSubjectTypeCard = this.homey.flow.getConditionCard('zone_contains_subject_type');
    this.registerZoneAutocomplete(zoneContainsSubjectTypeCard, 'zone');
    this.registerSubjectTypeAutocomplete(zoneContainsSubjectTypeCard, 'subjectType');
    zoneContainsSubjectTypeCard.registerRunListener(async (args) => {
      const zone = this.requireZoneArg(args.zone);
      const subjectType = normalizeKey(args.subjectType?.name || args.subjectType?.id || args.subjectType);
      if (!subjectType) throw new Error('Subject type is required');
      return this.countSubjectsInZone(zone.id, { subjectTypes: [subjectType] }) > 0;
    });

    const zoneContainsSubjectTypesCard = this.homey.flow.getConditionCard('zone_contains_subject_types');
    this.registerZoneAutocomplete(zoneContainsSubjectTypesCard, 'zone');
    zoneContainsSubjectTypesCard.registerRunListener(async (args) => {
      const zone = this.requireZoneArg(args.zone);
      const subjectTypes = this.parseMultiValueArg(args.subjectTypes).map(normalizeKey);
      if (!subjectTypes.length) throw new Error('At least one subject type is required');
      return this.countSubjectsInZone(zone.id, { subjectTypes }) > 0;
    });

    const zoneContainsOnlySubjectTypeCard = this.homey.flow.getConditionCard('zone_contains_only_subject_type');
    this.registerZoneAutocomplete(zoneContainsOnlySubjectTypeCard, 'zone');
    this.registerSubjectTypeAutocomplete(zoneContainsOnlySubjectTypeCard, 'subjectType');
    zoneContainsOnlySubjectTypeCard.registerRunListener(async (args) => {
      const zone = this.requireZoneArg(args.zone);
      const subjectType = normalizeKey(args.subjectType?.name || args.subjectType?.id || args.subjectType);
      const subjects = this.getSubjectsInZone(zone.id);
      if (!subjects.length || !subjectType) return false;
      return subjects.every((subject) => normalizeKey(subject.subjectType) === subjectType);
    });

    const zoneContainsOnlySubjectTypesCard = this.homey.flow.getConditionCard('zone_contains_only_subject_types');
    this.registerZoneAutocomplete(zoneContainsOnlySubjectTypesCard, 'zone');
    zoneContainsOnlySubjectTypesCard.registerRunListener(async (args) => {
      const zone = this.requireZoneArg(args.zone);
      const subjectTypes = this.parseMultiValueArg(args.subjectTypes).map(normalizeKey);
      const subjects = this.getSubjectsInZone(zone.id);
      if (!subjects.length || !subjectTypes.length) return false;
      return subjects.every((subject) => subjectTypes.includes(normalizeKey(subject.subjectType)));
    });

    const subjectExistsCard = this.homey.flow.getConditionCard('subject_exists');
    this.registerSubjectAutocomplete(subjectExistsCard, 'subject');
    subjectExistsCard.registerRunListener(async (args) => this.subjectExists(args.subject));

    const subjectsExistCard = this.homey.flow.getConditionCard('subjects_exist');
    subjectsExistCard.registerRunListener(async (args) => this.subjectExists(args.subjects));

    const zoneExistsCard = this.homey.flow.getConditionCard('zone_exists');
    this.registerZoneAutocomplete(zoneExistsCard, 'zone');
    zoneExistsCard.registerRunListener(async (args) => this.zoneExists(args.zone));

    const zonesExistCard = this.homey.flow.getConditionCard('zones_exist');
    zonesExistCard.registerRunListener(async (args) => this.zoneExists(args.zones));

    const tagExistsCard = this.homey.flow.getConditionCard('tag_exists');
    this.registerTagAutocomplete(tagExistsCard, 'tag');
    tagExistsCard.registerRunListener(async (args) => this.tagExists(args.tag));

    const tagsExistCard = this.homey.flow.getConditionCard('tags_exist');
    tagsExistCard.registerRunListener(async (args) => this.tagExists(args.tags));

    const subjectTypeExistsCard = this.homey.flow.getConditionCard('subject_type_exists');
    this.registerSubjectTypeAutocomplete(subjectTypeExistsCard, 'subjectType');
    subjectTypeExistsCard.registerRunListener(async (args) => this.subjectTypeExists(args.subjectType));

    const subjectTypesExistCard = this.homey.flow.getConditionCard('subject_types_exist');
    subjectTypesExistCard.registerRunListener(async (args) => this.subjectTypeExists(args.subjectTypes));

    const coordinatesMatchZoneCard = this.homey.flow.getConditionCard('coordinates_match_zone');
    this.registerZoneAutocomplete(coordinatesMatchZoneCard, 'zone');
    coordinatesMatchZoneCard.registerRunListener(async (args) => {
      const result = await this.evaluateCoordinatesOnly({ lat: args.lat, long: args.long });
      return this.zoneResultMatchesOne(result, [args.zone?.name || args.zone?.id || args.zone]);
    });

    const coordinatesMatchZonesCard = this.homey.flow.getConditionCard('coordinates_match_zones');
    coordinatesMatchZonesCard.registerRunListener(async (args) => {
      const result = await this.evaluateCoordinatesOnly({ lat: args.lat, long: args.long });
      const zones = this.parseMultiValueArg(args.zones);
      if (!zones.length) throw new Error('At least one zone name is required');
      return this.zoneResultMatchesOne(result, zones);
    });

    const coordinatesMatchTagCard = this.homey.flow.getConditionCard('coordinates_match_tag');
    this.registerTagAutocomplete(coordinatesMatchTagCard, 'tag');
    coordinatesMatchTagCard.registerRunListener(async (args) => {
      const result = await this.evaluateCoordinatesOnly({ lat: args.lat, long: args.long });
      const expectedTags = this.parseMultiValueArg(args.tag).map(normalizeKey);
      const actualTags = (result.tagsArray || []).map(normalizeKey);
      return expectedTags.some((tag) => actualTags.includes(tag));
    });

    const coordinatesMatchTagsCard = this.homey.flow.getConditionCard('coordinates_match_tags');
    coordinatesMatchTagsCard.registerRunListener(async (args) => {
      const result = await this.evaluateCoordinatesOnly({ lat: args.lat, long: args.long });
      const expectedTags = this.parseMultiValueArg(args.tags).map(normalizeKey);
      if (!expectedTags.length) throw new Error('At least one tag is required');
      const actualTags = (result.tagsArray || []).map(normalizeKey);
      return expectedTags.some((tag) => actualTags.includes(tag));
    });

    const evaluateCoordinatesCard = this.homey.flow.getActionCard('evaluate_coordinates');
    evaluateCoordinatesCard.registerRunListener(async (args) => {
      const result = await this.evaluateCoordinatesOnly({ lat: args.lat, long: args.long });
      return this.toFlowTokens(result, null);
    });

    const updateAndEvaluateSubjectPositionCard = this.homey.flow.getActionCard('update_and_evaluate_subject_position');
    this.registerSubjectAutocomplete(updateAndEvaluateSubjectPositionCard, 'subject');
    updateAndEvaluateSubjectPositionCard.registerRunListener(async (args) => {
      const subjectId = this.requireSubjectArg(args.subject).id;
      const result = await this.updateAndEvaluateSubjectPosition(subjectId, Number(args.lat), Number(args.long), 'flow:action:update_and_evaluate_subject_position');
      return this.toFlowTokens(result, null);
    });

    const evaluateSubjectPositionCard = this.homey.flow.getActionCard('evaluate_subject_position');
    this.registerSubjectAutocomplete(evaluateSubjectPositionCard, 'subject');
    evaluateSubjectPositionCard.registerRunListener(async (args) => {
      const subjectId = this.requireSubjectArg(args.subject).id;
      const result = await this.evaluateStoredSubjectPosition(subjectId, 'flow:action:evaluate_subject_position');
      return this.toFlowTokens(result, null);
    });

    const distanceSubjectSubjectCard = this.homey.flow.getActionCard('distance_subject_subject');
    this.registerSubjectAutocomplete(distanceSubjectSubjectCard, 'subjectA');
    this.registerSubjectAutocomplete(distanceSubjectSubjectCard, 'subjectB');
    distanceSubjectSubjectCard.registerRunListener(async (args) => {
      const subjectA = this.getRequiredSubjectState(this.requireSubjectArg(args.subjectA).id);
      const subjectB = this.getRequiredSubjectState(this.requireSubjectArg(args.subjectB).id);
      return { distance_m: haversineMeters(subjectA.lastLat, subjectA.lastLng, subjectB.lastLat, subjectB.lastLng) };
    });

    const distanceSubjectCoordinatesCard = this.homey.flow.getActionCard('distance_subject_coordinates');
    this.registerSubjectAutocomplete(distanceSubjectCoordinatesCard, 'subject');
    distanceSubjectCoordinatesCard.registerRunListener(async (args) => {
      const subject = this.getRequiredSubjectState(this.requireSubjectArg(args.subject).id);
      return { distance_m: haversineMeters(subject.lastLat, subject.lastLng, Number(args.lat), Number(args.long)) };
    });

    const distanceCoordinatesCoordinatesCard = this.homey.flow.getActionCard('distance_coordinates_coordinates');
    distanceCoordinatesCoordinatesCard.registerRunListener(async (args) => {
      return { distance_m: haversineMeters(Number(args.lat1), Number(args.long1), Number(args.lat2), Number(args.long2)) };
    });

    const distanceSubjectZoneCard = this.homey.flow.getActionCard('distance_subject_zone');
    this.registerSubjectAutocomplete(distanceSubjectZoneCard, 'subject');
    this.registerZoneAutocomplete(distanceSubjectZoneCard, 'zone');
    distanceSubjectZoneCard.registerRunListener(async (args) => {
      const subject = this.getRequiredSubjectState(this.requireSubjectArg(args.subject).id);
      const zone = this.requireZoneArg(args.zone);
      return { distance_m: this.getDistanceToZone(subject.lastLat, subject.lastLng, zone) };
    });

    const distanceCoordinatesZoneCard = this.homey.flow.getActionCard('distance_coordinates_zone');
    this.registerZoneAutocomplete(distanceCoordinatesZoneCard, 'zone');
    distanceCoordinatesZoneCard.registerRunListener(async (args) => {
      const zone = this.requireZoneArg(args.zone);
      return { distance_m: this.getDistanceToZone(Number(args.lat), Number(args.long), zone) };
    });

    const setSubjectTypeCard = this.homey.flow.getActionCard('set_subject_type');
    this.registerSubjectAutocomplete(setSubjectTypeCard, 'subject');
    setSubjectTypeCard.registerRunListener(async (args) => {
      const subjectId = this.requireSubjectArg(args.subject).id;
      const subjectType = cleanText(args.subjectType);
      if (!subjectType) throw new Error('Subject type is required');
      await setSubjectState(this.homey, subjectId, { subjectType });
      await this.triggerConfigChangedEvent('subject_type_changed');
      return {};
    });

    const renameSubjectCard = this.homey.flow.getActionCard('rename_subject');
    this.registerSubjectAutocomplete(renameSubjectCard, 'subject');
    renameSubjectCard.registerRunListener(async (args) => {
      const subjectId = this.requireSubjectArg(args.subject).id;
      const name = cleanText(args.name);
      if (!name) throw new Error('Name is required');
      await setSubjectState(this.homey, subjectId, { name });
      await this.triggerConfigChangedEvent('subject_renamed');
      return {};
    });

    const resetSubjectCard = this.homey.flow.getActionCard('reset_subject');
    this.registerSubjectAutocomplete(resetSubjectCard, 'subject');
    resetSubjectCard.registerRunListener(async (args) => {
      const subjectId = this.requireSubjectArg(args.subject).id;
      await resetSubjectState(this.homey, subjectId);
      await this.triggerConfigChangedEvent('subject_reset');
      return {};
    });

    const purgeSubjectsCard = this.homey.flow.getActionCard('purge_subjects');
    purgeSubjectsCard.registerRunListener(async (args) => {
      const days = Number(args.days);
      if (!Number.isFinite(days)) throw new Error('Days is required');
      const config = await purgeSubjects(this.homey, days);
      await this.triggerConfigChangedEvent('subjects_purged');
      return { remaining_subjects_count: Object.keys(config.subjects || {}).length };
    });

    const forceRecalculateSubjectCard = this.homey.flow.getActionCard('force_recalculate_subject');
    this.registerSubjectAutocomplete(forceRecalculateSubjectCard, 'subject');
    forceRecalculateSubjectCard.registerRunListener(async (args) => {
      const subjectId = this.requireSubjectArg(args.subject).id;
      const result = await this.evaluateStoredSubjectPosition(subjectId, 'flow:action:force_recalculate_subject');
      return this.toFlowTokens(result, null);
    });
  }
  registerSubjectAutocomplete(card, argName = 'subject') {
    card.registerArgumentAutocompleteListener(argName, async (query) => this.autocompleteSubjects(query));
  }

  registerZoneAutocomplete(card, argName = 'zone') {
    card.registerArgumentAutocompleteListener(argName, async (query) => this.autocompleteZones(query));
  }

  registerTagAutocomplete(card, argName = 'tag') {
    card.registerArgumentAutocompleteListener(argName, async (query) => this.autocompleteTags(query));
  }

  registerSubjectTypeAutocomplete(card, argName = 'subjectType') {
    card.registerArgumentAutocompleteListener(argName, async (query) => this.autocompleteSubjectTypes(query));
  }

  parseMultiValueArg(arg) {
    if (Array.isArray(arg)) {
      return [...new Set(arg.map((item) => cleanText(item?.id || item?.name || item)).filter(Boolean))];
    }
    if (arg && typeof arg === 'object') {
      const value = cleanText(arg.id || arg.name);
      return value ? [value] : [];
    }
    return [...new Set(String(arg || '').split(',').map((part) => cleanText(part)).filter(Boolean))];
  }

  async autocompleteSubjects(query) {
    const q = normalizeKey(query);
    return Object.values(getConfig(this.homey).subjects || {})
      .filter((subject) => !q || normalizeKey(subject.name).includes(q) || normalizeKey(subject.id).includes(q))
      .map((subject) => ({ id: subject.id, name: subject.name }));
  }

  async autocompleteZones(query) {
    const q = normalizeKey(query);
    return (getConfig(this.homey).zones || [])
      .filter((zone) => !q || normalizeKey(zone.name).includes(q) || normalizeKey(zone.id).includes(q))
      .map((zone) => ({ id: zone.id, name: zone.name }));
  }

  async autocompleteTags(query) {
    const q = normalizeKey(query);
    return getDerivedTags(getConfig(this.homey))
      .filter((tag) => !q || normalizeKey(tag).includes(q))
      .map((tag) => ({ id: tag, name: tag }));
  }

  async autocompleteSubjectTypes(query) {
    const q = normalizeKey(query);
    return getDerivedSubjectTypes(getConfig(this.homey))
      .filter((type) => !q || normalizeKey(type).includes(q))
      .map((type) => ({ id: type, name: type }));
  }


  zoneStateMatchesOne(state, expectedZones) {
    const zoneValues = expectedZones.map(normalizeKey).filter(Boolean);
    if (!zoneValues.length) return false;
    const actualZoneName = normalizeKey(state?.currentZoneName);
    return zoneValues.some((value) => value === actualZoneName);
  }

  zoneResultMatchesOne(result, expectedZones) {
    const zoneValues = expectedZones.map(normalizeKey).filter(Boolean);
    if (!zoneValues.length) return false;
    const actualZoneName = normalizeKey(result?.zone);
    return zoneValues.some((value) => value === actualZoneName);
  }

  matchAnyCsvArg(arg, candidates) {
    const expected = this.parseMultiValueArg(arg).map(normalizeKey);
    if (!expected.length) return false;
    const values = candidates.map((candidate) => normalizeKey(candidate));
    return expected.some((item) => values.includes(item));
  }

  matchStateArg(arg, value) {
    const candidates = [];
    if (arg && typeof arg === 'object') {
      if (cleanText(arg.name)) candidates.push(cleanText(arg.name));
      if (cleanText(arg.id)) candidates.push(cleanText(arg.id));
    } else if (cleanText(arg)) {
      candidates.push(cleanText(arg));
    }
    if (!candidates.length) return true;
    const actual = normalizeKey(value);
    return candidates.some((candidate) => normalizeKey(candidate) === actual);
  }

  findSubjectByFlowValue(value) {
    const expected = normalizeKey(cleanText(value));
    if (!expected) return null;
    return Object.values(getConfig(this.homey).subjects || {}).find((subject) => normalizeKey(subject.name) === expected || normalizeKey(subject.id) === expected) || null;
  }

  requireSubjectArg(arg) {
    const rawValue = cleanText(arg?.id || arg?.name || arg);
    if (!rawValue) throw new Error('Subject is required');
    const subject = this.findSubjectByFlowValue(rawValue);
    if (!subject) throw new Error(`Unknown subject: ${rawValue}. Check that the subject name exists in GeoZones settings.`);
    return { id: subject.id, subject };
  }

  getRequiredSubjectState(subjectId) {
    const subject = getSubjectState(this.homey, subjectId);
    if (!subject) throw new Error(`Unknown subject: ${subjectId}`);
    if (!Number.isFinite(Number(subject.lastLat)) || !Number.isFinite(Number(subject.lastLng))) {
      throw new Error(`Subject ${subjectId} has no stored coordinates`);
    }
    return subject;
  }

  findZoneByFlowValue(value) {
    const expected = normalizeKey(cleanText(value));
    if (!expected) return null;
    return (getConfig(this.homey).zones || []).find((zone) => normalizeKey(zone.name) === expected || normalizeKey(zone.id) === expected) || null;
  }

  requireZoneArg(arg) {
    const zoneValue = cleanText(arg?.name || arg?.id || arg);
    const zone = this.findZoneByFlowValue(zoneValue);
    if (!zone) throw new Error(`Unknown zone: ${zoneValue}`);
    return zone;
  }

  subjectExists(arg) {
    const values = this.parseMultiValueArg(arg);
    if (!values.length) return false;
    return values.every((value) => Boolean(this.findSubjectByFlowValue(value)));
  }

  zoneExists(arg) {
    const zoneNames = this.parseMultiValueArg(arg);
    if (!zoneNames.length) return false;
    return zoneNames.every((zoneName) => (getConfig(this.homey).zones || []).some((zone) => normalizeKey(zone.name) === normalizeKey(zoneName)));
  }

  tagExists(arg) {
    const tags = this.parseMultiValueArg(arg).map(normalizeKey);
    if (!tags.length) return false;
    const derived = getDerivedTags(getConfig(this.homey)).map(normalizeKey);
    return tags.every((tag) => derived.includes(tag));
  }

  subjectTypeExists(arg) {
    const subjectTypes = this.parseMultiValueArg(arg).map(normalizeKey);
    if (!subjectTypes.length) return false;
    const derived = getDerivedSubjectTypes(getConfig(this.homey)).map(normalizeKey);
    return subjectTypes.every((subjectType) => derived.includes(subjectType));
  }

  getSubjectsInZone(zoneId, options = {}) {
    const subjectTypes = (options.subjectTypes || []).map(normalizeKey);
    return Object.values(getConfig(this.homey).subjects || {}).filter((subject) => {
      if (cleanText(subject.currentZoneId) !== cleanText(zoneId)) return false;
      if (!subjectTypes.length) return true;
      return subjectTypes.includes(normalizeKey(subject.subjectType));
    });
  }

  countSubjectsInZone(zoneId, options = {}) {
    return this.getSubjectsInZone(zoneId, options).length;
  }

  toFlowTokens(result) {
    return {
      zone: result.zone || STATE_ZONE_NOT_DEFINED,
      previous_zone: result.previousZone || '',
      zone_tags: (result.tagsArray || []).join(','),
      found: Boolean(result.found),
      movement_state: result.movementState || 'unknown',
      speed_kmh: Number.isFinite(Number(result.speedKmh)) ? Number(result.speedKmh) : 0,
    };
  }

  getDistanceToZone(lat, long, zone) {
    if (zone.type === 'circle') {
      const centerDistance = haversineMeters(lat, long, zone.center.lat, zone.center.lng);
      return centerDistance <= Number(zone.radius || 0) ? 0 : Math.abs(centerDistance - Number(zone.radius || 0));
    }
    return pointInPolygon(lat, long, zone.paths || []) ? 0 : distanceToZoneBoundaryM(lat, long, zone);
  }

  async evaluateCoordinatesOnly({ lat, long }) {
    const config = getConfig(this.homey);
    return determineBestZone({ lat: Number(lat), long: Number(long), zones: config.zones, subjectState: null, useDelays: false });
  }

  async evaluateStoredSubjectPosition(subjectId, scope = 'evaluate-stored-subject') {
    const state = this.getRequiredSubjectState(subjectId);
    const result = determineBestZone({ lat: state.lastLat, long: state.lastLng, zones: getConfig(this.homey).zones, subjectState: state, useDelays: true });
    result.speedKmh = Number.isFinite(Number(state.speedKmh)) ? Number(state.speedKmh) : 0;
    result.nextSubjectState = {
      ...result.nextSubjectState,
      speedKmh: result.speedKmh,
    };
    await setSubjectState(this.homey, subjectId, result.nextSubjectState, { pushHistory: false });
    await this.triggerSubjectRecalculated(subjectId, result, false, scope);
    return result;
  }

  async updateAndEvaluateSubjectPosition(subjectId, lat, long, scope = 'update-subject-position') {
    const previousState = getSubjectState(this.homey, subjectId) || { id: subjectId, name: subjectId, minMoveDistanceM: 0, speedKmh: 0 };
    const previousLat = Number(previousState.lastLat);
    const previousLng = Number(previousState.lastLng);
    const previousTimestampMs = Date.parse(previousState.lastTimestamp || '');
    const threshold = Number(previousState.minMoveDistanceM || 0);
    const hasCurrentZone = cleanText(previousState.currentZoneId || previousState.currentZoneName || '') !== '';
    const hasPreviousZoneHistory = normalizeKey(previousState.previousZoneName || '') !== normalizeKey(STATE_ZONE_UNKNOWN);
    const isInitialPlaceholderPosition = Number.isFinite(previousLat) && Number.isFinite(previousLng)
      && previousLat === 0 && previousLng === 0
      && !hasCurrentZone
      && !hasPreviousZoneHistory;

    const hasPreviousPosition = Number.isFinite(previousLat) && Number.isFinite(previousLng) && !isInitialPlaceholderPosition;
    const distanceSinceLastM = hasPreviousPosition
      ? haversineMeters(previousLat, previousLng, lat, long)
      : null;

    let speedKmh = Number.isFinite(Number(previousState.speedKmh)) ? Number(previousState.speedKmh) : 0;
    if (hasPreviousPosition && Number.isFinite(previousTimestampMs)) {
      const elapsedMs = Date.now() - previousTimestampMs;
      if (elapsedMs > 0 && distanceSinceLastM !== null) {
        speedKmh = (distanceSinceLastM / (elapsedMs / 1000)) * 3.6;
      }
    } else if (!hasPreviousPosition) {
      speedKmh = 0;
    }

    if (distanceSinceLastM !== null && distanceSinceLastM < threshold) {
      log(this.homey, scope, `Skipped update for ${subjectId} below threshold ${threshold}m`, { distanceSinceLastM });
      const skippedResult = determineBestZone({ lat: previousState.lastLat, long: previousState.lastLng, zones: getConfig(this.homey).zones, subjectState: previousState, useDelays: true });
      skippedResult.speedKmh = Number.isFinite(Number(previousState.speedKmh)) ? Number(previousState.speedKmh) : 0;
      skippedResult.nextSubjectState = {
        ...skippedResult.nextSubjectState,
        speedKmh: skippedResult.speedKmh,
      };
      return skippedResult;
    }

    const subjectState = { ...previousState, id: subjectId };
    const result = determineBestZone({ lat, long, zones: getConfig(this.homey).zones, subjectState, useDelays: true });
    result.speedKmh = Number.isFinite(speedKmh) && speedKmh >= 0 ? speedKmh : 0;
    result.nextSubjectState = {
      ...result.nextSubjectState,
      speedKmh: result.speedKmh,
    };
    await setSubjectState(this.homey, subjectId, result.nextSubjectState, { pushHistory: false });
    await this.triggerSubjectRecalculated(subjectId, result, distanceSinceLastM === null || distanceSinceLastM >= threshold, scope);
    return result;
  }

  async triggerSubjectRecalculated(subjectId, result, allowPositionChange = false, source = 'recalculated') {
    const subjectState = getSubjectState(this.homey, subjectId) || {};
    const subjectName = cleanText(subjectState.name || subjectId);
    const subjectType = cleanText(subjectState.subjectType || '');
    const currentZoneKey = normalizeKey(result.zoneId || result.zone);
    const oldCurrentZoneKey = normalizeKey(result.oldCurrentZoneId || result.oldCurrentZone);

    const baseTokens = {
      zone: result.zone || STATE_ZONE_NOT_DEFINED,
      previous_zone: result.previousZone || '',
      zone_tags: (result.tagsArray || []).join(','),
      movement_state: result.movementState || 'unknown',
      speed_kmh: Number.isFinite(Number(result.speedKmh)) ? Number(result.speedKmh) : 0,
      subject_name: subjectName,
      subject_type: subjectType,
    };

    await this.triggerRecalculated.trigger({
      zone: baseTokens.zone,
      previous_zone: baseTokens.previous_zone,
      zone_tags: baseTokens.zone_tags,
      movement_state: baseTokens.movement_state,
      speed_kmh: baseTokens.speed_kmh,
    }, { subject_name: subjectName }).catch((error) => logError(this.homey, 'flow:trigger:subject_recalculated', error, { source }));

    await this.triggerAnySubjectRecalculated.trigger(baseTokens, {
      subject_name: subjectName,
      subject_type: subjectType,
    }).catch((error) => logError(this.homey, 'flow:trigger:any_subject_recalculated', error, { source }));

    if (subjectType) {
      await this.triggerSubjectTypeRecalculated.trigger(baseTokens, {
        subject_name: subjectName,
        subject_type: subjectType,
      }).catch((error) => logError(this.homey, 'flow:trigger:subject_type_recalculated', error, { source }));
    }

    if (allowPositionChange) {
      await this.triggerPositionChanged.trigger({
        zone: baseTokens.zone,
        previous_zone: baseTokens.previous_zone,
        zone_tags: baseTokens.zone_tags,
        movement_state: baseTokens.movement_state,
        speed_kmh: baseTokens.speed_kmh,
      }, { subject_name: subjectName }).catch((error) => logError(this.homey, 'flow:trigger:subject_position_changed', error));
    }

    if (currentZoneKey && currentZoneKey !== normalizeKey(STATE_ZONE_NOT_DEFINED) && currentZoneKey !== oldCurrentZoneKey) {
      const enteredTokens = {
        zone: result.zone,
        previous_zone: result.previousZone || '',
        zone_tags: (result.tagsArray || []).join(','),
        subject_name: subjectName,
        subject_type: subjectType,
        speed_kmh: baseTokens.speed_kmh,
      };
      await this.triggerEnteredZone.trigger({
        zone: enteredTokens.zone,
        previous_zone: enteredTokens.previous_zone,
        zone_tags: enteredTokens.zone_tags,
        speed_kmh: enteredTokens.speed_kmh,
      }, { subject_name: subjectName, zone: result.zone }).catch((error) => logError(this.homey, 'flow:trigger:subject_entered_zone', error));
      await this.triggerEnteredZones.trigger({
        zone: enteredTokens.zone,
        previous_zone: enteredTokens.previous_zone,
        zone_tags: enteredTokens.zone_tags,
        speed_kmh: enteredTokens.speed_kmh,
      }, { subject_name: subjectName, zone: result.zone }).catch((error) => logError(this.homey, 'flow:trigger:subject_entered_zones', error));
      await this.triggerAnySubjectEnteredZone.trigger(enteredTokens, { zone: result.zone }).catch((error) => logError(this.homey, 'flow:trigger:any_subject_entered_zone', error));
      await this.triggerAnySubjectEnteredZones.trigger(enteredTokens, { zone: result.zone }).catch((error) => logError(this.homey, 'flow:trigger:any_subject_entered_zones', error));
      if (subjectType) {
        await this.triggerSubjectTypeEnteredZone.trigger(enteredTokens, { subject_type: subjectType, zone: result.zone }).catch((error) => logError(this.homey, 'flow:trigger:subject_type_entered_zone', error));
        await this.triggerSubjectTypeEnteredZones.trigger(enteredTokens, { subject_type: subjectType, zone: result.zone }).catch((error) => logError(this.homey, 'flow:trigger:subject_type_entered_zones', error));
      }
    }

    if (oldCurrentZoneKey && oldCurrentZoneKey !== normalizeKey(STATE_ZONE_UNKNOWN) && oldCurrentZoneKey !== normalizeKey(STATE_ZONE_NOT_DEFINED) && oldCurrentZoneKey !== currentZoneKey) {
      const leftTokens = {
        zone: result.oldCurrentZone,
        previous_zone: result.oldPreviousZone || '',
        zone_tags: (result.oldCurrentTags || []).join(','),
        subject_name: subjectName,
        subject_type: subjectType,
        speed_kmh: baseTokens.speed_kmh,
      };
      await this.triggerLeftZone.trigger({
        zone: leftTokens.zone,
        previous_zone: leftTokens.previous_zone,
        zone_tags: leftTokens.zone_tags,
        speed_kmh: leftTokens.speed_kmh,
      }, { subject_name: subjectName, zone: result.oldCurrentZone }).catch((error) => logError(this.homey, 'flow:trigger:subject_left_zone', error));
      await this.triggerLeftZones.trigger({
        zone: leftTokens.zone,
        previous_zone: leftTokens.previous_zone,
        zone_tags: leftTokens.zone_tags,
        speed_kmh: leftTokens.speed_kmh,
      }, { subject_name: subjectName, zone: result.oldCurrentZone }).catch((error) => logError(this.homey, 'flow:trigger:subject_left_zones', error));
      await this.triggerAnySubjectLeftZone.trigger(leftTokens, { zone: result.oldCurrentZone }).catch((error) => logError(this.homey, 'flow:trigger:any_subject_left_zone', error));
      await this.triggerAnySubjectLeftZones.trigger(leftTokens, { zone: result.oldCurrentZone }).catch((error) => logError(this.homey, 'flow:trigger:any_subject_left_zones', error));
      if (subjectType) {
        await this.triggerSubjectTypeLeftZone.trigger(leftTokens, { subject_type: subjectType, zone: result.oldCurrentZone }).catch((error) => logError(this.homey, 'flow:trigger:subject_type_left_zone', error));
        await this.triggerSubjectTypeLeftZones.trigger(leftTokens, { subject_type: subjectType, zone: result.oldCurrentZone }).catch((error) => logError(this.homey, 'flow:trigger:subject_type_left_zones', error));
      }
    }

    if (currentZoneKey && currentZoneKey !== normalizeKey(STATE_ZONE_NOT_DEFINED) && oldCurrentZoneKey && oldCurrentZoneKey !== normalizeKey(STATE_ZONE_UNKNOWN) && oldCurrentZoneKey !== normalizeKey(STATE_ZONE_NOT_DEFINED) && currentZoneKey !== oldCurrentZoneKey) {
      const changedTokens = {
        zone: result.zone,
        previous_zone: result.oldCurrentZone || '',
        zone_tags: (result.tagsArray || []).join(','),
        subject_name: subjectName,
        subject_type: subjectType,
        speed_kmh: baseTokens.speed_kmh,
      };
      await this.triggerChangedZone.trigger({
        zone: changedTokens.zone,
        previous_zone: changedTokens.previous_zone,
        zone_tags: changedTokens.zone_tags,
        speed_kmh: changedTokens.speed_kmh,
      }, { subject_name: subjectName, zone: result.zone }).catch((error) => logError(this.homey, 'flow:trigger:subject_changed_zone', error));
      await this.triggerAnySubjectChangedZone.trigger(changedTokens, { zone: result.zone }).catch((error) => logError(this.homey, 'flow:trigger:any_subject_changed_zone', error));
      if (subjectType) {
        await this.triggerSubjectTypeChangedZone.trigger(changedTokens, { subject_type: subjectType, zone: result.zone }).catch((error) => logError(this.homey, 'flow:trigger:subject_type_changed_zone', error));
      }
    }
  }

  async triggerConfigChangedEvent(changeScope = 'config_changed') {
    if (!this.triggerConfigChanged) return;
    await this.triggerConfigChanged.trigger({ change_scope: cleanText(changeScope || 'config_changed') }, {}).catch((error) => logError(this.homey, 'flow:trigger:config_changed', error));
  }

  async addZone(rawZone) {
    const zone = sanitizeZone(rawZone);
    const config = getConfig(this.homey);
    const existingNames = (config.zones || []).map((item) => item.name);
    validateZone(zone, existingNames);
    await updateConfig(this.homey, (currentConfig) => {
      if ((currentConfig.zones || []).some((item) => normalizeKey(item.name) === normalizeKey(zone.name))) {
        throw new Error(`Zone "${zone.name}" already exists`);
      }
      currentConfig.zones.push(zone);
      return currentConfig;
    });
    await this.triggerConfigChangedEvent('zone_added');
    return zone;
  }
}

module.exports = GeoZonesApp;
