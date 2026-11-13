'use strict';
// The City and County of Broomfield, Colorado: its parcels with each account's Assessor facts, on its open data account. Its notice says it has made
// every effort to keep the data accurate, that use is the user's sole responsibility and that it takes no liability; it states no license and no
// limit on use. Year built, living area, bedrooms, baths, style, stories, roof, finished basement, garage, parcel size, actual (market) values
// and the last sale. Owner, care-of and owner address columns are never asked for. Condominium accounts carry no building facts here. Parcels
// carry no site city or ZIP, so the county's ZIPs come from the Census.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { streetParts, year, isoDate, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { hold } = require('../lib/held.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '08014';
const COUNTY = 'Broomfield County';
const LAYER = 'https://services1.arcgis.com/vXSRPZbyyOmH9pek/arcgis/rest/services/Parcels/FeatureServer/0';
const COLUMNS = ['PARCELNUMBER', 'ACCOUNTNUMBER', 'ACCOUNTTYPE', 'ZONING', 'ACTUALYEARBUILT', 'ARCHITECTURESTYLE', 'BATHS', 'BEDROOMS', 'FINALACTUALVALUE', 'IMPROVEMENTSACTUAL', 'LANDACTUAL', 'LEGALSUMMARY', 'LIVINGAREA', 'PARCELSIZE', 'PARCELSIZEUNITOFMEASURE', 'PLATTEDSUBDIVISION', 'PROPERTYUSE', 'ROOFCOVER', 'SALEDOCUMENTTYPE', 'SALEDATE', 'SALEPRICE', 'STORIES', 'SUBAREA_BSMTFN', 'SUBAREA_GARATT', 'SUBAREA_GARDET', 'TAXYEAR', 'UNITS', 'GIS_ACRES', 'SITUS_ADDRESS_NUMBER', 'SITUS_ADDRESS_NUMBER_SUFFIX', 'SITUS_STREET_PREDIRECTIONAL', 'SITUS_STREET_PRETYPE', 'SITUS_STREET_NAME', 'SITUS_STREET_POSTTYPE', 'SITUS_STREET_POSTDIRECTIONAL', 'SITUS_UNIT_TYPE', 'SITUS_UNIT_IDENTIFIER', 'PLATTEDLOT'];

