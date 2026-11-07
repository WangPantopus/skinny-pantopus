'use strict';
// Martin County, Florida: the state's roll (fl-roll.cjs), with each home's bedrooms, baths, finished area, floors, walls and
// roof from the Property Appraiser's free "Tax Roll / CAMA Database Exports" (its data reports disclaimer takes no liability
// and sets no limit on use). Two exports are opened: the master file's bedrooms, baths and finished area per parcel, and the
// improvement file's buildings. The master file's owner and mailing columns are never read; the owners export isn't
// downloaded. Only parcels already on the roll (protected people removed) take a fact.

const path = require('node:path');
const { download, zipTable, zipMembers, zipDates } = require('../lib/tables.cjs');
const { number, positive, word } = require('../lib/values.cjs');
const { fillHomes, bathFacts, describe, monthOf } = require('../lib/fill.cjs');
const { log } = require('../lib/log.cjs');
const { countyRoll } = require('./fl-roll.cjs');

const FIPS = '12085';
const COUNTY = 'Martin County';
const EXPORTS = 'https://www.pamartinfl.gov/tools-resources/data-downloads';
const MASTER = `${EXPORTS}/46-real-master/download`;
const IMPROVEMENTS = `${EXPORTS}/38-real-improvement/download`;
// Building types that are one home. A duplex, an outbuilding or a commercial condo isn't.
const DWELLING = /^(Single family|Condo-Res|Manufactured Home|Town House\b)/i;
// The appraiser's words, as a record says them. "Stucco or wood" says neither.
const WALLS = {
  Stucco: 'Stucco', 'Wood siding': 'Wood siding', 'Hardi-Plank Lap Siding': 'Fiber cement lap siding', 'Vinyl siding': 'Vinyl siding',
  'Block with Stucco': 'Stucco on concrete block', 'Alum siding': 'Aluminum siding', 'Concrete Block': 'Concrete block', 'Stud Walls-Wood Siding': 'Wood siding',
  'T 111 plywood': 'Plywood siding', Brick: 'Brick',
};
const ROOFS = {
  'Comp sh 240-260#': 'Composition shingle', 'Comp sh to 235#': 'Composition shingle', 'Asphalt shingles': 'Asphalt shingle', 'Cement tile': 'Cement tile',
  'Clay tile': 'Clay tile', 'Metal flat seam': 'Flat seam metal', 'Metal stand seam': 'Standing seam metal', Metal: 'Metal', 'Built-up': 'Built-up',
  'Shake shingles-med': 'Shake shingle', 'Composition roll': 'Rolled composition',
};

const table = (zip) => {
  const [member] = zipMembers(zip).filter((name) => /\.csv$/i.test(name));
  if (!member) throw new Error(`${path.basename(zip)} has no table`);
  return member;
};

async function* build({ work, today }) {
  const master = path.join(work, 'fl-martin', 'master.zip');
  const improvements = path.join(work, 'fl-martin', 'improvements.zip');
  download(MASTER, master);
  download(IMPROVEMENTS, improvements);
  // Each property's buildings: a home's parcel has one dwelling building, of one living unit.
  const buildings = new Map();
  for await (const row of zipTable(improvements, table(improvements), ['PropertyID', 'BuildingTypeDescription', 'ResidentialUnits', 'StoryHeight', 'ExteriorWallDescription', 'RoofCoverDescription', 'HeatDescription'], { delimiter: '|', quoted: false })) {
    if (!buildings.has(row.PropertyID)) buildings.set(row.PropertyID, []);
    buildings.get(row.PropertyID).push(row);
  }
  const dwellings = new Map();
  let several = 0;
  for await (const row of zipTable(master, table(master), ['PropertyID', 'ParcelID', 'BuildingTypeDescription', 'Beds', 'Baths', 'TotalFinishedArea'], { delimiter: '|', quoted: false })) {
    if (!DWELLING.test(row.BuildingTypeDescription)) continue;
    const homes = (buildings.get(row.PropertyID) || []).filter((building) => DWELLING.test(building.BuildingTypeDescription));
    if (homes.length !== 1 || number(homes[0].ResidentialUnits) > 1) {
      several += homes.length > 1 ? 1 : 0;
      continue;
    }
    const [home] = homes;
    const beds = positive(row.Beds);
    const stories = number(home.StoryHeight);
    const finished = positive(row.TotalFinishedArea);
    dwellings.set(word(row.ParcelID), [{
      bedrooms: beds && beds <= 15 && Number.isInteger(beds) ? beds : null,
      ...bathFacts(number(row.Baths), 20),
      stories: stories > 0 && stories <= 6 && (stories * 2) % 1 === 0 ? stories : null,
      living_sqft: finished && finished < 30000 ? finished : null,
      exterior_walls: WALLS[home.ExteriorWallDescription] || null,
      roof_cover: ROOFS[home.RoofCoverDescription] || null,
      heating: home.HeatDescription === 'Central Warm Air' ? 'Central warm air' : null,
    }]);
  }
  log(`${COUNTY}: ${dwellings.size} one-dwelling homes in the Property Appraiser's exports; ${several} parcels with more than one dwelling building left out`);
  const roll = await countyRoll(work, FIPS, today);
  const counts = fillHomes(roll.records, dwellings);
  log(describe(COUNTY, counts));
  yield {
    ...roll,
    name: COUNTY,
    publisher: 'Florida Department of Revenue and the Martin County Property Appraiser',
    dataset: `${roll.dataset} and ${monthOf(zipDates(master).get(table(master)))} building data`,
    method: 'county',
    source: 'fl-martin',
    title: 'County records',
  };
}

module.exports = {
  build,
  dictionary: {
    page: EXPORTS,
    facts: { bedrooms: 'real_master Beds', bathrooms: 'real_master Baths', living_sqft: 'real_master TotalFinishedArea', stories: 'real_improv StoryHeight', exterior_walls: 'real_improv ExteriorWallDescription', roof_cover: 'real_improv RoofCoverDescription', heating: 'real_improv HeatDescription' },
  },
};
