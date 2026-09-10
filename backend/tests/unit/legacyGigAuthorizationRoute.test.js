const { resetTables, seedTable, getTable, setRpcMock } = require('../__mocks__/supabaseAdmin');
const mockRetrieve = jest.fn(), mockCreate = jest.fn(), mockConstruct = jest.fn();
jest.mock('stripe', () => ({ paymentIntents: { retrieve: mockRetrieve, create: mockCreate }, webhooks: { constructEvent: mockConstruct } }));
jest.mock('../__mocks__/verifyToken', () => {
  const verify = (req,res,next) => { req.user = { id: req.headers['x-test-user-id'] }; req.session = { id: req.headers['x-test-session'] || 'test-session' }; next(); };
  verify.requireAdmin = (req,res,next) => next(); return verify;
});
jest.mock('../../utils/businessPermissions', () => ({ hasPermission: jest.fn(),
  getBusinessIdsWithPermissions: jest.fn().mockResolvedValue([]), getTeamMembersWithPermissions: jest.fn().mockResolvedValue([]) }));
jest.mock('../../services/walletSettlementService', () => ({ readProjection: jest.fn().mockResolvedValue({ payeeReleaseStatus: 'held' }) }));
const { hasPermission } = require('../../utils/businessPermissions');
const express = require('express'), request = require('supertest');
const payer = 'aafe0000-0000-4000-8000-000000000001', worker = 'aafe0000-0000-4000-8000-000000000002';
const paymentId = 'aafe0000-0000-4000-8000-000000000301';
const { createNotification } = require('../../services/notificationService');
const mockEmit = jest.fn(), mockTo = jest.fn();
const app = express();
app.set('io', { to: mockTo });
app.use('/webhook',express.raw({ type: 'application/json' }),require('../../stripe/stripeWebhooks'));
app.use(express.json()); app.use('/gigs',require('../../routes/gigs'));
const { getRequestSessionScope } = require('../../utils/requestSessionScope');
const scopeFor = actor => getRequestSessionScope({ user: { id: actor }, session: { id: 'test-session' } }).session_scope;
const body = { expectedActorId: payer, expectedSessionScope: scopeFor(payer), expectedPaymentId: paymentId, expectedPayerId: payer, expectedAmountCents: 1200, expectedPayeeId: worker, currency: 'usd' };
let rpc;
beforeEach(() => {
  jest.resetAllMocks(); mockTo.mockReturnValue({ emit: mockEmit }); resetTables(); process.env.STRIPE_WEBHOOK_SECRET = 'synthetic-webhook-secret';
  seedTable('Payment',[{ id: paymentId, payer_id: payer, payee_id: worker, gig_id: 'gig', amount_total: 1200,
    currency: 'USD', stripe_customer_id: 'cus_payer', stripe_payment_intent_id: 'pi_legacy',
    payment_status: 'authorization_failed', payment_type: 'gig_payment' }]);
  seedTable('Gig',[{ id: 'gig', user_id: payer, accepted_by: worker, status: 'assigned', payment_id: paymentId, price: 12 }]);
  seedTable('User',[{ id: payer, account_type: 'business' }, { id: worker, account_type: 'personal' }]);
  hasPermission.mockResolvedValue(false);
  mockRetrieve.mockResolvedValue({ id: 'pi_legacy', status: 'requires_capture', amount: 1200, currency: 'usd',
    customer: 'cus_payer', capture_method: 'manual', amount_capturable: 1200,
    metadata: { payer_id: payer, payee_id: worker, gig_id: 'gig' } });
  rpc = jest.fn(async (name,args) => {
    if (name === 'record_legacy_gig_authorization') getTable('Payment')[0].payment_status = args.p_proof.status === 'requires_capture'
      ? 'authorized' : ['requires_action','requires_payment_method'].includes(args.p_proof.status) ? 'authorization_failed' : 'authorize_pending';
    return { data: { payment: { ...getTable('Payment')[0] }, attempt: { id: 'attempt', intent_id: 'pi_legacy',
      adopted: true, created_at: new Date().toISOString(), verified_at: null } } };
  });
  setRpcMock(rpc);
});
const post = (action, payload = body) => request(app).post(`/gigs/gig/${action}`).set('x-test-user-id',payer).send(payload);
test.each(['retry-authorization','continue-authorization'])('%s requires the displayed payment terms before mutation',async action => {
  expect((await post(action,{})).status).toBe(400); expect(rpc).not.toHaveBeenCalled(); expect(mockCreate).not.toHaveBeenCalled();
});
test.each([
  { expectedPaymentId: 'aafe0000-0000-4000-8000-000000000399' }, { expectedAmountCents: 1300 }, { expectedPayerId: worker },
  { expectedPayeeId: 'aafe0000-0000-4000-8000-000000000003' },
])('a replaced displayed payment/amount/worker prevents all provider calls: %j',async change => {
  expect((await post('retry-authorization',{...body,...change})).status).toBe(409);
  expect(mockRetrieve).not.toHaveBeenCalled(); expect(mockCreate).not.toHaveBeenCalled();
});
test.each(['retry-authorization','continue-authorization','refresh-payment-status'])('%s reports only verified durable readiness',async action => {
  const result = await post(action, action === 'refresh-payment-status' ? {} : body);
  expect(result.status).toBe(200); expect(result.body).toMatchObject({ authorizationReady: true, amountCents: 1200,
    currency: 'usd', paymentId, paymentIntentId: 'pi_legacy', authorizationAttemptId: 'attempt' });
  expect(result.body.clientSecret).toBeUndefined(); expect(mockCreate).not.toHaveBeenCalled();
  expect(rpc.mock.calls[0][1].p_actor_id).toBe(payer);
});
test('revoked owner gets no intent or client secret',async () => {
  setRpcMock(async () => ({ data: { error: 'FORBIDDEN' } }));
  const result = await post('continue-authorization');
  expect(result.status).toBe(403); expect(mockRetrieve).not.toHaveBeenCalled();
});
test('read status returns the verified opening fingerprint without session or bearer identifiers',async () => {
  const result=await post('refresh-payment-status',{});
  expect(result.body.sessionScope).toBe(scopeFor(payer)); expect(JSON.stringify(result.body)).not.toContain('test-session');
});
test('same-actor replacement session is rejected before provider work even when the browser event is delayed',async () => {
  const result=await request(app).post('/gigs/gig/continue-authorization').set('x-test-user-id',payer)
    .set('x-test-session','replacement-session').send(body);
  expect(result.status).toBe(409); expect(result.body.code).toBe('SESSION_SCOPE_CHANGED');
  expect(rpc).not.toHaveBeenCalled(); expect(mockRetrieve).not.toHaveBeenCalled(); expect(mockCreate).not.toHaveBeenCalled();
});
test('an account replacement rejects the previous screen actor before any reservation',async () => {
  const result=await request(app).post('/gigs/gig/retry-authorization').set('x-test-user-id',worker).send(body);
  expect(result.status).toBe(409); expect(result.body.code).toBe('SESSION_SCOPE_CHANGED'); expect(rpc).not.toHaveBeenCalled();
});
test('verified delegate keeps its actor identity distinct from the frozen business payer',async () => {
  const delegate='aafe0000-0000-4000-8000-000000000003';
  const result=await request(app).post('/gigs/gig/continue-authorization').set('x-test-user-id',delegate).send({ ...body, expectedActorId: delegate, expectedSessionScope: scopeFor(delegate) });
  expect(result.status).toBe(200); expect(result.body).toMatchObject({ actorId:delegate,payerId:payer,payeeId:worker });
  expect(rpc.mock.calls[0][1].p_actor_id).toBe(delegate);
});
test('current business manager can read the exact payer payment; revoked manager cannot',async () => {
  const delegate='aafe0000-0000-4000-8000-000000000003';
  hasPermission.mockResolvedValue(true);
  const result=await request(app).get('/gigs/gig/payment').set('x-test-user-id',delegate);
  expect(result.status).toBe(200); expect(result.body.payment.payer_id).toBe(payer);
  hasPermission.mockResolvedValue(false);
  expect((await request(app).get('/gigs/gig/payment').set('x-test-user-id',delegate)).status).toBe(403);
});
test('worker payment reads retain provider identity redaction',async () => {
  const result=await request(app).get('/gigs/gig/payment').set('x-test-user-id',worker);
  expect(result.status).toBe(200); expect(result.body.payment.stripe_payment_intent_id).toBeUndefined();
  expect(result.body.payment.stripe_customer_id).toBeUndefined(); expect(result.body.payment.id).toBe(paymentId);
});
test('failed receipt persistence remains an explicit retryable response',async () => {
  setRpcMock(async (name,args) => name === 'record_legacy_gig_authorization' ? { error: { message: 'offline' } } : rpc(name,args));
  const result = await post('continue-authorization');
  expect(result.status).toBe(503); expect(result.body.code).toBe('authorization_unknown');
  expect(result.body.authorizationReady).toBeUndefined();
});
test.each(['payment_intent.canceled','payment_intent.payment_failed','payment_intent.requires_action','payment_intent.amount_capturable_updated'])(
  'late %s webhook retrieves current intent instead of applying its stale state',async type => {
    mockConstruct.mockReturnValue({ id: 'evt_legacy', type, data: { object: { id: 'pi_legacy', status: 'canceled', capture_method: 'manual' } } });
    const result = await request(app).post('/webhook').set('content-type','application/json').set('stripe-signature','synthetic').send('{}');
    expect(result.status).toBe(200); expect(mockRetrieve).toHaveBeenCalledWith('pi_legacy');
    expect(getTable('Payment')[0].payment_status).toBe('authorized');
    expect(rpc.mock.calls.at(-1)[1].p_proof.status).toBe('requires_capture');
  });
