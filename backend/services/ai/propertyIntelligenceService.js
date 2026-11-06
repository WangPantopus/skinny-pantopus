/**
 * Property Intelligence Service
 *
 * Fetches and caches rich property data (home value, characteristics,
 * neighborhood stats) from the ATTOM API for the cold-start Pulse.
 *
 * Database-first storage:
 * - ExternalFeedCache: full responses shared by endpoint + request, retained
 *   independently of freshness (property facts do not expire), and ATTOM's
 *   "no record" answers, remembered for NO_RECORD_TTL_MS
 * - PropertyIntelligenceCache: normalized PropertyProfile objects
 * - AttomPropertyCache: exact raw ATTOM endpoint responses per home
 *
 * Screens never wait for ATTOM: they answer from the database, and anything
 * missing or out of date is looked up in the background (lookupHome,
 * lookupAddress). A refresh only replaces a response with a newer one: when
 * ATTOM answers nothing or fails, the last copy stays.
 *
 * Environment variables:
 *   ATTOM_API_KEY — ATTOM Data Solutions API key (optional)
 */
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { readCappedJson, readCappedText } = require('../../utils/cappedBody');
const { houseFromAttomProperty } = require('../place/houseShape');
const placeSectionCache = require('../placeSectionCache');
const { readResponse, hasData, NO_RESULT } = require('../external/cacheHelper');
const syncChanged = require('../syncChangedService');

const ATTOM_BASE = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';
const ATTOM_RAW_CACHE_TABLE = 'AttomPropertyCache';
const ATTOM_ENDPOINTS = {
  property_detail: '/property/detail',
  attomavm_detail: '/attomavm/detail',
  salestrend_snapshot: '/salestrend/snapshot',
};
const CACHE_TTL_DAYS = 30;
const FETCH_TIMEOUT_MS = 10000;
// One property's detail, AVM or ZIP trend is tens of KB.
const MAX_BODY_BYTES = 4 * 1024 * 1024;
// ATTOM's "no record" is remembered as long as a value estimate is reused, so
// an address it doesn't know isn't asked about (and billed) on every visit.
const NO_RECORD_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
// A lookup that failed (ATTOM down or past its timeout) is tried again on a
// later visit, at most this often.
const RETRY_AFTER_FAILURE_MS = 60 * 1000;
// What a screen's lookup asks of the shared copy: keep the last response when
// ATTOM answers nothing or fails, remember "no record", and while another
// server asks the same thing, wait for its answer (a little past the timeout).
const SCREEN_LOOKUP = {
  allowStale: true,
  rememberEmptyMs: NO_RECORD_TTL_MS,
  shareFlightMs: FETCH_TIMEOUT_MS + 2000,
};
const PROFILE_KEYS = ['property_detail', 'attomavm_detail', 'salestrend_snapshot'];

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

// Validate the record array, not the non-empty status envelope.
function hasAttomData(endpoint, response) {
  const records = endpoint === ATTOM_ENDPOINTS.salestrend_snapshot ? response?.salesTrend : response?.property;
  return Array.isArray(records) && records.some((record) => record && typeof record === 'object'
    && hasData(endpoint === ATTOM_ENDPOINTS.attomavm_detail ? record.avm : record));
}

function attomCacheRequest(endpoint, params) {
  // Match case/whitespace variants without collapsing apartments or addresses.
  const canonical = Object.fromEntries(Object.entries(params).map(([key, value]) =>
    [key, String(value).trim().replace(/\s+/g, ' ').toUpperCase()]));
  return {
    provider: 'ATTOM',
    url: `${ATTOM_BASE}${endpoint}?${new URLSearchParams(canonical)}`,
    maxAgeMs: endpoint === ATTOM_ENDPOINTS.property_detail ? Infinity : CACHE_TTL_DAYS * 86400000,
    isUsable: (response) => hasAttomData(endpoint, response),
  };
}

// The operator prefill uses exactly the same identity and data validation as
// interactive requests, without creating Home or ownership records.
function propertyDetailCacheRequest(p) {
  const params = attomAddressParams({
    address: p.line1, address2: p.line2, city: p.city, state: p.state, zipcode: p.zip,
  });
  return {
    ...attomCacheRequest(ATTOM_ENDPOINTS.property_detail, params),
    requestUrl: `${ATTOM_BASE}${ATTOM_ENDPOINTS.property_detail}?${new URLSearchParams(params)}`,
  };
}

