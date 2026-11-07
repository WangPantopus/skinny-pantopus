#!/usr/bin/env node
// The missing-facts ledger: for each county's serving release, every home record that leaves a Property details field
// empty (lib/gaps.cjs says which fields apply to which kind of home). Written to private storage beside the releases:
//   gaps/<fips>/<release>.jsonl.gz     a line per home with a gap: id, parcel number, address as the record holds it,
//                                      kind and missing fields; the first line says which release it reads
//   gaps/<fips>/<release>.counts.json  the county's counts by kind and field, written last: a ledger with one is whole
//   gaps/counts.json                   every county's counts, for the national tables
// .github/workflows/property-index.yml runs it after every publish and by hand (action gaps); gaps-read.cjs lists a
// county's homes missing a field, on the terminal of whoever holds the reader key.
//
//   node scripts/property-index/gaps.cjs --bucket <name> [--prefix index] [--all | --counties "<fips> ..."] [--budget-minutes <n>]
//   node scripts/property-index/gaps.cjs --root <local index, or a build's --out> ...   the same on a local copy
//   node scripts/property-index/gaps.cjs --bucket <name> --out <dir> ...   reads storage, writes the ledger to a local folder
//     (default)         counties whose serving release has no ledger yet, newest first
//     --all             every county again, as after the rule changes
//     --counties        only these
//     --budget-minutes  starts no county after this long; the next run takes the rest
//
// The repository is public, so its job logs are too: this prints counts only, never an address.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { releasePath, switchesPath, SUPPRESSIONS_PATH } = require('../../backend/services/propertyRecords/format');
const { openRelease } = require('../../backend/scripts/eval/lib/propertyRelease');
const { FIELDS, SETS, RULE, kindOf, gapsOf, buildingFacts, filled, addressLine, suppressed } = require('./lib/gaps.cjs');
const { log } = require('./lib/log.cjs');

const COUNTS_PATH = 'gaps/counts.json';
const ledgerPath = (fips, release) => `gaps/${fips}/${release}.jsonl.gz`;
const countsPath = (fips, release) => `gaps/${fips}/${release}.counts.json`;
const ALL_FIELDS = FIELDS.map((field) => field.id);
// Lines are gzip'd in pieces of about this many bytes, back to back: one file that gunzip, zcat and Node read whole.
const PIECE_BYTES = 8 * 1024 * 1024;

function parseArgs(argv) {
  const opts = { prefix: 'index', all: false, counties: null, budgetMinutes: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--bucket') opts.bucket = argv[++i];
    else if (argv[i] === '--root') opts.root = argv[++i];
    else if (argv[i] === '--out') opts.out = argv[++i];
    else if (argv[i] === '--prefix') opts.prefix = argv[++i];
    else if (argv[i] === '--all') opts.all = true;
    else if (argv[i] === '--counties') opts.counties = new Set(argv[++i].split(/[\s,]+/).filter(Boolean));
    else if (argv[i] === '--budget-minutes') opts.budgetMinutes = Number(argv[++i]);
    else throw new Error('usage: see the top of gaps.cjs');
  }
  if (!opts.bucket === !opts.root || (opts.out && !opts.bucket)) throw new Error('usage: see the top of gaps.cjs');
  return opts;
}

