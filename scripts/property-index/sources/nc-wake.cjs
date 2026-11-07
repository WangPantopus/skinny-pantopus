'use strict';
// Wake County, North Carolina: the county's parcels map service, with its notice that it isn't liable for errors. Year built,
// heated area, style, units, values and the last sale; no bedrooms or baths. Owner, mailing and exemption columns are never
// asked for. Assessed values stand at the county's last revaluation.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '37183';
const COUNTY = 'Wake County';
const LAYER = 'https://maps.wake.gov/arcgis/rest/services/Property/Parcels/MapServer/0';
const COLUMNS = ['REID', 'PIN_NUM', 'STNUM', 'STPRE', 'STNAME', 'STYPE', 'STSUF', 'STMISC', 'SITE_ADDRESS', 'CITY_DECODE', 'ZIPNUM', 'PROPDESC', 'DEED_ACRES', 'LAND_VAL', 'BLDG_VAL', 'TOTAL_VALUE_ASSD', 'HEATEDAREA', 'YEAR_BUILT', 'TOTSALPRICE', 'SALE_DATE', 'TYPE_USE_DECODE', 'DESIGN_STYLE_DECODE', 'UNITS', 'TOTUNITS', 'LAND_CLASS_DECODE'];

function useOf(use, style, land, hasUnit) {
  const [u, s, l] = [use, style, land].map((text) => String(text ?? '').toUpperCase());
  if (u === 'MOBILE' || u === 'PREFAB' || /^MANUF/.test(s) || /^MANUFACTURED HOME/.test(l)) return ['property', 'mobile_home'];
  if (u === 'SINGLFAM' || u === 'RES CONV') {
    if (s === 'CONDO' || /CONDO/.test(l)) return ['unit', 'condo'];
    if (s === 'TOWNHOUSE') return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
    return hasUnit ? ['unit', 'condo'] : ['property', 'house'];
  }
  if (u === 'TWOFAM' || u === 'THREEFAM' || u === 'FOURFAM') return ['building', 'multi_unit'];
  if (/ APT$/.test(u)) return ['building', 'apartment'];
  if (!u && /VACANT|AGRIC|FOREST|HORTIC|ACRE/.test(l)) return ['parcel', null];
  return ['other', null];
}

function fromRow(row) {
  const unit = realUnit(row.STMISC);
  const address = streetParts({ number: row.STNUM, pre: row.STPRE, name: row.STNAME, suffix: row.STYPE, post: row.STSUF, unit });
  const parcel = word(row.REID) || word(row.PIN_NUM);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.TYPE_USE_DECODE, row.DESIGN_STYLE_DECODE, row.LAND_CLASS_DECODE, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(word(row.SITE_ADDRESS), row.STMISC));
  put(facts, 'land_use', word(row.TYPE_USE_DECODE) || word(row.LAND_CLASS_DECODE));
  put(facts, 'legal_description', word(row.PROPDESC)?.slice(0, 300));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.YEAR_BUILT));
    put(facts, 'style', /^(NONE|CONVERSION)$/i.test(row.DESIGN_STYLE_DECODE || '') ? null : word(row.DESIGN_STYLE_DECODE));
  }
  if (home) put(facts, 'living_sqft', positive(row.HEATEDAREA));
  else if (kind === 'building') {
    put(facts, 'gross_sqft', positive(row.HEATEDAREA));
    put(facts, 'units', positive(row.TOTUNITS) || positive(row.UNITS));
  }
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.DEED_ACRES));
  put(facts, 'assessed_value', positive(row.TOTAL_VALUE_ASSD));
  put(facts, 'assessed_land_value', positive(row.LAND_VAL));
  put(facts, 'assessed_building_value', positive(row.BLDG_VAL));
  if (positive(row.TOTSALPRICE) > 100 && isoDate(row.SALE_DATE)) {
    facts.sale_price = positive(row.TOTSALPRICE);
    facts.sale_date = isoDate(row.SALE_DATE);
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.CITY_DECODE) || '').toUpperCase(), zip: zipCode(row.ZIPNUM) }, facts };
}

async function* build({ work, today }) {
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'nc-wake', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS, { oid: 'OBJECTID' }))) {
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
    fips: FIPS, state: 'NC', name: COUNTY, publisher: 'Wake County', dataset: 'parcels', method: 'county', source: 'nc-wake', as_of: today.toISOString().slice(0, 10), stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: [LAYER],
    facts: { year_built: 'YEAR_BUILT', living_sqft: 'HEATEDAREA', gross_sqft: 'HEATEDAREA', units: 'TOTUNITS', style: 'DESIGN_STYLE_DECODE', lot_acres: 'DEED_ACRES', assessed_value: 'TOTAL_VALUE_ASSD', assessed_land_value: 'LAND_VAL', assessed_building_value: 'BLDG_VAL', sale_price: 'TOTSALPRICE', sale_date: 'SALE_DATE', land_use: 'TYPE_USE_DECODE', legal_description: 'PROPDESC' },
  },
};
