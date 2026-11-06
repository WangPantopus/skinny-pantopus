'use strict';
// County connectors' second publications, for property-state-check.js's --fields. Same shape as its CHECKS: `rows` reads
// the second publication, `id` is its parcel number, `map` is [our fact, its column, optional comparison]. A year-apart
// vintage is only fair for facts that rarely change. It proves the connector read, joined and scaled each column right.

const path = require('path');
const { download, zipTable, zipMembers } = require('../../../../scripts/property-index/lib/tables.cjs');
const { layerRows, ckanRows, socrataRows, cached } = require('../../../../scripts/property-index/lib/services.cjs');

const near = (tolerance) => (a, b) => Math.abs(Number(a) - Number(b)) <= tolerance;
const moneyNear = (a, b) => Math.abs(Number(a) - Number(b)) <= Math.max(1, Number(b) * 0.001);

// Assessor's land and improvement values come from the secured roll; the county's address layer publishes them too.
async function* sanBernardinoLayer() {
  const url = 'https://services.arcgis.com/aA3snZwJfFkVyDuP/arcgis/rest/services/Internal_SB_County_Parcels_ForPublicView/FeatureServer/0';
  const number = (text) => String(text ?? '').replace(/,/g, '');
  for await (const row of cached(path.join(process.env.PROPERTY_CHECK_WORK || '.', 'ca-san-bernardino', 'layer-values.jsonl.gz'), () => layerRows(url, ['APN', 'LAND_VALUE', 'IMPR_VALUE', 'ACREAGE'], { pageSize: 1000 }))) {
    yield { id: `${String(row.APN ?? '').padStart(9, '0')}0000`, land: number(row.LAND_VALUE), building: number(row.IMPR_VALUE), acres: row.ACREAGE, sqft: Number(row.ACREAGE) * 43560 };
  }
}

// The City of San Diego's own copy of the Assessor's weekly records. Baths are three digits with an implied decimal.
async function* sanDiegoCity() {
  const url = 'https://webmaps.sandiego.gov/arcgis/rest/services/Planning/PLN_LongRangePlanning/MapServer/1';
  for await (const row of layerRows(url, ['APN', 'TOTAL_LVG_AREA', 'BEDROOMS', 'BATHS', 'ASR_LAND', 'ASR_IMPR', 'UNITQTY'])) yield { ...row, baths: Number(row.BATHS) / 10 };
}

// Allegheny's own sale transactions: one row a sale, so the newest one per parcel.
async function* alleghenySales() {
  const newest = new Map();
  for await (const row of ckanRows('data.wprdc.org', '5bbe6c55-bce6-4edb-9d04-68edeb6bf7b1', ['PARID', 'SALEDATE', 'PRICE'])) {
    const was = newest.get(row.PARID);
    if (Number(row.PRICE) > 100 && (!was || String(row.SALEDATE) > String(was.SALEDATE))) newest.set(row.PARID, row);
  }
  yield* newest.values();
}

// The newest row per parcel of a table with one row a sale.
async function* newestSale(rows, parcel, when, price) {
  const newest = new Map();
  for await (const row of rows) {
    const was = newest.get(row[parcel]);
    if (Number(row[price]) > 100 && (!was || String(row[when]) > String(was[when]))) newest.set(row[parcel], row);
  }
  yield* newest.values();
}

// Florida's Department of Revenue roll for one county: the same homes from the state's own publication. Owner columns aren't read.
async function* floridaRoll(file) {
  const zip = path.join(process.env.PROPERTY_CHECK_WORK || '.', 'state-check', path.basename(file));
  download(`https://floridarevenue.com/property/dataportal/Documents/PTO%20Data%20Portal/Tax%20Roll%20Data%20Files/NAL/2026F/${encodeURIComponent(file)}`, zip);
  yield* zipTable(zip, zipMembers(zip)[0], ['PARCEL_ID', 'ACT_YR_BLT', 'TOT_LVG_AREA', 'LND_SQFOOT', 'JV']);
}
const floridaCheck = (county, file, extra = []) => ({
  county,
  rows: () => floridaRoll(file),
  id: (row) => String(row.PARCEL_ID ?? '').replace(/^'|'$/g, '').trim(),
  map: [['year_built', 'ACT_YR_BLT'], ['lot_sqft', 'LND_SQFOOT', (a, b) => Math.abs(a - b) <= Math.max(50, b * 0.05)], ...extra],
});

