// Resident removal vote (home claims plan, PR 5; founder approved 2026-10-25). Settled residents can remove someone
// who doesn't belong without an owner or manager: a majority of the other settled residents, and at least 2 of them,
// within 7 days (supabase/migrations/20261025180000_home_removal_vote.sql), one vote per Home at a time. Owners stay
// under the owners' vote. The person keeps access while the vote is open and is told it's open and the result, never
// who started it or how anyone voted. A vote that passes takes effect no sooner than 72 hours after it opened, so they
// have time to contest; contesting means proving the address, and a proven member who contests goes to Pantopus
// review, which decides the vote (resolveReviewCase). The hourly job settles votes that are due (settleDue). Behind
// the home_removal_vote flag, which ships off: the founder turns it on only after testing and after the iOS and
// Android apps have voting screens. The SQL reads the flag row itself, so turning it off again stops new votes at once.
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
  REMOVAL_VOTE_BUSY: [409, 'A household vote is already open in this home. One vote at a time: you can ask once it ends.'],
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

/** "3 days" until a time the SQL set (a vote's contest_until), for the notices. */
function daysUntil(iso) {
  const days = Math.max(1, Math.round((Date.parse(iso) - Date.now()) / 86400000) || 1);
  return `${days} day${days === 1 ? '' : 's'}`;
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

async function tellOpened({ homeId, voteId, targetId, voters, contestUntil, targetProven }) {
  const [home, name] = await Promise.all([homeName(homeId), personName(targetId)]);
  const link = `/homes/${homeId}/members`;
  const wait = daysUntil(contestUntil);
  for (const userId of new Set((voters || []).filter(id => UUID.test(String(id))))) {
    await tell({ userId, type: 'home_removal_vote_opened', title: 'A household vote is open',
      body: `Should ${name || 'a household member'} stay in ${home || 'your home'}? Your vote is private. The vote is open for 7 days. If most of you vote to remove them, it takes effect no sooner than ${wait} from now, so they have time to contest it.`,
      icon: '🗳️', link, metadata: { home_id: homeId, vote_id: voteId }, idempotencyKey: `removal-vote-opened:${voteId}:${userId}` });
  }
  const contest = targetProven
    ? 'If you live there, contest it before then, and Pantopus reviews it instead of removing you.'
    : 'If you live there, prove your address (by mail or a document) and contest it before then, and Pantopus reviews it instead.';
  await tell({ userId: targetId, type: 'home_removal_vote_about_you', title: 'A household vote is open about you',
    body: `Residents of ${home || 'your home'} started a vote on whether you live there. You keep your access while it's open, for up to 7 days, and if it passes you're removed no sooner than ${wait} from now. ${contest} Who voted is never shown.`,
    icon: '🗳️', link, metadata: { home_id: homeId, vote_id: voteId }, idempotencyKey: `removal-vote-about-you:${voteId}` });
}

/**
 * Tell the person a vote was about how it ended (a removal is told by homeAuthorityService.notifyRemovedMember).
 * `reviewed`: Pantopus decided it after they contested. Someone who left before it ended ('withdrawn') isn't told.
 */
async function tellEnded({ homeId, voteId, targetId, outcome, occupancyId, completedAt, reviewed = false }) {
  if (!UUID.test(String(targetId || ''))) return;
  if (outcome === 'removed') {
    await require('./homeAuthorityService').notifyRemovedMember({ homeId, targetId, occupancyId, completedAt });
    return;
  }
  const home = await homeName(homeId);
  const body = reviewed ? {
    kept: `Pantopus reviewed the household vote about you. You stay in ${home || 'the home'}.`,
  }[outcome] : {
    kept: `The household vote about you ended. You stay in ${home || 'the home'}.`,
    expired: `The household vote about you closed without a decision. You stay in ${home || 'the home'}.`,
    review: `The household vote about you passed, but you proved your address and contested it, so Pantopus will review it. You keep your access meanwhile.`,
  }[outcome];
  if (!body) return;
  await tell({ userId: targetId, type: 'home_removal_vote_ended', title: 'The household vote ended', body, icon: '🗳️',
    link: `/homes/${homeId}/members`, metadata: { home_id: homeId, vote_id: voteId, outcome },
    idempotencyKey: `removal-vote-${reviewed ? 'reviewed' : 'ended'}:${voteId}` });
}

/** A contested vote that passed waits for Pantopus: someone has to hear about the case (adminAlerts). */
async function alertReview({ homeId, caseId }) {
  if (!UUID.test(String(caseId || ''))) return;
  try {
    const { data: home } = await db.from('Home').select('city, state').eq('id', homeId).maybeSingle();
    await require('./adminAlerts').notifyRemovalVoteToReview({ caseId, home });
  } catch (err) { logger.warn('Household vote review alert failed', { error: err.message }); }
}

/** A vote just ended (home_removal_vote_decide's answer, or a review's): log it and tell who needs to know. */
async function announce(data, { reviewed = false } = {}) {
  logger.info('home_removal_vote.ended', { home_id: data.home_id, vote_id: data.vote_id, outcome: data.outcome,
    code: data.code || null, reviewed });
  if (data.outcome === 'review') await alertReview({ homeId: data.home_id, caseId: data.review_case_id });
  await tellEnded({ homeId: data.home_id, voteId: data.vote_id, targetId: data.target_user_id, outcome: data.outcome,
    occupancyId: data.occupancy_id, completedAt: data.completed_at, reviewed });
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
      contest_until: vote.contest_until || null, contested: vote.contested === true, my_vote: VOTE_OUT[vote.my_vote] || null,
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
    await tellOpened({ homeId: home, voteId: data.vote_id, targetId: target, voters: data.notify_user_ids,
      contestUntil: data.contest_until, targetProven: data.target_proven === true });
  }
  return { id: data.vote_id, closes_at: data.closes_at, contest_until: data.contest_until || null,
    replayed: data.replayed === true };
}

