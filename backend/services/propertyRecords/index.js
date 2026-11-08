'use strict';

/**
 * Pantopus's own property lookup: an address's subject and facts from the county
 * records in the property index, answered without any outside call.
 *
 *   lookup(address)  what the record says about an address, per the identity
 *                    contract (identity.js); throws reader.StorageUnavailable
 *                    when the index can't be read just now, so callers say
 *                    "Looking up…" and keep what they have
 *   shadow(address)  the same lookup for counties being watched: logs counts,
 *                    returns nothing, never throws
 *
 * Which counties serve is the router's answer (router.js), per FIPS.
 * Addresses, record IDs and Home IDs never go in the log: county, answer, time.
 */

const crypto = require('crypto');
const logger = require('../../utils/logger');
const router = require('./router');
const counts = require('./counts');
const reader = require('./reader');
const identity = require('./identity');
const { parse, sortKey, zip5, city: cityKey, stateCode } = require('./addressKey');

const MATCH_RANK = { exact: 0, building_only: 1, parcel_only: 2, ambiguous: 3, restricted: 4, unsupported: 5, stale: 6 };

function suppressionHash(salt, fips, query) {
  return crypto.createHash('sha256')
    .update([salt, fips, query.number, query.pre, query.name, query.suffix, query.post, query.unit].join('|')).digest('hex');
}

/** Counties a state's file says this address can be in: by ZIP, else by city. */
function countiesFor(stateFile, zip, city) {
  return stateFile.zips?.[zip] || stateFile.cities?.[city] || [];
}

/**
 * @param {object} address { line1, unit, city, state, zip }
 * @param {object} [options]
 * @param {(fips: string) => boolean} [options.serves] Which counties may answer; by default the ones that are live
 * @returns {Promise<object>} { match, jurisdiction, county, release, ... } (identity.js)
 */
async function lookup(address, { serves = (fips) => router.modeFor(fips) === 'live' } = {}) {
  const state = stateCode(address.state);
  const parsed = parse(address.line1, address.unit, { state, zip: address.zip });
  if (!parsed) return { match: 'unsupported', reason: 'unreadable_address' };
  const stateFile = await reader.stateFile(state);
  if (!stateFile) return { match: 'unsupported', reason: 'no_release' };
  const zip = zip5(address.zip);
  const counties = countiesFor(stateFile, zip, cityKey(address.city)).filter((fips) => serves(fips) && stateFile.jurisdictions[fips]);
  if (!counties.length) return { match: 'unsupported', reason: 'no_release' };

  const query = { ...parsed, zip, city: cityKey(address.city) };
  const suppressions = await reader.suppressions();
  const answers = await Promise.all(counties.map(async (fips) => {
    const county = stateFile.jurisdictions[fips];
    const facts = { jurisdiction: fips, county };
    if (county.status === 'withdrawn') return { match: 'unsupported', reason: 'withdrawn', ...facts };
    if (county.stale_after && Date.now() > Date.parse(county.stale_after)) return { match: 'stale', reason: 'release_past_date', ...facts };
    if (suppressions?.hashes?.includes(suppressionHash(suppressions.salt, fips, query))) return { match: 'restricted', ...facts };
    const records = await reader.recordsAt(fips, county.release, sortKey(parsed));
    return { ...identity.resolve(query, records, { sharedFacts: router.sharedFactsFor(fips) }), ...facts };
  }));
  answers.sort((a, b) => MATCH_RANK[a.match] - MATCH_RANK[b.match]);
  // A ZIP across a county line: two counties each claiming this address can't both be right.
  if (answers.length > 1 && answers[0].match === answers[1].match && ['exact', 'building_only', 'parcel_only'].includes(answers[0].match)) {
    return { match: 'ambiguous', reason: 'two_counties', jurisdiction: answers[0].jurisdiction, county: answers[0].county };
  }
  // What one county's records at an address agree on says nothing about another county's records there.
  if (answers[0].agreed && answers.slice(1).some((other) => other.match !== 'unsupported')) {
    const { agreed: _agreed, ...answer } = answers[0];
    return answer;
  }
  return answers[0];
}

// One answer per address an hour is all watching needs: screens read a Home's profile far more often than that.
const SHADOW_EVERY_MS = 60 * 60 * 1000;
const SHADOW_REMEMBERED = 5000;
const shadowed = new Map();

function shadowDue(address) {
  const key = crypto.createHash('sha256').update(JSON.stringify([address.line1, address.unit, address.zip])).digest('hex');
  const now = Date.now();
  if (now - (shadowed.get(key) || 0) < SHADOW_EVERY_MS) return false;
  shadowed.delete(key);
  shadowed.set(key, now);
  if (shadowed.size > SHADOW_REMEMBERED) shadowed.delete(shadowed.keys().next().value);
  return true;
}

/** Watches a county: what the record would have answered. No facts leave this function. */
async function shadow(address) {
  if (!router.anyShadow() || !shadowDue(address)) return;
  const started = Date.now();
  try {
    const result = await lookup(address, { serves: (fips) => router.modeFor(fips) === 'shadow' });
    if (result.jurisdiction) {
      counts.noteShadow(result.jurisdiction, result.match);
      logger.info('property_records.shadow', {
        fips: result.jurisdiction,
        match: result.match,
        reason: result.reason || null,
        facts: result.record ? Object.keys(result.record.facts || {}).length : 0,
        ms: Date.now() - started,
      });
    }
  } catch (err) {
    logger.info('property_records.shadow', { match: 'unavailable', error: err.name, ms: Date.now() - started });
  }
}

module.exports = { lookup, shadow, StorageUnavailable: reader.StorageUnavailable };
