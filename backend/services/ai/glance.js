'use strict';

/**
 * Glance answers for Siri and the launcher (docs/product/ai-assistant-phase3-contract-2026-10-22.md §8.2):
 * GET /api/ai/glance/:topic, topic pickup, today or nearby. Written by the server from facts, read
 * as the person through the screens' own reads: no model call, no AIRequestLog row, nothing written.
 * A city schedule nobody confirmed is never said as confirmed, and the nearby answer says counts
 * and types only, never anyone's words.
 */

const { DateTime } = require('luxon');
const { composeForHomeId } = require('../addressCalendarService');
const { isFeatureEnabled } = require('../featureFlagService');
const { runReadTool } = require('./readTools');
const { catchUpNearby } = require('./readToolsNearby');
const { userTimeZone } = require('./chatContext');
const { isUuid, clip, homesOf, zoneOr } = require('./assistantKit');

const TOPICS = ['pickup', 'today', 'nearby'];
const SPEECH_MAX = 300;
const LINES = 5;
const POST_LABELS = {
  alert: 'Heads-up', event: 'Event', ask_local: 'Question', lost_found: 'Lost & found', recommendation: 'Recommendation',
  deal: 'Deal', local_update: 'Update', neighborhood_win: 'Win',
};
const PICKUP_KINDS = [['garbage', 'Garbage'], ['recycling', 'Recycling'], ['yard_waste', 'Yard waste'], ['bulk_pickup', 'Bulk pickup']];

class GlanceError extends Error {
  constructor(code, speech, link) {
    super(speech);
    this.code = code;
    this.speech = speech;
    this.link = link;
  }
}

const NO_HOME = () => new GlanceError('NO_HOME', 'Add your home in Pantopus first.', 'pantopus://place');

function speechOf(sentences) {
  let text = '';
  for (const sentence of sentences.filter(Boolean)) {
    const next = text ? `${text} ${sentence}` : sentence;
    if (next.length > SPEECH_MAX) break;
    text = next;
  }
  return text;
}

const answer = (topic, title, sentences, lines, link) => ({
  topic, title, speech: speechOf(sentences), lines: lines.filter(Boolean).slice(0, LINES), link, as_of: new Date().toISOString(),
});

/** The home asked for (it must be theirs), else the one Today shows. */
async function homeFor(userId, homeId) {
  const { homes, defaultHomeId } = await homesOf(userId);
  if (homeId != null) {
    const named = isUuid(homeId) ? homes.find((home) => home.id === homeId) : null;
    if (!named) throw NO_HOME();
    return named;
  }
  const home = homes.find((candidate) => candidate.id === defaultHomeId) || homes[0];
  if (!home) throw NO_HOME();
  return home;
}

const dayWords = (date, zone) => {
  const day = DateTime.fromISO(String(date), { zone: zoneOr(zone) });
  return day.isValid ? day.toFormat('cccc, LLLL d') : String(date);
};
const shortDay = (date, zone) => {
  const day = DateTime.fromISO(String(date), { zone: zoneOr(zone) });
  return day.isValid ? day.toFormat('ccc, LLL d') : String(date);
};

async function pickup(userId, home, zone) {
  const calendar = await composeForHomeId(home.id, { userId });
  const upcoming = (calendar.upcoming || []).filter((entry) => PICKUP_KINDS.some(([kind]) => kind === entry.kind));
  const next = PICKUP_KINDS.map(([kind, label]) => {
    const entry = upcoming.filter((candidate) => candidate.kind === kind).sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
    return entry ? { kind, label, date: entry.date, confirmed: entry.scope === 'home' } : null;
  }).filter(Boolean);
  if (!next.length) throw new GlanceError('NO_PICKUP', "Pantopus doesn't know your pickup days yet.", 'pantopus://today');
  const sentences = next.slice(0, 3).map((item) => (item.confirmed
    ? `${item.label} goes out ${dayWords(item.date, zone)}, the day your household set.`
    : `${item.label} is ${dayWords(item.date, zone)} on the city's schedule, not confirmed for your home.`));
  const lines = next.map((item) => ({ label: item.label, value: `${shortDay(item.date, zone)} · ${item.confirmed ? "your household's day" : "city's schedule, not confirmed"}` }));
  return answer('pickup', 'Next pickup', sentences, lines, 'pantopus://today');
}

