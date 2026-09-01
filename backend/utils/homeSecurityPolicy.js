/**
 * Home Security Policy Module
 *
 * Centralised enforcement for:
 *  - Claim eligibility & rate-limiting
 *  - Verification-tier dominance
 *  - Quorum requirement calculation
 *  - Rental firewall
 *  - Risk scoring
 *  - Claim-window / policy-change guards
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const householdClaimConfig = require('../config/householdClaims');
const homeClaimRoutingService = require('../services/homeClaimRoutingService');

// ============================================================
// CONSTANTS
// ============================================================

const CLAIM_WINDOW_DAYS = 14;
const CONSTRUCTIVE_CONSENT_DAYS = 7;
const MAX_OWNER_CLAIMS_PER_30D = 5;
const MAX_CLAIMS_PER_HOME_PER_30D = 10;
const REJECTION_COOLDOWN_DAYS = 7;

const TIER_RANK = { weak: 1, standard: 2, strong: 3, legal: 4 };

const RISK_TIER_CONFIG = {
  0: { quorum: false },
  1: { quorum: 'constructive', label: 'low' },
  2: { quorum: 'constructive', label: 'medium' },
  3: { quorum: 'explicit', label: 'high' },
};

const ACTION_RISK_TIERS = {
  CHANGE_MEMBER_ATTACH_POLICY: 1,
  ADD_SERVICE_PROVIDER:        1,
  CHANGE_OWNER_CLAIM_POLICY:   2,
  CHANGE_PRIVACY_MASK:         2,
  CHANGE_TENURE_MODE:          2,
  TRANSFER_OWNERSHIP:          3,
  REMOVE_OWNER:                3,
  CHANGE_PRIMARY_OWNER:        3,
  MAIL_ROUTING_CHANGE:         3,
  FREEZE_HOME:                 3,
};

// ============================================================
// Claim eligibility
// ============================================================

async function canSubmitOwnerClaim(homeId, userId) {
  const errors = [];
  let routingClassification = 'standalone_claim';

  const { data: home } = await supabaseAdmin
    .from('Home')
    .select('id, security_state, tenure_mode, owner_claim_policy, home_status')
    .eq('id', homeId)
    .single();

  if (!home) return { allowed: false, errors: ['Home not found'], blockCode: null };

  try {
    const classification = await homeClaimRoutingService.classifySubmission({ homeId, userId });
    routingClassification = classification.routingClassification;
  } catch (error) {
    logger.warn('household_claim.classification_failed', {
      home_id: homeId,
      claimant_user_id: userId,
      error: error.message,
    });
  }

  if (home.home_status !== 'active') {
    errors.push('Home is not active');
  }

  if (home.security_state === 'frozen' || home.security_state === 'frozen_silent') {
    errors.push('Home is currently restricted');
  }

  const rentalCheck = evaluateRentalFirewall(home, null);
  if (rentalCheck.blocked) {
    errors.push(rentalCheck.reason);
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const { count: userClaimCount } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id', { count: 'exact', head: true })
    .eq('claimant_user_id', userId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (userClaimCount >= MAX_OWNER_CLAIMS_PER_30D) {
    errors.push('You have reached the maximum number of ownership claims for this period');
  }

  const { count: homeClaimCount } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id', { count: 'exact', head: true })
    .eq('home_id', homeId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (homeClaimCount >= MAX_CLAIMS_PER_HOME_PER_30D) {
    errors.push('This home has reached the maximum number of claims for this period');
  }

  const cooldownDate = new Date(now.getTime() - REJECTION_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  const { data: recentRejection } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id')
    .eq('home_id', homeId)
    .eq('claimant_user_id', userId)
    .eq('state', 'rejected')
    .gte('updated_at', cooldownDate.toISOString())
    .limit(1)
    .maybeSingle();

  if (recentRejection) {
    errors.push('Please wait before submitting another claim for this home');
  }

  const { data: existingActive } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id')
    .eq('home_id', homeId)
    .eq('claimant_user_id', userId)
    .in('state', ['draft', 'submitted', 'pending_review', 'pending_challenge_window', 'needs_more_info'])
    .limit(1)
    .maybeSingle();

  if (existingActive) {
    errors.push('You already have an active claim for this home');
  }

  // idx_home_claim_active_unique: only one row per home in submitted / pending_review /
  // pending_challenge_window. Block before insert so clients get a clear code (not 23505).
  if (!existingActive) {
    const { data: otherInFlight } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .select('id')
      .eq('home_id', homeId)
      .neq('claimant_user_id', userId)
      .in('state', ['submitted', 'pending_review', 'pending_challenge_window'])
      .limit(1)
      .maybeSingle();

    if (otherInFlight) {
      if (!householdClaimConfig.flags.parallelSubmission) {
        errors.push('Another ownership verification is already in progress for this home');
        return {
          allowed: false,
          errors,
          blockCode: 'EXISTING_IN_FLIGHT_CLAIM',
          routingClassification,
          flags: householdClaimConfig.flags,
        };
      }
    }
  }

  return {
    allowed: errors.length === 0,
    errors,
    blockCode: null,
    routingClassification,
    flags: householdClaimConfig.flags,
  };
}

// ============================================================
// Verification tier dominance
// ============================================================

function getTierRank(tier) {
  return TIER_RANK[tier] || 0;
}

function getRequiredVerificationTier(home, existingOwners) {
  if (!existingOwners || existingOwners.length === 0) return 'weak';

  const maxExistingTier = existingOwners.reduce((max, o) => {
    const rank = getTierRank(o.verification_tier);
    return rank > max.rank ? { tier: o.verification_tier, rank } : max;
  }, { tier: 'weak', rank: 1 });

  if (home.owner_claim_policy === 'review_required') {
    return maxExistingTier.rank >= TIER_RANK.strong ? 'strong' : 'standard';
  }

  return 'weak';
}

function canOverrideExistingOwners(claimTier, existingOwners) {
  if (!existingOwners || existingOwners.length === 0) return true;

  const maxExistingRank = existingOwners.reduce(
    (max, o) => Math.max(max, getTierRank(o.verification_tier)),
    0,
  );

  const claimRank = getTierRank(claimTier);

  // weak can never displace strong/legal without dispute
  if (claimRank <= TIER_RANK.weak && maxExistingRank >= TIER_RANK.strong) {
    return false;
  }

  return claimRank >= maxExistingRank;
}

// ============================================================
// Quorum
// ============================================================

async function calculateQuorumRequirement(actionType, homeId) {
  const riskTier = ACTION_RISK_TIERS[actionType];
  if (riskTier === undefined || riskTier === 0) {
    return { needed: false, riskTier: 0 };
  }

  const { data: owners } = await supabaseAdmin
    .from('HomeOwner')
    .select('id, subject_id, is_primary_owner')
    .eq('home_id', homeId)
    .eq('owner_status', 'verified');

  const ownerCount = owners?.length || 0;
  if (ownerCount <= 1) {
    return { needed: false, riskTier, reason: 'single_owner' };
  }

  const config = RISK_TIER_CONFIG[riskTier];
  let requiredRule = 'majority';
  let requiredApprovals = Math.ceil(ownerCount / 2);

  if (riskTier === 3) {
    requiredRule = ownerCount === 2 ? '2_of_n' : 'primary_plus_one';
    requiredApprovals = 2;
  }

  const now = new Date();
  const passiveApprovalAt = config.quorum === 'constructive'
    ? new Date(now.getTime() + CONSTRUCTIVE_CONSENT_DAYS * 24 * 60 * 60 * 1000)
    : null;

  return {
    needed: true,
    riskTier,
    consentType: config.quorum,
    requiredRule,
    requiredApprovals,
    minRejectsToBlock: 1,
    passiveApprovalAt,
    ownerCount,
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
  };
}

// ============================================================
// Claim window
// ============================================================

function isClaimWindowActive(home) {
  if (home.security_state !== 'claim_window') return false;
  if (!home.claim_window_ends_at) return false;
  return new Date(home.claim_window_ends_at) > new Date();
}

function getClaimWindowEndsAt() {
  return new Date(Date.now() + CLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

// ============================================================
// Policy change guards
// ============================================================

function canChangeOwnerClaimPolicy(home, newPolicy) {
  if (isClaimWindowActive(home) && newPolicy === 'review_required') {
    return { allowed: false, reason: 'Cannot restrict owner claims during the claim window' };
  }
  return { allowed: true };
}

// ============================================================
// Rental firewall
// ============================================================

function evaluateRentalFirewall(home, claimMethod) {
  if (home.tenure_mode !== 'rental' && home.tenure_mode !== 'managed_property') {
    return { blocked: false };
  }

  if (claimMethod === null) return { blocked: false };

  const softDocMethods = ['doc_upload', 'vouch'];
  if (softDocMethods.includes(claimMethod)) {
    return {
      blocked: true,
      reason: 'Owner verification for rental/managed properties requires landlord approval or title verification',
      allowedMethods: ['escrow_agent', 'landlord_portal', 'property_data_match'],
    };
  }

  return { blocked: false };
}

// ============================================================
// Dispute detection
// ============================================================

function shouldTriggerDispute(home, claim, existingOwners) {
  if (!existingOwners || existingOwners.length === 0) return false;

  const verifiedOwners = existingOwners.filter(o => o.owner_status === 'verified');
  if (verifiedOwners.length === 0) return false;

  const claimTierRank = getTierRank(claim.verification_tier || 'weak');
  const maxOwnerRank = verifiedOwners.reduce(
    (max, o) => Math.max(max, getTierRank(o.verification_tier)),
    0,
  );

  // If claim tier matches or exceeds existing owners but doesn't clearly dominate
  if (claimTierRank >= TIER_RANK.standard && maxOwnerRank >= TIER_RANK.standard) {
    return true;
  }

  return false;
}

// ============================================================
// Risk scoring
// ============================================================

async function getClaimRiskScore(claim, claimantUserId) {
  let score = 0;

  const { data: user } = await supabaseAdmin
    .from('User')
    .select('created_at')
    .eq('id', claimantUserId)
    .single();

  if (user) {
    const accountAgeDays = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (accountAgeDays < 1) score += 40;
    else if (accountAgeDays < 7) score += 25;
    else if (accountAgeDays < 30) score += 10;
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const { count: recentClaims } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id', { count: 'exact', head: true })
    .eq('claimant_user_id', claimantUserId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (recentClaims > 3) score += 30;
  else if (recentClaims > 1) score += 15;

  const { count: rejections } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id', { count: 'exact', head: true })
    .eq('claimant_user_id', claimantUserId)
    .eq('state', 'rejected');

  if (rejections > 2) score += 25;
  else if (rejections > 0) score += 10;

  if (claim.method === 'doc_upload') score += 5;
  if (claim.method === 'escrow_agent' || claim.method === 'property_data_match') score -= 10;

  return Math.max(0, Math.min(100, score));
}

// ============================================================
// Security state transitions
// ============================================================

function getAllowedStateTransitions(currentState) {
  const transitions = {
    normal:          ['claim_window', 'review_required', 'disputed', 'frozen'],
    claim_window:    ['normal', 'disputed', 'frozen'],
    review_required: ['normal', 'disputed', 'frozen'],
    disputed:        ['normal', 'review_required', 'frozen', 'frozen_silent'],
    frozen:          ['normal', 'review_required', 'disputed'],
    frozen_silent:   ['normal', 'frozen', 'disputed'],
  };
  return transitions[currentState] || [];
}

function canTransitionState(currentState, targetState) {
  return getAllowedStateTransitions(currentState).includes(targetState);
}

// ============================================================
// Action guards for frozen/disputed homes
// ============================================================

const FROZEN_BLOCKED_ACTIONS = [
  'TRANSFER_OWNERSHIP', 'REMOVE_OWNER', 'CHANGE_PRIMARY_OWNER',
  'MAIL_ROUTING_CHANGE', 'FREEZE_HOME',
];

const DISPUTED_BLOCKED_ACTIONS = [
  'TRANSFER_OWNERSHIP', 'REMOVE_OWNER', 'CHANGE_PRIMARY_OWNER',
  'MAIL_ROUTING_CHANGE',
];

function isActionBlockedByState(securityState, actionType) {
  if (securityState === 'frozen' || securityState === 'frozen_silent') {
    return FROZEN_BLOCKED_ACTIONS.includes(actionType);
  }
  if (securityState === 'disputed') {
    return DISPUTED_BLOCKED_ACTIONS.includes(actionType);
  }
  return false;
}

// ============================================================
// Verification tier recalculation
// ============================================================

async function recalculateTier(claimId) {
  const { data: evidence } = await supabaseAdmin
    .from('HomeVerificationEvidence')
    .select('evidence_tier')
    .eq('claim_id', claimId);

  if (!evidence || evidence.length === 0) return 'weak';

  const highest = evidence.reduce((max, e) => {
    return (TIER_RANK[e.evidence_tier] || 0) > (TIER_RANK[max] || 0) ? e.evidence_tier : max;
  }, 'weak');

  await supabaseAdmin
    .from('HomeOwnershipClaim')
    .update({ verification_tier: highest, updated_at: new Date().toISOString() })
    .eq('id', claimId);

  return highest;
}

module.exports = {
  canSubmitOwnerClaim,
  getRequiredVerificationTier,
  canOverrideExistingOwners,
  getTierRank,
  calculateQuorumRequirement,
  isClaimWindowActive,
  getClaimWindowEndsAt,
  canChangeOwnerClaimPolicy,
  evaluateRentalFirewall,
  shouldTriggerDispute,
  getClaimRiskScore,
  getAllowedStateTransitions,
  canTransitionState,
  isActionBlockedByState,
  recalculateTier,
  CLAIM_WINDOW_DAYS,
  CONSTRUCTIVE_CONSENT_DAYS,
  ACTION_RISK_TIERS,
  TIER_RANK,
};
