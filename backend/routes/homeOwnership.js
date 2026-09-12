/**
 * Home Ownership Routes
 *
 * Handles ownership claims, owner management, security settings,
 * quorum actions/votes, and dispute center.
 *
 * Mounted at /api/homes alongside existing home routes.
 */

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
const adminAlerts = require('../services/adminAlerts');
const homeClaimReviewService = require('../services/homeClaimReviewService');
const { getRequestSessionScope, requireExpectedSessionScope } = require('../utils/requestSessionScope');
const homeClaimComparisonService = require('../services/homeClaimComparisonService');
const homeClaimCompatService = require('../services/homeClaimCompatService');
const homeClaimMergeService = require('../services/homeClaimMergeService');
const householdClaimConfig = require('../config/householdClaims');
const { ownershipClaimLimiter, postcardLimiter, homePostcardRequestLimiter, verificationAttemptLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');
const homePostcardService = require('../services/homePostcardService');

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

const submitClaimSchema = Joi.object({
  claim_type: Joi.string().valid('owner', 'admin', 'resident').default('owner'),
  method: Joi.string().valid('invite', 'vouch', 'doc_upload', 'escrow_agent', 'landlord_portal', 'property_data_match').required(),
});

const reviewClaimSchema = Joi.object({
  review_token: Joi.string().pattern(/^[a-f0-9]{64}$/).allow(null),
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
  request_id: Joi.string().uuid().when('action', { is: 'invite_to_household', then: Joi.forbidden() }),
  review_token: Joi.string().pattern(/^[a-f0-9]{64}$/).when('action', { is: 'invite_to_household', then: Joi.forbidden() }),
}).and('request_id', 'review_token');

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

// ============================================================
// OWNERSHIP CLAIMS
// ============================================================

/**
 * GET /my-ownership-claims
 * Returns the current user's ownership claims (always generic status for opaque handshake).
 */
router.get('/my-ownership-claims', verifyToken, async (req, res) => {
  try {
    if (!requireExpectedSessionScope(req, res)) return;
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

    res.set('Cache-Control', 'private, no-store');
    res.json({ claims: maskedClaims, upload_session: getRequestSessionScope(req) });
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
    if (!requireExpectedSessionScope(req, res)) return;
    const homeId = req.params.id;
    const userId = req.user.id;
    const { claim_type, method } = req.body;
    // The instant door (Wedge Phase 2, D3): a residency claim is reviewed
    // by a person and never contests ownership, so it skips the owner-only
    // policy (rental firewall, challenge routing, owner quotas).
    const isResidencyClaim = claim_type === 'resident';

    // Expire claim window if past deadline
    await checkAndExpireClaimWindow(homeId);

    const eligibility = isResidencyClaim
      ? await policy.canSubmitResidencyClaim(homeId, userId)
      : await policy.canSubmitOwnerClaim(homeId, userId);
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
      if (isResidencyClaim) {
        // Opaque, like the owner path — but hand back the active claim so
        // evidence can still attach to it.
        return res.status(200).json({
          message: "We're verifying your residency at this address. You'll be notified when complete.",
          claim: { id: eligibility.existingClaimId || null, status: 'under_review' },
        });
      }
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

    const rentalCheck = isResidencyClaim ? { blocked: false } : policy.evaluateRentalFirewall(home, method);
    if (rentalCheck.blocked) {
      return res.status(200).json({
        message: "We're verifying ownership for this address. You'll be notified when complete.",
        claim: { status: 'under_review' },
      });
    }

    const riskScore = await policy.getClaimRiskScore({ method }, userId);

    let initialState = 'submitted';
    if (!isResidencyClaim && home.owner_claim_policy === 'review_required' && !policy.isClaimWindowActive(home)) {
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

    if (isResidencyClaim) {
      // The Waiting Room tells the truth: an unverified occupancy becomes
      // "document under review" (the enum value existed, nothing wrote it).
      // Provisional / postcard states keep what they have.
      try {
        await supabaseAdmin
          .from('HomeOccupancy')
          .update({ verification_status: 'pending_doc' })
          .eq('home_id', homeId)
          .eq('user_id', userId)
          .eq('is_active', true)
          .eq('verification_status', 'unverified');
      } catch (occErr) {
        logger.warn('Residency claim: could not mark occupancy pending_doc (non-fatal)', { homeId, userId, error: occErr.message });
      }
      // "Usually within hours" is only true if a person hears about it.
      adminAlerts.notifyClaimToReview({ claim, home, claimantUserId: userId }).catch(() => {});

      return res.status(201).json({
        message: "We're verifying your residency at this address. A person reviews documents, usually within hours.",
        claim: {
          id: claim.id,
          status: 'under_review',
          claim_phase_v2: responseClaimPhase,
          routing_classification: responseRoutingClassification,
        },
        home_resolution: householdResolutionState,
        next_step: 'upload_evidence',
      });
    }

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

        await homeClaimReviewService.recordProvider({ homeId, claimId: claim.id, actorId: userId, result });

        logger.info('Property data match completed', {
          homeId, claimId: claim.id, matched: result.matched,
          confidence: result.confidence, provider: result.provider,
        });
      } catch (pdErr) {
        if (pdErr.code?.startsWith('CLAIM_') || pdErr.code === 'HOME_NOT_FOUND') return homeClaimReviewService.sendError(res, pdErr);
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
    const result = await homeClaimReviewService.read({ homeId: req.params.id, claimId: req.params.claimId, actorId: req.user.id });
    res.json({ claim: result.claim });
  } catch (error) { homeClaimReviewService.sendError(res, error); }
});

/** Withdraw an exact own in-progress claim, retaining its evidence and audit history. */
router.delete('/:id/ownership-claims/:claimId', verifyToken, async (req, res) => {
  try {
    const result = await homeClaimReviewService.mutate({ homeId: req.params.id, claimId: req.params.claimId,
      actorId: req.user.id, action: 'withdraw' });
    res.json(result);
  } catch (error) { homeClaimReviewService.sendError(res, error); }
});

router.post('/:id/ownership-claims/:claimId/review', verifyToken, validate(reviewClaimSchema), async (req, res) => {
  try {
    const result = await homeClaimReviewService.mutate({ homeId: req.params.id, claimId: req.params.claimId,
      actorId: req.user.id, action: req.body.action, reviewToken: req.body.review_token, note: req.body.note });
    res.json({ ...result, message: 'Claim review saved.' });
  } catch (error) { homeClaimReviewService.sendError(res, error); }
});

// A caller's metadata is not evidence provenance. Check the current exact claim
// then return a recoverable private-upload requirement without persisting refs.
router.post('/:id/ownership-claims/:claimId/evidence', verifyToken, validate(uploadEvidenceSchema), async (req, res) => {
  try {
    await homeClaimReviewService.mutate({ homeId: req.params.id, claimId: req.params.claimId,
      actorId: req.user.id, action: 'authorize_evidence' });
    throw new Error('Unexpected evidence authorization receipt');
  } catch (error) { homeClaimReviewService.sendError(res, error); }
});

/** Current ordinary relationship review, bound to the opening authenticated session. */
router.get('/:id/ownership-claims/:claimId/relationship-decision', verifyToken, async (req, res) => {
  try {
    if (!householdClaimConfig.flags.inviteMerge) return res.status(404).json({ error: 'Relationship resolution not enabled' });
    if (!requireExpectedSessionScope(req, res)) return;
    const session = getRequestSessionScope(req);
    const result = await homeClaimReviewService.read({ homeId: req.params.id, claimId: req.params.claimId, actorId: req.user.id });
    if (['frozen', 'frozen_silent', 'disputed'].includes(result.home?.security_state)) {
      return res.status(403).json({ code: 'CLAIM_REVIEW_DENIED', error: 'Current Home access does not allow relationship review.' });
    }
    res.set('Cache-Control', 'private, no-store');
    return res.json({ claim: result.claim, relationship_session: { ...session, home_id: req.params.id } });
  } catch (error) { homeClaimReviewService.sendError(res, error); }
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

    if (!requireExpectedSessionScope(req, res)) return;
    res.set('Cache-Control', 'private, no-store');
    const { id: homeId, claimId } = req.params;
    const userId = req.user.id;
    const { action, note } = req.body;

    if (action === 'invite_to_household') {
      const result = await homeClaimMergeService.issueClaimInvitation({ homeId, claimId, userId, note });
      const invitation = result.invitation;
      return res.json({
        message: invitation.proposed_role_base === 'owner'
          ? 'Co-owner invitation issued for the claimant' : 'Household invitation issued for the claimant',
        action, claim: { id: claimId, routing_classification: 'merge_candidate' },
        invitation: { id: invitation.id, status: invitation.status, expires_at: invitation.expires_at,
          proposed_role: invitation.proposed_role, proposed_role_base: invitation.proposed_role_base },
      });
    }

    const result = await require('../services/homeClaimRelationshipService').decide({
      homeId, claimId, actorId: userId, action, note,
      requestId: req.body.request_id, reviewToken: req.body.review_token,
    });
    const message = result.replayed
      ? 'Original relationship decision confirmed; current claim refreshed'
      : action === 'decline_relationship'
        ? 'Claim will continue through independent verification'
        : result.receipt.result.qualifies_for_dispute ? 'Claim flagged for dispute review' : 'Claim flagged for admin review';
    return res.json({ ...result, message });
  } catch (err) {
    if (req.body.action === 'invite_to_household') {
      if (err.statusCode || err.status) return res.status(err.statusCode || err.status).json({ error: err.message, code: err.code });
      logger.error('Failed to resolve claimant invitation', { code: err.code });
      return res.status(500).json({ error: 'Failed to resolve claimant relationship' });
    }
    return require('../services/homeClaimRelationshipService').sendError(res, err);
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

    const mergeResult = await homeClaimMergeService.acceptClaimMerge({
      homeId, claimId, userId, invitationId: invitationId || null,
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
 * May this user have a verification code mailed to this home?
 *
 * True when they already have a relationship with the home (occupancy, owner
 * row, or a filed residency/ownership claim), or when the home has no active
 * occupants at all — the cold-start case the postcard flow exists to serve.
 */
async function mayRequestPostcard(homeId, userId) {
  const access = await checkHomePermission(homeId, userId);
  if (access.readFailed) throw new Error('Postcard access could not be checked');
  if (access.hasAccess) return true;

  const { data: claim, error: claimError } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id')
    .eq('home_id', homeId)
    .eq('claimant_user_id', userId)
    .in('state', ['draft', 'submitted', 'needs_more_info', 'pending_review', 'pending_challenge_window', 'approved'])
    .limit(1).maybeSingle();
  if (claimError) throw new Error('Postcard claim could not be checked');
  if (claim) return true;

  const { data: residency, error: residencyError } = await supabaseAdmin.from('HomeResidencyClaim')
    .select('id').eq('home_id', homeId).eq('user_id', userId).eq('status', 'pending').limit(1).maybeSingle();
  if (residencyError) throw new Error('Residency claim could not be checked');
  if (residency) return true;

  const { count, error: occupancyError } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('id', { count: 'exact', head: true })
    .eq('home_id', homeId)
    .eq('is_active', true);

  if (occupancyError || count == null) throw new Error('Postcard household could not be checked');
  return count === 0;
}


const postcardNoStore = (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); };
const postcardRequests = require('../services/homePostcardRequestService');
router.post('/:id/postcard-requests', postcardNoStore, verifyToken, homePostcardRequestLimiter, async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).some(key => !['request_id', 'address'].includes(key))) {
      return res.status(400).json({ code: 'POSTCARD_REQUEST_INVALID', error: 'Check the mailing address and apartment before continuing.' });
    }
    postcardRequests.send(res, await postcardRequests.submit({ homeId: req.params.id, actorId: req.user.id,
      requestId: req.body.request_id, address: req.body.address }));
  } catch (error) { postcardRequests.sendError(res, error); }
});
router.get('/:id/postcard-requests/:requestId', postcardNoStore, verifyToken, async (req, res) => {
  try { postcardRequests.send(res, await postcardRequests.read({ homeId: req.params.id, actorId: req.user.id, requestId: req.params.requestId })); }
  catch (error) { postcardRequests.sendError(res, error); }
});
router.post('/:id/postcard-requests/:requestId/cancel', postcardNoStore, verifyToken, async (req, res) => {
  try { postcardRequests.send(res, await postcardRequests.cancel({ homeId: req.params.id, actorId: req.user.id, requestId: req.params.requestId })); }
  catch (error) { postcardRequests.sendError(res, error); }
});
router.get('/:id/postcard-status', postcardNoStore, verifyToken, async (req, res) => {
  try { res.status(200).json(await postcardRequests.current({ homeId: req.params.id, actorId: req.user.id })); }
  catch (error) { postcardRequests.sendError(res, error); }
});

/** POST /:id/request-postcard — atomically admit one proof and preserve uncertain mail. */
router.post('/:id/request-postcard', postcardNoStore, verifyToken, postcardLimiter, async (req, res) => {
  try {
    if (!(await mayRequestPostcard(req.params.id, req.user.id))) {
      return res.status(403).json({ error: 'You do not have a pending claim on this home.' });
    }
    const result = await homePostcardService.request(req.params.id, req.user.id);
    return res.status(result.status).json(result.body);
  } catch (err) {
    logger.error('Request postcard failed', { error: err.message });
    return res.status(503).json({ error: 'Could not check postcard access. Please retry.' });
  }
});

/** GET /:id/postcard — own pending metadata only; never a code, hash or provider receipt. */
router.get('/:id/postcard', postcardNoStore, verifyToken, async (req, res) => {
  try {
    const result = await homePostcardService.status(req.params.id, req.user.id);
    return res.status(result.status).json(result.body);
  } catch (_err) {
    return res.status(503).json({ error: 'Could not check postcard status. Please retry.' });
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

router.post('/:id/verify-postcard', postcardNoStore, verifyToken, verificationAttemptLimiter, validate(verifyPostcardSchema), async (req, res) => {
  try {
    const homeId = req.params.id;
    const userId = req.user.id;
    const { code } = req.body;

    const result = await homePostcardService.confirm(homeId, userId, code);
    if (result.status !== 200 || result.reused) return res.status(result.status).json(result.body);
    const { occupancy, verification_status: verificationStatus } = result.body;
    const challengeWindowData = { challenge_window_ends_at: result.body.challenge_window_ends_at };
    const authorityCount = verificationStatus === 'provisional' ? 1 : 0;

    try {
      // Notify the user
      const notificationService = require('../services/notificationService');
      const { data: homeData } = await supabaseAdmin
        .from('Home')
        .select('name, address')
        .eq('id', homeId)
        .single();

      await notificationService.createNotification({
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
          await notificationService.createNotification({
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

    } catch (_notificationError) {
      logger.warn('Postcard verified but notification delivery failed', { homeId, userId });
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
