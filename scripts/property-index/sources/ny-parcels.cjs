'use strict';
// New York: the state's public tax parcels, for the counties that gave the state permission to share theirs (33 outside
// the city, the state lists them), joined by the state to the assessment roll. Other counties aren't in it: their files
// are theirs to give. New York City: the Department of City Planning's PLUTO, one record per tax lot, so a condominium
// is its billing lot, a building, and its units have no record here.
//
// Owner and mailing columns aren't asked for from either service.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, layerRows, socrataRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const LAYER = 'https://gisservices.its.ny.gov/arcgis/rest/services/NYS_Tax_Parcels_Public/FeatureServer/1';
const COUNTIES = {
  Albany: '36001', Broome: '36007', Cayuga: '36011', Chautauqua: '36013', Cortland: '36023', Erie: '36029', Genesee: '36037', Greene: '36039', Hamilton: '36041', Lewis: '36049', Livingston: '36051',
  Montgomery: '36057', Oneida: '36065', Onondaga: '36067', Ontario: '36069', Orange: '36071', Oswego: '36075', Otsego: '36077', Putnam: '36079', Rensselaer: '36083', Rockland: '36087', Schuyler: '36097',
  StLawrence: '36089', Steuben: '36101', Suffolk: '36103', Sullivan: '36105', Tioga: '36107', Tompkins: '36109', Ulster: '36111', Warren: '36113', Wayne: '36117', Westchester: '36119', Wyoming: '36121',
};
const COUNTY_WORDS = { StLawrence: 'St. Lawrence' };
const CITY_BOROUGHS = { BX: ['36005', 'Bronx'], BK: ['36047', 'Kings'], MN: ['36061', 'New York'], QN: ['36081', 'Queens'], SI: ['36085', 'Richmond'] };

const COLUMNS = ['SWIS', 'PRINT_KEY', 'SWIS_PRINT_KEY_ID', 'MUNI_NAME', 'PARCEL_ADDR', 'LOC_ST_NBR', 'LOC_STREET', 'LOC_UNIT', 'LOC_ZIP', 'PROP_CLASS', 'LAND_AV', 'TOTAL_AV', 'FULL_MARKET_VAL', 'YR_BLT', 'ACRES',
  'SCHOOL_NAME', 'SEWER_DESC', 'WATER_DESC', 'UTILITIES_DESC', 'BLDG_STYLE_DESC', 'HEAT_TYPE_DESC', 'FUEL_TYPE_DESC', 'SQFT_LIVING', 'GFA', 'NBR_KITCHENS', 'NBR_FULL_BATHS', 'NBR_BEDROOMS', 'ROLL_YR', 'CALC_ACRES'];

// The Assessor's Manual's property classes that are homes or land for homes. A class's own word goes on the screen.
const CLASSES = {
  210: ['property', 'house', 'One family, year-round'], 211: ['property', 'house', 'One family, year-round'], 215: ['property', 'house', 'One family with an accessory apartment'], 220: ['building', 'multi_unit', 'Two family'], 230: ['building', 'multi_unit', 'Three family'],
  240: ['property', 'house', 'Rural residence with acreage'], 241: ['property', 'house', 'Rural residence, also farmed'], 242: ['property', 'house', 'Rural residence, recreational'], 250: ['property', 'house', 'Estate'], 260: ['property', 'house', 'Seasonal residence'],
  270: ['property', 'mobile_home', 'Mobile home'], 280: ['building', 'multi_unit', 'Several residences'], 281: ['building', 'multi_unit', 'Several residences'], 283: ['property', 'house', 'Residence with incidental business'],
  310: ['parcel', null, 'Vacant residential land'], 311: ['parcel', null, 'Vacant residential land'], 312: ['parcel', null, 'Residential land with a small improvement'], 314: ['parcel', null, 'Rural vacant land, under 10 acres'], 322: ['parcel', null, 'Rural vacant land, over 10 acres'], 323: ['parcel', null, 'Other rural vacant land'],
  411: ['building', 'apartment', 'Apartments'],
};
const HEAT_WORDS = { 'Hot wtr/stm': 'Hot water or steam', 'Hot air': 'Forced hot air', 'No central': 'No central heating' };
const FUEL_WORDS = { 'Propane/LPG': 'Propane' };
const LAND_WORDS = { 'Comm/public': 'Public', 'Gas & elec': 'Gas and electric' };
const said = (text) => {
  const value = word(text);
  return value && !/^(unknown|other style|none)$/i.test(value) ? value : null;
};

