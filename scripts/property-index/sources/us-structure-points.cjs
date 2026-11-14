'use strict';
// The national floor by location, one state at a time: every structure in FEMA's USA Structures, joined to the Army Corps
// of Engineers' inventory as the floor by address is (us-structures.cjs), kept by where it stands instead of by an address.
// In many states FEMA's file has no readable address, so the floor by address can't reach those buildings at all.
// backend/services/propertyRecords/structurePoints.js says what's written and holds the identity check.
//
// Each registry point in the state marks the building it falls on (`claim`), which is how a lookup catches a point on a
// neighbor's building. The same run then asks the check about every registry address, holding FEMA's own addresses out,
// and counts how often the building it picks carries a different house number: that's the wrong-building rate, in each
// state FEMA has addresses for. Counts only. Vendor points never come near this: registry and federal files only.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { statePath, releasePath } = require('../../../backend/services/propertyRecords/format');
const { QUALITIES } = require('../../../backend/services/propertyRecords/registryFormat');
const points = require('../../../backend/services/propertyRecords/structurePoints');
const { rows } = require('../lib/fgdb.cjs');
const { blockWriter } = require('../lib/release.cjs');
const { log } = require('../lib/log.cjs');
const { openState, nearest, round, NSI_VERSION } = require('./us-structures.cjs');

const COLUMNS = ['Shape', 'OCC_CLS', 'PRIM_OCC', 'PROP_ADDR', 'SQFEET', 'LONGITUDE', 'LATITUDE', 'PROD_DATE'];
// The date of the imagery or lidar each outline was drawn from: a measured row (lib/measure.cjs) names its year. Not every
// state's file has it.
const OPTIONAL_COLUMNS = ['IMAGE_DATE'];
const OUTLINE_TOLERANCE = 1; // half a meter, in the outline's own units
// FEMA's point is the structure's own only within this of its outline: 2,007 of Kentucky's aren't coordinates at all.
const POINT_SLACK_DEGREES = 0.02;
// Wider than any building is a drawing error: indexed under its own cell only, never across a county's worth of cells.
const LARGEST_HALF_WIDTH_METERS = 2000;
const STREET_HASH = 16777619;
// A house number this close on the same street is the house next door, or the one after it.
const NEXT_DOOR_NUMBERS = 20;

function hash(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) value = Math.imul(value ^ text.charCodeAt(i), STREET_HASH);
  return value >>> 0;
}

function growing(Type, size) {
  let array = new Type(size);
  return {
    get array() { return array; },
    fit(length) {
      if (length <= array.length) return;
      const larger = new Type(Math.max(length, array.length * 2));
      larger.set(array);
      array = larger;
    },
  };
}

/** Douglas-Peucker on a closed outline, as flat x, y offsets. */
function simplified(flat, tolerance) {
  const count = flat.length / 2;
  if (count <= 3) return flat;
  let far = 0;
  let farthest = -1;
  for (let i = 1; i < count; i += 1) {
    const distance = (flat[i * 2] - flat[0]) ** 2 + (flat[i * 2 + 1] - flat[1]) ** 2;
    if (distance > farthest) {
      farthest = distance;
      far = i;
    }
  }
  const keep = new Uint8Array(count);
  keep[0] = 1;
  keep[far] = 1;
  const stack = [[0, far], [far, count]];
  while (stack.length) {
    const [from, to] = stack.pop();
    const ax = flat[from * 2];
    const ay = flat[from * 2 + 1];
    const bx = flat[(to % count) * 2];
    const by = flat[(to % count) * 2 + 1];
    const length = Math.hypot(bx - ax, by - ay) || 1;
    let worst = -1;
    let worstAt = -1;
    for (let i = from + 1; i < to; i += 1) {
      const distance = Math.abs((bx - ax) * (flat[i * 2 + 1] - ay) - (by - ay) * (flat[i * 2] - ax)) / length;
      if (distance > worst) {
        worst = distance;
        worstAt = i;
      }
    }
    if (worst > tolerance) {
      keep[worstAt] = 1;
      stack.push([from, worstAt], [worstAt, to]);
    }
  }
  const out = [];
  for (let i = 0; i < count; i += 1) if (keep[i]) out.push(flat[i * 2], flat[i * 2 + 1]);
  return out;
}

