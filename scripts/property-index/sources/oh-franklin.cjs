'use strict';
// Franklin County, Ohio: the County Auditor's tax parcel layer. Its notice is a disclaimer: check the Auditor's office for the record, no
// legal responsibility taken. Owner, mailing, owner-occupied, homestead and rental columns are in the layer and never asked for. Ohio
// appraises at full value and taxes 35% of it, so TOTVALUEBASE is the Auditor's market value. The building columns of that layer are empty:
// its monthly appraisal files hold them, each cell in the Auditor's own code and word. Owner columns in those files are never asked for.

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { layerRows, cached } = require('../lib/services.cjs');
const { download, zipTable, USER_AGENT } = require('../lib/tables.cjs');
const { isHomeSale } = require('../lib/sales.cjs');
const { lotNumber } = require('../lib/legal.cjs');
const { year, isoDate, zipCode, realUnit } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '39049';
const COUNTY = 'Franklin County';
const LAYER = 'https://gis.franklincountyohio.gov/hosting/rest/services/ParcelFeatures/Parcel_Features/MapServer/0';
const COLUMNS = ['PARCELID', 'LOWPARCELID', 'BUILDING', 'UNIT', 'ACRES', 'CVTTXCD', 'CVTTXDSCRP', 'SCHLDSCRP', 'NBHDCD', 'CLASSCD', 'CLASSDSCRP', 'SITEADDRESS', 'ZIPCD', 'PRPRTYDSCRP', 'PRPRTYDSCRP2', 'PRPRTYDSCRP3', 'SALEDATE', 'SALEPRICE', 'RESFLRAREA_AG', 'RESYRBLT', 'BATHS', 'HBATHS', 'BEDRMS', 'LNDVALUEBASE', 'BLDVALUEBASE', 'TOTVALUEBASE', 'PCLASS'];
const FILES = 'https://apps.franklincountyauditor.com/Outside_User_Files';
const TAB = { delimiter: '\t', quoted: true, encoding: 'utf8' };
const DWELLING = ['PARCEL ID', 'CARD', 'RMTOT', 'RMBED', 'FIXBATH', 'FIXHALF', 'STYLE', 'STORIES', 'ATTIC', 'BSMT', 'FINBSMTAREA', 'EXTWALL', 'HEAT', 'WBFP_S', 'WBFP_O', 'CARSPACESATT', 'CARPORTSPACES', 'GRADE', 'WELLSEPTIC', 'YRBLT', 'EFFYR', 'COND', 'SFLA', 'FLR1AREA'];
const CLASS_WORDS = { A: 'Agricultural', C: 'Commercial', E: 'Exempt', I: 'Industrial', R: 'Residential' };
// Deeds and filings that move no home at a price: a plat, a condo filing, an affidavit, a correction, an acreage change, a lease.
const NOT_A_DEED_OF_SALE = new Set(['AF', 'AC', 'AG', 'AH', 'AN', 'AS', 'CB', 'CD', 'CM', 'CT', 'LP', 'LS', 'NE', 'OV', 'PL', 'RW', 'TC', 'XN', '0']);
// One line of a story's width: the Auditor's half-story steps read as the half story.
const STORIES = { 1.1: 1, 1.4: 1.5, 1.6: 1.5, 2.4: 2.5, 2.6: 2.5 };

/** "05 - RANCH" is a code and the Auditor's word. */
const saidBy = (cell) => {
  const text = String(cell ?? '');
  const at = text.indexOf(' - ');
  return at < 0 ? { code: text.trim(), word: '' } : { code: text.slice(0, at).trim(), word: word(text.slice(at + 3)) || '' };
};
const countOf = (cell) => {
  const count = Number(saidBy(cell).code);
  return count > 0 ? count : null;
};
const parcelKey = (id) => String(id ?? '').replace(/\D/g, '');

function useOf(code, unit) {
  const n = Number(code);
  if (n === 510 || n === 511 || n === 512 || n === 513 || n === 591) return unit ? ['unit', 'condo'] : ['property', 'house'];
  if (n === 550 || n === 551 || n === 552 || n === 553 || n === 554) return ['unit', 'condo'];
  if (n === 520 || n === 530 || n === 592) return ['building', 'multi_unit'];
  if (n === 401 || n === 402 || n === 403 || n === 404) return ['building', 'apartment'];
  if (n === 500 || n === 501 || n === 502 || n === 400) return ['parcel', null];
  return ['other', null];
}

const inRange = (value, most) => {
  const count = positive(value);
  return count && count <= most ? count : null;
};

