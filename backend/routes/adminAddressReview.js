/**
 * Admin: address review queue.
 *
 * SCN-11 — the decision engine emits `manual_review` as the next action for six
 * verdicts and nothing consumed it. This is the surface that makes those
 * escalations actionable.
 *
 * Mounted at /api/admin/address-review.
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const verifyToken = require('../middleware/verifyToken');
const { requireAdmin } = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');
const addressReviewService = require('../services/addressValidation/addressReviewService');
const { writeAuditLog } = require('../utils/homePermissions');

// Every route here is admin-only.
router.use(verifyToken, requireAdmin);

// ── GET /queue ────────────────────────────────────────────────
router.get('/queue', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const status = req.query.status || null;

    const { cases, error } = await addressReviewService.listOpenCases({ limit, offset, status });
    if (error) {
      return res.status(500).json({ error: 'Failed to load review queue' });
    }

    return res.json({ cases, limit, offset });
  } catch (err) {
    logger.error('adminAddressReview.queue error', { error: err.message });
    return res.status(500).json({ error: 'Failed to load review queue' });
  }
});

// ── POST /:caseId/resolve ─────────────────────────────────────
const resolveSchema = Joi.object({
  outcome: Joi.string().valid('approved', 'rejected', 'dismissed').required(),
  note: Joi.string().trim().max(2000).allow('', null),
});

router.post('/:caseId/resolve', validate(resolveSchema), async (req, res) => {
  try {
    const { caseId } = req.params;
    const { outcome, note } = req.body;
    const reviewerId = req.user.id;

    const result = await addressReviewService.resolveCase({
      caseId, reviewerId, outcome, note: note || null,
    });

    if (!result.success) {
      // "already resolved" is a conflict, not a server error — two reviewers
      // acting at once should get a clear answer.
      const conflict = /already resolved|not found/i.test(result.error || '');
      return res.status(conflict ? 409 : 500).json({ error: result.error });
    }

    // Every reviewer action is recorded.
    await writeAuditLog(null, reviewerId, `ADDRESS_REVIEW_${outcome.toUpperCase()}`,
      'AddressReviewCase', caseId, { outcome });

    return res.json({ message: 'Case resolved', outcome });
  } catch (err) {
    logger.error('adminAddressReview.resolve error', { error: err.message });
    return res.status(500).json({ error: 'Failed to resolve case' });
  }
});

module.exports = router;
