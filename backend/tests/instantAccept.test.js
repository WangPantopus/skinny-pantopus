/**
 * Tests for the instant-accept endpoint logic.
 *
 * Uses the in-memory supabaseAdmin mock to simulate DB operations.
 * Route handler is required directly; req/res are mock objects.
 */

jest.mock('../stripe/stripeService', () => ({
  createPaymentIntentForGig: jest.fn(async () => ({
    clientSecret: 'pi_client_secret',
    paymentId: 'payment-pi-1',
    paymentIntentId: 'pi_123',
    payment: { payment_status: 'authorize_pending' },
  })),
  getOrCreateCustomer: jest.fn(async () => 'cus_fixture'),
  getEffectiveFeeRate: jest.fn(async () => 15),
  calculateFees: jest.fn(() => ({ platformFee: 750 })),
  createSetupIntent: jest.fn(async () => ({
    clientSecret: 'seti_client_secret',
    paymentId: 'payment-si-1',
    setupIntentId: 'seti_123',
    payment: { payment_status: 'setup_pending' },
  })),
}));

const { resetTables, seedTable, getTable, setRpcMock } = require('./__mocks__/supabaseAdmin');
const { createNotification } = require('../services/notificationService');
const stripeService = require('../stripe/stripeService');

const router = require('../routes/gigsV2');

// Extract route handlers from the Express router stack
function getHandler(method, pathPattern) {
  for (const layer of router.stack) {
    if (
      layer.route &&
      layer.route.methods[method] &&
      layer.route.path === pathPattern
    ) {
      const handlers = layer.route.stack.filter(s => s.method === method);
      return handlers[handlers.length - 1].handle;
    }
  }
  throw new Error(`No handler found for ${method.toUpperCase()} ${pathPattern}`);
}

// Mock req/res factories
function mockReq(overrides = {}) {
  return {
    params: {},
    body: {},
    user: { id: 'helper-1' },
    app: { get: () => null },
    ...overrides,
  };
}

function mockRes() {
  const res = {
    _status: null,
    _json: null,
    status(code) { res._status = code; return res; },
    json(data) { res._json = data; return res; },
  };
  return res;
}

beforeEach(() => {
  resetTables();
  setRpcMock(async (name, args) => {
    if (name !== 'reserve_instant_gig') return { data: null, error: { message: 'Unexpected RPC' } };
    const gig = getTable('Gig').find(row => row.id === args.p_gig_id);
    Object.assign(gig, { status: 'assigned', accepted_by: args.p_helper_id,
      accepted_at: new Date().toISOString(),
      payment_id: gig.price > 0 ? 'payment-reserved-1' : null,
      payment_status: gig.price > 0 ? 'ready_to_authorize' : null });
    return { data: { gig, reused: false }, error: null };
  });
  createNotification.mockClear();
  stripeService.createPaymentIntentForGig.mockClear();
  stripeService.createSetupIntent.mockClear();
});