const sectionData = (today, topic) => {
  const data = (today.sections || []).find((section) => section.topic === topic && section.status === 'ready')?.data;
  if (typeof data !== 'string') return data || null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

/** Active alerts' names. The model's copy of the section can be clipped JSON, so the names are read from its text when it doesn't parse. */
function activeAlerts(read) {
  const parsed = sectionData(read, 'alerts');
  if (parsed) return (parsed.active || []).filter((alert) => alert && alert.event);
  const raw = (read.sections || []).find((section) => section.topic === 'alerts' && section.status === 'ready')?.data;
  if (typeof raw !== 'string') return [];
  const active = raw.split('"active"')[1] || '';
  return [...active.matchAll(/"event":"([^"\\]{1,80})"/g)].map((match) => ({ event: match[1] }));
}

async function today(userId, home, zone) {
  const plansEnabled = await isFeatureEnabled('plans', { id: userId, role: null }).catch(() => false);
  const ctx = { userId, user: { id: userId, role: null }, timeZone: zone, plansEnabled, sessionScope: null };
  const read = await runReadTool('get_today', { home_id: home.id }, ctx);
  if (!read || read.error) throw NO_HOME();
  const weather = sectionData(read, 'weather');
  const alerts = activeAlerts(read);
  const plans = read.plans_today || [];
  const tasks = read.tasks_due || [];
  const todayDate = DateTime.now().setZone(zoneOr(zone));
  const calendar = await composeForHomeId(home.id, { userId }).catch(() => ({ upcoming: [] }));
  // Only the household's own pickup days (the brief's rule), today or tomorrow.
  const pickups = (calendar.upcoming || []).filter((entry) => entry.scope === 'home' && PICKUP_KINDS.some(([kind]) => kind === entry.kind)
    && [todayDate.toISODate(), todayDate.plus({ days: 1 }).toISODate()].includes(entry.date));
  const now = weather?.now;
  const range = weather?.today;
  const sentences = [
    now ? `It's ${now.temp_f}°F and ${String(now.sky || '').toLowerCase() || 'clear'}${range ? `, with a high of ${range.high_f} and a low of ${range.low_f}` : ''}.` : null,
    alerts.length ? `${alerts.length === 1 ? 'One alert' : `${alerts.length} alerts`}: ${clip(alerts[0].event, 60)}.` : null,
    plans.length ? `${plans.length === 1 ? 'One plan' : `${plans.length} plans`} today: ${clip(plans[0].title_text, 50)}, ${plans[0].when?.split(' · ')[1] || ''}.`.replace(', .', '.') : null,
    tasks.length ? `${tasks.length === 1 ? 'One task' : `${tasks.length} tasks`} due: ${clip(tasks[0].title_text, 50)}.` : null,
    pickups.length ? `${pickups[0].title || 'Pickup'} ${pickups[0].date === todayDate.toISODate() ? 'is today' : 'is tomorrow'}, the day your household set.` : null,
  ];
  const lines = [
    now ? { label: 'Weather', value: `${now.temp_f}°F · ${now.sky || ''}${range ? ` · ${range.high_f}°/${range.low_f}°` : ''}` } : null,
    alerts.length ? { label: 'Alerts', value: clip(alerts.map((alert) => alert.event).join(', '), 60) } : null,
    plans.length ? { label: 'Plans', value: clip(`${plans[0].title_text} · ${plans[0].when || ''}`, 60) } : null,
    tasks.length ? { label: 'Tasks due', value: clip(tasks.map((task) => task.title_text).join(', '), 60) } : null,
    pickups.length ? { label: 'Pickup', value: `${pickups[0].title || 'Pickup'} · ${pickups[0].date === todayDate.toISODate() ? 'today' : 'tomorrow'}` } : null,
  ];
  return answer('today', "What's on today", sentences.length ? sentences : ['Nothing on today.'], lines, 'pantopus://today');
}

async function nearby(userId, zone) {
  const caughtUp = await catchUpNearby({ days: null }, { userId, user: { id: userId, role: null }, timeZone: zone });
  if (!caughtUp || caughtUp.error) throw new GlanceError('NO_PLACE', 'Add your home or a saved place in Pantopus first.', 'pantopus://place');
  const counts = (caughtUp.counts || []).filter((entry) => entry.count > 0);
  const area = String(caughtUp.area || '').replace(/^near\s+/i, '').trim();
  const where = area ? ` near ${area}` : '';
  const list = counts.map((entry) => `${entry.count} ${entry.count === 1 ? String(entry.label).replace(/s$/, '') : entry.label}`);
  const said = list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
  const sentences = caughtUp.nothing_new || !counts.length
    ? [`Nothing new${where} since ${caughtUp.since || 'you last looked'}.`]
    : [`Since ${caughtUp.since || 'you last looked'}${where}: ${said}.`];
  // The snippet shows the top titles, never their bodies.
  const lines = (caughtUp.posts || []).slice(0, 3).map((post) => ({ label: POST_LABELS[post.type] || 'Post', value: clip(post.title_text || post.title, 60) || 'A post' }));
  return answer('nearby', 'Nearby', sentences, lines, 'pantopus://nearby');
}

/**
 * @returns {Promise<object>} the answer; throws GlanceError (404 with { code, speech, link }).
 */
async function glance(userId, topic, { homeId = null } = {}) {
  if (!TOPICS.includes(topic)) throw new GlanceError('TOPIC_UNKNOWN', 'Pantopus can answer pickup, today or nearby.', 'pantopus://today');
  const zone = await userTimeZone(userId).catch(() => undefined);
  if (topic === 'nearby') return nearby(userId, zone);
  const home = await homeFor(userId, homeId);
  return topic === 'pickup' ? pickup(userId, home, zone) : today(userId, home, zone);
}

module.exports = { glance, GlanceError, TOPICS };
