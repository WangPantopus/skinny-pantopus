'use strict';
// Collin County, Texas: the Collin Central Appraisal District's yearly appraisal table on the Texas Open Data Portal, where
// it invites anyone to "filter, sort, query, and export" its data, disclaiming liability for errors. Year built, main
// area, land and market values; no bedrooms or baths; sale prices aren't public in Texas. Owner, mailing, exemption and
// deed columns are never asked for: the owner column is only used to ask the portal which accounts are marked protected.
// An account in an undivided-interest group holds a share of a home, so the group is one record, without the share's value.

const path = require('node:path');
const { getJson, socrataRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { CATEGORY_WORDS, protectedWhere, useOf } = require('../lib/texas.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '48085';
const COUNTY = 'Collin County';
const DOMAIN = 'data.texas.gov';
const COLUMNS = ['propid', 'geoid', 'proptype', 'propcategorycode', 'udipropflag', 'udigroupid', 'situsbldgnum', 'situsstreetprefix', 'situsstreetname', 'situsstreetsuffix', 'situsunit', 'situscity', 'situszip', 'situsconcatshort', 'legaldescription', 'legalabssubname',
  'imprvyearbuilt', 'imprvmainarea', 'imprvunits', 'imprvpoolflag', 'landsizeacres', 'landsizesqft', 'currvalmarket', 'currvalland', 'currvalimprv', 'currvalyear'];

// The district starts a new table each year: the newest "Appraisal Data - <year>".
async function latestTable() {
  const found = await getJson(`https://${DOMAIN}/api/catalog/v1?${new URLSearchParams({ q: 'Collin CAD Appraisal Data', domains: DOMAIN, limit: '40' })}`, 'The portal\'s catalog');
  const tables = (found.results || []).map(({ resource }) => ({ id: resource.id, updated: resource.data_updated_at || resource.updatedAt, year: Number(/^Collin CAD Appraisal Data - (\d{4})$/.exec(resource.name)?.[1]) })).filter((table) => table.year);
  if (!tables.length) throw new Error('The portal no longer lists Collin\'s yearly table');
  return tables.sort((a, b) => b.year - a.year)[0];
}

function fromRow(row) {
  const address = streetParts({ number: row.situsbldgnum, pre: row.situsstreetprefix, name: row.situsstreetname, suffix: row.situsstreetsuffix, unit: realUnit(row.situsunit) });
  const account = word(row.udipropflag === true ? row.udigroupid : row.propid);
  if (!address || !account) return null;
  const built = year(row.imprvyearbuilt);
  const living = positive(row.imprvmainarea);
  const code = String(word(row.propcategorycode) || '').toUpperCase();
  const [kind, homeType] = useOf(code, address.unit, Boolean(built || living));
  const facts = { parcel_number: word(row.geoid) || account, county: COUNTY, fips: FIPS };
  const on = kind === 'property' || kind === 'unit' || kind === 'building';
  put(facts, 'address_on_record', onRecord(word(row.situsconcatshort), row.situsunit));
  put(facts, 'land_use', CATEGORY_WORDS[code[0]]);
  put(facts, 'county_use_code', code);
  put(facts, 'subdivision', word(row.legalabssubname));
  put(facts, 'legal_description', word(row.legaldescription)?.slice(0, 300));
  if (on) put(facts, 'year_built', built);
  if (kind === 'property' || kind === 'unit') {
    put(facts, 'living_sqft', living);
    if (row.imprvpoolflag === true) facts.pool = 'Yes';
  } else if (kind === 'building') {
    put(facts, 'gross_sqft', living);
    put(facts, 'units', positive(row.imprvunits));
  }
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.landsizeacres) || (positive(row.landsizesqft) ? Number((positive(row.landsizesqft) / 43560).toFixed(4)) : null));
  if (row.udipropflag !== true) {
    put(facts, 'value_year', positive(row.currvalyear));
    put(facts, 'market_value', positive(row.currvalmarket));
    put(facts, 'market_land_value', positive(row.currvalland));
    put(facts, 'market_building_value', positive(row.currvalimprv));
  }
  return { id: `pp:${kind}:${FIPS}:${account}`, kind, home_type: homeType, address: { ...address, city: String(word(row.situscity) || '').toUpperCase(), zip: zipCode(row.situszip) }, facts };
}

async function* build({ work }) {
  const table = await latestTable();
  const asOf = isoDate(table.updated);
  if (!asOf) throw new Error('The portal no longer says when the table changed');
  log(`table ${table.id}, ${table.year}`);
  const hidden = new Set();
  for await (const row of socrataRows(DOMAIN, table.id, ['propid'], { where: protectedWhere('ownername') })) hidden.add(row.propid);
  log(`${hidden.size} accounts marked protected`);
  const records = new Map();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'tx-collin', `${table.year}.jsonl.gz`), () => socrataRows(DOMAIN, table.id, COLUMNS, { where: "proptype in('Real','Mobile Home')" }))) {
    if (hidden.has(row.propid)) continue;
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (!records.has(record.id) || Object.keys(record.facts).length > Object.keys(records.get(record.id).facts).length) records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} accounts, ${noAddress} without a street number`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'TX', name: COUNTY, publisher: 'Collin Central Appraisal District', dataset: 'appraisal data', method: 'county', source: 'tx-collin', as_of: asOf, stale_after_days: 450, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    socrata: { domain: DOMAIN, ids: ['5tkr-3759'] },
    facts: { year_built: 'imprvyearbuilt', living_sqft: 'imprvmainarea', gross_sqft: 'imprvmainarea', units: 'imprvunits', lot_acres: 'landsizeacres', market_value: 'currvalmarket', market_land_value: 'currvalland', market_building_value: 'currvalimprv', value_year: 'currvalyear', subdivision: 'legalabssubname', legal_description: 'legaldescription' },
  },
};
