'use strict';

/**
 * The assistant's Plans nudges, to hosts (AI assistant phase 2 contract §5 and §3.7):
 *  - plan_weather: rain, wind, heat or bad air before a pickup game or a walk. Checked at 48 h
 *    (the daily forecast), 24 h and 3 h (by the hour), and the air only at 3 h;
 *  - plan_requests_waiting: asking closes within 3 hours and people are still waiting;
 *  - plan_after: an hour after a plan ends, the same plan a week later and a thank-you.
 *
 * They run in the 5-minute Plans tick (jobs/planJobs.js), after reminders and host summaries,
 * and go out through the nudge engine (./engine.js, sendNudge), which decides whether the host
 * gets one at all: Suggestions, "Fewer like this", the day's cap, quiet hours and duplicates.
 *
 * Titles and bodies are written here from facts; the model isn't called. The cards are the
 * chat's own cards, drafted with the host as the viewer (actionCards.js), so each carries the
 * checks its endpoint makes. The weather is read at the plan's exact place, server-side only;
 * nothing here names the place.
 */

const { DateTime } = require('luxon');
const supabaseAdmin = require('../../../config/supabaseAdmin');
const logger = require('../../../utils/logger');
const { encodeGeohash } = require('../../../utils/geohash');
const planService = require('../../plans/planService');
const planActions = require('../../plans/planActions');
const planNotify = require('../../plans/planNotifications');
const rules = require('../../plans/planRules');
const { fetchWeather } = require('../../context/weatherProvider');
const { fetchAQI } = require('../../context/aqiProvider');
const { fetchHeatRisk, HEAT_RISK_LEVELS } = require('../../external/heatRisk');
const { readThrough } = require('../../placeSectionCache');
const {
  PRECIP_LIKELY, PRECIP_POSSIBLE, GRILL_MAX_WIND_MPH, AQI_SENSITIVE,
} = require('../../goodDayEngine');
const { EXTREME_HEAT_F } = require('../../context/usefulnessEngine');
const {
  card, action, KIND_LABELS, WHO_GETS_IN,
} = require('../actionCards');
const { linkFor } = require('../appGuide');
const { clip, whenLabel } = require('../assistantKit');
const { fit, capitalized, listText } = require('./words');

const HOUR_MS = 60 * 60 * 1000;
// NWS HeatRisk "Major" and above (services/external/heatRisk.js).
const HEAT_RISK_MAJOR = 3;
// Nothing in a plan says it is outdoors, so the watch covers games and walks; a plan that is
// only coffee is left out.
const OUTDOOR_KINDS = ['pickup_game', 'walk_coffee'];
// Asking about to close: within 3 hours, with someone waiting at least 30 minutes (a newer ask
// just had its own push).
const ASKING_CLOSES_WITHIN_MS = 3 * HOUR_MS;
const WAITED_MS = 30 * 60 * 1000;
// After the plan: an hour after its end, and not once the day is over (its chat closes a day after).
const AFTER_END_MS = HOUR_MS;
const AFTER_END_LATEST_MS = 6 * HOUR_MS;
const CHAT_OPEN_AFTER_END_MS = 24 * HOUR_MS;
// A move is offered to a clear slot: the same day within 4 hours of the start, by the hour,
// between 7 AM and 9 PM; else the same time on one of the next 6 days, by the day.
const SAME_DAY_SHIFT_HOURS = 4;
const EARLIEST_HOUR = 7;
const LATEST_END_HOUR = 21;
const LATER_DAYS = 6;

const CONDITIONS = ['rain', 'wind', 'heat', 'air'];

/** The nudge engine (contract §3.5). Required when used, so the Plans tick runs without it. */
const engine = () => require('./engine');

const hostOf = (plan) => String(plan.host_user_id);

// "20261022T0100Z": a plan's start inside a nudge key, so a moved plan is checked afresh.
const startKey = (iso) => DateTime.fromISO(String(iso), { zone: 'utc' }).toFormat("yyyyLLdd'T'HHmm'Z'");

/**
 * Whether the host would get this kind of nudge about this plan now (Suggestions, "Fewer like
 * this", the day's cap), asked before reading forecasts and drafting cards.
 */
