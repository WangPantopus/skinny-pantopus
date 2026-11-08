'use strict';
// Mesa County, Colorado: the county's tax parcels with each account's Assessor facts, on its GIS open data service. The county says it distributes
// its GIS data "as a service to the public" to promote sharing among governments and private GIS users, and asks non-commercial users to share
// back data they make; it states no limit on use. Year built, heated area, bedrooms, baths, rooms, style, acres, actual (market) values and the
// last qualified sale. Owner, mailing, grantor and grantee columns are never asked for.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { streetParts, year, isoDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '08077';
const COUNTY = 'Mesa County';
const LAYER = 'https://mcgis.mesacounty.us/arcgis/rest/services/maps/Open_Data/FeatureServer/55';
const COLUMNS = ['ACCOUNTNO', 'PARCELNUM', 'LOCATION', 'SITUS_CITY', 'SITUS_ZIP', 'LEGAL', 'STRNUMBER', 'STRDIR', 'STRNAME', 'STRMODE', 'STRUNIT', 'NBHD', 'SPRICE', 'SDATE', 'SQUAL', 'PROPTYPE', 'ARCH1ST', 'AYB1ST', 'EFFYRBLT1ST', 'TOTHTSQF', 'RMS1ST', 'BDRMS1ST', 'BTHS1ST', 'TOTNOUNITS', 'TOTNOBLDGS', 'BLDGUSE', 'LNDVALCUR', 'IMPVALCUR', 'TOTVALCUR', 'ZONING', 'Acres'];

// The Assessor's building use codes: 1212 a one-family home (a townhouse where the property type says so), 4277 and 1277 a farm or ranch
// residence, 1235 a manufactured home, 1230 a condominium unit, 1215 a duplex or triplex, 1220 and 1225 apartments of 4-8 and 9 or more units.
function useOf(code, propertyType, unit) {
  const c = String(code || '').trim();
  if (c === '1212' || c === '4277' || c === '1277') {
    if (unit) return ['unit', 'condo'];
    return /^townhouse$/i.test(String(propertyType || '').trim()) ? ['property', 'townhouse'] : ['property', 'house'];
  }
  if (c === '1235') return ['property', 'mobile_home'];
  if (c === '1230') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (c === '1215') return ['building', 'multi_unit'];
  if (c === '1220' || c === '1225') return ['building', 'apartment'];
  if (!c && /^(residential|agricultural)$/i.test(String(propertyType || '').trim())) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

// Baths are counted in quarters, written to one decimal: 1.7 is one and three quarters, 2.2 two and a quarter.
function bathsOf(value) {
  const count = positive(value);
  if (!count || count > 12) return null;
  const whole = Math.floor(count + 1e-9);
  const tenth = Math.round((count - whole) * 10);
  const part = { 0: 0, 2: 0.25, 3: 0.25, 5: 0.5, 7: 0.75, 8: 0.75 }[tenth];
  return part === undefined ? null : whole + part;
}

function fromRow(row) {
  const unit = word(row.STRUNIT) || '';
  const address = Number(row.STRNUMBER) > 0 ? streetParts({ number: String(row.STRNUMBER), pre: word(row.STRDIR) || '', name: word(row.STRNAME) || '', suffix: word(row.STRMODE) || '', unit }) : null;
  const parcel = word(row.ACCOUNTNO);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.BLDGUSE, row.PROPTYPE, address.unit);
  const facts = { parcel_number: word(row.PARCELNUM) || parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(row.LOCATION, unit));
  put(facts, 'county_use_code', word(row.BLDGUSE));
  put(facts, 'property_class', word(row.PROPTYPE));
  put(facts, 'neighborhood', word(row.NBHD));
  put(facts, 'zoning', word(row.ZONING));
  put(facts, 'legal_description', word(row.LEGAL)?.slice(0, 300));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.AYB1ST));
    put(facts, 'effective_year_built', year(row.EFFYRBLT1ST));
    put(facts, 'style', word(row.ARCH1ST));
    if (positive(row.TOTNOBLDGS) > 1) facts.buildings_on_parcel = positive(row.TOTNOBLDGS);
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.TOTHTSQF));
    put(facts, 'bedrooms', inRange(row.BDRMS1ST, 15));
    put(facts, 'bathrooms', bathsOf(row.BTHS1ST));
    put(facts, 'rooms', inRange(row.RMS1ST, 40));
  }
  if (kind === 'building') put(facts, 'units', inRange(row.TOTNOUNITS, 2000));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.Acres));
  put(facts, 'market_value', positive(row.TOTVALCUR));
  put(facts, 'market_land_value', positive(row.LNDVALCUR));
  put(facts, 'market_building_value', positive(row.IMPVALCUR));
  // Sale qualification codes starting with Q mark a sale the Assessor qualified (an arm's-length transfer); U, unqualified.
  if (/^Q/.test(String(row.SQUAL || '').trim()) && isHomeSale(positive(row.SPRICE))) {
    put(facts, 'sale_price', positive(row.SPRICE));
    put(facts, 'sale_date', isoDate(row.SDATE));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: word(row.SITUS_CITY) || '', zip: zipCode(row.SITUS_ZIP) }, facts };
}

async function* build({ work, today }) {
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  for await (const row of cached(path.join(work, 'co-mesa', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} accounts, ${noAddress} without a street number, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'CO', name: COUNTY, publisher: 'Mesa County Assessor', dataset: 'tax parcels', method: 'county', source: 'co-mesa', as_of: isoDate(today.getTime()), stale_after_days: 450, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'AYB1ST', effective_year_built: 'EFFYRBLT1ST', living_sqft: 'TOTHTSQF', bedrooms: 'BDRMS1ST', bathrooms: 'BTHS1ST', rooms: 'RMS1ST', units: 'TOTNOUNITS', lot_acres: 'Acres', market_value: 'TOTVALCUR', market_land_value: 'LNDVALCUR', market_building_value: 'IMPVALCUR', sale_price: 'SPRICE', sale_date: 'SDATE' },
  },
};
