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
const chatRealtime = require('../services/chatRealtime');
const chatPresence = require('../services/chatPresence');
const { isBlocked } = require('../services/blockService');
const { closedGigRoomIds, gigRoomRecipients, isGigRoomClosedTo, isRoomClosedForWrites } = require('../services/chatGigRoomAccess');
const { chatAccessUnavailable, actingBusinessInRoom, UNPUBLISHED_BUSINESS_REFUSAL } = require('../services/chatBusinessAccess');
const { unpublishedBusinessIds } = require('../utils/visibilityPolicy');
const { loadChatPeople, chatPersonRow } = require('../services/chatPeople');
const { markChatRead } = require('../services/chatReadState');
const { buildReactionSummary } = require('../services/chatSync');
const { setGauge } = require('../services/chatMetrics');
// Persistent login (design §6.4): the same JWT decode helper verifyToken
// exposes as `decodeSessionClaims` (verifyToken.js delegates to it), the 15-s
// session-state cache and the `session_revoked` event that kicks sockets.
const authSessionService = require('../services/authSessionService');
const { verifyAccessToken } = require('../services/accessTokenVerifier');

// Store connected users: { userId: Set<socketId> }
const connectedUsers = new Map();
const CHAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Backfill reads share the API's database pool with sends and uploads. Bound
// admission instead of retaining an unbounded queue when a client reconnects.
let activeRoomJoins = 0;

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

// A connection is not an indefinite authentication grant. Expiry is checked on
// every event; the session row and watermark are read on connect, on a change
// signal for the user (any API process) and when the last read is older than the
// window below. Registry sessions are covered by the AuthSession/User signals
// while the listener is up, so the read then only backs up a missed signal;
// without the listener, or for a session without a registry row, read often.
const POLICY_READ_SIGNALLED_MS = 30_000;
const POLICY_READ_UNSIGNALLED_MS = 5_000;
const POLICY_TICK_MS = 5_000;

function policyIsFresh(socket) {
  if (!socket.policyReadAt) return false;
  const signalled = Boolean(socket.policyRegistryRow) && syncChangedService.isLive()
    && socket.policyEpoch === syncChangedService.currentEpoch();
  const windowMs = signalled ? socket.policyReadWindowMs : POLICY_READ_UNSIGNALLED_MS;
  return Date.now() - socket.policyReadAt < windowMs;
}

async function checkConnectedSession(socket, { force = false } = {}) {
  if (!socket.connected) return false;
  if (socket.authExpiresAt <= Date.now()) {
    endAuthenticatedSocket(socket, 'expired');
    return false;
  }
  if (socket.authCheck) {
    // A signal that lands during a read is answered by a read that starts after it.
    if (force) socket.authRecheck = true;
    return socket.authCheck;
  }
  if (!force && policyIsFresh(socket)) return true;
  socket.authCheck = readConnectedSession(socket).finally(() => {
    socket.authCheck = null;
    if (socket.authRecheck) {
      socket.authRecheck = false;
      void checkConnectedSession(socket, { force: true });
    }
  });
  return socket.authCheck;
}

async function readConnectedSession(socket) {
  const startedAt = Date.now();
  const epoch = syncChangedService.currentEpoch();
  try {
    const [session, account] = await Promise.all([
      socket.authSessionId ? authSessionService.getSessionById(socket.authSessionId) : null,
      supabaseAdmin.from('User').select('sessions_valid_after').eq('id', socket.userId).maybeSingle(),
    ]);
    if (account.error) throw authSessionService.authUnavailableError(account.error);
    if (!account.data || session?.revoked_at || (session && session.user_id !== socket.userId)
        || (account.data.sessions_valid_after && socket.authIssuedAt < Date.parse(account.data.sessions_valid_after))) {
      endAuthenticatedSocket(socket, session?.revoked_reason || 'revoked');
      return false;
    }
    if (!session) {
      // Pre-registry tokens still need the provider's current decision.
      const { data, error } = await supabaseAdmin.auth.getUser(socket.authAccessToken);
      if (authSessionService.isAuthServiceBusy(error)) throw authSessionService.authUnavailableError(error);
      if (error || data?.user?.id !== socket.userId) {
        endAuthenticatedSocket(socket, 'revoked');
        return false;
      }
    }
    if (socket.authExpiresAt <= Date.now()) {
      endAuthenticatedSocket(socket, 'expired');
      return false;
    }
    socket.policyReadAt = startedAt;
    socket.policyEpoch = epoch;
    socket.policyRegistryRow = Boolean(session);
    return socket.connected;
  } catch (err) {
    logger.warn('Socket security state unavailable', { code: err.code || 'AUTH_UNAVAILABLE' });
    // No live data while policy is unreadable. A transport close lets existing
    // clients retry the handshake without treating an outage as account loss.
    // Timers and signals call this unawaited, and app.js exits on a rejection.
    socket.conn?.close();
    return false;
  }
}

