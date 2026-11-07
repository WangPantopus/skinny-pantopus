'use strict';
// Alachua County, Florida: the state's roll (fl-roll.cjs), with each home's bedrooms, baths, floors, heated area, roof and
// walls from the Property Appraiser's CAMA data, the free download its site links as "Download CAMA Data" (no terms are
// stated on it). Only the improvement tables are opened; the owner, exemption and sales tables never are. Only parcels
// already on the roll (protected people removed) take a fact. Its bedroom codes stop at "5 or more", which says no count.

const path = require('node:path');
const { download, zipTable, zipDates } = require('../lib/tables.cjs');
const { number, positive } = require('../lib/values.cjs');
const { fillHomes, bathFacts, describe, monthOf } = require('../lib/fill.cjs');
const { log } = require('../lib/log.cjs');
const { countyRoll } = require('./fl-roll.cjs');

const FIPS = '12001';
const COUNTY = 'Alachua County';
const FILE = 'https://s3.amazonaws.com/acpa.cama/ACPA_CAMAData.zip';
// Improvement types that are one home: houses, manufactured and mobile homes, zero-lot-line houses, condos.
const DWELLING = new Set(['0100', '0200', '0400', '0700', '0800', '0900']);
const ZERO_LOT = '0300';
// The county's words for its codes ("03-ASPHALT"), as a record says them. A grade ("AVERAGE", "MINIMUM") isn't a material.
const ROOFS = {
  ASPHALT: 'Asphalt', 'MODULAR METAL': 'Metal', 'TAR & GRAVEL': 'Tar and gravel', 'ROLLED COMP': 'Rolled composition', 'CLAY TILE': 'Clay tile',
  'ASBESTOS SHING': 'Asbestos shingle', 'CONCRETE TILE': 'Concrete tile', 'WOOD SHINGLE': 'Wood shingle', SLATE: 'Slate', 'CEDAR SHAKES': 'Cedar shakes',
  'CORR. ASBESTOS': 'Corrugated asbestos',
};
const WALLS = {
  HARDIBOARD: 'Fiber cement board', 'CONCRETE BLOCK': 'Concrete block', 'ALUMINUM SIDNG': 'Aluminum siding', 'FACE BRICK': 'Face brick',
  'CB STUCCO': 'Stucco on concrete block', 'TILE/WD STUCCO': 'Stucco on tile or wood', 'CEDAR/REDWOOD': 'Cedar or redwood', STONE: 'Stone',
  'COMMON BRICK': 'Common brick', 'SINGLE SIDING': 'Single siding', 'CEMENT BRICK': 'Cement brick', 'MODULAR METAL': 'Metal', 'PRE-FINSH METL': 'Prefinished metal',
  'BOARD & BATTEN': 'Board and batten', 'BD AND BAT AAV': 'Board and batten', ASBESTOS: 'Asbestos', 'PRE-FAB PANEL': 'Prefabricated panel',
  'WOOD SHEATH': 'Wood sheathing', 'WALL BOARD': 'Wall board', 'WOOD SHINGLE': 'Wood shingle', 'PRECAST PANEL': 'Precast panel', 'CORR METAL': 'Corrugated metal',
  'REINF CONCRETE': 'Reinforced concrete',
};
const said = (desc) => /^\d+-(.+)$/.exec(String(desc || '').trim())?.[1]?.trim();

async function* build({ work, today }) {
  const zip = path.join(work, 'fl-alachua', 'cama.zip');
  download(FILE, zip);
  const improvements = new Map();
  for await (const row of zipTable(zip, 'Improvements.txt', ['Parcel', 'Imprv_ID', 'Imprv_Type', 'Imprv_Desc', 'Heated_SquareFeet', 'Stories'], { delimiter: '\t', quoted: false })) {
    const type = row.Imprv_Type.trim();
    if (!DWELLING.has(type) && !(type === ZERO_LOT && /ZERO LOT/i.test(row.Imprv_Desc))) continue;
    const stories = number(row.Stories);
    improvements.set(`${row.Parcel}|${row.Imprv_ID}`, {
      parcel: row.Parcel, heated: positive(row.Heated_SquareFeet), stories: stories > 0 && stories <= 6 && (stories * 2) % 1 === 0 ? stories : null, walls: null,
    });
  }
  for await (const row of zipTable(zip, 'ImprvAttributes.txt', ['Parcel', 'Imprv_ID', 'Imprv_Attribute', 'Imprv_Attr_Desc', 'Imprv_Attr_Units'], { delimiter: '\t', quoted: false })) {
    const improvement = improvements.get(`${row.Parcel}|${row.Imprv_ID}`);
    if (!improvement) continue;
    const words = said(row.Imprv_Attr_Desc);
    if (row.Imprv_Attribute === 'Bedrooms') {
      const exact = /^([1-4])-\1 BEDROOMS?$/i.exec(row.Imprv_Attr_Desc.trim());
      improvement.bedrooms = 'bedrooms' in improvement ? null : (exact ? Number(exact[1]) : null);
    } else if (row.Imprv_Attribute === 'Bathrooms') {
      const total = /^(\d+(?:\.\d)?)-Baths$/i.exec(row.Imprv_Attr_Desc.trim());
      improvement.baths = 'baths' in improvement ? null : (total && total[1] !== '9.9' ? Number(total[1]) : null);
    } else if (row.Imprv_Attribute === 'Roofing') {
      improvement.roof = 'roof' in improvement ? null : ROOFS[words] || null;
    } else if (row.Imprv_Attribute === 'Exterior Wall' && WALLS[words]) {
      // A wall line's units are its share of the walls: the largest share is the home's walls.
      const share = number(row.Imprv_Attr_Units) || 0;
      if (!improvement.walls || share > improvement.walls.share) improvement.walls = { words: WALLS[words], share };
    }
  }
  const dwellings = new Map();
  for (const { parcel, heated, stories, bedrooms, baths, roof, walls } of improvements.values()) {
    const facts = {
      bedrooms, ...bathFacts(baths, 10), stories, living_sqft: heated && heated < 30000 ? heated : null, roof_cover: roof, exterior_walls: walls?.words,
    };
    if (!dwellings.has(parcel)) dwellings.set(parcel, []);
    dwellings.get(parcel).push(facts);
  }
  log(`${COUNTY}: ${improvements.size} dwellings on ${dwellings.size} parcels in the Property Appraiser's CAMA data`);
  const roll = await countyRoll(work, FIPS, today);
  const counts = fillHomes(roll.records, dwellings);
  log(describe(COUNTY, counts));
  yield {
    ...roll,
    name: COUNTY,
    publisher: 'Florida Department of Revenue and the Alachua County Property Appraiser',
    dataset: `${roll.dataset} and ${monthOf(zipDates(zip).get('Improvements.txt'))} building data`,
    method: 'county',
    source: 'fl-alachua',
    title: 'County records',
  };
}

module.exports = {
  build,
  dictionary: {
    file: FILE,
    facts: { bedrooms: 'ImprvAttributes Bedrooms (1-4 only)', bathrooms: 'ImprvAttributes Bathrooms', stories: 'Improvements Stories', living_sqft: 'Improvements Heated_SquareFeet', roof_cover: 'ImprvAttributes Roofing', exterior_walls: 'ImprvAttributes Exterior Wall (largest share)' },
  },
};
