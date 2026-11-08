'use strict';
// North Carolina: NC OneMap's standardized parcels from all 100 counties, one file per county, under OneMap's free and
// unrestricted use policy, joined by parcel number to the statewide building layer OneMap lists (Floodplain Mapping
// Program, NC Emergency Management). That layer says where each figure came from: only what it marks as derived from
// the parcel or an appraisal is taken, never its modeled half (HAZUS, "estimated"). Values are whatever the county's
// valuation type says, so an assessment is only ever labeled one. The Eastern Band of Cherokee Indians' lands have their
// own file and aren't read here: their data is theirs. Owner and mailing columns are never decoded. A few counties' newest
// files have lost their street numbers (and sometimes values), while an older file of OneMap's still has them: those parcels
// read the older file's columns wherever the newest is blank, by parcel number.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { download, USER_AGENT } = require('../lib/tables.cjs');
const { dbfRows } = require('../lib/dbf.cjs');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const BUCKET = 'https://dit-cgia-gis-data.s3.amazonaws.com';
const BUILDINGS = 'https://services1.arcgis.com/YBWrN5qiESVpqi92/arcgis/rest/services/NC_Risk_Building_Footprints/FeatureServer/0';
const BUILDING_COLUMNS = ['PID', 'OCCUP_TYPE', 'YEAR_BUILT', 'YRBUILTSRC', 'HTD_SQ_FT', 'HTDSQFTSRC', 'NUM_STORY', 'FOUND_TYPE', 'BUILD_TYPE'];
const COUNTY_SOURCED = new Set(['1000', '2000', '2010']);
const COLUMNS = ['PARNO', 'ALTPARNO', 'GISACRES', 'IMPROVVAL', 'LANDVAL', 'PARVAL', 'PARVALTYPE', 'SITEADD', 'SUNIT', 'SCITY', 'SZIP', 'STRUCTYEAR', 'SALEDATE', 'SUBDIVISIO', 'PARUSEDESC', 'PARUSECODE', 'REVISEYEAR'];

// The state's counties in FIPS order: the file names, and each one's code is its place times two, minus one.
const COUNTY_FILES = [
  'alamance', 'alexander', 'alleghany', 'anson', 'ashe', 'avery', 'beaufort', 'bertie', 'bladen', 'brunswick', 'buncombe', 'burke', 'cabarrus',
  'caldwell', 'camden', 'carteret', 'caswell', 'catawba', 'chatham', 'cherokee', 'chowan', 'clay', 'cleveland', 'columbus', 'craven', 'cumberland',
  'currituck', 'dare', 'davidson', 'davie', 'duplin', 'durham', 'edgecombe', 'forsyth', 'franklin', 'gaston', 'gates', 'graham', 'granville',
  'greene', 'guilford', 'halifax', 'harnett', 'haywood', 'henderson', 'hertford', 'hoke', 'hyde', 'iredell', 'jackson', 'johnston', 'jones', 'lee',
  'lenoir', 'lincoln', 'mcdowell', 'macon', 'madison', 'martin', 'mecklenburg', 'mitchell', 'montgomery', 'moore', 'nash', 'new-hanover',
  'northampton', 'onslow', 'orange', 'pamlico', 'pasquotank', 'pender', 'perquimans', 'person', 'pitt', 'polk', 'randolph', 'richmond', 'robeson',
  'rockingham', 'rowan', 'rutherford', 'sampson', 'scotland', 'stanly', 'stokes', 'surry', 'swain', 'transylvania', 'tyrrell', 'union', 'vance',
  'wake', 'warren', 'washington', 'watauga', 'wayne', 'wilkes', 'wilson', 'yadkin', 'yancey',
];

