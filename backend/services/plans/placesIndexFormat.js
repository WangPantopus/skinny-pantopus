'use strict';

/**
 * What the public places index holds and how (placesIndex.js reads it,
 * scripts/places/build-index.cjs writes it). No dependencies, so the build
 * runs without the backend's packages.
 */

const FORMAT = 1;
// Areas are geohash-4 cells (~20 × 28 km at 45°N).
const PRECISION = 4;

// What the picker shows: [OSM types ("n" node, "w" way), key, values]. The Overpass
// query (planPlaces.overpassQuery) and the index build both come from this list.
const SELECTORS = [
  ['nw', 'leisure', ['park', 'playground', 'pitch']],
  ['w', 'leisure', ['dog_park', 'nature_reserve']],
  ['nw', 'amenity', ['library', 'community_centre', 'cafe', 'pub', 'restaurant']],
  ['n', 'amenity', ['ice_cream', 'bar']],
];

// The tags planPlaces reads (categoryOf, addressOf, traitsOf, court names); the index keeps only these.
const TAGS = [
  'name', 'leisure', 'amenity', 'sport', 'highway', 'addr:housenumber', 'addr:street', 'addr:city',
  'opening_hours', 'lit', 'covered', 'indoor', 'internet_access', 'outdoor_seating', 'toilets',
  'wheelchair', 'dog', 'fee',
];

/** True when an element of this type ("n" or "w") with these tags is one the picker asks for. */
function selected(type, tags) {
  return SELECTORS.some(([types, key, values]) => types.includes(type) && values.includes(tags[key]));
}

/**
 * The place-tag picker's venues (backend/services/geo/venues.js): every kind of
 * named place a post can be tagged at. A second index beside the Plans one,
 * built in the same run from the same extracts and published beside it as
 * venues-manifest.json and venues-<yyyymmdd>.bin. It has its own list, so
 * nothing here changes what the Plans picker shows. The manifest records
 * VERSION, and a published index built from an older list is never read (the
 * picker asks Overpass instead) until a build catches up. Bump VERSION with any
 * change to SELECTORS or TAGS.
 */
const VENUES = {
  NAME: 'venues',
  VERSION: 1,
  // Geohash-5 areas (~4.9 × 4.9 km): a downtown holds thousands of venues, so
  // they're read in smaller pieces than the Plans areas.
  PRECISION: 5,
  // [OSM types ("n" node, "w" way, "r" relation), key, values ("*": any)]. Only
  // named elements count (venueSelected).
  SELECTORS: [
    ['nwr', 'amenity', [
      'restaurant', 'fast_food', 'cafe', 'bar', 'pub', 'biergarten', 'ice_cream', 'food_court', 'nightclub',
      'theatre', 'cinema', 'arts_centre', 'events_venue', 'conference_centre', 'exhibition_centre', 'music_venue',
      'casino', 'planetarium', 'community_centre', 'library', 'townhall', 'courthouse', 'marketplace',
      'school', 'college', 'university', 'kindergarten', 'place_of_worship',
      'hospital', 'clinic', 'doctors', 'dentist', 'pharmacy', 'veterinary', 'bus_station', 'ferry_terminal',
    ]],
    ['nwr', 'leisure', [
      'park', 'garden', 'nature_reserve', 'dog_park', 'playground', 'stadium', 'sports_centre', 'fitness_centre',
      'golf_course', 'ice_rink', 'water_park', 'marina', 'bowling_alley', 'amusement_arcade', 'miniature_golf',
    ]],
    ['nwr', 'tourism', [
      'museum', 'attraction', 'zoo', 'aquarium', 'theme_park', 'gallery', 'hotel', 'motel', 'hostel', 'viewpoint',
      'camp_site',
    ]],
    ['nwr', 'shop', '*'],
    ['nwr', 'craft', ['brewery', 'winery', 'distillery']],
    ['nwr', 'railway', ['station']],
    ['nwr', 'aeroway', ['aerodrome']],
    ['nwr', 'place', ['square']],
    ['nwr', 'natural', ['beach', 'peak']],
    ['n', 'waterway', ['waterfall']],
  ],
  // The tags venues.js reads (its category, label and address); the index keeps only these.
  TAGS: [
    'name', 'amenity', 'leisure', 'tourism', 'shop', 'craft', 'railway', 'aeroway', 'place', 'natural', 'waterway',
    'cuisine', 'religion', 'sport', 'addr:housenumber', 'addr:street', 'addr:city', 'addr:state',
  ],
};

/** True when an element of this type ("n", "w" or "r") with these tags is a venue the place-tag picker lists. */
function venueSelected(type, tags) {
  if (typeof tags.name !== 'string' || !tags.name.trim()) return false;
  return VENUES.SELECTORS.some(([types, key, values]) => types.includes(type) && typeof tags[key] === 'string'
    && (values === '*' ? tags[key] !== 'no' : values.includes(tags[key])));
}

const round = (degrees) => Math.round(degrees * 1e6) / 1e6;

/**
 * An element as the index stores it: [type, id, lat, lng, tags], coordinates
 * to ~10 cm, the middle of a way's bounding box (as Overpass's `out center`).
 * A way also stores half its box's height and width in degrees, so a park
 * that reaches into a box counts there even when its middle is outside it, as
 * with Overpass. `keep` is the set's tag list (the Plans TAGS unless given).
 */
function encodeElement(type, id, lat, lng, tags, halfLat = 0, halfLng = 0, keep = TAGS) {
  const kept = {};
  for (const key of keep) if (typeof tags[key] === 'string') kept[key] = tags[key];
  const element = [type, id, round(lat), round(lng), kept];
  if (halfLat > 0 || halfLng > 0) element.push(round(halfLat), round(halfLng));
  return element;
}

const ELEMENT_TYPES = { n: 'node', w: 'way', r: 'relation' };

/** A stored element in the shape Overpass answers (planPlaces.toPlaces reads either), plus its half box. */
function decodeElement([type, id, lat, lon, tags, halfLat = 0, halfLng = 0]) {
  return { type: ELEMENT_TYPES[type] || 'node', id, lat, lon, tags, halfLat, halfLng };
}

module.exports = {
  FORMAT, PRECISION, SELECTORS, TAGS, VENUES, selected, venueSelected, encodeElement, decodeElement,
};
