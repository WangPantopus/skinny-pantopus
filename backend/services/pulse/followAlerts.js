'use strict';

// Follow alerts (contract §6): when a followed conversation gets a reply, everyone who
// chose "Notify me about each update" (notify = each) gets an in-app `pulse_follow_reply`.
// PB stores the row only (sendPush: false). A follow alert is not about the reader, so
// whether and when it reaches a device is PC's noise budget (one such push a day).
const db = require('../../config/supabaseAdmin');
const notificationService = require('../notificationService');
const { getMuteAndHideFilters } = require('../feedService');
const { POST_READ_SELECT, canReadPost, postScopeAccess } = require('./readAccess');
const follows = require('./follows');
const logger = require('../../utils/logger');

const TYPE = 'pulse_follow_reply';
const POST_SELECT = `${POST_READ_SELECT}, title, content, state, resolution, expires_at`;

// Which conversation, in the reader's inbox: its title or the start of its text.
function subjectOf(post) {
  const text = String(post.title || post.content || '').replace(/\s+/g, ' ').trim();
  return text.length > 80 ? `${text.slice(0, 79).trimEnd()}…` : text;
}

/**
 * After a reply is stored. `skipUserIds` already get a direct notice about this reply
 * (the post's author, the parent reply's author). A held or removed reply alerts nobody;
 * a follower who can't read the post, is across a block from the replier, muted them or
 * hid the post gets nothing. Returns how many alerts were stored.
 */
async function replyCreated({ postId, reply, skipUserIds = [] }) {
  if (!reply?.id || !reply.user_id || reply.is_deleted || (reply.moderation_state || 'live') !== 'live') return 0;
  const { data: post, error } = await db.from('Post').select(POST_SELECT).eq('id', postId).maybeSingle();
  if (error) throw error;
  if (!post) return 0;
  const now = new Date().toISOString();
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error: followError } = await db.from('PulseFollow').select('id, user_id, ends_on_resolve')
      .eq('target_type', 'post').eq('target_id', post.id).eq('notify', 'each')
      .or(`until_at.is.null,until_at.gt.${now}`).order('created_at').order('id').range(from, from + 999);
    if (followError) throw followError;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const skip = new Set([reply.user_id, ...skipUserIds].filter(Boolean).map(String));
  const open = follows.open(post);
  const body = subjectOf(post);
  let stored = 0;
  for (const row of rows) {
    if (skip.has(String(row.user_id)) || (row.ends_on_resolve && !open)) continue;
    try {
      const filters = await getMuteAndHideFilters(row.user_id);
      if (filters.blockedUserIds.has(reply.user_id) || filters.mutedUserIds.has(reply.user_id)
        || filters.hiddenPostIds.has(post.id)) continue;
      if (!await canReadPost(post, row.user_id, await postScopeAccess(row.user_id))) continue;
      const notice = await notificationService.createNotification({
        userId: row.user_id, type: TYPE, title: 'New reply to a post you follow', body, icon: '💬',
        link: `/posts/${post.id}`, idempotencyKey: `${TYPE}:${reply.id}:${row.user_id}`, sendPush: false,
        metadata: { post_id: post.id, comment_id: reply.id, user_id: reply.user_id, follow_id: row.id },
      });
      if (notice) stored += 1;
    } catch (alertError) {
      logger.warn('pulse.follow_alert.failed', { postId: post.id, error: alertError.message });
    }
  }
  return stored;
}

module.exports = { TYPE, replyCreated };
