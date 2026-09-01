// Persona DM routes.
//
// Audience Profile design v2 §6.2 (notification firewall — every
// notification fires from an audience-context template), §7.2
// (reply-policy SLA), §10 (route surface).
//
// Mounted at /api/personas/:id/dms with the same UUID-gate pattern as
// personaTiers / personaPayments so handle-shaped URLs fall through to
// the public personas router. Owner sees all threads on the persona;
// fan sees only their own.
//
// Privacy invariants enforced here:
//   * No persona owner's user_id or fan's user_id ever appears in a
//     response. Threads carry membership_id; messages carry sender_role.
//   * Audience-context notifications use the registered templates only
//     (registerTemplate harness rejects unknown placeholders at load).
//   * Quota / block / tier-gate failures return well-defined codes
//     (402 for quota, 403 for the rest) — no leaking of which gate
//     fired beyond what the fan needs to act on.

const express = require('express');
const Joi = require('joi');
const router = express.Router({ mergeParams: true });

const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const requireFeatureFlag = require('../middleware/requireFeatureFlag');
const logger = require('../utils/logger');
const dmService = require('../services/personaDmService');
const notificationService = require('../services/notificationService');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.use((req, _res, next) => {
  if (!UUID_RE.test(req.params.id || '')) return next('router');
  return next();
});

router.use(verifyToken, requireFeatureFlag('audience_profile'));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Translate a service-layer code into a (status, body) pair.
function codeToHttp(code) {
  if (code === 'quota_exhausted')      return [402, { error: code }];
  if (code === 'tier_does_not_allow')  return [403, { error: code }];
  if (code === 'blocked')              return [403, { error: code }];
  if (code === 'no_membership')        return [403, { error: code }];
  if (code === 'empty_body')           return [400, { error: code }];
  if (code === 'invalid_args')         return [400, { error: code }];
  return [500, { error: code || 'internal_error' }];
}

// Owner-and-fan-aware thread serializer. Returns the inbox row shape
// the frontend list view needs. Critically does NOT carry user_id of
// either side — the membership_id is the canonical reference.
function serializeThreadForInbox(row, viewerRole) {
  return {
    id: row.id,
    membershipId: row.membership_id,
    status: row.status,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview,
    unreadCount: viewerRole === 'creator'
      ? Number(row.creator_unread_count || 0)
      : Number(row.fan_unread_count || 0),
    fanHandle: row._fan_handle,
    fanDisplayName: row._fan_display_name || row._fan_handle,
    fanAvatarUrl: row._fan_avatar_url || null,
    tier: row._tier_rank
      ? { rank: row._tier_rank, name: row._tier_name }
      : null,
  };
}

// Hydrate a thread row with the joined membership + tier fields. The
// mock supabaseAdmin doesn't parse Supabase's nested-select syntax,
// so do sequential fetches and merge under `_`-prefixed scratch keys.
async function hydrateThreadsForInbox(threads) {
  if (!threads || threads.length === 0) return [];
  const membershipIds = [...new Set(threads.map((t) => t.membership_id))];
  const { data: memberships } = await supabaseAdmin
    .from('PersonaMembership')
    .select('id, fan_handle, fan_display_name, fan_avatar_url, tier_id')
    .in('id', membershipIds);
  const memMap = new Map((memberships || []).map((m) => [m.id, m]));

  const tierIds = [...new Set((memberships || []).map((m) => m.tier_id).filter(Boolean))];
  let tierMap = new Map();
  if (tierIds.length) {
    const { data: tiers } = await supabaseAdmin
      .from('PersonaTier')
      .select('id, rank, name')
      .in('id', tierIds);
    tierMap = new Map((tiers || []).map((t) => [t.id, t]));
  }

  return threads.map((t) => {
    const m = memMap.get(t.membership_id);
    const tier = m && m.tier_id ? tierMap.get(m.tier_id) : null;
    return {
      ...t,
      _fan_handle: m?.fan_handle || null,
      _fan_display_name: m?.fan_display_name || null,
      _fan_avatar_url: m?.fan_avatar_url || null,
      _tier_rank: tier?.rank || null,
      _tier_name: tier?.name || null,
    };
  });
}

// Serialize a single PersonaDmMessage. NEVER returns sender_user_id.
function serializeMessage(m) {
  return {
    id: m.id,
    threadId: m.thread_id,
    senderRole: m.sender_role,
    body: m.body,
    media: Array.isArray(m.media) ? m.media : [],
    createdAt: m.created_at,
    readAt: m.read_at || null,
  };
}