/** The index's files, in storage or in a local folder; with `out`, storage's releases and a local folder's ledger. */
function createStore({ bucket, root, prefix, out }) {
  if (out) {
    const remote = createStore({ bucket, prefix });
    const local = createStore({ root: out });
    return { ...local, counties: remote.counties, getRelease: remote.getRelease, text: (name) => (name.startsWith('gaps/') ? local : remote).text(name) };
  }
  if (root) {
    const file = (name) => path.join(root, name);
    const walk = (dir) => (fs.existsSync(file(dir)) ? fs.readdirSync(file(dir), { recursive: true }).map((name) => `${dir}${name}`) : []);
    return {
      // A local index has states/; a build's output has counties/ instead.
      counties: () => (fs.existsSync(file('states'))
        ? fs.readdirSync(file('states')).filter((name) => name.endsWith('.json')).flatMap((name) => Object.values(JSON.parse(fs.readFileSync(file(`states/${name}`), 'utf8')).jurisdictions || {}))
        : fs.readdirSync(file('counties')).filter((name) => name.endsWith('.json')).map((name) => JSON.parse(fs.readFileSync(file(`counties/${name}`), 'utf8')))),
      text: (name) => (fs.existsSync(file(name)) ? fs.readFileSync(file(name), 'utf8') : null),
      getRelease: (fips, release, dir) => {
        for (const name of ['manifest.json.gz', 'data.bin']) fs.copyFileSync(file(`${releasePath(fips, release)}/${name}`), path.join(dir, name));
      },
      list: walk,
      putFile: (from, name) => {
        fs.mkdirSync(path.dirname(file(name)), { recursive: true });
        fs.copyFileSync(from, file(name));
      },
      putJson: (name, data) => {
        fs.mkdirSync(path.dirname(file(name)), { recursive: true });
        fs.writeFileSync(`${file(name)}.tmp`, JSON.stringify(data));
        fs.renameSync(`${file(name)}.tmp`, file(name));
      },
    };
  }
  const url = (name) => `s3://${bucket}/${prefix}/${name}`;
  // `aws s3 ls` takes no --only-show-errors.
  const aws = (args, quiet = true) => execFileSync('aws', ['s3', ...args, ...(quiet ? ['--only-show-errors'] : [])], { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 256 * 1024 * 1024 });
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'gaps-store-'));
  return {
    counties: () => {
      const dir = path.join(scratch, 'states');
      aws(['cp', url('states/'), dir, '--recursive', '--exclude', '*', '--include', '*.json']);
      return fs.readdirSync(dir).flatMap((name) => Object.values(JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')).jurisdictions || {}));
    },
    text: (name) => {
      try {
        return execFileSync('aws', ['s3', 'cp', url(name), '-', '--only-show-errors'], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 }).toString('utf8');
      } catch (_) {
        return null;
      }
    },
    getRelease: (fips, release, dir) => {
      aws(['cp', url(`${releasePath(fips, release)}/`), dir, '--recursive', '--exclude', '*', '--include', 'manifest.json.gz', '--include', 'data.bin']);
    },
    // Nothing there yet is an error to `aws s3 ls`.
    list: (dir) => {
      try {
        return aws(['ls', url(dir), '--recursive'], false).toString('utf8').split('\n').map((line) => line.trim().split(/\s+/).pop())
          .filter(Boolean).map((key) => key.slice(prefix.length + 1));
      } catch (_) {
        return [];
      }
    },
    putFile: (from, name) => aws(['cp', from, url(name), '--content-type', 'application/gzip']),
    putJson: (name, data) => {
      const file = path.join(scratch, 'write');
      fs.writeFileSync(file, JSON.stringify(data));
      aws(['cp', file, url(name), '--content-type', 'application/json', '--cache-control', 'no-cache']);
    },
  };
}

/** Writes lines into one gzip file, a piece at a time. */
function lineWriter(file) {
  const fd = fs.openSync(file, 'w');
  let piece = [];
  let bytes = 0;
  const flush = () => {
    if (piece.length) fs.writeSync(fd, zlib.gzipSync(`${piece.join('\n')}\n`));
    piece = [];
    bytes = 0;
  };
  return {
    add(line) {
      piece.push(line);
      bytes += line.length + 1;
      if (bytes >= PIECE_BYTES) flush();
    },
    close() {
      flush();
      fs.closeSync(fd);
    },
  };
}

const bump = (table, kind, field) => {
  table[kind] ||= {};
  table[kind][field] = (table[kind][field] || 0) + 1;
};

/**
 * One county's ledger, from its release: writes its lines to `file` and returns its counts.
 * A unit's page shows its building's figures only when the building is at the unit's own address (identity.js), so only
 * then do they fill its fields; a building record elsewhere that holds one is counted as such, for the link to be fixed.
 */
