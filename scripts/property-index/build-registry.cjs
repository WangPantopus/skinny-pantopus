#!/usr/bin/env node
// Builds the address registry (backend/services/propertyRecords/registryFormat.js): every address and unit the rights
// register allows, one release per county, from sources/address/. .github/workflows/address-registry.yml runs it and
// publishes the result to private storage (publish.cjs --prefix index/registry).
//
//   node scripts/property-index/build-registry.cjs --out <dir> --work <dir> [--sources nad,overture] [--states WA,OR] [--phase split|merge]
//
// The repository is public, so its job logs are too: this prints counts only. No packages but the DuckDB command-line
// tool for Overture's Parquet files.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const readline = require('node:readline');
const { parts, zip5, city: cityKey, stateOfCounty } = require('../../backend/services/propertyRecords/addressKey');
const { registryId } = require('../../backend/services/propertyRecords/registryFormat');
const { writeRelease } = require('./lib/release.cjs');
const { loadCounties } = require('./lib/counties.cjs');
const { mergeCounty } = require('./lib/registry.cjs');
const { download } = require('./lib/tables.cjs');
const { log } = require('./lib/log.cjs');

// The Census Bureau's ZIP areas and the counties they overlap: an address reaches its county even when no source there says its ZIP.
const ZIP_COUNTIES_URL = 'https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt';
const ALL_SOURCES = ['points', 'nad', 'overture', 'openaddresses'];
// A county's points before national compilations, when equally well placed.
const SOURCE_RANKS = { point: 0, nad: 1, overture: 2, openaddresses: 2, synthetic: 3 };
// How long an address release answers before it reads as out of date: the National Address Database comes about quarterly.
const STALE_AFTER_DAYS = 540;
const FLUSH_BYTES = 256 * 1024;
// What sources write for a number or unit that isn't there.
const NOT_GIVEN = /^(0+|N\/?A|NONE|NULL)$/i;
const US = (lng, lat) => (lat > 17 && lat < 72 && lng > -180 && lng < -64) || (lat > -15 && lat < 21 && (lng > 144 || lng < -168));

function parseArgs(argv) {
  const opts = { sources: ALL_SOURCES, states: null, phase: 'all' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') opts.out = argv[++i];
    else if (argv[i] === '--work') opts.work = argv[++i];
    else if (argv[i] === '--sources') opts.sources = argv[++i].split(',');
    else if (argv[i] === '--states') opts.states = new Set(argv[++i].split(','));
    else if (argv[i] === '--phase') opts.phase = argv[++i];
    else throw new Error('Unknown argument: see the top of build-registry.cjs');
  }
  if (!opts.out || !opts.work) throw new Error('usage: see the top of build-registry.cjs');
  return opts;
}

/** One gzip file per county, appended to in chunks: a whole county never sits in memory until it's merged. */
function createPartitions(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const buffers = new Map();
  const flush = (fips, chunks) => fs.appendFileSync(path.join(dir, `${fips}.jsonl.gz`), zlib.gzipSync(chunks.join(''), { level: 1 }));
  return {
    add(fips, row) {
      const line = `${JSON.stringify(row)}\n`;
      let held = buffers.get(fips);
      if (!held) {
        held = { chunks: [], bytes: 0 };
        buffers.set(fips, held);
      }
      held.chunks.push(line);
      held.bytes += line.length;
      if (held.bytes >= FLUSH_BYTES) {
        flush(fips, held.chunks);
        held.chunks = [];
        held.bytes = 0;
      }
    },
    close() {
      for (const [fips, held] of buffers) if (held.chunks.length) flush(fips, held.chunks);
      buffers.clear();
    },
  };
}

