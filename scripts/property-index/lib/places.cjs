'use strict';
// Which city or town a home is in, from an official boundary: the Census Bureau's TIGER/Line city and town limits (public
// domain), at the point Pantopus's own address registry keeps for the home's address (county address points and the
// national address database; never a vendor's or Google's point). A home counts as in a city only inside an incorporated
// place with a working government; Census-designated places have no government and never count. Where towns or townships
// are governments (Census marks them), a home outside every city is in its town. Outside both it's unincorporated. A point
// too close to a boundary to be sure, a point the registry placed by interpolation, and an address whose registry points
// disagree say nothing. Prints counts only.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { download } = require('./tables.cjs');
const { readDbf, readShp, inRings } = require('./counties.cjs');
const { log } = require('./log.cjs');

const YEAR = 2026;
const BOUNDARIES = 'the Census Bureau’s 2026 city and town limits';
const STATE_FIPS = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10', DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18',
  IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24', MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31', NV: '32', NH: '33',
  NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39', OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46', TN: '47', TX: '48', UT: '49',
  VT: '50', VA: '51', WA: '53', WV: '54', WI: '55', WY: '56', PR: '72',
};
// Closer than this to a city's line (about 8 m) and the point can't say which side the home is on.
const MARGIN_METERS = 8;
const CELL = 0.02;
// Points the registry placed along a street rather than on the home.
const NOT_ON_THE_HOME = new Set(['geocoded']);
// A government's own kinds of place: active, partly consolidated or consolidated with another.
const WORKING = new Set(['A', 'B', 'C']);
// The twelve states whose towns and townships serve as municipalities (the Census Bureau's own list). Elsewhere a township
// isn't a city: Cook County calls a home in Maine Township "unincorporated", and so does this.
const TOWN_STATES = new Set(['CT', 'ME', 'MA', 'MI', 'MN', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT', 'WI']);

function words(text) {
  return String(text).toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** A place's name for comparing: "CITY OF GROVE CITY", "Grove City" and "GROVE-CITY" all read GROVECITY. */
function placeWords(text) {
  return String(text || '').toUpperCase().replace(/^(CITY|VILLAGE|TOWN) OF /, '').replace(/[^A-Z0-9]/g, '');
}

/** "Cranberry township" reads "Cranberry Township"; a New England town or a village reads as its name. */
function subdivisionName(row) {
  const name = row.NAME.replace(/\s*\(balance\)$/i, '').trim();
  const kind = row.NAMELSAD.slice(row.NAME.length).trim().toLowerCase();
  return /township|plantation|borough|gore|grant|location|purchase/.test(kind) ? `${name} ${words(kind)}` : name;
}

function shapes(work, layer, state) {
  const code = STATE_FIPS[state];
  if (!code) return [];
  const base = `tl_${YEAR}_${code}_${layer}`;
  const zip = path.join(work, 'tiger', `${base}.zip`);
  download(`https://www2.census.gov/geo/tiger/TIGER${YEAR}/${layer.toUpperCase()}/${base}.zip`, zip);
  const read = (member) => execFileSync('unzip', ['-p', zip, member], { maxBuffer: 1024 * 1024 * 1024 });
  const rows = readDbf(read(`${base}.dbf`));
  const polygons = readShp(read(`${base}.shp`));
  return rows.map((row, i) => ({ row, rings: polygons[i] }));
}

function indexed(areas) {
  const grid = new Map();
  for (const area of areas) {
    let [xmin, ymin, xmax, ymax] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const ring of area.rings) {
      for (let j = 0; j < ring.length; j += 2) {
        xmin = Math.min(xmin, ring[j]); xmax = Math.max(xmax, ring[j]);
        ymin = Math.min(ymin, ring[j + 1]); ymax = Math.max(ymax, ring[j + 1]);
      }
    }
    Object.assign(area, { xmin, ymin, xmax, ymax });
    for (let cx = Math.floor(xmin / CELL); cx <= Math.floor(xmax / CELL); cx += 1) {
      for (let cy = Math.floor(ymin / CELL); cy <= Math.floor(ymax / CELL); cy += 1) {
        const key = `${cx},${cy}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(area);
      }
    }
  }
  return (x, y) => grid.get(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`) || [];
}

// Each area's edges, filed by small cells (about 100 m), so a point tests only the edges beside it.
const FINE = 0.001;
const fineKey = (cx, cy) => `${cx},${cy}`;

function fileEdges(area) {
  const edges = new Map();
  area.rings.forEach((ring, r) => {
    for (let i = 0; i < ring.length - 2; i += 2) {
      const [x1, y1, x2, y2] = [ring[i], ring[i + 1], ring[i + 2], ring[i + 3]];
      const cells = new Set();
      // Walk the edge in half cells, filing each cell it passes and the ones on either side of it.
      const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / (FINE / 2)));
      for (let s = 0; s <= steps; s += 1) {
        const cx = Math.floor((x1 + ((x2 - x1) * s) / steps) / FINE);
        const cy = Math.floor((y1 + ((y2 - y1) * s) / steps) / FINE);
        for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) cells.add(fineKey(cx + dx, cy + dy));
      }
      for (const key of cells) {
        if (!edges.has(key)) edges.set(key, []);
        edges.get(key).push(r, i);
      }
    }
  });
  area.edges = edges;
  area.cells = new Map();
}

/** Meters from a point to the nearest edge of an area within a cell of it; Infinity when none is that close. */
function edgeMeters(area, x, y) {
  const sx = Math.cos((y * Math.PI) / 180) * 111320;
  const sy = 110540;
  const cx = Math.floor(x / FINE);
  const cy = Math.floor(y / FINE);
  let best = Infinity;
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      const list = area.edges.get(fineKey(cx + dx, cy + dy));
      if (!list) continue;
      for (let j = 0; j < list.length; j += 2) {
        const ring = area.rings[list[j]];
        const i = list[j + 1];
        const ax = (ring[i] - x) * sx; const ay = (ring[i + 1] - y) * sy;
        const ex = (ring[i + 2] - x) * sx - ax; const ey = (ring[i + 3] - y) * sy - ay;
        const t = Math.max(0, Math.min(1, -(ax * ex + ay * ey) / (ex * ex + ey * ey || 1)));
        best = Math.min(best, Math.hypot(ax + t * ex, ay + t * ey));
      }
    }
  }
  return best;
}

