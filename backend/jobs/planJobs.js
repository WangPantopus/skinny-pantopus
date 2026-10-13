'use strict';

/**
 * Nearby Plans: the every-5-minutes tick (build brief §7).
 *
 *  1. Held pushes go out: quiet hours ended, or a 10-minute ask bundle closed
 *     (one push for the bundle, without buttons). A push whose moment has
 *     passed (the request was answered, the plan was cancelled) is dropped.
 *  2. Asking closes: requests still waiting expire, with a kind note.
 *  3. Plans end at their end time; their chat goes read-only 24 hours later.
 *  4. Reminders for people who are in: 2 hours before, or 7 PM the evening
 *     before a plan that starts before 10 AM.
 *  5. The host's summary at 8 AM on the day.
 *
 * Every send is claimed first with a conditional update, so two runners (or a
 * retry) never send the same notice twice.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const rules = require('../services/plans/planRules');
const planService = require('../services/plans/planService');
const planChat = require('../services/plans/planChat');
const planNotify = require('../services/plans/planNotifications');
const { activeRequests, userNames, firstOf } = require('../services/plans/planActions');

const PLAN_NOTICE_TYPES = [
  'plan_request', 'plan_accepted', 'plan_declined', 'plan_reminder', 'plan_changed',
  'plan_cancelled', 'plan_spot_opened', 'plan_host_summary',
];
const CHAT_OPEN_AFTER_END_MS = 24 * 60 * 60 * 1000;

const iso = (d) => new Date(d).toISOString();

async function hostFirstNames(plans) {
  const names = await userNames(plans.map((p) => p.host_user_id));
  return (plan) => firstOf(names.get(String(plan.host_user_id)));
}

// ── 1. Held pushes ───────────────────────────────────────────

async function claimNotice(row, patch) {
  const metadata = { ...(row.metadata || {}), ...patch };
  const { data, error } = await supabaseAdmin.from('Notification')
    .update({ metadata })
    .eq('id', row.id)
    .is('metadata->>push_sent_at', null)
    .select('id');
  if (error) {
    logger.warn('plans.jobs.claim_failed', { id: row.id, error: error.message });
    return false;
  }
  row.metadata = metadata;
  return Boolean(data && data.length);
}

/** Has this notice's moment passed? */
function isStale(row, plan, request) {
  if (!plan) return true;
  if (plan.status === 'cancelled' && row.type !== 'plan_cancelled') return true;
  const ended = new Date(plan.post.event_end_date).getTime() <= Date.now();
  switch (row.type) {
    case 'plan_request': return !request || request.status !== 'pending' || ended;
    case 'plan_accepted': return !request || request.status !== 'accepted' || ended;
    case 'plan_changed': return !request || request.status !== 'accepted' || request.reconfirmed != null || ended;
    case 'plan_reminder': return !request || request.status !== 'accepted' || ended;
    case 'plan_host_summary': return new Date(plan.post.event_date).getTime() <= Date.now();
    default: return false;
  }
}

