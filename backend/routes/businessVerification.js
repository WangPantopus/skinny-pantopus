/**
 * Business Verification Routes
 *
 * Self-attestation, evidence upload, status, and review endpoints.
 * Mount at: app.use('/api/businesses', require('./routes/businessVerification'));
 *
 * Endpoints:
 *   POST /:businessId/verify/self-attest       — Self-attest business identity
 *   POST /:businessId/verify/upload-evidence    — Upload verification evidence
 *   GET  /:businessId/verify/status             — Get verification status + history
 *   POST /:businessId/verify/review             — Review pending evidence (platform admin only)
 */

const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const logger = require('../utils/logger');
const {
  checkBusinessPermission,
  writeAuditLog,
} = require('../utils/businessPermissions');
const { calculateAndStoreCompleteness } = require('../utils/businessCompleteness');
const { VERIFICATION_RANK } = require('../utils/businessConstants');
const { requireAdmin } = require('../middleware/verifyToken');

const VALID_EVIDENCE_TYPES = ['business_license', 'ein_letter', 'utility_bill', 'state_registration', 'ein_verification', 'tax_exempt_letter'];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


// ============================================================
// POST /:businessId/verify/self-attest
// ============================================================

router.post('/:businessId/verify/self-attest', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'profile.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to edit profile' });
    }

    const { legal_name, address_confirmed } = req.body;

    // Validation
    if (!legal_name || typeof legal_name !== 'string' || legal_name.trim().length === 0) {
      return res.status(400).json({ error: 'legal_name is required and must be a non-empty string' });
    }
    if (address_confirmed !== true) {
      return res.status(400).json({ error: 'address_confirmed must be true' });
    }

    // Pre-check: require at least one active geocoded location
    const { count: locationCount } = await supabaseAdmin
      .from('BusinessLocation')
      .select('id', { count: 'exact', head: true })
      .eq('business_user_id', businessId)
      .eq('is_active', true)
      .not('location', 'is', null);

    if (!locationCount || locationCount === 0) {
      return res.status(400).json({
        error: 'At least one verified location is required before self-attestation',
        code: 'NO_VERIFIED_LOCATION',
      });
    }

    // Check current verification status
    const { data: profile } = await supabaseAdmin
      .from('BusinessProfile')
      .select('verification_status')
      .eq('business_user_id', businessId)
      .single();

    const currentStatus = profile?.verification_status || 'unverified';

    // Idempotent: if already self_attested or higher, return current status
    if (VERIFICATION_RANK[currentStatus] >= VERIFICATION_RANK.self_attested) {
      return res.status(200).json({
        verification_status: currentStatus,
        message: 'Business is already verified at this level or higher',
      });
    }

    // Upsert BusinessPrivate.legal_name
    const { data: existingPrivate } = await supabaseAdmin
      .from('BusinessPrivate')
      .select('business_user_id')
      .eq('business_user_id', businessId)
      .maybeSingle();

    if (existingPrivate) {
      await supabaseAdmin
        .from('BusinessPrivate')
        .update({ legal_name: legal_name.trim(), updated_at: new Date().toISOString() })
        .eq('business_user_id', businessId);
    } else {
      await supabaseAdmin
        .from('BusinessPrivate')
        .insert({ business_user_id: businessId, legal_name: legal_name.trim() });
    }

    // Insert evidence record
    const now = new Date().toISOString();
    const { data: evidence, error: evidenceErr } = await supabaseAdmin
      .from('BusinessVerificationEvidence')
      .insert({
        business_user_id: businessId,
        evidence_type: 'self_attestation',
        status: 'approved',
        metadata: {
          legal_name: legal_name.trim(),
          address_confirmed,
          attested_at: now,
        },
        reviewed_at: now,
        reviewed_by: userId,
      })
      .select()
      .single();

    if (evidenceErr) {
      logger.error('Error inserting self-attestation evidence', { error: evidenceErr.message, businessId });
      return res.status(500).json({ error: 'Failed to save attestation' });
    }

    // Update profile verification status
    const { error: profileErr } = await supabaseAdmin
      .from('BusinessProfile')
      .update({
        verification_status: 'self_attested',
        verification_tier: 'self_attested',
        updated_at: now,
      })
      .eq('business_user_id', businessId);

    if (profileErr) {
      logger.error('Error updating verification status', { error: profileErr.message, businessId });
      return res.status(500).json({ error: 'Failed to update verification status' });
    }

    // Recalculate completeness
    calculateAndStoreCompleteness(businessId).catch((err) => {
      logger.error('Post-self-attest completeness calculation failed', { businessId, error: err.message });
    });

    await writeAuditLog(businessId, userId, 'self_attest', 'BusinessVerificationEvidence', evidence.id, {
      legal_name: legal_name.trim(),
      address_confirmed,
    });

    res.status(200).json({
      verification_status: 'self_attested',
      message: 'Business self-attestation complete',
    });
  } catch (err) {
    logger.error('Self-attest error', { error: err.message, businessId: req.params.businessId });
    res.status(500).json({ error: 'Failed to process self-attestation' });
  }
});


