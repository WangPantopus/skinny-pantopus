#!/usr/bin/env node
// T2, the identity check (docs/research/provider-replacement/parity-and-acceptance.md), on one state's freshly built
// registry release: right after it's merged, before it's published. Prints and saves counts per state; no address ever.
//
//   node scripts/property-index/registry-t2.cjs --out <dir> --state WA --truth <dir> --report <file> [--units <dir of county index releases>]
//   node scripts/property-index/registry-t2.cjs --summary <dir of reports>
//
// What each part proves:
//   premises      Federal housing records (HUD: tax-credit, assisted multifamily, public housing). Independent of address
//                 points: each publishes its own address and location. Must reach the right building: 95% of them.
//   unit links    Unit records from the county's assessor, a different publication from the points. Linked ones must be right.
//   adjacent      Two units of one building must be two subjects, each the unit asked for.
//   out of range  A unit number made up here, offline, one per building: must not match.
//   towers        A unit typed at an address with no units on record: the building, never a unit.
//   ambiguous     One line, several places, nothing to tell them apart: must ask.
//
// A quarter of the federal records are held for tuning the reader (--dev shows those instead), by a hash of the address.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { answer } = require('../../backend/services/propertyRecords/registryLookup');
const { releasePath, findBlock } = require('../../backend/services/propertyRecords/format');
const { parts, stateOfCounty } = require('../../backend/services/propertyRecords/addressKey');
const { USER_AGENT } = require('./lib/tables.cjs');
const { log } = require('./lib/log.cjs');

const HUD = 'https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services';
const TRUTH_LAYERS = [
  { name: 'tax-credit', url: `${HUD}/LIHTC/FeatureServer/0`, fields: { line1: 'STD_ADDR', city: 'STD_CITY', state: 'STD_ST', zip: 'STD_ZIP5', units: 'N_UNITS' } },
  { name: 'assisted', url: `${HUD}/MULTIFAMILY_PROPERTIES_ASSISTED/FeatureServer/0`, fields: { line1: 'STD_ADDR', city: 'STD_CITY', state: 'STD_ST', zip: 'STD_ZIP5', units: 'TOTAL_UNIT_COUNT' } },
  { name: 'public-housing', url: `${HUD}/Public_Housing_Buildings/FeatureServer/0`, fields: { line1: 'STD_ADDR', city: 'STD_CITY', state: 'STD_ST', zip: 'STD_ZIP5', units: 'TOTAL_UNITS' } },
];
const FLOOR_PER_STATE = 20;
const MAX_PREMISES = 400;
const BLOCKS_PER_COUNTY = 40;
const PER_PART_PER_COUNTY = 40;
// A federal location is geocoded, and a complex is large: within this it's the same place.
const SAME_PLACE_METERS = 500;
const WRONG_PLACE_METERS = 2000;
const COARSE_AT = 3;

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') opts.out = argv[++i];
    else if (argv[i] === '--state') opts.state = argv[++i];
    else if (argv[i] === '--truth') opts.truth = argv[++i];
    else if (argv[i] === '--report') opts.report = argv[++i];
    else if (argv[i] === '--units') opts.units = argv[++i];
    else if (argv[i] === '--summary') opts.summary = argv[++i];
    else if (argv[i] === '--dev') opts.dev = true;
    else throw new Error('Unknown argument: see the top of registry-t2.cjs');
  }
  return opts;
}

const hashOf = (text) => crypto.createHash('sha256').update(text).digest();

