'use strict';
// Harris County, Texas: the Harris Central Appraisal District's public data files, "available to users for import into
// other applications" (its data page). Bedrooms, baths, stories, heat, foundation and walls on every residential building.
// Sale prices aren't public in Texas. The owner column is read only to ask whether the district marked a protected
// person's account (Tax Code 25.025), then dropped: such an account carries no facts. Mailing columns aren't read.

const path = require('node:path');
const { parts } = require('../../../backend/services/propertyRecords/addressKey');
const { download, zipTable } = require('../lib/tables.cjs');
const { year, zipCode, isoDate, realUnit } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { alsoAtOwnLine } = require('../lib/own-line.cjs');
const { log } = require('../lib/log.cjs');

const FIPS = '48201';
const COUNTY = 'Harris County';
const FILES = 'https://download.hcad.org/data/CAMA';
const TAB = { delimiter: '\t', quoted: false };
const PROTECTED = /CONFIDENTIAL|PROTECTED|WITHHELD|SUPPRESS|NOT DISPLAYED|25\.025/i;
const ACCOUNT_COLUMNS = ['acct', 'yr', 'mailto', 'jurs', 'str_pfx', 'str_num', 'str_num_sfx', 'str', 'str_sfx', 'str_sfx_dir', 'str_unit', 'site_addr_1', 'site_addr_2', 'site_addr_3', 'state_class', 'school_dist', 'Neighborhood_Code', 'yr_impr', 'bld_ar', 'land_ar', 'acreage', 'land_val', 'bld_val', 'tot_mkt_val', 'lgl_1', 'certified_date'];
const CATEGORY_WORDS = { A: 'Single-family residence', B: 'Multifamily residence', C: 'Vacant lot', D: 'Rural land', E: 'Farm or ranch improvements', M: 'Mobile home', O: 'Residential inventory' };

