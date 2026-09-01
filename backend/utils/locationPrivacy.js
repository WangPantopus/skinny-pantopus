'use strict';

const crypto = require('crypto');

/**
 * Key material for coordinate jitter.
 *
 * PRV-15: the jitter used to be a deterministic arithmetic function of the true
 * coordinates (`Math.abs(lat * 1000 + lng * 1000) % 1`). Anyone holding a
 * published "±500m" point could enumerate candidate true coordinates on a fine
 * grid, apply the same public transform, and keep the candidate that reproduced
 * the published value — recovering the exact location the jitter existed to
 * hide. Keying the offset makes the transform unreproducible without the
 * secret, while keeping it stable per entity so pins do not flicker on reload.
 *
 * Falls back to the service-role key, which is already required for the process
 * to boot and is stable across restarts, so this needs no new configuration.
 * Set LOCATION_JITTER_SECRET to rotate it independently.
 */
const JITTER_KEY = process.env.LOCATION_JITTER_SECRET
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || 'pantopus-location-jitter-dev-only';

/**
 * Two independent, stable pseudo-random values in [0, 1) for a coordinate pair.
 * @returns {[number, number]}
 */
function keyedJitterSeeds(lat, lng) {
  const digest = crypto
    .createHmac('sha256', JITTER_KEY)
    .update(`${lat},${lng}`)
    .digest();

  return [
    digest.readUInt32BE(0) / 0x100000000,
    digest.readUInt32BE(4) / 0x100000000,
  ];
}

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
      // Jitter ±0.005 (~500m), keyed so the offset is stable for a given
      // coordinate pair but cannot be recomputed by anyone without the secret.
      if (lat != null && lng != null) {
        const [seedLat, seedLng] = keyedJitterSeeds(lat, lng);
        const jitterLat = (seedLat - 0.5) * 0.01;  // ±0.005
        const jitterLng = (seedLng - 0.5) * 0.01;
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
