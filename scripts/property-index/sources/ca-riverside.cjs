'use strict';
// Riverside County, California: the county's Mapping and Spatial Data Portal, the Assessor's CREST tables in its OpenData
// service. The portal states no terms or restriction. The general, property and tax tables hold no owner or mailing columns;
// the parcel layers do, and only their parcel number, acreage and subdivision are asked for. Exemption columns aren't asked
// for. Values are Proposition 13 assessed values, never market values. No sale prices.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '06065';
const COUNTY = 'Riverside County';
const SERVICE = 'https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer';
const GENERAL_COLUMNS = ['PIN', 'GEO_CD', 'CLASS_CODE', 'STREET_NAME', 'STREET_TYPE', 'STREET_PREDIRECTIONAL', 'STREET_NUMBER', 'STREET_NUMBER_SFX', 'UNIT_NUMBER', 'CITY', 'POSTAL_CD'];
const BUILDING_COLUMNS = ['PIN', 'YEAR_BUILT', 'NUMBER_OF_STORIES', 'ROOF_TYPE', 'GARAGE_TYPE', 'GARAGE_SIZE', 'CARPORT_SIZE', 'BATH_COUNT', 'CENTRAL_HEATING', 'CENTRAL_COOLING', 'DESIGN_TYPE', 'CONSTRUCTION_TYPE', 'LIVING_AREA', 'ACTUAL_AREA', 'HAS_POOL', 'BEDROOM_COUNT'];
const TAX_COLUMNS = ['PIN', 'TAX_YEAR', 'PRIMARY_TAG', 'SECONDARY_TAG', 'LAND', 'STRUCTURES'];
const PARCEL_COLUMNS = ['APN', 'ACREAGE', 'SUBDIVISION_NAME'];

const YES = /^(YES|Y|1)$/i;
// A building row that isn't where anyone lives.
const NOT_A_HOME = /GARAGE|COMMERCIAL|MISCELLANEOUS|AGRICULTURAL|TIMESHARE|GUESTHOUSE/i;

function useOf(words, unit, onCondoMap) {
  const use = String(words || '').toUpperCase().replace(/^(CT|AP|MA|PI|AG)\s*-\s*/, '');
  if (/^(CONDO OR PUD|RESIDENTIAL CONDOMINIUM|COOPERATIVE)$/.test(use)) return unit || onCondoMap ? ['unit', 'condo'] : ['property', 'house'];
  if (/^VACANT|^COMMON AREA|^RESIDENTIAL COMMON AREA|CONSERVATION EASEMENT|^MH LAND \/ NO IMPROVEMENTS/.test(use)) return ['parcel', null];
  if (/^(DUPLEX|TRIPLEX|FOURPLEX)$/.test(use) || use === 'MULTIPLE LIVING UNITS (MH)') return ['building', 'multi_unit'];
  if (/^APARTMENT/.test(use)) return ['building', 'apartment'];
  if (/^MH (ON FOUNDATION|LOT WITH MH|\(LPT\))/.test(use) || /WITH MH( |$)/.test(use)) return ['property', 'mobile_home'];
  if (/^(SINGLE FAMILY DWELLING|HOMESITE|SFD WITH|RESIDENTIAL EXCEPTIONAL|RESIDENTIAL RESTRICTED|FACTORY BUILT SFD|RESIDENTIAL USE ZONED COMMERCIAL)/.test(use) || /WITH SFR$/.test(use)) return ['property', 'house'];
  if (/^(AGRICULTURAL LAND|IRRIGATED FARMLAND|NON-IRRIGATED FARMLAND|CITRUS GROVE|AVOCADO GROVE|DATE GARDEN)/.test(use)) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};
const roofWord = (text) => {
  const value = word(text);
  return value && !/^(UNKNOWN|OTHER|OTHER APARTMENT UNIT)$/i.test(value) ? value : null;
};

