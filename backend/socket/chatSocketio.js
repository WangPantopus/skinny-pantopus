// ============================================================
// SOCKET.IO REAL-TIME CHAT SERVER
// Handles WebSocket connections for live chat
// ============================================================

const crypto = require('crypto');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const badgeService = require('../services/badgeService');
const notificationService = require('../services/notificationService');
const syncChangedService = require('../services/syncChangedService');
const { isBlocked, blockedUserIds } = require('../services/blockService');
const { closedGigRoomIds, isGigRoomClosedTo, isRoomClosedForWrites } = require('../services/chatGigRoomAccess');
const { setGauge } = require('../services/chatMetrics');
// Persistent login (design §6.4): the same JWT decode helper verifyToken
// exposes as `decodeSessionClaims` (verifyToken.js delegates to it), the 15-s
// session-state cache and the `session_revoked` event that kicks sockets.
const authSessionService = require('../services/authSessionService');

// Store connected users: { userId: Set<socketId> }
const connectedUsers = new Map();

// The gig room also serves public task watchers. Tracking belongs only to the
// current owner/worker and only while their authenticated socket is subscribed.
async function emitPrivateGigUpdate(io, gig, event, payload) {
  if (!io?.sockets?.sockets || !gig?.id) return;
  try {
    const { data: current, error } = await supabaseAdmin.from('Gig')
      .select('id, user_id, accepted_by').eq('id', gig.id).maybeSingle();
    if (error || !current || current.user_id !== gig.user_id
      || current.accepted_by !== gig.accepted_by) return;
    const room = `gig:${gig.id}`;
    for (const userId of new Set([current.user_id, current.accepted_by].filter(Boolean))) {
      for (const socketId of connectedUsers.get(userId) || []) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket?.connected && socket.userId === userId && socket.rooms.has(room)) {
          socket.emit(event, payload);
        }
      }
    }
  } catch (err) {
    // A missed live update can be recovered by the existing status reader.
    logger.warn('Private gig update was not delivered', { gigId: gig.id, error: err.message });
  }
}

// ============ SESSION REVOCATION → SOCKET KICK ============
// authSessionService emits 'session_revoked' {userId, sessionIds, reason}
// whenever AuthSession rows are revoked (logout with proof, device removed,
// revoke-others, lockdown, password change/reset, reuse/mismatch, account
// deletion). Sockets carrying one of those session ids are told and dropped;
// for user-wide reasons every socket of the user goes (GoTrue killed all of
// the user's JWTs anyway).

const USER_WIDE_REVOKE_REASONS = new Set(['lockdown', 'password_reset', 'account_deleted', 'global']);

function kickRevokedSessions(io, { userId, sessionIds = [], reason = 'revoked' } = {}) {
  if (!userId || !io?.sockets?.sockets) return 0;
  const socketIds = connectedUsers.get(userId);
  if (!socketIds || socketIds.size === 0) return 0;
  const revoked = new Set((sessionIds || []).filter(Boolean));
  const kickAll = USER_WIDE_REVOKE_REASONS.has(reason);
  let kicked = 0;
  for (const socketId of Array.from(socketIds)) {
    const target = io.sockets.sockets.get(socketId);
    if (!target) continue;
    const sid = target.authSessionId || null;
    if (!kickAll && !(sid && revoked.has(sid))) continue;
    try {
      target.emit('auth:session_revoked', { sessionId: sid, reason, code: 'SESSION_REVOKED' });
      target.disconnect(true);
      kicked += 1;
    } catch (err) {
      logger.warn('Socket kick failed', { userId, socketId, error: err.message });
    }
  }
  if (kicked > 0) logger.info('Sockets disconnected for revoked session', { userId, reason, kicked });
  return kicked;
}

let _revokeListener = null;
function subscribeSessionRevocation(io) {
  if (_revokeListener) authSessionService.authEvents.off('session_revoked', _revokeListener);
  _revokeListener = (payload) => {
    try {
      kickRevokedSessions(io, payload || {});
    } catch (err) {
      logger.error('Session revocation handler error', { error: err.message });
    }
  };
  authSessionService.authEvents.on('session_revoked', _revokeListener);
}

