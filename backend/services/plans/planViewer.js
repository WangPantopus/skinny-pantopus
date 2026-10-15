'use strict';

/**
 * Who is looking at a plan: their flags, where they can be (homes, saved
 * places, a fresh GPS fix), whether their address is verified, and whom they
 * block or mute. One read per request; every Plans route builds on it.
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const parsePostGISPoint = require('../../utils/parsePostGISPoint');
const { isFeatureEnabled } = require('../featureFlagService');
const { getMuteAndHideFilters } = require('../feedService');
const { isVerifiedResident } = require('../../utils/homePermissions');
const { isFreshGps } = require('./planRules');
const { postScopeAccess } = require('../pulse/readAccess');

const VERIFIED_SELECT = 'home_id, verification_status, verification_source, verified_at, is_active';
// A household member in a trusted state (the same states that may read the household's mail,
// utils/homeMailAccess.js): never a pending claim, which anyone can file on any address.
const TRUSTED_OCCUPANCY_STATUSES = ['verified', 'provisional', 'provisional_bootstrap'];

/** Coordinates of a Home row: its geography point, or the map center the setup flow stored. */
function homePoint(home) {
  if (!home) return null;
  const point = parsePostGISPoint(home.location);
  if (point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) return point;
  const lat = Number(home.map_center_lat);
  const lng = Number(home.map_center_lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
  return null;
}

/** Users (of the given ids) who have a verified address: postcard, document, landlord or admin, never a household invite. */
async function verifiedUserIds(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
  if (ids.length === 0) return new Set();
  const { data, error } = await supabaseAdmin
    .from('HomeOccupancy')
    .select(`user_id, ${VERIFIED_SELECT}`)
    .in('user_id', ids)
    .eq('is_active', true)
    .eq('verification_status', 'verified');
  if (error) throw new Error(`Failed to read address verification: ${error.message}`);
  const verified = new Set();
  for (const occupancy of data || []) {
    if (isVerifiedResident({ occupancy })) verified.add(String(occupancy.user_id));
  }
  return verified;
}

async function loadHomes(userId) {
  const [occupancies, owned] = await Promise.all([
    supabaseAdmin
      .from('HomeOccupancy')
      .select(`${VERIFIED_SELECT}, home:home_id (id, address, address2, city, state, zipcode, location, map_center_lat, map_center_lng)`)
      .eq('user_id', userId)
      .eq('is_active', true),
    supabaseAdmin
      .from('Home')
      .select('id, address, address2, city, state, zipcode, location, map_center_lat, map_center_lng')
      .eq('owner_id', userId),
  ]);
  if (occupancies.error) throw new Error(`Failed to read homes: ${occupancies.error.message}`);
  if (owned.error) throw new Error(`Failed to read homes: ${owned.error.message}`);

  const homes = new Map();
  for (const row of occupancies.data || []) {
    if (!row.home) continue;
    homes.set(String(row.home.id), {
      ...row.home,
      verified: isVerifiedResident({ occupancy: row }),
      trusted: TRUSTED_OCCUPANCY_STATUSES.includes(row.verification_status),
    });
  }
  for (const home of owned.data || []) {
    if (!homes.has(String(home.id))) homes.set(String(home.id), { ...home, verified: false, trusted: false });
  }
  return [...homes.values()].map((home) => ({ ...home, point: homePoint(home) }));
}

async function loadSavedPlaces(userId) {
  const { data, error } = await supabaseAdmin
    .from('SavedPlace')
    .select('id, latitude, longitude, city')
    .eq('user_id', userId);
  if (error) {
    logger.warn('plans.viewer.saved_places_unavailable', { userId, error: error.message });
    return [];
  }
  return (data || []).filter((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)));
}

function parseGps(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const gps = {
    latitude: Number(raw.latitude),
    longitude: Number(raw.longitude),
    timestamp: raw.timestamp,
  };
  return isFreshGps(gps) ? gps : null;
}

/**
 * @param {{ id: string, role?: string }} user  req.user
 * @param {{ gps?: object, point?: { latitude: number, longitude: number } }} [opts]
 *   gps: a fix the app sent with this request (counts as a location for 5 minutes);
 *   point: where the app is looking from (the map or list center), used for distances
 *   only when the person has no home, saved place or fresh fix.
 */
async function loadViewer(user, opts = {}) {
  const userId = String(user.id);
  const [playdatesFlag, filters, homes, savedPlaces, scopeAccess, invites] = await Promise.all([
    isFeatureEnabled('plans_playdates', user),
    getMuteAndHideFilters(userId),
    loadHomes(userId),
    loadSavedPlaces(userId),
    postScopeAccess(userId),
    // Plans this person was invited to (S14 "People I invite"); a removed invitation grants nothing.
    supabaseAdmin.from('PlanRequest').select('post_id').eq('user_id', userId)
      .in('status', ['invited', 'accepted', 'waitlisted', 'left', 'withdrawn']).limit(1000),
  ]);
  if (invites.error) throw new Error(`Failed to load plan invitations: ${invites.error.message}`);
  const gps = parseGps(opts.gps);
  const verified = homes.some((home) => home.verified);

  const locations = [];
  if (gps) locations.push({ kind: 'gps', latitude: gps.latitude, longitude: gps.longitude });
  for (const home of homes) {
    if (home.point) locations.push({ kind: 'home', latitude: home.point.latitude, longitude: home.point.longitude, home_id: home.id });
  }
  for (const place of savedPlaces) {
    locations.push({ kind: 'saved_place', latitude: Number(place.latitude), longitude: Number(place.longitude) });
  }

  // Where distances are measured from: the person's own place (the first home,
  // else a saved place), so one plan shows one distance on every screen, in
  // both apps and after every action, whatever the request carried. Without
  // one: a fresh fix, then the point the app is looking from.
  const ownPlace = locations.find((l) => l.kind === 'home' || l.kind === 'saved_place');
  let origin = null;
  if (ownPlace) {
    origin = { latitude: ownPlace.latitude, longitude: ownPlace.longitude };
  } else if (gps) {
    origin = { latitude: gps.latitude, longitude: gps.longitude };
  } else if (opts.point && Number.isFinite(opts.point.latitude) && Number.isFinite(opts.point.longitude)) {
    origin = { latitude: opts.point.latitude, longitude: opts.point.longitude };
  }

  return {
    id: userId,
    role: user.role || null,
    scopeAccess,
    verified,
    // Playdates exist for a viewer only with the flag on and a verified address.
    seesPlaydates: Boolean(playdatesFlag) && verified,
    playdatesFlag: Boolean(playdatesFlag),
    homes,
    savedPlaces,
    gps,
    locations,
    origin,
    blockedUserIds: filters.blockedUserIds || new Set(),
    mutedUserIds: filters.mutedUserIds || new Set(),
    hiddenPostIds: filters.hiddenPostIds || new Set(),
    planInvites: new Set((invites.data || []).map((row) => String(row.post_id))),
  };
}

module.exports = {
  TRUSTED_OCCUPANCY_STATUSES,
  loadViewer,
  verifiedUserIds,
  homePoint,
  parseGps,
};
