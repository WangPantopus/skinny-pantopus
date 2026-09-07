/** Audience policy shared by Beacon post lists and Following previews. */
function personaPostVisibleToViewer(post, viewerRank = 0) {
  if (!post) return false;
  if (post.archived_at || post.status === 'removed') return false;
  const broadcastStatus = post.post_metadata?.broadcast_status;
  if (broadcastStatus != null && broadcastStatus !== 'published') return false;
  const requiredRank = Number(post.target_tier_rank || 0);
  if (requiredRank > 0) return viewerRank >= requiredRank;
  if (post.audience === 'public' || post.visibility === 'public') return true;
  const targets = Array.isArray(post.distribution_targets) ? post.distribution_targets : [];
  const followerOnly = post.audience === 'followers'
    || post.visibility === 'followers'
    || targets.includes('persona_followers');
  return viewerRank >= 1 && followerOnly;
}

/**
 * Apply the same policy in PostgREST BEFORE ordering/limiting. Following
 * passes the rank of an active, unblocked membership (at least Follower).
 * Keep parity with personaPostVisibleToViewer; real PostgREST contract tests
 * cover the nested OR, JSON status, and array-containment predicates.
 */
function filterFollowingPosts(query, viewerRank) {
  if (!Number.isInteger(viewerRank) || viewerRank < 1 || viewerRank > 4) {
    throw new Error('Invalid Following membership rank');
  }
  return query
    .is('archived_at', null)
    .or('post_metadata->>broadcast_status.is.null,post_metadata->>broadcast_status.eq.published')
    .or([
      `and(target_tier_rank.gt.0,target_tier_rank.lte.${viewerRank})`,
      'and(or(target_tier_rank.is.null,target_tier_rank.eq.0),' +
        'or(audience.eq.public,visibility.eq.public,audience.eq.followers,' +
        'visibility.eq.followers,distribution_targets.cs.{persona_followers}))',
    ].join(','));
}

module.exports = { personaPostVisibleToViewer, filterFollowingPosts };
