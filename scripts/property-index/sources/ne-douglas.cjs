'use strict';
// Douglas County, Nebraska: the county's public parcels (DOGIS), from its Assessor. No terms are stated on the service. Owner and mailing
// columns are in the layer and never asked for. No bedrooms, baths, values or sale prices.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '31055';
const COUNTY = 'Douglas County';
const LAYER = 'https://dcgis.org/server/rest/services/vector/Parcels_public/FeatureServer/0';
const COLUMNS = ['PIN', 'HOUSE', 'STREET_DIR', 'STREET_NAM', 'STREET_TYP', 'APARTMENT', 'PROP_CITY', 'PROP_ZIP', 'ADDITION_N', 'LEGAL1', 'LEGAL2', 'DCAACCTYPE', 'CLASS', 'NUMBLDGS', 'BLDG_SF', 'BLDG_STORY', 'BLDG_YRBLT', 'BLDG_DESC', 'QUALITY', 'CONDITION', 'ACRES', 'SQ_FEET'];

function useOf(row, unit, built) {
  const account = String(row.DCAACCTYPE || '').toUpperCase();
  const building = String(row.BLDG_DESC || '').toUpperCase();
  if (/^CONDO/.test(building)) return ['unit', 'condo'];
  if (/^APARTMENT/.test(building) || account === 'MULTIPLE RES') return ['building', 'apartment'];
  if (/^(RESIDENTIAL|RURAL RES)/.test(account)) {
    if (!built) return ['parcel', null];
    return unit ? ['unit', 'condo'] : ['property', 'house'];
  }
  return ['other', null];
}

const STORIES = /^(\d(?:\.\d)?)$/;
const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};
const said = (text) => {
  const value = word(text)?.replace(/^(OB|MH) /, '');
  return value && !/^\d+$/.test(value) ? value : null;
};

function fromRow(row) {
  const unit = realUnit(word(row.APARTMENT));
  const address = streetParts({ number: word(row.HOUSE) || '', pre: word(row.STREET_DIR) || '', name: word(row.STREET_NAM) || '', suffix: word(row.STREET_TYP) || '', unit });
  const parcel = word(row.PIN);
  if (!address || !parcel) return null;
  const size = positive(row.BLDG_SF);
  const [kind, homeType] = useOf(row, address.unit, Boolean(size));
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([row.HOUSE, row.STREET_DIR, row.STREET_NAM, row.STREET_TYP].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'land_use', word(row.DCAACCTYPE));
  put(facts, 'subdivision', word(row.ADDITION_N));
  put(facts, 'legal_description', [row.LEGAL1, row.LEGAL2].map(word).filter(Boolean).join(' ').slice(0, 300));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(Math.trunc(Number(row.BLDG_YRBLT))));
    put(facts, 'style', said(row.BLDG_DESC));
    const story = STORIES.test(String(Number(row.BLDG_STORY))) ? Number(row.BLDG_STORY) : null;
    put(facts, 'stories', inRange(story, kind === 'building' ? 40 : 6));
    put(facts, 'quality', said(row.QUALITY));
    if (positive(row.NUMBLDGS) > 1) facts.buildings_on_parcel = Math.trunc(Number(row.NUMBLDGS));
  }
  if (home) {
    put(facts, 'living_sqft', size);
    put(facts, 'condition', said(row.CONDITION));
  }
  if (kind === 'building') put(facts, 'gross_sqft', size);
  if (kind !== 'unit') {
    if (positive(row.SQ_FEET)) facts.lot_sqft = positive(row.SQ_FEET);
    else put(facts, 'lot_acres', positive(row.ACRES));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.PROP_CITY) || '').toUpperCase(), zip: zipCode(row.PROP_ZIP) }, facts };
}

async function* build({ work, today }) {
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'ne-douglas', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'NE', name: COUNTY, publisher: 'Douglas County Assessor', dataset: 'parcels, DOGIS', method: 'county', source: 'ne-douglas', as_of: isoDate(today.getTime()), stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'BLDG_YRBLT', living_sqft: 'BLDG_SF', gross_sqft: 'BLDG_SF', stories: 'BLDG_STORY', lot_sqft: 'SQ_FEET', lot_acres: 'ACRES' },
  },
};
