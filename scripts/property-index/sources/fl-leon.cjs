'use strict';
// Leon County, Florida: the state's roll (fl-roll.cjs), with each home's bedrooms, baths, floors, heated area, walls and roof
// from the Property Appraiser's residential building file, the free "Building Data" download on its Download Our Data page.
// Its terms of use disclaim warranties and ask that the site not be overburdened; they set no limit on using the data. The
// file has no owner or mailing column. Only parcels already on the roll (protected people removed) take a fact.

const path = require('node:path');
const { spawn } = require('node:child_process');
const { download, zipDates, streamLines } = require('../lib/tables.cjs');
const { number, positive } = require('../lib/values.cjs');
const { fillHomes, bathFacts, describe, monthOf } = require('../lib/fill.cjs');
const { log } = require('../lib/log.cjs');
const { countyRoll } = require('./fl-roll.cjs');

const FIPS = '12073';
const COUNTY = 'Leon County';
const FILE = 'https://search.leonpa.gov/Downloads/BuildingData.zip';
const TABLE = 'Bldg_Residential.txt';
// The layout in the zip's BuildingLayout.xls: no header line, these fields in this order.
const FIELDS = ['PARID', 'CARD', 'CLASS', 'TAXDIST', 'LUC', 'YRBLT', 'EXTWALL', 'FOUNDATION', 'HEAT', 'FLOORSYSTEM', 'ROOFFRAME', 'ROOFCOVER', 'FLOOR', 'INTERIOR', 'ELEC', 'BASESF', 'VALUE', 'BEDROOM', 'BATH', 'HALFBATH', 'STORIES'];
// Land use codes that are one home: houses (01xx), mobile homes, condos, townhouses and villas, zero lot line homes, co-ops.
const DWELLING = /^(01\d\d|02\d\d|0400|0410|0430|0500|0510)$/;
// The layout's residential code tabs, in plain words. A siding grade is siding; "unfinished" says no material.
const WALLS = {
  '01': 'Corrugated metal', '03': 'Siding', '04': 'Siding', '05': 'Siding', '06': 'Stucco on wood', '07': 'Concrete block', '08': 'Concrete block and wood',
  '09': 'Stucco on concrete block', 10: 'Concrete block and brick', 11: 'Common brick', 12: 'Brick', 15: 'Prefinished metal', 16: 'Precast panel', 17: 'Glass',
};
const ROOFS = {
  '00': 'Corrugated metal', '01': 'Rolled roofing', '03': 'Composition shingle', '06': 'Asbestos or wood shingle', '08': 'Barrel or clay tile',
  10: 'Built-up composition', 13: 'Metal shingle', 14: 'Standing seam metal',
};

async function* rows(zip) {
  const unzip = spawn('unzip', ['-p', zip, TABLE], { stdio: ['ignore', 'pipe', 'ignore'] });
  unzip.stdout.setEncoding('latin1');
  let count = 0;
  for await (const line of streamLines(unzip.stdout)) {
    const cells = line.split(',');
    if (cells.length !== FIELDS.length) throw new Error(`${TABLE} no longer has ${FIELDS.length} fields a line`);
    count += 1;
    yield Object.fromEntries(FIELDS.map((field, i) => [field, cells[i].trim()]));
  }
  log(`${TABLE}: ${count} rows`);
}

const count = (text, most) => {
  const value = positive(text);
  return value && value <= most && Number.isInteger(value) ? value : null;
};

async function* build({ work, today }) {
  const zip = path.join(work, 'fl-leon', 'buildings.zip');
  download(FILE, zip);
  const dwellings = new Map();
  let homes = 0;
  for await (const row of rows(zip)) {
    if (!DWELLING.test(row.LUC)) continue;
    homes += 1;
    const full = count(row.BATH, 20);
    const half = count(row.HALFBATH, 10);
    const stories = number(row.STORIES);
    const heated = positive(row.BASESF);
    const facts = {
      bedrooms: count(row.BEDROOM, 15),
      ...(full ? bathFacts(full + (half || 0) * 0.5, 30) : {}),
      ...(full && half ? { half_baths: half } : {}),
      stories: stories > 0 && stories <= 6 && (stories * 2) % 1 === 0 ? stories : null,
      living_sqft: heated && heated < 30000 ? heated : null,
      exterior_walls: WALLS[row.EXTWALL] || null,
      roof_cover: ROOFS[row.ROOFCOVER] || null,
    };
    // The roll keeps the parcel number with the appraiser's spacing; the file pads it to 13 characters.
    const parcel = row.PARID.replace(/\s+$/, '');
    if (!dwellings.has(parcel)) dwellings.set(parcel, []);
    dwellings.get(parcel).push(facts);
  }
  log(`${COUNTY}: ${homes} dwelling buildings on ${dwellings.size} parcels in the Property Appraiser's building file`);
  const roll = await countyRoll(work, FIPS, today);
  const counts = fillHomes(roll.records, dwellings);
  log(describe(COUNTY, counts));
  yield {
    ...roll,
    name: COUNTY,
    publisher: 'Florida Department of Revenue and the Leon County Property Appraiser',
    dataset: `${roll.dataset} and ${monthOf(zipDates(zip).get(TABLE))} building data`,
    method: 'county',
    source: 'fl-leon',
    title: 'County records',
  };
}

module.exports = {
  build,
  dictionary: {
    file: FILE,
    facts: { bedrooms: 'BEDROOM', full_baths: 'BATH', half_baths: 'HALFBATH', bathrooms: 'BATH + HALFBATH / 2', stories: 'STORIES', living_sqft: 'BASESF', exterior_walls: 'EXTWALL', roof_cover: 'ROOFCOVER' },
  },
};
