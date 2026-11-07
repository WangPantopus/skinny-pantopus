#!/usr/bin/env node
// What a county's release gives the two gates, by property type. G2 (Add Home asks nothing new): how many homes fill each field
// Add Home used to prefill; a field the county doesn't publish is left for the household, never demanded. G1 (Property details
// stay useful): which of the page's groups the county fills, and for how many homes. Prints counts only.
//
//   node backend/scripts/eval/property-county-report.js --out <build dir>
'use strict';

const fs = require('fs');
const path = require('path');
const { openRelease } = require('./lib/propertyRelease');
const { FACTS, SECTIONS } = require('../../services/propertyRecords/facts');

const opt = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const out = opt('--out');

const ADD_HOME = {
  year_built: (facts, building) => facts.year_built ?? building?.year_built,
  bedrooms: (facts) => facts.bedrooms,
  bathrooms: (facts) => facts.bathrooms,
  sq_ft: (facts) => facts.living_sqft,
  lot_sq_ft: (facts) => facts.lot_sqft ?? facts.lot_acres,
};
const share = (n, total) => `${Math.round((100 * n) / total)}%`;

for (const file of fs.readdirSync(path.join(out, 'counties')).filter((name) => name.endsWith('.json')).sort()) {
  const release = openRelease(out, file.slice(0, -5));
  const { county } = release;
  console.log(`${county.fips} ${county.name}, ${county.state}, as of ${county.as_of}, from ${county.publisher}: ${county.records} records`);
  const buildings = new Map();
  const groups = new Map();
  const records = [...release.records()];
  for (const record of records) if (record.kind === 'building') buildings.set(record.id, record.facts);
  for (const record of records) {
    if (record.kind !== 'property' && record.kind !== 'unit') continue;
    if (record.restricted) continue;
    if (!groups.has(record.home_type)) groups.set(record.home_type, { homes: 0, addHome: {}, sections: {} });
    const group = groups.get(record.home_type);
    group.homes += 1;
    for (const [field, read] of Object.entries(ADD_HOME)) {
      if (read(record.facts, record.parent ? buildings.get(record.parent) : null) != null) group.addHome[field] = (group.addHome[field] || 0) + 1;
    }
    const seen = new Set();
    for (const fact of Object.keys(record.facts)) if (FACTS[fact]?.section) seen.add(FACTS[fact].section);
    for (const section of seen) group.sections[section] = (group.sections[section] || 0) + 1;
  }
  const order = [...groups].sort((a, b) => b[1].homes - a[1].homes);
  for (const [type, { homes, addHome, sections }] of order) {
    const fields = Object.keys(ADD_HOME).map((field) => `${field} ${share(addHome[field] || 0, homes)}`).join(', ');
    const pages = SECTIONS.map(([section, label]) => `${label} ${share(sections[section] || 0, homes)}`).join(', ');
    console.log(`  ${type}: ${homes} homes`);
    console.log(`    Add Home (G2): type 100%, ${fields}`);
    console.log(`    Property details (G1): ${pages}`);
  }
}
