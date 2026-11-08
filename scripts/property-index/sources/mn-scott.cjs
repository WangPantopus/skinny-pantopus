'use strict';
// Scott County, Minnesota: the county's parcels with each parcel's Assessor facts, on its own ArcGIS Online, kept current by the county's GIS
// office. Its disclaimer (under Minnesota Statutes 466.03, subd. 21) says the data is for reference, isn't guaranteed, and that the user waives
// claims against and indemnifies the county; it states no limit on use. Year built, above-grade living area, finished basement, bedrooms, baths,
// model and style, acres, estimated market values and the last qualified sale. Taxpayer name and address columns are never asked for.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '27139';
const COUNTY = 'Scott County';
const LAYER = 'https://services.arcgis.com/DqIh9WAsIZcPlBEF/arcgis/rest/services/Parcels/FeatureServer/0';
const COLUMNS = ['PID', 'SchoolDistrict', 'CityDistrict', 'PropertyAddress1', 'PropertyCity', 'PropertyZip', 'PlatName', 'GISAcres', 'DeededAcres', 'Legal1', 'AssessmentYear', 'EMVLand', 'EMVImprove', 'EMVTotal', 'Classification', 'ModelDesc', 'ArchitectureDesc', 'NumBathRooms', 'NumBedrooms', 'YearBuilt', 'AGLASqFt', 'BasementFinishedSqft', 'GarageSqft', 'LastSaleDate', 'LastSalePrice', 'Neighborhood', 'SalesQualifier'];

// The Assessor's model names the home; a parcel with none is land (by Minnesota's class: unimproved residential, agricultural) or something else.
function useOf(model, classification, unit) {
  const m = String(model || '').trim().toUpperCase();
  const cls = String(classification || '').trim().split(/\s+/)[0];
  if (m === 'SINGLE-FAMILY') return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (m === 'TOWNHOUSE' || m === 'CONDO') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (m === 'DUPLEX/TRIPLEX') return ['building', 'multi_unit'];
  if (cls === '205') return ['building', 'apartment'];
  if (!m && ['206', '101', '105', '111'].includes(cls)) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function fromRow(row) {
  const parsed = parse(String(row.PropertyAddress1 ?? ''));
  const parcel = word(row.PID);
  if (!parsed || parsed.form !== 'street' || !parsed.number || !parcel) return null;
  const { form, ...street } = parsed;
  const [kind, homeType] = useOf(row.ModelDesc, row.Classification, street.unit);
  const classification = String(row.Classification || '').trim();
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(row.PropertyAddress1, ''));
  put(facts, 'county_use_code', classification.split(/\s+/)[0] || null);
  put(facts, 'property_class', classification.replace(/^\d+\s+/, '') || null);
  put(facts, 'neighborhood', word(row.Neighborhood));
  put(facts, 'subdivision', word(row.PlatName));
  put(facts, 'school_district', word(row.SchoolDistrict));
  put(facts, 'municipality', word(row.CityDistrict));
  put(facts, 'legal_description', word(row.Legal1)?.slice(0, 300));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.YearBuilt));
    put(facts, 'style', word(row.ArchitectureDesc) === 'N/A' ? null : word(row.ArchitectureDesc));
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.AGLASqFt));
    put(facts, 'basement_finished_sqft', positive(row.BasementFinishedSqft));
    put(facts, 'garage_sqft', positive(row.GarageSqft));
    put(facts, 'bedrooms', inRange(row.NumBedrooms, 15));
    put(facts, 'bathrooms', inRange(row.NumBathRooms, 12));
  }
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.DeededAcres) || positive(row.GISAcres));
  put(facts, 'market_value', positive(row.EMVTotal));
  put(facts, 'market_land_value', positive(row.EMVLand));
  put(facts, 'market_building_value', positive(row.EMVImprove));
  put(facts, 'value_year', positive(row.AssessmentYear));
  if (String(row.SalesQualifier || '').trim() === 'Q' && isHomeSale(positive(row.LastSalePrice))) {
    put(facts, 'sale_price', positive(row.LastSalePrice));
    put(facts, 'sale_date', isoDate(row.LastSaleDate));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...street, city: word(row.PropertyCity) || '', zip: zipCode(row.PropertyZip) }, facts };
}

async function* build({ work, today }) {
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  for await (const row of cached(path.join(work, 'mn-scott', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'MN', name: COUNTY, publisher: 'Scott County', dataset: 'parcels with Assessor data', method: 'county', source: 'mn-scott', as_of: isoDate(today.getTime()), stale_after_days: 450, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YearBuilt', living_sqft: 'AGLASqFt', basement_finished_sqft: 'BasementFinishedSqft', garage_sqft: 'GarageSqft', bedrooms: 'NumBedrooms', bathrooms: 'NumBathRooms', lot_acres: 'DeededAcres', market_value: 'EMVTotal', market_land_value: 'EMVLand', market_building_value: 'EMVImprove', value_year: 'AssessmentYear', sale_price: 'LastSalePrice', sale_date: 'LastSaleDate' },
  },
};
