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
// The Place page waits for every section, so a saved home's lookup gets
// the /start preview's per-section budget rather than the fetch timeout.
const HOME_BUDGET_MS = 3500;
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
    // The canvas names this layer "The state" everywhere (Overview, Peel).
    { level: 'state', geoid: stateGeoid, name: 'The state' },
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

// What counts as a government follows the Census of Governments, so the
// count never names one government twice or an agency as its own.
//
// Consolidated city-counties in the covered states: the city and the county
// are one government, counted once under one name. Honolulu has no
// incorporated place, and Carson City's place carries no type ("Carson
// City", not "City of Carson"), so the reviewed name comes from here.
const CONSOLIDATED_COUNTIES = {
  '06075': 'City of San Francisco',
  '08014': 'City of Broomfield',
  '08031': 'City of Denver',
  '15003': 'City and County of Honolulu',
  '32510': 'Carson City',
};

// Where the state, county, city or borough runs the public schools (no
// independent school districts: Alaska, D.C., Hawaii, Maryland, North
// Carolina, Virginia), the school system is part of a government already
// counted, such as Hawaii's statewide Department of Education.
const DEPENDENT_SCHOOL_STATES = new Set(['02', '11', '15', '24', '37', '51']);

/**
 * The governments to count and show, each independent government once.
 * Applied when the card is composed, so cached lookups follow it too.
 */
function countedGovernments(items) {
  const list = Array.isArray(items) ? items : [];
  const state = list.find((item) => item.level === 'state');
  const county = list.find((item) => item.level === 'county');
  const merged = county ? CONSOLIDATED_COUNTIES[county.geoid] : null;
  const schoolsCounted = !(state && DEPENDENT_SCHOOL_STATES.has(state.geoid));
  return list.flatMap((item) => {
    if (merged && item.level === 'county') return [{ ...item, level: 'city', name: merged }];
    if (merged && item.level === 'city') return [];
    if (!schoolsCounted && item.level === 'school') return [];
    return [item];
  });
}

function pointOf(home) {
  const lat = Number(home && home.map_center_lat);
  const lng = Number(home && home.map_center_lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

// One Place load composes civic_election and civic_districts together, and
// both ask for the same home's governments: share a lookup while it runs
// so a cold cache calls the geocoder once.
const inFlight = new Map();

/**
 * A saved home's governments, cached per home and exact point. Past the
 * budget the caller gets null (the card goes out without the governments
 * line) and the lookup keeps running, so its answer fills the cache for
 * the next load.
 */
async function governmentsForHome(home, { budgetMs = HOME_BUDGET_MS } = {}) {
  const point = pointOf(home);
  if (!point || !home.id) return null;
  const cacheKey = `home:${home.id}:${encodeGeohash(point.lat, point.lng, 9)}`;
  let lookup = inFlight.get(cacheKey);
  if (!lookup) {
    lookup = readThrough({
      cacheKey,
      sectionId: SECTION_ID,
      ttlMs: CACHE_TTL_MS,
      // readThrough counts the limit from fetched_at, and a row only goes
      // stale after the TTL: this serves it up to 7 days past expiry.
      maxStaleMs: CACHE_TTL_MS + MAX_STALE_MS,
      fetch: async () => {
        const geo = await fetchGeographies(point.lat, point.lng);
        return geo ? governmentsFromGeographies(geo) : null;
      },
    })
      .then(({ payload, stale }) => (payload ? { ...payload, stale: Boolean(stale) } : null))
      .catch((err) => {
        logger.warn('ballot: home governments lookup failed', { homeId: home.id, error: err.message });
        return null;
      })
      .finally(() => inFlight.delete(cacheKey));
    inFlight.set(cacheKey, lookup);
  }
  let timer = null;
  const budget = new Promise((resolve) => {
    timer = setTimeout(() => {
      logger.warn('ballot: home governments lookup over budget', { homeId: home.id, budgetMs });
      resolve(null);
    }, budgetMs);
    if (typeof timer.unref === 'function') timer.unref();
  });
  try {
    return await Promise.race([lookup, budget]);
  } finally {
    clearTimeout(timer);
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
  countedGovernments,
  governmentsForHome,
  governmentsForPoint,
  placeName,
  geocoderUrl,
  SECTION_ID,
  CACHE_TTL_MS,
  MAX_STALE_MS,
};
