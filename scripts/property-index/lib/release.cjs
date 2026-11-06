'use strict';
// Writes one county's release (backend/services/propertyRecords/format.js says what's in it) and measures it.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { FORMAT, BLOCK_RAW_BYTES, KINDS, releasePath } = require('../../../backend/services/propertyRecords/format');
const { sortKey } = require('../../../backend/services/propertyRecords/addressKey');
const { log } = require('./log.cjs');

/** The share of `records` of each kind and home type holding each fact: counts only, safe for a public log. */
function fillReport(records) {
  const groups = new Map();
  for (const record of records) {
    const name = `${record.kind}:${record.home_type || '-'}`;
    if (!groups.has(name)) groups.set(name, { records: 0, facts: {} });
    const group = groups.get(name);
    group.records += 1;
    for (const fact of Object.keys(record.facts || {})) group.facts[fact] = (group.facts[fact] || 0) + 1;
  }
  return Object.fromEntries([...groups].sort((a, b) => b[1].records - a[1].records));
}

/**
 * @param {string} out      The build's output directory
 * @param {object} county   { fips, release, ... } the state file's entry for it, without its `path`
 * @param {object[]} records  A county's records; each gets its sort key here
 * @returns the release's report
 */
function writeRelease(out, county, records) {
  const dir = path.join(out, releasePath(county.fips, county.release));
  fs.mkdirSync(dir, { recursive: true });
  for (const record of records) {
    if (!KINDS.has(record.kind)) throw new Error(`A record of unknown kind ${record.kind}`);
    record.key = sortKey(record.address);
  }
  records.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const keys = [];
  const lengths = [];
  const fd = fs.openSync(path.join(dir, 'data.bin'), 'w');
  let bytes = 0;
  let current = [];
  let raw = 0;
  let largest = 0;
  const flush = () => {
    if (!current.length) return;
    const block = zlib.gzipSync(`[${current.join(',')}]`, { level: 9 });
    fs.writeSync(fd, block);
    lengths.push(block.length);
    bytes += block.length;
    largest = Math.max(largest, block.length);
    current = [];
    raw = 0;
  };
  let previousKey = null;
  for (const record of records) {
    // A block closes only between keys: all of one street name and number stay together.
    if (record.key !== previousKey && raw >= BLOCK_RAW_BYTES) flush();
    if (!current.length) keys.push(record.key);
    const json = JSON.stringify(record);
    current.push(json);
    raw += json.length + 1;
    previousKey = record.key;
  }
  flush();
  fs.closeSync(fd);

  const report = {
    fips: county.fips,
    release: county.release,
    records: records.length,
    blocks: keys.length,
    bytes,
    largest_block_bytes: largest,
    bytes_per_record: records.length ? Math.round(bytes / records.length) : 0,
    fill: fillReport(records),
  };
  fs.writeFileSync(path.join(dir, 'manifest.json.gz'), zlib.gzipSync(JSON.stringify({ v: FORMAT, fips: county.fips, release: county.release, keys, lengths })));
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report));
  log(`${county.fips} ${county.release}: ${records.length} records, ${keys.length} blocks, ${(bytes / 1e6).toFixed(1)} MB, ${report.bytes_per_record} B/record, largest block ${(largest / 1e3).toFixed(0)} KB`);
  return report;
}

module.exports = { writeRelease };
