'use strict';
// Montgomery County, Pennsylvania: the county's parcels, "a free and open resource" on its open data site. The layer carries owner
// and mailing columns; they're never asked for. Pennsylvania counties assess on an old base year, so these are assessed values,
// never market values. The county publishes the layer's codes (its "Parcel Codes" sheet, item below); residential heat and condition
// aren't on it, so they stay out until someone reads them off the county's page. Numbers need no words.

const path = require('node:path');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit, streetParts } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '42091';
const COUNTY = 'Montgomery County';
const LAYER = 'https://services1.arcgis.com/kOChldNuKsox8qZD/arcgis/rest/services/Montgomery_County_Parcels/FeatureServer/6';
const COLUMNS = ['TAXPIN', 'PARCELTYPE', 'CLASS', 'LIV_UNITS', 'LAND_USE', 'TOTAL_ASSE', 'SCH_DIST', 'SUBDIVISIO', 'LEGAL1', 'LEGAL2', 'LEGAL3', 'LOC_NO', 'LOC_DIR', 'LOC_STR', 'LOC_SUF', 'LOC_SUF2', 'LOC_UNITDE', 'LOC_UNITNO', 'LOCATION1', 'LOCATION2', 'LOC_ZIP1_Z', 'SALE_DATE', 'CONSIDERAT', 'DEED_BOOK', 'DEED_PAGE', 'STEB', 'LAND_SF', 'LAND_ACRES', 'POOL', 'SFLA', 'FINBSMT_SF', 'STORIES', 'YEAR_BUILT', 'BEDROOMS', 'BATHS', 'HALF_BATHS', 'RM_TOT',
  'Muni_Name', 'LOT_NO', 'EXTWALL', 'BASEMENT', 'FUEL', 'STYLE', 'PREFAB_FRP', 'FRPL_OPEN', 'BSMT_CAR', 'UTIL1'];
