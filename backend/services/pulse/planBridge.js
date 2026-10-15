'use strict';

// From conversation to plan (S14, contract §2.18). "Suggest a plan" creates the plan through the
// existing Plans services, linked to the conversation (Plan.source_post_id) and with the
// conversation's audience, a street or neighborhood, or the town. The conversation shows the plan
// card the reader would see in Plans; replies by people going carry `going`. Nothing about plans
// shows while the `plans` switch is off for the person.
const db = require('../../config/supabaseAdmin');
const { isFeatureEnabled } = require('../featureFlagService');
const { recordFunnelEvent } = require('../funnelEvents');
const { homeAreaContext, openAreas, AREA_SELECT } = require('./areas');
const { UUID } = require('./feedCursor');
const { POST_READ_SELECT, canReadPost } = require('./readAccess');
const blockService = require('../blockService');
const logger = require('../../utils/logger');

// From a conversation only these kinds are offered; never playdates (build spec §9).
const KINDS = ['walk_coffee', 'pickup_game', 'watch_party'];
const AUDIENCES = ['conversation', 'area', 'town', 'invited'];
const MAX_INVITEES = 10;
// Requests that keep an invited person able to see the plan; `removed` ends it.
const INVITE_STATUSES = ['invited', 'accepted', 'waitlisted', 'left', 'withdrawn'];
const NONE = { plan: null, going: new Set() };

function fail(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}
async function checked(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
async function townIdOf(areaId) {
  if (!areaId) return null;
  const area = await checked(openAreas(db.from('PulseArea').select(AREA_SELECT)).eq('id', areaId).maybeSingle());
  if (!area) return null;
  return area.kind === 'town' ? area.id : checked(db.rpc('pulse_area_town_id', { p_area_id: area.id }));
}

// The plan post's read scope and area for the chosen audience (contract §2.18).
async function audienceFor(user, post, body) {
  const audience = body.audience ?? 'conversation';
  if (!AUDIENCES.includes(audience)) throw fail(400, 'INVALID_AUDIENCE', 'Choose who can join.');
  const town = post.area_id ? await townIdOf(post.area_id) : (await require('./areas').myAreas(post.user_id)).town?.id;
  if (!town) throw fail(404, 'POST_NOT_FOUND', 'This conversation is not available.');
  if (audience === 'conversation' && post.read_scope) return { readScope: post.read_scope, areaId: post.area_id };
  // "People I invite": the plan keeps the conversation's audience for its notices, and only the
  // host and the invited people can see it.
  if (audience === 'invited') {
    return { readScope: post.read_scope || 'public', areaId: post.read_scope ? post.area_id : town,
      joinRequirement: 'invited', autoRules: [] };
  }
  if (audience === 'area') {
    const area = typeof body.areaId === 'string' && UUID.test(body.areaId)
      ? await checked(openAreas(db.from('PulseArea').select(AREA_SELECT)).eq('id', body.areaId).maybeSingle()) : null;
    if (!area || !['street', 'neighborhood'].includes(area.kind) || await townIdOf(area.id) !== town) {
      throw fail(400, 'INVALID_AUDIENCE', 'Choose a street or neighborhood in this town.');
    }
    const homes = await homeAreaContext(user.id);
    const inside = homes.primary?.verified && homes.matches.some(match => match.home_id === homes.primary.id
      && match.area_id === area.id && match.inside === true);
    if (!inside) throw fail(403, 'NEEDS_VERIFIED_ADDRESS', 'A verified address in this area is needed.');
    return { readScope: 'verified_area', areaId: area.id };
  }
  // "All of {Town}", and the conversation audience of an older post without a read scope: public in
  // the town, with the existing auto-accept rules and never at a home.
  if (body.place?.kind === 'home') {
    throw fail(400, 'PLAN_AT_HOME_NOT_OFFERED', 'A plan for the whole town meets in a public place.');
  }
  return { readScope: 'public', areaId: town,
    autoRules: ['verified', ...(['walk_coffee', 'pickup_game'].includes(body.kind) ? ['anyone_nearby'] : [])] };
}

function toastFor(plan) {
  const start = plan?.starts_at ? new Date(plan.starts_at) : null;
  if (!start) return 'Added to your plans';
  const zone = plan.timezone || 'America/Los_Angeles';
  const day = start.toLocaleDateString('en-US', { weekday: 'short', timeZone: zone });
  const time = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: zone })
    .replace(/\s/g, '').toLowerCase();
  return `Added to your plans · ${day} ${time}`;
}

