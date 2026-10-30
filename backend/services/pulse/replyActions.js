'use strict';

const { createHash } = require('crypto');
const db = require('../../config/supabaseAdmin');
const conversation = require('./conversation');
const { UUID } = require('./feedCursor');
const notices = require('./notices');
const { onlyShownReplies } = require('./readAccess');

// The reasons of today's post report (routes/posts.js reportPostSchema).
const REPORT_REASONS = new Set(['spam', 'harassment', 'inappropriate', 'misinformation', 'safety', 'other']);

const ERRORS = {
  POST_NOT_FOUND: [404, 'This conversation is not available.'],
  POST_CHANGED: [409, 'This conversation changed. Refresh it and try again.'],
  REPLY_NOT_FOUND: [404, 'This reply is not available.'],
  NOT_POST_AUTHOR: [403, 'Only the person who asked can mark a reply Helpful.'],
  NOT_AN_ASK: [400, 'Only questions can have Helpful replies.'],
  OWN_REPLY: [400, "You can't thank your own reply."],
  INVALID_ACTION: [400, 'Choose a valid reply action.'],
  INVALID_REPORT: [400, 'Choose a reason, and keep the details to 1,000 characters.'],
};
function refusal(code) {
  const [status, message] = ERRORS[code] || ERRORS.INVALID_ACTION;
  return Object.assign(new Error(message), { status, code });
}

async function act(postId, replyId, viewerId, action, helpful) {
  if (!UUID.test(replyId)) throw refusal('REPLY_NOT_FOUND');
  const context = await conversation.contextFor(postId, viewerId);
  const { data, error } = await db.rpc('pulse_reply_action', {
    p_post_id: postId, p_reply_id: replyId, p_user_id: viewerId, p_action: action,
    p_helpful: helpful ?? null, p_read_scope: context.post.read_scope, p_area_id: context.post.area_id,
  });
  if (error) throw error;
  if (data.code) throw refusal(data.code);
  if (action === 'thanks' || helpful) {
    const type = action === 'thanks' ? 'pulse_thanks' : 'pulse_helpful';
    if (data.to_user_id !== viewerId) await notices.notify({
      userId: data.to_user_id, type,
      title: action === 'thanks' ? 'A neighbor thanked you' : 'Your reply helped',
      body: action === 'thanks' ? 'A neighbor sent you a private thanks for your reply.' : 'The person who asked marked your reply Helpful.',
      postId, actorId: viewerId,
      metadata: { comment_id: replyId, ...(data.helpful_at ? { helpful_at: data.helpful_at } : {}) },
      key: `${type}:${data.thanks_id || `${replyId}:${data.helpful_at}`}`,
    });
  }
  // An Ask that asked a Known entry again refreshes it once a reply helped (contract §2.14).
  if (action === 'helpful' && helpful && context.post.post_metadata?.known_entry_id) {
    await require('./known').answered(context.post, replyId).catch(knownError => {
      require('../../utils/logger').warn('pulse.known.refresh_failed', { postId, error: knownError.message });
    });
  }
  if (action === 'thanks') return { thanked: true };
  const result = await conversation.read(postId, viewerId);
  const reply = result.replies.find(row => row.id === replyId);
  if (!reply) throw refusal('REPLY_NOT_FOUND');
  return { reply, post_status: result.post.status };
}

/** A report about one reply joins the existing post report queue with its comment_id
 * (contract §2.7). One per person per reply; a retry answers the same and never overwrites. */
async function report(postId, replyId, viewerId, { reason, details } = {}) {
  if (!REPORT_REASONS.has(reason) || (details != null && (typeof details !== 'string' || details.length > 1000))) {
    throw refusal('INVALID_REPORT');
  }
  if (!UUID.test(replyId)) throw refusal('REPLY_NOT_FOUND');
  const context = await conversation.contextFor(postId, viewerId);
  const { data: reply, error } = await onlyShownReplies(db.from('PostComment').select('id, user_id')
    .eq('id', replyId).eq('post_id', context.post.id).eq('is_deleted', false), viewerId).maybeSingle();
  if (error) throw error;
  if (!reply?.user_id || context.blocked.has(reply.user_id)) throw refusal('REPLY_NOT_FOUND');
  if (reply.user_id === viewerId) throw Object.assign(refusal('OWN_REPLY'), { message: "You can't report your own reply." });
  const reportId = createHash('sha256')
    .update(`pantopus:reply-report:v1:${reply.id.toLowerCase()}:${viewerId.toLowerCase()}`)
    .digest('hex').slice(0, 32);
  const { data: inserted, error: insertError } = await db.from('PostReport').upsert({
    id: reportId, post_id: context.post.id, comment_id: reply.id, reported_by: viewerId,
    reason, details: details || null,
  }, { onConflict: 'id', ignoreDuplicates: true }).select('id');
  if (insertError) throw insertError;
  // Only the request that wrote the row alerts the reviewers.
  if (inserted?.length) require('../adminAlerts').notifyReportToReview({ kind: 'reply', reason, reportId }).catch(() => {});
  return { ok: true };
}

module.exports = { act, report };
