/**
 * Tests for Neighborhood Pulse Composer — signal building, greeting,
 * overall status, graceful degradation, and full compose flow.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('../../config/supabaseAdmin', () => ({}));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock dependent services
const mockGetProfile = jest.fn();
jest.mock('../services/ai/propertyIntelligenceService', () => ({
  getProfile: (...args) => mockGetProfile(...args),
}));

const mockFetchAQI = jest.fn();
jest.mock('../services/external/airNow', () => ({
  fetchAQI: (...args) => mockFetchAQI(...args),
}));

const mockFetchAlerts = jest.fn();
jest.mock('../services/external/noaa', () => ({
  fetchAlerts: (...args) => mockFetchAlerts(...args),
}));

const mockGetNeighborhoodProfile = jest.fn();
jest.mock('../services/ai/neighborhoodProfileService', () => ({
  getProfile: (...args) => mockGetNeighborhoodProfile(...args),
}));

const mockGetNearbyBusinessCounts = jest.fn();
jest.mock('../services/ai/seededBusinessService', () => ({
  getNearbyBusinessCounts: (...args) => mockGetNearbyBusinessCounts(...args),
}));

// Mock supabaseAdmin.from for compose()
const supabaseAdmin = require('../../config/supabaseAdmin');

const {
  compose,
  buildGreeting,
  buildAqiSignal,
  buildWeatherSignals,
  buildSeasonalSignal,
  buildCommunityDensity,
  determineOverallStatus,
} = require('../services/ai/neighborhoodPulseComposer');

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
  map_center_lat: 45.6387,
  map_center_lng: -122.6615,
};

const MOCK_PROPERTY_PROFILE = {
  home_id: MOCK_HOME_ID,
  address_summary: 'Vancouver, WA 98661',
  year_built: 1978,
  sqft: 1650,
  bedrooms: 3,
  bathrooms: 2,
  lot_sqft: 7500,
  property_type: 'Single Family Residence',
  estimated_value: 385000,
  value_range_low: 365000,
  value_range_high: 405000,
  value_confidence: 0.85,
  zip_median_value: 372000,
  zip_median_sale_price_trend: 'up',
  cached_at: '2026-03-07T00:00:00Z',
  source: 'attom',
};

const MOCK_AQI_GOOD = {
  aqi: { aqi: 42, category: 'Good', pollutant: 'PM2.5', reporting_area: 'Vancouver', color: '#00E400' },
  source: 'live',
  fetchedAt: '2026-03-07T14:00:00Z',
};

const MOCK_AQI_UNHEALTHY = {
  aqi: { aqi: 158, category: 'Unhealthy', pollutant: 'PM2.5', reporting_area: 'Portland', color: '#FF0000' },
  source: 'live',
  fetchedAt: '2026-08-15T10:00:00Z',
};

const MOCK_NOAA_EMPTY = { alerts: [], source: 'live', fetchedAt: '2026-03-07T14:00:00Z' };

const MOCK_NOAA_ALERTS = {
  alerts: [
    {
      id: 'NWS-1',
      event: 'Winter Storm Warning',
      severity: 'severe',
      headline: 'Freezing rain expected overnight',
      description: 'Heavy freezing rain expected overnight into Tuesday morning.',
      instruction: 'Avoid travel if possible.',
      onset: '2026-01-15T20:00:00Z',
      expires: '2026-01-16T12:00:00Z',
      areas: ['Clark County'],
    },
  ],
  source: 'live',
  fetchedAt: '2026-01-15T14:00:00Z',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function resetMocks() {
  jest.clearAllMocks();
  mockGetProfile.mockReset();
  mockFetchAQI.mockReset();
  mockFetchAlerts.mockReset();
  mockGetNeighborhoodProfile.mockReset();
  mockGetNearbyBusinessCounts.mockReset();
  // Defaults: returns null (tests that need specific data set their own)
  mockGetNeighborhoodProfile.mockResolvedValue({ profile: null, source: 'error' });
  mockGetNearbyBusinessCounts.mockResolvedValue(null);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('NeighborhoodPulseComposer', () => {
  beforeEach(resetMocks);

  describe('buildGreeting', () => {
    it('returns "Good morning" before noon', () => {
      expect(buildGreeting(new Date('2026-03-07T08:00:00'))).toBe('Good morning');
    });

    it('returns "Good afternoon" between noon and 5pm', () => {
      expect(buildGreeting(new Date('2026-03-07T14:00:00'))).toBe('Good afternoon');
    });

    it('returns "Good evening" after 5pm', () => {
      expect(buildGreeting(new Date('2026-03-07T19:00:00'))).toBe('Good evening');
    });
  });

  describe('buildAqiSignal', () => {
    it('returns null when no AQI data', () => {
      expect(buildAqiSignal(null)).toBeNull();
      expect(buildAqiSignal({ aqi: null })).toBeNull();
    });

    it('builds low-priority signal for good AQI', () => {
      const signal = buildAqiSignal(MOCK_AQI_GOOD);
      expect(signal.signal_type).toBe('air_quality');
      expect(signal.priority).toBe(3);
      expect(signal.color).toBe('green');
      expect(signal.title).toContain('good');
    });

    it('builds high-priority signal for unhealthy AQI (>100)', () => {
      const signal = buildAqiSignal(MOCK_AQI_UNHEALTHY);
      expect(signal.signal_type).toBe('air_quality');
      expect(signal.priority).toBe(9);
      expect(signal.color).toBe('red');
      expect(signal.title).toContain('158');
    });
  });

  describe('buildWeatherSignals', () => {
    it('returns empty array when no alerts', () => {
      expect(buildWeatherSignals(MOCK_NOAA_EMPTY)).toEqual([]);
      expect(buildWeatherSignals(null)).toEqual([]);
    });

    it('builds high-priority signal for severe weather', () => {
      const signals = buildWeatherSignals(MOCK_NOAA_ALERTS);
      expect(signals).toHaveLength(1);
      expect(signals[0].signal_type).toBe('weather');
      expect(signals[0].priority).toBe(10);
      expect(signals[0].color).toBe('red');
      expect(signals[0].title).toContain('Freezing rain');
    });

    it('builds low-priority signal for minor weather', () => {
      const minor = {
        alerts: [{ severity: 'minor', headline: 'Wind Advisory', description: 'Gusty winds expected.' }],
        source: 'live',
        fetchedAt: '2026-03-07T14:00:00Z',
      };
      const signals = buildWeatherSignals(minor);
      expect(signals[0].priority).toBe(2);
      expect(signals[0].color).toBe('blue');
    });
  });

  describe('buildSeasonalSignal', () => {
    it('builds a seasonal signal with action', () => {
      const ctx = {
        primary_season: 'fall_prep',
        seasonal_tip: 'October is peak gutter season. Clean your gutters now.',
        home_specific_tip: 'Your 1978 home needs gutter cleaning.',
        first_action_nudge: {
          prompt: 'Need gutters cleaned? Post a gig in 30 seconds.',
          gig_category: 'Handyman',
        },
      };
      const signal = buildSeasonalSignal(ctx);
      expect(signal.signal_type).toBe('seasonal_suggestion');
      expect(signal.priority).toBe(7); // has home tip
      expect(signal.detail).toContain('1978');
      expect(signal.actions).toHaveLength(1);
      expect(signal.actions[0].type).toBe('create_gig');
    });

    it('uses generic tip when no home-specific tip', () => {
      const ctx = {
        primary_season: 'spring_cleanup',
        seasonal_tip: 'Spring cleanup season is here.',
        home_specific_tip: null,
        first_action_nudge: null,
      };
      const signal = buildSeasonalSignal(ctx);
      expect(signal.priority).toBe(6);
      expect(signal.detail).toBe('Spring cleanup season is here.');
      expect(signal.actions).toEqual([]);
    });
  });

  describe('buildCommunityDensity', () => {
    it('returns cold-start defaults', () => {
      const density = buildCommunityDensity();
      expect(density.neighbor_count).toBe(0);
      expect(density.invite_cta).toBe(true);
      expect(density.density_message).toContain('No Pantopus neighbors');
    });
  });

  describe('determineOverallStatus', () => {
    it('returns "alert" for priority >= 10', () => {
      expect(determineOverallStatus([{ priority: 10 }])).toBe('alert');
    });

    it('returns "advisory" for priority 7-9', () => {
      expect(determineOverallStatus([{ priority: 9 }])).toBe('advisory');
      expect(determineOverallStatus([{ priority: 7 }])).toBe('advisory');
    });

    it('returns "active" for priority 4-6', () => {
      expect(determineOverallStatus([{ priority: 6 }])).toBe('active');
    });

    it('returns "quiet" for priority < 4', () => {
      expect(determineOverallStatus([{ priority: 3 }])).toBe('quiet');
      expect(determineOverallStatus([])).toBe('quiet');
    });
  });

  describe('compose — full flow', () => {
    function setupSupabaseMock(homeResult) {
      supabaseAdmin.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue(homeResult),
          }),
        }),
      });
    }

    it('returns a valid pulse with all sources', async () => {
      setupSupabaseMock({ data: MOCK_HOME, error: null });
      mockGetProfile.mockResolvedValue({ profile: MOCK_PROPERTY_PROFILE, source: 'attom' });
      mockFetchAQI.mockResolvedValue(MOCK_AQI_GOOD);
      mockFetchAlerts.mockResolvedValue(MOCK_NOAA_EMPTY);
      mockGetNeighborhoodProfile.mockResolvedValue({ profile: { walk_score: 62, cached_at: '2026-03-07T00:00:00Z' }, source: 'live' });
      mockGetNearbyBusinessCounts.mockResolvedValue({ total: 12, by_category: { Handyman: 8, Cleaning: 4 } });

      const result = await compose({ homeId: MOCK_HOME_ID, userId: MOCK_USER_ID });

      expect(result.pulse).toBeDefined();
      expect(result.pulse.greeting).toBeDefined();
      expect(result.pulse.summary).toBeDefined();
      expect(result.pulse.overall_status).toBeDefined();
      expect(result.pulse.property).toBeDefined();
      expect(result.pulse.property.estimated_value).toBe(385000);
      expect(result.pulse.neighborhood).toBeDefined();
      expect(result.pulse.neighborhood.walk_score).toBe(62);
      expect(result.pulse.signals.length).toBeGreaterThan(0);
      // Should include local_services signal
      const localSvcSignal = result.pulse.signals.find((s) => s.signal_type === 'local_services');
      expect(localSvcSignal).toBeDefined();
      expect(localSvcSignal.title).toContain('12');
      expect(result.pulse.seasonal_context).toBeDefined();
      expect(result.pulse.seasonal_context.season).toBeDefined();
      // first_action_nudge should include gig_category and gig_title from seasonal engine
      const nudge = result.pulse.seasonal_context.first_action_nudge;
      expect(nudge).toBeDefined();
      expect(nudge.gig_category).toBeDefined();
      expect(nudge.gig_title).toBeDefined();
      expect(nudge.route).toBe('/gig-v2/new');
      expect(result.pulse.community_density.neighbor_count).toBe(0);
      expect(result.pulse.sources.length).toBeGreaterThan(0);
      expect(result.pulse.meta.computed_at).toBeDefined();
      expect(result.pulse.meta.partial_failures).toEqual([]);
    });

    it('returns pulse even when property and AQI are unavailable', async () => {
      setupSupabaseMock({ data: MOCK_HOME, error: null });
      mockGetProfile.mockResolvedValue({ profile: null, source: 'error' });
      mockFetchAQI.mockResolvedValue({ aqi: null, source: 'unavailable', fetchedAt: null });
      mockFetchAlerts.mockResolvedValue(MOCK_NOAA_EMPTY);

      const result = await compose({ homeId: MOCK_HOME_ID, userId: MOCK_USER_ID });

      expect(result.pulse).toBeDefined();
      expect(result.pulse.property).toBeNull();
      // Should still have seasonal signal
      expect(result.pulse.signals.some(s => s.signal_type === 'seasonal_suggestion')).toBe(true);
      expect(result.pulse.meta.partial_failures).toContain('property');
    });

    it('returns HOME_NOT_FOUND when home does not exist', async () => {
      setupSupabaseMock({ data: null, error: null });

      const result = await compose({ homeId: MOCK_HOME_ID, userId: MOCK_USER_ID });

      expect(result.error).toBe('HOME_NOT_FOUND');
    });

    it('escalates overall status to alert with severe weather', async () => {
      setupSupabaseMock({ data: MOCK_HOME, error: null });
      mockGetProfile.mockResolvedValue({ profile: MOCK_PROPERTY_PROFILE, source: 'attom' });
      mockFetchAQI.mockResolvedValue(MOCK_AQI_GOOD);
      mockFetchAlerts.mockResolvedValue(MOCK_NOAA_ALERTS);

      const result = await compose({ homeId: MOCK_HOME_ID, userId: MOCK_USER_ID });

      expect(result.pulse.overall_status).toBe('alert');
      expect(result.pulse.signals[0].priority).toBe(10);
    });

    it('escalates overall status to advisory with unhealthy AQI', async () => {
      setupSupabaseMock({ data: MOCK_HOME, error: null });
      mockGetProfile.mockResolvedValue({ profile: MOCK_PROPERTY_PROFILE, source: 'attom' });
      mockFetchAQI.mockResolvedValue(MOCK_AQI_UNHEALTHY);
      mockFetchAlerts.mockResolvedValue(MOCK_NOAA_EMPTY);

      const result = await compose({ homeId: MOCK_HOME_ID, userId: MOCK_USER_ID });

      expect(result.pulse.overall_status).toBe('advisory');
    });

    it('signals are sorted by priority descending', async () => {
      setupSupabaseMock({ data: MOCK_HOME, error: null });
      mockGetProfile.mockResolvedValue({ profile: MOCK_PROPERTY_PROFILE, source: 'attom' });
      mockFetchAQI.mockResolvedValue(MOCK_AQI_GOOD);
      mockFetchAlerts.mockResolvedValue(MOCK_NOAA_ALERTS);

      const result = await compose({ homeId: MOCK_HOME_ID, userId: MOCK_USER_ID });

      const priorities = result.pulse.signals.map(s => s.priority);
      for (let i = 1; i < priorities.length; i++) {
        expect(priorities[i]).toBeLessThanOrEqual(priorities[i - 1]);
      }
    });

    it('handles source failures gracefully via Promise.allSettled', async () => {
      setupSupabaseMock({ data: MOCK_HOME, error: null });
      mockGetProfile.mockRejectedValue(new Error('DB connection error'));
      mockFetchAQI.mockRejectedValue(new Error('Network timeout'));
      mockFetchAlerts.mockResolvedValue(MOCK_NOAA_EMPTY);

      const result = await compose({ homeId: MOCK_HOME_ID, userId: MOCK_USER_ID });

      // Pulse should still return despite failures
      expect(result.pulse).toBeDefined();
      expect(result.pulse.meta.partial_failures).toContain('property');
      expect(result.pulse.meta.partial_failures).toContain('airnow');
      // Seasonal signal should always be present
      expect(result.pulse.signals.some(s => s.signal_type === 'seasonal_suggestion')).toBe(true);
    });
  });
});
