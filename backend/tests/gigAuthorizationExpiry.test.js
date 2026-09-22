const mockStripe = { paymentIntents: { retrieve: jest.fn(), cancel: jest.fn() }, charges: { retrieve: jest.fn() } };
jest.mock('../stripe/getStripeClient', () => ({ getStripeClient: () => mockStripe }));
const path = require('node:path');
const db = require('./__mocks__/supabaseAdmin');
const notifications = require('./__mocks__/notificationService');
const push = require('./__mocks__/pushService');
const notify = require(path.resolve(__dirname, '../services/notificationService.js'));
const expiry = require('../services/gigAuthorizationExpiry');
const payment = { id: 'payment', gig_id: 'gig', payer_id: 'payer', payee_id: 'worker', amount_total: 1000,
 currency: 'USD', stripe_customer_id: 'cus_expiry', stripe_payment_intent_id: 'pi_expiry', metadata: {} };
let intent; let charge; let data; let handler;
const rpc = jest.fn(async (name, args) => handler(name, args));
beforeEach(() => {
 jest.clearAllMocks(); db.resetTables(); db.setRpcMock(rpc);
 intent = { id: 'pi_expiry', customer: 'cus_expiry', currency: 'usd', amount: 1000, capture_method: 'manual',
  status: 'requires_capture', amount_received: 0, amount_capturable: 1000, latest_charge: 'ch_expiry',
  metadata: { payer_id: 'payer', payee_id: 'worker', gig_id: 'gig' } };
 charge = { id: 'ch_expiry', payment_intent: intent.id, customer: intent.customer, amount: 1000, currency: 'usd',
  paid: true, captured: false, amount_captured: 0, refunded: false, amount_refunded: 0,
  payment_method_details: { type: 'card', card: { capture_before: Math.floor(Date.now() / 1000) + 3600 } } };
 data = { payment, expected: { frozen: 'terms' }, gig: { status: 'assigned' }, operation: null };
 mockStripe.paymentIntents.retrieve.mockImplementation(async () => structuredClone(intent));
 mockStripe.charges.retrieve.mockImplementation(async () => structuredClone(charge));
 mockStripe.paymentIntents.cancel.mockImplementation(async () => { intent.status = 'canceled'; intent.amount_capturable = 0; return structuredClone(intent); });
 handler = async name => {
  if (name === 'read_gig_authorization_expiry') return { data };
  if (name === 'begin_gig_authorization_expiry') { data.operation = { id: 'operation', intent_id: intent.id, state: 'pending', kind: 'cancel' }; return { data }; }
  if (name === 'claim_gig_authorization_expiry') { data.operation.lease_id = 'lease'; return { data }; }
  if (name === 'record_gig_authorization_expiry') return { data: { complete: true, operation: { id: 'operation', state: 'complete' } } };
  if (name === 'release_gig_expiry_lease') return { data: true };
  throw new Error(`Unexpected RPC ${name}`);
 };
});
test.each([['customer', 'cus_foreign'], ['payment_intent', 'pi_foreign'], ['amount', 999], ['currency', 'eur'],
 ['captured', true], ['amount_captured', 1], ['amount_refunded', 1], ['refunded', true], ['paid', false]])(
 'foreign/captured/refunded Charge %s cannot admit cancellation', async (key, value) => {
 charge[key] = value; await expect(expiry.recover('payment')).rejects.toMatchObject({ statusCode: 409 });
 expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled();
 expect(rpc).not.toHaveBeenCalledWith('begin_gig_authorization_expiry', expect.anything());
});
test.each(['succeeded', 'processing', 'requires_action'])('%s provider state never cancels a Gig', async status => {
 intent.status = status; await expect(expiry.recover('payment')).rejects.toMatchObject({ statusCode: 409 });
 expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled();
});
test('missing zero-capture proof is unknown, not a no-charge claim', async () => {
 delete intent.amount_received; await expect(expiry.recover('payment')).rejects.toThrow();
 expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled();
});
test('future actual provider deadline overrides an old guessed local date', async () => {
 charge.payment_method_details.card.capture_before += 172800;
 const base = handler; handler = async (name, args) => name === 'begin_gig_authorization_expiry' ? { data: { notDue: true } } : base(name, args);
 await expect(expiry.recover('payment')).resolves.toEqual({ notDue: true });
 expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled();
});
test('exact assigned authorization uses one stable provider key and fresh zero-charge proof', async () => {
 await expect(expiry.recover('payment')).resolves.toMatchObject({ complete: true });
 expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_expiry', { cancellation_reason: 'abandoned' }, { idempotencyKey: 'gig-expiry:operation:pi_expiry' });
 expect(rpc).toHaveBeenCalledWith('begin_gig_authorization_expiry', expect.objectContaining({ p_expected: { frozen: 'terms' } }));
 expect(rpc).toHaveBeenCalledWith('record_gig_authorization_expiry', expect.objectContaining({ p_expiry_id: 'operation', p_proof: expect.objectContaining({ status: 'canceled', amount_received: 0, amount_captured: 0 }) }));
 expect(mockStripe.charges.retrieve).toHaveBeenCalledTimes(3);
});
test('provider auto-expiry reconciles without another cancel request', async () => {
 intent.status = 'canceled'; intent.amount_capturable = 0; charge.payment_method_details.card.capture_before -= 7200;
 await expect(expiry.recover('payment')).resolves.toMatchObject({ complete: true });
 expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled();
});
test('in-progress attention never mutates provider authorization', async () => {
 const base = handler; handler = async (name, args) => name === 'begin_gig_authorization_expiry'
  ? { data: { operation: { state: 'complete', kind: 'attention' } } } : base(name, args);
 await expect(expiry.recover('payment')).resolves.toMatchObject({ operation: { kind: 'attention' } });
 expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled();
});
test('lost provider response recovers its already canceled exact intent', async () => {
 mockStripe.paymentIntents.cancel.mockImplementation(async () => { intent.status = 'canceled'; intent.amount_capturable = 0; throw new Error('Lost response'); });
 await expect(expiry.recover('payment')).resolves.toMatchObject({ complete: true });
 expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledTimes(1);
});
test('failed cancellation retains operation, releases only its lease and never records terminal proof', async () => {
 mockStripe.paymentIntents.cancel.mockRejectedValue(new Error('Offline'));
 await expect(expiry.recover('payment')).rejects.toMatchObject({ code: 'EXPIRY_PROVIDER_UNKNOWN' });
 expect(rpc).toHaveBeenCalledWith('release_gig_expiry_lease', { p_id: 'operation', p_lease_id: 'lease', p_error: 'RECONCILIATION_REQUIRED' });
 expect(rpc).not.toHaveBeenCalledWith('record_gig_authorization_expiry', expect.anything());
});
test('capture during cancellation prevents false zero-charge receipt', async () => {
 mockStripe.paymentIntents.cancel.mockImplementation(async () => { charge.captured = true; charge.amount_captured = 1000; intent.status = 'succeeded'; intent.amount_received = 1000; });
 await expect(expiry.recover('payment')).rejects.toMatchObject({ statusCode: 409 });
 expect(rpc).not.toHaveBeenCalledWith('record_gig_authorization_expiry', expect.anything());
});
test('locked current-state rejection precedes any provider cancellation', async () => {
 const base = handler; handler = async (name, args) => name === 'claim_gig_authorization_expiry' ? { data: { error: 'PAYMENT_CHANGED' } } : base(name, args);
 await expect(expiry.recover('payment')).rejects.toMatchObject({ code: 'EXPIRY_PAYMENT_CHANGED' });
 expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled();
});
test('lost database acknowledgement recovers terminal provider evidence without canceling again', async () => {
 const base = handler; let lost = true;
 handler = async (name, args) => { if (name === 'record_gig_authorization_expiry' && lost) { lost = false; return { error: {} }; } return base(name, args); };
 await expect(expiry.recover('payment')).rejects.toMatchObject({ code: 'EXPIRY_RECEIPT_UNKNOWN' });
 await expect(expiry.recover('payment')).resolves.toMatchObject({ complete: true });
 expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledTimes(1);
});
describe('expiry notification receipt delivery', () => {
 const note = { id: 'note', user_id: 'worker', type: 'gig_auto_cancelled', title: 'Task cancelled', body: 'Verified release', link: '/gigs/gig', metadata: { gig_id: 'gig' } };
 function delivery({ eligible = true, ack = true } = {}) {
  let claimed = false;
  handler = async name => {
   if (name === 'claim_gig_expiry_delivery') { if (claimed) return { data: null }; claimed = true; return { data: { id: 'event', lease_id: 'lease' } }; }
   if (name === 'read_gig_expiry_delivery') return { data: { eligible, notification: note } };
   if (name === 'finish_gig_expiry_delivery') return { data: ack };
   throw new Error('Unexpected delivery RPC');
  };
 }
 test.each(['gig_auto_cancelled', 'payment_auth_expiring'])('%s follows stored ID and current global/gig preferences', async type => {
  db.seedTable('Notification', [{ ...note, type }]); db.seedTable('MailPreferences', [{ user_id: 'worker', push_notifications: true }]);
  push.sendToUserWithReceipt.mockResolvedValue({ acceptedCount: 1, unresolvedCount: 0 });
  await expect(notify.deliverStoredGigNotification({ ...note, type })).resolves.toMatchObject({ suppressed: false });
  expect(push.sendToUserWithReceipt).toHaveBeenCalledWith('worker', expect.objectContaining({ data: expect.objectContaining({ notificationId: 'note', type }) }));
  db.seedTable('UserNotificationPreferences', [{ user_id: 'worker', gig_updates_enabled: false }]);
  await expect(notify.deliverStoredGigNotification({ ...note, type })).resolves.toMatchObject({ suppressed: true });
  db.seedTable('UserNotificationPreferences', [{ user_id: 'worker', gig_updates_enabled: true }]);
  db.seedTable('MailPreferences', [{ user_id: 'worker', push_notifications: false }]);
  await expect(notify.deliverStoredGigNotification({ ...note, type })).resolves.toMatchObject({ suppressed: true });
  expect(push.sendToUserWithReceipt).toHaveBeenCalledTimes(1); expect(db.getTable('Notification')).toHaveLength(1);
 });
 test('retired context suppresses delivery without transport', async () => {
  delivery({ eligible: false }); await expect(expiry.deliverPending()).resolves.toEqual({ delivered: 0 });
  expect(notifications.deliverStoredGigNotification).not.toHaveBeenCalled();
 });
 test.each([{}, { acceptedCount: 1 }, { acceptedCount: 1, unresolvedCount: 1 }, { acceptedCount: 0, unresolvedCount: -1 }])('unknown transport retains durable event: %j', async receipt => {
  delivery(); notifications.deliverStoredGigNotification.mockResolvedValue(receipt);
  await expect(expiry.deliverPending()).resolves.toEqual({ delivered: 0 });
  expect(rpc).toHaveBeenCalledWith('finish_gig_expiry_delivery', expect.objectContaining({ p_id: 'event', p_lease_id: 'lease', p_outcome: 'retry' }));
 });
 test('lost delivery acknowledgement does not claim completion', async () => {
  delivery({ ack: false }); notifications.deliverStoredGigNotification.mockResolvedValue({ acceptedCount: 1, unresolvedCount: 0 });
  await expect(expiry.deliverPending()).rejects.toThrow('acknowledgement changed');
 });
});

