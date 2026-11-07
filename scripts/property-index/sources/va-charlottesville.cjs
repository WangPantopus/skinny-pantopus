'use strict';
// Charlottesville, Virginia: the city's open real estate tables, CC BY 4.0, credit the City of Charlottesville. Year built, rooms, bedrooms, baths,
// area, stories, style, walls, roof, heat, assessed values and sales. Virginia's independent city is its own county here. The tables have no
// owner columns and no ZIP, so the city's ZIPs come from the Census.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, realUnit, onRecord } = require('../lib/addresses.cjs');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '51540';
const COUNTY = 'Charlottesville city';
const SERVICE = 'https://gisweb.charlottesville.org/arcgis/rest/services/OpenData_2/MapServer';
const DETAILS = ['ParcelNumber', 'UseCode', 'Bedrooms', 'FullBathrooms', 'HalfBathrooms', 'TotalRooms', 'Fireplace', 'Style', 'ExternalWalls', 'Roof', 'Heating', 'Flooring', 'NumberOfStories', 'SquareFootageFinishedLiving', 'FinishedBasement', 'YearBuilt'];

function useOf(use, hasUnit) {
  const u = String(use ?? '').trim();
  if (/^Condominium$/i.test(u)) return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (/^Single Family Attached$/i.test(u)) return ['property', 'townhouse'];
  if (/^Single Family/i.test(u)) return ['property', 'house'];
  if (/^Duplex|Triplex|Fourplex/i.test(u)) return ['building', 'multi_unit'];
  if (/Apartment/i.test(u)) return ['building', 'apartment'];
  if (/^Vacant/i.test(u)) return ['parcel', null];
  return ['other', null];
}

function fromBase(row, details, value, sale) {
  const street = [word(row.StreetNumber), word(row.StreetName)].filter(Boolean).join(' ');
  const address = street ? parse(street, realUnit(row.Unit)) : null;
  const parcel = word(row.ParcelNumber);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(details?.UseCode, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(street, row.Unit));
  put(facts, 'land_use', word(details?.UseCode));
  put(facts, 'zoning', word(row.Zone));
  put(facts, 'legal_description', word(row.Legal)?.slice(0, 300));
  if (details && (home || kind === 'building')) {
    put(facts, 'year_built', year(details.YearBuilt));
    put(facts, 'style', word(details.Style));
    put(facts, 'stories', positive(details.NumberOfStories));
    put(facts, 'exterior_walls', word(details.ExternalWalls));
    put(facts, 'roof_cover', word(details.Roof));
    put(facts, 'heating', word(details.Heating));
  }
  if (details && home) {
    put(facts, 'living_sqft', positive(details.SquareFootageFinishedLiving));
    put(facts, 'rooms', positive(details.TotalRooms));
    put(facts, 'bedrooms', positive(details.Bedrooms));
    const [full, half] = [positive(details.FullBathrooms), positive(details.HalfBathrooms)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
    put(facts, 'fireplaces', positive(details.Fireplace));
    put(facts, 'basement_finished_sqft', positive(details.FinishedBasement));
    put(facts, 'flooring', word(details.Flooring));
  } else if (details && kind === 'building') put(facts, 'gross_sqft', positive(details.SquareFootageFinishedLiving));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.Acreage));
  put(facts, 'assessed_value', positive(value));
  if (sale) {
    facts.sale_price = sale.price;
    facts.sale_date = sale.date;
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: 'CHARLOTTESVILLE', zip: null }, facts };
}

async function* build({ work, today }) {
  const details = new Map();
  for await (const row of cached(path.join(work, 'va-charlottesville', 'details.jsonl.gz'), () => layerRows(`${SERVICE}/17`, DETAILS, { oid: 'RecordID_Int' }))) {
    if (!details.has(row.ParcelNumber)) details.set(row.ParcelNumber, row);
  }
  const values = new Map();
  for await (const row of cached(path.join(work, 'va-charlottesville', 'values.jsonl.gz'), () => layerRows(`${SERVICE}/1`, ['ParcelNumber', 'CurrentAssessedValue'], { oid: 'OBJECTID' }))) values.set(row.ParcelNumber, row.CurrentAssessedValue);
  const sales = new Map();
  for await (const row of cached(path.join(work, 'va-charlottesville', 'sales.jsonl.gz'), () => layerRows(`${SERVICE}/3`, ['ParcelNumber', 'SaleAmount', 'SaleDate'], { oid: 'RecordID_Int' }))) {
    const [date, price] = [isoDate(row.SaleDate), positive(row.SaleAmount)];
    if (!date || !(price > 100)) continue;
    const held = sales.get(row.ParcelNumber);
    if (!held || held.date < date) sales.set(row.ParcelNumber, { date, price });
  }
  log(`${details.size} parcels with details, ${values.size} with values, ${sales.size} with a sale`);
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'va-charlottesville', 'base.jsonl.gz'), () => layerRows(`${SERVICE}/8`, ['ParcelNumber', 'StreetNumber', 'StreetName', 'Unit', 'Zone', 'Legal', 'Acreage'], { oid: 'RecordID_Int' }))) {
    const record = fromBase(row, details.get(row.ParcelNumber), values.get(row.ParcelNumber), sales.get(row.ParcelNumber));
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'VA', name: COUNTY, publisher: 'City of Charlottesville', dataset: 'real estate tables', method: 'county', source: 'va-charlottesville', as_of: today.toISOString().slice(0, 10), stale_after_days: 450, extra_zips: zipsByCounty(work, ['51']).get(FIPS) || [], records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: [`${SERVICE}/17`, `${SERVICE}/1`, `${SERVICE}/3`, `${SERVICE}/8`],
    facts: { year_built: 'YearBuilt', style: 'Style', stories: 'NumberOfStories', exterior_walls: 'ExternalWalls', roof_cover: 'Roof', heating: 'Heating', living_sqft: 'SquareFootageFinishedLiving', gross_sqft: 'SquareFootageFinishedLiving', rooms: 'TotalRooms', bedrooms: 'Bedrooms', full_baths: 'FullBathrooms', half_baths: 'HalfBathrooms', fireplaces: 'Fireplace', basement_finished_sqft: 'FinishedBasement', flooring: 'Flooring', lot_acres: 'Acreage', assessed_value: 'CurrentAssessedValue', sale_price: 'SaleAmount', sale_date: 'SaleDate', zoning: 'Zone', land_use: 'UseCode', legal_description: 'Legal' },
  },
};
