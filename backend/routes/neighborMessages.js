// ============================================================
// NEIGHBOR MESSAGES — verified-only, template-only neighbor heads-ups (W2.6)
//
// A calm, low-volume channel for a verified resident to send a pre-written
// note to another verified home on the same block. The trust-and-safety
// rules ARE the API:
//   * compose is gated to verified residents (T4) of the sending home;
//   * only known template ids are accepted — there is no free text;
//   * the recipient must be a verified resident of a home on the SAME
//     geohash-6 block;
//   * sends are rate-limited (burst + a gentle weekly cap);
//   * delivery REUSES the Notification pipeline — no new transport;
//   * the recipient never learns the sender (serializer firewall); block
//     resolves the sender from the row server-side and reuses UserBlock;
//   * reply is templated + anonymous both ways; report / not-helpful are
//     recorded inline and never notify the sender.
//
// Mounted at /api/neighbor-messages.
// ============================================================

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Joi = require('joi');

const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');
const { encodeGeohash } = require('../utils/geohash');
const { checkHomePermission } = require('../utils/homePermissions');
const { resolveTier } = require('../services/placeIntelligenceService');
const { createNotification } = require('../services/notificationService');
const { isBlocked, invalidateBlockCache } = require('../services/blockService');
const {
  MESSAGE_TEMPLATES,
  REPLY_TEMPLATES,
  getMessageTemplate,
  getReplyTemplate,
} = require('../services/neighborMessageTemplates');
const {
  serializeReceived,
  serializeSent,
} = require('../serializers/neighborMessageSerializer');

// Gentle limits keep the channel low-volume and calm (design: "a few
// messages a week"). The burst limiter stops abuse; the weekly cap is the
// human-facing promise and is enforced against the DB.
const WEEKLY_SEND_CAP = Math.max(parseInt(process.env.NEIGHBOR_MSG_WEEKLY_CAP || '5', 10) || 5, 1);

const sendBurstLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (_req, res) => res.status(429).json({ error: 'You are sending too quickly. Please wait a moment.' }),
  standardHeaders: true,
  legacyHeaders: false,
});

const HOME_SELECT = 'id, owner_id, address, city, state, zipcode, map_center_lat, map_center_lng';

