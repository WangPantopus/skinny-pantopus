'use strict';
// Skagit County, Washington: the Assessor's tax parcel service, updated weekly, for information, not a survey; no limit on use stated. Year built, living
// area, bedrooms, plumbing in words, walls, roof, heat, values and last sale. RCW 42.56.070(8) bars lists of individuals for commercial use: no name is
// ever read, and owner, mailing and exemption columns are never asked for.

const path = require('node:path');
const { offsetRows, cached } = require('../lib/services.cjs');
const { streetParts, year, isoDate, zipCode, realUnit, onRecord } = require('../lib/addresses.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '53057';
const COUNTY = 'Skagit County';
const LAYER = 'https://gis.skagitcountywa.gov/arcgis/rest/services/OpenData/AssessorDataParcels/MapServer/0';
const COLUMNS = ['OBJECTID', 'PARCELID', 'SitusStNo', 'SitusStName', 'SitusCSZ', 'Unit', 'LandUse', 'BuildingStyle', 'YearBuilt', 'EffYearBuilt', 'LivingArea', 'NoOfBedrooms', 'Plumbing', 'Foundation', 'ExteriorWalls', 'RoofCovering', 'HeatAirCond', 'GarageSqFt', 'FinishedBasement', 'UnfinishedBasement', 'Acres', 'TotalMktValue', 'AssessedValue', 'BuildingValue', 'UnimprLandValue', 'ImprLandValue', 'SaleDate', 'SalePrice', 'TaxYear'];

function useOf(landUse, style, unit) {
  const code = Number(/^\((\d+)\)/.exec(landUse || '')?.[1]);
  const words = String(style || '').toUpperCase();
  if (code === 140) return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (/TOWNHOUSE/.test(words)) return ['property', 'townhouse'];
  if (code === 110 || code === 111 || code === 112 || code === 113 || code === 190 || code === 185) return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (code === 180 || code === 181 || code === 182) return ['property', 'mobile_home'];
  if (code === 120) return ['building', 'multi_unit'];
  if (code === 130 || code === 150) return ['building', 'apartment'];
  if (code >= 800 && code < 1000 && code !== 970) return ['parcel', null];
  return ['other', null];
}

// "MASTER BATH, 2 FULL BATHS, 3/4 BATH, HALF BATH".
function bathsIn(text) {
  const counts = { full: 0, threeQuarter: 0, half: 0 };
  for (const part of String(text || '').toUpperCase().split(',')) {
    const match = /^\s*(?:(\d+)\s+)?(MASTER BATH|FULL BATHS?|3\/4 BATHS?|HALF BATHS?)\s*$/.exec(part);
    if (!match) continue;
    const count = Number(match[1] || 1);
    if (/MASTER|FULL/.test(match[2])) counts.full += count;
    else if (/3\/4/.test(match[2])) counts.threeQuarter += count;
    else counts.half += count;
  }
  return counts.full + counts.threeQuarter + counts.half ? counts : null;
}

// Construction columns mix words with a few bare codes ("CCP"): only words are shown.
const words = (text) => {
  const value = word(text);
  return value && (/[\s-]/.test(value) || value.length >= 5) ? value : null;
};

function fromRow(row) {
  const unit = realUnit(word(row.Unit));
  const address = streetParts({ number: row.SitusStNo, name: word(row.SitusStName), unit });
  const parcel = word(row.PARCELID);
  if (!address || !parcel) return null;
  const place = /^(.*?),\s*WA\s+(\d{5})/i.exec(row.SitusCSZ || '');
  const [kind, homeType] = useOf(row.LandUse, row.BuildingStyle, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([row.SitusStNo, row.SitusStName].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'land_use', word(String(row.LandUse || '').replace(/^\(\d+\)\s*/, '')));
  put(facts, 'county_use_code', /^\((\d+)\)/.exec(row.LandUse || '')?.[1]);
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.YearBuilt));
    put(facts, 'effective_year_built', year(row.EffYearBuilt));
    put(facts, 'foundation', words(row.Foundation));
    put(facts, 'exterior_walls', words(row.ExteriorWalls));
    put(facts, 'roof_cover', words(row.RoofCovering));
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.LivingArea));
    const beds = positive(row.NoOfBedrooms);
    if (beds && beds <= 15) facts.bedrooms = beds;
    const baths = bathsIn(row.Plumbing);
    if (baths) {
      facts.bathrooms = baths.full + baths.threeQuarter * 0.75 + baths.half * 0.5;
      put(facts, 'full_baths', baths.full || null);
      put(facts, 'three_quarter_baths', baths.threeQuarter || null);
      put(facts, 'half_baths', baths.half || null);
    }
    put(facts, 'heating', words(row.HeatAirCond));
    put(facts, 'garage_sqft', positive(row.GarageSqFt));
    const basement = (positive(row.FinishedBasement) || 0) + (positive(row.UnfinishedBasement) || 0);
    put(facts, 'basement_sqft', basement || null);
    put(facts, 'basement_finished_sqft', positive(row.FinishedBasement));
  }
  if (kind === 'building') put(facts, 'gross_sqft', positive(row.LivingArea));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.Acres));
  put(facts, 'value_year', positive(row.TaxYear));
  put(facts, 'market_value', positive(row.TotalMktValue));
  put(facts, 'market_building_value', positive(row.BuildingValue));
  const land = (positive(row.ImprLandValue) || 0) + (positive(row.UnimprLandValue) || 0);
  put(facts, 'market_land_value', land || null);
  put(facts, 'assessed_value', positive(row.AssessedValue));
  if (positive(row.SalePrice)) {
    put(facts, 'sale_price', positive(row.SalePrice));
    put(facts, 'sale_date', isoDate(row.SaleDate));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(place?.[1]) || '').toUpperCase(), zip: zipCode(place?.[2]) }, facts };
}

async function* build({ work, today }) {
  const records = new Map();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'wa-skagit', 'parcels.jsonl.gz'), () => offsetRows(LAYER, COLUMNS, { orderBy: 'OBJECTID', pageSize: 2000 }))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (!records.has(record.id)) records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'WA', name: COUNTY, publisher: 'Skagit County Assessor', dataset: 'tax parcels', method: 'county', source: 'wa-skagit', as_of: isoDate(today.getTime()), stale_after_days: 450, extra_zips: zipsByCounty(work, ['53']).get(FIPS) || [], records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YearBuilt', effective_year_built: 'EffYearBuilt', living_sqft: 'LivingArea', gross_sqft: 'LivingArea', bedrooms: 'NoOfBedrooms', bathrooms: 'Plumbing', full_baths: 'Plumbing', three_quarter_baths: 'Plumbing', half_baths: 'Plumbing', foundation: 'Foundation', exterior_walls: 'ExteriorWalls', roof_cover: 'RoofCovering', heating: 'HeatAirCond', garage_sqft: 'GarageSqFt', basement_sqft: 'FinishedBasement', basement_finished_sqft: 'FinishedBasement', lot_acres: 'Acres', market_value: 'TotalMktValue', market_building_value: 'BuildingValue', market_land_value: 'ImprLandValue', assessed_value: 'AssessedValue', sale_price: 'SalePrice', sale_date: 'SaleDate', value_year: 'TaxYear' },
  },
};
