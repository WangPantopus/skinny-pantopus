const { resetTables, getTable } = require('../__mocks__/supabaseAdmin');
const {
  institutionalPlace,
  venuePlace,
  officePlace,
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
const decisionEngine = require('../../services/addressValidation/addressDecisionEngine');

function makeGoogle(overrides = {}) {
  return {
    normalized: {
      line1: '123 Main St',
      line2: undefined,
      city: 'Portland',
      state: 'OR',
      zip: '97201',
      lat: 45.5152,
      lng: -122.6784,
    },
    components: {
      route: { text: 'Main St' },
    },
    geocode: { lat: 45.5152, lng: -122.6784 },
    granularity: 'PREMISE',
    missing_component_types: [],
    place_id: 'places/shadow-1',
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
    risk_flags: payload.primaryType === 'school' || payload.primaryType === 'stadium'
      ? ['named_poi', 'institutional_type']
      : ['named_poi'],
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
  placeClassificationProvider.shouldRunShadowLookup.mockReturnValue(false);
  placeClassificationProvider.classify.mockResolvedValue(null);
});

describe('buildStoredDecisionInputs', () => {
  test('reads legacy rows without the new place shadow fields', () => {
    const inputs = pipelineService.buildStoredDecisionInputs({
      address_line1_norm: '123 Main St',
      address_line2_norm: null,
      city_norm: 'Portland',
      state: 'OR',
      postal_code: '97201',
      geocode_lat: 45.5152,
      geocode_lng: -122.6784,
      geocode_granularity: 'PREMISE',
      dpv_match_code: 'Y',
      rdi_type: 'residential',
      missing_secondary_flag: false,
      commercial_mailbox_flag: false,
      google_place_types: ['premise'],
      parcel_type: 'residential',
      building_type: 'single_family',
      validation_raw_response: {
        dpv_match_code: 'Y',
        rdi_type: 'residential',
        missing_secondary: false,
        commercial_mailbox: false,
        footnotes: ['AA'],
      },
    });

    expect(inputs.provider_place).toBeNull();
    expect(inputs.place).toEqual({
      google_place_types: ['premise'],
      parcel_type: 'residential',
      building_type: 'single_family',
    });
  });

  test('reads provider-backed HomeAddress fields while keeping heuristic place data for stored decisions', () => {
    const inputs = pipelineService.buildStoredDecisionInputs({
      address_line1_norm: '123 Main St',
      address_line2_norm: null,
      city_norm: 'Portland',
      state: 'OR',
      postal_code: '97201',
      geocode_lat: 45.5152,
      geocode_lng: -122.6784,
      geocode_granularity: 'PREMISE',
      dpv_match_code: 'Y',
      rdi_type: 'residential',
      google_place_types: ['premise'],
      parcel_type: 'residential',
      building_type: 'single_family',
      google_place_id: 'school-123',
      google_place_primary_type: 'school',
      google_business_status: 'OPERATIONAL',
      google_place_name: 'Roosevelt High School',
      provider_place_types: ['school', 'point_of_interest'],
      verification_level: 'shadow_provider_observed',
      risk_flags: ['named_poi', 'institutional_type'],
      last_place_validated_at: '2026-04-02T15:00:00.000Z',
      validation_raw_response: {
        dpv_match_code: 'Y',
        rdi_type: 'residential',
        missing_secondary: false,
        commercial_mailbox: false,
        footnotes: ['AA'],
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
          business_status: 'OPERATIONAL',
          display_name: 'Roosevelt High School',
          confidence: 0.91,
          is_named_poi: true,
          lookup_mode: 'place_details',
          verification_level: 'shadow_provider_observed',
          risk_flags: ['named_poi', 'institutional_type'],
          validated_at: '2026-04-02T15:00:00.000Z',
        },
      },
    });

    expect(inputs.place).toEqual({
      google_place_types: ['premise'],
      parcel_type: 'residential',
      building_type: 'single_family',
    });
    expect(inputs.provider_place).toEqual(expect.objectContaining({
      place_id: 'school-123',
      primary_type: 'school',
      types: ['school', 'point_of_interest'],
      lookup_mode: 'place_details',
      risk_flags: ['named_poi', 'institutional_type'],
    }));
  });

  test('does not reconstruct heuristic place types from provider-only top-level fields on legacy shadow rows', () => {
    const inputs = pipelineService.buildStoredDecisionInputs({
      address_line1_norm: '123 Main St',
      city_norm: 'Portland',
      state: 'OR',
      postal_code: '97201',
      geocode_granularity: 'PREMISE',
      google_place_types: ['school', 'point_of_interest'],
      provider_place_types: ['school', 'point_of_interest'],
      google_place_id: 'school-123',
      validation_raw_response: {
        place_provider: {
          provider: 'google_places',
          provider_version: 'places_v1',
          place_id: 'school-123',
          primary_type: 'school',
          types: ['school', 'point_of_interest'],
        },
      },
    });

    expect(inputs.place.google_place_types).toEqual([]);
    expect(inputs.provider_place).toEqual(expect.objectContaining({
      place_id: 'school-123',
      types: ['school', 'point_of_interest'],
    }));
  });

  test('falls back to raw provider types for shadow rows written before the new provider types column existed', () => {
    const inputs = pipelineService.buildStoredDecisionInputs({
      address_line1_norm: '123 Main St',
      city_norm: 'Portland',
      state: 'OR',
      postal_code: '97201',
      geocode_granularity: 'PREMISE',
      google_place_id: 'school-123',
      validation_raw_response: {
        place_provider: {
          provider: 'google_places',
          provider_version: 'places_v1',
          place_id: 'school-123',
          primary_type: 'school',
          types: ['school', 'point_of_interest'],
        },
      },
    });

    expect(inputs.provider_place).toEqual(expect.objectContaining({
      place_id: 'school-123',
      types: ['school', 'point_of_interest'],
    }));
  });
});

