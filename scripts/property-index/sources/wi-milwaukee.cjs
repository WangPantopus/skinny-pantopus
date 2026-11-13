'use strict';
// Milwaukee County, Wisconsin: the City of Milwaukee's Master Property File, updated daily, CC BY (credit the City). It covers the
// city, not the county's other municipalities, whose lookups get no record. Year built, bedrooms, baths, area, stories, style,
// basement and values. Bedrooms and baths on a multi-unit building aren't one home's, so they're kept for single homes. Owner,
// mailing, exemption and owner-occupied columns are never read. Most condos in a shared building have no unit number here. Codes follow the
// file's documentation (Master Property File Documentation, on the dataset's page). It records each sale's month and transfer fee, which its
// documentation says is the real estate value times .003 since September 1981, so the fee says the price.
// A condo's unit number comes from the City's Master Address Index (also CC BY, updated daily), which lists each tax key's
// addresses with their units: only the tax key, street and unit columns are read, never its mail columns.

const path = require('node:path');
const { getJson } = require('../lib/services.cjs');
const { download } = require('../lib/tables.cjs');
const { csvRows } = require('../lib/csv.cjs');
const { streetParts, year, zipCode, isoDate, onRecord, realUnit } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '55079';
const COUNTY = 'Milwaukee County';
const API = 'https://data.milwaukee.gov/api/3/action/package_show?id=mprop';
const INDEX_API = 'https://data.milwaukee.gov/api/3/action/package_show?id=mai';
const INDEX_COLUMNS = ['TAXKEY', 'HSE_NBR', 'SFX', 'DIR', 'STREET', 'STTYPE', 'UNIT_NBR'];
const COLUMNS = ['TAXKEY', 'YR_ASSMT', 'HOUSE_NR_LO', 'HOUSE_NR_SFX', 'SDIR', 'STREET', 'STTYPE', 'C_A_LAND', 'C_A_IMPRV', 'C_A_TOTAL', 'BLDG_TYPE', 'NR_STORIES', 'BASEMENT', 'NR_UNITS', 'BLDG_AREA', 'YR_BUILT', 'FIREPLACE', 'AIR_CONDITIONING', 'BEDROOMS', 'BATHS', 'POWDER_ROOMS', 'LOT_AREA', 'ZONING', 'LAND_USE', 'GEO_ZIP_CODE', 'TAX_RATE_CD', 'C_A_CLASS', 'CONVEY_DATE', 'CONVEY_TYPE', 'CONVEY_FEE', 'PARKING_TYPE'];
const STYLE = { '01': 'Ranch', '02': 'Bi-level', '03': 'Split-level', '04': 'Cape Cod', '05': 'Colonial', '06': 'Tudor', '07': 'Townhouse', '08': 'Old style', '09': 'Mansion', 10: 'Cottage', 11: 'Duplex, old style', 12: 'Duplex, new style', 13: 'Duplex cottage', 15: 'Triplex', 18: 'Milwaukee bungalow', 22: 'Bungalow, old style' };
const BASEMENT = { F: 'Full basement', P: 'Partial basement', C: 'Crawl space', Y: 'Basement' };
const GARAGES = { A: 'Attached', D: 'Detached', AD: 'Attached, Detached' };
const CLASSES = { 1: 'Residential', 2: 'Mercantile', 3: 'Manufacturing', 4: 'Special mercantile', 5: 'Condominiums', 7: 'Mercantile apartments', 9: 'Exempt' };
// Its conveyance types that sell a home: deeds, land contracts, and the sales an estate, a trustee, a receiver or a court makes.
const SALE_DEEDS = new Set(['WD', 'SW', 'D', 'CD', 'LC', 'LD', 'TD', 'PR', 'PD', 'AD', 'GD', 'MD', 'RD', 'SD', 'SH']);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const FEE_RATE = 0.003;
const USE_WORDS = { 8810: 'Single-family household', 8811: 'Condominium', 8820: 'Two-family residential', 8830: 'Multi-family residential', 8880: 'Vacant lot', 8885: 'Vacant lot with improvements', 8899: 'Mixed residential and commercial' };

