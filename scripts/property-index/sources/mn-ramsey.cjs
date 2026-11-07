'use strict';
// Ramsey County, Minnesota: the Assessor's parcel data on the county's open data portal, public domain, with bedrooms and baths the
// state's open parcels leave out. It holds every assessment year: only the latest is read. Taxpayer and homestead aren't in it.
// A condo's address there has no unit number: that comes from the county's row in the state's open parcels, by parcel number.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, layerRows, socrataRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '27123';
const COUNTY = 'Ramsey County';
const DOMAIN = 'data.ramseycountymn.gov';
const TABLE = '4fwy-py9e';
const STATE_PARCELS = 'https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_mngeo/plan_parcels_open/FeatureServer/1';
const COLUMNS = ['pin', 'rolltype', 'assessment_year', 'street_address_1', 'street_address_2', 'municipality', 'land_use_code', 'living_units', 'total_acres', 'land_value', 'building_value', 'total_market_value', 'sumlandsqft', 'dwelling_year_built', 'sumressqftlivingarea', 'bedrooms', 'full_baths', 'half_baths', 'combldg_year_built', 'latest_sale_date', 'sale_price'];

function useOf(code, hasUnit) {
  const use = String(code ?? '').toUpperCase();
  if (/GARAGE|STORAGE/.test(use)) return ['other', null];
  if (/CONDO|CO-OP/.test(use)) return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (/TOWNHOME/.test(use)) return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (/MANUFACT|MOBILE/.test(use)) return ['property', 'mobile_home'];
  if (/TWO FAMILY|THREE FAMILY|TRIPLEX|DUPLEX|DOUBLE/.test(use)) return ['building', 'multi_unit'];
  if (/APART/.test(use)) return ['building', 'apartment'];
  if (/VACANT/.test(use)) return ['parcel', null];
  if (/SINGLE FAMILY/.test(use)) return hasUnit ? ['unit', 'condo'] : ['property', 'house'];
  return ['other', null];
}

function fromRow(row, unit) {
  const address = parse(row.street_address_1, realUnit(unit));
  const parcel = word(row.pin);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.land_use_code, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  const place = /^(.*?),\s*MN,?\s*(\d{5})/i.exec(String(row.street_address_2 ?? ''));
  put(facts, 'address_on_record', onRecord(word(row.street_address_1), unit));
  put(facts, 'land_use', String(word(row.land_use_code) || '').replace(/^\d+\s*-\s*/, '') || null);
  put(facts, 'county_use_code', /^\d+/.exec(String(row.land_use_code ?? ''))?.[0]);
  put(facts, 'municipality', String(word(row.municipality) || '').replace(/^\d+\s*-\s*/, '') || null);
  if (home || kind === 'building') put(facts, 'year_built', year(row.dwelling_year_built) || year(row.combldg_year_built));
  if (home) {
    put(facts, 'living_sqft', positive(row.sumressqftlivingarea));
    put(facts, 'bedrooms', positive(row.bedrooms));
    const [full, half] = [positive(row.full_baths), positive(row.half_baths)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
  } else if (kind === 'building') {
    put(facts, 'gross_sqft', positive(row.sumressqftlivingarea));
    put(facts, 'units', positive(row.living_units));
  }
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.total_acres) || (positive(row.sumlandsqft) ? Number((positive(row.sumlandsqft) / 43560).toFixed(4)) : null));
  put(facts, 'value_year', positive(row.assessment_year));
  put(facts, 'market_value', positive(row.total_market_value));
  put(facts, 'market_land_value', positive(row.land_value));
  put(facts, 'market_building_value', positive(row.building_value));
  if (positive(row.sale_price) > 100 && isoDate(row.latest_sale_date)) {
    facts.sale_price = positive(row.sale_price);
    facts.sale_date = isoDate(row.latest_sale_date);
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(place?.[1] || '').toUpperCase(), zip: zipCode(place?.[2]) }, facts };
}

async function* build({ work }) {
  const about = await getJson(`https://${DOMAIN}/api/views/${TABLE}.json`, 'The dataset\'s description');
  const asOf = isoDate((about.rowsUpdatedAt || 0) * 1000);
  if (!asOf) throw new Error('The dataset no longer says when it changed');
  const [{ latest }] = await getJson(`https://${DOMAIN}/resource/${TABLE}.json?${new URLSearchParams({ $select: 'max(assessment_year) as latest' })}`, 'The latest assessment year');
  log(`assessment year ${latest}`);
  const units = new Map();
  for await (const row of cached(path.join(work, 'mn-ramsey', 'units.jsonl.gz'), () => layerRows(STATE_PARCELS, ['county_pin', 'sub_id1'], { where: "co_name = 'Ramsey' AND sub_id1 IS NOT NULL", oid: 'objectid' }))) units.set(word(row.county_pin), row.sub_id1);
  log(`${units.size} unit numbers from the state's parcels`);
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'mn-ramsey', `${latest}.jsonl.gz`), () => socrataRows(DOMAIN, TABLE, COLUMNS, { where: `assessment_year='${latest}' AND rolltype in('Real Property','Manufactured Home')` }))) {
    const record = fromRow(row, units.get(word(row.pin)));
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'MN', name: COUNTY, publisher: 'Ramsey County Assessor', dataset: 'assessor parcel data', method: 'county', source: 'mn-ramsey', as_of: asOf, stale_after_days: 730, records,
  };
}

module.exports = {
  build,
  dictionary: {
    socrata: { domain: DOMAIN, ids: [TABLE] },
    facts: { year_built: 'dwelling_year_built', living_sqft: 'sumressqftlivingarea', gross_sqft: 'sumressqftlivingarea', bedrooms: 'bedrooms', full_baths: 'full_baths', half_baths: 'half_baths', units: 'living_units', lot_acres: 'total_acres', market_value: 'total_market_value', market_land_value: 'land_value', market_building_value: 'building_value', value_year: 'assessment_year', sale_price: 'sale_price', sale_date: 'latest_sale_date', land_use: 'land_use_code' },
  },
};
