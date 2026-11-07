'use strict';
// Franklin County, Ohio: the County Auditor's tax parcel layer. Its notice is a disclaimer: check the Auditor's office for the record, no
// legal responsibility taken. Owner, mailing, owner-occupied, homestead and rental columns are in the layer and never asked for. Ohio
// appraises at full value and taxes 35% of it, so TOTVALUEBASE is the Auditor's market value.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '39049';
const COUNTY = 'Franklin County';
const LAYER = 'https://gis.franklincountyohio.gov/hosting/rest/services/ParcelFeatures/Parcel_Features/MapServer/0';
const COLUMNS = ['PARCELID', 'BUILDING', 'UNIT', 'ACRES', 'CVTTXDSCRP', 'SCHLDSCRP', 'NBHDCD', 'CLASSCD', 'CLASSDSCRP', 'SITEADDRESS', 'ZIPCD', 'PRPRTYDSCRP', 'SALEDATE', 'SALEPRICE', 'RESFLRAREA_AG', 'RESYRBLT', 'BATHS', 'HBATHS', 'BEDRMS', 'LNDVALUEBASE', 'BLDVALUEBASE', 'TOTVALUEBASE'];

function useOf(code, unit) {
  const n = Number(code);
  if (n === 510 || n === 511 || n === 512 || n === 513 || n === 591) return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (n === 550 || n === 551 || n === 552 || n === 553 || n === 554) return ['unit', 'condo'];
  if (n === 520 || n === 530 || n === 592) return ['building', 'multi_unit'];
  if (n === 401 || n === 402 || n === 403 || n === 404) return ['building', 'apartment'];
  if (n === 500 || n === 501 || n === 502 || n === 400) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function fromRow(row) {
  const line = word(row.SITEADDRESS);
  const address = line ? parse(line, realUnit(word(row.UNIT))) : null;
  const parcel = word(row.PARCELID);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.CLASSCD, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', line);
  put(facts, 'municipality', word(row.CVTTXDSCRP));
  put(facts, 'school_district', word(row.SCHLDSCRP));
  put(facts, 'neighborhood', word(row.NBHDCD));
  put(facts, 'land_use', word(row.CLASSDSCRP));
  put(facts, 'county_use_code', word(row.CLASSCD));
  put(facts, 'legal_description', word(row.PRPRTYDSCRP)?.slice(0, 300));
  if (home || kind === 'building') put(facts, 'year_built', year(row.RESYRBLT));
  if (home) {
    put(facts, 'living_sqft', positive(row.RESFLRAREA_AG));
    put(facts, 'bedrooms', inRange(row.BEDRMS, 15));
    const [full, half] = [inRange(row.BATHS, 15), inRange(row.HBATHS, 10)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
  }
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.ACRES));
  put(facts, 'market_value', positive(row.TOTVALUEBASE));
  put(facts, 'market_land_value', positive(row.LNDVALUEBASE));
  put(facts, 'market_building_value', positive(row.BLDVALUEBASE));
  if (positive(row.SALEPRICE) > 100) {
    facts.sale_price = positive(row.SALEPRICE);
    put(facts, 'sale_date', isoDate(row.SALEDATE));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: '', zip: zipCode(row.ZIPCD) }, facts };
}

async function* build({ work, today }) {
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'oh-franklin', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS, { pageSize: 2000 }))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'OH', name: COUNTY, publisher: 'Franklin County Auditor', dataset: 'tax parcels', method: 'county', source: 'oh-franklin', as_of: isoDate(today.getTime()), stale_after_days: 400, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'RESYRBLT', living_sqft: 'RESFLRAREA_AG', bedrooms: 'BEDRMS', full_baths: 'BATHS', half_baths: 'HBATHS', lot_acres: 'ACRES', market_value: 'TOTVALUEBASE', market_land_value: 'LNDVALUEBASE', market_building_value: 'BLDVALUEBASE', sale_price: 'SALEPRICE', sale_date: 'SALEDATE' },
  },
};