// ---------------------------------------------------------------------------
// POST /api/personas/:id/dms/threads — fan opens a new DM thread.
// ---------------------------------------------------------------------------
const openThreadSchema = Joi.object({
  body: Joi.string().trim().min(1).max(2000).required(),
  media: Joi.array().items(Joi.object().unknown(true)).max(5).default([]),
});

router.post('/threads', validate(openThreadSchema), async (req, res) => {
  const personaId = req.params.id;
  const result = await dmService.openThread({
    personaId,
    fanUserId: req.user.id,
    initiatedByRole: 'fan',
    initiatedByUserId: req.user.id,
    body: req.body.body,
    media: req.body.media,
  });
  if (!result.ok) {
    const [status, body] = codeToHttp(result.code);
    return res.status(status).json(body);
  }

  // Audience-context notification to the creator. Uses the registered
  // template — placeholder names match the audience-allowlist in
  // notificationTemplateRegistry.js (fan.handle, message,
  // membership.id) so it can never carry a personal-side identifier.
  try {
    await notificationService.createNotification({
      userId: result.membership.persona.user_id,
      type: 'persona_dm_received_creator',
      context: 'audience',
      title: `New message from ${result.membership.fan_handle}`,
      body: String(req.body.body).slice(0, 100),
      link: `/app/audience/inbox/${result.membership.id}`,
      metadata: {
        thread_id: result.threadId,
        membership_id: result.membership.id,
        persona_id: personaId,
        fan_handle: result.membership.fan_handle,
      },
    });
  } catch (err) {
    logger.warn('persona_dm.notification_creator_failed', {
      threadId: result.threadId, error: err.message,
    });
  }

  return res.status(201).json({
    threadId: result.threadId,
    quotaRemaining: result.quotaRemaining,
  });
});

// ---------------------------------------------------------------------------
// GET /api/personas/:id/dms/threads — list threads.
// Owner: every thread on the persona. Fan: only their own.
// ---------------------------------------------------------------------------
router.get('/threads', async (req, res) => {
  const personaId = req.params.id;
  const { data: persona } = await supabaseAdmin
    .from('PublicPersona')
    .select('id, user_id')
    .eq('id', personaId)
    .maybeSingle();
  if (!persona) return res.status(404).json({ error: 'Not found' });

  const isOwner = persona.user_id === req.user.id;
  let viewerRole = isOwner ? 'creator' : 'fan';
  let viewerMembershipId = null;
  if (!isOwner) {
    const { data: membership } = await supabaseAdmin
      .from('PersonaMembership')
      .select('id, status')
      .eq('persona_id', personaId)
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (!membership || !['active', 'past_due'].includes(membership.status)) {
      // No membership → no threads to list.
      return res.json({ threads: [] });
    }
    viewerMembershipId = membership.id;
  }

  let query = supabaseAdmin
    .from('PersonaDmThread')
    .select('*')
    .eq('persona_id', personaId)
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (!isOwner) query = query.eq('membership_id', viewerMembershipId);

  const { data: threads, error } = await query;
  if (error) {
    logger.error('persona_dm.list_error', { error: error.message, personaId });
    return res.status(500).json({ error: 'Internal error' });
  }

  const hydrated = await hydrateThreadsForInbox(threads || []);
  return res.json({
    threads: hydrated.map((t) => serializeThreadForInbox(t, viewerRole)),
  });
});

// ---------------------------------------------------------------------------
// GET /api/personas/:id/dms/threads/:threadId — thread detail.
// Marks the calling viewer's unread counter to 0 and stamps read_at on
// any messages they hadn't seen.
// ---------------------------------------------------------------------------
router.get('/threads/:threadId', async (req, res) => {
  const viewer = await dmService.resolveThreadViewer(
    req.params.threadId, req.user.id,
  );
  if (!viewer) return res.status(404).json({ error: 'Not found' });
  if (viewer.thread.persona_id !== req.params.id) {
    return res.status(404).json({ error: 'Not found' });
  }

  const { data: messagesRaw } = await supabaseAdmin
    .from('PersonaDmMessage')
    .select('id, thread_id, sender_role, body, media, created_at, read_at')
    .eq('thread_id', req.params.threadId)
    .order('created_at', { ascending: true });

  const messages = (messagesRaw || []).map(serializeMessage);

  // Mark-as-read for the OTHER side's messages: the viewer is reading,
  // so messages whose sender_role != viewer.role become "read by the
  // viewer." Stamp read_at on rows that don't already have one, and
  // zero the viewer's unread counter on the thread.
  const otherRole = viewer.role === 'creator' ? 'fan' : 'creator';
  const unreadIds = (messagesRaw || [])
    .filter((m) => m.sender_role === otherRole && !m.read_at)
    .map((m) => m.id);
  if (unreadIds.length > 0) {
    await supabaseAdmin
      .from('PersonaDmMessage')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds);
  }
  const counterField = viewer.role === 'creator'
    ? 'creator_unread_count' : 'fan_unread_count';
  await supabaseAdmin
    .from('PersonaDmThread')
    .update({ [counterField]: 0, updated_at: new Date().toISOString() })
    .eq('id', req.params.threadId);

  // Reply-policy status only when the viewer is the FAN — the creator
  // doesn't need to see their own SLA gauge.
  let replyPolicyStatus = null;
  if (viewer.role === 'fan') {
    replyPolicyStatus = await dmService.getReplyPolicyStatus(req.params.threadId);
  }

  return res.json({
    thread: {
      id: viewer.thread.id,
      membershipId: viewer.thread.membership_id,
      status: viewer.thread.status,
      createdAt: viewer.thread.created_at,
      lastMessageAt: viewer.thread.last_message_at,
    },
    fan: {
      handle: viewer.membership.fan_handle,
      displayName: viewer.membership.fan_display_name || viewer.membership.fan_handle,
      avatarUrl: viewer.membership.fan_avatar_url || null,
    },
    persona: {
      handle: viewer.persona.handle,
      displayName: viewer.persona.display_name,
    },
    viewerRole: viewer.role,
    messages,
    replyPolicyStatus,
  });
});