/** Every row of a federal layer, page by page, kept on disk for the run. */
async function truthRows(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const rows = [];
  for (const layer of TRUTH_LAYERS) {
    const file = path.join(dir, `${layer.name}.json`);
    if (!fs.existsSync(file)) {
      const kept = [];
      const fields = Object.values(layer.fields).join(',');
      for (let offset = 0; ;) {
        const query = new URLSearchParams({ where: '1=1', outFields: fields, returnGeometry: 'true', outSR: '4326', orderByFields: 'OBJECTID', resultOffset: String(offset), resultRecordCount: '1000', f: 'json' });
        const response = await fetch(`${layer.url}/query?${query}`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(120000) });
        if (!response.ok) throw new Error(`A federal layer answered ${response.status}`);
        const page = await response.json();
        if (page.error) throw new Error(`A federal layer answered error ${page.error.code}`);
        for (const { attributes, geometry } of page.features || []) {
          // Some layers keep a ZIP as a number, losing New England's and Puerto Rico's leading zeros.
          const zip = String(attributes[layer.fields.zip] ?? '').padStart(5, '0');
          if (geometry) kept.push({ line1: attributes[layer.fields.line1], city: attributes[layer.fields.city], state: attributes[layer.fields.state], zip, units: attributes[layer.fields.units], lat: geometry.y, lng: geometry.x, from: layer.name });
        }
        offset += (page.features || []).length;
        if (!page.features?.length || !page.exceededTransferLimit) break;
      }
      fs.writeFileSync(file, JSON.stringify(kept));
      log(`${layer.name}: ${kept.length} federal records`);
    }
    for (const row of JSON.parse(fs.readFileSync(file, 'utf8'))) rows.push(row);
  }
  return rows;
}

function localRegistry(out, state) {
  const counties = fs.readdirSync(path.join(out, 'counties')).map((name) => JSON.parse(fs.readFileSync(path.join(out, 'counties', name), 'utf8'))).filter((county) => county.state === state);
  const jurisdictions = Object.fromEntries(counties.map((county) => [county.fips, county]));
  const zips = {};
  const cities = {};
  for (const county of counties) {
    for (const zip of county.zips) (zips[zip] ||= []).push(county.fips);
    for (const city of county.cities) (cities[city] ||= []).push(county.fips);
  }
  const opened = new Map();
  function open(fips, release) {
    if (!opened.has(fips)) {
      const dir = path.join(out, releasePath(fips, release));
      const manifest = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'manifest.json.gz'))).toString('utf8'));
      const offsets = [];
      manifest.lengths.reduce((at, length, i) => { offsets[i] = at; return at + length; }, 0);
      opened.set(fips, { manifest, offsets, fd: fs.openSync(path.join(dir, 'data.bin'), 'r') });
    }
    return opened.get(fips);
  }
  function block(fips, release, index) {
    const { manifest, offsets, fd } = open(fips, release);
    const bytes = Buffer.alloc(manifest.lengths[index]);
    fs.readSync(fd, bytes, 0, bytes.length, offsets[index]);
    return JSON.parse(zlib.gunzipSync(bytes).toString('utf8'));
  }
  const read = {
    stateFile: async () => ({ jurisdictions, zips, cities }),
    recordsAt: async (fips, release, key) => {
      const index = findBlock(open(fips, release).manifest.keys, key);
      return index < 0 ? [] : block(fips, release, index).filter((record) => record.key === key);
    },
  };
  return { read, counties, open, block };
}

function metersBetween(lat1, lng1, lat2, lng2) {
  const scale = Math.cos((lat1 * Math.PI) / 180);
  return Math.hypot((lng1 - lng2) * scale * 111320, (lat1 - lat2) * 110540);
}

