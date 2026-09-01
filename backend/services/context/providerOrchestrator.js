/**
 * Provider Orchestrator — Master Coordinator
 *
 * Top-level coordinator that resolves location, fetches all provider data
 * in parallel, runs the usefulness engine, and composes output for the
 * Hub Today card and daily briefing push notifications.
 */

const logger = require('../../utils/logger');
const { resolveLocation, locationFromCoordinates } = require('./locationResolver');
const { fetchWeather } = require('./weatherProvider');
const { fetchAQI } = require('./aqiProvider');
const { fetchAlerts } = require('./alertsProvider');
const { collectInternalContext } = require('./internalContextCollector');
const { getSeasonalContext } = require('../ai/seasonalEngine');
const { rankSignals } = require('./usefulnessEngine');
const { composeBriefing, composeTemplate } = require('./briefingComposer');
const { getRecentBriefings } = require('./briefingHistoryService');
const { getLocalUpdateContext } = require('./localUpdateProvider');
const { buildTomorrowWeatherIntro, selectEveningSignal } = require('./eveningBriefingService');

// ── Helpers ─────────────────────────────────────────────────────────

function getLocalHour(timezone = 'America/Los_Angeles', now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const hourPart = parts.find((part) => part.type === 'hour');
    const hour = Number(hourPart?.value);
    if (Number.isFinite(hour)) return hour;
  } catch {
    // Fall back to server-local time.
  }
  return now.getHours();
}

function getTimeOfDay(timezone = 'America/Los_Angeles', now = new Date()) {
  const hour = getLocalHour(timezone, now);
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 14) return 'midday';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

function isWeekend(timezone = 'America/Los_Angeles', now = new Date()) {
  try {
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    }).format(now);
    return weekday === 'Sat' || weekday === 'Sun';
  } catch {
    const day = now.getDay();
    return day === 0 || day === 6;
  }
}

function buildSeasonalInput(seasonal) {
  if (!seasonal?.primary_season) return null;
  return {
    primarySeason: seasonal.primary_season,
    seasonLabel: seasonal.primary_season.replace(/_/g, ' '),
    tip: seasonal.seasonal_tip,
    homeTip: seasonal.home_specific_tip,
  };
}

function filterHistoryForLocation(recentBriefings, geohash) {
  if (!Array.isArray(recentBriefings) || recentBriefings.length === 0) return [];
  if (!geohash) return recentBriefings;

  const matching = recentBriefings.filter((briefing) =>
    !briefing.location_geohash || briefing.location_geohash === geohash
  );
  return matching.length ? matching : recentBriefings;
}

// The morning push must clear both bars — see the interrupt gate in
// composeMorningBriefing for why one bar was not enough.
const MIN_PUSH_SCORE = 0.20;
const MIN_PUSH_COST = 0.25;

function emptyBriefingResult(skipReason = 'no_location') {
  return {
    text: '',
    mode: 'template',
    tokens_used: 0,
    signals_snapshot: [],
    location_geohash: null,
    // The home the briefing was composed for. Carried so the push can deep
    // link straight to that home's Place dashboard instead of /hub.
    home_id: null,
    should_send: false,
    skip_reason: skipReason,
  };
}

/**
 * Find the first hourly entry with precipitation and return its time.
 */
function findPrecipStart(hourly) {
  if (!hourly?.length) return null;
  const entry = hourly.find((h) => (h.precip_chance_pct || 0) > 50);
  return entry?.datetime_utc || null;
}

/**
 * Check if any hourly entry in next 6h has precipitation.
 */
function hasPrecipNext6h(hourly) {
  if (!hourly?.length) return false;
  return hourly.slice(0, 6).some((h) => (h.precip_chance_pct || 0) > 50);
}

const EMPTY_HUB_RESULT = {
  location: { label: 'Unknown', source: 'none', latitude: null, longitude: null, timezone: 'America/Los_Angeles', confidence: 0 },
  summary: 'Location not available.',
  display_mode: 'hidden',
  weather: null,
  aqi: null,
  alerts: [],
  signals: [],
  seasonal: null,
  actions: [],
  fetched_at: new Date().toISOString(),
  expires_at: new Date().toISOString(),
  meta: { providers_used: [], partial_failures: [], cache_hits: 0, total_latency_ms: 0 },
};

// ── Hub Today ───────────────────────────────────────────────────────

