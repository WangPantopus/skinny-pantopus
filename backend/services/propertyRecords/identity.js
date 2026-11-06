'use strict';

/**
 * The identity contract: which subject an address is, from the records a county's
 * release holds at its street name and house number. Every lookup answers one of
 *
 *   exact          one supported unit, or one single-unit property
 *   building_only  a building or complex matches and no unit record does
 *   parcel_only    land matches and no building or unit record does
 *   ambiguous      several plausible subjects; which one isn't for us to guess
 *   unsupported    no record
 *   restricted     the record is suppressed. Screens treat it as no record, so
 *                  the answer can't tell anyone a protected person lives there
 *   stale          the release is past its date (index.js decides that one)
 *
 * It never picks the first candidate, and a unit's private facts go out only on
 * `exact`. A wrong home's facts are worse than none. Where it asks which one, it
 * says what the choices are when they are few (`choices`): unit numbers and
 * urbanizaciones, never anything about who lives there.
 */

const same = (a, b) => (a || '') === (b || '');
// Equal, or one side doesn't say.
const agrees = (a, b) => !a || !b || a === b;

/** The records on this person's street: an exact reading of direction and type first, then any that only leave one out. */
function onStreet(query, records) {
  const here = records.filter((record) => record.address.number === query.number && record.address.name === query.name);
  const strict = here.filter(({ address }) => same(address.pre, query.pre) && same(address.suffix, query.suffix) && same(address.post, query.post));
  if (strict.length) return strict;
  return here.filter(({ address }) => agrees(address.pre, query.pre) && agrees(address.suffix, query.suffix) && agrees(address.post, query.post));
}

/** The same number and street exist in several urbanizaciones of one Puerto Rico ZIP. Both sides have to say which. */
function inUrbanization(query, records) {
  if (!query.urbanization) return records;
  return records.filter(({ address }) => !address.urbanization || address.urbanization === query.urbanization);
}

// More choices than this and the person types the number: a list that long is no help, and a tower's roster is its own business.
const MAX_CHOICES = 12;
const naturally = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** A building's units, or several records' unit numbers, when they are few enough to offer. */
function unitChoices(buildings, others) {
  const units = new Set();
  for (const building of buildings) for (const unit of building.roster || []) units.add(unit);
  for (const record of others) if (record.address.unit) units.add(`${record.address.building || ''}${record.address.unit}`);
  return { unit_count: units.size, ...(units.size && units.size <= MAX_CHOICES ? { choices: [...units].sort(naturally.compare) } : {}) };
}

/** ZIP decides when both sides have one: the same street line can exist in two towns of a county. */
function inZip(query, records) {
  if (!query.zip) return records;
  return records.filter(({ address }) => !address.zip || address.zip === query.zip);
}

/** Sources with no property ZIP name a town instead: the same street line in two towns of a county is told apart by it. */
function inTown(query, records) {
  if (!query.city || records.length < 2) return records;
  const named = records.filter(({ address }) => address.city === query.city);
  return named.length ? named : records;
}

function unitMatches(query, address) {
  if (!query.unit || !address.unit) return false;
  if (query.building && address.building) return query.building === address.building && query.unit === address.unit;
  // "BLDG A UNIT 101" on record; the person's line may say "A101" or just "101".
  return query.unit === address.unit || (Boolean(address.building) && query.unit === `${address.building}${address.unit}`);
}

const answer = (match, fields = {}) => ({ match, ...fields });

function subjectOf(record) {
  return { kind: record.kind, id: record.id };
}

function exact(record, requested, here) {
  // One protected unit restricts that unit, not its neighbors.
  if (record.restricted) return answer('restricted', { requested_subject: requested });
  const building = record.parent ? here.find((other) => other.kind === 'building' && other.id === record.parent) : null;
  return answer('exact', { subject: subjectOf(record), record, requested_subject: requested, ...(building ? { building } : {}) });
}

function buildingOnly(record, requested, reason) {
  if (record.restricted) return answer('restricted', { requested_subject: requested });
  return answer('building_only', { subject: subjectOf(record), record, requested_subject: requested, reason, ...unitChoices([record], []) });
}

