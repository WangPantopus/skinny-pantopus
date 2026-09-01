/**
 * Address Decision Engine (Deterministic Classification)
 *
 * Pure-logic engine that consumes provider signals (Google validation result,
 * Smarty postal result, optional place classification) and produces a single
 * AddressVerdict.  Has NO external calls — operates entirely on pre-fetched data.
 *
 * Classification rules run in strict priority order:
 *   1. SERVICE_ERROR            — any provider returned an error / was inconclusive
 *   2. UNDELIVERABLE            — DPV no-match, vacant w/o delivery, or Google undeliverable signals
 *   3. PO_BOX                   — PO Box or post office carrier route detected
 *   4. MISSING_STREET_NUMBER    — Google reports street_number missing from input
 *   5. UNVERIFIED_STREET_NUMBER — street_number present but not confirmed by Google
 *   6. MISSING_UNIT             — missing_secondary flag (hard rule)
 *   7. BUSINESS                 — RDI commercial + place/parcel commercial, or lodging, no residential signals
 *   8. MIXED_USE                — mixed parcel or ambiguous RDI + place signals
 *   9. LOW_CONFIDENCE           — geocode granularity below premise level
 *  10. MULTIPLE_MATCHES         — multiple normalized candidates
 *  11. CONFLICT                 — existing household found at canonical address
 *  12. OK                       — all checks passed
 */

const { AddressVerdictStatus } = require('./types');

/** @typedef {import('./types').GoogleValidationResult} GoogleValidationResult */
/** @typedef {import('./types').SmartyPostalResult} SmartyPostalResult */
/** @typedef {import('./types').PlaceClassification} PlaceClassification */
/** @typedef {import('./types').ExistingHousehold} ExistingHousehold */
/** @typedef {import('./types').NormalizedAddress} NormalizedAddress */
/** @typedef {import('./types').AddressCandidate} AddressCandidate */
/** @typedef {import('./types').AddressVerdict} AddressVerdict */
/** @typedef {import('./types').SecondaryAddressIntelligence} SecondaryAddressIntelligence */
/** @typedef {import('./types').ParcelIntelligence} ParcelIntelligence */

// Google place types that indicate residential use
const RESIDENTIAL_PLACE_TYPES = new Set([
  'premise', 'subpremise', 'street_address', 'room',
  'apartment', 'condominium', 'townhouse',
]);

// Google place types that indicate lodging (hotels/motels — not a permanent home)
const LODGING_PLACE_TYPES = new Set(['lodging']);

// PO Box pattern for normalized line1 fallback detection
const PO_BOX_PATTERN = /^\s*(?:p\.?\s*o\.?\s*b(?:ox)?|post\s+office\s+box)\b/i;

