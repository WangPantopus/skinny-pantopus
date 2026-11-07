'use strict';
// Summit County, Ohio: the Fiscal Office's public tax parcels. No terms are stated on the service. Year built, finished floor area,
// floors and values on residential parcels; no bedrooms or baths. Owner and mailing columns are in the layer and never asked for.
// The layer has no ZIP for a site, so the county's ZIPs come from the Census. Assessed values are Ohio's 35% of market.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, realUnit, onRecord } = require('../lib/addresses.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '39153';
const COUNTY = 'Summit County';
const LAYER = 'https://services3.arcgis.com/3Ukh5HzAdI6WZ3KP/arcgis/rest/services/TaxParcels_public/FeatureServer/0';
const COLUMNS = ['PARCELID', 'LOWPARCELID', 'UNIT', 'SITEADDRESS', 'CVTTXDSCRP', 'USECD', 'PRPRTYDSCRP', 'FLOORCOUNT', 'RESFLRAREA', 'RESYRBLT', 'LNDVALUE', 'CNTASSDVAL', 'cntmarval', 'bldgvalue'];
const USE_WORDS = { 500: 'Residential vacant land', 510: 'Single-family dwelling', 520: 'Two-family dwelling', 530: 'Three-family dwelling', 550: 'Condominium', 560: 'Mobile home', 599: 'Other residential' };

function useOf(code, hasUnit) {
  const c = String(code ?? '').trim();
  if (c === '510') return hasUnit ? ['unit', 'condo'] : ['property', 'house'];
  if (c === '550') return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (c === '520' || c === '530') return ['building', 'multi_unit'];
  if (c === '560') return ['property', 'mobile_home'];
  if (c === '500' || c === '400' || c === '300' || c === '600') return ['parcel', null];
  return ['other', null];
}

// "123  OAK ST ", and a span of numbers such as "123& 125  OAK ST" reads as its first.
const siteOf = (text) => String(text ?? '').replace(/\s+/g, ' ').trim().replace(/^(\d+)\s*[&-]\s*[\d/ ]*\s(?=[A-Z])/i, '$1 ');

function fromRow(row) {
  const line = siteOf(row.SITEADDRESS);
  const address = line ? parse(line, realUnit(row.UNIT)) : null;
  const parcel = word(row.PARCELID) || word(row.LOWPARCELID);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.USECD, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(line, row.UNIT));
  put(facts, 'land_use', USE_WORDS[String(row.USECD).trim()]);
  put(facts, 'county_use_code', word(row.USECD));
  put(facts, 'legal_description', word(row.PRPRTYDSCRP)?.slice(0, 300));
  put(facts, 'municipality', word(row.CVTTXDSCRP));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.RESYRBLT));
    put(facts, 'stories', positive(row.FLOORCOUNT));
  }
  if (home) put(facts, 'living_sqft', positive(row.RESFLRAREA));
  else if (kind === 'building') put(facts, 'gross_sqft', positive(row.RESFLRAREA));
  put(facts, 'market_value', positive(row.cntmarval));
  put(facts, 'market_land_value', positive(row.LNDVALUE));
  put(facts, 'market_building_value', positive(row.bldgvalue));
  put(facts, 'assessed_value', positive(row.CNTASSDVAL));
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: '', zip: null }, facts };
}

async function* build({ work }) {
  const about = await getJson(`${LAYER}?f=json`, 'The layer\'s description');
  const asOf = isoDate(about.editingInfo?.dataLastEditDate || about.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The layer no longer says when it changed');
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'oh-summit', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
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
    fips: FIPS, state: 'OH', name: COUNTY, publisher: 'Summit County Fiscal Office', dataset: 'tax parcels', method: 'county', source: 'oh-summit', as_of: asOf, stale_after_days: 730, extra_zips: zipsByCounty(work, ['39']).get(FIPS) || [], records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: [LAYER],
    facts: { year_built: 'RESYRBLT', living_sqft: 'RESFLRAREA', gross_sqft: 'RESFLRAREA', stories: 'FLOORCOUNT', market_value: 'cntmarval', market_land_value: 'LNDVALUE', market_building_value: 'bldgvalue', assessed_value: 'CNTASSDVAL', legal_description: 'PRPRTYDSCRP', municipality: 'CVTTXDSCRP' },
  },
};
