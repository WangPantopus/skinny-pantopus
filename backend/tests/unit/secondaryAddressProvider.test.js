jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('secondaryAddressProvider', () => {
  const originalEnv = process.env;
  const countResponse = [{ smarty_key: '347247266', count: 24 }];
  const listResponse = [{
    smarty_key: '347247266',
    root_address: { secondary_count: 24 },
    secondaries: [
      { secondary_designator: 'Apt', secondary_number: '101' },
      { secondary_designator: 'Apt', secondary_number: '4A' },
      { secondary_designator: 'Apt', secondary_number: '202' },
    ],
  }];

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.ENABLE_ADDRESS_SECONDARY_PROVIDER;
    delete process.env.SMARTY_AUTH_ID;
    delete process.env.SMARTY_AUTH_TOKEN;
    delete process.env.ADDRESS_SECONDARY_PROVIDER_TIMEOUT_MS;
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

    return {
      provider: require('../../services/addressValidation/secondaryAddressProvider'),
      logger: require('../../utils/logger'),
    };
  }

  test('is disabled by default and does not make network calls', async () => {
    const { provider } = loadProvider({
      SMARTY_AUTH_ID: 'smarty-id',
      SMARTY_AUTH_TOKEN: 'smarty-token',
    });

    expect(provider.isFeatureEnabled()).toBe(false);
    expect(provider.shouldRunLookup({
      normalizedAddress: {
        line1: '1410 NE 66th Ave',
        city: 'Portland',
        state: 'OR',
        zip: '97213',
      },
    })).toBe(false);

    const result = await provider.lookup({
      normalizedAddress: {
        line1: '1410 NE 66th Ave',
        city: 'Portland',
        state: 'OR',
        zip: '97213',
      },
    });

    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('returns null when no searchable canonical address is available', async () => {
    const { provider } = loadProvider({
      ENABLE_ADDRESS_SECONDARY_PROVIDER: 'true',
      SMARTY_AUTH_ID: 'smarty-id',
      SMARTY_AUTH_TOKEN: 'smarty-token',
    });

    const result = await provider.lookup({});

    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('normalizes high-confidence count results for multi-unit buildings without a unit', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => countResponse,
    });

    const { provider } = loadProvider({
      ENABLE_ADDRESS_SECONDARY_PROVIDER: 'true',
      SMARTY_AUTH_ID: 'smarty-id',
      SMARTY_AUTH_TOKEN: 'smarty-token',
    });

    const result = await provider.lookup({
      normalizedAddress: {
        line1: 'Sunset Apartments',
        city: 'Portland',
        state: 'OR',
        zip: '97213',
      },
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain('/lookup/search/secondary/count?');
    expect(global.fetch.mock.calls[0][0]).not.toContain('auth-id=');
    expect(global.fetch.mock.calls[0][0]).not.toContain('auth-token=');
    expect(global.fetch.mock.calls[0][1].headers).toEqual(expect.objectContaining({
      Authorization: `Basic ${Buffer.from('smarty-id:smarty-token').toString('base64')}`,
    }));
    expect(result).toEqual(expect.objectContaining({
      provider: 'smarty_secondary',
      provider_version: 'us_enrichment_secondary_v1',
      secondary_required: true,
      unit_count_estimate: 24,
      confidence: 0.9,
      lookup_mode: 'secondary_count',
      verification_level: 'secondary_provider_observed',
    }));
    expect(result.validated_at).toEqual(expect.any(String));
  });

  test('fetches secondaries for a supplied unit and confirms a known unit', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => countResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => listResponse,
      });

    const { provider } = loadProvider({
      ENABLE_ADDRESS_SECONDARY_PROVIDER: 'true',
      SMARTY_AUTH_ID: 'smarty-id',
      SMARTY_AUTH_TOKEN: 'smarty-token',
    });

    const result = await provider.lookup({
      normalizedAddress: {
        line1: 'Sunset Apartments',
        line2: 'Apt 4A',
        city: 'Portland',
        state: 'OR',
        zip: '97213',
      },
      submittedUnit: 'Apt 4A',
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[1][0]).toContain('/lookup/347247266/secondary');
    expect(global.fetch.mock.calls[1][0]).not.toContain('auth-id=');
    expect(global.fetch.mock.calls[1][0]).not.toContain('auth-token=');
    expect(global.fetch.mock.calls[1][1].headers).toEqual(expect.objectContaining({
      Authorization: `Basic ${Buffer.from('smarty-id:smarty-token').toString('base64')}`,
    }));
    expect(result).toEqual(expect.objectContaining({
      secondary_required: true,
      unit_count_estimate: 24,
      submitted_unit_evaluated: true,
      submitted_unit_known: true,
      confidence: 0.95,
      lookup_mode: 'secondary_count_and_list',
    }));
  });

  test('fails open on provider timeout', async () => {
    const timeoutError = new Error('timed out');
    timeoutError.name = 'AbortError';
    global.fetch.mockRejectedValue(timeoutError);

    const { provider, logger } = loadProvider({
      ENABLE_ADDRESS_SECONDARY_PROVIDER: 'true',
      SMARTY_AUTH_ID: 'smarty-id',
      SMARTY_AUTH_TOKEN: 'smarty-token',
      ADDRESS_SECONDARY_PROVIDER_TIMEOUT_MS: '900',
    });

    const result = await provider.lookup({
      normalizedAddress: {
        line1: 'Sunset Apartments',
        city: 'Portland',
        state: 'OR',
        zip: '97213',
      },
    });

    expect(result).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][1].signal).toBeDefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'secondaryAddressProvider: request timed out',
      expect.objectContaining({
        mode: 'secondary_count',
        timeout_ms: 900,
      }),
    );
  });
});
