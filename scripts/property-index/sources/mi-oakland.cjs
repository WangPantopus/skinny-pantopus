'use strict';
// Oakland County, Michigan: the county's open parcel service, Tax Parcel Plus. The county's Open Data terms: "retrieve, download,
// copy, modify, translate, adapt, distribute, sort, search, and reuse Open Data for any lawful purpose", with an indemnity. Owner
// names and postal addresses aren't asked for. Michigan assesses at half of market value, so these are assessed and taxable
// values, never market values. No year built or sale prices in this file. Words for a building's style are each town assessor's.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { layerRows, cached } = require('../lib/services.cjs');
const { isoDate, zipCode } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '26125';
const COUNTY = 'Oakland County';
const LAYER = 'https://gisservices.oakgov.com/arcgis/rest/services/Enterprise/EnterpriseOpenParcelDataMapService/MapServer/1';
const COLUMNS = ['KEYPIN', 'PIN', 'CVTTAXDESCRIPTION', 'CLASSCODE', 'SITEADDRESS', 'SITECITY', 'SITEZIP5', 'ASSESSEDVALUE', 'TAXABLEVALUE', 'NUM_BEDS', 'NUM_BATHS', 'STRUCTURE_DESC', 'LIVING_AREA_SQFT', 'Shape.area'];
// Michigan's property classes.
const CLASSES = { 401: 'Residential, improved', 402: 'Residential, vacant', 403: 'Residential, building on leased land', 407: 'Residential condominium', 201: 'Commercial, improved', 202: 'Commercial, vacant', 301: 'Industrial, improved', 302: 'Industrial, vacant', 101: 'Agricultural, improved', 102: 'Agricultural, vacant' };
const APARTMENT = /APART|MULTI ?TENANT/i;
const TWO_FAMILY = /DUPLEX/i;

function useOf(code, structure, unit) {
  const n = Number(code);
  if (n === 407 || (n === 401 && unit)) return ['unit', 'condo'];
  if (n === 402 || n === 102 || n === 202 || n === 302) return ['parcel', null];
  if (n === 401 || n === 403 || n === 101) {
    if (APARTMENT.test(structure)) return ['building', 'apartment'];
    return ['property', TWO_FAMILY.test(structure) ? 'townhouse' : 'house'];
  }
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};
const styleOf = (text) => {
  const value = word(text);
  return value && !/^(OTHER|SINGLE ?FAMILY|\d+)$/i.test(value) ? value : null;
};

function fromRow(row, asOf) {
  const line = word(row.SITEADDRESS);
  const address = line ? parse(line) : null;
  const parcel = word(row.PIN) || word(row.KEYPIN);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.CLASSCODE, row.STRUCTURE_DESC || '', address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', line);
  put(facts, 'municipality', word(row.CVTTAXDESCRIPTION));
  put(facts, 'land_use', CLASSES[Number(row.CLASSCODE)]);
  put(facts, 'county_use_code', word(row.CLASSCODE));
  if (home || kind === 'building') put(facts, 'style', styleOf(row.STRUCTURE_DESC));
  if (home) {
    put(facts, 'living_sqft', positive(row.LIVING_AREA_SQFT));
    put(facts, 'bedrooms', inRange(row.NUM_BEDS, 15));
    put(facts, 'bathrooms', inRange(row.NUM_BATHS, 15));
  }
  if (kind !== 'unit') put(facts, 'lot_sqft', positive(row['Shape.area']) && Math.round(row['Shape.area']));
  put(facts, 'value_year', Number(asOf.slice(0, 4)));
  put(facts, 'assessed_value', positive(row.ASSESSEDVALUE));
  put(facts, 'taxable_value', positive(row.TAXABLEVALUE));
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.SITECITY) || '').toUpperCase(), zip: zipCode(row.SITEZIP5) }, facts };
}

async function* build({ work, today }) {
  const asOf = isoDate(today.getTime());
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'mi-oakland', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS, { oid: 'OBJECTID_12' }))) {
    const record = fromRow(row, asOf);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'MI', name: COUNTY, publisher: 'Oakland County', dataset: 'Tax Parcel Plus, open data', method: 'county', source: 'mi-oakland', as_of: asOf, stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { living_sqft: 'LIVING_AREA_SQFT', bedrooms: 'NUM_BEDS', bathrooms: 'NUM_BATHS', assessed_value: 'ASSESSEDVALUE', taxable_value: 'TAXABLEVALUE' },
  },
};
