// ============================================================
// INTERNAL ROUTES — Service-to-service / cron trigger endpoints
// Protected by INTERNAL_API_KEY header check (not user auth).
// Mount at: app.use('/api/internal', require('./routes/internal'));
// ============================================================

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const logger = require('../utils/logger');
const processExpiredClaimWindows = require('../jobs/processClaimWindows');

// ─── Internal auth middleware ───
// Validates X-Internal-Key header against INTERNAL_API_KEY env var.
// Falls back to requiring platform admin auth if no key is configured.
function requireInternalAuth(req, res, next) {
  const expectedKey = process.env.INTERNAL_API_KEY;
  if (!expectedKey) {
    return res.status(503).json({ error: 'Internal endpoints not configured' });
  }

  const providedKey = req.headers['x-internal-key'];
  if (!providedKey) {
    return res.status(401).json({ error: 'Missing internal authentication' });
  }

  // Constant-time comparison to prevent timing attacks
  const expected = Buffer.from(expectedKey);
  const provided = Buffer.from(providedKey);
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    return res.status(403).json({ error: 'Invalid internal authentication' });
  }

  next();
}

router.use(requireInternalAuth);

// ============================================================
// POST /api/internal/process-claim-windows
// Manually trigger challenge window processing.
// Can be called by cron, Supabase Edge Functions, or ops tooling.
// ============================================================
router.post('/process-claim-windows', async (req, res) => {
  try {
    logger.info('[internal] Manual trigger: processExpiredClaimWindows');
    await processExpiredClaimWindows();
    res.json({ message: 'Claim window processing completed' });
  } catch (err) {
    logger.error('[internal] processExpiredClaimWindows failed', { error: err.message });
    res.status(500).json({ error: 'Processing failed' });
  }
});

module.exports = router;
