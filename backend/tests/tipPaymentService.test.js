const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');

jest.mock('stripe', () => jest.requireActual('./__mocks__/stripe'));

const stripe = require('stripe');
const { createNotification } = require('../services/notificationService');
const stripeService = require('../stripe/stripeService');
const { PAYMENT_STATES } = require('../stripe/paymentStateMachine');

function tipFixture() {
  const payment = { id: 'tip-proof-payment', payer_id: 'tip-payer', payee_id: 'tip-worker', gig_id: 'tip-gig',
    payment_type: 'tip', payment_status: 'authorize_pending', amount_total: 500, amount_subtotal: 500,
    amount_platform_fee: 0, amount_to_payee: 500, amount_processing_fee: 44, tip_amount: 500, currency: 'usd',
    stripe_customer_id: 'cus_tipproof', stripe_payment_intent_id: 'pi_tipproof', metadata: {} };
  const intent = { id: 'pi_tipproof', customer: 'cus_tipproof', livemode: false, amount: 500, currency: 'usd',
    capture_method: 'automatic', confirmation_method: 'automatic', status: 'succeeded', amount_received: 500,
    amount_capturable: 0, transfer_data: null, on_behalf_of: null, application_fee_amount: null,
    latest_charge: 'ch_tipproof', payment_method: 'pm_tipproof', metadata: { payer_id: payment.payer_id,
      payee_id: payment.payee_id, gig_id: payment.gig_id, payment_type: 'tip', platform_fee: '0', payee_stripe_account: 'acct_tipproof' } };
  const charge = { id: 'ch_tipproof', payment_intent: intent.id, customer: intent.customer, livemode: false,
    amount: 500, currency: 'usd', on_behalf_of: null, transfer: null, destination: null, application_fee: null,
    application_fee_amount: null, paid: true, captured: true, amount_captured: 500, amount_refunded: 0,
    refunded: false, disputed: false, dispute: null, created: 1710000000 };
  return { payment, intent, charge };
}

describe('existing tip status requires the current matching provider payment', () => {
  let originalKey;
  beforeEach(() => {
    resetTables(); jest.clearAllMocks(); stripe._resetAll();
    originalKey = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = 'sk_test_tip_proof_fixture';
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  });
  test.each([
    ['intent', { id: 'pi_other' }], ['intent', { customer: 'cus_other' }],
    ['intent', { amount: 600 }], ['intent', { currency: 'eur' }],
    ['intent', { livemode: true }], ['intent', { amount_received: 1 }],
    ['intent', { transfer_data: { destination: 'acct_other' } }],
    ['intent', { metadata: { payer_id: 'another-payer' } }],
    ['charge', { payment_intent: 'pi_other' }], ['charge', { captured: false }],
    ['charge', { amount_captured: 1 }], ['charge', { created: null }],
  ])('rejects mismatched %s evidence before marking paid: %j', async (part, change) => {
    const fixture = tipFixture(); fixture[part] = { ...fixture[part], ...change };
    seedTable('Payment', [fixture.payment]);
    stripe.paymentIntents.retrieve.mockResolvedValue(fixture.intent);
    stripe.charges.retrieve.mockResolvedValue(fixture.charge);
    await expect(stripeService.syncTipPaymentStatus(fixture.payment.id)).rejects.toMatchObject({ code: 'TIP_PROVIDER_REVIEW' });
    expect(getTable('Payment')[0]).toMatchObject({ payment_status: 'authorize_pending' });
    expect(getTable('Payment')[0].payment_succeeded_at).toBeUndefined();
    expect(createNotification).not.toHaveBeenCalled();
  });
  test('a supplied succeeded event cannot override a current processing intent', async () => {
    const { payment, intent } = tipFixture(); seedTable('Payment', [payment]);
    stripe.paymentIntents.retrieve.mockResolvedValue({ ...intent, status: 'processing', amount_received: 0, latest_charge: null });
    const result = await stripeService.syncTipPaymentStatus(payment.id, { paymentIntent: intent });
    expect(result.payment_status).toBe('authorize_pending'); expect(result.stripe_status).toBe('processing');
    expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith(intent.id);
    expect(createNotification).not.toHaveBeenCalled();
  });
  test('a local paid flag without any provider identity cannot confirm a tip', async () => {
    const { payment } = tipFixture();
    seedTable('Payment', [{ ...payment, stripe_payment_intent_id: null,
      payment_status: 'captured_hold', payment_succeeded_at: '2026-09-14T00:00:00Z' }]);
    await expect(stripeService.syncTipPaymentStatus(payment.id)).rejects.toMatchObject({ code: 'TIP_PROVIDER_REVIEW' });
    expect(createNotification).not.toHaveBeenCalled(); expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
  });
  test('an unresolved original without a provider identity stays pending without creating another payment', async () => {
    const { payment } = tipFixture(); seedTable('Payment', [{ ...payment, stripe_payment_intent_id: null }]);
    const result = await stripeService.syncTipPaymentStatus(payment.id);
    expect(result.payment_status).toBe('authorize_pending');
    expect(createNotification).not.toHaveBeenCalled(); expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });
  test('matching current intent and captured Charge confirm the original tip', async () => {
    const { payment, intent, charge } = tipFixture(); seedTable('Payment', [payment]);
    stripe.paymentIntents.retrieve.mockResolvedValue(intent); stripe.charges.retrieve.mockResolvedValue(charge);
    const result = await stripeService.syncTipPaymentStatus(payment.id);
    expect(result.payment_status).toBe('captured_hold');
    expect(getTable('Payment')[0].stripe_charge_id).toBe(charge.id);
    expect(getTable('Payment')[0].payment_succeeded_at).toBe(new Date(charge.created * 1000).toISOString());
    expect(createNotification).toHaveBeenCalledTimes(1);
  });
  test.each(['succeeded', 'canceled'])('a failed database transition never reports %s or writes around the guard', async status => {
    const { payment, intent, charge } = tipFixture(); seedTable('Payment', [payment]);
    stripe.paymentIntents.retrieve.mockResolvedValue(status === 'succeeded' ? intent
      : { ...intent, status, amount_received: 0, latest_charge: null });
    stripe.charges.retrieve.mockResolvedValue(charge);
    const db = require('../config/supabaseAdmin');
    const from = db.from;
    jest.spyOn(db, 'from').mockImplementation(table => {
      const builder = from(table);
      const update = builder.update;
      builder.update = values => {
        update.call(builder, values);
        if (table === 'Payment' && values.payment_status) {
          builder.single = async () => ({ data: null, error: { message: 'Synthetic transition conflict' } });
        }
        return builder;
      };
      return builder;
    });
    await expect(stripeService.syncTipPaymentStatus(payment.id)).rejects.toThrow('Synthetic transition conflict');
    expect(getTable('Payment')[0].payment_status).toBe('authorize_pending');
    expect(createNotification).not.toHaveBeenCalled();
  });
  test('a changed amount during provider verification cannot be marked as the original paid tip', async () => {
    const { payment, intent, charge } = tipFixture(); seedTable('Payment', [payment]);
    stripe.paymentIntents.retrieve.mockResolvedValue(intent);
    stripe.charges.retrieve.mockImplementation(async () => {
      getTable('Payment')[0].amount_total = 600;
      return charge;
    });
    await expect(stripeService.syncTipPaymentStatus(payment.id)).rejects.toThrow();
    expect(getTable('Payment')[0].payment_status).toBe('authorize_pending');
    expect(createNotification).not.toHaveBeenCalled();
  });
});

