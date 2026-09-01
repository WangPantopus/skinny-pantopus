// ============================================================
// CHAT REST API ROUTES
// HTTP endpoints for chat management (complement to Socket.IO)
// ============================================================

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');
const badgeService = require('../services/badgeService');
const {
  serializeLocalProfileForViewer,
  serializeUserAsLocalIdentity,
  serializeUserIdentityForViewer,
} = require('../serializers/identitySerializers');
const { hasPermission } = require('../utils/businessPermissions');
const s3Service = require('../services/s3Service');
const { isBlocked } = require('../services/blockService');
const { incCounter, recordHistogram, getSnapshot } = require('../services/chatMetrics');
const pushService = require('../services/pushService');
const rateLimit = require('express-rate-limit');
const CHAT_DELETED_REDACT_DAYS = Math.max(parseInt(process.env.CHAT_DELETED_REDACT_DAYS || '180', 10) || 180, 1);
const REDACTED_DELETED_MESSAGE = '[deleted message]';
const LOCAL_PROFILE_IDENTITY_SELECT = [
  'id',
  'user_id',
  'handle',
  'display_name',
  'avatar_url',
  'bio',
  'public_city',
  'public_state',
  'public_neighborhood',
  'show_neighborhood',
  'show_verified_resident_badge',
  'show_gig_history',
  'verified_resident',
  'review_count',
  'gigs_completed',
  'marketplace_sales',
].join(', ');

async function loadLocalIdentityMapForUsers(users) {
  const userRows = (users || []).filter(Boolean);
  const usersById = new Map();
  for (const user of userRows) {
    if (user?.id) usersById.set(String(user.id), user);
  }
  if (usersById.size === 0) return new Map();

  const { data: profiles, error } = await supabaseAdmin
    .from('LocalProfile')
    .select(LOCAL_PROFILE_IDENTITY_SELECT)
    .in('user_id', [...usersById.keys()]);

  if (error) {
    logger.warn('chat.local_profile_identity_lookup_error', { error: error.message });
  }

  const profilesByUserId = new Map();
  for (const profile of profiles || []) {
    if (profile?.user_id) profilesByUserId.set(String(profile.user_id), profile);
  }

  const identitiesByUserId = new Map();
  for (const [userId, user] of usersById) {
    const profile = profilesByUserId.get(userId);
    identitiesByUserId.set(
      userId,
      profile
        ? serializeLocalProfileForViewer({ ...profile, user })
        : serializeUserAsLocalIdentity(user)
    );
  }
  return identitiesByUserId;
}

// ============ CHAT RATE LIMITERS ============
// Keyed by authenticated user ID (not IP) since all routes require auth.

function chatRateLimiter(windowMs, max, label) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => req.user?.id || req.ip,
    handler: (_req, res) => {
      const retryAfter = Math.ceil(windowMs / 1000);
      res.status(429).json({ error: 'Rate limit exceeded', retryAfter });
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

const messageSendLimiter = chatRateLimiter(60_000, 30, 'message-send');
// Idempotent get-or-create; UI may resolve the same peer from multiple effects — keep headroom.
const directChatMax = Math.max(parseInt(process.env.CHAT_DIRECT_RATE_LIMIT_PER_MIN || '40', 10) || 40, 1);
const directChatLimiter = chatRateLimiter(60_000, directChatMax, 'direct-chat');
const groupChatLimiter = chatRateLimiter(60_000, 5, 'group-chat');
const reactionLimiter = chatRateLimiter(60_000, 60, 'reaction');
const messageEditLimiter = chatRateLimiter(60_000, 20, 'message-edit');
const messageDeleteLimiter = chatRateLimiter(60_000, 20, 'message-delete');
const participantLimiter = chatRateLimiter(60_000, 10, 'participant');

/** Return a chat-list-friendly label for attachment-only messages (e.g. "Photo", "Video", "Document"). */
function getAttachmentPreviewLabel(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) return 'Media';
  const mimes = attachments.map((a) => (a.mime_type || a.mimeType || '').toLowerCase());
  if (mimes.some((m) => m.startsWith('image/'))) return 'Photo';
  if (mimes.some((m) => m.startsWith('video/'))) return 'Video';
  return 'Document';
}

const ROOM_RETENTION_OVERRIDES = (() => {
  try {
    const parsed = JSON.parse(process.env.CHAT_ROOM_RETENTION_DAYS || '{}');
    if (!parsed || typeof parsed !== 'object') return {};
    const out = {};
    for (const [roomId, days] of Object.entries(parsed)) {
      const n = Math.max(parseInt(days, 10) || 0, 0);
      if (n > 0) out[String(roomId)] = n;
    }
    return out;
  } catch {
    return {};
  }
})();

// ============ VALIDATION SCHEMAS ============

const createDirectChatSchema = Joi.object({
  otherUserId: Joi.string().uuid().required(),
  asBusinessUserId: Joi.string().uuid().optional(),
});

const createGroupChatSchema = Joi.object({
  roomName: Joi.string().min(1).max(255).required(),
  roomDescription: Joi.string().max(1000).optional(),
  participantIds: Joi.array().items(Joi.string().uuid()).min(1).max(50).required()
});

const sendMessageSchema = Joi.object({
  roomId: Joi.string().uuid().required(),
  messageText: Joi.string().max(10000).when('messageType', {
    is: 'text',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  messageType: Joi.string().valid('text', 'image', 'video', 'file', 'audio', 'location', 'gig_offer', 'listing_offer').default('text'),
  fileIds: Joi.array().items(Joi.string().uuid()).optional(),
  metadata: Joi.object().optional(),
  replyToId: Joi.string().uuid().optional(),
  asBusinessUserId: Joi.string().uuid().optional(),
  topicId: Joi.string().uuid().optional(),
  clientMessageId: Joi.string().uuid().optional(),
});

const createTopicSchema = Joi.object({
  topicType: Joi.string().valid('general', 'task', 'listing', 'delivery', 'home', 'business').required(),
  topicRefId: Joi.string().uuid().optional().allow(null),
  title: Joi.string().min(1).max(255).required(),
});

const updateRoomSchema = Joi.object({
  roomName: Joi.string().min(1).max(255).optional(),
  roomDescription: Joi.string().max(1000).optional()
});

const reactToMessageSchema = Joi.object({
  reaction: Joi.string().max(8).required(),
});

async function getGigOwnerMessagingContext(gigOwnerUserId, actorUserId) {
  if (String(gigOwnerUserId) === String(actorUserId)) {
    return { isOwnerActor: true, messageSenderUserId: actorUserId };
  }

  const { data: owner } = await supabaseAdmin
    .from('User')
    .select('id, account_type')
    .eq('id', gigOwnerUserId)
    .maybeSingle();

  if (!owner || owner.account_type !== 'business') {
    return { isOwnerActor: false, messageSenderUserId: actorUserId };
  }

  const canManage = await hasPermission(gigOwnerUserId, actorUserId, 'gigs.manage');
  const canPost = canManage ? true : await hasPermission(gigOwnerUserId, actorUserId, 'gigs.post');
  if (!canPost) {
    return { isOwnerActor: false, messageSenderUserId: actorUserId };
  }

  // For business-owned gig chats, authorized team members post as the business.
  return { isOwnerActor: true, messageSenderUserId: gigOwnerUserId };
}

async function isBusinessAccount(userId) {
  const { data: user } = await supabaseAdmin
    .from('User')
    .select('id, account_type')
    .eq('id', userId)
    .maybeSingle();
  return Boolean(user && user.account_type === 'business');
}

async function canActAsBusiness(businessUserId, actorUserId) {
  if (!businessUserId || !actorUserId) return false;
  if (String(businessUserId) === String(actorUserId)) return true;
  if (!(await isBusinessAccount(businessUserId))) return false;
  const canManage = await hasPermission(businessUserId, actorUserId, 'gigs.manage');
  if (canManage) return true;
  return hasPermission(businessUserId, actorUserId, 'gigs.post');
}

async function getBusinessMessagingMemberIds(businessUserId) {
  const ids = new Set([String(businessUserId)]);
  if (!(await isBusinessAccount(businessUserId))) {
    return Array.from(ids);
  }

  // Seat-based: get team member user IDs via SeatBinding
  const { data: seatBindings } = await supabaseAdmin
    .from('BusinessSeat')
    .select('id, is_active, bindings:SeatBinding ( user_id )')
    .eq('business_user_id', businessUserId)
    .eq('is_active', true);

  let memberUserIds = [];
  if (seatBindings && seatBindings.length > 0) {
    for (const seat of seatBindings) {
      const binding = seat.bindings?.[0] || seat.bindings;
      if (binding?.user_id) memberUserIds.push(binding.user_id);
    }
  }

  // Fallback to BusinessTeam if seats are empty (transition period)
  if (memberUserIds.length === 0) {
    const { data: members } = await supabaseAdmin
      .from('BusinessTeam')
      .select('user_id')
      .eq('business_user_id', businessUserId)
      .eq('is_active', true);
    memberUserIds = (members || []).map(m => m.user_id);
  }

  for (const uid of memberUserIds) {
    const memberId = String(uid);
    const allowed = await canActAsBusiness(businessUserId, memberId);
    if (allowed) ids.add(memberId);
  }

  return Array.from(ids);
}

async function ensureBusinessRoomActorAccess(roomId, actorUserId, businessUserId) {
  if (!roomId || !actorUserId || !businessUserId) return false;

  const canAct = await canActAsBusiness(businessUserId, actorUserId);
  if (!canAct) return false;

  const { data: businessParticipant } = await supabaseAdmin
    .from('ChatParticipant')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', businessUserId)
    .eq('is_active', true)
    .maybeSingle();

  if (!businessParticipant) return false;

  await supabaseAdmin
    .from('ChatParticipant')
    .upsert(
      {
        room_id: roomId,
        user_id: actorUserId,
        role: 'member',
        is_active: true,
        left_at: null,
      },
      { onConflict: 'room_id,user_id', ignoreDuplicates: true }
    );

  await supabaseAdmin
    .from('ChatParticipant')
    .update({ is_active: true, left_at: null })
    .eq('room_id', roomId)
    .eq('user_id', actorUserId);

  return true;
}

async function redactExpiredDeletedMessages(roomId) {
  const retentionDays = ROOM_RETENTION_OVERRIDES[String(roomId)] || CHAT_DELETED_REDACT_DAYS;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  await supabaseAdmin
    .from('ChatMessage')
    .update({
      message: REDACTED_DELETED_MESSAGE,
      attachments: []
    })
    .eq('room_id', roomId)
    .eq('deleted', true)
    .lt('deleted_at', cutoff)
    .neq('message', REDACTED_DELETED_MESSAGE);
}

async function redactExpiredDeletedMessagesForRooms(roomIds) {
  const ids = Array.isArray(roomIds) ? roomIds.filter(Boolean) : [];
  if (ids.length === 0) return;
  await Promise.all(ids.map((roomId) => redactExpiredDeletedMessages(roomId)));
}

function getVisibleMessagePreview(message) {
  if (!message || message.deleted) return null;
  if (message.type === 'file' || (message.attachments && message.attachments.length > 0)) {
    return getAttachmentPreviewLabel(message.attachments || []);
  }
  if (message.message && !/^\[[^\]]*attachment\]$/i.test(message.message)) {
    return message.message.substring(0, 100);
  }
  return getAttachmentPreviewLabel(message.attachments || []);
}

async function resolveRoomPreviewMap(roomPreviews, requestId, logContext) {
  const previewMap = {};
  const deletedRoomIds = [];

  for (const preview of roomPreviews || []) {
    const roomId = String(preview.room_id || '');
    if (!roomId) continue;
    previewMap[roomId] = preview;
    if (preview.deleted) deletedRoomIds.push(roomId);
  }

  const uniqueDeletedRoomIds = Array.from(new Set(deletedRoomIds));
  if (uniqueDeletedRoomIds.length === 0) {
    return previewMap;
  }

  const { data: fallbackRows, error: fallbackErr } = await supabaseAdmin
    .from('ChatMessage')
    .select('id, room_id, message, type, attachments, created_at, deleted')
    .in('room_id', uniqueDeletedRoomIds)
    .eq('deleted', false)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (fallbackErr) {
    logger.warn('Failed to load fallback visible chat previews', {
      requestId,
      context: logContext,
      roomIds: uniqueDeletedRoomIds,
      error: fallbackErr.message,
    });
    return previewMap;
  }

  const fallbackByRoom = {};
  for (const row of fallbackRows || []) {
    const roomId = String(row.room_id || '');
    if (!roomId || fallbackByRoom[roomId]) continue;
    fallbackByRoom[roomId] = row;
  }

  for (const roomId of uniqueDeletedRoomIds) {
    if (fallbackByRoom[roomId]) {
      previewMap[roomId] = fallbackByRoom[roomId];
    } else {
      delete previewMap[roomId];
    }
  }

  return previewMap;
}

/** Strip actor_user_id from messages — it's internal business data. */
function stripActorIdentity(message) {
  if (!message || !message.actor_user_id) return message;
  const { actor_user_id, ...rest } = message;
  return rest;
}

function serializeChatParticipantForViewer(participant) {
  if (!participant) return null;
  const { user, ...safe } = participant;
  return {
    ...safe,
    user: serializeUserAsLocalIdentity(user),
  };
}

function serializeChatRoomForViewer(room) {
  if (!room) return null;
  return {
    ...room,
    participants: Array.isArray(room.participants)
      ? room.participants.map(serializeChatParticipantForViewer)
      : room.participants,
  };
}

function serializeChatMessageForViewer(message, options = {}) {
  if (!message) return null;
  const base = options.includeActorIdentity ? message : stripActorIdentity(message);
  const { sender, ...safe } = base;
  const bodyText = safe.message_text ?? safe.message ?? null;
  const bodyType = safe.message_type ?? safe.type ?? 'text';
  return {
    ...safe,
    // Emit both canonical DB columns and legacy aliases so all clients decode reliably.
    message: safe.message ?? bodyText,
    message_text: bodyText,
    type: safe.type ?? bodyType,
    message_type: bodyType,
    sender: serializeUserIdentityForViewer(sender),
  };
}

/**
 * Parse a pagination cursor: either "timestamp|uuid" composite or plain timestamp.
 * Returns { beforeTs, beforeId } where beforeId may be null (legacy format).
 */
function normalizePaginationCursor(raw) {
  if (!raw) return raw;
  // Query strings decode '+' as space (application/x-www-form-urlencoded).
  // Repair ISO timestamps like "2026-06-06T21:43:12.287311 00:00".
  return String(raw).replace(
    /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?) (\d{2}:\d{2}(?::\d{2})?)/,
    '$1+$2'
  );
}

