'use strict';
// San Bernardino County, California: the Assessor's free property characteristics file and secured roll. Neither has street
// addresses ("protected per California Government Code Section 7928.205"), so they join on the parcel number to the county's
// own public layer of parcels with property addresses. The Assessor's page calls its data "maintained for internal use only
// in the determination of property value for the purpose of taxation" in a limitation of liability, then speaks of the
// recipient's application; no limit on recipients is stated. Owner, mailing and exemption columns are never read. Values are
// Proposition 13 assessed values from the monthly roll, never market values. No sale prices.

const path = require('node:path');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { download, zipTable, zipMembers } = require('../lib/tables.cjs');
const { year, isoDate, zipCode, streetParts } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '06071';
const COUNTY = 'San Bernardino County';
const PAGE = 'https://arc.sbcounty.gov/property-information/';
const ROLL = 'https://arc.sbcounty.gov/wp-content/uploads/sites/70/arcforms/Secured-Roll.zip';
const LAYER = 'https://services.arcgis.com/aA3snZwJfFkVyDuP/arcgis/rest/services/Internal_SB_County_Parcels_ForPublicView/FeatureServer/0';
const LAYER_COLUMNS = ['APN', 'SITUS_NBR', 'SITUS_PREDIR', 'SITUS_NAME', 'SITUS_TYPE', 'SITUS_CITY', 'SITUS_ZIP', 'TYPEUSE', 'ACREAGE', 'TRA'];
const TILDE = { delimiter: '~', quoted: false };
const SFR = ['SFRS-CONST-YEAR', 'SFRS-EFF-YEAR', 'SFRS-SIZE', 'SFRS-NBR-BDRM', 'SFRS-NBR-BATH', 'SFRS-TOTAL-ROOM', 'SFRS-ROOF-TYPE', 'SFRS-FLR1-SIZE', 'SFRS-FLR2-SIZE', 'SFRS-FLR3-SIZE', 'SFRS-BAS1-SIZE', 'SFRS-BAS2-SIZE', 'SFRS-PORT-SQF', 'SFRS-GARG-SQF', 'SFRS-GARG-CLASS', 'SFRS-GARG-STALL', 'SFRS-PORT-STALL', 'SFRS-HEAT', 'SFRS-COOL', 'SFRS-NBR-FIRPLC', 'SFRS-POOL-TYPE', 'SFRS-CONST-TYPE'];
const OTHER = ['OTHR-CONST-YEAR', 'OTHR-EFF-YEAR', 'OTHR-NBR-UNITS', 'OTHR-NBR-STORIES', 'OTHR-GRO-LEASE'];
const LAND = ['LAND-LOT-FOOTAGE', 'GROSS-ACRE', 'LAND-SEWER', 'LAND-WATER', 'LAND-GAS'];
const COLUMNS = ['FILE-CREATE-DATE', 'PARCEL-NBR', 'USE-CODE', 'TRA', 'SITUS-CITY', ...LAND, ...SFR, ...OTHER];

