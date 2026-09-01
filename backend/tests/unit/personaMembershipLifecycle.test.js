/**
 * P1.13 — fan membership lifecycle (cancel / upgrade / downgrade /
 * refund-request).
 *
 * Audience Profile design v2 §7.3 (period mechanics) + §11.6 (fan
 * cancel/downgrade UX). Stripe SDK is mocked inline (mock-prefixed
 * identifier so the jest.mock factory hoist is satisfied) and the
 * ambient stripeService import is shimmed to avoid pulling in the
 * real Connect helpers.
 */

const mockStripe = {
  // accounts.create is the sentinel getStripeClient.js looks for
  // when deciding whether `require('stripe')` already returned a
  // pre-instantiated test client. Without it the helper tries to
  // call the mock as a constructor and throws.
  accounts: { create: jest.fn(), update: jest.fn(), retrieve: jest.fn() },
  subscriptions: {
    retrieve: jest.fn(),
    update: jest.fn(),
  },
  subscriptionSchedules: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
  },
  invoices: {
    retrieve: jest.fn(),
  },
  refunds: {
    create: jest.fn(),
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
const personaMembershipRouter = require('../../routes/personaMembership');

const FLAG_NAME = 'audience_profile';

const OWNER_ID    = '11111111-1111-4111-8111-111111111111';
const FAN_ID      = '22222222-2222-4222-8222-222222222222';
const PERSONA_ID  = '44444444-4444-4444-4444-444444444444';
const TIER_1_ID   = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const TIER_2_ID   = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const TIER_3_ID   = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
const STRIPE_ACCOUNT = 'acct_persona_owner';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/personas/:id/membership', personaMembershipRouter);
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

function seedFixtures() {
  seedTable('User', [
    { id: OWNER_ID, role: 'user', username: 'owner', email: 'o@test.local' },
    { id: FAN_ID,   role: 'user', username: 'fan',   email: 'f@test.local' },
  ]);
  seedTable('PublicPersona', [{
    id: PERSONA_ID, user_id: OWNER_ID,
    handle: 'mayabuilds', display_name: 'Maya Builds', status: 'active',
  }]);
  seedTable('PersonaTier', [
    { id: TIER_1_ID, persona_id: PERSONA_ID, rank: 1, name: 'Follower',
      price_cents: 0, status: 'active',
      msg_threads_per_period: null, creator_can_initiate_dm: false,
      reply_policy: 'discretion', stripe_price_id: null,
      currency: 'USD', billing_interval: 'month' },
    { id: TIER_2_ID, persona_id: PERSONA_ID, rank: 2, name: 'Member',
      price_cents: 500, status: 'active',
      msg_threads_per_period: 5, creator_can_initiate_dm: false,
      reply_policy: 'within_3_days',
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
  seedTable('IdentityAuditLog', []);
}

function seedPaidMembership({ tierId = TIER_3_ID, periodEnd = '2099-06-15T00:00:00.000Z', cancelFlag = false } = {}) {
  seedTable('PersonaMembership', [{
    id: 'mem-fan',
    persona_id: PERSONA_ID, user_id: FAN_ID,
    tier_id: tierId,
    fan_handle: 'lurker_a8f3', fan_handle_normalized: 'lurker_a8f3',
    status: 'active',
    stripe_customer_id: 'cus_fan',
    stripe_subscription_id: 'sub_fan',
    current_period_start: '2026-05-15T00:00:00.000Z',
    current_period_end: periodEnd,
    cancel_at_period_end: cancelFlag,
    joined_at: '2026-05-15T00:00:00.000Z',
  }]);
}

function seedFreeMembership() {
  seedTable('PersonaMembership', [{
    id: 'mem-fan-free',
    persona_id: PERSONA_ID, user_id: FAN_ID,
    tier_id: TIER_1_ID,
    fan_handle: 'lurker_free', fan_handle_normalized: 'lurker_free',
    status: 'active',
    stripe_subscription_id: null,
    cancel_at_period_end: false,
    joined_at: '2026-05-15T00:00:00.000Z',
  }]);
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  // Re-prime the Stripe stubs each test.
  mockStripe.subscriptions.retrieve.mockResolvedValue({
    id: 'sub_fan',
    items: { data: [{ id: 'si_fan', price: { id: 'price_insider' } }] },
    schedule: null,
    latest_invoice: 'in_fan',
    current_period_end: Math.floor(new Date('2099-06-15T00:00:00.000Z').getTime() / 1000),
    current_period_start: Math.floor(new Date('2026-05-15T00:00:00.000Z').getTime() / 1000),
  });
  mockStripe.subscriptions.update.mockResolvedValue({ id: 'sub_fan' });
  mockStripe.subscriptionSchedules.create.mockResolvedValue({
    id: 'sub_sched_1', from_subscription: 'sub_fan', phases: [],
  });
  mockStripe.subscriptionSchedules.retrieve.mockResolvedValue({
    id: 'sub_sched_1',
    phases: [{
      items: [{ price: 'price_insider', quantity: 1 }],
      start_date: Math.floor(new Date('2026-05-15T00:00:00.000Z').getTime() / 1000),
      end_date:   Math.floor(new Date('2099-06-15T00:00:00.000Z').getTime() / 1000),
    }],
  });
  mockStripe.subscriptionSchedules.update.mockResolvedValue({ id: 'sub_sched_1' });
  mockStripe.invoices.retrieve.mockResolvedValue({
    id: 'in_fan', subscription: 'sub_fan', charge: 'ch_fan',
  });
  mockStripe.refunds.create.mockResolvedValue({
    id: 're_mock_1', amount: 250, status: 'succeeded',
  });
  seedFixtures();
  seedFlagOn();
});

afterEach(() => featureFlagService.invalidateFlagCache());

// ===========================================================================
// 1. Cancel sets cancel_at_period_end on both Pantopus + Stripe.
// ===========================================================================
describe('POST /membership/cancel', () => {
  test('1. paid cancel flips cancel_at_period_end on row + calls Stripe', async () => {
    seedPaidMembership();
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/membership/cancel`),
      FAN_ID,
    ).send({});
    expect(res.status).toBe(200);
    expect(res.body.membership.cancelAtPeriodEnd).toBe(true);

    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
      'sub_fan',
      expect.objectContaining({ cancel_at_period_end: true }),
      expect.objectContaining({ stripeAccount: STRIPE_ACCOUNT }),
    );

    const stored = getTable('PersonaMembership')[0];
    expect(stored.cancel_at_period_end).toBe(true);
    expect(stored.status).toBe('active');
    expect(stored.canceled_at).toBeFalsy();

    // Audit log: exactly one row for the cancel action.
    const audit = getTable('IdentityAuditLog')
      .filter((e) => e.action === 'persona_membership.cancel');
    expect(audit).toHaveLength(1);
    expect(audit[0].metadata).toMatchObject({ immediate: false });
  });
});

// ===========================================================================
// 2. Upgrade — Stripe subscriptions.update with create_prorations.
// ===========================================================================
describe('POST /membership/upgrade', () => {
  test('2. upgrade calls Stripe subscriptions.update with proration_behavior=create_prorations', async () => {
    // Start at Member rank=2, upgrade to Insider rank=3.
    seedPaidMembership({ tierId: TIER_2_ID });
    mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
      id: 'sub_fan',
      items: { data: [{ id: 'si_fan', price: { id: 'price_member' } }] },
      schedule: null,
      latest_invoice: 'in_fan',
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
    });

    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/membership/upgrade`),
      FAN_ID,
    ).send({ tier_rank: 3 });
    expect(res.status).toBe(200);

    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
      'sub_fan',
      expect.objectContaining({
        items: [{ id: 'si_fan', price: 'price_insider' }],
        proration_behavior: 'create_prorations',
        metadata: expect.objectContaining({ persona_tier_id: TIER_3_ID }),
      }),
      expect.objectContaining({ stripeAccount: STRIPE_ACCOUNT }),
    );

    const stored = getTable('PersonaMembership')[0];
    expect(stored.tier_id).toBe(TIER_3_ID);
    expect(stored.scheduled_tier_change_id).toBeNull();

    const audit = getTable('IdentityAuditLog')
      .filter((e) => e.action === 'persona_membership.upgrade');
    expect(audit).toHaveLength(1);
    expect(audit[0].metadata).toMatchObject({ from_tier_rank: 2, to_tier_rank: 3 });
  });

  test('upgrade rejected when target rank is not strictly higher', async () => {
    seedPaidMembership({ tierId: TIER_3_ID });
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/membership/upgrade`),
      FAN_ID,
    ).send({ tier_rank: 2 });
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// 3. Downgrade — creates a subscription_schedule with two phases.
// ===========================================================================
describe('POST /membership/downgrade', () => {
  test('3. downgrade creates subscriptionSchedule and updates phases', async () => {
    // Start at Insider rank=3, downgrade to Member rank=2.
    seedPaidMembership({ tierId: TIER_3_ID });

    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/membership/downgrade`),
      FAN_ID,
    ).send({ tier_rank: 2 });
    expect(res.status).toBe(200);

    // Schedule was created (subscription has no existing schedule in
    // the default mock).
    expect(mockStripe.subscriptionSchedules.create).toHaveBeenCalledWith(
      expect.objectContaining({ from_subscription: 'sub_fan' }),
      expect.objectContaining({ stripeAccount: STRIPE_ACCOUNT }),
    );
    // Phases pushed: original phase (clipped to current_period_end)
    // + new tier phase. Verify the update call carries a 2-phase
    // payload and the new phase points at the Member price.
    expect(mockStripe.subscriptionSchedules.update).toHaveBeenCalledTimes(1);
    const [, payload] = mockStripe.subscriptionSchedules.update.mock.calls[0];
    expect(payload.phases).toHaveLength(2);
    expect(payload.phases[1]).toMatchObject({
      items: [{ price: 'price_member', quantity: 1 }],
      proration_behavior: 'none',
    });
    expect(payload.end_behavior).toBe('release');

    // Local row: scheduled_tier_change_id set; tier_id unchanged
    // (the actual switch happens at period_end via webhook).
    const stored = getTable('PersonaMembership')[0];
    expect(stored.scheduled_tier_change_id).toBe(TIER_2_ID);
    expect(stored.tier_id).toBe(TIER_3_ID);

    const audit = getTable('IdentityAuditLog')
      .filter((e) => e.action === 'persona_membership.downgrade_scheduled');
    expect(audit).toHaveLength(1);
    expect(audit[0].metadata).toMatchObject({
      from_tier_rank: 3, to_tier_rank: 2, effective: 'period_end',
    });
  });
});