test('unavailable current provider proof leaves webhook retryable without state changes',async () => {
  mockConstruct.mockReturnValue({ id: 'evt_legacy', type: 'payment_intent.canceled', data: { object: { id: 'pi_legacy' } } });
  mockRetrieve.mockRejectedValue(new Error('provider unavailable'));
  const result = await request(app).post('/webhook').set('content-type','application/json').set('stripe-signature','synthetic').send('{}');
  expect(result.status).toBe(500); expect(getTable('Payment')[0].payment_status).toBe('authorization_failed');
  expect(getTable('StripeWebhookEvent')[0].processed).not.toBe(true);
});

test('status checks emit only after a real receipt change and do not expose the internal flag',async () => {
  const changed=await post('refresh-payment-status',{});
  expect(changed.status).toBe(200); expect(changed.body.paymentChanged).toBeUndefined();
  expect(mockTo).toHaveBeenCalledWith('gig:gig'); expect(mockEmit).toHaveBeenCalledTimes(1);
  const unchanged=await post('refresh-payment-status',{});
  expect(unchanged.body.authorizationReady).toBe(true); expect(unchanged.body.paymentChanged).toBeUndefined();
  expect(mockEmit).toHaveBeenCalledTimes(1);
});
test('fresh webhook hold proof emits once; later unchanged events cannot reload the screen repeatedly',async () => {
  for (const id of ['evt_hold_one','evt_hold_two']) {
    mockConstruct.mockReturnValue({ id, type:'payment_intent.amount_capturable_updated',
      data:{ object:{ id:'pi_legacy',capture_method:'manual' } } });
    expect((await request(app).post('/webhook').set('content-type','application/json').set('stripe-signature','synthetic').send('{}')).status).toBe(200);
  }
  expect(mockEmit).toHaveBeenCalledTimes(1); expect(mockEmit).toHaveBeenCalledWith('gig:payment-update',expect.objectContaining({gigId:'gig'}));
  expect(createNotification).not.toHaveBeenCalled();
});
test.each(['requires_action','requires_payment_method'])('verified %s attention is preserved without replaying an unchanged notice',async status => {
  getTable('Payment')[0].payment_status='authorize_pending';
  const current=await mockRetrieve(); mockRetrieve.mockResolvedValue({...current,status,amount_capturable:0});
  for (const id of ['evt_attention_one','evt_attention_two']) {
    mockConstruct.mockReturnValue({ id,type:'payment_intent.payment_failed',data:{object:{id:'pi_legacy'}} });
    expect((await request(app).post('/webhook').set('content-type','application/json').set('stripe-signature','synthetic').send('{}')).status).toBe(200);
  }
  expect(mockEmit).toHaveBeenCalledTimes(1); expect(createNotification).toHaveBeenCalledTimes(1);
  expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({userId:payer,type:'payment_auth_failed',metadata:{gig_id:'gig',payment_id:paymentId}}));
});
