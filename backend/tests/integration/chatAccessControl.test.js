// ============================================================
// INTEGRATION TEST: Chat Access Control
//
// Verifies that the chat REST API enforces access control correctly:
// - Active vs removed vs non-participant access
// - Block enforcement on direct chats and messages
// - Business identity permission checks
// - Message ownership for edit/delete
// - Pre-bid message limits in gig chats
//
// Uses the in-memory supabase mock (same approach as other integration tests).
// ============================================================

const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');

// ── Mock verifyToken ─────────────────────────────────────────
const U1 = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa'; // Active participant

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
const { hasPermission } = require('../../utils/businessPermissions');
const express = require('express');
const request = require('supertest');

// ── Constants ────────────────────────────────────────────────

// U1 is declared above (needed before jest.mock)
const U2 = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb'; // Active participant
const U3 = 'cccccccc-cccc-1ccc-8ccc-cccccccccccc'; // Non-participant
const U_REMOVED = 'dddddddd-dddd-1ddd-8ddd-dddddddddddd'; // Removed participant
const U_BIZ = 'eeeeeeee-eeee-1eee-8eee-eeeeeeeeeeee'; // Business account
const U_MEMBER = 'ffffffff-ffff-1fff-8fff-ffffffffffff'; // Business team member

const ROOM_DIRECT = 'aa000000-0000-0000-0000-000000000001';
const ROOM_GIG = 'aa000000-0000-0000-0000-000000000002';
const ROOM_BIZ = 'aa000000-0000-0000-0000-000000000003';
const GIG_ID = 'aa000000-0000-0000-0000-000000000010';
const MSG_1 = 'aa000000-0000-0000-0000-000000000020';
const MSG_2 = 'aa000000-0000-0000-0000-000000000021';

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

