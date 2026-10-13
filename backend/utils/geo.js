'use strict';

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

module.exports = { haversineMeters, haversineMiles, isInCascadiaRegion };
