'use strict';
// Roanoke County, Virginia: the county's "Parcels Open Data" layer on its own ArcGIS Online, which joins each address to the parcel's assessing and
// tax records from its CAMA and tax systems. The item states no license (the county's other parcel items in the same account are CC BY); the
// county's layer notice says the data is provided "as is", disclaims warranties and damages and is for information purposes only, and states no
// limit on use. Year built, finished area, bedrooms, full and half baths, style, walls, roof, heat, cooling, foundation, acres, the market value
// (Virginia assesses at full market value) and the last qualified sale. Owner, mailing and protected-owner columns are never asked for.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { streetParts, year, isoDate, zipCode, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { hold } = require('../lib/held.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '51161';
const COUNTY = 'Roanoke County';
const LAYER = 'https://services1.arcgis.com/VlZ73DcE2ya6FnSK/arcgis/rest/services/Parcels_Hosted/FeatureServer/0';
const COLUMNS = ['ParcelID', 'Address_Number', 'Prefix_Directional', 'Street_Name', 'Street_Suffix', 'Post_Directional', 'Unit_Number', 'Unit_Type', 'Zip_City', 'Zip_Code', 'Calc_Acreage', 'Subdivision', 'LegalDescription', 'Neighborhood', 'SaleDateYMD1', 'SalePrice1', 'SaleValidityDescription1', 'SumAllCardsBuildingOnlyValue', 'SumAllCardsTotalMarketValue', 'TaxYearForValue', 'MaxOfCardNumber', 'BuildingTypeDescription', 'YearBuilt', 'TotalFinSqFt', 'StyleDescr', 'TotalBedrooms', 'TotalFullBaths', 'TotalHalfBaths', 'AirConditionTypeDesc', 'FoundationTypeDescr', 'RoofCoverDescr', 'ExteriorWallDescrPrimary', 'HeatTypeDescr', 'HeatFuelDescr', 'FirePlaceDescr'];

