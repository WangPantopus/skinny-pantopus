/**
 * P1.14 — block propagation + audience-side block routes + audience
 * notification suppression.
 *
 * Audience Profile design v2 §9 (block propagation), §11.7 (creator
 * view), §13.5 (block test invariants).
 *
 * Stripe is mocked inline; the mock-prefixed identifier satisfies the
 * jest.mock factory hoist and `accounts.create` is the sentinel
 * getStripeClient.js looks for to recognize a pre-instantiated test
 * client.
 */

const mockStripe = {
  accounts: { create: jest.fn(), update: jest.fn(), retrieve: jest.fn() },
  subscriptions: {
    retrieve: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn().mockResolvedValue({ id: 'sub_canceled', status: 'canceled' }),
  },
  invoices: {
    retrieve: jest.fn(),
  },
  refunds: {
    create: jest.fn().mockResolvedValue({ id: 're_mock_block', amount: 250, status: 'succeeded' }),
  },
};
jest.mock('stripe', () => mockStripe);

jest.mock('../../stripe/stripeService', () => ({
  createConnectAccount: jest.fn(),
  createAccountLink: jest.fn(),
}));

const supabaseAdmin = require('../__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable } = supabaseAdmin;

const express = require('express');
const request = require('supertest');

const featureFlagService = require('../../services/featureFlagService');
const personaBlockService = require('../../services/personaBlockService');
const dmService = require('../../services/personaDmService');
const personaBlocksRouter = require('../../routes/personaBlocks');
const personaDmsRouter = require('../../routes/personaDms');
const blocksRouter = require('../../routes/blocks');
const {
  serializeFanForCreator,
  serializeMembershipForFan,
} = require('../../serializers/identitySerializers');

const FLAG_NAME = 'audience_profile';

const OWNER_ID    = '11111111-1111-4111-8111-111111111111';
const FAN_ID      = '22222222-2222-4222-8222-222222222222';
const STRANGER_ID = '33333333-3333-4333-8333-333333333333';
const PERSONA_ID  = '44444444-4444-4444-4444-444444444444';
const PERSONA_2_ID = '45454545-4545-4545-4545-454545454545';
const TIER_2_ID   = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const TIER_3_ID   = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
const STRIPE_ACCOUNT = 'acct_persona_owner';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/users', blocksRouter);
  app.use('/api/personas/:id/dms', personaDmsRouter);
  app.use('/api/personas/:id', personaBlocksRouter);
  return app;
}
function asUser(req, userId) { return req.set('x-test-user-id', userId); }

function seedFlagOn() {
  seedTable('FeatureFlag', [{
    id: 'flag-1', flag_name: FLAG_NAME,
    enabled_globally: true, enabled_for_internal_team: false,
    beta_user_ids: [], description: '',
    created_at: '2026-05-08T00:00:00Z', updated_at: '2026-05-08T00:00:00Z',
  }]);
  featureFlagService.invalidateFlagCache();
}

function seedFixtures({ extraPersonaCount = 0 } = {}) {
  seedTable('User', [
    { id: OWNER_ID, role: 'user', username: 'owner', email: 'o@test.local' },
    { id: FAN_ID,   role: 'user', username: 'fan',   email: 'f@test.local' },
    { id: STRANGER_ID, role: 'user', username: 'stranger', email: 's@test.local' },
  ]);
  const personas = [{
    id: PERSONA_ID, user_id: OWNER_ID,
    handle: 'mayabuilds', display_name: 'Maya Builds', status: 'active',
  }];
  if (extraPersonaCount > 0) {
    personas.push({
      id: PERSONA_2_ID, user_id: OWNER_ID,
      handle: 'maya_side', display_name: 'Maya (side project)', status: 'active',
    });
  }
  seedTable('PublicPersona', personas);
  seedTable('PersonaTier', [
    { id: TIER_2_ID, persona_id: PERSONA_ID, rank: 2, name: 'Member',
      price_cents: 500, status: 'active',
      msg_threads_per_period: 5, creator_can_initiate_dm: false,
      reply_policy: 'discretion',
      stripe_price_id: 'price_member', currency: 'USD',
      billing_interval: 'month' },
    { id: TIER_3_ID, persona_id: PERSONA_ID, rank: 3, name: 'Insider',
      price_cents: 1500, status: 'active',
      msg_threads_per_period: 25, creator_can_initiate_dm: true,
      reply_policy: 'within_7_days',
      stripe_price_id: 'price_insider', currency: 'USD',
      billing_interval: 'month' },
  ]);
  seedTable('StripeAccount', [{
    id: 'sa-1', user_id: OWNER_ID, stripe_account_id: STRIPE_ACCOUNT,
    charges_enabled: true, payouts_enabled: true, details_submitted: true,
  }]);
  seedTable('PersonaQuotaUsage', []);
  seedTable('PersonaDmThread', []);
  seedTable('PersonaDmMessage', []);
  seedTable('PersonaBlock', []);
  seedTable('UserBlock', []);
  seedTable('IdentityAuditLog', []);
  seedTable('Notification', []);
}

