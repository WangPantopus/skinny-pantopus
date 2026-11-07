'use strict';
// Pierce County, Washington: the Assessor-Treasurer's weekly Data Mart, free pipe-delimited files with published descriptions; the county
// disclaims any warranty. Year built, floor area, bedrooms, baths, stories, style, walls, roof, heat, garage, basement, condition,
// quality, values and sales. Only named positions are read: the sale file's grantor and grantee and the exemption columns are never kept.
// An address holding "XXX" is the county's estimate from its map, and isn't used. The files have no ZIP, so the county's come from the Census.

const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { download, streamLines } = require('../lib/tables.cjs');
const { year, isoDate, onRecord } = require('../lib/addresses.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '53053';
const COUNTY = 'Pierce County';
const FILES = 'https://online.co.pierce.wa.us/datamart';
const LIVING_TYPES = new Set(['Residential', 'Townhouse', 'Mobile Home', 'Duplex', 'Triplex', 'Multiple Unit']);

async function* rows(work, name) {
  const zip = path.join(work, 'wa-pierce', `${name}.zip`);
  download(`${FILES}/${name}.zip`, zip);
  const child = spawn('unzip', ['-p', zip], { stdio: ['ignore', 'pipe', 'ignore'] });
  child.stdout.setEncoding('latin1');
  for await (const line of streamLines(child.stdout)) yield line.split('|');
}

function useOf(code, words, hasUnit) {
  const c = String(code ?? '').trim();
  if (c === '1101' || c === '1800') return hasUnit ? ['unit', 'condo'] : ['property', 'house'];
  if (c === '1152' || c === '1155') return ['property', 'mobile_home'];
  if (c.startsWith('14')) return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (c === '1202' || c === '1203' || c === '1204') return ['building', 'multi_unit'];
  if (c.startsWith('13')) return ['building', 'apartment'];
  if (/VAC|UNDEVELOPED|FOREST|FARM|AGRI|TIMBER/.test(String(words ?? '').toUpperCase())) return ['parcel', null];
  return ['other', null];
}

function fromAccount(row, building, land, sale) {
  const [parcel, line] = [word(row[0]), word(row[3])];
  if (!parcel || !line || /XXX/i.test(line)) return null;
  const address = parse(line);
  if (!address) return null;
  const [kind, homeType] = useOf(row[4], row[5], address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(line));
  put(facts, 'land_use', word(row[5]));
  put(facts, 'county_use_code', word(row[4]));
  put(facts, 'subdivision', word(row[26]));
  if (building && (home || kind === 'building')) {
    put(facts, 'year_built', year(building.built));
    put(facts, 'style', word(building.style));
    put(facts, 'stories', positive(building.stories));
    put(facts, 'exterior_walls', word(building.walls));
    put(facts, 'roof_cover', word(building.roof));
    put(facts, 'heating', word(building.heat) === 'None' ? null : word(building.heat));
    put(facts, 'quality', word(building.quality));
    put(facts, 'condition', word(building.condition));
  }
  if (building && home) {
    put(facts, 'living_sqft', positive(building.net));
    put(facts, 'bedrooms', positive(building.bedrooms) <= 15 ? positive(building.bedrooms) : null);
    put(facts, 'bathrooms', positive(building.baths));
    put(facts, 'basement_sqft', positive(building.basement));
    put(facts, 'basement_finished_sqft', positive(building.basementFinished));
    put(facts, 'garage_sqft', (positive(building.attached) || 0) + (positive(building.detached) || 0) || null);
    put(facts, 'carport_sqft', positive(building.carport));
    put(facts, 'fireplaces', positive(building.fireplaces));
  } else if (building && kind === 'building') {
    put(facts, 'gross_sqft', positive(building.net));
    put(facts, 'units', positive(building.units));
  }
  if (land && kind !== 'unit') {
    put(facts, 'lot_acres', positive(land.acres));
    put(facts, 'water_source', word(land.water));
    put(facts, 'sewer', word(land.sewer));
  }
  // The coming year's values are filled parcel by parcel: the last year's stand until then.
  const [valueYear, landValue, improvement, total] = positive(row[20]) ? [row[14], row[18], row[19], row[20]] : [row[6], row[10], row[11], row[12]];
  put(facts, 'value_year', positive(valueYear));
  put(facts, 'market_value', positive(total));
  put(facts, 'market_land_value', positive(landValue));
  put(facts, 'market_building_value', positive(improvement));
  if (sale) {
    facts.sale_price = sale.price;
    facts.sale_date = sale.date;
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: '', zip: null }, facts };
}

