#!/usr/bin/env node
// Builds county releases of the property index (backend/services/propertyRecords/format.js) from public county and
// state files: one connector per source in sources/. .github/workflows/property-index.yml runs it and publishes the
// result to private storage (publish.cjs). Writes <out>/releases/<fips>/<release>/ and <out>/counties/<fips>.json.
//
//   node scripts/property-index/build.cjs --source wa-clark --out <dir> [--work <dir>]
//     --work  where downloads go (default: <out>/work); a file already there isn't downloaded again
//
// The repository is public, so its job logs are too: this prints counts only, and a failure prints what kind of error
// it was and where in this code, never what row it was reading. No packages: Node, curl and unzip.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { FACTS } = require('../../backend/services/propertyRecords/facts');
const { writeRelease } = require('./lib/release.cjs');
const { buildModel } = require('./lib/value-model.cjs');
const { markSharedDeeds } = require('./lib/shared-deeds.cjs');
const { deriveFacts } = require('./lib/derive.cjs');
const { STATE_FILES, compareRecords } = require('./lib/agreement.cjs');
const { dropPlaceholders } = require('./lib/placeholders.cjs');
const { log } = require('./lib/log.cjs');

const RECORD_KEYS = new Set(['id', 'kind', 'home_type', 'address', 'facts', 'held', 'parent', 'roster', 'restricted', 'key']);
// The lists a record's held facts may sit under (format.js `held`, router.js).
const HELD_LISTS = new Set(['new_columns', 'derived_rows']);
// `listed_unit`: a unit number an address list gives a record whose own file has none. The server reads it only for a county
// on its switch file's listed_units list (backend/services/propertyRecords/router.js).
const ADDRESS_KEYS = new Set(['number', 'pre', 'name', 'suffix', 'post', 'unit', 'building', 'urbanization', 'city', 'zip', 'listed_unit']);

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--source') opts.source = argv[++i];
    else if (argv[i] === '--out') opts.out = argv[++i];
    else if (argv[i] === '--work') opts.work = argv[++i];
    else throw new Error('usage: build.cjs --source <id> --out <dir> [--work <dir>]');
  }
  if (!opts.source || !opts.out) throw new Error('usage: build.cjs --source <id> --out <dir> [--work <dir>]');
  return opts;
}

/** Nothing but the allowlisted facts goes in a release: a mapping mistake stops the build instead of publishing it. */
function assertAllowed(records) {
  for (const record of records) {
    for (const key of Object.keys(record)) if (!RECORD_KEYS.has(key)) throw new Error(`A record has the field ${key}`);
    for (const key of Object.keys(record.address)) if (!ADDRESS_KEYS.has(key)) throw new Error(`An address has the field ${key}`);
    for (const key of Object.keys(record.facts || {})) if (!FACTS[key]) throw new Error(`A record has the fact ${key}`);
    if (record.restricted && Object.keys(record.facts || {}).length) throw new Error('A restricted record carries facts');
    for (const [list, facts] of Object.entries(record.held || {})) {
      if (!HELD_LISTS.has(list)) throw new Error(`A record holds facts under ${list}`);
      if (record.restricted) throw new Error('A restricted record holds facts');
      for (const key of Object.keys(facts)) if (!FACTS[key]) throw new Error(`A record holds the fact ${key}`);
    }
  }
}

/** A county's `held_from`: words for facts of a known list, never anything else. */
function assertHeldFrom(heldFrom) {
  for (const [list, words] of Object.entries(heldFrom || {})) {
    if (!HELD_LISTS.has(list)) throw new Error(`A county says where facts under ${list} come from`);
    for (const [key, text] of Object.entries(words)) if (!FACTS[key] || typeof text !== 'string') throw new Error(`A county's held_from names ${key}`);
  }
}

function releaseId(asOf, built) {
  return `${asOf.replace(/-/g, '')}-${built.toISOString().slice(0, 16).replace(/[-:T]/g, '').slice(4)}`;
}

function addDays(date, days) {
  return new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
}

/**
 * The agreement score: the county's records against its state file's for the same county, built here only to compare
 * and never published (lib/agreement.cjs). A comparison that fails leaves the release as it is, without one.
 * PROPERTY_INDEX_COMPARE=off skips it.
 */
