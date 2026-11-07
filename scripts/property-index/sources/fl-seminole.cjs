'use strict';
// Seminole County, Florida: the Property Appraiser's GIS and Appraisal Data Downloads, current-year files updated daily. Year built, living area, bedrooms,
// baths, floors, zoning, just values and sales. The state's roll has no bedrooms or baths. The mailing file isn't opened; the parcel table's owner, mailing,
// homestead and exemption columns are never read. Assessed and taxable values are left out: the distance from just value can say a home has a homestead
// exemption. The address column runs the street, city, state and ZIP together, so the county's city names split them.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { download, zipDates, zipTable } = require('../lib/tables.cjs');
const { year, isoDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { lotNumber } = require('../lib/legal.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '12117';
const COUNTY = 'Seminole County';
const FILE = 'https://files.scpafl.org/data/cama/SeminoleCounty.zip';
const COLUMNS = ['Parcel', 'PrimaryAddress', 'PrimaryPropertyType', 'VacantImproved', 'LegalDescription', 'Subdivision', 'TaxDistrict', 'DORCode', 'Zoning', 'BuildingCount', 'YearBuilt', 'MaxEffectiveYearBlt', 'TotalJustValue', 'AppraisedBuildingValue', 'AppraisedLandValue', 'TotalGrossArea', 'TotalLivingArea', 'TotalBedrooms', 'TotalBathrooms', 'MaxBaseFloors', 'Pool', 'SUM_GISAcres'];
// Deeds that move no home at a price: a quit claim, a correction, an affidavit, a lease, a right of way, an order of taking.
const NOT_A_DEED_OF_SALE = new Set(['QD', 'CR', 'AF', 'LE', 'RW', 'OT', 'OR']);
const CITIES = 'ALTAMONTE SPRINGS|APOPKA|CASSELBERRY|CHULUOTA|FERN PARK|GENEVA|GOLDENROD|HEATHROW|LAKE MARY|LAKE MONROE|LONGWOOD|MAITLAND|MIDWAY|OSTEEN|OVIEDO|SANFORD|WINTER PARK|WINTER SPRINGS|ORLANDO';
const SITUS = new RegExp(`^(.*?)\\s+(${CITIES})\\s+FL\\s+(\\d{5})`, 'i');

function useOf(words, hasUnit) {
  const code = /^(\d+)/.exec(String(words ?? '').trim())?.[1] || '';
  if (code === '0103') return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (code.startsWith('01')) return hasUnit ? ['unit', 'condo'] : ['property', 'house'];
  if (code.startsWith('02')) return ['property', 'mobile_home'];
  if (code.startsWith('04')) return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (code.startsWith('08')) return ['building', 'multi_unit'];
  if (code.startsWith('03')) return ['building', 'apartment'];
  if (code.startsWith('00')) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const number = positive(value);
  return number && number <= most ? number : null;
};

function fromRow(row, sale, files) {
  const situs = SITUS.exec(String(row.PrimaryAddress ?? '').replace(/\s+/g, ' ').trim());
  const address = situs ? parse(situs[1]) : null;
  const parcel = word(row.Parcel);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.DORCode, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(situs[1]));
  put(facts, 'land_use', word(String(row.DORCode ?? '').replace(/^\d+\s*-\s*/, '')));
  put(facts, 'county_use_code', /^\d+/.exec(String(row.DORCode ?? '').trim())?.[0]);
  put(facts, 'subdivision', word(row.Subdivision));
  put(facts, 'zoning', word(row.Zoning));
  put(facts, 'legal_description', word(row.LegalDescription)?.slice(0, 300));
  put(facts, 'lot_number', lotNumber(row.LegalDescription));
  put(facts, 'tax_code_area', word(row.TaxDistrict));
  put(facts, 'property_class', word(row.PrimaryPropertyType));
  const district = files.districts.get(row.Parcel);
  if (district) facts.municipality = /^COUNTY/i.test(district) ? 'Unincorporated Seminole County' : district;
  const one = !(positive(row.BuildingCount) > 1);
  const main = files.buildings.get(row.Parcel);
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.YearBuilt));
    put(facts, 'effective_year_built', year(row.MaxEffectiveYearBlt));
    put(facts, 'stories', inRange(row.MaxBaseFloors, 120));
    if (!one) facts.buildings_on_parcel = positive(row.BuildingCount);
    put(facts, 'exterior_walls', word(main?.ExteriorWallType));
    put(facts, 'building_type', word(main?.BuildingType));
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.TotalLivingArea));
    put(facts, 'bedrooms', inRange(row.TotalBedrooms, 15));
    put(facts, 'bathrooms', inRange(row.TotalBathrooms, 20));
    if (one) {
      put(facts, 'gross_sqft', positive(row.TotalGrossArea));
      if (kind === 'property') put(facts, 'ground_floor_sqft', positive(main?.BaseArea));
    }
    const features = files.features.get(row.Parcel);
    put(facts, 'fireplaces', features?.fireplaces || null);
    if (features?.carport) facts.parking_type = 'Carport';
    if (String(row.Pool ?? '').trim() === 'True' || features?.pool) facts.pool = 'Yes';
  } else if (kind === 'building') put(facts, 'gross_sqft', positive(row.TotalGrossArea) || positive(row.TotalLivingArea));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.SUM_GISAcres));
  put(facts, 'market_value', positive(row.TotalJustValue));
  put(facts, 'market_land_value', positive(row.AppraisedLandValue));
  put(facts, 'market_building_value', positive(row.AppraisedBuildingValue));
  if (sale) {
    facts.sale_price = sale.price;
    facts.sale_date = sale.date;
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: situs[2].toUpperCase(), zip: zipCode(situs[3]) }, facts };
}

