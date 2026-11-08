// Where a Moment is, in words others read (docs/location-privacy-matrix.md, place labels): a named place ("Esther Short
// Park"), else the street's name without a number ("West 13th Street"), else the town ("Vancouver, WA"); never a street
// address. A Moment shown as an area, and one posted at the author's own home, says only the town: a place's or a
// street's name would give the spot away. The Post sheet asks first (POST /api/moments/place-preview), so the author
// sees the words before posting.

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const geoProvider = require('../geo');
const venues = require('../geo/venues');
const parsePostGISPoint = require('../../utils/parsePostGISPoint');
const { haversineMeters } = require('../../utils/trustState');

// The place whose outline holds the point names the spot (the park, the stadium; the smallest one when several do),
// unless the pin is right at a venue mapped as a point; with no outline, a venue this close does.
const VENUE_NAMES_SPOT_M = 40;
const RIGHT_AT_VENUE_M = 10;
// The Post sheet's home notice: a pin this close to a home the person lives at.
const AT_HOME_M = 60;
const VENUE_WAIT_MS = 2500;
const CACHE_MS = 60 * 60 * 1000;
// What's said when no provider answers; rare, and still not an address.
const FALLBACK_LABEL = 'Nearby';
// A house number and then a word: how the geocoder writes a street line ("4014 Tacoma Court").
const STREET_LINE = /^\s*\d+[a-z]?(?:-\d+)?\s+(\S.*)$/i;

const cache = new Map();

function cached(key, make) {
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const value = make().catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { value, until: Date.now() + CACHE_MS });
  if (cache.size > 2000) cache.delete(cache.keys().next().value);
  return value;
}

// The town and the street's name at a point (one reverse geocode, kept for an hour per ~11 m).
function townAndStreet(latitude, longitude) {
  return cached(`ts:${latitude.toFixed(4)}:${longitude.toFixed(4)}`, async () => {
    const found = await geoProvider.reverseGeocode(latitude, longitude);
    const town = found?.city ? [found.city, found.state].filter(Boolean).join(', ') : null;
    const street = STREET_LINE.exec(String(found?.address || ''))?.[1]?.split(',')[0]?.trim() || null;
    return { town, street };
  });
}

// The named place at the point, or null. venuesNear lists the outlines that hold the point smallest first.
function venueAt(latitude, longitude) {
  return cached(`v:${latitude.toFixed(4)}:${longitude.toFixed(4)}`, async () => {
    const { places, loading } = await venues.venuesNear({ latitude, longitude, limit: 10, waitMs: VENUE_WAIT_MS });
    const holding = (places || []).find((place) => place.contains);
    const nearest = (places || []).find((place) => !place.contains && place.distance_m <= VENUE_NAMES_SPOT_M);
    const best = holding && !(nearest && nearest.distance_m <= RIGHT_AT_VENUE_M) ? holding : nearest || holding;
    // Still loading: the next ask may know more, so it isn't kept.
    if (loading && !best) throw Object.assign(new Error('venues still loading'), { quiet: true });
    return best?.name ? String(best.name).slice(0, 80) : null;
  });
}

async function settle(promise, what) {
  try {
    return await promise;
  } catch (error) {
    if (!error.quiet) logger.warn('moments.place_lookup_failed', { what, error: error.message });
    return null;
  }
}

/**
 * The labels for a point: { place_label, area_label }. `place_label` is what an exact pin says, `area_label` what an
 * area pin (and a home) says. Never throws; a label nobody could find is FALLBACK_LABEL.
 */
async function labelsAt(latitude, longitude) {
  const [venue, ts] = await Promise.all([
    settle(venueAt(latitude, longitude), 'venues'),
    settle(townAndStreet(latitude, longitude), 'reverse'),
  ]);
  const town = ts?.town || null;
  const place = venue || ts?.street || town;
  return { place_label: place || FALLBACK_LABEL, area_label: town || FALLBACK_LABEL };
}

/** Whether the point is within AT_HOME_M of a home the person lives at (householdHomeIds; fails closed to false). */
async function isAtHome(userId, latitude, longitude) {
  const { householdHomeIds } = require('../../utils/homeMailAccess');
  const homeIds = await householdHomeIds(userId);
  if (!homeIds.length) return false;
  const { data, error } = await supabaseAdmin.from('Home').select('id, location').in('id', homeIds);
  if (error) {
    logger.warn('moments.at_home_failed', { error: error.message });
    return false;
  }
  return (data || []).some((home) => {
    const point = parsePostGISPoint(home.location);
    return point && haversineMeters(latitude, longitude, point.latitude, point.longitude) <= AT_HOME_M;
  });
}

module.exports = { labelsAt, isAtHome, FALLBACK_LABEL, AT_HOME_M };
