'use strict';
// New York: the Department of Taxation and Finance's "Property Assessment Data from Local Assessment Rolls" (data.ny.gov,
// 7vem-aaz7), every city and town's roll outside New York City, for the 23 counties whose parcels the state's public layer
// doesn't carry (ny-parcels.cjs reads those it does, and ny-monroe.cjs Monroe). Under the OPEN-NY terms (free use for lawful
// purposes). Each county's newest roll year; the class, lot frontage and depth, full market value and assessments. No building
// facts, and no ZIP: the county's ZIPs come from the Census list and the town tells apart the same street line in two towns.
// Owner, mailing and exemption columns are never asked for.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, socrataRows, cached } = require('../lib/services.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');
const { CLASSES } = require('./ny-parcels.cjs');

const DATASET = ['data.ny.gov', '7vem-aaz7'];
const COUNTIES = {
  Allegany: '36003', Cattaraugus: '36009', Chemung: '36015', Chenango: '36017', Clinton: '36019', Columbia: '36021', Delaware: '36025', Dutchess: '36027', Essex: '36031',
  Franklin: '36033', Fulton: '36035', Herkimer: '36043', Jefferson: '36045', Madison: '36053', Nassau: '36059', Niagara: '36063', Orleans: '36073', Saratoga: '36091',
  Schenectady: '36093', Schoharie: '36095', Seneca: '36099', Washington: '36115', Yates: '36123',
};
// Monroe has its own connector (ny-monroe.cjs); its towns' rolls are read only to compare that record with (lib/agreement.cjs).
const COMPARE_ONLY = { Monroe: '36055' };
const COLUMNS = ['roll_year', 'municipality_name', 'swis_code', 'print_key_code', 'parcel_address_number', 'parcel_address_street', 'parcel_address_suff', 'property_class', 'front', 'depth', 'school_district_name', 'full_market_value', 'assessment_land', 'assessment_total'];
// "Hempstead", "Glen Cove (city)", "Village of X": the town or city as a person would name it.
const townName = (name) => String(name ?? '').trim().toUpperCase().replace(/\s*\((CITY|TOWN|VILLAGE)\)$/, '').replace(/^(CITY|TOWN|VILLAGE) OF\s+/, '');

function fromRoll(row, fips, county) {
  const klass = String(row.property_class ?? '').trim().slice(0, 3);
  const [kind, homeType, useWord] = CLASSES[klass] || ['other', null, null];
  const line = [row.parcel_address_number, row.parcel_address_street, row.parcel_address_suff].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ');
  const parsed = parse(line);
  const printKey = word(row.print_key_code);
  if (!parsed || !printKey) return null;
  const facts = { parcel_number: printKey, county, fips };
  put(facts, 'address_on_record', word(line));
  put(facts, 'municipality', word(row.municipality_name));
  put(facts, 'school_district', word(row.school_district_name));
  // Frontage and depth in feet: a rectangle's area, for a lot that is one. Only when both are given.
  const front = positive(row.front);
  const depth = positive(row.depth);
  if (kind !== 'unit' && front && depth && front * depth < 4.4e7) facts.lot_sqft = Math.round(front * depth);
  put(facts, 'land_use', useWord);
  put(facts, 'county_use_code', klass || null);
  put(facts, 'value_year', positive(row.roll_year));
  put(facts, 'market_value', positive(row.full_market_value));
  put(facts, 'assessed_value', positive(row.assessment_total));
  put(facts, 'assessed_land_value', positive(row.assessment_land));
  return { id: `pp:${kind}:${fips}:${String(row.swis_code ?? '').trim()}-${printKey}`, kind, home_type: homeType, address: { ...parsed, city: townName(row.municipality_name), zip: '' }, facts };
}

async function* build({ work, compare = null }) {
  // A county build comparing its own record with this file (lib/agreement.cjs) asks for counties it otherwise leaves out.
  const only = compare || (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  const zips = zipsByCounty(work, ['36']);
  const years = new Map((await getJson(`https://${DATASET[0]}/resource/${DATASET[1]}.json?${new URLSearchParams({ $select: 'county_name,max(roll_year) AS year', $group: 'county_name' })}`, 'The roll years'))
    .map((row) => [row.county_name, Number(row.year)]));
  for (const [name, fips] of Object.entries(compare ? { ...COUNTIES, ...COMPARE_ONLY } : COUNTIES)) {
    if (only.length && !only.includes(fips)) continue;
    const rollYear = years.get(name);
    if (!rollYear) throw new Error(`The rolls no longer list ${name}`);
    const county = `${name} County`;
    const records = [];
    const seen = new Set();
    let noAddress = 0;
    const rows = cached(path.join(work, 'ny-rolls', `${fips}-${rollYear}.jsonl.gz`), () => socrataRows(...DATASET, COLUMNS, { where: `county_name='${name}' AND roll_year='${rollYear}'` }));
    for await (const row of rows) {
      const record = fromRoll(row, fips, county);
      if (!record) noAddress += 1;
      else if (!seen.has(record.id)) {
        seen.add(record.id);
        records.push(record);
      }
    }
    log(`${county}: ${records.length} records, ${noAddress} without a street number, roll year ${rollYear}`);
    if (!records.length) continue;
    for (const building of condoBuildings(records, { fips, county })) records.push(building);
    yield {
      fips, state: 'NY', name: county, publisher: `${name} County's cities and towns, through the New York State Department of Taxation and Finance`, dataset: 'Property Assessment Data from Local Assessment Rolls', method: 'state', source: 'ny-rolls', title: 'State records', as_of: `${rollYear}-07-01`, stale_after_days: 550, extra_zips: zips[fips] || [], records,
    };
  }
}

module.exports = { build };
