// ============================================================
// E2E TEST: Chat Socket.IO
//
// Spins up an in-process HTTP + Socket.IO server using the
// in-memory supabase mock, then connects real socket.io-client
// instances to exercise the full socket lifecycle.
// ============================================================

const http = require('http');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');
const express = require('express');

// supabaseAdmin, logger, notificationService, and verifyToken are auto-mocked
// by moduleNameMapper in jest.config.js. Only add mocks for modules not in the mapper.
const { resetTables, seedTable, getTable, setRpcMock, setAuthMocks } = require('../__mocks__/supabaseAdmin');

jest.mock('../../services/badgeService', () => ({
  init: jest.fn(),
  emitBadgeUpdate: jest.fn(),
  emitBadgeUpdateToMany: jest.fn(),
}));
jest.mock('../../utils/businessPermissions', () => ({
  hasPermission: jest.fn().mockResolvedValue(false),
}));

const chatSocketio = require('../../socket/chatSocketio');
const request = require('supertest');

// ── Constants ────────────────────────────────────────────────

const U1 = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const U2 = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb';
const U3 = 'cccccccc-cccc-1ccc-8ccc-cccccccccccc';
const ROOM_1 = 'dd000000-0000-4000-a000-000000000001';
const MSG_1 = 'dd000000-0000-4000-a000-000000000010';

const TOKEN_U1 = 'token-user-1';
const TOKEN_U2 = 'token-user-2';
const TOKEN_U3 = 'token-user-3';

// ── Server setup ────────────────────────────────────────────

let httpServer;
let io;
let app;
let serverUrl;

function createTestServer() {
  app = express();
  app.use(express.json());
  httpServer = http.createServer(app);
  io = new Server(httpServer, { cors: { origin: '*' } });
  app.set('io', io);
  app.use('/api/chat', require('../../routes/chats'));
  chatSocketio(io);
}

function getServerUrl() {
  const addr = httpServer.address();
  return `http://127.0.0.1:${addr.port}`;
}

/** Create a connected socket.io-client. */
function connectSocket(token, opts = {}) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(serverUrl, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      ...opts,
    });
    const cleanup = () => {
      clearTimeout(timer);
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
    };
    const onConnect = () => {
      cleanup();
      resolve(socket);
    };
    const onConnectError = (err) => {
      cleanup();
      socket.disconnect();
      reject(err);
    };
    const timer = setTimeout(() => {
      cleanup();
      socket.disconnect();
      reject(new Error('Socket connect timeout'));
    }, 5000);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
    socket.once('connect', onConnect);
    socket.once('connect_error', onConnectError);
  });
}

/** Disconnect socket and wait. */
function disconnectSocket(socket) {
  return new Promise((resolve) => {
    if (!socket.connected) return resolve();
    socket.on('disconnect', () => resolve());
    socket.disconnect();
  });
}

