'use strict';
// Florida: the Department of Revenue's statewide tax roll, one file per county (NAL), published under chapter 119 with
// protected people's records already removed. Owner and fiduciary columns are in the file and never asked for here.
// The roll has no bedrooms or baths, keeps only the last two years' sales, and its living-or-usable area is "the total
// effective area of all improvements" (the Department's guide), so it never fills a living-area field.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parse, zip5 } = require('../../../backend/services/propertyRecords/addressKey');
const { download, zipTable } = require('../lib/tables.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

// [county, the Department's county number, FIPS, its file in the roll's folder]
// Counties read by their own connector.
const OWN_CONNECTOR = new Set(['12011', '12057', '12086', '12115', '12117']);
const COUNTIES = [
  ['Alachua', 11, '12001', 'Alachua%2011%20Final%20NAL%20YEAR.zip'],
  ['Baker', 12, '12003', 'Baker%2012%20Final%20NAL%20YEAR.zip'],
  ['Bay', 13, '12005', 'Bay%2013%20Final%20NAL%20YEAR.zip'],
  ['Bradford', 14, '12007', 'Bradford%2014%20Final%20NAL%20YEAR.zip'],
  ['Brevard', 15, '12009', 'Brevard%2015%20Final%20NAL%20YEAR.zip'],
  ['Broward', 16, '12011', 'Broward%2016%20Final%20NAL%20YEAR.zip'],
  ['Calhoun', 17, '12013', 'Calhoun%2017%20Final%20NAL%20YEAR.zip'],
  ['Charlotte', 18, '12015', 'Charlotte%2018%20Final%20NAL%20YEAR.zip'],
  ['Citrus', 19, '12017', 'Citrus%2019%20Final%20NAL%20YEAR.zip'],
  ['Clay', 20, '12019', 'Clay%2020%20Final%20NAL%20YEAR.zip'],
  ['Collier', 21, '12021', 'Collier%2021%20Final%20NAL%20YEAR.zip'],
  ['Columbia', 22, '12023', 'Columbia%2022%20Final%20NAL%20YEAR.zip'],
  ['Dade', 23, '12086', 'Dade%2023%20Final%20NAL%20YEAR.zip'],
  ['DeSoto', 24, '12027', 'DeSoto%2024%20Preliminary%20NAL%20YEAR.zip'],
  ['Dixie', 25, '12029', 'Dixie%2025%20Final%20NAL%20YEAR.zip'],
  ['Duval', 26, '12031', 'Duval%YEAR%20Final%20NAL%20YEAR.zip'],
  ['Escambia', 27, '12033', 'Escambia%2027%20Final%20NAL%20YEAR.zip'],
  ['Flagler', 28, '12035', 'Flagler%2028%20Preliminary%20NAL%20YEAR.zip'],
  ['Franklin', 29, '12037', 'Franklin%2029%20Final%20NAL%20YEAR.zip'],
  ['Gadsden', 30, '12039', 'Gadsden%2030%20Final%20NAL%20YEAR.zip'],
  ['Gilchrist', 31, '12041', 'Gilchrist%2031%20Final%20NAL%20YEAR.zip'],
  ['Glades', 32, '12043', 'Glades%2032%20Final%20NAL%20YEAR.zip'],
  ['Gulf', 33, '12045', 'Gulf%2033%20Final%20NAL%20YEAR.zip'],
  ['Hamilton', 34, '12047', 'Hamilton%2034%20Final%20NAL%20YEAR.zip'],
  ['Hardee', 35, '12049', 'Hardee%2035%20Final%20NAL%20YEAR.zip'],
  ['Hendry', 36, '12051', 'Hendry%2036%20Final%20NAL%20YEAR.zip'],
  ['Hernando', 37, '12053', 'Hernando%2037%20Final%20NAL%20YEAR.zip'],
  ['Highlands', 38, '12055', 'Highlands%2038%20Final%20NAL%20YEAR.zip'],
  ['Hillsborough', 39, '12057', 'Hillsborough%2039%20Final%20NAL%20YEAR.zip'],
  ['Holmes', 40, '12059', 'Holmes%2040%20Final%20NAL%20YEAR.zip'],
  ['Indian River', 41, '12061', 'Indian%20River%2041%20Final%20NAL%20YEAR.zip'],
  ['Jackson', 42, '12063', 'Jackson%2042%20Final%20NAL%20YEAR.zip'],
  ['Jefferson', 43, '12065', 'Jefferson%2043%20Final%20NAL%20YEAR.zip'],
  ['Lafayette', 44, '12067', 'Lafayette%2044%20Final%20NAL%20YEAR.zip'],
  ['Lake', 45, '12069', 'Lake%2045%20Final%20NAL%20YEAR.zip'],
  ['Lee', 46, '12071', 'Lee%2046%20Final%20NAL%20YEAR.zip'],
  ['Leon', 47, '12073', 'Leon%2047%20Final%20NAL%20YEAR.zip'],
  ['Levy', 48, '12075', 'Levy%2048%20Final%20NAL%20YEAR.zip'],
  ['Liberty', 49, '12077', 'Liberty%2049%20Preliminary%20NAL%20YEAR.zip'],
  ['Madison', 50, '12079', 'Madison%2050%20Final%20NAL%20YEAR.zip'],
  ['Manatee', 51, '12081', 'Manatee%2051%20Final%20NAL%20YEAR.zip'],
  ['Marion', 52, '12083', 'Marion%2052%20Final%20NAL%20YEAR.zip'],
  ['Martin', 53, '12085', 'Martin%2053%20Final%20NAL%20YEAR.zip'],
  ['Monroe', 54, '12087', 'Monroe%2054%20Final%20NAL%20YEAR.zip'],
  ['Nassau', 55, '12089', 'Nassau%2055%20Final%20NAL%20YEAR.zip'],
  ['Okaloosa', 56, '12091', 'Okaloosa%2056%20Final%20NAL%20YEAR.zip'],
  ['Okeechobee', 57, '12093', 'Okeechobee%2057%20Final%20NAL%20YEAR.zip'],
  ['Orange', 58, '12095', 'Orange%2058%20Final%20NAL%20YEAR.zip'],
  ['Osceola', 59, '12097', 'Osceola%2059%20Final%20NAL%20YEAR.zip'],
  ['Palm Beach', 60, '12099', 'Palm%20Beach%2060%20Final%20NAL%20YEAR.zip'],
  ['Pasco', 61, '12101', 'Pasco%2061%20Final%20NAL%20YEAR.zip'],
  ['Pinellas', 62, '12103', 'Pinellas%2062%20Final%20NAL%20YEAR.zip'],
  ['Polk', 63, '12105', 'Polk%2063%20Final%20NAL%20YEAR.zip'],
  ['Putnam', 64, '12107', 'Putnam%2064%20Final%20NAL%20YEAR.zip'],
  ['Saint Johns', 65, '12109', 'Saint%20Johns%2065%20Final%20NAL%20YEAR.zip'],
  ['Saint Lucie', 66, '12111', 'Saint%20Lucie%2066%20Final%20NAL%20YEAR.zip'],
  ['Santa Rosa', 67, '12113', 'Santa%20Rosa%2067%20Final%20NAL%20YEAR.zip'],
  ['Sarasota', 68, '12115', 'Sarasota%2068%20Final%20NAL%20YEAR.zip'],
  ['Seminole', 69, '12117', 'Seminole%2069%20Final%20NAL%20YEAR.zip'],
  ['Sumter', 70, '12119', 'Sumter%2070%20Final%20NAL%20YEAR.zip'],
  ['Suwannee', 71, '12121', 'Suwannee%2071%20Final%20NAL%20YEAR.zip'],
  ['Taylor', 72, '12123', 'Taylor%2072%20Final%20NAL%20YEAR.zip'],
  ['Union', 73, '12125', 'Union%2073%20Final%20NAL%20YEAR.zip'],
  ['Volusia', 74, '12127', 'Volusia%2074%20Final%20NAL%20YEAR.zip'],
  ['Wakulla', 75, '12129', 'Wakulla%2075%20Final%20NAL%20YEAR.zip'],
  ['Walton', 76, '12131', 'Walton%2076%20Final%20NAL%20YEAR.zip'],
  ['Washington', 77, '12133', 'Washington%2077%20Final%20NAL%20YEAR.zip'],
];
const fileUrl = (file, year) => `https://floridarevenue.com/property/dataportal/Documents/PTO%20Data%20Portal/Tax%20Roll%20Data%20Files/NAL/${year}F/${file.replace('YEAR', year)}`;

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
  'SALE_PRC1', 'SALE_YR1', 'SALE_MO1', 'S_LEGAL', 'TAX_AUTH_CD', 'PHY_ADDR1', 'PHY_ADDR2', 'PHY_CITY', 'PHY_ZIPCD', 'EXMPT_01', 'EXMPT_02', 'EXMPT_03', 'EXMPT_04', 'EXMPT_05'];

