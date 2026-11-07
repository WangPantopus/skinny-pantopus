// ============================================================
// NEIGHBOR MESSAGES — verified-only, template-only neighbor heads-ups (W2.6)
//
// A calm, low-volume channel for a verified resident to send a pre-written
// note to any address on their block. The trust-and-safety rules ARE the API:
//   * compose is gated to verified residents (T4) of the sending home;
//   * only known template ids are accepted — there is no free text;
//   * the address must be on the sender's block, by the server's own lookup;
//   * the note reaches a verified resident there. With nobody to reach, it is
//     quietly kept undelivered, and every answer and limit is the same as for
//     a delivered note, so a sender can't learn who lives where (founder
//     decision 2026-11-06);
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
const { haversineMeters } = require('../utils/geo');
const { escapeIlike } = require('../utils/escapeIlike');
const { computeAddressHash, expandAbbreviations } = require('../utils/normalizeAddress');
const { checkHomePermission } = require('../utils/homePermissions');
const { geocodeLimiter } = require('../middleware/rateLimiter');
const geoProvider = require('../services/geo');
const { resolveTier } = require('../services/placeIntelligenceService');
const { createNotification } = require('../services/notificationService');
const { isBlocked, invalidateBlockCache } = require('../services/blockService');
const { invalidateFilterCache } = require('../services/feedService');
const marketplaceService = require('../services/marketplace/marketplaceService');
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
// The same note to the same address within this window is a repeat of one send, not a new note.
const REPEAT_SEND_WINDOW_MS = 10 * 60 * 1000;
// A block is a geohash-6 cell, and a next-door home can sit just over a cell's edge.
const BLOCK_REACH_METERS = 200;

const sendBurstLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (_req, res) => res.status(429).json({ error: 'You are sending too quickly. Please wait a moment.' }),
  standardHeaders: true,
  legacyHeaders: false,
});

const HOME_SELECT = 'id, owner_id, address, address2, city, state, zipcode, map_center_lat, map_center_lng, privacy_mask_level';

/** A latitude and longitude that really are a place, or null. Number(null) is 0: no coordinates aren't 0,0. */
function point(lat, lng) {
  if (lat == null || lng == null || String(lat).trim() === '' || String(lng).trim() === '') return null;
  const at = { lat: Number(lat), lng: Number(lng) };
  if (!Number.isFinite(at.lat) || !Number.isFinite(at.lng) || Math.abs(at.lat) > 90 || Math.abs(at.lng) > 180) return null;
  return at;
}

/** geohash-6 for a home from its map center, or null when unmappable. */
function homeGeohash(home) {
  const at = point(home?.map_center_lat, home?.map_center_lng);
  return at ? encodeGeohash(at.lat, at.lng, 6) : null;
}

/** Whether a place is on the sender's block: in the same cell, or just over its edge from their home. */
function onSendersBlock(senderHome, lat, lng) {
  const home = point(senderHome?.map_center_lat, senderHome?.map_center_lng);
  const place = point(lat, lng);
  if (!home || !place) return false;
  return encodeGeohash(place.lat, place.lng, 6) === encodeGeohash(home.lat, home.lng, 6)
    || haversineMeters(home.lat, home.lng, place.lat, place.lng) <= BLOCK_REACH_METERS;
}

const houseNumber = (line) => String(line || '').trim().split(/[\s,]+/)[0].toLowerCase();
const zip5 = (zipcode) => String(zipcode || '').replace(/\D/g, '').slice(0, 5);

