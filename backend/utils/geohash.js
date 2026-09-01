'use strict';
/**
 * Geohash utilities — encode/decode geohash-6 (~1.2km × 0.6km cells).
 *
 * Shared across cold-start seeding (posts.js), neighborhood preview
 * refresh job, and neighborhood fact service.
 *
 * @module geohash
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode a latitude/longitude pair into a geohash string.
 * @param {number} lat  - Latitude  (-90 to 90)
 * @param {number} lng  - Longitude (-180 to 180)
 * @param {number} [precision=6] - Number of characters in the hash
 * @returns {string} Geohash of the requested precision
 */
function encodeGeohash(lat, lng, precision = 6) {
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;
  let bits = 0;
  let hash = '';
  let bitCount = 0;
  let isLng = true;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) { bits = (bits << 1) | 1; lngMin = mid; }
      else { bits = bits << 1; lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { bits = (bits << 1) | 1; latMin = mid; }
      else { bits = bits << 1; latMax = mid; }
    }
    isLng = !isLng;
    bitCount++;
    if (bitCount === 5) {
      hash += BASE32[bits];
      bits = 0;
      bitCount = 0;
    }
  }
  return hash;
}

/**
 * Decode a geohash string into a bounding box.
 * @returns {{ minLat: number, maxLat: number, minLng: number, maxLng: number }}
 */
function decodeGeohashBbox(geohash) {
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  let isLng = true;
  for (const ch of geohash) {
    const idx = BASE32.indexOf(ch);
    if (idx === -1) break;
    for (let bit = 4; bit >= 0; bit--) {
      if (isLng) {
        const mid = (lngMin + lngMax) / 2;
        if ((idx >> bit) & 1) lngMin = mid; else lngMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if ((idx >> bit) & 1) latMin = mid; else latMax = mid;
      }
      isLng = !isLng;
    }
  }
  return { minLat: latMin, maxLat: latMax, minLng: lngMin, maxLng: lngMax };
}

module.exports = { encodeGeohash, encodeGeohash6: encodeGeohash, decodeGeohashBbox };
