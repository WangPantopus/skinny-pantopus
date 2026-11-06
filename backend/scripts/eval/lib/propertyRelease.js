'use strict';
// Reads a county's built release from a local folder (scripts/property-index/build.cjs --out) for the property evaluation
// scripts, which print counts only. Real addresses stay out of Git and out of their output.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const zlib = require('zlib');
const { spawn } = require('child_process');
const { releasePath, findBlock } = require('../../../services/propertyRecords/format');

function openRelease(out, fips) {
  const county = JSON.parse(fs.readFileSync(path.join(out, 'counties', `${fips}.json`), 'utf8'));
  const dir = path.join(out, releasePath(fips, county.release));
  const manifest = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'manifest.json.gz'))).toString('utf8'));
  const data = fs.readFileSync(path.join(dir, 'data.bin'));
  const offsets = [];
  let at = 0;
  for (const length of manifest.lengths) {
    offsets.push(at);
    at += length;
  }
  const block = (i) => JSON.parse(zlib.gunzipSync(data.subarray(offsets[i], offsets[i] + manifest.lengths[i])).toString('utf8'));
  return {
    county,
    /** Every record, block by block. */
    * records() {
      for (let i = 0; i < manifest.keys.length; i += 1) yield* block(i);
    },
    /** The records at one sort key. */
    at(key) {
      const i = findBlock(manifest.keys, key);
      return i < 0 ? [] : block(i).filter((record) => record.key === key);
    },
  };
}

// Dallas's certified appraisal roll: fixed-width lines, columns from the layout in its zip (first and last, counting from
// 1). Owner columns are in the same lines and are never cut out of them.
const DALLAS_ROLL = {
  account: [10, 26], number: [435, 441], half: [442, 446], direction: [447, 448], name: [449, 471], suffix: [472, 475], suite: [476, 481],
  acres: [790, 798], land: [799, 809], improvement: [821, 831], taxable: [924, 934], market: [2205, 2213], use: [2235, 2237], privacy: [2484, 2484],
};

async function* dallasRoll(zip) {
  const unzip = spawn('unzip', ['-p', zip, 'REAL_APRL_ROLL_DALLAS_CO_*.DAT'], { stdio: ['ignore', 'pipe', 'ignore'] });
  unzip.stdout.setEncoding('latin1');
  for await (const line of readline.createInterface({ input: unzip.stdout, crlfDelay: Infinity })) {
    yield Object.fromEntries(Object.entries(DALLAS_ROLL).map(([field, [first, last]]) => [field, line.slice(first - 1, last).trim()]));
  }
}

module.exports = { openRelease, dallasRoll };
