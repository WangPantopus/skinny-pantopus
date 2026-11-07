'use strict';
// West Virginia: the WV GIS Technical Center's parcel summary, from county assessors and the state's Property Tax
// Division. Published "as a public service, as is". West Virginia assesses at 60% of the appraisal: the appraisal is
// what's here. Owner, care-of and new-owner columns aren't asked for.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { layerRows, cached, getJson } = require('../lib/services.cjs');
const { year, isoDate, zipCode, realUnit } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const TABLE = 'https://services.wvgis.wvu.edu/arcgis/rest/services/Planning_Cadastre/WV_Parcels/MapServer/11';
const COLUMNS = ['CleanParcelID', 'CountyCode', 'CountyName', 'DistrictName', 'DeededAcres', 'TaxYear', 'PropertyClassDescription', 'LandUse', 'OccupancyDescription', 'YearBuilt', 'Grade', 'StyleDescription', 'Stories', 'BasementType', 'ExteriorWallType', 'TotalRooms', 'StructureArea', 'Units',
  'LandAppraisal', 'BuildingAppraisal', 'TotalAppraisal', 'SAMSAddress', 'SAMSCity', 'SAMSZip', 'ADDRNUM', 'ADDRNUMSUF', 'FULLNAME', 'UNITID', 'FullPhysicalAddress', 'PhysicalCity', 'PhysicalZip'];

function useOf(row) {
  const use = `${row.LandUse || ''} ${row.OccupancyDescription || ''}`.toUpperCase();
  if (/CONDOMINIUM/.test(use)) return ['unit', 'condo'];
  if (/MOBILE HOME/.test(use)) return ['property', 'mobile_home'];
  if (/2 FAMILY|3 FAMILY|4 FAMILY|MULTI/.test(use)) return ['building', 'multi_unit'];
  if (/APARTMENT/.test(use)) return ['building', 'apartment'];
  if (/VACANT/.test(use)) return ['parcel', null];
  if (/1 FAMILY/.test(use)) return ['property', 'house'];
  return ['other', null];
}
const said = (text) => {
  const value = word(text);
  return value && !/^(unknown|none|other)$/i.test(value) ? value : null;
};

function fromRow(row, fips, county) {
  const number = [row.ADDRNUM, row.ADDRNUMSUF].map((part) => String(part ?? '').trim()).join('');
  const street = String(row.FULLNAME ?? '').trim();
  const parsed = number && street ? parse(`${number} ${street}`, realUnit(row.UNITID)) : parse(row.FullPhysicalAddress);
  const parcel = word(row.CleanParcelID);
  if (!parsed || !parcel) return null;
  const [kind, homeType] = useOf(row);
  const facts = { parcel_number: parcel, county, fips };
  const on = kind === 'property' || kind === 'unit' || kind === 'building';
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'municipality', word(row.DistrictName));
  put(facts, 'address_on_record', word(row.SAMSAddress) || word(row.FullPhysicalAddress));
  put(facts, 'year_built', on ? year(row.YearBuilt) : null);
  put(facts, 'living_sqft', home ? positive(row.StructureArea) : null);
  put(facts, 'gross_sqft', kind === 'building' ? positive(row.StructureArea) : null);
  put(facts, 'stories', on ? positive(row.Stories) : null);
  put(facts, 'style', on ? said(row.StyleDescription) : null);
  put(facts, 'quality', on ? said(row.Grade) : null);
  put(facts, 'exterior_walls', on ? said(row.ExteriorWallType) : null);
  put(facts, 'rooms', home ? positive(row.TotalRooms) : null);
  if (kind === 'building') put(facts, 'units', positive(row.Units));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.DeededAcres));
  put(facts, 'land_use', word(row.OccupancyDescription));
  put(facts, 'property_class', word(row.PropertyClassDescription));
  put(facts, 'value_year', positive(row.TaxYear));
  put(facts, 'market_value', positive(row.TotalAppraisal));
  put(facts, 'market_land_value', positive(row.LandAppraisal));
  put(facts, 'market_building_value', positive(row.BuildingAppraisal));
  return {
    id: `pp:${kind}:${fips}:${parcel}`, kind, home_type: homeType,
    address: { ...parsed, city: String(word(row.SAMSCity) || word(row.PhysicalCity) || '').toUpperCase(), zip: zipCode(row.SAMSZip) || zipCode(row.PhysicalZip) }, facts,
  };
}

