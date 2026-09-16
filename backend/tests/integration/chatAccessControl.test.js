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


// N04 authorization failures must stop before persistence or delivery. These
// are route/service regressions with synthetic auth and the in-memory DB.
describe('Block authorization availability and ordering', () => {
  const db = require('../__mocks__/supabaseAdmin');
  const service = require('../../services/blockService');
  beforeEach(() => {
    for (const a of [U1, U2, U3, U_BIZ]) for (const b of [U1, U2, U3, U_BIZ]) service.invalidateBlockCache(a, b);
  });
  afterEach(() => jest.restoreAllMocks());

  test.each(['direct', 'messages'])('%s refuses an unavailable block check without effects', async endpoint => {
    const original = db.from.bind(db);
    jest.spyOn(db, 'from').mockImplementation(table => table === 'UserBlock'
      ? { select: () => ({ or: async () => ({ count: null, error: { message: 'database unavailable' } }) }) }
      : original(table));
    db.setRpcMock(async name => ({ data: name === 'get_or_create_direct_chat' ? ROOM_DIRECT : null, error: null }));
    const { app, mockIo } = createApp();
    const before = getTable('ChatMessage').length;
    const response = await request(app).post('/api/chat/' + endpoint).set('x-test-user-id', U1)
      .send(endpoint === 'direct' ? { otherUserId: U2 } : { roomId: ROOM_DIRECT, messageText: 'Must not escape', messageType: 'text' });
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('BLOCK_CHECK_UNAVAILABLE');
    expect(getTable('ChatMessage')).toHaveLength(before);
    expect(mockIo.emit).not.toHaveBeenCalled();
    expect(require('../__mocks__/notificationService').createNotification).not.toHaveBeenCalled();
  });

  test('every active counterparty is checked in a business direct room', async () => {
    getTable('ChatParticipant').push({ id: 'cp-team', room_id: ROOM_BIZ, user_id: U1, is_active: true });
    seedTable('UserBlock', [{ id: 'block', blocker_user_id: U2, blocked_user_id: U1 }]);
    const { app, mockIo } = createApp();
    const before = getTable('ChatMessage').length;
    const response = await request(app).post('/api/chat/messages').set('x-test-user-id', U1)
      .send({ roomId: ROOM_BIZ, messageText: 'Must not bypass second participant', messageType: 'text' });
    expect(response.status).toBe(403);
    expect(getTable('ChatMessage')).toHaveLength(before);
    expect(mockIo.emit).not.toHaveBeenCalled();
  });

  test('a delayed pre-block query cannot return or cache a stale allow after invalidation', async () => {
    let release;
    const first = new Promise(resolve => { release = resolve; });
    const query = jest.fn().mockReturnValueOnce(first).mockResolvedValue({ count: 1, error: null });
    const original = db.from.bind(db);
    jest.spyOn(db, 'from').mockImplementation(table => table === 'UserBlock'
      ? { select: () => ({ or: query }) } : original(table));
    const waiting = service.isBlocked(U1, U2);
    service.invalidateBlockCache(U2, U1);
    release({ count: 0, error: null });
    expect(await waiting).toBe(true);
    expect(await service.isBlocked(U2, U1)).toBe(true);
  });

  test('missing count is unavailable, not an empty block table', async () => {
    const original = db.from.bind(db);
    jest.spyOn(db, 'from').mockImplementation(table => table === 'UserBlock'
      ? { select: () => ({ or: async () => ({ count: null, error: null }) }) } : original(table));
    await expect(service.isBlocked(U1, U2)).rejects.toMatchObject({ code: 'BLOCK_CHECK_UNAVAILABLE' });
  });
});

