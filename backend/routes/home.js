const express = require('express');
const { getRolloutFlag } = require('../utils/addressRolloutFlags');
const router = express.Router();
const crypto = require('crypto');
const supabaseAdmin = require('../config/supabaseAdmin');
const addressConfig = require('../config/addressVerification');
const householdClaimConfig = require('../config/householdClaims');
const verifyToken = require('../middleware/verifyToken');
const { homeOutboundLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');
const { computeAddressHash } = require('../utils/normalizeAddress');
const homePostcardService = require('../services/homePostcardService');
const homeAuthorityService = require('../services/homeAuthorityService');
const homeListService = require('../services/homeListService');
const homeCreateService = require('../services/homeCreateService');
const homeDetailService = require('../services/homeDetailService');
const homeResidencyService = require('../services/homeResidencyService');
const homeResidencyReviewService = require('../services/homeResidencyReviewService');
const homeInvitationService = require('../services/homeInvitationService');
const homeAccessSecretService = require('../services/homeAccessSecretService');
const homeRecordService = require('../services/homeRecordService');
const { getRequestSessionScope, requireExpectedSessionScope } = require('../utils/requestSessionScope');
const {
  checkHomePermission,
  mapLegacyRole,
  writeAuditLog,
  applyOccupancyTemplate,
  getActiveOccupancy,
  assertCanMutateTarget,
} = require('../utils/homePermissions');
const { HOME_DOCUMENT_VISIBILITIES, HOME_DOCUMENT_TYPES, homeDocumentVisibilities, serializeHomeDocument } = require('../utils/homeDocumentAccess');
const homeClaimMergeService = require('../services/homeClaimMergeService');
const homeClaimRoutingService = require('../services/homeClaimRoutingService');
const propertySuggestionsService = require('../services/ai/propertySuggestionsService');
const { shouldBlockCoordinateOverwrite, stripCoordinateFields } = require('../utils/verifiedCoordinateGuard');
const { encodeGeohash } = require('../utils/geohash');
const { HOME_ISSUE_LIST, HOME_BILL_LIST, HOME_PACKAGE_LIST } = require('../utils/columns');
const {
  pipelineService,
  AddressVerdictStatus,
  addressDecisionEngine,
  googleProvider,
  smartyProvider,
} = require('../services/addressValidation');
const addressVerificationObservability = require('../services/addressValidation/addressVerificationObservability');
const { redactStreet, queryKnowsNumber } = require('../utils/addressRedaction');
const { serializeHomeForViewer, serializeOwnerForViewer } = require('../serializers/homeProfileSerializer');

// Public previews still use this flag-aware personal claim predicate. It does
// not grant shared detail access or expose an owner/occupant identity.
function isPendingOwnershipClaimForReadPath(claim) {
  if (!claim) return false;
  return householdClaimConfig.flags.v2ReadPaths
    ? homeClaimRoutingService.isClaimActiveRecord(claim)
    : homeClaimRoutingService.isLegacyStateActive(claim.state);
}

// ============ VALIDATION SCHEMAS ============

const HOME_TYPES = ['house', 'apartment', 'condo', 'townhouse', 'studio', 'rv', 'mobile_home', 'trailer', 'multi_unit', 'other'];
const VISIBILITY_TYPES = ['private', 'members', 'public_preview'];

const createHomeSchema = Joi.object({
  request_id: Joi.string().uuid().optional(),
  // --- Required location fields ---
  address: Joi.string().min(5).max(255).required(),
  unit_number: Joi.string().max(50).optional().allow('', null),
  address_id: Joi.string().uuid().optional().allow(null),
  city: Joi.string().min(2).max(100).required(),
  state: Joi.string().min(2).max(50).required(),
  zip_code: Joi.string().min(3).max(20).optional(),
  zipcode: Joi.string().min(3).max(20).optional(),
  country: Joi.string().min(2).max(80).optional(),

  // Coordinates — top-level or nested
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required()
  }).optional(),

  // --- Home profile fields ---
  name: Joi.string().max(120).optional().allow('', null),
  home_type: Joi.string().valid(...HOME_TYPES).optional(),
  bedrooms: Joi.number().integer().min(0).max(99).optional().allow(null),
  bathrooms: Joi.number().min(0).max(99).optional().allow(null),
  sq_ft: Joi.number().integer().min(0).optional().allow(null),
  square_feet: Joi.number().integer().min(0).optional().allow(null), // alias
  lot_sq_ft: Joi.number().integer().min(0).optional().allow(null),
  year_built: Joi.number().integer().min(1600).max(2100).optional().allow(null),
  move_in_date: Joi.string().optional().allow('', null),
  is_owner: Joi.boolean().optional(),
  // "My home doesn't have a unit number" — clears the MISSING_UNIT refusal
  // only; see the gate in POST / for what it does and does not relax.
  no_unit_attestation: Joi.boolean().optional(),
  role: Joi.string().valid('owner', 'renter', 'household', 'property_manager', 'guest').optional(),
  description: Joi.string().max(2000).optional().allow('', null),
  entry_instructions: Joi.string().max(2000).optional().allow('', null),
  parking_instructions: Joi.string().max(2000).optional().allow('', null),
  visibility: Joi.string().valid(...VISIBILITY_TYPES).optional(),
  amenities: Joi.object().optional(),

  // Optional setup is committed atomically with the Home and its creator.
  access_secrets: Joi.array().max(20).items(Joi.object({
    access_type: Joi.string().valid('wifi', 'door_code', 'gate_code', 'lockbox', 'garage', 'alarm', 'other').required(),
    label: Joi.string().max(200).required(),
    secret_value: Joi.string().max(2048).required(),
    notes: Joi.string().max(4000).allow('', null).optional(),
    visibility: Joi.string().valid(...HOME_DOCUMENT_VISIBILITIES).optional(),
  })).optional(),
  wifi_name: Joi.string().max(200).optional().allow('', null),
  wifi_password: Joi.string().max(200).optional().allow('', null),

  /** Full ATTOM /property/detail bundle from property-suggestions — stored under Home.niche_data */
  attom_property_detail: Joi.object().unknown(true).optional().allow(null),
}).custom((value, helpers) => {
  if (value.role && value.is_owner !== undefined && value.is_owner !== (value.role === 'owner')) {
    return helpers.message({ custom: 'Choose one consistent relationship to this Home.' });
  }

  // Require zip
  if (!value.zip_code && !value.zipcode) {
    return helpers.message({ custom: 'zip_code or zipcode is required' });
  }

  // Require coordinates either in location or in latitude/longitude
  const hasNested = value.location && Number.isFinite(value.location.latitude) && Number.isFinite(value.location.longitude);
  const hasTop = Number.isFinite(value.latitude) && Number.isFinite(value.longitude);
  if (!hasNested && !hasTop) {
    return helpers.message({ custom: 'latitude and longitude are required (as top-level numbers or nested location object)' });
  }

  return value;
}, 'zip + coords required');

const updateHomeSchema = Joi.object({
  address: Joi.string().min(5).max(255),
  unit_number: Joi.string().max(50).allow('', null),
  city: Joi.string().min(2).max(100),
  state: Joi.string().min(2).max(50),
  zip_code: Joi.string().min(3).max(20),
  country: Joi.string().min(2).max(80),
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required()
  }),
  name: Joi.string().max(120).allow('', null),
  home_type: Joi.string().valid(...HOME_TYPES),
  bedrooms: Joi.number().integer().min(0).max(99).allow(null),
  bathrooms: Joi.number().min(0).max(99).allow(null),
  sq_ft: Joi.number().integer().min(0).allow(null),
  lot_sq_ft: Joi.number().integer().min(0).allow(null),
  year_built: Joi.number().integer().min(1600).max(2100).allow(null),
  move_in_date: Joi.string().allow('', null),
  is_owner: Joi.boolean(),
  description: Joi.string().max(2000).allow('', null),
  entry_instructions: Joi.string().max(2000).allow('', null),
  parking_instructions: Joi.string().max(2000).allow('', null),
  visibility: Joi.string().valid(...VISIBILITY_TYPES),
  amenities: Joi.object(),
}).min(1);

const attachDetachSchema = Joi.object({
  userId: Joi.string().uuid().required()
});

const requestHouseholdFromOwnerSchema = Joi.object({
  requested_identity: Joi.string().valid('owner', 'resident', 'household_member', 'guest').default('owner'),
});

const homeDataSchema = Joi.object({
  type: Joi.string().min(1).max(100).required(),
  data: Joi.object().required()
});

// ============ HELPER FUNCTIONS ============

/**
 * Format location for PostGIS
 */
const formatLocationForDB = (latitude, longitude) => {
  return `POINT(${longitude} ${latitude})`;
};

/**
 * Parse PostGIS point to coordinates
 */
const parsePostGISPoint = require('../utils/parsePostGISPoint');

const ALLOWED_HOME_VERDICT_STATUSES = new Set([
  AddressVerdictStatus.OK,
  AddressVerdictStatus.MIXED_USE,
]);
const STEP_UP_ELIGIBLE_HOME_VERDICT_STATUSES = new Set([
  AddressVerdictStatus.MIXED_USE,
  AddressVerdictStatus.LOW_CONFIDENCE,
]);
const STEP_UP_LOW_CONFIDENCE_REASONS = new Set([
  'GEOCODE_GRANULARITY_ROUTE',
  'GEOCODE_GRANULARITY_OTHER',
  'GEOCODE_GRANULARITY_APPROXIMATE',
  'GEOCODE_GRANULARITY_GEOMETRIC_CENTER',
  'GEOCODE_GRANULARITY_RANGE_INTERPOLATED',
  'GEOCODE_GRANULARITY_BLOCK',
]);

function getHomeValidationError(verdict) {
  const status = verdict?.status || AddressVerdictStatus.SERVICE_ERROR;

  if (status === AddressVerdictStatus.MISSING_UNIT) {
    return {
      error: 'A unit or apartment number is required for this address.',
      code: 'ADDRESS_MISSING_UNIT',
      message: 'Please add your unit number and try again.',
    };
  }

  // SCN-04: PO_BOX, MISSING_STREET_NUMBER and UNVERIFIED_STREET_NUMBER had no
  // handler here and fell through to ADDRESS_VALIDATION_UNAVAILABLE — telling
  // the user verification was "temporarily unavailable, try again in a moment"
  // for an address that would never pass, however many times they retried.
  if (status === AddressVerdictStatus.PO_BOX) {
    return {
      error: 'A PO Box cannot be used as a home address.',
      code: 'ADDRESS_PO_BOX',
      message: 'Please enter the street address where you live.',
    };
  }

  if (status === AddressVerdictStatus.MISSING_STREET_NUMBER) {
    return {
      error: 'This address is missing a street number.',
      code: 'ADDRESS_MISSING_STREET_NUMBER',
      message: 'Please include the street number and try again.',
    };
  }

  if (status === AddressVerdictStatus.UNVERIFIED_STREET_NUMBER) {
    return {
      error: 'We could not confirm that street number on this street.',
      code: 'ADDRESS_UNVERIFIED_STREET_NUMBER',
      message: 'Please double-check the street number and try again.',
    };
  }

  if (status === AddressVerdictStatus.MIXED_USE) {
    return {
      error: 'This building has both homes and businesses.',
      code: 'ADDRESS_STEP_UP_REQUIRED',
      message: 'We need to confirm you live here before adding this home.',
    };
  }

  if (status === AddressVerdictStatus.BUSINESS) {
    return {
      error: 'This address appears to be a business or office location, not a home.',
      code: 'ADDRESS_NOT_HOME',
      message: 'Use a residential home address or create a business profile instead.',
    };
  }

  if (status === AddressVerdictStatus.UNDELIVERABLE) {
    return {
      error: 'This address could not be verified as deliverable.',
      code: 'ADDRESS_UNDELIVERABLE',
      message: 'Check the address for typos or use a different address.',
    };
  }

  if (status === AddressVerdictStatus.CONFLICT) {
    return {
      error: 'This address already has an active household on Pantopus.',
      code: 'ADDRESS_CONFLICT',
      message: 'Join or claim the existing home instead of creating a duplicate.',
    };
  }

  if (status === AddressVerdictStatus.LOW_CONFIDENCE) {
    return {
      error: 'This address could not be verified with enough confidence.',
      code: 'ADDRESS_LOW_CONFIDENCE',
      message: 'Use a more precise address or turn on current location and try again.',
    };
  }

  if (status === AddressVerdictStatus.MULTIPLE_MATCHES) {
    return {
      error: 'This address matched multiple locations.',
      code: 'ADDRESS_AMBIGUOUS',
      message: 'Choose a more specific address, including unit information if needed.',
    };
  }

  return {
    error: 'Address verification is temporarily unavailable.',
    code: 'ADDRESS_VALIDATION_UNAVAILABLE',
    message: 'Please try again in a moment.',
  };
}

function valuesEqualNormalized(left, right) {
  return (left || '').toString().trim().toLowerCase() === (right || '').toString().trim().toLowerCase();
}

function matchesCanonicalAddress(canonicalAddress, input) {
  if (!canonicalAddress) return false;

  return (
    valuesEqualNormalized(input.line1, canonicalAddress.address_line1_norm) &&
    valuesEqualNormalized(input.line2 || '', canonicalAddress.address_line2_norm || '') &&
    valuesEqualNormalized(input.city, canonicalAddress.city_norm) &&
    valuesEqualNormalized(input.state, canonicalAddress.state) &&
    valuesEqualNormalized(input.zip, canonicalAddress.postal_code)
  );
}

function isFreshTimestamp(value, maxAgeDays) {
  if (!value) return false;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;

  const maxAge = Number.isFinite(Number(maxAgeDays)) && Number(maxAgeDays) > 0
    ? Number(maxAgeDays)
    : 0;
  if (!maxAge) return false;

  const maxAgeMs = maxAge * 24 * 60 * 60 * 1000;
  return (Date.now() - parsed.getTime()) <= maxAgeMs;
}

function buildOutageUnavailableError(hasAddressId) {
  return {
    statusCode: 503,
    body: {
      error: 'Address verification is temporarily unavailable.',
      code: 'ADDRESS_VALIDATION_UNAVAILABLE',
      message: hasAddressId
        ? 'Please go back and re-confirm this address once verification is available again.'
        : 'Please verify your address again once verification is available.',
      fallback_reason: 'provider_unavailable',
    },
  };
}

function buildOutageRevalidationError(message, fallbackReason, extras = {}) {
  return {
    statusCode: 422,
    body: {
      error: 'Address must be revalidated before creating a home.',
      code: 'ADDRESS_REVALIDATION_REQUIRED',
      message,
      fallback_reason: fallbackReason,
      ...extras,
    },
  };
}

function isApprovedLowConfidenceStepUpCase(verdict) {
  if (verdict?.status !== AddressVerdictStatus.LOW_CONFIDENCE) {
    return false;
  }

  const reasons = Array.isArray(verdict?.reasons) ? verdict.reasons : [];
  return reasons.some((reason) => STEP_UP_LOW_CONFIDENCE_REASONS.has(reason));
}

function getCreateHomeStepUpPolicy(verdict) {
  if (!verdict) return null;

  if (
    verdict.status === AddressVerdictStatus.MIXED_USE &&
    getRolloutFlag('enforceMixedUseStepUp')
  ) {
    return {
      policy: 'mixed_use',
      message: 'This address needs mail verification before creating a home.',
    };
  }

  if (
    verdict.status === AddressVerdictStatus.LOW_CONFIDENCE &&
    getRolloutFlag('enforceLowConfidenceStepUp') &&
    isApprovedLowConfidenceStepUpCase(verdict)
  ) {
    return {
      policy: 'low_confidence',
      message: 'This address needs stronger address verification before creating a home.',
    };
  }

  return null;
}

async function findVerifiedAddressStepUp(userId, addressId) {
  if (!userId || !addressId) return null;

  const { data, error } = await supabaseAdmin
    .from('AddressVerificationAttempt')
    .select('id, updated_at, created_at')
    .eq('user_id', userId)
    .eq('address_id', addressId)
    .eq('method', 'mail_code')
    .eq('status', 'verified');

  if (error) {
    throw homeCreateService.failure();
  }

  const attempts = Array.isArray(data) ? data : data ? [data] : [];
  if (attempts.length === 0) return null;

  const freshAttempts = attempts.filter((attempt) => (
    isFreshTimestamp(
      attempt.updated_at || attempt.created_at,
      addressConfig.mailVerification.stepUpMaxAgeDays,
    )
  ));

  if (freshAttempts.length === 0) {
    return null;
  }

  return freshAttempts
    .slice()
    .sort((left, right) => {
      const leftTime = new Date(left.updated_at || left.created_at || 0).getTime();
      const rightTime = new Date(right.updated_at || right.created_at || 0).getTime();
      return rightTime - leftTime;
    })[0];
}

function buildStepUpRequiredError(verdict, addressId, stepUpPolicy) {
  return {
    statusCode: 422,
    body: {
      error: 'Address must complete step-up verification before creating a home.',
      code: 'ADDRESS_STEP_UP_REQUIRED',
      message: stepUpPolicy?.message || 'Complete address verification for this address, then try again.',
      step_up_reason: stepUpPolicy?.policy || 'verification_required',
      step_up_method: 'mail_code',
      address_id: addressId || null,
      verdict_status: verdict?.status || AddressVerdictStatus.SERVICE_ERROR,
      reasons: verdict?.reasons || [],
      next_actions: verdict?.next_actions || [],
    },
  };
}

async function recordCreateHomeOutcomeSafe(outcome) {
  try {
    await addressVerificationObservability.recordCreateHomeOutcome(outcome);
  } catch (error) {
    logger.warn('Failed to record create-home observability event', {
      error: error.message,
      outcome: outcome?.outcome || 'unknown',
      code: outcome?.code || null,
    });
  }
}

function isMultiUnitAddress(addressRecord, homes = []) {
  if (addressRecord) {
    return (
      addressRecord.place_type === 'unit' ||
      addressRecord.place_type === 'building' ||
      addressRecord.building_type === 'multi_unit' ||
      !!addressRecord.missing_secondary_flag
    );
  }

  return homes.some((home) => !!(home.address2 || '').trim());
}

function homeMatchesAddressByFields(home, addressHash, country = 'US') {
  if (!home?.address || !home?.city || !home?.state || !home?.zipcode) return false;

  return computeAddressHash(
    home.address,
    home.address2 || '',
    home.city,
    home.state,
    home.zipcode,
    country,
  ) === addressHash;
}

// A failed lookup must never invite someone to create a duplicate Home.
async function readHomeAddressLookup(query, validateData) {
  const result = await query;
  if (!result || result.error || !validateData(result.data)) {
    throw new Error('HOME_ADDRESS_LOOKUP_UNAVAILABLE');
  }
  return result.data;
}

const lookupId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const lookupAddress = row => row === null || (row && lookupId(row.id) && typeof row.address_hash === 'string');
const lookupHomes = rows => Array.isArray(rows) && rows.every(row => row && lookupId(row.id)
  && ['address', 'city', 'state', 'zipcode'].every(key => typeof row[key] === 'string' && row[key].trim()));

/**
 * Check if user is owner or occupant
 */
// NOTE: All server routes use supabaseAdmin (service_role) exclusively (BUG 7A fix).
// The anon client is not imported — RLS is bypassed server-side, and authorization
// is handled by checkHomePermission() from ../utils/homePermissions.

// ============ ROUTES ============

const checkAddressSchema = Joi.object({
  address_id: Joi.string().uuid().optional().allow(null),
  address: Joi.string().min(5).max(255).required(),
  unit_number: Joi.string().max(50).optional().allow('', null),
  city: Joi.string().min(2).max(100).required(),
  state: Joi.string().min(2).max(50).required(),
  zip_code: Joi.string().min(3).max(20).required(),
  country: Joi.string().min(2).max(80).optional(),
});

const propertySuggestionsSchema = Joi.object({
  address: Joi.string().min(3).max(255).required(),
  unit_number: Joi.string().max(50).optional().allow('', null),
  city: Joi.string().min(2).max(100).required(),
  state: Joi.string().min(2).max(50).required(),
  zip_code: Joi.string().min(3).max(20).required(),
  address_id: Joi.string().uuid().optional().allow(null),
  classification: Joi.object({
    google_place_types: Joi.array().items(Joi.string()).optional(),
    parcel_type: Joi.string().optional(),
    building_type: Joi.string().optional(),
  }).optional(),
});

