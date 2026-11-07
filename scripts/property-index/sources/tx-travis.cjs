'use strict';
// Travis County, Texas: the Travis Central Appraisal District's public appraisal roll export, under "publicly available
// data" on its public information page. Year built, floors, bedrooms, baths, fireplaces, garage, pool, foundation and
// roof, and market values. Bedrooms are on about half of the homes. Sale prices aren't public in Texas. A protected
// person's account (Tax Code 25.025) carries no facts. Exemption, owner and mailing columns are never read (lib/pacs.cjs).

const path = require('node:path');
const { download, USER_AGENT } = require('../lib/tables.cjs');
const { streetParts, year, realUnit, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { properties, mainImprovements, codes, exportDate } = require('../lib/pacs.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '48453';
const COUNTY = 'Travis County';
const PAGE = 'https://traviscad.org/publicinformation';
const FLOORS = { '1ST': 1, '2ND': 2, '3RD': 3, '4TH': 4, '5TH': 5, '6TH': 6 };
const FOUNDATION = { SLAB: 'Slab', 'PIER AND B': 'Pier and beam', BLOCKS: 'Blocks', 'WOOD POST': 'Wood post', 'FLOATING S': 'Floating slab' };
const ROOF_SHAPE = { HIP: 'Hip', GABLE: 'Gable', FLAT: 'Flat', MANSARD: 'Mansard', BARN: 'Barn', 'A-FRAME': 'A-frame' };
const ROOF_COVER = { COMPOSITIO: 'Composition', METAL: 'Metal', TILE: 'Tile', 'BUILT-UP': 'Built-up', 'WOOD SHING': 'Wood shingle' };
const UNITS = { '2 FAM DWELLING': 2, '3 FAM DWELLING': 3, TRIPLEX: 3, FOURPLEX: 4 };

function classify(code, words) {
  if (FLOORS[code]) return `floor${FLOORS[code]}`;
  if (code === '252') return 'bedrooms';
  if (code === '251') return 'full';
  if (code === '250') return 'half';
  if (code === '522') return 'fireplaces';
  if (words.startsWith('POOL')) return 'pool';
  if (words.startsWith('GARAGE')) return 'garage';
  if (words.startsWith('CARPORT')) return 'carport';
  return null;
}

function useOf(state, type, hasUnit) {
  const [s, t] = [state.toUpperCase(), type || ''];
  if (/^MOHO/.test(t) || s === 'A2' || s.startsWith('M') || s === 'E2') return ['property', 'mobile_home'];
  if (s === 'A4') return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (s === 'A1' || s === 'E1' || s === 'A9' || (s.startsWith('O') && t)) {
    if (/TOWNHOME/.test(t) && !hasUnit) return ['property', 'townhouse'];
    return hasUnit ? ['unit', 'condo'] : ['property', 'house'];
  }
  if (s === 'B2' || s === 'B3' || s === 'B4') return ['building', 'multi_unit'];
  if (s.startsWith('B')) return ['building', 'apartment'];
  if (s.startsWith('C') || s.startsWith('D') || s.startsWith('O') || s === 'A3' || s === 'A5' || s === 'E3' || !s) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => (value > 0 && value <= most ? value : null);

function fromProperty(row, imp, words, subdivisions) {
  const address = streetParts({ number: row.number, pre: row.pre, name: row.street, suffix: row.suffix, unit: realUnit(row.unit) });
  const account = row.partial && row.group ? row.group : row.id;
  if (!address) return null;
  const [kind, homeType] = useOf(row.state, imp?.type, address.unit);
  const facts = { parcel_number: account, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  const line = [row.number, row.pre, row.street, row.suffix].filter(Boolean).join(' ');
  put(facts, 'address_on_record', onRecord(line, row.unit));
  put(facts, 'land_use', word(words.get(row.state)));
  put(facts, 'county_use_code', word(row.state));
  put(facts, 'subdivision', word(subdivisions.get(row.subdivision)));
  put(facts, 'legal_description', word(row.legal)?.slice(0, 300));
  if (imp && (home || kind === 'building')) {
    put(facts, 'year_built', year(imp.built));
    put(facts, 'building_type', word(imp.type));
    put(facts, 'foundation', FOUNDATION[imp.Foundation]);
    put(facts, 'roof_shape', ROOF_SHAPE[imp['Roof Style']]);
    put(facts, 'roof_cover', ROOF_COVER[imp['Roof Covering']]);
  }
  if (imp && home) {
    put(facts, 'living_sqft', positive(imp.area));
    put(facts, 'bedrooms', inRange(imp.bedrooms, 15));
    const [full, half] = [inRange(imp.full, 20), inRange(imp.half, 10)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
    put(facts, 'fireplaces', inRange(imp.fireplaces, 20));
    put(facts, 'garage_sqft', positive(imp.garage));
    put(facts, 'carport_sqft', positive(imp.carport));
    if (imp.pool) facts.pool = 'Yes';
    if (kind === 'property') put(facts, 'stories', Math.max(...[...imp.floors].map(Number), 0) || null);
  }
  if (imp && kind === 'building') {
    put(facts, 'gross_sqft', positive(imp.area));
    put(facts, 'units', UNITS[imp.type]);
  }
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.acres));
  // A partial owner's line holds a share of the value, not the home's.
  if (!row.partial) {
    put(facts, 'value_year', positive(row.year));
    put(facts, 'market_value', positive(row.market));
    put(facts, 'market_land_value', positive(row.land));
    put(facts, 'market_building_value', positive(row.building));
  }
  return { id: `pp:${kind}:${FIPS}:${account}`, kind, home_type: homeType, address: { ...address, city: String(word(row.city) || '').toUpperCase(), zip: zipCode(row.zip) }, facts };
}

async function latestExport() {
  const page = await (await fetch(PAGE, { headers: { 'User-Agent': USER_AGENT } })).text();
  const links = [...page.matchAll(/<a[^>]*href="([^"]+\.zip)"[^>]*>\s*(\d{4}) (Supplemental Appraisal Roll|Certified Appraisal) Export/gi)].map((match) => ({ url: match[1], year: Number(match[2]), supplemental: /Supplemental/i.test(match[3]) }));
  if (!links.length) throw new Error('The public information page no longer links an appraisal export');
  return links.sort((a, b) => b.year - a.year || b.supplemental - a.supplemental)[0];
}

async function* build({ work }) {
  const latest = await latestExport();
  const zip = path.join(work, 'tx-travis', `${path.basename(decodeURIComponent(latest.url)).replace(/[^A-Za-z0-9._-]+/g, '-')}`);
  await download(latest.url, zip);
  const asOf = await exportDate(zip);
  const stats = {};
  const rows = [];
  for await (const row of properties(zip, stats)) rows.push(row);
  log(`${rows.length} real and mobile home accounts, ${stats.protected || 0} protected`);
  const wanted = new Set(rows.map((row) => row.id));
  const main = await mainImprovements(zip, wanted, classify, ['Foundation', 'Roof Style', 'Roof Covering']);
  const [words, subdivisions] = [await codes(zip, 'STATE_CD'), await codes(zip, 'ABS_SUBD')];
  log(`${main.size} accounts with improvements`);
  const records = new Map();
  let noAddress = 0;
  for (const row of rows) {
    const record = fromProperty(row, main.get(row.id), words, subdivisions);
    if (!record) noAddress += 1;
    else if (!records.has(record.id)) records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} accounts, ${noAddress} without a street number`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'TX', name: COUNTY, publisher: 'Travis Central Appraisal District', dataset: 'appraisal export', method: 'county', source: 'tx-travis', as_of: asOf, stale_after_days: 450, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    columns: ['prop_id', 'yr_built', 'imprv_det_area', 'imprv_det_type_desc', 'GARAGE ATT 1ST F', 'CARPORT ATT 1ST', 'BEDROOMS', 'BATHROOM', 'HALF BATHROOM', 'FIREPLACE', 'land_acres', 'market_value', 'land_hstd_val', 'land_non_hstd_val', 'ag_market', 'imprv_hstd_val', 'imprv_non_hstd_val', 'prop_val_yr', 'imprv_type_desc', 'imprv_attr_desc', 'imprv_attr_cd', 'abs_subdv_desc', 'legal_desc', 'state_cd_description'],
    facts: { year_built: 'yr_built', living_sqft: 'imprv_det_area', gross_sqft: 'imprv_det_area', garage_sqft: 'GARAGE ATT 1ST F', carport_sqft: 'CARPORT ATT 1ST', bedrooms: 'BEDROOMS', full_baths: 'BATHROOM', half_baths: 'HALF BATHROOM', fireplaces: 'FIREPLACE', building_type: 'imprv_type_desc', foundation: 'imprv_attr_cd', roof_shape: 'imprv_attr_cd', roof_cover: 'imprv_attr_cd', lot_acres: 'land_acres', market_value: 'market_value', market_land_value: 'land_hstd_val', market_building_value: 'imprv_hstd_val', value_year: 'prop_val_yr', subdivision: 'abs_subdv_desc', legal_description: 'legal_desc', land_use: 'state_cd_description' },
  },
};
