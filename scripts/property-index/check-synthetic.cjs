#!/usr/bin/env node
// Reads the made-up county's release back (sources/synthetic.cjs) and checks what each kind of address answers, so a
// pull request that breaks the format or the identity answers fails without touching any real address.
//   node scripts/property-index/check-synthetic.cjs <out dir>
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { releasePath, findBlock } = require('../../backend/services/propertyRecords/format');
const { parse, parts, sortKey } = require('../../backend/services/propertyRecords/addressKey');
const { resolve } = require('../../backend/services/propertyRecords/identity');

const out = process.argv[2];
const county = JSON.parse(fs.readFileSync(path.join(out, 'counties', '00001.json'), 'utf8'));
const dir = path.join(out, releasePath('00001', county.release));
const manifest = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'manifest.json.gz'))).toString('utf8'));
const data = fs.readFileSync(path.join(dir, 'data.bin'));
const offsets = [];
manifest.lengths.reduce((at, length, i) => { offsets[i] = at; return at + length; }, 0);

function answerFor(line, unit = '', zip = '00001', where = {}) {
  const parsed = parse(line, unit, where);
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
  ['Two urbanizaciones, none named', '150 Calle Ejemplo', '', '00001', 'ambiguous', undefined],
  ['Two urbanizaciones, one named', '150 Calle Ejemplo, Urb Ejemplo Alto', '', '00001', 'exact', 'property'],
  ['Urbanizacion first', 'Urb Ejemplo Bajo 150 Calle Ejemplo', '', '00001', 'exact', 'property'],
  ['Urbanizacion on the second line', '150 Calle Ejemplo', 'Urb Ejemplo Bajo', '00001', 'exact', 'property'],
  ['A lettered house in Puerto Rico', 'A-1 Calle Ejemplo Urb Ejemplo Alto', '', '00001', 'exact', 'property', { state: 'PR' }],
];

let failed = 0;
for (const [name, line, unit, zip, match, kind, where] of CASES) {
  const answer = answerFor(line, unit, zip, where);
  const right = answer.match === match && answer.subject?.kind === kind;
  if (!right) failed += 1;
  console.log(`${right ? 'ok  ' : 'FAIL'} ${name}: ${answer.match}${answer.subject ? ` (${answer.subject.kind})` : ''}`);
}
console.log(`${county.records} records in ${manifest.keys.length} blocks`);