/**
 * POST /api/homes/property-suggestions
 * Tiered hints for Add Home step 2: ATTOM → heuristics → optional LLM (PROPERTY_SUGGESTIONS_LLM=1).
 */
router.post('/property-suggestions', verifyToken, homeOutboundLimiter, validate(propertySuggestionsSchema), async (req, res) => {
  try {
    const result = await propertySuggestionsService.getPropertySuggestions(req.body, supabaseAdmin);
    res.json(result);
  } catch (err) {
    logger.error('property-suggestions error', { error: err.message });
    res.status(500).json({ error: 'Failed to load property suggestions' });
  }
});

/**
 * POST /api/homes/check-address
 * Check if an address already exists and whether it has verified members.
 * Returns status only — never reveals member identities, counts, or roles.
 */
router.post('/check-address', verifyToken, validate(checkAddressSchema), async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const { address_id, address, unit_number, city, state, zip_code, country } = req.body;
    const countryVal = country || 'US';
    const requestedAddressHash = computeAddressHash(address, unit_number, city, state, zip_code, countryVal);

    let existingAddress = null;
    let addressHash = requestedAddressHash;

    if (address_id) {
      const data = await readHomeAddressLookup(supabaseAdmin
        .from('HomeAddress')
        .select('id, address_hash, place_type, building_type, missing_secondary_flag')
        .eq('id', address_id)
        .maybeSingle(), lookupAddress);
      existingAddress = data || null;
      addressHash = existingAddress?.address_hash || requestedAddressHash;
    }

    if (!existingAddress) {
      const data = await readHomeAddressLookup(supabaseAdmin
        .from('HomeAddress')
        .select('id, address_hash, place_type, building_type, missing_secondary_flag')
        .eq('address_hash', addressHash)
        .maybeSingle(), lookupAddress);
      existingAddress = data || null;
    }

    const matchedHomeMap = new Map();
    const rememberHomes = (homes = []) => {
      for (const home of homes) {
        if (home?.id) matchedHomeMap.set(home.id, home);
      }
    };

    if (existingAddress?.id) {
      const homesByAddressId = await readHomeAddressLookup(supabaseAdmin
        .from('Home')
        .select('id, address, address2, city, state, zipcode, country, name, address_id, address_hash')
        .eq('address_id', existingAddress.id)
        .eq('home_status', 'active')
        .limit(20), lookupHomes);
      rememberHomes(homesByAddressId || []);
    }

    // Search homes by canonical hash
    const homesByHash = await readHomeAddressLookup(supabaseAdmin
      .from('Home')
      .select('id, address, address2, city, state, zipcode, country, name, address_id, address_hash')
      .eq('address_hash', addressHash)
      .eq('home_status', 'active')
      .limit(20), lookupHomes);
    rememberHomes(homesByHash || []);

    // Also search by the original user-input hash when it differs from the
    // canonical (Google-normalized) hash.  Homes created before the address-
    // validation pipeline was added may have been hashed from raw user input.
    if (requestedAddressHash !== addressHash) {
      const homesByRequestedHash = await readHomeAddressLookup(supabaseAdmin
        .from('Home')
        .select('id, address, address2, city, state, zipcode, country, name, address_id, address_hash')
        .eq('address_hash', requestedAddressHash)
        .eq('home_status', 'active')
        .limit(20), lookupHomes);
      rememberHomes(homesByRequestedHash || []);
    }

    if (matchedHomeMap.size === 0) {
      const nearbyHomes = await readHomeAddressLookup(supabaseAdmin
        .from('Home')
        .select('id, address, address2, city, state, zipcode, country, name, address_id, address_hash')
        .eq('zipcode', zip_code.trim())
        .eq('home_status', 'active')
        .limit(100), lookupHomes);

      const normalizedMatches = (nearbyHomes || []).filter((home) =>
        homeMatchesAddressByFields(home, addressHash, countryVal) ||
        homeMatchesAddressByFields(home, requestedAddressHash, countryVal)
      );
      rememberHomes(normalizedMatches);
    }

    const matchedHomes = Array.from(matchedHomeMap.values());

    if (matchedHomes.length === 0) {
      return res.json({
        status: 'HOME_NOT_FOUND',
        is_multi_unit: isMultiUnitAddress(existingAddress),
      });
    }

    // Check if any of these homes have active occupants
    const homeIds = matchedHomes.map(h => h.id);
    const activeOccupancies = await readHomeAddressLookup(supabaseAdmin
      .from('HomeOccupancy')
      .select('home_id')
      .in('home_id', homeIds)
      .eq('is_active', true)
      .limit(1), rows => Array.isArray(rows) && rows.every(row => row && lookupId(row.home_id)));

    const isClaimed = activeOccupancies && activeOccupancies.length > 0;
    const firstHome = matchedHomes[0];
    const formattedAddress = [
      firstHome.address,
      firstHome.address2,
      firstHome.city,
      firstHome.state,
      firstHome.zipcode,
    ].filter(Boolean).join(', ');

    res.json({
      status: isClaimed ? 'HOME_FOUND_CLAIMED' : 'HOME_FOUND_UNCLAIMED',
      home_id: firstHome.id,
      is_multi_unit: isMultiUnitAddress(existingAddress, matchedHomes),
      formatted_address: formattedAddress,
      residency_address: { line1: firstHome.address, line2: firstHome.address2 || '',
        city: firstHome.city, state: firstHome.state, postal_code: firstHome.zipcode, country: firstHome.country ?? 'US' },
    });
  } catch (err) {
    logger.error('Address check unavailable', { code: 'HOME_ADDRESS_LOOKUP_UNAVAILABLE' });
    res.status(503).json({
      error: 'Could not check this Home. Please try again.',
      code: 'HOME_ADDRESS_LOOKUP_UNAVAILABLE',
      retryable: true,
    });
  }
});

/**
 * POST /api/homes
 * Create a new home
 */
async function prepareHomeCreate(req) {
    const {
      address, unit_number, address_id: requestedAddressId, city, state, zip_code, zipcode, country,
      latitude, longitude, location,
      name, home_type, bedrooms, bathrooms, sq_ft, square_feet, lot_sq_ft,
      year_built, move_in_date, role,
      description, entry_instructions, parking_instructions,
      visibility, amenities,
      attom_property_detail,
    } = req.body;
    const userId = req.user.id;
    const is_owner = role === 'owner' || (!role && req.body.is_owner === true);


    let normalizedZip = (zip_code || zipcode || '').toString();

    const clientCoords = location
      ? { latitude: location.latitude, longitude: location.longitude }
      : { latitude, longitude };

    const countryVal = country || 'US';

    if (getRolloutFlag('requireAddressIdForHomeCreate') && !requestedAddressId) {
      await recordCreateHomeOutcomeSafe({
        address_id: null,
        outcome: 'blocked',
        code: 'ADDRESS_VALIDATION_REQUIRED',
        status_code: 422,
        validation_path: 'address_id_required',
        message: 'Address must be validated before creating a home.',
      });
      throw homeCreateService.refusal(422, {
        error: 'Address must be validated before creating a home.',
        code: 'ADDRESS_VALIDATION_REQUIRED',
        message: 'Validate the address first, then try creating the home again.',
      });
    }

    let canonicalAddress = null;
    if (requestedAddressId) {
      const { data, error } = await supabaseAdmin
        .from('HomeAddress')
        .select('*')
        .eq('id', requestedAddressId)
        .maybeSingle();
      if (error) throw homeCreateService.failure();
      canonicalAddress = data || null;

      if (!canonicalAddress) {
        await recordCreateHomeOutcomeSafe({
          address_id: requestedAddressId,
          outcome: 'blocked',
          code: 'ADDRESS_VALIDATION_REQUIRED',
          status_code: 422,
          validation_path: 'requested_address_id',
          message: 'Address must be revalidated before creating a home.',
        });
        throw homeCreateService.refusal(422, {
          error: 'Address must be revalidated before creating a home.',
          code: 'ADDRESS_VALIDATION_REQUIRED',
        });
      }
    }

    const canRunLiveValidation = googleProvider.isAvailable() && smartyProvider.isAvailable();
    let addressVerdict = null;
    let createHomeValidationPath = canRunLiveValidation ? 'live_provider' : 'provider_unavailable';
    const requestAddressInput = {
      line1: address,
      line2: unit_number || '',
      city,
      state,
      zip: normalizedZip,
    };

    if (canRunLiveValidation) {
      const validationResult = await pipelineService.runValidationPipeline({
        line1: address,
        line2: unit_number || undefined,
        city,
        state,
        zip: normalizedZip,
        country: countryVal,
      }, {
        auditContext: { trigger: 'create_home' },
      });

      addressVerdict = validationResult.verdict;
      canonicalAddress = validationResult.canonical_address || null;

      if (requestedAddressId && validationResult.address_id && requestedAddressId !== validationResult.address_id) {
        await recordCreateHomeOutcomeSafe({
          address_id: requestedAddressId,
          outcome: 'blocked',
          verdict_status: validationResult.verdict.status,
          reasons: validationResult.verdict.reasons || [],
          code: 'ADDRESS_VALIDATION_MISMATCH',
          status_code: 422,
          validation_path: createHomeValidationPath,
          message: 'Address changed after validation. Please confirm the address again.',
        });
        throw homeCreateService.refusal(422, {
          error: 'Address changed after validation. Please confirm the address again.',
          code: 'ADDRESS_VALIDATION_MISMATCH',
          verdict_status: validationResult.verdict.status,
        });
      }
    } else if (addressConfig.outageFallback.enabled) {
      createHomeValidationPath = 'outage_cached_validation';
      if (!requestedAddressId) {
        const outageError = buildOutageUnavailableError(false);
        await recordCreateHomeOutcomeSafe({
          address_id: null,
          outcome: 'blocked',
          code: outageError.body.code,
          status_code: outageError.statusCode,
          validation_path: createHomeValidationPath,
          fallback_reason: outageError.body.fallback_reason,
          message: outageError.body.message,
        });
        throw homeCreateService.refusal(outageError.statusCode, outageError.body);
      }

      if (!matchesCanonicalAddress(canonicalAddress, requestAddressInput)) {
        const mismatchError = buildOutageRevalidationError(
          'This request no longer matches the validated address. Please revalidate once address verification is available again.',
          'canonical_mismatch',
        );
        await recordCreateHomeOutcomeSafe({
          address_id: requestedAddressId,
          outcome: 'blocked',
          code: mismatchError.body.code,
          status_code: mismatchError.statusCode,
          validation_path: createHomeValidationPath,
          fallback_reason: mismatchError.body.fallback_reason,
          message: mismatchError.body.message,
        });
        throw homeCreateService.refusal(mismatchError.statusCode, mismatchError.body);
      }

      if (!(canonicalAddress?.last_validated_at && canonicalAddress?.validation_raw_response)) {
        const missingValidationError = buildOutageRevalidationError(
          'Cached address verification is unavailable for this address. Please revalidate once verification is available again.',
          'missing_cached_validation',
        );
        await recordCreateHomeOutcomeSafe({
          address_id: requestedAddressId,
          outcome: 'blocked',
          code: missingValidationError.body.code,
          status_code: missingValidationError.statusCode,
          validation_path: createHomeValidationPath,
          fallback_reason: missingValidationError.body.fallback_reason,
          message: missingValidationError.body.message,
        });
        throw homeCreateService.refusal(missingValidationError.statusCode, missingValidationError.body);
      }

      if (!isFreshTimestamp(canonicalAddress.last_validated_at, addressConfig.outageFallback.maxValidationAgeDays)) {
        const staleValidationError = buildOutageRevalidationError(
          'Cached address verification is too old to reuse. Please revalidate once verification is available again.',
          'stale_cached_validation',
        );
        await recordCreateHomeOutcomeSafe({
          address_id: requestedAddressId,
          outcome: 'blocked',
          code: staleValidationError.body.code,
          status_code: staleValidationError.statusCode,
          validation_path: createHomeValidationPath,
          fallback_reason: staleValidationError.body.fallback_reason,
          message: staleValidationError.body.message,
        });
        throw homeCreateService.refusal(staleValidationError.statusCode, staleValidationError.body);
      }

      const storedInputs = pipelineService.buildStoredDecisionInputs(canonicalAddress);
      addressVerdict = addressDecisionEngine.classify({
        ...storedInputs,
        use_provider_place_for_business: getRolloutFlag('enforcePlaceProviderBusiness'),
        use_provider_unit_intelligence: getRolloutFlag('enableSecondaryProvider'),
        use_provider_parcel_for_classification: getRolloutFlag('enforceParcelProviderClassification'),
        provider_parcel_max_age_days: addressConfig.parcelIntel.cacheDays,
      });

      const fallbackConfidence = Number(addressVerdict?.confidence);
      const isSafeCachedAllow =
        addressVerdict?.status === AddressVerdictStatus.OK &&
        Number.isFinite(fallbackConfidence) &&
        fallbackConfidence >= addressConfig.outageFallback.minConfidence;

      if (!isSafeCachedAllow) {
        const unsafeFallbackError = buildOutageRevalidationError(
          'Cached address verification is not strong enough to reuse while verification is unavailable.',
          'unsafe_cached_validation',
          {
            verdict_status: addressVerdict?.status || AddressVerdictStatus.SERVICE_ERROR,
            reasons: addressVerdict?.reasons || [],
          },
        );
        await recordCreateHomeOutcomeSafe({
          address_id: requestedAddressId,
          outcome: 'blocked',
          verdict_status: addressVerdict?.status || AddressVerdictStatus.SERVICE_ERROR,
          reasons: addressVerdict?.reasons || [],
          code: unsafeFallbackError.body.code,
          status_code: unsafeFallbackError.statusCode,
          validation_path: createHomeValidationPath,
          fallback_reason: unsafeFallbackError.body.fallback_reason,
          message: unsafeFallbackError.body.message,
        });
        throw homeCreateService.refusal(unsafeFallbackError.statusCode, unsafeFallbackError.body);
      }

      logger.warn('Address providers unavailable; allowing createHome from safe cached canonical validation', {
        userId,
        addressId: requestedAddressId,
        verdictStatus: addressVerdict.status,
        confidence: addressVerdict.confidence,
      });
    } else if (canonicalAddress?.last_validated_at && canonicalAddress?.validation_raw_response) {
      createHomeValidationPath = 'stored_canonical_validation';
      const storedInputs = pipelineService.buildStoredDecisionInputs(canonicalAddress);
      addressVerdict = addressDecisionEngine.classify({
        ...storedInputs,
        use_provider_place_for_business: getRolloutFlag('enforcePlaceProviderBusiness'),
        use_provider_unit_intelligence: getRolloutFlag('enableSecondaryProvider'),
        use_provider_parcel_for_classification: getRolloutFlag('enforceParcelProviderClassification'),
        provider_parcel_max_age_days: addressConfig.parcelIntel.cacheDays,
      });
    } else if (
      requestedAddressId &&
      canonicalAddress &&
      matchesCanonicalAddress(canonicalAddress, requestAddressInput)
    ) {
      createHomeValidationPath = 'canonical_confirmed_without_revalidation';
      logger.warn('Address providers unavailable; allowing createHome from previously confirmed canonical address', {
        userId,
        addressId: requestedAddressId,
      });
    } else {
      const outageError = buildOutageUnavailableError(!!requestedAddressId);
      await recordCreateHomeOutcomeSafe({
        address_id: requestedAddressId || null,
        outcome: 'blocked',
        code: outageError.body.code,
        status_code: outageError.statusCode,
        validation_path: createHomeValidationPath,
        fallback_reason: outageError.body.fallback_reason,
        message: outageError.body.message,
      });
      throw homeCreateService.refusal(outageError.statusCode, outageError.body);
    }

    const stepUpPolicy = getCreateHomeStepUpPolicy(addressVerdict);
    let verifiedCreateStepUp = null;
    if (stepUpPolicy) {
      const canonicalAddressId = canonicalAddress?.id || requestedAddressId || null;
      const verifiedStepUp = await findVerifiedAddressStepUp(userId, canonicalAddressId);
      verifiedCreateStepUp = verifiedStepUp;

      if (!verifiedStepUp) {
        const gateError = buildStepUpRequiredError(addressVerdict, canonicalAddressId, stepUpPolicy);
        await recordCreateHomeOutcomeSafe({
          address_id: canonicalAddressId,
          outcome: 'blocked',
          verdict_status: addressVerdict?.status || AddressVerdictStatus.SERVICE_ERROR,
          reasons: addressVerdict?.reasons || [],
          code: gateError.body.code,
          status_code: gateError.statusCode,
          validation_path: createHomeValidationPath,
          step_up_reason: gateError.body.step_up_reason,
          message: gateError.body.message,
        });
        throw homeCreateService.refusal(gateError.statusCode, gateError.body);
      }

      logger.info('Allowing createHome after completed address step-up verification', {
        userId,
        addressId: canonicalAddressId,
        verificationAttemptId: verifiedStepUp.id,
        verdictStatus: addressVerdict.status,
        stepUpPolicy: stepUpPolicy.policy,
      });
    }

    const allowCreateAfterStepUp = !!(
      stepUpPolicy
      && STEP_UP_ELIGIBLE_HOME_VERDICT_STATUSES.has(addressVerdict?.status)
    );

    // SCN-10: MISSING_UNIT fires when USPS expects a secondary the submitted
    // address lacks — which is also what a basement, rear, ADU or split-duplex
    // address looks like, since USPS does not list those units. Those residents
    // had no way out: the wizard asked for a unit, accepted one, and asked
    // again. An explicit attestation ("my home doesn't have a unit number")
    // clears exactly this rung and nothing else — deliverability, BUSINESS,
    // CONFLICT and the rest still refuse — and it only relaxes address
    // granularity, not residency: mail verification and household conflict
    // still gate everything the address unlocks. The attestation is recorded
    // in the create outcome so review can find serial attesters.
    const allowCreateWithNoUnitAttestation = !!(
      req.body.no_unit_attestation === true
      && addressVerdict?.status === AddressVerdictStatus.MISSING_UNIT
    );

    if (
      addressVerdict &&
      !allowCreateAfterStepUp &&
      !allowCreateWithNoUnitAttestation &&
      !ALLOWED_HOME_VERDICT_STATUSES.has(addressVerdict.status)
    ) {
      const problem = getHomeValidationError(addressVerdict);
      const statusCode =
        addressVerdict.status === AddressVerdictStatus.SERVICE_ERROR
          ? 503
          : addressVerdict.status === AddressVerdictStatus.CONFLICT
            ? 409
            : 422;
      await recordCreateHomeOutcomeSafe({
        address_id: canonicalAddress?.id || requestedAddressId || null,
        outcome: 'blocked',
        verdict_status: addressVerdict.status,
        reasons: addressVerdict.reasons || [],
        code: problem.code,
        status_code: statusCode,
        validation_path: createHomeValidationPath,
        message: problem.message,
      });

      throw homeCreateService.refusal(statusCode, {
        ...problem,
        verdict_status: addressVerdict.status,
        reasons: addressVerdict.reasons || [],
      });
    }

    // Failed canonical persistence cannot authorize an unbound Home.
    if (!canonicalAddress?.id) throw homeCreateService.failure();

    const normalizedLine1 = canonicalAddress?.address_line1_norm || address;
    const normalizedLine2 = canonicalAddress?.address_line2_norm ?? (unit_number || null);
    const normalizedCity = canonicalAddress?.city_norm || city;
    const normalizedState = canonicalAddress?.state || state;
    normalizedZip = canonicalAddress?.postal_code || normalizedZip;

    const coords = (canonicalAddress &&
      Number.isFinite(canonicalAddress.geocode_lat) &&
      Number.isFinite(canonicalAddress.geocode_lng))
      ? { latitude: canonicalAddress.geocode_lat, longitude: canonicalAddress.geocode_lng }
      : clientCoords;

    const { computeAddressHash } = require('../utils/normalizeAddress');
    const addressHash = canonicalAddress?.address_hash ||
      computeAddressHash(normalizedLine1, normalizedLine2 || '', normalizedCity, normalizedState, normalizedZip, countryVal);

    // Guest cannot create a canonical home — they must attach to an existing one
    if (role === 'guest') {
      await recordCreateHomeOutcomeSafe({
        address_id: canonicalAddress?.id || requestedAddressId || null,
        outcome: 'blocked',
        verdict_status: addressVerdict?.status || null,
        reasons: addressVerdict?.reasons || [],
        code: 'GUEST_CANNOT_CREATE_HOME',
        status_code: 400,
        validation_path: createHomeValidationPath,
        message: 'Guests cannot create a new home. Ask a resident, owner, or property manager to set it up first, or choose a different role.',
      });
      throw homeCreateService.refusal(400, {
        error: 'Guests cannot create a new home. Ask a resident, owner, or property manager to set it up first, or choose a different role.',
        code: 'GUEST_CANNOT_CREATE_HOME',
      });
    }

    const homeData = {
      address: normalizedLine1,
      address2: normalizedLine2,
      city: normalizedCity,
      state: normalizedState,
      zipcode: normalizedZip,
      country: countryVal,
      address_hash: addressHash,
      address_id: canonicalAddress?.id || requestedAddressId || null,
      // owner_id is NEVER set from the request. checkHomePermission treats
      // Home.owner_id === userId as full ownership - every permission, plus
      // 'ownership.manage', which is what reviews ownership claims - so
      // setting it here from a self-asserted boolean handed the caller
      // verified-owner powers (including approving their own claim) at any
      // address they typed, before any deed was ever uploaded. The pointer is
      // written by the two claim-approval paths (routes/admin.js,
      // routes/homeOwnership.js review) when owner_status becomes 'verified',
      // which is what spec §7.1 ("prevents instant unverified ownership")
      // requires. Until then the creator holds the pending_doc occupancy
      // created below, exactly like a renter-creator holds provisional access.
      owner_id: null,
      name: name || null,
      home_type: home_type || 'house',
      bedrooms: bedrooms != null ? bedrooms : null,
      bathrooms: bathrooms != null ? bathrooms : null,
      sq_ft: (sq_ft != null ? sq_ft : square_feet != null ? square_feet : null),
      lot_sq_ft: lot_sq_ft != null ? lot_sq_ft : null,
      year_built: year_built != null ? year_built : null,
      move_in_date: move_in_date || null,
      is_owner: is_owner != null ? is_owner : false,
      description: description || null,
      entry_instructions: entry_instructions || null,
      parking_instructions: parking_instructions || null,
      visibility: visibility || 'private',
      amenities: amenities || {},
      // Ownership identity columns
      created_by_user_id: userId,
      tenure_mode: is_owner ? 'owner_occupied' : (role === 'renter' ? 'rental' : 'unknown'),
      security_state: 'normal',
      owner_claim_policy: 'open',
      member_attach_policy: 'open_invite',
      privacy_mask_level: 'normal',
      ownership_state: is_owner ? 'claim_pending' : 'unclaimed',
      ...(attom_property_detail && typeof attom_property_detail === 'object'
        ? { niche_data: { attom_property_detail } }
        : {}),
    };

    // Add location if provided.
    //
    // Provenance is decided by where the coordinates actually came from, not
    // by what the request claims. This used to stamp geocode_mode 'verified'
    // (with a body-controlled provider and accuracy) even when `coords` fell
    // back to the client's own latitude/longitude — and because
    // shouldBlockCoordinateOverwrite protects 'verified' rows from later
    // correction, the fake stamp locked the self-asserted pin in. A
    // client-supplied pin is 'user_asserted', exactly as PATCH records it,
    // and the reverse-geocode job (Home.coordinate_validation, migration 191)
    // is the backstop that checks it against the address.
    const coordsAreCanonical = !!(canonicalAddress
      && Number.isFinite(canonicalAddress.geocode_lat)
      && Number.isFinite(canonicalAddress.geocode_lng));
    if (coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)) {
      homeData.location = formatLocationForDB(coords.latitude, coords.longitude);
      homeData.map_center_lat = coords.latitude;
      homeData.map_center_lng = coords.longitude;
      homeData.geocode_provider = coordsAreCanonical ? 'google_validation' : 'client';
      homeData.geocode_mode = coordsAreCanonical ? 'verified' : 'user_asserted';
      homeData.geocode_accuracy = coordsAreCanonical ? 'rooftop' : null;
      homeData.geocode_place_id = coordsAreCanonical ? (canonicalAddress.geocode_place_id || null) : null;
      homeData.geocode_source_flow = 'home_onboarding';
      homeData.geocode_created_at = new Date().toISOString();
    }

    return { home: homeData, canonicalAddress,
      stepUp: verifiedCreateStepUp ? { id: verifiedCreateStepUp.id, max_age_days: addressConfig.mailVerification.stepUpMaxAgeDays } : null,
      audit: { verdict_status: addressVerdict?.status || null,
        reasons: [...(addressVerdict?.reasons || []), ...(allowCreateWithNoUnitAttestation ? ['no_unit_attestation'] : [])],
        validation_path: createHomeValidationPath, step_up_reason: stepUpPolicy?.policy || null },
    };
}

