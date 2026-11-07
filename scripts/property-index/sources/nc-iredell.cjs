'use strict';
// Iredell County, North Carolina: the county's tax parcels with each parcel's appraisal facts, one row per parcel, on the county's own GIS server.
// The county's map use notice says the maps come from recorded deeds, plats and other public records, should be verified, and are used at the
// user's own risk; it states no limit on use and asks for none of the no-resale agreement G.S. 132-10 lets a county require. Year built, heated
// area, bedrooms, baths, style, walls, roof, heating, cooling, acres, values and last qualified sale. The owner and mailing columns are never asked
// for. Parcels carry no site ZIP, so the county's ZIPs come from the Census. A lot with no acreage on file takes its parcel's own area.

const path = require('node:path');
const { layerRows, layerAreas, cached } = require('../lib/services.cjs');
const { streetParts, year, isoDate, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { zipsByCounty } = require('../lib/zcta.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '37097';
const COUNTY = 'Iredell County';
const LAYER = 'https://maps.iredellcountync.gov/server/rest/services/Data/TaxSQL_Parcels/FeatureServer/0';
const COLUMNS = ['OBJECTID', 'PIN', 'TaxAcres', 'SD_Name', 'NBHCode', 'Bldg_Value', 'Land_Value', 'Total_Value', 'Sale_Date', 'Sales_Price', 'QualifiedCode', 'Land_Use_Code', 'Building_Use', 'Building_Model', 'AYB', 'EYB', 'Bedroom', 'Bath', 'Half_Bath', 'Actual_Heated_Area', 'Ext_Wall_1', 'Roof_Cover', 'Heating_Type', 'Heating_Fuel', 'Air_Conditioning', 'Zoning', 'Dwelling_Style', 'FOUNDATION', 'HouseNumber', 'SDIR', 'STREET', 'STYPE', 'ST_SUFFIX', 'CityLocationDescription', 'Description'];

// The county publishes no table for its building codes, so kinds follow what the rows show. Building model 00 means the parcel has no building
// record (land, or a mobile home listed as personal property). Model 02 is a manufactured home (uses 02 and 03, multi- and single-section by
// size). Use 09 is a townhouse (each on its own lot of about 0.05 acres); use 04 is a condominium unit (no acreage, no unit number in the address).
// Uses 01, 05 and 08 on model 01 are one-family houses.
function useOf(row) {
  const use = String(row.Building_Use || '').trim();
  const model = String(row.Building_Model || '').trim();
  if (!model || model === '00') return ['parcel', null];
  if (model === '02' || use === '02' || use === '03') return ['property', 'mobile_home'];
  if (use === '09' || use === '04') return ['property', 'townhouse'];
  if (model === '01' && (use === '01' || use === '05' || use === '08')) return ['property', 'house'];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};
// Descriptive columns read like "10-Vinyl/Aluminum Siding": the county's code, then its words. "None" says nothing.
const words = (value) => {
  const text = String(value ?? '').replace(/^\s*\d+\s*-\s*/, '').trim();
  return text && !/^none$/i.test(text) ? text : null;
};

function fromRow(row) {
  const address = streetParts({ number: row.HouseNumber, pre: word(row.SDIR) || '', name: word(row.STREET) || '', suffix: word(row.STYPE) || '', post: word(row.ST_SUFFIX) || '' });
  const parcel = word(row.PIN);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property';
  put(facts, 'address_on_record', onRecord([row.HouseNumber, row.SDIR, row.STREET, row.STYPE, row.ST_SUFFIX].map(word).filter(Boolean).join(' ')));
  put(facts, 'county_use_code', word(row.Land_Use_Code));
  put(facts, 'neighborhood', word(row.NBHCode));
  put(facts, 'subdivision', word(row.SD_Name));
  put(facts, 'zoning', word(row.Zoning));
  put(facts, 'municipality', /^[A-Z]/i.test(String(row.CityLocationDescription ?? '')) ? word(row.CityLocationDescription) : null);
  put(facts, 'legal_description', word(row.Description)?.slice(0, 300));
  if (home || kind === 'other') {
    put(facts, 'year_built', year(row.AYB));
    put(facts, 'effective_year_built', year(row.EYB));
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.Actual_Heated_Area));
    put(facts, 'bedrooms', inRange(row.Bedroom, 15));
    const [full, half] = [inRange(row.Bath, 12), inRange(row.Half_Bath, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
    put(facts, 'style', words(row.Dwelling_Style));
    put(facts, 'exterior_walls', words(row.Ext_Wall_1));
    put(facts, 'roof_cover', words(row.Roof_Cover));
    put(facts, 'heating', words(row.Heating_Type));
    put(facts, 'heating_fuel', words(row.Heating_Fuel));
    put(facts, 'cooling', words(row.Air_Conditioning));
    put(facts, 'foundation', words(row.FOUNDATION));
  }
  // A condominium unit's acreage is blank and its shape is its building's, so it gets no lot; other parcels with no acreage take their shape's area.
  if (positive(row.TaxAcres)) put(facts, 'lot_acres', positive(row.TaxAcres));
  else if (String(row.Building_Use || '').trim() !== '04') put(facts, 'lot_sqft', positive(row.area) >= 100 ? positive(row.area) : null);
  put(facts, 'assessed_value', positive(row.Total_Value));
  put(facts, 'assessed_land_value', positive(row.Land_Value));
  put(facts, 'assessed_building_value', positive(row.Bldg_Value));
  // Only sales the county marks qualified (an arm's-length transfer) carry a price worth showing.
  if (String(row.QualifiedCode || '').trim() === 'Q' && isHomeSale(positive(row.Sales_Price))) {
    put(facts, 'sale_price', positive(row.Sales_Price));
    put(facts, 'sale_date', isoDate(row.Sale_Date));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: '', zip: null }, facts };
}

async function* build({ work, today }) {
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  // Areas in North Carolina State Plane (US feet).
  const areas = new Map();
  for await (const row of cached(path.join(work, 'nc-iredell', 'areas.jsonl.gz'), () => layerAreas(LAYER, '2264'))) areas.set(row.OBJECTID, row.area);
  for await (const row of cached(path.join(work, 'nc-iredell', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    const record = fromRow({ ...row, area: areas.get(row.OBJECTID) });
    if (!record) noAddress += 1;
    else if (records.has(record.id)) repeated += 1;
    else records.set(record.id, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} parcels, ${noAddress} without a street number, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'NC', name: COUNTY, publisher: 'Iredell County', dataset: 'tax parcels', method: 'county', source: 'nc-iredell', as_of: isoDate(today.getTime()), stale_after_days: 450, extra_zips: zipsByCounty(work, ['37']).get(FIPS) || [], records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'AYB', effective_year_built: 'EYB', living_sqft: 'Actual_Heated_Area', bedrooms: 'Bedroom', bathrooms: 'Bath', full_baths: 'Bath', half_baths: 'Half_Bath', lot_acres: 'TaxAcres', assessed_value: 'Total_Value', assessed_land_value: 'Land_Value', assessed_building_value: 'Bldg_Value', sale_price: 'Sales_Price', sale_date: 'Sale_Date' },
  },
};