// Roll addresses put a condo's unit after the street type with no marker: "100 MAIN ST 4B". A numbered road isn't one of those.
const TRAILING_UNIT = /^(.*\b(?:ST|AVE|RD|DR|LN|CT|CIR|BLVD|WAY|PL|TER|TRL|PKWY|PT|LOOP|RUN))\s+([A-Z0-9-]{1,6})$/;
const NUMBERED_ROAD = /\b(STATE|COUNTY|FARM|RANCH|OLD)\s+(RD|ROAD)\s+\S+$/;
function readAddress(line1, line2, kind) {
  const line = String(line1 || '').toUpperCase().trim();
  const trailing = kind === 'unit' && !NUMBERED_ROAD.test(line) ? TRAILING_UNIT.exec(line) : null;
  return trailing ? parse(trailing[1], trailing[2]) : parse(line, line2);
}

async function buildCounty(work, year, [name, number, fips, file]) {
  const zip = path.join(work, 'fl-roll', `${number}.zip`);
  download(fileUrl(file, year), zip);
  const listing = execFileSync('unzip', ['-l', zip], { encoding: 'latin1' });
  const stamp = /(\d{2})-(\d{2})-(\d{4})\s+\d{2}:\d{2}\s+(\S+\.csv)/i.exec(listing);
  if (!stamp) throw new Error(`County ${number}\'s file has no table`);
  const county = `${name} County`;
  const records = [];
  let noAddress = 0;
  for await (const row of zipTable(zip, stamp[4], COLUMNS)) {
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
    if (positive(row.SALE_PRC1) > 100 && positive(row.SALE_YR1)) {
      facts.sale_price = positive(row.SALE_PRC1);
      const month = positive(row.SALE_MO1);
      facts.sale_month = month ? `${MONTHS[month - 1]} ${positive(row.SALE_YR1)}` : String(positive(row.SALE_YR1));
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
    fips, state: 'FL', name: county, publisher: 'Florida Department of Revenue', dataset: `${year} tax roll`, method: 'state', source: 'fl-roll', title: 'State records',
    as_of: `${stamp[3]}-${stamp[1]}-${stamp[2]}`, stale_after_days: 540, records,
  };
}

// One county at a time, so the state fits in memory. PROPERTY_INDEX_ONLY limits a run to some FIPS codes.
async function* build({ work, today = new Date() }) {
  const year = today.getMonth() >= 9 ? today.getFullYear() : today.getFullYear() - 1;
  const only = (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  for (const county of COUNTIES) {
    if (OWN_CONNECTOR.has(county[2]) || (only.length && !only.includes(county[2]))) continue;
    yield buildCounty(work, year, county);
    fs.rmSync(path.join(work, 'fl-roll', `${county[1]}.zip`), { force: true });
  }
}

module.exports = { build };