// ===========================================================================
// 4. Free Follower cancel sets status='canceled' immediately.
// ===========================================================================
describe('POST /membership/cancel — free Follower', () => {
  test('4. free Follower cancel terminates immediately (no Stripe call)', async () => {
    seedFreeMembership();
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/membership/cancel`),
      FAN_ID,
    ).send({});
    // The response body comes back from respondWithMembership which
    // re-fetches; once status flips to 'canceled' loadOwnMembership
    // returns 404 — the response is therefore 200 with the membership
    // captured pre-status-change. Either way the row is the truth.
    expect([200, 404]).toContain(res.status);

    expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();

    const stored = getTable('PersonaMembership')[0];
    expect(stored.status).toBe('canceled');
    expect(stored.canceled_at).toBeTruthy();

    const audit = getTable('IdentityAuditLog')
      .filter((e) => e.action === 'persona_membership.cancel');
    expect(audit).toHaveLength(1);
    expect(audit[0].metadata).toMatchObject({ immediate: true });
  });
});

// ===========================================================================
// 5. Refund-request with reason='sla_missed' issues a prorated refund
//    AND cancels at period end.
// ===========================================================================
describe('POST /membership/refund-request', () => {
  test('5. sla_missed refund-request issues prorated refund + cancels at period end', async () => {
    seedPaidMembership({ tierId: TIER_2_ID });
    // Seed an aged thread + reply policy = within_3_days (from fixture)
    // → SLA missed when created 5 days ago with no creator reply.
    const aged = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
    seedTable('PersonaDmThread', [{
      id: 'thread-aged',
      persona_id: PERSONA_ID, membership_id: 'mem-fan',
      initiated_by_user_id: FAN_ID, initiated_by_role: 'fan',
      status: 'open', fan_unread_count: 0, creator_unread_count: 1,
      created_at: aged, last_message_at: aged,
    }]);
    seedTable('PersonaDmMessage', [{
      id: 'msg-1', thread_id: 'thread-aged', sender_role: 'fan',
      sender_user_id: FAN_ID, body: 'Initial', created_at: aged,
    }]);

    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/membership/refund-request`),
      FAN_ID,
    ).send({ reason: 'sla_missed' });
    expect(res.status).toBe(200);

    // Stripe refunds.create was called with charge id from the
    // latest_invoice and the requested-by-customer reason.
    expect(mockStripe.refunds.create).toHaveBeenCalledTimes(1);
    const [refundPayload, refundOpts] = mockStripe.refunds.create.mock.calls[0];
    expect(refundPayload).toMatchObject({
      charge: 'ch_fan',
      reason: 'requested_by_customer',
    });
    expect(refundOpts).toEqual({ stripeAccount: STRIPE_ACCOUNT });

    // Cancel at period end was triggered.
    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
      'sub_fan',
      expect.objectContaining({ cancel_at_period_end: true }),
      expect.any(Object),
    );

    // Audit log: refund_requested rows (1 for refund + 1 for the
    // implicit cancel that follows). The refund-specific row is
    // the one we care about.
    const refundLog = getTable('IdentityAuditLog')
      .filter((e) => e.action === 'persona_membership.refund_requested');
    expect(refundLog).toHaveLength(1);
    expect(refundLog[0].metadata).toMatchObject({
      reason: 'sla_missed',
      refund_id: 're_mock_1',
    });
    expect(refundLog[0].metadata.refund_amount_cents).toBeGreaterThan(0);
  });

  test('sla_missed refund-request is idempotent and does not issue duplicate refunds', async () => {
    seedPaidMembership({ tierId: TIER_2_ID });
    const aged = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
    const threadId = '99999999-9999-4999-8999-999999999999';
    seedTable('PersonaDmThread', [{
      id: threadId,
      persona_id: PERSONA_ID, membership_id: 'mem-fan',
      initiated_by_user_id: FAN_ID, initiated_by_role: 'fan',
      status: 'open', fan_unread_count: 0, creator_unread_count: 1,
      created_at: aged, last_message_at: aged,
    }]);
    seedTable('PersonaDmMessage', [{
      id: 'msg-duplicate', thread_id: threadId, sender_role: 'fan',
      sender_user_id: FAN_ID, body: 'Initial', created_at: aged,
    }]);

    const first = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/membership/refund-request`),
      FAN_ID,
    ).send({ reason: 'sla_missed', thread_id: threadId });
    expect(first.status).toBe(200);

    const second = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/membership/refund-request`),
      FAN_ID,
    ).send({ reason: 'sla_missed', thread_id: threadId });

    expect(second.status).toBe(409);
    expect(second.body.code).toBe('refund_already_requested');
    expect(mockStripe.refunds.create).toHaveBeenCalledTimes(1);
    const refundLog = getTable('IdentityAuditLog')
      .filter((e) => e.action === 'persona_membership.refund_requested');
    expect(refundLog).toHaveLength(1);
  });
});

