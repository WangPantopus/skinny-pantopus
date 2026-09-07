const { personaPostVisibleToViewer, filterFollowingPosts } = require('../utils/personaPostVisibility');

// The clients display 25+ at this ceiling. It applies to permitted posts
// within EACH Beacon, never to a shared pool across the whole follow list.
const UNREAD_CAP = 25;
const QUERY_CONCURRENCY = 5;
const POST_FIELDS = 'id, identity_context_id, content, title, created_at, archived_at, ' +
  'visibility, audience, distribution_targets, target_tier_rank, post_metadata';

async function loadMembershipActivity(membership, db) {
  const viewerRank = Math.max(
    Number(membership.tier?.rank || 0),
    membership.relationship_type === 'subscriber' ? 2 : 1,
  );
  const query = db.from('Post').select(POST_FIELDS)
    .eq('identity_context_type', 'persona')
    .eq('identity_context_id', membership.persona_id);
  const { data, error } = await filterFollowingPosts(query, viewerRank)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(UNREAD_CAP);
  if (error) throw error;

  // Retain the application-side permission check as defense in depth.
  // Preserve database order for timestamps that differ below JavaScript's
  // millisecond precision; only identical timestamp strings use the ID tie.
  const posts = (data || [])
    .filter((post) => personaPostVisibleToViewer(post, viewerRank))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      || (a.created_at === b.created_at ? String(b.id).localeCompare(String(a.id)) : 0))
    .slice(0, UNREAD_CAP);
  const cutoff = membership.last_seen_at || membership.joined_at;
  const cutoffMs = cutoff ? new Date(cutoff).getTime() : 0;
  return {
    membership,
    latestPost: posts[0] || null,
    unreadCount: cutoffMs
      ? posts.filter((post) => new Date(post.created_at).getTime() > cutoffMs).length
      : posts.length,
  };
}

/**
 * Each Beacon gets its own visibility-filtered query. Bound concurrent
 * requests so a long follow list cannot exhaust the PostgREST connection
 * pool. All activity must be available before global sorting/pagination;
 * an error rejects the list rather than presenting partial empty updates.
 */
async function loadFollowingActivity(memberships, { db = require('../config/supabaseAdmin') } = {}) {
  const decorated = [];
  for (let start = 0; start < memberships.length; start += QUERY_CONCURRENCY) {
    const batch = memberships.slice(start, start + QUERY_CONCURRENCY);
    decorated.push(...await Promise.all(batch.map((membership) => loadMembershipActivity(membership, db))));
  }
  return decorated;
}

module.exports = { loadFollowingActivity, UNREAD_CAP, QUERY_CONCURRENCY };
