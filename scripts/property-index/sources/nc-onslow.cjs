'use strict';
// Onslow County, North Carolina: the county's parcels with each parcel's tax record, on the county's own GIS server, kept continuously by the
// county. Its notice says the county's GIS office isn't liable for errors, the data isn't a legal document, and its sources should be consulted to
// verify it; it states no limit on use and asks for none of the no-resale agreement G.S. 132-10 lets a county require. Year built, heated area,
// bedrooms, baths, rooms, stories, walls, heating, acres, 2026 market and taxable values, and last qualified sale. The owner and mailing columns
// are never asked for.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { layerRows, cached } = require('../lib/services.cjs');
const { year, isoDate, monthDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '37133';
const COUNTY = 'Onslow County';
const LAYER = 'https://gismaps.onslowcountync.gov/server/rest/services/WEB_PUBLICATIONS/County_Map_Layers/MapServer/0';
// The object ID is asked for once, by the reader: this server drops it from a page when it's named twice, and paging stops.
const COLUMNS = ['PARID', 'PIN', 'VALUEYEAR', 'NBHD', 'PHYSICALADDRESS', 'PHYSICALCITY', 'PHYSICALZIP', 'UNIT', 'ACRES', 'SALEDATE', 'SALECODE', 'SALEPRICE', 'SUBDIVISION', 'PROPERTYTYPE', 'FINALFULLLANDVALUE', 'FINALFULLBUILDINGVALUE', 'TAXMARKETVALUE', 'TOTALTAXABLEVALUE', 'LANDUSECODE', 'YEARBUILT', 'EFFECTIVEYEAR', 'NUMBEROFROOMS', 'NUMBEROFBEDROOMS', 'NUMBEROFFULLBATHS', 'NUMBEROFHALFBATHS', 'HEATING', 'HEATINGFUELTYPE', 'STORYHEIGHT', 'HEATEDSQUAREFEET', 'STRUCTURESTYLE', 'STRUCTURETYPE', 'TOTALCARDS', 'LEGAL1', 'ZONING'];

// The dwelling's structure style, in the county's words. A parcel with none is land (residential or vacant) or a business.
function useOf(style, propertyType, unit) {
  const s = String(style || '').trim().toUpperCase();
  if (s === 'SINGLE FAMILY' || s === 'BEACH HOUSE') return ['property', 'house'];
  if (s === 'MULTI-SECTION MH' || s === 'SINGLE WIDE MH') return ['property', 'mobile_home'];
  if (s === 'TOWNHOME' || s === 'BEACH TOWNHOME' || s === 'BEACH CONDO' || s === 'CONDOMINIMUM') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (s === 'DUPLEX' || s === 'BEACH DUPLEX' || s === 'MULTI-FAMILY') return ['building', 'multi_unit'];
  if (s === 'APARTMENT') return ['building', 'apartment'];
  if (!s && /^[RV]$/.test(String(propertyType || '').trim())) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};
const text = (value) => (/^none$/i.test(String(value ?? '').trim()) ? null : word(value));

function fromRow(row) {
  const parsed = parse(String(row.PHYSICALADDRESS ?? ''));
  const parcel = word(row.PARID);
  if (!parsed || parsed.form !== 'street' || !parsed.number || !parcel) return null;
  const unit = word(row.UNIT) || '';
  const { form, ...street } = parsed;
  const address = { ...street, unit, city: word(row.PHYSICALCITY) || '', zip: zipCode(row.PHYSICALZIP) };
  const [kind, homeType] = useOf(row.STRUCTURESTYLE, row.PROPERTYTYPE, unit);
  const facts = { parcel_number: word(row.PIN) || parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(row.PHYSICALADDRESS, unit));
  put(facts, 'county_use_code', word(row.LANDUSECODE));
  put(facts, 'neighborhood', word(row.NBHD));
  put(facts, 'subdivision', word(row.SUBDIVISION));
  put(facts, 'zoning', word(row.ZONING));
  put(facts, 'legal_description', word(row.LEGAL1)?.slice(0, 300));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.YEARBUILT));
    put(facts, 'effective_year_built', year(row.EFFECTIVEYEAR));
    put(facts, 'stories', inRange(row.STORYHEIGHT, 5));
    put(facts, 'exterior_walls', text(row.STRUCTURETYPE));
    if (positive(row.TOTALCARDS) > 1) facts.buildings_on_parcel = positive(row.TOTALCARDS);
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.HEATEDSQUAREFEET));
    put(facts, 'bedrooms', inRange(row.NUMBEROFBEDROOMS, 15));
    const [full, half] = [inRange(row.NUMBEROFFULLBATHS, 12), inRange(row.NUMBEROFHALFBATHS, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
    put(facts, 'rooms', inRange(row.NUMBEROFROOMS, 40));
    put(facts, 'heating', text(row.HEATING));
    put(facts, 'heating_fuel', text(row.HEATINGFUELTYPE));
  }
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.ACRES));
  put(facts, 'market_value', positive(row.TAXMARKETVALUE));
  put(facts, 'market_land_value', positive(row.FINALFULLLANDVALUE));
  put(facts, 'market_building_value', positive(row.FINALFULLBUILDINGVALUE));
  put(facts, 'taxable_value', positive(row.TOTALTAXABLEVALUE));
  put(facts, 'value_year', positive(row.VALUEYEAR));
  // Only sales the county codes as qualified ("00-Qualified Sale") carry a price worth showing.
  if (/^00\b/.test(String(row.SALECODE || '').trim()) && isHomeSale(positive(row.SALEPRICE))) {
    put(facts, 'sale_price', positive(row.SALEPRICE));
    put(facts, 'sale_date', monthDate(row.SALEDATE));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address, facts };
}

async function* build({ work, today }) {
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  for await (const row of cached(path.join(work, 'nc-onslow', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS, { pageSize: 1000 }))) {
    const record = fromRow(row);
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'NC', name: COUNTY, publisher: 'Onslow County', dataset: 'parcels with tax records', method: 'county', source: 'nc-onslow', as_of: isoDate(today.getTime()), stale_after_days: 450, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YEARBUILT', effective_year_built: 'EFFECTIVEYEAR', living_sqft: 'HEATEDSQUAREFEET', bedrooms: 'NUMBEROFBEDROOMS', bathrooms: 'NUMBEROFFULLBATHS', full_baths: 'NUMBEROFFULLBATHS', half_baths: 'NUMBEROFHALFBATHS', rooms: 'NUMBEROFROOMS', stories: 'STORYHEIGHT', lot_acres: 'ACRES', market_value: 'TAXMARKETVALUE', market_land_value: 'FINALFULLLANDVALUE', market_building_value: 'FINALFULLBUILDINGVALUE', taxable_value: 'TOTALTAXABLEVALUE', sale_price: 'SALEPRICE', sale_date: 'SALEDATE' },
  },
};