function endAuthenticatedSocket(socket, reason) {
  if (!socket.connected) return;
  // Existing web/iOS/Android listeners confirm this hint with /refresh. Expiry
  // rotates a valid refresh token and reconnects; actual revocation signs out.
  socket.emit('auth:session_revoked', { sessionId: socket.authSessionId, reason,
    code: reason === 'expired' ? 'TOKEN_EXPIRED' : 'SESSION_REVOKED' });
  socket.disconnect(true);
}

let stopSecurityChanges = null;
function subscribeSecurityChanges(io) {
  if (stopSecurityChanges) stopSecurityChanges();
  stopSecurityChanges = syncChangedService.onChange(change => {
    if (!['AuthSession', 'User'].includes(change.t) || !change.u) return;
    // Another process may have signed this person out. Drop what this process
    // cached for them (REST's session state and watermark) and recheck their
    // sockets now instead of after the caches' TTLs.
    authSessionService.invalidateSessionStateCacheForUser(change.u);
    authSessionService.authEvents.emit('watermark_updated', { userId: change.u });
    for (const id of connectedUsers.get(change.u) || []) {
      const socket = io.sockets.sockets.get(id);
      if (socket) void checkConnectedSession(socket, { force: true });
    }
  });
}

// ============ SOCKET RATE LIMITING ============
// Simple sliding-window counter per socket per event type.
// Counters are cleaned up on disconnect.

