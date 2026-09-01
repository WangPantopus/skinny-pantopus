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
const {
  generatePostcardCode,
  hashPostcardCode,
  dispatchPostcardCode,
} = require('../utils/postcardDispatch');
const {
  checkHomePermission,
  isVerifiedOwner,
  mapLegacyRole,
  writeAuditLog,
  applyOccupancyTemplate,
  getActiveOccupancy,
  assertCanMutateTarget,
} = require('../utils/homePermissions');
const { getClaimRiskScore } = require('../utils/homeSecurityPolicy');
const homeClaimCompatService = require('../services/homeClaimCompatService');
const homeClaimMergeService = require('../services/homeClaimMergeService');
const homeClaimRoutingService = require('../services/homeClaimRoutingService');
const propertySuggestionsService = require('../services/ai/propertySuggestionsService');
const propertyIntelligenceService = require('../services/ai/propertyIntelligenceService');
const { shouldBlockCoordinateOverwrite, stripCoordinateFields } = require('../utils/verifiedCoordinateGuard');
const { encodeGeohash } = require('../utils/geohash');
const { HOME_DETAIL, HOME_TASK_LIST, HOME_ISSUE_LIST, HOME_BILL_LIST, HOME_PACKAGE_LIST, HOME_EVENT_LIST } = require('../utils/columns');
const {
  pipelineService,
  AddressVerdictStatus,
  addressDecisionEngine,
  googleProvider,
  smartyProvider,
} = require('../services/addressValidation');
const addressVerificationObservability = require('../services/addressValidation/addressVerificationObservability');
const { redactStreet, queryKnowsNumber, firstNameOnly } = require('../utils/addressRedaction');

function isPendingOwnershipClaimForReadPath(claim) {
  if (!claim) return false;

  if (householdClaimConfig.flags.v2ReadPaths) {
    return homeClaimRoutingService.isClaimActiveRecord(claim);
  }

  return homeClaimRoutingService.isLegacyStateActive(claim.state);
}

function findLatestPendingOwnershipClaim(claims) {
  return (claims || []).find(isPendingOwnershipClaimForReadPath) || null;
}

/**
 * Only the legacy Home.owner_id or the single verified primary HomeOwner may DELETE the Home row.
 * Other verified co-owners must leave or transfer primary ownership first — never wipe the home for everyone.
 */
async function canUserDeleteHomeRecord(homeId, userId, legacyOwnerId) {
  if (legacyOwnerId && legacyOwnerId === userId) return true;
  const { data: row } = await supabaseAdmin
    .from('HomeOwner')
    .select('id')
    .eq('home_id', homeId)
    .eq('subject_id', userId)
    .eq('owner_status', 'verified')
    .eq('is_primary_owner', true)
    .maybeSingle();
  if (row) return true;

  // Creator fallback: owner_id is no longer set at create time (it arrives
  // with claim approval), so someone who just created a home by mistake would
  // otherwise be unable to remove it until a deed verified. Allow the creator
  // to delete only while the home is still theirs alone - no verified owner,
  // and no other active member who would lose their household.
  const { data: home } = await supabaseAdmin
    .from('Home')
    .select('created_by_user_id')
    .eq('id', homeId)
    .maybeSingle();
  if (!home || home.created_by_user_id !== userId) return false;

  const { data: verifiedOwners } = await supabaseAdmin
    .from('HomeOwner')
    .select('id')
    .eq('home_id', homeId)
    .eq('owner_status', 'verified')
    .limit(1);
  if (verifiedOwners && verifiedOwners.length > 0) return false;

  const { data: otherMembers } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('id')
    .eq('home_id', homeId)
    .eq('is_active', true)
    .neq('user_id', userId)
    .limit(1);
  return !otherMembers || otherMembers.length === 0;
}

// ============ VALIDATION SCHEMAS ============

const HOME_TYPES = ['house', 'apartment', 'condo', 'townhouse', 'studio', 'rv', 'mobile_home', 'trailer', 'multi_unit', 'other'];
const VISIBILITY_TYPES = ['private', 'members', 'public_preview'];

const createHomeSchema = Joi.object({
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

  // --- Quick-setup fields (written to related tables after create) ---
  wifi_name: Joi.string().max(200).optional().allow('', null),
  wifi_password: Joi.string().max(200).optional().allow('', null),

  /** Full ATTOM /property/detail bundle from property-suggestions — stored under Home.niche_data */
  attom_property_detail: Joi.object().unknown(true).optional().allow(null),
}).custom((value, helpers) => {
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
const parsePostGISPoint = (point) => {
  if (!point) return null;
  // GeoJSON: { type: "Point", coordinates: [lng, lat] }
  if (typeof point === 'object' && point.coordinates) {
    return { longitude: point.coordinates[0], latitude: point.coordinates[1] };
  }
  const str = String(point);
  // WKT: POINT(lng lat)
  const wktMatch = str.match(/POINT\(([^ ]+) ([^ ]+)\)/);
  if (wktMatch) {
    return { longitude: parseFloat(wktMatch[1]), latitude: parseFloat(wktMatch[2]) };
  }
  // WKB hex (Supabase returns geography columns in this format)
  if (/^[0-9a-fA-F]+$/.test(str) && (str.length === 42 || str.length === 50)) {
    try {
      const buf = Buffer.from(str, 'hex');
      const le = buf[0] === 1;
      const wkbType = le ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
      const hasSRID = (wkbType & 0x20000000) !== 0;
      const geomType = wkbType & 0xFF;
      if (geomType !== 1) return null;
      const coordOffset = hasSRID ? 9 : 5;
      const lng = le ? buf.readDoubleLE(coordOffset) : buf.readDoubleBE(coordOffset);
      const lat = le ? buf.readDoubleLE(coordOffset + 8) : buf.readDoubleBE(coordOffset + 8);
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        return { longitude: lng, latitude: lat };
      }
    } catch (_) {
      return null;
    }
  }
  return null;
};

/** Verified owners or members.manage can review household access requests. */
async function canReviewHouseholdAccessRequests(homeId, userId) {
  const perm = await checkHomePermission(homeId, userId, 'members.manage');
  if (perm.hasAccess) return true;
  const vo = await isVerifiedOwner(homeId, userId);
  return !!vo?.isOwner;
}

function mapAccessRequestToInviteRelationship(requestedIdentity) {
  switch (requestedIdentity) {
    case 'owner': return 'owner';
    case 'resident': return 'renter';
    case 'household_member': return 'member';
    case 'guest': return 'guest';
    default: return 'member';
  }
}

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
    logger.warn('Failed to look up verified address step-up state', {
      userId,
      addressId,
      error: error.message,
    });
    return null;
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
  try {
    const { address_id, address, unit_number, city, state, zip_code, country } = req.body;
    const countryVal = country || 'US';
    const requestedAddressHash = computeAddressHash(address, unit_number, city, state, zip_code, countryVal);

    let existingAddress = null;
    let addressHash = requestedAddressHash;

    if (address_id) {
      const { data } = await supabaseAdmin
        .from('HomeAddress')
        .select('id, address_hash, place_type, building_type, missing_secondary_flag')
        .eq('id', address_id)
        .maybeSingle();
      existingAddress = data || null;
      addressHash = existingAddress?.address_hash || requestedAddressHash;
    }

    if (!existingAddress) {
      const { data } = await supabaseAdmin
        .from('HomeAddress')
        .select('id, address_hash, place_type, building_type, missing_secondary_flag')
        .eq('address_hash', addressHash)
        .maybeSingle();
      existingAddress = data || null;
    }

    const matchedHomeMap = new Map();
    const rememberHomes = (homes = []) => {
      for (const home of homes) {
        if (home?.id) matchedHomeMap.set(home.id, home);
      }
    };

    if (existingAddress?.id) {
      const { data: homesByAddressId } = await supabaseAdmin
        .from('Home')
        .select('id, address, address2, city, state, zipcode, name, address_id, address_hash')
        .eq('address_id', existingAddress.id)
        .limit(20);
      rememberHomes(homesByAddressId || []);
    }

    // Search homes by canonical hash
    const { data: homesByHash } = await supabaseAdmin
      .from('Home')
      .select('id, address, address2, city, state, zipcode, name, address_id, address_hash')
      .eq('address_hash', addressHash)
      .limit(20);
    rememberHomes(homesByHash || []);

    // Also search by the original user-input hash when it differs from the
    // canonical (Google-normalized) hash.  Homes created before the address-
    // validation pipeline was added may have been hashed from raw user input.
    if (requestedAddressHash !== addressHash) {
      const { data: homesByRequestedHash } = await supabaseAdmin
        .from('Home')
        .select('id, address, address2, city, state, zipcode, name, address_id, address_hash')
        .eq('address_hash', requestedAddressHash)
        .limit(20);
      rememberHomes(homesByRequestedHash || []);
    }

    if (matchedHomeMap.size === 0) {
      const { data: nearbyHomes } = await supabaseAdmin
        .from('Home')
        .select('id, address, address2, city, state, zipcode, name, address_id, address_hash')
        .eq('zipcode', zip_code.trim())
        .limit(100);

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
    const { data: activeOccupancies } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('home_id')
      .in('home_id', homeIds)
      .eq('is_active', true)
      .limit(1);

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
    });
  } catch (err) {
    logger.error('Address check error', { error: err.message });
    res.status(500).json({ error: 'Failed to check address' });
  }
});

/**
 * POST /api/homes
 * Create a new home
 */
