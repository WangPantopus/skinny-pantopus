'use strict';
// New Jersey: the state's composite of county parcels joined to MOD-IV, the assessors' tax list (NJ Office of GIS). The
// state asks that it be acknowledged, and its terms are otherwise a disclaimer. MOD-IV has year built and sales but no
// living area, bedrooms or baths. New Jersey assesses at a town's own ratio of market value, so a value here is only
// an assessment.
//
// The ST_ADDRESS, CITY_STATE, ZIP columns are the owner's mailing address, and aren't asked for: this file has no ZIP
// for the property itself. Daniel's Law protects covered people's home addresses by name; nothing here ties an address
// to a person.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate } = require('../lib/addresses.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const LAYER = 'https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/arcgis/rest/services/Parcels_Composite_NJ_WM/FeatureServer/0';
const COUNTIES = {
  ATLANTIC: '34001', BERGEN: '34003', BURLINGTON: '34005', CAMDEN: '34007', 'CAPE MAY': '34009', CUMBERLAND: '34011', ESSEX: '34013', GLOUCESTER: '34015', HUDSON: '34017', HUNTERDON: '34019', MERCER: '34021',
  MIDDLESEX: '34023', MONMOUTH: '34025', MORRIS: '34027', OCEAN: '34029', PASSAIC: '34031', SALEM: '34033', SOMERSET: '34035', SUSSEX: '34037', UNION: '34039', WARREN: '34041',
};
const COLUMNS = ['PAMS_PIN', 'PCLQCODE', 'PROP_CLASS', 'MUN_NAME', 'PROP_LOC', 'LAND_VAL', 'IMPRVT_VAL', 'NET_VALUE', 'LAST_YR_TX', 'BLDG_DESC', 'LAND_DESC', 'CALC_ACRE', 'DEED_BOOK', 'DEED_PAGE', 'DEED_DATE', 'YR_CONSTR', 'SALE_PRICE', 'DWELL'];
const USE_WORDS = { 1: 'Vacant land', 2: 'Residential, one to four families', '3A': 'Farm', '3B': 'Qualified farm', '4A': 'Commercial', '4B': 'Industrial', '4C': 'Apartments, five units or more' };

// "CALDWELL BORO TWP": a town's type isn't part of what people write on an envelope.
const townName = (name) => String(name ?? '').trim().toUpperCase().replace(/\s+(BORO|BOROUGH|TWP|TOWNSHIP|CITY|TOWN|VILLAGE|VILL)(\s+(TWP|BORO))?$/, '').trim();

function fromRow(row, fips, county) {
  const klass = String(row.PROP_CLASS ?? '').trim().toUpperCase();
  const description = `${row.BLDG_DESC || ''} ${row.LAND_DESC || ''}`.toUpperCase();
  const dwellings = positive(row.DWELL);
  const qualifier = word(row.PCLQCODE);
  let [kind, homeType] = ['other', null];
  if (klass === '1') kind = 'parcel';
  else if (klass === '4C') [kind, homeType] = ['building', 'apartment'];
  else if (klass === '2') {
    if (/CONDO/.test(description) || /^C/i.test(qualifier || '')) [kind, homeType] = ['unit', 'condo'];
    else if (dwellings > 1) [kind, homeType] = ['building', 'multi_unit'];
    else [kind, homeType] = /TOWN ?H/.test(description) ? ['property', 'townhouse'] : ['property', 'house'];
  }
  const parsed = parse(row.PROP_LOC);
  if (!parsed || !word(row.PAMS_PIN)) return null;
  const facts = { parcel_number: row.PAMS_PIN, county, fips };
  const on = kind === 'property' || kind === 'unit' || kind === 'building';
  put(facts, 'municipality', word(row.MUN_NAME));
  put(facts, 'address_on_record', word(row.PROP_LOC));
  put(facts, 'year_built', on ? year(row.YR_CONSTR) : null);
  if (kind === 'building') put(facts, 'units', dwellings);
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.CALC_ACRE));
  put(facts, 'land_use', USE_WORDS[klass] || null);
  put(facts, 'county_use_code', klass);
  put(facts, 'value_year', positive(row.LAST_YR_TX));
  put(facts, 'assessed_value', positive(row.NET_VALUE));
  put(facts, 'assessed_land_value', positive(row.LAND_VAL));
  put(facts, 'assessed_building_value', positive(row.IMPRVT_VAL));
  const sold = isoDate(row.DEED_DATE);
  if (positive(row.SALE_PRICE) > 100 && sold) {
    facts.sale_price = positive(row.SALE_PRICE);
    facts.sale_date = sold;
    if (word(row.DEED_BOOK) && word(row.DEED_PAGE)) facts.sale_document = `Book ${word(row.DEED_BOOK)}, Page ${word(row.DEED_PAGE)}`;
  }
  return { id: `pp:${kind}:${fips}:${row.PAMS_PIN}`, kind, home_type: homeType, address: { ...parsed, city: townName(row.MUN_NAME), zip: '' }, facts };
}

async function* build({ work }) {
  const only = (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  const info = await getJson(`${LAYER}?f=json`, 'The layer\'s description');
  const asOf = isoDate(info.editingInfo?.dataLastEditDate || info.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The layer no longer says when it changed');
  const zips = zipsByCounty(work, ['34']);
  for (const [name, fips] of Object.entries(COUNTIES)) {
    if (only.length && !only.includes(fips)) continue;
    const county = `${name.toLowerCase().replace(/(^|\s)\S/g, (first) => first.toUpperCase())} County`;
    const records = [];
    const seen = new Set();
    let noAddress = 0;
    const rows = cached(path.join(work, 'nj-modiv', `${fips}.jsonl.gz`), () => layerRows(LAYER, COLUMNS, { where: `COUNTY = '${name}'` }));
    for await (const row of rows) {
      const record = fromRow(row, fips, county);
      if (!record) noAddress += 1;
      else if (!seen.has(record.id)) {
        seen.add(record.id);
        records.push(record);
      }
    }
    log(`${county}: ${records.length} records, ${noAddress} without a street number`);
    for (const building of condoBuildings(records, { fips, county })) records.push(building);
    yield {
      fips, state: 'NJ', name: county, publisher: 'New Jersey Office of GIS', dataset: 'parcels and MOD-IV tax list', method: 'state', source: 'nj-modiv', title: 'State records', as_of: asOf, stale_after_days: 730, extra_zips: zips.get(fips) || [], records,
    };
  }
}

module.exports = { build };