// Counties word their uses their own way, or use a letter of their own. What the building layer calls the building decides
// when the words don't.
function useOf(text, unit, occupancy, improved) {
  const use = String(text ?? '').toUpperCase();
  // A county that only says R for residential: a house where something's built, land where nothing is.
  if (/^\s*R\s*$/.test(use) && !occupancy) return improved ? (unit ? ['unit', 'condo'] : ['property', 'house']) : ['parcel', null];
  if (/CONDO|TOWN ?H/.test(use)) return /CONDO/.test(use) || unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (/MOBILE|MANUFACT/.test(use)) return ['property', 'mobile_home'];
  if (/DUPLEX|TRIPLEX|TWO FAM|2 FAM|MULTI/.test(use)) return ['building', 'multi_unit'];
  if (/APART|\bAPT\b/.test(use)) return ['building', 'apartment'];
  if (/VACANT|\bVAC\b|\bLAND\b|WOODED|FARM WITH NO/.test(use)) return ['parcel', null];
  if (/SINGLE|RESID|DWELLING|HOUSE|\bRHS\b/.test(use)) return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (occupancy === 'RES1') return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (occupancy === 'RES2') return ['property', 'mobile_home'];
  if (/^RES3[A-C]$/.test(occupancy || '')) return ['building', 'multi_unit'];
  if (/^RES3[D-F]$/.test(occupancy || '')) return ['building', 'apartment'];
  return ['other', null];
}

/** "2 - PARCEL DERIVED - HIGH CONFIDENCE": the value, when the layer says the parcel is where it came from. */
function parcelWords(field) {
  const words = new Map();
  for (const { code, name } of field?.domain?.codedValues || []) {
    const match = /^(.+?) - PARCEL DERIVED/.exec(name);
    if (match) words.set(String(code), match[1].trim());
  }
  return words;
}
/** Every occupancy code's class, whatever the layer says the class came from: "RES1 - HAZUS DERIVED" is RES1. */
function occupancyWords(field) {
  return new Map((field?.domain?.codedValues || []).map(({ code, name }) => [String(code), String(name).split(' ')[0]]));
}
const STORIES = { 1: 1, '1 1/2': 1.5, 2: 2, 3: 3, 4: 4, 5: 5 };
const WALLS = { CONCRETE: 'Concrete', MANUFCHOME: 'Manufactured', MASONRY: 'Masonry', STEEL: 'Steel', WOOD: 'Wood' };
const FOOTINGS = { BASEMENT: 'Basement', 'CRAWL SPACE': 'Crawl space', FILL: 'Fill', PIER: 'Pier', PILE: 'Pile', 'SLAB ON GRADE': 'Slab', 'SOLID WALL': 'Solid wall' };

// Each parcel's largest building, in the county's own figures. How many it has goes on the record too.
// Counties with a connector of their own, for the bedrooms and baths these parcels lack.
const OWN_CONNECTOR = new Set(['37051', '37081', '37097', '37109', '37119', '37133', '37163', '37183']);

async function buildingsOf(work, fips, lists) {
  const parcels = new Map();
  const rows = cached(path.join(work, 'nc-onemap', `buildings-${fips}.jsonl.gz`), () => layerRows(BUILDINGS, BUILDING_COLUMNS, { where: `BLDG_ID LIKE '${fips}%'` }));
  for await (const row of rows) {
    const parcel = word(row.PID);
    if (!parcel) continue;
    if (!parcels.has(parcel)) parcels.set(parcel, { count: 0 });
    const held = parcels.get(parcel);
    held.count += 1;
    const area = COUNTY_SOURCED.has(String(row.HTDSQFTSRC)) ? positive(row.HTD_SQ_FT) : null;
    if (held.count > 1 && !(area > (held.area || 0))) continue;
    held.occupancy = lists.occupancy.get(String(row.OCCUP_TYPE)) || null;
    held.area = area;
    held.built = COUNTY_SOURCED.has(String(row.YRBUILTSRC)) ? year(row.YEAR_BUILT) : null;
    held.stories = STORIES[lists.stories.get(String(row.NUM_STORY))] || null;
    held.frame = WALLS[lists.frame.get(String(row.BUILD_TYPE))] || null;
    held.foundation = FOOTINGS[lists.foundation.get(String(row.FOUND_TYPE))] || null;
  }
  // Some counties' parcel numbers carry the layer's PIN without its punctuation and suffix: 4907-83-01270000 is 4907830127.
  // Only when that reading names one parcel.
  const bare = new Map();
  for (const [parcel, held] of parcels) {
    const key = pinOf(parcel);
    bare.set(key, bare.has(key) ? null : held);
  }
  for (const [key, held] of bare) if (held && !parcels.has(key)) parcels.set(key, held);
  return parcels;
}

const pinOf = (parcel) => String(parcel).toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/0+$/, '');

