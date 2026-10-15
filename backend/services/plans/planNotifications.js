'use strict';

/**
 * Nearby Plans notifications (build brief §7, board A3).
 *
 * Every notice is an in-app Notification row right away. The push is sent by
 * this module, not by createNotification, so Plans can:
 *  - hold pushes during quiet hours (the person's own, from their notification
 *    preferences, else 9 PM to 8 AM, in their time zone), except within 2 hours
 *    of a plan the person is in;
 *  - bundle asks: the first ask on a plan pushes at once with Accept/Decline;
 *    more asks within 10 minutes become one push, without buttons;
 *  - attach the push categories and the ids their buttons need
 *    (PLAN_REQUEST, PLAN_REMINDER, PLAN_CHANGED).
 * Held pushes carry metadata.push_deferred_until; jobs/planJobs.js sends them.
 * Notices carry the area only, never an address or the venue's name.
 */

const { resolveNotificationTimezone } = require('../context/locationResolver');
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const pushService = require('../pushService');
const notificationService = require('../notificationService');
const rules = require('./planRules');

// Quiet hours for people who haven't set their own: 9 PM to 8 AM (minutes of the day).
const DEFAULT_QUIET = { start: 21 * 60, end: 8 * 60 };
const NEAR_PLAN_MS = 2 * 60 * 60 * 1000;
const BUNDLE_WINDOW_MS = 10 * 60 * 1000;

const CATEGORY_BY_TYPE = {
  plan_request: 'PLAN_REQUEST',
  plan_reminder: 'PLAN_REMINDER',
  plan_changed: 'PLAN_CHANGED',
};

const ICON_BY_KIND = {
  watch_party: '📺',
  playdate: '🛝',
  pickup_game: '🏓',
  walk_coffee: '☕',
};

// ── Words ────────────────────────────────────────────────────

function noun(plan) {
  switch (plan.kind) {
    case 'watch_party': return 'watch party';
    case 'playdate': return 'playdate';
    case 'pickup_game': return 'pickup game';
    case 'walk_coffee': {
      const walkKind = plan.details?.walk_kind;
      if (walkKind === 'coffee') return 'coffee';
      if (walkKind === 'dog_walk') return 'dog walk';
      if (walkKind === 'stroller_walk') return 'stroller walk';
      return 'walk';
    }
    default: return 'plan';
  }
}

function capitalized(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function timeText(date, tz) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(date);
}

/**
 * "today 5:30 PM", "tomorrow 9:00 AM", "Sun 1:25 PM" (or "Sunday 1:25 PM" with long; "Sunday at 1:25 PM" with at);
 * a week or more out the date too, "Thu, Oct 22 5:15 PM", as the apps' rows say it.
 */
function whenText(startsAt, tz, { long = false, hideTime = false, dayPart = null, at = false } = {}) {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return '';
  const zone = tz || rules.DEFAULT_TIMEZONE;
  const today = rules.localParts(new Date(), zone).date;
  const tomorrow = rules.localParts(new Date(Date.now() + 24 * 60 * 60 * 1000), zone).date;
  const day = rules.localParts(date, zone).date;
  const daysAhead = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / (24 * 60 * 60 * 1000));
  let dayText;
  if (day === today) dayText = 'today';
  else if (day === tomorrow) dayText = 'tomorrow';
  else {
    dayText = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: long ? 'long' : 'short' }).format(date);
    if (daysAhead >= 7) dayText += `, ${new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'short', day: 'numeric' }).format(date)}`;
  }
  if (hideTime) return `${dayText} ${dayPart || ''}`.trim();
  return `${dayText} ${at ? 'at ' : ''}${timeText(date, zone)}`;
}

function bandText(band) {
  switch (band) {
    case 'under_1_mi': return 'under 1 mi away';
    case 'about_1_mi': return 'about 1 mi away';
    case 'about_2_mi': return 'about 2 mi away';
    case 'about_3_mi': return 'about 3 mi away';
    case 'about_5_mi': return 'about 5 mi away';
    default: return null;
  }
}

function areaPhrase(plan) {
  const label = String(plan.area_label || '').trim();
  if (!label) return '';
  return /^near\s/i.test(label) ? `near ${label.slice(5)}` : `in ${label}`;
}

/** Where, as a notice may say it: "at Sam's place" at home, else the area. */
function placePhrase(plan, hostFirst) {
  return plan.place_kind === 'home' ? `at ${hostFirst}'s place` : areaPhrase(plan);
}

