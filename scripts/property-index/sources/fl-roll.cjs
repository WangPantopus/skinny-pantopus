'use strict';
// Florida: the Department of Revenue's statewide tax roll, one file per county (NAL), published under chapter 119 with
// protected people's records already removed. Owner and fiduciary columns are in the file and never asked for here.
// The roll has no bedrooms or baths, keeps only the last two years' sales, and its living-or-usable area is "the total
// effective area of all improvements" (the Department's guide), so it never fills a living-area field.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parse, zip5 } = require('../../../backend/services/propertyRecords/addressKey');
const { download, zipDates, zipTable, USER_AGENT } = require('../lib/tables.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

// Counties read by their own connector.
const OWN_CONNECTOR = new Set(['12001', '12011', '12057', '12073', '12085', '12086', '12097', '12109', '12115', '12117']);
// [county, the Department's county number, FIPS]
const COUNTIES = [
  ['Alachua', 11, '12001'],
  ['Baker', 12, '12003'],
  ['Bay', 13, '12005'],
  ['Bradford', 14, '12007'],
  ['Brevard', 15, '12009'],
  ['Broward', 16, '12011'],
  ['Calhoun', 17, '12013'],
  ['Charlotte', 18, '12015'],
  ['Citrus', 19, '12017'],
  ['Clay', 20, '12019'],
  ['Collier', 21, '12021'],
  ['Columbia', 22, '12023'],
  ['Dade', 23, '12086'],
  ['DeSoto', 24, '12027'],
  ['Dixie', 25, '12029'],
  ['Duval', 26, '12031'],
  ['Escambia', 27, '12033'],
  ['Flagler', 28, '12035'],
  ['Franklin', 29, '12037'],
  ['Gadsden', 30, '12039'],
  ['Gilchrist', 31, '12041'],
  ['Glades', 32, '12043'],
  ['Gulf', 33, '12045'],
  ['Hamilton', 34, '12047'],
  ['Hardee', 35, '12049'],
  ['Hendry', 36, '12051'],
  ['Hernando', 37, '12053'],
  ['Highlands', 38, '12055'],
  ['Hillsborough', 39, '12057'],
  ['Holmes', 40, '12059'],
  ['Indian River', 41, '12061'],
  ['Jackson', 42, '12063'],
  ['Jefferson', 43, '12065'],
  ['Lafayette', 44, '12067'],
  ['Lake', 45, '12069'],
  ['Lee', 46, '12071'],
  ['Leon', 47, '12073'],
  ['Levy', 48, '12075'],
  ['Liberty', 49, '12077'],
  ['Madison', 50, '12079'],
  ['Manatee', 51, '12081'],
  ['Marion', 52, '12083'],
  ['Martin', 53, '12085'],
  ['Monroe', 54, '12087'],
  ['Nassau', 55, '12089'],
  ['Okaloosa', 56, '12091'],
  ['Okeechobee', 57, '12093'],
  ['Orange', 58, '12095'],
  ['Osceola', 59, '12097'],
  ['Palm Beach', 60, '12099'],
  ['Pasco', 61, '12101'],
  ['Pinellas', 62, '12103'],
  ['Polk', 63, '12105'],
  ['Putnam', 64, '12107'],
  ['Saint Johns', 65, '12109'],
  ['Saint Lucie', 66, '12111'],
  ['Santa Rosa', 67, '12113'],
  ['Sarasota', 68, '12115'],
  ['Seminole', 69, '12117'],
  ['Sumter', 70, '12119'],
  ['Suwannee', 71, '12121'],
  ['Taylor', 72, '12123'],
  ['Union', 73, '12125'],
  ['Volusia', 74, '12127'],
  ['Wakulla', 75, '12129'],
  ['Walton', 76, '12131'],
  ['Washington', 77, '12133'],
];
// What the county calls itself, where the Department's file says it another way.
const COUNTY_NAMES = { Dade: 'Miami-Dade County', 'Saint Johns': 'St. Johns County', 'Saint Lucie': 'St. Lucie County' };
const ROLL = 'https://floridarevenue.com/property/dataportal/Documents/PTO%20Data%20Portal/Tax%20Roll%20Data%20Files/NAL';
const fileUrl = (name, number, year, stage) => `${ROLL}/${year}${stage[0]}/${encodeURIComponent(name)}%20${number}%20${stage}%20NAL%20${year}.zip`;

// A county the Department hasn't finalized has only a preliminary file, in its own folder.
function currentFile(name, number, year) {
  for (const stage of ['Final', 'Preliminary']) {
    const url = fileUrl(name, number, year, stage);
    try {
      execFileSync('curl', ['-fsIL', '-A', USER_AGENT, '--max-time', '60', '--retry', '3', '--retry-delay', '10', '--retry-all-errors', '-o', '/dev/null', url], { stdio: 'ignore' });
      return { url, stage };
    } catch (_) { /* not at this stage */ }
  }
  throw new Error(`${name} has no ${year} file`);
}

const USES = {
  '000': ['parcel', null], '001': ['property', 'house'], '002': ['property', 'mobile_home'], '003': ['building', 'apartment'],
  '004': ['unit', 'condo'], '005': ['unit', 'condo'], '006': ['building', 'apartment'], '007': ['building', 'multi_unit'], '008': ['building', 'multi_unit'],
  '010': ['parcel', null], '040': ['parcel', null], '070': ['parcel', null],
};
const USE_WORDS = {
  '000': 'Vacant residential', '001': 'Single family', '002': 'Mobile home', '003': 'Multi-family, 10 units or more', '004': 'Condominium', '005': 'Cooperative',
  '006': 'Retirement home', '007': 'Miscellaneous residential', '008': 'Multi-family, fewer than 10 units', '009': 'Residential common elements',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COLUMNS = ['PARCEL_ID', 'ASMNT_YR', 'DOR_UC', 'PA_UC', 'JV', 'AV_SD', 'TV_SD', 'LND_VAL', 'LND_SQFOOT', 'IMP_QUAL', 'EFF_YR_BLT', 'ACT_YR_BLT', 'TOT_LVG_AREA', 'NO_BULDNG', 'NO_RES_UNTS',
  'SALE_PRC1', 'SALE_YR1', 'SALE_MO1', 'SALE_PRC2', 'SALE_YR2', 'SALE_MO2', 'S_LEGAL', 'TAX_AUTH_CD', 'PHY_ADDR1', 'PHY_ADDR2', 'PHY_CITY', 'PHY_ZIPCD', 'EXMPT_01', 'EXMPT_02', 'EXMPT_03', 'EXMPT_04', 'EXMPT_05'];

// Roll addresses put a condo's unit after the street type with no marker: "100 MAIN ST 4B". A numbered road isn't one of those.
const TRAILING_UNIT = /^(.*\b(?:ST|AVE|RD|DR|LN|CT|CIR|BLVD|WAY|PL|TER|TRL|PKWY|PT|LOOP|RUN))\s+([A-Z0-9-]{1,6})$/;
const NUMBERED_ROAD = /\b(STATE|COUNTY|FARM|RANCH|OLD)\s+(RD|ROAD)\s+\S+$/;
function readAddress(line1, line2, kind) {
  const line = String(line1 || '').toUpperCase().trim();
  const trailing = kind === 'unit' && !NUMBERED_ROAD.test(line) ? TRAILING_UNIT.exec(line) : null;
  return trailing ? parse(trailing[1], trailing[2]) : parse(line, line2);
}

async function buildCounty(work, year, [name, number, fips]) {
  const zip = path.join(work, 'fl-roll', `${number}.zip`);
  const { url, stage } = currentFile(name, number, year);
  download(url, zip);
  const [table, asOf] = [...zipDates(zip)].find(([member]) => /\.csv$/i.test(member)) || [];
  if (!table) throw new Error(`County ${number}\'s file has no table`);
  const county = COUNTY_NAMES[name] || `${name} County`;
  const records = [];
  let noAddress = 0;
  for await (const row of zipTable(zip, table, COLUMNS)) {
    const use = String(row.DOR_UC || '').padStart(3, '0');
    const [kind, homeType] = USES[use] || ['other', null];
    const parsed = readAddress(row.PHY_ADDR1, row.PHY_ADDR2, kind);
    if (!parsed) {
      noAddress += 1;
      continue;
    }
    const address = { ...parsed, city: String(row.PHY_CITY || '').trim().toUpperCase(), zip: zip5(row.PHY_ZIPCD) };
    const facts = { parcel_number: row.PARCEL_ID, county, fips, address_on_record: [row.PHY_ADDR1, row.PHY_ADDR2].map(word).filter(Boolean).join(' ') };
    put(facts, 'year_built', positive(row.ACT_YR_BLT));
    put(facts, 'effective_year_built', positive(row.EFF_YR_BLT));
    put(facts, 'usable_sqft', positive(row.TOT_LVG_AREA));
    put(facts, 'lot_sqft', kind === 'unit' ? null : positive(row.LND_SQFOOT));
    put(facts, 'buildings_on_parcel', positive(row.NO_BULDNG));
    if (kind === 'building') put(facts, 'units', positive(row.NO_RES_UNTS));
    put(facts, 'land_use', USE_WORDS[use] || null);
    put(facts, 'county_use_code', word(row.PA_UC));
    put(facts, 'tax_code_area', word(row.TAX_AUTH_CD));
    put(facts, 'legal_description', word(row.S_LEGAL)?.slice(0, 300));
    put(facts, 'value_year', positive(row.ASMNT_YR));
    put(facts, 'market_value', positive(row.JV));
    put(facts, 'assessed_value', positive(row.AV_SD));
    put(facts, 'taxable_value', positive(row.TV_SD));
    put(facts, 'market_land_value', positive(row.LND_VAL));
    // The roll's two sales aren't in date order: the last sale is the later one with a real price.
    const [sale] = [1, 2]
      .map((n) => ({ price: positive(row[`SALE_PRC${n}`]), year: positive(row[`SALE_YR${n}`]), month: positive(row[`SALE_MO${n}`]) }))
      .filter(({ price, year }) => price > 100 && year)
      .sort((a, b) => (b.year * 100 + (b.month || 0)) - (a.year * 100 + (a.month || 0)));
    if (sale) {
      facts.sale_price = sale.price;
      facts.sale_month = sale.month ? `${MONTHS[sale.month - 1]} ${sale.year}` : String(sale.year);
    }
    // A homestead is said by name. The others can say something about a person, so they aren't.
    const exemptions = [];
    if (positive(row.EXMPT_01)) exemptions.push('Homestead');
    if ([row.EXMPT_02, row.EXMPT_03, row.EXMPT_04, row.EXMPT_05].some(positive)) exemptions.push('Other exemption on file');
    facts.exemptions = exemptions;
    records.push({ id: `pp:${kind}:${fips}:${row.PARCEL_ID}`, kind, home_type: homeType, address, facts });
  }
  log(`${county}: ${records.length} parcels with an address, ${noAddress} without`);
  records.push(...condoBuildings(records, { fips, county }));
  return {
    fips, state: 'FL', name: county, publisher: 'Florida Department of Revenue', dataset: stage === 'Final' ? `${year} tax roll` : `${year} preliminary tax roll`, method: 'state', source: 'fl-roll', title: 'State records',
    as_of: asOf, stale_after_days: 540, records,
  };
}

const rollYear = (today) => (today.getMonth() >= 9 ? today.getFullYear() : today.getFullYear() - 1);

// One county at a time, so the state fits in memory. PROPERTY_INDEX_ONLY limits a run to some FIPS codes.
async function* build({ work, today = new Date() }) {
  const year = rollYear(today);
  const only = (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  for (const county of COUNTIES) {
    if (OWN_CONNECTOR.has(county[2]) || (only.length && !only.includes(county[2]))) continue;
    // One county's trouble doesn't hold up the others: they publish, and the run ends failed so someone looks.
    let built = null;
    try {
      built = await buildCounty(work, year, county);
    } catch (err) {
      process.exitCode = 1;
      console.log(`::error::${county[0]} County wasn't built: ${err.constructor === Error ? err.message.split('\n')[0] : err.name}`);
    }
    if (built) yield built;
    fs.rmSync(path.join(work, 'fl-roll', `${county[1]}.zip`), { force: true });
  }
}

// One county's roll, for a connector whose county's own file leaves homes out.
const countyRoll = (work, fips, today = new Date()) => buildCounty(work, rollYear(today), COUNTIES.find((county) => county[2] === fips));

module.exports = { build, countyRoll };
