// How Pulse posts end (contract §1 and §5, slice S7). Shared by the archive job, the day-6 Ask
// reminder and the Ask's own keep-open and close actions.

const supabaseAdmin = require('../../config/supabaseAdmin');

const DAY_MS = 24 * 60 * 60 * 1000;
// The audiences whose older posts end by their type's window; network and private posts don't.
const LOCAL_AUDIENCES = ['nearby', 'neighborhood', 'saved_place', 'target_area'];
const REPLY_PAGE_SIZE = 1000;
// The days a type stays up when nothing else says (PostCategoryTTL has the real rows).
const DEFAULT_WINDOW_DAYS = 7;
// The endings that time gives a post (or its author's close); restoring such a post reopens it.
const TIMED_OUT_RESOLUTIONS = ['expired', 'closed', 'closed_unanswered', 'happened'];

// How a post ends when its time runs out.
function resolutionWhenTimeRunsOut(post, repliedAskIds) {
  if (post.post_type === 'ask_local') return repliedAskIds.has(post.id) ? 'closed' : 'closed_unanswered';
  if (post.post_type === 'lost_found') return 'closed';
  if (post.post_type === 'event') return 'happened';
  return 'expired';
}

// The ids of the Asks (rows with `id` and `user_id`) that someone other than the asker replied to.
async function askIdsWithReplies(asks) {
  const replied = new Set();
  if (!asks.length) return replied;
  const askerByPost = new Map(asks.map((post) => [post.id, post.user_id]));

  for (let from = 0; ; from += REPLY_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('PostComment')
      .select('post_id, user_id')
      .in('post_id', [...askerByPost.keys()])
      .eq('is_deleted', false)
      .order('id', { ascending: true })
      .range(from, from + REPLY_PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to read replies: ${error.message}`);
    for (const reply of data || []) {
      if (reply.user_id !== askerByPost.get(reply.post_id)) replied.add(reply.post_id);
    }
    if (!data || data.length < REPLY_PAGE_SIZE) return replied;
  }
}

// A type's window in days (PostCategoryTTL).
async function windowDays(postType) {
  const { data } = await supabaseAdmin
    .from('PostCategoryTTL').select('ttl_days').eq('post_type', postType).maybeSingle();
  return data?.ttl_days || DEFAULT_WINDOW_DAYS;
}

// When a post ends: its own end time, else its type's window from when it was posted.
function endsAt(post, days) {
  if (post.expires_at) return new Date(post.expires_at);
  return new Date(new Date(post.created_at).getTime() + days * DAY_MS);
}

module.exports = {
  DAY_MS,
  LOCAL_AUDIENCES,
  TIMED_OUT_RESOLUTIONS,
  resolutionWhenTimeRunsOut,
  askIdsWithReplies,
  windowDays,
  endsAt,
};
