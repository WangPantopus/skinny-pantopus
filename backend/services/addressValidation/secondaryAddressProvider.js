const logger = require('../../utils/logger');
const addressConfig = require('../../config/addressVerification');

const SEARCH_SECONDARY_COUNT_URL = 'https://us-enrichment.api.smarty.com/lookup/search/secondary/count';
const SEARCH_SECONDARY_URL = 'https://us-enrichment.api.smarty.com/lookup/search/secondary';
const LOOKUP_API_BASE = 'https://us-enrichment.api.smarty.com/lookup';
const MULTI_UNIT_PROVIDER_PLACE_TYPES = new Set([
  'subpremise',
  'apartment_building',
  'apartment_complex',
  'condominium_complex',
  'housing_complex',
  'mobile_home_park',
  'residential_building',
]);
const MULTI_UNIT_KEYWORDS = /\b(apartment|apartments|apt(?:s)?|condo|condos|condominium|condominiums|tower|towers|residence|residences|loft|lofts|flat|flats)\b/i;

function createTimeoutHandle(timeoutMs) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return {
      signal: AbortSignal.timeout(timeoutMs),
      cleanup() {},
    };
  }

  if (typeof AbortController !== 'undefined') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();

    return {
      signal: controller.signal,
      cleanup() {
        clearTimeout(timer);
      },
    };
  }

  return {
    signal: undefined,
    cleanup() {},
  };
}

function normalizeTypes(types) {
  return [...new Set((types || []).map((type) => String(type || '').trim()).filter(Boolean))];
}