router.post('/', verifyToken, (req, res, next) => {
  // Debug: log body before Joi validation
  logger.info('POST /api/homes — raw body keys', {
    keys: Object.keys(req.body || {}),
    zip_code: req.body?.zip_code,
    zipcode: req.body?.zipcode,
    latitude: req.body?.latitude,
    longitude: req.body?.longitude,
    hasBody: !!req.body,
  });
  next();
}, validate(createHomeSchema), async (req, res) => {
  try {
    const {
      address, unit_number, address_id: requestedAddressId, city, state, zip_code, zipcode, country,
      latitude, longitude, location,
      name, home_type, bedrooms, bathrooms, sq_ft, square_feet, lot_sq_ft,
      year_built, move_in_date, is_owner, role,
      description, entry_instructions, parking_instructions,
      visibility, amenities,
      wifi_name, wifi_password,
      attom_property_detail,
    } = req.body;
    const userId = req.user.id;

    logger.info('Creating home — body received', {
      userId,
      hasZip: !!(zip_code || zipcode),
      hasCoords: !!(latitude && longitude),
      fields: Object.keys(req.body),
    });

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
      return res.status(422).json({
        error: 'Address must be validated before creating a home.',
        code: 'ADDRESS_VALIDATION_REQUIRED',
        message: 'Validate the address first, then try creating the home again.',
      });
    }

    let canonicalAddress = null;
    if (requestedAddressId) {
      const { data } = await supabaseAdmin
        .from('HomeAddress')
        .select('*')
        .eq('id', requestedAddressId)
        .maybeSingle();
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
        return res.status(422).json({
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
      canonicalAddress = validationResult.canonical_address || canonicalAddress;

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
        return res.status(422).json({
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
        return res.status(outageError.statusCode).json(outageError.body);
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
        return res.status(mismatchError.statusCode).json(mismatchError.body);
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
        return res.status(missingValidationError.statusCode).json(missingValidationError.body);
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
        return res.status(staleValidationError.statusCode).json(staleValidationError.body);
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
        return res.status(unsafeFallbackError.statusCode).json(unsafeFallbackError.body);
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
      return res.status(outageError.statusCode).json(outageError.body);
    }

    const stepUpPolicy = getCreateHomeStepUpPolicy(addressVerdict);
    if (stepUpPolicy) {
      const canonicalAddressId = canonicalAddress?.id || requestedAddressId || null;
      const verifiedStepUp = await findVerifiedAddressStepUp(userId, canonicalAddressId);

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
        return res.status(gateError.statusCode).json(gateError.body);
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

      return res.status(statusCode).json({
        ...problem,
        verdict_status: addressVerdict.status,
        reasons: addressVerdict.reasons || [],
      });
    }

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

    // Roles that require residency verification before full access
    const requiresResidencyVerification = ['renter', 'household', 'property_manager'].includes(role);

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
      return res.status(400).json({
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
      homeData.geocode_place_id = coordsAreCanonical ? (req.body.geocode_place_id || null) : null;
      homeData.geocode_source_flow = 'home_onboarding';
      homeData.geocode_created_at = new Date().toISOString();
    }

    // Create home
    const { data: home, error } = await supabaseAdmin
      .from('Home')
      .insert(homeData)
      .select()
      .single();

    if (error) {
      // Handle duplicate active home at same address (race condition with unique index)
      if (error.code === '23505' && error.message?.includes('address_hash')) {
        const { data: existingHome } = await supabaseAdmin
          .from('Home')
          .select('id')
          .eq('address_hash', addressHash)
          .eq('home_status', 'active')
          .maybeSingle();
        if (existingHome) {
          await recordCreateHomeOutcomeSafe({
            address_id: canonicalAddress?.id || requestedAddressId || null,
            outcome: 'conflict',
            verdict_status: addressVerdict?.status || null,
            reasons: addressVerdict?.reasons || [],
            code: 'HOME_ALREADY_EXISTS',
            status_code: 409,
            validation_path: createHomeValidationPath,
            message: 'This home already exists on Pantopus.',
          });
          return res.status(409).json({
            error: 'This home already exists on Pantopus.',
            code: 'HOME_ALREADY_EXISTS',
            home_id: existingHome.id,
          });
        }
      }
      logger.error('Error creating home', { error: error.message, code: error.code, details: error.details, hint: error.hint, userId });
      await recordCreateHomeOutcomeSafe({
        address_id: canonicalAddress?.id || requestedAddressId || null,
        outcome: 'error',
        verdict_status: addressVerdict?.status || null,
        reasons: addressVerdict?.reasons || [],
        code: 'HOME_CREATE_FAILED',
        status_code: 500,
        validation_path: createHomeValidationPath,
        message: error.message,
      });
      return res.status(500).json({ error: 'Failed to create home', debug: error.message });
    }

    logger.info('Home created', { homeId: home.id, userId });

    // --- Auto-create HomeAddress record and link to Home ---
    if (!homeData.address_id) {
      try {
        const { data: addrRecord, error: addrError } = await supabaseAdmin
          .from('HomeAddress')
          .insert({
            address_line1_norm: normalizedLine1,
            address_line2_norm: normalizedLine2 || null,
            city_norm: normalizedCity,
            state: normalizedState.toUpperCase(),
            postal_code: normalizedZip,
            country: countryVal,
            address_hash: addressHash,
            geocode_lat: coords?.latitude || null,
            geocode_lng: coords?.longitude || null,
            place_type: normalizedLine2 ? 'unit' : 'single_family',
            // Same provenance rule as the Home row above: 'verified' only when
            // the pipeline produced these coordinates.
            geocode_provider: coordsAreCanonical ? 'google_validation' : 'client',
            geocode_mode: coordsAreCanonical ? 'verified' : 'user_asserted',
            geocode_accuracy: coordsAreCanonical ? 'rooftop' : null,
            geocode_place_id: coordsAreCanonical ? (req.body.geocode_place_id || null) : null,
            geocode_source_flow: 'home_onboarding',
            geocode_created_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (addrError && !addrError.message?.includes('duplicate')) {
          logger.warn('Failed to create HomeAddress (non-fatal)', { error: addrError.message, homeId: home.id });
        }

        const canonicalId = addrRecord?.id;
        if (!canonicalId && addrError?.message?.includes('duplicate')) {
          const { data: existing } = await supabaseAdmin
            .from('HomeAddress')
            .select('id')
            .eq('address_hash', addressHash)
            .maybeSingle();
          if (existing?.id) {
            await supabaseAdmin.from('Home').update({ address_id: existing.id }).eq('id', home.id);
          }
        } else if (canonicalId) {
          await supabaseAdmin.from('Home').update({ address_id: canonicalId }).eq('id', home.id);
        }
      } catch (addrErr) {
        logger.warn('HomeAddress creation error (non-fatal)', { error: addrErr.message });
      }
    }

    // --- BUG 6C: Auto-link unit homes to parent building ---
    if (normalizedLine2) {
      try {
        // Look for an existing home at the same base address (no unit) that could be the parent building
        const baseAddrLower = normalizedLine1.trim().toLowerCase();
        const cityLower = normalizedCity.trim().toLowerCase();
        const stateLower = normalizedState.trim().toLowerCase();

        const { data: parentCandidates } = await supabaseAdmin
          .from('Home')
          .select('id, home_type, address2')
          .ilike('address', baseAddrLower)
          .ilike('city', cityLower)
          .ilike('state', stateLower)
          .eq('home_status', 'active')
          .neq('id', home.id)
          .is('address2', null)
          .limit(1);

        let parentId = parentCandidates?.[0]?.id || null;

        // If no explicit parent building exists, find any sibling unit and share its parent
        if (!parentId) {
          const { data: siblings } = await supabaseAdmin
            .from('Home')
            .select('parent_home_id')
            .ilike('address', baseAddrLower)
            .ilike('city', cityLower)
            .ilike('state', stateLower)
            .eq('home_status', 'active')
            .neq('id', home.id)
            .not('parent_home_id', 'is', null)
            .limit(1);

          parentId = siblings?.[0]?.parent_home_id || null;
        }

        if (parentId) {
          await supabaseAdmin
            .from('Home')
            .update({ parent_home_id: parentId, updated_at: new Date().toISOString() })
            .eq('id', home.id);
          logger.info('Auto-linked unit to parent building', { homeId: home.id, parentId });
        }
      } catch (parentErr) {
        logger.warn('Failed to auto-link parent building (non-fatal)', { error: parentErr.message, homeId: home.id });
      }
    }

    // --- Auto-create occupancy for creator via applyOccupancyTemplate ---
    // All occupancy writes go through the single template function.
    const creatorRoleBaseMap = {
      owner: 'admin', renter: 'lease_resident', household: 'member',
      property_manager: 'manager', guest: 'guest',
    };
    const creatorRoleBase = creatorRoleBaseMap[role] || (is_owner ? 'admin' : 'member');

    try {
      if (is_owner) {
        // Owners: admin role, pending doc verification
        await applyOccupancyTemplate(home.id, userId, 'admin', 'pending_doc');
      } else if (role === 'guest') {
        // Guests: verified immediately
        await applyOccupancyTemplate(home.id, userId, 'guest', 'verified');
      } else {
        // Non-owners (renter, household, property_manager): self-bootstrap
        // They created the home, so they're the first person at this address
        await applyOccupancyTemplate(home.id, userId, creatorRoleBase, 'provisional_bootstrap');
      }
    } catch (occError) {
      logger.warn('Failed to create creator occupancy (non-fatal)', { error: occError.message, homeId: home.id });
    }

    // --- Ownership claim flow ---
    // If user claims to be owner, create a PENDING HomeOwner + an
    // OwnershipClaim that requires verification before becoming verified.
    // This prevents instant unverified ownership (spec §7.1).
    let ownershipClaim = null;
    if (is_owner) {
      // Create pending HomeOwner record (not yet verified)
      const { error: ownerError } = await supabaseAdmin
        .from('HomeOwner')
        .insert({
          home_id: home.id,
          subject_type: 'user',
          subject_id: userId,
          owner_status: 'pending',
          is_primary_owner: true,
          added_via: 'claim',
          verification_tier: 'weak',
        });
      if (ownerError) {
        logger.warn('Failed to create HomeOwner (non-fatal)', { error: ownerError.message, homeId: home.id });
      }

      // TODO: Make claim method dynamic once property_data_match is implemented.
      // For now, doc_upload is the only supported self-service method.
      const claimMethod = 'doc_upload';

      // Calculate risk score for the auto-created claim
      const riskScore = await getClaimRiskScore({ method: claimMethod }, userId);
      let routingClassification = 'standalone_claim';
      try {
        routingClassification = (await homeClaimRoutingService.classifySubmission({
          homeId: home.id,
          userId,
          claimType: 'owner',
          method: claimMethod,
        })).routingClassification;
      } catch (classificationError) {
        logger.warn('household_claim.home_creation_classification_failed', {
          homeId: home.id,
          claimant_user_id: userId,
          error: classificationError.message,
        });
      }
      homeClaimCompatService.logClaimSubmissionDecision({
        source: 'home_creation',
        homeId: home.id,
        userId,
        claimType: 'owner',
        method: claimMethod,
        allowed: true,
        routingClassification,
      });

      // Create an ownership claim in "submitted" state
      const { data: claim, error: claimError } = await supabaseAdmin
        .from('HomeOwnershipClaim')
        .insert({
          home_id: home.id,
          claimant_user_id: userId,
          claim_type: 'owner',
          state: 'submitted',
          method: claimMethod,
          risk_score: riskScore,
          ...(await homeClaimCompatService.buildInitialClaimCompatibilityFields({
            homeId: home.id,
            userId,
            claimType: 'owner',
            method: claimMethod,
            legacyState: 'submitted',
            routingClassification,
          })),
        })
        .select('id, state')
        .single();

      if (claimError) {
        // 23505 = unique_violation from idx_home_claim_active_unique (concurrent claim race)
        if (claimError.code === '23505') {
          logger.warn('Ownership claim blocked by active claim index (non-fatal)', { homeId: home.id });
        } else {
          logger.warn('Failed to create ownership claim (non-fatal)', { error: claimError.message, homeId: home.id });
        }
      } else {
        ownershipClaim = claim;
        await homeClaimCompatService.recalculateHouseholdResolutionState(home.id);
        await writeAuditLog(home.id, userId, 'OWNERSHIP_CLAIM_SUBMITTED', 'HomeOwnershipClaim', claim.id, {
          method: claimMethod, claim_type: 'owner', risk_score: riskScore, context: 'home_creation',
        });
      }
    }

    // --- Auto-create default HomePreference ---
    const { error: prefError } = await supabaseAdmin
      .from('HomePreference')
      .insert({ home_id: home.id });
    if (prefError) {
      logger.warn('Failed to create home preferences (non-fatal)', { error: prefError.message, homeId: home.id });
    }

    // --- Auto-create WiFi access secret if provided ---
    if (wifi_name || wifi_password) {
      const { error: wifiError } = await supabaseAdmin
        .from('HomeAccessSecret')
        .insert({
          home_id: home.id,
          access_type: 'wifi',
          label: wifi_name || 'Home WiFi',
          secret_value: wifi_password || '',
          visibility: 'members',
          created_by: userId,
        });
      if (wifiError) {
        logger.warn('Failed to create wifi secret (non-fatal)', { error: wifiError.message, homeId: home.id });
      }
    }

    // Parse location back to a friendly object
    const response = { ...home };
    if (home.location) {
      response.location = parsePostGISPoint(home.location);
    }

    // Include ownership verification status in response
    if (is_owner && ownershipClaim) {
      response.ownership_status = 'pending_verification';
      response.ownership_claim_id = ownershipClaim.id;
    }

    // Send in-app notification guiding user to upload ownership evidence
    if (is_owner && ownershipClaim) {
      try {
        const { notifyOwnershipVerificationNeeded } = require('../services/notificationService');
        await notifyOwnershipVerificationNeeded({
          userId,
          homeName: name || address,
          homeId: home.id,
          claimId: ownershipClaim.id,
        });
      } catch (notifErr) {
        logger.warn('Failed to send ownership verification notification (non-fatal)', { error: notifErr.message });
      }
    }

    const needsVerification = is_owner || requiresResidencyVerification;
    let messageText = 'Home created successfully';
    let verificationType = null;
    if (is_owner) {
      messageText = 'Home created. Please upload a deed, closing disclosure, or property tax bill to verify ownership.';
      verificationType = 'ownership';
    } else if (requiresResidencyVerification) {
      messageText = 'Home created. To verify your residency, please upload a lease, utility bill, or similar document.';
      verificationType = 'residency';
    }

    await recordCreateHomeOutcomeSafe({
      address_id: canonicalAddress?.id || response.address_id || requestedAddressId || null,
      outcome: 'created',
      verdict_status: addressVerdict?.status || null,
      reasons: allowCreateWithNoUnitAttestation
        ? [...(addressVerdict?.reasons || []), 'no_unit_attestation']
        : (addressVerdict?.reasons || []),
      code: 'HOME_CREATED',
      status_code: 201,
      validation_path: createHomeValidationPath,
      step_up_reason: stepUpPolicy?.policy || null,
      message: messageText,
    });

    res.status(201).json({
      message: messageText,
      home: response,
      requires_verification: needsVerification,
      verification_type: verificationType,
      role: role || (is_owner ? 'owner' : 'member'),
    });

  } catch (err) {
    logger.error('Home creation error', { error: err.message, userId: req.user.id });
    await recordCreateHomeOutcomeSafe({
      address_id: req.body?.address_id || null,
      outcome: 'error',
      code: 'HOME_CREATE_FAILED',
      status_code: 500,
      validation_path: 'exception',
      message: err.message,
    });
    res.status(500).json({ error: 'Failed to create home' });
  }
});


/**
 * GET /api/homes/my-homes
 * Get current user's homes (owned + occupied)
 */
router.get('/my-homes', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Owned homes
    const { data: ownedHomes, error: ownedError } = await supabaseAdmin
      .from('Home')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (ownedError) {
      return res.status(500).json({ error: 'Failed to load homes' });
    }

    // Occupied homes (HomeOccupancy) — only rows the user is still active on.
    // Inactive rows (e.g. challenged detach: suspended_challenged) are excluded here;
    // POST /:id/move-out can still normalize those to moved_out if the UI surfaces leave.
    const { data: occRows, error: occError } = await supabaseAdmin
      .from('HomeOccupancy')
      .select(`
        id,
        role,
        role_base,
        is_active,
        start_at,
        end_at,
        verification_status,
        home:home_id ( * )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .neq('verification_status', 'moved_out')
      .order('created_at', { ascending: false });

    if (occError) {
      return res.status(500).json({ error: 'Failed to load home occupancies' });
    }

    const occupiedHomes = (occRows || [])
      .map((r) => {
        const h = r.home;
        if (!h) return null;
        return {
          ...h,
          occupancy: {
            id: r.id,
            role: r.role,
            role_base: r.role_base,
            is_active: r.is_active,
            start_at: r.start_at,
            end_at: r.end_at,
            verification_status: r.verification_status,
          },
        };
      })
      .filter(Boolean);

    // Check HomeOwner verification status for ALL user homes (owned + occupied)
    // to distinguish between verified owners and pending owners.
    const ownedHomeIds = (ownedHomes || []).map(h => h.id);
    const allHomeIds = [...new Set([...ownedHomeIds, ...occupiedHomes.map(h => h.id)])];
    let ownerStatusMap = {};
    if (allHomeIds.length > 0) {
      const { data: ownerRows } = await supabaseAdmin
        .from('HomeOwner')
        .select('home_id, owner_status, verification_tier, is_primary_owner')
        .eq('subject_id', userId)
        .in('home_id', allHomeIds)
        .neq('owner_status', 'revoked');

      for (const row of (ownerRows || [])) {
        ownerStatusMap[row.home_id] = row;
      }
    }

    // Fetch pending claim IDs so frontend can deep-link to evidence upload.
    // Check homes with pending HomeOwner status AND homes with active claims (even without HomeOwner).
    let pendingClaimMap = {};
    const pendingOwnerHomeIds = Object.entries(ownerStatusMap)
      .filter(([, row]) => row.owner_status === 'pending')
      .map(([homeId]) => homeId);
    // Also fetch any active claims for all homes (covers non-owner creators who submitted claims)
    const claimSearchHomeIds = allHomeIds.length > 0 ? allHomeIds : [];
    if (claimSearchHomeIds.length > 0) {
      const { data: pendingClaims } = await supabaseAdmin
        .from('HomeOwnershipClaim')
        .select('id, home_id, state, claim_phase_v2, merged_into_claim_id')
        .eq('claimant_user_id', userId)
        .in('home_id', claimSearchHomeIds)
        .order('created_at', { ascending: false });
      for (const claim of (pendingClaims || [])) {
        if (!isPendingOwnershipClaimForReadPath(claim)) {
          continue;
        }
        if (!pendingClaimMap[claim.home_id]) {
          pendingClaimMap[claim.home_id] = claim.id;
        }
      }
    }

    // Build a lookup from home ID → occupancy record for role merging
    const occByHomeId = {};
    for (const h of occupiedHomes) {
      occByHomeId[h.id] = h.occupancy;
    }

    // Mark owned homes with accurate ownership status
    const ownedWithOcc = (ownedHomes || []).map((h) => {
      const ownerRow = ownerStatusMap[h.id];
      const isVerifiedOwner = ownerRow && ownerRow.owner_status === 'verified';
      const isPendingOwner = ownerRow && ownerRow.owner_status === 'pending';
      const actualOcc = occByHomeId[h.id]; // real occupancy from HomeOccupancy

      // Use ownership role if user is an owner; otherwise use actual occupancy role
      let displayRole = 'admin';
      let isActive = true;
      if (isVerifiedOwner) {
        displayRole = 'owner';
      } else if (isPendingOwner) {
        displayRole = 'pending_owner';
      } else if (actualOcc?.role) {
        // Non-owner creator: use the actual occupancy role (lease_resident, member, etc.)
        displayRole = actualOcc.role;
        isActive = actualOcc.is_active !== false;
      }

      return {
        ...h,
        occupancy: {
          ...(actualOcc || {}),
          role: displayRole,
          is_active: isActive,
        },
        ownership_status: ownerRow?.owner_status || null,
        verification_tier: ownerRow?.verification_tier || null,
        pending_claim_id: (isPendingOwner || pendingClaimMap[h.id]) ? (pendingClaimMap[h.id] || null) : null,
      };
    });

    // Include homes where user is a verified owner only (no owner_id, no occupancy) — e.g. after claim approval
    const existingHomeIds = new Set([
      ...(ownedHomes || []).map((h) => h.id),
      ...occupiedHomes.map((h) => h.id),
    ]);
    const { data: verifiedOwnerRows } = await supabaseAdmin
      .from('HomeOwner')
      .select('home_id, owner_status, verification_tier, is_primary_owner')
      .eq('subject_id', userId)
      .eq('owner_status', 'verified');
    const verifiedOnlyHomeIds = [...new Set((verifiedOwnerRows || []).map((r) => r.home_id).filter((id) => id && !existingHomeIds.has(id)))];
    let verifiedOnlyHomes = [];
    if (verifiedOnlyHomeIds.length > 0) {
      const { data: verifiedHomes } = await supabaseAdmin
        .from('Home')
        .select('*')
        .in('id', verifiedOnlyHomeIds);
      const ownerRowByHome = (verifiedOwnerRows || []).reduce((acc, r) => { acc[r.home_id] = r; return acc; }, {});
      verifiedOnlyHomes = (verifiedHomes || []).map((h) => ({
        ...h,
        occupancy: { id: null, role: 'owner', is_active: true, start_at: null, end_at: null },
        ownership_status: 'verified',
        verification_tier: ownerRowByHome[h.id]?.verification_tier || null,
        pending_claim_id: null,
      }));
    }

    // Enrich occupancy-only homes with ownership status and pending claim data
    const enrichedOccupied = occupiedHomes.map((h) => {
      const ownerRow = ownerStatusMap[h.id];
      const hasPendingClaim = !!pendingClaimMap[h.id];
      return {
        ...h,
        ownership_status: ownerRow?.owner_status || (hasPendingClaim ? 'pending' : null),
        verification_tier: ownerRow?.verification_tier || null,
        pending_claim_id: (ownerRow?.owner_status === 'pending' || hasPendingClaim) ? (pendingClaimMap[h.id] || null) : null,
      };
    });

    // Deduplicate: owned homes (with ownership metadata) take priority over pure occupancy entries
    const byId = new Map();
    for (const h of enrichedOccupied) byId.set(h.id, h);
    for (const h of ownedWithOcc) byId.set(h.id, h);
    for (const h of verifiedOnlyHomes) byId.set(h.id, h);

    const homes = Array.from(byId.values());

    const out = homes.map((h) => {
      const row = ownerStatusMap[h.id];
      const can_delete_home =
        h.owner_id === userId
        || (row?.owner_status === 'verified' && row?.is_primary_owner === true);
      return {
        ...h,
        location: h.location ? parsePostGISPoint(h.location) : null,
        can_delete_home,
      };
    });

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ homes: out });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

/**
 * GET /api/homes/primary
 * Get the current user's primary home (for feed, location picker, etc.).
 * Resolves: active HomeOccupancy first, then verified HomeOwner, then legacy owner_id.
 */
router.get('/primary', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Active occupancy (oldest first = primary)
    const { data: occ } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('home_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    let primaryHomeId = occ?.home_id || null;

    if (!primaryHomeId) {
      // 2. Verified owner without occupancy
      const { data: ownerRow } = await supabaseAdmin
        .from('HomeOwner')
        .select('home_id')
        .eq('subject_id', userId)
        .eq('owner_status', 'verified')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      primaryHomeId = ownerRow?.home_id || null;
    }

    if (!primaryHomeId) {
      // 3. Legacy: home where user is owner_id
      const { data: owned } = await supabaseAdmin
        .from('Home')
        .select('id')
        .eq('owner_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      primaryHomeId = owned?.id || null;
    }

    if (!primaryHomeId) {
      return res.status(200).json({ home: null });
    }

    const { data: home, error } = await supabaseAdmin
      .from('Home')
      .select('*')
      .eq('id', primaryHomeId)
      .single();

    if (error || !home) {
      return res.status(200).json({ home: null });
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.status(200).json({ home });
  } catch (err) {
    logger.error('Primary home fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to load primary home' });
  }
});

/**
 * GET /api/homes/invitations
 * Get all pending invitations for the current user
 * NOTE: Must be defined BEFORE /:id to avoid Express matching "invitations" as an :id param
 */
router.get('/invitations', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user email for email-based invites
    const { data: user } = await supabaseAdmin
      .from('User')
      .select('email')
      .eq('id', userId)
      .single();

    let query = supabaseAdmin
      .from('HomeInvite')
      .select(`
        *,
        home:home_id (
          id, address, city, state, zip_code
        ),
        inviter:invited_by (
          id, username, name
        )
      `)
      .eq('status', 'pending');

    // Match by user_id OR email
    if (user?.email) {
      query = query.or(`invitee_user_id.eq.${userId},invitee_email.eq.${user.email}`);
    } else {
      query = query.eq('invitee_user_id', userId);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('Error fetching home invitations', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch invitations' });
    }

    res.json({ invitations: data || [] });
  } catch (err) {
    logger.error('Invitations fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

/**
 * GET /api/homes/invitations/token/:token
 * Public endpoint — look up an invitation by token.
 * Used by the invite acceptance page. No auth required so new users can see the invite.
 * Returns invite details + home info + inviter name (but no sensitive data).
 */
router.get('/invitations/token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Look up by hash first, fall back to plaintext for un-migrated rows (AUTH-3.1)
    let { data: invite, error } = await supabaseAdmin
      .from('HomeInvite')
      .select('*')
      .eq('token_hash', tokenHash)
      .single();

    if (!invite) {
      ({ data: invite, error } = await supabaseAdmin
        .from('HomeInvite')
        .select('*')
        .eq('token', token)
        .single());
    }

    if (error || !invite) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Check status
    if (invite.status !== 'pending') {
      return res.json({
        invitation: { id: invite.id, status: invite.status },
        expired: invite.status === 'expired',
        alreadyUsed: invite.status === 'accepted',
      });
    }

    // Check expiry
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await supabaseAdmin.from('HomeInvite').update({ status: 'expired' }).eq('id', invite.id);
      return res.json({
        invitation: { id: invite.id, status: 'expired' },
        expired: true,
      });
    }

    // Get home info
    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('id, name, address, city, state, home_type')
      .eq('id', invite.home_id)
      .single();

    // Get inviter info
    const { data: inviter } = await supabaseAdmin
      .from('User')
      .select('username, name, first_name, profile_picture_url')
      .eq('id', invite.invited_by)
      .single();

    res.json({
      invitation: {
        id: invite.id,
        status: invite.status,
        proposed_role: invite.proposed_role,
        invitee_email: invite.invitee_email,
        invitee_user_id: invite.invitee_user_id,
        expires_at: invite.expires_at,
        created_at: invite.created_at,
      },
      home: home ? {
        id: home.id,
        name: home.name || home.address || 'A Home',
        city: [home.city, home.state].filter(Boolean).join(', '),
        home_type: home.home_type,
      } : null,
      inviter: inviter ? {
        name: inviter.name || inviter.first_name || inviter.username || 'Someone',
        username: inviter.username,
        profilePicture: inviter.profile_picture_url,
      } : null,
    });
  } catch (err) {
    logger.error('Token invite lookup error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch invitation' });
  }
});

/**
 * POST /api/homes/invitations/:invitationId/accept
 */
router.post('/invitations/:invitationId/accept', verifyToken, async (req, res) => {
  try {
    const { invitationId } = req.params;
    const userId = req.user.id;

    // Fetch the invite
    const { data: invite, error: fetchErr } = await supabaseAdmin
      .from('HomeInvite')
      .select('*')
      .eq('id', invitationId)
      .eq('status', 'pending')
      .single();

    if (fetchErr || !invite) {
      return res.status(404).json({ error: 'Invitation not found or already used' });
    }

    // Check expiry
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await supabaseAdmin.from('HomeInvite').update({ status: 'expired' }).eq('id', invitationId);
      return res.status(410).json({ error: 'Invitation has expired' });
    }

    // Verify this invite is for this user
    const { data: user } = await supabaseAdmin
      .from('User')
      .select('email')
      .eq('id', userId)
      .single();

    const isForUser = invite.invitee_user_id === userId ||
      (invite.invitee_email && user?.email && invite.invitee_email.toLowerCase() === user.email.toLowerCase());

    if (!isForUser) {
      return res.status(403).json({ error: 'This invitation is not for you' });
    }

    if (
      householdClaimConfig.flags.inviteMerge
      && typeof invite.proposed_preset_key === 'string'
      && invite.proposed_preset_key.startsWith('claim_merge:')
    ) {
      const claimId = invite.proposed_preset_key.slice('claim_merge:'.length);
      try {
        const mergeResult = await homeClaimMergeService.acceptClaimMerge({
          homeId: invite.home_id,
          claimId,
          userId,
          invite,
        });

        return res.json({
          occupancy: mergeResult.occupancy,
          homeId: invite.home_id,
          claim: {
            id: claimId,
            state: 'approved',
            claim_phase_v2: mergeResult.claimPhaseV2,
            terminal_reason: mergeResult.terminalReason,
            merged_into_claim_id: mergeResult.mergedIntoClaimId,
          },
          merged: true,
          accepted_role_base: mergeResult.acceptedRoleBase,
          accepted_as_owner: mergeResult.acceptedAsOwner,
        });
      } catch (mergeError) {
        if (mergeError.status) {
          return res.status(mergeError.status).json({
            error: mergeError.message,
            ...(mergeError.code ? { code: mergeError.code } : {}),
          });
        }
        throw mergeError;
      }
    }

    // Create HomeOccupancy via centralized gateway
    const roleBase = invite.proposed_role_base ||
      mapLegacyRole(invite.proposed_role || 'member');

    const occupancyAttachService = require('../services/occupancyAttachService');
    const attachResult = await occupancyAttachService.attach({
      homeId: invite.home_id,
      userId,
      method: 'owner_bootstrap',
      claimType: 'member',
      roleOverride: roleBase,
      actorId: userId,
      metadata: { source: 'home_invite_accept', invite_id: invitationId },
    });

    if (!attachResult.success && attachResult.status !== 'already_attached') {
      logger.error('Error creating occupancy from invite', { error: attachResult.error });
      return res.status(500).json({ error: 'Failed to accept invitation' });
    }
    const occupancy = attachResult.occupancy;

    // Mark invite as accepted
    await supabaseAdmin.from('HomeInvite').update({ status: 'accepted' }).eq('id', invitationId);

    logger.info('Home invitation accepted', { inviteId: invitationId, homeId: invite.home_id, userId });

    // Notify the inviter (non-blocking)
    const { notifyHomeInviteAccepted } = require('../services/notificationService');
    (async () => {
      try {
        const [accepterRes, hmRes] = await Promise.allSettled([
          supabaseAdmin.from('User').select('name, username, first_name').eq('id', userId).single(),
          supabaseAdmin.from('Home').select('name, address').eq('id', invite.home_id).single(),
        ]);
        const accepter = accepterRes.status === 'fulfilled' ? accepterRes.value.data : null;
        const hm = hmRes.status === 'fulfilled' ? hmRes.value.data : null;
        await notifyHomeInviteAccepted({
          inviterUserId: invite.invited_by,
          accepterName: accepter?.name || accepter?.first_name || accepter?.username || 'Someone',
          homeName: hm?.name || hm?.address || 'A home',
          homeId: invite.home_id,
        });
      } catch (e) {
        logger.error('Failed to create accept notification', { error: e.message });
      }
    })();

    res.json({ occupancy });
  } catch (err) {
    logger.error('Accept invitation error', { error: err.message });
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

/**
 * POST /api/homes/invitations/:invitationId/reject
 */
router.post('/invitations/:invitationId/reject', verifyToken, async (req, res) => {
  try {
    const { invitationId } = req.params;
    const userId = req.user.id;

    // SEC-09: this route read userId and never used it, so any authenticated
    // account could revoke any invitation by id — enough to block every
    // household on the platform from adding members. Only the person the
    // invitation is addressed to, or someone who can manage members on that
    // home, may reject it.
    const { data: invite, error: lookupErr } = await supabaseAdmin
      .from('HomeInvite')
      .select('id, home_id, invitee_user_id, invitee_email, status')
      .eq('id', invitationId)
      .maybeSingle();

    if (lookupErr) {
      logger.error('Error loading invitation', { error: lookupErr.message });
      return res.status(500).json({ error: 'Failed to reject invitation' });
    }

    if (!invite) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    let permitted = invite.invitee_user_id === userId;

    if (!permitted && invite.invitee_email) {
      const { data: me } = await supabaseAdmin
        .from('User')
        .select('email')
        .eq('id', userId)
        .maybeSingle();
      permitted = !!me?.email
        && me.email.toLowerCase() === invite.invitee_email.toLowerCase();
    }

    if (!permitted) {
      const access = await checkHomePermission(invite.home_id, userId, 'members.manage');
      permitted = access.hasAccess;
    }

    if (!permitted) {
      return res.status(403).json({ error: 'Not authorized to reject this invitation' });
    }

    const { error } = await supabaseAdmin
      .from('HomeInvite')
      .update({ status: 'revoked' })
      .eq('id', invitationId)
      .eq('status', 'pending');

    if (error) {
      logger.error('Error rejecting invitation', { error: error.message });
      return res.status(500).json({ error: 'Failed to reject invitation' });
    }

    res.json({ message: 'Invitation rejected' });
  } catch (err) {
    logger.error('Reject invitation error', { error: err.message });
    res.status(500).json({ error: 'Failed to reject invitation' });
  }
});

/**
 * POST /api/homes/invitations/token/:token/accept
 * Accept an invitation by token (used by the acceptance page).
 * Requires auth — user must be logged in.
 */
router.post('/invitations/token/:token/accept', verifyToken, async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.user.id;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Fetch the invite by hash, fall back to plaintext for un-migrated rows (AUTH-3.1)
    let { data: invite, error: fetchErr } = await supabaseAdmin
      .from('HomeInvite')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('status', 'pending')
      .single();

    if (!invite) {
      ({ data: invite, error: fetchErr } = await supabaseAdmin
        .from('HomeInvite')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single());
    }

    if (fetchErr || !invite) {
      return res.status(404).json({ error: 'Invitation not found or already used' });
    }

    // Check expiry
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await supabaseAdmin.from('HomeInvite').update({ status: 'expired' }).eq('id', invite.id);
      return res.status(410).json({ error: 'Invitation has expired' });
    }

    // Verify this invite is for this user (by user_id or email)
    const { data: user } = await supabaseAdmin
      .from('User')
      .select('email')
      .eq('id', userId)
      .single();

    // Targeted invite: strict identity check (BUG 1A fix)
    const isTargetedInvite = !!(invite.invitee_user_id || invite.invitee_email);

    if (isTargetedInvite) {
      const isForUser =
        invite.invitee_user_id === userId ||
        (invite.invitee_email && user?.email && invite.invitee_email.toLowerCase() === user.email.toLowerCase());

      if (!isForUser) {
        // Mask the email for the error hint (show first 2 chars + domain)
        let emailHint = null;
        if (invite.invitee_email) {
          const [local, domain] = invite.invitee_email.split('@');
          emailHint = local.slice(0, 2) + '***@' + domain;
        }
        return res.status(403).json({
          error: 'This invitation was sent to a different email address',
          code: 'INVITE_EMAIL_MISMATCH',
          hint: emailHint,
        });
      }
    }
    // Open invite (no invitee_email, no invitee_user_id): any authenticated user can accept

    if (
      householdClaimConfig.flags.inviteMerge
      && typeof invite.proposed_preset_key === 'string'
      && invite.proposed_preset_key.startsWith('claim_merge:')
    ) {
      const claimId = invite.proposed_preset_key.slice('claim_merge:'.length);
      try {
        const mergeResult = await homeClaimMergeService.acceptClaimMerge({
          homeId: invite.home_id,
          claimId,
          userId,
          invite,
        });

        return res.json({
          occupancy: mergeResult.occupancy,
          homeId: invite.home_id,
          claim: {
            id: claimId,
            state: 'approved',
            claim_phase_v2: mergeResult.claimPhaseV2,
            terminal_reason: mergeResult.terminalReason,
            merged_into_claim_id: mergeResult.mergedIntoClaimId,
          },
          merged: true,
          accepted_role_base: mergeResult.acceptedRoleBase,
          accepted_as_owner: mergeResult.acceptedAsOwner,
        });
      } catch (mergeError) {
        if (mergeError.status) {
          return res.status(mergeError.status).json({
            error: mergeError.message,
            ...(mergeError.code ? { code: mergeError.code } : {}),
          });
        }
        throw mergeError;
      }
    }

    // Create HomeOccupancy via applyOccupancyTemplate (single write path)
    const roleBase = invite.proposed_role_base || mapLegacyRole(invite.proposed_role || 'member');
    let occupancy;
    try {
      const result = await applyOccupancyTemplate(invite.home_id, userId, roleBase, 'verified');
      occupancy = result.occupancy;
    } catch (templateErr) {
      logger.error('Error creating occupancy from token invite', { error: templateErr.message });
      return res.status(500).json({ error: 'Failed to accept invitation' });
    }

    // Mark invite as accepted
    await supabaseAdmin.from('HomeInvite').update({ status: 'accepted' }).eq('id', invite.id);

    logger.info('Home invitation accepted via token', { inviteId: invite.id, homeId: invite.home_id, userId });

    // Notify the inviter (non-blocking)
    const { notifyHomeInviteAccepted } = require('../services/notificationService');
    (async () => {
      try {
        const [accepterRes, hmRes] = await Promise.allSettled([
          supabaseAdmin.from('User').select('name, username, first_name').eq('id', userId).single(),
          supabaseAdmin.from('Home').select('name, address').eq('id', invite.home_id).single(),
        ]);
        const accepter = accepterRes.status === 'fulfilled' ? accepterRes.value.data : null;
        const hm = hmRes.status === 'fulfilled' ? hmRes.value.data : null;
        await notifyHomeInviteAccepted({
          inviterUserId: invite.invited_by,
          accepterName: accepter?.name || accepter?.first_name || accepter?.username || 'Someone',
          homeName: hm?.name || hm?.address || 'A home',
          homeId: invite.home_id,
        });
      } catch (e) {
        logger.error('Failed to create accept notification', { error: e.message });
      }
    })();

    res.json({ occupancy, homeId: invite.home_id });
  } catch (err) {
    logger.error('Token accept error', { error: err.message });
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

/**
 * POST /api/homes/invitations/token/:token/decline
 * Decline an invitation by token. Requires auth.
 */
router.post('/invitations/token/:token/decline', verifyToken, async (req, res) => {
  try {
    const { token } = req.params;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Try hash first, fall back to plaintext for un-migrated rows (AUTH-3.1)
    let { error } = await supabaseAdmin
      .from('HomeInvite')
      .update({ status: 'revoked' })
      .eq('token_hash', tokenHash)
      .eq('status', 'pending');

    // If no rows matched by hash, try plaintext fallback
    const { data: check } = await supabaseAdmin
      .from('HomeInvite')
      .select('id')
      .eq('token', token)
      .eq('status', 'pending')
      .maybeSingle();

    if (check) {
      ({ error } = await supabaseAdmin
        .from('HomeInvite')
        .update({ status: 'revoked' })
        .eq('token', token)
        .eq('status', 'pending'));
    }

    if (error) {
      logger.error('Error declining invitation by token', { error: error.message });
      return res.status(500).json({ error: 'Failed to decline invitation' });
    }

    res.json({ message: 'Invitation declined' });
  } catch (err) {
    logger.error('Token decline error', { error: err.message });
    res.status(500).json({ error: 'Failed to decline invitation' });
  }
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
        const ownerUsername = owner?.username || null;

        const searchable = [
          h.name,
          h.address,
          h.city,
          h.state,
          h.zipcode,
          ownerName,
          ownerUsername,
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
        // claim flow), or already belong to / have claimed the home.
        const reveal = memberSet.has(h.id) || claimMap.has(h.id) || queryKnowsNumber(tokens, h.address);

        return {
          id: h.id,
          name: h.name || null,
          address: reveal ? h.address : redactStreet(h.address),
          address_redacted: !reveal,
          city: h.city,
          state: h.state,
          zipcode: reveal ? h.zipcode : null,
          home_type: h.home_type || null,
          visibility: h.visibility,
          owner: owner
            ? {
                id: owner.id,
                username: owner.username,
                name: reveal ? ownerName : firstNameOnly(ownerName),
                profile_picture_url: owner.profile_picture_url || null,
              }
            : null,
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

    // Public profile can be viewed by: members/owners, public_preview, creator
    // (onboarding/claim UI), or a user who has actually filed a claim on this home.
    //
    // SEC-01: there used to be a fourth leg — a `verifiedOwnerProbe` that granted
    // access whenever *the home* had a verified owner, regardless of who was
    // asking. Since this response carries the full street address and the
    // owner's real name and photo, that turned any home id into an
    // address-to-identity lookup for any authenticated account, which is the
    // exact disclosure the identity firewall exists to prevent. A user who wants
    // to join a household files a claim first (POST /:id/claim); the pre-claim
    // conflict signal is served by POST /api/homes/check-address, which returns
    // no identity.
    const access = await checkHomePermission(homeId, userId);
    const isCreator = Boolean(home.created_by_user_id && home.created_by_user_id === userId);
    // `insider` = may see the exact address (member / creator / claimant).
    // `canView` = may see the page at all (insiders + public_preview +
    // the user-B join flow). Outsiders get the street, never the number.
    let insider = access.hasAccess || isCreator;
    let canView = insider || home.visibility === 'public_preview';
    if (!insider) {
      const [residencyClaim, ownershipClaim] = await Promise.all([
        supabaseAdmin.from('HomeResidencyClaim').select('id').eq('home_id', homeId).eq('user_id', userId).limit(1).maybeSingle(),
        supabaseAdmin.from('HomeOwnershipClaim').select('id').eq('home_id', homeId).eq('claimant_user_id', userId).limit(1).maybeSingle(),
      ]);
      if (residencyClaim.data || ownershipClaim.data) { insider = true; canView = true; }
    }
    if (!canView) {
      return res.status(403).json({ error: 'This home is not publicly discoverable' });
    }
    const reveal = insider;

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

    const ownerFullName = ownerRes.data
      ? ownerRes.data.name || [ownerRes.data.first_name, ownerRes.data.last_name].filter(Boolean).join(' ') || ownerRes.data.username
      : null;
    const owner = ownerRes.data
      ? {
          id: ownerRes.data.id,
          username: ownerRes.data.username,
          name: reveal ? ownerFullName : firstNameOnly(ownerFullName),
          profile_picture_url: ownerRes.data.profile_picture_url || null,
        }
      : null;

    res.json({
      home: {
        id: home.id,
        name: home.name,
        address: reveal ? home.address : redactStreet(home.address),
        address_redacted: !reveal,
        city: home.city,
        state: home.state,
        zipcode: reveal ? home.zipcode : null,
        home_type: home.home_type,
        visibility: home.visibility,
        description: home.description || null,
        created_at: home.created_at,
      },
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
    const homeId = req.params.id;
    const userId = req.user.id;
    const { requested_identity: requestedIdentity } = req.body;

    const { data: occ } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('id')
      .eq('home_id', homeId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();
    if (occ) {
      return res.status(400).json({ error: 'You already belong to this home.' });
    }

    const { data: verifiedRows, error: voErr } = await supabaseAdmin
      .from('HomeOwner')
      .select('subject_id')
      .eq('home_id', homeId)
      .eq('subject_type', 'user')
      .eq('owner_status', 'verified');

    if (voErr) throw voErr;
    let ownerUserIds = [...new Set((verifiedRows || []).map((r) => r.subject_id).filter(Boolean))];
    ownerUserIds = ownerUserIds.filter((id) => id !== userId);
    if (!ownerUserIds.length) {
      return res.status(400).json({
        error: 'This home does not have a verified owner yet. Use ownership verification instead.',
      });
    }

    const { data: homeRow } = await supabaseAdmin
      .from('Home')
      .select('address, city, state, zipcode')
      .eq('id', homeId)
      .single();

    const { data: requester } = await supabaseAdmin
      .from('User')
      .select('username, name, first_name, last_name')
      .eq('id', userId)
      .single();

    const requesterName = requester
      ? (requester.name || [requester.first_name, requester.last_name].filter(Boolean).join(' ') || requester.username || 'Someone')
      : 'Someone';
    const homeLabel = homeRow
      ? [homeRow.address, homeRow.city, homeRow.state].filter(Boolean).join(', ')
      : 'your home';

    const nowIso = new Date().toISOString();
    const { data: existingPending } = await supabaseAdmin
      .from('HomeHouseholdAccessRequest')
      .select('id')
      .eq('home_id', homeId)
      .eq('requester_user_id', userId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingPending) {
      await supabaseAdmin
        .from('HomeHouseholdAccessRequest')
        .update({ requested_identity: requestedIdentity, updated_at: nowIso })
        .eq('id', existingPending.id);
    } else {
      const { error: insReqErr } = await supabaseAdmin
        .from('HomeHouseholdAccessRequest')
        .insert({
          home_id: homeId,
          requester_user_id: userId,
          requested_identity: requestedIdentity,
          status: 'pending',
        });
      if (insReqErr) {
        logger.error('HomeHouseholdAccessRequest insert failed', { error: insReqErr.message, homeId });
        return res.status(500).json({ error: 'Failed to save access request' });
      }
    }

    const { notifyHouseholdAccessRequest } = require('../services/notificationService');
    await notifyHouseholdAccessRequest({
      ownerUserIds,
      requesterName,
      homeLabel,
      homeId,
      requesterUserId: userId,
      requestedIdentity,
    });

    await writeAuditLog(homeId, userId, 'HOUSEHOLD_ACCESS_REQUESTED', 'Home', homeId, {
      requested_identity: requestedIdentity,
      notified_owner_count: ownerUserIds.length,
    });

    res.json({
      ok: true,
      notified_owners: ownerUserIds.length,
    });
  } catch (err) {
    logger.error('request-household-from-owner error', { error: err.message, homeId: req.params.id });
    res.status(500).json({ error: 'Failed to send request' });
  }
});

/**
 * GET /:id/household-access-requests
 * List access requests (verified owners or members.manage).
 */
router.get('/:id/household-access-requests', verifyToken, async (req, res) => {
  try {
    const homeId = req.params.id;
    const userId = req.user.id;
    if (!(await canReviewHouseholdAccessRequests(homeId, userId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const statusFilter = (req.query.status || 'pending').toLowerCase();
    let q = supabaseAdmin
      .from('HomeHouseholdAccessRequest')
      .select('*')
      .eq('home_id', homeId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (statusFilter && statusFilter !== 'all') {
      q = q.eq('status', statusFilter);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    const ids = [...new Set((rows || []).map((r) => r.requester_user_id))];
    let userMap = {};
    if (ids.length) {
      const { data: users } = await supabaseAdmin
        .from('User')
        .select('id, username, name, first_name, last_name, profile_picture_url')
        .in('id', ids);
      userMap = Object.fromEntries((users || []).map((u) => [u.id, u]));
    }
    res.json({
      requests: (rows || []).map((r) => ({
        ...r,
        requester: userMap[r.requester_user_id] || null,
      })),
    });
  } catch (err) {
    logger.error('household-access-requests list error', { error: err.message });
    res.status(500).json({ error: 'Failed to load requests' });
  }
});

/**
 * POST /:id/household-access-requests/:requestId/approve
 */
router.post('/:id/household-access-requests/:requestId/approve', verifyToken, async (req, res) => {
  try {
    const homeId = req.params.id;
    const requestId = req.params.requestId;
    const userId = req.user.id;
    if (!(await canReviewHouseholdAccessRequests(homeId, userId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { data: request, error: reqErr } = await supabaseAdmin
      .from('HomeHouseholdAccessRequest')
      .select('*')
      .eq('id', requestId)
      .eq('home_id', homeId)
      .single();
    if (reqErr || !request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'This request is no longer pending' });
    }
    const { data: requester } = await supabaseAdmin
      .from('User')
      .select('id, email, username')
      .eq('id', request.requester_user_id)
      .single();
    if (!requester) return res.status(400).json({ error: 'Requester not found' });

    const { data: existingOcc } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('id')
      .eq('home_id', homeId)
      .eq('user_id', request.requester_user_id)
      .eq('is_active', true)
      .maybeSingle();
    if (existingOcc) {
      const resolvedAt = new Date().toISOString();
      await supabaseAdmin
        .from('HomeHouseholdAccessRequest')
        .update({
          status: 'cancelled',
          resolved_by: userId,
          resolved_at: resolvedAt,
          updated_at: resolvedAt,
        })
        .eq('id', requestId);
      return res.status(409).json({ error: 'This person is already a member' });
    }

    const relationship = mapAccessRequestToInviteRelationship(request.requested_identity);
    const proposedRoleBase = mapLegacyRole(relationship);

    const { data: dupInv } = await supabaseAdmin
      .from('HomeInvite')
      .select('id')
      .eq('home_id', homeId)
      .eq('invitee_user_id', request.requester_user_id)
      .eq('status', 'pending')
      .maybeSingle();
    if (dupInv) {
      return res.status(409).json({ error: 'A pending invitation already exists for this person' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { error: invErr } = await supabaseAdmin.from('HomeInvite').insert({
      home_id: homeId,
      invited_by: userId,
      invitee_email: requester.email || null,
      invitee_user_id: request.requester_user_id,
      proposed_role: relationship,
      token,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      proposed_role_base: proposedRoleBase,
      proposed_preset_key: `access_request:${requestId}`,
      is_open_invite: false,
    });
    if (invErr) {
      logger.error('approve access request invite failed', { error: invErr.message });
      return res.status(500).json({ error: 'Failed to create invitation' });
    }

    const resolvedAt = new Date().toISOString();
    await supabaseAdmin
      .from('HomeHouseholdAccessRequest')
      .update({
        status: 'approved',
        resolved_by: userId,
        resolved_at: resolvedAt,
        updated_at: resolvedAt,
      })
      .eq('id', requestId);

    await writeAuditLog(homeId, userId, 'HOUSEHOLD_ACCESS_APPROVED', 'HomeHouseholdAccessRequest', requestId, {
      requester_user_id: request.requester_user_id,
    });

    const { notifyHomeInvite } = require('../services/notificationService');
    const { data: hm } = await supabaseAdmin.from('Home').select('name, address').eq('id', homeId).single();
    const { data: inv } = await supabaseAdmin.from('User').select('name, username, first_name').eq('id', userId).single();
    await notifyHomeInvite({
      inviteeUserId: request.requester_user_id,
      inviterName: inv?.name || inv?.first_name || inv?.username || 'Someone',
      homeName: hm?.name || hm?.address || 'A home',
      homeId,
      inviteToken: token,
    });

    res.json({ ok: true, message: 'Invitation sent' });
  } catch (err) {
    logger.error('approve household access request', { error: err.message });
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

/**
 * POST /:id/household-access-requests/:requestId/reject
 */
router.post('/:id/household-access-requests/:requestId/reject', verifyToken, async (req, res) => {
  try {
    const homeId = req.params.id;
    const requestId = req.params.requestId;
    const userId = req.user.id;
    if (!(await canReviewHouseholdAccessRequests(homeId, userId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { data: request, error: reqErr } = await supabaseAdmin
      .from('HomeHouseholdAccessRequest')
      .select('*')
      .eq('id', requestId)
      .eq('home_id', homeId)
      .single();
    if (reqErr || !request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'This request is no longer pending' });
    }
    const resolvedAt = new Date().toISOString();
    await supabaseAdmin
      .from('HomeHouseholdAccessRequest')
      .update({
        status: 'rejected',
        resolved_by: userId,
        resolved_at: resolvedAt,
        updated_at: resolvedAt,
      })
      .eq('id', requestId);

    const { data: hm } = await supabaseAdmin
      .from('Home')
      .select('address, city, state')
      .eq('id', homeId)
      .single();
    const homeLabel = hm ? [hm.address, hm.city, hm.state].filter(Boolean).join(', ') : 'the home';
    const { data: resolver } = await supabaseAdmin
      .from('User')
      .select('name, username, first_name')
      .eq('id', userId)
      .single();
    const resolverName = resolver?.name || resolver?.first_name || resolver?.username || 'A home owner';

    const { notifyHouseholdAccessRequestRejected } = require('../services/notificationService');
    await notifyHouseholdAccessRequestRejected({
      requesterUserId: request.requester_user_id,
      homeLabel,
      resolverName,
    });

    await writeAuditLog(homeId, userId, 'HOUSEHOLD_ACCESS_REJECTED', 'HomeHouseholdAccessRequest', requestId, {
      requester_user_id: request.requester_user_id,
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error('reject household access request', { error: err.message });
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

/**
 * GET /api/homes/:id
 * Get home details with occupants
 */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get home with occupants
    const { data: home, error } = await supabaseAdmin
      .from('Home')
      .select(`
        *,
        owner:owner_id (
          id,
          username,
          name
        ),
        occupants:HomeOccupancy (
          user_id,
          created_at,
          user:user_id (
            id,
            username,
            name
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error || !home) {
      return res.status(404).json({ error: 'Home not found' });
    }

    // Check access via IAM (not owner_id — that can be null for renter-created homes)
    const access = await checkHomePermission(id, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this home' });
    }
    const isOwner = access.isOwner;
    const isOccupant = !!access.occupancy;

    // Parse location
    if (home.location) {
      const coords = parsePostGISPoint(home.location);
      home.location = coords;
    }

    // Fetch ownership data
    const { data: owners } = await supabaseAdmin
      .from('HomeOwner')
      .select('id, subject_type, subject_id, owner_status, is_primary_owner, verification_tier')
      .eq('home_id', id)
      .neq('owner_status', 'revoked');

    const isVerifiedOwner = (owners || []).some(
      o => o.subject_id === userId && o.owner_status === 'verified'
    );

    // Check if user has a pending ownership claim (for verification banner)
    const userOwnerRow = (owners || []).find(o => o.subject_id === userId);
    const isPendingOwner = userOwnerRow?.owner_status === 'pending';
    let pendingClaimId = null;
    if (isPendingOwner) {
      const { data: pendingClaims } = await supabaseAdmin
        .from('HomeOwnershipClaim')
        .select('id, state, claim_phase_v2, merged_into_claim_id')
        .eq('home_id', id)
        .eq('claimant_user_id', userId)
        .order('created_at', { ascending: false });
      pendingClaimId = findLatestPendingOwnershipClaim(pendingClaims)?.id || null;
    }

    const can_delete_home = await canUserDeleteHomeRecord(id, userId, home.owner_id);

    res.json({
      home: {
        ...home,
        isOwner: isOwner || isVerifiedOwner,
        isPendingOwner,
        pendingClaimId,
        isOccupant,
        owners: owners || [],
        can_delete_home,
      }
    });

  } catch (err) {
    logger.error('Home fetch error', { error: err.message, homeId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch home' });
  }
});

/**
 * GET /api/homes/:id/property-details
 * Resolve ATTOM-backed property details for a home, using saved home data,
 * raw ATTOM cache, or live ATTOM fetches as needed.
 */
router.get('/:id/property-details', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: home, error } = await supabaseAdmin
      .from('Home')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !home) {
      return res.status(404).json({ error: 'Home not found' });
    }

    const access = await checkHomePermission(id, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this home' });
    }

    if (home.location) {
      home.location = parsePostGISPoint(home.location);
    }

    const detailResult = await propertyIntelligenceService.getHomeAttomPropertyDetail(home);

    if (detailResult.attomPayload) {
      home.niche_data = {
        ...(home.niche_data && typeof home.niche_data === 'object' ? home.niche_data : {}),
        attom_property_detail: detailResult.attomPayload,
      };
    }

    res.json({
      home,
      attom_property_detail: detailResult.attomPayload,
      source: detailResult.source,
      unavailable_reason: detailResult.unavailableReason || null,
    });
  } catch (err) {
    logger.error('Home property details error', { error: err.message, homeId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch home property details' });
  }
});

/**
 * GET /api/homes
 * Get all homes for current user (owned + occupied)
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get homes owned by user
    const { data: ownedHomes, error: ownedError } = await supabaseAdmin
      .from('Home')
      .select('*, occupants:HomeOccupancy(count)')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (ownedError) {
      logger.error('Error fetching owned homes', { error: ownedError.message, userId });
      return res.status(500).json({ error: 'Failed to fetch homes' });
    }

    // Get homes occupied by user
    const { data: occupancies, error: occupiedError } = await supabaseAdmin
      .from('HomeOccupancy')
      .select(`
        home_id,
        created_at,
        home:home_id (
          *,
          owner:owner_id (
            username,
            name
          )
        )
      `)
      .eq('user_id', userId);

    if (occupiedError) {
      logger.error('Error fetching occupied homes', { error: occupiedError.message, userId });
      return res.status(500).json({ error: 'Failed to fetch homes' });
    }

    const occupiedHomes = occupancies.map(occ => ({
      ...occ.home,
      occupiedSince: occ.created_at
    }));

    res.json({
      ownedHomes: ownedHomes || [],
      occupiedHomes: occupiedHomes || []
    });

  } catch (err) {
    logger.error('Homes fetch error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to fetch homes' });
  }
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
    const { id } = req.params;
    const userId = req.user.id;

    // Check ownership
    const { data: existingHome, error: fetchError } = await supabaseAdmin
      .from('Home')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingHome) {
      return res.status(404).json({ error: 'Home not found' });
    }

    const canDelete = await canUserDeleteHomeRecord(id, userId, existingHome.owner_id);
    if (!canDelete) {
      return res.status(403).json({
        error:
          'Only the primary owner can delete this home. Other members can leave the home instead.',
        code: 'DELETE_HOME_NOT_PRIMARY',
      });
    }

    // Unlink payments (Payment.home_id FK has no ON DELETE in older DBs; home_id is nullable).
    const { error: payUnlinkErr } = await supabaseAdmin
      .from('Payment')
      .update({ home_id: null })
      .eq('home_id', id);
    if (payUnlinkErr) {
      logger.error('Error unlinking payments before home delete', {
        error: payUnlinkErr.message,
        homeId: id,
      });
      return res.status(500).json({ error: 'Failed to delete home' });
    }

    const { error } = await supabaseAdmin
      .from('Home')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting home', { error: error.message, homeId: id });
      return res.status(500).json({ error: 'Failed to delete home' });
    }

    logger.info('Home deleted', { homeId: id, userId });

    res.json({ message: 'Home deleted successfully' });

  } catch (err) {
    logger.error('Home delete error', { error: err.message, homeId: req.params.id });
    res.status(500).json({ error: 'Failed to delete home' });
  }
});

/**
 * POST /api/homes/:id/attach
 * Attach user to home (owner only or with verification in future)
 */
router.post('/:id/attach', verifyToken, validate(attachDetachSchema), async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const { userId: userToAttach } = req.body;
    const requestingUserId = req.user.id;

    // Check home exists and requester is owner
    const { data: home, error: homeError } = await supabaseAdmin
      .from('Home')
      .select('owner_id, address')
      .eq('id', homeId)
      .single();

    if (homeError || !home) {
      return res.status(404).json({ error: 'Home not found' });
    }

    const attachAccess = await checkHomePermission(homeId, requestingUserId, 'members.manage');
    if (!attachAccess.hasAccess) {
      return res.status(403).json({ error: 'You do not have permission to manage members' });
    }

    // Check user exists
    const { data: user, error: userError } = await supabaseAdmin
      .from('User')
      .select('id, username, name')
      .eq('id', userToAttach)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Attach via centralized OccupancyAttachService
    const occupancyAttachService = require('../services/occupancyAttachService');
    const result = await occupancyAttachService.attach({
      homeId,
      userId: userToAttach,
      method: 'owner_bootstrap',
      claimType: 'member',
      actorId: requestingUserId,
      metadata: { source: 'owner_attach' },
    });

    if (!result.success) {
      if (result.status === 'already_attached') {
        return res.status(400).json({ error: 'User is already attached to this home' });
      }
      logger.error('Error attaching user', { error: result.error, homeId, userToAttach });
      return res.status(500).json({ error: result.error || 'Failed to attach user' });
    }

    logger.info('User attached to home', { homeId, userId: userToAttach, by: requestingUserId });

    res.status(200).json({
      message: `${user.name} attached to home successfully`,
      occupancy: {
        id: result.occupancy?.id,
        homeId,
        userId: userToAttach,
        username: user.username,
        name: user.name,
        attachedAt: result.occupancy?.created_at
      }
    });

  } catch (err) {
    logger.error('Attach user error', { error: err.message, homeId: req.params.id });
    res.status(500).json({ error: 'Failed to attach user' });
  }
});

/**
 * POST /api/homes/:id/detach
 * Detach user from home (owner only)
 */
router.post('/:id/detach', verifyToken, validate(attachDetachSchema), async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const { userId: userToDetach } = req.body;
    const requestingUserId = req.user.id;

    // Check home exists and requester is owner
    const { data: home, error: homeError } = await supabaseAdmin
      .from('Home')
      .select('owner_id')
      .eq('id', homeId)
      .single();

    if (homeError || !home) {
      return res.status(404).json({ error: 'Home not found' });
    }

    const detachAccess = await checkHomePermission(homeId, requestingUserId, 'members.manage');
    if (!detachAccess.hasAccess) {
      return res.status(403).json({ error: 'You do not have permission to manage members' });
    }

    // Rank guard: removing an owner is an ownership action, not member
    // management. Without this, an admin could detach the owner's occupancy
    // while the Home.owner_id pointer stayed behind — stripped of membership
    // yet still holding full owner access via checkHomePermission.
    if (userToDetach !== requestingUserId) {
      const targetIsPointerOwner = home.owner_id === userToDetach;
      const { data: targetOwnerRow } = await supabaseAdmin
        .from('HomeOwner')
        .select('id')
        .eq('home_id', homeId)
        .eq('subject_id', userToDetach)
        .eq('owner_status', 'verified')
        .maybeSingle();
      if ((targetIsPointerOwner || targetOwnerRow) && !detachAccess.isOwner) {
        return res.status(403).json({ error: 'Only an owner can remove an owner from the home' });
      }
    }

    // LIF-01: go through the single detach chokepoint rather than hard-deleting
    // the row. detach() deactivates the occupancy (preserving history), clears
    // the Home.owner_id pointer when the departing user holds it, revokes
    // outstanding residency letters, and writes the audit entries this route's
    // raw DELETE used to skip.
    const occupancyAttachService = require('../services/occupancyAttachService');
    const detachResult = await occupancyAttachService.detach({
      homeId,
      userId: userToDetach,
      reason: 'removed',
      actorId: requestingUserId,
      metadata: { source: 'owner_detach_route' },
    });

    if (!detachResult.success) {
      if (detachResult.error === 'No active occupancy found') {
        return res.status(400).json({ error: 'User is not attached to this home' });
      }
      logger.error('Error detaching user', { error: detachResult.error, homeId, userToDetach });
      return res.status(500).json({ error: 'Failed to detach user' });
    }

    logger.info('User detached from home', { homeId, userId: userToDetach, by: requestingUserId });

    res.json({ message: 'User detached from home successfully' });

  } catch (err) {
    logger.error('Detach user error', { error: err.message, homeId: req.params.id });
    res.status(500).json({ error: 'Failed to detach user' });
  }
});

/**
 * POST /api/homes/:id/move-out
 * Self-initiated move-out. Soft-deactivates the caller's occupancy,
 * marks non-primary HomeOwner records inactive, and sets Home.vacancy_at
 * if no authority-level occupants remain.
 */
router.post('/:id/move-out', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    // 1. Prefer an active occupancy (normal leave)
    const { data: occupancy } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('id, role_base')
      .eq('home_id', homeId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    // 1b. No active row — e.g. occupancy was already deactivated by challenge revoke /
    //     admin detach (is_active false, verification_status still not moved_out).
    //     Normalize to moved_out so my-homes stops listing this home and the user can exit.
    if (!occupancy) {
      const { data: staleRows, error: staleErr } = await supabaseAdmin
        .from('HomeOccupancy')
        .select('id, role_base')
        .eq('home_id', homeId)
        .eq('user_id', userId)
        .eq('is_active', false)
        .neq('verification_status', 'moved_out');

      if (staleErr) {
        logger.error('move-out stale occupancy lookup failed', { error: staleErr.message, homeId, userId });
        return res.status(500).json({ error: 'Failed to process move-out' });
      }

      if (staleRows && staleRows.length > 0) {
        const now = new Date().toISOString();
        const staleIds = staleRows.map((r) => r.id);
        const { error: staleUpdateErr } = await supabaseAdmin
          .from('HomeOccupancy')
          .update({
            verification_status: 'moved_out',
            updated_at: now,
          })
          .in('id', staleIds);

        if (staleUpdateErr) {
          logger.error('Failed to normalize stale occupancy on move-out', { error: staleUpdateErr.message, homeId, userId });
          return res.status(500).json({ error: 'Failed to process move-out' });
        }

        await supabaseAdmin
          .from('HomeOwner')
          .update({ owner_status: 'inactive', updated_at: now })
          .eq('home_id', homeId)
          .eq('subject_id', userId)
          .eq('subject_type', 'user')
          .eq('is_primary_owner', false);

        await writeAuditLog(homeId, userId, 'MEMBER_MOVED_OUT', 'HomeOccupancy', staleIds[0], {
          role_base: staleRows[0].role_base,
          reconciled_stale_occupancy: true,
        });

        return res.json({
          message: 'You have been removed from this home',
          homeId,
          reconciled_stale_occupancy: true,
        });
      }

      return res.status(404).json({ error: 'You do not have an active occupancy at this home' });
    }

    // 2. Block primary owners — they must transfer ownership first
    const { data: primaryOwner } = await supabaseAdmin
      .from('HomeOwner')
      .select('id')
      .eq('home_id', homeId)
      .eq('subject_id', userId)
      .eq('subject_type', 'user')
      .eq('is_primary_owner', true)
      .eq('owner_status', 'verified')
      .maybeSingle();

    if (primaryOwner) {
      return res.status(400).json({
        error: 'Primary owners must transfer ownership before moving out',
        code: 'TRANSFER_REQUIRED',
      });
    }

    // 3. Soft-deactivate occupancy
    const now = new Date().toISOString();
    const { error: occUpdateError } = await supabaseAdmin
      .from('HomeOccupancy')
      .update({
        is_active: false,
        end_at: now,
        verification_status: 'moved_out',
        updated_at: now,
      })
      .eq('id', occupancy.id);

    if (occUpdateError) {
      logger.error('Failed to deactivate occupancy on move-out', { error: occUpdateError.message, homeId, userId });
      return res.status(500).json({ error: 'Failed to process move-out' });
    }

    // Mark non-primary HomeOwner record inactive (if one exists)
    await supabaseAdmin
      .from('HomeOwner')
      .update({ owner_status: 'inactive', updated_at: now })
      .eq('home_id', homeId)
      .eq('subject_id', userId)
      .eq('subject_type', 'user')
      .eq('is_primary_owner', false);

    // LIF-01: clear the legacy owner pointer, exactly as
    // occupancyAttachService.detach does. checkHomePermission treats
    // Home.owner_id === userId as ownership, so leaving it set here meant the
    // app's own Move Out button returned 200 while the departed user kept full
    // administrative control of the home — including deleting it. detach() is
    // not the single chokepoint the LIF-01 fix assumed: this route writes
    // HomeOccupancy directly.
    const { error: clearOwnerErr } = await supabaseAdmin
      .from('Home')
      .update({ owner_id: null, updated_at: now })
      .eq('id', homeId)
      .eq('owner_id', userId);

    if (clearOwnerErr) {
      // Do not report success: the occupancy is inactive but the user would
      // still hold owner-level access, which is the bug this prevents.
      logger.error('Failed to clear owner_id on move-out', {
        error: clearOwnerErr.message, homeId, userId,
      });
      return res.status(500).json({ error: 'Failed to process move-out' });
    }

    // LIF-06: a residency letter asserts to landlords, schools and the DMV that
    // this person lives here. Moving out must retire the credential — it
    // otherwise stayed valid until its 90-day expiry for a home the user no
    // longer occupies.
    try {
      const residencyLetterService = require('../services/residencyLetterService');
      await residencyLetterService.revokeLettersForResidency(homeId, userId, 'residency_move_out');
    } catch (letterErr) {
      // Never block the move-out itself on this, but make the gap visible.
      logger.error('Failed to revoke residency letters on move-out', {
        homeId, userId, error: letterErr.message,
      });
    }

    // 4. Check if any active authorities remain
    const { count: authorityCount } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('id', { count: 'exact', head: true })
      .eq('home_id', homeId)
      .eq('is_active', true)
      .in('role_base', ['owner', 'admin', 'manager']);

    if (authorityCount === 0) {
      await supabaseAdmin
        .from('Home')
        .update({ vacancy_at: now, updated_at: now })
        .eq('id', homeId);
    }

    // 5. Notify remaining active members
    try {
      const notificationService = require('../services/notificationService');

      const { data: user } = await supabaseAdmin
        .from('User')
        .select('username, name, first_name')
        .eq('id', userId)
        .single();

      const userName = user?.name || user?.first_name || user?.username || 'A member';

      const { data: activeMembers } = await supabaseAdmin
        .from('HomeOccupancy')
        .select('user_id')
        .eq('home_id', homeId)
        .eq('is_active', true);

      const notifications = (activeMembers || [])
        .filter(m => m.user_id !== userId)
        .map(m => ({
          userId: m.user_id,
          type: 'member_moved_out',
          title: 'Member moved out',
          body: `${userName} has moved out.`,
          link: `/homes/${homeId}/occupants`,
          metadata: { home_id: homeId, moved_out_user_id: userId },
        }));

      if (notifications.length > 0) {
        await notificationService.createBulkNotifications(notifications);
      }
    } catch (notifErr) {
      logger.warn('Failed to send move-out notifications (non-fatal)', { error: notifErr.message });
    }

    // 6. Audit log
    await writeAuditLog(homeId, userId, 'MEMBER_MOVED_OUT', 'HomeOccupancy', occupancy.id, {
      role_base: occupancy.role_base,
      vacancy_set: authorityCount === 0,
    });

    // 7. Response
    res.json({ message: 'You have been removed from this home', homeId });

  } catch (err) {
    logger.error('Move-out error', { error: err.message, homeId: req.params.id, userId: req.user.id });
    res.status(500).json({ error: 'Failed to process move-out' });
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
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;
    const includeInactive = String(req.query.include_inactive || '') === '1';

    // Check access
    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this home' });
    }

    let occQuery = supabaseAdmin
      .from('HomeOccupancy')
      .select(`
        id,
        user_id,
        role,
        is_active,
        start_at,
        can_manage_home,
        can_manage_finance,
        can_manage_access,
        can_manage_tasks,
        can_view_sensitive,
        created_at,
        user:user_id (
          id,
          username,
          name,
          first_name,
          last_name,
          profile_picture_url,
          city,
          state
        )
      `)
      .eq('home_id', homeId)
      .order('created_at', { ascending: true });

    if (!includeInactive) {
      occQuery = occQuery.eq('is_active', true);
    }

    const { data: occupants, error } = await occQuery;

    if (error) {
      logger.error('Error fetching occupants', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch occupants' });
    }

    // Also fetch pending invites for this home
    const { data: pendingInvites } = await supabaseAdmin
      .from('HomeInvite')
      .select(`
        id,
        invitee_email,
        invitee_user_id,
        proposed_role,
        status,
        created_at,
        inviter:invited_by (
          username,
          name
        )
      `)
      .eq('home_id', homeId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    // Map pending invites to a member-like shape for the UI
    const pendingMembers = (pendingInvites || []).map(inv => ({
      id: inv.id,
      user_id: inv.invitee_user_id,
      role: inv.proposed_role,
      is_active: false, // pending flag
      email: inv.invitee_email,
      name: inv.invitee_email || 'Invited user',
      invited_by: inv.inviter?.name || inv.inviter?.username,
      created_at: inv.created_at,
    }));

    // Flatten nested user data so the UI can read display_name, email, etc. directly
    const flatOccupants = (occupants || []).map(occ => {
      const u = occ.user || {};
      return {
        ...occ,
        user_id: occ.user_id,
        display_name: u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || null,
        username: u.username || null,
        email: u.email || null,
        avatar_url: u.profile_picture_url || null,
        joined_at: occ.created_at,
      };
    });

    res.json({
      occupants: flatOccupants,
      pendingInvites: pendingMembers,
    });

  } catch (err) {
    logger.error('Occupants fetch error', { error: err.message, homeId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch occupants' });
  }
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

/**
 * GET /api/homes/:id/tasks
 */
router.get('/:id/tasks', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'can_manage_tasks');
    // Even without manage permission, members might view tasks assigned to them

    const { data, error } = await supabaseAdmin
      .from('HomeTask')
      .select('*')
      .eq('home_id', homeId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching home tasks', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch tasks' });
    }

    // Filter tasks based on visibility + viewer_user_ids
    const filtered = (data || []).filter(task => {
      // Task creator can always see their own tasks
      if (task.created_by === userId) return true;
      // Task assignee can always see
      if (task.assigned_to === userId) return true;
      // If the user is in viewer_user_ids, they can see it
      if (task.viewer_user_ids && task.viewer_user_ids.includes(userId)) return true;

      // Otherwise check the visibility level
      if (task.visibility === 'public') return true;
      if (task.visibility === 'members' && access.hasAccess) return true;
      if (task.visibility === 'managers' && access.role && ['owner', 'admin', 'manager'].includes(access.role)) return true;
      if (task.visibility === 'sensitive' && access.role && ['owner', 'admin'].includes(access.role)) return true;

      return false;
    });

    // Fetch media for all returned tasks
    const taskIds = filtered.map(t => t.id);
    let mediaMap = {};
    if (taskIds.length > 0) {
      const { data: allMedia } = await supabaseAdmin
        .from('HomeTaskMedia')
        .select('*')
        .in('task_id', taskIds)
        .order('created_at', { ascending: true });

      (allMedia || []).forEach(m => {
        if (!mediaMap[m.task_id]) mediaMap[m.task_id] = [];
        mediaMap[m.task_id].push(m);
      });
    }

    const enriched = filtered.map(t => ({
      ...t,
      media: mediaMap[t.id] || [],
    }));

    res.json({ tasks: enriched });
  } catch (err) {
    logger.error('Tasks fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * POST /api/homes/:id/tasks
 */
router.post('/:id/tasks', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'can_manage_tasks');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to manage tasks' });

    const {
      task_type, title, description, assigned_to,
      due_at, recurrence_rule, priority, budget, details,
      visibility, viewer_user_ids
    } = req.body;

    if (!task_type || !title) {
      return res.status(400).json({ error: 'task_type and title are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('HomeTask')
      .insert({
        home_id: homeId,
        task_type,
        title,
        description: description || null,
        assigned_to: assigned_to || null,
        due_at: due_at || null,
        recurrence_rule: recurrence_rule || null,
        priority: priority || 'medium',
        budget: budget || null,
        details: details || {},
        created_by: userId,
        visibility: visibility || 'members',
        viewer_user_ids: viewer_user_ids || [],
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating home task', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to create task' });
    }

    res.status(201).json({ task: data });

    // Notify assigned user (non-blocking)
    if (assigned_to && assigned_to !== userId) {
      const { notifyTaskAssigned } = require('../services/notificationService');
      (async () => {
        try {
          const { data: assigner } = await supabaseAdmin.from('User').select('name, username, first_name').eq('id', userId).single();
          await notifyTaskAssigned({
            assigneeUserId: assigned_to,
            assignerName: assigner?.name || assigner?.first_name || assigner?.username || 'Someone',
            taskTitle: title,
            homeId,
            taskId: data.id,
          });
        } catch (e) { /* non-blocking */ }
      })();
    }
  } catch (err) {
    logger.error('Task creation error', { error: err.message });
    res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * PUT /api/homes/:id/tasks/:taskId
 */
router.put('/:id/tasks/:taskId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, taskId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'can_manage_tasks');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to manage tasks' });

    const allowed = [
      'title', 'description', 'status', 'assigned_to',
      'priority', 'due_at', 'budget', 'details', 'completed_at',
      'visibility', 'viewer_user_ids'
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    // Auto-set completed_at when marking done
    if (updates.status === 'done' && !updates.completed_at) {
      updates.completed_at = new Date().toISOString();
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('HomeTask')
      .update(updates)
      .eq('id', taskId)
      .eq('home_id', homeId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating home task', { error: error.message, taskId });
      return res.status(500).json({ error: 'Failed to update task' });
    }

    res.json({ task: data });
  } catch (err) {
    logger.error('Task update error', { error: err.message });
    res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * DELETE /api/homes/:id/tasks/:taskId
 */
router.delete('/:id/tasks/:taskId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, taskId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'can_manage_tasks');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to manage tasks' });

    const { error } = await supabaseAdmin
      .from('HomeTask')
      .delete()
      .eq('id', taskId)
      .eq('home_id', homeId);

    if (error) {
      logger.error('Error deleting home task', { error: error.message, taskId });
      return res.status(500).json({ error: 'Failed to delete task' });
    }

    res.json({ message: 'Task deleted' });
  } catch (err) {
    logger.error('Task delete error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete task' });
  }
});


// ============ HOME ISSUES ============

/**
 * GET /api/homes/:id/issues
 */
router.get('/:id/issues', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;
    const { status, severity } = req.query;

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    let query = supabaseAdmin
      .from('HomeIssue')
      .select('*')
      .eq('home_id', homeId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (severity) query = query.eq('severity', severity);

    const { data, error } = await query;
    if (error) {
      logger.error('Error fetching home issues', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch issues' });
    }

    res.json({ issues: data || [] });
  } catch (err) {
    logger.error('Issues fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
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

    const access = await checkHomePermission(homeId, userId);
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

    const access = await checkHomePermission(homeId, userId);
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
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;
    const { status } = req.query;

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    let query = supabaseAdmin
      .from('HomePackage')
      .select('*')
      .eq('home_id', homeId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      logger.error('Error fetching home packages', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch packages' });
    }

    res.json({ packages: data || [] });
  } catch (err) {
    logger.error('Packages fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
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

/**
 * GET /api/homes/:id/events
 */
router.get('/:id/events', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;
    const { start_after, start_before } = req.query;

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    let query = supabaseAdmin
      .from('HomeCalendarEvent')
      .select('*')
      .eq('home_id', homeId)
      .order('start_at', { ascending: true });

    if (start_after) query = query.gte('start_at', start_after);
    if (start_before) query = query.lte('start_at', start_before);

    const { data, error } = await query;
    if (error) {
      logger.error('Error fetching home events', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch events' });
    }

    const events = data || [];

    // Calendarly: union confirmed/pending home bookings onto the household calendar.
    // Query-time union — bookings are never copied into HomeCalendarEvent — so the calendar
    // always reflects the live booking state. Gated on calendar.view (matching the Booking RLS)
    // so the booking layer is not exposed more broadly than the existing event access.
    // Degrades gracefully if scheduling tables are absent.
    try {
      const calAccess = await checkHomePermission(homeId, userId, 'calendar.view');
      let bq = supabaseAdmin
        .from('Booking')
        .select('id, home_id, event_type_id, resource_id, host_user_id, invitee_name, start_at, end_at, status, location_detail, created_by')
        .eq('owner_type', 'home')
        .eq('owner_id', homeId)
        .is('cohost_of_booking_id', null) // co-host shadows mirror a primary row already in this list
        .in('status', ['pending', 'confirmed']);
      if (start_after) bq = bq.gte('start_at', start_after);
      if (start_before) bq = bq.lte('start_at', start_before);
      const { data: bookings } = calAccess.hasAccess ? await bq : { data: [] };

      if (bookings && bookings.length) {
        const etIds = [...new Set(bookings.map((b) => b.event_type_id).filter(Boolean))];
        const etNames = {};
        if (etIds.length) {
          const { data: ets } = await supabaseAdmin.from('EventType').select('id, name').in('id', etIds);
          for (const et of ets || []) etNames[et.id] = et.name;
        }
        for (const b of bookings) {
          const baseTitle = b.event_type_id ? etNames[b.event_type_id] || 'Appointment' : 'Resource booking';
          events.push({
            id: b.id,
            home_id: b.home_id,
            event_type: b.resource_id ? 'resource_booking' : 'appointment',
            title: b.invitee_name ? `${baseTitle} — ${b.invitee_name}` : baseTitle,
            description: null,
            start_at: b.start_at,
            end_at: b.end_at,
            location_notes: b.location_detail || null,
            recurrence_rule: null,
            assigned_to: b.host_user_id ? [b.host_user_id] : null,
            alerts_enabled: true,
            created_by: b.created_by,
            visibility: 'members',
            // Calendarly markers (extra fields; clients that don't read them ignore these):
            source: 'booking',
            booking_id: b.id,
            booking_status: b.status,
          });
        }
      }
    } catch (unionErr) {
      logger.warn('[home events] booking union skipped', { error: unionErr.message, homeId });
    }

    events.sort((a, b2) => new Date(a.start_at) - new Date(b2.start_at));
    res.json({ events });
  } catch (err) {
    logger.error('Events fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

/**
 * POST /api/homes/:id/events
 */
router.post('/:id/events', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const { event_type, title, description, start_at, end_at, location_notes, recurrence_rule, assigned_to, alerts_enabled, request_rsvp, reminders } = req.body;

    if (!event_type || !title || !start_at) {
      return res.status(400).json({ error: 'event_type, title, and start_at are required' });
    }

    // Persist the zone a RECURRING event was authored in so the availability engine expands
    // it at the intended wall-clock time across DST (migration 167 §5). Default: the
    // creator's default availability-schedule timezone.
    let timezone = typeof req.body.timezone === 'string' && req.body.timezone ? req.body.timezone.slice(0, 64) : null;
    if (!timezone && recurrence_rule) {
      const { data: sched } = await supabaseAdmin
        .from('AvailabilitySchedule')
        .select('timezone')
        .eq('user_id', userId)
        .eq('is_default', true)
        .maybeSingle();
      timezone = (sched && sched.timezone) || 'UTC';
    }

    const { data, error } = await supabaseAdmin
      .from('HomeCalendarEvent')
      .insert({
        home_id: homeId,
        event_type,
        title,
        description: description || null,
        start_at,
        end_at: end_at || null,
        location_notes: location_notes || null,
        recurrence_rule: recurrence_rule || null,
        assigned_to: assigned_to || null,
        alerts_enabled: alerts_enabled !== false,
        request_rsvp: request_rsvp === true,
        reminders: Array.isArray(reminders) ? reminders : [],
        timezone,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating home event', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to create event' });
    }

    res.status(201).json({ event: data });
  } catch (err) {
    logger.error('Event creation error', { error: err.message });
    res.status(500).json({ error: 'Failed to create event' });
  }
});

/**
 * PUT /api/homes/:id/events/:eventId
 */
router.put('/:id/events/:eventId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, eventId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const allowed = ['title', 'description', 'event_type', 'start_at', 'end_at', 'location_notes', 'recurrence_rule', 'assigned_to', 'alerts_enabled', 'request_rsvp', 'reminders', 'timezone'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('HomeCalendarEvent')
      .update(updates)
      .eq('id', eventId)
      .eq('home_id', homeId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating home event', { error: error.message, eventId });
      return res.status(500).json({ error: 'Failed to update event' });
    }

    res.json({ event: data });
  } catch (err) {
    logger.error('Event update error', { error: err.message });
    res.status(500).json({ error: 'Failed to update event' });
  }
});

/**
 * DELETE /api/homes/:id/events/:eventId
 */
router.delete('/:id/events/:eventId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, eventId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const { error } = await supabaseAdmin
      .from('HomeCalendarEvent')
      .delete()
      .eq('id', eventId)
      .eq('home_id', homeId);

    if (error) {
      logger.error('Error deleting home event', { error: error.message, eventId });
      return res.status(500).json({ error: 'Failed to delete event' });
    }

    res.json({ message: 'Event deleted' });
  } catch (err) {
    logger.error('Event delete error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

/**
 * GET /api/homes/:id/events/:eventId — event detail incl. attendee RSVPs.
 */
router.get('/:id/events/:eventId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, eventId } = req.params;
    const access = await checkHomePermission(homeId, req.user.id);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });
    const { data: event } = await supabaseAdmin
      .from('HomeCalendarEvent')
      .select('*')
      .eq('id', eventId)
      .eq('home_id', homeId)
      .maybeSingle();
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const { data: attendees } = await supabaseAdmin
      .from('HomeCalendarEventAttendee')
      .select('user_id, rsvp_status, updated_at')
      .eq('event_id', eventId);
    res.json({ event, attendees: attendees || [] });
  } catch (err) {
    logger.error('Event detail error', { error: err.message });
    res.status(500).json({ error: 'Failed to load event' });
  }
});

/**
 * POST /api/homes/:id/events/:eventId/rsvp — a member records their RSVP for a home event.
 */
router.post('/:id/events/:eventId/rsvp', verifyToken, async (req, res) => {
  try {
    const { id: homeId, eventId } = req.params;
    const userId = req.user.id;
    const status = req.body && req.body.status;
    if (!['going', 'maybe', 'declined', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'status must be going | maybe | declined | pending' });
    }
    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });
    // Confirm the event belongs to this home.
    const { data: event } = await supabaseAdmin
      .from('HomeCalendarEvent')
      .select('id')
      .eq('id', eventId)
      .eq('home_id', homeId)
      .maybeSingle();
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const { data: existing } = await supabaseAdmin
      .from('HomeCalendarEventAttendee')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();
    let row;
    if (existing) {
      ({ data: row } = await supabaseAdmin
        .from('HomeCalendarEventAttendee')
        .update({ rsvp_status: status, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('user_id, rsvp_status')
        .single());
    } else {
      ({ data: row } = await supabaseAdmin
        .from('HomeCalendarEventAttendee')
        .insert({ event_id: eventId, user_id: userId, rsvp_status: status })
        .select('user_id, rsvp_status')
        .single());
    }
    res.json({ attendee: row });
  } catch (err) {
    logger.error('Event RSVP error', { error: err.message });
    res.status(500).json({ error: 'Failed to record RSVP' });
  }
});


// ============ HOME DOCUMENTS ============

/**
 * GET /api/homes/:id/documents
 */
router.get('/:id/documents', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    // Filter by visibility based on permissions
    const canViewSensitive = access.isOwner || (access.occupancy && access.occupancy.can_view_sensitive);
    const canManageHome = access.isOwner || (access.occupancy && access.occupancy.can_manage_home);

    let query = supabaseAdmin
      .from('HomeDocument')
      .select('*')
      .eq('home_id', homeId)
      .order('created_at', { ascending: false });

    // Restrict based on visibility
    if (!canViewSensitive && !canManageHome) {
      query = query.eq('visibility', 'members');
    } else if (!canViewSensitive) {
      query = query.in('visibility', ['members', 'managers']);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('Error fetching home documents', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch documents' });
    }

    res.json({ documents: data || [] });
  } catch (err) {
    logger.error('Documents fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

/**
 * POST /api/homes/:id/documents
 */
router.post('/:id/documents', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const { file_id, doc_type, title, storage_bucket, storage_path, mime_type, size_bytes, visibility, details } = req.body;

    if (!doc_type || !title) {
      return res.status(400).json({ error: 'doc_type and title are required' });
    }

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
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId);
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    // Filter by visibility based on permissions
    const canManageAccess = access.isOwner || (access.occupancy && access.occupancy.can_manage_access);
    const canViewSensitive = access.isOwner || (access.occupancy && access.occupancy.can_view_sensitive);

    let query = supabaseAdmin
      .from('HomeAccessSecret')
      .select('*')
      .eq('home_id', homeId)
      .order('label', { ascending: true });

    if (!canViewSensitive && !canManageAccess) {
      query = query.eq('visibility', 'members');
    } else if (!canViewSensitive) {
      query = query.in('visibility', ['members', 'managers']);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('Error fetching home access secrets', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch access info' });
    }

    res.json({ secrets: data || [] });
  } catch (err) {
    logger.error('Access secrets fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch access info' });
  }
});

/**
 * POST /api/homes/:id/access
 */
router.post('/:id/access', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'can_manage_access');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to manage access' });

    const { access_type, label, secret_value, notes, visibility } = req.body;

    if (!access_type || !label || !secret_value) {
      return res.status(400).json({ error: 'access_type, label, and secret_value are required' });
    }

    // Insert main row with empty secret_value so the BEFORE trigger does not insert into
    // HomeAccessSecretValue (which would violate FK since the parent row does not exist yet).
    const { data, error } = await supabaseAdmin
      .from('HomeAccessSecret')
      .insert({
        home_id: homeId,
        access_type,
        label,
        secret_value: '',
        notes: notes || null,
        visibility: visibility || 'members',
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating home access secret', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to create access secret' });
    }

    // Store the actual secret in HomeAccessSecretValue (trigger would do this but runs before parent exists).
    if (secret_value && data?.id) {
      const { error: valueErr } = await supabaseAdmin
        .from('HomeAccessSecretValue')
        .upsert(
          { access_secret_id: data.id, secret_value, updated_at: new Date().toISOString() },
          { onConflict: 'access_secret_id' }
        );
      if (valueErr) {
        logger.error('Error writing access secret value', { error: valueErr.message, secretId: data.id });
        return res.status(500).json({ error: 'Failed to create access secret' });
      }
    }

    res.status(201).json({ secret: data });
  } catch (err) {
    logger.error('Access secret creation error', { error: err.message });
    res.status(500).json({ error: 'Failed to create access secret' });
  }
});