// The file's layout (Characteristics Layout Info), in its own words. 9 means "check": no word.
const ROOFS = { 1: 'Built up, composition', 2: 'Built up, rock', 3: 'Comp shingle', 4: 'Rolled composition', 5: 'Wood shingle or shake', 6: 'Tile', 7: 'Metal', 8: 'Other' };
const HEATS = { 0: 'None', 1: 'Central', 2: 'Wall/Floor', 3: 'Solar', 4: 'Electric Baseboard', 8: 'Other' };
const COOLS = { 0: 'None', 1: 'Refrigerative, Central', 2: 'Refrigerative, Non-central', 3: 'Evaporative, Non-central', 4: 'Central Plus Evaporative', 5: 'Evaporative, Central', 8: 'Other' };
const POOLS = { 1: 'Spa', 2: 'Unheated Pool', 3: 'Heated Pool', 4: 'Unheated pool with spa', 5: 'Heated pool with spa' };
const SEWERS = { 0: 'None', 1: 'Public', 2: 'Private', 3: 'Industrial' };
const WATERS = { 0: 'None', 1: 'Public', 2: 'Well', 3: 'Hauled' };
const FRAMES = { A: 'Fireproof steel frame', B: 'Masonry, Cabins', C: 'Masonry', D: 'Frame', F: 'Frame, Cabins', M: 'Mobile Homes', S: 'Steel' };
const GARAGE_KINDS = { A: 'Attached', D: 'Detached' };
const USES = {
  '0000': 'Vacant land', '0001': 'Manufactured home subdivision lot', '0510': 'SFR', '0511': 'Recreational cabin, non-perm, des/mtn', '0513': 'Parsonage', '0514': 'Residence on commercial', '0520': 'MH on fee land, not in MH subdivision', '0522': 'MH, in-park (leased land)', '0525': 'MH on fee land, in manufactured home subdivision', '0526': 'Manuf home on perm found(18551)', '0530': 'Condo', '0531': 'PUD', '0532': 'PUD, deminimus', '0534': 'Attached SFR (common wall)', '0535': 'Zero lot line SFR', '0599': 'Misc residential structure', '0600': 'Two SFR', '0601': 'Three SFR', '0602': 'Four SFR', '0603': 'Duplex', '0604': 'Triplex (true or combination)', '0605': 'Quad (true or combination)', '0610': 'Muli-SFR, 5-14 units', '0611': 'Apartment, 5-14 units', '0612': 'Townhouse apartment, 5-14 units', '0613': 'Senior citizen apartment, 5-14 units', '0620': 'Multi-SFR, 15 units and up', '0621': 'Apartment, 15 units and up', '0622': 'Townhouse apartment, 15 units and up', '0623': 'Senior citizen apt, 15 units and up', '0630': 'Condos used as apartments', '0631': 'Gov\'t assisted apt (HUD, 236, etc.)',
};

function useOf(code, unit) {
  if (code === '0530') return ['unit', 'condo'];
  if (code === '0531' || code === '0532') return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (code === '0534') return ['property', 'townhouse'];
  if (['0510', '0511', '0513', '0514', '0535', '0599'].includes(code)) return ['property', 'house'];
  if (['0520', '0522', '0525', '0526'].includes(code)) return ['property', 'mobile_home'];
  if (['0600', '0601', '0602', '0603', '0604', '0605'].includes(code)) return ['building', 'multi_unit'];
  if (['0610', '0611', '0612', '0613', '0620', '0621', '0622', '0623', '0630', '0631'].includes(code)) return ['building', 'apartment'];
  if (code === '0000' || code === '0001') return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};
// A fractional bath is counted in quarters; a few cells hold slips like .02.
const baths = (value) => {
  const count = positive(value);
  return count && count >= 0.25 && count <= 20 ? count : null;
};
// The Assessor's files number a parcel in 13 digits: book, page and line, then its type and sequence. The address layer has the
// first nine, for the regular parcel at that spot.
const parcelOf = (value) => String(value ?? '').replace(/\D/g, '').padStart(9, '0').padEnd(13, '0');

function homeFacts(facts, row, others) {
  put(facts, 'year_built', year(row['SFRS-CONST-YEAR']));
  put(facts, 'effective_year_built', year(row['SFRS-EFF-YEAR']));
  put(facts, 'living_sqft', positive(row['SFRS-SIZE']));
  put(facts, 'bedrooms', inRange(row['SFRS-NBR-BDRM'], 15));
  put(facts, 'bathrooms', baths(row['SFRS-NBR-BATH']));
  put(facts, 'rooms', inRange(row['SFRS-TOTAL-ROOM'], 40));
  put(facts, 'roof_cover', ROOFS[row['SFRS-ROOF-TYPE']]);
  put(facts, 'heating', HEATS[row['SFRS-HEAT']]);
  put(facts, 'cooling', COOLS[row['SFRS-COOL']]);
  put(facts, 'pool', POOLS[row['SFRS-POOL-TYPE']]);
  put(facts, 'fireplaces', positive(row['SFRS-NBR-FIRPLC']));
  put(facts, 'frame', FRAMES[row['SFRS-CONST-TYPE']]);
  put(facts, 'garage_sqft', positive(row['SFRS-GARG-SQF']));
  put(facts, 'carport_sqft', positive(row['SFRS-PORT-SQF']));
  // Garage and carport stalls, each a count the layout defines.
  const [garageStalls, carportStalls] = [inRange(row['SFRS-GARG-STALL'], 20), inRange(row['SFRS-PORT-STALL'], 20)];
  if (garageStalls || carportStalls) facts.parking_spaces = (garageStalls || 0) + (carportStalls || 0);
  put(facts, 'garage', GARAGE_KINDS[String(row['SFRS-GARG-CLASS'] || '')[0]]);
  const parking = [facts.garage && `${facts.garage} garage`, (carportStalls || positive(row['SFRS-PORT-SQF'])) && 'Carport'].filter(Boolean);
  if (parking.length) facts.parking_type = parking.join(', ');
  put(facts, 'basement_sqft', (positive(row['SFRS-BAS1-SIZE']) || 0) + (positive(row['SFRS-BAS2-SIZE']) || 0) || null);
  if (positive(row['SFRS-FLR1-SIZE'])) facts.stories = 1 + (positive(row['SFRS-FLR2-SIZE']) ? 1 : 0) + (positive(row['SFRS-FLR3-SIZE']) ? 1 : 0);
  if (others > 1) facts.buildings_on_parcel = others;
  else {
    // One residence: its floors are the home's.
    put(facts, 'ground_floor_sqft', positive(row['SFRS-FLR1-SIZE']));
    put(facts, 'second_floor_sqft', positive(row['SFRS-FLR2-SIZE']));
  }
}