router.get('/create-commands/:requestId', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try { return homeCreateService.send(res, await homeCreateService.read(req.user.id, req.params.requestId)); }
  catch (error) { return homeCreateService.sendError(res, error); }
});
router.post('/create-commands/:requestId/cancel', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try { return homeCreateService.send(res, await homeCreateService.cancel(req.user.id, req.params.requestId)); }
  catch (error) { return homeCreateService.sendError(res, error); }
});
router.post('/', verifyToken, (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
}, validate(createHomeSchema), async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  // Older clients still receive atomic setup and address deduplication. New
  // clients persist their UUID and original body before making this request.
  const requestId = req.body.request_id || crypto.randomUUID();
  const actorId = req.user.id;
  let leaseId;
  try {
    const command = await homeCreateService.begin(actorId, requestId, req.body);
    leaseId = command.worker_lease_id;
    if (!leaseId) return homeCreateService.send(res, command);
    const prepared = await prepareHomeCreate(req);
    const result = await homeCreateService.commit(actorId, requestId, leaseId, req.body, prepared);
    if (result.committed_now) {
      await recordCreateHomeOutcomeSafe({ ...prepared.audit, address_id: prepared.home.address_id, outcome: 'created',
        code: 'HOME_CREATED', status_code: 201,
        message: 'Home and private setup saved; verification remains required.' });
      if (result.ownership_claim_id) {
        try {
          const { notifyOwnershipVerificationNeeded } = require('../services/notificationService');
          await notifyOwnershipVerificationNeeded({ userId: actorId, homeName: req.body.name || req.body.address,
            homeId: result.home_id, claimId: result.ownership_claim_id });
        } catch (_) {
          logger.warn('Ownership setup notification unavailable', { homeId: result.home_id });
        }
      }
    }
    return homeCreateService.send(res, result);
  } catch (error) {
    if (leaseId) {
      try {
        // A lost commit reply can already have completed. Its durable outcome
        // wins; transient failures only release this worker for an exact retry.
        return homeCreateService.send(res, await homeCreateService.finish(actorId, requestId, leaseId, error), error);
      } catch (_) {
        // Even an earlier provider refusal cannot resolve a newer worker's
        // outcome when the durable-command read fails.
        return homeCreateService.sendError(res, homeCreateService.failure());
      }
    }
    return homeCreateService.sendError(res, error);
  }
});


/**
 * GET /api/homes/my-homes
 * Get current user's homes (owned + occupied)
 */
router.get('/my-homes', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try { res.json(await homeListService.read(req.user.id)); }
  catch (err) { homeListService.sendError(res, err); }
});

/**
 * GET /api/homes/primary
 * Oldest currently authorized shared Home; personal setup is not residency.
 */
router.get('/primary', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try { res.json(await homeListService.read(req.user.id, { primary: true })); }
  catch (err) { homeListService.sendError(res, err); }
});

/**
 * GET /api/homes/invitations
 * Get all pending invitations for the current user
 * NOTE: Must be defined BEFORE /:id to avoid Express matching "invitations" as an :id param
 */
router.get('/invitations', verifyToken, async (req, res) => {
  try { res.json({ invitations: await homeInvitationService.list(req.user.id) }); }
  catch (err) { res.status(err.statusCode || 503).json({ error: err.message, code: err.code }); }
});

/**
 * GET /api/homes/invitations/token/:token
 * Public endpoint — look up an invitation by token.
 * Used by the invite acceptance page. No auth required so new users can see the invite.
 * Returns invite details + home info + inviter name (but no sensitive data).
 */
router.get('/invitations/token/:token', async (req, res) => {
  try {
    const { ok, ...preview } = await homeInvitationService.act({ token: req.params.token, action: 'preview' });
    res.set('Cache-Control', 'no-store');
    res.json(preview);
  } catch (err) { res.status(err.statusCode || 503).json({ error: err.message, code: err.code }); }
});

async function acceptHomeInvitation(req, res, selector) {
  try {
    const result = await homeInvitationService.act({ ...selector, actorId: req.user.id, action: 'accept' });
    if (result.kind === 'claim_merge') {
      if (!householdClaimConfig.flags.inviteMerge) {
        return res.status(409).json({ error: 'Use the ownership flow to complete this invitation.', code: 'OWNERSHIP_FLOW_REQUIRED' });
      }
      // Ownership keeps its distinct evidence/lifecycle gateway. The ordinary
      // invitation transaction never creates ownership or falls back to it.
      const invite = result.invitation;
      const claimId = invite.proposed_preset_key.slice('claim_merge:'.length);
      const merge = await homeClaimMergeService.acceptClaimMerge({ homeId: invite.home_id, claimId, userId: req.user.id, invitationId: invite.id });
      return res.json({ occupancy: merge.occupancy, homeId: invite.home_id, merged: true,
        accepted_role_base: merge.acceptedRoleBase, accepted_as_owner: merge.acceptedAsOwner,
        claim: { id: claimId, state: 'approved', claim_phase_v2: merge.claimPhaseV2,
          terminal_reason: merge.terminalReason, merged_into_claim_id: merge.mergedIntoClaimId } });
    }
    await homeInvitationService.notifyAccepted(result, req.user.id);
    return res.json({ occupancy: result.occupancy, homeId: result.homeId });
  } catch (err) {
    logger.error('Home invitation acceptance failed', { code: err.code });
    return res.status(err.statusCode || err.status || 503).json({ error: err.message, code: err.code });
  }
}

/**
 * POST /api/homes/invitations/:invitationId/accept
 */
router.post('/invitations/:invitationId/accept', verifyToken, async (req, res) => {
  await acceptHomeInvitation(req, res, { invitationId: req.params.invitationId });
});

/**
 * POST /api/homes/invitations/:invitationId/reject
 */
router.post('/invitations/:invitationId/reject', verifyToken, async (req, res) => {
  try {
    await homeInvitationService.act({ invitationId: req.params.invitationId, actorId: req.user.id, action: 'decline' });
    res.json({ message: 'Invitation rejected' });
  } catch (err) { res.status(err.statusCode || 503).json({ error: err.message, code: err.code }); }
});

/**
 * POST /api/homes/invitations/token/:token/accept
 * Accept an invitation by token (used by the acceptance page).
 * Requires auth — user must be logged in.
 */
router.post('/invitations/token/:token/accept', verifyToken, async (req, res) => {
  await acceptHomeInvitation(req, res, { token: req.params.token });
});

/**
 * POST /api/homes/invitations/token/:token/decline
 * Decline an invitation by token. Requires auth.
 */
router.post('/invitations/token/:token/decline', verifyToken, async (req, res) => {
  try {
    await homeInvitationService.act({ token: req.params.token, actorId: req.user.id, action: 'decline' });
    res.json({ message: 'Invitation declined' });
  } catch (err) { res.status(err.statusCode || 503).json({ error: err.message, code: err.code }); }
});

/**
 * Helper: get default permissions for a role
 */
function getRolePermissions(role) {
  const perms = {
    can_manage_home: false,
    can_manage_finance: false,
    can_manage_access: false,
    can_manage_tasks: true,
    can_view_sensitive: false,
  };

  switch (role) {
    case 'owner':
      return { can_manage_home: true, can_manage_finance: true, can_manage_access: true, can_manage_tasks: true, can_view_sensitive: true };
    case 'property_manager':
      return { can_manage_home: true, can_manage_finance: true, can_manage_access: true, can_manage_tasks: true, can_view_sensitive: true };
    case 'family':
    case 'roommate':
    case 'tenant':
      return { ...perms, can_manage_finance: true, can_view_sensitive: true };
    case 'caregiver':
      return { ...perms, can_view_sensitive: true };
    case 'guest':
      return { ...perms, can_manage_tasks: false };
    default:
      return perms;
  }
}

/**
 * GET /my-claims - Get the current user's residency claims
 * IMPORTANT: Must be before /:id to avoid route collision.
 */