function fromRow(row, { buildings, tax, parcel, onCondoMap }) {
  const unit = realUnit(word(row.UNIT_NUMBER));
  const [post, fraction] = /^[NSEW]$/i.test(word(row.STREET_NUMBER_SFX) || '') ? [word(row.STREET_NUMBER_SFX), ''] : ['', word(row.STREET_NUMBER_SFX) || ''];
  const address = streetParts({ number: row.STREET_NUMBER, numberSuffix: fraction, pre: word(row.STREET_PREDIRECTIONAL) || '', name: word(row.STREET_NAME) || '', suffix: word(row.STREET_TYPE) || '', post, unit });
  const account = word(row.PIN);
  if (!address || !account) return null;
  const [kind, homeType] = useOf(row.CLASS_CODE, address.unit, onCondoMap);
  const facts = { parcel_number: word(row.GEO_CD) || account, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([row.STREET_NUMBER, row.STREET_PREDIRECTIONAL, row.STREET_NAME, row.STREET_TYPE, row.STREET_NUMBER_SFX].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'land_use', word(row.CLASS_CODE));
  put(facts, 'subdivision', word(parcel?.SUBDIVISION_NAME));
  if (tax) put(facts, 'tax_code_area', word(tax.PRIMARY_TAG) && word(tax.SECONDARY_TAG) ? `${word(tax.PRIMARY_TAG)}${word(tax.SECONDARY_TAG)}` : null);
  // One row per building: the largest one somebody lives in is the home.
  const lived = (buildings || []).filter((building) => positive(building.LIVING_AREA) && !NOT_A_HOME.test(building.DESIGN_TYPE || ''));
  const main = lived.sort((a, b) => Number(b.LIVING_AREA) - Number(a.LIVING_AREA))[0];
  const on = main && (home || kind === 'building');
  if (on) {
    put(facts, 'year_built', year(main.YEAR_BUILT));
    put(facts, 'building_type', word(main.DESIGN_TYPE));
    put(facts, 'frame', word(main.CONSTRUCTION_TYPE)?.replace(/\s*\([A-Z]\)$/, ''));
    put(facts, 'stories', inRange(main.NUMBER_OF_STORIES, kind === 'building' ? 40 : 6));
    put(facts, 'roof_cover', roofWord(main.ROOF_TYPE));
    if (lived.length > 1) facts.buildings_on_parcel = lived.length;
  }
  if (home && main) {
    put(facts, 'living_sqft', positive(main.LIVING_AREA));
    put(facts, 'gross_sqft', positive(main.ACTUAL_AREA));
    put(facts, 'bedrooms', inRange(main.BEDROOM_COUNT, 15));
    put(facts, 'bathrooms', inRange(main.BATH_COUNT, 15));
    put(facts, 'garage', word(main.GARAGE_TYPE));
    put(facts, 'garage_sqft', positive(main.GARAGE_SIZE));
    put(facts, 'carport_sqft', positive(main.CARPORT_SIZE));
    if (YES.test(main.CENTRAL_HEATING || '')) facts.heating = 'Central';
    if (YES.test(main.CENTRAL_COOLING || '')) facts.cooling = 'Central';
    if (YES.test(main.HAS_POOL || '')) facts.pool = 'Yes';
  }
  if (kind !== 'unit') put(facts, 'lot_acres', positive(parcel?.ACREAGE));
  if (tax) {
    const [land, structures] = [positive(tax.LAND), positive(tax.STRUCTURES)];
    put(facts, 'value_year', positive(tax.TAX_YEAR));
    put(facts, 'assessed_land_value', land);
    put(facts, 'assessed_building_value', structures);
    put(facts, 'assessed_value', (land || 0) + (structures || 0) || null);
  }
  return { id: `pp:${kind}:${FIPS}:${account}`, kind, home_type: homeType, address: { ...address, city: String(word(row.CITY) || '').toUpperCase(), zip: zipCode(row.POSTAL_CD) }, facts };
}

async function* build({ work, today }) {
  const dir = path.join(work, 'ca-riverside');
  const buildings = new Map();
  for await (const row of cached(path.join(dir, 'buildings.jsonl.gz'), () => layerRows(`${SERVICE}/80`, BUILDING_COLUMNS))) {
    if (!buildings.has(row.PIN)) buildings.set(row.PIN, []);
    buildings.get(row.PIN).push(row);
  }
  const taxes = new Map();
  for await (const row of cached(path.join(dir, 'tax.jsonl.gz'), () => layerRows(`${SERVICE}/100`, TAX_COLUMNS))) taxes.set(row.PIN, row);
  const parcels = new Map();
  for await (const row of cached(path.join(dir, 'parcels.jsonl.gz'), () => layerRows(`${SERVICE}/50`, PARCEL_COLUMNS))) parcels.set(row.APN, row);
  const condoMap = new Set();
  for await (const row of cached(path.join(dir, 'condos.jsonl.gz'), () => layerRows(`${SERVICE}/30`, PARCEL_COLUMNS))) {
    condoMap.add(row.APN);
    if (!parcels.has(row.APN)) parcels.set(row.APN, row);
  }
  log(`${buildings.size} accounts with buildings, ${taxes.size} with values, ${parcels.size} parcels, ${condoMap.size} on condo maps`);
  const records = [];
  const seen = new Set();
  let [noAddress, personal] = [0, 0];
  for await (const row of cached(path.join(dir, 'general.jsonl.gz'), () => layerRows(`${SERVICE}/70`, GENERAL_COLUMNS))) {
    // Business equipment, boats and aircraft: never a home, and they'd crowd the address of one.
    if (/^(PP |BOAT|AIRCRAFT)/i.test(row.CLASS_CODE || '')) {
      personal += 1;
      continue;
    }
    const record = fromRow(row, { buildings: buildings.get(row.PIN), tax: taxes.get(row.PIN), parcel: parcels.get(row.GEO_CD), onCondoMap: condoMap.has(row.GEO_CD) });
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} accounts, ${noAddress} without a street number, ${personal} personal property`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'CA', name: COUNTY, publisher: 'Riverside County Assessor', dataset: 'CREST tables, county data portal', method: 'county', source: 'ca-riverside', as_of: isoDate(today.getTime()), stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: [`${SERVICE}/80`, `${SERVICE}/70`, `${SERVICE}/100`, `${SERVICE}/50`],
    facts: { year_built: 'YEAR_BUILT', living_sqft: 'LIVING_AREA', gross_sqft: 'ACTUAL_AREA', bedrooms: 'BEDROOM_COUNT', bathrooms: 'BATH_COUNT', stories: 'NUMBER_OF_STORIES', garage_sqft: 'GARAGE_SIZE', lot_acres: 'ACREAGE', value_year: 'TAX_YEAR', assessed_land_value: 'LAND', assessed_building_value: 'STRUCTURES' },
  },
};
