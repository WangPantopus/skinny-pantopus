'use strict';

/**
 * The address registry's shape (scripts/property-index/build-registry.cjs writes
 * it, registry.js reads it). It uses the property index's format (format.js):
 * per-county releases, sorted by street name and house number, under its own
 * prefix, `registry/`. Its records say what exists at an address and where:
 *
 *   property  an address with no units on record
 *   building  an address with units; `roster` lists them
 *   unit      one unit of a building
 *
 * each with `address`, `point` [lng, lat] where the unit has its own, `q` (how the
 * point was placed), `use` and `s` (which of the county's `sources` it came from).
 * IDs aren't stored: an ID is the hash of what the address is, so a release, a
 * lookup and a later release all reach the same one.
 */

const crypto = require('crypto');

const REGISTRY_PREFIX = 'registry';
const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';
const ID_PREFIX = { property: 'addr', building: 'bldg', unit: 'unit' };
// How a point was placed, best first. A pin takes the best a source offers.
const QUALITIES = ['rooftop', 'entrance', 'structure', 'site', 'access', 'unknown', 'parcel', 'geocoded'];

function base32(bytes, length) {
  let out = '';
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5 && out.length < length) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
    if (out.length >= length) break;
  }
  return out;
}

function addressHash(fips, a) {
  const text = [fips, a.number, a.pre, a.name, a.suffix, a.post, a.urbanization, a.building, a.unit, a.zip].map((part) => part || '').join('|');
  return base32(crypto.createHash('sha256').update(text).digest(), 16);
}

/** A subject's Pantopus ID. Stable for as long as what it names stays the same; a change is a lineage event. */
function registryId(fips, kind, address) {
  return `pp:${ID_PREFIX[kind] || 'addr'}:${fips}:${addressHash(fips, address)}`;
}

module.exports = { REGISTRY_PREFIX, ID_PREFIX, QUALITIES, registryId };
