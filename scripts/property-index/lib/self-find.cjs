'use strict';
// Does a release find its own homes through the app's reader? Each sampled home is looked up the way the server does
// (backend/services/propertyRecords: the address reader on the line a person would type, the block its key sorts into,
// the identity contract), and finds itself when the answer is exact and names it. Several records answering for one
// address is the contract declining to guess, counted apart. A release built before a change to the reader can hold
// addresses the reader no longer reads the same way, and those homes answer "no record". Counts only.

const zlib = require('node:zlib');
const { findBlock } = require('../../../backend/services/propertyRecords/format');
const { parse, sortKey, zip5, city: cityKey } = require('../../../backend/services/propertyRecords/addressKey');
const { resolve } = require('../../../backend/services/propertyRecords/identity');

// Below this share of the homes the record answers for, a release doesn't read the way the app does.
const MIN_SELF_FIND = 0.98;
const SAMPLES = 1000;
const BLOCKS = 100;

const isHome = (record) => !record.restricted && record.address?.number && record.address?.name
  && (record.kind === 'property' || (record.kind === 'unit' && record.address.unit));

/** The street line and second line a person would type for a record's address. "121/2" is twelve and a half. */
function typed({ number, pre, name, suffix, post, unit, building }) {
  return {
    line1: [String(number).replace(/(\d)(\d\/\d)$/, '$1 $2'), pre, name, suffix, post].filter(Boolean).join(' '),
    unit: [building && `BLDG ${building}`, unit && `UNIT ${unit}`].filter(Boolean).join(' '),
  };
}

/**
 * @param {Buffer} manifestBytes  the release's manifest.json.gz
 * @param {Buffer} data           its data.bin
 * @param {object} county         { state, zips }: a home with no ZIP of its own gets one its county lists, as a person's would
 * @returns {{ asked: number, found: number, ambiguous: number, unreadable: number, no_record: number, other: number, share: number|null }}
 */
function selfFind(manifestBytes, data, { state, zips = [] }) {
  const { keys, lengths } = JSON.parse(zlib.gunzipSync(manifestBytes).toString('utf8'));
  const offsets = [];
  lengths.reduce((at, length, i) => { offsets[i] = at; return at + length; }, 0);
  const block = (i) => JSON.parse(zlib.gunzipSync(data.subarray(offsets[i], offsets[i] + lengths[i])).toString('utf8'));
  const counts = { asked: 0, found: 0, ambiguous: 0, unreadable: 0, no_record: 0, other: 0 };
  const picks = Math.min(BLOCKS, keys.length);
  const take = Math.ceil(SAMPLES / Math.max(1, picks));
  for (let n = 0; n < picks; n += 1) {
    const homes = block(Math.floor((n * keys.length) / picks)).filter(isHome);
    const step = Math.max(1, Math.floor(homes.length / take));
    for (let j = 0; j < homes.length && j < step * take; j += step) {
      const record = homes[j];
      const zip = record.address.zip || zips[counts.asked % Math.max(1, zips.length)] || '';
      const { line1, unit } = typed(record.address);
      counts.asked += 1;
      const parsed = parse(line1, unit, { state, zip });
      if (!parsed) {
        counts.unreadable += 1;
        continue;
      }
      const key = sortKey(parsed);
      const at = findBlock(keys, key);
      const answer = resolve({ ...parsed, zip: zip5(zip), city: cityKey(record.address.city) }, at < 0 ? [] : block(at).filter((other) => other.key === key));
      if (answer.match === 'exact' && answer.subject.id === record.id) counts.found += 1;
      else if (answer.match === 'ambiguous') counts.ambiguous += 1;
      else if (answer.match === 'unsupported') counts.no_record += 1;
      else counts.other += 1;
    }
  }
  const answerable = counts.asked - counts.ambiguous;
  return { ...counts, share: answerable ? counts.found / answerable : null };
}

/** One log line's worth: counts only. */
function described({ asked, found, ambiguous, unreadable, no_record: none, other }) {
  return `${found} of ${asked - ambiguous} sampled homes find themselves through the app's reader (unreadable ${unreadable}, no record ${none}, another answer ${other}; ${ambiguous} more share their address)`;
}

module.exports = { selfFind, described, MIN_SELF_FIND };
