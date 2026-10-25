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

module.exports = { claimPrivateSetup, FLAG, SETTLE_DAYS };
