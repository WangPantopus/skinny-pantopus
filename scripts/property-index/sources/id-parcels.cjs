'use strict';
// Idaho: the Governor's Office of Information Technology Services' Public Idaho Parcels, from the 13 counties that share
// theirs, with the counties' improvement table: year built, size, stories, bedrooms, baths and heating where a county fills
// them. Terms (read November 7, 2026): no warranty, used at the user's risk, and not for use as a mailing or telephone list
// (Idaho Code 74-120); nothing here is either. Idaho assesses at market value. Owner, mailing and homeowner-exemption columns
// are never asked for.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { layerRows, cached } = require('../lib/services.cjs');
const { year, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const BASE = 'https://services1.arcgis.com/CNPdEkvnGl65jCX8/arcgis/rest/services/Public_Idaho_Parcels_/FeatureServer';
const PARCELS = `${BASE}/0`;
const IMPROVEMENTS = `${BASE}/8`;
const COUNTIES = {
  16001: 'Ada', 16007: 'Bear Lake', 16015: 'Boise', 16025: 'Camas', 16047: 'Gooding', 16053: 'Jerome', 16063: 'Lincoln', 16067: 'Minidoka', 16069: 'Nez Perce', 16071: 'Oneida',
  16081: 'Teton', 16085: 'Valley', 16087: 'Washington',
};
const PARCEL_COLUMNS = ['PARCEL_ID', 'County', 'UPDATED', 'FIPS', 'ASR_ACRES', 'SITE_ADD', 'SITE_CITY', 'SITE_ZIP', 'ASR_CATS', 'LGL_DESCR', 'VAL_LAND', 'VAL_IMPVTS', 'VAL_TOTAL'];
const IMPROVEMENT_COLUMNS = ['PARCEL_ID', 'COUNTY', 'YEAR_BLD', 'IMP_TYPE', 'IMP_DESCR', 'EFF_YR_BLD', 'TOT_SQFT', 'NUM_STORY', 'NUM_BED', 'NUM_BATH', 'GARAGE_Y_N', 'SQFT_FLR_1', 'SQFT_FLR_2', 'SQFT_BSMNT', 'HEAT_TYPE', 'NUM_FIREPL'];
// Idaho's assessment categories that mean commercial or industrial land or improvements, or exempt property.
const NOT_HOMES = /\|?(2[1-5]|3[89]|4[2-5]|5\d|6\d|7\d|8\d|9\d)(\.0)?\|?/;
const HEAT = (text) => {
  const value = word(String(text ?? '').trim());
  return value && !/^(undefined|none|unknown)$/i.test(value) ? value.replace(/^F\.?\/?A\.? /i, 'Forced air ').replace(/^Elect BSBD$/i, 'Electric baseboard') : null;
};

/** Each parcel's dwelling: the residential improvement with the most floor area, and how many there are. */
async function dwellingsOf(work, county) {
  const dwellings = new Map();
  const rows = cached(path.join(work, 'id-parcels', `improvements-${county}.jsonl.gz`), () => layerRows(IMPROVEMENTS, IMPROVEMENT_COLUMNS, { where: `COUNTY = '${county}'` }));
  for await (const row of rows) {
    const type = String(row.IMP_TYPE ?? '').trim().toUpperCase();
    // RP residential, MH a manufactured home; a county that types none fills the house's own columns.
    if (type && type !== 'RP' && type !== 'MH') continue;
    if (!year(row.YEAR_BLD) && !positive(row.TOT_SQFT) && !positive(row.NUM_BED)) continue;
    const parcel = word(row.PARCEL_ID);
    if (!parcel) continue;
    const held = dwellings.get(parcel);
    if (!held) dwellings.set(parcel, { count: 1, row, mobile: type === 'MH' });
    else {
      held.count += 1;
      if ((positive(row.TOT_SQFT) || 0) > (positive(held.row.TOT_SQFT) || 0)) Object.assign(held, { row, mobile: type === 'MH' });
    }
  }
  return dwellings;
}

function dwellingFacts(row, count) {
  const facts = {};
  put(facts, 'year_built', year(row.YEAR_BLD));
  put(facts, 'effective_year_built', year(row.EFF_YR_BLD));
  // The counties' total square feet can count a finished basement: it reads as usable area, not living area.
  put(facts, 'usable_sqft', positive(row.TOT_SQFT));
  put(facts, 'ground_floor_sqft', positive(row.SQFT_FLR_1));
  put(facts, 'second_floor_sqft', positive(row.SQFT_FLR_2));
  put(facts, 'basement_sqft', positive(row.SQFT_BSMNT));
  put(facts, 'stories', positive(row.NUM_STORY));
  const bedrooms = positive(row.NUM_BED);
  if (bedrooms && bedrooms < 30) facts.bedrooms = bedrooms;
  const baths = positive(row.NUM_BATH);
  if (baths && baths < 30) facts.bathrooms = baths;
  put(facts, 'heating', HEAT(row.HEAT_TYPE));
  put(facts, 'fireplaces', positive(row.NUM_FIREPL));
  if (String(row.GARAGE_Y_N ?? '').trim().toUpperCase() === 'Y') facts.garage = 'Garage';
  if (count > 1) facts.buildings_on_parcel = count;
  return facts;
}

function fromRow(row, fips, county, dwellings) {
  const parsed = parse(row.SITE_ADD);
  const parcel = word(row.PARCEL_ID);
  if (!parsed || !parcel) return null;
  const dwelling = dwellings.get(parcel);
  const categories = String(row.ASR_CATS ?? '');
  let kind;
  let homeType = null;
  if (dwelling) [kind, homeType] = parsed.unit ? ['unit', 'condo'] : ['property', dwelling.mobile ? 'mobile_home' : 'house'];
  else kind = NOT_HOMES.test(categories) || positive(row.VAL_IMPVTS) ? 'other' : 'parcel';
  const facts = { parcel_number: parcel, county, fips };
  put(facts, 'address_on_record', onRecord(row.SITE_ADD, ''));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.ASR_ACRES));
  put(facts, 'county_use_code', word(categories.replace(/^\||\|$/g, '').replace(/\.0\b/g, '')));
  put(facts, 'legal_description', word(row.LGL_DESCR)?.slice(0, 300));
  put(facts, 'market_value', positive(row.VAL_TOTAL));
  put(facts, 'market_land_value', positive(row.VAL_LAND));
  put(facts, 'market_building_value', positive(row.VAL_IMPVTS));
  if (dwelling) Object.assign(facts, dwellingFacts(dwelling.row, dwelling.count));
  return { id: `pp:${kind}:${fips}:${parcel}`, kind, home_type: homeType, address: { ...parsed, city: String(word(row.SITE_CITY) || '').toUpperCase(), zip: zipCode(row.SITE_ZIP) }, facts };
}

