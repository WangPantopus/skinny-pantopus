const crypto = require('crypto');
const db = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const verificationAge = require('../utils/verificationAge');

const MESSAGES = {
  CLAIM_MERGE_INVALID: 'Check the claim invitation details and try again.',
  HOME_NOT_FOUND: 'Home not found.', CLAIM_NOT_FOUND: 'Claim not found.',
  CLAIM_RECIPIENT_MISMATCH: 'This claim belongs to a different account.',
  CLAIM_NOT_ELIGIBLE: 'This claim needs a new review before it can join the household.',
  CLAIM_ACCESS_NOT_STARTED: 'This invitation can be accepted when the existing access window starts.',
  CLAIM_INVITE_NOT_FOUND: 'No eligible household invitation was found for this claim.',
  CLAIM_INVITE_EXPIRED: 'This claim invitation has expired.',
  CLAIM_INVITE_CHANGED: 'The claim or invitation policy changed. Request a new invitation.',
  CLAIM_INVITE_ALREADY_USED: 'This invitation is no longer available.',
  OWNERSHIP_MANAGE_REQUIRED: 'You do not have permission to resolve this claim.',
  OWNER_INVITE_AUTHORITY_REQUIRED: 'Only current verified owners can invite co-owners.',
  IDENTITY_CONFIRMATION_REQUIRED: 'Identity confirmation is required before this claim can join the household.',
  MEMBERSHIP_RENEWAL_REQUIRED: 'This membership needs a new review before it can be restored.',
  OWNERSHIP_REVIEW_REQUIRED: 'This ownership history needs a separate ownership review.',
  PROPOSED_ROLE_FORBIDDEN: 'That role exceeds the permitted authority or age limit.',
  PERMISSION_DELEGATION_FORBIDDEN: 'You cannot grant permissions that you do not hold.',
};
function failure(code = 'CLAIM_MERGE_UNAVAILABLE', status = 503) {
  return Object.assign(new Error(MESSAGES[code] || 'Could not confirm this claim invitation. Please retry.'),
    { code, status, statusCode: status });
}
async function transact(args) {
  let response;
  try { response = await db.rpc('mutate_home_claim_invitation', args); } catch (_) { throw failure(); }
  if (!response || response.error || !response.data) throw failure();
  const result = response.data;
  if (result.ok !== true) {
    if (Object.hasOwn(MESSAGES, result.code) && [400,403,404,409,410].includes(result.status)) {
      throw failure(result.code, result.status);
    }
    throw failure();
  }
  if (typeof result.replayed !== 'boolean' || result.homeId !== args.p_home_id
    || result.claimId !== args.p_claim_id || !result.invitation?.id
    || (args.p_invitation_id !== null && result.invitation.id !== args.p_invitation_id)) throw failure();
  return result;
}
async function issueClaimInvitation({ homeId, claimId, userId, note = null }) {
  const result = await transact({ p_home_id: homeId, p_claim_id: claimId, p_actor_id: userId,
    p_action: 'issue', p_invitation_id: null, p_token: crypto.randomBytes(32).toString('hex'),
    p_note: note, p_validity_days: verificationAge.validityDays() });
  if (!result.invitation.invitee_user_id || (!result.replayed && typeof result.token !== 'string')) throw failure();
  if (!result.replayed) {
    try {
      await require('./notificationService').notifyHomeInvite({ inviteeUserId: result.invitation.invitee_user_id,
        inviterName: result.actor_name, homeName: result.home_label, homeId, inviteToken: result.token });
    } catch (err) { logger.warn('Claim invitation notification failed after commit', { code: err.code, claimId }); }
  }
  // The raw token is delivery-only in this existing endpoint, never part of its response.
  const { token: _token, ...safe } = result;
  return safe;
}
async function acceptClaimMerge({ homeId, claimId, userId, invitationId = null }) {
  const result = await transact({ p_home_id: homeId, p_claim_id: claimId, p_actor_id: userId,
    p_action: 'accept', p_invitation_id: invitationId, p_token: null, p_note: null,
    p_validity_days: verificationAge.validityDays() });
  if (!result.occupancy?.id || result.occupancy.home_id !== homeId || result.occupancy.user_id !== userId
    || !['owner','admin','lease_resident'].includes(result.acceptedRoleBase)
    || result.acceptedAsOwner !== (result.acceptedRoleBase === 'owner')
    || result.claimPhaseV2 !== (result.acceptedAsOwner ? 'verified' : 'merged_into_household')
    || result.terminalReason !== (result.acceptedAsOwner ? 'none' : 'merged_via_invite')) throw failure();
  if (!result.replayed) {
    try {
      await require('./notificationService').notifyHomeInviteAccepted({ inviterUserId: result.inviter_id,
        accepterName: result.actor_name, homeName: result.home_label, homeId });
    } catch (err) { logger.warn('Claim acceptance notification failed after commit', { code: err.code, claimId }); }
  }
  return result;
}
module.exports = { issueClaimInvitation, acceptClaimMerge };
