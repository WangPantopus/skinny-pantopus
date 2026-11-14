'use strict';
// Ashtabula County, Ohio: the County Auditor's CAMA data download, a yearly zip of its appraisal system's tables (cltdatYYYY.zip, quoted
// comma-separated with a header row, and a published table crosswalk), linked from the county's GIS open data site. No license and no
// limit on use are stated; the Auditor's site terms bar only unlawful or harmful use. Year built, living area, bedrooms, full and half
// baths, stories, style, acres, the appraised land, building and total values (Ohio appraises at full market value; tax is figured on
// 35% of it), and the last single-parcel sale the Auditor validated. Four tables are read, and only the columns named here: the owner,
// mailing, tax and payment tables are never opened, and the sales table's owner columns are never asked for.
// Few rows carry a city or ZIP, so the county's ZIP codes (from the Census) let an address find it.

const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { download, zipTable, zipDates, USER_AGENT } = require('../lib/tables.cjs');
const { year, monthDate, zipCode, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '39007';
const COUNTY = 'Ashtabula County';
const SITE = 'https://auditor.ashtabulacounty.gov/dnn';
const PARCEL_COLUMNS = ['PARID', 'TAXYR', 'ADRNO', 'ADRADD', 'ADRDIR', 'ADRSTR', 'ADRSUF', 'ADRSUF2', 'UNITNO', 'CITYNAME', 'ZIP1', 'LUC', 'ACRES', 'NBHD'];
const DWELLING_COLUMNS = ['PARID', 'CARD', 'STORIES', 'STYLE', 'YRBLT', 'RMTOT', 'RMBED', 'FIXBATH', 'FIXHALF', 'SFLA', 'EXTWALL'];
const VALUE_COLUMNS = ['PARID', 'TAXYR', 'APRLAND', 'APRBLDG', 'APRTOT'];
const SALE_COLUMNS = ['PARID', 'SALEDT', 'PRICE', 'SALEVAL', 'NOPAR'];

// The county's own code table in the zip (AEDIT.DAT, DWELDAT fields).
const STYLES = {
  '01': 'Raised ranch or bi-level', '02': 'Split level', '03': 'Ranch', '04': 'Row house', '05': 'Old style', '06': 'Bungalow', '07': 'Colonial', '08': 'Cape Cod', '09': 'Modern',
  10: 'Condominium', 11: 'Duplex', 12: 'Triplex', 14: 'Contemporary', 15: 'Log home', 16: 'Tudor', 17: 'Manufactured or modular, single wide', 18: 'Manufactured or modular, double wide',
  19: 'Cabin or cottage', 20: 'Conversion', 21: 'Living area over garage', 23: 'Earth sheltered', 24: 'Basement dwelling', 25: 'Geodesic dome', 26: 'Townhouse', 27: 'A-frame',
};
const WALLS = { 1: 'Wood or vinyl', 2: 'Stucco', 3: 'Tile', 4: 'Concrete block', 5: 'Metal', 6: 'Concrete', 7: 'Brick', 8: 'Stone', 9: 'Frame with masonry' };
// The state's words for its residential and apartment codes (Ohio Administrative Code 5703-25-10), whatever the tract's size.
const USE_WORDS = { 50: 'Residential vacant land', 51: 'Single family dwelling', 52: 'Two family dwelling', 53: 'Three family dwelling', 55: 'Condominium residential unit', 56: 'House trailer or mobile home affixed to real estate' };
const landUse = (code) => {
  const c = String(code || '').trim();
  if (c === '599') return 'Other residential structures';
  if (/^40[1-3]$/.test(c)) return 'Apartments';
  return /^5[0-6][0-5]$/.test(c) ? USE_WORDS[c.slice(0, 2)] || null : null;
};

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

// Ohio's land use codes (Ohio Administrative Code 5703-25-10): the first two digits are the use and the last the tract's size, so 510-515 are
// one-family dwellings, 520-525 two-family, 530-535 three-family, 550-555 condominium units, 560-565 mobile homes on their land, 500-505
// vacant residential land and 599 other residential structures; 1xx is agricultural and 401-403 apartments. The county's own codes outside
// that list (508, 518, 570) name no type: a parcel under one of them, under 599 or under a farm code is a home of no named type when the
// Auditor has a dwelling card for it, and land otherwise.
function useOf(code, dwelling, unit) {
  const c = String(code || '').trim();
  if (/^51[0-5]$/.test(c)) return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (/^55[0-5]$/.test(c)) return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (/^56[0-5]$/.test(c)) return ['property', 'mobile_home'];
  if (/^5[23][0-5]$/.test(c)) return ['building', 'multi_unit'];
  if (/^40[1-3]$/.test(c)) return ['building', 'apartment'];
  if (/^(5\d\d|1\d\d)$/.test(c)) return dwelling ? ['property', null] : ['parcel', null];
  return ['other', null];
}

// "MAIN (SR 7)": the route number in brackets isn't part of the street people write. A trailing R marks a rear lot, not a direction.
const streetName = (text) => String(text ?? '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
const postOf = (text) => (/^(N|S|E|W|NE|NW|SE|SW|EXT)$/.test(String(text ?? '').trim()) ? String(text).trim() : '');
// The unit column writes "UN 21", "UNIT 4", "#3" or "4"; words there ("PRIVATE DR") aren't a unit.
const unitOf = (text) => {
  const unit = realUnit(String(text ?? '').trim().toUpperCase().replace(/^(?:UNIT|UN|APT|#)\s*(?=[A-Z0-9])/, ''));
  return /^[A-Z0-9-]{1,8}$/.test(unit) ? unit : '';
};
const numberSuffixOf = (text) => (/^(1\/2|[A-Z])$/.test(String(text ?? '').trim()) ? String(text).trim() : '');

function fromParcel(row, dwelling, value, sale) {
  const parcel = word(row.PARID);
  const number = String(row.ADRNO ?? '').trim();
  if (!parcel || !/^\d/.test(number) || /^0+$/.test(number)) return null;
  const unit = unitOf(row.UNITNO);
  const name = streetName(row.ADRSTR);
  const address = streetParts({ number, numberSuffix: numberSuffixOf(row.ADRADD), pre: row.ADRDIR, name, suffix: row.ADRSUF, post: postOf(row.ADRSUF2), unit });
  if (!address) return null;
  const [kind, homeType] = useOf(row.LUC, dwelling, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([number, numberSuffixOf(row.ADRADD), row.ADRDIR, name, row.ADRSUF, postOf(row.ADRSUF2)].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'land_use', landUse(row.LUC));
  put(facts, 'county_use_code', word(row.LUC));
  put(facts, 'neighborhood', word(row.NBHD));
  if (dwelling && (home || kind === 'building')) {
    put(facts, 'year_built', year(dwelling.YRBLT));
    put(facts, 'exterior_walls', WALLS[String(dwelling.EXTWALL || '').trim()]);
  }
  if (dwelling && home) {
    put(facts, 'living_sqft', positive(dwelling.SFLA));
    put(facts, 'rooms', inRange(dwelling.RMTOT, 30));
    put(facts, 'bedrooms', inRange(dwelling.RMBED, 15));
    const [full, half] = [inRange(dwelling.FIXBATH, 12), inRange(dwelling.FIXHALF, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
    put(facts, 'stories', inRange(dwelling.STORIES, 5));
    put(facts, 'style', STYLES[String(dwelling.STYLE || '').trim()] || STYLES[Number(dwelling.STYLE)]);
  } else if (dwelling && kind === 'building') put(facts, 'gross_sqft', positive(dwelling.SFLA));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.ACRES));
  if (value) {
    put(facts, 'value_year', positive(value.TAXYR));
    put(facts, 'market_value', positive(value.APRTOT));
    put(facts, 'market_land_value', positive(value.APRLAND));
    put(facts, 'market_building_value', positive(value.APRBLDG));
  }
  if (sale) {
    facts.sale_price = sale.price;
    facts.sale_date = sale.date;
  }
  // A few rows name their post office with its ZIP; a city column without a ZIP sometimes holds a legal description instead.
  const zip = zipCode(row.ZIP1);
  const city = String(row.CITYNAME ?? '').trim().toUpperCase();
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: zip && /^[A-Z][A-Z ]*$/.test(city) ? city : '', zip }, facts };
}

// The zip is named for its tax year and replaced once a year; the newest one the Auditor has posted is read.
function published(url) {
  try {
    execFileSync('curl', ['-sfIL', '-A', USER_AGENT, '--max-time', '60', '-o', '/dev/null', url], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function* build({ work, today }) {
  const thisYear = today.getUTCFullYear();
  const taxYear = [thisYear, thisYear - 1, thisYear - 2].find((y) => published(`${SITE}/cltdat${y}.zip`));
  if (!taxYear) throw new Error('The Auditor no longer posts a CAMA zip for this year or the two before it');
  const zip = path.join(work, 'oh-ashtabula', `cltdat${taxYear}.zip`);
  download(`${SITE}/cltdat${taxYear}.zip`, zip);
  const read = (member, columns) => zipTable(zip, member, columns, { delimiter: ',', quoted: true });
  // A parcel can hold several cards: the first is its main building.
  const dwellings = new Map();
  for await (const row of read('DWELL.DAT', DWELLING_COLUMNS)) {
    const held = dwellings.get(row.PARID);
    if (!held || (positive(row.CARD) || 1) < (positive(held.CARD) || 1)) dwellings.set(row.PARID, row);
  }
  const values = new Map();
  for await (const row of read('APRVAL.DAT', VALUE_COLUMNS)) values.set(row.PARID, row);
  // The latest sale of one parcel the Auditor marked validated (code 0 in its code table), at a home's price.
  const sales = new Map();
  for await (const row of read('SALES.DAT', SALE_COLUMNS)) {
    const [date, price] = [monthDate(row.SALEDT, thisYear), positive(row.PRICE)];
    if (String(row.SALEVAL).trim() !== '0' || (positive(row.NOPAR) || 1) > 1 || !date || !isHomeSale(price)) continue;
    const held = sales.get(row.PARID);
    if (!held || held.date < date) sales.set(row.PARID, { date, price });
  }
  log(`${dwellings.size} parcels with a dwelling, ${values.size} with values, ${sales.size} with a validated sale`);
  const asOf = zipDates(zip).get('PARDAT.DAT');
  if (!asOf) throw new Error('The CAMA zip no longer dates its parcel table');
  const records = new Map();
  let noAddress = 0;
  for await (const row of read('PARDAT.DAT', PARCEL_COLUMNS)) {
    const record = fromParcel(row, dwellings.get(row.PARID), values.get(row.PARID), sales.get(row.PARID));
    if (!record) noAddress += 1;
    else if (!records.has(record.id)) records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: tax year ${taxYear}, ${list.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'OH', name: COUNTY, publisher: 'Ashtabula County Auditor', dataset: 'CAMA data download', method: 'county', source: 'oh-ashtabula', as_of: asOf, stale_after_days: 450, extra_zips: zipsByCounty(work, ['39']).get(FIPS) || [], records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    // The columns read, with each one's description in the Auditor's table crosswalk (AshtabulaCountyCAMA_crosswalk_diagram.pdf, AA407 layout 2021.1).
    columns: {
      PARID: 'Parcel Id Number', TAXYR: 'Tax Year', ADRNO: 'Street Number', ADRADD: 'Street Number Suffix', ADRDIR: 'Address Direction', ADRSTR: 'Street Name', ADRSUF: 'Street Suffix', ADRSUF2: 'Street Suffix 2',
      UNITNO: 'Address Unit Number', CITYNAME: 'City Name', ZIP1: 'Zip Code, First 5-digits', LUC: 'Land Use Code', ACRES: 'Acres', NBHD: 'Neighborhood', CARD: 'Building Card Number', STORIES: 'Story Height', STYLE: 'Architectural style',
      YRBLT: 'Year Built', RMTOT: 'Total Rooms', RMBED: 'Number of Bedrooms', FIXBATH: 'Number of Full Bathrooms', FIXHALF: 'Number of Half Bathrooms', SFLA: 'Total Living Area', EXTWALL: 'Exterior Wall Code',
      APRLAND: 'Appraised Land Value', APRBLDG: 'Appraised building value', APRTOT: 'Total Appraised Value', SALEDT: 'Sale Date', PRICE: 'Sale Price',
      SALEVAL: 'Sale Validity Code', NOPAR: 'Number of Parcels',
    },
    facts: {
      year_built: 'YRBLT', exterior_walls: 'EXTWALL', living_sqft: 'SFLA', gross_sqft: 'SFLA', rooms: 'RMTOT', bedrooms: 'RMBED', bathrooms: 'FIXBATH', full_baths: 'FIXBATH', half_baths: 'FIXHALF', stories: 'STORIES',
      style: 'STYLE', lot_acres: 'ACRES', value_year: 'TAXYR', market_value: 'APRTOT', market_land_value: 'APRLAND', market_building_value: 'APRBLDG', sale_price: 'PRICE', sale_date: 'SALEDT',
      land_use: 'LUC', county_use_code: 'LUC', neighborhood: 'NBHD',
    },
  },
};
