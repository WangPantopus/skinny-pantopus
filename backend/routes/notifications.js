/**
 * Notification Routes
 *
 * GET    /api/notifications              — list notifications (paginated, unread count)
 * PATCH  /api/notifications/:id/read     — mark single as read
 * POST   /api/notifications/read-all     — mark all as read
 * DELETE /api/notifications/:id          — delete single
 * POST   /api/notifications/register     — register a device token (APNs/FCM/Expo)
 * POST   /api/notifications/push-token   — register Expo push token (legacy)
 * DELETE /api/notifications/push-token   — unregister Expo push token (legacy)
 */

const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const logger = require('../utils/logger');
const { NOTIFICATION_LIST } = require('../utils/columns');
const pushService = require('../services/pushService');

const FIREWALL_VALUES = ['personal', 'audience', 'platform'];
const CONTEXT_INPUT = ['all', ...FIREWALL_VALUES];
const LEGACY_CONTEXT_TYPES = ['personal', 'business'];

function parseFirewallFilter(req, { allowMultiple = false } = {}) {
  const contextRaw = req.query.context ?? req.body?.context;
  const firewallRaw = req.query.firewall ?? req.body?.firewall;
  const contextsRaw = req.query.contexts ?? req.body?.contexts;
  const raw = contextsRaw ?? contextRaw ?? firewallRaw;

  if (raw === undefined || raw === null || raw === '') return { contexts: null };

  const values = Array.isArray(raw)
    ? raw
    : String(raw).split(',').map((value) => value.trim()).filter(Boolean);

  if (values.length === 0 || values.includes('all')) return { contexts: null };
  if (!allowMultiple && values.length > 1) return { error: 'invalid context' };

  for (const value of values) {
    if (!FIREWALL_VALUES.includes(value)) return { error: 'invalid context' };
  }
  return { contexts: values };
}

function applyNotificationFilters(query, {
  contextType,
  contextId,
  contexts,
}) {
  let next = query;
  if (contextType === 'personal') {
    next = next.eq('context_type', 'personal');
  } else if (contextType === 'business') {
    next = next.eq('context_type', 'business');
    if (contextId) next = next.eq('context_id', contextId);
  }
  if (contexts?.length === 1) {
    next = next.eq('context', contexts[0]);
  } else if (contexts?.length > 1) {
    next = next.in('context', contexts);
  }
  return next;
}

/**
 * GET /api/notifications
 * Returns notifications for the current user + unread count.
 * Query params:
 *   limit  — max results (default 20, max 50)
 *   offset — pagination offset (default 0)
 *   unread — if "true", only return unread
 *   context — 'all' | 'personal' | 'audience' | 'platform' (default 'all')
 *     P2.3 / unified-IA §6: filters Notification.context (the firewall
 *     column from P0.6). Personal-zone bell scopes to personal+platform;
 *     Audience-zone megaphone scopes to audience only.
 *   context_type — 'personal' | 'business' (legacy Identity Firewall axis)
 *     Filters the older context_type column. Independent of `context`;
 *     both compose. Renamed in P2.3 to avoid colliding with the firewall
 *     param above; previously this was also called `context`.
 *   context_id — business_user_id to filter business notifications
 *   firewall — alias for `context` kept for P0.6 internal callers.
 *     New code should pass `context` instead.
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = parseInt(req.query.offset) || 0;
    const unreadOnly = req.query.unread === 'true';
    const contextType = req.query.context_type; // legacy 'personal' | 'business'
    const contextId = req.query.context_id;

    // Firewall filter accepts either ?context= (new, preferred) or
    // ?firewall= (P0.6-era internal callers). Validate strictly so
    // typos surface as 400 instead of returning the unfiltered list.
    const contextRaw = req.query.context ?? req.query.firewall;
    if (contextRaw !== undefined && contextRaw !== null && contextRaw !== '' && !CONTEXT_INPUT.includes(contextRaw)) {
      return res.status(400).json({ error: 'invalid context' });
    }
    if (contextType && !LEGACY_CONTEXT_TYPES.includes(contextType)) {
      return res.status(400).json({ error: 'invalid context_type' });
    }
    const contexts = contextRaw && contextRaw !== 'all' ? [contextRaw] : null;

    // Get notifications
    let query = supabaseAdmin
      .from('Notification')
      .select(NOTIFICATION_LIST)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    query = applyNotificationFilters(query, { contextType, contextId, contexts });

    const { data: notifications, error } = await query;

    if (error) {
      logger.error('Error fetching notifications', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch notifications' });
    }

    // Get unread count (always, for the badge)
    let countQuery = supabaseAdmin
      .from('Notification')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    countQuery = applyNotificationFilters(countQuery, { contextType, contextId, contexts });

    const { count: unreadCount, error: countErr } = await countQuery;

    if (countErr) {
      logger.error('Error counting unread notifications', { error: countErr.message });
    }

    res.json({
      notifications: notifications || [],
      unreadCount: unreadCount || 0,
      hasMore: (notifications || []).length === limit,
    });
  } catch (err) {
    logger.error('Notifications fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * GET /api/notifications/unread-count
 * Quick endpoint for the bell badge — returns the total + a per-firewall
 * breakdown (P2.3 / unified-IA §6.1: separate streams for personal vs
 * audience, never combined). Existing callers reading `count` keep working.
 *
 *   { count: 12, byContext: { personal: 9, audience: 3, platform: 0 } }
 */
