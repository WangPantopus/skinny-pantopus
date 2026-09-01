// ============================================================
// TEST: Wallet withdraw + Stripe Connect routes (Block 3C)
// The mobile clients drive payout setup + withdraw against these routes:
//   POST /api/payments/connect/account     (create/ensure connected account)
//   POST /api/payments/connect/onboarding  (Account Link URL)
//   GET  /api/payments/connect/account      (onboarding / payouts-enabled state)
//   POST /api/payments/connect/dashboard   (Express dashboard link)
//   POST /api/wallet/withdraw              (earned funds -> bank)
// This locks the response shapes + the payouts-enabled gating the clients read.
// ============================================================

const express = require('express');
const request = require('supertest');

jest.mock('../config/supabaseAdmin', () => ({
  from: jest.fn(),
}));
const supabaseAdmin = require('../config/supabaseAdmin');

jest.mock('../stripe/stripeService', () => ({
  createConnectAccount: jest.fn(),
  createAccountLink: jest.fn(),
  getConnectAccount: jest.fn(),
  createLoginLink: jest.fn(),
  reconcilePendingTipsForUser: jest.fn(),
}));
const stripeService = require('../stripe/stripeService');

jest.mock('../services/walletService', () => ({
  withdraw: jest.fn(),
  getOrCreateWallet: jest.fn(),
  getTransactions: jest.fn(),
}));
const walletService = require('../services/walletService');

jest.mock('../middleware/verifyToken', () => {
  const mw = (req, _res, next) => {
    req.user = { id: req.headers['x-test-user-id'] || USER_ID, role: 'user' };
    next();
  };
  mw.requireAdmin = (_req, _res, next) => next();
  mw.invalidateRoleCache = () => {};
  return mw;
});

const paysRoutes = require('../routes/pays');
const walletRoutes = require('../routes/wallet');

const USER_ID = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/payments', paysRoutes);
  app.use('/api/wallet', walletRoutes);
  return app;
}

// Minimal supabaseAdmin.from() stub: User lookups (for connect/account) resolve
// to a row; everything else is unused by the routes under test.
function stubUserRow() {
  supabaseAdmin.from.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        single: async () => ({ data: { email: 'seller@example.com', name: 'Sam Seller' }, error: null }),
      }),
    }),
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
  stubUserRow();
});

describe('Stripe Connect routes', () => {
  test('POST /connect/account creates/ensures the connected account', async () => {
    stripeService.createConnectAccount.mockResolvedValue({
      success: true,
      account: { id: 'sa-1', payouts_enabled: false },
      stripeAccountId: 'acct_1',
    });

    const res = await request(buildApp())
      .post('/api/payments/connect/account')
      .send({ country: 'US', businessType: 'individual' });

    expect(res.status).toBe(201);
    expect(res.body.stripeAccountId).toBe('acct_1');
    expect(stripeService.createConnectAccount).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ email: 'seller@example.com', country: 'US' }),
    );
  });

  test('POST /connect/onboarding returns an Account Link URL', async () => {
    stripeService.createAccountLink.mockResolvedValue({
      success: true,
      url: 'https://connect.stripe.com/setup/abc',
      expiresAt: 1893456000,
    });

    const res = await request(buildApp())
      .post('/api/payments/connect/onboarding')
      .send({ returnUrl: 'https://pantopus.app/wallet?onboarding=done' });

    expect(res.status).toBe(200);
    expect(res.body.onboardingUrl).toBe('https://connect.stripe.com/setup/abc');
  });

  test('GET /connect/account reflects payouts-enabled state', async () => {
    stripeService.getConnectAccount.mockResolvedValue({
      success: true,
      account: { id: 'sa-1', charges_enabled: true, payouts_enabled: true, details_submitted: true },
    });

    const res = await request(buildApp()).get('/api/payments/connect/account');

    expect(res.status).toBe(200);
    expect(res.body.account.payouts_enabled).toBe(true);
  });

  test('GET /connect/account 404s when the seller has no account yet', async () => {
    stripeService.getConnectAccount.mockResolvedValue({ success: false, error: 'No Stripe account found' });

    const res = await request(buildApp()).get('/api/payments/connect/account');

    expect(res.status).toBe(404);
  });

  test('POST /connect/dashboard returns the Express dashboard link', async () => {
    stripeService.createLoginLink.mockResolvedValue({ success: true, url: 'https://connect.stripe.com/express/xyz' });

    const res = await request(buildApp()).post('/api/payments/connect/dashboard').send({});

    expect(res.status).toBe(200);
    expect(res.body.dashboardUrl).toBe('https://connect.stripe.com/express/xyz');
  });
});

describe('POST /api/wallet/withdraw', () => {
  test('initiates a withdrawal of the requested cents', async () => {
    walletService.withdraw.mockResolvedValue({ id: 'wtx-1', type: 'withdrawal', amount: 84750 });

    const res = await request(buildApp())
      .post('/api/wallet/withdraw')
      .send({ amount: 84750 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.transaction.id).toBe('wtx-1');
    expect(walletService.withdraw).toHaveBeenCalledWith(USER_ID, 84750, expect.any(Object));
  });

  test('gates withdraw on a verified payout account (400)', async () => {
    walletService.withdraw.mockRejectedValue(
      new Error('Your payout account is not yet verified. Please complete Stripe onboarding.'),
    );

    const res = await request(buildApp())
      .post('/api/wallet/withdraw')
      .send({ amount: 5000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/onboarding/i);
  });

  test('rejects sub-minimum amounts before hitting the service', async () => {
    const res = await request(buildApp())
      .post('/api/wallet/withdraw')
      .send({ amount: 50 });

    expect(res.status).toBe(400);
    expect(walletService.withdraw).not.toHaveBeenCalled();
  });
});
