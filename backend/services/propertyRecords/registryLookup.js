'use strict';

/**
 * One lookup in the address registry, given how to read it: the part with no
 * storage, logging or switches, so the build's checks ask exactly what the server
 * asks (registry.js; scripts/property-index/registry-t2.cjs).
 */

const crypto = require('crypto');
const identity = require('./identity');
const { registryId } = require('./registryFormat');
const { parse, sortKey, zip5, city: cityKey, stateCode } = require('./addressKey');

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

/**
 * @param {object} address { line1, unit, city, state, zip }
 * @param {object} read
 * @param {(state: string) => Promise<object>} read.stateFile
 * @param {(fips: string, release: string, key: string) => Promise<object[]>} read.recordsAt
 * @param {() => Promise<object|null>} [read.suppressions]
 * @param {(state: string) => boolean} [read.serves]
 * @returns {Promise<object>} identity.js's answer, with `jurisdiction`, `release` and `form`
 */
async function answer(address, { stateFile: readState, recordsAt, suppressions: readSuppressions = async () => null, serves = () => true }) {
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
  const answers = await Promise.all(counties.map(async (fips) => {
    const county = stateFile.jurisdictions[fips];
    const here = { jurisdiction: fips, release: county.release, ...facts };
    if (county.status === 'withdrawn') return { match: 'unsupported', reason: 'withdrawn', ...here };
    if (county.stale_after && Date.now() > Date.parse(county.stale_after)) return { match: 'stale', reason: 'release_past_date', ...here };
    if (suppressions?.hashes?.includes(suppressionHash(suppressions.salt, fips, query))) return { match: 'restricted', ...here };
    const records = complete(fips, await recordsAt(fips, county.release, sortKey(parsed)));
    return { ...identity.resolve(query, records), ...here };
  }));
  answers.sort((a, b) => MATCH_RANK[a.match] - MATCH_RANK[b.match]);
  // Two counties with something at this line: a ZIP across a county line, and the line in both. Not ours to pick,
  // and one county's clean answer doesn't outrank the other's "which one?".
  const claiming = answers.filter(({ match }) => ['exact', 'building_only', 'ambiguous'].includes(match));
  // Only one of them says this ZIP on its record: the other just has no ZIP on file, and that isn't a second place.
  const namesZip = claiming.filter(({ record }) => zip && record?.address?.zip === zip);
  if (claiming.length > 1 && namesZip.length === 1) return namesZip[0];
  if (claiming.length > 1) return { match: 'ambiguous', reason: 'two_counties', jurisdiction: claiming[0].jurisdiction, ...facts };
  return answers[0];
}

module.exports = { answer, complete, suppressionHash };
