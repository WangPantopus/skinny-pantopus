// ============================================================
// INTERNAL ROUTES — Service-to-service / cron trigger endpoints
// Protected by INTERNAL_API_KEY header check (not user auth).
// Mount at: app.use('/api/internal', require('./routes/internal'));
// ============================================================

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const logger = require('../utils/logger');
const supabaseAdmin = require('../config/supabaseAdmin');
const processExpiredClaimWindows = require('../jobs/processClaimWindows');

// ─── Tier 1 job imports (Lambda-triggered) ───
const processPendingTransfers = require('../jobs/processPendingTransfers');
const retryCaptureFailures = require('../jobs/retryCaptureFailures');
const authorizeUpcomingGigs = require('../jobs/authorizeUpcomingGigs');
const expireUncapturedAuthorizations = require('../jobs/expireUncapturedAuthorizations');
const { checkAndAlertStuckPayments } = require('./paymentOps');
const cleanupGhostBusinesses = require('../jobs/cleanupGhostBusinesses');
const chatRedactionJob = require('../jobs/chatRedactionJob');
const trustAnomalyDetection = require('../jobs/trustAnomalyDetection');
const computeAvgResponseTime = require('../jobs/computeAvgResponseTime');
const autoArchivePosts = require('../jobs/autoArchivePosts');

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

// ============================================================
// Tier 1 Job Endpoints — Triggered by Lambda via EventBridge.
// Each endpoint acquires a distributed lock, runs the job,
// then releases the lock with success/failure status.
// ============================================================

/**
 * Creates a route handler for a Lambda-triggered job.
 * Wraps the job function with distributed locking via job_locks table.
 */
function jobEndpoint(jobName, jobFn, ttlSeconds = 600) {
  return async (req, res) => {
    const instanceId = `lambda-${Date.now()}`;

    // Acquire distributed lock
    const { data, error: lockError } = await supabaseAdmin.rpc('acquire_job_lock', {
      p_job_name: jobName,
      p_locked_by: instanceId,
      p_ttl_seconds: ttlSeconds,
    });

    if (lockError) {
      logger.error(`[internal] Lock acquire failed for ${jobName}`, { error: lockError.message });
      return res.status(500).json({ status: 'error', reason: 'lock_error', error: lockError.message });
    }

    if (!data) {
      logger.info(`[internal] Job ${jobName} skipped (lock held)`);
      return res.status(409).json({ status: 'skipped', reason: 'lock_held' });
    }

    const start = Date.now();
    let jobSucceeded = false;
    let jobError = null;

    try {
      logger.info(`[internal] Starting job: ${jobName}`, { triggered_by: req.body?.triggered_by });
      await jobFn();
      jobSucceeded = true;
    } catch (err) {
      jobError = err;
    }

    const elapsed = Date.now() - start;

    // Release lock — wrapped in try-catch so a release failure
    // doesn't mask the actual job result.
    try {
      const { error: releaseError } = await supabaseAdmin.rpc('release_job_lock', {
        p_job_name: jobName,
        p_locked_by: instanceId,
        p_success: jobSucceeded,
        p_error: jobError?.message ?? null,
      });
      if (releaseError) {
        throw releaseError;
      }
    } catch (releaseErr) {
      logger.error(`[internal] Failed to release lock for ${jobName}`, {
        error: releaseErr.message,
      });
      // Lock will auto-expire after TTL
    }

    if (jobSucceeded) {
      logger.info(`[internal] Completed job: ${jobName}`, { elapsed_ms: elapsed });
      res.json({ status: 'completed', elapsed_ms: elapsed });
    } else {
      logger.error(`[internal] Failed job: ${jobName}`, {
        error: jobError.message,
        stack: jobError.stack,
        elapsed_ms: elapsed,
      });
      res.status(500).json({ status: 'failed', error: jobError.message });
    }
  };
}

// ─── Financial jobs ───
router.post('/jobs/process-pending-transfers', jobEndpoint('processPendingTransfers', processPendingTransfers));
router.post('/jobs/retry-capture-failures', jobEndpoint('retryCaptureFailures', retryCaptureFailures));
router.post('/jobs/authorize-upcoming-gigs', jobEndpoint('authorizeUpcomingGigs', authorizeUpcomingGigs));
router.post('/jobs/expire-uncaptured-authorizations', jobEndpoint('expireUncapturedAuthorizations', expireUncapturedAuthorizations));
router.post('/jobs/check-stuck-payments', jobEndpoint('checkAndAlertStuckPayments', checkAndAlertStuckPayments));

// ─── Data integrity / GDPR jobs ───
router.post('/jobs/cleanup-ghost-businesses', jobEndpoint('cleanupGhostBusinesses', cleanupGhostBusinesses));
router.post('/jobs/chat-redaction', jobEndpoint('chatRedactionJob', chatRedactionJob));

// ─── Heavy computation jobs ───
router.post('/jobs/trust-anomaly-detection', jobEndpoint('trustAnomalyDetection', trustAnomalyDetection));
router.post('/jobs/compute-avg-response-time', jobEndpoint('computeAvgResponseTime', computeAvgResponseTime));
router.post('/jobs/auto-archive-posts', jobEndpoint('autoArchivePosts', autoArchivePosts));

module.exports = router;
