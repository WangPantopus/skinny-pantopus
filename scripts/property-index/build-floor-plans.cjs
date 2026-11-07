#!/usr/bin/env node
// A building's floor-plan sheet to a release of the property index (backend/services/propertyRecords/floorPlanFormat.js):
// the step after a person has read a sheet and its permission in the review queue. A release is written first; replacing
// its state's file is what publishes it, so a failed run leaves the sheet that's serving as it is. Prints counts only.
//
//   node scripts/property-index/build-floor-plans.cjs --sheet <reviewed.json> --fips <county> --to <dir or s3://bucket/prefix>
//   node scripts/property-index/build-floor-plans.cjs --withdraw <sheet id> --state <ST> --to <...>   its facts leave every Home's copy
//   node scripts/property-index/build-floor-plans.cjs --rollback <sheet id> --state <ST> --to <...>   back to its previous release
//
// <reviewed.json> is the case's `sheet` from the queue, kept outside Git: a real building's sheet is never in this
// repository. The sheet's date says what it's as of; a new sheet for the building replaces the old as a new release, and
// the old one stays in storage, unedited, for --rollback. s3:// needs the aws command and a key that can write there.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { sortKey } = require('../../backend/services/propertyRecords/addressKey');
const { FORMAT, statePath, sheetPath, readSheet, sheetRelease } = require('../../backend/services/propertyRecords/floorPlanFormat');
const { log } = require('./lib/log.cjs');

function parseArgs(argv) {
  const opts = {};
  const names = { '--sheet': 'sheet', '--fips': 'fips', '--to': 'to', '--withdraw': 'withdraw', '--rollback': 'rollback', '--state': 'state' };
  for (let i = 0; i < argv.length; i += 1) {
    if (!names[argv[i]]) throw new Error('Unknown argument: see the top of build-floor-plans.cjs');
    opts[names[argv[i]]] = argv[++i];
  }
  const publishing = opts.sheet && opts.fips;
  const moving = (opts.withdraw || opts.rollback) && opts.state;
  if (!opts.to || !(publishing || moving)) throw new Error('Usage: see the top of build-floor-plans.cjs');
  return opts;
}

/** Where releases go: a folder, or a bucket through the aws command, as publish.cjs writes it. */
function createStore(to) {
  if (!to.startsWith('s3://')) {
    const root = to.replace(/^file:\/\//, '');
    return {
      get: (name) => (fs.existsSync(path.join(root, name)) ? fs.readFileSync(path.join(root, name)) : null),
      put(name, bytes) {
        const file = path.join(root, name);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(`${file}.tmp`, bytes);
        fs.renameSync(`${file}.tmp`, file);
      },
    };
  }
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'floor-plans-'));
  const aws = (args) => execFileSync('aws', ['s3', ...args, '--only-show-errors'], { stdio: ['ignore', 'ignore', 'inherit'] });
  return {
    get(name) {
      const file = path.join(scratch, 'read');
      try {
        aws(['cp', `${to}/${name}`, file]);
        return fs.readFileSync(file);
      } catch (_) {
        return null;
      }
    },
    put(name, bytes) {
      const file = path.join(scratch, 'write');
      fs.writeFileSync(file, bytes);
      aws(['cp', file, `${to}/${name}`]);
    },
  };
}

function readStates(store, state) {
  const bytes = store.get(statePath(state));
  const file = bytes ? JSON.parse(bytes.toString('utf8')) : { v: FORMAT, state, sheets: {}, streets: {} };
  if (file.v !== FORMAT) throw new Error('A state file this script can\'t read');
  return file;
}

/** Which street keys reach which sheets, from the sheets in force. */
function withStreets(file, addressesOf) {
  const streets = {};
  for (const [id, entry] of Object.entries(file.sheets)) {
    if (entry.status !== 'active') continue;
    for (const key of addressesOf(id, entry)) (streets[key] = streets[key] || []).push(id);
  }
  return { ...file, streets, updated_at: new Date().toISOString() };
}

const writeState = (store, file) => store.put(statePath(file.state), Buffer.from(JSON.stringify(file)));
const keysOf = (sheet) => [...new Set(sheet.building.addresses.map(sortKey))];

function readRelease(store, id, release) {
  const bytes = store.get(sheetPath(id, release));
  if (!bytes) throw new Error('A release the state file names is missing');
  return JSON.parse(zlib.gunzipSync(bytes).toString('utf8'));
}

// Each sheet's street keys are kept beside it, so changing one sheet doesn't read all the others.
const streetsFromEntries = (id, entry) => entry.keys;

function publish(store, opts) {
  const { sheet, problems, summary } = readSheet(JSON.parse(fs.readFileSync(opts.sheet, 'utf8')));
  if (!sheet) throw new Error(`The sheet has problems: ${problems.join('; ')}`);
  const built = new Date();
  const release = `${sheet.as_of.replace(/-/g, '')}-${built.toISOString().slice(0, 19).replace(/[-:T]/g, '').slice(4)}`;
  const document = sheetRelease(sheet, opts.fips, release);
  store.put(sheetPath(document.id, release), zlib.gzipSync(JSON.stringify(document), { level: 9 }));
  const file = readStates(store, sheet.state);
  const before = file.sheets[document.id];
  file.sheets[document.id] = {
    release,
    previous: before?.status === 'active' ? before.release : before?.previous || null,
    as_of: sheet.as_of,
    status: 'active',
    permission_scope: sheet.permission.scope,
    keys: keysOf(document),
    imported_at: built.toISOString(),
  };
  writeState(store, withStreets(file, streetsFromEntries));
  log(`${sheet.state} sheet ${document.id} ${release}: ${summary.plans} plans, ${summary.mapped_units} units named, ${summary.unmapped_plans} plans with no units`);
}

function move(store, opts) {
  const id = opts.withdraw || opts.rollback;
  const file = readStates(store, opts.state.toUpperCase());
  const entry = file.sheets[id];
  if (!entry) throw new Error('That sheet isn\'t in this state');
  if (opts.withdraw) {
    file.sheets[id] = { ...entry, status: 'withdrawn', withdrawn_at: new Date().toISOString() };
  } else {
    if (!entry.previous) throw new Error('That sheet has no previous release');
    const previous = readRelease(store, id, entry.previous);
    file.sheets[id] = { ...entry, release: entry.previous, previous: null, as_of: previous.as_of, status: 'active', keys: keysOf(previous), rolled_back_at: new Date().toISOString() };
  }
  writeState(store, withStreets(file, streetsFromEntries));
  log(`${opts.state} sheet ${id}: ${opts.withdraw ? 'withdrawn' : 'back to its previous release'}`);
}

try {
  const opts = parseArgs(process.argv.slice(2));
  const store = createStore(opts.to.replace(/\/+$/, ''));
  if (opts.sheet) publish(store, opts);
  else move(store, opts);
} catch (err) {
  // Ours name a problem or a count; anything else prints its kind only.
  const ours = err.constructor === Error && !/JSON|Unexpected/.test(err.message);
  console.error(`The sheet wasn't published: ${ours ? err.message : err.name}`);
  process.exit(1);
}
