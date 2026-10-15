'use strict';

const db = require('../../config/supabaseAdmin');
const conversation = require('./conversation');
const { UUID } = require('./feedCursor');
const notices = require('./notices');

const ERRORS = {
  POST_NOT_FOUND: [404, 'This conversation is not available.'],
  POST_CHANGED: [409, 'This conversation changed. Refresh it and try again.'],
  REPLY_NOT_FOUND: [404, 'This reply is not available.'],
  NOT_POST_AUTHOR: [403, 'Only the person who asked can mark a reply Helpful.'],
  NOT_AN_ASK: [400, 'Only questions can have Helpful replies.'],
  OWN_REPLY: [400, "You can't thank your own reply."],
  INVALID_ACTION: [400, 'Choose a valid reply action.'],
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
      postId, replyId, actorId: viewerId, helpfulAt: data.helpful_at,
      key: `${type}:${data.thanks_id || `${replyId}:${data.helpful_at}`}`,
    });
  }
  if (action === 'thanks') return { thanked: true };
  const result = await conversation.read(postId, viewerId);
  const reply = result.replies.find(row => row.id === replyId);
  if (!reply) throw refusal('REPLY_NOT_FOUND');
  return { reply, post_status: result.post.status };
}

module.exports = { act };