/** Whether a point is inside an area: a cell with no edge beside it answers for every point in it. */
function within(area, x, y, nearEdge) {
  if (nearEdge) return inRings(area.rings, x, y);
  const key = fineKey(Math.floor(x / FINE), Math.floor(y / FINE));
  let known = area.cells.get(key);
  if (known === undefined) {
    known = inRings(area.rings, x, y);
    area.cells.set(key, known);
  }
  return known;
}

/** Whether any edge of the area lies in this point's cell or the ones beside it. */
function edgesBeside(area, x, y) {
  const cx = Math.floor(x / FINE);
  const cy = Math.floor(y / FINE);
  for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) if (area.edges.has(fineKey(cx + dx, cy + dy))) return true;
  return false;
}

/** Every place's name in the state and every subdivision's in the county, as placeWords reads them (their tables only). */
function placeNames(work, state, countyFips) {
  const code = STATE_FIPS[state];
  const names = new Set();
  if (!code) return names;
  for (const layer of ['place', 'cousub']) {
    const base = `tl_${YEAR}_${code}_${layer}`;
    const zip = path.join(work, 'tiger', `${base}.zip`);
    download(`https://www2.census.gov/geo/tiger/TIGER${YEAR}/${layer.toUpperCase()}/${base}.zip`, zip);
    for (const row of readDbf(execFileSync('unzip', ['-p', zip, `${base}.dbf`], { maxBuffer: 1024 * 1024 * 1024 }))) {
      if (layer === 'cousub' && row.COUNTYFP !== countyFips.slice(2)) continue;
      names.add(placeWords(layer === 'cousub' ? subdivisionName(row) : row.NAME.replace(/\s*\(balance\)$/i, '')));
    }
  }
  return names;
}

