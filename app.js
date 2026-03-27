'use strict';

const Homey = require('homey');
const { getConfig, getSubjectState, setSubjectState, updateConfig, sanitizeZone, validateZone } = require('./lib/store');
const { determineBestZone, determineChangedEntries, getStateValues, STATE_ZONE_NOT_DEFINED, STATE_ZONE_UNKNOWN, STATE_ZONE_ERROR } = require('./lib/zone-engine');
const { haversineMeters, pointInPolygon, distanceToZoneBoundaryM } = require('./lib/geo');
const { cleanText, uniqueCaseSensitive, randomZoneColor, normalizeBoolean } = require('./lib/utils');
const { log, logError, isHeavyDebugEnabled } = require('./lib/logger');

class GeoZonesApp extends Homey.App {
  async onInit() {
    log(this.homey, 'app', `GeoZones v${this.homey.manifest.version} started`, { heavyDebug: isHeavyDebugEnabled(this.homey) });
    this.registerFlowCards();
  }

  registerFlowCards() {
    this.subjectChangedTrigger = this.homey.flow.getTriggerCard('subject_value_changed');
    this.subjectEnteredTrigger = this.homey.flow.getTriggerCard('subject_entered_value');
    this.subjectLeftTrigger = this.homey.flow.getTriggerCard('subject_left_value');

    this.subjectChangedTrigger.registerRunListener(async (args, state) => this.matchesChangedTrigger(args, state));
    this.subjectEnteredTrigger.registerRunListener(async (args, state) => this.matchesValueTrigger(args, state));
    this.subjectLeftTrigger.registerRunListener(async (args, state) => this.matchesValueTrigger(args, state));

    const evaluateCard = this.homey.flow.getActionCard('evaluate_position');
    evaluateCard.registerRunListener(async (args) => {
      const result = await this.evaluateCoordinates(args, true, 'flow:action:evaluate_position');
      return this.mapEvaluateTokens(result, this.resolveTextArg(args.subjectId));
    });

    const calculateDistanceCard = this.homey.flow.getActionCard('calculate_distance');
    calculateDistanceCard.registerRunListener(async (args) => {
      const distanceM = haversineMeters(Number(args.lat1), Number(args.long1), Number(args.lat2), Number(args.long2));
      return { distance_m: distanceM, distance_km: distanceM / 1000 };
    });

    const distanceToZoneCard = this.homey.flow.getActionCard('distance_to_zone');
    distanceToZoneCard.registerRunListener(async (args) => {
      const zone = this.getZoneByName(this.resolveTextArg(args.zone));
      if (!zone) throw new Error(`Unknown zone: ${this.resolveTextArg(args.zone)}`);
      const distanceM = this.getDistanceToZone(Number(args.lat), Number(args.long), zone);
      return {
        zone: zone.name,
        distance_m: distanceM,
        distance_km: distanceM / 1000,
        inside: distanceM === 0,
        type: zone.type,
      };
    });

    const addZoneJsonCard = this.homey.flow.getActionCard('add_zone_json');
    addZoneJsonCard.registerRunListener(async (args) => {
      const raw = JSON.parse(String(args.zone_json || '{}'));
      await this.addZone(raw);
      return { zone: cleanText(raw.name) };
    });

    const createCircleCard = this.homey.flow.getActionCard('create_circle_zone');
    createCircleCard.registerRunListener(async (args) => {
      const zone = {
        name: this.resolveTextArg(args.name),
        type: 'circle',
        center: { lat: Number(args.lat), lng: Number(args.long) },
        radius: Number(args.radius),
        hysteresis: Number.isFinite(Number(args.hysteresis)) ? Number(args.hysteresis) : 0,
        color: cleanText(args.color) || randomZoneColor(),
        active: normalizeBoolean(args.active, true),
        priority: Number.isFinite(Number(args.priority)) ? Number(args.priority) : 0,
        groups: uniqueCaseSensitive([args.group_1, args.group_2, args.group_3]),
        categories: uniqueCaseSensitive([args.category_1, args.category_2, args.category_3]),
      };
      await this.addZone(zone);
      return { zone: zone.name };
    });

    const setZoneActiveCard = this.homey.flow.getActionCard('set_zone_active');
    setZoneActiveCard.registerRunListener(async (args) => {
      const zoneName = this.resolveTextArg(args.zone);
      const active = normalizeBoolean(args.active, true);
      await updateConfig(this.homey, config => {
        const zone = (config.zones || []).find(item => cleanText(item.name) === zoneName);
        if (!zone) throw new Error(`Unknown zone: ${zoneName}`);
        zone.active = active;
        return config;
      });
      return { zone: zoneName, active };
    });

    const existsCard = this.homey.flow.getConditionCard('value_exists');
    existsCard.registerRunListener(async (args) => this.valueExists(args));

    const subjectInValueCard = this.homey.flow.getConditionCard('subject_in_value');
    subjectInValueCard.registerRunListener(async (args) => this.subjectInValue(args));

    const coordsMatchCard = this.homey.flow.getConditionCard('coords_match_value');
    coordsMatchCard.registerRunListener(async (args) => this.coordsMatchValue(args));
  }

