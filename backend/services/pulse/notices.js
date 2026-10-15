'use strict';

// Direct Pulse actions use the existing inbox and push service. A persisted due
// time lets the existing hourly Pulse job release a push after quiet hours.
// PC's digest/one-per-day budget owns non-direct updates, not these actions.
const db = require('../../config/supabaseAdmin');
const notificationService = require('../notificationService');
const pushService = require('../pushService');
const { quietHoursOf, inQuietHours, nextQuietEnd } = require('../plans/planNotifications');
const { readableNotifications } = require('./notificationAccess');
const logger = require('../../utils/logger');

const TYPES = ['pulse_helpful', 'pulse_thanks', 'offer_request', 'offer_chosen', 'offer_gone'];

async function deliver(row, now = new Date()) {
  if (!row || !TYPES.includes(row.type) || row.metadata?.pulse_push_sent_at) return;
  const quiet = await quietHoursOf(row.user_id);
  if (inQuietHours(quiet, now)) {
    const { error } = await db.from('Notification').update({ metadata: {
      ...row.metadata, pulse_push_due_at: nextQuietEnd(quiet, now).toISOString(),
    } }).eq('id', row.id).is('metadata->>pulse_push_sent_at', null);
    if (error) throw error;
    return;
  }
  // Check current scope, moderation, blocks and a withdrawn Helpful mark again before
  // claiming transport: unmarking while quiet hours hold the push withdraws that notice.
  const readable = (await readableNotifications([row])).length > 0;
  const enabled = readable && await notificationService.isPushEnabled(row.user_id);
  const { data, error } = await db.from('Notification').update({ metadata: {
    ...row.metadata, pulse_push_sent_at: now.toISOString(),
    ...(!enabled ? { pulse_push_suppressed: true } : {}),
  } }).eq('id', row.id).is('metadata->>pulse_push_sent_at', null).select('id');
  if (error) throw error;
  if (!enabled || !data?.length || !(await readableNotifications([row])).length) return;
  await pushService.sendToUser(row.user_id, { title: row.title, body: row.body || '',
    data: { notificationId: row.id, type: row.type, link: row.link, post_id: row.metadata.post_id,
      ...(row.metadata.comment_id ? { comment_id: row.metadata.comment_id } : {}),
      ...(row.metadata.claim_id ? { claim_id: row.metadata.claim_id } : {}) } });
}

// `metadata` adds the notice's own references (comment_id and helpful_at for a reply,
// claim_id for an offer); post_id and the actor's user_id are always there.
async function notify({ userId, type, title, body, postId, actorId, key, metadata = {} }) {
  try {
    const row = await notificationService.createNotification({ userId, type, title, body,
      link: `/posts/${postId}`, idempotencyKey: key, sendPush: false,
      metadata: { post_id: postId, user_id: actorId, ...metadata,
        pulse_push_due_at: new Date().toISOString() },
    });
    // A repeated action never recreates the inbox item. An interrupted delivery
    // remains discoverable by the hourly job through the stored due time.
    if (row) await deliver(row);
  } catch (error) {
    logger.warn('pulse.notice.delivery_failed', { type, error: error.message });
  }
}

async function releaseDue(now = new Date()) {
  for (;;) {
    const { data, error } = await db.from('Notification')
      .select('id, user_id, type, title, body, link, metadata, created_at')
      .in('type', TYPES).is('metadata->>pulse_push_sent_at', null)
      .lte('metadata->>pulse_push_due_at', now.toISOString()).order('created_at').order('id').limit(100);
    if (error) throw error;
    for (const row of data || []) await deliver(row, now);
    if (!data || data.length < 100) return;
  }
}

module.exports = { notify, releaseDue };
