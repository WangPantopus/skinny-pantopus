#!/usr/bin/env node
// T2's unit links need units from a different publication than the address points: the county records in the property index
// (assessors' rolls). This pulls a sample of each published county's unit addresses into <out>/<fips>/units.jsonl.gz, for
// registry-t2.cjs. Stays on the runner's disk for the run; prints counts only.
//   node scripts/property-index/registry-unit-truth.cjs --bucket <name> --out <dir> [--states MA,NY]
//   node scripts/property-index/registry-unit-truth.cjs --from <dir holding states/ and releases/> --out <dir>
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { releasePath } = require('../../backend/services/propertyRecords/format');
const { log } = require('./lib/log.cjs');

const PER_COUNTY = 4000;
// Homes as well as units: an assessor's roll confirms a home exists at an address, by a different publication from the points.
const HOMES_PER_COUNTY = 2000;
const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null);

function main() {
  const bucket = arg('--bucket');
  const from = arg('--from');
  const out = arg('--out');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'unit-truth-'));
  const aws = (...args) => execFileSync('aws', ['s3', ...args, '--only-show-errors'], { stdio: ['ignore', 'pipe', 'ignore'] });
  const local = (name) => {
    if (from) return path.join(from, name);
    const file = path.join(scratch, name.replace(/\//g, '_'));
    aws('cp', `s3://${bucket}/index/${name}`, file);
    return file;
  };
  let states = [];
  if (from) states = fs.readdirSync(path.join(from, 'states'));
  else {
    aws('cp', `s3://${bucket}/index/states/`, path.join(scratch, 'states'), '--recursive');
    states = fs.readdirSync(path.join(scratch, 'states'));
  }
  const only = arg('--states') ? new Set(arg('--states').split(',').map((state) => `${state}.json`)) : null;
  for (const name of states) {
    if (only && !only.has(name)) continue;
    const stateFile = JSON.parse(fs.readFileSync(from ? path.join(from, 'states', name) : path.join(scratch, 'states', name), 'utf8'));
    for (const [fips, county] of Object.entries(stateFile.jurisdictions)) {
      const dir = releasePath(fips, county.release);
      const manifest = JSON.parse(zlib.gunzipSync(fs.readFileSync(local(`${dir}/manifest.json.gz`))).toString('utf8'));
      const dataFile = local(`${dir}/data.bin`);
      const data = fs.readFileSync(dataFile);
      const units = [];
      const homes = [];
      let at = 0;
      for (const length of manifest.lengths) {
        for (const record of JSON.parse(zlib.gunzipSync(data.subarray(at, at + length)).toString('utf8'))) {
          if (record.kind === 'unit' && record.address.unit && !record.restricted) units.push(record.address);
          if (record.kind === 'property' && !record.address.unit && !record.restricted) homes.push(record.address);
        }
        at += length;
      }
      if (!from) fs.rmSync(dataFile, { force: true });
      const pick = (list, limit) => list.map((address) => [crypto.createHash('sha256').update(JSON.stringify(address)).digest('hex'), address]).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(0, limit).map(([, address]) => address);
      const sample = pick(units, PER_COUNTY);
      const homeSample = pick(homes, HOMES_PER_COUNTY);
      if (!sample.length && !homeSample.length) continue;
      fs.mkdirSync(path.join(out, fips), { recursive: true });
      if (sample.length) fs.writeFileSync(path.join(out, fips, 'units.jsonl.gz'), zlib.gzipSync(sample.map((address) => JSON.stringify(address)).join('\n')));
      if (homeSample.length) fs.writeFileSync(path.join(out, fips, 'homes.jsonl.gz'), zlib.gzipSync(homeSample.map((address) => JSON.stringify(address)).join('\n')));
      log(`${fips}: ${units.length} unit records, ${homes.length} homes, ${sample.length} and ${homeSample.length} sampled`);
    }
  }
}

try {
  main();
} catch (err) {
  // The index may have nothing yet; T2 reports unit links as untested.
  console.log(`Unit records unavailable: ${err.constructor === Error ? err.message : err.name}`);
}