/** Federal records in this state. */
async function premises(report, truth, state, read, dev) {
  // One address once: a housing authority's buildings often share theirs.
  const unique = new Map();
  for (const row of truth) if (row.state === state && row.line1 && !unique.has(`${row.line1}|${row.zip}`)) unique.set(`${row.line1}|${row.zip}`, row);
  const mine = [...unique.entries()].map(([key, row]) => ({ row, hash: hashOf(key) }))
    .filter(({ hash }) => (hash[0] % 4 === 0) === Boolean(dev)).sort((a, b) => Buffer.compare(a.hash, b.hash)).slice(0, MAX_PREMISES);
  const part = report.premises;
  // Several addresses on one federal point: that's a ZIP's or a town's middle, and says nothing about where a building is.
  const shared = new Map();
  for (const row of unique.values()) {
    const at = `${row.lat.toFixed(4)},${row.lng.toFixed(4)}`;
    shared.set(at, (shared.get(at) || 0) + 1);
  }
  for (const { row } of mine) {
    const found = await answer({ line1: row.line1, city: row.city, state, zip: row.zip }, read);
    part.n += 1;
    if (found.match === 'unsupported' || found.match === 'stale') {
      part[found.reason === 'unreadable_address' ? 'unreadable' : 'no_record'] += 1;
      continue;
    }
    if (found.match === 'ambiguous') {
      part.asked += 1;
      continue;
    }
    const point = found.record?.point;
    const distance = point ? metersBetween(row.lat, row.lng, point[1], point[0]) : Infinity;
    if (distance <= SAME_PLACE_METERS) part.right += 1;
    else if (shared.get(`${row.lat.toFixed(4)},${row.lng.toFixed(4)}`) >= COARSE_AT) part.coarse += 1;
    else if (distance > WRONG_PLACE_METERS) part.wrong_place += 1;
    else part.near += 1;
  }
}

/** Parts sampled from the release itself: adjacent units, made-up units, typed units with no roster, lines that must ask. */
async function controls(report, registry, state) {
  for (const county of registry.counties) {
    const { manifest } = registry.open(county.fips, county.release);
    const blocks = [...manifest.keys.keys()].sort((a, b) => Buffer.compare(hashOf(`${county.fips}:${a}`), hashOf(`${county.fips}:${b}`))).slice(0, BLOCKS_PER_COUNTY);
    const counts = { adjacent: 0, invalid: 0, towers: 0, ambiguous: 0 };
    for (const index of blocks) {
      const records = registry.block(county.fips, county.release, index);
      const byKey = new Map();
      for (const record of records) {
        if (!byKey.has(record.key)) byKey.set(record.key, []);
        byKey.get(record.key).push(record);
      }
      for (const here of byKey.values()) {
        const base = here[0].address;
        for (const building of here.filter((record) => record.kind === 'building')) {
          const where = building.address;
          const fullLine = [where.number, where.pre, where.name, where.suffix, where.post].filter(Boolean).join(' ');
          const units = here.filter((record) => record.kind === 'unit' && record.address.zip === where.zip && record.address.pre === where.pre && record.address.suffix === where.suffix && record.address.post === where.post && !record.address.building);
          if (units.length >= 2 && counts.adjacent < PER_PART_PER_COUNTY) {
            const [one, two] = units.slice(0, 2).map((record) => record.address.unit);
            const [a, b] = await Promise.all([one, two].map((unit) => answer({ line1: fullLine, unit: `APT ${unit}`, city: where.city, state, zip: where.zip }, registry.read)));
            counts.adjacent += 1;
            report.adjacent.n += 1;
            const right = a.match === 'exact' && b.match === 'exact' && a.subject.id !== b.subject.id && a.record.address.unit === one && b.record.address.unit === two;
            if (!right) {
              if (a.match === 'exact' && b.match === 'exact') report.adjacent.wrong += 1;
              else report.adjacent.asked += 1;
            }
          }
          if (building.roster?.length && counts.invalid < PER_PART_PER_COUNTY) {
            // A number no building here lists. Made up here, and only ever asked of our own files.
            const madeUp = `${'9'.repeat(Math.max(...building.roster.map((unit) => unit.length)) + 1)}7`;
            const found = await answer({ line1: fullLine, unit: madeUp, city: where.city, state, zip: where.zip }, registry.read);
            counts.invalid += 1;
            report.invalid.n += 1;
            if (found.match === 'exact') report.invalid.wrong += 1;
          }
        }
        const homes = here.filter((record) => record.kind === 'property');
        if (homes.length === 1 && here.length === 1 && counts.towers < PER_PART_PER_COUNTY) {
          const where = homes[0].address;
          const fullLine = [where.number, where.pre, where.name, where.suffix, where.post].filter(Boolean).join(' ');
          const found = await answer({ line1: fullLine, unit: 'APT 9997', city: where.city, state, zip: where.zip }, registry.read);
          counts.towers += 1;
          report.towers.n += 1;
          if (found.match === 'exact') report.towers.wrong += 1;
        }
        // One name and number, more than one place, in one ZIP, asked without a direction or type.
        const zips = new Map();
        for (const record of here.filter((candidate) => candidate.kind !== 'unit')) {
          const key = record.address.zip || '';
          if (!zips.has(key)) zips.set(key, []);
          zips.get(key).push(record);
        }
        for (const [zip, group] of zips) {
          // A record with no direction or type is what a bare line means; every one of these needs one to tell them apart.
          const allSaySomething = group.every(({ address }) => address.pre || address.suffix || address.post);
          if (zip && group.length > 1 && allSaySomething && !group.some((record) => record.address.urbanization) && counts.ambiguous < PER_PART_PER_COUNTY) {
            const found = await answer({ line1: `${base.number} ${base.name}`, city: group[0].address.city, state, zip }, registry.read);
            counts.ambiguous += 1;
            report.ambiguous.n += 1;
            if (found.match === 'exact') report.ambiguous.wrong += 1;
          }
        }
      }
    }
  }
}

