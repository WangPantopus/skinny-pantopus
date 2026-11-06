#!/usr/bin/env node
// Publishes built county releases (build.cjs) to private storage, or moves a county back to its previous release.
// The new release is checked against the one serving and uploaded first; replacing its state's file is what switches
// readers over, so a failed or refused import leaves the previous release serving. Run by
// .github/workflows/property-index.yml with the AWS key of its master-only environment.
//
//   node scripts/property-index/publish.cjs --out <dir> --bucket <name> [--prefix index] [--bulk] [--min-retention 0.995]
//     --bulk  uploads every county's release at once, which a whole state of them needs; a refused county's files just go unused
//   node scripts/property-index/publish.cjs --rollback <fips> --state <ST> --bucket <name> [--prefix index]
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { FORMAT, statePath, releasePath } = require('../../backend/services/propertyRecords/format');
const { log } = require('./lib/log.cjs');

// A new release may lose this much without someone looking at it.
const MIN_RECORD_SHARE = 0.9;
const MIN_ID_RETENTION = 0.995;
const MAX_FILL_DROP = 0.1;

function aws(args, options = {}) {
  return execFileSync('aws', ['s3', ...args, '--only-show-errors'], { stdio: ['ignore', options.capture ? 'pipe' : 'inherit', 'inherit'] });
}

function parseArgs(argv) {
  const opts = { prefix: 'index' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') opts.out = argv[++i];
    else if (argv[i] === '--bucket') opts.bucket = argv[++i];
    else if (argv[i] === '--prefix') opts.prefix = argv[++i];
    else if (argv[i] === '--rollback') opts.rollback = argv[++i];
    else if (argv[i] === '--state') opts.state = argv[++i];
    else if (argv[i] === '--bulk') opts.bulk = true;
    else if (argv[i] === '--min-retention') opts.minRetention = Number(argv[++i]);
    else throw new Error('Unknown argument');
  }
  if (!opts.bucket || !(opts.out || (opts.rollback && opts.state))) throw new Error('usage: see the top of publish.cjs');
  return opts;
}

function createStore({ bucket, prefix }) {
  const url = (name) => `s3://${bucket}/${prefix}/${name}`;
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'property-index-'));
  return {
    /** A file's bytes, or null when it isn't there. */
    get(name) {
      const file = path.join(scratch, 'read');
      try {
        aws(['cp', url(name), file]);
        return fs.readFileSync(file);
      } catch (_) {
        return null;
      }
    },
    putFile(file, name) {
      aws(['cp', file, url(name)]);
    },
    putDir(dir, name) {
      aws(['cp', dir, url(name), '--recursive']);
    },
    putJson(name, data) {
      const file = path.join(scratch, 'write');
      fs.writeFileSync(file, JSON.stringify(data));
      aws(['cp', file, url(name), '--content-type', 'application/json', '--cache-control', 'no-cache']);
    },
  };
}

const emptyState = (state) => ({ v: FORMAT, state, jurisdictions: {}, zips: {}, cities: {} });

/** The ZIP and city maps, from what each county's release says it holds. */
function withMaps(stateFile, counties) {
  const zips = {};
  const cities = {};
  for (const [fips, county] of Object.entries(counties)) {
    for (const zip of county.zips) (zips[zip] ||= []).push(fips);
    for (const city of county.cities) (cities[city] ||= []).push(fips);
  }
  return { ...stateFile, zips, cities };
}

