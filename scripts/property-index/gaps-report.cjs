#!/usr/bin/env node
// The missing-facts tables for docs/research/provider-replacement: how many homes miss each Property details field,
// in every county in storage and in the live ones, by kind, state and county, largest gaps first. Reads the ledger's
// counts (gaps.cjs), never an address: from private storage with the reader key in the environment
// (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY), or from a local copy.
//
//   node scripts/property-index/gaps-report.cjs --bucket <name> [--prefix index] [--docs <dir>]
//   node scripts/property-index/gaps-report.cjs --counts <counts.json> [--docs <dir>]
//     --docs  where missing-facts.md and evidence/ go (default docs/research/provider-replacement)
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const opt = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const docs = opt('--docs') || path.join(__dirname, '../../docs/research/provider-replacement');
const national = JSON.parse(opt('--counts')
  ? fs.readFileSync(opt('--counts'), 'utf8')
  : execFileSync('aws', ['s3', 'cp', `s3://${opt('--bucket')}/${opt('--prefix') || 'index'}/gaps/counts.json`, '-'], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }));
const { rule } = national;
const LABEL = Object.fromEntries(rule.fields);
const FIELD_IDS = rule.fields.map(([id]) => id);
const KIND_IDS = Object.keys(rule.kinds);
const CORE = ['bedrooms', 'bathrooms', 'living_area', 'year_built', 'lot_size'];
const BUILDINGS = ['small_multi_unit', 'building', 'condo_building'];

const n = (value) => Number(value || 0).toLocaleString('en-US');
const pct = (part, whole) => (whole ? `${((100 * part) / whole).toFixed(1)}%` : '–');
const sum = (values) => values.reduce((total, value) => total + (value || 0), 0);
const row = (cells) => `| ${cells.join(' | ')} |`;
const table = (head, rows, text = 1, right = head.map((_, i) => i >= text)) => [row(head), row(right.map((r) => (r ? '---:' : '---'))), ...rows.map(row)].join('\n');

/** A group of counties' totals: homes by kind, and each table by kind and field. */
function totals(counties) {
  const out = { counties: counties.length, homes: {}, missing: {}, missing_any: {}, zero: {}, next_build: {}, on_building_record: {}, restricted: 0, suppressed: 0 };
  for (const county of counties) {
    for (const [kind, count] of Object.entries(county.homes)) out.homes[kind] = (out.homes[kind] || 0) + count;
    for (const table of ['missing', 'missing_any', 'zero', 'next_build', 'on_building_record']) {
      for (const [kind, fields] of Object.entries(county[table] || {})) {
        out[table][kind] ||= {};
        for (const [id, count] of Object.entries(fields)) out[table][kind][id] = (out[table][kind][id] || 0) + count;
      }
    }
    out.restricted += county.restricted;
    out.suppressed += county.suppressed;
  }
  out.allHomes = sum(Object.values(out.homes));
  // A field's or set's homes: those of the kinds it applies to.
  out.applies = (ids) => sum(KIND_IDS.filter((kind) => ids.some((id) => rule.kinds[kind].fields.includes(id))).map((kind) => out.homes[kind]));
  out.field = (table, id, kinds = KIND_IDS) => sum(kinds.map((kind) => out[table][kind]?.[id]));
  return out;
}

function fieldTable(group) {
  const rows = FIELD_IDS.map((id) => {
    const missing = group.field('missing', id);
    const zero = group.field('zero', id);
    const next = group.field('next_build', id);
    const building = group.field('on_building_record', id);
    return { id, applies: group.applies([id]), missing, zero, next, building, lookUp: missing - zero - next - building };
  }).sort((a, b) => b.missing - a.missing);
  return table(['Field', 'Records it applies to', 'Missing', 'Share', 'County wrote 0', 'Next build fills it', 'Building record has it', 'To look up'],
    rows.map((r) => [LABEL[r.id], n(r.applies), n(r.missing), pct(r.missing, r.applies), n(r.zero), n(r.next), n(r.building), n(r.lookUp)]));
}

