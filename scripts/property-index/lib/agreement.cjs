'use strict';
// The agreement score (docs/research/provider-replacement/full-page-plan.md section 6): per county and Property details
// row, how often the county's own record and a second source say the same thing about the same home. Measurement only.
// build.cjs compares each county that has a state file here with that file, built for the comparison and never
// published, and writes the counts into the release report; coverage.cjs prints them. Counts only, never a home.
//
// The same home: the same parcel number (letters and digits, leading zeros dropped), else the same address and unit,
// each only where it names one home on both sides. The same thing: what Property details would show from either one
// (years and counts exact, areas to the square foot, money to the dollar, acres to the hundredth, words ignoring case,
// spacing and punctuation). A value is compared only for the same value year, a sale price only for a sale on the same
// date or in the same month. Only facts both files fill are compared, and only where both show something. Words are
// compared only where both files use the same ones: a row where fewer than half the second file's words are ever the
// county's own is marked `different_words` and gets no share (two vocabularies for one thing, not disagreement).

const { FACTS } = require('../../../backend/services/propertyRecords/facts');
const { FIELDS, kindOf, shown } = require('./gaps.cjs');

// A share is published only from this many homes compared with a state file, or this many household answers.
const MIN_COMPARED = 100;
const MIN_ANSWERS = 30;

// The state file each county with its own connector can be compared with: the statewide source that leaves it out. Not
// the counties whose connector adds the county's building facts to that same file's records (Alachua, Martin, Osceola and
// St. Johns on Florida's roll; Ramsey reads the state's own parcel service), which would only agree with themselves, and
// not Scott, which the state's service doesn't open.
const STATE_FILES = {
  ...Object.fromEntries(['12057', '12086', '12115', '12117'].map((fips) => [fips, 'fl-roll'])),
  ...Object.fromEntries(['08001', '08013', '08014', '08031', '08077'].map((fips) => [fips, 'co-parcels'])),
  ...Object.fromEntries(['37031', '37051', '37097', '37109', '37119', '37133', '37163'].map((fips) => [fips, 'nc-onemap'])),
  ...Object.fromEntries(['48121', '48157', '48201', '48251'].map((fips) => [fips, 'tx-stratmap'])),
  ...Object.fromEntries(['53011', '53035', '53053', '53071'].map((fips) => [fips, 'wa-parcels'])),
  ...Object.fromEntries(['55025', '55079'].map((fips) => [fips, 'wi-parcels'])),
  '36055': 'ny-rolls',
};

// Every fact that fills a Property details row, and the county's value and last sale. Not the parcel number or the
// address, which say which home it is, nor the county and its code, which every record in a county shares, nor the
// property type, which the build words from each file's own kind of record (lib/derive.cjs).
const KEYS = new Set(['parcel_number', 'address_on_record', 'county', 'fips', 'property_type']);
const COMPARED = [...new Set([...FIELDS.flatMap((field) => field.facts), 'market_value', 'assessed_value', 'sale_price'])].filter((fact) => FACTS[fact] && !KEYS.has(fact));
const BY_VALUE_YEAR = new Set(['market_value', 'assessed_value']);
// Facts a county's connector takes from that same state file, so never compared: Miami-Dade's values are the state's roll.
const SAME_SOURCE = { '12086': new Set(['market_value', 'assessed_value', 'taxable_value', 'value_year']) };
const WORD_FORMATS = new Set(['text', 'code', 'name', 'raw']);

const words = (value) => String(value).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

/** Whether two values of one fact would show the same on Property details. */
function same(format, a, b) {
  if (['year', 'count', 'stories', 'baths'].includes(format)) return Number(a) === Number(b);
  if (['sqft', 'money'].includes(format)) return Math.round(Number(a)) === Math.round(Number(b));
  if (format === 'acres') return Math.round(Number(a) * 100) === Math.round(Number(b) * 100);
  return words(a) === words(b);
}

const parcelKey = (record) => {
  const text = String(record.facts?.parcel_number ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '');
  return text || null;
};
const addressKey = ({ address: a }) => (a?.number && a?.name ? [a.number, a.pre, a.name, a.suffix, a.post, a.unit, a.building, a.zip].map((part) => part || '').join('|') : null);

