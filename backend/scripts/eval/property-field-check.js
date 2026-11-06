#!/usr/bin/env node
// Field accuracy by machine (T3's first half): every home in a county's release against what the same county publishes
// separately for machines. It proves the build read, joined and scaled each field right; the county is still the
// standard, so whether the county is right is another question. County lookup pages are never scripted: many forbid it,
// and a person checks those by hand (property-hand-check-sheet.js). Prints counts only.
//   node backend/scripts/eval/property-field-check.js --county 53011 --out <build dir> --work <downloads>
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');
const { openRelease, dallasRoll } = require('./lib/propertyRelease');
const { zipTable } = require('../../../scripts/property-index/lib/tables.cjs');
const { parts } = require('../../services/propertyRecords/addressKey');

const opt = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const out = opt('--out');
const work = opt('--work');
const county = opt('--county');

const near = (a, b, tolerance = 0.5) => Math.abs(Number(a) - Number(b)) <= tolerance;
const tally = {};
function compare(field, ours, theirs, same = near) {
  const row = (tally[field] ||= { compared: 0, equal: 0, differ: 0, oursOnly: 0, theirsOnly: 0 });
  const hasOurs = ours !== undefined && ours !== null && ours !== '';
  const hasTheirs = theirs !== undefined && theirs !== null && theirs !== '' && theirs !== 0;
  if (hasOurs && hasTheirs) {
    row.compared += 1;
    if (same(ours, theirs)) row.equal += 1;
    else row.differ += 1;
  } else if (hasOurs) row.oursOnly += 1;
  else if (hasTheirs) row.theirsOnly += 1;
}

function print() {
  console.log(`${'field'.padEnd(28)}${'compared'.padStart(10)}${'equal'.padStart(10)}${'differ'.padStart(9)}${'equal %'.padStart(9)}${'ours only'.padStart(11)}${'theirs only'.padStart(13)}`);
  for (const [field, row] of Object.entries(tally)) {
    const share = row.compared ? ((100 * row.equal) / row.compared).toFixed(2) : '-';
    console.log(`${field.padEnd(28)}${String(row.compared).padStart(10)}${String(row.equal).padStart(10)}${String(row.differ).padStart(9)}${share.padStart(9)}${String(row.oursOnly).padStart(11)}${String(row.theirsOnly).padStart(13)}`);
  }
}

// Clark: the county's public taxlot layer, and the three tables in its file that say bedrooms and baths.
async function clark(release) {
  const byId = new Map();
  for (const record of release.records()) {
    if (record.kind !== 'building') byId.set(record.facts.parcel_number, record);
  }
  const dir = path.join(work, 'wa-clark');
  for await (const line of readline.createInterface({ input: fs.createReadStream(path.join(dir, 'taxlots.jsonl')), crlfDelay: Infinity })) {
    const row = JSON.parse(line);
    const record = byId.get(String(row.Prop_id));
    if (!record) continue;
    const { facts } = record;
    compare('year_built', facts.year_built, row.BldgYrBlt);
    compare('living_sqft', facts.living_sqft, row.BldgSqft);
    compare('lot_sqft', facts.lot_sqft, row.AssrSqFt);
    compare('lot_acres', facts.lot_acres, row.AssrAc, (a, b) => near(a, b, 0.01));
    compare('market_value', facts.market_value, row.MktTotVal);
    compare('market_land_value', facts.market_land_value, row.MktLandVal);
    compare('market_building_value', facts.market_building_value, row.MktBldgVal);
    compare('taxable_value', facts.taxable_value, row.TaxTotVal);
    compare('sale_price', facts.sale_price, row.SaleAmount);
    if (row.SaleDate) compare('sale_date', facts.sale_date, new Date(row.SaleDate).toISOString().slice(0, 10), (a, b) => a === b);
  }
  const zip = path.join(dir, 'PACS_OpenData.zip');
  const table = { delimiter: '|', quoted: false };
  const beds = new Map();
  for await (const row of zipTable(zip, 'PropImpDetailAttrVw.txt', ['prop_id', 'ImpAttr', 'ImpAttrVal'], table)) {
    if (row.ImpAttr === 'Number of Bedrooms' || row.ImpAttr === 'FULL BATH' || row.ImpAttr === '1/2 BATH') {
      const key = `${row.prop_id}|${row.ImpAttr}`;
      beds.set(key, (beds.get(key) || 0) + Number(row.ImpAttrVal || 0));
    }
  }
  for (const [id, record] of byId) {
    compare('bedrooms (attribute table)', record.facts.bedrooms, beds.get(`${id}|Number of Bedrooms`));
    compare('full_baths (attribute table)', record.facts.full_baths, beds.get(`${id}|FULL BATH`));
    compare('half_baths (attribute table)', record.facts.half_baths, beds.get(`${id}|1/2 BATH`));
  }
}

