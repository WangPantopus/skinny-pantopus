// ============================================================
// HOME RECORD WATCH ROUTES (Wave 2b — the rate-watch half)
//
//   PUT    /api/homes/:id/record-watch    set/replace (T4 only)
//   GET    /api/homes/:id/record-watch    the caller's watch + live eval
//   DELETE /api/homes/:id/record-watch    remove
//
// Mounted at /api/homes BEFORE the generic home router, like the other
// Wave routes. Watches are PERSONAL (per home+user): the loan month is
// the resident's own business, so reads/writes are scoped to the
// caller inside the service.
//
// Gate: setting a watch needs verified occupancy — the watch is part
// of the "only the proven resident can watch this home" promise, even
// in its free half.
// ============================================================

const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/verifyToken');
const { checkHomePermission, isVerifiedResident } = require('../utils/homePermissions');
const homeRecordWatchService = require('../services/homeRecordWatchService');
const logger = require('../utils/logger');

// PUT /api/homes/:id/record-watch — set or replace
router.put('/:id/record-watch', verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const access = await checkHomePermission(id, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this place.' });
    }
    if (!isVerifiedResident(access)) {
      return res.status(403).json({
        error: 'Verify your address to set a record watch.',
        code: 'VERIFICATION_REQUIRED',
      });
    }

    const watch = await homeRecordWatchService.setWatch({
      homeId: id,
      userId,
      loanRecordedMonth: req.body && req.body.loan_recorded_month,
    });
    return res.status(200).json({ watch });
  } catch (err) {
    if (err instanceof homeRecordWatchService.WatchError) {
      const status = err.code === 'PMMS_UNAVAILABLE' ? 503 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    logger.error('recordWatch: set failed', { homeId: id, userId, error: err.message });
    return res.status(500).json({ error: 'Could not save the watch. Try again.' });
  }
});

// GET /api/homes/:id/record-watch — the caller's watch here
router.get('/:id/record-watch', verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const access = await checkHomePermission(id, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this place.' });
    }
    const watch = await homeRecordWatchService.getWatch({ homeId: id, userId });
    return res.json({ watch });
  } catch (err) {
    logger.error('recordWatch: get failed', { homeId: id, userId, error: err.message });
    return res.status(500).json({ error: 'Could not load the watch.' });
  }
});

// DELETE /api/homes/:id/record-watch
router.delete('/:id/record-watch', verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const access = await checkHomePermission(id, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this place.' });
    }
    const removed = await homeRecordWatchService.deleteWatch({ homeId: id, userId });
    if (!removed) return res.status(404).json({ error: 'No watch to remove.' });
    return res.json({ removed: true });
  } catch (err) {
    logger.error('recordWatch: delete failed', { homeId: id, userId, error: err.message });
    return res.status(500).json({ error: 'Could not remove the watch.' });
  }
});

module.exports = router;
