// ============================================================
// CHAT REST API ROUTES
// HTTP endpoints for chat management (complement to Socket.IO)
// ============================================================

const express = require('express');
const router = express.Router();
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
const { verifiedResidentUserIds } = require('../utils/identityProfiles');
const { isUnpublishedBusiness } = require('../utils/visibilityPolicy');
const {
  chatAccessUnavailable,
  UNPUBLISHED_BUSINESS_REFUSAL,
  unpublishedDirectRoomRefusal,
  isBusinessAccount,
  canActAsBusiness,
  businessStaff,
  businessMembership,
  actingBusinessInRoom,
  taskBusinessInRoom,
  dropStaffMembership,
} = require('../services/chatBusinessAccess');
const s3Service = require('../services/s3Service');
const { isBlocked, blockCheckUnavailable } = require('../services/blockService');
const {
  getGigOwnerMessagingContext,
  closedGigRoomIds,
  closedGigRoomIdsByRoomId,
  isGigRoomClosedTo,
  hiddenGigRoomMembers,
  gigRoomRecipients,
  isRoomClosedForWrites,
} = require('../services/chatGigRoomAccess');
const { loadChatPeople, chatPersonRow } = require('../services/chatPeople');
const { markChatRead, applyDirectReadReceipts, timestampMicros } = require('../services/chatReadState');
const { parseSyncCursor, chatSyncSnapshot, chatChanges, chatReadReceipts, readChatRoomBatches, readChatParticipants, buildReactionSummary } = require('../services/chatSync');
const chatRealtime = require('../services/chatRealtime');
const { incCounter, recordHistogram, getSnapshot } = require('../services/chatMetrics');
const pushService = require('../services/pushService');
const notificationService = require('../services/notificationService');
const rateLimit = require('express-rate-limit');
const { pipeline } = require('stream/promises');
const { chosenUsernameOrNull } = require('../utils/personalUsername');
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
].join(', ');

async function loadLocalIdentityMapForUsers(users, { requireProfiles = false } = {}) {
  const userRows = (users || []).filter(Boolean);
  const usersById = new Map();
  for (const user of userRows) {
    if (user?.id) usersById.set(String(user.id), user);
  }
  if (usersById.size === 0) return new Map();

  // The profiles and the verified-resident check are read together.
  const [{ data: profiles, error }, residents] = await Promise.all([
    supabaseAdmin
      .from('LocalProfile')
      .select(LOCAL_PROFILE_IDENTITY_SELECT)
      .in('user_id', [...usersById.keys()]),
    verifiedResidentUserIds([...usersById.keys()]),
  ]);

  if (error) {
    if (requireProfiles) throw error;
    logger.warn('chat.local_profile_identity_lookup_error', { error: error.message });
  }

  const profilesByUserId = new Map();
  for (const profile of profiles || []) {
    if (profile?.user_id) profilesByUserId.set(String(profile.user_id), profile);
  }

  const identitiesByUserId = new Map();
  for (const [userId, user] of usersById) {
    const profile = profilesByUserId.get(userId);
    const verified_resident = residents.has(userId);
    identitiesByUserId.set(
      userId,
      profile
        ? serializeLocalProfileForViewer({ ...profile, user, verified_resident })
        : serializeUserAsLocalIdentity({ ...user, verified_resident })
    );
  }
  return identitiesByUserId;
}

// Search uses the exact public identity shown in the inbox. Candidate IDs can
// include a private account-name match, which is discarded when the public
// alias differs. No candidate names are returned before this check.
async function matchingInboxPeople(userId, query) {
  const matching = [];
  const needle = query.toLowerCase();
  let after = null;
  for (;;) {
    const { data: candidates, error } = await supabaseAdmin.rpc('get_chat_inbox_search_candidates', {
      p_user_id: userId, p_query: query, p_after: after,
    });
    if (error || !Array.isArray(candidates)) throw error || new Error('Inbox search unavailable');
    if (!candidates.length) break;
    const { data: users, error: usersError } = await supabaseAdmin.from('User')
      .select('id, username, name, first_name, middle_name, last_name, profile_picture_url')
      .in('id', candidates.map((candidate) => candidate.user_id));
    if (usersError || !Array.isArray(users)) throw usersError || new Error('Inbox identity unavailable');
    const identities = await loadLocalIdentityMapForUsers(users, { requireProfiles: true });
    for (const [id, identity] of identities) {
      if ([identity.displayName, identity.handle, identity.handle && `@${identity.handle}`]
        .some((value) => value && value.toLowerCase().includes(needle))) matching.push(id);
    }
    if (candidates.length < 200) break;
    after = candidates.at(-1).user_id;
  }
  return matching;
}

// ============ CHAT RATE LIMITERS ============
// Keyed by authenticated user ID (not IP) since all routes require auth.

