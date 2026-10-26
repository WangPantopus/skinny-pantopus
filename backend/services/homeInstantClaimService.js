// Instant Claimed status (home claims plan, PR 3; founder decision 2026-10-25). A private setup at an address where
// nobody else has anything becomes a claimed home at once: household tools, the Home's own sections and invitations.
// A claim is not proof (verification_source 'claim'): letters, neighbors' real rent, neighbor messages, mail and
// owner powers still need the address verified. Behind the home_instant_claim flag, off by default; turning it off
// stops new claims (claim_home_private_setup reads the flag row itself). The address watch decides first: a high
// level holds the claim until the address is proven (and opens an admin review case), a medium one gives the claim
// 14 days to settle instead of 7, and a watch that can't read holds it too.
const db = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const featureFlagService = require('./featureFlagService');
const { watchResidencyRequest } = require('../utils/homeSecurityPolicy');
const { validityDays } = require('../utils/verificationAge');

const FLAG = 'home_instant_claim';
const SETTLE_DAYS = Object.freeze({ low: 7, medium: 14 });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REFUSALS = Object.freeze({
  HOME_CLAIM_OFF: [404, 'Claiming a home right away is not available. Verify your address by mail instead.'],
  HOME_CLAIM_UNAVAILABLE: [409, 'This home can only be verified by mail now.'],
  HOME_CLAIM_ROLE_UNSUPPORTED: [409, 'This home can only be verified by mail now.'],
  HOME_CLAIM_INVALID: [400, 'Check the home and try again.'],
  HOME_NOT_FOUND: [404, 'Home not found.'],
});

const isOn = user => featureFlagService.isFeatureEnabled(FLAG, user).catch(() => false);

/**
 * Claims the person's own private setup. Never throws: returns { claimed: true, homeId, settlesAt } or
 * { claimed: false, reason, status, message } where reason is 'off', 'held', a HOME_CLAIM_* code or 'unavailable'.
 * `user` is req.user ({ id, role }); `source` names the door for the address watch log.
 */
async function claimPrivateSetup({ homeId, user, source }) {
  const userId = user?.id;
  if (!UUID.test(homeId || '') || !UUID.test(userId || '')) {
    return { claimed: false, reason: 'HOME_CLAIM_INVALID', status: 400, message: REFUSALS.HOME_CLAIM_INVALID[1] };
  }
  if (!(await isOn(user))) {
    return { claimed: false, reason: 'off', status: 404, message: REFUSALS.HOME_CLAIM_OFF[1] };
  }
  const watch = await watchResidencyRequest({ homeId, userId, source });
  if (!watch || watch.level === 'high') {
    return { claimed: false, reason: 'held', status: 200,
      message: 'We need to check this address first. Verify it by mail to open your household tools.' };
  }
  let data;
  try {
    const response = await db.rpc('claim_home_private_setup', {
      p_home_id: homeId, p_actor_id: userId, p_settle_days: SETTLE_DAYS[watch.level],
      p_validity_days: validityDays(), p_watch: { risk: watch.level, signals: watch.signals },
    });
    if (response.error || !response.data || typeof response.data !== 'object') throw response.error || new Error('no result');
    data = response.data;
  } catch (error) {
    logger.warn('home_claim.instant_unavailable', { home_id: homeId, user_id: userId, error: error.message });
    return { claimed: false, reason: 'unavailable', status: 503, message: 'Could not claim this home. Please retry.' };
  }
  if (data.ok === true && data.home_id === homeId) {
    if (!data.replayed) {
      logger.info('home_claim.instant', { home_id: homeId, user_id: userId, source, risk: watch.level });
    }
    return { claimed: true, homeId, settlesAt: data.settles_at || null, replayed: data.replayed === true };
  }
  const [status, message] = REFUSALS[data.code] || [503, 'Could not claim this home. Please retry.'];
  return { claimed: false, reason: REFUSALS[data.code] ? data.code : 'unavailable', status, message };
}

// A proof always beats a claim (the 2026-10-26 review). Once someone who proved the address lives at the Home, people
// whose access is a claim keep only their role's defaults until one of the people who proved it confirms them
// (home_claim_set_aside; home_effective_access and getUserAccess apply it), and anyone who proved it may confirm or
// remove them from Members. Both sides are told.
const CONFIRM_REFUSALS = Object.freeze({
  CLAIM_CONFIRM_INVALID: [400, 'Check the member and try again.'],
  SELF_ADMISSION_FORBIDDEN: [403, 'You can\'t confirm yourself.'],
  HOME_NOT_FOUND: [404, 'Home not found.'],
  CLAIM_CONFIRM_PROOF_REQUIRED: [403, 'Only someone who verified their address here can confirm who lives here.'],
  CLAIM_CONFIRM_NOT_CLAIM: [409, 'This member doesn\'t need confirming anymore. Refresh the member list.'],
});
const statusError = (code, status, message) => Object.assign(new Error(message), { code, status, statusCode: status });
const notify = (input) => require('./notificationService').createNotification(input)
  .catch(error => logger.warn('home_claim.notice_failed', { type: input.type, error: error.message }));