function seedBaseData() {
  seedTable('User', [
    { id: U1, username: 'alice', name: 'Alice', first_name: 'Alice', last_name: 'A', profile_picture_url: null, account_type: 'personal' },
    { id: U2, username: 'bob', name: 'Bob', first_name: 'Bob', last_name: 'B', profile_picture_url: null, account_type: 'personal' },
    { id: U3, username: 'charlie', name: 'Charlie', first_name: 'Charlie', last_name: 'C', profile_picture_url: null, account_type: 'personal' },
    { id: U_REMOVED, username: 'removed', name: 'Removed', first_name: 'Removed', last_name: 'R', profile_picture_url: null, account_type: 'personal' },
    { id: U_BIZ, username: 'biz_acme', name: 'Acme Inc', first_name: 'Acme', last_name: 'Inc', profile_picture_url: null, account_type: 'business' },
    { id: U_MEMBER, username: 'team_member', name: 'Team Member', first_name: 'Team', last_name: 'Member', profile_picture_url: null, account_type: 'personal' },
  ]);

  seedTable('ChatRoom', [
    { id: ROOM_DIRECT, type: 'direct', name: null, description: null, gig_id: null, home_id: null, is_active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    { id: ROOM_GIG, type: 'gig', name: 'Gig Chat', description: null, gig_id: GIG_ID, home_id: null, is_active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    { id: ROOM_BIZ, type: 'direct', name: null, description: null, gig_id: null, home_id: null, is_active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  ]);

  const DIRECT = { id: ROOM_DIRECT, type: 'direct', name: null, description: null, gig_id: null, home_id: null, is_active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
  const GIG = { id: ROOM_GIG, type: 'gig', name: 'Gig Chat', description: null, gig_id: GIG_ID, home_id: null, is_active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
  const BIZ = { id: ROOM_BIZ, type: 'direct', name: null, description: null, gig_id: null, home_id: null, is_active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };

  seedTable('ChatParticipant', [
    // Direct room: U1 and U2 active, U_REMOVED removed
    { id: 'cp-1', room_id: ROOM_DIRECT, user_id: U1, role: 'member', is_active: true, unread_count: 0, last_read_at: '2026-01-01T00:00:00Z', joined_at: '2026-01-01T00:00:00Z', left_at: null, room: DIRECT, user: { id: U1, username: 'alice', name: 'Alice', profile_picture_url: null } },
    { id: 'cp-2', room_id: ROOM_DIRECT, user_id: U2, role: 'member', is_active: true, unread_count: 0, last_read_at: '2026-01-01T00:00:00Z', joined_at: '2026-01-01T00:00:00Z', left_at: null, room: DIRECT, user: { id: U2, username: 'bob', name: 'Bob', profile_picture_url: null } },
    { id: 'cp-removed', room_id: ROOM_DIRECT, user_id: U_REMOVED, role: 'member', is_active: false, unread_count: 0, last_read_at: '2026-01-01T00:00:00Z', joined_at: '2026-01-01T00:00:00Z', left_at: '2026-01-02T00:00:00Z', room: DIRECT, user: { id: U_REMOVED, username: 'removed', name: 'Removed', profile_picture_url: null } },
    // Gig room: U1 and U2 active
    { id: 'cp-3', room_id: ROOM_GIG, user_id: U1, role: 'member', is_active: true, unread_count: 0, last_read_at: '2026-01-01T00:00:00Z', joined_at: '2026-01-01T00:00:00Z', left_at: null, room: GIG, user: { id: U1, username: 'alice', name: 'Alice', profile_picture_url: null } },
    { id: 'cp-4', room_id: ROOM_GIG, user_id: U2, role: 'member', is_active: true, unread_count: 0, last_read_at: '2026-01-01T00:00:00Z', joined_at: '2026-01-01T00:00:00Z', left_at: null, room: GIG, user: { id: U2, username: 'bob', name: 'Bob', profile_picture_url: null } },
    // Business room: U_BIZ and U2
    { id: 'cp-biz', room_id: ROOM_BIZ, user_id: U_BIZ, role: 'owner', is_active: true, unread_count: 0, last_read_at: '2026-01-01T00:00:00Z', joined_at: '2026-01-01T00:00:00Z', left_at: null, room: BIZ, user: { id: U_BIZ, username: 'biz_acme', name: 'Acme Inc', profile_picture_url: null } },
    { id: 'cp-biz2', room_id: ROOM_BIZ, user_id: U2, role: 'member', is_active: true, unread_count: 0, last_read_at: '2026-01-01T00:00:00Z', joined_at: '2026-01-01T00:00:00Z', left_at: null, room: BIZ, user: { id: U2, username: 'bob', name: 'Bob', profile_picture_url: null } },
  ]);

  seedTable('ChatMessage', [
    { id: MSG_1, room_id: ROOM_DIRECT, user_id: U1, message: 'Hello from Alice', type: 'text', deleted: false, created_at: '2026-01-01T10:00:00Z' },
    { id: MSG_2, room_id: ROOM_DIRECT, user_id: U2, message: 'Hello from Bob', type: 'text', deleted: false, created_at: '2026-01-01T11:00:00Z' },
  ]);

  seedTable('Gig', []);
  seedTable('GigBid', []);
  seedTable('File', []);
  seedTable('UserBlock', []);
  seedTable('MessageReaction', []);
  seedTable('ConversationTopic', []);
  seedTable('BusinessSeat', []);
  seedTable('SeatBinding', []);
  seedTable('BusinessTeam', []);
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  seedBaseData();
});

// ============================================================
// 1. Active participant CAN fetch room, messages, and participants
// ============================================================

describe('Active participant access', () => {
  test('CAN fetch rooms', async () => {
    const { app } = createApp();

    const res = await request(app)
      .get('/api/chat/rooms')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1);

    expect(res.status).toBe(200);
    expect(res.body.rooms.length).toBeGreaterThanOrEqual(1);
  });

  test('CAN fetch messages for a room they participate in', async () => {
    const { app } = createApp();

    const res = await request(app)
      .get(`/api/chat/rooms/${ROOM_DIRECT}/messages`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1);

    expect(res.status).toBe(200);
    expect(res.body.messages).toBeDefined();
    expect(res.body.messages.length).toBe(2);
  });
});

// ============================================================
// 2. Removed participant (is_active = false) CANNOT access
// ============================================================

describe('Removed participant access', () => {
  test('CAN still read messages from room they were removed from (read-only access preserved)', async () => {
    // The route allows removed participants to read message history.
    // Only sending/reacting is blocked by the is_active check.
    const { app } = createApp();

    const res = await request(app)
      .get(`/api/chat/rooms/${ROOM_DIRECT}/messages`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U_REMOVED);

    expect(res.status).toBe(200);
    expect(res.body.messages).toBeDefined();
  });

  test('CANNOT send messages to room they were removed from', async () => {
    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U_REMOVED)
      .send({
        roomId: ROOM_DIRECT,
        messageText: 'Should not send',
        messageType: 'text',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not a participant/i);
  });

  test('CANNOT toggle reactions in room they were removed from', async () => {
    const { app } = createApp();

    const res = await request(app)
      .post(`/api/chat/messages/${MSG_1}/react`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U_REMOVED)
      .send({ reaction: '👍' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/access denied/i);
  });
});

// ============================================================
// 3. Non-participant CANNOT access
// ============================================================

describe('Non-participant access', () => {
  test('CANNOT fetch messages from room they are not in', async () => {
    const { app } = createApp();

    const res = await request(app)
      .get(`/api/chat/rooms/${ROOM_DIRECT}/messages`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U3);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/access denied/i);
  });

  test('CANNOT send messages to room they are not in', async () => {
    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U3)
      .send({
        roomId: ROOM_DIRECT,
        messageText: 'Intruder message',
        messageType: 'text',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not a participant/i);
  });

  test('CANNOT toggle reactions on messages in rooms they are not in', async () => {
    const { app } = createApp();

    const res = await request(app)
      .post(`/api/chat/messages/${MSG_1}/react`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U3)
      .send({ reaction: '❤️' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/access denied/i);
  });
});

// ============================================================
// 4. Blocked user CANNOT create direct chat or send messages
// ============================================================

describe('Blocked user enforcement', () => {
  test('blocked user CANNOT create a direct chat', async () => {
    // U1 has blocked U3
    seedTable('UserBlock', [
      { id: 'block-1', blocker_user_id: U1, blocked_user_id: U3 },
    ]);

    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/direct')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({ otherUserId: U3 });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/unable to message/i);
  });

  test('blocked user CANNOT send messages in direct chat', async () => {
    // U2 blocks U1 (bidirectional check)
    seedTable('UserBlock', [
      { id: 'block-2', blocker_user_id: U2, blocked_user_id: U1 },
    ]);

    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({
        roomId: ROOM_DIRECT,
        messageText: 'Should be blocked',
        messageType: 'text',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/unable to message/i);
  });
});

// ============================================================
// 5. Business team member WITH permission CAN send as business
// ============================================================

describe('Business identity — with permission', () => {
  test('team member with permission CAN send message as business identity', async () => {
    // Grant gigs.manage permission to U_MEMBER for U_BIZ
    hasPermission.mockImplementation(async (bizId, userId, perm) => {
      if (String(bizId) === U_BIZ && String(userId) === U_MEMBER &&
          (perm === 'gigs.manage' || perm === 'gigs.post')) {
        return true;
      }
      return false;
    });

    // Add U_MEMBER as participant in the business room
    getTable('ChatParticipant').push({
      id: 'cp-member-biz',
      room_id: ROOM_BIZ,
      user_id: U_MEMBER,
      role: 'member',
      is_active: true,
      unread_count: 0,
      last_read_at: '2026-01-01T00:00:00Z',
      joined_at: '2026-01-01T00:00:00Z',
      left_at: null,
    });

    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U_MEMBER)
      .send({
        roomId: ROOM_BIZ,
        messageText: 'Message from team member as business',
        messageType: 'text',
        asBusinessUserId: U_BIZ,
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBeDefined();
    expect(res.body.message.user_id).toBe(U_BIZ);
  });
});

// ============================================================
// 6. Business team member WITHOUT permission CANNOT send as business
// ============================================================

describe('Business identity — without permission', () => {
  test('team member without permission CANNOT send message as business identity', async () => {
    // hasPermission returns false (default mock)
    hasPermission.mockResolvedValue(false);

    // Add U_MEMBER as participant
    getTable('ChatParticipant').push({
      id: 'cp-member-biz-2',
      room_id: ROOM_BIZ,
      user_id: U_MEMBER,
      role: 'member',
      is_active: true,
      unread_count: 0,
      last_read_at: '2026-01-01T00:00:00Z',
      joined_at: '2026-01-01T00:00:00Z',
      left_at: null,
    });

    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U_MEMBER)
      .send({
        roomId: ROOM_BIZ,
        messageText: 'Unauthorized business message',
        messageType: 'text',
        asBusinessUserId: U_BIZ,
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/permission/i);
  });
});

// ============================================================
// 7. Message sender CAN edit and delete their own message
// ============================================================

describe('Message ownership — sender', () => {
  test('sender CAN edit their own message', async () => {
    const { app } = createApp();

    const res = await request(app)
      .put(`/api/chat/messages/${MSG_1}`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({ messageText: 'Updated message from Alice' });

    expect(res.status).toBe(200);
    expect(res.body.message.message).toBe('Updated message from Alice');
    expect(res.body.message.edited).toBe(true);
  });

  test('sender CAN delete their own message', async () => {
    const { app } = createApp();

    const res = await request(app)
      .delete(`/api/chat/messages/${MSG_1}`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1);

    expect(res.status).toBe(200);

    const msg = getTable('ChatMessage').find(m => m.id === MSG_1);
    expect(msg.deleted).toBe(true);
  });
});

// ============================================================
// 8. Non-sender CANNOT edit or delete another user's message
// ============================================================

describe('Message ownership — non-sender', () => {
  test('non-sender CANNOT edit another user\'s message', async () => {
    const { app } = createApp();

    const res = await request(app)
      .put(`/api/chat/messages/${MSG_1}`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U2)
      .send({ messageText: 'Tampered text' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not authorized/i);
  });

  test('non-sender CANNOT delete another user\'s message', async () => {
    const { app } = createApp();

    const res = await request(app)
      .delete(`/api/chat/messages/${MSG_1}`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U2);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not authorized/i);
  });
});

// ============================================================
// 9. Removed participant CANNOT send messages or reactions
// ============================================================

describe('Removed participant — send and react', () => {
  test('removed participant CANNOT send messages', async () => {
    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U_REMOVED)
      .send({
        roomId: ROOM_DIRECT,
        messageText: 'Ghost message',
        messageType: 'text',
      });

    expect(res.status).toBe(403);
  });

  test('removed participant CANNOT toggle reactions', async () => {
    const { app } = createApp();

    const res = await request(app)
      .post(`/api/chat/messages/${MSG_1}/react`)
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U_REMOVED)
      .send({ reaction: '🎉' });

    expect(res.status).toBe(403);
  });
});

// ============================================================
// 10. Pre-bid user CANNOT send more than 3 messages in gig chat
// ============================================================

describe('Pre-bid message limit in gig chat', () => {
  test('non-poster, non-bidder CANNOT exceed 3 messages', async () => {
    // Set up the gig — U2 is poster, U1 has no bid
    seedTable('Gig', [
      { id: GIG_ID, user_id: U2, accepted_by: null },
    ]);
    seedTable('GigBid', []);

    // U1 already sent 3 messages
    seedTable('ChatMessage', [
      { id: 'gig-msg-1', room_id: ROOM_GIG, user_id: U1, message: 'Msg 1', type: 'text', deleted: false },
      { id: 'gig-msg-2', room_id: ROOM_GIG, user_id: U1, message: 'Msg 2', type: 'text', deleted: false },
      { id: 'gig-msg-3', room_id: ROOM_GIG, user_id: U1, message: 'Msg 3', type: 'text', deleted: false },
    ]);

    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({
        roomId: ROOM_GIG,
        messageText: 'Fourth message — should fail',
        messageType: 'text',
      });

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('PRE_BID_LIMIT');
    expect(res.body.messages_limit).toBe(3);
  });

  test('gig poster CAN send unlimited messages', async () => {
    seedTable('Gig', [
      { id: GIG_ID, user_id: U1, accepted_by: null },
    ]);

    // Clear messages from base data
    seedTable('ChatMessage', []);

    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({
        roomId: ROOM_GIG,
        messageText: 'Owner can always send',
        messageType: 'text',
      });

    expect(res.status).toBe(201);
  });

  test('accepted worker CAN bypass pre-bid limit', async () => {
    seedTable('Gig', [
      { id: GIG_ID, user_id: U2, accepted_by: U1 },
    ]);

    seedTable('ChatMessage', [
      { id: 'gig-msg-1', room_id: ROOM_GIG, user_id: U1, message: 'Msg 1', type: 'text', deleted: false },
      { id: 'gig-msg-2', room_id: ROOM_GIG, user_id: U1, message: 'Msg 2', type: 'text', deleted: false },
      { id: 'gig-msg-3', room_id: ROOM_GIG, user_id: U1, message: 'Msg 3', type: 'text', deleted: false },
    ]);

    const { app } = createApp();

    const res = await request(app)
      .post('/api/chat/messages')
      .set('Authorization', 'Bearer test-token')
      .set('x-test-user-id', U1)
      .send({
        roomId: ROOM_GIG,
        messageText: 'Worker can send after acceptance',
        messageType: 'text',
      });

    expect(res.status).toBe(201);
  });
});
