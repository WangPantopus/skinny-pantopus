#!/usr/bin/env node
// The part of a county's check only a person can do (T3's second half): opening the county's own lookup page, which many
// counties forbid scripts to read. Writes a private page: about ten homes per property type, picked so every word the
// county uses shows up at least once, with what we would show next to each home's account number. The person marks each
// row right or wrong and copies the result back. Real homes: the page stays out of Git, in ~/.config/pantopus/provider-truth.
//   node backend/scripts/eval/property-hand-check-sheet.js --county 53011 --out <build dir> --lookup <county page url> [--per-type 10]
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { openRelease } = require('./lib/propertyRelease');
const { FACTS } = require('../../services/propertyRecords/facts');

const opt = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const fips = opt('--county');
const lookup = opt('--lookup', '');
const perType = Number(opt('--per-type', '10'));
const release = openRelease(opt('--out'), fips);
const WORD_FACTS = Object.keys(FACTS).filter((name) => FACTS[name].format === 'text');
const SKIP = new Set(['county', 'fips', 'value_history', 'tax_history', 'exemptions', 'address_on_record', 'legal_description', 'parcel_number', 'tax_code_area', 'county_use_code', 'market_land_value', 'market_building_value', 'value_year', 'tax_year', 'sale_document', 'property_class', 'buildings_on_parcel', 'effective_year_built']);

const groups = new Map();
for (const record of release.records()) {
  // A home with its building facts: Florida's roll has no bedrooms.
  if (!['property', 'unit'].includes(record.kind) || !(record.facts.bedrooms || record.facts.year_built)) continue;
  if (!groups.has(record.home_type)) groups.set(record.home_type, []);
  groups.get(record.home_type).push(record);
}

// Greedy: the home showing the most words not yet covered, until they run out or the type's share is used.
function pick(records) {
  const seen = new Set();
  const chosen = [];
  const words = (record) => WORD_FACTS.flatMap((name) => (record.facts[name] ? [`${name}:${record.facts[name]}`] : []));
  const pool = records.length > 20000 ? records.filter((_, i) => i % Math.ceil(records.length / 20000) === 0) : records;
  while (chosen.length < perType) {
    let best = null;
    let bestNew = -1;
    for (const record of pool) {
      if (chosen.includes(record)) continue;
      const fresh = words(record).filter((word) => !seen.has(word)).length;
      if (fresh > bestNew) { best = record; bestNew = fresh; }
    }
    if (!best) break;
    words(best).forEach((word) => seen.add(word));
    chosen.push(best);
  }
  return chosen;
}

const esc = (value) => String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let rowId = 0;
const sections = [...groups].map(([type, records]) => {
  const homes = pick(records).map((record, i) => {
    const rows = Object.entries(record.facts).filter(([name]) => FACTS[name]?.label && !SKIP.has(name)).map(([name, value]) => {
      rowId += 1;
      return `<tr><td>${esc(FACTS[name].label)}</td><td><b>${esc(value)}</b></td><td><label><input type=checkbox class=wrong data-row="${type}-${i + 1}/${name}"> wrong</label></td></tr>`;
    }).join('');
    return `<h3>${esc(type)} ${i + 1}: account ${esc(record.facts.parcel_number)}${lookup ? ` <a target=_blank href="${esc(lookup)}">open the county's page</a>` : ''}</h3><p>${esc(record.facts.address_on_record || '')} <label><input type=checkbox class=done> I checked this home</label></p><table>${rows}</table>`;
  }).join('');
  return `<h2>${esc(type)}</h2>${homes}`;
}).join('');

const file = path.join(os.homedir(), '.config/pantopus/provider-truth/t3', `${fips}-hand-check.html`);
fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
fs.writeFileSync(file, `<!doctype html><meta charset=utf-8><title>County check ${fips}</title><style>body{font:15px system-ui;max-width:760px;margin:24px auto;padding:0 16px}td{padding:3px 10px 3px 0;vertical-align:top}table{margin-bottom:8px}#out{width:100%;height:90px}</style>
<h1>${esc(release.county.name)}: check by hand</h1><p>${esc(release.county.publisher)}, ${esc(release.county.as_of)}. For each home, open the county's page and search the account number. Tick \"wrong\" only on a row that doesn't match, then tick \"I checked this home\". A row the page doesn't show is fine: leave it. About 30 seconds a home. When you're done, press the button and paste the result in the chat: it holds no addresses.</p>${sections}
<p><button onclick="const w=[...document.querySelectorAll('input.wrong:checked')].map(i=>i.dataset.row);document.getElementById('out').value='checked '+document.querySelectorAll('input.done:checked').length+' homes; '+w.length+' rows wrong\\n'+w.join('\\n')">Make the result</button></p><textarea id=out></textarea>`, { mode: 0o600 });
console.log(`${rowId} rows across ${[...groups.keys()].length} property types: ${file}`);
