#!/usr/bin/env node
'use strict';
// Compares the web's data sources page with the rights register and prints what's out of step: a source the register credits
// that the page lacks, a page row for a source that isn't used, a page row naming a connector that doesn't exist. Exits 1 when
// anything is. Run it after changing rights.cjs, openaddresses-rights.json, or a connector whose terms ask for credit.

const fs = require('node:fs');
const path = require('node:path');
const { NAD, OVERTURE_CC_BY, SOURCES } = require('./sources/address/rights.cjs');
const openaddresses = require('./sources/address/openaddresses-rights.json');

const root = path.join(__dirname, '../..');
const page = JSON.parse(fs.readFileSync(path.join(root, 'frontend/apps/web/src/app/(site)/about/data-sources/credits.json'), 'utf8'));

const rows = page.groups.flatMap((group) => group.sources);
const onPage = new Set(rows.map((row) => row.id));

// What the register says must be credited, by the id the page uses.
const wanted = new Map([[NAD.id, NAD.credit]]);
for (const [name, source] of Object.entries(openaddresses.sources)) {
  if (source.use && source.credit) wanted.set(name, source.credit);
}
for (const [name, credit] of Object.entries(OVERTURE_CC_BY)) wanted.set(`overture:${name}`, credit);
for (const [name, source] of Object.entries(SOURCES)) {
  if (source.use && source.credit) wanted.set(`overture:${name}`, source.credit);
}

const problems = [];
for (const [id, credit] of wanted) {
  if (!onPage.has(id)) problems.push(`missing from the page: ${id} (${credit})`);
}
for (const row of rows) {
  if (wanted.has(row.id)) continue;
  if (row.id.startsWith('us/') || row.id.startsWith('overture:')) {
    problems.push(`on the page, not in the register: ${row.id}`);
    continue;
  }
  const connector = path.join(__dirname, 'sources', `${row.id.split('#')[0]}.cjs`);
  if (!fs.existsSync(connector)) problems.push(`on the page, no such connector: ${row.id}`);
}
if (!rows.every((row) => row.publisher && row.url && row.license)) problems.push('a page row lacks a publisher, link or license');
if (rows.some((row) => /\battom\b/i.test(JSON.stringify(row)))) problems.push('a page row names a vendor it should not');

console.log(`${rows.length} rows on the page; the register credits ${wanted.size} address sources`);
for (const problem of problems) console.log(problem);
process.exitCode = problems.length ? 1 : 0;
