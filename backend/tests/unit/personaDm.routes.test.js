/**
 * P1.12 — persona DM routes + reply policy + audience notifications.
 *
 * Audience Profile design v2 §6.2 (notification firewall — every
 * notification fires from a registered audience-context template),
 * §7.2 (reply-policy SLA tracking), §10 (route surface).
 *
 * notificationService is auto-mocked via jest.config moduleNameMapper,
 * so we can assert on createNotification.mock.calls. Lives under
 * tests/unit/ so `npm test` runs it.
 */

const supabaseAdmin = require('../__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable } = supabaseAdmin;

const express = require('express');
const request = require('supertest');

const featureFlagService = require('../../services/featureFlagService');
const notificationService = require('../../services/notificationService');
const personaDmsRouter = require('../../routes/personaDms');

const FLAG_NAME = 'audience_profile';
const OWNER_ID    = '11111111-1111-4111-8111-111111111111';
const FAN_ID      = '22222222-2222-4222-8222-222222222222';
const FAN2_ID     = '23232323-2323-4323-8323-232323232323';
const STRANGER_ID = '33333333-3333-4333-8333-333333333333';
const PERSONA_ID  = '44444444-4444-4444-4444-444444444444';
const TIER_1_ID   = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const TIER_2_ID   = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const TIER_3_ID   = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/personas/:id/dms', personaDmsRouter);
  return app;
}
function asUser(req, userId) {
  return req.set('x-test-user-id', userId);
}

function seedFlagOn() {
  seedTable('FeatureFlag', [{
    id: 'flag-1', flag_name: FLAG_NAME,
    enabled_globally: true, enabled_for_internal_team: false,
    beta_user_ids: [], description: '',
    created_at: '2026-05-08T00:00:00Z', updated_at: '2026-05-08T00:00:00Z',
  }]);
  featureFlagService.invalidateFlagCache();
}

function seedBaseFixtures(replyPolicy = 'discretion') {
  seedTable('User', [
    { id: OWNER_ID,    role: 'user', username: 'owner_handle' },
    { id: FAN_ID,      role: 'user', username: 'fan_handle' },
    { id: FAN2_ID,     role: 'user', username: 'fan_two_handle' },
    { id: STRANGER_ID, role: 'user', username: 'stranger_handle' },
  ]);
  seedTable('PublicPersona', [{
    id: PERSONA_ID, user_id: OWNER_ID,
    handle: 'mayabuilds', display_name: 'Maya Builds', status: 'active',
  }]);
  seedTable('PersonaTier', [
    { id: TIER_1_ID, persona_id: PERSONA_ID, rank: 1, name: 'Follower',
      price_cents: 0, status: 'active',
      msg_threads_per_period: null, creator_can_initiate_dm: false,
      reply_policy: 'discretion' },
    { id: TIER_2_ID, persona_id: PERSONA_ID, rank: 2, name: 'Member',
      price_cents: 500, status: 'active',
      msg_threads_per_period: 5, creator_can_initiate_dm: false,
      reply_policy: replyPolicy },
    { id: TIER_3_ID, persona_id: PERSONA_ID, rank: 3, name: 'Insider',
      price_cents: 1500, status: 'active',
      msg_threads_per_period: 25, creator_can_initiate_dm: true,
      reply_policy: replyPolicy },
  ]);
  seedTable('PersonaQuotaUsage', []);
  seedTable('PersonaDmThread', []);
  seedTable('PersonaDmMessage', []);
  seedTable('PersonaBlock', []);
  seedTable('Notification', []);
}

function seedMembership({ id = 'mem-fan', userId = FAN_ID, tierId = TIER_2_ID } = {}) {
  const memberships = getTable('PersonaMembership');
  memberships.push({
    id,
    persona_id: PERSONA_ID,
    user_id: userId,
    tier_id: tierId,
    fan_handle: `fan_${userId.slice(0, 4)}`,
    fan_handle_normalized: `fan_${userId.slice(0, 4)}`,
    fan_display_name: `lurker_${userId.slice(0, 4)}`,
    status: 'active',
    current_period_start: '2026-04-15T00:00:00.000Z',
    current_period_end: '2099-05-15T00:00:00.000Z',
    joined_at: '2026-04-15T00:00:00.000Z',
  });
  return memberships[memberships.length - 1];
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  notificationService.createNotification.mockResolvedValue({ id: 'noti-1' });
  seedBaseFixtures();
  seedFlagOn();
});

afterEach(() => featureFlagService.invalidateFlagCache());

