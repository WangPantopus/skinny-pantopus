/**
 * What Pantopus tells the chat assistant about the person's home before it answers.
 *
 * The questions people ask most (when is pickup, is anything happening tonight)
 * are answered from this in one streamed reply. Fetching the same facts with a
 * tool costs a second request, and on Claude Sonnet 5.5 the reply after a tool
 * result arrives all at once: measured on October 12, 2026, the first words came
 * after about 0.75 s with this context and 2.8 to 3.9 s through the tool.
 *
 * Coarse and owner-scoped, like the tools: a city and state, never an address,
 * and the household's pickup schedule through the same authorized read as the
 * calendar. Each part has a time budget; a part that fails or runs late is left
 * out, and the assistant says it doesn't know rather than guessing.
 */
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const noaa = require('../external/noaa');
const { resolveLocation } = require('../context/locationResolver');
const { composeForHomeId } = require('../addressCalendarService');
const { DEFAULT_TIMEZONE } = require('./llm');

// The context is read while the conversation loads; whatever isn't ready by
// then is left out rather than delaying the reply.
const CONTEXT_BUDGET_MS = 900;
// A person's follow-up questions reuse it for a minute.
const MEMO_MS = 60_000;
const memo = new Map();
const CONTEXT_HEADER = 'Context from Pantopus';
const PICKUP_LABELS = { garbage: 'Garbage', recycling: 'Recycling', yard_waste: 'Yard waste', bulk_pickup: 'Bulk pickup' };
const MAX_OTHER_DATES = 3;
const MAX_ALERTS = 3;

/** `promise`, or `fallback` if it fails or isn't done by `deadline` (a Date.now() value). */
function byDeadline(promise, deadline, fallback = null) {
  let timer;
  const late = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), Math.max(0, deadline - Date.now()));
    timer.unref?.();
  });
  return Promise.race([Promise.resolve(promise).catch(() => fallback), late]).finally(() => clearTimeout(timer));
}

/** "Tuesday, October 13" for a calendar day ("2026-10-13"). */
function dayLabel(isoDay) {
  const [year, month, day] = String(isoDay).split('-').map(Number);
  if (!year || !month || !day) return String(isoDay);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' })
    .format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function todayLabel(timeZone, now) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-US', { timeZone: DEFAULT_TIMEZONE, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(now);
  }
}

const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

