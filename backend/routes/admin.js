// ============================================================
// ADMIN ROUTES — Platform-level admin operations
// Requires User.role = 'admin' for all endpoints.
// Mount at: app.use('/api/admin', require('./routes/admin'));
// ============================================================

const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const { requireAdmin } = require('../middleware/verifyToken');
const logger = require('../utils/logger');
const s3 = require('../services/s3Service');
const homeClaimRoutingService = require('../services/homeClaimRoutingService');
const homeClaimCompatService = require('../services/homeClaimCompatService');
const { findHomeOwnerRowForClaimant } = require('../utils/homeOwnerRowLookup');

async function markIncumbentClaimsUpheld({ homeId, claimantId }) {
  const { data: incumbentClaims, error } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id, state, claim_phase_v2, claimant_user_id')
    .eq('home_id', homeId)
    .neq('claimant_user_id', claimantId);

  if (error) throw error;

  const challengeAffectedClaims = (incumbentClaims || []).filter((incumbentClaim) => (
    incumbentClaim.state === 'approved'
    || incumbentClaim.state === 'disputed'
    || incumbentClaim.claim_phase_v2 === 'verified'
    || incumbentClaim.claim_phase_v2 === 'challenged'
  ));

  await Promise.all(challengeAffectedClaims.map(async (incumbentClaim) => {
    const nextState = incumbentClaim.state === 'disputed' ? 'approved' : incumbentClaim.state;

    await supabaseAdmin
      .from('HomeOwnershipClaim')
      .update({
        state: nextState,
        claim_phase_v2: nextState === 'approved' ? 'verified' : null,
        terminal_reason: 'none',
        challenge_state: 'resolved_upheld',
        updated_at: new Date().toISOString(),
      })
      .eq('id', incumbentClaim.id);
  }));
}

// All admin routes require auth + admin role
router.use(verifyToken, requireAdmin);

// ============================================================
// PENDING CLAIMS — List all claims awaiting review
// ============================================================

// Maps the three Review-claims tabs (Pending / Approved / Rejected) to
// the underlying HomeOwnershipClaim.state values. Pending matches the
// historical /pending-claims set so the existing tab keeps the same
// payload after the bucket-based query is introduced.
const BUCKET_STATES = {
  pending: ['submitted', 'pending_review', 'needs_more_info', 'disputed'],
  approved: ['approved'],
  rejected: ['rejected'],
};

async function enrichClaims(claims) {
  const list = claims || [];
  if (list.length === 0) return [];

  const homeIds = [...new Set(list.map(c => c.home_id))];
  const userIds = [...new Set(list.map(c => c.claimant_user_id))];

  let homesMap = {};
  if (homeIds.length > 0) {
    const { data: homes } = await supabaseAdmin
      .from('Home')
      .select('id, address, city, state, zipcode, name')
      .in('id', homeIds);
    for (const h of (homes || [])) {
      homesMap[h.id] = h;
    }
  }

  let usersMap = {};
  if (userIds.length > 0) {
    const { data: users } = await supabaseAdmin
      .from('User')
      .select('id, username, name, email, created_at, profile_picture_url')
      .in('id', userIds);
    for (const u of (users || [])) {
      usersMap[u.id] = u;
    }
  }

  const claimIds = list.map(c => c.id);
  let evidenceCountMap = {};
  if (claimIds.length > 0) {
    const { data: evidenceCounts } = await supabaseAdmin
      .from('HomeVerificationEvidence')
      .select('claim_id')
      .in('claim_id', claimIds);
    for (const e of (evidenceCounts || [])) {
      evidenceCountMap[e.claim_id] = (evidenceCountMap[e.claim_id] || 0) + 1;
    }
  }

  return list.map(c => ({
    ...c,
    home: homesMap[c.home_id] || null,
    claimant: usersMap[c.claimant_user_id] || null,
    evidence_count: evidenceCountMap[c.id] || 0,
  }));
}

/**
 * GET /api/admin/pending-claims
 * Returns all ownership/residency claims in reviewable states across all homes.
 * Kept as an alias for /claims?bucket=pending so existing clients keep working.
 */