// ===========================================================================
// 1, 2, 3. POST /threads — open path + gates.
// ===========================================================================
describe('POST /api/personas/:id/dms/threads', () => {
  test('1. fan opens thread → 201 + audience-context creator notification', async () => {
    seedMembership();
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/dms/threads`),
      FAN_ID,
    ).send({ body: 'First DM' });

    expect(res.status).toBe(201);
    expect(res.body.threadId).toBeTruthy();
    expect(res.body.quotaRemaining).toBe(4);

    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
    const call = notificationService.createNotification.mock.calls[0][0];
    expect(call).toMatchObject({
      userId: OWNER_ID,
      type: 'persona_dm_received_creator',
      context: 'audience',
    });
    // Notification metadata uses fan_handle, never fan user_id.
    expect(call.metadata).toMatchObject({
      thread_id: res.body.threadId,
      fan_handle: expect.stringMatching(/^fan_/),
    });
    expect(JSON.stringify(call)).not.toContain(FAN_ID);
  });

  test('2. fan with quota exhausted → 402', async () => {
    const m = seedMembership();
    seedTable('PersonaQuotaUsage', Array.from({ length: 5 }, (_, i) => ({
      id: `usage-${i}`, membership_id: m.id,
      period_start: '2026-04-15T00:00:00.000Z',
      period_end:   '2099-05-15T00:00:00.000Z',
      capability: 'msg_thread',
      used_at: '2026-04-20T00:00:00Z',
      reverted_at: null,
    })));

    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/dms/threads`),
      FAN_ID,
    ).send({ body: 'Out of quota' });
    expect(res.status).toBe(402);
    expect(res.body.error).toBe('quota_exhausted');
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  test('3. fan in PersonaBlock → 403, no notification', async () => {
    seedMembership();
    seedTable('PersonaBlock', [{
      id: 'pb-1', persona_id: PERSONA_ID, blocked_user_id: FAN_ID,
      source: 'persona_owner_action',
    }]);
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/dms/threads`),
      FAN_ID,
    ).send({ body: 'Hi' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('blocked');
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  test('non-member → 403', async () => {
    seedTable('PersonaMembership', []);
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/dms/threads`),
      FAN_ID,
    ).send({ body: 'Hi' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('no_membership');
  });
});

// ===========================================================================
// 4, 5. GET /threads — list visibility.
// ===========================================================================
describe('GET /api/personas/:id/dms/threads', () => {
  function seedTwoOpenThreads() {
    const m1 = seedMembership({ id: 'mem-fan',  userId: FAN_ID });
    const m2 = seedMembership({ id: 'mem-fan2', userId: FAN2_ID });
    seedTable('PersonaDmThread', [
      { id: 'thread-1', persona_id: PERSONA_ID, membership_id: m1.id,
        initiated_by_user_id: FAN_ID,  initiated_by_role: 'fan',
        status: 'open', fan_unread_count: 0, creator_unread_count: 1,
        last_message_at: '2026-05-08T01:00:00Z',
        last_message_preview: 'Hi from fan-1' },
      { id: 'thread-2', persona_id: PERSONA_ID, membership_id: m2.id,
        initiated_by_user_id: FAN2_ID, initiated_by_role: 'fan',
        status: 'open', fan_unread_count: 0, creator_unread_count: 1,
        last_message_at: '2026-05-08T02:00:00Z',
        last_message_preview: 'Hi from fan-2' },
    ]);
  }

  test('4. owner sees all threads on the persona', async () => {
    seedTwoOpenThreads();
    const res = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/dms/threads`),
      OWNER_ID,
    );
    expect(res.status).toBe(200);
    const ids = res.body.threads.map((t) => t.id).sort();
    expect(ids).toEqual(['thread-1', 'thread-2']);
    // Owner's unread counter is creator_unread_count.
    expect(res.body.threads.every((t) => t.unreadCount === 1)).toBe(true);
  });

  test('5. fan sees only their own threads', async () => {
    seedTwoOpenThreads();
    const res = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/dms/threads`),
      FAN_ID,
    );
    expect(res.status).toBe(200);
    expect(res.body.threads.map((t) => t.id)).toEqual(['thread-1']);
    // Fan's unread counter is fan_unread_count (0 here).
    expect(res.body.threads[0].unreadCount).toBe(0);
  });

  test('non-member fan sees an empty list', async () => {
    seedTwoOpenThreads();
    const res = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/dms/threads`),
      STRANGER_ID,
    );
    expect(res.status).toBe(200);
    expect(res.body.threads).toEqual([]);
  });

  test('listed thread shape carries fan_handle/tier but NO user_id', async () => {
    seedTwoOpenThreads();
    const res = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/dms/threads`),
      OWNER_ID,
    );
    const t = res.body.threads.find((x) => x.id === 'thread-1');
    expect(t.fanHandle).toMatch(/^fan_/);
    expect(t.tier).toMatchObject({ rank: 2, name: 'Member' });
    expect(JSON.stringify(t)).not.toContain(FAN_ID);
    expect(JSON.stringify(t)).not.toContain(OWNER_ID);
  });
});

