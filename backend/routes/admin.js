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
const homeClaimReviewService = require('../services/homeClaimReviewService');
const funnelReport = require('../services/funnelReport');

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
// ── GET /funnel/summary?days=30 — the wedge ladder read-out ──
// Previews → aha → share → wall → register → account, per distinct
// visitor, overall and split by the ?r= route on the beacons. Nothing
// identifying comes back: anon ids are counted, never listed.
router.get('/funnel/summary', async (req, res) => {
  try {
    res.json(await funnelReport.loadFunnelSummary({ days: req.query.days }));
  } catch (err) {
    logger.error('admin.funnel.summary.error', { error: err.message });
    res.status(500).json({ error: 'Failed to build the funnel summary' });
  }
});

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
    const result = await homeClaimReviewService.read({ claimId: req.params.claimId, actorId: req.user.id, platformAdmin: true });
    res.json({ claim: result.claim, home: result.home, claimant: result.claimant, evidence: result.evidence });
  } catch (error) { homeClaimReviewService.sendError(res, error); }
});

router.post('/claims/:claimId/review', async (req, res) => {
  if (!['approve', 'reject', 'request_more_info'].includes(req.body.action)) {
    return res.status(400).json({ error: 'Invalid claim review action.' });
  }
  try {
    const result = await homeClaimReviewService.mutate({ claimId: req.params.claimId, actorId: req.user.id,
      action: req.body.action, reviewToken: req.body.review_token, note: req.body.note, platformAdmin: true });
    res.json({ ...result, message: 'Claim review saved.' });
  } catch (error) { homeClaimReviewService.sendError(res, error); }
});

module.exports = router;
