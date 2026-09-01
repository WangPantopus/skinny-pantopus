const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const LEGACY_TO_PHASE_V2 = {
  draft: 'initiated',
  submitted: 'evidence_submitted',
  needs_more_info: 'under_review',
  pending_review: 'under_review',
  pending_challenge_window: 'under_review',
  approved: 'verified',
  rejected: 'rejected',
  disputed: 'challenged',
  revoked: 'rejected',
};

const ACTIVE_LEGACY_STATES = new Set([
  'draft',
  'submitted',
  'needs_more_info',
  'pending_review',
  'pending_challenge_window',
]);

const ACTIVE_PHASE_V2_STATES = new Set([
  'initiated',
  'evidence_submitted',
  'under_review',
  'challenged',
]);

const CLAIM_STRENGTH_RANK = {
  resident_low: 1,
  resident_standard: 2,
  owner_standard: 3,
  owner_strong: 4,
  owner_legal: 5,
};

function mapLegacyStateToPhaseV2(state) {
  return LEGACY_TO_PHASE_V2[state] || null;
}

function isLegacyStateActive(state) {
  return ACTIVE_LEGACY_STATES.has(state);
}

function isClaimPhaseActive(phase) {
  return ACTIVE_PHASE_V2_STATES.has(phase);
}

function isClaimActiveRecord(claim) {
  if (!claim || claim.merged_into_claim_id) {
    return false;
  }

  if (claim.claim_phase_v2) {
    return isClaimPhaseActive(claim.claim_phase_v2);
  }

  return isLegacyStateActive(claim.state);
}

function hasQualifyingActiveChallenge(claim) {
  if (!claim || claim.merged_into_claim_id) {
    return false;
  }

  if (claim.claim_phase_v2 === 'challenged') {
    return true;
  }

  return claim.state === 'disputed' || claim.challenge_state === 'challenged';
}

function deriveHomeResolutionState({ activeClaims, hasVerifiedOwner, hasActiveChallenge }) {
  if (hasVerifiedOwner && hasActiveChallenge) {
    return 'disputed';
  }

  if (hasVerifiedOwner) {
    return 'verified_household';
  }

  if (activeClaims > 1) {
    return 'contested';
  }

  if (activeClaims === 1) {
    return 'pending_single_claim';
  }

  return 'unclaimed';
}

function deriveInitialRoutingClassification({
  method = null,
  hasVerifiedOwner = false,
  hasOtherActiveIndependentClaim = false,
} = {}) {
  if (method === 'invite' || method === 'vouch') {
    return 'standalone_claim';
  }

  if (hasVerifiedOwner) {
    return 'challenge_claim';
  }

  if (hasOtherActiveIndependentClaim) {
    return 'parallel_claim';
  }

  return 'standalone_claim';
}

function deriveInitialIdentityStatus() {
  return 'not_started';
}

function deriveStrengthFromEvidence({ claimType, evidenceType }) {
  if (!evidenceType) return null;

  if (claimType === 'resident') {
    if (['utility_bill', 'lease'].includes(evidenceType)) {
      return 'resident_standard';
    }
    return null;
  }

  if (['deed', 'title_match'].includes(evidenceType)) {
    return 'owner_legal';
  }

  if (['closing_disclosure', 'escrow_attestation'].includes(evidenceType)) {
    return 'owner_strong';
  }

  if (['tax_bill'].includes(evidenceType)) {
    return 'owner_standard';
  }

  return null;
}

function maxStrength(a, b) {
  if (!a) return b;
  if (!b) return a;
  return CLAIM_STRENGTH_RANK[b] > CLAIM_STRENGTH_RANK[a] ? b : a;
}