/** geohash-6 for a home from its map center, or null when unmappable. */
function homeGeohash(home) {
  const lat = Number(home?.map_center_lat);
  const lng = Number(home?.map_center_lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return encodeGeohash(lat, lng, 6);
}

/** First active, verified resident of a home (the delivery target). */
async function findVerifiedResident(homeId, { excludeUserId } = {}) {
  const { data, error } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('user_id')
    .eq('home_id', homeId)
    .eq('is_active', true)
    .eq('verification_status', 'verified');
  if (error) {
    logger.warn('neighborMessages.recipient_lookup_error', { homeId, error: error.message });
    return null;
  }
  const candidates = (data || [])
    .map((r) => r.user_id)
    .filter((uid) => uid && String(uid) !== String(excludeUserId || ''));
  return candidates[0] || null;
}

// ── Templates catalog (single source of truth for the clients) ──
router.get('/templates', verifyToken, (_req, res) => {
  res.json({ templates: MESSAGE_TEMPLATES, replies: REPLY_TEMPLATES });
});

// ── Compose / send ──
const sendSchema = Joi.object({
  sender_home_id: Joi.string().uuid().required(),
  recipient_home_id: Joi.string().uuid().required(),
  template_id: Joi.string()
    .valid(...MESSAGE_TEMPLATES.map((t) => t.id))
    .required(),
});

router.post('/', verifyToken, sendBurstLimiter, validate(sendSchema), async (req, res) => {
  const userId = req.user.id;
  const { sender_home_id: senderHomeId, recipient_home_id: recipientHomeId, template_id: templateId } = req.body;

  try {
    if (String(senderHomeId) === String(recipientHomeId)) {
      return res.status(400).json({ error: "You can't message your own home." });
    }

    const template = getMessageTemplate(templateId);
    if (!template) return res.status(400).json({ error: 'Unknown message template.' });

    // 1) Verified-only: the sender must be a verified resident (T4) of the
    //    sending home. This is the gate that keeps the channel trustworthy.
    const access = await checkHomePermission(senderHomeId, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to that home.' });
    }
    if (resolveTier(access) !== 'T4') {
      return res.status(403).json({ error: 'Only verified neighbors can send messages.' });
    }

    // 2) Same-block scope: recipient home must share the sender's geohash-6.
    const { data: homes, error: homesErr } = await supabaseAdmin
      .from('Home')
      .select(HOME_SELECT)
      .in('id', [senderHomeId, recipientHomeId]);
    if (homesErr) throw new Error(homesErr.message);
    const senderHome = (homes || []).find((h) => String(h.id) === String(senderHomeId));
    const recipientHome = (homes || []).find((h) => String(h.id) === String(recipientHomeId));
    if (!senderHome || !recipientHome) {
      return res.status(404).json({ error: 'Home not found.' });
    }
    const senderGeo = homeGeohash(senderHome);
    const recipientGeo = homeGeohash(recipientHome);
    if (!senderGeo || !recipientGeo || senderGeo !== recipientGeo) {
      return res.status(400).json({ error: "That address isn't on your block." });
    }

    // 3) Gentle weekly cap — keeps the channel calm.
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabaseAdmin
      .from('NeighborMessage')
      .select('id', { count: 'exact', head: true })
      .eq('sender_user_id', userId)
      .gte('created_at', weekAgo);
    if ((recentCount || 0) >= WEEKLY_SEND_CAP) {
      return res.status(429).json({
        error: "You've reached this week's limit. This keeps neighbor messages calm and low-volume.",
      });
    }

    // 4) Resolve a verified resident to deliver to.
    const recipientUserId = await findVerifiedResident(recipientHomeId, { excludeUserId: userId });
    if (!recipientUserId) {
      return res.status(422).json({ error: "We couldn't deliver to that address right now." });
    }

    // 5) Block firewall — if either party has blocked the other, accept the
    //    send but quietly drop it. The sender learns nothing about the block.
    if (await isBlocked(userId, recipientUserId)) {
      return res.json(serializeSent({
        id: null,
        template_id: templateId,
        category: template.category,
        body: template.body,
        created_at: new Date().toISOString(),
      }));
    }

    // 6) Persist the message (sender identity stays in the row only).
    const { data: row, error: insErr } = await supabaseAdmin
      .from('NeighborMessage')
      .insert({
        sender_user_id: userId,
        sender_home_id: senderHomeId,
        recipient_user_id: recipientUserId,
        recipient_home_id: recipientHomeId,
        block_geohash: senderGeo,
        template_id: templateId,
        category: template.category,
        body: template.body,
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);

    // 7) Deliver via the existing Notification pipeline — anonymized.
    await createNotification({
      userId: recipientUserId,
      type: 'neighbor_message',
      title: 'A message from a verified neighbor nearby',
      body: template.body,
      icon: '🏡',
      link: `/app/place/neighbor-message/${row.id}`,
      metadata: { neighbor_message_id: row.id, category: template.category },
      context: 'personal',
    });

    return res.status(201).json(serializeSent(row));
  } catch (err) {
    logger.error('neighborMessages.send_error', { error: err.message, userId });
    return res.status(500).json({ error: 'Failed to send message.' });
  }
});

// ── Inbox (received list) ──
router.get('/received', verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const { data, error } = await supabaseAdmin
      .from('NeighborMessage')
      .select('*')
      .eq('recipient_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const items = await Promise.all(
      (data || []).map(async (row) => {
        const canReply = !row.reply_template_id && !(await isBlocked(userId, row.sender_user_id));
        return serializeReceived(row, { canReply });
      })
    );
    return res.json({ messages: items });
  } catch (err) {
    logger.error('neighborMessages.received_list_error', { error: err.message, userId });
    return res.status(500).json({ error: 'Failed to load messages.' });
  }
});

/** Load a row the caller is allowed to read (recipient only). 404 otherwise. */
async function loadOwnedMessage(id, userId) {
  const { data, error } = await supabaseAdmin
    .from('NeighborMessage')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || String(data.recipient_user_id) !== String(userId)) return null;
  return data;
}

// ── Received detail (recipient only) ──
router.get('/:id', verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const row = await loadOwnedMessage(req.params.id, userId);
    if (!row) return res.status(404).json({ error: 'Message not found.' });

    if (!row.read_at) {
      await supabaseAdmin
        .from('NeighborMessage')
        .update({ read_at: new Date().toISOString() })
        .eq('id', row.id);
    }
    const canReply = !row.reply_template_id && !(await isBlocked(userId, row.sender_user_id));
    return res.json(serializeReceived(row, { canReply }));
  } catch (err) {
    logger.error('neighborMessages.detail_error', { error: err.message, userId });
    return res.status(500).json({ error: 'Failed to load message.' });
  }
});

