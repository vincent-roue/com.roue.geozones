let HomeyApp;
let localeData = {};
let config = null;
let selectedZoneName = null;
let map = null;
let tileLayer = null;
let drawnItems = null;
let drawHandlers = {};
let zoneLayers = new Map();
let isDirty = false;
let colorCounter = 0;

const qs = (id) => document.getElementById(id);
const cleanText = (value) => String(value || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
const RESERVED_STATE_VALUES = ['not_defined', 'unknown', 'error'];
const EARTH_RADIUS_M = 6371000;

function t(path, fallback = '') {
  const parts = path.split('.');
  let current = localeData;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return fallback;
    current = current[part];
  }
  return current ?? fallback;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatArea(areaM2) {
  const value = Number(areaM2);
  if (!Number.isFinite(value) || value <= 0) return '0 m²';
  return `${Math.round(value).toLocaleString()} m²`;
}

function toRad(value) {
  return Number(value) * Math.PI / 180;
}

function circleAreaM2(radiusMeters) {
  return Math.PI * Number(radiusMeters) * Number(radiusMeters);
}

function polygonAreaM2(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let lat0 = 0;
  let lng0 = 0;
  for (const point of points) {
    lat0 += Number(point.lat);
    lng0 += Number(point.lng);
  }
  lat0 /= points.length;
  lng0 /= points.length;

  const cosLat0 = Math.cos(toRad(lat0));
  const projected = points.map(point => ({
    x: toRad(Number(point.lng) - lng0) * EARTH_RADIUS_M * cosLat0,
    y: toRad(Number(point.lat) - lat0) * EARTH_RADIUS_M,
  }));

  let area = 0;
  for (let i = 0; i < projected.length; i += 1) {
    const j = (i + 1) % projected.length;
    area += (projected[i].x * projected[j].y) - (projected[j].x * projected[i].y);
  }
  return Math.abs(area) / 2;
}

function uniqueValues(values) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const clean = cleanText(value);
    if (!clean) continue;
    if (seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  return result;
}

function randomColor() {
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
  const toHex = (value) => Math.round((value + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function toHexColor(color) {
  if (!color) return '#3388ff';
  if (color.startsWith('#')) return color;
  const match = color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/i);
  if (!match) return '#3388ff';
  return hslToHex(Number(match[1]), Number(match[2]), Number(match[3]));
}

function notify(text, isError = false) {
  qs('statusText').textContent = text;
  if (HomeyApp?.setTitle) {
    HomeyApp.setTitle(`GeoZones${isError ? ' ⚠️' : ''}`);
  }
}

function setDirty(nextDirty = true) {
  isDirty = !!nextDirty;
  const saveButton = qs('btnSaveTop');
  const cancelButton = qs('btnCancelTop');
  if (saveButton) saveButton.disabled = !isDirty;
  if (cancelButton) cancelButton.disabled = !isDirty;
  if (config && config.ui) config.ui.hasUnsavedChanges = isDirty;
  notify(isDirty ? t('settings.status.unsaved', 'Unsaved changes') : t('settings.status.ready', 'Ready'));
}

function showImportError(message) {
  const box = qs('importError');
  const clean = Array.isArray(message) ? message.join('\n') : cleanText(message);
  if (!clean) {
    box.textContent = '';
    box.classList.add('hidden');
    return;
  }
  box.textContent = clean;
  box.classList.remove('hidden');
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(button => {
    const isActive = button.dataset.tab === name;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    const isActive = panel.dataset.panel === name;
    panel.classList.toggle('active', isActive);
    panel.hidden = !isActive;
  });
  if (config && config.ui) config.ui.activeTab = name;
}

function isValidLatLng(point) {
  return point
    && Number.isFinite(Number(point.lat))
    && Number.isFinite(Number(point.lng))
    && Number(point.lat) >= -90 && Number(point.lat) <= 90
    && Number(point.lng) >= -180 && Number(point.lng) <= 180;
}

function normalizePoint(input) {
  return { lat: Number(input?.lat), lng: Number(input?.lng) };
}

function getZone(zoneName = selectedZoneName) {
  return (config?.zones || []).find(zone => zone.name === zoneName) || null;
}

function getEditingZoneName() {
  return selectedZoneName || null;
}

function getEditingZone() {
  return getZone(selectedZoneName);
}

function getNextSelectedZoneNameAfterRemoval(removedIndex, removedNames = []) {
  const removed = new Set(removedNames);
  const remaining = (config?.zones || []).filter(zone => !removed.has(zone.name));
  if (!remaining.length) return null;
  const nextAtSameIndex = remaining[Math.min(removedIndex, remaining.length - 1)];
  return nextAtSameIndex?.name || remaining[remaining.length - 1]?.name || null;
}

function ensureUniqueZoneName(baseName, excludeName = '') {
  const existing = new Set((config.zones || []).filter(zone => zone.name !== excludeName).map(zone => zone.name));
  const candidate = cleanText(baseName) || 'Zone';
  if (!existing.has(candidate)) return candidate;
  let index = 2;
  while (existing.has(`${candidate} (${index})`)) index += 1;
  return `${candidate} (${index})`;
}

function normalizeZone(zone) {
  const type = zone.type === 'polygon' ? 'polygon' : 'circle';
  const normalized = {
    name: cleanText(zone.name) || 'Zone',
    id: cleanText(zone.name) || 'Zone',
    type,
    active: zone.active !== false,
    color: toHexColor(cleanText(zone.color) || randomColor()),
    groups: uniqueValues(zone.groups || (zone.group ? [zone.group] : [])),
    categories: uniqueValues(zone.categories || (zone.category ? [zone.category] : [])),
    center: type === 'circle' ? normalizePoint(zone.center || { lat: 48.8566, lng: 2.3522 }) : null,
    radius: Math.max(1, Number(zone.radius || 100)),
    hysteresis: Math.max(0, Number(zone.hysteresis || 0)),
    paths: type === 'polygon' ? (Array.isArray(zone.paths) ? zone.paths.map(normalizePoint) : []) : [],
    areaM2: 0,
  };
  if (!isValidLatLng(normalized.center) && type === 'circle') normalized.center = { lat: 48.8566, lng: 2.3522 };
  normalized.areaM2 = type === 'circle' ? circleAreaM2(normalized.radius) : polygonAreaM2(normalized.paths);
  return normalized;
}

function segmentsIntersect(a, b, c, d) {
  const orient = (p, q, r) => {
    const value = (q.lng - p.lng) * (r.lat - p.lat) - (q.lat - p.lat) * (r.lng - p.lng);
    if (Math.abs(value) < 1e-12) return 0;
    return value > 0 ? 1 : -1;
  };
  const onSeg = (p, q, r) => (
    Math.min(p.lng, r.lng) - 1e-12 <= q.lng && q.lng <= Math.max(p.lng, r.lng) + 1e-12
    && Math.min(p.lat, r.lat) - 1e-12 <= q.lat && q.lat <= Math.max(p.lat, r.lat) + 1e-12
  );
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSeg(a, c, b)) return true;
  if (o2 === 0 && onSeg(a, d, b)) return true;
  if (o3 === 0 && onSeg(c, a, d)) return true;
  if (o4 === 0 && onSeg(c, b, d)) return true;
  return false;
}

function polygonHasSelfIntersection(points) {
  if (!Array.isArray(points) || points.length < 4) return false;
  for (let i = 0; i < points.length; i += 1) {
    const a1 = points[i];
    const a2 = points[(i + 1) % points.length];
    for (let j = i + 1; j < points.length; j += 1) {
      const b1 = points[j];
      const b2 = points[(j + 1) % points.length];
      if (i === j) continue;
      if ((i + 1) % points.length === j) continue;
      if (i === (j + 1) % points.length) continue;
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

function validateZoneDraft(zone, options = {}) {
  const errors = [];
  const zoneName = cleanText(zone?.name);
  if (!zoneName) errors.push(t('settings.messages.zone_name_required', 'Zone name is required'));
  if (zoneName && RESERVED_STATE_VALUES.includes(zoneName)) errors.push(t('settings.messages.reserved_name', 'This name is reserved'));
  const duplicates = (config?.zones || []).filter(item => item !== zone && item.name === zoneName);
  if (zoneName && duplicates.length) errors.push(t('settings.messages.zone_name_duplicate', 'Zone names must be unique'));

  if (zone.type === 'circle') {
    if (!isValidLatLng(zone.center)) errors.push(t('settings.messages.invalid_circle_center', 'Invalid circle center'));
    if (!Number.isFinite(Number(zone.radius)) || Number(zone.radius) <= 0) errors.push(t('settings.messages.invalid_radius', 'Invalid radius'));
    if (!Number.isFinite(Number(zone.hysteresis)) || Number(zone.hysteresis) < 0) errors.push(t('settings.messages.invalid_hysteresis', 'Invalid hysteresis'));
  }

  if (zone.type === 'polygon') {
    if (!Array.isArray(zone.paths) || zone.paths.length < 3) errors.push(t('settings.messages.invalid_polygon_points', 'A polygon must contain at least 3 points'));
    if (Array.isArray(zone.paths) && !zone.paths.every(isValidLatLng)) errors.push(t('settings.messages.invalid_polygon_coordinates', 'Invalid polygon coordinates'));
    if (Array.isArray(zone.paths) && zone.paths.length >= 4 && polygonHasSelfIntersection(zone.paths)) {
      errors.push(t('settings.messages.polygon_self_intersection', 'This polygon is self-intersecting and cannot be saved'));
    }
  }

  if (errors.length && options.throwOnError) throw new Error(errors[0]);
  return errors;
}

function updateConfigDerivedLists() {
  config.groups = uniqueValues([...(config.groups || []), ...(config.zones || []).flatMap(zone => zone.groups || [])]);
  config.categories = uniqueValues([...(config.categories || []), ...(config.zones || []).flatMap(zone => zone.categories || [])]);
}

function zoneStyle(zone) {
  return {
    color: zone.color || '#3388ff',
    weight: 2,
    fillOpacity: 0.18,
  };
}

function zoneToLayer(zone) {
  if (zone.type === 'circle') {
    return L.circle([zone.center.lat, zone.center.lng], { ...zoneStyle(zone), radius: zone.radius });
  }
  if (zone.type === 'polygon') {
    return L.polygon(zone.paths.map(point => [point.lat, point.lng]), zoneStyle(zone));
  }
  return null;
}

function layerToZoneGeometry(zone, layer) {
  if (zone.type === 'circle' && layer instanceof L.Circle) {
    const center = layer.getLatLng();
    zone.center = { lat: center.lat, lng: center.lng };
    zone.radius = Math.round(layer.getRadius());
  } else if (zone.type === 'polygon' && layer instanceof L.Polygon) {
    const latlngs = layer.getLatLngs()[0] || [];
    zone.paths = latlngs.map(point => ({ lat: point.lat, lng: point.lng }));
  }
}

function renderMapZones() {
  if (!drawnItems) return;
  zoneLayers.forEach(layer => drawnItems.removeLayer(layer));
  zoneLayers.clear();
  for (const zone of config.zones || []) {
    const layer = zoneToLayer(zone);
    if (!layer) continue;
    layer._zoneName = zone.name;
    layer.on('click', () => setSelectedZone(zone.name, false));
    drawnItems.addLayer(layer);
    zoneLayers.set(zone.name, layer);
  }
}

function renderZoneList() {
  const list = qs('zoneList');
  const query = cleanText(qs('searchZone').value).toLocaleLowerCase();
  list.innerHTML = '';
  const zones = (config.zones || []).filter(zone => !query || zone.name.toLocaleLowerCase().includes(query));
  if (!zones.length) {
    list.innerHTML = `<div class="note">${escapeHtml(t('settings.messages.no_zone_selected', 'No zone selected'))}</div>`;
    return;
  }
  zones.forEach(zone => {
    const item = document.createElement('div');
    item.className = `zone-item ${zone.name === selectedZoneName ? 'active' : ''}`;
    item.innerHTML = `
      <div class="zone-item-title">
        <strong>${escapeHtml(zone.name)}</strong>
        <span class="color-dot" style="background:${escapeHtml(zone.color)}"></span>
      </div>
      <div class="zone-meta">${escapeHtml(t('settings.labels.standard_zone', 'zone'))}${zone.active === false ? ` · ${escapeHtml(t('settings.labels.inactive', 'inactive'))}` : ''} · ${escapeHtml(formatArea(zone.areaM2))}</div>
      <div class="zone-meta">${escapeHtml((zone.groups || []).join(', ') || '—')} · ${escapeHtml((zone.categories || []).join(', ') || '—')}</div>
    `;
    item.onclick = () => setSelectedZone(zone.name, true);
    list.appendChild(item);
  });
}

function renderTokenEditor(containerId, values, placeholder) {
  const container = qs(containerId);
  container.innerHTML = '';
  (values || []).forEach((value) => {
    const row = document.createElement('div');
    row.className = 'token-row';
    row.innerHTML = `<input type="text" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"><button class="danger small" type="button">×</button>`;
    container.appendChild(row);
  });
}

function readTokenEditor(containerId) {
  return uniqueValues([...qs(containerId).querySelectorAll('input')].map(input => input.value));
}

function renderEditor() {
  const zone = getEditingZone();
  qs('zoneEmpty').classList.toggle('hidden', Boolean(zone));
  qs('zoneEditor').classList.toggle('hidden', !zone);
  if (!zone) {
    qs('zoneEmpty').textContent = t('settings.messages.no_zone_selected', 'Select a zone on the map or in the list');
    return;
  }
  qs('zoneName').value = zone.name;
  qs('zoneColor').value = toHexColor(zone.color);
  qs('zoneActive').checked = zone.active !== false;
  renderTokenEditor('zoneGroupsEditor', zone.groups || [], t('settings.placeholders.group', 'Family'));
  renderTokenEditor('zoneCategoriesEditor', zone.categories || [], t('settings.placeholders.category', 'Home'));
  const isCircle = zone.type === 'circle';
  qs('circleFields').classList.toggle('hidden', !isCircle);
  qs('polygonFields').classList.toggle('hidden', isCircle);
  if (isCircle) {
    qs('zoneCenterLat').value = zone.center?.lat ?? '';
    qs('zoneCenterLng').value = zone.center?.lng ?? '';
    qs('zoneRadius').value = zone.radius ?? 100;
    qs('zoneHysteresis').value = zone.hysteresis ?? 0;
  } else {
    qs('zonePaths').value = JSON.stringify(zone.paths || [], null, 2);
  }
}

function renderGlobalList(containerId, items, onChange, onDelete, placeholder) {
  const container = qs(containerId);
  container.innerHTML = '';
  items.forEach((value, index) => {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.innerHTML = `<input type="text" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"><button class="danger" type="button">×</button>`;
    const input = row.querySelector('input');
    const button = row.querySelector('button');
    input.addEventListener('change', () => onChange(index, input.value));
    button.onclick = () => onDelete(index);
    container.appendChild(row);
  });
}

function renderLists() {
  renderGlobalList('groupList', uniqueValues(config.groups || []), (index, value) => updateGlobalItem('group', index, value), (index) => deleteGlobalItem('group', index), t('settings.placeholders.group', 'Family'));
  renderGlobalList('categoryList', uniqueValues(config.categories || []), (index, value) => updateGlobalItem('category', index, value), (index) => deleteGlobalItem('category', index), t('settings.placeholders.category', 'Home'));
}

function refreshJsonPreview() {
  qs('jsonBox').value = JSON.stringify(config, null, 2);
}

function refreshDerivedViews(options = {}) {
  updateConfigDerivedLists();
  if (options.map) renderMapZones();
  renderZoneList();
  renderLists();
  refreshJsonPreview();
}

function setSelectedZone(zoneName, centerOnMap = false) {
  selectedZoneName = zoneName || null;
  if (config && config.ui) config.ui.selectedZoneName = selectedZoneName;
  renderZoneList();
  renderEditor();
  if (centerOnMap && map && selectedZoneName) {
    const layer = zoneLayers.get(selectedZoneName);
    if (layer) {
      if (typeof layer.getBounds === 'function') map.fitBounds(layer.getBounds(), { padding: [20, 20] });
      else if (typeof layer.getLatLng === 'function') map.panTo(layer.getLatLng());
    }
  }
}

function syncZoneEditorToDraft(options = {}) {
  const editingName = selectedZoneName;
  if (!editingName) return true;
  const zone = getZone(editingName);
  if (!zone) return false;

  const requestedName = cleanText(qs('zoneName').value);
  const oldName = zone.name;
  if (!requestedName) {
    if (options.strict) throw new Error(t('settings.messages.zone_name_required', 'Zone name is required'));
  } else if (RESERVED_STATE_VALUES.includes(requestedName)) {
    if (options.strict) throw new Error(t('settings.messages.reserved_name', 'This name is reserved'));
  } else if ((config.zones || []).some(item => item !== zone && item.name === requestedName)) {
    if (options.strict) throw new Error(t('settings.messages.zone_name_duplicate', 'Zone names must be unique'));
  } else if (requestedName !== oldName) {
    zone.name = requestedName;
    zone.id = requestedName;
    selectedZoneName = requestedName;
  }

  zone.color = qs('zoneColor').value || zone.color;
  zone.active = qs('zoneActive').checked;
  zone.groups = readTokenEditor('zoneGroupsEditor');
  zone.categories = readTokenEditor('zoneCategoriesEditor');

  if (zone.type === 'circle') {
    zone.center = { lat: Number(qs('zoneCenterLat').value), lng: Number(qs('zoneCenterLng').value) };
    zone.radius = Math.max(1, Number(qs('zoneRadius').value || 100));
    zone.hysteresis = Math.max(0, Number(qs('zoneHysteresis').value || 0));
    zone.areaM2 = circleAreaM2(zone.radius);
  } else {
    try {
      const parsed = JSON.parse(qs('zonePaths').value || '[]');
      zone.paths = Array.isArray(parsed) ? parsed.map(normalizePoint) : [];
      zone.areaM2 = polygonAreaM2(zone.paths);
    } catch (error) {
      if (options.strict) throw new Error(t('settings.messages.invalid_json', 'Invalid JSON'));
      return false;
    }
  }

  const errors = validateZoneDraft(zone, { throwOnError: !!options.strict });
  if (errors.length && !options.strict) return false;

  refreshDerivedViews({ map: options.map !== false });
  if (options.renderEditor !== false) renderEditor();
  if (options.markDirty !== false) setDirty(true);
  return true;
}

function deleteZoneDraft() {
  const editingName = selectedZoneName;
  if (!editingName) return;
  const currentZones = config.zones || [];
  const zoneIndex = currentZones.findIndex(item => item.name === editingName);
  if (zoneIndex < 0) return;
  const next = getNextSelectedZoneNameAfterRemoval(zoneIndex, [editingName]);
  config.zones = currentZones.filter(item => item.name !== editingName);
  refreshDerivedViews({ map: true });
  setSelectedZone(next, false);
  setDirty(true);
  notify(t('settings.messages.zone_deleted', 'Zone deleted'));
}

function fitAllZones() {
  const layers = [...zoneLayers.values()];
  if (!layers.length || !map) return;
  const featureGroup = L.featureGroup(layers);
  map.fitBounds(featureGroup.getBounds(), { padding: [20, 20] });
}

function updateGlobalItem(kind, index, value) {
  const collectionName = kind === 'group' ? 'groups' : 'categories';
  const list = [...uniqueValues(config[collectionName] || [])];
  const clean = cleanText(value);
  if (clean && RESERVED_STATE_VALUES.includes(clean)) {
    notify(t('settings.messages.reserved_group_or_category', 'Reserved values cannot be used for groups or categories'), true);
    return;
  }
  if (index >= list.length) {
    if (clean) list.push(clean);
  } else if (!clean) {
    list.splice(index, 1);
  } else {
    if (list.some((item, itemIndex) => itemIndex !== index && item === clean)) return;
    list[index] = clean;
  }
  config[collectionName] = uniqueValues(list);
  refreshDerivedViews();
  setDirty(true);
}

function deleteGlobalItem(kind, index) {
  const collectionName = kind === 'group' ? 'groups' : 'categories';
  const list = uniqueValues(config[collectionName] || []);
  if (index >= list.length) return;
  const removedValue = list[index];
  config[collectionName] = list.filter((_, i) => i !== index);
  for (const zone of config.zones || []) {
    if (kind === 'group') zone.groups = (zone.groups || []).filter(item => item !== removedValue);
    else zone.categories = (zone.categories || []).filter(item => item !== removedValue);
  }
  refreshDerivedViews();
  renderEditor();
  setDirty(true);
  notify(t(kind === 'group' ? 'settings.messages.group_removed' : 'settings.messages.category_removed', 'Removed'));
}

function listHtml(values, ordered = false) {
  const tag = ordered ? 'ol' : 'ul';
  const items = (values || []).map(text => `<li>${escapeHtml(text)}</li>`).join('');
  return items ? `<${tag}>${items}</${tag}>` : '';
}

function paragraphHtml(text) {
  return cleanText(text) ? `<p class="help-paragraph">${escapeHtml(text)}</p>` : '';
}

function helpSectionHtml(title, body = '', list = [], ordered = false, extra = '') {
  const hasContent = cleanText(body) || (list && list.length) || cleanText(extra);
  if (!title && !hasContent) return '';
  return `
    <section class="help-section">
      ${title ? `<h3>${escapeHtml(title)}</h3>` : ''}
      ${paragraphHtml(body)}
      ${listHtml(list, ordered)}
      ${extra || ''}
    </section>
  `;
}

function renderHelpContent() {
  const help = t('settings.help', {});
  qs('helpContent').innerHTML = `
    <div class="grid-two help-grid">
      <div class="card help-card">
        <h2>${escapeHtml(help.title || 'How GeoZones works')}</h2>
        ${paragraphHtml(help.intro || '')}
        ${paragraphHtml(help.store_pitch || '')}
        ${paragraphHtml(help.how_it_works_more_a || '')}
        ${paragraphHtml(help.how_it_works_more_b || '')}
        ${helpSectionHtml(help.rules_title || 'Rules', '', help.rules || [])}
        ${helpSectionHtml(help.tips_title || 'Tips', '', help.tips || [])}
      </div>
      <div class="card help-card">
        <h2>${escapeHtml(help.create_title || 'Create zones on the map')}</h2>
        ${paragraphHtml(help.create_intro || '')}
        ${paragraphHtml(help.create_more || '')}
        ${helpSectionHtml(help.create_circle_title || 'Create a circle', help.example_circle_body || '', help.create_circle_steps || [], true, cleanText(help.example_circle_meta) ? `<p class="help-meta">${escapeHtml(help.example_circle_meta)}</p>` : '')}
        ${helpSectionHtml(help.create_polygon_title || 'Create a polygon', help.example_polygon_body || '', help.create_polygon_steps || [], true, cleanText(help.example_polygon_meta) ? `<p class="help-meta">${escapeHtml(help.example_polygon_meta)}</p>` : '')}
      </div>
    </div>
    <div class="help-flow-grid">
      <div class="card help-card">
        <h2>${escapeHtml(help.flow_title || 'Use GeoZones in Flow cards')}</h2>
        ${paragraphHtml(help.flow_intro || '')}
        ${paragraphHtml(help.flow_more || '')}
        ${helpSectionHtml(help.flow_and_title || 'Conditions', '', help.flow_and_cards || [])}
        ${helpSectionHtml(help.flow_then_title || 'Action', '', help.flow_then_cards || [])}
        ${helpSectionHtml(help.flow_when_title || 'Triggers', '', help.flow_when_cards || [])}
        ${helpSectionHtml(help.subjects_title || 'Subjects', help.subjects_body || '', help.subjects_rules || [])}
        ${helpSectionHtml(help.debug_title || 'Debug', help.debug_body || '', help.debug_rules || [])}
        ${helpSectionHtml(help.json_title || 'Add zone from JSON', help.json_body || '', help.json_rules || [])}
      </div>
    </div>
  `;
}

function renderSubjects() {
  const subjectSettings = config.subjectSettings || { autopurgeEnabled: true, autopurgeDays: 5, heavyDebug: false };
  qs('autopurgeEnabled').checked = subjectSettings.autopurgeEnabled !== false;
  qs('autopurgeDays').value = Number.isFinite(Number(subjectSettings.autopurgeDays)) ? Number(subjectSettings.autopurgeDays) : 5;
  qs('heavyDebugEnabled').checked = subjectSettings.heavyDebug === true;
  const subjects = Object.entries(config.subjects || {}).sort((a, b) => a[0].localeCompare(b[0]));
  qs('subjectList').innerHTML = subjects.length ? subjects.map(([id, subject]) => `
    <div class="list-item">
      <div>
        <strong>${escapeHtml(id)}</strong><br>
        ${escapeHtml(subject.currentZone || 'unknown')} · ${escapeHtml((subject.currentGroups || []).join(', ') || 'not_defined')} · ${escapeHtml((subject.currentCategories || []).join(', ') || 'not_defined')}<br>
        ${escapeHtml(String(subject.lastLat ?? ''))}, ${escapeHtml(String(subject.lastLng ?? ''))}<br>
        ${escapeHtml(subject.lastTimestamp || subject.updatedAt || '')}
      </div>
      <button class="danger small" type="button" data-subject-delete="${escapeHtml(id)}">×</button>
    </div>`).join('') : `<div class="empty-state">${escapeHtml(t('settings.messages.no_subjects', 'No subjects stored yet'))}</div>`;
}

function renderEverything() {
  refreshDerivedViews({ map: true });
  renderEditor();
  renderHelpContent();
  renderSubjects();
}

function startDraw(mode) {
  if (mode === 'circle') drawHandlers.circle.enable();
  if (mode === 'polygon') drawHandlers.polygon.enable();
}

async function saveConfig() {
  try {
    syncZoneEditorToDraft({ strict: true, map: true, markDirty: false });
    updateConfigDerivedLists();
    config.ui = {
      ...(config.ui || {}),
      selectedZoneName,
      activeTab: (config.ui && config.ui.activeTab) || 'zones',
      mapCenter: map ? { lat: map.getCenter().lat, lng: map.getCenter().lng } : { lat: 48.8566, lng: 2.3522 },
      mapZoom: map ? map.getZoom() : 6,
      hasUnsavedChanges: false,
    };
    config.subjectSettings = { ...(config.subjectSettings || {}), autopurgeEnabled: config.subjectSettings?.autopurgeEnabled !== false, autopurgeDays: Math.max(0, Number(config.subjectSettings?.autopurgeDays || 0)), heavyDebug: config.subjectSettings?.heavyDebug === true };
    config = await HomeyApp.api('PUT', '/config', config);
    selectedZoneName = config.ui?.selectedZoneName || selectedZoneName || config.zones?.[0]?.name || null;
    renderEverything();
    setSelectedZone(selectedZoneName, false);
    setDirty(false);
    notify(t('settings.messages.config_saved', 'Configuration saved'));
  } catch (error) {
    notify(error.message || String(error), true);
    HomeyApp.alert(error.message || String(error));
  }
}

async function cancelUnsavedChanges() {
  try {
    config = await HomeyApp.api('GET', '/config');
    config.subjectSettings = config.subjectSettings || { autopurgeEnabled: true, autopurgeDays: 5, heavyDebug: false };
    selectedZoneName = config.ui?.selectedZoneName || config.zones?.[0]?.name || null;
    showImportError('');
    renderEverything();
    setSelectedZone(selectedZoneName, false);
    switchTab(config.ui?.activeTab || 'zones');
    setDirty(false);
    notify(t('settings.messages.changes_cancelled', 'Unsaved changes cancelled'));
  } catch (error) {
    notify(error.message || String(error), true);
    HomeyApp.alert(error.message || String(error));
  }
}

function addTokenEditorRow(containerId, placeholder) {
  const row = document.createElement('div');
  row.className = 'token-row';
  row.innerHTML = `<input type="text" placeholder="${escapeHtml(placeholder)}"><button class="danger small" type="button">×</button>`;
  qs(containerId).appendChild(row);
  row.querySelector('input').focus();
  setDirty(true);
}

function handleTokenRowClick(event) {
  if (event.target.tagName !== 'BUTTON') return;
  event.target.parentElement.remove();
  syncZoneEditorToDraft({ map: false });
}

function handleQuickAdd(event, kind) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  const value = cleanText(event.target.value);
  if (!value) return;
  const collectionName = kind === 'group' ? 'groups' : 'categories';
  const items = uniqueValues(config[collectionName] || []);
  if (!items.includes(value)) {
    items.push(value);
    config[collectionName] = items;
    refreshDerivedViews();
    setDirty(true);
  }
  event.target.value = '';
}

function useMapCenter() {
  const center = map.getCenter();
  qs('testLat').value = center.lat.toFixed(6);
  qs('testLong').value = center.lng.toFixed(6);
}

async function runTest() {
  try {
    const payload = {
      lat: Number(qs('testLat').value),
      long: Number(qs('testLong').value),
      subjectId: cleanText(qs('testSubjectId').value),
    };
    const result = await HomeyApp.api('POST', '/test', payload);
    qs('testSummary').innerHTML = result.found
      ? `<strong>${escapeHtml(result.zone)}</strong><br>${escapeHtml(result.groups || '—')}<br>${escapeHtml(result.categories || '—')}`
      : escapeHtml(t('settings.messages.test_no_match', 'No zone matched'));
    qs('testLogs').textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    notify(error.message || String(error), true);
    HomeyApp.alert(error.message || String(error));
  }
}

function mergeImportedConfig(imported) {
  const existingNames = new Set((config.zones || []).map(zone => zone.name));
  const mergedZones = [...config.zones.map(zone => normalizeZone(zone))];
  for (const rawZone of imported.zones || []) {
    const zone = normalizeZone(rawZone);
    let candidateName = zone.name;
    let index = 2;
    while (existingNames.has(candidateName)) {
      candidateName = `${zone.name} (${index})`;
      index += 1;
    }
    zone.name = candidateName;
    zone.id = candidateName;
    existingNames.add(candidateName);
    mergedZones.push(zone);
  }
  return {
    ...config,
    zones: mergedZones,
    groups: uniqueValues([...(config.groups || []), ...(imported.groups || []), ...mergedZones.flatMap(zone => zone.groups || [])]),
    categories: uniqueValues([...(config.categories || []), ...(imported.categories || []), ...mergedZones.flatMap(zone => zone.categories || [])]),
    ui: { ...(config.ui || {}), ...(imported.ui || {}) },
    subjectSettings: { ...(config.subjectSettings || {}), ...(imported.subjectSettings || {}) },
    subjects: config.subjects || {},
  };
}

function validateImportedConfig(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return [t('settings.messages.invalid_root_object', 'The JSON root must be an object.')];
  }
  if (!Array.isArray(raw.zones)) errors.push(t('settings.messages.zones_must_be_array', 'zones must be an array.'));
  if (raw.groups !== undefined && !Array.isArray(raw.groups)) errors.push(t('settings.messages.groups_must_be_array', 'groups must be an array.'));
  if (raw.categories !== undefined && !Array.isArray(raw.categories)) errors.push(t('settings.messages.categories_must_be_array', 'categories must be an array.'));
  if (errors.length) return errors;

  const names = new Set();
  (raw.zones || []).forEach((zone, index) => {
    const label = cleanText(zone?.name) || `${t('settings.labels.zone', 'Zone')} ${index + 1}`;
    const name = cleanText(zone?.name);
    if (!name) errors.push(`${label}: ${t('settings.messages.zone_name_required', 'Zone name is required')}`);
    else if (RESERVED_STATE_VALUES.includes(name)) errors.push(`${label}: ${t('settings.messages.reserved_name', 'This name is reserved')}`);
    else if (names.has(name)) errors.push(`${label}: ${t('settings.messages.zone_name_duplicate', 'Zone names must be unique')}`);
    else names.add(name);

    const type = zone?.type === 'polygon' ? 'polygon' : 'circle';
    if (type === 'circle') {
      const center = normalizePoint(zone?.center);
      if (!isValidLatLng(center)) errors.push(`${label}: ${t('settings.messages.invalid_circle_center', 'Invalid circle center')}`);
      if (!Number.isFinite(Number(zone?.radius)) || Number(zone?.radius) <= 0) errors.push(`${label}: ${t('settings.messages.invalid_radius', 'Invalid radius')}`);
      if (!Number.isFinite(Number(zone?.hysteresis ?? 0)) || Number(zone?.hysteresis ?? 0) < 0) errors.push(`${label}: ${t('settings.messages.invalid_hysteresis', 'Invalid hysteresis')}`);
    } else {
      const points = Array.isArray(zone?.paths) ? zone.paths.map(normalizePoint) : [];
      if (points.length < 3) errors.push(`${label}: ${t('settings.messages.invalid_polygon_points', 'A polygon must contain at least 3 points')}`);
      else if (!points.every(isValidLatLng)) errors.push(`${label}: ${t('settings.messages.invalid_polygon_coordinates', 'Invalid polygon coordinates')}`);
      else if (points.length >= 4 && polygonHasSelfIntersection(points)) errors.push(`${label}: ${t('settings.messages.polygon_self_intersection', 'This polygon is self-intersecting and cannot be saved')}`);
    }

    if (zone?.groups !== undefined && !Array.isArray(zone.groups)) errors.push(`${label}: ${t('settings.messages.zone_groups_must_be_array', 'Zone groups must be an array')}`);
    if (zone?.categories !== undefined && !Array.isArray(zone.categories)) errors.push(`${label}: ${t('settings.messages.zone_categories_must_be_array', 'Zone categories must be an array')}`);
    if (Array.isArray(zone?.groups) && zone.groups.some(value => RESERVED_STATE_VALUES.includes(String(value).trim()))) errors.push(`${label}: ${t('settings.messages.reserved_group_or_category', 'Reserved values cannot be used for groups or categories')}`);
    if (Array.isArray(zone?.categories) && zone.categories.some(value => RESERVED_STATE_VALUES.includes(String(value).trim()))) errors.push(`${label}: ${t('settings.messages.reserved_group_or_category', 'Reserved values cannot be used for groups or categories')}`);
    if (zone?.color !== undefined && cleanText(zone.color) && !/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(cleanText(zone.color)) && !/^hsl\(/i.test(cleanText(zone.color))) {
      errors.push(`${label}: ${t('settings.messages.invalid_color', 'Invalid color')}`);
    }
  });
  return errors;
}

function importJson(mode) {
  try {
    const parsed = JSON.parse(qs('jsonBox').value || '{}');
    const validationErrors = validateImportedConfig(parsed);
    if (validationErrors.length) {
      showImportError(validationErrors);
      notify(t('settings.messages.invalid_json', 'Invalid JSON'), true);
      return;
    }
    showImportError('');
    const nextConfig = mode === 'replace'
      ? {
          schemaVersion: Number(parsed.schemaVersion || parsed.version || config.schemaVersion || 2),
          zones: (parsed.zones || []).map(normalizeZone),
          groups: uniqueValues(parsed.groups || []),
          categories: uniqueValues(parsed.categories || []),
          ui: { ...(config.ui || {}), ...(parsed.ui || {}) },
          subjectSettings: { ...(config.subjectSettings || {}), ...(parsed.subjectSettings || {}) },
          subjects: config.subjects || {},
        }
      : mergeImportedConfig(parsed);

    config = {
      ...nextConfig,
      schemaVersion: Number(nextConfig.schemaVersion || 2),
      subjectSettings: nextConfig.subjectSettings || config.subjectSettings || { autopurgeEnabled: true, autopurgeDays: 5, heavyDebug: false },
      subjects: nextConfig.subjects || config.subjects || {},
    };
    updateConfigDerivedLists();
    selectedZoneName = config.ui?.selectedZoneName || config.zones?.[0]?.name || null;
    renderEverything();
    setSelectedZone(selectedZoneName, false);
    switchTab('import');
    setDirty(true);
    notify(t('settings.messages.import_loaded', 'JSON applied locally. Click Save to keep the changes.'));
  } catch (error) {
    showImportError(t('settings.messages.invalid_json', 'Invalid JSON'));
    notify(error.message || t('settings.messages.invalid_json', 'Invalid JSON'), true);
  }
}

function attachZoneDraftEvents() {
  const inputs = ['zoneName', 'zoneColor', 'zoneCenterLat', 'zoneCenterLng', 'zoneRadius', 'zoneHysteresis', 'zonePaths'];
  inputs.forEach(id => {
    const element = qs(id);
    if (!element) return;
    element.addEventListener('change', () => syncZoneEditorToDraft({ map: true }));
  });
  ['zoneActive'].forEach(id => {
    qs(id).addEventListener('change', () => syncZoneEditorToDraft({ map: true }));
  });
  qs('zoneGroupsEditor').addEventListener('click', handleTokenRowClick);
  qs('zoneCategoriesEditor').addEventListener('click', handleTokenRowClick);
  qs('zoneGroupsEditor').addEventListener('change', () => syncZoneEditorToDraft({ map: false }));
  qs('zoneCategoriesEditor').addEventListener('change', () => syncZoneEditorToDraft({ map: false }));
}

function attachEditorEvents() {
  qs('searchZone').addEventListener('input', renderZoneList);
  qs('btnSaveTop').onclick = saveConfig;
  qs('btnCancelTop').onclick = cancelUnsavedChanges;
  qs('btnDeleteZone').onclick = () => deleteZoneDraft();
  qs('btnFitAll').onclick = fitAllZones;
  qs('btnAddCircle').onclick = () => startDraw('circle');
  qs('btnAddPolygon').onclick = () => startDraw('polygon');
  qs('btnZoneAddGroup').onclick = () => addTokenEditorRow('zoneGroupsEditor', t('settings.placeholders.group', 'Family'));
  qs('btnZoneAddCategory').onclick = () => addTokenEditorRow('zoneCategoriesEditor', t('settings.placeholders.category', 'Home'));
  qs('btnRunTest').onclick = runTest;
  qs('autopurgeEnabled').addEventListener('change', () => { config.subjectSettings = { ...(config.subjectSettings || {}), autopurgeEnabled: qs('autopurgeEnabled').checked }; setDirty(true); });
  qs('autopurgeDays').addEventListener('change', () => { config.subjectSettings = { ...(config.subjectSettings || {}), autopurgeDays: Math.max(0, Number(qs('autopurgeDays').value || 0)) }; setDirty(true); });
  qs('heavyDebugEnabled').addEventListener('change', () => { config.subjectSettings = { ...(config.subjectSettings || {}), heavyDebug: qs('heavyDebugEnabled').checked }; setDirty(true); });
  qs('btnPurgeSubjects').onclick = async () => { try { await HomeyApp.api('POST', '/subjects/purge', {}); config = await HomeyApp.api('GET', '/config'); renderEverything(); setDirty(false); notify(t('settings.messages.subjects_purged', 'Subjects purged')); } catch (error) { notify(error.message || String(error), true); } };
  qs('subjectList').addEventListener('click', async (event) => { const id = event.target?.dataset?.subjectDelete; if (!id) return; try { await HomeyApp.api('DELETE', `/subjects/${encodeURIComponent(id)}`); config = await HomeyApp.api('GET', '/config'); renderEverything(); setDirty(false); } catch (error) { notify(error.message || String(error), true); } });
  qs('btnUseMapCenter').onclick = useMapCenter;
  qs('btnImportReplace').onclick = () => importJson('replace');
  qs('btnImportMerge').onclick = () => importJson('merge');
  qs('jsonBox').addEventListener('input', () => showImportError(''));
  qs('newGroupInput').addEventListener('keydown', event => handleQuickAdd(event, 'group'));
  qs('newCategoryInput').addEventListener('keydown', event => handleQuickAdd(event, 'category'));
  attachZoneDraftEvents();

  const tabs = [...document.querySelectorAll('.tab')];
  tabs.forEach((button, index) => {
    button.onclick = () => switchTab(button.dataset.tab);
    button.addEventListener('keydown', event => {
      let nextIndex = index;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tabs.length - 1;
      else return;
      event.preventDefault();
      tabs[nextIndex].focus();
      switchTab(tabs[nextIndex].dataset.tab);
    });
  });
}

function initMap() {
  map = L.map('map', { zoomControl: true }).setView([config.ui?.mapCenter?.lat || 48.8566, config.ui?.mapCenter?.lng || 2.3522], config.ui?.mapZoom || 6);
  tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  });
  tileLayer.addTo(map);

  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  drawHandlers.circle = new L.Draw.Circle(map, { shapeOptions: { color: '#2F6FED' } });
  drawHandlers.polygon = new L.Draw.Polygon(map, {
    allowIntersection: false,
    showArea: true,
    shapeOptions: { color: '#7A42F4' },
  });

  map.on(L.Draw.Event.CREATED, event => {
    const type = event.layerType;
    const layer = event.layer;
    const zone = type === 'circle'
      ? normalizeZone({
          name: ensureUniqueZoneName(t('settings.defaults.circle_name', 'Circle')),
          type: 'circle',
          color: randomColor(),
          center: { lat: layer.getLatLng().lat, lng: layer.getLatLng().lng },
          radius: Math.round(layer.getRadius()),
          hysteresis: 25,
          groups: [],
          categories: [],
        })
      : normalizeZone({
          name: ensureUniqueZoneName(t('settings.defaults.polygon_name', 'Polygon')),
          type: 'polygon',
          color: randomColor(),
          paths: (layer.getLatLngs()[0] || []).map(point => ({ lat: point.lat, lng: point.lng })),
          groups: [],
          categories: [],
        });

    const errors = validateZoneDraft(zone);
    if (errors.length) {
      notify(errors[0], true);
      return;
    }
    config.zones.push(zone);
    renderEverything();
    setSelectedZone(zone.name, true);
    setDirty(true);
  });

  map.on(L.Draw.Event.EDITED, event => {
    event.layers.eachLayer(layer => {
      const zone = getZone(layer._zoneName);
      if (!zone) return;
      layerToZoneGeometry(zone, layer);
      const errors = validateZoneDraft(zone);
      if (errors.length) notify(errors[0], true);
    });
    renderEverything();
    renderEditor();
    setDirty(true);
  });

  map.on(L.Draw.Event.DELETED, event => {
    const namesToDelete = [];
    event.layers.eachLayer(layer => {
      if (layer._zoneName) namesToDelete.push(layer._zoneName);
    });
    const currentZones = config.zones || [];
    const selectedIndex = currentZones.findIndex(zone => zone.name === selectedZoneName);
    const fallbackIndex = selectedIndex >= 0 ? selectedIndex : 0;
    const next = namesToDelete.includes(selectedZoneName)
      ? getNextSelectedZoneNameAfterRemoval(fallbackIndex, namesToDelete)
      : selectedZoneName;
    config.zones = currentZones.filter(zone => !namesToDelete.includes(zone.name));
    renderEverything();
    setSelectedZone(next, false);
    setDirty(true);
  });

  const editControl = new L.Control.Draw({
    draw: false,
    edit: {
      featureGroup: drawnItems,
      remove: true,
    },
  });
  map.addControl(editControl);
}

function applyTranslations() {
  qs('appTitle').textContent = t('app.title', 'GeoZones');
  document.querySelector('[data-tab="zones"]').textContent = t('settings.tabs.zones', 'Zones');
  document.querySelector('[data-tab="groups"]').textContent = t('settings.tabs.groups', 'Groups');
  document.querySelector('[data-tab="categories"]').textContent = t('settings.tabs.categories', 'Categories');
  document.querySelector('[data-tab="subjects"]').textContent = t('settings.tabs.subjects', 'Subjects');
  document.querySelector('[data-tab="test"]').textContent = t('settings.tabs.test', 'Test');
  document.querySelector('[data-tab="import"]').textContent = t('settings.tabs.import_export', 'Import / Export');
  document.querySelector('[data-tab="help"]').textContent = t('settings.tabs.help', 'Help');

  qs('btnSaveTop').title = t('settings.actions.save', 'Save');
  qs('btnSaveTop').setAttribute('aria-label', t('settings.actions.save', 'Save'));
  qs('btnCancelTop').title = t('settings.actions.cancel', 'Cancel');
  qs('btnCancelTop').setAttribute('aria-label', t('settings.actions.cancel', 'Cancel'));
  qs('btnAddCircle').textContent = t('settings.actions.add_circle', 'Add circle');
  qs('btnAddPolygon').textContent = t('settings.actions.add_polygon', 'Add polygon');
  qs('btnFitAll').textContent = t('settings.actions.fit_all', 'Fit all zones');
  qs('labelSearchZone').textContent = t('settings.labels.search', 'Search zones');
  qs('searchZone').placeholder = t('settings.placeholders.search_zone', 'Search by zone name');
  qs('titleZoneList').textContent = t('settings.labels.zone_list', 'Zones');
  qs('titleZoneProperties').textContent = t('settings.labels.properties', 'Zone properties');
  qs('labelZoneName').textContent = t('settings.labels.name', 'Name');
  qs('labelZoneColor').textContent = t('settings.labels.color', 'Color');
  qs('labelZoneActive').textContent = t('settings.labels.active', 'Active');
  qs('labelZoneGroups').textContent = t('settings.labels.groups', 'Groups');
  qs('labelZoneCategories').textContent = t('settings.labels.categories', 'Categories');
  qs('btnZoneAddGroup').textContent = t('settings.actions.add_field', 'Add');
  qs('btnZoneAddCategory').textContent = t('settings.actions.add_field', 'Add');
  qs('labelCenterLat').textContent = t('settings.labels.center_lat', 'Center latitude');
  qs('labelCenterLng').textContent = t('settings.labels.center_lng', 'Center longitude');
  qs('labelRadius').textContent = t('settings.labels.radius', 'Radius (m)');
  qs('labelHysteresis').textContent = t('settings.labels.hysteresis', 'Hysteresis (m)');
  qs('labelPolygonPoints').textContent = t('settings.labels.polygon_points', 'Polygon points');
  qs('btnDeleteZone').textContent = t('settings.actions.delete', 'Delete');
  qs('titleGroups').textContent = t('settings.labels.group_list', 'Groups');
  qs('titleCategories').textContent = t('settings.labels.category_list', 'Categories');
  qs('labelNewGroup').textContent = t('settings.labels.new_group', 'New group — press Enter');
  qs('newGroupInput').placeholder = t('settings.placeholders.new_group', 'Type a group and press Enter');
  qs('labelNewCategory').textContent = t('settings.labels.new_category', 'New category — press Enter');
  qs('newCategoryInput').placeholder = t('settings.placeholders.new_category', 'Type a category and press Enter');
  qs('labelTestLat').textContent = t('settings.labels.latitude', 'Latitude');
  qs('labelTestLong').textContent = t('settings.labels.longitude', 'Longitude');
  qs('labelTestSubjectId').textContent = t('settings.labels.subject_id', 'Subject ID (optional)');
  qs('testSubjectId').placeholder = t('settings.placeholders.subject_id', 'subject_1');
  qs('titleSubjects').textContent = t('settings.labels.subjects', 'Subjects');
  qs('titleDiagnostics').textContent = t('settings.labels.diagnostics', 'Diagnostics');
  qs('labelAutopurgeEnabled').textContent = t('settings.labels.autopurge_enabled', 'Autopurge inactive subjects');
  qs('labelAutopurgeDays').textContent = t('settings.labels.autopurge_days', 'Autopurge days (0 = disabled)');
  qs('btnPurgeSubjects').textContent = t('settings.actions.purge_subjects', 'Purge inactive subjects now');
  qs('labelHeavyDebug').textContent = t('settings.labels.heavy_debug', 'Enable heavy debug logging');
  qs('heavyDebugWarning').textContent = t('settings.help.debug_warning', 'Heavy debug logging increases CPU and memory usage and should only be enabled for debugging.');
  qs('btnRunTest').textContent = t('settings.actions.run_test', 'Run test');
  qs('btnUseMapCenter').textContent = t('settings.actions.use_map_center', 'Use map center');
  qs('testSummary').textContent = t('settings.messages.test_empty', 'No test run yet');
  qs('btnImportReplace').textContent = t('settings.actions.import_replace', 'Import and replace');
  qs('btnImportMerge').textContent = t('settings.actions.import_merge', 'Import and merge');
  qs('labelJson').textContent = t('settings.labels.json', 'JSON');
  qs('importNoteTitle').textContent = t('settings.import.note_title', 'How this tab works');
  qs('importNoteBody').textContent = t('settings.import.note_body', 'The JSON shown here is a live preview of the current draft. Editing it does not update the other tabs until you click Import and replace or Import and merge. Save stores the current draft in Homey. Cancel reloads the last saved configuration.');
}

async function onHomeyReady(Homey) {
  HomeyApp = Homey;
  const language = (HomeyApp.i18n && typeof HomeyApp.i18n.getLanguage === 'function' ? HomeyApp.i18n.getLanguage() : (navigator.language || 'en').slice(0, 2)).toLowerCase();
  const dictionaries = window.SETTINGS_I18N || {};
  localeData = dictionaries[language] || dictionaries[language.split('-')[0]] || dictionaries.en || {};
  applyTranslations();
  attachEditorEvents();
  setDirty(false);

  try {
    config = await HomeyApp.api('GET', '/config');
    config.subjectSettings = config.subjectSettings || { autopurgeEnabled: true, autopurgeDays: 5, heavyDebug: false };
    selectedZoneName = config.ui?.selectedZoneName || config.zones?.[0]?.name || null;
    initMap();
    renderEverything();
    setSelectedZone(selectedZoneName, false);
    switchTab(config.ui?.activeTab || 'zones');
    setDirty(false);
    Homey.ready();
  } catch (error) {
    notify(error.message || String(error), true);
    Homey.alert(error.message || String(error));
  }
}

window.onHomeyReady = onHomeyReady;