async function* build({ work }) {
  const zip = path.join(work, 'fl-seminole', 'SeminoleCounty.zip');
  download(FILE, zip);
  const asOf = zipDates(zip).get('Parcels.csv');
  if (!asOf) throw new Error('The file no longer says when it was made');
  const sales = new Map();
  for await (const row of zipTable(zip, 'AllSales.csv', ['Parcel', 'SaleDate', 'SaleAmt', 'DeedType', 'QualificationDescription'])) {
    const [date, price] = [isoDate(row.SaleDate), positive(row.SaleAmt)];
    if (!date || !isHomeSale(price, row.QualificationDescription) || NOT_A_DEED_OF_SALE.has(row.DeedType.trim()) || /MULTI/i.test(row.QualificationDescription)) continue;
    const held = sales.get(row.Parcel);
    if (!held || held.date < date) sales.set(row.Parcel, { date, price });
  }
  log(`${sales.size} parcels with a sale`);
  // The main building on each parcel: the one with the most living area.
  const buildings = new Map();
  for await (const row of zipTable(zip, 'buildings.csv', ['Parcel', 'ExteriorWallType', 'BuildingType', 'BaseArea', 'LivingArea'])) {
    const held = buildings.get(row.Parcel);
    if (!held || Number(row.LivingArea) > Number(held.LivingArea)) buildings.set(row.Parcel, row);
  }
  const features = new Map();
  for await (const row of zipTable(zip, 'ExtraFeature.csv', ['Parcel', 'Description', 'NumUnits'])) {
    const text = row.Description.trim();
    const fireplace = /^FIREPLACE \d$/.test(text);
    const carport = /^CARPORT \d$/.test(text);
    const pool = /^POOL \d$/.test(text);
    if (!fireplace && !carport && !pool) continue;
    if (!features.has(row.Parcel)) features.set(row.Parcel, { fireplaces: 0 });
    const held = features.get(row.Parcel);
    if (fireplace) held.fireplaces += positive(row.NumUnits) || 1;
    if (carport) held.carport = true;
    if (pool) held.pool = true;
  }
  // The taxing district a parcel's bill names: a city's, or the county's for unincorporated land.
  const districts = new Map();
  for await (const row of zipTable(zip, 'Taxes.csv', ['Parcel', 'TaxDistrictDescription'])) {
    if (!districts.has(row.Parcel)) districts.set(row.Parcel, word(row.TaxDistrictDescription.replace(/-.*$/, '')));
  }
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of zipTable(zip, 'Parcels.csv', COLUMNS)) {
    const record = fromRow(row, sales.get(row.Parcel), { buildings, features, districts });
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'FL', name: COUNTY, publisher: 'Seminole County Property Appraiser', dataset: 'appraisal data', method: 'county', source: 'fl-seminole', as_of: asOf, stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    columns: COLUMNS.concat(['SaleAmt', 'SaleDate']),
    facts: { year_built: 'YearBuilt', stories: 'MaxBaseFloors', buildings_on_parcel: 'BuildingCount', living_sqft: 'TotalLivingArea', gross_sqft: 'TotalLivingArea', bedrooms: 'TotalBedrooms', bathrooms: 'TotalBathrooms', lot_acres: 'SUM_GISAcres', market_value: 'TotalJustValue', market_land_value: 'AppraisedLandValue', market_building_value: 'AppraisedBuildingValue', sale_price: 'SaleAmt', sale_date: 'SaleDate', zoning: 'Zoning', subdivision: 'Subdivision', land_use: 'DORCode', legal_description: 'LegalDescription' },
  },
};
