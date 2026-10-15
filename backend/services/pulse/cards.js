'use strict';

const db = require('../../config/supabaseAdmin');
const feed = require('../feedService');
const { labelFor, homeAreaContext } = require('./areas');
const { distanceFormatter } = require('./distanceText');
const { onlyShownReplies, isPubliclyShareable } = require('./readAccess');
const { DAY_MS, endsAt } = require('./lifecycle');
const follows = require('./follows');
const { offerState, claimsFor } = require('./offers');
const { waitingLines } = require('./rightNow');

const TYPES = new Set(['ask_local', 'share', 'offer', 'alert', 'event', 'lost_found']);
const ACTIONS = { ask_local: ['answer', 'Answer'], share: ['reply', 'Reply'], offer: ['claim', 'Ask for it'],
  alert: ['seen_it', 'Seen it'], event: ['going', 'Going'] };

// Count only replies this reader can see, with the same moderation/block predicate as
// the conversation. Stored comment_count includes held replies and cannot be reused.
async function replyCounts(posts, viewerId, blockedIds) {
  const counts = new Map();
  if (!posts.length) return counts;
  for (let from = 0; ; from += 1000) {
    let query = onlyShownReplies(db.from('PostComment').select('post_id, user_id')
      .in('post_id', posts.map(post => post.id)).eq('is_deleted', false), viewerId)
      .order('id').range(from, from + 999);
    if (blockedIds?.size) query = query.not('user_id', 'in', `(${[...blockedIds].join(',')})`);
    const { data, error } = await query;
    if (error) throw error;
    for (const reply of data || []) counts.set(reply.post_id, (counts.get(reply.post_id) || 0) + 1);
    if ((data || []).length < 1000) return counts;
  }
}

/** Serialize already-authorized raw Post rows. Never spread a row into the DTO.
 * Keep the original rows for policy/ownership and distance; legacy enrichment mutates
 * copies and supplies only its existing public identity/media and viewer action state.
 */
async function postCards(rows, { viewerId, homes, areas, fallbackArea, blockedIds, publicResponse = false }) {
  if (!rows.length) return [];
  const [enriched, counts, distance, ttlResult, followed, claims, waiting] = await Promise.all([
    feed.enrichFeedPosts(rows.map(row => feed.normalizeFeedPostRow(row)), viewerId),
    replyCounts(rows, viewerId, blockedIds),
    distanceFormatter(viewerId, { homes, publicResponse }),
    db.from('PostCategoryTTL').select('post_type, ttl_days'),
    viewerId ? follows.activeRows(viewerId) : [],
    claimsFor(rows),
    waitingLines(rows),
  ]);
  if (ttlResult.error) throw ttlResult.error;
  const days = new Map((ttlResult.data || []).map(row => [row.post_type, row.ttl_days]));
  const contexts = new Map();
  const areaById = new Map(areas.map(area => [area.id, area]));
  const readAt = Date.now();
  return Promise.all(rows.map(async (raw, index) => {
    const post = enriched[index];
    const type = TYPES.has(raw.post_type) ? raw.post_type : 'legacy';
    const own = viewerId === raw.user_id;
    const about = areaById.get(raw.area_id) || fallbackArea;
    const identityType = raw.identity_context_type || (raw.post_as === 'business' ? 'business' : 'local');
    const author = { userId: raw.user_id, origin: raw.origin, accountType: raw.creator?.account_type, identityType };
    if (!contexts.has(raw.user_id)) contexts.set(raw.user_id, homeAreaContext(raw.user_id));
    const label = await labelFor(author, about?.id, await contexts.get(raw.user_id));
    let name = post.author?.displayName || post.creator?.displayName || 'Neighbor';
    // Public town content uses the chosen public identity's first name, never legal-name fields.
    if ((raw.read_scope === 'public' || publicResponse) && !['pantopus', 'official', 'business'].includes(label)) {
      name = name.trim().split(/\s+/)[0] || 'Neighbor';
    }
    const action = type === 'lost_found'
      ? raw.lost_found_type === 'found' ? ['its_mine', "It's mine"] : ['seen_it', 'Seen it']
      : ACTIONS[type] || ['reply', 'Reply'];
    const open = raw.state === 'open' && !raw.resolution && !raw.archived_at
      && (!raw.expires_at || Date.parse(raw.expires_at) > readAt);
    const askEnd = endsAt(raw, days.get(raw.post_type) || 7).getTime();
    const offer = type === 'offer' ? offerState(raw, claims.get(raw.id) || [], publicResponse ? null : viewerId) : null;
    const done = action[0] === 'claim' ? ['requested', 'chosen'].includes(offer?.viewer_claim?.status)
      : ['seen_it', 'going'].includes(action[0]) && !!post.userHasLiked;
    return {
      id: raw.id, type, legacy_type: type === 'legacy' ? raw.post_type : null,
      topic: raw.topic || null, title: raw.title || null, text: raw.content || '',
      media: (post.media_urls || []).map((url, i) => ({ url, type: post.media_types?.[i] || 'image',
        thumbnail_url: post.media_thumbnails?.[i] || null })),
      created_at: raw.created_at,
      author: { id: publicResponse ? null : raw.user_id, display_name: name, label,
        distance_text: await distance(raw), avatar_url: post.author?.avatarUrl || null,
        is_curator: raw.origin === 'curator' },
      // The place a Pulse post's author named ("Crown Park"); otherwise its area. An older
      // row's location_name can be an address, so it is never shown here.
      about: { label: raw.post_metadata?.pulse_about || about?.name || null, area_id: about?.id || null },
      // A NULL legacy scope is intentionally preserved; it has its original audience rules.
      read_scope: raw.read_scope || null,
      // A Heads-up waiting on an active Right now event ends with it (contract §2.16).
      status: { state: open ? 'open' : 'resolved', resolution: raw.resolution || (raw.state === 'solved' ? 'answered' : null),
        ends_at: waiting.has(raw.right_now_event_id) && raw.post_metadata?.ends_with_event ? null
          : raw.expires_at || (type === 'ask_local' ? new Date(askEnd).toISOString() : null),
        ends_when: raw.post_metadata?.ends_with_event ? waiting.get(raw.right_now_event_id) || null : null },
      action: { kind: action[0], label: action[1], done },
      counts: { replies: counts.get(raw.id) || 0, going: type === 'event' ? Number(raw.like_count || 0) : null },
      event: type === 'event' ? { starts_at: raw.event_date || null, ends_at: raw.event_end_date || null,
        venue: raw.event_venue || null } : null,
      lost_found: type === 'lost_found' ? { kind: raw.lost_found_type || 'lost' } : null,
      offer,
      viewer: { is_author: own, following: followed.some(row => row.target_type === 'post' && row.target_id === raw.id
          && (!row.ends_on_resolve || follows.open(raw))), can_mark_helpful: own && type === 'ask_local',
        saved: !!post.userHasSaved, can_share: isPubliclyShareable(raw) && raw.moderation_state === 'live',
        can_keep_open: own && type === 'ask_local' && open && askEnd > readAt && !raw.post_metadata?.kept_open_at },
      moderation: { state: raw.moderation_state || 'live' },
    };
  }));
}

module.exports = { postCards };
