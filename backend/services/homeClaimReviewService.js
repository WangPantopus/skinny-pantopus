const db = require('../config/supabaseAdmin');
const verificationAge = require('../utils/verificationAge');
const logger = require('../utils/logger');

const MESSAGES = {
  HOME_NOT_FOUND: 'Home not found.', CLAIM_NOT_FOUND: 'Claim not found.',
  CLAIM_REVIEW_INVALID: 'Check the claim review details and try again.',
  CLAIM_REVIEW_DENIED: 'You do not have permission to review this claim.',
  CLAIM_RECIPIENT_MISMATCH: 'This claim belongs to another account.',
  CLAIM_SELF_REVIEW_FORBIDDEN: 'You cannot review your own claim.',
  CLAIM_REVIEW_CHANGED: 'The claim or its evidence changed. Reopen it before reviewing.',
  CLAIM_NOT_ELIGIBLE: 'This claim can no longer be changed through this action.',
  CLAIM_CHALLENGE_REVIEW_REQUIRED: 'This claim needs the dedicated dispute review flow.',
  CLAIM_VERIFIED_EVIDENCE_REQUIRED: 'Current verified evidence is required. Legacy documents need a private re-upload before approval.',
  CLAIM_EVIDENCE_PRIVATE_REUPLOAD_REQUIRED: 'Private document uploads are temporarily unavailable. Your claim is unchanged. Please try again later.',
  IDENTITY_CONFIRMATION_REQUIRED: 'Current identity confirmation is required before approval.',
  MEMBERSHIP_RENEWAL_REQUIRED: 'This membership needs a new review before it can be restored.',
  CLAIM_ACCESS_NOT_STARTED: 'This claim can be approved when its existing access window starts.',
  OWNERSHIP_REVIEW_REQUIRED: 'This ownership history needs a separate ownership review.',
  PROPOSED_ROLE_FORBIDDEN: 'The proposed role exceeds the current authority or age limit.',
  PERMISSION_DELEGATION_FORBIDDEN: 'You cannot grant permissions that you do not hold.',
  OWNERSHIP_MANAGE_REQUIRED: 'You do not have permission to resolve this claim.',
  OWNER_INVITE_AUTHORITY_REQUIRED: 'Only a current verified owner can approve a co-owner.',
};
function failure(code = 'CLAIM_REVIEW_UNAVAILABLE', status = 503) {
  return Object.assign(new Error(MESSAGES[code] || 'Could not confirm the claim request. Please retry.'), { code, status, statusCode: status });
}
async function call(name, args) {
  let response;
  try { response = await db.rpc(name, args); } catch (_) { throw failure(); }
  if (!response || response.error || !response.data) throw failure();
  const result = response.data;
  if (result.ok !== true) {
    if (result.ok === false && Object.hasOwn(MESSAGES, result.code) && [400,403,404,409,410].includes(result.status)) {
      throw failure(result.code, result.status);
    }
    throw failure();
  }
  if (typeof result.homeId !== 'string' || result.claimId !== args.p_claim_id
    || (args.p_home_id !== null && result.homeId !== args.p_home_id)) throw failure();
  return result;
}
async function read({ homeId = null, claimId, actorId, platformAdmin = false }) {
  const result = await call('get_home_claim_review', { p_home_id: homeId, p_claim_id: claimId,
    p_actor_id: actorId, p_platform_admin: platformAdmin });
  if (result.claim?.id !== claimId || result.claim.home_id !== result.homeId
    || !/^[a-f0-9]{64}$/.test(result.claim.review_token) || !Array.isArray(result.evidence)) throw failure();
  return result;
}
async function mutate({ homeId = null, claimId, actorId, action, reviewToken = null, note = null, platformAdmin = false }) {
  const result = await call('mutate_home_claim_review', { p_home_id: homeId, p_claim_id: claimId, p_actor_id: actorId,
    p_action: action, p_review_token: reviewToken, p_note: note, p_platform_admin: platformAdmin,
    p_validity_days: verificationAge.validityDays() });
  if (result.action !== action || typeof result.replayed !== 'boolean' || typeof result.state !== 'string') throw failure();
  if (action === 'withdraw' && (result.withdrawn !== true || result.deleted !== false)) throw failure();
  if (action === 'approve' && (!result.occupancy?.id || result.occupancy.home_id !== result.homeId
    || result.occupancy.user_id !== result.claimantId || result.state !== 'approved')) throw failure();
  // Notifications are a best-effort consequence of the committed receipt.
  if (platformAdmin && !result.replayed && ['approve','reject','request_more_info'].includes(action)) {
    const methods = { approve: 'notifyOwnershipClaimApproved', reject: 'notifyOwnershipClaimRejected', request_more_info: 'notifyOwnershipClaimNeedsMoreInfo' };
    try {
      await require('./notificationService')[methods[action]]({ userId: result.claimantId, homeId: result.homeId,
        homeName: 'your home', reason: action === 'reject' ? note || undefined : undefined });
    } catch (error) { logger.warn('Claim review notification failed after commit', { claimId, code: error.code }); }
  }
  return result;
}
function sendError(res, error) {
  const safe = error?.code && (Object.hasOwn(MESSAGES, error.code) || error.code === 'CLAIM_REVIEW_UNAVAILABLE') ? error : failure();
  return res.status(safe.statusCode).json({ error: safe.message, code: safe.code });
}
async function recordProvider({ homeId, claimId, actorId, result }) {
  const receipt = await call('record_home_claim_provider_evidence', { p_home_id: homeId, p_claim_id: claimId,
    p_actor_id: actorId, p_provider: result.provider, p_matched: result.matched, p_confidence: result.confidence,
    p_details: result.details || null, p_apn: result.apn || null });
  if (typeof receipt.evidenceId !== 'string') throw failure();
  return receipt;
}
module.exports = { read, mutate, recordProvider, sendError };
