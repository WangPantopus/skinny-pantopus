'use strict';
// St. Charles County, Missouri: the county's open data tax information layer, which its own ArcGIS organization publishes. No terms stated. Year built,
// total area, bedrooms, baths, rooms, acres and market value. Missouri keeps sale prices out of public records, so the layer's sale columns are never
// asked for; owner and mailing columns aren't either.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { streetParts, year, isoDate, zipCode } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { hold } = require('../lib/held.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '29183';
const COUNTY = 'St. Charles County';
const LAYER = 'https://gis-dev.sccmo.org/scc_gis/rest/services/open_data/Tax_Information_o/FeatureServer/0';
const COLUMNS = ['OBJECTID', 'Parcel_ID', 'SitusNumber', 'SitusName', 'SitusZip', 'Municipality', 'PropType', 'OccCode', 'YearBuilt', 'TotalArea', 'Bedrooms', 'Bathrooms', 'HalfBathrooms', 'TotalRooms', 'Parcel_Acres', 'TotalMarketValue', 'Subdivision', 'GarageStalls'];

// The county's property types, and its occupancy codes: A for attached homes, D for detached.
function useOf(type, occupancy) {
  const t = String(type || '').toUpperCase();
  const attached = /^A\d/.test(String(occupancy || '').trim());
  if (/^SINGLE FAMILY/.test(t)) return ['property', attached ? 'townhouse' : 'house'];
  if (/^OTHER-RESIDENTIAL|^SINGLE UNIT APT/.test(t)) return ['property', attached ? 'townhouse' : 'house'];
  if (/^MOBILE HOME/.test(t)) return ['property', 'mobile_home'];
  if (/^DUPLEX|^TRIPLEX|^FOURPLEX/.test(t)) return ['building', 'multi_unit'];
  if (/APARTMENT|MULTI-FAMILY/.test(t)) return ['building', 'apartment'];
  if (/^VACANT/.test(t)) return ['parcel', null];
  return ['other', null];
}

function fromRow(row) {
  const address = streetParts({ number: row.SitusNumber, name: word(row.SitusName) });
  const parcel = word(row.Parcel_ID);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.PropType, row.OccCode);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property';
  put(facts, 'address_on_record', [row.SitusNumber, row.SitusName].map(word).filter(Boolean).join(' '));
  put(facts, 'land_use', word(String(row.PropType || '').replace(/\s*\([A-Z]+\)\s*$/, '')));
  put(facts, 'subdivision', word(row.Subdivision));
  if (home || kind === 'building') put(facts, 'year_built', year(row.YearBuilt));
  if (home) {
    put(facts, 'living_sqft', positive(row.TotalArea));
    const beds = positive(row.Bedrooms);
    if (beds && beds <= 15) facts.bedrooms = beds;
    const [full, half] = [positive(row.Bathrooms), positive(row.HalfBathrooms)];
    if (full && full <= 12) {
      facts.full_baths = full;
      facts.bathrooms = full + (half && half <= 6 ? half * 0.5 : 0);
      put(facts, 'half_baths', half && half <= 6 ? half : null);
    }
    put(facts, 'rooms', positive(row.TotalRooms) && positive(row.TotalRooms) <= 40 ? positive(row.TotalRooms) : null);
  }
  if (kind === 'building') put(facts, 'gross_sqft', positive(row.TotalArea));
  put(facts, 'lot_acres', positive(row.Parcel_Acres));
  put(facts, 'market_value', positive(row.TotalMarketValue));
  const record = { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.Municipality) || '').toUpperCase(), zip: zipCode(row.SitusZip) }, facts };
  // Read since the county went live, held off its screens until its new_columns switch is on (lib/held.cjs): the
  // Assessor's count of garage stalls, a home's parking spaces. A zero says nothing.
  const stalls = positive(row.GarageStalls);
  if (home && stalls && stalls <= 20 && Number.isInteger(stalls)) hold(record, 'parking_spaces', stalls);
  return record;
}

async function* build({ work, today }) {
  const records = new Map();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'mo-st-charles', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (!records.has(record.id)) records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'MO', name: COUNTY, publisher: 'St. Charles County Assessor', dataset: 'open data tax information', method: 'county', source: 'mo-st-charles', as_of: isoDate(today.getTime()), stale_after_days: 450, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YearBuilt', living_sqft: 'TotalArea', gross_sqft: 'TotalArea', bedrooms: 'Bedrooms', bathrooms: 'Bathrooms', full_baths: 'Bathrooms', half_baths: 'HalfBathrooms', rooms: 'TotalRooms', lot_acres: 'Parcel_Acres', market_value: 'TotalMarketValue' },
  },
};