/** Each key that names exactly one home. */
function unique(records, keyOf) {
  const seen = new Map();
  for (const record of records) {
    const key = keyOf(record);
    if (key) seen.set(key, seen.has(key) ? null : record);
  }
  return seen;
}

const homes = (records) => records.filter((record) => !record.restricted && record.facts && kindOf(record));
// What the record holds, newly read facts still held off its county's screens included (build.cjs).
const factsOf = (record) => (record.held ? Object.assign({}, record.facts, ...Object.values(record.held)) : record.facts);

/**
 * @param {object[]} records      the county's own records, as they go in its release
 * @param {object[]} others       the second source's records for the same county
 * @param {object} other          { source, publisher, as_of } of the second source
 * @returns the release report's `agreement`
 */
function compareRecords(records, others, other, fips = null) {
  const skip = SAME_SOURCE[fips] || new Set();
  const mine = homes(records);
  const theirs = homes(others);
  const pairs = [];
  const used = new Set();
  const byParcel = unique(theirs, parcelKey);
  const mineByParcel = unique(mine, parcelKey);
  for (const [key, record] of mineByParcel) {
    const match = record && byParcel.get(key);
    if (!match) continue;
    pairs.push([record, match]);
    used.add(record).add(match);
  }
  const byParcelCount = pairs.length;
  const byAddress = unique(theirs.filter((record) => !used.has(record)), addressKey);
  for (const [key, record] of unique(mine.filter((record) => !used.has(record)), addressKey)) {
    const match = record && byAddress.get(key);
    if (match) pairs.push([record, match]);
  }
  const rows = {};
  const vocabulary = {};
  for (const pair of pairs) {
    const [a, b] = pair.map((record) => ({ facts: factsOf(record) }));
    for (const fact of COMPARED) {
      if (skip.has(fact)) continue;
      const { format } = FACTS[fact];
      if (!shown(format, a.facts[fact]) || !shown(format, b.facts[fact])) continue;
      if (BY_VALUE_YEAR.has(fact) && !(a.facts.value_year && a.facts.value_year === b.facts.value_year)) continue;
      // A lot both files give in acres compares once, in acres: its square feet are the build's own conversion of them.
      if (fact === 'lot_sqft' && shown('acres', a.facts.lot_acres) && shown('acres', b.facts.lot_acres)) continue;
      if (fact === 'sale_price') {
        const day = a.facts.sale_date && a.facts.sale_date === b.facts.sale_date;
        const month = (a.facts.sale_month || a.facts.sale_date?.slice(0, 7)) && (a.facts.sale_month || a.facts.sale_date?.slice(0, 7)) === (b.facts.sale_month || b.facts.sale_date?.slice(0, 7));
        if (!day && !month) continue;
      }
      rows[fact] = rows[fact] || { compared: 0, agree: 0 };
      rows[fact].compared += 1;
      if (same(format, a.facts[fact], b.facts[fact])) rows[fact].agree += 1;
      if (!WORD_FORMATS.has(format)) continue;
      vocabulary[fact] = vocabulary[fact] || { mine: new Set(), theirs: [] };
      vocabulary[fact].mine.add(words(a.facts[fact]));
      vocabulary[fact].theirs.push(words(b.facts[fact]));
    }
  }
  for (const [fact, { mine, theirs }] of Object.entries(vocabulary)) {
    if (theirs.filter((word) => mine.has(word)).length < theirs.length / 2) rows[fact].different_words = true;
  }
  return {
    source: other.source,
    publisher: other.publisher,
    as_of: other.as_of,
    homes: mine.length,
    matched: pairs.length,
    by_parcel: byParcelCount,
    by_address: pairs.length - byParcelCount,
    rows: Object.fromEntries(Object.entries(rows).sort((x, y) => COMPARED.indexOf(x[0]) - COMPARED.indexOf(y[0]))),
  };
}

module.exports = { STATE_FILES, MIN_COMPARED, MIN_ANSWERS, COMPARED, compareRecords, same };
