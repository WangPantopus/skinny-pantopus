/**
 * Property Intelligence Service
 *
 * Fetches and caches rich property data (home value, characteristics,
 * neighborhood stats) from the ATTOM API for the cold-start Pulse.
 *
 * Uses two cache layers:
 * - PropertyIntelligenceCache: normalized PropertyProfile objects
 * - AttomPropertyCache: exact raw ATTOM endpoint responses per home
 *
 * Environment variables:
 *   ATTOM_API_KEY — ATTOM Data Solutions API key (optional)
 */
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');

const ATTOM_BASE = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';
const ATTOM_RAW_CACHE_TABLE = 'AttomPropertyCache';
const ATTOM_ENDPOINTS = {
  property_detail: '/property/detail',
  attomavm_detail: '/attomavm/detail',
  salestrend_snapshot: '/salestrend/snapshot',
};
const CACHE_TTL_DAYS = 30;
const FETCH_TIMEOUT_MS = 10000;

// ── ATTOM API helpers ──────────────────────────────────────────────────────

function buildAttomAddressLine1(home) {
  // Home.address is often a fully-formatted geocoder string
  // ("4080 NE Tacoma Ct, Camas, Washington 98607, United States");
  // ATTOM's address1 must be the STREET LINE ONLY or matching fails
  // with SuccessWithoutResult — take the segment before the first
  // comma (a plain street line passes through unchanged).
  const street = String(home?.address || '').split(',')[0].trim();
  const line1 = [street, home?.address2]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ')
    .trim();
  return line1 || home?.address || '';
}

/**
 * Make an authenticated ATTOM API request.
 * @param {string} endpoint  e.g. '/property/detail'
 * @param {object} params    Query parameters
 * @returns {Promise<object|null>}
 */
