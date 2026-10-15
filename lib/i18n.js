'use strict';

function translate(homey, key, fallback = '', tags = {}) {
  try {
    const value = homey?.__ ? homey.__(`errors.${key}`, tags) : null;
    return (typeof value === 'string' && value.trim()) ? value : fallback;
  } catch (error) {
    return fallback;
  }
}

module.exports = {
  translate,
};
