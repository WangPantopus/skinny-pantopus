const mockStripe = { paymentIntents: { retrieve: jest.fn(), cancel: jest.fn() }, charges: { retrieve: jest.fn() } };
jest.mock('../stripe/getStripeClient', () => ({ getStripeClient: () => mockStripe }));
jest.mock('../services/paymentRefundService', () => ({ create: jest.fn(), reconcile: jest.fn() }));
const db = require('./__mocks__/supabaseAdmin');
const refunds = require('../services/paymentRefundService');
const stop = require('../services/gigStopService');
const notifications = require('./__mocks__/notificationService');
const payment = { id: 'payment', gig_id: 'gig', payer_id: 'payer', payee_id: 'worker', amount_total: 1000,
  currency: 'USD', stripe_customer_id: 'cus_stop', stripe_payment_intent_id: 'pi_stop', metadata: {} };
const command = { gigId: 'gig', actorId: 'payer', sessionScope: 'a'.repeat(64), requestId: 'operation', action: 'cancel', expectedTerms: { amountCents: 1000 } };
let data, intent, charge, handler;
const rpc = jest.fn(async (name, args) => handler(name, args));
beforeEach(() => {
  jest.clearAllMocks(); db.resetTables(); db.setRpcMock(rpc);
  data = { request: { id: 'operation', gig_id: 'gig', payment_id: 'payment', actor_id: 'payer', terms: command.expectedTerms,
    action: 'cancel', financial_action: 'release', state: 'pending' }, payment, canRetry: true };
  intent = { id: 'pi_stop', customer: 'cus_stop', amount: 1000, currency: 'usd', capture_method: 'manual', status: 'requires_capture',
    amount_received: 0, amount_capturable: 1000, latest_charge: 'ch_stop', metadata: { payer_id: 'payer', payee_id: 'worker', gig_id: 'gig' } };
  charge = { id: 'ch_stop', customer: 'cus_stop', payment_intent: 'pi_stop', amount: 1000, currency: 'usd', paid: true,
    captured: false, amount_captured: 0, refunded: false, amount_refunded: 0 };
  mockStripe.paymentIntents.retrieve.mockImplementation(async () => structuredClone(intent));
  mockStripe.charges.retrieve.mockImplementation(async () => structuredClone(charge));
  mockStripe.paymentIntents.cancel.mockImplementation(async () => { intent.status = 'canceled'; intent.amount_capturable = 0; return structuredClone(intent); });
  handler = async name => {
    if (['begin_gig_stop', 'read_gig_stop_request', 'check_gig_stop_current'].includes(name)) return { data };
    if (name === 'claim_gig_stop') { data.request.lease_id = 'lease'; return { data }; }
    if (name === 'record_gig_stop_evidence' || name === 'release_gig_stop_lease') return { data: true };
    if (name === 'finish_gig_stop') { data.request.state = 'completed'; data.request.receipt = { requestId: 'operation', financialStatus: 'released' }; return { data }; }
    throw new Error(`Unexpected ${name}`);
  };
});
test('exact hold release uses one durable original request and a fresh zero-capture receipt', async () => {
  expect(await stop.execute(command)).toMatchObject({ requestId: 'operation', status: 'completed', financialStatus: 'released', canRetry: false });
  expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_stop', { cancellation_reason: 'requested_by_customer' }, { idempotencyKey: 'gig-stop:operation:pi_stop' });
  expect(rpc).toHaveBeenCalledWith('record_gig_stop_evidence', expect.objectContaining({ p_proof: expect.objectContaining({ status: 'canceled', amount_received: 0, amount_captured: 0 }) }));
  expect(mockStripe.charges.retrieve).toHaveBeenCalledTimes(2);
});
test.each([['customer', 'cus_foreign'], ['payment_intent', 'pi_foreign'], ['amount', 900], ['currency', 'eur'],
  ['captured', true], ['amount_captured', 1], ['amount_captured', null], ['refunded', true]])('invalid Charge %s leaves the original task pending', async (key, value) => {
  charge[key] = value;
  expect(await stop.execute(command)).toMatchObject({ status: 'pending', financialStatus: 'release_pending', receipt: null });
  expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalledWith('finish_gig_stop', expect.anything());
});
test.each(['processing', 'succeeded'])('%s intent cannot be labeled released', async status => {
  intent.status = status; expect(await stop.execute(command)).toMatchObject({ status: 'pending' });
  expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled();
});
test('current payer/worker/amount intent metadata binding precedes cancellation', async () => {
  intent.metadata.payee_id = 'other'; expect(await stop.execute(command)).toMatchObject({ status: 'pending' });
  expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled();
});
test('provider offline retains the operation and no terminal receipt or notice is created', async () => {
  mockStripe.paymentIntents.cancel.mockRejectedValue(new Error('Offline'));
  expect(await stop.execute(command)).toMatchObject({ status: 'pending', receipt: null, canRetry: true });
  expect(rpc).toHaveBeenCalledWith('release_gig_stop_lease', expect.objectContaining({ p_request_id: 'operation', p_lease_id: 'lease' }));
  expect(rpc).not.toHaveBeenCalledWith('finish_gig_stop', expect.anything());
});
test('lost provider response is recovered from the same canceled intent without creating a refund', async () => {
  mockStripe.paymentIntents.cancel.mockImplementation(async () => { intent.status = 'canceled'; intent.amount_capturable = 0; throw new Error('Lost response'); });
  expect(await stop.execute(command)).toMatchObject({ status: 'completed' }); expect(refunds.create).not.toHaveBeenCalled();
});
test('lost final database response returns the saved receipt on the next read', async () => {
  const base = handler; handler = async (name, args) => {
    const result = await base(name, args); return name === 'finish_gig_stop' ? { error: {} } : result;
  };
  expect(await stop.execute(command)).toMatchObject({ status: 'completed' });
  expect(await stop.execute(command)).toMatchObject({ status: 'completed' }); expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledTimes(1);
});
test('current actor revocation at the locked lease prevents provider mutation', async () => {
  const base = handler; handler = async (name, args) => name === 'claim_gig_stop' ? { data: { error: 'FORBIDDEN' } } : base(name, args);
  await expect(stop.execute(command)).rejects.toMatchObject({ statusCode: 403 }); expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled();
});
test('dispute while canceling retains exact provider evidence without a task-completion claim', async () => {
  const base = handler; handler = async (name, args) => name === 'finish_gig_stop' ? { data: { error: 'DISPUTED' } } : base(name, args);
  expect(await stop.execute(command)).toMatchObject({ status: 'pending', receipt: null });
  expect(rpc).toHaveBeenCalledWith('record_gig_stop_evidence', expect.anything());
});
test('cold terminal provider cancellation requires no new provider mutation', async () => {
  intent.status = 'canceled'; intent.amount_capturable = 0;
  expect(await stop.execute(command)).toMatchObject({ status: 'completed' }); expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled();
});
test.each(['requires_action', 'requires_payment_method', 'requires_confirmation'])('uncaptured %s with no Charge releases the exact existing intent', async status => {
  intent.status = status; intent.latest_charge = null; intent.amount_capturable = 0;
  expect(await stop.execute(command)).toMatchObject({ status: 'completed' }); expect(mockStripe.charges.retrieve).not.toHaveBeenCalled();
});
test('legacy provider refund reporting on an uncaptured cancellation is accepted without claiming capture', async () => {
  intent.status = 'canceled'; intent.amount_capturable = 0; charge.refunded = true; charge.amount_refunded = 1000;
  expect(await stop.execute(command)).toMatchObject({ status: 'completed' }); expect(refunds.create).not.toHaveBeenCalled();
});
test('captured zero-fee stop uses the exact reserved policy refund and awaits its receipt', async () => {
  data.request.financial_action = 'refund';
  const base = handler; handler = async (name, args) => name === 'finish_gig_stop' ? { data } : base(name, args);
  refunds.create.mockResolvedValue({ success: false, refundRequest: { status: 'pending' } });
  expect(await stop.execute(command)).toMatchObject({ status: 'pending', financialStatus: 'refund_pending', receipt: null });
  expect(refunds.create).toHaveBeenCalledWith({ paymentId: 'payment', actorId: 'payer', actorMode: 'policy', requestId: 'operation', amount: null, reason: 'requested_by_customer', description: null });
  expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled();
});
test('read status never calls provider or retries a pending refund', async () => {
  data.request.financial_action = 'refund'; expect(await stop.readRequest(command)).toMatchObject({ status: 'pending' });
  expect(mockStripe.paymentIntents.retrieve).not.toHaveBeenCalled(); expect(refunds.create).not.toHaveBeenCalled();
});
test('different active request is disclosed only as STOP_ACTIVE', async () => {
  handler = async () => ({ data: { error: 'STOP_ACTIVE', requestId: 'other' } });
  await expect(stop.execute(command)).rejects.toMatchObject({ code: 'STOP_ACTIVE', activeRequestId: 'other' });
  expect(mockStripe.paymentIntents.retrieve).not.toHaveBeenCalled();
});
test('a fresh authorized session preserves the original request terms on explicit retry', async () => {
  expect(await stop.execute({ ...command, sessionScope: 'b'.repeat(64) })).toMatchObject({ requestId: 'operation' });
  expect(rpc).toHaveBeenCalledWith('begin_gig_stop', expect.objectContaining({ p_request_id: 'operation', p_session_scope: 'b'.repeat(64), p_expected: command.expectedTerms }));
});
test('a current denied retry returns local pending status without provider reads', async () => {
  data.canRetry = false; expect(await stop.execute(command)).toMatchObject({ status: 'pending', canRetry: false });
  expect(mockStripe.paymentIntents.retrieve).not.toHaveBeenCalled(); expect(refunds.create).not.toHaveBeenCalled();
});
test('background reconciliation records an existing canceled hold but never issues cancellation', async () => {
  intent.status = 'canceled'; intent.amount_capturable = 0;
  const base = handler; handler = async (name, args) => name === 'claim_gig_stop_reconciliation' ? { data: [{ id: 'operation', actor_id: 'payer' }] } : base(name, args);
  expect(await stop.reconcilePending()).toEqual({ checked: 1, completed: 1 });
  expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled(); expect(refunds.create).not.toHaveBeenCalled();
});
test('background reconciliation observes a pending refund without creating or retrying a provider refund', async () => {
  data.request.financial_action = 'refund';
  const base = handler; handler = async (name, args) => name === 'claim_gig_stop_reconciliation' ? { data: [{ id: 'operation', actor_id: 'payer' }] }
    : name === 'finish_gig_stop' ? { data } : base(name, args);
  expect(await stop.reconcilePending()).toEqual({ checked: 1, completed: 0 }); expect(refunds.reconcile).toHaveBeenCalledWith('payment');
  expect(refunds.create).not.toHaveBeenCalled(); expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled();
});
describe('durable stop notice relay', () => {
  function delivery(eligible = true) {
    let claimed = false;
    handler = async name => {
      if (name === 'claim_gig_stop_delivery') { if (claimed) return { data: null }; claimed = true; return { data: { id: 'event', lease_id: 'lease' } }; }
      if (name === 'read_gig_stop_delivery') return { data: { eligible, notification: { id: 'original-notice', type: 'gig_cancelled' } } };
      if (name === 'finish_gig_stop_delivery') return { data: true };
      throw new Error(`Unexpected ${name}`);
    };
  }
  test('revoked or replaced task context suppresses a stored notice without transport', async () => {
    delivery(false); expect(await stop.deliverPending()).toEqual({ delivered: 0 });
    expect(notifications.deliverStoredGigNotification).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('finish_gig_stop_delivery', expect.objectContaining({ p_outcome: 'suppressed' }));
  });
  test.each([{}, { acceptedCount: 1 }, { acceptedCount: -1, unresolvedCount: 0 }, { acceptedCount: 1, unresolvedCount: 1 }])('unknown transport receipt retains the original notice: %j', async receipt => {
    delivery(); notifications.deliverStoredGigNotification.mockResolvedValue(receipt);
    expect(await stop.deliverPending()).toEqual({ delivered: 0 });
    expect(rpc).toHaveBeenCalledWith('finish_gig_stop_delivery', expect.objectContaining({ p_id: 'event', p_lease_id: 'lease', p_outcome: 'retry' }));
  });
  test('exact transport receipt acknowledges the original stored identity', async () => {
    delivery(); notifications.deliverStoredGigNotification.mockResolvedValue({ acceptedCount: 1, unresolvedCount: 0 });
    expect(await stop.deliverPending()).toEqual({ delivered: 1 });
    expect(notifications.deliverStoredGigNotification).toHaveBeenCalledWith({ id: 'original-notice', type: 'gig_cancelled' });
  });
});
