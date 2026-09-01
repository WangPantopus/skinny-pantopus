/**
 * Verified Coordinate Guard
 *
 * Prevents non-verified geocode writes from overwriting coordinates that
 * were produced by the address validation pipeline (geocode_mode: 'verified').
 *
 * Usage:
 *   const { shouldBlockCoordinateOverwrite } = require('../utils/verifiedCoordinateGuard');
 *
 *   // In a route handler that updates coordinates:
 *   const block = shouldBlockCoordinateOverwrite(existingRow, incomingGeocode);
 *   if (block.blocked) {
 *     // Remove coordinate fields from update or reject request
 *   }
 */

const logger = require('./logger');

/**
 * Check whether an incoming coordinate write should be blocked because
 * the existing row has verified coordinates.
 *
 * @param {Object} existingRow - Current DB row (must include geocode_mode)
 * @param {Object} incoming    - Incoming update fields
 * @param {string} [incoming.geocode_mode] - Mode of the incoming geocode
 * @param {string} [context]   - Human-readable context for logging (e.g. "PATCH /api/homes/:id")
 * @returns {{ blocked: boolean, reason?: string }}
 */
function shouldBlockCoordinateOverwrite(existingRow, incoming, context) {
  if (!existingRow) return { blocked: false };

  const existingMode = existingRow.geocode_mode;
  const incomingMode = incoming?.geocode_mode;

  // Only protect rows that are verified
  if (existingMode !== 'verified') return { blocked: false };

  // Allow verified-to-verified overwrites (re-validation pipeline)
  if (incomingMode === 'verified') return { blocked: false };

  // Block: non-verified trying to overwrite verified
  const reason = `Blocked non-verified geocode (mode: '${incomingMode || 'unset'}') ` +
    `from overwriting verified coordinates (existing mode: 'verified')`;

  logger.warn('verified_coordinate_guard_blocked', {
    context: context || 'unknown',
    existing_mode: existingMode,
    incoming_mode: incomingMode || 'unset',
  });

  return { blocked: true, reason };
}

/**
 * Strip coordinate and geocode fields from an update object,
 * preserving all other fields. Use when a coordinate overwrite is blocked
 * but the rest of the update should proceed.
 *
 * @param {Object} updates - The update object to sanitize
 * @returns {Object} The update object with coordinate fields removed
 */
function stripCoordinateFields(updates) {
  const coordinateFields = [
    'location', 'latitude', 'longitude',
    'exact_location', 'approx_location',
    'pickup_location', 'dropoff_location',
    'map_center_lat', 'map_center_lng',
    'geocode_provider', 'geocode_mode', 'geocode_accuracy',
    'geocode_place_id', 'geocode_source_flow', 'geocode_created_at',
  ];

  const stripped = { ...updates };
  for (const field of coordinateFields) {
    delete stripped[field];
  }
  return stripped;
}

module.exports = {
  shouldBlockCoordinateOverwrite,
  stripCoordinateFields,
};
