'use strict';
// Writes one county's release (backend/services/propertyRecords/format.js says what's in it) and measures it.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { FORMAT, BLOCK_RAW_BYTES, KINDS, releasePath } = require('../../../backend/services/propertyRecords/format');
const { sortKey } = require('../../../backend/services/propertyRecords/addressKey');
const { log } = require('./log.cjs');
const { KINDS: LEDGER_KINDS, kindOf, gapsOf } = require('./gaps.cjs');

/** The share of `records` of each kind and home type holding each fact: counts only, safe for a public log. */
function fillReport(records) {
  const groups = new Map();
  for (const record of records) {
    const name = `${record.kind}:${record.home_type || '-'}`;
    if (!groups.has(name)) groups.set(name, { records: 0, facts: {} });
    const group = groups.get(name);
    group.records += 1;
    for (const fact of Object.keys(record.facts || {})) group.facts[fact] = (group.facts[fact] || 0) + 1;
    // Facts held off a live county's screens until its switch is on (format.js `held`), by list.
    for (const [list, facts] of Object.entries(record.held || {})) {
      group.held = group.held || {};
      group.held[list] = group.held[list] || {};
      for (const fact of Object.keys(facts)) group.held[list][fact] = (group.held[list][fact] || 0) + 1;
    }
  }
  return Object.fromEntries([...groups].sort((a, b) => b[1].records - a[1].records));
}

/**
 * The page score (full-page-plan.md section 6): for each kind and home type, how many of the Property details rows that
 * apply to that kind of home (lib/gaps.cjs, the missing-facts ledger's rule) each home's page fills, as its page shows
 * them; a unit's page counts its building's own figures too. Counts only.
 */
function pageReport(records) {
  const buildings = new Map(records.filter((record) => record.kind === 'building').map((record) => [record.id, record]));
  const groups = new Map();
  for (const record of records) {
    const kind = !record.restricted && kindOf(record);
    if (!kind) continue;
    const name = `${record.kind}:${record.home_type || '-'}`;
    if (!groups.has(name)) groups.set(name, { rows: LEDGER_KINDS[kind].fields.length, filled: [], withHeld: [] });
    const group = groups.get(name);
    const building = record.parent ? buildings.get(record.parent) : null;
    group.filled.push(group.rows - gapsOf(record, building).missing.length);
    // The same page once its county shows every list of held facts (format.js `held`).
    const shown = (one) => (one?.held ? { ...one, facts: Object.assign({}, one.facts, ...Object.values(one.held)) } : one);
    if (record.held || building?.held) group.withHeld.push(group.rows - gapsOf(shown(record), shown(building)).missing.length);
    else group.withHeld.push(group.filled[group.filled.length - 1]);
  }
  const at = (sorted, share) => sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))];
  const summary = (filled) => {
    const sorted = [...filled].sort((a, b) => a - b);
    const mean = sorted.reduce((sum, n) => sum + n, 0) / sorted.length;
    return { mean: Number(mean.toFixed(2)), p10: at(sorted, 0.1), median: at(sorted, 0.5), p90: at(sorted, 0.9) };
  };
  return Object.fromEntries([...groups].sort((a, b) => b[1].filled.length - a[1].filled.length).map(([name, { rows, filled, withHeld }]) => {
    const now = summary(filled);
    const later = summary(withHeld);
    return [name, { homes: filled.length, rows, ...now, ...(later.mean !== now.mean ? { with_held: later } : {}) }];
  }));
}

/**
 * Writes a release's blocks and manifest, key by key: records come in sorted, and all of one key stay in one block.
 * @returns {{ add: (key: string, json: string) => void, close: (records: number, fill: object) => object }}
 */
function blockWriter(out, county) {
  const dir = path.join(out, releasePath(county.fips, county.release));
  fs.mkdirSync(dir, { recursive: true });
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
  return {
    add(key, json) {
      // A block closes only between keys: all of one street name and number stay together.
      if (key !== previousKey && raw >= BLOCK_RAW_BYTES) flush();
      if (!current.length) keys.push(key);
      current.push(json);
      raw += json.length + 1;
      previousKey = key;
    },
    close(records, fill, page) {
      flush();
      fs.closeSync(fd);
      const report = {
        fips: county.fips,
        release: county.release,
        records,
        blocks: keys.length,
        bytes,
        largest_block_bytes: largest,
        bytes_per_record: records ? Math.round(bytes / records) : 0,
        fill,
        ...(page ? { page } : {}),
      };
      fs.writeFileSync(path.join(dir, 'manifest.json.gz'), zlib.gzipSync(JSON.stringify({ v: FORMAT, fips: county.fips, release: county.release, keys, lengths })));
      fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report));
      log(`${county.fips} ${county.release}: ${records} records, ${keys.length} blocks, ${(bytes / 1e6).toFixed(1)} MB, ${report.bytes_per_record} B/record, largest block ${(largest / 1e3).toFixed(0)} KB`);
      return report;
    },
  };
}

/**
 * @param {string} out      The build's output directory
 * @param {object} county   { fips, release, ... } the state file's entry for it, without its `path`
 * @param {object[]} records  A county's records; each gets its sort key here
 * @returns the release's report
 */
function writeRelease(out, county, records) {
  for (const record of records) {
    if (!KINDS.has(record.kind)) throw new Error(`A record of unknown kind ${record.kind}`);
    record.key = sortKey(record.address);
  }
  records.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const writer = blockWriter(out, county);
  for (const record of records) writer.add(record.key, JSON.stringify(record));
  return writer.close(records.length, fillReport(records), pageReport(records));
}

module.exports = { writeRelease, blockWriter, pageReport };
