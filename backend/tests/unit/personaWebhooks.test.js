/**
 * P1.9 — Stripe Checkout + persona subscription webhook tests.
 *
 * Audience Profile design v2 §8 (Stripe), §7.3 (period mechanics),
 * §13.6 (Stripe / IAP test invariants), §9 (chargeback → PersonaBlock).
 *
 * Mocks the Stripe SDK inline (mock-prefixed identifier so the
 * jest.mock factory hoist is satisfied) and stripeService at the
 * module path so createCheckoutSession runs through controllable
 * stubs without hitting real Stripe.
 *
 * Lives under tests/unit/ so `npm test` runs it.
 */

const mockStripe = {
  accounts: {
    create:   jest.fn(),
    update:   jest.fn().mockResolvedValue({ id: 'acct_mock' }),
    retrieve: jest.fn(),
  },
  accountLinks: {
    create: jest.fn().mockResolvedValue({
      url: 'https://connect.stripe.test/onboarding/mock',
      expires_at: 9999999999,
    }),
  },
  products: {
    create: jest.fn().mockResolvedValue({
      id: 'prod_mock_persona', name: 'Mock', metadata: {},
    }),
    search: jest.fn().mockResolvedValue({ data: [] }),
  },
  prices: {
    create: jest.fn().mockImplementation((payload) => Promise.resolve({
      id: `price_mock_${Math.random().toString(36).slice(2, 10)}`,
      product: payload?.product ?? 'prod_mock_persona',
      unit_amount: payload?.unit_amount ?? 0,
      currency: payload?.currency ?? 'usd',
      recurring: payload?.recurring ?? { interval: 'month' },
      metadata: payload?.metadata ?? {},
    })),
  },
  checkout: {
    sessions: {
      create: jest.fn().mockImplementation((payload) => Promise.resolve({
        id: 'cs_test_mock',
        url: 'https://checkout.stripe.test/c/cs_test_mock',
        mode: payload?.mode || 'subscription',
        metadata: payload?.metadata || {},
      })),
    },
  },
  subscriptions: {
    retrieve: jest.fn(),
    update: jest.fn(),
  },
  invoices: {
    retrieve: jest.fn(),
  },
  charges: {
    retrieve: jest.fn(),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
};
jest.mock('stripe', () => mockStripe);

const mockCreateConnectAccount = jest.fn();
const mockCreateAccountLink   = jest.fn();
jest.mock('../../stripe/stripeService', () => ({
  createConnectAccount: (...args) => mockCreateConnectAccount(...args),
  createAccountLink:    (...args) => mockCreateAccountLink(...args),
}));

const supabaseAdmin = require('../__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable } = supabaseAdmin;

const personaPaymentsService = require('../../services/personaPaymentsService');
const stripeWebhooksRouter = require('../../stripe/stripeWebhooks');
const { personaWebhookHandlers } = stripeWebhooksRouter;

const OWNER_ID    = '11111111-1111-4111-8111-111111111111';
const FAN_ID      = '22222222-2222-4222-8222-222222222222';
const PERSONA_ID  = '33333333-3333-4333-8333-333333333333';
const TIER_2_ID   = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';

function seedAccount({ ready = true } = {}) {
  seedTable('StripeAccount', [{
    id: 'sa-1', user_id: OWNER_ID, stripe_account_id: 'acct_persona',
    charges_enabled: ready, payouts_enabled: ready, details_submitted: ready,
    verification_status: ready ? 'verified' : null,
  }]);
}

function seedPersonaTier({ rank = 2, priceCents = 500, stripePriceId = 'price_member_v1' } = {}) {
  seedTable('PublicPersona', [{
    id: PERSONA_ID, user_id: OWNER_ID,
    handle: 'mayabuilds', handle_normalized: 'mayabuilds',
    display_name: 'Maya Builds', audience_mode: 'open', status: 'active',
  }]);
  seedTable('PersonaTier', [{
    id: rank === 2 ? TIER_2_ID : `tier-${rank}`,
    persona_id: PERSONA_ID, rank,
    name: rank === 1 ? 'Follower' : rank === 2 ? 'Member' : 'Insider',
    price_cents: priceCents, currency: 'USD', billing_interval: 'month',
    msg_threads_per_period: rank === 1 ? null : 5,
    creator_can_initiate_dm: rank === 3,
    reply_policy: 'discretion', status: 'active',
    stripe_price_id: stripePriceId, position: rank,
  }]);
}

function nowSec() { return Math.floor(Date.now() / 1000); }
function periodStartSec() { return nowSec() - 24 * 60 * 60; }
function periodEndSec()   { return nowSec() + 30 * 24 * 60 * 60; }

function fakeSubscription(overrides = {}) {
  return {
    id: 'sub_test_123',
    customer: 'cus_test_123',
    status: 'active',
    cancel_at_period_end: false,
    canceled_at: null,
    current_period_start: periodStartSec(),
    current_period_end: periodEndSec(),
    trial_end: null,
    metadata: {
      persona_id: PERSONA_ID,
      persona_tier_id: TIER_2_ID,
      persona_tier_rank: '2',
      fan_user_id: FAN_ID,
      fan_handle: 'lurker_a8f3',
      fan_display_name: 'lurker_a8f3',
      fan_avatar_url: '',
    },
    ...overrides,
  };
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  // Re-prime defaults that jest.clearAllMocks zaps.
  mockStripe.checkout.sessions.create.mockImplementation((payload) =>
    Promise.resolve({
      id: 'cs_test_mock',
      url: 'https://checkout.stripe.test/c/cs_test_mock',
      mode: payload?.mode || 'subscription',
      metadata: payload?.metadata || {},
    }));
  mockStripe.accounts.update.mockResolvedValue({ id: 'acct_mock' });
  mockStripe.products.search.mockResolvedValue({ data: [] });
  mockStripe.products.create.mockResolvedValue({
    id: 'prod_mock_persona', name: 'Mock', metadata: {},
  });
  mockStripe.prices.create.mockImplementation((payload) => Promise.resolve({
    id: `price_mock_${Math.random().toString(36).slice(2, 10)}`,
    product: payload?.product ?? 'prod_mock_persona',
    unit_amount: payload?.unit_amount ?? 0,
    currency: payload?.currency ?? 'usd',
    recurring: payload?.recurring ?? { interval: 'month' },
    metadata: payload?.metadata ?? {},
  }));
});

// ---------------------------------------------------------------------------
// 1 + 2. createCheckoutSession.
// ---------------------------------------------------------------------------
describe('createCheckoutSession', () => {
  test('throws on free tier (rank < 2)', async () => {
    seedAccount({ ready: true });
    seedPersonaTier({ rank: 2 });
    const persona = { id: PERSONA_ID, user_id: OWNER_ID, handle: 'mayabuilds' };
    const tier = { id: 'tier-1', rank: 1, price_cents: 0, stripe_price_id: null };
    await expect(
      personaPaymentsService.createCheckoutSession({
        persona, tier, fanUserId: FAN_ID, handshake: { fan_handle: 'a' },
      }),
    ).rejects.toThrow(/Free tier/);
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  test('returns a Checkout URL with application_fee_percent=10 and metadata', async () => {
    seedAccount({ ready: true });
    seedPersonaTier({ rank: 2, stripePriceId: 'price_member_v1' });
    const persona = {
      id: PERSONA_ID, user_id: OWNER_ID,
      handle: 'mayabuilds', display_name: 'Maya Builds',
    };
    const tier = {
      id: TIER_2_ID, rank: 2, price_cents: 500, currency: 'USD',
      billing_interval: 'month', stripe_price_id: 'price_member_v1',
    };

    const result = await personaPaymentsService.createCheckoutSession({
      persona, tier, fanUserId: FAN_ID,
      handshake: {
        fan_handle: 'lurker_a8f3',
        fan_display_name: 'lurker_a8f3',
        fan_avatar_url: null,
      },
    });

    expect(result.url).toBe('https://checkout.stripe.test/c/cs_test_mock');
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    const [payload, options] = mockStripe.checkout.sessions.create.mock.calls[0];
    expect(payload.mode).toBe('subscription');
    expect(payload.line_items).toEqual([
      { price: 'price_member_v1', quantity: 1 },
    ]);
    expect(payload.subscription_data.application_fee_percent).toBe(10);
    expect(payload.subscription_data.metadata).toMatchObject({
      persona_id: PERSONA_ID,
      persona_tier_id: TIER_2_ID,
      fan_user_id: FAN_ID,
      fan_handle: 'lurker_a8f3',
    });
    expect(payload.success_url).toMatch(/welcome=1$/);
    expect(payload.cancel_url).toMatch(/canceled=1$/);
    expect(options).toEqual({ stripeAccount: 'acct_persona' });
  });

  test('throws when the connected account is not ready', async () => {
    seedAccount({ ready: false });
    seedPersonaTier({ rank: 2 });
    await expect(
      personaPaymentsService.createCheckoutSession({
        persona: { id: PERSONA_ID, user_id: OWNER_ID, handle: 'mayabuilds' },
        tier: { id: TIER_2_ID, rank: 2, price_cents: 500, stripe_price_id: 'price_member_v1' },
        fanUserId: FAN_ID,
        handshake: { fan_handle: 'a' },
      }),
    ).rejects.toThrow(/Stripe onboarding/);
  });
});

// ---------------------------------------------------------------------------
// 3 + 4. handlePersonaSubscriptionCreated — write + idempotency.
// ---------------------------------------------------------------------------
describe('handlePersonaSubscriptionCreated', () => {
  test('inserts a PersonaMembership with metadata fan_handle and active status', async () => {
    seedTable('PersonaMembership', []);
    await personaWebhookHandlers.handlePersonaSubscriptionCreated(
      fakeSubscription({ status: 'active' }),
    );
    const memberships = getTable('PersonaMembership');
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      persona_id: PERSONA_ID,
      user_id: FAN_ID,
      tier_id: TIER_2_ID,
      fan_handle: 'lurker_a8f3',
      fan_handle_normalized: 'lurker_a8f3',
      relationship_type: 'subscriber',
      status: 'active',
      stripe_subscription_id: 'sub_test_123',
      stripe_customer_id: 'cus_test_123',
      cancel_at_period_end: false,
      notification_level: 'all',
    });
    expect(memberships[0].current_period_start).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  test('is idempotent — calling twice does NOT duplicate the membership', async () => {
    seedTable('PersonaMembership', []);
    const sub = fakeSubscription({ status: 'active' });
    await personaWebhookHandlers.handlePersonaSubscriptionCreated(sub);
    await personaWebhookHandlers.handlePersonaSubscriptionCreated({
      ...sub, status: 'active', // replay
    });
    expect(getTable('PersonaMembership')).toHaveLength(1);
  });

  test('does not turn notifications back on when Stripe replays the same subscription', async () => {
    seedTable('PersonaMembership', []);
    const sub = fakeSubscription({ status: 'active' });
    await personaWebhookHandlers.handlePersonaSubscriptionCreated(sub);
    getTable('PersonaMembership')[0].notification_level = 'none';

    await personaWebhookHandlers.handlePersonaSubscriptionCreated({
      ...sub, status: 'active',
    });

    expect(getTable('PersonaMembership')[0].notification_level).toBe('none');
  });

  test('turns notifications on when an existing free follower subscribes', async () => {
    seedTable('PersonaMembership', [{
      id: 'mem-free', persona_id: PERSONA_ID, user_id: FAN_ID, tier_id: 'tier-1',
      fan_handle: 'lurker_a8f3', fan_handle_normalized: 'lurker_a8f3',
      status: 'active', relationship_type: 'follower', notification_level: 'none',
      stripe_subscription_id: null,
    }]);

    await personaWebhookHandlers.handlePersonaSubscriptionCreated(
      fakeSubscription({ status: 'active' }),
    );

    expect(getTable('PersonaMembership')).toHaveLength(1);
    expect(getTable('PersonaMembership')[0]).toMatchObject({
      id: 'mem-free',
      relationship_type: 'subscriber',
      stripe_subscription_id: 'sub_test_123',
      notification_level: 'all',
    });
  });

  test('falls back to a generated audience identity when legacy metadata handle is globally taken', async () => {
    seedTable('PersonaMembership', []);
    seedTable('AudienceIdentity', [{
      id: 'audience-other',
      user_id: 'other-fan-id',
      handle: 'lurker_a8f3',
      handle_normalized: 'lurker_a8f3',
      display_name: 'lurker_a8f3',
      status: 'active',
      source: 'user_selected',
    }]);

    await personaWebhookHandlers.handlePersonaSubscriptionCreated(
      fakeSubscription({ status: 'active' }),
    );

    const memberships = getTable('PersonaMembership');
    expect(memberships).toHaveLength(1);
    expect(memberships[0].audience_identity_id).toBeTruthy();
    expect(memberships[0].fan_handle).toMatch(/^fan_[a-f0-9]+$/);
    expect(memberships[0].fan_handle).not.toBe('lurker_a8f3');
  });

  test('skips when persona metadata is missing (legacy subscription, gigs/etc.)', async () => {
    seedTable('PersonaMembership', []);
    await personaWebhookHandlers.handlePersonaSubscriptionCreated({
      id: 'sub_no_meta', metadata: {},
      status: 'active', current_period_start: nowSec(), current_period_end: nowSec(),
    });
    expect(getTable('PersonaMembership')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. handlePersonaSubscriptionUpdated — cancel_at_period_end flag.
// ---------------------------------------------------------------------------
describe('handlePersonaSubscriptionUpdated', () => {
  test('updates cancel_at_period_end correctly', async () => {
    seedTable('PersonaMembership', [{
      id: 'mem-1', persona_id: PERSONA_ID, user_id: FAN_ID, tier_id: TIER_2_ID,
      fan_handle: 'lurker_a8f3', fan_handle_normalized: 'lurker_a8f3',
      status: 'active', stripe_subscription_id: 'sub_test_123',
      cancel_at_period_end: false,
    }]);

    await personaWebhookHandlers.handlePersonaSubscriptionUpdated(
      fakeSubscription({ status: 'active', cancel_at_period_end: true }),
    );

    const stored = getTable('PersonaMembership').find((m) => m.id === 'mem-1');
    expect(stored.cancel_at_period_end).toBe(true);
    expect(stored.status).toBe('active');
  });

  test('maps Stripe past_due → PersonaMembership past_due', async () => {
    seedTable('PersonaMembership', [{
      id: 'mem-1', persona_id: PERSONA_ID, user_id: FAN_ID, tier_id: TIER_2_ID,
      fan_handle: 'lurker_a8f3', fan_handle_normalized: 'lurker_a8f3',
      status: 'active', stripe_subscription_id: 'sub_test_123',
    }]);
    await personaWebhookHandlers.handlePersonaSubscriptionUpdated(
      fakeSubscription({ status: 'past_due' }),
    );
    const stored = getTable('PersonaMembership').find((m) => m.id === 'mem-1');
    expect(stored.status).toBe('past_due');
  });

  test('throws when the persona subscription row is missing so Stripe can retry', async () => {
    seedTable('PersonaMembership', []);
    await expect(
      personaWebhookHandlers.handlePersonaSubscriptionUpdated(
        fakeSubscription({ status: 'active' }),
      ),
    ).rejects.toThrow(/no rows affected/);
  });
});

// ---------------------------------------------------------------------------
// 6. handlePersonaSubscriptionDeleted — terminal status branching.
// ---------------------------------------------------------------------------
describe('handlePersonaSubscriptionDeleted', () => {
  beforeEach(() => {
    seedTable('PersonaMembership', [{
      id: 'mem-1', persona_id: PERSONA_ID, user_id: FAN_ID, tier_id: TIER_2_ID,
      fan_handle: 'lurker_a8f3', fan_handle_normalized: 'lurker_a8f3',
      status: 'active', stripe_subscription_id: 'sub_test_123',
    }]);
  });

  test('cancel_at_period_end=true → status="canceled"', async () => {
    await personaWebhookHandlers.handlePersonaSubscriptionDeleted(
      fakeSubscription({
        status: 'canceled', cancel_at_period_end: true,
        canceled_at: nowSec(),
      }),
    );
    const stored = getTable('PersonaMembership').find((m) => m.id === 'mem-1');
    expect(stored.status).toBe('canceled');
    expect(stored.canceled_at).toBeTruthy();
  });

  test('cancel_at_period_end=false → status="expired"', async () => {
    await personaWebhookHandlers.handlePersonaSubscriptionDeleted(
      fakeSubscription({ status: 'canceled', cancel_at_period_end: false }),
    );
    const stored = getTable('PersonaMembership').find((m) => m.id === 'mem-1');
    expect(stored.status).toBe('expired');
  });
});

// ---------------------------------------------------------------------------
// 7. handlePersonaInvoicePaymentFailed.
// ---------------------------------------------------------------------------
describe('handlePersonaInvoicePaymentFailed', () => {
  test('sets status=past_due', async () => {
    seedTable('PersonaMembership', [{
      id: 'mem-1', persona_id: PERSONA_ID, user_id: FAN_ID, tier_id: TIER_2_ID,
      fan_handle: 'l', fan_handle_normalized: 'l',
      status: 'active', stripe_subscription_id: 'sub_test_123',
    }]);
    await personaWebhookHandlers.handlePersonaInvoicePaymentFailed({
      id: 'in_test_1', subscription: 'sub_test_123',
    });
    const stored = getTable('PersonaMembership').find((m) => m.id === 'mem-1');
    expect(stored.status).toBe('past_due');
  });

  test('is a no-op when the invoice subscription is not a persona membership', async () => {
    seedTable('PersonaMembership', []);
    await expect(personaWebhookHandlers.handlePersonaInvoicePaymentFailed({
      id: 'in_legacy_1', subscription: 'sub_not_persona',
    })).resolves.toBeUndefined();
    expect(getTable('PersonaMembership')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 8. handlePersonaChargeRefunded.
// ---------------------------------------------------------------------------
describe('handlePersonaChargeRefunded', () => {
  test('sets status=expired by chasing charge → invoice → subscription', async () => {
    seedTable('PersonaMembership', [{
      id: 'mem-1', persona_id: PERSONA_ID, user_id: FAN_ID, tier_id: TIER_2_ID,
      fan_handle: 'l', fan_handle_normalized: 'l',
      status: 'active', stripe_subscription_id: 'sub_test_123',
    }]);
    mockStripe.invoices.retrieve.mockResolvedValueOnce({
      id: 'in_x', subscription: 'sub_test_123',
    });
    mockStripe.subscriptions.retrieve.mockResolvedValueOnce(
      fakeSubscription(),
    );

    await personaWebhookHandlers.handlePersonaChargeRefunded({
      id: 'ch_x', invoice: 'in_x',
      amount_refunded: 500, amount: 500,
      refunds: { data: [{ id: 're_x' }] },
    });

    const stored = getTable('PersonaMembership').find((m) => m.id === 'mem-1');
    expect(stored.status).toBe('expired');
  });

  test('is a no-op when the subscription has no persona metadata', async () => {
    seedTable('PersonaMembership', [{
      id: 'mem-1', persona_id: PERSONA_ID, user_id: FAN_ID, tier_id: TIER_2_ID,
      fan_handle: 'l', fan_handle_normalized: 'l',
      status: 'active', stripe_subscription_id: 'sub_other',
    }]);
    mockStripe.invoices.retrieve.mockResolvedValueOnce({
      id: 'in_x', subscription: 'sub_other',
    });
    mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
      id: 'sub_other', metadata: {},
    });
    await personaWebhookHandlers.handlePersonaChargeRefunded({
      id: 'ch_x', invoice: 'in_x',
      amount_refunded: 500, amount: 500,
      refunds: { data: [{ id: 're_x' }] },
    });
    const stored = getTable('PersonaMembership').find((m) => m.id === 'mem-1');
    expect(stored.status).toBe('active');
  });
});

// ---------------------------------------------------------------------------
// 9. handlePersonaChargeDisputeCreated.
// ---------------------------------------------------------------------------
describe('handlePersonaChargeDisputeCreated', () => {
  test('expires the membership AND inserts a PersonaBlock(source=chargeback)', async () => {
    seedTable('PersonaMembership', [{
      id: 'mem-1', persona_id: PERSONA_ID, user_id: FAN_ID, tier_id: TIER_2_ID,
      fan_handle: 'l', fan_handle_normalized: 'l',
      status: 'active', stripe_subscription_id: 'sub_test_123',
    }]);
    seedTable('PersonaBlock', []);
    seedTable('IdentityAuditLog', []);
    mockStripe.charges.retrieve.mockResolvedValueOnce({
      id: 'ch_disputed', invoice: 'in_d',
    });
    mockStripe.invoices.retrieve.mockResolvedValueOnce({
      id: 'in_d', subscription: 'sub_test_123',
    });
    mockStripe.subscriptions.retrieve.mockResolvedValueOnce(
      fakeSubscription(),
    );

    await personaWebhookHandlers.handlePersonaChargeDisputeCreated({
      id: 'dp_test', charge: 'ch_disputed',
    });

    const stored = getTable('PersonaMembership').find((m) => m.id === 'mem-1');
    expect(stored.status).toBe('expired');

    const blocks = getTable('PersonaBlock');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      persona_id: PERSONA_ID,
      blocked_user_id: FAN_ID,
      source: 'chargeback',
    });
    expect(blocks[0].reason).toMatch(/dp_test/);

    const audit = getTable('IdentityAuditLog')
      .find((row) => row.action === 'persona_block.created');
    expect(audit).toBeTruthy();
    expect(audit).toMatchObject({
      actor_user_id: null,
      persona_id: PERSONA_ID,
      target_user_id: FAN_ID,
      target_type: 'PersonaBlock',
    });
    expect(audit.metadata).toMatchObject({
      source: 'chargeback',
      dispute_id: 'dp_test',
      subscription_id: 'sub_test_123',
    });
  });
});

// ---------------------------------------------------------------------------
// Bonus: invoice.paid rolls the period window without expiring quotas.
// ---------------------------------------------------------------------------
describe('handlePersonaInvoicePaid', () => {
  test('rolls current_period_start / current_period_end to the new invoice window', async () => {
    seedTable('PersonaMembership', [{
      id: 'mem-1', persona_id: PERSONA_ID, user_id: FAN_ID, tier_id: TIER_2_ID,
      fan_handle: 'l', fan_handle_normalized: 'l',
      status: 'past_due', stripe_subscription_id: 'sub_test_123',
      current_period_start: '2026-04-15T00:00:00.000Z',
      current_period_end:   '2026-05-15T00:00:00.000Z',
    }]);
    const newStart = new Date('2026-05-15T00:00:00Z').getTime() / 1000;
    const newEnd   = new Date('2026-06-15T00:00:00Z').getTime() / 1000;
    await personaWebhookHandlers.handlePersonaInvoicePaid({
      id: 'in_test_2', subscription: 'sub_test_123',
      period_start: newStart, period_end: newEnd,
    });
    const stored = getTable('PersonaMembership').find((m) => m.id === 'mem-1');
    expect(stored.current_period_start).toBe('2026-05-15T00:00:00.000Z');
    expect(stored.current_period_end).toBe('2026-06-15T00:00:00.000Z');
    expect(stored.status).toBe('active');
  });
});
