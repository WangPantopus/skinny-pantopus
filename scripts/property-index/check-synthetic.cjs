#!/usr/bin/env node
// Reads the made-up county's release back (sources/synthetic.cjs) and checks what each kind of address answers, so a
// pull request that breaks the format or the identity answers fails without touching any real address.
//   node scripts/property-index/check-synthetic.cjs <out dir>
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { releasePath, findBlock } = require('../../backend/services/propertyRecords/format');
const { parse, sortKey } = require('../../backend/services/propertyRecords/addressKey');
const { resolve } = require('../../backend/services/propertyRecords/identity');

const out = process.argv[2];
const county = JSON.parse(fs.readFileSync(path.join(out, 'counties', '00001.json'), 'utf8'));
const dir = path.join(out, releasePath('00001', county.release));
const manifest = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'manifest.json.gz'))).toString('utf8'));
const data = fs.readFileSync(path.join(dir, 'data.bin'));
const offsets = [];
manifest.lengths.reduce((at, length, i) => { offsets[i] = at; return at + length; }, 0);

function answerFor(line, unit = '', zip = '00001') {
  const parsed = parse(line, unit);
  const key = sortKey(parsed);
  const index = findBlock(manifest.keys, key);
  const block = index < 0 ? [] : JSON.parse(zlib.gunzipSync(data.subarray(offsets[index], offsets[index] + manifest.lengths[index])).toString('utf8'));
  return resolve({ ...parsed, zip }, block.filter((record) => record.key === key));
}

const CASES = [
  ['A house', '120 NE 21st Avenue', '', '00001', 'exact', 'property'],
  ['A house, street type left out', '120 NE 21st', '', '00001', 'exact', 'property'],
  ['A condo with its unit', '500 Example Trust Ln', 'Apt 101', '00001', 'exact', 'unit'],
  ['The unit next door', '500 Example Trust Ln', '#102', '00001', 'exact', 'unit'],
  ['A unit with a leading zero', '500 Example Trust Lane', 'Unit 012', '00001', 'exact', 'unit'],
  ['A unit that doesn\'t exist', '500 Example Trust Ln', 'Apt 999', '00001', 'building_only', 'building'],
  ['A condo with no unit', '500 Example Trust Ln', '', '00001', 'building_only', 'building'],
  ['A rental tower', '700 Example Trust Ln', 'Apt 1201', '00001', 'building_only', 'building'],
  ['Land', '900 Example Trust Ln', '', '00001', 'parcel_only', 'parcel'],
  ['Two records at one address', '1000 Example Trust Ln', '', '00001', 'ambiguous', undefined],
  ['The right line in another ZIP', '1100 Example Trust Ln', '', '00001', 'unsupported', undefined],
  ['A protected record', '1200 Example Trust Ln', '', '00001', 'restricted', undefined],
  ['No record', '9999 Example Trust Ln', '', '00001', 'unsupported', undefined],
];

let failed = 0;
for (const [name, line, unit, zip, match, kind] of CASES) {
  const answer = answerFor(line, unit, zip);
  const right = answer.match === match && answer.subject?.kind === kind;
  if (!right) failed += 1;
  console.log(`${right ? 'ok  ' : 'FAIL'} ${name}: ${answer.match}${answer.subject ? ` (${answer.subject.kind})` : ''}`);
}
console.log(`${county.records} records in ${manifest.keys.length} blocks`);
if (failed) process.exit(1);