/**
 * Where a point is: { name } for a city, town or "Unincorporated <County>", null when it can't say.
 * A point inside one area but within the margin of any area's line says nothing.
 */
function locator(work, state, countyName, countyFips) {
  const places = shapes(work, 'place', state).filter(({ row }) => /^C/.test(row.CLASSFP) && WORKING.has(row.FUNCSTAT));
  // Every county subdivision of this county: together they cover it, so a point in none of them is on an edge.
  const subdivisions = shapes(work, 'cousub', state).filter(({ row }) => row.COUNTYFP === countyFips.slice(2));
  const nearPlaces = indexed(places);
  const nearSubdivisions = indexed(subdivisions);
  const towns = TOWN_STATES.has(state) && subdivisions.some(({ row }) => WORKING.has(row.FUNCSTAT));
  const pad = MARGIN_METERS / 100000;
  function inside(candidates, x, y) {
    let found = null;
    for (const area of candidates(x, y)) {
      if (x < area.xmin - pad || x > area.xmax + pad || y < area.ymin - pad || y > area.ymax + pad) continue;
      if (!area.edges) fileEdges(area);
      const nearEdge = edgesBeside(area, x, y);
      if (nearEdge && edgeMeters(area, x, y) < MARGIN_METERS) return { unsure: true };
      if (within(area, x, y, nearEdge)) {
        if (found) return { unsure: true };
        found = area;
      }
    }
    return found ? { area: found } : {};
  }
  return (x, y) => {
    const place = inside(nearPlaces, x, y);
    if (place.unsure) return null;
    if (place.area) return { name: place.area.row.NAME.replace(/\s*\(balance\)$/i, '').trim(), kind: 'city' };
    // Where no subdivision of the county is a government (Washington's census divisions), their lines change nothing.
    if (towns) {
      const subdivision = inside(nearSubdivisions, x, y);
      if (subdivision.unsure || !subdivision.area) return null;
      if (WORKING.has(subdivision.area.row.FUNCSTAT)) return { name: subdivisionName(subdivision.area.row), kind: 'town' };
    }
    return countyName ? { name: `Unincorporated ${countyName}`, kind: 'unincorporated' } : null;
  };
}

/** The registry's points for the addresses these records name, by sort key: [pre, suffix, post, zip, lng, lat]. */
function registryPoints(work, fips, state, wanted) {
  const bucket = process.env.PROPERTY_INDEX_BUCKET;
  if (!bucket) return null;
  const dir = path.join(work, 'registry', fips);
  fs.mkdirSync(dir, { recursive: true });
  const cp = (key, file) => execFileSync('aws', ['s3', 'cp', `s3://${bucket}/index/registry/${key}`, file, '--only-show-errors'], { stdio: ['ignore', 'ignore', 'pipe'] });
  try {
    const stateFile = path.join(dir, `${state}.json`);
    cp(`states/${state}.json`, stateFile);
    const entry = JSON.parse(fs.readFileSync(stateFile, 'utf8')).jurisdictions?.[fips];
    if (!entry?.release || entry.status === 'withdrawn') return null;
    cp(`releases/${fips}/${entry.release}/manifest.json.gz`, path.join(dir, 'manifest.json.gz'));
    cp(`releases/${fips}/${entry.release}/data.bin`, path.join(dir, 'data.bin'));
  } catch {
    return null;
  }
  const manifest = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'manifest.json.gz'))).toString('utf8'));
  const data = fs.readFileSync(path.join(dir, 'data.bin'));
  const points = new Map();
  let at = 0;
  for (const length of manifest.lengths) {
    for (const record of JSON.parse(zlib.gunzipSync(data.subarray(at, at + length)).toString('utf8'))) {
      if (!record.point || NOT_ON_THE_HOME.has(record.q) || !wanted.has(record.key)) continue;
      const a = record.address;
      if (!points.has(record.key)) points.set(record.key, []);
      points.get(record.key).push([a.pre || '', a.suffix || '', a.post || '', a.zip || '', record.point[0], record.point[1]]);
    }
    at += length;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  return points;
}

