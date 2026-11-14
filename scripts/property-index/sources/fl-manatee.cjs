'use strict';
// Manatee County, Florida: the state's roll (fl-roll.cjs), with each home's bedrooms, baths, floors and heated area from the
// Property Appraiser's Comprehensive CAMA Data File, the free full-county download its "CAMA Reports & Data" page posts and
// updates nightly. Its terms ask only that no one's use slow the site for others (scraping, harvesting); this reads the one
// file the office publishes for download. Only the parcel number, use code and main residential building's columns are read;
// the owner, mailing, sales and exemption columns never are. Protected people's parcels carry no number in the file, and only
// parcels already on the roll (protected people removed) take a fact.

const path = require('node:path');
const { download, zipTable, zipDates } = require('../lib/tables.cjs');
const { number, positive } = require('../lib/values.cjs');
const { fillHomes, describe, monthOf } = require('../lib/fill.cjs');
const { log } = require('../lib/log.cjs');
const { countyRoll } = require('./fl-roll.cjs');

const FIPS = '12081';
const COUNTY = 'Manatee County';
const FILE = 'https://www.manateepao.gov/data/manatee_ccdf.zip';
const TABLE = 'manatee_ccdf.csv';
// The record layout (Comprehensive_CAMA_Data_File_Record_Layout.xlsx): the main residential building's bedroom count, full and
// half bathroom counts, living area (heated and air-conditioned) and stories, and how many residential buildings the parcel has.
const COLUMNS = ['PARID', 'CER_DOR_LUC_CODE', 'CUR_DOR_LUC_CODE', 'BLDGS_RESIDENTIAL', 'BLDG_R1_BEDRMS', 'BLDG_R1_FBATHS', 'BLDG_R1_HBATHS', 'BLDG_R1_SQFTLIVNG', 'BLDG_R1_STORIES'];
// Florida's use codes for one home: a house, a mobile home, a condominium unit, a cooperative unit.
const HOME_USES = new Set(['01', '02', '04', '05']);

const count = (text, most) => {
  const value = positive(text);
  return value && value <= most && Number.isInteger(value) ? value : null;
};
// A bath total as Florida's appraisers count it: a half bath is half. Two half baths stay two, beside the full ones.
const baths = (full, half) => (full ? { bathrooms: full + (half || 0) / 2, full_baths: full, ...(half ? { half_baths: half } : {}) } : {});
// The file writes a parcel number without the roll's leading zeros.
const key = (parcel) => String(parcel || '').trim().padStart(10, '0');

async function* build({ work, today }) {
  const zip = path.join(work, 'fl-manatee', 'ccdf.zip');
  download(FILE, zip);
  const dwellings = new Map();
  let homes = 0;
  for await (const row of zipTable(zip, TABLE, COLUMNS)) {
    const use = (row.CER_DOR_LUC_CODE || row.CUR_DOR_LUC_CODE).slice(0, 2);
    // A parcel with a second residential building (a guest house) has two homes' rooms; the main building's alone isn't sure.
    if (!row.PARID || !HOME_USES.has(use) || number(row.BLDGS_RESIDENTIAL) !== 1) continue;
    homes += 1;
    const full = count(row.BLDG_R1_FBATHS, 20);
    const half = count(row.BLDG_R1_HBATHS, 10);
    const stories = number(row.BLDG_R1_STORIES);
    const heated = positive(row.BLDG_R1_SQFTLIVNG);
    const facts = {
      bedrooms: count(row.BLDG_R1_BEDRMS, 15),
      ...baths(full, half),
      stories: stories >= 1 && stories <= 6 && (stories * 2) % 1 === 0 ? stories : null,
      living_sqft: heated && heated < 30000 ? heated : null,
    };
    const parcel = key(row.PARID);
    if (!dwellings.has(parcel)) dwellings.set(parcel, []);
    dwellings.get(parcel).push(facts);
  }
  log(`${COUNTY}: ${homes} homes with one residential building in the Property Appraiser's CAMA file`);
  const roll = await countyRoll(work, FIPS, today);
  const counts = fillHomes(roll.records, dwellings, { keyOf: (record) => key(record.facts.parcel_number) });
  log(describe(COUNTY, counts));
  yield {
    ...roll,
    name: COUNTY,
    publisher: 'Florida Department of Revenue and the Manatee County Property Appraiser',
    dataset: `${roll.dataset} and ${monthOf(zipDates(zip).get(TABLE))} CAMA data`,
    method: 'county',
    source: 'fl-manatee',
    title: 'County records',
  };
}

module.exports = {
  build,
  dictionary: {
    file: FILE,
    facts: {
      bedrooms: 'BLDG_R1_BEDRMS', full_baths: 'BLDG_R1_FBATHS', half_baths: 'BLDG_R1_HBATHS', bathrooms: 'BLDG_R1_FBATHS + BLDG_R1_HBATHS / 2',
      stories: 'BLDG_R1_STORIES', living_sqft: 'BLDG_R1_SQFTLIVNG',
    },
  },
};