/** Reads each source's rows into county partitions. Sources are indexed in `sources.json`, so a row carries a small number. */
async function split(opts) {
  const dir = path.join(opts.work, 'partitions');
  fs.rmSync(dir, { recursive: true, force: true });
  const counties = loadCounties(opts.work);
  const partitions = createPartitions(dir);
  const sourceNames = [];
  const sourceIndex = new Map();
  const about = {};
  for (const id of opts.sources) {
    // eslint-disable-next-line global-require
    const source = require(`./sources/address/${path.basename(id)}.cjs`);
    about[source.id] = { as_of: source.asOf() };
    const counts = { rows: 0, kept: 0, no_point: 0, unreadable: 0, no_county: 0, other_state: 0 };
    for await (const row of source.rows({ work: opts.work, states: opts.states })) {
      counts.rows += 1;
      if (counts.rows % 10000000 === 0) log(`${source.id}: ${counts.rows} rows so far`);
      if (!Number.isFinite(row.lng) || !Number.isFinite(row.lat) || !US(row.lng, row.lat)) {
        counts.no_point += 1;
        continue;
      }
      const number = NOT_GIVEN.test(row.number) ? '' : row.number;
      const address = parts({ ...row, number });
      if (!address) {
        counts.unreadable += 1;
        continue;
      }
      // A house a source gives unit "0" stays a house, not a one-unit building that asks which unit is yours.
      if (NOT_GIVEN.test(address.unit)) address.unit = '';
      if (NOT_GIVEN.test(address.building)) address.building = '';
      const fips = counties.locate(row.lng, row.lat);
      if (!fips) {
        counts.no_county += 1;
        continue;
      }
      if (row.state && stateOfCounty(fips) !== row.state) {
        counts.other_state += 1;
        continue;
      }
      let index = sourceIndex.get(row.source);
      if (index === undefined) {
        index = sourceNames.length;
        sourceNames.push(row.source);
        sourceIndex.set(row.source, index);
      }
      counts.kept += 1;
      partitions.add(fips, [address.number, address.pre, address.name, address.suffix, address.post, address.unit, address.building, address.urbanization || '',
        cityKey(row.city), zip5(row.zip), row.lng, row.lat, row.quality, row.use || '', index]);
    }
    partitions.close();
    log(`${source.id}: ${Object.entries(counts).map(([name, n]) => `${name} ${n}`).join(', ')}`);
  }
  fs.writeFileSync(path.join(opts.work, 'partitions.json'), JSON.stringify({ sources: sourceNames, about, names: [...counties.names] }));
}

/** Per county, the ZIP areas overlapping it. */
function zipsOfCounties(work) {
  const file = path.join(work, 'geo', 'zcta-county.txt');
  download(ZIP_COUNTIES_URL, file);
  const [header, ...lines] = fs.readFileSync(file, 'utf8').replace(/^\ufeff/, '').split('\n');
  const columns = header.split('|');
  const zipAt = columns.indexOf('GEOID_ZCTA5_20');
  const countyAt = columns.indexOf('GEOID_COUNTY_20');
  const counties = new Map();
  for (const line of lines) {
    const fields = line.split('|');
    if (!fields[zipAt] || !fields[countyAt]) continue;
    if (!counties.has(fields[countyAt])) counties.set(fields[countyAt], []);
    counties.get(fields[countyAt]).push(fields[zipAt]);
  }
  return counties;
}

async function readPartition(file) {
  const rows = [];
  const input = fs.createReadStream(file).pipe(zlib.createGunzip());
  for await (const line of readline.createInterface({ input, crlfDelay: Infinity })) rows.push(JSON.parse(line));
  return rows;
}

function addDays(date, days) {
  return new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
}

