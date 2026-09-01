/**
 * Admin Verification Queue Routes
 *
 * Platform admin endpoints for reviewing business verification evidence.
 * Mount at: app.use('/api/admin/verification', require('./routes/adminVerification'));
 *
 * Endpoints:
 *   GET  /queue                    — List pending verification evidence
 *   POST /:evidenceId/approve      — Approve evidence, upgrade business to document_verified
 *   POST /:evidenceId/reject       — Reject evidence
 */

const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const { requireAdmin } = require('../middleware/verifyToken');
const logger = require('../utils/logger');
const { writeAuditLog } = require('../utils/businessPermissions');
const { calculateAndStoreCompleteness } = require('../utils/businessCompleteness');
const { setEntityFeeOverride } = require('../services/businessEntityService');

// All routes require auth + admin role
router.use(verifyToken, requireAdmin);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


// ============================================================
// GET /queue — List pending verification evidence
// ============================================================

router.get('/queue', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    const { data: evidence, error, count } = await supabaseAdmin
      .from('BusinessVerificationEvidence')
      .select(`
        id,
        business_user_id,
        evidence_type,
        file_id,
        status,
        metadata,
        created_at
      `, { count: 'exact' })
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Admin verification queue query failed', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch verification queue' });
    }

    // Fetch business info for each unique business_user_id
    const bizIds = [...new Set((evidence || []).map(e => e.business_user_id))];
    let businessMap = {};

    if (bizIds.length > 0) {
      const { data: businesses } = await supabaseAdmin
        .from('User')
        .select('id, username, name, profile_picture_url')
        .in('id', bizIds);

      for (const b of (businesses || [])) {
        businessMap[b.id] = { id: b.id, username: b.username, name: b.name, profile_picture_url: b.profile_picture_url };
      }
    }

    const items = (evidence || []).map(e => ({
      id: e.id,
      business_user_id: e.business_user_id,
      business: businessMap[e.business_user_id] || null,
      evidence_type: e.evidence_type,
      file_id: e.file_id,
      metadata: e.metadata,
      created_at: e.created_at,
    }));

    res.json({
      items,
      total: count || 0,
      limit,
      offset,
    });
  } catch (err) {
    logger.error('Admin verification queue error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch verification queue' });
  }
});


// ============================================================
// POST /:evidenceId/approve — Approve evidence
// ============================================================

router.post('/:evidenceId/approve', async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const adminUserId = req.user.id;
    const { notes } = req.body;

    if (!UUID_REGEX.test(evidenceId)) {
      return res.status(400).json({ error: 'Invalid evidence ID' });
    }

    const result = await reviewEvidence(evidenceId, 'approved', adminUserId, notes);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result.data);
  } catch (err) {
    logger.error('Admin approve evidence error', { error: err.message });
    res.status(500).json({ error: 'Failed to approve evidence' });
  }
});


// ============================================================
// POST /:evidenceId/reject — Reject evidence
// ============================================================

router.post('/:evidenceId/reject', async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const adminUserId = req.user.id;
    const { notes } = req.body;

    if (!UUID_REGEX.test(evidenceId)) {
      return res.status(400).json({ error: 'Invalid evidence ID' });
    }

    const result = await reviewEvidence(evidenceId, 'rejected', adminUserId, notes);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result.data);
  } catch (err) {
    logger.error('Admin reject evidence error', { error: err.message });
    res.status(500).json({ error: 'Failed to reject evidence' });
  }
});


// ============================================================
// Shared review logic
// ============================================================

