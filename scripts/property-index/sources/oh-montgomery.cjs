'use strict';
// Montgomery County, Ohio: the Treasurer's monthly CAMA files, free on its File Downloads page with a published layout. Year built,
// rooms, bedrooms, baths, living area, stories, walls, basement, heat, values and sales. No terms are stated on the page. Only four
// of its tables are read, and only the columns named here: owner, mailing and homestead tables aren't opened, and the sales
// table's owner columns are never cut out. The file's positions past column 115 of a dwelling sit one to the right of its layout.

const path = require('node:path');
const { spawn } = require('node:child_process');
const { download, streamLines, USER_AGENT } = require('../lib/tables.cjs');
const { year, zipCode, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '39113';
const COUNTY = 'Montgomery County';
const SITE = 'https://go.mcohio.org/applications/treasurer/search';
const WALLS = { 1: 'Frame', 2: 'Brick', 3: 'Masonry and frame', 4: 'Block', 5: 'Stucco', 6: 'Aluminum or vinyl', 7: 'Stone', 8: 'Asbestos', 9: 'Concrete' };
const BASEMENT = { 2: 'Crawl space', 3: 'Partial basement', 4: 'Full basement' };
const HEAT = { 2: 'Non-central', 3: 'Central heat', 4: 'Central heat and air', 5: 'Geothermal' };
const USE_WORDS = { 500: 'Residential vacant land', 501: 'Residential vacant land', 510: 'Single-family dwelling', 511: 'Single-family dwelling', 520: 'Two-family dwelling', 530: 'Three-family dwelling', 550: 'Condominium', 560: 'Mobile home', 569: 'Other residential structures', 599: 'Other residential' };
const MONTHS = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };

const cut = (line, start, end) => line.slice(start, end).trim();
const amount = (line, start, end) => Number(cut(line, start, end)) || 0;

async function* table(zip, name) {
  const child = spawn('unzip', ['-p', zip, `*${name}.DAT`], { stdio: ['ignore', 'pipe', 'ignore'] });
  child.stdout.setEncoding('latin1');
  yield* streamLines(child.stdout);
}

function useOf(code, hasUnit) {
  const c = String(code ?? '').trim();
  if (c === '510' || c === '511') return hasUnit ? ['unit', 'condo'] : ['property', 'house'];
  if (c === '550') return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (c === '520' || c === '530') return ['building', 'multi_unit'];
  if (c === '560') return ['property', 'mobile_home'];
  if (/^(100|300|400|401|500|501|600|640)$/.test(c)) return ['parcel', null];
  return ['other', null];
}

// "01-JUN-25": 50 and up is last century.
function saleDate(text) {
  const match = /^(\d{1,2})-([A-Z]{3})-(\d{2})$/.exec(String(text ?? '').trim().toUpperCase());
  if (!match || !MONTHS[match[2]]) return null;
  const yy = Number(match[3]);
  return `${yy >= 50 ? 1900 + yy : 2000 + yy}-${MONTHS[match[2]]}-${match[1].padStart(2, '0')}`;
}

function fromParcel(line, dwell, value, sale) {
  const parcel = cut(line, 0, 30);
  const unit = [cut(line, 157, 167), cut(line, 167, 177)].filter(Boolean).join(' ');
  const secondary = realUnit(unit);
  const address = streetParts({ number: cut(line, 57, 67), pre: cut(line, 67, 69), name: cut(line, 87, 117), suffix: cut(line, 69, 77), post: cut(line, 85, 87), unit: secondary });
  if (!address || !parcel) return null;
  const use = cut(line, 238, 242);
  const [kind, homeType] = useOf(use, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([cut(line, 57, 67), cut(line, 67, 69), cut(line, 87, 117), cut(line, 69, 77), cut(line, 85, 87)].filter(Boolean).join(' '), unit));
  put(facts, 'land_use', USE_WORDS[use]);
  put(facts, 'county_use_code', word(use));
  if (dwell && (home || kind === 'building')) {
    put(facts, 'year_built', year(dwell.built));
    put(facts, 'stories', positive(dwell.stories));
    put(facts, 'exterior_walls', WALLS[dwell.walls]);
    put(facts, 'foundation', BASEMENT[dwell.basement]);
    put(facts, 'heating', HEAT[dwell.heat]);
  }
  if (dwell && home) {
    put(facts, 'living_sqft', positive(dwell.living));
    put(facts, 'rooms', positive(dwell.rooms));
    put(facts, 'bedrooms', positive(dwell.bedrooms));
    const [full, half] = [positive(dwell.full), positive(dwell.half)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
    put(facts, 'basement_finished_sqft', positive(dwell.finished));
    put(facts, 'fireplaces', positive(dwell.fireplaces));
  } else if (dwell && kind === 'building') put(facts, 'gross_sqft', positive(dwell.living));
  if (kind === 'building') put(facts, 'units', positive(amount(line, 243, 247)));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(amount(line, 321, 335)) || positive(amount(line, 307, 321)));
  if (value) {
    put(facts, 'value_year', positive(value.year));
    put(facts, 'market_value', positive(value.total));
    put(facts, 'market_land_value', positive(value.land));
    put(facts, 'market_building_value', positive(value.building));
  }
  if (sale) {
    facts.sale_price = sale.price;
    facts.sale_date = sale.date;
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: cut(line, 117, 157).toUpperCase(), zip: zipCode(cut(line, 217, 222)) }, facts };
}

