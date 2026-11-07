'use strict';

/**
 * One lookup in the floor-plan sheets, given how to read them: the part with no storage,
 * logging or switches, so the check script asks exactly what the server asks
 * (floorPlans.js; scripts/property-index/check-floor-plans.cjs).
 */

const crypto = require('crypto');
const identity = require('./identity');
const { suppressionHash } = require('./registryLookup');
const { parse, sortKey, zip5, city: cityKey, stateCode } = require('./addressKey');
const { recordsAt, rangesOf } = require('./floorPlanFormat');

const SCHEMA = 1;

// Which address a copy answers for: a Home whose address or unit changes reads again.
function addressStamp(address) {
  const parsed = parse(address.line1, address.unit);
  if (!parsed) return null;
  return crypto.createHash('sha256')
    .update(JSON.stringify([parsed.number, parsed.pre, parsed.name, parsed.suffix, parsed.post, parsed.unit, parsed.building, zip5(address.zip)]))
    .digest('hex').slice(0, 24);
}

/**
 * @param {object} address { line1, unit, city, state, zip }
 * @param {object} read
 * @param {(state: string) => Promise<object|null>} read.stateFile
 * @param {(id: string, release: string) => Promise<object|null>} read.sheetFile
 * @param {() => Promise<object|null>} [read.suppressions]
 * @returns {Promise<object|null>} A copy for the Home to keep; null when no sheet speaks for this address.
 */
async function answerFor(address, { stateFile, sheetFile, suppressions = async () => null }) {
  const state = stateCode(address.state);
  const parsed = parse(address.line1, address.unit, { state, zip: address.zip });
  if (!parsed || parsed.form !== 'street') return null;
  const file = await stateFile(state);
  const key = sortKey(parsed);
  const ids = (file?.streets?.[key] || []).filter((id) => file.sheets?.[id]?.status === 'active');
  if (!ids.length) return null;
  const sheets = (await Promise.all(ids.map((id) => sheetFile(id, file.sheets[id].release)))).filter(Boolean);
  const answer = identity.resolve({ ...parsed, zip: zip5(address.zip), city: cityKey(address.city) }, sheets.flatMap((sheet) => recordsAt(sheet, key)));
  if (answer.match !== 'exact' && answer.match !== 'building_only') return null;
  const sheet = sheets.find((candidate) => candidate.building_id === (answer.record.parent || answer.record.id));
  if (!sheet) return null;
  // A protected address answers nothing, here as in every release.
  const suppressed = await suppressions();
  if (suppressed?.hashes?.includes(suppressionHash(suppressed.salt, sheet.fips, parsed))) return null;
  const plan = answer.match === 'exact' ? sheet.plans.find((candidate) => candidate.id === answer.record.plan) : null;
  if (answer.match === 'exact' && !plan) return null;
  return {
    schema: SCHEMA,
    match: answer.match,
    reason: answer.reason || null,
    sheet: sheet.id,
    release: sheet.release,
    as_of: sheet.as_of,
    permission_scope: sheet.permission?.scope || 'facts',
    ...(plan
      ? { plan: { id: plan.id, name: plan.name, bedrooms: plan.bedrooms, bathrooms: plan.bathrooms, sq_ft: plan.sq_ft } }
      : { ranges: rangesOf(sheet.plans) }),
    address_stamp: addressStamp(address),
    stored_at: new Date().toISOString(),
  };
}

module.exports = { answerFor, addressStamp, SCHEMA };