test('cold unknown outcome after a dispute can read and retain terminal evidence but cannot send another provider request', async () => {
 data.reviewOnly = true; data.operation = { id: 'operation', state: 'pending' };
 await expect(expiry.recover('payment')).resolves.toMatchObject({ pending: true, needsReview: true });
 expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled();
 intent.status = 'canceled'; intent.amount_capturable = 0;
 const base = handler; handler = async (name, args) => name === 'record_gig_authorization_expiry'
  ? { data: { pending: true, needsReview: true, operation: { provider_receipt: { status: 'canceled' } } } } : base(name, args);
 await expect(expiry.recover('payment')).resolves.toMatchObject({ pending: true, needsReview: true });
 expect(rpc).toHaveBeenCalledWith('record_gig_authorization_expiry', expect.objectContaining({ p_expiry_id: 'operation' }));
 expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled();
});

test('current observed provider cancellation keeps refund fields false/zero', async () => {
 intent.status = 'canceled'; intent.amount_capturable = 0;
 await expect(expiry.readProof(payment)).resolves.toMatchObject({ status: 'canceled', amount_received: 0,
  amount_captured: 0, charge_refunded: false, charge_amount_refunded: 0 });
});
test('older full authorization reversal is accepted only with proven zero actual capture', async () => {
 intent.status = 'canceled'; intent.amount_capturable = 0; charge.refunded = true; charge.amount_refunded = 1000;
 await expect(expiry.readProof(payment)).resolves.toMatchObject({ charge_refunded: true, charge_amount_refunded: 1000, amount_captured: 0 });
 charge.amount_captured = null; await expect(expiry.readProof(payment)).rejects.toThrow();
 charge.amount_captured = 0; charge.amount_refunded = 999; await expect(expiry.readProof(payment)).rejects.toThrow();
 charge.amount_refunded = 1000; charge.captured = true; await expect(expiry.readProof(payment)).rejects.toThrow();
});