function parseCursor(before) {
  if (!before) return { beforeTs: null, beforeId: null };
  before = normalizePaginationCursor(before);
  const pipeIdx = before.indexOf('|');
  if (pipeIdx === -1) return { beforeTs: before, beforeId: null };
  return { beforeTs: before.slice(0, pipeIdx), beforeId: before.slice(pipeIdx + 1) };
}

/** Build a nextCursor string from the oldest message in a result set. */
function buildNextCursor(messages) {
  if (!messages || messages.length === 0) return null;
  // messages are in ascending order after .reverse(); oldest is first
  const oldest = messages[0];
  if (!oldest?.created_at || !oldest?.id) return null;
  return `${oldest.created_at}|${oldest.id}`;
}

/**
 * Apply keyset pagination filters to a Supabase query.
 * Uses (created_at, id) composite cursor for stable pagination.
 */
function applyCursorPagination(q, before, after) {
  const { beforeTs, beforeId } = parseCursor(before);
  if (beforeTs) {
    if (beforeId) {
      // Composite cursor: WHERE (created_at < ts) OR (created_at = ts AND id < id)
      q = q.or(`created_at.lt.${beforeTs},and(created_at.eq.${beforeTs},id.lt.${beforeId})`);
    } else {
      // Legacy: plain timestamp
      q = q.lt('created_at', beforeTs);
    }
  }
  if (after) {
    // after is always a plain timestamp (used for polling new messages)
    const afterTs = after.indexOf('|') !== -1 ? after.split('|')[0] : after;
    q = q.gt('created_at', afterTs);
  }
  return q;
}

/**
 * Count non-deleted messages per room.
 * Uses bounded concurrency to avoid overloading PostgREST on large inboxes.
 */
async function countMessagesByRoom(roomIds, batchSize = 20) {
  const ids = Array.from(new Set((roomIds || []).map((id) => String(id)).filter(Boolean)));
  const countsByRoom = {};
  if (ids.length === 0) return countsByRoom;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(async (roomId) => {
        let query = supabaseAdmin
          .from('ChatMessage')
          .select('id', { count: 'exact', head: true })
          .eq('room_id', roomId)
          .eq('deleted', false);

        let { count, error } = await query;
        if (error && /deleted/i.test(String(error.message || ''))) {
          // Backward-compat for older schemas that may not expose `deleted`.
          ({ count, error } = await supabaseAdmin
            .from('ChatMessage')
            .select('id', { count: 'exact', head: true })
            .eq('room_id', roomId));
        }
        if (error) {
          logger.warn('Failed to count chat messages for room', { requestId: req.requestId, roomId, error: error.message });
          return { roomId, count: 0 };
        }
        return { roomId, count: Number(count || 0) };
      }),
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        countsByRoom[result.value.roomId] = result.value.count;
      }
    }
  }

  return countsByRoom;
}

// ============ CHAT ROOM ROUTES ============

/**
 * GET /api/chat/rooms
 * Get user's chat rooms with unread counts
 */
