'use strict';
// Deschutes County, Oregon: the Assessor's daily taxlot tables, which the county says are free to download and use. Year built, area, bedrooms,
// baths, garage, real market values and sales. The owner and mailing tables are never asked for, nor the seller and buyer columns.
// Oregon's assessed value is capped and lags the market; RMV is the county's real market value.

const path = require('node:path');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '41017';
const COUNTY = 'Deschutes County';
const SERVICE = 'https://services1.arcgis.com/znO8Hz1SuVVohYhZ/arcgis/rest/services/Taxlots/FeatureServer';
const ACCOUNT = `${SERVICE}/1`;
const IMPROVEMENTS = `${SERVICE}/3`;
const VALUES = `${SERVICE}/7`;
const SALES = `${SERVICE}/8`;
const ACCOUNT_COLUMNS = ['TaxLot', 'Address', 'House_Number', 'Direction', 'Street_Name', 'Street_Type', 'Unit_Number', 'City', 'Zip', 'Subdivision'];
const BUILDING_COLUMNS = ['Taxlot', 'Land_Size_Acres', 'Year_Appr', 'Property_Class', 'Stat_Class_1', 'Stat_Class_Desc_1', 'Total_Sqft_1', 'Year_Built_1', 'Garage_Sqft_1', 'Bedrooms', 'Bathrooms'];

function useOf(propertyClass, words, hasUnit) {
  const [c, w] = [String(propertyClass ?? ''), String(words ?? '').toUpperCase()];
  if (/MANUF|MOBILE/.test(w)) return ['property', 'mobile_home'];
  if (/CONDO/.test(w)) return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (/TOWN/.test(w)) return ['property', 'townhouse'];
  if (/DUPLEX|TRIPLEX|FOURPLEX|MULTI/.test(w)) return ['building', 'multi_unit'];
  if (/^7/.test(c)) return ['building', 'apartment'];
  if (/WIDE/.test(w)) return ['property', 'mobile_home'];
  if (/STORY|SPLIT|LEVEL/.test(w)) return hasUnit ? ['unit', 'condo'] : ['property', 'house'];
  if (c.endsWith('0') || !c || !w) return ['parcel', null];
  return ['other', null];
}

function fromAccount(row, building, value, sale, valueYear) {
  const unit = realUnit(row.Unit_Number);
  const address = streetParts({ number: row.House_Number, pre: row.Direction, name: row.Street_Name, suffix: row.Street_Type, unit });
  const parcel = word(row.TaxLot);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(building?.Property_Class, building?.Stat_Class_Desc_1, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(word(row.Address), row.Unit_Number));
  put(facts, 'land_use', word(building?.Stat_Class_Desc_1));
  put(facts, 'property_class', word(building?.Property_Class));
  put(facts, 'subdivision', word(row.Subdivision));
  if (building && (home || kind === 'building')) put(facts, 'year_built', year(building.Year_Built_1));
  if (building && home) {
    put(facts, 'living_sqft', positive(building.Total_Sqft_1));
    put(facts, 'bedrooms', positive(building.Bedrooms));
    put(facts, 'bathrooms', positive(building.Bathrooms));
    put(facts, 'garage_sqft', positive(building.Garage_Sqft_1));
  } else if (building && kind === 'building') put(facts, 'gross_sqft', positive(building.Total_Sqft_1));
  if (building && kind !== 'unit') put(facts, 'lot_acres', positive(building.Land_Size_Acres));
  if (value) {
    put(facts, 'value_year', valueYear);
    put(facts, 'market_value', positive(value.RMV_Total));
    put(facts, 'market_land_value', positive(value.RMV_Land));
    put(facts, 'market_building_value', positive(value.RMV_Impr));
    put(facts, 'assessed_value', positive(value.AV_Total));
  }
  if (sale) {
    facts.sale_price = sale.price;
    facts.sale_date = sale.date;
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.City) || '').toUpperCase(), zip: zipCode(row.Zip) }, facts };
}

async function* build({ work, today }) {
  const about = await getJson(`${ACCOUNT}?f=json`, 'The table\'s description');
  const asOf = isoDate(about.editingInfo?.dataLastEditDate || about.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The table no longer says when it changed');
  const buildings = new Map();
  let valueYear = null;
  for await (const row of cached(path.join(work, 'or-deschutes', 'improvements.jsonl.gz'), () => layerRows(IMPROVEMENTS, BUILDING_COLUMNS))) {
    buildings.set(row.Taxlot, row);
    if (positive(row.Year_Appr) > (valueYear || 0) && positive(row.Year_Appr) <= today.getFullYear() + 1) valueYear = positive(row.Year_Appr);
  }
  const values = new Map();
  for await (const row of cached(path.join(work, 'or-deschutes', 'values.jsonl.gz'), () => layerRows(VALUES, ['Taxlot', 'RMV_Land', 'RMV_Impr', 'RMV_Total', 'AV_Total']))) values.set(row.Taxlot, row);
  const sales = new Map();
  for await (const row of cached(path.join(work, 'or-deschutes', 'sales.jsonl.gz'), () => layerRows(SALES, ['Taxlot', 'Reject_Code_1', 'Total_Sales_Price_1', 'Sales_Date_1']))) {
    const [date, price] = [isoDate(row.Sales_Date_1), positive(row.Total_Sales_Price_1)];
    if (date && price > 100) sales.set(row.Taxlot, { date, price });
  }
  log(`${buildings.size} taxlots with improvements, ${values.size} with values, ${sales.size} with a sale`);
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'or-deschutes', 'accounts.jsonl.gz'), () => layerRows(ACCOUNT, ACCOUNT_COLUMNS))) {
    const record = fromAccount(row, buildings.get(row.TaxLot), values.get(row.TaxLot), sales.get(row.TaxLot), valueYear);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} taxlots, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'OR', name: COUNTY, publisher: 'Deschutes County Assessor', dataset: 'taxlot tables', method: 'county', source: 'or-deschutes', as_of: asOf, stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: [IMPROVEMENTS, VALUES, SALES],
    facts: { year_built: 'Year_Built_1', living_sqft: 'Total_Sqft_1', gross_sqft: 'Total_Sqft_1', bedrooms: 'Bedrooms', bathrooms: 'Bathrooms', garage_sqft: 'Garage_Sqft_1', lot_acres: 'Land_Size_Acres', value_year: 'Year_Appr', market_value: 'RMV_Total', market_land_value: 'RMV_Land', market_building_value: 'RMV_Impr', assessed_value: 'AV_Total', sale_price: 'Total_Sales_Price_1', sale_date: 'Sales_Date_1', land_use: 'Stat_Class_Desc_1', property_class: 'Property_Class' },
  },
};