/** Why this release mustn't replace the one serving: counts only. */
function problems(store, entry, previous, out, minRetention = MIN_ID_RETENTION) {
  const found = [];
  const dir = path.join(out, releasePath(entry.fips, entry.release));
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'));
  if (report.records === 0) found.push('no records');
  if (!previous) return found;
  const before = previous.records || 0;
  if (report.records < before * MIN_RECORD_SHARE) found.push(`${report.records} records, ${before} serving`);
  const oldReport = store.get(`${releasePath(entry.fips, previous.release)}/report.json`);
  if (oldReport) {
    const { fill } = JSON.parse(oldReport.toString('utf8'));
    for (const [group, { records, facts }] of Object.entries(fill)) {
      const now = report.fill[group];
      if (!now || records < 1000) continue;
      for (const [fact, count] of Object.entries(facts)) {
        const had = count / records;
        const has = (now.facts[fact] || 0) / now.records;
        if (had >= 0.2 && had - has > MAX_FILL_DROP) found.push(`${group} ${fact} fell from ${Math.round(had * 100)}% to ${Math.round(has * 100)}%`);
      }
    }
  }
  const oldIds = store.get(`${releasePath(entry.fips, previous.release)}/ids.json.gz`);
  if (oldIds) {
    const was = JSON.parse(zlib.gunzipSync(oldIds).toString('utf8'));
    const now = new Set(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'ids.json.gz'))).toString('utf8')));
    const kept = was.filter((id) => now.has(id)).length;
    if (was.length && kept / was.length < minRetention) found.push(`${kept} of ${was.length} accounts kept`);
  }
  return found;
}

function readState(store, state) {
  const bytes = store.get(statePath(state));
  return bytes ? JSON.parse(bytes.toString('utf8')) : emptyState(state);
}

function publish(store, out, { bulk = false, minRetention } = {}) {
  if (bulk) store.putDir(path.join(out, 'releases'), 'releases');
  const dir = path.join(out, 'counties');
  const entries = fs.readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
  const byState = new Map();
  for (const entry of entries) {
    if (!byState.has(entry.state)) byState.set(entry.state, []);
    byState.get(entry.state).push(entry);
  }
  let refused = 0;
  for (const [state, built] of byState) {
    const stateFile = readState(store, state);
    let changed = false;
    for (const entry of built) {
      const serving = stateFile.jurisdictions[entry.fips];
      // The source hasn't published anything new since the release serving.
      if (serving && serving.as_of === entry.as_of && serving.status === 'active') {
        log(`${entry.fips}: unchanged since ${entry.as_of}`);
        continue;
      }
      const found = problems(store, entry, serving, out, minRetention);
      if (found.length) {
        refused += 1;
        console.log(`::error::${entry.fips} ${entry.release} refused: ${found.join('; ')}. The previous release keeps serving.`);
        continue;
      }
      const name = releasePath(entry.fips, entry.release);
      if (!bulk) store.putDir(path.join(out, name), name);
      stateFile.jurisdictions[entry.fips] = { ...entry, previous: serving?.release || null, previous_as_of: serving?.as_of || null };
      changed = true;
      log(`${entry.fips}: ${entry.release} ready (${entry.records} records)`);
    }
    if (changed) {
      store.putJson(statePath(state), withMaps({ ...stateFile, updated_at: new Date().toISOString() }, stateFile.jurisdictions));
      log(`${state}: switched over`);
    }
  }
  if (refused) process.exitCode = 1;
}

function rollback(store, fips, state) {
  const stateFile = readState(store, state);
  const county = stateFile.jurisdictions[fips];
  if (!county?.previous) throw new Error(`${fips} has no previous release`);
  stateFile.jurisdictions[fips] = {
    ...county,
    release: county.previous,
    as_of: county.previous_as_of,
    previous: null,
    previous_as_of: null,
    rolled_back_from: county.release,
    rolled_back_at: new Date().toISOString(),
  };
  store.putJson(statePath(state), { ...stateFile, updated_at: new Date().toISOString() });
  log(`${fips}: back on ${county.previous}`);
}

const opts = parseArgs(process.argv.slice(2));
const store = createStore(opts);
try {
  if (opts.rollback) rollback(store, opts.rollback, opts.state);
  else publish(store, opts.out, opts);
} catch (err) {
  console.error(`Publishing failed: ${err.constructor === Error ? err.message : err.name}`);
  process.exit(1);
}