async function deriveClaimStrength(claimId, { includeUnverified = false } = {}) {
  const { data: claim, error: claimError } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id, claim_type')
    .eq('id', claimId)
    .maybeSingle();

  if (claimError) throw claimError;
  if (!claim) return null;

  const { data: evidenceRows, error: evidenceError } = await supabaseAdmin
    .from('HomeVerificationEvidence')
    .select('evidence_type, status')
    .eq('claim_id', claimId);

  if (evidenceError) throw evidenceError;

  let claimStrength = null;
  for (const evidence of evidenceRows || []) {
    if (!includeUnverified && evidence.status !== 'verified') {
      continue;
    }

    const derived = deriveStrengthFromEvidence({
      claimType: claim.claim_type,
      evidenceType: evidence.evidence_type,
    });
    claimStrength = maxStrength(claimStrength, derived);
  }

  return claimStrength;
}

async function getHomeResolutionSnapshot(homeId) {
  const [ownersResult, claimsResult] = await Promise.all([
    supabaseAdmin
      .from('HomeOwner')
      .select('id')
      .eq('home_id', homeId)
      .eq('owner_status', 'verified'),
    supabaseAdmin
      .from('HomeOwnershipClaim')
      .select('id, state, claim_phase_v2, challenge_state, merged_into_claim_id')
      .eq('home_id', homeId),
  ]);

  if (ownersResult.error) throw ownersResult.error;
  if (claimsResult.error) throw claimsResult.error;

  const claims = claimsResult.data || [];
  const activeClaims = claims.filter((claim) => isClaimActiveRecord(claim)).length;
  const hasVerifiedOwner = (ownersResult.data || []).length > 0;
  const hasActiveChallenge = claims.some((claim) => hasQualifyingActiveChallenge(claim));

  const householdResolutionState = deriveHomeResolutionState({
    activeClaims,
    hasVerifiedOwner,
    hasActiveChallenge,
  });

  return {
    householdResolutionState,
    activeClaims,
    hasVerifiedOwner,
    hasActiveChallenge,
  };
}

async function classifySubmission({
  homeId,
  userId,
  method = null,
}) {
  const [ownersResult, claimsResult] = await Promise.all([
    supabaseAdmin
      .from('HomeOwner')
      .select('id')
      .eq('home_id', homeId)
      .eq('owner_status', 'verified'),
    supabaseAdmin
      .from('HomeOwnershipClaim')
      .select('id, claimant_user_id, state, claim_phase_v2, merged_into_claim_id')
      .eq('home_id', homeId),
  ]);

  if (ownersResult.error) throw ownersResult.error;
  if (claimsResult.error) throw claimsResult.error;

  const activeClaims = (claimsResult.data || []).filter((claim) => isClaimActiveRecord(claim));
  const hasVerifiedOwner = (ownersResult.data || []).length > 0;
  const hasOtherActiveIndependentClaim = activeClaims.some((claim) => claim.claimant_user_id !== userId);
  const routingClassification = deriveInitialRoutingClassification({
    method,
    hasVerifiedOwner,
    hasOtherActiveIndependentClaim,
  });

  return {
    routingClassification,
    hasVerifiedOwner,
    hasOtherActiveIndependentClaim,
    activeIndependentClaimCount: activeClaims.length,
  };
}

function isChallengeStrengthEligible(claimStrength) {
  return claimStrength === 'owner_strong' || claimStrength === 'owner_legal';
}

