/**
 * P1.7 — personaPaymentsService unit tests + route tests.
 *
 * Audience Profile design v2 §6.3, §8.1.
 *
 * Mocks the Stripe SDK via jest.mock('stripe', () => mockStripe) where
 * mockStripe is the shared backend/tests/__mocks__/stripe.js (extended
 * in P1.7 with accounts/accountLinks/products/prices). Mocks
 * stripeService at the module path so the service's wrapper helpers
 * (createConnectAccount / createAccountLink) return controllable
 * results without hitting real Stripe.
 */

// jest.mock factory bodies are hoisted and run before any top-level
// requires. We can't `require('../__mocks__/stripe')` here because
// that path is itself rewritten by the mock — infinite recursion.
// Instead, inline the mock factory: define jest.fn() instances and
// expose them as a module-level mockStripe (the "mock" prefix is one
// of the case-insensitive identifier prefixes Jest allows).
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

const express = require('express');
const request = require('supertest');
const featureFlagService = require('../../services/featureFlagService');
const personaPaymentsRouter = require('../../routes/personaPayments');

const FLAG_NAME = 'audience_profile';
const OWNER_ID    = '11111111-1111-4111-8111-111111111111';
const STRANGER_ID = '22222222-2222-4222-8222-222222222222';
const PERSONA_ID  = '44444444-4444-4444-4444-444444444444';

function seedFlagOn() {
  seedTable('FeatureFlag', [{
    id: 'flag-1', flag_name: FLAG_NAME,
    enabled_globally: true, enabled_for_internal_team: false,
    beta_user_ids: [], description: '',
    created_at: '2026-05-08T00:00:00Z',
    updated_at: '2026-05-08T00:00:00Z',
  }]);
  featureFlagService.invalidateFlagCache();
}

function seedPersona() {
  seedTable('User', [
    { id: OWNER_ID,    role: 'user', username: 'owner_handle',    email: 'owner@test.local' },
    { id: STRANGER_ID, role: 'user', username: 'stranger_handle', email: 'stranger@test.local' },
  ]);
  seedTable('PublicPersona', [{
    id: PERSONA_ID,
    user_id: OWNER_ID,
    handle: 'mayabuilds',
    handle_normalized: 'mayabuilds',
    display_name: 'Maya Builds',
    audience_mode: 'open',
    status: 'active',
    follower_count: 0,
  }]);
}

function seedTier({ rank, status = 'active', priceCents, stripePriceId = null }) {
  const tiers = getTable('PersonaTier');
  tiers.push({
    id: `tier-${rank}`,
    persona_id: PERSONA_ID,
    rank,
    name: rank === 1 ? 'Follower' : rank === 2 ? 'Member' : 'Insider',
    description: '',
    price_cents: priceCents,
    currency: 'USD',
    billing_interval: 'month',
    msg_threads_per_period: rank === 1 ? null : 5,
    creator_can_initiate_dm: rank === 3,
    reply_policy: 'discretion',
    status,
    stripe_price_id: stripePriceId,
    position: rank,
    created_at: '2026-05-08T00:00:00Z',
    updated_at: '2026-05-08T00:00:00Z',
  });
  return tiers[tiers.length - 1];
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  mockStripe.accounts.update.mockClear();
  mockStripe.accounts.create.mockClear();
  mockStripe.accountLinks.create.mockClear();
  mockStripe.products.create.mockClear();
  mockStripe.products.search.mockClear();
  mockStripe.prices.create.mockClear();
  // Default: search returns no products (forces ensurePersonaProduct
  // to call create).
  mockStripe.products.search.mockResolvedValue({ data: [] });
  seedPersona();
  seedFlagOn();
});

afterEach(() => {
  featureFlagService.invalidateFlagCache();
});

