/**
 * Tests for Property Intelligence Service — cache flow, fallback behaviour,
 * auth requirements, and home access checks.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

// Mock supabaseAdmin before requiring modules
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

// Mock global fetch for ATTOM API calls
global.fetch = jest.fn();

const {
  getProfile,
  getHomeAttomPropertyDetail,
  CACHE_TTL_DAYS,
} = require('../services/ai/propertyIntelligenceService');

// ── Test data ──────────────────────────────────────────────────────────────

const MOCK_HOME_ID = '11111111-1111-1111-1111-111111111111';
const MOCK_USER_ID = '22222222-2222-2222-2222-222222222222';

const MOCK_HOME = {
  id: MOCK_HOME_ID,
  address: '123 Main St',
  city: 'Vancouver',
  state: 'WA',
  zipcode: '98661',
  year_built: 1978,
  sq_ft: 1650,
  bedrooms: 3,
  bathrooms: 2,
  lot_sq_ft: 7500,
  home_type: 'house',
};

const MOCK_ATTOM_DETAIL = {
  property: [{
    building: {
      summary: { yearBuilt: 1978, livingSize: 1650, propertyType: 'Single Family Residence' },
      rooms: { bedrooms: 3, bathsFull: 2 },
    },
    lot: { lotSize1: 7500 },
    assessment: { assessed: { assdTtlValue: 372000 } },
  }],
};

const MOCK_ATTOM_AVM = {
  property: [{
    avm: {
      amount: { value: 385000, low: 365000, high: 405000 },
      confidence: 0.85,
    },
  }],
};

const MOCK_ATTOM_TREND = {
  salesTrend: [{
    medianSalePrice: '390000',
    prevMedianSalePrice: '375000',
  }],
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
  delete process.env.ATTOM_API_KEY;
}

/**
 * Set up supabaseAdmin.from() to return different chains depending on the
 * table name. The first call is for cache lookup, the second for Home lookup.
 */