router.get('/my-claims', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: claims, error } = await supabaseAdmin
      .from('HomeResidencyClaim')
      .select(`
        *,
        home:home_id (id, address, city, state, name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching my claims', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch claims' });
    }

    res.json({ claims: claims || [] });
  } catch (err) {
    logger.error('My claims error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

/**
 * GET /discover - Search discoverable homes (public_preview)
 * Query:
 *   q (required, min 2)
 *   limit (default 20, max 50)
 *   offset (default 0)
 */
router.get('/discover', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { q = '', limit = 20, offset = 0 } = req.query;
    const queryText = String(q || '').trim();
    const normalizedQuery = queryText.toLowerCase();
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean).slice(0, 6);
    const primaryToken = tokens[0] || normalizedQuery;
    const safeLimit = Math.min(parseInt(limit) || 20, 50);
    const safeOffset = Math.max(parseInt(offset) || 0, 0);

    if (queryText.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const fullSearchTerm = `%${queryText}%`;
    const broadSearchTerm = `%${primaryToken}%`;
    const candidateLimit = Math.min(Math.max((safeOffset + safeLimit) * 8, 80), 400);

    const { data: homes, error } = await supabaseAdmin
      .from('Home')
      .select('id, name, address, city, state, zipcode, home_type, visibility, owner_id, privacy_mask_level')
      .eq('visibility', 'public_preview')
      .eq('home_status', 'active')
      .in('privacy_mask_level', ['normal'])
      .or(
        `name.ilike.${fullSearchTerm},address.ilike.${fullSearchTerm},city.ilike.${fullSearchTerm},state.ilike.${fullSearchTerm},zipcode.ilike.${fullSearchTerm},name.ilike.${broadSearchTerm},address.ilike.${broadSearchTerm},city.ilike.${broadSearchTerm},state.ilike.${broadSearchTerm},zipcode.ilike.${broadSearchTerm}`
      )
      .order('created_at', { ascending: false })
      .range(0, candidateLimit - 1);

    if (error) {
      logger.error('Home discover search error', { error: error.message });
      return res.status(500).json({ error: 'Failed to search homes' });
    }

    const rows = homes || [];
    if (rows.length === 0) {
      return res.json({ homes: [] });
    }

    const homeIds = rows.map((h) => h.id);
    const ownerIds = [...new Set(rows.map((h) => h.owner_id).filter(Boolean))];

    const [ownersRes, membershipRes, claimsRes] = await Promise.all([
      ownerIds.length > 0
        ? supabaseAdmin
            .from('User')
            .select('id, username, name, first_name, last_name, profile_picture_url')
            .in('id', ownerIds)
        : Promise.resolve({ data: [] }),
      supabaseAdmin
        .from('HomeOccupancy')
        .select('home_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .in('home_id', homeIds),
      supabaseAdmin
        .from('HomeResidencyClaim')
        .select('home_id, status')
        .eq('user_id', userId)
        .in('home_id', homeIds),
    ]);

    const ownerMap = new Map((ownersRes.data || []).map((o) => [o.id, o]));
    const memberSet = new Set((membershipRes.data || []).map((m) => m.home_id));
    const claimMap = new Map((claimsRes.data || []).map((c) => [c.home_id, c.status]));

    const ranked = rows
      .map((h) => {
        const owner = ownerMap.get(h.owner_id) || null;
        const ownerName = owner
          ? owner.name || [owner.first_name, owner.last_name].filter(Boolean).join(' ') || owner.username
          : null;
        const member = memberSet.has(h.id) || h.owner_id === userId;

        const searchable = [
          member ? h.name : null,
          h.address,
          h.city,
          h.state,
          h.zipcode,
          member ? ownerName : null,
          member ? owner?.username : null,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const homeName = String(h.name || '').toLowerCase();
        const address = String(h.address || '').toLowerCase();

        let score = 4;
        if (homeName === normalizedQuery || address === normalizedQuery) {
          score = 0;
        } else if (homeName.startsWith(normalizedQuery) || address.startsWith(normalizedQuery)) {
          score = 1;
        } else if (searchable.includes(normalizedQuery)) {
          score = 2;
        } else if (tokens.every((token) => searchable.includes(token))) {
          score = 3;
        }

        // Privacy promise: outsiders see the street, never the house number
        // or unit — unless they typed that number themselves (the join /
        // claim flow), or already belong to the home. A claim alone is not access.
        const reveal = member || queryKnowsNumber(tokens, h.address);

        return {
          id: h.id,
          name: member ? h.name || null : null,
          address: reveal ? h.address : redactStreet(h.address),
          address_redacted: !reveal,
          city: h.city,
          state: h.state,
          zipcode: reveal ? h.zipcode : null,
          home_type: h.home_type || null,
          visibility: h.visibility,
          // Knowing an address is not permission to link its resident's account.
          owner: serializeOwnerForViewer(owner, { reveal: member }),
          is_member: memberSet.has(h.id),
          claim_status: claimMap.get(h.id) || null,
          _score: score,
          _searchable: searchable,
        };
      })
      .filter((h) => tokens.every((token) => h._searchable.includes(token)))
      .sort((a, b) => {
        if (a._score !== b._score) return a._score - b._score;
        return String(a.address || '').localeCompare(String(b.address || ''));
      });

    const result = ranked
      .slice(safeOffset, safeOffset + safeLimit)
      .map(({ _score, _searchable, ...rest }) => rest);

    res.json({ homes: result });
  } catch (err) {
    logger.error('Home discover error', { error: err.message });
    res.status(500).json({ error: 'Failed to search homes' });
  }
});

/**
 * GET /:id/public-profile - Public home preview + claim state
 */
router.get('/:id/public-profile', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const { data: home, error } = await supabaseAdmin
      .from('Home')
      .select('id, name, address, city, state, zipcode, home_type, visibility, owner_id, description, created_at, created_by_user_id')
      .eq('id', homeId)
      .single();

    if (error || !home) {
      return res.status(404).json({ error: 'Home not found' });
    }

    // Only current household access reveals private identity/address fields.
    // A creator or active claimant may inspect a redacted preview while
    // onboarding, but a claim itself is never a membership credential.
    const access = await checkHomePermission(homeId, userId);
    if (access.readFailed) return res.status(503).json({ error: 'Could not check home access. Try again.' });
    const isCreator = home.created_by_user_id === userId;
    const reveal = access.hasAccess;
    let canView = reveal || home.visibility === 'public_preview' || isCreator;
    if (!canView) {
      const [residencyClaims, ownershipClaims] = await Promise.all([
        supabaseAdmin.from('HomeResidencyClaim').select('id, status').eq('home_id', homeId).eq('user_id', userId).eq('status', 'pending'),
        supabaseAdmin.from('HomeOwnershipClaim').select('id, state, claim_phase_v2, merged_into_claim_id, expires_at').eq('home_id', homeId).eq('claimant_user_id', userId),
      ]);
      if (residencyClaims.error || ownershipClaims.error) throw new Error('Could not check claim status');
      canView = (residencyClaims.data || []).length > 0 || (ownershipClaims.data || []).some((claim) =>
        isPendingOwnershipClaimForReadPath(claim) && (!claim.expires_at || new Date(claim.expires_at).getTime() > Date.now()));
    }
    if (!canView) {
      return res.status(403).json({ error: 'This home is not publicly discoverable' });
    }

    const { data: verifiedOwnerRows } = await supabaseAdmin
      .from('HomeOwner')
      .select('subject_id, is_primary_owner')
      .eq('home_id', homeId)
      .eq('subject_type', 'user')
      .eq('owner_status', 'verified');

    const hasVerifiedOwner = (verifiedOwnerRows || []).length > 0;
    const sortedVerified = [...(verifiedOwnerRows || [])].sort(
      (a, b) => Number(!!b.is_primary_owner) - Number(!!a.is_primary_owner),
    );
    const ownerSubjectIdForDisplay = sortedVerified[0]?.subject_id || home.owner_id || null;

    const [ownerRes, claimRes, memberRes] = await Promise.all([
      ownerSubjectIdForDisplay
        ? supabaseAdmin
          .from('User')
          .select('id, username, name, first_name, last_name, profile_picture_url')
          .eq('id', ownerSubjectIdForDisplay)
          .single()
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from('HomeResidencyClaim')
        .select('id, status, created_at')
        .eq('home_id', homeId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('HomeOccupancy')
        .select('id')
        .eq('home_id', homeId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle(),
    ]);

    // One projection for outsiders, shared with the privacy mirror
    // (identity-center view-as?surface=home) so the two can never drift.
    const owner = serializeOwnerForViewer(ownerRes.data, { reveal });

    res.json({
      home: serializeHomeForViewer(home, { reveal }),
      owner,
      has_verified_owner: hasVerifiedOwner,
      is_member: !!memberRes.data,
      claim: claimRes.data || null,
    });
  } catch (err) {
    logger.error('Home public profile error', { error: err.message, homeId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch home profile' });
  }
});

/**
 * POST /:id/request-household-from-owner
 * Non-member asks verified owner(s) to add them (in-app notification).
 */
router.post('/:id/request-household-from-owner', verifyToken, validate(requestHouseholdFromOwnerSchema), async (req, res) => {
  try {
    const result = await homeInvitationService.write({ homeId: req.params.id, actorId: req.user.id,
      action: 'request', payload: { requested_identity: req.body.requested_identity } });
    try {
      await require('../services/notificationService').notifyHouseholdAccessRequest({
        ownerUserIds: result.notify_user_ids, requesterName: result.actor_name, homeLabel: result.home_label,
        homeId: req.params.id, requesterUserId: req.user.id, requestedIdentity: req.body.requested_identity,
      });
    } catch (err) { logger.error('Household request notification failed after commit', { code: err.code }); }
    res.json({ ok: true, notified_owners: result.notify_user_ids.length });
  } catch (err) { res.status(err.statusCode || 503).json({ error: err.message, code: err.code }); }
});

/**
 * GET /:id/household-access-requests
 * List access requests (verified owners or members.manage).
 */
router.get('/:id/household-access-requests', verifyToken, async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status.toLowerCase() : 'pending';
    res.json({ requests: await homeInvitationService.listRequests(req.params.id, req.user.id, status) });
  } catch (err) {
    logger.error('household-access-requests list error', { code: err.code });
    res.status(err.statusCode || 503).json({ error: err.message, code: err.code });
  }
});

/**
 * POST /:id/household-access-requests/:requestId/approve
 */
router.post('/:id/household-access-requests/:requestId/approve', verifyToken, async (req, res) => {
  try {
    const result = await homeInvitationService.write({ homeId: req.params.id, actorId: req.user.id,
      action: 'approve_request', payload: { request_id: req.params.requestId } });
    await homeInvitationService.notifyCreated(result);
    res.json({ ok: true, message: 'Invitation created' });
  } catch (err) { res.status(err.statusCode || 503).json({ error: err.message, code: err.code }); }
});

/**
 * POST /:id/household-access-requests/:requestId/reject
 */
router.post('/:id/household-access-requests/:requestId/reject', verifyToken, async (req, res) => {
  try {
    const result = await homeInvitationService.write({ homeId: req.params.id, actorId: req.user.id,
      action: 'reject_request', payload: { request_id: req.params.requestId } });
    if (!result.replayed) {
      try {
        await require('../services/notificationService').notifyHouseholdAccessRequestRejected({
          requesterUserId: result.target_id, homeLabel: result.home_label, resolverName: result.actor_name,
        });
      } catch (err) { logger.error('Household rejection notification failed after commit', { code: err.code }); }
    }
    res.json({ ok: true });
  } catch (err) { res.status(err.statusCode || 503).json({ error: err.message, code: err.code }); }
});

/**
 * GET /api/homes/:id
 * Get home details with occupants
 */
router.get('/:id', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (Joi.string().uuid().validate(req.params.id).error) return res.status(400).json({ error: 'Invalid Home id' });
  try { res.json(await homeDetailService.detail(req.params.id, req.user.id)); }
  catch (err) { homeDetailService.sendError(res, err); }
});

/**
 * GET /api/homes/:id/property-details
 * Resolve ATTOM-backed property details for a home, using saved home data,
 * raw ATTOM cache, or live ATTOM fetches as needed.
 */
router.get('/:id/property-details', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (Joi.string().uuid().validate(req.params.id).error) return res.status(400).json({ error: 'Invalid Home id' });
  try { res.json(await homeDetailService.propertyDetail(req.params.id, req.user.id)); }
  catch (err) { homeDetailService.sendError(res, err); }
});

/**
 * GET /api/homes
 * Get all homes for current user (owned + occupied)
 */
router.get('/', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try { res.json(await homeListService.read(req.user.id, { legacy: true })); }
  catch (err) { homeListService.sendError(res, err); }
});

/**
 * PATCH /api/homes/:id
 * Update home details (owner only)
 */
router.patch('/:id', verifyToken, validate(updateHomeSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check ownership + fetch geocode_mode for verified coordinate guard
    const { data: existingHome, error: fetchError } = await supabaseAdmin
      .from('Home')
      .select('owner_id, geocode_mode')
      .eq('id', id)
      .single();

    if (fetchError || !existingHome) {
      return res.status(404).json({ error: 'Home not found' });
    }

    const updateAccess = await checkHomePermission(id, userId, 'home.edit');
    if (!updateAccess.hasAccess) {
      return res.status(403).json({ error: 'You do not have permission to update this home' });
    }

    const updates = {};

    if (req.body.address) updates.address = req.body.address;
    if (req.body.city) updates.city = req.body.city;
    if (req.body.state) updates.state = req.body.state;
    if (req.body.zip_code) updates.zip_code = req.body.zip_code;
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.home_type) updates.home_type = req.body.home_type;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.entry_instructions !== undefined) updates.entry_instructions = req.body.entry_instructions;
    if (req.body.parking_instructions !== undefined) updates.parking_instructions = req.body.parking_instructions;
    if (req.body.visibility) updates.visibility = req.body.visibility;
    if (req.body.bedrooms !== undefined) updates.bedrooms = req.body.bedrooms;
    if (req.body.bathrooms !== undefined) updates.bathrooms = req.body.bathrooms;
    if (req.body.sq_ft !== undefined) updates.sq_ft = req.body.sq_ft;
    if (req.body.lot_sq_ft !== undefined) updates.lot_sq_ft = req.body.lot_sq_ft;
    if (req.body.year_built !== undefined) updates.year_built = req.body.year_built;
    if (req.body.move_in_date !== undefined) updates.move_in_date = req.body.move_in_date;
    if (req.body.is_owner !== undefined) updates.is_owner = req.body.is_owner;
    if (req.body.amenities) updates.amenities = req.body.amenities;

    if (req.body.location) {
      // CRIT-05: provenance must never be self-asserted. This handler used to
      // read geocode_mode straight from the request body and default it to
      // 'verified' with 'rooftop' accuracy, so any member with home.edit could
      // move a home to arbitrary coordinates and have that pin recorded as a
      // verified rooftop fix. The overwrite guard then consulted the same
      // field, so it protected the false value from every subsequent
      // correction — inverting the guard's purpose.
      //
      // A coordinate that did not come from runValidationPipeline is
      // user-asserted, full stop. 'verified' is reserved for writes originating
      // in canonicalAddressService.
      const block = shouldBlockCoordinateOverwrite(
        existingHome,
        { geocode_mode: 'user_asserted' },
        'PATCH /api/homes/:id',
      );
      if (block.blocked) {
        logger.warn('Home coordinate overwrite blocked', { homeId: id, userId, reason: block.reason });
        // Allow the rest of the update to proceed, just strip coordinate fields
      } else {
        updates.location = formatLocationForDB(
          req.body.location.latitude,
          req.body.location.longitude
        );
        // Geocode provenance — recorded, not accepted.
        updates.geocode_provider = 'client';
        updates.geocode_mode = 'user_asserted';
        updates.geocode_accuracy = 'unknown';
        updates.geocode_place_id = null;
        updates.geocode_source_flow = 'home_edit';
        updates.geocode_created_at = new Date().toISOString();
      }
    }

    updates.updated_at = new Date().toISOString();

    const { data: home, error } = await supabaseAdmin
      .from('Home')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating home', { error: error.message, homeId: id });
      return res.status(500).json({ error: 'Failed to update home' });
    }

    logger.info('Home updated', { homeId: id, userId });

    res.json({
      message: 'Home updated successfully',
      home
    });

  } catch (err) {
    logger.error('Home update error', { error: err.message, homeId: req.params.id });
    res.status(500).json({ error: 'Failed to update home' });
  }
});

/**
 * DELETE /api/homes/:id
 * Delete home (owner only)
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await homeAuthorityService.deleteHome(req.params.id, req.user.id);
    res.json({ message: 'Home deleted successfully' });
  } catch (err) {
    logger.error('Home delete error', { code: err.code, homeId: req.params.id });
    res.status(err.statusCode || 503).json({ error: err.message, code: err.code });
  }
});

/**
 * POST /api/homes/:id/attach
 * Attach user to home (owner only or with verification in future)
 */
router.post('/:id/attach', verifyToken, validate(attachDetachSchema), async (req, res) => {
  try {
    const result = await homeResidencyService.review({ homeId: req.params.id, actorId: req.user.id,
      action: 'attach', targetId: req.body.userId });
    res.json({
      message: result.replayed ? 'User is already attached to this home' : `${result.user.name} attached to home successfully`,
      occupancy: { id: result.occupancy.id, homeId: req.params.id, userId: result.target_id,
        username: result.user.username, name: result.user.name, attachedAt: result.occupancy.created_at },
    });
  } catch (err) {
    logger.error('Attach user error', { code: err.code, homeId: req.params.id });
    res.status(err.statusCode || 503).json({ error: err.message, code: err.code });
  }
});

/**
 * POST /api/homes/:id/detach
 * Detach user from home (owner only)
 */
router.post('/:id/detach', verifyToken, validate(attachDetachSchema), async (req, res) => {
  try {
    await homeAuthorityService.mutateMember({ homeId: req.params.id, actorId: req.user.id,
      targetId: req.body.userId, action: 'remove' });
    res.json({ message: 'User detached from home successfully' });
  } catch (err) {
    logger.error('Detach user error', { code: err.code, homeId: req.params.id });
    res.status(err.statusCode || 503).json({ error: err.message, code: err.code });
  }
});

/**
 * POST /api/homes/:id/move-out
 * Self-initiated move-out. Soft-deactivates the caller's occupancy,
 * revokes non-primary ownership and residency letters in one transaction.
 * Primary owners must complete ownership transfer before leaving.
 */
router.post('/:id/move-out', verifyToken, async (req, res) => {
  try {
    const result = await homeAuthorityService.mutateMember({ homeId: req.params.id, actorId: req.user.id,
      targetId: req.user.id, action: 'remove' });
    // Membership, credentials and vacancy are committed together. Notify only
    // the current recipients returned by that transaction after it succeeds.
    if (result.notify_user_ids?.length) {
      try {
        const { data: user } = await supabaseAdmin.from('User').select('username, name, first_name')
          .eq('id', req.user.id).single();
        const userName = user?.name || user?.first_name || user?.username || 'A member';
        await require('../services/notificationService').createBulkNotifications(result.notify_user_ids.map(userId => ({
          userId, type: 'member_moved_out', title: 'Member moved out', body: `${userName} has moved out.`,
          link: `/homes/${req.params.id}/occupants`, metadata: { home_id: req.params.id, moved_out_user_id: req.user.id },
        })));
      } catch (error) {
        logger.warn('Failed to send move-out notifications (non-fatal)', { error: error.message });
      }
    }
    res.json({ message: 'You have been removed from this home', homeId: req.params.id,
      ...(result.reconciled_stale_occupancy ? { reconciled_stale_occupancy: true } : {}) });
  } catch (err) {
    logger.error('Move-out error', { code: err.code, homeId: req.params.id });
    res.status(err.statusCode || 503).json({ error: err.message, code: err.code });
  }
});

/**
 * POST /api/homes/:id/challenge-member/:occupancyId
 * An authority challenges a provisional member during the challenge window.
 * Suspends the target occupancy and sets the home to disputed state.
 */
router.post('/:id/challenge-member/:occupancyId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, occupancyId } = req.params;
    const userId = req.user.id;

    // 1. Verify caller has members.manage permission
    const access = await checkHomePermission(homeId, userId, 'members.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Not authorized to challenge members' });
    }

    // 2. Fetch target occupancy and verify it's challengeable
    const { data: targetOcc } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('id, home_id, user_id, verification_status, challenge_window_ends_at, role_base')
      .eq('id', occupancyId)
      .eq('home_id', homeId)
      .single();

    if (!targetOcc) {
      return res.status(404).json({ error: 'Occupancy not found' });
    }

    if (targetOcc.verification_status !== 'provisional') {
      return res.status(400).json({ error: 'Only provisional members can be challenged' });
    }

    const now = new Date();
    if (!targetOcc.challenge_window_ends_at || new Date(targetOcc.challenge_window_ends_at) <= now) {
      return res.status(400).json({ error: 'The challenge window for this member has expired' });
    }

    if (targetOcc.user_id === userId) {
      return res.status(400).json({ error: 'You cannot challenge yourself' });
    }

    // 3. Suspend the target occupancy
    const nowISO = now.toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('HomeOccupancy')
      .update({
        is_active: false,
        verification_status: 'suspended_challenged',
        updated_at: nowISO,
      })
      .eq('id', occupancyId);

    if (updateError) {
      logger.error('Failed to suspend challenged member', { error: updateError.message, homeId, occupancyId });
      return res.status(500).json({ error: 'Failed to suspend member' });
    }

    // 4. Product: do not set Home.security_state to disputed (challenge flow only suspends occupancy).

    // 5. Notify the challenged user
    try {
      const notificationService = require('../services/notificationService');

      notificationService.createNotification({
        userId: targetOcc.user_id,
        type: 'access_challenged',
        title: 'Access challenged',
        body: 'Your access has been challenged by a household member. Contact support if you believe this is an error.',
        link: `/homes/${homeId}/dashboard`,
        metadata: { home_id: homeId, challenged_by: userId },
      });

      // 6. Notify all authorities
      const { data: challenger } = await supabaseAdmin
        .from('User')
        .select('username, name, first_name')
        .eq('id', userId)
        .single();

      const { data: challengedUser } = await supabaseAdmin
        .from('User')
        .select('username, name, first_name')
        .eq('id', targetOcc.user_id)
        .single();

      const challengerName = challenger?.name || challenger?.first_name || challenger?.username || 'A member';
      const challengedName = challengedUser?.name || challengedUser?.first_name || challengedUser?.username || 'a member';

      const { data: authorities } = await supabaseAdmin
        .from('HomeOccupancy')
        .select('user_id')
        .eq('home_id', homeId)
        .eq('is_active', true)
        .in('role_base', ['owner', 'admin', 'manager']);

      const notifications = (authorities || [])
        .filter(a => a.user_id !== userId)
        .map(a => ({
          userId: a.user_id,
          type: 'member_challenged',
          title: 'Member access challenged',
          body: `${challengerName} has challenged ${challengedName}'s access.`,
          link: `/homes/${homeId}/occupants`,
          metadata: { home_id: homeId, challenger_id: userId, challenged_user_id: targetOcc.user_id },
        }));

      if (notifications.length > 0) {
        await notificationService.createBulkNotifications(notifications);
      }
    } catch (notifErr) {
      logger.warn('Failed to send challenge notifications (non-fatal)', { error: notifErr.message });
    }

    // 7. Audit log
    await writeAuditLog(homeId, userId, 'MEMBER_CHALLENGED', 'HomeOccupancy', occupancyId, {
      challenged_user_id: targetOcc.user_id,
      role_base: targetOcc.role_base,
    });

    // 8. Response
    res.json({ message: 'Member access has been suspended pending review' });

  } catch (err) {
    logger.error('Challenge member error', { error: err.message, homeId: req.params.id, occupancyId: req.params.occupancyId });
    res.status(500).json({ error: 'Failed to challenge member' });
  }
});

/**
 * GET /api/homes/:id/occupants
 * Active household members (occupancy rows). Move-outs keep historical rows with is_active=false;
 * those are omitted here so Members UI only shows current members.
 * Pass ?include_inactive=1 to include moved-out / inactive occupancies (audit-style consumers).
 */
router.get('/:id/occupants', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (Joi.string().uuid().validate(req.params.id).error) return res.status(400).json({ error: 'Invalid Home id' });
  if (req.query.include_inactive !== undefined && !['0', '1'].includes(req.query.include_inactive)) {
    return res.status(400).json({ error: 'Invalid household history filter' });
  }
  try { res.json(await homeDetailService.members(req.params.id, req.user.id, { history: req.query.include_inactive === '1' })); }
  catch (err) { homeDetailService.sendError(res, err); }
});

/**
 * POST /api/homes/:id/private-data
 * Add private data to home (owner/occupants only)
 */
router.post('/:id/private-data', verifyToken, validate(homeDataSchema), async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const { type, data } = req.body;
    const userId = req.user.id;

    // Check access
    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this home' });
    }

    // Insert private data
    const { data: privateData, error } = await supabaseAdmin
      .from('HomePrivateData')
      .insert({
        home_id: homeId,
        type,
        data,
        created_by: userId
      })
      .select()
      .single();

    if (error) {
      logger.error('Error adding private data', { error: error.message, homeId, type });
      return res.status(500).json({ error: 'Failed to add private data' });
    }

    logger.info('Private data added', { homeId, type, userId });

    res.status(201).json({
      message: 'Private data added successfully',
      data: privateData
    });

  } catch (err) {
    logger.error('Private data creation error', { error: err.message, homeId: req.params.id });
    res.status(500).json({ error: 'Failed to add private data' });
  }
});

/**
 * GET /api/homes/:id/private-data
 * Get all private data for home (owner/occupants only)
 */
router.get('/:id/private-data', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;
    const { type } = req.query;

    // Check access
    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this home' });
    }

    let query = supabaseAdmin
      .from('HomePrivateData')
      .select(`
        *,
        creator:created_by (
          username,
          name
        )
      `)
      .eq('home_id', homeId)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }

    const { data: privateData, error } = await query;

    if (error) {
      logger.error('Error fetching private data', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch private data' });
    }

    res.json({
      privateData: privateData || []
    });

  } catch (err) {
    logger.error('Private data fetch error', { error: err.message, homeId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch private data' });
  }
});

/**
 * POST /api/homes/:id/public-data
 * Add public data to home (owner/occupants only)
 */
router.post('/:id/public-data', verifyToken, validate(homeDataSchema), async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const { type, data } = req.body;
    const userId = req.user.id;

    // Check access
    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this home' });
    }

    // Insert public data
    const { data: publicData, error } = await supabaseAdmin
      .from('HomePublicData')
      .insert({
        home_id: homeId,
        type,
        data,
        created_by: userId
      })
      .select()
      .single();

    if (error) {
      logger.error('Error adding public data', { error: error.message, homeId, type });
      return res.status(500).json({ error: 'Failed to add public data' });
    }

    logger.info('Public data added', { homeId, type, userId });

    res.status(201).json({
      message: 'Public data added successfully',
      data: publicData
    });

  } catch (err) {
    logger.error('Public data creation error', { error: err.message, homeId: req.params.id });
    res.status(500).json({ error: 'Failed to add public data' });
  }
});

/**
 * GET /api/homes/:id/public-data
 * Get all public data for home (anyone with home access)
 */
