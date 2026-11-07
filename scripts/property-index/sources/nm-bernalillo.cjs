'use strict';
// Bernalillo County, New Mexico: the Assessor's public parcel service. No terms are stated on it. Owner, mailing and exemption columns are
// in the layer and never asked for. TOTVALUE is the Assessor's full value; New Mexico taxes a third of it. Sale prices aren't public in New
// Mexico. No bedrooms or baths.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '35001';
const COUNTY = 'Bernalillo County';
const LAYER = 'https://assessormap.bernco.gov/server/rest/services/GIS/Public_Assessor_Parcels/MapServer/0';
const COLUMNS = ['UPC', 'TAXYR', 'TXTUNIT', 'SITUSNUM', 'SITUSSTR', 'SITUSSTRTY', 'SITUSDIREC', 'SITUSCITY', 'SITUSZIP', 'TAXDIST', 'LEGALDESC', 'PROPCLASS', 'LANDVALUE', 'IMPTVALUE', 'TOTVALUE', 'NETTAXABLE', 'PAR_CALCAC', 'LUC', 'LUC_MSG', 'STYLE', 'C_DESCR', 'DWEL_YRBLT'];

function useOf(row, unit) {
  const style = String(row.STYLE || '').toUpperCase().trim();
  const commercial = String(row.C_DESCR || '').toUpperCase();
  const propertyClass = String(row.PROPCLASS || '').toUpperCase();
  if (/CONDO/.test(style)) return ['unit', 'condo'];
  if (/TOWNHOUSE|PATIO/.test(style)) return ['property', 'townhouse'];
  if (/MOBILE/.test(style)) return ['property', 'mobile_home'];
  if (/DUPLEX|TRIPLEX|FOURPLEX/.test(style)) return ['building', 'multi_unit'];
  if (/APARTMENT/.test(commercial)) return ['building', 'apartment'];
  if (propertyClass === 'V') return ['parcel', null];
  if (propertyClass === 'R' && style) return unit ? ['unit', 'condo'] : ['property', 'house'];
  return ['other', null];
}

function fromRow(row) {
  const unit = realUnit(word(row.TXTUNIT));
  // SITUSDIREC is a quadrant, after the street: 123 MAIN ST NW.
  const address = streetParts({ number: row.SITUSNUM, name: word(row.SITUSSTR) || '', suffix: word(row.SITUSSTRTY) || '', post: word(row.SITUSDIREC) || '', unit });
  const parcel = word(row.UPC);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([row.SITUSNUM, row.SITUSSTR, row.SITUSSTRTY, row.SITUSDIREC].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'land_use', word(row.LUC_MSG));
  put(facts, 'county_use_code', word(row.LUC));
  put(facts, 'tax_code_area', word(row.TAXDIST));
  put(facts, 'legal_description', word(row.LEGALDESC)?.slice(0, 300));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.DWEL_YRBLT));
    put(facts, 'style', word(row.STYLE));
  }
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.PAR_CALCAC));
  put(facts, 'value_year', positive(row.TAXYR));
  put(facts, 'market_value', positive(row.TOTVALUE));
  put(facts, 'market_land_value', positive(row.LANDVALUE));
  put(facts, 'market_building_value', positive(row.IMPTVALUE));
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.SITUSCITY) || '').toUpperCase(), zip: zipCode(row.SITUSZIP) }, facts };
}

async function* build({ work, today }) {
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'nm-bernalillo', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
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
    fips: FIPS, state: 'NM', name: COUNTY, publisher: 'Bernalillo County Assessor', dataset: 'public assessor parcels', method: 'county', source: 'nm-bernalillo', as_of: isoDate(today.getTime()), stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'DWEL_YRBLT', lot_acres: 'PAR_CALCAC', market_value: 'TOTVALUE', market_land_value: 'LANDVALUE', market_building_value: 'IMPTVALUE', value_year: 'TAXYR' },
  },
};
