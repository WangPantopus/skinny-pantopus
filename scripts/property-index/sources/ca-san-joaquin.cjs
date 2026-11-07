'use strict';
// San Joaquin County, California: the county's public parcel layer, from its Assessor. No terms or license are stated on the item.
// The layer has mailing columns, an exemption code and care-of columns: never asked for. Values are Proposition 13 assessed values,
// never market values. No sale prices.

const path = require('node:path');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '06077';
const COUNTY = 'San Joaquin County';
const LAYER = 'https://services2.arcgis.com/GQhSReJEO6f7tsvy/arcgis/rest/services/Parcels/FeatureServer/0';
const COLUMNS = ['APN', 'TRA', 'VALUE_ROLL_YEAR', 'LAND_VALUE', 'STRUCTURE_VALUE', 'LANDSIZE_SQFT', 'LANDSIZE_ACRES', 'YEAR_BUILT', 'STORIES', 'BEDROOMS', 'BATHROOM_WHOLE', 'BATHROOM_HALF', 'FIREPLACE', 'TOTALLIV_AREA', 'POOL_SPA', 'GARAGE', 'USECODE', 'NUMBER_UNITS', 'SITUSNUMBER', 'SITUSDIRECTION', 'SITUSTREET', 'SITUSTYPE', 'SITUSCITY', 'SITUSZIP', 'SITUSUNIT', 'FULL_ADDRESS', 'DESCRIPTION', 'CATEGORY'];

function useOf(words, unit, built) {
  const use = String(words || '').toUpperCase();
  if (/^VAC|COMMON AREA/.test(use)) return ['parcel', null];
  if (/^CONDOMINIUM/.test(use)) return ['unit', 'condo'];
  if (/COMMON WAL/.test(use)) return ['property', 'townhouse'];
  if (/DUPLEX|TRIPLEX|FOURPLEX|TWO SFDS|2 OR MORE RESI|MULTIPLE/.test(use)) return ['building', 'multi_unit'];
  if (/APARTMENT|\d+ ?UNITS/.test(use)) return ['building', 'apartment'];
  if (/MOBILE|MANUFACTURED/.test(use)) return ['property', 'mobile_home'];
  if (/PLANNED UNIT/.test(use)) return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (/SINGLE FAMILY|^SFD|RURAL RES|W\/RESID/.test(use)) return built || !/RURAL RES - VAC/.test(use) ? ['property', 'house'] : ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function fromRow(row) {
  const unit = realUnit(word(row.SITUSUNIT));
  const address = streetParts({ number: row.SITUSNUMBER, pre: word(row.SITUSDIRECTION) || '', name: word(row.SITUSTREET) || '', suffix: word(row.SITUSTYPE) || '', unit });
  const parcel = word(row.APN);
  if (!address || !parcel) return null;
  const living = positive(row.TOTALLIV_AREA);
  const [kind, homeType] = useOf(row.DESCRIPTION, address.unit, Boolean(living));
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  const zip = word(row.SITUSZIP) || /(\d{5})\s*$/.exec(row.FULL_ADDRESS || '')?.[1] || '';
  put(facts, 'address_on_record', onRecord([row.SITUSNUMBER, row.SITUSDIRECTION, row.SITUSTREET, row.SITUSTYPE].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'tax_code_area', word(row.TRA));
  put(facts, 'land_use', word(row.DESCRIPTION));
  put(facts, 'property_class', word(row.CATEGORY));
  put(facts, 'county_use_code', word(row.USECODE));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.YEAR_BUILT));
    put(facts, 'stories', inRange(row.STORIES, kind === 'building' ? 40 : 6));
  }
  if (home) {
    put(facts, 'living_sqft', living);
    put(facts, 'bedrooms', inRange(row.BEDROOMS, 15));
    const [full, half] = [inRange(row.BATHROOM_WHOLE, 15), inRange(row.BATHROOM_HALF, 10)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
    put(facts, 'fireplaces', inRange(row.FIREPLACE, 20));
    if (/^(GP|PS|GPS)$/.test(word(row.POOL_SPA) || '')) facts.pool = 'Yes';
    const cars = /^(\d)G$/.exec(word(row.GARAGE) || '');
    if (cars && Number(cars[1]) > 0) {
      facts.garage = `${cars[1]} ${cars[1] === '1' ? 'car' : 'cars'}`;
      facts.parking_spaces = Number(cars[1]);
    }
  }
  if (kind === 'building') put(facts, 'units', positive(row.NUMBER_UNITS));
  if (kind !== 'unit') {
    if (positive(row.LANDSIZE_SQFT)) facts.lot_sqft = positive(row.LANDSIZE_SQFT);
    else put(facts, 'lot_acres', positive(row.LANDSIZE_ACRES));
  }
  const [land, building] = [positive(row.LAND_VALUE), positive(row.STRUCTURE_VALUE)];
  put(facts, 'value_year', positive(row.VALUE_ROLL_YEAR));
  put(facts, 'assessed_land_value', land);
  put(facts, 'assessed_building_value', building);
  put(facts, 'assessed_value', (land || 0) + (building || 0) || null);
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.SITUSCITY) || '').toUpperCase(), zip: zipCode(zip) }, facts };
}

async function* build({ work }) {
  const info = await getJson(`${LAYER}?f=json`, 'The layer\'s description');
  const asOf = isoDate(info.editingInfo?.dataLastEditDate || info.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The layer no longer says when it changed');
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'ca-san-joaquin', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
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
    fips: FIPS, state: 'CA', name: COUNTY, publisher: 'San Joaquin County Assessor', dataset: 'parcels, Public Works', method: 'county', source: 'ca-san-joaquin', as_of: asOf, stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YEAR_BUILT', living_sqft: 'TOTALLIV_AREA', bedrooms: 'BEDROOMS', full_baths: 'BATHROOM_WHOLE', half_baths: 'BATHROOM_HALF', stories: 'STORIES', fireplaces: 'FIREPLACE', units: 'NUMBER_UNITS', lot_sqft: 'LANDSIZE_SQFT', lot_acres: 'LANDSIZE_ACRES', assessed_land_value: 'LAND_VALUE', assessed_building_value: 'STRUCTURE_VALUE', value_year: 'VALUE_ROLL_YEAR' },
  },
};
