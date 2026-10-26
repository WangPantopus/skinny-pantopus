// Resident removal vote (home claims plan, PR 5; founder approved 2026-10-25). Settled residents can remove someone
// who doesn't belong without an owner or manager: a majority of the other settled residents, and at least 2 of them,
// within 7 days (supabase/migrations/20261025180000_home_removal_vote.sql). Owners stay under the owners' vote. The
// person keeps access while the vote is open and is told it's open and the result, never who started it or how anyone
// voted; contesting means proving the address, and a proven member who contests goes to Pantopus review. Behind the
// home_removal_vote flag, which ships off: the founder turns it on only after testing and after the iOS and Android
// apps have voting screens. The SQL reads the flag row itself, so turning it off again stops new votes at once.
const db = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REFUSALS = Object.freeze({
  REMOVAL_VOTE_INVALID: [400, 'Check the vote and try again.'],
  REMOVAL_VOTE_SELF: [409, 'To leave this home, leave it from your own membership.'],
  REMOVAL_VOTE_OFF: [404, 'Household votes aren\'t available right now. An owner or manager can remove someone.'],
  HOME_NOT_FOUND: [404, 'Home not found.'],
  REMOVAL_VOTE_UNAVAILABLE: [409, 'This home can\'t hold a household vote right now.'],
  REMOVAL_VOTE_NOT_SETTLED: [403, 'Household votes are for residents who have been verified members here for at least 7 days.'],
  REMOVAL_VOTE_TARGET_UNAVAILABLE: [409, 'A household vote can only remove a current verified member who isn\'t an owner, admin or manager. If they asked to join, answer their request instead.'],
  REMOVAL_VOTE_IN_REVIEW: [409, 'Pantopus is reviewing a household vote about this person.'],
  REMOVAL_VOTE_RECENT: [409, 'The household voted about this person in the last 30 days. An owner or manager can still remove someone.'],
  REMOVAL_VOTE_TOO_FEW: [409, 'A household vote needs at least 2 other settled residents. An owner or manager can remove someone instead.'],
  REMOVAL_VOTE_NOT_FOUND: [404, 'This vote is no longer available.'],
  REMOVAL_VOTE_NOT_ELIGIBLE: [403, 'You can\'t vote on this.'],
  REMOVAL_VOTE_CLOSED: [409, 'This vote has ended.'],
  REMOVAL_VOTE_PROOF_REQUIRED: [409, 'To contest, verify your address by mail first. Then you can contest, and Pantopus reviews the vote if it passes.'],
});

function failure(code) {
  const known = Object.hasOwn(REFUSALS, code);
  const [status, message] = known ? REFUSALS[code] : [503, 'Couldn\'t reach the household vote. Nothing was changed. Please try again.'];
  return Object.assign(new Error(message), { code: known ? code : 'REMOVAL_VOTE_RETRY', status, statusCode: status });
}

function ids(...values) {
  if (!values.every(value => typeof value === 'string' && UUID.test(value))) throw failure('REMOVAL_VOTE_INVALID');
  return values.map(value => value.toLowerCase());
}

async function rpc(name, args) {
  let response;
  try { response = await db.rpc(name, args); } catch { throw failure(); }
  if (!response || response.error || !response.data || typeof response.data !== 'object') throw failure();
  if (response.data.ok !== true) throw failure(response.data.code);
  return response.data;
}

async function homeName(homeId) {
  try {
    const { data } = await db.from('Home').select('name, address').eq('id', homeId).maybeSingle();
    return data?.name || data?.address || null;
  } catch { return null; }
}

/** The name a person shows neighbors (services/chatPeople.js), never their account name. */
async function personName(userId) {
  try {
    const people = await require('./chatPeople').loadChatPeople([userId]);
    return people.get(String(userId))?.displayName || null;
  } catch { return null; }
}

/** Notices never reject: the vote is already saved. */
async function tell(notice) {
  try { await require('./notificationService').createNotification(notice); }
  catch (err) { logger.warn('Household vote notice failed', { type: notice.type, error: err.message }); }
}

async function tellOpened({ homeId, voteId, targetId, voters }) {
  const [home, name] = await Promise.all([homeName(homeId), personName(targetId)]);
  const link = `/homes/${homeId}/members`;
  for (const userId of new Set((voters || []).filter(id => UUID.test(String(id))))) {
    await tell({ userId, type: 'home_removal_vote_opened', title: 'A household vote is open',
      body: `Should ${name || 'a household member'} stay in ${home || 'your home'}? Your vote is private. The vote is open for 7 days.`,
      icon: '🗳️', link, metadata: { home_id: homeId, vote_id: voteId }, idempotencyKey: `removal-vote-opened:${voteId}:${userId}` });
  }
  await tell({ userId: targetId, type: 'home_removal_vote_about_you', title: 'A household vote is open about you',
    body: `Residents of ${home || 'your home'} started a vote on whether you live there. You keep your access while it's open, for 7 days. Who voted is never shown. If you live there, verify your address by mail to contest it.`,
    icon: '🗳️', link, metadata: { home_id: homeId, vote_id: voteId }, idempotencyKey: `removal-vote-about-you:${voteId}` });
}

