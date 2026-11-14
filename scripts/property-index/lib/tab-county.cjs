'use strict';
// A Texas appraisal district's "external" tables: a name-and-address table with situs, use code, heated area, year built and
// values, and a building elements table with bedrooms and plumbing. Only the named columns are read. The name column is read
// only to ask whether the district marked a protected person's account (Tax Code 25.025), then dropped; mailing and agent
// columns aren't read. Sale prices aren't public in Texas. Situs rows carry no ZIP, so the county's ZIPs come from the Census.

const path = require('node:path');
const { download, zipMembers, zipDates, zipTable } = require('./tables.cjs');
const { streetParts, situsParts, year, realUnit, onRecord } = require('./addresses.cjs');
const { positive, put, word } = require('./values.cjs');
const { newestFile, bathsIn, USES, whole } = require('./pacs-county.cjs');
const { CATEGORY_WORDS, useOf } = require('./texas.cjs');
const { zipsByCounty } = require('./zcta.cjs');
const { condoBuildings } = require('./condos.cjs');
const { keepSplit } = require('./held.cjs');
const { log } = require('./log.cjs');

const PROTECTED = /CONFIDENTIAL|PROTECTED|WITHHELD|SUPPRESS|NOT DISPLAYED|25\.025/i;
const COLUMNS = {
  account: 'PARCEL ID', name: 'NAME', number: 'SITUS STREET NUM', street: 'SITUS STREET NAME', suffix: 'SITUS STREET SFX', unit: 'SITUS UNIT', city: 'SITUS CITY', use: 'PARCEL USE CD', useWords: 'USE CD DESC',
  landSqft: 'LAND SQFT', living: 'BLDG HEAT AREA', built: 'YEAR_BUILT', market: 'MKT VAL', landValue: 'LAND MKT VALUE', building: 'TOTAL BUILDING VALUE', subdivision: 'SUBDIVISION',
};

