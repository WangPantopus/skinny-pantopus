// ============================================================
// RESIDENCY CLAIM ROUTES (Wave 1 — Residency Pass)
//
// Scoped, expiring, revocable residency claims for T4 residents:
//   POST /api/homes/:id/residency-claims                 issue (T4 only)
//   GET  /api/homes/:id/residency-claims                 my claims here
//   GET  /api/homes/:id/residency-claims/:claimId/views  audit trail
//   POST /api/homes/:id/residency-claims/:claimId/revoke
//
// Mounted at /api/homes BEFORE the generic home router, exactly like
// residencyLetters. Thin by design: auth + permission gates here,
// lifecycle in residencyClaimService.
//
// Gates mirror letters:
//   * every route needs home access (checkHomePermission);
//   * ISSUING needs verified occupancy (T4) — ownership alone is not
//     residency;
//   * claims are personal: list/views/revoke are scoped to the issuing
//     user inside the service.
//
// The public third-party check lives in routes/public.js
// (GET /api/public/residency-claims/:code).
// ============================================================

const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/verifyToken');
const { residencyClaimIssueLimiter } = require('../middleware/rateLimiter');
const { checkHomePermission, isVerifiedResident } = require('../utils/homePermissions');
const residencyClaimService = require('../services/residencyClaimService');
const logger = require('../utils/logger');


// POST /api/homes/:id/residency-claims — issue
router.post('/:id/residency-claims', verifyToken, residencyClaimIssueLimiter, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const access = await checkHomePermission(id, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this place.' });
    }
    if (!isVerifiedResident(access)) {
      return res.status(403).json({
        error: 'Verify your address to issue a residency claim.',
        code: 'VERIFICATION_REQUIRED',
      });
    }

    const claim = await residencyClaimService.issueClaim({
      homeId: id,
      userId,
      scope: req.body && req.body.scope,
      expiresInDays: req.body && req.body.expires_in_days,
    });
    return res.status(201).json({ claim });
  } catch (err) {
    if (err instanceof residencyClaimService.ClaimError) {
      const status = err.code === 'SCOPE_UNAVAILABLE' ? 422 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    logger.error('residencyClaim: issue failed', { homeId: id, userId, error: err.message });
    return res.status(500).json({ error: 'Could not issue the claim. Try again.' });
  }
});

// GET /api/homes/:id/residency-claims — the caller's claims for this home
router.get('/:id/residency-claims', verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const access = await checkHomePermission(id, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this place.' });
    }
    const claims = await residencyClaimService.listClaims({ homeId: id, userId });
    return res.json({ claims });
  } catch (err) {
    logger.error('residencyClaim: list failed', { homeId: id, userId, error: err.message });
    return res.status(500).json({ error: 'Could not load your claims.' });
  }
});

// GET /api/homes/:id/residency-claims/:claimId/views — the audit trail
router.get('/:id/residency-claims/:claimId/views', verifyToken, async (req, res) => {
  const { id, claimId } = req.params;
  const userId = req.user.id;
  try {
    const access = await checkHomePermission(id, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this place.' });
    }
    const views = await residencyClaimService.listClaimViews({ homeId: id, userId, claimId });
    if (views === null) {
      return res.status(404).json({ error: 'Claim not found.' });
    }
    return res.json({ views });
  } catch (err) {
    logger.error('residencyClaim: views failed', { homeId: id, claimId, error: err.message });
    return res.status(500).json({ error: 'Could not load the view log.' });
  }
});

// POST /api/homes/:id/residency-claims/:claimId/revoke
router.post('/:id/residency-claims/:claimId/revoke', verifyToken, async (req, res) => {
  const { id, claimId } = req.params;
  const userId = req.user.id;
  try {
    const access = await checkHomePermission(id, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this place.' });
    }
    const claim = await residencyClaimService.revokeClaim({ homeId: id, userId, claimId });
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found or already revoked.' });
    }
    return res.json({ claim });
  } catch (err) {
    logger.error('residencyClaim: revoke failed', { homeId: id, claimId, error: err.message });
    return res.status(500).json({ error: 'Could not revoke the claim.' });
  }
});

module.exports = router;
