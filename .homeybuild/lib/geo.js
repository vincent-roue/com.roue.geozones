'use strict';

const EARTH_RADIUS_M = 6371000;
const EPS = 1e-12;

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function isValidLat(value) {
  return isFiniteNumber(value) && Number(value) >= -90 && Number(value) <= 90;
}

function isValidLng(value) {
  return isFiniteNumber(value) && Number(value) >= -180 && Number(value) <= 180;
}

function isValidLatLng(point) {
  return point && isValidLat(point.lat) && isValidLng(point.lng);
}

function toRad(value) {
  return Number(value) * Math.PI / 180;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = (Math.sin(dLat / 2) ** 2)
    + (Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * (Math.sin(dLng / 2) ** 2));
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
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

function pointOnSegment(point, a, b) {
  const cross = ((point.lng - a.lng) * (b.lat - a.lat)) - ((point.lat - a.lat) * (b.lng - a.lng));
  if (Math.abs(cross) > EPS) return false;

  const dot = ((point.lng - a.lng) * (b.lng - a.lng)) + ((point.lat - a.lat) * (b.lat - a.lat));
  if (dot < -EPS) return false;

  const lenSq = ((b.lng - a.lng) ** 2) + ((b.lat - a.lat) ** 2);
  return dot <= lenSq + EPS;
}

function pointInPolygon(lat, lng, points) {
  if (!Array.isArray(points) || points.length < 3) return false;
  const point = { lat, lng };

  for (let i = 0; i < points.length; i += 1) {
    const next = (i + 1) % points.length;
    if (pointOnSegment(point, points[i], points[next])) return true;
  }

  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].lng;
    const yi = points[i].lat;
    const xj = points[j].lng;
    const yj = points[j].lat;

    const intersects = ((yi > lat) !== (yj > lat))
      && (lng <= (((xj - xi) * (lat - yi)) / ((yj - yi) || EPS)) + xi + EPS);

    if (intersects) inside = !inside;
  }

  return inside;
}
function orientation(a, b, c) {
  const value = ((b.lng - a.lng) * (c.lat - b.lat)) - ((b.lat - a.lat) * (c.lng - b.lng));
  if (Math.abs(value) <= EPS) return 0;
  return value > 0 ? 1 : 2;
}

function segmentsIntersect(p1, q1, p2, q2) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && pointOnSegment(p2, p1, q1)) return true;
  if (o2 === 0 && pointOnSegment(q2, p1, q1)) return true;
  if (o3 === 0 && pointOnSegment(p1, p2, q2)) return true;
  if (o4 === 0 && pointOnSegment(q1, p2, q2)) return true;
  return false;
}

function polygonHasSelfIntersection(points) {
  if (!Array.isArray(points) || points.length < 4) return false;
  const total = points.length;
  for (let i = 0; i < total; i += 1) {
    const a1 = points[i];
    const a2 = points[(i + 1) % total];
    for (let j = i + 1; j < total; j += 1) {
      const b1 = points[j];
      const b2 = points[(j + 1) % total];
      const shareVertex = i === j || (i + 1) % total === j || i === (j + 1) % total;
      if (shareVertex) continue;
      if (i === 0 && j === total - 1) continue;
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

function projectPoint(point, lat0, lng0) {
  const cosLat0 = Math.cos(toRad(lat0));
  return {
    x: toRad(Number(point.lng) - lng0) * EARTH_RADIUS_M * cosLat0,
    y: toRad(Number(point.lat) - lat0) * EARTH_RADIUS_M,
  };
}

function distancePointToSegmentMeters(point, a, b) {
  const lat0 = (Number(point.lat) + Number(a.lat) + Number(b.lat)) / 3;
  const lng0 = (Number(point.lng) + Number(a.lng) + Number(b.lng)) / 3;
  const p = projectPoint(point, lat0, lng0);
  const p1 = projectPoint(a, lat0, lng0);
  const p2 = projectPoint(b, lat0, lng0);

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = (dx * dx) + (dy * dy);
  if (lenSq <= EPS) return Math.sqrt(((p.x - p1.x) ** 2) + ((p.y - p1.y) ** 2));
  let t = (((p.x - p1.x) * dx) + ((p.y - p1.y) * dy)) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const nearestX = p1.x + (t * dx);
  const nearestY = p1.y + (t * dy);
  return Math.sqrt(((p.x - nearestX) ** 2) + ((p.y - nearestY) ** 2));
}

function distanceToPolygonBoundaryM(lat, lng, points) {
  if (!Array.isArray(points) || points.length < 2) return Infinity;
  const point = { lat: Number(lat), lng: Number(lng) };
  let minDistance = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const next = (i + 1) % points.length;
    const distance = distancePointToSegmentMeters(point, points[i], points[next]);
    if (distance < minDistance) minDistance = distance;
  }
  return minDistance;
}

function distanceToZoneBoundaryM(lat, lng, zone) {
  if (!zone) return Infinity;
  if (zone.type === 'circle') {
    const distance = haversineMeters(lat, lng, zone.center.lat, zone.center.lng);
    return Math.abs(distance - Number(zone.radius || 0));
  }
  if (zone.type === 'polygon') {
    return distanceToPolygonBoundaryM(lat, lng, zone.paths || []);
  }
  return Infinity;
}

module.exports = {
  EARTH_RADIUS_M,
  isFiniteNumber,
  isValidLat,
  isValidLng,
  isValidLatLng,
  haversineMeters,
  circleAreaM2,
  polygonAreaM2,
  pointInPolygon,
  polygonHasSelfIntersection,
  distanceToZoneBoundaryM,
};
