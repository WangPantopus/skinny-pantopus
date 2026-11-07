'use strict';
// York County, South Carolina: the county's parcel layer and its assessment system's buildings table, both on the county's open data site, which offers
// its GIS data at no cost and its services for use in other applications. The layers disclaim any warranty; no limit on use stated. Year built,
// finished area, baths, appraised and assessed values, deeded or mapped acres and last sale; the county records no bedrooms. Owner, mailing,
// homestead and previous-owner columns are never asked for. Site addresses carry no city or ZIP, so the county's ZIPs come from the Census.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '45091';
const COUNTY = 'York County';
const BASE = 'https://services1.arcgis.com/2AGLxyiJoNiVHKwq/arcgis/rest/services';
const PARCELS = `${BASE}/Parcels/FeatureServer/0`;
const BUILDINGS = `${BASE}/Patriot_YCGIS_Buildings/FeatureServer/0`;
const PARCEL_COLUMNS = ['OBJECTID', 'ParcelID', 'AprAccNum', 'PropertyAddress', 'LandUseDesc', 'ImprovedStatus', 'NeighborhoodDesc', 'LegalDescription', 'subdivision', 'BldgTypeDesc', 'FinishedSQFT', 'YearBuilt', 'BuildingCount', 'AprLandVal', 'AprBldgVal', 'AprTotVal', 'AsdTotVal', 'deededacres', 'GISSizeAC', 'DateSold', 'SalePrice'];
const BUILDING_COLUMNS = ['OBJECTID', 'PropertyID', 'BuildingTypeDescription', 'ExteriorWallDescription', 'FrameDescription', 'QualityDescription', 'StoryHeight', 'ResidentialUnits', 'YearBuilt', 'Baths', 'ThreeQuarterBaths', 'HalfBaths', 'FirePlaces', 'finishedarea'];
const DWELLINGS = /^(Residential|Townhouse|RES CONDO|Attached Manufactured Home|Manufactured Home|Duplex)$/i;

function useOf(type, improved, unit) {
  const t = String(type || '').trim().toUpperCase();
  if (t === 'RESIDENTIAL' || t === 'TOWNHOUSE') return unit ? ['unit', 'condo'] : ['property', t === 'TOWNHOUSE' ? 'townhouse' : 'house'];
  if (t === 'RES CONDO') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (/MANUFACTURED HOME/.test(t)) return ['property', 'mobile_home'];
  if (t === 'DUPLEX') return ['building', 'multi_unit'];
  if (/^APARTMENTS/.test(t)) return ['building', 'apartment'];
  if (!t && /^VACANT$/i.test(String(improved || '').trim())) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function fromRow(row, building) {
  // A unit follows a comma: "street, UNIT 4".
  const [street, secondary = ''] = String(row.PropertyAddress ?? '').split(/\s*,\s*/);
  const address = parse(street, secondary);
  const parcel = word(row.ParcelID);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.BldgTypeDesc, row.ImprovedStatus, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(street, secondary.replace(/^(UNIT|APT|STE|SUITE)\s+/i, '')));
  put(facts, 'land_use', word(row.LandUseDesc));
  put(facts, 'neighborhood', word(row.NeighborhoodDesc));
  put(facts, 'subdivision', word(row.subdivision));
  put(facts, 'legal_description', word(row.LegalDescription)?.slice(0, 300));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(building?.YearBuilt) || year(row.YearBuilt));
    put(facts, 'exterior_walls', word(building?.ExteriorWallDescription));
    put(facts, 'frame', word(building?.FrameDescription));
    put(facts, 'quality', word(building?.QualityDescription));
    if (positive(row.BuildingCount) > 1) facts.buildings_on_parcel = positive(row.BuildingCount);
  }
  if (home) {
    put(facts, 'living_sqft', positive(building?.finishedarea) || positive(row.FinishedSQFT));
    const [full, threeQuarter, half] = [inRange(building?.Baths, 15), inRange(building?.ThreeQuarterBaths, 10), inRange(building?.HalfBaths, 10)];
    put(facts, 'full_baths', full);
    put(facts, 'three_quarter_baths', threeQuarter);
    put(facts, 'half_baths', half);
    if (full || threeQuarter || half) facts.bathrooms = (full || 0) + 0.75 * (threeQuarter || 0) + 0.5 * (half || 0);
    put(facts, 'stories', inRange(building?.StoryHeight, 5));
    put(facts, 'fireplaces', inRange(building?.FirePlaces, 20));
  }
  if (kind === 'building') put(facts, 'units', inRange(building?.ResidentialUnits, 2000));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.deededacres) || positive(row.GISSizeAC));
  put(facts, 'market_value', positive(row.AprTotVal));
  put(facts, 'market_land_value', positive(row.AprLandVal));
  put(facts, 'market_building_value', positive(row.AprBldgVal));
  put(facts, 'assessed_value', positive(row.AsdTotVal));
  if (isHomeSale(positive(row.SalePrice))) {
    put(facts, 'sale_price', positive(row.SalePrice));
    put(facts, 'sale_date', isoDate(row.DateSold));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: '', zip: null }, facts };
}

async function* build({ work }) {
  const dir = path.join(work, 'sc-york');
  const info = await getJson(`${PARCELS}?f=json`, 'The parcel layer\'s description');
  const asOf = isoDate(info.editingInfo?.dataLastEditDate || info.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The parcel layer no longer says when it changed');
  // A property's facts come from its largest finished dwelling.
  const buildings = new Map();
  for await (const row of cached(path.join(dir, 'buildings.jsonl.gz'), () => layerRows(BUILDINGS, BUILDING_COLUMNS))) {
    if (!DWELLINGS.test(String(row.BuildingTypeDescription || '').trim())) continue;
    const key = String(row.PropertyID);
    const was = buildings.get(key);
    if (!was || (positive(row.finishedarea) || 0) > (positive(was.finishedarea) || 0)) buildings.set(key, row);
  }
  const records = new Map();
  let noAddress = 0;
  for await (const row of cached(path.join(dir, 'parcels.jsonl.gz'), () => layerRows(PARCELS, PARCEL_COLUMNS))) {
    const record = fromRow(row, buildings.get(String(row.AprAccNum)));
    if (!record) noAddress += 1;
    else if (!records.has(record.id)) records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number; ${buildings.size} dwellings`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'SC', name: COUNTY, publisher: 'York County', dataset: 'parcels and assessment records', method: 'county', source: 'sc-york', as_of: asOf, stale_after_days: 60, extra_zips: zipsByCounty(work, ['45']).get(FIPS) || [], records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: [PARCELS, BUILDINGS],
    facts: { year_built: 'YearBuilt', living_sqft: 'finishedarea', full_baths: 'Baths', bathrooms: 'Baths', three_quarter_baths: 'ThreeQuarterBaths', half_baths: 'HalfBaths', stories: 'StoryHeight', fireplaces: 'FirePlaces', units: 'ResidentialUnits', lot_acres: 'deededacres', market_value: 'AprTotVal', market_land_value: 'AprLandVal', market_building_value: 'AprBldgVal', assessed_value: 'AsdTotVal', sale_price: 'SalePrice', sale_date: 'DateSold' },
  },
};
