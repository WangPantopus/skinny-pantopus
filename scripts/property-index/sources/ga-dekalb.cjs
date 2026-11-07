'use strict';
// DeKalb County, Georgia: the county's tax parcels, CC BY 4.0, credit DeKalb County GIS. Addresses, class, zoning, acreage and values; its year built
// and building area columns are empty, so no building facts. Owner, mailing and tax columns are in the layer and never asked for. Georgia assesses
// at 40% of the appraised value. The layer repeats a parcel's shape for each condo unit, each with its own row.

const path = require('node:path');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { isoDate, zipCode, realUnit, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '13089';
const COUNTY = 'DeKalb County';
const LAYER = 'https://services2.arcgis.com/IxVN2oUE9EYLSnPE/arcgis/rest/services/Parcels/FeatureServer/0';
const COLUMNS = ['PARCELID', 'LOWPARCELI', 'UNIT', 'BUILDING', 'SITEADDRES', 'UNIT_NO', 'UNIT_TYPE', 'CITY', 'ZIP', 'CVTTXDSCRP', 'CLASSDSCRP', 'ACREAGE', 'ZONING', 'SUBDIVISIO', 'TOTAPR1', 'LNDVALUE', 'CNTASSDVAL'];
const CLASS_WORDS = { R3: 'Residential', R4: 'Residential, small tract', R9: 'Residential, multi-family', C3: 'Commercial', C4: 'Commercial, small tract', E1: 'Exempt', E2: 'Exempt', I3: 'Industrial' };

function useOf(code, hasUnit) {
  const c = String(code ?? '').trim();
  if (c === 'R3' || c === 'R4') return hasUnit ? ['unit', 'condo'] : ['property', 'house'];
  if (c === 'R9') return ['building', 'apartment'];
  return ['other', null];
}

function fromRow(row) {
  const unit = realUnit(word(row.UNIT_NO) || word(row.UNIT));
  // The site address carries its city after the street, before the comma ("1234 X RD DECATUR, GA ..."): left there, the city reads as part of
  // the street's name, and a person's own address finds nothing.
  const city = String(word(row.CITY) || '').toUpperCase();
  let line = String(row.SITEADDRES ?? '').split(',')[0].replace(/\s+/g, ' ').trim();
  if (city && line.toUpperCase().endsWith(` ${city}`)) line = line.slice(0, -(city.length + 1)).trim();
  const address = line ? parse(line, unit) : null;
  const parcel = word(row.PARCELID) || word(row.LOWPARCELI);
  if (!address || !parcel) return null;
  const code = word(row.CLASSDSCRP);
  const [kind, homeType] = useOf(code, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  put(facts, 'address_on_record', onRecord(line, unit));
  put(facts, 'land_use', CLASS_WORDS[code]);
  put(facts, 'county_use_code', code);
  put(facts, 'zoning', word(row.ZONING));
  put(facts, 'subdivision', word(row.SUBDIVISIO));
  put(facts, 'municipality', word(row.CVTTXDSCRP));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.ACREAGE));
  put(facts, 'market_value', positive(row.TOTAPR1));
  put(facts, 'assessed_value', positive(row.CNTASSDVAL));
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.CITY) || '').toUpperCase(), zip: zipCode(row.ZIP) }, facts };
}

async function* build({ work }) {
  const about = await getJson(`${LAYER}?f=json`, 'The layer\'s description');
  const asOf = isoDate(about.editingInfo?.dataLastEditDate || about.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The layer no longer says when it changed');
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'ga-dekalb', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS, { oid: 'FID' }))) {
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
    fips: FIPS, state: 'GA', name: COUNTY, publisher: 'DeKalb County GIS', dataset: 'tax parcels', method: 'county', source: 'ga-dekalb', as_of: asOf, stale_after_days: 730, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: [LAYER],
    facts: { lot_acres: 'ACREAGE', market_value: 'TOTAPR1', assessed_value: 'CNTASSDVAL', zoning: 'ZONING', subdivision: 'SUBDIVISIO', municipality: 'CVTTXDSCRP', land_use: 'CLASSDSCRP' },
  },
};