module.exports = {
  'fl-miami-dade': floridaCheck('12086', 'Dade 23 Final NAL 2026.zip', [['living_sqft', 'TOT_LVG_AREA', near(1)]]),
  'fl-broward': floridaCheck('12011', 'Broward 16 Final NAL 2026.zip', [['living_sqft', 'TOT_LVG_AREA', near(1)], ['market_value', 'JV', moneyNear]]),
  // The county's published 2023 sales: what rarely changes since.
  'co-adams': {
    county: '08001',
    rows: () => layerRows('https://services3.arcgis.com/4PNQOtAivErR7nbT/arcgis/rest/services/Reassessment_Sales/FeatureServer/0', ['PARCELNO', 'YEARBUILT', 'BATHCOUNT', 'RESSF', 'TOTSFBSMNT', 'LANDACRES']),
    id: (row) => row.PARCELNO,
    map: [['year_built', 'YEARBUILT'], ['bathrooms', 'BATHCOUNT'], ['living_sqft', 'RESSF', near(1)], ['basement_sqft', 'TOTSFBSMNT', near(1)], ['lot_acres', 'LANDACRES', near(0.01)]],
  },
  // One roll back: what rarely changes in a year.
  'ca-san-francisco': {
    county: '06075',
    rows: () => socrataRows('data.sf.gov', 'wv5m-vpq2', ['parcel_number', 'year_property_built', 'number_of_bedrooms', 'number_of_bathrooms', 'number_of_rooms', 'property_area', 'lot_area', 'number_of_units'], { where: "closed_roll_year='2024'" }),
    id: (row) => row.parcel_number,
    map: [['year_built', 'year_property_built'], ['bedrooms', 'number_of_bedrooms'], ['bathrooms', 'number_of_bathrooms'], ['rooms', 'number_of_rooms'], ['living_sqft', 'property_area', near(1)], ['lot_sqft', 'lot_area', near(1)], ['units', 'number_of_units']],
  },
  // Last year's rows of the same two tables: what rarely changes in a year.
  'il-cook-homes': {
    county: '17031',
    rows: () => socrataRows('datacatalog.cookcountyil.gov', 'x54s-btds', ['pin', 'card', 'char_yrblt', 'char_bldg_sf', 'char_land_sf', 'char_beds', 'char_fbath', 'char_hbath'], { where: 'year=2025 AND card=1' }),
    id: (row) => row.pin,
    map: [['year_built', 'char_yrblt'], ['living_sqft', 'char_bldg_sf', near(1)], ['lot_sqft', 'char_land_sf', near(1)], ['bedrooms', 'char_beds'], ['full_baths', 'char_fbath'], ['half_baths', 'char_hbath']],
  },
  // DC's own sales table.
  'dc-sales': {
    county: '11001',
    rows: () => newestSale(layerRows('https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/FeatureServer/57', ['SSL', 'SALE_DATE', 'SALE_PRICE']), 'SSL', 'SALE_DATE', 'SALE_PRICE'),
    id: (row) => row.SSL,
    map: [['sale_price', 'SALE_PRICE', moneyNear]],
  },
  // The Auditor's separate sales layer: homes sold lately, with their facts as of the sale.
  'oh-franklin': {
    county: '39049',
    rows: () => layerRows('https://gis.franklincountyohio.gov/hosting/rest/services/RealEstate/Sales_Information/MapServer/0', ['PARCELID', 'RESYRBLT', 'BATHS', 'HBATHS', 'BEDRMS', 'RESFLRAREA_AG']),
    id: (row) => row.PARCELID,
    map: [['year_built', 'RESYRBLT'], ['bedrooms', 'BEDRMS'], ['full_baths', 'BATHS'], ['half_baths', 'HBATHS'], ['living_sqft', 'RESFLRAREA_AG', near(1)]],
  },
  'pa-allegheny': {
    county: '42003',
    rows: alleghenySales,
    id: (row) => row.PARID,
    map: [['sale_price', 'PRICE', moneyNear]],
  },
  // The City's copy of the same table on its map server.
  'pa-philadelphia': {
    county: '42101',
    rows: () => layerRows('https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/OPA_PROPERTIES_PUBLIC/FeatureServer/0', ['parcel_number', 'year_built', 'total_livable_area', 'number_of_bedrooms', 'number_of_bathrooms', 'number_stories', 'total_area', 'market_value', 'sale_price'], { oid: 'OBJECTID' }),
    id: (row) => row.parcel_number,
    map: [['year_built', 'year_built'], ['living_sqft', 'total_livable_area', near(1)], ['bedrooms', 'number_of_bedrooms'], ['bathrooms', 'number_of_bathrooms'], ['stories', 'number_stories'], ['lot_sqft', 'total_area', near(1)], ['market_value', 'market_value', moneyNear], ['sale_price', 'sale_price', moneyNear]],
  },
  'ca-san-diego': {
    county: '06073',
    rows: sanDiegoCity,
    id: (row) => row.APN,
    map: [['living_sqft', 'TOTAL_LVG_AREA'], ['bedrooms', 'BEDROOMS'], ['bathrooms', 'baths'], ['assessed_land_value', 'ASR_LAND', moneyNear], ['assessed_building_value', 'ASR_IMPR', moneyNear], ['units', 'UNITQTY']],
  },
  // The county's parcel layer has the roll's values and acres.
  'ca-riverside': {
    county: '06065',
    rows: () => layerRows('https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/50', ['APN', 'LAND', 'STRUCTURES', 'ACREAGE']),
    id: (row) => row.APN,
    map: [['assessed_land_value', 'LAND', moneyNear], ['assessed_building_value', 'STRUCTURES', moneyNear], ['lot_acres', 'ACREAGE', near(0.01)]],
  },
  'ca-san-bernardino': {
    county: '06071',
    rows: sanBernardinoLayer,
    id: (row) => row.id,
    map: [['assessed_land_value', 'land', moneyNear], ['assessed_building_value', 'building', moneyNear], ['lot_acres', 'acres', near(0.02)], ['lot_sqft', 'sqft', (a, b) => Math.abs(a - b) <= Math.max(500, b * 0.05)]],
  },
  // The county's Assessor Parcel Data table, one roll back.
  'ca-los-angeles': {
    county: '06037',
    rows: () => layerRows('https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/Parcel_Data_2021_Table/FeatureServer/0', ['AssessorID', 'YearBuilt', 'EffectiveYearBuilt', 'SQFTmain', 'Bedrooms', 'Bathrooms', 'Units'], { where: "RollYear = '2025'", pageSize: 2000 }),
    id: (row) => row.AssessorID,
    map: [['year_built', 'YearBuilt'], ['effective_year_built', 'EffectiveYearBuilt'], ['living_sqft', 'SQFTmain', near(1)], ['bedrooms', 'Bedrooms'], ['bathrooms', 'Bathrooms'], ['units', 'Units']],
  },
};