describe('runValidationPipeline shadow place provider', () => {
  test.each([
    ['institutional', institutionalPlace],
    ['venue', venuePlace],
    ['office', officePlace],
    ['residential', residentialPlace],
  ])('persists %s provider data without changing verdict behavior', async (_label, payload) => {
    placeClassificationProvider.shouldRunShadowLookup.mockReturnValue(true);
    placeClassificationProvider.classify.mockResolvedValue(makeProviderPlace(payload));

    const result = await pipelineService.runValidationPipeline(
      { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.verdict.status).toBe('OK');
    expect(result.place).toEqual({
      google_place_types: ['premise'],
      parcel_type: 'residential',
      building_type: 'single_family',
    });
    expect(result.provider_place).toEqual(expect.objectContaining({
      place_id: payload.id,
      primary_type: payload.primaryType,
      types: payload.types,
    }));
    expect(result.canonical_address.google_place_id).toBe(payload.id);
    expect(result.canonical_address.google_place_primary_type).toBe(payload.primaryType);
    expect(result.canonical_address.google_place_types).toEqual(['premise']);
    expect(result.canonical_address.provider_place_types).toEqual(payload.types);

    const storedInputs = pipelineService.buildStoredDecisionInputs(result.canonical_address);
    const storedVerdict = decisionEngine.classify(storedInputs);

    expect(storedVerdict.status).toBe('OK');
    expect(storedVerdict.classification).toEqual({
      google_place_types: ['premise'],
      parcel_type: 'residential',
      building_type: 'single_family',
    });
  });

  test('logs structured comparison output for shadow disagreements', async () => {
    placeClassificationProvider.shouldRunShadowLookup.mockReturnValue(true);
    placeClassificationProvider.classify.mockResolvedValue(makeProviderPlace(institutionalPlace));

    const result = await pipelineService.runValidationPipeline(
      { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.provider_consensus).toEqual(expect.objectContaining({
      disagrees: true,
      disagreement_reasons: expect.arrayContaining(['semantic_category_mismatch']),
    }));
    expect(logger.info).toHaveBeenCalledWith(
      'addressValidation.placeProviderShadowComparison',
      expect.objectContaining({
        address_id: result.address_id,
        provider_status: 'ok',
        disagrees: true,
        heuristic_place_classification: expect.objectContaining({
          google_place_types: ['premise'],
        }),
        provider_place_classification: expect.objectContaining({
          place_id: 'school-123',
          primary_type: 'school',
        }),
      }),
    );
    expect(getTable('AddressVerificationEvent')).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event_type: 'provider_call',
        provider: 'google_places',
        address_id: result.address_id,
      }),
      expect.objectContaining({
        event_type: 'shadow_comparison',
        provider: 'google_places',
        address_id: result.address_id,
      }),
      expect.objectContaining({
        event_type: 'validation_outcome',
        address_id: result.address_id,
      }),
    ]));
  });

  test('fails open when the provider throws or times out', async () => {
    placeClassificationProvider.shouldRunShadowLookup.mockReturnValue(true);
    placeClassificationProvider.classify.mockRejectedValue(new Error('timeout'));

    const result = await pipelineService.runValidationPipeline(
      { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.verdict.status).toBe('OK');
    expect(result.provider_place).toBeNull();
    expect(result.provider_consensus).toEqual(expect.objectContaining({
      disagrees: null,
    }));
    expect(result.canonical_address.google_place_id).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'pipelineService.runValidationPipeline: shadow place classification failed',
      expect.objectContaining({
        error: 'timeout',
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'addressValidation.placeProviderShadowComparison',
      expect.objectContaining({
        address_id: result.address_id,
        provider_status: 'empty_or_failed',
        disagrees: null,
      }),
    );
  });
});