/** POST /api/pulse/posts/:id/plan */
async function suggest(user, postId, body = {}) {
  if (!await isFeatureEnabled('plans', user)) throw fail(404, 'NOT_FOUND', 'Not found');
  if (!KINDS.includes(body.kind)) {
    throw fail(400, 'PLAN_KIND_NOT_OFFERED', 'From a conversation you can suggest a walk or coffee, a pickup game or a watch party.');
  }
  let context;
  try {
    context = await require('./conversation').contextFor(postId, user.id);
  } catch (error) {
    if ([403, 404].includes(error.status)) throw fail(404, 'POST_NOT_FOUND', 'This conversation is not available.');
    throw error;
  }
  const post = context.post;
  if (!post.distribution_targets?.includes('place')) throw fail(404, 'POST_NOT_FOUND', 'This conversation is not available.');
  const target = await audienceFor(user, post, body);
  let invitees = null;
  if (target.joinRequirement === 'invited') {
    invitees = inviteeList(body.invitees);
    const allowed = invitees ? await participantsOf(post.id, user.id) : null;
    if (!invitees || invitees.some(userId => !allowed.has(userId))) throw invalidInvitees();
  }
  const planActions = require('../plans/planActions');
  let plan = await planActions.createPlan(user, { ...body, ...(target.autoRules ? { auto_rules: target.autoRules } : {}) },
    { sourcePostId: post.id, readScope: target.readScope, areaId: target.areaId, joinRequirement: target.joinRequirement });
  if (invitees) plan = await addInvitees(user, plan.id, invitees);
  recordFunnelEvent('pulse_plan_suggested', { userId: user.id, meta: { plan_id: plan?.id, post_id: post.id,
    kind: body.kind, audience: body.audience ?? 'conversation' } });
  return { plan, toast: toastFor(plan) };
}

function invalidInvitees() {
  return fail(400, 'INVALID_INVITEES', 'Invite 1 to 10 people who took part in this conversation.');
}
function inviteeList(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_INVITEES) return null;
  const ids = [...new Set(value.map(id => (typeof id === 'string' ? id.toLowerCase() : '')))];
  return ids.every(id => UUID.test(id)) ? ids : null;
}

// Who may be invited: the conversation's author and the authors of its live replies, except the
// host, who can read it and aren't across a block from the host.
async function participantsOf(postId, hostId) {
  const post = postId ? await checked(db.from('Post').select(POST_READ_SELECT).eq('id', postId).maybeSingle()) : null;
  if (!post) return new Set();
  const replies = await checked(db.from('PostComment').select('user_id').eq('post_id', post.id).eq('is_deleted', false)
    .eq('moderation_state', 'live').not('user_id', 'is', null).limit(2000));
  const ids = new Set([post.user_id, ...(replies || []).map(row => row.user_id)].filter(Boolean).map(String));
  ids.delete(String(hostId));
  const allowed = new Set();
  for (const userId of ids) {
    if (await blockService.isBlocked(hostId, userId) || !await canReadPost(post, userId)) continue;
    allowed.add(userId);
  }
  return allowed;
}

// Writes the invitations (a removed or expired one comes back) and tells each new invitee.
async function addInvitees(user, planId, userIds) {
  const planService = require('../plans/planService');
  const plan = await planService.loadPlanRow(planId);
  const existing = await checked(db.from('PlanRequest').select('id, user_id, status').eq('post_id', planId));
  const byUser = new Map((existing || []).map(row => [String(row.user_id), row]));
  if (new Set([...(existing || []).filter(row => INVITE_STATUSES.includes(row.status)).map(row => String(row.user_id)),
    ...userIds]).size > MAX_INVITEES) throw invalidInvitees();
  const stamp = new Date().toISOString();
  const host = await checked(db.from('User').select('id, first_name, name, username').eq('id', user.id).maybeSingle());
  const hostFirst = planService.firstName(host) || 'A neighbor';
  const planNotify = require('../plans/planNotifications');
  for (const userId of userIds) {
    const row = byUser.get(userId);
    if (row && INVITE_STATUSES.includes(row.status)) continue;
    if (row) {
      await checked(db.from('PlanRequest').update({ status: 'invited', decided_by: 'host', decided_at: stamp,
        queued_at: stamp, updated_at: stamp }).eq('id', row.id).in('status', ['removed', 'declined', 'expired']));
    } else {
      const { error } = await db.from('PlanRequest').insert({ post_id: planId, user_id: userId, status: 'invited',
        party_size: 1, decided_by: 'host', decided_at: stamp, queued_at: stamp, ask_count: 1 });
      if (error && error.code !== '23505') throw error;
    }
    await planNotify.invited({ plan, userId, hostFirst });
  }
  const { loadViewer } = require('../plans/planViewer');
  return (await planService.getForViewer(planId, await loadViewer(user, {}))).body;
}

async function hostedInvitedPlan(user, planId) {
  const planService = require('../plans/planService');
  const plan = planService.isUuid(planId) ? await planService.loadPlanRow(planId) : null;
  if (!plan || String(plan.host_user_id) !== String(user.id)) throw fail(404, 'not_found', 'This plan is not available.');
  if (plan.join_requirement !== 'invited') throw fail(400, 'not_invited', 'Only a plan for people you invite has invitations.');
  if (plan.status !== 'open') throw fail(409, 'ended', 'This plan is over.');
  return plan;
}