async function hostWouldHear(plan, kind, checkpoint) {
  const verdict = await engine().canNudge({ userId: hostOf(plan), kind, subject: { type: 'plan', id: plan.post_id }, checkpoint });
  if (!verdict.ok) logger.debug('plans.nudge.not_now', { kind, planId: plan.post_id, reason: verdict.reason });
  return verdict.ok;
}

async function sendForHost(plan, { kind, checkpoint, title, body, cards, expiresAt }) {
  const result = await engine().sendNudge({
    userId: hostOf(plan),
    kind,
    subject: { type: 'plan', id: plan.post_id },
    checkpoint,
    title: fit(title, 60),
    body: fit(body, 160),
    cards: cards.filter(Boolean),
    expiresAt,
  });
  if (!result || !result.sent) logger.info('plans.nudge.not_sent', { kind, planId: plan.post_id, reason: result?.reason || null });
  return result;
}

/** A card from the chat's own drafter, as the host (engine.nudgeCard); null when it can't be offered. */
async function hostCard(plan, tool, args, expiresAt) {
  const { card: drafted, error } = await engine().nudgeCard(tool, args, { userId: hostOf(plan), expiresAt });
  if (!drafted) logger.info('plans.nudge.card_skipped', { tool, planId: plan.post_id, reason: error || null });
  return drafted || null;
}

// ─── Weather and air ───────────────────────────────────────────────────────

/** The checkpoint a plan starting in `msToStart` is at: 48h (the daily forecast), 24h or 3h (by the hour). */
function checkpointFor(msToStart) {
  if (msToStart <= 0 || msToStart > 48 * HOUR_MS) return null;
  if (msToStart > 24 * HOUR_MS) return '48h';
  if (msToStart > 3 * HOUR_MS) return '24h';
  return '3h';
}

const isOutdoor = (plan) => OUTDOOR_KINDS.includes(plan.kind) && plan.details?.walk_kind !== 'coffee';

/** NWS HeatRisk by day at the place, from the Place tab's own cache (6 hours a geohash-5 cell). */
async function heatRiskDays(latitude, longitude) {
  try {
    const { payload } = await readThrough({
      cacheKey: `geo:${encodeGeohash(latitude, longitude, 5)}`,
      sectionId: 'heat_cold',
      ttlMs: 6 * HOUR_MS,
      fetch: () => fetchHeatRisk(latitude, longitude),
    });
    return Array.isArray(payload?.days) ? payload.days : [];
  } catch (_) {
    return [];
  }
}