const AGE_TEXT = { under_2: 'under 2', '2_3': '2–3', '4_5': '4–5', '6_8': '6–8', '9_12': '9–12' };

function partyText(plan, request, first) {
  if (plan.kind === 'playdate') {
    const ages = (request.kids_age_bands || []).map((b) => AGE_TEXT[b]).filter(Boolean);
    const kids = request.kids_count || 1;
    return `${kids} ${kids === 1 ? 'kid' : 'kids'}${ages.length ? `, ${ages.join(', ')}` : ''}`;
  }
  const extra = (request.party_size || 1) - 1;
  return extra > 0 ? `${first} + ${extra}` : `just ${first}`;
}

// ── Quiet hours ──────────────────────────────────────────────

function minutesOfDay(hhmm) {
  const match = /^(\d{2}):(\d{2})/.exec(String(hhmm || ''));
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes < 24 * 60 ? minutes : null;
}

/**
 * The person's quiet hours, in their time zone (else the plan's): their own
 * quiet_hours_start_local / quiet_hours_end_local (the daily briefing's setting;
 * the same start and end means none), else 9 PM to 8 AM.
 * @returns {Promise<{ tz: string, start: number, end: number }>} minutes of the day
 */
async function quietHoursOf(userId, fallbackTz) {
  const quiet = { tz: fallbackTz || rules.DEFAULT_TIMEZONE, ...DEFAULT_QUIET };
  try {
    const { data } = await supabaseAdmin
      .from('UserNotificationPreferences')
      .select('daily_briefing_timezone, quiet_hours_start_local, quiet_hours_end_local')
      .eq('user_id', userId)
      .maybeSingle();
    const start = minutesOfDay(data?.quiet_hours_start_local);
    const end = minutesOfDay(data?.quiet_hours_end_local);
    if (start != null && end != null) Object.assign(quiet, { start, end });
    const tz = await resolveNotificationTimezone(userId, data);
    if (tz) {
      new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
      quiet.tz = tz;
    }
  } catch (_) {
    // An unknown zone or a failed read keeps the plan's zone.
  }
  return quiet;
}

/** Inside the quiet hours at this moment? A window past midnight wraps; start = end means none. */
function inQuietHours(quiet, now = new Date()) {
  if (quiet.start === quiet.end) return false;
  const { hour, minute } = rules.localParts(now, quiet.tz);
  const m = hour * 60 + minute;
  return quiet.start > quiet.end ? (m >= quiet.start || m < quiet.end) : (m >= quiet.start && m < quiet.end);
}

/** The first moment the quiet hours are over, as an instant (5-minute steps, at most a day). */
function nextQuietEnd(quiet, now = new Date()) {
  const step = 5 * 60 * 1000;
  let t = new Date(Math.ceil(now.getTime() / step) * step);
  for (let i = 0; i < 12 * 25; i += 1) {
    if (!inQuietHours(quiet, t)) return t;
    t = new Date(t.getTime() + step);
  }
  return new Date(now.getTime() + 11 * 60 * 60 * 1000);
}

/** Pushes for a plan the person is in may wake them within 2 hours of its start. */
function isNearPlan(plan, now = Date.now()) {
  const start = new Date(plan?.post?.event_date).getTime();
  const end = new Date(plan?.post?.event_end_date).getTime();
  if (!Number.isFinite(start)) return false;
  return (start - now <= NEAR_PLAN_MS && now <= (Number.isFinite(end) ? end : start));
}

// ── Sending ──────────────────────────────────────────────────

async function sendPush(row) {
  const enabled = await notificationService.isPushEnabled(row.user_id);
  if (!enabled) return false;
  await pushService.sendToUser(row.user_id, {
    title: row.title,
    body: row.body || '',
    data: { notificationId: row.id, type: row.type, link: row.link || null, ...(row.metadata || {}) },
  });
  return true;
}

async function updateMetadata(row, patch) {
  const metadata = { ...(row.metadata || {}), ...patch };
  const { error } = await supabaseAdmin.from('Notification').update({ metadata }).eq('id', row.id);
  if (error) logger.warn('plans.notify.metadata_update_failed', { id: row.id, error: error.message });
  row.metadata = metadata;
}

/**
 * Create one Plans notice and push it now, or hold the push.
 * @param {object} opts
 * @param {boolean} [opts.recipientIsIn] the person is in (or hosts) this plan: near its start, quiet hours don't hold the push
 * @param {Date|null} [opts.holdUntil] hold the push until then at least (bundles)
 */