// ── In-memory cache for getHubToday (per-user, short TTL) ──────────────
// Keyed by user AND shape: the `detail` payload is a strict superset of
// the Hub card's, so serving one for the other would either leak forecast
// weight into the Hub card or starve Place of the arrays it needs.
const _hubTodayCache = new Map(); // Map<cacheKey, { result, expiresAt }>
const HUB_TODAY_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const HUB_TODAY_CACHE_MAX = 200;

function hubCacheKey(userId, detail, geohash) {
  const base = detail ? `${userId}:detail` : String(userId);
  // An explicit-coordinates payload is about a PLACE, not the user's
  // resolved location — keyed by geohash5 so a user flipping between two
  // homes never gets one home's forecast served for the other.
  return geohash ? `${base}@${geohash}` : base;
}

function clearHubTodayCache(userId) {
  if (userId) {
    _hubTodayCache.delete(hubCacheKey(userId, false));
    _hubTodayCache.delete(hubCacheKey(userId, true));
  } else {
    _hubTodayCache.clear();
  }
}

/**
 * Get the Hub Today card payload for a user.
 *
 * @param {string} userId
 * @param {object}  [options]
 * @param {boolean} [options.detail=false]  Include the fields the Hub card
 *   does not render but Place Intelligence does: the hourly/daily forecast
 *   arrays, feels-like/humidity/UV/dew point, the AQI's dominant pollutant,
 *   and each alert's real headline/description/instruction. These are
 *   already fetched and cached by the providers on every call; without this
 *   flag they are simply dropped on the floor at the block-building step.
 * @param {object} [options.atLocation]  Anchor the payload to EXPLICIT
 *   coordinates ({latitude, longitude, label?, homeId?}) instead of the
 *   user's resolved location. The Place Intelligence path passes the
 *   requested home here — a landlord in Portland opening their Phoenix
 *   rental must get Phoenix weather, freeze guidance, and alerts, not
 *   Portland's. Invalid coordinates fall back to the user's location.
 * @returns {Promise<Object>} HubTodayResult
 */
