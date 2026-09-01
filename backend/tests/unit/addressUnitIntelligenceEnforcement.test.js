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

const googleProvider = require('../../services/addressValidation/googleProvider');
const smartyProvider = require('../../services/addressValidation/smartyProvider');
const placeClassificationProvider = require('../../services/addressValidation/placeClassificationProvider');
const secondaryAddressProvider = require('../../services/addressValidation/secondaryAddressProvider');
const pipelineService = require('../../services/addressValidation/pipelineService');

function makeGoogle(overrides = {}) {
  const line1 = overrides.normalized?.line1 || '123 Main St';
  const line2 = Object.prototype.hasOwnProperty.call(overrides.normalized || {}, 'line2')
    ? overrides.normalized.line2
    : undefined;
  const route = line1.replace(/^\d+\s+/, '');

  return {
    normalized: {
      line1,
      line2,
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

function makeProviderPlace(overrides = {}) {
  return {
    provider: 'google_places',
    provider_version: 'places_v1',
    place_id: 'place-123',
    primary_type: 'apartment_complex',
    types: ['apartment_complex', 'premise'],
    business_status: 'OPERATIONAL',
    display_name: 'Sunset Apartments',
    confidence: 0.91,
    is_named_poi: true,
    lookup_mode: 'place_details',
    verification_level: 'shadow_provider_observed',
    risk_flags: ['named_poi'],
    validated_at: '2026-04-02T15:00:00.000Z',
    ...overrides,
  };
}

function makeUnitIntelligence(overrides = {}) {
  return {
    provider: 'smarty_secondary',
    provider_version: 'us_enrichment_secondary_v1',
    secondary_required: true,
    unit_count_estimate: 24,
    confidence: 0.92,
    submitted_unit_known: null,
    submitted_unit_evaluated: false,
    lookup_mode: 'secondary_count',
    verification_level: 'secondary_provider_observed',
    validated_at: '2026-04-02T16:00:00.000Z',
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
  addressConfig.rollout.enablePlaceProvider = false;
  addressConfig.rollout.enableSecondaryProvider = false;
});

afterAll(() => {
  addressConfig.rollout.enablePlaceProvider = false;
  addressConfig.rollout.enableSecondaryProvider = false;
});

describe('runValidationPipeline provider-backed unit intelligence enforcement', () => {
  test('flag OFF preserves current verdict behavior even when strong provider unit data exists', async () => {
    placeClassificationProvider.shouldRunShadowLookup.mockReturnValue(true);
    placeClassificationProvider.classify.mockResolvedValue(makeProviderPlace());
    secondaryAddressProvider.shouldRunLookup.mockReturnValue(true);
    secondaryAddressProvider.lookup.mockResolvedValue(makeUnitIntelligence());

    const result = await pipelineService.runValidationPipeline(
      { line1: 'Sunset Apartments', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.verdict.status).toBe('OK');
    expect(result.unit_intelligence).toEqual(expect.objectContaining({
      secondary_required: true,
      unit_count_estimate: 24,
    }));
  });

  test('flag ON upgrades apartment buildings without a unit to MISSING_UNIT', async () => {
    addressConfig.rollout.enableSecondaryProvider = true;
    placeClassificationProvider.shouldRunShadowLookup.mockReturnValue(true);
    placeClassificationProvider.classify.mockResolvedValue(makeProviderPlace());
    secondaryAddressProvider.shouldRunLookup.mockReturnValue(true);
    secondaryAddressProvider.lookup.mockResolvedValue(makeUnitIntelligence());

    const result = await pipelineService.runValidationPipeline(
      { line1: 'Sunset Apartments', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(secondaryAddressProvider.shouldRunLookup).toHaveBeenCalledWith(expect.objectContaining({
      providerPlace: expect.objectContaining({ primary_type: 'apartment_complex' }),
    }));
    expect(result.verdict.status).toBe('MISSING_UNIT');
    expect(result.verdict.reasons).toEqual(['MISSING_SECONDARY']);
  });

  test('flag ON upgrades condo buildings without a unit to MISSING_UNIT when evidence is high-confidence', async () => {
    addressConfig.rollout.enableSecondaryProvider = true;
    placeClassificationProvider.shouldRunShadowLookup.mockReturnValue(true);
    placeClassificationProvider.classify.mockResolvedValue(makeProviderPlace({
      primary_type: 'condominium_complex',
      types: ['condominium_complex', 'premise'],
      display_name: 'Harbor Condominiums',
    }));
    secondaryAddressProvider.shouldRunLookup.mockReturnValue(true);
    secondaryAddressProvider.lookup.mockResolvedValue(makeUnitIntelligence({
      unit_count_estimate: 8,
      confidence: 0.9,
    }));

    const result = await pipelineService.runValidationPipeline(
      { line1: 'Harbor Condominiums', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.verdict.status).toBe('MISSING_UNIT');
  });

  test.each([
    ['townhouse', '17 Alder Townhomes', makeUnitIntelligence({ secondary_required: false, unit_count_estimate: 1, confidence: 0.55 })],
    ['rowhouse', '88 Cedar Rowhouse Ln', makeUnitIntelligence({ secondary_required: false, unit_count_estimate: 1, confidence: 0.55 })],
    ['single-family', '15 Birch St', null],
  ])('does not incorrectly mark %s addresses as MISSING_UNIT', async (_label, line1, unitIntelligence) => {
    addressConfig.rollout.enableSecondaryProvider = true;
    googleProvider.validate.mockResolvedValue(makeGoogle({ normalized: { line1 } }));
    secondaryAddressProvider.shouldRunLookup.mockReturnValue(!!unitIntelligence);
    secondaryAddressProvider.lookup.mockResolvedValue(unitIntelligence);

    const result = await pipelineService.runValidationPipeline(
      { line1, city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.verdict.status).toBe('OK');
  });

  test('falls back to current logic when provider data is absent', async () => {
    addressConfig.rollout.enableSecondaryProvider = true;
    placeClassificationProvider.shouldRunShadowLookup.mockReturnValue(true);
    placeClassificationProvider.classify.mockResolvedValue(makeProviderPlace());
    secondaryAddressProvider.shouldRunLookup.mockReturnValue(true);
    secondaryAddressProvider.lookup.mockResolvedValue(null);

    const result = await pipelineService.runValidationPipeline(
      { line1: 'Sunset Apartments', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.verdict.status).toBe('OK');
  });

  test('validate/unit-style revalidation clears MISSING_UNIT after a valid unit is supplied', async () => {
    addressConfig.rollout.enableSecondaryProvider = true;
    googleProvider.validate.mockResolvedValue(makeGoogle({
      normalized: {
        line1: 'Sunset Apartments',
        line2: 'Apt 4A',
      },
    }));
    placeClassificationProvider.shouldRunShadowLookup.mockReturnValue(true);
    placeClassificationProvider.classify.mockResolvedValue(makeProviderPlace());
    secondaryAddressProvider.shouldRunLookup.mockReturnValue(true);
    secondaryAddressProvider.lookup.mockResolvedValue(makeUnitIntelligence({
      submitted_unit_evaluated: true,
      submitted_unit_known: true,
      lookup_mode: 'secondary_count_and_list',
      confidence: 0.95,
    }));

    const result = await pipelineService.runValidationPipeline(
      { line1: 'Sunset Apartments', line2: 'Apt 4A', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.verdict.status).toBe('OK');
    expect(secondaryAddressProvider.lookup).toHaveBeenCalledWith(expect.objectContaining({
      submittedUnit: 'Apt 4A',
    }));
  });

  test('provider-only rejected supplied unit does not masquerade as missing secondary', async () => {
    addressConfig.rollout.enableSecondaryProvider = true;
    googleProvider.validate.mockResolvedValue(makeGoogle({
      normalized: {
        line1: 'Sunset Apartments',
        line2: 'Apt 9Z',
      },
    }));
    placeClassificationProvider.shouldRunShadowLookup.mockReturnValue(true);
    placeClassificationProvider.classify.mockResolvedValue(makeProviderPlace());
    secondaryAddressProvider.shouldRunLookup.mockReturnValue(true);
    secondaryAddressProvider.lookup.mockResolvedValue(makeUnitIntelligence({
      submitted_unit_evaluated: true,
      submitted_unit_known: false,
      lookup_mode: 'secondary_count_and_list',
      confidence: 0.95,
    }));

    const result = await pipelineService.runValidationPipeline(
      { line1: 'Sunset Apartments', line2: 'Apt 9Z', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.verdict.status).toBe('OK');
    expect(result.verdict.reasons).not.toContain('MISSING_SECONDARY');
  });

  test('flag ON only strengthens missing-unit detection for intended high-confidence cases', async () => {
    addressConfig.rollout.enableSecondaryProvider = true;
    placeClassificationProvider.shouldRunShadowLookup.mockReturnValue(true);
    placeClassificationProvider.classify.mockResolvedValue(makeProviderPlace());
    secondaryAddressProvider.shouldRunLookup.mockReturnValue(true);
    secondaryAddressProvider.lookup.mockResolvedValue(makeUnitIntelligence({
      confidence: 0.4,
    }));

    const result = await pipelineService.runValidationPipeline(
      { line1: 'Sunset Apartments', city: 'Portland', state: 'OR', zip: '97201' },
      { includeHousehold: false },
    );

    expect(result.verdict.status).toBe('OK');
  });
});
