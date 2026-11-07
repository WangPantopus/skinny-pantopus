'use strict';
// Tulsa County, Oklahoma: the Tulsa County Assessor's data on the regional planning council's (INCOG) public map service. No terms are
// stated on it. Owner, mailing and homestead columns are never asked for. TotalAcctValue is the Assessor's fair cash value. It has baths
// but no bedrooms.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '40143';
const COUNTY = 'Tulsa County';
const LAYER = 'https://map11.incog.org/arcgis11wa/rest/services/Parcels_TulsaCo/FeatureServer/0';
const COLUMNS = ['ACCT_NUM', 'AccountNo', 'ParcelNo', 'AcctType', 'UseCode', 'SiteCity', 'LoadDate', 'PropertyAddress', 'PropertyZIP', 'PropertyCity', 'Legal', 'Neighborhood', 'SaleDate', 'ValidFlag', 'PropertyType', 'Quality', 'Condition', 'YearBuilt', 'Exterior', 'Foundation', 'BasementSF', 'FinishedBasementSF', 'GarageSF', 'PoolSF', 'GrossAcre', 'SalePrice', 'Baths', 'Stories', 'TotalImpValue', 'TotalLandValue', 'TotalAcctValue', 'TaxableValue', 'SF', 'Units', 'UnitsTotal', 'ReceptionNo'];

function useOf(row, unit) {
  const type = String(row.PropertyType || '').toUpperCase();
  if (type === 'RESIDENTIAL') return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (type === 'CONDO') return ['unit', 'condo'];
  if (type === 'TOWNHOUSE') return ['property', 'townhouse'];
  if (type === 'MOBILE HOME') return ['property', 'mobile_home'];
  if (type === 'DUPLEX' || type === 'TRIPLEX') return ['building', 'multi_unit'];
  if (type === 'MULTIPLE UNIT') return ['building', 'apartment'];
  return !type && /^RESIDENTIAL$/i.test(row.AcctType || '') ? ['parcel', null] : ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};
const WORDS = { Avg: 'Average', 'Avg +': 'Average plus', 'Fair +': 'Fair plus', 'Good +': 'Good plus', 'Very Good +': 'Very good plus' };
const foundationOf = (text) => {
  const value = word(text);
  return value && !/^\d+$/.test(value) && !/^OTHER$/i.test(value) ? value : null;
};

function fromRow(row) {
  const line = word(row.PropertyAddress);
  const address = line ? parse(line) : null;
  const account = word(row.AccountNo) || word(row.ACCT_NUM);
  if (!address || !account) return null;
  const [kind, homeType] = useOf(row, address.unit);
  const facts = { parcel_number: account, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', line);
  put(facts, 'land_use', word(row.PropertyType));
  put(facts, 'property_class', word(row.AcctType));
  put(facts, 'county_use_code', word(row.UseCode));
  put(facts, 'neighborhood', word(row.Neighborhood));
  put(facts, 'legal_description', word(row.Legal)?.slice(0, 300));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.YearBuilt));
    put(facts, 'stories', inRange(row.Stories, kind === 'building' ? 40 : 6));
    put(facts, 'exterior_walls', word(row.Exterior));
    put(facts, 'foundation', foundationOf(row.Foundation));
    put(facts, 'quality', word(row.Quality));
    const condition = word(row.Condition);
    put(facts, 'condition', WORDS[condition] || condition);
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.SF));
    put(facts, 'bathrooms', inRange(row.Baths, 15));
    put(facts, 'basement_sqft', positive(row.BasementSF));
    put(facts, 'basement_finished_sqft', positive(row.FinishedBasementSF));
    put(facts, 'garage_sqft', positive(row.GarageSF));
    if (positive(row.PoolSF)) facts.pool = 'Yes';
  }
  if (kind === 'building') put(facts, 'units', positive(row.UnitsTotal) || positive(row.Units));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.GrossAcre));
  put(facts, 'market_value', positive(row.TotalAcctValue));
  put(facts, 'market_land_value', positive(row.TotalLandValue));
  put(facts, 'market_building_value', positive(row.TotalImpValue));
  put(facts, 'taxable_value', positive(row.TaxableValue));
  if (positive(row.SalePrice) > 100) {
    facts.sale_price = positive(row.SalePrice);
    put(facts, 'sale_date', isoDate(row.SaleDate));
    put(facts, 'sale_document', word(row.ReceptionNo));
  }
  return { id: `pp:${kind}:${FIPS}:${account}`, kind, home_type: homeType, address: { ...address, city: String(word(row.PropertyCity) || '').toUpperCase(), zip: zipCode(row.PropertyZIP) }, facts };
}

async function* build({ work, today }) {
  const records = [];
  const seen = new Set();
  let [noAddress, newest] = [0, 0];
  for await (const row of cached(path.join(work, 'ok-tulsa', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    newest = Math.max(newest, Number(row.LoadDate) || 0);
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
    fips: FIPS, state: 'OK', name: COUNTY, publisher: 'Tulsa County Assessor, through INCOG', dataset: 'parcels', method: 'county', source: 'ok-tulsa', as_of: isoDate(newest) || isoDate(today.getTime()), stale_after_days: 400, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YearBuilt', living_sqft: 'SF', bathrooms: 'Baths', stories: 'Stories', units: 'UnitsTotal', basement_sqft: 'BasementSF', garage_sqft: 'GarageSF', lot_acres: 'GrossAcre', market_value: 'TotalAcctValue', market_land_value: 'TotalLandValue', market_building_value: 'TotalImpValue', taxable_value: 'TaxableValue', sale_price: 'SalePrice', sale_date: 'SaleDate' },
  },
};