function fromRoll(row, fips, county) {
  const klass = String(row.PROP_CLASS ?? '').trim().slice(0, 3);
  const unit = realUnit(row.LOC_UNIT);
  let [kind, homeType, useWord] = CLASSES[klass] || ['other', null, null];
  // Each tax parcel with its own unit number is a home owned on its own, whatever its class: a condominium's unit.
  if (unit && (kind === 'property' || (kind === 'building' && klass === '411'))) [kind, homeType] = ['unit', 'condo'];
  const parsed = parse(`${String(row.LOC_ST_NBR ?? '').trim()} ${String(row.LOC_STREET ?? '').trim()}`, unit);
  if (!parsed) return null;
  const facts = { parcel_number: word(row.PRINT_KEY) || row.SWIS_PRINT_KEY_ID, county, fips };
  const on = kind === 'property' || kind === 'unit' || kind === 'building';
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'municipality', word(row.MUNI_NAME));
  put(facts, 'address_on_record', word(row.PARCEL_ADDR));
  put(facts, 'year_built', on ? year(row.YR_BLT) : null);
  put(facts, 'living_sqft', home ? positive(row.SQFT_LIVING) : null);
  put(facts, 'gross_sqft', on ? positive(row.GFA) : null);
  put(facts, 'bedrooms', home ? positive(row.NBR_BEDROOMS) : null);
  put(facts, 'full_baths', home ? positive(row.NBR_FULL_BATHS) : null);
  put(facts, 'kitchens', home ? positive(row.NBR_KITCHENS) : null);
  put(facts, 'style', on ? said(row.BLDG_STYLE_DESC) : null);
  const heat = said(row.HEAT_TYPE_DESC);
  put(facts, 'heating', home && heat ? HEAT_WORDS[heat] || heat : null);
  const fuel = said(row.FUEL_TYPE_DESC);
  put(facts, 'heating_fuel', home && fuel ? FUEL_WORDS[fuel] || fuel : null);
  const utility = (text) => {
    const value = said(text);
    return value ? LAND_WORDS[value] || value : null;
  };
  put(facts, 'water_source', utility(row.WATER_DESC));
  put(facts, 'sewer', utility(row.SEWER_DESC));
  put(facts, 'utilities', utility(row.UTILITIES_DESC));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.ACRES));
  put(facts, 'school_district', word(row.SCHOOL_NAME));
  put(facts, 'land_use', useWord);
  put(facts, 'county_use_code', word(row.PROP_CLASS));
  put(facts, 'value_year', positive(row.ROLL_YR));
  put(facts, 'market_value', positive(row.FULL_MARKET_VAL));
  put(facts, 'assessed_value', positive(row.TOTAL_AV));
  put(facts, 'assessed_land_value', positive(row.LAND_AV));
  return {
    id: `pp:${kind}:${fips}:${row.SWIS_PRINT_KEY_ID}`, kind, home_type: homeType, address: { ...parsed, city: String(word(row.MUNI_NAME) || '').toUpperCase(), zip: zipCode(row.LOC_ZIP) }, facts,
  };
}

const PLUTO = ['data.cityofnewyork.us', '64uk-42ks'];
const PLUTO_COLUMNS = ['borough', 'bbl', 'address', 'zipcode', 'bldgclass', 'lotarea', 'bldgarea', 'numbldgs', 'numfloors', 'unitsres', 'assessland', 'assesstot', 'yearbuilt', 'condono', 'zonedist1', 'version'];
// PLUTO's building classes, by first letter. A condominium's lot (R) is its billing lot: the whole building.
const PLUTO_CLASSES = {
  A: ['property', 'house', 'One family'], B: ['building', 'multi_unit', 'Two family'], C: ['building', 'apartment', 'Walk-up apartments'], D: ['building', 'apartment', 'Elevator apartments'],
  R: ['building', 'condo', 'Condominium'], S: ['building', 'multi_unit', 'Residence with stores or offices'], V: ['parcel', null, 'Vacant land'],
};
function fromPluto(row, fips, county) {
  const parsed = parse(row.address);
  if (!parsed) return null;
  const buildingClass = String(row.bldgclass ?? '').trim().toUpperCase();
  const [kind, homeType, useWord] = PLUTO_CLASSES[buildingClass.charAt(0)] || ['other', null, null];
  const facts = { parcel_number: String(Math.trunc(Number(row.bbl))), county, fips, municipality: 'New York' };
  const on = kind === 'property' || kind === 'building';
  put(facts, 'address_on_record', word(row.address));
  put(facts, 'year_built', on ? year(row.yearbuilt) : null);
  put(facts, 'gross_sqft', on ? positive(row.bldgarea) : null);
  put(facts, 'stories', on ? positive(row.numfloors) : null);
  put(facts, 'buildings_on_parcel', on ? positive(row.numbldgs) : null);
  if (kind === 'building') put(facts, 'units', positive(row.unitsres));
  put(facts, 'lot_sqft', positive(row.lotarea));
  put(facts, 'zoning', word(row.zonedist1));
  put(facts, 'land_use', useWord);
  put(facts, 'county_use_code', buildingClass);
  const vintage = /^(\d{2})v/.exec(String(row.version ?? ''));
  if (vintage) facts.value_year = 2000 + Number(vintage[1]);
  put(facts, 'assessed_value', positive(row.assesstot));
  put(facts, 'assessed_land_value', positive(row.assessland));
  return { id: `pp:${kind}:${fips}:${facts.parcel_number}`, kind, home_type: homeType, address: { ...parsed, unit: '', building: '', city: 'NEW YORK', zip: zipCode(row.zipcode) }, facts };
}

