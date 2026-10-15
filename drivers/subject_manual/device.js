'use strict';

const Homey = require('homey');
const {
  ensureCapabilities,
  syncCommonCapabilityMirrors,
  getCommonSettings,
  updatePositionAndEvaluate,
  evaluateStoredPosition,
  setEnabled,
  setMinMoveDistance,
  clearRuntimeState,
  applyCommonSettings,
  initializeSubjectRuntime,
  disposeSubjectRuntime,
} = require('../../lib/subject-device');
const { restoreMigratedSubject } = require('../../lib/migration');

class SubjectManualDevice extends Homey.Device {
  async onInit() {
    await ensureCapabilities(this, false);
    await restoreMigratedSubject(this);
    await syncCommonCapabilityMirrors(this);
    const currentName = this.getName();
    const previousName = this.getStoreValue('lastKnownName');
    if (previousName && previousName !== currentName) {
      await this.homey.app.renameSubjectInZoneFilters(previousName, currentName);
    }
    await this.setStoreValue('lastKnownName', currentName);
    await this.homey.app.syncSubjectNameWarnings();
    await initializeSubjectRuntime(this);
  }

  async onRenamed(name) {
    const previousName = this.getStoreValue('lastKnownName') || this.getName();
    await this.homey.app.handleSubjectRenamed(this, previousName, name);
  }

  async onSettings({ newSettings, changedKeys }) {
    if (changedKeys.includes('subjectType') || changedKeys.includes('enabled') || changedKeys.includes('minMoveDistanceM')) {
      await applyCommonSettings(this, newSettings);
    }
  }

  async onDeleted() {
    await disposeSubjectRuntime(this);
    await this.homey.app.removeSubjectFromZoneFilters(this.getName());
    await this.homey.app.syncSubjectNameWarnings();
  }

  async evaluateCurrentPosition(source = 'manual:evaluate') {
    return evaluateStoredPosition(this, source);
  }

  async updatePositionAndEvaluateAction(lat, lng, source = 'manual') {
    return updatePositionAndEvaluate(this, lat, lng, source);
  }

  async setEnabledState(enabledState) {
    return setEnabled(this, enabledState);
  }

  async setMinMoveDistanceAction(distance) {
    return setMinMoveDistance(this, distance);
  }

  async clearRuntimeState(reason = 'disabled') {
    return clearRuntimeState(this, reason, { preserveCoordinates: true });
  }
}

module.exports = SubjectManualDevice;
