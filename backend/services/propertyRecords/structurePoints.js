'use strict';

/**
 * The national floor by location: finding a home's building from a point, for the
 * states whose federal file has no readable address on its structures. No
 * dependencies, so the index build uses it too (scripts/property-index/sources/
 * us-structure-points.cjs writes the index; estimates.js reads it). What's found
 * only ever fills the labeled estimate slot, same as the floor by address.
 *
 * Under <root>/estimates/points, in the property index's format (format.js): one
 * release per state, sorted by map cell, so a lookup reads the blocks around a
 * point. Records hold no address text, and no point that came from a vendor:
 *
 *   key    the map cell
 *   at     [lng, lat] the structure's middle
 *   ring   its outline, as x, y offsets from `at` in half meters
 *   use    h house, m multifamily, f manufactured home, r a residence of no stated
 *          type, x anything else (a store, a school, a hotel)
 *   num    the house number FEMA has for it, where FEMA has one
 *   homes  how many of the Army Corps of Engineers' residential structures stand on it, when more than one
 *   claim  which address's point marks this building in the address registry: its
 *          house number, or + when two or more addresses do
 *   facts  estimateFacts.js's names, nothing else
 *   img    the year of the imagery or lidar its outline was drawn from, where FEMA's file gives one
 *          (scripts/property-index/lib/measure.cjs names it on a measured row)
 *
 * The identity check is `resolve` below. A point can land on a neighbor's building,
 * and a neighbor's own registry point lands there too: that's what `claim` catches.
 * A footprint nobody claims rests on the geometry alone, so the rule is stricter
 * than "nearest", and scripts/property-index/check-structure-points.cjs measures how
 * often it's still wrong, holding FEMA's addresses out.
 */

const METERS_PER_DEGREE = 111320;
const CELLS_PER_DEGREE = 500;
const OFFSETS_PER_METER = 2;
// Farther from a footprint than this and the point isn't saying anything about that building.
const NEAR_METERS = 10;
// Outside any footprint, the nearest has to be this much closer than the next one to be the one meant.
const SEPARATION_METERS = 8;
// How much of the houses around a building the registry has to mark before a mark on this one says anything (a point always
// marks what it falls on): all of a few, or this share of three or more. A building with no house around needs none. Short
// of that the geometry is all there is, and it's strict: inside a single-family footprint no bigger than a house usually is
// (a larger one is usually a row of houses drawn as one), with the next house clear of it.
const MARKED_SHARE = 0.6;
const MARKED_AROUND_AT_LEAST = 3;
const LARGEST_HOUSE_SQFT = 2500;
const CLEAR_METERS = 10;
// Under this it's a shed or a garage, not somebody's house.
const MIN_HOUSE_SQFT = 400;
// Footprints wider than this are indexed under every cell they touch; smaller ones are always within SEARCH_METERS of their cell's search.
const WIDE_METERS = 40;
const SEARCH_METERS = NEAR_METERS + WIDE_METERS;
// More than the check needs, and enough to read a roofline: a footprint's outline keeps this many corners at most.
const MAX_CORNERS = 32;
const USE_CODES = { 'Single Family Dwelling': 'h', 'Multi - Family Dwelling': 'm', 'Manufactured Home': 'f' };
const HOME_USES = new Set(['h', 'm', 'f', 'r']);
const MANY = '+';

const SPREAD = Array.from({ length: 512 }, (_, value) => {
  let spread = 0;
  for (let bit = 0; bit < 9; bit += 1) if (value & (1 << bit)) spread += 2 ** (bit * 2);
  return spread;
});
const spread = (value) => SPREAD[value & 511] + SPREAD[(value >> 9) & 511] * 2 ** 18;

/** A map cell as one number, in an order that keeps neighbors close, so a lookup's few cells usually share a block. */
function cellNumber(lng, lat) {
  const column = Math.floor((lng + 180) * CELLS_PER_DEGREE);
  const row = Math.floor((lat + 90) * CELLS_PER_DEGREE);
  return spread(column) + 2 * spread(row);
}

const cellKey = (number) => number.toString(16).padStart(10, '0');

/** Every cell within `meters` of a point. */
function cellsNear(lng, lat, meters = SEARCH_METERS) {
  const dy = meters / METERS_PER_DEGREE;
  const dx = dy / Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  const cells = new Set();
  for (let row = Math.floor((lat - dy + 90) * CELLS_PER_DEGREE); row <= Math.floor((lat + dy + 90) * CELLS_PER_DEGREE); row += 1) {
    for (let column = Math.floor((lng - dx + 180) * CELLS_PER_DEGREE); column <= Math.floor((lng + dx + 180) * CELLS_PER_DEGREE); column += 1) {
      cells.add(spread(column) + 2 * spread(row));
    }
  }
  return [...cells];
}

