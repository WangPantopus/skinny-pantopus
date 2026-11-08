'use strict';
// Clark County, Nevada: the Clark County Assessor's tables as the City of Las Vegas republishes them on its own ArcGIS Online, credited to the
// Clark County Assessor's Office, Clark County GISMO and the City of Las Vegas. The city's notice says it makes no warranty or guarantee about the
// data or its sources and isn't responsible for decisions made with it; it states no license and no limit on use. The roll extract gives each
// parcel's site address, land use, land acres, values and last sale; the residential table gives each home's year built, rooms, bedrooms, baths,
// floor areas and garage. Its wall, roof, heating, cooling and quality columns are bare numbers with no published words, so they aren't read.
// Owner, mailing, exemption and grantor/grantee columns are never asked for. Records carry no site ZIP, so the county's ZIPs come from the Census.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { streetParts, year, isoDate, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '32003';
const COUNTY = 'Clark County';
const BASE = 'https://services1.arcgis.com/F1v0ufATbBQScMtY/arcgis/rest/services';
const EXTRACT = `${BASE}/AOExtract_New/FeatureServer/10`;
const RESIDENTIAL = `${BASE}/AORES/FeatureServer/0`;
const EXTRACT_COLUMNS = ['PARCEL', 'LOC_STRNO', 'LOC_STRFRAC', 'LOC_STRDIR', 'LOC_STRNAME', 'LOC_STRTYPE', 'LOC_STRUNIT', 'LOC_CITY', 'LANDUSE', 'CAPACITY', 'CONSTYR', 'SALEPRICE', 'SALEDATE', 'LANDACRES', 'FISCALYEAR', 'LANDVAL', 'IMPVAL', 'TOTVAL', 'NBRHOOD'];
const RESIDENTIAL_COLUMNS = ['PARCEL', 'SUFFIX', 'YRBUILT', 'TYPE', 'ROOMS', 'BEDROOMS', 'BATH', 'FIREPLACE', 'GARSQFT', 'FLR1SQFT', 'FLR2SQFT', 'BASESQFT', 'TOTSQFT'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

// The residential table says whether a home is a house ("RES") or a condominium ("COND"); a parcel without a residential row is land or not a home.
function useOf(building, unit) {
  const type = String(building?.TYPE || '').trim().toUpperCase();
  if (type === 'RES') return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (type === 'COND') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  return [building ? 'other' : 'parcel', null];
}

function fromRow(row, building, latest) {
  const number = String(row.LOC_STRNO ?? '').trim();
  const unit = word(row.LOC_STRUNIT) || '';
  const fraction = /^\d\/\d$/.test(String(row.LOC_STRFRAC ?? '').trim()) ? String(row.LOC_STRFRAC).trim() : '';
  const address = /^\d+[A-Z]?$/i.test(number) && word(row.LOC_STRNAME) ? streetParts({ number, numberSuffix: fraction, pre: word(row.LOC_STRDIR) || '', name: word(row.LOC_STRNAME) || '', suffix: word(row.LOC_STRTYPE) || '', unit }) : null;
  const parcel = word(row.PARCEL);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(building, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([number, fraction, row.LOC_STRDIR, row.LOC_STRNAME, row.LOC_STRTYPE].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'county_use_code', word(row.LANDUSE));
  put(facts, 'neighborhood', word(row.NBRHOOD));
  if (home) {
    put(facts, 'year_built', year(building.YRBUILT) || year(row.CONSTYR));
    put(facts, 'living_sqft', positive(building.TOTSQFT));
    put(facts, 'ground_floor_sqft', positive(building.FLR1SQFT));
    put(facts, 'basement_sqft', positive(building.BASESQFT));
    put(facts, 'garage_sqft', positive(building.GARSQFT));
    put(facts, 'bedrooms', inRange(building.BEDROOMS, 15));
    // BATH holds the full baths, and the half baths after the point: 2.01 is two full baths and a half bath.
    const bath = Number(building.BATH);
    if (Number.isFinite(bath) && bath > 0) {
      const whole = Math.floor(bath + 1e-6);
      const [full, half] = [inRange(whole, 12), inRange(Math.round((bath - whole) * 100), 6)];
      put(facts, 'full_baths', full);
      put(facts, 'half_baths', half);
      if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
    }
    put(facts, 'rooms', inRange(building.ROOMS, 40));
    put(facts, 'fireplaces', inRange(building.FIREPLACE, 10));
  }
  // A condominium's parcel is its share of the complex, so a condominium home gets no lot.
  if (kind !== 'unit' && homeType !== 'townhouse') put(facts, 'lot_acres', positive(row.LANDACRES));
  // Nevada's assessed values (35% of taxable value), land and improvements, for the fiscal year; exemptions aren't read.
  put(facts, 'assessed_land_value', positive(row.LANDVAL));
  put(facts, 'assessed_building_value', positive(row.IMPVAL));
  put(facts, 'assessed_value', positive(row.TOTVAL));
  put(facts, 'value_year', positive(row.FISCALYEAR));
  // The roll keeps a sale's year and month only ("202405"), so a sale gets its month and never a made-up day.
  const sold = /^(\d{4})(\d{2})$/.exec(String(row.SALEDATE ?? '').trim());
  if (sold && sold[1] >= '1900' && sold[2] >= '01' && sold[2] <= '12' && `${sold[1]}-${sold[2]}` <= latest && isHomeSale(positive(row.SALEPRICE))) {
    put(facts, 'sale_price', positive(row.SALEPRICE));
    put(facts, 'sale_month', `${MONTHS[Number(sold[2]) - 1]} ${sold[1]}`);
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(row.LOC_CITY ?? '').replace(/\s+/g, ' ').trim().toUpperCase(), zip: null }, facts };
}

async function* build({ work, today }) {
  const dir = path.join(work, 'nv-clark');
  // One residential row per parcel and building; the first building (lowest suffix) speaks for the home.
  const buildings = new Map();
  for await (const row of cached(path.join(dir, 'residential.jsonl.gz'), () => layerRows(RESIDENTIAL, RESIDENTIAL_COLUMNS, { oid: 'ObjectId', pageSize: 1000 }))) {
    const parcel = word(row.PARCEL);
    if (!parcel) continue;
    const held = buildings.get(parcel);
    if (!held || Number(row.SUFFIX) < Number(held.SUFFIX)) buildings.set(parcel, row);
  }
  const latest = isoDate(today.getTime()).slice(0, 7);
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  for await (const row of cached(path.join(dir, 'extract.jsonl.gz'), () => layerRows(EXTRACT, EXTRACT_COLUMNS, { pageSize: 2000 }))) {
    const record = fromRow(row, buildings.get(word(row.PARCEL)), latest);
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number, ${repeated} repeated, ${buildings.size} residential parcels`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  // The Assessor's Office is the data's origin and the city publishes this copy: "From the City of Las Vegas's copy of the Clark County Assessor's records".
  yield {
    fips: FIPS, state: 'NV', name: COUNTY, publisher: 'the City of Las Vegas\'s copy of the Clark County Assessor', dataset: 'roll extract and residential table', method: 'county', source: 'nv-clark', as_of: isoDate(today.getTime()), stale_after_days: 450, extra_zips: zipsByCounty(work, ['32']).get(FIPS) || [], records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: [EXTRACT, RESIDENTIAL],
    facts: { year_built: 'YRBUILT', living_sqft: 'TOTSQFT', ground_floor_sqft: 'FLR1SQFT', basement_sqft: 'BASESQFT', garage_sqft: 'GARSQFT', bedrooms: 'BEDROOMS', bathrooms: 'BATH', full_baths: 'BATH', half_baths: 'BATH', rooms: 'ROOMS', fireplaces: 'FIREPLACE', lot_acres: 'LANDACRES', assessed_land_value: 'LANDVAL', assessed_building_value: 'IMPVAL', assessed_value: 'TOTVAL', value_year: 'FISCALYEAR', sale_price: 'SALEPRICE', sale_month: 'SALEDATE' },
  },
};