  resolveTextArg(value) {
    return cleanText(value);
  }

  getZoneByName(name) {
    const target = cleanText(name);
    return getConfig(this.homey).zones.find(zone => cleanText(zone.name) === target) || null;
  }

  mapEvaluateTokens(result, subjectId) {
    return {
      zone: result.zone || STATE_ZONE_NOT_DEFINED,
      groups: result.groups || STATE_ZONE_NOT_DEFINED,
      categories: result.categories || STATE_ZONE_NOT_DEFINED,
      previous_zone: result.previousZone || STATE_ZONE_UNKNOWN,
      previous_groups: result.previousGroups || STATE_ZONE_NOT_DEFINED,
      previous_categories: result.previousCategories || STATE_ZONE_NOT_DEFINED,
      type: result.type || '',
      found: result.found,
      zone_changed: Boolean(subjectId) && result.zoneChanged,
      group_changed: Boolean(subjectId) && result.groupChanged,
      category_changed: Boolean(subjectId) && result.categoryChanged,
      speed_kmh: Number.isFinite(result.speedKmh) ? result.speedKmh : 0,
      distance_since_last_m: Number.isFinite(result.distanceSinceLastM) ? result.distanceSinceLastM : 0,
      time_delta_s: Number.isFinite(result.timeDeltaS) ? result.timeDeltaS : 0,
    };
  }

  async addZone(rawZone) {
    const zone = sanitizeZone(rawZone);
    const config = getConfig(this.homey);
    const existingNames = (config.zones || []).map(item => cleanText(item.name)).filter(Boolean);
    validateZone(zone, existingNames);
    await updateConfig(this.homey, currentConfig => {
      const exists = (currentConfig.zones || []).some(item => cleanText(item.name) === cleanText(zone.name));
      if (exists) throw new Error(`Zone \"${zone.name}\" already exists`);
      currentConfig.zones.push(zone);
      return currentConfig;
    });
  }

  async valueExists(args) {
    const type = this.resolveTextArg(args.type);
    const value = this.resolveTextArg(args.value);
    const config = getConfig(this.homey);
    if (!value) return false;
    if (type === 'zone') return (config.zones || []).some(zone => cleanText(zone.name) === value);
    if (type === 'group') return (config.groups || []).includes(value);
    if (type === 'category') return (config.categories || []).includes(value);
    if (type === 'subject') return Object.prototype.hasOwnProperty.call(config.subjects || {}, value);
    return false;
  }

  async subjectInValue(args) {
    const subjectId = this.resolveTextArg(args.subjectId);
    const type = this.resolveTextArg(args.type);
    const value = this.resolveTextArg(args.value);
    const subjectState = subjectId ? getSubjectState(this.homey, subjectId) : null;
    const values = getStateValues(type, subjectState);
    if (type === 'zone') return (values[0] || STATE_ZONE_UNKNOWN) === value;
    return values.includes(value);
  }

