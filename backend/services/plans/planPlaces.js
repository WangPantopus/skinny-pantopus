'use strict';

/**
 * Public places for the host's place picker (board H6): parks, playgrounds,
 * libraries, courts, trails, cafés, bars and restaurants near a point.
 *
 * Mapbox's geocoding no longer returns points of interest, so the places come
 * from OpenStreetMap through the public Overpass API (free, no key; the servers
 * are tried in turn, and they can be slow). Results are cached for 24 hours per
 * area (a ~5 km geohash cell, padded so every point in the cell sees ~3 km
 * around it) in PlaceSectionCache. A cached area answers at once, even when its
 * day is up (it refreshes in the background). An area seen for the first time
 * waits up to 8 seconds, then answers `loading: true` while the fetch finishes,
 * so the app can show its search and ask again. OSM's license asks for credit
 * where the data shows: responses carry `attribution`.
 */

const logger = require('../../utils/logger');
const { encodeGeohash, decodeGeohashBbox } = require('../../utils/geohash');
const placeSectionCache = require('../placeSectionCache');
const rules = require('./planRules');

const OVERPASS_URLS = [
  process.env.OVERPASS_API_URL,
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
].filter(Boolean);
const FETCH_TIMEOUT_MS = 45000;
const FIRST_ANSWER_WAIT_MS = 8000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SECTION_ID = 'plans_places_osm_v1';
const CELL_PRECISION = 5;
const PAD_DEGREES = 0.03;
const SHOW_RADIUS_METERS = 3 * rules.MILE_METERS;
const MAX_RESULTS = 40;
const ATTRIBUTION = '© OpenStreetMap contributors';

const SPORT_NAMES = {
  pickleball: 'pickleball courts',
  tennis: 'tennis courts',
  basketball: 'basketball court',
  soccer: 'soccer field',
  volleyball: 'volleyball court',
  baseball: 'baseball field',
  softball: 'softball field',
  american_football: 'football field',
  multi: 'sports courts',
};

/** Plain tag matches only (no regular expressions): the cheapest query for the public servers. */
function overpassQuery({ south, west, north, east }) {
  const b = `${south},${west},${north},${east}`;
  return `[out:json][timeout:40];
(
  way["leisure"="park"](${b}); node["leisure"="park"](${b});
  way["leisure"="dog_park"](${b}); way["leisure"="nature_reserve"](${b});
  way["leisure"="playground"](${b}); node["leisure"="playground"](${b});
  way["leisure"="pitch"](${b}); node["leisure"="pitch"](${b});
  node["amenity"="library"](${b}); way["amenity"="library"](${b});
  node["amenity"="community_centre"](${b}); way["amenity"="community_centre"](${b});
  node["amenity"="cafe"](${b}); way["amenity"="cafe"](${b}); node["amenity"="ice_cream"](${b});
  node["amenity"="bar"](${b}); node["amenity"="pub"](${b}); way["amenity"="pub"](${b});
  node["amenity"="restaurant"](${b}); way["amenity"="restaurant"](${b});
);
out center tags 1500;`;
}

function categoryOf(tags) {
  if (tags.amenity === 'library') return 'library';
  if (tags.amenity === 'cafe' || tags.amenity === 'ice_cream') return 'cafe';
  if (tags.amenity === 'bar' || tags.amenity === 'pub') return 'bar';
  if (tags.amenity === 'restaurant') return 'restaurant';
  if (tags.amenity === 'community_centre') return 'community_center';
  if (tags.leisure === 'playground') return 'playground';
  if (tags.leisure === 'pitch') return tags.sport ? 'court' : null;
  if (tags.highway) return /\btrail\b/i.test(tags.name || '') ? 'trail' : null;
  if (tags.leisure === 'park' && /\btrail\b/i.test(tags.name || '')) return 'trail';
  if (['park', 'dog_park', 'nature_reserve', 'garden'].includes(tags.leisure)) return 'park';
  return null;
}

function addressOf(tags) {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const city = tags['addr:city'];
  return [street, city].filter(Boolean).join(', ') || null;
}

function pointOf(element) {
  const lat = Number(element.center ? element.center.lat : element.lat);
  const lng = Number(element.center ? element.center.lon : element.lon);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null;
}

