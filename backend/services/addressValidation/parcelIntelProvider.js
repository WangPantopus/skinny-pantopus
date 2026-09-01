const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const addressConfig = require('../../config/addressVerification');

const ATTOM_BASE = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';
const BUSINESS_LIKE_PLACE_TYPES = new Set([
  'corporate_office',
  'business_center',
  'coworking_space',
  'store',
  'shopping_mall',
  'supermarket',
  'warehouse_store',
  'office',
  'factory',
  'manufacturer',
  'warehouse',
  'industrial_estate',
  'school',
  'primary_school',
  'secondary_school',
  'university',
  'library',
  'museum',
  'government_office',
  'local_government_office',
  'city_hall',
  'courthouse',
  'police',
  'fire_station',
  'hospital',
  'general_hospital',
  'medical_center',
  'arena',
  'stadium',
  'event_venue',
  'church',
  'mosque',
  'synagogue',
  'airport',
]);
const CHALLENGE_PLACE_TYPES = new Set([
  'lodging',
  'hotel',
  'motel',
  'guest_house',
  'rv_park',
  'apartment_complex',
  'condominium_complex',
  'housing_complex',
  'mobile_home_park',
]);

function normalizeTypes(types) {
  return [...new Set((types || []).map((type) => String(type || '').trim()).filter(Boolean))];
}

function toNullableNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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

function buildAttomAddressParams(normalizedAddress = {}) {
  return new URLSearchParams({
    address1: String(normalizedAddress.line1 || '').trim(),
    address2: [
      String(normalizedAddress.city || '').trim(),
      [normalizedAddress.state, normalizedAddress.zip]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join(' '),
    ].filter(Boolean).join(', '),
  });
}

function hasSearchableAddress(normalizedAddress = {}) {
  return !!(
    String(normalizedAddress.line1 || '').trim()
    && String(normalizedAddress.city || '').trim()
    && String(normalizedAddress.state || '').trim()
    && String(normalizedAddress.zip || '').trim()
  );
}

function deriveUsageClass({ landUse, propertyType, residentialUnitCount, nonResidentialUnitCount }) {
  const landUseText = String(landUse || '').trim().toLowerCase();
  const propertyTypeText = String(propertyType || '').trim().toLowerCase();
  const combined = `${landUseText} ${propertyTypeText}`.trim();

  if (
    residentialUnitCount > 0 &&
    nonResidentialUnitCount > 0
  ) return 'mixed';

  if (/\b(mixed|mixed use|mixed-use|multi use|live\/work)\b/.test(combined)) return 'mixed';
  if (/\b(industrial|warehouse|factory|manufacturing|plant)\b/.test(combined)) return 'industrial';
  if (/\b(institution|institutional|school|university|hospital|church|museum|library|government|municipal|courthouse|police|fire station|arena|stadium)\b/.test(combined)) return 'institutional';
  if (/\b(lodging|hotel|motel|resort|hospitality|rv park)\b/.test(combined)) return 'lodging';
  if (/\b(commercial|retail|office|shopping|storefront|business)\b/.test(combined)) return 'commercial';
  if (/\b(residential|single family|single-family|apartment|condo|condominium|townhome|townhouse|duplex|triplex|quadplex|mobile home)\b/.test(combined)) return 'residential';
  if (residentialUnitCount > 0 && !nonResidentialUnitCount) return 'residential';
  if (nonResidentialUnitCount > 0 && !residentialUnitCount) return 'commercial';
  return 'unknown';
}

