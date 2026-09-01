const supabaseAdmin = require('../../config/supabaseAdmin');
const addressConfig = require('../../config/addressVerification');
const { computeAddressHash } = require('../../utils/normalizeAddress');
const logger = require('../../utils/logger');
const googleProvider = require('./googleProvider');
const smartyProvider = require('./smartyProvider');
const placeClassificationProvider = require('./placeClassificationProvider');
const secondaryAddressProvider = require('./secondaryAddressProvider');
const parcelIntelProvider = require('./parcelIntelProvider');
const { comparePlaceClassifications } = require('./placeShadowComparison');
const { compareParcelIntelligence } = require('./parcelShadowComparison');
const decisionEngine = require('./addressDecisionEngine');
const canonicalAddressService = require('./canonicalAddressService');
const addressVerificationObservability = require('./addressVerificationObservability');

const COMMERCIAL_LINE1_KEYWORDS = /\b(tower|towers|plaza|center|centre|building|bldg|complex|mall|atrium|pavilion|professional\s+(?:building|center|centre|park)|office|offices|warehouse|showroom|clinic|medical|hospital|bank|store|shop|salon)\b/i;
const COMMERCIAL_LINE2_KEYWORDS = /\b(suite|ste|floor|fl|office|rm|room)\b/i;
const RESIDENTIAL_LINE1_KEYWORDS = /\b(apartment|condo|townhouse|mobile home|trailer|rv park)\b/i;
const RESIDENTIAL_LINE2_KEYWORDS = /\b(apt|apartment|unit|condo|lot|space)\b/i;
const STREET_SUFFIXES = new Set([
  'street', 'st',
  'avenue', 'ave',
  'boulevard', 'blvd',
  'drive', 'dr',
  'alley', 'aly',
  'bend',
  'crossing', 'xing',
  'lane', 'ln',
  'pass',
  'road', 'rd',
  'ridge', 'rdg',
  'run',
  'square', 'sq',
  'court', 'ct',
  'place', 'pl',
  'circle', 'cir',
  'way',
  'parkway', 'pkwy',
  'terrace', 'ter',
  'trail', 'trl',
  'highway', 'hwy',
  'loop',
]);
const INSTITUTIONAL_PATTERNS = [
  { type: 'school', regex: /\b(?:elementary|middle|high|charter|prep(?:aratory)?|academy)\s+school\b/i },
  { type: 'school', regex: /\bschool\s+district\b/i },
  { type: 'university', regex: /\b(?:university|college|campus)\b/i },
  { type: 'stadium', regex: /\b(?:stadium|arena|coliseum|amphithe(?:a)?ter)\b/i },
  { type: 'government_office', regex: /\b(?:city hall|courthouse|police station|fire station|government center|municipal building|county office)\b/i },
  { type: 'event_venue', regex: /\b(?:convention center|civic center|community center|recreation center|sports complex|event center|performing arts center)\b/i },
  { type: 'library', regex: /\blibrary\b/i },
  { type: 'museum', regex: /\bmuseum\b/i },
  { type: 'airport', regex: /\b(?:airport|terminal)\b/i },
  { type: 'church', regex: /\b(?:church|temple|mosque|synagogue)\b/i },
];

function componentText(component) {
  if (!component) return '';
  if (typeof component === 'string') return component;
  if (typeof component.text === 'string') return component.text;
  return component.componentName?.text || '';
}

function stripLeadingStreetNumber(text) {
  return (text || '').replace(/^\s*\d+[a-z]?(?:-\d+)?\s+/i, '').trim();
}

function countNonNumericWords(text) {
  return (text || '')
    .split(/\s+/)
    .map((part) => part.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ''))
    .filter((part) => /[a-z]/i.test(part))
    .length;
}

function looksLikeStreetName(text) {
  const cleaned = stripLeadingStreetNumber(text)
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!cleaned) return false;

  const words = cleaned.split(' ');
  const lastWord = words[words.length - 1];
  return STREET_SUFFIXES.has(lastWord);
}