// ---------------------------------------------------------------------------
// 1. buildStatementDescriptor
// ---------------------------------------------------------------------------
describe('buildStatementDescriptor', () => {
  test('formats short handles to PANTOPUS *@HANDLE (uppercased)', () => {
    expect(personaPaymentsService.buildStatementDescriptor('mayabuilds'))
      .toBe('PANTOPUS *@MAYABUILDS');
    // 11 + 11 = 22 chars exactly
    expect(personaPaymentsService.buildStatementDescriptor('mayabuilds').length)
      .toBeLessThanOrEqual(22);
  });

  test('truncates handles that would push the descriptor past 22 chars', () => {
    const out = personaPaymentsService.buildStatementDescriptor(
      'a-very-long-handle-that-exceeds',
    );
    expect(out.length).toBe(22);
    expect(out.startsWith('PANTOPUS *@')).toBe(true);
  });

  test('handles empty / null gracefully', () => {
    expect(personaPaymentsService.buildStatementDescriptor(null))
      .toBe('PANTOPUS *@');
    expect(personaPaymentsService.buildStatementDescriptor(''))
      .toBe('PANTOPUS *@');
  });
});

// ---------------------------------------------------------------------------
// 2. getOnboardingStatus
// ---------------------------------------------------------------------------
describe('getOnboardingStatus', () => {
  test('returns hasAccount: false when no StripeAccount row exists', async () => {
    seedTable('StripeAccount', []);
    const status = await personaPaymentsService.getOnboardingStatus({ user_id: OWNER_ID });
    expect(status).toEqual({ hasAccount: false, ready: false });
  });

  test('reports ready when charges_enabled AND details_submitted', async () => {
    seedTable('StripeAccount', [{
      id: 'sa-1', user_id: OWNER_ID, stripe_account_id: 'acct_test_ready',
      charges_enabled: true, payouts_enabled: true, details_submitted: true,
      verification_status: 'verified',
    }]);
    const status = await personaPaymentsService.getOnboardingStatus({ user_id: OWNER_ID });
    expect(status).toMatchObject({
      hasAccount: true, ready: true,
      chargesEnabled: true, detailsSubmitted: true,
    });
  });

  test('reports NOT ready when details_submitted is false', async () => {
    seedTable('StripeAccount', [{
      id: 'sa-2', user_id: OWNER_ID, stripe_account_id: 'acct_pending',
      charges_enabled: true, payouts_enabled: false, details_submitted: false,
    }]);
    const status = await personaPaymentsService.getOnboardingStatus({ user_id: OWNER_ID });
    expect(status.ready).toBe(false);
    expect(status.hasAccount).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. ensureConnectAccountForPersona — applies persona-aware business profile.
// ---------------------------------------------------------------------------
describe('ensureConnectAccountForPersona', () => {
  test('updates business_profile.name to the persona display_name', async () => {
    // Create the StripeAccount row first; createConnectAccount returns
    // an existing account in that branch.
    seedTable('StripeAccount', [{
      id: 'sa-x', user_id: OWNER_ID, stripe_account_id: 'acct_existing',
      charges_enabled: false, details_submitted: false,
    }]);

    const persona = {
      id: PERSONA_ID, user_id: OWNER_ID,
      handle: 'mayabuilds', display_name: 'Maya Builds',
    };
    const account = await personaPaymentsService.ensureConnectAccountForPersona(persona);

    expect(account.stripe_account_id).toBe('acct_existing');
    expect(mockStripe.accounts.update).toHaveBeenCalledTimes(1);
    const [acctId, payload] = mockStripe.accounts.update.mock.calls[0];
    expect(acctId).toBe('acct_existing');
    expect(payload.business_profile.name).toBe('Maya Builds');
    expect(payload.business_profile.url).toBe('https://pantopus.com/@mayabuilds');
    expect(payload.settings.payments.statement_descriptor)
      .toBe('PANTOPUS *@MAYABUILDS');
  });

  test('falls back to creating a Connect account when none exists', async () => {
    // Start with no StripeAccount row. mockCreateConnectAccount
    // simulates the real implementation by seeding a row when called,
    // so the service's post-call re-read finds the new account.
    seedTable('StripeAccount', []);
    mockCreateConnectAccount.mockImplementation(async (userId) => {
      seedTable('StripeAccount', [{
        id: 'sa-new', user_id: userId, stripe_account_id: 'acct_new_persona',
        charges_enabled: false, details_submitted: false,
      }]);
      return { success: true, stripeAccountId: 'acct_new_persona' };
    });

    const persona = {
      id: PERSONA_ID, user_id: OWNER_ID,
      handle: 'mayabuilds', display_name: 'Maya Builds',
    };
    const account = await personaPaymentsService.ensureConnectAccountForPersona(persona);

    expect(mockCreateConnectAccount).toHaveBeenCalledWith(OWNER_ID, expect.objectContaining({
      email: 'owner@test.local',
    }));
    expect(account.stripe_account_id).toBe('acct_new_persona');
    expect(mockStripe.accounts.update).toHaveBeenCalledWith(
      'acct_new_persona',
      expect.objectContaining({
        business_profile: expect.objectContaining({ name: 'Maya Builds' }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 4. syncTierToStripePrice
// ---------------------------------------------------------------------------
describe('syncTierToStripePrice', () => {
  const persona = {
    id: PERSONA_ID, user_id: OWNER_ID,
    handle: 'mayabuilds', display_name: 'Maya Builds',
  };

  test('skips rank 1 (free Follower never has a Stripe Price)', async () => {
    const tier = seedTier({ rank: 1, priceCents: 0 });
    const result = await personaPaymentsService.syncTierToStripePrice(
      tier, persona, 'acct_test',
    );
    expect(result).toBe(tier);
    expect(mockStripe.prices.create).not.toHaveBeenCalled();
  });

  test('creates a new Stripe Price and persists stripe_price_id on the tier', async () => {
    const tier = seedTier({ rank: 2, priceCents: 500 });
    mockStripe.prices.create.mockResolvedValueOnce({
      id: 'price_member_v1',
      product: 'prod_persona_x',
      unit_amount: 500,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    const result = await personaPaymentsService.syncTierToStripePrice(
      tier, persona, 'acct_test',
    );

    expect(result.stripe_price_id).toBe('price_member_v1');
    expect(mockStripe.products.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.stringContaining('Maya Builds'),
        metadata: expect.objectContaining({ persona_id: PERSONA_ID }),
      }),
      expect.objectContaining({ stripeAccount: 'acct_test' }),
    );
    expect(mockStripe.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        unit_amount: 500,
        currency: 'usd',
        recurring: { interval: 'month' },
        metadata: expect.objectContaining({
          persona_tier_id: tier.id,
          persona_tier_rank: '2',
        }),
      }),
      expect.objectContaining({ stripeAccount: 'acct_test' }),
    );

    // DB row reflects the new price id.
    const stored = getTable('PersonaTier').find((t) => t.id === tier.id);
    expect(stored.stripe_price_id).toBe('price_member_v1');
  });

  test('skips when no stripeAccountId is provided', async () => {
    const tier = seedTier({ rank: 2, priceCents: 500 });
    const result = await personaPaymentsService.syncTierToStripePrice(
      tier, persona, null,
    );
    expect(result).toBe(tier);
    expect(mockStripe.prices.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 5. POST /api/personas/:id/payments/onboard route
// ---------------------------------------------------------------------------
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/personas/:id/payments', personaPaymentsRouter);
  return app;
}

describe('POST /api/personas/:id/payments/onboard', () => {
  beforeEach(() => {
    seedTable('StripeAccount', [{
      id: 'sa-r', user_id: OWNER_ID, stripe_account_id: 'acct_existing',
      charges_enabled: false, details_submitted: false,
    }]);
    mockCreateAccountLink.mockResolvedValue({
      success: true,
      url: 'https://connect.stripe.test/onboarding/abc',
      expiresAt: 9999999999,
    });
  });

  test('owner gets a fresh onboarding URL', async () => {
    const res = await request(buildApp())
      .post(`/api/personas/${PERSONA_ID}/payments/onboard`)
      .set('x-test-user-id', OWNER_ID)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://connect.stripe.test/onboarding/abc');
    expect(mockCreateAccountLink).toHaveBeenCalledWith(
      OWNER_ID,
      expect.stringContaining('/app/audience/setup?step=stripe&done=1'),
      expect.stringContaining('/app/audience/setup?step=stripe&refresh=1'),
    );
  });

  test('non-owner gets 404 (existence must not leak)', async () => {
    const res = await request(buildApp())
      .post(`/api/personas/${PERSONA_ID}/payments/onboard`)
      .set('x-test-user-id', STRANGER_ID)
      .send({});
    expect(res.status).toBe(404);
    expect(mockCreateAccountLink).not.toHaveBeenCalled();
  });
});
