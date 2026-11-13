'use strict';
// Woodbury County, Iowa: the parcel table published by WCICC-IT GIS, the IT agency the county and Sioux City run together, with the rows of both
// assessors (Sioux City's own and the County Assessor's for the rest of the county). Its item says "Public use allowed" and states no other term;
// the table is dated in its title. Year built, total living area ("tla"), bedrooms, full and half baths, rooms, style, lot, the assessors' full
// values and the last normal sale; the grade is a code with no published words, so it isn't read. Deed holder and contract buyer columns,
// homestead and military dates and exemptions are never asked for; neither assessed nor taxable values are read, because their distance from the
// full value can say a home has an exemption. The occupancy column also says whether a home is owner-occupied or rented, so it sorts homes and
// is never shown.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { streetParts, year, isoDate, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { hold } = require('../lib/held.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '19193';
const COUNTY = 'Woodbury County';
const LAYER = 'https://services.arcgis.com/kd1jFI4TM5bZHeP8/arcgis/rest/services/parcel_data_public_table_full/FeatureServer/0';
const AS_OF = '2026-06-25';
const COLUMNS = ['pin', 'parcel', 'city1_county2', 'addr_num', 'addr_unit', 'addr_stname', 'addr_city', 'sale_price', 'nutc', 'sales_date', 'land_class_descr', 'occupancy_descr', 'land_sq_ft', 'land_acres', 'ZONING', 'vcs_subdiv_descr', 'main_year_built', 'main_style', 'main_area', 'main_tla', 'main_condition', 'total_bedrooms', 'total_rooms_above', 'full_bath_cnt', 'half_bath_cnt', 'fire_cnt', 'attach_garage_sqft', 'det_garage_sqft', 'extwalls', 'roof', 'main_ac', 'attach_garage_cnt', 'det_garage_cnt', 'I_CY_FullLandValue', 'I_CY_FullBuildingValue', 'I_CY_FullDwellingValue', 'I_CY_FullTotalValue', 'I_CY_FullDwellingCount'];