function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) area += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  return Math.abs(area);
}

/** A footprint's outer outline as offsets from its middle, in half meters, with a bounded number of corners. */
function outlineOf(parts, lng, lat) {
  let ring = parts[0];
  if (parts.length > 1) {
    let largest = -1;
    for (const part of parts) {
      const area = ringArea(part);
      if (area > largest) {
        largest = area;
        ring = part;
      }
    }
  }
  const cosine = Math.cos((lat * Math.PI) / 180);
  const flat = [];
  // A ring repeats its first corner at the end: left out here.
  for (let i = 0; i < ring.length - 1; i += 1) {
    flat.push(
      Math.max(-32767, Math.min(32767, Math.round((ring[i][0] - lng) * cosine * points.METERS_PER_DEGREE * points.OFFSETS_PER_METER))),
      Math.max(-32767, Math.min(32767, Math.round((ring[i][1] - lat) * points.METERS_PER_DEGREE * points.OFFSETS_PER_METER))),
    );
  }
  let outline = simplified(flat, OUTLINE_TOLERANCE);
  for (let tolerance = OUTLINE_TOLERANCE * 2; outline.length / 2 > points.MAX_CORNERS; tolerance *= 2) outline = simplified(flat, tolerance);
  return outline;
}

/** The middle of an outline's box, to six places, for a structure whose own point is missing or wrong. */
function middleOf(ring) {
  let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of ring) {
    west = Math.min(west, x);
    east = Math.max(east, x);
    south = Math.min(south, y);
    north = Math.max(north, y);
  }
  return [Number(((west + east) / 2).toFixed(6)), Number(((south + north) / 2).toFixed(6))];
}

function halfWidth(outline) {
  let widest = 0;
  for (let i = 0; i < outline.length; i += 1) widest = Math.max(widest, Math.abs(outline[i]));
  return widest / points.OFFSETS_PER_METER;
}

/** An imagery date's year, or 0 when the file gives none or one that can't be right. */
function imageYear(value) {
  if (value === null || value === undefined || value === '') return 0;
  const year = new Date(value).getUTCFullYear();
  return year >= 1990 && year <= new Date().getUTCFullYear() ? year : 0;
}

const useCode = (row) => {
  const home = row.OCC_CLS === 'Residential' || row.OCC_CLS === 'Unclassified';
  if (!home) return 'x';
  if (points.USE_CODES[row.PRIM_OCC]) return points.USE_CODES[row.PRIM_OCC];
  return row.PRIM_OCC === 'Unclassified' ? 'r' : 'x';
};