// ── Reply (templated, recipient only) ──
const replySchema = Joi.object({
  reply_template_id: Joi.string()
    .valid(...REPLY_TEMPLATES.map((t) => t.id))
    .required(),
});

router.post('/:id/reply', verifyToken, validate(replySchema), async (req, res) => {
  const userId = req.user.id;
  const { reply_template_id: replyTemplateId } = req.body;
  try {
    const row = await loadOwnedMessage(req.params.id, userId);
    if (!row) return res.status(404).json({ error: 'Message not found.' });

    const reply = getReplyTemplate(replyTemplateId);
    if (!reply) return res.status(400).json({ error: 'Unknown reply template.' });

    // Reply allowed unless the sender has been blocked by the recipient.
    if (await isBlocked(userId, row.sender_user_id)) {
      return res.status(403).json({ error: "You've blocked this neighbor, so replies are off." });
    }

    const isFirstReply = !row.reply_template_id;

    const { data: updated, error } = await supabaseAdmin
      .from('NeighborMessage')
      .update({
        reply_template_id: replyTemplateId,
        reply_body: reply.body,
        replied_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Notify the original sender on the first reply only — "Change reply"
    // edits the same note and must not re-ping them. Also anonymized.
    if (isFirstReply) {
      await createNotification({
        userId: row.sender_user_id,
        type: 'neighbor_message_reply',
        title: 'A verified neighbor replied',
        body: reply.body,
        icon: '🏡',
        link: '/app/place',
        metadata: { neighbor_message_id: row.id },
        context: 'personal',
      });
    }

    return res.json(serializeReceived(updated, { canReply: false }));
  } catch (err) {
    logger.error('neighborMessages.reply_error', { error: err.message, userId });
    return res.status(500).json({ error: 'Failed to send reply.' });
  }
});

// ── "This isn't helpful" (recipient only; never notifies the sender) ──
router.post('/:id/not-helpful', verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const row = await loadOwnedMessage(req.params.id, userId);
    if (!row) return res.status(404).json({ error: 'Message not found.' });

    const { error } = await supabaseAdmin
      .from('NeighborMessage')
      .update({ not_helpful: true })
      .eq('id', row.id);
    if (error) throw new Error(error.message);
    return res.json({ success: true });
  } catch (err) {
    logger.error('neighborMessages.not_helpful_error', { error: err.message, userId });
    return res.status(500).json({ error: 'Failed to record feedback.' });
  }
});

// ── Report (recipient only; flags for the trust team, sender not notified) ──
const reportSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow('', null),
});

router.post('/:id/report', verifyToken, validate(reportSchema), async (req, res) => {
  const userId = req.user.id;
  try {
    const row = await loadOwnedMessage(req.params.id, userId);
    if (!row) return res.status(404).json({ error: 'Message not found.' });

    const { error } = await supabaseAdmin
      .from('NeighborMessage')
      .update({
        reported_at: new Date().toISOString(),
        report_reason: (req.body && req.body.reason) || null,
      })
      .eq('id', row.id);
    if (error) throw new Error(error.message);
    return res.json({ success: true });
  } catch (err) {
    logger.error('neighborMessages.report_error', { error: err.message, userId });
    return res.status(500).json({ error: 'Failed to report message.' });
  }
});

// ── Block the sender (recipient only; sender id resolved server-side) ──
router.post('/:id/block', verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const row = await loadOwnedMessage(req.params.id, userId);
    if (!row) return res.status(404).json({ error: 'Message not found.' });

    const senderId = row.sender_user_id;
    if (String(senderId) === String(userId)) {
      return res.status(400).json({ error: 'Cannot block yourself.' });
    }

    const { error } = await supabaseAdmin
      .from('UserBlock')
      .upsert(
        { blocker_user_id: userId, blocked_user_id: senderId, reason: 'neighbor_message' },
        { onConflict: 'blocker_user_id,blocked_user_id', ignoreDuplicates: true }
      );
    if (error) throw new Error(error.message);

    invalidateBlockCache(userId, senderId);
    return res.json({ success: true });
  } catch (err) {
    logger.error('neighborMessages.block_error', { error: err.message, userId });
    return res.status(500).json({ error: 'Failed to block neighbor.' });
  }
});

module.exports = router;