// The canonical database has a global unique client_message_id index. The
// in-memory database does not model it, so these cases inject only that conflict.
describe('Message retry scope', () => {
  const db = require('../__mocks__/supabaseAdmin');
  const key = 'f9150300-0000-4000-8000-000000000501';
  beforeEach(() => {
    const service = require('../../services/blockService');
    for (const a of [U1, U2, U_BIZ, U_MEMBER]) for (const b of [U1, U2, U_BIZ, U_MEMBER]) service.invalidateBlockCache(a, b);
    const original = db.from.bind(db);
    jest.spyOn(db, 'from').mockImplementation(table => {
      const query = original(table);
      if (table === 'ChatMessage') {
        const insert = query.insert.bind(query);
        query.insert = payload => getTable('ChatMessage').some(row => row.client_message_id === payload.client_message_id)
          ? { select: () => ({ single: async () => ({ data: null, error: { code: '23505', message: 'idx_chat_message_client_id' } }) }) }
          : insert(payload);
      }
      return query;
    });
  });
  afterEach(() => jest.restoreAllMocks());
  function saved(overrides = {}) {
    seedTable('ChatMessage', [{ id: MSG_1, room_id: ROOM_DIRECT, user_id: U1, actor_user_id: null,
      client_message_id: key, message: 'Private saved text', type: 'text', deleted: false, ...overrides }]);
  }
  test.each([
    ['other room', { room_id: ROOM_BIZ }],
    ['other author', { user_id: U2 }],
  ])('does not return a retry from %s', async (_name, overrides) => {
    saved(overrides);
    const { app, mockIo } = createApp();
    const response = await request(app).post('/api/chat/messages').set('x-test-user-id', U1)
      .send({ roomId: ROOM_DIRECT, messageText: 'New content', messageType: 'text', clientMessageId: key });
    expect(response.status).toBe(409);
    expect(response.body.message).toBeUndefined();
    expect(getTable('ChatMessage')).toHaveLength(1);
    expect(mockIo.emit).not.toHaveBeenCalled();
  });
  test('same authorized room and human actor recover their saved message without effects', async () => {
    saved();
    const { app, mockIo } = createApp();
    const response = await request(app).post('/api/chat/messages').set('x-test-user-id', U1)
      .send({ roomId: ROOM_DIRECT, messageText: 'Lost reply retry', messageType: 'text', clientMessageId: key });
    expect(response.status).toBe(200);
    expect(response.body.message.id).toBe(MSG_1);
    expect(mockIo.emit).not.toHaveBeenCalled();
  });
  test('a concurrent same-scope insert recovers the winner without another broadcast', async () => {
    seedTable('ChatMessage', []);
    const previous = db.from.getMockImplementation();
    db.from.mockImplementation(table => {
      const query = previous(table);
      if (table === 'ChatMessage') query.insert = payload => {
        saved({ ...payload, actor_user_id: null });
        return { select: () => ({ single: async () => ({ data: null, error: { code: '23505', message: 'idx_chat_message_client_id' } }) }) };
      };
      return query;
    });
    const { app, mockIo } = createApp();
    const response = await request(app).post('/api/chat/messages').set('x-test-user-id', U1)
      .send({ roomId: ROOM_DIRECT, messageText: 'Concurrent winner', messageType: 'text', clientMessageId: key });
    expect(response.status).toBe(200);
    expect(response.body.message.id).toBe(MSG_1);
    expect(getTable('ChatMessage')).toHaveLength(1);
    expect(mockIo.emit).not.toHaveBeenCalled();
  });
  test('another authorized business actor cannot claim a colleague retry', async () => {
    saved({ room_id: ROOM_BIZ, user_id: U_BIZ, actor_user_id: U_MEMBER });
    getTable('ChatParticipant').push({ id: 'actor', room_id: ROOM_BIZ, user_id: U1, is_active: true });
    hasPermission.mockResolvedValue(true);
    const { app, mockIo } = createApp();
    const response = await request(app).post('/api/chat/messages').set('x-test-user-id', U1)
      .send({ roomId: ROOM_BIZ, asBusinessUserId: U_BIZ, messageText: 'Different actor', messageType: 'text', clientMessageId: key });
    expect(response.status).toBe(409);
    expect(response.body.message).toBeUndefined();
    expect(mockIo.emit).not.toHaveBeenCalled();
  });
});

