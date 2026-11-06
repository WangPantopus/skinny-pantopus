#!/usr/bin/env node
// T2's unit links need units from a different publication than the address points: the county records in the property index
// (assessors' rolls). This pulls a sample of each published county's unit addresses into <out>/<fips>/units.jsonl.gz, for
// registry-t2.cjs. Stays on the runner's disk for the run; prints counts only.
//   node scripts/property-index/registry-unit-truth.cjs --bucket <name> --out <dir>
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
  for (const name of states) {
    const stateFile = JSON.parse(fs.readFileSync(from ? path.join(from, 'states', name) : path.join(scratch, 'states', name), 'utf8'));
    for (const [fips, county] of Object.entries(stateFile.jurisdictions)) {
      const dir = releasePath(fips, county.release);
      const manifest = JSON.parse(zlib.gunzipSync(fs.readFileSync(local(`${dir}/manifest.json.gz`))).toString('utf8'));
      const dataFile = local(`${dir}/data.bin`);
      const data = fs.readFileSync(dataFile);
      const units = [];
      let at = 0;
      for (const length of manifest.lengths) {
        for (const record of JSON.parse(zlib.gunzipSync(data.subarray(at, at + length)).toString('utf8'))) {
          if (record.kind === 'unit' && record.address.unit && !record.restricted) units.push(record.address);
        }
        at += length;
      }
      if (!from) fs.rmSync(dataFile, { force: true });
      const sample = units.map((address) => [crypto.createHash('sha256').update(JSON.stringify(address)).digest('hex'), address]).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(0, PER_COUNTY).map(([, address]) => address);
      if (!sample.length) continue;
      fs.mkdirSync(path.join(out, fips), { recursive: true });
      fs.writeFileSync(path.join(out, fips, 'units.jsonl.gz'), zlib.gzipSync(sample.map((address) => JSON.stringify(address)).join('\n')));
      log(`${fips}: ${units.length} unit records, ${sample.length} sampled`);
    }
  }
}

try {
  main();
} catch (err) {
  // The index may have nothing yet; T2 reports unit links as untested.
  console.log(`Unit records unavailable: ${err.constructor === Error ? err.message : err.name}`);
}