router.get('/rooms', verifyToken, async (req, res) => {
  const roomsStartMs = Date.now();
  try {
    const userId = req.user.id;
    const { limit = 200, type } = req.query;

    let rooms = [];

    const lim = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
    const { data: participantRows, error: partErr } = await supabaseAdmin
      .from('ChatParticipant')
      .select(`
        room_id,
        unread_count,
        last_read_at,
        role,
        is_active,
        room:room_id(
          id,
          type,
          name,
          description,
          gig_id,
          home_id,
          is_active,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', userId)
      .order('joined_at', { ascending: false })
      .limit(lim);

    if (partErr) {
      logger.error('Error fetching chat rooms', { requestId: req.requestId, userId, error: partErr.message });
      return res.status(500).json({ error: 'Failed to fetch chat rooms' });
    }

    // Build room list
    const roomList = (participantRows || []).filter(p => p.room);

    // Batch-fetch other participants and last messages for all rooms (2 queries instead of 2N)
    const allRoomIds = roomList.map(p => p.room.id);

    const [{ data: allOtherParts }, { data: roomPreviews }] = await Promise.all([
      supabaseAdmin
        .from('ChatParticipant')
        .select('room_id, user:user_id(id, username, name, first_name, middle_name, last_name, profile_picture_url)')
        .in('room_id', allRoomIds)
        .neq('user_id', userId)
        .order('is_active', { ascending: false }),
      supabaseAdmin.rpc('get_room_previews', { p_room_ids: allRoomIds }),
    ]);

    // Pick first (active-preferred) participant per room
    const partByRoom = {};
    for (const p of allOtherParts || []) {
      if (!partByRoom[p.room_id] && p.user) partByRoom[p.room_id] = p.user;
    }
    const identityByUserId = await loadLocalIdentityMapForUsers(Object.values(partByRoom));
    // Index previews by room_id (RPC returns exactly one row per room)
    const msgByRoom = await resolveRoomPreviewMap(roomPreviews, req.requestId, 'chat_rooms');

    const enrichedRooms = roomList.map((p) => {
      const roomId = p.room.id;
      const u = partByRoom[roomId] || null;
      const otherIdentity = u
        ? (identityByUserId.get(String(u.id)) || serializeUserAsLocalIdentity(u))
        : null;
      const lastMsg = msgByRoom[roomId] || null;

      let lastMessagePreview = null;
      let lastMessageAt = null;
      if (lastMsg) {
        lastMessagePreview = getVisibleMessagePreview(lastMsg);
        lastMessageAt = lastMsg.created_at;
      }

      return {
        id: roomId,
        room_type: p.room.type,
        room_name: p.room.name,
        description: p.room.description,
        gig_id: p.room.gig_id,
        home_id: p.room.home_id,
        is_active: p.room.is_active,
        participant_active: p.is_active,
        created_at: p.room.created_at,
        updated_at: p.room.updated_at,
        last_message_at: lastMessageAt || p.room.updated_at,
        last_message_preview: lastMessagePreview,
        unread_count: p.unread_count || 0,
        last_read_at: p.last_read_at,
        role: p.role,
        other_participant_id: u?.id || otherIdentity?.id || null,
        other_participant_name: otherIdentity?.displayName || null,
        other_participant_username: otherIdentity?.handle || null,
        other_participant_avatar: otherIdentity?.avatarUrl || null,
        other_participant_identity: otherIdentity,
      };
    });

    rooms = enrichedRooms;

    rooms.sort((a, b) => {
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return tb - ta;
    });
    
    // Filter by type if specified
    if (type) {
      rooms = rooms.filter(r => (r.room_type || r.type) === type);
    }
    
    recordHistogram('chat.rooms.load_latency_ms', Date.now() - roomsStartMs);
    res.json({
      rooms,
      total: rooms.length,
      totalUnread: rooms.reduce((sum, r) => sum + (r.unread_count || 0), 0)
    });

  } catch (err) {
    logger.error('Chat rooms fetch error', { requestId: req.requestId, userId: req.user?.id, error: err.message });
    res.status(500).json({ error: 'Failed to fetch chat rooms' });
  }
});

/**
 * GET /api/chat/business/:businessUserId/rooms
 * Get chat rooms for a business identity (shared inbox view for authorized team).
 */
router.get('/business/:businessUserId/rooms', verifyToken, async (req, res) => {
  try {
    const actorUserId = req.user.id;
    const { businessUserId } = req.params;
    const { limit = 200, type } = req.query;

    const allowed = await canActAsBusiness(businessUserId, actorUserId);
    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to access this business inbox' });
    }

    const teamMemberIds = await getBusinessMessagingMemberIds(businessUserId);
    const teamSet = new Set(teamMemberIds.map((id) => String(id)));

    const { data: participantRows, error: partErr } = await supabaseAdmin
      .from('ChatParticipant')
      .select(`
        room_id,
        unread_count,
        last_read_at,
        role,
        room:room_id(
          id,
          type,
          name,
          description,
          gig_id,
          home_id,
          is_active,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', businessUserId)
      .eq('is_active', true)
      .order('joined_at', { ascending: false })
      .limit(parseInt(limit));

    if (partErr) {
      logger.error('Error fetching business chat rooms', { requestId: req.requestId, userId: actorUserId, businessUserId, error: partErr.message });
      return res.status(500).json({ error: 'Failed to fetch business chat rooms' });
    }

    const roomList = (participantRows || []).filter((p) => p.room);

    // NOTE: We intentionally do NOT auto-upsert the actor as a participant
    // across all business rooms on inbox load. That was too aggressive — it
    // added the team member to every room the business owns, even rooms they
    // never opened. Instead, the actor is added as a participant only when
    // they explicitly open a specific room (via ensureBusinessRoomActorAccess
    // called from GET /rooms/:roomId, GET /rooms/:roomId/messages, or
    // POST /messages with asBusinessUserId).

    // Batch-fetch participants and last messages for all rooms (2 queries instead of 2N)
    const allBizRoomIds = roomList.map(p => p.room.id);
    const [{ data: allBizParts }, { data: bizRoomPreviews }] = await Promise.all([
      supabaseAdmin
        .from('ChatParticipant')
        .select('room_id, user:user_id(id, username, name, first_name, middle_name, last_name)')
        .in('room_id', allBizRoomIds)
        .eq('is_active', true),
      supabaseAdmin.rpc('get_room_previews', { p_room_ids: allBizRoomIds }),
    ]);

    // Group participants by room
    const bizPartsByRoom = {};
    for (const p of allBizParts || []) {
      if (!bizPartsByRoom[p.room_id]) bizPartsByRoom[p.room_id] = [];
      if (p.user) bizPartsByRoom[p.room_id].push(p.user);
    }
    const bizIdentityByUserId = await loadLocalIdentityMapForUsers(
      Object.values(bizPartsByRoom).flat()
    );
    // Index previews by room_id (RPC returns exactly one row per room)
    const bizMsgByRoom = await resolveRoomPreviewMap(bizRoomPreviews, req.requestId, 'business_chat_rooms');

    const rooms = roomList.map((p) => {
      const roomId = p.room.id;
      const users = bizPartsByRoom[roomId] || [];
      const external = users.find((u) => !teamSet.has(String(u.id)));
      const fallback = users.find((u) => String(u.id) !== String(businessUserId));
      const chosen = external || fallback || null;
      const otherIdentity = chosen
        ? (bizIdentityByUserId.get(String(chosen.id)) || serializeUserAsLocalIdentity(chosen))
        : null;

      let lastMessagePreview = null;
      let lastMessageAt = null;
      const lastMsg = bizMsgByRoom[roomId] || null;
      if (lastMsg) {
        lastMessagePreview = getVisibleMessagePreview(lastMsg);
        lastMessageAt = lastMsg.created_at;
      }

      return {
        id: roomId,
        room_type: p.room.type,
        room_name: p.room.name,
        description: p.room.description,
        gig_id: p.room.gig_id,
        home_id: p.room.home_id,
        is_active: p.room.is_active,
        created_at: p.room.created_at,
        updated_at: p.room.updated_at,
        last_message_at: lastMessageAt || p.room.updated_at,
        last_message_preview: lastMessagePreview,
        unread_count: p.unread_count || 0,
        last_read_at: p.last_read_at,
        role: p.role,
        other_participant_id: chosen?.id || otherIdentity?.id || null,
        other_participant_name: otherIdentity?.displayName || null,
        other_participant_username: otherIdentity?.handle || null,
        other_participant_identity: otherIdentity,
      };
    });

    let filtered = rooms;
    if (type) filtered = rooms.filter((r) => (r.room_type || r.type) === type);
    filtered.sort((a, b) => {
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return tb - ta;
    });

    res.json({
      rooms: filtered,
      total: filtered.length,
      totalUnread: filtered.reduce((sum, r) => sum + (r.unread_count || 0), 0),
      businessUserId,
    });
  } catch (err) {
    logger.error('Business chat rooms fetch error', { requestId: req.requestId, userId: req.user?.id, error: err.message });
    res.status(500).json({ error: 'Failed to fetch business chat rooms' });
  }
});

/**
 * GET /api/chat/rooms/:roomId
 * Get chat room details
 */
router.get('/rooms/:roomId', verifyToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    const asBusinessUserId = req.query.asBusinessUserId ? String(req.query.asBusinessUserId) : null;
    
    // Verify access
    let { data: participant } = await supabaseAdmin
      .from('ChatParticipant')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (!participant) {
      if (!asBusinessUserId) return res.status(403).json({ error: 'Access denied' });
      const allowedViaBusiness = await ensureBusinessRoomActorAccess(roomId, userId, asBusinessUserId);
      if (!allowedViaBusiness) return res.status(403).json({ error: 'Access denied' });
      const refreshed = await supabaseAdmin
        .from('ChatParticipant')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .maybeSingle();
      participant = refreshed.data || null;
      if (!participant) return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get room details
    const { data: room, error } = await supabaseAdmin
      .from('ChatRoom')
      .select(`
        *,
        participants:ChatParticipant!room_id(
          user_id,
          role,
          unread_count,
          last_read_at,
          joined_at,
          user:user_id(
            id,
            username,
            name,
            first_name,
            last_name,
            profile_picture_url
          )
        )
      `)
      .eq('id', roomId)
      .single();
    
    if (error || !room) {
      if (error) logger.error('Error fetching room', { requestId: req.requestId, userId: req.user?.id, roomId, error: error.message });
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({ room: serializeChatRoomForViewer(room) });
    
  } catch (err) {
    logger.error('Room fetch error', { requestId: req.requestId, userId: req.user?.id, roomId: req.params.roomId, error: err.message });
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

/**
 * POST /api/chat/direct
 * Create or get direct chat with another user
 */
router.post('/direct', verifyToken, directChatLimiter, validate(createDirectChatSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { otherUserId, asBusinessUserId } = req.body;
    let initiatorIdentityUserId = userId;

    // Curator accounts cannot initiate direct messages
    if (req.user.accountType === 'curator') {
      return res.status(403).json({ error: 'This account cannot send messages' });
    }

    if (String(userId) === String(otherUserId) && !asBusinessUserId) {
      return res.status(400).json({ error: 'Cannot create chat with yourself' });
    }

    // Block check: prevent direct chat creation between blocked users
    if (await isBlocked(userId, otherUserId)) {
      return res.status(403).json({ error: 'Unable to message this user' });
    }

    if (asBusinessUserId) {
      const allowed = await canActAsBusiness(asBusinessUserId, userId);
      if (!allowed) {
        return res.status(403).json({ error: 'You do not have permission to chat as this business' });
      }
      if (String(asBusinessUserId) === String(otherUserId)) {
        return res.status(400).json({ error: 'Cannot create chat where both participants are the same business' });
      }
      initiatorIdentityUserId = asBusinessUserId;
    }
    
    // Check if other user exists
    const { data: otherUser, error: userError } = await supabaseAdmin
      .from('User')
      .select('id, username, name, profile_picture_url, account_type')
      .eq('id', otherUserId)
      .single();
    
    if (userError || !otherUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Exclude curator accounts — platform-owned, cannot receive messages
    if (otherUser.account_type === 'curator') {
      return res.status(403).json({ error: 'This account does not accept messages' });
    }

    // Get or create chat
    const { data: roomId, error } = await supabaseAdmin.rpc('get_or_create_direct_chat', {
      p_user_id_1: initiatorIdentityUserId,
      p_user_id_2: otherUserId
    });
    
    if (error) {
      logger.error('Error creating direct chat', { requestId: req.requestId, userId, otherUserId, error: error.message });
      return res.status(500).json({ error: 'Failed to create chat' });
    }

    // Ensure actor + all authorized business members can access business direct chats.
    const participantIds = new Set([String(initiatorIdentityUserId), String(otherUserId), String(userId)]);
    if (await isBusinessAccount(initiatorIdentityUserId)) {
      const memberIds = await getBusinessMessagingMemberIds(initiatorIdentityUserId);
      for (const memberId of memberIds) participantIds.add(String(memberId));
    }
    if (otherUser.account_type === 'business') {
      const memberIds = await getBusinessMessagingMemberIds(otherUserId);
      for (const memberId of memberIds) participantIds.add(String(memberId));
    }

    const participants = Array.from(participantIds).map((participantUserId) => ({
      room_id: roomId,
      user_id: participantUserId,
      role: String(participantUserId) === String(initiatorIdentityUserId) ? 'owner' : 'member',
      is_active: true,
      left_at: null,
    }));

    const { error: participantUpsertError } = await supabaseAdmin
      .from('ChatParticipant')
      .upsert(participants, { onConflict: 'room_id,user_id', ignoreDuplicates: true });

    if (participantUpsertError) {
      logger.error('Error ensuring direct chat participants', {
        error: participantUpsertError.message,
        roomId,
        actorUserId: userId,
        initiatorIdentityUserId,
        otherUserId,
      });
      return res.status(500).json({ error: 'Failed to initialize chat participants' });
    }

    await supabaseAdmin
      .from('ChatParticipant')
      .update({ is_active: true, left_at: null })
      .eq('room_id', roomId)
      .in('user_id', Array.from(participantIds));
    
    incCounter('chat.room.created', { type: 'direct' });
    logger.info('Direct chat created/retrieved', { requestId: req.requestId, roomId, userId, initiatorIdentityUserId, otherUserId });

    res.status(201).json({
      roomId,
      otherUser
    });
    
  } catch (err) {
    logger.error('Direct chat creation error', { requestId: req.requestId, userId: req.user?.id, error: err.message });
    res.status(500).json({ error: 'Failed to create direct chat' });
  }
});

/**
 * POST /api/chat/group
 * Create a group chat
 */
router.post('/group', verifyToken, groupChatLimiter, validate(createGroupChatSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { roomName, roomDescription, participantIds } = req.body;
    
    // Create room
    const { data: room, error: roomError } = await supabaseAdmin
      .from('ChatRoom')
      .insert({
        type: 'group',
        name: roomName,
        description: roomDescription
      })
      .select()
      .single();
    
    if (roomError) {
      logger.error('Error creating group chat', { requestId: req.requestId, userId, error: roomError.message });
      return res.status(500).json({ error: 'Failed to create group chat' });
    }
    
    // Add creator as owner
    const participants = [
      { room_id: room.id, user_id: userId, role: 'owner' }
    ];
    
    // Add other participants
    for (const participantId of participantIds) {
      if (participantId !== userId) {
        participants.push({
          room_id: room.id,
          user_id: participantId,
          role: 'member'
        });
      }
    }
    
    const { error: participantError } = await supabaseAdmin
      .from('ChatParticipant')
      .insert(participants);
    
    if (participantError) {
      // Rollback room creation
      await supabaseAdmin.from('ChatRoom').delete().eq('id', room.id);
      logger.error('Error adding participants', { requestId: req.requestId, userId: req.user?.id, roomId: room.id, error: participantError.message });
      return res.status(500).json({ error: 'Failed to add participants' });
    }
    
    incCounter('chat.room.created', { type: 'group' });
    logger.info('Group chat created', { requestId: req.requestId, roomId: room.id, userId, participantCount: participants.length });

    res.status(201).json({
      room: room,
      participantCount: participants.length
    });
    
  } catch (err) {
    logger.error('Group chat creation error', { requestId: req.requestId, userId: req.user?.id, error: err.message });
    res.status(500).json({ error: 'Failed to create group chat' });
  }
});

/**
 * PUT /api/chat/rooms/:roomId
 * Update room details (name, description)
 */
router.put('/rooms/:roomId', verifyToken, validate(updateRoomSchema), async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    const { roomName, roomDescription } = req.body;
    
    // Verify user is owner/admin
    const { data: participant } = await supabaseAdmin
      .from('ChatParticipant')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single();
    
    if (!participant || !['owner', 'admin'].includes(participant.role)) {
      return res.status(403).json({ error: 'Not authorized to update room' });
    }
    
    const updates = {};
    if (roomName) updates.name = roomName;
    if (roomDescription !== undefined) updates.description = roomDescription;
    updates.updated_at = new Date().toISOString();
    
    const { data, error } = await supabaseAdmin
      .from('ChatRoom')
      .update(updates)
      .eq('id', roomId)
      .select()
      .single();
    
    if (error) {
      logger.error('Error updating room', { requestId: req.requestId, userId: req.user?.id, roomId, error: error.message });
      return res.status(500).json({ error: 'Failed to update room' });
    }
    
    res.json({ room: data });
    
  } catch (err) {
    logger.error('Room update error', { requestId: req.requestId, userId: req.user?.id, roomId: req.params.roomId, error: err.message });
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// ============ MESSAGE ROUTES ============

/**
 * GET /api/chat/rooms/:roomId/pre-bid-status
 * Check if the current user is in a pre-bid state for a gig chat.
 * Returns message count, limit, remaining, and gig_id.
 */
router.get('/rooms/:roomId/pre-bid-status', verifyToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    const { data: room } = await supabaseAdmin
      .from('ChatRoom')
      .select('id, type, gig_id')
      .eq('id', roomId)
      .single();

    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Not a gig chat — no limit applies
    if (room.type !== 'gig' || !room.gig_id) {
      return res.json({ is_pre_bid: false, gig_id: null });
    }

    const { data: gig } = await supabaseAdmin
      .from('Gig')
      .select('user_id, accepted_by')
      .eq('id', room.gig_id)
      .single();

    const ownerCtx = gig
      ? await getGigOwnerMessagingContext(gig.user_id, userId)
      : { isOwnerActor: false };
    const isOwner = ownerCtx.isOwnerActor;
    const isAccepted = gig && gig.accepted_by && String(gig.accepted_by) === String(userId);

    if (isOwner || isAccepted) {
      return res.json({ is_pre_bid: false, gig_id: room.gig_id });
    }

    // Check for bid
    const { data: userBid } = await supabaseAdmin
      .from('GigBid')
      .select('id')
      .eq('gig_id', room.gig_id)
      .eq('user_id', userId)
      .in('status', ['pending', 'accepted', 'countered'])
      .maybeSingle();

    if (userBid) {
      return res.json({ is_pre_bid: false, gig_id: room.gig_id, has_bid: true });
    }

    // Pre-bid: count messages
    const PRE_BID_MESSAGE_LIMIT = 3;
    const { count } = await supabaseAdmin
      .from('ChatMessage')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('user_id', userId);

    return res.json({
      is_pre_bid: true,
      gig_id: room.gig_id,
      messages_sent: count || 0,
      messages_limit: PRE_BID_MESSAGE_LIMIT,
      messages_remaining: Math.max(0, PRE_BID_MESSAGE_LIMIT - (count || 0)),
    });
  } catch (err) {
    logger.error('Pre-bid status error', { requestId: req.requestId, userId: req.user?.id, roomId: req.params.roomId, error: err.message });
    res.status(500).json({ error: 'Failed to check pre-bid status' });
  }
});

/**
 * GET /api/chat/conversations/:otherUserId/messages
 * Canonical person-conversation feed across all shared rooms.
 */
router.get('/conversations/:otherUserId/messages', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { otherUserId } = req.params;
    const { limit = 100, before, after, topicId } = req.query;
    const asBusinessUserId = req.query.asBusinessUserId ? String(req.query.asBusinessUserId) : null;

    const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 400);
    const identityUserIds = new Set([String(userId)]);

    if (asBusinessUserId) {
      const canAct = await canActAsBusiness(asBusinessUserId, userId);
      if (!canAct) return res.status(403).json({ error: 'Access denied' });
      identityUserIds.add(String(asBusinessUserId));
    }

    const { data: mineRows, error: mineErr } = await supabaseAdmin
      .from('ChatParticipant')
      .select('room_id')
      .in('user_id', Array.from(identityUserIds));

    if (mineErr) {
      logger.error('Error loading actor conversation rooms', { requestId: req.requestId, userId, otherUserId, error: mineErr.message });
      return res.status(500).json({ error: 'Failed to fetch conversation rooms' });
    }

    const { data: otherRows, error: otherErr } = await supabaseAdmin
      .from('ChatParticipant')
      .select('room_id')
      .eq('user_id', otherUserId);

    if (otherErr) {
      logger.error('Error loading target conversation rooms', { requestId: req.requestId, userId, otherUserId, error: otherErr.message });
      return res.status(500).json({ error: 'Failed to fetch conversation rooms' });
    }

    const myRoomSet = new Set((mineRows || []).map((r) => String(r.room_id)));
    const sharedRoomIds = (otherRows || [])
      .map((r) => String(r.room_id))
      .filter((rid) => myRoomSet.has(rid));

    if (sharedRoomIds.length === 0) {
      return res.json({ messages: [], hasMore: false, roomIds: [] });
    }

    const runQuery = async ({ senderKey }) => {
      let q = supabaseAdmin
        .from('ChatMessage')
        .select(`
          *,
          sender:${senderKey}(
            id,
            username,
            name,
            profile_picture_url
          )
        `)
        .in('room_id', sharedRoomIds)
        .eq('deleted', false)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(lim);

      if (topicId) q = q.eq('topic_id', topicId);
      q = applyCursorPagination(q, before, after);
      return q;
    };

    let messages = null;
    let error = null;

    ({ data: messages, error } = await runQuery({ senderKey: 'user_id' }));
    if (error) {
      logger.warn('Primary conversation query failed; trying legacy fallback', { requestId: req.requestId, userId, otherUserId, error: error.message });
      ({ data: messages, error } = await runQuery({ senderKey: 'sender_id' }));
    }

    if (error) {
      logger.error('Error fetching canonical person conversation', { requestId: req.requestId, userId, otherUserId, error: error.message });
      return res.status(500).json({ error: 'Failed to fetch conversation messages' });
    }

    // Batch-fetch reactions for all visible messages to avoid N+1 queries
    const visibleMessages = (messages || []).reverse();
    const messageIds = visibleMessages.map((m) => m.id).filter(Boolean);
    const reactionMap = await buildReactionSummary(messageIds, userId);
    const messagesWithReactions = visibleMessages.map((m) => ({
      ...serializeChatMessageForViewer(m),
      reactions: reactionMap.get(m.id) || [],
    }));

    const hasMore = Array.isArray(messages) && messages.length === lim;
    res.json({
      messages: messagesWithReactions,
      hasMore,
      nextCursor: hasMore ? buildNextCursor(visibleMessages) : null,
      roomIds: sharedRoomIds,
    });
  } catch (err) {
    logger.error('Canonical conversation fetch error', { requestId: req.requestId, userId: req.user?.id, error: err.message });
    res.status(500).json({ error: 'Failed to fetch conversation messages' });
  }
});

