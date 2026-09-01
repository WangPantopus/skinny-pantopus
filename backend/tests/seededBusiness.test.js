/**
 * Tests for Seeded Business Service — nearby business counts,
 * cache behaviour, and local services signal building.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockLimit = jest.fn();

jest.mock('../../config/supabaseAdmin', () => ({
  rpc: (...args) => mockRpc(...args),
  from: (...args) => mockFrom(...args),
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock cacheHelper
const mockGetCache = jest.fn();
const mockSetCache = jest.fn();
jest.mock('../services/external/cacheHelper', () => ({
  getCache: (...args) => mockGetCache(...args),
  setCache: (...args) => mockSetCache(...args),
}));

const {
  getNearbyBusinessCounts,
  getNearbyBusinesses,
  PROVIDER,
  TTL_MINUTES,
  DEFAULT_RADIUS_METERS,
} = require('../services/ai/seededBusinessService');

// Also test the signal builder from the composer
const {
  buildLocalServicesSignal,
} = require('../services/ai/neighborhoodPulseComposer');

// ── Test data ──────────────────────────────────────────────────────────────

const MOCK_LAT = 45.6387;
const MOCK_LNG = -122.6615;

const MOCK_RPC_RESPONSE = [
  { category: 'Handyman', cnt: 8 },
  { category: 'Cleaning', cnt: 4 },
  { category: 'Gardening', cnt: 3 },
  { category: 'Pet Care', cnt: 2 },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function resetMocks() {
  jest.clearAllMocks();
  mockGetCache.mockReset();
  mockSetCache.mockReset();
  mockRpc.mockReset();
  mockFrom.mockReset();
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('SeededBusinessService', () => {
  beforeEach(resetMocks);

  describe('constants', () => {
    it('uses SEEDED_BIZ_COUNTS provider name', () => {
      expect(PROVIDER).toBe('SEEDED_BIZ_COUNTS');
    });

    it('has 24-hour TTL', () => {
      expect(TTL_MINUTES).toBe(60 * 24);
    });

    it('defaults to ~5 miles radius', () => {
      expect(DEFAULT_RADIUS_METERS).toBe(8047);
    });
  });

  describe('getNearbyBusinessCounts — cache hit', () => {
    it('returns cached counts without calling RPC', async () => {
      const cachedResult = { total: 17, by_category: { 'Handyman': 8, 'Cleaning': 4, 'Gardening': 3, 'Pet Care': 2 } };
      mockGetCache.mockResolvedValue({ payload: cachedResult, fetchedAt: '2026-03-07T00:00:00Z' });

      const result = await getNearbyBusinessCounts({ latitude: MOCK_LAT, longitude: MOCK_LNG });

      expect(result).toEqual(cachedResult);
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe('getNearbyBusinessCounts — cache miss → RPC', () => {
    it('calls PostGIS RPC and returns aggregated counts', async () => {
      mockGetCache.mockResolvedValue(null); // cache miss
      mockRpc.mockResolvedValue({ data: MOCK_RPC_RESPONSE, error: null });
      mockSetCache.mockResolvedValue(undefined);

      const result = await getNearbyBusinessCounts({ latitude: MOCK_LAT, longitude: MOCK_LNG });

      expect(result).not.toBeNull();
      expect(result.total).toBe(17);
      expect(result.by_category['Handyman']).toBe(8);
      expect(result.by_category['Cleaning']).toBe(4);
      expect(result.by_category['Gardening']).toBe(3);
      expect(result.by_category['Pet Care']).toBe(2);

      // Verify RPC was called with correct params
      expect(mockRpc).toHaveBeenCalledWith('count_nearby_seeded_businesses', {
        p_lat: MOCK_LAT,
        p_lng: MOCK_LNG,
        p_radius_meters: DEFAULT_RADIUS_METERS,
      });

      // Verify result was cached
      expect(mockSetCache).toHaveBeenCalledTimes(1);
      expect(mockSetCache.mock.calls[0][0]).toBe(PROVIDER);
      expect(mockSetCache.mock.calls[0][3]).toBe(TTL_MINUTES);
    });

    it('returns null when RPC fails', async () => {
      mockGetCache.mockResolvedValue(null);
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC error' } });

      const result = await getNearbyBusinessCounts({ latitude: MOCK_LAT, longitude: MOCK_LNG });

      expect(result).toBeNull();
    });

    it('returns zero counts when no businesses nearby', async () => {
      mockGetCache.mockResolvedValue(null);
      mockRpc.mockResolvedValue({ data: [], error: null });

      const result = await getNearbyBusinessCounts({ latitude: MOCK_LAT, longitude: MOCK_LNG });

      expect(result).not.toBeNull();
      expect(result.total).toBe(0);
      expect(result.by_category).toEqual({});
    });

    it('uses custom radius when provided', async () => {
      mockGetCache.mockResolvedValue(null);
      mockRpc.mockResolvedValue({ data: MOCK_RPC_RESPONSE, error: null });
      mockSetCache.mockResolvedValue(undefined);

      await getNearbyBusinessCounts({ latitude: MOCK_LAT, longitude: MOCK_LNG, radiusMeters: 16000 });

      expect(mockRpc).toHaveBeenCalledWith('count_nearby_seeded_businesses', {
        p_lat: MOCK_LAT,
        p_lng: MOCK_LNG,
        p_radius_meters: 16000,
      });
    });
  });

  describe('getNearbyBusinessCounts — cache key grouping', () => {
    it('rounds coordinates to 2 decimal places for cache key', async () => {
      mockGetCache.mockResolvedValue(null);
      mockRpc.mockResolvedValue({ data: [], error: null });
      mockSetCache.mockResolvedValue(undefined);

      await getNearbyBusinessCounts({ latitude: 45.63871, longitude: -122.66151 });

      // Cache key should use rounded coords
      const calledPlaceKey = mockGetCache.mock.calls[0][1];
      expect(calledPlaceKey).toBe('45.64,-122.66,8047');
    });
  });
});

// ── Signal builder tests ───────────────────────────────────────────────────

describe('buildLocalServicesSignal', () => {
  it('returns null when no business counts', () => {
    expect(buildLocalServicesSignal(null)).toBeNull();
  });

  it('returns null when total is 0', () => {
    expect(buildLocalServicesSignal({ total: 0, by_category: {} })).toBeNull();
  });

  it('builds a signal with correct shape', () => {
    const signal = buildLocalServicesSignal({
      total: 17,
      by_category: { 'Handyman': 8, 'Cleaning': 4, 'Gardening': 3, 'Pet Care': 2 },
    });

    expect(signal).not.toBeNull();
    expect(signal.signal_type).toBe('local_services');
    expect(signal.priority).toBe(4);
    expect(signal.title).toBe('17 local service providers nearby');
    expect(signal.icon).toBe('briefcase');
    expect(signal.color).toBe('blue');
    expect(signal.actions).toHaveLength(1);
    expect(signal.actions[0].type).toBe('create_gig');
  });

  it('includes top 3 categories in detail', () => {
    const signal = buildLocalServicesSignal({
      total: 17,
      by_category: { 'Handyman': 8, 'Cleaning': 4, 'Gardening': 3, 'Pet Care': 2 },
    });

    expect(signal.detail).toContain('8 handyman');
    expect(signal.detail).toContain('4 cleaning');
    expect(signal.detail).toContain('3 gardening');
    expect(signal.detail).toContain('within 5 miles');
  });

  it('handles single category', () => {
    const signal = buildLocalServicesSignal({
      total: 5,
      by_category: { 'Handyman': 5 },
    });

    expect(signal.title).toBe('5 local service providers nearby');
    expect(signal.detail).toContain('5 handyman');
  });
});
