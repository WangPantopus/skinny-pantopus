'use strict';
// Reads a county's built release from a local folder (scripts/property-index/build.cjs --out) for the property evaluation
// scripts, which print counts only. Real addresses stay out of Git and out of their output.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
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

module.exports = { openRelease };
