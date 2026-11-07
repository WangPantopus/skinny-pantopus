'use strict';
// Sarasota County, Florida: the Property Appraiser's free parcel file on its Download Data page ("available to the public on our website free of
// charge"). Year built, living area, bedrooms, baths, units, pool, zoning, just value and the last sale. The state's roll has no bedrooms or baths.
// Owner, mailing, exemption and homestead columns are in the file and never read. Assessed and taxable values are left out: the distance from just
// value can say a home has a homestead exemption. The same page's detailed data has each building's walls, roof, heat and floors, with the
// Appraiser's own lookup tables for their codes, and every recorded sale with its deed.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { download, zipDates, zipTable } = require('../lib/tables.cjs');
const { year, isoDate, zipCode, realUnit, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '12115';
const COUNTY = 'Sarasota County';
const FILE = 'https://www.sarasotapropertyappraiser.gov/downloads/SCPA_Parcels_Sales_CSV.zip';
const DETAILS = 'https://www.sarasotapropertyappraiser.gov/downloads/SCPA_Detailed_Data.zip';
const TABLE = 'Parcel_Sales_CSV/Sarasota.csv';
const COLUMNS = ['ACCOUNT', 'LOCN', 'LOCS', 'LOCD', 'UNIT', 'LOCCITY', 'LOCZIP', 'STCD', 'SUBD', 'TXCD', 'Municipality', 'BLOCK', 'LOT', 'ZONING_1', 'SALE_AMT', 'SALE_DATE', 'POOL', 'BUILD_CLAS', 'GRND_AREA', 'LIVING', 'BEDR', 'BATH', 'HALFBATH', 'LIVUNITS', 'YRBL', 'LSQFT', 'JUST', 'LEGAL1', 'LEGAL2'];
// Deeds on the Appraiser's list that move no home at a price: a quit claim, oil and mineral rights, a mortgage, a surrender. A home in a park
// sells by assigning its proprietary lease.
const NOT_A_DEED_OF_SALE = new Set(['QC', 'MR', 'BM', 'DS']);
// Its qualification codes for a line that isn't this home's price: a corrective or nominal deed, a cemetery lot, part of an interest, a
// satisfaction, part of a bulk sale, an error.
const NOT_THIS_SALE = new Set(['11', '13', '16', '34', '43', '98']);
const COOLED = new Set(['1', '2', '4', '5']);
const HEATED = new Set(['1', '3', '4']);
const said = (text) => {
  const value = word(text);
  return value && !/^(none|no walls|global style|not used.*)$/i.test(value) ? value : null;
};

function useOf(code, hasUnit) {
  const c = String(code ?? '').trim();
  if (c === '0101' || c === '0102') return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (c.startsWith('01')) return hasUnit ? ['unit', 'condo'] : ['property', 'house'];
  if (c.startsWith('02')) return ['property', 'mobile_home'];
  if (c.startsWith('04') || c.startsWith('05')) return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (c.startsWith('08')) return ['building', 'multi_unit'];
  if (c.startsWith('03')) return ['building', 'apartment'];
  if (c.startsWith('00')) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const number = positive(value);
  return number && number <= most ? number : null;
};

function buildingFacts(facts, card, kind, words) {
  put(facts, 'effective_year_built', year(card.effyearblt));
  put(facts, 'style', said(words.style.get(card.exttype)));
  put(facts, 'stories', inRange(card.storyhgt, kind === 'building' ? 40 : 6));
  put(facts, 'exterior_walls', said(words.walls.get(card.primewall)));
  put(facts, 'roof_cover', said(words.cover.get(card.roofcover)));
  put(facts, 'roof_shape', said(words.shape.get(card.roofstruct)));
  put(facts, 'foundation', said(words.foundation.get(card.foundation)));
  put(facts, 'frame', said(words.frame.get(card.frame))?.replace(/;$/, ''));
  if (kind === 'building') return;
  put(facts, 'flooring', said(words.floor.get(card.primaryfloors)));
  put(facts, 'heating', HEATED.has(card.heattype) ? words.heat.get(card.heattype) : null);
  put(facts, 'cooling', COOLED.has(card.heattype) ? words.heat.get(card.heattype) : null);
  put(facts, 'fireplaces', inRange(card.fireplaces, 20));
  put(facts, 'parking_spaces', inRange(card.parkingspaces, 20));
  const ground = card.areas?.MLA;
  if (kind === 'property') put(facts, 'ground_floor_sqft', ground);
  const [garage, carport] = [card.areas?.garage, card.areas?.carport];
  put(facts, 'garage_sqft', garage);
  put(facts, 'carport_sqft', carport);
}

function fromRow(row, uses, subdivisions, details, words) {
  const number = word(row.LOCN);
  const street = [number, word(row.LOCS), word(row.LOCD)].filter(Boolean).join(' ');
  const address = number && street ? parse(street, realUnit(row.UNIT)) : null;
  const parcel = word(row.ACCOUNT);
  if (!address || !parcel) return null;
  const code = String(row.STCD ?? '').trim();
  const [kind, homeType] = useOf(code, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', onRecord(street, row.UNIT));
  put(facts, 'land_use', uses.get(code));
  put(facts, 'county_use_code', word(code));
  put(facts, 'subdivision', subdivisions.get(String(row.SUBD ?? '').trim()));
  put(facts, 'zoning', word(row.ZONING_1));
  put(facts, 'tax_code_area', word(row.TXCD));
  put(facts, 'municipality', word(row.Municipality));
  put(facts, 'lot_number', word(row.LOT));
  put(facts, 'legal_description', [word(row.LEGAL1), word(row.LEGAL2)].filter(Boolean).join(' ').slice(0, 300) || null);
  const card = details.cards.get(parcel);
  if (home || kind === 'building') {
    put(facts, 'year_built', year(row.YRBL));
    // "Res Avg Quality Materials & Design", "Com Average/Good"; a commercial cost class ("Commercial 70") says nothing of quality.
    const grade = said(words.grade.get(String(row.BUILD_CLAS ?? '').trim()));
    put(facts, 'quality', grade && !/^Commercial\s/.test(grade) ? grade.replace(/^(Res|Com)\s+/, '') : null);
    if (card) buildingFacts(facts, card, kind, words);
    if (card?.cards > 1) facts.buildings_on_parcel = card.cards;
  }
  if (home) {
    put(facts, 'living_sqft', positive(row.LIVING));
    put(facts, 'gross_sqft', positive(row.GRND_AREA));
    put(facts, 'bedrooms', inRange(row.BEDR, 15));
    const [full, half] = [inRange(row.BATH, 20), inRange(row.HALFBATH, 10)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
    // An X says the parcel has a pool.
    if (/^(x|y|yes|1)$/i.test(String(row.POOL ?? '').trim())) facts.pool = 'Yes';
    const out = details.outbuildings.get(parcel);
    if (out?.garage) {
      facts.garage_sqft = (facts.garage_sqft || 0) + out.garage;
    }
    if (out?.carport) facts.carport_sqft = (facts.carport_sqft || 0) + out.carport;
    if (out?.pool) facts.pool = 'Yes';
    const parts = [card?.areas?.garage && 'Attached garage', out?.garage && 'Detached garage', (card?.areas?.carport || out?.carport) && 'Carport'].filter(Boolean);
    if (parts.length) facts.parking_type = parts.join(', ');
    const garages = [card?.areas?.garage && 'Attached', out?.garage && 'Detached'].filter(Boolean);
    if (garages.length) facts.garage = garages.join(', ');
  } else if (kind === 'building') {
    put(facts, 'gross_sqft', positive(row.LIVING));
    put(facts, 'units', positive(row.LIVUNITS));
  }
  if (kind !== 'unit') put(facts, 'lot_sqft', positive(row.LSQFT));
  put(facts, 'market_value', positive(row.JUST));
  const sale = details.sales.get(parcel);
  if (sale) {
    facts.sale_price = sale.price;
    facts.sale_date = sale.date;
    put(facts, 'sale_document', sale.document);
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: String(word(row.LOCCITY) || '').toUpperCase(), zip: zipCode(row.LOCZIP) }, facts };
}

const lookup = async (zip, member) => {
  const table = new Map();
  for await (const row of zipTable(zip, member, ['Code', 'Description'])) table.set(row.Code.trim(), word(row.Description));
  return table;
};

async function readDetails(zip) {
  const words = {};
  for (const [name, member] of Object.entries({ style: 'LookupExteriorType', walls: 'LookupExteriorWall', cover: 'LookupRoofCover', shape: 'LookupRoofStructure', foundation: 'LookupFoundation', frame: 'LookupFrame', floor: 'LookupFloor', heat: 'LookupHeatAir' })) {
    words[name] = await lookup(zip, `${member}.txt`);
  }
  const cards = new Map();
  const areas = new Map();
  for await (const row of zipTable(zip, 'SketchedArea.txt', ['parcelid', 'cardnumber', 'subarea', 'sketchedarea'])) {
    const key = `${row.parcelid}|${row.cardnumber}`;
    if (!areas.has(key)) areas.set(key, {});
    const held = areas.get(key);
    const area = positive(row.sketchedarea) || 0;
    const code = row.subarea.trim();
    if (code === 'MLA') held.MLA = (held.MLA || 0) + area;
    else if (/^AG[AFG]$/.test(code)) held.garage = (held.garage || 0) + area;
    else if (/^CP[AFG]$/.test(code)) held.carport = (held.carport || 0) + area;
  }
  for await (const row of zipTable(zip, 'Building.txt', ['parcelid', 'cardnumber', 'heattype', 'exttype', 'storyhgt', 'foundation', 'frame', 'primewall', 'roofstruct', 'roofcover', 'effyearblt', 'primaryfloors', 'fireplaces', 'parkingspaces'])) {
    const held = cards.get(row.parcelid);
    if (held) held.cards += 1;
    // Card 1 is the main building.
    else cards.set(row.parcelid, { ...row, cards: 1, areas: areas.get(`${row.parcelid}|${row.cardnumber}`) });
  }
  const outbuildings = new Map();
  for await (const row of zipTable(zip, 'SFYI.txt', ['parcelid', 'outbuildingtype', 'quantity', 'units'])) {
    const type = row.outbuildingtype.trim();
    const garage = type === 'GRAGED' || type === 'DEGA';
    const carport = type === 'CARPRT' || type === 'DECP';
    if (!garage && !carport && type !== 'POOL') continue;
    if (!outbuildings.has(row.parcelid)) outbuildings.set(row.parcelid, {});
    const held = outbuildings.get(row.parcelid);
    const area = positive(row.units) || 0;
    if (garage) held.garage = (held.garage || 0) + area;
    if (carport) held.carport = (held.carport || 0) + area;
    if (type === 'POOL') held.pool = true;
  }
  const qualifications = await lookup(zip, 'LookupQualificationCode.txt');
  const sales = new Map();
  for await (const row of zipTable(zip, 'Sales.txt', ['parcelid', 'saledate', 'saleprice', 'legalreference', 'nalcode', 'deedtype'])) {
    const [date, price, deed, code] = [isoDate(row.saledate), positive(row.saleprice), row.deedtype.trim(), row.nalcode.trim()];
    if (!date || !isHomeSale(price, qualifications.get(code)) || NOT_A_DEED_OF_SALE.has(deed) || NOT_THIS_SALE.has(code)) continue;
    const held = sales.get(row.parcelid);
    if (!held || held.date < date) sales.set(row.parcelid, { date, price, document: word(row.legalreference) });
  }
  log(`${cards.size} parcels with buildings, ${outbuildings.size} with detached garages, carports or pools, ${sales.size} with a sale of the home`);
  return { details: { cards, outbuildings, sales }, words };
}

async function* build({ work }) {
  const zip = path.join(work, 'fl-sarasota', 'SCPA_Parcels_Sales_CSV.zip');
  download(FILE, zip);
  const detailed = path.join(work, 'fl-sarasota', 'SCPA_Detailed_Data.zip');
  download(DETAILS, detailed);
  const asOf = zipDates(zip).get(TABLE);
  if (!asOf) throw new Error('The file no longer says when it was made');
  const { details, words } = await readDetails(detailed);
  words.grade = await lookup(zip, 'Parcel_Sales_CSV/BuildingClassCodes.csv');
  const [uses, subdivisions] = [new Map(), new Map()];
  for await (const row of zipTable(zip, 'Parcel_Sales_CSV/LandUseCodes.csv', ['Code', 'Description'])) uses.set(row.Code, word(row.Description));
  for await (const row of zipTable(zip, 'Parcel_Sales_CSV/SubdivisionCodes.csv', ['Code', 'Description'])) subdivisions.set(row.Code, word(row.Description));
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of zipTable(zip, TABLE, COLUMNS)) {
    const record = fromRow(row, uses, subdivisions, details, words);
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'FL', name: COUNTY, publisher: 'Sarasota County Property Appraiser', dataset: 'parcel file', method: 'county', source: 'fl-sarasota', as_of: asOf, stale_after_days: 450, records,
  };
}

module.exports = {
  build,
  dictionary: {
    columns: COLUMNS,
    facts: { year_built: 'YRBL', living_sqft: 'LIVING', gross_sqft: 'LIVING', bedrooms: 'BEDR', full_baths: 'BATH', half_baths: 'HALFBATH', units: 'LIVUNITS', lot_sqft: 'LSQFT', market_value: 'JUST', sale_price: 'SALE_AMT', sale_date: 'SALE_DATE', zoning: 'ZONING_1', subdivision: 'SUBD', land_use: 'STCD', legal_description: 'LEGAL1' },
  },
};
