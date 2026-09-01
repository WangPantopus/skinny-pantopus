// ============================================================
// TEST: Chat REST API Routes
//
// Unit tests for the chat system REST endpoints in routes/chats.js.
// ============================================================

const { resetTables, seedTable, getTable, setRpcMock } = require('../__mocks__/supabaseAdmin');

jest.setTimeout(15000);

// ── Mock logger ──────────────────────────────────────────────
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// ── Mock verifyToken ─────────────────────────────────────────
jest.mock('../../middleware/verifyToken', () => (req, _res, next) => {
  if (req.headers['x-test-user-id']) {
    req.user = { id: req.headers['x-test-user-id'], role: 'user' };
  } else {
    req.user = { id: 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa', role: 'user' };
  }
  next();
});

// ── Mock badgeService ────────────────────────────────────────
jest.mock('../../services/badgeService', () => ({
  init: jest.fn(),
  emitBadgeUpdate: jest.fn(),
  emitBadgeUpdateToMany: jest.fn(),
}));

// ── Mock businessPermissions ─────────────────────────────────
jest.mock('../../utils/businessPermissions', () => ({
  hasPermission: jest.fn().mockResolvedValue(false),
}));

const express = require('express');
const request = require('supertest');
const badgeService = require('../../services/badgeService');

// ── Constants ────────────────────────────────────────────────
const U1 = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const U2 = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb';
const U3 = 'cccccccc-cccc-1ccc-8ccc-cccccccccccc';
const ROOM_D = 'dddddddd-dddd-1ddd-8ddd-dddddddddddd';
const ROOM_G = 'eeeeeeee-eeee-1eee-8eee-eeeeeeeeeeee';
const GIG_1 = 'ffffffff-ffff-1fff-8fff-ffffffffffff';
const FILE_1 = '11111111-1111-1111-8111-111111111111';
const FILE_OTHER = '22222222-2222-1222-8222-222222222222';
const MSG_ORIG = '33333333-3333-1333-8333-333333333333';

function createApp() {
  const app = express();
  app.use(express.json());
  const mockIo = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };
  app.set('io', mockIo);
  app.use('/api/chat', require('../../routes/chats'));
  return { app, mockIo };
}

