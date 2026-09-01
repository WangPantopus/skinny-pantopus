const engine = require('../../services/addressValidation/addressDecisionEngine');
const { AddressVerdictStatus } = require('../../services/addressValidation/types');

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
    validated_at: '2026-04-02T12:00:00.000Z',
    ...overrides,
  };
}

describe('provider-backed BUSINESS enforcement', () => {
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
      provider_place: makeProviderPlace('school'),
      use_provider_place_for_business: false,
    });

    expect(withProviderDisabled.status).toBe(baseline.status);
    expect(withProviderDisabled.reasons).toEqual(baseline.reasons);
  });

  test.each([
    ['school', makeProviderPlace('school')],
    ['church', makeProviderPlace('church')],
    ['hospital', makeProviderPlace('hospital', ['hospital', 'medical_center', 'point_of_interest'])],
    ['corporate office', makeProviderPlace('corporate_office')],
    ['venue', makeProviderPlace('stadium')],
    ['storefront', makeProviderPlace('store')],
    ['warehouse', makeProviderPlace('warehouse', ['warehouse', 'manufacturer', 'point_of_interest'])],
    ['government building', makeProviderPlace('city_hall', ['city_hall', 'local_government_office', 'point_of_interest'])],
  ])('flag ON maps obvious %s provider deny cases to BUSINESS', (_label, providerPlace) => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'residential' }),
      place: makePlace(),
      provider_place: providerPlace,
      use_provider_place_for_business: true,
    });

    expect(result.status).toBe(AddressVerdictStatus.BUSINESS);
    expect(result.reasons).toEqual(expect.arrayContaining([
      expect.stringMatching(/^PLACE_(COMMERCIAL|INSTITUTIONAL)$/),
    ]));
    expect(result.reasons).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/^PLACE_PROVIDER_/),
    ]));
  });

  test('falls back to current heuristic behavior when provider data is missing', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'commercial' }),
      place: makePlace({
        google_place_types: [],
        parcel_type: 'unknown',
        building_type: 'unknown',
      }),
      provider_place: null,
      use_provider_place_for_business: true,
    });

    expect(result.status).toBe(AddressVerdictStatus.BUSINESS);
    expect(result.reasons).toContain('RDI_COMMERCIAL');
  });

  test('falls back to heuristics when provider confidence is below threshold', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
      place: makePlace(),
      provider_place: makeProviderPlace('school', ['school', 'point_of_interest'], {
        confidence: 0.4,
      }),
      use_provider_place_for_business: true,
    });

    expect(result.status).toBe(AddressVerdictStatus.OK);
    expect(result.reasons).not.toContain('PLACE_INSTITUTIONAL');
  });

  test('does not broaden residential housing-complex cases into BUSINESS', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty(),
      place: makePlace(),
      provider_place: makeProviderPlace('apartment_complex', ['apartment_complex', 'premise']),
      use_provider_place_for_business: true,
    });

    expect(result.status).toBe(AddressVerdictStatus.OK);
  });

  test('keeps mixed-use guardrails unchanged even with provider commercial data', () => {
    const result = engine.classify({
      google: makeGoogle(),
      smarty: makeSmarty({ rdi_type: 'unknown' }),
      place: makePlace({
        google_place_types: ['premise', 'store'],
        parcel_type: 'mixed',
        building_type: 'mixed_use',
      }),
      provider_place: makeProviderPlace('store'),
      use_provider_place_for_business: true,
    });

    expect(result.status).toBe(AddressVerdictStatus.MIXED_USE);
  });
});
