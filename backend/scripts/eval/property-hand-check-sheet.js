#!/usr/bin/env node
// The part of a county's check only a person can do (T3's second half): opening the county's own lookup page, which many
// counties forbid scripts to read. Writes a private page: about ten homes per property type, picked so every word the
// county uses shows up at least once, with what we would show next to each home's account number. The person marks each
// row right or wrong and copies the result back. Real homes: the page stays out of Git, in ~/.config/pantopus/provider-truth.
//   node backend/scripts/eval/property-hand-check-sheet.js --county 53011 --out <build dir> --lookup <county page url> [--per-type 10]
//     --codes <PACS zip>  Clark only: also collects the words for its wall, roof, heat, foundation and flooring codes. It publishes no
//                         code list, so the sheet names one or two homes per code and a box for the word the county's page shows.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { openRelease } = require('./lib/propertyRelease');
const { FACTS } = require('../../services/propertyRecords/facts');
const { zipTable } = require('../../../scripts/property-index/lib/tables.cjs');
const { CODE_WORDS } = require('../../../scripts/property-index/sources/wa-clark.cjs');

const opt = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const fips = opt('--county');
const lookup = opt('--lookup', '');
const perType = Number(opt('--per-type', '10'));
const release = openRelease(opt('--out'), fips);
const WORD_FACTS = Object.keys(FACTS).filter((name) => FACTS[name].format === 'text');
const SKIP = new Set(['county', 'fips', 'value_history', 'tax_history', 'exemptions', 'address_on_record', 'legal_description', 'parcel_number', 'tax_code_area', 'county_use_code', 'market_land_value', 'market_building_value', 'value_year', 'tax_year', 'sale_document', 'property_class', 'buildings_on_parcel', 'effective_year_built']);

const groups = new Map();
for (const record of release.records()) {
  // A home with something to check: Florida's roll has no bedrooms, and Montana's and Maine's files hold little but values.
  if (!['property', 'unit'].includes(record.kind) || !(record.facts.bedrooms || record.facts.year_built || record.facts.market_value || record.facts.assessed_value)) continue;
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

// What each of the county's codes means, by hand: a word from its own page, never a guess.
const CODE_ATTRIBUTES = new Map([['Roof Covering', ['roof_cover', 'Roof cover']], ['Exterior Wall', ['exterior_walls', 'Exterior walls']], ['HEAT TYPE', ['heating', 'Heating']], ['Foundation', ['foundation', 'Foundation']], ['Flooring', ['flooring', 'Flooring']]]);
const CODES_IN_REAL_USE = 10;
async function codeTable(zip) {
  const homes = new Map();
  for (const record of release.records()) if (['property', 'unit'].includes(record.kind) && !record.restricted) homes.set(record.facts.parcel_number, record);
  const codes = new Map();
  for await (const row of zipTable(zip, 'PropImpDetailAttrVw.txt', ['prop_id', 'ImpAttr', 'ImpAttrVal'], { delimiter: '|', quoted: false })) {
    const attribute = CODE_ATTRIBUTES.get(row.ImpAttr);
    const code = String(row.ImpAttrVal || '').trim().toUpperCase();
    if (!attribute || !code || !homes.has(row.prop_id) || CODE_WORDS[attribute[0]][code]) continue;
    const key = `${attribute[0]}:${code}`;
    if (!codes.has(key)) codes.set(key, { label: attribute[1], code, accounts: new Set() });
    codes.get(key).accounts.add(row.prop_id);
  }
  const used = [...codes].filter(([, entry]) => entry.accounts.size >= CODES_IN_REAL_USE).sort(([a, x], [b, y]) => a.split(':')[0].localeCompare(b.split(':')[0]) || y.accounts.size - x.accounts.size);
  const rows = used.map(([key, { label, code, accounts }]) => {
    const pair = [...accounts].slice(0, 2).map(esc).join(', ');
    return `<tr><td>${esc(label)}</td><td><b>${esc(code)}</b></td><td>${accounts.size.toLocaleString('en-US')} homes</td><td>${pair}</td><td><input class=word data-code="${esc(key)}" placeholder="the page's word"></td></tr>`;
  }).join('');
  console.log(`${used.length} codes in real use, of ${codes.size}`);
  return `<h2>What the county's codes mean</h2><p>The county's file says only codes for these, and it publishes no list. For each code, search one of its accounts${lookup ? ` on <a target=_blank href="${esc(lookup)}">the county's page</a>` : ''} and type the word the page shows next to that part of the home. If the page shows the code itself or nothing, try the other account, then leave the box empty. An empty box keeps that row hidden; nothing is guessed.</p><table><tr><th align=left>Row</th><th align=left>Code</th><th align=left>Used on</th><th align=left>Accounts</th><th align=left>Word on the page</th></tr>${rows}</table>`;
}

(async () => {
const codeSection = opt('--codes') ? await codeTable(opt('--codes')) : '';
const file = path.join(os.homedir(), '.config/pantopus/provider-truth/t3', `${fips}-hand-check.html`);
fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
fs.writeFileSync(file, `<!doctype html><meta charset=utf-8><title>County check ${fips}</title><style>body{font:15px system-ui;max-width:760px;margin:24px auto;padding:0 16px}td{padding:3px 10px 3px 0;vertical-align:top}table{margin-bottom:8px}#out{width:100%;height:90px}</style>
<h1>${esc(release.county.name)}: check by hand</h1>${codeSection}<p>${esc(release.county.publisher)}, ${esc(release.county.as_of)}. For each home, open the county's page and search the account number. Tick \"wrong\" only on a row that doesn't match, then tick \"I checked this home\". A row the page doesn't show is fine: leave it. About 30 seconds a home. When you're done, press the button and paste the result in the chat: it holds no addresses.</p>${sections}
<p><button onclick="const w=[...document.querySelectorAll('input.wrong:checked')].map(i=>i.dataset.row);const c=[...document.querySelectorAll('input.word')].filter(i=>i.value.trim()).map(i=>i.dataset.code+' = '+i.value.trim());document.getElementById('out').value='checked '+document.querySelectorAll('input.done:checked').length+' homes; '+w.length+' rows wrong\\n'+w.join('\\n')+(c.length?'\\nwords\\n'+c.join('\\n'):'')">Make the result</button></p><textarea id=out></textarea>`, { mode: 0o600 });
console.log(`${rowId} rows across ${[...groups.keys()].length} property types: ${file}`);
})().catch((err) => {
  console.error(err.constructor === Error ? err.message : err.name);
  process.exit(1);
});
