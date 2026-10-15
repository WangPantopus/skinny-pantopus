'use strict';

// Offline polygon lookup: state/longitude bands cannot describe US time-zone
// boundaries (including the Aleutians, split states, and Arizona's exceptions).
const { find } = require('geo-tz');
const parsePostGISPoint = require('./parsePostGISPoint');

function validTimezone(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

function coordinates(latitude, longitude) {
  if (latitude == null || longitude == null || latitude === '' || longitude === '') return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180
    || (lat === 0 && lng === 0)) return null;
  return { latitude: lat, longitude: lng };
}

function timezoneFromCoordinates(latitude, longitude, fallback = 'UTC') {
  const point = coordinates(latitude, longitude);
  if (point) {
    const zones = find(point.latitude, point.longitude);
    // At a shared boundary, retain an applicable explicit choice.
    const preferred = validTimezone(fallback);
    if (preferred && zones.includes(preferred)) return preferred;
    for (const zone of zones) {
      if (validTimezone(zone)) return zone;
    }
  }
  return validTimezone(fallback) || (fallback === null ? null : 'UTC');
}

function resolveHomeTimezone(home, fallback = 'UTC') {
  const explicit = validTimezone(home?.timezone);
  if (explicit) return explicit;
  const parsed = parsePostGISPoint(home?.location);
  const point = coordinates(home?.map_center_lat, home?.map_center_lng)
    || coordinates(home?.latitude, home?.longitude)
    || coordinates(parsed?.latitude, parsed?.longitude);
  return timezoneFromCoordinates(point?.latitude, point?.longitude, fallback);
}

module.exports = { validTimezone, timezoneFromCoordinates, resolveHomeTimezone };
