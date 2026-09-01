/**
 * Internal Briefing Routes — Lambda-callable endpoints for daily briefing.
 *
 * These endpoints are protected by INTERNAL_API_KEY (not user JWT).
 * The Lambda scheduler calls these to compose and deliver daily briefings.
 *
 * IMPORTANT: The INTERNAL_API_KEY env var must match the value stored in
 * the Lambda's Secrets Manager secret (pantopus/seeder/{environment}).
 *
 * Mount at: app.use('/api/internal/briefing', require('./routes/internalBriefing'));
 */

const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { composeScheduledBriefing } = require('../services/context/providerOrchestrator');
const pushService = require('../services/pushService');
const { createNotification } = require('../services/notificationService');

// ── Internal API key auth ───────────────────────────────────────────

function verifyInternalApiKey(req, res, next) {
  const key = req.headers['x-internal-api-key'];
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    logger.warn('Internal API: unauthorized request', { path: req.path, ip: req.ip });
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

// ── Helpers ─────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BRIEFING_KINDS = new Set(['morning', 'evening']);

function getBriefingConfig(kind) {
  if (kind === 'evening') {
    return {
      prefField: 'evening_briefing_enabled',
      title: 'Your Evening Briefing',
      notificationType: 'evening_briefing',
    };
  }
  return {
    prefField: 'daily_briefing_enabled',
    title: 'Your Morning Briefing',
    notificationType: 'daily_briefing',
  };
}

function isBriefingEnabled(prefs, briefingConfig, briefingKind) {
  const value = prefs?.[briefingConfig.prefField];
  if (briefingKind === 'evening') {
    return value !== false;
  }
  return value === true;
}

/**
 * Check if the current time falls within the user's quiet hours.
 */
function isInQuietHours(prefs) {
  if (!prefs.quiet_hours_start_local || !prefs.quiet_hours_end_local) return false;

  const tz = prefs.daily_briefing_timezone || 'America/Los_Angeles';
  let nowLocal;
  try {
    nowLocal = new Date().toLocaleTimeString('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit' });
  } catch {
    nowLocal = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  }

  const start = prefs.quiet_hours_start_local;
  const end = prefs.quiet_hours_end_local;

  // Handle overnight quiet hours (e.g., 22:00 - 07:00)
  if (start > end) {
    return nowLocal >= start || nowLocal < end;
  }
  return nowLocal >= start && nowLocal < end;
}

/**
 * Get today's local date string for a timezone.
 */
function getTodayLocal(tz) {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: tz }); // en-CA = YYYY-MM-DD
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// ── POST /send ──────────────────────────────────────────────────────

/**
 * POST /api/internal/briefing/send
 * Compose and send a daily briefing for a single user.
 */
