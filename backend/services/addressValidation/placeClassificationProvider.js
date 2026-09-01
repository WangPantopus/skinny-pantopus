const logger = require('../../utils/logger');
const addressConfig = require('../../config/addressVerification');

const DETAILS_API_BASE = 'https://places.googleapis.com/v1/places';
const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const NEARBY_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'businessStatus',
  'primaryType',
  'types',
].join(',');
const SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.businessStatus',
  'places.primaryType',
  'places.types',
].join(',');
const DEFAULT_LANGUAGE_CODE = 'en';
const DEFAULT_REGION_CODE = 'US';
const DEFAULT_TEXT_BIAS_RADIUS_METERS = 100;
const DEFAULT_NEARBY_RADIUS_METERS = 100;
const DEFAULT_SEARCH_RESULT_COUNT = 5;
const GENERIC_ADDRESS_PLACE_TYPES = new Set([
  'premise',
  'street_address',
  'subpremise',
  'route',
]);
const INSTITUTIONAL_PLACE_TYPES = new Set([
  'school',
  'university',
  'stadium',
  'government_office',
  'event_venue',
  'library',
  'museum',
  'airport',
  'church',
  'hospital',
]);

function normalizeTypes(types) {
  if (!Array.isArray(types)) return [];
  return [...new Set(types.map((type) => String(type).trim()).filter(Boolean))];
}

const ADDRESS_TOKEN_NORMALIZATIONS = new Map([
  ['n', 'north'],
  ['s', 'south'],
  ['e', 'east'],
  ['w', 'west'],
  ['ne', 'northeast'],
  ['nw', 'northwest'],
  ['se', 'southeast'],
  ['sw', 'southwest'],
  ['st', 'street'],
  ['ave', 'avenue'],
  ['blvd', 'boulevard'],
  ['dr', 'drive'],
  ['rd', 'road'],
  ['ln', 'lane'],
  ['ct', 'court'],
  ['cir', 'circle'],
  ['trl', 'trail'],
  ['ter', 'terrace'],
  ['pkwy', 'parkway'],
  ['pl', 'place'],
  ['sq', 'square'],
  ['hwy', 'highway'],
  ['apt', 'apartment'],
  ['ste', 'suite'],
  ['fl', 'floor'],
  ['rm', 'room'],
]);

function normalizeAddressText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((token) => ADDRESS_TOKEN_NORMALIZATIONS.get(token) || token)
    .join(' ');
}

function looksLikeNamedPoi(displayName, normalizedAddress) {
  const display = normalizeAddressText(displayName);
  if (!display) return false;

  const candidates = [
    normalizedAddress?.line1,
    normalizedAddress?.line2,
  ]
    .map((value) => normalizeAddressText(value))
    .filter(Boolean);

  if (candidates.length === 0) return true;
  return !candidates.includes(display);
}

function normalizePlaceId(placeId) {
  const value = String(placeId || '').trim();
  if (!value) return null;
  return value.replace(/^places\//, '') || null;
}

function hasCoordinates(lat, lng) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

function buildTextQuery(normalizedAddress = {}) {
  const street = [normalizedAddress.line1, normalizedAddress.line2]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ');
  const locality = [
    String(normalizedAddress.city || '').trim(),
    [normalizedAddress.state, normalizedAddress.zip].map((value) => String(value || '').trim()).filter(Boolean).join(' '),
  ].filter(Boolean).join(', ');

  return [street, locality].filter(Boolean).join(', ') || null;
}

function buildTimeoutSignal(timeoutMs) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }
  if (typeof AbortController !== 'undefined') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();
    return controller.signal;
  }
  return undefined;
}

function deriveRiskFlags({ primaryType, businessStatus, isNamedPoi }) {
  const flags = [];
  if (isNamedPoi) flags.push('named_poi');
  if (primaryType && INSTITUTIONAL_PLACE_TYPES.has(primaryType)) flags.push('institutional_type');
  if (businessStatus && businessStatus !== 'OPERATIONAL') flags.push('non_operational_business');
  return [...new Set(flags)];
}