// The Assessor's property use words.
function useOf(use, unit) {
  const u = String(use || '').replace(/\s+/g, ' ').trim().toUpperCase();
  if (u === 'RESIDENTIAL SINGLE FAMILY') return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (u === 'RESIDENTIAL TOWNHOUSE') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (u === 'RESIDENTIAL CONDOMINIUM') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (u === 'RESIDENTIAL DUPLEX TRIPLEX') return ['building', 'multi_unit'];
  if (/^APARTMENT /.test(u)) return ['building', 'apartment'];
  if (u === 'RESIDENTIAL LAND' || u === 'COMMON AREA RESIDENTIAL') return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function fromRow(row) {
  const number = String(row.SITUS_ADDRESS_NUMBER ?? '').trim();
  const unit = word(row.SITUS_UNIT_IDENTIFIER) || '';
  const name = [row.SITUS_STREET_PRETYPE, row.SITUS_STREET_NAME].map(word).filter(Boolean).join(' ');
  const address = /^\d+$/.test(number) && name ? streetParts({ number, numberSuffix: word(row.SITUS_ADDRESS_NUMBER_SUFFIX) || '', pre: word(row.SITUS_STREET_PREDIRECTIONAL) || '', name, suffix: word(row.SITUS_STREET_POSTTYPE) || '', post: word(row.SITUS_STREET_POSTDIRECTIONAL) || '', unit }) : null;
  const parcel = word(row.ACCOUNTNUMBER) || word(row.PARCELNUMBER);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.PROPERTYUSE, address.unit);
  const facts = { parcel_number: word(row.PARCELNUMBER) || parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([number, word(row.SITUS_ADDRESS_NUMBER_SUFFIX), row.SITUS_STREET_PREDIRECTIONAL, name, row.SITUS_STREET_POSTTYPE, row.SITUS_STREET_POSTDIRECTIONAL].map(word).filter(Boolean).join(' '), [word(row.SITUS_UNIT_TYPE), unit].filter(Boolean).join(' ')));
  put(facts, 'land_use', word(row.PROPERTYUSE));
  put(facts, 'property_class', word(row.ACCOUNTTYPE));
  put(facts, 'subdivision', word(row.PLATTEDSUBDIVISION));
  put(facts, 'zoning', word(row.ZONING));
  put(facts, 'legal_description', word(row.LEGALSUMMARY)?.slice(0, 300));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.ACTUALYEARBUILT));
    put(facts, 'style', word(row.ARCHITECTURESTYLE));
    put(facts, 'stories', inRange(row.STORIES, 5));
    put(facts, 'roof_cover', word(row.ROOFCOVER));
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.LIVINGAREA));
    put(facts, 'bedrooms', inRange(row.BEDROOMS, 15));
    // Baths are written with a half bath as .5.
    put(facts, 'bathrooms', inRange(row.BATHS, 12));
    put(facts, 'basement_finished_sqft', positive(row.SUBAREA_BSMTFN));
    put(facts, 'garage_sqft', (positive(row.SUBAREA_GARATT) || 0) + (positive(row.SUBAREA_GARDET) || 0) || null);
  }
  if (kind === 'building') put(facts, 'units', inRange(row.UNITS, 2000));
  // A condominium's parcel is its share of the complex, so a condominium home gets no lot. Parcel size is in acres or square feet as its
  // unit column says; a parcel with none takes the GIS acreage.
  if (kind !== 'unit' && String(row.PROPERTYUSE || '').trim().toUpperCase() !== 'RESIDENTIAL CONDOMINIUM') {
    const size = positive(row.PARCELSIZE);
    const unitOfSize = String(row.PARCELSIZEUNITOFMEASURE || '').trim().toUpperCase();
    if (size && unitOfSize === 'SQFT') put(facts, 'lot_sqft', size);
    else if (size && unitOfSize === 'ACRE') put(facts, 'lot_acres', size);
    else put(facts, 'lot_acres', positive(row.GIS_ACRES));
  }
  // Colorado's actual (market) values for the tax year.
  put(facts, 'market_value', positive(row.FINALACTUALVALUE));
  put(facts, 'market_land_value', positive(row.LANDACTUAL));
  put(facts, 'market_building_value', positive(row.IMPROVEMENTSACTUAL));
  put(facts, 'value_year', positive(row.TAXYEAR));
  // A sale needs its date; a deed that only moves title (a quit claim, say) isn't one.
  const saleDate = isoDate(row.SALEDATE);
  if (saleDate && isHomeSale(positive(row.SALEPRICE), row.SALEDOCUMENTTYPE)) {
    put(facts, 'sale_price', positive(row.SALEPRICE));
    put(facts, 'sale_date', saleDate);
  }
  const record = { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: '', zip: null }, facts };
  // Read since the county went live, held off its screens until its new_columns switch is on (lib/held.cjs): the lot
  // the plat gives the parcel, where it names one (a condo unit's lot is the complex's, so it has none).
  const lot = String(row.PLATTEDLOT ?? '').trim();
  if (kind !== 'unit' && /^[0-9A-Z-]{1,8}$/i.test(lot) && !/^0+$/.test(lot)) hold(record, 'lot_number', lot.toUpperCase());
  return record;
}

async function* build({ work, today }) {
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  for await (const row of cached(path.join(work, 'co-broomfield', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} accounts, ${noAddress} without a street number, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'CO', name: COUNTY, publisher: 'City and County of Broomfield', dataset: 'parcels with Assessor data, open data', method: 'county', source: 'co-broomfield', as_of: isoDate(today.getTime()), stale_after_days: 450, extra_zips: zipsByCounty(work, ['08']).get(FIPS) || [], records: list,
  };
}

// The parcel layer's own shapes, by the parcel number each record carries (the same columns): what lib/measure.cjs
// measures a lot's area and counts its buildings on (measured rows, held off until the county's measured_rows switch is on).
const parcelShapes = { url: LAYER, fields: ['PARCELNUMBER', 'ACCOUNTNUMBER'], key: (row) => word(row.PARCELNUMBER) || word(row.ACCOUNTNUMBER) };

module.exports = {
  parcelShapes,
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'ACTUALYEARBUILT', living_sqft: 'LIVINGAREA', bedrooms: 'BEDROOMS', bathrooms: 'BATHS', stories: 'STORIES', basement_finished_sqft: 'SUBAREA_BSMTFN', garage_sqft: 'SUBAREA_GARATT', units: 'UNITS', lot_sqft: 'PARCELSIZE', lot_acres: 'PARCELSIZE', market_value: 'FINALACTUALVALUE', market_land_value: 'LANDACTUAL', market_building_value: 'IMPROVEMENTSACTUAL', value_year: 'TAXYEAR', sale_price: 'SALEPRICE', sale_date: 'SALEDATE' },
  },
};
