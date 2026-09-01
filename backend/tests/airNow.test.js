/**
 * Tests for AirNow Air Quality Connector — cache flow, fallback,
 * normalisation, and timeout handling.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('../../config/supabaseAdmin', () => ({}));
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

// Mock global fetch
global.fetch = jest.fn();

const { fetchAQI, normaliseObservation, pickPrimary, PROVIDER, TTL_MINUTES } = require('../services/external/airNow');
const logger = require('../utils/logger');

// ── Test data ──────────────────────────────────────────────────────────────

const LAT = 45.6387;
const LNG = -122.6615;

const MOCK_AIRNOW_RESPONSE = [
  {
    DateObserved: '2026-03-07',
    HourObserved: 14,
    LocalTimeZone: 'PST',
    ReportingArea: 'Vancouver',
    StateCode: 'WA',
    Latitude: 45.6387,
    Longitude: -122.6615,
    ParameterName: 'PM2.5',
    AQI: 42,
    Category: { Number: 1, Name: 'Good' },
  },
  {
    DateObserved: '2026-03-07',
    HourObserved: 14,
    LocalTimeZone: 'PST',
    ReportingArea: 'Vancouver',
    StateCode: 'WA',
    Latitude: 45.6387,
    Longitude: -122.6615,
    ParameterName: 'O3',
    AQI: 28,
    Category: { Number: 1, Name: 'Good' },
  },
];

const MOCK_SMOKE_RESPONSE = [
  {
    DateObserved: '2026-08-15',
    HourObserved: 10,
    LocalTimeZone: 'PST',
    ReportingArea: 'Portland',
    StateCode: 'OR',
    Latitude: 45.5231,
    Longitude: -122.6765,
    ParameterName: 'PM2.5',
    AQI: 158,
    Category: { Number: 4, Name: 'Unhealthy' },
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function resetMocks() {
  jest.clearAllMocks();
  mockGetCache.mockReset();
  mockSetCache.mockReset();
  global.fetch.mockReset();
  delete process.env.AIRNOW_API_KEY;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AirNow Connector', () => {
  beforeEach(resetMocks);

  describe('constants', () => {
    it('uses AIRNOW_AQI provider name', () => {
      expect(PROVIDER).toBe('AIRNOW_AQI');
    });

    it('has 30-minute TTL', () => {
      expect(TTL_MINUTES).toBe(30);
    });
  });

  describe('fetchAQI — graceful fallback when no API key', () => {
    it('returns unavailable when AIRNOW_API_KEY is not set', async () => {
      const result = await fetchAQI(LAT, LNG);

      expect(result.aqi).toBeNull();
      expect(result.source).toBe('unavailable');
      expect(result.fetchedAt).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockGetCache).not.toHaveBeenCalled();
    });
  });

  describe('fetchAQI — cache hit', () => {
    it('returns cached AQI with source "cache"', async () => {
      process.env.AIRNOW_API_KEY = 'test-key';

      const cachedAqi = {
        aqi: 42,
        category: 'Good',
        pollutant: 'PM2.5',
        reporting_area: 'Vancouver',
        color: '#00E400',
      };
      mockGetCache.mockResolvedValue({
        payload: { normalized: cachedAqi },
        fetchedAt: '2026-03-07T14:00:00Z',
      });

      const result = await fetchAQI(LAT, LNG);

      expect(result.source).toBe('cache');
      expect(result.aqi).toEqual(cachedAqi);
      expect(result.fetchedAt).toBe('2026-03-07T14:00:00Z');
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockGetCache).toHaveBeenCalledWith('AIRNOW_AQI', `${LAT.toFixed(4)},${LNG.toFixed(4)}`);
    });
  });

  describe('fetchAQI — live fetch', () => {
    it('fetches from AirNow API on cache miss and caches result', async () => {
      process.env.AIRNOW_API_KEY = 'test-key';
      mockGetCache.mockResolvedValue(null);
      mockSetCache.mockResolvedValue(undefined);

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_AIRNOW_RESPONSE),
      });

      const result = await fetchAQI(LAT, LNG);

      expect(result.source).toBe('live');
      expect(result.aqi).toBeDefined();
      expect(result.aqi.aqi).toBe(42);
      expect(result.aqi.category).toBe('Good');
      expect(result.aqi.pollutant).toBe('PM2.5');
      expect(result.aqi.reporting_area).toBe('Vancouver');
      expect(result.aqi.color).toBe('#00E400');
      expect(result.fetchedAt).toBeDefined();

      // Verify cache was written
      expect(mockSetCache).toHaveBeenCalledWith(
        'AIRNOW_AQI',
        expect.any(String),
        expect.objectContaining({ raw: MOCK_AIRNOW_RESPONSE, normalized: expect.any(Object) }),
        30
      );
    });

    it('returns error on non-ok API response', async () => {
      process.env.AIRNOW_API_KEY = 'test-key';
      mockGetCache.mockResolvedValue(null);

      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await fetchAQI(LAT, LNG);

      expect(result.aqi).toBeNull();
      expect(result.source).toBe('error');
      expect(logger.warn).toHaveBeenCalledWith('AirNow API error', expect.any(Object));
    });
  });

  describe('fetchAQI — timeout handling', () => {
    it('returns error on fetch timeout', async () => {
      process.env.AIRNOW_API_KEY = 'test-key';
      mockGetCache.mockResolvedValue(null);

      // Simulate an AbortError
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      global.fetch.mockRejectedValue(abortError);

      const result = await fetchAQI(LAT, LNG);

      expect(result.aqi).toBeNull();
      expect(result.source).toBe('error');
      expect(result.fetchedAt).toBeDefined();
      expect(logger.warn).toHaveBeenCalledWith('AirNow fetch timeout', { lat: LAT, lng: LNG });
    });

    it('returns error on network failure', async () => {
      process.env.AIRNOW_API_KEY = 'test-key';
      mockGetCache.mockResolvedValue(null);

      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchAQI(LAT, LNG);

      expect(result.aqi).toBeNull();
      expect(result.source).toBe('error');
      expect(logger.error).toHaveBeenCalledWith('AirNow fetch error', expect.objectContaining({ error: 'Network error' }));
    });
  });

  describe('normaliseObservation', () => {
    it('normalises a Good observation', () => {
      const result = normaliseObservation(MOCK_AIRNOW_RESPONSE[0]);
      expect(result).toEqual({
        aqi: 42,
        category: 'Good',
        pollutant: 'PM2.5',
        reporting_area: 'Vancouver',
        color: '#00E400',
      });
    });

    it('normalises an Unhealthy observation', () => {
      const result = normaliseObservation(MOCK_SMOKE_RESPONSE[0]);
      expect(result).toEqual({
        aqi: 158,
        category: 'Unhealthy',
        pollutant: 'PM2.5',
        reporting_area: 'Portland',
        color: '#FF0000',
      });
    });

    it('handles missing category gracefully', () => {
      const result = normaliseObservation({ AQI: 50, ParameterName: 'O3' });
      expect(result.aqi).toBe(50);
      expect(result.category).toBe('Unknown');
      expect(result.color).toBe('#999999');
    });
  });

  describe('pickPrimary', () => {
    it('picks the observation with the highest AQI', () => {
      const observations = [
        { aqi: 28, category: 'Good', pollutant: 'O3', reporting_area: 'Vancouver', color: '#00E400' },
        { aqi: 42, category: 'Good', pollutant: 'PM2.5', reporting_area: 'Vancouver', color: '#00E400' },
      ];
      const primary = pickPrimary(observations);
      expect(primary.aqi).toBe(42);
      expect(primary.pollutant).toBe('PM2.5');
    });

    it('returns null for empty array', () => {
      expect(pickPrimary([])).toBeNull();
    });

    it('returns null for null input', () => {
      expect(pickPrimary(null)).toBeNull();
    });
  });
});