async function getHubToday(userId, options = {}) {
  const detail = options.detail === true;
  const atLocation = options.atLocation ? locationFromCoordinates(options.atLocation) : null;
  const cacheKey = hubCacheKey(userId, detail, atLocation && atLocation.geohash);

  // Check in-memory cache first
  const cached = _hubTodayCache.get(cacheKey);
  if (cached) {
    if (Date.now() < cached.expiresAt) {
      return cached.result;
    }
    _hubTodayCache.delete(cacheKey); // evict expired entry
  }

  const startMs = Date.now();

  try {
  const providersUsed = [];
  const partialFailures = [];
  let cacheHits = 0;

  // 1. Resolve location — an explicit anchor wins outright.
  const location = atLocation || await resolveLocation(userId);

  if (location.source === 'none') {
    return {
      ...EMPTY_HUB_RESULT,
      fetched_at: new Date().toISOString(),
      meta: { ...EMPTY_HUB_RESULT.meta, total_latency_ms: Date.now() - startMs },
    };
  }

  const { latitude, longitude } = location;

  // 2. Fetch all data in parallel with per-provider timing
  const fetchStartMs = Date.now();
  const [weatherResult, aqiResult, alertsResult, internalResult] = await Promise.allSettled([
    fetchWeather(latitude, longitude),
    fetchAQI(latitude, longitude),
    fetchAlerts(latitude, longitude),
    collectInternalContext(userId, location.homeId),
  ]);
  const fetchMs = Date.now() - fetchStartMs;

  // Unwrap results with fallback defaults
  const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
  const aqi = aqiResult.status === 'fulfilled' ? aqiResult.value : null;
  const alerts = alertsResult.status === 'fulfilled' ? alertsResult.value : null;
  const internal = internalResult.status === 'fulfilled' ? internalResult.value : {
    bills_due: [], tasks_due: [], calendar_events: [],
    unread_mail_count: 0, urgent_mail_count: 0,
    active_gigs: [], unread_notifications: 0,
    collected_at: new Date().toISOString(),
  };

  // Log per-provider status
  const providerTimings = { fetch_total_ms: fetchMs };
  if (weatherResult.status === 'rejected') providerTimings.weather = 'rejected';
  if (aqiResult.status === 'rejected') providerTimings.aqi = 'rejected';
  if (alertsResult.status === 'rejected') providerTimings.alerts = 'rejected';
  if (internalResult.status === 'rejected') providerTimings.internal = 'rejected';

  logger.debug('orchestrator: providers fetched', providerTimings);

  // Track providers and failures
  if (weather) {
    providersUsed.push(weather.provider || 'weather');
    if (weather.source === 'cache') cacheHits++;
    if (weather.source === 'error') partialFailures.push('weather');
  } else {
    partialFailures.push('weather');
  }

  if (aqi) {
    providersUsed.push('AIRNOW');
    if (aqi.source === 'cache') cacheHits++;
    if (aqi.source === 'error' || aqi.source === 'unavailable') partialFailures.push('aqi');
  }

  if (alerts) {
    providersUsed.push(alerts.provider || 'NOAA');
    if (alerts.source === 'cache') cacheHits++;
    if (alerts.source === 'error') partialFailures.push('alerts');
  } else {
    partialFailures.push('alerts');
  }

  // 3. Seasonal context (deterministic, no async)
  const seasonal = getSeasonalContext({ latitude, longitude });

  // 4. Rank signals
  const rankedOutput = rankSignals({
    weather,
    aqi,
    alerts,
    seasonal: buildSeasonalInput(seasonal),
    internal,
    timeOfDay: getTimeOfDay(location.timezone),
    isWeekend: isWeekend(location.timezone),
  });

  // 5. Build summary via template (fast path for Hub)
  const summary = composeTemplate(rankedOutput, {
    greeting: false,
    maxWords: 30,
    weather,
    includeWeatherTemperature: false,
  });

  // 6. Build weather block
  const weatherBlock = weather?.current ? {
    current_temp_f: weather.current.temp_f,
    condition_code: weather.current.condition_code,
    condition_label: weather.current.condition_label,
    high_f: weather.daily?.[0]?.high_f ?? null,
    low_f: weather.daily?.[0]?.low_f ?? null,
    precipitation_next_6h: hasPrecipNext6h(weather.hourly),
    precipitation_start_at: findPrecipStart(weather.hourly),
    ...(detail ? {
      feels_like_f: weather.current.feels_like_f ?? null,
      humidity_pct: weather.current.humidity_pct ?? null,
      uv_index: weather.current.uv_index ?? null,
      dew_point_f: weather.current.dew_point_f ?? null,
      wind_mph: weather.current.wind_mph ?? null,
      hourly: weather.hourly || [],
      daily: weather.daily || [],
    } : {}),
  } : null;

  // 7. Build AQI block
  const aqiBlock = aqi?.aqi != null ? {
    index: aqi.aqi,
    category: aqi.category,
    is_noteworthy: aqi.is_noteworthy,
    ...(detail ? { dominant_pollutant: aqi.pollutant ?? null } : {}),
  } : null;

  // 8. Build alerts list
  const alertsList = (alerts?.alerts || []).map((a) => ({
    id: a.id,
    severity: a.severity,
    title: a.event || a.headline,
    starts_at: a.onset,
    ends_at: a.expires,
    details_url: a.details_url || '',
    source: a.source || '',
    ...(detail ? {
      headline: a.headline || '',
      description: a.description || '',
      instruction: a.instruction || '',
    } : {}),
  }));

  // 9. Build signals for client
  const signalsList = rankedOutput.signals.map((s) => ({
    kind: s.kind,
    score: Math.round(s.score * 100) / 100,
    label: s.label,
    detail: s.detail,
    urgency: s.urgency,
    action: s.action,
    data: s.data,
  }));

  // 10. Build seasonal block
  const seasonalBlock = seasonal?.primary_season ? {
    season: seasonal.primary_season,
    tip: seasonal.seasonal_tip || seasonal.home_specific_tip || null,
  } : null;

  // 11. Build actions
  const actions = [];
  if (rankedOutput.display_mode !== 'hidden') {
    actions.push({ label: 'View details', route: '/app/hub/today' });
  }
  if (location.source !== 'none') {
    actions.push({ label: 'Change location', route: '/app/location' });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes
  const totalMs = Date.now() - startMs;

  const result = {
    location: {
      label: location.label,
      source: location.source,
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: location.timezone,
      confidence: location.confidence,
    },
    summary,
    display_mode: rankedOutput.display_mode,
    weather: weatherBlock,
    aqi: aqiBlock,
    alerts: alertsList,
    signals: signalsList,
    seasonal: seasonalBlock,
    actions,
    fetched_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    meta: {
      providers_used: providersUsed,
      partial_failures: partialFailures,
      cache_hits: cacheHits,
      total_latency_ms: totalMs,
    },
  };

  if (totalMs > 700) {
    logger.warn('orchestrator: getHubToday exceeded 700ms target', {
      total_ms: totalMs,
      fetch_ms: fetchMs,
      partial_failures: partialFailures,
      cache_hits: cacheHits,
    });
  }

  // Cache successful result
  _hubTodayCache.set(cacheKey, { result, expiresAt: Date.now() + HUB_TODAY_CACHE_TTL_MS });
  if (_hubTodayCache.size > HUB_TODAY_CACHE_MAX) {
    const firstKey = _hubTodayCache.keys().next().value;
    _hubTodayCache.delete(firstKey);
  }

  return result;

  } catch (err) {
    logger.error('orchestrator: getHubToday unexpected error', {
      userId,
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 3).join(' | '),
      latency_ms: Date.now() - startMs,
    });
    return {
      ...EMPTY_HUB_RESULT,
      fetched_at: new Date().toISOString(),
      meta: { ...EMPTY_HUB_RESULT.meta, total_latency_ms: Date.now() - startMs },
    };
  }
}

