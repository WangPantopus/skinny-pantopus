// ============================================================
// BALLOT GOVERNMENTS — the typed governments an exact point sits inside
//
// The Place `civic_districts` section caches the Census geocoder per
// geohash-6 (~1.2 × 0.6 km) and keeps only display rows, so two homes in
// one cell can get each other's districts. Ballot never reads that row.
// It asks the geocoder about the exact point and keeps typed identities:
//
//   • a saved home → cached per home AND point (`home:<id>:<geohash-9>`),
//     30 days, never served more than 7 days stale; a moved pin is a new
//     key, so an address change never reuses the old answer;
//   • an anonymous /start lookup → a live call that writes nothing.
//
// P0 counts governments, not election districts: the United States, the
// state, the county, an incorporated place and the school district(s).
// Special districts are not integrated anywhere yet, so every count is a
// minimum ("at least N").
// ============================================================

const logger = require('../../utils/logger');
const { encodeGeohash } = require('../../utils/geohash');
const { readThrough } = require('../placeSectionCache');

const DAY_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 30 * DAY_MS;
const MAX_STALE_MS = 7 * DAY_MS;
const SECTION_ID = '_ballot_governments';

function geocoderUrl(lat, lng) {
  return 'https://geocoding.geo.census.gov/geocoder/geographies/coordinates'
    + `?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=all&format=json`;
}

async function fetchGeographies(lat, lng, { timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(geocoderUrl(lat, lng), { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data && data.result && data.result.geographies) || null;
  } finally {
    clearTimeout(timer);
  }
}

// Layer keys vary by vintage ("2024 State Legislative Districts - Upper"),
// so layers are matched by pattern, as districtsFromGeographies does.
function firstRow(geo, pattern) {
  const key = Object.keys(geo || {}).find((k) => pattern.test(k));
  const rows = key && geo[key];
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function geoidOf(row, parts) {
  if (row && typeof row.GEOID === 'string' && /^\d+$/.test(row.GEOID)) return row.GEOID;
  const joined = parts.map((p) => String((row && row[p]) || '')).join('');
  return /^\d+$/.test(joined) ? joined : null;
}

// "Camas city" → "City of Camas"; "Yacolt town" → "Town of Yacolt".
function placeName(raw) {
  const name = String(raw || '').trim();
  const m = /^(.*\S)\s+(city|town|village|borough)$/i.exec(name);
  if (!m) return name;
  const kind = m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase();
  return `${kind} of ${m[1]}`;
}

/**
 * Typed governments from a geocoder `geographies` object. Wide to narrow:
 * nation, state, county, school district(s), incorporated place. Returns
 * null when the point could not be placed in a state and county — a count
 * without them would not be a count of anything.
 */
function governmentsFromGeographies(geo) {
  const state = firstRow(geo, /^States$/);
  const county = firstRow(geo, /^Counties$/);
  const stateGeoid = geoidOf(state, ['STATE']);
  const countyGeoid = geoidOf(county, ['STATE', 'COUNTY']);
  if (!state || !county || !stateGeoid || !countyGeoid) return null;

  const items = [
    { level: 'federal', geoid: 'us', name: 'United States' },
    { level: 'state', geoid: stateGeoid, name: String(state.NAME || '').trim() },
    { level: 'county', geoid: countyGeoid, name: String(county.NAME || '').trim() },
  ];

  const unified = firstRow(geo, /Unified School Districts$/);
  if (unified) {
    items.push({ level: 'school', geoid: geoidOf(unified, ['STATE', 'UNSDLEA']), name: String(unified.NAME || '').trim() });
  } else {
    const elementary = firstRow(geo, /Elementary School Districts$/);
    const secondary = firstRow(geo, /Secondary School Districts$/);
    if (elementary) items.push({ level: 'school', geoid: geoidOf(elementary, ['STATE', 'ELSDLEA']), name: String(elementary.NAME || '').trim() });
    if (secondary) items.push({ level: 'school', geoid: geoidOf(secondary, ['STATE', 'SCSDLEA']), name: String(secondary.NAME || '').trim() });
  }

  const place = firstRow(geo, /^Incorporated Places$/);
  if (place) items.push({ level: 'city', geoid: geoidOf(place, ['STATE', 'PLACE']), name: placeName(place.NAME) });

  // Typed identity: a school district and a place can share a numeric
  // GEOID length, so dedupe on level + id, and drop rows with no id/name.
  const seen = new Set();
  const typed = items.filter((item) => {
    if (!item.geoid || !item.name) return false;
    const key = `${item.level}:${item.geoid}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { items: typed, county_geoid: countyGeoid, state_geoid: stateGeoid };
}

function pointOf(home) {
  const lat = Number(home && home.map_center_lat);
  const lng = Number(home && home.map_center_lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** A saved home's governments, cached per home and exact point. */
async function governmentsForHome(home) {
  const point = pointOf(home);
  if (!point || !home.id) return null;
  try {
    const { payload, stale } = await readThrough({
      cacheKey: `home:${home.id}:${encodeGeohash(point.lat, point.lng, 9)}`,
      sectionId: SECTION_ID,
      ttlMs: CACHE_TTL_MS,
      maxStaleMs: MAX_STALE_MS,
      fetch: async () => {
        const geo = await fetchGeographies(point.lat, point.lng);
        return geo ? governmentsFromGeographies(geo) : null;
      },
    });
    return payload ? { ...payload, stale: Boolean(stale) } : null;
  } catch (err) {
    logger.warn('ballot: home governments lookup failed', { homeId: home.id, error: err.message });
    return null;
  }
}

/** An anonymous point's governments: a live call, nothing written. */
async function governmentsForPoint(lat, lng, options = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  try {
    const geo = await fetchGeographies(lat, lng, options);
    return geo ? governmentsFromGeographies(geo) : null;
  } catch (err) {
    logger.warn('ballot: point governments lookup failed', { error: err.message });
    return null;
  }
}

module.exports = {
  governmentsFromGeographies,
  governmentsForHome,
  governmentsForPoint,
  placeName,
  geocoderUrl,
  SECTION_ID,
  CACHE_TTL_MS,
  MAX_STALE_MS,
};
