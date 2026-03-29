'use strict';

function cleanText(value) {
  return String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

function normalizeKey(value) {
  return cleanText(value).toLocaleLowerCase();
}

function uniqueNormalized(values) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const clean = cleanText(value);
    const key = normalizeKey(clean);
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

function uniqueCaseSensitive(values) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const clean = cleanText(value);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  return result;
}

function parseCsvList(value) {
  if (Array.isArray(value)) return uniqueNormalized(value);
  return uniqueNormalized(String(value || '').split(','));
}

function makeIdFromName(name, fallback = 'item') {
  const base = normalizeKey(name).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || fallback;
  return base;
}

function makeUniqueName(baseName, usedNames) {
  const cleanBase = cleanText(baseName) || 'Zone';
  const existing = new Set((usedNames || []).map(normalizeKey).filter(Boolean));
  if (!existing.has(normalizeKey(cleanBase))) return cleanBase;
  let index = 2;
  while (existing.has(normalizeKey(`${cleanBase} (${index})`))) index += 1;
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
  let r = 0; let g = 0; let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  cleanText,
  normalizeKey,
  uniqueNormalized,
  uniqueCaseSensitive,
  parseCsvList,
  makeIdFromName,
  makeUniqueName,
  randomZoneColor,
  hslToHex,
  normalizeBoolean,
  clone,
};
