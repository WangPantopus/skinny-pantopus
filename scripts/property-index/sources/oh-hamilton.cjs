'use strict';
// Hamilton County, Ohio: the Auditor's parcel attributes, on the county's CAGIS map services, which it provides as is with no warranty. Land
// use, lot, market values and the last sale; its files have no year built, floor area, bedrooms or baths. Owner, mailing, homestead,
// delinquency and tax columns are in the layer and never asked for. It has no ZIP or city for a site, so the county's ZIPs come from the Census.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { isoDate, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '39061';
const COUNTY = 'Hamilton County';
const LAYER = 'https://cagisonline.hamilton-co.org/arcgis/rest/services/COUNTYWIDE/Cadastral/MapServer/2';
const COLUMNS = ['PARCELID', 'AUDPTYID', 'ADDRNO', 'ADDRST', 'ADDRSF', 'UNIT', 'LOC_ST_DIR', 'CLASS', 'MKTLND', 'MKTIMP', 'MKT_TOTAL_VAL', 'SALDAT', 'SALAMT', 'ACREDEED', 'LGLDS1', 'LGLDS2'];
const USE_WORDS = { 500: 'Residential vacant land', 501: 'Residential vacant land', 508: 'Residential vacant land', 510: 'Single-family dwelling', 520: 'Two-family dwelling', 530: 'Three-family dwelling', 550: 'Condominium', 555: 'Condominium', 560: 'Mobile home' };

function useOf(code, hasUnit) {
  const c = Number(code);
  if (c === 510) return hasUnit ? ['unit', 'condo'] : ['property', 'house'];
  if (c === 550 || c === 555) return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (c === 520 || c === 530) return ['building', 'multi_unit'];
  if (c === 560) return ['property', 'mobile_home'];
  if (c === 500 || c === 501 || c === 508 || c === 400 || c === 300 || c === 600) return ['parcel', null];
  return ['other', null];
}

function fromRow(row) {
  const unit = realUnit(row.UNIT);
  const address = streetParts({ number: row.ADDRNO, pre: row.LOC_ST_DIR, name: row.ADDRST, suffix: row.ADDRSF, unit });
  const parcel = word(row.PARCELID) || word(row.AUDPTYID);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.CLASS, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  put(facts, 'address_on_record', onRecord([row.ADDRNO, row.LOC_ST_DIR, row.ADDRST, row.ADDRSF].map((part) => String(part ?? '').trim()).filter(Boolean).join(' '), row.UNIT));
  put(facts, 'land_use', USE_WORDS[Number(row.CLASS)]);
  put(facts, 'county_use_code', word(row.CLASS));
  put(facts, 'legal_description', [word(row.LGLDS1), word(row.LGLDS2)].filter(Boolean).join(' ').slice(0, 300) || null);
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.ACREDEED));
  put(facts, 'market_value', positive(row.MKT_TOTAL_VAL));
  put(facts, 'market_land_value', positive(row.MKTLND));
  put(facts, 'market_building_value', positive(row.MKTIMP));
  if (positive(row.SALAMT) > 100 && isoDate(row.SALDAT)) {
    facts.sale_price = positive(row.SALAMT);
    facts.sale_date = isoDate(row.SALDAT);
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: '', zip: null }, facts };
}

async function* build({ work, today }) {
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'oh-hamilton', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS, { where: "CURYR_FLAG = 'Y'", oid: 'OBJECTID', pageSize: 1000 }))) {
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
    fips: FIPS, state: 'OH', name: COUNTY, publisher: 'Hamilton County Auditor', dataset: 'parcel attributes', method: 'county', source: 'oh-hamilton', as_of: today.toISOString().slice(0, 10), stale_after_days: 730, extra_zips: zipsByCounty(work, ['39']).get(FIPS) || [], records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: [LAYER],
    facts: { lot_acres: 'ACREDEED', market_value: 'MKT_TOTAL_VAL', market_land_value: 'MKTLND', market_building_value: 'MKTIMP', sale_price: 'SALAMT', sale_date: 'SALDAT', land_use: 'CLASS', legal_description: 'LGLDS1' },
  },
};
