'use strict';
// An Ohio County Auditor's "Public Records Extract" (ISSG's real estate system, the "Full Real Estate Data (CAMA & Tax in XML format)" download): one XML
// table per record type, each row one element whose attributes are its columns, with a published File Layout.xlsx inside. Year built, living area,
// rooms, bedrooms, full and half baths, stories, acres, the appraised land and improvement values (Ohio appraises at full market value; tax is figured
// on 35% of it) and the last single-parcel sale the Auditor marked valid. Five tables are read, and only the columns named here: the owner, payment,
// tax, distribution and delinquency tables are never opened, and the parcel table's owner, taxpayer and lender columns are never asked for. The
// extract holds up to three tax years; the build reads the latest. Each county's connector names its file and states its terms.

const path = require('node:path');
const { spawn } = require('node:child_process');
const { download, zipDates } = require('./tables.cjs');
const { year, isoDate, zipCode, realUnit, streetParts, onRecord } = require('./addresses.cjs');
const { positive, put, word } = require('./values.cjs');
const { zipsByCounty } = require('./zcta.cjs');
const { condoBuildings } = require('./condos.cjs');
const { isHomeSale } = require('./sales.cjs');
const { log } = require('./log.cjs');

const PARCEL_COLUMNS = ['Parcel_Number', 'Tax_Year', 'Acres', 'Retired', 'Subdivision', 'School_District'];
const LOCATION_COLUMNS = ['Parcel_Number', 'Tax_Year', 'Principal', 'Number', 'PreDirection', 'Street', 'StreetSuffix', 'PostDirection', 'Unit', 'City', 'ZipCode'];
const DWELLING_COLUMNS = ['Parcel_Number', 'Tax_Year', 'Card', 'Type', 'Story_Height', 'Total_Rooms', 'Bed_Rooms', 'Full_Baths', 'Half_Baths', 'Living_Area', 'Year_Built'];
const VALUE_COLUMNS = ['Parcel_Number', 'Tax_Year', 'Land_Use_Code', 'Land_Use', 'Appraised_Land_100', 'Appraised_Improvement_100'];
const TRANSFER_COLUMNS = ['Parcel_Number', 'Date_Conveyed', 'Number_Of_Parcels', 'Consideration', 'Valid_Sale', 'Land_Only'];

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unescape = (text) => text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, name) => {
  if (name[0] === '#') return String.fromCodePoint(name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
  return ENTITIES[name] ?? whole;
});

/** Each row of one table in the extract (`<Tag a="1" b="2" />`), holding only `columns`; a missing column stops the build (the layout changed). */
async function* xmlTable(zip, member, tag, columns) {
  const unzip = spawn('unzip', ['-p', zip, member], { stdio: ['ignore', 'pipe', 'ignore'] });
  const exited = new Promise((resolve, reject) => {
    unzip.on('error', reject);
    unzip.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`unzip of ${member} exited ${code}`))));
  });
  unzip.stdout.setEncoding('utf8');
  const element = new RegExp(`<${tag}((?:\\s+\\w+="[^"]*")*)\\s*/>`, 'g');
  const wanted = new Set(columns);
  let rest = '';
  let rows = 0;
  // A table can be one long line: read it in pieces and keep what follows the last whole row.
  for await (const piece of unzip.stdout) {
    const text = rest + piece;
    let end = 0;
    for (const match of text.matchAll(element)) {
      const row = {};
      for (const [, name, value] of match[1].matchAll(/(\w+)="([^"]*)"/g)) if (wanted.has(name)) row[name] = unescape(value).trim();
      if (rows === 0) {
        const missing = columns.filter((column) => !(column in row));
        if (missing.length) throw new Error(`${member} no longer has ${missing.join(', ')}`);
      }
      rows += 1;
      end = match.index + match[0].length;
      yield row;
    }
    rest = text.slice(end);
  }
  await exited;
  log(`${member}: ${rows} rows`);
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

// Ohio's land use codes (Ohio Administrative Code 5703-25-10), with the Auditor's own words for each ("510-SINGLE FAMILY DWELLING"): the first
// two digits are the use and the last the tract's size, so 510-515 are one-family dwellings, 520-525 two-family, 530-535 three-family, 550-555
// condominium units, 560-565 mobile homes on their land, 500-505 vacant residential land and 599 other residential structures; 1xx is
// agricultural and 401-403 apartments. The county's own residential codes outside that list (517, a residence qualified for the farm value),
// 599 and farm codes are a home of no named type when the Auditor has a dwelling card for the parcel, and land otherwise.
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

