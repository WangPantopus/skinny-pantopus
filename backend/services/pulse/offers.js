'use strict';

// The offer block of a PulsePost for one reader (contract §2.1, §2.8). Kept apart from the
// claim actions so the card serializer can use it without loading the conversation.
const db = require('../../config/supabaseAdmin');

const MAX_OPEN_REQUESTS = 5;

function open(post, at = Date.now()) {
  return post.state === 'open' && !post.resolution && !post.archived_at
    && (!post.expires_at || Date.parse(post.expires_at) > at);
}

/** The offer block of a PulsePost for one reader (2.1, 2.8), from that offer's claim rows. */
function offerState(post, claims, viewerId) {
  const own = claims.find(claim => claim.claimer_id === viewerId) || null;
  const requested = claims.filter(claim => claim.status === 'requested').length;
  const gone = post.resolution === 'claimed';
  const mode = post.claim_mode || 'choose';
  return {
    claim_mode: mode, gone,
    requests_open: open(post) && !gone && (mode === 'first' || requested < MAX_OPEN_REQUESTS),
    viewer_claim: own && own.claimer_id !== post.user_id ? { id: own.id, status: own.status } : null,
  };
}

/** Claim rows for a page of posts; only offers are looked up. */
async function claimsFor(posts) {
  const ids = posts.filter(post => post.post_type === 'offer').map(post => post.id);
  const byPost = new Map(ids.map(id => [id, []]));
  for (let from = 0; ids.length; from += 1000) {
    const { data, error } = await db.from('OfferClaim').select('id, post_id, claimer_id, status')
      .in('post_id', ids).order('created_at').order('id').range(from, from + 999);
    if (error) throw error;
    for (const row of data || []) byPost.get(row.post_id).push(row);
    if ((data || []).length < 1000) break;
  }
  return byPost;
}

module.exports = { offerState, claimsFor, MAX_OPEN_REQUESTS };
