#!/usr/bin/env node
// Fits each published county's value model (lib/value-model.cjs) from the release it's serving, and writes it into the
// county's line in its state file. No county file is downloaded again and no release changes, so it never makes anything
// go live: an estimate still follows each county's switch. Largest counties first, and each county is saved as it's done.
// .github/workflows/property-index.yml runs it with the storage key; a build does the same for the releases it makes.
//
//   node scripts/property-index/fit-models.cjs --bucket <name> [--prefix index] [--all] [--counties "<fips> ..."]
//   node scripts/property-index/fit-models.cjs --root <local index root> ...   the same against a local copy
//     --all       every county, not only those without a model (after the model changes)
//     --counties  only these
//
// The repository is public, so its job logs are too: this prints counts only.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { statePath, releasePath } = require('../../backend/services/propertyRecords/format');
const { openRelease } = require('../../backend/scripts/eval/lib/propertyRelease');
const { buildModel } = require('./lib/value-model.cjs');
const { log } = require('./lib/log.cjs');

function parseArgs(argv) {
  const opts = { prefix: 'index', all: false, counties: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--bucket') opts.bucket = argv[++i];
    else if (argv[i] === '--root') opts.root = argv[++i];
    else if (argv[i] === '--prefix') opts.prefix = argv[++i];
    else if (argv[i] === '--all') opts.all = true;
    else if (argv[i] === '--counties') opts.counties = new Set(argv[++i].split(/[\s,]+/).filter(Boolean));
    else throw new Error('usage: see the top of fit-models.cjs');
  }
  if (!opts.bucket === !opts.root) throw new Error('usage: see the top of fit-models.cjs');
  return opts;
}

/** The index's files, in storage or in a local folder. */
function createStore({ bucket, root, prefix }) {
  if (root) {
    return {
      list: () => fs.readdirSync(path.join(root, 'states')).filter((name) => name.endsWith('.json')),
      get: (name, file) => fs.copyFileSync(path.join(root, name), file),
      putJson: (name, data) => {
        const file = path.join(root, name);
        fs.writeFileSync(`${file}.tmp`, JSON.stringify(data));
        fs.renameSync(`${file}.tmp`, file);
      },
    };
  }
  const url = (name) => `s3://${bucket}/${prefix}/${name}`;
  // `aws s3 ls` takes no --only-show-errors.
  const aws = (args, quiet = true) => execFileSync('aws', ['s3', ...args, ...(quiet ? ['--only-show-errors'] : [])], { stdio: ['ignore', 'pipe', 'inherit'] });
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'value-models-'));
  return {
    list: () => aws(['ls', url('states/')], false).toString('utf8').split('\n').map((line) => line.trim().split(/\s+/).pop()).filter((name) => name?.endsWith('.json')),
    get: (name, file) => aws(['cp', url(name), file]),
    putJson: (name, data) => {
      const file = path.join(scratch, 'write');
      fs.writeFileSync(file, JSON.stringify(data));
      aws(['cp', file, url(name), '--content-type', 'application/json', '--cache-control', 'no-cache']);
    },
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const store = createStore(opts);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'value-models-work-'));
  const states = new Map();
  const queue = [];
  for (const name of store.list()) {
    const state = name.replace('.json', '');
    const file = path.join(work, name);
    store.get(statePath(state), file);
    const stateFile = JSON.parse(fs.readFileSync(file, 'utf8'));
    states.set(state, stateFile);
    for (const [fips, county] of Object.entries(stateFile.jurisdictions || {})) {
      const wanted = opts.counties ? opts.counties.has(fips) : (opts.all || county.value_model === undefined);
      if (wanted && county.release && county.status === 'active') queue.push({ state, fips, records: county.records || 0 });
    }
  }
  queue.sort((a, b) => b.records - a.records);
  log(`Value models to fit: ${queue.length} counties, ${queue.reduce((sum, item) => sum + item.records, 0)} records`);
  const counts = { fitted: 0, level_one: 0, failed: 0 };
  for (const { state, fips } of queue) {
    const county = states.get(state).jurisdictions[fips];
    const dir = path.join(work, releasePath(fips, county.release));
    try {
      fs.mkdirSync(dir, { recursive: true });
      for (const name of ['manifest.json.gz', 'data.bin']) store.get(`${releasePath(fips, county.release)}/${name}`, path.join(dir, name));
      fs.mkdirSync(path.join(work, 'counties'), { recursive: true });
      fs.writeFileSync(path.join(work, 'counties', `${fips}.json`), JSON.stringify(county));
      const release = openRelease(work, fips);
      const model = buildModel(release.records(), fips, county.as_of);
      // Read the state file again just before writing, so nothing written since is lost.
      const file = path.join(work, `${state}.json`);
      store.get(statePath(state), file);
      const fresh = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (fresh.jurisdictions?.[fips]?.release !== county.release) {
        log(`${fips}: a new release came out meanwhile, which brings its own model`);
      } else {
        fresh.jurisdictions[fips] = { ...fresh.jurisdictions[fips], value_model: model };
        store.putJson(statePath(state), fresh);
        states.set(state, fresh);
        counts.fitted += 1;
        const kinds = Object.keys(model?.types || {});
        if (kinds.length) counts.level_one += 1;
        log(`${fips}: ${kinds.length ? `${kinds.length} kinds of home measured on held-out sales` : 'no sales to measure on'}, ${Object.keys(model?.medians || {}).length} medians`);
      }
    } catch (err) {
      counts.failed += 1;
      console.log(`::warning::${fips}: no model (${err.constructor === Error ? err.message : err.name})`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  log(`Value models: ${JSON.stringify(counts)}`);
  if (counts.failed) process.exitCode = 1;
}

try {
  main();
} catch (err) {
  console.error(`Fitting value models failed: ${err.constructor === Error ? err.message : err.name}`);
  process.exit(1);
}