function inferInstitutionalPlaceTypes(text) {
  const cleaned = stripLeadingStreetNumber(text);
  if (!cleaned || looksLikeStreetName(cleaned)) return [];
  if (countNonNumericWords(cleaned) < 2) return [];

  const matches = [];
  for (const pattern of INSTITUTIONAL_PATTERNS) {
    if (pattern.regex.test(cleaned)) matches.push(pattern.type);
  }
  return [...new Set(matches)];
}

function derivePlaceClassification(input, google, smarty) {
  const line1 = (google?.normalized?.line1 || input?.line1 || '').trim();
  const line2 = (google?.normalized?.line2 || input?.line2 || '').trim();
  const strippedLine1 = stripLeadingStreetNumber(line1);
  const line1LooksLikeStreetName = looksLikeStreetName(line1);
  const routeText =
    componentText(google?.components?.route) ||
    stripLeadingStreetNumber(line1);
  const institutionalTypes = [
    ...inferInstitutionalPlaceTypes(input?.line1 || ''),
    ...inferInstitutionalPlaceTypes(input?.line2 || ''),
    ...inferInstitutionalPlaceTypes(routeText),
  ];
  const hasInstitutionalHint = institutionalTypes.length > 0;

  const hasCommercialHint = (!line1LooksLikeStreetName && COMMERCIAL_LINE1_KEYWORDS.test(strippedLine1))
    || COMMERCIAL_LINE2_KEYWORDS.test(line2);
  const hasResidentialHint = (!line1LooksLikeStreetName && RESIDENTIAL_LINE1_KEYWORDS.test(strippedLine1))
    || RESIDENTIAL_LINE2_KEYWORDS.test(line2);

  const googlePlaceTypes = [];
  if (hasResidentialHint || smarty?.rdi_type === 'residential') googlePlaceTypes.push('premise');
  if (line2 && RESIDENTIAL_LINE2_KEYWORDS.test(line2)) googlePlaceTypes.push('subpremise');
  if (hasCommercialHint || smarty?.rdi_type === 'commercial' || smarty?.commercial_mailbox) {
    googlePlaceTypes.push('store', 'establishment');
  }
  if (hasInstitutionalHint) {
    googlePlaceTypes.push(...institutionalTypes, 'establishment');
  }

  let parcelType = 'unknown';
  if (smarty?.commercial_mailbox) {
    parcelType = 'commercial';
  } else if ((hasCommercialHint || hasInstitutionalHint || smarty?.rdi_type === 'commercial') && (hasResidentialHint || smarty?.rdi_type === 'residential')) {
    parcelType = 'mixed';
  } else if (hasCommercialHint || hasInstitutionalHint || smarty?.rdi_type === 'commercial') {
    parcelType = 'commercial';
  } else if (hasResidentialHint || smarty?.rdi_type === 'residential') {
    parcelType = 'residential';
  }

  let buildingType = 'unknown';
  if (parcelType === 'mixed') {
    buildingType = 'mixed_use';
  } else if (parcelType === 'commercial') {
    buildingType = 'commercial';
  } else if (smarty?.missing_secondary || smarty?.dpv_match_code === 'S') {
    buildingType = 'multi_unit';
  } else if (parcelType === 'residential') {
    buildingType = line2 ? 'multi_unit' : 'single_family';
  }

  return {
    google_place_types: [...new Set(googlePlaceTypes)],
    parcel_type: parcelType,
    building_type: buildingType,
  };
}

function uniqueStrings(values) {
  return Array.isArray(values) ? [...new Set(values)] : [];
}

function sameStringSet(left, right) {
  const leftValues = uniqueStrings(left);
  const rightValues = uniqueStrings(right);
  if (leftValues.length !== rightValues.length) return false;

  const rightSet = new Set(rightValues);
  return leftValues.every((value) => rightSet.has(value));
}