async function attomFetch(endpoint, params) {
  const apiKey = process.env.ATTOM_API_KEY;
  if (!apiKey) return null;

  const qs = new URLSearchParams(params);
  const url = `${ATTOM_BASE}${endpoint}?${qs}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { apikey: apiKey, Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      logger.warn('ATTOM API error', { endpoint, status: res.status, body: text.slice(0, 200) });
      return null;
    }

    const json = await res.json();

    if (process.env.ATTOM_LOG_RESPONSES === '1' && endpoint === ATTOM_ENDPOINTS.property_detail) {
      try {
        const raw = JSON.stringify(json);
        const max = 262144;
        logger.info('ATTOM /property/detail raw response', {
          requestParams: params,
          bytes: raw.length,
          body: raw.length > max ? `${raw.slice(0, max)}…[truncated ${raw.length - max} chars]` : raw,
        });
      } catch (e) {
        logger.warn('ATTOM log stringify failed', { error: e.message });
      }
    }

    return json;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      logger.warn('ATTOM fetch timeout', { endpoint });
    } else {
      logger.error('ATTOM fetch error', { endpoint, error: err.message });
    }
    return null;
  }
}

/**
 * Build ATTOM address query params from a Home record.
 */
function attomAddressParams(home) {
  return {
    address1: buildAttomAddressLine1(home),
    address2: `${home.city}, ${home.state} ${home.zipcode}`,
  };
}

function attomEndpointParams(home, key) {
  switch (key) {
    case 'property_detail':
    case 'attomavm_detail':
      return attomAddressParams(home);
    case 'salestrend_snapshot':
      return { geoid: `ZI${home.zipcode}` };
    default:
      return {};
  }
}

function buildHomeAddressSnapshot(home) {
  return {
    address: home?.address || null,
    address2: home?.address2 || null,
    city: home?.city || null,
    state: home?.state || null,
    zipcode: home?.zipcode || null,
  };
}

function normalizeRawPayload(rawPayload) {
  const base = rawPayload && typeof rawPayload === 'object' ? rawPayload : {};
  const endpoints = base.endpoints && typeof base.endpoints === 'object' ? base.endpoints : {};
  return { ...base, endpoints };
}

function getRawPayloadEntry(rawPayload, key) {
  const payload = normalizeRawPayload(rawPayload);
  const entry = payload.endpoints[key];
  return entry && typeof entry === 'object' ? entry : null;
}

function getRawPayloadResponse(rawPayload, key) {
  return getRawPayloadEntry(rawPayload, key)?.response ?? null;
}

function getRawPayloadFetchedAt(rawPayload, key) {
  return getRawPayloadEntry(rawPayload, key)?.fetched_at || null;
}

function buildRawPayload(home, existingRawPayload, endpointResponses, fetchedAtIso) {
  const payload = normalizeRawPayload(existingRawPayload);
  const endpoints = { ...payload.endpoints };

  for (const [key, response] of Object.entries(endpointResponses || {})) {
    if (response == null) continue;
    endpoints[key] = {
      endpoint: ATTOM_ENDPOINTS[key] || null,
      request_params: attomEndpointParams(home, key),
      response,
      fetched_at: fetchedAtIso,
    };
  }

  return {
    provider: 'attom',
    address_snapshot: buildHomeAddressSnapshot(home),
    endpoints,
  };
}

async function getCachedRawAttom(homeId, { allowExpired = false } = {}) {
  try {
    let query = supabaseAdmin
      .from(ATTOM_RAW_CACHE_TABLE)
      .select('raw_payload, fetched_at, expires_at')
      .eq('home_id', homeId);

    if (!allowExpired) {
      query = query.gt('expires_at', new Date().toISOString());
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      logger.warn('AttomPropertyCache read error', { homeId, error: error.message });
      return null;
    }

    return data
      ? {
          rawPayload: normalizeRawPayload(data.raw_payload),
          fetchedAt: data.fetched_at,
          expiresAt: data.expires_at,
        }
      : null;
  } catch (err) {
    logger.error('AttomPropertyCache read exception', { homeId, error: err.message });
    return null;
  }
}

async function setCachedRawAttom(homeId, home, endpointResponses, existingRawPayload = null) {
  try {
    let basePayload = existingRawPayload;
    if (!basePayload) {
      const existing = await getCachedRawAttom(homeId, { allowExpired: true });
      basePayload = existing?.rawPayload || null;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);
    const rawPayload = buildRawPayload(home, basePayload, endpointResponses, nowIso);

    if (!Object.keys(rawPayload.endpoints || {}).length) {
      return basePayload || rawPayload;
    }

    const { error } = await supabaseAdmin
      .from(ATTOM_RAW_CACHE_TABLE)
      .upsert(
        {
          home_id: homeId,
          raw_payload: rawPayload,
          fetched_at: nowIso,
          expires_at: expiresAt.toISOString(),
          updated_at: nowIso,
        },
        { onConflict: 'home_id' }
      );

    if (error) {
      logger.warn('AttomPropertyCache write error', { homeId, error: error.message });
    }

    return rawPayload;
  } catch (err) {
    logger.error('AttomPropertyCache write exception', { homeId, error: err.message });
    return existingRawPayload;
  }
}

function getStoredAttomPropertyDetail(home) {
  const payload = home?.niche_data?.attom_property_detail;
  if (!payload || typeof payload !== 'object') return null;
  if (payload.property && typeof payload.property === 'object') return payload;
  if (Array.isArray(payload.full_response?.property) && payload.full_response.property.length > 0) return payload;
  return null;
}

function buildDetailResponseFromStoredPayload(attomPayload) {
  if (!attomPayload || typeof attomPayload !== 'object') return null;
  if (attomPayload.full_response && typeof attomPayload.full_response === 'object') {
    return attomPayload.full_response;
  }
  if (attomPayload.property && typeof attomPayload.property === 'object') {
    return {
      status: attomPayload.status || null,
      property: [attomPayload.property],
    };
  }
  return null;
}

async function seedRawAttomCacheFromHomePayload(home, existingRawPayload = null) {
  const stored = getStoredAttomPropertyDetail(home);
  if (!stored) return existingRawPayload;
  if (getRawPayloadResponse(existingRawPayload, 'property_detail')) return existingRawPayload;

  const detailData = buildDetailResponseFromStoredPayload(stored);
  if (!detailData) return existingRawPayload;

  return setCachedRawAttom(home.id, home, { property_detail: detailData }, existingRawPayload);
}

async function persistAttomPropertyDetailOnHome(home, attomPayload) {
  if (!home?.id || !attomPayload) return;
  if (getStoredAttomPropertyDetail(home)) return;

  const nicheData = home.niche_data && typeof home.niche_data === 'object'
    ? { ...home.niche_data }
    : {};
  nicheData.attom_property_detail = attomPayload;

  const { error } = await supabaseAdmin
    .from('Home')
    .update({ niche_data: nicheData })
    .eq('id', home.id);

  if (error) {
    logger.warn('Home ATTOM payload persist failed', { homeId: home.id, error: error.message });
    return;
  }

  home.niche_data = nicheData;
}

/**
 * ATTOM often returns lowercase keys (beds, bathsfull) on rooms; summary may use livingsize.
 */
function pickAttomRooms(building) {
  const rooms = building?.rooms || {};
  const beds =
    rooms.beds ?? rooms.bedrooms ?? rooms.Beds ?? rooms.bedroomsCount;
  const baths =
    rooms.bathstotal
    ?? rooms.bathsTotal
    ?? rooms.bathsfull
    ?? rooms.bathsFull
    ?? rooms.bathscalc
    ?? rooms.calcBathrooms;
  return {
    bedrooms: beds != null && beds !== '' ? Number(beds) : null,
    bathrooms: baths != null && baths !== '' ? Number(baths) : null,
  };
}

/** ATTOM /property/detail: sqft lives under building.size; year/type under property.summary; lot sqft often lot.lotsize2 */
function pickAttomSummaryLot(property) {
  if (!property) {
    return { sqft: null, lot_sq_ft: null, year_built: null, raw_property_type: null };
  }
  const pSum = property.summary || {};
  const building = property.building || {};
  const bSize = building.size || {};
  const lot = property.lot || {};

  const sqft =
    bSize.livingsize
    ?? bSize.livingSize
    ?? bSize.universalsize
    ?? bSize.universalSize
    ?? bSize.grosssizeadjusted
    ?? bSize.grossSizeAdjusted
    ?? bSize.bldgsize
    ?? bSize.bldgSize;

  const lotSq =
    lot.lotsize2
    ?? lot.lotSize2
    ?? null;

  const year =
    pSum.yearbuilt
    ?? pSum.yearBuilt;

  const propType =
    pSum.propertyType
    ?? pSum.proptype
    ?? pSum.propclass;

  return {
    sqft: sqft != null && sqft !== '' ? Number(sqft) : null,
    lot_sq_ft: lotSq != null && lotSq !== '' ? Number(lotSq) : null,
    year_built: year != null && year !== '' ? Number(year) : null,
    raw_property_type: propType != null && propType !== '' ? String(propType) : null,
  };
}

function buildProfileFromAttomResponses(home, { detailData, avmData, trendData }) {
  const property = detailData?.property?.[0] || {};
  const building = property.building || {};
  const roomPick = pickAttomRooms(building);
  const sl = pickAttomSummaryLot(property);
  const assessment = property.assessment || {};

  const avm = avmData?.property?.[0]?.avm || {};
  const avmAmount = avm.amount || {};

  const trendItem = trendData?.salesTrend?.[0] || {};

  const toNumberOrNull = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  // ATTOM AVM is ideal, but some environments/accounts only return property/detail.
  // Fall back to assessor-style market/assessed totals when AVM is unavailable.
  const fallbackMarketValue =
    toNumberOrNull(assessment?.market?.mktTtlValue)
    ?? toNumberOrNull(assessment?.market?.marketTtlValue)
    ?? toNumberOrNull(assessment?.market?.mktTotalValue);
  const fallbackAssessedValue =
    toNumberOrNull(assessment?.assessed?.assdTtlValue)
    ?? toNumberOrNull(assessment?.assessed?.assessedTtlValue)
    ?? toNumberOrNull(assessment?.assessed?.assdTotalValue);

  let zipMedianSalePriceTrend = 'flat';
  if (trendItem.medianSalePrice && trendItem.prevMedianSalePrice) {
    const current = parseFloat(trendItem.medianSalePrice);
    const previous = parseFloat(trendItem.prevMedianSalePrice);
    if (current > previous * 1.02) zipMedianSalePriceTrend = 'up';
    else if (current < previous * 0.98) zipMedianSalePriceTrend = 'down';
  }

  return {
    home_id: home.id,
    address_summary: `${home.city}, ${home.state} ${home.zipcode}`,
    year_built: sl.year_built ?? home.year_built ?? null,
    sqft: sl.sqft ?? home.sq_ft ?? null,
    bedrooms: roomPick.bedrooms ?? home.bedrooms ?? null,
    bathrooms: roomPick.bathrooms ?? home.bathrooms ?? null,
    lot_sqft: sl.lot_sq_ft ?? home.lot_sq_ft ?? null,
    property_type: sl.raw_property_type ?? home.home_type ?? null,
    estimated_value: toNumberOrNull(avmAmount.value) ?? fallbackMarketValue ?? fallbackAssessedValue,
    value_range_low: toNumberOrNull(avmAmount.low),
    value_range_high: toNumberOrNull(avmAmount.high),
    value_confidence: toNumberOrNull(avm.confidence),
    zip_median_value: assessment.assessed?.assdTtlValue || null,
    zip_median_sale_price_trend: zipMedianSalePriceTrend,
    cached_at: new Date().toISOString(),
    source: 'attom',
  };
}

/**
 * Build a fallback PropertyProfile from Home table data alone.
 * Used when ATTOM API data is unavailable.
 */
function buildFallbackProfile(home) {
  return {
    home_id: home.id,
    address_summary: `${home.city}, ${home.state} ${home.zipcode}`,
    year_built: home.year_built || null,
    sqft: home.sq_ft || null,
    bedrooms: home.bedrooms || null,
    bathrooms: home.bathrooms || null,
    lot_sqft: home.lot_sq_ft || null,
    property_type: home.home_type || null,
    estimated_value: null,
    value_range_low: null,
    value_range_high: null,
    value_confidence: null,
    zip_median_value: null,
    zip_median_sale_price_trend: null,
    cached_at: new Date().toISOString(),
    source: 'fallback',
  };
}

// ── Cache layer ────────────────────────────────────────────────────────────

/**
 * Read a cached PropertyProfile for the given home.
 * Returns null on cache miss or expiry.
 */
async function getCachedProfile(homeId, { allowExpired = false } = {}) {
  try {
    let query = supabaseAdmin
      .from('PropertyIntelligenceCache')
      .select('profile, fetched_at, expires_at, source')
      .eq('home_id', homeId);
    if (!allowExpired) query = query.gt('expires_at', new Date().toISOString());
    const { data, error } = await query.maybeSingle();

    if (error) {
      logger.warn('PropertyIntelligenceCache read error', { homeId, error: error.message });
      return null;
    }

    if (!data) return null;
    return {
      profile: data.profile,
      fetchedAt: data.fetched_at,
      source: data.source,
      expired: new Date(data.expires_at).getTime() <= Date.now(),
    };
  } catch (err) {
    logger.error('PropertyIntelligenceCache read exception', { homeId, error: err.message });
    return null;
  }
}

/**
 * Write / upsert a cached PropertyProfile.
 */
async function setCachedProfile(homeId, profile, source, ttlDays = CACHE_TTL_DAYS) {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

    const { error } = await supabaseAdmin
      .from('PropertyIntelligenceCache')
      .upsert(
        {
          home_id: homeId,
          profile,
          fetched_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          source,
        },
        { onConflict: 'home_id' }
      );

    if (error) {
      logger.warn('PropertyIntelligenceCache write error', { homeId, error: error.message });
    }
  } catch (err) {
    logger.error('PropertyIntelligenceCache write exception', { homeId, error: err.message });
  }
}

async function getOrFetchAttomResponsesForHome(home, requestedKeys) {
  let rawCache = await getCachedRawAttom(home.id);
  let rawPayload = rawCache?.rawPayload || null;

  const responses = {};
  const sources = {};

  for (const key of requestedKeys) {
    const cached = getRawPayloadResponse(rawPayload, key);
    if (cached != null) {
      responses[key] = cached;
      sources[key] = 'cache';
    }
  }

  if (requestedKeys.includes('property_detail') && responses.property_detail == null) {
    const storedPayload = getStoredAttomPropertyDetail(home);
    const storedResponse = buildDetailResponseFromStoredPayload(storedPayload);
    if (storedResponse) {
      responses.property_detail = storedResponse;
      sources.property_detail = 'home';
      rawPayload = await setCachedRawAttom(home.id, home, { property_detail: storedResponse }, rawPayload);
    }
  }

  const missingKeys = requestedKeys.filter((key) => responses[key] == null);
  if (!missingKeys.length || !process.env.ATTOM_API_KEY) {
    for (const key of missingKeys) {
      sources[key] = sources[key] || 'unavailable';
      responses[key] = responses[key] ?? null;
    }
    return { responses, sources, rawPayload };
  }

  const fetchResults = await Promise.all(
    missingKeys.map(async (key) => [
      key,
      await attomFetch(ATTOM_ENDPOINTS[key], attomEndpointParams(home, key)),
    ])
  );

  const fetchedResponses = {};
  for (const [key, response] of fetchResults) {
    responses[key] = response;
    sources[key] = response != null ? 'attom' : 'unavailable';
    if (response != null) {
      fetchedResponses[key] = response;
    }
  }

  if (Object.keys(fetchedResponses).length) {
    rawPayload = await setCachedRawAttom(home.id, home, fetchedResponses, rawPayload);
  }

  return { responses, sources, rawPayload };
}

/**
 * Fetch property detail, AVM, and sales trend from ATTOM/cache and merge into
 * a normalized PropertyProfile.
 *
 * @param {object} home  Home record (id, address, city, state, zipcode, etc.)
 * @returns {Promise<object|null>} PropertyProfile
 */
async function fetchFromAttom(home) {
  const { responses } = await getOrFetchAttomResponsesForHome(home, [
    'property_detail',
    'attomavm_detail',
    'salestrend_snapshot',
  ]);

  const detailData = responses.property_detail;
  const avmData = responses.attomavm_detail;
  const trendData = responses.salestrend_snapshot;

  if (!detailData && !avmData && !trendData) {
    return null;
  }

  return buildProfileFromAttomResponses(home, { detailData, avmData, trendData });
}

function buildAttomPropertyDetailResult(detailData, fetchedAtIso = new Date().toISOString()) {
  if (!detailData?.property?.[0]) {
    return { snapshot: null, detailData: detailData || null, attomPayload: null };
  }

  const property = detailData.property[0];
  const building = property.building || {};
  const roomPick = pickAttomRooms(building);
  const sl = pickAttomSummaryLot(property);

  const snapshot = {
    bedrooms: Number.isFinite(roomPick.bedrooms) ? roomPick.bedrooms : null,
    bathrooms: Number.isFinite(roomPick.bathrooms) ? roomPick.bathrooms : null,
    sqft: Number.isFinite(sl.sqft) ? sl.sqft : null,
    lot_sqft: Number.isFinite(sl.lot_sq_ft) ? sl.lot_sq_ft : null,
    year_built: Number.isFinite(sl.year_built) ? sl.year_built : null,
    raw_property_type: sl.raw_property_type,
    source: 'attom',
  };

  return {
    snapshot,
    detailData,
    attomPayload: {
      provider: 'attom',
      endpoint: ATTOM_ENDPOINTS.property_detail,
      fetched_at: fetchedAtIso,
      status: detailData.status || null,
      property,
      full_response: detailData,
    },
  };
}

async function getHomeAttomPropertyDetail(home) {
  const storedPayload = getStoredAttomPropertyDetail(home);
  if (storedPayload) {
    await seedRawAttomCacheFromHomePayload(home);
    return {
      attomPayload: storedPayload,
      source: 'home',
      unavailableReason: null,
    };
  }

  const { responses, sources, rawPayload } = await getOrFetchAttomResponsesForHome(home, ['property_detail']);
  const detailData = responses.property_detail;

  if (detailData == null) {
    return {
      attomPayload: null,
      source: sources.property_detail || 'unavailable',
      unavailableReason: process.env.ATTOM_API_KEY ? 'ATTOM_UNAVAILABLE' : 'ATTOM_NOT_CONFIGURED',
    };
  }

  const bundle = buildAttomPropertyDetailResult(
    detailData,
    getRawPayloadFetchedAt(rawPayload, 'property_detail') || new Date().toISOString(),
  );

  if (!bundle.attomPayload) {
    return {
      attomPayload: null,
      source: sources.property_detail || 'cache',
      unavailableReason: 'NO_PROPERTY_FOUND',
    };
  }

  await persistAttomPropertyDetailOnHome(home, bundle.attomPayload);

  return {
    attomPayload: bundle.attomPayload,
    source: sources.property_detail || 'cache',
    unavailableReason: null,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Get a PropertyProfile for a home. Checks normalized cache first, then uses
 * raw ATTOM cache / stored home payload / live ATTOM as needed.
 *
 * @param {string} homeId  UUID of the Home record
 * @returns {Promise<{ profile: object, source: 'cache'|'attom'|'fallback'|'error' }>}
 */
// Fallback (home-row) profiles cache briefly so a transient ATTOM
// outage can't shadow real data for the full 30-day budget.
const FALLBACK_TTL_DAYS = 1;

async function getProfile(homeId) {
  const cached = await getCachedProfile(homeId);
  if (cached) {
    logger.info('PropertyIntelligence cache hit', { homeId });
    return { profile: cached.profile, source: 'cache' };
  }

  const { data: home, error: homeError } = await supabaseAdmin
    .from('Home')
    .select('id, address, address2, city, state, zipcode, year_built, sq_ft, bedrooms, bathrooms, lot_sq_ft, home_type, niche_data')
    .eq('id', homeId)
    .maybeSingle();

  if (homeError || !home) {
    logger.warn('PropertyIntelligence home not found', { homeId, error: homeError?.message });
    return { profile: null, source: 'error' };
  }

  let profile = await fetchFromAttom(home);
  if (!profile) {
    // ATTOM gave nothing (outage, rate limit, or no coverage). Database
    // first: an EXPIRED row holding real ATTOM data beats a thin
    // fallback — serve it stale and leave it in place so the next
    // request retries the API.
    const expired = await getCachedProfile(homeId, { allowExpired: true });
    if (expired && expired.source === 'attom' && expired.profile) {
      logger.info('PropertyIntelligence serving expired ATTOM cache (API unavailable)', { homeId });
      return { profile: expired.profile, source: 'cache_stale' };
    }
    if (!process.env.ATTOM_API_KEY) {
      logger.info('ATTOM_API_KEY not configured and no cached ATTOM payload, using fallback profile', { homeId });
    }
    profile = buildFallbackProfile(home);
    await setCachedProfile(homeId, profile, profile.source, FALLBACK_TTL_DAYS);
    return { profile, source: profile.source };
  }

  await setCachedProfile(homeId, profile, profile.source);
  return { profile, source: profile.source };
}

/**
 * Full ATTOM /property/detail result + parsed form snapshot (single HTTP call).
 * Used before a Home row exists, so this path does not cache by home_id.
 *
 * @returns {{ snapshot: object|null, detailData: object|null, attomPayload: object|null }}
 */
async function fetchAttomPropertyDetailBundle(p) {
  const home = {
    address: p.address,
    address2: p.address2 || p.unit_number || null,
    city: p.city,
    state: p.state,
    zipcode: p.zipcode,
  };
  const addrParams = attomAddressParams(home);
  const detailData = await attomFetch(ATTOM_ENDPOINTS.property_detail, addrParams);
  const bundle = buildAttomPropertyDetailResult(detailData);

  if (!bundle.attomPayload) {
    if (process.env.ATTOM_LOG_RESPONSES === '1') {
      logger.info('ATTOM property/detail: no property[0]', {
        requestParams: addrParams,
        status: detailData?.status,
        propertyLen: Array.isArray(detailData?.property) ? detailData.property.length : null,
      });
    }
    return bundle;
  }

  if (process.env.ATTOM_LOG_RESPONSES === '1') {
    logger.info('ATTOM property/detail parsed snapshot', {
      requestParams: addrParams,
      snapshot: bundle.snapshot,
      propertySummaryKeys: bundle.attomPayload.property.summary ? Object.keys(bundle.attomPayload.property.summary) : [],
      buildingKeys: bundle.attomPayload.property.building ? Object.keys(bundle.attomPayload.property.building) : [],
      roomsKeys: bundle.attomPayload.property.building?.rooms ? Object.keys(bundle.attomPayload.property.building.rooms) : [],
      sizeKeys: bundle.attomPayload.property.building?.size ? Object.keys(bundle.attomPayload.property.building.size) : [],
    });
  }

  return bundle;
}

async function fetchAttomPropertyDetailSnapshot(p) {
  const bundle = await fetchAttomPropertyDetailBundle(p);
  return bundle.snapshot;
}

module.exports = {
  getProfile,
  getHomeAttomPropertyDetail,
  CACHE_TTL_DAYS,
  fetchAttomPropertyDetailSnapshot,
  fetchAttomPropertyDetailBundle,
};