function isGenericAddressLevelResult(result) {
  if (!result) return false;

  const primaryType = String(result.primary_type || '').trim();
  const types = normalizeTypes(result.types);
  const hasNamedPoi = result.is_named_poi === true;

  if (hasNamedPoi) return false;
  if (primaryType && !GENERIC_ADDRESS_PLACE_TYPES.has(primaryType)) return false;
  if (types.length === 0) return true;

  return types.every((type) => GENERIC_ADDRESS_PLACE_TYPES.has(type));
}

function scoreNormalizedResult(result) {
  if (!result) return -1;

  let score = 0;
  if (!isGenericAddressLevelResult(result)) score += 100;
  if (result.is_named_poi) score += 40;
  if (result.primary_type) score += 20;
  if (INSTITUTIONAL_PLACE_TYPES.has(result.primary_type)) score += 40;
  score += normalizeTypes(result.types).filter((type) => !GENERIC_ADDRESS_PLACE_TYPES.has(type)).length;
  return score;
}

function selectBestCandidate(places, normalize) {
  if (!Array.isArray(places) || places.length === 0) {
    return null;
  }

  let best = null;
  let bestScore = -1;
  for (const place of places) {
    const normalized = normalize(place);
    if (!normalized) continue;

    const score = scoreNormalizedResult(normalized);
    if (score > bestScore) {
      best = normalized;
      bestScore = score;
    }
  }

  return best;
}

class PlaceClassificationProvider {
  constructor() {
    this.apiKey = addressConfig.googlePlaces.apiKey;
    this.timeoutMs = addressConfig.googlePlaces.timeoutMs;
    this.providerName = 'google_places';
    this.providerVersion = 'places_v1';
  }

  isFeatureEnabled() {
    return !!addressConfig.rollout.enablePlaceProvider;
  }

  isAvailable() {
    return this.isFeatureEnabled() && !!this.apiKey;
  }

  shouldRunShadowLookup() {
    return this.isAvailable();
  }

  async classify(input = {}) {
    if (!this.shouldRunShadowLookup()) {
      return null;
    }
    let genericAddressFallback = null;
    const placeId = normalizePlaceId(input.placeId);
    if (placeId) {
      const place = await this._fetchPlaceDetails(placeId);
      const normalized = this._normalizeResponse(place, {
        ...input,
        placeId,
        lookupMode: 'place_details',
      });
      if (normalized) {
        if (!isGenericAddressLevelResult(normalized)) {
          return normalized;
        }
        genericAddressFallback = normalized;
      }
    }

    const placeFromAddress = await this._searchByCanonicalAddress(input);
    if (placeFromAddress) {
      if (!isGenericAddressLevelResult(placeFromAddress)) {
        return placeFromAddress;
      }
      genericAddressFallback = genericAddressFallback || placeFromAddress;
    }

    const placeFromNearby = await this._searchNearby(input);
    if (placeFromNearby) {
      if (!isGenericAddressLevelResult(placeFromNearby)) {
        return placeFromNearby;
      }
      genericAddressFallback = genericAddressFallback || placeFromNearby;
    }

    return genericAddressFallback;
  }

  _buildHeaders(fieldMask) {
    return {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': this.apiKey,
      'X-Goog-FieldMask': fieldMask,
    };
  }