/**
 * POST /api/chat/conversations/:otherUserId/read
 * Mark all shared-room messages with a person as read.
 */
router.post('/conversations/:otherUserId/read', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { otherUserId } = req.params;
    const asBusinessUserId = req.body?.asBusinessUserId ? String(req.body.asBusinessUserId) : null;
    const identityUserIds = new Set([String(userId)]);
    let readTargetUserId = userId;

    if (asBusinessUserId) {
      const canAct = await canActAsBusiness(asBusinessUserId, userId);
      if (!canAct) return res.status(403).json({ error: 'Access denied' });
      identityUserIds.add(String(asBusinessUserId));
      readTargetUserId = asBusinessUserId;
    }

    const { data: mineRows, error: mineErr } = await supabaseAdmin
      .from('ChatParticipant')
      .select('room_id')
      .in('user_id', Array.from(identityUserIds));

    if (mineErr) {
      logger.error('Error loading actor rooms for conversation read', { requestId: req.requestId, userId, otherUserId, error: mineErr.message });
      return res.status(500).json({ error: 'Failed to mark conversation as read' });
    }

    const { data: otherRows, error: otherErr } = await supabaseAdmin
      .from('ChatParticipant')
      .select('room_id')
      .eq('user_id', otherUserId);

    if (otherErr) {
      logger.error('Error loading target rooms for conversation read', { requestId: req.requestId, userId, otherUserId, error: otherErr.message });
      return res.status(500).json({ error: 'Failed to mark conversation as read' });
    }

    const myRoomSet = new Set((mineRows || []).map((r) => String(r.room_id)));
    const sharedRoomIds = (otherRows || [])
      .map((r) => String(r.room_id))
      .filter((rid) => myRoomSet.has(rid));

    if (sharedRoomIds.length === 0) {
      return res.json({ unreadCount: 0, updatedRooms: 0 });
    }

    const stamp = new Date().toISOString();
    const usersToClear = asBusinessUserId
      ? Array.from(new Set([String(readTargetUserId), String(userId)]))
      : [String(readTargetUserId)];

    const { error: updateErr } = await supabaseAdmin
      .from('ChatParticipant')
      .update({
        unread_count: 0,
        last_read_at: stamp
      })
      .in('room_id', sharedRoomIds)
      .in('user_id', usersToClear);

    if (updateErr) {
      logger.error('Error updating participants for conversation read', { requestId: req.requestId, userId, otherUserId, error: updateErr.message });
      return res.status(500).json({ error: 'Failed to mark conversation as read' });
    }

    badgeService.emitBadgeUpdateToMany(usersToClear);
    return res.json({ unreadCount: 0, updatedRooms: sharedRoomIds.length });
  } catch (err) {
    logger.error('Conversation read error', { requestId: req.requestId, userId: req.user?.id, error: err.message });
    return res.status(500).json({ error: 'Failed to mark conversation as read' });
  }
});