/**
 * Each home's municipality from the boundary its registry point sits in, for records whose county doesn't state one.
 * `hold(record, fact, value, from)` keeps it off screens until the county's switch is on (derive.cjs).
 */
function addMunicipalities(records, county, work, hold, sortKey, asks = (record) => (record.facts.municipality === undefined ? 'fill' : null)) {
  const homes = records.filter((record) => !record.restricted && record.facts && record.kind !== 'other' && asks(record));
  if (!homes.length) return;
  const keys = new Map(homes.map((record) => [record, sortKey(record.address)]));
  const points = registryPoints(work, county.fips, county.state, new Set(keys.values()));
  if (!points) {
    log(`${county.fips}: no address registry to read here, so no municipality from city limits`);
    return;
  }
  const locate = locator(work, county.state, county.name, county.fips);
  const names = homes.some((record) => asks(record) === 'district') ? placeNames(work, county.state, county.fips) : new Set();
  const counts = { city: 0, town: 0, unincorporated: 0, reworded: 0, county_disagrees: 0, district_reworded: 0, district_names_a_place: 0, unsure: 0, no_point: 0, points_differ: 0 };
  for (const record of homes) {
    const a = record.address;
    const candidates = (points.get(keys.get(record)) || []).filter(([pre, suffix, post, zip]) => (!a.pre || !pre || pre === a.pre)
      && (!a.suffix || !suffix || suffix === a.suffix) && (!a.post || !post || post === a.post) && (!a.zip || !zip || zip === String(a.zip).slice(0, 5)));
    if (!candidates.length) { counts.no_point += 1; continue; }
    const found = new Set();
    let unsure = false;
    for (const [, , , , lng, lat] of candidates) {
      const at = locate(lng, lat);
      if (!at) { unsure = true; break; }
      found.add(JSON.stringify(at));
    }
    if (unsure) { counts.unsure += 1; continue; }
    if (found.size !== 1) { counts.points_differ += 1; continue; }
    const at = JSON.parse([...found][0]);
    const ask = asks(record);
    // A county whose municipality field holds a tax or planning district (derive.cjs DISTRICT_MUNICIPALITIES; founder, Nov 13,
    // "Yes, both"): where the county's words name no city, town or township at all ("COLUMBUS-WORTHINGTON CSD", "GREATER
    // EAST SIDE"), the city or town at the point, or "Unincorporated <County>" outside them. Words that name one ("CITY OF
    // COLUMBUS", "MAPLEWOOD", "PRAIRIE TOWNSHIP") stay the county's, even where the point says otherwise.
    if (ask === 'district') {
      const said = placeWords(record.facts.municipality);
      if (names.has(said) || /TOWNSHIP$/.test(said)) { counts.district_names_a_place += 1; continue; }
      counts.district_reworded += 1;
      hold(record, 'municipality', at.name, `From ${BOUNDARIES}`, { rewording: true });
      continue;
    }
    // A county that names itself says the home is in no city: only the limits agreeing reword it.
    if (ask === 'reword') {
      if (at.kind !== 'unincorporated') { counts.county_disagrees += 1; continue; }
      counts.reworded += 1;
      hold(record, 'municipality', at.name, `From ${BOUNDARIES}`, { rewording: true });
      continue;
    }
    counts[at.kind] += 1;
    hold(record, 'municipality', at.name, `From ${BOUNDARIES}`);
  }
  log(`${county.fips}: municipality from city limits: ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(', ')}`);
}

module.exports = { addMunicipalities, locator, BOUNDARIES };