/** Every structure of a state, in typed arrays with a map-cell grid over them: a large state doesn't fit as objects. */
function readStructures(table, inventory) {
  const at = growing(Float64Array, 1 << 21);
  const starts = growing(Uint32Array, 1 << 20);
  const pool = growing(Int16Array, 1 << 22);
  const sqft = growing(Float32Array, 1 << 20);
  const use = growing(Uint8Array, 1 << 20);
  const number = growing(Int32Array, 1 << 20);
  const street = growing(Uint32Array, 1 << 20);
  const match = growing(Int32Array, 1 << 20);
  const next = growing(Int32Array, 1 << 20);
  const imaged = growing(Uint16Array, 1 << 20);
  const numbers = [''];
  const numberIds = new Map();
  const heads = new Map();
  const wide = new Map();
  let count = 0;
  let used = 0;
  let newest = 0;
  const counts = { read: 0, homes: 0, addressed: 0, joined: 0, no_shape: 0, off_point: 0, too_wide: 0, imaged: 0 };
  for (const row of rows(table[1], [...COLUMNS, ...OPTIONAL_COLUMNS], { optional: OPTIONAL_COLUMNS })) {
    counts.read += 1;
    if (!row.Shape || !row.Shape.length || !row.Shape[0].length) {
      counts.no_shape += 1;
      continue;
    }
    if (row.PROD_DATE > newest) newest = row.PROD_DATE;
    const corner = row.Shape[0][0];
    const stated = Math.abs(row.LONGITUDE - corner[0]) < POINT_SLACK_DEGREES && Math.abs(row.LATITUDE - corner[1]) < POINT_SLACK_DEGREES;
    if (!stated) counts.off_point += 1;
    const [lng, lat] = stated ? [Number(row.LONGITUDE.toFixed(6)), Number(row.LATITUDE.toFixed(6))] : middleOf(row.Shape[0]);
    const outline = outlineOf(row.Shape, lng, lat);
    const i = count;
    count += 1;
    at.fit(count * 2);
    starts.fit(count + 1);
    sqft.fit(count);
    use.fit(count);
    number.fit(count);
    street.fit(count);
    match.fit(count);
    next.fit(count);
    imaged.fit(count);
    pool.fit(used + outline.length);
    at.array[i * 2] = lng;
    at.array[i * 2 + 1] = lat;
    pool.array.set(outline, used);
    used += outline.length;
    starts.array[i + 1] = used;
    sqft.array[i] = row.SQFEET;
    imaged.array[i] = imageYear(row.IMAGE_DATE);
    if (imaged.array[i]) counts.imaged += 1;
    const code = useCode(row);
    use.array[i] = code.charCodeAt(0);
    match.array[i] = -1;
    if (points.HOME_USES.has(code)) {
      counts.homes += 1;
      const parsed = row.PROP_ADDR ? parse(row.PROP_ADDR) : null;
      if (parsed?.number) {
        counts.addressed += 1;
        let id = numberIds.get(parsed.number);
        if (!id) {
          id = numbers.length;
          numbers.push(parsed.number);
          numberIds.set(parsed.number, id);
        }
        number.array[i] = id;
        street.array[i] = hash(parsed.name || '');
      }
      const found = nearest(inventory, lng, lat);
      if (found >= 0) {
        counts.joined += 1;
        match.array[i] = found;
      }
    }
    const cell = points.cellNumber(lng, lat);
    next.array[i] = heads.has(cell) ? heads.get(cell) : -1;
    heads.set(cell, i);
    const width = halfWidth(outline);
    if (width > LARGEST_HALF_WIDTH_METERS) counts.too_wide += 1;
    else if (width > points.WIDE_METERS) {
      for (const touched of points.cellsNear(lng, lat, width + points.NEAR_METERS)) {
        if (touched !== cell) (wide.get(touched) || wide.set(touched, []).get(touched)).push(i);
      }
    }
  }
  const data = { at: at.array, starts: starts.array, pool: pool.array, sqft: sqft.array, imaged: imaged.array, use: use.array, number: number.array, street: street.array, match: match.array, next: next.array, numbers, heads, wide, count, newest, counts };
  data.claimNumber = new Int32Array(count);
  data.claimStreet = new Uint32Array(count);
  data.inventoried = new Uint8Array(count);
  return data;
}

/** How many of the Army Corps's residential structures stand on each footprint: more than one and it's several homes drawn as one. */
function countInventory(data, inventory) {
  const around = nearby(data, inventory);
  const { xs, ys } = inventory;
  const order = Array.from({ length: xs.length }, (_, i) => i).sort((a, b) => points.cellNumber(xs[a], ys[a]) - points.cellNumber(xs[b], ys[b]));
  for (const i of order) {
    const found = points.underPoint(xs[i], ys[i], around(xs[i], ys[i]));
    if (found.structure && found.distance <= 0 && data.inventoried[found.structure.i] < 255) data.inventoried[found.structure.i] += 1;
  }
}

function factsOf(data, inventory, i) {
  const code = String.fromCharCode(data.use[i]);
  if (!points.HOME_USES.has(code)) return { footprint_sqft: round(data.sqft[i], 10) };
  const facts = { footprint_sqft: round(data.sqft[i], 10) };
  const use = { h: 'Single family', m: 'Multifamily', f: 'Manufactured home' }[code];
  if (use) facts.building_use = use;
  const found = data.match[i];
  if (found >= 0) {
    if (inventory.areas[found] > 0) facts.modeled_sqft = round(inventory.areas[found], 50);
    if (inventory.stories[found] > 0) facts.modeled_stories = inventory.stories[found];
    if (inventory.blocks[found]) facts.block_group = inventory.blocks[found];
  }
  return facts;
}