/** Tell the person a vote was about how it ended (a removal is told by homeAuthorityService.notifyRemovedMember). */
async function tellEnded({ homeId, voteId, targetId, outcome, occupancyId, completedAt }) {
  if (!UUID.test(String(targetId || ''))) return;
  if (outcome === 'removed') {
    await require('./homeAuthorityService').notifyRemovedMember({ homeId, targetId, occupancyId, completedAt });
    return;
  }
  const home = await homeName(homeId);
  const body = {
    kept: `The household vote about you ended. You stay in ${home || 'the home'}.`,
    expired: `The household vote about you closed without a decision. You stay in ${home || 'the home'}.`,
    review: `The household vote about you passed, but you proved your address and contested it, so Pantopus will review it. You keep your access meanwhile.`,
  }[outcome];
  if (!body) return;
  await tell({ userId: targetId, type: 'home_removal_vote_ended', title: 'The household vote ended', body, icon: '🗳️',
    link: `/homes/${homeId}/members`, metadata: { home_id: homeId, vote_id: voteId, outcome },
    idempotencyKey: `removal-vote-ended:${voteId}` });
}

const VOTE_OUT = { approve: 'remove', reject: 'keep' };

/** Open votes the person was asked to decide or that are about them, and the members they could ask about now. */
async function list({ homeId, actorId }) {
  const [home, actor] = ids(homeId, actorId);
  const data = await rpc('list_home_removal_votes', { p_home_id: home, p_viewer_id: actor });
  if (!Array.isArray(data.votes) || !Array.isArray(data.can_start_for)) throw failure();
  const votes = data.votes.filter(vote => UUID.test(String(vote?.id)) && UUID.test(String(vote?.target_user_id)));
  // Members go by the name they show neighbors (services/chatPeople.js).
  const people = await require('./chatPeople').loadChatPeople(votes.filter(vote => !vote.about_you).map(vote => vote.target_user_id))
    .catch(() => new Map());
  return {
    votes: votes.map(vote => ({
      id: vote.id, about_you: vote.about_you === true, opened_at: vote.opened_at, closes_at: vote.closes_at,
      contested: vote.contested === true, my_vote: VOTE_OUT[vote.my_vote] || null,
      can_vote: vote.can_vote === true, can_contest: vote.can_contest === true,
      member: vote.about_you === true ? null : {
        user_id: vote.target_user_id, name: people.get(String(vote.target_user_id))?.displayName || null },
    })),
    can_start_for: data.can_start_for.filter(id => UUID.test(String(id))),
  };
}

async function open({ homeId, actorId, targetId }) {
  const [home, actor, target] = ids(homeId, actorId, targetId);
  const data = await rpc('open_home_removal_vote', { p_home_id: home, p_actor_id: actor, p_target_id: target });
  if (!UUID.test(String(data.vote_id))) throw failure();
  if (data.replayed !== true) {
    logger.info('home_removal_vote.opened', { home_id: home, vote_id: data.vote_id });
    await tellOpened({ homeId: home, voteId: data.vote_id, targetId: target, voters: data.notify_user_ids });
  }
  return { id: data.vote_id, closes_at: data.closes_at, replayed: data.replayed === true };
}

async function vote({ homeId, actorId, voteId, choice }) {
  const [home, actor, id] = ids(homeId, actorId, voteId);
  if (!['remove', 'keep'].includes(choice)) throw failure('REMOVAL_VOTE_INVALID');
  const data = await rpc('cast_home_removal_vote', { p_home_id: home, p_vote_id: id, p_voter_id: actor,
    p_vote: choice === 'remove' ? 'approve' : 'reject' });
  if (data.outcome) {
    logger.info('home_removal_vote.ended', { home_id: home, vote_id: id, outcome: data.outcome, code: data.code || null });
    await tellEnded({ homeId: home, voteId: id, targetId: data.target_user_id, outcome: data.outcome,
      occupancyId: data.occupancy_id, completedAt: data.completed_at });
  }
  return { my_vote: choice, ended: Boolean(data.outcome), outcome: data.outcome || null };
}

async function contest({ homeId, actorId, voteId }) {
  const [home, actor, id] = ids(homeId, actorId, voteId);
  const data = await rpc('contest_home_removal_vote', { p_home_id: home, p_vote_id: id, p_actor_id: actor });
  return { contested: true, contested_at: data.contested_at || null };
}

function sendError(res, error) {
  const safe = error && Object.hasOwn(REFUSALS, error.code) ? error : failure();
  if (safe.status >= 500) logger.warn('Household vote unavailable', { error: error?.message });
  return res.status(safe.status).json({ error: safe.message, code: safe.code });
}

module.exports = { list, open, vote, contest, tellEnded, sendError };
