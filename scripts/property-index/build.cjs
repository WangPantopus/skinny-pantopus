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
const { log } = require('./lib/log.cjs');

const RECORD_KEYS = new Set(['id', 'kind', 'home_type', 'address', 'facts', 'parent', 'roster', 'restricted', 'key']);
const ADDRESS_KEYS = new Set(['number', 'pre', 'name', 'suffix', 'post', 'unit', 'building', 'city', 'zip']);

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
  }
}

function releaseId(asOf, built) {
  return `${asOf.replace(/-/g, '')}-${built.toISOString().slice(0, 16).replace(/[-:T]/g, '').slice(4)}`;
}

function addDays(date, days) {
  return new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
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
    const { records, stale_after_days: staleAfterDays, ...about } = county;
    assertAllowed(records);
    const release = releaseId(about.as_of, built);
    const report = writeRelease(opts.out, { fips: about.fips, release }, records);
    const zips = new Set();
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
