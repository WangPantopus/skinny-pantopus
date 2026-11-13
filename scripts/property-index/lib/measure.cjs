'use strict';
// Measured rows (docs/research/provider-replacement/full-page-plan.md, layer 3; decision D14, approved November 13): figures
// measured from public aerial data and open parcel maps for rows a county's record leaves empty, held under `measured_rows`
// (format.js) until the county is named on the switch file's measured_rows list (backend/services/propertyRecords/router.js).
// A measured row never replaces a row the county states, and it says it was measured, from what, and when.
//
//   outline_sqft         "Building footprint": the area of the one building outline in FEMA and Oak Ridge National
//                        Laboratory's USA Structures (a U.S. Government work; its metadata states no use or access
//                        constraints) that the home's own address point falls inside, from the year of the imagery it was
//                        drawn from. Only where the record states no ground floor area. Only the outlines' shapes and
//                        imagery dates are read, never the file's occupancy or address columns, which were built partly
//                        from a commercially licensed parcel set. The point is Pantopus's own address registry's (county
//                        address points and the national address database; never a vendor's or Google's).
//   buildings_on_parcel  The outlines whose middle lies inside the home's parcel, on a parcel map the county publishes openly
//                        (the connector's own layer: `parcelShapes` in its module).
//   lot_sqft             The parcel's own area from that shape, where the record states no lot size.
//
// The identity check uses shapes and the registry only: every one of the home's registry points falls inside the same single
// outline, no other address's registry point falls inside it, the outline index's own mark (which address's point marked the
// building when the index was built) doesn't name another house, and where the county's parcel map is read, the outline's
// middle is on the home's own parcel. A point placed along the street, a point outside every outline, and a point inside two
// outlines say nothing.
//
// Each county's measurements are checked against its own figures where it states them (the founder's OK, November 13): a
// fact is held for none of a county's homes unless lot areas agree within 10% for 9 in 10 homes that state one, building
// counts agree for 9 in 10, and 98 in 100 matched outlines sit on the home's own parcel. A county stating a figure for fewer
// than CHECKED_AT_LEAST homes is checked by the rest only. Prints counts only.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const readline = require('node:readline');
const { execFileSync } = require('node:child_process');
const points = require('../../../backend/services/propertyRecords/structurePoints');
const { findBlock, statePath, releasePath } = require('../../../backend/services/propertyRecords/format');
const { sortKey } = require('../../../backend/services/propertyRecords/addressKey');
const { layerShapes, cached } = require('./services.cjs');
const { log } = require('./log.cjs');

const SWITCH = 'measured_rows';
// Each measured fact's year (the imagery its outline was drawn from), beside the list: router.js puts it in the row's words.
const YEARS = 'measured_years';
const SURVEY = 'FEMA’s USA Structures';
// Points the registry placed along a street rather than on the home (places.cjs).
const NOT_ON_THE_HOME = new Set(['geocoded']);
// The records whose own building an outline can be: a house, a townhouse on its own lot, a mobile home. Never a condo unit,
// whose building and land aren't its own, or a building record.
const HOME_TYPES = new Set(['house', 'townhouse', 'mobile_home', null, undefined]);
const BLOCKS_KEPT = 512;
const ACRE = 43560;
const SQFT_PER_SQ_METER = 10.7639104;
// The checks against the county's own figures (above).
const LOT_WITHIN = 0.1;
const LOT_AGREE = 0.9;
const BUILDINGS_AGREE = 0.9;
const ON_ITS_PARCEL = 0.98;
const CHECKED_AT_LEAST = 100;
// Why a home's point found no building that its parcel's one building can answer: the point isn't on a building, or the
// registry has no point on the home. Never when the point is on another building, or when addresses share it.
const LONE_OUTLINE_OK = new Set(['not_on_a_building', 'no_point_on_the_home']);
// Against the record's own living area per floor: an outline under this share of one floor is a garage or a shed, not the
// house; a building found by its parcel alone has to be at least the larger share, and needs the record's figures to say so.
// Measured in Clark County WA (November 13): under 60% of a floor, 0.3% of outlines found by the point, 2.3% by the parcel.
const SMALLEST_FLOOR_SHARE = 0.6;
const SMALLEST_FLOOR_SHARE_BY_PARCEL = 0.8;
// A parcel wider than this many map cells (about 200 m each) is farmland or a campus: its buildings aren't counted.
const MOST_CELLS = 2500;
// An outline stands on the parcel that holds most of its area. It straddles the line when at least this much of it, and this
// share, stands on each side: less is a map's lines and an image's edges not quite meeting, or eaves over a lot line.
const STRADDLE_SQ_METERS = 20;
const STRADDLE_SHARE = 0.15;
const SAMPLES_ACROSS = 8;
// WGS 84, for a parcel's area: the earth's radii of curvature at the parcel's latitude.
const A = 6378137;
const E2 = 0.00669437999014;

