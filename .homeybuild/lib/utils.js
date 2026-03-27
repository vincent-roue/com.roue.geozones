'use strict';

function cleanText(value) {
  return String(value || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

function uniqueCaseSensitive(values) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const clean = cleanText(value);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  return result;
}

function makeUniqueName(baseName, usedNames) {
  const cleanBase = cleanText(baseName) || 'Zone';
  const existing = new Set((usedNames || []).map(name => cleanText(name)).filter(Boolean));
  if (!existing.has(cleanBase)) return cleanBase;
  let index = 2;
  while (existing.has(`${cleanBase} (${index})`)) index += 1;
  return `${cleanBase} (${index})`;
}

let colorCounter = 0;
function randomZoneColor() {
  colorCounter += 1;
  const hue = (Math.floor(Math.random() * 360) + (colorCounter * 47)) % 360;
  return hslToHex(hue, 68, 52);
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs((2 * l) - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - (c / 2);
  let r = 0, g = 0, b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = value => Math.round((value + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }
  return fallback;
}

module.exports = {
  cleanText,
  uniqueCaseSensitive,
  makeUniqueName,
  randomZoneColor,
  hslToHex,
  normalizeBoolean,
};