/** POST /api/plans/:id/invitees { userIds }: the host invites more people from the conversation. */
async function invite(user, planId, body = {}) {
  const plan = await hostedInvitedPlan(user, planId);
  const userIds = inviteeList(body.userIds);
  const allowed = userIds ? await participantsOf(plan.source_post_id, user.id) : null;
  if (!userIds || userIds.some(userId => !allowed.has(userId))) throw invalidInvitees();
  return { plan: await addInvitees(user, plan.post_id, userIds) };
}

/** DELETE /api/plans/:id/invitees/:userId: the person loses the plan at once. */
async function uninvite(user, planId, userId, { io = null } = {}) {
  const plan = await hostedInvitedPlan(user, planId);
  const row = typeof userId === 'string' && UUID.test(userId) ? await checked(db.from('PlanRequest')
    .select('id, status').eq('post_id', plan.post_id).eq('user_id', userId.toLowerCase()).maybeSingle()) : null;
  if (!row) throw fail(404, 'not_found', 'This person isn’t invited.');
  const planActions = require('../plans/planActions');
  if (row.status === 'accepted') return planActions.decide(user, plan.post_id, row.id, 'remove', {}, { io });
  const stamp = new Date().toISOString();
  await checked(db.from('PlanRequest').update({ status: 'removed', decided_by: 'host', decided_at: stamp, updated_at: stamp })
    .eq('id', row.id).neq('status', 'removed'));
  const { loadViewer } = require('../plans/planViewer');
  return { request: { id: row.id, status: 'removed' },
    plan: (await require('../plans/planService').getForViewer(plan.post_id, await loadViewer(user, {}))).body };
}

/**
 * The plan card a conversation shows its reader (contract §2.18): the newest plan suggested from it
 * that the reader can see, never an invited one, with `closing_line`; and who is going to it.
 */
async function forConversation(postId, viewerId) {
  if (!viewerId) return NONE;
  const rows = await checked(db.from('Plan').select('post_id, join_requirement').eq('source_post_id', postId)
    .neq('join_requirement', 'invited').in('status', ['open', 'ended', 'cancelled'])
    .order('created_at', { ascending: false }).limit(5));
  if (!rows?.length || !await isFeatureEnabled('plans', viewerId)) return NONE;
  const planService = require('../plans/planService');
  const { loadViewer } = require('../plans/planViewer');
  const user = await checked(db.from('User').select('id, role').eq('id', viewerId).maybeSingle());
  const viewer = await loadViewer(user || { id: viewerId }, {});
  for (const row of rows) {
    const plan = await planService.loadPlanRow(row.post_id);
    if (!plan || !planService.isVisibleTo(plan, viewer)) continue;
    const ctx = await planService.loadCardContext([plan], viewer);
    const card = planService.buildCard(plan, viewer, ctx);
    // Nobody is going to a cancelled plan; after one happened, its people went.
    const going = card.state === 'cancelled' ? new Set() : new Set([String(plan.host_user_id),
      ...(ctx.requestsByPlan.get(plan.post_id) || []).filter(request => request.status === 'accepted')
        .map(request => String(request.user_id))]);
    const closing = card.state === 'cancelled' ? 'This plan was cancelled.'
      : card.state === 'ended' ? `${going.size} went.` : null;
    return { plan: { ...card, closing_line: closing }, going };
  }
  return NONE;
}

// PS's phrase check for a reply that only expresses interest (contract §2.18). Null while the
// module is absent, when it fails, and whenever it is unsure.
function interestOnly(text) {
  let check;
  try {
    check = require('./safety/interest');
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND' || !String(error.message).includes('safety/interest')) throw error;
    return null;
  }
  try {
    const result = typeof check.interestInReply === 'function' ? check.interestInReply(text) : null;
    return typeof result === 'boolean' ? result : null;
  } catch (error) {
    logger.warn('pulse.plan.interest_check_failed', { error: error.message });
    return null;
  }
}

/** Adds `going` and `interest_not_counted` to a conversation's PulseReply rows. */
function decorateReplies(replies, info) {
  return replies.map(reply => {
    const going = !!reply.author?.id && info.going.has(String(reply.author.id));
    // Only a first-level reply from someone not going can be "Not counted as going".
    const interest = !info.plan ? null : going || reply.removed || reply.parent_comment_id || !reply.text ? false
      : interestOnly(reply.text);
    return { ...reply, going, interest_not_counted: interest };
  });
}

module.exports = { KINDS, suggest, forConversation, decorateReplies, toastFor, invite, uninvite, participantsOf };