async function syncClaimChallengeState(claimId) {
  const { data: claim, error: claimError } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id, home_id, state, claim_phase_v2, routing_classification, claim_strength, challenge_state, merged_into_claim_id')
    .eq('id', claimId)
    .maybeSingle();

  if (claimError) throw claimError;
  if (!claim || claim.merged_into_claim_id) {
    return false;
  }

  const currentPhase = claim.claim_phase_v2 || mapLegacyStateToPhaseV2(claim.state);
  if (!isClaimPhaseActive(currentPhase)) {
    return false;
  }

  const { count: verifiedOwners, error: ownersError } = await supabaseAdmin
    .from('HomeOwner')
    .select('id', { count: 'exact', head: true })
    .eq('home_id', claim.home_id)
    .eq('owner_status', 'verified');

  if (ownersError) throw ownersError;

  const shouldChallenge = (
    claim.routing_classification === 'challenge_claim'
    && verifiedOwners > 0
    && isChallengeStrengthEligible(claim.claim_strength)
  );

  const nextPhase = shouldChallenge ? 'challenged' : currentPhase;
  const nextChallengeState = shouldChallenge ? 'challenged' : claim.challenge_state || 'none';

  if (nextPhase === claim.claim_phase_v2 && nextChallengeState === claim.challenge_state) {
    return shouldChallenge;
  }

  const { error: updateError } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .update({
      claim_phase_v2: nextPhase,
      challenge_state: nextChallengeState,
      updated_at: new Date().toISOString(),
    })
    .eq('id', claimId);

  if (updateError) throw updateError;

  return shouldChallenge;
}

async function recalculateHomeResolutionState(homeId) {
  const snapshot = await getHomeResolutionSnapshot(homeId);
  const updatedAt = new Date().toISOString();

  // household_resolution_state only — Home.security_state stays under manual / explicit dispute flows.
  const { error: updateError } = await supabaseAdmin
    .from('Home')
    .update({
      household_resolution_state: snapshot.householdResolutionState,
      household_resolution_updated_at: updatedAt,
      updated_at: updatedAt,
    })
    .eq('id', homeId);

  if (updateError) {
    throw updateError;
  }

  logger.info('Recalculated home household resolution state', {
    homeId,
    household_resolution_state: snapshot.householdResolutionState,
    activeClaims: snapshot.activeClaims,
    hasVerifiedOwner: snapshot.hasVerifiedOwner,
    hasActiveChallenge: snapshot.hasActiveChallenge,
  });

  return snapshot.householdResolutionState;
}

async function reconcileOperationalDisputeState(homeId, { force = false } = {}) {
  const [{ data: home, error: homeError }, snapshot] = await Promise.all([
    supabaseAdmin
      .from('Home')
      .select('id, security_state, ownership_state, claim_window_ends_at')
      .eq('id', homeId)
      .maybeSingle(),
    getHomeResolutionSnapshot(homeId),
  ]);

  if (homeError) throw homeError;
  if (!home) return false;

  if (
    home.security_state !== 'disputed'
    || snapshot.householdResolutionState === 'disputed'
    || (!force && home.ownership_state !== 'disputed')
  ) {
    return false;
  }

  const now = new Date();
  const nextSecurityState = home.claim_window_ends_at && new Date(home.claim_window_ends_at) > now
    ? 'claim_window'
    : 'normal';
  const nextOwnershipState = snapshot.hasVerifiedOwner ? 'owner_verified' : 'unclaimed';
  const updatedAt = now.toISOString();

  const { error: updateError } = await supabaseAdmin
    .from('Home')
    .update({
      security_state: nextSecurityState,
      ownership_state: nextOwnershipState,
      updated_at: updatedAt,
    })
    .eq('id', homeId);

  if (updateError) throw updateError;

  logger.info('Reconciled operational dispute state', {
    homeId,
    security_state: nextSecurityState,
    ownership_state: nextOwnershipState,
    household_resolution_state: snapshot.householdResolutionState,
  });

  return true;
}

module.exports = {
  mapLegacyStateToPhaseV2,
  isLegacyStateActive,
  isClaimPhaseActive,
  isClaimActiveRecord,
  hasQualifyingActiveChallenge,
  deriveHomeResolutionState,
  deriveInitialRoutingClassification,
  deriveInitialIdentityStatus,
  classifySubmission,
  deriveClaimStrength,
  isChallengeStrengthEligible,
  syncClaimChallengeState,
  getHomeResolutionSnapshot,
  recalculateHomeResolutionState,
  reconcileOperationalDisputeState,
};
