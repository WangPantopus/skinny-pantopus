const { readGigAuthorizationDeadline, requireLiveAuthorization } = require('../stripe/gigAuthorizationDeadline');
const payment = { stripe_payment_intent_id: 'pi_one', stripe_customer_id: 'cus_one', amount_total: 2500,
  currency: 'USD', payer_id: 'payer', payee_id: 'worker', gig_id: 'gig' };
const deadline = () => Math.floor(Date.now() / 1000) + 3600;
const charge = (patch = {}) => ({ id: 'ch_one', payment_intent: 'pi_one', customer: 'cus_one',
  amount: 2500, currency: 'usd', paid: true, captured: false, refunded: false, amount_refunded: 0,
  payment_method_details: { type: 'card', card: { capture_before: deadline() } }, ...patch });
const intent = (patch = {}) => ({ id: 'pi_one', customer: 'cus_one', amount: 2500, currency: 'usd', capture_method: 'manual',
  status: 'requires_capture', amount_capturable: 2500, latest_charge: 'ch_one',
  metadata: { payer_id: 'payer', payee_id: 'worker', gig_id: 'gig' }, ...patch });
test('current exact charge deadline survives reconciliation without a guessed extra seven days', async () => {
  const actual = charge();
  const stripe = { charges: { retrieve: jest.fn().mockResolvedValue(actual) } };
  const result = await readGigAuthorizationDeadline(stripe, payment, intent());
  expect(result).toEqual({ chargeId: 'ch_one', captureBefore: actual.payment_method_details.card.capture_before,
    expiresAt: new Date(actual.payment_method_details.card.capture_before * 1000).toISOString() });
  expect(stripe.charges.retrieve).toHaveBeenCalledWith('ch_one');
  expect(requireLiveAuthorization(result)).toBe(result);
});
test('fresh expanded charge uses the same exact proof', async () => {
  const stripe = { charges: { retrieve: jest.fn() } };
  await expect(readGigAuthorizationDeadline(stripe, payment, intent({ latest_charge: charge() })))
    .resolves.toMatchObject({ chargeId: 'ch_one' });
  expect(stripe.charges.retrieve).not.toHaveBeenCalled();
});
test.each([
  { id: 'ch_foreign' }, { customer: 'cus_foreign' }, { payment_intent: 'pi_foreign' }, { amount: 2499 },
  { currency: 'eur' }, { paid: false }, { captured: true }, { amount_refunded: 1 }, { refunded: true },
  { payment_method_details: { type: 'card', card: {} } },
  { payment_method_details: { type: 'card', card: { capture_before: '1234' } } },
  { payment_method_details: { type: 'card', card: { capture_before: 253402300800 } } },
])('foreign or incomplete Charge cannot manufacture a valid deadline: %j', async patch => {
  const stripe = { charges: { retrieve: jest.fn().mockResolvedValue(charge(patch)) } };
  await expect(readGigAuthorizationDeadline(stripe, payment, intent())).rejects.toMatchObject({ statusCode: 409 });
});
test('expired verified proof remains readable for cancellation but cannot report authorization ready', async () => {
  const past = Math.floor(Date.now() / 1000) - 1;
  const result = await readGigAuthorizationDeadline({}, payment, intent({ latest_charge: charge({
    payment_method_details: { type: 'card', card: { capture_before: past } },
  }) }));
  expect(() => requireLiveAuthorization(result)).toThrow('expired');
});
test('provider failure preserves unknown status instead of inventing expiry', async () => {
  const stripe = { charges: { retrieve: jest.fn().mockRejectedValue(new Error('offline')) } };
  await expect(readGigAuthorizationDeadline(stripe, payment, intent())).rejects.toThrow('offline');
});
