#!/usr/bin/env node
// The coverage report: per state, county and home type, what share of records holds each fact, from the reports a build
// writes beside each release. Counts only. Reads a local build, or private storage with the reader key in the
// environment (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).
//
// Beside it, the two measures of docs/research/provider-replacement/full-page-plan.md section 6 (measurement only: the six
// facts stay the go-live bar):
//   page score       how many of the Property details rows that apply to a kind of home (lib/gaps.cjs) each home's page
//                    fills: the release report's `page`, or, for a release built before reports carried it, the
//                    missing-facts ledger's counts for that release (gaps/counts.json; mean only)
//   agreement score  per row, how often the county's record and a second source say the same thing: the release report's
//                    `agreement` (lib/agreement.cjs: the county and a state file), and with --answers the county and
//                    its households' "Is this right?" answers (backend/scripts/eval/household-agreement.js)
//
//   node scripts/property-index/coverage.cjs --out <build dir> [--state MA] [--csv <file>] [--agreement-csv <file>] [--answers <file>]
//   node scripts/property-index/coverage.cjs --bucket <name> [--prefix index] [--state MA] [--csv <file>] [--agreement-csv <file>] [--answers <file>]
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { KINDS, kindOf } = require('./lib/gaps.cjs');
const { MIN_COMPARED, MIN_ANSWERS } = require('./lib/agreement.cjs');

const opt = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const prefix = opt('--prefix') || 'index';
const onlyState = opt('--state');
const HEADLINE = ['year_built', 'living_sqft', 'usable_sqft', 'gross_sqft', 'bedrooms', 'bathrooms', 'full_baths', 'stories', 'lot_acres', 'lot_sqft', 'market_value', 'assessed_value', 'sale_price', 'sale_date', 'sale_month'];
// The page score's columns: houses, and condo units however the county files them.
const PAGE_GROUPS = { houses: ['property:house'], condo_units: ['unit:condo', 'property:condo'] };

function s3Text(name, { optional = false } = {}) {
  try {
    return execFileSync('aws', ['s3', 'cp', `s3://${opt('--bucket')}/${prefix}/${name}`, '-'], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (err) {
    if (optional) return null;
    throw err;
  }
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
      if (!county.release) continue;
      yield [county, JSON.parse(s3Text(`releases/${county.fips}/${county.release}/report.json`))];
    }
  }
}

// The missing-facts ledger's counts, for releases whose report has no page score: one file for every county.
const ledgers = opt('--bucket') ? (JSON.parse(s3Text('gaps/counts.json', { optional: true }) || 'null')?.counties || {}) : {};

/** A group's page score: the report's own, else the mean from the ledger written for this same release. */
function pageOf(county, report, group) {
  if (report.page?.[group]) return { ...report.page[group], from: 'report' };
  const ledger = ledgers[county.fips];
  const [kind, homeType] = group.split(':');
  const ledgerKind = kindOf({ kind, home_type: homeType === '-' ? null : homeType });
  const homes = ledger?.release === county.release && ledgerKind && ledger.homes[ledgerKind];
  if (!homes) return null;
  const rows = KINDS[ledgerKind].fields.length;
  const missing = Object.values(ledger.missing[ledgerKind] || {}).reduce((sum, n) => sum + n, 0);
  return { homes, rows, mean: Number((rows - missing / homes).toFixed(2)), from: 'ledger' };
}

/** Households' "Is this right?" answers, by county and row, if given. */
const answers = opt('--answers') ? JSON.parse(fs.readFileSync(opt('--answers'), 'utf8')).counties || {} : {};

