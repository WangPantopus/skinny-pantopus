'use strict';
// Sarasota County, Florida: the Property Appraiser's free parcel file on its Download Data page ("available to the public on our website free of
// charge"). Year built, living area, bedrooms, baths, units, pool, zoning, just value and the last sale. The state's roll has no bedrooms or baths.
// Owner, mailing, exemption and homestead columns are in the file and never read. Assessed and taxable values are left out: the distance from just
// value can say a home has a homestead exemption.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { download, zipDates, zipTable } = require('../lib/tables.cjs');
const { year, isoDate, zipCode, realUnit, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '12115';
const COUNTY = 'Sarasota County';
const FILE = 'https://www.sarasotapropertyappraiser.gov/downloads/SCPA_Parcels_Sales_CSV.zip';
const TABLE = 'Parcel_Sales_CSV/Sarasota.csv';
const COLUMNS = ['ACCOUNT', 'LOCN', 'LOCS', 'LOCD', 'UNIT', 'LOCCITY', 'LOCZIP', 'STCD', 'SUBD', 'ZONING_1', 'SALE_AMT', 'SALE_DATE', 'POOL', 'LIVING', 'BEDR', 'BATH', 'HALFBATH', 'LIVUNITS', 'YRBL', 'LSQFT', 'JUST', 'LEGAL1', 'LEGAL2'];

function useOf(code, hasUnit) {
  const c = String(code ?? '').trim();
  if (c === '0101' || c === '0102') return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (c.startsWith('01')) return hasUnit ? ['unit', 'condo'] : ['property', 'house'];
  if (c.startsWith('02')) return ['property', 'mobile_home'];
  if (c.startsWith('04') || c.startsWith('05')) return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (c.startsWith('08')) return ['building', 'multi_unit'];
  if (c.startsWith('03')) return ['building', 'apartment'];
  if (c.startsWith('00')) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const number = positive(value);
  return number && number <= most ? number : null;
};

function fromRow(row, uses, subdivisions) {
  const number = word(row.LOCN);
  const street = [number, word(row.LOCS), word(row.LOCD)].filter(Boolean).join(' ');
  const address = number && street ? parse(street, realUnit(row.UNIT)) : null;
  const parcel = word(row.ACCOUNT);
  if (!address || !parcel) return null;
  const code = String(row.STCD ?? '').trim();
  const [kind, homeType] = useOf(code, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(street, row.UNIT));
  put(facts, 'land_use', uses.get(code));
  put(facts, 'county_use_code', word(code));
  put(facts, 'subdivision', subdivisions.get(String(row.SUBD ?? '').trim()));
  put(facts, 'zoning', word(row.ZONING_1));
  put(facts, 'legal_description', [word(row.LEGAL1), word(row.LEGAL2)].filter(Boolean).join(' ').slice(0, 300) || null);
  if (home || kind === 'building') put(facts, 'year_built', year(row.YRBL));
  if (home) {
    put(facts, 'living_sqft', positive(row.LIVING));
    put(facts, 'bedrooms', inRange(row.BEDR, 15));
    const [full, half] = [inRange(row.BATH, 20), inRange(row.HALFBATH, 10)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
    if (/^(y|yes|1)$/i.test(String(row.POOL ?? '').trim())) facts.pool = 'Yes';
  } else if (kind === 'building') {
    put(facts, 'gross_sqft', positive(row.LIVING));
    put(facts, 'units', positive(row.LIVUNITS));
  }
  if (kind !== 'unit') put(facts, 'lot_sqft', positive(row.LSQFT));
  put(facts, 'market_value', positive(row.JUST));
  if (positive(row.SALE_AMT) > 100 && isoDate(row.SALE_DATE)) {
    facts.sale_price = positive(row.SALE_AMT);
    facts.sale_date = isoDate(row.SALE_DATE);
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.LOCCITY) || '').toUpperCase(), zip: zipCode(row.LOCZIP) }, facts };
}

async function* build({ work }) {
  const zip = path.join(work, 'fl-sarasota', 'SCPA_Parcels_Sales_CSV.zip');
  download(FILE, zip);
  const asOf = zipDates(zip).get(TABLE);
  if (!asOf) throw new Error('The file no longer says when it was made');
  const [uses, subdivisions] = [new Map(), new Map()];
  for await (const row of zipTable(zip, 'Parcel_Sales_CSV/LandUseCodes.csv', ['Code', 'Description'])) uses.set(row.Code, word(row.Description));
  for await (const row of zipTable(zip, 'Parcel_Sales_CSV/SubdivisionCodes.csv', ['Code', 'Description'])) subdivisions.set(row.Code, word(row.Description));
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of zipTable(zip, TABLE, COLUMNS)) {
    const record = fromRow(row, uses, subdivisions);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'FL', name: COUNTY, publisher: 'Sarasota County Property Appraiser', dataset: 'parcel file', method: 'county', source: 'fl-sarasota', as_of: asOf, stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    columns: COLUMNS,
    facts: { year_built: 'YRBL', living_sqft: 'LIVING', gross_sqft: 'LIVING', bedrooms: 'BEDR', full_baths: 'BATH', half_baths: 'HALFBATH', units: 'LIVUNITS', lot_sqft: 'LSQFT', market_value: 'JUST', sale_price: 'SALE_AMT', sale_date: 'SALE_DATE', zoning: 'ZONING_1', subdivision: 'SUBD', land_use: 'STCD', legal_description: 'LEGAL1' },
  },
};