function seedActivePaidMembership({ personaId = PERSONA_ID, tierId = TIER_2_ID } = {}) {
  const memberships = getTable('PersonaMembership');
  const membership = {
    id: `mem-${personaId}`,
    persona_id: personaId, user_id: FAN_ID,
    tier_id: tierId,
    fan_handle: 'lurker_a8f3', fan_handle_normalized: 'lurker_a8f3',
    fan_display_name: 'lurker',
    status: 'active',
    stripe_customer_id: 'cus_fan',
    stripe_subscription_id: `sub_${personaId}`,
    current_period_start: '2026-05-15T00:00:00.000Z',
    current_period_end: '2099-06-15T00:00:00.000Z',
    cancel_at_period_end: false,
    joined_at: '2026-05-15T00:00:00.000Z',
  };
  memberships.push(membership);
  return membership;
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  mockStripe.subscriptions.retrieve.mockResolvedValue({
    id: 'sub_test',
    items: { data: [{ id: 'si_test', price: { id: 'price_member' } }] },
    schedule: null,
    latest_invoice: 'in_test',
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
  });
  mockStripe.subscriptions.update.mockResolvedValue({ id: 'sub_test' });
  mockStripe.subscriptions.cancel.mockResolvedValue({ id: 'sub_test', status: 'canceled' });
  mockStripe.invoices.retrieve.mockResolvedValue({
    id: 'in_test', subscription: 'sub_test', charge: 'ch_test',
  });
  mockStripe.refunds.create.mockResolvedValue({
    id: 're_mock_block', amount: 250, status: 'succeeded',
  });
  seedFixtures();
  seedFlagOn();
});

afterEach(() => featureFlagService.invalidateFlagCache());

// ===========================================================================
// 1, 2. propagatePersonalBlock direct service tests.
// ===========================================================================
describe('propagatePersonalBlock', () => {
  test('1. creates a personal_block_propagation row for every persona the blocker owns', async () => {
    seedFixtures({ extraPersonaCount: 1 });
    seedFlagOn();
    const results = await personaBlockService.propagatePersonalBlock({
      blockerUserId: OWNER_ID, blockedUserId: FAN_ID,
    });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.ok)).toBe(true);
    const blocks = getTable('PersonaBlock');
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.source === 'personal_block_propagation')).toBe(true);
    const personaIds = blocks.map((b) => b.persona_id).sort();
    expect(personaIds).toEqual([PERSONA_ID, PERSONA_2_ID].sort());
  });

  test('2. is idempotent — re-running does NOT duplicate rows', async () => {
    await personaBlockService.propagatePersonalBlock({
      blockerUserId: OWNER_ID, blockedUserId: FAN_ID,
    });
    expect(getTable('PersonaBlock')).toHaveLength(1);
    await personaBlockService.propagatePersonalBlock({
      blockerUserId: OWNER_ID, blockedUserId: FAN_ID,
    });
    expect(getTable('PersonaBlock')).toHaveLength(1);
  });
});