async function homeLabel(homeId) {
  const { data } = await db.from('Home').select('name, address').eq('id', homeId).maybeSingle();
  return data?.name || data?.address || 'your home';
}
async function rpcBoolean(name, args) {
  const { data, error } = await db.rpc(name, args);
  if (error || typeof data !== 'boolean') throw error || new Error(`${name}: no result`);
  return data;
}

/** Someone who proved the address says a person whose access is a claim lives here. Throws a status error. */
async function confirmMember({ homeId, actorId, targetId }) {
  if (![homeId, actorId, targetId].every(id => UUID.test(id || ''))) {
    throw statusError('CLAIM_CONFIRM_INVALID', ...CONFIRM_REFUSALS.CLAIM_CONFIRM_INVALID);
  }
  const ids = { p_home_id: homeId.toLowerCase(), p_actor_id: actorId.toLowerCase(), p_target_id: targetId.toLowerCase() };
  let data;
  try {
    const response = await db.rpc('confirm_home_claim_member', ids);
    if (response.error || !response.data || typeof response.data !== 'object') throw response.error || new Error('no result');
    data = response.data;
  } catch (error) {
    logger.warn('home_claim.confirm_unavailable', { home_id: homeId, error: error.message });
    throw statusError('CLAIM_CONFIRM_UNAVAILABLE', 503, 'Could not confirm this member. Please retry.');
  }
  if (data.ok !== true) {
    const [status, message] = CONFIRM_REFUSALS[data.code] || [503, 'Could not confirm this member. Please retry.'];
    throw statusError(CONFIRM_REFUSALS[data.code] ? data.code : 'CLAIM_CONFIRM_UNAVAILABLE', status, message);
  }
  if (data.target_id !== ids.p_target_id || typeof data.replayed !== 'boolean') {
    throw statusError('CLAIM_CONFIRM_UNAVAILABLE', 503, 'Could not confirm this member. Please retry.');
  }
  if (!data.replayed) {
    // The person isn't told who confirmed them, as they aren't told who proved the address.
    await notify({ userId: ids.p_target_id, type: 'home_claim_confirmed', title: 'You\'re confirmed',
      body: `A resident who verified the address confirmed you live at ${data.home_label}. The home's records are open to you again.`,
      icon: '🏡', link: `/homes/${ids.p_home_id}/dashboard`, metadata: { home_id: ids.p_home_id } });
  }
  return { confirmed: true, replayed: data.replayed };
}

/**
 * After someone proves the address (a postcard code): tell each person whose claim now steps back, and tell the person
 * who proved it once, with a link to Members. Never throws; a notice can't undo the proof.
 */
async function tellProofOverClaims({ homeId, provenUserId }) {
  try {
    const args = { p_home_id: homeId, p_user_id: provenUserId };
    if (!(await rpcBoolean('home_proof_holder', args))) return;
    const { data: rows, error } = await db.from('HomeOccupancy').select('id, user_id, verification_source, verified_at')
      .eq('home_id', homeId).eq('is_active', true).eq('verification_status', 'verified');
    if (error || !Array.isArray(rows)) throw error || new Error('no rows');
    const proof = rows.find(row => row.user_id === provenUserId);
    const claims = [];
    for (const row of rows.filter(r => r.verification_source === 'claim' && r.user_id !== provenUserId)) {
      if (await rpcBoolean('home_claim_set_aside', { p_home_id: homeId, p_user_id: row.user_id })) claims.push(row);
    }
    if (!proof || claims.length === 0) return;
    const label = await homeLabel(homeId);
    const proofKey = `${proof.id}:${Date.parse(proof.verified_at) || 0}`;
    // The claimer isn't told who proved the address: someone who claimed another person's home shouldn't learn who lives there.
    for (const claim of claims) {
      await notify({ userId: claim.user_id, type: 'home_claim_set_aside', title: 'A resident verified this address',
        body: `Someone verified they live at ${label}. The home's private records, like codes, documents, bills and emergency info, are hidden from you until they confirm you live there too.`,
        icon: '🏡', link: `/homes/${homeId}/dashboard`, metadata: { home_id: homeId },
        idempotencyKey: `home-claim-set-aside:${claim.id}:${proofKey}` });
    }
    await notify({ userId: provenUserId, type: 'home_claim_to_review', title: 'Confirm who lives here',
      body: `${claims.length === 1 ? 'Someone' : `${claims.length} people`} claimed ${label} before you verified your address. Until you confirm they live there, they can't see the home's codes, documents, bills or emergency info. Confirm or remove them in Members.`,
      icon: '🔔', link: `/homes/${homeId}/members`, metadata: { home_id: homeId },
      idempotencyKey: `home-claim-to-review:${proofKey}` });
  } catch (error) {
    logger.warn('home_claim.proof_notice_failed', { home_id: homeId, error: error.message });
  }
}

module.exports = { claimPrivateSetup, confirmMember, tellProofOverClaims, FLAG, SETTLE_DAYS };