async function agreementOf(fips, records, { work, built, source }) {
  const pair = STATE_FILES[fips];
  if (!pair || pair === source || process.env.PROPERTY_INDEX_COMPARE === 'off') return null;
  try {
    // eslint-disable-next-line global-require
    const other = require(`./sources/${pair}.cjs`);
    for await (const county of await other.build({ work: path.join(work, `compare-${pair}`), today: built, compare: [fips] })) {
      if (county.fips !== fips) continue;
      deriveFacts(county.records);
      const agreement = compareRecords(records, county.records, county, fips);
      log(`${fips}: ${agreement.matched} of ${agreement.homes} homes found in ${pair} (${county.as_of}); ${Object.keys(agreement.rows).length} rows compared`);
      return agreement;
    }
    log(`${fips}: ${pair} has no records for it to compare`);
  } catch (err) {
    const ours = err.constructor === Error && !/JSON|Unexpected/.test(err.message);
    log(`${fips}: the comparison with ${pair} was skipped: ${ours ? err.message : err.name}`);
  }
  return null;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const work = opts.work || path.join(opts.out, 'work');
  fs.mkdirSync(path.join(opts.out, 'counties'), { recursive: true });
  fs.mkdirSync(work, { recursive: true });
  // eslint-disable-next-line global-require
  const source = require(`./sources/${path.basename(opts.source)}.cjs`);
  const built = new Date();

  for await (const county of await source.build({ work, today: built })) {
    const { records, stale_after_days: staleAfterDays, extra_zips: extraZips = [], ...about } = county;
    // parse() also says which form an address came in (addressKey.js). A record keeps only its parts.
    for (const { address } of records) delete address.form;
    // A county's placeholder text ("[NONE]", "N/A", a lone "-") is no answer: read as empty before anything uses it.
    const placeholders = dropPlaceholders(records);
    if (Object.keys(placeholders).length) log(`${about.fips}: placeholder text read as empty: ${Object.entries(placeholders).map(([fact, n]) => `${fact} ${n}`).join(', ')}`);
    // deriveFacts may say, per list of held facts, where each came from in words (format.js `held_from`).
    // The rows the record implies, held off screens until the county's derived_rows switch is on (lib/derive.cjs).
    const derived = deriveFacts(records, { source: path.basename(opts.source), ...about }, { work });
    const heldFrom = derived?.held_from || about.held_from ? { ...about.held_from, ...derived?.held_from } : null;
    assertHeldFrom(heldFrom);
    const shared = markSharedDeeds(records);
    if (shared) log(`${about.fips}: ${shared} homes' last sales are one deed for several homes`);
    assertAllowed(records);
    const release = releaseId(about.as_of, built);
    const report = writeRelease(opts.out, { fips: about.fips, release }, records);
    const agreement = await agreementOf(about.fips, records, { work, built, source: path.basename(opts.source) });
    if (agreement) {
      report.agreement = agreement;
      fs.writeFileSync(path.join(opts.out, 'releases', about.fips, release, 'report.json'), JSON.stringify(report));
    }
    // What this file's sales say about its values, measured here so it moves with the release (lib/value-model.cjs).
    const valueModel = buildModel(records, about.fips, about.as_of);
    // A source with no property ZIP says which ZIP codes reach its county (lib/zcta.cjs).
    const zips = new Set(extraZips);
    const cities = new Set();
    for (const { address } of records) {
      if (address.zip) zips.add(address.zip);
      if (address.city) cities.add(address.city);
    }
    fs.writeFileSync(path.join(opts.out, 'counties', `${about.fips}.json`), JSON.stringify({
      ...about,
      release,
      imported_at: built.toISOString(),
      stale_after: addDays(about.as_of, staleAfterDays),
      status: 'active',
      zips: [...zips].sort(),
      cities: [...cities].sort(),
      records: report.records,
      ...(heldFrom ? { held_from: heldFrom } : {}),
      ...(valueModel ? { value_model: valueModel } : {}),
    }));
    // Which accounts it holds, for the next release's retention check.
    fs.writeFileSync(path.join(opts.out, 'releases', about.fips, release, 'ids.json.gz'),
      zlib.gzipSync(JSON.stringify([...new Set(records.map((record) => record.id))].sort())));
    for (const [group, { records: count, facts }] of Object.entries(report.fill).slice(0, 8)) {
      const top = Object.entries(facts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([fact, n]) => `${fact} ${Math.round((100 * n) / count)}%`);
      log(`${about.fips} ${group}: ${count}; ${top.join(', ')}`);
    }
  }
}

main().catch((err) => {
  // Error messages can quote what was being parsed. Ours name a column or a count; anything else prints its kind only.
  const ours = err.constructor === Error && !/JSON|Unexpected/.test(err.message);
  console.error(`The build failed: ${ours ? err.message : err.name}`);
  console.error((err.stack || '').split('\n').slice(1, 6).filter((line) => line.includes('property-index')).join('\n'));
  process.exit(1);
});