// The county's "Parcel Codes" sheet: https://www.arcgis.com/sharing/rest/content/items/c47e63a20eba41f69d370e6f4498bdbb/data
const CLASSES = { A: 'Apartment', C: 'Commercial', E: 'Exempt', I: 'Industrial', R: 'Residential', U: 'Utility' };
const WALLS = { 1: 'Frame', 2: 'Brick', 3: 'Masonry & frame', 4: 'Block', 5: 'Stucco', 6: 'Aluminum/vinyl', 7: 'Stone', 8: 'Asbestos', 9: 'Concrete' };
const BASEMENTS = { 2: 'Crawl space', 3: 'Partial basement', 4: 'Full basement' };
const FUELS = { 2: 'Gas', 3: 'Electric', 4: 'Oil', 5: 'Coal', 6: 'Solar', 7: 'Other' };
const STYLES = { '01': 'Bilevel', '02': 'Split level', '03': 'Ranch', '04': 'Row', '05': 'Old Colonial', '06': 'Bungalow', '07': 'Colonial', '08': 'Cape Cod', '09': 'Twin', 10: 'Townhouse', 11: 'Log Home', 12: 'Contemporary', 13: 'Converted school', 14: 'Other', 15: 'Condominium', 16: 'Victorian', 17: 'Tudor', 18: 'Farm house', 19: 'Converted barn', 20: 'Dome', 21: 'A-Frame', 22: 'In-Ground', 23: 'Cluster', 24: 'Single wide mobile home', 25: 'Double wide mobile home' };
const POOLS = { RP1: 'Plastic liner pool', RP2: 'Prefabricated vinyl pool', RP3: 'Reinforced concrete pool', RP4: 'Fiberglass pool', RP5: 'Gunite pool' };
const USES = { 1000: 'Miscellaneous', 1001: 'House only, no land', 1002: 'Land only, building assessed separately', 1003: 'Open space/common area', 1004: 'Common element/condominium amenities', 1005: 'Detention basin', 1006: 'Subsidized single family detached', 1101: 'Single family detached', 1105: 'Single dwelling garage apartment', 1106: 'Boarded-up house', 1108: 'More than 1 house, detached', 1110: 'Garage on lot', 1111: 'Pool on lot', 1112: 'Pole building, stable, barn', 1113: 'Tennis court on lot', 1116: 'House with in-law suite', 1132: 'Duplex', 1134: 'Triplex', 1136: 'Quadraplex', 1140: 'Residential conversion 5 or more apartments', 1145: 'Rooming house/tourist home', 1160: 'Residential/commercial non-conforming', 1161: 'Residential/professional', 1175: 'Condominium-single detached', 1180: 'Residential convertible real estate', 1188: 'Condominium townhouse', 1189: 'Condominium cluster 2-5 units', 1190: 'Condominium 2-4 units', 1200: 'Condominium garage', 1201: 'Condominium garden style private entrance 1-35', 1202: 'Condominium garden style common entrance 1-35', 1203: 'Condominium mid-rise 4-6 stories', 1204: 'Condominium high rise 7+ stories', 1220: 'Mobile home owner\'s lot', 1221: 'Mobile home rented lot/park', 1222: 'Manufactured home rented lot', 1270: 'Seasonal dwelling', 1282: 'Master parcel Condominium, Co-Op, Planned Community', 1901: 'Exempt dwelling veterans', 4200: 'Low rise 5-10 units (1 building less than 3 stories)', 4201: 'Low rise 11-30 units (1 building less than 3 stories)', 4202: 'Low rise 30+ units (less than 3 stories)', 4203: 'Garden 1-50 units (group of low rise)', 4204: 'Garden 51-100 units (group of low rise)', 4205: 'Garden 101+ units (group of low rise)', 4210: 'High rise 1-50 units (greater than 4 stories with elevator)', 4211: 'High rise 51-100 units (greater than 4 stories with elevator)', 4212: 'High rise 101+ units (greater than 4 stories with elevator)', 4213: 'Townhouses 1-25 units', 4214: 'Townhouses 26+ units', 4216: 'Subsidized housing' };
// The sheet's groups, for land and buildings that aren't homes.
function useWords(code) {
  const c = String(code ?? '').trim();
  if (USES[c]) return USES[c];
  const n = Number(c);
  if (n >= 2100 && n <= 2113) return 'Residential vacant land';
  if (n >= 2000 && n <= 2713) return 'Vacant land';
  if (n >= 3000 && n <= 3503) return 'Industrial';
  if (n >= 4000 && n <= 4850) return 'Commercial';
  if (n >= 5000 && n <= 5980) return 'Institutional';
  if (n >= 8100 && n <= 8980) return 'Utility';
  if (n >= 9910 && n <= 9990) return 'Tax exempt';
  return null;
}
// A sale's STEB code on the sheet: a family's, an estate's or a forced sale still sold the home.
const NOT_THIS_SALE = { 53: 'Corporate affiliates', 57: 'Part interest sales', 59: 'Multiple parcel sale', 67: 'Lease purchases', 69: 'Personal property', 71: 'Deed of correction' };

function useOf(row, unit, hasBuilding) {
  const type = String(row.PARCELTYPE || '').toUpperCase();
  if (type === 'CONDOMINIUM') return ['unit', 'condo'];
  if (type === 'MOBILE HOME') return ['property', 'mobile_home'];
  if (type !== 'BASE PARCEL' || String(row.CLASS || '').trim() !== 'R') return ['other', null];
  if (!hasBuilding) return ['parcel', null];
  const units = positive(row.LIV_UNITS);
  if (units && units >= 5) return ['building', 'apartment'];
  if (units && units >= 2) return ['building', 'multi_unit'];
  return unit ? ['unit', 'condo'] : ['property', 'house'];
}

const inRange = (value, most) => {
  const count = positive(String(value ?? '').trim());
  return count && count <= most ? count : null;
};

