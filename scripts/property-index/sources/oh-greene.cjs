'use strict';
// Greene County, Ohio: the Auditor's parcel data on the county's GIS open data service, kept daily, one point per parcel with every field of the
// Auditor's CAMA system. Its disclaimer says the data locates, identifies and inventories parcels for appraisal and taxing and isn't a legal
// description, that accuracy isn't guaranteed and the county isn't liable for damages; it states no license and no limit on use. Year built,
// living area, bedrooms, baths, rooms, stories, style, heating, condition, acres, appraised and assessed values, and the last valid sale. Owner,
// taxpayer, mailing and tax-due columns are never asked for. Most lots carry no acreage, so a lot takes its parcel's own area.

const path = require('node:path');
const { layerRows, layerAreas, cached } = require('../lib/services.cjs');
const { streetParts, year, isoDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '39057';
const COUNTY = 'Greene County';
const SERVICE = 'https://gis.greenecountyohio.gov/webgis2/rest/services/OpenData/OpenData/MapServer';
const POINTS = `${SERVICE}/0`;
const SHAPES = `${SERVICE}/1`;
const COLUMNS = ['Parcel_Id', 'Parcel_Number', 'Tax_Year', 'Address_Number', 'Address_PreDirection', 'Address_Street', 'Address_StreetSuffix', 'Address_PostDirection', 'Address_Unit', 'Address_City', 'Address_ZipCode', 'Subdivision', 'Sale_Date', 'Sale_Price', 'Valid_Sale', 'Legal_Description', 'School_District', 'Acres', 'Year_Built', 'Card', 'Style', 'Stories', 'Finished_Basement_Area', 'Bed_Rooms', 'Full_Baths', 'Half_Baths', 'Total_Rooms', 'Living_Area', 'Fireplaces', 'Heat_Type', 'Heat_Source', 'Condition', 'Land_Use_Code', 'Land_Use', 'Neighborhood', 'Appraised_Land', 'Appraised_Buildings', 'Appraised_Total', 'Assessed_Total'];

// Ohio's land use codes: 510-515 a one-family dwelling (by lot size), 550 a condominium unit (each with its own street number here), 560 a mobile
// home, 520 and 530 two and three families, 401-403 apartments, 500-505 residential vacant land.
function useOf(code, unit) {
  const c = String(code || '').trim();
  if (/^51[0-5]$/.test(c)) return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (c === '550') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (c === '560') return ['property', 'mobile_home'];
  if (c === '520' || c === '530') return ['building', 'multi_unit'];
  if (/^40[1-3]$/.test(c)) return ['building', 'apartment'];
  if (/^50[0-5]$/.test(c)) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};
const text = (value) => (/^none$/i.test(String(value ?? '').trim()) ? null : word(value));

// Styles are words ("RANCH", "CAPE COD"); "ROW" is a row house, and a letter with a dash is no style at all.
function styleOf(value) {
  const style = word(value);
  if (!style || /^[A-Z]-?$/i.test(style)) return null;
  return /^ROW$/i.test(style) ? 'Row house' : style;
}

// House numbers written two ways: "123 125" names a range (the first is kept, as people's mail does) and "123 1/2" a half number.
function numberOf(value) {
  const parts = String(value ?? '').trim().toUpperCase().split(/\s+/);
  if (!/^\d+[A-Z]?$/.test(parts[0] || '')) return { number: parts.join(' '), numberSuffix: '' };
  return { number: parts[0], numberSuffix: /^\d\/\d$/.test(parts[1] || '') ? parts[1] : '' };
}

function fromRow(row) {
  const unit = word(row.Address_Unit) || '';
  const address = streetParts({ ...numberOf(row.Address_Number), pre: word(row.Address_PreDirection) || '', name: word(row.Address_Street) || '', suffix: word(row.Address_StreetSuffix) || '', post: word(row.Address_PostDirection) || '', unit });
  const parcel = word(row.Parcel_Id);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.Land_Use_Code, address.unit);
  const facts = { parcel_number: word(row.Parcel_Number) || parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([row.Address_Number, row.Address_PreDirection, row.Address_Street, row.Address_StreetSuffix, row.Address_PostDirection].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'county_use_code', word(row.Land_Use_Code));
  put(facts, 'land_use', word(row.Land_Use));
  put(facts, 'neighborhood', word(row.Neighborhood));
  put(facts, 'subdivision', word(row.Subdivision));
  put(facts, 'school_district', word(row.School_District));
  put(facts, 'legal_description', word(row.Legal_Description)?.slice(0, 300));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.Year_Built));
    put(facts, 'stories', inRange(row.Stories, 5));
    put(facts, 'style', styleOf(row.Style));
    put(facts, 'condition', word(row.Condition));
    if (positive(row.Card) > 1) facts.buildings_on_parcel = positive(row.Card);
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.Living_Area));
    put(facts, 'bedrooms', inRange(row.Bed_Rooms, 15));
    const [full, half] = [inRange(row.Full_Baths, 12), inRange(row.Half_Baths, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
    put(facts, 'rooms', inRange(row.Total_Rooms, 40));
    put(facts, 'basement_finished_sqft', positive(row.Finished_Basement_Area));
    put(facts, 'fireplaces', inRange(row.Fireplaces, 10));
    // The heat type column names central air conditioning as a kind of heat: that's cooling, and the heat itself goes unsaid.
    const heat = text(row.Heat_Type);
    if (heat && /AIR CONDITION/i.test(heat)) put(facts, 'cooling', 'Central');
    else put(facts, 'heating', heat);
    put(facts, 'heating_fuel', text(row.Heat_Source));
  }
  // A condominium's parcel is its share of the complex, so a condo unit gets no lot.
  if (kind !== 'unit' && String(row.Land_Use_Code || '').trim() !== '550') {
    if (positive(row.Acres)) put(facts, 'lot_acres', positive(row.Acres));
    else put(facts, 'lot_sqft', positive(row.area) >= 100 ? positive(row.area) : null);
  }
  put(facts, 'market_value', positive(row.Appraised_Total));
  put(facts, 'market_land_value', positive(row.Appraised_Land));
  put(facts, 'market_building_value', positive(row.Appraised_Buildings));
  put(facts, 'assessed_value', positive(row.Assessed_Total));
  put(facts, 'value_year', positive(row.Tax_Year));
  if (Number(row.Valid_Sale) === 1 && isHomeSale(positive(row.Sale_Price))) {
    put(facts, 'sale_price', positive(row.Sale_Price));
    put(facts, 'sale_date', isoDate(row.Sale_Date));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: word(row.Address_City) || '', zip: zipCode(row.Address_ZipCode) }, facts };
}