/** One structure as the index holds it. */
function recordOf(data, inventory, i) {
  const record = {
    at: [data.at[i * 2], data.at[i * 2 + 1]],
    ring: Array.from(data.pool.subarray(data.starts[i], data.starts[i + 1])),
    use: String.fromCharCode(data.use[i]),
    facts: factsOf(data, inventory, i),
  };
  if (data.number[i]) record.num = data.numbers[data.number[i]];
  if (data.imaged?.[i]) record.img = data.imaged[i];
  if (data.inventoried?.[i] > 1) record.homes = data.inventoried[i];
  if (data.claimNumber[i] === -1) record.claim = points.MANY;
  else if (data.claimNumber[i]) record.claim = data.claimLabels[data.claimNumber[i]];
  return record;
}

/** What the index holds in the cells around a point, kept for the next few points: they come in map order. */
function nearby(data, inventory) {
  const kept = new Map();
  const inCell = (cell) => {
    let held = kept.get(cell);
    if (held) return held;
    held = [];
    const add = (i) => {
      const record = recordOf(data, inventory, i);
      record.i = i;
      held.push(record);
    };
    for (let i = data.heads.has(cell) ? data.heads.get(cell) : -1; i >= 0; i = data.next[i]) add(i);
    for (const i of data.wide.get(cell) || []) add(i);
    kept.set(cell, held);
    if (kept.size > 256) kept.delete(kept.keys().next().value);
    return held;
  };
  return (lng, lat) => {
    const cells = points.cellsNear(lng, lat);
    if (cells.length === 1) return inCell(cells[0]);
    return cells.flatMap(inCell);
  };
}

/** A state's registry points, from its release files: address numbers and places, in map order. */
function readRegistry(root, state, work) {
  const scratch = path.join(work, 'registry', state);
  fs.mkdirSync(scratch, { recursive: true });
  const copy = (name, to) => {
    if (root.startsWith('s3://')) {
      try {
        execFileSync('aws', ['s3', 'cp', `${root}/${name}`, to, '--only-show-errors'], { stdio: ['ignore', 'ignore', 'inherit'] });
        return true;
      } catch (_) {
        return false;
      }
    }
    if (!fs.existsSync(path.join(root, name))) return false;
    fs.copyFileSync(path.join(root, name), to);
    return true;
  };
  const stateCopy = path.join(scratch, 'state.json');
  if (!copy(statePath(state), stateCopy)) {
    log(`${state}: no address registry here`);
    return { count: 0, lng: new Float64Array(0), lat: new Float64Array(0), number: new Int32Array(0), street: new Uint32Array(0), quality: new Uint8Array(0), labels: [''], order: new Uint32Array(0) };
  }
  const stateFile = JSON.parse(fs.readFileSync(stateCopy, 'utf8'));
  const lng = growing(Float64Array, 1 << 20);
  const lat = growing(Float64Array, 1 << 20);
  const number = growing(Int32Array, 1 << 20);
  const street = growing(Uint32Array, 1 << 20);
  const quality = growing(Uint8Array, 1 << 20);
  const labels = [''];
  const labelIds = new Map();
  let count = 0;
  for (const [fips, county] of Object.entries(stateFile.jurisdictions)) {
    const dir = releasePath(fips, county.release);
    const manifestFile = path.join(scratch, 'manifest.json.gz');
    const dataFile = path.join(scratch, 'data.bin');
    if (!copy(`${dir}/manifest.json.gz`, manifestFile) || !copy(`${dir}/data.bin`, dataFile)) throw new Error(`The registry's release for ${fips} can't be read`);
    const { lengths } = JSON.parse(zlib.gunzipSync(fs.readFileSync(manifestFile)).toString('utf8'));
    const bytes = fs.readFileSync(dataFile);
    let offset = 0;
    for (const length of lengths) {
      const block = JSON.parse(zlib.gunzipSync(bytes.subarray(offset, offset + length)).toString('utf8'));
      offset += length;
      for (const record of block) {
        // A unit's point isn't another building's, and a place with no house number isn't one of these.
        if (record.kind === 'unit' || !record.point || !points.houseBase(record.address?.number)) continue;
        const i = count;
        count += 1;
        lng.fit(count);
        lat.fit(count);
        number.fit(count);
        street.fit(count);
        quality.fit(count);
        quality.array[i] = QUALITIES.indexOf(record.q) + 1;
        lng.array[i] = record.point[0];
        lat.array[i] = record.point[1];
        const label = record.address.number;
        let id = labelIds.get(label);
        if (!id) {
          id = labels.length;
          labels.push(label);
          labelIds.set(label, id);
        }
        number.array[i] = id;
        street.array[i] = hash(record.address.name || '');
      }
    }
    fs.rmSync(manifestFile, { force: true });
    fs.rmSync(dataFile, { force: true });
  }
  fs.rmSync(scratch, { recursive: true, force: true });
  const cells = new Float64Array(count);
  const order = new Uint32Array(count);
  for (let i = 0; i < count; i += 1) {
    cells[i] = points.cellNumber(lng.array[i], lat.array[i]);
    order[i] = i;
  }
  order.sort((a, b) => cells[a] - cells[b]);
  return { count, lng: lng.array, lat: lat.array, number: number.array, street: street.array, quality: quality.array, labels, order };
}