function fromRow(row) {
  const unit = realUnit([word(row.LOC_UNITDE), word(row.LOC_UNITNO)].filter(Boolean).join(' '));
  const address = streetParts({ number: row.LOC_NO, pre: word(row.LOC_DIR) || '', name: word(row.LOC_STR) || '', suffix: word(row.LOC_SUF) || '', post: word(row.LOC_SUF2) || '', unit });
  const parcel = word(row.TAXPIN);
  if (!address || !parcel) return null;
  const size = positive(row.SFLA);
  const [kind, homeType] = useOf(row, address.unit, Boolean(size));
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', [row.LOCATION1, row.LOCATION2].map(word).filter(Boolean).join(' '));
  put(facts, 'school_district', word(row.SCH_DIST));
  put(facts, 'subdivision', word(row.SUBDIVISIO));
  put(facts, 'county_use_code', word(row.LAND_USE));
  put(facts, 'land_use', useWords(row.LAND_USE));
  put(facts, 'property_class', CLASSES[String(row.CLASS || '').trim()]);
  put(facts, 'municipality', word(row.Muni_Name));
  put(facts, 'lot_number', /^\d+[A-Z]?$/.test(String(row.LOT_NO ?? '').trim()) ? String(row.LOT_NO).trim() : null);
  put(facts, 'legal_description', [row.LEGAL1, row.LEGAL2, row.LEGAL3].map(word).filter(Boolean).join(' ').slice(0, 300));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.YEAR_BUILT));
    put(facts, 'stories', inRange(row.STORIES, kind === 'building' ? 40 : 6));
    put(facts, 'style', STYLES[String(row.STYLE ?? '').trim()]);
    put(facts, 'exterior_walls', WALLS[String(row.EXTWALL ?? '').trim()]);
    put(facts, 'foundation', BASEMENTS[String(row.BASEMENT ?? '').trim()]);
  }
  if (home) {
    put(facts, 'living_sqft', size);
    put(facts, 'basement_finished_sqft', positive(row.FINBSMT_SF));
    put(facts, 'bedrooms', inRange(row.BEDROOMS, 15));
    put(facts, 'rooms', inRange(row.RM_TOT, 40));
    const [full, half] = [inRange(row.BATHS, 15), inRange(row.HALF_BATHS, 10)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
    put(facts, 'pool', POOLS[String(row.POOL ?? '').trim()] || (word(row.POOL) ? 'Yes' : null));
    put(facts, 'heating_fuel', FUELS[String(row.FUEL ?? '').trim()]);
    const fireplaces = (inRange(row.FRPL_OPEN, 15) || 0) + (inRange(row.PREFAB_FRP, 15) || 0);
    if (fireplaces) facts.fireplaces = fireplaces;
    const cars = inRange(row.BSMT_CAR, 6);
    if (cars) {
      facts.garage = `${cars} car basement garage`;
      facts.parking_type = 'Basement garage';
      facts.parking_spaces = cars;
    }
  }
  if (kind === 'building') put(facts, 'units', positive(row.LIV_UNITS));
  if (kind !== 'unit') {
    if (positive(row.LAND_SF)) facts.lot_sqft = positive(row.LAND_SF);
    else put(facts, 'lot_acres', positive(row.LAND_ACRES));
  }
  put(facts, 'assessed_value', positive(row.TOTAL_ASSE));
  if (isHomeSale(positive(row.CONSIDERAT)) && !NOT_THIS_SALE[String(row.STEB ?? '').trim()]) {
    facts.sale_price = positive(row.CONSIDERAT);
    put(facts, 'sale_date', isoDate(row.SALE_DATE));
    if (word(row.DEED_BOOK) && word(row.DEED_PAGE)) facts.sale_document = `${word(row.DEED_BOOK)}-${word(row.DEED_PAGE)}`;
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: '', zip: zipCode(row.LOC_ZIP1_Z) }, facts };
}

async function* build({ work }) {
  const info = await getJson(`${LAYER}?f=json`, 'The layer\'s description');
  const asOf = isoDate(info.editingInfo?.dataLastEditDate || info.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The layer no longer says when it changed');
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'pa-montgomery', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS, { pageSize: 1000 }))) {
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
    fips: FIPS, state: 'PA', name: COUNTY, publisher: 'Montgomery County Board of Assessment', dataset: 'parcels, open data', method: 'county', source: 'pa-montgomery', as_of: asOf, stale_after_days: 400, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    text: 'https://www.arcgis.com/sharing/rest/content/items/c47e63a20eba41f69d370e6f4498bdbb/data',
    words: { EXTWALL: WALLS, FUEL: FUELS, STYLE: STYLES, POOL: POOLS },
    facts: { year_built: 'YEAR_BUILT', living_sqft: 'SFLA', basement_finished_sqft: 'FINBSMT_SF', bedrooms: 'BEDROOMS', full_baths: 'BATHS', half_baths: 'HALF_BATHS', rooms: 'RM_TOT', stories: 'STORIES', units: 'LIV_UNITS', lot_sqft: 'LAND_SF', lot_acres: 'LAND_ACRES', assessed_value: 'TOTAL_ASSE', sale_price: 'CONSIDERAT', sale_date: 'SALE_DATE' },
  },
};
