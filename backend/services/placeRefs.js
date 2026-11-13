'use strict';

/**
 * One key for a place (the business graph's shared pieces, section 3).
 *
 * A `place_ref` is text in one of three forms:
 *
 *   osm:(node|way|relation)/<digits>   a named place of the places index, the id the place pickers and
 *                                      Moments already use
 *   loc:<uuid>                         a BusinessLocation row
 *   addr:<64 hex>                      an address_hash, the fingerprint BusinessAddress and HomeAddress carry
 *
 * Rules kept here:
 *  - An `addr:` key is never sent to an app and never put in a link: it is for matching on the server.
 *  - Nothing here reads Home or HomeAddress. Whether an address is someone's home is the business address
 *    check's question (services/businessAddressService.js), not this file's.
 *  - `locationsAt` answers only with places people walk into: a storefront, an office or a warehouse. Never a
 *    business working from a home, a service area, a mailing address or a location of unknown type (which may
 *    be any of those), never an inactive location, and never a business whose page isn't published.
 *  - A business location's own named place (BusinessLocation.place_ref) is set only by the owner's pick or
 *    confirmation. Nothing here guesses one.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const NAMED_PLACE = /^osm:(node|way|relation)\/(\d{1,19})$/;
const LOCATION = /^loc:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const ADDRESS = /^addr:([0-9a-f]{64})$/;

/**
 * The form of a key and its id, or null when the text is not a key.
 * @returns {{ form: 'named_place'|'location'|'address', id: string, ref: string }|null}
 */
function parsePlaceRef(text) {
  if (typeof text !== 'string') return null;
  const ref = text.trim();
  if (!ref || ref.length > 80) return null;
  let match = NAMED_PLACE.exec(ref);
  if (match) return { form: 'named_place', id: `${match[1]}/${match[2]}`, ref };
  const lower = ref.toLowerCase();
  match = LOCATION.exec(lower);
  if (match) return { form: 'location', id: match[1], ref: lower };
  match = ADDRESS.exec(lower);
  if (match) return { form: 'address', id: match[1], ref: lower };
  return null;
}

/** The text when it is a named place's key (`osm:node/123`), else null. */
function namedPlaceRef(text) {
  const parsed = parsePlaceRef(text);
  return parsed && parsed.form === 'named_place' ? parsed.ref : null;
}

// The location types that are a place people walk into. Everything else (home_based_private, service_area_only,
// mailing_only, unknown, or no type) may be someone's home, so it is never tied to a place for anyone to see.
const PUBLIC_LOCATION_TYPES = Object.freeze(['storefront', 'office', 'warehouse']);

/** A location that may be tied to a place for anyone to see: active, and of a type people walk into. */
function isPublicLocation(location) {
  return Boolean(location)
    && location.is_active === true
    && PUBLIC_LOCATION_TYPES.includes(location.location_type);
}

const LOCATION_COLUMNS = 'id, business_user_id, label, is_active, is_primary, location_type, address_hash, place_ref';

/**
 * The keys of one business location: `{ loc, addr, osm }`. `addr` is null without an address fingerprint and
 * `osm` is null until the owner has said which named place the location is. Null when there is no such location.
 */
async function refsOfLocation(locationId) {
  const parsed = parsePlaceRef(`loc:${String(locationId || '').toLowerCase()}`);
  if (!parsed) return null;
  const { data, error } = await supabaseAdmin.from('BusinessLocation')
    .select(LOCATION_COLUMNS).eq('id', parsed.id).maybeSingle();
  if (error) throw new Error(`Failed to load the business location: ${error.message}`);
  if (!data) return null;
  return {
    loc: `loc:${String(data.id).toLowerCase()}`,
    addr: data.address_hash ? `addr:${String(data.address_hash).toLowerCase()}` : null,
    osm: namedPlaceRef(data.place_ref),
  };
}

/** Of these business accounts, the ones whose page is published. */
async function publishedBusinessIds(businessUserIds) {
  const ids = [...new Set((businessUserIds || []).map(String))];
  if (ids.length === 0) return new Set();
  const { data, error } = await supabaseAdmin.from('BusinessProfile')
    .select('business_user_id, is_published').in('business_user_id', ids).eq('is_published', true);
  if (error) throw new Error(`Failed to load business pages: ${error.message}`);
  return new Set((data || []).map((row) => String(row.business_user_id)));
}

/**
 * The published businesses' public locations at a named place or an address. Each answer is
 * `{ location_id, business_user_id, label, is_primary }`. A named place no business has picked answers with
 * nothing, and so does a key of a form that names no shared place.
 */
async function locationsAt(ref) {
  const parsed = parsePlaceRef(ref);
  if (!parsed) return [];
  let query = supabaseAdmin.from('BusinessLocation').select(LOCATION_COLUMNS).eq('is_active', true);
  if (parsed.form === 'named_place') query = query.eq('place_ref', parsed.ref);
  else if (parsed.form === 'address') query = query.eq('address_hash', parsed.id);
  else query = query.eq('id', parsed.id);
  const { data, error } = await query.limit(50);
  if (error) throw new Error(`Failed to load business locations: ${error.message}`);
  const open = (data || []).filter(isPublicLocation);
  const published = await publishedBusinessIds(open.map((row) => row.business_user_id));
  return open
    .filter((row) => published.has(String(row.business_user_id)))
    .map((row) => ({
      location_id: row.id,
      business_user_id: row.business_user_id,
      label: row.label,
      is_primary: row.is_primary === true,
    }));
}

/**
 * True when two keys are known to be one place: the same key, or a business location and a key that location
 * carries. Two keys nothing ties together are not the same place, however close they are on the map.
 */
async function samePlace(a, b) {
  const first = parsePlaceRef(a);
  const second = parsePlaceRef(b);
  if (!first || !second) return false;
  if (first.ref === second.ref) return true;
  try {
    for (const [location, other] of [[first, second], [second, first]]) {
      if (location.form !== 'location') continue;
      const refs = await refsOfLocation(location.id);
      if (refs && (refs.addr === other.ref || refs.osm === other.ref)) return true;
    }
    if (first.form === 'location' && second.form === 'location') {
      const [one, two] = await Promise.all([refsOfLocation(first.id), refsOfLocation(second.id)]);
      return Boolean(one && two && ((one.osm && one.osm === two.osm) || (one.addr && one.addr === two.addr)));
    }
  } catch (err) {
    logger.warn('placeRefs.same_place_failed', { error: err.message });
  }
  return false;
}

module.exports = {
  PUBLIC_LOCATION_TYPES, parsePlaceRef, namedPlaceRef, isPublicLocation, refsOfLocation, locationsAt, samePlace,
};
