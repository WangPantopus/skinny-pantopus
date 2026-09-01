const { resetTables } = require('../__mocks__/supabaseAdmin');
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
const parcelIntelProvider = require('../../services/addressValidation/parcelIntelProvider');
const pipelineService = require('../../services/addressValidation/pipelineService');

const freshValidatedAt = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

function makeGoogle(overrides = {}) {
  const normalizedOverrides = overrides.normalized || {};
  const line1 = normalizedOverrides.line1 || '123 Main St';
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
      ...normalizedOverrides,
    },
    components: {
      route: { text: route },
      ...(overrides.components || {}),
    },
    geocode: { lat: 45.5152, lng: -122.6784 },
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
    parcel_id: 'parcel-123',
    land_use: 'School',
    property_type: 'School',
    building_count: 1,
    residential_unit_count: 0,
    non_residential_unit_count: 1,
    usage_class: 'institutional',
    confidence: 0.93,
    lookup_mode: 'property_detail',
    from_cache: false,
    validated_at: freshValidatedAt(),
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
  parcelIntelProvider.shouldRunLookup.mockReturnValue(true);
  parcelIntelProvider.lookup.mockResolvedValue(null);
  addressConfig.rollout.enableParcelProvider = true;
  addressConfig.rollout.enforceParcelProviderClassification = false;
});

afterAll(() => {
  addressConfig.rollout.enableParcelProvider = false;
  addressConfig.rollout.enforceParcelProviderClassification = false;
});

describe('runValidationPipeline parcel classification enforcement', () => {
  test('flag OFF preserves current verdict behavior even when strong parcel intel exists', async () => {
    parcelIntelProvider.lookup.mockResolvedValue(makeParcelIntel());

    const result = await pipelineService.runValidationPipeline(
      { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.verdict.status).toBe('OK');
    expect(result.parcel_intel).toEqual(expect.objectContaining({
      usage_class: 'institutional',
    }));
  });

  test.each([
    ['institutional', makeParcelIntel({ land_use: 'School', property_type: 'School', usage_class: 'institutional' })],
    ['industrial', makeParcelIntel({ land_use: 'Industrial Warehouse', property_type: 'Warehouse', usage_class: 'industrial' })],
    ['commercial', makeParcelIntel({ land_use: 'Commercial', property_type: 'Office Building', usage_class: 'commercial' })],
  ])('flag ON blocks obvious %s parcel cases as BUSINESS', async (_label, parcelIntel) => {
    addressConfig.rollout.enforceParcelProviderClassification = true;
    parcelIntelProvider.lookup.mockResolvedValue(parcelIntel);

    const result = await pipelineService.runValidationPipeline(
      { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.verdict.status).toBe('BUSINESS');
    expect(result.verdict.reasons).toContain('PARCEL_COMMERCIAL');
    expect(result.canonical_address.parcel_id).toBe('parcel-123');
  });

  test('flag ON returns MIXED_USE for high-confidence mixed-use parcel intel', async () => {
    addressConfig.rollout.enforceParcelProviderClassification = true;
    parcelIntelProvider.lookup.mockResolvedValue(makeParcelIntel({
      land_use: 'Mixed Use Residential/Retail',
      property_type: 'Mixed Use',
      usage_class: 'mixed',
      residential_unit_count: 12,
      non_residential_unit_count: 2,
    }));

    const result = await pipelineService.runValidationPipeline(
      { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.verdict.status).toBe('MIXED_USE');
    expect(result.verdict.reasons).toContain('PARCEL_MIXED');
  });

  test('falls back to current behavior when parcel data is missing', async () => {
    addressConfig.rollout.enforceParcelProviderClassification = true;
    parcelIntelProvider.lookup.mockResolvedValue(null);

    const result = await pipelineService.runValidationPipeline(
      { line1: '123 Main St', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.verdict.status).toBe('OK');
    expect(logger.info).toHaveBeenCalledWith(
      'addressValidation.parcelProviderShadowComparison',
      expect.objectContaining({
        provider_status: 'empty_or_failed',
      }),
    );
  });
});
