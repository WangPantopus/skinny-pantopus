// ============================================================
// MAILBOX REALITY CHECK (Wave 1, #3)
//
//   GET /api/homes/:id/mailbox-check
//
// The stored claim-time postal validation (DPV, RDI, vacancy,
// missing-unit flags) surfaced as a diagnostic with fix-it guidance,
// plus the caller's postcard state as the physical leg. Read-only,
// zero vendor calls; any home member may read it — the physical-leg
// copy is per-caller (their own verification status), which is also
// the section's T3→T4 nudge.
//
// Mounted at /api/homes BEFORE the generic home router.
// ============================================================

const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/verifyToken');
const { checkHomePermission } = require('../utils/homePermissions');
const mailboxCheckService = require('../services/mailboxCheckService');
const logger = require('../utils/logger');

router.get('/:id/mailbox-check', verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const access = await checkHomePermission(id, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this place.' });
    }
    const check = await mailboxCheckService.getMailboxCheck({ homeId: id, occupancy: access.occupancy });
    if (!check) {
      return res.status(404).json({ error: 'Home not found.' });
    }
    return res.json({ check });
  } catch (err) {
    logger.error('mailboxCheck: failed', { homeId: id, userId, error: err.message });
    return res.status(500).json({ error: 'Could not run the mailbox check.' });
  }
});

module.exports = router;