/** Merges each county's partition and writes its release, ready for publish.cjs. */
async function merge(opts) {
  const dir = path.join(opts.work, 'partitions');
  const { sources: sourceNames, about, names } = JSON.parse(fs.readFileSync(path.join(opts.work, 'partitions.json'), 'utf8'));
  const countyNames = new Map(names);
  const ranks = sourceNames.map((name) => SOURCE_RANKS[name.split(':')[0]] ?? 3);
  const built = new Date();
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.jsonl.gz')).sort();
  fs.mkdirSync(path.join(opts.out, 'counties'), { recursive: true });
  const coverage = [];
  const census = zipsOfCounties(opts.work);
  for (const name of files) {
    const fips = name.slice(0, 5);
    const state = stateOfCounty(fips);
    if (opts.states && !opts.states.has(state)) continue;
    const rows = await readPartition(path.join(dir, name));
    const rowsBySource = {};
    for (const row of rows) rowsBySource[sourceNames[row[14]]] = (rowsBySource[sourceNames[row[14]]] || 0) + 1;
    const records = mergeCounty(rows, ranks);
    // A county's records name their source by its place in this county's own list.
    const localSources = Object.keys(rowsBySource);
    const localIndex = new Map(localSources.map((source, i) => [sourceNames.indexOf(source), i]));
    for (const record of records) record.s = localIndex.get(record.s);
    const newest = Object.values(about).map((source) => source.as_of).sort().pop();
    const asOf = Object.keys(rowsBySource).map((source) => about[source.split(':')[0]]?.as_of || newest).sort().pop();
    const release = `${asOf.replace(/-/g, '')}-${built.toISOString().slice(0, 16).replace(/[-:T]/g, '').slice(4)}`;
    const report = writeRelease(opts.out, { fips, release }, records);
    const zips = new Set();
    const cities = new Set();
    const counts = { property: 0, building: 0, unit: 0, residential: 0, with_zip: 0 };
    const placed = {};
    for (const record of records) {
      counts[record.kind] += 1;
      if (record.use === 'r') counts.residential += 1;
      if (record.address.zip) {
        zips.add(record.address.zip);
        counts.with_zip += 1;
      }
      if (record.address.city) cities.add(record.address.city);
      if (record.q) placed[record.q] = (placed[record.q] || 0) + 1;
    }
    const sources = Object.fromEntries(Object.entries(rowsBySource).sort((a, b) => b[1] - a[1]));
    const entry = {
      fips,
      state,
      name: countyNames.get(fips) || fips,
      publisher: 'Pantopus address registry',
      dataset: 'Address points',
      method: 'address_points',
      source: 'registry',
      as_of: asOf,
      release,
      imported_at: built.toISOString(),
      stale_after: addDays(asOf, STALE_AFTER_DAYS),
      status: 'active',
      zips: [...new Set([...zips, ...(census.get(fips) || [])])].sort(),
      cities: [...cities].sort(),
      records: report.records,
      source_names: localSources,
      sources,
      counts,
      placed,
    };
    fs.writeFileSync(path.join(opts.out, 'counties', `${fips}.json`), JSON.stringify(entry));
    // A sample of its IDs, for the next release's retention check (publish.cjs). All of them would cost more than the addresses.
    const sample = records.map((record) => registryId(fips, record.kind, record.address)).filter((id) => id.endsWith('a')).sort();
    fs.writeFileSync(path.join(opts.out, 'releases', fips, release, 'ids.json.gz'), zlib.gzipSync(JSON.stringify(sample)));
    coverage.push({ fips, state, name: entry.name, records: report.records, bytes: report.bytes, ...counts, sources: Object.keys(sources).length });
  }
  fs.writeFileSync(path.join(opts.out, 'coverage.json'), JSON.stringify(coverage));
  const total = coverage.reduce((sum, county) => sum + county.records, 0);
  const bytes = coverage.reduce((sum, county) => sum + county.bytes, 0);
  log(`${coverage.length} counties, ${total} records, ${(bytes / 1e9).toFixed(2)} GB, ${total ? Math.round(bytes / total) : 0} B/record`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  fs.mkdirSync(opts.work, { recursive: true });
  if (opts.phase !== 'merge') await split(opts);
  if (opts.phase !== 'split') await merge(opts);
}

main().catch((err) => {
  // Error messages can quote what was being parsed. Ours name a column or a count; anything else prints its kind only.
  const ours = err.constructor === Error && !/JSON|Unexpected/.test(err.message);
  console.error(`The build failed: ${ours ? err.message : err.name}`);
  console.error((err.stack || '').split('\n').slice(1, 6).filter((line) => line.includes('property-index')).join('\n'));
  process.exit(1);
});
