'use strict';

const Homey = require('homey');
const { cleanText } = require('../../lib/utils');
const { log } = require('../../lib/logger');
const { migrateLegacySettings, getMigrationStatus, createRecoveredSubject } = require('../../lib/migration');

class SubjectManualDriver extends Homey.Driver {
  async onInit() {
log(this.homey, 'manual-driver', 'Subject manual driver initialized');
  }

  async onPair(session) {
    session.setHandler('list_legacy_subjects', async () => {
      await migrateLegacySettings(this.homey);
      const pairedIds = new Set(this.getDevices().map(device => device.getData().id));
      return getMigrationStatus(this.homey).pendingSubjects.filter(subject => !pairedIds.has(subject.id));
    });
    session.setHandler('recover_legacy_subject', async data => {
      const id = cleanText(data?.id);
      if (this.getDevices().some(device => device.getData().id === id)) throw new Error('This legacy subject is already paired. Restart GeoZones to retry restoring its state.');
      return createRecoveredSubject(this.homey, id, cleanText(data?.name));
    });
    session.setHandler('create_manual_subject', async data => {
      const name = cleanText(data?.name);
      await this.homey.app.ensureSubjectNameAvailable(name);
      return {
        name,
        data: { id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` },
        settings: {
          subjectType: cleanText(data?.subjectType || ''),
          enabled: data?.enabled !== false,
          minMoveDistanceM: Number.isFinite(Number(data?.minMoveDistanceM)) ? Number(data.minMoveDistanceM) : 0,
        },
      };
    });
  }
}

module.exports = SubjectManualDriver;