function copier(root) {
  return (key, file) => {
    if (root.startsWith('s3://')) {
      try {
        execFileSync('aws', ['s3', 'cp', `${root}/${key}`, file, '--only-show-errors'], { stdio: ['ignore', 'ignore', 'pipe'] });
        return true;
      } catch {
        return false;
      }
    }
    if (!fs.existsSync(path.join(root, key))) return false;
    fs.copyFileSync(path.join(root, key), file);
    return true;
  };
}

/** Each block of a release, read on demand from its data file, the most recently read kept. */
function blockReader(dir) {
  const manifest = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'manifest.json.gz'))).toString('utf8'));
  const offsets = [0];
  for (const length of manifest.lengths) offsets.push(offsets[offsets.length - 1] + length);
  const fd = fs.openSync(path.join(dir, 'data.bin'), 'r');
  const kept = new Map();
  function block(i) {
    if (kept.has(i)) return kept.get(i);
    const bytes = Buffer.alloc(manifest.lengths[i]);
    fs.readSync(fd, bytes, 0, bytes.length, offsets[i]);
    const records = JSON.parse(zlib.gunzipSync(bytes).toString('utf8'));
    kept.set(i, records);
    if (kept.size > BLOCKS_KEPT) kept.delete(kept.keys().next().value);
    return records;
  }
  return { manifest, block, close: () => fs.closeSync(fd) };
}

/** An outline's middle (the center of its area) in longitude and latitude. */
function middleOf(outline) {
  const { ring, at } = outline;
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const cross = ring[j] * ring[i + 1] - ring[i] * ring[j + 1];
    area += cross;
    cx += (ring[j] + ring[i]) * cross;
    cy += (ring[j + 1] + ring[i + 1]) * cross;
  }
  let x = 0;
  let y = 0;
  if (Math.abs(area) > 1e-9) {
    x = cx / (3 * area);
    y = cy / (3 * area);
  }
  const perDegree = points.METERS_PER_DEGREE * points.OFFSETS_PER_METER;
  return [at[0] + x / (perDegree * Math.cos((at[1] * Math.PI) / 180)), at[1] + y / perDegree];
}

/**
 * The state's outline index (index/estimates/points, us-structure-points.cjs), downloaded once into `work` and read a block at
 * a time. Null when the state has none.
 */
