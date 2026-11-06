#!/usr/bin/env node
// Builds the US public places index the Plans place picker reads (backend/services/plans/placesIndex.js, which
// describes the format) from Geofabrik's OpenStreetMap extracts, and in the same run the venues index the post
// place-tag picker reads (backend/services/geo/venues.js; placesIndexFormat VENUES). For each extract in turn:
// download it (checked against Geofabrik's md5), keep the elements either index asks for (one osmium
// tags-filter), export them with their geometry and put each element's middle in its area (geohash 4 for the
// Plans index, 5 for the venues). Elements on both sides of a state line are kept once. Writes
// <out>/manifest.json and <out>/places-<yyyymmdd>.bin, and <out>/venues-manifest.json and
// <out>/venues-<yyyymmdd>.bin.
// .github/workflows/places-index.yml runs it monthly and publishes the result (scripts/places/publish-index.sh).
//
//   node scripts/places/build-index.cjs --out <dir> [--work <dir>] [--regions us/washington,us/oregon]
//   node scripts/places/build-index.cjs --out <dir> --pbf washington-latest.osm.pbf [--pbf …]
//     --regions  Geofabrik ids to download (default: every us/* extract in Geofabrik's index)
//     --pbf      local extracts instead of downloads
//     --work     where downloads and temporary files go (default: <out>/work); each is deleted after use
// Needs osmium-tool (1.14 or newer) and curl.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { encodeGeohash } = require('../../backend/utils/geohash');
const placesIndex = require('../../backend/services/plans/placesIndexFormat');

const GEOFABRIK_INDEX = 'https://download.geofabrik.de/index-v1-nogeom.json';

function parseArgs(argv) {
  const opts = { pbf: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') opts.out = argv[++i];
    else if (arg === '--work') opts.work = argv[++i];
    else if (arg === '--regions') opts.regions = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--pbf') opts.pbf.push(argv[++i]);
    else throw new Error(`Unknown argument ${arg}`);
  }
  if (!opts.out) throw new Error('usage: build-index.cjs --out <dir> [--work <dir>] [--regions …] [--pbf <file> …]');
  return opts;
}

const log = (line) => console.log(`${new Date().toISOString()} ${line}`);

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
}

/** Geofabrik's us/* extracts (the 50 states, DC, Puerto Rico, the US Virgin Islands), or the ones asked for. */
async function geofabrikRegions(wanted) {
  const response = await fetch(GEOFABRIK_INDEX);
  if (!response.ok) throw new Error(`Geofabrik's index answered ${response.status}`);
  const all = (await response.json()).features.map((f) => f.properties).filter((p) => p.id.startsWith('us/'));
  const chosen = wanted ? all.filter((p) => wanted.includes(p.id)) : all;
  const missing = (wanted || []).filter((id) => !chosen.some((p) => p.id === id));
  if (missing.length) throw new Error(`Not in Geofabrik's index: ${missing.join(', ')}`);
  return chosen.map((p) => ({ id: p.id, url: p.urls.pbf }));
}

function md5Of(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    fs.createReadStream(file).on('data', (chunk) => hash.update(chunk)).on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

async function download(region, file) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      run('curl', ['-fsSL', '--retry', '5', '--retry-delay', '20', '-o', file, region.url]);
      const expected = execFileSync('curl', ['-fsSL', '--retry', '5', `${region.url}.md5`], { encoding: 'utf8' }).split(/\s+/)[0];
      const actual = await md5Of(file);
      if (actual !== expected) throw new Error(`md5 ${actual}, Geofabrik says ${expected}`);
      return;
    } catch (err) {
      if (attempt >= 3) throw new Error(`${region.id}: ${err.message}`);
      log(`${region.id}: download failed (${err.message}), trying again`);
    }
  }
}

/** The extract's data timestamp (osmosis_replication_timestamp in its header), or null. */
function extractTimestamp(file) {
  try {
    return execFileSync('osmium', ['fileinfo', '-g', 'header.option.osmosis_replication_timestamp', file], { encoding: 'utf8' }).trim() || null;
  } catch (_) {
    return null;
  }
}

/** The middle of a geometry's bounding box (what Overpass's `out center` gives for a way) and half its size. */
function middleOf(geometry) {
  let south = Infinity; let north = -Infinity; let west = Infinity; let east = -Infinity;
  const visit = (coords) => {
    if (typeof coords[0] === 'number') {
      const [lng, lat] = coords;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      return;
    }
    for (const c of coords) visit(c);
  };
  visit(geometry.coordinates);
  if (!Number.isFinite(south)) return null;
  return {
    lat: (south + north) / 2, lng: (west + east) / 2, halfLat: (north - south) / 2, halfLng: (east - west) / 2,
  };
}