async function* build({ work }) {
  // On each parcel, the biggest living building.
  const buildings = new Map();
  for await (const row of rows(work, 'improvement')) {
    if (!LIVING_TYPES.has(row[2])) continue;
    const held = buildings.get(row[0]);
    const net = positive(row[6]) || positive(row[5]) || 0;
    if (held && held.net >= net) continue;
    buildings.set(row[0], { id: row[1], net, condition: row[8], quality: row[9], basement: row[16], basementFinished: row[17], carport: row[18], attached: row[21], detached: row[22], fireplaces: row[23] });
  }
  log(`${buildings.size} parcels with a living building`);
  for await (const row of rows(work, 'improvement_builtas')) {
    const held = buildings.get(row[0]);
    if (!held || held.id !== row[1] || row[2] !== '1') continue;
    Object.assign(held, { style: row[4], heat: row[7], walls: row[8], stories: row[10], roof: row[13], bedrooms: row[14], baths: row[15], units: row[16], built: row[19] });
  }
  const lands = new Map();
  for await (const row of rows(work, 'appraisal_account')) lands.set(row[0], { acres: row[7], sewer: row[19], water: row[20] });
  const sales = new Map();
  for await (const row of rows(work, 'sale')) {
    const [date, price] = [isoDate(row[3]), positive(row[4])];
    if (row[1] !== '1' || !date || !(price > 100)) continue;
    const held = sales.get(row[2]);
    if (!held || held.date < date) sales.set(row[2], { date, price });
  }
  log(`${lands.size} parcels with land, ${sales.size} with a single-parcel sale`);
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of rows(work, 'tax_account')) {
    if (row[1] !== 'REAL' && row[1] !== 'MOBIL') continue;
    const record = fromAccount(row, buildings.get(row[0]), lands.get(row[0]), sales.get(row[0]));
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without an address`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  const stamp = /(\d{2})-(\d{2})-(\d{4})/.exec(execFileSync('unzip', ['-l', path.join(work, 'wa-pierce', 'tax_account.zip')], { encoding: 'utf8' }));
  if (!stamp) throw new Error('The file no longer says when it was made');
  yield {
    fips: FIPS, state: 'WA', name: COUNTY, publisher: 'Pierce County Assessor-Treasurer', dataset: 'Data Mart', method: 'county', source: 'wa-pierce', as_of: `${stamp[3]}-${stamp[1]}-${stamp[2]}`, stale_after_days: 450, extra_zips: zipsByCounty(work, ['53']).get(FIPS) || [], records,
  };
}

module.exports = {
  build,
  dictionary: {
    columns: ['Year Built', 'Built-As Description', 'Stories', 'Exterior', 'Roof Cover', 'HVAC Description', 'Quality', 'Condition', 'Net Square Feet', 'Bedrooms', 'Bathrooms', 'Basement Square Feet', 'Basement Finished Square Feet', 'Attached Garage Square Feet', 'Carport Square Feet', 'Fireplaces', 'Units', 'Land Gross Acres', 'Utility Water', 'Utility Sewer', 'Tax Year', 'Total Market Value', 'Land Value', 'Improvement Value', 'Sale Price', 'Sale Date', 'Use Description', 'Subdivision Name'],
    facts: { year_built: 'Year Built', style: 'Built-As Description', stories: 'Stories', exterior_walls: 'Exterior', roof_cover: 'Roof Cover', heating: 'HVAC Description', quality: 'Quality', condition: 'Condition', living_sqft: 'Net Square Feet', gross_sqft: 'Net Square Feet', bedrooms: 'Bedrooms', bathrooms: 'Bathrooms', basement_sqft: 'Basement Square Feet', basement_finished_sqft: 'Basement Finished Square Feet', garage_sqft: 'Attached Garage Square Feet', carport_sqft: 'Carport Square Feet', fireplaces: 'Fireplaces', units: 'Units', lot_acres: 'Land Gross Acres', water_source: 'Utility Water', sewer: 'Utility Sewer', value_year: 'Tax Year', market_value: 'Total Market Value', market_land_value: 'Land Value', market_building_value: 'Improvement Value', sale_price: 'Sale Price', sale_date: 'Sale Date', land_use: 'Use Description', subdivision: 'Subdivision Name' },
  },
};
