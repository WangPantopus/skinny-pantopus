'use strict';
// Lincoln County, North Carolina: the county's free GIS downloads, written nightly: improvements (year built, finished area, bedrooms, baths) and parcels
// (acres, values). The county states no limit on use and asks for none of the no-resale agreement G.S. 132-10 lets a county require. The owner and
// mailing columns of its parcel file are never read. Parcel addresses have no ZIP, so the county's ZIPs come from the Census.

const path = require('node:path');
const { download, zipDates, zipTable } = require('../lib/tables.cjs');
const { streetParts, year, isoDate } = require('../lib/addresses.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '37109';
const COUNTY = 'Lincoln County';
const FTP = 'https://arcgisserver.lincolncountync.gov/ftp';
const IMPROVEMENTS = ['AHPAR_', 'AHACYR', 'AHDESC', 'AHFNAR', 'AHBED_', 'AHBTH_', 'AHHBTH', 'BASEMENTSQFT', 'FINISHEDBASEMENTSQFT', 'FIREPLACECOUNT', 'AIRTYPE', 'AHCOMP'];
const PARCELS = ['AKPAR_', 'PIN', 'STREETNUM', 'STREETNAME', 'ACRE', 'MAPPEDACRE', 'IMPROVALUE', 'LANDVALUE', 'TOTALVALUE', 'TAXYEAR', 'NEIGHBORHOOD', 'VACANT', 'AKRDC5'];
const NOT_A_HOME = /STORAGE|BARN|SHED|PAVING|SHORELINE|GARAGE|POOL|FENCE|CARPORT|PORCH|SPACES|COMMERCIAL|OFFICE|STORE|WAREHOUSE|CHURCH|BUILDING|SHOP|CANOPY|DOCK|BOAT|PIER|DECK|TANK|GREENHOUSE|SILO|CABANA/;

function useOf(words) {
  const w = String(words || '').toUpperCase();
  if (!w) return null;
  if (/MANUFACTURED|MOBILE HOME$/.test(w) && !/SPACES/.test(w)) return ['property', 'mobile_home'];
  if (/TOWNHOUSE|TOWN HOME/.test(w)) return ['property', 'townhouse'];
  if (/CONDO/.test(w)) return ['property', 'townhouse'];
  if (/DUPLEX|TRIPLEX|QUADPLEX/.test(w)) return ['building', 'multi_unit'];
  if (/APARTMENT/.test(w)) return ['building', 'apartment'];
  if (NOT_A_HOME.test(w)) return null;
  return ['property', 'house'];
}

function fromParcel(row, main, valueYear) {
  const address = streetParts({ number: row.STREETNUM, name: word(row.STREETNAME) });
  const parcel = word(row.AKPAR_);
  if (!address || !parcel) return null;
  const vacant = String(row.VACANT).toUpperCase() === 'YES';
  const use = (main && useOf(main.AHDESC)) || (vacant ? ['parcel', null] : ['other', null]);
  const [kind, homeType] = use;
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property';
  put(facts, 'address_on_record', [row.STREETNUM, row.STREETNAME].map(word).filter(Boolean).join(' '));
  put(facts, 'neighborhood', word(row.NEIGHBORHOOD));
  put(facts, 'land_use', word(main?.AHDESC));
  if (main && (home || kind === 'building')) put(facts, 'year_built', year(main.AHACYR));
  if (main && home) {
    put(facts, 'living_sqft', positive(main.AHFNAR));
    const beds = positive(main.AHBED_);
    if (beds && beds <= 15) facts.bedrooms = beds;
    const [full, half] = [positive(main.AHBTH_), positive(main.AHHBTH)];
    if (full && full <= 12) {
      facts.full_baths = full;
      facts.bathrooms = full + (half && half <= 6 ? half * 0.5 : 0);
      put(facts, 'half_baths', half && half <= 6 ? half : null);
    }
    put(facts, 'fireplaces', positive(main.FIREPLACECOUNT));
    put(facts, 'basement_sqft', positive(main.BASEMENTSQFT));
    put(facts, 'basement_finished_sqft', positive(main.FINISHEDBASEMENTSQFT));
    put(facts, 'heating', word(main.AIRTYPE));
  }
  if (main && kind === 'building') put(facts, 'gross_sqft', positive(main.AHFNAR));
  // A deeded acreage where the county has one, else its mapped acreage.
  put(facts, 'lot_acres', positive(row.ACRE) || positive(row.MAPPEDACRE));
  put(facts, 'value_year', valueYear);
  put(facts, 'assessed_value', positive(row.TOTALVALUE));
  put(facts, 'assessed_land_value', positive(row.LANDVALUE));
  put(facts, 'assessed_building_value', positive(row.IMPROVALUE));
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: '', zip: null }, facts };
}

async function* build({ work }) {
  const dir = path.join(work, 'nc-lincoln');
  const [improvements, parcels] = [path.join(dir, 'improvements.zip'), path.join(dir, 'parceldata.zip')];
  download(`${FTP}/improvements.zip`, improvements);
  download(`${FTP}/parceldata.zip`, parcels);
  const asOf = zipDates(parcels).get('parceldata.csv');
  if (!asOf) throw new Error('The parcel file no longer says when it was made');
  const main = new Map();
  for await (const row of zipTable(improvements, 'improvements.csv', IMPROVEMENTS)) {
    if (!useOf(row.AHDESC)) continue;
    const held = main.get(row.AHPAR_);
    if (!held || (positive(row.AHFNAR) || 0) > (positive(held.AHFNAR) || 0)) main.set(row.AHPAR_, row);
  }
  const records = new Map();
  let noAddress = 0;
  for await (const row of zipTable(parcels, 'parceldata.csv', PARCELS)) {
    const record = fromParcel(row, main.get(row.AKPAR_), positive(row.TAXYEAR));
    if (!record) noAddress += 1;
    else if (!records.has(record.id)) records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'NC', name: COUNTY, publisher: 'Lincoln County GIS', dataset: 'GIS downloads: improvements and parcels', method: 'county', source: 'nc-lincoln', as_of: isoDate(asOf), stale_after_days: 450, extra_zips: zipsByCounty(work, ['37']).get(FIPS) || [], records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    columns: [...IMPROVEMENTS, ...PARCELS],
    facts: { year_built: 'AHACYR', living_sqft: 'AHFNAR', gross_sqft: 'AHFNAR', bedrooms: 'AHBED_', bathrooms: 'AHBTH_', full_baths: 'AHBTH_', half_baths: 'AHHBTH', fireplaces: 'FIREPLACECOUNT', basement_sqft: 'BASEMENTSQFT', basement_finished_sqft: 'FINISHEDBASEMENTSQFT', heating: 'AIRTYPE', lot_acres: 'ACRE', assessed_value: 'TOTALVALUE', assessed_land_value: 'LANDVALUE', assessed_building_value: 'IMPROVALUE', value_year: 'TAXYEAR' },
  },
};
