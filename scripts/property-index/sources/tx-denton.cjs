'use strict';
// Denton County, Texas: the Denton Central Appraisal District's certified appraisal export, on its Data Downloads page. Year
// built, floors, bedrooms, baths, rooms, foundation, roof, condition and market values. Sale prices aren't public in Texas.
// A protected person's account (Tax Code 25.025) carries no facts. Builder plans kept for reference and condo reference
// accounts aren't homes. Exemption, owner and mailing columns are never read (lib/pacs.cjs).

const path = require('node:path');
const { download, USER_AGENT } = require('../lib/tables.cjs');
const { streetParts, year, realUnit, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { properties, mainImprovements, codes, exportDate } = require('../lib/pacs.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { keepSplit } = require('../lib/held.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '48121';
const COUNTY = 'Denton County';
const FILES = 'https://dentoncad.net/data/_uploaded/files/datafiles';
const FOUNDATION = { SLAB: 'Slab', PIER: 'Pier', 'PIER/BEAM': 'Pier and beam', 'CONCRETE B': 'Concrete block', MASON: 'Masonry' };
const ROOF_COVER = { COMPOSITIO: 'Composition', 'WOOD SHING': 'Wood shingle', METAL: 'Metal', TILE: 'Tile', ASPHALT: 'Asphalt', ROLL: 'Roll', 'SPANISH TI': 'Spanish tile', SLATE: 'Slate', COPPER: 'Copper', SHAKE: 'Shake', FIBERGLASS: 'Fiberglass' };
const CONDITION = { BEST: 'Best', EXCELLENT: 'Excellent', 'VERY GOOD': 'Very good', GOOD: 'Good', AVERAGE: 'Average', FAIR: 'Fair', LOW: 'Low', POOR: 'Poor' };
const ATTRIBUTES = ['Foundation', 'Roof Covering', 'Plumbing', 'Bedrooms', 'Fireplaces', 'Condition', 'Number of Rooms'];

function classify(code) {
  if (code === 'MA' || code === 'C-MA') return 'floor1';
  if (code === 'MA2' || code === 'C-MA2') return 'floor2';
  if (code === 'MA3') return 'floor3';
  // Bonus rooms, attached additions and finished basements count in the district's own main area.
  if (code === 'BR' || code === 'AA' || code === 'BAF') return 'floor';
  // Attached and detached garages by their own codes; EG is a garage the district doesn't place.
  if (code === 'AG') return 'attached';
  if (code === 'DG') return 'detached';
  if (code === 'EG') return 'garage';
  if (code === 'CP') return 'carport';
  if (code === 'PL') return 'pool';
  return null;
}

function useOf(state, improved, hasUnit) {
  const s = state.toUpperCase();
  if (s === 'A2' || s === 'E3' || s === 'M1') return ['property', 'mobile_home'];
  if (s === 'A4' || s === 'OA4') return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (s === 'A5' || s === 'OA5') return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (s === 'A1' || s === 'A3' || s === 'A6' || s === 'E1' || ((s === 'O2' || s === 'OA1' || s === 'OA2' || s === 'OA3' || s === 'OA6') && improved)) return hasUnit ? ['unit', 'condo'] : ['property', 'house'];
  if (s === 'B2' || s === 'OB2') return ['building', 'multi_unit'];
  if (s === 'B1') return ['building', 'apartment'];
  if (/^(C|D|E4|O|S)/.test(s) || !s) return ['parcel', null];
  return ['other', null];
}

const whole = (text, most) => (/^\d+$/.test(text || '') && Number(text) > 0 && Number(text) <= most ? Number(text) : null);

function fromProperty(row, imp, words, subdivisions) {
  const address = streetParts({ number: row.number, pre: row.pre, name: row.street, suffix: row.suffix, unit: realUnit(row.unit) });
  const account = row.partial && row.group ? row.group : row.id;
  if (!address) return null;
  const [kind, homeType] = useOf(row.state, Boolean(imp?.area), address.unit);
  const facts = { parcel_number: account, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([row.number, row.pre, row.street, row.suffix].filter(Boolean).join(' '), row.unit));
  put(facts, 'land_use', word(words.get(row.state)));
  put(facts, 'county_use_code', word(row.state));
  put(facts, 'subdivision', word(subdivisions.get(row.subdivision)));
  put(facts, 'legal_description', word(row.legal)?.slice(0, 300));
  if (imp && (home || kind === 'building')) {
    put(facts, 'year_built', year(imp.built));
    put(facts, 'foundation', FOUNDATION[imp.Foundation]);
    put(facts, 'roof_cover', ROOF_COVER[imp['Roof Covering']]);
  }
  if (imp && home) {
    put(facts, 'living_sqft', positive(imp.area));
    put(facts, 'bedrooms', whole(imp.Bedrooms, 15));
    const baths = /^\d+(\.5)?$/.test(imp.Plumbing || '') ? Number(imp.Plumbing) : null;
    // A total: it doesn't say its full and half baths (two full and two half baths is 3), so it's kept as the total.
    if (baths > 0 && baths <= 20) facts.bathrooms = baths;
    put(facts, 'rooms', whole(imp['Number of Rooms'], 40));
    put(facts, 'fireplaces', /^S\d$/.test(imp.Fireplaces || '') ? Number(imp.Fireplaces[1]) : null);
    put(facts, 'condition', CONDITION[imp.Condition]);
    put(facts, 'garage_sqft', (positive(imp.attached) || 0) + (positive(imp.detached) || 0) + (positive(imp.garage) || 0) || null);
    const garages = [positive(imp.attached) && 'Attached', positive(imp.detached) && 'Detached'].filter(Boolean);
    if (garages.length) facts.garage = garages.join(', ');
    const parking = [...garages.map((kind) => `${kind} garage`), positive(imp.carport) && 'Carport'].filter(Boolean);
    if (parking.length) facts.parking_type = parking.join(', ');
    put(facts, 'carport_sqft', positive(imp.carport));
    if (imp.pool) facts.pool = 'Yes';
    if (kind === 'property') put(facts, 'stories', Math.max(...[...imp.floors].map(Number), 0) || null);
  }
  if (imp && kind === 'building') put(facts, 'gross_sqft', positive(imp.area));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.acres));
  if (!row.partial) {
    put(facts, 'value_year', positive(row.year));
    put(facts, 'market_value', positive(row.market));
    put(facts, 'market_land_value', positive(row.land));
    put(facts, 'market_building_value', positive(row.building));
  }
  return { id: `pp:${kind}:${FIPS}:${account}`, kind, home_type: homeType, address: { ...address, city: String(word(row.city) || '').toUpperCase(), zip: zipCode(row.zip) }, facts };
}

