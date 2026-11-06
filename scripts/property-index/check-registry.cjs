#!/usr/bin/env node
// Reads the made-up registry release back (sources/address/synthetic.cjs) and checks what each kind of address answers,
// so a pull request that breaks the merge or the answers fails without touching any real address.
//   node scripts/property-index/check-registry.cjs <out dir>
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { releasePath, findBlock } = require('../../backend/services/propertyRecords/format');
const { parse, sortKey } = require('../../backend/services/propertyRecords/addressKey');
const { resolve } = require('../../backend/services/propertyRecords/identity');
const { registryId } = require('../../backend/services/propertyRecords/registryFormat');

const out = process.argv[2];

function recordsAt(fips, key) {
  const county = JSON.parse(fs.readFileSync(path.join(out, 'counties', `${fips}.json`), 'utf8'));
  const dir = path.join(out, releasePath(fips, county.release));
  const manifest = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'manifest.json.gz'))).toString('utf8'));
  const data = fs.readFileSync(path.join(dir, 'data.bin'));
  const index = findBlock(manifest.keys, key);
  if (index < 0) return [];
  const at = manifest.lengths.slice(0, index).reduce((sum, length) => sum + length, 0);
  const block = JSON.parse(zlib.gunzipSync(data.subarray(at, at + manifest.lengths[index])).toString('utf8'));
  return block.filter((record) => record.key === key).map((record) => ({ ...record, id: registryId(fips, record.kind, record.address) }));
}

function answerFor(fips, line, unit = '', zip = '98660', where = {}) {
  const query = parse(line, unit, where);
  return resolve({ ...query, zip }, recordsAt(fips, sortKey(query)));
}

const CLARK = '53011';
const SAN_JUAN = fs.readdirSync(path.join(out, 'counties')).map((name) => name.slice(0, 5)).find((fips) => fips.startsWith('72'));
const CASES = [
  ['A house three sources agree on', CLARK, '100 NE Example Ave', '', 'exact', 'property', (a) => a.record.q === 'rooftop' && a.record.address.zip === '98660'],
  ['The house, spelled out', CLARK, '100 Northeast Example Avenue', '', 'exact', 'property'],
  ['A unit', CLARK, '200 Example St', 'Apt 101', 'exact', 'unit'],
  ['The unit next door', CLARK, '200 Example St', '#102', 'exact', 'unit'],
  ['Unit 012 and unit 12 are two units', CLARK, '200 Example St', '012', 'exact', 'unit', (a) => a.record.address.unit === '012'],
  ['Unit 12', CLARK, '200 Example St', '12', 'exact', 'unit', (a) => a.record.address.unit === '12'],
  ['A unit that doesn\'t exist asks', CLARK, '200 Example St', '999', 'building_only', 'building', (a) => a.reason === 'unit_not_found' && a.choices.length === 4],
  ['No unit asks, with the choices', CLARK, '200 Example St', '', 'building_only', 'building', (a) => a.reason === 'unit_needed' && a.choices.join() === '012,12,101,102'],
  ['A tower asks, with no list', CLARK, '300 Example St', '', 'building_only', 'building', (a) => a.unit_count === 40 && !a.choices],
  ['A tower\'s unit', CLARK, '300 Example St', '1017', 'exact', 'unit', (a) => Array.isArray(a.record.point) || !a.record.point],
  ['One line, this ZIP', CLARK, '400 Example St', '', 'exact', 'property'],
  ['No such house', CLARK, '999 Example St', '', 'unsupported', undefined],
  ['Two directions, none said', CLARK, '500 Example St', '', 'ambiguous', undefined],
  ['Two directions, one said', CLARK, '500 N Example St', '', 'exact', 'property'],
  ['Lettered buildings ask', CLARK, '600 Example St', '', 'building_only', 'building', (a) => a.choices.join() === 'A,B'],
  ['A lettered building', CLARK, '600 Example St', 'Bldg A', 'exact', 'unit'],
];

let failed = 0;
for (const [name, fips, line, unit, match, kind, more] of CASES) {
  const answer = answerFor(fips, line, unit);
  const right = answer.match === match && answer.subject?.kind === kind && (!more || more(answer));
  if (!right) failed += 1;
  console.log(`${right ? 'ok  ' : 'FAIL'} ${name}: ${answer.match}${answer.subject ? ` (${answer.subject.kind})` : ''}`);
}

// Puerto Rico's urbanizaciones keep two homes apart.
const none = answerFor(SAN_JUAN, '150 Calle Ejemplo', '', '00926', { state: 'PR' });
const named = answerFor(SAN_JUAN, '150 Calle Ejemplo, Urb Ejemplo Bajo', '', '00926', { state: 'PR' });
for (const [name, right] of [['Two urbanizaciones ask', none.match === 'ambiguous' && none.urbanizations?.length === 2], ['A named urbanizacion finds its home', named.match === 'exact']]) {
  if (!right) failed += 1;
  console.log(`${right ? 'ok  ' : 'FAIL'} ${name}`);
}

// IDs: the same address is the same ID, however the row was spelled, and two units are two IDs.
const house = recordsAt(CLARK, sortKey(parse('100 NE Example Ave')));
const units = recordsAt(CLARK, sortKey(parse('200 Example St'))).filter((record) => record.kind === 'unit');
for (const [name, right] of [['One house, one record', house.length === 1], ['Each unit its own ID', new Set(units.map((record) => record.id)).size === units.length && units.length === 4],
  ['IDs say what they name', house[0].id.startsWith('pp:addr:53011:') && units[0].id.startsWith('pp:unit:53011:')]]) {
  if (!right) failed += 1;
  console.log(`${right ? 'ok  ' : 'FAIL'} ${name}`);
}
if (failed) process.exit(1);
