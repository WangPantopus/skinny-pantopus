// ============================================================
// RESIDENCY LETTER ROUTES (Phase 1, #11)
//
// Server-attested residency letters for T4 residents:
//   POST /api/homes/:id/residency-letters              issue (T4 only)
//   GET  /api/homes/:id/residency-letters              my letters here
//   GET  /api/homes/:id/residency-letters/:letterId/pdf   download
//   POST /api/homes/:id/residency-letters/:letterId/revoke
//
// Mounted at /api/homes BEFORE the generic home router (two-segment
// paths never collide with home.js's `/:id`). Thin by design: auth +
// permission gates here, lifecycle in residencyLetterService.
//
// Gates:
//   * every route needs home access (checkHomePermission);
//   * ISSUING needs verified occupancy (T4) — ownership alone is not
//     residency, so an unverified owner cannot issue;
//   * letters are personal: list/pdf/revoke are scoped to the issuing
//     user inside the service (a member never sees another's letters).
//
// The public third-party check lives in routes/public.js
// (GET /api/public/residency-letters/:code).
// ============================================================

const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/verifyToken');
const { residencyLetterIssueLimiter } = require('../middleware/rateLimiter');
const { checkHomePermission } = require('../utils/homePermissions');
const residencyLetterService = require('../services/residencyLetterService');
const logger = require('../utils/logger');

function isVerifiedResident(access) {
  return Boolean(access && access.occupancy && access.occupancy.verification_status === 'verified');
}

// POST /api/homes/:id/residency-letters — issue
router.post('/:id/residency-letters', verifyToken, residencyLetterIssueLimiter, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const access = await checkHomePermission(id, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this place.' });
    }
    if (!isVerifiedResident(access)) {
      return res.status(403).json({
        error: 'Verify your address to issue a residency letter.',
        code: 'VERIFICATION_REQUIRED',
      });
    }

    const letter = await residencyLetterService.issueLetter({
      homeId: id,
      userId,
      purpose: req.body && req.body.purpose,
    });
    return res.status(201).json({ letter });
  } catch (err) {
    logger.error('residencyLetter: issue failed', { homeId: id, userId, error: err.message });
    return res.status(500).json({ error: 'Could not issue the letter. Try again.' });
  }
});

// GET /api/homes/:id/residency-letters — the caller's letters for this home
router.get('/:id/residency-letters', verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const access = await checkHomePermission(id, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this place.' });
    }
    const letters = await residencyLetterService.listLetters({ homeId: id, userId });
    return res.json({ letters });
  } catch (err) {
    logger.error('residencyLetter: list failed', { homeId: id, userId, error: err.message });
    return res.status(500).json({ error: 'Could not load your letters.' });
  }
});

// GET /api/homes/:id/residency-letters/:letterId/pdf — download the issued artifact
router.get('/:id/residency-letters/:letterId/pdf', verifyToken, async (req, res) => {
  const { id, letterId } = req.params;
  const userId = req.user.id;
  try {
    const access = await checkHomePermission(id, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this place.' });
    }
    const pdf = await residencyLetterService.getLetterPdf({ homeId: id, userId, letterId });
    if (!pdf) {
      return res.status(404).json({ error: 'Letter not found.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="pantopus-residency-letter-${String(letterId).slice(0, 8)}.pdf"`,
    );
    return res.send(pdf.buffer);
  } catch (err) {
    logger.error('residencyLetter: pdf failed', { homeId: id, letterId, error: err.message });
    return res.status(500).json({ error: 'Could not load the letter PDF.' });
  }
});

// POST /api/homes/:id/residency-letters/:letterId/revoke
router.post('/:id/residency-letters/:letterId/revoke', verifyToken, async (req, res) => {
  const { id, letterId } = req.params;
  const userId = req.user.id;
  try {
    const access = await checkHomePermission(id, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this place.' });
    }
    const letter = await residencyLetterService.revokeLetter({ homeId: id, userId, letterId });
    if (!letter) {
      return res.status(404).json({ error: 'Letter not found or already revoked.' });
    }
    return res.json({ letter });
  } catch (err) {
    logger.error('residencyLetter: revoke failed', { homeId: id, letterId, error: err.message });
    return res.status(500).json({ error: 'Could not revoke the letter.' });
  }
});

module.exports = router;
