'use strict';
// Summit County, Ohio: the Fiscal Office's public tax parcels. No terms are stated on the service. Year built, finished floor area,
// floors and values on residential parcels. Owner and mailing columns are in the layer and never asked for. Bedrooms and baths
// come from the dwelling file (SC710_DWELL) and lot size from the land file (SC709_LAND), among the Fiscal Office's free CAMA
// downloads, matched by parcel; its owner and mailing files aren't downloaded. The layer has no ZIP or town for a site (its
// city column is the taxpayer's mailing city, never read), so the county's ZIPs come from the Census, and a record's town
// comes from Pantopus's own address registry for the county, matched by number and street: routing only, so a lookup that
// names a town finds the county. Assessed values are Ohio's 35% of market.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { statePath, releasePath } = require('../../../backend/services/propertyRecords/format');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, realUnit, onRecord } = require('../lib/addresses.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { download, zipTable, zipDates, USER_AGENT } = require('../lib/tables.cjs');
const { fillHomes, bathFacts, describe, dayOf } = require('../lib/fill.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '39153';
const COUNTY = 'Summit County';
const DOWNLOADS = 'https://fiscaloffice.summitoh.net/data-downloads';
const LAYER = 'https://services3.arcgis.com/3Ukh5HzAdI6WZ3KP/arcgis/rest/services/TaxParcels_public/FeatureServer/0';
const COLUMNS = ['PARCELID', 'LOWPARCELID', 'UNIT', 'SITEADDRESS', 'CVTTXDSCRP', 'USECD', 'PRPRTYDSCRP', 'FLOORCOUNT', 'RESFLRAREA', 'RESYRBLT', 'LNDVALUE', 'CNTASSDVAL', 'cntmarval', 'bldgvalue'];
const USE_WORDS = { 500: 'Residential vacant land', 510: 'Single-family dwelling', 520: 'Two-family dwelling', 530: 'Three-family dwelling', 550: 'Condominium', 560: 'Mobile home', 599: 'Other residential' };

function useOf(code, hasUnit) {
  const c = String(code ?? '').trim();
  if (c === '510') return hasUnit ? ['unit', 'condo'] : ['property', 'house'];
  if (c === '550') return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (c === '520' || c === '530') return ['building', 'multi_unit'];
  if (c === '560') return ['property', 'mobile_home'];
  if (c === '500' || c === '400' || c === '300' || c === '600') return ['parcel', null];
  return ['other', null];
}

// "123  OAK ST ", and a span of numbers such as "123& 125  OAK ST" reads as its first.
const siteOf = (text) => String(text ?? '').replace(/\s+/g, ' ').trim().replace(/^(\d+)\s*[&-]\s*[\d/ ]*\s(?=[A-Z])/i, '$1 ');

function fromRow(row) {
  const line = siteOf(row.SITEADDRESS);
  const address = line ? parse(line, realUnit(row.UNIT)) : null;
  const parcel = word(row.PARCELID) || word(row.LOWPARCELID);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.USECD, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(line, row.UNIT));
  put(facts, 'land_use', USE_WORDS[String(row.USECD).trim()]);
  put(facts, 'county_use_code', word(row.USECD));
  put(facts, 'legal_description', word(row.PRPRTYDSCRP)?.slice(0, 300));
  put(facts, 'municipality', word(row.CVTTXDSCRP));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.RESYRBLT));
    put(facts, 'stories', positive(row.FLOORCOUNT));
  }
  if (home) put(facts, 'living_sqft', positive(row.RESFLRAREA));
  else if (kind === 'building') put(facts, 'gross_sqft', positive(row.RESFLRAREA));
  put(facts, 'market_value', positive(row.cntmarval));
  put(facts, 'market_land_value', positive(row.LNDVALUE));
  put(facts, 'market_building_value', positive(row.bldgvalue));
  put(facts, 'assessed_value', positive(row.CNTASSDVAL));
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: '', zip: null }, facts };
}

const count = (text, most) => {
  const value = positive(text);
  return value && value <= most && Number.isInteger(value) ? value : null;
};