/** Units on an assessor's roll, where one's published for this state: linked to the right unit, or asked about, never another. */
async function unitLinks(report, unitsDir, state, read) {
  if (!unitsDir || !fs.existsSync(unitsDir)) return;
  for (const fips of fs.readdirSync(unitsDir).filter((name) => stateOfCounty(name) === state)) {
    const file = path.join(unitsDir, fips, 'units.jsonl.gz');
    if (!fs.existsSync(file)) continue;
    for (const line of zlib.gunzipSync(fs.readFileSync(file)).toString('utf8').split('\n').filter(Boolean)) {
      const address = JSON.parse(line);
      const where = parts(address);
      if (!where?.unit) continue;
      const found = await answer({ line1: [where.number, where.pre, where.name, where.suffix, where.post].filter(Boolean).join(' '), unit: where.unit, city: address.city, state, zip: address.zip }, read);
      report.unit_links.n += 1;
      if (found.match === 'exact' && found.subject.kind === 'unit') {
        if (found.record.address.unit === where.unit) report.unit_links.right += 1;
        else report.unit_links.wrong += 1;
      } else report.unit_links.not_linked += 1;
    }
  }
}

function verdict(report) {
  const cases = report.premises.n + report.adjacent.n + report.invalid.n + report.towers.n + report.ambiguous.n + report.unit_links.n;
  // Far from a federal point isn't proof of a wrong answer (the tax-credit layer's points are often a town off), so it's counted and read by hand.
  const wrong = report.adjacent.wrong + report.invalid.wrong + report.towers.wrong + report.ambiguous.wrong + report.unit_links.wrong;
  const reached = report.premises.n ? (report.premises.right + report.premises.near + report.premises.coarse) / report.premises.n : null;
  report.cases = cases;
  report.wrong = wrong;
  report.premises_reached = reached;
  const untested = ['premises', 'adjacent', 'invalid', 'towers', 'ambiguous', 'unit_links'].filter((part) => !report[part].n);
  report.untested = untested;
  if (cases < FLOOR_PER_STATE) report.verdict = 'below_floor';
  else if (wrong) report.verdict = 'wrong_answers';
  else if (reached === null || reached < 0.95) report.verdict = 'thin';
  else report.verdict = 'pass';
  return report;
}

/** Wilson's interval at 95%: `lower` for how sure a rate is at least that, `upper` for at most. */
function wilson(right, n) {
  if (!n) return { lower: 0, upper: 1 };
  const z = 1.96;
  const p = right / n;
  const centre = p + (z * z) / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  const under = 1 + (z * z) / n;
  return { lower: (centre - spread) / under, upper: (centre + spread) / under };
}

