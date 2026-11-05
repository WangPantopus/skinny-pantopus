/**
 * Neighborhood Profile Service
 *
 * Fetches and caches neighborhood-level data (demographics, walkability,
 * flood risk) from three free APIs:
 *   - Census ACS (demographics via tract FIPS code)
 *   - Walk Score (walkability, transit, bike scores)
 *   - FEMA NFHL (flood zone designation)
 *
 * Uses a dedicated NeighborhoodProfileCache table keyed by Census tract ID
 * with a 90-day TTL (this data rarely changes).
 *
 * Individual source failures are handled gracefully — the profile is returned
 * with nulls for the failed source's fields.
 *
 * Environment variables (all optional):
 *   CENSUS_API_KEY    — Census API key (free, census.gov/developers)
 *   WALKSCORE_API_KEY — Walk Score API key (free, walkscore.com/professional)
 */
const supabaseAdmin = require('../../config/supabaseAdmin');
const { encodeGeohash } = require('../../utils/geohash');
const { readThrough } = require('../placeSectionCache');
const { readResponse, hasData } = require('../external/cacheHelper');
const logger = require('../../utils/logger');

const CACHE_TTL_DAYS = 90;
// Profiles missing census or flood retry on a short budget (see getProfile).
const PARTIAL_TTL_DAYS = 1;
const FETCH_TIMEOUT_MS = 8000;

// ── Flood zone descriptions ──────────────────────────────────────────────

const FLOOD_ZONE_DESC = {
  X: 'Minimal flood risk',
  A: 'High-risk flood area',
  AE: 'High-risk flood area (base elevations determined)',
  AH: 'Shallow flooding area',
  AO: 'Sheet flow flooding area',
  VE: 'Coastal high-risk flood area',
  V: 'Coastal high-risk flood area',
  D: 'Undetermined flood risk',
};

// ── Fetch helpers ────────────────────────────────────────────────────────

/**
 * Fetch with timeout and abort controller.
 * @param {string} url
 * @param {object} [opts]
 * @returns {Promise<Response|null>}
 */
async function timedFetch(url, opts = {}) {
  const deadline = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const signal = opts.signal ? AbortSignal.any([opts.signal, deadline]) : deadline;

  try {
    // Keep cancellation active while callers consume the response body.
    return await fetch(url, { ...opts, signal });
  } catch (err) {
    // ENDPOINT ONLY, NEVER THE QUERY STRING.
    //
    // `url.slice(0, 120)` looked harmless and was not: these URLs carry
    // the exact coordinates as `?x=…&y=…`, well inside the first 120
    // characters. So the coordinate meta fields elsewhere in this file
    // were coarsened to ~110m while the log line beside them still
    // printed the full-precision original.
    //
    // It matters because apm.js logs `user_id` for any request over
    // 500ms, and a Scout report — which fans out to FEMA, the Census
    // Bureau and the EPA — almost always is. The two lines land seconds
    // apart in the same stream, and together they reconstruct "this
    // account looked at this building".
    const endpoint = safeEndpoint(url);
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      logger.warn('Neighborhood profile fetch timeout', { endpoint });
    } else {
      logger.error('Neighborhood profile fetch error', { endpoint, error: err.message });
    }
    return null;
  }
}

/** Host + path of a URL, with the query string dropped. */
function safeEndpoint(url) {
  try {
    const u = new URL(String(url));
    return `${u.host}${u.pathname}`;
  } catch {
    // Not parseable — return nothing rather than risk printing the raw
    // string, which is the thing we are trying not to print.
    return 'unparseable-url';
  }
}

// ── Census Geocoder → FIPS Tract ─────────────────────────────────────────

/**
 * Geocode lat/lng to a Census FIPS tract code.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{ tractId: string, stateCode: string, countyCode: string }|null>}
 */
