// ============================================================
// PAYMENT OPS ROUTES — Admin-only operational endpoints
// for payment system health, stuck payment detection,
// manual transfer triggering, and reconciliation.
//
// All endpoints require admin auth and produce audit logs.
// Mount at: app.use('/api/admin/payment-ops', require('./routes/paymentOps'));
// ============================================================

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { requireAdmin } = require('../middleware/verifyToken');
const supabaseAdmin = require('../config/supabaseAdmin');
const { PAYMENT_STATES } = require('../stripe/paymentStateMachine');
const processPendingTransfers = require('../jobs/processPendingTransfers');
const { sendAlert, SEVERITY } = require('../services/alertingService');
const logger = require('../utils/logger');

// All routes require admin auth
router.use(verifyToken, requireAdmin);

// ─── Audit log helper ───
function auditLog(action, adminUserId, details = {}) {
  const entry = {
    action,
    admin_user_id: adminUserId,
    timestamp: new Date().toISOString(),
    ...details,
  };
  logger.warn('[AUDIT] payment-ops', entry);
  return entry;
}

// ============================================================
// GET /api/admin/payment-ops/health
// Payment system health check — returns stuck payment counts
// and triggers alerts if thresholds are exceeded.
// ============================================================
router.get('/health', async (req, res) => {
  try {
    const now = new Date();
    // Flag captured_hold payments whose cooling-off ended >2h ago — the
    // transfer job runs every 15m, so 2h means ~8 missed cycles.
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

    const [capturedHoldStuck, transferScheduledStuck, transferPendingStuck, transferPendingCritical, recentFailures] = await Promise.all([
      // captured_hold where cooling off ended >2h ago (should have been transferred)
      supabaseAdmin
        .from('Payment')
        .select('id', { count: 'exact', head: true })
        .eq('payment_status', PAYMENT_STATES.CAPTURED_HOLD)
        .lte('cooling_off_ends_at', twoHoursAgo)
        .is('dispute_id', null),

      // transfer_scheduled older than 30m
      supabaseAdmin
        .from('Payment')
        .select('id', { count: 'exact', head: true })
        .eq('payment_status', PAYMENT_STATES.TRANSFER_SCHEDULED)
        .lte('updated_at', thirtyMinAgo),

      // transfer_pending older than 10m (detection threshold)
      supabaseAdmin
        .from('Payment')
        .select('id', { count: 'exact', head: true })
        .eq('payment_status', PAYMENT_STATES.TRANSFER_PENDING)
        .lte('updated_at', tenMinAgo),

      // transfer_pending older than 30m (escalation threshold)
      supabaseAdmin
        .from('Payment')
        .select('id', { count: 'exact', head: true })
        .eq('payment_status', PAYMENT_STATES.TRANSFER_PENDING)
        .lte('updated_at', thirtyMinAgo),

      // authorized payments where owner confirmed but capture hasn't happened (stuck captures)
      supabaseAdmin
        .from('Gig')
        .select('id', { count: 'exact', head: true })
        .not('owner_confirmed_at', 'is', null)
        .not('payment_id', 'is', null)
        .eq('payment_status', PAYMENT_STATES.AUTHORIZED),
    ]);

    // Fail loudly if any query errored — prevents false "healthy" on DB failures
    const queryErrors = [
      capturedHoldStuck.error && `captured_hold: ${capturedHoldStuck.error.message}`,
      transferScheduledStuck.error && `transfer_scheduled: ${transferScheduledStuck.error.message}`,
      transferPendingStuck.error && `transfer_pending_10m: ${transferPendingStuck.error.message}`,
      transferPendingCritical.error && `transfer_pending_30m: ${transferPendingCritical.error.message}`,
      recentFailures.error && `capture_failures: ${recentFailures.error.message}`,
    ].filter(Boolean);

    if (queryErrors.length > 0) {
      logger.error('[payment-ops] health check query errors', { errors: queryErrors });
      return res.status(503).json({
        error: 'Health check queries failed — cannot determine status',
        query_errors: queryErrors,
        status: 'unknown',
      });
    }

    const health = {
      stuck_captured_hold_gt_2h: capturedHoldStuck.count ?? 0,
      stuck_transfer_scheduled_gt_30m: transferScheduledStuck.count ?? 0,
      stuck_transfer_pending_gt_10m: transferPendingStuck.count ?? 0,
      stuck_transfer_pending_gt_30m: transferPendingCritical.count ?? 0,
      stuck_capture_failures: recentFailures.count ?? 0,
      checked_at: now.toISOString(),
      status: 'healthy',
    };

    // Determine overall status
    // transfer_pending: detect at 10m (degraded), escalate at 30m (critical)
    if (health.stuck_captured_hold_gt_2h > 0 || health.stuck_transfer_scheduled_gt_30m > 0 || health.stuck_transfer_pending_gt_10m > 0) {
      health.status = 'degraded';
    }
    if (health.stuck_captured_hold_gt_2h > 5 || health.stuck_transfer_scheduled_gt_30m > 3 || health.stuck_transfer_pending_gt_30m > 0) {
      health.status = 'critical';
    }

    auditLog('health_check', req.user.id, { result: health });

    res.json(health);
  } catch (err) {
    logger.error('[payment-ops] health check failed', { error: err.message });
    res.status(500).json({ error: 'Health check failed' });
  }
});

