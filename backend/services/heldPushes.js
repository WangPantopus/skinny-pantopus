'use strict';

/**
 * Pushes held for quiet hours, for notices that send their own push: the in-app
 * Notification row exists at once, and its push goes now or waits in
 * metadata.push_deferred_until until the person's quiet hours end.
 * releaseHeldPushes sends the ones that are due (jobs/index.js runs it every
 * 5 minutes). A push whose notice expired, or no longer applies, is dropped
 * (metadata.push_skipped) and its row kept.
 *
 * The same metadata as Plans (services/plans/planNotifications.js, released by
 * jobs/planJobs.js, which also bundles asks), and the same quiet hours: the
 * person's own, else 9 PM to 8 AM, in their time zone. Every send is claimed
 * first with a conditional update on metadata.push_sent_at, so two runners
 * (or a retry) never send one push twice.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { quietHoursOf, inQuietHours, nextQuietEnd } = require('./plans/planNotifications');

/** Whether the person set quiet hours of their own (a start and an end that differ). */
async function hasOwnQuietHours(userId) {
  const { data, error } = await supabaseAdmin.from('UserNotificationPreferences')
    .select('quiet_hours_start_local, quiet_hours_end_local')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`Quiet hours read failed: ${error.message}`);
  const start = String(data?.quiet_hours_start_local || '').slice(0, 5);
  const end = String(data?.quiet_hours_end_local || '').slice(0, 5);
  return Boolean(start && end && start !== end);
}

/**
 * When a push to this person may go: null for now, else the end of their quiet hours.
 * @param {string} userId
 * @param {object} [opts]
 * @param {string} [opts.fallbackTz]  Their zone when none is known.
 * @param {Date} [opts.now]
 * @param {boolean} [opts.ownOnly]    Only quiet hours they set themselves hold it, not the 9 PM to 8 AM
 *                                    default: for a push at a time they chose (the morning brief).
 * @returns {Promise<{ until: Date|null, timeZone: string }>}
 */
async function pushWindow(userId, { fallbackTz, now = new Date(), ownOnly = false } = {}) {
  const quiet = await quietHoursOf(userId, fallbackTz);
  if (ownOnly && !(await hasOwnQuietHours(userId))) return { until: null, timeZone: quiet.tz };
  return { until: inQuietHours(quiet, now) ? nextQuietEnd(quiet, now) : null, timeZone: quiet.tz };
}

/**
 * Merge `patch` into a row's metadata, only while its push is unsent.
 * @returns {Promise<boolean>} true when this caller made the change.
 */
async function claim(row, patch) {
  const metadata = { ...(row.metadata || {}), ...patch };
  const { data, error } = await supabaseAdmin.from('Notification')
    .update({ metadata })
    .eq('id', row.id)
    .is('metadata->>push_sent_at', null)
    .select('id');
  if (error) {
    logger.warn('held_push.claim_failed', { id: row.id, error: error.message });
    return false;
  }
  if (!data || !data.length) return false;
  row.metadata = metadata;
  return true;
}

/**
 * Push a freshly created row now, or hold it until the person's quiet hours end.
 * @param {object} row               The Notification row (id, user_id, metadata, …).
 * @param {object} opts
 * @param {(row: object) => Promise<unknown>} opts.send  Sends the push.
 * @param {string} [opts.fallbackTz]
 * @param {boolean} [opts.ownOnly]  See pushWindow.
 * @returns {Promise<{ sent: boolean, heldUntil: Date|null }>}
 */
async function pushOrHold(row, { send, fallbackTz, ownOnly = false }) {
  const { until } = await pushWindow(row.user_id, { fallbackTz, ownOnly });
  if (until) {
    await claim(row, { push_deferred_until: until.toISOString() });
    return { sent: false, heldUntil: until };
  }
  if (!(await claim(row, { push_sent_at: new Date().toISOString() }))) return { sent: false, heldUntil: null };
  await send(row);
  return { sent: true, heldUntil: null };
}

/**
 * Send the held pushes of these notification types that are due.
 * @param {object} opts
 * @param {string[]} opts.types
 * @param {(row: object) => Promise<unknown>} opts.send
 * @param {(row: object) => (boolean|Promise<boolean>)} [opts.isDropped]  True when the push no longer applies.
 * @param {number} [opts.limit]
 * @returns {Promise<{ sent: number, dropped: number }>}
 */
async function releaseHeldPushes({ types, send, isDropped = () => false, limit = 300 }) {
  const now = new Date().toISOString();
  const { data: rows, error } = await supabaseAdmin
    .from('Notification')
    .select('id, user_id, type, title, body, link, metadata, created_at')
    .in('type', types)
    .lte('metadata->>push_deferred_until', now)
    .is('metadata->>push_sent_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Failed to read held pushes: ${error.message}`);

  let sent = 0;
  let dropped = 0;
  for (const row of rows || []) {
    let drop;
    try {
      drop = Boolean(await isDropped(row));
    } catch (err) {
      // A check that can't be made now is made again on the next run.
      logger.warn('held_push.check_failed', { id: row.id, error: err.message });
      continue;
    }
    if (!(await claim(row, { push_sent_at: now, ...(drop ? { push_skipped: true } : {}) }))) continue;
    if (drop) {
      dropped += 1;
      continue;
    }
    try {
      await send(row);
      sent += 1;
    } catch (err) {
      logger.warn('held_push.send_failed', { id: row.id, error: err.message });
    }
  }
  return { sent, dropped };
}

module.exports = { pushWindow, pushOrHold, releaseHeldPushes, claim };