function fromRow(row, fips, county, buildings) {
  const unit = realUnit(row.SUNIT);
  const parsed = parse(row.SITEADD, unit);
  // Some counties' newest files leave PARNO blank and put the same number here, the one the building layer uses.
  const parcel = word(row.PARNO) || word(row.ALTPARNO);
  if (!parsed || !parcel) return null;
  // The building layer keys some counties by the other parcel number OneMap carries.
  const building = [parcel, word(row.ALTPARNO)].filter(Boolean).flatMap((id) => [buildings.get(id), buildings.get(pinOf(id))]).find(Boolean);
  const [kind, homeType] = useOf(`${row.PARUSEDESC || ''} ${row.PARUSECODE || ''}`, parsed.unit, building?.occupancy, positive(row.IMPROVVAL) || year(row.STRUCTYEAR));
  const facts = { parcel_number: parcel, county, fips };
  const on = kind === 'property' || kind === 'unit' || kind === 'building';
  put(facts, 'address_on_record', onRecord(row.SITEADD, unit));
  put(facts, 'year_built', on ? (year(row.STRUCTYEAR) || building?.built || null) : null);
  if (on && building) {
    put(facts, 'living_sqft', kind !== 'building' ? building.area : null);
    put(facts, 'gross_sqft', kind === 'building' ? building.area : null);
    put(facts, 'stories', building.stories);
    put(facts, 'frame', building.frame);
    put(facts, 'foundation', building.foundation);
    if (building.count > 1) facts.buildings_on_parcel = building.count;
  }
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.GISACRES));
  put(facts, 'subdivision', word(row.SUBDIVISIO));
  // A bare letter is the county's own code, not a word for a screen.
  put(facts, 'land_use', String(row.PARUSEDESC ?? '').trim().length > 2 ? word(row.PARUSEDESC) : null);
  put(facts, 'county_use_code', word(row.PARUSECODE));
  const valueType = String(row.PARVALTYPE ?? '').trim().toUpperCase();
  put(facts, valueType.startsWith('MARKET') || valueType.startsWith('APPRAIS') ? 'market_value' : 'assessed_value', positive(row.PARVAL));
  if (positive(row.PARVAL)) put(facts, 'value_year', positive(row.REVISEYEAR));
  const sold = isoDate(row.SALEDATE);
  if (sold && sold > '1800') facts.sale_date = sold;
  return { id: `pp:${kind}:${fips}:${parcel}`, kind, home_type: homeType, address: { ...parsed, city: String(word(row.SCITY) || '').toUpperCase(), zip: zipCode(row.SZIP) }, facts };
}

/** Each county's newest file, with its older ones, newest first, from the bucket's listing. */
async function newestFiles() {
  const listed = new Map();
  let token = null;
  do {
    const query = new URLSearchParams({ 'list-type': '2', prefix: 'NCOM-data/parcels/', 'max-keys': '1000' });
    if (token) query.set('continuation-token', token);
    const response = await fetch(`${BUCKET}/?${query}`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`The file list answered ${response.status}`);
    const listing = await response.text();
    for (const [, key, name, month, day, yearText] of listing.matchAll(/<Key>(NCOM-data\/parcels\/([a-z-]+)-parcels-(\d\d)-(\d\d)-(\d{4})\.zip)<\/Key>/g)) {
      const date = `${yearText}-${month}-${day}`;
      if (!listed.has(name)) listed.set(name, []);
      listed.get(name).push({ key, date });
    }
    token = /<NextContinuationToken>([^<]+)/.exec(listing)?.[1] || null;
  } while (token);
  const newest = new Map();
  for (const [name, files] of listed) {
    files.sort((a, b) => (a.date < b.date ? 1 : -1));
    newest.set(name, { ...files[0], older: files.slice(1) });
  }
  return newest;
}

function tableOf(zip, name) {
  const member = execFileSync('unzip', ['-Z1', zip], { encoding: 'latin1', maxBuffer: 1e7 }).split('\n').find((entry) => /_pt\.dbf$/i.test(entry));
  if (!member) throw new Error(`The file for ${name} has no table`);
  return member;
}

