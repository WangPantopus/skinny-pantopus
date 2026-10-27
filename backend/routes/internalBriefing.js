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
const { collectInternalContext } = require('../services/context/internalContextCollector');
const { validTimezone } = require('../utils/timezone');
const { resolveLocation, resolveNotificationTimezone } = require('../services/context/locationResolver');
const { buildTomorrowPickupSignal } = require('../services/context/eveningBriefingService');
const addressCalendarService = require('../services/addressCalendarService');
const pushService = require('../services/pushService');
const { createNotification, isPushEnabled } = require('../services/notificationService');
const { skipForLaunchCut } = require('../utils/featureFlags');
const { recordFunnelEvent } = require('../services/funnelEvents');
const { composeBrief } = require('../services/ai/nudges/brief');
const { sendBrief } = require('../services/ai/nudges/engine');
const rules = require('../services/plans/planRules');

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

// ── Push routing ────────────────────────────────────────────────────
//
// The destination is carried under `link`. BOTH clients read
// `data["link"] ?? data["deepLink"]` and neither has ever read `route`
// (iOS `App/AppDelegate.swift`, Android `push/NotificationDispatcher.kt`),
// so a `route`-only payload produced no deep link at all — the gig push at
// the bottom of this file has always used `link` for exactly that reason.
// `route` is kept alongside as a harmless alias.
//
// The path is parsed by DeepLinkRouter on both clients
// (`frontend/apps/{ios,android}/**/DeepLinkRouter.{swift,kt}`), so these
// shapes are a contract:
//
//   /place                      → dashboard; the client resolves the home
//   /place/<homeId>             → that home's dashboard
//   /place/<homeId>/<slug>      → a group-detail page
//
// A slug is only appended alongside a home id, because the detail route
// needs both. Slugs must stay in the set both routers accept; an unknown
// one degrades to the dashboard rather than a dead link.
const PLACE_DETAIL_SLUGS = new Set([
  'today', 'your-home', 'risk', 'block', 'money', 'civic', 'identity',
]);

function placeRoute(homeId, slug) {
  const id = typeof homeId === 'string' && homeId.trim() ? homeId.trim() : null;
  if (!id) return '/place';
  if (slug && PLACE_DETAIL_SLUGS.has(slug)) return `/place/${id}/${slug}`;
  return `/place/${id}`;
}
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
  // An account without a preferences row gets the briefings GET /api/hub/preferences reports: both on.
  if (!prefs) return true;
  const value = prefs[briefingConfig.prefField];
  if (briefingKind === 'evening') {
    return value !== false;
  }
  return value === true;
}

/** Suggestions on and the brief not muted ("Fewer like this"): the morning briefing is the AI brief. */
function wantsAiBrief(prefs, briefingKind) {
  if (briefingKind !== 'morning' || prefs?.suggestions_enabled !== true) return false;
  const mutedUntil = Date.parse(prefs.suggestions_muted?.brief || '');
  return !(mutedUntil > Date.now());
}

/** The first moment of the person's next local day: the brief's cards stop working then. */
function endOfLocalDay(tz) {
  const tomorrow = rules.localParts(new Date(Date.now() + 24 * 60 * 60 * 1000), tz);
  return rules.zonedInstant(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0, tz);
}

/** The stored briefing screen both apps open for a delivery (DeepLinkRouter's hub-today). */
function storedBriefingRoute(briefingKind, deliveryId) {
  return `/hub-today?kind=${briefingKind}&deliveryId=${deliveryId}`;
}

/**
 * Check if the current time falls within the user's quiet hours.
 */
