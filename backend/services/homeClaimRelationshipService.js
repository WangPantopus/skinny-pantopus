const db = require('../config/supabaseAdmin');

const MESSAGES = {
  HOME_NOT_FOUND: 'Home not found.',
  CLAIM_NOT_FOUND: 'Claim not found.',
  CLAIM_RELATIONSHIP_INVALID: 'Check the relationship decision and try again.',
  CLAIM_REVIEW_DENIED: 'You do not have permission to resolve this claimant relationship.',
  CLAIM_SELF_REVIEW_FORBIDDEN: 'You cannot resolve your own claim relationship.',
  CLAIM_NOT_ELIGIBLE: 'This claim can no longer be changed through this action.',
  CLAIM_CHALLENGE_REVIEW_REQUIRED: 'This claim needs the dedicated dispute review flow.',
  CLAIM_REVIEW_CHANGED: 'The claim or its evidence changed. Reopen it before deciding.',
  CLAIM_RELATIONSHIP_REQUEST_CHANGED: 'The saved decision has different details. Recover the original request.',
};
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;

function failure(code = 'CLAIM_RELATIONSHIP_UNAVAILABLE', status = 503) {
  return Object.assign(new Error(MESSAGES[code] || 'Could not confirm the relationship decision. Retry the original request.'), {
    code, statusCode: status,
  });
}

async function decide({ homeId, claimId, actorId, action, note = null, requestId = null, reviewToken = null }) {
  if (![homeId, claimId, actorId].every(value => typeof value === 'string' && UUID.test(value))
    || (requestId !== null && (typeof requestId !== 'string' || !UUID.test(requestId)))) {
    throw failure('CLAIM_RELATIONSHIP_INVALID', 400);
  }
  homeId = homeId.toLowerCase(); claimId = claimId.toLowerCase(); actorId = actorId.toLowerCase();
  if (requestId !== null) requestId = requestId.toLowerCase();
  let response;
  try {
    response = await db.rpc('decide_home_claim_relationship', {
      p_home_id: homeId, p_claim_id: claimId, p_actor_id: actorId, p_action: action,
      p_note: note, p_request_id: requestId, p_review_token: reviewToken,
    });
  } catch (_) { throw failure(); }
  if (!response || response.error || !response.data) throw failure();
  const result = response.data;
  if (result.ok !== true) {
    if (result.ok === false && Object.hasOwn(MESSAGES, result.code) && [400, 403, 404, 409].includes(result.status)) {
      throw failure(result.code, result.status);
    }
    throw failure();
  }
  const receipt = result.receipt;
  if (result.homeId !== homeId || result.claimId !== claimId || result.action !== action
    || !UUID.test(result.claimantId || '') || typeof result.replayed !== 'boolean' || result.claim?.id !== claimId
    || !HASH.test(result.claim?.review_token || '') || typeof result.claim?.state !== 'string'
    || !UUID.test(receipt?.id || '') || receipt.home_id !== homeId || receipt.claim_id !== claimId
    || receipt.actor_id !== actorId || receipt.action !== action || !UUID.test(receipt.request_id || '')
    || (requestId !== null && receipt.request_id !== requestId) || receipt.legacy_request !== (requestId === null)
    || !HASH.test(receipt.request_hash || '') || !HASH.test(receipt.review_token || '')
    || (reviewToken !== null && receipt.review_token !== reviewToken)
    || typeof receipt.created_at !== 'string' || !Number.isFinite(Date.parse(receipt.created_at))
    || typeof receipt.result?.qualifies_for_dispute !== 'boolean') throw failure();
  return result;
}

function sendError(res, error) {
  const safe = error?.code && (Object.hasOwn(MESSAGES, error.code) || error.code === 'CLAIM_RELATIONSHIP_UNAVAILABLE')
    ? error : failure();
  return res.status(safe.statusCode).json({ error: safe.message, code: safe.code });
}

module.exports = { decide, sendError };