function openOutlines(root, state, work) {
  const copy = copier(root);
  const dir = path.join(work, 'measured', `outlines-${state}`);
  fs.mkdirSync(dir, { recursive: true });
  if (!copy(statePath(state), path.join(dir, 'state.json'))) return null;
  const entry = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8')).jurisdictions?.[state];
  if (!entry?.release) return null;
  const releaseDir = path.join(dir, entry.release);
  if (!fs.existsSync(path.join(releaseDir, 'data.bin'))) {
    fs.mkdirSync(releaseDir, { recursive: true });
    for (const name of ['manifest.json.gz', 'data.bin']) {
      if (!copy(`${releasePath(state, entry.release)}/${name}`, path.join(releaseDir, `${name}.part`))) return null;
      fs.renameSync(path.join(releaseDir, `${name}.part`), path.join(releaseDir, name));
    }
  }
  const reader = blockReader(releaseDir);
  const { keys } = reader.manifest;
  /** Every outline indexed under these cells, once each. */
  function inCells(cells) {
    const seen = new Set();
    const found = [];
    for (const cell of cells) {
      const key = points.cellKey(cell);
      const at = findBlock(keys, key);
      if (at < 0) continue;
      for (const record of reader.block(at)) {
        if (record.key !== key) continue;
        const id = `${record.at[0]},${record.at[1]}`;
        if (seen.has(id)) continue;
        seen.add(id);
        found.push(record);
      }
    }
    return found;
  }
  const near = (lng, lat) => inCells(points.cellsNear(lng, lat));
  return { entry, near, inCells, close: reader.close };
}

