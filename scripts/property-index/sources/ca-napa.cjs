'use strict';
// Napa County, California: the county's public parcel layer with each parcel's Assessor characteristics, on its own ArcGIS Online, made
// available under the Open Data Commons Public Domain Dedication and License (PDDL) 1.0, with a note that boundaries are approximate. Year built,
// finished size, bedrooms, full and half baths, floors, fireplaces, garage, acres and the roll's land and improvement values. The layer holds no
// owner names; the homeowner exemption column and net assessed value (its distance from the roll value says a home has the exemption) are never
// asked for. The Assessor records baths on fewer homes than bedrooms; a home whose baths read zero gets none.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { streetParts, year, isoDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '06055';
const COUNTY = 'Napa County';
const LAYER = 'https://services1.arcgis.com/Ko5rxt00spOfjMqj/arcgis/rest/services/Napa_County_Public_Parcels/FeatureServer/1';
const COLUMNS = ['ASMT', 'asmt_status', 'StreetNum', 'StreetDir', 'Street', 'StreetType', 'SpaceApt', 'Community', 'Zip', 'Jurisdiction', 'Landuse1', 'LandUseDescription', 'NeighborhoodCode', 'Condo_Status', 'Acres', 'Prcl_Size_SqFt', 'CurrentMarketLandValue', 'CurrentStructuralImprValue', 'TotalLandImprValue', 'BuildingCount', 'BuildingFloorCount', 'Building_Size_SqFt', 'GarageSize_SqFt', 'YearBuilt', 'UnitCount', 'DwellingUnitsCount', 'BedroomsCount', 'FullBathsCount', 'HalfBathsCount', 'FireplacesCount'];

// The Assessor's use descriptions: single-family homes (in town, rural, or on a vineyard "W/1 RES"), condominiums and townhouses, parcels with two or
// more homes, apartments. A winery's buildings would be read as its home's, so wineries stay "other". A code's trailing E isn't shown: the
// layer doesn't say what it means, and it may mark an exemption.
function useOf(description, unit) {
  const d = String(description || '').replace(/\s+/g, ' ').trim().toUpperCase();
  if (/WINERY/.test(d)) return ['other', null];
  if (/^(SFR|SINGLE FAMILY RESIDENTIAL)|W\/1 RES$/.test(d)) return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (/^CONDOMINIUMS ?- ?TOWNHOUSES$/.test(d)) return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (/^MANUFACTURED HOMES$/.test(d)) return ['property', 'mobile_home'];
  if (/^(TWO|THREE|FOUR) DWELLING UNITS$|^(DUPLEX|TRIPLEX|FOUR-PLEX|MULTIPLE RESIDENTIAL MISC)$|W\/[2-9] SFRS$/.test(d)) return ['building', 'multi_unit'];
  if (/APARTMENT UNITS$/.test(d)) return ['building', 'apartment'];
  if (/^VACANT LOT RESIDENTIAL$|^VACANT LAND-DIRECT ENTRY PROG$|^VACANT LOT W\/MISC IMP$/.test(d)) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

// The community code is the postal place; parcels with no code take their incorporated city.
const PLACES = { NAP: 'NAPA', AMC: 'AMERICAN CANYON', STH: 'SAINT HELENA', CST: 'CALISTOGA', YNT: 'YOUNTVILLE', ANG: 'ANGWIN', POP: 'POPE VALLEY', DRP: 'DEER PARK', SON: 'SONOMA', GLEN: 'GLEN ELLEN', MTWN: 'MIDDLETOWN', VJO: 'VALLEJO', FAIR: 'FAIRFIELD', VAC: 'VACAVILLE' };
function cityOf(row) {
  const place = PLACES[String(row.Community || '').trim().toUpperCase()];
  if (place) return place;
  const city = String(row.Jurisdiction || '').trim().toUpperCase();
  return city === 'UNINCORPORATED' ? '' : city.replace(/^ST /, 'SAINT ');
}

function fromRow(row) {
  const number = String(row.StreetNum ?? '').trim();
  const unit = word(row.SpaceApt) || '';
  const address = /^\d+[A-Z]?$/i.test(number) ? streetParts({ number, pre: word(row.StreetDir) || '', name: word(row.Street) || '', suffix: word(row.StreetType) || '', unit }) : null;
  const parcel = word(row.ASMT);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.LandUseDescription, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([number, row.StreetDir, row.Street, row.StreetType].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'county_use_code', word(row.Landuse1)?.replace(/E$/i, ''));
  put(facts, 'land_use', word(row.LandUseDescription)?.replace(/^CONDOMINIUMS ?- ?TOWNHOUSES$/i, 'CONDOMINIUMS - TOWNHOUSES'));
  put(facts, 'neighborhood', word(row.NeighborhoodCode));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.YearBuilt));
    put(facts, 'stories', inRange(row.BuildingFloorCount, 5));
    if (positive(row.BuildingCount) > 1) facts.buildings_on_parcel = positive(row.BuildingCount);
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.Building_Size_SqFt));
    put(facts, 'bedrooms', inRange(row.BedroomsCount, 15));
    const [full, half] = [inRange(row.FullBathsCount, 12), inRange(row.HalfBathsCount, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
    put(facts, 'fireplaces', inRange(row.FireplacesCount, 10));
    put(facts, 'garage_sqft', positive(row.GarageSize_SqFt));
  }
  if (kind === 'building') put(facts, 'units', inRange(row.DwellingUnitsCount, 2000) || inRange(row.UnitCount, 2000));
  // A condominium's parcel is its share of the complex, so a condo unit gets no lot.
  if (kind !== 'unit') {
    if (positive(row.Acres)) put(facts, 'lot_acres', positive(row.Acres));
    else put(facts, 'lot_sqft', positive(row.Prcl_Size_SqFt));
  }
  // California's assessed values (Proposition 13), land and improvements, before exemptions; their sum is the roll value.
  put(facts, 'assessed_land_value', positive(row.CurrentMarketLandValue));
  put(facts, 'assessed_building_value', positive(row.CurrentStructuralImprValue));
  put(facts, 'assessed_value', positive(row.TotalLandImprValue));
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: cityOf(row), zip: zipCode(row.Zip) }, facts };
}

async function* build({ work, today }) {
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  for await (const row of cached(path.join(work, 'ca-napa', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    if (String(row.asmt_status || '').trim().toUpperCase() !== 'ACTIVE') continue;
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'CA', name: COUNTY, publisher: 'Napa County', dataset: 'public parcels with Assessor characteristics', method: 'county', source: 'ca-napa', as_of: isoDate(today.getTime()), stale_after_days: 450, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YearBuilt', living_sqft: 'Building_Size_SqFt', bedrooms: 'BedroomsCount', bathrooms: 'FullBathsCount', full_baths: 'FullBathsCount', half_baths: 'HalfBathsCount', stories: 'BuildingFloorCount', fireplaces: 'FireplacesCount', garage_sqft: 'GarageSize_SqFt', units: 'DwellingUnitsCount', lot_acres: 'Acres', lot_sqft: 'Prcl_Size_SqFt', assessed_land_value: 'CurrentMarketLandValue', assessed_building_value: 'CurrentStructuralImprValue', assessed_value: 'TotalLandImprValue' },
  },
};
