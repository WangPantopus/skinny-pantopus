'use strict';
// Cumberland County, North Carolina: the county's tax parcels with each building's assessment facts, on its own GIS server, one row per building.
// The county's GIS terms of use disclaim any warranty and call the site a public service to the county's citizens and the Internet community; they
// state no limit on use and ask for none of the no-resale agreement G.S. 132-10 lets a county require. Year built, heated area, bedrooms, baths,
// stories, acres, values and last sale. The owner and mailing columns are never asked for. Parcels carry no site ZIP, so the county's ZIPs come
// from the Census. The server sits behind a firewall that refuses some filters, so rows are paged on the object ID alone.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { streetParts, year, isoDate, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '37051';
const COUNTY = 'Cumberland County';
const LAYER = 'https://gis.co.cumberland.nc.us/server/rest/services/Tax/Parcels/MapServer/0';
const COLUMNS = ['REID', 'PIN', 'PHYADDR_STR_NUM', 'PHYADDR_DIR_PFX', 'PHYADDR_STR', 'PHYADDR_STR_TYPE', 'ACREAGE', 'LAND_CLASS', 'NEIGHBORHOOD', 'Zoning', 'TOTAL_PROP_VALUE', 'TOTAL_LAND_VALUE_ASSESSED', 'TOTAL_BLDG_VALUE_ASSESSED', 'PKG_SALE_DATE', 'PKG_SALE_PRICE', 'BLDG_TYPE', 'BLDG_DESC', 'UNITS', 'STORY_HEIGHT', 'YEAR_BUILT', 'EFF_YEAR', 'GRADE', 'CONDITION', 'HEATED_AREA', 'BEDROOMS', 'BATH_FULL', 'BATH_HALF'];

// The county's building types: R1 a single-family house (RL a log home, RM a modular one), R5 a townhouse, RH half of a duplex on its own parcel, R2,
// RT and RQ two to four units, R3 and RS manufactured homes.
function useOf(type, land) {
  const code = String(type || '').trim().toUpperCase().slice(0, 2);
  if (code === 'R1' || code === 'RL' || code === 'RM') return ['property', 'house'];
  if (code === 'R5' || code === 'RH') return ['property', 'townhouse'];
  if (code === 'R2' || code === 'RT' || code === 'RQ') return ['building', 'multi_unit'];
  if (code === 'R3' || code === 'RS') return ['property', 'mobile_home'];
  if (!code && /VACANT/i.test(String(land || ''))) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function fromRow(row) {
  const address = streetParts({ number: row.PHYADDR_STR_NUM, pre: word(row.PHYADDR_DIR_PFX) || '', name: word(row.PHYADDR_STR) || '', suffix: word(row.PHYADDR_STR_TYPE) || '' });
  const parcel = word(row.REID);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.BLDG_TYPE, row.LAND_CLASS);
  const facts = { parcel_number: word(row.PIN) || parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property';
  put(facts, 'address_on_record', onRecord([row.PHYADDR_STR_NUM, row.PHYADDR_DIR_PFX, row.PHYADDR_STR, row.PHYADDR_STR_TYPE].map(word).filter(Boolean).join(' ')));
  put(facts, 'land_use', word(row.LAND_CLASS));
  put(facts, 'neighborhood', word(row.NEIGHBORHOOD));
  put(facts, 'zoning', word(row.Zoning));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.YEAR_BUILT));
    put(facts, 'effective_year_built', year(row.EFF_YEAR));
    put(facts, 'style', word(row.BLDG_DESC));
    put(facts, 'quality', word(row.GRADE));
    put(facts, 'condition', word(row.CONDITION));
    if (row.buildings > 1) facts.buildings_on_parcel = row.buildings;
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.HEATED_AREA));
    put(facts, 'bedrooms', inRange(row.BEDROOMS, 15));
    const [full, half] = [inRange(row.BATH_FULL, 12), inRange(row.BATH_HALF, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
    put(facts, 'stories', inRange(row.STORY_HEIGHT, 5));
  }
  if (kind === 'building') put(facts, 'units', inRange(row.UNITS, 2000));
  put(facts, 'lot_acres', positive(row.ACREAGE));
  put(facts, 'assessed_value', positive(row.TOTAL_PROP_VALUE));
  put(facts, 'assessed_land_value', positive(row.TOTAL_LAND_VALUE_ASSESSED));
  put(facts, 'assessed_building_value', positive(row.TOTAL_BLDG_VALUE_ASSESSED));
  if (isHomeSale(positive(row.PKG_SALE_PRICE))) {
    put(facts, 'sale_price', positive(row.PKG_SALE_PRICE));
    put(facts, 'sale_date', isoDate(row.PKG_SALE_DATE));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: '', zip: null }, facts };
}

async function* build({ work, today }) {
  // A parcel's facts come from its largest heated building; the rest are counted.
  const parcels = new Map();
  for await (const row of cached(path.join(work, 'nc-cumberland', 'buildings.jsonl.gz'), () => layerRows(LAYER, COLUMNS, { where: 'OBJECTID > 0' }))) {
    const key = word(row.REID);
    if (!key) continue;
    const was = parcels.get(key);
    const heated = positive(row.HEATED_AREA) || 0;
    if (!was) parcels.set(key, { ...row, buildings: heated ? 1 : 0 });
    else {
      const buildings = was.buildings + (heated ? 1 : 0);
      if (heated > (positive(was.HEATED_AREA) || 0)) parcels.set(key, { ...row, buildings });
      else was.buildings = buildings;
    }
  }
  const records = [];
  let noAddress = 0;
  for (const row of parcels.values()) {
    const record = fromRow(row);
    if (record) records.push(record);
    else noAddress += 1;
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'NC', name: COUNTY, publisher: 'Cumberland County', dataset: 'tax parcels and buildings', method: 'county', source: 'nc-cumberland', as_of: isoDate(today.getTime()), stale_after_days: 450, extra_zips: zipsByCounty(work, ['37']).get(FIPS) || [], records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YEAR_BUILT', effective_year_built: 'EFF_YEAR', living_sqft: 'HEATED_AREA', bedrooms: 'BEDROOMS', bathrooms: 'BATH_FULL', full_baths: 'BATH_FULL', half_baths: 'BATH_HALF', stories: 'STORY_HEIGHT', units: 'UNITS', lot_acres: 'ACREAGE', assessed_value: 'TOTAL_PROP_VALUE', assessed_land_value: 'TOTAL_LAND_VALUE_ASSESSED', assessed_building_value: 'TOTAL_BLDG_VALUE_ASSESSED', sale_price: 'PKG_SALE_PRICE', sale_date: 'PKG_SALE_DATE' },
  },
};