// ============ SOCKET RATE LIMITING ============
// Simple sliding-window counter per socket per event type.
// Counters are cleaned up on disconnect.

const socketRateLimits = {
  'message:react': { max: 60, windowMs: 60_000 },
  'typing:start':  { max: 10, windowMs: 60_000 },
};

// Map<socketId, Map<eventName, { count, resetAt }>>
const socketCounters = new Map();

/**
 * Returns true if the event should be REJECTED (rate exceeded).
 * Automatically initialises and resets counters per window.
 */
function socketRateLimited(socketId, eventName) {
  const limit = socketRateLimits[eventName];
  if (!limit) return false;

  if (!socketCounters.has(socketId)) {
    socketCounters.set(socketId, new Map());
  }
  const counters = socketCounters.get(socketId);
  const now = Date.now();
  let entry = counters.get(eventName);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + limit.windowMs };
    counters.set(eventName, entry);
  }

  entry.count++;
  return entry.count > limit.max;
}

function cleanupSocketCounters(socketId) {
  socketCounters.delete(socketId);
}

function emitSocketGauges() {
  setGauge('chat.socket.connected_users', connectedUsers.size);
  let total = 0;
  for (const sockets of connectedUsers.values()) total += sockets.size;
  setGauge('chat.socket.total_connections', total);
}

/**
 * Build a reaction summary for a single message.
 * Returns the same format as the REST endpoint:
 *   [{ reaction, count, users: [{ id, name }], reacted_by_me }]
 */
async function buildSocketReactionSummary(messageId, requestingUserId) {
  const { data: reactions } = await supabaseAdmin
    .from('MessageReaction')
    .select('reaction, user_id')
    .eq('message_id', messageId);

  if (!reactions || reactions.length === 0) return [];

  const userIds = [...new Set(reactions.map((r) => r.user_id))];
  const { data: users } = await supabaseAdmin
    .from('User')
    .select('id, name')
    .in('id', userIds);

  const userMap = {};
  (users || []).forEach((u) => { userMap[u.id] = u; });

  const grouped = {};
  for (const r of reactions) {
    if (!grouped[r.reaction]) grouped[r.reaction] = [];
    grouped[r.reaction].push(r.user_id);
  }

  return Object.entries(grouped).map(([reaction, uids]) => ({
    reaction,
    count: uids.length,
    users: uids.map((uid) => ({ id: uid, name: (userMap[uid] || {}).name || 'Unknown' })),
    reacted_by_me: uids.includes(requestingUserId),
  }));
}

async function buildSocketReactionSummaryMap(messageIds, requestingUserId) {
  const ids = Array.from(new Set((messageIds || []).map((id) => String(id)).filter(Boolean)));
  if (ids.length === 0) return new Map();

  const { data: reactions } = await supabaseAdmin
    .from('MessageReaction')
    .select('message_id, reaction, user_id')
    .in('message_id', ids);

  if (!reactions || reactions.length === 0) return new Map();

  const userIds = [...new Set(reactions.map((reaction) => reaction.user_id))];
  const { data: users } = await supabaseAdmin
    .from('User')
    .select('id, name')
    .in('id', userIds);

  const userMap = {};
  (users || []).forEach((user) => {
    userMap[user.id] = user;
  });

  const grouped = {};
  for (const reaction of reactions) {
    if (!grouped[reaction.message_id]) grouped[reaction.message_id] = {};
    if (!grouped[reaction.message_id][reaction.reaction]) grouped[reaction.message_id][reaction.reaction] = [];
    grouped[reaction.message_id][reaction.reaction].push(reaction.user_id);
  }

  const result = new Map();
  for (const [messageId, reactionMap] of Object.entries(grouped)) {
    result.set(messageId, Object.entries(reactionMap).map(([reaction, uids]) => ({
      reaction,
      count: uids.length,
      users: uids.map((uid) => ({ id: uid, name: (userMap[uid] || {}).name || 'Unknown' })),
      reacted_by_me: uids.includes(requestingUserId),
    })));
  }

  return result;
}