router.get('/unread-count', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const baseFilter = (q) => q
      .from('Notification')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    const [totalRes, personalRes, audienceRes, platformRes] = await Promise.all([
      baseFilter(supabaseAdmin),
      baseFilter(supabaseAdmin).eq('context', 'personal'),
      baseFilter(supabaseAdmin).eq('context', 'audience'),
      baseFilter(supabaseAdmin).eq('context', 'platform'),
    ]);

    const firstError = [totalRes, personalRes, audienceRes, platformRes]
      .map((r) => r && r.error)
      .find(Boolean);
    if (firstError) {
      logger.error('Error counting unread', { error: firstError.message });
      return res.status(500).json({ error: 'Failed to count notifications' });
    }

    const total = totalRes.count || 0;
    const byContext = {
      personal: personalRes.count || 0,
      audience: audienceRes.count || 0,
      platform: platformRes.count || 0,
    };

    res.json({ count: total, total, byContext });
  } catch (err) {
    logger.error('Unread count error', { error: err.message });
    res.status(500).json({ error: 'Failed to count notifications' });
  }
});

/**
 * GET /api/notifications/no-bid-nudge-check
 * Lightweight check used by the mobile floating-modal trigger.
 * Returns whether the user has an unread no_bid_gig_nudge notification
 * and whether they have a verified home address.
 */
router.get('/no-bid-nudge-check', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { count, error } = await supabaseAdmin
      .from('Notification')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'no_bid_gig_nudge')
      .eq('is_read', false);

    if (error || !count) {
      return res.json({ eligible: false });
    }

    // Check if user has an active, verified home
    const { count: homeCount } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('verification_status', 'verified');

    return res.json({ eligible: true, hasHome: (homeCount || 0) > 0 });
  } catch (err) {
    logger.error('No-bid nudge check error', { error: err.message });
    return res.json({ eligible: false });
  }
});

/**
 * POST /api/notifications/no-bid-nudge-mark-read
 * Marks all unread no_bid_gig_nudge notifications as read for the user.
 * Called by the mobile floating-modal trigger after the modal is shown
 * (or was already dismissed) to prevent blocking lower-priority promos.
 */
router.post('/no-bid-nudge-mark-read', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await supabaseAdmin
      .from('Notification')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('type', 'no_bid_gig_nudge')
      .eq('is_read', false);

    if (error) {
      logger.error('Failed to mark no-bid nudge read', { error: error.message });
      return res.status(500).json({ error: 'update_failed' });
    }

    return res.json({ ok: true });
  } catch (err) {
    logger.error('No-bid nudge mark-read error', { error: err.message });
    return res.status(500).json({ error: 'internal' });
  }
});

/**
 * POST /api/notifications/register
 * Unified device-token registration for native push (APNs/FCM) and the
 * legacy Expo path. The iOS and Android clients both POST here.
 * Body: { token: string, platform?: "ios"|"android", provider?: "apns"|"fcm"|"expo" }
 *
 * `platform`/`provider` are persisted so the send path can route the
 * token to the right transport; either may be omitted and is derived
 * from the other (or from the token format for Expo tokens).
 */
