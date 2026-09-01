const express = require('express');
const request = require('supertest');
const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');
const addressConfig = require('../../config/addressVerification');

jest.setTimeout(15000);

jest.mock('../../middleware/verifyToken', () => (req, _res, next) => {
  req.user = { id: 'test-user-id', role: 'user' };
  next();
});

jest.mock('../../services/addressValidation', () => ({
  pipelineService: { buildStoredDecisionInputs: jest.fn(), runValidationPipeline: jest.fn() },
  AddressVerdictStatus: {
    OK: 'OK',
    MIXED_USE: 'MIXED_USE',
    SERVICE_ERROR: 'SERVICE_ERROR',
    MISSING_UNIT: 'MISSING_UNIT',
    BUSINESS: 'BUSINESS',
    UNDELIVERABLE: 'UNDELIVERABLE',
    CONFLICT: 'CONFLICT',
    LOW_CONFIDENCE: 'LOW_CONFIDENCE',
    MULTIPLE_MATCHES: 'MULTIPLE_MATCHES',
  },
  addressDecisionEngine: { classify: jest.fn() },
  googleProvider: { isAvailable: jest.fn(() => false) },
  smartyProvider: { isAvailable: jest.fn(() => false) },
}));

jest.mock('../../utils/homePermissions', () => ({
  checkHomePermission: jest.fn(),
  isVerifiedOwner: jest.fn(),
  mapLegacyRole: jest.fn(),
  writeAuditLog: jest.fn(),
  applyOccupancyTemplate: jest.fn(),
}));

jest.mock('../../utils/homeSecurityPolicy', () => ({
  getClaimRiskScore: jest.fn(async () => 0),
}));

jest.mock('../../utils/verifiedCoordinateGuard', () => ({
  shouldBlockCoordinateOverwrite: jest.fn(() => false),
  stripCoordinateFields: jest.fn((payload) => payload),
}));

jest.mock('../../utils/columns', () => ({
  HOME_DETAIL: '*',
  HOME_TASK_LIST: '*',
  HOME_ISSUE_LIST: '*',
  HOME_BILL_LIST: '*',
  HOME_PACKAGE_LIST: '*',
  HOME_EVENT_LIST: '*',
}));

function createApp() {
const app = express();
  app.use(express.json());
  app.use('/api/homes', require('../../routes/home'));
  return app;
}

const {
  pipelineService,
  addressDecisionEngine,
} = require('../../services/addressValidation');

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  addressConfig.outageFallback.enabled = true;
  addressConfig.outageFallback.maxValidationAgeDays = 30;
  addressConfig.outageFallback.minConfidence = 0.8;
  addressConfig.rollout.enforcePlaceProviderBusiness = false;
  addressConfig.rollout.enableSecondaryProvider = false;
  addressConfig.rollout.enforceParcelProviderClassification = false;
  addressConfig.rollout.requireAddressIdForHomeCreate = false;
  addressConfig.rollout.enforceMixedUseStepUp = false;
  addressConfig.rollout.enforceLowConfidenceStepUp = false;
  addressConfig.mailVerification.stepUpMaxAgeDays = 90;
  pipelineService.buildStoredDecisionInputs.mockReturnValue({
    google: {
      normalized: {
        line1: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zip: '97201',
        lat: 45.5,
        lng: -122.6,
      },
      granularity: 'PREMISE',
      missing_component_types: [],
      verdict: {
        hasUnconfirmedComponents: false,
        hasInferredComponents: false,
        hasReplacedComponents: false,
      },
    },
    smarty: {
      inconclusive: false,
      dpv_match_code: 'Y',
      rdi_type: 'residential',
      missing_secondary: false,
      commercial_mailbox: false,
      vacant_flag: false,
      footnotes: [],
    },
    place: {
      google_place_types: ['premise'],
      parcel_type: 'residential',
      building_type: 'single_family',
    },
    provider_place: {
      provider: 'google_places',
      place_id: 'school-123',
      primary_type: 'school',
      types: ['school', 'point_of_interest'],
      confidence: 0.91,
    },
    unit_intelligence: {
      provider: 'smarty_secondary',
      provider_version: 'us_enrichment_secondary_v1',
      secondary_required: true,
      unit_count_estimate: 24,
      confidence: 0.92,
    },
    parcel_intel: {
      provider: 'attom',
      provider_version: 'parcel_shadow_v1',
      parcel_id: 'R123456',
      land_use: 'School',
      property_type: 'School',
      confidence: 0.93,
      usage_class: 'institutional',
      residential_unit_count: 0,
      non_residential_unit_count: 1,
      validated_at: '2026-04-02T18:00:00.000Z',
    },
  });
  addressDecisionEngine.classify.mockReturnValue({
    status: 'OK',
    reasons: [],
    confidence: 0.9,
    next_actions: ['send_mail_code'],
    candidates: [],
  });
});