// ── Daily Briefing ──────────────────────────────────────────────────

/**
 * Compose a daily briefing push notification for a user.
 *
 * @param {string} userId
 * @returns {Promise<Object>} DailyBriefingResult
 */
function defaultInternalContext() {
  return {
    bills_due: [], tasks_due: [], calendar_events: [],
    unread_mail_count: 0, urgent_mail_count: 0,
    active_gigs: [], unread_notifications: 0,
    collected_at: new Date().toISOString(),
  };
}

async function composeMorningBriefing(userId, location) {
  const { latitude, longitude } = location;
  const [weatherResult, aqiResult, alertsResult, internalResult, recentBriefingsResult] = await Promise.allSettled([
    fetchWeather(latitude, longitude),
    fetchAQI(latitude, longitude),
    fetchAlerts(latitude, longitude),
    collectInternalContext(userId, location.homeId),
    getRecentBriefings(userId),
  ]);

  const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
  const aqi = aqiResult.status === 'fulfilled' ? aqiResult.value : null;
  const alerts = alertsResult.status === 'fulfilled' ? alertsResult.value : null;
  const recentBriefings = recentBriefingsResult.status === 'fulfilled' ? recentBriefingsResult.value : [];
  const internal = internalResult.status === 'fulfilled' ? internalResult.value : defaultInternalContext();

  const seasonal = getSeasonalContext({ latitude, longitude });
  const briefingHistory = filterHistoryForLocation(recentBriefings, location.geohash);
  const weekend = isWeekend(location.timezone);
  const baseRankInputs = {
    weather,
    aqi,
    alerts,
    seasonal: buildSeasonalInput(seasonal),
    internal,
    timeOfDay: 'morning',
    isWeekend: weekend,
    recentBriefings: briefingHistory,
  };

  const baselineRankedOutput = rankSignals(baseRankInputs);
  const primarySignalKinds = new Set([
    'alert', 'aqi', 'precipitation', 'temperature',
    'bill_due', 'task_due', 'calendar', 'mail', 'gig',
  ]);

  let localUpdates = null;
  let localUpdateTokens = 0;
  let rankedOutput = baselineRankedOutput;

  if (!baselineRankedOutput.signals.some((signal) => primarySignalKinds.has(signal.kind))) {
    localUpdates = await getLocalUpdateContext({
      latitude,
      longitude,
      locationLabel: location.label,
      briefingKind: 'morning',
    });
    localUpdateTokens = localUpdates?.tokens_used || 0;

    if (localUpdates) {
      rankedOutput = rankSignals({
        ...baseRankInputs,
        localUpdates,
      });
    }
  }

  // ── The interrupt gate ───────────────────────────────────────────
  //
  // This previously read `topScore < 0.20 && !hasWeather`. Weather is
  // essentially always resolvable, so `!hasWeather` was false and the
  // guard never fired: every user got a push every single day, including
  // days whose entire content was the temperature. Worse, a seasonal tip
  // scores ~0.224 — just over the ranking bar — so a quiet day inside a
  // supported region pushed "clean your gutters".
  //
  // A push now has to earn the interruption on BOTH axes: it must rank
  // well enough to be the day's lead, and not knowing it must actually
  // cost the user something (see COST_OF_INACTION). Weather alone and a
  // seasonal tip both fail the second test, which is the point — the
  // lock screen already shows the temperature, and the gutters will
  // still need clearing tomorrow.
  const top = rankedOutput.signals[0] || null;
  const topScore = top?.score || 0;
  const topCost = top?.cost_of_inaction ?? 0;
  if (!top || topScore < MIN_PUSH_SCORE || topCost < MIN_PUSH_COST) {
    return {
      ...emptyBriefingResult('low_signal_day'),
      signals_snapshot: rankedOutput.signals,
      location_geohash: location.geohash,
      home_id: location.homeId || null,
    };
  }

  const briefingSignals = rankedOutput.signals.slice(0, 1);
  const briefing = await composeBriefing({
    ...rankedOutput,
    signals: briefingSignals,
    signal_count: briefingSignals.length,
  }, {
    targetUse: 'push',
    greeting: true,
    maxWords: 45,
    weather,
    timezone: location.timezone,
  });

  return {
    text: briefing.text,
    mode: briefing.mode,
    tokens_used: briefing.tokens_used + localUpdateTokens,
    signals_snapshot: briefingSignals,
    location_geohash: location.geohash,
    home_id: location.homeId || null,
    should_send: true,
    skip_reason: null,
  };
}