function headline(group) {
  const bedBath = group.field('missing_any', 'bedrooms_or_bathrooms');
  const core = group.field('missing_any', 'core');
  const buildings = sum(BUILDINGS.map((kind) => group.homes[kind]));
  return `${n(group.counties)} counties: ${n(group.allHomes - buildings)} homes and ${n(buildings)} residential building records. ${n(bedBath)} homes (${pct(bedBath, group.applies(rule.sets.bedrooms_or_bathrooms))} of those with rooms of their own) lack bedrooms or bathrooms; `
    + `${n(core)} records (${pct(core, group.applies(rule.sets.core))}) lack at least one of bedrooms, bathrooms, living area, year built or lot size, where it applies. `
    + `${n(group.restricted)} restricted records and ${n(group.suppressed)} taken-down addresses are counted out and never listed.`;
}

const counties = Object.values(national.counties);
const live = counties.filter((county) => county.live);
const all = totals(counties);
const liveTotals = totals(live);
const dates = counties.map((county) => county.as_of).filter(Boolean).sort();

// By state and by county: the core fields and the two sets, largest gaps first; every field in the CSVs.
const groupRow = (group) => ({
  homes: group.allHomes,
  bedBath: group.field('missing_any', 'bedrooms_or_bathrooms'),
  bedBathOf: group.applies(rule.sets.bedrooms_or_bathrooms),
  core: group.field('missing_any', 'core'),
  coreOf: group.applies(rule.sets.core),
  fields: Object.fromEntries(FIELD_IDS.map((id) => [id, group.field('missing', id)])),
});
const states = [...new Set(counties.map((county) => county.state))].map((state) => {
  const group = totals(counties.filter((county) => county.state === state));
  return { state, counties: group.counties, ...groupRow(group) };
}).sort((a, b) => b.bedBath - a.bedBath || b.core - a.core);
const byCounty = counties.map((county) => ({ county, ...groupRow(totals([county])) })).sort((a, b) => b.bedBath - a.bedBath || b.core - a.core);

const coreHead = ['Records', 'No bedrooms or bathrooms', 'Share', 'A core fact missing', 'Share', ...CORE.map((id) => LABEL[id])];
const coreCells = (r) => [n(r.homes), n(r.bedBath), pct(r.bedBath, r.bedBathOf), n(r.core), pct(r.core, r.coreOf), ...CORE.map((id) => n(r.fields[id]))];
const kindRows = KIND_IDS.filter((kind) => all.homes[kind]).map((kind) => [rule.kinds[kind].label, n(all.homes[kind]),
  ...CORE.map((id) => (rule.kinds[kind].fields.includes(id) ? `${n(all.missing[kind]?.[id])} (${pct(all.missing[kind]?.[id] || 0, all.homes[kind])})` : 'doesn’t apply'))]);