// The two assessors name single-family homes differently ("Sgl-Fam Dwlg < than 30,000 Land" in Sioux City, "Single-Family / ..." in the county);
// conversions and duplexes hold two to seven homes, apartments more. A parcel with no occupancy but a home's facts is read as a house.
function useOf(occupancy, landClass, unit, row) {
  const o = String(occupancy || '').trim();
  const residential = /^(residential|ag_dwelling|exempt_res)$/i.test(String(landClass || '').trim());
  if (/^(sgl-fam|single-family|mobile home housing)/i.test(o)) return unit ? ['unit', 'condo'] : ['property', /^mobile/i.test(o) ? 'mobile_home' : 'house'];
  if (/^townhouse$/i.test(o)) return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (/^condominium$/i.test(o)) return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (/^(two|three|four|five|six|seven)-family/i.test(o)) return ['building', 'multi_unit'];
  if (/^apartment$/i.test(o)) return ['building', 'apartment'];
  if (residential && /^unknown$/i.test(o) && positive(row.total_bedrooms) && positive(row.main_tla)) return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (residential && /^(vacant|detached structures|unknown|flood way)/i.test(o)) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

// A number column holds a plain number ("1234") or one ending in a dash with the rest in the unit column. "1234-" and "-36" (1236, a few
// numbers on) name the two homes of a duplex: the first is kept, as people's mail does. "4500-" and "-101" name a condominium's unit 101.
// A lot ("LOT 12") isn't read. A unit column holding "1/2" is a half number.
function siteOf(row) {
  const written = String(row.addr_num ?? '').trim();
  const number = written.replace(/-$/, '');
  if (!/^\d+[A-Z]?$/i.test(number)) return null;
  let unit = String(row.addr_unit ?? '').trim();
  const half = /(^|\s)(\d\/\d)$/.exec(unit)?.[2] || '';
  unit = unit.replace(/(^|\s)\d\/\d$/, '').trim();
  if (/^-/.test(unit)) {
    const rest = unit.replace(/^-\s*/, '');
    const last = /^\d+$/.test(rest) && rest.length < number.length ? Number(number.slice(0, number.length - rest.length) + rest) : Number(rest);
    const gap = last - Number(number);
    unit = /-$/.test(written) && gap > 0 && gap <= 40 && gap % 2 === 0 ? '' : rest;
  }
  unit = unit.replace(/^#\s*/, '');
  const name = word(row.addr_stname) || '';
  return { number, half, unit, name, line: [number, half, name].filter(Boolean).join(' ') };
}

const CITIES = { 'SERGEANT BLUF': 'SERGEANT BLUFF', 'SGT BLUFF': 'SERGEANT BLUFF', 'SLOAN CITY': 'SLOAN', UNKNOWN: '' };
const cityOf = (value) => {
  const city = String(value ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
  return CITIES[city] ?? city;
};

// The assessors' short words, in full; any other stays as they wrote it.
const SHORT = { Asph: 'Asphalt', Mtl: 'Metal', Wd: 'Wood', 'Rub Memb': 'Rubber membrane', Alum: 'Aluminum', Brk: 'Brick', 'Wd Lap': 'Wood lap', 'Vert Wd': 'Vertical wood', Asb: 'Asbestos' };
const plain = (text) => (text && SHORT[text]) || text;

function fromRow(row) {
  const site = siteOf(row);
  const address = site ? streetParts({ number: site.number, numberSuffix: site.half, name: site.name, unit: site.unit }) : null;
  const parcel = word(row.pin);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.occupancy_descr, row.land_class_descr, address.unit, row);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(site.line, site.unit));
  put(facts, 'property_class', word(row.land_class_descr)?.toUpperCase());
  put(facts, 'subdivision', word(row.vcs_subdiv_descr));
  put(facts, 'zoning', word(row.ZONING));
  put(facts, 'municipality', String(row.city1_county2) === '1' ? 'Sioux City' : null);
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.main_year_built));
    put(facts, 'style', word(row.main_style));
    put(facts, 'condition', word(row.main_condition));
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.main_tla));
    put(facts, 'ground_floor_sqft', positive(row.main_area));
    put(facts, 'bedrooms', inRange(row.total_bedrooms, 15));
    const [full, half] = [inRange(row.full_bath_cnt, 12), inRange(row.half_bath_cnt, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
    put(facts, 'rooms', inRange(row.total_rooms_above, 40));
    put(facts, 'fireplaces', inRange(row.fire_cnt, 10));
    put(facts, 'garage_sqft', (positive(row.attach_garage_sqft) || 0) + (positive(row.det_garage_sqft) || 0) || null);
  }
  if (kind === 'building') put(facts, 'units', inRange(row.I_CY_FullDwellingCount, 2000));
  if (kind !== 'unit') {
    if (positive(row.land_sq_ft)) put(facts, 'lot_sqft', positive(row.land_sq_ft));
    else put(facts, 'lot_acres', positive(row.land_acres));
  }
  // Iowa values property at its actual (market) value; the full values are the assessor's, before the state's rollback. A home's own structure
  // is its "dwelling" value, and garages and other buildings are added to it.
  const [land, dwelling, other] = [positive(row.I_CY_FullLandValue), positive(row.I_CY_FullDwellingValue), positive(row.I_CY_FullBuildingValue)];
  put(facts, 'market_value', positive(row.I_CY_FullTotalValue));
  put(facts, 'market_land_value', land);
  put(facts, 'market_building_value', (dwelling || 0) + (other || 0) || null);
  put(facts, 'value_year', 2026);
  // The assessors mark a sale "Normal" (an arm's-length transfer); family sales, splits, foreclosures and the rest are left out, and so is a
  // sale dated January 1, 1900, the file's mark for a date it doesn't have.
  const saleDate = isoDate(row.sales_date);
  if (/^normal/i.test(String(row.nutc || '').trim()) && isHomeSale(positive(row.sale_price)) && saleDate > '1900-12-31') {
    put(facts, 'sale_price', positive(row.sale_price));
    put(facts, 'sale_date', saleDate);
  }
  const record = { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: cityOf(row.addr_city), zip: null }, facts };
  // Columns read since the county went live: held off its screens until its new_columns switch is on (lib/held.cjs).
  // The walls and roof are the assessors' own words; the roof column says its cover, then its shape ("Asph / Gable").
  if (home || kind === 'building') {
    hold(record, 'exterior_walls', plain(word(row.extwalls)));
    const [cover, shape] = String(row.roof || '').split(' / ').map((part) => word(part));
    if (cover && !/^other$/i.test(cover)) hold(record, 'roof_cover', plain(cover));
    if (shape && !/^other$/i.test(shape)) hold(record, 'roof_shape', shape);
  }
  if (home) {
    // main_ac is 1 where the main building has air conditioning; a 0 may be no answer, so it says nothing.
    if (Number(row.main_ac) === 1) hold(record, 'cooling', 'Air conditioning');
    const kinds = [positive(row.attach_garage_cnt) && 'Attached', positive(row.det_garage_cnt) && 'Detached'].filter(Boolean);
    if (kinds.length) hold(record, 'garage', kinds.join(', '));
  }
  return record;
}

async function* build({ work }) {
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  for await (const row of cached(path.join(work, 'ia-woodbury', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'IA', name: COUNTY, publisher: 'Woodbury County', dataset: 'parcel data of the county and Sioux City assessors (WCICC-IT GIS)', method: 'county', source: 'ia-woodbury', as_of: AS_OF, stale_after_days: 450, extra_zips: zipsByCounty(work, ['19']).get(FIPS) || [], records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'main_year_built', living_sqft: 'main_tla', ground_floor_sqft: 'main_area', bedrooms: 'total_bedrooms', bathrooms: 'full_bath_cnt', full_baths: 'full_bath_cnt', half_baths: 'half_bath_cnt', rooms: 'total_rooms_above', fireplaces: 'fire_cnt', lot_sqft: 'land_sq_ft', lot_acres: 'land_acres', market_value: 'I_CY_FullTotalValue', market_land_value: 'I_CY_FullLandValue', market_building_value: 'I_CY_FullDwellingValue', units: 'I_CY_FullDwellingCount', sale_price: 'sale_price', sale_date: 'sales_date' },
  },
};
