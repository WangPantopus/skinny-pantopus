'use strict';
// Chesterfield County, Virginia: the county's enriched parcel layer, COGO'd daily from recorded plats, with the Assessor's facts on each parcel. The county
// disclaims errors and asks to hear of inconsistencies; no limit on use stated. Year built, finished area, bedrooms, baths, rooms, stories, fair market
// value (Virginia assesses at full market value), deeded acres and last sale. Owner, mailing and exemption columns are never asked for.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { streetParts, year, isoDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '51041';
const COUNTY = 'Chesterfield County';
const LAYER = 'https://services3.arcgis.com/TsynfzBSE6sXfoLq/ArcGIS/rest/services/Cadastral/FeatureServer/3';
const COLUMNS = ['OBJECTID', 'GPIN', 'Tax_ID', 'House_Num', 'StreetDir', 'StreetName', 'StreetType', 'Zip', 'UseCode', 'Year_Built', 'FinishedArea', 'Bedrooms', 'FullBath', 'HalfBath', 'Stories', 'Rooms', 'DeededAcres', 'FairMarketValue', 'ImprovementValue', 'AssessmentYear', 'SaleDate', 'SalePrice'];

// The Assessor's use codes: SD a single detached house, TH and TN townhouses, CD and CN condominiums, DU a duplex; numbers are commercial.
function useOf(code) {
  const c = String(code || '').trim().toUpperCase();
  if (c === 'SD') return ['property', 'house'];
  if (c === 'TH' || c === 'TN' || c === 'CD' || c === 'CN') return ['property', 'townhouse'];
  if (c === 'DU') return ['building', 'multi_unit'];
  return ['other', null];
}

function fromRow(row) {
  const address = streetParts({ number: row.House_Num, pre: row.StreetDir, name: word(row.StreetName), suffix: word(row.StreetType) });
  const parcel = word(row.GPIN) || word(row.Tax_ID);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.UseCode);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property';
  put(facts, 'address_on_record', onRecord([row.House_Num, row.StreetDir, row.StreetName, row.StreetType].map(word).filter(Boolean).join(' ')));
  put(facts, 'county_use_code', word(row.UseCode));
  if (home || kind === 'building') put(facts, 'year_built', year(row.Year_Built));
  if (home) {
    put(facts, 'living_sqft', positive(row.FinishedArea));
    const beds = positive(row.Bedrooms);
    if (beds && beds <= 15) facts.bedrooms = beds;
    const [full, half] = [positive(row.FullBath), positive(row.HalfBath)];
    if (full && full <= 12) {
      facts.full_baths = full;
      facts.bathrooms = full + (half && half <= 6 ? half * 0.5 : 0);
      put(facts, 'half_baths', half && half <= 6 ? half : null);
    }
    put(facts, 'rooms', positive(row.Rooms) && positive(row.Rooms) <= 40 ? positive(row.Rooms) : null);
    put(facts, 'stories', positive(row.Stories));
  }
  if (kind === 'building') put(facts, 'gross_sqft', positive(row.FinishedArea));
  put(facts, 'lot_acres', positive(row.DeededAcres));
  put(facts, 'value_year', positive(row.AssessmentYear));
  put(facts, 'market_value', positive(row.FairMarketValue));
  put(facts, 'market_building_value', positive(row.ImprovementValue));
  if (positive(row.SalePrice) > 100) {
    put(facts, 'sale_price', positive(row.SalePrice));
    put(facts, 'sale_date', isoDate(row.SaleDate));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: '', zip: zipCode(row.Zip) }, facts };
}

async function* build({ work, today }) {
  const records = new Map();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'va-chesterfield', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS, { pageSize: 1000 }))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (!records.has(record.id)) records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'VA', name: COUNTY, publisher: 'Chesterfield County Assessor', dataset: 'enriched parcels', method: 'county', source: 'va-chesterfield', as_of: isoDate(today.getTime()), stale_after_days: 450, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'Year_Built', living_sqft: 'FinishedArea', gross_sqft: 'FinishedArea', bedrooms: 'Bedrooms', bathrooms: 'FullBath', full_baths: 'FullBath', half_baths: 'HalfBath', rooms: 'Rooms', stories: 'Stories', lot_acres: 'DeededAcres', market_value: 'FairMarketValue', market_building_value: 'ImprovementValue', value_year: 'AssessmentYear', sale_price: 'SalePrice', sale_date: 'SaleDate' },
  },
};