// Log WHERE a geocode failed, never WHICH BUILDING.
//
// These lines carried exact { lat, lng } — finer than anything the cache
// stores (geohash-7, ~150m) and finer than the request line itself. On
// Scout and the anonymous preview the coordinate IS the address a person
// typed, so a warn-level log of a provider hiccup was quietly the most
// precise record of the lookup anywhere in the system. Three decimal
// places is ~110m: enough to tell Portland from Brooklyn when reading a
// log, not enough to name a house.
function coarse(lat, lng) {
  return { near: `${Number(lat).toFixed(3)},${Number(lng).toFixed(3)}` };
}

async function geocodeToTract(lat, lng) {
  const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;

  try {
    const { response: data } = await readResponse({
      provider: 'CENSUS_GEOGRAPHIES', url, maxAgeMs: Infinity,
      isUsable: (data) => {
        const geo = data?.result?.geographies;
        const tract = (geo?.['Census Tracts'] || geo?.['2020 Census Tracts'])?.[0];
        return /^\d{2}$/.test(String(tract?.STATE || tract?.STATEFP || ''))
          && /^\d{3}$/.test(String(tract?.COUNTY || tract?.COUNTYFP || ''))
          && /^\d{6}$/.test(String(tract?.TRACT || tract?.TRACTCE || ''));
      },
      fetch: async () => {
        const res = await timedFetch(url);
        if (!res || !res.ok) {
          logger.warn('Census geocoder failed', { ...coarse(lat, lng), status: res?.status });
          return null;
        }

        return res.json();
      },
    });
    const geographies = data?.result?.geographies;
    const tracts = geographies?.['Census Tracts'] || geographies?.['2020 Census Tracts'] || [];

    if (tracts.length === 0) {
      logger.warn('Census geocoder returned no tracts', coarse(lat, lng));
      return null;
    }

    const tract = tracts[0];
    const stateCode = tract.STATE || tract.STATEFP;
    const countyCode = tract.COUNTY || tract.COUNTYFP;
    const tractCode = tract.TRACT || tract.TRACTCE;
    const tractId = `${stateCode}${countyCode}${tractCode}`;

    return { tractId, stateCode, countyCode };
  } catch (err) {
    logger.error('Census geocoder parse error', { ...coarse(lat, lng), error: err.message });
    return null;
  }
}

// ── Census ACS Fetch ─────────────────────────────────────────────────────

/**
 * Fetch ACS 5-year demographic data for a tract.
 * Variables: B25035_001E (median year built), B25077_001E (median home value),
 *            B19013_001E (median household income), B01003_001E (population),
 *            B25001_001E (housing units)
 *
 * @param {string} stateCode  2-digit FIPS state code
 * @param {string} countyCode 3-digit FIPS county code
 * @param {string} tractCode  6-digit tract code (from tractId minus state+county)
 * @returns {Promise<object|null>}
 */
async function fetchCensusACS(stateCode, countyCode, tractCode) {
  const apiKey = process.env.CENSUS_API_KEY;
  const variables = 'B25035_001E,B25077_001E,B19013_001E,B01003_001E,B25001_001E';

  let url = `https://api.census.gov/data/2023/acs/acs5?get=${variables}&for=tract:${tractCode}&in=state:${stateCode}+county:${countyCode}`;
  if (apiKey) url += `&key=${apiKey}`;

  try {
    const { response: data } = await readResponse({
      provider: 'CENSUS_ACS', url, maxAgeMs: Infinity,
      isUsable: (data) => Array.isArray(data) && data.length > 1 && hasData(data[1]),
      fetch: async () => {
        const res = await timedFetch(url);
        if (!res || !res.ok) {
          logger.warn('Census ACS fetch failed', { stateCode, countyCode, tractCode, status: res?.status });
          return null;
        }
        // api.census.gov now REQUIRES a key: keyless calls 302-redirect to an HTML
        // "missing key" page instead of failing. Surface that clearly rather than
        // letting it die downstream as a JSON parse error.
        if (String(res.url || '').includes('missing_key')) {
          logger.warn('Census ACS requires an API key — set CENSUS_API_KEY (free: api.census.gov/data/key_signup.html)');
          return null;
        }

        return res.json();
      },
    });
    // Response is [[headers], [values]]
    if (!Array.isArray(data) || data.length < 2) return null;

    const headers = data[0];
    const values = data[1];
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i]; });

    const parseNum = (v) => {
      if (v == null || v === '' || v === '-666666666') return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    };

    return {
      median_year_built: parseNum(row['B25035_001E']),
      median_home_value: parseNum(row['B25077_001E']),
      median_household_income: parseNum(row['B19013_001E']),
      total_population: parseNum(row['B01003_001E']),
      total_housing_units: parseNum(row['B25001_001E']),
    };
  } catch (err) {
    logger.error('Census ACS parse error', { error: err.message });
    return null;
  }
}

