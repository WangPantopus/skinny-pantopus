'use strict';

/**
 * Our own index of the public places the host's place picker shows
 * (planPlaces.js), for the 50 states, DC, Puerto Rico and the US Virgin
 * Islands, so a new area answers in a second instead of waiting on the busy
 * public Overpass servers (they stay the fallback).
 *
 * scripts/places/build-index.cjs builds it each month from Geofabrik's
 * OpenStreetMap extracts, keeping the same elements and tags the Overpass
 * query asks for, and .github/workflows/places-index.yml publishes it as two
 * files on the repo's `places-index` release:
 *   - manifest.json: the data file's name and, for each ~20 × 28 km area
 *     (geohash 4) that has places, [byte offset, byte length, element count];
 *   - places-<date>.bin: each area's elements as one gzip'd JSON array, back
 *     to back. An element is [type ("n" or "w"), OSM id, lat, lng, tags].
 * A cell reads only the areas its box touches, with HTTP range requests
 * (GitHub serves release files with ranges). Areas read lately stay in memory.
 *
 * The data is © OpenStreetMap contributors under the ODbL; the picker shows
 * that credit (planPlaces ATTRIBUTION).
 */

const zlib = require('zlib');
const logger = require('../../utils/logger');
const { encodeGeohash } = require('../../utils/geohash');
const { FORMAT, PRECISION, SELECTORS, decodeElement } = require('./placesIndexFormat');

// An empty PLACES_INDEX_URL turns the index off (every area asks Overpass).
const MANIFEST_URL = process.env.PLACES_INDEX_URL
  ?? 'https://github.com/WangPantopus/skinny-pantopus/releases/download/places-index/manifest.json';
const MANIFEST_FRESH_MS = 60 * 60 * 1000;
// After a failed manifest read, the last good one (or none) is used this long before asking again.
const MANIFEST_RETRY_MS = 5 * 60 * 1000;
const READ_TIMEOUT_MS = 15000;
const KEPT_AREAS = 40;
// Overpass answers at most 1,500 elements a cell; a downtown box can hold more. The nearest are kept.
const MAX_CELL_ELEMENTS = 3000;
// How far past a box (~2 km) the areas are read for parks that reach into it.
const REACH_DEGREES = 0.02;
const USER_AGENT = 'Pantopus/1.0 (Nearby Plans place picker)';

let manifest = null;
let manifestAt = 0;
let manifestTriedAt = 0;
let manifestJob = null;

async function readManifest() {
  const response = await fetch(MANIFEST_URL, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`The places index manifest answered ${response.status}`);
  const data = await response.json();
  if (data?.v !== FORMAT || data.precision !== PRECISION || typeof data.data !== 'string'
    || !data.regions || typeof data.regions !== 'object') {
    throw new Error('The places index manifest is not one this server reads');
  }
  return { ...data, dataUrl: new URL(data.data, MANIFEST_URL).toString() };
}

/**
 * The newest manifest, or the last good one while the next is read or can't
 * be (null before any is read). Only the first read is waited for.
 */
async function currentManifest() {
  if (!MANIFEST_URL) return null;
  const now = Date.now();
  const due = (!manifest || now - manifestAt >= MANIFEST_FRESH_MS) && now - manifestTriedAt >= MANIFEST_RETRY_MS;
  if (due && !manifestJob) {
    manifestTriedAt = now;
    manifestJob = readManifest()
      .then((read) => {
        manifest = read;
        manifestAt = Date.now();
      }, (err) => {
        logger.warn('plans.places.index_manifest_failed', { error: err.message });
      })
      .finally(() => { manifestJob = null; });
  }
  if (!manifest && manifestJob) await manifestJob;
  return manifest;
}

async function readRange(url, offset, length) {
  const response = await fetch(url, {
    headers: { Range: `bytes=${offset}-${offset + length - 1}`, 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
  });
  // Anything but the range asked for (a 200 would be the whole file) is a failure.
  if (response.status !== 206) {
    await response.body?.cancel();
    throw new Error(`The places index answered ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== length) throw new Error('The places index answered a short read');
  return bytes;
}

// `${data file}:${area}` → the area's elements, most recently used last.
const areas = new Map();

function areaElements(current, area) {
  const key = `${current.data}:${area}`;
  let job = areas.get(key);
  if (job) {
    areas.delete(key);
  } else {
    const [offset, length] = current.regions[area];
    job = readRange(current.dataUrl, offset, length)
      .then((bytes) => JSON.parse(zlib.gunzipSync(bytes).toString('utf8')).map(decodeElement));
    job.catch(() => areas.delete(key));
  }
  areas.set(key, job);
  while (areas.size > KEPT_AREAS) areas.delete(areas.keys().next().value);
  return job;
}

/**
 * The index's elements inside the box ({ south, west, north, east }, smaller
 * than one area, as a padded geohash-5 cell is), in Overpass's shape. Null
 * when the index can't answer there: not published or unreadable just now,
 * or the box's middle is in no area it holds (outside the US, or a stretch
 * with no places at all), so the caller asks Overpass. Throws when an area
 * it holds couldn't be read.
 */
async function elementsIn(box) {
  const current = await currentManifest();
  if (!current) return null;
  const middle = { latitude: (box.south + box.north) / 2, longitude: (box.west + box.east) / 2 };
  if (!current.regions[encodeGeohash(middle.latitude, middle.longitude, PRECISION)]) return null;
  // A park whose middle is just past the box (in the next area) can still reach into it.
  const s = box.south - REACH_DEGREES;
  const n = box.north + REACH_DEGREES;
  const w = box.west - REACH_DEGREES;
  const e = box.east + REACH_DEGREES;
  const touched = new Set([[s, w], [s, e], [n, w], [n, e]].map(([lat, lng]) => encodeGeohash(lat, lng, PRECISION)));
  const lists = await Promise.all([...touched].filter((area) => current.regions[area])
    .map((area) => areaElements(current, area)));
  // As Overpass: an element counts when any of it is in the box.
  const inside = lists.flat().filter((el) => el.lat - el.halfLat <= box.north && el.lat + el.halfLat >= box.south
    && el.lon - el.halfLng <= box.east && el.lon + el.halfLng >= box.west);
  const away = (el) => (el.lat - middle.latitude) ** 2 + (el.lon - middle.longitude) ** 2;
  const kept = inside.length <= MAX_CELL_ELEMENTS ? inside
    : inside.sort((a, b) => away(a) - away(b)).slice(0, MAX_CELL_ELEMENTS);
  // Overpass's order (nodes, then ways, each by id): toPlaces keeps the first of same-named neighbors.
  return kept.sort((a, b) => (a.type === b.type ? a.id - b.id : a.type < b.type ? -1 : 1));
}

module.exports = { elementsIn, SELECTORS };