async function releaseHeldPushes() {
  const now = new Date().toISOString();
  const { data: rows, error } = await supabaseAdmin
    .from('Notification')
    .select('id, user_id, type, title, body, link, metadata, created_at')
    .in('type', PLAN_NOTICE_TYPES)
    .lte('metadata->>push_deferred_until', now)
    .is('metadata->>push_sent_at', null)
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) throw new Error(`Failed to read held pushes: ${error.message}`);
  if (!rows || rows.length === 0) return 0;

  const plans = new Map((await planService.loadPlanRows(rows.map((r) => r.metadata?.plan_id).filter(planService.isUuid)))
    .map((p) => [p.post_id, p]));
  const requestIds = rows.map((r) => r.metadata?.request_id).filter(planService.isUuid);
  const requests = new Map();
  if (requestIds.length) {
    const { data } = await supabaseAdmin.from('PlanRequest').select('id, status, reconfirmed').in('id', requestIds);
    for (const r of data || []) requests.set(r.id, r);
  }

  let sent = 0;
  const bundles = new Map();
  for (const row of rows) {
    const plan = plans.get(row.metadata?.plan_id);
    const request = requests.get(row.metadata?.request_id);
    if (row.type === 'plan_request' && row.metadata?.bundled) {
      const key = `${row.user_id}:${row.metadata.plan_id}`;
      if (!bundles.has(key)) bundles.set(key, { plan, rows: [] });
      bundles.get(key).rows.push({ row, request });
      continue;
    }
    const stale = isStale(row, plan, request);
    if (!(await claimNotice(row, { push_sent_at: now, ...(stale ? { push_skipped: true } : {}) }))) continue;
    if (!stale) {
      await planNotify.sendPush(row);
      sent += 1;
    }
  }

  // One push for each closed ask bundle, without buttons: it opens the requests.
  for (const { plan, rows: members } of bundles.values()) {
    const live = members.filter(({ row, request }) => !isStale(row, plan, request));
    const claimed = [];
    for (const { row } of members) {
      if (await claimNotice(row, { push_sent_at: now, ...(live.some((m) => m.row.id === row.id) ? {} : { push_skipped: true }) })) {
        claimed.push(row);
      }
    }
    const toSend = claimed.filter((row) => live.some((m) => m.row.id === row.id));
    if (!plan || toSend.length === 0) continue;
    const first = toSend[0];
    const firstName = String(first.title).split(' ')[0];
    const title = toSend.length === 1
      ? first.title
      : `${firstName} and ${toSend.length - 1} more asked to join your ${planNotify.noun(plan)}`;
    await planNotify.sendPush({
      id: first.id,
      user_id: first.user_id,
      type: 'plan_request',
      title,
      body: 'Open your plan to answer.',
      link: `/plans/${plan.post_id}/requests`,
      metadata: { plan_id: plan.post_id, kind: plan.kind, recipient_user_id: first.user_id, bundled: true, count: toSend.length },
    });
    sent += 1;
  }
  return sent;
}

// ── 2 and 3. Asking closes, plans end, chats close ───────────

async function closeAskingAndEnd() {
  const now = Date.now();
  // Asking closes at the start, or 30 minutes before the end for pickup games and
  // walks (which can be before the start of a very short plan): every candidate
  // starts within the next 31 minutes or already has.
  const { data: open, error } = await supabaseAdmin
    .from('Plan')
    .select(planService.PLAN_SELECT)
    .eq('status', 'open')
    .lte('post.event_date', new Date(now + 31 * 60 * 1000).toISOString())
    .limit(300);
  if (error) throw new Error(`Failed to read plans: ${error.message}`);
  const plans = (open || []).filter((p) => rules.askingClosesAt(p.kind, p.post.event_date, p.post.event_end_date).getTime() <= now);
  const hostFirst = await hostFirstNames(plans);
  let expiredCount = 0;
  let endedCount = 0;

  for (const plan of plans) {
    const waiting = (await activeRequests(plan.post_id)).filter((r) => r.status === 'pending' || r.status === 'waitlisted');
    for (const request of waiting) {
      const { data: expired } = await supabaseAdmin.from('PlanRequest')
        .update({ status: 'expired', updated_at: iso(now) })
        .eq('id', request.id).eq('status', request.status).select('id');
      if (!expired || expired.length === 0) continue;
      await planNotify.expired({ plan, request, hostFirst: hostFirst(plan) });
      expiredCount += 1;
    }
    if (new Date(plan.post.event_end_date).getTime() <= now) {
      const { data: ended } = await supabaseAdmin.from('Plan')
        .update({ status: 'ended', ended_at: plan.post.event_end_date, updated_at: iso(now) })
        .eq('post_id', plan.post_id).eq('status', 'open').select('post_id');
      if (ended && ended.length) endedCount += 1;
    }
  }

  // Chats go read-only 24 hours after the end.
  const { data: toClose } = await supabaseAdmin
    .from('Plan')
    .select(planService.PLAN_SELECT)
    .eq('status', 'ended')
    .is('chat_closed_at', null)
    .lte('ended_at', new Date(now - CHAT_OPEN_AFTER_END_MS).toISOString())
    .limit(300);
  let closedCount = 0;
  for (const plan of toClose || []) {
    if (plan.chat_room_id) await planChat.systemLine(plan.chat_room_id, plan.host_user_id, 'This chat is closed now');
    await planChat.closeRoom(plan);
    closedCount += 1;
  }
  return { expiredCount, endedCount, closedCount };
}