function buildStoredDecisionInputs(address) {
  const raw = address?.validation_raw_response || {};
  const geocodeGranularity = address?.geocode_granularity || address?.google_granularity || null;
  const storedHeuristicPlace = raw?.heuristic_place || {};
  const topLevelPlaceTypes = uniqueStrings(address?.google_place_types);
  const topLevelProviderTypes = uniqueStrings(address?.provider_place_types);
  const rawProviderTypes = uniqueStrings(raw?.place_provider?.types);
  const heuristicPlaceTypes = Array.isArray(storedHeuristicPlace?.google_place_types)
    ? uniqueStrings(storedHeuristicPlace.google_place_types)
    : (topLevelProviderTypes.length > 0 && sameStringSet(topLevelPlaceTypes, topLevelProviderTypes))
      // Older shadow rows briefly reused google_place_types for provider data.
      // Treat those rows as "heuristic types unknown" rather than silently
      // reconstructing heuristic classification from provider-only evidence.
      ? []
      : topLevelPlaceTypes;

  const smarty = address ? {
    inconclusive: false,
    dpv_match_code: raw.dpv_match_code || address.dpv_match_code || '',
    rdi_type: raw.rdi_type || address.rdi_type || 'unknown',
    missing_secondary: raw.missing_secondary ?? address.missing_secondary_flag ?? false,
    commercial_mailbox: raw.commercial_mailbox ?? address.commercial_mailbox_flag ?? false,
    vacant_flag: raw.vacant_flag || false,
    footnotes: raw.footnotes || [],
  } : null;

  const google = geocodeGranularity ? {
    normalized: {
      line1: address.address_line1_norm,
      line2: address.address_line2_norm,
      city: address.city_norm,
      state: address.state,
      zip: address.postal_code,
      lat: address.geocode_lat,
      lng: address.geocode_lng,
    },
    granularity: geocodeGranularity,
    missing_component_types: address.missing_secondary_flag ? ['subpremise'] : [],
    verdict: address.google_verdict || {},
  } : null;

  const place = address ? {
    google_place_types: heuristicPlaceTypes,
    parcel_type: storedHeuristicPlace?.parcel_type || address.parcel_type || 'unknown',
    building_type: storedHeuristicPlace?.building_type || address.building_type || 'unknown',
  } : null;

  const hasProviderPlace = !!(
    address?.google_place_id
    || address?.google_place_primary_type
    || address?.google_business_status
    || address?.google_place_name
    || (Array.isArray(address?.provider_place_types) && address.provider_place_types.length > 0)
    || raw?.place_provider
  );

  const provider_place = hasProviderPlace ? {
    provider: raw?.place_provider?.provider || null,
    provider_version: raw?.place_provider?.provider_version || null,
    place_id: address.google_place_id || raw?.place_provider?.place_id || null,
    primary_type: address.google_place_primary_type || raw?.place_provider?.primary_type || null,
    types: topLevelProviderTypes.length > 0
      ? topLevelProviderTypes
      : rawProviderTypes.length > 0
        ? rawProviderTypes
        : topLevelPlaceTypes,
    business_status: address.google_business_status || raw?.place_provider?.business_status || null,
    display_name: address.google_place_name || raw?.place_provider?.display_name || null,
    confidence: raw?.place_provider?.confidence ?? null,
    is_named_poi: raw?.place_provider?.is_named_poi ?? null,
    lookup_mode: raw?.place_provider?.lookup_mode || null,
    verification_level: address.verification_level || raw?.place_provider?.verification_level || null,
    risk_flags: address.risk_flags || raw?.place_provider?.risk_flags || [],
    validated_at: address.last_place_validated_at || raw?.place_provider?.validated_at || null,
  } : null;

  const hasUnitIntelligence = !!(
    address?.secondary_required != null
    || address?.unit_count_estimate != null
    || address?.unit_intelligence_confidence != null
    || address?.last_secondary_validated_at
    || raw?.secondary_provider
  );

  const unit_intelligence = hasUnitIntelligence ? {
    provider: raw?.secondary_provider?.provider
      || address?.provider_versions?.secondary_address?.provider
      || null,
    provider_version: raw?.secondary_provider?.provider_version
      || address?.provider_versions?.secondary_address?.version
      || null,
    secondary_required: address?.secondary_required ?? raw?.secondary_provider?.secondary_required ?? null,
    unit_count_estimate: address?.unit_count_estimate ?? raw?.secondary_provider?.unit_count_estimate ?? null,
    confidence: address?.unit_intelligence_confidence ?? raw?.secondary_provider?.confidence ?? null,
    submitted_unit_known: raw?.secondary_provider?.submitted_unit_known ?? null,
    submitted_unit_evaluated: raw?.secondary_provider?.submitted_unit_evaluated ?? null,
    lookup_mode: raw?.secondary_provider?.lookup_mode || null,
    verification_level: raw?.secondary_provider?.verification_level || null,
    validated_at: address?.last_secondary_validated_at || raw?.secondary_provider?.validated_at || null,
  } : null;

  const hasParcelIntel = !!(
    address?.parcel_provider
    || address?.parcel_id
    || address?.parcel_land_use
    || address?.parcel_property_type
    || address?.parcel_confidence != null
    || address?.building_count != null
    || address?.residential_unit_count != null
    || address?.non_residential_unit_count != null
    || address?.usage_class
    || address?.last_parcel_validated_at
    || raw?.parcel_provider
  );

  const parcel_intel = hasParcelIntel ? {
    provider: address?.parcel_provider
      || raw?.parcel_provider?.provider
      || address?.provider_versions?.parcel_intel?.provider
      || null,
    provider_version: raw?.parcel_provider?.provider_version
      || address?.provider_versions?.parcel_intel?.version
      || null,
    parcel_id: address?.parcel_id || raw?.parcel_provider?.parcel_id || null,
    land_use: address?.parcel_land_use || raw?.parcel_provider?.land_use || null,
    property_type: address?.parcel_property_type || raw?.parcel_provider?.property_type || null,
    building_count: address?.building_count ?? raw?.parcel_provider?.building_count ?? null,
    residential_unit_count: address?.residential_unit_count ?? raw?.parcel_provider?.residential_unit_count ?? null,
    non_residential_unit_count: address?.non_residential_unit_count ?? raw?.parcel_provider?.non_residential_unit_count ?? null,
    usage_class: address?.usage_class || raw?.parcel_provider?.usage_class || 'unknown',
    confidence: address?.parcel_confidence ?? raw?.parcel_provider?.confidence ?? null,
    lookup_mode: raw?.parcel_provider?.lookup_mode || null,
    from_cache: raw?.parcel_provider?.from_cache === true,
    validated_at: address?.last_parcel_validated_at || raw?.parcel_provider?.validated_at || null,
  } : null;

  return { google, smarty, place, provider_place, unit_intelligence, parcel_intel };
}