// ── Seed data ────────────────────────────────────────────────
const ROOM_DIRECT = {
  id: ROOM_D,
  type: 'direct',
  name: null,
  description: null,
  gig_id: null,
  home_id: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const ROOM_GIG = {
  id: ROOM_G,
  type: 'gig',
  name: 'Gig Chat',
  description: null,
  gig_id: GIG_1,
  home_id: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const USER_1 = {
  id: U1,
  username: 'alice',
  name: 'Alice Smith',
  first_name: 'Alice',
  last_name: 'Smith',
  profile_picture_url: 'https://example.com/alice.jpg',
  account_type: 'personal',
};

const USER_2 = {
  id: U2,
  username: 'bob',
  name: 'Bob Jones',
  first_name: 'Bob',
  last_name: 'Jones',
  profile_picture_url: 'https://example.com/bob.jpg',
  account_type: 'personal',
};

const USER_3 = {
  id: U3,
  username: 'charlie',
  name: 'Charlie Brown',
  first_name: 'Charlie',
  last_name: 'Brown',
  profile_picture_url: null,
  account_type: 'personal',
};

function seedBaseData() {
  seedTable('User', [USER_1, USER_2, USER_3]);
  seedTable('ChatRoom', [ROOM_DIRECT, ROOM_GIG]);
  seedTable('ChatParticipant', [
    {
      id: 'cp-1',
      room_id: ROOM_D,
      user_id: U1,
      role: 'member',
      is_active: true,
      unread_count: 0,
      last_read_at: '2026-01-01T00:00:00Z',
      joined_at: '2026-01-01T00:00:00Z',
      left_at: null,
      // Embedded join data for GET /rooms (the mock doesn't resolve FK joins)
      room: ROOM_DIRECT,
      user: USER_1,
    },
    {
      id: 'cp-2',
      room_id: ROOM_D,
      user_id: U2,
      role: 'member',
      is_active: true,
      unread_count: 2,
      last_read_at: '2026-01-01T00:00:00Z',
      joined_at: '2026-01-01T00:00:00Z',
      left_at: null,
      room: ROOM_DIRECT,
      user: USER_2,
    },
    {
      id: 'cp-3',
      room_id: ROOM_G,
      user_id: U1,
      role: 'member',
      is_active: true,
      unread_count: 0,
      last_read_at: '2026-01-01T00:00:00Z',
      joined_at: '2026-01-01T00:00:00Z',
      left_at: null,
      room: ROOM_GIG,
      user: USER_1,
    },
    {
      id: 'cp-4',
      room_id: ROOM_G,
      user_id: U2,
      role: 'member',
      is_active: true,
      unread_count: 0,
      last_read_at: '2026-01-01T00:00:00Z',
      joined_at: '2026-01-01T00:00:00Z',
      left_at: null,
      room: ROOM_GIG,
      user: USER_2,
    },
  ]);
  seedTable('ChatMessage', []);
  seedTable('Gig', []);
  seedTable('GigBid', []);
  seedTable('File', []);
  seedTable('ConversationTopic', []);
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  seedBaseData();
});

// ============================================================
// POST /api/chat/messages — sendMessage
// ============================================================

describe('POST /api/chat/messages', () => {
  test('sends a valid text message and returns 201 with correct shape', async () => {
    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .send({
        roomId: ROOM_D,
        messageText: 'Hello world!',
        messageType: 'text',
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBeDefined();
    expect(res.body.message.room_id).toBe(ROOM_D);
    expect(res.body.message.message).toBe('Hello world!');
    expect(res.body.message.type).toBe('text');
    expect(res.body.message.user_id).toBe(U1);
    const messages = getTable('ChatMessage');
    expect(messages.length).toBe(1);
    expect(messages[0].message).toBe('Hello world!');
  });

  test('broadcasts message via socket.io to the room', async () => {
    const { app, mockIo } = createApp();

    await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .send({
        roomId: ROOM_D,
        messageText: 'Socket test',
        messageType: 'text',
      });

    expect(mockIo.to).toHaveBeenCalledWith(ROOM_D);
    expect(mockIo.emit).toHaveBeenCalledWith('message:new', expect.objectContaining({
      message: 'Socket test',
    }));
  });

  test('emits badge update to all room participants', async () => {
    const { app } = createApp();

    await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .send({
        roomId: ROOM_D,
        messageText: 'Badge test',
        messageType: 'text',
      });

    expect(badgeService.emitBadgeUpdateToMany).toHaveBeenCalled();
    const calledWith = badgeService.emitBadgeUpdateToMany.mock.calls[0][0];
    // Sender (U1) is excluded from badge updates — only recipients get notified
    expect(calledWith).not.toContain(U1);
    expect(calledWith).toContain(U2);
  });

  test('returns 403 when user is not a participant', async () => {
    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U3)
      .send({
        roomId: ROOM_D,
        messageText: 'Should not send',
        messageType: 'text',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not a participant/i);
    expect(getTable('ChatMessage').length).toBe(0);
  });

  test('returns 400 when Joi validation fails — missing roomId', async () => {
    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .send({
        messageText: 'No room',
        messageType: 'text',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  test('returns 400 when messageText is empty for text type', async () => {
    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .send({
        roomId: ROOM_D,
        messageText: '',
        messageType: 'text',
      });

    expect(res.status).toBe(400);
  });

  test('validates fileIds and builds attachment payload', async () => {
    seedTable('File', [
      {
        id: FILE_1,
        user_id: U1,
        file_url: 'https://example.com/photo.jpg',
        original_filename: 'photo.jpg',
        mime_type: 'image/jpeg',
        file_size: 12345,
        is_deleted: false,
        file_type: 'chat_file',
      },
    ]);

    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .send({
        roomId: ROOM_D,
        messageText: 'Check this out',
        messageType: 'image',
        fileIds: [FILE_1],
      });

    expect(res.status).toBe(201);
    expect(res.body.message.attachments).toHaveLength(1);
    expect(res.body.message.attachments[0].id).toBe(FILE_1);
    expect(res.body.message.attachments[0].mime_type).toBe('image/jpeg');
  });

  test('returns 400 when fileIds reference non-owned files', async () => {
    seedTable('File', [
      {
        id: FILE_OTHER,
        user_id: U2,
        file_url: 'https://example.com/photo.jpg',
        original_filename: 'photo.jpg',
        mime_type: 'image/jpeg',
        file_size: 12345,
        is_deleted: false,
        file_type: 'chat_file',
      },
    ]);

    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .send({
        roomId: ROOM_D,
        messageText: 'Check this out',
        messageType: 'image',
        fileIds: [FILE_OTHER],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid|not owned/i);
  });

  test('stores metadata when provided', async () => {
    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .send({
        roomId: ROOM_D,
        messageText: 'Offer message',
        messageType: 'gig_offer',
        metadata: { gigId: 'gig-123', price: 100 },
      });

    expect(res.status).toBe(201);
    const msg = getTable('ChatMessage')[0];
    expect(msg.metadata).toEqual({ gigId: 'gig-123', price: 100 });
  });

  test('links reply_to_id correctly', async () => {
    seedTable('ChatMessage', [{
      id: MSG_ORIG,
      room_id: ROOM_D,
      user_id: U2,
      message: 'Original message',
      type: 'text',
      deleted: false,
    }]);

    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .send({
        roomId: ROOM_D,
        messageText: 'Reply to you',
        messageType: 'text',
        replyToId: MSG_ORIG,
      });

    expect(res.status).toBe(201);
    expect(res.body.message.reply_to_id).toBe(MSG_ORIG);
  });

  test('enforces pre-bid message limit (429) for gig rooms', async () => {
    seedTable('Gig', [{
      id: GIG_1,
      user_id: U2,
      accepted_by: null,
    }]);
    seedTable('GigBid', []);

    seedTable('ChatMessage', [
      { id: 'msg-1', room_id: ROOM_G, user_id: U1, message: 'Hi 1', type: 'text', deleted: false },
      { id: 'msg-2', room_id: ROOM_G, user_id: U1, message: 'Hi 2', type: 'text', deleted: false },
      { id: 'msg-3', room_id: ROOM_G, user_id: U1, message: 'Hi 3', type: 'text', deleted: false },
    ]);

    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .send({
        roomId: ROOM_G,
        messageText: 'Fourth message',
        messageType: 'text',
      });

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('PRE_BID_LIMIT');
    expect(res.body.messages_limit).toBe(3);
  });

  test('allows gig owner to send unlimited messages', async () => {
    seedTable('Gig', [{
      id: GIG_1,
      user_id: U1,
      accepted_by: null,
    }]);

    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .send({
        roomId: ROOM_G,
        messageText: 'Owner message',
        messageType: 'text',
      });

    expect(res.status).toBe(201);
  });

  test('allows accepted worker to bypass pre-bid limit', async () => {
    seedTable('Gig', [{
      id: GIG_1,
      user_id: U2,
      accepted_by: U1,
    }]);

    seedTable('ChatMessage', [
      { id: 'msg-1', room_id: ROOM_G, user_id: U1, message: 'Hi 1', type: 'text', deleted: false },
      { id: 'msg-2', room_id: ROOM_G, user_id: U1, message: 'Hi 2', type: 'text', deleted: false },
      { id: 'msg-3', room_id: ROOM_G, user_id: U1, message: 'Hi 3', type: 'text', deleted: false },
    ]);

    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .send({
        roomId: ROOM_G,
        messageText: 'Worker message',
        messageType: 'text',
      });

    expect(res.status).toBe(201);
  });

  test('resets sender unread_count to 0 after sending', async () => {
    const participants = getTable('ChatParticipant');
    const p = participants.find(r => r.user_id === U1 && r.room_id === ROOM_D);
    if (p) p.unread_count = 5;

    const { app } = createApp();

    await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .send({
        roomId: ROOM_D,
        messageText: 'Reset my unread',
        messageType: 'text',
      });

    const updated = getTable('ChatParticipant')
      .find(r => r.user_id === U1 && r.room_id === ROOM_D);
    expect(updated.unread_count).toBe(0);
  });

  test('updates room updated_at timestamp after sending', async () => {
    const { app } = createApp();

    const beforeSend = ROOM_DIRECT.updated_at;

    await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .send({
        roomId: ROOM_D,
        messageText: 'Timestamp test',
        messageType: 'text',
      });

    const room = getTable('ChatRoom').find(r => r.id === ROOM_D);
    expect(room.updated_at).not.toBe(beforeSend);
  });
});

// ============================================================
// GET /api/chat/rooms — list user's chat rooms
// ============================================================

describe('GET /api/chat/rooms', () => {
  test('returns rooms user is a participant in', async () => {
    seedTable('ChatMessage', [{
      id: 'msg-1',
      room_id: ROOM_D,
      user_id: U2,
      message: 'Hey Alice!',
      type: 'text',
      deleted: false,
      created_at: '2026-01-02T00:00:00Z',
      attachments: [],
    }]);

    const { app } = createApp();

    const res = await request(app)
      .get('/api/chat/rooms')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.rooms).toBeDefined();
    expect(Array.isArray(res.body.rooms)).toBe(true);
    expect(res.body.rooms.length).toBe(2);
    expect(res.body.total).toBe(2);
  });

  test('includes unread counts and last message preview', async () => {
    seedTable('ChatMessage', [{
      id: 'msg-1',
      room_id: ROOM_D,
      user_id: U2,
      message: 'Hey Alice!',
      type: 'text',
      deleted: false,
      created_at: '2026-01-02T00:00:00Z',
      attachments: [],
    }]);

    // The rooms endpoint uses an RPC to fetch last-message previews
    setRpcMock(async (fnName, params) => {
      if (fnName === 'get_room_previews') {
        const roomIds = params.p_room_ids || [];
        const msgs = getTable('ChatMessage') || [];
        const previews = [];
        for (const rid of roomIds) {
          const last = msgs.filter(m => m.room_id === rid).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
          if (last) previews.push(last);
        }
        return { data: previews, error: null };
      }
      return { data: null, error: { message: 'Unknown RPC' } };
    });

    const { app } = createApp();

    const res = await request(app)
      .get('/api/chat/rooms')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    const directRoom = res.body.rooms.find(r => r.id === ROOM_D);
    expect(directRoom).toBeDefined();
    expect(directRoom.last_message_preview).toBe('Hey Alice!');
    expect(directRoom.unread_count).toBe(0);
  });

  test('filters rooms by type query param', async () => {
    seedTable('ChatMessage', []);

    const { app } = createApp();

    const res = await request(app)
      .get('/api/chat/rooms?type=gig')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.rooms.length).toBe(1);
    expect(res.body.rooms[0].room_type).toBe('gig');
  });

  test('returns other participant info for direct rooms', async () => {
    seedTable('ChatMessage', []);

    const { app } = createApp();

    const res = await request(app)
      .get('/api/chat/rooms')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    const directRoom = res.body.rooms.find(r => r.id === ROOM_D);
    expect(directRoom).toBeDefined();
    expect(directRoom.other_participant_id).toBe(U2);
    expect(directRoom.other_participant_name).toBeTruthy();
  });
});

// ============================================================
// GET /api/chat/rooms/:roomId/messages — fetch messages
// ============================================================

describe('GET /api/chat/rooms/:roomId/messages', () => {
  test('returns messages for a room the user participates in', async () => {
    seedTable('ChatMessage', [
      {
        id: 'msg-1',
        room_id: ROOM_D,
        user_id: U2,
        message: 'Hello',
        type: 'text',
        deleted: false,
        created_at: '2026-01-01T10:00:00Z',
      },
      {
        id: 'msg-2',
        room_id: ROOM_D,
        user_id: U1,
        message: 'Hi back',
        type: 'text',
        deleted: false,
        created_at: '2026-01-01T11:00:00Z',
      },
    ]);

    const { app } = createApp();

    const res = await request(app)
      .get(`/api/chat/rooms/${ROOM_D}/messages`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.messages).toBeDefined();
    expect(Array.isArray(res.body.messages)).toBe(true);
    expect(res.body.messages.length).toBe(2);
  });

  test('returns 403 when user is not a participant', async () => {
    const { app } = createApp();

    const res = await request(app)
      .get(`/api/chat/rooms/${ROOM_D}/messages`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U3);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/access denied/i);
  });

  test('omits deleted messages from room history', async () => {
    seedTable('ChatMessage', [{
      id: 'msg-del',
      room_id: ROOM_D,
      user_id: U2,
      message: 'secret text',
      type: 'text',
      deleted: true,
      deleted_at: '2026-01-01T12:00:00Z',
      created_at: '2026-01-01T10:00:00Z',
      attachments: [{ id: 'att-1' }],
    }]);

    const { app } = createApp();

    const res = await request(app)
      .get(`/api/chat/rooms/${ROOM_D}/messages`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.messages).toEqual([]);
  });

  test('includes hasMore flag when at message limit', async () => {
    seedTable('ChatMessage', [
      { id: 'msg-1', room_id: ROOM_D, user_id: U1, message: 'A', type: 'text', deleted: false, created_at: '2026-01-01T10:00:00Z' },
      { id: 'msg-2', room_id: ROOM_D, user_id: U1, message: 'B', type: 'text', deleted: false, created_at: '2026-01-01T11:00:00Z' },
    ]);

    const { app } = createApp();

    const res = await request(app)
      .get(`/api/chat/rooms/${ROOM_D}/messages?limit=2`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.hasMore).toBe(true);
  });
});

// ============================================================
// POST /api/chat/rooms/:roomId/read — mark room as read
// ============================================================

describe('POST /api/chat/rooms/:roomId/read', () => {
  test('marks room as read and resets unread_count', async () => {
    const participants = getTable('ChatParticipant');
    const p = participants.find(r => r.user_id === U1 && r.room_id === ROOM_D);
    if (p) p.unread_count = 5;

    const { app } = createApp();

    const res = await request(app)
      .post(`/api/chat/rooms/${ROOM_D}/read`)
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(0);

    const updated = getTable('ChatParticipant')
      .find(r => r.user_id === U1 && r.room_id === ROOM_D);
    expect(updated.unread_count).toBe(0);
  });

  test('emits badge update after marking read', async () => {
    const { app } = createApp();

    await request(app)
      .post(`/api/chat/rooms/${ROOM_D}/read`)
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(badgeService.emitBadgeUpdateToMany).toHaveBeenCalled();
  });

  test('returns no-op for invalid (non-UUID) roomId', async () => {
    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/rooms/new/read')
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(0);
  });
});