const percent = (count, total) => (total ? `${Math.round((100 * count) / total)}` : '');
const rows = [];
const agreements = [];
const states = new Map();
const pages = new Map();
for (const [county, report] of counties()) {
  for (const [group, { records, facts }] of Object.entries(report.fill)) {
    const type = group.split(':');
    const page = pageOf(county, report, group);
    rows.push({ state: county.state, fips: county.fips, county: county.name, as_of: county.as_of, publisher: county.publisher, kind: type[0], home_type: type[1], records, facts, page });
    if (['property', 'unit'].includes(type[0])) {
      if (!states.has(county.state)) states.set(county.state, { records: 0, counties: new Set(), facts: {} });
      const state = states.get(county.state);
      state.counties.add(county.fips);
      state.records += records;
      for (const [fact, count] of Object.entries(facts)) state.facts[fact] = (state.facts[fact] || 0) + count;
    }
    for (const [column, groups] of Object.entries(PAGE_GROUPS)) {
      if (!page || !groups.includes(group)) continue;
      if (!pages.has(county.state)) pages.set(county.state, {});
      const entry = pages.get(county.state);
      entry[column] = entry[column] || { homes: 0, filled: 0, later: 0, rows: page.rows };
      entry[column].homes += page.homes;
      entry[column].filled += page.mean * page.homes;
      entry[column].later += (page.with_held?.mean ?? page.mean) * page.homes;
    }
  }
  const against = report.agreement;
  for (const [fact, { compared, agree, different_words: different }] of Object.entries(against?.rows || {})) {
    agreements.push({ state: county.state, fips: county.fips, county: county.name, as_of: county.as_of, against: `${against.source} ${against.as_of}`, matched: against.matched, fact, compared, agree, enough: compared >= MIN_COMPARED && !different, different: Boolean(different) });
  }
  for (const [fact, { compared, agree }] of Object.entries(answers[county.fips]?.rows || {})) {
    agreements.push({ state: county.state, fips: county.fips, county: county.name, as_of: county.as_of, against: 'households', matched: answers[county.fips].homes, fact, compared, agree, enough: compared >= MIN_ANSWERS });
  }
}

console.log(['state', 'counties', 'homes', ...HEADLINE].join('\t'));
for (const [state, { counties: held, records, facts }] of [...states].sort()) {
  console.log([state, held.size, records, ...HEADLINE.map((fact) => percent(facts[fact] || 0, records))].join('\t'));
}

console.log('\nPage score: rows filled per home, of the rows that apply to it (lib/gaps.cjs)');
console.log('(with_held: the same once the county shows the facts its release holds off screens, format.js `held`)');
console.log(['state', 'houses', 'house_rows', 'house_mean', 'house_with_held', 'condo_units', 'unit_rows', 'unit_mean', 'unit_with_held'].join('\t'));
for (const [state, entry] of [...pages].sort()) {
  const cells = Object.keys(PAGE_GROUPS).flatMap((column) => {
    const it = entry[column];
    return it ? [it.homes, it.rows, (it.filled / it.homes).toFixed(1), (it.later / it.homes).toFixed(1)] : ['', '', '', ''];
  });
  console.log([state, ...cells].join('\t'));
}

if (agreements.length) {
  console.log(`\nAgreement score: the county's record and a second source on the same home (a share only from ${MIN_COMPARED}+ homes compared, or ${MIN_ANSWERS}+ household answers)`);
  console.log(['fips', 'county', 'against', 'row', 'compared', 'agree'].join('\t'));
  for (const row of agreements) console.log([row.fips, row.county, row.against, row.fact, row.compared, row.enough ? `${percent(row.agree, row.compared)}%` : (row.different ? 'different words' : 'too few')].join('\t'));
}

if (opt('--csv')) {
  const lines = [['state', 'fips', 'county', 'as_of', 'publisher', 'kind', 'home_type', 'records', ...HEADLINE, 'page_rows', 'page_mean', 'page_median', 'page_p10', 'page_with_held', 'page_from'].join(',')];
  for (const row of rows) {
    const page = row.page || {};
    lines.push([row.state, row.fips, `"${row.county}"`, row.as_of, `"${row.publisher}"`, row.kind, row.home_type, row.records, ...HEADLINE.map((fact) => percent(row.facts[fact] || 0, row.records)),
      page.rows ?? '', page.mean ?? '', page.median ?? '', page.p10 ?? '', page.with_held?.mean ?? page.mean ?? '', page.from ?? ''].join(','));
  }
  fs.writeFileSync(opt('--csv'), `${lines.join('\n')}\n`);
  console.log(`${rows.length} county and type rows in the CSV`);
}
if (opt('--agreement-csv')) {
  const lines = [['state', 'fips', 'county', 'as_of', 'against', 'matched', 'row', 'compared', 'agree', 'enough'].join(',')];
  for (const row of agreements) lines.push([row.state, row.fips, `"${row.county}"`, row.as_of, `"${row.against}"`, row.matched, row.fact, row.compared, row.agree, row.enough].join(','));
  fs.writeFileSync(opt('--agreement-csv'), `${lines.join('\n')}\n`);
  console.log(`${agreements.length} county and row agreement lines in the CSV`);
}