async function lookupExistingHouseholdByHash(addressHash) {
  if (!addressHash) return null;

  const homeIds = new Set();

  const { data: homesByHash } = await supabaseAdmin
    .from('Home')
    .select('id')
    .eq('address_hash', addressHash)
    .limit(20);

  for (const row of homesByHash || []) homeIds.add(row.id);

  const { data: address } = await supabaseAdmin
    .from('HomeAddress')
    .select('id')
    .eq('address_hash', addressHash)
    .maybeSingle();

  if (address?.id) {
    const { data: homesByAddressId } = await supabaseAdmin
      .from('Home')
      .select('id')
      .eq('address_id', address.id)
      .limit(20);

    for (const row of homesByAddressId || []) homeIds.add(row.id);
  }

  if (homeIds.size === 0) return null;

  const ids = Array.from(homeIds);
  const { data: occupancies } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('home_id, role_base')
    .in('home_id', ids)
    .eq('is_active', true);

  if (!occupancies || occupancies.length === 0) return null;

  return {
    home_id: occupancies[0].home_id,
    member_count: occupancies.length,
    active_roles: [...new Set(occupancies.map((row) => row.role_base).filter(Boolean))],
  };
}

async function runValidationPipeline(input, options = {}) {
  const {
    includeHousehold = true,
    auditContext = {},
  } = options;
  const trigger = auditContext.trigger || 'unknown';
  const providerCalls = [];
  const shadowComparisons = [];

  function pushProviderCall({
    provider,
    status,
    startedAt = null,
    latency_ms = null,
    reasons = [],
    from_cache = null,
    lookup_mode = null,
    selectively_invoked = null,
    details = {},
  }) {
    providerCalls.push({
      provider,
      status,
      trigger,
      latency_ms: latency_ms != null ? latency_ms : (startedAt != null ? Date.now() - startedAt : 0),
      reasons,
      from_cache,
      lookup_mode,
      selectively_invoked,
      details,
    });
  }

  let googleResult = null;
  if (googleProvider.isAvailable()) {
    const googleStartedAt = Date.now();
    try {
      googleResult = await googleProvider.validate(input);
      pushProviderCall({
        provider: 'google_address_validation',
        status: googleResult?.normalized ? 'ok' : 'empty_or_failed',
        startedAt: googleStartedAt,
        details: {
          normalized: !!googleResult?.normalized,
          granularity: googleResult?.granularity || null,
          place_id_present: !!googleResult?.place_id,
        },
      });
    } catch (error) {
      logger.warn('pipelineService.runValidationPipeline: google validation failed', {
        error: error.message,
      });
      pushProviderCall({
        provider: 'google_address_validation',
        status: 'error',
        startedAt: googleStartedAt,
        reasons: [error.message],
        details: {
          normalized: false,
        },
      });
    }
  } else {
    pushProviderCall({
      provider: 'google_address_validation',
      status: 'unavailable',
      reasons: ['provider_unavailable'],
      details: {
        normalized: false,
      },
    });
  }

  let smartyResult = null;
  if (smartyProvider.isAvailable() && googleResult?.normalized) {
    const smartyStartedAt = Date.now();
    try {
      smartyResult = await smartyProvider.verify(googleResult.normalized);
      pushProviderCall({
        provider: 'smarty_postal',
        status: smartyResult?.inconclusive ? 'inconclusive' : 'ok',
        startedAt: smartyStartedAt,
        from_cache: smartyResult?.from_cache === true,
        details: {
          dpv_match_code: smartyResult?.dpv_match_code || '',
          rdi_type: smartyResult?.rdi_type || 'unknown',
          missing_secondary: smartyResult?.missing_secondary === true,
          commercial_mailbox: smartyResult?.commercial_mailbox === true,
        },
      });
    } catch (error) {
      logger.warn('pipelineService.runValidationPipeline: smarty verification failed', {
        error: error.message,
      });
      smartyResult = {
        from_cache: false,
        inconclusive: true,
        dpv_match_code: '',
        rdi_type: 'unknown',
        missing_secondary: false,
        commercial_mailbox: false,
        vacant_flag: false,
        footnotes: [],
      };
      pushProviderCall({
        provider: 'smarty_postal',
        status: 'error',
        startedAt: smartyStartedAt,
        reasons: [error.message],
        from_cache: false,
        details: {
          inconclusive: true,
        },
      });
    }
  } else if (!smartyProvider.isAvailable()) {
    pushProviderCall({
      provider: 'smarty_postal',
      status: 'unavailable',
      reasons: ['provider_unavailable'],
      from_cache: false,
    });
  } else {
    pushProviderCall({
      provider: 'smarty_postal',
      status: 'skipped_no_normalized_address',
      from_cache: false,
    });
  }

  const place = derivePlaceClassification(input, googleResult, smartyResult);
  let providerPlace = null;
  let providerComparison = null;
  if (placeClassificationProvider.shouldRunShadowLookup()) {
    const placeStartedAt = Date.now();
    try {
      providerPlace = await placeClassificationProvider.classify({
        placeId: googleResult?.place_id || null,
        normalizedAddress: googleResult?.normalized || null,
        lat: googleResult?.geocode?.lat || null,
        lng: googleResult?.geocode?.lng || null,
      });
      pushProviderCall({
        provider: 'google_places',
        status: providerPlace ? 'ok' : 'empty_or_failed',
        startedAt: placeStartedAt,
        lookup_mode: providerPlace?.lookup_mode || null,
        details: {
          place_id: providerPlace?.place_id || null,
          primary_type: providerPlace?.primary_type || null,
          confidence: providerPlace?.confidence ?? null,
        },
      });
    } catch (error) {
      logger.warn('pipelineService.runValidationPipeline: shadow place classification failed', {
        error: error.message,
      });
      pushProviderCall({
        provider: 'google_places',
        status: 'error',
        startedAt: placeStartedAt,
        reasons: [error.message],
      });
    }

    providerComparison = comparePlaceClassifications(place, providerPlace);
    shadowComparisons.push({
      source: 'place',
      provider: 'google_places',
      provider_status: providerPlace ? 'ok' : 'empty_or_failed',
      selectively_invoked: true,
      disagrees: providerComparison.disagrees,
      disagreement_reasons: providerComparison.disagreement_reasons,
      heuristic: providerComparison.heuristic,
      provider_comparison: providerComparison.provider,
      overlap_types: providerComparison.overlap_types,
      trigger,
    });
  }

  let unitIntelligence = null;
  const shouldRunSecondaryLookup = secondaryAddressProvider.shouldRunLookup({
    input,
    normalizedAddress: googleResult?.normalized || null,
    submittedUnit: googleResult?.normalized?.line2 || input?.line2 || null,
    google: googleResult,
    smarty: smartyResult,
    place,
    providerPlace,
  });
  if (shouldRunSecondaryLookup) {
    const secondaryStartedAt = Date.now();
    try {
      unitIntelligence = await secondaryAddressProvider.lookup({
        input,
        normalizedAddress: googleResult?.normalized || null,
        submittedUnit: googleResult?.normalized?.line2 || input?.line2 || null,
        google: googleResult,
        smarty: smartyResult,
        place,
        providerPlace,
      });
      pushProviderCall({
        provider: 'secondary_address',
        status: unitIntelligence ? 'ok' : 'empty_or_failed',
        startedAt: secondaryStartedAt,
        lookup_mode: unitIntelligence?.lookup_mode || null,
        selectively_invoked: true,
        details: {
          secondary_required: unitIntelligence?.secondary_required ?? null,
          unit_count_estimate: unitIntelligence?.unit_count_estimate ?? null,
          confidence: unitIntelligence?.confidence ?? null,
          submitted_unit_evaluated: unitIntelligence?.submitted_unit_evaluated ?? null,
        },
      });
    } catch (error) {
      logger.warn('pipelineService.runValidationPipeline: secondary address lookup failed', {
        error: error.message,
      });
      pushProviderCall({
        provider: 'secondary_address',
        status: 'error',
        startedAt: secondaryStartedAt,
        reasons: [error.message],
        selectively_invoked: true,
      });
    }
  } else if (addressConfig.rollout.enableSecondaryProvider) {
    pushProviderCall({
      provider: 'secondary_address',
      status: 'not_invoked',
      selectively_invoked: false,
    });
  }

  let parcelIntel = null;
  let parcelComparison = null;
  const shouldRunParcelLookup = parcelIntelProvider.shouldRunLookup({
    input,
    normalizedAddress: googleResult?.normalized || null,
    google: googleResult,
    smarty: smartyResult,
    place,
    providerPlace,
    unitIntelligence,
  });

  if (shouldRunParcelLookup) {
    const parcelStartedAt = Date.now();
    try {
      parcelIntel = await parcelIntelProvider.lookup({
        input,
        normalizedAddress: googleResult?.normalized || null,
        google: googleResult,
        smarty: smartyResult,
        place,
        providerPlace,
        unitIntelligence,
      });
      pushProviderCall({
        provider: parcelIntel?.provider || addressConfig.parcelIntel.provider || 'parcel_intel',
        status: parcelIntel
          ? (parcelIntel.from_cache ? 'cached' : 'ok')
          : 'empty_or_failed',
        startedAt: parcelStartedAt,
        from_cache: parcelIntel?.from_cache === true,
        lookup_mode: parcelIntel?.lookup_mode || null,
        selectively_invoked: true,
        details: {
          parcel_id: parcelIntel?.parcel_id || null,
          usage_class: parcelIntel?.usage_class || null,
          confidence: parcelIntel?.confidence ?? null,
        },
      });
    } catch (error) {
      logger.warn('pipelineService.runValidationPipeline: parcel enrichment failed', {
        error: error.message,
      });
      pushProviderCall({
        provider: addressConfig.parcelIntel.provider || 'parcel_intel',
        status: 'error',
        startedAt: parcelStartedAt,
        reasons: [error.message],
        selectively_invoked: true,
      });
    }

    parcelComparison = compareParcelIntelligence(place, providerPlace, parcelIntel);
    shadowComparisons.push({
      source: 'parcel',
      provider: parcelIntel?.provider || addressConfig.parcelIntel.provider || null,
      provider_status: parcelIntel
        ? (parcelIntel.from_cache ? 'cached' : 'ok')
        : 'empty_or_failed',
      selectively_invoked: shouldRunParcelLookup,
      disagrees: parcelComparison.disagrees,
      disagreement_reasons: parcelComparison.disagreement_reasons,
      heuristic: parcelComparison.heuristic,
      provider_comparison: parcelComparison.parcel,
      overlap_types: [],
      trigger,
    });
  } else if (addressConfig.rollout.enableParcelProvider) {
    pushProviderCall({
      provider: addressConfig.parcelIntel.provider || 'parcel_intel',
      status: 'not_invoked',
      from_cache: false,
      selectively_invoked: false,
    });
  }

  const addressHash = googleResult?.normalized
    ? computeAddressHash(
        googleResult.normalized.line1,
        googleResult.normalized.line2 || '',
        googleResult.normalized.city,
        googleResult.normalized.state,
        googleResult.normalized.zip,
      )
    : null;

  // Also compute a hash from the raw user input so we can find homes that
  // were created before the Google-normalization pipeline existed.
  const inputHash = (input?.line1 && input?.city && input?.state)
    ? computeAddressHash(
        input.line1,
        input.line2 || '',
        input.city,
        input.state,
        input.zip || '',
      )
    : null;

  let household = null;
  if (includeHousehold) {
    if (addressHash) {
      household = await lookupExistingHouseholdByHash(addressHash);
    }
    // Fallback: try the raw-input hash when it differs from the canonical hash
    if (!household && inputHash && inputHash !== addressHash) {
      household = await lookupExistingHouseholdByHash(inputHash);
    }
  }

  const verdict = decisionEngine.classify({
    google: googleResult,
    smarty: smartyResult,
    place,
    provider_place: providerPlace,
    use_provider_place_for_business: addressConfig.rollout.enforcePlaceProviderBusiness,
    unit_intelligence: unitIntelligence,
    use_provider_unit_intelligence: addressConfig.rollout.enableSecondaryProvider,
    parcel_intel: parcelIntel,
    use_provider_parcel_for_classification: addressConfig.rollout.enforceParcelProviderClassification,
    provider_parcel_max_age_days: addressConfig.parcelIntel.cacheDays,
    household,
  });

  let canonicalAddress = null;
  if (googleResult?.normalized) {
    const { data } = await canonicalAddressService.findOrCreate(
      googleResult.normalized,
      {
        google: googleResult,
        smarty: smartyResult,
        place,
        providerPlace,
        unitIntelligence,
        parcelIntel,
      },
    );
    canonicalAddress = data || null;
  }
  await addressVerificationObservability.recordPipelineAudit({
    addressId: canonicalAddress?.id || null,
    providerCalls,
    shadowComparisons,
    verdict,
    trigger,
  });

  return {
    verdict,
    address_id: canonicalAddress?.id || null,
    canonical_address: canonicalAddress,
    place,
    provider_place: providerPlace,
    unit_intelligence: unitIntelligence,
    parcel_intel: parcelIntel,
    provider_consensus: providerComparison,
  };
}

module.exports = {
  derivePlaceClassification,
  buildStoredDecisionInputs,
  lookupExistingHouseholdByHash,
  runValidationPipeline,
};