// ---------------------------------------------------------------------------
// POST /api/personas/:id/dms/threads/:threadId/messages — append a message.
// Sender role is inferred from caller identity. Either side can post
// (Member/Insider fan can keep replying within the same thread; creator
// can always reply). Notification fires to the OPPOSITE side.
// ---------------------------------------------------------------------------
const sendMessageSchema = Joi.object({
  body: Joi.string().trim().min(1).max(2000).required(),
  media: Joi.array().items(Joi.object().unknown(true)).max(5).default([]),
});

router.post('/threads/:threadId/messages',
  validate(sendMessageSchema),
  async (req, res) => {
    const viewer = await dmService.resolveThreadViewer(
      req.params.threadId, req.user.id,
    );
    if (!viewer) return res.status(404).json({ error: 'Not found' });
    if (viewer.thread.persona_id !== req.params.id) {
      return res.status(404).json({ error: 'Not found' });
    }

    // PersonaBlock gate: a creator can still reply to existing threads
    // even after blocking, but a blocked fan cannot post new messages.
    if (viewer.role === 'fan') {
      const blocked = await dmService.isFanBlocked(viewer.persona.id, viewer.membership.user_id);
      if (blocked) return res.status(403).json({ error: 'blocked' });
    }

    let message;
    try {
      message = await dmService.sendMessage({
        threadId: req.params.threadId,
        senderUserId: req.user.id,
        senderRole: viewer.role,
        body: req.body.body,
        media: req.body.media,
      });
    } catch (err) {
      logger.error('persona_dm.send_error', {
        threadId: req.params.threadId, error: err.message,
      });
      return res.status(500).json({ error: 'internal_error' });
    }

    // Notification routing: fan→creator emits 'persona_dm_received_creator';
    // creator→fan emits 'persona_dm_reply_fan'. Both audience-context.
    try {
      if (viewer.role === 'fan') {
        await notificationService.createNotification({
          userId: viewer.persona.user_id,
          type: 'persona_dm_received_creator',
          context: 'audience',
          title: `New message from ${viewer.membership.fan_handle}`,
          body: String(req.body.body).slice(0, 100),
          link: `/app/audience/inbox/${viewer.membership.id}`,
          metadata: {
            thread_id: viewer.thread.id,
            membership_id: viewer.membership.id,
            persona_id: viewer.persona.id,
            fan_handle: viewer.membership.fan_handle,
          },
        });
      } else {
        await notificationService.createNotification({
          userId: viewer.membership.user_id,
          type: 'persona_dm_reply_fan',
          context: 'audience',
          title: `${viewer.persona.display_name || viewer.persona.handle} replied`,
          body: String(req.body.body).slice(0, 100),
          link: `/app/audience/membership/${viewer.persona.id}/inbox`,
          metadata: {
            thread_id: viewer.thread.id,
            membership_id: viewer.membership.id,
            persona_id: viewer.persona.id,
          },
        });
      }
    } catch (err) {
      logger.warn('persona_dm.notification_failed', {
        threadId: viewer.thread.id, error: err.message,
      });
    }

    return res.status(201).json({ message: serializeMessage(message) });
  });

// TODO(P1.13+ cron): auto-archive threads after 30 days of inactivity
// (audience-profile §7.2: "Threads auto-close after 30 days of
// inactivity but quota was already consumed — no refund").

module.exports = router;