router.get('/:id/public-data', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;
    const { type } = req.query;

    // Check access
    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this home' });
    }

    let query = supabaseAdmin
      .from('HomePublicData')
      .select(`
        *,
        creator:created_by (
          username,
          name
        )
      `)
      .eq('home_id', homeId)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }

    const { data: publicData, error } = await query;

    if (error) {
      logger.error('Error fetching public data', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch public data' });
    }

    res.json({
      publicData: publicData || []
    });

  } catch (err) {
    logger.error('Public data fetch error', { error: err.message, homeId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch public data' });
  }
});

/**
 * DELETE /api/homes/:id/private-data/:dataId
 * Delete private data entry (creator or owner only)
 */
router.delete('/:id/private-data/:dataId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, dataId } = req.params;
    const userId = req.user.id;

    // Get the data entry
    const { data: entry, error: fetchError } = await supabaseAdmin
      .from('HomePrivateData')
      .select('created_by, home_id')
      .eq('id', dataId)
      .single();

    if (fetchError || !entry) {
      return res.status(404).json({ error: 'Data entry not found' });
    }

    if (entry.home_id !== homeId) {
      return res.status(400).json({ error: 'Data entry does not belong to this home' });
    }

    // Check if user is creator or home owner
    const access = await checkHomePermission(homeId, userId);
    if (entry.created_by !== userId && !access.isOwner) {
      return res.status(403).json({ error: 'Only the creator or home owner can delete this' });
    }

    const { error } = await supabaseAdmin
      .from('HomePrivateData')
      .delete()
      .eq('id', dataId);

    if (error) {
      logger.error('Error deleting private data', { error: error.message, dataId });
      return res.status(500).json({ error: 'Failed to delete private data' });
    }

    logger.info('Private data deleted', { homeId, dataId, userId });

    res.json({ message: 'Private data deleted successfully' });

  } catch (err) {
    logger.error('Private data delete error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete private data' });
  }
});

/**
 * DELETE /api/homes/:id/public-data/:dataId
 * Delete public data entry (creator or owner only)
 */
router.delete('/:id/public-data/:dataId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, dataId } = req.params;
    const userId = req.user.id;

    // Get the data entry
    const { data: entry, error: fetchError } = await supabaseAdmin
      .from('HomePublicData')
      .select('created_by, home_id')
      .eq('id', dataId)
      .single();

    if (fetchError || !entry) {
      return res.status(404).json({ error: 'Data entry not found' });
    }

    if (entry.home_id !== homeId) {
      return res.status(400).json({ error: 'Data entry does not belong to this home' });
    }

    // Check if user is creator or home owner
    const access = await checkHomePermission(homeId, userId);
    if (entry.created_by !== userId && !access.isOwner) {
      return res.status(403).json({ error: 'Only the creator or home owner can delete this' });
    }

    const { error } = await supabaseAdmin
      .from('HomePublicData')
      .delete()
      .eq('id', dataId);

    if (error) {
      logger.error('Error deleting public data', { error: error.message, dataId });
      return res.status(500).json({ error: 'Failed to delete public data' });
    }

    logger.info('Public data deleted', { homeId, dataId, userId });

    res.json({ message: 'Public data deleted successfully' });

  } catch (err) {
    logger.error('Public data delete error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete public data' });
  }
});

// ============================================================================
// HOME PROFILE ROUTES — Tasks, Issues, Bills, Packages, Events, etc.
// ============================================================================


// ============ HOME NEARBY GIGS ============

/**
 * GET /api/homes/:id/nearby-gigs
 * Get gigs posted near this home address
 */
router.get('/:id/nearby-gigs', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;
    const { limit = 10, radius = 5000 } = req.query;

    // Check access to home
    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    // Get home location
    const { data: home, error: homeError } = await supabaseAdmin
      .from('Home')
      .select('location')
      .eq('id', homeId)
      .single();

    if (homeError || !home || !home.location) {
      return res.status(400).json({ error: 'Home location not found' });
    }

    // Parse geography column (GeoJSON or WKT format)
    const coords = parsePostGISPoint(home.location);
    if (!coords) {
      return res.status(400).json({ error: 'Invalid home location' });
    }

    const { longitude, latitude } = coords;

    // Query nearby gigs using RPC function
    const { data: gigs, error } = await supabaseAdmin.rpc('find_gigs_nearby', {
      user_lat: latitude,
      user_lon: longitude,
      radius_meters: parseInt(radius) || 5000,
      gig_status: 'open'
    });

    if (error) {
      logger.error('Error fetching nearby gigs', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch nearby gigs' });
    }

    // Limit results
    const limitedGigs = (gigs || []).slice(0, parseInt(limit) || 10);

    res.json({ gigs: limitedGigs });
  } catch (err) {
    logger.error('Nearby gigs fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch nearby gigs' });
  }
});

// ============ HOME TASKS ============

// Every task/calendar gateway uses the same locked database authorization.
function registerHomeRecordRoutes(path, kind) {
  router.get(`/:id/${path}`, verifyToken, async (req, res) => {
    try {
      if (kind === 'task') {
        res.set('Cache-Control', 'private, no-store');
        if (!requireExpectedSessionScope(req, res)) return;
      }
      const readCollection = kind === 'task' ? homeRecordService.listCollection : homeRecordService.list;
      const result = await readCollection({ homeId: req.params.id, actorId: req.user.id, kind,
        startAfter: kind === 'event' ? req.query.start_after || null : null,
        startBefore: kind === 'event' ? req.query.start_before || null : null });
      const records = kind === 'event'
        ? result.records.sort((a, b) => new Date(a.start_at) - new Date(b.start_at)) : result.records;
      res.json({ [path]: records, ...(kind === 'task' ? {
        collection_capabilities: { can_create: result.can_create },
        task_session: { ...getRequestSessionScope(req), home_id: req.params.id },
      } : {}) });
    } catch (error) { homeRecordService.sendError(res, error); }
  });
  router.post(`/:id/${path}`, verifyToken, async (req, res) => {
    try {
      const hasRequestId = kind === 'task' && req.body && Object.hasOwn(req.body, 'request_id');
      if (kind === 'task') {
        res.set('Cache-Control', 'private, no-store');
        if (!requireExpectedSessionScope(req, res, { required: !!hasRequestId })) return;
      }
      const payload = hasRequestId ? { ...req.body } : req.body;
      const requestId = hasRequestId ? payload.request_id : undefined;
      if (hasRequestId) delete payload.request_id;
      const result = await homeRecordService.mutate({ homeId: req.params.id, actorId: req.user.id,
        kind, action: 'create', payload, requestId });
      res.status(result.replayed ? 200 : 201).json({ [kind]: result.record, ...(hasRequestId ? {
        creation_receipt: result.creation_receipt, replayed: result.replayed,
        task_session: { ...getRequestSessionScope(req), home_id: req.params.id },
      } : {}) });
      // Assignment notices are persisted by the same protected task transaction.
      // The independent leased relay recovers them after a process interruption.
    } catch (error) { homeRecordService.sendError(res, error); }
  });
  router.get(`/:id/${path}/:recordId`, verifyToken, async (req, res) => {
    try {
      if (kind === 'task') {
        res.set('Cache-Control', 'private, no-store');
        if (!requireExpectedSessionScope(req, res)) return;
      }
      const result = await homeRecordService.list({ homeId: req.params.id, actorId: req.user.id,
        kind, recordId: req.params.recordId });
      res.json({ [kind]: result.records[0], ...(kind === 'event' ? { attendees: result.attendees } : { task_session: { ...getRequestSessionScope(req), home_id: req.params.id } }) });
    } catch (error) { homeRecordService.sendError(res, error); }
  });
  router.put(`/:id/${path}/:recordId`, verifyToken, async (req, res) => {
    try {
      if (kind === 'task' && !requireExpectedSessionScope(req, res)) return;
      const result = await homeRecordService.mutate({ homeId: req.params.id, actorId: req.user.id,
        kind, action: 'update', recordId: req.params.recordId, payload: req.body });
      res.json({ [kind]: result.record });
    } catch (error) { homeRecordService.sendError(res, error); }
  });
  router.delete(`/:id/${path}/:recordId`, verifyToken, async (req, res) => {
    try {
      if (kind === 'task' && !requireExpectedSessionScope(req, res)) return;
      await homeRecordService.mutate({ homeId: req.params.id, actorId: req.user.id,
        kind, action: 'delete', recordId: req.params.recordId });
      res.json({ message: kind === 'task' ? 'Task deleted' : 'Event deleted' });
    } catch (error) { homeRecordService.sendError(res, error); }
  });
}
registerHomeRecordRoutes('tasks', 'task');

const homeTaskGig = require('../services/homeTaskGigService');
router.get('/:id/tasks/:taskId/gig-publication', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!requireExpectedSessionScope(req, res)) return;
  try {
    const result = await homeTaskGig.read({ homeId: req.params.id, actorId: req.user.id, taskId: req.params.taskId });
    res.json({ ...result, task_session: { ...getRequestSessionScope(req), home_id: req.params.id } });
  } catch (error) { homeTaskGig.sendError(res, error); }
});

const homeTaskRecurrence = require('../services/homeTaskRecurrenceService');
router.get('/:id/tasks/:taskId/recurrence', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!requireExpectedSessionScope(req, res)) return;
  try {
    const result = await homeTaskRecurrence.read({ homeId: req.params.id, actorId: req.user.id, taskId: req.params.taskId });
    res.json({ ...result, task_session: { ...getRequestSessionScope(req), home_id: req.params.id } });
  } catch (error) { homeTaskRecurrence.sendError(res, error); }
});
router.post('/:id/tasks/:taskId/recurrence', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!requireExpectedSessionScope(req, res, { required: true })) return;
  try {
    const { request_id: requestId, ...command } = req.body || {};
    const result = await homeTaskRecurrence.change({ homeId: req.params.id, actorId: req.user.id,
      taskId: req.params.taskId, requestId, command });
    res.json({ ...result, task_session: { ...getRequestSessionScope(req), home_id: req.params.id } });
  } catch (error) { homeTaskRecurrence.sendError(res, error); }
});


// ============ HOME ISSUES ============

/**
 * GET /api/homes/:id/issues
 */
router.get('/:id/issues', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (Joi.string().uuid().validate(req.params.id).error) return res.status(400).json({ error: 'Invalid Home id' });
  const dashboardService = require('../services/homeDashboardService');
  try {
    const records = await dashboardService.readResource({ homeId: req.params.id, actorId: req.user.id,
      kind: 'issues', status: req.query.status, severity: req.query.severity });
    return res.json({ issues: records });
  } catch (error) { return dashboardService.sendError(res, error); }
});

/**
 * POST /api/homes/:id/issues
 */
router.post('/:id/issues', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const { title, description, severity, photos, estimated_cost, details } = req.body;

    if (!title) return res.status(400).json({ error: 'title is required' });

    const { data, error } = await supabaseAdmin
      .from('HomeIssue')
      .insert({
        home_id: homeId,
        title,
        description: description || null,
        severity: severity || 'medium',
        reported_by: userId,
        photos: photos || [],
        estimated_cost: estimated_cost || null,
        details: details || {},
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating home issue', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to create issue' });
    }

    res.status(201).json({ issue: data });
  } catch (err) {
    logger.error('Issue creation error', { error: err.message });
    res.status(500).json({ error: 'Failed to create issue' });
  }
});

/**
 * PUT /api/homes/:id/issues/:issueId
 */
router.put('/:id/issues/:issueId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, issueId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'can_manage_home');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to manage issues' });

    const allowed = ['title', 'description', 'status', 'severity', 'assigned_vendor_id', 'estimated_cost', 'photos', 'secret_fixes', 'linked_gig_id', 'resolved_at', 'details'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.status === 'resolved' && !updates.resolved_at) {
      updates.resolved_at = new Date().toISOString();
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('HomeIssue')
      .update(updates)
      .eq('id', issueId)
      .eq('home_id', homeId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating home issue', { error: error.message, issueId });
      return res.status(500).json({ error: 'Failed to update issue' });
    }

    res.json({ issue: data });
  } catch (err) {
    logger.error('Issue update error', { error: err.message });
    res.status(500).json({ error: 'Failed to update issue' });
  }
});


// ============ HOME BILLS ============

/**
 * GET /api/homes/:id/bills
 */
router.get('/:id/bills', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;
    const { status } = req.query;

    const access = await checkHomePermission(homeId, userId, 'finance.view');
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    let query = supabaseAdmin
      .from('HomeBill')
      .select('*')
      .eq('home_id', homeId)
      .order('due_date', { ascending: true });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      logger.error('Error fetching home bills', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch bills' });
    }

    res.json({ bills: data || [] });
  } catch (err) {
    logger.error('Bills fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

/**
 * POST /api/homes/:id/bills
 */
router.post('/:id/bills', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'can_manage_finance');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to manage finances' });

    const { bill_type, provider_name, amount, currency, period_start, period_end, due_date, details } = req.body;

    if (!bill_type || amount == null) {
      return res.status(400).json({ error: 'bill_type and amount are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('HomeBill')
      .insert({
        home_id: homeId,
        bill_type,
        provider_name: provider_name || null,
        amount,
        currency: currency || 'USD',
        period_start: period_start || null,
        period_end: period_end || null,
        due_date: due_date || null,
        details: details || {},
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating home bill', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to create bill' });
    }

    res.status(201).json({ bill: data });
  } catch (err) {
    logger.error('Bill creation error', { error: err.message });
    res.status(500).json({ error: 'Failed to create bill' });
  }
});

/**
 * PUT /api/homes/:id/bills/:billId
 */
router.put('/:id/bills/:billId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, billId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'can_manage_finance');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to manage finances' });

    const allowed = ['amount', 'status', 'paid_at', 'paid_by', 'provider_name', 'due_date', 'details'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.status === 'paid' && !updates.paid_at) {
      updates.paid_at = new Date().toISOString();
      if (!updates.paid_by) updates.paid_by = userId;
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('HomeBill')
      .update(updates)
      .eq('id', billId)
      .eq('home_id', homeId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating home bill', { error: error.message, billId });
      return res.status(500).json({ error: 'Failed to update bill' });
    }

    res.json({ bill: data });
  } catch (err) {
    logger.error('Bill update error', { error: err.message });
    res.status(500).json({ error: 'Failed to update bill' });
  }
});

/**
 * GET /api/homes/:id/bills/:billId/splits
 */
router.get('/:id/bills/:billId/splits', verifyToken, async (req, res) => {
  try {
    const { id: homeId, billId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'finance.view');
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    // Verify bill belongs to home
    const { data: bill } = await supabaseAdmin
      .from('HomeBill')
      .select('id')
      .eq('id', billId)
      .eq('home_id', homeId)
      .single();

    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const { data, error } = await supabaseAdmin
      .from('HomeBillSplit')
      .select(`
        *,
        user:user_id (
          id, username, name, profile_picture_url
        )
      `)
      .eq('bill_id', billId);

    if (error) {
      logger.error('Error fetching bill splits', { error: error.message, billId });
      return res.status(500).json({ error: 'Failed to fetch bill splits' });
    }

    res.json({ splits: data || [] });
  } catch (err) {
    logger.error('Bill splits fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch bill splits' });
  }
});


// ============ HOME MAINTENANCE ============
//
// T6.3b / P10 — Per-home maintenance log. The `HomeMaintenanceLog`
// table was extended in migration `151_home_maintenance_tasks.sql`
// with `task / vendor / recurrence / due_date / status / updated_at /
// created_by` so the new design's forward-looking task list works
// alongside the historical "I performed this" log.
//
// Authz: list/get requires home membership (no special permission);
// create/update/delete require `home.edit` (mirrors the bills/packages
// pattern — managers + admins + owners can write).

const MAINTENANCE_STATUS_VALUES = new Set([
  'scheduled', 'in_progress', 'completed', 'cancelled'
]);
const MAINTENANCE_RECURRENCE_VALUES = new Set([
  'one_time', 'weekly', 'monthly', 'quarterly', 'yearly'
]);

/**
 * GET /api/homes/:id/maintenance
 *
 * Returns every maintenance task for a home, newest-due first when a
 * `due_date` exists and falling back to `performed_at` for historical
 * rows. The Scheduled / Completed / All client-side tabs filter by
 * `status` (Scheduled = `scheduled|in_progress`).
 */
router.get('/:id/maintenance', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;
    const { status } = req.query;

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    let query = supabaseAdmin
      .from('HomeMaintenanceLog')
      .select('*')
      .eq('home_id', homeId)
      .order('due_date', { ascending: true });

    if (status) {
      if (!MAINTENANCE_STATUS_VALUES.has(status)) {
        return res.status(400).json({ error: 'Invalid status filter' });
      }
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('Error fetching home maintenance', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch maintenance' });
    }

    res.json({ tasks: data || [] });
  } catch (err) {
    logger.error('Maintenance fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch maintenance' });
  }
});

/**
 * POST /api/homes/:id/maintenance
 *
 * Body: { task, vendor?, cost?, recurrence?, due_date?, status? }.
 *  - `task` is required (non-empty); everything else is optional.
 *  - `status` defaults to `scheduled`; `recurrence` defaults to `one_time`.
 */
router.post('/:id/maintenance', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'home.edit');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to manage maintenance' });

    const { task, vendor, cost, recurrence, due_date, status } = req.body || {};

    if (!task || typeof task !== 'string' || !task.trim()) {
      return res.status(400).json({ error: 'task is required' });
    }
    if (status && !MAINTENANCE_STATUS_VALUES.has(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    if (recurrence && !MAINTENANCE_RECURRENCE_VALUES.has(recurrence)) {
      return res.status(400).json({ error: 'Invalid recurrence' });
    }

    const { data, error } = await supabaseAdmin
      .from('HomeMaintenanceLog')
      .insert({
        home_id: homeId,
        task: task.trim(),
        vendor: vendor || null,
        cost: cost == null ? null : cost,
        recurrence: recurrence || 'one_time',
        due_date: due_date || null,
        status: status || 'scheduled',
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating maintenance task', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to create maintenance task' });
    }

    res.status(201).json({ task: data });
  } catch (err) {
    logger.error('Maintenance create error', { error: err.message });
    res.status(500).json({ error: 'Failed to create maintenance task' });
  }
});

/**
 * PUT /api/homes/:id/maintenance/:taskId
 *
 * Whitelisted patch — only the design-spec fields are accepted, plus
 * `updated_at` always refreshed. Auto-stamps `performed_at` +
 * `performed_by` when the row flips to `completed` (so the historical
 * `HomeMaintenanceLog` interpretation stays consistent).
 */
router.put('/:id/maintenance/:taskId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, taskId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'home.edit');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to manage maintenance' });

    const allowed = ['task', 'vendor', 'cost', 'recurrence', 'due_date', 'status'];
    const updates = {};
    for (const key of allowed) {
      if (req.body && req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.status && !MAINTENANCE_STATUS_VALUES.has(updates.status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    if (updates.recurrence && !MAINTENANCE_RECURRENCE_VALUES.has(updates.recurrence)) {
      return res.status(400).json({ error: 'Invalid recurrence' });
    }

    if (updates.status === 'completed') {
      updates.performed_at = new Date().toISOString();
      updates.performed_by = userId;
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('HomeMaintenanceLog')
      .update(updates)
      .eq('id', taskId)
      .eq('home_id', homeId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating maintenance task', { error: error.message, taskId });
      return res.status(500).json({ error: 'Failed to update maintenance task' });
    }
    if (!data) return res.status(404).json({ error: 'Maintenance task not found' });

    res.json({ task: data });
  } catch (err) {
    logger.error('Maintenance update error', { error: err.message });
    res.status(500).json({ error: 'Failed to update maintenance task' });
  }
});

/**
 * DELETE /api/homes/:id/maintenance/:taskId
 *
 * Hard-delete. Bills used soft-delete (`status='cancelled'`) because
 * splits + audit reasons; maintenance has no downstream constraints,
 * so hard-delete is fine. Web/mobile clients can still opt to mark
 * `status='cancelled'` via PUT for soft-cancel UX.
 */
router.delete('/:id/maintenance/:taskId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, taskId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'home.edit');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to manage maintenance' });

    const { error } = await supabaseAdmin
      .from('HomeMaintenanceLog')
      .delete()
      .eq('id', taskId)
      .eq('home_id', homeId);

    if (error) {
      logger.error('Error deleting maintenance task', { error: error.message, taskId });
      return res.status(500).json({ error: 'Failed to delete maintenance task' });
    }

    res.status(204).end();
  } catch (err) {
    logger.error('Maintenance delete error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete maintenance task' });
  }
});