// FIPS by county name. The state's own codes run 1 to 55 alphabetically with McDowell after Mason, but FIPS order files it
// as if spelled MacDowell, before Marion, so codes turned into FIPS put Marion, Marshall, Mason and McDowell each under
// another's code (November 7).
const FIPS = {
  BARBOUR: 1, BERKELEY: 3, BOONE: 5, BRAXTON: 7, BROOKE: 9, CABELL: 11, CALHOUN: 13, CLAY: 15, DODDRIDGE: 17, FAYETTE: 19,
  GILMER: 21, GRANT: 23, GREENBRIER: 25, HAMPSHIRE: 27, HANCOCK: 29, HARDY: 31, HARRISON: 33, JACKSON: 35, JEFFERSON: 37,
  KANAWHA: 39, LEWIS: 41, LINCOLN: 43, LOGAN: 45, MCDOWELL: 47, MARION: 49, MARSHALL: 51, MASON: 53, MERCER: 55,
  MINERAL: 57, MINGO: 59, MONONGALIA: 61, MONROE: 63, MORGAN: 65, NICHOLAS: 67, OHIO: 69, PENDLETON: 71, PLEASANTS: 73,
  POCAHONTAS: 75, PRESTON: 77, PUTNAM: 79, RALEIGH: 81, RANDOLPH: 83, RITCHIE: 85, ROANE: 87, SUMMERS: 89, TAYLOR: 91,
  TUCKER: 93, TYLER: 95, UPSHUR: 97, WAYNE: 99, WEBSTER: 101, WETZEL: 103, WIRT: 105, WOOD: 107, WYOMING: 109,
};
const fipsOf = (name) => {
  const code = FIPS[String(name ?? '').toUpperCase().replace(/[^A-Z]/g, '')];
  if (!code) throw new Error(`No FIPS code for ${name}`);
  return `54${String(code).padStart(3, '0')}`;
};

async function* build({ work }) {
  const only = (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  const info = await getJson(`${TABLE}?f=json`, 'The table\'s description');
  const edited = isoDate(info.editingInfo?.lastEditDate);
  const groups = await getJson(`${TABLE}/query?${new URLSearchParams({ where: '1=1', outFields: 'CountyCode,CountyName,TaxYear', returnDistinctValues: 'true', returnGeometry: 'false', f: 'json' })}`, 'The table\'s counties');
  const counties = new Map();
  for (const { attributes: row } of groups.features || []) {
    const was = counties.get(row.CountyCode);
    if (!was || Number(row.TaxYear) > Number(was.TaxYear)) counties.set(row.CountyCode, row);
  }
  log(`${counties.size} counties listed`);
  if (counties.size !== 55) throw new Error(`${counties.size} counties are listed, not 55`);
  for (const row of [...counties.values()].sort((a, b) => Number(a.CountyCode) - Number(b.CountyCode))) {
    const fips = fipsOf(row.CountyName);
    if (only.length && !only.includes(fips)) continue;
    const county = `${row.CountyName} County`;
    const records = [];
    const seen = new Set();
    let noAddress = 0;
    const rows = cached(path.join(work, 'wv-parcels', `${fips}.jsonl.gz`), () => layerRows(TABLE, COLUMNS, { where: `CountyName = '${row.CountyName}'`, oid: 'ID' }));
    for await (const source of rows) {
      const record = fromRow(source, fips, county);
      if (!record) noAddress += 1;
      else if (!seen.has(record.id)) {
        seen.add(record.id);
        records.push(record);
      }
    }
    log(`${county}: ${records.length} records, ${noAddress} without a street number`);
    for (const building of condoBuildings(records, { fips, county })) records.push(building);
    yield {
      fips, state: 'WV', name: county, publisher: 'WV GIS Technical Center', dataset: `${row.TaxYear} parcel summary`, method: 'state', source: 'wv-parcels', title: 'State records', as_of: edited || `${row.TaxYear}-07-01`, stale_after_days: 730, records,
    };
  }
}

module.exports = { build };
