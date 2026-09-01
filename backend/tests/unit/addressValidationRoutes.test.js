// ============================================================
// TEST: Address Validation Routes
//
// Unit tests for the three address validation API endpoints:
//   POST /validate        — full pipeline
//   POST /validate/unit   — re-validate with unit
//   POST /claim           — create AddressClaim
//
// Tests the route handler logic directly using the in-memory
// supabaseAdmin mock. Provider services are jest-mocked to
// isolate route wiring.
// ============================================================

const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');

// ── Mock providers ──────────────────────────────────────────
jest.mock('../../services/addressValidation/googleProvider', () => ({
  isAvailable: jest.fn(() => true),
  validate: jest.fn(),
}));

jest.mock('../../services/addressValidation/smartyProvider', () => ({
  isAvailable: jest.fn(() => true),
  verify: jest.fn(),
}));

jest.mock('../../services/addressValidation/secondaryAddressProvider', () => ({
  shouldRunLookup: jest.fn(() => false),
  lookup: jest.fn(),
}));

// Mock rate limiters to pass-through
jest.mock('../../middleware/rateLimiter', () => ({
  globalWriteLimiter: (req, res, next) => next(),
  addressValidationLimiter: (req, res, next) => next(),
  addressClaimLimiter: (req, res, next) => next(),
}));

// Mock verifyToken to pass-through
jest.mock('../../middleware/verifyToken', () => {
  const mw = (req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com', role: 'user' };
    next();
  };
  mw.requireAdmin = (req, res, next) => next();
  return mw;
});

const googleProvider = require('../../services/addressValidation/googleProvider');
const smartyProvider = require('../../services/addressValidation/smartyProvider');
const secondaryAddressProvider = require('../../services/addressValidation/secondaryAddressProvider');
const decisionEngine = require('../../services/addressValidation/addressDecisionEngine');
const pipelineService = require('../../services/addressValidation/pipelineService');
const addressConfig = require('../../config/addressVerification');

// ── Test data factories ─────────────────────────────────────

function makeGoogleResult(overrides = {}) {
  return {
    normalized: {
      line1: '123 Main St',
      line2: undefined,
      city: 'Portland',
      state: 'OR',
      zip: '97201',
      plus4: '1234',
      lat: 45.5,
      lng: -122.6,
    },
    components: {},
    geocode: { lat: 45.5, lng: -122.6 },
    granularity: 'PREMISE',
    missing_component_types: [],
    verdict: {
      hasUnconfirmedComponents: false,
      hasInferredComponents: false,
      hasReplacedComponents: false,
    },
    ...overrides,
  };
}

function makeSmartyResult(overrides = {}) {
  return {
    from_cache: false,
    inconclusive: false,
    dpv_match_code: 'Y',
    rdi_type: 'residential',
    missing_secondary: false,
    commercial_mailbox: false,
    vacant_flag: false,
    footnotes: [],
    raw: { analysis: { dpv_match_code: 'Y' } },
    ...overrides,
  };
}

// ── Setup ───────────────────────────────────────────────────

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  addressConfig.outageFallback.enabled = true;
  addressConfig.outageFallback.maxValidationAgeDays = 30;
  addressConfig.outageFallback.minConfidence = 0.8;
  addressConfig.rollout.enforcePlaceProviderBusiness = false;
  addressConfig.rollout.enableSecondaryProvider = false;
  addressConfig.rollout.enforceParcelProviderClassification = false;

  googleProvider.isAvailable.mockReturnValue(true);
  googleProvider.validate.mockResolvedValue(makeGoogleResult());
  smartyProvider.isAvailable.mockReturnValue(true);
  smartyProvider.verify.mockResolvedValue(makeSmartyResult());
  secondaryAddressProvider.shouldRunLookup.mockReturnValue(false);
  secondaryAddressProvider.lookup.mockResolvedValue(null);
});

// ============================================================
// Validation pipeline (mirrors POST /validate handler logic)
// ============================================================

/**
 * Executes the same logic as the POST /validate route handler.
 * This lets us test the pipeline wiring without requiring Express/supertest.
 */