  async _requestJson(url, options, logContext) {
    let response;
    try {
      response = await fetch(url, {
        ...options,
        signal: buildTimeoutSignal(this.timeoutMs),
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        logger.warn('placeClassificationProvider: request timed out', {
          ...logContext,
          timeout_ms: this.timeoutMs,
        });
      } else {
        logger.warn('placeClassificationProvider: request failed', {
          ...logContext,
          error: error.message,
        });
      }
      return null;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.warn('placeClassificationProvider: API error', {
        ...logContext,
        status: response.status,
        body: text.slice(0, 500),
      });
      return null;
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      logger.warn('placeClassificationProvider: invalid JSON', {
        ...logContext,
        error: error.message,
      });
      return null;
    }

    return data;
  }

  async _fetchPlaceDetails(placeId) {
    return this._requestJson(
      `${DETAILS_API_BASE}/${encodeURIComponent(placeId)}`,
      {
        method: 'GET',
        headers: this._buildHeaders(DETAILS_FIELD_MASK),
      },
      { mode: 'place_details', placeId },
    );
  }

  async _searchByCanonicalAddress(input = {}) {
    const textQuery = buildTextQuery(input.normalizedAddress);
    if (!textQuery) {
      return null;
    }

    const body = {
      textQuery,
      pageSize: DEFAULT_SEARCH_RESULT_COUNT,
      languageCode: DEFAULT_LANGUAGE_CODE,
      regionCode: DEFAULT_REGION_CODE,
    };

    if (hasCoordinates(input.lat, input.lng)) {
      body.locationBias = {
        circle: {
          center: {
            latitude: Number(input.lat),
            longitude: Number(input.lng),
          },
          radius: DEFAULT_TEXT_BIAS_RADIUS_METERS,
        },
      };
    }

    const data = await this._requestJson(
      TEXT_SEARCH_URL,
      {
        method: 'POST',
        headers: this._buildHeaders(SEARCH_FIELD_MASK),
        body: JSON.stringify(body),
      },
      { mode: 'search_text', textQuery },
    );

    return selectBestCandidate(
      data?.places,
      (place) => this._normalizeResponse(place, {
        ...input,
        lookupMode: 'search_text',
      }),
    );
  }

  async _searchNearby(input = {}) {
    if (!hasCoordinates(input.lat, input.lng)) {
      return null;
    }

    const data = await this._requestJson(
      NEARBY_SEARCH_URL,
      {
        method: 'POST',
        headers: this._buildHeaders(SEARCH_FIELD_MASK),
        body: JSON.stringify({
          languageCode: DEFAULT_LANGUAGE_CODE,
          regionCode: DEFAULT_REGION_CODE,
          maxResultCount: DEFAULT_SEARCH_RESULT_COUNT,
          rankPreference: 'DISTANCE',
          locationRestriction: {
            circle: {
              center: {
                latitude: Number(input.lat),
                longitude: Number(input.lng),
              },
              radius: DEFAULT_NEARBY_RADIUS_METERS,
            },
          },
        }),
      },
      {
        mode: 'search_nearby',
        lat: Number(input.lat),
        lng: Number(input.lng),
      },
    );

    return selectBestCandidate(
      data?.places,
      (place) => this._normalizeResponse(place, {
        ...input,
        lookupMode: 'search_nearby',
      }),
    );
  }

  _normalizeResponse(data, input = {}) {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const displayName = data.displayName?.text || null;
    const primaryType = data.primaryType || null;
    const types = normalizeTypes(data.types);
    const hasStructuredTypes = !!primaryType || types.length > 0;
    const placeId = normalizePlaceId(data.id || input.placeId);
    const isNamedPoi = looksLikeNamedPoi(displayName, input.normalizedAddress);
    const riskFlags = deriveRiskFlags({
      primaryType,
      businessStatus: data.businessStatus || null,
      isNamedPoi,
    });

    return {
      provider: this.providerName,
      provider_version: this.providerVersion,
      place_id: placeId,
      primary_type: primaryType,
      types,
      business_status: data.businessStatus || null,
      display_name: displayName,
      confidence: hasStructuredTypes ? 0.9 : 0.5,
      is_named_poi: isNamedPoi,
      lookup_mode: input.lookupMode || null,
      verification_level: hasStructuredTypes ? 'shadow_provider_observed' : 'shadow_provider_partial',
      risk_flags: riskFlags,
      raw: data,
      validated_at: new Date().toISOString(),
    };
  }
}

module.exports = new PlaceClassificationProvider();
