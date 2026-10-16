// ============================================================
// BALLOT GOVERNMENTS — the typed governments an exact point sits inside
//
// Civic districts and Ballot governments share the exact supplied point and
// in-flight Census lookup nationwide. Versioned point keys bypass the old
// geohash-6 and geohash-9 rows, which could cross a district boundary.
// The key identifies land, not a home or household; moving a pin gets a new
// answer. Point keys are redacted from logs by placeSectionCache.
// A saved home's governments expire after 30 days (at most 7 days stale).
// An anonymous /start lookup makes a live call without writing here.
//
// P0 counts governments, not election districts: the United States, the
// state, the county, an incorporated place and the school district(s).
// Special districts are not integrated anywhere yet, so every count is a
// minimum ("at least N").
// ============================================================

const logger = require('../../utils/logger');
const { createHash } = require('crypto');
const { readThrough, readRow } = require('../placeSectionCache');

const DAY_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 30 * DAY_MS;
const MAX_STALE_MS = 7 * DAY_MS;
// The Place page waits for every section, so a saved home's lookup gets
// the /start preview's per-section budget rather than the fetch timeout.
const HOME_BUDGET_MS = 3500;
const SECTION_ID = '_ballot_governments';
// The District of Columbia's state FIPS code.
const DC_STATE_GEOID = '11';

function geocoderUrl(lat, lng) {
  return 'https://geocoding.geo.census.gov/geocoder/geographies/coordinates'
    + `?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=all&format=json`;
}

