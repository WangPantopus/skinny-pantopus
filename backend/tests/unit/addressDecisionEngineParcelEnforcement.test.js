const engine = require('../../services/addressValidation/addressDecisionEngine');
const { AddressVerdictStatus } = require('../../services/addressValidation/types');

const freshValidatedAt = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

function makeGoogle(overrides = {}) {
  return {
    normalized: {
      line1: '123 Main St',
      city: 'Portland',
      state: 'OR',
      zip: '97201',
      lat: 45.5,
      lng: -122.6,
    },
    components: {},
    geocode: { lat: 45.5, lng: -122.6 },
    granularity: 'PREMISE',
    missing_component_types: [],
    verdict: {
      inputGranularity: 'PREMISE',
      validationGranularity: 'PREMISE',
      geocodeGranularity: 'PREMISE',
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
    footnotes: [],
    ...overrides,
  };
}

function makePlace(overrides = {}) {
  return {
    google_place_types: ['premise'],
    parcel_type: 'residential',
    building_type: 'single_family',
    ...overrides,
  };
}

function makeProviderPlace(primaryType, types = [primaryType, 'point_of_interest'], overrides = {}) {
  return {
    provider: 'google_places',
    provider_version: 'places_v1',
    place_id: `provider-${primaryType}`,
    primary_type: primaryType,
    types,
    business_status: 'OPERATIONAL',
    display_name: `Provider ${primaryType}`,
    confidence: 0.91,
    is_named_poi: true,
    lookup_mode: 'place_details',
    verification_level: 'shadow_provider_observed',
    risk_flags: ['named_poi'],
    validated_at: freshValidatedAt(),
    ...overrides,
  };
}

function makeParcelIntel(overrides = {}) {
  return {
    provider: 'attom',
    provider_version: 'parcel_shadow_v1',
    parcel_id: 'parcel-123',
    land_use: 'Commercial',
    property_type: 'Office Building',
    building_count: 1,
    residential_unit_count: 0,
    non_residential_unit_count: 1,
    usage_class: 'commercial',
    confidence: 0.93,
    lookup_mode: 'property_detail',
    from_cache: false,
    validated_at: freshValidatedAt(),
    ...overrides,
  };
}

describe('provider-backed parcel classification enforcement', () => {
  test('flag OFF keeps verdict behavior unchanged', () => {
    const baseline = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
      place: makePlace(),
    });

    const withProviderDisabled = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
      place: makePlace(),
      parcel_intel: makeParcelIntel({
        land_use: 'School',
        property_type: 'School',
        usage_class: 'institutional',
      }),
      use_provider_parcel_for_classification: false,
      provider_parcel_max_age_days: 30,
    });

    expect(withProviderDisabled.status).toBe(baseline.status);
    expect(withProviderDisabled.reasons).toEqual(baseline.reasons);
  });

  test.each([
    ['institutional', makeParcelIntel({ land_use: 'School', property_type: 'School', usage_class: 'institutional' })],
    ['industrial', makeParcelIntel({ land_use: 'Industrial Warehouse', property_type: 'Warehouse', usage_class: 'industrial' })],
    ['commercial office', makeParcelIntel({ land_use: 'Commercial', property_type: 'Office Building', usage_class: 'commercial' })],
  ])('flag ON maps obvious %s parcel cases to BUSINESS', (_label, parcelIntel) => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'residential' }),
      place: makePlace(),
      parcel_intel: parcelIntel,
      use_provider_parcel_for_classification: true,
      provider_parcel_max_age_days: 30,
    });

    expect(result.status).toBe(AddressVerdictStatus.BUSINESS);
    expect(result.reasons).toContain('PARCEL_COMMERCIAL');
    expect(result.classification).toEqual(expect.objectContaining({
      google_place_types: ['premise'],
      parcel_type: 'commercial',
      building_type: 'commercial',
    }));
  });

  test('flag ON routes strong residential parcel plus commercial place signals to MIXED_USE instead of BUSINESS', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'residential' }),
      place: makePlace({
        google_place_types: ['premise'],
        parcel_type: 'unknown',
        building_type: 'unknown',
      }),
      provider_place: makeProviderPlace('store'),
      use_provider_place_for_business: true,
      parcel_intel: makeParcelIntel({
        land_use: 'Apartment Building',
        property_type: 'Apartment Building',
        usage_class: 'residential',
        residential_unit_count: 24,
        non_residential_unit_count: 0,
      }),
      use_provider_parcel_for_classification: true,
      provider_parcel_max_age_days: 30,
    });

    expect(result.status).toBe(AddressVerdictStatus.MIXED_USE);
    expect(result.reasons).toContain('PARCEL_RESIDENTIAL');
    expect(result.classification).toEqual(expect.objectContaining({
      google_place_types: ['premise'],
      parcel_type: 'residential',
      building_type: 'multi_unit',
    }));
  });

  test('flag ON returns MIXED_USE for high-confidence mixed-use parcel intel', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'unknown' }),
      place: makePlace({
        google_place_types: ['premise'],
        parcel_type: 'unknown',
        building_type: 'unknown',
      }),
      parcel_intel: makeParcelIntel({
        land_use: 'Mixed Use Residential/Retail',
        property_type: 'Mixed Use',
        usage_class: 'mixed',
        residential_unit_count: 12,
        non_residential_unit_count: 2,
      }),
      use_provider_parcel_for_classification: true,
      provider_parcel_max_age_days: 30,
    });

    expect(result.status).toBe(AddressVerdictStatus.MIXED_USE);
    expect(result.reasons).toContain('PARCEL_MIXED');
    expect(result.classification).toEqual(expect.objectContaining({
      google_place_types: ['premise'],
      parcel_type: 'mixed',
      building_type: 'mixed_use',
    }));
  });

  test('falls back to current behavior when parcel data is missing', () => {
    const baseline = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
      place: makePlace(),
    });

    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
      place: makePlace(),
      parcel_intel: null,
      use_provider_parcel_for_classification: true,
      provider_parcel_max_age_days: 30,
    });

    expect(result.status).toBe(baseline.status);
    expect(result.reasons).toEqual(baseline.reasons);
  });

  test('falls back to current behavior when parcel data is stale or low-confidence', () => {
    const baseline = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
      place: makePlace(),
    });

    const staleResult = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
      place: makePlace(),
      parcel_intel: makeParcelIntel({
        land_use: 'School',
        property_type: 'School',
        usage_class: 'institutional',
        validated_at: '2025-01-01T00:00:00.000Z',
      }),
      use_provider_parcel_for_classification: true,
      provider_parcel_max_age_days: 30,
    });

    const lowConfidenceResult = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
      place: makePlace(),
      parcel_intel: makeParcelIntel({
        land_use: 'School',
        property_type: 'School',
        usage_class: 'institutional',
        confidence: 0.4,
      }),
      use_provider_parcel_for_classification: true,
      provider_parcel_max_age_days: 30,
    });

    expect(staleResult.status).toBe(baseline.status);
    expect(staleResult.reasons).toEqual(baseline.reasons);
    expect(lowConfidenceResult.status).toBe(baseline.status);
    expect(lowConfidenceResult.reasons).toEqual(baseline.reasons);
  });
});