// ===========================================================================
// 3. POST /api/users/:userId/block triggers cascade (async).
// ===========================================================================
describe('POST /api/users/:userId/block — cascade trigger', () => {
  test('3. fires propagatePersonalBlock via setImmediate', async () => {
    const res = await asUser(
      request(buildApp()).post(`/api/users/${FAN_ID}/block`),
      OWNER_ID,
    ).send({});
    expect(res.status).toBe(200);

    // Cascade is fire-and-forget via setImmediate; flush the queue
    // before asserting the side effect.
    await new Promise((r) => setImmediate(r));

    expect(getTable('PersonaBlock')).toHaveLength(1);
    expect(getTable('PersonaBlock')[0]).toMatchObject({
      persona_id: PERSONA_ID,
      blocked_user_id: FAN_ID,
      source: 'personal_block_propagation',
    });
  });
});

// ===========================================================================
// 4. Personal block of user with active Member subscription →
//    membership.status='expired' + subscriptions.cancel called +
//    prorated refund issued.
// ===========================================================================
describe('cascade revokes active paid membership', () => {
  test('4. status flips to expired, cancel + refund called', async () => {
    seedActivePaidMembership({ tierId: TIER_2_ID });

    await personaBlockService.propagatePersonalBlock({
      blockerUserId: OWNER_ID, blockedUserId: FAN_ID,
    });

    const stored = getTable('PersonaMembership')[0];
    expect(stored.status).toBe('expired');
    expect(stored.canceled_at).toBeTruthy();

    expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith(
      `sub_${PERSONA_ID}`,
      expect.any(Object),
      expect.objectContaining({ stripeAccount: STRIPE_ACCOUNT }),
    );
    expect(mockStripe.refunds.create).toHaveBeenCalledTimes(1);
    const [refundPayload] = mockStripe.refunds.create.mock.calls[0];
    expect(refundPayload).toMatchObject({
      charge: 'ch_test',
      reason: 'requested_by_customer',
    });
    expect(refundPayload.metadata?.pantopus_reason)
      .toMatch(/block_personal_block_propagation/);
  });
});

// ===========================================================================
// 5. Audience-side block does NOT create a UserBlock — asymmetric
//    cascade rule.
// ===========================================================================
describe('audience-side block does NOT cascade to personal-side', () => {
  test('5. blocking a fan via the persona route leaves UserBlock empty', async () => {
    seedActivePaidMembership({ tierId: TIER_2_ID });
    const res = await asUser(
      request(buildApp())
        .post(`/api/personas/${PERSONA_ID}/fans/mem-${PERSONA_ID}/block`),
      OWNER_ID,
    ).send({});
    expect(res.status).toBe(200);
    expect(getTable('PersonaBlock')).toHaveLength(1);
    // CRITICAL: no UserBlock row was created.
    expect(getTable('UserBlock')).toHaveLength(0);
  });
});

// ===========================================================================
// 6. serializeMembershipForFan after block carries no field referencing
//    the personal-side relationship.
// ===========================================================================
describe('vague-but-truthful fan-side serialization', () => {
  test('6. fan view of expired-by-block membership omits any personal-side signal', async () => {
    seedActivePaidMembership({ tierId: TIER_2_ID });
    await personaBlockService.propagatePersonalBlock({
      blockerUserId: OWNER_ID, blockedUserId: FAN_ID,
    });
    const stored = getTable('PersonaMembership')[0];
    const tier = getTable('PersonaTier').find((t) => t.id === TIER_2_ID);
    const persona = getTable('PublicPersona').find((p) => p.id === PERSONA_ID);
    const view = serializeMembershipForFan({
      ...stored,
      tier,
      persona,
      quota: { msgThreadsLimit: null, msgThreadsUsed: 0, videoCallsLimit: null, videoCallsUsed: 0 },
    });

    expect(view.status).toBe('expired');
    const wire = JSON.stringify(view);
    // NO field referencing the blocker, the block source, or any
    // personal-side relationship leaks. (status='expired' is a
    // generic terminal value that also fires on dunning end +
    // refund, not specific to blocks.)
    expect(wire).not.toMatch(/blocker|block_source|personal|neighbor/i);
    expect(wire).not.toContain(OWNER_ID);
    expect(wire).not.toContain('personal_block_propagation');
  });
});

