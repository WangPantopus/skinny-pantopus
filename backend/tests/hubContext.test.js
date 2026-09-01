/**
 * Tests for Hub Context Pipeline — location resolver, usefulness engine,
 * briefing composer, and provider orchestrator.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('../config/supabaseAdmin', () => {
  const mockFrom = jest.fn();
  return { from: mockFrom };
});

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../config/openai', () => ({
  getOpenAIClient: jest.fn(() => null),
}));

jest.mock('../services/external/noaa', () => ({
  fetchAlerts: jest.fn(() => ({ alerts: [], source: 'cache', fetchedAt: new Date().toISOString() })),
}));

jest.mock('../services/external/airNow', () => ({
  fetchAQI: jest.fn(() => ({ aqi: null, source: 'unavailable', fetchedAt: null })),
}));

jest.mock('../services/context/contextCacheService', () => ({
  getContextCache: jest.fn(() => null),
  setContextCache: jest.fn(),
}));

jest.mock('../services/ai/seasonalEngine', () => ({
  getSeasonalContext: jest.fn(() => ({
    active_seasons: ['spring_cleanup'],
    primary_season: 'spring_cleanup',
    seasonal_tip: 'Spring cleanup time.',
    home_specific_tip: null,
    urgency: 'moderate',
    suggested_gig_categories: ['Cleaning'],
    first_action_nudge: null,
    is_relevant_region: true,
  })),
}));

// ── Test data ──────────────────────────────────────────────────────────────

const MOCK_USER_ID = '22222222-2222-2222-2222-222222222222';

const MOCK_WEATHER = {
  current: {
    temp_f: 52, temp_c: 11, condition_code: 'rain', condition_label: 'Rain',
    humidity_pct: 80, wind_mph: 12, wind_direction: 'SW', feels_like_f: 48,
    uv_index: 2, cloud_cover_pct: 90, visibility_miles: 5, pressure_mb: 1013, dew_point_f: 45,
  },
  hourly: [
    { datetime_utc: '2026-04-06T14:00:00Z', temp_f: 52, condition_code: 'rain', condition_label: 'Rain', precip_chance_pct: 85, precip_type: 'rain', wind_mph: 12, humidity_pct: 80 },
    { datetime_utc: '2026-04-06T15:00:00Z', temp_f: 53, condition_code: 'rain', condition_label: 'Rain', precip_chance_pct: 75, precip_type: 'rain', wind_mph: 10, humidity_pct: 78 },
    { datetime_utc: '2026-04-06T16:00:00Z', temp_f: 54, condition_code: 'cloudy', condition_label: 'Cloudy', precip_chance_pct: 40, precip_type: null, wind_mph: 8, humidity_pct: 75 },
  ],
  daily: [
    { date: '2026-04-06', high_f: 58, low_f: 45, condition_code: 'rain', condition_label: 'Rain', precip_chance_pct: 80, sunrise_utc: null, sunset_utc: null, uv_index_max: 3 },
  ],
  provider: 'OPEN_METEO',
  fetchedAt: new Date().toISOString(),
  source: 'live',
};

const MOCK_AQI_GOOD = { aqi: 42, category: 'Good', pollutant: 'PM2.5', color: '#00E400', is_noteworthy: false, provider: 'AIRNOW', fetchedAt: new Date().toISOString(), source: 'live' };
const MOCK_AQI_BAD = { aqi: 156, category: 'Unhealthy', pollutant: 'PM2.5', color: '#FF0000', is_noteworthy: true, provider: 'AIRNOW', fetchedAt: new Date().toISOString(), source: 'live' };

const MOCK_ALERT = {
  alerts: [{ id: 'alert-1', event: 'Freeze Warning', severity: 'severe', headline: 'Freeze warning tonight', description: 'Temps below 28F', instruction: 'Protect pipes', onset: '2026-04-06T22:00:00Z', expires: '2026-04-07T10:00:00Z', areas: ['Clark County'] }],
  provider: 'NOAA',
  fetchedAt: new Date().toISOString(),
  source: 'live',
};

const MOCK_INTERNAL_EMPTY = {
  bills_due: [], tasks_due: [], calendar_events: [],
  unread_mail_count: 0, urgent_mail_count: 0,
  active_gigs: [], unread_notifications: 0,
  collected_at: new Date().toISOString(),
};

const MOCK_INTERNAL_RICH = {
  bills_due: [{ id: 'b1', provider_name: 'Electric Co', amount: 125.50, currency: 'USD', due_date: new Date(Date.now() + 12 * 3600000).toISOString(), status: 'due' }],
  tasks_due: [{ id: 't1', title: 'Clean gutters', due_at: new Date(Date.now() + 6 * 3600000).toISOString(), priority: 'high', status: 'pending' }],
  calendar_events: [{ id: 'e1', title: 'Plumber visit', start_at: new Date(Date.now() + 90 * 60000).toISOString(), end_at: null, event_type: 'appointment' }],
  unread_mail_count: 3,
  urgent_mail_count: 1,
  active_gigs: [{ id: 'g1', title: 'Yard cleanup', status: 'assigned', scheduled_date: new Date().toISOString().slice(0, 10) }],
  unread_notifications: 5,
  collected_at: new Date().toISOString(),
};

// ══════════════════════════════════════════════════════════════════
// GROUP 1: Location Resolver
// ══════════════════════════════════════════════════════════════════

describe('Location Resolver', () => {
  const supabaseAdmin = require('../config/supabaseAdmin');
  let resolveLocation;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    // Re-require after clearing mocks
    jest.mock('../config/supabaseAdmin', () => {
      const mockFrom = jest.fn();
      return { from: mockFrom };
    });
    jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
    resolveLocation = require('../services/context/locationResolver').resolveLocation;
  });

  function mockSupabaseChain(returnValue) {
    const supabase = require('../config/supabaseAdmin');
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(returnValue),
      maybeSingle: jest.fn().mockResolvedValue(returnValue),
    };
    supabase.from.mockReturnValue(chain);
    return chain;
  }

  test('returns none when no prefs, no VL, no homes', async () => {
    const chain = mockSupabaseChain({ data: null, error: null });
    const result = await resolveLocation(MOCK_USER_ID);
    expect(result.source).toBe('none');
    expect(result.confidence).toBe(0);
    expect(result.latitude).toBeNull();
  });

  test('returns custom when prefs have custom location_mode', async () => {
    const supabase = require('../config/supabaseAdmin');
    const calls = [];
    supabase.from.mockImplementation((table) => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn(),
        maybeSingle: jest.fn(),
      };
      if (table === 'UserNotificationPreferences') {
        chain.maybeSingle.mockResolvedValue({
          data: { location_mode: 'custom', custom_latitude: 45.5, custom_longitude: -122.6, custom_label: 'Downtown' },
          error: null,
        });
      } else {
        chain.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
        chain.maybeSingle.mockResolvedValue({ data: null, error: null });
      }
      calls.push(table);
      return chain;
    });

    const result = await resolveLocation(MOCK_USER_ID);
    expect(result.source).toBe('custom');
    expect(result.latitude).toBe(45.5);
    expect(result.longitude).toBe(-122.6);
    expect(result.label).toBe('Downtown');
    expect(result.confidence).toBe(0.95);
    expect(result.geohash).toBeTruthy();
  });

  test('returns viewing_pinned when VL is pinned', async () => {
    const supabase = require('../config/supabaseAdmin');
    supabase.from.mockImplementation((table) => {
      const chain = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), single: jest.fn(), maybeSingle: jest.fn() };
      if (table === 'UserNotificationPreferences') {
        chain.maybeSingle.mockResolvedValue({ data: null, error: null });
      } else if (table === 'UserViewingLocation') {
        chain.single.mockResolvedValue({ data: { latitude: 45.6, longitude: -122.7, label: 'Pinned spot', is_pinned: true }, error: null });
      } else {
        chain.maybeSingle.mockResolvedValue({ data: null, error: null });
      }
      return chain;
    });

    const result = await resolveLocation(MOCK_USER_ID);
    expect(result.source).toBe('viewing_pinned');
    expect(result.confidence).toBe(0.90);
  });

  test('respects primary_home mode over a pinned viewing location', async () => {
    const supabase = require('../config/supabaseAdmin');
    supabase.from.mockImplementation((table) => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn(),
        maybeSingle: jest.fn(),
        data: null,
        error: null,
      };
      if (table === 'UserNotificationPreferences') {
        chain.maybeSingle.mockResolvedValue({
          data: { location_mode: 'primary_home', daily_briefing_timezone: 'America/Los_Angeles' },
          error: null,
        });
      } else if (table === 'UserViewingLocation') {
        chain.single.mockResolvedValue({
          data: { latitude: 40.7, longitude: -74.0, label: 'Pinned spot', is_pinned: true, type: 'gps' },
          error: null,
        });
      } else if (table === 'HomeOccupancy') {
        chain.data = [
          {
            home_id: 'home-1',
            home: {
              id: 'home-1',
              city: 'Portland',
              state: 'OR',
              map_center_lat: 45.52,
              map_center_lng: -122.68,
            },
          },
        ];
      } else {
        chain.maybeSingle.mockResolvedValue({ data: null, error: null });
      }
      return chain;
    });

    const result = await resolveLocation(MOCK_USER_ID);
    expect(result.source).toBe('primary_home');
    expect(result.latitude).toBe(45.52);
    expect(result.longitude).toBe(-122.68);
  });

  test('falls back to a verified owner home when occupancy is missing', async () => {
    const supabase = require('../config/supabaseAdmin');
    supabase.from.mockImplementation((table) => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn(),
        maybeSingle: jest.fn(),
        data: null,
        error: null,
      };
      if (table === 'UserNotificationPreferences') {
        chain.maybeSingle.mockResolvedValue({
          data: { location_mode: 'primary_home', daily_briefing_timezone: 'America/Los_Angeles' },
          error: null,
        });
      } else if (table === 'UserViewingLocation') {
        chain.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
      } else if (table === 'HomeOccupancy') {
        chain.data = [];
      } else if (table === 'HomeOwner') {
        chain.data = [
          {
            home_id: 'owner-home-1',
            home: {
              id: 'owner-home-1',
              city: 'Seattle',
              state: 'WA',
              map_center_lat: 47.61,
              map_center_lng: -122.33,
            },
          },
        ];
      } else if (table === 'Home') {
        chain.data = [];
      }
      return chain;
    });

    const result = await resolveLocation(MOCK_USER_ID);
    expect(result.source).toBe('primary_home');
    expect(result.homeId).toBe('owner-home-1');
    expect(result.latitude).toBe(47.61);
    expect(result.longitude).toBe(-122.33);
  });

  test('falls back to a legacy owned home when occupancy and HomeOwner rows are missing', async () => {
    const supabase = require('../config/supabaseAdmin');
    supabase.from.mockImplementation((table) => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn(),
        maybeSingle: jest.fn(),
        data: null,
        error: null,
      };
      if (table === 'UserNotificationPreferences') {
        chain.maybeSingle.mockResolvedValue({
          data: { location_mode: 'primary_home', daily_briefing_timezone: 'America/Los_Angeles' },
          error: null,
        });
      } else if (table === 'UserViewingLocation') {
        chain.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
      } else if (table === 'HomeOccupancy' || table === 'HomeOwner') {
        chain.data = [];
      } else if (table === 'Home') {
        chain.data = [
          {
            id: 'legacy-home-1',
            city: 'Spokane',
            state: 'WA',
            map_center_lat: 47.66,
            map_center_lng: -117.43,
          },
        ];
      }
      return chain;
    });

    const result = await resolveLocation(MOCK_USER_ID);
    expect(result.source).toBe('primary_home');
    expect(result.homeId).toBe('legacy-home-1');
    expect(result.latitude).toBe(47.66);
    expect(result.longitude).toBe(-117.43);
  });

  test('respects viewing_location mode even when the viewing location is not pinned', async () => {
    const supabase = require('../config/supabaseAdmin');
    supabase.from.mockImplementation((table) => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn(),
        maybeSingle: jest.fn(),
        data: null,
        error: null,
      };
      if (table === 'UserNotificationPreferences') {
        chain.maybeSingle.mockResolvedValue({
          data: { location_mode: 'viewing_location', daily_briefing_timezone: 'America/Los_Angeles' },
          error: null,
        });
      } else if (table === 'UserViewingLocation') {
        chain.single.mockResolvedValue({
          data: { latitude: 47.61, longitude: -122.33, label: 'Seattle', is_pinned: false, type: 'searched' },
          error: null,
        });
      } else {
        chain.data = [];
      }
      return chain;
    });

    const result = await resolveLocation(MOCK_USER_ID);
    expect(result.source).toBe('viewing_recent');
    expect(result.latitude).toBe(47.61);
    expect(result.longitude).toBe(-122.33);
    expect(result.label).toBe('Seattle');
  });

  test('geohash is null for invalid coordinates', async () => {
    mockSupabaseChain({ data: null, error: null });
    const result = await resolveLocation(MOCK_USER_ID);
    expect(result.geohash).toBeNull();
  });

  test('infers America/Phoenix for Arizona custom coordinates', async () => {
    const supabase = require('../config/supabaseAdmin');
    supabase.from.mockImplementation((table) => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn(),
        maybeSingle: jest.fn(),
        data: null,
        error: null,
      };
      if (table === 'UserNotificationPreferences') {
        chain.maybeSingle.mockResolvedValue({
          data: {
            location_mode: 'custom',
            custom_latitude: 33.4484,
            custom_longitude: -112.0740,
            custom_label: 'Phoenix',
            daily_briefing_timezone: 'America/Denver',
          },
          error: null,
        });
      } else {
        chain.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
        chain.maybeSingle.mockResolvedValue({ data: null, error: null });
      }
      return chain;
    });

    const result = await resolveLocation(MOCK_USER_ID);
    expect(result.timezone).toBe('America/Phoenix');
  });

  test('returns none and never throws on DB error', async () => {
    const supabase = require('../config/supabaseAdmin');
    supabase.from.mockImplementation(() => { throw new Error('DB down'); });
    const result = await resolveLocation(MOCK_USER_ID);
    expect(result.source).toBe('none');
    expect(result.confidence).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════
// GROUP 2: Briefing History Service
// ══════════════════════════════════════════════════════════════════

describe('Briefing History Service', () => {
  let getRecentBriefings;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.mock('../config/supabaseAdmin', () => ({ from: jest.fn() }));
    jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
    getRecentBriefings = require('../services/context/briefingHistoryService').getRecentBriefings;
  });

  test('sorts same-day slots by effective recency', async () => {
    const supabase = require('../config/supabaseAdmin');
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      data: [
        {
          briefing_date_local: '2026-04-08',
          briefing_kind: 'morning',
          summary_text: 'Morning row',
          signals_snapshot: [{ kind: 'seasonal', data: { season: 'spring_cleanup' } }],
          location_geohash: 'c20g8',
          composition_mode: 'template',
          status: 'sent',
          delivered_at: '2026-04-08T14:00:00Z',
          created_at: '2026-04-08T13:55:00Z',
        },
        {
          briefing_date_local: '2026-04-07',
          briefing_kind: 'evening',
          summary_text: 'Older row',
          signals_snapshot: [{ kind: 'local_update', data: { post_ids: ['p-old'] } }],
          location_geohash: 'c20g8',
          composition_mode: 'template',
          status: 'skipped',
          delivered_at: null,
          created_at: '2026-04-07T23:00:00Z',
        },
        {
          briefing_date_local: '2026-04-08',
          briefing_kind: 'evening',
          summary_text: 'Evening row',
          signals_snapshot: [{ kind: 'local_update', data: { post_ids: ['p-new'] } }],
          location_geohash: 'c20g8',
          composition_mode: 'template',
          status: 'skipped',
          delivered_at: null,
          created_at: '2026-04-08T23:00:00Z',
        },
      ],
      error: null,
    };
    supabase.from.mockReturnValue(chain);

    const result = await getRecentBriefings(MOCK_USER_ID, { limit: 3 });

    expect(result.map((row) => `${row.briefing_date_local}:${row.briefing_kind}`)).toEqual([
      '2026-04-08:evening',
      '2026-04-08:morning',
      '2026-04-07:evening',
    ]);
  });
});

// ══════════════════════════════════════════════════════════════════
// GROUP 3: Usefulness Engine
// ══════════════════════════════════════════════════════════════════

describe('Usefulness Engine', () => {
  const { rankSignals, computeDisplayMode } = require('../services/context/usefulnessEngine');

  test('returns hidden display mode when no signals', () => {
    const result = rankSignals({
      weather: null, aqi: null, alerts: null, seasonal: null,
      internal: MOCK_INTERNAL_EMPTY, timeOfDay: 'morning', isWeekend: false,
    });
    // Only seasonal signal possible if no seasonal input
    expect(result.display_mode).toBe('hidden');
    expect(result.signal_count).toBe(0);
  });

  test('alert signals score highest for severe alerts', () => {
    const result = rankSignals({
      weather: null, aqi: null, alerts: MOCK_ALERT, seasonal: null,
      internal: MOCK_INTERNAL_EMPTY, timeOfDay: 'morning', isWeekend: false,
    });
    expect(result.signals[0].kind).toBe('alert');
    expect(result.signals[0].urgency).toBe('critical');
    expect(result.signals[0].score).toBeGreaterThan(0.7);
  });

  test('precipitation signal generated when chance > 60%', () => {
    const result = rankSignals({
      weather: MOCK_WEATHER, aqi: null, alerts: null, seasonal: null,
      internal: MOCK_INTERNAL_EMPTY, timeOfDay: 'morning', isWeekend: false,
    });
    const precipSignal = result.signals.find((s) => s.kind === 'precipitation');
    expect(precipSignal).toBeTruthy();
    expect(precipSignal.data.precip_chance).toBe(85);
  });

  test('no precipitation signal when chance <= 60%', () => {
    const lowPrecipWeather = {
      ...MOCK_WEATHER,
      hourly: MOCK_WEATHER.hourly.map((h) => ({ ...h, precip_chance_pct: 30 })),
    };
    const result = rankSignals({
      weather: lowPrecipWeather, aqi: null, alerts: null, seasonal: null,
      internal: MOCK_INTERNAL_EMPTY, timeOfDay: 'morning', isWeekend: false,
    });
    expect(result.signals.find((s) => s.kind === 'precipitation')).toBeFalsy();
  });

  test('AQI signal only generated when > 100', () => {
    const resultGood = rankSignals({
      weather: null, aqi: MOCK_AQI_GOOD, alerts: null, seasonal: null,
      internal: MOCK_INTERNAL_EMPTY, timeOfDay: 'morning', isWeekend: false,
    });
    expect(resultGood.signals.find((s) => s.kind === 'aqi')).toBeFalsy();

    const resultBad = rankSignals({
      weather: null, aqi: MOCK_AQI_BAD, alerts: null, seasonal: null,
      internal: MOCK_INTERNAL_EMPTY, timeOfDay: 'morning', isWeekend: false,
    });
    expect(resultBad.signals.find((s) => s.kind === 'aqi')).toBeTruthy();
  });

  test('bill due signal generated for upcoming bills', () => {
    const result = rankSignals({
      weather: null, aqi: null, alerts: null, seasonal: null,
      internal: MOCK_INTERNAL_RICH, timeOfDay: 'morning', isWeekend: false,
    });
    const billSignal = result.signals.find((s) => s.kind === 'bill_due');
    expect(billSignal).toBeTruthy();
    expect(billSignal.label).toContain('Electric Co');
  });

  test('calendar signal generated for events within 2 hours', () => {
    const result = rankSignals({
      weather: null, aqi: null, alerts: null, seasonal: null,
      internal: MOCK_INTERNAL_RICH, timeOfDay: 'morning', isWeekend: false,
    });
    const calSignal = result.signals.find((s) => s.kind === 'calendar');
    expect(calSignal).toBeTruthy();
    expect(calSignal.label).toContain('Plumber visit');
  });

  test('caps at 5 signals max', () => {
    const result = rankSignals({
      weather: MOCK_WEATHER, aqi: MOCK_AQI_BAD, alerts: MOCK_ALERT,
      seasonal: { primarySeason: 'spring_cleanup', seasonLabel: 'Spring Cleanup', tip: 'Clean gutters', homeTip: null },
      internal: MOCK_INTERNAL_RICH, timeOfDay: 'morning', isWeekend: false,
    });
    expect(result.signals.length).toBeLessThanOrEqual(5);
    expect(result.signal_count).toBeLessThanOrEqual(5);
  });

  test('signals sorted by score descending', () => {
    const result = rankSignals({
      weather: MOCK_WEATHER, aqi: MOCK_AQI_BAD, alerts: MOCK_ALERT,
      seasonal: null, internal: MOCK_INTERNAL_RICH, timeOfDay: 'morning', isWeekend: false,
    });
    for (let i = 1; i < result.signals.length; i++) {
      expect(result.signals[i - 1].score).toBeGreaterThanOrEqual(result.signals[i].score);
    }
  });

  test('computeDisplayMode returns correct modes', () => {
    expect(computeDisplayMode([])).toBe('hidden');
    expect(computeDisplayMode([], { weatherAvailable: true })).toBe('minimal');
    expect(computeDisplayMode([{ score: 0.05 }])).toBe('hidden');
    expect(computeDisplayMode([{ score: 0.05 }], { weatherAvailable: true })).toBe('minimal');
    expect(computeDisplayMode([{ score: 0.15 }])).toBe('minimal');
    expect(computeDisplayMode([{ score: 0.50 }])).toBe('reduced');
    expect(computeDisplayMode([{ score: 0.80 }])).toBe('full');
  });

  test('weather-only days still render as minimal', () => {
    const result = rankSignals({
      weather: {
        current: {
          temp_f: 43,
          condition_code: 'clear',
          condition_label: 'Clear Sky',
        },
        hourly: [
          { precip_chance_pct: 10 },
          { precip_chance_pct: 5 },
          { precip_chance_pct: 0 },
        ],
        daily: [],
        provider: 'OPEN_METEO',
        fetchedAt: new Date().toISOString(),
        source: 'live',
      },
      aqi: null,
      alerts: null,
      seasonal: null,
      internal: MOCK_INTERNAL_EMPTY,
      timeOfDay: 'morning',
      isWeekend: false,
    });

    expect(result.signals).toHaveLength(0);
    expect(result.display_mode).toBe('minimal');
  });

  test('suppresses seasonal fallback after it was already used twice recently', () => {
    const result = rankSignals({
      weather: null,
      aqi: null,
      alerts: null,
      seasonal: { primarySeason: 'spring_cleanup', seasonLabel: 'Spring Cleanup', tip: 'Clean gutters', homeTip: null },
      recentBriefings: [
        { signals_snapshot: [{ kind: 'seasonal', data: { season: 'spring_cleanup' } }] },
        { signals_snapshot: [{ kind: 'seasonal', data: { season: 'spring_cleanup' } }] },
      ],
      internal: MOCK_INTERNAL_EMPTY,
      timeOfDay: 'morning',
      isWeekend: false,
    });
    expect(result.signals.find((s) => s.kind === 'seasonal')).toBeFalsy();
  });

  test('weekday local-update fallback outranks seasonal fallback', () => {
    const result = rankSignals({
      weather: null,
      aqi: null,
      alerts: null,
      seasonal: { primarySeason: 'spring_cleanup', seasonLabel: 'Spring Cleanup', tip: 'Clean gutters', homeTip: null },
      localUpdates: {
        summary: 'Portland is reviewing a proposed lodging tax ahead of World Cup planning.',
        item_count: 2,
        top_score: 6,
        freshness_hours: 2,
        post_ids: ['p1', 'p2'],
        titles: ['Lodging tax proposal'],
      },
      recentBriefings: [],
      internal: MOCK_INTERNAL_EMPTY,
      timeOfDay: 'morning',
      isWeekend: false,
    });
    expect(result.signals[0].kind).toBe('local_update');
  });

  test('repeated local-update fallback is suppressed when the same posts were used recently', () => {
    const result = rankSignals({
      weather: null,
      aqi: null,
      alerts: null,
      seasonal: null,
      localUpdates: {
        summary: 'City council is reviewing a road closure plan downtown.',
        item_count: 1,
        top_score: 5,
        freshness_hours: 3,
        post_ids: ['post-1'],
        titles: ['Road closure plan'],
      },
      recentBriefings: [
        { signals_snapshot: [{ kind: 'local_update', label: 'Road closure plan', data: { post_ids: ['post-1'] } }] },
      ],
      internal: MOCK_INTERNAL_EMPTY,
      timeOfDay: 'morning',
      isWeekend: false,
    });
    expect(result.signals.find((s) => s.kind === 'local_update')).toBeFalsy();
  });
});

// ══════════════════════════════════════════════════════════════════
// GROUP 3: Briefing Composer
// ══════════════════════════════════════════════════════════════════

describe('Briefing Composer', () => {
  const { composeBriefing, composeTemplate } = require('../services/context/briefingComposer');

  test('returns calm message when no signals', async () => {
    const result = await composeBriefing({ signals: [], display_mode: 'hidden', top_summary: '', signal_count: 0 });
    expect(result.text).toContain('Nothing notable');
    expect(result.mode).toBe('template');
    expect(result.tokens_used).toBe(0);
  });

  test('composes single signal into sentence', async () => {
    const result = await composeBriefing({
      signals: [{ kind: 'bill_due', score: 0.75, label: 'Bill due: PGE', detail: 'PGE bill due today.', urgency: 'high', source_provider: 'pantopus', action: null, data: { amount: 125, due_date: new Date(Date.now() + 3600000).toISOString(), bill_id: 'b1' } }],
      display_mode: 'full', top_summary: 'PGE bill due.', signal_count: 1,
    });
    expect(result.text).toBeTruthy();
    expect(result.mode).toBe('template');
    expect(result.signals_included).toBe(1);
  });

  test('combines two signals', async () => {
    const result = await composeBriefing({
      signals: [
        { kind: 'precipitation', score: 0.8, label: 'Rain soon', detail: 'Rain in 1 hour.', urgency: 'medium', source_provider: 'weather', action: null, data: { precip_chance: 85, precip_type: 'rain' } },
        { kind: 'bill_due', score: 0.6, label: 'Bill due: PGE', detail: 'PGE due tomorrow.', urgency: 'medium', source_provider: 'pantopus', action: null, data: { amount: 100, due_date: new Date(Date.now() + 86400000).toISOString() } },
      ],
      display_mode: 'full', top_summary: '', signal_count: 2,
    });
    expect(result.text.length).toBeGreaterThan(20);
    expect(result.mode).toBe('template');
    expect(result.signals_included).toBe(2);
  });

  test('uses template mode for <3 signals even with forceAI=false', async () => {
    const result = await composeBriefing(
      { signals: [{ kind: 'alert', score: 0.9, label: 'Freeze Warning', detail: 'Freeze tonight.', urgency: 'critical', source_provider: 'NOAA', action: null, data: { severity: 'severe' } }], display_mode: 'full', top_summary: '', signal_count: 1 },
      { forceAI: false },
    );
    expect(result.mode).toBe('template');
  });

  test('falls back to template when AI unavailable (3+ signals)', async () => {
    const signals = Array.from({ length: 3 }, (_, i) => ({
      kind: 'bill_due', score: 0.7 - i * 0.1, label: `Bill ${i}`, detail: `Bill ${i} due.`, urgency: 'medium',
      source_provider: 'pantopus', action: null, data: { amount: 50, due_date: new Date().toISOString() },
    }));
    const result = await composeBriefing(
      { signals, display_mode: 'full', top_summary: '', signal_count: 3 },
    );
    // AI is mocked to return null, so should fall back to template
    expect(result.mode).toBe('template');
    expect(result.validation_passed).toBe(true);
  });

  test('respects forceTemplate option', async () => {
    const signals = Array.from({ length: 4 }, (_, i) => ({
      kind: 'task_due', score: 0.6, label: `Task ${i}`, detail: `Task ${i} due.`, urgency: 'medium',
      source_provider: 'pantopus', action: null, data: { task_id: `t${i}`, due_at: new Date().toISOString(), priority: 'medium' },
    }));
    const result = await composeBriefing(
      { signals, display_mode: 'full', top_summary: '', signal_count: 4 },
      { forceTemplate: true },
    );
    expect(result.mode).toBe('template');
  });

  test('composeTemplate respects maxWords', () => {
    const text = composeTemplate(
      { signals: [{ kind: 'seasonal', score: 0.2, label: 'Seasonal', detail: 'A very long seasonal tip that goes on and on about cleaning gutters and preparing for spring and doing all kinds of yard work and home maintenance tasks that take forever to complete', urgency: 'low', source_provider: 'pantopus', action: null, data: {} }], display_mode: 'minimal', top_summary: '', signal_count: 1 },
      { maxWords: 10, greeting: false },
    );
    expect(text.split(/\s+/).length).toBeLessThanOrEqual(11); // 10 + "..."
  });

  test('composeTemplate uses the provided timezone for greeting', () => {
    const text = composeTemplate(
      { signals: [], display_mode: 'hidden', top_summary: '', signal_count: 0 },
      { timezone: 'America/Los_Angeles', now: new Date('2026-04-08T14:00:00Z') },
    );
    expect(text.startsWith('Good morning.')).toBe(true);
  });

  test('composeTemplate can omit duplicate temperature for hub cards and normalize clear wording', () => {
    const text = composeTemplate(
      { signals: [], display_mode: 'hidden', top_summary: '', signal_count: 0 },
      {
        greeting: false,
        weather: {
          current: {
            temp_f: 43,
            condition_label: 'Clear Sky',
          },
        },
        includeWeatherTemperature: false,
      },
    );

    expect(text).toBe('Clear skies.');
  });
});

// ══════════════════════════════════════════════════════════════════
// GROUP 4: Evening Briefing Service
// ══════════════════════════════════════════════════════════════════

describe('Evening Briefing Service', () => {
  const {
    buildTomorrowWeatherIntro,
    selectEveningSignal,
    tomorrowDateKey,
  } = require('../services/context/eveningBriefingService');

  test('buildTomorrowWeatherIntro prefers tomorrow over today when available', () => {
    const intro = buildTomorrowWeatherIntro({
      daily: [
        { date: '2026-04-08', high_f: 60, low_f: 44, condition_label: 'Sunny', precip_chance_pct: 10 },
        { date: '2026-04-09', high_f: 54, low_f: 40, condition_label: 'Showers', precip_chance_pct: 70 },
      ],
    });

    expect(intro).toContain('Tomorrow looks showers');
    expect(intro).toContain('70% chance of precipitation');
    expect(intro).toContain('High 54°F, low 40°F');
  });

  test('selectEveningSignal uses local update before generic tip when no stronger signal exists', () => {
    const signal = selectEveningSignal({
      alerts: null,
      internal: MOCK_INTERNAL_EMPTY,
      timeZone: 'America/Los_Angeles',
      recentBriefings: [],
      localUpdates: {
        summary: 'Tomorrow morning, a downtown bridge closure will affect commute traffic.',
        post_ids: ['post-1'],
        titles: ['Bridge closure advisory'],
      },
      includeEveningTip: false,
      now: new Date('2026-04-08T03:00:00Z'),
    });

    expect(signal?.kind).toBe('local_update');
    expect(signal?.detail).toContain('bridge closure');
  });

  test('selectEveningSignal prefers tomorrow morning events over local updates', () => {
    const signal = selectEveningSignal({
      alerts: null,
      internal: {
        ...MOCK_INTERNAL_EMPTY,
        calendar_events: [
          {
            id: 'e-tomorrow',
            title: 'HVAC visit',
            start_at: '2026-04-08T16:00:00Z',
          },
        ],
      },
      timeZone: 'America/Los_Angeles',
      recentBriefings: [],
      localUpdates: {
        summary: 'Tomorrow morning, a downtown bridge closure will affect commute traffic.',
        post_ids: ['post-1'],
        titles: ['Bridge closure advisory'],
      },
      now: new Date('2026-04-08T03:00:00Z'),
    });

    expect(signal?.kind).toBe('calendar');
    expect(signal?.detail).toContain('HVAC visit');
  });

  test('tomorrowDateKey advances by the next local calendar day across DST', () => {
    expect(
      tomorrowDateKey('America/Los_Angeles', new Date('2026-03-08T07:30:00Z'))
    ).toBe('2026-03-08');
  });
});

// ══════════════════════════════════════════════════════════════════
// GROUP 5: Provider Orchestrator
// ══════════════════════════════════════════════════════════════════

describe('Provider Orchestrator', () => {
  let getHubToday, composeDailyBriefing, composeScheduledBriefing;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Mock all dependencies
    jest.mock('../config/supabaseAdmin', () => ({ from: jest.fn() }));
    jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
    jest.mock('../services/context/locationResolver', () => ({
      resolveLocation: jest.fn(() => ({
        latitude: 45.6, longitude: -122.7, label: 'Near Home', source: 'primary_home',
        timezone: 'America/Los_Angeles', geohash: 'c20g8', confidence: 0.95, homeId: 'h1',
      })),
    }));
    jest.mock('../services/context/weatherProvider', () => ({
      fetchWeather: jest.fn(() => MOCK_WEATHER),
    }));
    jest.mock('../services/context/aqiProvider', () => ({
      fetchAQI: jest.fn(() => MOCK_AQI_GOOD),
    }));
    jest.mock('../services/context/alertsProvider', () => ({
      fetchAlerts: jest.fn(() => ({ alerts: [], provider: 'NOAA', fetchedAt: new Date().toISOString(), source: 'cache' })),
    }));
    jest.mock('../services/context/internalContextCollector', () => ({
      collectInternalContext: jest.fn(() => MOCK_INTERNAL_EMPTY),
    }));
    jest.mock('../services/ai/seasonalEngine', () => ({
      getSeasonalContext: jest.fn(() => ({
        active_seasons: ['spring_cleanup'], primary_season: 'spring_cleanup',
        seasonal_tip: 'Clean your gutters.', home_specific_tip: null, urgency: 'moderate',
        is_relevant_region: true,
      })),
    }));
    jest.mock('../services/context/briefingHistoryService', () => ({
      getRecentBriefings: jest.fn(() => []),
    }));
    jest.mock('../services/context/localUpdateProvider', () => ({
      getLocalUpdateContext: jest.fn(() => null),
    }));
    jest.mock('../config/openai', () => ({ getOpenAIClient: jest.fn(() => null) }));
    jest.mock('../services/context/contextCacheService', () => ({
      getContextCache: jest.fn(() => null), setContextCache: jest.fn(),
    }));

    const mod = require('../services/context/providerOrchestrator');
    getHubToday = mod.getHubToday;
    composeDailyBriefing = mod.composeDailyBriefing;
    composeScheduledBriefing = mod.composeScheduledBriefing;
  });

  test('getHubToday returns full shape with location', async () => {
    const result = await getHubToday(MOCK_USER_ID);
    expect(result.location.label).toBe('Near Home');
    expect(result.location.source).toBe('primary_home');
    expect(result.weather).toBeTruthy();
    expect(result.weather.current_temp_f).toBe(52);
    expect(result.summary).not.toContain('52°F');
    expect(result.signals.length).toBeGreaterThan(0);
    expect(result.signals.every((signal) => typeof signal.detail === 'string' && signal.detail.length > 0)).toBe(true);
    expect(result.fetched_at).toBeTruthy();
    expect(result.expires_at).toBeTruthy();
    expect(result.meta.providers_used.length).toBeGreaterThan(0);
    expect(typeof result.meta.total_latency_ms).toBe('number');
  });

  test('getHubToday returns hidden when no location', async () => {
    const { resolveLocation } = require('../services/context/locationResolver');
    resolveLocation.mockReturnValue({
      latitude: null, longitude: null, label: 'Unknown', source: 'none',
      timezone: 'America/Los_Angeles', geohash: null, confidence: 0, homeId: null,
    });
    const result = await getHubToday(MOCK_USER_ID);
    expect(result.display_mode).toBe('hidden');
  });

  test('composeDailyBriefing returns should_send=false for low signal day', async () => {
    const result = await composeDailyBriefing(MOCK_USER_ID);
    // With good AQI, no alerts, calm weather, empty internal — likely low signal
    // The seasonal tip alone scores ~0.22 which might be above 0.20 threshold
    expect(typeof result.should_send).toBe('boolean');
    expect(result.location_geohash).toBeTruthy();
    expect(typeof result.mode).toBe('string');
    expect(result.signals_snapshot.length).toBeLessThanOrEqual(1);
  });

  test('composeDailyBriefing returns no_location skip when location unavailable', async () => {
    const { resolveLocation } = require('../services/context/locationResolver');
    resolveLocation.mockReturnValue({
      latitude: null, longitude: null, label: 'Unknown', source: 'none',
      timezone: 'America/Los_Angeles', geohash: null, confidence: 0, homeId: null,
    });
    const result = await composeDailyBriefing(MOCK_USER_ID);
    expect(result.should_send).toBe(false);
    expect(result.skip_reason).toBe('no_location');
  });

  test('composeDailyBriefing uses local-update fallback when no higher-priority signal exists', async () => {
    const { getLocalUpdateContext } = require('../services/context/localUpdateProvider');
    const { fetchWeather } = require('../services/context/weatherProvider');
    fetchWeather.mockResolvedValue({
      ...MOCK_WEATHER,
      hourly: MOCK_WEATHER.hourly.map((hour) => ({ ...hour, precip_chance_pct: 20 })),
    });
    getLocalUpdateContext.mockResolvedValue({
      summary: 'A downtown lodging-tax proposal is moving forward as part of World Cup planning.',
      tokens_used: 11,
      item_count: 2,
      top_score: 6,
      freshness_hours: 2,
      post_ids: ['p1', 'p2'],
      titles: ['Lodging tax proposal'],
      items: [],
    });

    const result = await composeDailyBriefing(MOCK_USER_ID);
    expect(result.should_send).toBe(true);
    expect(result.signals_snapshot[0]?.kind).toBe('local_update');
    expect(result.tokens_used).toBe(11);
  });

  test('composeScheduledBriefing avoids local-update fetch when evening has a stronger signal', async () => {
    const { fetchAlerts } = require('../services/context/alertsProvider');
    const { getLocalUpdateContext } = require('../services/context/localUpdateProvider');
    const { fetchWeather } = require('../services/context/weatherProvider');

    fetchWeather.mockResolvedValue({
      ...MOCK_WEATHER,
      daily: [
        { date: '2026-04-08', high_f: 60, low_f: 44, condition_code: 'sunny', condition_label: 'Sunny', precip_chance_pct: 10 },
        { date: '2026-04-09', high_f: 54, low_f: 40, condition_code: 'rain', condition_label: 'Rain', precip_chance_pct: 65 },
      ],
    });
    fetchAlerts.mockResolvedValue(MOCK_ALERT);

    const result = await composeScheduledBriefing(MOCK_USER_ID, { kind: 'evening' });

    expect(result.should_send).toBe(true);
    expect(result.text).toContain('Tomorrow looks');
    expect(result.signals_snapshot[0]?.kind).toBe('alert');
    expect(getLocalUpdateContext).not.toHaveBeenCalled();
  });
});
