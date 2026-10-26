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
const { userFacing } = require('./userFacingError');
const householdClaimConfig = require('../config/householdClaims');
const homeClaimRoutingService = require('../services/homeClaimRoutingService');
const addressReviewService = require('../services/addressValidation/addressReviewService');

/**
 * A read a decision depends on failed: refuse (503) instead of deciding on
 * missing data. A failed count is not zero owners and a failed lookup is not
 * "no earlier claim".
 */
function policyUnavailable(code, message) {
  return userFacing(Object.assign(new Error(message), { code, status: 503, statusCode: 503 }));
}

const claimCheckUnavailable = () => policyUnavailable('HOME_CLAIM_CHECK_UNAVAILABLE',
  'Couldn\'t check this claim. Nothing was submitted. Please try again.');

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

const MAX_RESIDENCY_CLAIMS_PER_30D = 5;

/**
 * Eligibility for a RESIDENCY claim (claim_type 'resident') — the instant
 * verification door (Wedge Phase 2, D3): a resident uploads a utility bill,
 * lease or ID, and a person reviews it.
 *
 * Deliberately NOT the owner policy: no rental firewall (a renter at a
 * rented address is exactly who this is for), no challenge routing (a
 * residency claim never contests ownership), no per-home owner-claim quota.
 * What remains: the home must be active and unrestricted, a per-user
 * 30-day cap, the rejection cooldown, and one active residency claim per
 * user per home (an existing one is returned so evidence can attach to it).
 * A person reviews every document, so the per-home residency cap
 * (save_home_residency_admission) never stops one: a document is a proof,
 * and the address watch flags the home past the cap (HOME_LIMIT).
 */
