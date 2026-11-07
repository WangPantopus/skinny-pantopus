'use strict';
// District of Columbia: the Office of Tax and Revenue's tables on DC GIS, under Creative Commons Attribution 4.0, so the District is
// credited. The public extract gives each lot's address and values; its owner, mailing and homestead columns are never asked for.
// CAMA gives houses and condominium units their facts. The District assesses at estimated market value each year.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit, streetParts, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '11001';
const COUNTY = 'District of Columbia';
const BASE = 'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/FeatureServer';
const EXTRACT = `${BASE}/53`;
const HOMES = `${BASE}/25`;
const CONDOS = `${BASE}/24`;
const EXTRACT_COLUMNS = ['SSL', 'PROPTYPE', 'USECODE', 'LANDAREA', 'PREMISEADD', 'NBHD', 'UNITNUMBER', 'NEWLAND', 'NEWIMPR', 'NEWTOTAL', 'LOWNUMBER', 'STREETNAME', 'QDRNTNAME', 'SALEPRICE', 'SALEDATE', 'ANNUALTAX', 'EXTRACTDAT'];
const HOME_COLUMNS = ['SSL', 'BLDG_NUM', 'BATHRM', 'HF_BATHRM', 'HEAT_D', 'AC', 'NUM_UNITS', 'ROOMS', 'BEDRM', 'AYB', 'EYB', 'STORIES', 'GBA', 'STYLE_D', 'STRUCT_D', 'GRADE_D', 'CNDTN_D', 'EXTWALL_D', 'ROOF_D', 'KITCHENS', 'FIREPLACES'];
const CONDO_COLUMNS = ['SSL', 'AYB', 'EYB', 'ROOMS', 'BEDRM', 'BATHRM', 'HF_BATHRM', 'HEAT_D', 'AC', 'FIREPLACES', 'LIVING_GBA'];

function useOf(row, home) {
  const type = String(row.PROPTYPE || '').toUpperCase();
  if (/^VACANT/.test(type)) return ['parcel', null];
  if (/CONDOMINIUM/.test(type)) return ['unit', 'condo'];
  if (/^RESIDENTIAL-SINGLE FAMILY/.test(type)) return ['property', /^(ROW|TOWN)/i.test(home?.STRUCT_D || '') ? 'townhouse' : 'house'];
  if (/^RESIDENTIAL-(CONVERSION|FLATS|MULTI-FAMILY)/.test(type)) return ['building', 'multi_unit'];
  if (/^RESIDENTIAL-(APARTMENT|TRANSIENT)/.test(type)) return ['building', 'apartment'];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};
const said = (text) => {
  const value = word(text);
  return value && !/^(NO DATA|DEFAULT|VACANT LAND|NONE)$/i.test(value) ? value : null;
};