// The building type of the parcel's card. A patio home is a small single-family house; a townhouse apartment is a rental building.
function useOf(type, unit, row) {
  const t = String(type || '').replace(/\s+/g, ' ').trim().toUpperCase();
  if (/^(SINGLE FAMILY RESIDENCE|SINGLE FAMILY SMALL|RURAL HOMESITE|RURAL HOMESITE \/ SMALL|PATIO HOME)$/.test(t)) return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (t === 'TOWNHOUSE') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (t === 'CONDOMINIUM') return unit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (t === 'MANUFACTURED HOME') return ['property', 'mobile_home'];
  if (t === 'DUPLEX' || t === 'TRIPLEX' || t === 'QUADRAPLEX' || t === 'FOURPLEX') return ['building', 'multi_unit'];
  if (/APARTMENT/.test(t)) return ['building', 'apartment'];
  if (!t) return positive(row.TotalBedrooms) && positive(row.TotalFinSqFt) ? [unit ? 'unit' : 'property', null] : ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function fromRow(row) {
  const number = String(row.Address_Number ?? '').trim();
  const unit = word(row.Unit_Number) || '';
  const address = /^\d+[A-Z]?$/i.test(number) ? streetParts({ number, pre: word(row.Prefix_Directional) || '', name: word(row.Street_Name) || '', suffix: word(row.Street_Suffix) || '', post: word(row.Post_Directional) || '', unit }) : null;
  const parcel = word(row.ParcelID);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.BuildingTypeDescription, address.unit, row);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord([number, row.Prefix_Directional, row.Street_Name, row.Street_Suffix, row.Post_Directional].map(word).filter(Boolean).join(' '), [word(row.Unit_Type), unit].filter(Boolean).join(' ')));
  put(facts, 'building_type', word(row.BuildingTypeDescription));
  put(facts, 'subdivision', word(row.Subdivision));
  put(facts, 'neighborhood', word(row.Neighborhood));
  put(facts, 'legal_description', word(row.LegalDescription)?.slice(0, 300));
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.YearBuilt));
    put(facts, 'style', word(row.StyleDescr));
    put(facts, 'exterior_walls', word(row.ExteriorWallDescrPrimary));
    put(facts, 'roof_cover', word(row.RoofCoverDescr));
    put(facts, 'foundation', word(row.FoundationTypeDescr));
    if (positive(row.MaxOfCardNumber) > 1) facts.buildings_on_parcel = positive(row.MaxOfCardNumber);
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.TotalFinSqFt));
    put(facts, 'bedrooms', inRange(row.TotalBedrooms, 15));
    const [full, half] = [inRange(row.TotalFullBaths, 12), inRange(row.TotalHalfBaths, 6)];
    if (full) {
      facts.full_baths = full;
      facts.bathrooms = full + (half ? half * 0.5 : 0);
      put(facts, 'half_baths', half);
    }
    put(facts, 'heating', word(row.HeatTypeDescr));
    put(facts, 'heating_fuel', word(row.HeatFuelDescr));
    put(facts, 'cooling', word(row.AirConditionTypeDesc));
  }
  // A condominium's parcel is its share of the complex, so a condominium home gets no lot.
  if (kind !== 'unit' && String(row.BuildingTypeDescription || '').trim().toUpperCase() !== 'CONDOMINIUM') put(facts, 'lot_acres', positive(row.Calc_Acreage));
  put(facts, 'market_value', positive(row.SumAllCardsTotalMarketValue));
  put(facts, 'market_building_value', positive(row.SumAllCardsBuildingOnlyValue));
  put(facts, 'value_year', positive(row.TaxYearForValue));
  // The Assessor marks each sale's validity; only a "QUALIFIED" sale (an arm's-length transfer) is kept.
  if (/^QUALIFIED$/i.test(String(row.SaleValidityDescription1 || '').trim()) && isHomeSale(positive(row.SalePrice1))) {
    put(facts, 'sale_price', positive(row.SalePrice1));
    put(facts, 'sale_date', isoDate(row.SaleDateYMD1));
  }
  const record = { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(row.Zip_City ?? '').replace(/\s+/g, ' ').trim().toUpperCase(), zip: zipCode(row.Zip_Code) }, facts };
  // Read since the county went live, held off its screens until its new_columns switch is on (lib/held.cjs): the
  // county writes a home's fireplaces in words, "1 FIREPLACE", "2 FIREPLACES".
  const fireplaces = /^(\d+) FIREPLACES?$/.exec(String(row.FirePlaceDescr ?? '').replace(/\s+/g, ' ').trim().toUpperCase());
  if (home && fireplaces && Number(fireplaces[1]) <= 10) hold(record, 'fireplaces', Number(fireplaces[1]));
  return record;
}

async function* build({ work, today }) {
  // One row per address: a parcel with two addresses (a duplex, a corner) is one record at each.
  const records = new Map();
  let noAddress = 0;
  let repeated = 0;
  for await (const row of cached(path.join(work, 'va-roanoke', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    const record = fromRow(row);
    if (!record) {
      noAddress += 1;
      continue;
    }
    const key = `${record.id}|${record.address.number}|${record.address.name}|${record.address.unit}`;
    if (records.has(key)) repeated += 1;
    else records.set(key, record);
  }
  const list = [...records.values()];
  log(`${COUNTY}: ${list.length} addressed records, ${noAddress} rows without a street number, ${repeated} repeated`);
  for (const building of condoBuildings(list, { fips: FIPS, county: COUNTY })) list.push(building);
  yield {
    fips: FIPS, state: 'VA', name: COUNTY, publisher: 'Roanoke County', dataset: 'parcels open data with assessing records (GIS Services)', method: 'county', source: 'va-roanoke', as_of: isoDate(today.getTime()), stale_after_days: 450, records: list,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { year_built: 'YearBuilt', living_sqft: 'TotalFinSqFt', bedrooms: 'TotalBedrooms', bathrooms: 'TotalFullBaths', full_baths: 'TotalFullBaths', half_baths: 'TotalHalfBaths', lot_acres: 'Calc_Acreage', market_value: 'SumAllCardsTotalMarketValue', market_building_value: 'SumAllCardsBuildingOnlyValue', value_year: 'TaxYearForValue', sale_price: 'SalePrice1', sale_date: 'SaleDateYMD1' },
  },
};