// ============================================================
// GET /api/admin/payment-ops/stuck
// Returns detailed list of stuck payments for investigation.
// ============================================================
router.get('/stuck', async (req, res) => {
  try {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

    const [capturedHold, transferScheduled, transferPending] = await Promise.all([
      supabaseAdmin
        .from('Payment')
        .select('id, gig_id, payer_id, payee_id, amount_total, amount_to_payee, payment_status, cooling_off_ends_at, updated_at, payment_type')
        .eq('payment_status', PAYMENT_STATES.CAPTURED_HOLD)
        .lte('cooling_off_ends_at', twoHoursAgo)
        .is('dispute_id', null)
        .order('updated_at', { ascending: true })
        .limit(100),

      supabaseAdmin
        .from('Payment')
        .select('id, gig_id, payer_id, payee_id, amount_total, amount_to_payee, payment_status, updated_at, payment_type')
        .eq('payment_status', PAYMENT_STATES.TRANSFER_SCHEDULED)
        .lte('updated_at', thirtyMinAgo)
        .order('updated_at', { ascending: true })
        .limit(100),

      supabaseAdmin
        .from('Payment')
        .select('id, gig_id, payer_id, payee_id, amount_total, amount_to_payee, payment_status, updated_at, payment_type')
        .eq('payment_status', PAYMENT_STATES.TRANSFER_PENDING)
        .lte('updated_at', tenMinAgo)
        .order('updated_at', { ascending: true })
        .limit(100),
    ]);

    // Fail loudly on query errors
    const queryErrors = [
      capturedHold.error && `captured_hold: ${capturedHold.error.message}`,
      transferScheduled.error && `transfer_scheduled: ${transferScheduled.error.message}`,
      transferPending.error && `transfer_pending: ${transferPending.error.message}`,
    ].filter(Boolean);

    if (queryErrors.length > 0) {
      logger.error('[payment-ops] stuck detection query errors', { errors: queryErrors });
      return res.status(503).json({
        error: 'Stuck detection queries failed',
        query_errors: queryErrors,
      });
    }

    const result = {
      captured_hold_stuck: capturedHold.data || [],
      transfer_scheduled_stuck: transferScheduled.data || [],
      transfer_pending_stuck: transferPending.data || [],
      total_stuck: (capturedHold.data?.length || 0) + (transferScheduled.data?.length || 0) + (transferPending.data?.length || 0),
      checked_at: now.toISOString(),
    };

    auditLog('stuck_detection', req.user.id, {
      total_stuck: result.total_stuck,
      captured_hold: capturedHold.data?.length || 0,
      transfer_scheduled: transferScheduled.data?.length || 0,
      transfer_pending: transferPending.data?.length || 0,
    });

    res.json(result);
  } catch (err) {
    logger.error('[payment-ops] stuck detection failed', { error: err.message });
    res.status(500).json({ error: 'Stuck detection failed' });
  }
});

