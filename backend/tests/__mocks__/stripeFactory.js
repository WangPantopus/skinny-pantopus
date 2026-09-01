// ============================================================
// MOCK FACTORY: Stripe SDK (P1.15 E2E support)
//
// The existing tests/__mocks__/stripe.js is a single shared mock
// instance with pre-baked default returns. The E2E suite needs
// finer per-scenario control: each describe block sets up its
// own mock returns and asserts on calls without bleed from the
// previous scenario.
//
// Shape of this module:
//   - The default export IS an instantiated mock (object), not a
//     constructor. backend/stripe/getStripeClient.js sniff-tests
//     the imported module for known method shapes (accounts.create,
//     paymentIntents.create, webhooks.constructEvent) and returns
//     the module as-is if it looks like an instantiated client.
//     Exporting an object — not a function — short-circuits the
//     `Stripe(secretKey)` call path.
//   - The exported `_reset()` helper clears every jest.fn() and
//     re-installs sensible defaults. The E2E helpers expose this
//     as `fixtureMockStripe()`; per-test setup just calls it in
//     `beforeEach`.
//
// Methods covered: every Stripe surface Phase 1 actually touches.
// New methods can be added when a test exercises them.
// ============================================================

function makeStripeMock() {
  return {
    // Connect onboarding (P1.7)
    accounts: {
      create: jest.fn(),
      update: jest.fn(),
      retrieve: jest.fn(),
      createLoginLink: jest.fn(),
    },
    accountLinks: { create: jest.fn() },

    // Persona Checkout + subscription chain (P1.9, P1.13, P1.14)
    checkout: {
      sessions: {
        create: jest.fn(),
        retrieve: jest.fn(),
      },
    },
    subscriptions: {
      create: jest.fn(),
      update: jest.fn(),
      retrieve: jest.fn(),
      cancel: jest.fn(),
    },
    subscriptionSchedules: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
    },

    // Refunds + invoices + charges (P1.13, P1.14, dispute path)
    invoices: { retrieve: jest.fn() },
    refunds: { create: jest.fn() },
    charges: { retrieve: jest.fn() },

    // Tier price sync (P1.7)
    prices: { create: jest.fn(), retrieve: jest.fn() },
    products: { create: jest.fn(), search: jest.fn(), retrieve: jest.fn() },

    // Webhook signature verification (mocked to JSON-parse the raw body)
    webhooks: {
      constructEvent: jest.fn((body) => {
        if (Buffer.isBuffer(body)) return JSON.parse(body.toString('utf8'));
        if (typeof body === 'string') return JSON.parse(body);
        return body;
      }),
    },

    // Unused-by-Phase-1 surfaces that other parts of the codebase
    // touch incidentally during route loading. Keep these so that
    // accidental requires don't crash test setup.
    paymentIntents: {
      create: jest.fn(), confirm: jest.fn(), capture: jest.fn(),
      cancel: jest.fn(), retrieve: jest.fn(),
    },
    setupIntents: { create: jest.fn(), retrieve: jest.fn() },
    transfers: { create: jest.fn(), createReversal: jest.fn() },
    customers: { create: jest.fn(), retrieve: jest.fn() },
    disputes: { update: jest.fn() },
  };
}

const mock = makeStripeMock();

// Restore mocks to a fresh state. Called from `fixtureMockStripe()`
// in beforeEach. We mutate the existing object (not replace it) so
// any caller that already captured a reference still sees the new
// jest.fn() instances.
function resetAll() {
  const fresh = makeStripeMock();
  for (const namespace of Object.keys(fresh)) {
    mock[namespace] = fresh[namespace];
  }

  // Re-install defaults that nearly every test relies on. Specific
  // tests can still override with `mockResolvedValueOnce(...)`.
  mock.accounts.create.mockResolvedValue({
    id: 'acct_e2e_default', country: 'US',
    business_type: 'individual',
    charges_enabled: false, payouts_enabled: false,
    details_submitted: false, requirements: {},
  });
  mock.accounts.update.mockResolvedValue({ id: 'acct_e2e_default' });
  mock.accounts.retrieve.mockResolvedValue({
    id: 'acct_e2e_default',
    charges_enabled: true, payouts_enabled: true, details_submitted: true,
  });
  mock.accountLinks.create.mockResolvedValue({
    url: 'https://connect.stripe.test/onboarding/e2e',
    expires_at: 9999999999,
  });
  mock.products.search.mockResolvedValue({ data: [] });
  mock.products.create.mockImplementation((payload) => Promise.resolve({
    id: `prod_e2e_${Math.random().toString(36).slice(2, 8)}`,
    metadata: payload?.metadata || {},
    name: payload?.name || 'mock product',
  }));
  mock.prices.create.mockImplementation((payload) => Promise.resolve({
    id: `price_e2e_${payload?.unit_amount || 'x'}`,
    product: payload?.product,
    unit_amount: payload?.unit_amount,
    currency: payload?.currency || 'usd',
    recurring: payload?.recurring || { interval: 'month' },
    metadata: payload?.metadata || {},
  }));
  mock.checkout.sessions.create.mockImplementation((payload) => Promise.resolve({
    id: `cs_e2e_${Math.random().toString(36).slice(2, 8)}`,
    url: 'https://checkout.stripe.test/c/e2e',
    mode: payload?.mode || 'subscription',
    metadata: payload?.metadata || {},
  }));
  mock.subscriptions.update.mockImplementation((id, payload) => Promise.resolve({
    id, ...(payload || {}),
  }));
  mock.subscriptions.cancel.mockResolvedValue({
    id: 'sub_e2e', status: 'canceled',
  });
  mock.subscriptionSchedules.create.mockResolvedValue({
    id: 'sub_sched_e2e', from_subscription: 'sub_e2e', phases: [],
  });
  mock.subscriptionSchedules.update.mockImplementation((id, payload) => Promise.resolve({
    id, ...(payload || {}),
  }));
  mock.refunds.create.mockResolvedValue({
    id: 're_e2e', amount: 250, status: 'succeeded',
  });
}

resetAll();

module.exports = mock;
module.exports._reset = resetAll;