// The two indexes one run builds. The Plans one's files and manifest are as they were before the venues.
const SETS = [
  {
    prefix: 'places',
    manifest: 'manifest.json',
    precision: placesIndex.PRECISION,
    selectors: placesIndex.SELECTORS,
    selected: placesIndex.selected,
    tags: placesIndex.TAGS,
    extra: {},
  },
  {
    prefix: 'venues',
    manifest: 'venues-manifest.json',
    precision: placesIndex.VENUES.PRECISION,
    selectors: placesIndex.VENUES.SELECTORS,
    selected: placesIndex.venueSelected,
    tags: placesIndex.VENUES.TAGS,
    extra: { set: placesIndex.VENUES.NAME, version: placesIndex.VENUES.VERSION },
  },
].map((set) => ({ ...set, areas: new Map(), seen: new Set() }));

const OSM_TYPES = { node: 'n', way: 'w', relation: 'r' };

/** Osmium tags-filter expressions for every set's selectors ("*" values: the key with any value). */
function filterExpressions() {
  return SETS.flatMap((set) => set.selectors.map(([types, key, values]) => (values === '*'
    ? `${types}/${key}` : `${types}/${key}=${values.join(',')}`)));
}

/** Adds one extract's selected elements to each set's `areas` (geohash → elements); its `seen` keeps each once. */
async function readExtract(pbf, work) {
  const filtered = path.join(work, 'filtered.osm.pbf');
  run('osmium', ['tags-filter', pbf, ...filterExpressions(), '-o', filtered, '--overwrite', '--no-progress']);
  const exporter = spawn('osmium', ['export', filtered, '-f', 'geojsonseq', '-a', 'type,id',
    '-x', 'print_record_separator=false', '-o', '-', '--no-progress'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const exited = new Promise((resolve, reject) => {
    exporter.on('error', reject);
    exporter.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`osmium export exited ${code}`))));
  });
  const added = SETS.map(() => 0);
  for await (const line of readline.createInterface({ input: exporter.stdout, crlfDelay: Infinity })) {
    if (!line.trim()) continue;
    const feature = JSON.parse(line);
    const props = feature.properties || {};
    const type = OSM_TYPES[props['@type']];
    if (!type) continue;
    const key = `${type}${props['@id']}`;
    let middle;
    SETS.forEach((set, i) => {
      if (!set.selected(type, props) || set.seen.has(key)) return;
      if (middle === undefined) middle = (feature.geometry && middleOf(feature.geometry)) || null;
      if (!middle) return;
      set.seen.add(key);
      const area = encodeGeohash(middle.lat, middle.lng, set.precision);
      if (!set.areas.has(area)) set.areas.set(area, []);
      set.areas.get(area).push(placesIndex.encodeElement(type, props['@id'], middle.lat, middle.lng, props,
        middle.halfLat, middle.halfLng, set.tags));
      added[i] += 1;
    });
  }
  await exited;
  fs.rmSync(filtered, { force: true });
  return added;
}

/** Writes one set's data file (each area's elements, gzip'd, back to back) and its manifest. */
function writeIndex(set, out, built, sources, timestamps) {
  const dataName = `${set.prefix}-${built.toISOString().slice(0, 10).replace(/-/g, '')}.bin`;
  const fd = fs.openSync(path.join(out, dataName), 'w');
  const regions = {};
  let offset = 0;
  for (const area of [...set.areas.keys()].sort()) {
    const elements = set.areas.get(area).sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] < b[0] ? -1 : 1));
    const bytes = zlib.gzipSync(JSON.stringify(elements), { level: 9 });
    fs.writeSync(fd, bytes);
    regions[area] = [offset, bytes.length, elements.length];
    offset += bytes.length;
  }
  fs.closeSync(fd);
  const manifest = {
    v: placesIndex.FORMAT,
    ...set.extra,
    precision: set.precision,
    built_at: built.toISOString(),
    osm_data_as_of: timestamps.sort()[0] || null,
    sources: sources.map((s) => s.id),
    data: dataName,
    bytes: offset,
    count: set.seen.size,
    attribution: '© OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)',
    regions,
  };
  fs.writeFileSync(path.join(out, set.manifest), JSON.stringify(manifest));
  log(`wrote ${dataName}: ${set.seen.size} elements in ${set.areas.size} areas, ${(offset / 1e6).toFixed(1)} MB`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const work = opts.work || path.join(opts.out, 'work');
  fs.mkdirSync(opts.out, { recursive: true });
  fs.mkdirSync(work, { recursive: true });
  const sources = opts.pbf.length
    ? opts.pbf.map((file) => ({ id: path.basename(file), file }))
    : await geofabrikRegions(opts.regions);
  log(`${sources.length} extracts`);

  const timestamps = [];
  for (const source of sources) {
    const pbf = source.file || path.join(work, 'extract.osm.pbf');
    if (!source.file) await download(source, pbf);
    const stamp = extractTimestamp(pbf);
    if (stamp) timestamps.push(stamp);
    const added = await readExtract(pbf, work);
    if (!source.file) fs.rmSync(pbf, { force: true });
    log(`${source.id}: ${SETS.map((set, i) => `${set.prefix} ${added[i]} (${set.seen.size} in all, ${set.areas.size} areas)`)
      .join('; ')}`);
  }
  for (const set of SETS) {
    if (set.seen.size === 0) throw new Error(`No ${set.prefix} elements: nothing to publish`);
  }

  const built = new Date();
  for (const set of SETS) writeIndex(set, opts.out, built, sources, timestamps);
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
