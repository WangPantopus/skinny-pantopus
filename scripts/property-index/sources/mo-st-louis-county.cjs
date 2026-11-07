'use strict';
// St. Louis County, Missouri: the Assessor's parcel data on the county GIS Service Center's open data site. The county disclaims any warranty and asks
// users to hold it harmless; no limit on use stated. Year built, residential living area, appraised (market) and assessed values, acres and living
// units. The county records no bedrooms or baths here, and Missouri keeps sale prices out of public records. Owner, mailing, care-of and deed columns
// are never asked for. The layer repeats a parcel once for each district it falls in, so each locator counts once. It is in Missouri East state plane
// feet, so a parcel's own area is its lot where no acreage is stated.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '29189';
const COUNTY = 'St. Louis County';
const LAYER = 'https://services2.arcgis.com/w657bnjzrjguNyOy/arcgis/rest/services/Pardata_Juris/FeatureServer/1';
const COLUMNS = ['LOCATOR', 'PARENT_LOC', 'TAXYR', 'PROP_ADD', 'PROP_ZIP', 'LUC', 'LANDUSE2', 'LIVUNIT', 'YEARBLT', 'RESQFT', 'ACRES', 'Shape__Area', 'APPLANDVAL', 'APPIMPVAL', 'TOTAPVAL', 'ASSTLANDVAL', 'ASSTIMPVAL', 'TOTASSMT', 'SUBDIVISION', 'MUNICIPALITY', 'SCHOOL_DISTRICT', 'NBHD'];

// The Assessor's land use codes: 110 a single-family dwelling (119 a condominium unit under its building's parcel), 115 a building of several
// units, 910 vacant land, 190 land with no dwelling.
function useOf(row, unit) {
  const [luc, fine] = [String(row.LUC || '').trim(), String(row.LANDUSE2 || '').trim()];
  if (fine === '119') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (luc === '110') return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (luc === '115') return ['building', positive(row.LIVUNIT) > 4 ? 'apartment' : 'multi_unit'];
  if (luc === '910') return ['parcel', null];
  return ['other', null];
}

function fromRow(row) {
  const address = parse(String(row.PROP_ADD ?? ''));
  const parcel = word(row.LOCATOR);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(row.PROP_ADD, ''));
  put(facts, 'county_use_code', word(row.LUC));
  put(facts, 'subdivision', word(row.SUBDIVISION));
  put(facts, 'municipality', word(row.MUNICIPALITY));
  put(facts, 'school_district', word(row.SCHOOL_DISTRICT));
  put(facts, 'neighborhood', word(row.NBHD));
  if (home || kind === 'building') put(facts, 'year_built', year(row.YEARBLT));
  if (home) put(facts, 'living_sqft', positive(row.RESQFT));
  if (kind === 'building') put(facts, 'units', positive(row.LIVUNIT) && positive(row.LIVUNIT) <= 2000 ? positive(row.LIVUNIT) : null);
  if (kind !== 'unit') {
    if (positive(row.ACRES)) put(facts, 'lot_acres', positive(row.ACRES));
    else put(facts, 'lot_sqft', positive(row.Shape__Area) >= 100 ? Math.round(positive(row.Shape__Area)) : null);
  }
  put(facts, 'value_year', positive(row.TAXYR));
  put(facts, 'market_value', positive(row.TOTAPVAL));
  put(facts, 'market_land_value', positive(row.APPLANDVAL));
  put(facts, 'market_building_value', positive(row.APPIMPVAL));
  put(facts, 'assessed_value', positive(row.TOTASSMT));
  put(facts, 'assessed_land_value', positive(row.ASSTLANDVAL));
  put(facts, 'assessed_building_value', positive(row.ASSTIMPVAL));
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: '', zip: zipCode(row.PROP_ZIP) || null }, facts };
}

async function* build({ work }) {
  const info = await getJson(`${LAYER}?f=json`, 'The parcel layer\'s description');
  const asOf = isoDate(info.editingInfo?.dataLastEditDate || info.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The parcel layer no longer says when it changed');
  const records = new Map();
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'mo-st-louis-county', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    if (seen.has(row.LOCATOR)) continue;
    seen.add(row.LOCATOR);
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (!records.has(record.id)) records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number, ${seen.size} locators`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'MO', name: COUNTY, publisher: 'St. Louis County Assessor', dataset: 'parcel data', method: 'county', source: 'mo-st-louis-county', as_of: asOf, stale_after_days: 450, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YEARBLT', living_sqft: 'RESQFT', units: 'LIVUNIT', lot_acres: 'ACRES', lot_sqft: 'Shape__Area', value_year: 'TAXYR', market_value: 'TOTAPVAL', market_land_value: 'APPLANDVAL', market_building_value: 'APPIMPVAL', assessed_value: 'TOTASSMT', assessed_land_value: 'ASSTLANDVAL', assessed_building_value: 'ASSTIMPVAL' },
  },
};