router.post('/send', verifyInternalApiKey, async (req, res) => {
  const { userId } = req.body;
  const briefingKind = BRIEFING_KINDS.has(req.body?.briefingKind) ? req.body.briefingKind : 'morning';
  const briefingConfig = getBriefingConfig(briefingKind);

  // 1. Validate userId
  if (!userId || !UUID_RE.test(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }

  let deliveryId = null;

  try {
    // 2. Check preferences
    const { data: prefsRow } = await supabaseAdmin
      .from('UserNotificationPreferences')
      .select(`${briefingConfig.prefField}, daily_briefing_timezone, quiet_hours_start_local, quiet_hours_end_local`)
      .eq('user_id', userId)
      .maybeSingle();

    const prefs = {
      [briefingConfig.prefField]: briefingKind === 'evening',
      daily_briefing_timezone: 'America/Los_Angeles',
      quiet_hours_start_local: null,
      quiet_hours_end_local: null,
      ...(prefsRow || {}),
    };

    if (!isBriefingEnabled(prefsRow, briefingConfig, briefingKind)) {
      return res.json({ status: 'skipped', skip_reason: 'opted_out' });
    }

    // 3. Check quiet hours
    if (isInQuietHours(prefs)) {
      return res.json({ status: 'skipped', skip_reason: 'quiet_hours' });
    }

    // 4. Check idempotency
    const tz = prefs.daily_briefing_timezone || 'America/Los_Angeles';
    const todayLocal = getTodayLocal(tz);

    const { data: existing } = await supabaseAdmin
      .from('DailyBriefingDelivery')
      .select('id, status')
      .eq('user_id', userId)
      .eq('briefing_date_local', todayLocal)
      .eq('briefing_kind', briefingKind)
      .in('status', ['sent', 'skipped', 'composing'])
      .maybeSingle();

    if (existing) {
      return res.json({ status: 'skipped', skip_reason: 'already_processed' });
    }

    const { data: failedDelivery } = await supabaseAdmin
      .from('DailyBriefingDelivery')
      .select('id, status')
      .eq('user_id', userId)
      .eq('briefing_date_local', todayLocal)
      .eq('briefing_kind', briefingKind)
      .eq('status', 'failed')
      .maybeSingle();

    // 5. Insert or reuse delivery row in composing status
    if (failedDelivery?.id) {
      const { error: reuseErr } = await supabaseAdmin
        .from('DailyBriefingDelivery')
        .update({
          status: 'composing',
          scheduled_for_utc: new Date().toISOString(),
          delivered_at: null,
          skip_reason: null,
          error_message: null,
        })
        .eq('id', failedDelivery.id);

      if (reuseErr) {
        throw reuseErr;
      }

      deliveryId = failedDelivery.id;
    } else {
      const { data: delivery, error: insertErr } = await supabaseAdmin
        .from('DailyBriefingDelivery')
        .insert({
          user_id: userId,
          briefing_date_local: todayLocal,
          briefing_kind: briefingKind,
          scheduled_for_utc: new Date().toISOString(),
          status: 'composing',
        })
        .select('id')
        .single();

      if (insertErr) {
        if (insertErr.code === '23505') {
          return res.json({ status: 'skipped', skip_reason: 'already_processed' });
        }
        throw insertErr;
      }

      deliveryId = delivery.id;
    }

    // 6. Compose briefing
    const result = await composeScheduledBriefing(userId, { kind: briefingKind });

    // 7. Check should_send
    if (!result.should_send) {
      await supabaseAdmin
        .from('DailyBriefingDelivery')
        .update({
          status: 'skipped',
          skip_reason: result.skip_reason,
          signals_snapshot: result.signals_snapshot,
          location_geohash: result.location_geohash,
        })
        .eq('id', deliveryId);

      return res.json({ status: 'skipped', skip_reason: result.skip_reason });
    }

    // 8. Check push tokens
    const { data: tokens } = await supabaseAdmin
      .from('PushToken')
      .select('token')
      .eq('user_id', userId);

    if (!tokens || tokens.length === 0) {
      await supabaseAdmin
        .from('DailyBriefingDelivery')
        .update({ status: 'skipped', skip_reason: 'no_push_token', summary_text: result.text })
        .eq('id', deliveryId);

      return res.json({ status: 'skipped', skip_reason: 'no_push_token' });
    }

    // 9. Send push
    await pushService.sendToUser(userId, {
      title: briefingConfig.title,
      body: result.text,
      data: {
        type: briefingConfig.notificationType,
        route: '/hub/today',
        briefingKind,
        briefingDeliveryId: deliveryId,
      },
    });

    // 10. Update delivery row
    await supabaseAdmin
      .from('DailyBriefingDelivery')
      .update({
        status: 'sent',
        delivered_at: new Date().toISOString(),
        summary_text: result.text,
        signals_snapshot: result.signals_snapshot,
        location_geohash: result.location_geohash,
        composition_mode: result.mode,
        ai_tokens_used: result.tokens_used,
      })
      .eq('id', deliveryId);

    logger.info('Briefing sent', {
      userId,
      briefingKind,
      mode: result.mode,
      signals: result.signals_snapshot?.length || 0,
    });

    return res.json({ status: 'sent', text: result.text, mode: result.mode, briefing_kind: briefingKind });
  } catch (err) {
    logger.error('Briefing send error', { userId, briefingKind, error: err.message });

    // Update delivery row to failed if we have one
    if (deliveryId) {
      await supabaseAdmin
        .from('DailyBriefingDelivery')
        .update({ status: 'failed', error_message: err.message })
        .eq('id', deliveryId)
        .catch(() => {}); // Don't let logging fail the error response
    }

    return res.status(500).json({ status: 'failed', error: err.message });
  }
});

// ── POST /preview ───────────────────────────────────────────────────

/**
 * POST /api/internal/briefing/preview
 * Preview a briefing without sending or recording delivery.
 * For debugging and QA.
 */
router.post('/preview', verifyInternalApiKey, async (req, res) => {
  const { userId } = req.body;
  const briefingKind = BRIEFING_KINDS.has(req.body?.briefingKind) ? req.body.briefingKind : 'morning';

  if (!userId || !UUID_RE.test(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }

  try {
    const result = await composeScheduledBriefing(userId, { kind: briefingKind });

    res.json({
      text: result.text,
      mode: result.mode,
      briefing_kind: briefingKind,
      tokens_used: result.tokens_used,
      should_send: result.should_send,
      skip_reason: result.skip_reason,
      signals: result.signals_snapshot,
      location_geohash: result.location_geohash,
    });
  } catch (err) {
    logger.error('Briefing preview error', { userId, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── POST /alert-push ────────────────────────────────────────────────

/**
 * POST /api/internal/briefing/alert-push
 * Send a real-time alert push notification to a list of users.
 * Called by the alert checker Lambda.
 *
 * Body: {
 *   userIds: string[],
 *   title: string,
 *   body: string,
 *   alertType: 'weather' | 'aqi',
 *   data: { alertId, severity, route }
 * }
 */
router.post('/alert-push', verifyInternalApiKey, async (req, res) => {
  const { userIds, title, body, alertType, data } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'userIds array required' });
  }
  if (!title || !body) {
    return res.status(400).json({ error: 'title and body required' });
  }

  // Cap at 100 users per call
  const targetIds = userIds.slice(0, 100);
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const userId of targetIds) {
    try {
      // Check user preference
      const prefField = alertType === 'aqi' ? 'aqi_alerts_enabled' : 'weather_alerts_enabled';
      const { data: prefs } = await supabaseAdmin
        .from('UserNotificationPreferences')
        .select(prefField)
        .eq('user_id', userId)
        .maybeSingle();

      // Default to enabled if no prefs row exists
      const isEnabled = prefs ? prefs[prefField] !== false : true;
      if (!isEnabled) {
        skipped++;
        continue;
      }

      // Check push tokens
      const { data: tokens } = await supabaseAdmin
        .from('PushToken')
        .select('token')
        .eq('user_id', userId);

      if (!tokens || tokens.length === 0) {
        skipped++;
        continue;
      }

      await pushService.sendToUser(userId, {
        title,
        body,
        data: { type: `${alertType}_alert`, route: '/hub', ...data },
      });
      sent++;
    } catch (err) {
      logger.error('Alert push failed', { userId, alertType, error: err.message });
      failed++;
    }
  }

  logger.info('Alert push complete', { alertType, sent, skipped, failed, total: targetIds.length });
  res.json({ sent, skipped, failed });
});

// ── POST /reminder-push ────────────────────────────────────────────

/**
 * POST /api/internal/briefing/reminder-push
 * Send a reminder push notification to a single user.
 * Called by the home reminder and mail notification Lambdas.
 *
 * Body: {
 *   userId: string,
 *   title: string,
 *   body: string,
 *   reminderType: 'bill_due' | 'task_due' | 'calendar' | 'mail_summary' | 'mail_urgent',
 *   data: { route, entityId, ... }
 * }
 */
router.post('/reminder-push', verifyInternalApiKey, async (req, res) => {
  const { userId, title, body, reminderType, data } = req.body;

  if (!userId || !UUID_RE.test(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }
  if (!title || !body) {
    return res.status(400).json({ error: 'title and body required' });
  }

  try {
    // Check preference + quiet hours in a single query
    const mailTypes = new Set(['mail_summary', 'mail_urgent']);
    const prefField = mailTypes.has(reminderType) ? 'mail_summary_enabled' : 'home_reminders_enabled';

    const { data: prefs } = await supabaseAdmin
      .from('UserNotificationPreferences')
      .select(`${prefField}, quiet_hours_start_local, quiet_hours_end_local, daily_briefing_timezone`)
      .eq('user_id', userId)
      .maybeSingle();

    // Default to enabled if no prefs row
    const isEnabled = prefs ? prefs[prefField] !== false : true;
    if (!isEnabled) {
      return res.json({ status: 'skipped', reason: 'preference_disabled' });
    }

    if (prefs && isInQuietHours(prefs)) {
      return res.json({ status: 'skipped', reason: 'quiet_hours' });
    }

    // Check push tokens
    const { data: tokens } = await supabaseAdmin
      .from('PushToken')
      .select('token')
      .eq('user_id', userId);

    if (!tokens || tokens.length === 0) {
      return res.json({ status: 'skipped', reason: 'no_push_token' });
    }

    await pushService.sendToUser(userId, {
      title,
      body,
      data: { type: reminderType, route: '/hub', ...data },
    });

    return res.json({ status: 'sent' });
  } catch (err) {
    logger.error('Reminder push failed', { userId, reminderType, error: err.message });
    return res.status(500).json({ status: 'failed', error: err.message });
  }
});

// ── POST /no-bid-nudge ────────────────────────────────────────────

/**
 * POST /api/internal/briefing/no-bid-nudge
 * Create an in-app notification + push for gig posters with no bids.
 * Called by the no_bid_nudge Lambda on a 6-hour schedule.
 *
 * Uses notificationService.createNotification() which handles:
 * - DB insert into Notification table
 * - Socket.IO real-time push to connected clients
 * - Badge count update
 * - Push notification delivery (with preference checks)
 *
 * Body: {
 *   userId: string,    — gig poster's user ID
 *   gigId: string,     — gig ID with no bids
 *   gigTitle: string,  — gig title for the notification body
 *   hasHome: boolean   — whether the poster has a verified home address
 * }
 */
router.post('/no-bid-nudge', verifyInternalApiKey, async (req, res) => {
  const { userId, gigId, gigTitle, hasHome } = req.body;

  if (!userId || !UUID_RE.test(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }
  if (!gigId) {
    return res.status(400).json({ error: 'gigId required' });
  }
  if (!gigTitle) {
    return res.status(400).json({ error: 'gigTitle required' });
  }

  try {
    const title = 'Hang tight \u2014 bids are coming';
    const body = hasHome
      ? `Your gig "${gigTitle}" hasn't received bids yet. Pantopus is just getting started \u2014 more people are signing up every day. Hang tight!`
      : `Your gig "${gigTitle}" hasn't received bids yet. Pantopus is just getting started \u2014 we're growing every day! Meanwhile, adding your home address helps neighbors trust you.`;

    const notification = await createNotification({
      userId,
      type: 'no_bid_gig_nudge',
      title,
      body,
      icon: '\u23F3',
      link: `/gigs/${gigId}`,
      metadata: { gig_id: gigId, has_home: !!hasHome },
    });

    if (!notification) {
      return res.json({ status: 'failed', reason: 'notification_creation_failed' });
    }

    return res.json({ status: 'sent', notificationId: notification.id });
  } catch (err) {
    logger.error('No-bid nudge failed', { userId, gigId, error: err.message });
    return res.status(500).json({ status: 'failed', error: err.message });
  }
});

module.exports = router;