async function reviewEvidence(evidenceId, decision, adminUserId, notes) {
  // Fetch evidence row
  const { data: evidence, error: fetchErr } = await supabaseAdmin
    .from('BusinessVerificationEvidence')
    .select('id, business_user_id, status, evidence_type')
    .eq('id', evidenceId)
    .single();

  if (fetchErr || !evidence) {
    return { error: 'Evidence not found', status: 404 };
  }

  if (evidence.status !== 'pending') {
    return { error: `Evidence has already been ${evidence.status}`, status: 400 };
  }

  const businessId = evidence.business_user_id;
  const now = new Date().toISOString();

  // Update evidence status
  const { error: updateErr } = await supabaseAdmin
    .from('BusinessVerificationEvidence')
    .update({
      status: decision,
      reviewed_at: now,
      reviewed_by: adminUserId,
      reviewer_notes: notes || null,
    })
    .eq('id', evidenceId);

  if (updateErr) {
    logger.error('Error updating evidence status', { error: updateErr.message, evidenceId });
    return { error: 'Failed to update evidence', status: 500 };
  }

  let verificationStatus = null;

  if (decision === 'approved') {
    // Upgrade business verification status to document_verified
    const { error: profileErr } = await supabaseAdmin
      .from('BusinessProfile')
      .update({
        verification_status: 'document_verified',
        verification_tier: 'document_verified',
        verified_at: now,
        verified_by: adminUserId,
        updated_at: now,
      })
      .eq('business_user_id', businessId);

    if (profileErr) {
      logger.error('Error updating profile verification after admin review', { error: profileErr.message, businessId });
    }

    verificationStatus = 'document_verified';

    // Nonprofit EIN/tax-exempt approval: set fee to 0% and clear awaiting flag
    if (evidence.evidence_type === 'ein_verification' || evidence.evidence_type === 'tax_exempt_letter') {
      const { data: bizProfile } = await supabaseAdmin
        .from('BusinessProfile')
        .select('business_type, attributes')
        .eq('business_user_id', businessId)
        .maybeSingle();

      if (bizProfile?.business_type === 'nonprofit_501c3') {
        // Set fee to 0% for verified nonprofits
        await setEntityFeeOverride(businessId, 0, { actorUserId: adminUserId, force: true });

        // Clear awaiting_nonprofit_verification flag
        const attrs = bizProfile.attributes || {};
        delete attrs.awaiting_nonprofit_verification;
        await supabaseAdmin
          .from('BusinessProfile')
          .update({ attributes: attrs, updated_at: now })
          .eq('business_user_id', businessId);

        // Create in-app notification for the business owner
        try {
          const { data: owner } = await supabaseAdmin
            .from('BusinessTeam')
            .select('user_id')
            .eq('business_user_id', businessId)
            .eq('role_base', 'owner')
            .eq('is_active', true)
            .maybeSingle();

          if (owner) {
            await supabaseAdmin
              .from('Notification')
              .insert({
                user_id: owner.user_id,
                type: 'nonprofit_verified',
                title: 'Nonprofit Status Verified',
                body: 'Your 501(c)(3) nonprofit status has been verified. Your platform fee is now 0%.',
                metadata: { business_user_id: businessId, fee_override_pct: 0 },
              });
          }
        } catch (notifErr) {
          logger.warn('Failed to send nonprofit verification notification', {
            businessId, error: notifErr.message,
          });
        }

        logger.info('Nonprofit EIN approved: fee set to 0%, awaiting flag cleared', { businessId });
      }
    }

    calculateAndStoreCompleteness(businessId).catch((err) => {
      logger.error('Post-admin-review completeness calculation failed', { businessId, error: err.message });
    });
  } else {
    // Fetch current status for response
    const { data: profile } = await supabaseAdmin
      .from('BusinessProfile')
      .select('verification_status')
      .eq('business_user_id', businessId)
      .single();
    verificationStatus = profile?.verification_status || 'unverified';
  }

  await writeAuditLog(businessId, adminUserId, 'admin_review_verification', 'BusinessVerificationEvidence', evidenceId, {
    evidence_id: evidenceId,
    evidence_type: evidence.evidence_type,
    decision,
    notes: notes || null,
  });

  return {
    data: {
      verification_status: verificationStatus,
      evidence_status: decision,
    },
  };
}


// ============================================================
// GET /businesses/:businessId/fee-override — Get current fee override
// ============================================================

router.get('/businesses/:businessId/fee-override', async (req, res) => {
  try {
    const { businessId } = req.params;

    if (!UUID_REGEX.test(businessId)) {
      return res.status(400).json({ error: 'Invalid business ID' });
    }

    const { data: profile, error } = await supabaseAdmin
      .from('BusinessProfile')
      .select('fee_override_pct')
      .eq('business_user_id', businessId)
      .maybeSingle();

    if (error) {
      logger.error('Admin get fee override error', { error: error.message, businessId });
      return res.status(500).json({ error: 'Failed to fetch fee override' });
    }

    if (!profile) {
      return res.status(404).json({ error: 'Business profile not found' });
    }

    res.json({
      business_user_id: businessId,
      fee_override_pct: profile.fee_override_pct,
      effective_fee_pct: profile.fee_override_pct !== null ? Number(profile.fee_override_pct) : 15,
    });
  } catch (err) {
    logger.error('Admin get fee override error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch fee override' });
  }
});


// ============================================================
// PATCH /businesses/:businessId/fee-override — Set or clear fee override
// ============================================================

router.patch('/businesses/:businessId/fee-override', async (req, res) => {
  try {
    const { businessId } = req.params;
    const adminUserId = req.user.id;

    if (!UUID_REGEX.test(businessId)) {
      return res.status(400).json({ error: 'Invalid business ID' });
    }

    const { fee_override_pct } = req.body;

    // Validate: must be null (reset to default) or a number 0-100
    if (fee_override_pct !== null && fee_override_pct !== undefined) {
      const pct = Number(fee_override_pct);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ error: 'fee_override_pct must be null or a number between 0 and 100' });
      }
    }

    const newValue = fee_override_pct === null || fee_override_pct === undefined ? null : Number(fee_override_pct);

    const { error: updateErr } = await supabaseAdmin
      .from('BusinessProfile')
      .update({
        fee_override_pct: newValue,
        updated_at: new Date().toISOString(),
      })
      .eq('business_user_id', businessId);

    if (updateErr) {
      logger.error('Admin set fee override error', { error: updateErr.message, businessId });
      return res.status(500).json({ error: 'Failed to update fee override' });
    }

    await writeAuditLog(businessId, adminUserId, 'set_fee_override', 'BusinessProfile', businessId, {
      fee_override_pct: newValue,
    });

    res.json({
      message: newValue !== null ? `Fee override set to ${newValue}%` : 'Fee override cleared (using platform default)',
      business_user_id: businessId,
      fee_override_pct: newValue,
      effective_fee_pct: newValue !== null ? newValue : 15,
    });
  } catch (err) {
    logger.error('Admin set fee override error', { error: err.message });
    res.status(500).json({ error: 'Failed to update fee override' });
  }
});


module.exports = router;