function fromRow(row, { home, condo }) {
  const unit = realUnit(word(row.UNITNUMBER));
  const address = streetParts({ number: row.LOWNUMBER, name: word(row.STREETNAME) || '', post: word(row.QDRNTNAME) || '', unit });
  const parcel = word(row.SSL);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row, home);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const lives = kind === 'property' || kind === 'unit';
  const zip = /(\d{5})(-\d{4})?\s*$/.exec(row.PREMISEADD || '')?.[1] || '';
  put(facts, 'address_on_record', onRecord([row.LOWNUMBER, row.STREETNAME, row.QDRNTNAME].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'land_use', word(row.PROPTYPE));
  put(facts, 'county_use_code', word(row.USECODE));
  put(facts, 'neighborhood', word(row.NBHD));
  const either = home || condo;
  if (either && (lives || kind === 'building')) {
    put(facts, 'year_built', year(Math.trunc(Number(either.AYB))));
    put(facts, 'effective_year_built', year(Math.trunc(Number(either.EYB))));
  }
  if (home) {
    put(facts, 'style', said(home.STYLE_D));
    put(facts, 'building_type', said(home.STRUCT_D));
    put(facts, 'stories', inRange(home.STORIES, 30));
    put(facts, 'exterior_walls', said(home.EXTWALL_D));
    put(facts, 'roof_cover', said(home.ROOF_D));
    put(facts, 'quality', said(home.GRADE_D));
    if (positive(home.BLDG_NUM) > 1) facts.buildings_on_parcel = Math.trunc(Number(home.BLDG_NUM));
  }
  if (lives && either) {
    put(facts, 'living_sqft', positive(home?.GBA) || positive(condo?.LIVING_GBA));
    put(facts, 'bedrooms', inRange(either.BEDRM, 15));
    put(facts, 'rooms', inRange(either.ROOMS, 40));
    const [full, half] = [inRange(either.BATHRM, 15), inRange(either.HF_BATHRM, 10)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
    put(facts, 'fireplaces', inRange(either.FIREPLACES, 20));
    put(facts, 'heating', said(either.HEAT_D));
    if (either.AC === 'Y') facts.cooling = 'Air conditioning';
    if (home) {
      put(facts, 'condition', said(home.CNDTN_D));
      put(facts, 'kitchens', inRange(home.KITCHENS, 10));
    }
  }
  if (kind === 'building' && home) put(facts, 'units', positive(home.NUM_UNITS));
  if (kind !== 'unit') put(facts, 'lot_sqft', positive(row.LANDAREA));
  put(facts, 'market_value', positive(row.NEWTOTAL));
  put(facts, 'market_land_value', positive(row.NEWLAND));
  put(facts, 'market_building_value', positive(row.NEWIMPR));
  put(facts, 'tax_amount', positive(row.ANNUALTAX));
  if (positive(row.SALEPRICE) > 100) {
    facts.sale_price = positive(row.SALEPRICE);
    put(facts, 'sale_date', isoDate(row.SALEDATE));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel.replace(/\s+/g, '-')}`, kind, home_type: homeType, address: { ...address, city: 'WASHINGTON', zip: zipCode(zip) }, facts };
}

async function* build({ work }) {
  const dir = path.join(work, 'dc-dc');
  const homes = new Map();
  for await (const row of cached(path.join(dir, 'homes.jsonl.gz'), () => layerRows(HOMES, HOME_COLUMNS))) {
    const was = homes.get(row.SSL);
    if (!was || Number(row.GBA) > Number(was.GBA)) homes.set(row.SSL, row);
  }
  const condos = new Map();
  for await (const row of cached(path.join(dir, 'condos.jsonl.gz'), () => layerRows(CONDOS, CONDO_COLUMNS))) condos.set(row.SSL, row);
  const records = [];
  const seen = new Set();
  let [noAddress, newest] = [0, 0];
  for await (const row of cached(path.join(dir, 'extract.jsonl.gz'), () => layerRows(EXTRACT, EXTRACT_COLUMNS))) {
    newest = Math.max(newest, Number(row.EXTRACTDAT) || 0);
    const record = fromRow(row, { home: homes.get(row.SSL), condo: condos.get(row.SSL) });
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} lots, ${noAddress} without a street number, ${homes.size} houses, ${condos.size} condo units`);
  const asOf = isoDate(newest);
  if (!asOf) throw new Error('The extract no longer says when it was made');
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'DC', name: COUNTY, publisher: 'DC Office of Tax and Revenue', dataset: 'public extract and CAMA, DC GIS (CC BY 4.0)', method: 'county', source: 'dc-dc', as_of: asOf, stale_after_days: 60, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: [EXTRACT, HOMES, CONDOS],
    facts: { year_built: 'AYB', effective_year_built: 'EYB', living_sqft: ['GBA', 'LIVING_GBA'], bedrooms: 'BEDRM', rooms: 'ROOMS', full_baths: 'BATHRM', half_baths: 'HF_BATHRM', stories: 'STORIES', fireplaces: 'FIREPLACES', units: 'NUM_UNITS', lot_sqft: 'LANDAREA', market_value: 'NEWTOTAL', market_land_value: 'NEWLAND', market_building_value: 'NEWIMPR', sale_price: 'SALEPRICE', sale_date: 'SALEDATE', tax_amount: 'ANNUALTAX' },
  },
};
