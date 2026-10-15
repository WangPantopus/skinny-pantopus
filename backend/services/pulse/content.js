'use strict';

// Pulse content for PC's digest and helper nudge (S13). In-process only: no route serves
// it. Everything reads through the Pulse feed's own scan or the conversation read, so the
// area wall, canReadPost, moderation, blocks, mutes, hides and open areas hold exactly as
// on the page. Items carry no distance and no media, and nothing here advances a marker.
const db = require('../../config/supabaseAdmin');
const feed = require('./feed');
const conversation = require('./conversation');
const follows = require('./follows');
const seen = require('./seen');
const { postCards } = require('./cards');
const { openAreas, areaDto, AREA_SELECT } = require('./areas');
const { UUID } = require('./feedCursor');

const HOUR_MS = 60 * 60 * 1000;

function fail(message) {
  return Object.assign(new Error(message), { status: 400, code: 'INVALID_CONTENT_QUERY' });
}
function timeOf(value, name) {
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(time)) throw fail(`${name} must be a time.`);
  return new Date(time).toISOString();
}
function wholeNumber(value, name, fallback, max) {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || value < 0 || value > max) throw fail(`${name} must be a whole number from 0 to ${max}.`);
  return value;
}
async function checked(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
async function allRows(makeQuery) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const page = await checked(makeQuery().range(from, from + 999));
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

// Media and distance never go into a digest; the rest is the feed's own PulsePost.
function plain(card) {
  return { ...card, media: [], author: { ...card.author, distance_text: null } };
}
async function plainCards(rows, context) {
  const ids = [...new Set(rows.map(row => row.area_id).filter(Boolean))];
  const areas = ids.length ? await checked(openAreas(db.from('PulseArea').select(AREA_SELECT)).in('id', ids)) : [];
  return (await postCards(rows, { viewerId: context.userId, homes: context.homes, areas,
    fallbackArea: context.area, blockedIds: context.filters.blockedUserIds })).map(plain);
}

/**
 * What is new for a digest: open posts by other people that the viewer can read in their
 * town (or `areaId`), created after `since` and at or before `until`. Grouped as on the
 * page (the reader's street, neighborhood, then the town), newest first, at most
 * `perGroup` items in a group and `limit` in all, filled in that order. `total` counts
 * every such post and each group's `total` its own, so a capped digest can say how many
 * more there are.
 */
async function digestPosts(viewerId, { since, until, limit, perGroup, areaId } = {}) {
  const lower = timeOf(since, 'since');
  const readAt = timeOf(until ?? new Date(), 'until');
  const max = wholeNumber(limit, 'limit', 8, 50);
  const each = wholeNumber(perGroup, 'perGroup', max, 50);
  const context = await feed.contextFor(viewerId, areaId);
  const result = { area: areaDto(context.area), since: lower, until: readAt, total: 0, groups: [] };
  if (!context.area || Date.parse(lower) >= Date.parse(readAt)) return result;
  const rows = await feed.scan(context, { view: 'nearby', lower, readAt,
    refine: query => query.neq('user_id', viewerId) });
  // Group by the page's own rule, then build cards only for the items kept.
  let room = max;
  const groups = feed.groupsFor(rows.map(row => ({ id: row.id, about: { area_id: row.area_id } })), context, false)
    .map(group => {
      const items = group.items.slice(0, Math.min(each, room));
      room -= items.length;
      return { ...group, total: group.items.length, items };
    });
  const byId = new Map(rows.map(row => [row.id, row]));
  const cards = new Map((await plainCards(groups.flatMap(group => group.items.map(item => byId.get(item.id))), context))
    .map(card => [card.id, card]));
  return { ...result, total: rows.length,
    groups: groups.map(group => ({ ...group, items: group.items.map(item => cards.get(item.id)) })) };
}

// Topics of Asks the viewer answered: a live reply on someone else's Ask.
async function answeredTopics(viewerId) {
  const rows = await checked(db.from('PostComment').select('post:post_id!inner(user_id, topic, post_type)')
    .eq('user_id', viewerId).eq('is_deleted', false).eq('moderation_state', 'live')
    .eq('post.post_type', 'ask_local').not('post.topic', 'is', null)
    .order('created_at', { ascending: false }).limit(1000));
  return new Set(rows.filter(row => row.post && row.post.user_id !== viewerId).map(row => row.post.topic));
}

// The Asks among `posts` that someone other than the asker has a live reply on (the
// same test an Ask's ending uses for `closed_unanswered`).
async function repliedTo(posts) {
  if (!posts.length) return new Set();
  const asker = new Map(posts.map(post => [post.id, post.user_id]));
  const rows = await allRows(() => db.from('PostComment').select('id, post_id, user_id')
    .in('post_id', [...asker.keys()]).eq('is_deleted', false).eq('moderation_state', 'live')
    .not('user_id', 'is', null).order('id'));
  return new Set(rows.filter(row => row.user_id !== asker.get(row.post_id)).map(row => row.post_id));
}

/**
 * Open Asks by other people that nobody but the asker has answered, created at least
 * `minAgeHours` ago, in a topic the viewer follows there (matched as Following matches
 * a topic follow) or has answered an Ask in before. Newest first, at most `limit`;
 * `excludePostIds` skips Asks the caller already showed this person.
 */
async function unansweredForHelper(viewerId, { minAgeHours, limit, excludePostIds = [], areaId } = {}) {
  const age = wholeNumber(minAgeHours, 'minAgeHours', 24, 24 * 14);
  const max = wholeNumber(limit, 'limit', 1, 50);
  if (!Array.isArray(excludePostIds) || excludePostIds.some(id => typeof id !== 'string' || !UUID.test(id))) {
    throw fail('excludePostIds must be post ids.');
  }
  const context = await feed.contextFor(viewerId, areaId);
  if (!context.area || !max) return { posts: [] };
  const topicFollows = context.follows.filter(row => row.target_type === 'topic');
  const answered = await answeredTopics(viewerId);
  const topics = [...new Set([...topicFollows.map(row => row.target_id), ...answered])];
  if (!topics.length) return { posts: [] };
  const rows = await feed.scan(context, {
    view: 'nearby', readAt: new Date(Date.now() - age * HOUR_MS).toISOString(), take: max,
    refine: query => {
      const asks = query.eq('post_type', 'ask_local').neq('user_id', viewerId).in('topic', topics);
      return excludePostIds.length ? asks.not('id', 'in', `(${excludePostIds.join(',')})`) : asks;
    },
    keep: async posts => {
      const relevant = posts.filter(post => answered.has(post.topic)
        || follows.matches(topicFollows, post, context.area.id));
      const replied = await repliedTo(relevant);
      return relevant.filter(post => !replied.has(post.id));
    },
  });
  return { posts: await plainCards(rows, context) };
}

/**
 * Conversations the viewer follows with notify `recap` or `each` that got replies from
 * someone else after `since` (and at or before `until`), each with those replies as
 * PulseReply rows, oldest first; the conversation with the newest reply comes first. A
 * follow that ended with its conversation ("until it ends"), a conversation the viewer
 * can no longer read and removed replies are left out.
 */
async function followRecaps(viewerId, { since, until } = {}) {
  const lower = timeOf(since, 'since');
  const upper = timeOf(until ?? new Date(), 'until');
  const rows = (await follows.activeRows(viewerId))
    .filter(row => row.target_type === 'post' && ['recap', 'each'].includes(row.notify));
  const conversations = [];
  for (const row of rows) {
    // PostgreSQL compares the window, so sub-millisecond replies land in exactly one recap.
    const fresh = new Set((await allRows(() => db.from('PostComment').select('id').eq('post_id', row.target_id)
      .gt('created_at', lower).lte('created_at', upper).order('id'))).map(reply => reply.id));
    if (!fresh.size) continue;
    let read;
    try {
      read = await conversation.read(row.target_id, viewerId);
    } catch (error) {
      if ([403, 404].includes(error.status)) continue;
      throw error;
    }
    if (row.ends_on_resolve && read.post.status.state !== 'open') continue;
    const replies = read.replies.filter(reply => fresh.has(reply.id) && !reply.removed && reply.author.id !== viewerId)
      .map(reply => ({ ...reply, author: { ...reply.author, distance_text: null } }));
    if (replies.length) conversations.push({ follow: follows.dto(row), post: plain(read.post), replies });
  }
  const newest = item => Date.parse(item.replies[item.replies.length - 1].created_at);
  conversations.sort((a, b) => newest(b) - newest(a));
  return { since: lower, until: upper, conversations };
}

/** The viewer's in-app seen marker for `nearby` or `following`; null before a first visit. Read only. */
async function getSeenMarker(viewerId, view = 'nearby') {
  if (!['nearby', 'following'].includes(view)) throw fail('view must be nearby or following.');
  return seen.lastSeen(viewerId, view);
}

module.exports = { digestPosts, unansweredForHelper, followRecaps, getSeenMarker };
