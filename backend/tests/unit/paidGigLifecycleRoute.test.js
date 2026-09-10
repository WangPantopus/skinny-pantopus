const db = require('../__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable, setRpcMock } = db;
const mockRetrieve = jest.fn(), mockCapture = jest.fn(), mockCreate = jest.fn(), mockCancel = jest.fn();
jest.mock('stripe', () => ({ paymentIntents: { retrieve: mockRetrieve, capture: mockCapture, create: mockCreate, cancel: mockCancel } }));
jest.mock('../__mocks__/verifyToken', () => {
  const verify = (req, res, next) => { req.user = { id: req.headers['x-test-user-id'] }; next(); };
  verify.requireAdmin = (req, res, next) => next(); return verify;
});
jest.mock('../../utils/businessPermissions', () => ({ hasPermission: jest.fn().mockResolvedValue(false),
  getBusinessIdsWithPermissions: jest.fn().mockResolvedValue([]), getTeamMembersWithPermissions: jest.fn().mockResolvedValue([]) }));
jest.mock('../../services/gig/browseCacheService', () => ({ get: jest.fn(), set: jest.fn(), invalidateNear: jest.fn() }));
const express = require('express');
const request = require('supertest');
const app = express(); app.use(express.json()); app.use('/api/gigs', require('../../routes/gigs'));
const service = require('../../stripe/stripeService');
const p = { id: 'pay', gig_id: 'gig', payer_id: 'payer', payee_id: 'worker', amount_total: 1250, currency: 'USD',
  payment_type: 'gig_payment', stripe_customer_id: 'cus_payer', stripe_payment_intent_id: 'pi_one',
  payment_status: 'authorize_pending', metadata: { acceptance_attempt_id: 'attempt' } };
const pi = { id: 'pi_one', customer: 'cus_payer', amount: 1250, currency: 'usd', capture_method: 'manual',
  status: 'requires_capture', amount_capturable: 1250, latest_charge: 'ch_one',
  metadata: { payer_id: 'payer', payee_id: 'worker', gig_id: 'gig', acceptance_attempt_id: 'attempt' } };
const post = (path, user = 'payer') => request(app).post(`/api/gigs/${path}`).set('x-test-user-id', user).send({});
beforeEach(() => {
  jest.restoreAllMocks(); jest.clearAllMocks(); resetTables();
  seedTable('User', [{ id: 'payer', account_type: 'personal' }, { id: 'worker', account_type: 'personal' }]);
  seedTable('Gig', [{ id: 'gig', user_id: 'payer', title: 'Synthetic gig', price: 20, status: 'open',
    accepted_by: null, payment_id: null, owner_confirmed_at: null }]);
  seedTable('GigBid', [{ id: 'bid', gig_id: 'gig', user_id: 'worker', bid_amount: 12.5, status: 'pending_payment', pending_payment_intent_id: 'pay' }]);
  seedTable('Payment', [{ ...p }]); mockRetrieve.mockResolvedValue({ ...pi });
});
function assigned(status = 'assigned') {
  Object.assign(getTable('Gig')[0], { status, accepted_by: 'worker', payment_id: 'pay', price: 12.5,
    worker_completed_at: status === 'completed' ? '2026-09-10T00:00:00Z' : null });
  getTable('Payment')[0].payment_status = 'authorized';
}

describe('actual paid-gig owner routes', () => {
  test.each(['accept', 'finalize-accept', 'abort-accept'])('foreign actor cannot %s a bid', async (action) => {
    expect((await post(`gig/bids/bid/${action}`, 'foreign')).status).toBe(403);
    expect(mockRetrieve).not.toHaveBeenCalled(); expect(mockCreate).not.toHaveBeenCalled();
    expect(getTable('GigBid')[0].status).toBe('pending_payment');
  });
  test('owning another gig cannot cancel a foreign pending bid', async () => {
    getTable('Gig').push({ id: 'other-gig', user_id: 'foreign', status: 'open' });
    expect((await post('other-gig/bids/bid/abort-accept', 'foreign')).status).toBe(404);
    expect(mockCancel).not.toHaveBeenCalled(); expect(getTable('GigBid')[0].pending_payment_intent_id).toBe('pay');
  });
  test('pending-payment conflict occurs before provider creation', async () => {
    setRpcMock(async () => ({ data: { error: 'CONFLICT' } }));
    expect((await post('gig/bids/bid/accept')).status).toBe(409);
    expect(mockCreate).not.toHaveBeenCalled();
  });
  test('fake SDK success cannot finalize an unauthenticated intent', async () => {
    mockRetrieve.mockResolvedValue({ ...pi, status: 'requires_action' });
    expect((await post('gig/bids/bid/finalize-accept')).status).toBe(409);
    expect(getTable('Gig')[0].status).toBe('open'); expect(getTable('GigBid')[0].status).toBe('pending_payment');
  });
  test('agreed bid amount rather than gig budget binds authorization', async () => {
    const finalize = jest.fn(async (name) => {
      if (name === 'finalize_paid_gig_acceptance') {
        expect(getTable('Payment')[0].payment_status).toBe('authorized');
        return { data: { error: 'CONFLICT' } };
      }
      throw new Error('Unexpected RPC');
    });
    setRpcMock(finalize);
    expect((await post('gig/bids/bid/finalize-accept')).status).toBe(409);
    expect(finalize).toHaveBeenCalledTimes(1); // proof passed for $12.50, despite $20 budget
    expect(getTable('Gig')[0].status).toBe('open'); expect(getTable('GigBid')[0].status).toBe('pending_payment');
  });
  test.each(['payer_id', 'payee_id', 'gig_id'])('foreign %s cannot finalize a payment', async (key) => {
    getTable('Payment')[0][key] = 'foreign';
    expect((await post('gig/bids/bid/finalize-accept')).status).toBe(409);
    expect(mockRetrieve).not.toHaveBeenCalled(); expect(getTable('Gig')[0].status).toBe('open');
  });
  test('accepted receipt retries without a second provider call or mutation', async () => {
    assigned(); getTable('GigBid')[0].status = 'accepted';
    setRpcMock(async (name) => name === 'get_or_create_gig_chat' ? { data: 'repaired-chat' }
      : { data: { gig: getTable('Gig')[0], bid: getTable('GigBid')[0], reused: true } });
    const result = await post('gig/bids/bid/finalize-accept');
    expect(result.status).toBe(200); expect(result.body.reused).toBe(true); expect(mockRetrieve).not.toHaveBeenCalled();
    expect(result.body.roomId).toBe('repaired-chat');
    expect(getTable('ChatParticipant').map((row) => row.user_id).sort()).toEqual(['payer', 'worker']);
  });
  test('unknown cancel outcome keeps the pending bid reference', async () => {
    setRpcMock(async () => ({ data: { attempt: { payment_id: 'pay', state: 'canceling' } } }));
    mockCancel.mockRejectedValue(new Error('timeout'));
    expect((await post('gig/bids/bid/abort-accept')).status).toBe(503);
    expect(getTable('GigBid')[0].pending_payment_intent_id).toBe('pay'); expect(getTable('Payment')[0].payment_status).toBe('authorize_pending');
  });
});

describe('worker start and owner capture boundaries', () => {
  test('worker cannot start a paid assignment with missing payment', async () => {
    assigned(); seedTable('Payment', []);
    expect((await post('gig/start', 'worker')).status).toBe(409); expect(getTable('Gig')[0].status).toBe('assigned');
  });
  test('worker cannot initialize payer checkout for a legacy missing link', async () => {
    assigned(); getTable('Gig')[0].payment_id = null;
    expect((await post('gig/start', 'worker')).status).toBe(402); expect(mockCreate).not.toHaveBeenCalled();
  });
  test('worker cannot start using a different worker payment', async () => {
    assigned(); getTable('Payment')[0].payee_id = 'other';
    expect((await post('gig/start', 'worker')).status).toBe(409); expect(getTable('Gig')[0].status).toBe('assigned');
  });
  test('foreign actor cannot start a worker assignment', async () => {
    assigned(); expect((await post('gig/start', 'foreign')).status).toBe(403); expect(mockRetrieve).not.toHaveBeenCalled();
  });
  test.each(['foreign', 'worker'])('%s cannot confirm owner capture', async (user) => {
    assigned('completed'); expect((await post('gig/confirm-completion', user)).status).toBe(403); expect(mockCapture).not.toHaveBeenCalled();
  });
  test('paid gig without a payment cannot be owner-confirmed', async () => {
    assigned('completed'); getTable('Gig')[0].payment_id = null;
    expect((await post('gig/confirm-completion')).status).toBe(409); expect(getTable('Gig')[0].owner_confirmed_at).toBeNull();
  });
  test('wrong payment terms cannot be captured at confirmation', async () => {
    assigned('completed'); getTable('Payment')[0].amount_total = 2000;
    expect((await post('gig/confirm-completion')).status).toBe(409); expect(mockCapture).not.toHaveBeenCalled();
  });
  test('lost durable capture receipt cannot confirm the gig', async () => {
    assigned('completed');
    setRpcMock(async (name) => name === 'prepare_paid_gig_capture'
      ? { data: { payment: { ...getTable('Payment')[0], payment_status: 'capture_pending' } } }
      : { error: { code: '08006' } });
    mockCapture.mockResolvedValue({ ...pi, status: 'succeeded', amount_received: 1250 });
    expect((await post('gig/confirm-completion')).status).toBe(503);
    expect(getTable('Gig')[0].owner_confirmed_at).toBeNull();
  });
  test('existing owner receipt returns success without recapture', async () => {
    assigned('completed'); getTable('Gig')[0].owner_confirmed_at = '2026-09-10T00:00:00Z';
    const capture = jest.spyOn(service, 'capturePayment');
    expect((await post('gig/confirm-completion')).status).toBe(200); expect(capture).not.toHaveBeenCalled();
  });
});


describe('stale bid mutations cannot overtake checkout reservation', () => {
  test.each([
    ['patch', 'gig/my-bid', 'worker', { bid_amount: 99 }, 'pending'],
    ['delete', 'gig/bids/bid', 'worker', {}, 'pending'],
    ['post', 'gig/bids/bid/counter', 'payer', { amount: 99 }, 'pending'],
    ['post', 'gig/bids/bid/counter/accept', 'worker', {}, 'countered'],
    ['post', 'gig/bids/bid/counter/decline', 'worker', {}, 'countered'],
    ['post', 'gig/bids/bid/counter/withdraw', 'payer', {}, 'countered'],
    ['post', 'gig/bids/bid/reject', 'payer', {}, 'pending'],
  ])('%s %s preserves frozen terms after a concurrent reservation', async (method, path, user, body, status) => {
    Object.assign(getTable('GigBid')[0], { status, counter_status: 'pending', counter_amount: 99 });
    if (path.endsWith('/counter')) getTable('GigBid')[0].counter_status = null;
    const from = db.from.bind(db);
    jest.spyOn(db, 'from').mockImplementation((table) => {
      const query = from(table);
      if (table === 'GigBid') {
        const update = query.update.bind(query);
        query.update = (patch) => {
          getTable('GigBid')[0].status = 'pending_payment';
          return update(patch);
        };
      }
      return query;
    });
    const result = await request(app)[method](`/api/gigs/${path}`).set('x-test-user-id', user).send(body);
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(getTable('GigBid')[0].status).toBe('pending_payment');
    expect(getTable('GigBid')[0].bid_amount).toBe(12.5);
  });
});


describe('workflow writes bind the payment snapshot checked before provider awaits', () => {
  test.each([
    ['payment_id', 'replacement'], ['price', 99], ['user_id', 'foreign'], ['accepted_by', 'replacement-worker'],
  ])('worker start refuses changed %s', async (field, value) => {
    assigned();
    jest.spyOn(service, 'verifyGigAuthorization').mockImplementation(async () => {
      getTable('Gig')[0] = { ...getTable('Gig')[0], [field]: value };
      return { payment_status: 'authorized' };
    });
    expect((await post('gig/start', 'worker')).status).toBeGreaterThanOrEqual(400);
    expect(getTable('Gig')[0].status).toBe('assigned');
  });
  test.each([
    ['payment_id', 'replacement'], ['price', 99], ['user_id', 'foreign'], ['accepted_by', 'replacement-worker'],
  ])('owner confirmation refuses changed %s after capture', async (field, value) => {
    assigned('completed');
    jest.spyOn(service, 'capturePayment').mockImplementation(async () => {
      getTable('Gig')[0] = { ...getTable('Gig')[0], [field]: value };
      return { success: true };
    });
    expect((await post('gig/confirm-completion')).status).toBe(409);
    expect(getTable('Gig')[0].owner_confirmed_at).toBeNull();
  });
});
