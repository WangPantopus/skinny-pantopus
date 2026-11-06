'use strict';

/**
 * The national floor: what can be said about a home no record covers, kept apart
 * from the record in every way. Its own index under <root>/estimates, its own fact
 * names (estimateFacts.js), its own slot on screens, and nothing here reaches a
 * record field, Add Home or a Home's copy.
 *
 *   structure  FEMA's footprint at this address and the Army Corps of Engineers'
 *              modeled size and stories (scripts/property-index/sources/us-structures.cjs)
 *   area       Census figures for the block group, or the ZIP when the address has
 *              no structure, and never a home's own fact (sources/us-acs.cjs)
 *
 * It answers null rather than wait or fail: this is the floor under the screens, and
 * storage being down leaves them as they were.
 */

const zlib = require('zlib');
const logger = require('../../utils/logger');
const config = require('../../config/propertyRecords');
const { createReader, createStorage, StorageUnavailable } = require('./reader');
const { onStreet, inZip } = require('./identity');
const { parse, sortKey, zip5, city: cityKey, stateCode } = require('./addressKey');

// Who a home's estimate comes from: the footer names only those whose figures it shows.
const SOURCES = { structure: 'FEMA and the U.S. Army Corps of Engineers', area: 'the U.S. Census Bureau', both: 'FEMA, the U.S. Army Corps of Engineers and the U.S. Census Bureau' };

let shared = null;
function reader() {
  if (!shared) shared = createReader(createStorage(`${config.manifestUrl.replace(/\/+$/, '')}/estimates`));
  return shared;
}

const gunzipJson = (bytes) => JSON.parse(zlib.gunzipSync(bytes).toString('utf8'));

/** One structure at this street address, or null: two can't both be this home's. */
async function structureAt(state, parsed, zip, city) {
  const stateFile = await reader().stateFile(state);
  if (!stateFile) return null;
  const counties = (stateFile.zips?.[zip] || stateFile.cities?.[cityKey(city)] || []).filter((fips) => stateFile.jurisdictions[fips]);
  const query = { ...parsed, zip };
  const found = await Promise.all(counties.map(async (fips) => {
    const records = await reader().recordsAt(fips, stateFile.jurisdictions[fips].release, sortKey(parsed));
    return inZip(query, onStreet(query, records));
  }));
  const here = found.flat();
  return here.length === 1 ? here[0] : null;
}

function areaRow(row, scope) {
  if (!row) return null;
  const [year, rooms, bedrooms, share] = row;
  return { scope, median_year_built: year, median_rooms: rooms, most_common_bedrooms: bedrooms, most_common_bedrooms_share: share };
}

async function areaFor(state, blockGroup, zip) {
  if (blockGroup) {
    const file = await reader().file(`areas/${state}.json.gz`, gunzipJson);
    const found = areaRow(file?.areas?.[blockGroup], 'block_group');
    if (found) return found;
  }
  if (zip) {
    const file = await reader().file('areas/zips.json.gz', gunzipJson);
    return areaRow(file?.areas?.[zip], 'zip');
  }
  return null;
}

/**
 * @param {object} address { line1, city, state, zip }
 * @returns {Promise<null|{ structure: object|null, area: object|null, source: string }>}
 */
async function lookup(address) {
  if (!config.estimatesEnabled()) return null;
  const state = stateCode(address.state);
  const zip = zip5(address.zip);
  if (!state) return null;
  try {
    const parsed = parse(address.line1);
    const structure = parsed ? await structureAt(state, parsed, zip, address.city) : null;
    const area = await areaFor(state, structure?.facts?.block_group, zip);
    if (!structure && !area) return null;
    return {
      structure: structure ? structure.facts : null,
      area,
      source: structure && area ? SOURCES.both : SOURCES[structure ? 'structure' : 'area'],
    };
  } catch (err) {
    if (err instanceof StorageUnavailable) return null;
    logger.warn('property_records.estimates_failed', { error: err.name });
    return null;
  }
}

const forHome = (home) => lookup({ line1: home.address, city: home.city, state: home.state, zip: home.zipcode });

module.exports = { lookup, forHome };