function summarize(dir) {
  const reports = fs.readdirSync(dir).filter((name) => /^t2-[A-Z]{2}\.json$/.test(name)).map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
  const tally = { premises: {}, adjacent: {}, invalid: {}, towers: {}, ambiguous: {}, unit_links: {} };
  for (const report of reports) {
    log(`${report.state}: ${report.verdict}; ${report.cases} cases, ${report.wrong} wrong; premises ${report.premises.right + report.premises.near + report.premises.coarse}/${report.premises.n} reached, ${report.premises.asked} asked, ${report.premises.no_record} no record, ${report.premises.unreadable} unreadable, ${report.premises.wrong_place} far; adjacent ${report.adjacent.n} (${report.adjacent.wrong} wrong, ${report.adjacent.asked} asked); made-up units ${report.invalid.n} (${report.invalid.wrong} matched); towers ${report.towers.n} (${report.towers.wrong} wrong); must-ask ${report.ambiguous.n} (${report.ambiguous.wrong} wrong); unit links ${report.unit_links.right}/${report.unit_links.n} (${report.unit_links.wrong} wrong, ${report.unit_links.not_linked} not linked); untested: ${report.untested.join(' ') || 'none'}`);
    for (const part of Object.keys(tally)) for (const [key, value] of Object.entries(report[part])) tally[part][key] = (tally[part][key] || 0) + value;
  }
  const links = tally.unit_links;
  const linked = (links.right || 0) + (links.wrong || 0);
  const precision = wilson(links.right || 0, linked);
  const invalid = tally.invalid;
  const wrongUnit = wilson(invalid.wrong || 0, invalid.n || 0);
  const passed = reports.filter((report) => report.verdict === 'pass').map((report) => report.state);
  log(`Exact unit links: ${links.right || 0} right of ${linked}${linked ? `, ${(100 * (links.right || 0) / linked).toFixed(2)}%, at least ${(100 * precision.lower).toFixed(2)}%` : ''} (bar: 99.5%, at least 99.0%, about 1,000)`);
  log(`Made-up units matched: ${invalid.wrong || 0} of ${invalid.n || 0}${invalid.n ? `, at most ${(100 * wrongUnit.upper).toFixed(3)}%` : ''} (bar: under 0.1%, about 3,000 buildings)`);
  log(`Abstained, reported apart from errors: premises asked ${tally.premises.asked || 0}, units not linked ${links.not_linked || 0}, adjacent asked ${tally.adjacent.asked || 0}`);
  log(`States passing: ${passed.length} of ${reports.length}: ${passed.join(' ')}`);
  log(`Not passing: ${reports.filter((report) => report.verdict !== 'pass').map((report) => `${report.state} ${report.verdict}`).join(', ')}`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.summary) {
    summarize(opts.summary);
    return;
  }
  const registry = localRegistry(opts.out, opts.state);
  const blank = (extra = {}) => ({ n: 0, wrong: 0, ...extra });
  const report = {
    state: opts.state,
    premises: { n: 0, right: 0, near: 0, coarse: 0, asked: 0, no_record: 0, unreadable: 0, wrong_place: 0 },
    adjacent: blank({ asked: 0 }),
    invalid: blank(),
    towers: blank(),
    ambiguous: blank(),
    unit_links: blank({ right: 0, not_linked: 0 }),
  };
  await premises(report, await truthRows(opts.truth), opts.state, registry.read, opts.dev);
  await controls(report, registry, opts.state);
  await unitLinks(report, opts.units, opts.state, registry.read);
  verdict(report);
  if (opts.report) fs.writeFileSync(opts.report, JSON.stringify(report));
  log(`${opts.state} T2: ${report.verdict}; ${report.cases} cases, ${report.wrong} wrong`);
}

main().catch((err) => {
  console.error(`T2 failed: ${err.constructor === Error ? err.message : err.name}`);
  console.error((err.stack || '').split('\n').slice(1, 6).filter((line) => line.includes('property-index')).join('\n'));
  process.exit(1);
});