/** The county's registry points: every address of the county with a house number and a point, for finding and for claims. */
function readRegistry(root, fips, state, work) {
  const copy = copier(root);
  const dir = path.join(work, 'measured', `registry-${fips}`);
  fs.mkdirSync(dir, { recursive: true });
  try {
    if (!copy(statePath(state), path.join(dir, 'state.json'))) return null;
    const entry = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8')).jurisdictions?.[fips];
    if (!entry?.release || entry.status === 'withdrawn') return null;
    for (const name of ['manifest.json.gz', 'data.bin']) if (!copy(`${releasePath(fips, entry.release)}/${name}`, path.join(dir, name))) return null;
    const reader = blockReader(dir);
    const list = [];
    for (let i = 0; i < reader.manifest.lengths.length; i += 1) {
      for (const record of reader.block(i)) {
        const a = record.address || {};
        if (record.kind === 'unit' || !record.point || !points.houseBase(a.number)) continue;
        list.push({ key: record.key, number: String(a.number), pre: a.pre || '', name: a.name || '', suffix: a.suffix || '', post: a.post || '', zip: a.zip ? String(a.zip).slice(0, 5) : '', lng: record.point[0], lat: record.point[1], q: record.q });
      }
    }
    reader.close();
    return list;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** The registry's points by sort key, and by map cell for asking which addresses fall inside an outline. */
function indexRegistry(list) {
  const byKey = new Map();
  const byCell = new Map();
  list.forEach((p, i) => {
    if (!byKey.has(p.key)) byKey.set(p.key, []);
    byKey.get(p.key).push(i);
    const cell = points.cellNumber(p.lng, p.lat);
    if (!byCell.has(cell)) byCell.set(cell, []);
    byCell.get(cell).push(i);
  });
  return { list, byKey, byCell };
}

/** Two addresses that could be the same: same name and number, and no stated direction or ending that differs. */
const sameAddress = (a, b) => a.name === b.name && a.number === b.number && (!a.pre || !b.pre || a.pre === b.pre) && (!a.post || !b.post || a.post === b.post);

/** The registry's points for a record's address, placed on the home (not along the street). */
function homePoints(registry, record) {
  const a = record.address;
  const want = { number: String(a.number || ''), pre: a.pre || '', name: a.name || '', post: a.post || '' };
  return (registry.byKey.get(sortKey(a)) || []).map((i) => registry.list[i]).filter((p) => !NOT_ON_THE_HOME.has(p.q)
    && sameAddress(p, want) && (!a.suffix || !p.suffix || a.suffix === p.suffix) && (!a.zip || !p.zip || p.zip === String(a.zip).slice(0, 5)));
}

/** Every registry address with a point inside this outline (any quality: a neighbor's point there is reason enough to stop). */
function addressesInside(registry, outline) {
  let widest = 0;
  for (const offset of outline.ring) widest = Math.max(widest, Math.abs(offset));
  const meters = widest / points.OFFSETS_PER_METER + 1;
  const found = [];
  for (const cell of points.cellsNear(outline.at[0], outline.at[1], meters)) {
    for (const i of registry.byCell.get(cell) || []) {
      const p = registry.list[i];
      if (points.distanceToRing(p.lng, p.lat, outline) <= 0) found.push(p);
    }
  }
  return found;
}

/**
 * The home's own building outline, or why it can't be said.
 * @returns {{ outline: object }|{ why: string }}
 */
function outlineFor(registry, outlines, record) {
  const mine = homePoints(registry, record);
  if (!mine.length) return { why: 'no_point_on_the_home' };
  let outline = null;
  for (const p of mine) {
    const inside = outlines.near(p.lng, p.lat).filter((candidate) => points.distanceToRing(p.lng, p.lat, candidate) <= 0);
    if (!inside.length) return { why: 'not_on_a_building' };
    if (inside.length > 1) return { why: 'overlapping_outlines' };
    if (outline && (outline.at[0] !== inside[0].at[0] || outline.at[1] !== inside[0].at[1])) return { why: 'points_differ' };
    outline = inside[0];
  }
  // The index's own mark, from the whole state's registry when it was built: two addresses, or another house.
  if (outline.claim === points.MANY) return { why: 'shared_building' };
  if (outline.claim && !points.sameHouse(outline.claim, record.address.number)) return { why: 'another_address' };
  if (addressesInside(registry, outline).some((p) => !sameAddress(p, mine[0]))) return { why: 'shared_building' };
  return { outline };
}

// ── Parcels ────────────────────────────────────────────────

/** A ring's signed area in square meters (counterclockwise positive), on the ellipsoid near its latitude: parcels are small. */
function ringSquareMeters(ring) {
  let lat0 = 0;
  for (const [, lat] of ring) lat0 += lat;
  lat0 = (lat0 / ring.length) * (Math.PI / 180);
  const s = Math.sin(lat0);
  const w = Math.sqrt(1 - E2 * s * s);
  const meridian = (A * (1 - E2)) / (w * w * w);
  const parallel = (A / w) * Math.cos(lat0);
  const k = Math.PI / 180;
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    area += (ring[j][0] * parallel * k) * (ring[i][1] * meridian * k) - (ring[i][0] * parallel * k) * (ring[j][1] * meridian * k);
  }
  return area / 2;
}

/** Whether a point is inside a parcel's rings (even-odd, so holes are out). */
function inRings(rings, x, y) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/**
 * The county's parcel shapes by the parcel number its records carry, from the connector's own open parcel layer
 * (`parcelShapes` in its module: { url, fields, key(row) -> the parcel number its records carry, publisher? }, the same
 * expression the connector writes its parcel number with), read once into `work`. A parcel number drawn as several shapes
 * keeps all its rings.
 */
async function readParcels(shapes, fips, work) {
  const file = path.join(work, 'measured', `parcels-${fips}.jsonl.gz`);
  const source = () => layerShapes(shapes.url, shapes.fields, { ...(shapes.where ? { where: shapes.where } : {}), ...(shapes.oid ? { oid: shapes.oid } : {}), ...(shapes.pageSize ? { pageSize: shapes.pageSize } : {}) });
  const parcels = new Map();
  for await (const row of cached(file, async function* rows() {
    for await (const { attributes, rings } of source()) yield { attributes, rings };
  })) {
    const key = shapes.key(row.attributes);
    if (!key) continue;
    const held = parcels.get(key);
    if (held) held.rings.push(...row.rings);
    else parcels.set(key, { rings: row.rings });
  }
  for (const parcel of parcels.values()) {
    let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity];
    let signed = 0;
    for (const ring of parcel.rings) {
      signed += ringSquareMeters(ring);
      for (const [x, y] of ring) {
        west = Math.min(west, x); east = Math.max(east, x); south = Math.min(south, y); north = Math.max(north, y);
      }
    }
    // Outer rings run clockwise in a map service's shapes, so the parcel's area is the negative of their sum.
    parcel.sqft = Math.round((Math.abs(signed) * SQFT_PER_SQ_METER) / 10) * 10;
    parcel.box = [west, south, east, north];
  }
  return parcels;
}