function countyLedger(release, county, file, { live, suppressions }) {
  const counts = {
    fips: county.fips, state: county.state, name: county.name || null, source: county.source || null, release: county.release, as_of: county.as_of || null,
    live, written_at: new Date().toISOString(), homes: {}, complete: {}, rows: 0,
    missing: {}, missing_any: {}, zero: {}, next_build: {}, on_building_record: {}, restricted: 0, suppressed: 0, not_homes: 0,
  };
  const writer = lineWriter(file);
  writer.add(JSON.stringify({ ledger: 1, fips: county.fips, state: county.state, release: county.release, as_of: county.as_of || null, rule: 'scripts/property-index/lib/gaps.cjs' }));
  // Which fields each building's facts fill, for its units at other addresses.
  const buildings = new Map();
  const waiting = [];
  const write = (row) => {
    counts.rows += 1;
    writer.add(JSON.stringify(row));
  };
  const elsewhere = (row) => {
    const has = buildings.get(row.parent);
    const found = has ? row.missing.filter((id) => has.includes(id)) : [];
    for (const id of found) bump(counts.on_building_record, row.kind, id);
    if (found.length) row.on_building_record = found;
    write(row);
  };
  const one = (record, here) => {
    const kind = kindOf(record);
    if (!kind) {
      counts.not_homes += 1;
      return;
    }
    if (record.restricted) {
      counts.restricted += 1;
      return;
    }
    if (suppressed(suppressions, county.fips, record.address)) {
      counts.suppressed += 1;
      return;
    }
    if (record.kind === 'building') buildings.set(record.id, filled(ALL_FIELDS, buildingFacts(record)));
    const building = record.parent ? here.get(record.parent) : null;
    const gaps = gapsOf(record, building);
    counts.homes[kind] = (counts.homes[kind] || 0) + 1;
    if (!gaps.missing.length) {
      counts.complete[kind] = (counts.complete[kind] || 0) + 1;
      return;
    }
    for (const id of gaps.missing) bump(counts.missing, kind, id);
    for (const [name, set] of Object.entries(SETS)) if (set.some((id) => gaps.missing.includes(id))) bump(counts.missing_any, kind, name);
    for (const id of gaps.zero) bump(counts.zero, kind, id);
    for (const id of gaps.next_build) bump(counts.next_build, kind, id);
    const apn = record.facts?.parcel_number;
    const row = { id: record.id, ...(apn ? { apn: String(apn) } : {}), address: addressLine(record.address), kind, missing: gaps.missing };
    if (gaps.zero.length) row.zero = gaps.zero;
    if (gaps.next_build.length) row.next_build = gaps.next_build;
    if (record.parent) row.parent = record.parent;
    if (record.parent && !building) {
      // Its building is at another address: what that record holds is counted once every building has been read.
      if (buildings.has(record.parent)) elsewhere(row);
      else waiting.push(row);
      return;
    }
    write(row);
  };
  // Records come sorted by street name and number: one address's records are side by side.
  let key = null;
  let group = [];
  const flush = () => {
    const here = new Map(group.filter((record) => record.kind === 'building').map((record) => [record.id, record]));
    for (const record of group) one(record, here);
    group = [];
  };
  for (const record of release.records()) {
    if (record.key !== key) flush();
    key = record.key;
    group.push(record);
  }
  flush();
  for (const row of waiting) elsewhere(row);
  writer.close();
  return counts;
}

