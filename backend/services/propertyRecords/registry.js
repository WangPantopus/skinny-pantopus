'use strict';

/**
 * Pantopus's own address registry: whether an address and a unit exist, the units
 * of a building, and where its point is, answered without any outside call. Same
 * identity contract as the county records (identity.js), and the same format and
 * reader (format.js, reader.js); only its prefix differs.
 *
 *   lookup(address)  { match, subject, record, unit_count, choices, form, ... }
 *   shadow(address)  the same for states being watched: logs counts, returns nothing, never throws
 *
 * An address that isn't a house on a street (a rural route, a PO box, military
 * mail) answers `unsupported` with its `form`: it's a real address, the registry
 * just has no point for it. Addresses, IDs and unit numbers never go in the log.
 */

const logger = require('../../utils/logger');
const config = require('../../config/addressRegistry');
const { createReader, createStorage, StorageUnavailable } = require('./reader');
const { answer } = require('./registryLookup');
const { stateCode } = require('./addressKey');

// How long a request-path lookup may hold up a screen. Past this it answers that it can't say (index.js's outage answer).
const LOOKUP_DEADLINE_MS = 800;

let shared = null;
function reader() {
  if (!shared) shared = createReader(config.url ? createStorage(config.url) : null);
  return shared;
}

/**
 * @param {object} address { line1, unit, city, state, zip }
 * @param {object} [options]
 * @param {(state: string) => boolean} [options.serves] Whether this state may answer; by default a live one
 * @returns {Promise<object>} registryLookup.js's answer
 */
function lookup(address, { serves = (state) => config.modeFor(state) === 'live' } = {}) {
  return answer(address, { stateFile: reader().stateFile, recordsAt: reader().recordsAt, suppressions: reader().suppressions, serves });
}

/** lookup(), answering "can't say" rather than holding up a screen. Null when storage can't be read or takes too long. */
async function lookupQuickly(address, options) {
  let timer;
  try {
    return await Promise.race([
      lookup(address, options),
      new Promise((resolve) => { timer = setTimeout(() => resolve(null), LOOKUP_DEADLINE_MS); }),
    ]);
  } catch (err) {
    if (err instanceof StorageUnavailable) return null;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Watches a state: what the registry would have answered. No address, ID or unit leaves this function. */
async function shadow(address) {
  const state = stateCode(address?.state);
  if (config.modeFor(state) !== 'shadow') return;
  const started = Date.now();
  try {
    const result = await lookup(address, { serves: () => true });
    logger.info('address_registry.shadow', {
      state,
      fips: result.jurisdiction || null,
      form: result.form || null,
      match: result.match,
      reason: result.reason || null,
      kind: result.subject?.kind || null,
      units: result.unit_count ?? null,
      ms: Date.now() - started,
    });
  } catch (err) {
    logger.info('address_registry.shadow', { state, match: 'unavailable', error: err.name, ms: Date.now() - started });
  }
}

module.exports = { lookup, lookupQuickly, shadow, StorageUnavailable };