function chatRateLimiter(windowMs, max, label) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => req.user?.id || req.ip,
    handler: (req, res) => {
      const retryAfter = Math.max(1, Math.ceil(((req.rateLimit?.resetTime?.getTime() || Date.now() + windowMs) - Date.now()) / 1000));
      res.set('Retry-After', String(retryAfter));
      res.status(429).json({ error: 'Rate limit exceeded', code: 'CHAT_RATE_LIMITED', scope: label, retryAfter });
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

const messageSendLimiter = chatRateLimiter(60_000, 120, 'message-send');
const messageBurstLimiter = chatRateLimiter(5_000, 12, 'message-burst');
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

const chatPreferencesSchema = Joi.object({
  notificationsEnabled: Joi.boolean().strict().required(),
  asBusinessUserId: Joi.string().uuid().optional(),
});

async function mutedBySender(recipientIds, senderUserId) {
  if (!recipientIds.length) return new Set();
  const { data, error } = await supabaseAdmin.from('UserNotificationPreferences')
    .select('user_id').in('user_id', recipientIds).contains('chat_muted_user_ids', [senderUserId]);
  if (error) throw error;
  return new Set((data || []).map((row) => String(row.user_id)));
}

// Chat photos and files load through this API's own /api/chat/files/:id proxy, which the
// upload returns as a relative path. iOS and Android builds before October 9 add the viewer's
// access token to any URL whose path has that segment, whatever its host, and message
// metadata comes from the sender: so metadata may carry that segment only as the relative
// proxy path, never as a link to another host (checked raw and once-decoded, as clients read paths).
const CHAT_FILE_SEGMENT = '/api/chat/files/';
const CHAT_FILE_PROXY_PATH = /^\/api\/chat\/files\/[A-Za-z0-9_-]+(?:[?#][^\s]*)?$/;
function hasForeignChatFileLink(value, depth = 0) {
  if (value == null || depth > 8) return false;
  if (typeof value === 'string') {
    let decoded = value;
    try { decoded = decodeURIComponent(value); } catch (_) { /* keep raw */ }
    const mentions = value.includes(CHAT_FILE_SEGMENT) || decoded.includes(CHAT_FILE_SEGMENT);
    return mentions && !CHAT_FILE_PROXY_PATH.test(value);
  }
  if (Array.isArray(value)) return value.some((item) => hasForeignChatFileLink(item, depth + 1));
  if (typeof value === 'object') return Object.values(value).some((item) => hasForeignChatFileLink(item, depth + 1));
  return false;
}

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
  // The state the person asked for, so a retry keeps it. Without it (older apps) the route toggles.
  reacted: Joi.boolean(),
});

// The business identity an actor may act as here, or none (their own id always counts).
async function verifiedBusinessIdentity(asBusinessUserId, actorUserId) {
  if (!asBusinessUserId) return [];
  return (await canActAsBusiness(asBusinessUserId, actorUserId)) ? [String(asBusinessUserId)] : [];
}

// Whether an assigned task's gig room is closed to this actor (services/chatGigRoomAccess).
async function gigRoomClosed(roomId, actorUserId, asBusinessUserId) {
  return isGigRoomClosedTo(roomId, actorUserId, await verifiedBusinessIdentity(asBusinessUserId, actorUserId));
}

// Whether an actor may edit or delete a message, and the identities they act through: [] for a message their own
// account sent, [business] for one they wrote for a business while they may still act for it in that room. Nobody
// changes a message someone else wrote, a teammate's for the same business included. Null when they may not.
async function messageWriterIdentities(message, actorUserId) {
  if (!message) return null;
  if (String(message.user_id) === String(actorUserId)) return [];
  if (!message.actor_user_id || String(message.actor_user_id) !== String(actorUserId)) return null;
  return (await businessMembership(message.room_id, actorUserId, message.user_id)) ? [String(message.user_id)] : null;
}

// The refusal for writing as senderUserId in a direct room with a draft or closed business, else null.
async function unpublishedRoomRefusal(roomId, senderUserId) {
  const [{ data: room, error: roomError }, { data: members, error: membersError }] = await Promise.all([
    supabaseAdmin.from('ChatRoom').select('type').eq('id', roomId).maybeSingle(),
    supabaseAdmin.from('ChatParticipant').select('user_id').eq('room_id', roomId).eq('is_active', true),
  ]);
  if (roomError || membersError || !Array.isArray(members)) {
    throw new Error(roomError?.message || membersError?.message || 'chat room unavailable');
  }
  if (room?.type !== 'direct') return null;
  return unpublishedDirectRoomRefusal(senderUserId, members.map((member) => member.user_id));
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

// The membership a request reads or writes the room through. Acting for a business, it is the business's own: its
// owner and staff are never members of its conversations (services/chatBusinessAccess). They act for it when the
// request says so (`asBusinessUserId`), and in the chat room of a task it posted, where they always answer as the
// business. Otherwise it is the caller's own row; `activeOnly` refuses one they left.
// A started read, kept from rejecting unobserved while the checks before it decide; `settled` rethrows its error.
function settle(promise) {
  return Promise.resolve(promise).then((value) => ({ value }), (error) => ({ error }));
}
function settled({ value, error }) {
  if (error) throw error;
  return value;
}

// A retried send is bound to the authorized room, displayed sender and human actor. client_message_id
// is globally unique, so a conflicting key from another scope must never return that scope's private message.
async function retryMessage(clientMessageId, roomId, senderUserId, actorUserId) {
  let query = supabaseAdmin.from('ChatMessage')
    .select(`*, sender:user_id(id, username, name, profile_picture_url)`)
    .eq('client_message_id', clientMessageId)
    .eq('room_id', roomId)
    .eq('user_id', senderUserId);
  query = String(senderUserId) === String(actorUserId)
    ? query.is('actor_user_id', null)
    : query.eq('actor_user_id', actorUserId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function roomMembership(roomId, userId, asBusinessUserId, { activeOnly = false } = {}) {
  const named = asBusinessUserId && String(asBusinessUserId) !== String(userId);
  // The caller's own row and, when no business is named, the task's business don't depend on each other.
  const taskBusinessRead = named ? null : settle(taskBusinessInRoom(roomId, userId));
  const { data: own, error } = await supabaseAdmin
    .from('ChatParticipant')
    .select('*')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw chatAccessUnavailable();
  const businessUserId = named ? asBusinessUserId : settled(await taskBusinessRead);
  if (businessUserId) {
    const business = await businessMembership(roomId, userId, businessUserId);
    if (business) {
      if (own) await dropStaffMembership(roomId, userId, businessUserId);
      return business;
    }
  }
  if (!own || (activeOnly && own.is_active === false)) return null;
  return own;
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

// ── message:new ──────────────────────────────────────────────────────
// Each active member hears a new message on all their devices, with what their
// conversation list needs to update the row in place (Instant Screens contract
// §8): `other_user_id` for a person-to-person chat (direct and task rooms, which
// the lists merge into one row per person), `preview`, and `unread_for` where
// the server knows that row's unread count exactly. A recipient's person row
// just gains one; the sender's own devices never count their message, and when
// their row isn't certain `other_user_id` stays out so the list reloads. Nobody
// outside the room's active members hears it.

// The sender's unread count on their row for `otherUserId`: every open direct and
// task room the two share, including earlier unseen incoming messages in the
// room just written to. Sending does not mark that room read.
async function personRowUnread(userId, otherUserId) {
  const roomIds = await personChatRoomIds(userId, otherUserId);
  let unread = 0;
  for (let offset = 0; offset < roomIds.length; offset += 200) {
    const { data, error } = await supabaseAdmin.from('ChatParticipant')
      .select('unread_count').eq('user_id', userId).eq('is_active', true)
      .in('room_id', roomIds.slice(offset, offset + 200));
    if (error) throw chatAccessUnavailable();
    unread += (data || []).reduce((sum, row) => sum + (Number(row.unread_count) || 0), 0);
  }
  return unread;
}

// The owner and staff of a business in the room aren't members themselves, so their open business inbox hears its
// messages here, on their own devices. Without other_user_id: a personal Messages list that gets one reloads instead
// of filing it under a person.
async function emitToBusinessStaff(emitTo, payload, businessIds, heard) {
  if (businessIds.length === 0) return;
  const { connectedUsers } = require('../socket/chatSocketio');
  const staff = await businessStaff(businessIds, {
    include: (staffId) => !heard.has(staffId) && connectedUsers.has(staffId),
  });
  for (const { userId: staffId } of staff) {
    if (heard.has(staffId)) continue;
    heard.add(staffId);
    emitTo(staffId, payload);
  }
}

// ── Business inbox notices ───────────────────────────────────────────
// The chat push goes to room members, so it doesn't reach a business's owner and staff either. Each one who may act
// for a business that received a message gets a notice (bell row, and a push unless their push is off) that opens the
// business's thread: the web's /app/businesses/:id/chat/:roomId, which the apps open as the business, then its
// thread. Never their personal Messages. Each message has an idempotent notice; reading the conversation for the
// business reads its notices. Room members already got the chat push; anyone across a block
// with the sender gets nothing.
const BUSINESS_MESSAGE_NOTICE = 'business_message';

function businessThreadLink(businessUserId, roomId) {
  return `/app/businesses/${businessUserId}/chat/${roomId}`;
}

async function notifyBusinessStaff({ room, messageId, businessIds, actorUserId, senderUserId, memberIds, mutedBusinessIds, preview }) {
  const skip = new Set([String(actorUserId), String(senderUserId), ...memberIds.map(String)]);
  const staff = await businessStaff(businessIds, { include: (staffId) => !skip.has(staffId) });
  if (staff.length === 0) return;
  const [{ data: businesses, error: businessError }, { data: sender, error: senderError }] = await Promise.all([
    supabaseAdmin.from('User').select('id, name, username').in('id', businessIds),
    supabaseAdmin
      .from('User')
      .select('id, username, name, first_name, middle_name, last_name')
      .eq('id', senderUserId)
      .maybeSingle(),
  ]);
  if (businessError || senderError) throw new Error((businessError || senderError).message);
  const businessNames = new Map((businesses || []).map((b) => [String(b.id), b.name || b.username || 'your business']));
  // The sender as the business inbox lists them.
  const senderIdentity = sender ? (await loadLocalIdentityMapForUsers([sender])).get(String(sender.id)) : null;
  const senderName = senderIdentity?.displayName || 'Someone';
  for (const { businessUserId, userId: staffId } of staff) {
    try {
      if (await isBlocked(staffId, senderUserId)) continue;
    } catch {
      continue;
    }
    const link = businessThreadLink(businessUserId, room.id);
    await notificationService.createNotification({
      userId: staffId,
      type: BUSINESS_MESSAGE_NOTICE,
      title: `New message for ${businessNames.get(businessUserId) || 'your business'}`,
      body: `${senderName}: ${preview}`,
      icon: '💬',
      link,
      // user_id is the sender: lists and counts leave the notice out across a later block.
      metadata: { business_user_id: businessUserId, room_id: String(room.id), user_id: String(senderUserId), message_id: messageId },
      contextType: 'business',
      contextId: businessUserId,
      idempotencyKey: `business-message:${messageId}:${businessUserId}:${staffId}`,
      sendPush: !mutedBusinessIds.has(businessUserId),
    });
  }
}

// Reading a business's conversation reads the reader's own notices about it.
async function readBusinessNotices(userId, businessUserId, roomIds) {
  if (!businessUserId || String(businessUserId) === String(userId) || roomIds.length === 0) return;
  try {
    const { data: read, error } = await supabaseAdmin
      .from('Notification')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('type', BUSINESS_MESSAGE_NOTICE)
      .in('link', roomIds.map((roomId) => businessThreadLink(businessUserId, roomId)))
      .eq('is_read', false)
      .select('id');
    if (error) throw error;
    if (read?.length) badgeService.emitBadgeUpdate(userId);
  } catch (err) {
    // The conversation is read either way; the notice stays unread in the bell.
    logger.warn('business_message_notice_read_failed', { userId, error: err.message });
  }
}

async function emitNewMessage(io, { room, message, actorUserId, identityUserId }) {
  const { connectedUsers } = require('../socket/chatSocketio');
  const members = await readChatParticipants([room.id], 'user_id, unread_count, user:user_id(account_type)');
  const actor = String(actorUserId);
  const identity = String(identityUserId);
  const others = members.filter((row) => ![actor, identity].includes(String(row.user_id)));
  // Leftover members of an assigned task's room hear nothing, as with its pushes and badges.
  const eligible = new Set(await gigRoomRecipients(room, members.map((row) => String(row.user_id))));
  const recipients = new Set(others.map((row) => String(row.user_id)).filter((id) => eligible.has(id)));
  const personChat = room.type === 'direct' || room.type === 'gig';
  const base = { ...message };
  const preview = getVisibleMessagePreview(message);
  if (typeof preview === 'string') base.preview = preview;
  const emitTo = (userId, payload) => {
    const personalized = { ...payload, reactions: (payload.reactions || []).map((reaction) => ({
      ...reaction, reacted_by_me: reaction.users.some((user) => String(user.id) === userId),
    })) };
    for (const socketId of connectedUsers.get(userId) || []) io.to(socketId).emit('message:new', personalized);
  };
  for (const row of others) {
    const userId = String(row.user_id);
    if (!recipients.has(userId)) continue;
    emitTo(userId, personChat
      ? { ...base, other_user_id: identity }
      : { ...base, unread_for: Number(row.unread_count) || 0 });
  }
  let own = base;
  if (!personChat) {
    own = { ...base, unread_for: Number(members.find((row) => String(row.user_id) === actor)?.unread_count) || 0 };
  } else if (identity === actor && recipients.size === 1) {
    const [counterpart] = recipients;
    const unread = await personRowUnread(actor, counterpart).catch(() => null);
    if (unread !== null) own = { ...base, other_user_id: counterpart, unread_for: unread };
  }
  const actorMember = members.some((row) => String(row.user_id) === actor);
  const actorCanHear = actorMember
    ? eligible.has(actor)
    : eligible.has(identity) && await canActAsBusiness(identity, actor);
  if (actorCanHear) emitTo(actor, own);
  // Staff hear what their business hears, and what a colleague sent as it. Members already heard it above.
  const businessIds = members
    .filter((row) => row.user?.account_type === 'business')
    .map((row) => String(row.user_id))
    .filter((id) => eligible.has(id));
  const heard = new Set([actor, ...members.map((row) => String(row.user_id))]);
  await emitToBusinessStaff(emitTo, base, businessIds, heard).catch((staffError) => {
    logger.warn('message_new_business_staff_failed', { roomId: room.id, error: staffError.message });
  });
}

// Mutation broadcasts use current membership, including staff acting for a
// business. A stale Socket.IO room subscription is not access authorization.
async function emitChatMutation(io, room, event, payload) {
  const { connectedUsers } = require('../socket/chatSocketio');
  const members = await readChatParticipants([room.id], 'user_id, user:user_id(account_type)');
  // A room-wide read boundary is not a group delivery receipt. Clients may
  // project the other person's Read state only for this current direct pair.
  const receiptPayload = ['messages:read', 'messages:topic_read'].includes(event)
    ? { ...payload, directReceiptEligible: room.type === 'direct' && members.length === 2 }
    : payload;
  const recipients = new Set(await gigRoomRecipients(room, (members || []).map((row) => String(row.user_id))));
  const emitTo = (userId, data) => {
    // A reaction's selected state belongs to the receiving person, not the actor.
    const personalize = (reactions) => reactions.map((reaction) => ({
      ...reaction, reacted_by_me: reaction.users.some((user) => String(user.id) === userId),
    }));
    const personalized = { ...data,
      ...(data.reactions ? { reactions: personalize(data.reactions) } : {}),
      ...(data.message?.reactions ? { message: { ...data.message, reactions: personalize(data.message.reactions) } } : {}),
    };
    for (const socketId of connectedUsers.get(userId) || []) io.to(socketId).emit(event, personalized);
  };
  for (const userId of recipients) emitTo(userId, receiptPayload);
  const businessIds = (members || []).filter((row) => row.user?.account_type === 'business'
    && recipients.has(String(row.user_id))).map((row) => String(row.user_id));
  await emitToBusinessStaff(emitTo, receiptPayload, businessIds, recipients);
}

async function emitCommittedChatChange(io, change, prepared) {
  const { data: room, error: roomError } = prepared?.room
    ? { data: prepared.room } : await supabaseAdmin.from('ChatRoom').select('id, type, gig_id').eq('id', change.r).maybeSingle();
  if (roomError) throw roomError;
  if (!room) return Number(change.v || 0);
  if (change.t === 'ChatTopicRead') {
    // The topic event has a separate name: old clients must never apply a
    // selected-topic boundary to every message in the room.
    const { data: receipt, error } = await supabaseAdmin.from('ChatTopicRead')
      .select('last_read_message_id, last_read_message_at, read_at, participant:ChatParticipant!inner(is_active)')
      .eq('room_id', room.id).eq('user_id', change.u).eq('topic_id', change.q)
      .eq('participant.is_active', true).maybeSingle();
    if (error) throw error;
    if (receipt && room.type === 'direct') await emitChatMutation(io, room, 'messages:topic_read', {
      userId: change.u, roomId: room.id, topicId: change.q, readAt: receipt.read_at,
      throughMessageId: receipt.last_read_message_id, throughCreatedAt: receipt.last_read_message_at,
    });
    return 0;
  }
  if (change.t === 'ChatRead') {
    const { data: participant, error } = await supabaseAdmin.from('ChatParticipant')
      .select('last_read_at, last_read_message_id, last_read_message_at')
      .eq('room_id', room.id).eq('user_id', change.u).eq('is_active', true).maybeSingle();
    if (error) throw error;
    if (participant?.last_read_message_id) await emitChatMutation(io, room, 'messages:read', {
      userId: change.u, roomId: room.id, readAt: participant.last_read_at,
      throughMessageId: participant.last_read_message_id, throughCreatedAt: participant.last_read_message_at,
    });
    return 0;
  }
  const { data: message, error } = prepared?.message
    ? { data: prepared.message } : await supabaseAdmin.from('ChatMessage').select('*').eq('id', change.m).maybeSingle();
  if (error) throw error;
  const version = Math.max(Number(change.v || 0), Number(message?.sync_version || 0));
  if (!message || message.deleted) {
    await emitChatMutation(io, room, 'message:deleted', { messageId: change.m, roomId: room.id, sync_version: version });
    return version;
  }
  // The insert's own snapshot has no reactions yet; skip that read on the recipient's path.
  const [people, summaries] = await Promise.all([
    prepared?.people || loadMessageSenders([message]),
    change.insert && prepared?.message ? new Map() : buildReactionSummary([message.id]),
  ]);
  const reactions = summaries.get(message.id) || [];
  const safe = { ...serializeChatMessageForViewer(message, { people }), reactions };
  if (change.insert) await emitNewMessage(io, {
    room, message: safe, actorUserId: message.actor_user_id || message.user_id, identityUserId: message.user_id,
  });
  else await emitChatMutation(io, room, 'message:edited', { messageId: message.id, message: safe });
  if (!change.insert || reactions.length) await emitChatMutation(io, room, 'message:reaction_updated', {
    messageId: message.id, roomId: room.id, sync_version: version, reactions,
  });
  return version;
}

chatRealtime.setHandler(emitCommittedChatChange);

// ── Delivery ─────────────────────────────────────────────────────────
// A message just written to `room` (with its `sender`) goes out the same way
// wherever it was written: every member hears it (message:new, without the
// internal actor_user_id), the room moves up the lists, the sender's own row
// retains its read boundary, and the other members get a badge update and a device push.
// POST /messages and an organizer's Support Train reminder
// (routes/supportTrains.js) both deliver through here. `people` names the
// sender (loadChatPeople); without it they're looked up here.
async function deliverNewMessage(io, { room, message, actorUserId, senderUserId = actorUserId, requestId = null, people = null }) {
  const roomId = room.id;
  // The durable row was captured in the insert transaction, even if this process exits now.
  if (message.push_delivery_requested) require('../services/chatPushDelivery').wake();
  const broadcast = serializeChatMessageForViewer(message, { people: people || await loadMessageSenders([message]) });
  if (io) {
    chatRealtime.announce({ t: 'ChatMessage', r: roomId, m: message.id, op: 'INSERT', v: message.sync_version },
      { room, message, people });
  }

  // Push fresh badge counts (including total message count) immediately.
  let participantRows;
  try {
    participantRows = await readChatParticipants([roomId], 'user_id, notifications_enabled, user:user_id(account_type)');
  } catch (error) {
    // The message is already committed. Its durable push and realtime records
    // recover independently; a badge lookup must not turn acceptance into 500.
    logger.warn('chat_badge_recipients_unavailable', { requestId, roomId, code: error.code });
    return;
  }
  const participantUserIds = Array.from(new Set((participantRows || []).map((row) => String(row.user_id)).filter(Boolean)));
  // Exclude both the acting user and the message identity user.
  const excludedUserIds = new Set([String(actorUserId), String(senderUserId)]);
  let recipientUserIds = participantUserIds.filter((id) => !excludedUserIds.has(id));
  try {
    // Leftover members of an assigned task's gig room get no badge or push for it.
    recipientUserIds = await gigRoomRecipients(room, recipientUserIds);
  } catch (recipientErr) {
    logger.warn('gig_room_recipients_unavailable', { requestId, roomId, error: recipientErr.message });
    recipientUserIds = [];
  }
  if (recipientUserIds.length === 0) return;
  badgeService.emitBadgeUpdateToMany(recipientUserIds);
  if (message.push_delivery_requested) return;
  const mutedRecipients = (['direct', 'gig'].includes(room.type)
    ? mutedBySender(recipientUserIds, senderUserId) : Promise.resolve(new Set()))
    .then((muted) => {
      for (const row of participantRows || []) if (row.notifications_enabled === false) muted.add(String(row.user_id));
      return muted;
    }).catch((error) => {
      logger.warn('chat_mute_preferences_unavailable', { requestId, code: error.code });
      return new Set(recipientUserIds); // no push while the recipient's preference is unreadable
    });

  const text = String(message.message || '');
  const type = message.type || 'text';
  const preview = type === 'text'
    ? (text.length > 100 ? text.slice(0, 100) + '…' : text)
    : type === 'file' ? '📎 Sent an attachment' : '💬 New message';

  // A device push to every recipient who has push on, so it arrives when the
  // app is in the background or closed.
  (async () => {
    try {
      // Skip recipients who turned push off; an account with no
      // preference row has the default (on).
      const { data: disabledRows, error: prefsError } = await supabaseAdmin
        .from('MailPreferences')
        .select('user_id')
        .in('user_id', recipientUserIds)
        .eq('push_notifications', false);
      if (prefsError) return;
      const disabled = new Set((disabledRows || []).map((r) => r.user_id));
      const muted = await mutedRecipients;
      const pushEnabledIds = recipientUserIds.filter((id) => !disabled.has(id) && !muted.has(id));
      if (pushEnabledIds.length === 0) return;

      const senderName = broadcast.sender?.displayName || 'Someone';
      await pushService.sendToUsers(pushEnabledIds, {
        title: senderName,
        body: preview,
        data: { type: 'chat_message', room_id: roomId, link: `/chat/${roomId}` },
      });
    } catch (err) {
      logger.warn('Chat push delivery failed (non-blocking)', { error: err.message, roomId });
    }
  })();

  const recipientSet = new Set(recipientUserIds);
  const businessRecipientIds = (participantRows || [])
    .filter((row) => row.user?.account_type === 'business' && recipientSet.has(String(row.user_id)))
    .map((row) => String(row.user_id));
  if (businessRecipientIds.length > 0) {
    mutedRecipients.then((mutedBusinessIds) => notifyBusinessStaff({
      room,
      messageId: message.id,
      businessIds: businessRecipientIds,
      actorUserId,
      senderUserId,
      memberIds: participantUserIds,
      mutedBusinessIds,
      preview,
    })).catch((err) => {
      logger.warn('business_message_notice_failed', { requestId, roomId, error: err.message });
    });
  }
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

function serializeChatParticipantForViewer(participant, people = new Map()) {
  if (!participant) return null;
  const { user, ...safe } = participant;
  return {
    ...safe,
    user: (user?.id && people.get(String(user.id))) || serializeUserAsLocalIdentity(user),
  };
}

function serializeChatRoomForViewer(room, people = new Map()) {
  if (!room) return null;
  return {
    ...room,
    participants: Array.isArray(room.participants)
      ? room.participants.map((participant) => serializeChatParticipantForViewer(participant, people))
      : room.participants,
  };
}

async function loadPlanChatStates(rooms) {
  const ids = rooms.filter((room) => room.type === 'plan').map((room) => room.id);
  if (!ids.length) return new Map();
  const { data, error } = await supabaseAdmin.from('Plan')
    .select('post_id, chat_room_id, status, chat_closed_at')
    .in('chat_room_id', ids);
  if (error) {
    logger.warn('Plan chat state lookup failed', { error: error.message });
    throw Object.assign(new Error('Chat status is temporarily unavailable. Please try again.'), { code: 'CHAT_UNAVAILABLE' });
  }
  return new Map((data || []).map((plan) => [String(plan.chat_room_id), plan]));
}

function roomIsActive(room, planStates) {
  if (room.type !== 'plan') return room.is_active;
  const plan = planStates.get(String(room.id));
  // A cancellation can be committed before the later ChatRoom update succeeds.
  // Reads must reflect the same authoritative state as the write guard.
  return room.is_active !== false && !!plan && plan.status !== 'cancelled' && !plan.chat_closed_at;
}

function sendChatReadError(res, error, fallback) {
  if (error.status === 400) return res.status(400).json({ error: error.message });
  if (error.status === 503 || error.code === 'CHAT_UNAVAILABLE') {
    return res.status(503).json({ error: error.message, code: error.code });
  }
  return res.status(500).json({ error: fallback });
}

// `options.people` (loadChatPeople) names the sender as the chat list does.
function serializeChatMessageForViewer(message, options = {}) {
  if (!message) return null;
  // Who wrote for a business stays internal, but the person who wrote it sees their own id (options.viewerId): their
  // apps offer to edit or delete it. Room broadcasts are serialized without a viewer.
  const viewerWroteIt = Boolean(options.viewerId && message.actor_user_id
    && String(message.actor_user_id) === String(options.viewerId));
  const base = options.includeActorIdentity || viewerWroteIt ? message : stripActorIdentity(message);
  const { sender, push_delivery_requested: _pushDelivery, read_topic_id: _readTopic, ...safe } = base;
  const bodyText = safe.message_text ?? safe.message ?? null;
  const bodyType = safe.message_type ?? safe.type ?? 'text';
  const senderId = sender?.id || safe.user_id;
  return {
    ...safe,
    // Emit both canonical DB columns and legacy aliases so all clients decode reliably.
    message: safe.message ?? bodyText,
    message_text: bodyText,
    type: safe.type ?? bodyType,
    message_type: bodyType,
    sender: (senderId && options.people?.get(String(senderId))) || serializeUserIdentityForViewer(sender),
  };
}

// The people who wrote these messages (loadChatPeople).
function loadMessageSenders(messages) {
  return loadChatPeople((messages || []).map((message) => message?.sender?.id || message?.user_id));
}

// The shared direct and task rooms, each with its sync revisions (chatSyncSnapshot).
async function personChatRooms(userId, otherUserId, asBusinessUserId) {
  if (asBusinessUserId && !await canActAsBusiness(asBusinessUserId, userId)) {
    const error = new Error('Access denied');
    error.status = 403;
    throw error;
  }
  const identityUserId = asBusinessUserId || userId;
  if (String(identityUserId) === String(otherUserId)) {
    throw Object.assign(new Error('Cannot open a conversation with yourself'), { status: 400 });
  }
  const shared = [];
  let after;
  // Filter both members in SQL before paging. Intersecting two capped lists of
  // unrelated rooms silently loses older conversations for long-lived accounts.
  for (;;) {
    let query = supabaseAdmin.from('ChatRoom')
      .select('id, type, gig_id, message_revision, history_reset_revision, '
        + 'mine:ChatParticipant!inner(user_id), other:ChatParticipant!inner(user_id)')
      .in('type', ['direct', 'gig'])
      .eq('mine.user_id', identityUserId).eq('mine.is_active', true)
      .eq('other.user_id', otherUserId).eq('other.is_active', true)
      .order('id').limit(200);
    if (after) query = query.gt('id', after);
    const { data, error } = await query;
    if (error) throw chatAccessUnavailable();
    const rooms = data || [];
    const closed = await closedGigRoomIds(rooms, userId, [identityUserId]);
    shared.push(...rooms.filter((room) => !closed.has(room.id)));
    if (rooms.length < 200) return shared;
    after = rooms[rooms.length - 1].id;
  }
}

async function personChatRoomIds(userId, otherUserId, asBusinessUserId) {
  return (await personChatRooms(userId, otherUserId, asBusinessUserId)).map((room) => room.id);
}

// `holdCursor` answers with no changes and the reader's own cursor: see roomChatChanges.
async function respondWithChatChanges(req, res, roomIds, identityUserId, snapshot, { holdCursor = false } = {}) {
  const params = req.method === 'POST' ? (req.body || {}) : req.query;
  let receiptIds = params.readMessageIds;
  if (receiptIds !== undefined) {
    if (typeof receiptIds === 'string') {
      try { receiptIds = JSON.parse(receiptIds); } catch { throw Object.assign(new Error('Invalid receipt messages'), { status: 400 }); }
    }
    if (Joi.array().items(Joi.string().uuid()).max(500).validate(receiptIds).error) {
      throw Object.assign(new Error('Invalid receipt messages'), { status: 400 });
    }
    receiptIds = [...new Set(receiptIds)];
  }
  const cursor = parseSyncCursor(params.cursor);
  // An unpinned complete page answers untilCursors {}; sent back, an empty map pins nothing.
  const until = parseSyncCursor(params.until, { optional: true });
  const limit = Math.min(Math.max(parseInt(params.limit, 10) || 200, 1), 200);
  const { changedRoomIds, ...changes } = await chatChanges({ roomIds, identityUserId, cursor,
    until: holdCursor ? cursor : (until && Object.keys(until).length ? until : null), limit, snapshot });
  const visible = changes.messages.filter((message) => !message.deleted);
  // Read boundaries come with the rooms that changed since the cursor. A read alone moves no room revision:
  // the apps recover reads of their own unconfirmed messages through readMessageIds (messageReadReceipts).
  const [reactions, people, readReceipts] = await Promise.all([
    buildReactionSummary(visible.map((message) => message.id), req.user.id),
    loadMessageSenders(visible),
    chatReadReceipts(changedRoomIds),
    applyDirectReadReceipts(visible, req.user.id, { identityUserId }),
  ]);
  const messageReadReceipts = [];
  const authorizedRooms = new Set(roomIds.map(String));
  for (let start = 0; start < (receiptIds?.length || 0); start += 100) {
    const { data, error } = await supabaseAdmin.from('ChatMessage')
      .select('id, room_id, user_id, actor_user_id, created_at')
      .in('id', receiptIds.slice(start, start + 100)).eq('deleted', false);
    if (error) throw error;
    const authorized = (data || []).filter((m) => authorizedRooms.has(String(m.room_id))
      && (String(m.user_id) === String(identityUserId)
        || [String(m.user_id), String(m.actor_user_id)].includes(String(req.user.id))));
    await applyDirectReadReceipts(authorized, req.user.id, { required: true, identityUserId });
    messageReadReceipts.push(...authorized.map((m) => ({ messageId: m.id, readAt: m.read_at || null })));
  }
  res.set('Cache-Control', 'private, no-store');
  return res.json({ ...changes, readReceipts, ...(receiptIds ? { messageReadReceipts } : {}), messages: changes.messages.map((message) => message.deleted
    ? { id: message.id, room_id: message.room_id, deleted: true, sync_version: message.sync_version }
    : { ...serializeChatMessageForViewer(message, { people, viewerId: req.user.id }),
      reactions: reactions.get(message.id) || [] }) });
}

function chatChangesFailure(req, res, error) {
  if (error.status) return res.status(error.status).json({ error: error.message });
  logger.warn('chat_changes_unavailable', { requestId: req.requestId, code: error.code });
  return res.status(503).json({ error: 'Chat updates are temporarily unavailable', code: 'CHAT_UNAVAILABLE' });
}

async function chatSearchScope(req) {
  const userId = req.user.id;
  const asBusinessUserId = req.query.asBusinessUserId ? String(req.query.asBusinessUserId) : null;
  let identityUserId = asBusinessUserId || userId;
  const roomId = req.params.roomId || req.query.roomId;
  const otherUserId = req.params.otherUserId || req.query.otherUserId;
  if (roomId && otherUserId) throw Object.assign(new Error('Choose a room or a person'), { status: 400 });
  if (asBusinessUserId && !await canActAsBusiness(asBusinessUserId, userId)) {
    throw Object.assign(new Error('Access denied'), { status: 403 });
  }
  if (otherUserId) return { identityUserId, roomIds: await personChatRoomIds(userId, otherUserId, asBusinessUserId) };
  if (roomId) {
    const participant = await roomMembership(roomId, userId, asBusinessUserId);
    if (!participant || (participant.is_active === false && !participant.left_at)
      || await gigRoomClosed(roomId, userId, asBusinessUserId)) {
      throw Object.assign(new Error('Access denied'), { status: 403 });
    }
    identityUserId = participant.user_id;
    return { identityUserId, roomIds: [roomId] };
  }
  const rooms = [];
  // Search every authorized room, not just the first inbox page or PostgREST's
  // default row cap. No message bodies are downloaded while building scope.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabaseAdmin.from('ChatParticipant')
      .select('room_id, room:room_id!inner(id, type, gig_id)')
      .eq('user_id', identityUserId).eq('is_active', true)
      .order('room_id').range(offset, offset + 499);
    if (error) throw error;
    rooms.push(...(data || []).map((row) => row.room));
    if ((data || []).length < 500) break;
  }
  const closed = await closedGigRoomIds(rooms, userId, [identityUserId]);
  return { identityUserId, roomIds: rooms.map((room) => room.id).filter((id) => !closed.has(id)) };
}

async function chatSearchRoomContexts(messages, identityUserId) {
  const ids = [...new Set(messages.map((message) => message.room_id))];
  if (!ids.length) return {};
  const [rooms, members] = await Promise.all([
    supabaseAdmin.from('ChatRoom').select('id, type, name, gig_id, support_train:support_train_id(Activity(title))').in('id', ids),
    supabaseAdmin.from('ChatParticipant').select('room_id, user_id')
      .in('room_id', ids).neq('user_id', identityUserId).eq('is_active', true),
  ]);
  if (rooms.error || members.error) throw rooms.error || members.error;
  const hidden = await hiddenGigRoomMembers(rooms.data, members.data);
  const otherByRoom = new Map();
  for (const member of members.data || []) {
    if (!hidden.has(`${member.room_id}:${member.user_id}`) && !otherByRoom.has(member.room_id)) {
      otherByRoom.set(member.room_id, member.user_id);
    }
  }
  const people = await loadChatPeople([...otherByRoom.values()]);
  return Object.fromEntries((rooms.data || []).map((room) => {
    const other = ['direct', 'gig'].includes(room.type) ? otherByRoom.get(room.id) : null;
    const identity = other ? people.get(other) : null;
    return [room.id, { conversationId: other || room.id, kind: other ? 'conversation' : 'room',
      name: other ? identity?.displayName || 'Pantopus user'
        : room.support_train?.Activity?.title || room.name || 'Conversation', identity: identity || null }];
  }));
}

async function serializeChatHistory(messages, viewerId, identityUserId = viewerId) {
  const [reactions, people] = await Promise.all([
    buildReactionSummary(messages.map((message) => message.id), viewerId),
    loadMessageSenders(messages), applyDirectReadReceipts(messages, viewerId, { identityUserId }),
  ]);
  return messages.map((message) => ({ ...serializeChatMessageForViewer(message, { people, viewerId }),
    reactions: reactions.get(message.id) || [] }));
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

async function roomInboxPage(query, userId, actorId = userId) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 200, 1), 500);
  const { beforeTs, beforeId } = parseCursor(query.before);
  if (query.before && (String(query.before).length > 256 || !Number.isFinite(Date.parse(beforeTs))
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(beforeId || ''))) {
    throw Object.assign(new Error('Invalid room cursor'), { status: 400 });
  }
  if (query.type != null && typeof query.type !== 'string') {
    throw Object.assign(new Error('Invalid room type'), { status: 400 });
  }
  const { data, error } = await supabaseAdmin.rpc('get_user_chat_rooms', {
    p_user_id: userId, p_actor_id: actorId, p_limit: limit,
    p_before_at: beforeTs, p_before_id: beforeId, p_type: query.type || null,
  });
  if (error || !data || !Array.isArray(data.entries)) throw chatAccessUnavailable();
  const last = data.entries.at(-1);
  return { ...data, nextCursor: data.hasMore && last ? `${last.sort_at}|${last.id}` : null };
}

async function roomPagePeople(roomIds, viewerId, activeOnly = false) {
  const people = await readChatParticipants(roomIds,
    'is_active, user:user_id(id, username, name, first_name, middle_name, last_name, profile_picture_url)',
    { activeOnly, excludeUserId: viewerId }).catch(() => { throw chatAccessUnavailable(); });
  // Prefer current members after reading every page. Sorting by activity in
  // PostgREST alone truncated historical counterparts behind large groups.
  return people.sort((a, b) => Number(b.is_active === true) - Number(a.is_active === true));
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
  const bounds = [];
  const { beforeTs, beforeId } = parseCursor(before);
  if (beforeTs) {
    if (beforeId) {
      // Composite cursor: WHERE (created_at < ts) OR (created_at = ts AND id < id)
      bounds.push(`or(created_at.lt.${beforeTs},and(created_at.eq.${beforeTs},id.lt.${beforeId}))`);
    } else {
      // Legacy: plain timestamp
      q = q.lt('created_at', beforeTs);
    }
  }
  if (after) {
    const { beforeTs: afterTs, beforeId: afterId } = parseCursor(after);
    if (afterId) {
      bounds.push(`or(created_at.gt.${afterTs},and(created_at.eq.${afterTs},id.gt.${afterId}))`);
    } else {
      q = q.gt('created_at', afterTs);
    }
  }
  // PostgREST only has one `or` query key. Preserve both bounds when paging a
  // reconnect gap whose endpoints share a timestamp.
  if (bounds.length) q = q.or(`and(${bounds.join(',')})`);
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
          logger.warn('Failed to count chat messages for room', { roomId, error: error.message });
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
    const page = await roomInboxPage(req.query, userId);
    const rank = new Map(page.entries.map((entry, index) => [entry.id, index]));
    if (!page.entries.length) {
      recordHistogram('chat.rooms.load_latency_ms', Date.now() - roomsStartMs);
      return res.json({ rooms: [], total: page.total, totalUnread: page.totalUnread,
        hasMore: page.hasMore, nextCursor: page.nextCursor });
    }
    const participantRows = page.entries.map((entry) => entry.membership);

    // Build room list. A leftover member of an assigned task's gig room doesn't see it.
    const joinedRooms = (participantRows || []).filter(p => p.room);
    const closedRoomIds = await closedGigRoomIds(joinedRooms.map((p) => p.room), userId);
    const roomList = joinedRooms.filter((p) => !closedRoomIds.has(String(p.room.id)));

    // Batch-fetch other participants and last messages for all rooms (2 queries instead of 2N)
    const allRoomIds = roomList.map(p => p.room.id);

    const [allOtherParts, { data: roomPreviews, error: previewError }, planStates] = await Promise.all([
      roomPagePeople(allRoomIds, userId),
      supabaseAdmin.rpc('get_room_previews', { p_room_ids: allRoomIds }),
      loadPlanChatStates(roomList.map((p) => p.room)),
    ]);

    if (previewError) throw chatAccessUnavailable();

    // Pick first (active-preferred) participant per room, never a leftover member of an assigned task's gig room
    const hiddenMembers = await hiddenGigRoomMembers(
      roomList.map((p) => p.room),
      (allOtherParts || []).map((p) => ({ room_id: p.room_id, user_id: p.user?.id }))
    );
    const partByRoom = {};
    for (const p of allOtherParts || []) {
      if (p.user && hiddenMembers.has(`${p.room_id}:${p.user.id}`)) continue;
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
        is_active: roomIsActive(p.room, planStates),
        participant_active: p.is_active,
        created_at: p.room.created_at,
        updated_at: p.room.updated_at,
        last_message_at: lastMessageAt || p.room.updated_at,
        last_message_preview: lastMessagePreview,
        unread_count: p.unread_count || 0,
        last_read_at: p.last_read_at,
        notifications_enabled: p.notifications_enabled !== false,
        role: p.role,
        other_participant_id: u?.id || otherIdentity?.id || null,
        other_participant_name: otherIdentity?.displayName || null,
        other_participant_username: otherIdentity?.handle || null,
        other_participant_avatar: otherIdentity?.avatarUrl || null,
        other_participant_identity: otherIdentity,
      };
    });

    const rooms = enrichedRooms.sort((a, b) => rank.get(a.id) - rank.get(b.id));

    recordHistogram('chat.rooms.load_latency_ms', Date.now() - roomsStartMs);
    res.json({
      rooms,
      total: page.total,
      totalUnread: page.totalUnread,
      hasMore: page.hasMore,
      nextCursor: page.nextCursor
    });

  } catch (err) {
    logger.error('Chat rooms fetch error', { requestId: req.requestId, userId: req.user?.id, error: err.message });
    sendChatReadError(res, err, 'Failed to fetch chat rooms');
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

    const allowed = await canActAsBusiness(businessUserId, actorUserId);
    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to access this business inbox' });
    }

    const page = await roomInboxPage(req.query, businessUserId, actorUserId);
    const rank = new Map(page.entries.map((entry, index) => [entry.id, index]));
    if (!page.entries.length) return res.json({ rooms: [], total: page.total, totalUnread: page.totalUnread,
      hasMore: page.hasMore, nextCursor: page.nextCursor, businessUserId });

    const teamMemberIds = await getBusinessMessagingMemberIds(businessUserId);
    const teamSet = new Set(teamMemberIds.map((id) => String(id)));

    const participantRows = page.entries.map((entry) => entry.membership);

    const joinedRooms = (participantRows || []).filter((p) => p.room);
    const closedRoomIds = await closedGigRoomIds(joinedRooms.map((p) => p.room), actorUserId, [businessUserId]);
    const roomList = joinedRooms.filter((p) => !closedRoomIds.has(String(p.room.id)));

    // The actor never becomes a member of these rooms: opening, reading and
    // replying with asBusinessUserId go through the business's own membership
    // (roomMembership, services/chatBusinessAccess).

    // Batch-fetch participants and last messages for all rooms (2 queries instead of 2N)
    const allBizRoomIds = roomList.map(p => p.room.id);
    const [allBizParts, { data: bizRoomPreviews, error: previewError }, planStates] = await Promise.all([
      roomPagePeople(allBizRoomIds, businessUserId, true),
      supabaseAdmin.rpc('get_room_previews', { p_room_ids: allBizRoomIds }),
      loadPlanChatStates(roomList.map((p) => p.room)),
    ]);

    if (previewError) throw chatAccessUnavailable();

    // Group participants by room, leaving out leftover members of assigned task gig rooms
    const hiddenBizMembers = await hiddenGigRoomMembers(
      roomList.map((p) => p.room),
      (allBizParts || []).map((p) => ({ room_id: p.room_id, user_id: p.user?.id }))
    );
    const bizPartsByRoom = {};
    for (const p of allBizParts || []) {
      if (!bizPartsByRoom[p.room_id]) bizPartsByRoom[p.room_id] = [];
      if (p.user && !hiddenBizMembers.has(`${p.room_id}:${p.user.id}`)) bizPartsByRoom[p.room_id].push(p.user);
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
        is_active: roomIsActive(p.room, planStates),
        created_at: p.room.created_at,
        updated_at: p.room.updated_at,
        last_message_at: lastMessageAt || p.room.updated_at,
        last_message_preview: lastMessagePreview,
        unread_count: p.unread_count || 0,
        last_read_at: p.last_read_at,
        notifications_enabled: p.notifications_enabled !== false,
        role: p.role,
        other_participant_id: chosen?.id || otherIdentity?.id || null,
        other_participant_name: otherIdentity?.displayName || null,
        other_participant_username: otherIdentity?.handle || null,
        other_participant_identity: otherIdentity,
      };
    });

    rooms.sort((a, b) => rank.get(a.id) - rank.get(b.id));

    res.json({
      rooms,
      total: page.total,
      totalUnread: page.totalUnread,
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
      businessUserId,
    });
  } catch (err) {
    logger.error('Business chat rooms fetch error', { requestId: req.requestId, userId: req.user?.id, error: err.message });
    sendChatReadError(res, err, 'Failed to fetch business chat rooms');
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
    const participant = await roomMembership(roomId, userId, asBusinessUserId);
    if (!participant) return res.status(403).json({ error: 'Access denied' });

    if (await gigRoomClosed(roomId, userId, asBusinessUserId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get room details
    const { data: room, error } = await supabaseAdmin
      .from('ChatRoom')
      .select('*')
      .eq('id', roomId)
      .single();
    
    if (error || !room) {
      if (error) logger.error('Error fetching room', { requestId: req.requestId, userId: req.user?.id, roomId, error: error.message });
      return res.status(404).json({ error: 'Room not found' });
    }

    // Embedded membership reads inherit the row cap independently of the room.
    // Preserve the existing member fields while reading every membership page.
    const membersPage = await readChatParticipants([roomId],
      'user_id, role, unread_count, last_read_at, joined_at, is_active, left_at, user:user_id(id, username, name, first_name, last_name, profile_picture_url)',
      { activeOnly: false }).catch(() => { throw chatAccessUnavailable(); });
    room.participants = membersPage.map(({ id, room_id, ...member }) => member);

    // The owner and the worker don't see leftover members listed in an assigned task's room.
    if (Array.isArray(room.participants) && room.participants.length > 0) {
      const hiddenMembers = await hiddenGigRoomMembers(
        [room],
        room.participants.map((p) => ({ room_id: room.id, user_id: p.user_id }))
      );
      if (hiddenMembers.size > 0) {
        room.participants = room.participants.filter((p) => !hiddenMembers.has(`${room.id}:${p.user_id}`));
      }
    }
    // A Support Train's room goes by the train's title as it is now, as in the Messages list.
    if (room.type === 'support_train' && room.support_train_id) {
      const { data: train } = await supabaseAdmin
        .from('SupportTrain')
        .select('Activity(title)')
        .eq('id', room.support_train_id)
        .maybeSingle();
      room.name = train?.Activity?.title || room.name;
    }
    // A plan's room names its plan, so the chat can show the plan strip and open it.
    if (room.type === 'plan') {
      const planStates = await loadPlanChatStates([room]);
      const plan = planStates.get(String(room.id));
      room.plan_id = plan?.post_id || null;
      room.is_active = roomIsActive(room, planStates);
    }
    const members = Array.isArray(room.participants) ? room.participants : [];
    const people = await loadChatPeople(members.map((p) => p.user?.id || p.user_id));
    res.json({ room: serializeChatRoomForViewer(room, people) });
    
  } catch (err) {
    logger.error('Room fetch error', { requestId: req.requestId, userId: req.user?.id, roomId: req.params.roomId, error: err.message });
    sendChatReadError(res, err, 'Failed to fetch room');
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
      if (await isUnpublishedBusiness(asBusinessUserId)) {
        return res.status(403).json(UNPUBLISHED_BUSINESS_REFUSAL);
      }
      initiatorIdentityUserId = asBusinessUserId;
    }
    
    // Check if other user exists
    const { data: otherUser, error: userError } = await supabaseAdmin
      .from('User')
      .select('id, username, name, profile_picture_url, account_type')
      .eq('id', otherUserId)
      .single();
    
    // A draft or closed business isn't public (its profile answers 404), so no chat names or reaches it.
    if (userError || !otherUser || await isUnpublishedBusiness(otherUserId)) {
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

    // The two identities only. A business's owner and staff act for it in the room without joining it
    // (services/chatBusinessAccess): as members they would be named to the customer and see it in their own Messages.
    const participantIds = new Set([String(initiatorIdentityUserId), String(otherUserId)]);

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
      // The conversation's header: the other person as the chat list names them.
      otherUser: chatPersonRow(otherUser, await loadChatPeople([otherUser.id])),
    });
    
  } catch (err) {
    if (err.code === 'BLOCK_CHECK_UNAVAILABLE') return res.status(503).json({ error: err.message, code: err.code });
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
/**
 * A plan's chat (type 'plan') changes its members and its name only through the
 * Plans endpoints (routes/plans.js), which keep it in step with who's in.
 * Answers for the caller and returns true when the room is a plan's (or can't be read).
 */
async function refusePlanRoom(roomId, res) {
  const { data: room, error } = await supabaseAdmin.from('ChatRoom').select('type').eq('id', roomId).maybeSingle();
  if (error) {
    res.status(503).json({ error: 'Chat is unavailable. Please try again.' });
    return true;
  }
  if (room?.type === 'plan') {
    res.status(403).json({ error: "A plan's chat changes only through the plan.", code: 'PLAN_ROOM' });
    return true;
  }
  return false;
}

router.put('/rooms/:roomId', verifyToken, validate(updateRoomSchema), async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    const { roomName, roomDescription } = req.body;
    if (await refusePlanRoom(roomId, res)) return;
    
    // Verify user is owner/admin
    const { data: participant } = await supabaseAdmin
      .from('ChatParticipant')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .is('left_at', null)
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

    const { data: room, error: roomError } = await supabaseAdmin
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

// Search returns newest matches plus room-to-conversation navigation metadata.
// A query is literal text: '%' and '_' never become wildcard instructions.
router.get(['/search', '/rooms/:roomId/search', '/conversations/:otherUserId/search'], verifyToken, async (req, res) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!query || query.length > 200) return res.status(400).json({ error: 'Search must contain 1 to 200 characters' });
    const { beforeTs, beforeId } = parseCursor(req.query.before);
    if ((beforeTs && !Number.isFinite(Date.parse(beforeTs)))
      || (beforeId && Joi.string().uuid().validate(beforeId).error)) {
      return res.status(400).json({ error: 'Invalid search cursor' });
    }
    const { identityUserId, roomIds } = await chatSearchScope(req);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const { data, error } = roomIds.length ? await supabaseAdmin.rpc('search_chat_messages', {
      p_user_id: identityUserId, p_room_ids: roomIds, p_query: query,
      p_before_at: beforeTs, p_before_id: beforeId, p_limit: limit + 1,
    }) : { data: [] };
    if (error) throw error;
    const visible = (data || []).slice(0, limit);
    const [messages, roomContexts] = await Promise.all([
      serializeChatHistory(visible, req.user.id, identityUserId), chatSearchRoomContexts(visible, identityUserId),
    ]);
    const hasMore = (data || []).length > limit;
    const last = visible.at(-1);
    res.set('Cache-Control', 'private, no-store');
    return res.json({ messages, roomContexts, hasMore,
      nextCursor: hasMore && last ? `${last.created_at}|${last.id}` : null });
  } catch (error) {
    return chatChangesFailure(req, res, error);
  }
});