// ============================================================
// POST /:businessId/verify/upload-evidence
// ============================================================

router.post('/:businessId/verify/upload-evidence', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'profile.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to edit profile' });
    }

    const { evidence_type, file_id } = req.body;

    // Validation
    if (!evidence_type || !VALID_EVIDENCE_TYPES.includes(evidence_type)) {
      return res.status(400).json({
        error: `evidence_type must be one of: ${VALID_EVIDENCE_TYPES.join(', ')}`,
      });
    }
    if (!file_id || typeof file_id !== 'string' || !UUID_REGEX.test(file_id)) {
      return res.status(400).json({ error: 'file_id must be a valid UUID' });
    }

    // Check for duplicate pending evidence of same type
    const { data: pendingEvidence } = await supabaseAdmin
      .from('BusinessVerificationEvidence')
      .select('id')
      .eq('business_user_id', businessId)
      .eq('evidence_type', evidence_type)
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingEvidence) {
      return res.status(409).json({
        error: 'Evidence of this type is already pending review',
        code: 'DUPLICATE_PENDING',
      });
    }

    // Check for already-approved evidence of same type
    const { data: approvedEvidence } = await supabaseAdmin
      .from('BusinessVerificationEvidence')
      .select('id')
      .eq('business_user_id', businessId)
      .eq('evidence_type', evidence_type)
      .eq('status', 'approved')
      .maybeSingle();

    if (approvedEvidence) {
      return res.status(409).json({
        error: 'This evidence type has already been verified',
        code: 'ALREADY_VERIFIED',
      });
    }

    // Insert evidence
    const { data: evidence, error: insertErr } = await supabaseAdmin
      .from('BusinessVerificationEvidence')
      .insert({
        business_user_id: businessId,
        evidence_type,
        file_id,
        status: 'pending',
      })
      .select()
      .single();

    if (insertErr) {
      logger.error('Error inserting verification evidence', { error: insertErr.message, businessId });
      return res.status(500).json({ error: 'Failed to submit evidence' });
    }

    await writeAuditLog(businessId, userId, 'upload_verification_evidence', 'BusinessVerificationEvidence', evidence.id, {
      evidence_type,
    });

    res.status(201).json({
      evidence_id: evidence.id,
      status: 'pending',
      message: 'Evidence submitted for review',
    });
  } catch (err) {
    logger.error('Upload evidence error', { error: err.message, businessId: req.params.businessId });
    res.status(500).json({ error: 'Failed to submit evidence' });
  }
});


// ============================================================
// GET /:businessId/verify/status
// ============================================================