function dwellingFacts(facts, dwelling, kind, lines) {
  put(facts, 'year_built', year(dwelling.YRBLT));
  put(facts, 'effective_year_built', year(dwelling.EFFYR));
  put(facts, 'style', saidBy(dwelling.STYLE).word);
  const story = Number(saidBy(dwelling.STORIES).code);
  put(facts, 'stories', STORIES[story] || (story > 0 ? story : null));
  put(facts, 'exterior_walls', saidBy(dwelling.EXTWALL).word.replace(/\s+\.\d+$/, ''));
  put(facts, 'foundation', /^NONE$/i.test(saidBy(dwelling.BSMT).word) ? null : saidBy(dwelling.BSMT).word);
  put(facts, 'quality', saidBy(dwelling.GRADE).word);
  if (lines > 1) facts.buildings_on_parcel = lines;
  if (kind === 'building') return;
  put(facts, 'living_sqft', positive(dwelling.SFLA));
  put(facts, 'ground_floor_sqft', positive(dwelling.FLR1AREA));
  put(facts, 'rooms', inRange(dwelling.RMTOT, 40));
  put(facts, 'bedrooms', inRange(dwelling.RMBED, 15));
  const [full, half] = [inRange(dwelling.FIXBATH, 15), inRange(dwelling.FIXHALF, 10)];
  put(facts, 'full_baths', full);
  put(facts, 'half_baths', half);
  if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
  put(facts, 'basement_finished_sqft', positive(dwelling.FINBSMTAREA));
  put(facts, 'condition', saidBy(dwelling.COND).word);
  put(facts, 'fireplaces', inRange(dwelling.WBFP_O, 20) || inRange(dwelling.WBFP_S, 20));
  const heat = saidBy(dwelling.HEAT).code;
  if (heat === '1' || heat === '2') facts.heating = 'Yes';
  if (heat === '2') facts.cooling = 'Air conditioning';
  const [attached, carport] = [countOf(dwelling.CARSPACESATT), countOf(dwelling.CARPORTSPACES)];
  if (attached) facts.garage = `${attached} ${attached === 1 ? 'car' : 'cars'}, attached`;
  const types = [attached && 'Attached garage', carport && 'Carport'].filter(Boolean);
  if (types.length) facts.parking_type = types.join(', ');
  if (attached || carport) facts.parking_spaces = (attached || 0) + (carport || 0);
  const well = saidBy(dwelling.WELLSEPTIC).code;
  if (well === '9' || well === '7') facts.water_source = 'Well';
  if (well === '9' || well === '8') facts.sewer = 'Septic';
}

function fromRow(row, files = {}) {
  const line = word(row.SITEADDRESS);
  const address = line ? parse(line, realUnit(word(row.UNIT))) : null;
  const parcel = word(row.PARCELID);
  if (!address || !parcel) return null;
  const [kind, homeType] = useOf(row.CLASSCD, address.unit);
  const facts = { parcel_number: parcel, county: COUNTY, fips: FIPS };
  const home = kind === 'property' || kind === 'unit';
  put(facts, 'address_on_record', line);
  put(facts, 'municipality', word(row.CVTTXDSCRP));
  put(facts, 'school_district', word(row.SCHLDSCRP));
  put(facts, 'neighborhood', word(row.NBHDCD));
  put(facts, 'land_use', word(row.CLASSDSCRP));
  put(facts, 'county_use_code', word(row.CLASSCD));
  put(facts, 'tax_code_area', word(row.CVTTXCD));
  put(facts, 'property_class', CLASS_WORDS[row.PCLASS]);
  const legal = [row.PRPRTYDSCRP, row.PRPRTYDSCRP2, row.PRPRTYDSCRP3].map(word).filter(Boolean).join(' ');
  put(facts, 'legal_description', legal.slice(0, 300));
  put(facts, 'lot_number', lotNumber(legal));
  if (home || kind === 'building') put(facts, 'year_built', year(row.RESYRBLT));
  if ((home || kind === 'building') && files.dwelling) dwellingFacts(facts, files.dwelling.card, kind, files.dwelling.cards);
  if (home && files.outbuildings) {
    const { garage, carport, pool } = files.outbuildings;
    if (garage) {
      facts.garage = facts.garage ? `${facts.garage}, and detached` : 'Detached';
      facts.parking_type = facts.parking_type ? `${facts.parking_type}, Detached garage` : 'Detached garage';
      facts.garage_sqft = garage;
    }
    if (carport) {
      facts.carport_sqft = carport;
      if (!/Carport/.test(facts.parking_type || '')) facts.parking_type = facts.parking_type ? `${facts.parking_type}, Carport` : 'Carport';
    }
    if (pool) facts.pool = 'Yes';
  }
  if (home && !files.dwelling) {
    put(facts, 'living_sqft', positive(row.RESFLRAREA_AG));
    put(facts, 'bedrooms', inRange(row.BEDRMS, 15));
    const [full, half] = [inRange(row.BATHS, 15), inRange(row.HBATHS, 10)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
  }
  if (kind !== 'unit') put(facts, 'lot_acres', positive(row.ACRES));
  put(facts, 'market_value', positive(row.TOTVALUEBASE));
  put(facts, 'market_land_value', positive(row.LNDVALUEBASE));
  put(facts, 'market_building_value', positive(row.BLDVALUEBASE));
  if (files.sales) {
    if (files.sale) {
      facts.sale_price = files.sale.price;
      facts.sale_date = files.sale.date;
    }
  } else if (positive(row.SALEPRICE) > 100) {
    facts.sale_price = positive(row.SALEPRICE);
    put(facts, 'sale_date', isoDate(row.SALEDATE));
  }
  return { id: `pp:${kind}:${FIPS}:${parcel}`, kind, home_type: homeType, address: { ...address, city: '', zip: zipCode(row.ZIPCD) }, facts };
}

/** The newest monthly appraisal folder. Its address has its date in it, so the Auditor's listing says which. */
async function appraisalFiles(work, today) {
  for (const y of [today.getFullYear(), today.getFullYear() - 1]) {
    const page = await fetch(`${FILES}/${y}/`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(120000) });
    if (!page.ok) continue;
    const dates = [...(await page.text()).matchAll(/(\d{4}-\d{2}-\d{2})(?:%20| )Appraisal/g)].map((match) => match[1]).sort();
    if (!dates.length) continue;
    const date = dates[dates.length - 1];
    const zip = path.join(work, 'oh-franklin', `appraisal-${date}.zip`);
    download(`${FILES}/${y}/${date}%20Appraisal/Tab-Delimited.zip`, zip);
    return { zip, date };
  }
  throw new Error('The Auditor no longer lists its monthly appraisal files');
}

