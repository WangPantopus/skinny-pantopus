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
 *   exact_place + any other       → non-owners get the approximate point
 *   approx_area  (any policy)     → non-owners get the approximate point
 *   neighborhood_only             → non-owners get null lat/lng, keep location_name
 *   none                          → non-owners get null lat/lng/name/address
 *
 * The approximate point is the shared approx_area rule in utils/locationPrivacy.js:
 * the point's 0.005° grid cell, moved by an offset keyed with LOCATION_JITTER_SECRET.
 * It is stable across requests, every listing posted from one place shows the same
 * point, and it can't be traced back to the stored point without the secret.
 *
 * location_address is always nulled for non-owners unless reveal_policy is "public".
 * Owners and address grantees always see their exact data.
 * Null viewer is treated as non-owner.
 *
 * Area searches, distances and sort orders must use the point the viewer is
 * shown, never the stored one: a filter, count or distance computed from the
 * stored point gives it away. See listingSearchPoint and widenBounds.
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const {
  APPROX_AREA_MAX_SHIFT_DEGREES,
  applyLocationPrecision,
} = require('../../utils/locationPrivacy');

/** Replaces the listing's point with the shared approximate point. */
function approximate(listing) {
  if (listing.latitude == null || listing.longitude == null) {
    listing.latitude = null;
    listing.longitude = null;
    return;
  }
  applyLocationPrecision(listing, 'approx_area', false, { setUnlockedFlag: false, stripAddress: false });
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
      approximate(out);
      break;

    case 'approx_area':
      approximate(out);
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
      approximate(out);
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

  // Area searches pass hundreds of candidate ids, too many for a URL filter, so
  // read the viewer's grants and match them here.
  const { data, error } = await supabaseAdmin
    .from('ListingAddressGrant')
    .select('listing_id')
    .eq('grantee_user_id', viewerUserId);

  if (error) {
    logger.warn('fetchGrantsForViewer failed, proceeding without grants', { error: error.message });
    return map;
  }

  const wanted = new Set(listingIds.map(String));
  for (const row of data || []) {
    const lid = String(row.listing_id);
    if (!wanted.has(lid)) continue;
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

// ---------------------------------------------------------------------------
// Searching by the shown point
// ---------------------------------------------------------------------------

/**
 * Area searches read stored points from the area widened by this margin, which
 * finds every listing whose shown point could be inside it, and then keep only
 * the listings whose search point is (listingSearchPoint). A shown point is
 * never more than APPROX_AREA_MAX_SHIFT_DEGREES from the stored one on an axis.
 */
const SEARCH_MARGIN_DEGREES = APPROX_AREA_MAX_SHIFT_DEGREES + 0.001;

// The margin as a distance: its diagonal where a degree of longitude is longest.
const SEARCH_MARGIN_METERS = Math.ceil(SEARCH_MARGIN_DEGREES * 111320 * Math.SQRT2);

/** The box to read stored points from for a search by shown points inside `bounds`. */
function widenBounds({ south, west, north, east }) {
  return {
    south: Math.max(south - SEARCH_MARGIN_DEGREES, -90),
    west: west - SEARCH_MARGIN_DEGREES,
    north: Math.min(north + SEARCH_MARGIN_DEGREES, 90),
    east: east + SEARCH_MARGIN_DEGREES,
  };
}

/** The radius to read stored points from for a search by shown points within `radiusMeters`. */
function widenRadiusMeters(radiusMeters) {
  // The extra 1% covers PostGIS measuring on the spheroid and haversine on a sphere.
  return Math.ceil(radiusMeters * 1.01) + SEARCH_MARGIN_METERS;
}

/**
 * The point area searches, distances and sort orders use for a listing, given
 * its stored row and the copy the viewer is shown: the shown point, or for a
 * listing shown without one (neighborhood_only, none) its approximate point,
 * which is never returned. Null when the listing has no stored point (remote).
 */
function listingSearchPoint(stored, shown) {
  if (shown.latitude != null && shown.longitude != null) {
    return { latitude: shown.latitude, longitude: shown.longitude };
  }
  if (stored.latitude == null || stored.longitude == null) return null;
  const point = { latitude: stored.latitude, longitude: stored.longitude };
  approximate(point);
  return point;
}

/**
 * applyLocationPrivacyBatch, with each shown listing paired with its search point.
 *
 * @returns {Promise<Array<{ listing: object, point: ?{ latitude: number, longitude: number } }>>}
 */
async function applyLocationPrivacyWithSearchPoints(listings, viewerUserId, opts = {}) {
  const shown = await applyLocationPrivacyBatch(listings, viewerUserId, opts);
  return shown.map((listing, i) => ({ listing, point: listingSearchPoint(listings[i], listing) }));
}

function isPointInBounds(point, { south, west, north, east }) {
  return point != null
    && point.latitude >= south && point.latitude <= north
    && point.longitude >= west && point.longitude <= east;
}

module.exports = {
  applyLocationPrivacy,
  applyLocationPrivacyBatch,
  applyLocationPrivacyWithSearchPoints,
  fetchGrantsForViewer,
  isPointInBounds,
  listingSearchPoint,
  widenBounds,
  widenRadiusMeters,
};
