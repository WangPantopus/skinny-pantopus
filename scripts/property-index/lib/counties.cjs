'use strict';
// Which county a point is in, from the Census Bureau's county boundaries (public domain). No packages: the shapefile is
// read here. Hundreds of millions of points go through this, so a small grid remembers cells that lie in one county.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { download } = require('./tables.cjs');

const BOUNDARIES_URL = 'https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_county_500k.zip';
const BASE = 'cb_2024_us_county_500k';
const CELL = 0.25;
const FINE = 100; // cells per degree
// A point this far outside every county (about 5 km) isn't placed: the boundaries are simplified along the coast, not by that much.
const NEAREST_DEGREES = 0.05;

function readDbf(bytes) {
  const headerLength = bytes.readUInt16LE(8);
  const recordLength = bytes.readUInt16LE(10);
  const count = bytes.readUInt32LE(4);
  const fields = [];
  for (let at = 32; bytes[at] !== 0x0d; at += 32) {
    fields.push({ name: bytes.toString('latin1', at, at + 11).replace(/\0.*$/, ''), length: bytes[at + 16] });
  }
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    let at = headerLength + i * recordLength + 1;
    const row = {};
    for (const field of fields) {
      row[field.name] = bytes.toString('latin1', at, at + field.length).trim();
      at += field.length;
    }
    rows.push(row);
  }
  return rows;
}

/** Each polygon's rings as flat [lng, lat, ...] arrays. */
function readShp(bytes) {
  const polygons = [];
  let at = 100;
  while (at < bytes.length) {
    const length = bytes.readInt32BE(at + 4) * 2;
    const body = at + 8;
    if (bytes.readInt32LE(body) === 5) {
      const numParts = bytes.readInt32LE(body + 36);
      const numPoints = bytes.readInt32LE(body + 40);
      const parts = [];
      for (let i = 0; i < numParts; i += 1) parts.push(bytes.readInt32LE(body + 44 + i * 4));
      parts.push(numPoints);
      const points = body + 44 + numParts * 4;
      const rings = [];
      for (let i = 0; i < numParts; i += 1) {
        const ring = new Float64Array((parts[i + 1] - parts[i]) * 2);
        for (let j = 0; j < ring.length; j += 1) ring[j] = bytes.readDoubleLE(points + (parts[i] * 2 + j) * 8);
        rings.push(ring);
      }
      polygons.push(rings);
    } else polygons.push([]);
    at = body + length;
  }
  return polygons;
}

function inRings(rings, x, y) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const yi = ring[i + 1];
      const yj = ring[j + 1];
      if ((yi > y) !== (yj > y) && x < ((ring[j] - ring[i]) * (y - yi)) / (yj - yi) + ring[i]) inside = !inside;
    }
  }
  return inside;
}

function distanceSquared(rings, x, y, scale) {
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 2; i += 2) {
      const ax = ring[i] * scale;
      const ay = ring[i + 1];
      const dx = ring[i + 2] * scale - ax;
      const dy = ring[i + 3] - ay;
      const t = Math.max(0, Math.min(1, ((x * scale - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      const ex = ax + t * dx - x * scale;
      const ey = ay + t * dy - y;
      best = Math.min(best, ex * ex + ey * ey);
    }
  }
  return best;
}

/**
 * @param {string} work  Where downloads go
 * @returns {{locate: (lng: number, lat: number) => string, names: Map<string, string>}} locate answers a county FIPS, or ''
 */
function loadCounties(work) {
  const zip = path.join(work, 'geo', `${BASE}.zip`);
  download(BOUNDARIES_URL, zip);
  const read = (member) => execFileSync('unzip', ['-p', zip, member], { maxBuffer: 256 * 1024 * 1024 });
  const rows = readDbf(read(`${BASE}.dbf`));
  const polygons = readShp(read(`${BASE}.shp`));
  const counties = rows.map((row, i) => {
    let [xmin, ymin, xmax, ymax] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const ring of polygons[i]) {
      for (let j = 0; j < ring.length; j += 2) {
        xmin = Math.min(xmin, ring[j]);
        xmax = Math.max(xmax, ring[j]);
        ymin = Math.min(ymin, ring[j + 1]);
        ymax = Math.max(ymax, ring[j + 1]);
      }
    }
    return { fips: row.GEOID, name: row.NAMELSAD || row.NAME, rings: polygons[i], xmin, ymin, xmax, ymax };
  });

  const cellKey = (cx, cy) => (cx + 1000) * 2000 + (cy + 1000);
  const grid = new Map();
  counties.forEach((county, index) => {
    for (let cx = Math.floor(county.xmin / CELL); cx <= Math.floor(county.xmax / CELL); cx += 1) {
      for (let cy = Math.floor(county.ymin / CELL); cy <= Math.floor(county.ymax / CELL); cy += 1) {
        const key = cellKey(cx, cy);
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(index);
      }
    }
  });
  const candidates = (x, y) => grid.get(cellKey(Math.floor(x / CELL), Math.floor(y / CELL))) || [];
  const inside = (x, y) => {
    for (const index of candidates(x, y)) {
      const county = counties[index];
      if (x >= county.xmin && x <= county.xmax && y >= county.ymin && y <= county.ymax && inRings(county.rings, x, y)) return index;
    }
    return -1;
  };
  const nearest = (x, y) => {
    const scale = Math.cos((y * Math.PI) / 180);
    const seen = new Set();
    let best = -1;
    let bestDistance = NEAREST_DEGREES * NEAREST_DEGREES;
    for (const dx of [-CELL, 0, CELL]) {
      for (const dy of [-CELL, 0, CELL]) {
        for (const index of candidates(x + dx, y + dy)) {
          if (seen.has(index)) continue;
          seen.add(index);
          const distance = distanceSquared(counties[index].rings, x, y, scale);
          if (distance < bestDistance) {
            best = index;
            bestDistance = distance;
          }
        }
      }
    }
    return best;
  };

  // A fine cell whose corners and middle sit in one county answers without the polygon test. -2: unknown yet; -1: test each point.
  const fine = new Map();
  const fineKey = (fx, fy) => (fx + 36000) * 40000 + (fy + 20000);
  function locate(x, y) {
    const fx = Math.floor(x * FINE);
    const fy = Math.floor(y * FINE);
    const key = fineKey(fx, fy);
    let known = fine.get(key);
    if (known === undefined) {
      const west = fx / FINE;
      const south = fy / FINE;
      const step = 1 / FINE;
      const a = inside(west + step / 2, south + step / 2);
      known = a >= 0 && [[0, 0], [step, 0], [0, step], [step, step]].every(([dx, dy]) => inside(west + dx, south + dy) === a) ? a : -1;
      fine.set(key, known);
    }
    if (known >= 0) return counties[known].fips;
    const index = inside(x, y);
    if (index >= 0) return counties[index].fips;
    const near = nearest(x, y);
    return near >= 0 ? counties[near].fips : '';
  }
  return { locate, names: new Map(counties.map((county) => [county.fips, county.name])) };
}

module.exports = { loadCounties, readDbf, readShp, inRings };
