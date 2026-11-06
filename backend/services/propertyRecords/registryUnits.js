'use strict';

/**
 * The registry answering the address check's unit question, in the slot Smarty's
 * unit lookup has (addressValidation/secondaryAddressProvider.js, off): does this
 * address have units, and is the one typed among them. With the units themselves
 * when they're few, so the apps can offer them.
 *
 * The roster is what the publishers list, not proof a unit can't exist. So a typed
 * unit it doesn't list asks again and can continue (UNIT_NOT_CONFIRMED); it never refuses.
 */

const config = require('../../config/addressRegistry');
const registry = require('./registry');
const { stateCode } = require('./addressKey');
const { getRolloutFlag } = require('../../utils/addressRolloutFlags');

const PROVIDER = 'pantopus_registry';
// Above PROVIDER_SECONDARY_MIN_CONFIDENCE (addressDecisionEngine.js): the units come from the address authority's own file.
const CONFIDENCE = 0.9;

const liveFor = (state) => config.modeFor(stateCode(state)) === 'live';

/** Whether this address's state uses the registry for its units. */
function usesRegistry(address) {
  return liveFor(address?.state);
}

/** Whether unit lookups count toward this address's verdict: Smarty's rollout flag, or a state live on the registry. */
function usesProviderUnits(address) {
  return usesRegistry(address) || getRolloutFlag('enableSecondaryProvider');
}

/** Null when the registry can't say: no release, a form with no units, storage down. Today's rules then stand. */
async function lookup({ normalizedAddress, submittedUnit }) {
  if (!normalizedAddress) return null;
  const typed = String(submittedUnit || '').trim();
  const answer = await registry.lookupQuickly({
    line1: normalizedAddress.line1,
    unit: typed,
    city: normalizedAddress.city,
    state: normalizedAddress.state,
    zip: normalizedAddress.zip,
  });
  if (!answer || !['exact', 'building_only', 'ambiguous'].includes(answer.match)) return null;
  const kind = answer.subject?.kind;
  // Puerto Rico: the same line in several urbanizaciones. The second line says which, the same way a unit would.
  if (answer.reason === 'several_urbanizations') {
    return {
      provider: PROVIDER,
      provider_version: answer.release || null,
      secondary_required: true,
      unit_count_estimate: answer.urbanizations.length,
      confidence: CONFIDENCE,
      submitted_unit_known: null,
      submitted_unit_evaluated: false,
      unit_choices: answer.urbanizations.map((name) => `URB ${name}`),
      registry_point: null,
      lookup_mode: 'registry',
      verification_level: 'secondary_provider_observed',
      validated_at: new Date().toISOString(),
      raw: { count: answer.urbanizations.length, match: answer.match, reason: answer.reason },
    };
  }
  let count = answer.unit_count || 0;
  // A unit we found by name, in a building whose roster the answer didn't carry: it has units.
  if (!count && kind === 'unit') count = 2;
  if (!count) {
    // One home on record at this address.
    if (answer.match !== 'exact') return null;
  }
  const known = answer.match === 'exact' && kind === 'unit';
  const evaluated = Boolean(typed) && count > 0;
  return {
    provider: PROVIDER,
    provider_version: answer.release || null,
    secondary_required: count > 1,
    unit_count_estimate: count,
    confidence: CONFIDENCE,
    submitted_unit_known: evaluated ? known : null,
    submitted_unit_evaluated: evaluated,
    unit_choices: answer.choices || [],
    registry_point: answer.record?.point ? { lng: answer.record.point[0], lat: answer.record.point[1], accuracy: answer.record.q || 'unknown', id: answer.subject?.id || null, release: answer.release || null } : null,
    lookup_mode: 'registry',
    verification_level: count > 1 ? 'secondary_provider_observed' : 'secondary_provider_partial',
    validated_at: new Date().toISOString(),
    raw: { count, match: answer.match, reason: answer.reason || null },
  };
}

module.exports = { lookup, usesRegistry, usesProviderUnits, PROVIDER };
