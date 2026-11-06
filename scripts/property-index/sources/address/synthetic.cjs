'use strict';
// Made-up addresses for checking the registry build on a pull request, whose logs and runs are public: every street here
// is fictional. check-registry.cjs reads the release back. Real coordinates, so the county boundaries get used.

const LNG = -122.6;
const LAT = 45.65;

const row = (source, fields, offset = 0) => ({
  source, record: '', state: 'WA', city: 'EXAMPLEVILLE', zip: '98660', lng: LNG + offset / 1000, lat: LAT + offset / 1000, quality: 'unknown', use: '', ...fields,
});

function* made() {
  // A house two sources agree on, one better placed and one saying less.
  yield row('nad', { number: '100', pre: 'NE', name: 'EXAMPLE', suffix: 'AVE', quality: 'parcel', use: 'residential' }, 1);
  yield row('overture:us/wa/example', { number: '100', name: 'NE EXAMPLE AVE', zip: '', city: '' }, 1.0005);
  yield row('point:example', { number: '100', pre: 'NE', name: 'EXAMPLE', suffix: 'AVENUE', quality: 'rooftop' }, 1.0003);
  // A small building: units in two spellings, a base point.
  yield row('nad', { number: '200', name: 'EXAMPLE', suffix: 'ST', quality: 'structure' }, 2);
  for (const [source, unit] of [['nad', 'APT 101'], ['nad', '102'], ['overture:us/wa/example', '#102'], ['nad', 'UNIT 012'], ['nad', '12']]) {
    yield row(source, { number: '200', name: 'EXAMPLE', suffix: 'ST', unit }, 2);
  }
  // A tower: more units than a list should offer, no base point.
  for (let i = 1; i <= 40; i += 1) yield row('nad', { number: '300', name: 'EXAMPLE', suffix: 'ST', unit: `${1000 + i}` }, 3);
  // The same line in two ZIPs, far apart: two places.
  yield row('nad', { number: '400', name: 'EXAMPLE', suffix: 'ST', zip: '98660' }, 4);
  yield row('nad', { number: '400', name: 'EXAMPLE', suffix: 'ST', zip: '98661' }, 30);
  // Two sources disagreeing on a direction, far apart: two places, and the person has to say.
  yield row('nad', { number: '500', pre: 'N', name: 'EXAMPLE', suffix: 'ST' }, 5);
  yield row('nad', { number: '500', pre: 'S', name: 'EXAMPLE', suffix: 'ST' }, 25);
  // Buildings lettered, with no units under them.
  for (const building of ['A', 'B']) yield row('nad', { number: '600', name: 'EXAMPLE', suffix: 'ST', building }, 6);
  // Same number and street, two urbanizaciones of one ZIP (a made-up Puerto Rico).
  for (const [urbanization, offset] of [['EJEMPLO ALTO', 0], ['EJEMPLO BAJO', 8]]) {
    yield { ...row('nad', { number: '150', name: 'CALLE EJEMPLO', urbanization }), state: 'PR', zip: '00926', city: 'EJEMPLOVILLE', lng: -66.1 + offset / 1000, lat: 18.4 + offset / 1000 };
  }
  // The street the local rigs' address stand-ins answer for: a house, a small building, a tower.
  const rig = { name: 'EXAMPLE TRUST', suffix: 'LN', city: 'VANCOUVER' };
  yield row('nad', { ...rig, number: '5390', quality: 'rooftop', use: 'residential' }, 40);
  yield row('nad', { ...rig, number: '5391', quality: 'structure' }, 41);
  for (const unit of ['101', '102', '103']) yield row('nad', { ...rig, number: '5391', unit }, 41);
  for (let i = 1; i <= 40; i += 1) yield row('nad', { ...rig, number: '5392', unit: `${1200 + i}` }, 42);
}

async function* rows() {
  yield* made();
}

module.exports = { id: 'synthetic', rows, asOf: () => '2026-11-03' };
