#!/usr/bin/env node
// Publishes built county releases (build.cjs) to private storage, or moves a county back to its previous release.
// The new release is checked against the one serving and uploaded first; replacing its state's file is what switches
// readers over, so a failed or refused import leaves the previous release serving. Run by
// .github/workflows/property-index.yml with the AWS key of its master-only environment.
//
//   node scripts/property-index/publish.cjs --out <dir> --bucket <name> [--prefix index] [--bulk] [--min-retention 0.995] [--republish] [--accept-falls]
//     [--accept-falls-for "<fips> ..."]
//     --bulk  uploads every county's release at once, which a whole state of them needs, but those of counties left as they
//             serve (unchanged, or rolled back); a refused county's files just go unused
//     --moved "<fips> ..."  counties moving from a statewide file to a connector of their own: ids and facts are another file's, so only the record count compares
//     --republish  someone decided: a file that was rolled back may serve again, and a new build of the file serving
//                  replaces it (a scheduled run never passes this)
//     --accept-falls  someone read the refusals and a connector's fix meant them: lower fill and changed account ids publish
//                     with a warning. An empty file or far fewer records is still refused. Off unless asked for by hand.
//     --accept-falls-for  the same, for the counties named only
//     --accept-shrink-for "<fips> ..."  with --accept-falls (or --accept-falls-for naming them): the counties named only may
//                     also publish far fewer records (the registry: addresses), when a fix drops records that shouldn't exist.
//                     Each is logged with both counts; a county live in any switch file never takes it (that's the founder's).
//   node scripts/property-index/publish.cjs --rollback <fips> --state <ST> --bucket <name> [--prefix index]
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { FORMAT, statePath, releasePath, switchesPath } = require('../../backend/services/propertyRecords/format');
const { log } = require('./lib/log.cjs');
const { selfFind, described, MIN_SELF_FIND } = require('./lib/self-find.cjs');
const { sameSources } = require('./lib/registry.cjs');

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
    else if (argv[i] === '--republish') opts.republish = true;
    else if (argv[i] === '--accept-falls') opts.acceptFalls = true;
    else if (argv[i] === '--accept-falls-for') opts.acceptFallsFor = argv[++i].split(/[\s,]+/).filter(Boolean);
    else if (argv[i] === '--accept-shrink-for') opts.acceptShrinkFor = argv[++i].split(/[\s,]+/).filter(Boolean);
    else if (argv[i] === '--bulk') opts.bulk = true;
    else if (argv[i] === '--min-retention') opts.minRetention = Number(argv[++i]);
    else if (argv[i] === '--moved') opts.moved = argv[++i].split(/\s+/).filter(Boolean);
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
    /** A folder's files, but those under the subfolders named in `skipped`. */
    putDir(dir, name, skipped = []) {
      aws(['cp', dir, url(name), '--recursive', ...skipped.flatMap((folder) => ['--exclude', `${folder}/*`])]);
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

/** An address registry release's addresses: its houses and buildings, not the units listed under them. Null otherwise. */
const addresses = (county) => (county.source === 'registry' && county.counts ? county.counts.property + county.counts.building : null);

/** Why this release mustn't replace the one serving, and what only someone who looked may accept: counts only. */
function problems(store, entry, previous, out, minRetention = MIN_ID_RETENTION, moved = [], records = true, shrinkable = false) {
  const found = [];
  const falls = [];
  const dir = path.join(out, releasePath(entry.fips, entry.release));
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8'));
  if (report.records === 0) found.push('no records');
  // Its homes, looked up from the address a person would type with the reader the servers run.
  const own = selfFind(fs.readFileSync(path.join(dir, 'manifest.json.gz')), fs.readFileSync(path.join(dir, 'data.bin')), entry);
  log(`${entry.fips} ${entry.release}: ${described(own)}`);
  if (records && own.share !== null && own.share < MIN_SELF_FIND) falls.push(`only ${own.found} of ${own.asked - own.ambiguous} sampled homes find themselves through the app's reader`);
  if (!previous) return { found, falls };
  const before = previous.records || 0;
  const addressesBefore = addresses(previous);
  const addressesNow = addresses(entry);
  if (addressesBefore !== null && addressesNow !== null) {
    // The registry counts addresses. Fewer units under them, as when a fix drops units a source made up, needs someone to look.
    // Far fewer addresses too, named by hand, as when a fix merges a source's copies of addresses another source already has.
    if (addressesNow < addressesBefore * MIN_RECORD_SHARE) (shrinkable ? falls : found).push(`${addressesNow} addresses, ${addressesBefore} serving${shrinkable ? ' (named to shrink)' : ''}`);
    else if (report.records < before * MIN_RECORD_SHARE) falls.push(`${report.records} records, ${before} serving`);
  } else if (report.records < before * MIN_RECORD_SHARE) {
    // Named by hand for a connector's fix that drops records that shouldn't exist: someone who looked may accept it.
    (shrinkable ? falls : found).push(`${report.records} records, ${before} serving${shrinkable ? ' (named to shrink)' : ''}`);
  }
  if (moved.includes(entry.fips) && previous.source !== entry.source) return { found, falls };
  const oldReport = store.get(`${releasePath(entry.fips, previous.release)}/report.json`);
  if (oldReport) {
    const { fill } = JSON.parse(oldReport.toString('utf8'));
    for (const [group, { records, facts }] of Object.entries(fill)) {
      const now = report.fill[group];
      if (!now || records < 1000) continue;
      for (const [fact, count] of Object.entries(facts)) {
        const had = count / records;
        const has = (now.facts[fact] || 0) / now.records;
        if (had >= 0.2 && had - has > MAX_FILL_DROP) falls.push(`${group} ${fact} fell from ${Math.round(had * 100)}% to ${Math.round(has * 100)}%`);
      }
    }
  }
  const oldIds = store.get(`${releasePath(entry.fips, previous.release)}/ids.json.gz`);
  if (oldIds) {
    const was = JSON.parse(zlib.gunzipSync(oldIds).toString('utf8'));
    const now = new Set(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'ids.json.gz'))).toString('utf8')));
    const kept = was.filter((id) => now.has(id)).length;
    if (was.length && kept / was.length < minRetention) falls.push(`${kept} of ${was.length} accounts kept`);
  }
  return { found, falls };
}