async function vote({ homeId, actorId, voteId, choice }) {
  const [home, actor, id] = ids(homeId, actorId, voteId);
  if (!['remove', 'keep'].includes(choice)) throw failure('REMOVAL_VOTE_INVALID');
  const data = await rpc('cast_home_removal_vote', { p_home_id: home, p_vote_id: id, p_voter_id: actor,
    p_vote: choice === 'remove' ? 'approve' : 'reject' });
  if (data.outcome) await announce(data);
  return { my_vote: choice, ended: Boolean(data.outcome), outcome: data.outcome || null };
}

async function contest({ homeId, actorId, voteId }) {
  const [home, actor, id] = ids(homeId, actorId, voteId);
  const data = await rpc('contest_home_removal_vote', { p_home_id: home, p_vote_id: id, p_actor_id: actor });
  return { contested: true, contested_at: data.contested_at || null };
}

/**
 * The hourly job (jobs/processQuorumActions.js): decide the votes nobody is voting on any more (a majority reached
 * before contest_until, a vote past its end, or one whose subject left) and tell people. A vote that can't be
 * settled is left as it is; the next run tries again.
 */
async function settleDue() {
  const { votes } = await rpc('due_home_removal_votes', {});
  if (!Array.isArray(votes)) throw failure();
  let settled = 0;
  for (const due of votes) {
    if (!UUID.test(String(due?.home_id)) || !UUID.test(String(due?.vote_id))) continue;
    try {
      const data = await rpc('settle_home_removal_vote', { p_home_id: due.home_id, p_vote_id: due.vote_id });
      if (data.outcome) { settled++; await announce(data); }
    } catch (err) {
      logger.warn('Household vote not settled', { vote_id: due.vote_id, code: err.code });
    }
  }
  return { due: votes.length, settled };
}

/**
 * Pantopus resolved a review case (routes/adminAddressReview.js). A contested household vote's case decides the vote
 * too, in one transaction: approved removes the member, rejected or dismissed keeps them, and they're told. Returns
 * null for any other case, which the caller resolves as before; otherwise the route's { success, error } answer.
 */
async function resolveReviewCase({ caseId, reviewerId, outcome, note = null }) {
  if (!UUID.test(String(caseId)) || !UUID.test(String(reviewerId))) return null;
  const { data, error } = await db.rpc('resolve_home_removal_vote_review', { p_case_id: caseId.toLowerCase(),
    p_reviewer_id: reviewerId.toLowerCase(), p_outcome: outcome, p_note: note });
  if (error || !data || typeof data !== 'object') throw new Error('Household vote review could not be resolved');
  if (data.ok === true && data.handled === false) return null;
  if (data.ok !== true) {
    return { success: false, error: data.code === 'REVIEW_CASE_RESOLVED' ? 'Case not found or already resolved' : 'Invalid outcome' };
  }
  if (data.outcome) await announce(data, { reviewed: true });
  return { success: true };
}

function sendError(res, error) {
  const safe = error && Object.hasOwn(REFUSALS, error.code) ? error : failure();
  if (safe.status >= 500) logger.warn('Household vote unavailable', { error: error?.message });
  return res.status(safe.status).json({ error: safe.message, code: safe.code });
}

module.exports = { list, open, vote, contest, settleDue, resolveReviewCase, sendError };