// ── Walk Score Fetch ─────────────────────────────────────────────────────

/**
 * Fetch Walk Score, Transit Score, and Bike Score.
 * @param {number} lat
 * @param {number} lng
 * @param {string} address  Formatted address string
 * @returns {Promise<object|null>}
 */
async function fetchWalkScore(lat, lng, address) {
  const apiKey = process.env.WALKSCORE_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    format: 'json',
    address,
    lat: String(lat),
    lon: String(lng),
    transit: '1',
    bike: '1',
    wsapikey: apiKey,
  });
  const url = `https://api.walkscore.com/score?${params}`;

  const res = await timedFetch(url);
  if (!res || !res.ok) {
    logger.warn('Walk Score fetch failed', { status: res?.status });
    return null;
  }

  try {
    const data = await res.json();
    if (data.status !== 1) {
      logger.warn('Walk Score API returned non-success status', { status: data.status });
      return null;
    }

    return {
      walk_score: data.walkscore ?? null,
      walk_description: data.description || null,
      transit_score: data.transit?.score ?? null,
      bike_score: data.bike?.score ?? null,
    };
  } catch (err) {
    logger.error('Walk Score parse error', { error: err.message });
    return null;
  }
}

// ── In-process memo ──────────────────────────────────────────────────────
// Place asks for the same few tracts on every load: a cell's tract (kept for good) and the tract's profile row
// (90 days). Each was a database read, one after the other, on every load, so a slow database held census_context
// for both. They are public Census data and are kept in this process for a while as well: the tract for a day,
// a fresh profile row for ten minutes and never past its own expiry.
const TRACT_MEMO_MS = 24 * 60 * 60 * 1000;
const PROFILE_MEMO_MS = 10 * 60 * 1000;
const MEMO_MAX = 2000;
const tractMemo = new Map(); // geohash-7 cell -> { value, until }
const profileMemo = new Map(); // tract id -> { value, until }

function memoGet(memo, key) {
  if (process.env.NODE_ENV === 'test') return null;
  const hit = memo.get(key);
  if (!hit) return null;
  if (hit.until <= Date.now()) {
    memo.delete(key);
    return null;
  }
  return hit.value;
}

function memoSet(memo, key, value, until) {
  if (process.env.NODE_ENV === 'test' || !(until > Date.now())) return;
  memo.delete(key);
  if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value);
  memo.set(key, { value, until });
}

// ── FEMA Flood Zone Fetch ────────────────────────────────────────────────

/**
 * geocodeToTract with a persistent cache. A point's tract assignment
 * changes only at the decennial census, so the lookup is effectively
 * permanent data — cached 365 days per ~150 m cell, with the expired
 * row served if the geocoder is down (database-first).
 */
async function geocodeToTractCached(lat, lng) {
  const gh7 = encodeGeohash(lat, lng, 7);
  const remembered = memoGet(tractMemo, gh7);
  if (remembered) return remembered;
  try {
    const { payload } = await readThrough({
      cacheKey: `geo:${gh7}`,
      sectionId: '_tract',
      reuseStored: true,
      ttlMs: 365 * 24 * 60 * 60 * 1000,
      fetch: () => geocodeToTract(lat, lng),
    });
    if (payload) memoSet(tractMemo, gh7, payload, Date.now() + TRACT_MEMO_MS);
    return payload || null;
  } catch (err) {
    // The cache layer must never make geocoding WORSE than uncached —
    // any cache-side failure degrades to the direct lookup.
    logger.warn('geocodeToTractCached cache layer failed — direct lookup', { error: err.message });
    return geocodeToTract(lat, lng);
  }
}