describe('POST /:gigId/instant-accept', () => {
  const handler = getHandler('post', '/:gigId/instant-accept');

  const posterId = 'poster-1';
  const helperId = 'helper-1';
  const gigId = 'gig-100';

  function seedOpenInstantGig(overrides = {}) {
    seedTable('Gig', [{
      id: gigId,
      user_id: posterId,
      status: 'open',
      engagement_mode: 'instant_accept',
      price: 50,
      title: 'Help me move',
      ...overrides,
    }]);
  }

  function seedHelperStripe() {
    seedTable('StripeAccount', [{
      id: 'sa-1',
      user_id: helperId,
      details_submitted: true,
      payouts_enabled: true,
    }]);
  }

  // ── Happy path ──

  test('should assign gig on instant accept (happy path)', async () => {
    seedOpenInstantGig();
    seedHelperStripe();

    const req = mockReq({ params: { gigId }, user: { id: helperId } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.message).toBe('Task accepted successfully');
    expect(res._json.gig.status).toBe('assigned');
    expect(res._json.gig.accepted_by).toBe(helperId);
    expect(res._json.assignment.helper_id).toBe(helperId);
    expect(res._json.gig.payment_id).toBe('payment-reserved-1');
    expect(res._json.gig.payment_status).toBe('ready_to_authorize');
    expect(stripeService.createPaymentIntentForGig).not.toHaveBeenCalled();
    expect(res._json.payment).toBeNull();
    expect(stripeService.createSetupIntent).not.toHaveBeenCalled();
  });

  test('should reserve future tasks without starting a provider attempt', async () => {
    const eightDaysFromNow = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();
    seedOpenInstantGig({ scheduled_start: eightDaysFromNow });
    seedHelperStripe();

    const req = mockReq({ params: { gigId }, user: { id: helperId } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.gig.payment_id).toBe('payment-reserved-1');
    expect(res._json.gig.payment_status).toBe('ready_to_authorize');
    expect(stripeService.createSetupIntent).not.toHaveBeenCalled();
    expect(res._json.requiresPaymentSetup).toBe(true);
    expect(stripeService.createPaymentIntentForGig).not.toHaveBeenCalled();
  });

  test('should block assignment when payment setup fails', async () => {
    seedOpenInstantGig();
    seedHelperStripe();
    stripeService.getOrCreateCustomer.mockRejectedValueOnce(new Error('mock customer failure'));

    const req = mockReq({ params: { gigId }, user: { id: helperId } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(503);
    expect(res._json.code).toBe('payer_payment_required');
    expect(res._json.error).toMatch(/payment setup is unavailable/i);
    const gigs = getTable('Gig');
    const unchanged = gigs.find(g => g.id === gigId);
    expect(unchanged.status).toBe('open');
    expect(unchanged.accepted_by).toBeUndefined();
  });

  // ── Validation errors ──

  test('should reject if gig not instant_accept mode', async () => {
    seedOpenInstantGig({ engagement_mode: 'curated_offers' });
    seedHelperStripe();

    const req = mockReq({ params: { gigId }, user: { id: helperId } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._json.error).toMatch(/instant accept/i);
  });

  test('should reject poster self-accept', async () => {
    seedOpenInstantGig();
    seedHelperStripe();

    const req = mockReq({ params: { gigId }, user: { id: posterId } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._json.error).toMatch(/own task/i);
  });

  test('should reject if already assigned', async () => {
    seedOpenInstantGig({ status: 'assigned' });
    seedHelperStripe();

    const req = mockReq({ params: { gigId }, user: { id: helperId } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(409);
    expect(res._json.error).toMatch(/already.*assigned/i);
  });

  test('should reject helper missing payout setup', async () => {
    seedOpenInstantGig();
    // No StripeAccount seeded

    const req = mockReq({ params: { gigId }, user: { id: helperId } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(403);
    expect(res._json.error).toMatch(/payout/i);
  });

  test('should reject helper with incomplete payout setup', async () => {
    seedOpenInstantGig();
    seedTable('StripeAccount', [{
      id: 'sa-1',
      user_id: helperId,
      details_submitted: false,
      payouts_enabled: false,
    }]);

    const req = mockReq({ params: { gigId }, user: { id: helperId } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(403);
    expect(res._json.error).toMatch(/payout/i);
  });

  test('should allow accept for free gig without payout setup', async () => {
    seedOpenInstantGig({ price: 0 });

    const req = mockReq({ params: { gigId }, user: { id: helperId } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.gig.status).toBe('assigned');
  });

  test('should return 404 for nonexistent gig', async () => {
    const req = mockReq({ params: { gigId: 'no-such-gig' }, user: { id: helperId } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(404);
  });

  // ── Race condition ──

  test('should handle race condition (second accept gets 409)', async () => {
    seedOpenInstantGig();
    seedHelperStripe();

    // First accept succeeds
    const req1 = mockReq({ params: { gigId }, user: { id: helperId } });
    const res1 = mockRes();
    await handler(req1, res1);
    expect(res1._status).toBe(200);

    // Second accept should fail (gig is now 'assigned', not 'open')
    const helper2 = 'helper-2';
    seedTable('StripeAccount', [{
      id: 'sa-2',
      user_id: helper2,
      details_submitted: true,
      payouts_enabled: true,
    }]);
    const req2 = mockReq({ params: { gigId }, user: { id: helper2 } });
    const res2 = mockRes();
    await handler(req2, res2);

    expect(res2._status).toBe(409);
    expect(res2._json.error).toMatch(/already.*assigned/i);
  });

  // ── Side effects ──

  test('should create notification for poster', async () => {
    seedOpenInstantGig();
    seedHelperStripe();

    const req = mockReq({ params: { gigId }, user: { id: helperId } });
    const res = mockRes();
    await handler(req, res);

    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: posterId,
        type: 'task_accepted',
      })
    );
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: posterId,
        type: 'payment_action_required',
      })
    );
  });

  test('should emit socket event on successful accept', async () => {
    seedOpenInstantGig();
    seedHelperStripe();

    const emitFn = jest.fn();
    const ioMock = { to: () => ({ emit: emitFn }) };

    const req = mockReq({
      params: { gigId },
      user: { id: helperId },
      app: { get: (key) => (key === 'io' ? ioMock : null) },
    });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(emitFn).toHaveBeenCalledWith(
      'gig:status-change',
      expect.objectContaining({ gigId })
    );
  });

  // ── DB state verification ──

  test('should update gig record in database', async () => {
    seedOpenInstantGig();
    seedHelperStripe();

    const req = mockReq({ params: { gigId }, user: { id: helperId } });
    const res = mockRes();
    await handler(req, res);

    const gigs = getTable('Gig');
    const updatedGig = gigs.find(g => g.id === gigId);
    expect(updatedGig.status).toBe('assigned');
    expect(updatedGig.accepted_by).toBe(helperId);
    expect(updatedGig.accepted_at).toBeDefined();
  });
});
