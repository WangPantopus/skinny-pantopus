const db = require('./__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable, setRpcMock } = db;
const mockCharge = jest.fn();
const mockRetrieve = jest.fn(), mockCapture = jest.fn(), mockCancel = jest.fn(), mockCreate = jest.fn(), mockList = jest.fn();
jest.mock('stripe', () => ({ charges: { retrieve: mockCharge }, paymentIntents: { retrieve: mockRetrieve, capture: mockCapture, cancel: mockCancel, create: mockCreate, list: mockList } }));
const service = require('../stripe/stripeService');
const acceptance = require('../services/gigPaymentAcceptance');
const terms = { gigId: 'gig', payerId: 'payer', payeeId: 'worker', amount: 1250 };
const payment = (extra = {}) => ({ id: 'pay', gig_id: 'gig', payer_id: 'payer', payee_id: 'worker', amount_total: 1250,
  currency: 'USD', payment_type: 'gig_payment', stripe_customer_id: 'cus_payer', stripe_payment_intent_id: 'pi_one',
  payment_status: 'authorize_pending', refunded_amount: 0, metadata: { acceptance_attempt_id: 'attempt' }, ...extra });
const intent = (extra = {}) => ({ id: 'pi_one', customer: 'cus_payer', amount: 1250, currency: 'usd',
  capture_method: 'manual', status: 'requires_capture', amount_capturable: 1250, latest_charge: 'ch_one',
  metadata: { payer_id: 'payer', payee_id: 'worker', gig_id: 'gig', acceptance_attempt_id: 'attempt' }, ...extra });
const captured = (extra = {}) => intent({ status: 'succeeded', amount_capturable: 0, amount_received: 1250, ...extra });
const gig = { id: 'gig', user_id: 'payer', status: 'open' };
const bid = { id: 'bid', gig_id: 'gig', user_id: 'worker', bid_amount: 12.5, status: 'pending_payment', pending_payment_intent_id: 'pay' };
const attempt = { id: 'attempt', gig_id: 'gig', bid_id: 'bid', payer_id: 'payer', payee_id: 'worker', amount: 1250,
  currency: 'usd', created_at: new Date().toISOString(), state: 'initializing' };
beforeEach(() => {
  jest.restoreAllMocks(); jest.clearAllMocks(); resetTables();
  seedTable('Payment', [payment()]);
  seedTable('User', [{ id: 'payer', stripe_customer_id: 'cus_payer' }]);
  mockList.mockReset(); mockList.mockResolvedValue({ data: [], has_more: false });
  mockRetrieve.mockResolvedValue(intent()); mockCapture.mockResolvedValue(captured());
  mockCharge.mockResolvedValue({ id: 'ch_one', payment_intent: 'pi_one', customer: 'cus_payer', amount: 1250,
    currency: 'usd', paid: true, captured: false, refunded: false, amount_refunded: 0,
    payment_method_details: { type: 'card', card: { capture_before: Math.floor(Date.now()/1000)+3600 } } });
});
function captureRpc({ failReceipt = false } = {}) {
  setRpcMock(async (name) => {
    const p = getTable('Payment')[0];
    if (name === 'prepare_paid_gig_capture') { p.payment_status = 'capture_pending'; return { data: { payment: { ...p } } }; }
    if (name === 'record_paid_gig_capture') {
      if (failReceipt) return { error: { code: '08006' } };
      const reused = p.payment_status === 'captured_hold';
      Object.assign(p, { payment_status: 'captured_hold', captured_at: '2026-09-10T00:00:00Z' });
      return { data: { payment: { ...p }, reused } };
    }
    throw new Error(`Unexpected RPC: ${name}`);
  });
}

describe('actual provider authorization proof', () => {
  test('exact manual hold is persisted before returning authorized', async () => {
    const result = await service.verifyGigAuthorization('pay', terms);
    expect(result.payment_status).toBe('authorized');
    const charge = await mockCharge.mock.results[0].value;
    expect(getTable('Payment')[0].authorization_expires_at).toBe(new Date(charge.payment_method_details.card.capture_before*1000).toISOString());
  });
  test.each([
    { payer_id: 'foreign' }, { payee_id: 'foreign' }, { gig_id: 'foreign' }, { amount_total: 1000 },
    { currency: 'EUR' }, { payment_type: 'tip' }, { refunded_amount: 50 }, { stripe_customer_id: null },
  ])('local terms reject %j before provider access', async (patch) => {
    seedTable('Payment', [payment(patch)]);
    await expect(service.verifyGigAuthorization('pay', terms)).rejects.toMatchObject({ statusCode: 409 });
    expect(mockRetrieve).not.toHaveBeenCalled();
  });
  test.each([
    { status: 'requires_payment_method' }, { status: 'canceled' }, { status: 'succeeded' },
    { capture_method: 'automatic' }, { amount: 1249 }, { amount_capturable: 1200 }, { currency: 'eur' },
    { customer: 'cus_foreign' }, { id: 'pi_other' }, { metadata: { payer_id: 'foreign' } },
  ])('provider terms reject %j without persisting authorization', async (patch) => {
    mockRetrieve.mockResolvedValue(intent(patch));
    await expect(service.verifyGigAuthorization('pay', terms)).rejects.toMatchObject({ statusCode: 409 });
    expect(getTable('Payment')[0].payment_status).toBe('authorize_pending');
  });
  test('missing payment fails closed', async () => {
    seedTable('Payment', []);
    await expect(service.verifyGigAuthorization('pay', terms)).rejects.toThrow('could not be verified');
  });
  test('lost local authorization write never returns authorized', async () => {
    const from = db.from.bind(db);
    jest.spyOn(db, 'from').mockImplementation((table) => {
      const query = from(table);
      if (table === 'Payment') query.update = () => { throw new Error('write unavailable'); };
      return query;
    });
    await expect(service.verifyGigAuthorization('pay', terms)).rejects.toThrow('write unavailable');
    expect(getTable('Payment')[0].payment_status).toBe('authorize_pending');
  });
});

describe('durable acceptance orchestration', () => {
  test('reservation failure occurs before any provider creation', async () => {
    setRpcMock(async () => ({ error: { code: '08006' } }));
    await expect(acceptance.begin(gig, bid)).rejects.toMatchObject({ statusCode: 503 });
    expect(mockCreate).not.toHaveBeenCalled();
  });
  test('provider unknown outcome retries the same durable operation', async () => {
    seedTable('Payment', []);
    setRpcMock(async (name) => ({ data: name === 'verify_paid_gig_actor' ? { allowed: true } : { attempt: { ...attempt } } }));
    const create = jest.spyOn(service, 'createPaymentIntentForGig')
      .mockRejectedValueOnce(new Error('response lost'))
      .mockImplementation(async () => { seedTable('Payment', [payment()]); return { paymentId: 'pay', payment: payment(), clientSecret: 'secret' }; });
    await expect(acceptance.begin(gig, bid)).rejects.toThrow('response lost');
    await acceptance.begin(gig, bid);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0]).toEqual(create.mock.calls[1][0]);
    expect(create.mock.calls[1][0].idempotencyKey).toBe('gig-accept:attempt');
  });
  test('known payment resumes its same intent and never recreates it', async () => {
    setRpcMock(async (name) => ({ data: name === 'verify_paid_gig_actor' ? { allowed: true } : { attempt: { ...attempt, payment_id: 'pay' } } }));
    mockRetrieve.mockResolvedValue(intent({ client_secret: 'secret' }));
    expect((await acceptance.begin(gig, bid)).paymentId).toBe('pay');
    expect(mockCreate).not.toHaveBeenCalled();
  });
  test('old unknown outcome cannot create a second intent after retention uncertainty', async () => {
    seedTable('Payment', []);
    setRpcMock(async () => ({ data: { attempt: { ...attempt, created_at: '2020-01-01T00:00:00Z' } } }));
    await expect(acceptance.begin(gig, bid)).rejects.toThrow('reconciliation');
    expect(mockCreate).not.toHaveBeenCalled();
  });
  test('old saved payment with a lost bind response recovers without another creation', async () => {
    const rpc = jest.fn(async () => ({ data: { attempt: { ...attempt, created_at: '2020-01-01T00:00:00Z' } } }));
    setRpcMock(rpc); mockRetrieve.mockResolvedValue(intent({ client_secret: 'secret' }));
    expect((await acceptance.begin(gig, bid)).paymentId).toBe('pay');
    expect(mockCreate).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenLastCalledWith('bind_paid_gig_acceptance_as_actor', { p_attempt_id: 'attempt', p_payment_id: 'pay', p_actor_id: 'payer' });
  });
  test('finalize RPC runs only after exact authorization is durable', async () => {
    const rpc = jest.fn(async () => {
      expect(getTable('Payment')[0].payment_status).toBe('authorized');
      return { data: { gig: { ...gig, status: 'assigned' }, bid: { ...bid, status: 'accepted' } } };
    });
    setRpcMock(rpc);
    await acceptance.finalize(gig, bid);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  test('SDK success without a hold cannot assign the gig', async () => {
    const rpc = jest.fn(); setRpcMock(rpc); mockRetrieve.mockResolvedValue(intent({ status: 'requires_action' }));
    await expect(acceptance.finalize(gig, bid)).rejects.toThrow('authorized');
    expect(rpc).not.toHaveBeenCalled();
  });
  test('missing pending payment cannot assign the gig', async () => {
    await expect(acceptance.finalize(gig, { ...bid, pending_payment_intent_id: null })).rejects.toThrow('no pending payment');
  });
});

describe('provider discovery and checkout readiness', () => {
  const recoverable = (patch = {}) => intent({ created: 1770000000,
    metadata: { ...intent().metadata, platform_fee: '188' }, ...patch });
  beforeEach(() => {
    seedTable('Payment', []);
    mockList.mockResolvedValue({ data: [recoverable()], has_more: false });
    mockRetrieve.mockResolvedValue(recoverable());
  });
  test('lost provider response discovers and saves the exact old intent without creation', async () => {
    const recovered = await service.recoverGigPayment({ ...attempt, created_at: '2020-01-01T00:00:00Z' });
    expect(recovered).toMatchObject({ stripe_payment_intent_id: 'pi_one', payer_id: 'payer', amount_total: 1250,
      payment_status: 'authorized', amount_platform_fee: 188, amount_to_payee: 1062 });
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_payer', limit: 100 }));
    expect(mockCreate).not.toHaveBeenCalled();
  });
  test('all customer pages are checked before choosing a sole exact candidate', async () => {
    mockList.mockResolvedValueOnce({ data: [{ id: 'unrelated', metadata: {} }], has_more: true })
      .mockResolvedValueOnce({ data: [recoverable()], has_more: false });
    await service.recoverGigPayment(attempt);
    expect(mockList.mock.calls[1][0].starting_after).toBe('unrelated');
    expect(mockRetrieve).toHaveBeenCalledWith('pi_one');
  });
  test('multiple matching intents block recovery before persisting a winner', async () => {
    mockList.mockResolvedValue({ data: [recoverable(), recoverable({ id: 'pi_two' })], has_more: false });
    await expect(service.recoverGigPayment(attempt)).rejects.toThrow('Multiple');
    expect(getTable('Payment')).toEqual([]); expect(mockCreate).not.toHaveBeenCalled();
  });
  test('incomplete pagination cannot authorize an absence-based retry', async () => {
    mockList.mockResolvedValue({ data: [], has_more: true });
    await expect(service.recoverGigPayment(attempt)).rejects.toThrow('incomplete');
    expect(getTable('Payment')).toEqual([]);
  });
  test.each([
    { amount: 1300 }, { customer: 'cus_other' }, { capture_method: 'automatic' }, { currency: 'eur' },
    { status: 'succeeded' }, { amount_capturable: 500 },
    { metadata: { ...intent().metadata, payee_id: 'other', platform_fee: '188' } },
    { metadata: { ...intent().metadata, platform_fee: '1500' } },
    { metadata: { ...intent().metadata, platform_fee: 'NaN' } },
  ])('mismatched or unproven candidate is never persisted: %j', async (patch) => {
    mockRetrieve.mockResolvedValue(recoverable(patch));
    await expect(service.recoverGigPayment(attempt)).rejects.toMatchObject({ statusCode: 409 });
    expect(getTable('Payment')).toEqual([]); expect(mockCreate).not.toHaveBeenCalled();
  });
  test('provider lookup failure never falls through to another creation', async () => {
    setRpcMock(async () => ({ data: { attempt, reused: true } }));
    mockList.mockRejectedValue(new Error('unavailable'));
    await expect(acceptance.begin(gig, bid)).rejects.toThrow('unavailable');
    expect(mockCreate).not.toHaveBeenCalled();
  });
  test('complete list absence still cannot create after the conservative retry window', async () => {
    setRpcMock(async () => ({ data: { attempt: { ...attempt, created_at: '2020-01-01T00:00:00Z' }, reused: true } }));
    mockList.mockResolvedValue({ data: [], has_more: false });
    await expect(acceptance.begin(gig, bid)).rejects.toThrow('reconciliation');
    expect(mockCreate).not.toHaveBeenCalled();
  });
  test('requires_capture returns durable ready terms without a client secret', async () => {
    seedTable('Payment', [payment()]);
    const result = await service.resumeGigPayment('pay', terms);
    expect(result).toMatchObject({ authorizationReady: true, paymentStatus: 'authorized',
      providerStatus: 'requires_capture', amountCents: 1250, currency: 'usd', clientSecret: null });
  });
  test('unconfirmed intent returns the same sheet and exact amount', async () => {
    seedTable('Payment', [payment()]);
    mockRetrieve.mockResolvedValue(recoverable({ status: 'requires_payment_method', client_secret: 'synthetic_secret' }));
    expect(await service.resumeGigPayment('pay', terms)).toMatchObject({ authorizationReady: false,
      amountCents: 1250, currency: 'usd', clientSecret: 'synthetic_secret', paymentStatus: 'authorize_pending' });
  });
  test('revocation during provider read prevents returning a saved-card secret', async () => {
    seedTable('Payment', [payment()]);
    setRpcMock(async (name) => ({ data: name === 'verify_paid_gig_actor' ? { error: 'FORBIDDEN' }
      : { attempt: { ...attempt, payment_id: 'pay' } } }));
    mockRetrieve.mockResolvedValue(recoverable({ status: 'requires_payment_method', client_secret: 'synthetic_secret' }));
    await expect(acceptance.begin(gig, bid, 'delegate')).rejects.toMatchObject({ statusCode: 403 });
  });
  test('a legacy service retry cannot replace a durable acceptance payment', async () => {
    seedTable('Payment', [payment()]);
    await expect(service.createPaymentIntentForGig({ payerId: 'payer', payeeId: 'worker', gigId: 'gig',
      amount: 1250, existingPaymentId: 'pay' })).rejects.toThrow('Recover the existing');
    expect(mockCreate).not.toHaveBeenCalled();
  });
  test('aborting a lost create response discovers and binds before cancellation', async () => {
    seedTable('GigPaymentAcceptance', [{ ...attempt, payment_id: null }]);
    const cancel = jest.spyOn(service, 'cancelAuthorization').mockResolvedValue({ success: true });
    const rpc = jest.fn(async (name, args) => {
      if (name === 'verify_paid_gig_actor') return { data: { allowed: true } };
      if (name === 'bind_paid_gig_acceptance_as_actor') {
        getTable('GigPaymentAcceptance')[0].payment_id = args.p_payment_id;
        return { data: { attempt: getTable('GigPaymentAcceptance')[0] } };
      }
      if (name === 'cancel_paid_gig_acceptance_as_actor') return { data: args.p_complete ? { bid: { ...bid, status: 'pending' } }
        : { attempt: getTable('GigPaymentAcceptance')[0] } };
      throw new Error('Unexpected RPC');
    });
    setRpcMock(rpc);
    await acceptance.abort(gig, bid);
    expect(cancel).toHaveBeenCalledWith(getTable('Payment')[0].id);
    expect(mockCreate).not.toHaveBeenCalled();
  });
  test('an unbound unknown abort retains the operation when no provider proof exists', async () => {
    seedTable('GigPaymentAcceptance', [{ ...attempt, payment_id: null }]);
    mockList.mockResolvedValue({ data: [], has_more: false });
    setRpcMock(async () => ({ data: { allowed: true } }));
    await expect(acceptance.abort(gig, bid)).rejects.toThrow('still unknown');
    expect(mockCancel).not.toHaveBeenCalled(); expect(mockCreate).not.toHaveBeenCalled();
    expect(getTable('GigPaymentAcceptance')[0].state).toBe('initializing');
  });
  test.each([true, false])('background recovery only binds discovered objects; found=%s', async (found) => {
    seedTable('GigPaymentAcceptance', [{ ...attempt, payment_id: null,
      created_at: '2020-01-01T00:00:00Z', recovery_after: '2020-01-01T00:00:00Z' }]);
    mockList.mockResolvedValue({ data: found ? [recoverable()] : [], has_more: false });
    setRpcMock(async () => ({ data: { attempt: { ...attempt, payment_id: 'recovered' } } }));
    const job = require('../jobs/reconcileGigAcceptance');
    expect(await job()).toEqual({ recovered: found ? 1 : 0 });
    expect(mockCreate).not.toHaveBeenCalled(); expect(mockCancel).not.toHaveBeenCalled();
    expect(getTable('GigPaymentAcceptance')[0].state).toBe('initializing'); // job RPC stub never assigns
    if (!found) expect(getTable('GigPaymentAcceptance')[0].recovery_error).toBe('provider_outcome_unresolved');
  });
});

describe('capture proof and retry', () => {
  beforeEach(() => seedTable('Payment', [payment({ payment_status: 'authorized' })]));
  test('capture uses a stable key and confirms only a durable matching receipt', async () => {
    captureRpc();
    expect((await service.capturePayment('pay', terms)).success).toBe(true);
    expect(mockCapture).toHaveBeenCalledWith('pi_one', {}, { idempotencyKey: 'gig-capture:pay:pi_one' });
    expect(getTable('Payment')[0].payment_status).toBe('captured_hold');
  });
  test('provider success with lost response reconciles one capture', async () => {
    captureRpc(); mockCapture.mockRejectedValue(new Error('socket closed'));
    mockRetrieve.mockResolvedValueOnce(intent()).mockResolvedValueOnce(captured());
    expect((await service.capturePayment('pay', terms)).success).toBe(true);
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });
  test('provider success followed by DB failure is safely retried without recapture', async () => {
    captureRpc({ failReceipt: true });
    await expect(service.capturePayment('pay', terms)).rejects.toThrow('awaiting local confirmation');
    expect(getTable('Payment')[0].payment_status).toBe('capture_pending');
    captureRpc(); mockRetrieve.mockResolvedValue(captured());
    await service.capturePayment('pay', terms);
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });
  test('repeat confirmed capture returns its existing receipt', async () => {
    captureRpc(); await service.capturePayment('pay', terms); mockRetrieve.mockResolvedValue(captured());
    expect((await service.capturePayment('pay', terms)).alreadyCaptured).toBe(true);
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });
  test.each([
    { status: 'canceled' }, { status: 'requires_action' }, { amount_received: 1200 },
    { customer: 'cus_foreign' }, { latest_charge: null },
    { latest_charge: { id: 'ch_one', payment_intent: 'pi_one', paid: true, captured: false, amount: 1250 } },
  ])('unexpected provider state cannot be mislabeled captured: %j', async (patch) => {
    captureRpc(); mockCapture.mockRejectedValue(Object.assign(new Error('unexpected'), { code: 'payment_intent_unexpected_state' }));
    mockRetrieve.mockResolvedValueOnce(intent()).mockResolvedValueOnce(captured(patch));
    await expect(service.capturePayment('pay', terms)).rejects.toThrow();
    expect(getTable('Payment')[0].payment_status).toBe('capture_pending');
  });
  test('exhausted attempt cap still allows exact success reconciliation', async () => {
    getTable('Payment')[0].capture_attempts = 5; captureRpc(); mockRetrieve.mockResolvedValue(captured());
    await service.capturePayment('pay', terms);
    expect(mockCapture).not.toHaveBeenCalled(); expect(getTable('Payment')[0].payment_status).toBe('captured_hold');
  });
  test('exhausted attempt cap blocks a new provider capture', async () => {
    setRpcMock(async () => ({ data: { error: 'CAPTURE_NOT_READY' } }));
    await expect(service.capturePayment('pay', terms)).rejects.toThrow('could not be prepared');
    expect(mockCapture).not.toHaveBeenCalled();
  });
  test('mismatched payer/gig cannot capture even an authorized row', async () => {
    await expect(service.capturePayment('pay', { ...terms, payerId: 'foreign' })).rejects.toThrow('match');
    expect(mockCapture).not.toHaveBeenCalled();
  });
});

describe('cancellation proof', () => {
  test('unknown cancellation preserves local authorization for recovery', async () => {
    mockCancel.mockRejectedValue(new Error('unknown outcome'));
    await expect(service.cancelAuthorization('pay')).rejects.toThrow('unknown outcome');
    expect(getTable('Payment')[0].payment_status).toBe('authorize_pending');
  });
  test('lost cancel response with retrieved cancellation safely persists receipt', async () => {
    mockCancel.mockRejectedValue(new Error('unknown outcome'));
    mockRetrieve.mockResolvedValueOnce(intent()).mockResolvedValueOnce(intent({ status: 'canceled' }));
    await service.cancelAuthorization('pay');
    expect(getTable('Payment')[0].payment_status).toBe('canceled');
  });
  test('failed cancel cannot clear the bid operation', async () => {
    const rpc = jest.fn(async () => ({ data: { attempt: { ...attempt, payment_id: 'pay', state: 'canceling' } } }));
    setRpcMock(rpc); mockCancel.mockRejectedValue(new Error('timeout'));
    await expect(acceptance.abort(gig, bid)).rejects.toThrow('timeout');
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});


describe('expiration preserves durable checkout recovery', () => {
  const expire = require('../jobs/expirePendingPaymentBids');
  beforeEach(() => seedTable('GigBid', [{ id: 'bid', status: 'pending_payment', pending_payment_intent_id: 'pay', pending_payment_expires_at: '2020-01-01T00:00:00Z' }]));
  test('timer cannot discard a new checkout operation or its completed hold', async () => {
    seedTable('GigPaymentAcceptance', [{ id: 'attempt', bid_id: 'bid', state: 'pending' }]);
    await expire();
    expect(getTable('GigBid')[0].pending_payment_intent_id).toBe('pay');
    expect(mockCancel).not.toHaveBeenCalled(); expect(mockRetrieve).not.toHaveBeenCalled();
  });
  test('legacy unknown cancellation retains its exact payment reference', async () => {
    mockCancel.mockRejectedValue(new Error('timeout'));
    await expire();
    expect(getTable('GigBid')[0].status).toBe('pending_payment');
    expect(getTable('GigBid')[0].pending_payment_intent_id).toBe('pay');
  });
});
