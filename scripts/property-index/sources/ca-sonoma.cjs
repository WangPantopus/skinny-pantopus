'use strict';
// Sonoma County, California: the county's Parcels Public layer, updated monthly. Its license lets anyone share it "for any purpose, even commercially"
// with credit to "County of Sonoma" and a note of changes: the record's footer names the county, and the dataset line says it was reformatted. Year
// built, living area, bedrooms, baths, rooms, stories, fireplaces, pool, lot, Proposition 13 assessed values (never market values) and last sale. The
// homeowner's exemption and other exemption columns are never asked for.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { streetParts, year, isoDate, realUnit, onRecord } = require('../lib/addresses.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '06097';
const COUNTY = 'Sonoma County';
const LAYER = 'https://socogis.sonomacounty.ca.gov/map/rest/services/CRAPublic/ParcelsPublic/FeatureServer/0';
const COLUMNS = ['OBJECTID', 'APN', 'UseCode', 'UseCodeDescription', 'LandSizeAcres', 'LandSizeSqft', 'HasPool', 'SitusStreetNo', 'SitusDirection', 'SitusStreetName', 'SitusStreetType', 'SitusUnitNumber', 'SitusCity', 'Value601RollYear', 'Value601Land', 'Value601Structure', 'BuildingPrimarySize', 'BuildingPrimaryStories', 'BuildingPrimaryYearBuilt', 'BuildingPrimaryEffectiveYear', 'BuildingPrimaryTotalRooms', 'BuildingPrimaryBedRooms', 'BuildingPrimaryBaths', 'BuildingPrimaryHalfBaths', 'BuildingPrimaryFirePlaces', 'SaleRecordingDate', 'SaleSalesPrice'];

// What stands on a parcel, from the Assessor's use words (a parcel's words name it whole: "SFD W/GRANNY UNIT" is a house with a second unit).
function useOf(words, unit) {
  const w = String(words || '').toUpperCase();
  if (/VACANT|COMMON AREA|RAW SUBDIVISION|WILDCAT|RIGHT-OF-WAY|PRIVATE ROAD|^PASTURE$|TIMBER|^HARDWOODS AND CHAPARRAL$/.test(w)) return ['parcel', null];
  if (/MANUFACTURED HOM|MOBILE HOME/.test(w) && !/PARK/.test(w)) return ['property', 'mobile_home'];
  if (/^CONDOMINIUM UNIT/.test(w)) return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (/^ATTACHED UNIT|^DUET/.test(w)) return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (/DUPLEX|TRIPLEX|FOURPLEX|2 OR MORE RES|TWO SFD|[34] UNITS/.test(w)) return ['building', 'multi_unit'];
  if (/RES UNITS|APARTMENT/.test(w)) return ['building', 'apartment'];
  if (/SINGLE FAMILY|SINGLE RES|SFD|DETACHED UNIT|W\/RES|WITH RESIDENCE|RESTRICTED DWE|W\/ ?RESID/.test(w)) return unit ? ['unit', 'condo'] : ['property', 'house'];
  return ['other', null];
}