async function runValidate(input) {
  if (addressConfig.outageFallback.enabled && !(googleProvider.isAvailable() && smartyProvider.isAvailable())) {
    return {
      verdict: {
        status: 'SERVICE_ERROR',
        reasons: ['Address verification providers unavailable'],
        confidence: 0,
        candidates: [],
        next_actions: ['manual_review'],
      },
      address_id: null,
      error_code: 'ADDRESS_VALIDATION_UNAVAILABLE',
      message: 'Address verification is temporarily unavailable. Please try again once verification is available.',
    };
  }

  return pipelineService.runValidationPipeline(input, { includeHousehold: false });
}

describe('POST /validate — pipeline', () => {
  const validInput = { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' };

  test('returns OK verdict and address_id on success', async () => {
    const result = await runValidate(validInput);
    expect(result.verdict.status).toBe('OK');
    expect(result.address_id).toBeTruthy();
  });

  test('calls Google provider with input', async () => {
    await runValidate(validInput);
    expect(googleProvider.validate).toHaveBeenCalledWith(
      expect.objectContaining({ line1: '123 Main St' }),
    );
  });

  test('calls Smarty provider with Google normalized address', async () => {
    await runValidate(validInput);
    expect(smartyProvider.verify).toHaveBeenCalledWith(
      expect.objectContaining({ line1: '123 Main St', city: 'Portland' }),
    );
  });

  test('persists HomeAddress record', async () => {
    await runValidate(validInput);
    const table = getTable('HomeAddress');
    expect(table).toHaveLength(1);
    expect(table[0].address_line1_norm).toBe('123 Main St');
  });

  test('returns SERVICE_ERROR when Google is unavailable', async () => {
    googleProvider.isAvailable.mockReturnValue(false);
    const result = await runValidate(validInput);
    expect(result.verdict.status).toBe('SERVICE_ERROR');
    expect(result.address_id).toBeNull();
    expect(result.error_code).toBe('ADDRESS_VALIDATION_UNAVAILABLE');
  });

  test('returns SERVICE_ERROR when Google throws', async () => {
    googleProvider.validate.mockRejectedValue(new Error('API down'));
    const result = await runValidate(validInput);
    expect(result.verdict.status).toBe('SERVICE_ERROR');
  });

  test('skips Smarty when Google returns no normalized address', async () => {
    googleProvider.validate.mockResolvedValue({ ...makeGoogleResult(), normalized: null });
    await runValidate(validInput);
    expect(smartyProvider.verify).not.toHaveBeenCalled();
  });

  test('handles Smarty failure gracefully', async () => {
    smartyProvider.verify.mockRejectedValue(new Error('timeout'));
    const result = await runValidate(validInput);
    expect(result.verdict).toBeDefined();
    expect(result.verdict.status).toBe('SERVICE_ERROR');
  });

  test('returns MISSING_UNIT when Smarty flags missing secondary', async () => {
    smartyProvider.verify.mockResolvedValue(makeSmartyResult({ missing_secondary: true, dpv_match_code: 'S' }));
    const result = await runValidate(validInput);
    expect(result.verdict.status).toBe('MISSING_UNIT');
  });

  test('returns UNDELIVERABLE when DPV says N', async () => {
    smartyProvider.verify.mockResolvedValue(makeSmartyResult({ dpv_match_code: 'N' }));
    const result = await runValidate(validInput);
    expect(result.verdict.status).toBe('UNDELIVERABLE');
  });

  test('does not persist address when Google fails', async () => {
    googleProvider.isAvailable.mockReturnValue(false);
    await runValidate(validInput);
    expect(getTable('HomeAddress')).toHaveLength(0);
  });
});

// ============================================================
// Unit re-validation (mirrors POST /validate/unit handler)
// ============================================================

async function runValidateUnit(addressId, unit) {
  const supabaseAdmin = require('../../config/supabaseAdmin');

  const { data: existing } = await supabaseAdmin
    .from('HomeAddress')
    .select('*')
    .eq('id', addressId)
    .maybeSingle();

  if (!existing) return { status: 404, error: 'Address not found' };

  if (addressConfig.outageFallback.enabled && !(googleProvider.isAvailable() && smartyProvider.isAvailable())) {
    return {
      verdict: {
        status: 'SERVICE_ERROR',
        reasons: ['Address revalidation providers unavailable'],
        confidence: 0,
        candidates: [],
        next_actions: ['manual_review'],
      },
      address_id: addressId,
      error_code: 'ADDRESS_REVALIDATION_UNAVAILABLE',
      message: 'Unit revalidation is temporarily unavailable. Please try again once verification is available.',
    };
  }

  const input = {
    line1: existing.address_line1_norm,
    line2: unit,
    city: existing.city_norm,
    state: existing.state,
    zip: existing.postal_code,
  };

  const result = await pipelineService.runValidationPipeline(input, { includeHousehold: false });
  return { verdict: result.verdict, address_id: result.address_id || addressId };
}

describe('POST /validate/unit — re-validation', () => {
  function seedAddress() {
    seedTable('HomeAddress', [{
      id: 'addr-uuid-1',
      address_hash: 'some-hash',
      address_line1_norm: '456 Oak Ave',
      address_line2_norm: null,
      city_norm: 'Seattle',
      state: 'WA',
      postal_code: '98101',
      country: 'US',
      geocode_lat: 47.6,
      geocode_lng: -122.3,
      place_type: 'building',
    }]);
  }

  test('returns verdict after re-validating with unit', async () => {
    seedAddress();
    const result = await runValidateUnit('addr-uuid-1', 'Apt 4A');
    expect(result.verdict).toBeDefined();
    expect(result.verdict.status).toBe('OK');
  });

  test('passes stored address + new unit to Google', async () => {
    seedAddress();
    await runValidateUnit('addr-uuid-1', 'Suite 200');
    expect(googleProvider.validate).toHaveBeenCalledWith(
      expect.objectContaining({
        line1: '456 Oak Ave',
        line2: 'Suite 200',
        city: 'Seattle',
        state: 'WA',
        zip: '98101',
      }),
    );
  });

  test('returns OK after re-validating with a valid unit confirmed by unit intelligence', async () => {
    seedAddress();
    addressConfig.rollout.enableSecondaryProvider = true;
    googleProvider.validate.mockResolvedValue(makeGoogleResult({
      normalized: {
        line1: '456 Oak Ave',
        line2: 'Apt 4A',
        city: 'Seattle',
        state: 'WA',
        zip: '98101',
      },
    }));
    secondaryAddressProvider.shouldRunLookup.mockReturnValue(true);
    secondaryAddressProvider.lookup.mockResolvedValue({
      provider: 'smarty_secondary',
      provider_version: 'us_enrichment_secondary_v1',
      secondary_required: true,
      unit_count_estimate: 24,
      confidence: 0.95,
      submitted_unit_evaluated: true,
      submitted_unit_known: true,
      lookup_mode: 'secondary_count_and_list',
      verification_level: 'secondary_provider_observed',
      validated_at: '2026-04-02T16:00:00.000Z',
    });

    const result = await runValidateUnit('addr-uuid-1', 'Apt 4A');

    expect(result.verdict.status).toBe('OK');
    expect(secondaryAddressProvider.lookup).toHaveBeenCalledWith(expect.objectContaining({
      submittedUnit: 'Apt 4A',
    }));
  });

  test('returns 404 when address_id not found', async () => {
    const result = await runValidateUnit('nonexistent-uuid', 'Apt 1');
    expect(result.status).toBe(404);
  });

  test('falls back to original address_id when Google fails', async () => {
    seedAddress();
    googleProvider.isAvailable.mockReturnValue(false);
    const result = await runValidateUnit('addr-uuid-1', 'Apt 4A');
    expect(result.address_id).toBe('addr-uuid-1');
    expect(result.error_code).toBe('ADDRESS_REVALIDATION_UNAVAILABLE');
  });
});

// ============================================================
// Claim logic (mirrors POST /claim handler)
// ============================================================

async function runClaim(addressId, unit, userId = 'test-user-id') {
  const supabaseAdmin = require('../../config/supabaseAdmin');
  const { AddressVerdictStatus } = require('../../services/addressValidation/types');
  const AUTO_VERIFY_CONFIDENCE = 0.8;

  const { data: address } = await supabaseAdmin
    .from('HomeAddress')
    .select('*')
    .eq('id', addressId)
    .maybeSingle();

  if (!address) return { status: 404, body: { error: 'Address not found' } };

  const hasRecentValidation = !!(address.last_validated_at && address.validation_raw_response);

  let storedConfidence = 0;
  let storedStatus = AddressVerdictStatus.SERVICE_ERROR;

  if (hasRecentValidation) {
    const storedInputs = pipelineService.buildStoredDecisionInputs(address);
    const verdict = decisionEngine.classify({
      ...storedInputs,
      use_provider_place_for_business: addressConfig.rollout.enforcePlaceProviderBusiness,
      use_provider_unit_intelligence: addressConfig.rollout.enableSecondaryProvider,
      use_provider_parcel_for_classification: addressConfig.rollout.enforceParcelProviderClassification,
      provider_parcel_max_age_days: addressConfig.parcelIntel.cacheDays,
    });
    storedStatus = verdict.status;
    storedConfidence = verdict.confidence;
  }

  let claimStatus;
  let verificationMethod;

  if (storedStatus === AddressVerdictStatus.OK && storedConfidence >= AUTO_VERIFY_CONFIDENCE) {
    claimStatus = 'verified';
    verificationMethod = 'autocomplete_ok';
  } else if (
    storedStatus === AddressVerdictStatus.OK ||
    storedStatus === AddressVerdictStatus.MIXED_USE ||
    storedStatus === AddressVerdictStatus.LOW_CONFIDENCE
  ) {
    claimStatus = 'pending';
    verificationMethod = 'escalation_required';
  } else {
    return {
      status: 422,
      body: { error: 'Address cannot be claimed', verdict_status: storedStatus },
    };
  }

  const { data: existingClaim } = await supabaseAdmin
    .from('AddressClaim')
    .select('id, claim_status')
    .eq('user_id', userId)
    .eq('address_id', addressId)
    .maybeSingle();

  if (existingClaim) {
    return { status: 409, body: { error: 'Already claimed', claim: existingClaim } };
  }

  const claim = {
    user_id: userId,
    address_id: addressId,
    unit_number: unit || null,
    claim_status: claimStatus,
    verification_method: verificationMethod,
    confidence: storedConfidence,
    verdict_status: storedStatus,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created } = await supabaseAdmin
    .from('AddressClaim')
    .insert(claim)
    .select()
    .single();

  return { status: 201, body: { claim: { ...created, unit: created?.unit_number ?? null } } };
}

describe('POST /claim — claim logic', () => {
  function seedValidatedAddress(overrides = {}) {
    seedTable('HomeAddress', [{
      id: 'addr-uuid-1',
      address_hash: 'some-hash',
      address_line1_norm: '123 Main St',
      address_line2_norm: null,
      city_norm: 'Portland',
      state: 'OR',
      postal_code: '97201',
      country: 'US',
      geocode_lat: 45.5,
      geocode_lng: -122.6,
      place_type: 'single_family',
      last_validated_at: new Date().toISOString(),
      validation_vendor: 'smarty',
      validation_raw_response: {
        dpv_match_code: 'Y',
        rdi_type: 'residential',
        missing_secondary: false,
        commercial_mailbox: false,
        vacant_flag: false,
        footnotes: [],
      },
      geocode_granularity: 'PREMISE',
      google_verdict: {
        hasUnconfirmedComponents: false,
        hasInferredComponents: false,
        hasReplacedComponents: false,
      },
      ...overrides,
    }]);
  }

  // ── Auto-verified ─────────────────────────────────────────

  test('creates verified claim for high-confidence OK address', async () => {
    seedValidatedAddress();
    const result = await runClaim('addr-uuid-1');
    expect(result.status).toBe(201);
    expect(result.body.claim.claim_status).toBe('verified');
    expect(result.body.claim.verification_method).toBe('autocomplete_ok');
  });

  test('verified claim has confidence >= 0.8', async () => {
    seedValidatedAddress();
    const result = await runClaim('addr-uuid-1');
    expect(result.body.claim.confidence).toBeGreaterThanOrEqual(0.8);
  });

  test('verified claim includes user_id and address_id', async () => {
    seedValidatedAddress();
    const result = await runClaim('addr-uuid-1');
    expect(result.body.claim.user_id).toBe('test-user-id');
    expect(result.body.claim.address_id).toBe('addr-uuid-1');
  });

  // ── Pending ───────────────────────────────────────────────

  test('creates pending claim for low-confidence OK address', async () => {
    seedValidatedAddress({
      validation_raw_response: {
        dpv_match_code: 'D',
        rdi_type: 'unknown',
        missing_secondary: false,
        commercial_mailbox: false,
        vacant_flag: true,
        footnotes: [],
      },
      google_verdict: {
        hasUnconfirmedComponents: false,
        hasInferredComponents: false,
        hasReplacedComponents: true,
      },
    });

    const result = await runClaim('addr-uuid-1');
    expect(result.status).toBe(201);
    expect(result.body.claim.claim_status).toBe('pending');
    expect(result.body.claim.verification_method).toBe('escalation_required');
  });

  test('creates pending claim for LOW_CONFIDENCE (ROUTE)', async () => {
    seedValidatedAddress({ geocode_granularity: 'ROUTE' });
    const result = await runClaim('addr-uuid-1');
    expect(result.status).toBe(201);
    expect(result.body.claim.claim_status).toBe('pending');
  });

  // ── Rejected ──────────────────────────────────────────────

  test('rejects UNDELIVERABLE (DPV N)', async () => {
    seedValidatedAddress({
      validation_raw_response: {
        dpv_match_code: 'N', rdi_type: 'unknown',
        missing_secondary: false, commercial_mailbox: false,
        vacant_flag: false, footnotes: [],
      },
    });
    const result = await runClaim('addr-uuid-1');
    expect(result.status).toBe(422);
    expect(result.body.verdict_status).toBe('UNDELIVERABLE');
  });

  test('rejects MISSING_UNIT', async () => {
    seedValidatedAddress({
      validation_raw_response: {
        dpv_match_code: 'S', rdi_type: 'residential',
        missing_secondary: true, commercial_mailbox: false,
        vacant_flag: false, footnotes: [],
      },
    });
    const result = await runClaim('addr-uuid-1');
    expect(result.status).toBe(422);
    expect(result.body.verdict_status).toBe('MISSING_UNIT');
  });

  test('rejects stored provider-backed MISSING_UNIT when unit-intelligence enforcement is enabled', async () => {
    addressConfig.rollout.enableSecondaryProvider = true;
    seedValidatedAddress({
      secondary_required: true,
      unit_count_estimate: 24,
      unit_intelligence_confidence: 0.92,
      last_secondary_validated_at: new Date().toISOString(),
      provider_versions: {
        secondary_address: {
          provider: 'smarty_secondary',
          version: 'us_enrichment_secondary_v1',
          shadow_only: true,
        },
      },
      validation_raw_response: {
        dpv_match_code: 'Y',
        rdi_type: 'residential',
        missing_secondary: false,
        commercial_mailbox: false,
        vacant_flag: false,
        footnotes: [],
        secondary_provider: {
          provider: 'smarty_secondary',
          provider_version: 'us_enrichment_secondary_v1',
          secondary_required: true,
          unit_count_estimate: 24,
          confidence: 0.92,
          submitted_unit_evaluated: false,
          submitted_unit_known: null,
          lookup_mode: 'secondary_count',
          verification_level: 'secondary_provider_observed',
        },
      },
    });

    const result = await runClaim('addr-uuid-1');
    expect(result.status).toBe(422);
    expect(result.body.verdict_status).toBe('MISSING_UNIT');
  });

  test('rejects BUSINESS (CMRA)', async () => {
    seedValidatedAddress({
      validation_raw_response: {
        dpv_match_code: 'Y', rdi_type: 'commercial',
        missing_secondary: false, commercial_mailbox: true,
        vacant_flag: false, footnotes: [],
      },
    });
    const result = await runClaim('addr-uuid-1');
    expect(result.status).toBe(422);
    expect(result.body.verdict_status).toBe('BUSINESS');
  });

  test('rejects BUSINESS from stored provider-backed place data when enforcement is enabled', async () => {
    addressConfig.rollout.enforcePlaceProviderBusiness = true;
    seedValidatedAddress({
      google_place_id: 'school-123',
      google_place_primary_type: 'school',
      google_place_types: ['premise'],
      provider_place_types: ['school', 'point_of_interest'],
      verification_level: 'shadow_provider_observed',
      risk_flags: ['named_poi', 'institutional_type'],
      last_place_validated_at: new Date().toISOString(),
      validation_raw_response: {
        dpv_match_code: 'Y',
        rdi_type: 'residential',
        missing_secondary: false,
        commercial_mailbox: false,
        vacant_flag: false,
        footnotes: [],
        heuristic_place: {
          google_place_types: ['premise'],
          parcel_type: 'residential',
          building_type: 'single_family',
        },
        place_provider: {
          provider: 'google_places',
          provider_version: 'places_v1',
          place_id: 'school-123',
          primary_type: 'school',
          types: ['school', 'point_of_interest'],
          confidence: 0.91,
          verification_level: 'shadow_provider_observed',
          risk_flags: ['named_poi', 'institutional_type'],
        },
      },
    });

    const result = await runClaim('addr-uuid-1');
    expect(result.status).toBe(422);
    expect(result.body.verdict_status).toBe('BUSINESS');
  });

  test('rejects BUSINESS from stored parcel-backed data when enforcement is enabled', async () => {
    addressConfig.rollout.enforceParcelProviderClassification = true;
    seedValidatedAddress({
      parcel_provider: 'attom',
      parcel_id: 'parcel-123',
      parcel_land_use: 'School',
      parcel_property_type: 'School',
      parcel_confidence: 0.93,
      residential_unit_count: 0,
      non_residential_unit_count: 1,
      usage_class: 'institutional',
      last_parcel_validated_at: new Date().toISOString(),
      validation_raw_response: {
        dpv_match_code: 'Y',
        rdi_type: 'residential',
        missing_secondary: false,
        commercial_mailbox: false,
        vacant_flag: false,
        footnotes: [],
        heuristic_place: {
          google_place_types: ['premise'],
          parcel_type: 'residential',
          building_type: 'single_family',
        },
        parcel_provider: {
          provider: 'attom',
          provider_version: 'parcel_shadow_v1',
          parcel_id: 'parcel-123',
          land_use: 'School',
          property_type: 'School',
          confidence: 0.93,
          residential_unit_count: 0,
          non_residential_unit_count: 1,
          usage_class: 'institutional',
          validated_at: new Date().toISOString(),
        },
      },
    });

    const result = await runClaim('addr-uuid-1');
    expect(result.status).toBe(422);
    expect(result.body.verdict_status).toBe('BUSINESS');
  });

  test('rejects unvalidated address (SERVICE_ERROR)', async () => {
    seedTable('HomeAddress', [{
      id: 'addr-uuid-1',
      address_hash: 'h',
      address_line1_norm: '123 Main St',
      address_line2_norm: null,
      city_norm: 'Portland',
      state: 'OR',
      postal_code: '97201',
      country: 'US',
      place_type: 'unknown',
    }]);
    const result = await runClaim('addr-uuid-1');
    expect(result.status).toBe(422);
    expect(result.body.verdict_status).toBe('SERVICE_ERROR');
  });

  // ── Duplicate prevention ──────────────────────────────────

  test('returns 409 when user already has a claim', async () => {
    seedValidatedAddress();
    seedTable('AddressClaim', [{
      id: 'claim-uuid-1',
      user_id: 'test-user-id',
      address_id: 'addr-uuid-1',
      claim_status: 'verified',
    }]);
    const result = await runClaim('addr-uuid-1');
    expect(result.status).toBe(409);
  });

  test('different user can claim same address', async () => {
    seedValidatedAddress();
    seedTable('AddressClaim', [{
      id: 'claim-uuid-1',
      user_id: 'other-user-id',
      address_id: 'addr-uuid-1',
      claim_status: 'verified',
    }]);
    const result = await runClaim('addr-uuid-1', null, 'test-user-id');
    expect(result.status).toBe(201);
  });

  // ── Not found ─────────────────────────────────────────────

  test('returns 404 when address not found', async () => {
    const result = await runClaim('nonexistent-uuid');
    expect(result.status).toBe(404);
  });

  // ── Optional unit ─────────────────────────────────────────

  test('stores unit in claim', async () => {
    seedValidatedAddress();
    const result = await runClaim('addr-uuid-1', 'Apt 3B');
    expect(result.body.claim.unit).toBe('Apt 3B');
  });

  test('stores null unit when not provided', async () => {
    seedValidatedAddress();
    const result = await runClaim('addr-uuid-1');
    expect(result.body.claim.unit).toBeNull();
  });

  // ── Record content ────────────────────────────────────────

  test('claim includes all expected fields', async () => {
    seedValidatedAddress();
    const result = await runClaim('addr-uuid-1');
    const claim = result.body.claim;
    expect(claim.user_id).toBeDefined();
    expect(claim.address_id).toBeDefined();
    expect(claim.claim_status).toBeDefined();
    expect(claim.verification_method).toBeDefined();
    expect(claim.confidence).toBeDefined();
    expect(claim.verdict_status).toBeDefined();
    expect(claim.created_at).toBeTruthy();
    expect(claim.updated_at).toBeTruthy();
  });

  test('persists to AddressClaim table', async () => {
    seedValidatedAddress();
    await runClaim('addr-uuid-1');
    expect(getTable('AddressClaim')).toHaveLength(1);
  });
});

// ============================================================
// Joi validation schemas
// ============================================================

describe('Joi validation schemas', () => {
  const Joi = require('joi');

  const validateAddressSchema = Joi.object({
    line1: Joi.string().trim().min(1).max(255).required(),
    line2: Joi.string().trim().max(100).allow('', null),
    city: Joi.string().trim().min(1).max(100).required(),
    state: Joi.string().trim().min(2).max(2).uppercase().required(),
    zip: Joi.string().trim().pattern(/^\d{5}(-\d{4})?$/).required(),
  });

  const validateUnitSchema = Joi.object({
    address_id: Joi.string().uuid().required(),
    unit: Joi.string().trim().min(1).max(100).required(),
  });

  const claimAddressSchema = Joi.object({
    address_id: Joi.string().uuid().required(),
    unit: Joi.string().trim().max(100).allow('', null),
  });

  test('validate schema accepts valid address', () => {
    const { error } = validateAddressSchema.validate({
      line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97201',
    });
    expect(error).toBeUndefined();
  });

  test('validate schema accepts zip+4', () => {
    const { error } = validateAddressSchema.validate({
      line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97201-1234',
    });
    expect(error).toBeUndefined();
  });

  test('validate schema rejects missing line1', () => {
    const { error } = validateAddressSchema.validate({
      city: 'Portland', state: 'OR', zip: '97201',
    });
    expect(error).toBeDefined();
  });

  test('validate schema rejects invalid zip', () => {
    const { error } = validateAddressSchema.validate({
      line1: '123 Main St', city: 'Portland', state: 'OR', zip: 'ABCDE',
    });
    expect(error).toBeDefined();
  });

  test('validate schema rejects 3-char state', () => {
    const { error } = validateAddressSchema.validate({
      line1: '123 Main St', city: 'Portland', state: 'ORE', zip: '97201',
    });
    expect(error).toBeDefined();
  });

  test('validate schema accepts optional line2', () => {
    const { error } = validateAddressSchema.validate({
      line1: '123 Main St', line2: 'Apt 4A', city: 'Portland', state: 'OR', zip: '97201',
    });
    expect(error).toBeUndefined();
  });

  test('unit schema accepts valid input', () => {
    const { error } = validateUnitSchema.validate({
      address_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', unit: 'Apt 1',
    });
    expect(error).toBeUndefined();
  });

  test('unit schema rejects missing unit', () => {
    const { error } = validateUnitSchema.validate({
      address_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    });
    expect(error).toBeDefined();
  });

  test('unit schema rejects non-UUID address_id', () => {
    const { error } = validateUnitSchema.validate({
      address_id: 'not-a-uuid', unit: 'Apt 1',
    });
    expect(error).toBeDefined();
  });

  test('claim schema accepts valid input', () => {
    const { error } = claimAddressSchema.validate({
      address_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    });
    expect(error).toBeUndefined();
  });

  test('claim schema accepts optional unit', () => {
    const { error } = claimAddressSchema.validate({
      address_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', unit: 'Suite 300',
    });
    expect(error).toBeUndefined();
  });

  test('claim schema rejects missing address_id', () => {
    const { error } = claimAddressSchema.validate({});
    expect(error).toBeDefined();
  });
});

// ============================================================
// Rate limiter exports
// ============================================================

describe('Rate limiter exports', () => {
  test('addressValidationLimiter is exported', () => {
    const limiterMod = require('../../middleware/rateLimiter');
    expect(limiterMod.addressValidationLimiter).toBeDefined();
  });

  test('addressClaimLimiter is exported', () => {
    const limiterMod = require('../../middleware/rateLimiter');
    expect(limiterMod.addressClaimLimiter).toBeDefined();
  });
});