/** The forecast at the plan's place: by the hour (next 24 hours) and by the day (7 days), HeatRisk, and the air at 3 h. */
async function forecastAt(plan, checkpoint) {
  const latitude = Number(plan.place_latitude);
  const longitude = Number(plan.place_longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const [weather, heatDays, aqi] = await Promise.all([
    fetchWeather(latitude, longitude),
    heatRiskDays(latitude, longitude),
    checkpoint === '3h' ? fetchAQI(latitude, longitude).catch(() => null) : null,
  ]);
  if (!weather || weather.source === 'error') return null;
  return { weather, heatDays, aqi };
}

const hoursIn = (weather, startMs, endMs) => (weather.hourly || []).filter((hour) => {
  const at = Date.parse(hour.datetime_utc);
  return Number.isFinite(at) && at + HOUR_MS > startMs && at < endMs;
});
const highest = (list, pick) => list.reduce((best, item) => (pick(item) != null && (best == null || pick(item) > pick(best)) ? item : best), null);

/**
 * What the forecast says for a slot: rain or snow (a chance of 50% or more), wind (20 mph or
 * more, by the hour only), heat (95°F or more, or NWS HeatRisk 3 or more that day) and bad air
 * (AQI over 100, the current reading). The lines are the Today screen's (goodDayEngine,
 * usefulnessEngine). `{ covered: false }` when the forecast doesn't reach the slot.
 */
function conditionsAt(forecast, startMs, endMs, tz, { hourly, air = false, whole = false }) {
  const day = rules.localParts(new Date(startMs), tz).date;
  const heatRisk = forecast.heatDays.find((entry) => entry.date === day)?.level ?? null;
  const found = { covered: true };
  let rain = null;
  let snow = false;
  let wind = null;
  let temp = null;
  if (hourly) {
    const hours = hoursIn(forecast.weather, startMs, endMs);
    if (!hours.length) return { covered: false };
    // A slot to move to must be forecast to its end.
    if (whole && Math.max(...hours.map((hour) => Date.parse(hour.datetime_utc))) + HOUR_MS < endMs) return { covered: false };
    const wet = highest(hours, (hour) => hour.precip_chance_pct);
    rain = wet?.precip_chance_pct ?? null;
    snow = wet?.precip_type === 'snow';
    wind = highest(hours, (hour) => hour.wind_mph)?.wind_mph ?? null;
    temp = highest(hours, (hour) => hour.temp_f)?.temp_f ?? null;
  } else {
    const daily = (forecast.weather.daily || []).find((entry) => entry.date === day);
    if (!daily) return { covered: false };
    rain = daily.precip_chance_pct ?? null;
    snow = /snow/i.test(String(daily.condition_code || ''));
    temp = daily.high_f ?? null;
  }
  Object.assign(found, { rainChance: rain, windMph: wind, tempF: temp, heatRisk, snow });
  if (rain != null && rain >= PRECIP_LIKELY) found.rain = { chance: rain, snow };
  if (wind != null && wind >= GRILL_MAX_WIND_MPH) found.wind = { mph: wind };
  if ((temp != null && temp >= EXTREME_HEAT_F) || (heatRisk != null && heatRisk >= HEAT_RISK_MAJOR)) {
    found.heat = { tempF: temp != null && temp >= EXTREME_HEAT_F ? temp : null, heatRisk: heatRisk != null && heatRisk >= HEAT_RISK_MAJOR ? heatRisk : null };
  }
  const aqi = forecast.aqi?.aqi;
  if (air && aqi != null && aqi > AQI_SENSITIVE) found.air = { aqi, category: forecast.aqi.category || null };
  return found;
}

/** Whether a slot is clear enough to move to: little chance of rain (under 30%), calm and not hot. */
function isClear(found) {
  return found.covered && !found.wind && !found.heat && !found.air
    && (found.rainChance == null || found.rainChance < PRECIP_POSSIBLE);
}

function factsOf(found, { guests = false } = {}) {
  const facts = [];
  if (found.rain) facts.push(`${guests ? 'a ' : ''}${found.rain.chance}% chance of ${found.rain.snow ? 'snow' : 'rain'}`);
  if (found.wind) facts.push(`wind up to ${found.wind.mph} mph`);
  if (found.heat) {
    facts.push(found.heat.tempF != null
      ? `up to ${found.heat.tempF}°F`
      : `${HEAT_RISK_LEVELS[found.heat.heatRisk]?.label.toLowerCase() || 'high'} heat risk (NWS HeatRisk ${found.heat.heatRisk})`);
  }
  if (found.air) facts.push(`an air quality index of ${found.air.aqi}${found.air.category ? ` (${found.air.category.toLowerCase()})` : ''}`);
  return facts;
}

const TITLE_ONE = {
  rain: 'Rain likely', wind: 'Strong wind', heat: 'Extreme heat', air: 'Unhealthy air',
};
const TITLE_NAMES = {
  rain: 'rain', wind: 'wind', heat: 'heat', air: 'bad air',
};

function weatherTitle(present, found, noun) {
  if (present.length === 1) {
    const one = present[0] === 'rain' && found.rain.snow ? 'Snow likely' : TITLE_ONE[present[0]];
    return `${one} for your ${noun}`;
  }
  const names = present.map((key) => (key === 'rain' && found.rain.snow ? 'snow' : TITLE_NAMES[key]));
  return `${capitalized(listText(names))} for your ${noun}`;
}

/**
 * A better time for the plan: the same day by the hour, nearest the start, or the same time on
 * a later day by the day. Never past the 14 days a plan may start within, and never in the next
 * hour. Null when the forecast shows none.
 */
function betterTime(forecast, plan, tz, { hourly, now = Date.now() }) {
  const startMs = Date.parse(plan.post.event_date);
  const duration = Date.parse(plan.post.event_end_date) - startMs;
  const allowed = (at) => at >= now + HOUR_MS && at <= now + rules.LIMITS.maxDaysAhead * 24 * HOUR_MS;
  if (hourly) {
    const shifts = [];
    for (let h = 1; h <= SAME_DAY_SHIFT_HOURS; h += 1) shifts.push(h, -h);
    for (const shift of shifts) {
      const at = startMs + shift * HOUR_MS;
      const local = rules.localParts(new Date(at), tz);
      const endLocal = rules.localParts(new Date(at + duration), tz);
      const endHour = endLocal.hour + endLocal.minute / 60;
      if (!allowed(at) || local.date !== rules.localParts(new Date(startMs), tz).date) continue;
      if (local.hour < EARLIEST_HOUR || endHour > LATEST_END_HOUR || endLocal.date !== local.date) continue;
      const found = conditionsAt(forecast, at, at + duration, tz, { hourly: true, whole: true });
      if (isClear(found)) return { startMs: at, found };
    }
  }
  const start = DateTime.fromMillis(startMs, { zone: tz });
  for (let d = 1; d <= LATER_DAYS; d += 1) {
    const at = start.plus({ days: d }).toMillis();
    if (!allowed(at)) continue;
    const found = conditionsAt(forecast, at, at + duration, tz, { hourly: false });
    if (isClear(found)) return { startMs: at, found };
  }
  return null;
}

function clearText(found) {
  const parts = [];
  if (found.rainChance != null) parts.push(`${found.rainChance}% chance of rain`);
  if (found.windMph != null) parts.push(`wind ${found.windMph} mph`);
  if (found.tempF != null) parts.push(`${found.tempF}°F`);
  return parts.join(', ') || null;
}

/** The weather nudges already sent for this plan at this start: checkpoint → the conditions named. */
async function earlierWeatherNudges(plan, key) {
  const prefix = `nudge:plan_weather:${plan.host_user_id}:${plan.post_id}:`;
  const { data, error } = await supabaseAdmin.from('Notification')
    .select('idempotency_key')
    .eq('user_id', plan.host_user_id)
    .like('idempotency_key', `${prefix}%`)
    .limit(20);
  if (error) throw new Error(`Failed to read earlier weather nudges: ${error.message}`);
  const told = new Map();
  for (const row of data || []) {
    const match = /^(48h|24h|3h)\.([a-z+]+)@(\w+)$/.exec(String(row.idempotency_key).slice(prefix.length));
    if (match && match[3] === key) told.set(match[1], match[2].split('+'));
  }
  return told;
}

/**
 * One plan's weather check. A checkpoint nudges at most once, and a condition already named for
 * this start isn't named again at a later checkpoint unless something new comes with it (the air
 * at 3 hours, say); a plan moved to another time is checked afresh.
 */
async function checkWeather(plan, now) {
  const startMs = Date.parse(plan.post.event_date);
  const endMs = Date.parse(plan.post.event_end_date);
  const checkpoint = checkpointFor(startMs - now);
  if (!checkpoint) return null;
  const key = startKey(plan.post.event_date);
  const earlier = await earlierWeatherNudges(plan, key);
  if (earlier.has(checkpoint) || !(await hostWouldHear(plan, 'plan_weather', `${checkpoint}@${key}`))) return null;
  const forecast = await forecastAt(plan, checkpoint);
  if (!forecast) return null;
  const tz = rules.timezoneForPlan(plan);
  let hourly = checkpoint !== '48h';
  let found = conditionsAt(forecast, startMs, endMs, tz, { hourly, air: checkpoint === '3h' });
  if (!found.covered && hourly && checkpoint === '24h') {
    hourly = false;
    found = conditionsAt(forecast, startMs, endMs, tz, { hourly: false });
  }
  const present = CONDITIONS.filter((condition) => found[condition]);
  if (!found.covered || present.length === 0) return null;
  const named = new Set([...earlier.values()].flat());
  const fresh = present.filter((condition) => !named.has(condition));
  if (fresh.length === 0) return null;

  const noun = planNotify.noun(plan);
  const when = planNotify.whenText(plan.post.event_date, tz, { long: true, at: true });
  const better = betterTime(forecast, plan, tz, { hourly, now });
  const betterWhen = better ? planNotify.whenText(new Date(better.startMs).toISOString(), tz, { long: true, at: true }) : null;
  const requests = await planActions.activeRequests(plan.post_id);
  const going = planService.seatsTaken(plan, requests);

  const expiresAt = new Date(startMs);
  const message = plan.chat_room_id && going > 0
    ? await hostCard(plan, 'draft_plan_message', {
      plan_id: plan.post_id,
      text: `Heads up: the forecast shows ${listText(factsOf(found, { guests: true }))} for ${when}. I'll post here if we move it.`,
      note: null,
    }, expiresAt)
    : null;
  let move = null;
  if (better) {
    const startsLocal = DateTime.fromMillis(better.startMs, { zone: tz }).toFormat("yyyy-LL-dd'T'HH:mm");
    move = await hostCard(plan, 'draft_plan_change', {
      plan_id: plan.post_id, title: null, starts_local: startsLocal, ends_local: null, spots: null, place_name: null, about: null, guest_note: null, note: null,
    }, expiresAt);
    const then = clearText(better.found);
    if (move && then) move.lines.push({ label: 'Forecast then', value: then });
  }
  if (!message && !move) return null;

  const ask = move ? ` Move it to ${betterWhen}${message ? ', or let everyone know' : ''}?` : ' Let everyone know?';
  return sendForHost(plan, {
    kind: 'plan_weather',
    checkpoint: `${checkpoint}.${present.join('+')}@${key}`,
    title: weatherTitle([...fresh, ...present.filter((c) => !fresh.includes(c))], found, noun),
    body: `${capitalized(when)}: ${listText(factsOf(found))}.${ask}`,
    cards: [message, move],
    expiresAt,
  });
}

async function weatherWatch(now) {
  const { data, error } = await supabaseAdmin
    .from('Plan')
    .select(planService.PLAN_SELECT)
    .eq('status', 'open')
    .in('kind', OUTDOOR_KINDS)
    .gt('post.event_date', new Date(now).toISOString())
    .lte('post.event_date', new Date(now + 48 * HOUR_MS).toISOString())
    .limit(300);
  if (error) throw new Error(`Failed to read upcoming outdoor plans: ${error.message}`);
  let sent = 0;
  for (const plan of (data || []).filter(isOutdoor)) {
    try {
      const result = await checkWeather(plan, now);
      if (result?.sent) sent += 1;
    } catch (err) {
      logger.warn('plans.nudge.weather_failed', { planId: plan.post_id, error: err.message });
    }
  }
  return sent;
}

// ─── Requests waiting as asking closes ─────────────────────────────────────

/** One plan's requests-waiting check: asking closes within 3 hours and someone has waited. */
async function checkRequestsWaiting(plan, now) {
  const closes = rules.askingClosesAt(plan.kind, plan.post.event_date, plan.post.event_end_date);
  if (closes.getTime() <= now || closes.getTime() > now + ASKING_CLOSES_WITHIN_MS) return null;
  const requests = await planActions.activeRequests(plan.post_id);
  if (plan.spots - planService.seatsTaken(plan, requests) <= 0) return null;
  const waiting = await planActions.waitingRequests(plan, requests);
  if (!waiting.some((r) => Date.parse(r.queued_at || r.created_at) <= now - WAITED_MS)) return null;
  const checkpoint = `closes@${startKey(closes.toISOString())}`;
  if (!(await hostWouldHear(plan, 'plan_requests_waiting', checkpoint))) return null;
  const requestsCard = await hostCard(plan, 'show_plan_requests', { plan_id: plan.post_id, note: null }, closes);
  if (!requestsCard) return null;
  const tz = rules.timezoneForPlan(plan);
  const noun = planNotify.noun(plan);
  let who = `${waiting.length} people are`;
  if (waiting.length === 1) {
    const names = await planActions.userNames([waiting[0].user_id]);
    who = `${planActions.firstOf(names.get(String(waiting[0].user_id)))} is`;
  }
  const closesAt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(closes);
  return sendForHost(plan, {
    kind: 'plan_requests_waiting',
    checkpoint,
    title: `${who} waiting to join your ${noun}`,
    body: `Asking closes at ${closesAt}. Answer ${waiting.length === 1 ? 'them' : 'everyone'} before then?`,
    cards: [requestsCard],
    expiresAt: closes,
  });
}

async function requestsWaiting(now) {
  // Asking closes at the start, or 30 minutes before the end for games and walks (which last at
  // least 15 minutes), so every candidate starts within the next 3½ hours or is under way.
  const { data, error } = await supabaseAdmin
    .from('Plan')
    .select(planService.PLAN_SELECT)
    .eq('status', 'open')
    .lte('post.event_date', new Date(now + ASKING_CLOSES_WITHIN_MS + 30 * 60 * 1000).toISOString())
    .gt('post.event_end_date', new Date(now).toISOString())
    .limit(300);
  if (error) throw new Error(`Failed to read plans closing soon: ${error.message}`);
  let sent = 0;
  for (const plan of data || []) {
    try {
      const result = await checkRequestsWaiting(plan, now);
      if (result?.sent) sent += 1;
    } catch (err) {
      logger.warn('plans.nudge.requests_failed', { planId: plan.post_id, error: err.message });
    }
  }
  return sent;
}

// ─── After the plan ────────────────────────────────────────────────────────

/**
 * The same plan a week later as a plan_create card: the same place, time of day, spots and
 * rules, checked by the server's own plan rules (planActions.previewPlan), as the chat's card
 * is. Null when the plan rules refuse it (three upcoming plans, say).
 */
async function sameNextWeekCard(plan) {
  const tz = rules.timezoneForPlan(plan);
  const start = DateTime.fromISO(plan.post.event_date, { zone: 'utc' }).setZone(tz).plus({ weeks: 1 });
  const end = DateTime.fromISO(plan.post.event_end_date, { zone: 'utc' }).setZone(tz).plus({ weeks: 1 });
  const place = plan.place_kind === 'home'
    ? { kind: 'home', home_id: plan.place_home_id }
    : {
      kind: 'public', name: plan.place_name, address: plan.place_address || null,
      latitude: Number(plan.place_latitude), longitude: Number(plan.place_longitude),
    };
  const input = {
    kind: plan.kind,
    title: plan.post.title,
    about: plan.post.content || null,
    guest_note: plan.guest_note || null,
    starts_at: start.toUTC().toISO(),
    ends_at: end.toUTC().toISO(),
    spots: plan.spots,
    place,
    auto_rules: Array.isArray(plan.auto_rules) ? plan.auto_rules : [],
    join_requirement: plan.join_requirement || 'located',
    details: plan.details || {},
  };
  let checked;
  try {
    checked = await planActions.previewPlan({ id: hostOf(plan), role: null }, input);
  } catch (err) {
    if (err instanceof planActions.PlanError) {
      logger.info('plans.nudge.card_skipped', { tool: 'plan_create', planId: plan.post_id, reason: err.message });
      return null;
    }
    throw err;
  }
  const body = {
    kind: checked.kind,
    title: checked.title,
    about: checked.about || null,
    guest_note: checked.guestNote,
    starts_at: checked.startsAt,
    ends_at: checked.endsAt,
    spots: checked.spots,
    place: checked.place.kind === 'home'
      ? { kind: 'home', home_id: checked.place.home_id }
      : { kind: 'public', name: checked.place.name, address: checked.place.address, latitude: checked.place.latitude, longitude: checked.place.longitude },
    auto_rules: checked.autoRules,
    join_requirement: checked.joinRequirement,
    details: checked.details,
  };
  const playdate = checked.kind === 'playdate';
  // The chat card's words for who gets in (actionCards.draftPlan), whatever order the rules were saved in.
  const sameRules = (list) => [...list].sort().join() === [...checked.autoRules].sort().join();
  const who = Object.values(WHO_GETS_IN).find((w) => sameRules(w.rules)) || WHO_GETS_IN.host_approves;
  const line = (label, value) => (value ? { label, value: clip(String(value), 300) } : null);
  return card('plan_create', {
    title: checked.title,
    lines: [
      line('Kind', KIND_LABELS[checked.kind]),
      line('When', whenLabel(checked.startsAt, checked.endsAt, checked.timezone)),
      line('Where', checked.place.kind === 'home' ? 'Your place' : [checked.place.name, checked.place.address].filter(Boolean).join(', ')),
      line(playdate ? 'Families' : 'Spots', `${checked.spots}`),
      line('Who gets in', playdate ? 'You approve each family' : who.text),
      line('About', checked.about),
      line(playdate ? 'Note for families' : 'Note for guests', checked.guestNote),
    ],
    warnings: [checked.place.kind === 'home'
      ? 'Neighbors see the title and about. Only people you accept see your address.'
      : 'Neighbors see the title, about and area; they see the exact place once they get in.'],
    actions: [action('confirm', 'Post plan', { method: 'POST', path: '/api/plans', body },
      { label: 'Plan posted', link: linkFor('plan', '{{response.id}}') })],
    expiresAt: checked.startsAt,
  });
}

const THANKS = {
  pickup_game: 'Good game, everyone! Thanks for coming.',
  walk_coffee: 'Thanks for coming, everyone! That was fun.',
  watch_party: 'Thanks for coming over to watch, everyone!',
  study_group: 'Thanks for studying with me, everyone!',
  playdate: 'Thanks for coming, everyone! The kids had fun.',
};

/** One ended plan's follow-up: thank everyone, or host it again a week later. */
async function checkAfter(plan) {
  const requests = await planActions.activeRequests(plan.post_id);
  const cameCount = requests.filter((r) => r.status === 'accepted').length;
  if (cameCount === 0 || !(await hostWouldHear(plan, 'plan_after', 'after'))) return null;
  const expiresAt = new Date(Date.parse(plan.ended_at || plan.post.event_end_date) + CHAT_OPEN_AFTER_END_MS);
  // Hosting it again is offered only when they haven't already posted another of its kind.
  const { count: hostedAgain } = await supabaseAdmin.from('Plan')
    .select('post_id', { count: 'exact', head: true })
    .eq('host_user_id', plan.host_user_id).eq('kind', plan.kind).eq('status', 'open')
    .gt('created_at', plan.created_at);
  const again = hostedAgain ? null : await sameNextWeekCard(plan);
  const thanks = plan.chat_room_id && !plan.chat_closed_at
    ? await hostCard(plan, 'draft_plan_message', { plan_id: plan.post_id, text: THANKS[plan.kind] || THANKS.walk_coffee, note: null }, expiresAt)
    : null;
  if (!again && !thanks) return null;
  const tz = rules.timezoneForPlan(plan);
  const noun = planNotify.noun(plan);
  const nextWhen = again ? planNotify.whenText(again.actions[0].request.body.starts_at, tz, { long: true, at: true }) : null;
  const people = `${cameCount} ${cameCount === 1 ? 'person was' : 'people were'} in.`;
  let ask = ` Post it for ${nextWhen}?`;
  if (again && thanks) ask = ` Thank everyone, or post it for ${nextWhen}?`;
  else if (!again) ask = ' Thank everyone in the chat?';
  return sendForHost(plan, {
    kind: 'plan_after',
    checkpoint: 'after',
    title: again ? `Host your ${noun} again next week?` : `Thank everyone for the ${noun}?`,
    body: `${people}${ask}`,
    cards: [thanks, again],
    expiresAt,
  });
}

async function afterPlans(now) {
  const { data, error } = await supabaseAdmin
    .from('Plan')
    .select(planService.PLAN_SELECT)
    .eq('status', 'ended')
    .lte('ended_at', new Date(now - AFTER_END_MS).toISOString())
    .gt('ended_at', new Date(now - AFTER_END_LATEST_MS).toISOString())
    .limit(200);
  if (error) throw new Error(`Failed to read ended plans: ${error.message}`);
  let sent = 0;
  for (const plan of data || []) {
    try {
      const result = await checkAfter(plan);
      if (result?.sent) sent += 1;
    } catch (err) {
      logger.warn('plans.nudge.after_failed', { planId: plan.post_id, error: err.message });
    }
  }
  return sent;
}

// ─── The tick ──────────────────────────────────────────────────────────────

/** The three Plans nudges, each on its own: one failing never stops the others. */
async function runPlanNudges(now = Date.now()) {
  const counts = { weather: 0, requests: 0, after: 0 };
  const steps = [['weather', weatherWatch], ['requests', requestsWaiting], ['after', afterPlans]];
  for (const [name, step] of steps) {
    try {
      counts[name] = await step(now);
    } catch (err) {
      logger.warn('plans.nudge.step_failed', { step: name, error: err.message });
    }
  }
  return { ...counts, sent: counts.weather + counts.requests + counts.after };
}

module.exports = {
  runPlanNudges,
  weatherWatch,
  requestsWaiting,
  afterPlans,
  // One plan at a time (also for scripts on a shared test database).
  checkWeather,
  checkRequestsWaiting,
  checkAfter,
  checkpointFor,
  conditionsAt,
  betterTime,
};