/**
 * Query FEMA NFHL for the flood zone at a point.
 * @param {number} lat
 * @param {number} lng
 * @param {object} [options]
 * @param {boolean} [options.throwOnFailure=false]  Throw when FEMA could not be
 *   asked (timeout, HTTP error, ArcGIS error), so the caller can tell that from
 *   null: FEMA answered, and no flood map covers the point.
 * @returns {Promise<object|null>} The zone and when FEMA gave it (`fetched_at`).
 */
async function fetchFloodZone(lat, lng, { throwOnFailure = false } = {}) {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'FLD_ZONE,ZONE_SUBTY',
    returnGeometry: 'false',
    f: 'json',
  });
  // FEMA retired the old /gis/nfhl/rest host path; /arcgis/rest is current.
  const url = `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?${params}`;

  try {
    const { response: data, fetchedAt } = await readResponse({
      provider: 'FEMA_NFHL', url, maxAgeMs: 90 * 86400000,
      isUsable: (data) => !data?.error && hasData(data?.features),
      // A failure throws (every caller sharing this request sees it) and
      // each caller decides below what it means for them.
      fetch: async () => {
        const res = await timedFetch(url);
        if (!res || !res.ok) throw new Error(res ? `HTTP ${res.status}` : 'no answer');
        const body = await res.json();
        // ArcGIS reports its own failures inside a 200.
        if (body?.error) throw new Error(`ArcGIS error ${body.error.code ?? ''}`.trim());
        return body;
      },
    });
    const features = data?.features;
    if (!features || features.length === 0) return null;

    const zone = features[0].attributes?.FLD_ZONE || null;
    return {
      flood_zone: zone,
      flood_zone_description: FLOOD_ZONE_DESC[zone] || 'Unknown flood zone',
      fetched_at: fetchedAt || null,
    };
  } catch (err) {
    logger.warn('FEMA flood zone lookup failed', { error: err.message });
    if (throwOnFailure) throw err;
    return null;
  }
}

// ── Cache layer ──────────────────────────────────────────────────────────

/**
 * Read a cached NeighborhoodProfile for the given tract.
 * @param {string} tractId
 * @returns {Promise<object|null>}
 */
async function getCachedProfile(tractId, { allowExpired = false } = {}) {
  const remembered = allowExpired ? null : memoGet(profileMemo, tractId);
  if (remembered) return remembered;
  try {
    let query = supabaseAdmin
      .from('NeighborhoodProfileCache')
      .select('profile, fetched_at, expires_at')
      .eq('tract_id', tractId);
    if (!allowExpired) query = query.gt('expires_at', new Date().toISOString());
    const { data, error } = await query.maybeSingle();

    if (error) {
      logger.warn('NeighborhoodProfileCache read error', { tractId, error: error.message });
      return null;
    }

    if (!data) return null;
    const value = { profile: data.profile, fetchedAt: data.fetched_at };
    if (!allowExpired) {
      memoSet(profileMemo, tractId, value, Math.min(Date.now() + PROFILE_MEMO_MS, Date.parse(data.expires_at)));
    }
    return value;
  } catch (err) {
    logger.error('NeighborhoodProfileCache read exception', { tractId, error: err.message });
    return null;
  }
}

/**
 * Write / upsert a cached NeighborhoodProfile.
 * @param {string} tractId
 * @param {object} profile
 */
async function setCachedProfile(tractId, profile, ttlDays = CACHE_TTL_DAYS) {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

    profileMemo.delete(tractId);
    const { error } = await supabaseAdmin
      .from('NeighborhoodProfileCache')
      .upsert(
        {
          tract_id: tractId,
          profile,
          fetched_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: 'tract_id' }
      );

    if (error) {
      logger.warn('NeighborhoodProfileCache write error', { tractId, error: error.message });
    }
  } catch (err) {
    logger.error('NeighborhoodProfileCache write exception', { tractId, error: err.message });
  }
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Get a NeighborhoodProfile for a location. Checks cache first (by tract),
 * then fetches from Census, Walk Score, and FEMA in parallel.
 *
 * @param {object} params
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {string} [params.address]  Formatted address for Walk Score
 * @returns {Promise<{ profile: object|null, source: 'cache'|'live'|'error' }>}
 */