// Every form an American address comes in reads the same however it's spelled. Made-up streets only.
const key = (reading) => (reading ? [reading.form, reading.number, reading.pre, reading.name, reading.suffix, reading.post, reading.unit, reading.building, reading.urbanization || ''].join('|') : null);
const FORMS = [
  ['Direction and type', ['120 NE 21st Avenue', '120 Northeast 21 Ave', '120 N.E. 21ST AVE.'], 'street|120|NE|21|AVE|||', ''],
  ['A street called West', ['123 West St', '123 WEST STREET'], 'street|123||WEST|ST|||', ''],
  ['A street called Avenue B', ['123 Avenue B', '123 AVE B'], 'street|123||AVE B||||', ''],
  ['East Avenue K', ['123 E Avenue K', '123 East Ave K'], 'street|123|E|AVE K||||', ''],
  ['Direction after the type', ['123 Example Ave S', '123 Example Avenue South'], 'street|123||EXAMPLE|AVE|S||', ''],
  ['Utah grid', ['1234 S 500 E', '1234 South 500 East'], 'street|1234|S|500||E||', ''],
  ['Wisconsin grid', ['N89W16785 Example St', 'N89 W16785 Example St'], 'street|N89W16785||EXAMPLE|ST|||', ''],
  ['Queens and Hawaii numbers', ['123-45 67th Ave', '12345 67 Ave'], 'street|12345||67|AVE|||', ''],
  ['Half a number', ['123 1/2 Example St'], 'street|1231/2||EXAMPLE|ST|||', ''],
  ['County road', ['123 County Rd 12', '123 Co Rd 12', '123 County Road 12'], 'street|123||CR 12||||', ''],
  ['State route', ['123 State Route 9', '123 St Rt 9', '123 SR 9', '123 State Highway 9'], 'street|123||SR 9||||', ''],
  ['Highway keeps its number', ['123 Highway 99', '123 Hwy 99'], 'street|123||HIGHWAY 99||||', ''],
  ['Farm to market', ['123 FM 1960', '123 Farm to Market 1960', '123 Farm Rd 1960'], 'street|123||FM 1960||||', ''],
  ['Saint', ['123 St Example Rd', '123 Saint Example Rd'], 'street|123||SAINT EXAMPLE|RD|||', ''],
  ['Marks and okinas', ["123 Ka'ex\u0101mple St", '123 Kaexample St'], 'street|123||KAEXAMPLE|ST|||', ''],
  ['First is 1', ['123 First St', '123 1st St'], 'street|123||1|ST|||', ''],
  ['A street word in the name', ['123 Example Mountain View Rd', '123 Example Mtn Vw Rd'], 'street|123||EXAMPLE MTN VW|RD|||', ''],
  ['Front is a street here', ['123 Front St'], 'street|123||FRONT|ST|||', ''],
  ['Front is a unit here', ['123 Example St Front', '123 Example St'], 'street|123||EXAMPLE|ST||FRNT|', 'FRONT'],
  ['Apartment, inline', ['123 Example St Apt 4B', '123 Example St #4B', '123 Example St Apt #4-B', '123 Example St 4B', 'Apt 4B 123 Example St'], 'street|123||EXAMPLE|ST||4B|', ''],
  ['A dangling designator', ['123 Example St Apt', '123 Example St Unit', '123 Example St #'], 'street|123||EXAMPLE|ST|||', ''],
  ['Apartment, second line', ['123 Example St'], 'street|123||EXAMPLE|ST||4B|', 'Unit 4 B'],
  ['Leading zeros stay', ['123 Example St'], 'street|123||EXAMPLE|ST||012|', 'Apt 012'],
  ['Building and unit', ['123 Example St Bldg 2 Apt 4', '123 Example St Apt 4 Bldg 2'], 'street|123||EXAMPLE|ST||4|2', ''],
  ['A floor is not an apartment', ['123 Example St'], 'street|123||EXAMPLE|ST||FL2|', '2nd Floor'],
  ['Rural route', ['RR 2 Box 152', 'Rural Route 2 Box 152', 'RR2 BOX 152', 'RT 2 BOX 152'], 'rural_route|152||RR 2||||', ''],
  ['Highway contract route', ['HC 1 Box 23', 'HCR 1 Box 23', 'Highway Contract Route 1 Box 23'], 'rural_route|23||HC 1||||', ''],
  ['PO box', ['PO Box 123', 'P.O. Box 123', 'Post Office Box 123'], 'po_box|123||PO BOX||||', ''],
  ['Military', ['PSC 3 Box 1234', 'PSC3 BOX 1234'], 'military|1234||PSC 3||||', ''],
  ['Military unit', ['Unit 2050 Box 4190'], 'military|4190||UNIT 2050||||', ''],
  ['Kilometer in Puerto Rico', ['Carr 123 Km 5.2', 'Carretera 123 KM 5 HM 2'], 'kilometer|KM5.2||CARR 123||||', '', { state: 'PR' }],
  ['Spanish order', ['Calle Ejemplo #123', '123 Calle Ejemplo'], 'street|123||CALLE EJEMPLO||||', '', { state: 'PR' }],
  ['Avenida', ['Avenida Ejemplo 1500', '1500 Ave Ejemplo'], 'street|1500||AVE EJEMPLO||||', '', { state: 'PR' }],
  ['Not an address', ['Example Street'], null, ''],
];
for (const [name, lines, want, unit, where] of FORMS) {
  for (const line of lines) {
    const trimmed = (text) => text && text.replace(/\|+$/, '');
    const right = trimmed(key(parse(line, unit, where))) === trimmed(want);
    if (!right) failed += 1;
    console.log(`${right ? 'ok  ' : 'FAIL'} ${name}: ${right ? 'reads the same' : 'reads differently'}`);
  }
}
// A publisher's columns and a person's line reach the same key, whatever words the street's name holds.
const COLUMNS = [
  ['A street word ending the name', { number: '123', name: 'EXAMPLE VIEW', suffix: 'DR' }, '123 Example View Dr'],
  ['A street word ending the name, no type column', { number: '123', name: 'EXAMPLE VIEW DR' }, '123 Example View Dr'],
  ['A direction starting the name', { number: '123', pre: 'N', name: 'EAST EXAMPLE', suffix: 'AVE' }, '123 N East Example Ave'],
  ['A direction ending the name', { number: '123', name: 'EXAMPLE NORTH', suffix: 'AVE', post: 'S' }, '123 Example North Ave S'],
  ['A column repeated in the name', { number: '123', pre: 'N', name: 'N EXAMPLE ST', suffix: 'ST' }, '123 N Example St'],
  ['Everything in the name', { number: '123', name: 'N EXAMPLE PARK AVE S' }, '123 N Example Park Ave S'],
];
for (const [name, columns, line] of COLUMNS) {
  const a = parts(columns);
  const b = parse(line);
  const right = ['number', 'pre', 'name', 'suffix', 'post'].every((field) => a[field] === b[field]);
  if (!right) failed += 1;
  console.log(`${right ? 'ok  ' : 'FAIL'} ${name}`);
}
if (failed) process.exit(1);