// ===========================================================================
// 6, 7. GET /threads/:threadId — detail.
// ===========================================================================
describe('GET /api/personas/:id/dms/threads/:threadId', () => {
  function seedThreadWithMessages({ replyPolicy = 'within_3_days', includeCreatorReply = false } = {}) {
    seedBaseFixtures(replyPolicy);
    seedFlagOn();
    const m = seedMembership();
    seedTable('PersonaDmThread', [{
      id: 'thread-1', persona_id: PERSONA_ID, membership_id: m.id,
      initiated_by_user_id: FAN_ID, initiated_by_role: 'fan',
      status: 'open', fan_unread_count: 0, creator_unread_count: 1,
      created_at: '2026-04-30T00:00:00Z',
      last_message_at: '2026-04-30T00:00:00Z',
      last_message_preview: 'Hi',
    }]);
    const msgs = [
      { id: 'msg-1', thread_id: 'thread-1', sender_role: 'fan',
        sender_user_id: FAN_ID, body: 'Initial fan ping',
        created_at: '2026-04-30T00:00:00Z' },
    ];
    if (includeCreatorReply) {
      msgs.push({ id: 'msg-2', thread_id: 'thread-1', sender_role: 'creator',
        sender_user_id: OWNER_ID, body: 'Reply',
        created_at: '2026-05-01T00:00:00Z' });
    }
    seedTable('PersonaDmMessage', msgs);
    return m;
  }

  test('6. fan thread detail includes replyPolicyStatus', async () => {
    seedThreadWithMessages({ replyPolicy: 'within_7_days' });
    const res = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/dms/threads/thread-1`),
      FAN_ID,
    );
    expect(res.status).toBe(200);
    expect(res.body.viewerRole).toBe('fan');
    expect(res.body.replyPolicyStatus).not.toBeNull();
    expect(res.body.replyPolicyStatus.policy).toBe('within_7_days');
    expect(res.body.replyPolicyStatus.slaDays).toBe(7);
  });

  test('7. creator thread detail never carries fan or owner user_id', async () => {
    seedThreadWithMessages();
    const res = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/dms/threads/thread-1`),
      OWNER_ID,
    );
    expect(res.status).toBe(200);
    expect(res.body.viewerRole).toBe('creator');
    // Creator side does NOT receive replyPolicyStatus (their own SLA).
    expect(res.body.replyPolicyStatus).toBeNull();
    // The wire shape carries no user_id of either party anywhere.
    const wire = JSON.stringify(res.body);
    expect(wire).not.toContain(FAN_ID);
    expect(wire).not.toContain(OWNER_ID);
    // Message rows expose sender_role only (not sender_user_id).
    expect(res.body.messages[0]).toMatchObject({
      senderRole: 'fan',
      body: 'Initial fan ping',
    });
    expect(res.body.messages[0]).not.toHaveProperty('sender_user_id');
  });

  test('detail call zeros the viewer\'s unread counter', async () => {
    seedThreadWithMessages();
    // creator_unread_count starts at 1.
    expect(getTable('PersonaDmThread')[0].creator_unread_count).toBe(1);
    await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/dms/threads/thread-1`),
      OWNER_ID,
    );
    expect(getTable('PersonaDmThread')[0].creator_unread_count).toBe(0);
  });

  test('non-participant gets 404', async () => {
    seedThreadWithMessages();
    const res = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/dms/threads/thread-1`),
      STRANGER_ID,
    );
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// 8, 9. POST /threads/:threadId/messages — append + notification routing.
// ===========================================================================
describe('POST /api/personas/:id/dms/threads/:threadId/messages', () => {
  function seedSimpleThread() {
    const m = seedMembership();
    seedTable('PersonaDmThread', [{
      id: 'thread-1', persona_id: PERSONA_ID, membership_id: m.id,
      initiated_by_user_id: FAN_ID, initiated_by_role: 'fan',
      status: 'open', fan_unread_count: 0, creator_unread_count: 0,
      created_at: '2026-05-08T00:00:00Z',
    }]);
    return m;
  }

  test('8. fan sends a message → creator_unread_count++ and creator notification fires', async () => {
    seedSimpleThread();
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/dms/threads/thread-1/messages`),
      FAN_ID,
    ).send({ body: 'Follow-up' });
    expect(res.status).toBe(201);
    expect(getTable('PersonaDmThread')[0].creator_unread_count).toBe(1);

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OWNER_ID,
        type: 'persona_dm_received_creator',
        context: 'audience',
      }),
    );
  });

  test('9. creator replies → fan_unread_count++ and persona_dm_reply_fan fires', async () => {
    seedSimpleThread();
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/dms/threads/thread-1/messages`),
      OWNER_ID,
    ).send({ body: 'Glad you reached out' });
    expect(res.status).toBe(201);
    expect(getTable('PersonaDmThread')[0].fan_unread_count).toBe(1);

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: FAN_ID,
        type: 'persona_dm_reply_fan',
        context: 'audience',
      }),
    );
  });

  test('non-participant cannot post → 404', async () => {
    seedSimpleThread();
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/dms/threads/thread-1/messages`),
      STRANGER_ID,
    ).send({ body: 'sneaky' });
    expect(res.status).toBe(404);
  });

  test('blocked fan cannot post a follow-up message → 403', async () => {
    seedSimpleThread();
    seedTable('PersonaBlock', [{
      id: 'pb-1', persona_id: PERSONA_ID, blocked_user_id: FAN_ID,
      source: 'persona_owner_action',
    }]);
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/dms/threads/thread-1/messages`),
      FAN_ID,
    ).send({ body: 'Trying again' });
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// 10, 11. Reply policy SLA semantics.
// ===========================================================================
describe('replyPolicyStatus surface in fan thread detail', () => {
  function seedAgedThread({ replyPolicy, daysAgo, includeCreatorReply = false }) {
    seedBaseFixtures(replyPolicy);
    seedFlagOn();
    const m = seedMembership();
    const created = new Date(Date.now() - daysAgo * 24 * 3600 * 1000).toISOString();
    seedTable('PersonaDmThread', [{
      id: 'thread-aged', persona_id: PERSONA_ID, membership_id: m.id,
      initiated_by_user_id: FAN_ID, initiated_by_role: 'fan',
      status: 'open', fan_unread_count: 0, creator_unread_count: 1,
      created_at: created,
      last_message_at: created,
    }]);
    const msgs = [{ id: 'msg-1', thread_id: 'thread-aged', sender_role: 'fan',
      sender_user_id: FAN_ID, body: 'Initial', created_at: created }];
    if (includeCreatorReply) {
      msgs.push({ id: 'msg-2', thread_id: 'thread-aged', sender_role: 'creator',
        sender_user_id: OWNER_ID, body: 'Reply',
        created_at: new Date().toISOString() });
    }
    seedTable('PersonaDmMessage', msgs);
  }

  test('10. within_3_days policy + 4 days old + no creator reply → sla_missed', async () => {
    seedAgedThread({ replyPolicy: 'within_3_days', daysAgo: 4 });
    const res = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/dms/threads/thread-aged`),
      FAN_ID,
    );
    expect(res.status).toBe(200);
    expect(res.body.replyPolicyStatus).toMatchObject({
      status: 'sla_missed',
      policy: 'within_3_days',
      slaDays: 3,
    });
  });

  test('11. discretion policy → replyPolicyStatus is null regardless of timing', async () => {
    seedAgedThread({ replyPolicy: 'discretion', daysAgo: 30 });
    const res = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/dms/threads/thread-aged`),
      FAN_ID,
    );
    expect(res.status).toBe(200);
    expect(res.body.replyPolicyStatus).toBeNull();
  });

  test('within_7_days, 2 days old, no reply → on_track with daysRemaining', async () => {
    seedAgedThread({ replyPolicy: 'within_7_days', daysAgo: 2 });
    const res = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/dms/threads/thread-aged`),
      FAN_ID,
    );
    expect(res.body.replyPolicyStatus).toMatchObject({
      status: 'on_track',
      slaDays: 7,
    });
    expect(res.body.replyPolicyStatus.daysRemaining).toBeGreaterThanOrEqual(4);
  });

  test('once creator has replied, replyPolicyStatus → null even on aged threads', async () => {
    seedAgedThread({ replyPolicy: 'within_3_days', daysAgo: 10, includeCreatorReply: true });
    const res = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/dms/threads/thread-aged`),
      FAN_ID,
    );
    expect(res.body.replyPolicyStatus).toBeNull();
  });
});