function deriveConfidence({ usageClass, landUse, propertyType, buildingCount, residentialUnitCount, nonResidentialUnitCount }) {
  let score = 0;
  if (usageClass && usageClass !== 'unknown') score += 0.35;
  if (landUse) score += 0.2;
  if (propertyType) score += 0.15;
  if (Number.isFinite(buildingCount)) score += 0.1;
  if (Number.isFinite(residentialUnitCount)) score += 0.1;
  if (Number.isFinite(nonResidentialUnitCount)) score += 0.1;
  return Math.round(Math.min(1, score) * 100) / 100;
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function parseTimestamp(value) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

class ParcelIntelProvider {
  constructor() {
    this.provider = addressConfig.parcelIntel.provider;
    this.timeoutMs = addressConfig.parcelIntel.timeoutMs;
    this.cacheDays = addressConfig.parcelIntel.cacheDays;
    this.providerVersion = 'parcel_shadow_v1';
  }

  isFeatureEnabled() {
    return !!addressConfig.rollout.enableParcelProvider;
  }

  isAvailable() {
    if (!this.isFeatureEnabled()) return false;
    if (this.provider === 'attom') return !!process.env.ATTOM_API_KEY;
    return false;
  }

  shouldRunLookup(context = {}) {
    if (!this.isAvailable()) return false;
    if (!hasSearchableAddress(context.normalizedAddress)) return false;

    const placeTypes = normalizeTypes([
      ...(context.place?.google_place_types || []),
      context.providerPlace?.primary_type,
      ...(context.providerPlace?.types || []),
    ]);

    if (context.smarty?.rdi_type === 'unknown') return true;
    if (context.place?.parcel_type === 'mixed' || context.place?.building_type === 'mixed_use') return true;
    if (context.place?.parcel_type === 'commercial' || context.place?.building_type === 'commercial') return true;
    if (placeTypes.some((type) => BUSINESS_LIKE_PLACE_TYPES.has(type) || CHALLENGE_PLACE_TYPES.has(type))) return true;
    if (context.google?.verdict?.hasInferredComponents || context.google?.verdict?.hasReplacedComponents) return true;

    return false;
  }

  async lookup(context = {}) {
    if (!this.shouldRunLookup(context)) return null;

    const cached = await this._checkCache(context.normalizedAddress);
    if (cached) return cached;

    if (this.provider === 'attom') {
      return this._lookupAttom(context.normalizedAddress);
    }

    return null;
  }

  async _checkCache(normalizedAddress) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.cacheDays);

    const { data, error } = await supabaseAdmin
      .from('HomeAddress')
      .select('*')
      .eq('address_line1_norm', normalizedAddress.line1)
      .eq('city_norm', normalizedAddress.city)
      .eq('state', normalizedAddress.state)
      .eq('postal_code', normalizedAddress.zip)
      .gte('last_parcel_validated_at', cutoff.toISOString())
      .order('last_parcel_validated_at', { ascending: false });

    if (error) {
      logger.warn('parcelIntelProvider: cache lookup failed', {
        error: error.message,
      });
      return null;
    }

    const cachedRows = Array.isArray(data) ? data : (data ? [data] : []);
    if (cachedRows.length === 0) return null;

    const bestRow = cachedRows
      .filter((row) => {
        const raw = row?.validation_raw_response?.parcel_provider || null;
        return !!(row?.parcel_id || raw?.parcel_id);
      })
      .sort((left, right) => {
        const validatedAtDiff = parseTimestamp(right?.last_parcel_validated_at) - parseTimestamp(left?.last_parcel_validated_at);
        if (validatedAtDiff !== 0) return validatedAtDiff;

        const confidenceDiff = (Number(right?.parcel_confidence) || 0) - (Number(left?.parcel_confidence) || 0);
        return confidenceDiff;
      })[0];

    if (!bestRow) return null;

    if (cachedRows.length > 1) {
      logger.info('parcelIntelProvider: selected best cached parcel row', {
        row_count: cachedRows.length,
        selected_address_id: bestRow.id,
      });
    }

    const raw = bestRow?.validation_raw_response?.parcel_provider || null;

    return {
      provider: bestRow.parcel_provider || raw?.provider || this.provider,
      provider_version: bestRow.provider_versions?.parcel_intel?.version || raw?.provider_version || this.providerVersion,
      parcel_id: bestRow.parcel_id || raw?.parcel_id || null,
      land_use: bestRow.parcel_land_use || raw?.land_use || null,
      property_type: bestRow.parcel_property_type || raw?.property_type || null,
      building_count: bestRow.building_count ?? raw?.building_count ?? null,
      residential_unit_count: bestRow.residential_unit_count ?? raw?.residential_unit_count ?? null,
      non_residential_unit_count: bestRow.non_residential_unit_count ?? raw?.non_residential_unit_count ?? null,
      usage_class: bestRow.usage_class || raw?.usage_class || 'unknown',
      confidence: bestRow.parcel_confidence ?? raw?.confidence ?? null,
      lookup_mode: raw?.lookup_mode || 'cache',
      from_cache: true,
      validated_at: bestRow.last_parcel_validated_at || raw?.validated_at || null,
    };
  }

  async _lookupAttom(normalizedAddress) {
    const apiKey = process.env.ATTOM_API_KEY;
    const timeout = createTimeoutHandle(this.timeoutMs);
    const url = `${ATTOM_BASE}/property/detail?${buildAttomAddressParams(normalizedAddress)}`;
    let response;

    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          apikey: apiKey,
          Accept: 'application/json',
        },
        signal: timeout.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        logger.warn('parcelIntelProvider: request timed out', {
          provider: 'attom',
          timeout_ms: this.timeoutMs,
        });
      } else {
        logger.warn('parcelIntelProvider: request failed', {
          provider: 'attom',
          error: error.message,
        });
      }
      return null;
    } finally {
      timeout.cleanup();
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.warn('parcelIntelProvider: API error', {
        provider: 'attom',
        status: response.status,
        body: text.slice(0, 500),
      });
      return null;
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      logger.warn('parcelIntelProvider: invalid JSON', {
        provider: 'attom',
        error: error.message,
      });
      return null;
    }

    return this._normalizeAttom(data);
  }

  _normalizeAttom(data) {
    const property = data?.property?.[0];
    if (!property) return null;

    const buildingSummary = property.building?.summary || {};
    const propertySummary = property.summary || {};
    const building = property.building || {};
    const lot = property.lot || {};
    const assessment = property.assessment || {};

    const landUse = firstDefined(
      propertySummary.propclass,
      buildingSummary.propertyType,
      assessment.market?.muniPropertyUse,
      assessment.market?.propertyUse,
      assessment.tax?.propertyUse,
      lot.lotType,
    );
    const propertyType = firstDefined(
      buildingSummary.propertyType,
      propertySummary.propertyType,
      propertySummary.proptype,
      propertySummary.propclass,
    );
    const buildingCount = toNullableNumber(firstDefined(
      propertySummary.buildingsCount,
      propertySummary.bldgCount,
      buildingSummary.buildingCount,
    ));
    const residentialUnitCount = toNullableNumber(firstDefined(
      buildingSummary.unitsCount,
      buildingSummary.unitCount,
      propertySummary.unitsCount,
      propertySummary.residentialUnits,
    ));
    const nonResidentialUnitCount = toNullableNumber(firstDefined(
      propertySummary.nonResidentialUnits,
      propertySummary.commercialUnits,
    ));
    const usageClass = deriveUsageClass({
      landUse,
      propertyType,
      residentialUnitCount,
      nonResidentialUnitCount,
    });
    const confidence = deriveConfidence({
      usageClass,
      landUse,
      propertyType,
      buildingCount,
      residentialUnitCount,
      nonResidentialUnitCount,
    });

    return {
      provider: 'attom',
      provider_version: this.providerVersion,
      parcel_id: firstDefined(
        property.identifier?.apn,
        property.identifier?.obPropId,
        property.identifier?.attomId,
      ),
      land_use: landUse,
      property_type: propertyType,
      building_count: buildingCount,
      residential_unit_count: residentialUnitCount,
      non_residential_unit_count: nonResidentialUnitCount,
      usage_class: usageClass,
      confidence,
      lookup_mode: 'property_detail',
      from_cache: false,
      validated_at: new Date().toISOString(),
      raw: {
        attom_id: property.identifier?.attomId || null,
      },
    };
  }
}

module.exports = new ParcelIntelProvider();