/**
 * GET /api/chat/rooms/:roomId/messages
 * Get messages for a room (paginated)
 */
router.get('/rooms/:roomId/messages', verifyToken, async (req, res) => {
  const msgsStartMs = Date.now();
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    const { limit = 50, before, after } = req.query;
    const asBusinessUserId = req.query.asBusinessUserId ? String(req.query.asBusinessUserId) : null;
    
    // Verify access
    let { data: participant } = await supabaseAdmin
      .from('ChatParticipant')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (!participant) {
      if (!asBusinessUserId) return res.status(403).json({ error: 'Access denied' });
      const allowedViaBusiness = await ensureBusinessRoomActorAccess(roomId, userId, asBusinessUserId);
      if (!allowedViaBusiness) return res.status(403).json({ error: 'Access denied' });
      const refreshed = await supabaseAdmin
        .from('ChatParticipant')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .maybeSingle();
      participant = refreshed.data || null;
      if (!participant) return res.status(403).json({ error: 'Access denied' });
    }
    
    const lim = Math.min(Math.max(parseInt(limit) || 50, 1), 200);

    const runQuery = async ({ senderKey }) => {
      let q = supabaseAdmin
        .from('ChatMessage')
        .select(`
          *,
          sender:${senderKey}(
            id,
            username,
            name,
            profile_picture_url
          )
        `)
        .eq('room_id', roomId)
        .eq('deleted', false)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(lim);

      q = applyCursorPagination(q, before, after);
      return q;
    };

    let messages = null;
    let error = null;

    // Preferred schema: user_id
    ({ data: messages, error } = await runQuery({ senderKey: 'user_id' }));

    // Fallback for legacy schema variants: sender_id
    if (error) {
      logger.warn('Primary chat message query failed; trying legacy fallback', { requestId: req.requestId, userId: req.user?.id, roomId, error: error.message });
      ({ data: messages, error } = await runQuery({ senderKey: 'sender_id' }));
    }

    if (error) {
      logger.error('Error fetching messages', { requestId: req.requestId, userId: req.user?.id, roomId, error: error.message });
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    // Batch-fetch reactions for all visible messages to avoid N+1 queries
    const visibleMessages = (messages || []).reverse();
    const messageIds = visibleMessages.map((m) => m.id).filter(Boolean);
    const reactionMap = await buildReactionSummary(messageIds, userId);
    const messagesWithReactions = visibleMessages.map((m) => ({
      ...serializeChatMessageForViewer(m),
      reactions: reactionMap.get(m.id) || [],
    }));

    const hasMore = Array.isArray(messages) && messages.length === lim;
    recordHistogram('chat.messages.load_latency_ms', Date.now() - msgsStartMs);
    res.json({
      messages: messagesWithReactions,
      hasMore,
      nextCursor: hasMore ? buildNextCursor(visibleMessages) : null,
    });

  } catch (err) {
    logger.error('Messages fetch error', { requestId: req.requestId, userId: req.user?.id, roomId: req.params.roomId || req.query.roomId, error: err.message });
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * POST /api/chat/messages
 * Send a message (alternative to WebSocket)
 */
router.post('/messages', verifyToken, messageSendLimiter, validate(sendMessageSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const requestId = req.requestId;
    const sendStartMs = Date.now();
    const { roomId, messageText, messageType, fileIds = [], metadata = {}, replyToId, asBusinessUserId, clientMessageId } = req.body;
    logger.info('message_send_start', { requestId, roomId, userId, messageType });
    let senderUserId = userId;
    
    // Verify participant
    let { data: participant } = await supabaseAdmin
      .from('ChatParticipant')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    
    if (!participant) {
      if (!asBusinessUserId) return res.status(403).json({ error: 'Not a participant' });
      const allowedViaBusiness = await ensureBusinessRoomActorAccess(roomId, userId, asBusinessUserId);
      if (!allowedViaBusiness) return res.status(403).json({ error: 'Not a participant' });
      const refreshed = await supabaseAdmin
        .from('ChatParticipant')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();
      participant = refreshed.data || null;
      if (!participant) return res.status(403).json({ error: 'Not a participant' });
    }

    // ─── Pre-bid message limit for gig chats ───
    const PRE_BID_MESSAGE_LIMIT = 3;

    const { data: room } = await supabaseAdmin
      .from('ChatRoom')
      .select('id, type, gig_id')
      .eq('id', roomId)
      .single();

    // ─── Block check for direct chats ───
    // For gig/group chats, blocking is handled differently (not enforced here).
    if (room && room.type === 'direct') {
      const { data: otherParticipants } = await supabaseAdmin
        .from('ChatParticipant')
        .select('user_id')
        .eq('room_id', roomId)
        .neq('user_id', userId)
        .eq('is_active', true)
        .limit(1);
      const otherUserId = otherParticipants?.[0]?.user_id;
      if (otherUserId && await isBlocked(userId, otherUserId)) {
        return res.status(403).json({ error: 'Unable to message this user' });
      }
    }

    // ─── Business Identity for Direct Chats ───
    // Business identity requires an explicit asBusinessUserId from the client.
    // We intentionally do NOT auto-detect business identity by scanning room
    // participants. Auto-detection caused a privacy bug where team members'
    // personal messages were silently sent as the business identity whenever
    // the business happened to be a participant in the room. The client must
    // opt-in to business identity on each message send.
    if (room && room.type === 'direct' && asBusinessUserId) {
      const canAct = await canActAsBusiness(asBusinessUserId, userId);
      if (!canAct) {
        return res.status(403).json({ error: 'You do not have permission to message as this business' });
      }
      const { data: businessParticipant } = await supabaseAdmin
        .from('ChatParticipant')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', asBusinessUserId)
        .eq('is_active', true)
        .maybeSingle();

      if (!businessParticipant) {
        return res.status(400).json({ error: 'This business is not a participant in the chat room' });
      }
      senderUserId = asBusinessUserId;
    }

    if (room && room.type === 'gig' && room.gig_id) {
      // Check if user is the gig poster or has a bid
      const { data: gig } = await supabaseAdmin
        .from('Gig')
        .select('user_id, accepted_by')
        .eq('id', room.gig_id)
        .single();

      const ownerCtx = gig
        ? await getGigOwnerMessagingContext(gig.user_id, userId)
        : { isOwnerActor: false, messageSenderUserId: userId };
      const isGigOwner = ownerCtx.isOwnerActor;
      senderUserId = ownerCtx.messageSenderUserId || userId;
      const isAcceptedWorker = gig && gig.accepted_by && String(gig.accepted_by) === String(userId);

      if (!isGigOwner && !isAcceptedWorker) {
        // Check for a bid
        const { data: userBid } = await supabaseAdmin
          .from('GigBid')
          .select('id')
          .eq('gig_id', room.gig_id)
          .eq('user_id', userId)
          .in('status', ['pending', 'accepted', 'countered'])
          .maybeSingle();

        if (!userBid) {
          // Pre-bid user — enforce message limit
          const { count } = await supabaseAdmin
            .from('ChatMessage')
            .select('id', { count: 'exact', head: true })
            .eq('room_id', roomId)
            .eq('user_id', userId);

          if ((count || 0) >= PRE_BID_MESSAGE_LIMIT) {
            return res.status(429).json({
              error: `You can send up to ${PRE_BID_MESSAGE_LIMIT} messages before placing a bid. Place a bid to continue chatting.`,
              code: 'PRE_BID_LIMIT',
              messages_sent: count || 0,
              messages_limit: PRE_BID_MESSAGE_LIMIT,
            });
          }
        }
      }
    }
    
    // Validate and expand attachment payload.
    let attachmentPayload = [];
    if (fileIds && fileIds.length > 0) {
      const uniqueFileIds = [...new Set(fileIds.map((id) => String(id)))];
      const { data: files, error: fileErr } = await supabaseAdmin
        .from('File')
        .select('id, user_id, file_url, original_filename, mime_type, file_size, is_deleted, file_type')
        .in('id', uniqueFileIds);

      if (fileErr) {
        return res.status(400).json({ error: 'Failed to validate attached files' });
      }

      const validFiles = (files || []).filter((f) =>
        String(f.user_id) === String(userId) &&
        !f.is_deleted &&
        f.file_type === 'chat_file'
      );

      if (validFiles.length !== uniqueFileIds.length) {
        return res.status(400).json({ error: 'One or more attached files are invalid or not owned by you' });
      }

      const validMap = new Map(validFiles.map((f) => [String(f.id), f]));
      attachmentPayload = uniqueFileIds.map((fid) => {
        const f = validMap.get(String(fid));
        return {
          id: f.id,
          file_url: f.file_url,
          original_filename: f.original_filename,
          mime_type: f.mime_type,
          file_size: f.file_size,
          file_type: f.file_type,
        };
      });
    }

    const resolvedType = messageType || (attachmentPayload.length > 0 ? 'file' : 'text');
    const resolvedMessage = (messageText && String(messageText).trim().length > 0)
      ? String(messageText).trim()
      : (attachmentPayload.length > 0 ? getAttachmentPreviewLabel(attachmentPayload) : '');

    if (!resolvedMessage) {
      return res.status(400).json({ error: 'Message text required' });
    }

    const insertMessage = async (payload) => supabaseAdmin
      .from('ChatMessage')
      .insert(payload)
      .select(`
        *,
        sender:user_id(
          id,
          username,
          name,
          profile_picture_url
        )
      `)
      .single();

    // ─── Validate cross-object references ───

    if (replyToId) {
      const { data: replyTarget } = await supabaseAdmin
        .from('ChatMessage')
        .select('id, room_id, deleted')
        .eq('id', replyToId)
        .maybeSingle();

      if (!replyTarget || replyTarget.room_id !== roomId || replyTarget.deleted) {
        return res.status(400).json({ error: 'Reply target not found in this room' });
      }
    }

    const topicId = req.body.topicId;
    if (topicId) {
      const { data: topic } = await supabaseAdmin
        .from('ConversationTopic')
        .select('id, conversation_user_id_1, conversation_user_id_2')
        .eq('id', topicId)
        .maybeSingle();

      if (!topic) {
        return res.status(400).json({ error: 'Invalid topic for this conversation' });
      }

      // The acting user (not the business identity) must be one of the topic's participants
      const topicUsers = [String(topic.conversation_user_id_1), String(topic.conversation_user_id_2)];
      if (!topicUsers.includes(String(userId))) {
        return res.status(400).json({ error: 'Invalid topic for this conversation' });
      }
    }

    // ─── Idempotency check ───
    // If the client provides a clientMessageId (UUID), check for an existing
    // message with that ID in the same room by the same sender. If found,
    // return it as an idempotent success instead of inserting a duplicate.
    if (clientMessageId) {
      const { data: existingMsg } = await supabaseAdmin
        .from('ChatMessage')
        .select(`
          *,
          sender:user_id(
            id,
            username,
            name,
            profile_picture_url
          )
        `)
        .eq('client_message_id', clientMessageId)
        .maybeSingle();

      if (existingMsg) {
        return res.json({ message: serializeChatMessageForViewer(existingMsg) });
      }
    }

    // Insert message
    const messageData = {
      room_id: roomId,
      user_id: senderUserId,
      message: resolvedMessage,
      type: resolvedType,
      attachments: attachmentPayload,
    };
    if (clientMessageId) {
      messageData.client_message_id = clientMessageId;
    }
    // Persist the actual human actor when sending on behalf of a business identity
    if (String(senderUserId) !== String(userId)) {
      messageData.actor_user_id = userId;
    }
    if (metadata && typeof metadata === 'object') {
      messageData.metadata = metadata;
    }
    if (replyToId) {
      messageData.reply_to_id = replyToId;
    }
    if (topicId) {
      messageData.topic_id = topicId;
    }

    let supportsMetadataColumn = true;
    let { data: message, error } = await insertMessage(messageData);

    // Backward-compat fallback:
    // - legacy DB may not have ChatMessage.actor_user_id
    // - legacy DB may not have ChatMessage.metadata
    // - legacy ChatMessage_type_check may reject newer types (location/gig_offer/audio/video)
    if (error && /actor_user_id/i.test(String(error.message || ''))) {
      const noActorPayload = { ...messageData };
      delete noActorPayload.actor_user_id;
      ({ data: message, error } = await insertMessage(noActorPayload));
    }

    if (error && /metadata/i.test(String(error.message || ''))) {
      supportsMetadataColumn = false;
      const noMetadataPayload = { ...messageData };
      delete noMetadataPayload.metadata;
      delete noMetadataPayload.actor_user_id;
      ({ data: message, error } = await insertMessage(noMetadataPayload));
    }

    if (error && /ChatMessage_type_check|violates check constraint/i.test(String(error.message || ''))) {
      logger.warn('ChatMessage type_check constraint rejected type, downgrading', { originalType: resolvedType, roomId });
      const downgradedPayload = {
        ...messageData,
        type: attachmentPayload.length > 0 ? 'file' : 'text',
      };
      if (!supportsMetadataColumn) {
        delete downgradedPayload.metadata;
      }
      ({ data: message, error } = await insertMessage(downgradedPayload));
    }

    if (error) {
      incCounter('chat.message.send_failed');
      logger.error('Error sending message', { requestId, roomId, userId, type: resolvedType, durationMs: Date.now() - sendStartMs, error: error.message });
      return res.status(500).json({ error: 'Failed to send message' });
    }

    // Broadcast the new message to all participants in the room via Socket.IO
    // so that both sender and receivers see it in real-time without refreshing.
    // Strip actor_user_id from broadcast — it's internal business data.
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('message:new', serializeChatMessageForViewer(message));
    }

    const sideEffectStamp = new Date().toISOString();
    await Promise.all([
      supabaseAdmin
        .from('ChatRoom')
        .update({ updated_at: sideEffectStamp })
        .eq('id', roomId),
      supabaseAdmin
        .from('ChatParticipant')
        .update({
          unread_count: 0,
          last_read_at: sideEffectStamp
        })
        .eq('room_id', roomId)
        .eq('user_id', userId),
      topicId
        ? supabaseAdmin
            .from('ConversationTopic')
            .update({ last_activity_at: sideEffectStamp })
            .eq('id', topicId)
        : Promise.resolve(),
    ]);

    const sendDurationMs = Date.now() - sendStartMs;
    incCounter('chat.message.sent', { room_type: room?.type || 'unknown' });
    recordHistogram('chat.message.send_latency_ms', sendDurationMs);
    logger.info('message_send_complete', { requestId, roomId, userId, senderUserId, messageId: message.id, durationMs: sendDurationMs });

    // Push fresh badge counts (including total message count) immediately.
    const { data: participantRows } = await supabaseAdmin
      .from('ChatParticipant')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('is_active', true);
    const participantUserIds = Array.from(new Set((participantRows || []).map((row) => String(row.user_id)).filter(Boolean)));
    // Exclude both the acting user and the message identity user.
    const excludedUserIds = new Set([String(userId), String(senderUserId)]);
    const recipientUserIds = participantUserIds.filter((id) => !excludedUserIds.has(id));
    if (recipientUserIds.length > 0) {
      badgeService.emitBadgeUpdateToMany(recipientUserIds);
    }

    // ── Push notification for chat messages ──────────────────────────
    // Send a device push to every recipient (who has push enabled) so
    // they receive a notification when the app is backgrounded or killed.
    if (recipientUserIds.length > 0) {
      (async () => {
        try {
          // Filter to recipients who have push enabled
          const { data: enabledRows } = await supabaseAdmin
            .from('MailPreferences')
            .select('user_id')
            .in('user_id', recipientUserIds)
            .eq('push_notifications', true);
          const pushEnabledIds = (enabledRows || []).map((r) => r.user_id);
          if (pushEnabledIds.length === 0) return;

          const senderName = serializeUserIdentityForViewer(message.sender)?.displayName || 'Someone';
          const preview = resolvedType === 'text'
            ? (resolvedMessage.length > 100 ? resolvedMessage.slice(0, 100) + '…' : resolvedMessage)
            : resolvedType === 'file' ? '📎 Sent an attachment' : '💬 New message';
          await pushService.sendToUsers(pushEnabledIds, {
            title: senderName,
            body: preview,
            data: { type: 'chat_message', room_id: roomId, link: `/chat/${roomId}` },
          });
        } catch (err) {
          logger.warn('Chat push delivery failed (non-blocking)', { error: err.message, roomId });
        }
      })();
    }

    res.status(201).json({ message: serializeChatMessageForViewer(message) });
    
  } catch (err) {
    logger.error('Message send error', { requestId, roomId, userId, durationMs: Date.now() - sendStartMs, error: err.message });
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * PUT /api/chat/messages/:messageId
 * Edit a message
 */
router.put('/messages/:messageId', verifyToken, messageEditLimiter, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    const { messageText } = req.body;
    
    if (!messageText || messageText.trim().length === 0) {
      return res.status(400).json({ error: 'Message text required' });
    }
    
    // Verify ownership
    const { data: message } = await supabaseAdmin
      .from('ChatMessage')
      .select('user_id, room_id')
      .eq('id', messageId)
      .single();

    if (!message || message.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('ChatMessage')
      .update({
        message: messageText,
        edited: true,
        edited_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .select()
      .single();

    if (error) {
      logger.error('Error editing message', { requestId: req.requestId, userId: req.user?.id, messageId, error: error.message });
      return res.status(500).json({ error: 'Failed to edit message' });
    }

    incCounter('chat.message.edited');
    const responseMessage = serializeChatMessageForViewer(updated);

    // Broadcast via socket
    const io = req.app.get('io');
    if (io && message.room_id) {
      io.to(message.room_id).emit('message:edited', { messageId, message: responseMessage });
    }

    res.json({ message: responseMessage });
    
  } catch (err) {
    logger.error('Message edit error', { requestId: req.requestId, userId: req.user?.id, messageId: req.params.messageId, error: err.message });
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

/**
 * DELETE /api/chat/messages/:messageId
 * Delete a message
 */
router.delete('/messages/:messageId', verifyToken, messageDeleteLimiter, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // Prefer explicit soft-delete so message records remain available for audit/disputes.
    // Keep RPC path as fallback for environments that already rely on it.
    const { data: message, error: messageErr } = await supabaseAdmin
      .from('ChatMessage')
      .select('id, user_id, room_id, deleted')
      .eq('id', messageId)
      .single();

    if (messageErr || !message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    if (String(message.user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (message.deleted) {
      return res.json({ message: 'Message deleted successfully' });
    }

    const { error: softDeleteErr } = await supabaseAdmin
      .from('ChatMessage')
      .update({
        deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (softDeleteErr) {
      logger.error('Chat message soft-delete failed', { requestId: req.requestId, userId: req.user?.id, messageId, error: softDeleteErr.message });
      return res.status(500).json({ error: 'Failed to delete message' });
    }

    incCounter('chat.message.deleted');

    // Broadcast via socket
    const io = req.app.get('io');
    if (io && message.room_id) {
      io.to(message.room_id).emit('message:deleted', { messageId });
    }

    res.json({ message: 'Message deleted successfully' });
    
  } catch (err) {
    logger.error('Message delete error', { requestId: req.requestId, userId: req.user?.id, messageId: req.params.messageId, error: err.message });
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

/**
 * POST /api/chat/rooms/:roomId/read
 * Mark messages as read
 */
router.post('/rooms/:roomId/read', verifyToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const roomIdStr = String(roomId || '');
    const userId = req.user.id;
    const asBusinessUserId = req.body?.asBusinessUserId ? String(req.body.asBusinessUserId) : null;
    let readTargetUserId = userId;

    // "new" is a client-side placeholder route, not a persisted room.
    // Treat invalid room IDs as a no-op instead of a server error.
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(roomIdStr)) {
      return res.json({ unreadCount: 0 });
    }

    if (asBusinessUserId) {
      const allowedViaBusiness = await ensureBusinessRoomActorAccess(roomIdStr, userId, asBusinessUserId);
      if (!allowedViaBusiness) return res.status(403).json({ error: 'Access denied' });
      readTargetUserId = asBusinessUserId;
    }
    
    // Update participant's read state directly
    const { data, error } = await supabaseAdmin
      .from('ChatParticipant')
      .update({
        unread_count: 0,
        last_read_at: new Date().toISOString()
      })
      .eq('room_id', roomIdStr)
      .eq('user_id', readTargetUserId)
      .select('unread_count')
      .maybeSingle();
    
    if (error) {
      logger.error('Error marking messages read', { requestId: req.requestId, userId: req.user?.id, roomId: roomIdStr, error: error.message });
      return res.status(500).json({ error: 'Failed to mark messages as read' });
    }

    const badgeTargets = asBusinessUserId
      ? Array.from(new Set([String(readTargetUserId), String(userId)]))
      : [String(readTargetUserId)];
    badgeService.emitBadgeUpdateToMany(badgeTargets);
    res.json({ unreadCount: data?.unread_count ?? 0 });
    
  } catch (err) {
    logger.error('Mark read error', { requestId: req.requestId, userId: req.user?.id, error: err.message });
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// ============ PARTICIPANT ROUTES ============

/**
 * POST /api/chat/rooms/:roomId/participants
 * Add participant to room
 */
router.post('/rooms/:roomId/participants', verifyToken, participantLimiter, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    const { userId: newUserId } = req.body;
    
    if (!newUserId) {
      return res.status(400).json({ error: 'userId required' });
    }
    
    // Verify user is owner/admin
    const { data: participant } = await supabaseAdmin
      .from('ChatParticipant')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single();
    
    if (!participant || !['owner', 'admin'].includes(participant.role)) {
      return res.status(403).json({ error: 'Not authorized to add participants' });
    }
    
    // Add new participant
    const { data: newParticipant, error } = await supabaseAdmin
      .from('ChatParticipant')
      .insert({
        room_id: roomId,
        user_id: newUserId,
        role: 'member'
      })
      .select(`
        *,
        user:user_id(
          id,
          username,
          name,
          profile_picture_url
        )
      `)
      .single();
    
    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({ error: 'User is already a participant' });
      }
      logger.error('Error adding participant', { requestId: req.requestId, userId: req.user?.id, roomId, error: error.message });
      return res.status(500).json({ error: 'Failed to add participant' });
    }
    
    // Create system message
    await supabaseAdmin
      .from('ChatMessage')
      .insert({
        room_id: roomId,
        user_id: userId,
        message: `added ${newParticipant.user.name || newParticipant.user.username}`,
        type: 'system'
      });
    
    res.status(201).json({ participant: serializeChatParticipantForViewer(newParticipant) });
    
  } catch (err) {
    logger.error('Add participant error', { requestId: req.requestId, userId: req.user?.id, roomId: req.params.roomId, error: err.message });
    res.status(500).json({ error: 'Failed to add participant' });
  }
});

/**
 * DELETE /api/chat/rooms/:roomId/participants/:participantUserId
 * Remove participant from room
 */
router.delete('/rooms/:roomId/participants/:participantUserId', verifyToken, participantLimiter, async (req, res) => {
  try {
    const { roomId, participantUserId } = req.params;
    const userId = req.user.id;
    
    // Check if removing self or if user is admin/owner
    const isSelf = userId === participantUserId;
    
    if (!isSelf) {
      const { data: participant } = await supabaseAdmin
        .from('ChatParticipant')
        .select('role')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .single();
      
      if (!participant || !['owner', 'admin'].includes(participant.role)) {
        return res.status(403).json({ error: 'Not authorized to remove participants' });
      }
    }
    
    // Mark participant as inactive
    const { error } = await supabaseAdmin
      .from('ChatParticipant')
      .update({
        is_active: false,
        left_at: new Date().toISOString()
      })
      .eq('room_id', roomId)
      .eq('user_id', participantUserId);
    
    if (error) {
      logger.error('Error removing participant', { requestId: req.requestId, userId: req.user?.id, roomId, error: error.message });
      return res.status(500).json({ error: 'Failed to remove participant' });
    }
    
    // Create system message
    await supabaseAdmin
      .from('ChatMessage')
      .insert({
        room_id: roomId,
        user_id: userId,
        message: isSelf ? 'left the chat' : `removed a participant`,
        type: 'system'
      });
    
    res.json({ message: 'Participant removed successfully' });
    
  } catch (err) {
    logger.error('Remove participant error', { requestId: req.requestId, userId: req.user?.id, roomId: req.params.roomId, error: err.message });
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

// ============ STATS & SEARCH ============

/**
 * GET /api/chat/stats
 * Get user's chat statistics
 */
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Lightweight query: sum unread_count from all rooms the user participates in
    const { data: participants, error } = await supabaseAdmin
      .from('ChatParticipant')
      .select('room_id, unread_count, room:room_id(type)')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      logger.error('Error fetching chat stats', { requestId: req.requestId, userId, error: error.message });
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }

    const rows = participants || [];
    const roomIds = rows.map((p) => String(p.room_id)).filter(Boolean);
    let totalUnread = 0;
    let directChats = 0;
    let gigChats = 0;
    let homeChats = 0;

    for (const p of rows) {
      totalUnread += (p.unread_count || 0);
      const roomType = p.room?.type;
      if (roomType === 'direct') directChats++;
      else if (roomType === 'gig') gigChats++;
      else if (roomType === 'home') homeChats++;
    }
    let totalMessages = 0;
    if (roomIds.length > 0) {
      let { count: totalCount, error: countErr } = await supabaseAdmin
        .from('ChatMessage')
        .select('id', { count: 'exact', head: true })
        .in('room_id', roomIds)
        .eq('deleted', false);
      if (countErr && /deleted/i.test(String(countErr.message || ''))) {
        ({ count: totalCount, error: countErr } = await supabaseAdmin
          .from('ChatMessage')
          .select('id', { count: 'exact', head: true })
          .in('room_id', roomIds));
      }
      if (!countErr) totalMessages = Number(totalCount || 0);
    }

    res.json({
      stats: {
        total_chats: rows.length,
        total_messages: totalMessages,
        total_unread: totalUnread,
        direct_chats: directChats,
        gig_chats: gigChats,
        home_chats: homeChats,
      }
    });

  } catch (err) {
    logger.error('Chat stats error', { requestId: req.requestId, userId: req.user?.id, error: err.message });
    res.status(500).json({ error: 'Failed to fetch chat stats' });
  }
});

// ============ UNIFIED CONVERSATIONS (Person-Grouped) ============

/**
 * GET /api/chat/unified-conversations
 * Person-grouped chat list. Returns one entry per unique other-person,
 * aggregating unread counts and last message across all shared rooms.
 * Also returns group/home rooms separately.
 */
router.get('/unified-conversations', verifyToken, async (req, res) => {
  const ucStartMs = Date.now();
  try {
    const userId = req.user.id;
    const { limit = 100 } = req.query;
    const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);

    // Step 1: Get all rooms the user participates in (active only)
    const { data: myParticipants, error: partErr } = await supabaseAdmin
      .from('ChatParticipant')
      .select(`
        room_id,
        unread_count,
        last_read_at,
        role,
        is_active,
        room:room_id(id, type, name, description, gig_id, home_id, is_active, created_at, updated_at)
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (partErr) {
      logger.error('Error fetching unified conversations', { requestId: req.requestId, userId, error: partErr.message });
      return res.status(500).json({ error: 'Failed to fetch conversations' });
    }

    const roomList = (myParticipants || []).filter(p => p.room);

    // Separate group/home rooms (not mergeable) from direct/gig rooms (mergeable by person)
    const mergeableParticipants = roomList.filter(p => p.room.type === 'direct' || p.room.type === 'gig');
    const groupHomeParticipants = roomList.filter(p => p.room.type === 'group' || p.room.type === 'home');

    // Step 2: For mergeable rooms, find other participants
    const mergeableRoomIds = mergeableParticipants.map(p => p.room_id);
    let allOtherParticipants = [];
    if (mergeableRoomIds.length > 0) {
      const { data: otherParts } = await supabaseAdmin
        .from('ChatParticipant')
        .select(`
          room_id,
          user_id,
          user:user_id(id, username, name, first_name, middle_name, last_name, profile_picture_url)
        `)
        .in('room_id', mergeableRoomIds)
        .neq('user_id', userId)
        .eq('is_active', true);
      allOtherParticipants = otherParts || [];
    }
    const identityByUserId = await loadLocalIdentityMapForUsers(
      allOtherParticipants.map((participant) => participant.user)
    );

    // Step 3: Group rooms by other_participant_id
    const conversationMap = new Map();

    for (const p of mergeableParticipants) {
      const roomId = p.room_id;
      const otherP = allOtherParticipants.find(op => op.room_id === roomId);
      if (!otherP || !otherP.user) continue;

      const otherId = otherP.user.id;
      if (!conversationMap.has(otherId)) {
        const u = otherP.user;
        const otherIdentity = identityByUserId.get(String(otherId)) || serializeUserAsLocalIdentity(u);
        conversationMap.set(otherId, {
          other_participant_id: otherId,
          other_participant_name: otherIdentity?.displayName || null,
          other_participant_username: otherIdentity?.handle || null,
          other_participant_avatar: otherIdentity?.avatarUrl || null,
          other_participant_identity: otherIdentity,
          room_ids: [],
          total_unread: 0,
          last_message_at: null,
          last_message_preview: null,
          topics: [],
          _type: 'conversation',
        });
      }
      const conv = conversationMap.get(otherId);
      conv.room_ids.push(roomId);
      conv.total_unread += (p.unread_count || 0);
    }

    // Step 4-5: Batch-fetch messages and topics (3 queries instead of 2N+M sequential)
    const allConvRoomIds = [];
    for (const [, conv] of conversationMap) allConvRoomIds.push(...conv.room_ids);
    const groupRoomIds = groupHomeParticipants.map(p => p.room_id);
    const allMergedRoomIds = [...allConvRoomIds, ...groupRoomIds];

    const [{ data: allConvMsgs }, { data: allTopics }] = await Promise.all([
      allMergedRoomIds.length > 0
        ? supabaseAdmin.rpc('get_room_previews', { p_room_ids: allMergedRoomIds })
        : Promise.resolve({ data: [] }),
      supabaseAdmin
        .from('ConversationTopic')
        .select('id, topic_type, topic_ref_id, title, status, last_activity_at, conversation_user_id_1, conversation_user_id_2')
        .or(`conversation_user_id_1.eq.${userId},conversation_user_id_2.eq.${userId}`)
        .eq('status', 'active')
        .order('last_activity_at', { ascending: false }),
    ]);

    // Index previews by room_id (RPC returns exactly one row per room)
    const convMsgByRoom = await resolveRoomPreviewMap(allConvMsgs, req.requestId, 'unified_conversations');
    // Build lookup: other_user_id -> topics
    const topicsByOther = {};
    for (const t of allTopics || []) {
      const otherId = t.conversation_user_id_1 === userId ? t.conversation_user_id_2 : t.conversation_user_id_1;
      if (!topicsByOther[otherId]) topicsByOther[otherId] = [];
      topicsByOther[otherId].push(t);
    }

    const conversations = [];
    for (const [otherId, conv] of conversationMap) {
      // Find most recent message across this conversation's rooms
      let bestMsg = null;
      for (const rid of conv.room_ids) {
        const msg = convMsgByRoom[rid];
        if (msg && (!bestMsg || msg.created_at > bestMsg.created_at)) bestMsg = msg;
      }
      if (bestMsg) {
        conv.last_message_preview = getVisibleMessagePreview(bestMsg);
        conv.last_message_at = bestMsg.created_at;
      }

      conv.topics = (topicsByOther[otherId] || []).slice(0, 5);
      conversations.push(conv);
    }

    // Step 5: Process group/home rooms using batch-fetched messages
    for (const p of groupHomeParticipants) {
      const roomId = p.room_id;
      const lastMsg = convMsgByRoom[roomId] || null;
      let lastMessagePreview = null;
      let lastMessageAt = null;
      if (lastMsg) {
        lastMessagePreview = getVisibleMessagePreview(lastMsg);
        lastMessageAt = lastMsg.created_at;
      }

      conversations.push({
        id: roomId,
        room_type: p.room.type,
        room_name: p.room.name,
        description: p.room.description,
        gig_id: p.room.gig_id,
        home_id: p.room.home_id,
        total_unread: p.unread_count || 0,
        last_message_at: lastMessageAt || p.room.updated_at,
        last_message_preview: lastMessagePreview,
        topics: [],
        _type: 'room',
      });
    }

    // Sort by last activity
    conversations.sort((a, b) => {
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return tb - ta;
    });

    const visibleConversations = conversations.slice(0, lim);
    const visibleRoomIds = [];
    for (const conv of visibleConversations) {
      if (conv._type === 'room') {
        visibleRoomIds.push(String(conv.id));
      } else {
        visibleRoomIds.push(...(conv.room_ids || []).map((id) => String(id)));
      }
    }
    // Per-room message counts removed — the N+1 countMessagesByRoom queries
    // scaled poorly (one SELECT count(*) per room). The total_message_count
    // field is omitted; frontends already guard with (conv.total_message_count || 0).

    recordHistogram('chat.unified_conversations.load_latency_ms', Date.now() - ucStartMs);
    res.json({
      conversations: visibleConversations,
      total: conversations.length,
      totalUnread: conversations.reduce((sum, c) => sum + (c.total_unread || 0), 0),
    });
  } catch (err) {
    logger.error('Unified conversations list error', { requestId: req.requestId, userId: req.user?.id, error: err.message });
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * POST /api/chat/conversations/:otherUserId/topics
 * Find or create a topic for a person pair.
 */
router.post('/conversations/:otherUserId/topics', verifyToken, validate(createTopicSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { otherUserId } = req.params;
    const { topicType, topicRefId, title } = req.body;

    if (String(userId) === String(otherUserId)) {
      return res.status(400).json({ error: 'Cannot create topic with yourself' });
    }

    const uid1 = userId < otherUserId ? userId : otherUserId;
    const uid2 = userId < otherUserId ? otherUserId : userId;

    // Try to find existing topic
    let query = supabaseAdmin
      .from('ConversationTopic')
      .select('*')
      .eq('conversation_user_id_1', uid1)
      .eq('conversation_user_id_2', uid2)
      .eq('topic_type', topicType);

    if (topicRefId) {
      query = query.eq('topic_ref_id', topicRefId);
    } else {
      query = query.is('topic_ref_id', null);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing) {
      // Update last_activity_at
      await supabaseAdmin
        .from('ConversationTopic')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', existing.id);
      return res.json({ topic: existing, created: false });
    }

    // Create new topic
    const { data: topic, error } = await supabaseAdmin
      .from('ConversationTopic')
      .insert({
        conversation_user_id_1: uid1,
        conversation_user_id_2: uid2,
        topic_type: topicType,
        topic_ref_id: topicRefId || null,
        title,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating conversation topic', { requestId: req.requestId, userId, otherUserId, error: error.message });
      return res.status(500).json({ error: 'Failed to create topic' });
    }

    res.status(201).json({ topic, created: true });
  } catch (err) {
    logger.error('Create topic error', { requestId: req.requestId, userId: req.user?.id, error: err.message });
    res.status(500).json({ error: 'Failed to create topic' });
  }
});

/**
 * GET /api/chat/conversations/:otherUserId/topics
 * List topics for a person pair.
 */
router.get('/conversations/:otherUserId/topics', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { otherUserId } = req.params;

    const uid1 = userId < otherUserId ? userId : otherUserId;
    const uid2 = userId < otherUserId ? otherUserId : userId;

    const { data: topics, error } = await supabaseAdmin
      .from('ConversationTopic')
      .select('*')
      .eq('conversation_user_id_1', uid1)
      .eq('conversation_user_id_2', uid2)
      .order('last_activity_at', { ascending: false });

    if (error) {
      logger.error('Error fetching conversation topics', { requestId: req.requestId, userId, otherUserId, error: error.message });
      return res.status(500).json({ error: 'Failed to fetch topics' });
    }

    res.json({ topics: topics || [] });
  } catch (err) {
    logger.error('Fetch topics error', { requestId: req.requestId, userId: req.user?.id, error: err.message });
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// ============ REACTION HELPERS ============

/**
 * Build a reaction summary array for the given message IDs.
 * Returns a Map<messageId, ReactionSummary[]> where each entry is:
 *   { reaction, count, users: [{ id, name, username, identity }], reacted_by_me }
 */
async function buildReactionSummary(messageIds, requestingUserId) {
  if (!messageIds || messageIds.length === 0) return new Map();

  const { data: reactions, error } = await supabaseAdmin
    .from('MessageReaction')
    .select('message_id, reaction, user_id')
    .in('message_id', messageIds);

  if (error || !reactions || reactions.length === 0) return new Map();

  // Collect unique user IDs
  const userIds = [...new Set(reactions.map((r) => r.user_id))];
  const { data: users } = await supabaseAdmin
    .from('User')
    .select('id, username, name, first_name, middle_name, last_name, profile_picture_url, account_type')
    .in('id', userIds);

  const userMap = {};
  (users || []).forEach((u) => { userMap[u.id] = u; });

  // Group: messageId -> reaction -> [user_id, ...]
  const grouped = {};
  for (const r of reactions) {
    if (!grouped[r.message_id]) grouped[r.message_id] = {};
    if (!grouped[r.message_id][r.reaction]) grouped[r.message_id][r.reaction] = [];
    grouped[r.message_id][r.reaction].push(r.user_id);
  }

  const result = new Map();
  for (const [msgId, reactionMap] of Object.entries(grouped)) {
    const summary = Object.entries(reactionMap).map(([reaction, uids]) => ({
      reaction,
      count: uids.length,
      users: uids.map((uid) => {
        const identity = serializeUserAsLocalIdentity(userMap[uid]);
        return {
          id: identity?.id || uid,
          name: identity?.displayName || 'Unknown',
          username: identity?.handle || null,
          identity,
        };
      }),
      reacted_by_me: uids.includes(requestingUserId),
    }));
    result.set(msgId, summary);
  }
  return result;
}

// ============ REACTION ENDPOINTS ============

/**
 * POST /api/chat/messages/:messageId/react
 * Toggle a reaction on a message (add if absent, remove if present).
 */
router.post('/messages/:messageId/react', verifyToken, reactionLimiter, validate(reactToMessageSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const { reaction } = req.body;

    // Verify message exists and is not deleted
    const { data: message, error: msgErr } = await supabaseAdmin
      .from('ChatMessage')
      .select('id, room_id')
      .eq('id', messageId)
      .eq('deleted', false)
      .maybeSingle();

    if (msgErr || !message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Verify user is an active participant of the room
    const { data: participant } = await supabaseAdmin
      .from('ChatParticipant')
      .select('id')
      .eq('room_id', message.room_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (!participant) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Toggle: check if reaction already exists
    const { data: existing } = await supabaseAdmin
      .from('MessageReaction')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('reaction', reaction)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from('MessageReaction')
        .delete()
        .eq('id', existing.id);
    } else {
      await supabaseAdmin
        .from('MessageReaction')
        .insert({ message_id: messageId, user_id: userId, reaction });
    }

    incCounter('chat.reaction.toggled');

    // Build updated reaction summary
    const summaryMap = await buildReactionSummary([messageId], userId);
    const reactions = summaryMap.get(messageId) || [];

    // Broadcast via socket
    const io = req.app.get('io');
    if (io) {
      io.to(message.room_id).emit('message:reaction_updated', { messageId, reactions });
    }

    res.json({ reactions });
  } catch (err) {
    logger.error('React to message error', { requestId: req.requestId, userId: req.user?.id, messageId: req.params.messageId, error: err.message });
    res.status(500).json({ error: 'Failed to toggle reaction' });
  }
});

/**
 * GET /api/chat/messages/:messageId/reactions
 * Get all reactions for a message.
 */
router.get('/messages/:messageId/reactions', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;

    // Verify message exists and is not deleted
    const { data: message, error: msgErr } = await supabaseAdmin
      .from('ChatMessage')
      .select('id, room_id')
      .eq('id', messageId)
      .eq('deleted', false)
      .maybeSingle();

    if (msgErr || !message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Verify user is an active participant of the room
    const { data: participant } = await supabaseAdmin
      .from('ChatParticipant')
      .select('id')
      .eq('room_id', message.room_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (!participant) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const summaryMap = await buildReactionSummary([messageId], userId);
    const reactions = summaryMap.get(messageId) || [];

    res.json({ reactions });
  } catch (err) {
    logger.error('Get reactions error', { requestId: req.requestId, userId: req.user?.id, messageId: req.params.messageId, error: err.message });
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
});

// ============================================================
// Authenticated chat file download — generates short-lived signed URL
// ============================================================

// Allow auth token via query param for contexts where headers can't be set
// (e.g. React Native <Image source={{ uri }}> or <a href> downloads).
function tokenFromQuery(req, _res, next) {
  if (!req.headers.authorization && !req.cookies?.pantopus_access && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}

router.get('/files/:fileId', tokenFromQuery, verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { fileId } = req.params;

    // Look up the file record
    const { data: file, error: fileErr } = await supabaseAdmin
      .from('File')
      .select('id, file_path, file_url, mime_type, metadata, is_deleted, file_type, access_count')
      .eq('id', fileId)
      .maybeSingle();

    if (fileErr || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.is_deleted) {
      return res.status(410).json({ error: 'File has been deleted' });
    }

    // Determine room_id from file metadata
    const roomId = file.metadata?.room_id;
    if (!roomId) {
      return res.status(403).json({ error: 'File is not associated with a chat room' });
    }

    // Verify the requesting user is an active participant in the room
    const { data: participant } = await supabaseAdmin
      .from('ChatParticipant')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (!participant) {
      return res.status(403).json({ error: 'Not authorized to access this file' });
    }

    // Generate a 15-minute signed URL and redirect
    const signedUrl = await s3Service.getPresignedDownloadUrl(file.file_path, 900);

    // Update access tracking (fire-and-forget)
    supabaseAdmin
      .from('File')
      .update({ access_count: (file.access_count || 0) + 1, last_accessed_at: new Date().toISOString() })
      .eq('id', fileId)
      .then(() => {})
      .catch(() => {});

    res.redirect(302, signedUrl);
  } catch (err) {
    logger.error('Chat file download error', { requestId: req.requestId, userId: req.user?.id, fileId: req.params.fileId, error: err.message });
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

// ============ CHAT METRICS ENDPOINT ============

/**
 * GET /api/chat/metrics
 * Returns in-memory chat metrics snapshot (counters, histograms, gauges).
 */
router.get('/metrics', verifyToken, (_req, res) => {
  res.json(getSnapshot());
});

module.exports = router;
