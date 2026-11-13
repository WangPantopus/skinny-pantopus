'use strict';
// Dane County, Wisconsin: the City of Madison's tax parcels, from its Assessor, updated daily. Its data policy disclaims any warranty and
// sets no limit on use. It covers the city, not the county's other municipalities, whose lookups get no record. Year built, bedrooms,
// baths, area, style, walls, basement, air, values and taxes. Owner columns are in the layer and never asked for.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { layerRows, cached } = require('../lib/services.cjs');
const { year, zipCode } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '55025';
const COUNTY = 'Dane County';
const LAYER = 'https://maps.cityofmadison.com/arcgis/rest/services/Public/OPEN_DATA2/FeatureServer/0';
const COLUMNS = ['Parcel', 'Address', 'PropertyClass', 'PropertyUse', 'HomeStyle', 'YearBuilt', 'Bedrooms', 'FullBaths', 'HalfBaths', 'TotalLivingArea', 'Basement', 'FinishedBasement', 'ExteriorWall1', 'Fireplaces', 'CentralAir', 'CurrentLand', 'CurrentImpr', 'CurrentTotal', 'TotalTaxes', 'LotSize', 'Zoning1', 'FirstFloor', 'SecondFloor', 'MoreThanOneBuild', 'AreaName'];
const WALLS = { 'Aluminum/Vinyl': 'Aluminum or vinyl', Wood: 'Wood', Brick: 'Brick', Stucco: 'Stucco', Composition: 'Composition', 'Cement/Smart': 'Cement board', 'Masonry Facing': 'Masonry facing', Stone: 'Stone', Vinyl: 'Vinyl', 'Smart Board': 'Smart board', 'Cement board': 'Cement board' };

function useOf(use, style, hasUnit) {
  const [u, s] = [String(use ?? '').trim(), String(style ?? '').trim()];
  if (u === 'Single family') return /Townhouse/.test(s) ? ['property', 'townhouse'] : ['property', 'house'];
  if (u === 'Condominium' || u === 'Condominium -other') return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (u === '2 Unit' || u === '3 Unit') return ['building', 'multi_unit'];
  if (u === 'Apartments' || u === 'Apartment & store') return ['building', 'apartment'];
  if (u === 'Vacant') return ['parcel', null];
  return ['other', null];
}

function fromRow(row) {
  const line = word(row.Address);
  const address = line ? parse(line) : null;
  const parcel = word(row.Parcel);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.PropertyUse, row.HomeStyle, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', line);
  put(facts, 'municipality', 'Madison');
  put(facts, 'land_use', word(row.PropertyUse));
  put(facts, 'property_class', word(row.PropertyClass));
  put(facts, 'zoning', word(row.Zoning1));
  put(facts, 'neighborhood', word(row.AreaName));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.YearBuilt));
    put(facts, 'style', word(row.HomeStyle));
    put(facts, 'exterior_walls', WALLS[String(row.ExteriorWall1 ?? '').trim()]);
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.TotalLivingArea));
    // A parcel with more than one building: no one building's floors say what the home is.
    if (kind === 'property' && row.MoreThanOneBuild !== 'YES') {
      put(facts, 'ground_floor_sqft', positive(row.FirstFloor));
      put(facts, 'second_floor_sqft', positive(row.SecondFloor));
    }
    put(facts, 'bedrooms', positive(row.Bedrooms));
    const [full, half] = [positive(row.FullBaths), positive(row.HalfBaths)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
    put(facts, 'basement_sqft', positive(row.Basement));
    put(facts, 'basement_finished_sqft', positive(row.FinishedBasement));
    put(facts, 'fireplaces', positive(row.Fireplaces));
    if (/^yes$/i.test(String(row.CentralAir ?? '').trim())) facts.cooling = 'Central air';
  } else if (kind === 'building') put(facts, 'gross_sqft', positive(row.TotalLivingArea));
  if (kind !== 'unit') put(facts, 'lot_sqft', positive(row.LotSize));
  put(facts, 'assessed_value', positive(row.CurrentTotal));
  put(facts, 'assessed_land_value', positive(row.CurrentLand));
  put(facts, 'assessed_building_value', positive(row.CurrentImpr));
  put(facts, 'tax_amount', positive(row.TotalTaxes));
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: 'MADISON', zip: zipCode(null) }, facts };
}

async function* build({ work, today }) {
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'wi-madison', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
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
    fips: FIPS, state: 'WI', name: COUNTY, publisher: 'City of Madison Assessor', dataset: 'tax parcels', method: 'county', source: 'wi-madison', as_of: today.toISOString().slice(0, 10), stale_after_days: 450, extra_zips: zipsByCounty(work, ['55']).get(FIPS) || [], records,
  };
}

// The parcel layer's own shapes, by the parcel number each record carries (the same columns): what lib/measure.cjs
// measures a lot's area and counts its buildings on (measured rows, held off until the county's measured_rows switch is on).
const parcelShapes = { url: LAYER, fields: ['Parcel'], key: (row) => word(row.Parcel) };

module.exports = {
  parcelShapes,
  build,
  dictionary: {
    layer: [LAYER],
    facts: { year_built: 'YearBuilt', style: 'HomeStyle', exterior_walls: 'ExteriorWall1', living_sqft: 'TotalLivingArea', gross_sqft: 'TotalLivingArea', bedrooms: 'Bedrooms', full_baths: 'FullBaths', half_baths: 'HalfBaths', basement_sqft: 'Basement', basement_finished_sqft: 'FinishedBasement', fireplaces: 'Fireplaces', cooling: 'CentralAir', lot_sqft: 'LotSize', assessed_value: 'CurrentTotal', assessed_land_value: 'CurrentLand', assessed_building_value: 'CurrentImpr', tax_amount: 'TotalTaxes', zoning: 'Zoning1', land_use: 'PropertyUse', property_class: 'PropertyClass' },
  },
};