// Dallas: the district's certified appraisal roll, published apart from the tables the release reads. The roll is July's
// and the tables carry changes since, so a small share differs for that reason. It has no bedrooms, baths or year built:
// those are for the person's check.
async function dallas(release) {
  const byAccount = new Map();
  for (const record of release.records()) {
    if (record.kind !== 'building') byAccount.set(record.id.split(':').pop(), record);
  }
  const seen = new Set();
  const marked = { 'not in the release': 0, 'no facts in the release': 0, 'FACTS IN THE RELEASE': 0 };
  const exact = (a, b) => a === b;
  for await (const row of dallasRoll(path.join(work, 'tx-dallas', 'roll.zip'))) {
    if (seen.has(row.account)) continue;
    seen.add(row.account);
    const record = byAccount.get(row.account);
    if (row.privacy === 'Y') {
      if (!record) marked['not in the release'] += 1;
      else marked[record.restricted ? 'no facts in the release' : 'FACTS IN THE RELEASE'] += 1;
    }
    if (!record || record.restricted) continue;
    const { facts, address } = record;
    compare('market_value', facts.market_value, Number(row.market));
    compare('market_land_value', facts.market_land_value, Number(row.land));
    compare('market_building_value', facts.market_building_value, Number(row.improvement));
    compare('taxable_value', facts.taxable_value, Number(row.taxable));
    compare('lot, acres', facts.lot_acres ?? (facts.lot_sqft ? facts.lot_sqft / 43560 : null), Number(row.acres) / 1000, (a, b) => near(a, b, 0.01));
    compare('county_use_code', facts.county_use_code, row.use, exact);
    const theirs = parts({ number: row.number.replace(/^0+/, ''), pre: row.direction, name: row.name, suffix: row.suffix, unit: row.suite });
    compare('house number', address.number, theirs?.number, exact);
    compare('street name', address.name, theirs?.name, exact);
    compare('street direction', address.pre, theirs?.pre, exact);
    compare('street type', address.suffix, theirs?.suffix, exact);
    compare('unit', address.unit, theirs?.unit, exact);
  }
  console.log(`Accounts the roll marks private: ${JSON.stringify(marked)}`);
}

// Florida: the Department of Revenue's sales file, published apart from its tax roll. The Department's other columns have
// no free second publication (Miami-Dade sells its files; Lee, Polk and others forbid or block scripts), so they are for
// the person's check. --sales <zip> is the county's SDF file.
async function florida(release) {
  const byParcel = new Map();
  for (const record of release.records()) {
    if (record.kind !== 'building') byParcel.set(record.facts.parcel_number, record);
  }
  const latest = new Map();
  const zip = opt('--sales');
  const member = execFileSync('unzip', ['-Z1', zip], { encoding: 'latin1' }).trim().split('\n')[0];
  for await (const row of zipTable(zip, member, ['PARCEL_ID', 'SALE_YR', 'SALE_MO', 'SALE_PRC', 'DOR_UC'])) {
    if (!byParcel.has(row.PARCEL_ID)) continue;
    const when = Number(row.SALE_YR) * 100 + Number(row.SALE_MO);
    const held = latest.get(row.PARCEL_ID);
    // The latest sale with a price, as the roll's first sale columns are.
    if (Number(row.SALE_PRC) > 100 && (!held || when > held.when)) latest.set(row.PARCEL_ID, { when, price: Number(row.SALE_PRC), year: row.SALE_YR, month: Number(row.SALE_MO) });
  }
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (const [parcel, record] of byParcel) {
    const sale = latest.get(parcel);
    compare('sale_price', record.facts.sale_price, sale?.price);
    compare('sale_month', record.facts.sale_month, sale ? `${MONTHS[sale.month - 1]} ${sale.year}` : null, (a, b) => a === b);
  }
}

const CHECKS = { 53011: clark, 48113: dallas };
const checkFor = (fips) => CHECKS[fips] || (String(fips).startsWith('12') ? florida : null);

(async () => {
  if (!out || !checkFor(county)) throw new Error('usage: --county <fips of Clark, Dallas or a Florida county> --out <build dir> [--work <downloads>] [--sales <Florida SDF zip>]');
  await checkFor(county)(openRelease(out, county));
  print();
})().catch((err) => {
  console.error(err.constructor === Error ? err.message : err.name);
  process.exit(1);
});
