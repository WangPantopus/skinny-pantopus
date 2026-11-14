'use strict';
// One Texas appraisal district's PACS export, read the same way for every district. A district names its download page and
// says which attributes hold bedrooms and baths; a Plumbing attribute is baths in some districts and fixtures in others, so
// it is never assumed. Sale prices aren't public in Texas. Lines are cut by lib/pacs.cjs: owner, mailing and exemption
// columns are never read, and a protected person's account (Tax Code 25.025) carries no facts.

const path = require('node:path');
const { download, USER_AGENT } = require('./tables.cjs');
const { streetParts, situsParts, year, realUnit, zipCode, onRecord } = require('./addresses.cjs');
const { positive, put, word } = require('./values.cjs');
const { properties, mainImprovements, codes, exportDate } = require('./pacs.cjs');
const { CATEGORY_WORDS, useOf } = require('./texas.cjs');
const { zipsByCounty } = require('./zcta.cjs');
const { condoBuildings } = require('./condos.cjs');
const { log } = require('./log.cjs');

const NOT_LIVING = /COMMERCIAL|OFFICE|PORCH|DECK|BARN|STORAGE|CANOPY|PATIO|FOR MH|APPEND|SPACE|SOLAR|WIND|ADD ON|ADDITIVE|BASEMENT|TRAILER|PARK MODEL|OVER MH|POOL|\bPAD\b/;
const FLOORS = [[/2ND|SECOND/, 'floor2'], [/3RD|THIRD/, 'floor3'], [/4TH|FOURTH/, 'floor4'], [/5TH|FIFTH/, 'floor5'], [/HALF|1 1\/2|^1\/2/, 'floor1.5']];

// What a detail is, from the district's own words for it. Words vary by district; codes vary more.
function detailKind(code, words) {
  const w = words.toUpperCase();
  if (/GARAGE|\bGAR\b/.test(w) && !/APART|LIVING/.test(w)) return 'garage';
  if (/CARPORT/.test(w)) return 'carport';
  if (/SWIMMING POOL|GUNITE POOL|^POOL\b/.test(w)) return 'pool';
  if (NOT_LIVING.test(w)) return null;
  if (/ADDITION|^ADDN?\b/.test(w)) return 'floor';
  if (/^(MOBILE HOMES?|STANDARD M HOME|DOUBLE-WIDE M HOME|TRIPLE-WIDE M HOME)\b/.test(w)) return 'floor1';
  if (/MAIN AREA|LIVING AREA|LIVING QUARTERS|STORY MAIN|^(2ND|SECOND) (FLOOR|STORY)|^1\/2 STORY/.test(w)) {
    return FLOORS.find(([words2]) => words2.test(w))?.[1] || 'floor1';
  }
  return null;
}

// A district's own state codes win over the Comptroller's categories: A3 is a condo in one district and a shed in the next.
const USES = {
  house: (unit) => (unit ? ['unit', 'condo'] : ['property', 'house']),
  condo: (unit) => (unit ? ['unit', 'condo'] : ['property', 'townhouse']),
  mobile_home: () => ['property', 'mobile_home'],
  multi_unit: () => ['building', 'multi_unit'],
  apartment: () => ['building', 'apartment'],
  parcel: () => ['parcel', null],
  other: () => ['other', null],
};

const whole = (text, most) => {
  const value = Number(text);
  return Number.isInteger(value) && value > 0 && value <= most ? value : null;
};
// A home's baths as the facts a record keeps, or null. "2", "2.5", "2.50" or "2 1/2" (Grayson writes "2 1/2 Bath" and
// "2 Bath No") is a total, which doesn't say its full and half baths (two full and two half baths is 3), so it gives the
// total only (lib/fill.cjs bathFacts). Brazos writes "2/1" for two full baths and a half: that says both.
function bathsIn(text) {
  const pair = /^(\d+)\/([01])$/.exec(text || '');
  if (pair) {
    const [full, half] = [Number(pair[1]), Number(pair[2])];
    return full > 0 && full <= 12 ? { bathrooms: full + half / 2, full_baths: full, ...(half ? { half_baths: half } : {}) } : null;
  }
  const match = /^(\d+)(?:\.(\d+)| 1\/2)?(?:\s+BATH.*)?$/i.exec(text || '');
  if (!match) return null;
  const half = / 1\/2/.test(text) || (match[2] && Number(`0.${match[2]}`) === 0.5);
  if (match[2] && !half && Number(match[2]) !== 0) return null;
  const baths = Number(match[1]) + (half ? 0.5 : 0);
  return baths > 0 && baths <= 12 ? { bathrooms: baths } : null;
}

function firstOf(imp, names) {
  for (const name of names) if (imp[name]) return imp[name];
  return null;
}

async function newestFile(page, pattern) {
  const response = await fetch(page, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`The district's download page answered ${response.status}`);
  const html = await response.text();
  const found = [...html.matchAll(new RegExp(pattern, 'gi'))].map((match) => match[1]);
  if (!found.length) throw new Error('The district\'s download page no longer lists its export');
  const yearOf = (url) => Number(/(20\d\d)/.exec(url.split('/').pop())?.[1] || /(20\d\d)/.exec(url)?.[1] || 0);
  const newest = found.reduce((best, url) => (yearOf(url) > yearOf(best) ? url : best));
  return new URL(newest, page).href;
}