// ============ HOME PACKAGES ============

/**
 * GET /api/homes/:id/packages
 */
router.get('/:id/packages', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (Joi.string().uuid().validate(req.params.id).error) return res.status(400).json({ error: 'Invalid Home id' });
  const dashboardService = require('../services/homeDashboardService');
  try {
    const records = await dashboardService.readResource({ homeId: req.params.id, actorId: req.user.id,
      kind: 'packages', status: req.query.status, severity: req.query.severity });
    return res.json({ packages: records });
  } catch (error) { return dashboardService.sendError(res, error); }
});

/**
 * POST /api/homes/:id/packages
 */
router.post('/:id/packages', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const { carrier, tracking_number, vendor_name, description, delivery_instructions, expected_at } = req.body;

    const { data, error } = await supabaseAdmin
      .from('HomePackage')
      .insert({
        home_id: homeId,
        carrier: carrier || null,
        tracking_number: tracking_number || null,
        vendor_name: vendor_name || null,
        description: description || null,
        delivery_instructions: delivery_instructions || null,
        expected_at: expected_at || null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating home package', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to create package' });
    }

    res.status(201).json({ package: data });
  } catch (err) {
    logger.error('Package creation error', { error: err.message });
    res.status(500).json({ error: 'Failed to create package' });
  }
});

/**
 * PUT /api/homes/:id/packages/:packageId
 */
router.put('/:id/packages/:packageId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, packageId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const allowed = ['status', 'delivered_at', 'picked_up_by', 'carrier', 'tracking_number', 'description', 'delivery_instructions', 'expected_at'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.status === 'delivered' && !updates.delivered_at) {
      updates.delivered_at = new Date().toISOString();
    }
    if (updates.status === 'picked_up' && !updates.picked_up_by) {
      updates.picked_up_by = userId;
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('HomePackage')
      .update(updates)
      .eq('id', packageId)
      .eq('home_id', homeId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating home package', { error: error.message, packageId });
      return res.status(500).json({ error: 'Failed to update package' });
    }

    res.json({ package: data });
  } catch (err) {
    logger.error('Package update error', { error: err.message });
    res.status(500).json({ error: 'Failed to update package' });
  }
});


// ============ HOME CALENDAR EVENTS ============

registerHomeRecordRoutes('events', 'event');
router.post('/:id/events/:eventId/rsvp', verifyToken, async (req, res) => {
  try {
    const result = await homeRecordService.mutate({ homeId: req.params.id, actorId: req.user.id,
      kind: 'event', action: 'rsvp', recordId: req.params.eventId, payload: req.body });
    res.json({ attendee: result.attendee });
  } catch (error) { homeRecordService.sendError(res, error); }
});


// ============ HOME DOCUMENTS ============

const createHomeDocumentSchema = Joi.object({
  doc_type: Joi.string().valid(...HOME_DOCUMENT_TYPES).required(),
  title: Joi.string().trim().min(1).max(255).required(),
  visibility: Joi.string().valid(...HOME_DOCUMENT_VISIBILITIES).default('members'),
  // File attachments are created by the authenticated multipart route, which
  // owns the storage path and verifies bytes. Metadata cannot attach a raw key.
  file_id: Joi.any().valid(null),
  storage_bucket: Joi.any().valid(null, ''),
  storage_path: Joi.any().valid(null, ''),
  mime_type: Joi.string().max(255).allow(null, ''),
  size_bytes: Joi.number().integer().min(0).allow(null),
  details: Joi.object().custom((value, helpers) => {
    if (Object.keys(value).some(key => key.startsWith('upload_') || ['storage_contract', 'preview_url', 'original_filename'].includes(key))) {
      return helpers.error('any.invalid');
    }
    return value;
  }).default({}),
});

/**
 * GET /api/homes/:id/documents
 */
router.get('/:id/documents', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'docs.view');
    if (access.readFailed) return res.status(503).json({ error: 'Could not check home access. Try again.' });
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const visibility = await homeDocumentVisibilities(homeId, userId, access);
    if (visibility.readFailed) return res.status(503).json({ error: 'Could not check document access. Try again.' });

    const query = supabaseAdmin
      .from('HomeDocument')
      .select('*')
      .eq('home_id', homeId)
      .in('visibility', visibility.allowed)
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
      logger.error('Error fetching home documents', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch documents' });
    }

    res.json({ documents: (data || []).map(serializeHomeDocument) });
  } catch (err) {
    logger.error('Documents fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

/**
 * POST /api/homes/:id/documents
 */
router.post('/:id/documents', verifyToken, validate(createHomeDocumentSchema), async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'docs.upload');
    if (access.readFailed) return res.status(503).json({ error: 'Could not check home access. Try again.' });
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const { file_id, doc_type, title, storage_bucket, storage_path, mime_type, size_bytes, visibility, details } = req.body;

    const documentVisibility = await homeDocumentVisibilities(homeId, userId, access);
    if (documentVisibility.readFailed) return res.status(503).json({ error: 'Could not check document access. Try again.' });
    if (!documentVisibility.allowed.includes(visibility)) return res.status(403).json({ error: 'No access to that document visibility' });

    const { data, error } = await supabaseAdmin
      .from('HomeDocument')
      .insert({
        home_id: homeId,
        file_id: file_id || null,
        doc_type,
        title,
        storage_bucket: storage_bucket || null,
        storage_path: storage_path || null,
        mime_type: mime_type || null,
        size_bytes: size_bytes || null,
        visibility: visibility || 'members',
        details: details || {},
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating home document', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to create document' });
    }

    res.status(201).json({ document: data });
  } catch (err) {
    logger.error('Document creation error', { error: err.message });
    res.status(500).json({ error: 'Failed to create document' });
  }
});


// ============ HOME VENDORS ============

/**
 * GET /api/homes/:id/vendors
 */
router.get('/:id/vendors', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const { data, error } = await supabaseAdmin
      .from('HomeVendor')
      .select('*')
      .eq('home_id', homeId)
      .order('name', { ascending: true });

    if (error) {
      logger.error('Error fetching home vendors', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch vendors' });
    }

    res.json({ vendors: data || [] });
  } catch (err) {
    logger.error('Vendors fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

/**
 * POST /api/homes/:id/vendors
 */
router.post('/:id/vendors', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const { name, service_category, phone, email, website, contact, rating, notes } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });

    const { data, error } = await supabaseAdmin
      .from('HomeVendor')
      .insert({
        home_id: homeId,
        name,
        service_category: service_category || null,
        phone: phone || null,
        email: email || null,
        website: website || null,
        contact: contact || {},
        rating: rating || null,
        notes: notes || null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating home vendor', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to create vendor' });
    }

    res.status(201).json({ vendor: data });
  } catch (err) {
    logger.error('Vendor creation error', { error: err.message });
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

/**
 * PUT /api/homes/:id/vendors/:vendorId
 */
router.put('/:id/vendors/:vendorId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, vendorId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const allowed = ['name', 'service_category', 'phone', 'email', 'website', 'contact', 'rating', 'notes', 'trusted', 'history'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('HomeVendor')
      .update(updates)
      .eq('id', vendorId)
      .eq('home_id', homeId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating home vendor', { error: error.message, vendorId });
      return res.status(500).json({ error: 'Failed to update vendor' });
    }

    res.json({ vendor: data });
  } catch (err) {
    logger.error('Vendor update error', { error: err.message });
    res.status(500).json({ error: 'Failed to update vendor' });
  }
});


// ============ HOME ↔ BUSINESS LINKS ============
// (Favorite / vendor / recommended / blocked businesses)

/**
 * GET /api/homes/:id/businesses
 * List all businesses linked to this home
 */
router.get('/:id/businesses', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const { data, error } = await supabaseAdmin
      .from('HomeBusinessLink')
      .select('id, home_id, business_user_id, kind, notes, created_by, created_at')
      .eq('home_id', homeId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching home business links', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch linked businesses' });
    }

    // Enrich with business user info
    const businessIds = (data || []).map(l => l.business_user_id);
    let businesses = [];
    if (businessIds.length > 0) {
      const { data: bizUsers } = await supabaseAdmin
        .from('User')
        .select('id, username, name, profile_picture_url, average_rating, review_count')
        .in('id', businessIds);

      const { data: profiles } = await supabaseAdmin
        .from('BusinessProfile')
        .select('business_user_id, categories, business_type, public_phone, website, is_published')
        .in('business_user_id', businessIds);

      const bizMap = {};
      for (const u of (bizUsers || [])) bizMap[u.id] = u;
      const profMap = {};
      for (const p of (profiles || [])) profMap[p.business_user_id] = p;

      businesses = (data || []).map(link => ({
        ...link,
        business: bizMap[link.business_user_id] || null,
        profile: profMap[link.business_user_id] || null,
      }));
    } else {
      businesses = data || [];
    }

    res.json({ links: businesses });
  } catch (err) {
    logger.error('Home business links fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch linked businesses' });
  }
});

/**
 * POST /api/homes/:id/businesses
 * Link a business to this home
 */
const linkBusinessSchema = Joi.object({
  business_user_id: Joi.string().uuid().optional(),
  username: Joi.string().optional(),
  kind: Joi.string().valid('favorite', 'vendor', 'building_amenity', 'recommended', 'blocked').default('favorite'),
  notes: Joi.string().allow('', null).optional(),
}).or('business_user_id', 'username');

router.post('/:id/businesses', verifyToken, validate(linkBusinessSchema), async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'vendors.manage');
    if (!access.hasAccess) return res.status(403).json({ error: 'No access' });
    if (!access.hasPermission) return res.status(403).json({ error: 'Missing vendors.manage permission' });

    let businessUserId = req.body.business_user_id;

    // Resolve by username if needed
    if (!businessUserId && req.body.username) {
      const { data: bizUser } = await supabaseAdmin
        .from('User')
        .select('id')
        .eq('username', req.body.username)
        .eq('account_type', 'business')
        .single();

      if (!bizUser) return res.status(404).json({ error: 'Business not found' });
      businessUserId = bizUser.id;
    }

    // Verify the target is actually a business
    const { data: targetUser } = await supabaseAdmin
      .from('User')
      .select('id, account_type')
      .eq('id', businessUserId)
      .single();

    if (!targetUser || targetUser.account_type !== 'business') {
      return res.status(400).json({ error: 'Target user is not a business account' });
    }

    const { data, error } = await supabaseAdmin
      .from('HomeBusinessLink')
      .insert({
        home_id: homeId,
        business_user_id: businessUserId,
        kind: req.body.kind || 'favorite',
        notes: req.body.notes || null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'This business is already linked with that kind' });
      }
      logger.error('Error linking business', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to link business' });
    }

    res.status(201).json({ link: data });
  } catch (err) {
    logger.error('Business link creation error', { error: err.message });
    res.status(500).json({ error: 'Failed to link business' });
  }
});

/**
 * PATCH /api/homes/:id/businesses/:linkId
 * Update a home-business link (change kind or notes)
 */
router.patch('/:id/businesses/:linkId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, linkId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'vendors.manage');
    if (!access.hasAccess) return res.status(403).json({ error: 'No access' });
    if (!access.hasPermission) return res.status(403).json({ error: 'Missing vendors.manage permission' });

    const allowed = ['kind', 'notes'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data, error } = await supabaseAdmin
      .from('HomeBusinessLink')
      .update(updates)
      .eq('id', linkId)
      .eq('home_id', homeId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating business link', { error: error.message, linkId });
      return res.status(500).json({ error: 'Failed to update link' });
    }

    res.json({ link: data });
  } catch (err) {
    logger.error('Business link update error', { error: err.message });
    res.status(500).json({ error: 'Failed to update link' });
  }
});

/**
 * DELETE /api/homes/:id/businesses/:linkId
 * Remove a home-business link
 */
router.delete('/:id/businesses/:linkId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, linkId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'vendors.manage');
    if (!access.hasAccess) return res.status(403).json({ error: 'No access' });
    if (!access.hasPermission) return res.status(403).json({ error: 'Missing vendors.manage permission' });

    const { error } = await supabaseAdmin
      .from('HomeBusinessLink')
      .delete()
      .eq('id', linkId)
      .eq('home_id', homeId);

    if (error) {
      logger.error('Error removing business link', { error: error.message, linkId });
      return res.status(500).json({ error: 'Failed to remove link' });
    }

    res.json({ message: 'Business link removed' });
  } catch (err) {
    logger.error('Business link deletion error', { error: err.message });
    res.status(500).json({ error: 'Failed to remove link' });
  }
});

/**
 * GET /api/homes/:id/businesses/search
 * Search businesses to link (by name/username)
 */
router.get('/:id/businesses/search', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;
    const q = (req.query.q || '').trim();

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    if (!q || q.length < 2) return res.json({ results: [] });

    const { data: businesses } = await supabaseAdmin
      .from('User')
      .select('id, username, name, profile_picture_url, average_rating, review_count')
      .eq('account_type', 'business')
      .or(`name.ilike.%${q}%,username.ilike.%${q}%`)
      .limit(10);

    // Also get profile info for results
    const ids = (businesses || []).map(b => b.id);
    let profileMap = {};
    if (ids.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('BusinessProfile')
        .select('business_user_id, categories, business_type, is_published')
        .in('business_user_id', ids)
        .eq('is_published', true);
      for (const p of (profiles || [])) profileMap[p.business_user_id] = p;
    }

    const results = (businesses || [])
      .filter(b => profileMap[b.id]) // Only show published businesses
      .map(b => ({
        ...b,
        profile: profileMap[b.id],
      }));

    res.json({ results });
  } catch (err) {
    logger.error('Business search error', { error: err.message });
    res.status(500).json({ error: 'Failed to search businesses' });
  }
});


// ============ HOME EMERGENCY INFO ============

/**
 * GET /api/homes/:id/emergencies
 */
router.get('/:id/emergencies', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const { data, error } = await supabaseAdmin
      .from('HomeEmergency')
      .select('*')
      .eq('home_id', homeId)
      .order('type', { ascending: true });

    if (error) {
      logger.error('Error fetching home emergencies', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch emergency info' });
    }

    // Map to frontend-friendly field names
    const emergencies = (data || []).map(e => ({
      ...e,
      info_type: e.type,
      location_in_home: e.location,
    }));

    res.json({ emergencies });
  } catch (err) {
    logger.error('Emergencies fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch emergency info' });
  }
});

/**
 * POST /api/homes/:id/emergencies
 */
router.post('/:id/emergencies', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'can_manage_home');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to manage home' });

    const { type, label, location, details } = req.body;

    if (!type || !label) {
      return res.status(400).json({ error: 'type and label are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('HomeEmergency')
      .insert({
        home_id: homeId,
        type,
        label,
        location: location || null,
        details: details || {},
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating home emergency', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to create emergency info' });
    }

    res.status(201).json({ emergency: { ...data, info_type: data.type, location_in_home: data.location } });
  } catch (err) {
    logger.error('Emergency creation error', { error: err.message });
    res.status(500).json({ error: 'Failed to create emergency info' });
  }
});


// ============ HOME ACCESS SECRETS ============

/**
 * GET /api/homes/:id/access
 */
router.get('/:id/access', verifyToken, async (req, res) => {
  try {
    res.json({ secrets: await homeAccessSecretService.list(req.params.id, req.user.id) });
  } catch (err) {
    logger.error('Access secrets fetch error', { code: err.code, homeId: req.params.id });
    res.status(err.statusCode || 503).json({ error: err.message, code: err.code });
  }
});

/**
 * POST /api/homes/:id/access
 */
router.post('/:id/access', verifyToken, async (req, res) => {
  try {
    const secret = await homeAccessSecretService.mutate({ homeId: req.params.id, actorId: req.user.id,
      action: 'create', payload: req.body });
    res.status(201).json({ secret });
  } catch (err) {
    logger.error('Access secret creation error', { code: err.code, homeId: req.params.id });
    res.status(err.statusCode || 503).json({ error: err.message, code: err.code });
  }
});

/**
 * PUT /api/homes/:id/access/:secretId
 */
router.put('/:id/access/:secretId', verifyToken, async (req, res) => {
  try {
    const secret = await homeAccessSecretService.mutate({ homeId: req.params.id, actorId: req.user.id,
      secretId: req.params.secretId, action: 'update', payload: req.body });
    res.json({ secret });
  } catch (err) {
    logger.error('Access secret update error', { code: err.code, homeId: req.params.id });
    res.status(err.statusCode || 503).json({ error: err.message, code: err.code });
  }
});

/**
 * DELETE /api/homes/:id/access/:secretId
 */
router.delete('/:id/access/:secretId', verifyToken, async (req, res) => {
  try {
    await homeAccessSecretService.mutate({ homeId: req.params.id, actorId: req.user.id,
      secretId: req.params.secretId, action: 'delete' });
    res.json({ message: 'Access secret deleted' });
  } catch (err) {
    logger.error('Access secret delete error', { code: err.code, homeId: req.params.id });
    res.status(err.statusCode || 503).json({ error: err.message, code: err.code });
  }
});


// ============ HOME INVITES ============

/**
 * POST /api/homes/:id/invite
 * 
 * Creates a home invitation.
 * - If email provided: checks if user exists in system → sets invitee_user_id too
 * - If user_id provided: fetches their email for notification
 * - Checks for duplicate pending invites
 * - Sends invitation email
 */
router.post('/:id/invite', verifyToken, homeOutboundLimiter, async (req, res) => {
  try {
    const result = await homeInvitationService.write({ homeId: req.params.id, actorId: req.user.id,
      action: 'create', payload: req.body });
    const emailSent = await homeInvitationService.notifyCreated(result, req.body.message);
    res.status(201).json({ invitation: result.invitation, emailSent });
  } catch (err) {
    logger.error('Create home invitation failed', { code: err.code, homeId: req.params.id });
    res.status(err.statusCode || 503).json({ error: err.message, code: err.code });
  }
});




// ============ HOME DEVICES ============

/**
 * GET /api/homes/:id/devices
 */