// ============================================================
// POST /api/admin/payment-ops/trigger-transfers
// Manually trigger processPendingTransfers job.
// Use after deploy to recover stuck rows.
// ============================================================
router.post('/trigger-transfers', async (req, res) => {
  const audit = auditLog('manual_trigger_transfers', req.user.id, {
    reason: req.body?.reason || 'manual',
  });

  try {
    logger.info('[payment-ops] Manual trigger: processPendingTransfers', {
      adminUserId: req.user.id,
    });

    await processPendingTransfers();

    res.json({
      message: 'Transfer processing completed successfully',
      audit,
    });
  } catch (err) {
    logger.error('[payment-ops] Manual transfer trigger failed', { error: err.message });

    await sendAlert({
      severity: SEVERITY.CRITICAL,
      title: 'Manual transfer trigger failed',
      message: `Admin ${req.user.id} triggered processPendingTransfers manually but it failed: ${err.message}`,
      metadata: { admin_user_id: req.user.id, error: err.message },
    });

    res.status(500).json({ error: 'Transfer processing failed', message: err.message });
  }
});

// ============================================================
// POST /api/admin/payment-ops/run-alerts
// Manually run the stuck payment alert check.
// ============================================================
router.post('/run-alerts', async (req, res) => {
  try {
    const alerts = await checkAndAlertStuckPayments();

    auditLog('manual_alert_check', req.user.id, { alerts_sent: alerts.length });

    res.json({
      message: 'Alert check completed',
      alerts_sent: alerts.length,
      alerts,
    });
  } catch (err) {
    logger.error('[payment-ops] Manual alert check failed', { error: err.message });
    res.status(500).json({ error: 'Alert check failed' });
  }
});