/** OSM elements → places: named ones as they are; unnamed courts and playgrounds named after their park. */
function toPlaces(elements) {
  const parks = [];
  const raw = [];
  for (const element of elements || []) {
    const tags = element.tags || {};
    const category = categoryOf(tags);
    const point = pointOf(element);
    if (!category || !point) continue;
    const item = { id: `osm:${element.type}/${element.id}`, tags, category, point, name: (tags.name || '').trim() };
    if (category === 'park' && item.name) parks.push(item);
    raw.push(item);
  }
  const nearestPark = (point) => {
    let best = null;
    for (const park of parks) {
      const d = rules.distanceMeters(point, park.point);
      if (d <= 400 && (!best || d < best.d)) best = { park, d };
    }
    return best ? best.park : null;
  };

  const places = [];
  const seenNames = new Map();
  const merged = new Map();
  for (const item of raw) {
    let name = item.name;
    if (!name && (item.category === 'court' || item.category === 'playground')) {
      const park = nearestPark(item.point);
      if (!park) continue;
      const what = item.category === 'playground' ? 'playground' : (SPORT_NAMES[String(item.tags.sport).split(';')[0]] || 'courts');
      name = `${park.name} ${what}`;
    }
    if (!name) continue;
    // One row per name in a neighborhood: trail segments and side-by-side courts merge.
    const key = `${item.category}:${name.toLowerCase()}`;
    const existing = merged.get(key);
    if (existing && rules.distanceMeters(existing.point, item.point) < 1500) continue;
    const place = {
      place_id: item.id,
      name,
      category: item.category,
      categories: [item.category, ...(item.tags.sport ? [String(item.tags.sport)] : [])],
      address: addressOf(item.tags),
      point: item.point,
    };
    merged.set(key, place);
    seenNames.set(name.toLowerCase(), true);
    places.push(place);
  }
  return places;
}

async function askOverpass(url, query) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Pantopus/1.0 (Nearby Plans place picker)' },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Overpass answered ${response.status}`);
  try {
    const data = JSON.parse(text);
    if (!Array.isArray(data.elements)) throw new Error('no elements');
    return data.elements;
  } catch (_) {
    throw new Error('Overpass answered with an error page');
  }
}

async function fetchCell(cell) {
  const box = decodeGeohashBbox(cell);
  const query = overpassQuery({
    south: box.minLat - PAD_DEGREES,
    north: box.maxLat + PAD_DEGREES,
    west: box.minLng - PAD_DEGREES,
    east: box.maxLng + PAD_DEGREES,
  });
  let lastError = null;
  for (const url of OVERPASS_URLS) {
    try {
      const elements = await askOverpass(url, query);
      return toPlaces(elements).map((p) => ({ ...p, latitude: p.point.latitude, longitude: p.point.longitude, point: undefined }));
    } catch (err) {
      lastError = err;
      logger.warn('plans.places.overpass_failed', { host: new URL(url).host, error: err.message });
    }
  }
  throw lastError || new Error('No Overpass server answered');
}

const inflight = new Map();

/** One fetch per area at a time; the result is written to the cache. */
function refreshCell(cell) {
  if (inflight.has(cell)) return inflight.get(cell);
  const job = fetchCell(cell)
    .then(async (places) => {
      await placeSectionCache.writeRow(`geo:${cell}`, SECTION_ID, places, CACHE_TTL_MS, new Date().toISOString());
      return places;
    })
    .finally(() => inflight.delete(cell));
  inflight.set(cell, job);
  return job;
}

/** Cached places for the area: at once when cached (fresh or not), else a short wait for the first fetch. */
async function areaPlaces(cell) {
  const row = await placeSectionCache.readRow(`geo:${cell}`, SECTION_ID);
  if (row && Array.isArray(row.payload)) {
    if (Date.parse(row.expires_at) <= Date.now()) {
      refreshCell(cell).catch((err) => logger.warn('plans.places.refresh_failed', { cell, error: err.message }));
    }
    return { places: row.payload, loading: false };
  }
  const job = refreshCell(cell);
  const timeout = new Promise((resolve) => { setTimeout(() => resolve(null), FIRST_ANSWER_WAIT_MS).unref?.(); });
  const places = await Promise.race([job, timeout]);
  if (places) return { places, loading: false };
  job.catch((err) => logger.warn('plans.places.first_fetch_failed', { cell, error: err.message }));
  return { places: [], loading: true };
}

/**
 * Places near a point, nearest first, within about 3 miles.
 * @param {{ latitude: number, longitude: number, q?: string }} opts
 */
async function placesNear({ latitude, longitude, q = '' }) {
  const cell = encodeGeohash(latitude, longitude, CELL_PRECISION);
  const { places: payload, loading } = await areaPlaces(cell);
  const origin = { latitude, longitude };
  const needle = String(q || '').trim().toLowerCase();
  const places = (payload || [])
    .map((p) => ({ ...p, distance_m: Math.round(rules.distanceMeters(origin, p)) }))
    .filter((p) => p.distance_m <= SHOW_RADIUS_METERS)
    .filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.category.includes(needle))
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, MAX_RESULTS)
    .map(({ place_id, name, category, categories, address, latitude: lat, longitude: lng, distance_m }) => ({
      place_id, name, category, categories, address, latitude: lat, longitude: lng, distance_m,
    }));
  return { places, loading, attribution: ATTRIBUTION };
}

module.exports = { placesNear, toPlaces, ATTRIBUTION };