async function* build({ work, today }) {
  // Areas in Ohio South state plane (US feet), from the parcel shapes, which carry the same parcel id as the points.
  const areas = new Map();
  for await (const row of cached(path.join(work, 'oh-greene', 'areas.jsonl.gz'), () => layerAreas(SHAPES, '3735', { fields: ['Parcel_Id'] }))) {
    const key = word(row.Parcel_Id);
    if (key) areas.set(key, (areas.get(key) || 0) + row.area);
  }
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  for await (const row of cached(path.join(work, 'oh-greene', 'parcels.jsonl.gz'), () => layerRows(POINTS, COLUMNS))) {
    const record = fromRow({ ...row, area: areas.get(word(row.Parcel_Id)) });
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'OH', name: COUNTY, publisher: 'Greene County Auditor', dataset: 'parcel points with CAMA data', method: 'county', source: 'oh-greene', as_of: isoDate(today.getTime()), stale_after_days: 450, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: POINTS,
    facts: { year_built: 'Year_Built', living_sqft: 'Living_Area', bedrooms: 'Bed_Rooms', bathrooms: 'Full_Baths', full_baths: 'Full_Baths', half_baths: 'Half_Baths', rooms: 'Total_Rooms', stories: 'Stories', basement_finished_sqft: 'Finished_Basement_Area', fireplaces: 'Fireplaces', lot_acres: 'Acres', market_value: 'Appraised_Total', market_land_value: 'Appraised_Land', market_building_value: 'Appraised_Buildings', assessed_value: 'Assessed_Total', value_year: 'Tax_Year', sale_price: 'Sale_Price', sale_date: 'Sale_Date' },
  },
};