/** The map cells a parcel's box covers, with room for an outline whose middle is inside it but whose own cell isn't. */
function parcelCells(box) {
  const pad = points.WIDE_METERS / points.METERS_PER_DEGREE;
  const [west, south, east, north] = box;
  const padX = pad / Math.max(Math.cos((south * Math.PI) / 180), 0.01);
  const per = points.CELLS_PER_DEGREE;
  const columns = [Math.floor((west - padX + 180) * per), Math.floor((east + padX + 180) * per)];
  const rows = [Math.floor((south - pad + 90) * per), Math.floor((north + pad + 90) * per)];
  if ((columns[1] - columns[0] + 1) * (rows[1] - rows[0] + 1) > MOST_CELLS) return null;
  const cells = [];
  for (let row = rows[0]; row <= rows[1]; row += 1) {
    for (let column = columns[0]; column <= columns[1]; column += 1) {
      cells.push(points.cellNumber((column + 0.5) / per - 180, (row + 0.5) / per - 90));
    }
  }
  return cells;
}

/** Whether a point (in an outline's own half-meter offsets) is inside its ring. */
function inOutline(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    if ((ring[i + 1] > y) !== (ring[j + 1] > y) && x < ((ring[j] - ring[i]) * (y - ring[i + 1])) / (ring[j + 1] - ring[i + 1]) + ring[i]) inside = !inside;
  }
  return inside;
}

/**
 * How much of an outline stands on a parcel, in square meters on it and off it, from a grid of points over the outline (at
 * most SAMPLES_ACROSS by SAMPLES_ACROSS). Null when the outline's box doesn't reach the parcel's.
 */
function standingOn(parcel, outline) {
  const { ring, at } = outline;
  const perDegree = points.METERS_PER_DEGREE * points.OFFSETS_PER_METER;
  const cosine = Math.cos((at[1] * Math.PI) / 180);
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < ring.length; i += 2) {
    minX = Math.min(minX, ring[i]); maxX = Math.max(maxX, ring[i]); minY = Math.min(minY, ring[i + 1]); maxY = Math.max(maxY, ring[i + 1]);
  }
  const toLng = (x) => at[0] + x / (perDegree * cosine);
  const toLat = (y) => at[1] + y / perDegree;
  const [west, south, east, north] = parcel.box;
  if (toLng(maxX) < west || toLng(minX) > east || toLat(maxY) < south || toLat(minY) > north) return null;
  const stepX = (maxX - minX) / SAMPLES_ACROSS;
  const stepY = (maxY - minY) / SAMPLES_ACROSS;
  let on = 0;
  let inside = 0;
  for (let a = 0; a < SAMPLES_ACROSS; a += 1) {
    for (let b = 0; b < SAMPLES_ACROSS; b += 1) {
      const x = minX + (a + 0.5) * stepX;
      const y = minY + (b + 0.5) * stepY;
      if (!inOutline(ring, x, y)) continue;
      inside += 1;
      if (inRings(parcel.rings, toLng(x), toLat(y))) on += 1;
    }
  }
  if (!inside) return null;
  const squareMeters = outline.facts.footprint_sqft / SQFT_PER_SQ_METER;
  return { share: on / inside, on: (squareMeters * on) / inside, off: (squareMeters * (inside - on)) / inside };
}

/**
 * The outlines standing on this parcel: most of each outline's area on it. Null for a parcel too wide to count, and
 * { unsure: true } when an outline straddles its line (a row of houses drawn as one, a building over a lot line), since
 * then neither this parcel's count nor its neighbor's can be said. A neighbor's eaves over the line don't count as either.
 */