async function attomRequest(endpoint, params, options = {}) {
  let noResult = false;
  const result = await readResponse({
    ...attomCacheRequest(endpoint, params),
    ...options,
    isUsable: (response) => hasAttomData(endpoint, response),
    fetch: async () => {
      const result = await fetchAttomRequest(endpoint, params, options);
      noResult = result.noResult;
      // "No record" is an answer, not a failure: callers may remember it.
      return result.noResult ? NO_RESULT : result.json;
    },
  });
  // `stale`: an older copy kept because ATTOM answered nothing newer;
  // `missing`: a database-only read found nothing.
  return { json: result.response, noResult: noResult || Boolean(result.empty), fetchedAt: result.fetchedAt,
    hit: result.hit, stale: Boolean(result.stale), missing: Boolean(result.missing), emptyAt: result.emptyAt || null };
}

async function fetchAttomRequest(endpoint, params, { timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const apiKey = process.env.ATTOM_API_KEY;
  if (!apiKey) return { json: null, noResult: false };

  const qs = new URLSearchParams(params);
  const url = `${ATTOM_BASE}${endpoint}?${qs}`;

  // The timeout covers the whole body, not just the headers.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'error',
      headers: { apikey: apiKey, Accept: 'application/json' },
    });

    if (!res.ok) {
      const text = await readCappedText(res, MAX_BODY_BYTES, controller.signal);
      let noResult = false;
      // ATTOM says why in its own status message ("SuccessWithoutResult", a
      // parameter or entitlement error); logged so a failing endpoint can be told apart.
      let attomMsg = null;
      try {
        attomMsg = JSON.parse(text)?.status?.msg ?? null;
        noResult = res.status === 400 && attomMsg === 'SuccessWithoutResult';
      } catch (_) {
        // Not JSON: a real error.
      }
      if (noResult) {
        logger.info('ATTOM has no record', { endpoint });
      } else {
        logger.warn('ATTOM API error', { endpoint, status: res.status, attom_msg: attomMsg ? String(attomMsg).slice(0, 120) : null });
      }
      return { json: null, noResult };
    }

    const json = await readCappedJson(res, MAX_BODY_BYTES, controller.signal);

    if (process.env.ATTOM_LOG_RESPONSES === '1' && endpoint === ATTOM_ENDPOINTS.property_detail) {
      try {
        logger.info('ATTOM /property/detail response shape', {
          keys: Object.keys(json || {}),
          propertyCount: json?.property?.length || 0,
        });
      } catch (e) {
        logger.warn('ATTOM log stringify failed', { error: e.message });
      }
    }

    return { json, noResult: false };
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn('ATTOM fetch timeout', { endpoint });
    } else {
      logger.error('ATTOM fetch error', { endpoint, error: err.message });
    }
    return { json: null, noResult: false };
  } finally {
    clearTimeout(timeout);
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

function hasUsableEndpoint(rawPayload, key) {
  const entry = getRawPayloadEntry(rawPayload, key);
  if (!hasAttomData(ATTOM_ENDPOINTS[key], entry?.response)) return false;
  if (key === 'property_detail') return true;
  const age = Date.now() - Date.parse(entry.fetched_at);
  return age >= 0 && age < CACHE_TTL_DAYS * 86400000;
}

// Answered for now: a fresh response, or ATTOM's recent "no record" (an older
// response, if any, is kept beside it and still shown).
function hasSettledEndpoint(rawPayload, key) {
  if (hasUsableEndpoint(rawPayload, key)) return true;
  const age = Date.now() - Date.parse(getRawPayloadEntry(rawPayload, key)?.empty_at);
  return age >= 0 && age < NO_RECORD_TTL_MS;
}

function buildRawPayload(home, existingRawPayload, endpointResponses, fetchedAtIso, fetchedAts = {}, emptyAts = {}) {
  const payload = normalizeRawPayload(existingRawPayload);
  const endpoints = { ...payload.endpoints };

  for (const [key, response] of Object.entries(endpointResponses || {})) {
    if (response == null) continue;
    endpoints[key] = {
      endpoint: ATTOM_ENDPOINTS[key] || null,
      request_params: attomEndpointParams(home, key),
      response,
      fetched_at: fetchedAts[key] || fetchedAtIso,
    };
  }
  // "No record" this time never erases the last response for the same request:
  // it stays, with when ATTOM said so.
  for (const [key, emptyAt] of Object.entries(emptyAts || {})) {
    const params = attomEndpointParams(home, key);
    const previous = endpoints[key] && JSON.stringify(endpoints[key].request_params) === JSON.stringify(params) ? endpoints[key] : null;
    endpoints[key] = {
      ...(previous || { endpoint: ATTOM_ENDPOINTS[key] || null, request_params: params, response: null, fetched_at: null }),
      empty_at: emptyAt || fetchedAtIso,
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

async function setCachedRawAttom(homeId, home, endpointResponses, existingRawPayload = null, fetchedAts = {}, emptyAts = {}) {
  try {
    let basePayload = existingRawPayload;
    if (!basePayload) {
      const existing = await getCachedRawAttom(homeId, { allowExpired: true });
      basePayload = existing?.rawPayload || null;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);
    const rawPayload = buildRawPayload(home, basePayload, endpointResponses, nowIso, fetchedAts, emptyAts);

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

function validAttomPropertyDetail(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.property && typeof payload.property === 'object' && !Array.isArray(payload.property) && hasData(payload.property)) return payload;
  if (hasAttomData(ATTOM_ENDPOINTS.property_detail, payload.full_response)) return payload;
  return null;
}

function getStoredAttomPropertyDetail(home) {
  return validAttomPropertyDetail(home?.niche_data?.attom_property_detail);
}

function buildDetailResponseFromStoredPayload(attomPayload) {
  if (!attomPayload || typeof attomPayload !== 'object') return null;
  if (hasAttomData(ATTOM_ENDPOINTS.property_detail, attomPayload.full_response)) {
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

// True when the record was written: the Home row's change is what tells its
// household's open screens to read again (services/syncChangedService.js).
async function persistAttomPropertyDetailOnHome(home, attomPayload) {
  if (!home?.id || !attomPayload) return false;
  // A row read without niche_data can't show what's stored there, so it never
  // writes: that would replace the stored record and anything kept beside it.
  if (home.niche_data === undefined) return false;
  if (getStoredAttomPropertyDetail(home)) return false;

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
    return false;
  }

  home.niche_data = nicheData;
  return true;
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

function buildProfileFromAttomResponses(home, { detailData, avmData, trendData }, fetchedAts = {}) {
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

  // Facts the county record lacked that the household's own entries fill
  // in; the section's source label says so (placeIntelligenceService).
  const householdFields = [
    ['year_built', sl.year_built, home.year_built],
    ['sqft', sl.sqft, home.sq_ft],
    ['bedrooms', roomPick.bedrooms, home.bedrooms],
    ['bathrooms', roomPick.bathrooms, home.bathrooms],
    ['lot_sqft', sl.lot_sq_ft, home.lot_sq_ft],
    ['property_type', sl.raw_property_type, home.home_type],
  ].filter(([, county, own]) => county == null && own != null).map(([field]) => field);

  return {
    home_id: home.id,
    address_summary: `${home.city}, ${home.state} ${home.zipcode}`,
    // False when ATTOM answered only with a value model or the ZIP trend.
    county_record: Boolean(detailData?.property?.[0]),
    household_fields: householdFields,
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
    // When ATTOM gave the value estimate: a refresh that finds nothing keeps
    // the last one, which then shows with this date.
    value_as_of: avmAmount.value != null ? fetchedAts.attomavm_detail || null : null,
    zip_median_value: assessment.assessed?.assdTtlValue || null,
    zip_median_sale_price_trend: zipMedianSalePriceTrend,
    // The home's outline for the Today sky (services/place/houseShape.js).
    house: detailData?.property?.[0] ? houseFromAttomProperty(detailData.property[0]) : null,
    cached_at: new Date().toISOString(),
    source: 'attom',
  };
}

/**
 * What anyone but the confirmed owner reads of a profile: the Home's facts. The value is the owner's, as on Place.
 * A list of what may go out, so a new value field never reaches them by default.
 */
function factsOnly(profile) {
  const facts = ['home_id', 'address_summary', 'county_record', 'household_fields', 'year_built', 'sqft', 'bedrooms',
    'bathrooms', 'lot_sqft', 'property_type', 'house', 'cached_at', 'source', 'provenance'];
  return Object.fromEntries(facts.filter((field) => field in profile).map((field) => [field, profile[field]]));
}

/**
 * Build a fallback PropertyProfile from Home table data alone.
 * Used when ATTOM API data is unavailable.
 */
function buildFallbackProfile(home) {
  return {
    home_id: home.id,
    address_summary: `${home.city}, ${home.state} ${home.zipcode}`,
    county_record: false,
    household_fields: [
      ['year_built', 'year_built'], ['sqft', 'sq_ft'], ['bedrooms', 'bedrooms'],
      ['bathrooms', 'bathrooms'], ['lot_sqft', 'lot_sq_ft'], ['property_type', 'home_type'],
    ].filter(([, column]) => home[column]).map(([field]) => field),
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
    house: null,
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

/**
 * A Home's ATTOM responses, database first: the per-home copy, the record the
 * Home stores, Add Home's copy for its address, then the shared copy of each
 * request. Every response is the last one at any age (a refresh that finds
 * nothing never erases it); `pendingKeys` are those still missing or out of
 * date. With `fetch` (a background lookup) ATTOM is asked for those and the
 * answers saved; without it the database alone answers.
 */
async function getOrFetchAttomResponsesForHome(home, requestedKeys, { fetch = true } = {}) {
  let rawCache = await getCachedRawAttom(home.id, { allowExpired: true });
  let rawPayload = rawCache?.rawPayload || null;

  const responses = {};
  const sources = {};
  const fetchedAts = {};
  const settled = new Set();

  for (const key of requestedKeys) {
    const entry = getRawPayloadEntry(rawPayload, key);
    const sameRequest = entry?.request_params
      ? JSON.stringify(entry.request_params) === JSON.stringify(attomEndpointParams(home, key))
      : JSON.stringify(rawPayload?.address_snapshot) === JSON.stringify(buildHomeAddressSnapshot(home));
    if (!sameRequest) continue;
    if (hasAttomData(ATTOM_ENDPOINTS[key], entry?.response)) {
      responses[key] = entry.response;
      sources[key] = 'cache';
      fetchedAts[key] = entry.fetched_at;
    }
    if (hasSettledEndpoint(rawPayload, key)) settled.add(key);
  }

  if (requestedKeys.includes('property_detail') && responses.property_detail == null) {
    // A Home made before Add Home's lookup landed: that copy is the same record.
    const storedPayload = getStoredAttomPropertyDetail(home) || await getAddressAttomPropertyDetail(home.address_id);
    const storedResponse = buildDetailResponseFromStoredPayload(storedPayload);
    if (storedResponse) {
      responses.property_detail = storedResponse;
      sources.property_detail = 'home';
      fetchedAts.property_detail = storedPayload.fetched_at;
      settled.add('property_detail');
      rawPayload = await setCachedRawAttom(home.id, home, { property_detail: storedResponse }, rawPayload, { property_detail: storedPayload.fetched_at });
    }
  }

  const missingKeys = requestedKeys.filter((key) => !settled.has(key));
  if (missingKeys.length) {
    const results = await Promise.all(missingKeys.map(async (key) => [
      key,
      await attomRequest(ATTOM_ENDPOINTS[key], attomEndpointParams(home, key), fetch ? SCREEN_LOOKUP : { ...SCREEN_LOOKUP, cacheOnly: true }),
    ]));
    const fetchedResponses = {};
    const emptyAts = {};
    for (const [key, result] of results) {
      if (result.json != null && !result.stale) {
        responses[key] = result.json;
        sources[key] = 'attom';
        fetchedAts[key] = result.fetchedAt;
        fetchedResponses[key] = result.json;
        settled.add(key);
        continue;
      }
      // An older shared copy still answers.
      if (result.json != null && responses[key] == null) {
        responses[key] = result.json;
        sources[key] = 'cache';
        fetchedAts[key] = result.fetchedAt;
      }
      if (result.noResult) {
        settled.add(key);
        emptyAts[key] = result.emptyAt;
      } else if (responses[key] == null) {
        sources[key] = 'unavailable';
      }
    }
    if (Object.keys(fetchedResponses).length || Object.keys(emptyAts).length) {
      rawPayload = await setCachedRawAttom(home.id, home, fetchedResponses, rawPayload, fetchedAts, emptyAts);
    }
  }

  return {
    responses,
    sources,
    rawPayload,
    fetchedAts,
    noResultKeys: requestedKeys.filter((key) => settled.has(key) && responses[key] == null),
    pendingKeys: requestedKeys.filter((key) => !settled.has(key)),
  };
}

/**
 * Merge property detail, AVM and sales trend into a normalized PropertyProfile
 * (null when ATTOM has none of them).
 */
function profileFromResponses(home, { responses, fetchedAts }) {
  const detailData = responses.property_detail;
  const avmData = responses.attomavm_detail;
  const trendData = responses.salestrend_snapshot;
  if (!detailData && !avmData && !trendData) return null;
  return buildProfileFromAttomResponses(home, { detailData, avmData, trendData }, fetchedAts);
}

// ── Background lookups ─────────────────────────────────────────────────────
//
// One lookup per Home (and set of endpoints) or per Add Home address at a time
// in this process; servers share theirs through the cache (SCREEN_LOOKUP). A
// Home's lookup saves ATTOM's answers to the same caches and writes the record
// on the Home last: that row's change tells the household's open Place and
// Property details to read again. A lookup that writes nothing to the Home
// sends the same signal itself, also when it fails.
const HOME_LOOKUP_SELECT = 'id, address, address2, city, state, zipcode, address_id, year_built, sq_ft, bedrooms, bathrooms, lot_sq_ft, home_type, niche_data';
const runningLookups = new Map();
const failedLookups = new Map();

function lookupState(id) {
  if (runningLookups.has(id)) return 'pending';
  return Date.now() - (failedLookups.get(id) || 0) < RETRY_AFTER_FAILURE_MS ? 'failed' : null;
}

// Runs `work` (resolving true when everything was answered) in the background
// unless it is running or failed a moment ago. Returns 'pending' or 'failed'.
function startLookup(id, work, onDone) {
  const state = lookupState(id);
  if (state) return state;
  const run = (async () => {
    let outcome = null;
    try {
      outcome = await work();
      if (outcome?.complete) failedLookups.delete(id);
      else failedLookups.set(id, Date.now());
    } catch (err) {
      failedLookups.set(id, Date.now());
      logger.warn('ATTOM background lookup failed', { lookup: id.split(':')[0], error: err.message });
    } finally {
      runningLookups.delete(id);
    }
    if (onDone) await onDone(outcome);
  })();
  runningLookups.set(id, run);
  return 'pending';
}

/**
 * Looks a Home's missing or out-of-date ATTOM responses up in the background.
 * @returns {'pending'|'failed'|null} null when ATTOM isn't configured
 */
function lookupHome(home, keys) {
  if (!process.env.ATTOM_API_KEY || !home?.id) return null;
  return startLookup(`home:${home.id}:${keys.join(',')}`, async () => {
    // The row as it is now: the lookup ends seconds after the screen read it.
    const { data: current, error } = await supabaseAdmin.from('Home').select(HOME_LOOKUP_SELECT).eq('id', home.id).maybeSingle();
    if (error) throw error;
    if (!current) return { complete: true, wroteHome: false };
    const found = await getOrFetchAttomResponsesForHome(current, keys);
    const profile = keys.length > 1 ? profileFromResponses(current, found) : null;
    if (profile) await setCachedProfile(current.id, profile, profile.source);
    let wroteHome = false;
    if (found.responses.property_detail && !getStoredAttomPropertyDetail(current)) {
      const bundle = buildAttomPropertyDetailResult(found.responses.property_detail, found.fetchedAts.property_detail || new Date().toISOString());
      wroteHome = await persistAttomPropertyDetailOnHome(current, bundle.attomPayload);
    }
    return { complete: found.pendingKeys.length === 0, wroteHome };
  }, (outcome) => (outcome?.wroteHome ? null : syncChanged.publishHomeChange(home.id)));
}

// Waits for a running lookup, at most `ms`.
async function settleLookup(id, ms) {
  const run = runningLookups.get(id);
  if (!run) return;
  let timer = null;
  await Promise.race([run, new Promise((resolve) => { timer = setTimeout(resolve, ms); })]);
  clearTimeout(timer);
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

/**
 * The Home's county record (ATTOM /property/detail), from the database. A
 * Home without one gets it looked up in the background ('LOOKUP_PENDING'):
 * the record is stored on the Home when it lands, and that change tells the
 * screens showing it to read again. `wait` asks ATTOM before answering.
 */
async function getHomeAttomPropertyDetail(home, { wait = false } = {}) {
  const storedPayload = getStoredAttomPropertyDetail(home);
  // The Home's own record answers without writing the raw cache: a copy on
  // every read pushed that row's expiry out each time, so its value estimate
  // never refreshed. The value lookup copies the record there when it's missing.
  if (storedPayload) {
    return {
      attomPayload: storedPayload,
      source: 'home',
      unavailableReason: null,
    };
  }

  const { responses, sources, rawPayload, noResultKeys, pendingKeys } = await getOrFetchAttomResponsesForHome(home, ['property_detail'], { fetch: wait });
  const detailData = responses.property_detail;

  if (detailData == null) {
    let unavailableReason = process.env.ATTOM_API_KEY ? 'ATTOM_UNAVAILABLE' : 'ATTOM_NOT_CONFIGURED';
    if (noResultKeys.includes('property_detail')) unavailableReason = 'NO_PROPERTY_FOUND';
    else if (!wait && pendingKeys.length && lookupHome(home, ['property_detail']) === 'pending') unavailableReason = 'LOOKUP_PENDING';
    return {
      attomPayload: null,
      source: sources.property_detail || 'unavailable',
      unavailableReason,
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

/**
 * ATTOM's value estimate for a home as last cached (Place asks for it), or
 * null. Never asks ATTOM itself: Property details shows only what's on file.
 */
async function getCachedAttomValue(homeId) {
  const cached = await getCachedRawAttom(homeId, { allowExpired: true });
  const avm = getRawPayloadResponse(cached?.rawPayload, 'attomavm_detail')?.property?.[0]?.avm;
  return avm && typeof avm === 'object' && !Array.isArray(avm) ? avm : null;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Get a PropertyProfile for a home from the database: the normalized cache,
 * else built from the raw ATTOM cache / stored home payload. Whatever is
 * missing or out of date is looked up in the background (`lookup`: 'pending',
 * or 'failed' for a lookup that failed a moment ago); `wait` asks ATTOM first.
 *
 * @param {string} homeId  UUID of the Home record
 * @returns {Promise<{ profile: object, source: 'cache'|'attom'|'fallback'|'cache_stale'|'error', lookup: string|null }>}
 */
// Fallback (home-row) profiles cache briefly so a transient ATTOM
// outage can't shadow real data for the full 30-day budget.
const FALLBACK_TTL_DAYS = 1;

/**
 * Profiles cached before the house outline existed have no `house` key. Read
 * it once from the stored ATTOM record (the raw cache, then the copy on the
 * Home; never a live, billed call) and keep it on the cached row without
 * touching its expiry.
 */
async function withHouseShape(homeId, profile) {
  if (!profile || profile.house !== undefined || profile.source !== 'attom') return profile;
  try {
    const raw = await getCachedRawAttom(homeId, { allowExpired: true });
    let detail = getRawPayloadResponse(raw?.rawPayload, 'property_detail');
    if (!detail) {
      const { data: home, error: homeError } = await supabaseAdmin
        .from('Home').select('id, niche_data').eq('id', homeId).maybeSingle();
      if (homeError) throw homeError;
      detail = buildDetailResponseFromStoredPayload(getStoredAttomPropertyDetail(home));
    }
    const upgraded = { ...profile, house: detail?.property?.[0] ? houseFromAttomProperty(detail.property[0]) : null };
    const { error } = await supabaseAdmin
      .from('PropertyIntelligenceCache')
      .update({ profile: upgraded })
      .eq('home_id', homeId);
    if (error) logger.warn('PropertyIntelligenceCache house write error', { homeId, error: error.message });
    return upgraded;
  } catch (err) {
    logger.warn('PropertyIntelligence house shape read failed', { homeId, error: err.message });
    return profile;
  }
}

async function getProfile(homeId, { wait = false } = {}) {
  const cached = await getCachedProfile(homeId);
  // An aggregate containing building facts can still be missing its AVM or
  // ZIP trend. It must not hide an empty endpoint for another 30 days, or
  // renew the freshness of an older provider response on every rebuild.
  // ATTOM's recent "no record" counts as answered.
  const raw = cached?.source === 'attom' ? await getCachedRawAttom(homeId, { allowExpired: true }) : null;
  const complete = PROFILE_KEYS.every((key) => hasSettledEndpoint(raw?.rawPayload, key));
  if (cached && cached.source === 'attom' && cached.profile?.county_record !== false && complete) {
    logger.info('PropertyIntelligence cache hit', { homeId });
    return { profile: await withHouseShape(homeId, cached.profile), source: 'cache', lookup: null };
  }

  const { data: home, error: homeError } = await supabaseAdmin
    .from('Home')
    .select(HOME_LOOKUP_SELECT)
    .eq('id', homeId)
    .maybeSingle();

  if (homeError || !home) {
    logger.warn('PropertyIntelligence home not found', { homeId, error: homeError?.message });
    return { profile: null, source: 'error', lookup: null };
  }

  const found = await getOrFetchAttomResponsesForHome(home, PROFILE_KEYS, { fetch: wait });
  const lookup = !wait && found.pendingKeys.length ? lookupHome(home, PROFILE_KEYS) : null;
  let profile = profileFromResponses(home, found);
  if (!profile) {
    // ATTOM gave nothing yet (a lookup running, an outage, or no coverage).
    // Database first: an EXPIRED row holding real ATTOM data beats a thin
    // fallback — serve it stale and leave it in place.
    const expired = await getCachedProfile(homeId, { allowExpired: true });
    if (expired && expired.source === 'attom' && expired.profile) {
      logger.info('PropertyIntelligence serving expired ATTOM cache (API unavailable)', { homeId });
      return { profile: await withHouseShape(homeId, expired.profile), source: 'cache_stale', lookup };
    }
    if (!process.env.ATTOM_API_KEY) {
      logger.info('ATTOM_API_KEY not configured and no cached ATTOM payload, using fallback profile', { homeId });
    }
    profile = buildFallbackProfile(home);
    // While a lookup runs, its answer replaces this; nothing to keep.
    if (lookup !== 'pending') await setCachedProfile(homeId, profile, profile.source, FALLBACK_TTL_DAYS);
    return { profile, source: profile.source, lookup };
  }

  // The background lookup saves the profile it completes.
  if (!found.pendingKeys.length) await setCachedProfile(homeId, profile, profile.source);
  return { profile, source: profile.source, lookup };
}

/**
 * Full ATTOM /property/detail result + parsed form snapshot (single HTTP call).
 * Works before a Home row exists; the full response is stored by request.
 *
 * @returns {{ snapshot: object|null, detailData: object|null, attomPayload: object|null }}
 */
async function fetchAttomPropertyDetailBundle(p, options = {}) {
  const home = {
    address: p.address,
    address2: p.address2 || p.unit_number || null,
    city: p.city,
    state: p.state,
    zipcode: p.zipcode,
  };
  const addrParams = attomAddressParams(home);
  const { json: detailData, fetchedAt, noResult } = await attomRequest(ATTOM_ENDPOINTS.property_detail, addrParams, options);
  const bundle = buildAttomPropertyDetailResult(detailData, fetchedAt);

  if (!bundle.attomPayload) {
    if (process.env.ATTOM_LOG_RESPONSES === '1') {
      logger.info('ATTOM property/detail: no property[0]', {
        propertyLen: Array.isArray(detailData?.property) ? detailData.property.length : null,
      });
    }
    // ATTOM answered "no record" (rather than failing).
    return { ...bundle, noResult };
  }

  if (process.env.ATTOM_LOG_RESPONSES === '1') {
    logger.info('ATTOM property/detail parsed snapshot', {
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

// Add Home looks an address up before its Home exists. The server keeps that
// answer under the validated address (its HomeAddress id), so the new Home
// stores the server's own copy, never one an app sends back, and a second
// lookup of the same address reuses the stored property facts.
const ADDRESS_DETAIL_SECTION = 'attom_property_detail';

function addressDetailCacheKey(addressId) {
  return `address:${addressId}`;
}

function addressRequest(address) {
  return {
    address: address.address_line1_norm,
    address2: address.address_line2_norm,
    city: address.city_norm,
    state: address.state,
    zipcode: address.postal_code,
  };
}

const NO_ADDRESS_RECORD = Object.freeze({ snapshot: null, detailData: null, attomPayload: null });
// How long Add Home's follow-up ('check') waits for a running lookup: just
// past ATTOM's own timeout.
const ADDRESS_CHECK_WAIT_MS = FETCH_TIMEOUT_MS + 1000;

// The lookup itself: the server's copy while it's present, else one
// /property/detail call by the address as validated, kept under the address.
async function readThroughAddress(address) {
  let noResult = false;
  const { payload } = await placeSectionCache.readThrough({
    cacheKey: addressDetailCacheKey(address.id),
    sectionId: ADDRESS_DETAIL_SECTION,
    reuseStored: true,
    isUsable: (payload) => Boolean(validAttomPropertyDetail(payload)),
    ttlMs: CACHE_TTL_DAYS * 24 * 60 * 60 * 1000,
    fetch: async () => {
      const bundle = await fetchAttomPropertyDetailBundle(addressRequest(address), SCREEN_LOOKUP);
      noResult = Boolean(bundle.noResult);
      return bundle.attomPayload;
    },
  });
  const stored = validAttomPropertyDetail(payload);
  return { ...buildAttomPropertyDetailResult(buildDetailResponseFromStoredPayload(stored), stored?.fetched_at), noResult };
}

// What the database knows about the address without asking ATTOM: Add Home's
// copy, the shared copy of the same request (kept under the address too), or
// ATTOM's remembered "no record".
async function storedForAddress(address) {
  let stored = await getAddressAttomPropertyDetail(address.id);
  if (!stored) {
    const shared = await attomRequest(ATTOM_ENDPOINTS.property_detail, attomAddressParams(addressRequest(address)),
      { ...SCREEN_LOOKUP, cacheOnly: true });
    if (shared.json) {
      stored = buildAttomPropertyDetailResult(shared.json, shared.fetchedAt).attomPayload;
      if (stored) {
        await placeSectionCache.writeRow(addressDetailCacheKey(address.id), ADDRESS_DETAIL_SECTION, stored,
          CACHE_TTL_DAYS * 24 * 60 * 60 * 1000, stored.fetched_at || new Date().toISOString(), true);
      }
    } else if (shared.noResult) {
      return { stored: null, none: true };
    }
  }
  return { stored, none: false };
}

// A Home created at this address before its lookup landed gets the record now;
// that row's change tells its household's open screens.
async function storeOnHomesAtAddress(addressId, attomPayload) {
  const { data: homes, error } = await supabaseAdmin.from('Home').select('id, niche_data').eq('address_id', addressId);
  if (error) {
    logger.warn('Homes at a looked-up address unreadable', { error: error.message });
    return;
  }
  for (const home of homes || []) await persistAttomPropertyDetailOnHome(home, attomPayload);
}

function lookupAddress(address) {
  if (!process.env.ATTOM_API_KEY) return null;
  return startLookup(`address:${address.id}`, async () => {
    const bundle = await readThroughAddress(address);
    if (bundle.attomPayload) await storeOnHomesAtAddress(address.id, bundle.attomPayload);
    return { complete: Boolean(bundle.attomPayload || bundle.noResult) };
  });
}

/**
 * Add Home's lookup for a validated address, by the address as validated
 * (never as typed). `lookup`:
 *   'wait'        ask ATTOM before answering (app builds before November 2026)
 *   'background'  answer from the database at once; a missing record is looked
 *                 up in the background
 *   'check'       Add Home's follow-up: waits for this server's running lookup
 *                 (never starts one), then answers from the database
 * The answer's `lookup` is 'found', 'none' (ATTOM has no record), 'pending' or
 * 'unavailable' (the lookup failed, or ATTOM isn't configured).
 *
 * @param {object} address HomeAddress row (id, address_line1_norm, address_line2_norm, city_norm, state, postal_code)
 * @returns {{ snapshot: object|null, detailData: object|null, attomPayload: object|null, lookup: string }}
 */
async function fetchAttomPropertyDetailBundleForAddress(address, { lookup = 'wait' } = {}) {
  if (lookup === 'wait') {
    const bundle = await readThroughAddress(address);
    return { ...bundle, lookup: bundle.attomPayload ? 'found' : bundle.noResult ? 'none' : 'unavailable' };
  }
  const id = `address:${address.id}`;
  let known = await storedForAddress(address);
  if (!known.stored && !known.none) {
    if (lookup === 'check') {
      await settleLookup(id, ADDRESS_CHECK_WAIT_MS);
      known = await storedForAddress(address);
    } else {
      lookupAddress(address);
    }
  }
  if (known.stored) {
    return { ...buildAttomPropertyDetailResult(buildDetailResponseFromStoredPayload(known.stored), known.stored.fetched_at), lookup: 'found' };
  }
  if (known.none) return { ...NO_ADDRESS_RECORD, lookup: 'none' };
  return { ...NO_ADDRESS_RECORD, lookup: lookupState(id) === 'pending' ? 'pending' : 'unavailable' };
}

/**
 * The server's own Add Home lookup for a validated address, at any age, or
 * null. Never asks ATTOM.
 */
async function getAddressAttomPropertyDetail(addressId) {
  if (!addressId) return null;
  try {
    const row = await placeSectionCache.readRow(addressDetailCacheKey(addressId), ADDRESS_DETAIL_SECTION);
    return validAttomPropertyDetail(row?.payload);
  } catch (err) {
    logger.warn('Address ATTOM copy read failed', { error: err.message });
    return null;
  }
}

module.exports = {
  getProfile,
  factsOnly,
  getHomeAttomPropertyDetail,
  getCachedAttomValue,
  CACHE_TTL_DAYS,
  fetchAttomPropertyDetailSnapshot,
  fetchAttomPropertyDetailBundle,
  fetchAttomPropertyDetailBundleForAddress,
  getAddressAttomPropertyDetail,
  propertyDetailCacheRequest,
};