function isInQuietHours(prefs) {
  if (!prefs.quiet_hours_start_local || !prefs.quiet_hours_end_local) return false;

  const tz = validTimezone(prefs.daily_briefing_timezone) || 'UTC';
  let nowLocal;
  try {
    nowLocal = new Date().toLocaleTimeString('en-US', { timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' });
  } catch {
    nowLocal = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  }

  const start = prefs.quiet_hours_start_local.slice(0, 5);
  const end = prefs.quiet_hours_end_local.slice(0, 5);

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

// The scheduler uses the same location hierarchy as Today for accounts that
// have never explicitly chosen a notification timezone. No coordinates leave
// this authenticated internal endpoint.
router.post('/timezones', verifyInternalApiKey, async (req, res) => {
  const ids = req.body?.userIds;
  if (!Array.isArray(ids) || ids.length > 100 || ids.some(id => typeof id !== 'string' || !UUID_RE.test(id))) {
    return res.status(400).json({ error: 'Invalid userIds' });
  }
  try {
    const zones = {};
    for (const userId of new Set(ids)) zones[userId] = await resolveNotificationTimezone(userId);
    return res.json({ timezones: zones });
  } catch (err) {
    logger.error('Internal timezone lookup failed', { error: err.message });
    return res.status(503).json({ error: 'Timezone lookup unavailable' });
  }
});

/**
 * Today's AI brief, sent through the assistant's engine: its Notification row, its message in
 * the assistant conversation and one push (held while the person's own quiet hours last).
 * Returns the route's answer, or null to send the template briefing instead: a model error, a
 * cap, nothing worth saying, no home to brief about.
 */
async function sendAiBrief({ userId, deliveryId, tz, todayLocal }) {
  try {
    const expiresAt = endOfLocalDay(tz);
    const composed = await composeBrief(userId, { timeZone: tz, expiresAt });
    if (composed.fallback) {
      logger.info('Briefing: AI brief not written, sending the template', { userId, reason: composed.fallback });
      return null;
    }
    const sent = await sendBrief({ userId, date: todayLocal, lines: composed.lines, cards: composed.cards, expiresAt });
    if (!sent.sent) {
      // Today's brief already went out: never a second briefing on top of it.
      if (sent.reason === 'duplicate' || sent.reason === 'cap') {
        await supabaseAdmin.from('DailyBriefingDelivery').update({ status: 'skipped', skip_reason: 'brief_already_sent' }).eq('id', deliveryId);
        return { status: 'skipped', skip_reason: 'brief_already_sent' };
      }
      logger.info('Briefing: AI brief not sent, sending the template', { userId, reason: sent.reason });
      return null;
    }
    const text = composed.lines.join('\n');
    await supabaseAdmin.from('DailyBriefingDelivery').update({
      status: 'sent',
      delivered_at: new Date().toISOString(),
      summary_text: text,
      composition_mode: 'ai_polished',
      ai_tokens_used: composed.usage.inputTokens + composed.usage.outputTokens,
      notification_id: sent.notificationId,
    }).eq('id', deliveryId);
    logger.info('Briefing sent', { userId, briefingKind: 'morning', mode: 'ai', cards: composed.cards.length });
    return { status: 'sent', text, mode: 'ai', briefing_kind: 'morning', notification_id: sent.notificationId };
  } catch (err) {
    logger.warn('Briefing: AI brief failed, sending the template', { userId, error: err.message });
    return null;
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
    const { data: prefsRow, error: prefsError } = await supabaseAdmin
      .from('UserNotificationPreferences')
      .select(`${briefingConfig.prefField}, daily_briefing_timezone, quiet_hours_start_local, quiet_hours_end_local, suggestions_enabled, suggestions_muted`)
      .eq('user_id', userId)
      .maybeSingle();
    // A read that failed can't show the person kept their briefing on: try again later.
    if (prefsError) {
      return res.status(503).json({ status: 'failed', error: 'Notification preferences are unavailable.' });
    }

    const prefs = {
      [briefingConfig.prefField]: true,
      daily_briefing_timezone: null,
      quiet_hours_start_local: null,
      quiet_hours_end_local: null,
      ...(prefsRow || {}),
    };

    if (!isBriefingEnabled(prefsRow, briefingConfig, briefingKind)) {
      return res.json({ status: 'skipped', skip_reason: 'opted_out' });
    }

    prefs.daily_briefing_timezone = await resolveNotificationTimezone(userId, prefs);
    if (!prefs.daily_briefing_timezone) return res.json({ status: 'skipped', skip_reason: 'timezone_unavailable' });

    // 3. Check quiet hours. The AI brief is sent anyway: its push waits until they end.
    const aiBrief = wantsAiBrief(prefsRow, briefingKind);
    if (!aiBrief && isInQuietHours(prefs)) {
      return res.json({ status: 'skipped', skip_reason: 'quiet_hours' });
    }

    // 4. Check idempotency
    const tz = validTimezone(prefs.daily_briefing_timezone) || 'UTC';
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

    // 5b. With Suggestions on, the AI brief (contract §4); the template briefing when it can't be written.
    if (aiBrief) {
      const sent = await sendAiBrief({ userId, deliveryId, tz, todayLocal });
      if (sent) return res.json(sent);
      if (isInQuietHours(prefs)) {
        await supabaseAdmin.from('DailyBriefingDelivery').update({ status: 'skipped', skip_reason: 'quiet_hours' }).eq('id', deliveryId);
        return res.json({ status: 'skipped', skip_reason: 'quiet_hours' });
      }
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

    // 8. Check the account's Push Notifications switch (Settings), as every other push does, then push tokens
    const pushEnabled = await isPushEnabled(userId);
    const { data: tokens } = pushEnabled ? await supabaseAdmin
      .from('PushToken')
      .select('token')
      .eq('user_id', userId) : { data: [] };

    // Settings/token reads may outlast composition. Recheck the same current
    // private projections before either storing the text or handing it to push.
    const householdSignals = (result.signals_snapshot || []).filter(signal => ['bill_due', 'task_due', 'calendar'].includes(signal.kind));
    if (householdSignals.length) {
      const current = await collectInternalContext(userId, result.home_id || null, prefs.daily_briefing_timezone);
      const records = {
        bill_due: { rows: current.bills_due || [], id: 'bill_id', due: 'due_date', fields: ['amount'] },
        task_due: { rows: current.tasks_due || [], id: 'task_id', due: 'due_at', fields: ['priority'] },
        calendar: { rows: current.calendar_events || [], id: 'event_id', due: 'start_at', fields: ['event_type'] },
      };
      if (householdSignals.some(signal => {
        const group = records[signal.kind];
        const row = group.rows.find(record => record.id === signal.data?.[group.id]);
        return !row || row[group.due] !== signal.data?.[group.due]
          || group.fields.some(field => signal.data?.[field] !== undefined && row[field] !== signal.data[field]);
      })) {
        throw Object.assign(new Error('Home access changed while loading. Please retry.'), { code: 'HOME_LIST_ACCESS_CHANGED', statusCode: 503 });
      }
    }

    const lead = result.signals_snapshot?.[0];
    let pickup = null;
    if (lead?.kind === 'address_calendar' && typeof lead.data?.identity === 'string' && lead.data.identity.startsWith('pickup:')) {
      const currentLocation = await resolveLocation(userId);
      if (briefingKind !== 'evening' || !result.home_id || currentLocation.homeId !== result.home_id) {
        throw Object.assign(new Error('Home access changed while loading. Please retry.'), { code: 'HOME_LIST_ACCESS_CHANGED' });
      }
      const calendar = await addressCalendarService.composeForHomeId(result.home_id, { userId });
      pickup = buildTomorrowPickupSignal(calendar, currentLocation.timezone);
      if (!pickup || pickup.label !== lead.label || JSON.stringify(pickup.data) !== JSON.stringify(lead.data)) {
        throw Object.assign(new Error('The pickup schedule changed. Please retry.'), { code: 'HOME_LIST_ACCESS_CHANGED' });
      }
    }
    const messageText = pickup ? pickup.detail : result.text;

    if (!pushEnabled) {
      await supabaseAdmin
        .from('DailyBriefingDelivery')
        .update({ status: 'skipped', skip_reason: 'push_disabled', summary_text: messageText })
        .eq('id', deliveryId);

      return res.json({ status: 'skipped', skip_reason: 'push_disabled' });
    }

    if (!tokens || tokens.length === 0) {
      await supabaseAdmin
        .from('DailyBriefingDelivery')
        .update({ status: 'skipped', skip_reason: 'no_push_token', summary_text: messageText })
        .eq('id', deliveryId);

      return res.json({ status: 'skipped', skip_reason: 'no_push_token' });
    }

    // 9. Send push
    // The morning briefing opens its stored briefing screen (GET /api/hub/briefings/:id), where
    // the copy it summarizes is. The evening briefing routes to Place, not /hub: both mobile
    // clients auto-land the Home tab on the Place dashboard, so a push that opened /hub dropped
    // the user on the *secondary* address surface. The home id comes from the same location the
    // briefing was composed for, so the link opens the dashboard for the address the copy is about.
    const link = briefingKind === 'morning' ? storedBriefingRoute(briefingKind, deliveryId) : placeRoute(result.home_id);
    const receipt = await pushService.sendToUserWithReceipt(userId, {
      title: pickup ? pickup.label : briefingConfig.title,
      body: messageText,
      data: {
        type: briefingConfig.notificationType,
        link,
        route: link,
        homeId: result.home_id || null,
        briefingKind,
        briefingDeliveryId: deliveryId,
        ...(pickup ? { category: 'PICKUP_REMINDER', pickupDate: pickup.data.date, link: '/app/today', route: '/app/today' } : {}),
        // The action receiver must never borrow another account's notification.
        ...(pickup ? { recipient_user_id: userId } : {}),
      },
    });

    // A provider must accept at least one device before this user/day is
    // settled. Partial acceptance settles it to avoid duplicating that device.
    if (!Number.isInteger(receipt?.acceptedCount) || receipt.acceptedCount < 1) {
      throw Object.assign(new Error('Push provider did not accept the briefing.'), { code: 'PUSH_NOT_ACCEPTED' });
    }
    if (pickup) {
      await recordFunnelEvent('reminder_sent', { userId, meta: { kind: 'pickup' } });
    }

    // 10. Update delivery row
    await supabaseAdmin
      .from('DailyBriefingDelivery')
      .update({
        status: 'sent',
        delivered_at: new Date().toISOString(),
        summary_text: messageText,
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

    return res.json({ status: 'sent', text: messageText, mode: result.mode, briefing_kind: briefingKind });
  } catch (err) {
    logger.error('Briefing send error', { userId, briefingKind, error: err.message });

    // Update delivery row to failed if we have one
    if (deliveryId) {
      // Query builders are thenables without .catch, so wrap the update:
      // otherwise this line throws, the row stays 'composing' (which later
      // runs skip as already processed) and the 500 below is never sent.
      await Promise.resolve(
        supabaseAdmin
          .from('DailyBriefingDelivery')
          .update({ status: 'failed', error_message: err.message })
          .eq('id', deliveryId),
      ).catch(() => {}); // Don't let logging fail the error response
    }

    return res.status(err.code === 'PUSH_NOT_ACCEPTED' ? 503 : 500).json({ status: 'failed', error: err.message });
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

      // The account's Push Notifications switch (Settings) turns these off too.
      if (!(await isPushEnabled(userId))) {
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
        // Weather and air-quality alerts are Today-group content, so they
        // open the Place Today detail rather than the Hub.
        data: {
          type: `${alertType}_alert`,
          link: placeRoute(data?.homeId, 'today'),
          route: placeRoute(data?.homeId, 'today'),
          ...data,
        },
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
  // Launch cut #7 (Household extras): bill and family-calendar reminders are off for the first launch.
  if (['bill_due', 'calendar'].includes(reminderType) && skipForLaunchCut('household_extras', `reminder-push:${reminderType}`)) {
    return res.json({ status: 'skipped', reason: 'feature_hidden' });
  }
  // Launch cut #10 (Mailbox): the mail notification Lambda's pushes are off while the mailbox is.
  if (MAIL_REMINDER_TYPES.has(reminderType) && skipForLaunchCut('mailbox', `reminder-push:${reminderType}`)) {
    return res.json({ status: 'skipped', reason: 'feature_hidden' });
  }
  const result = await sendReminderPush({ userId, title, body, reminderType, data });
  return res.status(result.httpStatus || 200).json(result.payload);
});

// Mail pushes open the Mail tab: the morning notice the Mailbox, an urgent piece that piece (an older Lambda build
// still says '/mailbox', and the Place link the other reminders use would open Place).
const MAIL_REMINDER_TYPES = new Set(['mail_summary', 'mail_urgent']);
function mailReminderRoute(reminderType, data) {
  if (reminderType === 'mail_urgent' && data?.entityId && UUID_RE.test(String(data.entityId))) {
    return `/app/mailbox/${data.entityId}`;
  }
  return '/app/mailbox';
}

/**
 * Send one reminder push to one person, after their preference, quiet hours and push switch. Answers the response the
 * reminder-push route gives: { httpStatus, payload: { status: 'sent' | 'skipped' | 'failed', reason } }.
 */
async function sendReminderPush({ userId, title, body, reminderType, data }) {
  const mailTypes = MAIL_REMINDER_TYPES;
  // Collects the answer the reminder-push route has always given (its HTTP status and body).
  const res = { status(code) { this.httpStatus = code; return this; }, json(payload) { this.payload = payload; return this; } };
  try {
    // Check preference + quiet hours in a single query
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

    if (prefs) {
      prefs.daily_briefing_timezone = await resolveNotificationTimezone(userId, prefs);
      if (!prefs.daily_briefing_timezone && prefs.quiet_hours_start_local && prefs.quiet_hours_end_local) {
        return res.json({ status: 'skipped', reason: 'timezone_unavailable' });
      }
    }
    if (prefs && isInQuietHours(prefs)) {
      return res.json({ status: 'skipped', reason: 'quiet_hours' });
    }

    // The account's Push Notifications switch (Settings) turns these off too.
    if (!(await isPushEnabled(userId))) {
      return res.json({ status: 'skipped', reason: 'push_disabled' });
    }

    // Check push tokens
    const { data: tokens } = await supabaseAdmin
      .from('PushToken')
      .select('token')
      .eq('user_id', userId);

    if (!tokens || tokens.length === 0) {
      return res.json({ status: 'skipped', reason: 'no_push_token' });
    }

    const mailRoute = mailTypes.has(reminderType) ? mailReminderRoute(reminderType, data) : null;
    const receipt = await pushService.sendToUserWithReceipt(userId, {
      title,
      body,
      data: {
        type: reminderType,
        link: placeRoute(data?.homeId),
        route: placeRoute(data?.homeId),
        ...data,
        ...(mailRoute ? { link: mailRoute, route: mailRoute } : {}),
        // Notification actions must refuse a prior account's notification
        // after a switch. Bind this to the server's exact push recipient.
        recipient_user_id: userId,
      },
    });

    // At least one provider must accept the notification before the
    // scheduler records its user/day dedup. Zero acceptance stays retryable;
    // partial acceptance settles it without repeating an accepted device.
    if (!Number.isInteger(receipt?.acceptedCount) || receipt.acceptedCount < 1) {
      return res.status(503).json({ status: 'failed', reason: 'push_not_accepted' });
    }
    if (reminderType === 'task_due') {
      await recordFunnelEvent('reminder_sent', { userId, meta: { kind: 'task' } });
    }
    return res.json({ status: 'sent' });
  } catch (err) {
    logger.error('Reminder push failed', { userId, reminderType, error: err.message });
    return res.status(500).json({ status: 'failed', error: err.message });
  }
}

// ── POST /mail-morning ─────────────────────────────────────────────

/**
 * POST /api/internal/briefing/mail-morning
 * The Mail tab's morning notice ("Your mail is here"), called by the mail notification Lambda every five minutes.
 * Each call sends the notice to the people whose own morning it is and whose round brought them mail they can read,
 * once per person per local day (services/mailMorningNotice). Answers counts only.
 */
router.post('/mail-morning', verifyInternalApiKey, async (req, res) => {
  // Launch cut #10 (Mailbox): no mail notices while the mailbox is off.
  if (skipForLaunchCut('mailbox', 'mail-morning')) {
    return res.json({ status: 'skipped', reason: 'feature_hidden' });
  }
  try {
    const { runMorningNotices } = require('../services/mailMorningNotice');
    const stats = await runMorningNotices({
      send: async (push) => (await sendReminderPush(push)).payload || { status: 'failed' },
    });
    logger.info('Mail morning notices', stats);
    return res.json({ status: 'ok', ...stats });
  } catch (err) {
    logger.error('Mail morning notices failed', { error: err.message });
    return res.status(500).json({ status: 'failed', error: "Couldn't send this morning's mail notices.", code: 'MAIL_MORNING_FAILED' });
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
  // Launch cut #4 (Open Gigs): the no-bid nudge is off for the first launch.
  if (skipForLaunchCut('open_gigs', 'no-bid-nudge')) {
    return res.json({ status: 'skipped', reason: 'feature_hidden' });
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
// Exported for unit testing — the route shapes are a client contract.
module.exports.placeRoute = placeRoute;
