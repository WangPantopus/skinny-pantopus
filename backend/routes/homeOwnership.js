/**
 * Home Ownership Routes
 *
 * Handles ownership claims, owner management, security settings,
 * quorum actions/votes, and dispute center.
 *
 * Mounted at /api/homes alongside existing home routes.
 */

const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const { checkHomePermission, writeAuditLog, applyOccupancyTemplate, mapLegacyRole } = require('../utils/homePermissions');
const policy = require('../utils/homeSecurityPolicy');
const propertyDataService = require('../services/propertyDataService');
const homeClaimRoutingService = require('../services/homeClaimRoutingService');
const homeClaimComparisonService = require('../services/homeClaimComparisonService');
const homeClaimCompatService = require('../services/homeClaimCompatService');
const homeClaimMergeService = require('../services/homeClaimMergeService');
const householdClaimConfig = require('../config/householdClaims');
const { ownershipClaimLimiter, postcardLimiter, verificationAttemptLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');
const { findHomeOwnerRowForClaimant } = require('../utils/homeOwnerRowLookup');
const { getClaimMergeRoleForClaim } = require('../utils/homeClaimMergeRoles');

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

const submitClaimSchema = Joi.object({
  claim_type: Joi.string().valid('owner', 'admin', 'resident').default('owner'),
  method: Joi.string().valid('invite', 'vouch', 'doc_upload', 'escrow_agent', 'landlord_portal', 'property_data_match').required(),
});

const reviewClaimSchema = Joi.object({
  action: Joi.string().valid('approve', 'reject', 'flag').required(),
  note: Joi.string().max(1000).allow('', null),
});

const uploadEvidenceSchema = Joi.object({
  evidence_type: Joi.string().valid(
    'deed', 'closing_disclosure', 'tax_bill', 'utility_bill',
    'lease', 'idv', 'escrow_attestation', 'title_match',
  ).required(),
  provider: Joi.string().valid('manual', 'stripe_identity', 'attom', 'corelogic', 'other').default('manual'),
  storage_ref: Joi.string().max(500).allow(null),
  metadata: Joi.object().default({}),
});

const resolveRelationshipSchema = Joi.object({
  action: Joi.string().valid('invite_to_household', 'decline_relationship', 'flag_unknown_person').required(),
  note: Joi.string().max(1000).allow('', null),
});

const acceptMergeSchema = Joi.object({
  invitation_id: Joi.string().uuid().allow(null),
});

const challengeClaimSchema = Joi.object({
  note: Joi.string().max(1000).allow('', null),
});

const inviteOwnerSchema = Joi.object({
  email: Joi.string().email().allow(null),
  phone: Joi.string().max(20).allow(null),
  user_id: Joi.string().uuid().allow(null),
  fast_track: Joi.boolean().default(false),
});

const transferOwnerSchema = Joi.object({
  buyer_email: Joi.string().email().allow(null),
  buyer_phone: Joi.string().max(20).allow(null),
  buyer_user_id: Joi.string().uuid().allow(null),
  effective_date: Joi.date().iso().allow(null),
});

const updateSecuritySchema = Joi.object({
  owner_claim_policy: Joi.string().valid('open', 'review_required'),
  member_attach_policy: Joi.string().valid('open_invite', 'admin_approval', 'verified_only'),
  privacy_mask_level: Joi.string().valid('normal', 'high', 'invite_only_discovery'),
  tenure_mode: Joi.string().valid('unknown', 'owner_occupied', 'rental', 'managed_property'),
});

const voteSchema = Joi.object({
  vote: Joi.string().valid('approve', 'reject').required(),
  reason: Joi.string().max(500).allow('', null),
});

async function recalculateHouseholdResolutionState(homeId) {
  return homeClaimCompatService.recalculateHouseholdResolutionState(homeId);
}

/** Product: ownership dispute escalation disabled — keep stub so call sites remain valid. */
async function markHomeSecurityDisputed(_homeId) {
  return;
}

async function getVerifiedHouseholdAuthority(homeId, userId) {
  const [ownerResult, occupancyResult, homeResult] = await Promise.all([
    supabaseAdmin
      .from('HomeOwner')
      .select('id, subject_id')
      .eq('home_id', homeId)
      .eq('subject_id', userId)
      .eq('owner_status', 'verified')
      .maybeSingle(),
    supabaseAdmin
      .from('HomeOccupancy')
      .select('id, role, role_base, verification_status, is_active')
      .eq('home_id', homeId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle(),
    supabaseAdmin
      .from('Home')
      .select('id, owner_id')
      .eq('id', homeId)
      .maybeSingle(),
  ]);

  if (ownerResult.error) throw ownerResult.error;
  if (occupancyResult.error) throw occupancyResult.error;
  if (homeResult.error) throw homeResult.error;

  if (ownerResult.data) {
    return { authorityType: 'owner', roleBase: 'owner' };
  }

  if (homeResult.data?.owner_id === userId) {
    return { authorityType: 'legacy_owner', roleBase: 'owner' };
  }

  const occupancy = occupancyResult.data;
  const roleBase = occupancy ? (occupancy.role_base || mapLegacyRole(occupancy.role || 'member')) : null;
  if (
    occupancy
    && occupancy.verification_status === 'verified'
    && ['owner', 'admin', 'manager'].includes(roleBase)
  ) {
    return { authorityType: 'occupancy', roleBase };
  }

  return null;
}

async function findPendingHomeInvite({
  homeId,
  inviteeUserId,
  invitationId = null,
  presetKey = null,
}) {
  let query = supabaseAdmin
    .from('HomeInvite')
    .select('*')
    .eq('home_id', homeId)
    .eq('invitee_user_id', inviteeUserId)
    .eq('status', 'pending');

  if (invitationId) {
    query = query.eq('id', invitationId);
  }

  if (presetKey) {
    query = query.eq('proposed_preset_key', presetKey);
  }

  const { data: invite, error } = await query.maybeSingle();
  if (error) throw error;

  if (!invite) {
    return null;
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    await supabaseAdmin
      .from('HomeInvite')
      .update({ status: 'expired' })
      .eq('id', invite.id);
    return null;
  }

  return invite;
}

function getRelationshipInviteRole(claim) {
  const role = getClaimMergeRoleForClaim(claim);
  return { proposedRole: role.proposedRole, proposedRoleBase: role.proposedRoleBase };
}

function canInviteClaimAsOwner(authority) {
  return authority?.authorityType === 'owner' || authority?.authorityType === 'legacy_owner';
}

async function createRelationshipInvite({ homeId, inviterUserId, inviteeUserId, claim }) {
  const claimId = claim.id;
  const presetKey = `claim_merge:${claimId}`;
  const { proposedRole, proposedRoleBase } = getRelationshipInviteRole(claim);
  const existingInvite = await findPendingHomeInvite({ homeId, inviteeUserId, presetKey });
  if (existingInvite) {
    if (
      existingInvite.proposed_role !== proposedRole ||
      existingInvite.proposed_role_base !== proposedRoleBase
    ) {
      const { data: updatedInvite, error: updateError } = await supabaseAdmin
        .from('HomeInvite')
        .update({
          proposed_role: proposedRole,
          proposed_role_base: proposedRoleBase,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingInvite.id)
        .select()
        .single();
      if (updateError) throw updateError;
      return { invitation: updatedInvite, token: null, reused: true };
    }
    return { invitation: existingInvite, token: null, reused: true };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const { data: invitation, error } = await supabaseAdmin
    .from('HomeInvite')
    .insert({
      home_id: homeId,
      invited_by: inviterUserId,
      invitee_user_id: inviteeUserId,
      proposed_role: proposedRole,
      proposed_role_base: proposedRoleBase,
      proposed_preset_key: presetKey,
      token,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  return { invitation, token, reused: false };
}

// ============================================================
// OWNERSHIP CLAIMS
// ============================================================

/**
 * GET /my-ownership-claims
 * Returns the current user's ownership claims (always generic status for opaque handshake).
 */
router.get('/my-ownership-claims', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: claims, error } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .select('id, home_id, claim_type, state, claim_phase_v2, method, created_at, updated_at')
      .eq('claimant_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Opaque handshake: mask internal states for the claimant
    const maskedClaims = (claims || []).map(c => ({
      id: c.id,
      home_id: c.home_id,
      claim_type: c.claim_type,
      method: c.method,
      status: maskClaimState(c.state, c.claim_phase_v2),
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));

    res.json({ claims: maskedClaims });
  } catch (err) {
    logger.error('Failed to fetch ownership claims', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

/**
 * POST /:id/ownership-claims
 * Submit an ownership claim (opaque handshake response).
 */
router.post('/:id/ownership-claims', verifyToken, ownershipClaimLimiter, validate(submitClaimSchema), async (req, res) => {
  try {
    const homeId = req.params.id;
    const userId = req.user.id;
    const { claim_type, method } = req.body;

    // Expire claim window if past deadline
    await checkAndExpireClaimWindow(homeId);

    const eligibility = await policy.canSubmitOwnerClaim(homeId, userId);
    homeClaimCompatService.logClaimSubmissionDecision({
      source: 'ownership_route',
      homeId,
      userId,
      claimType: claim_type,
      method,
      allowed: eligibility.allowed,
      blockCode: eligibility.blockCode,
      routingClassification: eligibility.routingClassification,
      reasonCount: eligibility.errors?.length || 0,
    });
    if (!eligibility.allowed) {
      if (eligibility.blockCode === 'EXISTING_IN_FLIGHT_CLAIM') {
        return res.status(409).json({
          error:
            'Ownership verification is already in progress for this home. If you belong here, request to join the household from Discover, or use the dispute flow if you believe this is incorrect.',
          code: 'EXISTING_IN_FLIGHT_CLAIM',
        });
      }

      // If user already has an active claim, return its id so frontend
      // can still upload evidence documents to the existing claim.
      let existingClaimId = null;
      const { data: existingClaim } = await supabaseAdmin
        .from('HomeOwnershipClaim')
        .select('id')
        .eq('home_id', homeId)
        .eq('claimant_user_id', userId)
        .in('state', ['draft', 'submitted', 'pending_review', 'pending_challenge_window', 'needs_more_info'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingClaim) {
        existingClaimId = existingClaim.id;
      }

      // Always return generic message (opaque handshake)
      return res.status(200).json({
        message: "We're verifying ownership for this address. You'll be notified when complete.",
        claim: { id: existingClaimId, status: 'under_review' },
      });
    }

    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('id, address, city, state, zipcode, security_state, tenure_mode, owner_claim_policy, claim_window_ends_at')
      .eq('id', homeId)
      .single();

    if (!home) return res.status(404).json({ error: 'Home not found' });

    const rentalCheck = policy.evaluateRentalFirewall(home, method);
    if (rentalCheck.blocked) {
      return res.status(200).json({
        message: "We're verifying ownership for this address. You'll be notified when complete.",
        claim: { status: 'under_review' },
      });
    }

    const riskScore = await policy.getClaimRiskScore({ method }, userId);

    let initialState = 'submitted';
    if (home.owner_claim_policy === 'review_required' && !policy.isClaimWindowActive(home)) {
      initialState = 'pending_review';
    }

    if (riskScore > 60) {
      initialState = 'pending_review';
    }

    const { data: claim, error } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .insert({
        home_id: homeId,
        claimant_user_id: userId,
        claim_type,
        state: initialState,
        method,
        risk_score: riskScore,
        ...(await homeClaimCompatService.buildInitialClaimCompatibilityFields({
          homeId,
          userId,
          claimType: claim_type,
          method,
          legacyState: initialState,
          routingClassification: eligibility.routingClassification,
        })),
      })
      .select()
      .single();

    if (error) {
      // 23505 = unique_violation from idx_home_claim_active_unique (concurrent claim race)
      if (error.code === '23505') {
        return res.status(409).json({
          error: 'An ownership claim is already active for this home. Please wait for it to be resolved.',
          code: 'DUPLICATE_CLAIM',
        });
      }
      throw error;
    }

    await writeAuditLog(homeId, userId, 'OWNERSHIP_CLAIM_SUBMITTED', 'HomeOwnershipClaim', claim.id, {
      method, claim_type, risk_score: riskScore, initial_state: initialState,
    });

    let responseClaimPhase = claim.claim_phase_v2;
    const responseRoutingClassification = claim.routing_classification;
    let householdResolutionState = await recalculateHouseholdResolutionState(homeId);

    // ── BUG 5A: Property data match — auto-verify against public records ──
    if (method === 'property_data_match' && propertyDataService.isAvailable()) {
      try {
        const { data: user } = await supabaseAdmin
          .from('User')
          .select('name, first_name, last_name')
          .eq('id', userId)
          .single();

        const userName = user?.name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim();

        const result = await propertyDataService.verifyPropertyOwnership({
          address: home.address || '',
          city: home.city || '',
          state: home.state || '',
          zip: home.zipcode || '',
          userName,
        });

        // Create evidence record from property data lookup
        await supabaseAdmin
          .from('HomeVerificationEvidence')
          .insert({
            claim_id: claim.id,
            evidence_type: 'title_match',
            provider: result.provider,
            status: result.matched && result.confidence >= 70 ? 'verified' : 'pending',
            metadata: {
              confidence: result.confidence,
              matched: result.matched,
              details: result.details,
              apn: result.apn || null,
            },
          });

        await homeClaimCompatService.updateClaimCompatibilityFields({
          claimId: claim.id,
          legacyState: initialState,
          syncClaimStrength: true,
        });
        if (householdClaimConfig.flags.challengeFlow) {
          const challengeActivated = await homeClaimRoutingService.syncClaimChallengeState(claim.id);
          if (challengeActivated) {
            responseClaimPhase = 'challenged';
            householdResolutionState = await recalculateHouseholdResolutionState(homeId);
          }
        }

        logger.info('Property data match completed', {
          homeId, claimId: claim.id, matched: result.matched,
          confidence: result.confidence, provider: result.provider,
        });
      } catch (pdErr) {
        logger.warn('Property data match failed (non-fatal)', { error: pdErr.message, homeId, claimId: claim.id });
      }
    }

    // Always return the same opaque response
    res.status(201).json({
      message: "We're verifying ownership for this address. You'll be notified when complete.",
      claim: {
        id: claim.id,
        status: 'under_review',
        claim_phase_v2: responseClaimPhase,
        routing_classification: responseRoutingClassification,
      },
      home_resolution: householdResolutionState,
      next_step: 'upload_evidence',
    });
  } catch (err) {
    logger.error('Failed to submit ownership claim', { error: err.message });
    res.status(500).json({ error: 'Failed to submit claim' });
  }
});

/**
 * GET /:id/ownership-claims
 * List claims for a home (owner-only, shows details).
 */
router.get('/:id/ownership-claims', verifyToken, async (req, res) => {
  try {
    const homeId = req.params.id;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'ownership.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: claims, error } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .select(`
        *,
        claimant:claimant_user_id (id, username, name, profile_picture_url, created_at),
        evidence:HomeVerificationEvidence (id, evidence_type, provider, status, created_at)
      `)
      .eq('home_id', homeId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Mask claimant details by default
    const maskedClaims = (claims || []).map(c => ({
      ...c,
      claimant: {
        masked: true,
        account_age_days: c.claimant?.created_at
          ? Math.floor((Date.now() - new Date(c.claimant.created_at).getTime()) / (1000 * 60 * 60 * 24))
          : null,
        method: c.method,
        risk_score: c.risk_score,
      },
    }));

    res.json({ claims: maskedClaims });
  } catch (err) {
    logger.error('Failed to fetch ownership claims', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

/**
 * GET /:id/ownership-claims/compare
 * Returns comparison payload for contested/disputed ownership review.
 */
router.get('/:id/ownership-claims/compare', verifyToken, async (req, res) => {
  try {
    if (!householdClaimConfig.flags.adminCompare) {
      return res.status(404).json({ error: 'Claim comparison not enabled' });
    }

    const homeId = req.params.id;
    const userId = req.user.id;

    const isAdmin = req.user.role === 'admin';
    if (!isAdmin) {
      const access = await checkHomePermission(homeId, userId, 'ownership.manage');
      if (!access.hasAccess) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    const comparison = await homeClaimComparisonService.buildHomeClaimComparison(homeId);
    if (!comparison) {
      return res.status(404).json({ error: 'Home not found' });
    }

    res.json(comparison);
  } catch (err) {
    logger.error('Failed to fetch ownership claim comparison', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch claim comparison' });
  }
});

/**
 * GET /:id/ownership-claims/:claimId
 * Get claim details (owner-only).
 */
router.get('/:id/ownership-claims/:claimId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, claimId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'ownership.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: claim, error } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .select(`
        *,
        evidence:HomeVerificationEvidence (*)
      `)
      .eq('id', claimId)
      .eq('home_id', homeId)
      .single();

    if (error || !claim) return res.status(404).json({ error: 'Claim not found' });

    res.json({ claim });
  } catch (err) {
    logger.error('Failed to fetch claim details', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch claim' });
  }
});

/**
 * DELETE /:id/ownership-claims/:claimId
 * Claimant removes their own claim (hard delete row + cascaded evidence).
 * Not allowed once the claim is approved or in a terminal merged/verified phase.
 */
router.delete('/:id/ownership-claims/:claimId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, claimId } = req.params;
    const userId = req.user.id;

    const { data: claim, error: fetchErr } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .select('id, home_id, claimant_user_id, state, claim_phase_v2')
      .eq('id', claimId)
      .eq('home_id', homeId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!claim) return res.status(404).json({ error: 'Claim not found' });

    if (claim.claimant_user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this claim' });
    }

    if (claim.state === 'approved') {
      return res.status(400).json({
        error: 'Approved claims cannot be deleted. Contact support if you need help.',
      });
    }
    if (claim.claim_phase_v2 === 'verified' || claim.claim_phase_v2 === 'merged_into_household') {
      return res.status(400).json({ error: 'This claim can no longer be deleted.' });
    }

    await writeAuditLog(homeId, userId, 'OWNERSHIP_CLAIM_DELETED', 'HomeOwnershipClaim', claimId, {
      prior_state: claim.state,
      prior_phase: claim.claim_phase_v2,
    });

    await supabaseAdmin
      .from('HomeOwner')
      .update({ owner_status: 'revoked', updated_at: new Date().toISOString() })
      .eq('home_id', homeId)
      .eq('subject_id', userId)
      .eq('owner_status', 'pending');

    const { error: delErr } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .delete()
      .eq('id', claimId)
      .eq('home_id', homeId)
      .eq('claimant_user_id', userId);

    if (delErr) throw delErr;

    await recalculateHouseholdResolutionState(homeId);

    res.json({ ok: true, deleted: true });
  } catch (err) {
    logger.error('Failed to delete ownership claim', { error: err.message });
    res.status(500).json({ error: 'Failed to delete claim' });
  }
});

/**
 * POST /:id/ownership-claims/:claimId/review
 * Approve, reject, or flag a claim (owner-only).
 */
router.post('/:id/ownership-claims/:claimId/review', verifyToken, validate(reviewClaimSchema), async (req, res) => {
  try {
    const { id: homeId, claimId } = req.params;
    const userId = req.user.id;
    const { action, note } = req.body;

    const access = await checkHomePermission(homeId, userId, 'ownership.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: claim } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .select('*')
      .eq('id', claimId)
      .eq('home_id', homeId)
      .single();

    if (!claim) return res.status(404).json({ error: 'Claim not found' });

    const isChallengeReview = (
      claim.state === 'disputed'
      || claim.claim_phase_v2 === 'challenged'
      || claim.challenge_state === 'challenged'
      || claim.routing_classification === 'challenge_claim'
    );

    const reviewableStates = ['submitted', 'pending_review', 'pending_challenge_window', 'needs_more_info', 'disputed'];
    if (!reviewableStates.includes(claim.state)) {
      return res.status(400).json({ error: 'Claim is not in a reviewable state' });
    }

    let newState;
    if (action === 'approve') {
      newState = 'approved';
    } else if (action === 'reject') {
      newState = 'rejected';
    } else if (action === 'flag') {
      newState = 'pending_review';
    }

    const { error: updateError } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .update({
        state: newState,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_note: note || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', claimId);

    if (updateError) throw updateError;

    let compatibilityLegacyState = newState;
    let compatibilityTerminalReason = action === 'reject' ? 'rejected_review' : 'none';
    let compatibilityChallengeState = 'none';
    let compatibilitySyncClaimStrength = false;

    // On rejection: revert ownership_state to 'unclaimed' if no other active claims
    if (action === 'reject') {
      const { data: otherClaims } = await supabaseAdmin
        .from('HomeOwnershipClaim')
        .select('id')
        .eq('home_id', homeId)
        .in('state', ['submitted', 'pending_review', 'pending_challenge_window', 'needs_more_info', 'disputed'])
        .neq('id', claimId)
        .limit(1);

      let verifiedOwnersCount = 0;
      if (isChallengeReview) {
        const { count } = await supabaseAdmin
          .from('HomeOwner')
          .select('id', { count: 'exact', head: true })
          .eq('home_id', homeId)
          .eq('owner_status', 'verified');
        verifiedOwnersCount = count || 0;
      }

      if ((!otherClaims || otherClaims.length === 0) && !(isChallengeReview && verifiedOwnersCount > 0)) {
        await supabaseAdmin
          .from('Home')
          .update({ ownership_state: 'unclaimed', updated_at: new Date().toISOString() })
          .eq('id', homeId);
      }
    }

    let skipHouseholdResolutionRecalc = false;

    // On approval: verify/create HomeOwner + HomeOccupancy + claim window + dispute detection
    if (action === 'approve') {
      // Determine verification tier from evidence
      const { data: evidenceRows } = await supabaseAdmin
        .from('HomeVerificationEvidence')
        .select('evidence_type, status')
        .eq('claim_id', claimId)
        .eq('status', 'verified');

      let tier = 'weak';
      const strongTypes = ['escrow_attestation', 'title_match'];
      // Only deed, closing_disclosure, tax_bill prove ownership (standard tier).
      // utility_bill and lease prove residency only — they do NOT count for owner verification.
      const ownerStandardTypes = ['deed', 'closing_disclosure', 'tax_bill'];
      for (const ev of (evidenceRows || [])) {
        if (strongTypes.includes(ev.evidence_type)) { tier = 'strong'; break; }
        if (ownerStandardTypes.includes(ev.evidence_type) && tier !== 'strong') tier = 'standard';
      }

      // If no verified evidence and claim has no evidence at all, require it
      if (!evidenceRows || evidenceRows.length === 0) {
        const { count: anyEvidence } = await supabaseAdmin
          .from('HomeVerificationEvidence')
          .select('id', { count: 'exact', head: true })
          .eq('claim_id', claimId);

        if (!anyEvidence || anyEvidence === 0) {
          return res.status(400).json({
            error: 'Cannot approve a claim with no verification evidence. The claimant must upload documents first.',
          });
        }
        // Has evidence but none verified yet — allow with weak tier
      }

      // Get existing verified owners for dispute detection
      const { data: existingOwners } = await supabaseAdmin
        .from('HomeOwner')
        .select('id, subject_id, owner_status, verification_tier, is_primary_owner')
        .eq('home_id', homeId)
        .neq('owner_status', 'revoked');

      const verifiedOwners = (existingOwners || []).filter(o => o.owner_status === 'verified');
      const isPrimary = verifiedOwners.length === 0;

      // Do not auto-escalate to dispute on approval. Multiple verified co-owners are valid;
      // formal dispute / security_state escalation is only for user-initiated dispute flows.
      const triggerDispute = false;

      // Check if this claimant already has a HomeOwner row (pending/verified, or revoked to reactivate)
      const existingOwnerRow = await findHomeOwnerRowForClaimant(
        supabaseAdmin,
        homeId,
        claim.claimant_user_id,
      );

      if (existingOwnerRow) {
        // Promote pending → verified (or update if already exists)
        await supabaseAdmin
          .from('HomeOwner')
          .update({
            owner_status: triggerDispute ? 'disputed' : 'verified',
            is_primary_owner: isPrimary,
            verification_tier: tier,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingOwnerRow.id);
      } else {
        // Create new HomeOwner record
        await supabaseAdmin
          .from('HomeOwner')
          .insert({
            home_id: homeId,
            subject_type: 'user',
            subject_id: claim.claimant_user_id,
            owner_status: triggerDispute ? 'disputed' : 'verified',
            is_primary_owner: isPrimary,
            added_via: 'claim',
            verification_tier: tier,
          });
      }

      // Also add/upgrade occupancy via centralized gateway
      const occupancyAttachService = require('../services/occupancyAttachService');
      await occupancyAttachService.attach({
        homeId,
        userId: claim.claimant_user_id,
        method: 'doc_upload',
        claimType: 'owner',
        roleOverride: 'owner',
        actorId: userId,
        metadata: { source: 'ownership_claim_approved', claim_id: claimId, tier },
      });

      // Set ownership_state and owner_id on Home
      await supabaseAdmin
        .from('Home')
        .update({ ownership_state: 'owner_verified', owner_id: claim.claimant_user_id, updated_at: new Date().toISOString() })
        .eq('id', homeId);

      // Handle security state transitions
      const { data: home } = await supabaseAdmin
        .from('Home')
        .select('security_state')
        .eq('id', homeId)
        .single();

      if (triggerDispute) {
        // Trigger dispute: put home in disputed state
        if (home && home.security_state !== 'frozen' && home.security_state !== 'frozen_silent') {
          await supabaseAdmin
            .from('Home')
            .update({
              security_state: 'disputed',
              ownership_state: 'disputed',
              household_resolution_state: 'disputed',
              household_resolution_updated_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', homeId);

          skipHouseholdResolutionRecalc = true;

          await writeAuditLog(homeId, userId, 'DISPUTE_TRIGGERED', 'HomeOwnershipClaim', claimId, {
            reason: 'Conflicting verified ownership claims',
            claimant_tier: tier,
          });
        }
      } else if (home && home.security_state === 'normal' && isPrimary) {
        // First verified owner: activate claim window
        await supabaseAdmin
          .from('Home')
          .update({
            security_state: 'claim_window',
            claim_window_ends_at: policy.getClaimWindowEndsAt().toISOString(),
          })
          .eq('id', homeId);
      }

      compatibilityLegacyState = triggerDispute ? 'disputed' : newState;
      compatibilityChallengeState = triggerDispute ? 'challenged' : 'none';
      compatibilitySyncClaimStrength = true;
    }

    await homeClaimCompatService.updateClaimCompatibilityFields({
      claimId,
      legacyState: compatibilityLegacyState,
      terminalReason: compatibilityTerminalReason,
      challengeState: compatibilityChallengeState,
      syncClaimStrength: compatibilitySyncClaimStrength,
    });

    if (!skipHouseholdResolutionRecalc) {
      await recalculateHouseholdResolutionState(homeId);
      await homeClaimRoutingService.reconcileOperationalDisputeState(homeId, { force: isChallengeReview });
    }

    await writeAuditLog(homeId, userId, `OWNERSHIP_CLAIM_${action.toUpperCase()}`, 'HomeOwnershipClaim', claimId, {
      note, new_state: newState,
    });

    res.json({ message: `Claim ${action}ed`, state: newState });
  } catch (err) {
    logger.error('Failed to review claim', { error: err.message });
    res.status(500).json({ error: 'Failed to review claim' });
  }
});

/**
 * POST /:id/ownership-claims/:claimId/evidence
 * Upload verification evidence for a claim.
 */
router.post('/:id/ownership-claims/:claimId/evidence', verifyToken, validate(uploadEvidenceSchema), async (req, res) => {
  try {
    const { id: homeId, claimId } = req.params;
    const userId = req.user.id;
    const { evidence_type, provider, storage_ref, metadata } = req.body;

    const { data: claim } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .select('claimant_user_id, state, claim_phase_v2')
      .eq('id', claimId)
      .eq('home_id', homeId)
      .single();

    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    if (claim.claimant_user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const uploadableLegacyStates = ['draft', 'submitted', 'needs_more_info', 'pending_review', 'rejected'];
    const uploadablePhaseV2States = ['initiated', 'evidence_submitted', 'under_review', 'challenged'];
    const canUploadEvidence =
      uploadableLegacyStates.includes(claim.state) ||
      uploadablePhaseV2States.includes(claim.claim_phase_v2);

    if (!canUploadEvidence) {
      return res.status(400).json({ error: 'Cannot upload evidence in the current claim state' });
    }

    const { data: evidence, error } = await supabaseAdmin
      .from('HomeVerificationEvidence')
      .insert({
        claim_id: claimId,
        evidence_type,
        provider,
        storage_ref: storage_ref || null,
        metadata,
      })
      .select()
      .single();

    if (error) throw error;

    // Move claim to a reviewable state when it was draft or rejected (re-submission)
    if (claim.state === 'draft') {
      await supabaseAdmin
        .from('HomeOwnershipClaim')
        .update({ state: 'submitted', updated_at: new Date().toISOString() })
        .eq('id', claimId);
    } else if (claim.state === 'rejected') {
      await supabaseAdmin
        .from('HomeOwnershipClaim')
        .update({ state: 'needs_more_info', updated_at: new Date().toISOString() })
        .eq('id', claimId);
    }

    const nextLegacyState =
      claim.state === 'draft'
        ? 'submitted'
        : claim.state === 'rejected'
          ? 'needs_more_info'
          : claim.state;
    const preservedChallengeState = claim.claim_phase_v2 === 'challenged' ? 'challenged' : 'none';
    const preservedClaimPhaseV2 = claim.claim_phase_v2 === 'challenged' ? 'challenged' : null;

    await homeClaimCompatService.updateClaimCompatibilityFields({
      claimId,
      legacyState: nextLegacyState,
      claimPhaseV2: preservedClaimPhaseV2,
      challengeState: preservedChallengeState,
      syncClaimStrength: true,
    });

    await homeClaimRoutingService.syncClaimChallengeState(claimId);
    await recalculateHouseholdResolutionState(homeId);

    // Recalculate verification tier based on all evidence
    const newTier = await policy.recalculateTier(claimId);

    res.status(201).json({ evidence, verification_tier: newTier });
  } catch (err) {
    logger.error('Failed to upload evidence', { error: err.message });
    res.status(500).json({ error: 'Failed to upload evidence' });
  }
});

/**
 * POST /:id/ownership-claims/:claimId/resolve-relationship
 * Verified household authority resolves another claimant by invite, decline, or dispute flag.
 */
router.post('/:id/ownership-claims/:claimId/resolve-relationship', verifyToken, validate(resolveRelationshipSchema), async (req, res) => {
  try {
    if (!householdClaimConfig.flags.inviteMerge) {
      return res.status(404).json({ error: 'Relationship resolution not enabled' });
    }

    const { id: homeId, claimId } = req.params;
    const userId = req.user.id;
    const { action, note } = req.body;

    const access = await checkHomePermission(homeId, userId, 'ownership.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const authority = await getVerifiedHouseholdAuthority(homeId, userId);
    if (!authority) {
      return res.status(403).json({ error: 'Only verified household authorities can resolve claimant relationships' });
    }

    const { data: claim, error: claimError } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .select('id, home_id, claimant_user_id, claim_type, state, claim_phase_v2, terminal_reason, challenge_state, routing_classification, identity_status, merged_into_claim_id')
      .eq('id', claimId)
      .eq('home_id', homeId)
      .maybeSingle();

    if (claimError) throw claimError;
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (claim.claimant_user_id === userId) {
      return res.status(400).json({ error: 'You cannot resolve your own claim relationship' });
    }

    if (!homeClaimRoutingService.isClaimActiveRecord(claim)) {
      return res.status(400).json({ error: 'Claim is not eligible for relationship resolution' });
    }

    if (action === 'invite_to_household') {
      const inviteRole = getRelationshipInviteRole(claim);
      if (inviteRole.proposedRoleBase === 'owner' && !canInviteClaimAsOwner(authority)) {
        return res.status(403).json({
          error: 'Only verified owners can invite co-owners',
          code: 'OWNER_INVITE_AUTHORITY_REQUIRED',
        });
      }

      const { invitation, token, reused } = await createRelationshipInvite({
        homeId,
        inviterUserId: userId,
        inviteeUserId: claim.claimant_user_id,
        claim,
      });

      const { error: updateError } = await supabaseAdmin
        .from('HomeOwnershipClaim')
        .update({
          routing_classification: 'merge_candidate',
          updated_at: new Date().toISOString(),
        })
        .eq('id', claimId);

      if (updateError) throw updateError;

      const notificationService = require('../services/notificationService');
      try {
        const [{ data: inviter }, { data: home }] = await Promise.all([
          supabaseAdmin.from('User').select('name, username, first_name').eq('id', userId).maybeSingle(),
          supabaseAdmin.from('Home').select('name, address').eq('id', homeId).maybeSingle(),
        ]);

        if (token) {
          await notificationService.notifyHomeInvite({
            inviteeUserId: claim.claimant_user_id,
            inviterName: inviter?.name || inviter?.first_name || inviter?.username || 'Someone',
            homeName: home?.name || home?.address || 'A home',
            homeId,
            inviteToken: token,
          });
        }
      } catch (notificationError) {
        logger.warn('Failed to notify claimant about merge invitation', {
          error: notificationError.message,
          homeId,
          claimId,
        });
      }

      await writeAuditLog(homeId, userId, 'OWNERSHIP_CLAIM_RELATIONSHIP_INVITED', 'HomeOwnershipClaim', claimId, {
        note: note || null,
        invitation_id: invitation.id,
        authority_type: authority.authorityType,
        reused_existing_invite: reused,
        proposed_role: invitation.proposed_role,
        proposed_role_base: invitation.proposed_role_base,
      });

      const invitedAsOwner = invitation.proposed_role_base === 'owner';
      return res.json({
        message: invitedAsOwner
          ? 'Co-owner invitation issued for the claimant'
          : 'Household invitation issued for the claimant',
        action,
        claim: {
          id: claim.id,
          routing_classification: 'merge_candidate',
        },
        invitation: {
          id: invitation.id,
          status: invitation.status,
          expires_at: invitation.expires_at,
          proposed_role: invitation.proposed_role,
          proposed_role_base: invitation.proposed_role_base,
        },
      });
    }

    if (action === 'decline_relationship') {
      await writeAuditLog(homeId, userId, 'OWNERSHIP_CLAIM_RELATIONSHIP_DECLINED', 'HomeOwnershipClaim', claimId, {
        note: note || null,
        authority_type: authority.authorityType,
      });

      return res.json({
        message: 'Claim will continue through independent verification',
        action,
        claim: {
          id: claim.id,
          routing_classification: claim.routing_classification || null,
          claim_phase_v2: claim.claim_phase_v2 || homeClaimRoutingService.mapLegacyStateToPhaseV2(claim.state),
        },
      });
    }

    const challengeStrength = await homeClaimRoutingService.deriveClaimStrength(claimId, { includeUnverified: true });
    const qualifiesForDispute = homeClaimRoutingService.isChallengeStrengthEligible(challengeStrength);
    const nextPhase = qualifiesForDispute ? 'challenged' : (claim.claim_phase_v2 || homeClaimRoutingService.mapLegacyStateToPhaseV2(claim.state));
    const nextChallengeState = qualifiesForDispute ? 'challenged' : claim.challenge_state || 'none';

    const { error: challengeUpdateError } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .update({
        routing_classification: 'challenge_claim',
        claim_phase_v2: nextPhase,
        challenge_state: nextChallengeState,
        claim_strength: challengeStrength,
        updated_at: new Date().toISOString(),
      })
      .eq('id', claimId);

    if (challengeUpdateError) throw challengeUpdateError;

    const homeResolutionState = await recalculateHouseholdResolutionState(homeId);

    await writeAuditLog(homeId, userId, 'OWNERSHIP_CLAIM_RELATIONSHIP_FLAGGED', 'HomeOwnershipClaim', claimId, {
      note: note || null,
      authority_type: authority.authorityType,
      challenge_strength: challengeStrength,
      qualifies_for_dispute: qualifiesForDispute,
    });

    res.json({
      message: qualifiesForDispute
        ? 'Claim flagged for dispute review'
        : 'Claim flagged for admin review',
      action,
      claim: {
        id: claim.id,
        routing_classification: 'challenge_claim',
        claim_phase_v2: nextPhase,
        challenge_state: nextChallengeState,
        claim_strength: challengeStrength,
      },
      home_resolution_state: homeResolutionState,
    });
  } catch (err) {
    logger.error('Failed to resolve claimant relationship', { error: err.message });
    res.status(500).json({ error: 'Failed to resolve claimant relationship' });
  }
});

/**
 * POST /:id/ownership-claims/:claimId/accept-merge
 * Claimant accepts an invite-based merge into the verified household.
 */
router.post('/:id/ownership-claims/:claimId/accept-merge', verifyToken, validate(acceptMergeSchema), async (req, res) => {
  try {
    if (!householdClaimConfig.flags.inviteMerge) {
      return res.status(404).json({ error: 'Claim merge not enabled' });
    }

    const { id: homeId, claimId } = req.params;
    const userId = req.user.id;
    const { invitation_id: invitationId } = req.body;

    const { data: claim, error: claimError } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .select('id, home_id, claimant_user_id, state, claim_phase_v2, terminal_reason, challenge_state, routing_classification, identity_status, merged_into_claim_id')
      .eq('id', claimId)
      .eq('home_id', homeId)
      .maybeSingle();

    if (claimError) throw claimError;
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (claim.claimant_user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!homeClaimRoutingService.isClaimActiveRecord(claim)) {
      return res.status(400).json({ error: 'Claim is not eligible for merge acceptance' });
    }

    const invite = await findPendingHomeInvite({
      homeId,
      inviteeUserId: userId,
      invitationId: invitationId || null,
      presetKey: `claim_merge:${claimId}`,
    });

    if (!invite) {
      return res.status(404).json({ error: 'No eligible household invitation was found for this claim' });
    }

    const mergeResult = await homeClaimMergeService.acceptClaimMerge({
      homeId,
      claimId,
      userId,
      invite,
    });

    res.json({
      message: mergeResult.acceptedAsOwner
        ? 'Ownership invitation accepted'
        : 'Claim merged into the verified household',
      claim: {
        id: claimId,
        state: 'approved',
        claim_phase_v2: mergeResult.claimPhaseV2,
        terminal_reason: mergeResult.terminalReason,
        merged_into_claim_id: mergeResult.mergedIntoClaimId,
      },
      home_resolution_state: mergeResult.homeResolutionState,
      occupancy: mergeResult.occupancy,
      accepted_role_base: mergeResult.acceptedRoleBase,
      accepted_as_owner: mergeResult.acceptedAsOwner,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        error: err.message,
        ...(err.code ? { code: err.code } : {}),
      });
    }

    logger.error('Failed to accept household merge', { error: err.message });
    res.status(500).json({ error: 'Failed to accept household merge' });
  }
});

/**
 * POST /:id/ownership-claims/:claimId/challenge
 * Claimant explicitly challenges a verified household with strong ownership proof.
 */
router.post('/:id/ownership-claims/:claimId/challenge', verifyToken, validate(challengeClaimSchema), async (req, res) => {
  try {
    if (!householdClaimConfig.flags.challengeFlow) {
      return res.status(404).json({ error: 'Claim challenge flow not enabled' });
    }

    const { id: homeId, claimId } = req.params;
    const userId = req.user.id;
    const { note } = req.body;

    const { data: claim, error: claimError } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .select('id, home_id, claimant_user_id, claim_type, state, claim_phase_v2, terminal_reason, challenge_state, routing_classification, identity_status, merged_into_claim_id')
      .eq('id', claimId)
      .eq('home_id', homeId)
      .maybeSingle();

    if (claimError) throw claimError;
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (claim.claimant_user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!homeClaimRoutingService.isClaimActiveRecord(claim)) {
      return res.status(400).json({ error: 'Only active claims can enter the challenge flow' });
    }

    if (!['owner', 'admin'].includes(claim.claim_type)) {
      return res.status(400).json({ error: 'Only ownership claims can challenge a verified household' });
    }

    const { count: verifiedOwnerCount, error: verifiedOwnerError } = await supabaseAdmin
      .from('HomeOwner')
      .select('id', { count: 'exact', head: true })
      .eq('home_id', homeId)
      .eq('owner_status', 'verified');

    if (verifiedOwnerError) throw verifiedOwnerError;
    if (!verifiedOwnerCount) {
      return res.status(400).json({ error: 'This home does not currently have a verified household to challenge' });
    }

    const challengeStrength = await homeClaimRoutingService.deriveClaimStrength(claimId, { includeUnverified: true });
    if (!homeClaimRoutingService.isChallengeStrengthEligible(challengeStrength)) {
      return res.status(409).json({
        error: 'A stronger ownership document is required before this claim can challenge the household',
        code: 'INSUFFICIENT_CHALLENGE_EVIDENCE',
      });
    }

    const { error: challengeUpdateError } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .update({
        routing_classification: 'challenge_claim',
        claim_phase_v2: 'challenged',
        challenge_state: 'challenged',
        claim_strength: challengeStrength,
        updated_at: new Date().toISOString(),
      })
      .eq('id', claimId);

    if (challengeUpdateError) throw challengeUpdateError;

    const homeResolutionState = await recalculateHouseholdResolutionState(homeId);

    await writeAuditLog(homeId, userId, 'OWNERSHIP_CLAIM_CHALLENGED', 'HomeOwnershipClaim', claimId, {
      note: note || null,
      claim_strength: challengeStrength,
    });

    res.json({
      message: 'Ownership challenge opened',
      claim: {
        id: claimId,
        routing_classification: 'challenge_claim',
        claim_phase_v2: 'challenged',
        challenge_state: 'challenged',
        claim_strength: challengeStrength,
      },
      home_resolution_state: homeResolutionState,
    });
  } catch (err) {
    logger.error('Failed to open claim challenge', { error: err.message });
    res.status(500).json({ error: 'Failed to open claim challenge' });
  }
});


// ============================================================
// OWNERS
// ============================================================

/**
 * GET /:id/owners
 * List verified owners with verification tiers.
 */
router.get('/:id/owners', verifyToken, async (req, res) => {
  try {
    const homeId = req.params.id;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'ownership.view');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: owners, error } = await supabaseAdmin
      .from('HomeOwner')
      .select(`
        id, subject_type, subject_id, owner_status, is_primary_owner,
        added_via, verification_tier, created_at, updated_at
      `)
      .eq('home_id', homeId)
      .neq('owner_status', 'revoked')
      .order('is_primary_owner', { ascending: false });

    if (error) throw error;

    // Enrich with user info for user-type owners
    const userIds = (owners || [])
      .filter(o => o.subject_type === 'user')
      .map(o => o.subject_id);

    let userMap = {};
    if (userIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('User')
        .select('id, username, name, profile_picture_url')
        .in('id', userIds);

      userMap = (users || []).reduce((acc, u) => { acc[u.id] = u; return acc; }, {});
    }

    const enriched = (owners || []).map(o => ({
      ...o,
      user: o.subject_type === 'user' ? (userMap[o.subject_id] || null) : null,
    }));

    res.json({ owners: enriched });
  } catch (err) {
    logger.error('Failed to fetch owners', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch owners' });
  }
});

/**
 * POST /:id/owners/invite
 * Invite a co-owner. Creates an ownership claim via invite method.
 */
router.post('/:id/owners/invite', verifyToken, validate(inviteOwnerSchema), async (req, res) => {
  try {
    const homeId = req.params.id;
    const userId = req.user.id;
    const { email, phone, user_id: inviteeUserId, fast_track } = req.body;

    const access = await checkHomePermission(homeId, userId, 'ownership.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Resolve invitee user
    let targetUserId = inviteeUserId;
    if (!targetUserId && email) {
      const { data: user } = await supabaseAdmin
        .from('User')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      targetUserId = user?.id;
    }

    if (!targetUserId) {
      return res.status(400).json({ error: 'Could not find user. They may need to create an account first.' });
    }

    // Check if already an owner
    const { data: existingOwner } = await supabaseAdmin
      .from('HomeOwner')
      .select('id')
      .eq('home_id', homeId)
      .eq('subject_id', targetUserId)
      .neq('owner_status', 'revoked')
      .maybeSingle();

    if (existingOwner) {
      return res.status(400).json({ error: 'This user is already an owner of this home' });
    }

    const method = fast_track ? 'vouch' : 'invite';

    const { data: claim, error } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .insert({
        home_id: homeId,
        claimant_user_id: targetUserId,
        claim_type: 'owner',
        state: fast_track ? 'pending_challenge_window' : 'submitted',
        method,
        risk_score: 0,
        ...(await homeClaimCompatService.buildInitialClaimCompatibilityFields({
          homeId,
          userId: targetUserId,
          claimType: 'owner',
          method,
          legacyState: fast_track ? 'pending_challenge_window' : 'submitted',
        })),
      })
      .select()
      .single();

    if (error) {
      // 23505 = unique_violation from idx_home_claim_active_unique (concurrent claim race)
      if (error.code === '23505') {
        return res.status(409).json({
          error: 'An ownership claim is already active for this home. Please wait for it to be resolved before inviting a co-owner.',
          code: 'DUPLICATE_CLAIM',
        });
      }
      throw error;
    }

    await writeAuditLog(homeId, userId, 'OWNER_INVITED', 'HomeOwnershipClaim', claim.id, {
      invitee: targetUserId, method, fast_track,
    });

    await recalculateHouseholdResolutionState(homeId);

    res.status(201).json({
      message: 'Co-owner invitation sent. They will need to verify ownership.',
      claim_id: claim.id,
    });
  } catch (err) {
    logger.error('Failed to invite co-owner', { error: err.message });
    res.status(500).json({ error: 'Failed to invite co-owner' });
  }
});

/**
 * POST /:id/owners/transfer
 * Initiate ownership transfer (Tier 3 quorum required if multiple owners).
 */
router.post('/:id/owners/transfer', verifyToken, validate(transferOwnerSchema), async (req, res) => {
  try {
    const homeId = req.params.id;
    const userId = req.user.id;
    const { buyer_email, buyer_phone, buyer_user_id, effective_date } = req.body;

    const access = await checkHomePermission(homeId, userId, 'ownership.transfer');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('security_state')
      .eq('id', homeId)
      .single();

    if (policy.isActionBlockedByState(home.security_state, 'TRANSFER_OWNERSHIP')) {
      return res.status(403).json({ error: 'Transfers are restricted in the current home state' });
    }

    const quorum = await policy.calculateQuorumRequirement('TRANSFER_OWNERSHIP', homeId);

    if (quorum.needed) {
      const { data: action, error } = await supabaseAdmin
        .from('HomeQuorumAction')
        .insert({
          home_id: homeId,
          proposed_by: userId,
          action_type: 'TRANSFER_OWNERSHIP',
          state: 'proposed',
          risk_tier: quorum.riskTier,
          required_rule: quorum.requiredRule,
          required_approvals: quorum.requiredApprovals,
          min_rejects_to_block: quorum.minRejectsToBlock,
          expires_at: quorum.expiresAt.toISOString(),
          passive_approval_at: quorum.passiveApprovalAt?.toISOString() || null,
          metadata: { buyer_email, buyer_phone, buyer_user_id, effective_date },
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-approve with proposer's vote
      await supabaseAdmin
        .from('HomeQuorumVote')
        .insert({
          quorum_action_id: action.id,
          voter_user_id: userId,
          vote: 'approve',
        });

      await writeAuditLog(homeId, userId, 'TRANSFER_PROPOSED', 'HomeQuorumAction', action.id, {
        buyer_email, buyer_user_id,
      });

      return res.status(201).json({
        message: 'Transfer requires approval from other owners',
        quorum_action_id: action.id,
        required_approvals: quorum.requiredApprovals,
      });
    }

    // Single owner — execute transfer directly (two-step: revoke seller + create buyer claim)
    const transferResult = await executeOwnershipTransfer(homeId, {
      buyer_email, buyer_phone, buyer_user_id, effective_date,
    }, userId);

    await writeAuditLog(homeId, userId, 'TRANSFER_INITIATED', null, null, {
      buyer_email, buyer_phone, buyer_user_id, effective_date,
      transfer_claim_id: transferResult?.claimId || null,
    });

    res.json({
      message: 'Transfer initiated. The new owner must verify ownership before transfer completes.',
      transfer_claim_id: transferResult?.claimId || null,
    });
  } catch (err) {
    logger.error('Failed to initiate transfer', { error: err.message });
    res.status(500).json({ error: 'Failed to initiate transfer' });
  }
});

/**
 * DELETE /:id/owners/:ownerId
 * Remove an owner (Tier 3 quorum required if multiple owners).
 */
router.delete('/:id/owners/:ownerId', verifyToken, async (req, res) => {
  try {
    const { id: homeId, ownerId } = req.params;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'ownership.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('security_state')
      .eq('id', homeId)
      .single();

    if (policy.isActionBlockedByState(home.security_state, 'REMOVE_OWNER')) {
      return res.status(403).json({ error: 'Owner removal is restricted in the current home state' });
    }

    const { data: targetOwner } = await supabaseAdmin
      .from('HomeOwner')
      .select('*')
      .eq('id', ownerId)
      .eq('home_id', homeId)
      .single();

    if (!targetOwner) return res.status(404).json({ error: 'Owner not found' });

    const quorum = await policy.calculateQuorumRequirement('REMOVE_OWNER', homeId);

    if (quorum.needed) {
      const { data: action, error } = await supabaseAdmin
        .from('HomeQuorumAction')
        .insert({
          home_id: homeId,
          proposed_by: userId,
          action_type: 'REMOVE_OWNER',
          state: 'proposed',
          risk_tier: quorum.riskTier,
          required_rule: quorum.requiredRule,
          required_approvals: quorum.requiredApprovals,
          min_rejects_to_block: quorum.minRejectsToBlock,
          expires_at: quorum.expiresAt.toISOString(),
          metadata: { target_owner_id: ownerId, target_subject_id: targetOwner.subject_id },
        })
        .select()
        .single();

      if (error) throw error;

      await supabaseAdmin
        .from('HomeQuorumVote')
        .insert({ quorum_action_id: action.id, voter_user_id: userId, vote: 'approve' });

      return res.json({
        message: 'Owner removal requires approval from other owners',
        quorum_action_id: action.id,
      });
    }

    // Single owner self-removal or direct removal
    await supabaseAdmin
      .from('HomeOwner')
      .update({ owner_status: 'revoked', updated_at: new Date().toISOString() })
      .eq('id', ownerId);

    await writeAuditLog(homeId, userId, 'OWNER_REMOVED', 'HomeOwner', ownerId, {
      subject_id: targetOwner.subject_id,
    });

    res.json({ message: 'Owner removed' });
  } catch (err) {
    logger.error('Failed to remove owner', { error: err.message });
    res.status(500).json({ error: 'Failed to remove owner' });
  }
});


// ============================================================
// SECURITY SETTINGS
// ============================================================

/**
 * GET /:id/security
 * Get security state and policies.
 */
router.get('/:id/security', verifyToken, async (req, res) => {
  try {
    const homeId = req.params.id;
    const userId = req.user.id;

    // Expire claim window if past deadline
    await checkAndExpireClaimWindow(homeId);

    const access = await checkHomePermission(homeId, userId, 'security.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: home, error } = await supabaseAdmin
      .from('Home')
      .select(`
        security_state, claim_window_ends_at,
        owner_claim_policy, member_attach_policy,
        privacy_mask_level, tenure_mode
      `)
      .eq('id', homeId)
      .single();

    if (error || !home) return res.status(404).json({ error: 'Home not found' });

    const { data: owners } = await supabaseAdmin
      .from('HomeOwner')
      .select('id')
      .eq('home_id', homeId)
      .eq('owner_status', 'verified');

    const claimWindowActive = policy.isClaimWindowActive(home);

    res.json({
      security: {
        ...home,
        claim_window_active: claimWindowActive,
        owner_count: owners?.length || 0,
      },
    });
  } catch (err) {
    logger.error('Failed to fetch security settings', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch security settings' });
  }
});

/**
 * PATCH /:id/security
 * Update security policies (may trigger quorum for multi-owner homes).
 */
router.patch('/:id/security', verifyToken, validate(updateSecuritySchema), async (req, res) => {
  try {
    const homeId = req.params.id;
    const userId = req.user.id;

    // Expire claim window if past deadline
    await checkAndExpireClaimWindow(homeId);

    const access = await checkHomePermission(homeId, userId, 'security.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('security_state, claim_window_ends_at, owner_claim_policy, member_attach_policy, privacy_mask_level, tenure_mode')
      .eq('id', homeId)
      .single();

    if (!home) return res.status(404).json({ error: 'Home not found' });

    const updates = {};
    const beforeData = {};

    if (req.body.owner_claim_policy && req.body.owner_claim_policy !== home.owner_claim_policy) {
      const policyCheck = policy.canChangeOwnerClaimPolicy(home, req.body.owner_claim_policy);
      if (!policyCheck.allowed) {
        return res.status(400).json({ error: policyCheck.reason });
      }

      // Check if quorum needed
      const quorum = await policy.calculateQuorumRequirement('CHANGE_OWNER_CLAIM_POLICY', homeId);
      if (quorum.needed) {
        const { data: action } = await supabaseAdmin
          .from('HomeQuorumAction')
          .insert({
            home_id: homeId,
            proposed_by: userId,
            action_type: 'CHANGE_OWNER_CLAIM_POLICY',
            state: 'proposed',
            risk_tier: quorum.riskTier,
            required_rule: quorum.requiredRule,
            required_approvals: quorum.requiredApprovals,
            min_rejects_to_block: quorum.minRejectsToBlock,
            expires_at: quorum.expiresAt.toISOString(),
            passive_approval_at: quorum.passiveApprovalAt?.toISOString() || null,
            metadata: { new_value: req.body.owner_claim_policy, old_value: home.owner_claim_policy },
          })
          .select()
          .single();

        await supabaseAdmin
          .from('HomeQuorumVote')
          .insert({ quorum_action_id: action.id, voter_user_id: userId, vote: 'approve' });

        return res.json({
          message: `This change will auto-approve in ${policy.CONSTRUCTIVE_CONSENT_DAYS} days unless rejected`,
          quorum_action_id: action.id,
          pending: true,
        });
      }

      beforeData.owner_claim_policy = home.owner_claim_policy;
      updates.owner_claim_policy = req.body.owner_claim_policy;
    }

    if (req.body.member_attach_policy) {
      beforeData.member_attach_policy = home.member_attach_policy;
      updates.member_attach_policy = req.body.member_attach_policy;
    }
    if (req.body.privacy_mask_level) {
      beforeData.privacy_mask_level = home.privacy_mask_level;
      updates.privacy_mask_level = req.body.privacy_mask_level;
    }
    if (req.body.tenure_mode) {
      beforeData.tenure_mode = home.tenure_mode;
      updates.tenure_mode = req.body.tenure_mode;
    }

    if (Object.keys(updates).length === 0) {
      return res.json({ message: 'No changes', security: home });
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabaseAdmin
      .from('Home')
      .update(updates)
      .eq('id', homeId)
      .select('security_state, claim_window_ends_at, owner_claim_policy, member_attach_policy, privacy_mask_level, tenure_mode')
      .single();

    if (error) throw error;

    await writeAuditLog(homeId, userId, 'SECURITY_SETTINGS_UPDATED', 'Home', homeId, {
      before: beforeData, after: updates,
    });

    res.json({ message: 'Settings updated', security: updated });
  } catch (err) {
    logger.error('Failed to update security settings', { error: err.message });
    res.status(500).json({ error: 'Failed to update settings' });
  }
});


// ============================================================
// QUORUM ACTIONS
// ============================================================

/**
 * GET /:id/quorum-actions
 * List pending quorum actions for a home.
 */
router.get('/:id/quorum-actions', verifyToken, async (req, res) => {
  try {
    const homeId = req.params.id;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'quorum.vote');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check and process constructive consent + expired quorum actions
    await processQuorumExpirations(homeId, userId);

    const { data: actions, error } = await supabaseAdmin
      .from('HomeQuorumAction')
      .select(`
        *,
        proposer:proposed_by (id, username, name),
        votes:HomeQuorumVote (id, voter_user_id, vote, voted_at)
      `)
      .eq('home_id', homeId)
      .in('state', ['proposed', 'collecting_votes'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ actions: actions || [] });
  } catch (err) {
    logger.error('Failed to fetch quorum actions', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch quorum actions' });
  }
});

/**
 * POST /:id/quorum-actions
 * Propose a new quorum action.
 */
router.post('/:id/quorum-actions', verifyToken, async (req, res) => {
  try {
    const homeId = req.params.id;
    const userId = req.user.id;
    const { action_type, metadata } = req.body;

    const access = await checkHomePermission(homeId, userId, 'quorum.propose');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('security_state')
      .eq('id', homeId)
      .single();

    if (policy.isActionBlockedByState(home.security_state, action_type)) {
      return res.status(403).json({ error: 'This action is restricted in the current home state' });
    }

    const quorum = await policy.calculateQuorumRequirement(action_type, homeId);

    if (!quorum.needed) {
      return res.json({ message: 'No quorum needed for this action', auto_approved: true });
    }

    const { data: action, error } = await supabaseAdmin
      .from('HomeQuorumAction')
      .insert({
        home_id: homeId,
        proposed_by: userId,
        action_type,
        state: 'proposed',
        risk_tier: quorum.riskTier,
        required_rule: quorum.requiredRule,
        required_approvals: quorum.requiredApprovals,
        min_rejects_to_block: quorum.minRejectsToBlock,
        expires_at: quorum.expiresAt.toISOString(),
        passive_approval_at: quorum.passiveApprovalAt?.toISOString() || null,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) throw error;

    await supabaseAdmin
      .from('HomeQuorumVote')
      .insert({ quorum_action_id: action.id, voter_user_id: userId, vote: 'approve' });

    await writeAuditLog(homeId, userId, 'QUORUM_ACTION_PROPOSED', 'HomeQuorumAction', action.id, {
      action_type, risk_tier: quorum.riskTier,
    });

    res.status(201).json({ action });
  } catch (err) {
    logger.error('Failed to propose quorum action', { error: err.message });
    res.status(500).json({ error: 'Failed to propose action' });
  }
});

/**
 * POST /:id/quorum-actions/:actionId/vote
 * Vote on a quorum action.
 */
router.post('/:id/quorum-actions/:actionId/vote', verifyToken, validate(voteSchema), async (req, res) => {
  try {
    const { id: homeId, actionId } = req.params;
    const userId = req.user.id;
    const { vote, reason } = req.body;

    const access = await checkHomePermission(homeId, userId, 'quorum.vote');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Must be a verified owner to vote
    const { data: ownerRecord } = await supabaseAdmin
      .from('HomeOwner')
      .select('id')
      .eq('home_id', homeId)
      .eq('subject_id', userId)
      .eq('owner_status', 'verified')
      .maybeSingle();

    if (!ownerRecord) {
      return res.status(403).json({ error: 'Only verified owners can vote' });
    }

    const { data: action } = await supabaseAdmin
      .from('HomeQuorumAction')
      .select('*')
      .eq('id', actionId)
      .eq('home_id', homeId)
      .single();

    if (!action) return res.status(404).json({ error: 'Action not found' });

    if (!['proposed', 'collecting_votes'].includes(action.state)) {
      return res.status(400).json({ error: 'Voting is closed for this action' });
    }

    // Upsert vote
    const { error: voteError } = await supabaseAdmin
      .from('HomeQuorumVote')
      .upsert({
        quorum_action_id: actionId,
        voter_user_id: userId,
        vote,
        reason: reason || null,
        voted_at: new Date().toISOString(),
      }, { onConflict: 'quorum_action_id,voter_user_id' });

    if (voteError) throw voteError;

    // Check if action should resolve
    const { data: votes } = await supabaseAdmin
      .from('HomeQuorumVote')
      .select('vote')
      .eq('quorum_action_id', actionId);

    const approvals = (votes || []).filter(v => v.vote === 'approve').length;
    const rejections = (votes || []).filter(v => v.vote === 'reject').length;

    let newState = action.state === 'proposed' ? 'collecting_votes' : action.state;

    if (rejections >= action.min_rejects_to_block) {
      newState = 'rejected';
    } else if (approvals >= action.required_approvals) {
      newState = 'approved';
    }

    if (newState !== action.state) {
      await supabaseAdmin
        .from('HomeQuorumAction')
        .update({ state: newState, updated_at: new Date().toISOString() })
        .eq('id', actionId);

      // Execute the action if approved
      if (newState === 'approved') {
        await executeQuorumAction(homeId, action, userId);
      }
    }

    await writeAuditLog(homeId, userId, 'QUORUM_VOTE_CAST', 'HomeQuorumAction', actionId, {
      vote, result_state: newState,
    });

    res.json({ message: 'Vote recorded', action_state: newState, approvals, rejections });
  } catch (err) {
    logger.error('Failed to vote on quorum action', { error: err.message });
    res.status(500).json({ error: 'Failed to vote' });
  }
});


// ============================================================
// DISPUTE CENTER
// ============================================================

/**
 * GET /:id/dispute
 * Get dispute details and timeline.
 */
router.get('/:id/dispute', verifyToken, async (req, res) => {
  try {
    const homeId = req.params.id;
    const userId = req.user.id;

    const access = await checkHomePermission(homeId, userId, 'dispute.view');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('security_state')
      .eq('id', homeId)
      .single();

    // Product: in-app dispute center disabled — keep endpoint for clients without surfacing active disputes.
    res.json({
      dispute: {
        active: false,
        security_state: home?.security_state || 'normal',
        claims: [],
        timeline: [],
        restricted_actions: [],
      },
    });
  } catch (err) {
    logger.error('Failed to fetch dispute details', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch dispute details' });
  }
});


// ============================================================
// HELPERS
// ============================================================

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
 * Execute a quorum action that has been approved.
 * Applies the actual change to the home/owners based on action_type.
 */
async function executeQuorumAction(homeId, action, actorUserId) {
  const meta = action.metadata || {};

  try {
    switch (action.action_type) {
      case 'CHANGE_OWNER_CLAIM_POLICY': {
        if (meta.new_value) {
          await supabaseAdmin
            .from('Home')
            .update({ owner_claim_policy: meta.new_value, updated_at: new Date().toISOString() })
            .eq('id', homeId);
        }
        break;
      }
      case 'CHANGE_MEMBER_ATTACH_POLICY': {
        if (meta.new_value) {
          await supabaseAdmin
            .from('Home')
            .update({ member_attach_policy: meta.new_value, updated_at: new Date().toISOString() })
            .eq('id', homeId);
        }
        break;
      }
      case 'CHANGE_PRIVACY_MASK': {
        if (meta.new_value) {
          await supabaseAdmin
            .from('Home')
            .update({ privacy_mask_level: meta.new_value, updated_at: new Date().toISOString() })
            .eq('id', homeId);
        }
        break;
      }
      case 'CHANGE_TENURE_MODE': {
        if (meta.new_value) {
          await supabaseAdmin
            .from('Home')
            .update({ tenure_mode: meta.new_value, updated_at: new Date().toISOString() })
            .eq('id', homeId);
        }
        break;
      }
      case 'REMOVE_OWNER': {
        if (meta.target_owner_id) {
          await supabaseAdmin
            .from('HomeOwner')
            .update({ owner_status: 'revoked', updated_at: new Date().toISOString() })
            .eq('id', meta.target_owner_id);
        }
        break;
      }
      case 'CHANGE_PRIMARY_OWNER': {
        if (meta.new_primary_subject_id) {
          // Remove primary from all current owners
          await supabaseAdmin
            .from('HomeOwner')
            .update({ is_primary_owner: false })
            .eq('home_id', homeId)
            .eq('is_primary_owner', true);
          // Set new primary
          await supabaseAdmin
            .from('HomeOwner')
            .update({ is_primary_owner: true, updated_at: new Date().toISOString() })
            .eq('home_id', homeId)
            .eq('subject_id', meta.new_primary_subject_id)
            .eq('owner_status', 'verified');
        }
        break;
      }
      case 'FREEZE_HOME': {
        await supabaseAdmin
          .from('Home')
          .update({ security_state: 'frozen', updated_at: new Date().toISOString() })
          .eq('id', homeId);
        break;
      }
      case 'TRANSFER_OWNERSHIP': {
        await executeOwnershipTransfer(homeId, meta, actorUserId);
        break;
      }
      default:
        logger.info('Quorum action executed (no-op handler)', { action_type: action.action_type, homeId });
    }

    await writeAuditLog(homeId, actorUserId, `QUORUM_ACTION_EXECUTED`, 'HomeQuorumAction', action.id, {
      action_type: action.action_type, metadata: meta,
    });
  } catch (err) {
    logger.error('Failed to execute quorum action', { error: err.message, action_type: action.action_type, homeId });
  }
}


/**
 * Execute a two-step ownership transfer.
 *
 * Step 1 (immediate): Revoke current seller's ownership, clear Home.owner_id.
 * Step 2 (deferred):  Create an ownership claim for the buyer so they must
 *                      independently verify before gaining full owner access.
 *
 * If buyer_user_id is provided, the claim is created directly. Otherwise a
 * pending transfer record is stored and the buyer is notified by email.
 */
async function executeOwnershipTransfer(homeId, meta, actorUserId) {
  const now = new Date().toISOString();
  const { buyer_email, buyer_phone, buyer_user_id, effective_date } = meta;

  // ── Step 1: Revoke seller's ownership ──
  // Find the current seller (the actor who initiated the transfer)
  const { data: sellerOwner } = await supabaseAdmin
    .from('HomeOwner')
    .select('id, subject_id')
    .eq('home_id', homeId)
    .eq('subject_id', actorUserId)
    .eq('owner_status', 'verified')
    .maybeSingle();

  if (sellerOwner) {
    await supabaseAdmin
      .from('HomeOwner')
      .update({ owner_status: 'revoked', updated_at: now })
      .eq('id', sellerOwner.id);
  }

  // Clear Home.owner_id (legacy field) — it will be re-set when buyer claim is approved
  await supabaseAdmin
    .from('Home')
    .update({ owner_id: null, updated_at: now })
    .eq('id', homeId)
    .eq('owner_id', actorUserId); // only clear if it was this seller

  // Downgrade seller's occupancy permissions via applyOccupancyTemplate
  await applyOccupancyTemplate(homeId, actorUserId, 'member', 'verified');

  // ── Step 2: Create buyer claim ──
  let claimId = null;
  let targetUserId = buyer_user_id || null;

  // Resolve buyer by email if no user_id provided
  if (!targetUserId && buyer_email) {
    const { data: buyerUser } = await supabaseAdmin
      .from('User')
      .select('id')
      .eq('email', buyer_email)
      .maybeSingle();
    targetUserId = buyerUser?.id || null;
  }

  if (targetUserId) {
    // Create a pre-seeded ownership claim for the buyer
    const { data: claim, error: claimError } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .insert({
        home_id: homeId,
        claimant_user_id: targetUserId,
        claim_type: 'owner',
        state: 'submitted',
        method: 'invite',
        risk_score: 0, // Invited by prior owner — lowest risk
        metadata: { transfer_from: actorUserId, effective_date },
        ...(await homeClaimCompatService.buildInitialClaimCompatibilityFields({
          homeId,
          userId: targetUserId,
          claimType: 'owner',
          method: 'invite',
          legacyState: 'submitted',
        })),
      })
      .select('id')
      .single();

    if (!claimError && claim) {
      claimId = claim.id;
      await recalculateHouseholdResolutionState(homeId);
    }

    // Notify the buyer
    try {
      const notificationService = require('../services/notificationService');
      notificationService.createNotification({
        userId: targetUserId,
        type: 'ownership_transfer_received',
        title: 'Ownership transfer initiated',
        body: 'You have been designated as the new owner. Please verify ownership to complete the transfer.',
        link: `/homes/${homeId}/ownership`,
        metadata: { home_id: homeId, claim_id: claimId },
      });
    } catch (notifErr) {
      logger.warn('Failed to send transfer notification (non-fatal)', { error: notifErr.message });
    }
  }

  // Activate claim window so other potential owners can also claim
  await supabaseAdmin
    .from('Home')
    .update({
      security_state: 'claim_window',
      claim_window_ends_at: policy.getClaimWindowEndsAt().toISOString(),
      updated_at: now,
    })
    .eq('id', homeId);

  await writeAuditLog(homeId, actorUserId, 'TRANSFER_EXECUTED', null, null, {
    seller_user_id: actorUserId,
    buyer_user_id: targetUserId,
    buyer_email,
    claim_id: claimId,
    effective_date,
  });

  await recalculateHouseholdResolutionState(homeId);

  logger.info('Ownership transfer executed', { homeId, seller: actorUserId, buyer: targetUserId, claimId });

  return { claimId, targetUserId };
}


/**
 * Check and expire claim windows for homes (called as middleware on relevant routes).
 * Transitions claim_window → normal when the window has expired.
 */
async function checkAndExpireClaimWindow(homeId) {
  try {
    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('security_state, claim_window_ends_at')
      .eq('id', homeId)
      .single();

    if (!home) return;
    if (home.security_state !== 'claim_window') return;
    if (!home.claim_window_ends_at) return;

    if (new Date(home.claim_window_ends_at) <= new Date()) {
      await supabaseAdmin
        .from('Home')
        .update({
          security_state: 'normal',
          updated_at: new Date().toISOString(),
        })
        .eq('id', homeId)
        .eq('security_state', 'claim_window'); // CAS-style guard

      logger.info('Claim window expired, transitioned to normal', { homeId });
    }
  } catch (err) {
    logger.warn('Failed to check claim window expiry (non-fatal)', { error: err.message, homeId });
  }
}


/**
 * Process constructive consent and expiration for pending quorum actions.
 * - Tier 1-2: auto-approve if passive_approval_at is reached and no rejections
 * - All tiers: expire if expires_at is reached
 */
async function processQuorumExpirations(homeId, actorUserId) {
  try {
    const { data: pendingActions } = await supabaseAdmin
      .from('HomeQuorumAction')
      .select('*, votes:HomeQuorumVote(vote)')
      .eq('home_id', homeId)
      .in('state', ['proposed', 'collecting_votes']);

    if (!pendingActions || pendingActions.length === 0) return;

    const now = new Date();

    for (const action of pendingActions) {
      const votes = action.votes || [];
      const rejections = votes.filter(v => v.vote === 'reject').length;

      // Check hard expiration
      if (action.expires_at && new Date(action.expires_at) <= now) {
        await supabaseAdmin
          .from('HomeQuorumAction')
          .update({ state: 'expired', updated_at: now.toISOString() })
          .eq('id', action.id);

        await writeAuditLog(homeId, actorUserId, 'QUORUM_ACTION_EXPIRED', 'HomeQuorumAction', action.id, {
          action_type: action.action_type,
        });
        continue;
      }

      // Check constructive consent (Tier 1-2 only)
      if (action.passive_approval_at && action.risk_tier <= 2) {
        if (new Date(action.passive_approval_at) <= now && rejections === 0) {
          await supabaseAdmin
            .from('HomeQuorumAction')
            .update({ state: 'approved', updated_at: now.toISOString() })
            .eq('id', action.id);

          await executeQuorumAction(homeId, action, actorUserId);

          await writeAuditLog(homeId, actorUserId, 'QUORUM_ACTION_AUTO_APPROVED', 'HomeQuorumAction', action.id, {
            action_type: action.action_type, reason: 'constructive_consent',
          });
        }
      }
    }
  } catch (err) {
    logger.warn('Failed to process quorum expirations (non-fatal)', { error: err.message, homeId });
  }
}


// ============================================================
// POSTCARD VERIFICATION
// ============================================================

/**
 * POST /:id/request-postcard - Request a verification code mailed to the home address.
 * Generates a 6-digit code, stores it, and flags for manual mailing.
 * Rate-limited to 1 active pending code per user per home.
 */
router.post('/:id/request-postcard', verifyToken, postcardLimiter, async (req, res) => {
  try {
    const homeId = req.params.id;
    const userId = req.user.id;

    // Verify home exists
    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('id, address, city, state')
      .eq('id', homeId)
      .single();

    if (!home) {
      return res.status(404).json({ error: 'Home not found' });
    }

    // Check for existing pending code
    const { data: existing } = await supabaseAdmin
      .from('HomePostcardCode')
      .select('id, requested_at, expires_at')
      .eq('home_id', homeId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single();

    if (existing) {
      return res.status(400).json({
        error: 'You already have a pending verification code for this home',
        requested_at: existing.requested_at,
        expires_at: existing.expires_at,
      });
    }

    // BUG 4B: Per-address postcard rate limit — max 2 pending codes per home_id
    const { count: pendingForHome } = await supabaseAdmin
      .from('HomePostcardCode')
      .select('id', { count: 'exact', head: true })
      .eq('home_id', homeId)
      .eq('status', 'pending');

    if (pendingForHome >= 2) {
      return res.status(429).json({
        error: 'This address already has the maximum number of pending verification codes. Please wait for existing codes to be used or expire.',
      });
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    const { data: postcard, error } = await supabaseAdmin
      .from('HomePostcardCode')
      .insert({
        home_id: homeId,
        user_id: userId,
        code,
        status: 'pending',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id, requested_at, expires_at')
      .single();

    if (error) {
      logger.error('Error creating postcard code', { error: error.message });
      return res.status(500).json({ error: 'Failed to request verification code' });
    }

    // Log for admin/mailing pipeline
    await writeAuditLog(homeId, userId, 'POSTCARD_CODE_REQUESTED', 'HomePostcardCode', postcard.id, {
      address: `${home.address}, ${home.city}, ${home.state}`,
    });

    logger.info('Postcard code requested', { homeId, userId, postcardId: postcard.id });

    res.status(201).json({
      message: 'Verification code requested. A code will be mailed to the home address.',
      postcard: {
        id: postcard.id,
        requested_at: postcard.requested_at,
        expires_at: postcard.expires_at,
      },
    });
  } catch (err) {
    logger.error('Request postcard error', { error: err.message });
    res.status(500).json({ error: 'Failed to request verification code' });
  }
});

/**
 * POST /:id/verify-postcard - Verify a postcard code.
 * On success, upgrades the user's residency claim to verified
 * and creates a HomeOccupancy if one doesn't exist.
 */
const verifyPostcardSchema = Joi.object({
  code: Joi.string().min(6).max(8).pattern(/^[A-Z0-9]+$/i).required(),
});

router.post('/:id/verify-postcard', verifyToken, verificationAttemptLimiter, validate(verifyPostcardSchema), async (req, res) => {
  try {
    const homeId = req.params.id;
    const userId = req.user.id;
    const { code } = req.body;

    // Fetch active pending code
    const { data: postcard } = await supabaseAdmin
      .from('HomePostcardCode')
      .select('*')
      .eq('home_id', homeId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single();

    if (!postcard) {
      return res.status(404).json({ error: 'No pending verification code found' });
    }

    // Check expiry
    if (new Date(postcard.expires_at) < new Date()) {
      await supabaseAdmin
        .from('HomePostcardCode')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', postcard.id);
      return res.status(410).json({ error: 'Verification code has expired. Request a new one.' });
    }

    // ── LOCKOUT CHECK: must happen BEFORE comparison ──
    const MAX_ATTEMPTS = 5;
    const currentAttempts = postcard.attempts || 0;

    if (currentAttempts >= MAX_ATTEMPTS) {
      await supabaseAdmin
        .from('HomePostcardCode')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', postcard.id);
      return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
    }

    // ── TIMING-SAFE COMPARISON ──
    // Normalize both to uppercase for case-insensitive match
    const submittedNorm = code.toUpperCase();
    const storedNorm = (postcard.code || '').toUpperCase();

    // Pad shorter string so buffers are equal length (supports legacy 6-digit + new 8-char)
    const maxLen = Math.max(submittedNorm.length, storedNorm.length);
    const submittedBuf = Buffer.alloc(maxLen, 0);
    const storedBuf = Buffer.alloc(maxLen, 0);
    Buffer.from(submittedNorm, 'utf8').copy(submittedBuf);
    Buffer.from(storedNorm, 'utf8').copy(storedBuf);

    const codeMatches = submittedNorm.length === storedNorm.length &&
      crypto.timingSafeEqual(submittedBuf, storedBuf);

    // Increment attempts AFTER comparison (but always, regardless of result)
    const attempts = currentAttempts + 1;

    if (!codeMatches) {
      await supabaseAdmin
        .from('HomePostcardCode')
        .update({ attempts, updated_at: new Date().toISOString() })
        .eq('id', postcard.id);
      return res.status(400).json({
        error: 'Invalid code',
        attempts_remaining: MAX_ATTEMPTS - attempts,
      });
    }

    // ── CODE MATCHES — mark verified ──
    await supabaseAdmin
      .from('HomePostcardCode')
      .update({
        status: 'verified',
        verified_at: new Date().toISOString(),
        attempts,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postcard.id);

    // Upgrade residency claim if one exists
    const { data: claim } = await supabaseAdmin
      .from('HomeResidencyClaim')
      .select('id, claimed_role, status')
      .eq('home_id', homeId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (claim && claim.status !== 'verified') {
      await supabaseAdmin
        .from('HomeResidencyClaim')
        .update({
          status: 'verified',
          review_note: 'Verified via postcard code',
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', claim.id);
    }

    // ── DETERMINE VERIFICATION STATUS based on authority presence ──
    const claimedRole = claim?.claimed_role || 'member';
    const roleBase = mapLegacyRole(claimedRole);

    // Count active authorities (owner, admin, manager roles)
    const { count: authorityCount } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('id', { count: 'exact', head: true })
      .eq('home_id', homeId)
      .eq('is_active', true)
      .in('role_base', ['owner', 'admin', 'manager']);

    let verificationStatus;
    let challengeWindowData = {};

    if (authorityCount > 0) {
      // HOME HAS AUTHORITIES → provisional + 7-day challenge window
      verificationStatus = 'provisional';
      const now = new Date();
      const challengeEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      challengeWindowData = {
        challenge_window_started_at: now.toISOString(),
        challenge_window_ends_at: challengeEnd.toISOString(),
      };
    } else {
      // NO AUTHORITIES (cold-start resolution) → verified with full access
      verificationStatus = 'verified';
    }

    // Apply occupancy template (upsert)
    const { occupancy } = await applyOccupancyTemplate(homeId, userId, roleBase, verificationStatus);

    // Set challenge window columns if applicable
    if (challengeWindowData.challenge_window_started_at && occupancy) {
      await supabaseAdmin
        .from('HomeOccupancy')
        .update(challengeWindowData)
        .eq('id', occupancy.id);
    }

    // If cold-start resolution, clear vacancy_at on the Home
    if (verificationStatus === 'verified') {
      await supabaseAdmin
        .from('Home')
        .update({ vacancy_at: null, updated_at: new Date().toISOString() })
        .eq('id', homeId)
        .not('vacancy_at', 'is', null);
    }

    // Audit log
    await writeAuditLog(homeId, userId, 'POSTCARD_CODE_VERIFIED', 'HomePostcardCode', postcard.id, {
      verification_status: verificationStatus,
      has_authorities: authorityCount > 0,
      challenge_window: challengeWindowData.challenge_window_ends_at || null,
    });

    // Notify the user
    const notificationService = require('../services/notificationService');
    const { data: homeData } = await supabaseAdmin
      .from('Home')
      .select('name, address')
      .eq('id', homeId)
      .single();

    notificationService.createNotification({
      userId,
      type: 'residency_approved',
      title: verificationStatus === 'verified' ? 'Welcome home!' : 'Verification received',
      body: verificationStatus === 'verified'
        ? `You've been verified at ${homeData?.name || homeData?.address || 'your home'} via mail code.`
        : `Your mail code was accepted at ${homeData?.name || homeData?.address || 'your home'}. Existing members have 7 days to review.`,
      icon: '🏡',
      link: `/homes/${homeId}/dashboard`,
      metadata: { home_id: homeId, method: 'postcard', verification_status: verificationStatus },
    });

    // If challenge window, notify authorities
    if (authorityCount > 0) {
      const { data: authorities } = await supabaseAdmin
        .from('HomeOccupancy')
        .select('user_id')
        .eq('home_id', homeId)
        .eq('is_active', true)
        .in('role_base', ['owner', 'admin', 'manager']);

      const { data: newUser } = await supabaseAdmin
        .from('User')
        .select('display_name, email')
        .eq('id', userId)
        .single();

      const userName = newUser?.display_name || newUser?.email || 'Someone';

      for (const auth of (authorities || [])) {
        notificationService.createNotification({
          userId: auth.user_id,
          type: 'challenge_window_opened',
          title: 'New member pending review',
          body: `${userName} verified via mail code at ${homeData?.name || 'your home'}. You have 7 days to review.`,
          icon: '🔔',
          link: `/homes/${homeId}/members`,
          metadata: {
            home_id: homeId,
            new_user_id: userId,
            challenge_window_ends_at: challengeWindowData.challenge_window_ends_at,
          },
        });
      }
    }

    res.json({
      message: verificationStatus === 'verified'
        ? 'Verification successful! You are now a verified member.'
        : 'Verification successful! Existing members have 7 days to review your access.',
      occupancy,
      verification_status: verificationStatus,
      challenge_window_ends_at: challengeWindowData.challenge_window_ends_at || null,
    });
  } catch (err) {
    logger.error('Verify postcard error', { error: err.message });
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

module.exports = router;