// Google place types that indicate commercial use
const COMMERCIAL_PLACE_TYPES = new Set([
  'store', 'restaurant', 'shopping_mall', 'supermarket',
  'bank', 'gas_station', 'car_dealer', 'car_repair',
  'gym', 'hair_care', 'laundry', 'lawyer', 'dentist',
  'doctor', 'hospital', 'pharmacy', 'post_office',
  'insurance_agency', 'real_estate_agency', 'travel_agency',
  'accounting', 'establishment', 'food', 'finance',
  'health', 'point_of_interest',
]);
const INSTITUTIONAL_PLACE_TYPES = new Set([
  'school', 'university', 'stadium',
  'government_office', 'event_venue',
  'library', 'museum', 'airport', 'church',
]);
const PROVIDER_DENY_COMMERCIAL_PLACE_TYPES = new Set([
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
]);
const PROVIDER_DENY_INSTITUTIONAL_PLACE_TYPES = new Set([
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
const PROVIDER_RESIDENTIAL_SAFE_PLACE_TYPES = new Set([
  'street_address',
  'premise',
  'subpremise',
  'room',
  'apartment',
  'apartment_building',
  'apartment_complex',
  'condominium',
  'condominium_complex',
  'housing_complex',
  'mobile_home_park',
  'residential_building',
  'townhouse',
]);
const PROVIDER_DENY_MIN_CONFIDENCE = 0.85;
const PROVIDER_SECONDARY_MIN_CONFIDENCE = 0.85;
const PROVIDER_PARCEL_MIN_CONFIDENCE = 0.85;
const DEFAULT_PROVIDER_PARCEL_MAX_AGE_DAYS = 30;
const PARCEL_RESIDENTIAL_CONTEXT = /\b(residential|single family|single-family|apartment|condo|condominium|townhome|townhouse|duplex|triplex|quadplex|multi family|multi-family|dwelling|home|mobile home)\b/;
const PARCEL_COMMERCIAL_CONTEXT = /\b(commercial|retail|office|store|storefront|shopping|mall|business|supermarket)\b/;
const PARCEL_INSTITUTIONAL_CONTEXT = /\b(school|university|college|hospital|medical|church|worship|museum|library|government|municipal|courthouse|police|fire station|city hall|stadium|arena|airport)\b/;
const PARCEL_INDUSTRIAL_CONTEXT = /\b(industrial|warehouse|factory|manufactur|plant|distribution|logistics)\b/;

// Geocode granularity levels below premise (unreliable)
const LOW_GRANULARITY = new Set([
  'ROUTE', 'OTHER', 'APPROXIMATE', 'GEOMETRIC_CENTER',
  'RANGE_INTERPOLATED', 'BLOCK',
]);

/**
 * @typedef {import('./types').ProviderPlaceClassification} ProviderPlaceClassification
 *
 * @typedef {object} DecisionInput
 * @property {GoogleValidationResult}  [google]                         — Layer 2 result
 * @property {SmartyPostalResult}      [smarty]                         — Layer 3 result
 * @property {PlaceClassification}     [place]                          — heuristic place signals
 * @property {ProviderPlaceClassification} [provider_place]             — provider-backed place data
 * @property {boolean}                 [use_provider_place_for_business] — feature-flagged deny enforcement
 * @property {SecondaryAddressIntelligence} [unit_intelligence]         — provider-backed unit signals
 * @property {boolean}                 [use_provider_unit_intelligence]  — feature-flagged missing-unit enforcement
 * @property {ParcelIntelligence}      [parcel_intel]                   — provider-backed parcel/property data
 * @property {boolean}                 [use_provider_parcel_for_classification] — feature-flagged parcel enforcement
 * @property {number}                  [provider_parcel_max_age_days]   — freshness threshold for cached parcel data
 * @property {ExistingHousehold}       [household]                      — existing household at this address
 * @property {AddressCandidate[]}      [candidates]                     — alternate address candidates
 */

function normalizeTypes(types) {
  return [...new Set((types || []).map((type) => String(type || '').trim()).filter(Boolean))];
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isFreshTimestamp(value, maxAgeDays) {
  if (!value) return false;

  const validatedAt = new Date(value);
  if (Number.isNaN(validatedAt.getTime())) return false;

  const ageLimitDays = Number.isFinite(Number(maxAgeDays)) && Number(maxAgeDays) > 0
    ? Number(maxAgeDays)
    : DEFAULT_PROVIDER_PARCEL_MAX_AGE_DAYS;
  const maxAgeMs = ageLimitDays * 24 * 60 * 60 * 1000;

  return (Date.now() - validatedAt.getTime()) <= maxAgeMs;
}

class AddressDecisionEngine {
  /**
   * Classify an address and produce a full AddressVerdict.
   *
   * @param {DecisionInput} input
   * @returns {AddressVerdict}
   */
  classify(input) {
    const {
      google,
      smarty,
      place,
      provider_place: providerPlace,
      use_provider_place_for_business: useProviderPlaceForBusiness,
      unit_intelligence: unitIntelligence,
      use_provider_unit_intelligence: useProviderUnitIntelligence,
      parcel_intel: parcelIntelligence,
      use_provider_parcel_for_classification: useProviderParcelForClassification,
      provider_parcel_max_age_days: providerParcelMaxAgeDays,
      household,
      candidates,
    } = input || {};

    const reasons = [];
    const nextActions = [];
    let confidence = 1.0;

    // Collect normalized address from Google
    const normalized = google?.normalized || undefined;

    // ── Rule 1: SERVICE_ERROR ─────────────────────────────────
    if (this._hasServiceError(google, smarty)) {
      const errorReasons = [];
      if (!google) errorReasons.push('Google validation result missing');
      if (smarty?.inconclusive) errorReasons.push('Smarty postal check was inconclusive');
      if (!smarty) errorReasons.push('Smarty postal result missing');

      return this._verdict({
        status: AddressVerdictStatus.SERVICE_ERROR,
        reasons: errorReasons,
        confidence: 0,
        normalized,
        next_actions: ['manual_review'],
        candidates: candidates || [],
      });
    }

    // ── Rule 2: UNDELIVERABLE ─────────────────────────────────
    if (this._isUndeliverable(google, smarty)) {
      const undeliverableReasons = [];
      if (smarty.dpv_match_code === 'N') undeliverableReasons.push('DPV_NO_MATCH');
      if (smarty.vacant_flag) undeliverableReasons.push('USPS_VACANT');
      if (smarty.vacant_flag && smarty.dpv_match_code !== 'Y') {
        undeliverableReasons.push('VACANT_NO_DELIVERY');
      }
      if (smarty.commercial_mailbox) undeliverableReasons.push('CMRA_MAILBOX');
      if (undeliverableReasons.length === 0) undeliverableReasons.push('DPV_NO_MATCH');

      return this._verdict({
        status: AddressVerdictStatus.UNDELIVERABLE,
        reasons: undeliverableReasons,
        confidence: this._clamp(0.1),
        normalized,
        deliverability: this._buildDeliverability(smarty),
        next_actions: ['manual_review'],
        candidates: candidates || [],
      });
    }

    // ── Rule 3: PO_BOX ────────────────────────────────────────
    if (this._isPOBox(google, smarty)) {
      const poReasons = ['PO_BOX'];
      if (google?.usps_data?.carrier_route_type === 'P') {
        poReasons.push('USPS_PO_BOX_ROUTE');
      }
      if (PO_BOX_PATTERN.test(google?.normalized?.line1 || '')) {
        poReasons.push('PO_BOX_PATTERN');
      }

      return this._verdict({
        status: AddressVerdictStatus.PO_BOX,
        reasons: poReasons,
        confidence: this._clamp(0),
        normalized,
        deliverability: this._buildDeliverability(smarty),
        next_actions: ['reject'],
        candidates: candidates || [],
      });
    }

    // ── Rule 4: MISSING_STREET_NUMBER ──────────────────────────
    if (this._isMissingStreetNumber(google)) {
      const streetReasons = ['MISSING_STREET_NUMBER'];
      if (google?.missing_component_types?.includes('street_number')) {
        streetReasons.push('GOOGLE_STREET_NUMBER_MISSING');
      }

      return this._verdict({
        status: AddressVerdictStatus.MISSING_STREET_NUMBER,
        reasons: streetReasons,
        confidence: this._clamp(0.15),
        normalized,
        deliverability: this._buildDeliverability(smarty),
        next_actions: ['prompt_street_number'],
        candidates: candidates || [],
      });
    }

    // ── Rule 5: UNVERIFIED_STREET_NUMBER ───────────────────────
    if (this._isUnverifiedStreetNumber(google)) {
      const unverifiedReasons = ['UNVERIFIED_STREET_NUMBER'];
      if (google?.verdict?.hasUnconfirmedComponents) {
        unverifiedReasons.push('GOOGLE_UNCONFIRMED_COMPONENTS');
      }
      if (google?.components?.street_number?.inferred) {
        unverifiedReasons.push('GOOGLE_STREET_NUMBER_INFERRED');
      }

      return this._verdict({
        status: AddressVerdictStatus.UNVERIFIED_STREET_NUMBER,
        reasons: unverifiedReasons,
        confidence: this._clamp(0.2),
        normalized,
        deliverability: this._buildDeliverability(smarty),
        next_actions: ['manual_review'],
        candidates: candidates || [],
      });
    }

    // ── Rule 6: MISSING_UNIT (hard rule) ──────────────────────
    const missingUnit = this._evaluateMissingUnit(
      google,
      smarty,
      unitIntelligence,
      useProviderUnitIntelligence,
    );

    if (missingUnit.isMissing) {
      reasons.push('MISSING_SECONDARY');
      if (missingUnit.legacyFromSmarty && smarty.dpv_match_code === 'S') reasons.push('DPV_SECONDARY_MISSING');
      if (missingUnit.legacyFromGoogle) {
        reasons.push('GOOGLE_SUBPREMISE_MISSING');
      }

      return this._verdict({
        status: AddressVerdictStatus.MISSING_UNIT,
        reasons,
        confidence: this._clamp(0.3),
        normalized,
        deliverability: this._buildDeliverability(smarty),
        next_actions: ['prompt_unit'],
        candidates: candidates || [],
      });
    }

    // ── Gather signal flags for remaining rules ───────────────
    const rdi = smarty.rdi_type; // 'residential' | 'commercial' | 'unknown'
    const placeTypes = place?.google_place_types || [];
    const parcelType = place?.parcel_type || 'unknown';
    const buildingType = place?.building_type || 'unknown';

    const heuristicPlaceSignals = this._buildHeuristicPlaceSignals(placeTypes);
    const providerBusinessSignals = this._buildProviderBusinessSignals(providerPlace, useProviderPlaceForBusiness);
    const providerParcelSignals = this._buildProviderParcelSignals(
      parcelIntelligence,
      useProviderParcelForClassification,
      providerParcelMaxAgeDays,
    );
    const businessPlaceSignals = providerBusinessSignals.useProvider
      ? providerBusinessSignals
      : heuristicPlaceSignals;
    const effectiveParcelType = providerParcelSignals.useProvider
      ? providerParcelSignals.reasonParcelType
      : parcelType;
    const effectiveBuildingType = providerParcelSignals.useProvider
      ? providerParcelSignals.reasonBuildingType
      : buildingType;
    const baseReasons = this._buildBaseReasons(rdi, effectiveParcelType, effectiveBuildingType, smarty);
    const heuristicPlaceReasons = this._buildHeuristicPlaceReasons(heuristicPlaceSignals);
    const businessPlaceReasons = this._buildBusinessPlaceReasons(
      heuristicPlaceSignals,
      providerBusinessSignals,
    );
    const effectiveClassification = this._buildVerdictClassification(
      place,
      effectiveParcelType,
      effectiveBuildingType,
    );

    // ── Rule 7: BUSINESS ──────────────────────────────────────
    if (this._isBusiness(
      rdi,
      parcelType,
      buildingType,
      businessPlaceSignals.hasResidentialPlace,
      businessPlaceSignals.hasCommercialPlace,
      businessPlaceSignals.hasInstitutionalPlace,
      smarty,
      providerBusinessSignals,
      providerParcelSignals,
      heuristicPlaceSignals.hasLodgingPlace,
    )) {
      return this._verdict({
        status: AddressVerdictStatus.BUSINESS,
        reasons: [...baseReasons, ...businessPlaceReasons],
        confidence: this._clamp(0.85),
        normalized,
        deliverability: this._buildDeliverability(smarty),
        classification: effectiveClassification,
        next_actions: ['manual_review'],
        candidates: candidates || [],
      });
    }

    // ── Rule 8: MIXED_USE ─────────────────────────────────────
    if (this._isMixedUse(
      rdi,
      effectiveParcelType,
      buildingType,
      heuristicPlaceSignals.hasResidentialPlace,
      heuristicPlaceSignals.hasCommercialPlace,
      heuristicPlaceSignals.hasInstitutionalPlace,
      providerBusinessSignals,
      providerParcelSignals,
    )) {
      return this._verdict({
        status: AddressVerdictStatus.MIXED_USE,
        reasons: [...baseReasons, ...heuristicPlaceReasons],
        confidence: this._clamp(0.5),
        normalized,
        deliverability: this._buildDeliverability(smarty),
        classification: effectiveClassification,
        next_actions: ['manual_review', 'send_mail_code'],
        candidates: candidates || [],
      });
    }

    // ── Rule 9: LOW_CONFIDENCE ────────────────────────────────
    const granularity = google?.granularity || '';
    if (this._isLowGranularity(granularity)) {
      return this._verdict({
        status: AddressVerdictStatus.LOW_CONFIDENCE,
        reasons: [...baseReasons, ...heuristicPlaceReasons, `GEOCODE_GRANULARITY_${granularity}`],
        confidence: this._clamp(0.2),
        normalized,
        deliverability: this._buildDeliverability(smarty),
        classification: effectiveClassification,
        next_actions: ['manual_review'],
        candidates: candidates || [],
      });
    }

    // ── Rule 10: MULTIPLE_MATCHES ─────────────────────────────
    if (candidates && candidates.length > 1) {
      return this._verdict({
        status: AddressVerdictStatus.MULTIPLE_MATCHES,
        reasons: [...baseReasons, ...heuristicPlaceReasons, 'MULTIPLE_CANDIDATES'],
        confidence: this._clamp(0.4),
        normalized,
        deliverability: this._buildDeliverability(smarty),
        classification: effectiveClassification,
        next_actions: ['select_candidate'],
        candidates,
      });
    }

    // ── Rule 11: CONFLICT ─────────────────────────────────────
    if (household) {
      return this._verdict({
        status: AddressVerdictStatus.CONFLICT,
        reasons: [...baseReasons, ...heuristicPlaceReasons, 'EXISTING_HOUSEHOLD'],
        confidence: this._computeConfidence(google, smarty, granularity),
        normalized,
        deliverability: this._buildDeliverability(smarty),
        classification: effectiveClassification,
        existing_household: household,
        next_actions: ['join_existing', 'dispute'],
        candidates: candidates || [],
      });
    }

    // ── Rule 12: OK ───────────────────────────────────────────
    confidence = this._computeConfidence(google, smarty, granularity);

    return this._verdict({
      status: AddressVerdictStatus.OK,
      reasons: [...baseReasons, ...heuristicPlaceReasons],
      confidence,
      normalized,
      deliverability: this._buildDeliverability(smarty),
      classification: effectiveClassification,
      next_actions: ['send_mail_code'],
      candidates: candidates || [],
    });
  }

  // ── Rule predicates ────────────────────────────────────────────

  /**
   * @param {GoogleValidationResult|undefined} google
   * @param {SmartyPostalResult|undefined} smarty
   * @returns {boolean}
   */
  _hasServiceError(google, smarty) {
    if (!google) return true;
    if (!smarty) return true;
    if (smarty.inconclusive) return true;
    return false;
  }

  /**
   * @param {GoogleValidationResult} google
   * @param {SmartyPostalResult} smarty
   * @returns {boolean}
   */
  _isUndeliverable(google, smarty) {
    // DPV explicitly says no match
    if (smarty.dpv_match_code === 'N') return true;

    // Vacant with no confirmed delivery point — not a habitable address
    // 'Y' = full match, 'D' = confirmed default (primary number match)
    if (smarty.vacant_flag && smarty.dpv_match_code !== 'Y' && smarty.dpv_match_code !== 'D') return true;

    // DPV empty (no data) AND Google says unconfirmed at a low granularity
    if (
      !smarty.dpv_match_code &&
      google.verdict?.hasUnconfirmedComponents &&
      LOW_GRANULARITY.has(google.granularity)
    ) {
      return true;
    }

    return false;
  }

  /**
   * PO Box: USPS carrier route type starts with 'P', or normalized line1
   * matches PO Box patterns.
   *
   * @param {GoogleValidationResult} google
   * @param {SmartyPostalResult} smarty
   * @returns {boolean}
   */
  _isPOBox(google, smarty) {
    // USPS carrier route type 'P' = PO Box route
    if (google?.usps_data?.carrier_route_type === 'P') return true;

    // Fallback: pattern match on normalized line1
    if (PO_BOX_PATTERN.test(google?.normalized?.line1 || '')) return true;

    return false;
  }

  /**
   * Missing street number: Google reports street_number in missing_component_types,
   * or the normalized line1 has no leading digits (route-only).
   *
   * @param {GoogleValidationResult|undefined} google
   * @returns {boolean}
   */
  _isMissingStreetNumber(google) {
    if (!google) return false;

    // Explicit signal from Google
    if (google.missing_component_types?.includes('street_number')) return true;

    // Fallback: normalized line1 exists but has no leading street number.
    // Skip when line2 is populated — building-name addresses like
    // "Sunset Apartments" + "Apt 4A" are valid (not missing a number).
    const line1 = google.normalized?.line1?.trim();
    const line2 = google.normalized?.line2?.trim();
    if (line1 && !/^\d/.test(line1) && !line2) return true;

    return false;
  }

  /**
   * Unverified street number: the street number is present but Google could not
   * confirm it (the exact number likely doesn't exist on this street).
   *
   * @param {GoogleValidationResult|undefined} google
   * @returns {boolean}
   */
  _isUnverifiedStreetNumber(google) {
    if (!google) return false;
    if (!google.components?.street_number) return false;

    const streetNum = google.components.street_number;

    // Street number was inferred by Google (not in the original input)
    if (streetNum.inferred) return true;

    // Street number is present but not confirmed by Google
    if (!streetNum.confirmed && google.verdict?.hasUnconfirmedComponents) return true;

    return false;
  }

  /**
   * Hard rule: if missing_secondary is true, always MISSING_UNIT.
   *
   * @param {GoogleValidationResult} google
   * @param {SmartyPostalResult} smarty
   * @returns {boolean}
   */
  _evaluateMissingUnit(google, smarty, unitIntelligence, useProviderUnitIntelligence) {
    const legacyFromSmarty = !!(smarty.missing_secondary || smarty.dpv_match_code === 'S');
    const legacyFromGoogle = !!google?.missing_component_types?.includes('subpremise');
    const submittedUnit = String(google?.normalized?.line2 || '').trim();
    const providerSignals = this._buildProviderUnitSignals(
      unitIntelligence,
      submittedUnit,
      useProviderUnitIntelligence,
    );

    if (providerSignals.providerConfirmsUnit) {
      return {
        isMissing: false,
        legacyFromSmarty: false,
        legacyFromGoogle: false,
      };
    }

    if (legacyFromSmarty || legacyFromGoogle) {
      return {
        isMissing: true,
        legacyFromSmarty,
        legacyFromGoogle,
      };
    }

    // Defer provider-only invalid-unit enforcement until there is a settled
    // public reason/UX path for "unit supplied but not verified". For now the
    // provider can strengthen missing-unit only when the user omitted a unit.
    if (providerSignals.providerRequiresUnit) {
      return {
        isMissing: true,
        legacyFromSmarty: false,
        legacyFromGoogle: false,
      };
    }

    return {
      isMissing: false,
      legacyFromSmarty: false,
      legacyFromGoogle: false,
    };
  }

  _buildProviderUnitSignals(unitIntelligence, submittedUnit, enabled) {
    if (!enabled || !unitIntelligence) {
      return {
        providerRequiresUnit: false,
        providerRejectsUnit: false,
        providerConfirmsUnit: false,
      };
    }

    const confidence = Number(unitIntelligence.confidence);
    const unitCountEstimate = Number(unitIntelligence.unit_count_estimate);
    const isHighConfidence = Number.isFinite(confidence) && confidence >= PROVIDER_SECONDARY_MIN_CONFIDENCE;
    const hasStrongMultiUnitEvidence =
      unitIntelligence.secondary_required === true &&
      Number.isFinite(unitCountEstimate) &&
      unitCountEstimate > 1;
    const hasSubmittedUnit = !!String(submittedUnit || '').trim();
    const submittedUnitEvaluated = unitIntelligence.submitted_unit_evaluated === true;

    if (!isHighConfidence || !hasStrongMultiUnitEvidence) {
      return {
        providerRequiresUnit: false,
        providerRejectsUnit: false,
        providerConfirmsUnit: false,
      };
    }

    return {
      providerRequiresUnit: !hasSubmittedUnit,
      providerRejectsUnit: hasSubmittedUnit && submittedUnitEvaluated && unitIntelligence.submitted_unit_known === false,
      providerConfirmsUnit: hasSubmittedUnit && submittedUnitEvaluated && unitIntelligence.submitted_unit_known === true,
    };
  }

  _buildProviderParcelSignals(parcelIntelligence, enabled, maxAgeDays) {
    if (!enabled || !parcelIntelligence) {
      return {
        useProvider: false,
        reasonParcelType: 'unknown',
        reasonBuildingType: 'unknown',
        usageClass: 'unknown',
        hasResidentialOccupancy: false,
        hasNonResidentialOccupancy: false,
        hasMixedUse: false,
        isHighConfidenceBusinessDeny: false,
      };
    }

    const confidence = toFiniteNumber(parcelIntelligence.confidence);
    const residentialUnitCount = toFiniteNumber(parcelIntelligence.residential_unit_count);
    const nonResidentialUnitCount = toFiniteNumber(parcelIntelligence.non_residential_unit_count);
    const isHighConfidence =
      confidence !== null &&
      confidence >= PROVIDER_PARCEL_MIN_CONFIDENCE;
    const isFresh = isFreshTimestamp(parcelIntelligence.validated_at, maxAgeDays);
    const usageClass = this._deriveProviderParcelUsageClass(
      parcelIntelligence,
      residentialUnitCount,
      nonResidentialUnitCount,
    );
    const textContext = normalizeText([
      parcelIntelligence.land_use,
      parcelIntelligence.property_type,
    ].filter(Boolean).join(' '));

    const hasResidentialOccupancy =
      usageClass === 'residential' ||
      (residentialUnitCount !== null && residentialUnitCount > 0) ||
      PARCEL_RESIDENTIAL_CONTEXT.test(textContext);
    const hasNonResidentialOccupancy =
      ['commercial', 'institutional', 'industrial'].includes(usageClass) ||
      (nonResidentialUnitCount !== null && nonResidentialUnitCount > 0) ||
      PARCEL_COMMERCIAL_CONTEXT.test(textContext) ||
      PARCEL_INSTITUTIONAL_CONTEXT.test(textContext) ||
      PARCEL_INDUSTRIAL_CONTEXT.test(textContext);
    const hasMixedUse =
      usageClass === 'mixed' ||
      (hasResidentialOccupancy && hasNonResidentialOccupancy);
    const hasExplicitNonResidentialContext =
      (nonResidentialUnitCount !== null && nonResidentialUnitCount > 0) ||
      PARCEL_COMMERCIAL_CONTEXT.test(textContext) ||
      PARCEL_INSTITUTIONAL_CONTEXT.test(textContext) ||
      PARCEL_INDUSTRIAL_CONTEXT.test(textContext);
    const isHighConfidenceBusinessDeny =
      !hasMixedUse &&
      !hasResidentialOccupancy &&
      (
        usageClass === 'institutional' ||
        usageClass === 'industrial' ||
        (usageClass === 'commercial' && hasExplicitNonResidentialContext)
      );
    const reasonParcelType = hasMixedUse
      ? 'mixed'
      : hasResidentialOccupancy
        ? 'residential'
        : isHighConfidenceBusinessDeny
          ? 'commercial'
          : 'unknown';
    const reasonBuildingType = hasMixedUse
      ? 'mixed_use'
      : hasResidentialOccupancy
        ? (
            residentialUnitCount !== null && residentialUnitCount > 1
              ? 'multi_unit'
              : residentialUnitCount === 1
                ? 'single_family'
                : 'unknown'
          )
        : isHighConfidenceBusinessDeny
          ? 'commercial'
          : 'unknown';
    const canUseProvider =
      isHighConfidence &&
      isFresh &&
      usageClass !== 'unknown' &&
      usageClass !== 'lodging';

    return {
      useProvider: canUseProvider,
      reasonParcelType: canUseProvider ? reasonParcelType : 'unknown',
      reasonBuildingType: canUseProvider ? reasonBuildingType : 'unknown',
      usageClass: canUseProvider ? usageClass : 'unknown',
      hasResidentialOccupancy: canUseProvider && hasResidentialOccupancy,
      hasNonResidentialOccupancy: canUseProvider && hasNonResidentialOccupancy,
      hasMixedUse: canUseProvider && hasMixedUse,
      isHighConfidenceBusinessDeny: canUseProvider && isHighConfidenceBusinessDeny,
    };
  }

  _deriveProviderParcelUsageClass(parcelIntelligence, residentialUnitCount, nonResidentialUnitCount) {
    const explicitUsage = normalizeText(parcelIntelligence.usage_class);
    const textContext = normalizeText([
      parcelIntelligence.land_use,
      parcelIntelligence.property_type,
    ].filter(Boolean).join(' '));

    if (
      residentialUnitCount !== null &&
      residentialUnitCount > 0 &&
      nonResidentialUnitCount !== null &&
      nonResidentialUnitCount > 0
    ) {
      return 'mixed';
    }

    if (['residential', 'commercial', 'industrial', 'institutional', 'mixed', 'lodging'].includes(explicitUsage)) {
      return explicitUsage;
    }

    if (/\b(mixed|mixed use|mixed-use|live\/work)\b/.test(textContext)) return 'mixed';
    if (PARCEL_INDUSTRIAL_CONTEXT.test(textContext)) return 'industrial';
    if (PARCEL_INSTITUTIONAL_CONTEXT.test(textContext)) return 'institutional';
    if (/\b(lodging|hotel|motel|resort|hospitality|guest house|rv park)\b/.test(textContext)) return 'lodging';
    if (PARCEL_COMMERCIAL_CONTEXT.test(textContext)) return 'commercial';
    if (PARCEL_RESIDENTIAL_CONTEXT.test(textContext)) return 'residential';
    if (residentialUnitCount !== null && residentialUnitCount > 0) return 'residential';
    if (nonResidentialUnitCount !== null && nonResidentialUnitCount > 0) return 'commercial';
    return 'unknown';
  }

  /**
   * Business: RDI commercial + (place or parcel commercial) + no residential signals,
   * OR lodging (hotel/motel) with no residential corroboration.
   *
   * @param {string} rdi
   * @param {string} parcelType
   * @param {string} buildingType
   * @param {boolean} hasResidentialPlace
   * @param {boolean} hasCommercialPlace
   * @param {boolean} hasInstitutionalPlace
   * @param {SmartyPostalResult} smarty
   * @param {object|null} providerBusinessSignals
   * @param {object|null} providerParcelSignals
   * @param {boolean} hasLodgingPlace
   * @returns {boolean}
   */
  _isBusiness(
    rdi,
    parcelType,
    buildingType,
    hasResidentialPlace,
    hasCommercialPlace,
    hasInstitutionalPlace,
    smarty,
    providerBusinessSignals = null,
    providerParcelSignals = null,
    hasLodgingPlace = false,
  ) {
    // CMRA is always business
    if (smarty.commercial_mailbox) return true;

    // Lodging (hotels/motels) without residential corroboration is business
    if (hasLodgingPlace && !hasResidentialPlace) return true;

    if (providerParcelSignals?.useProvider) {
      if (providerParcelSignals.hasMixedUse || providerParcelSignals.hasResidentialOccupancy) {
        return false;
      }

      if (providerParcelSignals.isHighConfidenceBusinessDeny) {
        return true;
      }
    }

    if (
      providerBusinessSignals?.useProvider &&
      !(providerParcelSignals?.useProvider && (providerParcelSignals.hasMixedUse || providerParcelSignals.hasResidentialOccupancy)) &&
      parcelType !== 'mixed' &&
      buildingType !== 'mixed_use'
    ) {
      return providerBusinessSignals.hasInstitutionalPlace || providerBusinessSignals.hasCommercialPlace;
    }

    const hasResidentialCorroboration =
      hasResidentialPlace ||
      parcelType === 'residential' ||
      buildingType === 'single_family' ||
      buildingType === 'multi_unit';

    // Preserve residential and mixed-use paths whenever those signals exist.
    if (hasResidentialCorroboration || parcelType === 'mixed' || buildingType === 'mixed_use') {
      return false;
    }

    // Institution / venue hints are strong non-home signals on their own.
    if (hasInstitutionalPlace) return true;

    // A commercial RDI with no residential signals should not be attachable as a home.
    if (rdi === 'commercial') return true;

    // Unknown RDI still needs commercial corroboration before blocking.
    return (
      rdi !== 'residential' &&
      (hasCommercialPlace || parcelType === 'commercial' || buildingType === 'commercial')
    );
  }

  _buildHeuristicPlaceSignals(placeTypes) {
    const normalizedTypes = normalizeTypes(placeTypes);
    return {
      hasResidentialPlace: normalizedTypes.some((type) => RESIDENTIAL_PLACE_TYPES.has(type)),
      hasCommercialPlace: normalizedTypes.some((type) => COMMERCIAL_PLACE_TYPES.has(type)),
      hasInstitutionalPlace: normalizedTypes.some((type) => INSTITUTIONAL_PLACE_TYPES.has(type)),
      hasLodgingPlace: normalizedTypes.some((type) => LODGING_PLACE_TYPES.has(type)),
    };
  }

  _buildProviderBusinessSignals(providerPlace, enabled) {
    if (!enabled || !providerPlace) {
      return {
        useProvider: false,
        hasResidentialPlace: false,
        hasCommercialPlace: false,
        hasInstitutionalPlace: false,
        denyTypes: [],
      };
    }

    const providerTypes = normalizeTypes([
      providerPlace.primary_type,
      ...(providerPlace.types || []),
    ]);
    const confidence = Number(providerPlace.confidence);
    const isHighConfidence = Number.isFinite(confidence) && confidence >= PROVIDER_DENY_MIN_CONFIDENCE;
    const hasResidentialPlace = providerTypes.some((type) => PROVIDER_RESIDENTIAL_SAFE_PLACE_TYPES.has(type));
    const denyCommercialTypes = providerTypes.filter((type) => PROVIDER_DENY_COMMERCIAL_PLACE_TYPES.has(type));
    const denyInstitutionalTypes = providerTypes.filter((type) => PROVIDER_DENY_INSTITUTIONAL_PLACE_TYPES.has(type));
    const denyTypes = [...new Set([...denyCommercialTypes, ...denyInstitutionalTypes])];

    return {
      useProvider: isHighConfidence && denyTypes.length > 0 && !hasResidentialPlace,
      hasResidentialPlace,
      hasCommercialPlace: denyCommercialTypes.length > 0,
      hasInstitutionalPlace: denyInstitutionalTypes.length > 0,
      denyTypes,
    };
  }

  _buildBaseReasons(rdi, parcelType, buildingType, smarty) {
    const reasons = [];
    if (rdi !== 'unknown') reasons.push(`RDI_${rdi.toUpperCase()}`);
    if (parcelType !== 'unknown') reasons.push(`PARCEL_${parcelType.toUpperCase()}`);
    if (buildingType !== 'unknown') reasons.push(`BUILDING_${buildingType.toUpperCase()}`);
    if (smarty.dpv_match_code) reasons.push(`DPV_${smarty.dpv_match_code}`);
    if (smarty.vacant_flag) reasons.push('USPS_VACANT');
    if (smarty.commercial_mailbox) reasons.push('CMRA_MAILBOX');
    return reasons;
  }

  _buildHeuristicPlaceReasons(placeSignals) {
    const reasons = [];
    if (placeSignals.hasResidentialPlace) reasons.push('PLACE_RESIDENTIAL');
    if (placeSignals.hasCommercialPlace) reasons.push('PLACE_COMMERCIAL');
    if (placeSignals.hasInstitutionalPlace) reasons.push('PLACE_INSTITUTIONAL');
    if (placeSignals.hasLodgingPlace) reasons.push('PLACE_LODGING');
    return reasons;
  }

  _buildProviderBusinessReasons(providerSignals) {
    const reasons = [];
    if (providerSignals.hasCommercialPlace) reasons.push('PLACE_COMMERCIAL');
    if (providerSignals.hasInstitutionalPlace) reasons.push('PLACE_INSTITUTIONAL');
    return reasons;
  }

  _buildBusinessPlaceReasons(heuristicPlaceSignals, providerSignals) {
    if (providerSignals?.useProvider) {
      const reasons = this._buildProviderBusinessReasons(providerSignals);
      if (heuristicPlaceSignals.hasLodgingPlace) reasons.push('PLACE_LODGING');
      return reasons;
    }

    const reasons = [];
    if (heuristicPlaceSignals.hasCommercialPlace) reasons.push('PLACE_COMMERCIAL');
    if (heuristicPlaceSignals.hasInstitutionalPlace) reasons.push('PLACE_INSTITUTIONAL');
    if (heuristicPlaceSignals.hasLodgingPlace) reasons.push('PLACE_LODGING');
    return reasons;
  }

  /**
   * Mixed use: parcel is mixed, or RDI unknown with both residential + commercial signals.
   *
   * @param {string} rdi
   * @param {string} parcelType
   * @param {string} buildingType
   * @param {boolean} hasResidentialPlace
   * @param {boolean} hasCommercialPlace
   * @param {boolean} hasInstitutionalPlace
   * @param {object} providerBusinessSignals
   * @param {object} providerParcelSignals
   * @returns {boolean}
   */
  _isMixedUse(
    rdi,
    parcelType,
    buildingType,
    hasResidentialPlace,
    hasCommercialPlace,
    hasInstitutionalPlace,
    providerBusinessSignals = null,
    providerParcelSignals = null,
  ) {
    if (providerParcelSignals?.useProvider) {
      if (providerParcelSignals.hasMixedUse) return true;

      if (
        providerParcelSignals.hasResidentialOccupancy &&
        (
          providerBusinessSignals?.useProvider ||
          hasCommercialPlace ||
          hasInstitutionalPlace ||
          rdi === 'commercial'
        )
      ) {
        return true;
      }
    }

    if (parcelType === 'mixed') return true;
    if (buildingType === 'mixed_use') return true;

    // Ambiguous: RDI unknown and place signals point both ways
    if (rdi === 'unknown' && hasResidentialPlace && (hasCommercialPlace || hasInstitutionalPlace)) return true;

    // RDI residential but strong commercial place signals
    if (rdi === 'residential' && (hasCommercialPlace || hasInstitutionalPlace) && hasResidentialPlace) return true;

    // If Smarty says commercial but we still see residential signals, treat it as mixed/ambiguous.
    if (
      rdi === 'commercial' &&
      (
        hasResidentialPlace ||
        parcelType === 'residential' ||
        buildingType === 'single_family' ||
        buildingType === 'multi_unit'
      )
    ) {
      return true;
    }

    return false;
  }

  /**
   * @param {string} granularity
   * @returns {boolean}
   */
  _isLowGranularity(granularity) {
    return LOW_GRANULARITY.has(granularity);
  }

  // ── Confidence scoring ─────────────────────────────────────────

  /**
   * Calculate confidence (0.0-1.0) based on how many signals agree.
   *
   * @param {GoogleValidationResult} google
   * @param {SmartyPostalResult} smarty
   * @param {string} granularity
   * @returns {number}
   */
  _computeConfidence(google, smarty, granularity) {
    let score = 0.5; // baseline

    // DPV Y is a strong positive
    if (smarty.dpv_match_code === 'Y') score += 0.25;
    else if (smarty.dpv_match_code === 'D') score += 0.1;

    // RDI known is a positive
    if (smarty.rdi_type === 'residential') score += 0.1;
    else if (smarty.rdi_type === 'commercial') score += 0.05;

    // Google granularity bonus
    if (granularity === 'PREMISE' || granularity === 'SUB_PREMISE') score += 0.1;
    else if (granularity === 'ROOFTOP') score += 0.1;

    // Google verdict quality
    if (google?.verdict && !google.verdict.hasUnconfirmedComponents) score += 0.05;
    if (google?.verdict?.hasReplacedComponents) score -= 0.1;
    if (google?.verdict?.hasInferredComponents) score -= 0.1;

    // Vacant penalty
    if (smarty.vacant_flag) score -= 0.15;

    return this._clamp(score);
  }

  // ── Helpers ────────────────────────────────────────────────────

  /**
   * Clamp a value to [0, 1].
   * @param {number} v
   * @returns {number}
   */
  _clamp(v) {
    return Math.round(Math.max(0, Math.min(1, v)) * 100) / 100;
  }

  /**
   * Build a DeliverabilityResult from a SmartyPostalResult.
   *
   * @param {SmartyPostalResult} smarty
   * @returns {import('./types').DeliverabilityResult}
   */
  _buildDeliverability(smarty) {
    return {
      dpv_match_code: smarty.dpv_match_code || '',
      rdi_type: smarty.rdi_type || 'unknown',
      missing_secondary: smarty.missing_secondary || false,
      commercial_mailbox: smarty.commercial_mailbox || false,
      vacant_flag: smarty.vacant_flag || false,
      footnotes: smarty.footnotes || [],
    };
  }

  _buildVerdictClassification(place, parcelType, buildingType) {
    return {
      google_place_types: Array.isArray(place?.google_place_types)
        ? place.google_place_types
        : [],
      parcel_type: parcelType || place?.parcel_type || 'unknown',
      building_type: buildingType || place?.building_type || 'unknown',
    };
  }

  /**
   * Construct a full AddressVerdict.
   *
   * @param {object} fields
   * @returns {AddressVerdict}
   */
  _verdict(fields) {
    return {
      status: fields.status,
      reasons: fields.reasons || [],
      confidence: fields.confidence ?? 0,
      normalized: fields.normalized,
      deliverability: fields.deliverability,
      classification: fields.classification,
      candidates: fields.candidates || [],
      next_actions: fields.next_actions || [],
      existing_household: fields.existing_household,
    };
  }
}

module.exports = new AddressDecisionEngine();
