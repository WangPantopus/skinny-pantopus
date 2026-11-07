'use strict';
// Vermont: the Vermont Center for Geographic Information's statewide standardized parcels, each town's parcels joined to its
// grand list by the Department of Taxes, for all 14 counties. Disclaimers only ("planning purposes", no warranty; read
// November 7, 2026). The E911 site address, the grand list's category, acres and the town's listed values (a town's
// appraisal, so they go in assessed value) with the grand list year. No building facts. Owner, mailing, homestead and
// exemption columns are never asked for. Each town's county comes from VCGI's own town boundary layer.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { layerRows, cached } = require('../lib/services.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const BASE = 'https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services';
const PARCELS = `${BASE}/FS_VCGI_OPENDATA_Cadastral_VTPARCELS_poly_standardized_parcels_SP_v1/FeatureServer/0`;
const TOWNS = `${BASE}/FS_VCGI_OPENDATA_Boundary_BNDHASH_poly_towns_SP_v1/FeatureServer/0`;
const COLUMNS = ['SPAN', 'PARCID', 'PROPTYPE', 'GLYEAR', 'TOWN', 'CAT', 'DESCPROP', 'ACRESGL', 'REAL_FLV', 'LAND_LV', 'IMPRV_LV', 'E911ADDR'];
const COUNTIES = {
  50001: 'Addison', 50003: 'Bennington', 50005: 'Caledonia', 50007: 'Chittenden', 50009: 'Essex', 50011: 'Franklin', 50013: 'Grand Isle',
  50015: 'Lamoille', 50017: 'Orange', 50019: 'Orleans', 50021: 'Rutland', 50023: 'Washington', 50025: 'Windham', 50027: 'Windsor',
};
// The grand list's categories: R1 and R2 residential (under and over six acres), S1 and S2 seasonal, MHL and MHU mobile homes
// with and without land, CA commercial apartments, M miscellaneous land, W woodland.
const CATEGORIES = {
  R1: ['property', 'house', 'Residential, under six acres'], R2: ['property', 'house', 'Residential, six acres or more'], S1: ['property', 'house', 'Seasonal home, under six acres'],
  S2: ['property', 'house', 'Seasonal home, six acres or more'], MHL: ['property', 'mobile_home', 'Mobile home with land'], MHU: ['property', 'mobile_home', 'Mobile home without land'],
  CA: ['building', 'apartment', 'Commercial apartments'], M: ['parcel', null, 'Miscellaneous land'], W: ['parcel', null, 'Woodland'],
};

function fromRow(row, fips, county) {
  const parsed = parse(row.E911ADDR);
  const parcel = word(row.SPAN) || word(row.PARCID);
  if (!parsed || !parcel) return null;
  const [kind, homeType, useWord] = CATEGORIES[String(row.CAT ?? '').trim()] || ['other', null, null];
  const facts = { parcel_number: parcel, county, fips };
  put(facts, 'address_on_record', word(row.E911ADDR));
  put(facts, 'municipality', word(row.TOWN));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.ACRESGL));
  put(facts, 'land_use', useWord);
  put(facts, 'county_use_code', word(row.CAT));
  if (positive(row.REAL_FLV)) put(facts, 'value_year', positive(row.GLYEAR));
  put(facts, 'assessed_value', positive(row.REAL_FLV));
  put(facts, 'assessed_land_value', positive(row.LAND_LV));
  put(facts, 'assessed_building_value', positive(row.IMPRV_LV));
  return { id: `pp:${kind}:${fips}:${parcel}`, kind, home_type: homeType, address: { ...parsed, city: String(word(row.TOWN) || '').toUpperCase(), zip: '' }, facts };
}

async function* build({ work }) {
  const only = (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  const zips = zipsByCounty(work, ['50']);
  // Two gores share a name in two counties: a town named twice isn't placed.
  const countyOf = new Map();
  for await (const town of layerRows(TOWNS, ['TOWNNAME', 'CNTY'])) {
    const name = String(town.TOWNNAME ?? '').trim().toUpperCase();
    const fips = `50${String(town.CNTY ?? '').padStart(3, '0')}`;
    countyOf.set(name, countyOf.has(name) && countyOf.get(name) !== fips ? null : fips);
  }
  if (countyOf.size < 240) throw new Error(`Only ${countyOf.size} towns are listed`);
  const byCounty = new Map(Object.keys(COUNTIES).map((fips) => [fips, { records: new Map(), noAddress: 0 }]));
  let year = 0;
  const rows = cached(path.join(work, 'vt-parcels', 'parcels.jsonl.gz'), () => layerRows(PARCELS, COLUMNS, { where: "PROPTYPE = 'PARCEL'" }));
  for await (const row of rows) {
    const fips = countyOf.get(String(row.TOWN ?? '').trim().toUpperCase());
    if (!fips || (only.length && !only.includes(fips))) continue;
    if (Number(row.GLYEAR) > year) year = Number(row.GLYEAR);
    const held = byCounty.get(fips);
    const record = fromRow(row, fips, `${COUNTIES[fips]} County`);
    if (!record) held.noAddress += 1;
    else if (!held.records.has(record.id)) held.records.set(record.id, record);
  }
  if (!year) throw new Error('The parcels no longer say their grand list year');
  for (const [fips, { records: byId, noAddress }] of byCounty) {
    const county = `${COUNTIES[fips]} County`;
    const records = [...byId.values()];
    log(`${county}: ${records.length} records, ${noAddress} without a street number`);
    if (!records.length) continue;
    for (const building of condoBuildings(records, { fips, county })) records.push(building);
    yield {
      fips, state: 'VT', name: county, publisher: `${county}'s towns, through the Vermont Center for Geographic Information`, dataset: 'standardized parcels with the grand list', method: 'state', source: 'vt-parcels', title: 'State records', as_of: `${year}-04-01`, stale_after_days: 550, extra_zips: zips[fips] || [], records,
    };
  }
}

module.exports = { build };