function outlinesOn(parcel, outlines) {
  const cells = parcelCells(parcel.box);
  if (!cells) return null;
  const on = [];
  for (const outline of outlines.inCells(cells)) {
    if (!(outline.facts?.footprint_sqft > 0)) continue;
    const standing = standingOn(parcel, outline);
    if (!standing || standing.on === 0) continue;
    const both = Math.min(standing.on, standing.off);
    if (both >= STRADDLE_SQ_METERS && Math.min(standing.share, 1 - standing.share) >= STRADDLE_SHARE) return { unsure: true, on };
    if (standing.share >= 0.5) on.push(outline);
  }
  return { on };
}

// ── The county ─────────────────────────────────────────────

/** Whether a record is a home whose own building an outline can be. */
const ownBuilding = (record) => !record.restricted && record.kind === 'property' && HOME_TYPES.has(record.home_type) && record.address?.number;

const stated = (value) => value !== undefined && value !== null && value !== '';
/** Whether a record states nothing for this fact, as a county column or a newly read one. */
const stillEmpty = (record, fact) => !stated(record.facts?.[fact]) && !stated(record.held?.new_columns?.[fact]);
const lotOf = (facts) => (facts?.lot_sqft > 0 ? facts.lot_sqft : facts?.lot_acres > 0 ? facts.lot_acres * ACRE : null);
const share = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : null);

function hold(record, fact, value, year) {
  record.held = record.held || {};
  record.held[SWITCH] = { ...record.held[SWITCH], [fact]: value };
  if (year) record.held[YEARS] = { ...record.held[YEARS], [fact]: year };
}

/** Whose parcel map it is, for the row's words: the connector's own short name for it, or the county's name. */
function officeOf(county, shapes) {
  return shapes?.publisher || county.name || county.publisher;
}

/**
 * Holds each home's measured figures for the rows its record leaves empty, under held.measured_rows, with each figure's
 * imagery year under held.measured_years. Returns the county's words for its `held_from` ({ measured_rows: { fact: words } }),
 * or null when nothing was held. `check` measures every home whatever its record states and holds nothing, returning each
 * measurement beside its record and the checks (for comparing with the county's own figures; counts only).
 * @param {object[]} records
 * @param {{ fips: string, state: string, publisher?: string, name?: string }} county
 * @param {{ work: string, parcelShapes?: object, bucket?: string, registryRoot?: string, outlineRoot?: string, check?: boolean, year?: number }} options
 */
