#!/usr/bin/env node
// The coverage report: per state, county and home type, what share of records holds each fact, from the reports a build
// writes beside each release. Counts only. Reads a local build, or private storage with the reader key in the
// environment (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).
//
//   node scripts/property-index/coverage.cjs --out <build dir> [--state MA] [--csv <file>]
//   node scripts/property-index/coverage.cjs --bucket <name> [--prefix index] [--state MA] [--csv <file>]
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const opt = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const prefix = opt('--prefix') || 'index';
const onlyState = opt('--state');
const HEADLINE = ['year_built', 'living_sqft', 'usable_sqft', 'gross_sqft', 'bedrooms', 'bathrooms', 'full_baths', 'stories', 'lot_acres', 'lot_sqft', 'market_value', 'assessed_value', 'sale_price', 'sale_date', 'sale_month'];

function s3Text(name) {
  return execFileSync('aws', ['s3', 'cp', `s3://${opt('--bucket')}/${prefix}/${name}`, '-'], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
}

/** Each county: what its state file says, and its release's report. */
function* counties() {
  if (opt('--out')) {
    const out = opt('--out');
    for (const name of fs.readdirSync(path.join(out, 'counties')).sort()) {
      const county = JSON.parse(fs.readFileSync(path.join(out, 'counties', name), 'utf8'));
      if (onlyState && county.state !== onlyState) continue;
      yield [county, JSON.parse(fs.readFileSync(path.join(out, 'releases', county.fips, county.release, 'report.json'), 'utf8'))];
    }
    return;
  }
  const states = onlyState ? [onlyState] : execFileSync('aws', ['s3', 'ls', `s3://${opt('--bucket')}/${prefix}/states/`], { encoding: 'utf8' }).split('\n').map((line) => /(\w\w)\.json$/.exec(line)?.[1]).filter(Boolean);
  for (const state of states) {
    const file = JSON.parse(s3Text(`states/${state}.json`));
    for (const county of Object.values(file.jurisdictions).sort((a, b) => a.fips.localeCompare(b.fips))) {
      yield [county, JSON.parse(s3Text(`releases/${county.fips}/${county.release}/report.json`))];
    }
  }
}

const percent = (count, total) => (total ? `${Math.round((100 * count) / total)}` : '');
const rows = [];
const states = new Map();
for (const [county, report] of counties()) {
  for (const [group, { records, facts }] of Object.entries(report.fill)) {
    const type = group.split(':');
    rows.push({ state: county.state, fips: county.fips, county: county.name, as_of: county.as_of, publisher: county.publisher, kind: type[0], home_type: type[1], records, facts });
    if (['property', 'unit'].includes(type[0])) {
      if (!states.has(county.state)) states.set(county.state, { records: 0, counties: new Set(), facts: {} });
      const state = states.get(county.state);
      state.counties.add(county.fips);
      state.records += records;
      for (const [fact, count] of Object.entries(facts)) state.facts[fact] = (state.facts[fact] || 0) + count;
    }
  }
}

console.log(['state', 'counties', 'homes', ...HEADLINE].join('\t'));
for (const [state, { counties: held, records, facts }] of [...states].sort()) {
  console.log([state, held.size, records, ...HEADLINE.map((fact) => percent(facts[fact] || 0, records))].join('\t'));
}
if (opt('--csv')) {
  const lines = [['state', 'fips', 'county', 'as_of', 'publisher', 'kind', 'home_type', 'records', ...HEADLINE].join(',')];
  for (const row of rows) {
    lines.push([row.state, row.fips, `"${row.county}"`, row.as_of, `"${row.publisher}"`, row.kind, row.home_type, row.records, ...HEADLINE.map((fact) => percent(row.facts[fact] || 0, row.records))].join(','));
  }
  fs.writeFileSync(opt('--csv'), `${lines.join('\n')}\n`);
  console.log(`${rows.length} county and type rows in the CSV`);
}
