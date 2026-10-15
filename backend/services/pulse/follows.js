'use strict';

const db = require('../../config/supabaseAdmin');
const { UUID } = require('./feedCursor');
const { isPulseTopic } = require('./topics');
const { homeAreaContext, openAreas, AREA_SELECT } = require('./areas');
const { POST_READ_SELECT, canReadPost, postScopeAccess } = require('./readAccess');

const SELECT = 'id, target_type, target_id, area_id, notify, ends_on_resolve, until_at, created_at, updated_at';
const POST_SELECT = `${POST_READ_SELECT}, state, resolution, expires_at, created_at, topic, post_as,
  location_precision, effective_latitude, effective_longitude`;
function fail(message, status = 400, code = 'INVALID_FOLLOW') {
  return Object.assign(new Error(message), { status, code });
}
async function checked(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
function key(input) {
  const { targetType, targetId, areaId } = input || {};
  if (!['post', 'topic', 'place'].includes(targetType) || typeof targetId !== 'string') {
    throw fail('Choose a conversation, topic or place to follow.');
  }
  if (targetType === 'topic' ? !isPulseTopic(targetId) || typeof areaId !== 'string' || !UUID.test(areaId)
    : !UUID.test(targetId) || areaId != null) throw fail('Choose a valid follow target and area.');
  return { targetType, targetId: targetType === 'topic' ? targetId : targetId.toLowerCase(),
    areaId: targetType === 'topic' ? areaId.toLowerCase() : null };
}
function open(post, at = Date.now()) {
  return post.state === 'open' && !post.resolution && !post.archived_at
    && (!post.expires_at || Date.parse(post.expires_at) > at);
}
function dto(row) {
  return { id: row.id, target_type: row.target_type, target_id: row.target_id, area_id: row.area_id,
    notify: row.notify, ends: row.ends_on_resolve ? 'on_resolve' : row.until_at ? 'week' : 'keep',
    until_at: row.until_at, created_at: row.created_at, updated_at: row.updated_at };
}
async function activeRows(viewerId) {
  const rows = [];
  const now = new Date().toISOString();
  for (let from = 0; ; from += 1000) {
    const page = await checked(db.from('PulseFollow').select(SELECT).eq('user_id', viewerId)
      .or(`until_at.is.null,until_at.gt.${now}`).order('created_at').order('id').range(from, from + 999));
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

async function targetFor(viewerId, target, homes, scope) {
  if (target.targetType === 'post') {
    const post = await checked(db.from('Post').select(POST_SELECT).eq('id', target.targetId).maybeSingle());
    if (!post || ['home', 'persona'].includes(post.identity_context_type)
      || ['home', 'persona'].includes(post.post_as) || post.audience === 'household'
      || !post.distribution_targets?.includes('place')) throw fail('This conversation is not available.', 404, 'POST_NOT_FOUND');
    if (post.area_id && !await checked(openAreas(db.from('PulseArea').select('id')).eq('id', post.area_id).maybeSingle())) {
      throw fail('This area is not available.', 404, 'AREA_NOT_FOUND');
    }
    if (!await canReadPost(post, viewerId, scope)) throw fail('This conversation is not available.', 403, 'POST_NOT_FOUND');
    return post;
  }
  const id = target.targetType === 'place' ? target.targetId : target.areaId;
  const area = await checked(openAreas(db.from('PulseArea').select(AREA_SELECT)).eq('id', id).maybeSingle());
  if (!area || (target.targetType === 'place' && area.kind !== 'place')) {
    throw fail('This area is not available.', 404, 'AREA_NOT_FOUND');
  }
  if (area.kind !== 'town' && !homes.verifiedAreaIds.has(area.id)) {
    throw fail('A verified address in this area is needed.', 403, 'NEEDS_VERIFIED_ADDRESS');
  }
  return area;
}

async function put(viewerId, input) {
  const target = key(input);
  const notify = input.notify ?? 'off';
  const ends = input.ends ?? (target.targetType === 'post' ? 'on_resolve' : 'keep');
  if (!['off', 'recap', 'each'].includes(notify) || !['on_resolve', 'week', 'keep'].includes(ends)
    || (ends === 'on_resolve' && target.targetType !== 'post')) throw fail('Choose valid follow notifications and duration.');
  const user = await checked(db.from('User').select('account_type').eq('id', viewerId).maybeSingle());
  if (user?.account_type === 'business') throw fail('Business accounts cannot follow Pulse conversations.', 403, 'BUSINESS_CANNOT_FOLLOW');
  const homes = await homeAreaContext(viewerId);
  await targetFor(viewerId, target, homes, await postScopeAccess(viewerId, homes));
  const row = await checked(db.rpc('pulse_follow_upsert', {
    p_user_id: viewerId, p_target_type: target.targetType, p_target_id: target.targetId,
    p_area_id: target.areaId, p_notify: notify, p_ends: ends,
  }));
  if (row.code === 'POST_ENDED') throw fail('This conversation has ended. Choose a week or keep following.', 409, row.code);
  if (row.code) throw fail('This conversation is not available.', 404, row.code);
  return { follow: dto(row) };
}

async function remove(viewerId, input) {
  const target = key(input);
  let query = db.from('PulseFollow').delete().eq('user_id', viewerId)
    .eq('target_type', target.targetType).eq('target_id', target.targetId);
  query = target.areaId ? query.eq('area_id', target.areaId) : query.is('area_id', null);
  await checked(query);
  return { ok: true };
}

async function list(viewerId) {
  const [rows, homes] = await Promise.all([activeRows(viewerId), homeAreaContext(viewerId)]);
  const scope = await postScopeAccess(viewerId, homes);
  const visible = [];
  for (const row of rows) {
    try {
      const target = await targetFor(viewerId, { targetType: row.target_type, targetId: row.target_id,
        areaId: row.area_id }, homes, scope);
      if (!row.ends_on_resolve || open(target)) visible.push(dto(row));
    } catch (error) {
      if (![403, 404].includes(error.status)) throw error;
    }
  }
  return { follows: visible };
}

// This runs on authorized candidates before scan takes a response page/count.
// The feed's area wall and all its mute/hide/block filters remain in force.
function matches(rows, post, selectedAreaId) {
  return rows.some(row => {
    if (row.target_type === 'post') return row.target_id === post.id && (!row.ends_on_resolve || open(post));
    if (Date.parse(post.created_at) < Date.parse(row.created_at)) return false;
    if (row.target_type === 'place') return row.target_id === post.area_id;
    return row.target_id === post.topic && (row.area_id === post.area_id
      || row.area_id === post.pulse_post_town_id || (!post.area_id && row.area_id === selectedAreaId));
  });
}

function followInput(row) {
  return { targetType: row.target_type, targetId: row.target_id,
    ...(row.area_id ? { areaId: row.area_id } : {}) };
}
async function summary(viewerId) {
  const { follows } = await list(viewerId);
  const mutes = [];
  for (let from = 0; ; from += 1000) {
    const page = await checked(db.from('PostMute')
      .select('id, muted_entity_type, muted_entity_id, area_id, surface, created_at')
      .eq('user_id', viewerId).order('created_at').order('id').range(from, from + 999));
    mutes.push(...page);
    if (page.length < 1000) break;
  }
  return {
    follows: follows.map(row => ({ ...row, undo: { method: 'DELETE',
      path: `/api/pulse/follows?${new URLSearchParams(followInput(row))}` } })),
    mutes: mutes.map(row => ({ id: row.id, entity_type: row.muted_entity_type,
      entity_id: row.muted_entity_id, area_id: row.area_id, surface: row.surface, created_at: row.created_at,
      undo: { method: 'DELETE', path: '/api/posts/mute', body: {
        entityType: row.muted_entity_type, entityId: row.muted_entity_id,
        ...(row.area_id ? { areaId: row.area_id } : {}),
      } } })),
    alerts: follows.filter(row => row.notify !== 'off').map(row => ({ ...row, undo: {
      method: 'PUT', path: '/api/pulse/follows', body: { ...followInput(row), ends: row.ends, notify: 'off' },
    } })),
  };
}

async function why(viewerId, postId, options) {
  if (!UUID.test(postId)) throw fail('This conversation is not available.', 404, 'POST_NOT_FOUND');
  const context = await require('./feed').contextFor(viewerId, options.areaId);
  const post = await targetFor(viewerId, { targetType: 'post', targetId: postId }, context.homes, context.scope);
  if (post.area_id) post.pulse_post_town_id = await checked(db.rpc('pulse_area_town_id', { p_area_id: post.area_id }));
  const reasons = [];
  if (context.area) {
    let inside = post.area_id === context.area.id;
    if (post.area_id && context.area.kind === 'town') {
      inside = post.pulse_post_town_id === context.area.id;
    } else if (!post.area_id) {
      const point = require('./distanceText').displayedPoint(post);
      inside = point && (await checked(db.rpc('pulse_area_contains_displayed_points', {
        p_area_id: context.area.id, p_points: [{ id: post.id, ...point }],
      }))).length > 0;
    }
    if (inside) reasons.push({ kind: 'area', text: `You're viewing ${context.area.name}.` });
  }
  if (options.topic && options.topic === post.topic) reasons.push({ kind: 'topic', text: `You selected the ${options.topic.replaceAll('_', ' ')} topic.` });
  if (options.view === 'following' && matches(context.follows, post, context.area?.id)) {
    reasons.push({ kind: 'follow', text: 'This matches a conversation, topic or place you chose to follow.' });
  }
  reasons.push({ kind: 'time', text: 'Conversations are shown newest first.' });
  return { reasons };
}

module.exports = { put, remove, list, activeRows, matches, open, dto, summary, why };
