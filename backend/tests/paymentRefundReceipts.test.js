const db = require('./__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable, setRpcMock } = db;
const mockEvent = jest.fn();
const mockRetrieve = jest.fn(), mockCancel = jest.fn(), mockCharge = jest.fn(), mockCreate = jest.fn(), mockList = jest.fn();
jest.mock('stripe', () => ({ paymentIntents: { create: jest.fn(), retrieve: mockRetrieve, cancel: mockCancel }, charges: { retrieve: mockCharge }, refunds: { create: mockCreate, list: mockList }, webhooks: { constructEvent: mockEvent } }));
const service = require('../services/paymentRefundService');
const requestId = 'aaf30000-0000-4000-8000-000000000001';
const payment = extra => ({ id: 'pay', payer_id: 'payer', payee_id: 'worker', gig_id: 'gig', amount_total: 1000,
  amount_to_payee: 850, payment_type: 'gig_payment', currency: 'USD', stripe_customer_id: 'cus_one',
  stripe_payment_intent_id: 'pi_one', stripe_charge_id: 'ch_one', payment_status: 'captured_hold', refunded_amount: 0, ...extra });
const intent = extra => ({ id: 'pi_one', customer: 'cus_one', amount: 1000, amount_received: 1000, currency: 'usd',
  status: 'succeeded', capture_method: 'manual', latest_charge: 'ch_one', metadata: { payer_id: 'payer', payee_id: 'worker', gig_id: 'gig' }, ...extra });
const refund = extra => ({ id: 're_one', payment_intent: 'pi_one', charge: 'ch_one', amount: 300, currency: 'usd',
  status: 'succeeded', created: 1700000000, metadata: { payment_id: 'pay', refund_request_id: requestId }, ...extra });
const args = extra => ({ paymentId: 'pay', actorId: 'payer', actorMode: 'payer', requestId, amount: 300, reason: 'other', ...extra });
const request = extra => ({ id: requestId, payment_id: 'pay', actor_id: 'payer', actor_mode: 'payer', requested_amount: 300,
  amount_cents: 300, currency: 'usd', operation: 'refund', reason: 'other', description: null,
  status: 'pending', provider_refund_id: null, reversal_status: 'not_required', ...extra });
let saveFailure = false, claimAllowed = true;
beforeEach(() => {
  jest.clearAllMocks(); jest.restoreAllMocks(); resetTables(); saveFailure = false; claimAllowed = true;
  seedTable('Payment', [payment()]); seedTable('User', [{ id: 'payer', role: 'user' }, { id: 'admin', role: 'admin' }]);
  mockRetrieve.mockResolvedValue(intent()); mockCharge.mockResolvedValue({ id: 'ch_one', payment_intent: 'pi_one', customer: 'cus_one', amount: 1000, currency: 'usd', paid: true, captured: true });
  mockList.mockResolvedValue({ data: [], has_more: false }); mockCreate.mockResolvedValue(refund());
  setRpcMock(async (name, a) => {
    const p = getTable('Payment')[0]; const requests = getTable('PaymentRefundRequest');
    if (name === 'reserve_payment_refund') {
      let r = requests.find(x => x.id === a.p_request_key);
      if (r && (r.requested_amount !== a.p_amount || r.reason !== a.p_reason)) return { data: { error: 'REQUEST_CONFLICT' } };
      if (!r) { r = request({ id: a.p_request_key, requested_amount: a.p_amount, amount_cents: a.p_amount ?? 1000 - p.refunded_amount,
        reason: a.p_reason, operation: a.p_operation, actor_id: a.p_actor_id, actor_mode: a.p_actor_mode }); requests.push(r); }
      p.payment_status = 'refund_pending'; return { data: { request: { ...r }, payment: { ...p } } };
    }
    if (name === 'claim_payment_refund') {
      if (claimAllowed !== true) return { data: { error: claimAllowed || 'FORBIDDEN' } };
      const r = requests.find(x => x.id === a.p_request_id);
      r.provider_started_at ||= new Date().toISOString(); return { data: { request: { ...r }, claimed: true } };
    }
    if (name === 'record_payment_refund_receipts') {
      if (saveFailure && a.p_receipts.length) return { error: { code: '08006' } };
      for (const proof of a.p_receipts) {
        let receipt = getTable('PaymentRefundReceipt').find(x => x.provider_refund_id === proof.id);
        if (!receipt) { receipt = {}; getTable('PaymentRefundReceipt').push(receipt); }
        Object.assign(receipt, { provider_refund_id: proof.id, payment_id: p.id, request_id: proof.requestId,
          amount_cents: proof.amountCents, status: proof.status, currency: proof.currency });
        const r = requests.find(x => x.id === proof.requestId);
        if (r) Object.assign(r, { status: proof.status, provider_refund_id: proof.id });
      }
      p.refunded_amount = getTable('PaymentRefundReceipt').filter(x => x.status === 'succeeded').reduce((n, x) => n + x.amount_cents, 0);
      return { data: { payment: { ...p } } };
    }
    if (name === 'record_payment_refund_release') {
      const r = requests.find(x => x.id === a.p_request_id); r.status = 'succeeded'; p.payment_status = 'canceled'; return { data: { payment: { ...p }, request: { ...r } } };
    }
    throw new Error(`Unexpected RPC ${name}`);
  });
});
test('actual service records exact success and returns receipt, not an undefined refund', async () => {
  const result = await service.create(args());
  expect(result).toMatchObject({ success: true, refundRequest: { requestId, amountCents: 300, status: 'succeeded' }, refund: { stripe_refund_id: 're_one', amount: 300 } });
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 300, payment_intent: 'pi_one' }), { idempotencyKey: `pantopus-refund:${requestId}` });
});
test.each(['pending', 'requires_action', 'failed', 'canceled'])('provider %s never claims returned money', async status => {
  mockCreate.mockResolvedValue(refund({ status }));
  const result = await service.create(args());
  expect(result.success).toBe(false); expect(result.refundRequest.status).toBe(status); expect(result.payment.refunded_amount).toBe(0);
});
test.each([{ amount: 999 }, { customer: 'cus_foreign' }, { metadata: { payer_id: 'foreign' } }, { id: 'pi_foreign' }, { capture_method: 'automatic' }])('mismatched provider proof %j stops before provider mutation', async patch => {
  mockRetrieve.mockResolvedValue(intent(patch)); await expect(service.create(args())).rejects.toMatchObject({ statusCode: 409 });
  expect(mockCreate).not.toHaveBeenCalled(); expect(getTable('PaymentRefundRequest')).toHaveLength(0);
});
test('foreign payer rejected before even reading provider', async () => {
  await expect(service.create(args({ actorId: 'foreign' }))).rejects.toMatchObject({ statusCode: 403 }); expect(mockRetrieve).not.toHaveBeenCalled();
});
test('revoked admin rejected before provider access', async () => {
  seedTable('User', [{ id: 'admin', role: 'user' }]);
  await expect(service.create(args({ actorId: 'admin', actorMode: 'admin' }))).rejects.toMatchObject({ statusCode: 403 }); expect(mockRetrieve).not.toHaveBeenCalled();
});
test('actor revocation at SQL admission prevents provider mutation after reads', async () => {
  claimAllowed = false; await expect(service.create(args())).rejects.toMatchObject({ statusCode: 403, refundRequest: { requestId, canRetry: false } }); expect(mockCreate).not.toHaveBeenCalled();
});
test('lost provider response retains request and discovers its existing refund without another create', async () => {
  mockCreate.mockRejectedValueOnce(new Error('response lost'));
  await expect(service.create(args())).rejects.toMatchObject({ statusCode: 503, refundRequest: { requestId } });
  mockList.mockResolvedValue({ data: [refund()], has_more: false });
  expect((await service.create(args())).success).toBe(true); expect(mockCreate).toHaveBeenCalledTimes(1);
});
test('provider success plus DB failure is pending until exact recovery succeeds', async () => {
  saveFailure = true; await expect(service.create(args())).rejects.toMatchObject({ statusCode: 503 });
  expect(getTable('Payment')[0].refunded_amount).toBe(0);
  saveFailure = false; mockList.mockResolvedValue({ data: [refund()], has_more: false });
  expect((await service.create(args())).success).toBe(true); expect(mockCreate).toHaveBeenCalledTimes(1);
});
test('old unknown outcome performs discovery but never another create', async () => {
  seedTable('PaymentRefundRequest', [request({ provider_started_at: '2020-01-01T00:00:00Z' })]);
  await expect(service.create(args())).rejects.toMatchObject({ code: 'refund_reconciliation_required', refundRequest: { requestId } });
  expect(mockList).toHaveBeenCalled(); expect(mockCreate).not.toHaveBeenCalled();
});
test('duplicate provider matches are rejected before creating another refund', async () => {
  seedTable('PaymentRefundRequest', [request()]);
  mockList.mockResolvedValue({ data: [refund(), refund()], has_more: false });
  await expect(service.create(args())).rejects.toMatchObject({ statusCode: 503 }); expect(mockCreate).not.toHaveBeenCalled();
});
test('provider amount mismatch cannot produce a local success receipt', async () => {
  mockCreate.mockResolvedValue(refund({ amount: 400 }));
  await expect(service.create(args())).rejects.toMatchObject({ statusCode: 409 }); expect(getTable('PaymentRefundReceipt')).toHaveLength(0);
});
test('cold history is actor scoped, excludes secrets, and never contacts provider', async () => {
  seedTable('PaymentRefundRequest', [request({ frozen_payment: { secret: 'forbidden' } })]);
  const result = await service.history('pay', 'payer');
  expect(result.requests[0]).toMatchObject({ requestId, requestedAmountCents: 300, reason: 'other' });
  expect(JSON.stringify(result)).not.toContain('forbidden'); expect(mockRetrieve).not.toHaveBeenCalled();
  await expect(service.history('pay', 'worker')).rejects.toMatchObject({ statusCode: 403 });
});
test('authorization cancellation is a released hold with zero captured refund', async () => {
  seedTable('Payment', [payment({ payment_status: 'authorized', stripe_charge_id: null, captured_at: null })]);
  mockRetrieve.mockResolvedValue(intent({ status: 'requires_capture', amount_received: 0 }));
  mockCancel.mockResolvedValue(intent({ status: 'canceled', amount_received: 0 }));
  const result = await service.create(args({ amount: null }));
  expect(result).toMatchObject({ success: true, refundRequest: { operation: 'release' }, payment: { payment_status: 'canceled', refunded_amount: 0 } });
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockCancel).toHaveBeenCalledWith('pi_one', {}, { idempotencyKey: `refund-release:${requestId}` });
});
test('cold canceled release receipt recovers after actor revocation without new mutation', async () => {
  seedTable('Payment', [payment({ payment_status: 'refund_pending', stripe_charge_id: null })]);
  const r = request({ operation: 'release', actor_id: 'admin', actor_mode: 'admin' }); seedTable('PaymentRefundRequest', [r]);
  mockRetrieve.mockResolvedValue(intent({ status: 'canceled', amount_received: 0 }));
  expect((await service.recoverRequest(r)).success).toBe(true); expect(mockCancel).not.toHaveBeenCalled();
});
test('payer history never offers mutation of admin/policy-origin or below-minimum requests', async () => {
  seedTable('PaymentRefundRequest', [request({ actor_id: 'admin', actor_mode: 'admin' }),
    request({ id: 'other-policy', actor_id: 'payer', actor_mode: 'policy', requested_amount: 25 })]);
  const result = await service.history('pay', 'payer');
  expect(result.requests.map(r => r.canRetry)).toEqual([false, false]);
});
test('unused legacy Connect helper cannot transfer around a reserved refund', async () => {
  await expect(require('../stripe/stripeService').createTransfer('pay')).rejects.toMatchObject({ statusCode: 409 });
});
const express = require('express');
const http = require('supertest');
function app() { const a = express(); a.use(express.json()); a.use('/api/payments', require('../routes/pays')); return a; }
test('actual payer route returns 202 and pending receipt without a success claim', async () => {
  mockCreate.mockResolvedValue(refund({ status: 'pending' }));
  const res = await http(app()).post('/api/payments/pay/refund').set('x-test-user-id', 'payer').send({ requestId, amount: 300, reason: 'other' });
  expect(res.status).toBe(202); expect(res.body).toMatchObject({ success: false, refundRequest: { requestId, status: 'pending' } });
});
test('actual payer route rejects forged actor fields before touching provider', async () => {
  const res = await http(app()).post('/api/payments/pay/refund').set('x-test-user-id', 'foreign').send({ requestId, reason: 'other', actorMode: 'policy', actorId: 'payer' });
  expect(res.status).toBe(403); expect(mockRetrieve).not.toHaveBeenCalled();
});
test('actual history endpoint denies payee and permits exact payer without provider calls', async () => {
  expect((await http(app()).get('/api/payments/pay/refunds').set('x-test-user-id', 'worker')).status).toBe(403);
  expect((await http(app()).get('/api/payments/pay/refunds').set('x-test-user-id', 'payer')).status).toBe(200);
  expect(mockRetrieve).not.toHaveBeenCalled();
});
test('actual admin endpoint rechecks persisted role after middleware claim', async () => {
  seedTable('User', [{ id: 'admin', role: 'user' }]);
  const res = await http(app()).post('/api/payments/pay/admin-refund').set('x-test-user-id', 'admin').set('x-test-role', 'admin').send({ requestId, reason: 'other' });
  expect(res.status).toBe(403); expect(mockRetrieve).not.toHaveBeenCalled();
});
test.each(['charge.refunded', 'refund.updated', 'charge.refund.updated', 'refund.created', 'refund.failed'])('actual %s webhook reads current provider receipts and retries failed durable save', async type => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_synthetic_contract_only';
  seedTable('PaymentRefundRequest', [request()]); mockList.mockResolvedValue({ data: [refund()], has_more: false });
  mockEvent.mockReturnValue({ id: `evt_${type}`, type, data: { object: type === 'charge.refunded'
    ? { id: 'ch_one', payment_intent: 'pi_one', amount: 1000, amount_refunded: 999 } : refund({ status: 'pending' }) } });
  const a = express(); a.use('/webhook', express.raw({ type: 'application/json' }), require('../stripe/stripeWebhooks'));
  saveFailure = true;
  expect((await http(a).post('/webhook').set('Content-Type', 'application/json').send('{}')).status).toBe(500);
  expect(getTable('Payment')[0].refunded_amount).toBe(0);
  saveFailure = false;
  expect((await http(a).post('/webhook').set('Content-Type', 'application/json').send('{}')).status).toBe(200);
  expect(getTable('Payment')[0].refunded_amount).toBe(300);
  expect(mockCreate).not.toHaveBeenCalled();
});
test('legacy booking cancellation returns pending without claiming money refunded', async () => {
  const stripeService = require('../stripe/stripeService');
  jest.spyOn(stripeService, 'createSmartRefund').mockResolvedValue({ success: false,
    refundRequest: { status: 'pending', requestId, canRetry: false, operation: 'refund' } });
  const result = await require('../services/scheduling/schedulingPaymentsService').refundForBooking({ booking: {
    id: 'booking', payment_id: 'pay', start_at: '2030-01-01T00:00:00Z', policy_snapshot: {} }, initiatedBy: 'payer' });
  expect(result).toMatchObject({ refunded: false, pending: true, refundRequest: { requestId } });
});

