// Where a Moment is, in words others read (docs/location-privacy-matrix.md, place labels): a named place ("Esther Short
// Park"), else the street's name without a number ("West 13th Street"), else the town ("Vancouver, WA"); never a street
// address. A Moment shown as an area, and one posted at the author's own home, says only the town: a place's or a
// street's name would give the spot away. The Post sheet asks first (POST /api/moments/place-preview), so the author
// sees the words before posting, and may pick another of the names that fit the spot (`places`): the server makes that
// list and takes back only a key from it, so nobody writes a place's name themselves. The Post sheet's place picker
// (the Pulse composer's, around the Moment's pin) may also name a venue a little farther off, the coffee shop or the
// stadium the photo was taken in: the app sends only the venue's id, and venueNear finds it again near the pin.

const crypto = require('crypto');
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
// The Post sheet's list of names for an exact pin: the places at or within this far of it, then the street, then the
// town; this many at most.
const PICK_VENUE_M = 100;
const MAX_PLACES = 6;
// The place picker's venues: this far from the pin at most (a venue whose outline holds the pin is 0 m away). The pin
// moves to the venue, so it stays in the same part of town as the photo.
const PICK_PLACE_M = 1500;
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

// The place that names the spot among the venues around it, or null.
function namingVenue(places) {
  const holding = places.find((place) => place.contains);
  const nearest = places.find((place) => !place.contains && place.distance_m <= VENUE_NAMES_SPOT_M);
  return holding && !(nearest && nearest.distance_m <= RIGHT_AT_VENUE_M) ? holding : nearest || holding || null;
}

// The named places around the point, the one that names the spot first, then the others at or within PICK_VENUE_M,
// nearest first. venuesNear lists the outlines that hold the point smallest first.
function venuesAt(latitude, longitude) {
  return cached(`v:${latitude.toFixed(4)}:${longitude.toFixed(4)}`, async () => {
    const { places, loading } = await venues.venuesNear({ latitude, longitude, limit: 12, waitMs: VENUE_WAIT_MS });
    const named = (places || []).filter((place) => place?.name);
    const best = namingVenue(named);
    // Still loading: the next ask may know more, so it isn't kept.
    if (loading && !best) throw Object.assign(new Error('venues still loading'), { quiet: true });
    const others = named.filter((place) => place !== best && (place.contains || place.distance_m <= PICK_VENUE_M))
      .sort((a, b) => (a.contains ? 0 : a.distance_m) - (b.contains ? 0 : b.distance_m));
    return [best, ...others].filter(Boolean).map((place) => ({
      // Opaque, and the same every time this venue is listed.
      key: `v_${crypto.createHash('sha256').update(String(place.place_id ?? place.name)).digest('hex').slice(0, 16)}`,
      label: String(place.name).slice(0, 80),
    }));
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
 * The labels for a point: { place_label, area_label, places }. `place_label` is what an exact pin says unless its
 * author picks another of `places`, `area_label` what an area pin (and a home) says. `places` are the names that fit
 * an exact pin, [{ key, label }], at most MAX_PLACES: the places right there, then the street's name, then the town;
 * the first is `place_label`. Never throws; a label nobody could find is FALLBACK_LABEL.
 */
async function labelsAt(latitude, longitude) {
  const [venueList, ts] = await Promise.all([
    settle(venuesAt(latitude, longitude), 'venues'),
    settle(townAndStreet(latitude, longitude), 'reverse'),
  ]);
  const town = ts?.town || null;
  const fixed = [ts?.street && { key: 'street', label: ts.street }, town && { key: 'town', label: town }].filter(Boolean);
  const places = [];
  for (const place of [...(venueList || []).slice(0, MAX_PLACES - fixed.length), ...fixed]) {
    if (!places.some((listed) => listed.label.toLowerCase() === place.label.toLowerCase())) places.push(place);
  }
  if (!places.length) places.push({ key: 'auto', label: FALLBACK_LABEL });
  return { place_label: places[0].label, area_label: town || FALLBACK_LABEL, places };
}

/** The label a Post sheet's pick (`key`, from labelsAt's places for this same point) stands for, or null. */
function pickedLabel(labels, key) {
  if (typeof key !== 'string' || !key) return null;
  return (labels?.places || []).find((place) => place.key === key)?.label || null;
}

/**
 * The venue the place picker listed as `venueId` (an `osm:` id) when it is within PICK_PLACE_M of the pin:
 * { latitude, longitude, label } at the venue's point, or null. Never throws (a lookup that fails is null).
 */
async function venueNear(venueId, latitude, longitude) {
  const venue = await settle(venues.venueNear({ placeId: venueId, latitude, longitude, maxDistance: PICK_PLACE_M }),
    'venue');
  if (!venue?.name || !Number.isFinite(venue.center?.lat) || !Number.isFinite(venue.center?.lng)) return null;
  return { latitude: venue.center.lat, longitude: venue.center.lng, label: String(venue.name).slice(0, 80) };
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

/**
 * What kind of name `label` is among a point's labels: 'place' (a venue), 'street', 'town', or 'none' when nobody
 * could name the spot. The push says "At" a place, "On" a street and "In" a town.
 */
function labelKind(labels, label) {
  if (!label || label === FALLBACK_LABEL) return 'none';
  const key = (labels?.places || []).find((place) => place.label === label)?.key;
  if (key === 'street' || key === 'town') return key;
  if (key === 'auto') return 'none';
  return label === labels?.area_label ? 'town' : 'place';
}

module.exports = { labelsAt, pickedLabel, labelKind, isAtHome, venueNear, FALLBACK_LABEL, AT_HOME_M, PICK_PLACE_M };