async function readFiles(zip) {
  const dwellings = new Map();
  for await (const row of zipTable(zip, 'Dwelling.txt', DWELLING, TAB)) {
    const key = parcelKey(row['PARCEL ID']);
    const held = dwellings.get(key);
    if (!held) dwellings.set(key, { card: row, cards: 1 });
    else {
      held.cards += 1;
      if (Number(row.SFLA) > Number(held.card.SFLA)) held.card = row;
    }
  }
  const outbuildings = new Map();
  for await (const row of zipTable(zip, 'Improvement.txt', ['PARCEL ID', 'CODE', 'AREA'], TAB)) {
    const text = saidBy(row.CODE).word.toUpperCase();
    const garage = /DETACHED .*GARAGE/.test(text);
    const carport = /CARPORT/.test(text);
    const pool = /\bPOOL\b/.test(text);
    if (!garage && !carport && !pool) continue;
    const key = parcelKey(row['PARCEL ID']);
    if (!outbuildings.has(key)) outbuildings.set(key, { garage: 0, carport: 0, pool: false });
    const held = outbuildings.get(key);
    if (garage) held.garage += positive(row.AREA) || 0;
    if (carport) held.carport += positive(row.AREA) || 0;
    if (pool) held.pool = true;
  }
  const sales = new Map();
  for (const member of ['Sales010.txt', 'Sales020-277.txt', 'Sales410-610.txt']) {
    for await (const row of zipTable(zip, member, ['PARCEL ID', 'SALEDT', 'INSTRUMENT', 'VALID', 'SALETYPE', 'PRICE'], TAB)) {
      const [date, price, deed] = [isoDate(row.SALEDT), positive(row.PRICE), saidBy(row.INSTRUMENT)];
      const valid = saidBy(row.VALID).word;
      if (!date || !isHomeSale(price, deed.word, valid) || NOT_A_DEED_OF_SALE.has(deed.code) || /^NON USABLE DEED/.test(valid) || saidBy(row.SALETYPE).code === '1') continue;
      const key = parcelKey(row['PARCEL ID']);
      const held = sales.get(key);
      if (!held || held.date < date) sales.set(key, { date, price });
    }
  }
  log(`${dwellings.size} parcels with dwellings, ${outbuildings.size} with garages, carports or pools, ${sales.size} with a sale of the home`);
  return { dwellings, outbuildings, sales };
}

async function* build({ work, today }) {
  const { zip } = await appraisalFiles(work, today);
  const { dwellings, outbuildings, sales } = await readFiles(zip);
  const records = [];
  const seen = new Set();
  let noAddress = 0;
  for await (const row of cached(path.join(work, 'oh-franklin', 'parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS, { pageSize: 2000 }))) {
    const key = parcelKey(row.LOWPARCELID || row.PARCELID);
    const record = fromRow(row, { dwelling: dwellings.get(key), outbuildings: outbuildings.get(key), sales, sale: sales.get(key) });
    if (!record) noAddress += 1;
    else if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
  }
  log(`${COUNTY}: ${records.length} parcels, ${noAddress} without a street number`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'OH', name: COUNTY, publisher: 'Franklin County Auditor', dataset: 'tax parcels', method: 'county', source: 'oh-franklin', as_of: isoDate(today.getTime()), stale_after_days: 400, records,
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    columns: DWELLING,
    facts: { year_built: 'RESYRBLT', living_sqft: 'RESFLRAREA_AG', bedrooms: 'BEDRMS', full_baths: 'BATHS', half_baths: 'HBATHS', lot_acres: 'ACRES', market_value: 'TOTVALUEBASE', market_land_value: 'LNDVALUEBASE', market_building_value: 'BLDVALUEBASE', sale_price: 'SALEPRICE', sale_date: 'SALEDATE' },
  },
};