async function latestFile() {
  const page = await (await fetch(`${SITE}/fdpopup.cfm?dtype=CC`, { headers: { 'User-Agent': USER_AGENT } })).text();
  const dates = [...page.matchAll(/Cama_Files_(\d{8})\.zip/g)].map((match) => match[1]).sort();
  if (!dates.length) throw new Error('The downloads page no longer lists a CAMA file');
  return dates.at(-1);
}

async function* build({ work }) {
  const stamp = await latestFile();
  const zip = path.join(work, 'oh-montgomery', `Cama_Files_${stamp}.zip`);
  download(`${SITE}/data/Cama/Cama_Files_${stamp}.zip`, zip);
  // A parcel can hold several cards: the first is its main building. The file wraps each dwelling's date onto a line of its own.
  const dwellings = new Map();
  for await (const line of table(zip, 'DWELL')) {
    if (line.length < 480) continue;
    const parcel = cut(line, 0, 30);
    const card = amount(line, 36, 41);
    const held = dwellings.get(parcel);
    if (held && held.card <= card) continue;
    dwellings.set(parcel, { card, stories: amount(line, 50, 54), walls: cut(line, 54, 56), built: cut(line, 58, 63), rooms: amount(line, 68, 71), bedrooms: amount(line, 71, 74), full: amount(line, 76, 79), half: amount(line, 79, 82), basement: cut(line, 90, 91), heat: cut(line, 91, 92), finished: amount(line, 146, 153), fireplaces: amount(line, 191, 194), living: amount(line, 473, 480) });
  }
  log(`${dwellings.size} parcels with a dwelling`);
  const values = new Map();
  for await (const line of table(zip, 'APRVAL')) {
    if (line.length >= 125) values.set(cut(line, 0, 30), { year: amount(line, 36, 41), land: amount(line, 47, 58), building: amount(line, 58, 69), total: amount(line, 69, 80) });
  }
  const sales = new Map();
  for await (const line of table(zip, 'SALES')) {
    if (line.length < 190) continue;
    const [date, price] = [saleDate(cut(line, 168, 177)), amount(line, 177, 188)];
    if (!date || price <= 100) continue;
    const parcel = cut(line, 0, 30);
    if (!sales.has(parcel) || sales.get(parcel).date < date) sales.set(parcel, { date, price });
  }
  log(`${values.size} parcels with values, ${sales.size} with a sale`);
  const records = new Map();
  let noAddress = 0;
  const asOf = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;
  for await (const line of table(zip, 'PARDAT')) {
    if (line.length < 340) continue;
    const parcel = cut(line, 0, 30);
    const record = fromParcel(line, dwellings.get(parcel), values.get(parcel), sales.get(parcel));
    if (!record) noAddress += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'OH', name: COUNTY, publisher: 'Montgomery County Treasurer', dataset: 'CAMA files', method: 'county', source: 'oh-montgomery', as_of: asOf, stale_after_days: 450, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    columns: ['Yrblt', 'Stories', 'Extwall', 'Bsmt', 'Heat', 'Sfla Total Living Area', 'Rmtot Total Rooms', 'Rmbed Number of Bedrooms', 'Fixbath Number of Full Bathrooms', 'Fixhalf Number of Half Bathrooms', 'Finbsmtarea Finished Basement Living Area', 'Wbfp_o Wood Burning Fireplace Openings', 'Livunit Number of living units', 'Acres Total Acres', 'Taxyr Tax Year', 'Aprtot Total Appraised Value', 'Aprland Appraised land value', 'Aprbldg Appraised building value', 'Price Sale Price', 'Saledt Sale Date', 'Luc Land Use Code'],
    facts: { year_built: 'Yrblt', stories: 'Stories', exterior_walls: 'Extwall', foundation: 'Bsmt', heating: 'Heat', living_sqft: 'Sfla Total Living Area', gross_sqft: 'Sfla Total Living Area', rooms: 'Rmtot Total Rooms', bedrooms: 'Rmbed Number of Bedrooms', full_baths: 'Fixbath Number of Full Bathrooms', half_baths: 'Fixhalf Number of Half Bathrooms', basement_finished_sqft: 'Finbsmtarea Finished Basement Living Area', fireplaces: 'Wbfp_o Wood Burning Fireplace Openings', units: 'Livunit Number of living units', lot_acres: 'Acres Total Acres', value_year: 'Taxyr Tax Year', market_value: 'Aprtot Total Appraised Value', market_land_value: 'Aprland Appraised land value', market_building_value: 'Aprbldg Appraised building value', sale_price: 'Price Sale Price', sale_date: 'Saledt Sale Date', land_use: 'Luc Land Use Code' },
  },
};