async function notify({ userId, type, title, body, link, plan, metadata = {}, recipientIsIn = false, holdUntil = null }) {
  try {
    const category = CATEGORY_BY_TYPE[type] || null;
    const fullMetadata = {
      plan_id: plan.post_id,
      kind: plan.kind,
      recipient_user_id: userId,
      ...(category && !metadata.bundled ? { category } : {}),
      ...metadata,
    };
    const rows = await notificationService.createBulkNotifications([{
      userId,
      type,
      title,
      // A body can start with a time or a band ("today 5:30 PM · …", "about 1 mi · …"): capitalize it as a sentence.
      body: capitalized(body),
      icon: ICON_BY_KIND[plan.kind] || '📅',
      link,
      metadata: fullMetadata,
    }], { sendPush: false });
    const row = rows && rows[0];
    if (!row) return null;

    const quiet = await quietHoursOf(userId, rules.timezoneForPlan(plan));
    const now = new Date();
    let deferUntil = holdUntil && holdUntil > now ? holdUntil : null;
    if (!(recipientIsIn && isNearPlan(plan, now.getTime()))) {
      const at = deferUntil || now;
      if (inQuietHours(quiet, at)) {
        let until = nextQuietEnd(quiet, at);
        // For someone in the plan, quiet hours end 2 hours before it starts.
        const nearStart = new Date(new Date(plan.post?.event_date).getTime() - NEAR_PLAN_MS);
        if (recipientIsIn && nearStart > at && nearStart < until) until = nearStart;
        deferUntil = until;
      }
    }
    if (deferUntil) {
      await updateMetadata(row, { push_deferred_until: deferUntil.toISOString() });
      return row;
    }
    await sendPush(row);
    return row;
  } catch (err) {
    logger.warn('plans.notify.failed', { type, userId, error: err.message });
    return null;
  }
}

// ── The eight notices ────────────────────────────────────────

/** Someone asked a plan the host approves. The first ask in 10 minutes pushes with Accept/Decline; later ones bundle. */
async function requestReceived({ plan, request, requesterUser, hostFirst, requesterFirst }) {
  const tenMinutesAgo = new Date(Date.now() - BUNDLE_WINDOW_MS).toISOString();
  const { data: recent } = await supabaseAdmin
    .from('Notification')
    .select('id, created_at, metadata')
    .eq('user_id', plan.host_user_id)
    .eq('type', 'plan_request')
    .gte('created_at', tenMinutesAgo)
    .contains('metadata', { plan_id: plan.post_id })
    .order('created_at', { ascending: true })
    .limit(20);
  const head = (recent || []).find((n) => !n.metadata?.bundled);
  const when = whenText(plan.post.event_date, rules.timezoneForPlan(plan));
  const parts = [when, partyText(plan, request, requesterFirst), bandText(request.distance_band)].filter(Boolean);
  return notify({
    userId: plan.host_user_id,
    type: 'plan_request',
    title: `${requesterFirst} asked to join your ${noun(plan)}`,
    body: parts.join(' · '),
    link: `/plans/${plan.post_id}/requests`,
    plan,
    recipientIsIn: true,
    // requester_name (a first name, as in the title) lets a failed Accept/Decline button say whom it was for.
    metadata: head
      ? { request_id: request.id, requester_name: requesterFirst, bundled: true, bundle_head_id: head.id }
      : { request_id: request.id, requester_name: requesterFirst },
    holdUntil: head ? new Date(new Date(head.created_at).getTime() + BUNDLE_WINDOW_MS) : null,
  });
}

async function accepted({ plan, request, hostFirst, byRule }) {
  const when = whenText(plan.post.event_date, rules.timezoneForPlan(plan), { long: true });
  const where = placePhrase(plan, hostFirst);
  const body = byRule
    ? `${capitalized(noun(plan))}, ${when} ${where}.`
    : `${hostFirst} said yes. ${capitalized(when)} ${where}.`;
  return notify({
    userId: request.user_id,
    type: 'plan_accepted',
    title: "You're in",
    body: body.replace(/\s+\./g, '.'),
    link: `/plans/${plan.post_id}`,
    plan,
    recipientIsIn: true,
    metadata: { request_id: request.id },
  });
}

async function declined({ plan, request, hostFirst }) {
  return notify({
    userId: request.user_id,
    type: 'plan_declined',
    title: "This one didn't work out",
    body: `${hostFirst} couldn't fit you this time.`,
    link: `/plans/${plan.post_id}`,
    plan,
    metadata: { request_id: request.id },
  });
}