/** Marks each building with the address whose point falls on it. Two different addresses on one building: it's shared. */
function addClaims(data, inventory, registry, { keep = () => true } = {}) {
  data.claimNumber.fill(0);
  data.claimStreet.fill(0);
  data.claimLabels = registry.labels;
  const around = nearby(data, inventory);
  let claimed = 0;
  for (let k = 0; k < registry.count; k += 1) {
    const p = registry.order[k];
    if (!keep(p)) continue;
    const found = points.underPoint(registry.lng[p], registry.lat[p], around(registry.lng[p], registry.lat[p]));
    if (found.why) continue;
    const { i } = found.structure;
    if (data.claimNumber[i] === 0) {
      data.claimNumber[i] = registry.number[p];
      data.claimStreet[i] = registry.street[p];
      claimed += 1;
    } else if (data.claimNumber[i] !== registry.number[p] || data.claimStreet[i] !== registry.street[p]) {
      data.claimNumber[i] = -1;
    }
  }
  return claimed;
}

/**
 * Asks the check about every registry address, holding FEMA's own number out: `right` when the building it picks carries
 * the same house number in FEMA's file, `wrong` when another, `unknown` when FEMA has none. Counts only.
 */
function measure(data, inventory, registry, { jitter = 0, ignoreClaims = false, seed = 1, splits = null } = {}) {
  const around = nearby(data, inventory);
  const out = { points: 0, accepted: 0, inside: 0, near: 0, right: 0, wrong: 0, wrong_next_door: 0, wrong_same_street: 0, wrong_other_street: 0, unknown: 0, reached_without_address: 0, refused: {} };
  const split = (answer, result, p) => {
    if (!splits) return;
    const key = splits(answer, QUALITIES[registry.quality[p] - 1] || 'none');
    if (key) (out.split ||= {})[`${key}|${result}`] = (out.split[`${key}|${result}`] || 0) + 1;
  };
  let state = seed;
  const random = () => {
    state = (Math.imul(state, 48271) >>> 0) % 2147483647;
    return state / 2147483647;
  };
  for (let k = 0; k < registry.count; k += 1) {
    const p = registry.order[k];
    let lng = registry.lng[p];
    let lat = registry.lat[p];
    if (jitter) {
      const angle = random() * 2 * Math.PI;
      const meters = jitter * Math.sqrt(random());
      lng += (meters * Math.cos(angle)) / (points.METERS_PER_DEGREE * Math.cos((lat * Math.PI) / 180));
      lat += (meters * Math.sin(angle)) / points.METERS_PER_DEGREE;
    }
    out.points += 1;
    const label = registry.labels[registry.number[p]];
    const answer = points.resolve({ lng, lat }, around(lng, lat), { number: label, holdOut: true, ignoreClaims });
    if (answer.why) {
      out.refused[answer.why] = (out.refused[answer.why] || 0) + 1;
      continue;
    }
    out.accepted += 1;
    out[answer.how] += 1;
    if (!answer.structure.num) {
      out.unknown += 1;
      out.reached_without_address += 1;
    } else if (points.sameHouse(answer.structure.num, label)) {
      out.right += 1;
      split(answer, 'right', p);
    } else {
      out.wrong += 1;
      split(answer, 'wrong', p);
      if (data.street[answer.structure.i] !== registry.street[p]) out.wrong_other_street += 1;
      else if (Math.abs(Number(points.houseBase(answer.structure.num)) - Number(points.houseBase(label))) <= NEXT_DOOR_NUMBERS) out.wrong_next_door += 1;
      else out.wrong_same_street += 1;
    }
  }
  return out;
}