/** One of the CAMA downloads the data downloads page links, by its table's name (SC710_DWELL), downloaded once. */
function camaFile(work, page, table) {
  const link = new RegExp(`href="([^"]*${table}[^"]*\\.zip)"`, 'i').exec(page)?.[1];
  if (!link) throw new Error(`The data downloads page no longer links ${table}`);
  const zip = path.join(work, 'oh-summit', `${table}.zip`);
  download(new URL(link, DOWNLOADS).href, zip);
  return zip;
}

/** Each parcel's dwellings (one card each) from the CAMA dwelling file: BD bedrooms, BTH full baths, FXH half baths, ST floors, SFLA living area. */
async function dwellings(work, page) {
  const zip = camaFile(work, page, 'SC710_DWELL');
  const found = new Map();
  for await (const row of zipTable(zip, 'SC710_DWELL.CSV', ['PARCEL', 'CARD', 'BD', 'BTH', 'FXH', 'ST', 'SFLA'])) {
    const full = count(row.BTH, 20);
    const half = count(row.FXH, 10);
    const floors = positive(row.ST);
    const living = positive(row.SFLA);
    const facts = {
      bedrooms: count(row.BD, 15),
      ...(full ? bathFacts(full + (half || 0) * 0.5, 30) : {}),
      // The file's own full count: a total of 3 from 2 full and 2 half baths is still 2 full baths.
      ...(full && half ? { full_baths: full, half_baths: half } : {}),
      stories: floors >= 1 && floors <= 6 && (floors * 2) % 1 === 0 ? floors : null,
      living_sqft: living && living < 30000 ? living : null,
    };
    if (!found.has(row.PARCEL)) found.set(row.PARCEL, []);
    found.get(row.PARCEL).push(facts);
  }
  return found;
}

/** Each parcel's land in square feet from the CAMA land file: the sum of its land lines' SQF (front-foot lines carry it too). */
async function lots(work, page) {
  const zip = camaFile(work, page, 'SC709_LAND');
  const found = new Map();
  for await (const row of zipTable(zip, 'SC709_LAND.CSV', ['PARCEL', 'SQF'])) {
    const sqft = positive(row.SQF);
    if (sqft) found.set(row.PARCEL, (found.get(row.PARCEL) || 0) + sqft);
  }
  return found;
}

// 2,000 acres: a larger sum is a land record that isn't one lot.
const MOST_LOT_SQFT = 2000 * 43560;

const streetLine = ({ number, pre, name, suffix, post }) => [number, pre || '', name, suffix || '', post || ''].join('|').toUpperCase();

/**
 * Each street line's town from Pantopus's own address registry for the county (registry/ in the index's storage, which a
 * build can read). A line the registry places in two towns gets none. No storage here (a local run without its key): no towns.
 */
function registryTowns(work) {
  const towns = new Map();
  const bucket = process.env.PROPERTY_INDEX_BUCKET;
  if (!bucket) {
    log(`${COUNTY}: no address registry here, so its records name no town`);
    return towns;
  }
  const root = `s3://${bucket}/index/registry`;
  const dir = path.join(work, 'oh-summit', 'registry');
  fs.mkdirSync(dir, { recursive: true });
  const copy = (name) => {
    const to = path.join(dir, path.basename(name));
    execFileSync('aws', ['s3', 'cp', `${root}/${name}`, to, '--only-show-errors'], { stdio: ['ignore', 'ignore', 'inherit'] });
    return to;
  };
  const county = JSON.parse(fs.readFileSync(copy(statePath('OH')), 'utf8')).jurisdictions[FIPS];
  if (!county) {
    log(`${COUNTY}: the address registry has no release here, so its records name no town`);
    return towns;
  }
  const release = releasePath(FIPS, county.release);
  const { lengths } = JSON.parse(zlib.gunzipSync(fs.readFileSync(copy(`${release}/manifest.json.gz`))));
  const bytes = fs.readFileSync(copy(`${release}/data.bin`));
  let offset = 0;
  for (const length of lengths) {
    for (const { kind, address } of JSON.parse(zlib.gunzipSync(bytes.subarray(offset, offset + length)))) {
      if (kind === 'unit' || !address.city) continue;
      const line = streetLine(address);
      towns.set(line, towns.has(line) && towns.get(line) !== address.city ? null : address.city);
    }
    offset += length;
  }
  log(`${COUNTY}: ${towns.size} street lines in the address registry's release ${county.release}`);
  return towns;
}