test('a dispute opened after reservation prevents a new provider refund at the final claim', async () => {
  claimAllowed = 'DISPUTED';
  await expect(service.create(args())).rejects.toMatchObject({ code: 'DISPUTED', statusCode: 409 });
  expect(mockCreate).not.toHaveBeenCalled();
});
test.each([-1, 1001])('invalid stored payee allocation %i prevents provider mutation', async amount => {
  seedTable('Payment', [payment({ amount_to_payee: amount })]);
  await expect(service.create(args())).rejects.toMatchObject({ statusCode: 409 }); expect(mockCreate).not.toHaveBeenCalled();
});
test('refund discovery paginates the exact payment and rejects two receipts for one operation', async () => {
  mockList.mockResolvedValueOnce({ data: [refund()], has_more: true }).mockResolvedValueOnce({ data: [refund({ id: 're_duplicate' })], has_more: false });
  await expect(service._test.discover(payment(), [request()])).rejects.toMatchObject({ statusCode: 409 });
  expect(mockList).toHaveBeenNthCalledWith(2, { payment_intent: 'pi_one', limit: 100, starting_after: 're_one' });
});

test('refund POST and cold history share the same read-only held projection', async () => {
  const post = await service.create(args()); const history = await service.history('pay', 'payer');
  expect(post.payment).toEqual(history.payment);
  expect(history.payment).toMatchObject({ payee_release_status: 'held', wallet_settlement: null, refunded_amount: 300 });
});