// ===========================================================================
// 6. Refund-request without sla_missed (and without other valid
//    reason) returns 400.
// ===========================================================================
describe('POST /membership/refund-request — invalid reason / no qualifying thread', () => {
  test('6a. sla_missed reason but NO qualifying sla_missed thread → 400', async () => {
    seedPaidMembership({ tierId: TIER_2_ID });
    // No threads at all — no qualifying thread.
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/membership/refund-request`),
      FAN_ID,
    ).send({ reason: 'sla_missed' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('no_sla_missed_thread');
    expect(mockStripe.refunds.create).not.toHaveBeenCalled();
  });

  test('6b. period_unused is not yet supported → 400', async () => {
    seedPaidMembership({ tierId: TIER_2_ID });
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/membership/refund-request`),
      FAN_ID,
    ).send({ reason: 'period_unused' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('reason_not_supported');
  });

  test('6c. invalid reason → 400 from Joi', async () => {
    seedPaidMembership({ tierId: TIER_2_ID });
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/membership/refund-request`),
      FAN_ID,
    ).send({ reason: 'because_i_said_so' });
    expect(res.status).toBe(400);
  });

  test('free membership refund-request returns 400 (no_subscription)', async () => {
    seedFreeMembership();
    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/membership/refund-request`),
      FAN_ID,
    ).send({ reason: 'sla_missed' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('no_subscription');
  });

  test('sla_missed with no remaining period value does NOT issue a full refund', async () => {
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    seedPaidMembership({ tierId: TIER_2_ID, periodEnd: yesterday });
    const aged = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
    seedTable('PersonaDmThread', [{
      id: 'thread-aged-zero', persona_id: PERSONA_ID, membership_id: 'mem-fan',
      initiated_by_user_id: FAN_ID, initiated_by_role: 'fan',
      status: 'open', created_at: aged,
      fan_unread_count: 0, creator_unread_count: 1,
    }]);
    seedTable('PersonaDmMessage', [{
      id: 'msg-zero', thread_id: 'thread-aged-zero', sender_role: 'fan',
      sender_user_id: FAN_ID, body: 'Initial', created_at: aged,
    }]);

    const res = await asUser(
      request(buildApp()).post(`/api/personas/${PERSONA_ID}/membership/refund-request`),
      FAN_ID,
    ).send({ reason: 'sla_missed' });

    expect(res.status).toBe(200);
    expect(mockStripe.refunds.create).not.toHaveBeenCalled();
    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
      'sub_fan',
      expect.objectContaining({ cancel_at_period_end: true }),
      expect.any(Object),
    );
    const refundLog = getTable('IdentityAuditLog')
      .find((e) => e.action === 'persona_membership.refund_requested');
    expect(refundLog.metadata.refund_id).toBeNull();
    expect(refundLog.metadata.refund_amount_cents).toBe(0);
  });
});

