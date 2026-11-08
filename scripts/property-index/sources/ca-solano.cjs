'use strict';
// Solano County, California: the county's public parcel layer with each parcel's Assessor characteristics, on its own ArcGIS Online, updated
// monthly and maintained under the county's guidance. Its disclaimer says the user takes the data as is, that the county makes no warranty of any
// kind and disclaims liability, and that the data isn't survey grade; it states no license and no limit on use. Year built, living area,
// bedrooms, baths, rooms, stories, acres and assessed land and improvement values. The layer holds no owner names; the homeowner exemption
// column is never asked for. Parcels carry no site ZIP, so the county's ZIPs come from the Census.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '06095';
const COUNTY = 'Solano County';
const LAYER = 'https://services2.arcgis.com/SCn6czzcqKAFwdGU/arcgis/rest/services/Parcels_Public_Aumentum/FeatureServer/0';
const COLUMNS = ['parcelid', 'rollyear', 'acres', 'lotsize', 'usecode', 'use_desc', 'subdiv', 'yrbuilt', 'valland', 'valimp', 'p_address', 'sitecity', 'unitbldg', 'garage', 'total_area', 'stories', 'bedroom', 'bathroom', 'rooms', 'fireplc', 'zone1'];

// The Assessor's use codes: 1000, 1011 and 1012 a one-family residence (standard, custom, rural over an acre), 1014 a duet (one half of a pair on
// its own parcel), 1500 a condominium or planned unit, 2100 several homes on one parcel. Codes 1191 and 1192 name a base-year transfer on a
// residence, so a home there is read from its building facts.
function useOf(code, description, unit, row) {
  const c = String(code || '').trim();
  if (c === '1000' || c === '1011' || c === '1012') return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (c === '1014') return ['property', 'townhouse'];
  if ((c === '1191' || c === '1192') && positive(row.bedroom) && positive(row.total_area)) return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (c === '1500') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (c === '2100') return ['building', 'multi_unit'];
  if (/^VACANT RESIDENTIAL/i.test(String(description || '').trim())) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

// The site line names the street with its type ("123 MAIN STREET"); a unit or suite on its own column is added when the line lacks it.
function siteOf(row) {
  const line = String(row.p_address ?? '').replace(/\s+/g, ' ').trim();
  const unit = word(row.unitbldg) || '';
  const parsed = parse(unit && !line.toUpperCase().includes(unit.toUpperCase()) ? `${line} ${unit}` : line);
  if (!parsed || parsed.form !== 'street' || !parsed.number) return null;
  const { form, ...street } = parsed;
  return street;
}

function fromRow(row) {
  const address = siteOf(row);
  const parcel = word(row.parcelid);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.usecode, row.use_desc, address.unit, row);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(row.p_address, word(row.unitbldg) || ''));
  put(facts, 'county_use_code', word(row.usecode));
  put(facts, 'land_use', word(row.use_desc));
  put(facts, 'subdivision', word(row.subdiv));
  put(facts, 'zoning', word(row.zone1));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.yrbuilt));
    put(facts, 'stories', inRange(row.stories, 5));
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.total_area));
    put(facts, 'bedrooms', inRange(row.bedroom, 15));
    put(facts, 'bathrooms', inRange(row.bathroom, 12));
    put(facts, 'rooms', inRange(row.rooms, 40));
    put(facts, 'fireplaces', inRange(row.fireplc, 10));
    put(facts, 'garage_sqft', positive(row.garage));
  }
  if (kind !== 'unit') {
    if (positive(row.lotsize)) put(facts, 'lot_sqft', positive(row.lotsize));
    else put(facts, 'lot_acres', positive(row.acres));
  }
  // California's assessed values (Proposition 13), land and improvements; their sum is the assessed total.
  const [land, building] = [positive(row.valland), positive(row.valimp)];
  put(facts, 'assessed_land_value', land);
  put(facts, 'assessed_building_value', building);
  put(facts, 'assessed_value', (land || 0) + (building || 0) || null);
  put(facts, 'value_year', positive(row.rollyear));
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: word(row.sitecity) || '', zip: null }, facts };
}

async function* build({ work, today }) {
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  for await (const row of cached(path.join(work, 'ca-solano', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS, { oid: 'objectid' }))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'CA', name: COUNTY, publisher: 'Solano County', dataset: 'public parcels with Assessor characteristics', method: 'county', source: 'ca-solano', as_of: isoDate(today.getTime()), stale_after_days: 450, extra_zips: zipsByCounty(work, ['06']).get(FIPS) || [], records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'yrbuilt', living_sqft: 'total_area', bedrooms: 'bedroom', bathrooms: 'bathroom', rooms: 'rooms', stories: 'stories', fireplaces: 'fireplc', garage_sqft: 'garage', lot_sqft: 'lotsize', lot_acres: 'acres', assessed_land_value: 'valland', assessed_building_value: 'valimp', value_year: 'rollyear' },
  },
};