const socketRateLimits = {
  'message:react': { max: 60, windowMs: 60_000 },
  'typing:start':  { max: 30, windowMs: 60_000 },
  'typing:stop':   { max: 30, windowMs: 60_000 },
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

// REST, reconnect backfill and socket acknowledgements use one complete summary.
async function buildSocketReactionSummary(messageId, requestingUserId) {
  return (await buildReactionSummary([messageId], requestingUserId)).get(messageId) || [];
}

const buildSocketReactionSummaryMap = buildReactionSummary;

// Store user rooms: { userId: Set([roomId1, roomId2]) }
const userRooms = new Map();

// Membership, blocks and task assignment can change after room:join. Resolve
// only locally connected subscribers, before emitting even an ephemeral signal.
async function emitTyping(io, change) {
  const targets = [...(io.sockets.adapter.rooms.get(change.r) || [])]
    .map((id) => io.sockets.sockets.get(id)).filter((socket) => socket?.connected
    && socket.userId !== change.u && socket.rooms.has(change.r)
    && (!change.socketId || socket.id === change.socketId));
  if (!targets.length) return;
  const [roomResult, senderResult] = await Promise.all([
    supabaseAdmin.from('ChatRoom').select('id, type, gig_id, is_active').eq('id', change.r).maybeSingle(),
    supabaseAdmin.from('ChatParticipant').select('user_id').eq('room_id', change.r)
      .eq('user_id', change.u).eq('is_active', true).maybeSingle(),
  ]);
  if (roomResult.error || senderResult.error) throw chatAccessUnavailable();
  const room = roomResult.data;
  if (!room || !senderResult.data || await isRoomClosedForWrites(change.r, room)
    || !(await gigRoomRecipients(room, [change.u])).includes(change.u)) return;
  const ids = [...new Set(targets.map((socket) => socket.userId))];
  const permitted = new Set();
  for (let offset = 0; offset < ids.length; offset += 200) {
    const batch = ids.slice(offset, offset + 200);
    const [members, outgoing, incoming] = await Promise.all([
      supabaseAdmin.from('ChatParticipant').select('user_id').eq('room_id', change.r)
        .eq('is_active', true).in('user_id', batch),
      supabaseAdmin.from('UserBlock').select('blocked_user_id').eq('blocker_user_id', change.u).in('blocked_user_id', batch),
      supabaseAdmin.from('UserBlock').select('blocker_user_id').eq('blocked_user_id', change.u).in('blocker_user_id', batch),
    ]);
    if (members.error || outgoing.error || incoming.error) throw chatAccessUnavailable();
    const blocked = new Set([...(outgoing.data || []).map((row) => row.blocked_user_id),
      ...(incoming.data || []).map((row) => row.blocker_user_id)]);
    const eligible = await gigRoomRecipients(room, (members.data || []).map((row) => row.user_id));
    for (const id of eligible) if (!blocked.has(id)) permitted.add(id);
    const membersSet = new Set((members.data || []).map((row) => row.user_id));
    for (const id of batch) {
      if (membersSet.has(id) || blocked.has(id)
        || !targets.some((socket) => socket.userId === id && socket.chatBusinessRooms?.has(change.r))) continue;
      const actingFor = await actingBusinessInRoom(change.r, id);
      if (!actingFor || await isGigRoomClosedTo(change.r, id, [actingFor])) continue;
      const block = await supabaseAdmin.from('UserBlock').select('id', { count: 'exact', head: true })
        .or(`and(blocker_user_id.eq.${change.u},blocked_user_id.eq.${actingFor}),and(blocker_user_id.eq.${actingFor},blocked_user_id.eq.${change.u})`);
      if (block.error || !Number.isInteger(block.count)) throw chatAccessUnavailable();
      if (block.count === 0) permitted.add(id);
    }
  }
  if (Date.now() - change.at > 5000 || (change.isCurrent && !change.isCurrent())) return;
  for (const socket of targets) if (socket.connected && socket.rooms.has(change.r) && permitted.has(socket.userId)) {
    const event = typeof change.online === 'boolean'
      ? (change.online ? 'user:online' : 'user:offline')
      : (change.typing ? 'typing:user' : 'typing:stopped');
    socket.emit(event, { userId: change.u, roomId: change.r });
  }
}

module.exports = (io) => {
  // Initialize badge + notification services with io + connectedUsers references
  badgeService.init(io, connectedUsers);
  notificationService.init(io, connectedUsers);
  // Instant Screens: database changes (NOTIFY sync_changed) → 'sync:changed' to the people they concern
  syncChangedService.init(io, connectedUsers);
  chatRealtime.setTypingHandler(emitTyping);
  chatRealtime.init(io);
  chatPresence.init(io, emitTyping);
  syncChangedService.start();
  // Persistent login: disconnect sockets of revoked sessions
  subscribeSessionRevocation(io);
  subscribeSecurityChanges(io);
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
      
      // Verify the token on this server, or with Supabase when that can't decide (accessTokenVerifier)
      const verified = await verifyAccessToken(token, { authClient: supabaseAdmin });
      if (!verified.ok) {
        return next(new Error(verified.reason === 'busy' ? 'Authentication unavailable' : 'Invalid token'));
      }
      const data = { user: verified.user };

      // Persistent login: decode session_id / iat (the token was verified
      // above) and refuse revoked sessions / tokens older than the user's
      // sessions_valid_after watermark — same policy as verifyToken.
      const claims = authSessionService.sessionClaimsFromAccessToken(token);
      if (!Number.isFinite(claims?.exp) || !Number.isFinite(claims?.iat) || claims.exp * 1000 <= Date.now()) {
        return next(new Error('Invalid token'));
      }
      socket.authAccessToken = token;
      socket.authExpiresAt = claims.exp * 1000;
      socket.authIssuedAt = claims.iat * 1000;
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
      next(new Error(err.authBusy ? 'Authentication unavailable' : 'Authentication failed'));
    }
  });
  
  // ============ CONNECTION HANDLER ============
  
  io.on('connection', async (socket) => {
    const userId = socket.userId;
    socket.sessionId = crypto.randomUUID();
    const sessionId = socket.sessionId;
    const existingSockets = connectedUsers.get(userId);
    const wasOnline = Boolean(existingSockets && existingSockets.size > 0);
    // Rooms this socket joined for a business inbox (room:join), where the user isn't a member.
    const businessRooms = new Set();
    socket.chatBusinessRooms = businessRooms;
    const pendingRoomJoins = new Map();
    const roomSubscriptions = new Map();
    const startupLeaves = new Set();
    let startupPending = true;
    let skipStartupJoins = false;

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
    if (!wasOnline) chatPresence.updateLocal(userId, true);
    emitSocketGauges();
    const expiryTimer = setTimeout(() => endAuthenticatedSocket(socket, 'expired'),
      Math.min(Math.max(0, socket.authExpiresAt - Date.now()), 2_147_483_647));
    // Spread the backup reads so sockets that reconnected together (a deploy) don't read together.
    socket.policyReadWindowMs = POLICY_READ_SIGNALLED_MS * (0.8 + Math.random() * 0.4);
    const policyTimer = setInterval(() => { void checkConnectedSession(socket); }, POLICY_TICK_MS);
    expiryTimer.unref();
    policyTimer.unref();

    // Load user's rooms and join them. Started here but awaited only at the end of
    // this handler: the event handlers below must be registered before the
    // client's first events arrive (clients emit room:join as soon as they
    // connect), or socket.io drops those events.
    const initialRoomsLoad = (async () => {
      try {
        // Startup remains a bounded head subscription; older rooms are joined
        // explicitly by clients. The current inbox reader applies task access
        // before selecting that head and uses the same stable activity order.
        const { data: page, error } = await supabaseAdmin.rpc('get_user_chat_rooms', {
          p_user_id: userId,
          p_actor_id: userId,
          p_limit: 100,
          p_before_at: null,
          p_before_id: null,
          p_type: null,
        });
        if (error || !Array.isArray(page?.entries)) throw chatAccessUnavailable();
        if (!socket.connected) return;
        const entries = page.entries;
        const { data: previews, error: previewError } = entries.length
          ? await supabaseAdmin.rpc('get_room_previews', { p_room_ids: entries.map((entry) => entry.id) })
          : { data: [] };
        if (previewError) throw chatAccessUnavailable();
        const previewByRoom = new Map((previews || []).map((preview) => [String(preview.room_id), preview]));
        const rooms = entries.map(({ membership }) => {
          const room = membership.room;
          const preview = previewByRoom.get(String(room.id));
          return {
            id: room.id, room_type: room.type, room_name: room.name,
            description: room.description, gig_id: room.gig_id, home_id: room.home_id,
            is_active: room.is_active, created_at: room.created_at, updated_at: room.updated_at,
            last_message_at: preview?.created_at || room.updated_at,
            last_message_preview: preview?.message?.slice(0, 100) || null,
            unread_count: membership.unread_count, last_read_at: membership.last_read_at, role: membership.role,
          };
        });

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
        if (!await checkConnectedSession(socket)) return;

        for (const room of openRooms) {
          const roomId = room.id;
          if (skipStartupJoins || startupLeaves.has(roomId) || pendingRoomJoins.has(roomId)) continue;
          socket.join(roomId);
          roomIds.add(roomId);

          logger.info('User joined room', { sessionId, userId, roomId, roomType: room.room_type });
        }

        userRooms.set(userId, roomIds);

        // The chat list names people through its authenticated REST reader;
        // this compatibility event contains room metadata, never raw names.
        socket.emit('rooms:list', openRooms.filter((room) => !startupLeaves.has(room.id)));
      } catch (err) {
        logger.error('Error loading user rooms', { sessionId, userId, error: err.message });
      } finally {
        startupPending = false;
        startupLeaves.clear();
      }
    })();

    // Send initial badge counts immediately on connect
    badgeService.emitBadgeUpdate(userId);
    
    // Every event's arguments come from the client. Hand each handler an object payload and a callable ack, and keep
    // its errors here: app.js exits the API on any uncaught exception or unhandled rejection.
    const on = (event, handler) => socket.on(event, (...args) => {
      const last = args[args.length - 1];
      const ack = (...reply) => {
        if (socket.connected && socket.authExpiresAt > Date.now() && typeof last === 'function') last(...reply);
      };
      const payload = args[0] !== null && typeof args[0] === 'object' ? args[0] : {};
      // The executor turns a synchronous throw into a rejection too; the returned promise never rejects.
      return checkConnectedSession(socket).then(allowed => allowed ? handler(payload, ack) : undefined)
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

    // Leaving is a subscription change for this socket, never a membership write.
    // A per-attempt token prevents a late cancelled ACK from leaving a newer join.
    on('room:leave', async ({ roomId: requestedRoomId, subscriptionId }, callback) => {
      if (typeof requestedRoomId !== 'string' || !CHAT_UUID.test(requestedRoomId)
        || (subscriptionId !== undefined && (typeof subscriptionId !== 'string' || !CHAT_UUID.test(subscriptionId)))) {
        return callback({ error: 'Invalid room subscription' });
      }
      const roomId = requestedRoomId.toLowerCase();
      const token = subscriptionId?.toLowerCase();
      const pending = pendingRoomJoins.get(roomId);
      const cancelPending = pending && (token === undefined || pending.token === token);
      const leaveActive = token === undefined || roomSubscriptions.get(roomId) === token;
      if (cancelPending) pending.cancelled = true;
      if (!cancelPending && !leaveActive) return callback({ success: true, left: false, roomId });
      if (startupPending) {
        // Bound even an untrusted client's early leave burst. Overflow skips only
        // this socket's automatic startup subscriptions; explicit joins still work.
        if (startupLeaves.size < 1000) startupLeaves.add(roomId); else skipStartupJoins = true;
      }
      if (leaveActive) {
        roomSubscriptions.delete(roomId);
        businessRooms.delete(roomId);
        chatPresence.unwatch(socket, roomId);
        await socket.leave(roomId);
        const anotherSocket = [...(connectedUsers.get(userId) || [])].some((id) => id !== socket.id
          && io.sockets.sockets.get(id)?.rooms.has(roomId));
        if (!anotherSocket) userRooms.get(userId)?.delete(roomId);
      }
      callback({ success: true, left: Boolean(cancelPending || leaveActive), roomId, ...(token ? { subscriptionId: token } : {}) });
    });

    /**
     * Join a specific room
     */
    on('room:join', async ({ roomId: requestedRoomId, subscriptionId, includeBackfill }, callback) => {
      if (typeof requestedRoomId !== 'string' || !CHAT_UUID.test(requestedRoomId)
        || (subscriptionId !== undefined && (typeof subscriptionId !== 'string' || !CHAT_UUID.test(subscriptionId)))
        || (includeBackfill !== undefined && typeof includeBackfill !== 'boolean')) {
        return callback({ error: 'Invalid room subscription' });
      }
      const roomId = requestedRoomId.toLowerCase();
      if (pendingRoomJoins.has(roomId) || pendingRoomJoins.size >= 4 || activeRoomJoins >= 32) {
        return callback({ error: 'Chat is busy. Please retry.', code: 'CHAT_BUSY', retryable: true, retryAfterMs: 1000 });
      }
      const operation = { token: subscriptionId?.toLowerCase(), cancelled: false };
      pendingRoomJoins.set(roomId, operation);
      startupLeaves.delete(roomId);
      activeRoomJoins++;
      const cancelled = () => !socket.connected || operation.cancelled;
      const cancelledAck = () => callback({ error: 'Room join cancelled', code: 'CHAT_JOIN_CANCELLED', retryable: false });
      try {
        // Verify user has access to room
        const { data: participant, error: participantError } = await supabaseAdmin
          .from('ChatParticipant')
          .select('*')
          .eq('room_id', roomId)
          .eq('user_id', userId)
          .eq('is_active', true)
          .maybeSingle();
        if (participantError) throw chatAccessUnavailable();
        // A business's owner and staff aren't members of its rooms (services/chatBusinessAccess), but its inbox hears
        // the room's live updates. They join quietly: the room is never told who they are (no joined, presence,
        // typing or read events), and their own read goes through the API for the business.
        const actingFor = participant ? null : await actingBusinessInRoom(roomId, userId);

        if (!participant && !actingFor) {
          return callback({ error: 'Access denied' });
        }
        if (await isGigRoomClosedTo(roomId, userId, actingFor ? [actingFor] : [])) {
          return callback({ error: 'Access denied' });
        }
        if (cancelled()) return cancelledAck();

        roomSubscriptions.set(roomId, operation.token);
        await socket.join(roomId);
        if (cancelled()) {
          await socket.leave(roomId);
          return cancelledAck();
        }

        // Track room
        if (actingFor) {
          businessRooms.add(String(roomId));
        } else {
          if (!userRooms.has(userId)) {
            userRooms.set(userId, new Set());
          }
          userRooms.get(userId).add(roomId);
        }

        logger.info('User joined room', { sessionId, userId, roomId, forBusiness: Boolean(actingFor) });
        
        // Clients recovering through canonical REST can skip unused legacy
        // backfill. Omission preserves the existing ACK contract for older apps.
        const { data: messages, error: historyError } = includeBackfill === false
          ? { data: [], error: null } : await supabaseAdmin
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
          .order('id', { ascending: false })
          .limit(50);
        if (historyError) throw chatAccessUnavailable();
        const backfill = (messages || []).reverse();
        const [reactionMap, people] = await Promise.all([
          buildSocketReactionSummaryMap(backfill.map((message) => message.id), userId),
          loadChatPeople(backfill.map((message) => message.sender?.id || message.user_id)),
        ]);

        if (cancelled()) return cancelledAck();

        callback({
          success: true,
          ...(operation.token ? { subscriptionId: operation.token } : {}),
          // Without actor_user_id, as the API serves messages: who wrote for a business stays internal.
          // Each sender is named as the chat list names them (services/chatPeople).
          messages: backfill.map(({ actor_user_id: _actor, push_delivery_requested: _pushDelivery, read_topic_id: _readTopic, ...message }) => ({
            ...message,
            sender: chatPersonRow(message.sender, people),
            reactions: reactionMap.get(String(message.id)) || [],
          })),
          roomId
        });
        chatPresence.watch(socket, roomId).catch(() => {});
        if (actingFor) return;

        // Joining subscribes to updates; the client marks only rendered messages read.
        
        // Notify room that user joined
        // Ids only: the first part of the person's email address is not for the other members to see.
        socket.to(roomId).emit('user:joined', { 
          userId, 
          roomId
        });
        
      } catch (err) {
        logger.error('Room join error', { sessionId, userId, roomId, error: err.message });
        callback({ error: 'Failed to join room', retryable: true });
      } finally {
        pendingRoomJoins.delete(roomId);
        activeRoomJoins--;
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

        // Verify the socket has joined this room (room:join checks membership); typing for a business would name
        // the person to the room
        if (!socket.rooms.has(roomId) || businessRooms.has(String(roomId))) {
          return;
        }

        chatRealtime.publishTyping(roomId, userId, true);

      } catch (err) {
        logger.error('Typing indicator error', { sessionId, userId, roomId, error: err.message });
      }
    });

    /**
     * Stop typing
     */
    on('typing:stop', async ({ roomId }) => {
      try {
        if (socketRateLimited(socket.id, 'typing:stop')) return;
        // Verify the socket has joined this room
        if (!socket.rooms.has(roomId) || businessRooms.has(String(roomId))) {
          return;
        }

        chatRealtime.publishTyping(roomId, userId, false);

      } catch (err) {
        logger.error('Stop typing error', { sessionId, userId, roomId, error: err.message });
      }
    });
    
    /**
     * Mark messages as read
     */
    const readMessages = async ({ roomId, topicId, throughMessageId, throughMessageIds }, callback) => {
      const requestAt = new Date().toISOString();
      try {
        // Verify the socket has joined this room as a member (a business's read goes through the API)
        if (!socket.rooms.has(roomId) || businessRooms.has(String(roomId))) {
          return callback({ error: 'Not in room' });
        }

        if (await isGigRoomClosedTo(roomId, userId)) return callback({ error: 'Access denied' });
        const result = await markChatRead({ roomIds: [roomId], userId, topicId, throughMessageId, throughMessageIds, requestAt, io });
        if (result.error) return callback({ error: 'Failed to mark as read' });

        // Update the reader's own badge counts (unread decreased)
        badgeService.emitBadgeUpdate(userId);

        callback({ success: true, unreadCount: result.unreadCount });

      } catch (err) {
        logger.error('Mark read error', { sessionId, userId, roomId, error: err.message });
        callback({ error: 'Failed to mark as read' });
      }
    };
    on('messages:read', (payload = {}, callback) => payload.topicId !== undefined
      ? callback({ error: 'Use the topic read event' }) : readMessages(payload, callback));
    on('messages:topic_read', (payload = {}, callback) => !payload.topicId
      ? callback({ error: 'Topic required' }) : readMessages(payload, callback));
    
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

        const { data: current } = await supabaseAdmin.from('ChatMessage').select('sync_version').eq('id', messageId).maybeSingle();
        if (current) chatRealtime.announce({ t: 'ChatMessage', r: message.room_id, m: messageId, op: 'UPDATE', v: current.sync_version });
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

        const { error: deleteError } = await supabaseAdmin
          .from('MessageReaction')
          .delete()
          .eq('id', reactionId);
        if (deleteError) throw deleteError;

        // Get room ID for broadcast
        const { data: message } = await supabaseAdmin
          .from('ChatMessage')
          .select('room_id')
          .eq('id', reactionRow.message_id)
          .maybeSingle();

        if (message) {
          const { data: current } = await supabaseAdmin.from('ChatMessage').select('sync_version').eq('id', reactionRow.message_id).maybeSingle();
          if (current) chatRealtime.announce({ t: 'ChatMessage', r: message.room_id, m: reactionRow.message_id, op: 'UPDATE', v: current.sync_version });
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
        // As POST /api/chat/direct: a draft or closed business neither starts a conversation as itself nor is reached.
        const unpublished = await unpublishedBusinessIds([userId, otherUserId]);
        if (unpublished.has(String(userId))) return callback(UNPUBLISHED_BUSINESS_REFUSAL);
        if (unpublished.has(String(otherUserId))) return callback({ error: 'User not found' });

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
      chatPresence.unwatch(socket);
      clearTimeout(expiryTimer);
      clearInterval(policyTimer);
      socket.authAccessToken = null;
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
      
      // Typing is ephemeral and expires in each client. Disconnect has no
      // database write on the path to announcing the user's offline state.
      if (!stillOnline && !connectedUsers.has(userId)) {
        chatPresence.updateLocal(userId, false);
      }
    });
    
    // ============ ERROR HANDLER ============
    
    socket.on('error', (error) => {
      logger.error('Socket error', { sessionId, userId, error: error.message });
    });

    await initialRoomsLoad;
  });
  
  logger.info('Socket.IO chat server initialized');
};

// Exposed for tests / other services
module.exports.kickRevokedSessions = kickRevokedSessions;
module.exports.connectedUsers = connectedUsers;
module.exports.emitPrivateGigUpdate = emitPrivateGigUpdate;
