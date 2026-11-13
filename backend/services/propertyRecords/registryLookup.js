'use strict';

/**
 * One lookup in the address registry, given how to read it: the part with no
 * storage, logging or switches, so the build's checks ask exactly what the server
 * asks (registry.js; scripts/property-index/registry-t2.cjs).
 */

const crypto = require('crypto');
const identity = require('./identity');
const { registryId } = require('./registryFormat');
const { parse, parts, sortKey, zip5, city: cityKey, stateCode } = require('./addressKey');

const MATCH_RANK = { exact: 0, building_only: 1, ambiguous: 2, restricted: 3, unsupported: 4, stale: 5 };

function suppressionHash(salt, fips, query) {
  return crypto.createHash('sha256')
    .update([salt, fips, query.number, query.pre, query.name, query.suffix, query.post, query.unit].join('|')).digest('hex');
}

/** Each record's ID, and a unit's point when it shares its building's. */
function complete(fips, records) {
  const buildings = records.filter((record) => record.kind === 'building');
  return records.map((record) => {
    const id = registryId(fips, record.kind, record.address);
    if (record.kind !== 'unit' || record.point) return { ...record, id };
    const building = buildings.find(({ address }) => address.pre === record.address.pre && address.suffix === record.address.suffix
      && address.post === record.address.post && address.zip === record.address.zip);
    return building ? { ...record, id, point: building.point, q: building.q } : { ...record, id };
  });
}

// A word's street type as the shared reader writes it (CREEK is CRK), or ''.
const typeOf = (word) => parts({ number: '1', name: 'A', suffix: word })?.suffix || '';
// Put in only to be read as a type and dropped again.
const SOME_TYPE = 'RD';

/**
 * The two other readings of a street whose last name word could be its type, worked out again from the person's own line, as
 * the shared reader spells one-word and longer names differently (MILL alone, ML CRK in MILL CREEK RD):
 *   type_in_name  MILL CREEK RD asked where the county says MILL, type CREEK: the person's type left out
 *   type_is_name  MILL CREEK asked where the county says MILL CREEK, type RD: the person's type read as part of the name,
 *                 and any type on record taken
 * A reading counts only when everything else reads as it did: number, directions, unit, building.
 */
function readings(address, parsed, state) {
  const words = String(address.line1 || '').toUpperCase().replace(/\./g, '').split(/[\s,]+/).filter(Boolean);
  const named = parsed.name.split(' ');
  // The person's type: the last word that reads as it, after the house number.
  let at = -1;
  for (let i = words.length - 1; i > 0 && at < 0; i -= 1) if (parsed.suffix && typeOf(words[i]) === parsed.suffix) at = i;
  if (at < 0) return [];
  const reread = (tokens) => {
    const read = parse(tokens.join(' '), address.unit, { state, zip: address.zip });
    const same = read && read.form === parsed.form && read.number === parsed.number && read.pre === parsed.pre && read.post === parsed.post
      && read.unit === parsed.unit && (read.building || '') === (parsed.building || '') && (read.urbanization || '') === (parsed.urbanization || '');
    return same ? read : null;
  };
  const found = [];
  if (named.length > 1 && typeOf(named[named.length - 1]) === named[named.length - 1]) {
    const read = reread([...words.slice(0, at), ...words.slice(at + 1)]);
    if (read && read.suffix === named[named.length - 1] && read.name.split(' ').length === named.length - 1) found.push({ ...read, reading: 'type_in_name' });
  }
  const read = reread([...words.slice(0, at + 1), SOME_TYPE, ...words.slice(at + 1)]);
  if (read && read.suffix === SOME_TYPE && read.name.split(' ').length === named.length + 1) found.push({ ...read, suffix: '', reading: 'type_is_name' });
  return found;
}

/**
 * When no county has a record at the person's line: the street read the other ways (readings()), only where the county has no
 * street under the name the person used, so a house missing from a street the county has stays missing. One subject or none:
 * two readings finding two places isn't ours to pick. Needs read.recordsNear.
 */
async function readAnotherWay(address, parsed, state, query, { unread, readable }, stateFile, read, suppressions, facts) {
  const ways = readings(address, parsed, state);
  if (!ways.length) return null;
  const streets = await Promise.all(readable.map((fips) => read.recordsNear(fips, stateFile.jurisdictions[fips].release, sortKey(parsed))));
  if (streets.some((records) => records.length)) return null;
  const found = [];
  for (const way of ways) {
    const asked = { ...query, name: way.name, suffix: way.suffix };
    for (const fips of unread) {
      const county = stateFile.jurisdictions[fips];
      const here = { jurisdiction: fips, release: county.release, ...facts };
      if (suppressions?.hashes?.includes(suppressionHash(suppressions.salt, fips, asked))) return { match: 'restricted', ...here };
      const result = identity.resolve(asked, complete(fips, await read.recordsAt(fips, county.release, sortKey(way))));
      if (result.match === 'exact' || result.match === 'building_only') found.push({ ...result, ...here, read_as: way.reading });
    }
  }
  return new Set(found.map(({ subject }) => subject.id)).size === 1 ? found[0] : null;
}