  async coordsMatchValue(args) {
    const persistState = normalizeBoolean(args.updateState, false);
    const result = await this.evaluateCoordinates({ lat: args.lat, long: args.long, subjectId: args.subjectId }, persistState, 'flow:condition:coords_match_value');
    const type = this.resolveTextArg(args.type);
    const value = this.resolveTextArg(args.value);
    if (type === 'zone') return cleanText(result.zone) === value;
    if (type === 'group') return result.best?.zone?.groups?.includes(value) || false;
    if (type === 'category') return result.best?.zone?.categories?.includes(value) || false;
    return false;
  }

  matchesChangedTrigger(args, state) {
    return this.resolveTextArg(args.subjectId) === cleanText(state.subjectId)
      && this.resolveTextArg(args.type) === cleanText(state.type);
  }

  matchesValueTrigger(args, state) {
    return this.resolveTextArg(args.subjectId) === cleanText(state.subjectId)
      && this.resolveTextArg(args.type) === cleanText(state.type)
      && this.resolveTextArg(args.value) === cleanText(state.value);
  }

  getDistanceToZone(lat, long, zone) {
    if (!zone) return Infinity;
    if (zone.type === 'circle') {
      const centerDistance = haversineMeters(lat, long, zone.center.lat, zone.center.lng);
      return centerDistance <= Number(zone.radius || 0) ? 0 : Math.abs(centerDistance - Number(zone.radius || 0));
    }
    if (zone.type === 'polygon') {
      return pointInPolygon(lat, long, zone.paths || []) ? 0 : distanceToZoneBoundaryM(lat, long, zone);
    }
    return Infinity;
  }

  async triggerSubjectStateEvents(subjectId, result, source = STATE_ZONE_UNKNOWN) {
    const cleanSubjectId = cleanText(subjectId);
    if (!cleanSubjectId) return;

    const baseTokens = {
      subject_id: cleanSubjectId,
      zone: result.zone || STATE_ZONE_NOT_DEFINED,
      groups: result.groups || STATE_ZONE_NOT_DEFINED,
      categories: result.categories || STATE_ZONE_NOT_DEFINED,
      previous_zone: result.previousZone || STATE_ZONE_UNKNOWN,
      previous_groups: result.previousGroups || STATE_ZONE_NOT_DEFINED,
      previous_categories: result.previousCategories || STATE_ZONE_NOT_DEFINED,
    };

    for (const type of ['zone', 'group', 'category']) {
      const changed = determineChangedEntries(type, result);
      if (!changed.changed) continue;

      const currentValue = type === 'zone'
        ? (result.zone || STATE_ZONE_NOT_DEFINED)
        : (type === 'group' ? (result.groups || STATE_ZONE_NOT_DEFINED) : (result.categories || STATE_ZONE_NOT_DEFINED));
      const previousValue = type === 'zone'
        ? (result.previousZone || STATE_ZONE_UNKNOWN)
        : (type === 'group' ? (result.previousGroups || STATE_ZONE_NOT_DEFINED) : (result.previousCategories || STATE_ZONE_NOT_DEFINED));

      await this.subjectChangedTrigger.trigger({
        ...baseTokens,
        type,
        value: currentValue,
        previous_value: previousValue,
      }, { subjectId: cleanSubjectId, type }).catch(error => logError(this.homey, 'flow:trigger:changed', error, { subjectId: cleanSubjectId, type, source }));

      for (const value of changed.entered) {
        await this.subjectEnteredTrigger.trigger({
          ...baseTokens,
          type,
          value,
          previous_value: previousValue,
        }, { subjectId: cleanSubjectId, type, value }).catch(error => logError(this.homey, 'flow:trigger:entered', error, { subjectId: cleanSubjectId, type, value, source }));
      }

      for (const value of changed.left) {
        await this.subjectLeftTrigger.trigger({
          ...baseTokens,
          type,
          value,
          previous_value: previousValue,
        }, { subjectId: cleanSubjectId, type, value }).catch(error => logError(this.homey, 'flow:trigger:left', error, { subjectId: cleanSubjectId, type, value, source }));
      }
    }
  }