/** How the release serving reads with the reader the servers run now, when it no longer finds its own homes; else null. */
function readsDifferently(store, county) {
  const name = releasePath(county.fips, county.release);
  const manifest = store.get(`${name}/manifest.json.gz`);
  const data = manifest && store.get(`${name}/data.bin`);
  if (!data) return null;
  const own = selfFind(manifest, data, county);
  return own.share !== null && own.share < MIN_SELF_FIND ? described(own) : null;
}

function readState(store, state) {
  const bytes = store.get(statePath(state));
  return bytes ? JSON.parse(bytes.toString('utf8')) : emptyState(state);
}

/** Counties live in any switch file. */
function liveCounties(store) {
  const live = new Set();
  for (const name of ['production', 'staging']) {
    const bytes = store.get(switchesPath(name));
    if (!bytes) continue;
    for (const [fips, county] of Object.entries(JSON.parse(bytes.toString('utf8')).counties || {})) if (county.mode === 'live') live.add(fips);
  }
  return live;
}

/**
 * Why a county's new build stays unpublished whatever its checks say (`kept`), or a line on why it goes on to them anyway.
 * The source hasn't published anything new since the release serving.
 * A run someone starts by hand publishes anyway: a new build of the same file can hold new address keys.
 * So does a scheduled one when the reader has changed since and no longer finds the release's homes.
 * The registry's builds list their rows by source: one source more or fewer, or more or fewer rows from one, is new too.
 * The file someone rolled back stays back until the source publishes a newer one or someone says otherwise.
 */
function leftAsServing(store, entry, serving, { republish, records }) {
  if (!serving || republish) return {};
  let note = null;
  if (serving.as_of === entry.as_of && serving.status === 'active') {
    const drift = records && readsDifferently(store, serving);
    if (!drift && sameSources(serving, entry)) return { kept: `${entry.fips}: unchanged since ${entry.as_of}` };
    note = drift ? `${entry.fips}: unchanged since ${entry.as_of}, but in the release serving ${drift}`
      : `${entry.fips}: dated ${entry.as_of} like the release serving, but its sources gave other rows`;
  }
  if (serving.rolled_back_as_of === entry.as_of) return { kept: `${entry.fips}: ${entry.as_of} was rolled back, not publishing it again` };
  return { note };
}