/**
 * @param {object} address { line1, unit, city, state, zip }
 * @param {object} read
 * @param {(state: string) => Promise<object>} read.stateFile
 * @param {(fips: string, release: string, key: string) => Promise<object[]>} read.recordsAt
 * @param {() => Promise<object|null>} [read.suppressions]
 * @param {(state: string) => boolean} [read.serves]
 * @param {(fips: string, release: string, key: string) => Promise<object[]>} [read.recordsNear] Records on one street around a number
 * @param {object} [options]
 * @param {boolean} [options.streetReadings] Where nothing is on record at the line, read its street the other ways (readAnotherWay)
 * @returns {Promise<object>} identity.js's answer, with `jurisdiction`, `release` and `form` (and `read_as` when read another way)
 */
async function answer(address, read, { streetReadings = false } = {}) {
  const { stateFile: readState, recordsAt, suppressions: readSuppressions = async () => null, serves = () => true } = read;
  const state = stateCode(address.state);
  const parsed = parse(address.line1, address.unit, { state, zip: address.zip });
  if (!parsed) return { match: 'unsupported', reason: 'unreadable_address' };
  const facts = { form: parsed.form };
  // A real address, and no house on a street to put a point on.
  if (parsed.form !== 'street' && parsed.form !== 'kilometer') return { match: 'unsupported', reason: 'no_point_for_this_form', ...facts };
  if (!serves(state)) return { match: 'unsupported', reason: 'no_release', ...facts };
  const stateFile = await readState(state);
  if (!stateFile) return { match: 'unsupported', reason: 'no_release', ...facts };
  const zip = zip5(address.zip);
  const counties = (stateFile.zips?.[zip] || stateFile.cities?.[cityKey(address.city)] || []).filter((fips) => stateFile.jurisdictions[fips]);
  if (!counties.length) return { match: 'unsupported', reason: 'no_release', ...facts };

  const query = { ...parsed, zip, city: cityKey(address.city) };
  const suppressions = await readSuppressions();
  const zipNamed = new Set();
  const answers = await Promise.all(counties.map(async (fips) => {
    const county = stateFile.jurisdictions[fips];
    const here = { jurisdiction: fips, release: county.release, ...facts };
    if (county.status === 'withdrawn') return { match: 'unsupported', reason: 'withdrawn', ...here };
    if (county.stale_after && Date.now() > Date.parse(county.stale_after)) return { match: 'stale', reason: 'release_past_date', ...here };
    if (suppressions?.hashes?.includes(suppressionHash(suppressions.salt, fips, query))) return { match: 'restricted', ...here };
    const records = complete(fips, await recordsAt(fips, county.release, sortKey(parsed)));
    if (zip && records.some((record) => record.address.zip === zip)) zipNamed.add(fips);
    return { ...identity.resolve(query, records), ...here };
  }));
  answers.sort((a, b) => MATCH_RANK[a.match] - MATCH_RANK[b.match]);
  // Two counties with something at this line: a ZIP across a county line, and the line in both. Not ours to pick,
  // and one county's clean answer doesn't outrank the other's "which one?".
  const claiming = answers.filter(({ match }) => ['exact', 'building_only', 'ambiguous'].includes(match));
  // Only one of them says this ZIP on its records: the other just has no ZIP on file, and that isn't a second place. A county
  // that asks "which one?" names no single record, so its records at this line say whether it names the ZIP.
  const namesZip = claiming.filter(({ jurisdiction }) => zipNamed.has(jurisdiction));
  if (claiming.length > 1 && namesZip.length === 1) return namesZip[0];
  if (claiming.length > 1) return { match: 'ambiguous', reason: 'two_counties', jurisdiction: claiming[0].jurisdiction, ...facts };
  if (streetReadings && read.recordsNear && answers[0].match === 'unsupported' && answers[0].reason === 'no_record') {
    // Read another way only in counties with no record at the line, and only if none of the ZIP's counties has the person's street.
    const unread = answers.filter(({ match, reason }) => match === 'unsupported' && reason === 'no_record').map(({ jurisdiction }) => jurisdiction);
    const readable = counties.filter((fips) => stateFile.jurisdictions[fips].status !== 'withdrawn');
    const other = await readAnotherWay(address, parsed, state, query, { unread, readable }, stateFile, read, suppressions, facts);
    if (other) return other;
  }
  return answers[0];
}

module.exports = { answer, complete, suppressionHash };