async function composeEveningBriefing(userId, location) {
  const { latitude, longitude } = location;
  const [weatherResult, alertsResult, internalResult, recentBriefingsResult] = await Promise.allSettled([
    fetchWeather(latitude, longitude),
    fetchAlerts(latitude, longitude),
    collectInternalContext(userId, location.homeId),
    getRecentBriefings(userId),
  ]);

  const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
  const alerts = alertsResult.status === 'fulfilled' ? alertsResult.value : null;
  const recentBriefings = recentBriefingsResult.status === 'fulfilled' ? recentBriefingsResult.value : [];
  const internal = internalResult.status === 'fulfilled' ? internalResult.value : defaultInternalContext();
  const briefingHistory = filterHistoryForLocation(recentBriefings, location.geohash);

  let selectedSignal = selectEveningSignal({
    alerts,
    internal,
    timeZone: location.timezone,
    recentBriefings: briefingHistory,
    includeEveningTip: false,
  });
  let localUpdateTokens = 0;

  if (!selectedSignal) {
    const localUpdates = await getLocalUpdateContext({
      latitude,
      longitude,
      locationLabel: location.label,
      briefingKind: 'evening',
    });
    localUpdateTokens = localUpdates?.tokens_used || 0;
    selectedSignal = selectEveningSignal({
      alerts,
      internal,
      timeZone: location.timezone,
      recentBriefings: briefingHistory,
      localUpdates,
      includeEveningTip: false,
    });
  }

  if (!selectedSignal) {
    selectedSignal = selectEveningSignal({
      alerts,
      internal,
      timeZone: location.timezone,
      recentBriefings: briefingHistory,
      includeEveningTip: true,
    });
  }

  const leadIntro = buildTomorrowWeatherIntro(weather);
  const signals = selectedSignal ? [selectedSignal] : [];
  const hasLead = Boolean(leadIntro);

  if (!signals.length && !hasLead) {
    return {
      ...emptyBriefingResult('low_signal_day'),
      location_geohash: location.geohash,
    };
  }

  const briefing = await composeBriefing({
    signals,
    display_mode: signals.length ? 'minimal' : 'hidden',
    top_summary: signals[0]?.detail || '',
    signal_count: signals.length,
  }, {
    targetUse: 'push',
    greeting: true,
    maxWords: 45,
    leadIntro,
    timezone: location.timezone,
    forceTemplate: true,
  });

  return {
    text: briefing.text,
    mode: briefing.mode,
    tokens_used: briefing.tokens_used + localUpdateTokens,
    signals_snapshot: signals,
    location_geohash: location.geohash,
    home_id: location.homeId || null,
    should_send: true,
    skip_reason: null,
  };
}

async function composeScheduledBriefing(userId, options = {}) {
  const { kind = 'morning' } = options;
  const location = await resolveLocation(userId);

  if (location.source === 'none') {
    return emptyBriefingResult('no_location');
  }

  if (kind === 'evening') {
    return composeEveningBriefing(userId, location);
  }

  return composeMorningBriefing(userId, location);
}

async function composeDailyBriefing(userId) {
  return composeScheduledBriefing(userId, { kind: 'morning' });
}

module.exports = { getHubToday, composeDailyBriefing, composeScheduledBriefing, composeEveningBriefing, clearHubTodayCache };