function useOf(code, buildingType) {
  const [c, t] = [String(code ?? '').trim(), String(buildingType ?? '').trim()];
  if (c === '8811') return ['property', 'condo'];
  if (c === '8810') return t === '07' ? ['property', 'townhouse'] : ['property', 'house'];
  if (c === '8820') return ['building', 'multi_unit'];
  if (c === '8830' || c === '8890') return /^(15)$/.test(t) ? ['building', 'multi_unit'] : ['building', 'apartment'];
  if (c === '8880' || c === '8885') return ['parcel', null];
  return ['other', null];
}

function fromRow(row, today) {
  const address = streetParts({ number: row.HOUSE_NR_LO, numberSuffix: row.HOUSE_NR_SFX, pre: row.SDIR, name: row.STREET, suffix: row.STTYPE });
  const parcel = word(row.TAXKEY);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.LAND_USE, row.BLDG_TYPE);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property';
  const on = home || kind === 'building';
  put(facts, 'address_on_record', onRecord([row.HOUSE_NR_LO, row.HOUSE_NR_SFX, row.SDIR, row.STREET, row.STTYPE].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ')));
  put(facts, 'municipality', 'Milwaukee');
  put(facts, 'land_use', USE_WORDS[String(row.LAND_USE).trim()]);
  put(facts, 'county_use_code', word(row.LAND_USE));
  put(facts, 'zoning', word(row.ZONING));
  put(facts, 'tax_code_area', word(row.TAX_RATE_CD));
  put(facts, 'property_class', CLASSES[String(row.C_A_CLASS ?? '').trim()]);
  if (on) {
    const built = year(row.YR_BUILT);
    put(facts, 'year_built', built);
    put(facts, 'stories', positive(row.NR_STORIES));
    put(facts, 'style', STYLE[String(row.BLDG_TYPE).trim()]);
    put(facts, 'foundation', BASEMENT[String(row.BASEMENT).trim()]);
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.BLDG_AREA));
    put(facts, 'bedrooms', positive(row.BEDROOMS) <= 15 ? positive(row.BEDROOMS) : null);
    const [full, half] = [positive(row.BATHS), positive(row.POWDER_ROOMS)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
    if (String(row.FIREPLACE).trim() === '1') facts.fireplaces = 1;
    if (String(row.AIR_CONDITIONING).trim().startsWith('1')) facts.cooling = 'Central air';
    const garage = GARAGES[String(row.PARKING_TYPE ?? '').trim()];
    if (garage) {
      facts.garage = garage;
      facts.parking_type = garage.split(', ').map((kind) => `${kind} garage`).join(', ');
    }
  } else if (kind === 'building') {
    put(facts, 'gross_sqft', positive(row.BLDG_AREA));
    put(facts, 'units', positive(row.NR_UNITS));
  }
  if (homeType !== 'condo') put(facts, 'lot_sqft', positive(row.LOT_AREA));
  const conveyed = isoDate(row.CONVEY_DATE);
  const price = positive(row.CONVEY_FEE) ? Math.round(positive(row.CONVEY_FEE) / FEE_RATE) : null;
  if (conveyed && conveyed >= '1981-09' && SALE_DEEDS.has(String(row.CONVEY_TYPE ?? '').trim()) && isHomeSale(price)) {
    facts.sale_price = price;
    facts.sale_month = `${MONTHS[Number(conveyed.slice(5, 7)) - 1]} ${conveyed.slice(0, 4)}`;
  }
  put(facts, 'value_year', positive(row.YR_ASSMT));
  put(facts, 'assessed_value', positive(row.C_A_TOTAL));
  put(facts, 'assessed_land_value', positive(row.C_A_LAND));
  put(facts, 'assessed_building_value', positive(row.C_A_IMPRV));
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: 'MILWAUKEE', zip: zipCode(row.GEO_ZIP_CODE) }, facts };
}

