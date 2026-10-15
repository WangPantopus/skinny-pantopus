'use strict';

const db = require('../../config/supabaseAdmin');
const legacy = require('../feedService');
const blockService = require('../blockService');
const { SAFE_CREATOR_SELECT } = require('../../serializers/identitySerializers');
const { homeAreaContext, myAreas, labelFor, openAreas, AREA_SELECT } = require('./areas');
const { canReadPost, onlyShownReplies, postScopeAccess } = require('./readAccess');
const { postCards } = require('./cards');
const { distanceFormatter } = require('./distanceText');
const parsePoint = require('../../utils/parsePostGISPoint');
const { UUID } = require('./feedCursor');

const POST_SELECT = `${legacy.FEED_POST_SELECT}, allow_external_share, moderation_state, radius_miles, right_now_event_id`;
const REPLY_SELECT = `id, post_id, user_id, comment, parent_comment_id, created_at, is_edited, is_deleted,
  moderation_state, helpful_at, helpful_by, author:user_id (${SAFE_CREATOR_SELECT})`;

async function checked(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
function unavailable(status = 404) {
  return Object.assign(new Error('This conversation is not available.'), { status, code: 'POST_NOT_FOUND' });
}

/** The same reader wall as every old endpoint. The Pulse DTO never represents a
 * household or persona identity, which keeps their separate identity rules intact.
 */
async function contextFor(postId, viewerId) {
  if (!UUID.test(postId)) throw unavailable();
  const post = await checked(db.from('Post').select(POST_SELECT).eq('id', postId).maybeSingle());
  if (!post) throw unavailable();
  if (['home', 'persona'].includes(post.identity_context_type) || ['home', 'persona'].includes(post.post_as)
      || post.audience === 'household') throw unavailable();
  const homes = await homeAreaContext(viewerId);
  if (!await canReadPost(post, viewerId, await postScopeAccess(viewerId, homes))) throw unavailable(403);
  const [blocked, authorHomes] = await Promise.all([blockService.blockedUserIds(viewerId), homeAreaContext(post.user_id)]);
  const area = post.area_id
    ? await checked(openAreas(db.from('PulseArea').select(AREA_SELECT)).eq('id', post.area_id).maybeSingle())
    : (await myAreas(post.user_id, authorHomes)).town;
  return { post, viewerId, homes, blocked, area, authorHomes };
}

async function allRows(makeQuery) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const page = await checked(makeQuery().order('created_at').order('id').range(from, from + 999));
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

function firstLevel(id, topology) {
  let current = id;
  const visited = new Set();
  while (topology.has(current) && !visited.has(current)) {
    visited.add(current);
    const parent = topology.get(current);
    if (!parent || !topology.has(parent)) return current;
    current = parent;
  }
  // Old or malformed data must not loop or hide the rest of a conversation.
  return id;
}

/** People in a conversation (reply authors, offer requesters) as its reader sees them:
 * the feed's identity projection, the label in the post's area and a distance from a
 * verified primary home only. `people` are `{ user_id, author }` rows, where `author`
 * is a SAFE_CREATOR_SELECT row. No home id, point or measured distance is serialized.
 */
async function authorProjector(context, people, distance) {
  const { post, viewerId, area } = context;
  // The feed's identity projection honors the chosen LocalProfile name. Raw
  // SAFE_CREATOR_SELECT intentionally has no private name fields and is only a
  // fallback handle, so projecting it alone would disagree with the post header.
  const identityInputs = new Map([[post.user_id, post]]);
  for (const person of people) if (person.user_id && !identityInputs.has(person.user_id)) {
    identityInputs.set(person.user_id, { user_id: person.user_id, creator: person.author });
  }
  const identities = await legacy.attachIdentityAuthors([...identityInputs.values()], viewerId);
  const identityByUser = new Map([...identityInputs.keys()].map((id, i) => [id, identities[i]?.author]));
  const authors = new Map();
  const authorFor = person => {
    if (!authors.has(person.user_id)) authors.set(person.user_id, (async () => {
      const identity = identityByUser.get(person.user_id);
      const authorHomes = person.user_id === post.user_id ? context.authorHomes : await homeAreaContext(person.user_id);
      const label = await labelFor({ userId: person.user_id, accountType: person.author?.account_type,
        origin: person.author?.account_type === 'curator' ? 'curator' : null,
        identityType: person.author?.account_type === 'business' ? 'business' : 'local' }, area?.id, authorHomes);
      let name = identity?.displayName || 'Neighbor';
      if (post.read_scope === 'public' && label !== 'official') name = name.trim().split(/\s+/)[0] || 'Neighbor';
      const home = authorHomes.primary?.verified
        ? await checked(db.from('Home').select('location').eq('id', authorHomes.primary.id).maybeSingle()) : null;
      const point = parsePoint(home?.location);
      return { id: person.user_id, display_name: name, label, avatar_url: identity?.avatarUrl || null,
        distance_text: point ? await distance({ ...point, location_precision: 'approx_area' }) : null,
        is_curator: person.author?.account_type === 'curator' };
    })());
    return authors.get(person.user_id);
  };
  return { identityByUser, authorFor };
}

/** Flat, stable replies; hidden parents supply only ancestry, never a name or text.
 * Deleted authors/rows become anonymous placeholders. Distance uses only a
 * verified author's primary home, snapped through the same privacy helper as a
 * post; no home id, point or measured distance is serialized.
 */
async function repliesFor(context, after) {
  const { post, viewerId, homes, blocked } = context;
  const [topologyRows, rows, distance, newerRows, thanks] = await Promise.all([
    allRows(() => db.from('PostComment').select('id, parent_comment_id, created_at').eq('post_id', post.id)),
    allRows(() => {
      let query = onlyShownReplies(db.from('PostComment').select(REPLY_SELECT).eq('post_id', post.id), viewerId);
      if (blocked.size) query = query.or(`user_id.is.null,user_id.not.in.(${[...blocked].join(',')})`);
      return query;
    }),
    distanceFormatter(viewerId, { homes }),
    after ? allRows(() => db.from('PostComment').select('id, created_at')
      .eq('post_id', post.id).gt('created_at', after)) : null,
    allRows(() => db.from('CommentThanks').select('id, comment_id, created_at, reply:comment_id!inner(post_id)')
      .eq('from_user_id', viewerId).eq('reply.post_id', post.id)),
  ]);
  const thanked = new Set(thanks.map(row => row.comment_id));
  const { identityByUser, authorFor } = await authorProjector(context, rows, distance);
  const asker = identityByUser.get(post.user_id);
  let helpfulTo = asker?.displayName || 'Neighbor';
  if (post.read_scope === 'public') helpfulTo = helpfulTo.trim().split(/\s+/)[0] || 'Neighbor';
  const topology = new Map(topologyRows.map(row => [row.id, row.parent_comment_id]));
  const result = await Promise.all(rows.map(async row => {
    const removed = row.is_deleted === true || !row.user_id;
    return {
      id: row.id, post_id: row.post_id, parent_comment_id: row.parent_comment_id,
      branch_id: firstLevel(row.id, topology), reply_to: null,
      text: removed ? '' : row.comment, created_at: row.created_at, edited: !removed && !!row.is_edited,
      author: removed ? { id: null, display_name: 'Reply removed', label: 'visitor',
        distance_text: null, avatar_url: null, is_curator: false } : await authorFor(row),
      helpful: !removed && !!row.helpful_at, helpful_to: !removed && row.helpful_at ? helpfulTo : null,
      can_thank: !removed && row.user_id !== viewerId,
      thanked_by_viewer: !removed && thanked.has(row.id), removed, moderation: { state: row.moderation_state },
    };
  }));
  const visible = new Map(result.map(reply => [reply.id, reply]));
  for (const reply of result) {
    if (reply.parent_comment_id) reply.reply_to = { comment_id: reply.parent_comment_id,
      display_name: visible.get(reply.parent_comment_id)?.author.display_name || 'Reply unavailable' };
  }
  // Let PostgreSQL compare timestamps so sub-millisecond replies are not lost.
  const newer = newerRows && new Set(newerRows.map(row => row.id));
  return newer ? result.filter(reply => newer.has(reply.id)) : result;
}

async function addCreatedReplyFields(comment, post, viewerId) {
  if (!post.distribution_targets?.includes('place') || ['home', 'persona'].includes(post.identity_context_type)) return comment;
  const context = await contextFor(post.id, viewerId);
  const bridge = require('./planBridge');
  const [replies, plan] = await Promise.all([repliesFor(context), bridge.forConversation(post.id, viewerId)]);
  const reply = bridge.decorateReplies(replies, plan).find(row => row.id === comment.id);
  if (!reply) throw unavailable();
  return { ...comment, ...reply, author: { ...comment.author, ...reply.author } };
}

async function read(postId, viewerId, { repliesOnly = false, after } = {}) {
  const context = await contextFor(postId, viewerId);
  // The plan suggested from this conversation, as its reader may see it (contract §2.18).
  const bridge = require('./planBridge');
  const [rows, plan] = await Promise.all([repliesFor(context, after), bridge.forConversation(context.post.id, viewerId)]);
  const replies = bridge.decorateReplies(rows, plan);
  if (repliesOnly) return { replies };
  const [post] = await postCards([context.post], { viewerId, homes: context.homes,
    areas: context.area ? [context.area] : [], fallbackArea: context.area, blockedIds: context.blocked });
  return { post, replies, plan: plan.plan };
}

module.exports = { contextFor, repliesFor, read, addCreatedReplyFields, authorProjector, unavailable };