// The isBlocked pre-check and the ChatMessage insert are separate PostgREST
// transactions, so a block can commit between them. The database re-decides
// admission inside the inserting transaction
// (20260916010000_direct_message_block_admission) and raises PT403. These cases
// pin the route's half of that contract: UserBlock stays EMPTY throughout, so
// the pre-check allows and only the persistence-boundary denial can fire.
describe('Direct send denied at the persistence boundary', () => {
  const db = require('../__mocks__/supabaseAdmin');
  const notifications = require('../__mocks__/notificationService');
  let insertSpy;

  function failInsertWith(error, { onlyFirst = false } = {}) {
    const original = db.from.bind(db);
    insertSpy = jest.fn();
    jest.spyOn(db, 'from').mockImplementation(table => {
      const query = original(table);
      if (table === 'ChatMessage') {
        const insert = query.insert.bind(query);
        query.insert = payload => {
          insertSpy(payload);
          if (onlyFirst && insertSpy.mock.calls.length > 1) return insert(payload);
          return { select: () => ({ single: async () => ({ data: null, error }) }) };
        };
      }
      return query;
    });
  }

  beforeEach(() => {
    const service = require('../../services/blockService');
    for (const a of [U1, U2, U_BIZ]) for (const b of [U1, U2, U_BIZ]) service.invalidateBlockCache(a, b);
    seedTable('UserBlock', []);
  });
  afterEach(() => jest.restoreAllMocks());

  const send = app => request(app).post('/api/chat/messages').set('x-test-user-id', U1)
    .send({ roomId: ROOM_DIRECT, messageText: 'Raced a committed block', messageType: 'text' });

  test.each([
    ['DIRECT_MESSAGE_BLOCKED'],
    ['DIRECT_MESSAGE_ACTOR_INVALID'],
  ])('%s is refused with no row, no broadcast and no notification', async message => {
    failInsertWith({ code: 'PT403', message, details: 'Direct message refused', hint: null });
    const { app, mockIo } = createApp();
    const before = getTable('ChatMessage').length;

    const response = await send(app);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/unable to message/i);
    expect(getTable('ChatMessage')).toHaveLength(before);
    expect(mockIo.emit).not.toHaveBeenCalled();
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });

  test('the denial is not re-attempted with a stripped payload', async () => {
    failInsertWith({ code: 'PT403', message: 'DIRECT_MESSAGE_BLOCKED' });
    const { app } = createApp();

    expect((await send(app)).status).toBe(403);
    expect(insertSpy).toHaveBeenCalledTimes(1);
  });

  test('the legacy actor_user_id fallback still recovers and is not captured', async () => {
    failInsertWith({ message: 'column "actor_user_id" does not exist' }, { onlyFirst: true });
    const { app, mockIo } = createApp();
    const before = getTable('ChatMessage').length;

    const response = await send(app);

    expect(response.status).toBe(201);
    expect(insertSpy).toHaveBeenCalledTimes(2);
    expect(getTable('ChatMessage')).toHaveLength(before + 1);
    expect(mockIo.emit).toHaveBeenCalled();
  });

  test('the denial body is byte-identical to losing the pre-check', async () => {
    seedTable('UserBlock', [{ id: 'block', blocker_user_id: U2, blocked_user_id: U1 }]);
    const { app } = createApp();
    const precheck = await send(app);
    jest.restoreAllMocks();

    seedTable('UserBlock', []);
    require('../../services/blockService').invalidateBlockCache(U1, U2);
    failInsertWith({ code: 'PT403', message: 'DIRECT_MESSAGE_BLOCKED' });
    const raced = await send(createApp().app);

    expect(precheck.status).toBe(403);
    expect(raced.status).toBe(precheck.status);
    expect(raced.body).toEqual(precheck.body);
  });

  test('a PostgrestError-shaped rejection keeps the token on message', async () => {
    // supabase-js surfaces the PostgREST body as {message, details, hint, code};
    // matching on `message` survives even if `details` is ever dropped.
    const error = Object.assign(new Error('DIRECT_MESSAGE_BLOCKED'), {
      code: 'PT403', details: 'Direct message refused; this conversation has an active block',
      hint: null, name: 'PostgrestError',
    });
    failInsertWith(error);
    const { app, mockIo } = createApp();

    const response = await send(app);

    expect(error.message).toBe('DIRECT_MESSAGE_BLOCKED');
    expect(response.status).toBe(403);
    expect(mockIo.emit).not.toHaveBeenCalled();
  });
});