async function* build({ work }) {
  const about = await getJson(`${LAYER}?f=json`, 'The layer\'s description');
  const layerAsOf = isoDate(about.editingInfo?.dataLastEditDate || about.editingInfo?.lastEditDate);
  if (!layerAsOf) throw new Error('The layer no longer says when it changed');
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'oh-summit', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number`);
  const page = execFileSync('curl', ['-fsSL', '-A', USER_AGENT, '--max-time', '60', '--retry', '3', DOWNLOADS], { encoding: 'utf8', maxBuffer: 1 << 25 });
  const counts = fillHomes(records, await dwellings(work, page));
  log(describe(COUNTY, counts));
  // A lot is the parcel's: a house's or a building's, never a condo unit's (its land is common).
  const land = await lots(work, page);
  let lotted = 0;
  for (const { kind, facts } of records) {
    if ((kind !== 'property' && kind !== 'building') || facts.lot_sqft || facts.lot_acres) continue;
    const sqft = land.get(facts.parcel_number);
    if (sqft && sqft < MOST_LOT_SQFT) {
      facts.lot_sqft = Math.round(sqft);
      lotted += 1;
    }
  }
  log(`${COUNTY}: ${lotted} homes and buildings gained a lot size from the land file`);
  // Routing only: a record that names its town is found by a lookup that names the town without a ZIP. Lines the registry
  // doesn't hold, or holds in two towns, stay as they were: found by ZIP, as before.
  const towns = registryTowns(work);
  let named = 0;
  for (const { address } of records) {
    const town = towns.get(streetLine(address));
    if (town && !address.city) {
      address.city = town;
      named += 1;
    }
  }
  log(`${COUNTY}: ${named} of ${records.length} records name their town from the address registry`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  // The release is dated by the newest file whose facts it shows: the CAMA files (bedrooms, baths, lot), written monthly, are far
  // newer than the layer's last edit. The layer's own date stays in the dataset line.
  const camaAsOf = ['SC710_DWELL', 'SC709_LAND'].map((table) => zipDates(path.join(work, 'oh-summit', `${table}.zip`)).get(`${table}.CSV`)).filter(Boolean).sort().pop();
  const asOf = [layerAsOf, camaAsOf].filter(Boolean).sort().pop();
  log(`${COUNTY}: tax parcels last changed ${layerAsOf}, CAMA files of ${camaAsOf || 'no date'}; the release is dated ${asOf}`);
  yield {
    fips: FIPS, state: 'OH', name: COUNTY, publisher: 'Summit County Fiscal Office', dataset: `tax parcels as of ${dayOf(layerAsOf)}, with CAMA dwelling and land data of ${dayOf(camaAsOf)}`, method: 'county', source: 'oh-summit', as_of: asOf, stale_after_days: 730, extra_zips: zipsByCounty(work, ['39']).get(FIPS) || [], records,
  };
}

// The parcel layer's own shapes, by the parcel number each record carries (the same columns): what lib/measure.cjs
// measures a lot's area and counts its buildings on (measured rows, held off until the county's measured_rows switch is on).
const parcelShapes = { url: LAYER, fields: ['PARCELID', 'LOWPARCELID'], key: (row) => word(row.PARCELID) || word(row.LOWPARCELID) };

module.exports = {
  parcelShapes,
  build,
  dictionary: {
    layer: [LAYER],
    dwellings: DOWNLOADS,
    facts: { bedrooms: 'SC710_DWELL BD', full_baths: 'SC710_DWELL BTH', half_baths: 'SC710_DWELL FXH', bathrooms: 'BTH + FXH / 2', lot_sqft: 'SC709_LAND SQF, summed by parcel', year_built: 'RESYRBLT', living_sqft: 'RESFLRAREA', gross_sqft: 'RESFLRAREA', stories: 'FLOORCOUNT', market_value: 'cntmarval', market_land_value: 'LNDVALUE', market_building_value: 'bldgvalue', assessed_value: 'CNTASSDVAL', legal_description: 'PRPRTYDSCRP', municipality: 'CVTTXDSCRP' },
  },
};
