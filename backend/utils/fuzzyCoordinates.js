/**
 * Generate privacy-preserving offset coordinates for home-based businesses.
 * Produces a deterministic-ish random point within a ring (minMeters..maxMeters)
 * around the real location.
 */

/**
 * @param {number} lat - Real latitude
 * @param {number} lng - Real longitude
 * @param {number} minMeters - Minimum offset distance (default 150)
 * @param {number} maxMeters - Maximum offset distance (default 400)
 * @returns {{ lat: number, lng: number }}
 */
function generateFuzzyCoordinates(lat, lng, minMeters = 150, maxMeters = 400) {
  // Random angle in radians
  const angle = Math.random() * 2 * Math.PI;
  // Random distance between min and max
  const distance = minMeters + Math.random() * (maxMeters - minMeters);

  // Earth radius in meters
  const R = 6371000;

  // Offset in degrees
  const dLat = (distance * Math.cos(angle)) / R * (180 / Math.PI);
  const dLng = (distance * Math.sin(angle)) / (R * Math.cos(lat * Math.PI / 180)) * (180 / Math.PI);

  return {
    lat: lat + dLat,
    lng: lng + dLng,
  };
}

module.exports = { generateFuzzyCoordinates };
