jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('parcelIntelProvider', () => {
  const originalEnv = process.env;
  const attomDetailPayload = {
    property: [{
      identifier: {
        apn: 'R123456',
        attomId: 987654321,
      },
      summary: {
        propclass: 'Commercial',
        buildingsCount: 2,
        nonResidentialUnits: 1,
      },
      building: {
        summary: {
          propertyType: 'Office Building',
          unitsCount: 0,
        },
      },
    }],
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.ENABLE_ADDRESS_PARCEL_PROVIDER;
    delete process.env.ADDRESS_PARCEL_PROVIDER;
    delete process.env.ADDRESS_PARCEL_PROVIDER_TIMEOUT_MS;
    delete process.env.ADDRESS_PARCEL_CACHE_DAYS;
    delete process.env.ATTOM_API_KEY;
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function loadProvider(envOverrides = {}) {
    process.env = {
      ...originalEnv,
      ...envOverrides,
    };

    const provider = require('../../services/addressValidation/parcelIntelProvider');
    const logger = require('../../utils/logger');
    const supabaseMock = require('../__mocks__/supabaseAdmin');
    supabaseMock.resetTables();

    return { provider, logger, supabaseMock };
  }

  function makeContext(overrides = {}) {
    return {
      normalizedAddress: {
        line1: '123 Commerce Plaza',
        city: 'Portland',
        state: 'OR',
        zip: '97201',
      },
      google: {
        verdict: {
          hasInferredComponents: false,
          hasReplacedComponents: false,
        },
      },
      smarty: {
        rdi_type: 'unknown',
      },
      place: {
        google_place_types: ['establishment'],
        parcel_type: 'commercial',
        building_type: 'commercial',
      },
      providerPlace: null,
      unitIntelligence: null,
      ...overrides,
    };
  }

  test('is disabled by default and does not make network calls', async () => {
    const { provider } = loadProvider({
      ATTOM_API_KEY: 'test-attom-key',
      ADDRESS_PARCEL_PROVIDER: 'attom',
    });

    expect(provider.isFeatureEnabled()).toBe(false);
    expect(provider.shouldRunLookup(makeContext())).toBe(false);

    const result = await provider.lookup(makeContext());
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('selective invocation skips clearly residential addresses and runs for ambiguous/risky ones', () => {
    const { provider } = loadProvider({
      ENABLE_ADDRESS_PARCEL_PROVIDER: 'true',
      ADDRESS_PARCEL_PROVIDER: 'attom',
      ATTOM_API_KEY: 'test-attom-key',
    });

    expect(provider.shouldRunLookup(makeContext({
      smarty: { rdi_type: 'residential' },
      place: {
        google_place_types: ['premise'],
        parcel_type: 'residential',
        building_type: 'single_family',
      },
      google: {
        verdict: {
          hasInferredComponents: false,
          hasReplacedComponents: false,
        },
      },
    }))).toBe(false);

    expect(provider.shouldRunLookup(makeContext({
      place: {
        google_place_types: ['premise'],
        parcel_type: 'mixed',
        building_type: 'mixed_use',
      },
      smarty: { rdi_type: 'unknown' },
    }))).toBe(true);
  });

  test('returns cached parcel intel from HomeAddress without calling the provider', async () => {
    const { provider, supabaseMock } = loadProvider({
      ENABLE_ADDRESS_PARCEL_PROVIDER: 'true',
      ADDRESS_PARCEL_PROVIDER: 'attom',
      ATTOM_API_KEY: 'test-attom-key',
      ADDRESS_PARCEL_CACHE_DAYS: '30',
    });

    supabaseMock.seedTable('HomeAddress', [{
      id: 'addr-1',
      address_line1_norm: '123 Commerce Plaza',
      city_norm: 'Portland',
      state: 'OR',
      postal_code: '97201',
      parcel_provider: 'attom',
      parcel_id: 'R123456',
      parcel_land_use: 'Commercial',
      parcel_property_type: 'Office Building',
      parcel_confidence: 0.8,
      building_count: 2,
      residential_unit_count: 0,
      non_residential_unit_count: 1,
      usage_class: 'commercial',
      last_parcel_validated_at: new Date().toISOString(),
      provider_versions: {
        parcel_intel: {
          provider: 'attom',
          version: 'parcel_shadow_v1',
          shadow_only: true,
        },
      },
      validation_raw_response: {
        parcel_provider: {
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
          validated_at: '2026-04-02T12:00:00.000Z',
        },
      },
    }]);

    const result = await provider.lookup(makeContext());

    expect(result).toEqual(expect.objectContaining({
      provider: 'attom',
      parcel_id: 'R123456',
      usage_class: 'commercial',
      from_cache: true,
    }));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('selects the freshest cached parcel row when multiple unit-level rows share the same normalized address', async () => {
    jest.useFakeTimers();
    // Real wall clock made this test flaky: cache uses now−30d, so fixed April dates could fall
    // outside the window and only one row matched → logger.info (multi-row) never ran.
    jest.setSystemTime(new Date('2026-05-20T12:00:00.000Z'));
    try {
    const { provider, supabaseMock, logger } = loadProvider({
      ENABLE_ADDRESS_PARCEL_PROVIDER: 'true',
      ADDRESS_PARCEL_PROVIDER: 'attom',
      ATTOM_API_KEY: 'test-attom-key',
      ADDRESS_PARCEL_CACHE_DAYS: '30',
    });

    supabaseMock.seedTable('HomeAddress', [
      {
        id: 'addr-older',
        address_line1_norm: '123 Commerce Plaza',
        address_line2_norm: 'Unit 1',
        city_norm: 'Portland',
        state: 'OR',
        postal_code: '97201',
        parcel_provider: 'attom',
        parcel_id: 'OLD-ROW',
        usage_class: 'commercial',
        parcel_confidence: 0.7,
        last_parcel_validated_at: '2026-05-15T12:00:00.000Z',
        validation_raw_response: {
          parcel_provider: {
            parcel_id: 'OLD-ROW',
            usage_class: 'commercial',
          },
        },
      },
      {
        id: 'addr-newer',
        address_line1_norm: '123 Commerce Plaza',
        address_line2_norm: 'Unit 2',
        city_norm: 'Portland',
        state: 'OR',
        postal_code: '97201',
        parcel_provider: 'attom',
        parcel_id: 'NEW-ROW',
        usage_class: 'institutional',
        parcel_confidence: 0.93,
        last_parcel_validated_at: '2026-05-18T12:00:00.000Z',
        validation_raw_response: {
          parcel_provider: {
            parcel_id: 'NEW-ROW',
            usage_class: 'institutional',
          },
        },
      },
    ]);

    const result = await provider.lookup(makeContext());

    expect(result).toEqual(expect.objectContaining({
      parcel_id: 'NEW-ROW',
      usage_class: 'institutional',
      from_cache: true,
    }));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'parcelIntelProvider: selected best cached parcel row',
      expect.objectContaining({
        row_count: 2,
        selected_address_id: 'addr-newer',
      }),
    );
    } finally {
      jest.useRealTimers();
    }
  });

  test('normalizes ATTOM detail payloads into parcel intel', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => attomDetailPayload,
    });

    const { provider } = loadProvider({
      ENABLE_ADDRESS_PARCEL_PROVIDER: 'true',
      ADDRESS_PARCEL_PROVIDER: 'attom',
      ATTOM_API_KEY: 'test-attom-key',
    });

    const result = await provider.lookup(makeContext());

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain('/property/detail?');
    expect(result).toEqual(expect.objectContaining({
      provider: 'attom',
      provider_version: 'parcel_shadow_v1',
      parcel_id: 'R123456',
      land_use: 'Commercial',
      property_type: 'Office Building',
      building_count: 2,
      residential_unit_count: 0,
      non_residential_unit_count: 1,
      usage_class: 'commercial',
      lookup_mode: 'property_detail',
      from_cache: false,
    }));
    expect(result.validated_at).toEqual(expect.any(String));
  });

  test('fails open on provider timeout', async () => {
    const timeoutError = new Error('timed out');
    timeoutError.name = 'AbortError';
    global.fetch.mockRejectedValue(timeoutError);

    const { provider, logger } = loadProvider({
      ENABLE_ADDRESS_PARCEL_PROVIDER: 'true',
      ADDRESS_PARCEL_PROVIDER: 'attom',
      ATTOM_API_KEY: 'test-attom-key',
      ADDRESS_PARCEL_PROVIDER_TIMEOUT_MS: '900',
    });

    const result = await provider.lookup(makeContext());

    expect(result).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][1].signal).toBeDefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'parcelIntelProvider: request timed out',
      expect.objectContaining({
        provider: 'attom',
        timeout_ms: 900,
      }),
    );
  });
});
