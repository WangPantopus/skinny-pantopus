#!/usr/bin/env node
// Builds the national floor (sources/us-structures.cjs, sources/us-acs.cjs): a separate index, in the same format as the
// record index, under its own prefix, so an estimate can't be read as a record. Prints counts only.
//
//   node scripts/property-index/build-estimates.cjs --states VT,NH --out <dir> [--work <dir>]
//   node scripts/property-index/build-estimates.cjs --areas --out <dir> [--work <dir>]
//   node scripts/property-index/build-estimates.cjs --points --registry <s3://bucket/prefix or dir> --states HI,NV --out <dir> [--work <dir>]
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { ESTIMATE_FACTS } = require('../../backend/services/propertyRecords/estimateFacts');
const { writeRelease } = require('./lib/release.cjs');
const { buildState } = require('./sources/us-structures.cjs');
const { buildAreas } = require('./sources/us-acs.cjs');
const { buildStatePoints } = require('./sources/us-structure-points.cjs');
const { log } = require('./lib/log.cjs');

function assertAllowed(records) {
  for (const record of records) {
    for (const key of Object.keys(record.facts)) if (!ESTIMATE_FACTS[key]) throw new Error(`An estimate has the fact ${key}`);
  }
}

const addDays = (date, days) => new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);

async function main() {
  const opt = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
  const out = opt('--out');
  if (!out) throw new Error('usage: see the top of build-estimates.cjs');
  const work = opt('--work') || path.join(out, 'work');
  fs.mkdirSync(path.join(out, 'counties'), { recursive: true });
  if (process.argv.includes('--areas')) {
    buildAreas({ work, out });
    return;
  }
  const built = new Date();
  if (process.argv.includes('--points')) {
    for (const state of (opt('--states') || '').split(',').filter(Boolean)) buildStatePoints({ work, out, state, registry: opt('--registry'), built });
    return;
  }
  for (const state of (opt('--states') || '').split(',').filter(Boolean)) {
    for await (const county of buildState({ work, state })) {
      const { records, stale_after_days: staleAfterDays, ...about } = county;
      assertAllowed(records);
      const release = `${about.as_of.replace(/-/g, '')}-${built.toISOString().slice(0, 16).replace(/[-:T]/g, '').slice(4)}`;
      const report = writeRelease(out, { fips: about.fips, release }, records);
      const zips = new Set();
      const cities = new Set();
      for (const { address } of records) {
        if (address.zip) zips.add(address.zip);
        if (address.city) cities.add(address.city);
      }
      fs.writeFileSync(path.join(out, 'counties', `${about.fips}.json`), JSON.stringify({
        ...about, release, imported_at: built.toISOString(), stale_after: addDays(about.as_of, staleAfterDays), status: 'active', zips: [...zips].sort(), cities: [...cities].sort(), records: report.records,
      }));
      fs.writeFileSync(path.join(out, 'releases', about.fips, release, 'ids.json.gz'), zlib.gzipSync(JSON.stringify([...new Set(records.map((record) => record.id))].sort())));
    }
  }
}

main().catch((err) => {
  const ours = err.constructor === Error && !/JSON|Unexpected/.test(err.message);
  console.error(`The build failed: ${ours ? err.message : err.name}`);
  console.error((err.stack || '').split('\n').slice(1, 6).filter((line) => line.includes('property-index')).join('\n'));
  process.exit(1);
});
