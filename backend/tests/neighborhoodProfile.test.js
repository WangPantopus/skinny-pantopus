/**
 * Tests for Neighborhood Profile Service — cache flow, Census/WalkScore/FEMA
 * fetching, graceful fallback, and partial failure handling.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockGt = jest.fn();
const mockMaybeSingle = jest.fn();
const mockUpsert = jest.fn();

const mockFrom = jest.fn(() => ({
  select: mockSelect,
  upsert: mockUpsert,
}));

// Chainable query builder
mockSelect.mockReturnValue({ eq: mockEq });
mockEq.mockReturnValue({ eq: mockEq, gt: mockGt, maybeSingle: mockMaybeSingle });
mockGt.mockReturnValue({ maybeSingle: mockMaybeSingle });
mockUpsert.mockResolvedValue({ error: null });

jest.mock('../../config/supabaseAdmin', () => ({ from: mockFrom }));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock global fetch for API calls
global.fetch = jest.fn();

const {
  getProfile,
  CACHE_TTL_DAYS,
  geocodeToTract,
  fetchCensusACS,
  fetchWalkScore,
  fetchFloodZone,
  FLOOD_ZONE_DESC,
} = require('../services/ai/neighborhoodProfileService');

// ── Test data ──────────────────────────────────────────────────────────────

const MOCK_LAT = 45.6387;
const MOCK_LNG = -122.6615;
const MOCK_ADDRESS = '123 Main St, Vancouver, WA 98661';
const MOCK_TRACT_ID = '53011041100';

const MOCK_GEOCODER_RESPONSE = {
  result: {
    geographies: {
      'Census Tracts': [{
        STATE: '53',
        COUNTY: '011',
        TRACT: '041100',
      }],
    },
  },
};

const MOCK_CENSUS_ACS_RESPONSE = [
  ['B25035_001E', 'B25077_001E', 'B19013_001E', 'B01003_001E', 'B25001_001E', 'state', 'county', 'tract'],
  ['1985', '372000', '68500', '4231', '1842', '53', '011', '041100'],
];

const MOCK_WALKSCORE_RESPONSE = {
  status: 1,
  walkscore: 62,
  description: 'Somewhat Walkable',
  transit: { score: 38 },
  bike: { score: 71 },
};

const MOCK_FEMA_RESPONSE = {
  features: [{
    attributes: {
      FLD_ZONE: 'X',
      ZONE_SUBTY: null,
    },
  }],
};

const MOCK_CACHED_PROFILE = {
  tract_id: MOCK_TRACT_ID,
  median_home_value: 372000,
  median_household_income: 68500,
  median_year_built: 1985,
  total_population: 4231,
  total_housing_units: 1842,
  walk_score: 62,
  walk_description: 'Somewhat Walkable',
  transit_score: 38,
  bike_score: 71,
  flood_zone: 'X',
  flood_zone_description: 'Minimal flood risk',
  cached_at: '2026-03-01T00:00:00.000Z',
  source: 'census+walkscore+fema',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function resetMocks() {
  jest.clearAllMocks();
  mockFrom.mockReturnValue({ select: mockSelect, upsert: mockUpsert });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ eq: mockEq, gt: mockGt, maybeSingle: mockMaybeSingle });
  mockGt.mockReturnValue({ maybeSingle: mockMaybeSingle });
  mockUpsert.mockResolvedValue({ error: null });
  global.fetch.mockReset();
  delete process.env.CENSUS_API_KEY;
  delete process.env.WALKSCORE_API_KEY;
}

function mockFetchResponse(data, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

/**
 * Set up supabaseAdmin.from() for cache lookup then cache write.
 */