const md = `# Missing facts: what county records leave empty

Every home in the property index whose county record leaves a Property details field empty, counted by field, kind of home, state and county, largest gaps first. Counted from each county's serving release by the missing-facts ledger (\`scripts/property-index/gaps.cjs\`), last updated ${national.updated_at.slice(0, 10)}; the releases' source dates run from ${dates[0]} to ${dates.at(-1)}. The list of homes behind these numbers (each home's id, parcel number, address and missing fields) lives only in private storage, next to the releases, and refreshes after every publish. The research that fills these gaps works from it, using \`scripts/property-index/gaps-read.cjs\`. This page holds counts only. Regenerate it with \`node scripts/property-index/gaps-report.cjs --bucket <bucket>\` and the reader key.

## The rule

A field counts as missing when it applies to the record's kind of home and Property details would show no row for it. A blank, a word meaning unknown, or a zero all show nothing. The fields are the 46 in [property-fields.md](property-fields.md), less ${rule.not_counted.length} that no county record fills: Pantopus ID (Pantopus gives every exact match its own), the four estimate rows (model output, never a record field) and Occupancy (a private flag no release holds). Which fields apply to each kind follows the [subject scopes](evidence/subject-scopes.csv) and the scopes the screens use. A condo unit has no lot of its own, and a building's rooms belong to its units. A unit gets its building's figures when the building's record is at the unit's own address, as on its page. Land and non-home records are left out.

${table(['Kind', 'Fields that apply', 'Records'], KIND_IDS.map((kind) => [rule.kinds[kind].label, String(rule.kinds[kind].fields.length), n(all.homes[kind])]))}

Some gaps need no research, and the field tables count them separately:

- **County wrote 0:** the county wrote a zero for a count, such as no fireplace or no half bath.
- **Next build fills it:** the county's next build adds the field from the record itself, such as the other unit of the lot size or the property type's words.
- **Building record has it:** a condo unit's building record, filed at another address, holds the field.

## Every county in storage

${headline(all)}

${fieldTable(all)}

## Live counties

The ${live.length} counties people see on Property details today. ${headline(liveTotals)}

${fieldTable(liveTotals)}

## By kind of home

The core facts, missing (share of that kind). Most missing lot sizes come back with each county's next build, which computes the lot size from the lot area and the other way round (the field tables above count them):

${table(['Kind', 'Homes', ...CORE.map((id) => LABEL[id])], kindRows)}

## By state

${table(['State', 'Counties', ...coreHead], states.map((r) => [r.state, String(r.counties), ...coreCells(r)]))}

## Counties with the largest gaps

The 40 counties with the most homes lacking bedrooms or bathrooms. Every county and every field is in [missing-facts-by-county.csv](evidence/missing-facts-by-county.csv), and every state in [missing-facts-by-state.csv](evidence/missing-facts-by-state.csv).

${table(['County', 'State', 'Live', ...coreHead], byCounty.slice(0, 40).map((r) => [r.county.name || r.county.fips, r.county.state, r.county.live ? 'yes' : '', ...coreCells(r)]), 3)}

## Live counties, one by one

${table(['County', 'State', ...coreHead], byCounty.filter((r) => r.county.live).map((r) => [r.county.name || r.county.fips, r.county.state, ...coreCells(r)]), 2)}
`;

const csv = (rows) => `${rows.map((cells) => cells.map((cell) => (/[",\n]/.test(String(cell)) ? `"${String(cell).replace(/"/g, '""')}"` : cell)).join(',')).join('\n')}\n`;
const fieldCols = FIELD_IDS.map((id) => `missing_${id}`);
fs.mkdirSync(path.join(docs, 'evidence'), { recursive: true });
fs.writeFileSync(path.join(docs, 'missing-facts.md'), md);
fs.writeFileSync(path.join(docs, 'evidence/missing-facts-by-county.csv'), csv([
  ['fips', 'county', 'state', 'live', 'release', 'as_of', 'records', 'missing_bedrooms_or_bathrooms', 'missing_core', ...fieldCols],
  ...byCounty.map((r) => [r.county.fips, r.county.name || '', r.county.state, r.county.live ? 1 : 0, r.county.release, r.county.as_of || '', r.homes, r.bedBath, r.core, ...FIELD_IDS.map((id) => r.fields[id])]),
]));
fs.writeFileSync(path.join(docs, 'evidence/missing-facts-by-state.csv'), csv([
  ['state', 'counties', 'records', 'missing_bedrooms_or_bathrooms', 'missing_core', ...fieldCols],
  ...states.map((r) => [r.state, r.counties, r.homes, r.bedBath, r.core, ...FIELD_IDS.map((id) => r.fields[id])]),
]));
console.log(`${counties.length} counties, ${all.allHomes} homes; wrote missing-facts.md and two CSVs`);
