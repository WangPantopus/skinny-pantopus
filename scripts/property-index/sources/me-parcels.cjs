'use strict';
// Maine: the Maine GeoLibrary's parcels for organized towns, joined by state ID to the assessor table towns chose to
// share. Many towns share only a value or nothing at all. Published as "Access: Public. Use: User assumes risk." A
// value here is a town's assessment, at that town's own ratio. Owner columns aren't asked for.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { isoDate } = require('../lib/addresses.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const SERVICE = 'https://services1.arcgis.com/RbMX0mRVOFNTdLzd/arcgis/rest/services/Maine_Parcels_Organized_Towns/FeatureServer';
const COUNTIES = { '01': 'Androscoggin', '03': 'Aroostook', '05': 'Cumberland', '07': 'Franklin', '09': 'Hancock', 11: 'Kennebec', 13: 'Knox', 15: 'Lincoln', 17: 'Oxford', 19: 'Penobscot', 21: 'Piscataquis', 23: 'Sagadahoc', 25: 'Somerset', 27: 'Waldo', 29: 'Washington', 31: 'York' };
const PARCEL_COLUMNS = ['TOWN', 'STATE_ID', 'MAP_BK_LOT', 'PROP_LOC', 'PROPLOCNUM', 'TYPE'];
const ASSESSOR_COLUMNS = ['STATE_ID', 'LS_DATE', 'LS_PRICE', 'LS_BOOK', 'LS_PAGE', 'LAND_VAL', 'BLDG_VAL', 'LIV_UNITS', 'LOT_SIZE', 'LOT_UNITS', 'BLDG_SIZE', 'LAND_USE', 'LAND_USE_D', 'RES_AREA'];

// Towns follow the Massachusetts-style codes or their own words.
function useOf(row) {
  const words = String(row?.LAND_USE_D ?? '').toUpperCase();
  const code = /^\d{3}/.exec(String(row?.LAND_USE ?? '').trim())?.[0];
  if (/CONDO|^102|TIMESHARE/.test(words) || code === '102') return /TIMESHARE/.test(words) ? ['other', null] : ['unit', 'condo'];
  if (/MOBILE/.test(words) || code === '103') return ['property', 'mobile_home'];
  if (/TWO FAM|THREE FAM|2 FAM|3 FAM/.test(words) || code === '104' || code === '105') return ['building', 'multi_unit'];
  if (/UNITS|APART/.test(words) || code === '111' || code === '112') return ['building', 'apartment'];
  if (/VACANT|LAND|ACLN/.test(words) || code === '130' || code === '131' || code === '132') return ['parcel', null];
  if (/SINGLE|SFR/.test(words) || code === '101') return ['property', 'house'];
  // No use given: a value on a building is the most the file says.
  return positive(row?.BLDG_VAL) ? ['property', null] : ['parcel', null];
}

function fromRow(parcel, assessor, fips, county, town) {
  const line = word(parcel.PROP_LOC);
  const parsed = line ? parse(/^\d/.test(line) || !word(parcel.PROPLOCNUM) ? line : `${word(parcel.PROPLOCNUM)} ${line}`) : null;
  const id = word(parcel.STATE_ID);
  if (!parsed || !id) return null;
  const [kind, homeType] = useOf(assessor);
  const facts = { parcel_number: word(parcel.MAP_BK_LOT) || id, county, fips, municipality: town };
  const on = kind === 'property' || kind === 'unit' || kind === 'building';
  put(facts, 'address_on_record', line);
  if (assessor) {
    put(facts, 'living_sqft', kind === 'property' || kind === 'unit' ? positive(assessor.RES_AREA) : null);
    put(facts, 'gross_sqft', on ? positive(assessor.BLDG_SIZE) : null);
    if (kind === 'building') put(facts, 'units', positive(assessor.LIV_UNITS));
    if (kind !== 'unit') {
      const lotUnits = String(assessor.LOT_UNITS ?? '').trim().charAt(0).toUpperCase();
      if (lotUnits === 'A') put(facts, 'lot_acres', positive(assessor.LOT_SIZE));
      if (lotUnits === 'S') put(facts, 'lot_sqft', positive(assessor.LOT_SIZE));
    }
    const words = word(assessor.LAND_USE_D);
    put(facts, 'land_use', words && /[A-Za-z]/.test(words) ? words.replace(/\s+MDL.*$|\s+MLD.*$/i, '') : null);
    put(facts, 'county_use_code', word(assessor.LAND_USE));
    const [land, building] = [positive(assessor.LAND_VAL), positive(assessor.BLDG_VAL)];
    put(facts, 'assessed_land_value', land);
    put(facts, 'assessed_building_value', building);
    if (land || building) facts.assessed_value = (land || 0) + (building || 0);
    const sold = isoDate(assessor.LS_DATE);
    if (positive(assessor.LS_PRICE) > 100 && sold) {
      facts.sale_price = positive(assessor.LS_PRICE);
      facts.sale_date = sold;
      if (word(assessor.LS_BOOK) && word(assessor.LS_PAGE)) facts.sale_document = `Book ${word(assessor.LS_BOOK)}, Page ${word(assessor.LS_PAGE)}`;
    }
  }
  return { id: `pp:${kind}:${fips}:${id}`, kind, home_type: homeType, address: { ...parsed, city: town.toUpperCase(), zip: '' }, facts };
}

async function* build({ work }) {
  const only = (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  const info = await getJson(`${SERVICE}/10?f=json`, 'The layer\'s description');
  const asOf = isoDate(info.editingInfo?.dataLastEditDate || info.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The layer no longer says when it changed');
  const assessors = new Map();
  for await (const row of cached(path.join(work, 'me-parcels', 'assessors.jsonl.gz'), () => layerRows(`${SERVICE}/9`, ASSESSOR_COLUMNS))) {
    if (word(row.STATE_ID)) assessors.set(row.STATE_ID, row);
  }
  log(`${assessors.size} assessor rows`);
  const zips = zipsByCounty(work, ['23']);
  for (const [code, name] of Object.entries(COUNTIES)) {
    const fips = `23${code.padStart(2, '0').padStart(3, '0')}`;
    if (only.length && !only.includes(fips)) continue;
    const county = `${name} County`;
    const records = [];
    const seen = new Set();
    let noAddress = 0;
    let joined = 0;
    const rows = cached(path.join(work, 'me-parcels', `${fips}.jsonl.gz`), () => layerRows(`${SERVICE}/10`, PARCEL_COLUMNS, { where: `COUNTY = '${name}'` }));
    for await (const parcel of rows) {
      const assessor = assessors.get(parcel.STATE_ID);
      const town = String(word(parcel.TOWN) || '').toLowerCase().replace(/(^|\s)\S/g, (first) => first.toUpperCase());
      const record = fromRow(parcel, assessor, fips, county, town);
      if (!record) noAddress += 1;
      else if (!seen.has(record.id)) {
        seen.add(record.id);
        records.push(record);
        if (assessor) joined += 1;
      }
    }
    log(`${county}: ${records.length} records, ${joined} with an assessor row, ${noAddress} without a street number`);
    for (const building of condoBuildings(records, { fips, county })) records.push(building);
    yield {
      fips, state: 'ME', name: county, publisher: 'Maine GeoLibrary', dataset: 'organized towns\' parcels', method: 'state', source: 'me-parcels', title: 'State records', as_of: asOf, stale_after_days: 730, extra_zips: zips.get(fips) || [], records,
    };
  }
}

module.exports = { build };
