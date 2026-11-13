'use strict';
// Sampson County, North Carolina: the county's parcels with each parcel's tax record, on the county's own ArcGIS Online, credited to Sampson County
// GIS and Tax Administration. Its notice says the data is provided without warranty and isn't a determination of location, ownership or market
// value, and that using it accepts those terms; it states no license and no limit on use. Year built, living area, bedrooms, full and half baths,
// rooms, stories, style, acres, the assessed value and the last recorded sale. The current owner and mailing columns are never asked for. The
// appraised column lists each building's value, not the parcel's, so it isn't read; the assessed value is the parcel's total. Parcels carry no
// site city or ZIP, so the county's ZIPs come from the Census.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { hold } = require('../lib/held.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '37163';
const COUNTY = 'Sampson County';
const LAYER = 'https://services3.arcgis.com/fM4kjZmPOS4ay2Ff/arcgis/rest/services/Parcels/FeatureServer/0';
const COLUMNS = ['PIN', 'CALC_ACRES', 'ACREAGE', 'SALE_PRICE', 'DATE_RECOR', 'PARCEL_ADD', 'USE_DESC', 'ASSESSED_V', 'PARCEL_CLA', 'STYLE', 'CONSTRUCTI', 'STORY_HEIG', 'LIVING_ARE', 'YEAR_BUILT', 'HEAT', 'ROOF', 'FOUNDATION', 'TOTAL_ROOM', 'BEDROOMS', 'FULL_BATH', 'HALF_BATH', 'SYSTEM'];

// The use column lists the parcel's buildings, the main one first ("RANCH|STORAGE"). A parcel with living area is a home: a mobile home where the
// main building is one ("DOUBLE WIDE MOHO", "MOBILE HOME"), a house otherwise.
function useOf(row, unit) {
  const main = String(row.USE_DESC || '').split('|')[0].trim().toUpperCase();
  const cls = String(row.PARCEL_CLA || '').trim().toUpperCase();
  if (/^(COMMERCIAL|INDUSTRIAL|EXEMPT)$/.test(cls)) return ['other', null];
  if (positive(row.LIVING_ARE)) {
    if (/MOHO|MOBILE HOME$|SINGLE WIDE|DOUBLE WIDE/.test(main)) return ['property', 'mobile_home'];
    return unit ? ['unit', 'condo'] : ['property', 'house'];
  }
  if (/^(RESIDENTIAL|AGRICULTURE)$/.test(cls)) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function siteOf(row) {
  const line = String(row.PARCEL_ADD ?? '').replace(/\s+/g, ' ').trim();
  const parsed = line ? parse(line) : null;
  if (!parsed || parsed.form !== 'street' || !parsed.number) return null;
  const { form, ...street } = parsed;
  return street;
}

function fromRow(row) {
  const address = siteOf(row);
  const parcel = word(row.PIN);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(row.PARCEL_ADD, ''));
  put(facts, 'property_class', word(row.PARCEL_CLA));
  if (home) {
    put(facts, 'year_built', year(row.YEAR_BUILT));
    put(facts, 'living_sqft', positive(row.LIVING_ARE));
    put(facts, 'bedrooms', inRange(row.BEDROOMS, 15));
    const [full, half] = [inRange(row.FULL_BATH, 12), inRange(row.HALF_BATH, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
    put(facts, 'rooms', inRange(row.TOTAL_ROOM, 40));
    put(facts, 'stories', inRange(row.STORY_HEIG, 5));
    put(facts, 'style', word(row.STYLE));
    put(facts, 'heating', word(row.HEAT));
    put(facts, 'roof_cover', word(row.ROOF));
    put(facts, 'foundation', word(row.FOUNDATION));
    put(facts, 'exterior_walls', word(row.CONSTRUCTI));
  }
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.ACREAGE) || positive(row.CALC_ACRES));
  put(facts, 'assessed_value', positive(row.ASSESSED_V));
  const saleDate = isoDate(row.DATE_RECOR);
  if (saleDate && isHomeSale(positive(row.SALE_PRICE))) {
    put(facts, 'sale_price', positive(row.SALE_PRICE));
    put(facts, 'sale_date', saleDate);
  }
  const record = { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: '', zip: null }, facts };
  // Read since the county went live, held off its screens until its new_columns switch is on (lib/held.cjs): the
  // county's own words for the home's system, "HEAT AND A/C", "A/C ONLY", "HEAT ONLY" or "NONE", say whether it's cooled.
  const system = String(row.SYSTEM ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
  if (home && /A\/C/.test(system)) hold(record, 'cooling', 'Air conditioning');
  else if (home && ['HEAT ONLY', 'NONE'].includes(system)) hold(record, 'cooling', 'None');
  return record;
}

async function* build({ work, today }) {
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  for await (const row of cached(path.join(work, 'nc-sampson', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS, { oid: 'FID' }))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'NC', name: COUNTY, publisher: 'Sampson County', dataset: 'parcels with tax records (GIS and Tax Administration)', method: 'county', source: 'nc-sampson', as_of: isoDate(today.getTime()), stale_after_days: 450, extra_zips: zipsByCounty(work, ['37']).get(FIPS) || [], records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YEAR_BUILT', living_sqft: 'LIVING_ARE', bedrooms: 'BEDROOMS', bathrooms: 'FULL_BATH', full_baths: 'FULL_BATH', half_baths: 'HALF_BATH', rooms: 'TOTAL_ROOM', stories: 'STORY_HEIG', lot_acres: 'ACREAGE', assessed_value: 'ASSESSED_V', sale_price: 'SALE_PRICE', sale_date: 'DATE_RECOR' },
  },
};
