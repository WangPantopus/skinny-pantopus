'use strict';
// Montana: the State Library's Cadastral Framework, from the Department of Revenue's ORION appraisal database, updated
// monthly. Montana's law (MCA 2-6-1017) bars using a public list of people as a distribution list: this index keeps no
// people and no owner columns are asked for. The Department appraises at market value. Building detail sits in county
// SQL Server files that this connector doesn't read yet, so there's no year built or size here.

const path = require('node:path');
const { parse, zip5 } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { isoDate, realUnit, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const LAYER = 'https://services.arcgis.com/qnjIrwR8z5Izc0ij/arcgis/rest/services/Montana_Cadastral_Framework/FeatureServer/1';
const COUNTIES = {
  Beaverhead: '001', 'Big Horn': '003', Blaine: '005', Broadwater: '007', Carbon: '009', Carter: '011', Cascade: '013', Chouteau: '015', Custer: '017', Daniels: '019', Dawson: '021', 'Deer Lodge': '023', Fallon: '025', Fergus: '027', Flathead: '029',
  Gallatin: '031', Garfield: '033', Glacier: '035', 'Golden Valley': '037', Granite: '039', Hill: '041', Jefferson: '043', 'Judith Basin': '045', Lake: '047', 'Lewis and Clark': '049', Liberty: '051', Lincoln: '053', McCone: '055', Madison: '057', Meagher: '059',
  Mineral: '061', Missoula: '063', Musselshell: '065', Park: '067', Petroleum: '069', Phillips: '071', Pondera: '073', 'Powder River': '075', Powell: '077', Prairie: '079', Ravalli: '081', Richland: '083', Roosevelt: '085', Rosebud: '087', Sanders: '089',
  Sheridan: '091', 'Silver Bow': '093', Stillwater: '095', 'Sweet Grass': '097', Teton: '099', Toole: '101', Treasure: '103', Valley: '105', Wheatland: '107', Wibaux: '109', Yellowstone: '111',
};
const COLUMNS = ['PARCELID', 'TaxYear', 'PropertyID', 'LegalDescriptionShort', 'Subdivision', 'AddressLine1', 'AddressLine2', 'CityStateZip', 'LevyDistrict', 'PropType', 'TotalAcres', 'TotalBuildingValue', 'TotalLandValue', 'TotalValue'];

function useOf(row, unit) {
  const use = String(row.PropType ?? '').toUpperCase();
  if (/CONDO/.test(use)) return ['unit', 'condo'];
  if (/TOWNHOUSE/.test(use)) return ['property', 'townhouse'];
  if (/MOBILE HOME|MANUFACT/.test(use)) return ['property', 'mobile_home'];
  if (/IMPROVED/.test(use)) return unit ? ['unit', null] : ['property', null];
  if (/VACANT/.test(use)) return ['parcel', null];
  return ['other', null];
}

function fromRow(row, fips, county) {
  const parsed = parse(row.AddressLine1, realUnit(row.AddressLine2));
  const parcel = word(row.PARCELID);
  if (!parsed || !parcel) return null;
  const [kind, homeType] = useOf(row, parsed.unit);
  const facts = { parcel_number: parcel, county, fips };
  put(facts, 'address_on_record', onRecord(row.AddressLine1, row.AddressLine2));
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.TotalAcres));
  put(facts, 'subdivision', word(row.Subdivision));
  put(facts, 'legal_description', word(row.LegalDescriptionShort)?.slice(0, 300));
  put(facts, 'tax_code_area', word(row.LevyDistrict));
  put(facts, 'land_use', word(row.PropType));
  put(facts, 'value_year', positive(row.TaxYear));
  put(facts, 'market_value', positive(row.TotalValue));
  put(facts, 'market_land_value', positive(row.TotalLandValue));
  put(facts, 'market_building_value', positive(row.TotalBuildingValue));
  const place = /^(.*?),?\s+MT\s+(\d{5})/i.exec(String(row.CityStateZip ?? '').trim());
  return { id: `pp:${kind}:${fips}:${parcel}`, kind, home_type: homeType, address: { ...parsed, city: place ? place[1].trim().toUpperCase() : '', zip: place ? zip5(place[2]) : '' }, facts };
}

async function* build({ work }) {
  const only = (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  const info = await getJson(`${LAYER}?f=json`, 'The layer\'s description');
  const asOf = isoDate(info.editingInfo?.dataLastEditDate || info.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The layer no longer says when it changed');
  for (const [name, code] of Object.entries(COUNTIES)) {
    const fips = `30${code}`;
    if (only.length && !only.includes(fips)) continue;
    const county = `${name} County`;
    const records = [];
    const seen = new Set();
    let noAddress = 0;
    const rows = cached(path.join(work, 'mt-cadastral', `${fips}.jsonl.gz`), () => layerRows(LAYER, COLUMNS, { where: `CountyName = '${name}'` }));
    for await (const row of rows) {
      const record = fromRow(row, fips, county);
      if (!record) noAddress += 1;
      else if (!seen.has(record.id)) {
        seen.add(record.id);
        records.push(record);
      }
    }
    log(`${county}: ${records.length} records, ${noAddress} without a street number`);
    if (!records.length) continue;
    for (const building of condoBuildings(records, { fips, county })) records.push(building);
    yield {
      fips, state: 'MT', name: county, publisher: 'Montana Department of Revenue, through the State Library', dataset: 'Cadastral Framework', method: 'state', source: 'mt-cadastral', title: 'State records', as_of: asOf, stale_after_days: 120, records,
    };
  }
}

module.exports = { build };