function pacsCounty({ fips, county, publisher, source, page, pattern, bedrooms = [], baths = [], uses = {}, dataset = 'certified appraisal export' }) {
  const attributes = [...new Set([...bedrooms, ...baths, 'Fireplaces'])];

  function fromProperty(row, imp, words) {
    const typed = situsParts({ number: row.number, street: row.street, suffix: row.suffix, unit: realUnit(row.unit) });
    const address = streetParts({ number: typed.number, pre: row.pre, name: typed.street, suffix: typed.suffix, unit: typed.unit });
    const account = row.partial && row.group ? row.group : row.id;
    if (!address) return null;
    const [kind, homeType] = uses[row.state] ? USES[uses[row.state]](address.unit) : useOf(row.state, address.unit, Boolean(imp?.area));
    const facts = { parcel_number: account, county, fips };
    const home = kind === 'property' || kind === 'unit';
    put(facts, 'address_on_record', onRecord([row.number, row.pre, row.street, row.suffix].filter(Boolean).join(' '), row.unit));
    put(facts, 'land_use', word(words.get(row.state)) || CATEGORY_WORDS[row.state[0]]);
    put(facts, 'county_use_code', word(row.state));
    put(facts, 'legal_description', word(row.legal)?.slice(0, 300));
    if (imp && (home || kind === 'building')) put(facts, 'year_built', year(imp.built));
    if (imp && home) {
      put(facts, 'living_sqft', positive(imp.area));
      put(facts, 'bedrooms', whole(firstOf(imp, bedrooms), 15));
      Object.assign(facts, bathsIn(firstOf(imp, baths)));
      put(facts, 'garage_sqft', positive(imp.garage));
      put(facts, 'carport_sqft', positive(imp.carport));
      if (imp.pool) facts.pool = 'Yes';
      if (kind === 'property') put(facts, 'stories', Math.max(...[...imp.floors].map(Number), 0) || null);
    }
    if (imp && kind === 'building') put(facts, 'gross_sqft', positive(imp.area));
    if (kind !== 'unit') put(facts, 'lot_acres', positive(row.acres));
    if (!row.partial) {
      put(facts, 'value_year', positive(row.year));
      put(facts, 'market_value', positive(row.market));
      put(facts, 'market_land_value', positive(row.land));
      put(facts, 'market_building_value', positive(row.building));
    }
    return { id: `pp:${kind}:${fips}:${account}`, kind, home_type: homeType, address: { ...address, city: String(word(row.city) || '').toUpperCase(), zip: zipCode(row.zip) }, facts };
  }

  async function* build({ work }) {
    const url = await newestFile(page, pattern);
    const zip = path.join(work, source, path.basename(new URL(url).pathname));
    download(url, zip);
    const asOf = await exportDate(zip);
    const words = await codes(zip, 'STATE_CD');
    const stats = {};
    const rows = [];
    for await (const row of properties(zip, stats)) rows.push(row);
    log(`${rows.length} real and mobile home accounts, ${stats.protected || 0} protected, ${stats.broken || 0} broken lines`);
    const main = await mainImprovements(zip, new Set(rows.map((row) => row.id)), detailKind, attributes);
    log(`${main.size} accounts with improvements`);
    const records = new Map();
    let noAddress = 0;
    for (const row of rows) {
      const record = fromProperty(row, main.get(row.id), words);
      if (!record) noAddress += 1;
      else if (!records.has(record.id)) records.set(record.id, record);
    }
    const list = [...records.values()];
    log(`${county}: ${list.length} accounts, ${noAddress} without a street number`);
    for (const building of condoBuildings(list, { fips, county })) list.push(building);
    yield {
      fips, state: 'TX', name: county, publisher, dataset, method: 'county', source, as_of: asOf, stale_after_days: 450, extra_zips: zipsByCounty(work, ['48']).get(fips) || [], records: list,
    };
  }

  return {
    build,
    dictionary: {
      columns: ['prop_id', 'yr_built', 'imprv_det_area', 'Main Area', 'Garage', 'Carport', ...bedrooms, ...baths, 'land_acres', 'market_value', 'land_value', 'improvement_value', 'value_year', 'state_cd'],
      facts: { year_built: 'yr_built', living_sqft: 'imprv_det_area', gross_sqft: 'imprv_det_area', garage_sqft: 'Garage', carport_sqft: 'Carport', ...(bedrooms[0] ? { bedrooms: bedrooms[0] } : {}), ...(baths[0] ? { bathrooms: baths[0], full_baths: baths[0], half_baths: baths[0] } : {}), lot_acres: 'land_acres', market_value: 'market_value', market_land_value: 'land_value', market_building_value: 'improvement_value', value_year: 'value_year' },
    },
  };
}

module.exports = { pacsCounty, detailKind, bathsIn, newestFile, USES, whole };