/** When the state published its file, from the layer's own description: the as-of date of every county it gives. */
async function publishedOn() {
  const description = (await getJson(`${LAYER}?f=json`, 'The layer\'s description')).description || '';
  const published = /Publication Date:\s*([A-Z][a-z]+)\s+(\d{4})/.exec(description);
  if (!published) throw new Error('The layer no longer says when it was published');
  return new Date(`${published[1]} 1, ${published[2]} UTC`).toISOString().slice(0, 10);
}

/** One county's release from the state's file. `name` is the state's county name (a key of COUNTIES). */
async function countyRelease(work, name, asOf) {
  const fips = COUNTIES[name];
  const county = `${COUNTY_WORDS[name] || name} County`;
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  const calculated = new Map();
  const shapes = new Map();
  const rows = cached(path.join(work, 'ny-parcels', `${fips}.jsonl.gz`), () => layerRows(LAYER, COLUMNS, { where: `COUNTY_NAME = '${name}'`, pageSize: 5000 }));
  for await (const row of rows) {
    const acres = positive(row.CALC_ACRES);
    if (acres) shapes.set(acres, (shapes.get(acres) || 0) + 1);
    const record = row.SWIS_PRINT_KEY_ID ? fromRoll(row, fips, county) : null;
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
      if (acres && record.kind !== 'unit' && !record.facts.lot_acres) calculated.set(record, acres);
    }
  }
  // Where a town's roll gives no acres, the state's own measure of the parcel's shape stands in (within a few percent of the roll's acres
  // where both are given), unless another parcel has the very same measure: those share one shape, a mobile home park's or a
  // condominium's land, which is no one home's lot.
  for (const [record, acres] of calculated) if (shapes.get(acres) === 1) record.facts.lot_acres = acres;
  log(`${county}: ${records.length} records, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips, county })) records.push(building);
  return {
    fips, state: 'NY', name: county, publisher: 'New York State', dataset: 'public tax parcels and assessment roll', method: 'state', source: 'ny-parcels', title: 'State records', as_of: asOf, stale_after_days: 730, records,
  };
}

// Counties another connector publishes: the state's records with the bath counts the county's own file adds (ny-county-files.cjs).
const OWN_CONNECTOR = new Set(['36029', '36057', '36083', '36107', '36113']);

async function* build({ work }) {
  const only = (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  const asOf = await publishedOn();

  for (const [name, fips] of Object.entries(COUNTIES)) {
    if (OWN_CONNECTOR.has(fips) || (only.length && !only.includes(fips))) continue;
    yield await countyRelease(work, name, asOf);
  }

  const pluto = await getJson(`https://${PLUTO[0]}/api/views/${PLUTO[1]}.json`, 'PLUTO\'s description');
  const plutoDate = isoDate((pluto.rowsUpdatedAt || 0) * 1000);
  if (!plutoDate) throw new Error('PLUTO no longer says when it changed');
  for (const [borough, [fips, name]] of Object.entries(CITY_BOROUGHS)) {
    if (only.length && !only.includes(fips)) continue;
    const county = `${name} County`;
    const records = [];
    let noAddress = 0;
    const rows = cached(path.join(work, 'ny-parcels', `${fips}.jsonl.gz`), () => socrataRows(PLUTO[0], PLUTO[1], PLUTO_COLUMNS, { where: `borough='${borough}'` }));
    for await (const row of rows) {
      const record = fromPluto(row, fips, county);
      if (record) records.push(record);
      else noAddress += 1;
    }
    log(`${county}: ${records.length} tax lots, ${noAddress} without a street number`);
    yield {
      fips, state: 'NY', name: county, publisher: 'NYC Department of City Planning', dataset: 'PLUTO', method: 'state', source: 'ny-parcels', title: 'City records', as_of: plutoDate, stale_after_days: 400, records,
    };
  }
}

module.exports = { build, CLASSES, COUNTIES, publishedOn, countyRelease };
