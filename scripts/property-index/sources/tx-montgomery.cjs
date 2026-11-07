'use strict';
// Montgomery County, Texas: the Montgomery Central Appraisal District's tax parcels, in the county's public view (its notice:
// "intended for public use", for GIS and mapping, verify with the district). Year built, main area and the category. No values,
// bedrooms or baths; sale prices aren't public in Texas. Owner, mailing and exemption columns are never asked for: the owner
// column is only used to ask which accounts are marked protected (Tax Code 25.025).

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { CATEGORY_WORDS, protectedWhere, useOf } = require('../lib/texas.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '48339';
const COUNTY = 'Montgomery County';
const LAYER = 'https://services1.arcgis.com/PRoAPGnMSUqvTrzq/arcgis/rest/services/Tax_Parcel_view/FeatureServer/0';
const COLUMNS = ['pid', 'PIN', 'situs', 'stateCd', 'imprvActualYearBuilt', 'imprvMainArea', 'legalDescription'];

// "123 OAK ST, CONROE TX 77301"
function situsOf(text) {
  const match = /^(.+?),\s*([^,]+?)\s+TX\s+(\d{5})/i.exec(String(text ?? '').replace(/\s+/g, ' ').trim());
  return match ? { line: match[1], city: match[2].toUpperCase(), zip: match[3] } : null;
}

function fromRow(row) {
  const situs = situsOf(row.situs);
  const address = situs ? parse(situs.line) : null;
  const account = String(row.pid ?? '').trim();
  if (!address || !account) return null;
  const built = year(row.imprvActualYearBuilt);
  const living = positive(row.imprvMainArea);
  const code = String(word(row.stateCd) || '').toUpperCase();
  const [kind, homeType] = useOf(code, address.unit, Boolean(built || living));
  const facts = { parcel_number: account, county: COUNTY, fips: FIPS };
  put(facts, 'address_on_record', onRecord(situs.line));
  put(facts, 'land_use', CATEGORY_WORDS[code[0]]);
  put(facts, 'county_use_code', code);
  put(facts, 'legal_description', word(row.legalDescription)?.slice(0, 300));
  if (kind === 'property' || kind === 'unit' || kind === 'building') put(facts, 'year_built', built);
  if (kind === 'property' || kind === 'unit') put(facts, 'living_sqft', living);
  else if (kind === 'building') put(facts, 'gross_sqft', living);
  return { id: `pp:${kind}:${FIPS}:${account}`, kind, home_type: homeType, address: { ...address, city: situs.city, zip: zipCode(situs.zip) }, facts };
}

async function* build({ work }) {
  const about = await getJson(`${LAYER}?f=json`, 'The layer\'s description');
  const asOf = isoDate(about.editingInfo?.dataLastEditDate || about.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The layer no longer says when it changed');
  const hidden = new Set();
  for await (const row of layerRows(LAYER, ['pid'], { where: protectedWhere('ownerName') })) hidden.add(String(row.pid));
  log(`${hidden.size} accounts marked protected`);
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'tx-montgomery', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    if (hidden.has(String(row.pid))) continue;
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} accounts, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'TX', name: COUNTY, publisher: 'Montgomery Central Appraisal District and Montgomery County', dataset: 'tax parcels', method: 'county', source: 'tx-montgomery', as_of: asOf, stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: [LAYER],
    facts: { year_built: 'imprvActualYearBuilt', living_sqft: 'imprvMainArea', gross_sqft: 'imprvMainArea', legal_description: 'legalDescription' },
  },
};