router.post('/register', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, platform, provider } = req.body || {};

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Push token is required' });
    }
    if (platform && !['ios', 'android'].includes(String(platform).toLowerCase())) {
      return res.status(400).json({ error: 'Invalid platform' });
    }
    if (provider && !['apns', 'fcm', 'expo'].includes(String(provider).toLowerCase())) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    const saved = await pushService.saveToken(userId, token, { platform, provider });
    if (!saved) {
      return res.status(400).json({ error: 'Invalid push token' });
    }

    // Mirror the legacy /push-token route: the user just opted into push on
    // their device, so ensure push_notifications is enabled at the
    // preference level (create the row if missing, flip it on if disabled).
    await supabaseAdmin
      .from('MailPreferences')
      .upsert(
        { user_id: userId, push_notifications: true, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
      .then(({ error: prefErr }) => {
        if (prefErr) logger.warn('Failed to enable push preference', { error: prefErr.message, userId });
      });

    res.json({ message: 'Device registered for push', pushToken: saved });
  } catch (err) {
    logger.error('Device registration error', { error: err.message });
    res.status(500).json({ error: 'Failed to register device' });
  }
});

/**
 * POST /api/notifications/push-token
 * Register an Expo push token for the current user.
 * Body: { token: "ExponentPushToken[...]" }
 */
router.post('/push-token', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Push token is required' });
    }

    const saved = await pushService.saveToken(userId, token);
    if (!saved) {
      return res.status(400).json({ error: 'Invalid push token format' });
    }

    // Ensure push_notifications is enabled in MailPreferences.
    // The user just accepted push notifications on their device, so we
    // create the preference row (if missing) with push enabled, or
    // flip the flag on if it was previously disabled.
    await supabaseAdmin
      .from('MailPreferences')
      .upsert(
        { user_id: userId, push_notifications: true, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
      .then(({ error: prefErr }) => {
        if (prefErr) logger.warn('Failed to enable push preference', { error: prefErr.message, userId });
      });

    res.json({ message: 'Push token registered', pushToken: saved });
  } catch (err) {
    logger.error('Push token registration error', { error: err.message });
    res.status(500).json({ error: 'Failed to register push token' });
  }
});

/**
 * DELETE /api/notifications/push-token
 * Unregister an Expo push token (e.g. on logout).
 * Body: { token: "ExponentPushToken[...]" }
 */
router.delete('/push-token', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Push token is required' });
    }

    await pushService.removeToken(userId, token);
    res.json({ message: 'Push token removed' });
  } catch (err) {
    logger.error('Push token removal error', { error: err.message });
    res.status(500).json({ error: 'Failed to remove push token' });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
router.patch('/:id/read', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data, error } = await supabaseAdmin
      .from('Notification')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Error marking notification read', { error: error.message, id });
      return res.status(500).json({ error: 'Failed to update notification' });
    }

    res.json({ notification: data });
  } catch (err) {
    logger.error('Mark read error', { error: err.message });
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read for the current user. Optional body/query:
 *   context | contexts | firewall — personal/audience/platform/all
 *   context_type/context_id       — legacy personal/business sub-filter
 */
router.post('/read-all', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const contextType = req.query.context_type ?? req.body?.context_type;
    const contextId = req.query.context_id ?? req.body?.context_id;
    if (contextType && !LEGACY_CONTEXT_TYPES.includes(contextType)) {
      return res.status(400).json({ error: 'invalid context_type' });
    }
    const parsed = parseFirewallFilter(req, { allowMultiple: true });
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    let query = supabaseAdmin
      .from('Notification')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    query = applyNotificationFilters(query, {
      contextType,
      contextId,
      contexts: parsed.contexts,
    });

    const { error } = await query;

    if (error) {
      logger.error('Error marking all read', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to mark all as read' });
    }

    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    logger.error('Mark all read error', { error: err.message });
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a single notification.
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { error } = await supabaseAdmin
      .from('Notification')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      logger.error('Error deleting notification', { error: error.message, id });
      return res.status(500).json({ error: 'Failed to delete notification' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (err) {
    logger.error('Delete notification error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;
