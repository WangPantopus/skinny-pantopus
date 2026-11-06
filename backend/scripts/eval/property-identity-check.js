#!/usr/bin/env node
// Identity by machine (T2 on one county): what the identity contract answers on the county's own address text, on its
// neighbors, on units that don't exist, on rental buildings and on addresses with several records. The truth is the
// Assessor's own address text, a different publication from the map layer the release reads addresses from. Generated
// units never leave this script and never reach Google. Prints counts only.
//   node backend/scripts/eval/property-identity-check.js --county 53011 --out <build dir> --work <downloads>
'use strict';

const path = require('path');
const { openRelease } = require('./lib/propertyRelease');
const { zipTable } = require('../../../scripts/property-index/lib/tables.cjs');
const { parts, sortKey, zip5 } = require('../../services/propertyRecords/addressKey');
const { resolve } = require('../../services/propertyRecords/identity');

const opt = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const release = openRelease(opt('--out'), opt('--county'));

const counts = {};
const bump = (part, outcome) => {
  counts[part] ||= {};
  counts[part][outcome] = (counts[part][outcome] || 0) + 1;
};
const ask = (query) => resolve(query, release.at(sortKey(query)));
const label = (answer) => `${answer.match}${answer.reason ? ` (${answer.reason})` : ''}`;

const byId = new Map();
const buildings = [];
const units = [];
for (const record of release.records()) {
  if (record.kind === 'building') buildings.push(record);
  else if (!record.restricted) byId.set(record.facts.parcel_number, record);
  if (record.kind === 'unit' && record.address.unit && !record.restricted) units.push(record);
}

async function clarkPositives() {
  // Each account by the Assessor's own text: "<num> <dir> <street> <type> <unit?> <city>, <ST> <zip>".
  const zip = path.join(opt('--work'), 'wa-clark', 'PACS_OpenData.zip');
  for await (const row of zipTable(zip, 'PropAbstractVw.txt', ['Prop_ID', 'Status', 'AcctTypeCode', 'Situs_PACS', 'SitusCity', 'SitusZip', 'SitusNum', 'SitusStPre', 'SitusSt', 'SitusSuf'], { delimiter: '|', quoted: false })) {
    if (row.Status !== 'Active' || !['R', 'MH'].includes(row.AcctTypeCode) || !row.Situs_PACS) continue;
    const record = byId.get(row.Prop_ID);
    if (!record || !['property', 'unit'].includes(record.kind)) continue;
    const head = row.Situs_PACS.split(',')[0].replace(/\s+/g, ' ').trim();
    const street = [row.SitusNum, row.SitusStPre, row.SitusSt, row.SitusSuf].filter(Boolean).join(' ');
    let unit = head.startsWith(street) ? head.slice(street.length).trim() : '';
    if (row.SitusCity && unit.endsWith(row.SitusCity)) unit = unit.slice(0, -row.SitusCity.length).trim();
    const query = parts({ number: row.SitusNum, pre: row.SitusStPre, name: row.SitusSt, suffix: row.SitusSuf, unit });
    if (!query) continue;
    const answer = ask({ ...query, zip: zip5(row.SitusZip) || record.address.zip });
    const part = `Positives: ${record.kind}`;
    if (answer.match !== 'exact') bump(part, label(answer));
    else if (answer.record.facts.parcel_number === row.Prop_ID) bump(part, 'exact, right account');
    else bump(part, 'EXACT, WRONG ACCOUNT');
  }
}

function controls() {
  // Neighbors: each condo unit by its own number must be that unit, not the one next door.
  for (const unit of units) {
    const answer = ask({ ...unit.address, building: unit.address.building || '' });
    bump('Adjacent units', answer.match === 'exact' && answer.record.id === unit.id ? 'exact, this unit' : (answer.match === 'exact' ? 'EXACT, WRONG UNIT' : label(answer)));
  }
  // Units that don't exist, one case per building: they must not match any unit.
  const seen = new Set();
  for (const building of buildings) {
    if (seen.has(building.id) || !(building.roster || []).length) continue;
    seen.add(building.id);
    const answer = ask({ ...building.address, unit: 'ZZ9999', building: '' });
    bump('Units that do not exist', answer.match === 'exact' ? 'EXACT, WRONG UNIT' : label(answer));
    const listed = ask({ ...building.address, unit: building.roster[0], building: '' });
    if (building.home_type === 'apartment') bump('Rental buildings, listed unit', label(listed));
  }
  // Addresses holding several homes: never an exact answer.
  const homesAtKey = new Map();
  for (const record of byId.values()) {
    if (record.kind !== 'property' || record.address.unit) continue;
    const key = `${record.key}|${record.address.pre}|${record.address.suffix}|${record.address.post}|${record.address.zip}`;
    homesAtKey.set(key, [...(homesAtKey.get(key) || []), record]);
  }
  for (const homes of homesAtKey.values()) {
    if (homes.length < 2) continue;
    const answer = ask({ ...homes[0].address, unit: '', building: '' });
    bump('Addresses with several homes', answer.match === 'exact' ? 'EXACT (PICKED ONE)' : label(answer));
  }
}

const POSITIVES = { 53011: clarkPositives };

(async () => {
  await POSITIVES[opt('--county')]?.();
  controls();
  for (const [part, outcomes] of Object.entries(counts)) {
    const total = Object.values(outcomes).reduce((sum, n) => sum + n, 0);
    console.log(`${part}: ${total}`);
    for (const [outcome, n] of Object.entries(outcomes).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(8)}  ${((100 * n) / total).toFixed(2).padStart(6)}%  ${outcome}`);
  }
})().catch((err) => {
  console.error(err.constructor === Error ? err.message : err.name);
  process.exit(1);
});