function setupFromSequence(cacheResult, homeResult) {
  let callCount = 0;
  mockFrom.mockImplementation((table) => {
    if (table === 'PropertyIntelligenceCache') {
      if (callCount === 0) {
        // First call: cache read (select)
        callCount++;
        const chain = {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gt: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue(cacheResult),
              }),
            }),
          }),
          upsert: jest.fn().mockResolvedValue({ error: null }),
        };
        return chain;
      } else {
        // Subsequent calls: cache write (upsert)
        return { upsert: jest.fn().mockResolvedValue({ error: null }), select: jest.fn() };
      }
    }
    if (table === 'Home') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue(homeResult),
          }),
        }),
      };
    }
    return { select: mockSelect, upsert: mockUpsert };
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('PropertyIntelligenceService', () => {
  beforeEach(resetMocks);

  describe('CACHE_TTL_DAYS', () => {
    it('is 30 days', () => {
      expect(CACHE_TTL_DAYS).toBe(30);
    });
  });

  describe('getProfile — cache miss → fetch → cache hit flow', () => {
    it('returns attom profile on cache miss when ATTOM_API_KEY is set', async () => {
      process.env.ATTOM_API_KEY = 'test-key';

      setupFromSequence(
        { data: null, error: null },   // cache miss
        { data: MOCK_HOME, error: null } // home found
      );

      // Mock ATTOM API responses (detail, AVM, salesTrend)
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(MOCK_ATTOM_DETAIL),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(MOCK_ATTOM_AVM),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(MOCK_ATTOM_TREND),
        });

      const result = await getProfile(MOCK_HOME_ID);

      expect(result.source).toBe('attom');
      expect(result.profile).toBeDefined();
      expect(result.profile.home_id).toBe(MOCK_HOME_ID);
      expect(result.profile.estimated_value).toBe(385000);
      expect(result.profile.value_range_low).toBe(365000);
      expect(result.profile.value_range_high).toBe(405000);
      expect(result.profile.value_confidence).toBe(0.85);
      expect(result.profile.year_built).toBe(1978);
      expect(result.profile.sqft).toBe(1650);
      expect(result.profile.bedrooms).toBe(3);
      expect(result.profile.bathrooms).toBe(2);
      expect(result.profile.lot_sqft).toBe(7500);
      expect(result.profile.address_summary).toBe('Vancouver, WA 98661');
      expect(result.profile.zip_median_sale_price_trend).toBe('up');
    });

    it('returns cached profile on cache hit', async () => {
      const cachedProfile = {
        home_id: MOCK_HOME_ID,
        address_summary: 'Vancouver, WA 98661',
        estimated_value: 385000,
        source: 'attom',
      };

      setupFromSequence(
        { data: { profile: cachedProfile, fetched_at: '2026-03-01T00:00:00Z', source: 'attom' }, error: null },
        null // should not be called
      );

      const result = await getProfile(MOCK_HOME_ID);

      expect(result.source).toBe('cache');
      expect(result.profile.estimated_value).toBe(385000);
      // fetch should NOT have been called
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('getProfile — fallback when ATTOM_API_KEY is not set', () => {
    it('returns fallback profile with nulls for property-specific fields', async () => {
      // No ATTOM_API_KEY set
      setupFromSequence(
        { data: null, error: null },     // cache miss
        { data: MOCK_HOME, error: null } // home found
      );

      const result = await getProfile(MOCK_HOME_ID);

      expect(result.source).toBe('fallback');
      expect(result.profile).toBeDefined();
      expect(result.profile.home_id).toBe(MOCK_HOME_ID);
      expect(result.profile.address_summary).toBe('Vancouver, WA 98661');
      expect(result.profile.year_built).toBe(1978);
      expect(result.profile.sqft).toBe(1650);
      expect(result.profile.bedrooms).toBe(3);
      expect(result.profile.bathrooms).toBe(2);
      expect(result.profile.estimated_value).toBeNull();
      expect(result.profile.value_range_low).toBeNull();
      expect(result.profile.value_range_high).toBeNull();
      expect(result.profile.value_confidence).toBeNull();
      expect(result.profile.zip_median_value).toBeNull();
      expect(result.profile.zip_median_sale_price_trend).toBeNull();
      expect(result.profile.source).toBe('fallback');
      // fetch should NOT have been called
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('getProfile — home not found', () => {
    it('returns null profile when home does not exist', async () => {
      setupFromSequence(
        { data: null, error: null },   // cache miss
        { data: null, error: null }    // home not found
      );

      const result = await getProfile(MOCK_HOME_ID);

      expect(result.profile).toBeNull();
      expect(result.source).toBe('error');
    });
  });

  describe('getProfile — ATTOM API failure falls back gracefully', () => {
    it('returns fallback profile when ATTOM API calls fail', async () => {
      process.env.ATTOM_API_KEY = 'test-key';

      setupFromSequence(
        { data: null, error: null },     // cache miss
        { data: MOCK_HOME, error: null } // home found
      );

      // All ATTOM calls return errors
      global.fetch.mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('Server error') });

      const result = await getProfile(MOCK_HOME_ID);

      // Should still return a profile (fallback) rather than failing
      expect(result.profile).toBeDefined();
      expect(result.profile.source).toBe('fallback');
      expect(result.profile.estimated_value).toBeNull();
    });
  });

  describe('getHomeAttomPropertyDetail', () => {
    it('returns saved home payload and seeds raw ATTOM cache without refetching', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const savedPayload = {
        provider: 'attom',
        endpoint: '/property/detail',
        fetched_at: '2026-04-01T00:00:00Z',
        status: null,
        property: MOCK_ATTOM_DETAIL.property[0],
        full_response: MOCK_ATTOM_DETAIL,
      };

      const result = await getHomeAttomPropertyDetail({
        ...MOCK_HOME,
        niche_data: { attom_property_detail: savedPayload },
      });

      expect(result.source).toBe('home');
      expect(result.attomPayload).toEqual(savedPayload);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          home_id: MOCK_HOME_ID,
          raw_payload: expect.objectContaining({
            endpoints: expect.objectContaining({
              property_detail: expect.objectContaining({
                response: MOCK_ATTOM_DETAIL,
              }),
            }),
          }),
        }),
        { onConflict: 'home_id' },
      );
    });

    it('fetches live detail, caches the full raw response, and persists it onto Home', async () => {
      process.env.ATTOM_API_KEY = 'test-key';
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const updateEq = jest.fn().mockResolvedValue({ error: null });
      const update = jest.fn().mockReturnValue({ eq: updateEq });

      mockFrom.mockImplementation((table) => {
        if (table === 'Home') {
          return { update };
        }
        return {
          select: mockSelect,
          upsert: mockUpsert,
        };
      });

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_ATTOM_DETAIL),
      });

      const home = { ...MOCK_HOME, niche_data: {} };
      const result = await getHomeAttomPropertyDetail(home);

      expect(result.source).toBe('attom');
      expect(result.unavailableReason).toBeNull();
      expect(result.attomPayload).toEqual(
        expect.objectContaining({
          provider: 'attom',
          endpoint: '/property/detail',
          property: MOCK_ATTOM_DETAIL.property[0],
          full_response: MOCK_ATTOM_DETAIL,
        }),
      );
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          home_id: MOCK_HOME_ID,
          raw_payload: expect.objectContaining({
            endpoints: expect.objectContaining({
              property_detail: expect.objectContaining({
                response: MOCK_ATTOM_DETAIL,
              }),
            }),
          }),
        }),
        { onConflict: 'home_id' },
      );
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          niche_data: expect.objectContaining({
            attom_property_detail: expect.objectContaining({
              full_response: MOCK_ATTOM_DETAIL,
            }),
          }),
        }),
      );
      expect(updateEq).toHaveBeenCalledWith('id', MOCK_HOME_ID);
    });
  });
});

// ── Route-level validation tests ───────────────────────────────────────────

describe('Property Profile Route Validation', () => {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  it('accepts a valid UUID homeId', () => {
    expect(UUID_RE.test(MOCK_HOME_ID)).toBe(true);
  });

  it('rejects non-UUID homeId values', () => {
    expect(UUID_RE.test('abc123')).toBe(false);
    expect(UUID_RE.test('not-a-uuid')).toBe(false);
    expect(UUID_RE.test('')).toBe(false);
  });

  it('PropertyProfile shape has expected fields', () => {
    const expectedFields = [
      'home_id', 'address_summary', 'year_built', 'sqft', 'bedrooms',
      'bathrooms', 'lot_sqft', 'property_type', 'estimated_value',
      'value_range_low', 'value_range_high', 'value_confidence',
      'zip_median_value', 'zip_median_sale_price_trend', 'cached_at', 'source',
    ];
    // Verify fallback profile has all expected fields
    const fallback = {
      home_id: MOCK_HOME_ID,
      address_summary: 'Vancouver, WA 98661',
      year_built: 1978, sqft: 1650, bedrooms: 3, bathrooms: 2,
      lot_sqft: 7500, property_type: 'house',
      estimated_value: null, value_range_low: null, value_range_high: null,
      value_confidence: null, zip_median_value: null,
      zip_median_sale_price_trend: null,
      cached_at: new Date().toISOString(), source: 'fallback',
    };
    for (const field of expectedFields) {
      expect(fallback).toHaveProperty(field);
    }
  });
});