// The district's own jurisdiction table names each city "CITY OF ..."; an account's list of jurisdictions says which it's in. Cities
// named some other way aren't read, so no city is ever claimed to be unincorporated land.
async function cityNames(zip) {
  const cities = new Map();
  for await (const row of zipTable(zip, 'desc_r_12_real_jurisdictions.txt', ['Code', 'Description'], TAB)) {
    const name = /^CITY OF (.+)$/.exec(String(row.Description ?? '').trim())?.[1];
    if (name && !/TIRZ|\(/.test(name)) cities.set(row.Code.trim(), name.toLowerCase().replace(/(^|\s)\S/g, (first) => first.toUpperCase()));
  }
  return cities;
}
// "LT 12 BLK 3 ...": one whole platted lot, not a tract of one or several.
const lotOf = (legal) => {
  const text = String(legal ?? '').toUpperCase();
  return /&|\bPT\b|\bTR\b|\bLTS\b/.test(text) ? null : /^LT (\d+[A-Z]?)(?:\s|$)/.exec(text)?.[1] || null;
};

function useOf(code, hasUnit) {
  const c = code.toUpperCase();
  if (c === 'A2' || c.startsWith('M')) return ['property', 'mobile_home'];
  if (c === 'A3' || c === 'A4') return hasUnit ? ['unit', 'condo'] : ['property', 'townhouse'];
  if (c.startsWith('A') || c === 'E' || c === 'E1') return hasUnit ? ['unit', 'condo'] : ['property', 'house'];
  if (c === 'B2' || c === 'B3' || c === 'B4') return ['building', 'multi_unit'];
  if (c.startsWith('B')) return ['building', 'apartment'];
  if (c.startsWith('C') || c.startsWith('D') || c === 'E3' || c === 'E4' || !c) return ['parcel', null];
  return ['other', null];
}

// Which building's facts a home shows: the first, when an account has one. Two or more say only how many.
async function buildingFacts(zip) {
  const buildings = new Map();
  for await (const row of zipTable(zip, 'building_res.txt', ['acct', 'bld_num', 'dscr', 'date_erected', 'eff', 'im_sq_ft', 'gross_ar', 'base_ar'], TAB)) {
    if (!buildings.has(row.acct)) buildings.set(row.acct, { count: 0 });
    const held = buildings.get(row.acct);
    held.count += 1;
    if (held.count === 1) {
      held.number = row.bld_num;
      held.quality = word(row.dscr);
      held.built = year(row.date_erected);
      held.effective = year(row.eff);
      held.living = positive(row.im_sq_ft);
      held.gross = positive(row.gross_ar);
      held.ground = positive(row.base_ar);
    }
  }
  for await (const row of zipTable(zip, 'fixtures.txt', ['acct', 'bld_num', 'type', 'units'], TAB)) {
    const held = buildings.get(row.acct);
    if (!held || held.number !== row.bld_num) continue;
    const units = positive(row.units);
    const type = row.type.trim();
    if (type === 'RMB') held.bedrooms = units;
    else if (type === 'RMF') held.full = units;
    else if (type === 'RMH') held.half = units;
    else if (type === 'RMT') held.rooms = units;
    else if (type === 'STY') held.stories = units;
    else if (type.startsWith('FP')) held.fireplaces = (held.fireplaces || 0) + (units || 0);
  }
  // The building's sketch: an attached garage or carport is part of it.
  for await (const row of zipTable(zip, 'exterior.txt', ['acct', 'bld_num', 'sar_dscr', 'area'], TAB)) {
    const held = buildings.get(row.acct);
    if (!held || held.number !== row.bld_num) continue;
    const part = String(row.sar_dscr ?? '').trim();
    if (/GARAGE/.test(part)) held.garage = (held.garage || 0) + (positive(row.area) || 0);
    else if (/^CARPORT/.test(part)) held.carport = (held.carport || 0) + (positive(row.area) || 0);
  }
  // Features of the account: a detached garage, a carport, a pool.
  for await (const row of zipTable(zip, 'extra_features.txt', ['acct', 'cat', 'l_dscr'], TAB)) {
    const held = buildings.get(row.acct);
    if (!held) continue;
    const text = String(row.l_dscr ?? '');
    if (/Detached Garage/i.test(text)) held.detached = true;
    else if (/^Carport/i.test(text)) held.carportFeature = true;
    else if (String(row.cat).trim() === 'PL' && /pool/i.test(text)) held.pool = true;
  }
  for await (const row of zipTable(zip, 'structural_elem1.txt', ['acct', 'bld_num', 'type_dscr', 'category_dscr'], TAB)) {
    const held = buildings.get(row.acct);
    if (!held || held.number !== row.bld_num) continue;
    const value = word(row.category_dscr);
    const type = String(row.type_dscr ?? '').trim();
    if (type === 'Foundation Type') held.foundation = value;
    else if (type === 'Exterior Wall') held.walls ||= value;
    else if (type === 'Heating / AC') held.heat = value;
    else if (type === 'Physical Condition') held.condition = value;
  }
  return buildings;
}

async function* build({ work, today = new Date() }) {
  const years = [today.getFullYear(), today.getFullYear() - 1];
  const dir = path.join(work, 'tx-harris');
  let found = null;
  for (const taxYear of years) {
    try {
      download(`${FILES}/${taxYear}/Real_acct_owner.zip`, path.join(dir, 'Real_acct_owner.zip'));
      download(`${FILES}/${taxYear}/Real_building_land.zip`, path.join(dir, 'Real_building_land.zip'));
      found = taxYear;
      break;
    } catch (_) {
      log(`No files for ${taxYear} yet`);
    }
  }
  if (!found) throw new Error('The district\'s files weren\'t found');
  download(`${FILES}/${found}/Code_description_real.zip`, path.join(dir, 'Code_description_real.zip'));
  const cities = await cityNames(path.join(dir, 'Code_description_real.zip'));
  const buildings = await buildingFacts(path.join(dir, 'Real_building_land.zip'));
  log(`${buildings.size} accounts with residential buildings`);
  const records = [];
  let noAddress = 0;
  let asOf = null;
  let protectedAccounts = 0;
  for await (const row of zipTable(path.join(dir, 'Real_acct_owner.zip'), 'real_acct.txt', ACCOUNT_COLUMNS, TAB)) {
    const unit = realUnit(row.str_unit);
    const address = parts({ number: row.str_num, numberSuffix: row.str_num_sfx, pre: row.str_pfx, name: row.str, suffix: row.str_sfx, post: row.str_sfx_dir, unit });
    const account = word(row.acct);
    if (!address || !account || Number(row.str_num) === 0) {
      noAddress += 1;
      continue;
    }
    const located = { ...address, city: String(word(row.site_addr_2) || '').toUpperCase(), zip: zipCode(row.site_addr_3) };
    const certified = isoDate(row.certified_date);
    if (certified && (!asOf || certified > asOf)) asOf = certified;
    if (PROTECTED.test(row.mailto || '')) {
      protectedAccounts += 1;
      records.push({ id: `pp:property:${FIPS}:${account}`, kind: 'property', home_type: null, address: located, facts: {}, restricted: true });
      continue;
    }
    const code = String(row.state_class ?? '').trim();
    const [kind, homeType] = useOf(code, address.unit);
    const facts = { parcel_number: account, county: COUNTY, fips: FIPS };
    const on = kind === 'property' || kind === 'unit' || kind === 'building';
    const home = kind === 'property' || kind === 'unit';
    const held = buildings.get(row.acct);
    put(facts, 'address_on_record', word(row.site_addr_1));
    put(facts, 'year_built', on ? (held?.built || year(row.yr_impr)) : null);
    if (held && on) {
      put(facts, 'effective_year_built', held.effective);
      put(facts, 'stories', held.stories);
      put(facts, 'quality', held.quality);
      put(facts, 'foundation', held.foundation);
      put(facts, 'exterior_walls', held.walls);
      if (held.count > 1) facts.buildings_on_parcel = held.count;
    }
    if (held && home && held.count === 1) {
      put(facts, 'living_sqft', held.living);
      put(facts, 'gross_sqft', held.gross);
      put(facts, 'ground_floor_sqft', held.ground);
      put(facts, 'rooms', held.rooms);
      put(facts, 'bedrooms', held.bedrooms);
      put(facts, 'full_baths', held.full);
      put(facts, 'half_baths', held.half);
      if (held.full || held.half) facts.bathrooms = (held.full || 0) + (held.half || 0) * 0.5;
      put(facts, 'fireplaces', held.fireplaces);
      put(facts, 'condition', held.condition);
      // "Central Heat/AC", "Central Heat", "A/C Only".
      if (/Heat/.test(held.heat || '')) facts.heating = 'Central heat';
      if (/AC|A\/C/.test(held.heat || '')) facts.cooling = 'Central air';
      put(facts, 'garage_sqft', held.garage);
      put(facts, 'carport_sqft', held.carport);
      const garages = [held.garage && 'Attached', held.detached && 'Detached'].filter(Boolean);
      if (garages.length) facts.garage = garages.join(', ');
      const parking = [held.garage && 'Attached garage', held.detached && 'Detached garage', (held.carport || held.carportFeature) && 'Carport'].filter(Boolean);
      if (parking.length) facts.parking_type = parking.join(', ');
      if (held.pool) facts.pool = 'Yes';
    } else if (home) put(facts, 'living_sqft', positive(row.bld_ar));
    if (kind !== 'unit') {
      put(facts, 'lot_sqft', positive(row.land_ar));
      put(facts, 'lot_acres', positive(row.acreage));
    }
    put(facts, 'neighborhood', word(row.Neighborhood_Code));
    put(facts, 'land_use', CATEGORY_WORDS[code.charAt(0).toUpperCase()] || null);
    put(facts, 'county_use_code', word(code));
    put(facts, 'legal_description', word(row.lgl_1)?.slice(0, 300));
    put(facts, 'lot_number', lotOf(row.lgl_1));
    put(facts, 'municipality', String(row.jurs ?? '').trim().split(/\s+/).map((code) => cities.get(code)).find(Boolean));
    put(facts, 'value_year', positive(row.yr));
    put(facts, 'market_value', positive(row.tot_mkt_val));
    put(facts, 'market_land_value', positive(row.land_val));
    put(facts, 'market_building_value', positive(row.bld_val));
    records.push({ id: `pp:${kind}:${FIPS}:${account}`, kind, home_type: homeType, address: located, facts });
  }
  // The account's address line and its street columns disagree on some homes: each is found at both.
  const twins = alsoAtOwnLine(records);
  records.push(...twins);
  log(`${COUNTY}: ${records.length} accounts, ${noAddress} without a street number, ${protectedAccounts} protected, ${twins.length} also filed at their own address line`);
  for (const building of condoBuildings(records, { fips: FIPS, county: COUNTY })) records.push(building);
  yield {
    fips: FIPS, state: 'TX', name: COUNTY, publisher: 'Harris Central Appraisal District', dataset: `${found} public data files`, method: 'county', source: 'tx-harris', as_of: asOf || `${found}-11-01`, stale_after_days: 450, records,
  };
}

module.exports = { build };