function fromRow(row, sets, roll, valueYear) {
  const parcel = parcelOf(row.APN);
  const address = streetParts({ number: row.SITUS_NBR, pre: word(row.SITUS_PREDIR) || '', name: word(row.SITUS_NAME) || '', suffix: word(row.SITUS_TYPE) || '' });
  if (!address || !/^\d{13}$/.test(parcel)) return null;
  const own = sets || [];
  const code = String(own[0]?.['USE-CODE'] || row.TYPEUSE || '').trim().padStart(4, '0');
  const [kind, homeType] = useOf(code, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', [row.SITUS_NBR, row.SITUS_PREDIR, row.SITUS_NAME, row.SITUS_TYPE].map(word).filter(Boolean).join(' '));
  put(facts, 'tax_code_area', word(row.TRA));
  put(facts, 'land_use', USES[code]);
  put(facts, 'county_use_code', code);
  put(facts, 'legal_description', roll?.legal?.slice(0, 300));
  const land = own[0];
  if (land) {
    put(facts, 'sewer', SEWERS[land['LAND-SEWER']]);
    put(facts, 'water_source', WATERS[land['LAND-WATER']]);
  }
  // One row per residence on the parcel: the largest is the home.
  const residences = own.filter((set) => positive(set['SFRS-SIZE']));
  const main = residences.sort((a, b) => Number(b['SFRS-SIZE']) - Number(a['SFRS-SIZE']))[0];
  if (home && main) homeFacts(facts, main, residences.length);
  if (kind === 'building') {
    const rental = own.find((set) => positive(set['OTHR-NBR-UNITS']));
    put(facts, 'units', positive(rental?.['OTHR-NBR-UNITS']));
    put(facts, 'stories', inRange(rental?.['OTHR-NBR-STORIES'], 120));
    put(facts, 'gross_sqft', positive(rental?.['OTHR-GRO-LEASE']));
    put(facts, 'year_built', year(rental?.['OTHR-CONST-YEAR']) || year(main?.['SFRS-CONST-YEAR']));
    put(facts, 'effective_year_built', year(rental?.['OTHR-EFF-YEAR']));
  }
  if (kind !== 'unit') {
    const lot = positive(land?.['LAND-LOT-FOOTAGE']);
    if (lot) facts.lot_sqft = lot;
    else put(facts, 'lot_acres', positive(row.ACREAGE) || positive(land?.['GROSS-ACRE']));
  }
  const [landValue, building] = [positive(roll?.land), positive(roll?.building)];
  put(facts, 'value_year', valueYear);
  put(facts, 'assessed_land_value', landValue);
  put(facts, 'assessed_building_value', building);
  put(facts, 'assessed_value', (landValue || 0) + (building || 0) || null);
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.SITUS_CITY) || '').toUpperCase(), zip: zipCode(row.SITUS_ZIP) }, facts };
}