function normalizeSecondaryToken(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return null;

  return raw
    .replace(/^(?:APT|APARTMENT|UNIT|STE|SUITE|RM|ROOM|FL|FLOOR|BLDG|BUILDING|#)\s*/i, '')
    .replace(/[^A-Z0-9]/g, '') || null;
}

function toNullableInteger(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildStreetSearchParams(normalizedAddress = {}) {
  const params = new URLSearchParams({
    street: String(normalizedAddress.line1 || '').trim(),
    city: String(normalizedAddress.city || '').trim(),
    state: String(normalizedAddress.state || '').trim(),
    zipcode: String(normalizedAddress.zip || '').trim(),
  });

  return params;
}

function buildAuthHeaders(authId, authToken) {
  return {
    Accept: 'application/json',
    Authorization: `Basic ${Buffer.from(`${authId}:${authToken}`).toString('base64')}`,
  };
}

function hasSearchableAddress(normalizedAddress = {}) {
  return !!(
    String(normalizedAddress.line1 || '').trim()
    && String(normalizedAddress.city || '').trim()
    && String(normalizedAddress.state || '').trim()
    && String(normalizedAddress.zip || '').trim()
  );
}

function extractSecondaryListEntry(data) {
  return Array.isArray(data) ? data[0] || null : null;
}

function extractUnitCount(countEntry, listEntry) {
  const fromCount = toNullableInteger(countEntry?.count);
  if (fromCount != null) return fromCount;

  const fromRoot = toNullableInteger(listEntry?.root_address?.secondary_count);
  if (fromRoot != null) return fromRoot;

  if (Array.isArray(listEntry?.secondaries)) {
    return listEntry.secondaries.length;
  }

  return null;
}

function deriveConfidence(unitCountEstimate, submittedUnitEvaluated) {
  if (!Number.isFinite(unitCountEstimate)) return null;
  if (unitCountEstimate > 1) return submittedUnitEvaluated ? 0.95 : 0.9;
  if (unitCountEstimate === 1) return 0.55;
  if (unitCountEstimate === 0) return 0.6;
  return 0.5;
}

class SecondaryAddressProvider {
  constructor() {
    this.authId = addressConfig.smarty.authId;
    this.authToken = addressConfig.smarty.authToken;
    this.timeoutMs = addressConfig.secondaryAddress.timeoutMs;
    this.providerName = 'smarty_secondary';
    this.providerVersion = 'us_enrichment_secondary_v1';
  }

  isFeatureEnabled() {
    return !!addressConfig.rollout.enableSecondaryProvider;
  }

  isAvailable() {
    return this.isFeatureEnabled() && !!(this.authId && this.authToken);
  }

  shouldRunLookup(context = {}) {
    if (!this.isAvailable()) return false;
    if (!hasSearchableAddress(context.normalizedAddress)) return false;

    const submittedUnit = String(context.submittedUnit || context.normalizedAddress?.line2 || '').trim();
    if (submittedUnit) return true;

    if (context.smarty?.missing_secondary || context.smarty?.dpv_match_code === 'S') return true;
    if (context.google?.missing_component_types?.includes('subpremise')) return true;
    if (context.place?.building_type === 'multi_unit') return true;

    const placeTypes = normalizeTypes([
      ...(context.place?.google_place_types || []),
      context.providerPlace?.primary_type,
      ...(context.providerPlace?.types || []),
    ]);
    if (placeTypes.some((type) => MULTI_UNIT_PROVIDER_PLACE_TYPES.has(type))) return true;

    const multiUnitText = [
      context.normalizedAddress?.line1,
      context.input?.line1,
      context.providerPlace?.display_name,
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join(' ');

    return MULTI_UNIT_KEYWORDS.test(multiUnitText);
  }

  async lookup(context = {}) {
    if (!this.shouldRunLookup(context)) {
      return null;
    }

    const countEntry = await this._fetchSecondaryCount(context.normalizedAddress);
    if (!countEntry) {
      return null;
    }

    const submittedUnit = String(context.submittedUnit || context.normalizedAddress?.line2 || '').trim();
    let listEntry = null;
    if (submittedUnit) {
      listEntry = await this._fetchSecondaryList(context.normalizedAddress, countEntry?.smarty_key || null);
    }

    return this._normalizeResults(countEntry, listEntry, {
      submittedUnit,
    });
  }

  async _requestJson(url, logContext) {
    const timeout = createTimeoutHandle(this.timeoutMs);
    let response;

    try {
      response = await fetch(url, {
        method: 'GET',
        headers: buildAuthHeaders(this.authId, this.authToken),
        signal: timeout.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        logger.warn('secondaryAddressProvider: request timed out', {
          ...logContext,
          timeout_ms: this.timeoutMs,
        });
      } else {
        logger.warn('secondaryAddressProvider: request failed', {
          ...logContext,
          error: error.message,
        });
      }
      return null;
    } finally {
      timeout.cleanup();
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.warn('secondaryAddressProvider: API error', {
        ...logContext,
        status: response.status,
        body: text.slice(0, 500),
      });
      return null;
    }

    try {
      return await response.json();
    } catch (error) {
      logger.warn('secondaryAddressProvider: invalid JSON', {
        ...logContext,
        error: error.message,
      });
      return null;
    }
  }

  async _fetchSecondaryCount(normalizedAddress) {
    const params = buildStreetSearchParams(normalizedAddress);
    const data = await this._requestJson(
      `${SEARCH_SECONDARY_COUNT_URL}?${params}`,
      {
        mode: 'secondary_count',
        street: normalizedAddress.line1,
        city: normalizedAddress.city,
        state: normalizedAddress.state,
        zipcode: normalizedAddress.zip,
      },
    );

    return extractSecondaryListEntry(data);
  }

  async _fetchSecondaryList(normalizedAddress, smartyKey = null) {
    const url = smartyKey
      ? `${LOOKUP_API_BASE}/${encodeURIComponent(smartyKey)}/secondary`
      : `${SEARCH_SECONDARY_URL}?${buildStreetSearchParams(normalizedAddress)}`;

    const data = await this._requestJson(
      url,
      smartyKey
        ? { mode: 'secondary_list', smarty_key: smartyKey }
        : {
            mode: 'secondary_list_search',
            street: normalizedAddress.line1,
            city: normalizedAddress.city,
            state: normalizedAddress.state,
            zipcode: normalizedAddress.zip,
          },
    );

    return extractSecondaryListEntry(data);
  }

  _normalizeResults(countEntry, listEntry, options = {}) {
    const unitCountEstimate = extractUnitCount(countEntry, listEntry);
    if (unitCountEstimate == null) {
      return null;
    }

    const submittedUnit = String(options.submittedUnit || '').trim();
    const normalizedSubmittedUnit = normalizeSecondaryToken(submittedUnit);
    const normalizedKnownUnits = Array.isArray(listEntry?.secondaries)
      ? [...new Set(listEntry.secondaries
        .map((secondary) => normalizeSecondaryToken(secondary?.secondary_number || ''))
        .filter(Boolean))]
      : [];
    const submittedUnitEvaluated = !!normalizedSubmittedUnit && normalizedKnownUnits.length > 0;
    const submittedUnitKnown = submittedUnitEvaluated
      ? normalizedKnownUnits.includes(normalizedSubmittedUnit)
      : null;

    return {
      provider: this.providerName,
      provider_version: this.providerVersion,
      secondary_required: unitCountEstimate > 1,
      unit_count_estimate: unitCountEstimate,
      confidence: deriveConfidence(unitCountEstimate, submittedUnitEvaluated),
      submitted_unit_known: submittedUnitKnown,
      submitted_unit_evaluated: submittedUnitEvaluated,
      lookup_mode: submittedUnit
        ? (submittedUnitEvaluated ? 'secondary_count_and_list' : 'secondary_count')
        : 'secondary_count',
      verification_level: unitCountEstimate > 1
        ? 'secondary_provider_observed'
        : 'secondary_provider_partial',
      validated_at: new Date().toISOString(),
      raw: {
        count: unitCountEstimate,
        smarty_key: countEntry?.smarty_key || listEntry?.smarty_key || null,
      },
    };
  }
}

module.exports = new SecondaryAddressProvider();