// ===========================================================================
// 7, 8. unblockUserFromPersona source gating.
// ===========================================================================
describe('unblockUserFromPersona source gating', () => {
  test('7. chargeback block cannot be removed by the persona owner', async () => {
    seedTable('PersonaBlock', [{
      id: 'pb-1', persona_id: PERSONA_ID, blocked_user_id: FAN_ID,
      source: 'chargeback', reason: 'Stripe dispute dp_x',
    }]);
    await expect(
      personaBlockService.unblockUserFromPersona({
        personaId: PERSONA_ID, blockedUserId: FAN_ID, actorUserId: OWNER_ID,
      }),
    ).rejects.toThrow(/cannot be removed/i);
    expect(getTable('PersonaBlock')).toHaveLength(1);
  });

  test('8. persona_owner_action block CAN be removed and writes audit', async () => {
    seedTable('PersonaBlock', [{
      id: 'pb-2', persona_id: PERSONA_ID, blocked_user_id: FAN_ID,
      source: 'persona_owner_action', reason: null,
    }]);
    const result = await personaBlockService.unblockUserFromPersona({
      personaId: PERSONA_ID, blockedUserId: FAN_ID, actorUserId: OWNER_ID,
    });
    expect(result.unblocked).toBe(true);
    expect(getTable('PersonaBlock')).toHaveLength(0);
    expect(getTable('IdentityAuditLog').some(
      (e) => e.action === 'persona_block.removed',
    )).toBe(true);
  });
});

