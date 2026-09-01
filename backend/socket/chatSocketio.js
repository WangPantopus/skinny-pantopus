// ============================================================
// SOCKET.IO REAL-TIME CHAT SERVER
// Handles WebSocket connections for live chat
// ============================================================

const crypto = require('crypto');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const badgeService = require('../services/badgeService');
const notificationService = require('../services/notificationService');
const { isBlocked } = require('../services/blockService');
const { setGauge } = require('../services/chatMetrics');

// Store connected users: { userId: Set<socketId> }
const connectedUsers = new Map();

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

module.exports = (io) => {
  // Initialize badge + notification services with io + connectedUsers references
  badgeService.init(io, connectedUsers);
  notificationService.init(io, connectedUsers);
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

    // Load user's rooms and join them
    try {
      const { data: rooms, error } = await supabaseAdmin.rpc('get_user_chat_rooms', {
        p_user_id: userId,
        p_limit: 100
      });
      
      if (!error && rooms) {
        const roomIds = new Set();
        
        for (const room of rooms) {
          const roomId = room.room_id;
          socket.join(roomId);
          roomIds.add(roomId);
          
          logger.info('User joined room', { sessionId, userId, roomId, roomType: room.room_type });
        }
        
        userRooms.set(userId, roomIds);
        
        // Send initial room list
        socket.emit('rooms:list', rooms);
      }
    } catch (err) {
      logger.error('Error loading user rooms', { sessionId, userId, error: err.message });
    }

    // Send initial badge counts immediately on connect
    badgeService.emitBadgeUpdate(userId);

    // Notify user is online only when first active socket connects
    if (!wasOnline) {
      socket.broadcast.emit('user:online', { userId });
    }
    
    // ============ GIG DETAIL ROOMS ============

    // Join a gig detail room for real-time updates
    socket.on('gig:join', ({ gigId }) => {
      if (!gigId) return;
      const room = `gig:${gigId}`;
      socket.join(room);
      logger.info('User joined gig room', { sessionId, userId, gigId, room });
    });

    // Leave a gig detail room
    socket.on('gig:leave', ({ gigId }) => {
      if (!gigId) return;
      const room = `gig:${gigId}`;
      socket.leave(room);
      logger.info('User left gig room', { sessionId, userId, gigId, room });
    });

    // ============ EVENT HANDLERS ============

    /**
     * Join a specific room
     */
    socket.on('room:join', async ({ roomId }, callback) => {
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
        socket.to(roomId).emit('user:joined', { 
          userId, 
          roomId,
          username: socket.userEmail.split('@')[0]
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
    socket.on('typing:start', async ({ roomId }) => {
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
          roomId,
          username: socket.userEmail.split('@')[0]
        });

      } catch (err) {
        logger.error('Typing indicator error', { sessionId, userId, roomId, error: err.message });
      }
    });

    /**
     * Stop typing
     */
    socket.on('typing:stop', async ({ roomId }) => {
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
    socket.on('messages:read', async ({ roomId }, callback) => {
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
     * Toggle reaction on a message (add if absent, remove if present).
     * Emits 'message:reaction_updated' with full reaction summary — same
     * format as the REST POST /messages/:messageId/react endpoint.
     */
    socket.on('message:react', async ({ messageId, reaction }, callback) => {
      try {
        if (socketRateLimited(socket.id, 'message:react')) {
          return callback({ error: 'Rate limit exceeded' });
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
          const { error: insertErr } = await supabaseAdmin
            .from('MessageReaction')
            .insert({ message_id: messageId, user_id: userId, reaction });
          if (insertErr) {
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
    socket.on('message:unreact', async ({ reactionId }, callback) => {
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
    socket.on('chat:create_direct', async ({ otherUserId }, callback) => {
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
      
      // Notify user is offline only when last socket disconnects
      if (!stillOnline) {
        socket.broadcast.emit('user:offline', { userId });
      }
    });
    
    // ============ ERROR HANDLER ============
    
    socket.on('error', (error) => {
      logger.error('Socket error', { sessionId, userId, error: error.message });
    });
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