afterAll(() => {
  addressConfig.outageFallback.enabled = true;
  addressConfig.outageFallback.maxValidationAgeDays = 30;
  addressConfig.outageFallback.minConfidence = 0.8;
  addressConfig.rollout.enforcePlaceProviderBusiness = false;
  addressConfig.rollout.enableSecondaryProvider = false;
  addressConfig.rollout.enforceParcelProviderClassification = false;
  addressConfig.rollout.requireAddressIdForHomeCreate = false;
  addressConfig.rollout.enforceMixedUseStepUp = false;
  addressConfig.rollout.enforceLowConfidenceStepUp = false;
  addressConfig.mailVerification.stepUpMaxAgeDays = 90;
});

describe('POST /api/homes/check-address', () => {
  test('finds an existing claimed home via Home.address_id even when Home.address_hash differs', async () => {
    seedTable('HomeAddress', [{
      id: '11111111-1111-4111-8111-111111111111',
      address_hash: 'canonical-hash',
      place_type: 'single_family',
      building_type: 'single_family',
      missing_secondary_flag: false,
    }]);

    seedTable('Home', [{
      id: 'home-1',
      address_id: '11111111-1111-4111-8111-111111111111',
      address_hash: 'legacy-hash',
      address: '4020 NE Tacoma Ct',
      address2: '',
      city: 'Camas',
      state: 'WA',
      zipcode: '98607',
      name: 'Tacoma Home',
    }]);

    seedTable('HomeOccupancy', [{
      id: 'occ-1',
      home_id: 'home-1',
      user_id: 'user-1',
      role_base: 'owner',
      is_active: true,
    }]);

    const app = createApp();
    const res = await request(app)
      .post('/api/homes/check-address')
      .send({
        address_id: '11111111-1111-4111-8111-111111111111',
        address: '4020 Northeast Tacoma Court',
        city: 'Camas',
        state: 'WA',
        zip_code: '98607',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('HOME_FOUND_CLAIMED');
    expect(res.body.home_id).toBe('home-1');
  });

  test('finds a legacy claimed home via normalized raw address fields', async () => {
    seedTable('HomeAddress', [{
      id: '22222222-2222-4222-8222-222222222222',
      address_hash: 'bc00608c4c0ea997dcce59df50e88fa5445efa30c643ce5fffa66ca3c2a5c908',
      place_type: 'single_family',
      building_type: 'single_family',
      missing_secondary_flag: false,
    }]);

    seedTable('Home', [{
      id: 'home-legacy',
      address_id: null,
      address_hash: null,
      address: '4020 NE Tacoma Ct',
      address2: '',
      city: 'Camas',
      state: 'WA',
      zipcode: '98607',
      name: 'Legacy Home',
    }]);

    seedTable('HomeOccupancy', [{
      id: 'occ-legacy',
      home_id: 'home-legacy',
      user_id: 'user-2',
      role_base: 'owner',
      is_active: true,
    }]);

    const app = createApp();
    const res = await request(app)
      .post('/api/homes/check-address')
      .send({
        address_id: '22222222-2222-4222-8222-222222222222',
        address: '4020 Northeast Tacoma Court',
        city: 'Camas',
        state: 'WA',
        zip_code: '98607',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('HOME_FOUND_CLAIMED');
    expect(res.body.home_id).toBe('home-legacy');
  });
});

describe('POST /api/homes stored-address fallback', () => {
  test('passes provider-backed stored inputs and enforcement flag into classify, and blocks BUSINESS', async () => {
    addressConfig.rollout.enforcePlaceProviderBusiness = true;
    addressDecisionEngine.classify.mockReturnValue({
      status: 'BUSINESS',
      reasons: ['PLACE_INSTITUTIONAL'],
      confidence: 0.85,
      next_actions: ['manual_review'],
      candidates: [],
    });

    seedTable('HomeAddress', [{
      id: '11111111-1111-4111-8111-111111111111',
      address_hash: 'canonical-hash',
      address_line1_norm: '123 Main St',
      address_line2_norm: null,
      city_norm: 'Portland',
      state: 'OR',
      postal_code: '97201',
      country: 'US',
      place_type: 'single_family',
      building_type: 'single_family',
      last_validated_at: new Date().toISOString(),
      validation_raw_response: { dpv_match_code: 'Y' },
    }]);

    const app = createApp();
    const res = await request(app)
      .post('/api/homes')
      .send({
        address: '123 Main St',
        address_id: '11111111-1111-4111-8111-111111111111',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        latitude: 45.5,
        longitude: -122.6,
        role: 'owner',
        is_owner: true,
      });

    expect(pipelineService.buildStoredDecisionInputs).toHaveBeenCalledWith(
      expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111' }),
    );
    expect(addressDecisionEngine.classify).toHaveBeenCalledWith(expect.objectContaining({
      provider_place: expect.objectContaining({
        primary_type: 'school',
      }),
      parcel_intel: expect.objectContaining({
        usage_class: 'institutional',
      }),
      use_provider_place_for_business: true,
      use_provider_unit_intelligence: false,
      use_provider_parcel_for_classification: false,
      provider_parcel_max_age_days: 30,
    }));
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ADDRESS_REVALIDATION_REQUIRED');
    expect(res.body.fallback_reason).toBe('unsafe_cached_validation');
    expect(res.body.verdict_status).toBe('BUSINESS');
  });

  test('passes stored unit-intelligence flag into classify, and blocks MISSING_UNIT', async () => {
    addressConfig.rollout.enableSecondaryProvider = true;
    addressDecisionEngine.classify.mockReturnValue({
      status: 'MISSING_UNIT',
      reasons: ['MISSING_SECONDARY'],
      confidence: 0.3,
      next_actions: ['prompt_unit'],
      candidates: [],
    });

    seedTable('HomeAddress', [{
      id: '22222222-2222-4222-8222-222222222222',
      address_hash: 'canonical-hash-2',
      address_line1_norm: '123 Main St',
      address_line2_norm: null,
      city_norm: 'Portland',
      state: 'OR',
      postal_code: '97201',
      country: 'US',
      place_type: 'single_family',
      building_type: 'single_family',
      last_validated_at: new Date().toISOString(),
      validation_raw_response: { dpv_match_code: 'Y' },
    }]);

    const app = createApp();
    const res = await request(app)
      .post('/api/homes')
      .send({
        address: '123 Main St',
        address_id: '22222222-2222-4222-8222-222222222222',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        latitude: 45.5,
        longitude: -122.6,
        role: 'owner',
        is_owner: true,
      });

    expect(addressDecisionEngine.classify).toHaveBeenCalledWith(expect.objectContaining({
      unit_intelligence: expect.objectContaining({
        secondary_required: true,
      }),
      use_provider_unit_intelligence: true,
    }));
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ADDRESS_REVALIDATION_REQUIRED');
    expect(res.body.fallback_reason).toBe('unsafe_cached_validation');
    expect(res.body.verdict_status).toBe('MISSING_UNIT');
  });

  test('passes stored parcel-intelligence flag into classify, and blocks BUSINESS', async () => {
    addressConfig.rollout.enforceParcelProviderClassification = true;
    addressDecisionEngine.classify.mockReturnValue({
      status: 'BUSINESS',
      reasons: ['PARCEL_COMMERCIAL'],
      confidence: 0.85,
      next_actions: ['manual_review'],
      candidates: [],
    });

    seedTable('HomeAddress', [{
      id: '33333333-3333-4333-8333-333333333333',
      address_hash: 'canonical-hash-3',
      address_line1_norm: '123 Main St',
      address_line2_norm: null,
      city_norm: 'Portland',
      state: 'OR',
      postal_code: '97201',
      country: 'US',
      place_type: 'single_family',
      building_type: 'single_family',
      last_validated_at: new Date().toISOString(),
      validation_raw_response: { dpv_match_code: 'Y' },
    }]);

    const app = createApp();
    const res = await request(app)
      .post('/api/homes')
      .send({
        address: '123 Main St',
        address_id: '33333333-3333-4333-8333-333333333333',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        latitude: 45.5,
        longitude: -122.6,
        role: 'owner',
        is_owner: true,
      });

    expect(addressDecisionEngine.classify).toHaveBeenCalledWith(expect.objectContaining({
      parcel_intel: expect.objectContaining({
        usage_class: 'institutional',
      }),
      use_provider_parcel_for_classification: true,
      provider_parcel_max_age_days: 30,
    }));
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ADDRESS_REVALIDATION_REQUIRED');
    expect(res.body.fallback_reason).toBe('unsafe_cached_validation');
    expect(res.body.verdict_status).toBe('BUSINESS');
  });

  test('allows create-home when providers are down but cached validation is fresh, matching, and strongly OK', async () => {
    seedTable('HomeAddress', [{
      id: '44444444-4444-4444-8444-444444444444',
      address_hash: 'canonical-hash-4',
      address_line1_norm: '123 Main St',
      address_line2_norm: null,
      city_norm: 'Portland',
      state: 'OR',
      postal_code: '97201',
      country: 'US',
      place_type: 'single_family',
      building_type: 'single_family',
      last_validated_at: new Date().toISOString(),
      validation_raw_response: { dpv_match_code: 'Y' },
    }]);

    const app = createApp();
    const res = await request(app)
      .post('/api/homes')
      .send({
        address: '123 Main St',
        address_id: '44444444-4444-4444-8444-444444444444',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        latitude: 45.5,
        longitude: -122.6,
        role: 'owner',
        is_owner: true,
      });

    expect(addressDecisionEngine.classify).toHaveBeenCalledWith(expect.objectContaining({
      use_provider_place_for_business: false,
      use_provider_unit_intelligence: false,
      use_provider_parcel_for_classification: false,
    }));
    expect(res.status).toBe(201);
    expect(res.body.home.address_id).toBe('44444444-4444-4444-8444-444444444444');
    expect(getTable('AddressVerificationEvent')).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event_type: 'create_home_outcome',
        status: 'created',
        address_id: '44444444-4444-4444-8444-444444444444',
      }),
    ]));
  });

  test('blocks create-home when providers are down and no address_id was supplied', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/homes')
      .set('x-test-user-id', 'test-user-id')
      .send({
        address: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        latitude: 45.5,
        longitude: -122.6,
        role: 'owner',
        is_owner: true,
      });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('ADDRESS_VALIDATION_UNAVAILABLE');
    expect(res.body.fallback_reason).toBe('provider_unavailable');
    expect(getTable('AddressVerificationEvent')).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event_type: 'create_home_outcome',
        status: 'blocked',
        address_id: null,
      }),
    ]));
  });

  test('blocks create-home when providers are down and the request does not match the canonical address', async () => {
    seedTable('HomeAddress', [{
      id: '55555555-5555-4555-8555-555555555555',
      address_hash: 'canonical-hash-5',
      address_line1_norm: '123 Main St',
      address_line2_norm: null,
      city_norm: 'Portland',
      state: 'OR',
      postal_code: '97201',
      country: 'US',
      last_validated_at: new Date().toISOString(),
      validation_raw_response: { dpv_match_code: 'Y' },
    }]);

    const app = createApp();
    const res = await request(app)
      .post('/api/homes')
      .send({
        address: '999 Main St',
        address_id: '55555555-5555-4555-8555-555555555555',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        latitude: 45.5,
        longitude: -122.6,
        role: 'owner',
        is_owner: true,
      });

    expect(addressDecisionEngine.classify).not.toHaveBeenCalled();
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ADDRESS_REVALIDATION_REQUIRED');
    expect(res.body.fallback_reason).toBe('canonical_mismatch');
  });

  test('blocks create-home when providers are down and cached validation is stale', async () => {
    const staleDate = new Date(Date.now() - (45 * 24 * 60 * 60 * 1000)).toISOString();
    seedTable('HomeAddress', [{
      id: '66666666-6666-4666-8666-666666666666',
      address_hash: 'canonical-hash-6',
      address_line1_norm: '123 Main St',
      address_line2_norm: null,
      city_norm: 'Portland',
      state: 'OR',
      postal_code: '97201',
      country: 'US',
      last_validated_at: staleDate,
      validation_raw_response: { dpv_match_code: 'Y' },
    }]);

    const app = createApp();
    const res = await request(app)
      .post('/api/homes')
      .send({
        address: '123 Main St',
        address_id: '66666666-6666-4666-8666-666666666666',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        latitude: 45.5,
        longitude: -122.6,
        role: 'owner',
        is_owner: true,
      });

    expect(addressDecisionEngine.classify).not.toHaveBeenCalled();
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ADDRESS_REVALIDATION_REQUIRED');
    expect(res.body.fallback_reason).toBe('stale_cached_validation');
  });

  test('blocks create-home when providers are down and cached validation data is missing', async () => {
    seedTable('HomeAddress', [{
      id: '67676767-6767-4676-8676-676767676767',
      address_hash: 'canonical-hash-6b',
      address_line1_norm: '123 Main St',
      address_line2_norm: null,
      city_norm: 'Portland',
      state: 'OR',
      postal_code: '97201',
      country: 'US',
      last_validated_at: null,
      validation_raw_response: null,
    }]);

    const app = createApp();
    const res = await request(app)
      .post('/api/homes')
      .send({
        address: '123 Main St',
        address_id: '67676767-6767-4676-8676-676767676767',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        latitude: 45.5,
        longitude: -122.6,
        role: 'owner',
        is_owner: true,
      });

    expect(addressDecisionEngine.classify).not.toHaveBeenCalled();
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ADDRESS_REVALIDATION_REQUIRED');
    expect(res.body.fallback_reason).toBe('missing_cached_validation');
  });

  test('blocks create-home when providers are down and cached validation is ambiguous or unsafe', async () => {
    addressDecisionEngine.classify.mockReturnValue({
      status: 'MIXED_USE',
      reasons: ['PLACE_COMMERCIAL'],
      confidence: 0.6,
      next_actions: ['manual_review'],
      candidates: [],
    });

    seedTable('HomeAddress', [{
      id: '77777777-7777-4777-8777-777777777777',
      address_hash: 'canonical-hash-7',
      address_line1_norm: '123 Main St',
      address_line2_norm: null,
      city_norm: 'Portland',
      state: 'OR',
      postal_code: '97201',
      country: 'US',
      last_validated_at: new Date().toISOString(),
      validation_raw_response: { dpv_match_code: 'Y' },
    }]);

    const app = createApp();
    const res = await request(app)
      .post('/api/homes')
      .send({
        address: '123 Main St',
        address_id: '77777777-7777-4777-8777-777777777777',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        latitude: 45.5,
        longitude: -122.6,
        role: 'owner',
        is_owner: true,
      });

    expect(addressDecisionEngine.classify).toHaveBeenCalled();
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ADDRESS_REVALIDATION_REQUIRED');
    expect(res.body.fallback_reason).toBe('unsafe_cached_validation');
    expect(res.body.verdict_status).toBe('MIXED_USE');
  });

  test('keeps healthy-provider create-home behavior unchanged', async () => {
    const { googleProvider, smartyProvider } = require('../../services/addressValidation');

    googleProvider.isAvailable.mockReturnValue(true);
    smartyProvider.isAvailable.mockReturnValue(true);
    pipelineService.runValidationPipeline.mockResolvedValue({
      verdict: {
        status: 'OK',
        reasons: [],
        confidence: 0.92,
        next_actions: ['send_mail_code'],
        candidates: [],
      },
      address_id: '88888888-8888-4888-8888-888888888888',
      canonical_address: {
        id: '88888888-8888-4888-8888-888888888888',
        address_hash: 'canonical-hash-8',
        address_line1_norm: '123 Main St',
        address_line2_norm: null,
        city_norm: 'Portland',
        state: 'OR',
        postal_code: '97201',
        country: 'US',
        geocode_lat: 45.5,
        geocode_lng: -122.6,
      },
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/homes')
      .send({
        address: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        latitude: 45.5,
        longitude: -122.6,
        role: 'owner',
        is_owner: true,
      });

    expect(pipelineService.runValidationPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        line1: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zip: '97201',
      }),
      expect.objectContaining({
        auditContext: { trigger: 'create_home' },
      }),
    );
    expect(addressDecisionEngine.classify).not.toHaveBeenCalled();
    expect(res.status).toBe(201);
    expect(res.body.home.address_id).toBe('88888888-8888-4888-8888-888888888888');
  });

  test('flag ON blocks MIXED_USE create-home until address step-up is completed', async () => {
    const { googleProvider, smartyProvider } = require('../../services/addressValidation');

    addressConfig.rollout.enforceMixedUseStepUp = true;
    googleProvider.isAvailable.mockReturnValue(true);
    smartyProvider.isAvailable.mockReturnValue(true);
    pipelineService.runValidationPipeline.mockResolvedValue({
      verdict: {
        status: 'MIXED_USE',
        reasons: ['PARCEL_MIXED'],
        confidence: 0.5,
        next_actions: ['manual_review', 'send_mail_code'],
        candidates: [],
      },
      address_id: '99999999-9999-4999-8999-999999999999',
      canonical_address: {
        id: '99999999-9999-4999-8999-999999999999',
        address_hash: 'canonical-hash-9',
        address_line1_norm: '123 Main St',
        address_line2_norm: null,
        city_norm: 'Portland',
        state: 'OR',
        postal_code: '97201',
        country: 'US',
        geocode_lat: 45.5,
        geocode_lng: -122.6,
      },
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/homes')
      .send({
        address: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        latitude: 45.5,
        longitude: -122.6,
        role: 'owner',
        is_owner: true,
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ADDRESS_STEP_UP_REQUIRED');
    expect(res.body.step_up_reason).toBe('mixed_use');
    expect(res.body.step_up_method).toBe('mail_code');
    expect(res.body.address_id).toBe('99999999-9999-4999-8999-999999999999');
    expect(res.body.verdict_status).toBe('MIXED_USE');
  });

  test('flag ON blocks selected LOW_CONFIDENCE create-home until address step-up is completed', async () => {
    const { googleProvider, smartyProvider } = require('../../services/addressValidation');

    addressConfig.rollout.enforceLowConfidenceStepUp = true;
    googleProvider.isAvailable.mockReturnValue(true);
    smartyProvider.isAvailable.mockReturnValue(true);
    pipelineService.runValidationPipeline.mockResolvedValue({
      verdict: {
        status: 'LOW_CONFIDENCE',
        reasons: ['DPV_Y', 'RDI_RESIDENTIAL', 'GEOCODE_GRANULARITY_ROUTE'],
        confidence: 0.2,
        next_actions: ['manual_review'],
        candidates: [],
      },
      address_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      canonical_address: {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        address_hash: 'canonical-hash-10',
        address_line1_norm: '123 Main St',
        address_line2_norm: null,
        city_norm: 'Portland',
        state: 'OR',
        postal_code: '97201',
        country: 'US',
        geocode_lat: 45.5,
        geocode_lng: -122.6,
      },
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/homes')
      .send({
        address: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        latitude: 45.5,
        longitude: -122.6,
        role: 'owner',
        is_owner: true,
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ADDRESS_STEP_UP_REQUIRED');
    expect(res.body.step_up_reason).toBe('low_confidence');
    expect(res.body.verdict_status).toBe('LOW_CONFIDENCE');
    expect(res.body.address_id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });

  test('requireAddressIdForHomeCreate blocks raw create-home requests before validation', async () => {
    addressConfig.rollout.requireAddressIdForHomeCreate = true;

    const app = createApp();
    const res = await request(app)
      .post('/api/homes')
      .send({
        address: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        latitude: 45.5,
        longitude: -122.6,
        role: 'owner',
        is_owner: true,
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ADDRESS_VALIDATION_REQUIRED');
    expect(pipelineService.runValidationPipeline).not.toHaveBeenCalled();
  });

  test('verified mail step-up allows MIXED_USE create-home when the gate is enabled', async () => {
    const { googleProvider, smartyProvider } = require('../../services/addressValidation');

    addressConfig.rollout.enforceMixedUseStepUp = true;
    googleProvider.isAvailable.mockReturnValue(true);
    smartyProvider.isAvailable.mockReturnValue(true);
    pipelineService.runValidationPipeline.mockResolvedValue({
      verdict: {
        status: 'MIXED_USE',
        reasons: ['PARCEL_MIXED'],
        confidence: 0.5,
        next_actions: ['manual_review', 'send_mail_code'],
        candidates: [],
      },
      address_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      canonical_address: {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        address_hash: 'canonical-hash-11',
        address_line1_norm: '123 Main St',
        address_line2_norm: null,
        city_norm: 'Portland',
        state: 'OR',
        postal_code: '97201',
        country: 'US',
        geocode_lat: 45.5,
        geocode_lng: -122.6,
      },
    });
    seedTable('AddressVerificationAttempt', [
      {
        id: 'verified-step-up-1',
        user_id: 'test-user-id',
        address_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        method: 'mail_code',
        status: 'verified',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'verified-step-up-2',
        user_id: 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa',
        address_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        method: 'mail_code',
        status: 'verified',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .post('/api/homes')
      .send({
        address: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        latitude: 45.5,
        longitude: -122.6,
        role: 'owner',
        is_owner: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.home.address_id).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  });

  test('stale mail step-up does not satisfy create-home gating', async () => {
    const { googleProvider, smartyProvider } = require('../../services/addressValidation');

    addressConfig.rollout.enforceMixedUseStepUp = true;
    addressConfig.mailVerification.stepUpMaxAgeDays = 90;
    googleProvider.isAvailable.mockReturnValue(true);
    smartyProvider.isAvailable.mockReturnValue(true);
    pipelineService.runValidationPipeline.mockResolvedValue({
      verdict: {
        status: 'MIXED_USE',
        reasons: ['PARCEL_MIXED'],
        confidence: 0.5,
        next_actions: ['manual_review', 'send_mail_code'],
        candidates: [],
      },
      address_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      canonical_address: {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        address_hash: 'canonical-hash-12',
        address_line1_norm: '123 Main St',
        address_line2_norm: null,
        city_norm: 'Portland',
        state: 'OR',
        postal_code: '97201',
        country: 'US',
        geocode_lat: 45.5,
        geocode_lng: -122.6,
      },
    });
    seedTable('AddressVerificationAttempt', [{
      id: 'verified-step-up-stale',
      user_id: 'test-user-id',
      address_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      method: 'mail_code',
      status: 'verified',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    }]);

    const app = createApp();
    const res = await request(app)
      .post('/api/homes')
      .send({
        address: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        latitude: 45.5,
        longitude: -122.6,
        role: 'owner',
        is_owner: true,
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ADDRESS_STEP_UP_REQUIRED');
    expect(res.body.step_up_reason).toBe('mixed_use');
  });

  test('verified step-up does not bypass SERVICE_ERROR', async () => {
    const { googleProvider, smartyProvider } = require('../../services/addressValidation');

    addressConfig.rollout.enforceMixedUseStepUp = true;
    googleProvider.isAvailable.mockReturnValue(true);
    smartyProvider.isAvailable.mockReturnValue(true);
    pipelineService.runValidationPipeline.mockResolvedValue({
      verdict: {
        status: 'SERVICE_ERROR',
        reasons: ['Address verification providers unavailable'],
        confidence: 0,
        next_actions: ['manual_review'],
        candidates: [],
      },
      address_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      canonical_address: {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        address_hash: 'canonical-hash-13',
        address_line1_norm: '123 Main St',
        address_line2_norm: null,
        city_norm: 'Portland',
        state: 'OR',
        postal_code: '97201',
        country: 'US',
        geocode_lat: 45.5,
        geocode_lng: -122.6,
      },
    });
    seedTable('AddressVerificationAttempt', [{
      id: 'verified-step-up-fresh',
      user_id: 'test-user-id',
      address_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      method: 'mail_code',
      status: 'verified',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }]);

    const app = createApp();
    const res = await request(app)
      .post('/api/homes')
      .send({
        address: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        latitude: 45.5,
        longitude: -122.6,
        role: 'owner',
        is_owner: true,
      });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('ADDRESS_VALIDATION_UNAVAILABLE');
  });

  test('flag OFF keeps LOW_CONFIDENCE create-home behavior unchanged', async () => {
    const { googleProvider, smartyProvider } = require('../../services/addressValidation');

    googleProvider.isAvailable.mockReturnValue(true);
    smartyProvider.isAvailable.mockReturnValue(true);
    pipelineService.runValidationPipeline.mockResolvedValue({
      verdict: {
        status: 'LOW_CONFIDENCE',
        reasons: ['DPV_Y', 'RDI_RESIDENTIAL', 'GEOCODE_GRANULARITY_ROUTE'],
        confidence: 0.2,
        next_actions: ['manual_review'],
        candidates: [],
      },
      address_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      canonical_address: {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        address_hash: 'canonical-hash-14',
        address_line1_norm: '123 Main St',
        address_line2_norm: null,
        city_norm: 'Portland',
        state: 'OR',
        postal_code: '97201',
        country: 'US',
        geocode_lat: 45.5,
        geocode_lng: -122.6,
      },
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/homes')
      .send({
        address: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        latitude: 45.5,
        longitude: -122.6,
        role: 'owner',
        is_owner: true,
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ADDRESS_LOW_CONFIDENCE');
    expect(res.body.verdict_status).toBe('LOW_CONFIDENCE');
  });

  test('flags OFF keep MIXED_USE create-home behavior unchanged', async () => {
    const { googleProvider, smartyProvider } = require('../../services/addressValidation');

    googleProvider.isAvailable.mockReturnValue(true);
    smartyProvider.isAvailable.mockReturnValue(true);
    pipelineService.runValidationPipeline.mockResolvedValue({
      verdict: {
        status: 'MIXED_USE',
        reasons: ['PARCEL_MIXED'],
        confidence: 0.5,
        next_actions: ['manual_review', 'send_mail_code'],
        candidates: [],
      },
      address_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      canonical_address: {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        address_hash: 'canonical-hash-12',
        address_line1_norm: '123 Main St',
        address_line2_norm: null,
        city_norm: 'Portland',
        state: 'OR',
        postal_code: '97201',
        country: 'US',
        geocode_lat: 45.5,
        geocode_lng: -122.6,
      },
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/homes')
      .send({
        address: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        latitude: 45.5,
        longitude: -122.6,
        role: 'owner',
        is_owner: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.home.address_id).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  });

  test('existing-home conflict behavior stays unchanged when step-up flags are enabled', async () => {
    const { googleProvider, smartyProvider } = require('../../services/addressValidation');

    addressConfig.rollout.enforceMixedUseStepUp = true;
    addressConfig.rollout.enforceLowConfidenceStepUp = true;
    googleProvider.isAvailable.mockReturnValue(true);
    smartyProvider.isAvailable.mockReturnValue(true);
    pipelineService.runValidationPipeline.mockResolvedValue({
      verdict: {
        status: 'CONFLICT',
        reasons: ['EXISTING_HOUSEHOLD'],
        confidence: 0.95,
        next_actions: ['join_existing', 'dispute'],
        candidates: [],
        existing_household: { home_id: 'existing-home-1', member_count: 2, active_roles: ['owner'] },
      },
      address_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      canonical_address: {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        address_hash: 'canonical-hash-13',
        address_line1_norm: '123 Main St',
        address_line2_norm: null,
        city_norm: 'Portland',
        state: 'OR',
        postal_code: '97201',
        country: 'US',
        geocode_lat: 45.5,
        geocode_lng: -122.6,
      },
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/homes')
      .send({
        address: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipcode: '97201',
        latitude: 45.5,
        longitude: -122.6,
        role: 'owner',
        is_owner: true,
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ADDRESS_CONFLICT');
    expect(res.body.verdict_status).toBe('CONFLICT');
  });
});
