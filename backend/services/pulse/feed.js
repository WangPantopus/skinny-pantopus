'use strict';

const db = require('../../config/supabaseAdmin');
const legacy = require('../feedService');
const { homeAreaContext, myAreas, openAreas, areaDto, AREA_SELECT } = require('./areas');
const { postScopeAccess, canReadPost } = require('./readAccess');
const { displayedPoint } = require('./distanceText');
const { postCards } = require('./cards');
const seen = require('./seen');
const cursor = require('./feedCursor');
const follows = require('./follows');
const { DAY_MS } = require('./lifecycle');

const SELECT = `${legacy.FEED_POST_SELECT}, allow_external_share, moderation_state, radius_miles, pulse_post_town_id`;
const BATCH = 100;

async function checked(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
async function contextFor(userId, areaId) {
  const [homes, filters] = await Promise.all([homeAreaContext(userId), legacy.getMuteAndHideFilters(userId)]);
  const defaults = await myAreas(userId, homes);
  let area = defaults.town;
  if (areaId) {
    area = (await checked(openAreas(db.from('PulseArea').select(AREA_SELECT)).eq('id', areaId)))[0];
    if (!area) throw Object.assign(new Error('This area is not available.'), { status: 404, code: 'AREA_NOT_FOUND' });
    if (area.kind !== 'town' && (!['street', 'neighborhood'].includes(area.kind) || !homes.verifiedAreaIds.has(area.id))) {
      throw Object.assign(new Error('A verified address in this area is needed.'), { status: 403, code: 'NEEDS_VERIFIED_ADDRESS' });
    }
  }
  const available = homes.areas.filter(item => (item.kind === 'town' && (item.id === defaults.town?.id
    || homes.verifiedAreaIds.has(item.id))) || (['street', 'neighborhood'].includes(item.kind) && homes.verifiedAreaIds.has(item.id)));
  if (area && !available.some(item => item.id === area.id)) available.push(area);
  return { userId, homes, filters, area, available, defaults, scope: await postScopeAccess(userId, homes),
    follows: await follows.activeRows(userId) };
}

/** Read database chunks, then apply existing hide/mute/politics and legacy reader
 * checks before counting or taking the response page. New scopes are also a database
 * predicate. Never mistake an entirely filtered chunk for the end of the feed.
 */
async function scan(context, { view, topic, lower, before, readAt, take = Infinity, countOnly = false }) {
  if (!context.area || (view === 'following' && !context.follows.length)) return countOnly ? 0 : [];
  const found = [];
  let count = 0;
  let position = before;
  for (;;) {
    let query = context.scope.query(legacy.onlyShownPosts(db.rpc('pulse_feed_area_candidates', {
      p_area_id: context.area.id,
    }).select(SELECT).is('archived_at', null)))
      .eq('state', 'open').is('resolution', null).lte('created_at', readAt)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(BATCH);
    if (topic) query = query.eq('topic', topic);
    if (lower) query = query.gt('created_at', lower);
    if (position) query = legacy.applyCursorCondition(query, position.t, position.id);
    const rows = await checked(query);
    let eligible = legacy.applyMuteHideFilters(rows, context.filters, 'place', context.userId)
      .filter(post => !['home', 'persona'].includes(post.identity_context_type)
        && !['home', 'persona'].includes(post.post_as) && post.audience !== 'household');
    if (!context.filters.feedPreferences?.show_politics_place) eligible = eligible.filter(post => !legacy.isPoliticsPost(post));
    const points = eligible.filter(post => !post.area_id).map(post => {
      const point = displayedPoint(post);
      return point ? { id: post.id, ...point } : null;
    }).filter(Boolean);
    const legacyIds = new Set(points.length ? (await checked(db.rpc('pulse_area_contains_displayed_points', {
      p_area_id: context.area.id, p_points: points,
    }))).map(row => row.id) : []);
    eligible = eligible.filter(post => post.area_id || legacyIds.has(post.id));
    if (view === 'following') eligible = eligible.filter(post => follows.matches(context.follows, post, context.area.id));
    const permissions = await Promise.all(eligible.map(post => canReadPost(post, context.userId, context.scope)));
    const readable = eligible.filter((_, i) => permissions[i]);
    if (countOnly) count += readable.length;
    else found.push(...readable);
    if (found.length >= take || rows.length < BATCH) return countOnly ? count : found.slice(0, take);
    const last = rows[rows.length - 1];
    position = { t: last.created_at, id: last.id };
  }
}

function groupsFor(cards, context, earlier) {
  if (earlier) return cards.length ? [{ key: 'earlier', title: 'EARLIER', area_id: context.area?.id || null, items: cards }] : [];
  const groups = [];
  const remaining = new Set(cards.map(card => card.id));
  // Other people's public street posts still sit in the town group; only the reader's
  // own verified, open street/neighborhood gets its own group.
  for (const kind of ['street', 'neighborhood']) {
    const candidates = context.available.filter(area => area.kind === kind
      && (area.parent_id === context.area?.id || area.id === context.area?.id)).sort((a, b) => a.name.localeCompare(b.name));
    const preferred = candidates.find(area => area.id === context.defaults[kind]?.id) || candidates[0];
    for (const area of preferred ? [preferred] : []) {
      const items = cards.filter(card => card.about.area_id === area.id && remaining.has(card.id));
      if (!items.length) continue;
      items.forEach(item => remaining.delete(item.id));
      groups.push({ key: kind, title: `YOUR ${kind.toUpperCase()} · ${area.name.toUpperCase()}`, area_id: area.id, items });
    }
  }
  const town = cards.filter(card => remaining.has(card.id));
  if (town.length) groups.push({ key: 'town', title: `AROUND ${context.area.name.toUpperCase()}`, area_id: context.area.id, items: town });
  return groups;
}

async function page(userId, { view, topic, areaId, earlierBefore, limit }) {
  const started = new Date().toISOString();
  const [context, marker] = await Promise.all([contextFor(userId, areaId), seen.lastSeen(userId, view)]);
  const before = earlierBefore ? cursor.decode(earlierBefore) : null;
  if (before?.b && Date.parse(before.b) > Date.parse(started)) {
    throw Object.assign(new Error('This page link is not valid. Refresh Pulse and try again.'), { status: 400, code: 'INVALID_FEED_CURSOR' });
  }
  const readAt = before?.b || started;
  const since = before?.s || new Date(Math.max(Math.min(Date.parse(marker) || 0, Date.parse(readAt)), Date.parse(readAt) - DAY_MS)).toISOString();
  const result = await scan(context, { view, topic, lower: before ? null : since, before, readAt, take: limit + 1 });
  const rows = result.slice(0, limit);
  const overflow = result.length > limit;
  const last = rows[rows.length - 1] || { created_at: since, id: cursor.MAX_ID };
  const older = overflow || (!before && (await scan(context, {
    view, topic, before: { t: last.created_at, id: last.id }, readAt, take: 1,
  })).length > 0);
  const ids = [...new Set(rows.map(row => row.area_id).filter(Boolean))];
  const areas = ids.length ? await checked(openAreas(db.from('PulseArea').select(AREA_SELECT)).in('id', ids)) : [];
  const cards = await postCards(rows, { viewerId: userId, homes: context.homes, areas,
    fallbackArea: context.area, blockedIds: context.filters.blockedUserIds });
  let quiet = null;
  if (!context.homes.primary) quiet = { reason: 'no_home', card: 'set_up_home' };
  else if (!before && !topic) {
    // The meter describes the town, so only Nearby can call it sparse. Following is the
    // reader's own list: a short one is not quiet, and an empty one has no card.
    const active = await scan(context, { view, readAt, take: view === 'nearby' ? 5 : 1 });
    if (!active.length) quiet = { reason: 'empty', card: null };
    else if (view === 'nearby' && active.length < 5) quiet = { reason: 'sparse', card: 'meter' };
  }
  return {
    view, read_at: readAt, area: areaDto(context.area), areas_available: context.available.map(areaDto), quiet,
    right_now: null, groups: groupsFor(cards, context, !!before),
    end: { caught_up: !overflow || Date.parse(result[limit]?.created_at) <= Date.parse(since), since,
      can_show_earlier: older, earlier_cursor: older ? cursor.encode(last, since, readAt) : null },
  };
}

async function newCount(userId, { view, topic, areaId, after }) {
  const readAt = new Date().toISOString();
  const context = await contextFor(userId, areaId);
  return { count: await scan(context, { view, topic, lower: after, readAt, countOnly: true }) };
}

module.exports = { page, newCount, contextFor };
