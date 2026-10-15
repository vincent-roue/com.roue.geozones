'use strict';

const LOG_STATE_KEY = '__geozonesLogState';
const DEFAULT_DEDUP_WINDOW_MS = 5 * 60 * 1000;

function isHeavyDebugEnabled(homey) {
  try {
    const { getConfig } = require('./store');
    return Boolean(getConfig(homey)?.general?.heavyDebug);
  } catch (error) {
    return false;
  }
}

function getLogState(homey) {
  if (!homey[LOG_STATE_KEY]) homey[LOG_STATE_KEY] = { once: new Map(), throttle: new Map() };
  return homey[LOG_STATE_KEY];
}

function serializeDetails(details) {
  if (!details) return '';
  try {
    return JSON.stringify(details);
  } catch (error) {
    return '[details unavailable]';
  }
}

function shouldLogOnce(homey, key, value = true) {
  const state = getLogState(homey);
  const previous = state.once.get(key);
  if (previous === value) return false;
  state.once.set(key, value);
  return true;
}

function shouldThrottle(homey, key, windowMs = DEFAULT_DEDUP_WINDOW_MS) {
  const state = getLogState(homey);
  const now = Date.now();
  const previous = Number(state.throttle.get(key) || 0);
  if (now - previous < windowMs) return false;
  state.throttle.set(key, now);
  return true;
}

function write(homey, method, scope, message, details = null) {
  const prefix = `[GeoZones:${scope}] ${message}`;
  if (details) {
    homey[method](`${prefix} :: ${serializeDetails(details)}`);
    return;
  }
  homey[method](prefix);
}

function log(homey, scope, message, details = null) {
  write(homey, 'log', scope, message, null);
}

function logWarn(homey, scope, message, details = null) {
  write(homey, 'log', scope, `WARN ${message}`, null);
}

function logError(homey, scope, error, details = null) {
  const message = error?.message || String(error);
  write(homey, 'error', scope, message, isHeavyDebugEnabled(homey) ? details : null);
}

function logHeavy(homey, scope, message, details = null) {
  if (!isHeavyDebugEnabled(homey)) return;
  write(homey, 'log', scope, message, details);
}

module.exports = {
  isHeavyDebugEnabled,
  log,
  logWarn,
  logError,
  logHeavy,
  shouldLogOnce,
  shouldThrottle,
};