async function homesLine(userId) {
  const { data } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('home:home_id(city, state)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(5);
  const homes = (data || []).map((row) => row.home).filter(Boolean);
  if (!homes.length) return '- Home: none added yet. Pickup reminders and alerts for a home need the home in Pantopus (the Place tab).';
  const where = (home) => [home.city, home.state].filter(Boolean).join(', ') || 'city not known';
  return homes.length === 1
    ? `- Home: ${where(homes[0])}.`
    : `- Homes: ${homes.map((home, index) => `Home ${index + 1} (${where(home)})`).join('; ')}.`;
}

function provenance(entry) {
  if (entry.scope === 'home') return 'set by their household';
  return entry.confidence === 'official' ? "from the city's published schedule" : "from the city's schedule, not confirmed";
}

async function calendarLines(homeId, userId) {
  const calendar = await composeForHomeId(homeId, { userId });
  const lines = [];
  const shown = new Set();
  for (const entry of calendar.upcoming || []) {
    const label = PICKUP_LABELS[entry.kind];
    if (!label || shown.has(entry.kind)) continue;
    shown.add(entry.kind);
    const moved = entry.moved_from ? ` (moved from ${dayLabel(entry.moved_from)} for ${entry.holiday || 'a holiday'})` : '';
    lines.push(`- ${label}: next ${dayLabel(entry.date)}${moved}, ${provenance(entry)}.`);
  }
  if (calendar.needs_pickup_day && !shown.has('garbage')) {
    lines.push('- Pickup day: not set for this home yet. They can set it in the pickup calendar on the Today tab.');
  }
  const others = (calendar.upcoming || [])
    .filter((entry) => !PICKUP_LABELS[entry.kind] && entry.kind !== 'pickup_holiday' && entry.title)
    .slice(0, MAX_OTHER_DATES);
  if (others.length) {
    lines.push(`- Coming up on their home calendar: ${others.map((entry) => `${entry.title} on ${dayLabel(entry.date)}`).join('; ')}.`);
  }
  return lines;
}

async function alertLines(location) {
  const result = await noaa.fetchAlerts(location.latitude, location.longitude);
  const place = location.homeId ? 'their home' : (location.label || 'their area');
  if (result.source === 'error') return [`- Weather alerts near ${place}: couldn't be checked just now.`];
  const alerts = (result.alerts || []).slice(0, MAX_ALERTS);
  if (!alerts.length) return [`- Weather alerts near ${place} (National Weather Service): none active.`];
  return [
    `- Weather alerts near ${place} (National Weather Service):`,
    ...alerts.map((alert) => `  - ${clip([`${alert.event}${alert.severity ? ` (${alert.severity})` : ''}`, alert.headline, alert.instruction].filter(Boolean).join(': '), 320)}`),
  ];
}

/**
 * The context message for a chat turn, and the person's time zone.
 *
 * @returns {Promise<{text: string|null, timeZone: string}>} text is null when nothing could be read.
 */
async function buildChatContext(userId, now = new Date()) {
  const remembered = memo.get(userId);
  if (remembered && remembered.until > Date.now()) return remembered.context;

  const deadline = Date.now() + CONTEXT_BUDGET_MS;
  const homesRead = byDeadline(homesLine(userId), deadline);
  const location = await byDeadline(resolveLocation(userId), deadline);
  const timeZone = location?.timezone || DEFAULT_TIMEZONE;
  const hasPoint = location && location.latitude != null && location.longitude != null;

  const [homes, calendar, alerts] = await Promise.all([
    homesRead,
    location?.homeId ? byDeadline(calendarLines(location.homeId, userId), deadline, []) : [],
    hasPoint ? byDeadline(alertLines(location), deadline, []) : [],
  ]);

  const lines = [homes, ...(calendar || []), ...(alerts || [])].filter(Boolean);
  if (!lines.length) {
    logger.warn('Chat context: nothing could be read in time', { userId });
    return { text: null, timeZone };
  }
  // Dated, not timed: the message is added again only when something in it changes
  // (each message the person sends carries its own time).
  const context = {
    text: `${CONTEXT_HEADER} (facts about this person's home as of ${todayLabel(timeZone, now)}; not written by them):\n${lines.join('\n')}`,
    timeZone,
  };
  memo.set(userId, { context, until: Date.now() + MEMO_MS });
  if (memo.size > 5000) memo.delete(memo.keys().next().value);
  return context;
}

const zones = new Map();
const ZONE_MEMO_MS = 30 * 60_000;

/** The person's time zone, for the dates a draft writes: quick, remembered for half an hour, the default when unknown. */
async function userTimeZone(userId) {
  const known = zones.get(userId);
  if (known && known.until > Date.now()) return known.timeZone;
  const location = userId ? await byDeadline(resolveLocation(userId), Date.now() + 400) : null;
  const timeZone = location?.timezone || DEFAULT_TIMEZONE;
  if (userId) {
    zones.set(userId, { timeZone, until: Date.now() + ZONE_MEMO_MS });
    if (zones.size > 5000) zones.delete(zones.keys().next().value);
  }
  return timeZone;
}

/** Drop the remembered context, after something in it changed (the pickup day, say). */
function forgetChatContext(userId) {
  memo.delete(userId);
}

/** The last context message in a conversation's messages, or null. */
function lastContextText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === 'system' && typeof message.content === 'string' && message.content.startsWith(CONTEXT_HEADER)) {
      return message.content;
    }
  }
  return null;
}

module.exports = { buildChatContext, forgetChatContext, lastContextText, userTimeZone, CONTEXT_HEADER };
