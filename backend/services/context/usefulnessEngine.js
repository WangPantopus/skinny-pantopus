/**
 * Usefulness Engine
 *
 * Ranks and filters context signals to determine what to show on the
 * Hub Today card and in daily briefings. Implements the scoring formula
 * from the design doc: severity * 0.35 + time_proximity * 0.25 +
 * personal_relevance * 0.30 + confidence * 0.10.
 */

const logger = require('../../utils/logger');

const MAX_SIGNALS = 5;
const RECENT_EXACT_LOOKBACK = 3;

// ── Signal generators ───────────────────────────────────────────────

/**
 * Generate alert signals from NOAA alerts.
 */
function generateAlertSignals(alerts) {
  if (!alerts?.alerts?.length) return [];

  const severityScores = { extreme: 1.0, severe: 0.95, moderate: 0.70, minor: 0.50, unknown: 0.40 };
  const urgencyMap = { extreme: 'critical', severe: 'critical', moderate: 'high', minor: 'medium', unknown: 'low' };

  return alerts.alerts.map((a) => {
    const severity = severityScores[a.severity] || 0.40;
    return {
      kind: 'alert',
      score: severity * 0.35 + 0.90 * 0.25 + 0.80 * 0.30 + 0.95 * 0.10,
      label: a.event || 'Weather Alert',
      detail: a.headline || `${a.event} in effect.`,
      urgency: urgencyMap[a.severity] || 'medium',
      source_provider: 'NOAA',
      action: null,
      data: { id: a.id, severity: a.severity, onset: a.onset, expires: a.expires },
    };
  });
}

/**
 * Generate precipitation signal from hourly forecast.
 */
function generatePrecipSignals(weather, internal) {
  if (!weather?.hourly?.length) return [];

  const signals = [];
  const next3h = weather.hourly.slice(0, 3);
  const maxPrecip = Math.max(...next3h.map((h) => h.precip_chance_pct || 0));

  if (maxPrecip <= 60) return [];

  // Find when precip starts
  const precipHour = next3h.find((h) => (h.precip_chance_pct || 0) > 60);
  const precipType = precipHour?.precip_type || 'rain';
  const precipLabel = precipType === 'snow' ? 'Snow' : precipType === 'sleet' ? 'Sleet' : 'Rain';

  // Check for outdoor relevance (tasks or gigs today)
  const hasOutdoorContext = (internal.tasks_due?.length || 0) > 0 || (internal.active_gigs?.length || 0) > 0;
  const personalRelevance = hasOutdoorContext ? 0.90 : 0.50;

  const severity = maxPrecip > 80 ? 0.85 : 0.65;
  const score = severity * 0.35 + 0.80 * 0.25 + personalRelevance * 0.30 + 0.85 * 0.10;

  signals.push({
    kind: 'precipitation',
    score,
    label: `${precipLabel} likely soon`,
    detail: `${maxPrecip}% chance of ${precipLabel.toLowerCase()} in the next 3 hours.`,
    urgency: maxPrecip > 80 ? 'high' : 'medium',
    source_provider: weather.provider || 'weather',
    action: null,
    data: { precip_chance: maxPrecip, precip_type: precipType, hours_ahead: 3 },
  });

  return signals;
}

/**
 * Generate AQI signal.
 */
function generateAqiSignals(aqi) {
  if (!aqi || aqi.aqi == null || aqi.aqi <= 100) return [];

  const aqiVal = aqi.aqi;
  const severity = aqiVal > 200 ? 1.0 : aqiVal > 150 ? 0.85 : 0.65;
  const urgency = aqiVal > 150 ? 'high' : 'medium';

  return [{
    kind: 'aqi',
    score: severity * 0.35 + 0.70 * 0.25 + 0.75 * 0.30 + 0.90 * 0.10,
    label: `AQI ${aqiVal} — ${aqi.category}`,
    detail: `Air quality is ${(aqi.category || 'unhealthy').toLowerCase()}. Consider limiting outdoor activity.`,
    urgency,
    source_provider: 'AIRNOW',
    action: null,
    data: { aqi: aqiVal, category: aqi.category, pollutant: aqi.pollutant },
  }];
}

