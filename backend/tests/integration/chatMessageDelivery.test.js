// ============================================================
// INTEGRATION TEST: Chat Message Delivery Integrity
//
// Verifies message persistence, idempotency, pagination,
// reactions, soft-delete, editing, attachments, topic/reply
// validation, unified-conversations, and badge counts.
//
// Uses the in-memory supabase mock (same approach as other tests).
// ============================================================

const { resetTables, seedTable, getTable, setRpcMock } = require('../__mocks__/supabaseAdmin');

// ── Mock verifyToken ─────────────────────────────────────────
jest.mock('../../middleware/verifyToken', () => (req, _res, next) => {
  req.user = { id: req.headers['x-test-user-id'] || 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa', role: 'user' };
  next();
});

jest.mock('../../services/badgeService', () => ({
  init: jest.fn(),
  emitBadgeUpdate: jest.fn(),
  emitBadgeUpdateToMany: jest.fn(),
}));

jest.mock('../../utils/businessPermissions', () => ({
  hasPermission: jest.fn().mockResolvedValue(false),
}));

const badgeService = require('../../services/badgeService');
const express = require('express');
const request = require('supertest');

// ── Constants ────────────────────────────────────────────────

const U1 = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const U2 = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb';
const ROOM_D = 'dd000000-0000-4000-a000-000000000001';
const ROOM_GROUP = 'dd000000-0000-4000-a000-000000000002';
const MSG_1 = 'dd000000-0000-4000-a000-000000000010';
const MSG_2 = 'dd000000-0000-4000-a000-000000000011';
const MSG_DEL = 'dd000000-0000-4000-a000-000000000012';
const FILE_1 = 'dd000000-0000-4000-a000-000000000020';
const TOPIC_1 = 'dd000000-0000-4000-a000-000000000030';
const CLIENT_MSG_ID = 'dd000000-0000-4000-a000-000000000099';

function createApp() {
  const app = express();
  app.use(express.json());
  const mockIo = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
  app.set('io', mockIo);
  app.use('/api/chat', require('../../routes/chats'));
  return { app, mockIo };
}

const ROOM_DIRECT_OBJ = { id: ROOM_D, type: 'direct', name: null, description: null, gig_id: null, home_id: null, is_active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
const ROOM_GROUP_OBJ = { id: ROOM_GROUP, type: 'group', name: 'Test Group', description: 'A group', gig_id: null, home_id: null, is_active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };

function seedBaseData() {
  seedTable('User', [
    { id: U1, username: 'alice', name: 'Alice', first_name: 'Alice', last_name: 'A', profile_picture_url: null, account_type: 'personal' },
    { id: U2, username: 'bob', name: 'Bob', first_name: 'Bob', last_name: 'B', profile_picture_url: null, account_type: 'personal' },
  ]);
  seedTable('LocalProfile', [
    { id: 'lp-u2', user_id: U2, handle: 'bob', display_name: 'Bobby Local', avatar_url: null },
  ]);
  seedTable('ChatRoom', [ROOM_DIRECT_OBJ, ROOM_GROUP_OBJ]);
  seedTable('ChatParticipant', [
    { id: 'cp-1', room_id: ROOM_D, user_id: U1, role: 'member', is_active: true, unread_count: 0, last_read_at: '2026-01-01T00:00:00Z', joined_at: '2026-01-01T00:00:00Z', left_at: null, room: ROOM_DIRECT_OBJ, user: { id: U1, username: 'alice', name: 'Alice', profile_picture_url: null } },
    { id: 'cp-2', room_id: ROOM_D, user_id: U2, role: 'member', is_active: true, unread_count: 0, last_read_at: '2026-01-01T00:00:00Z', joined_at: '2026-01-01T00:00:00Z', left_at: null, room: ROOM_DIRECT_OBJ, user: { id: U2, username: 'bob', name: 'Bob', profile_picture_url: null } },
    { id: 'cp-3', room_id: ROOM_GROUP, user_id: U1, role: 'member', is_active: true, unread_count: 0, last_read_at: '2026-01-01T00:00:00Z', joined_at: '2026-01-01T00:00:00Z', left_at: null, room: ROOM_GROUP_OBJ, user: { id: U1, username: 'alice', name: 'Alice', profile_picture_url: null } },
    { id: 'cp-4', room_id: ROOM_GROUP, user_id: U2, role: 'member', is_active: true, unread_count: 0, last_read_at: '2026-01-01T00:00:00Z', joined_at: '2026-01-01T00:00:00Z', left_at: null, room: ROOM_GROUP_OBJ, user: { id: U2, username: 'bob', name: 'Bob', profile_picture_url: null } },
  ]);
  seedTable('ChatMessage', [
    { id: MSG_1, room_id: ROOM_D, user_id: U1, message: 'Hello', type: 'text', deleted: false, created_at: '2026-01-01T10:00:00Z' },
    { id: MSG_2, room_id: ROOM_D, user_id: U2, message: 'World', type: 'text', deleted: false, created_at: '2026-01-01T11:00:00Z' },
    { id: MSG_DEL, room_id: ROOM_D, user_id: U1, message: 'Secret', type: 'text', deleted: true, deleted_at: '2026-01-01T12:00:00Z', created_at: '2026-01-01T09:00:00Z' },
  ]);
  seedTable('MessageReaction', []);
  seedTable('Gig', []);
  seedTable('GigBid', []);
  seedTable('File', []);
  seedTable('UserBlock', []);
  seedTable('ConversationTopic', []);
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  seedBaseData();
});

// ============================================================
// 1. Message persisted with correct fields
// ============================================================

describe('Message persistence', () => {
  test('message sent via REST is persisted and returned with correct fields', async () => {
    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({ roomId: ROOM_D, messageText: 'Test msg', messageType: 'text' });

    expect(res.status).toBe(201);
    const msg = res.body.message;
    expect(msg.room_id).toBe(ROOM_D);
    expect(msg.user_id).toBe(U1);
    expect(msg.message).toBe('Test msg');
    expect(msg.type).toBe('text');
    expect(msg.deleted).toBeFalsy();
    expect(msg.id).toBeDefined();

    // Verify in-memory persistence
    const stored = getTable('ChatMessage').find(m => m.id === msg.id);
    expect(stored).toBeDefined();
    expect(stored.message).toBe('Test msg');
  });
});

// ============================================================
// 2-3. Idempotency with clientMessageId
// ============================================================

describe('clientMessageId idempotency', () => {
  test('message sent with clientMessageId is idempotent on retry', async () => {
    const { app } = createApp();

    const payload = { roomId: ROOM_D, messageText: 'Idempotent msg', messageType: 'text', clientMessageId: CLIENT_MSG_ID };

    const res1 = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send(payload);

    expect(res1.status).toBe(201);
    const firstMsgId = res1.body.message.id;

    // Retry with same clientMessageId
    const res2 = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send(payload);

    expect(res2.status).toBe(200);
    expect(res2.body.message.id).toBe(firstMsgId);
  });

  test('duplicate clientMessageId returns existing message, not a new one', async () => {
    const { app } = createApp();

    const payload = { roomId: ROOM_D, messageText: 'Dedup test', messageType: 'text', clientMessageId: CLIENT_MSG_ID };

    await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send(payload);

    const beforeCount = getTable('ChatMessage').length;

    await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send(payload);

    // No new message inserted
    expect(getTable('ChatMessage').length).toBe(beforeCount);
  });
});

// ============================================================
// 4. Soft-deleted messages
// ============================================================

describe('Soft-deleted message display', () => {
  test('soft-deleted message is omitted from the message list', async () => {
    const { app } = createApp();

    const res = await request(app)
      .get(`/api/chat/rooms/${ROOM_D}/messages`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1);

    expect(res.status).toBe(200);
    const deleted = res.body.messages.find(m => m.id === MSG_DEL);
    expect(deleted).toBeUndefined();
  });
});

// ============================================================
// 5. Edited message
// ============================================================

describe('Message editing', () => {
  test('edited message returns updated text with edited: true flag', async () => {
    const { app } = createApp();

    const res = await request(app)
      .put(`/api/chat/messages/${MSG_1}`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({ messageText: 'Updated hello' });

    expect(res.status).toBe(200);
    expect(res.body.message.message).toBe('Updated hello');
    expect(res.body.message.edited).toBe(true);
    expect(res.body.message.edited_at).toBeDefined();

    // Verify persisted
    const stored = getTable('ChatMessage').find(m => m.id === MSG_1);
    expect(stored.message).toBe('Updated hello');
    expect(stored.edited).toBe(true);
  });
});

// ============================================================
// 6. Pagination with before cursor
// ============================================================

describe('Pagination', () => {
  test('before cursor filters messages correctly with no duplicates', async () => {
    // Create 5 messages with distinct timestamps
    seedTable('ChatMessage', [
      { id: 'pg-1', room_id: ROOM_D, user_id: U1, message: 'A', type: 'text', deleted: false, created_at: '2026-01-01T01:00:00Z' },
      { id: 'pg-2', room_id: ROOM_D, user_id: U1, message: 'B', type: 'text', deleted: false, created_at: '2026-01-01T02:00:00Z' },
      { id: 'pg-3', room_id: ROOM_D, user_id: U1, message: 'C', type: 'text', deleted: false, created_at: '2026-01-01T03:00:00Z' },
      { id: 'pg-4', room_id: ROOM_D, user_id: U1, message: 'D', type: 'text', deleted: false, created_at: '2026-01-01T04:00:00Z' },
      { id: 'pg-5', room_id: ROOM_D, user_id: U1, message: 'E', type: 'text', deleted: false, created_at: '2026-01-01T05:00:00Z' },
    ]);

    const { app } = createApp();

    // Fetch all messages first (mock doesn't enforce limit)
    const allRes = await request(app)
      .get(`/api/chat/rooms/${ROOM_D}/messages`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1);

    expect(allRes.status).toBe(200);
    expect(allRes.body.messages.length).toBe(5);

    // Use a composite cursor for message C to fetch only earlier messages
    const cursor = `2026-01-01T03:00:00Z|pg-3`;
    const beforeRes = await request(app)
      .get(`/api/chat/rooms/${ROOM_D}/messages?before=${encodeURIComponent(cursor)}`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1);

    expect(beforeRes.status).toBe(200);
    // Should return only A and B (before C)
    const ids = beforeRes.body.messages.map(m => m.id);
    expect(ids).toContain('pg-1');
    expect(ids).toContain('pg-2');
    expect(ids).not.toContain('pg-3');
    expect(ids).not.toContain('pg-4');
    expect(ids).not.toContain('pg-5');
  });

  test('same-timestamp messages with composite cursor exclude cursor message', async () => {
    // Messages with identical timestamps but different IDs
    const sameTs = '2026-01-01T03:00:00Z';
    seedTable('ChatMessage', [
      { id: 'st-aaa', room_id: ROOM_D, user_id: U1, message: 'Same-1', type: 'text', deleted: false, created_at: sameTs },
      { id: 'st-bbb', room_id: ROOM_D, user_id: U1, message: 'Same-2', type: 'text', deleted: false, created_at: sameTs },
      { id: 'st-ccc', room_id: ROOM_D, user_id: U1, message: 'Same-3', type: 'text', deleted: false, created_at: sameTs },
    ]);

    const { app } = createApp();

    // Use composite cursor pointing to st-bbb — should get messages with id < 'st-bbb' at same ts
    const cursor = `${sameTs}|st-bbb`;
    const res = await request(app)
      .get(`/api/chat/rooms/${ROOM_D}/messages?before=${encodeURIComponent(cursor)}`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1);

    expect(res.status).toBe(200);
    const ids = res.body.messages.map(m => m.id);
    // st-aaa < st-bbb alphabetically, so it should be included
    expect(ids).toContain('st-aaa');
    // st-bbb is the cursor, should NOT be included
    expect(ids).not.toContain('st-bbb');
  });
});

// ============================================================
// 7. Reply-to validation
// ============================================================

describe('Reply-to validation', () => {
  test('invalid replyToId returns 400', async () => {
    const { app } = createApp();
    const fakeReplyId = 'ffffffff-ffff-4fff-bfff-ffffffffffff';

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({ roomId: ROOM_D, messageText: 'Reply test', messageType: 'text', replyToId: fakeReplyId });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reply target not found/i);
  });

  test('replyToId pointing to deleted message returns 400', async () => {
    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({ roomId: ROOM_D, messageText: 'Reply to deleted', messageType: 'text', replyToId: MSG_DEL });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reply target not found/i);
  });

  test('valid replyToId succeeds', async () => {
    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({ roomId: ROOM_D, messageText: 'Reply to hello', messageType: 'text', replyToId: MSG_1 });

    expect(res.status).toBe(201);
    expect(res.body.message.reply_to_id).toBe(MSG_1);
  });
});