router.get('/:id/devices', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const { data, error } = await supabaseAdmin
      .from('HomeDevice')
      .select('*')
      .eq('home_id', homeId)
      .order('label', { ascending: true });

    if (error) {
      logger.error('Error fetching home devices', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch devices' });
    }

    res.json({ devices: data || [] });
  } catch (err) {
    logger.error('Devices fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

/**
 * POST /api/homes/:id/devices
 */
router.post('/:id/devices', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'can_manage_home');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to manage home' });

    const { device_type, label, status: deviceStatus, settings, access_codes, battery_change_date } = req.body;

    if (!device_type || !label) {
      return res.status(400).json({ error: 'device_type and label are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('HomeDevice')
      .insert({
        home_id: homeId,
        device_type,
        label,
        status: deviceStatus || 'offline',
        settings: settings || {},
        access_codes: access_codes || {},
        battery_change_date: battery_change_date || null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating home device', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to create device' });
    }

    res.status(201).json({ device: data });
  } catch (err) {
    logger.error('Device creation error', { error: err.message });
    res.status(500).json({ error: 'Failed to create device' });
  }
});


// ============ HOME ASSETS ============

/**
 * GET /api/homes/:id/assets
 */
router.get('/:id/assets', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const { data, error } = await supabaseAdmin
      .from('HomeAsset')
      .select('*')
      .eq('home_id', homeId)
      .order('name', { ascending: true });

    if (error) {
      logger.error('Error fetching home assets', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch assets' });
    }

    res.json({ assets: data || [] });
  } catch (err) {
    logger.error('Assets fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

/**
 * POST /api/homes/:id/assets
 */
router.post('/:id/assets', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const { category, name, room, brand, model, serial_number, purchase_date, purchase_price, warranty_expires_at, notes, details } = req.body;

    if (!category || !name) {
      return res.status(400).json({ error: 'category and name are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('HomeAsset')
      .insert({
        home_id: homeId,
        category,
        name,
        room: room || null,
        brand: brand || null,
        model: model || null,
        serial_number: serial_number || null,
        purchase_date: purchase_date || null,
        purchase_price: purchase_price || null,
        warranty_expires_at: warranty_expires_at || null,
        notes: notes || null,
        details: details || {},
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating home asset', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to create asset' });
    }

    res.status(201).json({ asset: data });
  } catch (err) {
    logger.error('Asset creation error', { error: err.message });
    res.status(500).json({ error: 'Failed to create asset' });
  }
});


// ============ DASHBOARD AGGREGATE ============

router.get('/:id/dashboard-access', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (Joi.string().uuid().validate(req.params.id).error) return res.status(400).json({ error: 'Invalid Home id' });
  const dashboardService = require('../services/homeDashboardService');
  try {
    const access = await dashboardService.readAuthority({ homeId: req.params.id, actorId: req.user.id });
    return res.status(access.hasAccess ? 200 : 403).json(access);
  } catch (error) { return dashboardService.sendError(res, error); }
});

/**
 * GET /api/homes/:id/dashboard
 * Returns card-based dashboard data in a single request
 */
router.get('/:id/dashboard', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (Joi.string().uuid().validate(req.params.id).error) return res.status(400).json({ error: 'Invalid Home id' });
  const dashboardService = require('../services/homeDashboardService');
  try {
    const dashboard = await dashboardService.read({
      homeId: req.params.id, actorId: req.user.id,
      includeHealthScore: req.query.include_health_score === 'true',
    });
    return res.json({ ...dashboard, task_session: { ...getRequestSessionScope(req), home_id: req.params.id } });
  } catch (error) {
    return dashboardService.sendError(res, error);
  }
});


// ============ RESIDENCY CLAIMS (Provisional Residency) ============

/**
 * POST /:id/claim - Submit a residency claim for a home
 * Allows users to claim provisional residency.
 * Provisional users get local/public discovery access.
 * Mailbox and private home surfaces remain locked until verified.
 */
// postcardLimiter sits AFTER verifyToken so it keys on the user id. The only
// limiter otherwise covering this route is homeCreationLimiter, which app.js
// mounts before any authentication runs — keyed on IP, shared with every other
// home write. The cold-start branch below spends real postage per request, so
// it gets the same 3-per-hour per-user budget as request-postcard.
const { postcardLimiter: claimPostcardLimiter, homeResidencySubmissionLimiter } = require('../middleware/rateLimiter');
const residencySubmission = require('../services/homeResidencySubmissionService');
const residencySubmissionNoStore = (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); };
// New clients retain the original UUID before submitting. This command saves
// pending admission and its next step; postcard delivery has its own request.
router.post('/:id/residency-submissions', residencySubmissionNoStore, verifyToken, homeResidencySubmissionLimiter, async (req, res) => {
  try {
    const { request_id, ...intent } = req.body || {};
    residencySubmission.send(res, await residencySubmission.submit({ homeId: req.params.id,
      actorId: req.user.id, requestId: request_id, intent }));
  } catch (error) { residencySubmission.sendError(res, error); }
});
router.get('/:id/residency-submissions/:requestId', residencySubmissionNoStore, verifyToken, async (req, res) => {
  try { residencySubmission.send(res, await residencySubmission.read({ homeId: req.params.id,
    actorId: req.user.id, requestId: req.params.requestId })); }
  catch (error) { residencySubmission.sendError(res, error); }
});
router.post('/:id/residency-submissions/:requestId/cancel', residencySubmissionNoStore, verifyToken, async (req, res) => {
  try { residencySubmission.send(res, await residencySubmission.cancel({ homeId: req.params.id,
    actorId: req.user.id, requestId: req.params.requestId })); }
  catch (error) { residencySubmission.sendError(res, error); }
});

router.post('/:id/claim', verifyToken, claimPostcardLimiter, async (req, res) => {
  try {
    const homeId = req.params.id;
    const userId = req.user.id;
    const { claimed_address, claimed_role } = req.body;

    // Verify home exists
    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('id, address, address2, city, state, zipcode')
      .eq('id', homeId)
      .single();

    if (!home) {
      return res.status(404).json({ error: 'Home not found' });
    }

    // Check if already an active member
    const { data: existingOccupancy } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('id')
      .eq('home_id', homeId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (existingOccupancy) {
      return res.status(400).json({ error: 'You are already a member of this home' });
    }

    // Check for existing pending claim
    const { data: existingClaim } = await supabaseAdmin
      .from('HomeResidencyClaim')
      .select('id, status')
      .eq('home_id', homeId)
      .eq('user_id', userId)
      .single();

    if (existingClaim) {
      if (existingClaim.status === 'pending') {
        return res.status(400).json({ error: 'You already have a pending claim for this home' });
      }
      if (existingClaim.status === 'verified') {
        return res.status(400).json({ error: 'Your residency has already been verified' });
      }
      // Rejected claim: allow re-claim by updating
      const { data: updated, error } = await supabaseAdmin
        .from('HomeResidencyClaim')
        .update({
          status: 'pending',
          claimed_address: claimed_address || home.address,
          claimed_role: claimed_role || existingClaim.claimed_role || 'member',
          reviewed_by: null,
          reviewed_at: null,
          review_note: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingClaim.id)
        .select()
        .single();

      if (error) {
        logger.error('Error re-submitting claim', { error: error.message });
        return res.status(500).json({ error: 'Failed to submit claim' });
      }

      // Notify home authorities
      await notifyHomeAuthorities(homeId, userId, 'residency_claim', claimed_role);

      return res.json({ message: 'Residency claim re-submitted', claim: updated });
    }

    // Create new claim
    const { data: claim, error } = await supabaseAdmin
      .from('HomeResidencyClaim')
      .insert({
        home_id: homeId,
        user_id: userId,
        claimed_address: claimed_address || home.address,
        claimed_role: claimed_role || 'member',
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      // 23505 = unique_violation from idx_residency_claim_one_pending_per_user
      if (error.code === '23505') {
        return res.status(409).json({
          error: 'You already have a pending residency claim for this home',
          code: 'DUPLICATE_CLAIM',
        });
      }
      logger.error('Error creating residency claim', { error: error.message });
      return res.status(500).json({ error: 'Failed to submit residency claim' });
    }

    // --- 3-path cold-start routing (BUG 3A fix) ---
    // Determine how to route this claim based on authority count.

    // 1. Count active authorities
    const { data: authorities, error: authoritiesError } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('user_id')
      .eq('home_id', homeId)
      .eq('is_active', true)
      .in('role_base', ['owner', 'admin', 'manager']);
    if (authoritiesError || !authorities) throw new Error('Could not check household authorities');
    const authorityCount = authorities.length;

    // 2. Get home creator
    const { data: homeForCreator } = await supabaseAdmin
      .from('Home')
      .select('created_by_user_id')
      .eq('id', homeId)
      .single();

    const effectiveRole = mapLegacyRole(claimed_role || 'member');

    if (authorityCount === 0 && userId === homeForCreator?.created_by_user_id) {
      // PATH 1 — Self-bootstrap: creator is first person at this address
      await applyOccupancyTemplate(homeId, userId, effectiveRole, 'provisional_bootstrap');
      await supabaseAdmin
        .from('HomeResidencyClaim')
        .update({ cold_start_mode: 'self_bootstrap', updated_at: new Date().toISOString() })
        .eq('id', claim.id);

      return res.status(201).json({
        message: 'You have provisional access. Verify your address to unlock full features.',
        claim,
        verification_needed: true,
        cold_start: true,
      });

    } else if (authorityCount === 0) {
      // PATH 2 — External cold-start: no authorities, not the creator
      const coldStartMail = await homePostcardService.request(homeId, userId);
      if (coldStartMail.status >= 400) return res.status(coldStartMail.status).json(coldStartMail.body);
      const postcard = coldStartMail.body.postcard;

      await applyOccupancyTemplate(homeId, userId, 'member', 'pending_postcard');
      await supabaseAdmin
        .from('HomeResidencyClaim')
        .update({
          cold_start_mode: 'external_postcard',
          postcard_auto_routed: true,
          postcard_code_id: postcard?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', claim.id);

      return res.status(201).json({
        message: coldStartMail.body.message,
        claim,
        postcard_requested: true,
        delivery_unknown: coldStartMail.body.delivery_unknown,
      });

    } else {
      // PATH 3 — Normal: home has active authorities

      // Check for stale authorities (all inactive for 30+ days).
      //
      // LIF-03: this used to filter `User.last_sign_in_at`, a column that does
      // not exist on the public User table — it lives on auth.users. The query
      // therefore errored, `activeAuthUsers` was always empty, and EVERY
      // move-in conflict was classified "all authorities stale" and routed away
      // from the household. Now that postcards are actually mailed, that
      // misrouting would let a stranger bypass household approval entirely, so
      // this reads the real source and fails closed: any uncertainty means the
      // authorities are treated as active and the household is asked.
      const authoritiesStale = await allAuthoritiesStale(
        authorities.map(a => a.user_id), 30,
      );

      if (authoritiesStale) {
        // All authorities are stale — treat as cold-start (PATH 2 fallback)
        const staleMail = await homePostcardService.request(homeId, userId);
        if (staleMail.status >= 400) return res.status(staleMail.status).json(staleMail.body);
        const postcard = staleMail.body.postcard;

        await applyOccupancyTemplate(homeId, userId, 'member', 'pending_postcard');
        await supabaseAdmin
          .from('HomeResidencyClaim')
          .update({
            cold_start_mode: 'stale_authority_postcard',
            postcard_auto_routed: true,
            postcard_code_id: postcard?.id || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', claim.id);

        return res.status(201).json({
          message: staleMail.body.message,
          claim,
          postcard_requested: true,
          delivery_unknown: staleMail.body.delivery_unknown,
        });
      }

      // At least one active authority — normal human approval path
      await applyOccupancyTemplate(homeId, userId, effectiveRole, 'pending_approval');
      await notifyHomeAuthorities(homeId, userId, 'residency_claim', claimed_role);

      return res.status(201).json({ message: 'Residency claim submitted', claim });
    }
  } catch (err) {
    logger.error('Residency claim error', { error: err.message });
    res.status(500).json({ error: 'Failed to submit residency claim' });
  }
});

/**
 * GET /:id/claims - List pending residency claims for a home
 * Only home owners/admins/managers can view.
 */
router.get('/:id/claims', verifyToken, async (req, res) => {
  try {
    const homeId = req.params.id;
    const userId = req.user.id;

    const { checkHomePermission } = require('../utils/homePermissions');
    const access = await checkHomePermission(homeId, userId, 'members.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Not authorized to view claims' });
    }

    const { data: claims, error } = await supabaseAdmin
      .from('HomeResidencyClaim')
      .select(`
        *,
        claimant:user_id (id, username, name, first_name, last_name, profile_picture_url, city, state)
      `)
      .eq('home_id', homeId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching claims', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch claims' });
    }

    res.json({ claims: claims || [] });
  } catch (err) {
    logger.error('List claims error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

/** Prepared current review; this session proof never grants membership authority. */
router.get('/:id/claim/:claimId/review', verifyToken, async (req, res) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    if (!requireExpectedSessionScope(req, res)) return;
    const session = getRequestSessionScope(req);
    const result = await homeResidencyReviewService.read({ homeId: req.params.id,
      claimId: req.params.claimId, actorId: req.user.id });
    res.json({ ...result, residency_session: { ...session, home_id: result.home_id } });
  } catch (error) { homeResidencyReviewService.sendError(res, error); }
});

const residencyDecisionIdentity = {
  request_id: Joi.string().guid(),
  review_token: Joi.string().pattern(/^[a-f0-9]{64}$/),
};
const residencyApprovalSchema = Joi.object({
  ...residencyDecisionIdentity, proposed_role: Joi.string().trim().max(64).allow('', null),
}).and('request_id', 'review_token');
const residencyRejectionSchema = Joi.object({
  ...residencyDecisionIdentity, reason: Joi.string().trim().max(2000).allow('', null),
}).and('request_id', 'review_token');

/** Original approval receipt and today's membership are returned separately. */
router.post('/:id/claim/:claimId/approve', verifyToken, validate(residencyApprovalSchema), async (req, res) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    if (!requireExpectedSessionScope(req, res, { required: req.body.request_id !== undefined })) return;
    const session = getRequestSessionScope(req);
    const result = await homeResidencyReviewService.decide({ homeId: req.params.id, actorId: req.user.id,
      action: 'approve', claimId: req.params.claimId, role: req.body.proposed_role,
      requestId: req.body.request_id, reviewToken: req.body.review_token });
    if (!result.replayed) {
      // The transaction is already committed. A notification failure must not
      // pretend the admission failed or cause the client to apply it again.
      try {
        await require('../services/notificationService').createNotification({
          userId: result.target_id, type: 'residency_approved', title: 'Welcome home!',
          body: `You've been verified at ${result.home_label || 'your home'}.`, icon: '🏡',
          link: `/homes/${req.params.id}/dashboard`,
          metadata: { home_id: req.params.id, claim_id: req.params.claimId },
        });
      } catch (err) { logger.error('Residency approval notification failed', { code: err.code }); }
    }
    res.json({ ...result, message: result.replayed
      ? 'Original approval confirmed. Review the current membership below.' : 'Claim approved, membership confirmed',
    residency_session: { ...session, home_id: result.home_id } });
  } catch (err) {
    logger.error('Approve claim error', { code: err.code, homeId: req.params.id });
    homeResidencyReviewService.sendError(res, err);
  }
});

/**
 * POST /:id/claim/:claimId/reject - Reject a residency claim
 */
router.post('/:id/claim/:claimId/reject', verifyToken, validate(residencyRejectionSchema), async (req, res) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    if (!requireExpectedSessionScope(req, res, { required: req.body.request_id !== undefined })) return;
    const session = getRequestSessionScope(req);
    const result = await homeResidencyReviewService.decide({ homeId: req.params.id, actorId: req.user.id,
      action: 'reject', claimId: req.params.claimId, reason: req.body.reason,
      requestId: req.body.request_id, reviewToken: req.body.review_token });
    if (!result.replayed) {
      try {
        await require('../services/notificationService').createNotification({
          userId: result.target_id, type: 'residency_rejected', title: 'Verification update',
          body: "We couldn't verify you for this home. You can try again or verify by mail.",
          icon: '📬', link: `/homes/${req.params.id}/waiting-room`,
          metadata: { home_id: req.params.id, claim_id: req.params.claimId },
        });
      } catch (err) { logger.error('Residency rejection notification failed', { code: err.code }); }
    }
    res.json({ ...result, message: result.replayed
      ? 'Original rejection confirmed. Review the current claim below.' : 'Claim rejected',
    residency_session: { ...session, home_id: result.home_id } });
  } catch (err) {
    logger.error('Reject claim error', { code: err.code, homeId: req.params.id });
    homeResidencyReviewService.sendError(res, err);
  }
});

/**
 * Helper: Generate a safe alphanumeric code for postcard verification.
 * Excludes confusing characters: 0/O, 1/I/L.
 */
/**
 * Are ALL of these users inactive for `days`?
 *
 * Fails closed: if any user's activity cannot be determined, they count as
 * active, so the caller keeps the household in the loop rather than falling
 * back to a self-service path.
 */
async function allAuthoritiesStale(userIds, days) {
  if (!Array.isArray(userIds) || userIds.length === 0) return false;

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  for (const userId of userIds) {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (error || !data?.user) return false;

      const lastSignIn = data.user.last_sign_in_at;
      if (!lastSignIn) return false;
      if (new Date(lastSignIn).getTime() > cutoff) return false;
    } catch (err) {
      logger.warn('allAuthoritiesStale: activity lookup failed, treating as active', {
        userId, error: err.message,
      });
      return false;
    }
  }

  return true;
}


/**
 * Helper: Notify home owners/admins about a new claim.
 */
async function notifyHomeAuthorities(homeId, claimantId, type, claimedRole) {
  try {
    const notificationService = require('../services/notificationService');

    // Get home name
    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('name, address')
      .eq('id', homeId)
      .single();

    // Get claimant name
    const { data: claimant } = await supabaseAdmin
      .from('User')
      .select('username, name, first_name')
      .eq('id', claimantId)
      .single();

    const claimantName = claimant?.name || claimant?.first_name || claimant?.username || 'Someone';
    const homeName = home?.name || home?.address || 'your home';
    const roleLabel = claimedRole ? ` as ${claimedRole}` : '';

    // Get home owners/admins
    const { data: authorities } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('user_id')
      .eq('home_id', homeId)
      .eq('is_active', true)
      .in('role_base', ['owner', 'admin', 'manager']);

    if (!authorities || authorities.length === 0) return;

    const notifications = authorities
      .filter(a => a.user_id !== claimantId)
      .map(a => ({
        userId: a.user_id,
        type: 'residency_claim',
        title: 'New home access request',
        body: `${claimantName} is requesting to join ${homeName}${roleLabel}.`,
        icon: '📩',
        link: `/homes/${homeId}/owners/review-claim`,
        metadata: { home_id: homeId, claimant_id: claimantId, claimed_role: claimedRole },
      }));

    if (notifications.length > 0) {
      await notificationService.createBulkNotifications(notifications);
    }
  } catch (err) {
    logger.warn('Failed to notify home authorities about claim', { error: err.message });
  }
}


// ============ HOME PETS ============

const createPetSchema = Joi.object({
  name: Joi.string().required().max(100),
  species: Joi.string().required().valid('dog', 'cat', 'bird', 'fish', 'reptile', 'rabbit', 'hamster', 'other'),
  breed: Joi.string().max(100).allow(null, ''),
  age_years: Joi.number().min(0).max(100).allow(null),
  weight_lbs: Joi.number().min(0).max(9999).allow(null),
  vet_name: Joi.string().max(200).allow(null, ''),
  vet_phone: Joi.string().max(30).allow(null, ''),
  vet_address: Joi.string().max(500).allow(null, ''),
  vaccine_notes: Joi.string().max(2000).allow(null, ''),
  feeding_schedule: Joi.string().max(1000).allow(null, ''),
  medications: Joi.string().max(1000).allow(null, ''),
  microchip_id: Joi.string().max(50).allow(null, ''),
  photo_url: Joi.string().uri().max(2000).allow(null, ''),
  notes: Joi.string().max(2000).allow(null, ''),
});

const updatePetSchema = createPetSchema.fork(
  ['name', 'species'],
  (field) => field.optional()
);

/**
 * GET /api/homes/:id/pets
 */
router.get('/:id/pets', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'home.view');
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const { data, error } = await supabaseAdmin
      .from('HomePet')
      .select('*')
      .eq('home_id', homeId)
      .order('created_at', { ascending: false });

    if (error) {
      // Table may not exist yet if migration hasn't been applied — return empty
      if (error.message && (error.message.includes('does not exist') || error.code === '42P01')) {
        logger.warn('HomePet table not found, returning empty', { homeId });
        return res.json({ pets: [] });
      }
      logger.error('Error fetching pets', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch pets' });
    }

    res.json({ pets: data || [] });
  } catch (err) {
    if (err.message && (err.message.includes('does not exist') || err.message.includes('42P01'))) {
      return res.json({ pets: [] });
    }
    logger.error('Pets fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch pets' });
  }
});

/**
 * POST /api/homes/:id/pets
 */
router.post('/:id/pets', verifyToken, validate(createPetSchema), async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'home.edit');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to add pets' });

    const {
      name, species, breed, age_years, weight_lbs,
      vet_name, vet_phone, vet_address, vaccine_notes,
      feeding_schedule, medications, microchip_id, photo_url, notes,
    } = req.body;

    const { data, error } = await supabaseAdmin
      .from('HomePet')
      .insert({
        home_id: homeId,
        name,
        species,
        breed: breed || null,
        age_years: age_years ?? null,
        weight_lbs: weight_lbs ?? null,
        vet_name: vet_name || null,
        vet_phone: vet_phone || null,
        vet_address: vet_address || null,
        vaccine_notes: vaccine_notes || null,
        feeding_schedule: feeding_schedule || null,
        medications: medications || null,
        microchip_id: microchip_id || null,
        photo_url: photo_url || null,
        notes: notes || null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating pet', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to create pet' });
    }

    writeAuditLog(homeId, userId, 'pet.create', 'HomePet', data.id, { name, species });

    res.status(201).json({ pet: data });
  } catch (err) {
    logger.error('Pet creation error', { error: err.message });
    res.status(500).json({ error: 'Failed to create pet' });
  }
});