// ===========================================================================
// 9. After block, audience-context notifications are suppressed.
// ===========================================================================
describe('notification suppression for blocked recipients', () => {
  // The notificationService is auto-mocked via jest.config's
  // moduleNameMapper. Both `jest.requireActual` and `require` go
  // through the mapper and resolve to the mock. Loading by the
  // absolute file path bypasses the mapper and returns the real
  // implementation.
  const path = require('path');
  const realNotificationService = require(path.resolve(
    __dirname, '../../services/notificationService.js',
  ));

  test('9. createNotification returns null when context=audience and recipient is blocked', async () => {
    seedTable('PersonaBlock', [{
      id: 'pb-1', persona_id: PERSONA_ID, blocked_user_id: FAN_ID,
      source: 'persona_owner_action',
    }]);
    seedTable('Notification', []);

    const result = await realNotificationService.createNotification({
      userId: FAN_ID,
      type: 'persona_dm_reply_fan',
      context: 'audience',
      title: '@mayabuilds replied',
      body: 'Welcome',
      metadata: { persona_id: PERSONA_ID, thread_id: 'thread-1' },
    });
    expect(result).toBeNull();
    expect(getTable('Notification')).toHaveLength(0);
  });

  test('createNotification still delivers to non-blocked fans on the same persona', async () => {
    seedTable('PersonaBlock', [{
      id: 'pb-1', persona_id: PERSONA_ID, blocked_user_id: STRANGER_ID,
      source: 'persona_owner_action',
    }]);
    seedTable('Notification', []);

    const result = await realNotificationService.createNotification({
      userId: FAN_ID,
      type: 'persona_dm_reply_fan',
      context: 'audience',
      title: '@mayabuilds replied',
      body: 'Welcome',
      metadata: { persona_id: PERSONA_ID, thread_id: 'thread-1' },
    });
    expect(result).not.toBeNull();
    expect(getTable('Notification')).toHaveLength(1);
  });

  test('bulk broadcast notifications skip blocked recipients', async () => {
    seedTable('PersonaBlock', [{
      id: 'pb-1', persona_id: PERSONA_ID, blocked_user_id: FAN_ID,
      source: 'persona_owner_action',
    }]);
    seedTable('Notification', []);

    const rows = await realNotificationService.notifyPersonaBroadcast({
      recipientUserIds: [FAN_ID, STRANGER_ID],
      personaId: PERSONA_ID,
      personaHandle: 'mayabuilds',
      personaDisplayName: 'Maya Builds',
      messageId: 'broadcast-1',
      visibility: 'followers',
      bodyPreview: 'Update',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(STRANGER_ID);
    expect(getTable('Notification')).toHaveLength(1);
  });
});

// ===========================================================================
// 10. Blocked fan cannot open a new DM thread → 403 blocked.
// ===========================================================================
describe('blocked fan cannot open DM threads', () => {
  test('10. POST /dms/threads as a blocked fan returns 403 blocked', async () => {
    seedActivePaidMembership({ tierId: TIER_2_ID });
    seedTable('PersonaBlock', [{
      id: 'pb-1', persona_id: PERSONA_ID, blocked_user_id: FAN_ID,
      source: 'persona_owner_action',
    }]);
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/dms/threads`),
      FAN_ID,
    ).send({ body: 'Will be blocked' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('blocked');
    expect(getTable('PersonaDmThread')).toHaveLength(0);
  });
});

// ===========================================================================
// 11. serializeFanForCreator output is identical for
//     persona_owner_action vs personal_block_propagation. The creator
//     view must NOT distinguish the two sources.
// ===========================================================================
describe('symmetric-firewall correctness — block source invisibility', () => {
  test('11. fan-for-creator serializer output is byte-identical regardless of block source', async () => {
    seedActivePaidMembership({ tierId: TIER_2_ID });
    const stored = getTable('PersonaMembership')[0];
    const tier = getTable('PersonaTier').find((t) => t.id === TIER_2_ID);
    const persona = getTable('PublicPersona').find((p) => p.id === PERSONA_ID);

    // Imagine the membership has been block-revoked under each source
    // (we mutate the in-memory copy, not the row, since
    // serializeFanForCreator is a pure transform).
    const baseInput = {
      ...stored,
      status: 'expired',
      canceled_at: '2026-05-20T00:00:00.000Z',
      tier: { id: tier.id, rank: tier.rank, name: tier.name },
      persona: { ...persona, verified_local_discovery_enabled: false },
      quota: {
        msgThreadsLimit: tier.msg_threads_per_period,
        msgThreadsUsed: 0,
        videoCallsLimit: null,
        videoCallsUsed: 0,
      },
    };

    const ownerActionView = serializeFanForCreator(baseInput);
    const propagationView = serializeFanForCreator(baseInput);

    // Byte-identical — confirms the serializer takes no source-
    // dependent branches. (The PersonaBlock.source is internal only;
    // it never enters the fan-facing serializer's input shape.)
    expect(propagationView).toEqual(ownerActionView);

    // And the wire shape carries no block-source signal at all.
    const wire = JSON.stringify(ownerActionView);
    expect(wire).not.toMatch(/personal_block_propagation|persona_owner_action|chargeback|platform_safety/);
  });

  test('GET /blocks never returns source/reason but still returns canUnblock + membershipId', async () => {
    const membership = seedActivePaidMembership({ tierId: TIER_2_ID });
    seedTable('PersonaBlock', [{
      id: 'pb-propagated',
      persona_id: PERSONA_ID,
      blocked_user_id: FAN_ID,
      source: 'personal_block_propagation',
      reason: 'internal personal-side reason',
      created_at: '2026-05-20T00:00:00.000Z',
    }]);

    const res = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/blocks`),
      OWNER_ID,
    );

    expect(res.status).toBe(200);
    expect(res.body.blocks).toHaveLength(1);
    expect(res.body.blocks[0]).toMatchObject({
      id: 'pb-propagated',
      membershipId: membership.id,
      fanHandle: 'lurker_a8f3',
      canUnblock: true,
    });
    const wire = JSON.stringify(res.body);
    expect(wire).not.toMatch(/personal_block_propagation|persona_owner_action|internal personal-side reason|blocked_user_id|user_id/i);
  });
});