async function* build({ work }) {
  const only = (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  for (const [fips, name] of Object.entries(COUNTIES)) {
    if (only.length && !only.includes(fips)) continue;
    const county = `${name} County`;
    const dwellings = await dwellingsOf(work, name);
    const records = [];
    const seen = new Set();
    let noAddress = 0;
    let asOf = null;
    const rows = cached(path.join(work, 'id-parcels', `${fips}.jsonl.gz`), () => layerRows(PARCELS, PARCEL_COLUMNS, { where: `County = '${name}'` }));
    for await (const row of rows) {
      const updated = Number(row.UPDATED) ? new Date(Number(row.UPDATED)).toISOString().slice(0, 10) : null;
      if (updated && (!asOf || updated > asOf)) asOf = updated;
      const record = fromRow(row, fips, county, dwellings);
      if (!record) noAddress += 1;
      else if (!seen.has(record.id)) {
        seen.add(record.id);
        records.push(record);
      }
    }
    log(`${county}: ${records.length} records, ${noAddress} without a street number, ${dwellings.size} dwellings in the improvement table`);
    if (!records.length) continue;
    if (!asOf) throw new Error(`${county}'s parcels no longer say when they were updated`);
    for (const building of condoBuildings(records, { fips, county })) records.push(building);
    yield {
      fips, state: 'ID', name: county, publisher: `${county} Assessor, through Idaho's Office of Information Technology Services`, dataset: 'Public Idaho Parcels and improvements', method: 'state', source: 'id-parcels', title: 'State records', as_of: asOf, stale_after_days: 550, records,
    };
  }
}

module.exports = { build };
