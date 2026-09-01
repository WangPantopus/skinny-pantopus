jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
const {
  institutionalPlace,
  venuePlace,
  officePlace,
  residentialPlace,
} = require('../fixtures/googlePlacesClassificationFixtures');

describe('placeClassificationProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.ENABLE_ADDRESS_PLACE_PROVIDER;
    delete process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.ADDRESS_PLACE_PROVIDER_TIMEOUT_MS;
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
      provider: require('../../services/addressValidation/placeClassificationProvider'),
      logger: require('../../utils/logger'),
    };
  }

  test('is disabled by default and does not make network calls', async () => {
    const { provider } = loadProvider({
      GOOGLE_PLACES_API_KEY: 'test-google-places-key',
    });

    expect(provider.isFeatureEnabled()).toBe(false);
    expect(provider.shouldRunShadowLookup()).toBe(false);

    const result = await provider.classify({ placeId: 'places/123' });
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('returns null when neither a place id nor fallback search inputs are available', async () => {
    const { provider } = loadProvider({
      ENABLE_ADDRESS_PLACE_PROVIDER: 'true',
      GOOGLE_PLACES_API_KEY: 'test-google-places-key',
    });

    const result = await provider.classify({});

    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test.each([
    ['institutional', institutionalPlace, 'school', ['named_poi', 'institutional_type']],
    ['venue', venuePlace, 'stadium', ['named_poi', 'institutional_type']],
    ['office', officePlace, 'corporate_office', ['named_poi']],
    ['residential', residentialPlace, 'apartment_complex', ['named_poi']],
  ])('normalizes %s Google Places details payloads', async (_label, payload, primaryType, riskFlags) => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => payload,
    });

    const { provider } = loadProvider({
      ENABLE_ADDRESS_PLACE_PROVIDER: 'true',
      GOOGLE_PLACES_API_KEY: 'test-google-places-key',
    });

    const result = await provider.classify({
      placeId: `places/${payload.id}`,
      normalizedAddress: {
        line1: '1410 NE 66th Ave',
        city: 'Portland',
        state: 'OR',
        zip: '97213',
      },
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expect.objectContaining({
      provider: 'google_places',
      provider_version: 'places_v1',
      place_id: payload.id,
      primary_type: primaryType,
      types: payload.types,
      business_status: payload.businessStatus,
      display_name: payload.displayName.text,
      confidence: 0.9,
      lookup_mode: 'place_details',
      verification_level: 'shadow_provider_observed',
      risk_flags: riskFlags,
    }));
    expect(result.validated_at).toEqual(expect.any(String));
  });

  test('normalizes resource-name place ids into a valid Place Details lookup', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => institutionalPlace,
    });

    const { provider } = loadProvider({
      ENABLE_ADDRESS_PLACE_PROVIDER: 'true',
      GOOGLE_PLACES_API_KEY: 'test-google-places-key',
    });

    const result = await provider.classify({
      placeId: 'places/school-123',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe('https://places.googleapis.com/v1/places/school-123');
    expect(result.place_id).toBe('school-123');
  });

  test('falls back to text search when a canonical address is available', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [institutionalPlace],
      }),
    });

    const { provider } = loadProvider({
      ENABLE_ADDRESS_PLACE_PROVIDER: 'true',
      GOOGLE_PLACES_API_KEY: 'test-google-places-key',
    });

    const result = await provider.classify({
      normalizedAddress: {
        line1: '1410 NE 66th Ave',
        city: 'Portland',
        state: 'OR',
        zip: '97213',
      },
      lat: 45.55,
      lng: -122.59,
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual(expect.objectContaining({
      textQuery: '1410 NE 66th Ave, Portland, OR 97213',
      pageSize: 5,
      languageCode: 'en',
      regionCode: 'US',
    }));
    expect(result).toEqual(expect.objectContaining({
      place_id: institutionalPlace.id,
      primary_type: institutionalPlace.primaryType,
      lookup_mode: 'search_text',
    }));
  });

  test('continues past generic address-level place details and prefers stronger text-search POI results', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'address-123',
          displayName: { text: '2400 NE Woodburn Dr' },
          primaryType: null,
          types: ['premise', 'street_address'],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          places: [{
            ...institutionalPlace,
            id: 'woodburn-school-123',
            displayName: { text: 'Woodburn Elementary School' },
            primaryType: 'school',
            types: ['school', 'point_of_interest', 'establishment'],
          }],
        }),
      });

    const { provider } = loadProvider({
      ENABLE_ADDRESS_PLACE_PROVIDER: 'true',
      GOOGLE_PLACES_API_KEY: 'test-google-places-key',
    });

    const result = await provider.classify({
      placeId: 'places/address-123',
      normalizedAddress: {
        line1: '2400 Northeast Woodburn Drive',
        city: 'Camas',
        state: 'WA',
        zip: '98607',
      },
      lat: 45.6032307,
      lng: -122.3851931,
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][0]).toBe('https://places.googleapis.com/v1/places/address-123');
    expect(global.fetch.mock.calls[1][0]).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(result).toEqual(expect.objectContaining({
      place_id: 'woodburn-school-123',
      primary_type: 'school',
      display_name: 'Woodburn Elementary School',
      lookup_mode: 'search_text',
    }));
  });

  test('treats abbreviated address display names as the same address, not a named POI', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'address-123',
          displayName: { text: '2400 NE Woodburn Dr' },
          primaryType: null,
          types: ['premise', 'street_address'],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ places: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ places: [] }),
      });

    const { provider } = loadProvider({
      ENABLE_ADDRESS_PLACE_PROVIDER: 'true',
      GOOGLE_PLACES_API_KEY: 'test-google-places-key',
    });

    const result = await provider.classify({
      placeId: 'places/address-123',
      normalizedAddress: {
        line1: '2400 Northeast Woodburn Drive',
        city: 'Camas',
        state: 'WA',
        zip: '98607',
      },
      lat: 45.6032307,
      lng: -122.3851931,
    });

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(result).toEqual(expect.objectContaining({
      place_id: 'address-123',
      display_name: '2400 NE Woodburn Dr',
      types: ['premise', 'street_address'],
      lookup_mode: 'place_details',
      risk_flags: [],
    }));
  });

  test('returns generic address-level details if no stronger fallback result is found', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'address-123',
          displayName: { text: '2400 NE Woodburn Dr' },
          primaryType: null,
          types: ['premise', 'street_address'],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ places: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ places: [] }),
      });

    const { provider } = loadProvider({
      ENABLE_ADDRESS_PLACE_PROVIDER: 'true',
      GOOGLE_PLACES_API_KEY: 'test-google-places-key',
    });

    const result = await provider.classify({
      placeId: 'places/address-123',
      normalizedAddress: {
        line1: '2400 NE Woodburn Dr',
        city: 'Camas',
        state: 'WA',
        zip: '98607',
      },
      lat: 45.6032307,
      lng: -122.3851931,
    });

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(result).toEqual(expect.objectContaining({
      place_id: 'address-123',
      display_name: '2400 NE Woodburn Dr',
      primary_type: null,
      types: ['premise', 'street_address'],
      lookup_mode: 'place_details',
    }));
  });

  test('falls back to nearby search when only coordinates are available', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [venuePlace],
      }),
    });

    const { provider } = loadProvider({
      ENABLE_ADDRESS_PLACE_PROVIDER: 'true',
      GOOGLE_PLACES_API_KEY: 'test-google-places-key',
    });

    const result = await provider.classify({
      lat: 45.5378,
      lng: -122.5994,
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe('https://places.googleapis.com/v1/places:searchNearby');
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual(expect.objectContaining({
      maxResultCount: 5,
      rankPreference: 'DISTANCE',
    }));
    expect(result).toEqual(expect.objectContaining({
      place_id: venuePlace.id,
      primary_type: venuePlace.primaryType,
      lookup_mode: 'search_nearby',
    }));
  });

  test('prefers a stronger nearby-search POI over generic address-level text-search results', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'address-123',
          displayName: { text: '2400 NE Woodburn Dr' },
          primaryType: null,
          types: ['premise', 'street_address'],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          places: [{
            id: 'address-123',
            displayName: { text: '2400 NE Woodburn Dr' },
            primaryType: null,
            types: ['premise', 'street_address'],
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          places: [{
            ...institutionalPlace,
            id: 'woodburn-school-123',
            displayName: { text: 'Woodburn Elementary' },
            primaryType: 'primary_school',
            types: ['primary_school', 'school', 'educational_institution', 'point_of_interest', 'establishment'],
          }],
        }),
      });

    const { provider } = loadProvider({
      ENABLE_ADDRESS_PLACE_PROVIDER: 'true',
      GOOGLE_PLACES_API_KEY: 'test-google-places-key',
    });

    const result = await provider.classify({
      placeId: 'places/address-123',
      normalizedAddress: {
        line1: '2400 Northeast Woodburn Drive',
        city: 'Camas',
        state: 'WA',
        zip: '98607',
      },
      lat: 45.6032307,
      lng: -122.3851931,
    });

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch.mock.calls[2][0]).toBe('https://places.googleapis.com/v1/places:searchNearby');
    expect(result).toEqual(expect.objectContaining({
      place_id: 'woodburn-school-123',
      primary_type: 'primary_school',
      display_name: 'Woodburn Elementary',
      lookup_mode: 'search_nearby',
    }));
  });

  test('fails open on provider timeout', async () => {
    const timeoutError = new Error('timed out');
    timeoutError.name = 'AbortError';
    global.fetch.mockRejectedValue(timeoutError);

    const { provider, logger } = loadProvider({
      ENABLE_ADDRESS_PLACE_PROVIDER: 'true',
      GOOGLE_PLACES_API_KEY: 'test-google-places-key',
      ADDRESS_PLACE_PROVIDER_TIMEOUT_MS: '900',
    });

    const result = await provider.classify({
      placeId: 'places/school-123',
      normalizedAddress: {
        line1: '1410 NE 66th Ave',
        city: 'Portland',
        state: 'OR',
        zip: '97213',
      },
    });

    expect(result).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][1].signal).toBeDefined();
    expect(global.fetch.mock.calls[1][0]).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(logger.warn).toHaveBeenCalledWith(
      'placeClassificationProvider: request timed out',
      expect.objectContaining({
        mode: 'place_details',
        timeout_ms: 900,
      }),
    );
  });
});
