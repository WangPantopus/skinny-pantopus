'use strict';
// Bexar County, Texas: the Bexar Appraisal District's parcels, which the City of San Antonio republishes weekly as open data
// (its notice: no restrictions on use or distribution). Living area, land and category, no values. Year built is only in the
// county's own parcel layer, last loaded from the district in 2019: it stands for a home that stood then, and a newer home goes
// without. Bedrooms and baths aren't published and sale prices aren't public in Texas. Owner, mailing and exemption columns
// are never asked for: the owner column is only used to ask which accounts are marked protected (Tax Code 25.025).

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, onRecord, realUnit } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { CATEGORY_WORDS, protectedWhere, useOf } = require('../lib/texas.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '48029';
const COUNTY = 'Bexar County';
const PARCELS = 'https://services.arcgis.com/g1fRTDLeMgspWrYp/arcgis/rest/services/BCAD_Parcels/FeatureServer/0';
const YEARS = 'https://maps.bexar.org/arcgis/rest/services/Parcels/MapServer/0';
const COLUMNS = ['PropID', 'Geo_id', 'Situs', 'legal_desc', 'GBA_Living', 'state_cd', 'legal_acre', 'LandSqft'];

// "123 MAIN ST #4, SAN ANTONIO, TX 78201". A few lost the comma before San Antonio.
function situsOf(text) {
  const match = /^(.*?),?\s*TX\s+(\d{5})(-\d{4})?$/i.exec(String(text ?? '').replace(/\s+/g, ' ').trim());
  if (!match) return null;
  const pieces = match[1].split(',').map((piece) => piece.trim());
  if (pieces.length >= 2) return { line: pieces.slice(0, -1).join(' '), city: pieces.at(-1), zip: match[2] };
  const glued = /^(.*\S)\s+SAN ANTONIO$/i.exec(pieces[0]);
  return glued ? { line: glued[1], city: 'SAN ANTONIO', zip: match[2] } : null;
}

function fromRow(row, built) {
  const situs = situsOf(row.Situs);
  const unit = situs && /\s#\s*(\S.*)$/.exec(situs.line);
  const street = unit ? situs.line.slice(0, unit.index) : situs?.line;
  const address = street ? parse(street, realUnit(unit?.[1])) : null;
  const account = String(row.PropID ?? '').trim();
  if (!address || !account) return null;
  const living = positive(row.GBA_Living);
  const code = String(word(row.state_cd) || '').toUpperCase();
  const [kind, homeType] = useOf(code, address.unit, Boolean(living));
  const facts = { parcel_number: account, county: COUNTY, fips: FIPS };
  put(facts, 'address_on_record', onRecord(street, unit?.[1]));
  put(facts, 'land_use', CATEGORY_WORDS[code[0]]);
  put(facts, 'county_use_code', code);
  put(facts, 'legal_description', word(row.legal_desc)?.slice(0, 300));
  if (kind === 'property' || kind === 'unit' || kind === 'building') put(facts, 'year_built', year(built));
  if (kind === 'property' || kind === 'unit') put(facts, 'living_sqft', living);
  else if (kind === 'building') put(facts, 'gross_sqft', living);
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.legal_acre) || (positive(row.LandSqft) ? Number((positive(row.LandSqft) / 43560).toFixed(4)) : null));
  return { id: `pp:${kind}:${FIPS}:${account}`, kind, home_type: homeType, address: { ...address, city: String(situs.city).toUpperCase(), zip: zipCode(situs.zip) }, facts };
}

async function* build({ work }) {
  const about = await getJson(`${PARCELS}?f=json`, 'The layer\'s description');
  const asOf = isoDate(about.editingInfo?.dataLastEditDate);
  if (!asOf) throw new Error('The layer no longer says when it changed');
  const hidden = new Set();
  for await (const row of layerRows(PARCELS, ['PropID'], { where: protectedWhere('Owner_Name') })) hidden.add(String(row.PropID));
  log(`${hidden.size} accounts marked protected`);
  const years = new Map();
  for await (const row of cached(path.join(work, 'tx-bexar', 'years.jsonl.gz'), () => layerRows(YEARS, ['PropID', 'YrBlt'], { oid: 'OBJECTID' }))) {
    if (positive(row.YrBlt)) years.set(String(row.PropID).trim(), row.YrBlt);
  }
  log(`${years.size} accounts with a year built`);
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'tx-bexar', 'parcels.jsonl.gz'), () => layerRows(PARCELS, COLUMNS))) {
    if (hidden.has(String(row.PropID))) continue;
    const record = fromRow(row, years.get(String(row.PropID).trim()));
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} accounts, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'TX', name: COUNTY, publisher: 'Bexar Appraisal District and the City of San Antonio', dataset: 'parcels', method: 'county', source: 'tx-bexar', as_of: asOf, stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: [PARCELS, YEARS],
    facts: { year_built: 'YrBlt', living_sqft: 'GBA_Living', gross_sqft: 'GBA_Living', lot_acres: 'legal_acre', legal_description: 'legal_desc' },
  },
};
