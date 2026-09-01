/**
 * locationPrivacy.js — Shared location privacy transformer for marketplace listings.
 *
 * Every listing response path (browse, discover, detail, search, saved) must run
 * listings through this transformer so that coordinates are never leaked beyond
 * what the listing's privacy settings allow.
 *
 * Rules by location_precision × reveal_policy:
 *
 *   exact_place + public          → exact coordinates returned
 *   exact_place + any other       → non-owners get hash-blurred ±0.003° (~300 m)
 *   approx_area  (any policy)     → non-owners get hash-blurred ±0.005° (~500 m)
 *   neighborhood_only             → non-owners get null lat/lng, keep location_name
 *   none                          → non-owners get null lat/lng/name/address
 *
 * location_address is always nulled for non-owners unless reveal_policy is "public".
 * Owners always see their own exact data.
 * Null viewer is treated as non-owner.
 *
 * Blur is deterministic per listing (hash-based on listing ID) so the blurred
 * position is stable across requests.
 */

const crypto = require('crypto');
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');

// ---------------------------------------------------------------------------
// Deterministic hash-based offset
// ---------------------------------------------------------------------------

/**
 * Produce a stable pseudo-random offset in [-magnitude, +magnitude] for a
 * given listing ID and axis ('lat' | 'lng').  Uses HMAC-SHA256 so the mapping
 * is unpredictable without the key, yet perfectly repeatable.
 */
const BLUR_HMAC_KEY = 'marketplace-location-blur-v1';

function hashOffset(listingId, axis, magnitude) {
  const hmac = crypto.createHmac('sha256', BLUR_HMAC_KEY);
  hmac.update(`${listingId}:${axis}`);
  const buf = hmac.digest();
  // Use the first 4 bytes as an unsigned 32-bit integer
  const uint32 = buf.readUInt32BE(0);
  // Map to [-1, +1) then scale by magnitude
  const normalized = (uint32 / 0xFFFFFFFF) * 2 - 1;
  return normalized * magnitude;
}

// ---------------------------------------------------------------------------
// Core transformer
// ---------------------------------------------------------------------------

/**
 * Apply location privacy rules to a single listing row.
 *
 * @param {object} listing      — plain listing object (will NOT be mutated)
 * @param {string|null} viewerUserId — authenticated viewer's ID, or null
 * @param {object} [opts]       — options
 * @param {Set<string>} [opts.grantedUserIds] — Set of user IDs who have been
 *   granted address access for this listing (avoids per-call DB query)
 * @returns {object} a shallow copy with location fields transformed
 */
function applyLocationPrivacy(listing, viewerUserId, opts = {}) {
  // Always work on a copy
  const out = { ...listing };

  const isOwner =
    viewerUserId != null &&
    String(out.user_id) === String(viewerUserId);

  // Owners always see full data
  if (isOwner) {
    out.locationUnlocked = true;
    return out;
  }

  // Check address grants
  const grantedUserIds = opts.grantedUserIds || null;
  const isGrantee = grantedUserIds != null &&
    viewerUserId != null &&
    grantedUserIds.has(String(viewerUserId));

  if (isGrantee) {
    out.locationUnlocked = true;
    return out;
  }

  out.locationUnlocked = false;

  const precision = out.location_precision || 'approx_area';
  const policy = out.reveal_policy || 'after_interest';

  // ── location_address redaction ──
  if (policy !== 'public') {
    out.location_address = null;
  }

  switch (precision) {
    case 'exact_place':
      if (policy === 'public') {
        // Return exact — no transformation
        break;
      }
      // Blur ±0.003° (~300 m)
      if (out.latitude != null && out.longitude != null) {
        out.latitude = out.latitude + hashOffset(out.id, 'lat', 0.003);
        out.longitude = out.longitude + hashOffset(out.id, 'lng', 0.003);
      }
      break;

    case 'approx_area':
      // Blur ±0.005° (~500 m)
      if (out.latitude != null && out.longitude != null) {
        out.latitude = out.latitude + hashOffset(out.id, 'lat', 0.005);
        out.longitude = out.longitude + hashOffset(out.id, 'lng', 0.005);
      }
      out.location_address = null;
      break;

    case 'neighborhood_only':
      out.latitude = null;
      out.longitude = null;
      out.location_address = null;
      break;

    case 'none':
      out.latitude = null;
      out.longitude = null;
      out.location_name = null;
      out.location_address = null;
      break;

    default:
      // Unknown precision — treat as approx_area (safe default)
      if (out.latitude != null && out.longitude != null) {
        out.latitude = out.latitude + hashOffset(out.id, 'lat', 0.005);
        out.longitude = out.longitude + hashOffset(out.id, 'lng', 0.005);
      }
      out.location_address = null;
      break;
  }

  return out;
}

/**
 * Batch-fetch all address grants a viewer has for a set of listings.
 *
 * Returns a Map<listingId, Set<granteeUserId>>. For list-view callers, the
 * returned map contains entries only for listings that have granted the viewer.
 *
 * @param {string} viewerUserId
 * @param {string[]} listingIds
 * @returns {Promise<Map<string, Set<string>>>}
 */
async function fetchGrantsForViewer(viewerUserId, listingIds) {
  const map = new Map();
  if (!viewerUserId || !listingIds || listingIds.length === 0) return map;

  const { data, error } = await supabaseAdmin
    .from('ListingAddressGrant')
    .select('listing_id')
    .eq('grantee_user_id', viewerUserId)
    .in('listing_id', listingIds);

  if (error) {
    logger.warn('fetchGrantsForViewer failed, proceeding without grants', { error: error.message });
    return map;
  }

  for (const row of data || []) {
    const lid = String(row.listing_id);
    if (!map.has(lid)) map.set(lid, new Set());
    map.get(lid).add(String(viewerUserId));
  }
  return map;
}

/**
 * Batch-transform an array of listing rows.
 *
 * When `opts.grantsByListingId` is not provided and there is an authenticated
 * viewer, this function automatically batch-queries ListingAddressGrant so that
 * granted viewers see exact coordinates in list views (one query, not N+1).
 *
 * @param {object[]} listings
 * @param {string|null} viewerUserId
 * @param {object} [opts]
 * @param {Map<string, Set<string>>} [opts.grantsByListingId] — pre-fetched map;
 *   when supplied the DB query is skipped.
 * @returns {Promise<object[]>}
 */
async function applyLocationPrivacyBatch(listings, viewerUserId, opts = {}) {
  let grantsByListingId = opts.grantsByListingId || null;

  // Auto-fetch grants when caller didn't supply them
  if (!grantsByListingId && viewerUserId && listings.length > 0) {
    const listingIds = listings.map(l => String(l.id)).filter(Boolean);
    grantsByListingId = await fetchGrantsForViewer(viewerUserId, listingIds);
  }

  return listings.map(l => {
    const listingOpts = {};
    if (grantsByListingId && l.id) {
      listingOpts.grantedUserIds = grantsByListingId.get(String(l.id)) || null;
    }
    return applyLocationPrivacy(l, viewerUserId, listingOpts);
  });
}

module.exports = {
  applyLocationPrivacy,
  applyLocationPrivacyBatch,
  fetchGrantsForViewer,
  // Exported for testing
  hashOffset,
};