// ── 4. Reminders ─────────────────────────────────────────────

async function sendReminders() {
  const now = Date.now();
  // A plan starting within 15 hours may already be in its reminder window (7 PM the evening before).
  const { data: upcoming, error } = await supabaseAdmin
    .from('Plan')
    .select(planService.PLAN_SELECT)
    .eq('status', 'open')
    .gt('post.event_date', new Date(now).toISOString())
    .lte('post.event_date', new Date(now + 15 * 60 * 60 * 1000).toISOString())
    .limit(300);
  if (error) throw new Error(`Failed to read upcoming plans: ${error.message}`);
  let sent = 0;
  for (const plan of upcoming || []) {
    const remindAt = rules.reminderAt(plan.post.event_date, plan.timezone);
    if (remindAt.getTime() > now) continue;
    const requests = await activeRequests(plan.post_id);
    const accepted = requests.filter((r) => r.status === 'accepted' && !r.reminded_at);
    const going = planService.seatsTaken(plan, requests);
    for (const request of accepted) {
      // Someone let in after the reminder time just heard "You're in"; no second notice.
      const recent = request.decided_at && new Date(request.decided_at).getTime() > remindAt.getTime();
      const { data: claimed } = await supabaseAdmin.from('PlanRequest')
        .update({ reminded_at: iso(now) }).eq('id', request.id).is('reminded_at', null).select('id');
      if (!claimed || claimed.length === 0 || recent) continue;
      await planNotify.reminder({ plan, request, goingCount: going, band: planNotify.bandText(request.distance_band) });
      sent += 1;
    }
  }
  return sent;
}

// ── 5. The host's morning summary ────────────────────────────

async function sendHostSummaries() {
  const now = Date.now();
  const { data: today, error } = await supabaseAdmin
    .from('Plan')
    .select(planService.PLAN_SELECT)
    .eq('status', 'open')
    .is('host_summary_sent_at', null)
    .gt('post.event_date', new Date(now).toISOString())
    .lte('post.event_date', new Date(now + 24 * 60 * 60 * 1000).toISOString())
    .limit(300);
  if (error) throw new Error(`Failed to read today's plans: ${error.message}`);
  let sent = 0;
  for (const plan of today || []) {
    const tz = plan.timezone || rules.DEFAULT_TIMEZONE;
    const local = rules.localParts(new Date(now), tz);
    if (rules.localParts(new Date(plan.post.event_date), tz).date !== local.date || local.hour < 8) continue;
    const { data: claimed } = await supabaseAdmin.from('Plan')
      .update({ host_summary_sent_at: iso(now) }).eq('post_id', plan.post_id).is('host_summary_sent_at', null).select('post_id');
    if (!claimed || claimed.length === 0) continue;
    const requests = await activeRequests(plan.post_id);
    const going = planService.seatsTaken(plan, requests);
    await planNotify.hostSummary({
      plan,
      comingCount: going,
      spotsLeft: Math.max(0, plan.spots - going),
      requestsCount: requests.filter((r) => r.status === 'pending').length,
    });
    sent += 1;
  }
  return sent;
}

async function runPlansTick() {
  const released = await releaseHeldPushes();
  const lifecycle = await closeAskingAndEnd();
  const reminders = await sendReminders();
  const summaries = await sendHostSummaries();
  const result = { released, ...lifecycle, reminders, summaries };
  if (released || reminders || summaries || lifecycle.expiredCount || lifecycle.endedCount || lifecycle.closedCount) {
    logger.info('plans.tick', result);
  }
  return result;
}

module.exports = {
  runPlansTick,
  releaseHeldPushes,
  closeAskingAndEnd,
  sendReminders,
  sendHostSummaries,
};