// ============================================================
// Automated alert check — called by cron or manually
// ============================================================
async function checkAndAlertStuckPayments() {
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

  const alerts = [];

  // Check captured_hold where cooling ended >2h ago
  const { count: stuckCaptured, error: capturedErr } = await supabaseAdmin
    .from('Payment')
    .select('id', { count: 'exact', head: true })
    .eq('payment_status', PAYMENT_STATES.CAPTURED_HOLD)
    .lte('cooling_off_ends_at', twoHoursAgo)
    .is('dispute_id', null);

  if (capturedErr) {
    logger.error('[payment-ops] alert query failed for captured_hold', { error: capturedErr.message });
    const alert = {
      severity: SEVERITY.CRITICAL,
      title: 'Payment health query failed',
      message: `Cannot check stuck captured_hold payments: ${capturedErr.message}`,
      metadata: { query: 'captured_hold', error: capturedErr.message },
      dedup_key: 'pantopus-health-query-failure',
    };
    await sendAlert(alert);
    alerts.push(alert);
  } else if (stuckCaptured > 0) {
    const alert = {
      severity: stuckCaptured > 5 ? SEVERITY.CRITICAL : SEVERITY.WARNING,
      title: 'Stuck payments in captured_hold',
      message: `${stuckCaptured} payment(s) still in captured_hold >2h past cooling-off end. Transfer job may be failing.`,
      metadata: { count: stuckCaptured, threshold: '2h past cooling_off_ends_at' },
      dedup_key: 'pantopus-stuck-captured-hold',
    };
    await sendAlert(alert);
    alerts.push(alert);
  }

  // Check transfer_scheduled > 30m
  const { count: stuckScheduled, error: scheduledErr } = await supabaseAdmin
    .from('Payment')
    .select('id', { count: 'exact', head: true })
    .eq('payment_status', PAYMENT_STATES.TRANSFER_SCHEDULED)
    .lte('updated_at', thirtyMinAgo);

  if (scheduledErr) {
    logger.error('[payment-ops] alert query failed for transfer_scheduled', { error: scheduledErr.message });
    const alert = {
      severity: SEVERITY.CRITICAL,
      title: 'Payment health query failed',
      message: `Cannot check stuck transfer_scheduled payments: ${scheduledErr.message}`,
      metadata: { query: 'transfer_scheduled', error: scheduledErr.message },
      dedup_key: 'pantopus-health-query-failure-scheduled',
    };
    await sendAlert(alert);
    alerts.push(alert);
  } else if (stuckScheduled > 0) {
    const alert = {
      severity: stuckScheduled > 3 ? SEVERITY.CRITICAL : SEVERITY.WARNING,
      title: 'Stuck payments in transfer_scheduled',
      message: `${stuckScheduled} payment(s) stuck in transfer_scheduled >30m. Wallet credit may have failed.`,
      metadata: { count: stuckScheduled, threshold: '30m' },
      dedup_key: 'pantopus-stuck-transfer-scheduled',
    };
    await sendAlert(alert);
    alerts.push(alert);
  }

  // Check transfer_pending: detect at 10m (WARNING), escalate at 30m (CRITICAL)
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const [pendingDetect, pendingEscalate] = await Promise.all([
    supabaseAdmin
      .from('Payment')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', PAYMENT_STATES.TRANSFER_PENDING)
      .lte('updated_at', tenMinAgo),
    supabaseAdmin
      .from('Payment')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', PAYMENT_STATES.TRANSFER_PENDING)
      .lte('updated_at', thirtyMinAgo),
  ]);

  if (pendingDetect.error || pendingEscalate.error) {
    const errMsg = pendingDetect.error?.message || pendingEscalate.error?.message;
    logger.error('[payment-ops] alert query failed for transfer_pending', { error: errMsg });
    const alert = {
      severity: SEVERITY.CRITICAL,
      title: 'Payment health query failed',
      message: `Cannot check stuck transfer_pending payments: ${errMsg}`,
      metadata: { query: 'transfer_pending', error: errMsg },
      dedup_key: 'pantopus-health-query-failure-pending',
    };
    await sendAlert(alert);
    alerts.push(alert);
  } else if ((pendingEscalate.count ?? 0) > 0) {
    // Any payment stuck >30m is critical regardless of count
    const alert = {
      severity: SEVERITY.CRITICAL,
      title: 'Stuck payments in transfer_pending >30m',
      message: `${pendingEscalate.count} payment(s) stuck in transfer_pending >30m. Recovery job has failed repeatedly.`,
      metadata: { count_gt_10m: pendingDetect.count, count_gt_30m: pendingEscalate.count, threshold: '30m' },
      dedup_key: 'pantopus-stuck-transfer-pending',
    };
    await sendAlert(alert);
    alerts.push(alert);
  } else if ((pendingDetect.count ?? 0) > 0) {
    const alert = {
      severity: SEVERITY.WARNING,
      title: 'Stuck payments in transfer_pending >10m',
      message: `${pendingDetect.count} payment(s) stuck in transfer_pending >10m. Recovery job should resolve on next cycle.`,
      metadata: { count: pendingDetect.count, threshold: '10m' },
      dedup_key: 'pantopus-stuck-transfer-pending',
    };
    await sendAlert(alert);
    alerts.push(alert);
  }

  // Check repeated capture failures
  const { count: captureFailures, error: captureErr } = await supabaseAdmin
    .from('Gig')
    .select('id', { count: 'exact', head: true })
    .not('owner_confirmed_at', 'is', null)
    .not('payment_id', 'is', null)
    .eq('payment_status', PAYMENT_STATES.AUTHORIZED);

  if (captureErr) {
    logger.error('[payment-ops] alert query failed for capture failures', { error: captureErr.message });
    const alert = {
      severity: SEVERITY.CRITICAL,
      title: 'Payment health query failed',
      message: `Cannot check capture failure gigs: ${captureErr.message}`,
      metadata: { query: 'capture_failures', error: captureErr.message },
      dedup_key: 'pantopus-health-query-failure-captures',
    };
    await sendAlert(alert);
    alerts.push(alert);
  } else if (captureFailures > 0) {
    const alert = {
      severity: captureFailures > 3 ? SEVERITY.CRITICAL : SEVERITY.WARNING,
      title: 'Payments stuck after capture failure',
      message: `${captureFailures} gig(s) have owner_confirmed_at set but payment still in authorized state. Capture retries may be exhausted.`,
      metadata: { count: captureFailures },
      dedup_key: 'pantopus-stuck-capture-failures',
    };
    await sendAlert(alert);
    alerts.push(alert);
  }

  return alerts;
}

module.exports = router;
module.exports.checkAndAlertStuckPayments = checkAndAlertStuckPayments;
