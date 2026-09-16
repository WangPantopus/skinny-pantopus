const db = require('../__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable, setRpcMock } = db;
const mockCharge = jest.fn();
const mockS3Head = jest.fn();
jest.mock('../../config/aws', () => ({ s3Client: { send: mockS3Head }, S3_BUCKET: 'pantopus-uploads', S3_REGION: 'us-west-2', CLOUDFRONT_URL: '' }));
const mockRetrieve = jest.fn(), mockCapture = jest.fn(), mockCreate = jest.fn(), mockCancel = jest.fn();
jest.mock('stripe', () => ({ charges: { retrieve: mockCharge }, paymentIntents: { retrieve: mockRetrieve, capture: mockCapture, create: mockCreate, cancel: mockCancel } }));
jest.mock('../__mocks__/verifyToken', () => {
  const verify = (req, res, next) => { req.user = { id: req.headers['x-test-user-id'] }; req.session = { id: 'test-session' }; next(); };
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
const review = () => require('../../services/gigPaymentAcceptance').completionReview(getTable('Gig')[0]);
const post = (path, user = 'payer') => request(app).post(`/api/gigs/${path}`).set('x-test-user-id', user)
  .send(/\/(confirm-completion|complete)$/.test(path) ? { expectedReview: review() } : {});
beforeEach(() => {
  jest.restoreAllMocks(); jest.clearAllMocks(); resetTables();
  mockS3Head.mockResolvedValue({ ContentLength: 32, ContentType: 'image/jpeg' });
  seedTable('User', [{ id: 'payer', account_type: 'personal' }, { id: 'worker', account_type: 'personal' }]);
  seedTable('Gig', [{ id: 'gig', user_id: 'payer', title: 'Synthetic gig', price: 20, status: 'open',
    accepted_by: null, payment_id: null, owner_confirmed_at: null }]);
  seedTable('GigBid', [{ id: 'bid', gig_id: 'gig', user_id: 'worker', bid_amount: 12.5, status: 'pending_payment', pending_payment_intent_id: 'pay' }]);
  seedTable('Payment', [{ ...p }]); mockRetrieve.mockResolvedValue({ ...pi });
  mockCharge.mockResolvedValue({ id: 'ch_one', payment_intent: 'pi_one', customer: 'cus_payer', amount: 1250,
    currency: 'usd', paid: true, captured: false, refunded: false, amount_refunded: 0,
    payment_method_details: { type: 'card', card: { capture_before: Math.floor(Date.now()/1000)+3600 } } });
});
function assigned(status = 'assigned') {
  Object.assign(getTable('Gig')[0], { status, accepted_by: 'worker', payment_id: 'pay', price: 12.5, accepted_at: null, started_at: null,
    worker_completed_at: status === 'completed' ? '2026-09-10T00:00:00Z' : null });
  getTable('Payment')[0].payment_status = 'authorized';
}

// Model only the RPC boundary for route tests. Transaction/rollback/recipient
// behavior is verified against PostgreSQL in paid-gig-acceptance.sql.
beforeEach(() => setRpcMock(async (name, args) => {
  if (name === 'prepare_gig_completion_original') return { data: { payment: { ...getTable('Payment')[0] } } };
  if (name !== 'mark_gig_completed') return { data: null };
  const expected = args.p_expected;
  const bind = query => {
    for (const [field, value] of Object.entries(expected)) query = value == null ? query.is(field, null) : query.eq(field, value);
    return query;
  };
  const result = await bind(db.from('Gig').update({ ...args.p_proof, status: 'completed',
    worker_completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', args.p_gig_id).eq('status', 'in_progress').is('worker_completed_at', null).is('owner_confirmed_at', null))
    .select('*').maybeSingle();
  if (result.data) return { data: { gig: result.data, notifications: [], reused: false } };
  const current = await bind(db.from('Gig').select('*').eq('id', args.p_gig_id).eq('status', 'completed')).maybeSingle();
  if (current.data && Object.entries(args.p_proof).every(([field, value]) => require('node:util').isDeepStrictEqual(current.data[field], value))) {
    return { data: { gig: current.data, notifications: [], reused: true } };
  }
  return { data: { error: 'COMPLETION_CHANGED' } };
}));

describe('actual paid-gig owner routes', () => {
  test('known authorized checkout returns exact frozen amount without another sheet setup', async () => {
    const rpc = jest.fn(async (name) => ({ data: name === 'verify_paid_gig_actor' ? { allowed: true } : { attempt: {
      id: 'attempt', payment_id: 'pay', payee_id: 'worker', amount: 1250,
    } } }));
    setRpcMock(rpc);
    const customer = jest.spyOn(service, 'getOrCreateCustomer');
    // A stale pre-reservation bid amount must never become checkout display terms.
    getTable('GigBid')[0].bid_amount = 15;
    const result = await post('gig/bids/bid/accept');
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ authorizationReady: true, requiresPaymentSetup: false,
      amountCents: 1250, currency: 'usd', clientSecret: null, bid: { bid_amount: 12.5 } });
    expect(customer).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('begin_paid_gig_acceptance_as_actor', expect.objectContaining({ p_actor_id: 'payer' }));
  });
  test('legacy authorization retry cannot replace an operation-backed payment intent', async () => {
    assigned(); getTable('Gig')[0].payment_status = 'authorization_failed';
    setRpcMock(async () => ({ data: { error: 'BID_RECOVERY' } }));
    const result = await request(app).post('/api/gigs/gig/retry-authorization').set('x-test-user-id', 'payer')
      .send({ expectedActorId: 'payer', expectedSessionScope: require('../../utils/requestSessionScope').getRequestSessionScope({ user: { id: 'payer' }, session: { id: 'test-session' } }).session_scope, expectedPaymentId: 'aafd0000-0000-4000-8000-000000000001', expectedPayerId: 'aafd0000-0000-4000-8000-000000000003', expectedAmountCents: 1250,
        expectedPayeeId: 'aafd0000-0000-4000-8000-000000000002', currency: 'usd' });
    expect(result.status).toBe(409); expect(result.body.code).toBe('use_bid_payment_recovery');
    expect(mockCreate).not.toHaveBeenCalled();
    expect(getTable('Payment')[0].stripe_payment_intent_id).toBe('pi_one');
  });
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
      if (name === 'finalize_paid_gig_acceptance_as_actor') {
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
    setRpcMock(async () => ({ data: { gig: getTable('Gig')[0], bid: getTable('GigBid')[0], reused: true, room_id: 'durable-chat' } }));
    const result = await post('gig/bids/bid/finalize-accept');
    expect(result.status).toBe(200); expect(result.body.reused).toBe(true); expect(mockRetrieve).not.toHaveBeenCalled();
    expect(result.body.roomId).toBe('durable-chat');
    expect(getTable('ChatMessage')).toEqual([]); expect(getTable('Notification')).toEqual([]);
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
    setRpcMock(async (name) => ['prepare_gig_completion_original', 'prepare_paid_gig_capture'].includes(name)
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

describe('worker start recovers the saved transition', () => {
  const notifications = require('../__mocks__/notificationService');
  const start = (actor = 'worker') => post('gig/start', actor);

  test('a lost success reply recovers the saved start without another authorization or notice', async () => {
    assigned();
    expect((await start()).status).toBe(200);
    const saved = structuredClone(getTable('Gig')[0]);
    const verify = jest.spyOn(service, 'verifyGigAuthorization');
    notifications.createBulkNotifications.mockClear();
    const retry = await start();
    expect(retry.status).toBe(200); expect(retry.body.reused).toBe(true);
    expect(retry.body.gig).toEqual(saved); expect(getTable('Gig')[0]).toEqual(saved);
    expect(verify).not.toHaveBeenCalled();
    expect(notifications.createBulkNotifications).not.toHaveBeenCalled();
  });

  test('a concurrent identical start returns the committed row without a second notice', async () => {
    assigned();
    const from = db.from.bind(db); let saved;
    jest.spyOn(db, 'from').mockImplementation(table => {
      const query = from(table);
      if (table === 'Gig') {
        const update = query.update.bind(query);
        query.update = patch => {
          saved = { ...getTable('Gig')[0], ...patch, started_at: '2026-09-14T12:01:00Z' };
          getTable('Gig')[0] = saved;
          return update(patch);
        };
      }
      return query;
    });
    notifications.createBulkNotifications.mockClear();
    const retry = await start();
    expect(retry.status).toBe(200); expect(retry.body.reused).toBe(true);
    expect(retry.body.gig).toEqual(saved); expect(getTable('Gig')[0]).toEqual(saved);
    expect(notifications.createBulkNotifications).not.toHaveBeenCalled();
  });

  test('the recovered start keeps its original time rather than restamping it', async () => {
    assigned();
    expect((await start()).status).toBe(200);
    const originalStart = getTable('Gig')[0].started_at;
    expect(typeof originalStart).toBe('string');
    const retry = await start();
    expect(retry.status).toBe(200); expect(retry.body.gig.started_at).toBe(originalStart);
  });

  test.each(['foreign', 'payer'])('another actor cannot recover a worker start: %s', async actor => {
    assigned(); expect((await start()).status).toBe(200);
    const saved = structuredClone(getTable('Gig')[0]);
    expect((await start(actor)).status).toBe(403); expect(getTable('Gig')[0]).toEqual(saved);
  });

  test('a former worker cannot recover a start after replacement', async () => {
    assigned(); expect((await start()).status).toBe(200);
    getTable('Gig')[0].accepted_by = 'replacement';
    expect((await start()).status).toBe(403);
  });

  test.each([null, 'invalid'])('a missing start receipt is not reported as success: %s', async timestamp => {
    assigned(); expect((await start()).status).toBe(200);
    getTable('Gig')[0].started_at = timestamp;
    const retry = await start();
    expect(retry.status).toBeGreaterThanOrEqual(400);
    expect(retry.body.reused).toBeUndefined();
  });

  test.each(['user_id', 'payment_id', 'price', 'accepted_at'])('a concurrent result under another %s cannot be reused', async field => {
    assigned();
    const from = db.from.bind(db);
    jest.spyOn(db, 'from').mockImplementation(table => {
      const query = from(table);
      if (table === 'Gig') {
        const update = query.update.bind(query);
        query.update = patch => {
          getTable('Gig')[0] = { ...getTable('Gig')[0], ...patch,
            [field]: field === 'price' ? 99 : field === 'accepted_at' ? '2026-09-15T13:00:00Z' : 'replacement' };
          return update(patch);
        };
      }
      return query;
    });
    const retry = await start();
    expect(retry.status).toBeGreaterThanOrEqual(400);
    expect(retry.body.reused).toBeUndefined();
  });

  test('a settled later price change still recovers the saved start', async () => {
    assigned(); expect((await start()).status).toBe(200);
    const originalStart = getTable('Gig')[0].started_at;
    // An approved change order moves the price while work is in progress. The
    // saved transition stays truthful and the reply carries the current row.
    getTable('Gig')[0].price = 99;
    const retry = await start();
    expect(retry.status).toBe(200); expect(retry.body.reused).toBe(true);
    expect(retry.body.gig.started_at).toBe(originalStart); expect(retry.body.gig.price).toBe(99);
  });

  test.each(['user_id', 'payment_id', 'price', 'accepted_by', 'accepted_at'])('a start that loses to a changed %s reports a conflict, not a server fault', async field => {
    assigned();
    const from = db.from.bind(db);
    jest.spyOn(db, 'from').mockImplementation(table => {
      const query = from(table);
      if (table === 'Gig') {
        const update = query.update.bind(query);
        query.update = patch => {
          getTable('Gig')[0] = { ...getTable('Gig')[0],
            [field]: field === 'price' ? 99 : field === 'accepted_at' ? '2026-09-15T13:00:00Z' : 'replacement' };
          return update(patch);
        };
      }
      return query;
    });
    const result = await start();
    expect(result.status).toBe(409);
    expect(getTable('Gig')[0].status).toBe('assigned');
  });

  test('an unavailable write stays retryable rather than reporting a server fault', async () => {
    assigned();
    const from = db.from.bind(db);
    jest.spyOn(db, 'from').mockImplementation(table => {
      const query = from(table);
      if (table === 'Gig') {
        const update = query.update.bind(query);
        query.update = patch => {
          const built = update(patch);
          built.single = async () => ({ data: null, error: { code: '08006', message: 'connection failure' } });
          return built;
        };
      }
      return query;
    });
    const result = await start();
    expect(result.status).toBe(503);
    expect(getTable('Gig')[0].status).toBe('assigned');
  });

  test('an unavailable read is not reported as a missing gig', async () => {
    assigned();
    const from = db.from.bind(db);
    jest.spyOn(db, 'from').mockImplementation(table => {
      const query = from(table);
      if (table === 'Gig') {
        query.single = async () => ({ data: null, error: { code: '08006', message: 'connection failure' } });
        query.maybeSingle = async () => ({ data: null, error: { code: '08006', message: 'connection failure' } });
      }
      return query;
    });
    const result = await start();
    expect(result.status).toBe(503);
    expect(result.body.error).not.toMatch(/not found/i);
  });

  test.each(['saved', 'concurrent'])('an unavailable %s recovery read stays retryable', async state => {
    assigned();
    if (state === 'saved') expect((await start()).status).toBe(200);
    const from = db.from.bind(db); let gigReads = 0;
    jest.spyOn(db, 'from').mockImplementation(table => {
      const query = from(table);
      if (table === 'Gig') {
        const maybeSingle = query.maybeSingle.bind(query);
        query.maybeSingle = async () => ++gigReads > 1
          ? { data: null, error: { code: '08006', message: 'connection failure' } }
          : maybeSingle();
        if (state === 'concurrent') {
          const update = query.update.bind(query);
          query.update = patch => {
            getTable('Gig')[0] = { ...getTable('Gig')[0], ...patch };
            return update(patch);
          };
        }
      }
      return query;
    });
    notifications.createBulkNotifications.mockClear();
    const result = await start();
    expect(result.status).toBe(503);
    expect(result.body.reused).toBeUndefined();
    expect(getTable('Gig')[0].status).toBe('in_progress');
    expect(notifications.createBulkNotifications).not.toHaveBeenCalled();
    jest.restoreAllMocks();
    const retry = await start();
    expect(retry.status).toBe(200); expect(retry.body.reused).toBe(true);
  });

  test('work already moved past start is not reported as a fresh start', async () => {
    assigned('completed');
    const retry = await start();
    expect(retry.status).toBeGreaterThanOrEqual(400);
    expect(getTable('Gig')[0].status).toBe('completed');
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
    ['worker_completed_at', '2026-09-14T14:00:00Z'], ['accepted_at', '2026-09-14T12:00:00Z'], ['started_at', '2026-09-14T12:01:00Z'],
  ])('owner confirmation binds its original %s before any capture', async (field, value) => {
    assigned('completed');
    const original = getTable('Gig')[0][field] ?? null;
    const rpc = jest.fn(async (name, args) => {
      expect(name).toBe('prepare_gig_completion_original');
      expect(args.p_expected[field]).toEqual(original);
      expect(args.p_actor_id).toBe('payer');
      getTable('Gig')[0] = { ...getTable('Gig')[0], [field]: value };
      return { data: { error: 'COMPLETION_CHANGED' } };
    });
    setRpcMock(rpc);
    const capture = jest.spyOn(service, 'capturePayment');
    expect((await post('gig/confirm-completion')).status).toBe(409);
    expect(capture).not.toHaveBeenCalled();
    expect(getTable('Gig')[0].owner_confirmed_at).toBeNull();
  });
});


describe('worker completion preserves the assignment it observed', () => {
  test.each([
    ['accepted_by', 'replacement-worker'], ['user_id', 'foreign'], ['status', 'cancelled'],
    ['status', 'assigned'], ['payment_id', 'replacement'], ['price', 99],
    ['accepted_at', '2026-09-14T12:00:00Z'], ['started_at', '2026-09-14T12:01:00Z'],
    ['owner_confirmed_at', '2026-09-14T12:02:00Z'],
  ])('a late worker completion cannot overwrite changed %s', async (field, value) => {
    assigned('in_progress');
    const from = db.from.bind(db);
    jest.spyOn(db, 'from').mockImplementation(table => {
      const query = from(table);
      if (table === 'Gig') {
        const update = query.update.bind(query);
        query.update = patch => {
          getTable('Gig')[0] = { ...getTable('Gig')[0], [field]: value };
          return update(patch);
        };
      }
      return query;
    });
    const result = await post('gig/mark-completed', 'worker');
    expect(result.status).toBe(409);
    expect(getTable('Gig')[0][field]).toBe(value);
    expect(getTable('Gig')[0].worker_completed_at).toBeNull();
    expect(getTable('Notification')).toHaveLength(0);
  });

  test('an unchanged assignment saves the existing completion proof', async () => {
    assigned('in_progress');
    Object.assign(getTable('Gig')[0], { accepted_at: '2026-09-14T12:00:00Z', started_at: '2026-09-14T12:01:00Z' });
    const result = await request(app).post('/api/gigs/gig/mark-completed').set('x-test-user-id', 'worker')
      .send({ note: 'Work completed', photos: ['https://pantopus-uploads.s3.us-west-2.amazonaws.com/gigs/gig/worker/1700000000000_0123456789abcdef.jpg'], checklist: [{ item: 'Finished', done: true }] });
    expect(result.status).toBe(200);
    expect(result.body.gig).toMatchObject({ status: 'completed', accepted_by: 'worker', price: 12.5,
      completion_note: 'Work completed', completion_photos: ['https://pantopus-uploads.s3.us-west-2.amazonaws.com/gigs/gig/worker/1700000000000_0123456789abcdef.jpg'],
      completion_checklist: [{ item: 'Finished', done: true }] });
    expect(result.body.gig.worker_completed_at).toBeTruthy();
    expect(mockCapture).not.toHaveBeenCalled();
  });
});


describe('a concurrent owner receipt must still describe the reviewed completion', () => {
  test.each([
    ['status', 'cancelled', 409],
    ['worker_completed_at', '2026-09-14T14:00:00Z', 409],
    ['accepted_at', '2026-09-14T12:00:00Z', 409],
    ['started_at', '2026-09-14T12:01:00Z', 409],
    ['unchanged', null, 200],
  ])('receipt with %s returns only its matching result', async (field, value, expectedStatus) => {
    assigned('completed');
    jest.spyOn(service, 'capturePayment').mockImplementation(async () => {
      const next = { ...getTable('Gig')[0], owner_confirmed_at: '2026-09-14T15:00:00Z' };
      if (field !== 'unchanged') next[field] = value;
      getTable('Gig')[0] = next;
      return { success: true, confirmation: { gig: next, reused: true, notifications: [] } };
    });
    expect((await post('gig/complete')).status).toBe(expectedStatus);
    expect(getTable('Gig')[0].owner_confirmed_at).toBe('2026-09-14T15:00:00Z');
  });
});


describe('owner confirmation commits existing effects through one database decision', () => {
  const notifications = require('../__mocks__/notificationService');
  test('free completion uses stored notices without a second counter or bid write', async () => {
    assigned('completed'); Object.assign(getTable('Gig')[0], { price: 0, payment_id: null });
    const notice = { id: 'stored-notice', user_id: 'worker', type: 'gig_confirmed' };
    const rpc = jest.fn(async () => ({ data: { gig: { ...getTable('Gig')[0], owner_confirmed_at: '2026-09-14T15:00:00Z' },
      notifications: [notice], reused: false } })); setRpcMock(rpc);
    expect((await post('gig/confirm-completion')).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('confirm_gig_completion', expect.objectContaining({ p_actor_id: 'payer' }));
    expect(notifications.deliverStoredGigNotification).not.toHaveBeenCalled();
    expect(notifications.createNotification).not.toHaveBeenCalled();
    expect(notifications.createBulkNotifications).not.toHaveBeenCalled();
    expect(getTable('User')[1].gigs_completed).toBeUndefined();
    expect(getTable('GigBid')[0].status).toBe('pending_payment');
    expect(mockCapture).not.toHaveBeenCalled();
  });
  test('a lost committed reply retries the saved confirmation without recapture or another notice', async () => {
    assigned('completed');
    const capture = jest.spyOn(service, 'capturePayment').mockImplementation(async () => {
      getTable('Gig')[0] = { ...getTable('Gig')[0], owner_confirmed_at: '2026-09-14T15:00:00Z' };
      throw Object.assign(new Error('Lost committed response'), { statusCode: 503 });
    });
    const rpc = jest.fn(async () => ({ data: { payment: getTable('Payment')[0] } })); setRpcMock(rpc);
    expect((await post('gig/confirm-completion')).status).toBe(503);
    expect((await post('gig/complete')).status).toBe(200);
    expect(capture).toHaveBeenCalledTimes(1); expect(rpc).toHaveBeenCalledTimes(1);
    expect(notifications.deliverStoredGigNotification).not.toHaveBeenCalled();
  });
  test('the request leaves committed delivery to the existing worker without another notice', async () => {
    assigned('completed'); jest.spyOn(service, 'capturePayment').mockResolvedValue({ success: true,
      confirmation: { gig: { ...getTable('Gig')[0], owner_confirmed_at: '2026-09-14T15:00:00Z' },
        notifications: [{ id: 'stored-notice', user_id: 'worker', type: 'gig_confirmed' }], reused: false } });
    notifications.deliverStoredGigNotification.mockRejectedValueOnce(new Error('synthetic unavailable transport'));
    expect((await post('gig/complete')).status).toBe(200);
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });
  test('revoked business authority at the database decision cannot confirm work', async () => {
    assigned('completed'); jest.spyOn(service, 'capturePayment').mockResolvedValue({ success: true });
    setRpcMock(async () => ({ data: { error: 'FORBIDDEN' } }));
    expect((await post('gig/confirm-completion')).status).toBe(403);
    expect(getTable('Gig')[0].owner_confirmed_at).toBeNull();
    expect(notifications.deliverStoredGigNotification).not.toHaveBeenCalled();
  });
  test('a manager revoked after admitted capture does not receive the private receipt', async () => {
    assigned('completed'); getTable('User')[0].account_type = 'business';
    const permission = require('../../utils/businessPermissions').hasPermission;
    permission.mockResolvedValue(true);
    const capture = jest.spyOn(service, 'capturePayment').mockImplementation(async () => {
      permission.mockResolvedValue(false);
      return { success: true, confirmation: { gig: { ...getTable('Gig')[0], owner_confirmed_at: '2026-09-15T10:00:00Z' } } };
    });
    const response = await post('gig/confirm-completion', 'manager');
    expect(response.status).toBe(403); expect(response.body.gig).toBeUndefined();
    expect(capture).toHaveBeenCalledTimes(1);
  });
  test('unknown provider failure preserves retry without exposing its raw message', async () => {
    assigned('completed'); jest.spyOn(service, 'capturePayment').mockRejectedValue(new Error('Synthetic provider internals'));
    const response = await post('gig/confirm-completion');
    expect(response.status).toBe(503); expect(response.body.error).toBe('Completion payment could not be verified. Please retry.');
    expect(getTable('Gig')[0].owner_confirmed_at).toBeNull();
  });
});


describe('public gig detail keeps completion evidence within the current work relationship', () => {
  const proof = { completion_note: 'Private access instructions in proof',
    completion_photos: ['https://fixture.example.invalid/private-proof.jpg'],
    completion_checklist: [{ item: 'Private checklist', done: true }],
    owner_confirmation_note: 'Private owner review', owner_satisfaction: 4 };
  const read = actor => {
    if (actor) db.setAuthMocks({ getUser: async () => ({ data: { user: { id: actor } }, error: null }) });
    const req = request(app).get('/api/gigs/gig');
    return actor ? req.set('Authorization', 'Bearer synthetic-read') : req;
  };
  test.each([null, 'foreign', 'former-worker', 'bidder'])('%s cannot read private completion evidence on the public detail', async actor => {
    assigned('completed'); Object.assign(getTable('Gig')[0], proof);
    if (actor === 'bidder') getTable('GigBid').push({ id: 'other-bid', gig_id: 'gig', user_id: actor, status: 'pending' });
    const result = await read(actor);
    expect(result.status).toBe(200); expect(result.body.gig.title).toBe('Synthetic gig');
    for (const key of Object.keys(proof)) expect(result.body.gig).not.toHaveProperty(key);
    expect(getTable('Gig')[0]).toMatchObject(proof);
  });
  test.each(['payer', 'worker'])('%s retains existing completion content', async actor => {
    assigned('completed'); Object.assign(getTable('Gig')[0], proof);
    const result = await read(actor); expect(result.status).toBe(200); expect(result.body.gig).toMatchObject(proof);
  });
  test.each(['gigs.manage', 'gigs.post', 'revoked'])('business %s uses current existing permission checks', async permission => {
    assigned('completed'); Object.assign(getTable('Gig')[0], proof); getTable('User')[0].account_type = 'business';
    require('../../utils/businessPermissions').hasPermission.mockImplementation(async (owner, actor, key) =>
      owner === 'payer' && actor === 'delegate' && key === permission);
    const result = await read('delegate'); expect(result.status).toBe(200);
    if (permission === 'revoked') for (const key of Object.keys(proof)) expect(result.body.gig).not.toHaveProperty(key);
    else expect(result.body.gig).toMatchObject(proof);
  });
  test('failed optional authentication cannot expose proof', async () => {
    assigned('completed'); Object.assign(getTable('Gig')[0], proof);
    db.setAuthMocks({ getUser: async () => { throw new Error('Synthetic auth unavailable'); } });
    const result = await request(app).get('/api/gigs/gig').set('Authorization', 'Bearer unavailable');
    expect(result.status).toBe(200);
    for (const key of Object.keys(proof)) expect(result.body.gig).not.toHaveProperty(key);
  });
});


describe('worker completion proof belongs to its uploader', () => {
  test.each([
    'https://unrelated.example.invalid/tracker.jpg',
    'https://pantopus-uploads.s3.us-west-2.amazonaws.com/gigs/other/worker/proof.jpg',
    'https://pantopus-uploads.s3.us-west-2.amazonaws.com/gigs/gig/foreign/proof.jpg',
    'data:image/svg+xml,untrusted',
  ])('rejects an unowned proof reference before completing: %s', async photo => {
    assigned('in_progress');
    const result = await request(app).post('/api/gigs/gig/mark-completed').set('x-test-user-id', 'worker').send({ photos: [photo] });
    expect(result.status).toBe(400); expect(getTable('Gig')[0].status).toBe('in_progress');
    expect(mockS3Head).not.toHaveBeenCalled(); expect(mockCapture).not.toHaveBeenCalled();
  });
});


describe('existing uploaded proof is verified before the completion write', () => {
  const base = 'https://pantopus-uploads.s3.us-west-2.amazonaws.com/';
  const name = '1700000000000_0123456789abcdef.jpg';
  const uploadKey = 'uploads/worker/' + name;
  const submit = photo => request(app).post('/api/gigs/gig/mark-completed').set('x-test-user-id', 'worker').send({ photos: [photo] });
  function nativeFile(patch = {}) {
    seedTable('File', [{ id: 'proof-file', user_id: 'worker', file_path: uploadKey,
      file_type: 'gig_attachment', file_context: 'gig_completion', gig_id: null,
      processing_status: 'completed', is_deleted: false, file_size: 32, mime_type: 'image/jpeg', ...patch }]);
  }
  test('an older safe basename still verifies through its owned path', async () => {
    assigned('in_progress');
    expect((await submit(base + 'gigs/gig/worker/legacy-proof.jpg')).status).toBe(200);
    expect(mockS3Head.mock.calls[0][0].input.Key).toBe('gigs/gig/worker/legacy-proof.jpg');
  });
  test('native generic upload reuses its existing owned File row and exact S3 object', async () => {
    assigned('in_progress'); nativeFile();
    const result = await submit(base + uploadKey); expect(result.status).toBe(200);
    expect(result.body.gig.completion_photos).toEqual([base + uploadKey]);
    expect(mockS3Head.mock.calls[0][0].input).toEqual({ Bucket: 'pantopus-uploads', Key: uploadKey });
    expect(getTable('File')).toHaveLength(1);
  });
  test.each([
    { user_id: 'foreign' }, { file_context: 'gig_photo' }, { gig_id: 'other' },
    { processing_status: 'uploading' }, { is_deleted: true },
  ])('unavailable native upload metadata is rejected: %j', async patch => {
    assigned('in_progress'); nativeFile(patch);
    expect((await submit(base + uploadKey)).status).toBe(400);
    expect(getTable('Gig')[0].status).toBe('in_progress'); expect(mockS3Head).not.toHaveBeenCalled();
  });
  test.each([
    { ContentLength: 0, ContentType: 'image/jpeg' },
    { ContentLength: 32, ContentType: 'text/html' },
    { ContentLength: 11 * 1024 * 1024, ContentType: 'image/jpeg' },
  ])('unsupported object metadata never completes work: %j', async metadata => {
    assigned('in_progress'); mockS3Head.mockResolvedValue(metadata);
    expect((await submit(base + 'gigs/gig/worker/' + name)).status).toBe(400);
    expect(getTable('Gig')[0].status).toBe('in_progress');
  });
  test('a missing object and an unknown provider read preserve uncompleted work', async () => {
    assigned('in_progress'); mockS3Head.mockRejectedValueOnce({ name: 'NotFound' });
    expect((await submit(base + 'gigs/gig/worker/' + name)).status).toBe(400);
    mockS3Head.mockRejectedValueOnce(new Error('Synthetic timeout'));
    expect((await submit(base + 'gigs/gig/worker/' + name)).status).toBe(503);
    expect(getTable('Gig')[0].status).toBe('in_progress');
  });
  test('assignment changes during the object check still fail the existing conditional write', async () => {
    assigned('in_progress'); mockS3Head.mockImplementationOnce(async () => {
      getTable('Gig')[0] = { ...getTable('Gig')[0], accepted_by: 'replacement' };
      return { ContentLength: 32, ContentType: 'image/jpeg' };
    });
    expect((await submit(base + 'gigs/gig/worker/' + name)).status).toBe(409);
    expect(getTable('Gig')[0].status).toBe('in_progress'); expect(getTable('Gig')[0].accepted_by).toBe('replacement');
  });
  test.each(['video/mp4', 'application/pdf'])('existing supported %s proof remains admissible', async mimeType => {
    assigned('in_progress'); mockS3Head.mockResolvedValue({ ContentLength: 32, ContentType: mimeType });
    expect((await submit(base + 'gigs/gig/worker/' + name)).status).toBe(200);
  });
});

describe('worker completion recovers the saved result', () => {
  const photo = 'https://pantopus-uploads.s3.us-west-2.amazonaws.com/gigs/gig/worker/proof.jpg';
  const payload = { note: 'Finished the agreed work', photos: [photo], checklist: [{ item: 'Cleaned', done: true }] };
  const submit = (body = payload, actor = 'worker') => request(app).post('/api/gigs/gig/mark-completed')
    .set('x-test-user-id', actor).send(body);

  test('lost success reply recovers the same proof without storage or notification work', async () => {
    assigned('in_progress');
    expect((await submit()).status).toBe(200);
    const saved = structuredClone(getTable('Gig')[0]);
    const notices = structuredClone(getTable('Notification'));
    mockS3Head.mockClear().mockRejectedValue(new Error('Provider currently unavailable'));
    const retry = await submit();
    expect(retry.status).toBe(200); expect(retry.body.reused).toBe(true);
    expect(retry.body.gig).toEqual(saved); expect(getTable('Gig')[0]).toEqual(saved);
    expect(getTable('Notification')).toEqual(notices); expect(mockS3Head).not.toHaveBeenCalled();
  });

  test('a concurrent identical submission returns the committed row', async () => {
    assigned('in_progress');
    const from = db.from.bind(db); let saved;
    jest.spyOn(db, 'from').mockImplementation(table => {
      const query = from(table);
      if (table === 'Gig') {
        const update = query.update.bind(query);
        query.update = patch => {
          saved = { ...getTable('Gig')[0], ...patch, worker_completed_at: '2026-09-14T14:00:00Z' };
          getTable('Gig')[0] = saved;
          return update(patch);
        };
      }
      return query;
    });
    const retry = await submit();
    expect(retry.status).toBe(200); expect(retry.body.reused).toBe(true);
    expect(retry.body.gig).toEqual(saved); expect(getTable('Gig')[0]).toEqual(saved);
    expect(getTable('Notification')).toHaveLength(0);
  });

  test.each([
    { ...payload, note: 'Different work' },
    { ...payload, photos: [photo.replace('proof.jpg', 'different.jpg')] },
    { ...payload, checklist: [{ item: 'Cleaned', done: false }] },
  ])('a retry cannot replace the saved proof: %j', async body => {
    assigned('in_progress'); expect((await submit()).status).toBe(200);
    const saved = structuredClone(getTable('Gig')[0]); mockS3Head.mockClear();
    expect((await submit(body)).status).toBe(409);
    expect(getTable('Gig')[0]).toEqual(saved); expect(mockS3Head).not.toHaveBeenCalled();
  });

  test('the existing normalized reference survives expired query text and later owner confirmation', async () => {
    assigned('in_progress');
    expect((await submit({ ...payload, photos: [photo + '?original=one#preview'] })).status).toBe(200);
    getTable('Gig')[0].owner_confirmed_at = '2026-09-14T16:00:00Z';
    const saved = structuredClone(getTable('Gig')[0]); mockS3Head.mockClear();
    const retry = await submit({ ...payload, photos: [photo + '?original=two'] });
    expect(retry.status).toBe(200); expect(retry.body.gig).toEqual(saved);
    expect(mockS3Head).not.toHaveBeenCalled(); expect(mockCapture).not.toHaveBeenCalled();
  });

  test.each(['foreign', 'payer'])('another actor cannot recover a worker result: %s', async actor => {
    assigned('in_progress'); expect((await submit()).status).toBe(200);
    const saved = structuredClone(getTable('Gig')[0]);
    expect((await submit(payload, actor)).status).toBe(403); expect(getTable('Gig')[0]).toEqual(saved);
  });

  test('a former worker cannot recover proof after replacement', async () => {
    assigned('in_progress'); expect((await submit()).status).toBe(200);
    getTable('Gig')[0].accepted_by = 'replacement';
    expect((await submit()).status).toBe(403);
  });

  test.each([null, 'invalid'])('a missing completion receipt is not success: %s', async timestamp => {
    assigned('in_progress'); expect((await submit()).status).toBe(200);
    getTable('Gig')[0].worker_completed_at = timestamp;
    expect((await submit()).status).toBe(409);
  });

  test('completion without optional proof also recovers its original time', async () => {
    assigned('in_progress'); expect((await submit({})).status).toBe(200);
    const saved = structuredClone(getTable('Gig')[0]);
    const retry = await submit({}); expect(retry.status).toBe(200); expect(retry.body.gig).toEqual(saved);
  });

  test.each(['user_id', 'accepted_by', 'payment_id', 'price', 'accepted_at', 'started_at'])('a concurrent result from another %s cannot be reused', async field => {
    assigned('in_progress'); const from = db.from.bind(db);
    jest.spyOn(db, 'from').mockImplementation(table => {
      const query = from(table);
      if (table === 'Gig') {
        const update = query.update.bind(query);
        query.update = patch => {
          getTable('Gig')[0] = { ...getTable('Gig')[0], ...patch,
            [field]: field === 'price' ? 99 : field.endsWith('_at') ? '2026-09-14T14:00:00Z' : 'replacement' };
          return update(patch);
        };
      }
      return query;
    });
    expect((await submit()).status).toBe(409); expect(getTable('Notification')).toHaveLength(0);
  });

  test('the completion transaction queues its stored notice without request-time delivery', async () => {
    assigned('in_progress');
    const notifications = require('../__mocks__/notificationService');
    const notice = { id: 'stored-completion', user_id: 'payer', type: 'gig_completed' };
    const rpc = jest.fn(async (_name, args) => ({ data: { gig: { ...getTable('Gig')[0], ...args.p_proof,
      status: 'completed', worker_completed_at: '2026-09-14T16:00:00Z' }, notifications: [notice], reused: false } }));
    setRpcMock(rpc); notifications.deliverStoredGigNotification.mockRejectedValueOnce(new Error('Transport unavailable'));
    expect((await submit()).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('mark_gig_completed', expect.objectContaining({ p_gig_id: 'gig', p_actor_id: 'worker',
      p_expected: { user_id: 'payer', accepted_by: 'worker', price: 12.5, payment_id: 'pay', accepted_at: null, started_at: null } }));
    expect(notifications.deliverStoredGigNotification).not.toHaveBeenCalled();
    expect(notifications.createBulkNotifications).not.toHaveBeenCalled();
  });

  test('an unconfirmed transaction reply remains retryable and sends no competing notice', async () => {
    assigned('in_progress'); setRpcMock(async () => ({ error: { code: '08006' } }));
    expect((await submit()).status).toBe(503);
    const notifications = require('../__mocks__/notificationService');
    expect(notifications.deliverStoredGigNotification).not.toHaveBeenCalled();
    expect(notifications.createBulkNotifications).not.toHaveBeenCalled();
  });
});


describe('completion private byte storage reuses the existing provider client', () => {
  const storage = require('../../services/s3Service');
  const crypto = require('crypto');
  const bytes = Buffer.from('synthetic private completion proof');
  const gigId = 'aaef0000-0000-4000-8000-000000000001';
  const actorId = 'aaef0000-0000-4000-8000-000000000002';
  const id = 'aaef0000-0000-4000-8000-000000000003';
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  let bucket, previousBucket, file;
  beforeEach(() => {
    previousBucket = process.env.GIG_COMPLETION_BUCKET;
    process.env.GIG_COMPLETION_BUCKET = 'test-private-completion';
    bucket = { upload: jest.fn().mockResolvedValue({ data: {} }),
      download: jest.fn().mockResolvedValue({ data: new Blob([bytes]) }), remove: jest.fn().mockResolvedValue({ data: [] }) };
    db.storage = { getBucket: jest.fn().mockResolvedValue({ data: { public: false } }), from: jest.fn().mockReturnValue(bucket) };
    file = { id, user_id: actorId, gig_id: gigId, file_path: `gig-completion/${gigId}/${actorId}/${id}/${digest}`,
      file_url: `/api/gigs/${gigId}/completion-files/${id}`, file_type: 'gig_attachment', file_context: 'gig_completion',
      visibility: 'private', is_deleted: false, processing_status: 'uploading', mime_type: 'text/plain', file_size: bytes.length,
      metadata: { storage_contract: 'gig_completion_v1', storage_bucket: 'test-private-completion',
        original_gig_id: gigId, original_user_id: actorId, upload_sha256: digest } };
  });
  afterEach(() => {
    if (previousBucket === undefined) delete process.env.GIG_COMPLETION_BUCKET;
    else process.env.GIG_COMPLETION_BUCKET = previousBucket;
    delete db.storage;
  });
  test('resolves an explicitly private bucket and stores exact bytes without an S3 or public URL call', async () => {
    expect(await storage.preparePrivateGigCompletionFile()).toBe('test-private-completion');
    await storage.uploadPrivateGigCompletionFile(file, bytes);
    expect(bucket.upload).toHaveBeenCalledWith(file.file_path, bytes, { contentType: 'text/plain', cacheControl: '0', upsert: false });
    expect(mockS3Head).not.toHaveBeenCalled(); expect(bucket.download).not.toHaveBeenCalled();
    file.processing_status = 'completed';
    expect(await storage.downloadPrivateGigCompletionFile(file)).toEqual(bytes);
  });
  test.each([true, null, undefined])('a bucket without private metadata (%s) cannot upload or download', async publicFlag => {
    db.storage.getBucket.mockResolvedValue({ data: { public: publicFlag } });
    await expect(storage.uploadPrivateGigCompletionFile(file, bytes)).rejects.toMatchObject({ statusCode: 503 });
    file.processing_status = 'completed';
    await expect(storage.downloadPrivateGigCompletionFile(file)).rejects.toMatchObject({ statusCode: 503 });
    expect(bucket.upload).not.toHaveBeenCalled(); expect(bucket.download).not.toHaveBeenCalled();
  });
  test('missing configuration and thrown bucket reads fail closed', async () => {
    delete process.env.GIG_COMPLETION_BUCKET;
    await expect(storage.preparePrivateGigCompletionFile()).rejects.toMatchObject({ statusCode: 503 });
    expect(db.storage.getBucket).not.toHaveBeenCalled();
    process.env.GIG_COMPLETION_BUCKET = 'test-private-completion';
    db.storage.getBucket.mockRejectedValue(new Error('synthetic outage'));
    await expect(storage.preparePrivateGigCompletionFile()).rejects.toMatchObject({ statusCode: 503 });
  });
  test.each(['error', 'throw'])('lost upload response (%s) recovers only matching existing bytes', async outcome => {
    if (outcome === 'throw') bucket.upload.mockRejectedValue(new Error('reply lost'));
    else bucket.upload.mockResolvedValue({ error: { message: 'reply lost' } });
    await storage.uploadPrivateGigCompletionFile(file, bytes);
    expect(bucket.download).toHaveBeenCalledWith(file.file_path); expect(bucket.upload).toHaveBeenCalledTimes(1);
    bucket.download.mockResolvedValue({ data: new Blob([Buffer.alloc(bytes.length)]) });
    await expect(storage.uploadPrivateGigCompletionFile(file, bytes)).rejects.toMatchObject({ statusCode: 503 });
  });
  test.each([
    { file_path: '../foreign' }, { file_url: 'https://example.invalid/object' }, { user_id: gigId },
    { gig_id: actorId }, { visibility: 'public' }, { file_context: 'gig_photo' }, { file_size: 0 },
    { mime_type: 'text/html' }, { id: '../file' }, { is_deleted: true }, { processing_status: 'completed' },
  ])('unverified upload reference is denied before provider calls: %j', async patch => {
    Object.assign(file, patch);
    await expect(storage.uploadPrivateGigCompletionFile(file, bytes)).rejects.toMatchObject({ statusCode: 400 });
    expect(db.storage.getBucket).not.toHaveBeenCalled(); expect(mockS3Head).not.toHaveBeenCalled();
  });
  test('bucket mismatch, payload replacement and corrupt downloads never succeed', async () => {
    file.metadata.storage_bucket = 'foreign-bucket';
    await expect(storage.uploadPrivateGigCompletionFile(file, bytes)).rejects.toMatchObject({ statusCode: 503 });
    file.metadata.storage_bucket = 'test-private-completion';
    await expect(storage.uploadPrivateGigCompletionFile(file, Buffer.alloc(bytes.length))).rejects.toMatchObject({ statusCode: 400 });
    file.processing_status = 'completed'; bucket.download.mockResolvedValue({ data: new Blob(['truncated']) });
    await expect(storage.downloadPrivateGigCompletionFile(file)).rejects.toMatchObject({ statusCode: 503 });
  });
  test('only a retired exact object can be removed, including after parent detachment', async () => {
    await expect(storage.removePrivateGigCompletionFile(file)).rejects.toMatchObject({ statusCode: 400 });
    expect(bucket.remove).not.toHaveBeenCalled();
    file.is_deleted = true; file.gig_id = null; file.user_id = null;
    await storage.removePrivateGigCompletionFile(file);
    expect(bucket.remove).toHaveBeenCalledWith([file.file_path]);
    bucket.remove.mockResolvedValue({ error: { message: 'unknown result' } });
    await expect(storage.removePrivateGigCompletionFile(file)).rejects.toMatchObject({ statusCode: 503 });
  });
  const uploads = express(); uploads.use(express.json());
  uploads.use('/api/files', require('../../routes/files'));
  uploads.use('/api/upload', require('../../routes/upload'));
  function reserveProvider() {
    let stored;
    const rpc = jest.fn(async (name, args) => {
      if (name !== 'mutate_gig_completion_file') throw new Error('Unexpected command');
      if (args.p_action === 'reserve' && !stored) {
        stored = structuredClone(file); stored.id = args.p_file_id;
        stored.file_path = `gig-completion/${gigId}/${actorId}/${stored.id}/${digest}`;
        stored.file_url = `/api/gigs/${gigId}/completion-files/${stored.id}`;
      }
      if (args.p_action === 'finalize') stored.processing_status = 'completed';
      return { data: { file: structuredClone(stored) } };
    });
    setRpcMock(rpc); return rpc;
  }
  test('native endpoint stores privately and a lost HTTP receipt discovers the same ready File', async () => {
    const rpc = reserveProvider();
    const upload = () => request(uploads).post('/api/files/upload').set('x-test-user-id', actorId)
      .field('gig_id', gigId).field('file_type', 'gig_completion').field('visibility', 'private')
      .attach('file', bytes, { filename: 'proof.txt', contentType: 'text/plain' });
    const first = await upload(); expect(first.status).toBe(201);
    const next = await upload(); expect(next.status).toBe(201); expect(next.body.file).toEqual(first.body.file);
    expect(first.body.file.url).toMatch(/^\/api\/gigs\//);
    expect(bucket.upload).toHaveBeenCalledTimes(1); expect(mockS3Head).not.toHaveBeenCalled();
    expect(rpc.mock.calls.map(([, args]) => args.p_action)).toEqual(['reserve', 'finalize', 'reserve']);
  });
  test('web endpoint uses the same reservation without a public thumbnail', async () => {
    reserveProvider(); seedTable('Gig', [{ id: gigId, user_id: 'owner', accepted_by: actorId }]);
    const result = await request(uploads).post(`/api/upload/gig-completion-media/${gigId}`).set('x-test-user-id', actorId)
      .attach('files', bytes, { filename: 'proof.txt', contentType: 'text/plain' });
    expect(result.status).toBe(200); expect(result.body.media).toHaveLength(1);
    expect(result.body.media[0]).toMatchObject({ file_key: '', thumbnail_url: null, file_size: bytes.length });
    expect(result.body.media[0].file_url).toMatch(/^\/api\/gigs\//); expect(mockS3Head).not.toHaveBeenCalled();
  });
  test('old native request without a task fails before reservation or any provider write', async () => {
    const rpc = reserveProvider();
    const result = await request(uploads).post('/api/files/upload').set('x-test-user-id', actorId)
      .field('file_type', 'gig_completion').attach('file', bytes, { filename: 'proof.txt', contentType: 'text/plain' });
    expect(result.status).toBe(400); expect(rpc).not.toHaveBeenCalled(); expect(bucket.upload).not.toHaveBeenCalled(); expect(mockS3Head).not.toHaveBeenCalled();
  });
  test('unknown reservation cannot write bytes; unknown finalize is recoverable on retry', async () => {
    const args = { buffer: bytes, mimetype: 'text/plain', originalname: 'proof.txt' };
    setRpcMock(async () => ({ error: { message: 'lost reservation acknowledgement' } }));
    await expect(storage.createPrivateGigCompletionFile(gigId, actorId, args)).rejects.toMatchObject({ statusCode: 503 });
    expect(bucket.upload).not.toHaveBeenCalled();
    const rpc = reserveProvider(); const execute = rpc.getMockImplementation(); let lost = false;
    rpc.mockImplementation(async (name, payload) => {
      const result = await execute(name, payload);
      if (payload.p_action === 'finalize' && !lost) { lost = true; return { error: { message: 'lost final acknowledgement' } }; }
      return result;
    });
    await expect(storage.createPrivateGigCompletionFile(gigId, actorId, args)).rejects.toMatchObject({ statusCode: 503 });
    expect((await storage.createPrivateGigCompletionFile(gigId, actorId, args)).processing_status).toBe('completed');
    expect(bucket.upload).toHaveBeenCalledTimes(1);
  });
  test('download rechecks authority after the private provider read and emits no bytes after revocation', async () => {
    file.processing_status = 'completed'; let reads = 0;
    setRpcMock(async () => (++reads === 1 ? { data: { file } } : { data: { error: 'FORBIDDEN' } }));
    const denied = await request(app).get(file.file_url).set('x-test-user-id', actorId);
    expect(denied.status).toBe(403); expect(denied.text).not.toContain(bytes.toString()); expect(denied.headers['cache-control']).toBe('private, no-store');
    setRpcMock(async () => ({ data: { file } }));
    const allowed = await request(app).get(file.file_url).set('x-test-user-id', actorId);
    expect(allowed.status).toBe(200); expect(allowed.text).toBe(bytes.toString());
    expect(allowed.headers['x-content-type-options']).toBe('nosniff'); expect(allowed.headers['content-disposition']).toMatch(/^attachment;/);
  });
  test('existing recovery worker retains unknown cleanup outcomes and exact tombstones', async () => {
    file.is_deleted = true; file.metadata.storage_cleanup_claim = 'aaef0000-0000-4000-8000-000000000004';
    const rpc = jest.fn(async (name) => {
      if (name === 'gig_completion_file_cleanup_candidates') return { data: [id] };
      if (name === 'claim_gig_completion_file_cleanup') return { data: file };
      if (name === 'finish_gig_completion_file_cleanup') return { data: true };
      throw new Error('Unexpected cleanup');
    });
    setRpcMock(rpc); const job = require('../../jobs/homeDocumentRecovery').completionFiles;
    bucket.remove.mockRejectedValueOnce(new Error('unknown provider result'));
    expect(await job()).toMatchObject({ selected: 1, pending: 1, removed: 0 });
    expect(rpc).toHaveBeenLastCalledWith('finish_gig_completion_file_cleanup', expect.objectContaining({ p_succeeded: false }));
    expect(await job()).toMatchObject({ selected: 1, pending: 0, removed: 1 });
    expect(bucket.remove).toHaveBeenLastCalledWith([file.file_path]);
  });

});


describe('owner confirmation binds the loaded review before capture', () => {
  test.each([
    ['worker_completed_at', '2026-09-15T10:00:00Z'], ['worker_completed_at', '2026-09-10T00:00:00.000001Z'], ['accepted_at', '2026-09-15T08:00:00Z'],
    ['completion_note', 'Replacement proof'], ['completion_photos', ['different-private-reference']],
    ['completion_checklist', [{ item: 'Replacement step', done: true }]],
    ['price', 20], ['payment_id', 'replacement-payment'], ['accepted_by', 'replacement-worker'],
    ['origin_home_id', 'other-home'], ['title', 'Different job'],
  ])('changed %s is rejected before provider or confirmation writes', async (key, value) => {
    assigned('completed'); const expectedReview = review(); getTable('Gig')[0][key] = value;
    const capture = jest.spyOn(service, 'capturePayment');
    const result = await request(app).post('/api/gigs/gig/confirm-completion').set('x-test-user-id', 'payer').send({ expectedReview });
    expect(result.status).toBe(409); expect(capture).not.toHaveBeenCalled();
    expect(getTable('Gig')[0].owner_confirmed_at).toBeNull();
  });
  test.each([undefined, null, '', 'bad', '0'.repeat(64)])('missing or invalid loaded review %s rejects the alias before capture', async expectedReview => {
    assigned('completed'); const capture = jest.spyOn(service, 'capturePayment');
    const result = await request(app).post('/api/gigs/gig/complete').set('x-test-user-id', 'payer').send({ expectedReview });
    expect(result.status).toBe(409); expect(capture).not.toHaveBeenCalled();
  });
  test('an already-confirmed receipt must still match the loaded review', async () => {
    assigned('completed'); const expectedReview = review();
    Object.assign(getTable('Gig')[0], { owner_confirmed_at: '2026-09-15T10:00:00Z', completion_note: 'Changed after the original review' });
    const result = await request(app).post('/api/gigs/gig/complete').set('x-test-user-id', 'payer').send({ expectedReview });
    expect(result.status).toBe(409); expect(mockCapture).not.toHaveBeenCalled();
  });
});


describe('general gig responses do not disclose share credentials or helper coordinates', () => {
  const privateLocation = { latitude: 40.7128, longitude: -74.006, updated_at: '2026-09-15T12:00:00Z' };
  function withLocation(share = false) {
    assigned('in_progress');
    Object.assign(getTable('Gig')[0], { status_share_token: 'abcdef1234567890abcdef1234567890',
      status_share_expires_at: '2099-01-01T00:00:00Z', helper_last_location: 'SRID=4326;POINT(-74.006 40.7128)',
      helper_location_updated_at: privateLocation.updated_at, helper_eta_minutes: 12, is_urgent: true,
      urgent_details: { shareLocationDuringTask: share, helper_last_location: privateLocation, helper_eta_minutes: 9, current_fulfillment_status: 'on_the_way' } });
  }
  const read = actor => {
    if (actor) db.setAuthMocks({ getUser: async () => ({ data: { user: { id: actor } }, error: null }) });
    const req = request(app).get('/api/gigs/gig');
    return actor ? req.set('Authorization', 'Bearer synthetic-read') : req;
  };
  test.each([null, 'foreign', 'former-worker', 'bidder', 'payer', 'worker'])('%s cannot obtain raw share credentials from general detail', async actor => {
    withLocation(); const before = JSON.stringify(getTable('Gig')[0]); const result = await read(actor);
    expect(result.status).toBe(200); expect(result.body.gig).not.toHaveProperty('status_share_token');
    expect(result.body.gig).not.toHaveProperty('status_share_expires_at'); expect(getTable('Gig')[0]).toMatchObject(JSON.parse(before));
  });
  test.each([null, 'foreign', 'payer', 'worker'])('%s cannot bypass the dedicated location reader through general detail', async actor => {
    withLocation(); const before = JSON.stringify(getTable('Gig')[0]); const result = await read(actor);
    expect(result.status).toBe(200); expect(result.body.gig).not.toHaveProperty('helper_last_location');
    expect(result.body.gig.urgent_details).not.toHaveProperty('helper_last_location'); expect(getTable('Gig')[0]).toMatchObject(JSON.parse(before));
  });
  test.each([null, 'foreign', 'former-worker', 'bidder'])('%s cannot obtain private ETA without a shared link', async actor => {
    withLocation(); const result = await read(actor); expect(result.status).toBe(200);
    expect(result.body.gig).not.toHaveProperty('helper_eta_minutes'); expect(result.body.gig).not.toHaveProperty('helper_location_updated_at');
    expect(result.body.gig.urgent_details).not.toHaveProperty('helper_eta_minutes');
  });
  test.each([JSON.stringify({ helper_last_location: privateLocation, helper_eta_minutes: 9, shareLocationDuringTask: false }), 'malformed', null])('legacy urgent values cannot bypass location redaction: %p', async legacy => {
    withLocation(); getTable('Gig')[0].urgent_details = legacy;
    const result = await read('foreign'); expect(result.status).toBe(200);
    expect(JSON.stringify(result.body)).not.toContain('40.7128');
    if (result.body.gig.urgent_details) expect(result.body.gig.urgent_details).not.toHaveProperty('helper_eta_minutes');
    expect(getTable('Gig')[0].urgent_details).toBe(legacy);
  });
  test.each([['/?status=in_progress', null], ['/saved', 'foreign'], ['/user/me', 'payer'], ['/my-gigs', 'payer']])('task list %s does not bypass location consent', async (path, actor) => {
    withLocation(false); seedTable('GigSave', [{ id: 'saved-location', gig_id: 'gig', user_id: 'foreign' }]);
    const req = request(app).get('/api/gigs' + path); const result = await (actor ? req.set('x-test-user-id', actor) : req);
    expect(result.status).toBe(200); expect(result.headers['cache-control']).toContain('no-store'); expect(result.body.gigs).toHaveLength(1);
    expect(result.body.gigs[0].urgent_details).not.toHaveProperty('helper_last_location');
    if (actor !== 'payer') expect(result.body.gigs[0].urgent_details).not.toHaveProperty('helper_eta_minutes');
    else expect(result.body.gigs[0].urgent_details.helper_eta_minutes).toBe(9);
    expect(getTable('Gig')[0].urgent_details.helper_last_location).toEqual(privateLocation);
  });
  test.each(['payer', 'worker'])('%s retains ETA and the existing consent-gated location reader', async actor => {
    withLocation(false); const result = await read(actor); expect(result.status).toBe(200);
    expect(result.body.gig.helper_eta_minutes).toBe(12); expect(result.body.gig.urgent_details.helper_eta_minutes).toBe(9);
    let active = await request(app).get('/api/gigs/gig/active-status').set('x-test-user-id', actor);
    expect(active.status).toBe(200); expect(active.body.helper_location).toBeNull();
    getTable('Gig')[0].urgent_details.shareLocationDuringTask = true;
    active = await request(app).get('/api/gigs/gig/active-status').set('x-test-user-id', actor);
    expect(active.status).toBe(200); expect(active.body.helper_location).toEqual(privateLocation);
  });
});


test('private task detail is not stored in shared browser or intermediary caches', async () => {
  const result = await request(app).get('/api/gigs/gig'); expect(result.status).toBe(200);
  expect(result.headers['cache-control']).toContain('no-store');
});


describe('existing urgent task writer boundaries', () => {
  const notifications = require('../__mocks__/notificationService');
  beforeEach(() => Object.assign(getTable('Gig')[0], {
    user_id: 'payer', accepted_by: 'worker', status: 'assigned', is_urgent: true, starts_asap: false,
    accepted_at: '2026-09-01T00:00:00Z', started_at: null, updated_at: '2026-09-01T00:00:00Z',
    urgent_details: { shareLocationDuringTask: false, helper_eta_minutes: 9,
      helper_last_location: { latitude: 40.72, longitude: -74 }, current_fulfillment_status: 'on_the_way' },
  }));
  const status = (body = { status: 'arrived' }, actor = 'worker') => request(app)
    .post('/api/gigs/gig/status').set('x-test-user-id', actor).send(body);
  function interleave(change, receipt) {
    const from = db.from.bind(db);
    jest.spyOn(db, 'from').mockImplementation(table => {
      const query = from(table), execute = query._execute.bind(query), update = query.update.bind(query);
      let writing = false;
      query.update = value => { writing = true; if (change) { const once = change; change = null; once(); } return update(value); };
      query._execute = () => { const result = JSON.parse(JSON.stringify(execute())); return writing && receipt ? receipt(result) : result; };
      return query;
    });
  }
  test.each(['open', 'completed', 'cancelled'])('cannot change fulfillment on a %s task', async value => {
    getTable('Gig')[0].status = value; const before = structuredClone(getTable('Gig'));
    expect((await status()).status).toBe(409); expect(getTable('Gig')).toEqual(before);
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });
  test.each(['owner', 'worker', 'status', 'assignment-time', 'urgent-details', 'deleted'])('preserves post-read %s changes', async change => {
    let expected;
    interleave(() => {
      if (change === 'deleted') seedTable('Gig', []);
      else Object.assign(getTable('Gig')[0], {
        owner: { user_id: 'replacement' }, worker: { accepted_by: 'replacement' }, status: { status: 'completed' },
        'assignment-time': { accepted_at: '2026-09-02T00:00:00Z' },
        'urgent-details': { urgent_details: { ...getTable('Gig')[0].urgent_details, shareLocationDuringTask: true, current_fulfillment_status: 'in_progress' } },
      }[change]);
      expected = structuredClone(getTable('Gig'));
    });
    expect((await status()).status).toBe(409); expect(getTable('Gig')).toEqual(expected);
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });
  test.each(['empty', 'wrong-status', 'wrong-details'])('requires the stored %s receipt before reporting success or notifying', async change => {
    interleave(null, result => ({ ...result, data: change === 'empty' ? null : {
      ...result.data, ...(change === 'wrong-status' ? { id: 'another-gig' } : { urgent_details: { current_fulfillment_status: 'in_progress' } }),
    } }));
    const response = await status(); expect([409, 503]).toContain(response.status);
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });
  test.each([{ helper_eta_minutes: 7 }, { helper_latitude: 40.73, helper_longitude: -74 }])
  ('the poster cannot forge helper tracking fields %j', async fields => {
    const before = structuredClone(getTable('Gig'));
    expect((await status({ status: 'in_progress', ...fields }, 'payer')).status).toBe(403);
    expect(getTable('Gig')).toEqual(before);
  });
  test('rejects a partial location pair without discarding input silently', async () => {
    const before = structuredClone(getTable('Gig'));
    expect((await status({ status: 'arrived', helper_latitude: 40.72 })).status).toBe(400);
    expect(getTable('Gig')).toEqual(before);
  });
  test('does not return stored helper coordinates from the status mutation', async () => {
    const response = await status(); expect(response.status).toBe(200);
    expect(Object.keys(response.body.gig).sort()).toEqual(['id', 'is_urgent', 'status', 'urgent_details']);
    expect(response.body.gig.urgent_details).not.toHaveProperty('helper_last_location');
    expect(getTable('Gig')[0].urgent_details.helper_last_location).toEqual({ latitude: 40.72, longitude: -74 });
  });
  test.each(['asap', 'legacy-json', 'poster-null-eta'])('preserves the existing %s caller contract', async variant => {
    if (variant === 'asap') Object.assign(getTable('Gig')[0], { is_urgent: false, starts_asap: true });
    if (variant === 'legacy-json') getTable('Gig')[0].urgent_details = JSON.stringify(getTable('Gig')[0].urgent_details);
    const response = variant === 'poster-null-eta'
      ? await status({ status: 'in_progress', helper_eta_minutes: null }, 'payer') : await status();
    expect(response.status).toBe(200);
    expect(response.body.fulfillment_status).toBe(variant === 'poster-null-eta' ? 'in_progress' : 'arrived');
    expect(getTable('Gig')[0].urgent_details.helper_eta_minutes).toBe(9);
    expect(notifications.createNotification).toHaveBeenCalledTimes(1);
  });
  test('preserves a zero-minute ETA in the active reader', async () => {
    getTable('Gig')[0].urgent_details.helper_eta_minutes = 0;
    const response = await request(app).get('/api/gigs/gig/active-status').set('x-test-user-id', 'payer');
    expect(response.status).toBe(200); expect(response.body.helper_eta_minutes).toBe(0);
  });
  test('ends exact live location disclosure when the task ends', async () => {
    getTable('Gig')[0].status = 'completed'; getTable('Gig')[0].urgent_details.shareLocationDuringTask = true;
    const response = await request(app).get('/api/gigs/gig/active-status').set('x-test-user-id', 'payer');
    expect(response.status).toBe(200); expect(response.body.helper_location).toBeNull();
  });
  test('requires a boolean location-sharing opt-in', async () => {
    getTable('Gig')[0].urgent_details.shareLocationDuringTask = 'false';
    const response = await request(app).get('/api/gigs/gig/active-status').set('x-test-user-id', 'payer');
    expect(response.status).toBe(200); expect(response.body.helper_location).toBeNull();
  });
  test.each(['read', 'write'])('the private urgent %s response disables caching', async mode => {
    const response = mode === 'write' ? await status() : await request(app).get('/api/gigs/gig/active-status').set('x-test-user-id', 'payer');
    expect(response.status).toBe(200); expect(response.headers['cache-control']).toContain('no-store');
  });
});


describe('existing urgent notification retries', () => {
  const notices = require('../__mocks__/notificationService');
  const actualNotices = require(require('node:path').resolve(__dirname, '../../services/notificationService.js'));
  let loseInsertReply = false;
  beforeEach(() => {
    loseInsertReply = false;
    Object.assign(getTable('Gig')[0], { user_id: 'payer', accepted_by: 'worker', status: 'assigned',
      is_urgent: true, starts_asap: false, accepted_at: '2026-09-01T00:00:00Z', started_at: null,
      updated_at: '2026-09-01T00:00:00Z', urgent_details: { current_fulfillment_status: 'on_the_way', helper_eta_minutes: 9 } });
    notices.createNotification.mockImplementation(actualNotices.createNotification);
    const from = db.from.bind(db);
    jest.spyOn(db, 'from').mockImplementation(table => {
      const query = from(table), insert = query.insert.bind(query), execute = query._execute.bind(query);
      let inserting;
      query.insert = value => { inserting = value; return insert(value); };
      query._execute = () => {
        // The real Notification index is global and unique for non-null keys.
        if (table === 'Notification' && inserting?.idempotency_key
          && getTable('Notification').some(row => row.idempotency_key === inserting.idempotency_key)) {
          return { data: null, error: { code: '23505', message: 'Existing notification event' } };
        }
        const result = execute();
        if (table === 'Notification' && inserting && loseInsertReply) { loseInsertReply = false; return { data: null, error: { message: 'Synthetic lost committed insert reply' } }; }
        return result;
      };
      return query;
    });
  });
  afterEach(() => { notices.createNotification.mockReset(); actualNotices.init(null, null); });
  async function update(nextStatus = 'arrived') {
    const response = await request(app).post('/api/gigs/gig/status').set('x-test-user-id', 'worker').send({ status: nextStatus });
    expect(response.status).toBe(200);
    await Promise.all(notices.createNotification.mock.results.map(result => result.value));
    return response;
  }
  test('retrying a saved status preserves one existing read notification', async () => {
    await update(); expect(getTable('Notification')).toHaveLength(1);
    getTable('Notification')[0].is_read = true;
    const first = structuredClone(getTable('Notification')[0]);
    await update(); expect(getTable('Notification')).toEqual([first]);
  });
  test('retrying a lost notification insert reply does not create another notice', async () => {
    loseInsertReply = true;
    await update(); expect(loseInsertReply).toBe(false); expect(getTable('Notification')).toHaveLength(1);
    await update(); expect(getTable('Notification')).toHaveLength(1);
  });
  test.each(['next-step', 'next-assignment'])('a %s still receives its own notice', async change => {
    await update();
    if (change === 'next-assignment') getTable('Gig')[0].accepted_at = '2026-09-02T00:00:00Z';
    const next = change === 'next-step' ? 'in_progress' : 'arrived';
    await update(next); await update(next);
    expect(getTable('Notification')).toHaveLength(2);
    expect(new Set(getTable('Notification').map(row => row.idempotency_key)).size).toBe(2);
  });

});

describe('worker start binds the displayed assignment terms', () => {
  const startWith = (body, actor = 'worker') => request(app).post('/api/gigs/gig/start').set('x-test-user-id', actor).send(body);
  const displayed = () => ({ expectedAcceptedAt: getTable('Gig')[0].accepted_at, expectedPrice: getTable('Gig')[0].price,
    expectedPaymentId: getTable('Gig')[0].payment_id });
  const stamped = () => { assigned(); getTable('Gig')[0].accepted_at = '2026-09-16T12:00:00+00:00'; };

  test('matching displayed terms start the assignment, tolerating timestamp formatting', async () => {
    stamped();
    const response = await startWith({ ...displayed(), expectedAcceptedAt: '2026-09-16T12:00:00Z' });
    expect(response.status).toBe(200); expect(getTable('Gig')[0].status).toBe('in_progress');
  });
  test.each([
    ['accepted_at', { expectedAcceptedAt: '2026-09-16T13:00:00Z' }],
    ['missing accepted_at', { expectedAcceptedAt: null }],
    ['price', { expectedPrice: 20 }],
    ['payment', { expectedPaymentId: 'other' }],
    ['null payment', { expectedPaymentId: null }],
  ])('a changed %s is refused before any provider check or write', async (_label, change) => {
    stamped();
    const verify = jest.spyOn(service, 'verifyGigAuthorization');
    const response = await startWith({ ...displayed(), ...change });
    expect(response.status).toBe(409); expect(response.body.code).toBe('ASSIGNMENT_CHANGED');
    expect(getTable('Gig')[0].status).toBe('assigned'); expect(getTable('Gig')[0].started_at).toBeNull();
    expect(verify).not.toHaveBeenCalled(); expect(mockRetrieve).not.toHaveBeenCalled();
  });
  test('an absent field means the screen displayed no value', async () => {
    assigned();
    expect((await startWith({ expectedPrice: 12.5, expectedPaymentId: 'pay' })).status).toBe(200);
  });
  test('a saved start is not recovered for different displayed terms', async () => {
    stamped();
    expect((await startWith(displayed())).status).toBe(200);
    const stale = await startWith({ ...displayed(), expectedAcceptedAt: '2026-09-15T12:00:00Z' });
    expect(stale.status).toBe(409); expect(stale.body.code).toBe('ASSIGNMENT_CHANGED'); expect(stale.body.reused).toBeUndefined();
    const same = await startWith(displayed());
    expect(same.status).toBe(200); expect(same.body.reused).toBe(true);
  });
  test('malformed displayed terms are rejected without side effects', async () => {
    stamped();
    expect((await startWith({ expectedPrice: 'twelve' })).status).toBe(400);
    expect((await startWith({ expectedAcceptedAt: 'yesterday' })).status).toBe(400);
    expect(getTable('Gig')[0].status).toBe('assigned'); expect(mockRetrieve).not.toHaveBeenCalled();
  });
  test('callers that send no terms keep the existing behavior', async () => {
    stamped();
    expect((await startWith({})).status).toBe(200); expect(getTable('Gig')[0].status).toBe('in_progress');
  });
});

describe('my-bids exposes the assignment terms only to the assigned worker', () => {
  test('the worker receives accepted_at and payment_id; another bidder receives null', async () => {
    assigned(); getTable('Gig')[0].accepted_at = '2026-09-16T12:00:00+00:00';
    seedTable('GigBid', [...getTable('GigBid'), { id: 'bid-other', gig_id: 'gig', user_id: 'other', bid_amount: 10, status: 'rejected' }]);
    const mine = await request(app).get('/api/gigs/my-bids').set('x-test-user-id', 'worker');
    expect(mine.status).toBe(200);
    expect(mine.body.bids.find(b => b.id === 'bid').gig).toMatchObject({ id: 'gig', price: 12.5, accepted_by: 'worker', accepted_at: '2026-09-16T12:00:00+00:00', payment_id: 'pay' });
    const theirs = await request(app).get('/api/gigs/my-bids').set('x-test-user-id', 'other');
    expect(theirs.status).toBe(200);
    const gig = theirs.body.bids.find(b => b.id === 'bid-other').gig;
    expect(gig.accepted_at).toBeNull(); expect(gig.payment_id).toBeNull(); expect(gig.price).toBe(12.5);
  });
});
