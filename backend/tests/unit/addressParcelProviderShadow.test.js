const { resetTables, getTable } = require('../__mocks__/supabaseAdmin');
const addressConfig = require('../../config/addressVerification');

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

jest.mock('../../services/addressValidation/secondaryAddressProvider', () => ({
  shouldRunLookup: jest.fn(() => false),
  lookup: jest.fn(),
}));

jest.mock('../../services/addressValidation/parcelIntelProvider', () => ({
  shouldRunLookup: jest.fn(() => false),
  lookup: jest.fn(),
}));

const logger = require('../../utils/logger');
const googleProvider = require('../../services/addressValidation/googleProvider');
const smartyProvider = require('../../services/addressValidation/smartyProvider');
const placeClassificationProvider = require('../../services/addressValidation/placeClassificationProvider');
const secondaryAddressProvider = require('../../services/addressValidation/secondaryAddressProvider');
const parcelIntelProvider = require('../../services/addressValidation/parcelIntelProvider');
const pipelineService = require('../../services/addressValidation/pipelineService');

function makeGoogle(overrides = {}) {
  const normalizedOverrides = overrides.normalized || {};
  const componentOverrides = overrides.components || {};
  const verdictOverrides = overrides.verdict || {};
  const geocodeOverrides = overrides.geocode || {};
  const line1 = normalizedOverrides.line1 || '123 Main St';
  const route = line1.replace(/^\d+\s+/, '');
  const restOverrides = { ...overrides };
  delete restOverrides.normalized;
  delete restOverrides.components;
  delete restOverrides.verdict;
  delete restOverrides.geocode;

  return {
    normalized: {
      line1,
      line2: undefined,
      city: 'Portland',
      state: 'OR',
      zip: '97201',
      lat: 45.5152,
      lng: -122.6784,
      ...normalizedOverrides,
    },
    components: {
      route: { text: route },
      ...componentOverrides,
    },
    geocode: { lat: 45.5152, lng: -122.6784, ...geocodeOverrides },
    granularity: 'PREMISE',
    missing_component_types: [],
    verdict: {
      hasUnconfirmedComponents: false,
      hasInferredComponents: false,
      hasReplacedComponents: false,
      ...verdictOverrides,
    },
    ...restOverrides,
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

function makeParcelIntel(overrides = {}) {
  return {
    provider: 'attom',
    provider_version: 'parcel_shadow_v1',
    parcel_id: 'R123456',
    land_use: 'Commercial',
    property_type: 'Office Building',
    building_count: 2,
    residential_unit_count: 0,
    non_residential_unit_count: 1,
    usage_class: 'commercial',
    confidence: 0.8,
    lookup_mode: 'property_detail',
    from_cache: false,
    validated_at: '2026-04-02T18:00:00.000Z',
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
  secondaryAddressProvider.shouldRunLookup.mockReturnValue(false);
  secondaryAddressProvider.lookup.mockResolvedValue(null);
  parcelIntelProvider.shouldRunLookup.mockReturnValue(false);
  parcelIntelProvider.lookup.mockResolvedValue(null);
  addressConfig.rollout.enableParcelProvider = false;
});

afterAll(() => {
  addressConfig.rollout.enableParcelProvider = false;
});

describe('runValidationPipeline parcel shadow provider', () => {
  test('flag OFF leaves runtime behavior unchanged', async () => {
    const result = await pipelineService.runValidationPipeline(
      { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.verdict.status).toBe('OK');
    expect(parcelIntelProvider.lookup).not.toHaveBeenCalled();
    expect(result.parcel_intel).toBeNull();
  });

  test('passes ambiguous signals into selective invocation and only calls lookup when enabled', async () => {
    addressConfig.rollout.enableParcelProvider = true;
    googleProvider.validate.mockResolvedValue(makeGoogle({
      normalized: { line1: '123 Market Plaza' },
    }));
    smartyProvider.verify.mockResolvedValue(makeSmarty({ rdi_type: 'unknown' }));
    parcelIntelProvider.shouldRunLookup.mockReturnValue(true);
    parcelIntelProvider.lookup.mockResolvedValue(makeParcelIntel());

    const result = await pipelineService.runValidationPipeline(
      { line1: '123 Market Plaza', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(parcelIntelProvider.shouldRunLookup).toHaveBeenCalledWith(expect.objectContaining({
      smarty: expect.objectContaining({ rdi_type: 'unknown' }),
      place: expect.objectContaining({ parcel_type: 'commercial' }),
    }));
    expect(parcelIntelProvider.lookup).toHaveBeenCalledTimes(1);
    expect(result.verdict.status).toBe('BUSINESS');
  });

  test('persists parcel intel and logs structured comparison without changing verdict behavior', async () => {
    addressConfig.rollout.enableParcelProvider = true;
    parcelIntelProvider.shouldRunLookup.mockReturnValue(true);
    parcelIntelProvider.lookup.mockResolvedValue(makeParcelIntel({
      usage_class: 'residential',
      land_use: 'Single Family Residence',
      property_type: 'Single Family Residence',
      building_count: 1,
      residential_unit_count: 1,
      non_residential_unit_count: 0,
    }));

    const result = await pipelineService.runValidationPipeline(
      { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.verdict.status).toBe('OK');
    expect(result.canonical_address.parcel_provider).toBe('attom');
    expect(result.canonical_address.parcel_id).toBe('R123456');
    expect(result.canonical_address.usage_class).toBe('residential');
    expect(result.parcel_intel).toEqual(expect.objectContaining({
      parcel_id: 'R123456',
      usage_class: 'residential',
    }));
    expect(logger.info).toHaveBeenCalledWith(
      'addressValidation.parcelProviderShadowComparison',
      expect.objectContaining({
        address_id: result.address_id,
        provider_status: 'ok',
        selectively_invoked: true,
      }),
    );
    expect(getTable('AddressVerificationEvent')).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event_type: 'provider_call',
        provider: 'attom',
        address_id: result.address_id,
      }),
      expect.objectContaining({
        event_type: 'shadow_comparison',
        provider: 'attom',
        address_id: result.address_id,
      }),
      expect.objectContaining({
        event_type: 'validation_outcome',
        address_id: result.address_id,
      }),
    ]));

    const storedInputs = pipelineService.buildStoredDecisionInputs(result.canonical_address);
    expect(storedInputs.parcel_intel).toEqual(expect.objectContaining({
      parcel_id: 'R123456',
      usage_class: 'residential',
    }));
  });

  test('fails open when parcel enrichment throws or times out', async () => {
    addressConfig.rollout.enableParcelProvider = true;
    parcelIntelProvider.shouldRunLookup.mockReturnValue(true);
    parcelIntelProvider.lookup.mockRejectedValue(new Error('parcel timeout'));

    const result = await pipelineService.runValidationPipeline(
      { line1: '123 Market Plaza', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.verdict.status).toBe('OK');
    expect(result.parcel_intel).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'pipelineService.runValidationPipeline: parcel enrichment failed',
      expect.objectContaining({
        error: 'parcel timeout',
      }),
    );
  });
});
