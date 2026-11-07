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
 *   location   where FEMA's file has no address for the home, the building its own
 *              registry point stands on (structurePoints.js), behind its own switch
 *
 * It answers null rather than wait or fail: this is the floor under the screens, and
 * storage being down leaves them as they were.
 */

const zlib = require('zlib');
const logger = require('../../utils/logger');
const config = require('../../config/propertyRecords');
const { createReader, createStorage, StorageUnavailable } = require('./reader');
const registry = require('./registry');
const points = require('./structurePoints');
const { onStreet, inZip } = require('./identity');
const { parse, sortKey, zip5, city: cityKey, stateCode } = require('./addressKey');

// Who a home's estimate comes from: the footer names only those whose figures it shows.
const SOURCES = { structure: 'FEMA and the U.S. Army Corps of Engineers', area: 'the U.S. Census Bureau', both: 'FEMA, the U.S. Army Corps of Engineers and the U.S. Census Bureau' };

let shared = null;
function reader() {
  if (!shared) shared = createReader(createStorage(`${config.manifestUrl.replace(/\/+$/, '')}/estimates`));
  return shared;
}

let pointsShared = null;
function pointsReader() {
  if (!pointsShared) pointsShared = createReader(createStorage(`${config.manifestUrl.replace(/\/+$/, '')}/estimates/points`), { keptFiles: 2 });
  return pointsShared;
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

/**
 * The building this home's own registry point stands on, or why that can't be said. Only Pantopus's own points: a
 * vendor's coordinate is never an input here (cost-and-rights.md, section 6), so a stored map pin isn't read.
 */
async function structureByLocation(state, address, number) {
  const answer = await registry.lookupQuickly(address, { serves: () => true });
  const point = ['exact', 'building_only'].includes(answer?.match) ? answer.record?.point : null;
  if (!point) return { why: 'no_point' };
  const stateFile = await pointsReader().stateFile(state);
  const entry = stateFile?.jurisdictions?.[state];
  if (!entry) return { why: 'no_release' };
  const [lng, lat] = point;
  const cells = await Promise.all(points.cellsNear(lng, lat).map((cell) => pointsReader().recordsAt(state, entry.release, points.cellKey(cell))));
  return points.resolve({ lng, lat }, cells.flat(), { number });
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
    let structure = parsed ? await structureAt(state, parsed, zip, address.city) : null;
    const mode = config.floorByLocation();
    // A home with a unit gets only the area's figures, so its building isn't looked for.
    if (mode !== 'off' && parsed && !parsed.unit && !address.unit) {
      const found = await structureByLocation(state, address, parsed.number)
        .catch((err) => ({ why: err instanceof StorageUnavailable ? 'storage' : 'failed' }));
      // Counts only, never the address or the point. Where FEMA has the address too, whether the two found the same
      // building is the real wrong-building measure, with real homes.
      logger.info('property_records.floor_by_location', {
        mode, state, by_address: Boolean(structure), found: Boolean(found.structure), why: found.why || null, how: found.how || null,
        agrees: structure && found.structure ? structure.facts.footprint_sqft === found.structure.facts.footprint_sqft : null,
      });
      if (mode === 'on' && !structure && found.structure) structure = { facts: { ...found.structure.facts, structures_at_address: 1 } };
    }
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

const forHome = (home) => lookup({ line1: home.address, unit: home.address2 || '', city: home.city, state: home.state, zip: home.zipcode });

module.exports = { lookup, forHome };
