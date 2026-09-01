const { resetTables } = require('../__mocks__/supabaseAdmin');
const addressConfig = require('../../config/addressVerification');
const {
  institutionalPlace,
  venuePlace,
  churchPlace,
  hospitalPlace,
  governmentPlace,
  officePlace,
  storefrontPlace,
  warehousePlace,
  residentialPlace,
} = require('../fixtures/googlePlacesClassificationFixtures');

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../services/addressValidation/googleProvider', () => ({
  isAvailable: jest.fn(() => true),
  validate: jest.fn(),
}));

jest.mock('../../services/addressValidation/smartyProvider', () => ({
  isAvailable: jest.fn(() => true),
  verify: jest.fn(),
}));

jest.mock('../../services/addressValidation/placeClassificationProvider', () => ({
  shouldRunShadowLookup: jest.fn(() => false),
  classify: jest.fn(),
}));

const logger = require('../../utils/logger');
const googleProvider = require('../../services/addressValidation/googleProvider');
const smartyProvider = require('../../services/addressValidation/smartyProvider');
const placeClassificationProvider = require('../../services/addressValidation/placeClassificationProvider');
const pipelineService = require('../../services/addressValidation/pipelineService');

function makeGoogle(overrides = {}) {
  const line1 = overrides.normalized?.line1 || '123 Main St';
  const route = line1.replace(/^\d+\s+/, '');

  return {
    normalized: {
      line1,
      line2: undefined,
      city: 'Portland',
      state: 'OR',
      zip: '97201',
      lat: 45.5152,
      lng: -122.6784,
      ...overrides.normalized,
    },
    components: {
      route: { text: route },
      ...(overrides.components || {}),
    },
    geocode: { lat: 45.5152, lng: -122.6784 },
    granularity: 'PREMISE',
    missing_component_types: [],
    place_id: 'places/provider-1',
    verdict: {
      hasUnconfirmedComponents: false,
      hasInferredComponents: false,
      hasReplacedComponents: false,
    },
    ...overrides,
  };
}

function makeSmarty(overrides = {}) {
  return {
    from_cache: false,
    inconclusive: false,
    dpv_match_code: 'Y',
    rdi_type: 'residential',
    missing_secondary: false,
    commercial_mailbox: false,
    vacant_flag: false,
    footnotes: ['AA'],
    raw: {
      analysis: { dpv_match_code: 'Y', rdi: 'Residential' },
    },
    ...overrides,
  };
}

function makeProviderPlace(payload, overrides = {}) {
  return {
    provider: 'google_places',
    provider_version: 'places_v1',
    place_id: payload.id,
    primary_type: payload.primaryType,
    types: payload.types,
    business_status: payload.businessStatus,
    display_name: payload.displayName.text,
    confidence: 0.91,
    is_named_poi: true,
    lookup_mode: 'place_details',
    verification_level: 'shadow_provider_observed',
    risk_flags: ['named_poi'],
    validated_at: '2026-04-02T15:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  googleProvider.isAvailable.mockReturnValue(true);
  googleProvider.validate.mockResolvedValue(makeGoogle());
  smartyProvider.isAvailable.mockReturnValue(true);
  smartyProvider.verify.mockResolvedValue(makeSmarty());
  placeClassificationProvider.shouldRunShadowLookup.mockReturnValue(true);
  placeClassificationProvider.classify.mockResolvedValue(null);
  addressConfig.rollout.enablePlaceProvider = true;
  addressConfig.rollout.enforcePlaceProviderBusiness = false;
});

afterAll(() => {
  addressConfig.rollout.enablePlaceProvider = false;
  addressConfig.rollout.enforcePlaceProviderBusiness = false;
});

describe('runValidationPipeline provider-backed BUSINESS enforcement', () => {
  test('flag OFF preserves current verdict behavior even when provider deny data exists', async () => {
    placeClassificationProvider.classify.mockResolvedValue(makeProviderPlace(institutionalPlace));

    const result = await pipelineService.runValidationPipeline(
      { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.verdict.status).toBe('OK');
    expect(result.verdict.reasons).not.toContain('PLACE_INSTITUTIONAL');
    expect(logger.info).toHaveBeenCalledWith(
      'addressValidation.placeProviderShadowComparison',
      expect.objectContaining({
        address_id: result.address_id,
        provider_status: 'ok',
      }),
    );
  });

  test.each([
    ['school', institutionalPlace],
    ['church', churchPlace],
    ['hospital', hospitalPlace],
    ['government building', governmentPlace],
    ['corporate office', officePlace],
    ['venue', venuePlace],
    ['storefront', storefrontPlace],
    ['warehouse', warehousePlace],
  ])('flag ON blocks obvious %s addresses as BUSINESS', async (_label, payload) => {
    addressConfig.rollout.enforcePlaceProviderBusiness = true;
    placeClassificationProvider.classify.mockResolvedValue(makeProviderPlace(payload));

    const result = await pipelineService.runValidationPipeline(
      { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.verdict.status).toBe('BUSINESS');
    expect(result.verdict.reasons).toEqual(expect.arrayContaining([
      expect.stringMatching(/^PLACE_(COMMERCIAL|INSTITUTIONAL)$/),
    ]));
    expect(result.verdict.reasons).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/^PLACE_PROVIDER_/),
    ]));
    expect(result.canonical_address.google_place_id).toBe(payload.id);
  });

  test('falls back to the current heuristic path when provider data is missing', async () => {
    addressConfig.rollout.enforcePlaceProviderBusiness = true;
    placeClassificationProvider.classify.mockResolvedValue(null);
    smartyProvider.verify.mockResolvedValue(makeSmarty({
      rdi_type: 'commercial',
      commercial_mailbox: false,
    }));

    const result = await pipelineService.runValidationPipeline(
      { line1: '456 Market St', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.verdict.status).toBe('BUSINESS');
    expect(result.verdict.reasons).toContain('RDI_COMMERCIAL');
    expect(result.verdict.reasons).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/^PLACE_PROVIDER_/),
    ]));
  });

  test.each([
    '123 University Ave',
    '45 Church St',
    '7 School Rd',
    '99 Hospital Dr',
  ])('does not false-positive valid residential street names for %s', async (line1) => {
    addressConfig.rollout.enforcePlaceProviderBusiness = true;
    googleProvider.validate.mockResolvedValue(makeGoogle({
      normalized: { line1 },
    }));
    placeClassificationProvider.classify.mockResolvedValue(makeProviderPlace(residentialPlace, {
      display_name: line1,
    }));

    const result = await pipelineService.runValidationPipeline(
      { line1, city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.verdict.status).toBe('OK');
    expect(result.place.google_place_types).toEqual(['premise']);
    expect(result.verdict.reasons).not.toContain('PLACE_COMMERCIAL');
    expect(result.verdict.reasons).not.toContain('PLACE_INSTITUTIONAL');
  });

  test('falls back to heuristics when provider data is present but below confidence threshold', async () => {
    addressConfig.rollout.enforcePlaceProviderBusiness = true;
    placeClassificationProvider.classify.mockResolvedValue(makeProviderPlace(institutionalPlace, {
      confidence: 0.4,
    }));

    const result = await pipelineService.runValidationPipeline(
      { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.verdict.status).toBe('OK');
    expect(result.provider_place.confidence).toBe(0.4);
    expect(result.verdict.reasons).not.toContain('PLACE_INSTITUTIONAL');
  });
});