// The newest year's folder that holds a certified file for all properties.
async function latestExport(today) {
  for (let y = today.getFullYear(); y >= today.getFullYear() - 1; y -= 1) {
    const folder = `${FILES}/${y}/CertifiedDataAllProperty/`;
    const page = await fetch(folder, { headers: { 'User-Agent': USER_AGENT } });
    if (!page.ok) continue;
    const name = /href="([^"?/]+\.zip)"/i.exec(await page.text())?.[1];
    if (name) return { year: y, url: folder + name };
  }
  throw new Error('The district no longer publishes a certified file for all properties');
}

async function* build({ work, today }) {
  const latest = await latestExport(today);
  const zip = path.join(work, 'tx-denton', `${latest.year}-CERTIFIED-DATA-ALL-PROPERTIES.zip`);
  await download(latest.url, zip);
  const asOf = await exportDate(zip);
  const [words, subdivisions] = [await codes(zip, 'STATE_CD'), await codes(zip, 'ABS_SUBD')];
  const stats = {};
  const rows = [];
  for await (const row of properties(zip, stats)) {
    if (/REFERENCE/.test(words.get(row.state) || '') || row.state === 'PLAN') stats.reference = (stats.reference || 0) + 1;
    else rows.push(row);
  }
  log(`${rows.length} real and mobile home accounts, ${stats.protected || 0} protected, ${stats.reference || 0} reference plans`);
  const main = await mainImprovements(zip, new Set(rows.map((row) => row.id)), classify, ATTRIBUTES);
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
  // Live: its page keeps the full and half baths it showed until its bath_totals switch is on (lib/held.cjs keepSplit).
  log(`${COUNTY}: ${keepSplit(list, { zeroFull: true })} homes keep the full and half baths their bath total was split into, until the county's bath_totals switch is on`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'TX', name: COUNTY, publisher: 'Denton Central Appraisal District', dataset: 'certified appraisal export', method: 'county', source: 'tx-denton', as_of: asOf, stale_after_days: 450, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    columns: ['prop_id', 'yr_built', 'imprv_det_area', 'Main Area', 'Attached Garage', 'Carport', 'Bedrooms', 'Plumbing', 'Fireplaces', 'Foundation', 'Roof Covering', 'Condition', 'Number of Rooms', 'land_acres', 'market_value', 'land_hstd_val', 'imprv_hstd_val', 'prop_val_yr', 'abs_subdv_desc', 'legal_desc', 'state_cd_description'],
    facts: { year_built: 'yr_built', living_sqft: 'imprv_det_area', gross_sqft: 'imprv_det_area', garage_sqft: 'Attached Garage', carport_sqft: 'Carport', bedrooms: 'Bedrooms', bathrooms: 'Plumbing', full_baths: 'Plumbing', half_baths: 'Plumbing', rooms: 'Number of Rooms', fireplaces: 'Fireplaces', foundation: 'Foundation', roof_cover: 'Roof Covering', condition: 'Condition', lot_acres: 'land_acres', market_value: 'market_value', market_land_value: 'land_hstd_val', market_building_value: 'imprv_hstd_val', value_year: 'prop_val_yr', subdivision: 'abs_subdv_desc', legal_description: 'legal_desc', land_use: 'state_cd_description' },
  },
};
