'use strict';

const { CLARK_COUNTY_WA, OREGON_METRO } = require('../data/regionOutlines');

/**
 * Haversine distance between two (lat, lng) pairs.
 * Returns distance in **meters**.
 */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Haversine distance in **miles**.
 */
function haversineMiles(lat1, lng1, lat2, lng2) {
  return haversineMeters(lat1, lng1, lat2, lng2) / 1609.344;
}

/**
 * Washington and Oregon west of 121°W (42°N–49°N): the Cascades and the
 * country west of them, over the Cascadia subduction zone. Copy that names
 * Cascadia is only true here. A high seismic design category can't stand in
 * for it: D and E also cover most of California, the Wasatch front, Alaska,
 * Memphis, Charleston, Hawaii and Puerto Rico. Every US point in the box is
 * in WA or OR; northern California's coast and the Columbia Basin fall
 * outside it and just get no Cascadia line.
 */
function isInCascadiaRegion(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  return Number.isFinite(la) && Number.isFinite(ln)
    && la >= 42 && la <= 49 && ln >= -125 && ln <= -121;
}

/** Even-odd ray cast: is the point inside a ring of [lng, lat] points? */
function isInRing(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Clark County, Washington, the pilot's county. Copy that names Clark
 * County, its cities or its PUD is only true here.
 */
function isInClarkCountyWA(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  return Number.isFinite(la) && Number.isFinite(ln) && isInRing(la, ln, CLARK_COUNTY_WA);
}

/**
 * Oregon Metro's district: Portland and its Oregon suburbs, where Metro's
 * recycling rules apply. They stop at the Columbia, and Clark County's
 * outline decides which side of the river a point is on.
 */
function isInOregonMetro(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  return Number.isFinite(la) && Number.isFinite(ln)
    && isInRing(la, ln, OREGON_METRO) && !isInRing(la, ln, CLARK_COUNTY_WA);
}

module.exports = {
  haversineMeters,
  haversineMiles,
  isInCascadiaRegion,
  isInClarkCountyWA,
  isInOregonMetro,
};
