'use strict';
// Montgomery County, Virginia: the county's open data tax parcels, shared by its Planning & GIS Services on behalf of the Commissioner of the
// Revenue, with owner names left out by the county. Its notice says the data is for reference only, isn't guaranteed and the county isn't
// responsible for its use; it states no license and no limit on use. Year built, living area, bedrooms, full and half baths, rooms, stories,
// acres, the current land and building values (Virginia assesses at full market value) and the last sale. The exemption class isn't asked for.
// Town lots have no acreage on file, so a lot with none takes its parcel's own area (all its shapes, measured in Virginia South state plane feet).
// The layer has no use code: a parcel with a home's facts is a home of no named type, a condominium where its legal description says so.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, layerRows, layerAreas, cached } = require('../lib/services.cjs');
const { year, isoDate, monthDate, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '51121';
const COUNTY = 'Montgomery County';
const LAYER = 'https://services5.arcgis.com/IZ8QFYP84iubFqmi/arcgis/rest/services/Parcels_Open_Data/FeatureServer/0';
const COLUMNS = ['PARCEL_ID', 'TAX_MAP_ID', 'SITE_ADD1', 'SITE_ADD2', 'ACRES', 'LEGAL1', 'SUBD_NAME', 'ZONING', 'NEIGHBORHD', 'LAND_VALUE', 'BLDG_VALUE', 'TOTAL_VALU', 'SALE_DATE', 'SALE_PRICE', 'STORIES', 'YEARBLT', 'ROOMS', 'BEDROOMS', 'FULLBATHS', 'HALFBATHS', 'SFLA', 'COMMYRBLT', 'JURISDICTI'];

const TOWNS = { BLACKSBURG: 'Town of Blacksburg', CHRISTIANSBURG: 'Town of Christiansburg' };

// Values and prices are written as money ("$250,000.00").
const money = (text) => positive(String(text ?? '').replace(/[$,\s]/g, ''));

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function useOf(row, unit) {
  const home = positive(row.BEDROOMS) || (positive(row.SFLA) && positive(row.FULLBATHS));
  const condo = /\bCONDO/i.test(`${row.LEGAL1 ?? ''} ${row.SUBD_NAME ?? ''}`);
  if (home) {
    if (unit) return ['unit', condo ? 'condo' : null];
    return ['property', condo ? 'townhouse' : null];
  }
  if (positive(row.COMMYRBLT)) return ['other', null];
  return ['parcel', null];
}

function siteOf(row) {
  const line = String(row.SITE_ADD1 ?? '').replace(/\s+/g, ' ').trim();
  const parsed = line ? parse(line) : null;
  if (!parsed || parsed.form !== 'street' || !parsed.number) return null;
  const { form, ...street } = parsed;
  return street;
}

function fromRow(row) {
  const address = siteOf(row);
  const parcel = word(row.PARCEL_ID);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row, address.unit);
  const facts = { parcel_number: word(row.TAX_MAP_ID) || parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(row.SITE_ADD1, ''));
  put(facts, 'subdivision', word(row.SUBD_NAME));
  put(facts, 'neighborhood', word(row.NEIGHBORHD));
  put(facts, 'zoning', word(row.ZONING));
  put(facts, 'legal_description', word(row.LEGAL1)?.slice(0, 300));
  put(facts, 'municipality', TOWNS[String(row.JURISDICTI || '').trim().toUpperCase()]);
  if (home) {
    put(facts, 'year_built', year(row.YEARBLT));
    put(facts, 'stories', inRange(row.STORIES, 5));
    put(facts, 'living_sqft', positive(row.SFLA));
    put(facts, 'bedrooms', inRange(row.BEDROOMS, 15));
    const [full, half] = [inRange(row.FULLBATHS, 12), inRange(row.HALFBATHS, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
    put(facts, 'rooms', inRange(row.ROOMS, 40));
  }
  // A condominium's parcel is its share of the complex (its shape, the unit's footprint), so a condominium home gets no lot.
  if (kind !== 'unit' && homeType !== 'townhouse') {
    if (positive(row.ACRES)) put(facts, 'lot_acres', positive(row.ACRES));
    else put(facts, 'lot_sqft', positive(row.area) >= 100 ? Math.round(positive(row.area)) : null);
  }
  put(facts, 'market_value', money(row.TOTAL_VALU));
  put(facts, 'market_land_value', money(row.LAND_VALUE));
  put(facts, 'market_building_value', money(row.BLDG_VALUE));
  const price = money(row.SALE_PRICE);
  if (isHomeSale(price)) {
    put(facts, 'sale_price', price);
    put(facts, 'sale_date', monthDate(row.SALE_DATE));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(row.SITE_ADD2 ?? '').replace(/\s+/g, ' ').trim().toUpperCase(), zip: null }, facts };
}

async function* build({ work }) {
  // The release is dated by the layer's last data edit: the county refreshes it a few times a year.
  const info = await getJson(`${LAYER}?f=json`, 'The layer\'s description');
  const asOf = isoDate(info.editingInfo?.dataLastEditDate || info.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The layer no longer says when it changed');
  const areas = new Map();
  for await (const shape of cached(path.join(work, 'va-montgomery', 'areas.jsonl.gz'), () => layerAreas(LAYER, '2284', { fields: ['PARCEL_ID'] }))) {
    areas.set(shape.PARCEL_ID, (areas.get(shape.PARCEL_ID) || 0) + shape.area);
  }
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  for await (const row of cached(path.join(work, 'va-montgomery', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    const record = fromRow({ ...row, area: areas.get(row.PARCEL_ID) });
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'VA', name: COUNTY, publisher: 'Montgomery County', dataset: 'open data tax parcels (Planning & GIS Services for the Commissioner of the Revenue)', method: 'county', source: 'va-montgomery', as_of: asOf, stale_after_days: 450, extra_zips: zipsByCounty(work, ['51']).get(FIPS) || [], records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YEARBLT', living_sqft: 'SFLA', bedrooms: 'BEDROOMS', bathrooms: 'FULLBATHS', full_baths: 'FULLBATHS', half_baths: 'HALFBATHS', rooms: 'ROOMS', stories: 'STORIES', lot_acres: 'ACRES', market_value: 'TOTAL_VALU', market_land_value: 'LAND_VALUE', market_building_value: 'BLDG_VALUE', sale_price: 'SALE_PRICE', sale_date: 'SALE_DATE' },
  },
};