/**
 * PUT /api/homes/:id/access/:secretId
 */
router.put('/:id/access/:secretId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, secretId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'can_manage_access');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to manage access' });

    const allowed = ['label', 'secret_value', 'access_type', 'notes', 'visibility'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('HomeAccessSecret')
      .update(updates)
      .eq('id', secretId)
      .eq('home_id', homeId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating home access secret', { error: error.message, secretId });
      return res.status(500).json({ error: 'Failed to update access secret' });
    }

    res.json({ secret: data });
  } catch (err) {
    logger.error('Access secret update error', { error: err.message });
    res.status(500).json({ error: 'Failed to update access secret' });
  }
});

/**
 * DELETE /api/homes/:id/access/:secretId
 */
router.delete('/:id/access/:secretId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, secretId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'can_manage_access');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to manage access' });

    const { error } = await supabaseAdmin
      .from('HomeAccessSecret')
      .delete()
      .eq('id', secretId)
      .eq('home_id', homeId);

    if (error) {
      logger.error('Error deleting home access secret', { error: error.message, secretId });
      return res.status(500).json({ error: 'Failed to delete access secret' });
    }

    res.json({ message: 'Access secret deleted' });
  } catch (err) {
    logger.error('Access secret delete error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete access secret' });
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
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'can_manage_access');
    if (!access.hasAccess) return res.status(403).json({ error: 'No permission to invite members' });

    const { email, user_id, relationship, message } = req.body;
    const requestedPresetKey = typeof req.body.preset_key === 'string' ? req.body.preset_key : null;
    if (requestedPresetKey?.startsWith('claim_merge:')) {
      return res.status(400).json({
        error: 'Claim merge invitations must be created from ownership claim review',
        code: 'CLAIM_MERGE_PRESET_FORBIDDEN',
      });
    }

    // Compute is_open_invite server-side: true when no specific invitee is provided
    const isOpenInvite = !email && !user_id;

    // Validate: manager and service_provider roles require a targeted invite
    const proposedRoleBase = mapLegacyRole(relationship || 'member');

    // SEC-07: an invite could propose `owner`, which mapLegacyRole turns into a
    // full IAM owner. Combined with the absence of a rank check, an admin
    // holding can_manage_access could mint an owner ranked above themselves,
    // taking over the household — and it bypassed the address-claim gate that
    // ownership is supposed to require. Ownership is transferred through the
    // claim and transfer flows, never through an invitation.
    if (proposedRoleBase === 'owner') {
      return res.status(400).json({
        error: 'Ownership cannot be granted by invitation. Use the ownership transfer flow.',
        code: 'OWNER_INVITE_FORBIDDEN',
      });
    }

    // The inviter may not propose a role at or above their own rank.
    const inviterOccupancy = await getActiveOccupancy(homeId, userId);
    const inviterRoleBase = access.isOwner
      ? 'owner'
      : (inviterOccupancy?.role_base || mapLegacyRole(inviterOccupancy?.role) || 'member');

    const rankCheck = assertCanMutateTarget(inviterRoleBase, proposedRoleBase);
    if (!rankCheck.allowed) {
      return res.status(403).json({ error: rankCheck.reason });
    }
    if (isOpenInvite && (proposedRoleBase === 'manager' || proposedRoleBase === 'service_provider')) {
      return res.status(400).json({
        error: 'Property managers and service providers must be invited by email or user ID',
      });
    }

    // Resolve invitee — figure out both email and user_id when possible
    let inviteeEmail = email ? email.toLowerCase().trim() : null;
    let inviteeUserId = user_id || null;
    let isExistingUser = false;

    if (!isOpenInvite && inviteeEmail && !inviteeUserId) {
      // Email provided — check if this person already has an account
      const { data: existingUser } = await supabaseAdmin
        .from('User')
        .select('id, username, email')
        .eq('email', inviteeEmail)
        .single();

      if (existingUser) {
        inviteeUserId = existingUser.id;
        isExistingUser = true;
      }
    }

    if (!isOpenInvite) {
      if (inviteeUserId && !inviteeEmail) {
        // User ID provided (username search) — fetch their email for notification
        const { data: targetUser } = await supabaseAdmin
          .from('User')
          .select('id, email, username')
          .eq('id', inviteeUserId)
          .single();

        if (targetUser?.email) {
          inviteeEmail = targetUser.email;
        }
        isExistingUser = true;
      }

      // Check if this user is already a member
      if (inviteeUserId) {
        const { data: existingOcc } = await supabaseAdmin
          .from('HomeOccupancy')
          .select('id')
          .eq('home_id', homeId)
          .eq('user_id', inviteeUserId)
          .eq('is_active', true)
          .single();

        if (existingOcc) {
          return res.status(409).json({ error: 'This person is already a member of this home' });
        }
      }

      // Check for duplicate pending invite
      let dupQuery = supabaseAdmin
        .from('HomeInvite')
        .select('id')
        .eq('home_id', homeId)
        .eq('status', 'pending');

      if (inviteeUserId) {
        dupQuery = dupQuery.eq('invitee_user_id', inviteeUserId);
      } else if (inviteeEmail) {
        dupQuery = dupQuery.eq('invitee_email', inviteeEmail);
      }

      const { data: existingInvite } = await dupQuery.single();
      if (existingInvite) {
        return res.status(409).json({ error: 'A pending invitation already exists for this person' });
      }
    }

    // Generate a unique invite token + hash (AUTH-3.1)
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { data, error } = await supabaseAdmin
      .from('HomeInvite')
      .insert({
        home_id: homeId,
        invited_by: userId,
        invitee_email: inviteeEmail,
        invitee_user_id: inviteeUserId,
        proposed_role: relationship || 'member',
        token,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        proposed_role_base: proposedRoleBase,
        proposed_preset_key: requestedPresetKey,
        is_open_invite: isOpenInvite,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating home invite', { error: error.message, homeId });
      return res.status(500).json({ error: 'Failed to create invitation' });
    }

    logger.info('Home invite created', { homeId, inviteId: data.id, inviteeEmail, inviteeUserId, userId, isOpenInvite });

    // Send invite email (non-blocking — don't fail the request if email fails)
    if (inviteeEmail) {
      // Get inviter info and home info for the email
      const [inviterRes, homeRes] = await Promise.allSettled([
        supabaseAdmin.from('User').select('name, username, first_name').eq('id', userId).single(),
        supabaseAdmin.from('Home').select('name, address, city, state').eq('id', homeId).single(),
      ]);

      const inviter = inviterRes.status === 'fulfilled' ? inviterRes.value.data : null;
      const homeData = homeRes.status === 'fulfilled' ? homeRes.value.data : null;

      const inviterName = inviter?.name || inviter?.first_name || inviter?.username || 'Someone';
      const homeName = homeData?.name || homeData?.address || 'A home';
      const homeCity = [homeData?.city, homeData?.state].filter(Boolean).join(', ');

      const { sendHomeInviteEmail } = require('../services/emailService');
      sendHomeInviteEmail({
        toEmail: inviteeEmail,
        inviterName,
        homeName,
        homeCity,
        role: relationship || 'member',
        token,
        message: message || null,
        isExistingUser,
      }).catch(err => {
        logger.error('Failed to send invite email (non-blocking)', { error: err.message });
      });
    }

    // Send in-app notification (if invitee is an existing user)
    if (inviteeUserId) {
      const inviterName = inviteeEmail ? 'Someone' : 'Someone'; // will be overwritten below
      // Re-use inviter/home info if we already fetched it for email, otherwise fetch
      const { notifyHomeInvite } = require('../services/notificationService');
      (async () => {
        try {
          const [invRes, hmRes] = await Promise.allSettled([
            supabaseAdmin.from('User').select('name, username, first_name').eq('id', userId).single(),
            supabaseAdmin.from('Home').select('name, address').eq('id', homeId).single(),
          ]);
          const inv = invRes.status === 'fulfilled' ? invRes.value.data : null;
          const hm = hmRes.status === 'fulfilled' ? hmRes.value.data : null;
          await notifyHomeInvite({
            inviteeUserId,
            inviterName: inv?.name || inv?.first_name || inv?.username || 'Someone',
            homeName: hm?.name || hm?.address || 'A home',
            homeId,
            inviteToken: token,
          });
        } catch (e) {
          logger.error('Failed to create invite notification (non-blocking)', { error: e.message });
        }
      })();
    }

    res.status(201).json({ invitation: data, emailSent: !!inviteeEmail });
  } catch (err) {
    logger.error('Home invite error', { error: err.message });
    res.status(500).json({ error: 'Failed to create invitation' });
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

/**
 * GET /api/homes/:id/dashboard
 * Returns card-based dashboard data in a single request
 */
router.get('/:id/dashboard', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'home.view');
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const { getUserAccess } = require('../utils/homePermissions');
    const myAccess = await getUserAccess(homeId, userId);
    const perms = new Set(myAccess.permissions || []);

    const canFinance = myAccess.isOwner || perms.has('finance.view') || perms.has('finance.manage');

    // Build date boundaries for "today" queries
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const nowISO = now.toISOString();
    const eodISO = endOfToday.toISOString();

    // Fire all queries in parallel
    const [
      homeRes,
      membersRes,
      todayEventsRes,
      tasksDueRes,
      nextBillRes,
      unreadMailRes,
      activePassesRes,
      deliveriesRes,
      tasksOpenRes,
      issuesOpenRes,
      billsDueRes,
      packagesExpectedRes,
      documentsRes,
      eventsUpcomingRes,
      petsCountRes,
      activityRes,
    ] = await Promise.allSettled([
      // home record
      supabaseAdmin.from('Home').select('*').eq('id', homeId).single(),
      // active members
      supabaseAdmin
        .from('HomeOccupancy')
        .select(`
          user_id, role, role_base, is_active,
          user:user_id ( id, username, name, profile_picture_url )
        `)
        .eq('home_id', homeId)
        .eq('is_active', true),
      // today: next 3 calendar events
      supabaseAdmin
        .from('HomeCalendarEvent')
        .select(HOME_EVENT_LIST)
        .eq('home_id', homeId)
        .gte('start_at', nowISO)
        .lte('start_at', eodISO)
        .order('start_at', { ascending: true })
        .limit(3),
      // today: tasks due today or overdue (not done)
      supabaseAdmin
        .from('HomeTask')
        .select(HOME_TASK_LIST)
        .eq('home_id', homeId)
        .neq('status', 'done')
        .neq('status', 'canceled')
        .lte('due_at', eodISO)
        .order('due_at', { ascending: true })
        .limit(3),
      // today: next bill due
      canFinance
        ? supabaseAdmin
            .from('HomeBill')
            .select(HOME_BILL_LIST)
            .eq('home_id', homeId)
            .eq('status', 'due')
            .order('due_date', { ascending: true })
            .limit(1)
        : Promise.resolve({ data: [] }),
      // today: unread mail count
      supabaseAdmin
        .from('HomeMail')
        .select('id', { count: 'exact', head: true })
        .eq('home_id', homeId)
        .eq('is_read', false),
      // today: active guest passes
      supabaseAdmin
        .from('HomeGuestPass')
        .select('id', { count: 'exact', head: true })
        .eq('home_id', homeId)
        .is('revoked_at', null)
        .or(`end_at.is.null,end_at.gt.${nowISO}`),
      // today: deliveries arriving
      supabaseAdmin
        .from('HomePackage')
        .select('id', { count: 'exact', head: true })
        .eq('home_id', homeId)
        .in('status', ['ordered', 'shipped', 'out_for_delivery']),
      // counts: open tasks
      supabaseAdmin
        .from('HomeTask')
        .select('id', { count: 'exact', head: true })
        .eq('home_id', homeId)
        .in('status', ['open', 'in_progress']),
      // counts: open issues
      supabaseAdmin
        .from('HomeIssue')
        .select('id', { count: 'exact', head: true })
        .eq('home_id', homeId)
        .in('status', ['open', 'in_progress']),
      // counts: bills due
      canFinance
        ? supabaseAdmin
            .from('HomeBill')
            .select('id', { count: 'exact', head: true })
            .eq('home_id', homeId)
            .eq('status', 'due')
        : Promise.resolve({ count: 0 }),
      // counts: packages expected
      supabaseAdmin
        .from('HomePackage')
        .select('id', { count: 'exact', head: true })
        .eq('home_id', homeId)
        .in('status', ['ordered', 'shipped', 'out_for_delivery']),
      // counts: documents
      supabaseAdmin
        .from('HomeDocument')
        .select('id', { count: 'exact', head: true })
        .eq('home_id', homeId),
      // counts: upcoming events
      supabaseAdmin
        .from('HomeCalendarEvent')
        .select('id', { count: 'exact', head: true })
        .eq('home_id', homeId)
        .gte('start_at', nowISO),
      // counts: pets
      supabaseAdmin
        .from('HomePet')
        .select('id', { count: 'exact', head: true })
        .eq('home_id', homeId),
      // recent activity (last 5 audit log entries)
      supabaseAdmin
        .from('HomeAuditLog')
        .select('*')
        .eq('home_id', homeId)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    // Helpers
    const extractVal = (r) => (r.status === 'fulfilled' ? r.value : null);
    const extractData = (r) => extractVal(r)?.data || [];
    const extractCount = (r) => extractVal(r)?.count ?? 0;

    const home = extractVal(homeRes)?.data ?? null;
    if (!home) return res.status(404).json({ error: 'Home not found' });

    // Parse location
    if (home.location) {
      const parsed = parsePostGISPoint(home.location);
      if (parsed) home.location = parsed;
    }

    home.can_delete_home = await canUserDeleteHomeRecord(homeId, userId, home.owner_id);

    // Enrich members with HomeOwner status
    const rawMembers = extractData(membersRes);
    const memberUserIds = rawMembers.map((m) => m.user_id).filter(Boolean);
    let ownerStatusByUser = {};
    if (memberUserIds.length > 0) {
      const { data: ownerRows } = await supabaseAdmin
        .from('HomeOwner')
        .select('subject_id, owner_status, verification_tier')
        .eq('home_id', homeId)
        .in('subject_id', memberUserIds)
        .neq('owner_status', 'revoked');

      for (const row of (ownerRows || [])) {
        ownerStatusByUser[row.subject_id] = row;
      }
    }

    const enrichedMembers = rawMembers.map((m) => {
      const ownerInfo = ownerStatusByUser[m.user_id];
      let displayRole = m.role;
      if (ownerInfo) {
        if (ownerInfo.owner_status === 'verified') displayRole = 'owner';
        else if (ownerInfo.owner_status === 'pending') displayRole = 'pending_owner';
        else if (ownerInfo.owner_status === 'disputed') displayRole = 'disputed_owner';
      }
      return {
        ...m,
        display_role: displayRole,
        ownership_status: ownerInfo?.owner_status || null,
        verification_tier: ownerInfo?.verification_tier || null,
      };
    });

    const nextBillArr = extractData(nextBillRes);

    // Optionally embed health score to avoid a second round-trip
    let healthScore = undefined;
    if (req.query.include_health_score === 'true') {
      try {
        healthScore = await getHealthScore(homeId);
      } catch (err) {
        logger.warn('Failed to embed health score in dashboard', { homeId, error: err.message });
      }
    }

    res.json({
      home,
      myAccess: {
        permissions: myAccess.permissions,
        role_base: myAccess.role_base,
        isOwner: myAccess.isOwner,
      },
      today: {
        next_events: extractData(todayEventsRes),
        tasks_due: extractData(tasksDueRes),
        next_bill: canFinance ? (nextBillArr[0] || null) : null,
        unread_mail_count: extractCount(unreadMailRes),
        active_guest_passes: extractCount(activePassesRes),
        deliveries_arriving: extractCount(deliveriesRes),
      },
      counts: {
        tasks_open: extractCount(tasksOpenRes),
        issues_open: extractCount(issuesOpenRes),
        bills_due: canFinance ? extractCount(billsDueRes) : 0,
        packages_expected: extractCount(packagesExpectedRes),
        documents: extractCount(documentsRes),
        events_upcoming: extractCount(eventsUpcomingRes),
        members_active: rawMembers.length,
        pets: extractCount(petsCountRes),
      },
      members: enrichedMembers,
      recent_activity: extractData(activityRes),
      ...(healthScore !== undefined && { health_score: healthScore }),
    });
  } catch (err) {
    logger.error('Dashboard aggregate error', { error: err.message, homeId: req.params.id });
    res.status(500).json({ error: 'Failed to load dashboard' });
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
const { postcardLimiter: claimPostcardLimiter } = require('../middleware/rateLimiter');
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
    const { data: authorities } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('user_id')
      .eq('home_id', homeId)
      .eq('is_active', true)
      .in('role_base', ['owner', 'admin', 'manager']);
    const authorityCount = authorities?.length || 0;

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
      const code = generatePostcardCode();
      const expiresAt = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();

      const { data: postcard, error: pcError } = await supabaseAdmin
        .from('HomePostcardCode')
        .insert({
          home_id: homeId,
          user_id: userId,
          code_hash: hashPostcardCode(code),
          status: 'pending',
          expires_at: expiresAt,
        })
        .select('id')
        .single();

      if (pcError) {
        logger.error('Failed to create postcard code for cold-start', { error: pcError.message });
      }

      // UX-01: actually mail it. This branch used to return "a verification
      // code will be mailed to this address" while nothing dispatched.
      const coldStartMail = await dispatchPostcardCode(home, code);
      if (!coldStartMail.success) {
        if (postcard?.id) {
          await supabaseAdmin
            .from('HomePostcardCode')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', postcard.id);
        }
        logger.error('Cold-start postcard dispatch failed', {
          homeId, userId, error: coldStartMail.error,
        });
        return res.status(502).json({
          error: 'We could not send mail to this address right now. Please try again later.',
        });
      }

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
        message: 'A verification code will be mailed to this address. Enter it to gain access.',
        claim,
        postcard_requested: true,
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
        const code = generatePostcardCode();
        const expiresAt = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();

        const { data: postcard, error: pcError } = await supabaseAdmin
          .from('HomePostcardCode')
          .insert({
            home_id: homeId,
            user_id: userId,
            code_hash: hashPostcardCode(code),
            status: 'pending',
            expires_at: expiresAt,
          })
          .select('id')
          .single();

        if (pcError) {
          logger.error('Failed to create postcard code for stale-authority cold-start', { error: pcError.message });
        }

        const staleMail = await dispatchPostcardCode(home, code);
        if (!staleMail.success) {
          if (postcard?.id) {
            await supabaseAdmin
              .from('HomePostcardCode')
              .update({ status: 'cancelled', updated_at: new Date().toISOString() })
              .eq('id', postcard.id);
          }
          logger.error('Stale-authority postcard dispatch failed', {
            homeId, userId, error: staleMail.error,
          });
          return res.status(502).json({
            error: 'We could not send mail to this address right now. Please try again later.',
          });
        }

        await applyOccupancyTemplate(homeId, userId, effectiveRole, 'pending_postcard');
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
          message: 'A verification code will be mailed to this address. Enter it to gain access.',
          claim,
          postcard_requested: true,
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

/**
 * POST /:id/claim/:claimId/approve - Approve a residency claim
 * Creates a HomeOccupancy for the claimant.
 */
router.post('/:id/claim/:claimId/approve', verifyToken, async (req, res) => {
  try {
    const { id: homeId, claimId } = req.params;
    const userId = req.user.id;
    const { proposed_role } = req.body;

    const { checkHomePermission } = require('../utils/homePermissions');
    const access = await checkHomePermission(homeId, userId, 'members.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Not authorized to approve claims' });
    }

    // Fetch the claim
    const { data: claim } = await supabaseAdmin
      .from('HomeResidencyClaim')
      .select('*')
      .eq('id', claimId)
      .eq('home_id', homeId)
      .single();

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (claim.status !== 'pending') {
      return res.status(400).json({ error: `Cannot approve a ${claim.status} claim` });
    }

    // Update claim to verified
    const { error: claimError } = await supabaseAdmin
      .from('HomeResidencyClaim')
      .update({
        status: 'verified',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', claimId);

    if (claimError) {
      logger.error('Error approving claim', { error: claimError.message });
      return res.status(500).json({ error: 'Failed to approve claim' });
    }

    // Determine role: admin's proposed_role overrides claimant's claimed_role
    const grantedRole = proposed_role || claim.claimed_role || 'member';
    const roleBase = mapLegacyRole(grantedRole);

    // Create/activate occupancy via applyOccupancyTemplate (upserts, prevents duplicates)
    let occupancy;
    try {
      const result = await applyOccupancyTemplate(homeId, claim.user_id, roleBase, 'verified');
      occupancy = result.occupancy;
    } catch (occError) {
      logger.error('Error creating occupancy from claim', { error: occError.message });
      return res.status(500).json({ error: 'Claim approved but failed to create membership' });
    }

    // Notify the claimant
    const notificationService = require('../services/notificationService');
    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('name, address')
      .eq('id', homeId)
      .single();

    notificationService.createNotification({
      userId: claim.user_id,
      type: 'residency_approved',
      title: 'Welcome home!',
      body: `You've been verified at ${home?.name || home?.address || 'your home'}.`,
      icon: '🏡',
      link: `/homes/${homeId}/dashboard`,
      metadata: { home_id: homeId, claim_id: claimId },
    });

    res.json({ message: 'Claim approved, membership created', occupancy });
  } catch (err) {
    logger.error('Approve claim error', { error: err.message });
    res.status(500).json({ error: 'Failed to approve claim' });
  }
});

/**
 * POST /:id/claim/:claimId/reject - Reject a residency claim
 */
router.post('/:id/claim/:claimId/reject', verifyToken, async (req, res) => {
  try {
    const { id: homeId, claimId } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    const { checkHomePermission } = require('../utils/homePermissions');
    const access = await checkHomePermission(homeId, userId, 'members.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Not authorized to reject claims' });
    }

    const { data: claim } = await supabaseAdmin
      .from('HomeResidencyClaim')
      .select('*')
      .eq('id', claimId)
      .eq('home_id', homeId)
      .single();

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (claim.status !== 'pending') {
      return res.status(400).json({ error: `Cannot reject a ${claim.status} claim` });
    }

    const { error } = await supabaseAdmin
      .from('HomeResidencyClaim')
      .update({
        status: 'rejected',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_note: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', claimId);

    if (error) {
      logger.error('Error rejecting claim', { error: error.message });
      return res.status(500).json({ error: 'Failed to reject claim' });
    }

    // Notify the claimant (opaque — no reason or admin identity revealed)
    const notificationService = require('../services/notificationService');
    notificationService.createNotification({
      userId: claim.user_id,
      type: 'residency_rejected',
      title: 'Verification update',
      body: 'We couldn\'t verify you for this home. You can try again or verify by mail.',
      icon: '📬',
      link: `/homes/${homeId}/waiting-room`,
      metadata: { home_id: homeId, claim_id: claimId },
    });

    res.json({ message: 'Claim rejected' });
  } catch (err) {
    logger.error('Reject claim error', { error: err.message });
    res.status(500).json({ error: 'Failed to reject claim' });
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

const { computeHealthScore, getHealthScore, invalidateHealthScoreCache } = require('../services/homeHealthService');
const { getOrCreateChecklist, updateChecklistItem, getChecklistHistory } = require('../services/seasonalChecklistService');
const { getSeasonalContext, SEASONS } = require('../services/ai/seasonalEngine');
const { getProfile: getPropertyProfile } = require('../services/ai/propertyIntelligenceService');

/**
 * GET /api/homes/:id/health-score
 * Returns composite 0-100 health score with per-dimension breakdown.
 */
router.get('/:id/health-score', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'home.view');
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const force = req.query.force === 'true';
    const result = await getHealthScore(homeId, { force });
    res.set('Cache-Control', force ? 'no-store' : 'private, max-age=300');
    res.json(result);
  } catch (err) {
    logger.error('Health score error', { error: err.message, homeId: req.params.id });
    res.status(500).json({ error: 'Failed to compute health score' });
  }
});

/**
 * GET /api/homes/:id/seasonal-checklist
 * Returns checklist items for the current season, creating them if needed.
 */
router.get('/:id/seasonal-checklist', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'home.view');
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    // Pass the home's coordinates so the engine can tell whether its
    // region-specific copy applies. Calling without them satisfied the old
    // `!hasCoords ||` gate, which served Portland-specific tips to every
    // home in the country. The season itself is month-based and resolves
    // nationally, so the checklist below works either way.
    const { data: seasonHome } = await supabaseAdmin
      .from('Home')
      .select('map_center_lat, map_center_lng')
      .eq('id', homeId)
      .maybeSingle();
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

    res.json(response);
  } catch (err) {
    logger.error('Seasonal checklist error', { error: err.message, homeId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch seasonal checklist' });
  }
});

/**
 * GET /api/homes/:id/seasonal-checklist/history
 * Returns all past checklists grouped by season_key + year.
 */
router.get('/:id/seasonal-checklist/history', verifyToken, async (req, res) => {
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'home.view');
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const history = await getChecklistHistory(homeId);
    res.json({ checklists: history });
  } catch (err) {
    logger.error('Checklist history error', { error: err.message, homeId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch checklist history' });
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

    const updated = await updateChecklistItem(itemId, req.body.status, userId);
    if (!updated) return res.status(404).json({ error: 'Checklist item not found' });

    res.json(updated);
  } catch (err) {
    logger.error('Checklist item update error', { error: err.message, itemId: req.params.itemId });
    res.status(500).json({ error: 'Failed to update checklist item' });
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
    const canFinance = myAccess.isOwner || perms.has('finance.view') || perms.has('finance.manage');
    if (!canFinance) return res.status(403).json({ error: 'No finance access' });

    // Fetch paid bills (last 24 months)
    const { data: bills, error: billsError } = await supabaseAdmin
      .from('HomeBill')
      .select('bill_type, amount, period_start')
      .eq('home_id', homeId)
      .eq('status', 'paid')
      .gt('amount', 0)
      .not('period_start', 'is', null)
      .order('period_start', { ascending: false })
      .limit(200);

    if (billsError) {
      logger.error('Bill trends query error', { error: billsError.message, homeId });
      return res.status(500).json({ error: 'Failed to fetch bill data' });
    }

    // Group by bill_type → month series
    const billsByType = {};
    for (const bill of (bills || [])) {
      const d = new Date(bill.period_start);
      const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

      if (!billsByType[bill.bill_type]) {
        billsByType[bill.bill_type] = { months: [], amounts: [] };
      }
      billsByType[bill.bill_type].months.push(monthKey);
      billsByType[bill.bill_type].amounts.push(bill.amount);
    }

    // Fetch neighborhood benchmarks via home geohash
    let benchmarks = {};
    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('location')
      .eq('id', homeId)
      .maybeSingle();

    if (home?.location) {
      const parsed = parsePostGISPoint(home.location);
      if (parsed) {
        const hash = encodeGeohash(parsed.latitude, parsed.longitude, 6);

        // Fetch benchmarks with household_count >= 3 (the write floor).
        // Rows with 3-9 produce an insufficient_data flag; >= 10 are shown.
        const { data: benchmarkRows } = await supabaseAdmin
          .from('BillBenchmark')
          .select('bill_type, month, year, avg_amount_cents, household_count')
          .eq('geohash', hash)
          .gte('household_count', 3);

        for (const row of (benchmarkRows || [])) {
          const monthKey = `${row.year}-${String(row.month).padStart(2, '0')}`;

          if (row.household_count >= 10) {
            // Full benchmark — safe to display aggregates
            if (!benchmarks[row.bill_type]) {
              benchmarks[row.bill_type] = { months: [], avg_amounts: [], household_count: row.household_count };
            }
            benchmarks[row.bill_type].months.push(monthKey);
            benchmarks[row.bill_type].avg_amounts.push(row.avg_amount_cents);
          } else if (row.household_count >= 3 && !benchmarks[row.bill_type]) {
            // Insufficient data — signal to frontend without revealing amounts.
            // Only set this flag if we haven't already found >= 10 rows for this type.
            benchmarks[row.bill_type] = {
              insufficient_data: true,
              needed: 10 - row.household_count,
              message: 'Not enough neighbors for comparison yet',
            };
          }
        }
      }
    }

    // Fetch opt-in status for this home
    const { data: optInPref } = await supabaseAdmin
      .from('HomePreference')
      .select('value')
      .eq('home_id', homeId)
      .eq('key', 'bill_benchmark_opt_in')
      .maybeSingle();

    const billBenchmarkOptIn = optInPref?.value === 'true';

    res.json({ bills_by_type: billsByType, benchmarks, bill_benchmark_opt_in: billBenchmarkOptIn });
  } catch (err) {
    logger.error('Bill trends error', { error: err.message, homeId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch bill trends' });
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

    const access = await checkHomePermission(homeId, userId, 'home.view');
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
  try {
    const { id: homeId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'home.view');
    if (!access.hasAccess) return res.status(403).json({ error: 'No access to this home' });

    const { profile, source } = await getPropertyProfile(homeId);

    if (!profile || source === 'error') {
      return res.json({
        estimated_value: null,
        value_range_low: null,
        value_range_high: null,
        value_confidence: null,
        zip_median_sale_price_trend: null,
        year_built: null,
        sqft: null,
        last_updated: null,
        source: 'unavailable',
      });
    }

    res.json({
      estimated_value: profile.estimated_value || null,
      value_range_low: profile.value_range_low || null,
      value_range_high: profile.value_range_high || null,
      value_confidence: profile.value_confidence || null,
      zip_median_sale_price_trend: profile.zip_median_sale_price_trend || null,
      year_built: profile.year_built || null,
      sqft: profile.sqft || null,
      last_updated: profile.cached_at || null,
      source,
    });
  } catch (err) {
    logger.error('Property value error', { error: err.message, homeId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch property value' });
  }
});

module.exports = router;
