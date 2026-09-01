// ============================================================
// FRIDGE CARD ROUTES (Wave 1, #2)
//
// The 911-ready household card:
//   POST /api/homes/:id/fridge-cards                  issue
//   GET  /api/homes/:id/fridge-cards                  the home's cards
//   POST /api/homes/:id/fridge-cards/:cardId/revoke
//
// Mounted at /api/homes BEFORE the generic home router, like
// residencyLetters/residencyClaims. Thin by design.
//
// Gates — the card is a HOUSEHOLD document, not a personal one:
//   * listing needs home access;
//   * ISSUING needs home-manage permission AND verified occupancy —
//     the card's headline is the verified address, so an unverified
//     manager cannot print the attestation;
//   * REVOKING needs home-manage permission (any manager can pull a
//     card, whoever issued it — revocation is safety-critical).
//
// The public card page lives in routes/public.js
// (GET /api/public/fridge-cards/:code).
// ============================================================

const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/verifyToken');
const { fridgeCardIssueLimiter } = require('../middleware/rateLimiter');
const { checkHomePermission, isVerifiedResident } = require('../utils/homePermissions');
const fridgeCardService = require('../services/fridgeCardService');
const logger = require('../utils/logger');


// POST /api/homes/:id/fridge-cards — issue
router.post('/:id/fridge-cards', verifyToken, fridgeCardIssueLimiter, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const access = await checkHomePermission(id, userId, 'can_manage_home');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have permission to manage this place.' });
    }
    if (!isVerifiedResident(access)) {
      return res.status(403).json({
        error: 'Verify your address to issue a fridge card.',
        code: 'VERIFICATION_REQUIRED',
      });
    }

    const card = await fridgeCardService.issueCard({
      homeId: id,
      userId,
      label: req.body && req.body.label,
      sections: req.body && req.body.sections,
    });
    return res.status(201).json({ card });
  } catch (err) {
    if (err instanceof fridgeCardService.FridgeCardError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    logger.error('fridgeCard: issue failed', { homeId: id, userId, error: err.message });
    return res.status(500).json({ error: 'Could not issue the card. Try again.' });
  }
});

// GET /api/homes/:id/fridge-cards — the home's cards
router.get('/:id/fridge-cards', verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const access = await checkHomePermission(id, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this place.' });
    }
    // Verified residents only — the list carries every card's medical
    // content AND its live bearer code. A guest or service-provider
    // occupancy grants home access, not the household's health data;
    // whoever the household wants informed gets handed the card link.
    if (!isVerifiedResident(access)) {
      return res.status(403).json({
        error: 'Verify your address to see this household’s cards.',
        code: 'VERIFICATION_REQUIRED',
      });
    }
    const cards = await fridgeCardService.listCards({ homeId: id });
    return res.json({ cards });
  } catch (err) {
    logger.error('fridgeCard: list failed', { homeId: id, userId, error: err.message });
    return res.status(500).json({ error: 'Could not load the cards.' });
  }
});

// POST /api/homes/:id/fridge-cards/:cardId/revoke
router.post('/:id/fridge-cards/:cardId/revoke', verifyToken, async (req, res) => {
  const { id, cardId } = req.params;
  const userId = req.user.id;
  try {
    const access = await checkHomePermission(id, userId, 'can_manage_home');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have permission to manage this place.' });
    }
    const card = await fridgeCardService.revokeCard({ homeId: id, cardId });
    if (!card) {
      return res.status(404).json({ error: 'Card not found or already revoked.' });
    }
    return res.json({ card });
  } catch (err) {
    logger.error('fridgeCard: revoke failed', { homeId: id, cardId, error: err.message });
    return res.status(500).json({ error: 'Could not revoke the card.' });
  }
});

module.exports = router;
