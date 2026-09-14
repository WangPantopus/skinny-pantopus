const db = require('../config/supabaseAdmin');
const verificationAge = require('../utils/verificationAge');

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const MESSAGES = {
  INVALID_ADMISSION_REQUEST: 'Check the residency review and try again.',
  MEMBERS_MANAGE_REQUIRED: 'You do not have permission to review household membership.',
  SELF_ADMISSION_FORBIDDEN: 'You cannot approve or reject your own membership.',
  HOME_NOT_FOUND: 'Home not found.', USER_NOT_FOUND: 'User not found.',
  CLAIM_NOT_FOUND: 'Claim not found.', CLAIM_NOT_PENDING: 'This claim has already been reviewed.',
  OWNERSHIP_FLOW_REQUIRED: 'Use the ownership flow to change an owner.',
  MEMBERSHIP_RENEWAL_REQUIRED: 'This membership needs a new access review before it can be restored.',
  RESIDENCY_ROLE_FORBIDDEN: 'Residency approval cannot grant ownership or management roles.',
  PROPOSED_ROLE_FORBIDDEN: 'That role exceeds the permitted authority or age limit.',
  PERMISSION_DELEGATION_FORBIDDEN: 'You cannot activate permissions that you do not hold.',
  RESIDENCY_REVIEW_CHANGED: 'The claim, membership or role permissions changed. Review the current details again.',
  RESIDENCY_REVIEW_REQUEST_CHANGED: 'This saved decision has different details. Recover its original request.',
};

function failure(code = 'RESIDENCY_REVIEW_UNAVAILABLE', status = 503) {
  return Object.assign(new Error(MESSAGES[code] || 'Could not confirm the residency review. Retry the original request.'), {
    code, statusCode: status,
  });
}

function identity({ homeId, claimId, actorId }) {
  if (![homeId, claimId, actorId].every(value => typeof value === 'string' && UUID.test(value))) {
    throw failure('INVALID_ADMISSION_REQUEST', 400);
  }
  return { homeId: homeId.toLowerCase(), claimId: claimId.toLowerCase(), actorId: actorId.toLowerCase() };
}

async function rpc(name, parameters) {
  let response;
  try { response = await db.rpc(name, parameters); } catch (_) { throw failure(); }
  if (!response || response.error || !response.data) throw failure();
  const result = response.data;
  if (result.ok !== true) {
    if (result.ok === false && Object.hasOwn(MESSAGES, result.code) && [400, 403, 404, 409].includes(result.status)) {
      throw failure(result.code, result.status);
    }
    throw failure();
  }
  return result;
}

function validCurrent(result, homeId, claimId) {
  const claim = result.claim, occupancy = result.occupancy;
  return result.home_id === homeId && claim?.id === claimId && claim.home_id === homeId
    && UUID.test(claim.user_id || '') && typeof claim.status === 'string' && claim.status.length > 0
    && HASH.test(claim.review_token || '')
    && (occupancy === null || (UUID.test(occupancy?.id || '') && occupancy.user_id === claim.user_id
      && typeof occupancy.is_active === 'boolean'));
}

async function read(input) {
  const { homeId, claimId, actorId } = identity(input);
  const result = await rpc('get_home_residency_review', { p_home_id: homeId, p_claim_id: claimId, p_actor_id: actorId });
  if (!validCurrent(result, homeId, claimId)) throw failure();
  return result;
}

async function decide(input) {
  const { homeId, claimId, actorId } = identity(input);
  const { action, role = null, reason = null, reviewToken = null } = input;
  let { requestId = null } = input;
  if (!['approve', 'reject'].includes(action)
    || (requestId !== null && (typeof requestId !== 'string' || !UUID.test(requestId)))
    || (requestId === null) !== (reviewToken === null)
    || (reviewToken !== null && (typeof reviewToken !== 'string' || !HASH.test(reviewToken)))
    || (role !== null && (typeof role !== 'string' || role.length > 64))
    || (reason !== null && (typeof reason !== 'string' || reason.length > 2000))
    || (action === 'approve' && typeof reason === 'string' && reason.trim() !== '')
    || (action === 'reject' && typeof role === 'string' && role.trim() !== '')) {
    throw failure('INVALID_ADMISSION_REQUEST', 400);
  }
  if (requestId !== null) requestId = requestId.toLowerCase();
  const result = await rpc('decide_home_residency_review', {
    p_home_id: homeId, p_claim_id: claimId, p_actor_id: actorId, p_action: action,
    p_role: role, p_reason: reason, p_request_id: requestId, p_review_token: reviewToken,
    p_validity_days: verificationAge.validityDays(),
  });
  const receipt = result.receipt;
  if (!validCurrent(result, homeId, claimId) || result.claim_id !== claimId || result.target_id !== result.claim.user_id
    || result.action !== action || typeof result.replayed !== 'boolean'
    || !UUID.test(receipt?.id || '') || receipt.home_id !== homeId || receipt.claim_id !== claimId
    || receipt.actor_id !== actorId || receipt.action !== action || !UUID.test(receipt.request_id || '')
    || (requestId !== null && receipt.request_id !== requestId) || receipt.legacy_request !== (requestId === null)
    || !HASH.test(receipt.request_hash || '') || !HASH.test(receipt.review_token || '')
    || (reviewToken !== null && receipt.review_token !== reviewToken)
    || !Number.isFinite(Date.parse(receipt.created_at || ''))
    || receipt.result?.status !== (action === 'approve' ? 'verified' : 'rejected')) throw failure();
  return result;
}

function sendError(res, error) {
  const safe = error?.code && (Object.hasOwn(MESSAGES, error.code) || error.code === 'RESIDENCY_REVIEW_UNAVAILABLE')
    ? error : failure();
  return res.status(safe.statusCode).json({ error: safe.message, code: safe.code });
}

module.exports = { read, decide, sendError };
