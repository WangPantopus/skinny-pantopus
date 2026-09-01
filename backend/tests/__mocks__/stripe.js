// ============================================================
// MOCK: Stripe SDK
// Returns controllable promises for all Stripe methods used.
// Each method is a jest.fn() so tests can inspect calls and
// override return values with mockResolvedValueOnce().
// ============================================================

const stripeMock = {
  paymentIntents: {
    create: jest.fn().mockResolvedValue({
      id: 'pi_mock_123',
      client_secret: 'pi_mock_123_secret',
      status: 'requires_confirmation',
      latest_charge: null,
    }),
    confirm: jest.fn().mockResolvedValue({
      id: 'pi_mock_123',
      status: 'requires_capture',
      latest_charge: 'ch_mock_123',
    }),
    capture: jest.fn().mockResolvedValue({
      id: 'pi_mock_123',
      status: 'succeeded',
      latest_charge: 'ch_mock_123',
    }),
    cancel: jest.fn().mockResolvedValue({
      id: 'pi_mock_123',
      status: 'canceled',
    }),
    retrieve: jest.fn().mockResolvedValue({
      id: 'pi_mock_123',
      status: 'requires_capture',
    }),
  },
  setupIntents: {
    create: jest.fn().mockResolvedValue({
      id: 'seti_mock_123',
      client_secret: 'seti_mock_123_secret',
      status: 'succeeded',
      payment_method: 'pm_mock_123',
    }),
    retrieve: jest.fn().mockResolvedValue({
      id: 'seti_mock_123',
      status: 'succeeded',
      payment_method: 'pm_mock_123',
    }),
  },
  transfers: {
    create: jest.fn().mockResolvedValue({
      id: 'tr_mock_123',
      amount: 8500,
      destination: 'acct_mock_payee',
    }),
    createReversal: jest.fn().mockResolvedValue({
      id: 'trr_mock_123',
      amount: 8500,
    }),
  },
  refunds: {
    create: jest.fn().mockResolvedValue({
      id: 're_mock_123',
      amount: 10000,
      status: 'succeeded',
    }),
  },
  customers: {
    create: jest.fn().mockResolvedValue({ id: 'cus_mock_123' }),
    retrieve: jest.fn().mockResolvedValue({ id: 'cus_mock_123' }),
  },
  disputes: {
    update: jest.fn().mockResolvedValue({ id: 'dp_mock_123', status: 'under_review' }),
  },
  // P1.7 — Connect / Pricing surface used by personaPaymentsService.
  accounts: {
    create: jest.fn().mockResolvedValue({
      id: 'acct_mock_persona',
      country: 'US',
      business_type: 'individual',
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
      requirements: {},
    }),
    update: jest.fn().mockResolvedValue({
      id: 'acct_mock_persona',
    }),
    retrieve: jest.fn().mockResolvedValue({
      id: 'acct_mock_persona',
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
    }),
  },
  accountLinks: {
    create: jest.fn().mockResolvedValue({
      url: 'https://connect.stripe.test/onboarding/mock',
      expires_at: 9999999999,
    }),
  },
  products: {
    create: jest.fn().mockResolvedValue({
      id: 'prod_mock_persona',
      name: 'Mock persona product',
      metadata: {},
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
  // P1.9 — Checkout + subscription chain.
  checkout: {
    sessions: {
      create: jest.fn().mockImplementation((payload) => Promise.resolve({
        id: `cs_mock_${Math.random().toString(36).slice(2, 10)}`,
        url: 'https://checkout.stripe.test/c/mock',
        mode: payload?.mode || 'subscription',
        subscription: null,
        metadata: payload?.metadata || {},
      })),
    },
  },
  subscriptions: {
    create: jest.fn(),
    retrieve: jest.fn().mockImplementation((id) => Promise.resolve({
      id, metadata: {},
      items: { data: [{ id: `si_mock_${id}`, price: { id: 'price_mock' } }] },
      schedule: null,
      latest_invoice: null,
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
    })),
    update: jest.fn().mockImplementation((id, payload) => Promise.resolve({
      id, ...payload,
    })),
    // P1.14 — subscriptions.cancel is the immediate (not period-end)
    // cancel path used by personaBlockService when a personal block
    // cascades to revoke an active membership.
    cancel: jest.fn().mockImplementation((id) => Promise.resolve({
      id, status: 'canceled',
    })),
  },
  // P1.13 — subscription_schedules drive period-end downgrades.
  subscriptionSchedules: {
    create: jest.fn().mockImplementation((payload) => Promise.resolve({
      id: `sub_sched_mock_${Math.random().toString(36).slice(2, 8)}`,
      from_subscription: payload?.from_subscription || null,
      phases: [],
    })),
    retrieve: jest.fn().mockImplementation((id) => Promise.resolve({
      id, phases: [{
        items: [{ price: 'price_mock_member', quantity: 1 }],
        start_date: Math.floor(Date.now() / 1000),
        end_date: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
      }],
    })),
    update: jest.fn().mockImplementation((id, payload) => Promise.resolve({
      id, ...payload,
    })),
  },
  invoices: {
    retrieve: jest.fn().mockImplementation((id) => Promise.resolve({
      id, subscription: null, charge: null,
    })),
  },
  charges: {
    retrieve: jest.fn().mockImplementation((id) => Promise.resolve({
      id, invoice: null,
    })),
  },
};

// Reset all mocks between tests
stripeMock._resetAll = () => {
  Object.values(stripeMock).forEach(namespace => {
    if (typeof namespace === 'object' && namespace !== null) {
      Object.values(namespace).forEach(fn => {
        if (typeof fn === 'function' && fn.mockReset) fn.mockReset();
      });
    }
  });
};

module.exports = stripeMock;