async function measureFacts(records, county, { work, parcelShapes = null, bucket = process.env.PROPERTY_INDEX_BUCKET, registryRoot, outlineRoot, check = false, year = new Date().getUTCFullYear() }) {
  const regRoot = registryRoot || (bucket && `s3://${bucket}/index/registry`);
  const outRoot = outlineRoot || (bucket && `s3://${bucket}/index/estimates/points`);
  const nothing = check ? { measured: [], counts: {} } : null;
  if (!regRoot || !outRoot) {
    log(`${county.fips}: no storage to read here, so no measured rows`);
    return nothing;
  }
  const homes = records.filter(ownBuilding);
  if (!homes.length) return nothing;
  const list = readRegistry(regRoot, county.fips, county.state, work);
  if (!list) {
    log(`${county.fips}: no address registry to read here, so no measured rows`);
    return nothing;
  }
  const outlines = openOutlines(outRoot, county.state, work);
  if (!outlines) {
    log(`${county.fips}: no building outlines for ${county.state} here, so no measured rows`);
    return nothing;
  }
  const registry = indexRegistry(list);
  let parcels = null;
  if (parcelShapes) {
    try {
      parcels = await readParcels(parcelShapes, county.fips, work);
    } catch (err) {
      log(`${county.fips}: the parcel map couldn't be read (${err.constructor === Error ? err.message : err.name}), so no lot or building counts measured`);
    }
  }
  const counts = { homes: homes.length };
  const bump = (name) => { counts[name] = (counts[name] || 0) + 1; };
  const checks = { lot: { compared: 0, agree: 0 }, buildings: { compared: 0, agree: 0 }, parcel: { compared: 0, on: 0 } };
  // A parcel number more than one home carries: its one building can't be said to be any one home's.
  const homesOn = new Map();
  for (const record of homes) if (record.facts?.parcel_number) homesOn.set(String(record.facts.parcel_number), (homesOn.get(String(record.facts.parcel_number)) || 0) + 1);
  const measured = [];
  for (const record of homes) {
    const one = { record };
    const found = outlineFor(registry, outlines, record);
    const parcelNumber = record.facts?.parcel_number ? String(record.facts.parcel_number) : null;
    const parcel = parcels && parcelNumber ? parcels.get(parcelNumber) : null;
    if (parcels && !parcel) bump('no_parcel_shape');
    const standing = parcel ? outlinesOn(parcel, outlines) : null;
    if (parcel && standing === null) bump('parcel_too_wide');
    if (standing?.unsure) bump('straddling_outline');
    const on = standing?.on || null;
    if (!found.why && !(found.outline.facts?.footprint_sqft > 0)) bump('no_area');
    else if (!found.why && parcel) {
      // The outline the home's point found should be on the home's own parcel.
      const [x, y] = middleOf(found.outline);
      checks.parcel.compared += 1;
      if (inRings(parcel.rings, x, y)) {
        checks.parcel.on += 1;
        one.outline = found.outline;
        one.how = 'point';
      } else bump('off_its_parcel');
    } else if (!found.why) {
      one.outline = found.outline;
      one.how = 'point';
    } else if (on?.length === 1 && !standing.unsure && homesOn.get(parcelNumber) === 1 && LONE_OUTLINE_OK.has(found.why) && on[0].facts?.footprint_sqft > 0
      && on[0].claim !== points.MANY && !(on[0].claim && !points.sameHouse(on[0].claim, record.address.number))
      && addressesInside(registry, on[0]).every((p) => sameAddress(p, { number: String(record.address.number), pre: record.address.pre || '', name: record.address.name || '', post: record.address.post || '' }))) {
      // The home's point isn't on a building, but the county's parcel map puts one building on its parcel, which no other
      // address's point falls on: that's the home's.
      one.outline = on[0];
      one.how = 'parcel';
      bump('found_by_its_parcel');
    } else bump(found.why);
    // The record's own living area per floor says whether the outline can be the house.
    const facts = record.facts || {};
    const floor = facts.living_sqft > 0 && facts.stories > 0 ? facts.living_sqft / facts.stories : null;
    if (one.outline && floor && one.outline.facts.footprint_sqft < SMALLEST_FLOOR_SHARE * floor) {
      bump('smaller_than_a_floor');
      delete one.outline;
    } else if (one.outline && one.how === 'parcel' && !(floor && one.outline.facts.footprint_sqft >= SMALLEST_FLOOR_SHARE_BY_PARCEL * floor)) {
      bump(floor ? 'parcel_building_small' : 'parcel_building_unconfirmed');
      delete one.outline;
    }
    if (parcel) {
      one.lot = parcel.sqft;
      const lot = lotOf(record.facts);
      if (lot && parcel.sqft > 0) {
        checks.lot.compared += 1;
        if (Math.abs(parcel.sqft - lot) <= LOT_WITHIN * lot) checks.lot.agree += 1;
      }
      if (on?.length && !standing.unsure) {
        one.buildings = on.length;
        one.buildingsYear = Math.min(...on.map((outline) => Number(outline.img) || Infinity));
        if (record.facts?.buildings_on_parcel > 0) {
          checks.buildings.compared += 1;
          if (record.facts.buildings_on_parcel === on.length) checks.buildings.agree += 1;
        }
      }
    }
    measured.push(one);
  }
  outlines.close();
  // The checks: a fact whose check fails, where the county gives enough to check it, is held for none of its homes.
  const passes = {
    outline_sqft: checks.parcel.compared < CHECKED_AT_LEAST || checks.parcel.on / checks.parcel.compared >= ON_ITS_PARCEL,
    lot_sqft: checks.lot.compared < CHECKED_AT_LEAST || checks.lot.agree / checks.lot.compared >= LOT_AGREE,
    buildings_on_parcel: checks.buildings.compared < CHECKED_AT_LEAST || checks.buildings.agree / checks.buildings.compared >= BUILDINGS_AGREE,
  };
  const report = {
    on_its_parcel: `${checks.parcel.on} of ${checks.parcel.compared} (${share(checks.parcel.on, checks.parcel.compared)}%)`,
    lot_within_10: `${checks.lot.agree} of ${checks.lot.compared} (${share(checks.lot.agree, checks.lot.compared)}%)`,
    buildings_agree: `${checks.buildings.agree} of ${checks.buildings.compared} (${share(checks.buildings.agree, checks.buildings.compared)}%)`,
  };
  if (check) return { measured, counts, checks, passes, report };
  const held = { outline_sqft: 0, buildings_on_parcel: 0, lot_sqft: 0, no_year: 0 };
  for (const one of measured) {
    const { record } = one;
    // The imagery's year goes in the row's words: an outline whose date the file doesn't give isn't shown.
    if (one.outline && passes.outline_sqft && stillEmpty(record, 'ground_floor_sqft') && stillEmpty(record, 'outline_sqft')) {
      const imaged = Number(one.outline.img) || null;
      if (imaged) {
        hold(record, 'outline_sqft', one.outline.facts.footprint_sqft, imaged);
        held.outline_sqft += 1;
      } else held.no_year += 1;
    }
    if (one.buildings && passes.buildings_on_parcel && stillEmpty(record, 'buildings_on_parcel') && Number.isFinite(one.buildingsYear)) {
      hold(record, 'buildings_on_parcel', one.buildings, one.buildingsYear);
      held.buildings_on_parcel += 1;
    }
    if (one.lot > 0 && passes.lot_sqft && stillEmpty(record, 'lot_sqft') && stillEmpty(record, 'lot_acres')) {
      hold(record, 'lot_sqft', one.lot);
      held.lot_sqft += 1;
    }
  }
  log(`${county.fips}: measured rows held: footprint ${held.outline_sqft}, buildings ${held.buildings_on_parcel}, lot ${held.lot_sqft} of ${homes.length} homes; checks: on its parcel ${report.on_its_parcel}, lot within 10% ${report.lot_within_10}, buildings agree ${report.buildings_agree}; ${Object.entries(passes).filter(([, ok]) => !ok).map(([fact]) => `${fact} held for none (check failed)`).join(', ') || 'all checks pass'}; not measured: ${Object.entries(counts).filter(([name]) => name !== 'homes').map(([name, n]) => `${name} ${n}`).join(', ')}`);
  const office = officeOf(county, parcelShapes);
  const words = {};
  // Short enough for one line beside the value in the apps already in the stores (Android's row gives a long line the value's
  // room); the data sources page credits USA Structures to Oak Ridge National Laboratory and FEMA in full.
  if (held.outline_sqft) words.outline_sqft = `Measured from ${SURVEY}, {year} imagery`;
  if (held.buildings_on_parcel) words.buildings_on_parcel = 'Measured from FEMA’s {year} imagery, over 450 sq ft';
  if (held.lot_sqft) words.lot_sqft = `Measured from ${office}’s parcel map, ${year}`;
  return Object.keys(words).length ? { [SWITCH]: words } : null;
}

module.exports = { measureFacts, outlineFor, openOutlines, readRegistry, readParcels, indexRegistry, homePoints, addressesInside, ownBuilding, middleOf, inRings, ringSquareMeters, SWITCH, YEARS, SURVEY };