async function characteristicsFile(work) {
  const page = await fetch(PAGE, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PantopusPropertyIndex/1.0; +https://pantopus.com)' }, signal: AbortSignal.timeout(120000) });
  const found = /https:[^"']*PIMSPropertyCharacteristics_(\d{8})[^"']*\.zip/.exec(await page.text());
  if (!found) throw new Error('The Assessor\'s page no longer lists the characteristics file');
  const file = path.join(work, 'ca-san-bernardino', `characteristics-${found[1]}.zip`);
  download(found[0], file);
  return { file, asOf: isoDate(found[1]) };
}

async function* build({ work }) {
  const { file, asOf: fileDate } = await characteristicsFile(work);
  const rollFile = path.join(work, 'ca-san-bernardino', 'secured-roll.zip');
  download(ROLL, rollFile);
  const byParcel = new Map();
  for await (const row of zipTable(file, zipMembers(file)[0], COLUMNS, TILDE)) {
    const parcel = parcelOf(row['PARCEL-NBR']);
    if (!byParcel.has(parcel)) byParcel.set(parcel, []);
    byParcel.get(parcel).push(row);
  }
  const rolls = new Map();
  for await (const row of zipTable(rollFile, zipMembers(rollFile)[0], ['PARCEL', 'LEG1', 'LEG2', 'LEG3', 'LEG4', 'LAND VALUE', 'IMPR VALUE'], TILDE)) {
    rolls.set(parcelOf(row.PARCEL), { legal: [row.LEG1, row.LEG2, row.LEG3, row.LEG4].map(word).filter(Boolean).join(' '), land: row['LAND VALUE'], building: row['IMPR VALUE'] });
  }
  log(`${byParcel.size} parcels with characteristics, ${rolls.size} on the secured roll`);
  const info = await getJson(`${LAYER}?f=json`, 'The address layer\'s description');
  const asOf = isoDate(info.editingInfo?.dataLastEditDate) || fileDate;
  const records = [];
  const seen = new Set();
  let [noAddress, matched] = [0, 0];
  for await (const row of cached(path.join(work, 'ca-san-bernardino', 'addresses.jsonl.gz'), () => layerRows(LAYER, LAYER_COLUMNS, { pageSize: 1000 }))) {
    const parcel = parcelOf(row.APN);
    const sets = byParcel.get(parcel);
    if (sets) matched += 1;
    const record = fromRow(row, sets, rolls.get(parcel), Number(fileDate.slice(0, 4)));
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number, ${matched} with characteristics`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'CA', name: COUNTY, publisher: 'San Bernardino County Assessor', dataset: 'property characteristics and parcels', method: 'county', source: 'ca-san-bernardino', as_of: asOf, stale_after_days: 450, records,
  };
}

// The parcel layer's own shapes, by the parcel number each record carries (the same columns): what lib/measure.cjs
// measures a lot's area and counts its buildings on (measured rows, held off until the county's measured_rows switch is on).
const parcelShapes = { url: LAYER, fields: ['APN'], key: (row) => (row.APN ? parcelOf(row.APN) : null), pageSize: 1000 };

module.exports = {
  parcelShapes,
  build,
  dictionary: {
    layer: LAYER,
    columns: [...COLUMNS, 'PROL-LAND-VAL', 'PROL-IMPR-VAL'],
    facts: { year_built: 'SFRS-CONST-YEAR', effective_year_built: 'SFRS-EFF-YEAR', living_sqft: 'SFRS-SIZE', bedrooms: 'SFRS-NBR-BDRM', bathrooms: 'SFRS-NBR-BATH', rooms: 'SFRS-TOTAL-ROOM', fireplaces: 'SFRS-NBR-FIRPLC', garage_sqft: 'SFRS-GARG-SQF', lot_sqft: 'LAND-LOT-FOOTAGE', lot_acres: 'ACREAGE', units: 'OTHR-NBR-UNITS', stories: 'OTHR-NBR-STORIES', assessed_land_value: 'PROL-LAND-VAL', assessed_building_value: 'PROL-IMPR-VAL' },
    text: 'https://arc.sbcounty.gov/wp-content/uploads/sites/70/arcforms/Characteristic_Layout_Info_WithGovtCode.pdf',
    words: { 'SFRS-ROOF-TYPE': ROOFS, 'SFRS-HEAT': HEATS, 'SFRS-COOL': COOLS, 'SFRS-POOL-TYPE': POOLS, 'LAND-SEWER': SEWERS, 'LAND-WATER': WATERS, 'SFRS-CONST-TYPE': { A: 'Fireproof steel frame', B: 'Masonry, Cabins', C: 'Masonry', D: 'Frame', F: 'Frame, Cabins', M: 'Mobile Homes' }, 'USE-CODE': USES },
  },
};
