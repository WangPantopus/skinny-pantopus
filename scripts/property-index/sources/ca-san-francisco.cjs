'use strict';
// San Francisco, California: the Assessor-Recorder's secured property tax rolls on the City's open data portal, under the Open
// Data Commons Public Domain Dedication and License. It has no owner names; exemption columns aren't asked for. A closed roll comes
// once a year, so these lag. Values are Proposition 13 assessed values. The roll has a last sale date, not a price.

const path = require('node:path');
const { getJson, socrataRows, cached } = require('../lib/services.cjs');
const { year, isoDate, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '06075';
const COUNTY = 'San Francisco County';
const DOMAIN = 'data.sf.gov';
const ROLLS = 'wv5m-vpq2';
const COLUMNS = ['closed_roll_year', 'property_location', 'parcel_number', 'use_code', 'use_definition', 'property_class_code', 'property_class_code_definition', 'year_property_built', 'number_of_bathrooms', 'number_of_bedrooms', 'number_of_rooms', 'number_of_stories', 'number_of_units', 'zoning_code', 'property_area', 'basement_area', 'lot_area', 'tax_rate_area_code', 'current_sales_date', 'assessed_improvement_value', 'assessed_land_value', 'analysis_neighborhood'];

// "0000 0123 MAIN              ST0201": from number, to number, street, two letters of street type, then the unit. A street with no
// type has only spaces there.
function readLocation(text) {
  const match = /^(\S{4,5}) (\S{4,5}) (.*?)\s+([A-Z]{2})?([0-9A-Z]{4,5})$/.exec(String(text ?? '').trimEnd());
  if (!match) return null;
  const clean = (value) => value.replace(/^0+/, '');
  return { number: clean(match[1]) || clean(match[2]), name: match[3].trim(), type: match[4] || '', unit: clean(match[5]) };
}

function useOf(row, unit) {
  const code = String(row.use_code || '').toUpperCase();
  const kind = String(row.property_class_code_definition || '').toUpperCase();
  if (/VACANT/.test(kind) || code === 'VACL') return ['parcel', null];
  if (code === 'SRES') {
    if (/CONDO|STOCK COOP|COOPERATIVE|LIVE\/WORK/.test(kind)) return ['unit', 'condo'];
    if (/TOWN/.test(kind)) return ['property', 'townhouse'];
    return unit ? ['unit', 'condo'] : ['property', 'house'];
  }
  if (code === 'MRES') return positive(row.number_of_units) >= 5 ? ['building', 'apartment'] : ['building', 'multi_unit'];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function fromRow(row) {
  const place = readLocation(row.property_location);
  const parcel = word(row.parcel_number);
  const address = place && streetParts({ number: place.number, name: place.name, suffix: place.type, unit: place.unit });
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([place.number, place.name, place.type].filter(Boolean).join(' '), place.unit));
  put(facts, 'land_use', word(row.use_definition));
  put(facts, 'property_class', word(row.property_class_code_definition));
  put(facts, 'zoning', word(row.zoning_code));
  put(facts, 'neighborhood', word(row.analysis_neighborhood));
  put(facts, 'tax_code_area', word(row.tax_rate_area_code));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(Math.trunc(Number(row.year_property_built))));
    put(facts, 'stories', inRange(row.number_of_stories, 80));
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.property_area));
    put(facts, 'basement_sqft', positive(row.basement_area));
    put(facts, 'bedrooms', inRange(row.number_of_bedrooms, 15));
    put(facts, 'bathrooms', inRange(row.number_of_bathrooms, 15));
    put(facts, 'rooms', inRange(row.number_of_rooms, 40));
  }
  if (kind === 'building') {
    put(facts, 'units', positive(row.number_of_units));
    put(facts, 'gross_sqft', positive(row.property_area));
  }
  if (kind !== 'unit') put(facts, 'lot_sqft', positive(row.lot_area));
  const [land, building] = [positive(row.assessed_land_value), positive(row.assessed_improvement_value)];
  put(facts, 'value_year', positive(row.closed_roll_year));
  put(facts, 'assessed_land_value', land);
  put(facts, 'assessed_building_value', building);
  put(facts, 'assessed_value', (land || 0) + (building || 0) || null);
  put(facts, 'sale_date', isoDate(row.current_sales_date));
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: 'SAN FRANCISCO', zip: '' }, facts };
}

async function* build({ work }) {
  const newest = await getJson(`https://${DOMAIN}/resource/${ROLLS}.json?${new URLSearchParams({ $select: 'max(closed_roll_year) AS roll' })}`, 'The newest roll');
  const roll = word(newest[0]?.roll);
  if (!roll) throw new Error('The rolls no longer say their newest year');
  const about = await getJson(`https://${DOMAIN}/api/views/${ROLLS}.json`, 'The table\'s description');
  const asOf = isoDate((about.rowsUpdatedAt || 0) * 1000);
  if (!asOf) throw new Error('The table no longer says when it changed');
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'ca-san-francisco', 'roll.jsonl.gz'), () => socrataRows(DOMAIN, ROLLS, COLUMNS, { where: `closed_roll_year='${roll}'` }))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels on the ${roll} roll, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'CA', name: COUNTY, publisher: 'San Francisco Assessor-Recorder', dataset: `secured property tax roll, ${roll}`, method: 'county', source: 'ca-san-francisco', as_of: asOf, stale_after_days: 500, extra_zips: zipsByCounty(work, ['06']).get(FIPS) || [], records,
  };
}

module.exports = {
  build,
  dictionary: {
    socrata: { domain: DOMAIN, ids: [ROLLS] },
    facts: { year_built: 'year_property_built', living_sqft: 'property_area', basement_sqft: 'basement_area', bedrooms: 'number_of_bedrooms', bathrooms: 'number_of_bathrooms', rooms: 'number_of_rooms', stories: 'number_of_stories', units: 'number_of_units', lot_sqft: 'lot_area', assessed_land_value: 'assessed_land_value', assessed_building_value: 'assessed_improvement_value', value_year: 'closed_roll_year', sale_date: 'current_sales_date' },
  },
};