function parcelOnly(record, requested) {
  if (record.restricted) return answer('restricted', { requested_subject: requested });
  return answer('parcel_only', { subject: subjectOf(record), record, requested_subject: requested });
}

function ambiguous(candidates, requested, reason) {
  return answer('ambiguous', {
    candidates: candidates.length,
    requested_subject: requested,
    reason,
    ...unitChoices(candidates.filter((record) => record.kind === 'building'), candidates.filter((record) => record.kind !== 'building')),
  });
}

/**
 * @param {object} address addressKey.parse()'s parts with `zip`
 * @param {object[]} records  What the release holds at this street name and house number
 */
function resolve(address, records) {
  // "BLDG A" with no unit under it: the building letter is what tells homes apart there.
  const query = !address.unit && address.building ? { ...address, unit: address.building, building: '' } : address;
  const here = inUrbanization(query, inTown(query, inZip(query, onStreet(query, records))));
  const requested = query.unit ? 'unit' : 'property';
  if (!here.length) return answer('unsupported', { reason: 'no_record', requested_subject: requested });
  if (!query.urbanization) {
    const urbanizations = [...new Set(here.map((record) => record.address.urbanization).filter(Boolean))].sort();
    if (urbanizations.length > 1) {
      return answer('ambiguous', { candidates: urbanizations.length, requested_subject: requested, reason: 'several_urbanizations', urbanizations: urbanizations.slice(0, MAX_CHOICES) });
    }
  }

  const units = here.filter((record) => record.kind === 'unit');
  // A mobile home in a park is a property of its own with a space number.
  const properties = here.filter((record) => record.kind === 'property');
  const buildings = here.filter((record) => record.kind === 'building');
  const parcels = here.filter((record) => record.kind === 'parcel' || record.kind === 'other');

  if (query.unit) {
    const own = [...units, ...properties].filter((record) => unitMatches(query, record.address));
    if (own.length === 1) return exact(own[0], requested, here);
    if (own.length > 1) return ambiguous(own, requested, 'several_records_for_this_unit');
    // The unit has no record of its own: what's known is the building it's in. The county's list of the building's
    // units says whether that unit exists; either way no unit facts go out.
    if (buildings.length === 1) {
      const listed = (buildings[0].roster || []).includes(query.unit);
      return buildingOnly(buildings[0], requested, listed ? 'unit_not_recorded' : 'unit_not_found');
    }
    if (buildings.length > 1) return ambiguous(buildings, requested, 'several_buildings');
    const plain = properties.filter((record) => !record.address.unit);
    // A house with an apartment in it: the record is the whole house, not this apartment.
    if (plain.length === 1 && !units.length) return buildingOnly(plain[0], requested, 'unit_not_recorded');
    if (units.length || plain.length) return ambiguous([...units, ...plain], requested, 'unit_not_found');
    if (parcels.length === 1) return parcelOnly(parcels[0], requested);
    return ambiguous(parcels, requested, 'several_parcels');
  }

  // No unit given. A home with its own street number needs none.
  const whole = [...properties, ...units].filter((record) => !record.address.unit);
  const withUnits = [...properties, ...units].filter((record) => record.address.unit);
  if (buildings.length === 1 && !whole.length) return buildingOnly(buildings[0], requested, 'unit_needed');
  if (buildings.length > 1 && !whole.length) return ambiguous(buildings, requested, 'several_buildings');
  // A condo with its own street number shares that number with its own building's record, and with nothing else.
  const others = buildings.filter((building) => !whole.some((record) => record.parent === building.id));
  if (whole.length === 1 && !withUnits.length && !others.length) return exact(whole[0], requested, here);
  if (whole.length > 1 || (whole.length && (others.length || withUnits.length))) {
    return ambiguous([...whole, ...others, ...withUnits], requested, 'several_homes');
  }
  if (withUnits.length) return ambiguous(withUnits, requested, 'unit_needed');
  if (parcels.length === 1) return parcelOnly(parcels[0], requested);
  return ambiguous(parcels, requested, 'several_parcels');
}

module.exports = { resolve };