function publish(store, { out, prefix, republish, acceptFalls = false, acceptFallsFor = [], acceptShrinkFor = [], bulk = false, minRetention, moved }) {
  // The national floor's estimates (--prefix index/estimates) are counted, not held to the reader's answers.
  const records = prefix === 'index';
  const dir = path.join(out, 'counties');
  const entries = fs.readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
  const byState = new Map();
  for (const entry of entries) {
    if (!byState.has(entry.state)) byState.set(entry.state, []);
    byState.get(entry.state).push(entry);
  }
  const stateFiles = new Map([...byState.keys()].map((state) => [state, readState(store, state)]));
  const decided = new Map(entries.map((entry) => [entry.fips, leftAsServing(store, entry, stateFiles.get(entry.state).jurisdictions[entry.fips], { republish, records })]));
  // Every release at once, which a whole state of them needs; not those of builds that stay unpublished whatever their checks
  // say, so a run leaves no unused copies of counties it didn't change. A refused county's files go unused but stay to read.
  if (bulk) store.putDir(path.join(out, 'releases'), 'releases', entries.filter((entry) => decided.get(entry.fips).kept).map((entry) => `${entry.fips}/${entry.release}`));
  let refused = 0;
  const live = acceptShrinkFor.length ? liveCounties(store) : new Set();
  for (const fips of acceptShrinkFor.filter((name) => live.has(name))) console.log(`::error::${fips} is live: the shrink override never applies to it.`);
  for (const [state, built] of byState) {
    const stateFile = stateFiles.get(state);
    const rolledBackBefore = Object.fromEntries(Object.entries(stateFile.jurisdictions).map(([fips, county]) => [fips, county.rolled_back_at]));
    let changed = false;
    for (const entry of built) {
      const serving = stateFile.jurisdictions[entry.fips];
      const { kept, note } = decided.get(entry.fips);
      if (kept || note) log(kept || note);
      if (kept) continue;
      const shrinkable = (acceptFalls || acceptFallsFor.includes(entry.fips)) && acceptShrinkFor.includes(entry.fips) && !live.has(entry.fips);
      const { found, falls } = problems(store, entry, serving, out, minRetention, moved, records, shrinkable);
      if (found.length || (falls.length && !acceptFalls && !acceptFallsFor.includes(entry.fips))) {
        refused += 1;
        console.log(`::error::${entry.fips} ${entry.release} refused: ${[...found, ...falls].join('; ')}. The previous release keeps serving.`);
        continue;
      }
      if (falls.length) console.log(`::warning::${entry.fips} ${entry.release} accepted by hand: ${falls.join('; ')}.`);
      const name = releasePath(entry.fips, entry.release);
      if (!bulk) store.putDir(path.join(out, name), name);
      stateFile.jurisdictions[entry.fips] = { ...entry, previous: serving?.release || null, previous_as_of: serving?.as_of || null };
      changed = true;
      log(`${entry.fips}: ${entry.release} ready (${entry.records} records)`);
    }
    if (changed) {
      // A rollback doesn't wait for a build, so one may have landed while this state's files uploaded. It stays.
      for (const [fips, county] of Object.entries(readState(store, state).jurisdictions)) {
        if (county.rolled_back_at && county.rolled_back_at !== rolledBackBefore[fips]) stateFile.jurisdictions[fips] = county;
      }
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
    // Measured on the release being taken back, so no estimate rests on it. The next release brings its own.
    value_model: null,
    rolled_back_from: county.release,
    rolled_back_as_of: county.as_of,
    rolled_back_at: new Date().toISOString(),
  };
  store.putJson(statePath(state), { ...stateFile, updated_at: new Date().toISOString() });
  log(`${fips}: back on ${county.previous}`);
}

const opts = parseArgs(process.argv.slice(2));
const store = createStore(opts);
try {
  if (opts.rollback) rollback(store, opts.rollback, opts.state);
  else publish(store, opts);
} catch (err) {
  console.error(`Publishing failed: ${err.constructor === Error ? err.message : err.name}`);
  process.exit(1);
}
