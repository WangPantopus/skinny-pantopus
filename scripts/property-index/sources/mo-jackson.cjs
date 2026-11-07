'use strict';
// Jackson County, Missouri: the county's own parcel viewer table, from its Ascend assessment system. No terms are stated on the service.
// It has mortgage-company columns: never asked for. Missouri assesses homes at 19% of market, so the county's market value is the market
// fact and the assessed value is its own. The table is a tax year behind. Sale prices aren't public in Missouri.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { offsetRows, cached } = require('../lib/services.cjs');
const { year, isoDate, zipCode } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { lotNumber } = require('../lib/legal.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '29095';
const COUNTY = 'Jackson County';
const TABLE = 'https://jcgis.jacksongov.org/arcgis/rest/services/ParcelViewer/ParcelsAscendRelate/MapServer/2';
const COLUMNS = ['parcel_number', 'situs_address', 'situs_city', 'situs_zip', 'tcacode', 'total_sqft', 'landuse_cd', 'landuse_cd_descr', 'nbhd_name', 'year_built', 'num_stories', 'num_bedrooms', 'num_families', 'full_baths', 'half_baths', 'tot_sqf_l_area', 'eff_yr_built_csect', 'tax_year', 'Assessed_Value_Total', 'Market_Value_Total', 'Taxable_Value_Total', 'subdiv_name', 'Legal_Lines'];

function useOf(words) {
  const use = String(words || '').toUpperCase();
  if (use === 'SF RESIDENCE' || use === 'AG HOMESITE') return ['property', 'house'];
  if (use === 'SF CONDO') return ['unit', 'condo'];
  if (use === 'SF TOWNHOUSE') return ['property', 'townhouse'];
  if (use === 'DUPLEX' || use === 'TRIPLEX' || use === 'FOURPLEX' || use === 'CONV. HOUSE TO MF') return ['building', 'multi_unit'];
  if (/APTS?\b|APARTMENT|MULTI-FAM/.test(use)) return ['building', 'apartment'];
  if (/^VACANT |^RES VACANT/.test(use)) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function fromRow(row) {
  const line = word(row.situs_address);
  const address = line ? parse(line) : null;
  const parcel = word(row.parcel_number);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.landuse_cd_descr);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', line);
  put(facts, 'land_use', word(row.landuse_cd_descr));
  put(facts, 'county_use_code', word(row.landuse_cd));
  put(facts, 'neighborhood', word(row.nbhd_name));
  put(facts, 'tax_code_area', word(row.tcacode));
  put(facts, 'subdivision', word(row.subdiv_name));
  put(facts, 'legal_description', word(row.Legal_Lines)?.slice(0, 300));
  put(facts, 'lot_number', lotNumber(row.Legal_Lines));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.year_built));
    put(facts, 'effective_year_built', year(row.eff_yr_built_csect));
    put(facts, 'stories', inRange(row.num_stories, kind === 'building' ? 40 : 6));
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.tot_sqf_l_area));
    put(facts, 'bedrooms', inRange(row.num_bedrooms, 15));
    const [full, half] = [inRange(row.full_baths, 15), inRange(row.half_baths, 10)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
  }
  if (kind === 'building') put(facts, 'units', positive(row.num_families));
  if (kind !== 'unit') put(facts, 'lot_sqft', positive(row.total_sqft));
  put(facts, 'value_year', positive(row.tax_year));
  put(facts, 'market_value', positive(row.Market_Value_Total));
  put(facts, 'assessed_value', positive(row.Assessed_Value_Total));
  put(facts, 'taxable_value', positive(row.Taxable_Value_Total));
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.situs_city) || '').toUpperCase(), zip: zipCode(row.situs_zip) }, facts };
}

async function* build({ work, today }) {
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'mo-jackson', 'parcels.jsonl.gz'), () => offsetRows(TABLE, COLUMNS, { orderBy: 'parcel_number', pageSize: 1000 }))) {
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
    fips: FIPS, state: 'MO', name: COUNTY, publisher: 'Jackson County Assessment', dataset: 'parcel viewer table', method: 'county', source: 'mo-jackson', as_of: isoDate(today.getTime()), stale_after_days: 700, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: TABLE,
    facts: { year_built: 'year_built', effective_year_built: 'eff_yr_built_csect', living_sqft: 'tot_sqf_l_area', bedrooms: 'num_bedrooms', full_baths: 'full_baths', half_baths: 'half_baths', stories: 'num_stories', units: 'num_families', lot_sqft: 'total_sqft', market_value: 'Market_Value_Total', assessed_value: 'Assessed_Value_Total', taxable_value: 'Taxable_Value_Total', value_year: 'tax_year' },
  },
};