// Search can land on an old message without loading every intervening page.
// This window keeps older-history pagination and explicitly reports newer rows;
// returning to the live bottom reloads the normal latest-message window.
router.get(['/rooms/:roomId/messages/:messageId/context', '/conversations/:otherUserId/messages/:messageId/context'],
  verifyToken, async (req, res) => {
    try {
      if (Joi.string().uuid().validate(req.params.messageId).error) {
        return res.status(400).json({ error: 'Invalid message' });
      }
      const { identityUserId, roomIds } = await chatSearchScope(req);
      const eachSide = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
      const { data, error } = await supabaseAdmin.rpc('get_chat_message_context', {
        p_user_id: identityUserId, p_room_ids: roomIds, p_message_id: req.params.messageId,
        p_limit_each_side: eachSide,
      });
      if (error) throw error;
      if (!data?.anchor) return res.status(404).json({ error: 'Message not found' });
      const visible = [...data.older.slice(0, eachSide).reverse(), data.anchor, ...data.newer.slice(0, eachSide)];
      const messages = await serializeChatHistory(visible, req.user.id, identityUserId);
      const hasMore = data.older.length > eachSide;
      res.set('Cache-Control', 'private, no-store');
      return res.json({ messages, roomIds, anchorMessageId: data.anchor.id, hasMore,
        nextCursor: hasMore ? buildNextCursor(visible) : null, hasMoreAfter: data.newer.length > eachSide });
    } catch (error) {
      return chatChangesFailure(req, res, error);
    }
  });