/**
 * Generate temperature extreme signal.
 */
function generateTempSignals(weather) {
  if (!weather?.current) return [];

  const temp = weather.current.temp_f;
  if (temp == null) return [];

  const signals = [];

  if (temp <= 32) {
    signals.push({
      kind: 'temperature',
      score: 0.80 * 0.35 + 0.75 * 0.25 + 0.70 * 0.30 + 0.90 * 0.10,
      label: `Freezing — ${temp}°F`,
      detail: `Temperature is at or below freezing. Protect pipes and outdoor plants.`,
      urgency: temp <= 20 ? 'high' : 'medium',
      source_provider: weather.provider || 'weather',
      action: null,
      data: { temp_f: temp, extreme: 'cold' },
    });
  } else if (temp >= 95) {
    signals.push({
      kind: 'temperature',
      score: 0.75 * 0.35 + 0.70 * 0.25 + 0.65 * 0.30 + 0.90 * 0.10,
      label: `Extreme heat — ${temp}°F`,
      detail: `Temperature is ${temp}°F. Stay hydrated and limit outdoor exposure.`,
      urgency: temp >= 105 ? 'high' : 'medium',
      source_provider: weather.provider || 'weather',
      action: null,
      data: { temp_f: temp, extreme: 'heat' },
    });
  }

  return signals;
}

/**
 * Generate bill-due signals.
 */
function generateBillSignals(internal) {
  if (!internal.bills_due?.length) return [];

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  return internal.bills_due.map((bill) => {
    const dueMs = new Date(bill.due_date).getTime() - now;
    const isWithin24h = dueMs < oneDayMs;
    const timeProximity = isWithin24h ? 0.95 : 0.60;
    const severity = isWithin24h ? 0.80 : 0.50;

    return {
      kind: 'bill_due',
      score: severity * 0.35 + timeProximity * 0.25 + 0.85 * 0.30 + 0.95 * 0.10,
      label: `Bill due: ${bill.provider_name}`,
      detail: `$${bill.amount.toFixed(2)} ${bill.provider_name} bill due ${isWithin24h ? 'today' : 'soon'}.`,
      urgency: isWithin24h ? 'high' : 'medium',
      source_provider: 'pantopus',
      action: { label: 'View bill', route: '/app/mailbox' },
      data: { bill_id: bill.id, amount: bill.amount, due_date: bill.due_date },
    };
  });
}

/**
 * Generate task-due signals.
 */
function generateTaskSignals(internal) {
  if (!internal.tasks_due?.length) return [];

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  return internal.tasks_due.map((task) => {
    const dueMs = new Date(task.due_at).getTime() - now;
    const isDueToday = dueMs < oneDayMs;
    const isHighPriority = task.priority === 'high' || task.priority === 'urgent';
    const severity = isHighPriority ? 0.75 : 0.55;
    const timeProximity = isDueToday ? 0.90 : 0.55;

    return {
      kind: 'task_due',
      score: severity * 0.35 + timeProximity * 0.25 + 0.80 * 0.30 + 0.90 * 0.10,
      label: `Task: ${task.title}`,
      detail: `${task.title} is due ${isDueToday ? 'today' : 'soon'}.`,
      urgency: isDueToday && isHighPriority ? 'high' : 'medium',
      source_provider: 'pantopus',
      action: { label: 'View task', route: '/app/homes' },
      data: { task_id: task.id, due_at: task.due_at, priority: task.priority },
    };
  });
}

/**
 * Generate calendar event signals.
 */