// "510-SINGLE FAMILY DWELLING" and "1-CONVENTIONAL": the code goes.
const words = (text) => word(String(text ?? '').replace(/^\s*[\w.]+-\s*/, ''));

function fromParcel({ FIPS, COUNTY }, row, place, dwelling, value, sale) {
  const parcel = word(row.Parcel_Number);
  const number = String(place?.Number ?? '').trim();
  if (!parcel || !/^\d/.test(number) || /^0+$/.test(number)) return null;
  const unit = realUnit(place.Unit);
  const address = streetParts({ number, pre: place.PreDirection, name: place.Street, suffix: place.StreetSuffix, post: place.PostDirection, unit });
  if (!address) return null;
  const [kind, homeType] = useOf(value?.code, dwelling, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([number, place.PreDirection, place.Street, place.StreetSuffix, place.PostDirection].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'land_use', words(value?.use));
  put(facts, 'county_use_code', word(value?.code));
  put(facts, 'subdivision', word(row.Subdivision));
  put(facts, 'school_district', word(row.School_District));
  if (dwelling && (home || kind === 'building')) put(facts, 'year_built', year(dwelling.Year_Built));
  if (dwelling && home) {
    put(facts, 'living_sqft', positive(dwelling.Living_Area));
    put(facts, 'rooms', inRange(dwelling.Total_Rooms, 30));
    put(facts, 'bedrooms', inRange(dwelling.Bed_Rooms, 15));
    const [full, half] = [inRange(dwelling.Full_Baths, 12), inRange(dwelling.Half_Baths, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
    put(facts, 'stories', inRange(dwelling.Story_Height, 5));
    put(facts, 'style', words(dwelling.Type));
  } else if (dwelling && kind === 'building') put(facts, 'gross_sqft', positive(dwelling.Living_Area));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.Acres));
  if (value) {
    put(facts, 'value_year', positive(row.Tax_Year));
    put(facts, 'market_value', positive(value.land + value.improvement));
    put(facts, 'market_land_value', positive(value.land));
    put(facts, 'market_building_value', positive(value.improvement));
  }
  if (sale) {
    facts.sale_price = sale.price;
    facts.sale_date = sale.date;
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(place.City) || '').toUpperCase(), zip: zipCode(place.ZipCode) }, facts };
}