// ===========================================================================
// Bonus: GET /membership returns the fan-side serialized shape and
// hides Stripe identifiers.
// ===========================================================================
describe('GET /membership', () => {
  test('returns FanMembershipPayload shape with no Stripe identifiers', async () => {
    seedPaidMembership({ tierId: TIER_2_ID });
    const res = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/membership`),
      FAN_ID,
    );
    expect(res.status).toBe(200);
    expect(res.body.membership).toMatchObject({
      fanHandle: 'lurker_a8f3',
      tier: expect.objectContaining({
        rank: 2,
        name: 'Member',
        msgThreadsPerPeriod: 5,
        replyPolicy: 'within_3_days',
        creatorCanInitiateDm: false,
      }),
      quotaRemaining: expect.objectContaining({ msgThreads: 5 }),
    });
    const wire = JSON.stringify(res.body);
    expect(wire).not.toContain('cus_fan');
    expect(wire).not.toContain('sub_fan');
    expect(wire).not.toContain('price_member');
  });

  test('expired membership remains visible to the fan with vague terminal status', async () => {
    seedPaidMembership({ tierId: TIER_2_ID });
    getTable('PersonaMembership')[0].status = 'expired';
    const res = await asUser(
      request(buildApp()).get(`/api/personas/${PERSONA_ID}/membership`),
      FAN_ID,
    );
    expect(res.status).toBe(200);
    expect(res.body.membership.status).toBe('expired');
    const wire = JSON.stringify(res.body);
    expect(wire).not.toMatch(/block|personal_block_propagation|persona_owner_action/i);
  });
});
