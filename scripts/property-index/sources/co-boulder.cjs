'use strict';
// Boulder County, Colorado: the Assessor's public data download, rebuilt nightly, with its help manual for a dictionary.
// Account, building, land, value and sale tables joined on the account number. The page and manual carry a no-warranty
// disclaimer (the data was "developed solely for internal use" by the county, which accepts no liability for it) and no
// limit on using it. Owner and mailing columns are never asked for. Actual value is Colorado's market value; assessed value
// is its fraction of it. Site addresses carry a city but no ZIP, so the county's ZIPs come from the Census.

const path = require('node:path');
const { download } = require('../lib/tables.cjs');
const { csvRows } = require('../lib/csv.cjs');
const { year, isoDate, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '08013';
const COUNTY = 'Boulder County';
const BASE = 'https://assessor.boco.solutions/ASR_PublicDataFiles';
const MANUAL = 'https://assets.bouldercounty.gov/wp-content/uploads/2017/02/ar-property-data-download-help.pdf';
const ADDRESS_COLUMNS = ['CreatedDate', 'strap', 'folio', 'str_num', 'str_pfx', 'str', 'str_sfx', 'str_unit', 'city', 'sub_dscr', 'legalDscr', 'account_type', 'taxArea', 'nh'];
const BUILDING_COLUMNS = ['strap', 'bld_num', 'section_num', 'designCodeDscr', 'qualityCodeDscr', 'bldgClass', 'builtYear', 'EffectiveYear', 'bsmtSF', 'bsmtTypeDscr', 'carStorageSF', 'carStorageTypeDscr', 'nbrBedRoom', 'nbrRoomsNobath', 'mainfloorSF', 'nbrThreeQtrBaths', 'nbrFullBaths', 'nbrHalfBaths', 'TotalFinishedSF', 'AcDscr', 'HeatingDscr', 'ExtWallDscrPrim', 'Roof_CoverDscr', 'UnitCount'];
const LAND_COLUMNS = ['strap', 'landClass', 'GIS_sqft', 'GIS_acreage'];
const VALUE_COLUMNS = ['strap', 'tax_yr', 'LandAcutalVal', 'totalActualVal', 'landAssessedVal', 'totalAssessedVal'];
const SALE_COLUMNS = ['strap', 'deedNum', 'Tdate', 'deed_type', 'price'];

// Colorado's building class codes, as the manual's land class note reads them: 12xx residential, 92x0 an exempt owner's
// residence, 4277 and 1277 a farm or ranch residence.
function useOf(building, land, unit) {
  const code = String(building?.bldgClass || '');
  const design = String(building?.designCodeDscr || '').toUpperCase();
  if (code === '1230') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (code === '1235') return ['property', 'mobile_home'];
  if (code === '1215') return ['building', 'multi_unit'];
  if (code === '1220' || code === '1225') return ['building', 'apartment'];
  // A home needs a finished building; a lot holding only a shed or barn reads by its land.
  if (building?.finished && (code === '1212' || code === '1210' || code === '1277' || code === '4277' || /^92[1-7]0$/.test(code))) {
    if (unit) return ['unit', 'condo'];
    return /TWNHM|TOWNHOUSE|PAIRED|PATIO/.test(design) ? ['property', 'townhouse'] : ['property', 'house'];
  }
  if (building?.finished) return ['other', null];
  return /^0/.test(String(land?.landClass || '')) ? ['parcel', null] : ['other', null];
}

/**
 * An account's main building: its largest finished one (sheds, barns and garages have no finished area). The table repeats
 * a building once per basement kind and car storage kind, every pairing, so each kind's area counts once.
 */
function buildingOf(rows) {
  const finished = rows.filter((row) => positive(row.TotalFinishedSF));
  if (!finished.length) return { ...rows[0], finished: false, count: 0 };
  const main = finished.reduce((best, row) => (positive(row.TotalFinishedSF) > positive(best.TotalFinishedSF) ? row : best));
  const building = { ...main, finished: true, count: new Set(finished.map((row) => row.bld_num)).size };
  const [basements, cars] = [new Map(), new Map()];
  for (const row of rows.filter((part) => part.bld_num === main.bld_num && part.section_num === main.section_num)) {
    if (positive(row.bsmtSF)) basements.set(String(row.bsmtTypeDscr).toUpperCase(), positive(row.bsmtSF));
    if (positive(row.carStorageSF)) cars.set(String(row.carStorageTypeDscr).toUpperCase(), positive(row.carStorageSF));
  }
  const total = (entries) => entries.reduce((sum, [, area]) => sum + area, 0) || null;
  building.basement = total([...basements]);
  building.basementFinished = total([...basements].filter(([kind]) => /FINISH/.test(kind) && !/UNFINISH/.test(kind)));
  building.carport = total([...cars].filter(([kind]) => /CARPORT/.test(kind)));
  const garages = [...cars].filter(([kind]) => /GARAGE/.test(kind));
  building.garage = total(garages);
  const kinds = garages.map(([kind]) => kind).join(' ');
  building.garageKind = /\bATTACHED/.test(kinds) ? 'Attached' : /DETACHED/.test(kinds) ? 'Detached' : /BASEMENT/.test(kinds) ? 'Basement' : null;
  return building;
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};
const said = (value) => (word(value) && word(value) !== '0' ? word(value) : null);

function fromRow(row, { building, land, value, sale }) {
  const unit = realUnit(word(row.str_unit));
  const address = streetParts({ number: row.str_num, pre: word(row.str_pfx) || '', name: word(row.str) || '', suffix: word(row.str_sfx) || '', unit });
  const account = word(row.strap);
  if (!address || !account) return null;
  const [kind, homeType] = useOf(building, land, address.unit);
  const facts = { parcel_number: word(row.folio) || account, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([row.str_num, row.str_pfx, row.str, row.str_sfx].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'subdivision', word(row.sub_dscr));
  put(facts, 'legal_description', word(row.legalDscr)?.slice(0, 300));
  put(facts, 'property_class', word(row.account_type));
  put(facts, 'tax_code_area', word(row.taxArea));
  put(facts, 'neighborhood', word(row.nh));
  if (building && (home || kind === 'building')) {
    put(facts, 'year_built', year(Math.trunc(Number(building.builtYear))));
    put(facts, 'effective_year_built', year(Math.trunc(Number(building.EffectiveYear))));
    put(facts, 'style', said(building.designCodeDscr));
    put(facts, 'quality', said(building.qualityCodeDscr));
    put(facts, 'exterior_walls', said(building.ExtWallDscrPrim));
    put(facts, 'roof_cover', said(building.Roof_CoverDscr));
    if (building.count > 1) facts.buildings_on_parcel = building.count;
  }
  if (building && kind === 'building') put(facts, 'units', inRange(building.UnitCount, 2000));
  if (building && home) {
    put(facts, 'living_sqft', positive(building.TotalFinishedSF));
    put(facts, 'ground_floor_sqft', positive(building.mainfloorSF));
    if (/^1[ -]STORY|^DETACHED 1 STORY/.test(String(building.designCodeDscr || '').toUpperCase())) facts.stories = 1;
    put(facts, 'bedrooms', inRange(building.nbrBedRoom, 15));
    put(facts, 'rooms', inRange(building.nbrRoomsNobath, 40));
    const [full, threeQuarter, half] = [inRange(building.nbrFullBaths, 15), inRange(building.nbrThreeQtrBaths, 10), inRange(building.nbrHalfBaths, 10)];
    put(facts, 'full_baths', full);
    put(facts, 'three_quarter_baths', threeQuarter);
    put(facts, 'half_baths', half);
    if (full || threeQuarter || half) facts.bathrooms = (full || 0) + 0.75 * (threeQuarter || 0) + 0.5 * (half || 0);
    put(facts, 'basement_sqft', building.basement || null);
    put(facts, 'basement_finished_sqft', building.basementFinished || null);
    put(facts, 'garage_sqft', building.garage || null);
    put(facts, 'carport_sqft', building.carport || null);
    if (building.garageKind) facts.garage = building.garageKind;
    put(facts, 'heating', said(building.HeatingDscr));
    put(facts, 'cooling', said(building.AcDscr));
  }
  if (land && kind !== 'unit') {
    put(facts, 'lot_acres', positive(land.GIS_acreage));
    if (!facts.lot_acres) put(facts, 'lot_sqft', positive(land.GIS_sqft));
  }
  if (value) {
    put(facts, 'value_year', positive(value.tax_yr));
    put(facts, 'market_value', positive(value.totalActualVal));
    put(facts, 'market_land_value', positive(value.LandAcutalVal));
    put(facts, 'assessed_value', positive(value.totalAssessedVal));
    put(facts, 'assessed_land_value', positive(value.landAssessedVal));
  }
  if (sale) {
    facts.sale_price = positive(sale.price);
    put(facts, 'sale_date', isoDate(sale.Tdate));
    put(facts, 'sale_document', word(sale.deedNum));
  }
  const city = String(word(row.city) || '').toUpperCase();
  return { id: `pp:${kind}:${FIPS}:${account}`, kind, home_type: homeType, address: { ...address, city: city === 'UNINCORPORATED' ? '' : city, zip: null }, facts };
}

async function* build({ work }) {
  const dir = path.join(work, 'co-boulder');
  const file = (name) => {
    const local = path.join(dir, `${name}.csv`);
    download(`${BASE}/${name}.csv`, local);
    return local;
  };
  const accounts = new Map();
  for await (const row of csvRows(file('Buildings'), BUILDING_COLUMNS, { label: 'Buildings table' })) {
    if (!accounts.has(row.strap)) accounts.set(row.strap, []);
    accounts.get(row.strap).push(row);
  }
  const buildings = new Map([...accounts].map(([account, rows]) => [account, buildingOf(rows)]));
  accounts.clear();
  const lands = new Map();
  for await (const row of csvRows(file('Land'), LAND_COLUMNS, { label: 'Land table' })) if (!lands.has(row.strap)) lands.set(row.strap, row);
  const values = new Map();
  for await (const row of csvRows(file('Values'), VALUE_COLUMNS, { label: 'Values table' })) values.set(row.strap, row);
  const sales = new Map();
  for await (const row of csvRows(file('Sales'), SALE_COLUMNS, { label: 'Sales table' })) {
    // A quit claim moves no home at a price.
    if (!isHomeSale(positive(row.price)) || /^Q/.test(String(row.deed_type || '').trim())) continue;
    const date = isoDate(row.Tdate);
    if (!date) continue;
    const was = sales.get(row.strap);
    if (!was || date > was.date) sales.set(row.strap, { ...row, date });
  }
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  let asOf = null;
  // An account with several owners or site addresses has several rows: the first address stands.
  for await (const row of csvRows(file('Owner_Address'), ADDRESS_COLUMNS, { label: 'Owner_Address table' })) {
    asOf ||= isoDate(row.CreatedDate);
    if (seen.has(row.strap)) continue;
    const record = fromRow(row, { building: buildings.get(row.strap), land: lands.get(row.strap), value: values.get(row.strap), sale: sales.get(row.strap) });
    if (!record) noAddress += 1;
    else {
      seen.add(row.strap);
      records.push(record);
    }
  }
  if (!asOf) throw new Error('The address table no longer says when it was written');
  log(`${COUNTY}: ${records.length} accounts, ${noAddress} without a street number; ${buildings.size} with buildings, ${lands.size} land, ${values.size} values, ${sales.size} sales`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'CO', name: COUNTY, publisher: 'Boulder County Assessor', dataset: 'property data download', method: 'county', source: 'co-boulder', as_of: asOf, stale_after_days: 60, extra_zips: zipsByCounty(work, ['08']).get(FIPS) || [], records,
  };
}

module.exports = {
  build,
  dictionary: {
    columns: [...new Set([...ADDRESS_COLUMNS, ...BUILDING_COLUMNS, ...LAND_COLUMNS, ...VALUE_COLUMNS, ...SALE_COLUMNS])],
    text: MANUAL,
    facts: { year_built: 'builtYear', effective_year_built: 'EffectiveYear', living_sqft: 'TotalFinishedSF', ground_floor_sqft: 'mainfloorSF', bedrooms: 'nbrBedRoom', rooms: 'nbrRoomsNobath', full_baths: 'nbrFullBaths', half_baths: 'nbrHalfBaths', bathrooms: 'nbrFullBaths', basement_sqft: 'bsmtSF', basement_finished_sqft: 'bsmtSF', garage_sqft: 'carStorageSF', units: 'UnitCount', lot_acres: 'GIS_acreage', lot_sqft: 'GIS_sqft', value_year: 'tax_yr', market_value: 'totalActualVal', market_land_value: 'LandAcutalVal', assessed_value: 'totalAssessedVal', assessed_land_value: 'landAssessedVal', sale_price: 'price', sale_date: 'Tdate' },
  },
};