/**
 * GET/POST /api/chat/{rooms/:roomId,conversations/:otherUserId}/changes
 * All-topic changes since the cached room revisions, including tombstones.
 * POST accepts cursor objects without placing potentially large maps in URLs.
 */
async function personChatChanges(req, res) {
  try {
    const params = req.method === 'POST' ? (req.body || {}) : req.query;
    const asBusinessUserId = params.asBusinessUserId ? String(params.asBusinessUserId) : null;
    // The scope read carries each room's revisions, so the catch-up needs no second snapshot read.
    const rooms = await personChatRooms(req.user.id, req.params.otherUserId, asBusinessUserId);
    return await respondWithChatChanges(req, res, rooms.map((room) => room.id), asBusinessUserId || req.user.id, {
      cursors: Object.fromEntries(rooms.map((room) => [room.id, room.message_revision])),
      resets: Object.fromEntries(rooms.map((room) => [room.id, room.history_reset_revision])),
    });
  } catch (error) {
    return chatChangesFailure(req, res, error);
  }
}

async function roomChatChanges(req, res) {
  try {
    const { roomId } = req.params;
    const params = req.method === 'POST' ? (req.body || {}) : req.query;
    const asBusinessUserId = params.asBusinessUserId ? String(params.asBusinessUserId) : null;
    if (asBusinessUserId && !await canActAsBusiness(asBusinessUserId, req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const participant = await roomMembership(roomId, req.user.id, asBusinessUserId);
    if (!participant || (participant.is_active === false && !participant.left_at)
      || await gigRoomClosed(roomId, req.user.id, asBusinessUserId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    // Someone who left gets nothing posted after they left. Moving their cursor past it anyway would make their apps
    // skip what was said while they were away if they're added back, so it stays where it was.
    return await respondWithChatChanges(req, res, [roomId], participant.user_id, undefined,
      { holdCursor: participant.is_active === false });
  } catch (error) {
    return chatChangesFailure(req, res, error);
  }
}
router.route('/conversations/:otherUserId/changes')
  .get(verifyToken, personChatChanges).post(verifyToken, personChatChanges);
router.route('/rooms/:roomId/changes')
  .get(verifyToken, roomChatChanges).post(verifyToken, roomChatChanges);

/**
 * GET /api/chat/conversations/:otherUserId/messages
 * Person-conversation feed across shared direct and task rooms.
 */
router.get('/conversations/:otherUserId/messages', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { otherUserId } = req.params;
    const { limit = 100, before, after, topicId } = req.query;
    const asBusinessUserId = req.query.asBusinessUserId ? String(req.query.asBusinessUserId) : null;

    const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 400);
    const sharedRooms = await personChatRooms(userId, otherUserId, asBusinessUserId);
    const sharedRoomIds = sharedRooms.map((room) => room.id);
    // The watermark comes with the scope read, before the history (as in personChatChanges). A commit during the
    // history query is replayed harmlessly next time; a watermark captured afterward could skip it.
    const sync = req.query.sync === 'true' ? {
      cursors: Object.fromEntries(sharedRooms.map((room) => [room.id, room.message_revision])),
    } : null;
    if (sharedRoomIds.length === 0) {
      return res.json({ messages: [], hasMore: false, roomIds: [], ...(sync ? { syncCursors: sync.cursors } : {}) });
    }

    const runQuery = async ({ senderKey }) => {
      let newest = [];
      // Bound each URL and retain only the requested global page while merging
      // room batches. Sorting keeps PostgreSQL's microsecond timestamp/UUID order.
      for (let offset = 0; offset < sharedRoomIds.length; offset += 100) {
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
          .in('room_id', sharedRoomIds.slice(offset, offset + 100))
          .eq('deleted', false)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(lim + 1);

        if (topicId) q = q.eq('topic_id', topicId);
        q = applyCursorPagination(q, before, after);
        const { data, error } = await q;
        if (error) return { error };
        newest = newest.concat(data || []).sort((left, right) => {
          const a = timestampMicros(left.created_at) ?? 0n;
          const b = timestampMicros(right.created_at) ?? 0n;
          if (a !== b) return a > b ? -1 : 1;
          return left.id === right.id ? 0 : left.id > right.id ? -1 : 1;
        }).slice(0, lim + 1);
      }
      return { data: newest };
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

    // Batch-fetch reactions and senders for all visible messages to avoid N+1 queries
    const visibleMessages = (messages || []).slice(0, lim).reverse();
    const messageIds = visibleMessages.map((m) => m.id).filter(Boolean);
    const [reactionMap, people, sendRefusal] = await Promise.all([
      buildReactionSummary(messageIds, userId),
      loadMessageSenders(visibleMessages),
      // The thread sends into the pair's direct room, which takes nothing to or from a draft or closed business:
      // the apps lock the composer with this sentence instead of letting a message fail.
      unpublishedDirectRoomRefusal(asBusinessUserId || userId, [otherUserId]).catch((refusalError) => {
        logger.warn('chat.send_refusal_unavailable', { requestId: req.requestId, userId, error: refusalError.message });
        return null; // sends are still checked when they arrive
      }),
      applyDirectReadReceipts(visibleMessages, userId, { identityUserId: asBusinessUserId || userId }),
    ]);
    const messagesWithReactions = visibleMessages.map((m) => ({
      ...serializeChatMessageForViewer(m, { people, viewerId: userId }),
      reactions: reactionMap.get(m.id) || [],
    }));

    const hasMore = Array.isArray(messages) && messages.length > lim;
    res.json({
      messages: messagesWithReactions,
      hasMore,
      nextCursor: hasMore ? buildNextCursor(visibleMessages) : null,
      roomIds: sharedRoomIds,
      ...(sync ? { syncCursors: sync.cursors } : {}),
      sendRefusal,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    logger.error('Canonical conversation fetch error', { requestId: req.requestId, userId: req.user?.id, error: err.message });
    res.status(500).json({ error: 'Failed to fetch conversation messages' });
  }
});

/**
 * POST /api/chat/conversations/:otherUserId/read
 * Mark shared direct/task-room messages with a person as read.
 */
router.post(['/conversations/:otherUserId/read', '/conversations/:otherUserId/topics/:topicId/read'], verifyToken, async (req, res) => {
  const requestAt = new Date().toISOString();
  try {
    const userId = req.user.id;
    const { otherUserId } = req.params;
    if (req.body?.topicId !== undefined) return res.status(400).json({ error: 'Use the topic read route' });
    if (req.params.topicId && Joi.string().uuid().validate(req.params.topicId).error) {
      return res.status(400).json({ error: 'Invalid topic' });
    }
    const asBusinessUserId = req.body?.asBusinessUserId ? String(req.body.asBusinessUserId) : null;
    const readTargetUserId = asBusinessUserId || userId;
    const sharedRoomIds = await personChatRoomIds(userId, otherUserId, asBusinessUserId);

    if (sharedRoomIds.length === 0) {
      if (req.params.topicId) return res.status(403).json({ error: 'Access denied' });
      return res.json({ unreadCount: 0, updatedRooms: 0 });
    }

    const usersToClear = [String(readTargetUserId)];
    const result = await markChatRead({ roomIds: sharedRoomIds, userId: readTargetUserId,
      topicId: req.params.topicId, otherUserId,
      throughMessageId: req.body?.throughMessageId, throughMessageIds: req.body?.throughMessageIds,
      requestAt, io: req.app.get('io') });
    if (result.error) {
      const status = result.error.code === '22023' ? 400 : result.error.code === '42501' ? 403 : 500;
      return res.status(status).json({ error: status === 400 ? 'Invalid read cursor' : 'Failed to mark conversation as read' });
    }
    badgeService.emitBadgeUpdateToMany(usersToClear);
    // Do not clear a later business notification outside the visible boundary.
    if (result.unreadCount === 0) await readBusinessNotices(userId, asBusinessUserId, sharedRoomIds);
    return res.json({ unreadCount: result.unreadCount, updatedRooms: result.data.length,
      ...(req.params.topicId ? { topicId: req.params.topicId, readScope: 'topic' } : {}) });
  } catch (err) {
    logger.error('Conversation read error', { requestId: req.requestId, userId: req.user?.id, error: err.message });
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to mark conversation as read' });
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

    // These reads don't depend on one another, so they start together; their answers are applied in the order below,
    // so each refusal is the one the sequential checks gave (as POST /messages does). The sync watermark is one of
    // them, read before the history: a commit during the history query is replayed harmlessly next time, while a
    // watermark captured afterward could skip it.
    const membershipCheck = settle(roomMembership(roomId, userId, asBusinessUserId));
    const closedCheck = settle(gigRoomClosed(roomId, userId, asBusinessUserId));
    const syncRead = req.query.sync === 'true' ? settle(chatSyncSnapshot([roomId])) : null;

    // Verify access
    const participant = settled(await membershipCheck);
    if (!participant) return res.status(403).json({ error: 'Access denied' });

    if (settled(await closedCheck)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Someone who left or was removed keeps their own history, read-only: nothing posted after
    // they left. Without a recorded leave time there is no history to keep.
    const leftAt = participant.is_active === false ? participant.left_at : null;
    if (participant.is_active === false && !leftAt) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const lim = Math.min(Math.max(parseInt(limit) || 50, 1), 200);

    // No sync cursor for someone who left: one at the room's current revision would make their apps skip what was
    // said while they were away if they're added back (they re-read pages instead).
    const sync = syncRead && !leftAt ? settled(await syncRead) : null;

    // Historical access after departure is read-only. All clients already use
    // sendRefusal to replace the composer before someone writes an unsendable draft.
    // Active identities keep the existing draft/closed-business refusal check, read alongside the messages.
    const sendRefusalRead = participant.is_active === false
      ? { code: 'ROOM_MEMBERSHIP_INACTIVE', error: 'You are no longer in this conversation. You can still read earlier messages.' }
      : unpublishedRoomRefusal(roomId, participant.user_id).catch((refusalError) => {
        logger.warn('chat.send_refusal_unavailable', { requestId: req.requestId, userId, roomId, error: refusalError.message });
        return null; // sends are still checked when they arrive
      });

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
        .limit(lim + 1);

      if (leftAt) q = q.lte('created_at', leftAt);
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

    // Batch-fetch reactions and senders for all visible messages to avoid N+1 queries
    const visibleMessages = (messages || []).slice(0, lim).reverse();
    const messageIds = visibleMessages.map((m) => m.id).filter(Boolean);
    const [reactionMap, people, sendRefusal] = await Promise.all([
      buildReactionSummary(messageIds, userId),
      loadMessageSenders(visibleMessages),
      sendRefusalRead,
      applyDirectReadReceipts(visibleMessages, userId, { identityUserId: participant.user_id }),
    ]);
    const messagesWithReactions = visibleMessages.map((m) => ({
      ...serializeChatMessageForViewer(m, { people, viewerId: userId }),
      reactions: reactionMap.get(m.id) || [],
    }));

    const hasMore = Array.isArray(messages) && messages.length > lim;
    recordHistogram('chat.messages.load_latency_ms', Date.now() - msgsStartMs);
    res.json({
      messages: messagesWithReactions,
      hasMore,
      nextCursor: hasMore ? buildNextCursor(visibleMessages) : null,
      sendRefusal,
      ...(sync ? { syncCursors: sync.cursors } : {}),
    });

  } catch (err) {
    logger.error('Messages fetch error', { requestId: req.requestId, userId: req.user?.id, roomId: req.params.roomId || req.query.roomId, error: err.message });
    sendChatReadError(res, err, 'Failed to fetch messages');
  }
});

/**
 * POST /api/chat/messages
 * Send a message (alternative to WebSocket)
 */
router.post('/messages', verifyToken, messageSendLimiter, messageBurstLimiter, validate(sendMessageSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const requestId = req.requestId;
    const sendStartMs = Date.now();
    const { roomId, messageText, messageType, fileIds = [], metadata = {}, replyToId, asBusinessUserId, clientMessageId } = req.body;
    if (hasForeignChatFileLink(metadata)) {
      logger.warn('message_send_rejected_foreign_chat_file_link', { requestId, roomId, userId });
      return res.status(400).json({ error: 'Photos and files in chat must be uploaded to this chat.' });
    }
    logger.info('message_send_start', { requestId, roomId, userId, messageType });
    let senderUserId = userId;
    let committedRetryMessage = null;

    // These reads don't depend on one another, so they start together; their answers are
    // still applied in the order below, so each refusal is the one the sequential checks gave.
    const membershipCheck = settle(roomMembership(roomId, userId, asBusinessUserId, { activeOnly: true }));
    const closedCheck = settle(gigRoomClosed(roomId, userId, asBusinessUserId));
    const roomRead = settle(supabaseAdmin.from('ChatRoom').select('id, type, gig_id, is_active').eq('id', roomId).single());
    const otherMembersRead = settle(supabaseAdmin.from('ChatParticipant').select('user_id')
      .eq('room_id', roomId).neq('user_id', userId).eq('is_active', true));
    // A person writing as themselves is the likely sender; a business or task identity reads its own below.
    const ownRetryRead = clientMessageId && !asBusinessUserId ? settle(retryMessage(clientMessageId, roomId, userId, userId)) : null;
    const ownPeopleRead = asBusinessUserId ? null : settle(loadChatPeople([userId]));

    // Verify participant
    const participant = settled(await membershipCheck);
    if (!participant) return res.status(403).json({ error: 'Not a participant' });

    if (settled(await closedCheck)) {
      return res.status(403).json({ error: 'Not a participant' });
    }

    // ─── Pre-bid message limit for gig chats ───
    const PRE_BID_MESSAGE_LIMIT = 3;

    const { data: room, error: roomError } = settled(await roomRead);

    if (roomError) throw blockCheckUnavailable();
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // A task chat retired when its worker was released or bidding reopened keeps its
    // history for the owner and that worker but takes no new messages; direct messages
    // (with their block checks and business identity) carry the conversation on.
    if (await isRoomClosedForWrites(roomId, room)) {
      return res.status(403).json({
        error: room.type === 'plan' ? 'This chat has closed.' : 'This chat has closed. Message them directly to keep talking.',
        code: 'ROOM_INACTIVE',
      });
    }

    // ─── Block check for direct chats ───
    // For gig/group chats, blocking is handled differently (not enforced here).
    let directMemberIds = [];
    if (room && room.type === 'direct') {
      const { data: otherParticipants, error: participantsError } = settled(await otherMembersRead);
      if (participantsError || !Array.isArray(otherParticipants)) throw blockCheckUnavailable();
      for (const participant of otherParticipants) {
        if (await isBlocked(userId, participant.user_id)) {
          return res.status(403).json({ error: 'Unable to message this user' });
        }
      }
      directMemberIds = otherParticipants.map((participant) => participant.user_id);
    }

    // ─── Explicit business identity ───
    // Business identity requires an explicit asBusinessUserId from the client.
    // We intentionally do NOT auto-detect business identity by scanning room
    // participants. Auto-detection caused a privacy bug where team members'
    // personal messages were silently sent as the business identity whenever
    // the business happened to be a participant in the room. The client must
    // opt-in to business identity on each message send.
    // Every supported room can contain a business membership. Never silently
    // replace an explicitly chosen business sender with its staff member.
    if (asBusinessUserId) {
      const canAct = await canActAsBusiness(asBusinessUserId, userId);
      if (!canAct) {
        return res.status(403).json({ error: 'You do not have permission to message as this business' });
      }
      const { data: businessParticipant, error: businessParticipantError } = await supabaseAdmin
        .from('ChatParticipant')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', asBusinessUserId)
        .eq('is_active', true)
        .maybeSingle();

      if (businessParticipantError) throw chatAccessUnavailable();
      if (!businessParticipant) {
        return res.status(400).json({ error: 'This business is not a participant in the chat room' });
      }
      senderUserId = asBusinessUserId;
    }

    // A draft or closed business takes no messages in a direct room, whether it writes (as itself or through its
    // staff) or a person writes to it in a conversation they already have.
    if (room && room.type === 'direct') {
      const refusal = await unpublishedDirectRoomRefusal(senderUserId, directMemberIds);
      if (refusal) return res.status(403).json(refusal);
    } else if (asBusinessUserId && room.type !== 'gig') {
      // A group must not emit an unresolvable private business as its sender.
      // Existing task-owner messaging retains its separate task access rules.
      const refusal = await unpublishedDirectRoomRefusal(senderUserId, []);
      if (refusal) return res.status(403).json(refusal);
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
      if (asBusinessUserId && String(asBusinessUserId) !== String(ownerCtx.messageSenderUserId || userId)) {
        return res.status(403).json({ error: 'This business cannot send in this task chat' });
      }
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
            // The accepted last message can be retried after its response was lost.
            // Re-read here: a concurrent attempt may have committed after ownRetryRead.
            committedRetryMessage = clientMessageId ? await retryMessage(clientMessageId, roomId, senderUserId, userId) : null;
            if (!committedRetryMessage) {
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
    }
    
    // Validate and expand attachment payload.
    let attachmentPayload = [];
    if (fileIds && fileIds.length > 0) {
      const uniqueFileIds = [...new Set(fileIds.map((id) => String(id)))];
      const { data: files, error: fileErr } = await supabaseAdmin
        .from('File')
        .select('id, user_id, file_url, original_filename, mime_type, file_size, is_deleted, file_type, metadata')
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
      for (const file of validFiles) {
        const pairId = file.metadata?.live_video_file_id || file.metadata?.live_photo_file_id;
        if (pairId && (!validMap.has(pairId) || String(file.metadata?.room_id) !== String(roomId))) {
          return res.status(400).json({ error: 'Attach both Live Photo resources in their original room' });
        }
      }
      attachmentPayload = uniqueFileIds.map((fid) => {
        const f = validMap.get(String(fid));
        return {
          id: f.id,
          file_url: f.file_url,
          original_filename: f.original_filename,
          mime_type: f.mime_type,
          file_size: f.file_size,
          file_type: f.file_type,
          ...(f.metadata?.live_video_file_id ? { live_video_file_id: f.metadata.live_video_file_id } : {}),
          ...(f.metadata?.live_photo_file_id ? { live_photo_file_id: f.metadata.live_photo_file_id } : {}),
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
      if (!['direct', 'gig'].includes(room.type)) {
        return res.status(400).json({ error: 'Invalid topic for this conversation' });
      }
      const { data: topic, error: topicError } = await supabaseAdmin
        .from('ConversationTopic')
        .select('id, conversation_user_id_1, conversation_user_id_2')
        .eq('id', topicId)
        .maybeSingle();

      if (topicError) throw chatAccessUnavailable();
      if (!topic) {
        return res.status(400).json({ error: 'Invalid topic for this conversation' });
      }

      // Topics belong to the displayed conversation pair. A staff member's
      // personal topic cannot be sent as the business, or into another room.
      const topicUsers = [String(topic.conversation_user_id_1), String(topic.conversation_user_id_2)];
      if (!topicUsers.includes(String(senderUserId))) {
        return res.status(400).json({ error: 'Invalid topic for this conversation' });
      }
      const { data: topicMembers, error: topicMembersError } = await supabaseAdmin
        .from('ChatParticipant')
        .select('user_id')
        .eq('room_id', roomId)
        .in('user_id', topicUsers)
        .eq('is_active', true)
        .is('left_at', null);
      if (topicMembersError) throw chatAccessUnavailable();
      if (new Set((topicMembers || []).map((member) => String(member.user_id))).size !== 2) {
        return res.status(400).json({ error: 'Invalid topic for this conversation' });
      }
    }

    const findRetryMessage = () => retryMessage(clientMessageId, roomId, senderUserId, userId);
    const ownSender = String(senderUserId) === String(userId);
    // Read alongside the write: the reply and the room hear the sender as the chat list names them.
    const senderPeople = ownSender && ownPeopleRead ? ownPeopleRead.then(settled) : loadChatPeople([senderUserId]);
    senderPeople.catch(() => {}); // awaited below; a failure surfaces there
    if (clientMessageId) {
      const existingMsg = committedRetryMessage || (ownSender && ownRetryRead ? settled(await ownRetryRead) : await findRetryMessage());
      if (existingMsg) return res.json({ message: serializeChatMessageForViewer(existingMsg, { people: await senderPeople, viewerId: userId }) });
    }

    // Insert message
    const messageData = {
      push_delivery_requested: true,
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
    const insertStartMs = Date.now();
    let { data: message, error } = await insertMessage(messageData);

    // Attachment admission is rechecked while holding its File locks in the
    // inserting transaction; a deletion can win after the earlier REST read.
    if (error?.code === 'PT400' && String(error.message || '').trim() === 'CHAT_FILE_UNAVAILABLE') {
      return res.status(400).json({ error: 'One or more attached files are invalid or not owned by you' });
    }
    // Membership can change between topic preflight and the inserting
    // transaction. Never retry a refused binding through the legacy fallbacks.
    if (error?.code === 'PT400' && String(error.message || '').trim() === 'CHAT_TOPIC_SCOPE_INVALID') {
      return res.status(400).json({ error: 'Invalid topic for this conversation' });
    }
    // These checks share the inserting transaction with the room revision and
    // sender membership locks. Never retry a revoked send or deleted reply via
    // a legacy payload fallback after its earlier REST preflight succeeded.
    if (error?.code === 'PT403' && String(error.message || '').trim() === 'CHAT_WRITER_NOT_MEMBER') {
      return res.status(403).json({ error: 'Not a participant' });
    }
    if (error?.code === 'PT400' && String(error.message || '').trim() === 'CHAT_REPLY_SCOPE_INVALID') {
      return res.status(400).json({ error: 'Reply target not found in this room' });
    }

    // The database re-decides direct-room admission inside the inserting
    // transaction (20260916010000_direct_message_block_admission): the isBlocked
    // pre-check above and this insert are separate PostgREST transactions, so a
    // block can commit between them. Returning here — ahead of the legacy
    // fallbacks below — guarantees a denied send is never re-attempted with a
    // stripped payload, and the response body is byte-identical to the
    // pre-check denial so the race is indistinguishable from losing it.
    if (error?.code === 'PT403' && /^DIRECT_MESSAGE_(BLOCKED|ACTOR_INVALID)$/.test(String(error.message || '').trim())) {
      incCounter('chat.message.send_failed');
      logger.warn('message_send_blocked_at_persistence', { requestId, roomId, userId, senderUserId, durationMs: Date.now() - sendStartMs });
      return res.status(403).json({ error: 'Unable to message this user' });
    }

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

    if (error?.code === 'PT403' && error.message === 'PLAN_CHAT_CLOSED') {
      return res.status(403).json({ error: 'This chat has closed.', code: 'ROOM_INACTIVE' });
    }
    if (error?.code === '23505' && clientMessageId) {
      // A concurrent same-scope insert may have won after the initial lookup.
      const existingMsg = await findRetryMessage();
      if (existingMsg) return res.json({ message: serializeChatMessageForViewer(existingMsg, { people: await senderPeople, viewerId: userId }) });
      return res.status(409).json({ error: 'Message retry key is already in use' });
    }

    if (error) {
      incCounter('chat.message.send_failed');
      logger.error('Error sending message', { requestId, roomId, userId, type: resolvedType, durationMs: Date.now() - sendStartMs, error: error.message });
      return res.status(500).json({ error: 'Failed to send message' });
    }

    const insertedMs = Date.now();
    const people = await senderPeople;
    // Realtime delivery is announced synchronously inside deliverNewMessage; the sender's
    // acceptance doesn't also wait for the badge-recipient read and push hand-off after it.
    deliverNewMessage(req.app.get('io'), { room, message, actorUserId: userId, senderUserId, requestId, people })
      .catch((deliveryError) => logger.warn('chat_delivery_after_accept_failed', { requestId, roomId, code: deliveryError.code }));

    const sendDurationMs = Date.now() - sendStartMs;
    incCounter('chat.message.sent', { room_type: room?.type || 'unknown' });
    recordHistogram('chat.message.send_latency_ms', sendDurationMs);
    recordHistogram('chat.message.insert_latency_ms', insertedMs - insertStartMs);
    logger.info('message_send_complete', { requestId, roomId, userId, senderUserId, messageId: message.id, durationMs: sendDurationMs,
      checksMs: insertStartMs - sendStartMs, insertMs: insertedMs - insertStartMs });

    res.status(201).json({ message: serializeChatMessageForViewer(message, { people, viewerId: userId }) });
    
  } catch (err) {
    if (err.code === 'BLOCK_CHECK_UNAVAILABLE') return res.status(503).json({ error: err.message, code: err.code });
    if (err.code === 'CHAT_UNAVAILABLE') return res.status(503).json({ error: err.message, code: err.code });
    logger.error('Message send error', { requestId: req.requestId, roomId: req.body.roomId, userId: req.user?.id, error: err.message });
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
    
    // Verify ownership: the person who wrote it, for themselves or for a business they still act for.
    const { data: message } = await supabaseAdmin
      .from('ChatMessage')
      .select('user_id, actor_user_id, room_id')
      .eq('id', messageId)
      .single();

    const writerIdentities = await messageWriterIdentities(message, userId);
    if (!writerIdentities) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    // Someone who left or was removed can no longer rewrite what they said there (a delete still goes through).
    // A business's message already needs the business's active membership (messageWriterIdentities).
    if (writerIdentities.length === 0) {
      const { data: membership, error: membershipError } = await supabaseAdmin.from('ChatParticipant')
        .select('id').eq('room_id', message.room_id).eq('user_id', userId).eq('is_active', true).maybeSingle();
      if (membershipError) throw chatAccessUnavailable();
      if (!membership) return res.status(403).json({ error: 'Not authorized' });
    }
    if (await isGigRoomClosedTo(message.room_id, userId, writerIdentities)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (await isRoomClosedForWrites(message.room_id)) {
      return res.status(403).json({ error: 'This chat has closed.', code: 'ROOM_INACTIVE' });
    }
    // An edit writes too: not in a direct room with a draft or closed business (a delete still goes through).
    const unpublishedRefusal = await unpublishedRoomRefusal(message.room_id, message.user_id);
    if (unpublishedRefusal) return res.status(403).json(unpublishedRefusal);

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

    if (error?.code === 'PT403' && error.message === 'PLAN_CHAT_CLOSED') {
      return res.status(403).json({ error: 'This chat has closed.', code: 'ROOM_INACTIVE' });
    }
    if (error) {
      logger.error('Error editing message', { requestId: req.requestId, userId: req.user?.id, messageId, error: error.message });
      return res.status(500).json({ error: 'Failed to edit message' });
    }

    incCounter('chat.message.edited');
    // The edited row names its sender as the room's messages do, so the edit doesn't blank the bubble's name.
    const people = await loadMessageSenders([updated]);
    // Broadcast via socket
    const io = req.app.get('io');
    if (io && message.room_id) {
      chatRealtime.announce({ t: 'ChatMessage', r: message.room_id, m: messageId, op: 'UPDATE', v: updated.sync_version },
        { message: updated, people });
    }

    res.json({ message: serializeChatMessageForViewer(updated, { people, viewerId: userId }) });
    
  } catch (err) {
    if (err.code === 'CHAT_UNAVAILABLE') return res.status(503).json({ error: err.message, code: err.code });
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
      .select('id, user_id, actor_user_id, room_id, deleted, attachments')
      .eq('id', messageId)
      .single();

    if (messageErr || !message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    // The person who wrote it, for themselves or for a business they still act for.
    const writerIdentities = await messageWriterIdentities(message, userId);
    if (!writerIdentities) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (await isGigRoomClosedTo(message.room_id, userId, writerIdentities)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    // A deleted message's files go with it: the file route answers 410 for a deleted file, so the
    // other people in the chat can't open them from an old link either. They go first: the message is
    // deleted only once all of them are, so a failure leaves it in place and a repeat delete finishes it.
    const fileIds = [...new Set((Array.isArray(message.attachments) ? message.attachments : [])
      .map((attachment) => attachment?.id).filter((id) => typeof id === 'string'))];
    for (const fileId of fileIds) {
      const { data, error } = await supabaseAdmin.rpc('soft_delete_file', { p_file_id: fileId, p_user_id: userId });
      if (error || (!data?.success && data?.error !== 'File not found or already deleted')) {
        logger.error('Chat attachment delete failed', { requestId: req.requestId, messageId, fileId, error: error?.message || data?.error });
        return res.status(503).json({ error: "Couldn't delete this message's files. Please try again." });
      }
    }

    if (message.deleted) {
      return res.json({ message: 'Message deleted successfully' });
    }

    const { data: deletedMessage, error: softDeleteErr } = await supabaseAdmin
      .from('ChatMessage')
      .update({
        deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq('id', messageId).select('sync_version').single();

    if (softDeleteErr) {
      logger.error('Chat message soft-delete failed', { requestId: req.requestId, userId: req.user?.id, messageId, error: softDeleteErr.message });
      return res.status(500).json({ error: 'Failed to delete message' });
    }

    incCounter('chat.message.deleted');

    // Broadcast via socket
    const io = req.app.get('io');
    if (io && message.room_id) {
      chatRealtime.announce({ t: 'ChatMessage', r: message.room_id, m: messageId, op: 'DELETE', v: deletedMessage.sync_version });
    }

    res.json({ message: 'Message deleted successfully', sync_version: deletedMessage.sync_version });
    
  } catch (err) {
    logger.error('Message delete error', { requestId: req.requestId, userId: req.user?.id, messageId: req.params.messageId, error: err.message });
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

/**
 * POST /api/chat/rooms/:roomId/read
 * Mark messages as read
 */
router.post(['/rooms/:roomId/read', '/rooms/:roomId/topics/:topicId/read'], verifyToken, async (req, res) => {
  const requestAt = new Date().toISOString();
  try {
    const { roomId } = req.params;
    if (req.body?.topicId !== undefined) return res.status(400).json({ error: 'Use the topic read route' });
    if (req.params.topicId && Joi.string().uuid().validate(req.params.topicId).error) {
      return res.status(400).json({ error: 'Invalid topic' });
    }
    const roomIdStr = String(roomId || '');
    const userId = req.user.id;
    const asBusinessUserId = req.body?.asBusinessUserId ? String(req.body.asBusinessUserId) : null;
    let readTargetUserId = userId;

    // "new" is a client-side placeholder route, not a persisted room.
    // Treat invalid room IDs as a no-op instead of a server error.
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(roomIdStr)) {
      if (req.params.topicId) return res.status(400).json({ error: 'Invalid room' });
      return res.json({ unreadCount: 0 });
    }

    if (asBusinessUserId) {
      const businessRow = await businessMembership(roomIdStr, userId, asBusinessUserId);
      if (!businessRow) return res.status(403).json({ error: 'Access denied' });
      readTargetUserId = asBusinessUserId;
    }

    if (await gigRoomClosed(roomIdStr, userId, asBusinessUserId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Reading for a business marks the business's row read: the reader isn't a member of its conversations.
    const usersToClear = [String(readTargetUserId)];

    const result = await markChatRead({ roomIds: [roomIdStr], userId: readTargetUserId,
      topicId: req.params.topicId,
      throughMessageId: req.body?.throughMessageId, throughMessageIds: req.body?.throughMessageIds,
      requestAt, io: req.app.get('io') });
    if (result.error) {
      const status = result.error.code === '22023' ? 400 : result.error.code === '42501' ? 403 : 500;
      return res.status(status).json({ error: status === 400 ? 'Invalid read cursor' : 'Failed to mark messages as read' });
    }
    badgeService.emitBadgeUpdateToMany(usersToClear);
    if (result.unreadCount === 0) await readBusinessNotices(userId, asBusinessUserId, [roomIdStr]);
    res.json({ unreadCount: result.unreadCount,
      ...(req.params.topicId ? { topicId: req.params.topicId, readScope: 'topic' } : {}) });
    
  } catch (err) {
    logger.error('Mark read error', { requestId: req.requestId, userId: req.user?.id, error: err.message });
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// Mute is a server preference so another device and background push agree with
// the existing inbox menu. Person preferences cover the pair's future task rooms.
router.get('/conversations/:otherUserId/preferences', verifyToken, async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const asBusinessUserId = req.query.asBusinessUserId ? String(req.query.asBusinessUserId) : null;
    if (Joi.string().uuid().validate(otherUserId).error || (asBusinessUserId && Joi.string().uuid().validate(asBusinessUserId).error)) {
      return res.status(400).json({ error: 'Invalid person' });
    }
    const roomIds = await personChatRoomIds(req.user.id, otherUserId, asBusinessUserId);
    if (!roomIds.length) return res.status(404).json({ error: 'Conversation not found' });
    const identity = asBusinessUserId || req.user.id;
    const [preferences, participants] = await Promise.all([
      supabaseAdmin.from('UserNotificationPreferences').select('chat_muted_user_ids').eq('user_id', identity).maybeSingle(),
      readChatRoomBatches(roomIds, (ids) => supabaseAdmin.from('ChatParticipant')
        .select('notifications_enabled').eq('user_id', identity).in('room_id', ids).eq('is_active', true)),
    ]);
    if (preferences.error) throw preferences.error;
    const muted = (preferences.data?.chat_muted_user_ids || []).includes(otherUserId);
    res.set('Cache-Control', 'private, no-store');
    return res.json({ notificationsEnabled: !muted && participants.some((p) => p.notifications_enabled !== false), roomIds });
  } catch (error) {
    logger.warn('chat_preferences_read_failed', { requestId: req.requestId, code: error.code });
    return res.status(error.status || 503).json({ error: 'Could not load chat preferences' });
  }
});

router.get('/rooms/:roomId/preferences', verifyToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const asBusinessUserId = req.query.asBusinessUserId ? String(req.query.asBusinessUserId) : null;
    if (Joi.string().uuid().validate(roomId).error || (asBusinessUserId && Joi.string().uuid().validate(asBusinessUserId).error)) {
      return res.status(400).json({ error: 'Invalid room' });
    }
    if (asBusinessUserId && !await canActAsBusiness(asBusinessUserId, req.user.id)) return res.status(403).json({ error: 'Access denied' });
    const participant = await roomMembership(roomId, req.user.id, asBusinessUserId, { activeOnly: true });
    if (!participant || (asBusinessUserId && participant.user_id !== asBusinessUserId)
      || await gigRoomClosed(roomId, req.user.id, asBusinessUserId)) return res.status(403).json({ error: 'Access denied' });
    res.set('Cache-Control', 'private, no-store');
    return res.json({ notificationsEnabled: participant.notifications_enabled !== false, roomIds: [roomId] });
  } catch (error) {
    logger.warn('chat_preferences_read_failed', { requestId: req.requestId, code: error.code });
    return res.status(503).json({ error: 'Could not load chat preferences' });
  }
});

router.patch('/conversations/:otherUserId/preferences', verifyToken, validate(chatPreferencesSchema), async (req, res) => {
  try {
    const { otherUserId } = req.params;
    if (Joi.string().uuid().validate(otherUserId).error) return res.status(400).json({ error: 'Invalid person' });
    const { notificationsEnabled, asBusinessUserId } = req.body;
    const targetUserId = asBusinessUserId || req.user.id;
    if (asBusinessUserId && !await canActAsBusiness(asBusinessUserId, req.user.id)) return res.status(403).json({ error: 'Access denied' });
    if (targetUserId === otherUserId) return res.status(400).json({ error: 'Invalid person' });
    const roomIds = await personChatRoomIds(req.user.id, otherUserId, asBusinessUserId);
    if (!roomIds.length) return res.status(404).json({ error: 'Conversation not found' });
    const { error } = await supabaseAdmin.rpc('set_chat_notifications', {
      p_user_id: targetUserId, p_room_ids: roomIds, p_enabled: notificationsEnabled, p_other_user_id: otherUserId,
    });
    if (error) throw error;
    return res.json({ notificationsEnabled, roomIds });
  } catch (error) {
    logger.warn('chat_preferences_failed', { requestId: req.requestId, code: error.code });
    return res.status(error.status || (error.code === '42501' ? 403 : 500)).json({ error: 'Could not save chat preferences' });
  }
});

router.patch('/rooms/:roomId/preferences', verifyToken, validate(chatPreferencesSchema), async (req, res) => {
  try {
    const { roomId } = req.params;
    if (Joi.string().uuid().validate(roomId).error) return res.status(400).json({ error: 'Invalid room' });
    const { notificationsEnabled, asBusinessUserId } = req.body;
    // Explicit business authority is checked even if the caller has an old personal membership.
    if (asBusinessUserId && !await canActAsBusiness(asBusinessUserId, req.user.id)) return res.status(403).json({ error: 'Access denied' });
    const participant = await roomMembership(roomId, req.user.id, asBusinessUserId, { activeOnly: true });
    if (asBusinessUserId && participant?.user_id !== asBusinessUserId) return res.status(403).json({ error: 'Access denied' });
    if (!participant || await gigRoomClosed(roomId, req.user.id, asBusinessUserId)) return res.status(403).json({ error: 'Access denied' });
    const { error } = await supabaseAdmin.rpc('set_chat_notifications', {
      p_user_id: participant.user_id, p_room_ids: [roomId], p_enabled: notificationsEnabled,
    });
    if (error) throw error;
    return res.json({ notificationsEnabled, roomIds: [roomId] });
  } catch (error) {
    logger.warn('chat_preferences_failed', { requestId: req.requestId, code: error.code });
    return res.status(error.code === '42501' ? 403 : 500).json({ error: 'Could not save chat preferences' });
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
    if (await refusePlanRoom(roomId, res)) return;
    
    // Verify user is owner/admin
    const { data: participant } = await supabaseAdmin
      .from('ChatParticipant')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .is('left_at', null)
      .single();
    
    if (!participant || !['owner', 'admin'].includes(participant.role)) {
      return res.status(403).json({ error: 'Not authorized to add participants' });
    }
    
    const participantSelection = `*, user:user_id(id, username, name, profile_picture_url)`;
    // Keep the existing membership row when an owner adds a departed group member again.
    // Active duplicates still fail, and rejoining never restores an old admin role.
    let { data: newParticipant, error } = await supabaseAdmin
      .from('ChatParticipant')
      .insert({
        room_id: roomId,
        user_id: newUserId,
        role: 'member'
      })
      .select(participantSelection)
      .single();

    if (error?.code === '23505') {
      const { data: room, error: roomError } = await supabaseAdmin
        .from('ChatRoom').select('type').eq('id', roomId).maybeSingle();
      if (roomError) throw roomError;
      if (room?.type === 'group') {
        ({ data: newParticipant, error } = await supabaseAdmin
          .from('ChatParticipant')
          .update({ is_active: true, left_at: null, role: 'member' })
          .eq('room_id', roomId).eq('user_id', newUserId)
          .eq('is_active', false).not('left_at', 'is', null)
          .select(participantSelection).maybeSingle());
        if (!error && !newParticipant) {
          return res.status(400).json({ error: 'User is already a participant' });
        }
      }
    }
    
    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({ error: 'User is already a participant' });
      }
      logger.error('Error adding participant', { requestId: req.requestId, userId: req.user?.id, roomId, error: error.message });
      return res.status(500).json({ error: 'Failed to add participant' });
    }
    
    // Create system message. The direct-room admission gate
    // (20260916010000_direct_message_block_admission) can refuse this insert with
    // PT403 when the room is direct and a block is active. That is the intended
    // direction, but the result was previously discarded entirely, so record it:
    // the participant change itself already succeeded and must still be reported.
    // The room names the new member as the chat list does.
    const people = await loadChatPeople([newParticipant.user?.id || newUserId]);
    const added = chatPersonRow(newParticipant.user, people);
    const { error: addNoticeError } = await supabaseAdmin
      .from('ChatMessage')
      .insert({
        room_id: roomId,
        user_id: userId,
        message: `added ${added?.name || chosenUsernameOrNull(added?.username) || 'someone'}`,
        type: 'system'
      });
    if (addNoticeError) {
      logger.warn('system_message_not_recorded', {
        requestId: req.requestId, roomId, userId, kind: 'participant_added',
        blockedAtPersistence: addNoticeError.code === 'PT403', error: addNoticeError.message,
      });
    }

    res.status(201).json({ participant: serializeChatParticipantForViewer(newParticipant, people) });
    
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
    if (await refusePlanRoom(roomId, res)) return;
    
    // Check if removing self or if user is admin/owner
    const isSelf = userId === participantUserId;
    
    if (!isSelf) {
      const { data: participant } = await supabaseAdmin
        .from('ChatParticipant')
        .select('role')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .is('left_at', null)
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

    // Their open connections stop receiving the room's live messages now, not at the next reconnect.
    const io = req.app.get('io');
    const { connectedUsers } = require('../socket/chatSocketio');
    for (const socketId of connectedUsers.get(participantUserId) || []) {
      io?.sockets?.sockets?.get(socketId)?.leave(roomId);
    }
    
    // Create system message. Same admission gate as the add path above; a direct
    // room under an active block refuses this with PT403. The removal already
    // succeeded, so the denial is logged rather than surfaced to the caller.
    const { error: removeNoticeError } = await supabaseAdmin
      .from('ChatMessage')
      .insert({
        room_id: roomId,
        user_id: userId,
        message: isSelf ? 'left the chat' : `removed a participant`,
        type: 'system'
      });
    if (removeNoticeError) {
      logger.warn('system_message_not_recorded', {
        requestId: req.requestId, roomId, userId, kind: isSelf ? 'participant_left' : 'participant_removed',
        blockedAtPersistence: removeNoticeError.code === 'PT403', error: removeNoticeError.message,
      });
    }

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
    const stats = await badgeService.getChatStatistics(req.user.id);
    res.json({ stats });
  } catch (error) {
    logger.warn('Chat statistics unavailable', { requestId: req.requestId, code: error.code });
    res.status(503).json({ error: 'Chat statistics are temporarily unavailable', code: 'CHAT_UNAVAILABLE' });
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
    const lim = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
    const since = typeof req.query.since === 'string' ? req.query.since.trim() : '';
    if (since && (!/^\d{4}-\d{2}-\d{2}T/.test(since) || !Number.isFinite(Date.parse(since)))) {
      return res.status(400).json({ error: 'invalid since' });
    }
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if ((req.query.q != null && typeof req.query.q !== 'string') || query.length > 160) {
      return res.status(400).json({ error: 'Invalid inbox search' });
    }
    let before = null;
    if (req.query.before != null) {
      try {
        if (typeof req.query.before !== 'string' || req.query.before.length > 512) throw new Error();
        before = JSON.parse(Buffer.from(req.query.before, 'base64url').toString('utf8'));
        if (!before || typeof before.at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(before.at) || !Number.isFinite(Date.parse(before.at))
          || !/^(conversation|room):[0-9a-f-]{36}$/i.test(before.key || '')) throw new Error();
      } catch { return res.status(400).json({ error: 'Invalid inbox cursor' }); }
    }
    const matchingPeople = query ? await matchingInboxPeople(userId, query) : [];
    const [result, preferences] = await Promise.all([
      supabaseAdmin.rpc('get_chat_inbox_page', {
        p_user_id: userId, p_limit: lim, p_before_at: before?.at || null,
        p_before_key: before?.key || null, p_since: since || null,
        ...(query ? { p_query: query, p_matching_people: matchingPeople } : {}),
      }),
      supabaseAdmin.from('UserNotificationPreferences').select('chat_muted_user_ids').eq('user_id', userId).maybeSingle(),
    ]);
    if (result.error || preferences.error) throw result.error || preferences.error;
    const page = result.data;
    if (!page || !Array.isArray(page.entries)) throw new Error('Inbox page unavailable');
    const peopleIds = page.entries.map((entry) => entry.other_id).filter(Boolean);
    const visibleRooms = page.entries.map((entry) => entry.room).filter(Boolean);
    const trainIds = visibleRooms.map((room) => room.support_train_id).filter(Boolean);
    const [users, planStates, trains] = await Promise.all([
      peopleIds.length ? supabaseAdmin.from('User')
        .select('id, username, name, first_name, middle_name, last_name, profile_picture_url').in('id', peopleIds) : { data: [] },
      loadPlanChatStates(visibleRooms),
      trainIds.length ? supabaseAdmin.from('SupportTrain').select('id, Activity(title)').in('id', trainIds) : { data: [] },
    ]);
    if (users.error || trains.error) throw users.error || trains.error;
    const identities = await loadLocalIdentityMapForUsers(users.data || []);
    const trainTitles = new Map((trains.data || []).map((train) => [train.id, train.Activity?.title]));
    const muted = new Set(preferences.data?.chat_muted_user_ids || []);
    const conversations = page.entries.map((entry) => {
      const common = {
        total_unread: Number(entry.total_unread) || 0,
        unmuted_unread: Number(entry.unmuted_unread) || 0,
        notifications_enabled: entry.notifications_enabled && !muted.has(entry.other_id),
        last_message_at: entry.last_message_at,
        last_message_preview: getVisibleMessagePreview(entry.last_message),
        topics: entry.topics || [],
      };
      if (entry.other_id) {
        const identity = identities.get(entry.other_id);
        return { ...common, other_participant_id: entry.other_id,
          other_participant_name: identity?.displayName || null,
          other_participant_username: identity?.handle || null,
          other_participant_avatar: identity?.avatarUrl || null,
          other_participant_identity: identity || null,
          room_ids: entry.room_ids, _type: 'conversation' };
      }
      const room = entry.room;
      return { ...common, id: room.id, room_type: room.type,
        room_name: trainTitles.get(room.support_train_id) || room.name,
        description: room.description, gig_id: room.gig_id, home_id: room.home_id,
        support_train_id: room.support_train_id || null,
        last_message_at: entry.last_message_at || room.updated_at,
        _type: 'room',
        ...(room.type === 'plan' ? { plan_id: planStates.get(room.id)?.post_id || null,
          is_active: roomIsActive(room, planStates) } : {}),
      };
    });
    const last = page.entries.at(-1);
    const nextCursor = page.hasMore && last
      ? Buffer.from(JSON.stringify({ at: last.sort_at, key: last.entry_key })).toString('base64url') : null;
    recordHistogram('chat.unified_conversations.load_latency_ms', Date.now() - ucStartMs);
    res.set('Cache-Control', 'private, no-store');
    res.json({ conversations, total: Number(page.total), totalUnread: Number(page.totalUnread),
      totalUnmutedUnread: Number(page.totalUnmutedUnread),
      hasMore: page.hasMore, nextCursor });
  } catch (err) {
    logger.error('Unified conversations list error', { requestId: req.requestId, userId: req.user?.id, error: err.message });
    sendChatReadError(res, err, 'Failed to fetch conversations');
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

// ============ REACTION ENDPOINTS ============

/**
 * POST /api/chat/messages/:messageId/react
 * Add (`reacted: true`) or remove (`reacted: false`) a reaction on a message. Without `reacted`, toggle it (add if
 * absent, remove if present).
 */
router.post('/messages/:messageId/react', verifyToken, reactionLimiter, validate(reactToMessageSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const { reaction, reacted } = req.body;

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
    if (await isGigRoomClosedTo(message.room_id, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (await isRoomClosedForWrites(message.room_id)) {
      return res.status(403).json({ error: 'This chat has closed.', code: 'ROOM_INACTIVE' });
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('MessageReaction')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('reaction', reaction)
      .maybeSingle();
    if (existingError) throw existingError;

    // A repeat of the same request (a retry after a lost reply) leaves the asked-for state in place.
    const wanted = typeof reacted === 'boolean' ? reacted : !existing;
    if (existing && !wanted) {
      const { error } = await supabaseAdmin
        .from('MessageReaction')
        .delete()
        .eq('id', existing.id);
      if (error) throw error;
    } else if (!existing && wanted) {
      const { error } = await supabaseAdmin
        .from('MessageReaction')
        .insert({ message_id: messageId, user_id: userId, reaction });
      // A concurrent repeat may have inserted the requested reaction already.
      if (error && error.code !== '23505') throw error;
    }

    incCounter('chat.reaction.toggled');

    // Build updated reaction summary
    const summaryMap = await buildReactionSummary([messageId], userId);
    const reactions = summaryMap.get(messageId) || [];

    // Broadcast via socket
    const io = req.app.get('io');
    if (io) {
      const { data: current } = await supabaseAdmin.from('ChatMessage').select('sync_version').eq('id', messageId).maybeSingle();
      if (current) chatRealtime.announce({ t: 'ChatMessage', r: message.room_id, m: messageId, op: 'UPDATE', v: current.sync_version });
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
    if (await isGigRoomClosedTo(message.room_id, userId)) {
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
// Authenticated chat file download — streamed by this API
// ============================================================

// Allow auth token via query param for contexts where headers can't be set
// (e.g. React Native <Image source={{ uri }}> or <a href> downloads).
// The chat image types an upload accepts (s3Service ALLOWED_IMAGE_TYPES; never SVG): served from this API.
const STREAMED_CHAT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif']);

function tokenFromQuery(req, _res, next) {
  if (!req.headers.authorization && !req.cookies?.pantopus_access && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}

// One HTTP byte range (`bytes=a-b`, `bytes=a-`, `bytes=-n`) resolved against the file's size: a chat file's bytes never
// change under its id, so storage is only ever asked for bytes that exist (local storage hangs on a range past the end).
// Null for no range or one this API doesn't serve (the whole file then answers); `unsatisfiable` past the end.
function chatFileByteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(size) || size <= 0) return null;
  if (!match[1]) {
    const suffix = Number(match[2]);
    return suffix > 0 ? { start: Math.max(0, size - suffix), end: size - 1 } : { unsatisfiable: true };
  }
  const start = Number(match[1]);
  if (match[2] && Number(match[2]) < start) return null;
  if (start >= size) return { unsatisfiable: true };
  return { start, end: match[2] ? Math.min(Number(match[2]), size - 1) : size - 1 };
}

router.get('/files/:fileId', tokenFromQuery, verifyToken, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const userId = req.user.id;
    const { fileId } = req.params;
    const thumbnail = req.query.variant === 'thumbnail';
    if (req.query.variant !== undefined && !thumbnail) {
      return res.status(400).json({ error: 'Unknown file variant' });
    }

    // Look up the file record
    const { data: file, error: fileErr } = await supabaseAdmin
      .from('File')
      .select('id, file_path, file_url, original_filename, mime_type, file_size, metadata, is_deleted, file_type, access_count')
      .eq('id', fileId)
      .maybeSingle();

    if (fileErr) return res.status(503).json({ error: 'File access is temporarily unavailable. Please retry.' });
    if (!file) return res.status(404).json({ error: 'File not found' });

    if (file.is_deleted) {
      return res.status(410).json({ error: 'File has been deleted' });
    }

    // Determine room_id from file metadata
    const roomId = file.metadata?.room_id;
    if (!roomId) {
      return res.status(403).json({ error: 'File is not associated with a chat room' });
    }

    // Verify the requesting user is an active participant in the room, or acts for a business that is (its inbox
    // shows the room's photos; owners and staff aren't members of their business's rooms)
    const { data: participant, error: membershipError } = await supabaseAdmin
      .from('ChatParticipant')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();
    if (membershipError) return res.status(503).json({ error: 'File access is temporarily unavailable. Please retry.' });
    const actingFor = participant ? null : await actingBusinessInRoom(roomId, userId);

    if (!participant && !actingFor) {
      return res.status(403).json({ error: 'Not authorized to access this file' });
    }
    if (await isGigRoomClosedTo(roomId, userId, actingFor ? [actingFor] : [])) {
      return res.status(403).json({ error: 'Not authorized to access this file' });
    }

    // A deleted message's files are gone for everyone, from a link saved before the delete too, even where the
    // file itself wasn't marked deleted (an older delete that failed partway, or a file someone else uploaded).
    // Matched by the stored id (the path's may differ in case, which a JSON match would miss), as a JSON string:
    // supabase-js sends an array as a Postgres array literal, which a jsonb column refuses.
    const { data: deletedWith, error: deletedWithError } = await supabaseAdmin
      .from('ChatMessage')
      .select('id')
      .eq('room_id', roomId)
      .eq('deleted', true)
      .contains('attachments', JSON.stringify([{ id: file.id }]))
      .limit(1);
    if (deletedWithError) {
      logger.error('Chat file message check failed', { requestId: req.requestId, fileId, error: deletedWithError.message });
      return res.status(503).json({ error: 'File access is temporarily unavailable. Please retry.' });
    }
    if (deletedWith?.length) {
      return res.status(410).json({ error: 'File has been deleted' });
    }

    if (thumbnail && !STREAMED_CHAT_IMAGE_TYPES.has(file.mime_type)) {
      return res.status(415).json({ error: 'Thumbnails are available only for images' });
    }

    const trackAccess = () => supabaseAdmin
      .from('File')
      .update({ access_count: (file.access_count || 0) + 1, last_accessed_at: new Date().toISOString() })
      .eq('id', fileId)
      .then(() => {})
      .catch(() => {});

    // Received media belongs in each client's explicit encrypted,
    // account-scoped store. Generic HTTP/OS image caches must not retain a
    // plaintext copy that outlives sign-out or a room's access generation.
    if (STREAMED_CHAT_IMAGE_TYPES.has(file.mime_type)) {
      let object;
      try {
        if (thumbnail) {
          const buffer = await require('../services/chatThumbnails').getThumbnail(file);
          if (res.destroyed) return;
          trackAccess();
          return res.type('image/webp').set('Content-Length', String(buffer.length)).end(buffer);
        }
        object = await s3Service.getObjectStream(file.file_path);
      } catch (storageErr) {
        if (storageErr?.name === 'NoSuchKey' || storageErr?.$metadata?.httpStatusCode === 404) {
          res.set('Cache-Control', 'private, no-store');
          res.removeHeader('ETag');
          return res.status(404).json({ error: 'File not found' });
        }
        throw storageErr;
      }
      res.type(file.mime_type);
      if (Number.isSafeInteger(object.contentLength)) res.set('Content-Length', String(object.contentLength));
      trackAccess();
      return pipeline(object.body, res).catch((streamErr) => {
        logger.warn('Chat file stream ended early', { requestId: req.requestId,
          interrupted: streamErr.code === 'ERR_STREAM_PREMATURE_CLOSE' });
      });
    }

    // Videos and documents are served here too, never by a link to storage: the object's key and metadata name the
    // person who uploaded it, and in a business's rooms that is its owner or a staff member, whom the customer must not
    // learn (a business seat never exposes the person behind it). One byte range at a time, so players can seek; never
    // cached. A video plays in the page; a document downloads under its own name.
    const size = Number(file.file_size);
    const range = chatFileByteRange(req.headers.range, size);
    if (range?.unsatisfiable) return res.status(416).set('Content-Range', `bytes */${size}`).end();
    let object;
    try {
      object = await s3Service.getObjectStream(file.file_path, undefined, range ? `bytes=${range.start}-${range.end}` : undefined);
    } catch (storageErr) {
      if (storageErr?.name === 'NoSuchKey' || storageErr?.$metadata?.httpStatusCode === 404) {
        return res.status(404).json({ error: 'File not found' });
      }
      throw storageErr;
    }
    const name = file.original_filename || 'attachment';
    const disposition = String(file.mime_type).startsWith('video/') ? 'inline' : 'attachment';
    res.set({
      'Cache-Control': 'private, no-store',
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `${disposition}; filename="${name.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; `
        + `filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`,
    });
    res.type(file.mime_type || 'application/octet-stream');
    if (object.contentRange) res.status(206).set('Content-Range', object.contentRange);
    if (Number.isSafeInteger(object.contentLength)) res.set('Content-Length', String(object.contentLength));
    // A player asks for many ranges per view: count the first.
    if (!range || range.start === 0) trackAccess();
    return pipeline(object.body, res).catch((streamErr) => {
      logger.warn('Chat file stream ended early', { requestId: req.requestId,
        interrupted: streamErr.code === 'ERR_STREAM_PREMATURE_CLOSE' });
    });
  } catch (err) {
    logger.error('Chat file download error', { requestId: req.requestId,
      unavailable: err.status === 503 || err.name === 'AbortError' });
    if (res.destroyed || res.headersSent) return;
    res.set('Cache-Control', 'private, no-store');
    res.removeHeader('ETag');
    const status = err.status || (err.name === 'AbortError' ? 503 : 500);
    if (status === 503) res.set('Retry-After', '2');
    res.status(status).json({ error: status === 503 ? 'File access is temporarily unavailable. Please retry.' : 'Failed to load the file' });
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
// A Support Train organizer's reminder (routes/supportTrains.js) is delivered as a chat message.
module.exports.deliverNewMessage = deliverNewMessage;
