'use strict';
// Hidalgo County, Texas: the Hidalgo County Appraisal District's monthly export, on its Data Downloads page. Its appraisal table
// has year built, main area, land and market values; no bedrooms or baths; sale prices aren't public in Texas. Few addresses
// carry a ZIP, so the county's ZIPs come from the Census. The owner column is read only to ask whether the district marked a
// protected person's account (Tax Code 25.025), then dropped. Mailing, deed and exemption columns aren't read.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { download, zipTable } = require('../lib/tables.cjs');
const { year, zipCode, onRecord } = require('../lib/addresses.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { CATEGORY_WORDS, useOf } = require('../lib/texas.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '48215';
const COUNTY = 'Hidalgo County';
const FILE = 'https://drive.usercontent.google.com/download?id=1jdNqzlfEVDkSbWp2eva7S1U93rlDhZdo&export=download&confirm=t';
const TABLE = 'HCADShapefiles/data.csv';
const COLUMNS = ['pid', 'geoID', 'propType', 'stateCd', 'name', 'imprvActualYearBuilt', 'imprvMainArea', 'landTotalAcres', 'landValue', 'improvementValue', 'marketValue', 'legalDescription', 'situs'];
const PROTECTED = /CONFIDENTIAL|PROTECTED|WITHHELD|SUPPRESS|NOT DISPLAYED|25\.025/i;

// "123 OAK ST, MCALLEN TX 78501", with the state and ZIP often left off.
function situsOf(text) {
  const [line, place = ''] = String(text ?? '').replace(/\s+/g, ' ').trim().split(/,\s*(.*)/s);
  if (!line) return null;
  const match = /^(.*?)(?:\s*,?\s*TX)?(?:\s+(\d{5}))?$/i.exec(place.trim());
  return { line, city: (match?.[1] || '').toUpperCase(), zip: match?.[2] || null };
}

function fromRow(row) {
  const situs = situsOf(row.situs);
  const address = situs ? parse(situs.line) : null;
  if (!address || !row.pid) return null;
  const built = year(row.imprvActualYearBuilt);
  const living = positive(row.imprvMainArea);
  const code = String(word(row.stateCd) || '').toUpperCase();
  const [kind, homeType] = useOf(code, address.unit, Boolean(built || living));
  const facts = { parcel_number: row.pid, county: COUNTY, fips: FIPS };
  put(facts, 'address_on_record', onRecord(situs.line));
  put(facts, 'land_use', CATEGORY_WORDS[code[0]]);
  put(facts, 'county_use_code', code);
  put(facts, 'legal_description', word(row.legalDescription)?.slice(0, 300));
  if (kind === 'property' || kind === 'unit' || kind === 'building') put(facts, 'year_built', built);
  if (kind === 'property' || kind === 'unit') put(facts, 'living_sqft', living);
  else if (kind === 'building') put(facts, 'gross_sqft', living);
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.landTotalAcres));
  put(facts, 'market_value', positive(row.marketValue));
  put(facts, 'market_land_value', positive(row.landValue));
  put(facts, 'market_building_value', positive(row.improvementValue));
  return { id: `pp:${kind}:${FIPS}:${row.pid}`, kind, home_type: homeType, address: { ...address, city: situs.city, zip: zipCode(situs.zip) }, facts };
}

async function* build({ work }) {
  const zip = path.join(work, 'tx-hidalgo', 'HCADShapefiles.zip');
  download(FILE, zip);
  const stamp = require('node:child_process').execFileSync('unzip', ['-l', zip], { encoding: 'utf8', maxBuffer: 1 << 24 }).split('\n').find((line) => line.endsWith(TABLE));
  const dated = /(\d{2})-(\d{2})-(\d{4})/.exec(stamp || '');
  if (!dated) throw new Error('The export no longer says when its table was made');
  const records = [];
  const seen = new Set();
  let [noAddress, hidden] = [0, 0];
  for await (const row of zipTable(zip, TABLE, COLUMNS)) {
    if (row.propType !== 'R' && row.propType !== 'MH') continue;
    if (PROTECTED.test(row.name)) {
      hidden += 1;
      continue;
    }
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} accounts, ${noAddress} without a street number, ${hidden} protected`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'TX', name: COUNTY, publisher: 'Hidalgo County Appraisal District', dataset: 'appraisal export', method: 'county', source: 'tx-hidalgo', as_of: `${dated[3]}-${dated[1]}-${dated[2]}`, stale_after_days: 450, extra_zips: zipsByCounty(work, ['48']).get(FIPS) || [], records,
  };
}

module.exports = {
  build,
  dictionary: {
    columns: COLUMNS,
    facts: { year_built: 'imprvActualYearBuilt', living_sqft: 'imprvMainArea', gross_sqft: 'imprvMainArea', lot_acres: 'landTotalAcres', market_value: 'marketValue', market_land_value: 'landValue', market_building_value: 'improvementValue', legal_description: 'legalDescription' },
  },
};