// ============================================================
// 8. Topic validation
// ============================================================

describe('Topic validation', () => {
  test('invalid topicId returns 400', async () => {
    const { app } = createApp();
    const fakeTopicId = 'ffffffff-ffff-4fff-bfff-fffffffffff0';

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({ roomId: ROOM_D, messageText: 'Topic test', messageType: 'text', topicId: fakeTopicId });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid topic/i);
  });

  test('topicId where user is not a participant returns 400', async () => {
    // Topic exists but U1 is not one of the conversation users
    const U_OTHER = 'cccccccc-cccc-1ccc-8ccc-cccccccccccc';
    seedTable('ConversationTopic', [{
      id: TOPIC_1,
      topic_type: 'general',
      topic_ref_id: null,
      title: 'Test Topic',
      status: 'active',
      conversation_user_id_1: U2,
      conversation_user_id_2: U_OTHER,
    }]);

    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({ roomId: ROOM_D, messageText: 'Not my topic', messageType: 'text', topicId: TOPIC_1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid topic/i);
  });
});

// ============================================================
// 9-10. Reaction toggle and summary
// ============================================================

describe('Reactions', () => {
  test('reaction toggle (add → remove → add) works correctly', async () => {
    const { app } = createApp();

    // Add reaction
    const r1 = await request(app)
      .post(`/api/chat/messages/${MSG_1}/react`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({ reaction: '👍' });

    expect(r1.status).toBe(200);
    expect(r1.body.reactions.length).toBe(1);
    expect(r1.body.reactions[0].reaction).toBe('👍');
    expect(r1.body.reactions[0].count).toBe(1);

    // Remove reaction (toggle off)
    const r2 = await request(app)
      .post(`/api/chat/messages/${MSG_1}/react`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({ reaction: '👍' });

    expect(r2.status).toBe(200);
    expect(r2.body.reactions.length).toBe(0);

    // Add again
    const r3 = await request(app)
      .post(`/api/chat/messages/${MSG_1}/react`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({ reaction: '👍' });

    expect(r3.status).toBe(200);
    expect(r3.body.reactions.length).toBe(1);
    expect(r3.body.reactions[0].count).toBe(1);
  });

  test('switching to a different emoji adds a second distinct reaction for that user', async () => {
    const { app } = createApp();

    const first = await request(app)
      .post(`/api/chat/messages/${MSG_1}/react`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({ reaction: '👍' });

    expect(first.status).toBe(200);
    expect(first.body.reactions).toHaveLength(1);
    expect(first.body.reactions[0].reaction).toBe('👍');

    const second = await request(app)
      .post(`/api/chat/messages/${MSG_1}/react`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({ reaction: '🔥' });

    expect(second.status).toBe(200);
    expect(second.body.reactions).toHaveLength(2);
    const reactions = second.body.reactions.map((r) => r.reaction);
    expect(reactions).toContain('👍');
    expect(reactions).toContain('🔥');

    const summary = await request(app)
      .get(`/api/chat/messages/${MSG_1}/reactions`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1);

    expect(summary.status).toBe(200);
    expect(summary.body.reactions).toHaveLength(2);
  });

  test('reaction summary includes correct reacted_by_me for requesting user', async () => {
    const { app } = createApp();

    // U1 reacts
    await request(app)
      .post(`/api/chat/messages/${MSG_1}/react`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({ reaction: '❤️' });

    // U2 reacts with same emoji
    await request(app)
      .post(`/api/chat/messages/${MSG_1}/react`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U2)
      .send({ reaction: '❤️' });

    // Fetch as U1 — should see reacted_by_me = true
    const res1 = await request(app)
      .get(`/api/chat/messages/${MSG_1}/reactions`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1);

    expect(res1.status).toBe(200);
    const heartU1 = res1.body.reactions.find(r => r.reaction === '❤️');
    expect(heartU1).toBeDefined();
    expect(heartU1.count).toBe(2);
    expect(heartU1.reacted_by_me).toBe(true);

    // Fetch as U2 — should also see reacted_by_me = true
    const res2 = await request(app)
      .get(`/api/chat/messages/${MSG_1}/reactions`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U2);

    expect(res2.status).toBe(200);
    const heartU2 = res2.body.reactions.find(r => r.reaction === '❤️');
    expect(heartU2.reacted_by_me).toBe(true);
  });
});

// ============================================================
// 11. Message with attachments
// ============================================================

describe('Attachments', () => {
  test('message with attachments returns attachment metadata in response', async () => {
    seedTable('File', [{
      id: FILE_1,
      user_id: U1,
      file_url: 'https://example.com/photo.jpg',
      original_filename: 'photo.jpg',
      mime_type: 'image/jpeg',
      file_size: 12345,
      is_deleted: false,
      file_type: 'chat_file',
    }]);

    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({
        roomId: ROOM_D,
        messageText: 'See attachment',
        messageType: 'image',
        fileIds: [FILE_1],
      });

    expect(res.status).toBe(201);
    expect(res.body.message.attachments).toHaveLength(1);
    expect(res.body.message.attachments[0].id).toBe(FILE_1);
    expect(res.body.message.attachments[0].mime_type).toBe('image/jpeg');
    expect(res.body.message.attachments[0].original_filename).toBe('photo.jpg');
  });
});

// ============================================================
// 12. Unified conversations
// ============================================================

describe('Unified conversations', () => {
  test('returns person-grouped results for direct rooms and separate entries for group rooms', async () => {
    // Set up RPC mock for get_room_previews
    setRpcMock(async (fnName, params) => {
      if (fnName === 'get_room_previews') {
        const roomIds = params.p_room_ids || [];
        const msgs = getTable('ChatMessage');
        const previews = [];
        for (const rid of roomIds) {
          const roomMsgs = msgs
            .filter(m => m.room_id === rid && !m.deleted)
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
          if (roomMsgs.length > 0) {
            previews.push({ room_id: rid, message: roomMsgs[0].message, created_at: roomMsgs[0].created_at, type: roomMsgs[0].type });
          }
        }
        return { data: previews, error: null };
      }
      return { data: null, error: { message: 'Unknown RPC' } };
    });

    const { app } = createApp();

    const res = await request(app)
      .get('/api/chat/unified-conversations')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1);

    expect(res.status).toBe(200);
    expect(res.body.conversations).toBeDefined();
    expect(Array.isArray(res.body.conversations)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(1);

    // Should have a person-grouped entry for U2 (from direct room)
    const personConv = res.body.conversations.find(c => c._type === 'conversation' && c.other_participant_id === U2);
    expect(personConv).toBeDefined();
    expect(personConv.room_ids).toContain(ROOM_D);
    expect(personConv.other_participant_name).toBe('Bobby Local');
    expect(personConv.other_participant_name).not.toBe('Bob');

    // Should have a room entry for the group room
    const groupConv = res.body.conversations.find(c => c._type === 'room' && c.id === ROOM_GROUP);
    expect(groupConv).toBeDefined();
    expect(groupConv.room_type).toBe('group');
    expect(groupConv.room_name).toBe('Test Group');
  });
});

// ============================================================
// 13. Badge counts update after send and mark-read
// ============================================================

describe('Badge counts', () => {
  test('badge update emitted after message send', async () => {
    const { app } = createApp();

    await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({ roomId: ROOM_D, messageText: 'Badge test', messageType: 'text' });

    expect(badgeService.emitBadgeUpdateToMany).toHaveBeenCalled();
    // Recipients should include U2 (other participant), not the sender
    const calledWith = badgeService.emitBadgeUpdateToMany.mock.calls[0][0];
    expect(calledWith).toContain(U2);
  });

  test('badge update emitted after mark-read', async () => {
    // Give U1 some unread count
    const participants = getTable('ChatParticipant');
    const p = participants.find(r => r.user_id === U1 && r.room_id === ROOM_D);
    if (p) p.unread_count = 5;

    const { app } = createApp();

    const res = await request(app)
      .post(`/api/chat/rooms/${ROOM_D}/read`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(0);
    expect(badgeService.emitBadgeUpdateToMany).toHaveBeenCalled();

    // Verify unread count persisted as 0
    const updated = getTable('ChatParticipant').find(r => r.user_id === U1 && r.room_id === ROOM_D);
    expect(updated.unread_count).toBe(0);
  });
});
