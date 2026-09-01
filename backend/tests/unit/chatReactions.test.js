// ============================================================
// TEST: Chat Reaction Endpoints
//
// Unit tests for message reaction REST endpoints in routes/chats.js.
// ============================================================

const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');

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

// ── Constants ────────────────────────────────────────────────
const U1 = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const U2 = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb';
const U3 = 'cccccccc-cccc-1ccc-8ccc-cccccccccccc'; // non-participant
const ROOM_D = 'dddddddd-dddd-1ddd-8ddd-dddddddddddd';
const MSG_1 = '11111111-1111-1111-8111-111111111111';
const MSG_2 = '22222222-2222-1222-8222-222222222222';
const MSG_DEL = '33333333-3333-1333-8333-333333333333';

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
const USER_1 = {
  id: U1, username: 'alice', name: 'Alice Smith',
  first_name: 'Alice', last_name: 'Smith',
  profile_picture_url: 'https://example.com/alice.jpg',
  account_type: 'personal',
};
const USER_2 = {
  id: U2, username: 'bob', name: 'Bob Jones',
  first_name: 'Bob', last_name: 'Jones',
  profile_picture_url: 'https://example.com/bob.jpg',
  account_type: 'personal',
};
const USER_3 = {
  id: U3, username: 'charlie', name: 'Charlie Brown',
  first_name: 'Charlie', last_name: 'Brown',
  profile_picture_url: null,
  account_type: 'personal',
};