function generateCalendarSignals(internal) {
  if (!internal.calendar_events?.length) return [];

  const now = Date.now();
  const twoHoursMs = 2 * 60 * 60 * 1000;

  return internal.calendar_events
    .filter((e) => {
      const startMs = new Date(e.start_at).getTime();
      return startMs - now < twoHoursMs && startMs > now;
    })
    .map((event) => {
      const minutesUntil = Math.round((new Date(event.start_at).getTime() - now) / 60000);
      return {
        kind: 'calendar',
        score: 0.65 * 0.35 + 0.95 * 0.25 + 0.85 * 0.30 + 0.90 * 0.10,
        label: `Soon: ${event.title}`,
        detail: `${event.title} starts in ${minutesUntil} minutes.`,
        urgency: minutesUntil < 30 ? 'high' : 'medium',
        source_provider: 'pantopus',
        action: { label: 'View event', route: '/app/homes' },
        data: { event_id: event.id, start_at: event.start_at, event_type: event.event_type },
      };
    });
}

/**
 * Generate urgent mail signal.
 */
function generateMailSignals(internal) {
  if (!internal.urgent_mail_count) return [];

  const count = internal.urgent_mail_count;
  return [{
    kind: 'mail',
    score: 0.60 * 0.35 + 0.70 * 0.25 + 0.90 * 0.30 + 0.95 * 0.10,
    label: `${count} urgent mail`,
    detail: `You have ${count} urgent mail item${count > 1 ? 's' : ''} in your mailbox.`,
    urgency: 'medium',
    source_provider: 'pantopus',
    action: { label: 'Open mailbox', route: '/app/mailbox' },
    data: { urgent_count: count, unread_count: internal.unread_mail_count },
  }];
}

/**
 * Generate active gig signals for today.
 */
function generateGigSignals(internal) {
  if (!internal.active_gigs?.length) return [];

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayGigs = internal.active_gigs.filter((g) =>
    g.scheduled_date && g.scheduled_date.slice(0, 10) === todayStr
  );

  if (todayGigs.length === 0) return [];

  return todayGigs.slice(0, 2).map((gig) => ({
    kind: 'gig',
    score: 0.60 * 0.35 + 0.85 * 0.25 + 0.90 * 0.30 + 0.90 * 0.10,
    label: `Gig today: ${gig.title}`,
    detail: `Your gig "${gig.title}" is scheduled for today.`,
    urgency: 'medium',
    source_provider: 'pantopus',
    action: { label: 'View gig', route: `/gigs/${gig.id}` },
    data: { gig_id: gig.id, status: gig.status, scheduled_date: gig.scheduled_date },
  }));
}

/**
 * Generate seasonal context signal (lowest priority).
 */
function generateSeasonalSignals(seasonal, context = {}) {
  if (!seasonal?.primarySeason) return [];

  const tip = seasonal.tip || seasonal.homeTip || '';
  if (!tip) return [];

  const { isWeekend = false } = context;
  const personalRelevance = isWeekend ? 0.34 : 0.22;
  const weekdayBias = isWeekend ? 0.03 : -0.01;
  const score = Math.max(
    0,
    0.18 * 0.35 + 0.10 * 0.25 + personalRelevance * 0.30 + 0.80 * 0.10 + weekdayBias
  );

  return [{
    kind: 'seasonal',
    score,
    label: seasonal.seasonLabel || 'Seasonal tip',
    detail: tip.length > 120 ? tip.slice(0, 117) + '...' : tip,
    urgency: 'low',
    source_provider: 'pantopus',
    action: null,
    data: { season: seasonal.primarySeason, label: seasonal.seasonLabel },
  }];
}

/**
 * Generate a local-updates fallback signal from nearby curator posts.
 */