// No rounding: even adjacent points across a boundary must not share a row.
function pointCacheKey(lat, lng) {
  return `point:v2:${createHash('sha256').update(`${Number(lat)},${Number(lng)}`).digest('hex')}`;
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

// A Place load asks the geocoder about one point from two sections (the
// Ballot card and the Civic districts). While that call is running they
// share it, so a cold cache costs one request, not two.
const inFlightGeographies = new Map();

function sharedGeographies(lat, lng) {
  const url = geocoderUrl(lat, lng);
  let call = inFlightGeographies.get(url);
  if (!call) {
    call = fetchGeographies(lat, lng).finally(() => inFlightGeographies.delete(url));
    inFlightGeographies.set(url, call);
  }
  return call;
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

// "Camas city" → "City of Camas"; "Yacolt town" → "Town of Yacolt". Towns,
// townships and consolidated governments read the same way: "Bloomfield
// charter township" → "Charter Township of Bloomfield", "Nashville-Davidson
// metropolitan government (balance)" → "Metropolitan Government of
// Nashville-Davidson". Census writes the kind in lowercase, so "Carson City"
// stays as it is.
const PLACE_KINDS = /^(.*?\S)\s+(city|town|village|borough|municipality|charter township|township|plantation|corporation|unified government|consolidated government|metropolitan government|metro government)$/;

function placeName(raw) {
  const name = String(raw || '').trim().replace(/\s+\(balance\)$/, '').replace(/ urban county$/, ' Urban County');
  const m = PLACE_KINDS.exec(name);
  if (!m) return name;
  const kind = m[2].replace(/\b[a-z]/g, (c) => c.toUpperCase());
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
    // Washington, D.C. has none: the District itself does what a state does.
    ...(stateGeoid === DC_STATE_GEOID ? [] : [{ level: 'state', geoid: stateGeoid, name: 'The state' }]),
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
// count never names one government twice or an agency as its own. The two
// rules that depend on the state live in states.json, per supported state
// (adding a state means answering both there, not editing this file):
//
//   • consolidated_counties: a county that is one government with its city
//     is counted once, under the reviewed name (Honolulu has no incorporated
//     place, and Carson City's place carries no type, so the Census name
//     would read wrongly);
//   • dependent_schools: where the state, county, city or borough runs the
//     public schools (no independent school districts), the school system is
//     part of a government already counted, such as Hawaii's statewide
//     Department of Education.

/**
 * The governments to count and show, each independent government once.
 * Applied when the card is composed, so cached lookups follow it too.
 *
 * @param {object[]} items  Typed governments from `governmentsFromGeographies`.
 * @param {{consolidatedCounties?: Object<string,string>, dependentSchools?: boolean}} [rules]
 */
function countedGovernments(items, { consolidatedCounties = {}, dependentSchools = false } = {}) {
  const list = Array.isArray(items) ? items : [];
  const county = list.find((item) => item.level === 'county');
  const merged = county ? consolidatedCounties[county.geoid] : null;
  return list.flatMap((item) => {
    if (merged && item.level === 'county') return [{ ...item, level: 'city', name: merged }];
    if (merged && item.level === 'city') return [];
    if (dependentSchools && item.level === 'school') return [];
    return [item];
  });
}

// Number(null) is 0 and Number('') is 0, so a home with no coordinates would
// otherwise be looked up at 0,0 (the Gulf of Guinea) and cached there.
function pointOf(home) {
  const raw = [home && home.map_center_lat, home && home.map_center_lng];
  if (raw.some((v) => v == null || String(v).trim() === '')) return null;
  const [lat, lng] = raw.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

// One Place load composes civic_election and civic_districts together, and
// both ask for the same home's governments: share a lookup (and its cache
// read) while it runs so a cold cache calls the geocoder once and a warm one
// reads the row once.
const inFlight = new Map();

/**
 * A saved home's governments, cached per exact point. Past the budget the
 * caller gets an eligible cached answer, or null when there is none. The
 * lookup keeps running to refresh the next load.
 */
async function governmentsForHome(home, { budgetMs = HOME_BUDGET_MS } = {}) {
  const point = pointOf(home);
  if (!point) return null;
  const cacheKey = pointCacheKey(point.lat, point.lng);
  let shared = inFlight.get(cacheKey);
  if (!shared) {
    const row = readRow(cacheKey, SECTION_ID).catch(() => null);
    const lookup = readThrough({
      cacheKey,
      sectionId: SECTION_ID,
      ttlMs: CACHE_TTL_MS,
      // readThrough counts the limit from fetched_at, and a row only goes
      // stale after the TTL: this serves it up to 7 days past expiry.
      maxStaleMs: CACHE_TTL_MS + MAX_STALE_MS,
      fetch: async () => {
        const geo = await sharedGeographies(point.lat, point.lng);
        const found = geo ? governmentsFromGeographies(geo) : null;
        // A thrown error (not a null) is what lets readThrough serve an
        // eligible stale row when the geocoder answers without a state/county.
        if (!found) throw new Error('the boundary lookup placed no state and county');
        return found;
      },
    })
      .then(({ payload, stale }) => (payload ? { ...payload, stale: Boolean(stale) } : null))
      .catch((err) => {
        logger.warn('ballot: home governments lookup failed', { homeId: home.id, error: err.message });
        return null;
      })
      .finally(() => inFlight.delete(cacheKey));
    shared = { lookup, row };
    inFlight.set(cacheKey, shared);
  }
  // Read alongside the refresh so a slow provider (or cache read) cannot
  // extend the page budget. An expired answer is usable for seven days.
  let cachedRow = null;
  shared.row.then((row) => { cachedRow = row; });
  let timer = null;
  const budget = new Promise((resolve) => {
    timer = setTimeout(() => {
      logger.warn('ballot: home governments lookup over budget', { homeId: home.id, budgetMs });
      const now = Date.now();
      const age = cachedRow ? now - Date.parse(cachedRow.fetched_at) : NaN;
      resolve(cachedRow && cachedRow.payload && age >= 0 && age <= CACHE_TTL_MS + MAX_STALE_MS
        ? { ...cachedRow.payload, stale: Date.parse(cachedRow.expires_at) <= now }
        : null);
    }, budgetMs);
    if (typeof timer.unref === 'function') timer.unref();
  });
  try {
    return await Promise.race([shared.lookup, budget]);
  } finally {
    clearTimeout(timer);
  }
}

/** An anonymous point's governments: a live call, nothing written. */
async function governmentsForPoint(lat, lng, options = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
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
  sharedGeographies,
  pointCacheKey,
  placeName,
  geocoderUrl,
  SECTION_ID,
  CACHE_TTL_MS,
  MAX_STALE_MS,
};