/** One address's street and unit, however they were written: "625 NE 4th Ave #2" reads as "625 Northeast 4th Avenue, Apt 2". */
function addressKey(line, unit) {
  return expandAbbreviations(`${line || ''} ${unit || ''}`.toLowerCase().replace(/[.,#]/g, ' '))
    .replace(/\b(apartment|unit|suite)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// What a sender is told about an address they can't use. None of it says anything about who lives anywhere.
const ADDRESS_REFUSALS = {
  not_found: "We couldn't find that address. Check the number and street.",
  off_block: "That address isn't on your block.",
  own_home: "You can't message your own home.",
};

/**
 * Where an address is, by the server's own lookup: a client's coordinates aren't trusted, and nothing here reads who
 * lives anywhere. A street with no city is looked up in the sender's town.
 */
async function placeAddress(senderHome, input) {
  const city = input.city || senderHome.city;
  const state = input.state || senderHome.state;
  const zipcode = input.city ? input.zipcode : senderHome.zipcode;
  const query = [input.address, city, [state, zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  let found;
  try {
    found = await geoProvider.forwardGeocode(query);
  } catch (err) {
    if (err.code === 'GEO_NO_RESULT') return { status: 'not_found' };
    logger.warn('neighborMessages.address_lookup_error', { error: err.message });
    throw Object.assign(new Error("We couldn't check that address right now. Try again."), { code: 'ADDRESS_LOOKUP_UNAVAILABLE' });
  }
  // When it doesn't know the number, the lookup answers with the street or the town.
  if (!/\d/.test(houseNumber(found?.address)) || houseNumber(found.address) !== houseNumber(input.address)) {
    return { status: 'not_found' };
  }
  if (!onSendersBlock(senderHome, found.latitude, found.longitude)) return { status: 'off_block' };
  const place = {
    address: found.address,
    city: found.city || city || '',
    state: found.state || state || '',
    zipcode: zip5(found.zipcode) || zip5(senderHome.zipcode),
  };
  if (addressKey(place.address, input.unit) === addressKey(senderHome.address, senderHome.address2)) {
    return { status: 'own_home' };
  }
  return { status: 'on_block', place };
}

/** Active homes at an address: this house number in this ZIP, with the same street and unit however they were written. */
async function homesAtAddress(place, unit) {
  if (!place.zipcode) return [];
  const { data, error } = await supabaseAdmin
    .from('Home')
    .select(HOME_SELECT)
    .eq('home_status', 'active')
    .like('zipcode', `${place.zipcode}%`)
    .ilike('address', `${escapeIlike(houseNumber(place.address))} %`)
    .limit(500); // A large building has a Home for each of its units.
  if (error) throw new Error(error.message);
  const key = addressKey(place.address, unit);
  return (data || []).filter((home) => addressKey(home.address, home.address2) === key);
}

/** First active, verified resident of a home (the delivery target). */
async function findVerifiedResident(homeId, { excludeUserId } = {}) {
  const { data, error } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('user_id')
    .eq('home_id', homeId)
    .eq('is_active', true)
    .eq('verification_status', 'verified')
    // A message meant for the people at an address never reaches someone whose access is only a claim.
    .neq('verification_source', 'claim');
  if (error) {
    logger.warn('neighborMessages.recipient_lookup_error', { homeId, error: error.message });
    return null;
  }
  const candidates = (data || [])
    .map((r) => r.user_id)
    .filter((uid) => uid && String(uid) !== String(excludeUserId || ''));
  return candidates[0] || null;
}

/**
 * Who a note to these homes reaches: a verified resident the sender hasn't blocked and isn't blocked by, or null. A home
 * that asked to stay hidden isn't reached either: an unasked note from nearby isn't for them.
 */
async function deliveryTarget(homes, senderId) {
  for (const home of homes) {
    if (home.privacy_mask_level !== 'normal') continue;
    const recipientUserId = await findVerifiedResident(home.id, { excludeUserId: senderId });
    if (recipientUserId && !(await isBlocked(senderId, recipientUserId))) {
      return { recipientUserId, recipientHomeId: home.id };
    }
  }
  return null;
}

/** The T4 gate: the sender's home, or an answer already sent. */
async function verifiedSenderHome(res, senderHomeId, userId) {
  const access = await checkHomePermission(senderHomeId, userId);
  if (!access.hasAccess) {
    res.status(403).json({ error: 'You do not have access to that home.' });
    return null;
  }
  if (resolveTier(access) !== 'T4') {
    res.status(403).json({ error: 'Only verified neighbors can send messages.' });
    return null;
  }
  const { data: senderHome, error } = await supabaseAdmin
    .from('Home')
    .select(HOME_SELECT)
    .eq('id', senderHomeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!senderHome) res.status(404).json({ error: 'Home not found.' });
  return senderHome || null;
}

// A sent reply may be edited. Only a block disables replying; expose the
// viewer's own block state without revealing who the anonymous sender is.
async function replyAccess(row, userId) {
  if (!(await isBlocked(userId, row.sender_user_id))) {
    return { canReply: true, blockedByViewer: false };
  }
  const { count, error } = await supabaseAdmin
    .from('UserBlock')
    .select('id', { count: 'exact', head: true })
    .eq('blocker_user_id', userId)
    .eq('blocked_user_id', row.sender_user_id);
  if (error) throw Object.assign(new Error('Could not check reply availability. Try again.'), { code: 'BLOCK_CHECK_UNAVAILABLE' });
  return { canReply: false, blockedByViewer: count > 0 };
}

// ── Templates catalog (single source of truth for the clients) ──
router.get('/templates', verifyToken, (_req, res) => {
  res.json({ templates: MESSAGE_TEMPLATES, replies: REPLY_TEMPLATES });
});

// ── Is this address on my block? (the composer asks before a note is written) ──
const addressFields = {
  address: Joi.string().trim().min(4).max(200).required(),
  city: Joi.string().trim().max(100).allow('', null),
  state: Joi.string().trim().max(50).allow('', null),
  zipcode: Joi.string().trim().max(10).allow('', null),
};

const addressCheckSchema = Joi.object({
  sender_home_id: Joi.string().uuid().required(),
  ...addressFields,
});

router.post('/address-check', verifyToken, geocodeLimiter, validate(addressCheckSchema), async (req, res) => {
  try {
    const senderHome = await verifiedSenderHome(res, req.body.sender_home_id, req.user.id);
    if (!senderHome) return undefined;
    const { status, place } = await placeAddress(senderHome, req.body);
    return res.json(status === 'on_block' ? { status, ...place } : { status, message: ADDRESS_REFUSALS[status] });
  } catch (err) {
    if (err.code === 'ADDRESS_LOOKUP_UNAVAILABLE') return res.status(503).json({ error: err.message, code: err.code });
    logger.error('neighborMessages.address_check_error', { error: err.message, userId: req.user.id });
    return res.status(500).json({ error: "We couldn't check that address. Try again." });
  }
});

// ── Compose / send ──
const sendSchema = Joi.object({
  sender_home_id: Joi.string().uuid().required(),
  // Apps from before any address could be chosen send the home they found in discovery.
  recipient_home_id: Joi.string().uuid(),
  recipient_address: Joi.object({
    ...addressFields,
    unit: Joi.string().trim().max(30).allow('', null),
  }),
  template_id: Joi.string()
    .valid(...MESSAGE_TEMPLATES.map((t) => t.id))
    .required(),
}).xor('recipient_home_id', 'recipient_address');

router.post('/', verifyToken, sendBurstLimiter, validate(sendSchema), async (req, res) => {
  const userId = req.user.id;
  const {
    sender_home_id: senderHomeId,
    recipient_home_id: recipientHomeId,
    recipient_address: recipientAddress,
    template_id: templateId,
  } = req.body;

  try {
    if (recipientHomeId && String(senderHomeId) === String(recipientHomeId)) {
      return res.status(400).json({ error: ADDRESS_REFUSALS.own_home });
    }

    const template = getMessageTemplate(templateId);
    if (!template) return res.status(400).json({ error: 'Unknown message template.' });

    // 1) Verified-only: the sender must be a verified resident (T4) of the
    //    sending home. This is the gate that keeps the channel trustworthy.
    const senderHome = await verifiedSenderHome(res, senderHomeId, userId);
    if (!senderHome) return undefined;

    // 2) Same-block scope, then the homes at that address.
    let addressHash;
    let homes;
    if (recipientAddress) {
      const { status, place } = await placeAddress(senderHome, recipientAddress);
      if (status !== 'on_block') return res.status(400).json({ error: ADDRESS_REFUSALS[status] });
      const unit = recipientAddress.unit || '';
      addressHash = computeAddressHash(place.address, unit, place.city, place.state, place.zipcode);
      homes = (await homesAtAddress(place, unit)).filter((home) => String(home.id) !== String(senderHomeId));
    } else {
      const { data: recipientHome, error: homeErr } = await supabaseAdmin
        .from('Home')
        .select(HOME_SELECT)
        .eq('id', recipientHomeId)
        .maybeSingle();
      if (homeErr) throw new Error(homeErr.message);
      if (!recipientHome) return res.status(404).json({ error: 'Home not found.' });
      if (!onSendersBlock(senderHome, recipientHome.map_center_lat, recipientHome.map_center_lng)) {
        return res.status(400).json({ error: ADDRESS_REFUSALS.off_block });
      }
      addressHash = computeAddressHash(
        recipientHome.address, recipientHome.address2 || '', recipientHome.city, recipientHome.state, recipientHome.zipcode
      );
      homes = [recipientHome];
    }

    // 2b) The same note to the same address within a few minutes is a repeat of this send (a re-sent
    //     request or a second tap): answer with the note already sent, without a second note,
    //     notification or use of the weekly cap.
    const { data: justSent, error: justSentErr } = await supabaseAdmin
      .from('NeighborMessage')
      .select('*')
      .eq('sender_user_id', userId)
      .eq('sender_home_id', senderHomeId)
      .eq('recipient_address_hash', addressHash)
      .eq('template_id', templateId)
      .gte('created_at', new Date(Date.now() - REPEAT_SEND_WINDOW_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    if (justSentErr) throw new Error(justSentErr.message);
    if (justSent?.[0]) return res.status(201).json(serializeSent(justSent[0]));

    // 3) Gentle weekly cap — keeps the channel calm. Undelivered notes count like any other,
    //    or the cap would tell a sender which addresses have a verified household.
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

    // 4) Who it reaches, if anyone. With nobody verified there, or a block either way, the note
    //    is kept with no recipient. The sender gets the same answer and learns nothing.
    const target = await deliveryTarget(homes, userId);

    // 5) Persist the message (sender identity stays in the row only; the address only as a hash).
    const { data: row, error: insErr } = await supabaseAdmin
      .from('NeighborMessage')
      .insert({
        sender_user_id: userId,
        sender_home_id: senderHomeId,
        recipient_user_id: target?.recipientUserId ?? null,
        recipient_home_id: target?.recipientHomeId ?? null,
        recipient_address_hash: addressHash,
        block_geohash: homeGeohash(senderHome),
        template_id: templateId,
        category: template.category,
        body: template.body,
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);

    // 6) Deliver via the existing Notification pipeline — anonymized. Not awaited: how long
    //    the answer takes mustn't say whether anyone was reached.
    if (target) {
      createNotification({
        userId: target.recipientUserId,
        type: 'neighbor_message',
        title: 'A message from a verified neighbor nearby',
        body: template.body,
        icon: '🏡',
        link: `/app/place/neighbor-message/${row.id}`,
        metadata: { neighbor_message_id: row.id, category: template.category },
        context: 'personal',
      }).catch((err) => logger.error('neighborMessages.notify_error', { error: err.message, messageId: row.id }));
    }

    return res.status(201).json(serializeSent(row));
  } catch (err) {
    if (err.code === 'BLOCK_CHECK_UNAVAILABLE' || err.code === 'ADDRESS_LOOKUP_UNAVAILABLE') {
      return res.status(503).json({ error: err.message, code: err.code });
    }
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
        return serializeReceived(row, await replyAccess(row, userId));
      })
    );
    return res.json({ messages: items });
  } catch (err) {
    if (err.code === 'BLOCK_CHECK_UNAVAILABLE') return res.status(503).json({ error: err.message, code: err.code });
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
    return res.json(serializeReceived(row, await replyAccess(row, userId)));
  } catch (err) {
    if (err.code === 'BLOCK_CHECK_UNAVAILABLE') return res.status(503).json({ error: err.message, code: err.code });
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

    // Replies are off while either person blocks the other. Only the person
    // who blocked is told why; when the sender blocked the recipient, the
    // recipient gets a neutral answer that does not reveal the block.
    const access = await replyAccess(row, userId);
    if (!access.canReply) {
      return res.status(403).json({
        error: access.blockedByViewer ? "You've blocked this neighbor, so replies are off." : 'Replies to this message are off.',
      });
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
    } else {
      // The sender reads this reply in their notification list. Keep that
      // existing row current without another push, unread badge or timestamp.
      const { error: notificationError } = await supabaseAdmin
        .from('Notification')
        .update({ body: reply.body })
        .eq('user_id', row.sender_user_id)
        .eq('type', 'neighbor_message_reply')
        .contains('metadata', { neighbor_message_id: row.id });
      // The changed reply is already saved; a stale notification body must not report it as failed.
      if (notificationError) {
        logger.warn('neighborMessages.reply_notification_update_error', { error: notificationError.message, userId });
      }
    }

    return res.json(serializeReceived(updated, access));
  } catch (err) {
    if (err.code === 'BLOCK_CHECK_UNAVAILABLE') return res.status(503).json({ error: err.message, code: err.code });
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
    if (err.code === 'BLOCK_CHECK_UNAVAILABLE') return res.status(503).json({ error: err.message, code: err.code });
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

    // Only the first report stamps the message and alerts the trust team; a repeat (a re-sent
    // request or a second tap) keeps the original time and reason and alerts no one again.
    const { data: stamped, error } = await supabaseAdmin
      .from('NeighborMessage')
      .update({
        reported_at: new Date().toISOString(),
        report_reason: (req.body && req.body.reason) || null,
      })
      .eq('id', row.id)
      .is('reported_at', null)
      .select('id');
    if (error) throw new Error(error.message);
    // The reason here is free text, so the alert carries only the kind and the message id.
    if ((stamped || []).length > 0) {
      require('../services/adminAlerts').notifyReportToReview({ kind: 'message', reportId: row.id }).catch(() => {});
    }
    return res.json({ success: true });
  } catch (err) {
    if (err.code === 'BLOCK_CHECK_UNAVAILABLE') return res.status(503).json({ error: err.message, code: err.code });
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
    invalidateFilterCache(userId);
    invalidateFilterCache(senderId);
    marketplaceService.invalidateFilterCache(userId);
    marketplaceService.invalidateFilterCache(senderId);
    return res.json({ success: true });
  } catch (err) {
    if (err.code === 'BLOCK_CHECK_UNAVAILABLE') return res.status(503).json({ error: err.message, code: err.code });
    logger.error('neighborMessages.block_error', { error: err.message, userId });
    return res.status(500).json({ error: 'Failed to block neighbor.' });
  }
});

module.exports = router;
