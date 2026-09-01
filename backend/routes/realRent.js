// ============================================================
// REAL RENT ROUTES (Wave 3 — the Block Founders flagship unlock)
//
//   PUT    /api/homes/:id/rent-report   contribute/update (T4 only)
//   GET    /api/homes/:id/rent-report   the caller's own report
//   DELETE /api/homes/:id/rent-report   withdraw it
//
// Mounted at /api/homes BEFORE the generic home router, like the other
// Wave routes.
//
// The contribution gate is the product: only a VERIFIED occupant may
// report a rent, because "ten neighbors who proved they live here"
// is the entire difference between this and a listings-site estimate.
// Reads of the caller's OWN report need only home access — it is their
// figure, and hiding it from an unverified viewer would just look
// broken. The block AGGREGATE is never served here at all: it rides
// the intelligence contract's `real_rent` section, behind the same
// k>=10 floor.
// ============================================================

const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/verifyToken');
const { checkHomePermission, isVerifiedResident } = require('../utils/homePermissions');
const supabaseAdmin = require('../config/supabaseAdmin');
const realRentService = require('../services/realRentService');
const logger = require('../utils/logger');

// PUT /api/homes/:id/rent-report — contribute or update
router.put('/:id/rent-report', verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const access = await checkHomePermission(id, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this place.' });
    }
    if (!isVerifiedResident(access)) {
      return res.status(403).json({
        error: 'Verify your address to add your rent — a benchmark is only real if the people in it live there.',
        code: 'VERIFICATION_REQUIRED',
      });
    }

    const { data: home } = await supabaseAdmin
      .from('Home')
      .select('id, bedrooms, map_center_lat, map_center_lng')
      .eq('id', id)
      .maybeSingle();
    if (!home) return res.status(404).json({ error: 'Home not found.' });

    const report = await realRentService.setReport({
      home,
      userId,
      monthlyRent: req.body && req.body.monthly_rent,
      bedrooms: req.body && req.body.bedrooms,
    });
    return res.status(200).json({ report });
  } catch (err) {
    if (err instanceof realRentService.RentReportError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    logger.error('realRent: set failed', { homeId: id, userId, error: err.message });
    return res.status(500).json({ error: 'Could not save your rent. Try again.' });
  }
});

// GET /api/homes/:id/rent-report — the caller's own report
router.get('/:id/rent-report', verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const access = await checkHomePermission(id, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this place.' });
    }
    const report = await realRentService.getReport({ homeId: id, userId });
    return res.json({ report });
  } catch (err) {
    logger.error('realRent: get failed', { homeId: id, userId, error: err.message });
    return res.status(500).json({ error: 'Could not load your rent.' });
  }
});

// DELETE /api/homes/:id/rent-report — withdraw
router.delete('/:id/rent-report', verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const access = await checkHomePermission(id, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this place.' });
    }
    await realRentService.deleteReport({ homeId: id, userId });
    return res.json({ removed: true });
  } catch (err) {
    logger.error('realRent: delete failed', { homeId: id, userId, error: err.message });
    return res.status(500).json({ error: 'Could not remove your rent.' });
  }
});

module.exports = router;