async function getProfile({ latitude, longitude, address }) {
  // 1. Geocode to Census tract (persistently cached — effectively permanent)
  const geo = await geocodeToTractCached(latitude, longitude);
  if (!geo) {
    return { profile: null, source: 'error' };
  }

  const { tractId, stateCode, countyCode } = geo;
  const tractCode = tractId.slice(stateCode.length + countyCode.length);

  // 2. Check cache
  const cached = await getCachedProfile(tractId);
  if (cached) {
    logger.info('NeighborhoodProfile cache hit', { tractId });
    return { profile: cached.profile, source: 'cache' };
  }

  // 3. Fetch all three sources in parallel
  const [censusResult, walkScoreResult, floodResult] = await Promise.allSettled([
    fetchCensusACS(stateCode, countyCode, tractCode),
    fetchWalkScore(latitude, longitude, address || ''),
    fetchFloodZone(latitude, longitude),
  ]);

  const census = censusResult.status === 'fulfilled' ? censusResult.value : null;
  const walkScore = walkScoreResult.status === 'fulfilled' ? walkScoreResult.value : null;
  const flood = floodResult.status === 'fulfilled' ? floodResult.value : null;

  if (censusResult.status === 'rejected') {
    logger.error('Census ACS fetch rejected', { tractId, error: censusResult.reason?.message });
  }
  if (walkScoreResult.status === 'rejected') {
    logger.error('Walk Score fetch rejected', { error: walkScoreResult.reason?.message });
  }
  if (floodResult.status === 'rejected') {
    logger.error('FEMA flood fetch rejected', { error: floodResult.reason?.message });
  }

  // If all three sources failed: database first — an expired profile
  // beats nothing. Left in place so the next request retries the APIs.
  if (!census && !walkScore && !flood) {
    const expired = await getCachedProfile(tractId, { allowExpired: true });
    if (expired && expired.profile) {
      logger.info('NeighborhoodProfile serving expired cache (providers unavailable)', { tractId });
      return { profile: expired.profile, source: 'cache_stale' };
    }
    logger.warn('All neighborhood sources failed', { tractId });
    return { profile: null, source: 'error' };
  }

  // 4. Build the normalized profile
  const sources = [];
  if (census) sources.push('census');
  if (walkScore) sources.push('walkscore');
  if (flood) sources.push('fema');

  const profile = {
    tract_id: tractId,
    median_home_value: census?.median_home_value ?? null,
    median_household_income: census?.median_household_income ?? null,
    median_year_built: census?.median_year_built ?? null,
    total_population: census?.total_population ?? null,
    total_housing_units: census?.total_housing_units ?? null,
    walk_score: walkScore?.walk_score ?? null,
    walk_description: walkScore?.walk_description ?? null,
    transit_score: walkScore?.transit_score ?? null,
    bike_score: walkScore?.bike_score ?? null,
    flood_zone: flood?.flood_zone ?? null,
    flood_zone_description: flood?.flood_zone_description ?? null,
    cached_at: new Date().toISOString(),
    source: sources.join('+'),
  };

  // 5. Cache the result. A profile missing census or flood is PARTIAL
  // (Walk Score is key-gated by design and never blocks freshness) —
  // cache it briefly so the missing source retries tomorrow instead of
  // shadowing the full 90-day budget (e.g. a census outage, or the
  // CENSUS_API_KEY landing after a flood-only profile was stored).
  const isComplete = Boolean(census) && Boolean(flood);
  await setCachedProfile(tractId, profile, isComplete ? CACHE_TTL_DAYS : PARTIAL_TTL_DAYS);

  return { profile, source: 'live' };
}

module.exports = {
  getProfile,
  CACHE_TTL_DAYS,
  // Exported for testing
  geocodeToTract,
  geocodeToTractCached,
  fetchCensusACS,
  fetchWalkScore,
  fetchFloodZone,
  FLOOD_ZONE_DESC,
};
