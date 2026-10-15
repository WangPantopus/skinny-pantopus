/**
 * Ask reminders (build spec §4, contract §2.12 and §6, slice S7)
 *
 * One reminder to the asker of an open Ask in its last day (day 6 of 7):
 *   - someone else replied: "Did a reply help?" (mark what helped);
 *   - nobody did: "Still need an answer?" (keep it open 7 more days, or close it).
 * Held during the asker's quiet hours; a later run that day sends it. Sent once per Ask (the
 * notification's idempotency key), so an Ask kept open is not reminded again.
 *
 * Runs hourly at minute 41.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { skipForLaunchCut } = require('../utils/featureFlags');
const notificationService = require('../services/notificationService');
const { quietHoursOf, inQuietHours } = require('../services/plans/planNotifications');
const {
  DAY_MS, LOCAL_AUDIENCES, askIdsWithReplies, windowDays,
} = require('../services/pulse/lifecycle');

// Asks read per run for each kind of end (their ids go in request URLs); the next run continues.
const BATCH_SIZE = 100;
const ASK_SELECT = 'id, user_id, content';
const EXCERPT_LENGTH = 60;

function reminderKey(postId) {
  return `ask_still_open:${postId}`;
}

function excerpt(text) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  return flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH - 1).trimEnd()}…` : flat;
}

function reminderFor(ask, hasReplies) {
  const question = excerpt(ask.content);
  return hasReplies
    ? { title: 'Did a reply help?', body: `Mark what helped on “${question}”.` }
    : { title: 'Still need an answer?', body: `Keep “${question}” open 7 more days, or close it.` };
}

async function askStillOpenReminders() {
  // The reminder and the held reply-action pushes belong to the Pulse redesign (launch cut 11).
  if (skipForLaunchCut('pulse_redesign', 'askStillOpenReminders')) return;
  // Direct reply-action pushes held overnight share this existing hourly tick.
  await require('../services/pulse/notices').releaseDue();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const days = await windowDays('ask_local');
  const openAsks = (filter) => filter(supabaseAdmin
    .from('Post')
    .select(ASK_SELECT)
    .eq('post_type', 'ask_local')
    .eq('state', 'open')
    .is('resolution', null)
    .is('archived_at', null))
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  // Asks in their last day: by their own end time, or (older Asks) by their window.
  const [byEndTime, byWindow] = await Promise.all([
    openAsks((query) => query
      .gt('expires_at', nowIso)
      .lte('expires_at', new Date(now + DAY_MS).toISOString())),
    openAsks((query) => query
      .is('expires_at', null)
      .in('audience', LOCAL_AUDIENCES)
      .gt('created_at', new Date(now - days * DAY_MS).toISOString())
      .lte('created_at', new Date(now - (days - 1) * DAY_MS).toISOString())),
  ]);
  if (byEndTime.error || byWindow.error) {
    logger.error('[askReminders] Error reading Asks', { error: (byEndTime.error || byWindow.error).message });
    return;
  }
  const asks = [...(byEndTime.data || []), ...(byWindow.data || [])];
  if (!asks.length) {
    logger.info('[askReminders] Completed', { sent: 0, held: 0 });
    return;
  }

  const { data: sentRows, error: sentError } = await supabaseAdmin
    .from('Notification')
    .select('idempotency_key')
    .in('idempotency_key', asks.map((ask) => reminderKey(ask.id)));
  if (sentError) {
    logger.error('[askReminders] Error reading sent reminders', { error: sentError.message });
    return;
  }
  const alreadySent = new Set((sentRows || []).map((row) => row.idempotency_key));
  const due = asks.filter((ask) => !alreadySent.has(reminderKey(ask.id)));

  let repliedAskIds;
  try {
    repliedAskIds = await askIdsWithReplies(due);
  } catch (err) {
    // Without the replies the right reminder is unknown; the next run tries again.
    logger.error('[askReminders] Error reading replies', { error: err.message });
    return;
  }

  let sent = 0;
  let held = 0;
  for (const ask of due) {
    if (inQuietHours(await quietHoursOf(ask.user_id), new Date(now))) {
      held += 1;
      continue;
    }
    const hasReplies = repliedAskIds.has(ask.id);
    const notification = await notificationService.createNotification({
      userId: ask.user_id,
      type: 'ask_still_open',
      ...reminderFor(ask, hasReplies),
      icon: '❓',
      link: `/posts/${ask.id}`,
      metadata: { post_id: ask.id, has_replies: hasReplies },
      idempotencyKey: reminderKey(ask.id),
    });
    if (notification) sent += 1;
  }
  logger.info('[askReminders] Completed', { sent, held });
}

module.exports = askStillOpenReminders;