/**
 * PUT /api/homes/:id/pets/:petId
 */
router.put('/:id/pets/:petId', verifyToken, validate(updatePetSchema), async (req, res) => {
  try {
    const { id: homeId, petId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'home.edit');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to edit pets' });

    const allowed = [
      'name', 'species', 'breed', 'age_years', 'weight_lbs',
      'vet_name', 'vet_phone', 'vet_address', 'vaccine_notes',
      'feeding_schedule', 'medications', 'microchip_id', 'photo_url', 'notes',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('HomePet')
      .update(updates)
      .eq('id', petId)
      .eq('home_id', homeId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating pet', { error: error.message, petId });
      return res.status(500).json({ error: 'Failed to update pet' });
    }

    if (!data) return res.status(404).json({ error: 'Pet not found' });

    writeAuditLog(homeId, userId, 'pet.update', 'HomePet', petId, { fields: Object.keys(updates) });

    res.json({ pet: data });
  } catch (err) {
    logger.error('Pet update error', { error: err.message });
    res.status(500).json({ error: 'Failed to update pet' });
  }
});

/**
 * DELETE /api/homes/:id/pets/:petId
 */
router.delete('/:id/pets/:petId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, petId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'home.edit');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to delete pets' });

    const { error } = await supabaseAdmin
      .from('HomePet')
      .delete()
      .eq('id', petId)
      .eq('home_id', homeId);

    if (error) {
      logger.error('Error deleting pet', { error: error.message, petId });
      return res.status(500).json({ error: 'Failed to delete pet' });
    }

    writeAuditLog(homeId, userId, 'pet.delete', 'HomePet', petId);

    res.json({ message: 'Pet deleted' });
  } catch (err) {
    logger.error('Pet delete error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete pet' });
  }
});


// ============ HOME POLLS ============

const createPollSchema = Joi.object({
  title: Joi.string().required().max(200),
  description: Joi.string().max(2000).allow(null, ''),
  poll_type: Joi.string().valid('single_choice', 'multiple_choice', 'yes_no', 'ranking').default('single_choice'),
  options: Joi.array().items(Joi.object()).min(2).max(20).required(),
  closes_at: Joi.date().iso().allow(null),
  visibility: Joi.string().valid('public', 'members', 'managers', 'sensitive').default('members'),
});

const updatePollSchema = Joi.object({
  title: Joi.string().max(200),
  description: Joi.string().max(2000).allow(null, ''),
  status: Joi.string().valid('open', 'closed', 'canceled'),
  closes_at: Joi.date().iso().allow(null),
  visibility: Joi.string().valid('public', 'members', 'managers', 'sensitive'),
});

const voteSchema = Joi.object({
  selected_options: Joi.alternatives().try(
    Joi.array().items(Joi.any()).min(1),
    Joi.any()
  ).required(),
});

/**
 * GET /api/homes/:id/polls
 */
router.get('/:id/polls', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'home.view');
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const { data: polls, error } = await supabaseAdmin
      .from('HomePoll')
      .select('*')
      .eq('home_id', homeId)
      .order('created_at', { ascending: false });

    if (error) {
      // Table may not exist yet if migration hasn't been applied — return empty
      if (error.message && (error.message.includes('does not exist') || error.code === '42P01')) {
        logger.warn('HomePoll table not found, returning empty', { homeId });
        return res.json({ polls: [] });
      }
      logger.error('Error fetching polls', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch polls' });
    }

    // Fetch vote counts for all polls
    const pollIds = (polls || []).map(p => p.id);
    let voteCounts = {};
    let myVotes = {};
    // Per-option breakdown: poll_id -> { option_key: count }. Mobile uses
    // this to render the "Leading: <option> · N votes" chip on the list
    // row without an N+1 fetch.
    let optionBreakdown = {};

    if (pollIds.length > 0) {
      const [countsRes, myVotesRes] = await Promise.allSettled([
        supabaseAdmin
          .from('HomePollVote')
          .select('poll_id, selected_options')
          .in('poll_id', pollIds),
        supabaseAdmin
          .from('HomePollVote')
          .select('poll_id, selected_options')
          .in('poll_id', pollIds)
          .eq('user_id', userId),
      ]);

      if (countsRes.status === 'fulfilled' && countsRes.value.data) {
        for (const v of countsRes.value.data) {
          voteCounts[v.poll_id] = (voteCounts[v.poll_id] || 0) + 1;
          const opts = Array.isArray(v.selected_options) ? v.selected_options : [v.selected_options];
          if (!optionBreakdown[v.poll_id]) optionBreakdown[v.poll_id] = {};
          for (const opt of opts) {
            if (opt == null) continue;
            const key = typeof opt === 'string' || typeof opt === 'number'
              ? String(opt)
              : (opt.id || opt.label || opt.key || JSON.stringify(opt));
            optionBreakdown[v.poll_id][key] = (optionBreakdown[v.poll_id][key] || 0) + 1;
          }
        }
      }

      if (myVotesRes.status === 'fulfilled' && myVotesRes.value.data) {
        for (const v of myVotesRes.value.data) {
          myVotes[v.poll_id] = v.selected_options;
        }
      }
    }

    const enriched = (polls || []).map(p => ({
      ...p,
      vote_count: voteCounts[p.id] || 0,
      option_counts: optionBreakdown[p.id] || {},
      my_vote: myVotes[p.id] || null,
    }));

    res.json({ polls: enriched });
  } catch (err) {
    if (err.message && (err.message.includes('does not exist') || err.message.includes('42P01'))) {
      return res.json({ polls: [] });
    }
    logger.error('Polls fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch polls' });
  }
});

/**
 * POST /api/homes/:id/polls
 */
router.post('/:id/polls', verifyToken, validate(createPollSchema), async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'home.edit');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to create polls' });

    const { title, description, poll_type, options, closes_at, visibility } = req.body;

    const { data, error } = await supabaseAdmin
      .from('HomePoll')
      .insert({
        home_id: homeId,
        title,
        description: description || null,
        poll_type: poll_type || 'single_choice',
        options,
        closes_at: closes_at || null,
        visibility: visibility || 'members',
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating poll', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to create poll' });
    }

    writeAuditLog(homeId, userId, 'poll.create', 'HomePoll', data.id, { title });

    res.status(201).json({ poll: data });
  } catch (err) {
    logger.error('Poll creation error', { error: err.message });
    res.status(500).json({ error: 'Failed to create poll' });
  }
});

/**
 * POST /api/homes/:id/polls/:pollId/vote
 */
router.post('/:id/polls/:pollId/vote', verifyToken, validate(voteSchema), async (req, res) => {
  try {
    const { id: homeId, pollId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'home.view');
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    // Verify poll exists and is open
    const { data: poll, error: pollErr } = await supabaseAdmin
      .from('HomePoll')
      .select('id, status, closes_at')
      .eq('id', pollId)
      .eq('home_id', homeId)
      .single();

    if (pollErr || !poll) return res.status(404).json({ error: 'Poll not found' });
    if (poll.status !== 'open') return res.status(400).json({ error: 'Poll is not open for voting' });
    if (poll.closes_at && new Date(poll.closes_at) < new Date()) {
      return res.status(400).json({ error: 'Poll has expired' });
    }

    let { selected_options } = req.body;
    // Normalize to array
    if (!Array.isArray(selected_options)) {
      selected_options = [selected_options];
    }

    // Upsert vote (allows changing vote)
    const { data, error } = await supabaseAdmin
      .from('HomePollVote')
      .upsert(
        {
          poll_id: pollId,
          user_id: userId,
          selected_options,
        },
        { onConflict: 'poll_id,user_id' }
      )
      .select()
      .single();

    if (error) {
      logger.error('Error casting vote', { error: error.message, pollId });
      return res.status(500).json({ error: 'Failed to cast vote' });
    }

    writeAuditLog(homeId, userId, 'poll.vote', 'HomePoll', pollId);

    res.json({ vote: data });
  } catch (err) {
    logger.error('Vote error', { error: err.message });
    res.status(500).json({ error: 'Failed to cast vote' });
  }
});

/**
 * PUT /api/homes/:id/polls/:pollId
 */
router.put('/:id/polls/:pollId', verifyToken, validate(updatePollSchema), async (req, res) => {
  try {
    const { id: homeId, pollId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'home.edit');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to edit polls' });

    const allowed = ['title', 'description', 'status', 'closes_at', 'visibility'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('HomePoll')
      .update(updates)
      .eq('id', pollId)
      .eq('home_id', homeId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating poll', { error: error.message, pollId });
      return res.status(500).json({ error: 'Failed to update poll' });
    }

    if (!data) return res.status(404).json({ error: 'Poll not found' });

    writeAuditLog(homeId, userId, 'poll.update', 'HomePoll', pollId, { fields: Object.keys(updates) });

    res.json({ poll: data });
  } catch (err) {
    logger.error('Poll update error', { error: err.message });
    res.status(500).json({ error: 'Failed to update poll' });
  }
});


// ============ HOME ACTIVITY LOG ============

/**
 * GET /api/homes/:id/activity
 * Paginated audit log — admins only
 */
router.get('/:id/activity', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'security.manage');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to view activity log' });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [dataRes, countRes] = await Promise.allSettled([
      supabaseAdmin
        .from('HomeAuditLog')
        .select('*')
        .eq('home_id', homeId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      supabaseAdmin
        .from('HomeAuditLog')
        .select('id', { count: 'exact', head: true })
        .eq('home_id', homeId),
    ]);

    const entries = (dataRes.status === 'fulfilled' ? dataRes.value.data : null) || [];
    const total = (countRes.status === 'fulfilled' ? countRes.value.count : null) ?? 0;

    res.json({
      activity: entries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error('Activity log error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});


// ============ HOME INTELLIGENCE ENDPOINTS ============

const { computeHealthScore, getHealthScore, invalidateHealthScoreCache, canReadHealthScore } = require('../services/homeHealthService');
const { getOrCreateChecklist, updateChecklistItem, getChecklistHistory } = require('../services/seasonalChecklistService');
const { getSeasonalContext, SEASONS } = require('../services/ai/seasonalEngine');
const { getProfile: getPropertyProfile } = require('../services/ai/propertyIntelligenceService');
const intelligenceAuthority = require('../services/homeDashboardService');

/**
 * GET /api/homes/:id/health-score
 * Returns composite 0-100 health score with per-dimension breakdown.
 */
router.get('/:id/health-score', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const result = await intelligenceAuthority.withCurrentAccess({ homeId, actorId: userId }, async (access) => {
      if (!canReadHealthScore(access.permissions)) throw Object.assign(
        new Error('Home health requires access to the household records used in this score.'),
        { statusCode: 403, code: 'HOME_HEALTH_PERMISSION_REQUIRED' },
      );
      const force = req.query.force === 'true';
      return getHealthScore(homeId, { force });
    });
    res.json(result);
  } catch (err) {
    if (err.code?.startsWith('HOME_DASHBOARD_')) return intelligenceAuthority.sendError(res, err);
    if (err.code === 'HOME_HEALTH_PERMISSION_REQUIRED') return res.status(403).json({ error: err.message, code: err.code });
    logger.error('Health score error', { error: err.message, homeId: req.params.id });
    res.status(err.statusCode || 503).json({ error: 'Current home health could not be computed.', code: 'HOME_HEALTH_UNAVAILABLE' });
  }
});

/**
 * GET /api/homes/:id/seasonal-checklist
 * Returns checklist items for the current season, creating them if needed.
 */
router.get('/:id/seasonal-checklist', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const result = await intelligenceAuthority.withCurrentAccess({ homeId, actorId: userId }, async () => {
      // Pass the home's coordinates so the engine can tell whether its
      // region-specific copy applies. Calling without them satisfied the old
      // `!hasCoords ||` gate, which served Portland-specific tips to every
      // home in the country. The season itself is month-based and resolves
      // nationally, so the checklist below works either way.
      const { data: seasonHome, error: seasonError } = await supabaseAdmin
        .from('Home')
        .select('map_center_lat, map_center_lng')
        .eq('id', homeId)
        .maybeSingle();
      if (seasonError || !seasonHome) throw new Error('Current Home season could not be loaded.');
      const seasonalCtx = getSeasonalContext(
        seasonHome && seasonHome.map_center_lat != null && seasonHome.map_center_lng != null
          ? { latitude: Number(seasonHome.map_center_lat), longitude: Number(seasonHome.map_center_lng) }
          : {},
      );
      const seasonKey = seasonalCtx.primary_season;
      const year = new Date().getFullYear();
      const seasonDef = SEASONS[seasonKey] || {};

      const result = await getOrCreateChecklist(homeId, seasonKey, year, { includePrevious: true });
      const items = result.items || result; // backward compat if includePrevious wasn't used
      const carryover = result.carryover || [];
      const completed = items.filter(i => i.status === 'completed' || i.status === 'skipped' || i.status === 'hired').length;

      const response = {
        season: { key: seasonKey, label: seasonDef.label || seasonKey },
        items,
        progress: {
          total: items.length,
          completed,
          percentage: items.length > 0 ? Math.round((completed / items.length) * 100) : 0,
        },
      };

      // Include carryover from previous season (incomplete items only)
      if (carryover.length > 0) {
        const prevSeasonKey = carryover[0].season_key;
        const prevSeasonDef = SEASONS[prevSeasonKey] || {};
        response.carryover = {
          season: { key: prevSeasonKey, label: prevSeasonDef.label || prevSeasonKey },
          items: carryover,
        };
      }

      return response;
    });
    res.json(result);
  } catch (err) {
    if (err.code?.startsWith('HOME_DASHBOARD_')) return intelligenceAuthority.sendError(res, err);
    logger.error('Seasonal checklist error', { error: err.message, homeId: req.params.id });
    res.status(503).json({ error: 'Current seasonal checklist could not be loaded. Please retry.', code: 'HOME_CHECKLIST_UNAVAILABLE' });
  }
});

/**
 * GET /api/homes/:id/seasonal-checklist/history
 * Returns all past checklists grouped by season_key + year.
 */
router.get('/:id/seasonal-checklist/history', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const result = await intelligenceAuthority.withCurrentAccess({ homeId, actorId: userId }, async () => {
      const history = await getChecklistHistory(homeId);
      return { checklists: history };
    });
    res.json(result);
  } catch (err) {
    if (err.code?.startsWith('HOME_DASHBOARD_')) return intelligenceAuthority.sendError(res, err);
    logger.error('Checklist history error', { error: err.message, homeId: req.params.id });
    res.status(503).json({ error: 'Current checklist history could not be loaded. Please retry.', code: 'HOME_CHECKLIST_UNAVAILABLE' });
  }
});

const updateChecklistItemSchema = Joi.object({
  status: Joi.string().valid('completed', 'skipped').required(),
});

/**
 * PATCH /api/homes/:id/seasonal-checklist/:itemId
 * Update a checklist item's status.
 */
router.patch('/:id/seasonal-checklist/:itemId', verifyToken, validate(updateChecklistItemSchema), async (req, res) => {
  try {
    const { id: homeId, itemId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'home.edit');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to edit this home' });

    const updated = await updateChecklistItem(homeId, itemId, req.body.status, userId);
    invalidateHealthScoreCache(homeId);
    if (!updated) return res.status(404).json({ error: 'Checklist item not found' });

    res.json(updated);
  } catch (err) {
    logger.error('Checklist item update error', { error: err.message, itemId: req.params.itemId });
    res.status(err.statusCode || 503).json({ error: err.message || 'The checklist change could not be confirmed.',
      code: err.code || 'HOME_CHECKLIST_UNAVAILABLE' });
  }
});

/**
 * GET /api/homes/:id/bill-trends
 * Returns bill time series grouped by type, plus neighborhood benchmarks.
 */
router.get('/:id/bill-trends', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    // Finance permission check (same pattern as dashboard)
    const access = await checkHomePermission(homeId, userId, 'home.view');
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const { getUserAccess } = require('../utils/homePermissions');
    const myAccess = await getUserAccess(homeId, userId);
    const perms = new Set(myAccess.permissions || []);
    const canFinance = perms.has('finance.view');
    if (!canFinance) return res.status(403).json({ error: 'No finance access' });

    const { currencyCode, getHomeBillComparison, asBillTrendData, asLegacyBillTrendData } = require('../services/homeBillComparisonService');
    const format = req.query.format ?? '1';
    if (!['1', '2'].includes(format)) return res.status(400).json({ error: 'Unsupported bill comparison format.' });
    if (format === '1' && currencyCode(req.query.currency) !== 'USD') {
      return res.status(400).json({ error: 'Update the app to choose a bill comparison currency.' });
    }
    const snapshot = await getHomeBillComparison(homeId, userId, req.query.currency);
    if (!snapshot.can_view_finance) return res.status(403).json({ error: 'No finance access' });
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(format === '2' ? asBillTrendData(snapshot) : asLegacyBillTrendData(snapshot));
  } catch (err) {
    logger.error('Bill trends error', { error: err.message, homeId: req.params.id });
    res.status(err.statusCode || 503).json({ error: err.statusCode ? err.message : 'Current bill trends could not be loaded.', code: err.code || 'HOME_BILLS_UNAVAILABLE' });
  }
});

/**
 * GET /api/homes/:id/timeline
 * Paginated home activity timeline from HomeAuditLog.
 */
router.get('/:id/timeline', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'members.manage');
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const [dataRes, countRes] = await Promise.allSettled([
      supabaseAdmin
        .from('HomeAuditLog')
        .select('*')
        .eq('home_id', homeId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      supabaseAdmin
        .from('HomeAuditLog')
        .select('id', { count: 'exact', head: true })
        .eq('home_id', homeId),
    ]);

    if ([dataRes, countRes].some(result => result.status !== 'fulfilled' || !result.value || result.value.error)) {
      return res.status(503).json({ error: 'Current home activity could not be loaded.', code: 'HOME_TIMELINE_UNAVAILABLE' });
    }
    const items = (dataRes.status === 'fulfilled' ? dataRes.value.data : null) || [];
    const total = (countRes.status === 'fulfilled' ? countRes.value.count : null) ?? 0;

    res.json({
      items,
      total,
      page,
      hasMore: offset + items.length < total,
    });
  } catch (err) {
    logger.error('Timeline error', { error: err.message, homeId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

/**
 * GET /api/homes/:id/property-value
 * Returns property valuation data from ATTOM/cache.
 */
router.get('/:id/property-value', verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const result = await intelligenceAuthority.withCurrentAccess({ homeId, actorId: userId }, async () => {
      const { profile, source } = await getPropertyProfile(homeId);

      if (source === 'error') throw Object.assign(new Error('Current property information could not be loaded.'),
        { statusCode: 503, code: 'HOME_PROPERTY_UNAVAILABLE' });
      if (!profile) {
        return {
          estimated_value: null,
          value_range_low: null,
          value_range_high: null,
          value_confidence: null,
          zip_median_sale_price_trend: null,
          year_built: null,
          sqft: null,
          last_updated: null,
          source: 'unavailable',
        };
      }

      return {
        estimated_value: profile.estimated_value || null,
        value_range_low: profile.value_range_low || null,
        value_range_high: profile.value_range_high || null,
        value_confidence: profile.value_confidence || null,
        zip_median_sale_price_trend: profile.zip_median_sale_price_trend || null,
        year_built: profile.year_built || null,
        sqft: profile.sqft || null,
        last_updated: profile.cached_at || null,
        source,
      };
    });
    res.json(result);
  } catch (err) {
    if (err.code?.startsWith('HOME_DASHBOARD_')) return intelligenceAuthority.sendError(res, err);
    logger.error('Property value error', { error: err.message, homeId: req.params.id });
    res.status(503).json({ error: 'Current property information could not be loaded. Please retry.', code: 'HOME_PROPERTY_UNAVAILABLE' });
  }
});

module.exports = router;