const wrongRate = ({ right, wrong }) => (right + wrong ? `${((100 * wrong) / (right + wrong)).toFixed(2)}%` : 'n/a');

/** Writes the state's release: blocks in map order, a wide footprint under every cell it touches. */
function writeState(out, entry, data, inventory) {
  const writer = blockWriter(out, entry);
  const fill = {};
  let records = 0;
  const cells = new Set([...data.heads.keys(), ...data.wide.keys()]);
  for (const cell of [...cells].sort((a, b) => a - b)) {
    const key = points.cellKey(cell);
    const write = (i) => {
      const record = { key, ...recordOf(data, inventory, i) };
      writer.add(key, JSON.stringify(record));
      records += 1;
      const group = (fill[`structure:${record.use}`] ||= { records: 0, facts: {} });
      group.records += 1;
      for (const fact of Object.keys(record.facts)) group.facts[fact] = (group.facts[fact] || 0) + 1;
    };
    for (let i = data.heads.has(cell) ? data.heads.get(cell) : -1; i >= 0; i = data.next[i]) write(i);
    for (const i of data.wide.get(cell) || []) write(i);
  }
  return writer.close(records, fill);
}

/**
 * @param {object} options { work, out, state, registry: its root, s3://bucket/prefix or a folder; built: when this run started }
 * @returns the state file's entry for this state's release
 */
function buildStatePoints({ work, out, state, registry: registryRoot, built }) {
  const { inventory, table, femaDir } = openState({ work, state });
  const data = readStructures(table, inventory);
  fs.rmSync(femaDir, { recursive: true, force: true });
  const { counts } = data;
  log(`${state}: ${counts.read} structures, ${counts.homes} homes, ${counts.addressed} with a readable address, ${counts.joined} joined to the inventory, ${counts.no_shape} with no outline, ${counts.off_point} whose point was off its outline, ${counts.too_wide} too wide for a building, ${counts.imaged} with an imagery date`);
  countInventory(data, inventory);
  const registry = readRegistry(registryRoot, state, work);
  const claimed = addClaims(data, inventory, registry);
  log(`${state}: ${registry.count} registry points, ${claimed} buildings marked by one`);
  const identity = measure(data, inventory, registry);
  log(`${state}: asked about each: ${identity.accepted} found a building (${identity.inside} inside, ${identity.near} near), ${identity.reached_without_address} of them with no FEMA address; with FEMA's number held out ${identity.right} right, ${identity.wrong} wrong, ${wrongRate(identity)} (next door ${identity.wrong_next_door}, same street ${identity.wrong_same_street}, another street ${identity.wrong_other_street}); refused ${JSON.stringify(identity.refused)}`);
  const geometry = measure(data, inventory, registry, { ignoreClaims: true });
  log(`${state}: on the geometry alone: ${geometry.accepted} found a building, ${geometry.right} right, ${geometry.wrong} wrong, ${wrongRate(geometry)}`);
  const asOf = new Date(data.newest || Date.now()).toISOString().slice(0, 10);
  const release = `${asOf.replace(/-/g, '')}-${built.toISOString().slice(0, 16).replace(/[-:T]/g, '').slice(4)}`;
  const entry = {
    fips: state, state, name: state, publisher: 'FEMA, Oak Ridge National Laboratory and the U.S. Army Corps of Engineers', dataset: `USA Structures and National Structure Inventory ${NSI_VERSION}`, method: 'estimate', source: 'us-structure-points', title: 'Estimate', as_of: asOf, release, imported_at: built.toISOString(), status: 'active', zips: [], cities: [], identity, geometry_only: { accepted: geometry.accepted, right: geometry.right, wrong: geometry.wrong },
  };
  const report = writeState(out, entry, data, inventory);
  entry.records = report.records;
  fs.mkdirSync(path.join(out, 'counties'), { recursive: true });
  fs.writeFileSync(path.join(out, 'counties', `${state}.json`), JSON.stringify(entry));
  return entry;
}

module.exports = { buildStatePoints, readStructures, countInventory, readRegistry, addClaims, measure, wrongRate, recordOf };