router.get('/:businessId/verify/status', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No access to this business' });
    }

    const [{ data: profile }, { data: evidenceRows }, { count: geocodedLocationCount }] = await Promise.all([
      supabaseAdmin
        .from('BusinessProfile')
        .select('verification_status, verification_tier, verified_at, business_type, attributes')
        .eq('business_user_id', businessId)
        .single(),
      supabaseAdmin
        .from('BusinessVerificationEvidence')
        .select('id, evidence_type, status, created_at, reviewed_at')
        .eq('business_user_id', businessId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('BusinessLocation')
        .select('id', { count: 'exact', head: true })
        .eq('business_user_id', businessId)
        .eq('is_active', true)
        .not('location', 'is', null),
    ]);

    const verificationStatus = profile?.verification_status || 'unverified';
    const evidence = (evidenceRows || []).map((r) => ({
      id: r.id,
      type: r.evidence_type,
      status: r.status,
      created_at: r.created_at,
      reviewed_at: r.reviewed_at,
    }));

    const hasPending = evidence.some((e) => e.status === 'pending');
    const hasGeocodedLocation = (geocodedLocationCount || 0) > 0;
    const canSelfAttest = verificationStatus === 'unverified' && hasGeocodedLocation;

    const response = {
      verification_status: verificationStatus,
      verification_tier: profile?.verification_tier || 'unverified',
      verified_at: profile?.verified_at || null,
      evidence,
      can_self_attest: canSelfAttest,
      can_self_attest_reason: !canSelfAttest && verificationStatus === 'unverified' && !hasGeocodedLocation
        ? 'At least one geocoded location is required' : undefined,
      can_upload_evidence: verificationStatus !== 'government_verified' && !hasPending,
    };

    // Nonprofit 501(c)(3) verification section
    if (profile?.business_type === 'nonprofit_501c3') {
      const einEvidence = evidence.filter(
        (e) => e.type === 'ein_verification' || e.type === 'tax_exempt_letter'
      );
      const einApproved = einEvidence.some((e) => e.status === 'approved');
      const einPending = einEvidence.some((e) => e.status === 'pending');
      const awaitingVerification = !!(profile.attributes?.awaiting_nonprofit_verification);

      response.nonprofit_verification = {
        ein_submitted: einEvidence.length > 0,
        ein_approved: einApproved,
        ein_pending: einPending,
        awaiting_verification: awaitingVerification,
        evidence: einEvidence,
      };
    }

    res.json(response);
  } catch (err) {
    logger.error('Verification status error', { error: err.message, businessId: req.params.businessId });
    res.status(500).json({ error: 'Failed to fetch verification status' });
  }
});


// ============================================================
// POST /:businessId/verify/review
// ============================================================

router.post('/:businessId/verify/review', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const { evidence_id, decision, notes } = req.body;

    // Validation
    if (!evidence_id || typeof evidence_id !== 'string' || !UUID_REGEX.test(evidence_id)) {
      return res.status(400).json({ error: 'evidence_id must be a valid UUID' });
    }
    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    }

    // Fetch evidence row
    const { data: evidence, error: fetchErr } = await supabaseAdmin
      .from('BusinessVerificationEvidence')
      .select('id, business_user_id, status')
      .eq('id', evidence_id)
      .single();

    if (fetchErr || !evidence) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    if (evidence.business_user_id !== businessId) {
      return res.status(403).json({ error: 'Evidence does not belong to this business' });
    }

    if (evidence.status !== 'pending') {
      return res.status(400).json({ error: `Evidence has already been ${evidence.status}` });
    }

    // Update evidence
    const now = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
      .from('BusinessVerificationEvidence')
      .update({
        status: decision,
        reviewed_at: now,
        reviewed_by: userId,
        reviewer_notes: notes || null,
      })
      .eq('id', evidence_id);

    if (updateErr) {
      logger.error('Error updating evidence status', { error: updateErr.message, evidence_id });
      return res.status(500).json({ error: 'Failed to review evidence' });
    }

    let currentVerificationStatus = null;

    // If approved, upgrade verification status
    if (decision === 'approved') {
      const { error: profileErr } = await supabaseAdmin
        .from('BusinessProfile')
        .update({
          verification_status: 'document_verified',
          verification_tier: 'document_verified',
          verified_at: now,
          verified_by: userId,
          updated_at: now,
        })
        .eq('business_user_id', businessId);

      if (profileErr) {
        logger.error('Error updating profile verification after review', { error: profileErr.message, businessId });
      }

      currentVerificationStatus = 'document_verified';

      calculateAndStoreCompleteness(businessId).catch((err) => {
        logger.error('Post-review completeness calculation failed', { businessId, error: err.message });
      });
    } else {
      // Fetch current status for response
      const { data: profile } = await supabaseAdmin
        .from('BusinessProfile')
        .select('verification_status')
        .eq('business_user_id', businessId)
        .single();
      currentVerificationStatus = profile?.verification_status || 'unverified';
    }

    await writeAuditLog(businessId, userId, 'review_verification', 'BusinessVerificationEvidence', evidence_id, {
      evidence_id,
      decision,
      notes: notes || null,
    });

    res.status(200).json({
      verification_status: currentVerificationStatus,
      evidence_status: decision,
    });
  } catch (err) {
    logger.error('Review verification error', { error: err.message, businessId: req.params.businessId });
    res.status(500).json({ error: 'Failed to review evidence' });
  }
});


module.exports = router;