function setupCacheSequence(cacheResult) {
  let callCount = 0;
  mockFrom.mockImplementation((table) => {
    if (table === 'NeighborhoodProfileCache') {
      if (callCount === 0) {
        callCount++;
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gt: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue(cacheResult),
              }),
            }),
          }),
          upsert: jest.fn().mockResolvedValue({ error: null }),
        };
      } else {
        return { upsert: jest.fn().mockResolvedValue({ error: null }), select: jest.fn() };
      }
    }
    return { select: mockSelect, upsert: mockUpsert };
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('NeighborhoodProfileService', () => {
  beforeEach(resetMocks);

  describe('CACHE_TTL_DAYS', () => {
    it('is 90 days', () => {
      expect(CACHE_TTL_DAYS).toBe(90);
    });
  });

  describe('FLOOD_ZONE_DESC', () => {
    it('maps common flood zones', () => {
      expect(FLOOD_ZONE_DESC['X']).toBe('Minimal flood risk');
      expect(FLOOD_ZONE_DESC['AE']).toBe('High-risk flood area (base elevations determined)');
      expect(FLOOD_ZONE_DESC['VE']).toBe('Coastal high-risk flood area');
    });
  });

  describe('geocodeToTract', () => {
    it('resolves lat/lng to a Census tract', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchResponse(MOCK_GEOCODER_RESPONSE));

      const result = await geocodeToTract(MOCK_LAT, MOCK_LNG);

      expect(result).not.toBeNull();
      expect(result.tractId).toBe(MOCK_TRACT_ID);
      expect(result.stateCode).toBe('53');
      expect(result.countyCode).toBe('011');
    });

    it('returns null when geocoder fails', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchResponse({}, false));

      const result = await geocodeToTract(MOCK_LAT, MOCK_LNG);
      expect(result).toBeNull();
    });

    it('returns null when geocoder returns no tracts', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchResponse({
        result: { geographies: { 'Census Tracts': [] } },
      }));

      const result = await geocodeToTract(MOCK_LAT, MOCK_LNG);
      expect(result).toBeNull();
    });

    it('handles network errors gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await geocodeToTract(MOCK_LAT, MOCK_LNG);
      expect(result).toBeNull();
    });
  });

  describe('fetchCensusACS', () => {
    it('fetches and parses ACS data correctly', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchResponse(MOCK_CENSUS_ACS_RESPONSE));

      const result = await fetchCensusACS('53', '011', '041100');

      expect(result).not.toBeNull();
      expect(result.median_year_built).toBe(1985);
      expect(result.median_home_value).toBe(372000);
      expect(result.median_household_income).toBe(68500);
      expect(result.total_population).toBe(4231);
      expect(result.total_housing_units).toBe(1842);
    });

    it('handles missing/null Census values (-666666666)', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchResponse([
        ['B25035_001E', 'B25077_001E', 'B19013_001E', 'B01003_001E', 'B25001_001E', 'state', 'county', 'tract'],
        ['-666666666', '372000', '', '4231', null, '53', '011', '041100'],
      ]));

      const result = await fetchCensusACS('53', '011', '041100');

      expect(result.median_year_built).toBeNull();
      expect(result.median_home_value).toBe(372000);
      expect(result.median_household_income).toBeNull();
      expect(result.total_population).toBe(4231);
      expect(result.total_housing_units).toBeNull();
    });

    it('returns null on API failure', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchResponse({}, false));

      const result = await fetchCensusACS('53', '011', '041100');
      expect(result).toBeNull();
    });

    it('includes API key in URL when CENSUS_API_KEY is set', async () => {
      process.env.CENSUS_API_KEY = 'test-census-key';
      global.fetch.mockResolvedValueOnce(mockFetchResponse(MOCK_CENSUS_ACS_RESPONSE));

      await fetchCensusACS('53', '011', '041100');

      const calledUrl = global.fetch.mock.calls[0][0];
      expect(calledUrl).toContain('key=test-census-key');
    });
  });

  describe('fetchWalkScore', () => {
    it('fetches Walk Score data when API key is set', async () => {
      process.env.WALKSCORE_API_KEY = 'test-ws-key';
      global.fetch.mockResolvedValueOnce(mockFetchResponse(MOCK_WALKSCORE_RESPONSE));

      const result = await fetchWalkScore(MOCK_LAT, MOCK_LNG, MOCK_ADDRESS);

      expect(result).not.toBeNull();
      expect(result.walk_score).toBe(62);
      expect(result.walk_description).toBe('Somewhat Walkable');
      expect(result.transit_score).toBe(38);
      expect(result.bike_score).toBe(71);
    });

    it('returns null when WALKSCORE_API_KEY is not set', async () => {
      const result = await fetchWalkScore(MOCK_LAT, MOCK_LNG, MOCK_ADDRESS);
      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns null on API error', async () => {
      process.env.WALKSCORE_API_KEY = 'test-ws-key';
      global.fetch.mockResolvedValueOnce(mockFetchResponse({ status: 2 }));

      const result = await fetchWalkScore(MOCK_LAT, MOCK_LNG, MOCK_ADDRESS);
      expect(result).toBeNull();
    });
  });

  describe('fetchFloodZone', () => {
    it('fetches FEMA flood zone data', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchResponse(MOCK_FEMA_RESPONSE));

      const result = await fetchFloodZone(MOCK_LAT, MOCK_LNG);

      expect(result).not.toBeNull();
      expect(result.flood_zone).toBe('X');
      expect(result.flood_zone_description).toBe('Minimal flood risk');
    });

    it('returns null when no features returned', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchResponse({ features: [] }));

      const result = await fetchFloodZone(MOCK_LAT, MOCK_LNG);
      expect(result).toBeNull();
    });

    it('returns null on API failure', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchResponse({}, false));

      const result = await fetchFloodZone(MOCK_LAT, MOCK_LNG);
      expect(result).toBeNull();
    });

    it('maps high-risk flood zones correctly', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchResponse({
        features: [{ attributes: { FLD_ZONE: 'AE' } }],
      }));

      const result = await fetchFloodZone(MOCK_LAT, MOCK_LNG);
      expect(result.flood_zone).toBe('AE');
      expect(result.flood_zone_description).toBe('High-risk flood area (base elevations determined)');
    });
  });

  describe('getProfile — cache hit', () => {
    it('returns cached profile without fetching APIs', async () => {
      // Mock geocoder to return tract
      global.fetch.mockResolvedValueOnce(mockFetchResponse(MOCK_GEOCODER_RESPONSE));

      setupCacheSequence(
        { data: { profile: MOCK_CACHED_PROFILE, fetched_at: '2026-03-01T00:00:00Z' }, error: null }
      );

      const result = await getProfile({ latitude: MOCK_LAT, longitude: MOCK_LNG, address: MOCK_ADDRESS });

      expect(result.source).toBe('cache');
      expect(result.profile).toEqual(MOCK_CACHED_PROFILE);
      // Only geocoder should have been called (1 fetch), not Census/WalkScore/FEMA
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getProfile — cache miss → fetch → build profile', () => {
    it('fetches from all three sources and builds complete profile', async () => {
      process.env.WALKSCORE_API_KEY = 'test-ws-key';

      setupCacheSequence({ data: null, error: null });

      // 1. Geocoder, 2. Census ACS, 3. Walk Score, 4. FEMA
      global.fetch
        .mockResolvedValueOnce(mockFetchResponse(MOCK_GEOCODER_RESPONSE))  // geocoder
        .mockResolvedValueOnce(mockFetchResponse(MOCK_CENSUS_ACS_RESPONSE)) // census
        .mockResolvedValueOnce(mockFetchResponse(MOCK_WALKSCORE_RESPONSE))  // walkscore
        .mockResolvedValueOnce(mockFetchResponse(MOCK_FEMA_RESPONSE));      // fema

      const result = await getProfile({ latitude: MOCK_LAT, longitude: MOCK_LNG, address: MOCK_ADDRESS });

      expect(result.source).toBe('live');
      expect(result.profile).toBeDefined();
      expect(result.profile.tract_id).toBe(MOCK_TRACT_ID);
      expect(result.profile.median_home_value).toBe(372000);
      expect(result.profile.median_household_income).toBe(68500);
      expect(result.profile.median_year_built).toBe(1985);
      expect(result.profile.total_population).toBe(4231);
      expect(result.profile.total_housing_units).toBe(1842);
      expect(result.profile.walk_score).toBe(62);
      expect(result.profile.walk_description).toBe('Somewhat Walkable');
      expect(result.profile.transit_score).toBe(38);
      expect(result.profile.bike_score).toBe(71);
      expect(result.profile.flood_zone).toBe('X');
      expect(result.profile.flood_zone_description).toBe('Minimal flood risk');
      expect(result.profile.source).toBe('census+walkscore+fema');
    });
  });

  describe('getProfile — partial failure', () => {
    it('returns profile with nulls when Walk Score is unavailable', async () => {
      // No WALKSCORE_API_KEY — Walk Score returns null
      setupCacheSequence({ data: null, error: null });

      global.fetch
        .mockResolvedValueOnce(mockFetchResponse(MOCK_GEOCODER_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(MOCK_CENSUS_ACS_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(MOCK_FEMA_RESPONSE));

      const result = await getProfile({ latitude: MOCK_LAT, longitude: MOCK_LNG });

      expect(result.source).toBe('live');
      expect(result.profile.median_home_value).toBe(372000);
      expect(result.profile.walk_score).toBeNull();
      expect(result.profile.walk_description).toBeNull();
      expect(result.profile.flood_zone).toBe('X');
      expect(result.profile.source).toBe('census+fema');
    });

    it('returns profile with only FEMA when Census and Walk Score fail', async () => {
      setupCacheSequence({ data: null, error: null });

      global.fetch
        .mockResolvedValueOnce(mockFetchResponse(MOCK_GEOCODER_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse({}, false))                // census fails
        .mockResolvedValueOnce(mockFetchResponse(MOCK_FEMA_RESPONSE));      // fema ok (walkscore null, no key)

      const result = await getProfile({ latitude: MOCK_LAT, longitude: MOCK_LNG });

      expect(result.source).toBe('live');
      expect(result.profile.median_home_value).toBeNull();
      expect(result.profile.flood_zone).toBe('X');
      expect(result.profile.source).toBe('fema');
    });
  });

  describe('getProfile — total failure', () => {
    it('returns null profile when geocoder fails', async () => {
      global.fetch.mockResolvedValueOnce(mockFetchResponse({}, false));

      const result = await getProfile({ latitude: MOCK_LAT, longitude: MOCK_LNG });

      expect(result.profile).toBeNull();
      expect(result.source).toBe('error');
    });

    it('returns null profile when all three data sources fail', async () => {
      setupCacheSequence({ data: null, error: null });

      global.fetch
        .mockResolvedValueOnce(mockFetchResponse(MOCK_GEOCODER_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse({}, false))   // census fails
        .mockResolvedValueOnce(mockFetchResponse({}, false));   // fema fails (walkscore null, no key)

      const result = await getProfile({ latitude: MOCK_LAT, longitude: MOCK_LNG });

      expect(result.profile).toBeNull();
      expect(result.source).toBe('error');
    });
  });

  describe('NeighborhoodProfile shape', () => {
    it('has all expected fields', () => {
      const expectedFields = [
        'tract_id', 'median_home_value', 'median_household_income',
        'median_year_built', 'total_population', 'total_housing_units',
        'walk_score', 'walk_description', 'transit_score', 'bike_score',
        'flood_zone', 'flood_zone_description', 'cached_at', 'source',
      ];
      for (const field of expectedFields) {
        expect(MOCK_CACHED_PROFILE).toHaveProperty(field);
      }
    });
  });
});