const ROOM_DIRECT = {
  id: ROOM_D, type: 'direct', name: null, description: null,
  gig_id: null, home_id: null, is_active: true,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

function seedBaseData() {
  seedTable('User', [USER_1, USER_2, USER_3]);
  seedTable('ChatRoom', [ROOM_DIRECT]);
  seedTable('ChatParticipant', [
    {
      id: 'cp-1', room_id: ROOM_D, user_id: U1, role: 'member',
      is_active: true, unread_count: 0, last_read_at: '2026-01-01T00:00:00Z',
      joined_at: '2026-01-01T00:00:00Z', left_at: null,
      room: ROOM_DIRECT, user: USER_1,
    },
    {
      id: 'cp-2', room_id: ROOM_D, user_id: U2, role: 'member',
      is_active: true, unread_count: 0, last_read_at: '2026-01-01T00:00:00Z',
      joined_at: '2026-01-01T00:00:00Z', left_at: null,
      room: ROOM_DIRECT, user: USER_2,
    },
  ]);
  seedTable('ChatMessage', [
    {
      id: MSG_1, room_id: ROOM_D, user_id: U2, message: 'Hello',
      type: 'text', deleted: false, created_at: '2026-01-01T10:00:00Z',
    },
    {
      id: MSG_2, room_id: ROOM_D, user_id: U1, message: 'Hi back',
      type: 'text', deleted: false, created_at: '2026-01-01T11:00:00Z',
    },
    {
      id: MSG_DEL, room_id: ROOM_D, user_id: U2, message: 'Deleted msg',
      type: 'text', deleted: true, deleted_at: '2026-01-01T12:00:00Z',
      created_at: '2026-01-01T09:00:00Z',
    },
  ]);
  seedTable('MessageReaction', []);
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
// POST /api/chat/messages/:messageId/react
// ============================================================

describe('POST /api/chat/messages/:messageId/react', () => {
  test('adds a reaction and returns summary with count 1', async () => {
    const { app } = createApp();

    const res = await request(app)
      .post(`/api/chat/messages/${MSG_1}/react`)
      .set('Authorization', 'Bearer test-token')
      .send({ reaction: '\u{1F44D}' }); // 👍

    expect(res.status).toBe(200);
    expect(res.body.reactions).toBeDefined();
    expect(Array.isArray(res.body.reactions)).toBe(true);
    expect(res.body.reactions.length).toBe(1);
    expect(res.body.reactions[0].reaction).toBe('\u{1F44D}');
    expect(res.body.reactions[0].count).toBe(1);
    expect(res.body.reactions[0].reacted_by_me).toBe(true);
    expect(res.body.reactions[0].users).toHaveLength(1);
    expect(res.body.reactions[0].users[0].id).toBe(U1);

    // Verify stored in table
    const stored = getTable('MessageReaction');
    expect(stored.length).toBe(1);
    expect(stored[0].message_id).toBe(MSG_1);
    expect(stored[0].user_id).toBe(U1);
    expect(stored[0].reaction).toBe('\u{1F44D}');
  });

  test('toggles off same reaction (removes it)', async () => {
    // Pre-seed a reaction
    seedTable('MessageReaction', [{
      id: 'rxn-1', message_id: MSG_1, user_id: U1, reaction: '\u{1F44D}',
      created_at: '2026-01-01T10:01:00Z',
    }]);

    const { app } = createApp();

    const res = await request(app)
      .post(`/api/chat/messages/${MSG_1}/react`)
      .set('Authorization', 'Bearer test-token')
      .send({ reaction: '\u{1F44D}' });

    expect(res.status).toBe(200);
    expect(res.body.reactions).toEqual([]);

    // Verify removed from table
    const stored = getTable('MessageReaction');
    expect(stored.length).toBe(0);
  });

  test('two users react with same emoji → count is 2', async () => {
    // U2 already reacted
    seedTable('MessageReaction', [{
      id: 'rxn-1', message_id: MSG_1, user_id: U2, reaction: '\u{2764}\u{FE0F}',
      created_at: '2026-01-01T10:01:00Z',
    }]);

    const { app } = createApp();

    // U1 also reacts with same emoji
    const res = await request(app)
      .post(`/api/chat/messages/${MSG_1}/react`)
      .set('Authorization', 'Bearer test-token')
      .send({ reaction: '\u{2764}\u{FE0F}' }); // ❤️

    expect(res.status).toBe(200);
    expect(res.body.reactions.length).toBe(1);
    expect(res.body.reactions[0].count).toBe(2);
    expect(res.body.reactions[0].reacted_by_me).toBe(true);
    expect(res.body.reactions[0].users).toHaveLength(2);
  });

  test('user reacts with different emoji → both appear', async () => {
    // U1 already reacted with 👍
    seedTable('MessageReaction', [{
      id: 'rxn-1', message_id: MSG_1, user_id: U1, reaction: '\u{1F44D}',
      created_at: '2026-01-01T10:01:00Z',
    }]);

    const { app } = createApp();

    // U1 adds a different reaction
    const res = await request(app)
      .post(`/api/chat/messages/${MSG_1}/react`)
      .set('Authorization', 'Bearer test-token')
      .send({ reaction: '\u{1F525}' }); // 🔥

    expect(res.status).toBe(200);
    expect(res.body.reactions.length).toBe(2);
    const emojis = res.body.reactions.map((r) => r.reaction);
    expect(emojis).toContain('\u{1F44D}');
    expect(emojis).toContain('\u{1F525}');
  });

  test('returns 403 for non-participant', async () => {
    const { app } = createApp();

    const res = await request(app)
      .post(`/api/chat/messages/${MSG_1}/react`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U3)
      .send({ reaction: '\u{1F44D}' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/access denied/i);
    expect(getTable('MessageReaction').length).toBe(0);
  });

  test('returns 404 for non-existent message', async () => {
    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages/99999999-9999-9999-9999-999999999999/react')
      .set('Authorization', 'Bearer test-token')
      .send({ reaction: '\u{1F44D}' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('returns 404 for deleted message', async () => {
    const { app } = createApp();

    const res = await request(app)
      .post(`/api/chat/messages/${MSG_DEL}/react`)
      .set('Authorization', 'Bearer test-token')
      .send({ reaction: '\u{1F44D}' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('returns 400 when reaction field exceeds max length', async () => {
    const { app } = createApp();

    const res = await request(app)
      .post(`/api/chat/messages/${MSG_1}/react`)
      .set('Authorization', 'Bearer test-token')
      .send({ reaction: 'this-is-way-too-long-for-a-reaction' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  test('returns 400 when reaction field is missing', async () => {
    const { app } = createApp();

    const res = await request(app)
      .post(`/api/chat/messages/${MSG_1}/react`)
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  test('reacted_by_me is correct per requesting user', async () => {
    // U1 reacted
    seedTable('MessageReaction', [{
      id: 'rxn-1', message_id: MSG_1, user_id: U1, reaction: '\u{1F44D}',
      created_at: '2026-01-01T10:01:00Z',
    }]);

    const { app } = createApp();

    // U2 adds their own reaction (different emoji)
    const res = await request(app)
      .post(`/api/chat/messages/${MSG_1}/react`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U2)
      .send({ reaction: '\u{2764}\u{FE0F}' });

    expect(res.status).toBe(200);
    const thumbs = res.body.reactions.find((r) => r.reaction === '\u{1F44D}');
    const heart = res.body.reactions.find((r) => r.reaction === '\u{2764}\u{FE0F}');
    // U2 is the requester, so 👍 should have reacted_by_me=false, ❤️ should be true
    expect(thumbs.reacted_by_me).toBe(false);
    expect(heart.reacted_by_me).toBe(true);
  });

  test('broadcasts message:reaction_updated via socket.io', async () => {
    const { app, mockIo } = createApp();

    await request(app)
      .post(`/api/chat/messages/${MSG_1}/react`)
      .set('Authorization', 'Bearer test-token')
      .send({ reaction: '\u{1F44D}' });

    expect(mockIo.to).toHaveBeenCalledWith(ROOM_D);
    expect(mockIo.emit).toHaveBeenCalledWith('message:reaction_updated', expect.objectContaining({
      messageId: MSG_1,
      reactions: expect.any(Array),
    }));
  });
});

// ============================================================
// GET /api/chat/messages/:messageId/reactions
// ============================================================

describe('GET /api/chat/messages/:messageId/reactions', () => {
  test('returns correct reaction summary', async () => {
    seedTable('MessageReaction', [
      { id: 'rxn-1', message_id: MSG_1, user_id: U1, reaction: '\u{1F44D}', created_at: '2026-01-01T10:01:00Z' },
      { id: 'rxn-2', message_id: MSG_1, user_id: U2, reaction: '\u{1F44D}', created_at: '2026-01-01T10:02:00Z' },
      { id: 'rxn-3', message_id: MSG_1, user_id: U1, reaction: '\u{2764}\u{FE0F}', created_at: '2026-01-01T10:03:00Z' },
    ]);

    const { app } = createApp();

    const res = await request(app)
      .get(`/api/chat/messages/${MSG_1}/reactions`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.reactions).toBeDefined();
    expect(res.body.reactions.length).toBe(2);

    const thumbs = res.body.reactions.find((r) => r.reaction === '\u{1F44D}');
    expect(thumbs.count).toBe(2);
    expect(thumbs.reacted_by_me).toBe(true);
    expect(thumbs.users).toHaveLength(2);

    const heart = res.body.reactions.find((r) => r.reaction === '\u{2764}\u{FE0F}');
    expect(heart.count).toBe(1);
    expect(heart.reacted_by_me).toBe(true);
  });

  test('returns empty array when no reactions', async () => {
    const { app } = createApp();

    const res = await request(app)
      .get(`/api/chat/messages/${MSG_1}/reactions`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.reactions).toEqual([]);
  });

  test('returns 403 for non-participant', async () => {
    const { app } = createApp();

    const res = await request(app)
      .get(`/api/chat/messages/${MSG_1}/reactions`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U3);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/access denied/i);
  });

  test('returns 404 for non-existent message', async () => {
    const { app } = createApp();

    const res = await request(app)
      .get('/api/chat/messages/99999999-9999-9999-9999-999999999999/reactions')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
  });
});

// ============================================================
// GET /api/chat/rooms/:roomId/messages — reactions included
// ============================================================

describe('GET /api/chat/rooms/:roomId/messages (reactions)', () => {
  test('each message includes reactions array', async () => {
    seedTable('MessageReaction', [
      { id: 'rxn-1', message_id: MSG_1, user_id: U1, reaction: '\u{1F44D}', created_at: '2026-01-01T10:01:00Z' },
      { id: 'rxn-2', message_id: MSG_1, user_id: U2, reaction: '\u{1F44D}', created_at: '2026-01-01T10:02:00Z' },
    ]);

    const { app } = createApp();

    const res = await request(app)
      .get(`/api/chat/rooms/${ROOM_D}/messages`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    // Find MSG_1 in the response
    const msg1 = res.body.messages.find((m) => m.id === MSG_1);
    expect(msg1).toBeDefined();
    expect(msg1.reactions).toBeDefined();
    expect(Array.isArray(msg1.reactions)).toBe(true);
    expect(msg1.reactions.length).toBe(1);
    expect(msg1.reactions[0].reaction).toBe('\u{1F44D}');
    expect(msg1.reactions[0].count).toBe(2);
  });

  test('messages with no reactions have empty reactions array', async () => {
    const { app } = createApp();

    const res = await request(app)
      .get(`/api/chat/rooms/${ROOM_D}/messages`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    for (const msg of res.body.messages) {
      expect(msg.reactions).toBeDefined();
      expect(Array.isArray(msg.reactions)).toBe(true);
      expect(msg.reactions).toEqual([]);
    }
  });

  test('reacted_by_me reflects the requesting user', async () => {
    seedTable('MessageReaction', [
      { id: 'rxn-1', message_id: MSG_1, user_id: U2, reaction: '\u{1F44D}', created_at: '2026-01-01T10:01:00Z' },
    ]);

    const { app } = createApp();

    // Request as U1 (not the one who reacted)
    const res = await request(app)
      .get(`/api/chat/rooms/${ROOM_D}/messages`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    const msg1 = res.body.messages.find((m) => m.id === MSG_1);
    expect(msg1.reactions[0].reacted_by_me).toBe(false);

    // Request as U2 (who reacted)
    const res2 = await request(app)
      .get(`/api/chat/rooms/${ROOM_D}/messages`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U2);

    expect(res2.status).toBe(200);
    const msg1v2 = res2.body.messages.find((m) => m.id === MSG_1);
    expect(msg1v2.reactions[0].reacted_by_me).toBe(true);
  });
});