function generateLocalUpdateSignals(localUpdates, context = {}) {
  if (!localUpdates?.summary) return [];

  const { isWeekend = false } = context;
  const freshness = localUpdates.freshness_hours <= 6 ? 0.85
    : localUpdates.freshness_hours <= 12 ? 0.70
      : 0.55;
  const severity = localUpdates.top_score >= 6 ? 0.70
    : localUpdates.top_score >= 4 ? 0.58
      : 0.48;
  const personalRelevance = isWeekend ? 0.42 : 0.58;
  const confidence = localUpdates.item_count > 1 ? 0.92 : 0.82;
  const weekdayBias = isWeekend ? 0.01 : 0.06;
  const score = Math.min(
    0.62,
    severity * 0.35 + freshness * 0.25 + personalRelevance * 0.30 + confidence * 0.10 + weekdayBias
  );

  return [{
    kind: 'local_update',
    score,
    label: localUpdates.titles?.[0] || 'Nearby update',
    detail: localUpdates.summary,
    urgency: score >= 0.50 ? 'medium' : 'low',
    source_provider: 'pantopus',
    action: { label: 'Open Pulse', route: '/app/pulse' },
    data: {
      item_count: localUpdates.item_count,
      post_ids: localUpdates.post_ids || [],
      titles: localUpdates.titles || [],
      freshness_hours: localUpdates.freshness_hours,
    },
  }];
}

// ── Briefing-history helpers ────────────────────────────────────────

function flattenRecentSignals(recentBriefings = []) {
  return recentBriefings.flatMap((briefing) =>
    Array.isArray(briefing?.signals_snapshot) ? briefing.signals_snapshot : []
  );
}

function signalIdentityKey(signal) {
  if (!signal?.kind) return null;

  switch (signal.kind) {
    case 'bill_due':
      return signal.data?.bill_id ? `bill_due:${signal.data.bill_id}` : null;
    case 'task_due':
      return signal.data?.task_id ? `task_due:${signal.data.task_id}` : null;
    case 'calendar':
      return signal.data?.event_id ? `calendar:${signal.data.event_id}` : null;
    case 'gig':
      return signal.data?.gig_id ? `gig:${signal.data.gig_id}` : null;
    case 'mail':
      return `mail:${signal.data?.urgent_count || 0}`;
    case 'seasonal':
      return signal.data?.season ? `seasonal:${signal.data.season}` : null;
    case 'local_update': {
      const postIds = Array.isArray(signal.data?.post_ids) ? signal.data.post_ids.filter(Boolean) : [];
      if (postIds.length) return `local_update:${postIds.join(',')}`;
      return signal.label ? `local_update:${String(signal.label).toLowerCase()}` : null;
    }
    default:
      return signal.data?.id ? `${signal.kind}:${signal.data.id}` : null;
  }
}

function countRecentKind(recentBriefings, kind) {
  return flattenRecentSignals(recentBriefings).filter((signal) => signal?.kind === kind).length;
}

function hasRecentIdentity(signal, recentBriefings, lookback = RECENT_EXACT_LOOKBACK) {
  const identity = signalIdentityKey(signal);
  if (!identity) return false;

  const recentSignals = flattenRecentSignals(recentBriefings).slice(0, lookback);
  return recentSignals.some((recent) => signalIdentityKey(recent) === identity);
}

function applyHistoryAdjustments(signal, recentBriefings = []) {
  if (!signal || recentBriefings.length === 0) return signal;

  const repeatedExact = hasRecentIdentity(signal, recentBriefings);
  const recentKindCount = countRecentKind(recentBriefings, signal.kind);
  const adjusted = { ...signal };

  switch (signal.kind) {
    case 'seasonal':
      if (recentKindCount >= 2 || repeatedExact) return null;
      break;
    case 'local_update':
      if (repeatedExact) return null;
      if (recentKindCount >= 2) adjusted.score *= 0.8;
      break;
    case 'mail':
      if (repeatedExact) adjusted.score *= 0.65;
      break;
    case 'bill_due':
    case 'task_due':
    case 'calendar':
    case 'gig':
      if (repeatedExact) adjusted.score *= 0.82;
      break;
    default:
      break;
  }

  adjusted.score = Math.max(0, adjusted.score);
  return adjusted;
}