const parcelOf = (row) => word(row.PARNO) || word(row.ALTPARNO);
const OPTIONAL = { optional: ['ALTPARNO'] };
// Fewer of its parcels than this with a street number and an older file isn't one that still has them.
const OLDER_FILE_SHARE = 0.3;
// No file OneMap holds for these has street numbers, back to 2015 (checked November 2026): they need the county's own file.
const NEVER_NUMBERED = new Set(['franklin', 'orange', 'perquimans', 'richmond']);

/** The newest older file that still has street numbers, as its rows by parcel number. Null when none does. */
async function olderRows(work, name, older) {
  for (const { key, date } of older) {
    const zip = path.join(work, 'nc-onemap', `${name}-older.zip`);
    download(`${BUCKET}/${key}`, zip);
    const rows = new Map();
    let total = 0;
    for await (const row of dbfRows(zip, tableOf(zip, name), COLUMNS, OPTIONAL)) {
      total += 1;
      const parcel = parcelOf(row);
      if (parcel && parse(row.SITEADD, realUnit(row.SUNIT))) rows.set(parcel, row);
    }
    fs.rmSync(zip, { force: true });
    if (rows.size >= total * OLDER_FILE_SHARE) {
      log(`${name}: ${rows.size} of ${total} parcels have street numbers in its ${date} file`);
      return rows;
    }
  }
  return null;
}

const filled = (row) => Object.fromEntries(Object.entries(row).filter(([, value]) => String(value ?? '').trim()));

async function* build({ work }) {
  const only = (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  const files = await newestFiles();
  log(`${files.size} county files listed`);
  const about = await getJson(`${BUILDINGS}?f=json`, 'The building layer\'s description');
  const field = (name) => (about.fields || []).find((entry) => entry.name === name);
  const lists = { stories: parcelWords(field('NUM_STORY')), frame: parcelWords(field('BUILD_TYPE')), foundation: parcelWords(field('FOUND_TYPE')), occupancy: occupancyWords(field('OCCUP_TYPE')) };
  if (!lists.stories.size || !lists.frame.size) throw new Error('The building layer no longer says what its codes mean');
  if (files.size < 95) throw new Error(`Only ${files.size} county files are listed`);
  for (const [name, { key, date, older }] of [...files].sort()) {
    const place = COUNTY_FILES.indexOf(name);
    if (place < 0) {
      log('A file that is not one of the 100 counties isn\'t read');
      continue;
    }
    const fips = `37${String(place * 2 + 1).padStart(3, '0')}`;
    if (OWN_CONNECTOR.has(fips) || (only.length && !only.includes(fips))) continue;
    const buildings = await buildingsOf(work, fips, lists);
    const zip = path.join(work, 'nc-onemap', `${name}.zip`);
    download(`${BUCKET}/${key}`, zip);
    const member = tableOf(zip, name);
    const byCounty = [];
    const seen = new Set();
    const county = `${name.replace(/-/g, ' ').replace(/(^|\s)\S/g, (first) => first.toUpperCase()).replace(/^Mc(\w)/, (_, next) => `Mc${next.toUpperCase()}`)} County`;
    let noAddress = 0;
    const read = async (earlier) => {
      for await (const row of dbfRows(zip, member, COLUMNS, OPTIONAL)) {
        const record = fromRow(earlier ? { ...earlier.get(parcelOf(row)), ...filled(row) } : row, fips, county, buildings);
        if (!record) noAddress += 1;
        else if (!seen.has(record.id)) {
          seen.add(record.id);
          byCounty.push(record);
        }
      }
    };
    await read(null);
    if (!byCounty.length && !NEVER_NUMBERED.has(name)) {
      const earlier = await olderRows(work, name, older);
      if (earlier) {
        noAddress = 0;
        await read(earlier);
      }
    }
    fs.rmSync(zip, { force: true });
    log(`${county}: ${byCounty.length} records, ${noAddress} without a street number`);
    // A county whose file has no street numbers has nothing to look up.
    if (!byCounty.length) continue;
    for (const building of condoBuildings(byCounty, { fips, county })) byCounty.push(building);
    yield {
      fips, state: 'NC', name: county, publisher: 'NC OneMap', dataset: 'county parcels and building layer', method: 'state', source: 'nc-onemap', title: 'State records', as_of: date, stale_after_days: 400, records: byCounty,
    };
  }
}

module.exports = { build };