async function canSubmitResidencyClaim(homeId, userId) {
  const errors = [];

  const { data: home, error: homeError } = await supabaseAdmin
    .from('Home')
    .select('id, security_state, home_status')
    .eq('id', homeId)
    .maybeSingle();
  if (homeError) throw claimCheckUnavailable();
  if (!home) return { allowed: false, errors: ['Home not found'], blockCode: null, existingClaimId: null };

  if (home.home_status !== 'active') errors.push('Home is not active');
  if (home.security_state === 'frozen' || home.security_state === 'frozen_silent') {
    errors.push('Home is currently restricted');
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const { count: userClaimCount, error: userCountError } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id', { count: 'exact', head: true })
    .eq('claimant_user_id', userId)
    .eq('claim_type', 'resident')
    .gte('created_at', thirtyDaysAgo.toISOString());
  if (userCountError) throw claimCheckUnavailable();
  if ((userClaimCount || 0) >= MAX_RESIDENCY_CLAIMS_PER_30D) {
    errors.push('You have reached the maximum number of residency claims for this period');
  }

  const cooldownDate = new Date(now.getTime() - REJECTION_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  const { data: recentRejection, error: rejectionError } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id')
    .eq('home_id', homeId)
    .eq('claimant_user_id', userId)
    .eq('claim_type', 'resident')
    .eq('state', 'rejected')
    .gte('updated_at', cooldownDate.toISOString())
    .limit(1)
    .maybeSingle();
  if (rejectionError) throw claimCheckUnavailable();
  if (recentRejection) errors.push('Please wait before submitting another claim for this home');

  const { data: existingActive, error: activeError } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id')
    .eq('home_id', homeId)
    .eq('claimant_user_id', userId)
    .eq('claim_type', 'resident')
    .in('state', ['draft', 'submitted', 'pending_review', 'needs_more_info'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activeError) throw claimCheckUnavailable();

  return {
    allowed: errors.length === 0 && !existingActive,
    errors: existingActive ? [...errors, 'You already have an active residency claim for this home'] : errors,
    blockCode: existingActive ? 'EXISTING_RESIDENCY_CLAIM' : null,
    existingClaimId: existingActive ? existingActive.id : null,
    // Stored in HomeOwnershipClaim.routing_classification, whose enum has no
    // residency value; a residency claim never contests ownership.
    routingClassification: 'standalone_claim',
    flags: householdClaimConfig.flags,
  };
}

async function canSubmitOwnerClaim(homeId, userId) {
  const errors = [];
  let routingClassification = 'standalone_claim';

  const { data: home, error: homeError } = await supabaseAdmin
    .from('Home')
    .select('id, security_state, tenure_mode, owner_claim_policy, home_status')
    .eq('id', homeId)
    .maybeSingle();

  if (homeError) throw claimCheckUnavailable();
  if (!home) return { allowed: false, errors: ['Home not found'], blockCode: null };

  // A claim on a home with verified owners is a challenge, which ordinary review refuses: an unread
  // classification must not file it as standalone.
  try {
    const classification = await homeClaimRoutingService.classifySubmission({ homeId, userId });
    routingClassification = classification.routingClassification;
  } catch (error) {
    logger.warn('household_claim.classification_failed', {
      home_id: homeId,
      claimant_user_id: userId,
      error: error.message,
    });
    throw claimCheckUnavailable();
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

  const { count: userClaimCount, error: userCountError } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id', { count: 'exact', head: true })
    .eq('claimant_user_id', userId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (userCountError) throw claimCheckUnavailable();
  if (userClaimCount >= MAX_OWNER_CLAIMS_PER_30D) {
    errors.push('You have reached the maximum number of ownership claims for this period');
  }

  const { count: homeClaimCount, error: homeCountError } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id', { count: 'exact', head: true })
    .eq('home_id', homeId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (homeCountError) throw claimCheckUnavailable();
  if (homeClaimCount >= MAX_CLAIMS_PER_HOME_PER_30D) {
    errors.push('This home has reached the maximum number of claims for this period');
  }

  const cooldownDate = new Date(now.getTime() - REJECTION_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  const { data: recentRejection, error: rejectionError } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id')
    .eq('home_id', homeId)
    .eq('claimant_user_id', userId)
    .eq('state', 'rejected')
    .gte('updated_at', cooldownDate.toISOString())
    .limit(1)
    .maybeSingle();

  if (rejectionError) throw claimCheckUnavailable();
  if (recentRejection) {
    errors.push('Please wait before submitting another claim for this home');
  }

  const { data: existingActive, error: activeError } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id')
    .eq('home_id', homeId)
    .eq('claimant_user_id', userId)
    .in('state', ['draft', 'submitted', 'pending_review', 'pending_challenge_window', 'needs_more_info'])
    .limit(1)
    .maybeSingle();

  if (activeError) throw claimCheckUnavailable();
  if (existingActive) {
    errors.push('You already have an active claim for this home');
  }

  // idx_home_claim_active_unique: only one row per home in submitted / pending_review /
  // pending_challenge_window. Block before insert so clients get a clear code (not 23505).
  if (!existingActive) {
    const { data: otherInFlight, error: inFlightError } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .select('id')
      .eq('home_id', homeId)
      .neq('claimant_user_id', userId)
      .in('state', ['submitted', 'pending_review', 'pending_challenge_window'])
      .limit(1)
      .maybeSingle();

    if (inFlightError) throw claimCheckUnavailable();
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

  // A failed read is not "no other owners": without the count, refuse rather than let one owner act alone.
  const { data: owners, error } = await supabaseAdmin
    .from('HomeOwner')
    .select('id, subject_id, is_primary_owner')
    .eq('home_id', homeId)
    .eq('owner_status', 'verified');

  if (error || !Array.isArray(owners)) {
    throw policyUnavailable('HOME_OWNERS_UNAVAILABLE',
      'Couldn\'t check this home\'s owners. Nothing was changed. Please try again.');
  }

  const ownerCount = owners.length;
  if (ownerCount <= 1) {
    return { needed: false, riskTier, reason: 'single_owner' };
  }

  const config = RISK_TIER_CONFIG[riskTier];
  let requiredRule = 'majority';
  // More than half of the owners. The proposer's own approval counts, so with
  // two owners the other one approves, or (constructive consent) lets the
  // waiting period pass without rejecting.
  let requiredApprovals = Math.floor(ownerCount / 2) + 1;

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

// A failed read refuses: a missing count would lower the score and let a risky
// claim skip review.
async function getClaimRiskScore(claim, claimantUserId) {
  let score = 0;

  const { data: user, error: userError } = await supabaseAdmin
    .from('User')
    .select('created_at')
    .eq('id', claimantUserId)
    .maybeSingle();

  if (userError) throw claimCheckUnavailable();
  if (user) {
    const accountAgeDays = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (accountAgeDays < 1) score += 40;
    else if (accountAgeDays < 7) score += 25;
    else if (accountAgeDays < 30) score += 10;
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const { count: recentClaims, error: recentError } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id', { count: 'exact', head: true })
    .eq('claimant_user_id', claimantUserId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (recentError) throw claimCheckUnavailable();
  if (recentClaims > 3) score += 30;
  else if (recentClaims > 1) score += 15;

  const { count: rejections, error: rejectionsError } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id', { count: 'exact', head: true })
    .eq('claimant_user_id', claimantUserId)
    .eq('state', 'rejected');

  if (rejectionsError) throw claimCheckUnavailable();
  if (rejections > 2) score += 25;
  else if (rejections > 0) score += 10;

  if (claim.method === 'doc_upload') score += 5;
  if (claim.method === 'escrow_agent' || claim.method === 'property_data_match') score -= 10;

  return Math.max(0, Math.min(100, score));
}

// ============================================================
// Address watch
// ============================================================

// Signals about the address and the person, read from existing tables whenever someone asks to live at a home.
// Phone location is never read. The level is high with any high signal or three medium ones, medium with one or
// two, and low with none.
const ADDRESS_WATCH_DAYS = 30;
const ADDRESS_WATCH_TURNED_AWAY_DAYS = 90;
const ADDRESS_WATCH_NEW_ACCOUNT_DAYS = 7;
const ADDRESS_WATCH_MANY_CLAIMANTS_HIGH = 5;
const ADDRESS_WATCH_SIGNALS = Object.freeze({
  ACCOUNT_MANY_HOMES: 'high',       // this account said it lives at more than 2 homes in 30 days
  CMRA_MAILBOX: 'high',             // USPS lists the address as a mail drop (commercial mail receiving agency)
  PO_BOX: 'high',
  HOME_LIMIT: 'high',               // 10 or more other people asked to live here in 30 days: people new to the home
                                    // prove the address instead of asking the household (save_home_residency_admission)
  MANY_CLAIMANTS: 'medium',         // 3 or more people added, claimed or asked to live at this home in 30 days;
                                    // high at 5 or more
  HOUSEHOLD_CHURN: 'medium',        // 3 or more people joined this home and left it again in 30 days
  TURNED_AWAY_ELSEWHERE: 'medium',  // another household turned down this account's request in 90 days
  USPS_VACANT: 'medium',
  BUSINESS_ADDRESS: 'medium',       // validation marked the address, building or parcel as a business
  NEW_ACCOUNT: 'medium',            // the account is under 7 days old
});
// Signals about the person rather than the address. A high level makes a case about the person when one of these is
// a reason; otherwise the case is about the home, since the person may be the real resident.
const ADDRESS_WATCH_PERSON_SIGNALS = new Set(['ACCOUNT_MANY_HOMES', 'TURNED_AWAY_ELSEWHERE', 'NEW_ACCOUNT']);
// The address decision engine's PO box pattern (addressDecisionEngine.js), for homes saved without validation.
const PO_BOX_LINE = /^\s*(?:p\.?\s*o\.?\s*b(?:ox)?|post\s+office\s+box)\b/i;

function addressWatchLevel(levels) {
  if (levels.includes('high') || levels.length >= 3) return 'high';
  return levels.length ? 'medium' : 'low';
}

/**
 * The address watch for one person asking to live at one home: { level, signals }. It runs after the request is
 * saved, so the request is in the counts. A failed read throws: an unread signal is not a low risk.
 */
async function assessAddressWatch({ homeId, userId }) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const since = new Date(now - ADDRESS_WATCH_DAYS * day).toISOString();
  const read = async (query) => {
    const { data, error } = await query;
    if (error) throw claimCheckUnavailable();
    return data;
  };
  const rows = async (query) => (await read(query)) || [];

  const [home, user, homeRequests, homeClaims, ownRequests, ownDocuments, ownSetups, turnedAway, leavers] = await Promise.all([
    read(supabaseAdmin.from('Home').select('address, address_id, created_by_user_id, created_at').eq('id', homeId).maybeSingle()),
    read(supabaseAdmin.from('User').select('created_at').eq('id', userId).maybeSingle()),
    // Everyone who asked to live at or claimed this home in the window.
    rows(supabaseAdmin.from('HomeResidencyClaim').select('user_id').eq('home_id', homeId).gte('created_at', since)),
    rows(supabaseAdmin.from('HomeOwnershipClaim').select('claimant_user_id, method, claim_type').eq('home_id', homeId)
      .gte('created_at', since)),
    // Every home this account said it lives at: requests, residency documents, and homes it added as a renter or
    // household member. Owners adding homes they rent out aren't saying they live there.
    rows(supabaseAdmin.from('HomeResidencyClaim').select('home_id').eq('user_id', userId).gte('created_at', since)),
    rows(supabaseAdmin.from('HomeOwnershipClaim').select('home_id').eq('claimant_user_id', userId)
      .eq('claim_type', 'resident').gte('created_at', since)),
    rows(supabaseAdmin.from('HomeCreateCommand').select('home_id').eq('actor_user_id', userId).eq('state', 'completed')
      .in('creator_role', ['renter', 'household']).gte('created_at', since)),
    rows(supabaseAdmin.from('HomeResidencyClaim').select('id').eq('user_id', userId).neq('home_id', homeId)
      .eq('status', 'rejected').gte('reviewed_at', new Date(now - ADDRESS_WATCH_TURNED_AWAY_DAYS * day).toISOString()).limit(1)),
    // Removal and leaving both end a membership (is_active false, end_at set).
    rows(supabaseAdmin.from('HomeOccupancy').select('user_id').eq('home_id', homeId).eq('is_active', false)
      .gte('start_at', since).gte('end_at', since)),
  ]);
  const address = home?.address_id
    ? await read(supabaseAdmin.from('HomeAddress')
      .select('commercial_mailbox_flag, rdi_type, building_type, parcel_type, vacant_flag:validation_raw_response->vacant_flag')
      .eq('id', home.address_id).maybeSingle())
    : null;

  const signals = [];
  const homesLivedAt = new Set([homeId, ...[...ownRequests, ...ownDocuments, ...ownSetups].map(row => row.home_id)]);
  if (homesLivedAt.size > 2) signals.push('ACCOUNT_MANY_HOMES');
  if (address?.commercial_mailbox_flag === true) signals.push('CMRA_MAILBOX');
  if (PO_BOX_LINE.test(home?.address || '')) signals.push('PO_BOX');
  // An owner inviting a co-owner (or a buyer) isn't someone claiming the home.
  const claimants = new Set([userId, ...homeRequests.map(row => row.user_id),
    ...homeClaims.filter(row => row.method !== 'invite').map(row => row.claimant_user_id)]);
  if (home?.created_by_user_id && Date.parse(home.created_at) >= Date.parse(since)) claimants.add(home.created_by_user_id);
  if (claimants.size >= 3) signals.push('MANY_CLAIMANTS');
  // The per-home residency cap: the people the admission counts (requests and residency documents), not this one.
  const askers = new Set([...homeRequests.map(row => row.user_id),
    ...homeClaims.filter(row => row.claim_type === 'resident').map(row => row.claimant_user_id)]);
  askers.delete(userId);
  if (askers.size >= MAX_CLAIMS_PER_HOME_PER_30D) signals.push('HOME_LIMIT');
  if (new Set(leavers.map(row => row.user_id)).size >= 3) signals.push('HOUSEHOLD_CHURN');
  if (turnedAway.length) signals.push('TURNED_AWAY_ELSEWHERE');
  if (address?.vacant_flag === true) signals.push('USPS_VACANT');
  // A mail drop is a business too; it already counts as one.
  if (address && address.commercial_mailbox_flag !== true && (address.rdi_type === 'business'
    || address.building_type === 'commercial' || address.parcel_type === 'commercial')) signals.push('BUSINESS_ADDRESS');
  if (user?.created_at && now - Date.parse(user.created_at) < ADDRESS_WATCH_NEW_ACCOUNT_DAYS * day) signals.push('NEW_ACCOUNT');

  const levels = signals.map(signal => (signal === 'MANY_CLAIMANTS' && claimants.size >= ADDRESS_WATCH_MANY_CLAIMANTS_HIGH
    ? 'high' : ADDRESS_WATCH_SIGNALS[signal]));
  return { level: addressWatchLevel(levels), signals };
}

/**
 * The address watch after someone asked to live at a home: a join request (residency-submissions or the legacy
 * claim) or a residency document. It runs after the request is saved and can't change it; a failed read means no
 * flag. A high level opens a case in the admin address review queue (GET /api/admin/address-review/queue), the way
 * trustAnomalyDetection flags providers, and a new case emails the admins: about this person when a signal about
 * them is a reason, otherwise about the home. Past the per-home cap (HOME_LIMIT) the home always gets its case. A
 * later request refreshes an open case. Returns { level, signals }, or null when the watch couldn't read.
 */
async function watchResidencyRequest({ homeId, userId, source }) {
  try {
    const assessment = await assessAddressWatch({ homeId, userId });
    if (assessment.level !== 'low') {
      // Not "level": the logger reads that key as the log level.
      logger.info('home_claim.address_watch', { home_id: homeId, user_id: userId, source, risk: assessment.level,
        signals: assessment.signals });
    }
    if (assessment.level === 'high') {
      const personal = assessment.signals.some(signal => ADDRESS_WATCH_PERSON_SIGNALS.has(signal));
      if (personal) await addressReviewService.flagAddressWatch({ homeId, userId, signals: assessment.signals, source });
      if (!personal || assessment.signals.includes('HOME_LIMIT')) {
        // The home's case leaves the person out: they may be the one who lives there.
        await addressReviewService.flagAddressWatch({ homeId, userId: null, source,
          signals: assessment.signals.filter(signal => !ADDRESS_WATCH_PERSON_SIGNALS.has(signal)) });
      }
    }
    return assessment;
  } catch (error) {
    logger.warn('home_claim.address_watch_unavailable', { home_id: homeId, user_id: userId, source, error: error.message });
    return null;
  }
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
  canSubmitResidencyClaim,
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
  assessAddressWatch,
  watchResidencyRequest,
  getAllowedStateTransitions,
  canTransitionState,
  isActionBlockedByState,
  recalculateTier,
  CLAIM_WINDOW_DAYS,
  CONSTRUCTIVE_CONSENT_DAYS,
  MAX_CLAIMS_PER_HOME_PER_30D,
  ADDRESS_WATCH_SIGNALS,
  ACTION_RISK_TIERS,
  TIER_RANK,
};