router.get('/pending-claims', async (req, res) => {
  try {
    const { data: claims, error } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .select(`
        id,
        home_id,
        claimant_user_id,
        claim_type,
        state,
        claim_phase_v2,
        challenge_state,
        method,
        risk_score,
        created_at,
        updated_at
      `)
      .in('state', BUCKET_STATES.pending)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const enrichedClaims = await enrichClaims(claims);
    res.json({ claims: enrichedClaims, total: enrichedClaims.length });
  } catch (err) {
    logger.error('Admin: Failed to fetch pending claims', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch pending claims' });
  }
});

// ============================================================
// ALL CLAIMS — Tabbed admin queue (pending / approved / rejected)
// ============================================================

/**
 * GET /api/admin/claims
 * Returns claims filtered by `bucket` (pending|approved|rejected) or by
 * a single legacy `state` value. Pending claims are ordered oldest-first
 * (FIFO triage); approved/rejected are ordered newest-first. The
 * response is enriched with home + claimant + evidence_count so the
 * Review-claims admin queue can render rows directly.
 *
 * Query params:
 *   bucket:  pending | approved | rejected (preferred)
 *   state:   raw state value (legacy escape hatch; ignored when bucket set)
 *   limit:   default 50
 *   offset:  default 0
 */
router.get('/claims', async (req, res) => {
  try {
    const { bucket, state, limit = 50, offset = 0 } = req.query;
    const lim = Math.max(1, Math.min(parseInt(limit, 10) || 50, 200));
    const off = Math.max(0, parseInt(offset, 10) || 0);

    const bucketStates = bucket ? BUCKET_STATES[bucket] : null;
    if (bucket && !bucketStates) {
      return res.status(400).json({ error: `Unknown bucket "${bucket}". Expected one of: pending, approved, rejected` });
    }

    let query = supabaseAdmin
      .from('HomeOwnershipClaim')
      .select(`
        id,
        home_id,
        claimant_user_id,
        claim_type,
        state,
        claim_phase_v2,
        challenge_state,
        method,
        risk_score,
        created_at,
        updated_at
      `, { count: 'exact' })
      .order('created_at', { ascending: bucket === 'pending' })
      .range(off, off + lim - 1);

    if (bucketStates) {
      query = query.in('state', bucketStates);
    } else if (state) {
      query = query.eq('state', state);
    }

    const { data: claims, error, count } = await query;
    if (error) throw error;

    const enrichedClaims = await enrichClaims(claims);

    // For the Pending queue banner: surface the age of the oldest claim
    // in the bucket. Claims are ordered ascending for pending so [0] is
    // the oldest; for other buckets it's not surfaced.
    let oldestAgeSeconds = null;
    if (bucket === 'pending' && enrichedClaims.length > 0) {
      const oldestCreatedAt = new Date(enrichedClaims[0].created_at);
      oldestAgeSeconds = Math.max(0, Math.floor((Date.now() - oldestCreatedAt.getTime()) / 1000));
    }

    res.json({
      claims: enrichedClaims,
      total: count || enrichedClaims.length,
      oldest_age_seconds: oldestAgeSeconds,
    });
  } catch (err) {
    logger.error('Admin: Failed to fetch claims', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

/**
 * GET /api/admin/claims/counts
 * Returns the per-bucket totals used by the Review-claims tab strip.
 * Declared before /claims/:claimId so "counts" isn't matched as an id.
 */
router.get('/claims/counts', async (_req, res) => {
  try {
    const counts = { pending: 0, approved: 0, rejected: 0 };

    for (const [bucket, states] of Object.entries(BUCKET_STATES)) {
      const { count, error } = await supabaseAdmin
        .from('HomeOwnershipClaim')
        .select('id', { count: 'exact', head: true })
        .in('state', states);

      if (error) throw error;
      counts[bucket] = count || 0;
    }

    res.json(counts);
  } catch (err) {
    logger.error('Admin: Failed to fetch claim counts', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch claim counts' });
  }
});

// ============================================================
// CLAIM DETAIL — View a specific claim + its evidence
// ============================================================

/**
 * GET /api/admin/claims/:claimId
 * Returns full claim details with evidence files and presigned download URLs.
 */
router.get('/claims/:claimId', async (req, res) => {
  try {
    const { claimId } = req.params;

    const { data: claim, error } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .select('*')
      .eq('id', claimId)
      .single();

    if (error || !claim) return res.status(404).json({ error: 'Claim not found' });

    // Get home info
    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('id, address, city, state, zipcode, name, home_type, security_state, tenure_mode')
      .eq('id', claim.home_id)
      .single();

    // Get claimant info
    const { data: claimant } = await supabaseAdmin
      .from('User')
      .select('id, username, name, email, created_at, profile_picture_url')
      .eq('id', claim.claimant_user_id)
      .single();

    // Get all evidence with presigned URLs for viewing
    const { data: evidenceRows } = await supabaseAdmin
      .from('HomeVerificationEvidence')
      .select('*')
      .eq('claim_id', claimId)
      .order('created_at', { ascending: false });

    const evidence = [];
    for (const ev of (evidenceRows || [])) {
      let viewUrl = null;
      // Try to get a presigned URL from the storage_ref (S3 key)
      if (ev.storage_ref) {
        try {
          viewUrl = await s3.getPresignedDownloadUrl(ev.storage_ref, 3600);
        } catch {
          // Fall back to the metadata URL
          viewUrl = ev.metadata?.file_url || null;
        }
      } else if (ev.metadata?.file_url) {
        viewUrl = ev.metadata.file_url;
      }

      evidence.push({
        id: ev.id,
        evidence_type: ev.evidence_type,
        provider: ev.provider,
        status: ev.status,
        storage_ref: ev.storage_ref,
        file_url: viewUrl,
        file_name: ev.metadata?.file_name || null,
        file_size: ev.metadata?.file_size || null,
        mime_type: ev.metadata?.mime_type || null,
        created_at: ev.created_at,
      });
    }

    res.json({
      claim,
      home,
      claimant,
      evidence,
    });
  } catch (err) {
    logger.error('Admin: Failed to fetch claim detail', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch claim detail' });
  }
});

// ============================================================
// REVIEW CLAIM — Approve, reject, or flag a claim
// ============================================================

/**
 * POST /api/admin/claims/:claimId/review
 * Admin reviews a claim: approve, reject, or request_more_info.
 * On approve, marks evidence as verified, promotes HomeOwner, activates occupancy.
 */
router.post('/claims/:claimId/review', async (req, res) => {
  try {
    const { claimId } = req.params;
    const adminUserId = req.user.id;
    const { action, note } = req.body;

    if (!['approve', 'reject', 'request_more_info'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be: approve, reject, or request_more_info' });
    }

    const { data: claim, error: claimErr } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .select('*')
      .eq('id', claimId)
      .single();

    if (claimErr || !claim) return res.status(404).json({ error: 'Claim not found' });

    const reviewableStates = ['submitted', 'pending_review', 'needs_more_info', 'pending_challenge_window', 'disputed'];
    if (!reviewableStates.includes(claim.state)) {
      return res.status(400).json({ error: `Claim is in state "${claim.state}" which cannot be reviewed` });
    }

    const homeId = claim.home_id;
    const claimantId = claim.claimant_user_id;

    const isChallengeReview = (
      claim.state === 'disputed'
      || claim.claim_phase_v2 === 'challenged'
      || claim.challenge_state === 'challenged'
      || claim.routing_classification === 'challenge_claim'
    );

    // Determine new state
    let newState;
    if (action === 'approve') newState = 'approved';
    else if (action === 'reject') newState = 'rejected';
    else newState = 'needs_more_info';

    // Update claim state
    await supabaseAdmin
      .from('HomeOwnershipClaim')
      .update({
        state: newState,
        reviewed_by: adminUserId,
        reviewed_at: new Date().toISOString(),
        review_note: note || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', claimId);

    const compatibilityTerminalReason = action === 'reject' ? 'rejected_review' : 'none';
    const compatibilityClaimPhaseV2 =
      action === 'request_more_info' && isChallengeReview ? 'challenged' : null;
    const compatibilityChallengeState =
      action === 'request_more_info' && isChallengeReview ? 'challenged' : 'none';

    await homeClaimCompatService.updateClaimCompatibilityFields({
      claimId,
      legacyState: newState,
      claimPhaseV2: compatibilityClaimPhaseV2,
      terminalReason: compatibilityTerminalReason,
      challengeState: compatibilityChallengeState,
    });

    const result = { action, newState, claimId, homeId };

    if (action === 'approve') {
      // --- Mark all evidence as verified ---
      await supabaseAdmin
        .from('HomeVerificationEvidence')
        .update({ status: 'verified' })
        .eq('claim_id', claimId)
        .eq('status', 'pending');

      await homeClaimCompatService.updateClaimCompatibilityFields({
        claimId,
        legacyState: newState,
        terminalReason: 'none',
        challengeState: 'none',
        syncClaimStrength: true,
      });

      // --- Determine verification tier from evidence ---
      const { data: evidenceRows } = await supabaseAdmin
        .from('HomeVerificationEvidence')
        .select('evidence_type')
        .eq('claim_id', claimId);

      let tier = 'weak';
      const strongTypes = ['escrow_attestation', 'title_match'];
      const ownerStandardTypes = ['deed', 'closing_disclosure', 'tax_bill'];
      const residencyTypes = ['lease', 'utility_bill'];
      for (const ev of (evidenceRows || [])) {
        if (strongTypes.includes(ev.evidence_type)) { tier = 'strong'; break; }
        if (ownerStandardTypes.includes(ev.evidence_type) && tier !== 'strong') tier = 'standard';
        if (residencyTypes.includes(ev.evidence_type) && tier === 'weak') tier = 'standard';
      }

      const isOwnerClaim = claim.claim_type === 'owner' || claim.claim_type === 'admin';

      if (isOwnerClaim) {
        // --- Promote HomeOwner to verified (reactivate revoked row if present — no duplicate rows) ---
        const existingOwnerRow = await findHomeOwnerRowForClaimant(
          supabaseAdmin,
          homeId,
          claimantId,
        );

        // Get existing verified owners for primary detection
        const { data: verifiedOwners } = await supabaseAdmin
          .from('HomeOwner')
          .select('id')
          .eq('home_id', homeId)
          .eq('owner_status', 'verified');
        const isPrimary = !verifiedOwners || verifiedOwners.length === 0;

        if (existingOwnerRow) {
          await supabaseAdmin
            .from('HomeOwner')
            .update({
              owner_status: 'verified',
              is_primary_owner: isPrimary,
              verification_tier: tier,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingOwnerRow.id);
        } else {
          await supabaseAdmin
            .from('HomeOwner')
            .insert({
              home_id: homeId,
              subject_type: 'user',
              subject_id: claimantId,
              owner_status: 'verified',
              is_primary_owner: isPrimary,
              added_via: 'claim',
              verification_tier: tier,
            });
        }

        // --- Upgrade/create HomeOccupancy for owners (via centralized gateway) ---
        const occupancyAttachService = require('../services/occupancyAttachService');
        await occupancyAttachService.attach({
          homeId,
          userId: claimantId,
          method: 'admin_override',
          claimType: 'owner',
          roleOverride: 'owner',
          actorId: req.user.id,
          metadata: { source: 'admin_claim_approval', claim_id: claimId, tier },
        });

        await supabaseAdmin
          .from('Home')
          .update({
            owner_id: claimantId,
            ownership_state: 'owner_verified',
            updated_at: new Date().toISOString(),
          })
          .eq('id', homeId);

        result.ownerStatus = 'verified';
        result.tier = tier;
      } else {
        // --- Residency claim: activate occupancy (via centralized gateway) ---
        const occupancyAttachService = require('../services/occupancyAttachService');
        await occupancyAttachService.attach({
          homeId,
          userId: claimantId,
          method: 'admin_override',
          claimType: 'resident',
          actorId: req.user.id,
          metadata: { source: 'admin_claim_approval', claim_id: claimId },
        });

        result.residencyStatus = 'verified';
      }

      // Intentionally do not revoke other verified owners when a challenge claim is approved.
      // Multiple verified owners may coexist; conflict resolution is deferred to higher-level flows.

      // Send notification to claimant
      try {
        const { notifyOwnershipClaimApproved } = require('../services/notificationService');
        const { data: home } = await supabaseAdmin
          .from('Home')
          .select('name, address')
          .eq('id', homeId)
          .single();
        await notifyOwnershipClaimApproved({
          userId: claimantId,
          homeName: home?.name || home?.address || 'your home',
          homeId,
        });
      } catch {
        // Non-fatal
      }
    }

    if (action === 'reject') {
      if (isChallengeReview) {
        await markIncumbentClaimsUpheld({ homeId, claimantId });
        result.challengeResolved = 'incumbent_upheld';
      }

      // Send notification to claimant
      try {
        const { notifyOwnershipClaimRejected } = require('../services/notificationService');
        const { data: home } = await supabaseAdmin
          .from('Home')
          .select('name, address')
          .eq('id', homeId)
          .single();
        await notifyOwnershipClaimRejected({
          userId: claimantId,
          homeName: home?.name || home?.address || 'your home',
          homeId,
          reason: note || undefined,
        });
      } catch {
        // Non-fatal
      }
    }

    if (action === 'request_more_info') {
      // Notify claimant so they see it in the bell and can open the dashboard to upload proof again
      try {
        const { notifyOwnershipClaimNeedsMoreInfo } = require('../services/notificationService');
        const { data: home } = await supabaseAdmin
          .from('Home')
          .select('name, address')
          .eq('id', homeId)
          .single();
        await notifyOwnershipClaimNeedsMoreInfo({
          userId: claimantId,
          homeName: home?.name || home?.address || 'your home',
          homeId,
        });
      } catch {
        // Non-fatal
      }
    }

    logger.info('Admin claim review', { adminUserId, claimId, action, newState });

    await homeClaimRoutingService.recalculateHomeResolutionState(homeId);
    await homeClaimRoutingService.reconcileOperationalDisputeState(homeId, { force: isChallengeReview });

    res.json({
      message: `Claim ${action === 'request_more_info' ? 'sent back for more info' : action + 'd'} successfully`,
      ...result,
    });
  } catch (err) {
    logger.error('Admin: Failed to review claim', { error: err.message });
    res.status(500).json({ error: 'Failed to review claim' });
  }
});

module.exports = router;
