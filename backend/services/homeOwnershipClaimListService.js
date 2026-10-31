/**
 * The caller's own ownership claims, as the claim waiting room and My Claims read them
 * (GET /api/homes/my-ownership-claims) and the assistant reports them. Internal states
 * are masked for the claimant (an opaque handshake), so nothing here says whether
 * anyone else claimed the same home.
 */
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const householdClaimConfig = require('../config/householdClaims');
const homeClaimIdentityService = require('./homeClaimIdentityService');

/**
 * Opaque handshake: mask internal claim states for the claimant.
 */
function maskClaimState(state, claimPhaseV2 = null) {
  const useV2ReadPaths = householdClaimConfig.flags.v2ReadPaths;
  const phaseRequiresCompatibilityOverride = claimPhaseV2 === 'challenged' || claimPhaseV2 === 'expired';

  if ((useV2ReadPaths || phaseRequiresCompatibilityOverride) && ['initiated', 'evidence_submitted', 'under_review', 'challenged'].includes(claimPhaseV2)) {
    return 'under_review';
  }

  if ((useV2ReadPaths || phaseRequiresCompatibilityOverride) && claimPhaseV2 === 'verified') {
    return 'approved';
  }

  if ((useV2ReadPaths || phaseRequiresCompatibilityOverride) && (claimPhaseV2 === 'rejected' || claimPhaseV2 === 'expired')) {
    return 'rejected';
  }

  const terminalStates = {
    approved: 'approved',
    rejected: 'rejected',
    revoked: 'revoked',
  };
  return terminalStates[state] || 'under_review';
}

/**
 * What Pantopus asked for while the claim waits (Request info, POST /api/admin/claims/:id/review; household owners
 * can't ask): the reviewer's note, when, and when the first document came in after it. The status stays the masked
 * `under_review` older apps read. Null when nothing is asked.
 */
function infoRequest(claim, documentTimes) {
  if (claim.state !== 'needs_more_info' || !claim.reviewed_at) return null;
  const asked = Date.parse(claim.reviewed_at);
  const after = documentTimes.filter(time => Date.parse(time) > asked).sort((a, b) => Date.parse(a) - Date.parse(b));
  const note = typeof claim.review_note === 'string' && claim.review_note.trim() ? claim.review_note.trim() : null;
  return { note, requested_at: claim.reviewed_at, responded_at: after[0] || null };
}

/** The claims `userId` made, newest first, with masked statuses. Throws when they can't be read. */
async function listOwnClaims(userId) {
  const { data: claims, error } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id, home_id, claim_type, state, claim_phase_v2, method, created_at, updated_at, reviewed_at, review_note, home:home_id ( address, address2, city, state )')
    .eq('claimant_user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Whether each claim has documents, so a claim started from Add Home isn't
  // described as documents waiting for review, and when each came in. Unknown
  // (null) if unreadable. An identity check is not a document.
  let withEvidence = null;
  const uploadedAt = new Map();
  const claimIds = (claims || []).map(c => c.id);
  if (claimIds.length) {
    const { data: evidence, error: evidenceError } = await supabaseAdmin
      .from('HomeVerificationEvidence')
      .select('claim_id, created_at')
      .in('claim_id', claimIds)
      .neq('evidence_type', 'idv');
    if (evidenceError) {
      logger.warn('Failed to read claim evidence presence', { error: evidenceError.message });
    } else {
      withEvidence = new Set((evidence || []).map(e => e.claim_id));
      for (const e of evidence || []) uploadedAt.set(e.claim_id, [...(uploadedAt.get(e.claim_id) || []), e.created_at]);
    }
  }

  // What each claim in review still needs before it can be approved (the claimant's
  // checklist). Unknown (null) if unreadable; the claims still list.
  let progress = null;
  const inReview = (claims || []).filter(c => maskClaimState(c.state, c.claim_phase_v2) === 'under_review').map(c => c.id);
  if (inReview.length) {
    try {
      progress = await homeClaimIdentityService.progressFor(inReview);
    } catch (error) {
      logger.warn('Failed to read claim approval progress', { errorCode: error.code });
    }
  }

  // The claimed address is the one they entered, so their own claim can name it.
  return (claims || []).map(c => ({
    id: c.id,
    home_id: c.home_id,
    claim_type: c.claim_type,
    method: c.method,
    status: maskClaimState(c.state, c.claim_phase_v2),
    has_evidence: withEvidence ? withEvidence.has(c.id) : null,
    approval: progress?.get(c.id)?.active ? homeClaimIdentityService.claimantApproval(progress.get(c.id)) : null,
    info_request: infoRequest(c, uploadedAt.get(c.id) || []),
    created_at: c.created_at,
    updated_at: c.updated_at,
    home: c.home ? {
      address: c.home.address || null, address2: c.home.address2 || null,
      city: c.home.city || null, state: c.home.state || null,
    } : null,
  }));
}

module.exports = { listOwnClaims, maskClaimState };
