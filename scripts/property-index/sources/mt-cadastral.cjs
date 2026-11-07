'use strict';
// Montana: the State Library's Cadastral Framework, from the Department of Revenue's ORION appraisal database, updated
// monthly. Montana's law (MCA 2-6-1017) bars using a public list of people as a distribution list: this index keeps no
// people and no owner columns are asked for. The Department appraises at market value. Building detail comes from the same
// appraisal database's county files on the State Library's site, read with no server (lib/mdf.cjs): only the residential
// table's building columns are decoded, never its owner tables, and a property joins by the Department's own PropertyID.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parse, zip5 } = require('../../../backend/services/propertyRecords/addressKey');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { download } = require('../lib/tables.cjs');
const { tables, rows: fileRows } = require('../lib/mdf.cjs');
const { year, isoDate, realUnit, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const LAYER = 'https://services.arcgis.com/qnjIrwR8z5Izc0ij/arcgis/rest/services/Montana_Cadastral_Framework/FeatureServer/1';
const APPRAISAL_FILES = 'https://ftpgeoinfo.msl.mt.gov/Data/Spatial/MSDI/Cadastral/ORION_SQLDatabases';
// The Department numbers its county files its own way: this is that list, in order.
const FILE_ORDER = ['Silver Bow', 'Cascade', 'Yellowstone', 'Missoula', 'Lewis and Clark', 'Gallatin', 'Flathead', 'Fergus', 'Powder River', 'Carbon', 'Phillips', 'Hill', 'Ravalli', 'Custer', 'Lake', 'Dawson', 'Roosevelt', 'Beaverhead', 'Chouteau', 'Valley', 'Toole', 'Big Horn', 'Musselshell', 'Blaine', 'Madison', 'Pondera', 'Richland', 'Powell', 'Rosebud', 'Deer Lodge', 'Teton', 'Stillwater', 'Treasure', 'Sheridan', 'Sanders', 'Judith Basin', 'Daniels', 'Glacier', 'Fallon', 'Sweet Grass', 'McCone', 'Carter', 'Broadwater', 'Wheatland', 'Prairie', 'Granite', 'Meagher', 'Liberty', 'Park', 'Garfield', 'Jefferson', 'Wibaux', 'Golden Valley', 'Mineral', 'Petroleum', 'Lincoln'];
const RES_COLUMNS = ['PropertyID', 'TaxYear', 'ResType', 'Style_Desc', 'YearBuilt', 'EffectiveYear', 'StoryHeight', 'ExtWall_Desc', 'ExtWallFinish_Desc', 'RoofType_Desc', 'RoofMaterial_Desc', 'Foundation_Desc', 'BasementCostArea', 'BasementFinishedArea', 'HCType', 'HCFuelType_Desc', 'HCSystemType_Desc', 'Bedrooms', 'FullBaths', 'HalfBaths', 'FPStacks', 'FPPrefab', 'GarageCap', 'SFLA', 'PhyCondition_Desc', 'PctComplete'];
const MOBILE_STYLES = { SW: 'Single wide', DW: 'Double wide', TW: 'Triple wide', QW: 'Quad wide' };
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

// The file's words carry their code in front ("03 - Ranch"); the code means nothing to a person.
const said = (text) => word(String(text ?? '').replace(/^\S+\s+-\s+/, ''));

/** A dwelling's building facts, in the index's names. */
function dwellingFacts(row) {
  const facts = {};
  put(facts, 'year_built', year(row.YearBuilt));
  put(facts, 'effective_year_built', year(row.EffectiveYear));
  put(facts, 'living_sqft', positive(row.SFLA));
  put(facts, 'stories', positive(Number(row.StoryHeight)));
  put(facts, 'bedrooms', positive(row.Bedrooms));
  const full = positive(row.FullBaths);
  const half = positive(row.HalfBaths);
  put(facts, 'full_baths', full);
  put(facts, 'half_baths', half);
  if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
  put(facts, 'basement_sqft', positive(row.BasementCostArea));
  put(facts, 'basement_finished_sqft', positive(row.BasementFinishedArea));
  const fireplaces = (positive(row.FPStacks) || 0) + (positive(row.FPPrefab) || 0);
  if (fireplaces) facts.fireplaces = fireplaces;
  put(facts, 'parking_spaces', positive(row.GarageCap));
  put(facts, 'style', MOBILE_STYLES[row.Style_Desc] || said(row.Style_Desc));
  put(facts, 'frame', said(row.ExtWall_Desc));
  put(facts, 'exterior_walls', said(row.ExtWallFinish_Desc));
  put(facts, 'roof_shape', said(row.RoofType_Desc));
  put(facts, 'roof_cover', said(row.RoofMaterial_Desc));
  put(facts, 'foundation', said(row.Foundation_Desc));
  put(facts, 'heating', said(row.HCSystemType_Desc));
  put(facts, 'heating_fuel', said(row.HCFuelType_Desc));
  if (/\/AC$/.test(row.HCType || '')) facts.cooling = 'Central air';
  put(facts, 'condition', word(String(row.PhyCondition_Desc ?? '').replace(/\s*\(\d+\)$/, '')));
  const complete = positive(row.PctComplete);
  if (complete && complete < 100) facts.percent_complete = complete;
  return facts;
}

/** Each property's newest year of dwellings from its county's appraisal file: the largest dwelling's facts, and how many there are. */
function dwellingsOf(work, name) {
  const dir = path.join(work, 'mt-cadastral', 'appraisal');
  const zip = path.join(dir, `${name.replace(/ /g, '-')}.zip`);
  download(`${APPRAISAL_FILES}/COUNTY${FILE_ORDER.indexOf(name) + 1}.ZIP`, zip);
  execFileSync('unzip', ['-q', '-o', zip, '-d', dir], { maxBuffer: 1e9 });
  fs.rmSync(zip, { force: true });
  const file = path.join(dir, 'Output.mdf');
  const found = tables(file).get('Res');
  if (!found) throw new Error(`${name}'s appraisal file has no residential table`);
  const newest = new Map();
  for (const row of fileRows(file, found, RES_COLUMNS)) {
    const held = newest.get(row.PropertyID);
    if (!held || row.TaxYear > held.year) newest.set(row.PropertyID, { year: row.TaxYear, count: 1, row });
    else if (row.TaxYear === held.year) {
      held.count += 1;
      if ((row.SFLA || 0) > (held.row.SFLA || 0)) held.row = row;
    }
  }
  fs.rmSync(file, { force: true });
  const dwellings = new Map();
  for (const [id, { count, row }] of newest) {
    const facts = dwellingFacts(row);
    if (count > 1) facts.buildings_on_parcel = count;
    dwellings.set(id, facts);
  }
  return dwellings;
}

function fromRow(row, fips, county, dwellings) {
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
  if (kind === 'property' || kind === 'unit') Object.assign(facts, dwellings.get(Number(row.PropertyID)));
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
    const dwellings = dwellingsOf(work, name);
    const rows = cached(path.join(work, 'mt-cadastral', `${fips}.jsonl.gz`), () => layerRows(LAYER, COLUMNS, { where: `CountyName = '${name}'` }));
    for await (const row of rows) {
      const record = fromRow(row, fips, county, dwellings);
      if (!record) noAddress += 1;
      else if (!seen.has(record.id)) {
        seen.add(record.id);
        records.push(record);
      }
    }
    log(`${county}: ${records.length} records, ${noAddress} without a street number, ${records.filter(({ facts }) => facts.year_built).length} with building detail, ${dwellings.size} dwellings in the appraisal file`);
    if (!records.length) continue;
    // Which file is which county is a list kept here: a wrong one joins nothing, and that mustn't pass as a county with no detail.
    if (dwellings.size > 50 && records.filter(({ facts }) => facts.year_built).length < dwellings.size * 0.3) throw new Error(`${county}'s appraisal file barely joins its parcels`);
    for (const building of condoBuildings(records, { fips, county })) records.push(building);
    yield {
      fips, state: 'MT', name: county, publisher: 'Montana Department of Revenue, through the State Library', dataset: 'Cadastral Framework', method: 'state', source: 'mt-cadastral', title: 'State records', as_of: asOf, stale_after_days: 120, records,
    };
  }
}

module.exports = { build };
