'use strict';
// Fort Bend County, Texas: the Fort Bend Central Appraisal District's public parcel data on its Open Data Hub, which it publishes
// without warranty. Year built, living area, land and market values; bedrooms and baths from its residential segments file, on its
// certified data page; sale prices aren't public in Texas.
// Owner, mailing, deed and exemption columns are never asked for: the owner column is only used to ask which accounts are
// marked protected (Tax Code 25.025).

const path = require('node:path');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { download, zipMembers, zipTable } = require('../lib/tables.cjs');
const { newestFile, whole } = require('../lib/pacs-county.cjs');
const { year, isoDate, zipCode, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { CATEGORY_WORDS, protectedWhere, useOf } = require('../lib/texas.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { alsoAtOwnLine } = require('../lib/own-line.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '48157';
const COUNTY = 'Fort Bend County';
const LAYER = 'https://services2.arcgis.com/D4saGHECICkCeoJm/arcgis/rest/services/FBCAD_Public_Data/FeatureServer/0';
const COLUMNS = ['QUICKREFID', 'PROPNUMBER', 'SITUS', 'SITUSSNO', 'SITUSPRDIR', 'SITUSSNM', 'SITUSPODIR', 'SITUSSTP', 'SITUSAPT', 'LEGAL', 'TOTALVALUE', 'LANDVALUE', 'IMPVALUE', 'YEARBUILT', 'TOTSQFTLVG', 'LANDSIZEFT', 'LANDSIZEAC', 'Land_State_Code', 'Building_SPTB_Code'];

// "123 OAK ST, SUGAR LAND, TX  77478": the city and ZIP are only in this text.
function placeOf(text) {
  const match = /,\s*([^,]+?),?\s+TX\s+(\d{5})/i.exec(String(text ?? ''));
  return match ? { city: match[1].trim().toUpperCase(), zip: match[2] } : { city: '', zip: null };
}

// Bedrooms and baths aren't on the parcel layer: the district's residential segments file has them on each home's main segment.
const DATA_PAGE = 'https://www.fbcad.org/certified-and-supplements-reports/';
async function roomsByAccount(work) {
  const url = await newestFile(DATA_PAGE, String.raw`href="([^"]*Website_?Residential_?Seg[^"]*\.zip)"`);
  const zip = path.join(work, 'tx-fort-bend', path.basename(new URL(url).pathname));
  download(url, zip);
  const member = zipMembers(zip).find((name) => /\.csv$/i.test(name));
  if (!member) throw new Error('The residential segments file is no longer a CSV');
  const rooms = new Map();
  for await (const row of zipTable(zip, member, ['QuickRefID', 'fBedrooms', 'fPlumbing', 'fNumHalfBath'], { headerHas: 'QuickRefID' })) {
    if (!row.fBedrooms && !row.fPlumbing) continue;
    const id = String(row.QuickRefID).trim();
    if (!rooms.has(id)) rooms.set(id, row);
  }
  return rooms;
}

function fromRow(row, rooms) {
  const address = streetParts({ number: row.SITUSSNO, pre: row.SITUSPRDIR, name: row.SITUSSNM, suffix: row.SITUSSTP, post: row.SITUSPODIR, unit: realUnit(String(row.SITUSAPT ?? '').replace(/^#\s*/, '')) });
  const account = word(row.QUICKREFID) || word(row.PROPNUMBER);
  if (!address || !account) return null;
  const built = year(row.YEARBUILT);
  const living = positive(row.TOTSQFTLVG);
  const code = String(word(row.Building_SPTB_Code) || word(row.Land_State_Code) || '').toUpperCase();
  const [kind, homeType] = useOf(code, address.unit, Boolean(built || living));
  const facts = { parcel_number: account, county: COUNTY, fips: FIPS };
  const place = placeOf(row.SITUS);
  put(facts, 'address_on_record', onRecord(String(word(row.SITUS) || '').split(',')[0], row.SITUSAPT && !String(row.SITUS).includes(String(row.SITUSAPT)) ? row.SITUSAPT : ''));
  put(facts, 'land_use', CATEGORY_WORDS[code[0]]);
  put(facts, 'county_use_code', code);
  put(facts, 'legal_description', word(row.LEGAL)?.slice(0, 300));
  if (kind === 'property' || kind === 'unit' || kind === 'building') put(facts, 'year_built', built);
  if (kind === 'property' || kind === 'unit') {
    put(facts, 'living_sqft', living);
    const room = rooms?.get(account);
    if (room) {
      put(facts, 'bedrooms', whole(room.fBedrooms, 15));
      const [full, half] = [whole(room.fPlumbing, 12), whole(room.fNumHalfBath, 6)];
      if (full) {
        facts.full_baths = full;
        facts.bathrooms = full + (half || 0) * 0.5;
        put(facts, 'half_baths', half);
      }
    }
  }
  else if (kind === 'building') put(facts, 'gross_sqft', living);
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.LANDSIZEAC) || (positive(row.LANDSIZEFT) ? Number((positive(row.LANDSIZEFT) / 43560).toFixed(4)) : null));
  put(facts, 'market_value', positive(row.TOTALVALUE));
  put(facts, 'market_land_value', positive(row.LANDVALUE));
  put(facts, 'market_building_value', positive(row.IMPVALUE));
  return { id: `pp:${kind}:${FIPS}:${account}`, kind, home_type: homeType, address: { ...address, city: place.city, zip: zipCode(place.zip) }, facts };
}

async function* build({ work }) {
  const rooms = await roomsByAccount(work);
  log(`${rooms.size} accounts with bedrooms or baths in the residential segments`);
  const about = await getJson(`${LAYER}?f=json`, 'The layer\'s description');
  const asOf = isoDate(about.editingInfo?.dataLastEditDate || about.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The layer no longer says when it changed');
  const hidden = new Set();
  for await (const row of layerRows(LAYER, ['QUICKREFID'], { where: protectedWhere('OWNERNAME') })) hidden.add(String(row.QUICKREFID));
  log(`${hidden.size} accounts marked protected`);
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'tx-fort-bend', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    if (hidden.has(String(row.QUICKREFID))) continue;
    const record = fromRow(row, rooms);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  // The district writes a lettered house number with a space ("100 E", its number column), so its address line reads like a
  // direction ("100 E OAK ST") and can find the plain number's home. Such a home is also filed at its own line, where it's found.
  const twins = alsoAtOwnLine(records, { onlyWrong: true });
  records.push(...twins);
  log(`${COUNTY}: ${records.length} accounts, ${noAddress} without a street number, ${twins.length} also filed at their own address line`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'TX', name: COUNTY, publisher: 'Fort Bend Central Appraisal District', dataset: 'public parcel data', method: 'county', source: 'tx-fort-bend', as_of: asOf, stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: [LAYER],
    columns: ['fBedrooms', 'fPlumbing', 'fNumHalfBath'],
    facts: { bedrooms: 'fBedrooms', bathrooms: 'fPlumbing', full_baths: 'fPlumbing', half_baths: 'fNumHalfBath', year_built: 'YEARBUILT', living_sqft: 'TOTSQFTLVG', gross_sqft: 'TOTSQFTLVG', lot_acres: 'LANDSIZEAC', market_value: 'TOTALVALUE', market_land_value: 'LANDVALUE', market_building_value: 'IMPVALUE', legal_description: 'LEGAL' },
  },
};