const total = (table) => Object.values(table).reduce((sum, n) => sum + n, 0);
const byField = (missing) => {
  const sums = {};
  for (const fields of Object.values(missing)) for (const [id, n] of Object.entries(fields)) sums[id] = (sums[id] || 0) + n;
  return Object.entries(sums).sort((a, b) => b[1] - a[1]);
};

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const started = Date.now();
  const store = createStore(opts);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gaps-work-'));
  const counties = store.counties().filter((county) => county.release && county.status === 'active');
  const switches = JSON.parse(store.text(switchesPath('production')) || '{}');
  const live = (fips) => switches.counties?.[fips]?.mode === 'live';
  const suppressions = JSON.parse(store.text(SUPPRESSIONS_PATH) || 'null');
  const done = new Set(store.list('gaps/').filter((name) => name.endsWith('.counts.json')));
  const queue = counties.filter((county) => {
    if (opts.counties) return opts.counties.has(county.fips);
    return opts.all || !done.has(countsPath(county.fips, county.release));
  });
  // Newest releases first, so a run with a budget covers what was just published; the largest first otherwise.
  if (opts.all || opts.counties) queue.sort((a, b) => (b.records || 0) - (a.records || 0));
  else queue.sort((a, b) => String(b.imported_at).localeCompare(String(a.imported_at)));
  log(`Missing-facts ledger: ${queue.length} of ${counties.length} counties, ${queue.reduce((sum, county) => sum + (county.records || 0), 0)} records`);

  const written = new Map();
  let failed = 0;
  let left = 0;
  for (const county of queue) {
    if (opts.budgetMinutes !== null && Date.now() - started > opts.budgetMinutes * 60000) {
      left += 1;
      continue;
    }
    const dir = path.join(work, releasePath(county.fips, county.release));
    const file = path.join(work, `${county.fips}.jsonl.gz`);
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.mkdirSync(path.join(work, 'counties'), { recursive: true });
      store.getRelease(county.fips, county.release, dir);
      fs.writeFileSync(path.join(work, 'counties', `${county.fips}.json`), JSON.stringify(county));
      const counts = countyLedger(openRelease(work, county.fips), county, file, { live: live(county.fips), suppressions });
      store.putFile(file, ledgerPath(county.fips, county.release));
      store.putJson(countsPath(county.fips, county.release), counts);
      written.set(county.fips, counts);
      const homes = total(counts.homes);
      const top = byField(counts.missing).slice(0, 3).map(([id, n]) => `${id} ${n}`).join(', ');
      log(`${county.fips} ${county.release}: ${homes} homes, ${counts.rows} with a gap${top ? ` (${top})` : ''}; restricted ${counts.restricted}, taken down ${counts.suppressed}`);
    } catch (err) {
      failed += 1;
      // Error messages can quote what was being read. Ours name a file or a count; anything else prints its kind only.
      const ours = err.constructor === Error && !/JSON|Unexpected/.test(err.message);
      console.log(`::warning::${county.fips}: no ledger (${ours ? err.message : err.name})`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.rmSync(file, { force: true });
    }
  }
  if (left) log(`${left} counties left for the next run`);

  // Read the national file again just before writing, so nothing written since is lost. A county whose ledger exists
  // but isn't in it yet (a run that stopped before this point) comes from its own counts file.
  const national = JSON.parse(store.text(COUNTS_PATH) || 'null') || { v: 1, counties: {} };
  let changed = written.size > 0;
  for (const county of counties) {
    const name = countsPath(county.fips, county.release);
    const entry = national.counties[county.fips];
    if (written.has(county.fips)) national.counties[county.fips] = written.get(county.fips);
    else if (done.has(name) && entry?.release !== county.release) {
      const counts = JSON.parse(store.text(name) || 'null');
      if (counts) {
        national.counties[county.fips] = { ...counts, live: live(county.fips) };
        changed = true;
      }
    } else if (entry && entry.live !== live(county.fips)) {
      entry.live = live(county.fips);
      changed = true;
    }
  }
  if (changed) store.putJson(COUNTS_PATH, { ...national, rule: RULE, updated_at: new Date().toISOString() });
  const all = Object.values(national.counties);
  const homes = all.reduce((sum, county) => sum + total(county.homes), 0);
  const rows = all.reduce((sum, county) => sum + county.rows, 0);
  const top = byField(Object.fromEntries(all.map((county) => [county.fips, Object.fromEntries(byField(county.missing))])));
  log(`National: ${all.length} counties, ${homes} homes, ${rows} with a gap. Most missing: ${top.slice(0, 8).map(([id, n]) => `${id} ${n}`).join(', ')}`);
  log(`Missing-facts ledger: ${written.size} written, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

try {
  main();
} catch (err) {
  console.error(`The ledger failed: ${err.constructor === Error && !/JSON|Unexpected/.test(err.message) ? err.message : err.name}`);
  process.exit(1);
}