describe('stripeService.createTipPayment', () => {
  let originalKey;
  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
    stripe._resetAll();
    originalKey = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = 'sk_test_tip_proof_fixture';
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  });

  test('credits the worker with the full tip amount and reconciles immediate success', async () => {
    seedTable('User', [{
      id: 'payer-1',
      email: 'payer@example.com',
      name: 'Payer',
      username: 'payer',
      stripe_customer_id: 'cus_existing123',
    }]);
    seedTable('StripeAccount', [{
      id: 'acct-row-1',
      user_id: 'payee-1',
      stripe_account_id: 'acct_payee123',
      charges_enabled: true,
      payouts_enabled: true,
    }]);
    seedTable('Gig', [{
      id: 'gig-tip-1',
      title: 'Babysitter needed',
    }]);
    seedTable('Payment', []);

    const fixture = tipFixture();
    const intent = { ...fixture.intent, id: 'pi_tip123', customer: 'cus_existing123',
      client_secret: 'pi_tip123_secret', latest_charge: 'ch_tip123', payment_method: 'pm_saved123',
      metadata: { payer_id: 'payer-1', payee_id: 'payee-1', gig_id: 'gig-tip-1',
        payment_type: 'tip', platform_fee: '0', payee_stripe_account: 'acct_payee123' } };
    stripe.paymentIntents.create.mockResolvedValue(intent);
    stripe.paymentIntents.retrieve.mockResolvedValue(intent);
    stripe.charges.retrieve.mockResolvedValue({ ...fixture.charge, id: 'ch_tip123',
      payment_intent: intent.id, customer: intent.customer });

    const result = await stripeService.createTipPayment({
      payerId: 'payer-1',
      payeeId: 'payee-1',
      gigId: 'gig-tip-1',
      amount: 500,
      paymentMethodId: 'pm_saved123',
      offSession: true,
    });

    expect(result.success).toBe(true);

    const payment = getTable('Payment').find((row) => row.id === result.paymentId);
    expect(payment).toBeTruthy();
    expect(payment.amount_total).toBe(500);
    expect(payment.amount_platform_fee).toBe(0);
    expect(payment.amount_processing_fee).toBe(44);
    expect(payment.amount_to_payee).toBe(500);
    expect(payment.payment_status).toBe(PAYMENT_STATES.CAPTURED_HOLD);
    expect(payment.payment_succeeded_at).toBeTruthy();
    expect(payment.stripe_charge_id).toBe('ch_tip123');
    expect(payment.metadata.tip_notification_sent_at).toBeTruthy();

    expect(createNotification).toHaveBeenCalledWith({
      userId: 'payee-1',
      type: 'tip_received',
      title: 'You received a tip!',
      body: 'The poster of "Babysitter needed" sent you a $5.00 tip. 🎉',
      icon: '💰',
      link: '/gigs/gig-tip-1',
      metadata: {
        gig_id: 'gig-tip-1',
        amount: 500,
        payment_id: result.paymentId,
      },
    });
  });
});