function fromRow(row) {
  const unit = realUnit(String(row.SitusUnitNumber || '').replace(/^#\s*/, ''));
  const address = streetParts({ number: row.SitusStreetNo, pre: row.SitusDirection, name: word(row.SitusStreetName), suffix: word(row.SitusStreetType), unit });
  const parcel = word(row.APN);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.UseCodeDescription, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([row.SitusStreetNo, row.SitusDirection, row.SitusStreetName, row.SitusStreetType].map(word).filter(Boolean).join(' '), unit));
  put(facts, 'land_use', word(row.UseCodeDescription));
  put(facts, 'county_use_code', word(row.UseCode));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.BuildingPrimaryYearBuilt));
    put(facts, 'effective_year_built', year(row.BuildingPrimaryEffectiveYear));
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.BuildingPrimarySize));
    const beds = positive(row.BuildingPrimaryBedRooms);
    if (beds && beds <= 15) facts.bedrooms = beds;
    const [full, half] = [positive(row.BuildingPrimaryBaths), positive(row.BuildingPrimaryHalfBaths)];
    if (full && full <= 12) {
      facts.full_baths = Math.floor(full);
      facts.bathrooms = Math.floor(full) + (half && half <= 6 ? half * 0.5 : 0);
      put(facts, 'half_baths', half && half <= 6 ? half : null);
    }
    put(facts, 'rooms', positive(row.BuildingPrimaryTotalRooms) && positive(row.BuildingPrimaryTotalRooms) <= 40 ? positive(row.BuildingPrimaryTotalRooms) : null);
    put(facts, 'fireplaces', positive(row.BuildingPrimaryFirePlaces) && positive(row.BuildingPrimaryFirePlaces) <= 30 ? positive(row.BuildingPrimaryFirePlaces) : null);
    // A few rows hold codes, not counts (1030): a house's stories are 1 to 10.
    if (kind === 'property' && positive(row.BuildingPrimaryStories) <= 10) put(facts, 'stories', positive(row.BuildingPrimaryStories));
    if (/^(Y|YES|1|TRUE)$/i.test(String(row.HasPool ?? '').trim())) facts.pool = 'Yes';
  }
  if (kind === 'building') put(facts, 'gross_sqft', positive(row.BuildingPrimarySize));
  if (kind !== 'unit') {
    if (positive(row.LandSizeSqft)) put(facts, 'lot_sqft', positive(row.LandSizeSqft));
    else put(facts, 'lot_acres', positive(row.LandSizeAcres));
  }
  put(facts, 'value_year', positive(row.Value601RollYear));
  const [land, building] = [positive(row.Value601Land), positive(row.Value601Structure)];
  put(facts, 'assessed_land_value', land);
  put(facts, 'assessed_building_value', building);
  put(facts, 'assessed_value', (land || 0) + (building || 0) || null);
  if (positive(row.SaleSalesPrice) > 100) {
    put(facts, 'sale_price', positive(row.SaleSalesPrice));
    put(facts, 'sale_date', isoDate(row.SaleRecordingDate));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.SitusCity) || '').toUpperCase(), zip: null }, facts };
}

async function* build({ work, today }) {
  const records = new Map();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'ca-sonoma', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (!records.has(record.id)) records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'CA', name: COUNTY, publisher: 'County of Sonoma, Clerk-Recorder-Assessor', dataset: 'Parcels Public, reformatted', method: 'county', source: 'ca-sonoma', as_of: isoDate(today.getTime()), stale_after_days: 450, extra_zips: zipsByCounty(work, ['06']).get(FIPS) || [], records: list,
  };
}

// The parcel layer's own shapes, by the parcel number each record carries (the same columns): what lib/measure.cjs
// measures a lot's area and counts its buildings on (measured rows, held off until the county's measured_rows switch is on).
const parcelShapes = { url: LAYER, fields: ['APN'], key: (row) => word(row.APN) };

module.exports = {
  parcelShapes,
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'BuildingPrimaryYearBuilt', effective_year_built: 'BuildingPrimaryEffectiveYear', living_sqft: 'BuildingPrimarySize', gross_sqft: 'BuildingPrimarySize', bedrooms: 'BuildingPrimaryBedRooms', bathrooms: 'BuildingPrimaryBaths', full_baths: 'BuildingPrimaryBaths', half_baths: 'BuildingPrimaryHalfBaths', rooms: 'BuildingPrimaryTotalRooms', fireplaces: 'BuildingPrimaryFirePlaces', stories: 'BuildingPrimaryStories', lot_sqft: 'LandSizeSqft', lot_acres: 'LandSizeAcres', assessed_land_value: 'Value601Land', assessed_building_value: 'Value601Structure', assessed_value: 'Value601Land', sale_price: 'SaleSalesPrice', sale_date: 'SaleRecordingDate', value_year: 'Value601RollYear' },
  },
};
