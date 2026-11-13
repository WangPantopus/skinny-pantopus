'use strict';
// Carteret County, North Carolina: the county's tax parcel layer for its GIS website, credited to the Carteret County Tax Department and the
// county's GIS Division, on the county's own GIS server. Its terms of use say the data is provided as is and with all faults, without warranty,
// and ask that anyone shown the county as the source be told so; maps and apps using it may not carry the county's logo or look like the
// county's own product. They state no limit on use or resale. Year built, heated area, bedrooms, baths, style, condition, walls, roof,
// foundation, heating, acres, values and the last qualified sale. The owner and mailing columns are never asked for. Parcels carry no site ZIP,
// so the county's ZIPs come from the Census.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { streetParts, year, isoDate, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '37031';
const COUNTY = 'Carteret County';
const LAYER = 'https://arcgisweb.carteretcountync.gov/arcgis/rest/services/Layers/Parceldata/FeatureServer/0';
const COLUMNS = ['PIN15', 'CONDO_', 'SITE_HOUSE', 'SITE_DIR', 'SITE_ST', 'SITE_STTYP', 'SITE_APTNO', 'SITE_CITY', 'LegalAcres', 'GISacres', 'Use_code', 'Use_desc', 'NBHD', 'Subdivision_Name', 'BuildingCount', 'Y_BLT_HOUSE', 'BLT_CONDO', 'HtdSqFt', 'BATHROOMS', 'BEDROOMS', 'BldgUse', 'Condition', 'DwellingStyleDescription', 'ExWllDes1', 'RCovDes1', 'FondDes1', 'HeatDes1', 'FireplaceCount', 'STRUC_VAL', 'LAND_VALUE', 'Total_EMV', 'SALE_PRICE', 'SaleDate', 'IsQualified'];

// The building use column, in the county's words: SFR a house, MHDW and MHSW a double- or single-wide manufactured home, TWNH a townhouse, Condo
// a condominium unit, MFR a building of two to four homes. A parcel with no building use is land; the rest are businesses and institutions.
function useOf(row, unit) {
  const use = String(row.BldgUse || '').trim().toUpperCase();
  if (use === 'SFR') return ['property', 'house'];
  if (use === 'MHDW' || use === 'MHSW') return ['property', 'mobile_home'];
  if (use === 'TWNH') return ['property', 'townhouse'];
  if (use === 'CONDO') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (use === 'MFR') return ['building', 'multi_unit'];
  if (/^APT/.test(use)) return ['building', 'apartment'];
  if (!use) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};
const text = (value) => (/^none$/i.test(String(value ?? '').trim()) ? null : word(value));
// A few condition rows hold a bare letter ("A", "F") the county gives no words for: only words are kept.
const condition = (value) => (/^[A-Z][A-Z ]{2,}$/i.test(String(value ?? '').trim()) ? text(value) : null);

// A condominium's unit is its site unit, or else the condo number the county keeps with the parcel ("000" is none).
function unitOf(row) {
  const site = word(row.SITE_APTNO);
  if (site) return site;
  const condo = word(row.CONDO_);
  return String(row.BldgUse || '').trim().toUpperCase() === 'CONDO' && condo && !/^0+$/.test(condo) ? condo : '';
}

function fromRow(row, latest) {
  const number = String(row.SITE_HOUSE ?? '').trim();
  const unit = unitOf(row);
  const address = /^\d+[A-Z]?$/i.test(number) && word(row.SITE_ST) ? streetParts({ number, pre: word(row.SITE_DIR) || '', name: word(row.SITE_ST) || '', suffix: word(row.SITE_STTYP) || '', unit }) : null;
  const parcel = word(row.PIN15);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([number, row.SITE_DIR, row.SITE_ST, row.SITE_STTYP].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'county_use_code', word(row.Use_code));
  put(facts, 'land_use', word(row.Use_desc));
  put(facts, 'neighborhood', word(row.NBHD));
  put(facts, 'subdivision', word(row.Subdivision_Name));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.BLT_CONDO) || year(row.Y_BLT_HOUSE));
    put(facts, 'exterior_walls', text(row.ExWllDes1));
    put(facts, 'roof_cover', text(row.RCovDes1));
    put(facts, 'foundation', text(row.FondDes1));
    if (positive(row.BuildingCount) > 1) facts.buildings_on_parcel = positive(row.BuildingCount);
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.HtdSqFt));
    put(facts, 'bedrooms', inRange(row.BEDROOMS, 15));
    put(facts, 'bathrooms', inRange(row.BATHROOMS, 12));
    put(facts, 'style', text(row.DwellingStyleDescription));
    put(facts, 'condition', condition(row.Condition));
    put(facts, 'heating', text(row.HeatDes1));
    put(facts, 'fireplaces', inRange(row.FireplaceCount, 10));
  } else if (kind === 'building') {
    put(facts, 'gross_sqft', positive(row.HtdSqFt));
  }
  // A condominium unit's acreage is its share of the complex, so it gets no lot.
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.LegalAcres) || positive(row.GISacres));
  put(facts, 'assessed_value', positive(row.Total_EMV));
  put(facts, 'assessed_land_value', positive(row.LAND_VALUE));
  put(facts, 'assessed_building_value', positive(row.STRUC_VAL));
  // Only sales the county marks qualified carry a price worth showing.
  const saleDate = isoDate(row.SaleDate);
  if (String(row.IsQualified ?? '').trim() === '1' && saleDate && saleDate >= '1900' && saleDate <= latest && isHomeSale(positive(row.SALE_PRICE))) {
    put(facts, 'sale_price', positive(row.SALE_PRICE));
    put(facts, 'sale_date', saleDate);
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(row.SITE_CITY ?? '').replace(/\s+/g, ' ').trim().toUpperCase(), zip: null }, facts };
}

async function* build({ work, today }) {
  const latest = isoDate(today.getTime());
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  for await (const row of cached(path.join(work, 'nc-carteret', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS, { pageSize: 1000 }))) {
    const record = fromRow(row, latest);
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'NC', name: COUNTY, publisher: 'Carteret County', dataset: 'tax parcels', method: 'county', source: 'nc-carteret', as_of: latest, stale_after_days: 450, notice: 'provided as is, without warranty', extra_zips: zipsByCounty(work, ['37']).get(FIPS) || [], records: list,
  };
}

// The parcel layer's own shapes, by the parcel number each record carries (the same columns): what lib/measure.cjs
// measures a lot's area and counts its buildings on (measured rows, held off until the county's measured_rows switch is on).
const parcelShapes = { url: LAYER, fields: ['PIN15'], key: (row) => word(row.PIN15) };

module.exports = {
  parcelShapes,
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'Y_BLT_HOUSE', living_sqft: 'HtdSqFt', gross_sqft: 'HtdSqFt', bedrooms: 'BEDROOMS', bathrooms: 'BATHROOMS', fireplaces: 'FireplaceCount', lot_acres: 'LegalAcres', assessed_value: 'Total_EMV', assessed_land_value: 'LAND_VALUE', assessed_building_value: 'STRUC_VAL', sale_price: 'SALE_PRICE', sale_date: 'SaleDate' },
  },
};
