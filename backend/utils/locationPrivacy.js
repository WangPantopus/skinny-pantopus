'use strict';

/**
 * Location Privacy Enforcement
 *
 * Applies coordinate precision rules before API responses are sent.
 * See docs/location-privacy-matrix.md for the full policy.
 *
 * Usage:
 *   const { applyLocationPrecision } = require('../utils/locationPrivacy');
 *   applyLocationPrecision(gig, gig.location_precision, isOwner);
 */

/**
 * Apply location precision rules to an object that has lat/lng fields.
 *
 * Mutates `obj` in place and returns it for chaining convenience.
 *
 * @param {Object} obj                   The entity (gig, post, listing, etc.)
 * @param {string} precision             One of: exact_place, approx_area, neighborhood_only, none
 * @param {boolean} [isOwner=false]      If true, coordinates are returned unchanged
 * @param {Object} [opts]                Options
 * @param {string} [opts.latField='latitude']   Name of latitude field on obj
 * @param {string} [opts.lngField='longitude']  Name of longitude field on obj
 * @param {boolean} [opts.stripAddress=true]    Whether to null out address fields
 * @returns {Object} obj (mutated)
 */
function applyLocationPrecision(obj, precision, isOwner = false, opts = {}) {
  if (!obj) return obj;

  // Set locationUnlocked flag — true when viewer gets exact coordinates
  if (opts.setUnlockedFlag !== false) {
    obj.locationUnlocked = isOwner || precision === 'exact_place';
  }

  if (isOwner) return obj;
  if (precision === 'exact_place') return obj;

  const latField = opts.latField || 'latitude';
  const lngField = opts.lngField || 'longitude';
  const stripAddress = opts.stripAddress !== false;

  const lat = obj[latField];
  const lng = obj[lngField];

  switch (precision) {
    case 'approx_area': {
      // Jitter ±0.005 (~500m). Use a seeded-ish jitter based on the coords
      // so the same entity always gets the same offset (no flickering on reload).
      if (lat != null && lng != null) {
        const seed = Math.abs(lat * 1000 + lng * 1000) % 1;
        const jitterLat = (seed - 0.5) * 0.01;     // ±0.005
        const jitterLng = ((seed * 7) % 1 - 0.5) * 0.01;
        obj[latField] = Math.round((lat + jitterLat) * 1000) / 1000;  // 3 decimal places
        obj[lngField] = Math.round((lng + jitterLng) * 1000) / 1000;
      }
      if (stripAddress) {
        obj.location_address = null;
        obj.exact_address = null;
      }
      break;
    }

    case 'neighborhood_only': {
      // Round to 2 decimal places (~1.1km precision)
      if (lat != null) obj[latField] = Math.round(lat * 100) / 100;
      if (lng != null) obj[lngField] = Math.round(lng * 100) / 100;
      if (stripAddress) {
        obj.location_address = null;
        obj.exact_address = null;
      }
      break;
    }

    case 'none': {
      obj[latField] = null;
      obj[lngField] = null;
      if (stripAddress) {
        obj.location_address = null;
        obj.exact_address = null;
        obj.location_name = null;
      }
      break;
    }

    default:
      // Unknown precision — treat as approx_area for safety
      return applyLocationPrecision(obj, 'approx_area', false, opts);
  }

  return obj;
}

/**
 * Determine effective precision for a gig based on viewer relationship.
 *
 * @param {Object} gig           The gig row
 * @param {string|null} viewerId The current viewer's user ID (null = anonymous)
 * @returns {{ precision: string, isOwner: boolean }}
 */
function resolveGigPrecision(gig, viewerId) {
  const isOwner = viewerId && (
    gig.user_id === viewerId ||
    gig.created_by === viewerId ||
    gig.beneficiary_user_id === viewerId
  );

  if (isOwner) return { precision: 'exact_place', isOwner: true, locationUnlocked: true };

  const isAssigned = viewerId && gig.accepted_by === viewerId;
  const gigStatus = gig.status || '';
  const assignedStatuses = ['assigned', 'active', 'in_progress', 'completed'];
  if (isAssigned && assignedStatuses.includes(gigStatus)) {
    return { precision: 'exact_place', isOwner: false, locationUnlocked: true };
  }

  const revealPolicy = gig.reveal_policy || 'after_assignment';
  const basePrecision = gig.location_precision || 'approx_area';

  if (revealPolicy === 'never_public') {
    return { precision: Math.max(precisionRank(basePrecision), precisionRank('approx_area')) === precisionRank(basePrecision) ? basePrecision : 'approx_area', isOwner: false, locationUnlocked: false };
  }

  return { precision: basePrecision, isOwner: false, locationUnlocked: false };
}

/**
 * Rank precision levels (lower = more precise).
 */
function precisionRank(p) {
  switch (p) {
    case 'exact_place': return 0;
    case 'approx_area': return 1;
    case 'neighborhood_only': return 2;
    case 'none': return 3;
    default: return 1;
  }
}

/**
 * Pick the less-precise of two precision levels.
 */
function leastPrecise(a, b) {
  return precisionRank(a) >= precisionRank(b) ? a : b;
}

module.exports = {
  applyLocationPrecision,
  resolveGigPrecision,
  precisionRank,
  leastPrecise,
};