async function changed({ plan, request, hostFirst, timeMoved, placeChanged }) {
  // Board H11: "Now Sunday at 2:00 PM. Still coming?" (the apps preview the same words).
  const when = whenText(plan.post.event_date, rules.timezoneForPlan(plan), { long: true, at: true });
  let title;
  let body;
  if (timeMoved && placeChanged) {
    title = `${hostFirst} changed the ${noun(plan)}`;
    body = `Now ${when}, at a new place. Still coming?`;
  } else if (timeMoved) {
    title = `${hostFirst} moved the ${noun(plan)}`;
    body = `Now ${when}. Still coming?`;
  } else {
    // The apps preview this push on H11 before saving; the new area's name isn't known until then.
    title = `${hostFirst} changed the place`;
    body = "It's at a new place now. Still coming?";
  }
  return notify({
    userId: request.user_id,
    type: 'plan_changed',
    title,
    body,
    link: `/plans/${plan.post_id}`,
    plan,
    recipientIsIn: true,
    metadata: { request_id: request.id },
  });
}

async function cancelled({ plan, request, hostFirst, note, wasIn }) {
  const hideTime = plan.kind === 'playdate' && !wasIn;
  const when = whenText(plan.post.event_date, rules.timezoneForPlan(plan), {
    long: true, hideTime, dayPart: rules.dayPart(plan.post.event_date, rules.timezoneForPlan(plan)),
  });
  return notify({
    userId: request.user_id,
    type: 'plan_cancelled',
    title: `${hostFirst} cancelled the ${noun(plan)}`,
    body: note ? `“${note}”` : `${capitalized(when)} is off.`,
    link: `/plans/${plan.post_id}`,
    plan,
    recipientIsIn: wasIn,
    metadata: { request_id: request.id },
  });
}

/** A request still waiting when asking closed. */
async function expired({ plan, request, hostFirst }) {
  return notify({
    userId: request.user_id,
    type: 'plan_declined',
    title: "This one didn't work out",
    body: request.status === 'waitlisted'
      ? 'No spot opened this time. There are more plans nearby.'
      : `It started before ${hostFirst} could answer. There are more plans nearby.`,
    link: `/plans/${plan.post_id}`,
    plan,
    metadata: { request_id: request.id, expired: true },
  });
}

async function spotOpened({ plan, request, hostFirst, nowIn }) {
  const when = whenText(plan.post.event_date, rules.timezoneForPlan(plan));
  return notify({
    userId: request.user_id,
    type: 'plan_spot_opened',
    title: 'A spot opened up',
    body: nowIn ? `You're in: ${plan.post.title}, ${when}.` : `${hostFirst} will let you know soon.`,
    link: `/plans/${plan.post_id}`,
    plan,
    recipientIsIn: nowIn,
    metadata: { request_id: request.id },
  });
}

async function reminder({ plan, request, goingCount, band }) {
  const time = timeText(new Date(plan.post.event_date), rules.timezoneForPlan(plan)).replace(/\s?[AP]M$/, '');
  const parts = [band ? band.replace(/ away$/, '') : null, `${goingCount} going`].filter(Boolean);
  return notify({
    userId: request.user_id,
    type: 'plan_reminder',
    title: `${capitalized(noun(plan))} at ${time}`,
    body: parts.join(' · '),
    link: `/plans/${plan.post_id}`,
    plan,
    recipientIsIn: true,
    metadata: { request_id: request.id },
  });
}

async function hostSummary({ plan, comingCount, spotsLeft, requestsCount }) {
  const time = timeText(new Date(plan.post.event_date), rules.timezoneForPlan(plan));
  const parts = [time, `${comingCount} coming`];
  if (spotsLeft > 0) parts.push(`${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left`);
  if (requestsCount > 0) parts.push(`${requestsCount} ${requestsCount === 1 ? 'request' : 'requests'}`);
  return notify({
    userId: plan.host_user_id,
    type: 'plan_host_summary',
    title: `Your ${noun(plan)} is today`,
    body: parts.join(' · '),
    link: `/plans/${plan.post_id}`,
    plan,
    recipientIsIn: true,
  });
}

module.exports = {
  CATEGORY_BY_TYPE,
  BUNDLE_WINDOW_MS,
  noun,
  whenText,
  bandText,
  areaPhrase,
  placePhrase,
  inQuietHours,
  nextQuietEnd,
  isNearPlan,
  quietHoursOf,
  sendPush,
  updateMetadata,
  notify,
  requestReceived,
  accepted,
  declined,
  expired,
  changed,
  cancelled,
  spotOpened,
  reminder,
  hostSummary,
};