// ── Display mode ────────────────────────────────────────────────────

/**
 * Determine display mode based on top signal score.
 *
 * @param {Array} signals - Sorted signals array
 * @param {Object} [options]
 * @param {boolean} [options.weatherAvailable=false]
 * @returns {'full' | 'reduced' | 'minimal' | 'hidden'}
 */
function computeDisplayMode(signals, options = {}) {
  const { weatherAvailable = false } = options;

  if (!signals || signals.length === 0) {
    return weatherAvailable ? 'minimal' : 'hidden';
  }

  const topScore = signals[0].score;
  if (topScore >= 0.70) return 'full';
  if (topScore >= 0.40) return 'reduced';
  if (topScore >= 0.10) return 'minimal';
  return weatherAvailable ? 'minimal' : 'hidden';
}

// ── Build top summary line ──────────────────────────────────────────

function buildTopSummary(signals) {
  if (signals.length === 0) return 'Nothing notable right now.';
  if (signals.length === 1) return signals[0].detail;

  // Lead with the most important signal's detail
  const top = signals[0];
  const secondKind = signals[1]?.kind;

  // Combine top two if they're different enough
  if (secondKind && secondKind !== top.kind) {
    return `${top.detail} Also: ${signals[1].label.toLowerCase()}.`;
  }

  return top.detail;
}

// ── Main ranking function ───────────────────────────────────────────

/**
 * Rank all context signals and produce a sorted, capped list.
 *
 * @param {Object} inputs
 * @param {import('./providerInterfaces').WeatherResult|null} inputs.weather
 * @param {import('./providerInterfaces').AQIResult|null} inputs.aqi
 * @param {import('./providerInterfaces').AlertResult|null} inputs.alerts
 * @param {Object|null} inputs.seasonal
 * @param {Array<Object>} [inputs.recentBriefings]
 * @param {Object|null} [inputs.localUpdates]
 * @param {import('./internalContextCollector').InternalContext} inputs.internal
 * @param {string} inputs.timeOfDay
 * @param {boolean} inputs.isWeekend
 * @returns {Object} RankedOutput
 */
function rankSignals(inputs) {
  const {
    weather,
    aqi,
    alerts,
    seasonal,
    internal,
    timeOfDay,
    isWeekend,
    recentBriefings = [],
    localUpdates = null,
  } = inputs;

  // Generate all candidate signals
  const candidates = [
    ...generateAlertSignals(alerts),
    ...generatePrecipSignals(weather, internal),
    ...generateAqiSignals(aqi),
    ...generateTempSignals(weather),
    ...generateBillSignals(internal),
    ...generateTaskSignals(internal),
    ...generateCalendarSignals(internal),
    ...generateMailSignals(internal),
    ...generateGigSignals(internal),
    ...generateLocalUpdateSignals(localUpdates, { isWeekend }),
    ...generateSeasonalSignals(seasonal, { isWeekend }),
  ]
    .map((signal) => applyHistoryAdjustments(signal, recentBriefings))
    .filter(Boolean);

  // Sort by score descending, cap at MAX_SIGNALS
  candidates.sort((a, b) => b.score - a.score);
  const signals = candidates.slice(0, MAX_SIGNALS);

  const weatherAvailable = Boolean(
    weather?.current && (weather.current.temp_f != null || weather.current.condition_label)
  );
  const displayMode = computeDisplayMode(signals, { weatherAvailable });
  const topSummary = buildTopSummary(signals);

  logger.debug('usefulnessEngine: ranked', {
    candidateCount: candidates.length,
    signalCount: signals.length,
    displayMode,
    topKind: signals[0]?.kind || 'none',
    topScore: signals[0]?.score?.toFixed(3) || '0',
    timeOfDay,
    isWeekend,
  });

  return {
    signals,
    display_mode: displayMode,
    top_summary: topSummary,
    signal_count: signals.length,
  };
}

module.exports = { rankSignals, computeDisplayMode };