const streetOf = (address) => [address.number, address.pre, address.name, address.suffix, address.post].join('|');
const unpadded = (number) => String(number || '').replace(/^0+(?=\d)/, '');

/**
 * Each condo's unit number from the Master Address Index, as `listed_unit`, which the server uses only for a county on its
 * switch file's listed_units list (backend/services/propertyRecords/router.js), and then only for someone who names that
 * unit: the record also stays as it is, so every other ask answers as before. A condo takes one only when the index lists
 * exactly one unit for its tax key at its own street address, and no other home at that street number takes the same one.
 */
async function listUnits(records, work) {
  const about = await getJson(INDEX_API, 'The address index\'s description');
  const file = (about.result?.resources || []).find((resource) => resource.format === 'CSV');
  if (!file) throw new Error('The address index no longer has its CSV');
  const csv = path.join(work, 'wi-milwaukee', 'mai.csv');
  download(file.url, csv);
  const listed = new Map();
  for await (const row of csvRows(csv, INDEX_COLUMNS)) {
    const unit = realUnit(row.UNIT_NBR);
    const parcel = word(row.TAXKEY);
    if (!unit || !parcel) continue;
    const address = streetParts({ number: row.HSE_NBR, numberSuffix: row.SFX, pre: row.DIR, name: row.STREET, suffix: row.STTYPE, unit });
    if (!address?.unit) continue;
    if (!listed.has(parcel)) listed.set(parcel, []);
    listed.get(parcel).push(address);
  }
  const atNumber = new Map();
  let condos = 0;
  for (const record of records) {
    if (record.kind !== 'property' || record.home_type !== 'condo' || record.address.unit) continue;
    condos += 1;
    const own = new Set((listed.get(record.facts.parcel_number) || []).filter((address) => streetOf(address) === streetOf(record.address)).map((address) => address.unit));
    if (own.size !== 1) continue;
    const key = `${unpadded(record.address.number)}|${record.address.name}|${[...own][0]}`;
    if (!atNumber.has(key)) atNumber.set(key, []);
    atNumber.get(key).push([record, [...own][0]]);
  }
  let given = 0;
  for (const homes of atNumber.values()) {
    if (homes.length !== 1) continue;
    const [record, unit] = homes[0];
    record.address.listed_unit = unit;
    given += 1;
  }
  log(`${COUNTY}: ${given} of ${condos} condos have their unit number from the address index (used only where the switch file lists the county)`);
}

async function* build({ work, today }) {
  const about = await getJson(API, 'The dataset\'s description');
  const file = (about.result?.resources || []).find((resource) => resource.format === 'CSV');
  if (!file) throw new Error('The dataset no longer has its CSV');
  const asOf = isoDate(file.last_modified) || isoDate(today.getTime());
  const csv = path.join(work, 'wi-milwaukee', 'mprop.csv');
  download(file.url, csv);
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of csvRows(csv, COLUMNS)) {
    const record = fromRow(row, today);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  await listUnits(records, work);
  yield {
    fips: FIPS, state: 'WI', name: COUNTY, publisher: 'City of Milwaukee', dataset: 'Master Property File', method: 'county', source: 'wi-milwaukee', as_of: asOf, stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    columns: COLUMNS,
    facts: { year_built: 'YR_BUILT', stories: 'NR_STORIES', style: 'BLDG_TYPE', foundation: 'BASEMENT', living_sqft: 'BLDG_AREA', gross_sqft: 'BLDG_AREA', bedrooms: 'BEDROOMS', full_baths: 'BATHS', half_baths: 'POWDER_ROOMS', fireplaces: 'FIREPLACE', cooling: 'AIR_CONDITIONING', units: 'NR_UNITS', lot_sqft: 'LOT_AREA', value_year: 'YR_ASSMT', assessed_value: 'C_A_TOTAL', assessed_land_value: 'C_A_LAND', assessed_building_value: 'C_A_IMPRV', zoning: 'ZONING', land_use: 'LAND_USE' },
  },
};