  async evaluateCoordinates({ lat, long, subjectId }, persistState = true, scope = 'evaluate') {
    const cleanSubjectId = this.resolveTextArg(subjectId);
    const numericLat = Number(lat);
    const numericLong = Number(long);
    const config = getConfig(this.homey);
    const previousState = cleanSubjectId ? getSubjectState(this.homey, cleanSubjectId) : null;

    log(this.homey, scope, `Start lat=${numericLat}, long=${numericLong}, subject=${cleanSubjectId || STATE_ZONE_UNKNOWN}, persist=${persistState}`, {
      subjectState: previousState,
      zonesCount: Array.isArray(config.zones) ? config.zones.length : 0,
      activeZonesCount: Array.isArray(config.zones) ? config.zones.filter(zone => zone.active !== false).length : 0,
    });

    try {
      const result = determineBestZone({
        lat: numericLat,
        long: numericLong,
        zones: config.zones,
        subjectState: previousState,
      });

      if (persistState && cleanSubjectId) {
        await setSubjectState(this.homey, cleanSubjectId, result.nextSubjectState);
        await this.triggerSubjectStateEvents(cleanSubjectId, result, scope);
      }

      log(this.homey, scope, `Result found=${result.found} zone=${result.zone || STATE_ZONE_NOT_DEFINED} groups=${result.groups || STATE_ZONE_NOT_DEFINED} categories=${result.categories || STATE_ZONE_NOT_DEFINED}`, {
        input: { lat: numericLat, long: numericLong, subjectId: cleanSubjectId || '' },
        persisted: Boolean(persistState && cleanSubjectId),
        previousState,
        nextSubjectState: result.nextSubjectState,
        speedKmh: result.speedKmh,
        distanceSinceLastM: result.distanceSinceLastM,
        timeDeltaS: result.timeDeltaS,
        best: result.best ? {
          zone: result.best.zone.name,
          type: result.best.zone.type,
          priority: result.best.zone.priority || 0,
          areaM2: result.best.areaM2,
          detail: result.best.detail,
        } : null,
        candidates: result.candidates.map(candidate => ({
          zone: candidate.zone.name,
          priority: candidate.zone.priority || 0,
          areaM2: candidate.areaM2,
          detail: candidate.detail,
        })),
        logs: result.logs,
      });

      return result;
    } catch (error) {
      if (persistState && cleanSubjectId) {
        const errorState = {
          currentZone: STATE_ZONE_ERROR,
          currentGroups: [],
          currentCategories: [],
          lastLat: Number.isFinite(numericLat) ? numericLat : null,
          lastLng: Number.isFinite(numericLong) ? numericLong : null,
          lastTimestamp: new Date().toISOString(),
        };
        await setSubjectState(this.homey, cleanSubjectId, errorState);
        await this.triggerSubjectStateEvents(cleanSubjectId, {
          zone: STATE_ZONE_ERROR,
          groups: STATE_ZONE_NOT_DEFINED,
          categories: STATE_ZONE_NOT_DEFINED,
          previousZone: previousState?.currentZone || STATE_ZONE_UNKNOWN,
          previousGroups: (previousState?.currentGroups || []).join(', ') || STATE_ZONE_NOT_DEFINED,
          previousCategories: (previousState?.currentCategories || []).join(', ') || STATE_ZONE_NOT_DEFINED,
          previousGroupsArray: previousState?.currentGroups || [],
          previousCategoriesArray: previousState?.currentCategories || [],
          best: null,
          candidates: [],
          logs: [],
        }, `${scope}:error`);
      }

      logError(this.homey, scope, error, {
        input: { lat: numericLat, long: numericLong, subjectId: cleanSubjectId || '' },
        persistState,
        previousState,
      });
      throw error;
    }
  }
}

module.exports = GeoZonesApp;