function tabCounty({ fips, county, publisher, source, page, pattern, table = 'externalnal.tab', delimiter = '\t', columns = {}, uses = {}, useOfRow = null, keyOf = (account) => account, dataset = 'certified appraisal export', keepsSplit = false }) {
  const names = { ...COLUMNS, ...columns };
  const asked = [...new Set(Object.values(names).filter(Boolean))];
  const quoted = delimiter !== '\t';

  function fromRow(row, element, acres, frontLot, valueYear) {
    const pick = (key) => row[names[key]];
    const typed = situsParts({ number: pick('number'), street: word(pick('street')), suffix: word(pick('suffix')) || '', unit: (names.unit && realUnit(word(pick('unit')))) || '' });
    const { unit } = typed;
    const address = streetParts({ number: typed.number, pre: pick('pre'), name: typed.street, suffix: typed.suffix, unit });
    const account = String(pick('account') || '').trim();
    if (!address || !account) return null;
    const code = String(pick('use') || '').trim().toUpperCase();
    const living = positive(pick('living'));
    const custom = useOfRow?.(code, row, unit);
    const [kind, homeType] = uses[code] ? USES[uses[code]](address.unit) : custom || useOf(code, address.unit, Boolean(living));
    const facts = { parcel_number: account, county, fips };
    const home = kind === 'property' || kind === 'unit';
    put(facts, 'address_on_record', onRecord([pick('number'), pick('pre'), pick('street'), pick('suffix')].map(word).filter(Boolean).join(' '), unit));
    put(facts, 'land_use', (columns.useWords ? null : word(pick('useWords'))) || CATEGORY_WORDS[code[0]]);
    put(facts, 'county_use_code', code);
    put(facts, 'subdivision', word(pick('subdivision')));
    if (home || kind === 'building') put(facts, 'year_built', year(pick('built')));
    if (home) {
      put(facts, 'living_sqft', living);
      if (element) {
        put(facts, 'bedrooms', whole(element.bedrooms, 15));
        Object.assign(facts, bathsIn(element.baths));
      }
    }
    if (kind === 'building') put(facts, 'gross_sqft', living);
    if (kind !== 'unit') {
      const sqft = (names.landSqft ? positive(pick('landSqft')) : null) || frontLot;
      if (sqft) put(facts, 'lot_sqft', sqft);
      else put(facts, 'lot_acres', positive(names.acres ? pick('acres') : acres));
    }
    put(facts, 'value_year', valueYear);
    put(facts, 'market_value', positive(pick('market')));
    put(facts, 'market_land_value', positive(pick('landValue')));
    put(facts, 'market_building_value', positive(pick('building')));
    return { id: `pp:${kind}:${fips}:${account}`, kind, home_type: homeType, address: { ...address, city: String(word(pick('city')) || '').toUpperCase(), zip: null }, facts };
  }

  async function* build({ work }) {
    const url = await newestFile(page, pattern);
    const zip = path.join(work, source, path.basename(new URL(url).pathname));
    download(url, zip);
    const members = zipMembers(zip);
    const find = (name) => members.find((member) => member.endsWith(name));
    const main = find(table);
    if (!main) throw new Error(`The export has no ${table}`);
    const asOf = zipDates(zip).get(main) || zipDates(zip).get(path.basename(main));
    if (!asOf) throw new Error('The export no longer says when its table was made');
    const elements = new Map();
    const elementTable = find('externalbldse.tab');
    if (elementTable) {
      for await (const row of zipTable(zip, elementTable, ['parcel_id', 'tp_dscr', 'bld_se_cd', 'cd_dscr', 'bld_se_units'], { delimiter: '\t', quoted: false, headerHas: 'parcel_id' })) {
        const field = /^(number of )?bedrooms$/i.test(row.tp_dscr) ? 'bedrooms' : /^(plumbing|baths)$/i.test(row.tp_dscr) ? 'baths' : null;
        if (!field) continue;
        let held = elements.get(row.parcel_id);
        if (!held) elements.set(row.parcel_id, held = {});
        // A district keeps the number in one of three columns.
        if (!held[field]) held[field] = row.cd_dscr || row.bld_se_units || row.bld_se_cd;
      }
    }
    const acres = new Map();
    const acreageTable = find('externalacreage.tab');
    if (acreageTable) for await (const row of zipTable(zip, acreageTable, ['parcel_id', 'Acreage'], { delimiter: '\t', quoted: false, headerHas: 'parcel_id' })) acres.set(row.parcel_id, row.Acreage);
    // A lot priced by the lot has no area of its own, only its frontage and depth.
    const frontage = new Map();
    const landTable = find('externalland.tab');
    if (landTable) {
      for await (const row of zipTable(zip, landTable, ['parcel_id', 'lnd_front', 'lnd_depth', 'lnd_units', 'lnd_unit_cd'], { delimiter: '\t', quoted: false, headerHas: 'parcel_id' })) {
        const area = (positive(row.lnd_front) || 0) * (positive(row.lnd_depth) || 0);
        if (area && !frontage.has(row.parcel_id)) frontage.set(row.parcel_id, Math.round(area));
        if (row.lnd_unit_cd === 'AC' && !acres.has(row.parcel_id)) acres.set(row.parcel_id, row.lnd_units);
      }
    }
    const records = new Map();
    let [noAddress, hidden] = [0, 0];
    for await (const row of zipTable(zip, main, asked, { delimiter, quoted, headerHas: names.account })) {
      if (PROTECTED.test(row[names.name] || '')) {
        hidden += 1;
        continue;
      }
      const account = keyOf(row[names.account]);
      const record = fromRow(row, elements.get(account), acres.get(account), frontage.get(account), Number(asOf.slice(0, 4)));
      if (!record) noAddress += 1;
      else if (!records.has(record.id)) records.set(record.id, record);
    }
    const list = [...records.values()];
    log(`${county}: ${list.length} accounts, ${noAddress} without a street number, ${hidden} protected`);
    // A live county's page keeps the full and half baths it showed until its bath_totals switch is on (held.cjs keepSplit).
    if (keepsSplit) log(`${county}: ${keepSplit(list, { zeroFull: true })} homes keep the full and half baths their bath total was split into, until the county's bath_totals switch is on`);
    for (const building of condoBuildings(list, { fips, county })) list.push(building);
    yield {
      fips, state: 'TX', name: county, publisher, dataset, method: 'county', source, as_of: asOf, stale_after_days: 450, extra_zips: zipsByCounty(work, ['48']).get(fips) || [], records: list,
    };
  }

  return {
    build,
    dictionary: {
      columns: [...asked, 'Number of Bedrooms', 'Plumbing', 'Acreage'],
      // The value year is the export's own date, not a column.
      facts: Object.fromEntries(Object.entries({ year_built: names.built, living_sqft: names.living, gross_sqft: names.living, bedrooms: 'Number of Bedrooms', bathrooms: 'Plumbing', full_baths: 'Plumbing', half_baths: 'Plumbing', lot_sqft: names.landSqft, lot_acres: names.acres || 'Acreage', market_value: names.market, market_land_value: names.landValue, market_building_value: names.building }).filter(([, column]) => column)),
    },
  };
}

module.exports = { tabCounty };