/** Meters from a point to a footprint's outline, negative inside it. */
function distanceToRing(lng, lat, record) {
  const px = (lng - record.at[0]) * Math.cos((record.at[1] * Math.PI) / 180) * METERS_PER_DEGREE * OFFSETS_PER_METER;
  const py = (lat - record.at[1]) * METERS_PER_DEGREE * OFFSETS_PER_METER;
  const { ring } = record;
  let inside = false;
  let best = Infinity;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i] - px;
    const yi = ring[i + 1] - py;
    const xj = ring[j] - px;
    const yj = ring[j + 1] - py;
    if ((yi > 0) !== (yj > 0) && ((xj - xi) * -yi) / (yj - yi) + xi > 0) inside = !inside;
    const dx = xj - xi;
    const dy = yj - yi;
    const length = dx * dx + dy * dy;
    const along = length ? Math.max(0, Math.min(1, -(xi * dx + yi * dy) / length)) : 0;
    const distance = Math.hypot(xi + along * dx, yi + along * dy);
    if (distance < best) best = distance;
  }
  return (inside ? -best : best) / OFFSETS_PER_METER;
}

/** The first whole number in a house number, so 12-14 and 12A are both house 12. */
function houseBase(number) {
  const found = /\d+/.exec(String(number ?? ''));
  return found ? found[0].replace(/^0+(?=\d)/, '') : '';
}

const sameHouse = (a, b) => {
  const base = houseBase(a);
  return Boolean(base) && base === houseBase(b);
};

/**
 * Which structure this point marks, on the geometry alone: the footprint it falls in, or the nearest within a short
 * distance and clearly nearer than the next. Sheds don't count, and a point on something that isn't a home finds nothing.
 * @returns {{ structure: object, distance: number }|{ why: string }}
 */
function underPoint(lng, lat, records) {
  const seen = new Set();
  let onOther = false;
  let first = null;
  let second = Infinity;
  let houses = 0;
  let marked = 0;
  for (const record of records) {
    const id = `${record.at[0]},${record.at[1]}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const distance = distanceToRing(lng, lat, record);
    if (!HOME_USES.has(record.use)) {
      if (distance <= 0) onOther = true;
      continue;
    }
    if ((record.facts?.footprint_sqft || 0) < MIN_HOUSE_SQFT) continue;
    if (distance <= SEARCH_METERS) {
      houses += 1;
      if (record.claim) marked += 1;
    }
    if (!first || distance < first.distance) {
      if (first) second = first.distance;
      first = { structure: record, distance };
    } else if (distance < second) second = distance;
  }
  if (onOther) return { why: 'not_a_home' };
  if (!first || first.distance > NEAR_METERS) return { why: 'no_structure' };
  if (first.distance > 0 && second - first.distance < SEPARATION_METERS) return { why: 'two_close' };
  // Not counting itself.
  if (first.structure.claim) marked -= 1;
  houses -= 1;
  // No other house around: there's nothing for the point to be mistaken for. A few: each has to be marked. More: most.
  let backed = houses === 0;
  if (houses > 0 && houses < MARKED_AROUND_AT_LEAST) backed = marked === houses;
  else if (houses >= MARKED_AROUND_AT_LEAST) backed = marked / houses >= MARKED_SHARE;
  return { ...first, nextHouse: second - Math.max(first.distance, 0), backed };
}

/**
 * The identity check: which building this home is, or why that can't be said.
 * @param {{ lng: number, lat: number }} point
 * @param {object[]} records  What the index holds around the point (cellsNear)
 * @param {{ number: string, holdOut?: boolean, ignoreClaims?: boolean }} home  Its house number. `holdOut` and
 *   `ignoreClaims` are for measuring: the check leaves FEMA's number, or the registry's claims, out of its reasoning.
 * @returns {{ structure: object, how: 'inside'|'near', distance: number }|{ why: string }}
 */
function resolve(point, records, { number, holdOut = false, ignoreClaims = false }) {
  const found = underPoint(point.lng, point.lat, records);
  if (found.why) return found;
  const { structure, distance, nextHouse, backed } = found;
  const claim = ignoreClaims ? null : structure.claim;
  if (claim === MANY) return { why: 'shared_building' };
  if (claim && !sameHouse(claim, number)) return { why: 'claimed_by_another' };
  if (!holdOut && structure.num && !sameHouse(structure.num, number)) return { why: 'another_number' };
  // Measured with FEMA's addresses held out: where the Army Corps counts several homes on one footprint, it's usually a row
  // of houses drawn as one; and a point just outside anything but a house is too loose, marked or not.
  if (structure.homes > 1) return { why: 'several_homes' };
  if (distance > 0 && structure.use !== 'h') return { why: 'not_sure_enough' };
  // Where the registry marks the houses around this one, a neighbor's point would have shown up here.
  if (!backed && !(structure.use === 'h' && distance <= 0 && structure.facts.footprint_sqft <= LARGEST_HOUSE_SQFT && nextHouse >= CLEAR_METERS)) return { why: 'not_sure_enough' };
  return { structure, how: distance <= 0 ? 'inside' : 'near', distance, nextHouse };
}

module.exports = {
  CELLS_PER_DEGREE, METERS_PER_DEGREE, OFFSETS_PER_METER, NEAR_METERS, WIDE_METERS, SEARCH_METERS, MAX_CORNERS, MIN_HOUSE_SQFT, USE_CODES, HOME_USES, MANY,
  cellNumber, cellKey, cellsNear, distanceToRing, houseBase, sameHouse, underPoint, resolve,
};