// Store user rooms: { userId: Set([roomId1, roomId2]) }
const userRooms = new Map();

// ============ PRESENCE ============
// `user:online` / `user:offline` reach only the people who share a
// conversation with the user (the chat rooms their sockets joined), and never
// anyone either of them has blocked. Everyone else never learns when someone
// comes and goes. A failed block read sends nothing; this never throws.
async function emitPresence(socket, event, userId, roomIds) {
  const rooms = Array.from(roomIds || []).filter(Boolean);
  if (rooms.length === 0) return;
  try {
    const blockedSocketIds = [];
    for (const otherUserId of await blockedUserIds(userId)) {
      for (const socketId of connectedUsers.get(otherUserId) || []) blockedSocketIds.push(socketId);
    }
    socket.to(rooms).except(blockedSocketIds).emit(event, { userId });
  } catch (err) {
    logger.warn('Presence not sent', { userId, event, error: err.message });
  }
}

module.exports = (io) => {
  // Initialize badge + notification services with io + connectedUsers references
  badgeService.init(io, connectedUsers);
  notificationService.init(io, connectedUsers);
  // Instant Screens: database changes (NOTIFY sync_changed) → 'sync:changed' to the people they concern
  syncChangedService.init(io, connectedUsers);
  syncChangedService.start();
  // Persistent login: disconnect sockets of revoked sessions
  subscribeSessionRevocation(io);
  // ============ MIDDLEWARE ============
  
  // Authenticate socket connections
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth.token;

      // Web clients using httpOnly cookies may not have a real token.
      // Fall back to the pantopus_access cookie from the handshake headers.
      if (!token || token === '__session__') {
        const cookieHeader = socket.handshake.headers.cookie || '';
        const match = cookieHeader.match(/(?:^|;\s*)pantopus_access=([^;]+)/);
        if (match) token = match[1];
      }
      
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      // Verify token with Supabase
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      
      if (error || !data.user) {
        return next(new Error('Invalid token'));
      }

      // Persistent login: decode session_id / iat (getUser already accepted the
      // token) and refuse revoked sessions / tokens older than the user's
      // sessions_valid_after watermark — same policy as verifyToken.
      const claims = authSessionService.sessionClaimsFromAccessToken(token);
      socket.authSessionId = claims?.id || null;
      if (socket.authSessionId) {
        const state = await authSessionService.getSessionStateCached(socket.authSessionId);
        if (state.known && state.revoked) {
          logger.info('Socket auth refused: session revoked', { userId: data.user.id, sessionId: socket.authSessionId });
          return next(new Error('Session revoked'));
        }
      }
      if (typeof claims?.iat === 'number') {
        const watermark = await authSessionService.getSessionsValidAfter(data.user.id);
        if (watermark && claims.iat * 1000 < watermark.getTime()) {
          logger.info('Socket auth refused: token before watermark', { userId: data.user.id, sessionId: socket.authSessionId });
          return next(new Error('Session revoked'));
        }
      }
      
      // Attach user to socket
      socket.userId = data.user.id;
      socket.userEmail = data.user.email;
      
      next();
    } catch (err) {
      logger.error('Socket auth error', { error: err.message });
      next(new Error('Authentication failed'));
    }
  });
  
  // ============ CONNECTION HANDLER ============
  
  io.on('connection', async (socket) => {
    const userId = socket.userId;
    socket.sessionId = crypto.randomUUID();
    const sessionId = socket.sessionId;
    const existingSockets = connectedUsers.get(userId);
    const wasOnline = Boolean(existingSockets && existingSockets.size > 0);

    logger.info('User connected to chat', {
      sessionId,
      userId,
      socketId: socket.id,
    });
    
    // Track connected socket for this user
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId).add(socket.id);
    emitSocketGauges();

    // Load user's rooms and join them. Started here but awaited only at the end of
    // this handler: the event handlers below must be registered before the
    // client's first events arrive (clients emit room:join as soon as they
    // connect), or socket.io drops those events.
    const initialRoomsLoad = (async () => {
      try {
        const { data: rooms, error } = await supabaseAdmin.rpc('get_user_chat_rooms', {
          p_user_id: userId,
          p_limit: 100
        });

        if (!error && rooms) {
          const roomIds = userRooms.get(userId) || new Set();
          // A leftover member of an assigned task's gig room doesn't join it or get its preview.
          let closedRoomIds;
          try {
            closedRoomIds = await closedGigRoomIds(rooms, userId);
          } catch (accessErr) {
            logger.warn('gig_room_access_unavailable_on_connect', { sessionId, userId, error: accessErr.message });
            closedRoomIds = new Set(rooms.filter((r) => r.room_type === 'gig').map((r) => String(r.id)));
          }
          const openRooms = rooms.filter((r) => !closedRoomIds.has(String(r.id)));

          for (const room of openRooms) {
            // get_user_chat_rooms returns the room id as `id`.
            const roomId = room.id;
            socket.join(roomId);
            roomIds.add(roomId);

            logger.info('User joined room', { sessionId, userId, roomId, roomType: room.room_type });
          }

          userRooms.set(userId, roomIds);

          // Send initial room list
          socket.emit('rooms:list', openRooms);

          // Notify user is online only when first active socket connects, and
          // only to the conversations it just joined (see emitPresence).
          if (!wasOnline && socket.connected) {
            await emitPresence(socket, 'user:online', userId, openRooms.map((room) => room.id));
          }
        }
      } catch (err) {
        logger.error('Error loading user rooms', { sessionId, userId, error: err.message });
      }
    })();

    // Send initial badge counts immediately on connect
    badgeService.emitBadgeUpdate(userId);
    
    // Every event's arguments come from the client. Hand each handler an object payload and a callable ack, and keep
    // its errors here: app.js exits the API on any uncaught exception or unhandled rejection.
    const on = (event, handler) => socket.on(event, (...args) => {
      const last = args[args.length - 1];
      const ack = typeof last === 'function' ? last : () => {};
      const payload = args[0] !== null && typeof args[0] === 'object' ? args[0] : {};
      // The executor turns a synchronous throw into a rejection too; the returned promise never rejects.
      return new Promise((resolve) => { resolve(handler(payload, ack)); })
        .catch((err) => logger.error('Socket event failed', { sessionId, userId, event, error: err?.message }));
    });

    // ============ GIG DETAIL ROOMS ============

    // Join a gig detail room for real-time updates
    on('gig:join', ({ gigId }) => {
      if (!gigId) return;
      const room = `gig:${gigId}`;
      socket.join(room);
      logger.info('User joined gig room', { sessionId, userId, gigId, room });
    });

    // Leave a gig detail room
    on('gig:leave', ({ gigId }) => {
      if (!gigId) return;
      const room = `gig:${gigId}`;
      socket.leave(room);
      logger.info('User left gig room', { sessionId, userId, gigId, room });
    });

    // ============ EVENT HANDLERS ============

    /**
     * Join a specific room
     */
    on('room:join', async ({ roomId }, callback) => {
      try {
        // Verify user has access to room
        const { data: participant } = await supabaseAdmin
          .from('ChatParticipant')
          .select('*')
          .eq('room_id', roomId)
          .eq('user_id', userId)
          .eq('is_active', true)
          .single();
        
        if (!participant) {
          return callback({ error: 'Access denied' });
        }
        if (await isGigRoomClosedTo(roomId, userId)) {
          return callback({ error: 'Access denied' });
        }
        
        socket.join(roomId);
        
        // Track room
        if (!userRooms.has(userId)) {
          userRooms.set(userId, new Set());
        }
        userRooms.get(userId).add(roomId);
        
        logger.info('User joined room', { sessionId, userId, roomId });
        
        // Load recent messages
        const { data: messages } = await supabaseAdmin
          .from('ChatMessage')
          .select(`
            *,
            sender:user_id (
              id,
              username,
              name,
              profile_picture_url
            )
          `)
          .eq('room_id', roomId)
          .eq('deleted', false)
          .order('created_at', { ascending: false })
          .limit(50);
        const backfill = (messages || []).reverse();
        const reactionMap = await buildSocketReactionSummaryMap(backfill.map((message) => message.id), userId);

        callback({
          success: true,
          messages: backfill.map((message) => ({
            ...message,
            reactions: reactionMap.get(String(message.id)) || [],
          })),
          roomId
        });
        
        // Mark messages as read
        await supabaseAdmin.rpc('mark_messages_read', {
          p_room_id: roomId,
          p_user_id: userId
        });
        
        // Notify room that user joined
        // Ids only: the first part of the person's email address is not for the other members to see.
        socket.to(roomId).emit('user:joined', { 
          userId, 
          roomId
        });
        
      } catch (err) {
        logger.error('Room join error', { sessionId, userId, roomId, error: err.message });
        callback({ error: 'Failed to join room' });
      }
    });
    
    // Note: message:send is handled via REST (POST /api/chat/messages) which
    // broadcasts message:new to the room after insert. Both web and mobile
    // clients use the REST endpoint exclusively.

    /**
     * Typing indicator
     */
    on('typing:start', async ({ roomId }) => {
      try {
        if (socketRateLimited(socket.id, 'typing:start')) return;

        // Verify the socket has joined this room (room:join checks membership)
        if (!socket.rooms.has(roomId)) {
          return;
        }

        // Insert/update typing indicator
        await supabaseAdmin
          .from('ChatTyping')
          .upsert({
            room_id: roomId,
            user_id: userId,
            started_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 10000).toISOString()
          });

        // Broadcast to room (except sender)
        socket.to(roomId).emit('typing:user', {
          userId,
          roomId
        });

      } catch (err) {
        logger.error('Typing indicator error', { sessionId, userId, roomId, error: err.message });
      }
    });

    /**
     * Stop typing
     */
    on('typing:stop', async ({ roomId }) => {
      try {
        // Verify the socket has joined this room
        if (!socket.rooms.has(roomId)) {
          return;
        }

        await supabaseAdmin
          .from('ChatTyping')
          .delete()
          .eq('room_id', roomId)
          .eq('user_id', userId);

        socket.to(roomId).emit('typing:stopped', { userId, roomId });

      } catch (err) {
        logger.error('Stop typing error', { sessionId, userId, roomId, error: err.message });
      }
    });
    
    /**
     * Mark messages as read
     */
    on('messages:read', async ({ roomId }, callback) => {
      try {
        // Verify the socket has joined this room
        if (!socket.rooms.has(roomId)) {
          return callback({ error: 'Not in room' });
        }

        // Room-level mark-as-read: zero unread count and update last_read_at.
        // Matches the REST endpoint POST /api/chat/rooms/:roomId/read.
        const { error } = await supabaseAdmin
          .from('ChatParticipant')
          .update({
            unread_count: 0,
            last_read_at: new Date().toISOString()
          })
          .eq('room_id', roomId)
          .eq('user_id', userId);

        if (error) {
          logger.error('Mark read error', { sessionId, userId, roomId, error: error.message });
          return callback({ error: 'Failed to mark as read' });
        }

        // Notify room of read receipt
        socket.to(roomId).emit('messages:read', {
          userId,
          roomId,
          readAt: new Date().toISOString()
        });

        // Update the reader's own badge counts (unread decreased)
        badgeService.emitBadgeUpdate(userId);

        callback({ success: true });

      } catch (err) {
        logger.error('Mark read error', { sessionId, userId, roomId, error: err.message });
        callback({ error: 'Failed to mark as read' });
      }
    });
    
    // Note: message:delete is handled via REST (DELETE /api/chat/messages/:id)
    // which broadcasts message:deleted to the room after soft-delete. Both web
    // and mobile clients use the REST endpoint exclusively.

    /**
     * Add (`reacted: true`) or remove (`reacted: false`) a reaction on a message; without `reacted`, toggle it.
     * Emits 'message:reaction_updated' with full reaction summary — same
     * format as the REST POST /messages/:messageId/react endpoint.
     */
    on('message:react', async ({ messageId, reaction, reacted }, callback) => {
      try {
        if (socketRateLimited(socket.id, 'message:react')) {
          return callback({ error: 'Rate limit exceeded' });
        }
        // The REST route's rules (reactToMessageSchema): a reaction is a string of 1 to 8 characters, and `reacted`
        // is a boolean when present.
        if (typeof reaction !== 'string' || reaction.length === 0 || reaction.length > 8
          || (reacted !== undefined && typeof reacted !== 'boolean')) {
          return callback({ error: 'Invalid reaction' });
        }

        // Verify message exists and is not deleted
        const { data: message, error: msgErr } = await supabaseAdmin
          .from('ChatMessage')
          .select('id, room_id')
          .eq('id', messageId)
          .eq('deleted', false)
          .maybeSingle();

        if (msgErr || !message) {
          return callback({ error: 'Message not found' });
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
          return callback({ error: 'Not authorized' });
        }
        if (await isGigRoomClosedTo(message.room_id, userId)) {
          return callback({ error: 'Not authorized' });
        }
        if (await isRoomClosedForWrites(message.room_id)) {
          return callback({ error: 'This chat has closed.', code: 'ROOM_INACTIVE' });
        }

        const { data: existing } = await supabaseAdmin
          .from('MessageReaction')
          .select('id')
          .eq('message_id', messageId)
          .eq('user_id', userId)
          .eq('reaction', reaction)
          .maybeSingle();

        // A repeat of the same request (a retry after a lost reply) leaves the asked-for state in place.
        const wanted = typeof reacted === 'boolean' ? reacted : !existing;
        if (existing && !wanted) {
          await supabaseAdmin
            .from('MessageReaction')
            .delete()
            .eq('id', existing.id);
        } else if (!existing && wanted) {
          const { error: insertErr } = await supabaseAdmin
            .from('MessageReaction')
            .insert({ message_id: messageId, user_id: userId, reaction });
          // 23505: the same reaction landed at the same moment (a concurrent repeat), which is the state asked for.
          if (insertErr && insertErr.code !== '23505') {
            logger.error('Insert reaction error', { sessionId, userId, messageId, error: insertErr.message });
            return callback({ error: 'Failed to add reaction' });
          }
        }

        // Build reaction summary (same format as REST endpoint)
        const reactions = await buildSocketReactionSummary(messageId, userId);

        io.to(message.room_id).emit('message:reaction_updated', { messageId, reactions });
        callback({ success: true, reactions });

      } catch (err) {
        logger.error('Toggle reaction error', { sessionId, userId, messageId, error: err.message });
        callback({ error: 'Failed to toggle reaction' });
      }
    });

    /**
     * Remove a specific reaction by ID.
     * Kept for backwards compatibility — prefer message:react toggle instead.
     * Now emits 'message:reaction_updated' (same event as message:react).
     */
    on('message:unreact', async ({ reactionId }, callback) => {
      try {
        // Get reaction details before deleting
        const { data: reactionRow } = await supabaseAdmin
          .from('MessageReaction')
          .select('id, message_id, user_id, reaction')
          .eq('id', reactionId)
          .eq('user_id', userId)
          .maybeSingle();

        if (!reactionRow) {
          return callback({ error: 'Reaction not found' });
        }

        await supabaseAdmin
          .from('MessageReaction')
          .delete()
          .eq('id', reactionId);

        // Get room ID for broadcast
        const { data: message } = await supabaseAdmin
          .from('ChatMessage')
          .select('room_id')
          .eq('id', reactionRow.message_id)
          .maybeSingle();

        if (message) {
          const reactions = await buildSocketReactionSummary(reactionRow.message_id, userId);
          io.to(message.room_id).emit('message:reaction_updated', {
            messageId: reactionRow.message_id,
            reactions,
          });
        }

        callback({ success: true });

      } catch (err) {
        logger.error('Remove reaction error', { sessionId, userId, reactionId, error: err.message });
        callback({ error: 'Failed to remove reaction' });
      }
    });
    
    /**
     * Create direct chat
     */
    on('chat:create_direct', async ({ otherUserId }, callback) => {
      try {
        // Block check: prevent direct chat creation between blocked users
        if (await isBlocked(userId, otherUserId)) {
          return callback({ error: 'Unable to message this user' });
        }

        const { data: roomId, error } = await supabaseAdmin.rpc('get_or_create_direct_chat', {
          p_user_id_1: userId,
          p_user_id_2: otherUserId
        });
        
        if (error) {
          return callback({ error: 'Failed to create chat' });
        }
        
        // Join room
        socket.join(roomId);
        
        if (!userRooms.has(userId)) {
          userRooms.set(userId, new Set());
        }
        userRooms.get(userId).add(roomId);
        
        // Notify other user's active sockets (if online)
        const otherSocketIds = connectedUsers.get(otherUserId);
        if (otherSocketIds && otherSocketIds.size > 0) {
          for (const otherSocketId of otherSocketIds) {
            io.to(otherSocketId).socketsJoin(roomId);
            io.to(otherSocketId).emit('chat:new', { roomId, fromUserId: userId });
          }
        }
        
        callback({ success: true, roomId });
        
      } catch (err) {
        if (err.code === 'BLOCK_CHECK_UNAVAILABLE') return callback({ error: err.message, code: err.code });
        logger.error('Create direct chat error', { sessionId, userId, otherUserId, error: err.message });
        callback({ error: 'Failed to create chat' });
      }
    });
    
    // ============ DISCONNECTION ============
    
    socket.on('disconnect', async () => {
      cleanupSocketCounters(socket.id);
      const socketIds = connectedUsers.get(userId);
      if (socketIds) {
        socketIds.delete(socket.id);
        if (socketIds.size === 0) {
          connectedUsers.delete(userId);
        }
      }
      emitSocketGauges();
      const stillOnline = connectedUsers.has(userId);

      logger.info('User disconnected from chat', {
        sessionId,
        userId,
        socketId: socket.id,
      });
      
      // The conversations to tell, captured before the user's rooms are forgotten.
      const presenceRooms = stillOnline ? null : userRooms.get(userId);
      if (!stillOnline) {
        userRooms.delete(userId);
      }
      
      // Clean up typing indicators
      try {
        await supabaseAdmin
          .from('ChatTyping')
          .delete()
          .eq('user_id', userId);
      } catch (err) {
        logger.error('Error cleaning typing indicators', { sessionId, userId, error: err.message });
      }
      
      // Notify user is offline only when last socket disconnects (and no new
      // one connected while the typing rows were cleaned up)
      if (!stillOnline && !connectedUsers.has(userId)) {
        await emitPresence(socket, 'user:offline', userId, presenceRooms);
      }
    });
    
    // ============ ERROR HANDLER ============
    
    socket.on('error', (error) => {
      logger.error('Socket error', { sessionId, userId, error: error.message });
    });

    await initialRoomsLoad;
  });
  
  // ============ PERIODIC CLEANUP ============
  
  // Clean up expired typing indicators every 30 seconds
  const typingCleanupInterval = setInterval(async () => {
    try {
      const { data: deletedCount } = await supabaseAdmin.rpc('cleanup_expired_typing');
      if (deletedCount > 0) {
        logger.info('Cleaned up expired typing indicators', { count: deletedCount });
      }
    } catch (err) {
      logger.error('Typing cleanup error', { error: err.message });
    }
  }, 30000);
  if (typeof typingCleanupInterval.unref === 'function') {
    typingCleanupInterval.unref();
  }
  
  logger.info('Socket.IO chat server initialized');
};

// Exposed for tests / other services
module.exports.kickRevokedSessions = kickRevokedSessions;
module.exports.connectedUsers = connectedUsers;
module.exports.emitPrivateGigUpdate = emitPrivateGigUpdate;