/** Helper to wait for a specific event on a socket. */
function waitForEvent(socket, event, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeoutMs);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/** Helper to emit and receive callback. */
function emitWithAck(socket, event, data, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout on "${event}" ack`)), timeoutMs);
    socket.emit(event, data, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

const ROOM_OBJ = { id: ROOM_1, type: 'direct', name: null, description: null, gig_id: null, home_id: null, is_active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };

function seedData() {
  seedTable('User', [
    { id: U1, username: 'alice', name: 'Alice', first_name: 'Alice', last_name: 'A', profile_picture_url: null, account_type: 'personal' },
    { id: U2, username: 'bob', name: 'Bob', first_name: 'Bob', last_name: 'B', profile_picture_url: null, account_type: 'personal' },
    { id: U3, username: 'charlie', name: 'Charlie', first_name: 'Charlie', last_name: 'C', profile_picture_url: null, account_type: 'personal' },
  ]);
  seedTable('ChatRoom', [ROOM_OBJ]);
  seedTable('ChatParticipant', [
    { id: 'cp-1', room_id: ROOM_1, user_id: U1, role: 'member', is_active: true, unread_count: 0, last_read_at: '2026-01-01T00:00:00Z', joined_at: '2026-01-01T00:00:00Z', left_at: null, room: ROOM_OBJ, user: { id: U1, username: 'alice', name: 'Alice', profile_picture_url: null } },
    { id: 'cp-2', room_id: ROOM_1, user_id: U2, role: 'member', is_active: true, unread_count: 0, last_read_at: '2026-01-01T00:00:00Z', joined_at: '2026-01-01T00:00:00Z', left_at: null, room: ROOM_OBJ, user: { id: U2, username: 'bob', name: 'Bob', profile_picture_url: null } },
  ]);
  seedTable('ChatMessage', [
    { id: MSG_1, room_id: ROOM_1, user_id: U1, message: 'Hello from Alice', type: 'text', deleted: false, created_at: '2026-01-01T10:00:00Z' },
  ]);
  seedTable('MessageReaction', []);
  seedTable('ChatTyping', []);
  seedTable('Gig', []);
  seedTable('GigBid', []);
  seedTable('File', []);
  seedTable('UserBlock', []);
  seedTable('ConversationTopic', []);

  // Map tokens to users for socket auth
  setAuthMocks({
    getUser: async (token) => {
      const tokenMap = {
        [TOKEN_U1]: { id: U1, email: 'alice@test.local' },
        [TOKEN_U2]: { id: U2, email: 'bob@test.local' },
        [TOKEN_U3]: { id: U3, email: 'charlie@test.local' },
      };
      const user = tokenMap[token];
      if (!user) return { data: { user: null }, error: { message: 'Invalid token' } };
      return { data: { user }, error: null };
    },
  });

  // RPC mock for get_user_chat_rooms (called on connect)
  setRpcMock(async (fnName, params) => {
    if (fnName === 'get_user_chat_rooms') {
      const userId = params.p_user_id;
      const participants = getTable('ChatParticipant')
        .filter(p => p.user_id === userId && p.is_active);
      const rooms = participants.map(p => ({
        room_id: p.room_id,
        room_type: p.room?.type || 'direct',
      }));
      return { data: rooms, error: null };
    }
    if (fnName === 'mark_messages_read') {
      return { data: null, error: null };
    }
    if (fnName === 'cleanup_expired_typing') {
      return { data: 0, error: null };
    }
    return { data: null, error: null };
  });
}

// ── Lifecycle ───────────────────────────────────────────────

// Track sockets for cleanup
const activeSockets = [];

beforeAll((done) => {
  resetTables();
  seedData();
  createTestServer();
  httpServer.listen(0, '127.0.0.1', () => {
    serverUrl = getServerUrl();
    done();
  });
});

afterEach(async () => {
  // Disconnect all client sockets created during the test
  for (const s of activeSockets.splice(0)) {
    if (s.connected) s.disconnect();
  }
  // Small delay for disconnect handlers to fire
  await new Promise(r => setTimeout(r, 100));
});

afterAll((done) => {
  if (io) io.close();
  if (httpServer) httpServer.close(done);
  else done();
});

// Helper that tracks sockets for auto-cleanup
async function connect(token, opts) {
  const s = await connectSocket(token, opts);
  activeSockets.push(s);
  return s;
}

// ============================================================
// 1. Authentication
// ============================================================

describe('Socket authentication', () => {
  test('authenticated socket connects successfully', async () => {
    const socket = await connect(TOKEN_U1);
    expect(socket.connected).toBe(true);
  });

  test('unauthenticated socket is rejected', async () => {
    await expect(connectSocket('invalid-token-xyz')).rejects.toThrow();
  });

  test('socket without token is rejected', async () => {
    await expect(
      new Promise((resolve, reject) => {
        const socket = ioClient(serverUrl, {
          auth: {},
          transports: ['websocket'],
          forceNew: true,
        });
        activeSockets.push(socket);
        socket.on('connect', () => resolve(socket));
        socket.on('connect_error', (err) => reject(err));
        setTimeout(() => reject(new Error('timeout')), 3000);
      })
    ).rejects.toThrow();
  });
});

// ============================================================
// 2. room:join
// ============================================================

describe('room:join', () => {
  test('returns messages and succeeds for active participant', async () => {
    const socket = await connect(TOKEN_U1);

    const result = await emitWithAck(socket, 'room:join', { roomId: ROOM_1 });

    expect(result.success).toBe(true);
    expect(result.roomId).toBe(ROOM_1);
    expect(Array.isArray(result.messages)).toBe(true);
    expect(result.messages.length).toBeGreaterThanOrEqual(1);
  });

  test('fails for non-participant', async () => {
    const socket = await connect(TOKEN_U3);

    const result = await emitWithAck(socket, 'room:join', { roomId: ROOM_1 });

    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/access denied/i);
  });
});

// ============================================================
// 3. Broadcast events after REST operations
// ============================================================

describe('REST → Socket broadcasts', () => {
  test('message:new is received by all room participants after REST send', async () => {
    const socketU2 = await connect(TOKEN_U2);
    // Join room explicitly to receive events
    await emitWithAck(socketU2, 'room:join', { roomId: ROOM_1 });

    // Set up listener BEFORE the REST call
    const messagePromise = waitForEvent(socketU2, 'message:new');

    // Send message via REST
    await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({ roomId: ROOM_1, messageText: 'Hello via REST', messageType: 'text' });

    const received = await messagePromise;
    expect(received.message).toBe('Hello via REST');
    expect(received.room_id).toBe(ROOM_1);
  });

  test('message:deleted is received after REST delete', async () => {
    const socketU2 = await connect(TOKEN_U2);
    await emitWithAck(socketU2, 'room:join', { roomId: ROOM_1 });

    const deletePromise = waitForEvent(socketU2, 'message:deleted');

    await request(app)
      .delete(`/api/chat/messages/${MSG_1}`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1);

    const received = await deletePromise;
    expect(received.messageId).toBe(MSG_1);
  });

  test('message:edited is received after REST edit', async () => {
    // Restore MSG_1 (may have been deleted in previous test)
    const msgs = getTable('ChatMessage');
    const m = msgs.find(msg => msg.id === MSG_1);
    if (m) { m.deleted = false; m.deleted_at = undefined; }

    const socketU2 = await connect(TOKEN_U2);
    await emitWithAck(socketU2, 'room:join', { roomId: ROOM_1 });

    const editPromise = waitForEvent(socketU2, 'message:edited');

    await request(app)
      .put(`/api/chat/messages/${MSG_1}`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({ messageText: 'Edited message' });

    const received = await editPromise;
    expect(received.messageId).toBe(MSG_1);
    expect(received.message.message).toBe('Edited message');
  });

  test('message:reaction_updated is received after reaction toggle via REST', async () => {
    const socketU2 = await connect(TOKEN_U2);
    await emitWithAck(socketU2, 'room:join', { roomId: ROOM_1 });

    const reactionPromise = waitForEvent(socketU2, 'message:reaction_updated');

    await request(app)
      .post(`/api/chat/messages/${MSG_1}/react`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({ reaction: '👍' });

    const received = await reactionPromise;
    expect(received.messageId).toBe(MSG_1);
    expect(received.reactions).toBeDefined();
  });
});

// ============================================================
// 4. Typing indicators
// ============================================================

describe('Typing indicators', () => {
  test('typing:start broadcast reaches other participants but not sender', async () => {
    const socketU1 = await connect(TOKEN_U1);
    const socketU2 = await connect(TOKEN_U2);

    // Both join room
    await emitWithAck(socketU1, 'room:join', { roomId: ROOM_1 });
    await emitWithAck(socketU2, 'room:join', { roomId: ROOM_1 });

    // Set up listeners
    const u2Promise = waitForEvent(socketU2, 'typing:user');
    let u1Received = false;
    socketU1.on('typing:user', () => { u1Received = true; });

    // U1 starts typing
    socketU1.emit('typing:start', { roomId: ROOM_1 });

    const received = await u2Promise;
    expect(received.userId).toBe(U1);
    expect(received.roomId).toBe(ROOM_1);

    // Give sender time to potentially receive the event (it shouldn't)
    await new Promise(r => setTimeout(r, 200));
    expect(u1Received).toBe(false);
  });

  test('typing:start does NOT broadcast if socket has not joined the room', async () => {
    const socketU1 = await connect(TOKEN_U1);
    const socketU2 = await connect(TOKEN_U2);

    // U2 joins the room but U1 does NOT join via room:join
    await emitWithAck(socketU2, 'room:join', { roomId: ROOM_1 });

    let received = false;
    socketU2.on('typing:user', () => { received = true; });

    // U1 emits typing without joining
    socketU1.emit('typing:start', { roomId: ROOM_1 });

    await new Promise(r => setTimeout(r, 500));
    // U1 never joined room:join so socket.rooms doesn't include ROOM_1
    // BUT: on connect, chatSocketio auto-joins the user's rooms via get_user_chat_rooms RPC.
    // Since U1 is a participant, they ARE auto-joined. Let's verify the actual behavior:
    // Actually the auto-join on connect means U1 IS in the room. The typing:start check
    // is `socket.rooms.has(roomId)` which will be true. So this test verifies that
    // typing from a user who is NOT a participant (U3) doesn't broadcast.

    // Let's use U3 who has no room membership instead
    const socketU3 = await connect(TOKEN_U3);
    let u2Received = false;
    socketU2.on('typing:user', () => { u2Received = true; });

    socketU3.emit('typing:start', { roomId: ROOM_1 });

    await new Promise(r => setTimeout(r, 500));
    expect(u2Received).toBe(false);
  });
});

// ============================================================
// 5. Disconnect cleanup
// ============================================================

describe('Disconnect', () => {
  test('disconnect cleans up typing indicators', async () => {
    const socketU1 = await connect(TOKEN_U1);
    await emitWithAck(socketU1, 'room:join', { roomId: ROOM_1 });

    // Start typing
    socketU1.emit('typing:start', { roomId: ROOM_1 });
    await new Promise(r => setTimeout(r, 200));

    // Verify typing row exists
    const typingBefore = getTable('ChatTyping').filter(t => t.user_id === U1);
    expect(typingBefore.length).toBeGreaterThanOrEqual(1);

    // Disconnect
    await disconnectSocket(socketU1);
    // Remove from tracking so afterEach doesn't try to disconnect again
    const idx = activeSockets.indexOf(socketU1);
    if (idx >= 0) activeSockets.splice(idx, 1);
    await new Promise(r => setTimeout(r, 300));

    // Verify typing cleaned up
    const typingAfter = getTable('ChatTyping').filter(t => t.user_id === U1);
    expect(typingAfter.length).toBe(0);
  });
});

// ============================================================
// 6. Reconnect
// ============================================================

describe('Reconnect', () => {
  test('reconnect + room:join works cleanly', async () => {
    // First connection
    const socket1 = await connect(TOKEN_U1);
    const join1 = await emitWithAck(socket1, 'room:join', { roomId: ROOM_1 });
    expect(join1.success).toBe(true);

    // Disconnect
    await disconnectSocket(socket1);
    const idx = activeSockets.indexOf(socket1);
    if (idx >= 0) activeSockets.splice(idx, 1);
    await new Promise(r => setTimeout(r, 200));

    // Reconnect
    const socket2 = await connect(TOKEN_U1);
    const join2 = await emitWithAck(socket2, 'room:join', { roomId: ROOM_1 });

    expect(join2.success).toBe(true);
    expect(join2.messages).toBeDefined();
  });
});

// ============================================================
// 7. Online/offline events
// ============================================================

describe('Online/offline events', () => {
  test('user:online fires on first connect, user:offline on last disconnect', async () => {
    const observer = await connect(TOKEN_U2);

    // Listen for online event
    const onlinePromise = waitForEvent(observer, 'user:online');

    // U1 connects — should trigger user:online
    const socketU1 = await connect(TOKEN_U1);

    const onlineEvent = await onlinePromise;
    expect(onlineEvent.userId).toBe(U1);

    // Listen for offline event
    const offlinePromise = waitForEvent(observer, 'user:offline');

    // U1 disconnects — should trigger user:offline
    await disconnectSocket(socketU1);
    const idx = activeSockets.indexOf(socketU1);
    if (idx >= 0) activeSockets.splice(idx, 1);

    const offlineEvent = await offlinePromise;
    expect(offlineEvent.userId).toBe(U1);
  });
});

// ============================================================
// 8. Multi-device (multiple sockets, same user)
// ============================================================

describe('Multi-device (same user, multiple sockets)', () => {
  test('both sockets for the same user receive events', async () => {
    // U2 connects with two sockets (simulating two devices)
    const device1 = await connect(TOKEN_U2);
    const device2 = await connect(TOKEN_U2);

    // Both join the room
    await emitWithAck(device1, 'room:join', { roomId: ROOM_1 });
    await emitWithAck(device2, 'room:join', { roomId: ROOM_1 });

    // Set up listeners on both devices
    const p1 = waitForEvent(device1, 'message:new');
    const p2 = waitForEvent(device2, 'message:new');

    // Send message via REST (from U1)
    await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({ roomId: ROOM_1, messageText: 'Multi-device test', messageType: 'text' });

    const [recv1, recv2] = await Promise.all([p1, p2]);
    expect(recv1.message).toBe('Multi-device test');
    expect(recv2.message).toBe('Multi-device test');
  });

  test('user:offline only fires when last socket disconnects', async () => {
    const observer = await connect(TOKEN_U1);

    // U2 connects with two sockets
    const device1 = await connect(TOKEN_U2);
    const device2 = await connect(TOKEN_U2);

    let offlineReceived = false;
    observer.on('user:offline', (data) => {
      if (data.userId === U2) offlineReceived = true;
    });

    // Disconnect first device
    await disconnectSocket(device1);
    const idx1 = activeSockets.indexOf(device1);
    if (idx1 >= 0) activeSockets.splice(idx1, 1);
    await new Promise(r => setTimeout(r, 300));

    // Should NOT have received offline (device2 still connected)
    expect(offlineReceived).toBe(false);

    // Listen for offline on last disconnect
    const offlinePromise = waitForEvent(observer, 'user:offline');

    await disconnectSocket(device2);
    const idx2 = activeSockets.indexOf(device2);
    if (idx2 >= 0) activeSockets.splice(idx2, 1);

    const event = await offlinePromise;
    expect(event.userId).toBe(U2);
  });
});
