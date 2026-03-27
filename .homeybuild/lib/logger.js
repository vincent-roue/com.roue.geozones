'use strict';

const { getConfig } = require('./store');

function isHeavyDebugEnabled(homey) {
  try {
    return Boolean(getConfig(homey)?.subjectSettings?.heavyDebug);
  } catch (error) {
    return false;
  }
}

function log(homey, scope, message, details = null) {
  const prefix = `[GeoZones:${scope}] ${message}`;
  homey.log(prefix);
  if (details && isHeavyDebugEnabled(homey)) {
    try {
      homey.log(`${prefix} :: ${JSON.stringify(details)}`);
    } catch (error) {
      homey.log(`${prefix} :: [details unavailable]`);
    }
  }
}

function logError(homey, scope, error, details = null) {
  const message = error?.message || String(error);
  homey.error(`[GeoZones:${scope}] ${message}`);
  if (details && isHeavyDebugEnabled(homey)) {
    try {
      homey.error(`[GeoZones:${scope}] details :: ${JSON.stringify(details)}`);
    } catch (innerError) {
      homey.error(`[GeoZones:${scope}] details unavailable`);
    }
  }
}

module.exports = {
  isHeavyDebugEnabled,
  log,
  logError,
};
