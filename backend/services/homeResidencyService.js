const db = require('../config/supabaseAdmin');
const verificationAge = require('../utils/verificationAge');

const MESSAGES = {
  INVALID_ADMISSION_REQUEST: 'Check the residency request and try again.',
  MEMBERS_MANAGE_REQUIRED: 'You do not have permission to manage members.',
  SELF_ADMISSION_FORBIDDEN: 'You cannot approve your own membership.',
  HOME_NOT_FOUND: 'Home not found.', USER_NOT_FOUND: 'User not found.',
  CLAIM_NOT_FOUND: 'Claim not found.', CLAIM_NOT_PENDING: 'This claim has already been reviewed.',
  OWNERSHIP_FLOW_REQUIRED: 'Use the ownership flow to change an owner.',
  MEMBERSHIP_RENEWAL_REQUIRED: 'This membership needs a new access review before it can be restored.',
  RESIDENCY_ROLE_FORBIDDEN: 'Residency approval cannot grant ownership or management roles.',
  PROPOSED_ROLE_FORBIDDEN: 'That role exceeds the permitted authority or age limit.',
  PERMISSION_DELEGATION_FORBIDDEN: 'You cannot activate permissions that you do not hold.',
};
function fail(code = 'HOME_ADMISSION_UNAVAILABLE', status = 503) {
  return Object.assign(new Error(MESSAGES[code] || 'Could not confirm this Home admission. Please retry.'), {
    code, status, statusCode: status,
  });
}
async function review({ homeId, actorId, action, targetId, claimId, role, reason }) {
  const payload = action === 'attach' ? { target_id: targetId } : { claim_id: claimId };
  if (action === 'approve' && role !== undefined) payload.role = role;
  if (action === 'reject' && reason !== undefined) payload.reason = reason;
  let response;
  try {
    response = await db.rpc('review_home_residency', {
      p_home_id: homeId, p_actor_id: actorId, p_action: action,
      p_payload: payload, p_validity_days: verificationAge.validityDays(),
    });
  } catch (_) { throw fail(); }
  if (!response || response.error || !response.data) {
    if (response?.error?.code?.startsWith('22')) throw fail('INVALID_ADMISSION_REQUEST', 400);
    throw fail();
  }
  const result = response.data;
  if (result.ok !== true) {
    if (Object.hasOwn(MESSAGES, result.code) && [400, 403, 404, 409].includes(result.status)) throw fail(result.code, result.status);
    throw fail();
  }
  if (!result.target_id || typeof result.replayed !== 'boolean'
    || (action !== 'reject' && (!result.occupancy?.id || !result.user?.id))) throw fail();
  return result;
}
module.exports = { review };
