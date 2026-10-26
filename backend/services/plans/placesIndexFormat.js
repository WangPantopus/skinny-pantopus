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

const round = (degrees) => Math.round(degrees * 1e6) / 1e6;

/**
 * An element as the index stores it: [type, id, lat, lng, tags], coordinates
 * to ~10 cm, the middle of a way's bounding box (as Overpass's `out center`).
 * A way also stores half its box's height and width in degrees, so a park
 * that reaches into a box counts there even when its middle is outside it, as
 * with Overpass.
 */
function encodeElement(type, id, lat, lng, tags, halfLat = 0, halfLng = 0) {
  const kept = {};
  for (const key of TAGS) if (typeof tags[key] === 'string') kept[key] = tags[key];
  const element = [type, id, round(lat), round(lng), kept];
  if (halfLat > 0 || halfLng > 0) element.push(round(halfLat), round(halfLng));
  return element;
}

/** A stored element in the shape Overpass answers (planPlaces.toPlaces reads either), plus its half box. */
function decodeElement([type, id, lat, lon, tags, halfLat = 0, halfLng = 0]) {
  return { type: type === 'w' ? 'way' : 'node', id, lat, lon, tags, halfLat, halfLng };
}

module.exports = { FORMAT, PRECISION, SELECTORS, TAGS, selected, encodeElement, decodeElement };
