'use strict';

const LATITUDE_CAPABILITY_CANDIDATES = ['measure_latitude', 'latitude'];
const LONGITUDE_CAPABILITY_CANDIDATES = ['measure_longitude', 'longitude'];

function getDeviceCapabilityNames(device) {
  const capabilitiesObj = device?.capabilitiesObj || {};
  return Array.isArray(device?.capabilities)
    ? device.capabilities.map(String)
    : Object.keys(capabilitiesObj || {});
}

function detectLocationCapabilities(device) {
  const capabilities = getDeviceCapabilityNames(device);
  const latCapability = LATITUDE_CAPABILITY_CANDIDATES.find(capability => capabilities.includes(capability)) || '';
  const lngCapability = LONGITUDE_CAPABILITY_CANDIDATES.find(capability => capabilities.includes(capability)) || '';
  if (!latCapability || !lngCapability) return null;
  return { latCapability, lngCapability, capabilities };
}

function hasLocationCapabilities(device) {
  return Boolean(detectLocationCapabilities(device));
}

function getDeviceCoordinates(device, source = null) {
  const capabilitiesObj = device?.capabilitiesObj || {};
  const detected = detectLocationCapabilities(device);
  const latCapability = String(source?.latCapability || detected?.latCapability || 'measure_latitude');
  const lngCapability = String(source?.lngCapability || detected?.lngCapability || 'measure_longitude');

  const latitude = Number(
    device?.latitude
    ?? capabilitiesObj[latCapability]?.value
    ?? capabilitiesObj.measure_latitude?.value
    ?? capabilitiesObj.latitude?.value
  );
  const longitude = Number(
    device?.longitude
    ?? capabilitiesObj[lngCapability]?.value
    ?? capabilitiesObj.measure_longitude?.value
    ?? capabilitiesObj.longitude?.value
  );
  const latitudeUpdated = device?.latitudeUpdated ?? capabilitiesObj[latCapability]?.lastUpdated ?? capabilitiesObj.measure_latitude?.lastUpdated ?? capabilitiesObj.latitude?.lastUpdated ?? null;
  const longitudeUpdated = device?.longitudeUpdated ?? capabilitiesObj[lngCapability]?.lastUpdated ?? capabilitiesObj.measure_longitude?.lastUpdated ?? capabilitiesObj.longitude?.lastUpdated ?? null;

  return {
    latCapability,
    lngCapability,
    latitude,
    longitude,
    latitudeUpdated,
    longitudeUpdated,
  };
}

function normalizeLocationDevice(device, config = {}, diagnostics = {}) {
  const locationCapabilities = detectLocationCapabilities(device);
  if (!locationCapabilities) return null;

  const existing = (config.sources || []).find(source => source.deviceId === device.id);
  const capabilities = locationCapabilities.capabilities;
  const coords = getDeviceCoordinates(device, existing || locationCapabilities);

  return {
    id: device.id,
    name: device.name,
    zoneName: device.zoneNameResolved || device.zoneName || device.zone || '',
    driverUri: device.driverUri || '',
    capabilities,
    alreadyAdded: Boolean(existing),
    subjectId: existing?.subjectId || null,
    latCapability: coords.latCapability,
    lngCapability: coords.lngCapability,
    latitude: Number.isFinite(coords.latitude) ? coords.latitude : null,
    longitude: Number.isFinite(coords.longitude) ? coords.longitude : null,
    latitudeUpdated: coords.latitudeUpdated,
    longitudeUpdated: coords.longitudeUpdated,
    diagnostics,
  };
}

async function fetchDevicesFromHomeyApi(homey, getConfig) {
  const config = getConfig(homey);
  const diagnostics = { source: 'homeyApi.devices.getDevices()' };
  const homeyApi = homey.app?.homeyApi;

  if (!homeyApi?.devices?.getDevices) {
    throw new Error('Homey API session not initialized');
  }

  const devicesObj = await homeyApi.devices.getDevices();

  let zonesObj = {};
  try {
    if (homeyApi.zones?.getZones) {
      zonesObj = await homeyApi.zones.getZones();
    }
  } catch (error) {
    diagnostics.zoneError = error.message || String(error);
  }

  return Object.values(devicesObj || {})
    .map(device => {
      const zoneNameResolved = zonesObj?.[device.zone]?.name || '';
      return normalizeLocationDevice({ ...device, zoneNameResolved }, config, diagnostics);
    })
    .filter(Boolean);
}

async function listLocationDevices(homey, getConfig) {
  try {
    const devices = await fetchDevicesFromHomeyApi(homey, getConfig);
    return {
      devices: devices.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
      attempts: [{ path: 'homeyApi.devices.getDevices()', ok: true, count: devices.length }],
    };
  } catch (error) {
    return {
      devices: [],
      attempts: [{ path: 'homeyApi.devices.getDevices()', ok: false, error: error.message || String(error) }],
    };
  }
}

module.exports = {
  LATITUDE_CAPABILITY_CANDIDATES,
  LONGITUDE_CAPABILITY_CANDIDATES,
  detectLocationCapabilities,
  getDeviceCoordinates,
  hasLocationCapabilities,
  normalizeLocationDevice,
  listLocationDevices,
};