async function* build({ FIPS, COUNTY, FILE, SOURCE, PUBLISHER }, { work }) {
  const zip = path.join(work, SOURCE, path.basename(new URL(FILE).pathname));
  download(FILE, zip);
  const asOf = zipDates(zip).get('Parcel.xml');
  if (!asOf) throw new Error('The extract no longer dates its parcel table');
  const parcels = [];
  for await (const row of xmlTable(zip, 'Parcel.xml', 'Parcel', PARCEL_COLUMNS)) parcels.push(row);
  const taxYear = parcels.reduce((latest, row) => Math.max(latest, positive(row.Tax_Year) || 0), 0);
  if (!taxYear) throw new Error('The extract has no tax year');
  const ofYear = (row) => positive(row.Tax_Year) === taxYear;
  const places = new Map();
  for await (const row of xmlTable(zip, 'Parcel Location.xml', 'Parcel_Location', LOCATION_COLUMNS)) {
    if (ofYear(row) && (/^YES$/i.test(row.Principal) || !places.has(row.Parcel_Number))) places.set(row.Parcel_Number, row);
  }
  // A parcel can hold several cards: the first is its main building.
  const dwellings = new Map();
  for await (const row of xmlTable(zip, 'Parcel Dwelling.xml', 'Parcel_Dwelling', DWELLING_COLUMNS)) {
    if (!ofYear(row)) continue;
    const held = dwellings.get(row.Parcel_Number);
    if (!held || (positive(row.Card) || 1) < (positive(held.Card) || 1)) dwellings.set(row.Parcel_Number, row);
  }
  // A parcel's value is split over several records (a starting value and adjustments, and a farm's or an abatement's share): the whole is their
  // sum. Its land use is the one on its largest record.
  const values = new Map();
  for await (const row of xmlTable(zip, 'Parcel Value.xml', 'Parcel_Value', VALUE_COLUMNS)) {
    if (!ofYear(row)) continue;
    const [land, improvement] = [Number(row.Appraised_Land_100) || 0, Number(row.Appraised_Improvement_100) || 0];
    const held = values.get(row.Parcel_Number) || { land: 0, improvement: 0, largest: -1, code: '', use: '' };
    held.land += land;
    held.improvement += improvement;
    if (land + improvement > held.largest) Object.assign(held, { largest: land + improvement, code: row.Land_Use_Code, use: row.Land_Use });
    values.set(row.Parcel_Number, held);
  }
  // The latest sale of one parcel, with a building, that the Auditor marked valid, at a home's price.
  const sales = new Map();
  for await (const row of xmlTable(zip, 'Parcel Transfer.xml', 'Parcel_Transfer', TRANSFER_COLUMNS)) {
    const [date, price] = [isoDate(row.Date_Conveyed), positive(row.Consideration)];
    if (!/^YES$/i.test(row.Valid_Sale) || /^(1|Y|YES)$/i.test(row.Land_Only) || (positive(row.Number_Of_Parcels) || 1) > 1 || !date || !isHomeSale(price)) continue;
    const held = sales.get(row.Parcel_Number);
    if (!held || held.date < date) sales.set(row.Parcel_Number, { date, price: Math.round(price) });
  }
  log(`${dwellings.size} parcels with a dwelling, ${values.size} with values, ${sales.size} with a valid sale`);
  const records = new Map();
  let noAddress = 0;
  let retired = 0;
  for (const row of parcels) {
    if (!ofYear(row)) continue;
    if (/^YES$/i.test(row.Retired)) { retired += 1; continue; }
    const record = fromParcel({ FIPS, COUNTY }, row, places.get(row.Parcel_Number), dwellings.get(row.Parcel_Number), values.get(row.Parcel_Number), sales.get(row.Parcel_Number));
    if (!record) noAddress += 1;
    else if (!records.has(record.id)) records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: tax year ${taxYear}, ${list.length} parcels, ${noAddress} without a street number, ${retired} retired`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'OH', name: COUNTY, publisher: PUBLISHER, dataset: 'public records extract', method: 'county', source: SOURCE, as_of: asOf, stale_after_days: 60, extra_zips: zipsByCounty(work, ['39']).get(FIPS) || [], records: list,
  };
}

const DICTIONARY = {
  // The columns read, with each one's description in the Auditor's File Layout.xlsx (inside each extract).
    columns: {
      Parcel_Number: 'The parcel number', Tax_Year: 'The tax year for the parcel', Acres: 'The deeded acres', Retired: "An indicator of a parcel's retired status", Subdivision: 'The subdivision of the parcel',
      School_District: 'The school district of the parcel', Principal: 'An indicator for the default location address', Number: 'The street number', PreDirection: 'The street pre-direction',
      Street: 'The street name', StreetSuffix: 'The street suffix', PostDirection: 'The street post-direction', Unit: 'The unit number', City: 'The city', ZipCode: 'The postal code',
      Card: 'The appaisal card of the dwelling', Type: 'The dwelling type', Story_Height: 'The total number of stories for the dwelling', Total_Rooms: 'The total number of rooms for the dwelling',
      Bed_Rooms: 'The number of bed rooms in the dwelling', Full_Baths: 'The number of full bath rooms in the dwelling', Half_Baths: 'The number of half bath rooms in the dwelling',
      Living_Area: 'The living area of the dwelling', Year_Built: 'The year the item was built', Land_Use_Code: 'The land use code of the value record', Land_Use: 'The land use of the value record',
      Appraised_Land_100: 'Land - 100% appraised value', Appraised_Improvement_100: 'Improvement - 100% appraised value', Date_Conveyed: 'The date of the transfer',
      Number_Of_Parcels: 'The number of parcels on the transfer', Consideration: 'The sales amount of the transfer', Valid_Sale: 'An indicator of the validity of the sale',
      Land_Only: 'Y/N indicates the transfer was for land only',
    },
    facts: {
      year_built: 'Year_Built', living_sqft: 'Living_Area', gross_sqft: 'Living_Area', rooms: 'Total_Rooms', bedrooms: 'Bed_Rooms', bathrooms: 'Full_Baths', full_baths: 'Full_Baths', half_baths: 'Half_Baths',
      stories: 'Story_Height', style: 'Type', lot_acres: 'Acres', value_year: 'Tax_Year', market_value: 'Appraised_Land_100', market_land_value: 'Appraised_Land_100', market_building_value: 'Appraised_Improvement_100',
      sale_price: 'Consideration', sale_date: 'Date_Conveyed', land_use: 'Land_Use', county_use_code: 'Land_Use_Code', subdivision: 'Subdivision', school_district: 'School_District',
    },
  };

/** A county's connector: { fips, county, file, source, publisher }. */
function issgCounty({ fips, county, file, source, publisher }) {
  const settings = { FIPS: fips, COUNTY: county, FILE: file, SOURCE: source, PUBLISHER: publisher };
  return { build: (options) => build(settings, options), dictionary: DICTIONARY };
}

module.exports = { issgCounty, xmlTable };
