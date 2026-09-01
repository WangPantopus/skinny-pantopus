/**
 * P1.11 — personaDmService.
 *
 * Audience Profile design v2 §5.3 (DM tables), §7.2 (capability semantics:
 * thread is the unit of quota consumption; Insider tier carries
 * creator_can_initiate_dm), §13.4 (quota tests).
 *
 * Mock-based; lives under tests/unit/ so `npm test` runs it.
 */

const supabaseAdmin = require('../__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable } = supabaseAdmin;

const personaDmService = require('../../services/personaDmService');

const OWNER_ID    = '11111111-1111-4111-8111-111111111111';
const FAN_ID      = '22222222-2222-4222-8222-222222222222';
const STRANGER_ID = '33333333-3333-4333-8333-333333333333';
const PERSONA_ID  = '44444444-4444-4444-4444-444444444444';
const TIER_1_ID   = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const TIER_2_ID   = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const TIER_3_ID   = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';

const PERIOD_START = '2026-04-15T00:00:00.000Z';
const PERIOD_END   = '2099-05-15T00:00:00.000Z';

function seedBaseFixtures() {
  seedTable('User', [
    { id: OWNER_ID, role: 'user', username: 'owner_handle' },
    { id: FAN_ID,   role: 'user', username: 'fan_handle' },
  ]);
  seedTable('PublicPersona', [{
    id: PERSONA_ID, user_id: OWNER_ID,
    handle: 'mayabuilds', display_name: 'Maya Builds', status: 'active',
  }]);
  seedTable('PersonaTier', [
    // Follower: NULL msg_threads_per_period — tier doesn't grant DMs.
    { id: TIER_1_ID, persona_id: PERSONA_ID, rank: 1, name: 'Follower',
      price_cents: 0, status: 'active',
      msg_threads_per_period: null, creator_can_initiate_dm: false,
      reply_policy: 'discretion' },
    // Member: 5 threads / period.
    { id: TIER_2_ID, persona_id: PERSONA_ID, rank: 2, name: 'Member',
      price_cents: 500, status: 'active',
      msg_threads_per_period: 5, creator_can_initiate_dm: false,
      reply_policy: 'discretion' },
    // Insider: 25 threads / period + creator_can_initiate_dm.
    { id: TIER_3_ID, persona_id: PERSONA_ID, rank: 3, name: 'Insider',
      price_cents: 1500, status: 'active',
      msg_threads_per_period: 25, creator_can_initiate_dm: true,
      reply_policy: 'within_7_days' },
  ]);
  seedTable('PersonaQuotaUsage', []);
  seedTable('PersonaDmThread', []);
  seedTable('PersonaDmMessage', []);
  seedTable('PersonaBlock', []);
}

function seedMembership(tierId) {
  seedTable('PersonaMembership', [{
    id: 'mem-fan',
    persona_id: PERSONA_ID,
    user_id: FAN_ID,
    tier_id: tierId,
    fan_handle: 'fan_lurker', fan_handle_normalized: 'fan_lurker',
    fan_display_name: 'lurker',
    status: 'active',
    current_period_start: PERIOD_START,
    current_period_end: PERIOD_END,
    joined_at: PERIOD_START,
  }]);
}

beforeEach(() => {
  resetTables();
  seedBaseFixtures();
});

// ---------------------------------------------------------------------------
// 1. Follower → tier_does_not_allow.
// ---------------------------------------------------------------------------
describe('openThread tier gating', () => {
  test('1. Follower (no msg quota) → tier_does_not_allow', async () => {
    seedMembership(TIER_1_ID);
    const result = await personaDmService.openThread({
      personaId: PERSONA_ID,
      fanUserId: FAN_ID,
      initiatedByRole: 'fan',
      initiatedByUserId: FAN_ID,
      body: 'Hi!',
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('tier_does_not_allow');
    expect(getTable('PersonaQuotaUsage')).toHaveLength(0);
    expect(getTable('PersonaDmThread')).toHaveLength(0);
  });

  test('non-member → no_membership', async () => {
    seedTable('PersonaMembership', []);
    const result = await personaDmService.openThread({
      personaId: PERSONA_ID,
      fanUserId: FAN_ID,
      initiatedByRole: 'fan',
      initiatedByUserId: FAN_ID,
      body: 'Hi!',
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('no_membership');
  });
});

// ---------------------------------------------------------------------------
// 2-4. Member quota mechanics.
// ---------------------------------------------------------------------------
describe('openThread Member quota', () => {
  test('2. Member with quota=0 (5 already used) → quota_exhausted', async () => {
    seedMembership(TIER_2_ID);
    // Pre-populate 5 used quotas in the current period.
    const used = Array.from({ length: 5 }, (_, i) => ({
      id: `usage-${i}`, membership_id: 'mem-fan',
      period_start: PERIOD_START, period_end: PERIOD_END,
      capability: 'msg_thread',
      used_at: '2026-04-20T00:00:00Z',
      reverted_at: null,
    }));
    seedTable('PersonaQuotaUsage', used);

    const result = await personaDmService.openThread({
      personaId: PERSONA_ID,
      fanUserId: FAN_ID,
      initiatedByRole: 'fan',
      initiatedByUserId: FAN_ID,
      body: 'I want to talk',
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('quota_exhausted');
    // No new usage row written (5 stays as 5).
    expect(getTable('PersonaQuotaUsage')).toHaveLength(5);
    expect(getTable('PersonaDmThread')).toHaveLength(0);
  });

  test('3. Member with quota=5 (none used) → succeeds and consumes 1 quota', async () => {
    seedMembership(TIER_2_ID);
    const result = await personaDmService.openThread({
      personaId: PERSONA_ID,
      fanUserId: FAN_ID,
      initiatedByRole: 'fan',
      initiatedByUserId: FAN_ID,
      body: 'First DM',
    });
    expect(result.ok).toBe(true);
    expect(result.threadId).toBeTruthy();
    expect(result.quotaRemaining).toBe(4);

    expect(getTable('PersonaDmThread')).toHaveLength(1);
    expect(getTable('PersonaDmMessage')).toHaveLength(1);
    const usage = getTable('PersonaQuotaUsage');
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({
      membership_id: 'mem-fan',
      capability: 'msg_thread',
      reverted_at: null,
    });
  });

  test('4. After 5 successful opens, the 6th returns quota_exhausted', async () => {
    seedMembership(TIER_2_ID);
    for (let i = 0; i < 5; i += 1) {
      const r = await personaDmService.openThread({
        personaId: PERSONA_ID,
        fanUserId: FAN_ID,
        initiatedByRole: 'fan',
        initiatedByUserId: FAN_ID,
        body: `DM ${i + 1}`,
      });
      expect(r.ok).toBe(true);
    }
    expect(getTable('PersonaDmThread')).toHaveLength(5);

    const sixth = await personaDmService.openThread({
      personaId: PERSONA_ID,
      fanUserId: FAN_ID,
      initiatedByRole: 'fan',
      initiatedByUserId: FAN_ID,
      body: 'one too many',
    });
    expect(sixth.ok).toBe(false);
    expect(sixth.code).toBe('quota_exhausted');
    expect(getTable('PersonaDmThread')).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// 5-6. Creator-initiated thread mechanics (Insider only).
// ---------------------------------------------------------------------------
describe('openThread creator-initiated', () => {
  test('5. Creator opens thread with Insider fan → succeeds, NO quota consumed', async () => {
    seedMembership(TIER_3_ID);
    const result = await personaDmService.openThread({
      personaId: PERSONA_ID,
      fanUserId: FAN_ID,
      initiatedByRole: 'creator',
      initiatedByUserId: OWNER_ID,
      body: 'Reaching out personally',
    });
    expect(result.ok).toBe(true);
    expect(getTable('PersonaDmThread')).toHaveLength(1);
    // Critical: NO quota row was written.
    expect(getTable('PersonaQuotaUsage')).toHaveLength(0);
    // The thread row records the originator.
    const thread = getTable('PersonaDmThread')[0];
    expect(thread.initiated_by_role).toBe('creator');
    expect(thread.initiated_by_user_id).toBe(OWNER_ID);
    expect(thread.quota_usage_id).toBeNull();
  });

  test('6. Creator opens thread with Member (no creator_can_initiate_dm) → tier_does_not_allow', async () => {
    seedMembership(TIER_2_ID);
    const result = await personaDmService.openThread({
      personaId: PERSONA_ID,
      fanUserId: FAN_ID,
      initiatedByRole: 'creator',
      initiatedByUserId: OWNER_ID,
      body: 'Hi member',
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('tier_does_not_allow');
    expect(getTable('PersonaDmThread')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 7. PersonaBlock gate.
// ---------------------------------------------------------------------------
describe('openThread PersonaBlock gate', () => {
  test('7. Blocked fan → blocked', async () => {
    seedMembership(TIER_2_ID);
    seedTable('PersonaBlock', [{
      id: 'pb-1', persona_id: PERSONA_ID, blocked_user_id: FAN_ID,
      source: 'persona_owner_action',
    }]);
    const result = await personaDmService.openThread({
      personaId: PERSONA_ID,
      fanUserId: FAN_ID,
      initiatedByRole: 'fan',
      initiatedByUserId: FAN_ID,
      body: 'Trying again',
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('blocked');
    expect(getTable('PersonaQuotaUsage')).toHaveLength(0);
    expect(getTable('PersonaDmThread')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 8. sendMessage unread counter mechanics.
// ---------------------------------------------------------------------------
describe('sendMessage', () => {
  test('8. sendMessage from fan bumps creator_unread_count; from creator bumps fan_unread_count', async () => {
    // Open a thread first (fan-initiated, tier 2). The first message
    // bumps creator_unread_count to 1.
    seedMembership(TIER_2_ID);
    const opened = await personaDmService.openThread({
      personaId: PERSONA_ID,
      fanUserId: FAN_ID,
      initiatedByRole: 'fan',
      initiatedByUserId: FAN_ID,
      body: 'Initial fan message',
    });
    expect(opened.ok).toBe(true);
    let thread = getTable('PersonaDmThread').find((t) => t.id === opened.threadId);
    expect(thread.creator_unread_count).toBe(1);
    expect(thread.fan_unread_count).toBe(0);

    // Creator replies → bumps fan_unread_count.
    await personaDmService.sendMessage({
      threadId: opened.threadId,
      senderUserId: OWNER_ID,
      senderRole: 'creator',
      body: 'Creator reply',
    });
    thread = getTable('PersonaDmThread').find((t) => t.id === opened.threadId);
    expect(thread.fan_unread_count).toBe(1);
    // Creator's reply does NOT mark the fan's prior message read; it
    // only bumps the OTHER party's counter. So creator_unread_count
    // stays at 1 (P1.13's mark-as-read flow handles clearing).
    expect(thread.creator_unread_count).toBe(1);

    // Fan sends another → creator_unread_count goes from 1 → 2.
    await personaDmService.sendMessage({
      threadId: opened.threadId,
      senderUserId: FAN_ID,
      senderRole: 'fan',
      body: 'Fan follow-up',
    });
    thread = getTable('PersonaDmThread').find((t) => t.id === opened.threadId);
    expect(thread.creator_unread_count).toBe(2);

    // Verify last_message_preview tracks the most recent body.
    expect(thread.last_message_preview).toBe('Fan follow-up');

    // Three messages stored in the thread.
    const msgs = getTable('PersonaDmMessage')
      .filter((m) => m.thread_id === opened.threadId);
    expect(msgs).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 9. Quota rollback when thread creation fails.
// ---------------------------------------------------------------------------
describe('openThread quota rollback', () => {
  test('9. Thread insert failure reverts the quota row (reverted_at set)', async () => {
    seedMembership(TIER_2_ID);

    // Force PersonaDmThread.insert to error. Wrap supabaseAdmin.from
    // so that the PersonaDmThread builder's _execute returns an error
    // for the insert pass; everything else (quota insert, quota
    // update for rollback) keeps the real mock behavior.
    const realFrom = supabaseAdmin.from;
    const spy = jest.spyOn(supabaseAdmin, 'from').mockImplementation((tbl) => {
      if (tbl === 'PersonaDmThread') {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: null,
                error: { message: 'forced thread failure' },
              }),
            }),
          }),
        };
      }
      return realFrom.call(supabaseAdmin, tbl);
    });

    let result;
    try {
      result = await personaDmService.openThread({
        personaId: PERSONA_ID,
        fanUserId: FAN_ID,
        initiatedByRole: 'fan',
        initiatedByUserId: FAN_ID,
        body: 'Will fail',
      });
    } finally {
      spy.mockRestore();
    }

    expect(result.ok).toBe(false);
    expect(result.code).toBe('internal_error');
    expect(getTable('PersonaDmThread')).toHaveLength(0);

    const usage = getTable('PersonaQuotaUsage');
    expect(usage).toHaveLength(1);
    expect(usage[0].reverted_at).not.toBeNull();

    // After rollback, the next openThread call should succeed (quota
    // is back to 5 because the only existing row is reverted).
    const retry = await personaDmService.openThread({
      personaId: PERSONA_ID,
      fanUserId: FAN_ID,
      initiatedByRole: 'fan',
      initiatedByUserId: FAN_ID,
      body: 'Retry',
    });
    expect(retry.ok).toBe(true);
    expect(retry.quotaRemaining).toBe(4);
  });

  test('first-message failure deletes the empty thread and reverts quota', async () => {
    seedMembership(TIER_2_ID);

    const realFrom = supabaseAdmin.from;
    const spy = jest.spyOn(supabaseAdmin, 'from').mockImplementation((tbl) => {
      if (tbl === 'PersonaDmMessage') {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: null,
                error: { message: 'forced message failure' },
              }),
            }),
          }),
        };
      }
      return realFrom.call(supabaseAdmin, tbl);
    });

    let result;
    try {
      result = await personaDmService.openThread({
        personaId: PERSONA_ID,
        fanUserId: FAN_ID,
        initiatedByRole: 'fan',
        initiatedByUserId: FAN_ID,
        body: 'Will fail after thread',
      });
    } finally {
      spy.mockRestore();
    }

    expect(result.ok).toBe(false);
    expect(result.code).toBe('internal_error');
    expect(getTable('PersonaDmThread')).toHaveLength(0);
    const usage = getTable('PersonaQuotaUsage');
    expect(usage).toHaveLength(1);
    expect(usage[0].reverted_at).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Bonus: stranger trying a creator-initiated open is rejected at the
// membership lookup stage (no membership for STRANGER_ID).
// ---------------------------------------------------------------------------
describe('openThread auth', () => {
  test('creator-initiated open against non-fan returns no_membership', async () => {
    // Membership exists for FAN_ID, not STRANGER_ID.
    seedMembership(TIER_3_ID);
    const result = await personaDmService.openThread({
      personaId: PERSONA_ID,
      fanUserId: STRANGER_ID,
      initiatedByRole: 'creator',
      initiatedByUserId: OWNER_ID,
      body: 'Hi stranger',
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('no_membership');
  });
});
